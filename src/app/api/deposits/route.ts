import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const session = await auth()
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse request body
    const { userId, wageGroupId, transactionHash, usdcAmount, sharesReceived, yieldSource } = await req.json()

    // Validate request data
    if (!userId || !wageGroupId || !transactionHash || !usdcAmount || !sharesReceived || !yieldSource) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Verify that the user owns the wage group
    const wageGroup = await prisma.wageGroup.findUnique({
      where: {
        id: wageGroupId,
        userId: userId,
      },
    })

    if (!wageGroup) {
      return NextResponse.json({ error: 'Wage group not found or not owned by user' }, { status: 404 })
    }

    // Create deposit record
    const deposit = await prisma.deposit.create({
      data: {
        userId,
        wageGroupId,
        transactionHash,
        usdcAmount,
        sharesReceived,
        yieldSource,
      },
    })

    return NextResponse.json({ success: true, deposit }, { status: 201 })
  } catch (error) {
    console.error('Error creating deposit:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}