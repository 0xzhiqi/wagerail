"use client";

import { SessionProvider } from "next-auth/react";
import { ThirdwebProvider } from "thirdweb/react";
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createConfig, http } from 'wagmi';
import { avalancheFork } from '@/config/chains';
import { useState } from 'react';
import type { Chain } from 'wagmi/chains';

// Convert Thirdweb chain definition to Wagmi format
const wagmiAvalancheFork: Chain = {
  id: avalancheFork.id,
  name: avalancheFork.name || 'Avalanche Fork',
  nativeCurrency: {
    name: avalancheFork.nativeCurrency?.name || 'AVAX',
    symbol: avalancheFork.nativeCurrency?.symbol || 'AVAX',
    decimals: avalancheFork.nativeCurrency?.decimals || 18,
  },
  rpcUrls: {
    default: {
      http: [avalancheFork.rpc],
    },
    public: {
      http: [avalancheFork.rpc],
    },
  },
  blockExplorers: avalancheFork.blockExplorers && avalancheFork.blockExplorers.length > 0 ? {
    default: {
      name: avalancheFork.blockExplorers[0].name,
      url: avalancheFork.blockExplorers[0].url,
    },
  } : undefined,
  testnet: avalancheFork.testnet,
};

// Create Wagmi config using your avalancheFork chain
const wagmiConfig = createConfig({
  chains: [wagmiAvalancheFork],
  transports: {
    [wagmiAvalancheFork.id]: http(avalancheFork.rpc),
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  // Create a new QueryClient instance for each session to avoid hydration issues
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000, // 1 minute
      },
    },
  }));

  return (
    <SessionProvider>
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <ThirdwebProvider>
            {children}
          </ThirdwebProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </SessionProvider>
  );
}