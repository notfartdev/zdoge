"use strict";
/**
 * MiMC Sponge Hash for Node.js backend
 *
 * Uses circomlibjs for exact compatibility with:
 * - The deployed HasherAdapter contract (which wraps circomlibjs bytecode)
 * - The Circom ZK circuits
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.mimcHash = mimcHash;
exports.getMimcHasher = getMimcHasher;
exports.toBytes32 = toBytes32;
exports.initMimc = initMimc;
const circomlibjs_1 = require("circomlibjs");
let mimcSponge = null;
let initPromise = null;
/**
 * Initialize MiMC hasher
 */
async function initMimc() {
    if (mimcSponge)
        return;
    if (initPromise) {
        await initPromise;
        return;
    }
    initPromise = (async () => {
        mimcSponge = await (0, circomlibjs_1.buildMimcSponge)();
        console.log('[MiMC] Initialized with circomlibjs');
    })();
    await initPromise;
}
/**
 * MiMC hash function compatible with Circom MiMCSponge(2, 220, 1)
 *
 * Uses multiHash which matches the circomlib MiMCSponge template:
 * - For 2 inputs: Feistel(ins[0], 0, k) -> then Feistel(xL + ins[1], xR, k)
 * - Returns final xL as output
 */
async function mimcHash(left, right) {
    await initMimc();
    const result = mimcSponge.multiHash([left, right]);
    return mimcSponge.F.toObject(result);
}
/**
 * Get initialized MiMC hasher for Merkle tree
 */
async function getMimcHasher() {
    await initMimc();
    return async (left, right) => {
        const result = mimcSponge.multiHash([left, right]);
        return mimcSponge.F.toObject(result);
    };
}
/**
 * Convert bigint to bytes32 hex string
 */
function toBytes32(value) {
    return '0x' + value.toString(16).padStart(64, '0');
}
