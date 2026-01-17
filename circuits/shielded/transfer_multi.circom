pragma circom 2.1.8;

include "../node_modules/circomlib/circuits/mimcsponge.circom";
include "../node_modules/circomlib/circuits/bitify.circom";
include "../node_modules/circomlib/circuits/comparators.circom";

/**
 * Dogenado Multi-Input Transfer Circuit (z→z with multiple inputs)
 * 
 * Enables true batch operations - spend multiple notes in ONE transaction
 * to create two output notes (recipient + change).
 * 
 * Proves that:
 * 1. Each USED input note exists in Merkle tree
 * 2. Prover owns each USED input note (has spending key)
 * 3. Each USED nullifier is correctly computed
 * 4. Output notes are correctly constructed
 * 5. Value is conserved: sum(used inputs) = output1 + output2 + fee
 * 
 * On-chain sees: roots[], nullifierHashes[], outputCommitment1, outputCommitment2, relayer, fee, numInputs
 * On-chain does NOT see: amounts, sender, recipient, note details
 * 
 * Example: Spend 3 notes (10+10+3 DOGE) to send 23 DOGE with change
 * 
 * IMPORTANT: Unused input slots (where index >= numInputs) should have:
 * - amount = 0
 * - All other values as dummy (they are masked out)
 */

template MiMCHash() {
    signal input left;
    signal input right;
    signal output hash;

    component hasher = MiMCSponge(2, 220, 1);
    hasher.ins[0] <== left;
    hasher.ins[1] <== right;
    hasher.k <== 0;
    hash <== hasher.outs[0];
}

/**
 * Compute note commitment
 */
template NoteCommitment() {
    signal input amount;
    signal input ownerPubkey;
    signal input secret;
    signal input blinding;
    signal output commitment;

    component leftHasher = MiMCHash();
    leftHasher.left <== amount;
    leftHasher.right <== ownerPubkey;

    component rightHasher = MiMCHash();
    rightHasher.left <== secret;
    rightHasher.right <== blinding;

    component commitmentHasher = MiMCHash();
    commitmentHasher.left <== leftHasher.hash;
    commitmentHasher.right <== rightHasher.hash;

    commitment <== commitmentHasher.hash;
}

/**
 * Compute nullifier
 */
template NullifierComputer() {
    signal input secret;
    signal input leafIndex;
    signal input spendingKey;
    signal output nullifier;

    component innerHash = MiMCHash();
    innerHash.left <== secret;
    innerHash.right <== leafIndex;

    component nullifierHash = MiMCHash();
    nullifierHash.left <== innerHash.hash;
    nullifierHash.right <== spendingKey;

    nullifier <== nullifierHash.hash;
}

/**
 * Derive shielded address from spending key
 */
template DeriveAddress() {
    signal input spendingKey;
    signal output shieldedAddress;

    component hasher = MiMCHash();
    hasher.left <== spendingKey;
    hasher.right <== 2;  // DOMAIN.SHIELDED_ADDRESS

    shieldedAddress <== hasher.hash;
}

/**
 * Merkle Tree Membership Checker
 */
template MerkleTreeChecker(levels) {
    signal input leaf;
    signal input root;
    signal input pathElements[levels];
    signal input pathIndices[levels];
    signal output computedRoot;

    component hashers[levels];
    signal hashes[levels + 1];
    signal lefts[levels];
    signal rights[levels];
    
    hashes[0] <== leaf;

    for (var i = 0; i < levels; i++) {
        pathIndices[i] * (1 - pathIndices[i]) === 0;

        hashers[i] = MiMCHash();
        
        lefts[i] <== hashes[i] + pathIndices[i] * (pathElements[i] - hashes[i]);
        rights[i] <== pathElements[i] + pathIndices[i] * (hashes[i] - pathElements[i]);
        
        hashers[i].left <== lefts[i];
        hashers[i].right <== rights[i];
        hashes[i + 1] <== hashers[i].hash;
    }

    computedRoot <== hashes[levels];
}

/**
 * Multi-Input Transfer Circuit
 * 
 * Public inputs:
 * - roots[maxInputs]: Merkle tree roots (one per input note, unused slots can be 0)
 * - nullifierHashes[maxInputs]: Hashes of spent notes' nullifiers (unused slots should be 0)
 * - outputCommitment1: New note for recipient
 * - outputCommitment2: Change note (back to sender)
 * - relayer: Relayer address (or 0 for direct)
 * - fee: Total relayer fee
 * - numInputs: Number of input notes being spent (2-maxInputs)
 * 
 * Private inputs (per input note):
 * - inputAmounts[maxInputs]: Amount in each input note (0 for unused)
 * - inputOwnerPubkeys[maxInputs]: Owner of each input note
 * - inputSecrets[maxInputs]: Secret for each input note
 * - inputBlindings[maxInputs]: Blinding factor for each input note
 * - inputLeafIndices[maxInputs]: Leaf index for each input note
 * - pathElements[maxInputs][levels]: Merkle paths for each input
 * - pathIndices[maxInputs][levels]: Path directions for each input
 * - spendingKey: Single spending key (owns all input notes)
 * 
 * Private inputs (output notes):
 * - output1Amount, output1OwnerPubkey, output1Secret, output1Blinding
 * - output2Amount, output2OwnerPubkey, output2Secret, output2Blinding
 */
template TransferMulti(levels, maxInputs) {
    // ============ PUBLIC INPUTS ============
    
    signal input roots[maxInputs];
    signal input nullifierHashes[maxInputs];
    signal input outputCommitment1;
    signal input outputCommitment2;
    signal input relayer;
    signal input fee;
    signal input numInputs;  // How many inputs are actually used (2 to maxInputs)

    // ============ PRIVATE INPUTS: Input Notes ============
    
    signal input inputAmounts[maxInputs];
    signal input inputOwnerPubkeys[maxInputs];
    signal input inputSecrets[maxInputs];
    signal input inputBlindings[maxInputs];
    signal input inputLeafIndices[maxInputs];
    signal input pathElements[maxInputs][levels];
    signal input pathIndices[maxInputs][levels];

    // ============ PRIVATE INPUT: Spending Authority ============
    
    signal input spendingKey;

    // ============ PRIVATE INPUTS: Output Notes ============
    
    signal input output1Amount;
    signal input output1OwnerPubkey;
    signal input output1Secret;
    signal input output1Blinding;

    signal input output2Amount;
    signal input output2OwnerPubkey;
    signal input output2Secret;
    signal input output2Blinding;

    // ============ DERIVE SHIELDED ADDRESS ============
    
    component deriveAddr = DeriveAddress();
    deriveAddr.spendingKey <== spendingKey;
    signal shieldedAddress;
    shieldedAddress <== deriveAddr.shieldedAddress;

    // ============ INPUT MASKS (1 if used, 0 if not) ============
    // We compute masks[i] = 1 if i < numInputs, else 0
    
    signal masks[maxInputs];
    component ltComps[maxInputs];
    
    for (var i = 0; i < maxInputs; i++) {
        ltComps[i] = LessThan(8);  // 8 bits enough for maxInputs=10
        ltComps[i].in[0] <== i;
        ltComps[i].in[1] <== numInputs;
        masks[i] <== ltComps[i].out;  // 1 if i < numInputs, else 0
    }

    // ============ PROCESS EACH INPUT NOTE ============
    
    component inputCommitments[maxInputs];
    component merkleCheckers[maxInputs];
    component nullifierComps[maxInputs];
    component nullifierHashers[maxInputs];
    
    // Track total input amount using intermediate signals
    signal partialSums[maxInputs + 1];
    partialSums[0] <== 0;
    
    for (var i = 0; i < maxInputs; i++) {
        // 1. Compute input note commitment
        inputCommitments[i] = NoteCommitment();
        inputCommitments[i].amount <== inputAmounts[i];
        inputCommitments[i].ownerPubkey <== inputOwnerPubkeys[i];
        inputCommitments[i].secret <== inputSecrets[i];
        inputCommitments[i].blinding <== inputBlindings[i];

        // 2. Compute Merkle root from provided path
        merkleCheckers[i] = MerkleTreeChecker(levels);
        merkleCheckers[i].leaf <== inputCommitments[i].commitment;
        merkleCheckers[i].root <== roots[i];
        for (var j = 0; j < levels; j++) {
            merkleCheckers[i].pathElements[j] <== pathElements[i][j];
            merkleCheckers[i].pathIndices[j] <== pathIndices[i][j];
        }

        // 3. Verify Merkle root matches (masked: only for used inputs)
        // mask * (providedRoot - computedRoot) === 0
        masks[i] * (roots[i] - merkleCheckers[i].computedRoot) === 0;

        // 4. Verify ownership (masked: only for used inputs)
        // mask * (inputOwnerPubkey - shieldedAddress) === 0
        masks[i] * (inputOwnerPubkeys[i] - shieldedAddress) === 0;

        // 5. Compute nullifier
        nullifierComps[i] = NullifierComputer();
        nullifierComps[i].secret <== inputSecrets[i];
        nullifierComps[i].leafIndex <== inputLeafIndices[i];
        nullifierComps[i].spendingKey <== spendingKey;

        // 6. Compute nullifier hash
        nullifierHashers[i] = MiMCHash();
        nullifierHashers[i].left <== nullifierComps[i].nullifier;
        nullifierHashers[i].right <== nullifierComps[i].nullifier;

        // 7. Verify nullifier hash matches (masked: only for used inputs)
        // mask * (providedHash - computedHash) === 0
        masks[i] * (nullifierHashes[i] - nullifierHashers[i].hash) === 0;
        
        // 8. Add to total (masked: unused inputs contribute 0)
        partialSums[i + 1] <== partialSums[i] + masks[i] * inputAmounts[i];
    }
    
    signal totalInputAmount;
    totalInputAmount <== partialSums[maxInputs];

    // ============ OUTPUT NOTES VERIFICATION ============

    // 9. Compute output commitment 1 (recipient)
    component outputComm1 = NoteCommitment();
    outputComm1.amount <== output1Amount;
    outputComm1.ownerPubkey <== output1OwnerPubkey;
    outputComm1.secret <== output1Secret;
    outputComm1.blinding <== output1Blinding;

    // 10. Verify output commitment 1 matches public input
    outputCommitment1 === outputComm1.commitment;

    // 11. Compute output commitment 2 (change)
    component outputComm2 = NoteCommitment();
    outputComm2.amount <== output2Amount;
    outputComm2.ownerPubkey <== output2OwnerPubkey;
    outputComm2.secret <== output2Secret;
    outputComm2.blinding <== output2Blinding;

    // 12. Verify output commitment 2 matches public input
    outputCommitment2 === outputComm2.commitment;

    // ============ VALUE CONSERVATION ============

    // 13. Verify value is conserved: sum(used inputs) = output1 + output2 + fee
    totalInputAmount === output1Amount + output2Amount + fee;

    // 14. Ensure output1 is non-zero (actual transfer)
    component out1Positive = IsZero();
    out1Positive.in <== output1Amount;
    out1Positive.out === 0;  // output1Amount != 0

    // 15. Verify numInputs is in valid range (2 to maxInputs)
    component numInputsMin = GreaterEqThan(8);
    numInputsMin.in[0] <== numInputs;
    numInputsMin.in[1] <== 2;
    numInputsMin.out === 1;
    
    component numInputsMax = LessEqThan(8);
    numInputsMax.in[0] <== numInputs;
    numInputsMax.in[1] <== maxInputs;
    numInputsMax.out === 1;

    // ============ BIND PUBLIC INPUTS ============

    // 16. Bind public inputs to prevent front-running
    signal relayerSquare;
    relayerSquare <== relayer * relayer;

    signal feeSquare;
    feeSquare <== fee * fee;

    signal out1Square;
    out1Square <== outputCommitment1 * outputCommitment1;

    signal out2Square;
    out2Square <== outputCommitment2 * outputCommitment2;
    
    signal numInputsSquare;
    numInputsSquare <== numInputs * numInputs;
}

// Main circuit with 20-level Merkle tree and up to 5 input notes
// Public inputs: roots, nullifierHashes, outputCommitment1, outputCommitment2, relayer, fee, numInputs
component main {public [roots, nullifierHashes, outputCommitment1, outputCommitment2, relayer, fee, numInputs]} = TransferMulti(20, 5);
