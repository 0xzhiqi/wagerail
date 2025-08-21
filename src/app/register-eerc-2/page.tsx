"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useActiveAccount, useConnect } from "thirdweb/react"
import { prepareContractCall, readContract, sendTransaction } from "thirdweb"
import { thirdwebClient } from "@/config/thirdweb-client"
import { avalancheFork } from "@/config/chains"
import { ENCRYPTED_ERC_ADDRESSES } from "@/config/contracts"
import { getContract } from "thirdweb"
import { toast } from "sonner"
import { useSession } from "next-auth/react"
import { CheckCircle, AlertCircle, Loader2 } from "lucide-react"
import { wallet } from "@/config/wallet"
import { poseidon3 } from "poseidon-lite"
import { ethers } from "ethers"

// Import zkit circuit - adjust this import to your actual zkit setup
import { getCircuit } from '@/lib/zkit-config-manual'

interface RegistrationStatus {
  registered: boolean;
  publicKey?: string;
  registrationTxHash?: string;
}

interface UserKeys {
  privateKey: bigint;
  formattedPrivateKey: bigint;
  publicKey: [bigint, bigint];
}

export default function RegisterEERCPage() {
  const { data: session } = useSession()
  const activeAccount = useActiveAccount()
  const { connect } = useConnect()
  
  const [registrationStatus, setRegistrationStatus] = useState<RegistrationStatus>({ registered: false })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isWalletConnecting, setIsWalletConnecting] = useState(false)
  const [walletReconnectAttempted, setWalletReconnectAttempted] = useState(false)

  // Auto-connect wallet on page load
  useEffect(() => {
    const autoConnectWallet = async () => {
      if (!activeAccount && !walletReconnectAttempted) {
        setIsWalletConnecting(true)
        try {
          await wallet.autoConnect({ client: thirdwebClient })
          await connect(async () => wallet)
        } catch (error) {
          console.log("Auto-connect failed:", error)
        } finally {
          setIsWalletConnecting(false)
          setWalletReconnectAttempted(true)
        }
      }
    }

    autoConnectWallet()
  }, [activeAccount, connect, walletReconnectAttempted])

  // Check registration status when session or account changes
  useEffect(() => {
    if (session && activeAccount) {
      checkRegistrationStatus()
    }
  }, [session, activeAccount])

  const checkRegistrationStatus = async () => {
    if (!activeAccount) return

    try {
      console.log("🔍 Checking registration status for:", activeAccount.address)
      
      const registrarContract = getContract({
        client: thirdwebClient,
        chain: avalancheFork,
        address: ENCRYPTED_ERC_ADDRESSES.Registrar,
      })

      console.log("📋 Using contract:", ENCRYPTED_ERC_ADDRESSES.Registrar)
      console.log("📋 On chain:", avalancheFork.id)

      // FIRST: Let's verify both the old and new transaction hashes
      const previousTxHash = "0x12acf1c2758eb093efd9731a6894ab8488da265271cc81c0b3486094dfeb37e6"
      const latestTxHash = "0x56ecc3689466c2f6421dbf508af67f3a20fa4736f43422684747c377b3d4dc73"
      
      console.log("🔍 Checking transaction statuses...")
      
      try {
        const provider = new ethers.JsonRpcProvider(avalancheFork.rpc)
        
        // Check previous transaction
        const previousReceipt = await provider.getTransactionReceipt(previousTxHash)
        if (previousReceipt) {
          console.log("📋 Previous transaction:", {
            hash: previousTxHash,
            status: previousReceipt.status, // 1 = success, 0 = failed
            gasUsed: previousReceipt.gasUsed.toString()
          })
        }
        
        // Check latest transaction
        const latestReceipt = await provider.getTransactionReceipt(latestTxHash)
        if (latestReceipt) {
          console.log("📋 Latest transaction:", {
            hash: latestTxHash,
            status: latestReceipt.status, // 1 = success, 0 = failed
            gasUsed: latestReceipt.gasUsed.toString()
          })
          
          if (latestReceipt.status === 1) {
            console.log("🎉 LATEST TRANSACTION SUCCEEDED!")
          } else {
            console.error("❌ Latest transaction also failed")
          }
        } else {
          console.log("⏳ Latest transaction not yet mined")
        }
        
      } catch (txError) {
        console.error("❌ Error checking transactions:", txError)
      }

      // Check if user is registered
      const isRegistered = await readContract({
        contract: registrarContract,
        method: "function isUserRegistered(address user) view returns (bool)",
        params: [activeAccount.address],
      })

      console.log("✅ Registration check result:", isRegistered)

      // If not registered, let's also check some contract state to debug
      if (!isRegistered) {
        try {
          // Try to call some other contract functions to see if it's working
          console.log("🔍 Contract debugging - checking if contract is responsive...")
          
          // Try to read total registered users or similar
          const someState = await readContract({
            contract: registrarContract,
            method: "function owner() view returns (address)",
            params: [],
          })
          console.log("✅ Contract is responsive, owner:", someState)
          
        } catch (contractDebugError) {
          console.error("❌ Contract debug error:", contractDebugError)
          console.error("This might indicate the contract address is wrong or the chain is different")
        }
      }

      let publicKey: string | undefined
      if (isRegistered) {
        try {
          // Get user's public key
          const userPublicKey = await readContract({
            contract: registrarContract,
            method: "function getUserPublicKey(address user) view returns (uint256[2])",
            params: [activeAccount.address],
          })
          publicKey = `[${userPublicKey[0].toString()}, ${userPublicKey[1].toString()}]`
          console.log("✅ Retrieved public key:", publicKey)
        } catch (pkError) {
          console.error("❌ Error getting public key:", pkError)
        }
      }

      // Try to get registration transaction hash from database
      let registrationTxHash: string | undefined
      try {
        const response = await fetch(`/api/users/registration-status?address=${activeAccount.address}`)
        if (response.ok) {
          const data = await response.json()
          registrationTxHash = data.registrationTxHash
          console.log("✅ Retrieved tx hash from DB:", registrationTxHash)
        } else {
          console.log("⚠️ Could not fetch tx hash from DB (API not found)")
        }
      } catch (error) {
        console.log("⚠️ Could not fetch registration tx hash:", error)
      }

      setRegistrationStatus({
        registered: isRegistered,
        publicKey,
        registrationTxHash,
      })

      console.log("📊 Final registration status:", {
        registered: isRegistered,
        publicKey,
        registrationTxHash,
      })
      
    } catch (error) {
      console.error("❌ Error checking registration status:", error)
      console.error("Error details:", {
        message: error instanceof Error ? error.message : String(error),
        contract: ENCRYPTED_ERC_ADDRESSES.Registrar,
        chain: avalancheFork.id,
        address: activeAccount.address
      })
      setError("Failed to check registration status")
    }
  }

  /**
   * Derive keys from user signature - following the exact approach from the script
   */
  const deriveKeysFromUser = async (userAddress: string): Promise<UserKeys> => {
    try {
      // Create a message to sign (following the script approach)
      const message = `Generate keys for EncryptedERC registration: ${userAddress}`
      
      // Use thirdweb's wallet signing approach
      if (!activeAccount) {
        throw new Error("No active account available")
      }

      // Sign the message using thirdweb's signMessage
      const signature = await activeAccount.signMessage({ message })

      // Convert signature to private key (deterministic)
      const privateKey = BigInt(ethers.keccak256(signature))
      
      // Format private key to be within field size (same as script)
      const fieldSize = BigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617")
      const formattedPrivateKey = privateKey % fieldSize

      // Generate public key coordinates (mock implementation - in real scenario you'd derive from private key using elliptic curve)
      // For now, we'll generate deterministic coordinates based on the private key
      const publicKeyX = poseidon3([formattedPrivateKey, BigInt(1), BigInt(userAddress)]) % fieldSize
      const publicKeyY = poseidon3([formattedPrivateKey, BigInt(2), BigInt(userAddress)]) % fieldSize

      return {
        privateKey,
        formattedPrivateKey,
        publicKey: [publicKeyX, publicKeyY]
      }
    } catch (error) {
      console.error("Error deriving keys from user:", error)
      throw new Error("Failed to derive keys from user signature")
    }
  }

  const handleManualConnect = async () => {
    setIsWalletConnecting(true)
    try {
      await connect(async () => wallet)
    } catch (error) {
      console.error("Manual connect failed:", error)
      setError("Failed to connect wallet")
    } finally {
      setIsWalletConnecting(false)
    }
  }

  const handleRegister = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    
    if (!activeAccount) {
      setError("Please connect your wallet first")
      return
    }

    if (registrationStatus.registered) {
      setError("You are already registered")
      return
    }

    setIsLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const userAddress = activeAccount.address
      
      console.log("🔧 Registering user in EncryptedERC using zkit...")
      console.log("Registrar:", ENCRYPTED_ERC_ADDRESSES.Registrar)
      console.log("User to register:", userAddress)

      // 1. Generate deterministic private key from signature using utility function
      const { privateKey, formattedPrivateKey, publicKey } = await deriveKeysFromUser(userAddress)
      
      // 2. Generate registration hash using poseidon3 (following script exactly)
      const chainId = BigInt(avalancheFork.id)
      const address = userAddress
      
      const registrationHash = poseidon3([
        chainId,
        formattedPrivateKey,
        BigInt(address),
      ])
      
      console.log("Chain ID:", chainId.toString())
      console.log("Address:", address)
      console.log("Registration Hash:", registrationHash.toString())
      
      // 3. Generate proof using zkit (following script approach)
      console.log("🔐 Generating registration proof using zkit...")
      
      const circuit = await getCircuit("RegistrationCircuit")
      
      // Prepare inputs for the circuit (matching script exactly)
      const input = {
        SenderPrivateKey: formattedPrivateKey,
        SenderPublicKey: [publicKey[0], publicKey[1]],
        SenderAddress: BigInt(address),
        ChainID: chainId,
        RegistrationHash: registrationHash,
      }
      
      console.log("📋 Circuit inputs prepared:")
      console.log("- SenderPrivateKey:", formattedPrivateKey.toString())
      console.log("- SenderPublicKey:", [publicKey[0].toString(), publicKey[1].toString()])
      console.log("- SenderAddress:", BigInt(address).toString())
      console.log("- ChainID:", chainId.toString())
      console.log("- RegistrationHash:", registrationHash.toString())
      
      // Generate proof
      const proofResult = await circuit.generateProof(input)
      console.log("✅ Proof generated successfully using zkit")
      
      // Generate calldata for the contract - pass both proof and publicSignals
      const calldata = await circuit.generateCalldata(proofResult.proof, proofResult.publicSignals)
      console.log("✅ Calldata generated successfully")
      
      // Log calldata structure for debugging
      console.log("📊 Calldata structure:")
      console.log("- a:", calldata.calldata.a)
      console.log("- b:", calldata.calldata.b)
      console.log("- c:", calldata.calldata.c)
      console.log("- inputs:", calldata.calldata.inputs)
      console.log("- publicSignals:", proofResult.publicSignals)
      
      // Verify that calldata has expected structure
      if (!calldata.calldata || !calldata.calldata.a || !calldata.calldata.b || !calldata.calldata.c) {
        throw new Error("Invalid calldata structure generated")
      }
      
      // For registration circuit, the public signals should include the registration hash
      // If empty, construct them manually from the circuit inputs
      let contractInputs: bigint[]
      
      if (calldata.calldata.inputs && calldata.calldata.inputs.length > 0 && calldata.calldata.inputs[0] !== undefined) {
        contractInputs = calldata.calldata.inputs
        console.log("📊 Using calldata inputs:", contractInputs.map(x => x.toString()))
      } else if (proofResult.publicSignals && proofResult.publicSignals.length > 0) {
        // Convert string publicSignals to bigint
        contractInputs = proofResult.publicSignals.map((signal: string) => BigInt(signal))
        console.log("📊 Using publicSignals:", contractInputs.map(x => x.toString()))
      } else {
        // For registration circuits, the typical public signals should include:
        // 1. Registration hash (main output)
        // 2. Public key coordinates (sometimes)
        // 3. Sender address (sometimes)
        console.log("⚠️ No public signals found, constructing manually...")
        
        // Based on the original script, let's try just the registration hash
        // since that's what the verifier contract typically expects
        contractInputs = [registrationHash]
        
        console.log("🔧 Manual inputs constructed:", contractInputs.map(x => x.toString()))
      }
      
      console.log("📊 Final contract inputs:", contractInputs)
      console.log("📊 Final contract inputs as strings:", contractInputs.map(x => x.toString()))

      // CRITICAL: Check that we have the expected number of public signals
      // Most registration circuits expect exactly 1 public signal (the registration hash)
      if (contractInputs.length === 0) {
        throw new Error("❌ No public signals available - circuit may not be generating outputs correctly")
      }
      
      // Verify that the inputs are not empty/undefined
      if (contractInputs.some(input => input === undefined || input === null || input.toString() === '')) {
        console.log("⚠️ Found empty inputs, replacing with registration hash")
        contractInputs = [registrationHash]
      }
      
      // Verify proof structure before sending to contract
      console.log("🔍 Verifying proof structure before contract call...")
      if (!proofResult.proof || !proofResult.proof.pi_a || !proofResult.proof.pi_b || !proofResult.proof.pi_c) {
        throw new Error("❌ Generated proof structure is invalid")
      }
      console.log("✅ Proof structure is valid")
      
      // 4. Call the contract
      console.log("📝 Registering in the contract...")
      
      const registrarContract = getContract({
        client: thirdwebClient,
        chain: avalancheFork,
        address: ENCRYPTED_ERC_ADDRESSES.Registrar,
      })

      // Log all the data we're about to send for debugging
      console.log("🔍 DEBUGGING CONTRACT CALL:")
      console.log("- Registration Hash:", registrationHash.toString())
      console.log("- Chain ID:", chainId.toString())
      console.log("- User Address:", userAddress)
      console.log("- Contract Address:", ENCRYPTED_ERC_ADDRESSES.Registrar)
      console.log("- Proof A:", [calldata.calldata.a[0].toString(), calldata.calldata.a[1].toString()])
      console.log("- Proof B:", [[calldata.calldata.b[0][0].toString(), calldata.calldata.b[0][1].toString()], [calldata.calldata.b[1][0].toString(), calldata.calldata.b[1][1].toString()]])
      console.log("- Proof C:", [calldata.calldata.c[0].toString(), calldata.calldata.c[1].toString()])
      console.log("- Public Inputs:", contractInputs.map(x => x.toString()))

      // Before calling the contract, let's check if user is already registered
      console.log("🔍 Checking if user is already registered...")
      try {
        const isAlreadyRegistered = await readContract({
          contract: registrarContract,
          method: "function isUserRegistered(address user) view returns (bool)",
          params: [userAddress],
        })
        
        if (isAlreadyRegistered) {
          throw new Error("User is already registered in the contract")
        }
        console.log("✅ User is not yet registered, proceeding...")
      } catch (readError) {
        console.error("❌ Error checking registration status:", readError)
        throw new Error(`Failed to check registration status: ${readError}`)
      }

      // Try multiple approaches to see which one works
      console.log("🎯 Attempting contract registration with multiple strategies...")
      
      // CRITICAL DEBUGGING: Let's check if the issue is with the proof verification itself
      console.log("🔍 ADVANCED DEBUGGING - Checking contract state and proof format...")
      
      // Check verifier contract details
      try {
        // Try to call some read functions to understand the contract better
        console.log("📋 Contract debugging info:")
        
        // Check if there's a verifyProof function we can test
        const testProofResult = await readContract({
          contract: registrarContract,
          method: "function verifyProof(uint[2] a, uint[2][2] b, uint[2] c, uint[] inputs) view returns (bool)",
          params: [
            [calldata.calldata.a[0], calldata.calldata.a[1]],
            [[calldata.calldata.b[0][0], calldata.calldata.b[0][1]], [calldata.calldata.b[1][0], calldata.calldata.b[1][1]]],
            [calldata.calldata.c[0], calldata.calldata.c[1]],
            contractInputs
          ],
        })
        
        console.log("✅ Proof verification result:", testProofResult)
        
        if (!testProofResult) {
          console.error("❌ CRITICAL: Proof verification failed! The proof is invalid.")
          console.error("This suggests a mismatch between:")
          console.error("1. The circuit used for proof generation")
          console.error("2. The verifier contract deployed")
          console.error("3. The public signals format")
          
          throw new Error("Proof verification failed - circuit/verifier mismatch detected")
        }
        
      } catch (verifyError) {
        console.log("❌ Could not test proof verification:", verifyError)
        console.log("Proceeding with registration attempts...")
      }

      let result: any
      
      try {
        console.log("📋 Strategy 1: Using standard Groth16 format...")
        
        const transaction1 = prepareContractCall({
          contract: registrarContract,
          method: "function register(uint[2] a, uint[2][2] b, uint[2] c, uint[] inputs) external",
          params: [
            [calldata.calldata.a[0], calldata.calldata.a[1]],
            [[calldata.calldata.b[0][0], calldata.calldata.b[0][1]], [calldata.calldata.b[1][0], calldata.calldata.b[1][1]]],
            [calldata.calldata.c[0], calldata.calldata.c[1]],
            contractInputs
          ],
        })

        result = await sendTransaction({
          transaction: transaction1,
          account: activeAccount,
        })

        console.log("✅ Strategy 1 succeeded!")
        
      } catch (strategy1Error) {
        console.log("❌ Strategy 1 failed:", strategy1Error)
        
        try {
          console.log("📋 Strategy 2: Testing with empty public signals...")
          
          // Maybe the contract expects NO public signals
          const transaction2 = prepareContractCall({
            contract: registrarContract,
            method: "function register(uint[2] a, uint[2][2] b, uint[2] c, uint[] inputs) external",
            params: [
              [calldata.calldata.a[0], calldata.calldata.a[1]],
              [[calldata.calldata.b[0][0], calldata.calldata.b[0][1]], [calldata.calldata.b[1][0], calldata.calldata.b[1][1]]],
              [calldata.calldata.c[0], calldata.calldata.c[1]],
              [] // Empty public signals
            ],
          })

          result = await sendTransaction({
            transaction: transaction2,
            account: activeAccount,
          })
          
          console.log("✅ Strategy 2 succeeded!")
          
        } catch (strategy2Error) {
          console.log("❌ Strategy 2 failed:", strategy2Error)
          
          try {
            console.log("📋 Strategy 3: Testing with different public signal format...")
            
            // Maybe the contract expects multiple public signals in a different format
            const alternativeInputs = [
              registrationHash,
              BigInt(userAddress), // Maybe it needs the address
              chainId // Maybe it needs the chainId
            ]
            
            const transaction3 = prepareContractCall({
              contract: registrarContract,
              method: "function register(uint[2] a, uint[2][2] b, uint[2] c, uint[] inputs) external",
              params: [
                [calldata.calldata.a[0], calldata.calldata.a[1]],
                [[calldata.calldata.b[0][0], calldata.calldata.b[0][1]], [calldata.calldata.b[1][0], calldata.calldata.b[1][1]]],
                [calldata.calldata.c[0], calldata.calldata.c[1]],
                alternativeInputs
              ],
            })

            result = await sendTransaction({
              transaction: transaction3,
              account: activeAccount,
            })
            
            console.log("✅ Strategy 3 succeeded!")
            
          } catch (strategy3Error) {
            console.log("❌ Strategy 3 failed:", strategy3Error)
            
            // Final attempt: Check if the issue is with gas or other parameters
            try {
              console.log("📋 Strategy 4: Testing with higher gas limit...")
              
              const transaction4 = prepareContractCall({
                contract: registrarContract,
                method: "function register(uint[2] a, uint[2][2] b, uint[2] c, uint[] inputs) external",
                params: [
                  [calldata.calldata.a[0], calldata.calldata.a[1]],
                  [[calldata.calldata.b[0][0], calldata.calldata.b[0][1]], [calldata.calldata.b[1][0], calldata.calldata.b[1][1]]],
                  [calldata.calldata.c[0], calldata.calldata.c[1]],
                  contractInputs
                ],
                gas: BigInt(500000) // Explicit gas limit
              })

              result = await sendTransaction({
                transaction: transaction4,
                account: activeAccount,
              })
              
              console.log("✅ Strategy 4 succeeded!")
              
            } catch (strategy4Error) {
              console.log("❌ Strategy 4 failed:", strategy4Error)
              
              // Log detailed diagnostic information
              console.error("🚨 ALL STRATEGIES FAILED - DIAGNOSTIC INFO:")
              console.error("1. Proof components are valid:", {
                a: calldata.calldata.a.map(x => x.toString()),
                b: calldata.calldata.b.map(row => row.map(x => x.toString())),
                c: calldata.calldata.c.map(x => x.toString())
              })
              console.error("2. Public inputs tested:", {
                original: contractInputs.map(x => x.toString()),
                empty: [],
                alternative: [registrationHash.toString(), BigInt(userAddress).toString(), chainId.toString()]
              })
              console.error("3. Contract address:", ENCRYPTED_ERC_ADDRESSES.Registrar)
              console.error("4. User address:", userAddress)
              console.error("5. Registration hash:", registrationHash.toString())
              
              // Provide actionable next steps
              console.error("🔧 NEXT STEPS TO DEBUG:")
              console.error("1. Verify the circuit file matches the deployed verifier contract")
              console.error("2. Check if the verifier contract was compiled with the same trusted setup")
              console.error("3. Verify the circuit's public signals match what the contract expects")
              console.error("4. Test the proof verification separately from registration")
              
              throw new Error(`All registration strategies failed. This likely indicates a circuit/verifier mismatch.
                Original error: ${strategy1Error}
                Empty signals error: ${strategy2Error}  
                Alternative inputs error: ${strategy3Error}
                Gas limit error: ${strategy4Error}`)
            }
          }
        }
      }

      if (result) {
        console.log("✅ User registered successfully!")
        console.log("Transaction hash:", result.transactionHash)

        setSuccess(`Registration successful! Transaction hash: ${result.transactionHash}`)
        toast.success("Registration completed successfully!")
        
        // 5. Save registration details to database (optional)
        try {
          await fetch('/api/users/register-eerc', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              address: userAddress,
              publicKey: publicKey.map(k => k.toString()),
              privateKey: formattedPrivateKey.toString(),
              registrationTxHash: result.transactionHash,
              registrationHash: registrationHash.toString(),
            }),
          })
        } catch (dbError) {
          console.error("Failed to save to database:", dbError)
          // Don't fail the entire process if database save fails
        }

        // 6. Verify registration and refresh status
        await checkRegistrationStatus()
      } else {
        throw new Error("No successful registration result")
      }
      
    } catch (error) {
      console.error("❌ Error during registration:", error)
      
      // Enhanced error handling following the script approach
      if (error instanceof Error) {
        console.error("Error type:", error.constructor.name)
        console.error("Message:", error.message)
        
        if (error.message.includes("execution reverted")) {
          console.error("This is a contract execution error")
          
          // Try to extract custom error message
          const revertMatch = error.message.match(/execution reverted: (.+)/)
          if (revertMatch && revertMatch[1]) {
            setError(`Contract error: ${revertMatch[1]}`)
          } else {
            setError("Contract reverted without specific message")
          }
        } else {
          setError(`Registration failed: ${error.message}`)
        }
        
        if (error.stack) {
          console.error("Stack trace:", error.stack)
        }
      } else {
        console.error("Unknown error:", error)
        setError("Registration failed with unknown error")
      }
      
      toast.error("Registration failed")
    } finally {
      setIsLoading(false)
    }
  }

  if (!session) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription>
              Please sign in to register for Encrypted ERC
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {registrationStatus.registered ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : (
              <AlertCircle className="h-5 w-5 text-yellow-500" />
            )}
            Encrypted ERC Registration
          </CardTitle>
          <CardDescription>
            Register your wallet for Encrypted ERC functionality using zero-knowledge proofs
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Registration Status */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Registration Status</Label>
            <div className={`p-3 rounded-lg border ${
              registrationStatus.registered 
                ? 'bg-green-50 border-green-200 text-green-800' 
                : 'bg-yellow-50 border-yellow-200 text-yellow-800'
            }`}>
              {registrationStatus.registered ? 'Registered' : 'Not Registered'}
            </div>
          </div>

          {/* Contract Information */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Contract Details</Label>
            <div className="p-3 bg-gray-50 rounded-lg border text-sm">
              <div><strong>Network:</strong> Avalanche Fork</div>
              <div><strong>Registrar:</strong> {ENCRYPTED_ERC_ADDRESSES.Registrar}</div>
            </div>
          </div>

          {/* Wallet Status */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Wallet Connection</Label>
            <div className="p-3 bg-gray-50 rounded-lg border text-sm">
              {isWalletConnecting ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Connecting wallet...
                </div>
              ) : activeAccount ? (
                <div><strong>Connected:</strong> {activeAccount.address}</div>
              ) : (
                <div className="space-y-2">
                  <div className="text-yellow-600">No wallet connected</div>
                  <Button onClick={handleManualConnect} size="sm">
                    Connect Wallet
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Public Key Display */}
          {registrationStatus.publicKey && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Registered Public Key</Label>
              <div className="p-3 bg-gray-50 rounded-lg border text-sm font-mono break-all">
                {registrationStatus.publicKey}
              </div>
            </div>
          )}

          {/* Transaction Hash */}
          {registrationStatus.registrationTxHash && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Registration Transaction</Label>
              <div className="p-3 bg-gray-50 rounded-lg border text-sm font-mono break-all">
                {registrationStatus.registrationTxHash}
              </div>
            </div>
          )}

          <Separator />

          {/* Error/Success Messages */}
          {error && (
            <Alert className="border-red-200 bg-red-50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                {error}
              </AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                {success}
              </AlertDescription>
            </Alert>
          )}

          {/* Registration Button */}
          <Button 
            onClick={handleRegister}
            disabled={isLoading || !activeAccount || registrationStatus.registered}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating Proof & Registering...
              </>
            ) : registrationStatus.registered ? (
              'Already Registered'
            ) : (
              'Register for Encrypted ERC'
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}