import { randomUUID } from "node:crypto";

import { concatHex, keccak256, toHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { getEnv } from "../env";

export interface OrderLeg {
  symbol: string;
  side: "LONG" | "SHORT";
  sizeUsd: number;
}

export interface ExecutionResult {
  success: boolean;
  orderId?: string;
  legs: Array<{
    symbol: string;
    orderId: string;
    status: string;
  }>;
  error?: string;
}

type Market = "spot" | "perps";

interface SignedOrder {
  market: Market;
  action: "batchNewOrder" | "newOrder";
  params: Record<string, unknown>;
}

interface LegResponse {
  orderId?: string;
  error?: string;
}

const MOCK_DELAY_MS = 500;
const REQUEST_TIMEOUT_MS = 10_000;
const TESTNET_CHAIN_ID = 138565;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const SIDE_BUY = 1;
const SIDE_SELL = 2;
const TYPE_MARKET = 2;
const TIME_IN_FORCE_IOC = 3;
const ORDER_MODIFIER_NORMAL = 1;
const POSITION_SIDE_BOTH = 1;

let lastNonce = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function nextNonce(): bigint {
  const now = Date.now();
  lastNonce = Math.max(now, lastNonce + 1);
  return BigInt(lastNonce);
}

function truncate(value: string, maxLength = 300): string {
  return value.length > maxLength
    ? `${value.slice(0, maxLength)}...`
    : value;
}

function sideCode(leg: OrderLeg): number {
  return leg.side === "LONG" ? SIDE_BUY : SIDE_SELL;
}

function apiBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, "");
  return trimmed.endsWith("/api/v1") ? trimmed : `${trimmed}/api/v1`;
}

function endpointFor(baseUrl: string, market: Market): string {
  const suffix =
    market === "spot" ? "/spot/trade/orders/batch" : "/perps/trade/orders";
  return `${apiBaseUrl(baseUrl)}${suffix}`;
}

function parsePositiveInteger(value: string, field: string): number {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${field} must be a positive integer`);
  }

  return parsed;
}

function buildSignedOrder(
  leg: OrderLeg,
  accountId: number,
  symbolId: number,
  clientOrderId: string,
): SignedOrder {
  const side = sideCode(leg);

  if (leg.side === "LONG") {
    return {
      market: "spot",
      action: "batchNewOrder",
      params: {
        accountID: accountId,
        orders: [
          {
            symbolID: symbolId,
            clOrdID: clientOrderId,
            side,
            type: TYPE_MARKET,
            timeInForce: TIME_IN_FORCE_IOC,
            funds: leg.sizeUsd.toString(),
          },
        ],
      },
    };
  }

  return {
    market: "perps",
    action: "newOrder",
    params: {
      accountID: accountId,
      symbolID: symbolId,
      orders: [
        {
          clOrdID: clientOrderId,
          modifier: ORDER_MODIFIER_NORMAL,
          side,
          type: TYPE_MARKET,
          timeInForce: TIME_IN_FORCE_IOC,
          funds: leg.sizeUsd.toString(),
          reduceOnly: false,
          positionSide: POSITION_SIDE_BOTH,
        },
      ],
    },
  };
}

async function signOrder(
  order: SignedOrder,
  privateKey: string,
  nonce: bigint,
): Promise<string> {
  const account = privateKeyToAccount(privateKey as `0x${string}`);
  const payloadHash = keccak256(
    toHex(
      JSON.stringify({
        type: order.action,
        params: order.params,
      }),
    ),
  );

  const signature = await account.signTypedData({
    domain: {
      name: order.market === "spot" ? "spot" : "futures",
      version: "1",
      chainId: TESTNET_CHAIN_ID,
      verifyingContract: ZERO_ADDRESS,
    },
    types: {
      ExchangeAction: [
        { name: "payloadHash", type: "bytes32" },
        { name: "nonce", type: "uint64" },
      ],
    } as const,
    primaryType: "ExchangeAction",
    message: {
      payloadHash,
      nonce,
    },
  });

  return concatHex(["0x01", signature]);
}

function extractErrorMessage(value: unknown): string {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return extractErrorMessage(
      record.message ?? record.msg ?? record.error ?? record.detail,
    );
  }

  return "";
}

function parseOrderResponse(
  body: string,
  clientOrderId: string,
): LegResponse {
  let envelope: unknown;

  try {
    envelope = JSON.parse(body);
  } catch {
    return { error: "sodex_invalid_json_response" };
  }

  if (!envelope || typeof envelope !== "object") {
    return { error: "sodex_unexpected_response" };
  }

  const record = envelope as Record<string, unknown>;
  const code = record.code;

  if (typeof code === "number" && code !== 0) {
    const message = extractErrorMessage(
      record.error ?? record.message ?? record.msg ?? record.details,
    );
    return {
      error: `sodex_error_${code}${message ? `: ${message}` : ""}`,
    };
  }

  const data = record.data;
  const rows = Array.isArray(data) ? data : data ? [data] : [];

  if (rows.length === 0) {
    return { error: "sodex_empty_order_response" };
  }

  const first = rows[0];

  if (!first || typeof first !== "object") {
    return { error: "sodex_unexpected_order_response" };
  }

  const order = first as Record<string, unknown>;
  const orderCode = order.code;

  if (typeof orderCode === "number" && orderCode !== 0) {
    const message = extractErrorMessage(order.error ?? order.message);
    return {
      error: `sodex_order_error_${orderCode}${message ? `: ${message}` : ""}`,
    };
  }

  const orderId = order.orderID ?? order.orderId ?? order.id;
  const responseClientOrderId = order.clOrdID;

  return {
    orderId:
      orderId !== undefined && orderId !== null
        ? String(orderId)
        : typeof responseClientOrderId === "string"
          ? responseClientOrderId
          : clientOrderId,
  };
}

async function postSignedOrder(
  order: SignedOrder,
  signature: string,
  nonce: bigint,
  apiKeyName: string,
  baseUrl: string,
  batchClientOrderId: string,
): Promise<LegResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(endpointFor(baseUrl, order.market), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-API-Key": apiKeyName,
        "X-API-Sign": signature,
        "X-API-Nonce": nonce.toString(),
        "X-API-Chain": String(TESTNET_CHAIN_ID),
        "X-Client-Order-ID": batchClientOrderId,
      },
      body: JSON.stringify(order.params),
      signal: controller.signal,
    });

    const body = await response.text();

    if (!response.ok) {
      const rawMessage = truncate(body);
      let message = rawMessage;

      try {
        const envelope: unknown = JSON.parse(body);

        if (envelope && typeof envelope === "object") {
          const record = envelope as Record<string, unknown>;
          message =
            extractErrorMessage(
              record.error ??
                record.message ??
                record.msg ??
                record.details,
            ) || rawMessage;
        }
      } catch {
        message = rawMessage;
      }

      return {
        error: `sodex_http_${response.status}${message ? `: ${message}` : ""}`,
      };
    }

    return parseOrderResponse(body, batchClientOrderId);
  } catch (error) {
    if (controller.signal.aborted) {
      return {
        error: `sodex_timeout_after_${REQUEST_TIMEOUT_MS}ms`,
      };
    }

    return {
      error: `sodex_request_failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function placeMockOrders(legs: OrderLeg[]): Promise<ExecutionResult> {
  await sleep(MOCK_DELAY_MS);

  return {
    success: true,
    legs: legs.map((leg) => ({
      symbol: leg.symbol,
      orderId: randomUUID(),
      status: "filled",
    })),
  };
}

export async function placeOrders(
  legs: OrderLeg[],
  mock: boolean,
): Promise<ExecutionResult> {
  if (mock) {
    return placeMockOrders(legs);
  }

  if (legs.length === 0) {
    return {
      success: false,
      error: "no_order_legs",
      legs: [],
    };
  }

  const batchClientOrderId = randomUUID();
  const results: ExecutionResult["legs"] = [];
  let env: ReturnType<typeof getEnv>;
  let accountId: number;

  try {
    env = getEnv();
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      legs: legs.map((leg) => ({
        symbol: leg.symbol,
        orderId: batchClientOrderId,
        status: "rejected",
      })),
    };
  }

  try {
    accountId = parsePositiveInteger(env.SODEX_ACCOUNT_ID, "SODEX_ACCOUNT_ID");
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      legs: legs.map((leg) => ({
        symbol: leg.symbol,
        orderId: batchClientOrderId,
        status: "rejected",
      })),
    };
  }

  for (const [index, leg] of legs.entries()) {
    let symbolId: number;

    if (!Number.isFinite(leg.sizeUsd) || leg.sizeUsd <= 0) {
      return {
        success: false,
        error: "OrderLeg.sizeUsd must be a positive finite number",
        legs: [
          ...results,
          {
            symbol: leg.symbol,
            orderId: batchClientOrderId,
            status: "rejected",
          },
        ],
      };
    }

    try {
      symbolId = parsePositiveInteger(leg.symbol, "OrderLeg.symbol");
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        legs: [
          ...results,
          {
            symbol: leg.symbol,
            orderId: batchClientOrderId,
            status: "rejected",
          },
        ],
      };
    }

    const clientOrderId = `${batchClientOrderId
      .replace(/-/g, "")
      .slice(0, 28)}${String(index).padStart(2, "0")}`;
    const order = buildSignedOrder(leg, accountId, symbolId, clientOrderId);
    const nonce = nextNonce();
    let signature: string;

    try {
      signature = await signOrder(order, env.SODEX_PRIVATE_KEY, nonce);
    } catch (error) {
      return {
        success: false,
        error: `sodex_signing_failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
        legs: [
          ...results,
          {
            symbol: leg.symbol,
            orderId: clientOrderId,
            status: "rejected",
          },
        ],
      };
    }

    const response = await postSignedOrder(
      order,
      signature,
      nonce,
      env.SODEX_API_KEY_NAME,
      env.SODEX_BASE_URL,
      batchClientOrderId,
    );

    if (response.error) {
      return {
        success: false,
        error: response.error,
        legs: [
          ...results,
          {
            symbol: leg.symbol,
            orderId: clientOrderId,
            status: "rejected",
          },
        ],
      };
    }

    results.push({
      symbol: leg.symbol,
      orderId: response.orderId ?? clientOrderId,
      status: "submitted",
    });
  }

  return {
    success: true,
    orderId: batchClientOrderId,
    legs: results,
  };
}
