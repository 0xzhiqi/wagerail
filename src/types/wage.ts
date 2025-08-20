export interface WageGroupForm {
  name: string
  startDate: string
  paymentDate: string
  yieldSource: string
  payees: Array<{
    email: string
    monthlyAmount: string
  }>
}

export interface WageGroup {
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

export interface Payee {
  email: string
  monthlyAmount: string
}