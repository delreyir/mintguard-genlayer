import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import type { GenLayerClient } from "genlayer-js/types";

export const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ||
  "0x4fCBCbF376EBD5b56041A827497773817B5ba32d") as `0x${string}`;

// Network configuration — uses studionet chain definition from SDK,
// but connect() switches the wallet to the correct network.
// For testnet-bradbury deployment, update NETWORK_NAME to "testnetBradbury"
const CHAIN = studionet;
const NETWORK_NAME = "studionet";

declare global {
  interface Window { ethereum?: any; }
}

export type WalletState = { address: `0x${string}` | null; client: GenLayerClient<any> | null; };

export function hasWallet(): boolean {
  return typeof window !== "undefined" && !!window.ethereum;
}

/**
 * Connects a browser wallet (MetaMask, Rabby, etc.) to GenLayer.
 * Uses the official SDK pattern: createClient + client.connect() for network switching.
 */
export async function connectWallet(): Promise<WalletState> {
  if (!hasWallet()) throw new Error("No wallet found. Install MetaMask, Rabby, or another EVM wallet.");

  // Request accounts from wallet
  const accounts: string[] = await window.ethereum.request({ method: "eth_requestAccounts" });
  if (!accounts?.length) throw new Error("No accounts authorized");
  const address = accounts[0] as `0x${string}`;

  // Create client with the wallet's address and provider
  const client = createClient({
    chain: CHAIN,
    account: address,
    provider: window.ethereum,
  } as any);

  // Switch wallet to the correct GenLayer network using SDK method
  await client.connect(NETWORK_NAME);

  return { address, client };
}

/**
 * Creates a read-only client for querying contract state.
 */
export function readClient(): GenLayerClient<any> {
  return createClient({ chain: CHAIN }) as GenLayerClient<any>;
}

export function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}
