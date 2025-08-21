import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
  try {
    const {
      depositId,
      encryptedErcTxHash,
      encryptedErcStatus,
      encryptedAmount,
    } = await request.json()

    if (!depositId) {
      return NextResponse.json(
        { error: 'Deposit ID is required' },
        { status: 400 }
      )
    }

    const updatedDeposit = await prisma.deposit.update({
      where: { id: depositId },
      data: {
        encryptedErcTxHash,
        encryptedErcStatus,
        encryptedAmount: encryptedAmount, // Store as string or convert to Decimal if schema supports it
      },
    })

    return NextResponse.json(updatedDeposit)
  } catch (error) {
    console.error('Failed to update deposit status:', error)
    return NextResponse.json(
      { error: 'Failed to update deposit status' },
      { status: 500 }
    )
  }
}