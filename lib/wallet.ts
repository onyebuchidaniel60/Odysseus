/**
 * Client-safe wallet helpers.
 *
 * Only `NEXT_PUBLIC_*` variables may be read here. Do not import `lib/env`
 * from this module: it requires server-only secrets and must never be bundled
 * into the browser.
 */

export const OPERATOR_ADDRESS = (
  process.env.NEXT_PUBLIC_OPERATOR_ADDRESS ?? ""
).trim();

export function isOperatorWallet(
  address: string | null | undefined,
): boolean {
  if (!address || !OPERATOR_ADDRESS) {
    return false;
  }

  return address.toLowerCase() === OPERATOR_ADDRESS.toLowerCase();
}

export function shortenAddress(address: string): string {
  if (address.length <= 12) {
    return address;
  }

  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
