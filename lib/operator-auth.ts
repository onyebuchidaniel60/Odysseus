import { timingSafeEqual } from "node:crypto";

import { isAddress, isAddressEqual } from "viem";

import type { Env } from "@/lib/env";

type OperatorAuthEnv = Pick<
  Env,
  "NEXT_PUBLIC_OPERATOR_ADDRESS" | "OPERATOR_SECRET"
>;

function secretsMatch(provided: string, expected: string): boolean {
  const providedBuffer = Buffer.from(provided, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");

  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(providedBuffer, expectedBuffer);
}

/**
 * Accepts either:
 * - `x-operator-wallet`: the connected browser wallet address, matched against
 *   NEXT_PUBLIC_OPERATOR_ADDRESS (case-insensitive), or
 * - `x-operator-key`: the static OPERATOR_SECRET used by cron jobs and scripts.
 *
 * Wallet ownership is checked client-side only. This is not a SIWE signature
 * check; the header is a UX gate, not a cryptographic proof.
 */
export function isAuthorizedOperator(
  request: Request,
  env: OperatorAuthEnv,
): boolean {
  const providedWallet = request.headers.get("x-operator-wallet")?.trim();

  if (
    providedWallet &&
    isAddress(providedWallet) &&
    isAddress(env.NEXT_PUBLIC_OPERATOR_ADDRESS) &&
    isAddressEqual(providedWallet, env.NEXT_PUBLIC_OPERATOR_ADDRESS)
  ) {
    return true;
  }

  const providedSecret = request.headers.get("x-operator-key");

  if (providedSecret && env.OPERATOR_SECRET) {
    return secretsMatch(providedSecret, env.OPERATOR_SECRET);
  }

  return false;
}
