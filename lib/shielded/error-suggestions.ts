/**
 * Smart Error Suggestions
 * 
 * Provides context-aware error messages and actionable suggestions
 * to help users resolve common issues.
 */

export interface ErrorSuggestion {
  message: string
  suggestion?: string
  action?: string
}

/**
 * Get smart error suggestion based on error message and context
 */
export function getErrorSuggestion(
  error: string | Error,
  context?: {
    operation?: 'shield' | 'unshield' | 'swap' | 'transfer'
    token?: string
    hasShieldedBalance?: boolean
    hasPublicBalance?: boolean
  }
): ErrorSuggestion {
  const errorMessage = typeof error === 'string' ? error.toLowerCase() : error.message?.toLowerCase() || ''
  const op = context?.operation || 'shield'

  // Insufficient balance errors
  if (errorMessage.includes('insufficient') && errorMessage.includes('balance')) {
    if (op === 'shield') {
      return {
        message: 'Insufficient public balance',
        suggestion: 'You need more tokens in your public wallet to shield.',
        action: 'Add more tokens to your wallet first',
      }
    }
    if (op === 'unshield' || op === 'swap' || op === 'transfer') {
      return {
        message: 'Insufficient shielded balance',
        suggestion: context?.hasShieldedBalance 
          ? 'You don\'t have enough in your shielded balance for this transaction.'
          : 'You need to shield tokens first before you can unshield, swap, or transfer them.',
        action: context?.hasShieldedBalance ? 'Use a smaller amount' : 'Go to Shield to add tokens',
      }
    }
  }

  // Network/RPC errors
  if (errorMessage.includes('network') || errorMessage.includes('rpc') || errorMessage.includes('fetch')) {
    return {
      message: 'Network connection error',
      suggestion: 'There was a problem connecting to the blockchain network.',
      action: 'Check your internet connection and try again',
    }
  }

  // Relayer errors
  if (errorMessage.includes('relayer') || errorMessage.includes('relay')) {
    if (errorMessage.includes('unavailable') || errorMessage.includes('temporarily')) {
      return {
        message: 'Relayer temporarily unavailable',
        suggestion: 'The relayer service is temporarily down. This usually resolves quickly.',
        action: 'Please wait a moment and try again',
      }
    }
    return {
      message: 'Relayer error',
      suggestion: 'There was an issue with the relayer service processing your transaction.',
      action: 'Please try again in a moment',
    }
  }

  // Proof generation errors
  if (errorMessage.includes('proof') || errorMessage.includes('witness') || errorMessage.includes('circuit')) {
    return {
      message: 'Proof generation failed',
      suggestion: 'There was an issue generating the zero-knowledge proof for your transaction.',
      action: 'Please try again. If this persists, your notes may need to be synced.',
    }
  }

  // Nullifier/note errors
  if (errorMessage.includes('nullifier') || errorMessage.includes('spent') || errorMessage.includes('already')) {
    if (errorMessage.includes('spent') || errorMessage.includes('already')) {
      return {
        message: 'Note already spent',
        suggestion: 'This shielded note has already been used in a previous transaction.',
        action: 'Sync your notes to see your current available balance',
      }
    }
    return {
      message: 'Invalid note or nullifier',
      suggestion: 'The note you\'re trying to use is invalid or has already been spent.',
      action: 'Sync your notes from the blockchain',
    }
  }

  // User rejection
  if (errorMessage.includes('user rejected') || errorMessage.includes('user denied') || errorMessage.includes('rejected')) {
    return {
      message: 'Transaction cancelled',
      suggestion: 'You cancelled the transaction in your wallet.',
      action: 'Try again when ready',
    }
  }

  // Gas/fee errors
  if (errorMessage.includes('gas') || errorMessage.includes('fee')) {
    return {
      message: 'Gas estimation failed',
      suggestion: 'There was a problem estimating transaction fees. Your wallet may have insufficient funds.',
      action: 'Ensure you have enough DOGE for gas fees',
    }
  }

  // Approval errors
  if (errorMessage.includes('approval') || errorMessage.includes('allowance')) {
    return {
      message: 'Token approval required',
      suggestion: 'You need to approve token spending first.',
      action: 'Approve the transaction in your wallet',
    }
  }

  // Invalid input errors
  if (errorMessage.includes('invalid') && (errorMessage.includes('amount') || errorMessage.includes('input'))) {
    return {
      message: 'Invalid amount',
      suggestion: 'The amount you entered is invalid or too large.',
      action: 'Enter a valid amount within your balance',
    }
  }

  // Address errors
  if (errorMessage.includes('address') || errorMessage.includes('recipient')) {
    return {
      message: 'Invalid address',
      suggestion: 'The recipient address is invalid or incorrect.',
      action: 'Check the address and try again',
    }
  }

  // Liquidity errors (for swaps)
  if (errorMessage.includes('liquidity') || errorMessage.includes('insufficient liquidity')) {
    return {
      message: 'Insufficient liquidity',
      suggestion: 'The swap pool doesn\'t have enough liquidity for this trade.',
      action: 'Try a smaller amount or swap a different token pair',
    }
  }

  // Root/Merkle tree errors
  if (errorMessage.includes('root') || errorMessage.includes('merkle')) {
    return {
      message: 'Merkle tree out of sync',
      suggestion: 'The Merkle tree state doesn\'t match. Your notes may need to be synced.',
      action: 'Sync your shielded notes from the blockchain',
    }
  }

  // Default fallback
  return {
    message: 'Transaction failed',
    suggestion: 'An unexpected error occurred during your transaction.',
    action: 'Please try again. If the problem persists, check your connection and wallet settings.',
  }
}

/**
 * Format error with suggestion for display in UI
 */
export function formatErrorWithSuggestion(error: string | Error, context?: Parameters<typeof getErrorSuggestion>[1]): {
  title: string
  description: string
  suggestion?: string
} {
  const suggestion = getErrorSuggestion(error, context)
  
  return {
    title: suggestion.message,
    description: suggestion.suggestion || 'Please try again.',
    suggestion: suggestion.action,
  }
}
