import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const { createCompletion } = vi.hoisted(() => ({
  createCompletion: vi.fn(),
}));

vi.mock("openai", () => ({
  default: vi.fn(() => ({
    chat: {
      completions: {
        create: createCompletion,
      },
    },
  })),
}));

import {
  runBearAgent,
  runBullAgent,
  runChiefAgent,
} from "@/lib/pipeline/agents";
import type {
  BearOutput,
  BullOutput,
  ChiefOutput,
} from "@/lib/pipeline/agents";
import type { DeviationSignal } from "@/lib/pipeline/deviation";

const warnSpy = vi.spyOn(console, "warn");

const signal: DeviationSignal = {
  symbol: "btc",
  weight: 0.7363,
  constituentReturn: 0.012,
  indexReturn: 0.004,
  weightDeviation: 0.7363 * (0.012 - 0.004),
  zScore: 2.34,
  direction: "overextended",
};

const bullOutput: BullOutput = {
  argument:
    "BTC returned 1.20% versus the index's 0.40%, producing a weight-adjusted deviation of 0.0058904 and a z-score of 2.34.",
  direction: "SHORT_CONSTITUENT_LONG_INDEX",
  confidence: 0.72,
  key_points: [
    "z-score 2.34 exceeds the 2.0 threshold",
    "BTC daily return 1.20% versus index 0.40%",
  ],
};

const bearOutput: BearOutput = {
  argument:
    "The 0.0058904 deviation is plausible given BTC's 0.7363 weight and the 0.40% index move, so the edge may be noise.",
  recommended: "NO_TRADE",
  confidence: 0.58,
  key_points: ["Synthesis tracking error may explain part of the gap"],
};

const chiefOutput: ChiefOutput = {
  decision: "SHORT",
  confidence: 0.64,
  thesis:
    "BTC is overextended with a z-score of 2.34; the Bear's noise objection is weaker than the measured deviation.",
  invalidators: ["Synthetic index tracking error exceeds tolerance"],
  key_evidence: ["z-score 2.34", "weight deviation 0.0058904"],
};

function completionWith(content: string) {
  return {
    choices: [{ message: { content } }],
  };
}

function jsonCompletion(payload: unknown) {
  return completionWith(JSON.stringify(payload));
}

function firstRequest() {
  return createCompletion.mock.calls[0][0] as {
    model: string;
    temperature: number;
    max_tokens: number;
    response_format: { type: string };
    messages: Array<{ role: string; content: string }>;
  };
}

beforeAll(() => {
  vi.stubEnv("OPENROUTER_API_KEY", "test-key");
});

beforeEach(() => {
  createCompletion.mockReset();
  warnSpy.mockClear();
  warnSpy.mockImplementation(() => {});
});

afterEach(() => {
  warnSpy.mockClear();
});

afterAll(() => {
  warnSpy.mockRestore();
  vi.unstubAllEnvs();
});

describe("Bull agent", () => {
  it("parses valid JSON correctly", async () => {
    createCompletion.mockResolvedValue(jsonCompletion(bullOutput));

    await expect(runBullAgent({ signal })).resolves.toEqual(bullOutput);

    expect(createCompletion).toHaveBeenCalledTimes(1);

    const request = firstRequest();
    expect(request.model).toBe("openai/gpt-4o-mini");
    expect(request.temperature).toBe(0.2);
    expect(request.max_tokens).toBe(1000);
    expect(request.response_format).toEqual({ type: "json_object" });
    expect(request.messages[0].content).toContain("You are the Bull Agent");
    expect(request.messages[0].content).toContain("between 0.50 and 0.95");
    expect(request.messages[0].content).toContain("never return 0.0");
    expect(request.messages[1].content).toContain('"symbol": "btc"');
    expect(request.messages[1].content).toContain('"z_score": 2.34');
  });

  it("retries when the Bull proposes a trade with zero confidence", async () => {
    createCompletion
      .mockResolvedValueOnce(
        jsonCompletion({ ...bullOutput, confidence: 0 }),
      )
      .mockResolvedValueOnce(jsonCompletion(bullOutput));

    await expect(runBullAgent({ signal })).resolves.toEqual(bullOutput);

    expect(createCompletion).toHaveBeenCalledTimes(2);
    expect(createCompletion.mock.calls[1][0].messages[1].content).toContain(
      "greater than 0",
    );
  });

  it("falls back to an empty argument when JSON is invalid", async () => {
    createCompletion.mockResolvedValue(completionWith("{invalid json"));

    const result = await runBullAgent({ signal });

    expect(result).toEqual({
      argument: "",
      direction: "SHORT_CONSTITUENT_LONG_INDEX",
      confidence: 0,
      key_points: [],
    });
    expect(createCompletion).toHaveBeenCalledTimes(2);
  });

  it("retries once and succeeds when the first response is schema-invalid", async () => {
    createCompletion
      .mockResolvedValueOnce(completionWith("{}"))
      .mockResolvedValueOnce(jsonCompletion(bullOutput));

    await expect(runBullAgent({ signal })).resolves.toEqual(bullOutput);

    expect(createCompletion).toHaveBeenCalledTimes(2);
  });
});

describe("Bear agent", () => {
  it("parses valid JSON correctly", async () => {
    createCompletion.mockResolvedValue(jsonCompletion(bearOutput));

    await expect(runBearAgent({ signal })).resolves.toEqual(bearOutput);

    expect(createCompletion).toHaveBeenCalledTimes(1);

    const request = firstRequest();
    expect(request.model).toBe("openai/gpt-4o-mini");
    expect(request.messages[0].content).toContain("You are the Bear Agent");
  });

  it("falls back to NO_TRADE when the API errors", async () => {
    createCompletion.mockRejectedValue(new Error("OpenRouter rate limit"));

    const result = await runBearAgent({ signal });

    expect(result).toEqual({
      argument: "",
      recommended: "NO_TRADE",
      confidence: 0,
      key_points: [],
    });
    expect(createCompletion).toHaveBeenCalledTimes(2);
  });
});

describe("Chief agent", () => {
  it("parses valid JSON correctly", async () => {
    createCompletion.mockResolvedValue(jsonCompletion(chiefOutput));

    await expect(
      runChiefAgent({ signal }, bullOutput, bearOutput),
    ).resolves.toEqual(chiefOutput);

    expect(createCompletion).toHaveBeenCalledTimes(1);

    const request = firstRequest();
    expect(request.model).toBe("openai/gpt-4o-mini");
    expect(request.messages[0].content).toContain("You are the Chief");
    expect(request.messages[0].content).toContain(
      "deterministic risk engine's responsibility",
    );
    expect(request.messages[0].content).toContain(
      "not by itself an objection",
    );
    expect(request.messages[1].content).toContain("Bull output:");
    expect(request.messages[1].content).toContain("Bear output:");
    expect(request.messages[1].content).toContain(bullOutput.argument);
    expect(request.messages[1].content).toContain(bearOutput.argument);
  });

  it("overrides a LONG decision to NO_TRADE and appends the invalidator", async () => {
    const longResponse = {
      decision: "LONG",
      confidence: 0.81,
      thesis: "BTC looks cheap enough to buy",
      invalidators: ["Bear flagged data staleness"],
      key_evidence: ["z-score 2.34"],
    };

    createCompletion.mockResolvedValue(jsonCompletion(longResponse));

    const result = await runChiefAgent({ signal }, bullOutput, bearOutput);

    expect(result).toEqual({
      decision: "NO_TRADE",
      confidence: 0.81,
      thesis: "BTC looks cheap enough to buy",
      invalidators: [
        "Bear flagged data staleness",
        "System override: LONG not permitted",
      ],
      key_evidence: ["z-score 2.34"],
    });
  });

  it("falls back to NO_TRADE when the API errors", async () => {
    createCompletion.mockRejectedValue(new Error("OpenRouter timeout"));

    const result = await runChiefAgent({ signal }, bullOutput, bearOutput);

    expect(result).toEqual({
      decision: "NO_TRADE",
      confidence: 0,
      thesis: "AI failure fallback",
      invalidators: [],
      key_evidence: [],
    });
    expect(createCompletion).toHaveBeenCalledTimes(2);
  });
});
