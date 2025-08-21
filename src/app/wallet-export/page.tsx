'use client';

import { useState, useEffect } from 'react';
import { useActiveAccount, useConnect } from 'thirdweb/react';
import { wallet } from '@/config/wallet';
import { ConnectButton } from 'thirdweb/react';
import { thirdwebClient } from '@/config/thirdweb-client'

export default function WalletExportPage() {
  const activeAccount = useActiveAccount();
  const { connect } = useConnect();
  const [walletReconnectAttempted, setWalletReconnectAttempted] = useState(false);
  const [isWalletConnecting, setIsWalletConnecting] = useState(false);

  // Auto-reconnect wallet on page load
  useEffect(() => {
    const attemptWalletReconnect = async () => {
      if (walletReconnectAttempted) return;

      try {
        setIsWalletConnecting(true);
        console.log("Attempting wallet auto-reconnect...");
        await wallet.autoConnect({ client: thirdwebClient });

        if (wallet.getAccount()) {
          await connect(async () => wallet);
          console.log("Wallet reconnected successfully");
        }
      } catch (error) {
        console.log("Wallet auto-reconnect failed:", error);
      } finally {
        setIsWalletConnecting(false);
        setWalletReconnectAttempted(true);
      }
    };

    attemptWalletReconnect();
  }, [connect, walletReconnectAttempted]);

  const handleManualConnect = async () => {
    try {
      setIsWalletConnecting(true);
      await connect(async () => wallet);
    } catch (error) {
      console.error("Manual connection failed:", error);
    } finally {
      setIsWalletConnecting(false);
    }
  };

  if (isWalletConnecting) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Connecting wallet...</p>
        </div>
      </div>
    );
  }

  if (!activeAccount) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">Wallet Export</h1>
          <p className="text-gray-600">Please connect your wallet to export your private key.</p>
          <div className="space-y-2">
            <ConnectButton client={thirdwebClient} />
            <button
              onClick={handleManualConnect}
              className="block w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Connect Wallet
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Export Private Key</h1>
          <p className="text-sm text-gray-600 mb-4">
            Connected: {activeAccount.address}
          </p>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">
                Private Key Export Instructions
              </h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>To export your private key:</p>
                <ol className="list-decimal list-inside mt-2 space-y-1">
                  <li>Click the wallet button in the top navigation</li>
                  <li>Select "Manage Wallet"</li>
                  <li>Choose "Export Private Key"</li>
                  <li>Confirm the action to reveal your private key</li>
                  <li>Copy and securely store your private key</li>
                </ol>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Security Warning
              </h3>
              <div className="mt-2 text-sm text-red-700">
                <p>Revealing private keys can compromise your assets and security. Keep them safe and confidential at all times.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="text-center">
          <ConnectButton client={thirdwebClient} />
        </div>
      </div>
    </div>
  );
}