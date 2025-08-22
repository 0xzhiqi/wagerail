"use client";

import { useState, useEffect } from "react";
import { useActiveAccount, useConnect, useDisconnect, useActiveWallet } from "thirdweb/react";
import { preAuthenticate } from "thirdweb/wallets/in-app";
import { useSession, signIn, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { avalancheFork } from "@/config/chains";
import { wallet } from "@/config/wallet";
import { thirdwebClient } from "@/config/thirdweb-client";

interface LoginDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LoginDialog({ open, onOpenChange }: LoginDialogProps) {
  const [email, setEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const activeAccount = useActiveAccount();
  const activeWallet = useActiveWallet();
  const { data: session } = useSession();
  const router = useRouter();

  const fundSmartAccount = async (address: string) => {
    try {
      console.log('Funding smart account with AVAX:', address);
      
      const response = await fetch('/api/fund-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }),
      });
      
      const result = await response.json();
      if (result.success) {
        console.log('Smart account funded with 10 AVAX for gas fees');
      } else {
        console.error('Failed to fund account:', result.error);
      }
    } catch (error) {
      console.error('Failed to fund account:', error);
    }
  };

  // Auto-reconnect on mount if wallet has stored session
  useEffect(() => {
    const autoReconnect = async () => {
      try {
        // Try to auto-connect the wallet (this checks for stored sessions)
        await wallet.autoConnect({ client: thirdwebClient });

        // If autoConnect succeeded, connect it to the provider
        if (wallet.getAccount()) {
          await connect(async () => wallet);
        }
      } catch (error) {
        console.log("No stored session to restore");
      } finally {
        setIsInitializing(false);
      }
    };

    if (open) {
      autoReconnect();
    }
  }, [connect, open]);

  const sendOtp = async () => {
    if (!email) return;

    setIsLoading(true);
    try {
      await preAuthenticate({
        client: thirdwebClient,
        strategy: "email",
        email,
      });
      setIsOtpSent(true);
    } catch (error) {
      console.error("Failed to send OTP:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Add handler for Enter key press on email input
  const handleEmailKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isOtpSent && email && !isLoading) {
      e.preventDefault();
      sendOtp();
    }
  };

  // Add handler for Enter key press on verification code input
  const handleCodeKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && isOtpSent && verificationCode && !isLoading) {
      e.preventDefault();
      handleLogin();
    }
  };

  const handleLogin = async () => {
    if (!email || !verificationCode) return;

    setIsLoading(true);
    try {
      // First connect the wallet
      await connect(async () => {
        await wallet.connect({
          client: thirdwebClient,
          strategy: "email",
          email,
          verificationCode,
          chain: avalancheFork
        });
        return wallet;
      });

      // Wait a moment for the wallet to be fully connected
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Get the wallet address
      const account = wallet.getAccount();
      if (account) {
        // Fund the smart account with AVAX for gas
        await fundSmartAccount(account.address);
        
        // Sign in using NextAuth
        const result = await signIn("wallet", {
          email,
          walletAddress: account.address,
          redirect: false,
        });

        if (result?.ok) {
          console.log('User authenticated successfully');
          onOpenChange(false); // Close dialog
          router.push('/dashboard');
        } else {
          console.error('Failed to create session:', result?.error);
        }
      }
    } catch (error) {
      console.error("Failed to login:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    disconnect(activeWallet!);
    onOpenChange(false);
  };

  if (isInitializing) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md bg-gradient-to-br from-slate-50 to-purple-50 border-purple-100 shadow-2xl" hideCloseButton>
          <DialogHeader className="text-center space-y-3">
            <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-purple-700 bg-clip-text text-transparent">
              Connecting...
            </DialogTitle>
            <DialogDescription className="text-gray-600">
              Checking connection status...
            </DialogDescription>
          </DialogHeader>
          <div className="text-center py-6">
            <div className="w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Please wait...</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (activeAccount && session) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md bg-gradient-to-br from-slate-50 to-purple-50 border-purple-100 shadow-2xl" hideCloseButton>
          <DialogHeader className="text-center space-y-3">
            <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-purple-700 bg-clip-text text-transparent">
              Welcome Back!
            </DialogTitle>
            <DialogDescription className="text-gray-600">
              You're already connected and authenticated.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border border-emerald-100">
                <p className="font-semibold text-emerald-900 mb-2 flex items-center">
                  <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Session Active
                </p>
                <p className="text-sm text-emerald-700">Email: {session.user?.email}</p>
                <p className="text-sm text-emerald-700">User ID: {session.user?.id}</p>
              </div>
              <div className="p-4 bg-gradient-to-r from-purple-50 to-violet-50 rounded-xl border border-purple-100">
                <p className="font-semibold text-purple-900 mb-2 flex items-center">
                  <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4zM18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" />
                  </svg>
                  Your Wallet
                </p>
                <p className="text-sm text-purple-700 break-all font-mono">{activeAccount.address}</p>
                <p className="text-xs text-purple-600 mt-1">Use this address to receive crypto</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={() => {
                  onOpenChange(false);
                  router.push('/dashboard');
                }}
                className="flex-1 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-semibold rounded-full shadow-lg hover:shadow-xl transition-all duration-300"
              >
                Go to Dashboard
              </Button>
              <Button
                onClick={handleSignOut}
                variant="outline"
                className="flex-1 border-purple-200 text-purple-600 hover:bg-purple-50 hover:text-purple-700 font-semibold rounded-full shadow-lg hover:shadow-xl transition-all duration-300"
              >
                Sign Out
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-gradient-to-br from-slate-50 to-purple-50 shadow-2xl" hideCloseButton>
        <DialogHeader className="text-center space-y-3">
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-purple-700 bg-clip-text text-transparent">
            Welcome to WageRail
          </DialogTitle>
          <DialogDescription className="text-gray-600 leading-relaxed">
            Sign in with your email to get started with global payments.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6">
          <div className="space-y-3">
            <label htmlFor="email" className="text-sm font-semibold text-gray-700">
              Email Address
            </label>
            <Input
              id="email"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyPress={handleEmailKeyPress}
              disabled={isLoading}
              className="border-purple-200 focus:border-purple-400 focus:ring-purple-400 rounded-xl px-4 py-3 bg-white/80 backdrop-blur-sm"
            />
          </div>

          {!isOtpSent ? (
            <Button
              onClick={sendOtp}
              disabled={!email || isLoading}
              className="w-full bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-semibold py-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-300"
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Sending...
                </div>
              ) : (
                "Send Verification Code"
              )}
            </Button>
          ) : (
            <div className="space-y-6">
              <div className="space-y-3">
                <label htmlFor="code" className="text-sm font-semibold text-gray-700">
                  Verification Code
                </label>
                <Input
                  id="code"
                  type="text"
                  placeholder="Enter verification code"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  onKeyPress={handleCodeKeyPress}
                  disabled={isLoading}
                  className="border-purple-200 focus:border-purple-400 focus:ring-purple-400 rounded-xl px-4 py-3 bg-white/80 backdrop-blur-sm text-center text-sm tracking-widest"
                />
              </div>
              <Button
                onClick={handleLogin}
                disabled={!verificationCode || isLoading}
                className="w-full bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-semibold py-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-300"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Connecting...
                  </div>
                ) : (
                  "Submit OTP"
                )}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}