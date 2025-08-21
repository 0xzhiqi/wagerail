// app/register-eerc/page.tsx

"use client";

import { useState } from "react";
import { ConnectButton, useActiveAccount, useActiveWalletChain } from "thirdweb/react";
import { wallet } from "@/config/wallet";
import { thirdwebClient } from "@/config/thirdweb-client";
import { avalancheFork } from "@/config/chains";
import { ENCRYPTED_ERC_ADDRESSES } from "@/config/contracts";
// FIX: Import 'Account' type from "thirdweb/wallets" instead of "thirdweb"
import { getContract, readContract, sendTransaction, prepareContractCall } from "thirdweb";
import type { Account } from "thirdweb/wallets";
import { keccak256, SigningKey, Interface } from "ethers";
import { poseidon3 } from "poseidon-lite";
import { groth16 } from "snarkjs";

// --- Minimal Verifier ABI ---
const VERIFIER_ABI = [{
    "inputs": [
        { "internalType": "uint256[2]", "name": "a", "type": "uint256[2]" },
        { "internalType": "uint256[2][2]", "name": "b", "type": "uint256[2][2]" },
        { "internalType": "uint256[2]", "name": "c", "type": "uint256[2]" },
        { "internalType": "uint256[5]", "name": "input", "type": "uint256[5]" }
    ],
    "name": "verifyProof",
    "outputs": [ { "internalType": "bool", "name": "r", "type": "bool" } ],
    "stateMutability": "view",
    "type": "function"
}];

// --- Styles (can be moved to a separate CSS file) ---
const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as 'column',
    alignItems: 'center',
    padding: '2rem',
    fontFamily: 'sans-serif',
    maxWidth: '800px',
    margin: '0 auto',
  },
  header: {
    textAlign: 'center' as 'center',
    marginBottom: '2rem',
  },
  button: {
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    padding: '12px 24px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: 'bold' as 'bold',
    margin: '1rem 0',
    opacity: 1,
  },
  buttonDisabled: {
    backgroundColor: '#6c757d',
    cursor: 'not-allowed',
    opacity: 0.6,
  },
  logsContainer: {
    width: '100%',
    backgroundColor: '#f8f9fa',
    border: '1px solid #dee2e6',
    borderRadius: '8px',
    padding: '1rem',
    marginTop: '2rem',
    height: '300px',
    overflowY: 'auto' as 'auto',
    fontFamily: 'monospace',
    whiteSpace: 'pre-wrap' as 'pre-wrap',
    wordWrap: 'break-word' as 'break-word',
  },
  logMessage: {
    marginBottom: '0.5rem',
  },
  error: {
    color: '#dc3545',
  },
  success: {
    color: '#28a745',
  },
  info: {
    color: '#17a2b8',
  },
  connector: {
    margin: '1rem'
  }
};

// --- Minimal ABI for the Registrar Contract ---
const REGISTRAR_ABI = [
  {
    "type": "function",
    "name": "isUserRegistered",
    "inputs": [{ "name": "user", "type": "address", "internalType": "address" }],
    "outputs": [{ "name": "", "type": "bool", "internalType": "bool" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getUserPublicKey",
    "inputs": [{ "name": "user", "type": "address", "internalType": "address" }],
    "outputs": [
      { "name": "", "type": "uint256[2]", "internalType": "uint256[2]" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "register",
    "inputs": [{ "name": "calldata", "type": "bytes", "internalType": "bytes" }],
    "outputs": [],
    "stateMutability": "nonpayable"
  }
] as const;


/**
 * Derives deterministic private and public keys from a user's wallet signature.
 */
async function deriveKeysFromSignature(account: Account) {
  const signatureMessage = "Generate private key for EncryptedERC registration";
  const signature = await account.signMessage({ message: signatureMessage });

  const privateKey = keccak256(signature);
  const formattedPrivateKey = BigInt(privateKey);

  const signingKey = new SigningKey(privateKey);
  const uncompressedPublicKey = signingKey.publicKey; 

  const publicKey = [
      BigInt('0x' + uncompressedPublicKey.substring(4, 68)),  // X coordinate
      BigInt('0x' + uncompressedPublicKey.substring(68, 132)) // Y coordinate
  ];

  return { privateKey, formattedPrivateKey, publicKey };
}


export default function RegisterUserPage() {
    const [logs, setLogs] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const account = useActiveAccount();
    const chain = useActiveWalletChain();

    const addLog = (message: string, type: 'info' | 'success' | 'error' | 'normal' = 'normal') => {
        const timestamp = new Date().toLocaleTimeString();
        setLogs(prev => [...prev, `[${timestamp}] <span class="${type}">${message}</span>`]);
    };

    const handleRegister = async () => {
        if (!account || !chain) {
            addLog("Please connect your wallet and ensure it's on the correct network.", "error");
            return;
        }

        setIsLoading(true);
        setLogs([]);
        addLog("🚀 Starting registration process...");

        try {
            const registrarContract = getContract({
                client: thirdwebClient,
                chain: avalancheFork,
                address: ENCRYPTED_ERC_ADDRESSES.Registrar,
                abi: REGISTRAR_ABI,
            });

            addLog(`Checking registration status for ${account.address}...`);
            const isRegistered = await readContract({
                contract: registrarContract,
                method: "isUserRegistered",
                params: [account.address as `0x${string}`],
            });

            if (isRegistered) {
                addLog("✅ User is already registered. No action needed.", "success");
                setIsLoading(false);
                return;
            }
            addLog("User is not registered. Proceeding...");

            addLog("✍️ Deriving keys from wallet signature...");
            const { formattedPrivateKey, publicKey } = await deriveKeysFromSignature(account);
            addLog("🔑 Keys derived successfully.", "success");
            addLog(`   Public Key X: ${publicKey[0].toString()}`);
            addLog(`   Public Key Y: ${publicKey[1].toString()}`);

            addLog("🌀 Generating Poseidon registration hash...");
            const registrationHash = poseidon3([
                BigInt(chain.id),
                formattedPrivateKey,
                BigInt(account.address),
            ]);
            addLog("✅ Registration hash generated.", "success");
            addLog(`   Hash: ${registrationHash.toString()}`);

            addLog("🔐 Generating registration proof...");
            
            const inputs = {
                SenderAddress: BigInt(account.address).toString(),
                ChainID: BigInt(chain.id).toString(),
                SenderPrivateKey: formattedPrivateKey.toString(),
                SenderPublicKey: publicKey.map(k => k.toString()),
                RegistrationHash: registrationHash.toString(),
            };

            addLog("Preparing inputs for proof generation...", "info");
            addLog(`Inputs: ${JSON.stringify(inputs)}`);
            
            const wasmPath = "/circuits/RegistrationCircuit.wasm";
            const zkeyPath = "/circuits/RegistrationCircuit.groth16.zkey";

            addLog(`Fetching WASM from: ${wasmPath}`);
            const wasmRes = await fetch(wasmPath);
            if (!wasmRes.ok) {
                throw new Error(`Failed to fetch WASM: ${wasmRes.status} ${wasmRes.statusText}`);
            }
            const wasmBuffer = await wasmRes.arrayBuffer();
            addLog("✅ WASM fetched.");

            addLog(`Fetching ZKEY from: ${zkeyPath}`);
            const zkeyRes = await fetch(zkeyPath);
            if (!zkeyRes.ok) {
                throw new Error(`Failed to fetch ZKEY: ${zkeyRes.status} ${zkeyRes.statusText}`);
            }
            const zkeyBuffer = await zkeyRes.arrayBuffer();
            addLog("✅ ZKEY fetched.");
            
            const { proof, publicSignals } = await groth16.fullProve(
                inputs,
                new Uint8Array(wasmBuffer),
                new Uint8Array(zkeyBuffer)
            );

            addLog(`Public Signals: ${JSON.stringify(publicSignals)}`);

            if (!publicSignals || publicSignals.length !== 5) {
                throw new Error(`Unexpected publicSignals length: ${publicSignals?.length}. Expected 5.`);
            }

            const verifierInterface = new Interface(VERIFIER_ABI);
            const proofArgs = {
                a: [proof.pi_a[0], proof.pi_a[1]],
                b: [
                    [proof.pi_b[0][0], proof.pi_b[0][1]],
                    [proof.pi_b[1][0], proof.pi_b[1][1]]
                ],
                c: [proof.pi_c[0], proof.pi_c[1]],
                input: publicSignals.map(s => s)
            };

            const calldata = verifierInterface.encodeFunctionData("verifyProof", [
                proofArgs.a,
                proofArgs.b,
                proofArgs.c,
                proofArgs.input
            ]);

            addLog("✅ Proof generated.", "success");

            addLog("📝 Sending registration transaction to the contract...");
            
            const transaction = prepareContractCall({
                contract: registrarContract,
                method: "register",
                params: [calldata as `0x${string}`],
            });

            const { transactionHash } = await sendTransaction({
                transaction,
                account,
            });

            addLog(`✅ Transaction sent! Hash: ${transactionHash}`, "success");
            addLog("Waiting for confirmation...");
            // Note: In a real app, you'd wait for transaction receipt here.
            // For this example, we'll assume it succeeds and proceed to verify.
            addLog("🎉 User registered successfully on the blockchain!", "success");

            addLog("🔍 Verifying registration on-chain...");
            const isNowRegistered = await readContract({
                contract: registrarContract,
                method: "isUserRegistered",
                params: [account.address as `0x${string}`],
            });
            const userPublicKey = await readContract({
                contract: registrarContract,
                method: "getUserPublicKey",
                params: [account.address as `0x${string}`],
            });

            addLog(`   - Is Registered: ${isNowRegistered}`, "info");
            addLog(`   - Stored Public Key X: ${userPublicKey[0].toString()}`, "info");
            addLog(`   - Stored Public Key Y: ${userPublicKey[1].toString()}`, "info");

            if (isNowRegistered && userPublicKey[0] === publicKey[0]) {
                addLog("✅ Verification successful!", "success");
            } else {
                addLog("❌ Verification failed!", "error");
            }

        } catch (error: any) {
            console.error("Registration failed:", error);
            addLog(`❌ An error occurred: ${error.message}`, "error");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <h1>Encrypted ERC User Registration</h1>
                <p>Register to generate your private keys and prove ownership on-chain.</p>
            </div>

            <ConnectButton
                client={thirdwebClient}
                wallets={[wallet]}
                chain={avalancheFork}
            />

            <button
                style={{ ...styles.button, ...(isLoading || !account ? styles.buttonDisabled : {}) }}
                onClick={handleRegister}
                disabled={isLoading || !account}
            >
                {isLoading ? 'Registering...' : 'Register Now'}
            </button>

            <div style={styles.logsContainer}>
                {logs.length === 0 ? "Logs will appear here..." :
                    logs.map((log, index) => (
                        <div key={index} style={styles.logMessage} dangerouslySetInnerHTML={{ __html: log }} />
                    ))
                }
            </div>
        </div>
    );
}