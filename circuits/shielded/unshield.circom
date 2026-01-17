pragma circom 2.1.8;

include "../node_modules/circomlib/circuits/mimcsponge.circom";
include "../node_modules/circomlib/circuits/bitify.circom";
include "../node_modules/circomlib/circuits/comparators.circom";

/**
 * Dogenado Unshield Circuit (z→t)
 * 
 * Proves that:
 * 1. A note exists in the Merkle tree
 * 2. The prover owns the note (has spending key)
 * 3. The nullifier is correctly computed (prevents double-spend)
 * 4. The amount and recipient are bound to the proof
 * 
 * On-chain sees: root, nullifierHash, recipient, amount, relayer, fee
 * On-chain does NOT see: note details, spending key, which note was spent
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
 * N = MiMC(MiMC(secret, leafIndex), spendingKey)
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
 * addr = MiMC(spendingKey, DOMAIN.SHIELDED_ADDRESS)
 * DOMAIN.SHIELDED_ADDRESS = 2
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
 * Unshield Circuit (supports partial unshield with change)
 * 
 * Public inputs:
 * - root: Merkle tree root
 * - nullifierHash: Hash of nullifier (prevents double-spend)
 * - recipient: Public address to receive funds
 * - amount: Amount being withdrawn
 * - changeCommitment: Commitment of change note (0 if no change)
 * - relayer: Relayer address (or 0)
 * - fee: Relayer fee
 * 
 * Private inputs:
 * - noteAmount: Amount in the note
 * - ownerPubkey: Owner's shielded address
 * - secret: Note secret
 * - blinding: Note blinding factor
 * - leafIndex: Position in Merkle tree
 * - pathElements: Merkle path siblings
 * - pathIndices: Merkle path direction bits
 * - spendingKey: Owner's spending key (proves ownership)
 * - changeAmount: Amount returned as change (0 if no change)
 * - changeSecret: Change note secret
 * - changeBlinding: Change note blinding factor
 */
template Unshield(levels) {
    // Public inputs
    signal input root;
    signal input nullifierHash;
    signal input recipient;
    signal input amount;
    signal input changeCommitment;  // NEW: Change note commitment (can be 0)
    signal input relayer;
    signal input fee;

    // Private inputs (note details)
    signal input noteAmount;
    signal input ownerPubkey;
    signal input secret;
    signal input blinding;
    signal input leafIndex;
    signal input pathElements[levels];
    signal input pathIndices[levels];

    // Private input (spending authority)
    signal input spendingKey;
    
    // Private inputs (change note - NEW)
    signal input changeAmount;
    signal input changeSecret;
    signal input changeBlinding;

    // 1. Compute note commitment
    component noteCommitment = NoteCommitment();
    noteCommitment.amount <== noteAmount;
    noteCommitment.ownerPubkey <== ownerPubkey;
    noteCommitment.secret <== secret;
    noteCommitment.blinding <== blinding;

    // 2. Verify note is in Merkle tree
    component merkleChecker = MerkleTreeChecker(levels);
    merkleChecker.leaf <== noteCommitment.commitment;
    merkleChecker.root <== root;
    for (var i = 0; i < levels; i++) {
        merkleChecker.pathElements[i] <== pathElements[i];
        merkleChecker.pathIndices[i] <== pathIndices[i];
    }

    // 3. Verify ownership: derive address from spending key
    component deriveAddr = DeriveAddress();
    deriveAddr.spendingKey <== spendingKey;
    deriveAddr.shieldedAddress === ownerPubkey;  // Must match note owner

    // 4. Compute nullifier
    component nullifierComp = NullifierComputer();
    nullifierComp.secret <== secret;
    nullifierComp.leafIndex <== leafIndex;
    nullifierComp.spendingKey <== spendingKey;

    // 5. Compute nullifier hash
    component nullifierHasher = MiMCHash();
    nullifierHasher.left <== nullifierComp.nullifier;
    nullifierHasher.right <== nullifierComp.nullifier;

    // 6. Verify nullifier hash matches public input
    nullifierHash === nullifierHasher.hash;

    // 7. Compute change note commitment (if changeAmount > 0)
    component changeComm = NoteCommitment();
    changeComm.amount <== changeAmount;
    changeComm.ownerPubkey <== ownerPubkey;  // Change goes back to sender
    changeComm.secret <== changeSecret;
    changeComm.blinding <== changeBlinding;
    
    // 8. Verify change commitment matches public input (or is zero)
    component changeIsZero = IsZero();
    changeIsZero.in <== changeAmount;
    
    // When changeAmount > 0, enforce changeCommitment == changeComm.commitment
    (1 - changeIsZero.out) * (changeCommitment - changeComm.commitment) === 0;
    
    // When changeAmount == 0, enforce changeCommitment == 0
    changeIsZero.out * changeCommitment === 0;

    // 9. Verify value conservation
    // noteAmount = amount + changeAmount + fee
    component valueCheck = IsEqual();
    valueCheck.in[0] <== noteAmount;
    valueCheck.in[1] <== amount + changeAmount + fee;
    valueCheck.out === 1;

    // 10. Ensure fee is less than amount (prevent stealing via fee)
    component feeCheck = LessThan(252);
    feeCheck.in[0] <== fee;
    feeCheck.in[1] <== amount + 1;  // fee < amount + 1, i.e., fee <= amount
    feeCheck.out === 1;

    // 11. Bind public inputs to prevent front-running
    signal recipientSquare;
    recipientSquare <== recipient * recipient;

    signal relayerSquare;
    relayerSquare <== relayer * relayer;

    signal amountSquare;
    amountSquare <== amount * amount;
    
    signal changeSquare;
    changeSquare <== changeCommitment * changeCommitment;

    signal feeSquare;
    feeSquare <== fee * fee;
}

// Main circuit with 20-level Merkle tree (~1M deposits)
// Public inputs: [root, nullifierHash, recipient, amount, changeCommitment, relayer, fee] (7 inputs)
component main {public [root, nullifierHash, recipient, amount, changeCommitment, relayer, fee]} = Unshield(20);


