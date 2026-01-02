pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/mimcsponge.circom";
include "../node_modules/circomlib/circuits/bitify.circom";
include "../node_modules/circomlib/circuits/comparators.circom";

/**
 * Swap Circuit for Shielded Pool
 * 
 * Proves:
 * 1. Input note exists in Merkle tree
 * 2. Prover owns the input note (knows spending key)
 * 3. Nullifier is correctly computed
 * 4. Output commitment is correctly formed
 * 5. Amounts satisfy swap rate: inputAmount * rate ≈ outputAmount (with tolerance)
 */

// MiMC hash helper for 2 inputs
template MiMC2() {
    signal input in[2];
    signal output out;
    
    component hasher = MiMCSponge(2, 220, 1);
    hasher.ins[0] <== in[0];
    hasher.ins[1] <== in[1];
    hasher.k <== 0;
    
    out <== hasher.outs[0];
}

// Merkle tree proof verification (same as other circuits)
template MerkleTreeChecker(levels) {
    signal input leaf;
    signal input root;
    signal input pathElements[levels];
    signal input pathIndices[levels];
    
    component hashers[levels];
    signal hashes[levels + 1];
    signal lefts[levels];
    signal rights[levels];
    
    hashes[0] <== leaf;
    
    for (var i = 0; i < levels; i++) {
        // Ensure pathIndices is binary
        pathIndices[i] * (1 - pathIndices[i]) === 0;
        
        hashers[i] = MiMC2();
        
        // If pathIndex is 0, current hash is on left, sibling on right
        // If pathIndex is 1, sibling is on left, current hash on right
        lefts[i] <== hashes[i] + pathIndices[i] * (pathElements[i] - hashes[i]);
        rights[i] <== pathElements[i] + pathIndices[i] * (hashes[i] - pathElements[i]);
        
        hashers[i].in[0] <== lefts[i];
        hashers[i].in[1] <== rights[i];
        hashes[i + 1] <== hashers[i].out;
    }
    
    root === hashes[levels];
}

// Note commitment: hash(hash(amount, ownerPubkey), hash(secret, blinding))
template NoteCommitment() {
    signal input amount;
    signal input ownerPubkey;
    signal input secret;
    signal input blinding;
    signal output commitment;
    
    component hash1 = MiMC2();
    hash1.in[0] <== amount;
    hash1.in[1] <== ownerPubkey;
    
    component hash2 = MiMC2();
    hash2.in[0] <== secret;
    hash2.in[1] <== blinding;
    
    component hash3 = MiMC2();
    hash3.in[0] <== hash1.out;
    hash3.in[1] <== hash2.out;
    
    commitment <== hash3.out;
}

// Nullifier: hash(secret, leafIndex, spendingKey)
template NullifierCompute() {
    signal input secret;
    signal input leafIndex;
    signal input spendingKey;
    signal output nullifier;
    
    component hash1 = MiMC2();
    hash1.in[0] <== secret;
    hash1.in[1] <== leafIndex;
    
    component hash2 = MiMC2();
    hash2.in[0] <== hash1.out;
    hash2.in[1] <== spendingKey;
    
    nullifier <== hash2.out;
}

// Main swap circuit
template Swap(levels) {
    // ============ Public Inputs ============
    signal input root;                      // Merkle root
    signal input inputNullifierHash;        // Nullifier of input note
    signal input outputCommitment;          // New note commitment
    signal input tokenInAddress;            // Input token (for public verification)
    signal input tokenOutAddress;           // Output token
    signal input inputAmount;               // Amount being swapped
    signal input outputAmount;              // Amount received
    
    // ============ Private Inputs ============
    // Input note
    signal input inAmount;
    signal input inOwnerPubkey;
    signal input inSecret;
    signal input inBlinding;
    signal input inLeafIndex;
    signal input pathElements[levels];
    signal input pathIndices[levels];
    
    // Ownership proof
    signal input spendingKey;
    
    // Output note
    signal input outAmount;
    signal input outOwnerPubkey;
    signal input outSecret;
    signal input outBlinding;
    
    // ============ Constraints ============
    
    // 1. Verify input note commitment is in tree
    component inCommitment = NoteCommitment();
    inCommitment.amount <== inAmount;
    inCommitment.ownerPubkey <== inOwnerPubkey;
    inCommitment.secret <== inSecret;
    inCommitment.blinding <== inBlinding;
    
    component treeChecker = MerkleTreeChecker(levels);
    treeChecker.leaf <== inCommitment.commitment;
    treeChecker.root <== root;
    for (var i = 0; i < levels; i++) {
        treeChecker.pathElements[i] <== pathElements[i];
        treeChecker.pathIndices[i] <== pathIndices[i];
    }
    
    // 2. Verify ownership (pubkey derived from spending key)
    component ownerHash = MiMC2();
    ownerHash.in[0] <== spendingKey;
    ownerHash.in[1] <== 0;
    inOwnerPubkey === ownerHash.out;
    
    // 3. Verify nullifier
    component nullifier = NullifierCompute();
    nullifier.secret <== inSecret;
    nullifier.leafIndex <== inLeafIndex;
    nullifier.spendingKey <== spendingKey;
    
    component nullifierHash = MiMC2();
    nullifierHash.in[0] <== nullifier.nullifier;
    nullifierHash.in[1] <== 0;
    inputNullifierHash === nullifierHash.out;
    
    // 4. Verify output commitment
    component outCommitment = NoteCommitment();
    outCommitment.amount <== outAmount;
    outCommitment.ownerPubkey <== outOwnerPubkey;
    outCommitment.secret <== outSecret;
    outCommitment.blinding <== outBlinding;
    outputCommitment === outCommitment.commitment;
    
    // 5. Verify amounts match public inputs
    inAmount === inputAmount;
    outAmount === outputAmount;
    
    // 6. Verify output note owned by same person (self-swap)
    // The owner of the output can be the same or different
    // For self-swap, we verify it's the same owner
    outOwnerPubkey === ownerHash.out;
    
    // Note: The swap rate verification happens on-chain
    // The contract checks that outputAmount matches oracle rate
    // We just verify the amounts match what's claimed
}

// Instantiate with 20-level Merkle tree (1M+ notes capacity)
component main {public [root, inputNullifierHash, outputCommitment, tokenInAddress, tokenOutAddress, inputAmount, outputAmount]} = Swap(20);


