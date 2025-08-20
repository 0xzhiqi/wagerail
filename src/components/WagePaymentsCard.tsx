"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Edit, PaintBucket, Plus, Wallet, Coins } from "lucide-react"

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

interface WagePaymentsCardProps {
  wageGroups: WageGroup[]
  openCreateDialog: () => void
  openEditWageGroup: (group: WageGroup) => void
  openTopUpDialog: (group: WageGroup) => void
}

export function WagePaymentsCard({ 
  wageGroups, 
  openCreateDialog, 
  openEditWageGroup, 
  openTopUpDialog 
}: WagePaymentsCardProps) {
  return (
    <Card className="bg-gradient-to-br from-purple-50 via-violet-50/50 to-white border-purple-100/50 shadow-lg hover:shadow-xl transition-all duration-300">
      <CardHeader className="bg-gradient-to-r from-purple-500/10 to-violet-500/10 border-b border-purple-100/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-violet-600 rounded-xl flex items-center justify-center shadow-lg">
              <Wallet className="w-6 h-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-purple-900">Wage Payments</CardTitle>
              <CardDescription className="text-purple-600/70">Manage your wage groups and payments</CardDescription>
            </div>
          </div>
          <Button 
            onClick={openCreateDialog}
            className="bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700 text-white shadow-lg hover:shadow-xl transition-all duration-300"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Group
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 p-6">
        {wageGroups.length === 0 ? (
          <div className="bg-gradient-to-br from-purple-50 to-violet-50/80 rounded-xl p-8 border border-purple-100/50 text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-violet-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Coins className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-purple-900 mb-2">
              No Wage Groups Yet
            </h3>
            <p className="text-purple-600/70 mb-4">
              Create and manage wage payment groups with automated USDC distributions.
            </p>
            <Button 
              onClick={openCreateDialog}
              variant="outline"
              className="border-purple-200 text-purple-700 hover:bg-purple-50 hover:border-purple-300"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Group
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-purple-50 to-violet-50/80 rounded-xl p-4 border border-purple-100/50">
              <p className="text-sm font-medium text-purple-700 mb-2">
                Your wage groups ({wageGroups.length})
              </p>
              <div className="bg-white/80 backdrop-blur-sm rounded-lg border border-purple-100/50 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gradient-to-r from-purple-50/50 to-violet-50/50 border-purple-100/50">
                      <TableHead className="text-purple-700 font-semibold">Name</TableHead>
                      <TableHead className="hidden sm:table-cell text-purple-700 font-semibold">Status</TableHead>
                      <TableHead className="text-purple-700 font-semibold">Payees</TableHead>
                      <TableHead className="w-[120px] text-purple-700 font-semibold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {wageGroups.map((group) => (
                      <TableRow key={group.id} className="hover:bg-purple-50/30 transition-colors duration-200">
                        <TableCell className="font-medium">
                          <div>
                            <div className="text-purple-900 font-semibold">{group.name}</div>
                            <div className="text-xs text-purple-600/70 sm:hidden">
                              {group.isActive ? "Active" : "Inactive"}
                            </div>
                            <div className="text-xs text-purple-500/70 mt-1">
                              Payment on {group.paymentDate}{group.paymentDate === 1 ? 'st' : group.paymentDate === 2 ? 'nd' : group.paymentDate === 3 ? 'rd' : 'th'} of each month
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium shadow-sm ${
                            group.isActive
                              ? "bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 border border-green-200"
                              : "bg-gradient-to-r from-gray-100 to-slate-100 text-gray-700 border border-gray-200"
                          }`}>
                            {group.isActive ? "Active" : "Inactive"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div className="text-purple-900 font-medium">
                              {group.payees.length} payee{group.payees.length !== 1 ? 's' : ''}
                            </div>
                            <div className="text-xs text-purple-600/70">
                              {group.payees.filter(p => p.user).length} registered
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditWageGroup(group)}
                              className="bg-white/80 border-purple-200 text-purple-700 hover:bg-purple-50 hover:border-purple-300 transition-all duration-200"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openTopUpDialog(group)}
                              className="bg-white/80 border-purple-200 text-purple-700 hover:bg-purple-50 hover:border-purple-300 transition-all duration-200"
                            >
                              <PaintBucket className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}