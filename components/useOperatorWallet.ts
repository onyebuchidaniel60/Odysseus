"use client";

import { useCallback, useMemo, useState } from "react";
import {
  useAccount,
  useConnect,
  useConnectors,
  useDisconnect,
} from "wagmi";

import { isOperatorWallet } from "@/lib/wallet";

export interface OperatorWallet {
  address: string | undefined;
  isConnected: boolean;
  isAuthorized: boolean;
  isConnecting: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
}

function walletErrorMessage(error: unknown): string {
  const record =
    error && typeof error === "object"
      ? (error as { name?: unknown; message?: unknown })
      : null;
  const name =
    record && typeof record.name === "string" ? record.name : "";
  const message =
    record && typeof record.message === "string"
      ? record.message
      : error instanceof Error
        ? error.message
        : "";

  if (
    name === "ProviderNotFoundError" ||
    /provider not found|no provider|window\.ethereum/i.test(message)
  ) {
    return "No browser wallet detected. Install MetaMask, then reload.";
  }

  if (
    name === "UserRejectedRequestError" ||
    /user rejected|user denied|rejected the request/i.test(message)
  ) {
    return "Wallet connection was rejected.";
  }

  return "Could not connect wallet. Please try again.";
}

export function useOperatorWallet(): OperatorWallet {
  const { address, isConnected } = useAccount();
  const connectors = useConnectors();
  const { mutateAsync: connectAsync, isPending, error: connectError, reset } =
    useConnect();
  const { disconnect } = useDisconnect();
  const [localError, setLocalError] = useState<string | null>(null);

  const injectedConnector = useMemo(
    () =>
      connectors.find((connector) => connector.type === "injected") ??
      connectors[0],
    [connectors],
  );

  const connect = useCallback(async () => {
    setLocalError(null);
    reset();

    if (!injectedConnector) {
      setLocalError(
        "No browser wallet detected. Install MetaMask, then reload.",
      );
      return;
    }

    try {
      await connectAsync({ connector: injectedConnector });
    } catch (error) {
      setLocalError(walletErrorMessage(error));
    }
  }, [connectAsync, injectedConnector, reset]);

  const handleDisconnect = useCallback(() => {
    setLocalError(null);
    reset();
    disconnect();
  }, [disconnect, reset]);

  const error = localError
    ? localError
    : connectError
      ? walletErrorMessage(connectError)
      : null;

  return {
    address,
    isConnected,
    isAuthorized: isConnected && isOperatorWallet(address),
    isConnecting: isPending,
    error,
    connect,
    disconnect: handleDisconnect,
  };
}
