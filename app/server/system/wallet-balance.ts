import { createPublicClient, formatUnits, http, isAddress, type Address, type Chain } from "viem";
import { base, bsc, mainnet } from "viem/chains";

type ChainKey = "eth" | "bsc" | "base";

type ChainConfig = {
  key: ChainKey;
  label: string;
  chain: Chain;
  nativeSymbol: string;
  usdtAddress: Address;
};

export type ChainBalance = {
  key: ChainKey;
  label: string;
  nativeSymbol: string;
  nativeBalance: string;
  usdtBalance: string;
  nativeError: string;
  usdtError: string;
};

export type WalletBalances = {
  address: string;
  chains: Record<ChainKey, ChainBalance>;
  updatedAt: string;
};

const USDT_ABI = [
  {
    type: "function",
    stateMutability: "view",
    name: "balanceOf",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "decimals",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
] as const;

const CHAIN_CONFIGS: ChainConfig[] = [
  {
    key: "eth",
    label: "ETH 主网",
    chain: mainnet,
    nativeSymbol: "ETH",
    usdtAddress: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  },
  {
    key: "bsc",
    label: "BSC",
    chain: bsc,
    nativeSymbol: "BNB",
    usdtAddress: "0x55d398326f99059fF775485246999027B3197955",
  },
  {
    key: "base",
    label: "Base",
    chain: base,
    nativeSymbol: "ETH",
    usdtAddress: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2",
  },
];

function formatAmount(value: bigint, decimals: number): string {
  const text = formatUnits(value, decimals);
  if (!text.includes(".")) {
    return text;
  }
  const cleaned = text.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
  return cleaned || "0";
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

async function readSingleChainBalance(config: ChainConfig, address: Address): Promise<ChainBalance> {
  const client = createPublicClient({
    chain: config.chain,
    transport: http(),
  });

  let nativeBalance = "-";
  let usdtBalance = "-";
  let nativeError = "";
  let usdtError = "";

  try {
    const value = await client.getBalance({ address });
    nativeBalance = formatAmount(value, 18);
  } catch (error) {
    nativeError = toErrorMessage(error);
  }

  try {
    const [value, decimals] = await Promise.all([
      client.readContract({
        address: config.usdtAddress,
        abi: USDT_ABI,
        functionName: "balanceOf",
        args: [address],
      }),
      client.readContract({
        address: config.usdtAddress,
        abi: USDT_ABI,
        functionName: "decimals",
      }),
    ]);
    usdtBalance = formatAmount(value, Number(decimals));
  } catch (error) {
    usdtError = toErrorMessage(error);
  }

  return {
    key: config.key,
    label: config.label,
    nativeSymbol: config.nativeSymbol,
    nativeBalance,
    usdtBalance,
    nativeError,
    usdtError,
  };
}

export async function readWalletBalances(rawAddress: string): Promise<WalletBalances> {
  const address = rawAddress.trim();
  if (!isAddress(address)) {
    throw new Error("钱包地址格式不合法。请先重新生成钱包。");
  }

  const values = await Promise.all(CHAIN_CONFIGS.map((config) => readSingleChainBalance(config, address)));
  const chains = values.reduce((acc, item) => {
    acc[item.key] = item;
    return acc;
  }, {} as Record<ChainKey, ChainBalance>);

  return {
    address,
    chains,
    updatedAt: new Date().toISOString(),
  };
}
