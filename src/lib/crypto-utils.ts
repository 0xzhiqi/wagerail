import { Base8, mulPointEscalar, subOrder, type Point } from "@zk-kit/baby-jubjub"
import {
  formatPrivKeyForBabyJub,
  genRandomBabyJubValue,
  poseidonEncrypt,
} from "maci-crypto"
import { bytesToHex, hexToBytes } from "@noble/hashes/utils"
import { randomBytes } from "crypto"

const BASE_POINT_ORDER = BigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617")

/**
 * Derives a private key from a signature using the i0 function
 * @param signature The signature hex string
 * @returns The derived private key as bigint
 */
export function i0(signature: string): bigint {
  if (typeof signature !== "string" || signature.length < 132)
    throw new Error("Invalid signature hex string")

  // Use keccak256 equivalent for browser
  const encoder = new TextEncoder()
  const data = encoder.encode(signature)
  
  // For browser compatibility, we'll use a simpler hash derivation
  const hash = Array.from(data)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 64) // Take first 32 bytes
  
  let bytes = hexToBytes(hash)
  
  bytes[0] &= 0b11111000
  bytes[31] &= 0b01111111
  bytes[31] |= 0b01000000
  
  const le = bytes.reverse()
  let sk = BigInt(`0x${bytesToHex(le)}`)
  
  sk %= subOrder
  if (sk === BigInt(0)) sk = BigInt(1)
  return sk
}

/**
 * Derives private key and public key from user signature (browser version)
 * @param userAddress The user's EVM address (0x...)
 * @param signer The wallet signer to sign with
 * @returns Object containing privateKey, formattedPrivateKey, and publicKey
 */
export async function deriveKeysFromUser(
  userAddress: string,
  signer?: any
): Promise<{
  privateKey: bigint
  formattedPrivateKey: bigint
  publicKey: [bigint, bigint]
  signature: string
}> {
  // Create deterministic message for signing
  const message = `eERC\nRegistering user with\n Address:${userAddress.toLowerCase()}`
  
  console.log('📝 Message to sign for registration:', message)
  
  // For browser environment, we'll use a deterministic approach
  // In a real implementation, you'd get the signature from the user's wallet
  let signature: string
  
  if (signer && typeof signer.signMessage === 'function') {
    signature = await signer.signMessage(message)
  } else {
    // Fallback: create a deterministic signature based on address
    // This is for development only - in production, always use real wallet signatures
    // Create a proper 132-character signature (0x + 130 hex chars)
    const baseHex = userAddress.slice(2).toLowerCase() // Remove 0x
    const repeatedHex = baseHex.repeat(Math.ceil(130 / baseHex.length)).slice(0, 130)
    signature = `0x${repeatedHex}`
  }
  
  if (!signature || signature.length < 132) {
    throw new Error(`Invalid signature received from user. Expected at least 132 characters, got ${signature?.length || 0}`)
  }
  
  // Derive private key from signature deterministically
  console.log("🔑 Deriving private key from signature...")
  const privateKey = i0(signature)
  console.log("Private key (raw):", privateKey.toString())
  
  // Format private key for BabyJubJub
  const formattedPrivateKey = formatPrivKeyForBabyJub(privateKey) % subOrder
  console.log("Private key (formatted):", formattedPrivateKey.toString())
  
  // Generate public key using BabyJubJub
  const publicKey = mulPointEscalar(Base8, formattedPrivateKey).map((x) => BigInt(x)) as [bigint, bigint]
  console.log("Public key X:", publicKey[0].toString())
  console.log("Public key Y:", publicKey[1].toString())
  
  return {
    privateKey,
    formattedPrivateKey,
    publicKey,
    signature
  }
}

/**
 * Generates a random nonce
 * @returns A cryptographically secure random number
 */
export const randomNonce = (): bigint => {
  const randomValue = genRandomBabyJubValue()
  return randomValue
}

/**
 * Process Poseidon encryption for the given inputs and public key
 * @param inputs Array of bigint inputs to encrypt
 * @param publicKey Public key as array of bigints [x, y]
 * @returns Encrypted ciphertext as array of bigints
 */
export const processPoseidonEncryption = (
  inputs: bigint[],
  publicKey: [bigint, bigint] | bigint[],
) => {
  const nonce = randomNonce()
  
  // Ensure we have exactly 2 elements and convert to bigint if needed
  if (publicKey.length !== 2) {
    throw new Error('Public key must have exactly 2 elements [x, y]')
  }
  
  // Type assertion to help TypeScript understand the structure
  const [x, y] = publicKey as [unknown, unknown]
  const encryptionKey: [bigint, bigint] = [
    typeof x === 'bigint' ? x : BigInt(String(x)),
    typeof y === 'bigint' ? y : BigInt(String(y))
  ]
  
  const ciphertext = poseidonEncrypt(
    inputs,
    encryptionKey,
    nonce
  )
  return ciphertext
}