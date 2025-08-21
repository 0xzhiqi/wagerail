import { CircuitZKit, Groth16Implementer } from "@solarity/zkit";

// Browser-compatible circuit configuration using HTTP URLs
const registrationConfig = {
  circuitName: "RegistrationCircuit",
  // Use HTTP URLs to access circuit artifacts via our API route
  circuitArtifactsPath: "/zkit/artifacts/circuits/registration.circom",
  verifierDirPath: "/contracts/verifiers",
};

const implementer = new Groth16Implementer();

// Create a lazy-loaded circuit to avoid initialization issues
let registrationCircuit: CircuitZKit<any> | null = null;

const initializeCircuit = async (): Promise<CircuitZKit<any>> => {
  if (registrationCircuit) {
    return registrationCircuit;
  }
  
  try {
    // Initialize with HTTP-based paths
    registrationCircuit = new CircuitZKit({
      ...registrationConfig,
      // Override internal file access to use fetch
      circuitArtifactsPath: "/zkit/artifacts/circuits/registration.circom",
    }, implementer);
    
    console.log('✅ Registration circuit initialized successfully');
    return registrationCircuit;
  } catch (error) {
    console.error('❌ Failed to initialize registration circuit:', error);
    throw error;
  }
};

export const getCircuit = async (name: string): Promise<CircuitZKit<any>> => {
  console.log(`🔧 Getting circuit: ${name}`);
  
  switch (name) {
    case "RegistrationCircuit":
    case "registration":
      return await initializeCircuit();
    default:
      throw new Error(`Circuit ${name} not found`);
  }
};

// Helper function to load circuit artifacts via HTTP
export const loadCircuitArtifacts = async (circuitName: string) => {
  const baseUrl = `/zkit/artifacts/circuits/registration.circom`;
  
  try {
    // Load the main artifacts file
    const artifactsResponse = await fetch(`${baseUrl}/${circuitName}_artifacts.json`);
    if (!artifactsResponse.ok) {
      throw new Error(`Failed to load artifacts: ${artifactsResponse.statusText}`);
    }
    const artifacts = await artifactsResponse.json();
    
    // Load the verification key
    const vkeyResponse = await fetch(`${baseUrl}/${circuitName}.groth16.vkey.json`);
    if (!vkeyResponse.ok) {
      throw new Error(`Failed to load verification key: ${vkeyResponse.statusText}`);
    }
    const vkey = await vkeyResponse.json();
    
    // Load the WASM file
    const wasmResponse = await fetch(`${baseUrl}/${circuitName}_js/${circuitName}.wasm`);
    if (!wasmResponse.ok) {
      throw new Error(`Failed to load WASM: ${wasmResponse.statusText}`);
    }
    const wasm = await wasmResponse.arrayBuffer();
    
    return { artifacts, vkey, wasm };
  } catch (error) {
    console.error('Error loading circuit artifacts:', error);
    throw error;
  }
};