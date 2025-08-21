import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const address = searchParams.get('address')
    
    console.log('Registration status endpoint hit!')
    console.log('Received address:', address)
    
    if (!address) {
      return NextResponse.json({ error: 'Address parameter is required' }, { status: 400 })
    }

    // Use case-insensitive search for wallet addresses
    const user = await prisma.user.findFirst({
      where: {
        walletAddress: {
          equals: address,
          mode: 'insensitive'
        }
      },
      select: {
        encryptedErcRegistered: true,
        encryptedErcPublicKey: true,
        encryptedErcRegistrationTxHash: true,
      },
    })
    
    console.log('Database query result:', user)
    
    if (!user) {
      console.log('User not found in database')
      return NextResponse.json({
        registered: false,
        publicKey: null,
        registrationTxHash: null
      }, { status: 200 })
    }

    return NextResponse.json({
      registered: user.encryptedErcRegistered || false,
      publicKey: user.encryptedErcPublicKey,
      registrationTxHash: user.encryptedErcRegistrationTxHash,
    })
  } catch (error) {
    console.error('Error in registration-status API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}