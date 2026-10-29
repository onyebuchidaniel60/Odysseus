import { z } from "zod";

const emptyToUndefined = (value: unknown) =>
  value === "" || value === null ? undefined : value;

const numberFromEnv = (schema: z.ZodNumber, fallback: number) =>
  z.preprocess(emptyToUndefined, schema.default(fallback));

const booleanFromEnv = z.preprocess(
  emptyToUndefined,
  z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
);

export const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  DATABASE_URL: z
    .string({ required_error: "DATABASE_URL is required" })
    .min(1, "DATABASE_URL is required")
    .url("DATABASE_URL must be a valid URL"),

  SOSO_API_KEY: z
    .string({ required_error: "SOSO_API_KEY is required" })
    .min(1, "SOSO_API_KEY is required"),

  SODEX_BASE_URL: z
    .string({ required_error: "SODEX_BASE_URL is required" })
    .min(1, "SODEX_BASE_URL is required")
    .url("SODEX_BASE_URL must be a valid URL"),

  SODEX_API_KEY_PRIVATE_KEY: z
    .string({
      required_error: "SODEX_API_KEY_PRIVATE_KEY is required",
    })
    .regex(
      /^0x[0-9a-fA-F]{64}$/,
      "SODEX_API_KEY_PRIVATE_KEY must be a 0x-prefixed 32-byte hex string",
    ),

  SODEX_API_KEY_NAME: z
    .string({ required_error: "SODEX_API_KEY_NAME is required" })
    .min(1, "SODEX_API_KEY_NAME is required"),

  SODEX_ACCOUNT_ID: z
    .string({ required_error: "SODEX_ACCOUNT_ID is required" })
    .regex(/^\d+$/, "SODEX_ACCOUNT_ID must be a uint64 string")
    .refine((value) => {
      if (!/^\d+$/.test(value)) {
        return false;
      }

      const parsed = BigInt(value);
      return (
        parsed > BigInt(0) &&
        parsed <= BigInt("18446744073709551615")
      );
    }, "SODEX_ACCOUNT_ID must be between 1 and 2^64-1"),

  OPENAI_API_KEY: z
    .string({ required_error: "OPENAI_API_KEY is required" })
    .min(1, "OPENAI_API_KEY is required"),

  OPENAI_MODEL: z.preprocess(
    emptyToUndefined,
    z.string().min(1).default("gpt-4o-mini"),
  ),

  OPERATOR_SECRET: z
    .string({ required_error: "OPERATOR_SECRET is required" })
    .min(32, "OPERATOR_SECRET must be at least 32 characters"),

  Z_SCORE_THRESHOLD: numberFromEnv(z.coerce.number().positive(), 2.0),

  TRACKING_ERROR_TOLERANCE: numberFromEnv(
    z.coerce.number().positive().max(1),
    0.02,
  ),

  MAX_POSITION_PCT: numberFromEnv(z.coerce.number().positive().max(1), 0.1),

  MAX_PERP_LEVERAGE: numberFromEnv(
    z.coerce.number().int().min(1).max(2),
    2,
  ),

  MOCK_SODEX: booleanFromEnv,

  ALLOW_PAPER_SPOT: booleanFromEnv,

  FORCE_DEMO_TRADE: booleanFromEnv,

  NEXT_PUBLIC_APP_URL: z.preprocess(
    emptyToUndefined,
    z.string().url().default("http://localhost:3000"),
  ),

  ODYSSEUS_INDEX_TICKER: z.literal("ssimag7").default("ssimag7"),
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | undefined;

export function parseEnv(
  source: Record<string, string | undefined> = process.env,
): Env {
  const result = envSchema.safeParse(source);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration: ${issues}`);
  }

  return result.data;
}

export function getEnv(): Env {
  if (!cachedEnv) {
    cachedEnv = parseEnv();
  }

  return cachedEnv;
}
