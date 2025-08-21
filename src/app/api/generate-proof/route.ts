import { NextRequest, NextResponse } from 'next/server'
import { getCircuit } from '@/lib/zkit-config'
import { poseidon3 } from 'poseidon-lite'

export async function POST(request: NextRequest) {
  console.log('🔄 Starting proof generation...')
  
  try {
    const { privateKey, userAddress, chainId, publicKeyX, publicKeyY } = await request.json()
    console.log('📝 Received inputs:', { 
      privateKey: privateKey.substring(0, 10) + '...', 
      userAddress, 
      chainId,
      publicKeyX: publicKeyX.substring(0, 10) + '...',
      publicKeyY: publicKeyY.substring(0, 10) + '...'
    })
    
    // Create registration hash using Poseidon (matching reference3.txt)
    console.log('🔢 Computing Poseidon hash...')
    const registrationHash = poseidon3([
      BigInt(chainId),
      BigInt(privateKey), 
      BigInt(userAddress)
    ])
    console.log('✅ Registration hash computed:', registrationHash.toString().substring(0, 20) + '...')
    
    // Get the registration circuit
    console.log('🔧 Loading circuit...')
    const circuit = await getCircuit("RegistrationCircuit")
    console.log('✅ Circuit loaded successfully')
    
    // Prepare circuit inputs matching reference3.txt structure
    const circuitInputs = {
      SenderPrivateKey: BigInt(privateKey),
      SenderPublicKey: [BigInt(publicKeyX), BigInt(publicKeyY)],
      SenderAddress: BigInt(userAddress),
      ChainID: BigInt(chainId),
      RegistrationHash: registrationHash,
    }
    console.log('📋 Circuit inputs prepared')
    
    // Generate proof with shorter timeout since circuit is simpler
    console.log('⚡ Generating proof... (should be fast now)')
    const proofPromise = circuit.generateProof(circuitInputs)
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Proof generation timeout after 30 seconds')), 30000) // 30 seconds
    )
    
    const { proof, publicSignals } = await Promise.race([proofPromise, timeoutPromise]) as any
    console.log('✅ Proof generated successfully')
    
    return NextResponse.json({
      proof,
      publicSignals,
      registrationHash: registrationHash.toString(),
    })
  } catch (error) {
    console.error('❌ Error generating proof:', error)
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace')
    
    return NextResponse.json(
      { 
        error: 'Failed to generate proof',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}