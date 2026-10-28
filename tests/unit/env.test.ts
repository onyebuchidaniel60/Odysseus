import { describe, expect, it } from "vitest";
import { ZodError, z } from "zod";

import { envSchema, parseEnv } from "@/lib/env";

const requiredEnv = {
  DATABASE_URL: "postgres://postgres:postgres@localhost:5432/odysseus",
  SOSO_API_KEY: "soso_test_key",
  SODEX_BASE_URL: "https://testnet-gw.sodex.dev",
  SODEX_API_KEY_PRIVATE_KEY: `0x${"1".repeat(64)}`,
  SODEX_API_KEY_NAME: "odysseus-testnet",
  SODEX_ACCOUNT_ID: "60504",
  OPENAI_API_KEY: "sk-test",
  OPERATOR_SECRET: "a".repeat(64),
};

describe("environment schema", () => {
  it("parses required variables and applies documented defaults", () => {
    const env = parseEnv(requiredEnv);

    expect(env.OPENAI_MODEL).toBe("gpt-4o-mini");
    expect(env.Z_SCORE_THRESHOLD).toBe(2.0);
    expect(env.TRACKING_ERROR_TOLERANCE).toBe(0.02);
    expect(env.MAX_POSITION_PCT).toBe(0.1);
    expect(env.MAX_PERP_LEVERAGE).toBe(2);
    expect(env.MOCK_SODEX).toBe(false);
    expect(env.NEXT_PUBLIC_APP_URL).toBe("http://localhost:3000");
    expect(env.ODYSSEUS_INDEX_TICKER).toBe("ssimag7");
    expect(env.SODEX_ACCOUNT_ID).toBe("60504");
  });

  it("defaults NODE_ENV to development when unset", () => {
    const env = parseEnv(requiredEnv);

    expect(env.NODE_ENV).toBe("development");
  });

  it("parses NODE_ENV production", () => {
    const env = parseEnv({ ...requiredEnv, NODE_ENV: "production" });

    expect(env.NODE_ENV).toBe("production");
  });

  it("throws a Zod error for an invalid NODE_ENV", () => {
    const invalidEnv = {
      ...requiredEnv,
      NODE_ENV: "invalid",
    } as unknown as z.input<typeof envSchema>;

    expect(() => envSchema.parse(invalidEnv)).toThrow(ZodError);
  });

  it("coerces optional overrides from strings", () => {
    const env = parseEnv({
      ...requiredEnv,
      Z_SCORE_THRESHOLD: "2.5",
      MOCK_SODEX: "true",
      MAX_PERP_LEVERAGE: "1",
    });

    expect(env.Z_SCORE_THRESHOLD).toBe(2.5);
    expect(env.MOCK_SODEX).toBe(true);
    expect(env.MAX_PERP_LEVERAGE).toBe(1);
  });

  it("rejects missing required variables", () => {
    const result = envSchema.safeParse({});

    expect(result.success).toBe(false);
    if (!result.success) {
      const missing = result.error.issues.map((issue) => issue.path[0]);
      expect(missing).toEqual(
        expect.arrayContaining([
          "DATABASE_URL",
          "SOSO_API_KEY",
          "SODEX_BASE_URL",
          "SODEX_API_KEY_PRIVATE_KEY",
          "SODEX_API_KEY_NAME",
          "SODEX_ACCOUNT_ID",
          "OPENAI_API_KEY",
          "OPERATOR_SECRET",
        ]),
      );
    }
  });

  it("rejects malformed API key private keys", () => {
    const result = envSchema.safeParse({
      ...requiredEnv,
      SODEX_API_KEY_PRIVATE_KEY: "not-a-private-key",
    });

    expect(result.success).toBe(false);
  });

  it("rejects UUID account IDs and accepts uint64 strings", () => {
    expect(
      envSchema.safeParse({
        ...requiredEnv,
        SODEX_ACCOUNT_ID: "00000000-0000-4000-8000-000000000000",
      }).success,
    ).toBe(false);

    expect(
      envSchema.safeParse({
        ...requiredEnv,
        SODEX_ACCOUNT_ID: "18446744073709551615",
      }).success,
    ).toBe(true);
  });

  it("rejects zero and out-of-range account IDs", () => {
    expect(
      envSchema.safeParse({ ...requiredEnv, SODEX_ACCOUNT_ID: "0" }).success,
    ).toBe(false);

    expect(
      envSchema.safeParse({
        ...requiredEnv,
        SODEX_ACCOUNT_ID: "18446744073709551616",
      }).success,
    ).toBe(false);
  });
});
