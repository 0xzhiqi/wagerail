"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Edit, User } from "lucide-react"

interface UserData {
  email?: string
  firstName?: string
  middleName?: string
  lastName?: string
  walletAddress?: string
}

interface UserInfoCardProps {
  userData: UserData
  activeAccount: any
  openEditDialog: () => void
  getDisplayName: () => string
}

export function UserInfoCard({ userData, activeAccount, openEditDialog, getDisplayName }: UserInfoCardProps) {
  return (
    <Card className="bg-gradient-to-br from-purple-50 via-violet-50/50 to-white border-purple-100/50 shadow-lg hover:shadow-xl transition-all duration-300">
      <CardHeader className="bg-gradient-to-r from-purple-500/10 to-violet-500/10 border-b border-purple-100/50">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-violet-600 rounded-xl flex items-center justify-center shadow-lg">
            <User className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-purple-900">Account Information</CardTitle>
            <CardDescription className="text-purple-600/70">Your account details and settings</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 p-6">
        {/* Name Section - Moved to top */}
        <div className="bg-gradient-to-br from-purple-50 to-violet-50/80 rounded-xl p-4 border border-purple-100/50">
          <div className="flex items-center justify-between mb-2">
            <Label className="text-sm font-semibold text-purple-700 flex items-center space-x-2">
              <User className="w-4 h-4" />
              <span>Display Name</span>
            </Label>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={openEditDialog}
              className="bg-white/80 border-purple-200 text-purple-700 hover:bg-purple-50 hover:border-purple-300 transition-all duration-200"
            >
              <Edit className="w-3 h-3 mr-1" />
              Edit
            </Button>
          </div>
          <p className="text-lg font-medium text-purple-900">
            {getDisplayName() || "No name set"}
          </p>
        </div>
        
        <Separator className="bg-purple-100" />
        
        {/* Email Section */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold text-purple-700">Email Address</Label>
          <div className="bg-white/60 rounded-lg p-3 border border-purple-100/50">
            <p className="text-sm text-gray-900">{userData.email || "Not provided"}</p>
          </div>
        </div>
        
        <Separator className="bg-purple-100" />
        
        {/* Wallet Section - Simplified without connection status */}
        <div className="space-y-3">
          <Label className="text-sm font-semibold text-purple-700">Wallet Address</Label>
          <div className="bg-white/60 rounded-lg p-3 border border-purple-100/50">
            <p className="text-sm text-gray-900 break-all">
              {activeAccount?.address || "Not connected"}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}