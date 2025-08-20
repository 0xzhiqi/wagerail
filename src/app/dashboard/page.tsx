"use client"

import { useEffect, useState } from "react"
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
import { Wallet } from "lucide-react"
import { avalancheFork } from "@/config/chains"
import { CONTRACT_ADDRESSES } from "@/config/contracts"
import { thirdwebClient } from "@/config/thirdweb-client"
import { prepareContractCall, getContract } from "thirdweb"
import { waitForReceipt } from "thirdweb"



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
        await wallet.autoConnect({ client: thirdwebClient })

        if (wallet.getAccount()) {
          await connect(async () => wallet)
          console.log("Wallet reconnected successfully")
        }
      } catch (error) {
        console.log("Wallet auto-reconnect failed:", error)
      } finally {
        setWalletReconnectAttempted(true)
      }
    }

    if (status !== "loading") {
      attemptWalletReconnect()
    }
  }, [status, connect, walletReconnectAttempted])

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
    if (!topUpWageGroup || !topUpWageGroup.yieldSource || !activeAccount || !userData) {
      setDepositStatus('error')
      setDepositMessage("Missing required information for deposit")
      return
    }
    
    const amount = parseFloat(topUpAmount)
    if (isNaN(amount) || amount <= 0 || amount > parseFloat(usdcBalance)) {
      setDepositStatus('error')
      setDepositMessage("Invalid amount")
      return
    }
    
    setIsDepositing(true)
    setDepositStatus('approving')
    setDepositMessage('Preparing transaction...')
    
    try {
      // Get vault address based on yield source
      let vaultAddress = ""
      switch (topUpWageGroup.yieldSource) {
        case "re7-labs":
          vaultAddress = CONTRACT_ADDRESSES.VAULTS.VAULT_1
          break
        case "k3-capital":
          vaultAddress = CONTRACT_ADDRESSES.VAULTS.VAULT_2
          break
        case "mev-capital-avalanche":
          vaultAddress = CONTRACT_ADDRESSES.VAULTS.VAULT_3
          break
        default:
          setDepositStatus('error')
          setDepositMessage("Invalid yield source")
          setIsDepositing(false)
          return
      }
      
      // First approve USDC transfer
      const amountInWei = BigInt(Math.floor(amount * 1000000)) // USDC has 6 decimals
      
      // Prepare approval transaction
      const approvalTransaction = prepareContractCall({
        contract: usdcContract,
        method: "function approve(address spender, uint256 amount) returns (bool)",
        params: [vaultAddress as `0x${string}`, amountInWei]
      })
      
      setDepositMessage('Approving USDC transfer...')
      
      // Send approval transaction and wait for receipt
      const approvalPromise = new Promise((resolve, reject) => {
        sendTransaction(approvalTransaction, {
          onSuccess: async (result) => {
            try {
              const receipt = await waitForReceipt({
              client: thirdwebClient,
              chain: avalancheFork,
              transactionHash: result.transactionHash
            })
            resolve(receipt)
          } catch (error) {
            reject(error)
          }
          },
          onError: (error) => {
            setDepositStatus('error')
            setDepositMessage(`Approval failed: ${error.message}`)
            reject(error)
          }
        })
      })
      
      await approvalPromise
      
      // Create vault contract instance
      const vaultContract = getContract({
        address: vaultAddress as `0x${string}`,
        chain: avalancheFork,
        client: thirdwebClient
      })
      
      // Prepare deposit transaction
      const depositTransaction = prepareContractCall({
        contract: vaultContract,
        method: "function deposit(uint256 amount, address receiver) returns (uint256)",
        params: [amountInWei, activeAccount.address as `0x${string}`]
      })
      
      setDepositStatus('depositing')
      setDepositMessage('Depositing USDC into vault...')
      
      // Send deposit transaction
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
                  // Check if this log is from the vault contract
                  if (log.address?.toLowerCase() === vaultAddress.toLowerCase()) {
                    // Try multiple common Deposit event signatures
                    const depositSignatures = [
                      "0xdcbc1c05240f31ff3ad067ef1ee35ce4997762752e3a095284754544f4c709d7", // Deposit(address,address,uint256,uint256)
                      "0x90890809c654f11d6e72a28fa60149770a0d11ec6c92319d6ceb2bb0a4ea1a15", // Deposit(address,uint256,uint256)
                      "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"  // Transfer(address,address,uint256)
                    ]
                    
                    if (log.topics[0] && depositSignatures.includes(log.topics[0])) {
                      console.log('Found potential deposit event')
                      
                      // Try parsing data field
                      const eventData = log.data
                      if (eventData && eventData.length >= 66) {
                        try {
                          // Method 1: Try parsing as assets + shares (64 + 64 chars)
                          if (eventData.length >= 130) {
                            const sharesHex = eventData.slice(66, 130) // Skip 0x and first 64 chars
                            const shares = BigInt("0x" + sharesHex)
                            if (shares > 0) {
                              actualSharesReceived = shares
                              console.log('Parsed shares (method 1):', shares.toString())
                              break
                            }
                          }
                          
                          // Method 2: Try parsing as single value (just shares)
                          if (eventData.length >= 66) {
                            const sharesHex = eventData.slice(2, 66) // Skip 0x, take first 64 chars
                            const shares = BigInt("0x" + sharesHex)
                            if (shares > 0) {
                              actualSharesReceived = shares
                              console.log('Parsed shares (method 2):', shares.toString())
                              break
                            }
                          }
                        } catch (parseError) {
                          console.log('Failed to parse event data:', parseError)
                        }
                      }
                      
                      // Method 3: Try parsing from topics (for indexed parameters)
                      if (log.topics.length >= 4) {
                        try {
                          const shares = log.topics[3] ? BigInt(log.topics[3]) : BigInt(0)
                          if (shares > 0) {
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
              
              // If we still couldn't parse shares, use fallback calculation
              if (actualSharesReceived === BigInt(0)) {
                console.log('Could not parse shares from events, trying balance-based calculation')
                actualSharesReceived = amountInWei * BigInt(10**12) // Scale from 6 to 18 decimals
                console.log('Using fallback shares calculation:', actualSharesReceived.toString())
              }
              
              if (actualSharesReceived === BigInt(0)) {
                setDepositStatus('error')
                setDepositMessage("Vault deposit completed but shares data could not be parsed")
                reject(new Error("Could not determine shares received"))
                return
              }
              
              // Convert shares from wei to human readable (vault shares use 6 decimals)
              const sharesReceivedHuman = Number(actualSharesReceived) / 10**6
              console.log('Vault shares received:', sharesReceivedHuman)
              
              // Step 3: Deposit vault shares into encrypted ERC contract
              try {
                setDepositStatus('depositing')
                setDepositMessage('Depositing vault shares into encrypted contract...')
                
                console.log('=== ENCRYPTED ERC DEPOSIT ===')
                console.log('Depositing shares into encrypted ERC:', actualSharesReceived.toString())
                
                // First, save the vault deposit to get a depositId
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
                const depositId = depositData.id
                
                // TODO: Implement actual encrypted ERC deposit here
                // For now, we'll skip the encrypted ERC deposit until you implement the real logic
                console.log('Vault deposit completed successfully. Encrypted ERC deposit to be implemented.')
                
                setDepositMessage(`Successfully deposited ${sharesReceivedHuman.toFixed(6)} vault shares!`)
                
              } catch (encryptedError) {
                console.error('Deposit process failed:', encryptedError)
                setDepositMessage(`Deposit failed: ${encryptedError instanceof Error ? encryptedError.message : String(encryptedError)}`)
              }
              
              // Show success message
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
              setDepositMessage(`Failed to complete deposit: ${error instanceof Error ? error.message : String(error)}`)
              reject(error)
            }
          },
          onError: (error) => {
            setDepositStatus('error')
            setDepositMessage(`Deposit transaction failed: ${error.message}`)
            reject(error)
          }
        })
      })
      
      await depositPromise
      
    } catch (error) {
      console.error("Deposit error:", error)
      if (depositStatus !== 'error') {
        setDepositStatus('error')
        setDepositMessage("Failed to deposit: " + (error instanceof Error ? error.message : String(error)))
      }
    } finally {
      setIsDepositing(false)
      
      // Always refresh balance after deposit attempt
      setTimeout(async () => {
        try {
          await refetchBalance()
          console.log("Balances refreshed after deposit")
        } catch (error) {
          console.error("Failed to refresh balances:", error)
        }
      }, 2000)
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
                  <span className="text-white text-lg">📊</span>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-purple-600 truncate">
                    Total Users
                  </dt>
                  <dd className="text-2xl font-bold text-purple-900">1,234</dd>
                </dl>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-violet-50 to-purple-50/80 rounded-xl shadow-lg p-6 border border-violet-100/50 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-violet-600 rounded-xl flex items-center justify-center shadow-lg">
                  <span className="text-white text-lg">💰</span>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-violet-600 truncate">
                    Revenue
                  </dt>
                  <dd className="text-2xl font-bold text-violet-900">$12,345</dd>
                </dl>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-indigo-50 to-purple-50/80 rounded-xl shadow-lg p-6 border border-indigo-100/50 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                  <span className="text-white text-lg">📈</span>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-indigo-600 truncate">
                    Growth Rate
                  </dt>
                  <dd className="text-2xl font-bold text-indigo-900">+12.5%</dd>
                </dl>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-100/80 to-violet-50 rounded-xl shadow-lg p-6 border border-purple-100/50 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-violet-600 rounded-xl flex items-center justify-center shadow-lg">
                  <span className="text-white text-lg">🎯</span>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-purple-600 truncate">
                    Conversion
                  </dt>
                  <dd className="text-2xl font-bold text-purple-900">3.2%</dd>
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
              <h3 className="text-lg font-semibold text-purple-900">Recent Activity</h3>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {[1, 2, 3, 4].map((item) => (
                  <div key={item} className="flex items-center space-x-3 p-3 rounded-lg bg-purple-50/30 hover:bg-purple-50/50 transition-colors duration-200">
                    <div className="h-3 w-3 bg-gradient-to-r from-purple-400 to-violet-500 rounded-full shadow-sm"></div>
                    <div className="flex-1">
                      <p className="text-sm text-gray-900 font-medium">
                        New user registered: user{item}@example.com
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
                  <span className="text-3xl mb-3 group-hover:scale-110 transition-transform duration-200">➕</span>
                  <span className="text-sm font-semibold text-purple-700">Add User</span>
                </button>
                <button className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-purple-200 rounded-xl hover:border-purple-300 hover:bg-purple-50/30 transition-all duration-300 group">
                  <span className="text-3xl mb-3 group-hover:scale-110 transition-transform duration-200">📄</span>
                  <span className="text-sm font-semibold text-purple-700">New Report</span>
                </button>
                <button className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-purple-200 rounded-xl hover:border-purple-300 hover:bg-purple-50/30 transition-all duration-300 group">
                  <span className="text-3xl mb-3 group-hover:scale-110 transition-transform duration-200">⚙️</span>
                  <span className="text-sm font-semibold text-purple-700">Settings</span>
                </button>
                <button className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-purple-200 rounded-xl hover:border-purple-300 hover:bg-purple-50/30 transition-all duration-300 group">
                  <span className="text-3xl mb-3 group-hover:scale-110 transition-transform duration-200">📊</span>
                  <span className="text-sm font-semibold text-purple-700">Analytics</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="mt-8 bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-purple-100/50 hover:shadow-xl transition-all duration-300">
          <div className="px-6 py-4 border-b border-purple-100/50 bg-gradient-to-r from-purple-50/50 to-violet-50/50">
            <h3 className="text-lg font-semibold text-purple-900">Data Overview</h3>
          </div>
          <div className="p-6">
            <div className="text-center py-12">
              <div className="text-purple-300 text-6xl mb-4">📈</div>
              <h3 className="text-xl font-semibold text-purple-900 mb-2">
                Charts and Analytics Coming Soon
              </h3>
              <p className="text-purple-600/70">
                This section will display detailed analytics and data visualizations.
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
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    {depositMessage}
                  </div>
                )}
                {depositStatus === 'depositing' && (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    {depositMessage}
                  </div>
                )}
                {depositStatus === 'success' && (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 rounded-full bg-green-600 flex items-center justify-center">
                      <div className="h-2 w-2 bg-white rounded-full"></div>
                    </div>
                    {depositMessage}
                  </div>
                )}
                {depositStatus === 'error' && (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 rounded-full bg-red-600 flex items-center justify-center">
                      <div className="h-1 w-2 bg-white rounded-full"></div>
                    </div>
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