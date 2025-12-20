/**
 * Dogenado Relayer Service
 *
 * Submits withdrawal transactions on behalf of users.
 * - Pays gas fees (compensated via withdrawal fee)
 * - Never learns user secrets (proofs are opaque)
 * - Validates proofs before submission
 */
declare const app: import("express-serve-static-core").Express;
export { app };
