import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getContract, prepareContractCall, sendTransaction } from 'thirdweb'
import { avalancheFork } from '@/config/chains'
import { thirdwebClient } from '@/config/thirdweb-client'
import { ENCRYPTED_ERC_ADDRESSES } from '@/config/contracts'

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth()
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { publicKey, registrationProof, walletAddress, registrationTxHash } = await request.json()
    
    if (!publicKey || !registrationProof || !walletAddress) {
      return NextResponse.json({ 
        error: 'Missing required fields: publicKey, registrationProof, walletAddress' 
      }, { status: 400 })
    }

    // Remove the database check - let blockchain be the source of truth
    // Update user record with registration data
    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        encryptedErcPublicKey: publicKey,
        encryptedErcRegistered: true,
        encryptedErcRegistrationTxHash: registrationTxHash || '',
        walletAddress: walletAddress
      }
    })

    return NextResponse.json({ 
      success: true, 
      message: 'Registration data saved successfully',
      user: {
        id: updatedUser.id,
        encryptedErcRegistered: updatedUser.encryptedErcRegistered,
        encryptedErcPublicKey: updatedUser.encryptedErcPublicKey
      }
    })
  } catch (error) {
    console.error('Failed to register user for encrypted ERC:', error)
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

export async function GET() {
  try {
    const session = await auth()
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        encryptedErcRegistered: true,
        encryptedErcPublicKey: true,
        encryptedErcRegistrationTxHash: true
      }
    })

    return NextResponse.json({
      registered: user?.encryptedErcRegistered || false,
      publicKey: user?.encryptedErcPublicKey,
      registrationTxHash: user?.encryptedErcRegistrationTxHash
    })
  } catch (error) {
    console.error('Failed to get registration status:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth()
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { registrationTxHash } = await request.json()
    
    if (!registrationTxHash) {
      return NextResponse.json({ 
        error: 'Missing registrationTxHash' 
      }, { status: 400 })
    }

    // Update user record with transaction hash
    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        encryptedErcRegistrationTxHash: registrationTxHash
      }
    })

    return NextResponse.json({ 
      success: true, 
      message: 'Registration transaction hash updated successfully',
      registrationTxHash: updatedUser.encryptedErcRegistrationTxHash
    })
  } catch (error) {
    console.error('Failed to update registration transaction hash:', error)
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}