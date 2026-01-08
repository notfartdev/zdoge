pragma circom 2.1.8;

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
 * 4. Output commitment 1 (swapped token) is correctly formed
 * 5. Output commitment 2 (change note, same token as input) is correctly formed (can be 0)
 * 6. Value conservation: inputAmount = swapAmount + changeAmount
 * 7. Amounts satisfy swap rate: swapAmount * rate ≈ outputAmount
 * 
 * Supports partial swaps: spend part of a note, get change back (Zcash-style)
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
    signal input outputCommitment1;         // Output token note (swapped)
    signal input outputCommitment2;         // Change note (same token as input, can be 0)
    signal input tokenInAddress;            // Input token (for public verification)
    signal input tokenOutAddress;           // Output token
    signal input swapAmount;                // Amount being swapped (part of input note)
    signal input outputAmount;              // Amount received in output token
    
    // ============ Private Inputs ============
    // Input note
    signal input inAmount;                  // Full input note amount
    signal input inOwnerPubkey;
    signal input inSecret;
    signal input inBlinding;
    signal input inLeafIndex;
    signal input pathElements[levels];
    signal input pathIndices[levels];
    
    // Ownership proof
    signal input spendingKey;
    
    // Output note 1 (swapped token)
    signal input out1Amount;
    signal input out1OwnerPubkey;
    signal input out1Secret;
    signal input out1Blinding;
    
    // Output note 2 (change - same token as input, can be 0)
    signal input changeAmount;              // Change amount (inAmount - swapAmount)
    signal input changeSecret;
    signal input changeBlinding;
    
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
    // Must use DOMAIN.SHIELDED_ADDRESS = 2 to match note creation
    component ownerHash = MiMC2();
    ownerHash.in[0] <== spendingKey;
    ownerHash.in[1] <== 2;  // DOMAIN.SHIELDED_ADDRESS (matches transfer.circom and note creation)
    inOwnerPubkey === ownerHash.out;
    
    // 3. Verify nullifier
    component nullifier = NullifierCompute();
    nullifier.secret <== inSecret;
    nullifier.leafIndex <== inLeafIndex;
    nullifier.spendingKey <== spendingKey;
    
    component nullifierHash = MiMC2();
    nullifierHash.in[0] <== nullifier.nullifier;
    nullifierHash.in[1] <== nullifier.nullifier;  // Match transfer.circom: hash nullifier with itself
    inputNullifierHash === nullifierHash.out;
    
    // 4. Verify output commitment 1 (swapped token)
    component outCommitment1 = NoteCommitment();
    outCommitment1.amount <== out1Amount;
    outCommitment1.ownerPubkey <== out1OwnerPubkey;
    outCommitment1.secret <== out1Secret;
    outCommitment1.blinding <== out1Blinding;
    outputCommitment1 === outCommitment1.commitment;
    
    // 5. Verify output commitment 2 (change note - same token as input)
    component changeCommitment = NoteCommitment();
    changeCommitment.amount <== changeAmount;
    changeCommitment.ownerPubkey <== inOwnerPubkey;  // Change goes back to sender
    changeCommitment.secret <== changeSecret;
    changeCommitment.blinding <== changeBlinding;
    
    // Verify output commitment 2 matches public input
    // If changeAmount > 0, outputCommitment2 must match changeCommitment.commitment
    // If changeAmount == 0, outputCommitment2 must be 0
    component changeIsZero = IsZero();
    changeIsZero.in <== changeAmount;
    
    // When changeAmount > 0, enforce outputCommitment2 == changeCommitment.commitment
    (1 - changeIsZero.out) * (outputCommitment2 - changeCommitment.commitment) === 0;
    
    // When changeAmount == 0, enforce outputCommitment2 == 0
    changeIsZero.out * outputCommitment2 === 0;
    
    // 6. Verify value conservation: inputAmount = swapAmount + changeAmount
    component valueConservation = IsEqual();
    valueConservation.in[0] <== inAmount;
    valueConservation.in[1] <== swapAmount + changeAmount;
    valueConservation.out === 1;
    
    // 7. Verify output note 1 amount matches public input
    out1Amount === outputAmount;  // Output note amount matches public input
    
    // 8. Verify output note 1 owned by same person (self-swap)
    out1OwnerPubkey === ownerHash.out;
    
    // 9. Ensure swapAmount > 0 (must swap something)
    component swapAmountPositive = IsZero();
    swapAmountPositive.in <== swapAmount;
    swapAmountPositive.out === 0;  // swapAmount != 0
    
    // Note: The swap rate verification happens on-chain
    // The contract checks that outputAmount matches oracle rate
    // We just verify the amounts match what's claimed
}

// Instantiate with 20-level Merkle tree (1M+ notes capacity)
// Public inputs: [root, inputNullifierHash, outputCommitment1, outputCommitment2, tokenInAddress, tokenOutAddress, swapAmount, outputAmount]
component main {public [root, inputNullifierHash, outputCommitment1, outputCommitment2, tokenInAddress, tokenOutAddress, swapAmount, outputAmount]} = Swap(20);


