import { describe, expect, it } from "vitest";

import { isAuthorizedOperator } from "@/lib/operator-auth";

const operatorAddress = "0x69461740214a68d34157b3A14f513fA47f9a08E0";
const operatorSecret = "a".repeat(64);

const env = {
  NEXT_PUBLIC_OPERATOR_ADDRESS: operatorAddress,
  OPERATOR_SECRET: operatorSecret,
};

function requestWithHeaders(headers: Record<string, string>): Request {
  return new Request("http://localhost:3000/api/run", {
    method: "POST",
    headers,
  });
}

describe("operator authentication", () => {
  it("accepts the configured operator wallet regardless of address casing", () => {
    expect(
      isAuthorizedOperator(
        requestWithHeaders({
          "x-operator-wallet": operatorAddress.toLowerCase(),
        }),
        env,
      ),
    ).toBe(true);
  });

  it("rejects a different connected wallet", () => {
    expect(
      isAuthorizedOperator(
        requestWithHeaders({
          "x-operator-wallet": "0x0000000000000000000000000000000000000001",
        }),
        env,
      ),
    ).toBe(false);
  });

  it("rejects malformed wallet headers", () => {
    expect(
      isAuthorizedOperator(
        requestWithHeaders({ "x-operator-wallet": "not-an-address" }),
        env,
      ),
    ).toBe(false);
  });

  it("still accepts the static operator secret for cron and scripts", () => {
    expect(
      isAuthorizedOperator(
        requestWithHeaders({ "x-operator-key": operatorSecret }),
        env,
      ),
    ).toBe(true);
  });

  it("rejects an invalid operator secret", () => {
    expect(
      isAuthorizedOperator(
        requestWithHeaders({ "x-operator-key": "b".repeat(64) }),
        env,
      ),
    ).toBe(false);
  });

  it("rejects requests without operator credentials", () => {
    expect(isAuthorizedOperator(requestWithHeaders({}), env)).toBe(false);
  });
});
