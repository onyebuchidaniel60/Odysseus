import { createConfig, http } from "wagmi";
import { mainnet } from "wagmi/chains";
import { injected } from "wagmi/connectors/injected";

/**
 * Wallet connection is only used to read the connected address and compare it
 * with the configured operator wallet. No chain reads or transactions are
 * performed, so mainnet is used as a neutral default chain.
 */
export const wagmiConfig = createConfig({
  chains: [mainnet],
  connectors: [injected()],
  transports: {
    [mainnet.id]: http(),
  },
  ssr: true,
});
