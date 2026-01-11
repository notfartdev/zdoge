/**
 * Structured Error Schema
 * 
 * Provides consistent error codes and user-friendly messages
 */

export enum ErrorCode {
  // Proof errors
  INVALID_PROOF = 'INVALID_PROOF',
  PROOF_FORMAT_ERROR = 'PROOF_FORMAT_ERROR',
  
  // Nullifier errors
  NULLIFIER_SPENT = 'NULLIFIER_SPENT',
  NULLIFIER_INVALID = 'NULLIFIER_INVALID',
  
  // Root errors
  UNKNOWN_ROOT = 'UNKNOWN_ROOT',
  ROOT_INVALID = 'ROOT_INVALID',
  
  // Fee errors
  FEE_TOO_LOW = 'FEE_TOO_LOW',
  FEE_TOO_HIGH = 'FEE_TOO_HIGH',
  INSUFFICIENT_FEE = 'INSUFFICIENT_FEE',
  
  // Balance errors
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  INSUFFICIENT_POOL_LIQUIDITY = 'INSUFFICIENT_POOL_LIQUIDITY',
  
  // General errors
  MISSING_PARAMS = 'MISSING_PARAMS',
  INVALID_PARAMS = 'INVALID_PARAMS',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  RELAYER_UNAVAILABLE = 'RELAYER_UNAVAILABLE',
  NETWORK_ERROR = 'NETWORK_ERROR',
}

export interface ErrorResponse {
  success: false;
  error: string;
  errorCode: ErrorCode;
  suggestion?: string;
  details?: Record<string, any>;
}

export const ERROR_MESSAGES: Record<ErrorCode, { message: string; suggestion: string }> = {
  [ErrorCode.INVALID_PROOF]: {
    message: 'Invalid zero-knowledge proof',
    suggestion: 'The proof verification failed. Please regenerate the proof and try again.',
  },
  [ErrorCode.PROOF_FORMAT_ERROR]: {
    message: 'Invalid proof format',
    suggestion: 'Proof must be an array of 8 elements. Please check your proof format.',
  },
  [ErrorCode.NULLIFIER_SPENT]: {
    message: 'Note already spent',
    suggestion: 'This note has already been used. Sync your notes or use a different note.',
  },
  [ErrorCode.NULLIFIER_INVALID]: {
    message: 'Invalid nullifier',
    suggestion: 'The nullifier is invalid. Please regenerate your proof.',
  },
  [ErrorCode.UNKNOWN_ROOT]: {
    message: 'Unknown Merkle root',
    suggestion: 'The root is not in the pool\'s history. Sync your notes and try again.',
  },
  [ErrorCode.ROOT_INVALID]: {
    message: 'Invalid Merkle root',
    suggestion: 'The provided root is invalid. Please sync your notes and try again.',
  },
  [ErrorCode.FEE_TOO_LOW]: {
    message: 'Fee too low',
    suggestion: 'The relayer fee is below the minimum. Please increase the fee.',
  },
  [ErrorCode.FEE_TOO_HIGH]: {
    message: 'Fee too high',
    suggestion: 'The relayer fee exceeds the maximum allowed. Please reduce the fee.',
  },
  [ErrorCode.INSUFFICIENT_FEE]: {
    message: 'Insufficient fee',
    suggestion: 'You need to include a relayer fee. Please check the fee calculation.',
  },
  [ErrorCode.INSUFFICIENT_BALANCE]: {
    message: 'Insufficient balance',
    suggestion: 'You don\'t have enough tokens for this transaction. Shield more tokens first.',
  },
  [ErrorCode.INSUFFICIENT_POOL_LIQUIDITY]: {
    message: 'Insufficient pool liquidity',
    suggestion: 'The pool doesn\'t have enough liquidity for this swap. Try a smaller amount.',
  },
  [ErrorCode.MISSING_PARAMS]: {
    message: 'Missing required parameters',
    suggestion: 'Some required fields are missing. Please check your inputs and try again.',
  },
  [ErrorCode.INVALID_PARAMS]: {
    message: 'Invalid parameters',
    suggestion: 'One or more parameters are invalid. Please verify your inputs.',
  },
  [ErrorCode.RATE_LIMIT_EXCEEDED]: {
    message: 'Rate limit exceeded',
    suggestion: 'Too many requests. Please wait a minute and try again.',
  },
  [ErrorCode.RELAYER_UNAVAILABLE]: {
    message: 'Relayer unavailable',
    suggestion: 'The relayer is currently unavailable. Please try again later.',
  },
  [ErrorCode.NETWORK_ERROR]: {
    message: 'Network error',
    suggestion: 'A network error occurred. Please check your connection and try again.',
  },
};

/**
 * Create a standardized error response
 */
export function createErrorResponse(
  errorCode: ErrorCode,
  details?: Record<string, any>
): ErrorResponse {
  const errorInfo = ERROR_MESSAGES[errorCode];
  return {
    success: false,
    error: errorInfo.message,
    errorCode,
    suggestion: errorInfo.suggestion,
    details,
  };
}

/**
 * Map contract revert reason to ErrorCode
 */
export function mapContractErrorToCode(errorMessage: string): ErrorCode {
  const lowerError = errorMessage.toLowerCase();
  
  if (lowerError.includes('invalidproof') || lowerError.includes('invalid proof')) {
    return ErrorCode.INVALID_PROOF;
  }
  if (lowerError.includes('nullifieralreadyspent') || lowerError.includes('nullifier already spent')) {
    return ErrorCode.NULLIFIER_SPENT;
  }
  if (lowerError.includes('invalidmerkleroot') || lowerError.includes('unknown root')) {
    return ErrorCode.UNKNOWN_ROOT;
  }
  if (lowerError.includes('insufficient') && lowerError.includes('balance')) {
    return ErrorCode.INSUFFICIENT_BALANCE;
  }
  if (lowerError.includes('fee') && lowerError.includes('low')) {
    return ErrorCode.FEE_TOO_LOW;
  }
  
  return ErrorCode.INVALID_PARAMS;
}
