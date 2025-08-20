"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useActiveAccount, useConnect } from "thirdweb/react"
import { useRouter } from "next/navigation"
import { UserInfoCard } from "@/components/UserInfoCard"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Edit } from "lucide-react"

interface UserData {
  email?: string
  firstName?: string
  middleName?: string
  lastName?: string
  walletAddress?: string
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
        <DialogContent className="bg-violet-50 border-purple-200">
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
    </div>
  )
}