import { keccak256, toHex, verifyTypedData } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { TEST_PRIVATE_KEY } = vi.hoisted(() => ({
  TEST_PRIVATE_KEY: `0x${"11".repeat(32)}`,
}));

vi.mock("@/lib/env", () => ({
  getEnv: vi.fn(() => ({
    SODEX_ACCOUNT_ID: "1001",
    SODEX_PRIVATE_KEY: TEST_PRIVATE_KEY,
    SODEX_API_KEY_NAME: "test-key",
    SODEX_BASE_URL: "https://testnet-gw.sodex.dev",
  })),
}));

import { placeOrders } from "@/lib/sodex/client";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const TEST_ACCOUNT = privateKeyToAccount(
  TEST_PRIVATE_KEY as `0x${string}`,
);

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const EXCHANGE_ACTION_TYPES = {
  ExchangeAction: [
    { name: "payloadHash", type: "bytes32" },
    { name: "nonce", type: "uint64" },
  ],
} as const;

async function verifyOrderSignature(
  domainName: "spot" | "futures",
  action: "batchNewOrder" | "newOrder",
  params: Record<string, unknown>,
  signature: string,
  nonce: string,
): Promise<boolean> {
  const payloadHash = keccak256(
    toHex(JSON.stringify({ type: action, params })),
  );

  return verifyTypedData({
    address: TEST_ACCOUNT.address,
    domain: {
      name: domainName,
      version: "1",
      chainId: 138565,
      verifyingContract: ZERO_ADDRESS,
    },
    types: EXCHANGE_ACTION_TYPES,
    primaryType: "ExchangeAction",
    message: {
      payloadHash,
      nonce: BigInt(nonce),
    },
    signature: `0x${signature.slice(4)}` as `0x${string}`,
  });
}

describe("placeOrders (mock mode)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns simulated fills with a generated order ID per leg", async () => {
    const promise = placeOrders(
      [{ symbol: "btc", side: "SHORT", sizeUsd: 5_000 }],
      true,
    );

    await vi.advanceTimersByTimeAsync(500);
    const result = await promise;

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
    expect(result.legs).toHaveLength(1);
    expect(result.legs[0]).toMatchObject({
      symbol: "btc",
      status: "filled",
    });
    expect(result.legs[0].orderId).toMatch(UUID_PATTERN);
  });

  it("returns a unique order ID for each leg in a multi-leg order", async () => {
    const promise = placeOrders(
      [
        { symbol: "btc", side: "SHORT", sizeUsd: 5_000 },
        { symbol: "ssimag7", side: "LONG", sizeUsd: 5_000 },
      ],
      true,
    );

    await vi.advanceTimersByTimeAsync(500);
    const result = await promise;

    expect(result.success).toBe(true);
    expect(result.legs.map((leg) => leg.symbol)).toEqual([
      "btc",
      "ssimag7",
    ]);
    expect(result.legs.every((leg) => leg.status === "filled")).toBe(true);
    expect(new Set(result.legs.map((leg) => leg.orderId)).size).toBe(2);
  });

  it("waits 500ms before returning simulated fills", async () => {
    let settled = false;

    const promise = placeOrders(
      [{ symbol: "eth", side: "SHORT", sizeUsd: 2_500 }],
      true,
    ).then((result) => {
      settled = true;
      return result;
    });

    await vi.advanceTimersByTimeAsync(499);
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await promise;
    expect(settled).toBe(true);
  });
});

describe("placeOrders (real mode)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  function orderResponse(orderID: number) {
    return {
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          code: 0,
          data: [{ code: 0, clOrdID: "test", orderID }],
        }),
    };
  }

  it("signs and submits a SHORT perp order with the futures domain", async () => {
    const fetchMock = vi.fn(async () => orderResponse(98_765));
    vi.stubGlobal("fetch", fetchMock);

    const result = await placeOrders(
      [{ symbol: "101", side: "SHORT", sizeUsd: 5_000 }],
      false,
    );

    expect(result.success).toBe(true);
    expect(result.orderId).toMatch(UUID_PATTERN);
    expect(result.legs).toEqual([
      { symbol: "101", orderId: "98765", status: "submitted" },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];

    expect(url).toBe(
      "https://testnet-gw.sodex.dev/api/v1/perps/trade/orders",
    );
    expect(init.method).toBe("POST");

    const headers = init.headers as Record<string, string>;

    expect(headers["X-API-Key"]).toBe("test-key");
    expect(headers["X-API-Chain"]).toBe("138565");
    expect(headers["X-API-Nonce"]).toMatch(/^\d+$/);
    expect(headers["X-API-Sign"]).toMatch(/^0x01[0-9a-f]{130}$/i);
    expect(headers["X-Client-Order-ID"]).toMatch(UUID_PATTERN);

    const body = JSON.parse(init.body as string) as Record<string, unknown>;

    expect(body).toEqual({
      accountID: 1_001,
      symbolID: 101,
      orders: [
        {
          clOrdID: expect.stringMatching(/^[0-9a-f]{28}\d{2}$/i),
          modifier: 1,
          side: 2,
          type: 2,
          timeInForce: 3,
          funds: "5000",
          reduceOnly: false,
          positionSide: 1,
        },
      ],
    });

    await expect(
      verifyOrderSignature(
        "futures",
        "newOrder",
        body,
        headers["X-API-Sign"],
        headers["X-API-Nonce"],
      ),
    ).resolves.toBe(true);
  });

  it("signs and submits a LONG spot order with the spot domain", async () => {
    const fetchMock = vi.fn(async () => orderResponse(55_555));
    vi.stubGlobal("fetch", fetchMock);

    const result = await placeOrders(
      [{ symbol: "777", side: "LONG", sizeUsd: 5_000 }],
      false,
    );

    expect(result.success).toBe(true);
    expect(result.legs).toEqual([
      { symbol: "777", orderId: "55555", status: "submitted" },
    ]);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];

    expect(url).toBe(
      "https://testnet-gw.sodex.dev/api/v1/spot/trade/orders/batch",
    );

    const headers = init.headers as Record<string, string>;
    const body = JSON.parse(init.body as string) as Record<string, unknown>;

    expect(body).toEqual({
      accountID: 1_001,
      orders: [
        {
          symbolID: 777,
          clOrdID: expect.stringMatching(/^[0-9a-f]{28}\d{2}$/i),
          side: 1,
          type: 2,
          timeInForce: 3,
          funds: "5000",
        },
      ],
    });

    await expect(
      verifyOrderSignature(
        "spot",
        "batchNewOrder",
        body,
        headers["X-API-Sign"],
        headers["X-API-Nonce"],
      ),
    ).resolves.toBe(true);
  });
});
