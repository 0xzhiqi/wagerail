"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { EllipsisVertical, Receipt, FileText } from "lucide-react"

interface PayeeRecord {
  id: string
  monthlyAmount: number
  wageGroup: {
    id: string
    name: string
    paymentDate: number
  }
}

interface WageReceiptsCardProps {
  payeeRecords: PayeeRecord[]
  openPayeeWageDetails: (record: PayeeRecord) => void
}

export function WageReceiptsCard({ payeeRecords, openPayeeWageDetails }: WageReceiptsCardProps) {
  return (
    <Card className="bg-gradient-to-br from-purple-50 via-violet-50/50 to-white border-purple-100/50 shadow-lg hover:shadow-xl transition-all duration-300">
      <CardHeader className="bg-gradient-to-r from-purple-500/10 to-violet-500/10 border-b border-purple-100/50">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-violet-600 rounded-xl flex items-center justify-center shadow-lg">
            <Receipt className="w-6 h-6 text-white" />
          </div>
          <div>
            <CardTitle className="text-purple-900">Wage Receipts</CardTitle>
            <CardDescription className="text-purple-600/70">View payment history for your wage groups</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 p-6">
        {payeeRecords.length === 0 ? (
          <div className="bg-gradient-to-br from-purple-50 to-violet-50/80 rounded-xl p-8 border border-purple-100/50 text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-violet-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
              <FileText className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-purple-900 mb-2">
              No Payment Records Yet
            </h3>
            <p className="text-purple-600/70">
              You are not currently a payee in any wage groups.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-purple-50 to-violet-50/80 rounded-xl p-4 border border-purple-100/50">
              <p className="text-sm font-medium text-purple-700 mb-2">
                Your payment records
              </p>
              <div className="bg-white/80 backdrop-blur-sm rounded-lg border border-purple-100/50 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gradient-to-r from-purple-50/50 to-violet-50/50 border-purple-100/50">
                      <TableHead className="text-purple-700 font-semibold">Group Name</TableHead>
                      <TableHead className="text-purple-700 font-semibold">Monthly Amount</TableHead>
                      <TableHead className="text-purple-700 font-semibold">Payment Date</TableHead>
                      <TableHead className="w-[50px] text-purple-700 font-semibold">Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payeeRecords.map((record) => (
                      <TableRow key={record.id} className="hover:bg-purple-50/30 transition-colors duration-200">
                        <TableCell className="font-medium">
                          <div className="text-purple-900 font-semibold">{record.wageGroup.name}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-purple-900 font-medium">{record.monthlyAmount.toFixed(2)} USDC</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-purple-900">
                            {record.wageGroup.paymentDate}{record.wageGroup.paymentDate === 1 ? 'st' : record.wageGroup.paymentDate === 2 ? 'nd' : record.wageGroup.paymentDate === 3 ? 'rd' : 'th'} of each month
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openPayeeWageDetails(record)}
                            className="bg-white/80 border-purple-200 text-purple-700 hover:bg-purple-50 hover:border-purple-300 transition-all duration-200"
                          >
                            <EllipsisVertical className="h-4 w-4" />
                          </Button>
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