"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { useSession } from "next-auth/react"
import { useActiveAccount, useConnect, useReadContract, useSendTransaction } from "thirdweb/react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { UserInfoCard } from "@/components/UserInfoCard"
import { WagePaymentsCard } from "@/components/WagePaymentsCard"
import { WageGroupCreateDialog } from "@/components/WageGroupCreateDialog"
import { VaultSelector } from "@/components/VaultSelector"
import { WageGroupForm, Payee } from "@/types/wage"
import { 
  Wallet, 
  Users, 
  DollarSign, 
  TrendingUp, 
  Target, 
  UserPlus, 
  FileText, 
  Settings, 
  BarChart3,
  Activity,
  CheckCircle,
  XCircle,
  Loader2
} from "lucide-react"
import { avalancheFork } from "@/config/chains"
import { CONTRACT_ADDRESSES, ENCRYPTED_ERC_ADDRESSES } from "@/config/contracts"
import { thirdwebClient } from "@/config/thirdweb-client"
import { prepareContractCall, getContract, readContract } from "thirdweb"
import { waitForReceipt } from "thirdweb"
// Add thirdweb viem adapter imports
import { viemAdapter } from "thirdweb/adapters/viem"
import { wallet } from "@/config/wallet"

// Add crypto utilities for direct EERC interaction
import { Base8, type Point, mulPointEscalar } from "@zk-kit/baby-jubjub"
import {
  formatPrivKeyForBabyJub,
  genRandomBabyJubValue,
  poseidonDecrypt,
  poseidonEncrypt,
} from "maci-crypto"
import { randomBytes } from "crypto"

// Import the complete EncryptedERC ABI
import EncryptedERCArtifact from '@/config/EncryptedERC.json'

// Use the complete ABI from the artifact with proper typing
const ENCRYPTED_ERC_ABI = EncryptedERCArtifact.abi as any

interface UserData {
  id?: string
  email?: string
  firstName?: string
  middleName?: string
  lastName?: string
  walletAddress?: string
}

interface WageGroup {
  id: string
  name: string
  startDate: string
  paymentDate: number
  yieldSource?: string
  isActive: boolean
  payees: Array<{
    id: string
    email: string
    monthlyAmount: number
    user?: {
      id: string
      email: string
    }
  }>
}

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const activeAccount = useActiveAccount()
  const { connect } = useConnect()
  const router = useRouter()
  const [userData, setUserData] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [walletReconnectAttempted, setWalletReconnectAttempted] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [formData, setFormData] = useState({
    firstName: "",
    middleName: "",
    lastName: ""
  })

  // Memoize client instances to prevent re-creation on every render
  const publicClient = useMemo(() => {
    return viemAdapter.publicClient.toViem({
      client: thirdwebClient,
      chain: avalancheFork as any,
    })
  }, [])

  const walletClient = useMemo(() => {
    if (!activeAccount || !wallet) return undefined
    return viemAdapter.wallet.toViem({
      wallet: wallet,
      client: thirdwebClient,
      chain: avalancheFork as any,
    })
  }, [activeAccount])
  
  // Add utility functions for direct EERC interaction
  const BASE_POINT_ORDER = BigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617")

  /**
   * Generates a random nonce
   * @returns A cryptographically secure random number
   */
  const randomNonce = (): bigint => {
    const bytes = randomBytes(16)
    // add 1 to make sure it's non-zero
    return BigInt(`0x${bytes.toString("hex")}`) + 1n
  }

  /**
   * Process Poseidon encryption for EERC
   * @param inputs Input array to encrypt
   * @param publicKey Public key
   * @returns encryption components
   */
  const processPoseidonEncryption = (
    inputs: bigint[],
    publicKey: bigint[],
  ) => {
    const nonce = randomNonce()

    let encRandom = genRandomBabyJubValue()
    if (encRandom >= BASE_POINT_ORDER) {
      encRandom = genRandomBabyJubValue() / 10n
    }

    const poseidonEncryptionKey = mulPointEscalar(
      publicKey as Point<bigint>,
      encRandom,
    )
    const authKey = mulPointEscalar(Base8, encRandom)
    const ciphertext = poseidonEncrypt(inputs, poseidonEncryptionKey, nonce)

    return { ciphertext, nonce, encRandom, poseidonEncryptionKey, authKey }
  }



  // Wage groups state
  const [wageGroups, setWageGroups] = useState<WageGroup[]>([])
  const [wageDialogOpen, setWageDialogOpen] = useState(false)
  const [editWageDialogOpen, setEditWageDialogOpen] = useState(false)
  const [topUpDialogOpen, setTopUpDialogOpen] = useState(false)
  const [topUpWageGroup, setTopUpWageGroup] = useState<WageGroup | null>(null)
  const [topUpAmount, setTopUpAmount] = useState<string>('')
  const [isDepositing, setIsDepositing] = useState(false)
  const [usdcBalance, setUsdcBalance] = useState<string>("0")
  const [depositStatus, setDepositStatus] = useState<'idle' | 'approving' | 'depositing' | 'success' | 'error'>('idle')
  const [depositMessage, setDepositMessage] = useState<string>('')
  const [topUpVaultAddress, setTopUpVaultAddress] = useState<string | undefined>()
  
  // Add useSendTransaction hook for contract interactions
  const { mutate: sendTransaction } = useSendTransaction()
  


  // Create contract instances
  const usdcContract = getContract({
    address: CONTRACT_ADDRESSES.USDC as `0x${string}`,
    chain: avalancheFork,
    client: thirdwebClient
  })
  
  // Read USDC balance from contract
  const { data: balanceData, refetch: refetchBalance } = useReadContract({
    contract: usdcContract,
    method: "function balanceOf(address account) view returns (uint256)",
    params: [activeAccount?.address || "0x0000000000000000000000000000000000000000"]
  })

  if (!activeAccount) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <p className="text-lg text-gray-600">Please connect your wallet to view the dashboard.</p>
      </div>
    )
  }

  // Update USDC balance when balanceData changes
  useEffect(() => {
    if (balanceData && activeAccount) {
      // Convert from wei (assuming 6 decimals for USDC)
      const balance = Number(balanceData) / 10**6
      setUsdcBalance(balance.toFixed(2))
    } else {
      setUsdcBalance("0")
    }
  }, [balanceData, activeAccount])
  

  

  
  const [selectedWageGroup, setSelectedWageGroup] = useState<WageGroup | null>(null)
  const [creatingWageGroup, setCreatingWageGroup] = useState(false)
  
  // Add missing state variables for wage group editing
  const [editingWageGroup, setEditingWageGroup] = useState<WageGroup | null>(null)
  const [updatingWageGroup, setUpdatingWageGroup] = useState(false)
  const [editFormData, setEditFormData] = useState<WageGroupForm>({
    name: "",
    startDate: "",
    paymentDate: "",
    yieldSource: "none",
    payees: [{ email: "", monthlyAmount: "" }]
  })
  


  // Auto-reconnect wallet on page load
  useEffect(() => {
    const attemptWalletReconnect = async () => {
      if (walletReconnectAttempted) return

      try {
        const { wallet } = await import("@/config/wallet")
        const { thirdwebClient } = await import("@/config/thirdweb-client")

        console.log("Attempting wallet auto-reconnect...")
        
        // First try to auto-connect
        await wallet.autoConnect({ client: thirdwebClient })
        
        // Check if wallet has an account after auto-connect
        const account = wallet.getAccount()
        if (account) {
          console.log("Wallet account found:", account.address)
          await connect(async () => wallet)
          console.log("Wallet reconnected successfully")
        } else {
          console.log("No wallet account found after auto-connect")
          // Optionally try to connect without auto-connect for in-app wallets
          try {
            await connect(async () => wallet)
            const newAccount = wallet.getAccount()
            if (newAccount) {
              console.log("Wallet connected successfully:", newAccount.address)
            }
          } catch (connectError) {
            console.log("Manual connect also failed:", connectError)
          }
        }
      } catch (error) {
        console.log("Wallet auto-reconnect failed:", error)
        // For in-app wallets, try a direct connection attempt
        try {
          const { wallet } = await import("@/config/wallet")
          await connect(async () => wallet)
          console.log("Direct wallet connection succeeded")
        } catch (directError) {
          console.log("Direct wallet connection also failed:", directError)
        }
      } finally {
        setWalletReconnectAttempted(true)
      }
    }

    // Add a small delay to ensure the page is fully loaded
    if (status !== "loading") {
      const timer = setTimeout(() => {
        attemptWalletReconnect()
      }, 100)
      
      return () => clearTimeout(timer)
    }
  }, [status, connect, walletReconnectAttempted])

  // Add an additional effect to retry connection if session is ready but no wallet
  useEffect(() => {
    const retryWalletConnection = async () => {
      // Only retry if we have a session but no active account, and we've already attempted reconnect
      if (session && !activeAccount && walletReconnectAttempted && status === "authenticated") {
        console.log("Session found but no wallet connected, retrying...")
        try {
          const { wallet } = await import("@/config/wallet")
          await connect(async () => wallet)
          console.log("Retry wallet connection succeeded")
        } catch (error) {
          console.log("Retry wallet connection failed:", error)
        }
      }
    }

    // Add a delay before retrying
    const timer = setTimeout(retryWalletConnection, 1000)
    return () => clearTimeout(timer)
  }, [session, activeAccount, walletReconnectAttempted, status, connect])

  useEffect(() => {
    if (status === "loading" || !walletReconnectAttempted) return

    console.log("Dashboard auth check:")
    console.log("- Session:", !!session, session?.user?.id)
    console.log("- Active account:", !!activeAccount, activeAccount?.address)

    if (!session) {
      console.log("No session - redirecting to home")
      router.push("/")
      return
    }

    // If we have a session but no active account, still allow access
    // The wallet might reconnect later or user can reconnect manually
    console.log("Session found - fetching user data")
    fetchUserData()
    fetchWageGroups()
  }, [session, activeAccount, status, router, walletReconnectAttempted])

  const fetchUserData = async () => {
    try {
      const response = await fetch("/api/user")
      console.log("User API response status:", response.status)

      if (response.ok) {
        const data = await response.json()
        console.log("User data:", data)
        setUserData(data)
      } else {
        const errorData = await response.json()
        console.error("User API error:", errorData)
        router.push("/")
      }
    } catch (error) {
      console.error("Error fetching user data:", error)
      router.push("/")
    } finally {
      setLoading(false)
    }
  }

  const fetchWageGroups = async () => {
    try {
      // Add cache-busting parameter to ensure fresh data
      const response = await fetch(`/api/wage-groups?t=${Date.now()}`, {
        cache: 'no-store'
      })
      if (response.ok) {
        const data = await response.json()
        setWageGroups(data)
        console.log("Wage groups refreshed:", data.length, "groups found")
      } else {
        console.error("Failed to fetch wage groups")
      }
    } catch (error) {
      console.error("Error fetching wage groups:", error)
    }
  }

  const handleUpdateNames = async () => {
    setUpdating(true)
    try {
      const response = await fetch("/api/user/update-names", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        await fetchUserData() // Refresh user data
        setEditDialogOpen(false) // Close dialog on success
      } else {
        const error = await response.json()
        console.error("Failed to update names:", error.error)
      }
    } catch (error) {
      console.error("Error updating names:", error)
    } finally {
      setUpdating(false)
    }
  }

  const openEditDialog = () => {
    setFormData({
      firstName: userData?.firstName || "",
      middleName: userData?.middleName || "",
      lastName: userData?.lastName || ""
    })
    setEditDialogOpen(true)
  }

  const getDisplayName = () => {
    if (!userData) return ""
    const parts = [userData.firstName, userData.middleName, userData.lastName].filter(Boolean)
    return parts.length > 0 ? parts.join(" ") : ""
  }

  // Wage group handlers
  const openCreateDialog = () => {
    setWageDialogOpen(true)
  }

  // Add missing wage group edit functions
  const openEditWageGroup = (group: WageGroup) => {
    setEditingWageGroup(group)
    setEditFormData({
      name: group.name,
      startDate: new Date(group.startDate).toISOString().split('T')[0],
      paymentDate: group.paymentDate.toString(),
      yieldSource: group.yieldSource || "none",
      payees: group.payees.map(p => ({
        email: p.email,
        monthlyAmount: p.monthlyAmount.toString()
      }))
    })
    setEditWageDialogOpen(true)
  }

  const addEditPayee = () => {
    setEditFormData(prev => ({
      ...prev,
      payees: [...prev.payees, { email: "", monthlyAmount: "" }]
    }))
  }

  const removeEditPayee = (index: number) => {
    setEditFormData(prev => ({
      ...prev,
      payees: prev.payees.filter((_, i) => i !== index)
    }))
  }

  const updateEditPayee = (index: number, field: keyof Payee, value: string) => {
    setEditFormData(prev => ({
      ...prev,
      payees: prev.payees.map((payee, i) =>
        i === index ? { ...payee, [field]: value } : payee
      )
    }))
  }

  const validateWageForm = (formData: WageGroupForm) => {
    if (!formData.name.trim()) {
      console.error("Wage group name is required")
      return false
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const startDate = new Date(formData.startDate)
    if (startDate <= today) {
      console.error("Start date must be later than today")
      return false
    }

    const paymentDateNum = parseInt(formData.paymentDate)
    if (!paymentDateNum || paymentDateNum < 1 || paymentDateNum > 31) {
      console.error("Payment date must be between 1 and 31")
      return false
    }

    // Validate payees
    for (const payee of formData.payees) {
      if (!payee.email || !payee.monthlyAmount) {
        console.error("All payees must have email and monthly amount")
        return false
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(payee.email)) {
        console.error("Please enter valid email addresses")
        return false
      }

      if (parseFloat(payee.monthlyAmount) <= 0) {
        console.error("Monthly amounts must be greater than 0")
        return false
      }
    }

    return true
  }

  const handleUpdateWageGroup = async () => {
    if (!editingWageGroup || !validateWageForm(editFormData)) return

    setUpdatingWageGroup(true)
    try {
      const submitData = {
        ...editFormData,
        yieldSource: editFormData.yieldSource === "none" ? "" : editFormData.yieldSource
      }

      const response = await fetch(`/api/wage-groups/${editingWageGroup.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(submitData),
      })

      if (response.ok) {
        setEditWageDialogOpen(false)
        setEditingWageGroup(null)
        setEditFormData({
          name: "",
          startDate: "",
          paymentDate: "",
          yieldSource: "none",
          payees: [{ email: "", monthlyAmount: "" }]
        })
        await fetchWageGroups() // Refresh the list
      } else {
        const error = await response.json()
        console.error("Failed to update wage group:", error.error)
      }
    } catch (error) {
      console.error("Error updating wage group:", error)
    } finally {
      setUpdatingWageGroup(false)
    }
  }

  const openTopUpDialog = (group: WageGroup) => {
    setTopUpWageGroup(group)
    setTopUpAmount('')
    setDepositStatus('idle')
    setDepositMessage('')
    
    // Fetch latest wallet balance when opening the dialog
    if (activeAccount) {
      refetchBalance()
    }
    
    let vaultAddress = ""
    switch (group.yieldSource) {
      case "re7-labs":
        vaultAddress = CONTRACT_ADDRESSES.VAULTS.VAULT_1
        break
      case "k3-capital":
        vaultAddress = CONTRACT_ADDRESSES.VAULTS.VAULT_2
        break
      case "mev-capital-avalanche":
        vaultAddress = CONTRACT_ADDRESSES.VAULTS.VAULT_3
        break
    }
    setTopUpVaultAddress(vaultAddress || undefined)
    setTopUpDialogOpen(true)
  }

  const handleCreateWageGroup = async (formData: WageGroupForm) => {
    setCreatingWageGroup(true)
    try {
      const submitData = {
        ...formData,
        yieldSource: formData.yieldSource === "none" ? "" : formData.yieldSource
      }

      const response = await fetch("/api/wage-groups", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(submitData),
      })

      if (response.ok) {
        setWageDialogOpen(false)
        await fetchWageGroups() // Refresh the list
      } else {
        const error = await response.json()
        console.error("Failed to create wage group:", error.error)
      }
    } catch (error) {
      console.error("Error creating wage group:", error)
    } finally {
      setCreatingWageGroup(false)
    }
  }

  const handleDeposit = async () => {
    if (!activeAccount || !topUpWageGroup || !topUpAmount || !topUpVaultAddress) {
      console.error('Missing required data for deposit')
      return
    }

    const amount = parseFloat(topUpAmount)
    if (isNaN(amount) || amount <= 0) {
      console.error('Invalid deposit amount')
      return
    }

    const vaultAddress = topUpVaultAddress
    const amountInWei = BigInt(Math.floor(amount * 10**6)) // USDC has 6 decimals

    console.log('=== STARTING DEPOSIT PROCESS ===')
    console.log('Amount:', amount, 'USDC')
    console.log('Amount in wei:', amountInWei.toString())
    console.log('Vault address:', vaultAddress)
    console.log('User address:', activeAccount.address)

    setIsDepositing(true)
    setDepositStatus('approving')
    setDepositMessage('Approving USDC spending...')

    try {
      // Step 1: Approve USDC spending
      const approveTransaction = prepareContractCall({
        contract: usdcContract,
        method: "function approve(address spender, uint256 amount) returns (bool)",
        params: [vaultAddress as `0x${string}`, amountInWei]
      })

      const approvePromise = new Promise((resolve, reject) => {
        sendTransaction(approveTransaction, {
          onSuccess: async (result) => {
            try {
              await waitForReceipt({
                client: thirdwebClient,
                chain: avalancheFork,
                transactionHash: result.transactionHash
              })
              resolve(result)
            } catch (error) {
              reject(error)
            }
          },
          onError: (error) => {
            reject(error)
          }
        })
      })

      await approvePromise
      console.log('✅ USDC approval completed')

      // Step 2: Deposit into vault
      const vaultContract = getContract({
        client: thirdwebClient,
        chain: avalancheFork,
        address: vaultAddress as `0x${string}`
      })

      const depositTransaction = prepareContractCall({
        contract: vaultContract,
        method: "function deposit(uint256 amount, address receiver) returns (uint256)",
        params: [amountInWei, activeAccount.address as `0x${string}`]
      })
      
      setDepositStatus('depositing')
      setDepositMessage('Depositing USDC into vault...')
      
      const depositPromise = new Promise((resolve, reject) => {
        sendTransaction(depositTransaction, {
          onSuccess: async (result) => {
            try {
              const receipt = await waitForReceipt({
                client: thirdwebClient,
                chain: avalancheFork,
                transactionHash: result.transactionHash
              })
              
              console.log('=== VAULT DEPOSIT SUCCESS ===')
              console.log('Transaction hash:', receipt.transactionHash)
              console.log('Vault address:', vaultAddress)
              console.log('Amount in wei:', amountInWei.toString())
              
              let actualSharesReceived = BigInt(0)
              
              // Parse the transaction logs to get the actual shares minted
              if (receipt.logs) {
                for (const log of receipt.logs) {
                  if (log.address?.toLowerCase() === vaultAddress.toLowerCase()) {
                    const depositSignatures = [
                      "0xdcbc1c05240f31ff3ad067ef1ee35ce4997762752e3a095284754544f4c709d7",
                      "0x90890809c654f11d6e72a28fa60149770a0d11ec6c92319d6ceb2bb0a4ea1a15",
                      "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
                    ]
                    
                    if (log.topics[0] && depositSignatures.includes(log.topics[0])) {
                      console.log('Found potential deposit event')
                      
                      const eventData = log.data
                      if (eventData && eventData.length >= 66) {
                        try {
                          if (eventData.length >= 130) {
                            const sharesHex = eventData.slice(66, 130)
                            const shares = BigInt("0x" + sharesHex)
                            if (shares > BigInt(0)) {
                              actualSharesReceived = shares
                              console.log('Parsed shares (method 1):', shares.toString())
                              break
                            }
                          }
                          
                          if (eventData.length >= 66) {
                            const sharesHex = eventData.slice(2, 66)
                            const shares = BigInt("0x" + sharesHex)
                            if (shares > BigInt(0)) {
                              actualSharesReceived = shares
                              console.log('Parsed shares (method 2):', shares.toString())
                              break
                            }
                          }
                        } catch (parseError) {
                          console.log('Failed to parse event data:', parseError)
                        }
                      }
                      
                      if (log.topics.length >= 4) {
                        try {
                          const shares = log.topics[3] ? BigInt(log.topics[3]) : BigInt(0)
                          if (shares > BigInt(0)) {
                            actualSharesReceived = shares
                            console.log('Parsed shares (method 3):', shares.toString())
                            break
                          }
                        } catch (parseError) {
                          console.log('Failed to parse from topics:', parseError)
                        }
                      }
                    }
                  }
                }
              }
              
              if (actualSharesReceived === BigInt(0)) {
                throw new Error("Could not determine shares received from transaction logs. Deposit may have failed or event logs are not as expected.")
              }

              console.log('📊 Final shares calculation:', {
                actualSharesReceived: actualSharesReceived.toString(),
                type: typeof actualSharesReceived,
                isPositive: actualSharesReceived > BigInt(0)
              })
              
              // Convert shares from wei to human readable
              let sharesReceivedHuman: number
              try {
                const VAULT_DECIMALS = 18
                const divisor = BigInt("1000000000000000000") // 10^18 as BigInt literal

                const quotient = actualSharesReceived / divisor
                const remainder = actualSharesReceived % divisor

                const remainderStr = remainder.toString().padStart(VAULT_DECIMALS, '0')
                
                let fullNumberStr = `${quotient}.${remainderStr}`
                fullNumberStr = fullNumberStr.replace(/0+$/, '')
                if (fullNumberStr.endsWith('.')) {
                  fullNumberStr = fullNumberStr.slice(0, -1)
                }

                sharesReceivedHuman = parseFloat(fullNumberStr)

                console.log('💰 Human readable conversion:', {
                  actualSharesReceived: actualSharesReceived.toString(),
                  fullNumberStr,
                  result: sharesReceivedHuman
                })
                
                if (isNaN(sharesReceivedHuman)) {
                  throw new Error("Conversion to number resulted in NaN")
                }

              } catch (conversionError) {
                console.error('❌ Human readable conversion failed:', conversionError)
                throw new Error(`Failed to convert shares to human readable: ${conversionError instanceof Error ? conversionError.message : String(conversionError)}`)
              }
              
              // Step 3: Direct encrypted ERC deposit
              let encryptedDepositSuccess = false;
              let depositId: string | undefined; // Declare depositId here to be accessible in catch block
              try {
                setDepositStatus('depositing')
                setDepositMessage('Depositing vault shares into encrypted contract...')
                
                console.log('=== ENCRYPTED ERC DEPOSIT ===')
                console.log('Depositing shares into encrypted ERC:', actualSharesReceived.toString())
                
                // First, save the vault deposit to get a depositId
                if (!userData) {
                  throw new Error('User data not available')
                }
                
                const depositResponse = await fetch('/api/deposits', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    userId: userData.id,
                    wageGroupId: topUpWageGroup.id,
                    transactionHash: receipt.transactionHash,
                    usdcAmount: amount,
                    sharesReceived: sharesReceivedHuman,
                    yieldSource: topUpWageGroup.yieldSource,
                  }),
                })
                
                if (!depositResponse.ok) {
                  throw new Error('Failed to record deposit in database')
                }
                
                const depositData = await depositResponse.json()
                depositId = depositData.depositId
                
                // Get user's public key from Registrar contract
                const registrarContract = getContract({
                  client: thirdwebClient,
                  chain: avalancheFork,
                  address: ENCRYPTED_ERC_ADDRESSES.Registrar as `0x${string}`
                })
                
                // Check if user is registered for encrypted deposits
                const isRegistered = await readContract({
                  contract: registrarContract,
                  method: "function isUserRegistered(address user) view returns (bool)",
                  params: [activeAccount.address as `0x${string}`]
                })
                
                if (!isRegistered) {
                  console.log('⚠️ User not registered for encrypted deposits - skipping EERC integration')
                  
                  // Update deposit status to indicate no encrypted deposit
                  const updateResponse = await fetch('/api/deposits/update-status', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      depositId: depositId,
                      encryptedErcStatus: 'skipped_not_registered',
                      encryptedAmount: 0
                    }),
                  })

                  if (!updateResponse.ok) {
                    const errorText = await updateResponse.text()
                    console.error('Failed to update deposit status:', errorText)
                  }
                  
                  setDepositMessage(`Successfully deposited ${amount} USDC. (Encrypted deposit skipped)`)
                } else {
                  console.log('✅ User is registered - proceeding with encrypted deposit')
                  
                  // Get user's public key from Registrar contract
                  const userPublicKey = await readContract({
                    contract: registrarContract,
                    method: "function getUserPublicKey(address user) view returns (uint256[2])",
                    params: [activeAccount.address as `0x${string}`]
                  })
                  
                  console.log('🔑 User public key:', [userPublicKey[0].toString(), userPublicKey[1].toString()])
                  
                  // Generate amountPCT for auditing
                  console.log('🔐 Generating amountPCT for auditing...')
                  const depositAmountBigInt = actualSharesReceived
                  const publicKeyBigInt = [BigInt(userPublicKey[0].toString()), BigInt(userPublicKey[1].toString())]
                  
                  const {
                    ciphertext: amountCiphertext,
                    nonce: amountNonce,
                    authKey: amountAuthKey,
                  } = processPoseidonEncryption([depositAmountBigInt], publicKeyBigInt)
                  
                  // Format amountPCT as BigInt array (not string array)
                  const amountPCT = [
                    ...amountCiphertext,
                    ...amountAuthKey,
                    amountNonce
                  ] as [bigint, bigint, bigint, bigint, bigint, bigint, bigint]
                  
                  console.log('✅ AmountPCT generated successfully')
                  
                  // Get the encrypted ERC contract
                  const encryptedERCContract = getContract({
                    client: thirdwebClient,
                    chain: avalancheFork,
                    address: ENCRYPTED_ERC_ADDRESSES.EncryptedERC as `0x${string}`,
                    abi: ENCRYPTED_ERC_ABI // Add the ABI here
                  })
                  
                  // First approve the encrypted ERC contract to spend vault shares
                  console.log('🔓 Approving encrypted ERC contract to spend vault shares...')
                  const approveCall = prepareContractCall({
                    contract: vaultContract,
                    method: "function approve(address spender, uint256 amount) external returns (bool)",
                    params: [ENCRYPTED_ERC_ADDRESSES.EncryptedERC as `0x${string}`, actualSharesReceived]
                  })
                  
                  // Use the existing hook-based pattern
                  const approvePromise = new Promise((resolve, reject) => {
                    sendTransaction(approveCall, {
                      onSuccess: async (result) => {
                        try {
                          await waitForReceipt({
                            client: thirdwebClient,
                            chain: avalancheFork,
                            transactionHash: result.transactionHash
                          })
                          resolve(result)
                        } catch (error) {
                          reject(error)
                        }
                      },
                      onError: (error) => {
                        reject(error)
                      }
                    })
                  })

                  await approvePromise
                  console.log('✅ Approval confirmed')
                  
                  // Perform the encrypted deposit
                  console.log('💾 Depositing vault shares into EncryptedERC...')
                  const encryptedDepositCall = prepareContractCall({
                    contract: encryptedERCContract,
                    method: "function deposit(uint256 amount, address token, uint256[7] calldata amountPCT) external",
                    params: [
                      actualSharesReceived,
                      vaultContract.address as `0x${string}`,
                      amountPCT // Keep as BigInt array
                    ]
                  })
                  
                  // Use the existing hook-based pattern
                  const encryptedDepositPromise = new Promise((resolve, reject) => {
                    sendTransaction(encryptedDepositCall, {
                      onSuccess: async (result) => {
                        try {
                          const receipt = await waitForReceipt({
                            client: thirdwebClient,
                            chain: avalancheFork,
                            transactionHash: result.transactionHash
                          })
                          // Only pass the transaction result - don't try to pass depositId
                          resolve({ result })
                        } catch (error) {
                          reject(error)
                        }
                      },
                      onError: (error) => {
                        reject(error)
                      }
                    })
                  })

                  // Only destructure the result, not depositId
                  const { result: encryptedDepositResult } = await encryptedDepositPromise as any
                  console.log('✅ Encrypted deposit transaction confirmed')
                  console.log('🔍 Debug - Using depositId from database:', depositId)
                  console.log('🔍 Debug - Shares amount:', sharesReceivedHuman)
                  
                  // Update deposit status in database using the depositId from broader scope
                  const updateResponse = await fetch('/api/deposits/update-status', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      depositId: depositId, // Use the depositId from the database save operation
                      encryptedErcStatus: 'completed',
                      encryptedAmount: sharesReceivedHuman, // Make sure this is the correct shares amount
                      encryptedTxHash: encryptedDepositResult.transactionHash
                    }),
                  })

                  if (!updateResponse.ok) {
                    const errorText = await updateResponse.text()
                    console.error('Failed to update deposit status:', errorText)
                    console.error('🔍 Debug - depositId sent:', depositId)
                    console.error('🔍 Debug - encryptedAmount sent:', sharesReceivedHuman)
                  } else {
                    console.log('✅ Database update successful')
                  }
                  
                  encryptedDepositSuccess = true;
                  setDepositMessage(`Successfully deposited ${amount} USDC.`)
                }
                
              } catch (encryptedError: any) {
                console.error('❌ EERC integration failed:', encryptedError)
                const errorMessage = encryptedError instanceof Error ? encryptedError.message : String(encryptedError)
                
                // Still show success for vault deposit even if EERC fails
                setDepositMessage(`Successfully deposited ${amount} USDC. (Encrypted deposit failed)`)

                // Update deposit status to 'failed' in the database
                if (depositId) {
                  const updateResponse = await fetch('/api/deposits/update-status', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      depositId: depositId,
                      encryptedErcStatus: 'failed',
                      encryptedAmount: 0,
                      failureReason: errorMessage
                    }),
                  })

                  if (!updateResponse.ok) {
                    const errorText = await updateResponse.text()
                    console.error('Failed to update deposit status after EERC failure:', errorText)
                  }
                }
              }
              
              // Always show success for the vault deposit
              setDepositStatus('success')
              
              // Wait 3 seconds before closing dialog
              setTimeout(() => {
                setTopUpDialogOpen(false)
                setTopUpAmount('')
                setDepositStatus('idle')
                setDepositMessage('')
              }, 3000)
              
              fetchWageGroups()
              resolve(receipt)
              
            } catch (error) {
              setDepositStatus('error')
              const errorMessage = error instanceof Error ? error.message : String(error)
              setDepositMessage(`Deposit failed: ${errorMessage}`)
              console.error('❌ Deposit failed:', error)
              reject(error)
            }
          },
          onError: (error) => {
            setDepositStatus('error')
            const errorMessage = error instanceof Error ? error.message : String(error)
            setDepositMessage(`Deposit failed: ${errorMessage}`)
            console.error('❌ Deposit transaction failed:', error)
            reject(error)
          }
        })
      })

      await depositPromise
      
    } catch (error) {
      setDepositStatus('error')
      const errorMessage = error instanceof Error ? error.message : String(error)
      setDepositMessage(`Deposit failed: ${errorMessage}`)
      console.error('❌ Deposit process failed:', error)
    } finally {
      setIsDepositing(false)
      refetchBalance()
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-violet-50/20 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-purple-600">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-violet-50/20">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-purple-100/50 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-violet-600 bg-clip-text text-transparent">
              Dashboard
            </h1>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-purple-600/70">Welcome back!</span>
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center shadow-lg">
                <span className="text-white text-sm font-medium">
                  {userData?.firstName?.charAt(0) || userData?.email?.charAt(0) || "U"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* User Info Card */}
        <div className="mb-8">
          <UserInfoCard 
            userData={userData || {}}
            activeAccount={activeAccount}
            openEditDialog={openEditDialog}
            getDisplayName={getDisplayName}
          />
        </div>

        {/* Wage Payments Card */}
        <div className="mb-8">
          <WagePaymentsCard 
            wageGroups={wageGroups}
            openCreateDialog={openCreateDialog}
            openEditWageGroup={openEditWageGroup}
            openTopUpDialog={openTopUpDialog}
          />
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-gradient-to-br from-purple-50 to-violet-50/80 rounded-xl shadow-lg p-6 border border-purple-100/50 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                  <Users className="h-5 w-5 text-white" />
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-purple-600 truncate">
                    Total Employees
                  </dt>
                  <dd className="text-2xl font-bold text-purple-900">124</dd>
                </dl>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-violet-50 to-purple-50/80 rounded-xl shadow-lg p-6 border border-violet-100/50 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-violet-600 rounded-xl flex items-center justify-center shadow-lg">
                  <DollarSign className="h-5 w-5 text-white" />
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-violet-600 truncate">
                    Total Deposits
                  </dt>
                  <dd className="text-2xl font-bold text-violet-900">$2,345</dd>
                </dl>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-indigo-50 to-purple-50/80 rounded-xl shadow-lg p-6 border border-indigo-100/50 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                  <TrendingUp className="h-5 w-5 text-white" />
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-indigo-600 truncate">
                    Yield Earned
                  </dt>
                  <dd className="text-2xl font-bold text-indigo-900">$143.72</dd>
                </dl>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-100/80 to-violet-50 rounded-xl shadow-lg p-6 border border-purple-100/50 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-violet-600 rounded-xl flex items-center justify-center shadow-lg">
                  <Target className="h-5 w-5 text-white" />
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-purple-600 truncate">
                    Yield APY
                  </dt>
                  <dd className="text-2xl font-bold text-purple-900">13.2%</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Recent Activity */}
          <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-purple-100/50 hover:shadow-xl transition-all duration-300">
            <div className="px-6 py-4 border-b border-purple-100/50 bg-gradient-to-r from-purple-50/50 to-violet-50/50">
              <div className="flex items-center space-x-2">
                <Activity className="h-5 w-5 text-purple-600" />
                <h3 className="text-lg font-semibold text-purple-900">Recent Activity</h3>
              </div>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {[1, 2, 3, 4].map((item) => (
                  <div key={item} className="flex items-center space-x-3 p-3 rounded-lg bg-purple-50/30 hover:bg-purple-50/50 transition-colors duration-200">
                    <div className="h-3 w-3 bg-gradient-to-r from-purple-400 to-violet-500 rounded-full shadow-sm"></div>
                    <div className="flex-1">
                      <p className="text-sm text-gray-900 font-medium">
                        New worker registered: worker{item}@yourcompany.com
                      </p>
                      <p className="text-xs text-purple-600/70">2 hours ago</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-purple-100/50 hover:shadow-xl transition-all duration-300">
            <div className="px-6 py-4 border-b border-purple-100/50 bg-gradient-to-r from-purple-50/50 to-violet-50/50">
              <h3 className="text-lg font-semibold text-purple-900">Quick Actions</h3>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4">
                <button className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-purple-200 rounded-xl hover:border-purple-300 hover:bg-purple-50/30 transition-all duration-300 group">
                  <UserPlus className="h-8 w-8 text-purple-500 mb-3 group-hover:scale-110 transition-transform duration-200" />
                  <span className="text-sm font-semibold text-purple-700">Add User</span>
                </button>
                <button className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-purple-200 rounded-xl hover:border-purple-300 hover:bg-purple-50/30 transition-all duration-300 group">
                  <FileText className="h-8 w-8 text-purple-500 mb-3 group-hover:scale-110 transition-transform duration-200" />
                  <span className="text-sm font-semibold text-purple-700">New Report</span>
                </button>
                <button className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-purple-200 rounded-xl hover:border-purple-300 hover:bg-purple-50/30 transition-all duration-300 group">
                  <Settings className="h-8 w-8 text-purple-500 mb-3 group-hover:scale-110 transition-transform duration-200" />
                  <span className="text-sm font-semibold text-purple-700">Settings</span>
                </button>
                <button className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-purple-200 rounded-xl hover:border-purple-300 hover:bg-purple-50/30 transition-all duration-300 group">
                  <BarChart3 className="h-8 w-8 text-purple-500 mb-3 group-hover:scale-110 transition-transform duration-200" />
                  <span className="text-sm font-semibold text-purple-700">Analytics</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="mt-8 bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-purple-100/50 hover:shadow-xl transition-all duration-300">
          <div className="px-6 py-4 border-b border-purple-100/50 bg-gradient-to-r from-purple-50/50 to-violet-50/50">
            <div className="flex items-center space-x-2">
              <BarChart3 className="h-5 w-5 text-purple-600" />
              <h3 className="text-lg font-semibold text-purple-900">Data Overview</h3>
            </div>
          </div>
          <div className="p-6">
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-purple-100 to-violet-100 rounded-2xl flex items-center justify-center">
                <TrendingUp className="h-8 w-8 text-purple-500" />
              </div>
              <h3 className="text-xl font-semibold text-purple-900 mb-2">
                Charts and Analytics Coming Soon
              </h3>
              <p className="text-purple-600/70 max-w-md mx-auto">
                This section will display detailed analytics and data visualizations to help you track performance and make informed decisions.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Edit Name Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px] !bg-gradient-to-br !from-purple-50 !via-violet-50/50 !to-white border-purple-100/50">
          <DialogHeader>
            <DialogTitle className="text-purple-900">Edit Display Name</DialogTitle>
            <DialogDescription className="text-purple-600/70">
              Update your display name information.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="firstName" className="text-purple-700 font-medium">First Name</Label>
              <Input
                id="firstName"
                value={formData.firstName}
                onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                className="border-purple-200 focus:border-purple-400 focus:ring-purple-400"
              />
            </div>
            <div>
              <Label htmlFor="middleName" className="text-purple-700 font-medium">Middle Name</Label>
              <Input
                id="middleName"
                value={formData.middleName}
                onChange={(e) => setFormData(prev => ({ ...prev, middleName: e.target.value }))}
                className="border-purple-200 focus:border-purple-400 focus:ring-purple-400"
              />
            </div>
            <div>
              <Label htmlFor="lastName" className="text-purple-700 font-medium">Last Name</Label>
              <Input
                id="lastName"
                value={formData.lastName}
                onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                className="border-purple-200 focus:border-purple-400 focus:ring-purple-400"
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setEditDialogOpen(false)}
              className="border-purple-200 text-purple-700 hover:bg-purple-50"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleUpdateNames}
              disabled={updating}
              className="bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700 text-white"
            >
              {updating ? "Updating..." : "Update"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Wage Group Create Dialog */}
      <WageGroupCreateDialog
        open={wageDialogOpen}
        onOpenChange={setWageDialogOpen}
        onCreateWageGroup={handleCreateWageGroup}
        isCreating={creatingWageGroup}
      />

      {/* Edit Wage Group Dialog */}
      <Dialog open={editWageDialogOpen} onOpenChange={setEditWageDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto !bg-gradient-to-br !from-purple-50 !via-violet-50/50 !to-white border-purple-100/50">
          <DialogHeader>
            <DialogTitle className="text-purple-900">Edit Wage Group</DialogTitle>
            <DialogDescription className="text-purple-600/70">
              Update your wage group settings and payee information.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="editName" className="text-purple-700 font-medium">Group Name</Label>
                <Input
                  id="editName"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="border-purple-200 focus:border-purple-400 focus:ring-purple-400"
                  placeholder="Enter group name"
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="editStartDate" className="text-purple-700 font-medium">Start Date</Label>
                  <Input
                    id="editStartDate"
                    type="date"
                    value={editFormData.startDate}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, startDate: e.target.value }))}
                    className="border-purple-200 focus:border-purple-400 focus:ring-purple-400"
                  />
                </div>
                <div>
                  <Label htmlFor="editPaymentDate" className="text-purple-700 font-medium">Payment Date (Day of Month)</Label>
                  <Input
                    id="editPaymentDate"
                    type="number"
                    min="1"
                    max="31"
                    value={editFormData.paymentDate}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, paymentDate: e.target.value }))}
                    className="border-purple-200 focus:border-purple-400 focus:ring-purple-400"
                    placeholder="1-31"
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="editYieldSource" className="text-purple-700 font-medium">Yield Source</Label>
                <div className="mt-1">
                  <VaultSelector
                    selectedVault={editFormData.yieldSource}
                    onVaultSelect={(value: string) => setEditFormData(prev => ({ ...prev, yieldSource: value }))}
                  />
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <Label className="text-purple-700 font-medium">Payees</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addEditPayee}
                  className="border-purple-200 text-purple-700 hover:bg-purple-50"
                >
                  Add Payee
                </Button>
              </div>
              <div className="space-y-3 max-h-48 overflow-y-auto">
                {editFormData.payees.map((payee, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                    <div className="md:col-span-6">
                      <Label className="text-sm text-purple-600">Email</Label>
                      <Input
                        type="email"
                        value={payee.email}
                        onChange={(e) => updateEditPayee(index, 'email', e.target.value)}
                        className="border-purple-200 focus:border-purple-400 focus:ring-purple-400"
                        placeholder="payee@example.com"
                      />
                    </div>
                    <div className="md:col-span-4">
                      <Label className="text-sm text-purple-600">Monthly Amount (USDC)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={payee.monthlyAmount}
                        onChange={(e) => updateEditPayee(index, 'monthlyAmount', e.target.value)}
                        className="border-purple-200 focus:border-purple-400 focus:ring-purple-400"
                        placeholder="0.00"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeEditPayee(index)}
                        className="w-full border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
                        disabled={editFormData.payees.length === 1}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setEditWageDialogOpen(false)}
              className="border-purple-200 text-purple-700 hover:bg-purple-50"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleUpdateWageGroup}
              disabled={updatingWageGroup}
              className="bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700 text-white"
            >
              {updatingWageGroup ? "Updating..." : "Update Group"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Top-up Dialog */}
      <Dialog open={topUpDialogOpen} onOpenChange={setTopUpDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="bg-gradient-to-r from-purple-600 to-violet-600 bg-clip-text text-transparent">
              Top Up Wage Group
            </DialogTitle>
            <DialogDescription>
              Deposit USDC into the vault for this wage group.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="wageGroupName">Wage Group</Label>
              <div className="p-3 border rounded-md bg-gradient-to-r from-purple-50 to-violet-50 border-purple-200">
                {topUpWageGroup?.name || ""}
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="yieldSource">Yield Source</Label>
              <div className="p-3 border rounded-md bg-gradient-to-r from-purple-50 to-violet-50 border-purple-200">
                {topUpWageGroup?.yieldSource === "re7-labs" && "RE7 Labs"}
                {topUpWageGroup?.yieldSource === "k3-capital" && "K3 Capital"}
                {topUpWageGroup?.yieldSource === "mev-capital-avalanche" && "MEV Capital Avalanche"}
                {(!topUpWageGroup?.yieldSource || topUpWageGroup?.yieldSource === "none") && "No Yield Source"}
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="topUpAmount">Amount to Deposit (USDC)</Label>
              <Input
                id="topUpAmount"
                type="number"
                step="0.01"
                min="0"
                max={parseFloat(usdcBalance)}
                value={topUpAmount}
                onChange={(e) => setTopUpAmount(e.target.value)}
                placeholder="Enter amount"
                className="border-purple-200 focus:border-purple-400 focus:ring-purple-400"
                disabled={isDepositing}
              />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Wallet className="h-3 w-3" />
                  <span>Available: {usdcBalance} USDC</span>
                </div>
              </div>
            </div>
            
            {/* Status Message Display */}
            {depositStatus !== 'idle' && (
              <div className={`p-3 rounded-lg text-sm ${
                depositStatus === 'success' ? 'bg-green-50 text-green-700 border border-green-200' :
                depositStatus === 'error' ? 'bg-red-50 text-red-700 border border-red-200' :
                'bg-blue-50 text-blue-700 border border-blue-200'
              }`}>
                {depositStatus === 'approving' && (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {depositMessage}
                  </div>
                )}
                {depositStatus === 'depositing' && (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {depositMessage}
                  </div>
                )}
                {depositStatus === 'success' && (
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    {depositMessage}
                  </div>
                )}
                {depositStatus === 'error' && (
                  <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-red-600" />
                    {depositMessage}
                  </div>
                )}
              </div>
            )}

</div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setTopUpDialogOpen(false)
                setDepositStatus('idle')
                setDepositMessage('')
                setTopUpAmount('')
              }} 
              disabled={isDepositing}
              className="border-purple-200 text-purple-700 hover:bg-purple-50"
            >
              {depositStatus === 'success' ? 'Close' : 'Cancel'}
            </Button>
            {depositStatus !== 'success' && (
              <Button 
                onClick={handleDeposit} 
                disabled={isDepositing || !topUpAmount || parseFloat(topUpAmount) <= 0 || parseFloat(topUpAmount) > parseFloat(usdcBalance)}
                className="bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700 text-white"
              >
                {isDepositing ? "Processing..." : "Top Up"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}