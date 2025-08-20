import { defineChain } from "thirdweb";

// Avalanche Fuji Testnet
export const avalancheFuji = defineChain({
    id: 43113,
    name: "Avalanche Fuji Testnet",
    nativeCurrency: {
        name: "AVAX",
        symbol: "AVAX",
        decimals: 18,
    },
    rpc: "https://api.avax-test.network/ext/bc/C/rpc",
    blockExplorers: [
        {
            name: "SnowTrace",
            url: "https://testnet.snowtrace.io",
        },
    ],
    testnet: true,
});

export const avalancheFork = defineChain({
    id: 43114,
    name: "Avalanche Fork (GCP)",
    nativeCurrency: {
        name: "AVAX",
        symbol: "AVAX",
        decimals: 18,
    },
    rpc: "http://localhost:3000/api/rpc",
    blockExplorers: [
        {
            name: "Fork Explorer",
            url: "http://34.170.7.126:8545",
        },
    ],
    testnet: true,
});

// Avalanche C-Chain Mainnet
export const avalancheMainnet = defineChain({
    id: 43114,
    name: "Avalanche C-Chain",
    nativeCurrency: {
        name: "AVAX",
        symbol: "AVAX",
        decimals: 18,
    },
    rpcUrls: {
        default: {
            http: ["https://api.avax.network/ext/bc/C/rpc"],
        },
    },
    blockExplorers: {
        default: {
            name: "SnowTrace",
            url: "https://snowtrace.io",
        },
    },
    testnet: false,
});