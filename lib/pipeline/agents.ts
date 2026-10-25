import OpenAI from "openai";
import { z } from "zod";

import type { DeviationSignal } from "./deviation";

export interface AgentContext {
  signal: DeviationSignal;
}

export interface BullOutput {
  argument: string;
  direction: "SHORT_CONSTITUENT_LONG_INDEX";
  confidence: number;
  key_points: string[];
}

export interface BearOutput {
  argument: string;
  recommended: "NO_TRADE" | "SHORT_CONSTITUENT_LONG_INDEX";
  confidence: number;
  key_points: string[];
}

export interface ChiefOutput {
  decision: "SHORT" | "NO_TRADE";
  confidence: number;
  thesis: string;
  invalidators: string[];
  key_evidence: string[];
}

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const AGENT_MODEL = "openai/gpt-4o-mini";
const AGENT_TEMPERATURE = 0.2;
const AGENT_MAX_TOKENS = 1000;
const AGENT_TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 2;

const BULL_SYSTEM_PROMPT =
  "You are the Bull Agent for Odysseus, an SSI index-deviation trading system. You receive a structured packet containing an index constituent's weight, its daily return, the index return, the weight-adjusted deviation, and a rolling z-score. Your job: argue the strongest possible case that this deviation represents a mispricing and that a SHORT on the constituent plus a LONG on the index is justified. You must cite specific numbers from the packet. You must not invent news or external facts. Output valid JSON: {\"argument\": \"...\", \"direction\": \"SHORT_CONSTITUENT_LONG_INDEX\", \"confidence\": 0.0, \"key_points\": []}.";

const BEAR_SYSTEM_PROMPT =
  "You are the Bear Agent for Odysseus. You receive the same packet. Argue the strongest case that the deviation is justified, that the data is insufficient, or that execution risk is unacceptable. If you recommend no trade, state why. Cite specific numbers. Do not invent facts. Output valid JSON: {\"argument\": \"...\", \"recommended\": \"NO_TRADE\" | \"SHORT_CONSTITUENT_LONG_INDEX\", \"confidence\": 0.0, \"key_points\": []}.";

const CHIEF_SYSTEM_PROMPT =
  "You are the Chief Decision Agent for Odysseus. You receive the Bull and Bear arguments plus the structured packet. Decide SHORT or NO_TRADE. SHORT means short the constituent perp and long the MAG7SSI index spot. You may only choose SHORT if the constituent is overextended and the Bear's objections are addressed by the packet. Otherwise choose NO_TRADE. Output valid JSON: {\"decision\": \"SHORT\" | \"NO_TRADE\", \"confidence\": 0.0, \"thesis\": \"...\", \"invalidators\": [\"...\"], \"key_evidence\": [\"...\"]}. Do not invent data.";

const confidenceSchema = z.number().min(0).max(1);

export const bullOutputSchema = z.object({
  argument: z.string(),
  direction: z.literal("SHORT_CONSTITUENT_LONG_INDEX"),
  confidence: confidenceSchema,
  key_points: z.array(z.string()),
});

export const bearOutputSchema = z.object({
  argument: z.string(),
  recommended: z.enum(["NO_TRADE", "SHORT_CONSTITUENT_LONG_INDEX"]),
  confidence: confidenceSchema,
  key_points: z.array(z.string()),
});

const chiefResponseSchema = z.object({
  decision: z.string(),
  confidence: confidenceSchema,
  thesis: z.string(),
  invalidators: z.array(z.string()),
  key_evidence: z.array(z.string()),
});

let client: OpenAI | undefined;

function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({
      baseURL: OPENROUTER_BASE_URL,
      apiKey: process.env.OPENROUTER_API_KEY,
      timeout: AGENT_TIMEOUT_MS,
    });
  }

  return client;
}

function buildPacket(signal: DeviationSignal): string {
  return JSON.stringify(
    {
      symbol: signal.symbol,
      weight: signal.weight,
      constituent_daily_return: signal.constituentReturn,
      index_daily_return: signal.indexReturn,
      weight_adjusted_deviation: signal.weightDeviation,
      z_score: signal.zScore,
      direction: signal.direction,
    },
    null,
    2,
  );
}

function logAgentFailure(
  agentName: string,
  attempt: number,
  error: unknown,
): void {
  const message = error instanceof Error ? error.message : String(error);
  console.warn(
    `[agents] ${agentName} attempt ${attempt}/${MAX_ATTEMPTS} failed: ${message}`,
  );
}

async function requestStructuredOutput<T>(
  agentName: string,
  systemPrompt: string,
  userPrompt: string,
  schema: z.ZodType<T>,
): Promise<T | undefined> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const completion = await getClient().chat.completions.create({
        model: AGENT_MODEL,
        temperature: AGENT_TEMPERATURE,
        max_tokens: AGENT_MAX_TOKENS,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });

      const content = completion.choices[0]?.message?.content;

      if (typeof content !== "string" || content.length === 0) {
        throw new Error("OpenRouter returned an empty response");
      }

      const parsed = schema.safeParse(JSON.parse(content));

      if (!parsed.success) {
        const issues = parsed.error.issues
          .map((issue) => `${issue.path.join(".") || "response"}: ${issue.message}`)
          .join("; ");
        throw new Error(`Invalid ${agentName} JSON: ${issues}`);
      }

      return parsed.data;
    } catch (error) {
      logAgentFailure(agentName, attempt, error);
    }
  }

  return undefined;
}

export async function runBullAgent(
  context: AgentContext,
): Promise<BullOutput> {
  const output = await requestStructuredOutput(
    "Bull",
    BULL_SYSTEM_PROMPT,
    `Structured packet:\n${buildPacket(context.signal)}`,
    bullOutputSchema,
  );

  return (
    output ?? {
      argument: "",
      direction: "SHORT_CONSTITUENT_LONG_INDEX",
      confidence: 0,
      key_points: [],
    }
  );
}

export async function runBearAgent(
  context: AgentContext,
): Promise<BearOutput> {
  const output = await requestStructuredOutput(
    "Bear",
    BEAR_SYSTEM_PROMPT,
    `Structured packet:\n${buildPacket(context.signal)}`,
    bearOutputSchema,
  );

  return (
    output ?? {
      argument: "",
      recommended: "NO_TRADE",
      confidence: 0,
      key_points: [],
    }
  );
}

export async function runChiefAgent(
  context: AgentContext,
  bull: BullOutput,
  bear: BearOutput,
): Promise<ChiefOutput> {
  const userPrompt = [
    "Structured packet:",
    buildPacket(context.signal),
    "",
    "Bull output:",
    JSON.stringify(bull, null, 2),
    "",
    "Bear output:",
    JSON.stringify(bear, null, 2),
  ].join("\n");

  const output = await requestStructuredOutput(
    "Chief",
    CHIEF_SYSTEM_PROMPT,
    userPrompt,
    chiefResponseSchema,
  );

  if (!output) {
    return {
      decision: "NO_TRADE",
      confidence: 0,
      thesis: "AI failure fallback",
      invalidators: [],
      key_evidence: [],
    };
  }

  if (output.decision === "SHORT" || output.decision === "NO_TRADE") {
    return {
      ...output,
      decision: output.decision,
    };
  }

  console.warn(
    `[agents] Chief returned disallowed decision: ${output.decision}`,
  );

  return {
    ...output,
    decision: "NO_TRADE",
    invalidators: [
      ...output.invalidators,
      output.decision === "LONG"
        ? "System override: LONG not permitted"
        : "System override: disallowed decision not permitted",
    ],
  };
}
