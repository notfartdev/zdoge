pragma circom 2.1.8;

include "../node_modules/circomlib/circuits/mimcsponge.circom";
include "../node_modules/circomlib/circuits/bitify.circom";
include "../node_modules/circomlib/circuits/comparators.circom";

/**
 * Dogenado Shield Circuit (t→z)
 * 
 * Proves that a commitment was correctly constructed from:
 * - amount (public, matches deposit amount)
 * - ownerPubkey (private, recipient's shielded address)
 * - secret (private, random)
 * - blinding (private, random)
 * 
 * On-chain sees: commitment, amount
 * On-chain does NOT see: ownerPubkey, secret, blinding
 * 
 * This is simpler than transfer/unshield because we're not
 * proving ownership of an existing note.
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
 * C = MiMC(MiMC(amount, ownerPubkey), MiMC(secret, blinding))
 */
template NoteCommitment() {
    signal input amount;
    signal input ownerPubkey;
    signal input secret;
    signal input blinding;
    signal output commitment;

    // Hash amount and owner
    component leftHasher = MiMCHash();
    leftHasher.left <== amount;
    leftHasher.right <== ownerPubkey;

    // Hash secret and blinding
    component rightHasher = MiMCHash();
    rightHasher.left <== secret;
    rightHasher.right <== blinding;

    // Final commitment
    component commitmentHasher = MiMCHash();
    commitmentHasher.left <== leftHasher.hash;
    commitmentHasher.right <== rightHasher.hash;

    commitment <== commitmentHasher.hash;
}

/**
 * Shield Circuit
 * 
 * Public inputs:
 * - commitment: The note commitment to be added to Merkle tree
 * - amount: The amount being shielded (must match deposit value)
 * 
 * Private inputs:
 * - ownerPubkey: Recipient's shielded address
 * - secret: Random secret
 * - blinding: Random blinding factor
 */
template Shield() {
    // Public inputs
    signal input commitment;
    signal input amount;

    // Private inputs
    signal input ownerPubkey;
    signal input secret;
    signal input blinding;

    // 1. Compute commitment from inputs
    component noteCommitment = NoteCommitment();
    noteCommitment.amount <== amount;
    noteCommitment.ownerPubkey <== ownerPubkey;
    noteCommitment.secret <== secret;
    noteCommitment.blinding <== blinding;

    // 2. Verify computed commitment matches public input
    commitment === noteCommitment.commitment;

    // 3. Ensure amount is positive (non-zero)
    component isZero = IsZero();
    isZero.in <== amount;
    isZero.out === 0;  // amount != 0

    // 4. Bind public inputs (prevent optimizer from removing constraints)
    signal amountSquare;
    amountSquare <== amount * amount;

    signal commitmentSquare;
    commitmentSquare <== commitment * commitment;
}

component main {public [commitment, amount]} = Shield();


