import { concatHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

async function main() {
  const accountID = Number(process.env.ACCOUNT_ID);
  const name = process.env.SODEX_API_KEY_NAME;
  const masterKey = process.env.SODEX_MASTER_PRIVATE_KEY;
  const apiKey = process.env.SODEX_API_KEY_PRIVATE_KEY;

  if (!Number.isSafeInteger(accountID) || accountID <= 0) {
    throw new Error("Set an exact account ID from account state");
  }
  if (!name || !/^[0-9a-zA-Z_-]{1,36}$/.test(name) || name === "default") {
    throw new Error("Set a valid, non-reserved API key name");
  }
  if (!masterKey || !apiKey) throw new Error("Set both local private keys");

  const master = privateKeyToAccount(masterKey as `0x${string}`);
  const tradingKey = privateKeyToAccount(apiKey as `0x${string}`);

  if (master.address === tradingKey.address) {
    throw new Error("Use a separate trading key");
  }

  const chainId = 138565;
  const nonce = BigInt(Date.now());
  const expiresAt = Number(nonce) + 24 * 60 * 60 * 1000;

  const signature = await master.signTypedData({
    domain: {
      name: "universal",
      version: "1",
      chainId,
      verifyingContract: "0x0000000000000000000000000000000000000000",
    },
    types: {
      UserSignedAddAPIKeyAction: [
        { name: "chainID", type: "uint64" },
        { name: "nonce", type: "uint64" },
        { name: "accountID", type: "uint64" },
        { name: "name", type: "string" },
        { name: "keyType", type: "uint8" },
        { name: "publicKey", type: "bytes" },
        { name: "expiresAt", type: "uint64" },
      ],
    },
    primaryType: "UserSignedAddAPIKeyAction",
    message: {
      chainID: BigInt(chainId),
      nonce,
      accountID: BigInt(accountID),
      name,
      keyType: 1,
      publicKey: tradingKey.address,
      expiresAt: BigInt(expiresAt),
    },
  });

  const recovery = Number.parseInt(signature.slice(-2), 16);
  const wireSignature = (signature.slice(0, -2) +
    (recovery >= 27 ? recovery - 27 : recovery)
      .toString(16)
      .padStart(2, "0")) as `0x${string}`;

  const response = await fetch(
    `https://testnet-gw.sodex.dev/api/v1/user/${master.address}/api-keys`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-API-Chain": String(chainId),
        "X-API-Nonce": nonce.toString(),
        "X-API-Sign": concatHex(["0x02", wireSignature]),
      },
      body: JSON.stringify({
        accountID,
        name,
        type: 1,
        publicKey: tradingKey.address,
        expiresAt,
      }),
    },
  );

  const rawBody = await response.text();
  let result: { code?: number; error?: string } = {};
  try {
    result = JSON.parse(rawBody) as typeof result;
  } catch {
    result = { error: rawBody };
  }

  if (!response.ok || result.code !== 0) {
    throw new Error(
      `Registration failed: HTTP ${response.status}: ${result.error ?? rawBody}`,
    );
  }

  console.log("Registration accepted; query API keys before placing an order.");
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
