import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth()
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { depositId, encryptedErcTxHash } = await request.json()
    
    if (!depositId || !encryptedErcTxHash) {
      return NextResponse.json({ error: 'Missing depositId or transaction hash' }, { status: 400 })
    }

    // Update existing deposit record with encrypted ERC transaction hash
    const deposit = await prisma.deposit.update({
      where: { id: depositId },
      data: {
        encryptedErcTxHash: encryptedErcTxHash
      }
    })

    return NextResponse.json({ 
      success: true, 
      deposit 
    })
  } catch (error) {
    console.error('Failed to save encrypted ERC transaction hash:', error)
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}