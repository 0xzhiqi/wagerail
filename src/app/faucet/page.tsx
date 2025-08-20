// src/app/faucet/page.tsx
"use client";

import { useState, useEffect } from 'react';
import { useActiveAccount, useConnect } from 'thirdweb/react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Coins, Banknote } from 'lucide-react';

interface FaucetResponse {
    success: boolean;
    message: string;
    txHash?: string;
    amount: number;
    currency: string;
    error?: string;
}

export default function FaucetPage() {
    const activeAccount = useActiveAccount();
    const { connect } = useConnect();
    const { data: session, status } = useSession();
    const router = useRouter();
    const [avaxAmount, setAvaxAmount] = useState(10);
    const [usdcAmount, setUsdcAmount] = useState(100);
    const [isLoadingAvax, setIsLoadingAvax] = useState(false);
    const [isLoadingUsdc, setIsLoadingUsdc] = useState(false);
    const [lastResponse, setLastResponse] = useState<FaucetResponse | null>(null);
    const [walletReconnectAttempted, setWalletReconnectAttempted] = useState(false);
    const [isInitializing, setIsInitializing] = useState(true);

    // Auto-reconnect wallet on page load
    useEffect(() => {
        const attemptWalletReconnect = async () => {
            if (walletReconnectAttempted) return;

            try {
                const { wallet } = await import("@/config/wallet");
                const { thirdwebClient } = await import("@/config/thirdweb-client");

                console.log("Attempting wallet auto-reconnect...");
                await wallet.autoConnect({ client: thirdwebClient });

                if (wallet.getAccount()) {
                    await connect(async () => wallet);
                    console.log("Wallet reconnected successfully");
                }
            } catch (error) {
                console.log("Wallet auto-reconnect failed:", error);
            } finally {
                setWalletReconnectAttempted(true);
            }
        };

        if (status !== "loading") {
            attemptWalletReconnect();
        }
    }, [status, connect, walletReconnectAttempted]);

    // Handle authentication and initialization
    useEffect(() => {
        if (status === "loading" || !walletReconnectAttempted) return;

        console.log("Faucet auth check:");
        console.log("- Session:", !!session, session?.user?.id);
        console.log("- Active account:", !!activeAccount, activeAccount?.address);

        if (!session) {
            console.log("No session - redirecting to home");
            router.push("/");
            return;
        }

        setIsInitializing(false);
    }, [session, activeAccount, status, router, walletReconnectAttempted]);

    const requestAvax = async () => {
        if (!activeAccount) {
            alert('Please connect your wallet first');
            return;
        }

        setIsLoadingAvax(true);
        try {
            const response = await fetch('/api/fund-account', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    address: activeAccount.address,
                    amount: avaxAmount
                }),
            });

            const result = await response.json();
            setLastResponse(result);

            if (result.success) {
                console.log('AVAX received:', result);
            }
        } catch (error) {
            console.error('Failed to request AVAX:', error);
            setLastResponse({
                success: false,
                message: 'Failed to request AVAX',
                amount: avaxAmount,
                currency: 'AVAX',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        } finally {
            setIsLoadingAvax(false);
        }
    };

    const requestUsdc = async () => {
        if (!activeAccount) {
            alert('Please connect your wallet first');
            return;
        }

        setIsLoadingUsdc(true);
        try {
            const response = await fetch('/api/faucet-usdc', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    address: activeAccount.address,
                    amount: usdcAmount
                }),
            });

            const result = await response.json();
            setLastResponse(result);

            if (result.success) {
                console.log('USDC received:', result);
            }
        } catch (error) {
            console.error('Failed to request USDC:', error);
            setLastResponse({
                success: false,
                message: 'Failed to request USDC',
                amount: usdcAmount,
                currency: 'USDC',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        } finally {
            setIsLoadingUsdc(false);
        }
    };

    if (isInitializing || status === "loading" || !walletReconnectAttempted) {
        return (
            <div className="container mx-auto px-4 py-8">
                <Card className="max-w-md mx-auto">
                    <CardHeader>
                        <CardTitle>Testnet Faucet</CardTitle>
                        {/* <CardDescription>Loading...</CardDescription> */}
                    </CardHeader>
                    <CardContent>
                        <div className="text-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
                            <p className="mt-2 text-gray-600">
                                {status === "loading" ? "Loading session..." :
                                    !walletReconnectAttempted ? "Reconnecting wallet..." :
                                        "Initializing..."}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (!session) {
        return (
            <div className="container mx-auto px-4 py-8">
                <Card className="max-w-md mx-auto">
                    <CardHeader>
                        <CardTitle>Testnet Faucet</CardTitle>
                        <CardDescription>Authentication required</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-center text-gray-600">
                            Please sign in to use the faucet
                        </p>
                        <Button
                            onClick={() => router.push('/')}
                            className="w-full mt-4"
                        >
                            Go to Sign In
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (!activeAccount) {
        return (
            <div className="container mx-auto px-4 py-8">
                <Card className="max-w-md mx-auto">
                    <CardHeader>
                        <CardTitle>Testnet Faucet</CardTitle>
                        <CardDescription>
                            Wallet connection required
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-center text-gray-600">
                            Your wallet needs to be reconnected to use the faucet
                        </p>
                        <Button
                            onClick={async () => {
                                try {
                                    const { wallet } = await import("@/config/wallet");
                                    await connect(async () => wallet);
                                } catch (error) {
                                    console.error("Manual reconnect failed:", error);
                                }
                            }}
                            className="w-full"
                        >
                            Reconnect Wallet
                        </Button>
                        <Button
                            onClick={() => router.push('/dashboard')}
                            variant="outline"
                            className="w-full"
                        >
                            Go to Dashboard
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="max-w-2xl mx-auto space-y-6">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold mb-2">Avalanche Fork Faucet</h1>
                    <p className="text-gray-600">
                        Get test AVAX and USDC for your connected wallet
                    </p>
                    <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                        <p className="text-sm text-blue-700">
                            <strong>Connected:</strong> {activeAccount.address}
                        </p>
                    </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                    {/* AVAX Faucet */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Coins className="h-5 w-5 text-red-500" />
                                AVAX Faucet
                            </CardTitle>
                            <CardDescription>
                                Get AVAX for gas fees and transactions
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <label htmlFor="avax-amount" className="block text-sm font-medium mb-2">
                                    Amount (AVAX)
                                </label>
                                <Input
                                    id="avax-amount"
                                    type="number"
                                    min="1"
                                    max="100"
                                    value={avaxAmount}
                                    onChange={(e) => setAvaxAmount(Number(e.target.value))}
                                    disabled={isLoadingAvax}
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Maximum: 100 AVAX per request
                                </p>
                            </div>
                            <Button
                                onClick={requestAvax}
                                disabled={isLoadingAvax || !activeAccount}
                                className="w-full"
                            >
                                {isLoadingAvax ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Sending AVAX...
                                    </>
                                ) : (
                                    `Get ${avaxAmount} AVAX`
                                )}
                            </Button>
                        </CardContent>
                    </Card>

                    {/* USDC Faucet */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Banknote className="h-5 w-5 text-green-500" />
                                USDC Faucet
                            </CardTitle>
                            <CardDescription>
                                Get USDC for Euler Finance interactions
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <label htmlFor="usdc-amount" className="block text-sm font-medium mb-2">
                                    Amount (USDC)
                                </label>
                                <Input
                                    id="usdc-amount"
                                    type="number"
                                    min="1"
                                    max="1000"
                                    value={usdcAmount}
                                    onChange={(e) => setUsdcAmount(Number(e.target.value))}
                                    disabled={isLoadingUsdc}
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Maximum: 1000 USDC per request
                                </p>
                            </div>
                            <Button
                                onClick={requestUsdc}
                                disabled={isLoadingUsdc || !activeAccount}
                                className="w-full"
                            >
                                {isLoadingUsdc ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Sending USDC...
                                    </>
                                ) : (
                                    `Get ${usdcAmount} USDC`
                                )}
                            </Button>
                        </CardContent>
                    </Card>
                </div>

                {/* Response Display */}
                {lastResponse && (
                    <Card className={lastResponse.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
                        <CardContent className="pt-6">
                            <div className="text-center">
                                <p className={`font-medium ${lastResponse.success ? 'text-green-800' : 'text-red-800'}`}>
                                    {lastResponse.message}
                                </p>
                                {lastResponse.txHash && (
                                    <p className="text-xs text-gray-600 mt-2 break-all">
                                        Transaction Hash: {lastResponse.txHash}
                                    </p>
                                )}
                                {lastResponse.error && (
                                    <p className="text-xs text-red-600 mt-2">
                                        Error: {lastResponse.error}
                                    </p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Info Card */}
                <Card className="bg-gray-50">
                    <CardContent className="pt-6">
                        <div className="text-sm text-gray-600 space-y-2">
                            <h3 className="font-medium text-gray-900">Faucet Information:</h3>
                            <ul className="space-y-1 ml-4">
                                <li>• AVAX is used for gas fees and transaction costs</li>
                                <li>• USDC can be deposited into Euler Finance vaults</li>
                                <li>• This is a testnet fork with fake funds</li>
                                <li>• Tokens have no real value</li>
                            </ul>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}