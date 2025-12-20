pragma circom 2.1.8;

include "node_modules/circomlib/circuits/mimcsponge.circom";
include "node_modules/circomlib/circuits/bitify.circom";
include "node_modules/circomlib/circuits/comparators.circom";

/**
 * Dogenado Withdrawal Circuit
 * 
 * Proves knowledge of a deposit in the Merkle tree without revealing:
 * - Which deposit (leaf index)
 * - The secret values
 * - The sender address
 * 
 * Public inputs:
 * - root: Merkle tree root
 * - nullifierHash: Hash of nullifier (prevents double-spend)
 * - recipient: Address to receive funds
 * - relayer: Relayer address (or 0)
 * - fee: Relayer fee
 * - denomination: Pool denomination
 * 
 * Private inputs:
 * - secret: Random secret known only to depositor
 * - nullifier: Random nullifier used once
 * - pathElements: Merkle path siblings
 * - pathIndices: Merkle path direction bits
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

template CommitmentHasher() {
    signal input secret;
    signal input nullifier;
    signal output commitment;
    signal output nullifierHash;

    // commitment = MiMC(secret, nullifier)
    component commitmentHasher = MiMCHash();
    commitmentHasher.left <== secret;
    commitmentHasher.right <== nullifier;
    commitment <== commitmentHasher.hash;

    // nullifierHash = MiMC(nullifier, nullifier)
    component nullifierHasher = MiMCHash();
    nullifierHasher.left <== nullifier;
    nullifierHasher.right <== nullifier;
    nullifierHash <== nullifierHasher.hash;
}

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
        // Ensure pathIndices are binary
        pathIndices[i] * (1 - pathIndices[i]) === 0;

        hashers[i] = MiMCHash();
        
        // If pathIndices[i] == 0, current hash is on the left
        // If pathIndices[i] == 1, current hash is on the right
        lefts[i] <== hashes[i] + pathIndices[i] * (pathElements[i] - hashes[i]);
        rights[i] <== pathElements[i] + pathIndices[i] * (hashes[i] - pathElements[i]);
        
        hashers[i].left <== lefts[i];
        hashers[i].right <== rights[i];
        hashes[i + 1] <== hashers[i].hash;
    }

    // Verify computed root matches expected root
    root === hashes[levels];
}

template Withdraw(levels) {
    // Public inputs
    signal input root;
    signal input nullifierHash;
    signal input recipient;
    signal input relayer;
    signal input fee;
    signal input denomination;

    // Private inputs
    signal input secret;
    signal input nullifier;
    signal input pathElements[levels];
    signal input pathIndices[levels];

    // 1. Compute commitment and nullifier hash
    component hasher = CommitmentHasher();
    hasher.secret <== secret;
    hasher.nullifier <== nullifier;

    // 2. Verify nullifier hash matches public input
    hasher.nullifierHash === nullifierHash;

    // 3. Verify commitment exists in Merkle tree
    component tree = MerkleTreeChecker(levels);
    tree.leaf <== hasher.commitment;
    tree.root <== root;
    for (var i = 0; i < levels; i++) {
        tree.pathElements[i] <== pathElements[i];
        tree.pathIndices[i] <== pathIndices[i];
    }

    // 4. Bind public inputs to prevent front-running
    // Square to ensure non-zero constraint (prevents optimizer from removing)
    signal recipientSquare;
    recipientSquare <== recipient * recipient;

    signal relayerSquare;
    relayerSquare <== relayer * relayer;

    signal feeSquare;
    feeSquare <== fee * fee;

    signal denominationSquare;
    denominationSquare <== denomination * denomination;

    // 5. Ensure fee is less than denomination (prevents stealing)
    component feeCheck = LessThan(252);
    feeCheck.in[0] <== fee;
    feeCheck.in[1] <== denomination;
    feeCheck.out === 1;
}

// Main circuit with 20-level Merkle tree (~1M deposits)
component main {public [root, nullifierHash, recipient, relayer, fee, denomination]} = Withdraw(20);

