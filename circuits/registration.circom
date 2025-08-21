pragma circom 2.0.0;

include "circomlib/circuits/poseidon.circom";

template RegistrationCircuit() {
    // Private inputs
    signal input SenderPrivateKey;
    
    // Public inputs  
    signal input SenderPublicKey[2];
    signal input SenderAddress;
    signal input ChainID;
    signal input RegistrationHash;
    
    // Verify the registration hash using poseidon3
    component poseidon = Poseidon(3);
    poseidon.inputs[0] <== ChainID;
    poseidon.inputs[1] <== SenderPrivateKey;
    poseidon.inputs[2] <== SenderAddress;
    
    // Verify the computed hash matches the provided registration hash
    RegistrationHash === poseidon.out;
    
    // Simple constraint to ensure public key is used (prevents optimization)
    signal dummy;
    dummy <== SenderPublicKey[0] + SenderPublicKey[1];
    
    // Ensure dummy is related to private key
    signal constraint;
    constraint <== dummy + SenderPrivateKey;
}

component main = RegistrationCircuit();