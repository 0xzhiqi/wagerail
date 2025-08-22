"use client"

import { useState, useEffect } from "react"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { ExternalLink, TrendingUp } from "lucide-react"

interface VaultData {
  name: string
  description: string
  apy: number
  url: string | null
}

interface VaultSelectorProps {
  selectedVault: string
  onVaultSelect: (value: string) => void
}

export function VaultSelector({ selectedVault, onVaultSelect }: VaultSelectorProps) {
  const [vaultData, setVaultData] = useState<Record<string, VaultData>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Static vault information
  const vaultInfo = {
    "none": {
      name: "No Yield Source",
      description: "Standard payments without yield",
      url: null
    },
    "re7-labs": {
      name: "RE7 Labs",
      description: "Euler Finance vault",
      url: "https://app.euler.finance/vault/0x39dE0f00189306062D79eDEC6DcA5bb6bFd108f9?network=avalanche"
    },
    "k3-capital": {
      name: "K3 Capital",
      description: "Euler Finance vault",
      url: "https://app.euler.finance/vault/0x6fC9b3a52944A577cd8971Fd8fDE0819001bC595?network=avalanche"
    },
    "mev-capital-avalanche": {
      name: "MEV Capital",
      description: "Euler Finance vault",
      url: "https://app.euler.finance/vault/0x69B07dB605d0A08fbE9245c1466880AA36c8E1A7?network=avalanche"
    }
  }

  useEffect(() => {
    const fetchVaultData = async () => {
      try {
        setLoading(true)
        setError(null)
        
        // Fetch APY data for all vaults using POST endpoint
        const response = await fetch('/api/vault-apy', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        })
        
        if (!response.ok) {
          throw new Error(`Failed to fetch vault data: ${response.status}`)
        }
        
        const data = await response.json()
        
        // Transform the API response to match our component's expected format
        const transformedData: Record<string, VaultData> = {}
        
        // Add "none" option first
        transformedData["none"] = {
          name: vaultInfo["none"].name,
          description: vaultInfo["none"].description,
          apy: 0,
          url: vaultInfo["none"].url
        }
        
        // Add vault data with real APY
        if (data.vaults && Array.isArray(data.vaults)) {
          data.vaults.forEach((vault: any) => {
            if (vault.vaultId && vaultInfo[vault.vaultId as keyof typeof vaultInfo]) {
              const info = vaultInfo[vault.vaultId as keyof typeof vaultInfo]
              transformedData[vault.vaultId] = {
                name: info.name,
                description: info.description,
                apy: vault.apy || 0,
                url: info.url
              }
            }
          })
        }
        
        setVaultData(transformedData)
        
      } catch (error) {
        console.error('Error fetching vault data:', error)
        setError(error instanceof Error ? error.message : 'Failed to fetch vault data')
        
        // Fallback to static data without APY
        const fallbackData: Record<string, VaultData> = {}
        Object.entries(vaultInfo).forEach(([id, info]) => {
          fallbackData[id] = {
            name: info.name,
            description: info.description,
            apy: 0,
            url: info.url
          }
        })
        setVaultData(fallbackData)
        
      } finally {
        setLoading(false)
      }
    }

    fetchVaultData()
  }, [])

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="animate-pulse">
            <div className="h-16 bg-purple-100/50 rounded-lg"></div>
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-800 text-sm">Error loading vault data: {error}</p>
        <p className="text-red-600 text-xs mt-1">Using fallback data without real-time APY</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {Object.entries(vaultData).map(([id, vault]) => (
        <div 
          key={id} 
          className={`relative rounded-lg border transition-all duration-200 ${
            selectedVault === id 
              ? 'border-purple-300 bg-purple-50/80 shadow-sm' 
              : 'border-purple-100 bg-white/60 hover:border-purple-200 hover:bg-purple-50/40'
          }`}
        >
          <div className="flex items-center space-x-3 p-4">
            <input
              type="radio"
              id={id}
              name="vault"
              value={id}
              checked={selectedVault === id}
              onChange={(e) => onVaultSelect(e.target.value)}
              className="w-4 h-4 text-purple-600 border-purple-300 focus:ring-purple-500"
            />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <Label htmlFor={id} className="text-sm font-medium text-purple-900 cursor-pointer">
                  {vault.name}
                </Label>
                <div className="flex items-center space-x-2">
                  {vault.apy > 0 && (
                    <div className="flex items-center space-x-1 bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
                      <TrendingUp className="w-3 h-3" />
                      <span>{vault.apy.toFixed(2)}% APY</span>
                    </div>
                  )}
                  {vault.url && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-purple-600 hover:text-purple-800 hover:bg-purple-100"
                      onClick={(e) => {
                        e.preventDefault()
                        if (vault.url) {
                          window.open(vault.url, '_blank', 'noopener,noreferrer')
                        }
                      }}
                      title="View on Euler Finance"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </div>
              <p className="text-xs text-purple-600/70 mt-1">{vault.description}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}