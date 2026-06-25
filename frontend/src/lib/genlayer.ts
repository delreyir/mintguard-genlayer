import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import type { GenLayerClient } from "genlayer-js/types";

export const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ||
  "0x4fCBCbF376EBD5b56041A827497773817B5ba32d") as `0x${string}`;

const CHAIN = studionet;

// GenLayer Studionet network params for manual wallet_addEthereumChain
const GENLAYER_NETWORK = {
  chainId: "0xF22F", // 61999
  chainName: "GenLayer Studionet",
  nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
  rpcUrls: ["https://studio.genlayer.com/api"],
  blockExplorerUrls: ["https://genlayer-explorer.vercel.app"],
};

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
 * Connects any EVM wallet (MetaMask, Rabby, etc.) WITHOUT installing a Snap.
 * Switches the wallet to GenLayer network using standard EVM RPC methods.
 */
export async function connectWallet(): Promise<WalletState> {
  if (!hasWallet()) throw new Error("No wallet found. Install MetaMask, Rabby, or another EVM wallet.");

  // 1. Request accounts
  const accounts: string[] = await window.ethereum.request({ method: "eth_requestAccounts" });
  if (!accounts?.length) throw new Error("No accounts authorized");
  const address = accounts[0] as `0x${string}`;

  // 2. Switch to GenLayer network (or add it if not present) — NO SNAP
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: GENLAYER_NETWORK.chainId }],
    });
  } catch (switchError: any) {
    // Chain not added yet — add it
    if (switchError?.code === 4902 || /unrecognized chain/i.test(switchError?.message || "")) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [GENLAYER_NETWORK],
      });
    } else if (switchError?.code === 4001) {
      throw new Error("User rejected network switch");
    }
    // Other errors: ignore silently, signing will still work
  }

  // 3. Create GenLayer client — NO client.connect() call (that triggers Snap)
  const client = createClient({
    chain: CHAIN,
    account: address,
    provider: window.ethereum,
  } as any);

  return { address, client };
}

/**
 * Disconnects the wallet by clearing local state.
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
