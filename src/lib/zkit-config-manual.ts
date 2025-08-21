import * as snarkjs from 'snarkjs';

// Manual circuit implementation for browser compatibility
class BrowserCircuitZKit {
  private circuitName: string;
  private artifacts: any = null;
  private vkey: any = null;
  private wasm: ArrayBuffer | null = null;

  constructor(circuitName: string) {
    this.circuitName = circuitName;
  }

  async initialize() {
    const baseUrl = `/zkit/artifacts/circuits/registration.circom`;
    
    try {
      // Load artifacts
      const artifactsResponse = await fetch(`${baseUrl}/${this.circuitName}_artifacts.json`);
      this.artifacts = await artifactsResponse.json();
      
      // Load verification key
      const vkeyResponse = await fetch(`${baseUrl}/${this.circuitName}.groth16.vkey.json`);
      this.vkey = await vkeyResponse.json();
      
      // Load WASM
      const wasmResponse = await fetch(`${baseUrl}/${this.circuitName}_js/${this.circuitName}.wasm`);
      this.wasm = await wasmResponse.arrayBuffer();
      
      console.log('✅ Circuit artifacts loaded successfully');
    } catch (error) {
      console.error('❌ Failed to load circuit artifacts:', error);
      throw error;
    }
  }

  async generateProof(input: any) {
    if (!this.wasm || !this.vkey) {
      await this.initialize();
    }

    try {
      // Load the zkey file
      const zkeyResponse = await fetch(`/zkit/artifacts/circuits/registration.circom/${this.circuitName}.groth16.zkey`);
      const zkeyBuffer = await zkeyResponse.arrayBuffer();
      
      // Generate the proof using snarkjs - convert ArrayBuffer to Uint8Array
      if (!this.wasm) {
        throw new Error('WASM not loaded');
      }
      
      const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        input,
        new Uint8Array(this.wasm), // Convert ArrayBuffer to Uint8Array
        new Uint8Array(zkeyBuffer)
      );
      
      return { proof, publicSignals };
    } catch (error) {
      console.error('Error generating proof:', error);
      throw error;
    }
  }

  async generateCalldata(proof: any, publicSignals: any) {
    try {
      // Use snarkjs to generate the raw calldata components
      const solidityCalldata = await snarkjs.groth16.exportSolidityCallData(proof, publicSignals);
      
      // Parse the comma-separated values
      const calldataArray = JSON.parse(`[${solidityCalldata}]`);
      const [a, b, c, ...inputs] = calldataArray;
      
      // Convert to the format expected by your contract
      const proofData = {
        a: [a[0], a[1]],
        b: [[b[0][0], b[0][1]], [b[1][0], b[1][1]]],
        c: [c[0], c[1]],
        inputs: inputs
      };
      
      console.log('Proof data for contract:', proofData);
      
      // Return with calldata wrapper to match current usage
      return {
        calldata: proofData,
        registrationHash: publicSignals[0] // Assuming first public signal is the registration hash
      };
    } catch (error) {
      console.error('Error generating calldata:', error);
      throw error;
    }
  }
}

// Export the manual implementation
export const getCircuit = async (name: string) => {
  switch (name) {
    case "RegistrationCircuit":
    case "registration":
      return new BrowserCircuitZKit("RegistrationCircuit");
    default:
      throw new Error(`Circuit ${name} not found`);
  }
};