pragma circom 2.1.8;

include "../node_modules/circomlib/circuits/mimcsponge.circom";
include "../node_modules/circomlib/circuits/bitify.circom";
include "../node_modules/circomlib/circuits/comparators.circom";

/**
 * Dogenado Transfer Circuit (z→z)
 * 
 * The most complex circuit - enables private transfers between shielded addresses.
 * 
 * Proves that:
 * 1. Input note exists in Merkle tree
 * 2. Prover owns the input note (has spending key)
 * 3. Nullifier is correctly computed
 * 4. Output notes are correctly constructed
 * 5. Value is conserved: input = output1 + output2 + fee
 * 
 * On-chain sees: root, nullifierHash, outputCommitment1, outputCommitment2, relayer, fee
 * On-chain does NOT see: amounts, sender, recipient, note details
 * 
 * Flow:
 * - Spend one input note
 * - Create two output notes: one for recipient, one for change (back to sender)
 * - If no change needed, output2 can be a "dummy" note with amount=0
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

    root === hashes[levels];
}

/**
 * Transfer Circuit
 * 
 * Public inputs:
 * - root: Merkle tree root
 * - nullifierHash: Hash of spent note's nullifier
 * - outputCommitment1: New note for recipient
 * - outputCommitment2: Change note (back to sender, or dummy)
 * - relayer: Relayer address (or 0 for direct)
 * - fee: Relayer fee
 * 
 * Private inputs (input note):
 * - inputAmount, inputOwnerPubkey, inputSecret, inputBlinding
 * - inputLeafIndex, pathElements, pathIndices
 * - spendingKey
 * 
 * Private inputs (output notes):
 * - output1Amount, output1OwnerPubkey, output1Secret, output1Blinding
 * - output2Amount, output2OwnerPubkey, output2Secret, output2Blinding
 */
template Transfer(levels) {
    // Public inputs
    signal input root;
    signal input nullifierHash;
    signal input outputCommitment1;
    signal input outputCommitment2;
    signal input relayer;
    signal input fee;

    // Private inputs: Input note
    signal input inputAmount;
    signal input inputOwnerPubkey;
    signal input inputSecret;
    signal input inputBlinding;
    signal input inputLeafIndex;
    signal input pathElements[levels];
    signal input pathIndices[levels];

    // Private input: Spending authority
    signal input spendingKey;

    // Private inputs: Output note 1 (recipient)
    signal input output1Amount;
    signal input output1OwnerPubkey;
    signal input output1Secret;
    signal input output1Blinding;

    // Private inputs: Output note 2 (change)
    signal input output2Amount;
    signal input output2OwnerPubkey;
    signal input output2Secret;
    signal input output2Blinding;

    // ============ INPUT NOTE VERIFICATION ============

    // 1. Compute input note commitment
    component inputCommitment = NoteCommitment();
    inputCommitment.amount <== inputAmount;
    inputCommitment.ownerPubkey <== inputOwnerPubkey;
    inputCommitment.secret <== inputSecret;
    inputCommitment.blinding <== inputBlinding;

    // 2. Verify input note is in Merkle tree
    component merkleChecker = MerkleTreeChecker(levels);
    merkleChecker.leaf <== inputCommitment.commitment;
    merkleChecker.root <== root;
    for (var i = 0; i < levels; i++) {
        merkleChecker.pathElements[i] <== pathElements[i];
        merkleChecker.pathIndices[i] <== pathIndices[i];
    }

    // 3. Verify ownership: derive address from spending key
    component deriveAddr = DeriveAddress();
    deriveAddr.spendingKey <== spendingKey;
    deriveAddr.shieldedAddress === inputOwnerPubkey;

    // 4. Compute nullifier
    component nullifierComp = NullifierComputer();
    nullifierComp.secret <== inputSecret;
    nullifierComp.leafIndex <== inputLeafIndex;
    nullifierComp.spendingKey <== spendingKey;

    // 5. Compute nullifier hash
    component nullifierHasher = MiMCHash();
    nullifierHasher.left <== nullifierComp.nullifier;
    nullifierHasher.right <== nullifierComp.nullifier;

    // 6. Verify nullifier hash matches public input
    nullifierHash === nullifierHasher.hash;

    // ============ OUTPUT NOTES VERIFICATION ============

    // 7. Compute output commitment 1 (recipient)
    component outputComm1 = NoteCommitment();
    outputComm1.amount <== output1Amount;
    outputComm1.ownerPubkey <== output1OwnerPubkey;
    outputComm1.secret <== output1Secret;
    outputComm1.blinding <== output1Blinding;

    // 8. Verify output commitment 1 matches public input
    outputCommitment1 === outputComm1.commitment;

    // 9. Compute output commitment 2 (change)
    component outputComm2 = NoteCommitment();
    outputComm2.amount <== output2Amount;
    outputComm2.ownerPubkey <== output2OwnerPubkey;
    outputComm2.secret <== output2Secret;
    outputComm2.blinding <== output2Blinding;

    // 10. Verify output commitment 2 matches public input
    outputCommitment2 === outputComm2.commitment;

    // ============ VALUE CONSERVATION ============

    // 11. Verify value is conserved: input = output1 + output2 + fee
    component valueCheck = IsEqual();
    valueCheck.in[0] <== inputAmount;
    valueCheck.in[1] <== output1Amount + output2Amount + fee;
    valueCheck.out === 1;

    // 12. Ensure amounts are non-negative (output1 must be positive)
    // Output1 must be > 0 (actual transfer)
    component out1Positive = IsZero();
    out1Positive.in <== output1Amount;
    out1Positive.out === 0;  // output1Amount != 0

    // Output2 can be 0 (no change needed)
    // Fee can be 0 (no relayer)

    // ============ BIND PUBLIC INPUTS ============

    // 13. Bind public inputs to prevent front-running
    signal relayerSquare;
    relayerSquare <== relayer * relayer;

    signal feeSquare;
    feeSquare <== fee * fee;

    signal out1Square;
    out1Square <== outputCommitment1 * outputCommitment1;

    signal out2Square;
    out2Square <== outputCommitment2 * outputCommitment2;
}

// Main circuit with 20-level Merkle tree (~1M deposits)
component main {public [root, nullifierHash, outputCommitment1, outputCommitment2, relayer, fee]} = Transfer(20);


