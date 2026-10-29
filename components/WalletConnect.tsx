"use client";

import { shortenAddress } from "@/lib/wallet";

import { Badge, cx } from "./mockup/primitives";
import type { OperatorWallet } from "./useOperatorWallet";

function InlineSpinner({ className }: { className?: string }) {
  return (
    <span
      className={cx(
        "inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent",
        className,
      )}
      aria-hidden="true"
    />
  );
}

export function WalletConnect({ wallet }: { wallet: OperatorWallet }) {
  if (!wallet.isConnected) {
    return (
      <div className="flex max-w-[280px] flex-col items-end gap-1">
        <button
          type="button"
          onClick={() => void wallet.connect()}
          disabled={wallet.isConnecting}
          className="flex h-8 items-center gap-2 bg-mockup-amber px-3 font-mockup text-[11px] font-semibold text-black shadow-mockup-glow transition hover:bg-mockup-amber-soft disabled:cursor-not-allowed disabled:opacity-60"
        >
          {wallet.isConnecting ? (
            <InlineSpinner className="text-black" />
          ) : null}
          {wallet.isConnecting ? "Connecting..." : "Connect Wallet"}
        </button>
        {wallet.error ? (
          <p
            role="alert"
            className="text-right font-mockup-mono text-[8px] uppercase leading-4 tracking-[0.1em] text-mockup-red"
          >
            {wallet.error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex max-w-[320px] flex-col items-end gap-1">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Badge tone={wallet.isAuthorized ? "green" : "red"}>
          {wallet.isAuthorized ? "Operator Connected" : "Unauthorized Wallet"}
        </Badge>
        {wallet.address ? (
          <span
            title={wallet.address}
            className="font-mockup-mono text-[9px] uppercase tracking-[0.08em] text-mockup-muted"
          >
            {shortenAddress(wallet.address)}
          </span>
        ) : null}
        <button
          type="button"
          onClick={wallet.disconnect}
          className="font-mockup-mono text-[8px] uppercase tracking-[0.14em] text-mockup-dim transition hover:text-mockup-text"
        >
          Disconnect
        </button>
      </div>
      {wallet.isAuthorized ? null : (
        <p className="text-right font-mockup-mono text-[8px] uppercase leading-4 tracking-[0.1em] text-mockup-red/80">
          Connect the operator wallet to unlock pipeline runs.
        </p>
      )}
    </div>
  );
}
