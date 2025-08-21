"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { useSession } from "next-auth/react"
import { useActiveAccount, useReadContract, useSendTransaction } from "thirdweb/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { WageGroup } from "@/types/wage"
import { avalancheFork } from "@/config/chains"
import { CONTRACT_ADDRESSES, ENCRYPTED_ERC_ADDRESSES } from "@/config/contracts"
import { thirdwebClient } from "@/config/thirdweb-client"
import { prepareContractCall, getContract, waitForReceipt } from "thirdweb"
import { useEERC } from '@avalabs/eerc-sdk'
import { viemAdapter } from "thirdweb/adapters/viem"
import { wallet } from "@/config/wallet"
import { Loader2, CheckCircle, XCircle } from "lucide-react"
import { Toaster, toast } from "sonner"

interface TopUpDialogProps {
  isOpen: boolean
  onClose: () => void
  wageGroup: WageGroup | null
  onSuccess: () => void
}

export function TopUpDialog({ isOpen, onClose, wageGroup, onSuccess }: TopUpDialogProps) {
  const { data: session } = useSession()
  const activeAccount = useActiveAccount()

  const [topUpAmount, setTopUpAmount] = useState<string>('')
  const [isDepositing, setIsDepositing] = useState(false)
  const [usdcBalance, setUsdcBalance] = useState<string>("0")
  const [depositStatus, setDepositStatus] = useState<'idle' | 'approving' | 'depositing' | 'success' | 'error'>('idle')
  const [depositMessage, setDepositMessage] = useState<string>('')

  // Memoize client instances to prevent re-creation on every render
  const publicClient = useMemo(() => {
    return viemAdapter.publicClient.toViem({
      client: thirdwebClient,
      chain: avalancheFork as any,
    })
  }, [])

  const walletClient = useMemo(() => {
    if (!activeAccount) return undefined
    return viemAdapter.wallet.toViem({
      wallet: wallet,
      client: thirdwebClient,
      chain: avalancheFork as any,
    })
  }, [activeAccount])

  const vaultAddress = wageGroup?.yieldSource ? 
    (CONTRACT_ADDRESSES.VAULTS as any)[`VAULT_${
      wageGroup.yieldSource === "re7-labs" ? "1" :
      wageGroup.yieldSource === "k3-capital" ? "2" :
      wageGroup.yieldSource === "mev-capital-avalanche" ? "3" : ""
    }`] as `0x${string}` | undefined
    : undefined

  // Define proper circuit URLs structure
  const circuitURLs = {
    register: { wasm: 'https://eerc-circuits.avacloud.io/testnet/register.wasm', zkey: 'https://eerc-circuits.avacloud.io/testnet/register.zkey' },
    transfer: { wasm: 'https://eerc-circuits.avacloud.io/testnet/transfer.wasm', zkey: 'https://eerc-circuits.avacloud.io/testnet/transfer.zkey' },
    mint: { wasm: 'https://eerc-circuits.avacloud.io/testnet/mint.wasm', zkey: 'https://eerc-circuits.avacloud.io/testnet/mint.zkey' },
    withdraw: { wasm: 'https://eerc-circuits.avacloud.io/testnet/withdraw.wasm', zkey: 'https://eerc-circuits.avacloud.io/testnet/withdraw.zkey' },
    burn: { wasm: 'https://eerc-circuits.avacloud.io/testnet/burn.wasm', zkey: 'https://eerc-circuits.avacloud.io/testnet/burn.zkey' }
  }

  const eercHooks = useEERC(
    publicClient,
    walletClient!,
    ENCRYPTED_ERC_ADDRESSES.EncryptedERC as `0x${string}`,
    circuitURLs,
    undefined // decryptionKey
  )
  const { useEncryptedBalance } = eercHooks || { useEncryptedBalance: () => ({ deposit: undefined }) }
  const { deposit: depositToEERC } = useEncryptedBalance(vaultAddress)

  const { mutate: sendTransaction } = useSendTransaction()

  const usdcContract = getContract({
    address: CONTRACT_ADDRESSES.USDC as `0x${string}`,
    chain: avalancheFork,
    client: thirdwebClient
  })

  const { data: balanceData, refetch: refetchBalance } = useReadContract({
    contract: usdcContract,
    method: "function balanceOf(address account) view returns (uint256)",
    params: [activeAccount?.address || "0x0000000000000000000000000000000000000000"],
    queryOptions: { enabled: !!activeAccount && isOpen }
  })

  useEffect(() => {
    if (balanceData && activeAccount) {
      const balance = Number(balanceData) / 10**6
      setUsdcBalance(balance.toFixed(2))
    } else {
      setUsdcBalance("0")
    }
  }, [balanceData, activeAccount])

  useEffect(() => {
    if (isOpen) {
      // Reset state when dialog opens
      setTopUpAmount('')
      setDepositStatus('idle')
      setDepositMessage('')
      setIsDepositing(false)
      refetchBalance()
    }
  }, [isOpen, refetchBalance])

  const handleDeposit = async () => {
    if (!wageGroup || !wageGroup.yieldSource || !activeAccount || !session?.user?.id || !vaultAddress) {
      toast.error("Missing required information for deposit.")
      return
    }

    const amount = parseFloat(topUpAmount)
    if (isNaN(amount) || amount <= 0 || amount > parseFloat(usdcBalance)) {
      toast.error("Invalid amount entered.")
      return
    }

    setIsDepositing(true)
    setDepositStatus('approving')
    setDepositMessage('Preparing transaction...')
    const amountInWei = BigInt(Math.floor(amount * 10**6))

    try {
      // 1. Approve USDC transfer
      setDepositMessage('Approving USDC transfer...')
      const approvalTx = prepareContractCall({
        contract: usdcContract,
        method: "function approve(address spender, uint256 amount) returns (bool)",
        params: [vaultAddress, amountInWei]
      })
      const approvalReceipt = await new Promise<any>((resolve, reject) => {
        sendTransaction(approvalTx, { onSuccess: resolve, onError: reject })
      })
      await waitForReceipt({ client: thirdwebClient, chain: avalancheFork, transactionHash: approvalReceipt.transactionHash })
      toast.info("USDC spending approved.")

      // 2. Deposit USDC into Vault
      setDepositStatus('depositing')
      setDepositMessage('Depositing USDC into vault...')
      const vaultContract = getContract({ address: vaultAddress, chain: avalancheFork, client: thirdwebClient })
      const depositTx = prepareContractCall({
        contract: vaultContract,
        method: "function deposit(uint256 assets, address receiver) returns (uint256 shares)",
        params: [amountInWei, activeAccount.address as `0x${string}`]
      })
      const depositReceipt = await new Promise<any>((resolve, reject) => {
        sendTransaction(depositTx, { onSuccess: resolve, onError: reject })
      })
      const finalDepositReceipt = await waitForReceipt({ client: thirdwebClient, chain: avalancheFork, transactionHash: depositReceipt.transactionHash })
      toast.success("Successfully deposited to vault.")

      // 3. Parse shares from logs
      let actualSharesReceived = BigInt(0)
      const transferTopic = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
      for (const log of finalDepositReceipt.logs) {
        if (log.address.toLowerCase() === vaultAddress.toLowerCase() && log.topics[0] === transferTopic && log.topics[2]?.toLowerCase() === activeAccount.address.toLowerCase()) {
          actualSharesReceived = BigInt(log.data)
          break
        }
      }

      if (actualSharesReceived === BigInt(0)) throw new Error("Could not determine shares received from vault deposit.")
      toast.info(`Received ${actualSharesReceived.toString()} vault shares.`)

      // 4. Save initial deposit record to DB
      setDepositMessage('Saving deposit record...')
      const dbResponse = await fetch('/api/deposits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wageGroupId: wageGroup.id,
          amount: amount,
          vaultAddress: vaultAddress,
          shares: actualSharesReceived.toString(),
          status: 'pending_eerc_deposit',
          depositTxHash: finalDepositReceipt.transactionHash
        }),
      })
      if (!dbResponse.ok) throw new Error('Failed to save deposit record.')
      const { depositId } = await dbResponse.json()

      // 5. Approve Vault Shares for EERC
      setDepositMessage('Approving shares for encrypted deposit...')
      const shareApprovalTx = prepareContractCall({
        contract: vaultContract,
        method: "function approve(address spender, uint256 amount) returns (bool)",
        params: [ENCRYPTED_ERC_ADDRESSES.EncryptedERC as `0x${string}`, actualSharesReceived]
      })
      const shareApprovalReceipt = await new Promise<any>((resolve, reject) => {
        sendTransaction(shareApprovalTx, { onSuccess: resolve, onError: reject })
      })
      await waitForReceipt({ client: thirdwebClient, chain: avalancheFork, transactionHash: shareApprovalReceipt.transactionHash })
      toast.info("Vault shares approved for encrypted deposit.")

      // 6. Deposit shares into EERC
      setDepositMessage('Depositing shares into encrypted contract...')
      const eercDepositMessage = `Depositing ${actualSharesReceived} shares for ${session.user.email} into ${wageGroup.name}`
      const eercDepositResult = await depositToEERC(actualSharesReceived, eercDepositMessage)
      await waitForReceipt({ client: thirdwebClient, chain: avalancheFork, transactionHash: eercDepositResult.transactionHash })
      toast.success("Successfully deposited to encrypted contract.")

      // 7. Update deposit status in DB
      setDepositMessage('Finalizing...')
      await fetch(`/api/deposits/${depositId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed', eercDepositTxHash: eercDepositResult.transactionHash }),
      })

      setDepositStatus('success')
      setDepositMessage('Deposit successful!')
      toast.success("Top-up complete!")
      onSuccess()
      setTimeout(onClose, 2000)

    } catch (error: any) {
      console.error("Deposit failed:", error)
      setDepositStatus('error')
      const errorMessage = error.shortMessage || error.message || "An unknown error occurred."
      setDepositMessage(`Error: ${errorMessage}`)
      toast.error(errorMessage)
    } finally {
      setIsDepositing(false)
    }
  }

  const renderStatus = () => {
    if (depositStatus === 'idle') return null
    
    const icon = isDepositing ? <Loader2 className="animate-spin mr-2" /> :
                 depositStatus === 'success' ? <CheckCircle className="text-green-500 mr-2" /> :
                 depositStatus === 'error' ? <XCircle className="text-red-500 mr-2" /> : null

    return (
      <div className="mt-4 flex items-center justify-center text-sm">
        {icon}
        <span>{depositMessage}</span>
      </div>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Top Up: {wageGroup?.name}</DialogTitle>
          <DialogDescription>
            Deposit USDC into the {wageGroup?.yieldSource} vault.
            Your balance: ${usdcBalance} USDC
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="amount" className="text-right">
              Amount
            </Label>
            <Input
              id="amount"
              type="number"
              value={topUpAmount}
              onChange={(e) => setTopUpAmount(e.target.value)}
              className="col-span-3"
              placeholder="0.00"
              disabled={isDepositing}
            />
          </div>
        </div>
        {renderStatus()}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isDepositing}>Cancel</Button>
          <Button onClick={handleDeposit} disabled={isDepositing || !topUpAmount}>
            {isDepositing ? 'Depositing...' : 'Deposit'}
          </Button>
        </DialogFooter>
      </DialogContent>
      <Toaster />
    </Dialog>
  )
}