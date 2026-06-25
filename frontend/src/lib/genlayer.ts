import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import type { GenLayerClient } from "genlayer-js/types";

export const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ||
  "0x4fCBCbF376EBD5b56041A827497773817B5ba32d") as `0x${string}`;

const CHAIN = studionet;
const NETWORK_NAME = "studionet";

declare global {
  interface Window { ethereum?: any; }
}

export type WalletState = {
  address: `0x${string}` | null;
  client: GenLayerClient<any> | null;
};

export function hasWallet(): boolean {
  return typeof window !== "undefined" && !!window.ethereum;
}

/**
 * Connects a browser wallet (MetaMask, Rabby, etc.) to GenLayer.
 */
export async function connectWallet(): Promise<WalletState> {
  if (!hasWallet()) throw new Error("No wallet found. Install MetaMask, Rabby, or another EVM wallet.");

  const accounts: string[] = await window.ethereum.request({ method: "eth_requestAccounts" });
  if (!accounts?.length) throw new Error("No accounts authorized");
  const address = accounts[0] as `0x${string}`;

  const client = createClient({
    chain: CHAIN,
    account: address,
    provider: window.ethereum,
  } as any);

  await client.connect(NETWORK_NAME);

  return { address, client };
}

/**
 * Disconnects the wallet by clearing local state.
 * Note: Full disconnect requires user action in their wallet extension.
 */
export function disconnectWallet(): WalletState {
  return { address: null, client: null };
}

/**
 * Creates a read-only client for querying contract state.
 */
export function readClient(): GenLayerClient<any> {
  return createClient({ chain: CHAIN }) as GenLayerClient<any>;
}

export function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
