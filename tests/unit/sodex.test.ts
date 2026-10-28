import { keccak256, toHex, verifyTypedData } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { TEST_PRIVATE_KEY, MOCK_ENV } = vi.hoisted(() => {
  const privateKey = `0x${"11".repeat(32)}`;

  return {
    TEST_PRIVATE_KEY: privateKey,
    MOCK_ENV: {
      SODEX_ACCOUNT_ID: "1001",
      SODEX_API_KEY_PRIVATE_KEY: privateKey,
      SODEX_API_KEY_NAME: "test-key",
      SODEX_BASE_URL: "https://testnet-gw.sodex.dev",
      ALLOW_PAPER_SPOT: false,
    },
  };
});

vi.mock("@/lib/env", () => ({
  getEnv: vi.fn(() => MOCK_ENV),
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

const PERPS_SYMBOLS = [
  {
    id: 1,
    name: "BTC-USD",
    displayName: "BTC-USD",
    baseCoin: "BTC",
    quantityPrecision: 5,
    stepSize: "0.00001",
    minQuantity: "0.00001",
    minNotional: "10",
  },
  {
    id: 2,
    name: "ETH-USD",
    displayName: "ETH-USD",
    baseCoin: "ETH",
    quantityPrecision: 4,
    stepSize: "0.0001",
    minQuantity: "0.0001",
    minNotional: "10",
  },
];

const SPOT_SYMBOLS = [
  {
    id: 3,
    name: "vMAG7ssi_vUSDC",
    displayName: "MAG7ssi/USDC",
    baseCoin: "vMAG7ssi",
    quantityPrecision: 2,
    stepSize: "0.01",
    minQuantity: "0.01",
    minNotional: "5",
  },
];

function jsonResponse(data: unknown) {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify(data),
  };
}

function orderResponse(orderID: number) {
  return jsonResponse({
    code: 0,
    data: [{ code: 0, clOrdID: "test", orderID }],
  });
}

function toViemSignature(signature: string): `0x${string}` {
  const raw = signature.slice(4);
  const recovery = Number.parseInt(raw.slice(-2), 16);
  const viemRecovery = recovery < 27 ? recovery + 27 : recovery;

  return `0x${raw.slice(0, -2)}${viemRecovery.toString(16)}` as `0x${string}`;
}

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
    signature: toViemSignature(signature),
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
      mode: "mock",
    });
    expect(result.executionMode).toBe("MOCK");
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
    MOCK_ENV.ALLOW_PAPER_SPOT = false;
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("maps a SHORT constituent to its perps symbol and sizes by mark price", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/perps/markets/symbols")) {
        return jsonResponse({ code: 0, data: PERPS_SYMBOLS });
      }
      if (url.endsWith("/perps/markets/mark-prices")) {
        return jsonResponse({
          code: 0,
          data: [{ symbol: "BTC-USD", markPrice: "80000" }],
        });
      }
      if (url.endsWith("/perps/trade/orders")) {
        return orderResponse(98_765);
      }
      if (url.includes("/perps/accounts/") && url.includes("/orders/history")) {
        return jsonResponse({
          code: 0,
          data: [{ orderID: 98_765, status: "FILLED" }],
        });
      }

      throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await placeOrders(
      [{ symbol: "btc", side: "SHORT", sizeUsd: 10 }],
      false,
    );

    expect(result.success).toBe(true);
    expect(result.orderId).toMatch(UUID_PATTERN);
    expect(result.legs).toEqual([
      { symbol: "btc", orderId: "98765", status: "filled", mode: "live" },
    ]);

    const orderCall = fetchMock.mock.calls.find(([input]) =>
      String(input).endsWith("/perps/trade/orders"),
    ) as unknown as [string, RequestInit] | undefined;

    expect(orderCall).toBeDefined();
    const [url, init] = orderCall!;

    expect(url).toBe(
      "https://testnet-gw.sodex.dev/api/v1/perps/trade/orders",
    );
    expect(init.method).toBe("POST");

    const headers = init.headers as Record<string, string>;

    expect(headers["X-API-Key"]).toBe("test-key");
    expect(headers["X-API-Chain"]).toBe("138565");
    expect(headers["X-API-Nonce"]).toMatch(/^\d+$/);
    expect(headers["X-API-Sign"]).toMatch(/^0x01[0-9a-f]{130}$/i);
    expect(headers["X-API-Sign"].slice(-2)).toMatch(/^(00|01)$/);
    expect(headers["X-Client-Order-ID"]).toMatch(UUID_PATTERN);

    const body = JSON.parse(init.body as string) as Record<string, unknown>;

    expect(body).toEqual({
      accountID: 1_001,
      symbolID: 1,
      orders: [
        {
          clOrdID: expect.stringMatching(/^[0-9a-f]{28}\d{2}$/i),
          modifier: 1,
          side: 2,
          type: 2,
          timeInForce: 3,
          quantity: "0.00013",
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

  it("maps a LONG index leg to its spot symbol and submits funds", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/spot/markets/symbols")) {
        return jsonResponse({ code: 0, data: SPOT_SYMBOLS });
      }
      if (url.includes("/spot/markets/vMAG7ssi_vUSDC/orderbook")) {
        return jsonResponse({
          code: 0,
          data: { asks: [["0.5", "100"]] },
        });
      }
      if (url.endsWith("/spot/trade/orders/batch")) {
        return orderResponse(55_555);
      }
      if (url.includes("/spot/accounts/") && url.includes("/orders/history")) {
        return jsonResponse({
          code: 0,
          data: [{ orderID: 55_555, status: "FILLED" }],
        });
      }

      throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await placeOrders(
      [{ symbol: "ssimag7", side: "LONG", sizeUsd: 10 }],
      false,
    );

    expect(result.success).toBe(true);
    expect(result.legs).toEqual([
      { symbol: "ssimag7", orderId: "55555", status: "filled", mode: "live" },
    ]);

    const orderCall = fetchMock.mock.calls.find(([input]) =>
      String(input).endsWith("/spot/trade/orders/batch"),
    ) as unknown as [string, RequestInit] | undefined;

    expect(orderCall).toBeDefined();
    const [url, init] = orderCall!;

    expect(url).toBe(
      "https://testnet-gw.sodex.dev/api/v1/spot/trade/orders/batch",
    );

    const headers = init.headers as Record<string, string>;
    const body = JSON.parse(init.body as string) as Record<string, unknown>;

    expect(body).toEqual({
      accountID: 1_001,
      orders: [
        {
          symbolID: 3,
          clOrdID: expect.stringMatching(/^[0-9a-f]{28}\d{2}$/i),
          side: 1,
          type: 2,
          timeInForce: 3,
          funds: "10",
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

  it("fails when a submitted order is terminal but not filled", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/perps/markets/symbols")) {
        return jsonResponse({ code: 0, data: PERPS_SYMBOLS });
      }
      if (url.endsWith("/perps/markets/mark-prices")) {
        return jsonResponse({
          code: 0,
          data: [{ symbol: "BTC-USD", markPrice: "80000" }],
        });
      }
      if (url.endsWith("/perps/trade/orders")) {
        return orderResponse(12_345);
      }
      if (url.includes("/perps/accounts/") && url.includes("/orders/history")) {
        return jsonResponse({
          code: 0,
          data: [{ orderID: 12_345, status: "CANCELED" }],
        });
      }

      throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await placeOrders(
      [{ symbol: "btc", side: "SHORT", sizeUsd: 10 }],
      false,
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe("sodex_order_not_filled:btc:canceled");
    expect(result.legs).toEqual([
      { symbol: "btc", orderId: "12345", status: "canceled", mode: "live" },
    ]);
  });

  it("bumps a perps quantity to satisfy the minimum notional", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/perps/markets/symbols")) {
        return jsonResponse({ code: 0, data: PERPS_SYMBOLS });
      }
      if (url.endsWith("/perps/markets/mark-prices")) {
        return jsonResponse({
          code: 0,
          data: [{ symbol: "ETH-USD", markPrice: "2312.6" }],
        });
      }
      if (url.endsWith("/perps/trade/orders")) {
        return orderResponse(77_777);
      }

      throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await placeOrders(
      [{ symbol: "eth", side: "SHORT", sizeUsd: 10 }],
      false,
    );

    expect(result.success).toBe(true);

    const orderCall = fetchMock.mock.calls.find(([input]) =>
      String(input).endsWith("/perps/trade/orders"),
    ) as unknown as [string, RequestInit] | undefined;

    expect(orderCall).toBeDefined();
    const body = JSON.parse(orderCall![1].body as string) as {
      orders: Array<{ quantity: string }>;
    };

    expect(body.orders[0]?.quantity).toBe("0.0044");
  });

  it("rejects the batch when the spot index has no ask liquidity", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/spot/markets/symbols")) {
        return jsonResponse({ code: 0, data: SPOT_SYMBOLS });
      }
      if (url.includes("/spot/markets/vMAG7ssi_vUSDC/orderbook")) {
        return jsonResponse({ code: 0, data: { asks: [] } });
      }

      throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await placeOrders(
      [
        { symbol: "btc", side: "SHORT", sizeUsd: 10 },
        { symbol: "ssimag7", side: "LONG", sizeUsd: 10 },
      ],
      false,
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe(
      "sodex_insufficient_spot_liquidity:vMAG7ssi_vUSDC:0.00",
    );
    expect(
      fetchMock.mock.calls.some(([input]) =>
        String(input).includes("/trade/orders"),
      ),
    ).toBe(false);
  });

  it("paper-fills a zero-ask spot leg and still executes the perps leg", async () => {
    MOCK_ENV.ALLOW_PAPER_SPOT = true;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/spot/markets/symbols")) {
        return jsonResponse({ code: 0, data: SPOT_SYMBOLS });
      }
      if (url.includes("/spot/markets/vMAG7ssi_vUSDC/orderbook")) {
        return jsonResponse({ code: 0, data: { asks: [] } });
      }
      if (url.endsWith("/perps/markets/symbols")) {
        return jsonResponse({ code: 0, data: PERPS_SYMBOLS });
      }
      if (url.endsWith("/perps/markets/mark-prices")) {
        return jsonResponse({
          code: 0,
          data: [{ symbol: "BTC-USD", markPrice: "80000" }],
        });
      }
      if (url.endsWith("/perps/trade/orders")) {
        return orderResponse(98_765);
      }
      if (url.includes("/perps/accounts/") && url.includes("/orders/history")) {
        return jsonResponse({
          code: 0,
          data: [{ orderID: 98_765, status: "FILLED" }],
        });
      }

      throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await placeOrders(
      [
        { symbol: "btc", side: "SHORT", sizeUsd: 10 },
        { symbol: "ssimag7", side: "LONG", sizeUsd: 10 },
      ],
      false,
    );

    expect(result.success).toBe(true);
    expect(result.executionMode).toBe("PAPER_SPOT");
    expect(result.legs).toHaveLength(2);
    expect(result.legs[0]).toEqual({
      symbol: "btc",
      orderId: "98765",
      status: "filled",
      mode: "live",
    });
    expect(result.legs[1]).toMatchObject({
      symbol: "ssimag7",
      status: "filled",
      mode: "paper",
    });
    expect(result.legs[1]?.orderId).toMatch(/^paper_spot_/);
    expect(
      fetchMock.mock.calls.some(([input]) =>
        String(input).includes("/spot/trade/orders"),
      ),
    ).toBe(false);
    expect(
      fetchMock.mock.calls.filter(([input]) =>
        String(input).endsWith("/perps/trade/orders"),
      ),
    ).toHaveLength(1);
  });

  it("does not paper-fill when the spot book has asks but too little depth", async () => {
    MOCK_ENV.ALLOW_PAPER_SPOT = true;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/spot/markets/symbols")) {
        return jsonResponse({ code: 0, data: SPOT_SYMBOLS });
      }
      if (url.includes("/spot/markets/vMAG7ssi_vUSDC/orderbook")) {
        return jsonResponse({
          code: 0,
          data: { asks: [["0.45", "1"]] },
        });
      }

      throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await placeOrders(
      [
        { symbol: "btc", side: "SHORT", sizeUsd: 10 },
        { symbol: "ssimag7", side: "LONG", sizeUsd: 10 },
      ],
      false,
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe(
      "sodex_insufficient_spot_liquidity:vMAG7ssi_vUSDC:0.45",
    );
    expect(
      fetchMock.mock.calls.some(([input]) =>
        String(input).includes("/trade/orders"),
      ),
    ).toBe(false);
  });

  it("rejects an unknown ticker before submitting an order", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/perps/markets/symbols")) {
        return jsonResponse({ code: 0, data: PERPS_SYMBOLS });
      }

      throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await placeOrders(
      [{ symbol: "unknown", side: "SHORT", sizeUsd: 10 }],
      false,
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe("sodex_symbol_not_found:perps:unknown");
    expect(
      fetchMock.mock.calls.some(([input]) =>
        String(input).endsWith("/perps/trade/orders"),
      ),
    ).toBe(false);
  });
});
