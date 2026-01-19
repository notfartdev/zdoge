"use client"

import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  Shield, Copy, Check, Eye, EyeOff, Wallet, Lock, Coins
} from "lucide-react"
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh"
import { PullToRefreshIndicator } from "@/components/ui/pull-to-refresh"
import { useAppLoading } from "@/lib/shielded/app-loading-context"
import { WalletIcon } from "@/components/wallet-icon"
import { useToast } from "@/hooks/use-toast"
import { useWallet } from "@/lib/wallet-context"
import { WalletConnectButton } from "@/components/wallet-connect-button"
import {
  initializeShieldedWallet,
  getWalletState,
  getShieldedBalance,
  getShieldedBalancePerToken,
  getNotes,
  getIdentity,
  addDiscoveredNote,
  type ShieldedWalletState,
} from "@/lib/shielded/shielded-service"
import { addTransaction, initTransactionHistory } from "@/lib/shielded/transaction-history"
import {
  startAutoDiscovery,
  stopAutoDiscovery,
  isAutoDiscoveryRunning,
} from "@/lib/shielded/auto-discovery"
import {
  startUnshieldMonitoring,
  stopUnshieldMonitoring,
  type UnshieldEvent,
} from "@/lib/shielded/unshield-monitoring"
import { shieldedPool, tokens, ERC20ABI } from "@/lib/dogeos-config"
import { shortenAddress } from "@/lib/shielded/shielded-address"
import { formatWeiToAmount } from "@/lib/shielded/shielded-note"
import { createPublicClient, http, type Address } from "viem"
import { dogeosTestnet } from "@/lib/dogeos-config"

const publicClient = createPublicClient({
  chain: dogeosTestnet,
  transport: http(),
})

// Token configuration with logos
const TOKEN_CONFIG: Record<string, { name: string; logo: string; address?: string; isNative?: boolean }> = {
  DOGE: { name: 'Dogecoin', logo: 'https://assets.coingecko.com/coins/images/5/large/dogecoin.png', isNative: true },
  USDC: { name: 'USD Coin', logo: 'https://assets.coingecko.com/coins/images/6319/large/usdc.png', address: tokens.USDC.address },
  USDT: { name: 'Tether USD', logo: 'https://assets.coingecko.com/coins/images/325/large/Tether.png', address: tokens.USDT.address },
  USD1: { name: 'USD1', logo: 'https://assets.coingecko.com/coins/images/54977/standard/USD1_1000x1000_transparent.png', address: tokens.USD1.address },
  WETH: { name: 'Wrapped ETH', logo: 'https://assets.coingecko.com/coins/images/2518/large/weth.png', address: tokens.WETH.address },
  LBTC: { name: 'Liquid BTC', logo: 'https://assets.coingecko.com/coins/images/1/large/bitcoin.png', address: tokens.LBTC.address },
}

interface ShieldedHeaderProps {
  onStateChange?: () => void
  selectedToken?: string
  onTokenChange?: (token: string) => void
  compact?: boolean // Use smaller header on secondary pages
  connectDescription?: string // Custom description for connect wallet state
}

export function ShieldedHeader({ onStateChange, selectedToken = "DOGE", onTokenChange, compact = false, connectDescription }: ShieldedHeaderProps) {
  const { toast } = useToast()
  const { wallet, signMessage } = useWallet()
  const [mounted, setMounted] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  const [walletState, setWalletState] = useState<ShieldedWalletState | null>(null)
  const [showAddress, setShowAddress] = useState(false)
  const [copied, setCopied] = useState(false)
  const [allPublicBalances, setAllPublicBalances] = useState<Record<string, string>>({})
  const [isLoadingBalances, setIsLoadingBalances] = useState(false)
  const [isLoadingShielded, setIsLoadingShielded] = useState(false)
  // CRITICAL: Counter to force balance recalculation even if notes.length doesn't change (e.g., swap DOGE→USDC)
  const [balanceUpdateCounter, setBalanceUpdateCounter] = useState(0)
  const { setLoadingProgress, setIsLoading: setAppLoading, resetLoading, hasCompletedInitialLoad } = useAppLoading()
  
  const tokenConfig = TOKEN_CONFIG[selectedToken] || TOKEN_CONFIG.DOGE
  const publicBalance = allPublicBalances[selectedToken] || "0"
  
  // Calculate overall loading progress with smooth animation
  // 0-25%: Wallet connection
  // 25-50%: Public balance fetching
  // 50-75%: Shielded wallet initialization
  // 75-100%: Shielded balance calculation
  useEffect(() => {
    if (!mounted || !wallet?.isConnected || !wallet?.address) {
      // Reset loading when wallet disconnects
      resetLoading()
      return
    }
    
    // Once initial load is complete, stop all progress updates
    // This prevents loading overlay from showing when switching tabs
    if (hasCompletedInitialLoad) {
      return
    }
    
    let targetProgress = 25 // Wallet connected (base)
    
    // Public balances progress (25-50%)
    if (isLoadingBalances && Object.keys(allPublicBalances).length === 0) {
      targetProgress = 35 // Just started loading
    } else if (isLoadingBalances && Object.keys(allPublicBalances).length > 0) {
      targetProgress = 45 // Partially loaded
    } else if (!isLoadingBalances && Object.keys(allPublicBalances).length > 0) {
      targetProgress = 50 // Public balances fully loaded
    }
    
    // Shielded wallet progress (50-100%)
    if (isInitialized && isLoadingShielded) {
      targetProgress = 70 // Initializing but not done
    } else if (isInitialized && !isLoadingShielded && !walletState) {
      targetProgress = 75 // Initialized, waiting for state
    } else if (isInitialized && walletState && isLoadingShielded) {
      targetProgress = 90 // State loaded, syncing notes
    } else if (isInitialized && walletState && !isLoadingShielded) {
      targetProgress = 100 // Everything complete!
    } else if (!isInitialized && isLoadingShielded) {
      targetProgress = 55 // Starting initialization
    }
    
    // Smooth animation to target progress (makes it more convincing)
    const currentProgress = Math.min(100, Math.max(0, targetProgress))
    setLoadingProgress(currentProgress)
    setAppLoading(currentProgress < 100 || isLoadingBalances || isLoadingShielded)
  }, [mounted, wallet?.isConnected, wallet?.address, isLoadingBalances, allPublicBalances, isInitialized, isLoadingShielded, walletState, setLoadingProgress, setAppLoading, resetLoading, hasCompletedInitialLoad])
  
  useEffect(() => {
    setMounted(true)
  }, [])
  
  // Fetch all public token balances - reusable function
  const fetchAllPublicBalances = useCallback(async () => {
    if (!wallet?.address) return
    
    setIsLoadingBalances(true)
    const balances: Record<string, string> = {}
    
    for (const [symbol, config] of Object.entries(TOKEN_CONFIG)) {
      try {
        if (config.isNative) {
          // Fetch native DOGE balance
          const provider = (window as any).ethereum
          if (provider) {
            const balance = await provider.request({
              method: "eth_getBalance",
              params: [wallet.address, "latest"],
            })
            const balanceWei = BigInt(balance)
            const balanceDoge = Number(balanceWei) / 1e18
            balances[symbol] = balanceDoge.toFixed(4)
          }
        } else if (config.address) {
          // Fetch ERC20 balance
          const balance = await publicClient.readContract({
            address: config.address as Address,
            abi: ERC20ABI,
            functionName: 'balanceOf',
            args: [wallet.address as Address],
          })
          balances[symbol] = (Number(balance) / 1e18).toFixed(4)
        }
      } catch (error) {
        console.error(`Failed to fetch ${symbol} balance:`, error)
        balances[symbol] = "0"
      }
    }
    
    setAllPublicBalances(balances)
    setIsLoadingBalances(false)
  }, [wallet?.address])
  
  // Initial fetch and polling of public balances
  useEffect(() => {
    if (!mounted || !wallet?.isConnected || !wallet?.address) {
      setAllPublicBalances({})
      setIsLoadingBalances(false)
      return
    }
    
    fetchAllPublicBalances()
    const interval = setInterval(fetchAllPublicBalances, 10000)
    return () => clearInterval(interval)
  }, [mounted, wallet?.isConnected, wallet?.address, fetchAllPublicBalances])
  
  // Refresh balances when onStateChange is called (after shield/unshield)
  useEffect(() => {
    if (mounted && wallet?.isConnected && wallet?.address && onStateChange) {
      // Trigger balance refresh after a delay to allow transaction confirmation
      const fetchAllBalances = async () => {
        // Wait 3 seconds for transaction to be confirmed
        await new Promise(resolve => setTimeout(resolve, 3000))
        
        console.log('[ShieldedHeader] Refreshing balances via onStateChange')
        setIsLoadingBalances(true)
        const balances: Record<string, string> = {}
        for (const [symbol, config] of Object.entries(TOKEN_CONFIG)) {
          try {
            if (config.isNative) {
              const provider = (window as any).ethereum
              if (provider) {
                const balance = await provider.request({
                  method: "eth_getBalance",
                  params: [wallet.address, "latest"],
                })
                const balanceWei = BigInt(balance)
                const balanceDoge = Number(balanceWei) / 1e18
                balances[symbol] = balanceDoge.toFixed(4)
              }
            } else if (config.address) {
              const balance = await publicClient.readContract({
                address: config.address as Address,
                abi: ERC20ABI,
                functionName: 'balanceOf',
                args: [wallet.address as Address],
              })
              balances[symbol] = (Number(balance) / 1e18).toFixed(4)
            }
          } catch (error) {
            console.error(`[ShieldedHeader] Failed to fetch ${symbol} balance:`, error)
            balances[symbol] = "0"
          }
        }
        setAllPublicBalances(balances)
        setIsLoadingBalances(false)
        console.log('[ShieldedHeader] Balances refreshed via onStateChange:', balances)
      }
      fetchAllBalances()
    }
  }, [onStateChange, mounted, wallet?.isConnected, wallet?.address])
  
  // Listen for refresh-balance event (dispatched after successful unshield/swap)
  // Also listen for shielded-wallet-updated event (for swap/transfer)
  useEffect(() => {
    if (!mounted || !wallet?.isConnected || !wallet?.address) {
      return
    }
    
    const handleShieldedWalletUpdate = () => {
      console.log('[ShieldedHeader] shielded-wallet-updated event received')
      // Refresh shielded wallet state from storage
      // This will trigger a re-render and recalculate shieldedBalance
      refreshState()
      // CRITICAL: Force balance recalculation by incrementing counter
      // This ensures balance updates even if notes.length doesn't change (e.g., swap DOGE→USDC)
      // The counter forces useMemo to recalculate, which calls getShieldedBalancePerToken()
      setBalanceUpdateCounter(prev => prev + 1)
    }
    
    const handleRefreshBalance = async () => {
      console.log('[ShieldedHeader] Refresh balance event received')
      setIsLoadingBalances(true)
      // No delay - fetch immediately for real-time updates
      // Transaction is already confirmed when this event is dispatched
      
      const balances: Record<string, string> = {}
      for (const [symbol, config] of Object.entries(TOKEN_CONFIG)) {
        try {
          if (config.isNative) {
            const provider = (window as any).ethereum
            if (provider) {
              const balance = await provider.request({
                method: "eth_getBalance",
                params: [wallet.address, "latest"],
              })
              const balanceWei = BigInt(balance)
              const balanceDoge = Number(balanceWei) / 1e18
              balances[symbol] = balanceDoge.toFixed(4)
            }
          } else if (config.address) {
            const balance = await publicClient.readContract({
              address: config.address as Address,
              abi: ERC20ABI,
              functionName: 'balanceOf',
              args: [wallet.address as Address],
            })
            balances[symbol] = (Number(balance) / 1e18).toFixed(4)
          }
        } catch (error) {
          console.error(`[ShieldedHeader] Failed to fetch ${symbol} balance:`, error)
          balances[symbol] = "0"
        }
      }
      setAllPublicBalances(balances)
      setIsLoadingBalances(false)
      console.log('[ShieldedHeader] Balances refreshed:', balances)
    }
    
    window.addEventListener('refresh-balance', handleRefreshBalance)
    window.addEventListener('shielded-wallet-updated', handleShieldedWalletUpdate)
    return () => {
      window.removeEventListener('refresh-balance', handleRefreshBalance)
      window.removeEventListener('shielded-wallet-updated', handleShieldedWalletUpdate)
    }
  }, [mounted, wallet?.isConnected, wallet?.address])
  
  // Batching for sequential transfer notifications
  // Batch window should be longer than poll interval (5s) to catch sequential transfers across polls
  const notificationBatchRef = useRef<Array<{ note: ShieldedNote; txHash?: string; token: string }>>([])
  const batchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const BATCH_WINDOW_MS = 8000 // 8 second window to collect sequential transfers (must be > poll interval of 5s)
  
  // Batching for unshield notifications
  const unshieldBatchRef = useRef<Array<{ amount: bigint; token: string; txHash: string; fee: bigint }>>([])
  const unshieldBatchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  const flushNotificationBatch = () => {
    try {
      if (notificationBatchRef.current.length === 0) return
      
      // Calculate total amount per token
      const totalsByToken = new Map<string, bigint>()
      
      notificationBatchRef.current.forEach(({ note, token }) => {
        try {
          const currentTotal = totalsByToken.get(token) || BigInt(0)
          totalsByToken.set(token, currentTotal + note.amount)
        } catch (error) {
          console.error('[ShieldedHeader] Error calculating batch total for token:', token, error)
        }
      })
      
      // Show one notification per token with total amount
      totalsByToken.forEach((totalAmount, token) => {
        try {
          toast({
            title: <span className="flex items-center gap-2"><Coins className="h-4 w-4 text-[#C2A633]" /> Incoming Transfer!</span>,
            description: `You received ${formatWeiToAmount(totalAmount).toFixed(4)} ${token} privately`,
            variant: "success" as const,
            duration: 7000,
          })
        } catch (error) {
          console.error('[ShieldedHeader] Error showing notification for token:', token, error)
        }
      })
    } catch (error) {
      console.error('[ShieldedHeader] Error flushing notification batch:', error)
      // Fallback: show individual notifications if batch fails
      notificationBatchRef.current.forEach(({ note, token }) => {
        try {
          toast({
            title: <span className="flex items-center gap-2"><Coins className="h-4 w-4 text-[#C2A633]" /> Incoming Transfer!</span>,
            description: `You received ${formatWeiToAmount(note.amount).toFixed(4)} ${token} privately`,
            variant: "success" as const,
            duration: 7000,
          })
        } catch (fallbackError) {
          console.error('[ShieldedHeader] Error showing fallback notification:', fallbackError)
        }
      })
    } finally {
      notificationBatchRef.current = []
      batchTimeoutRef.current = null
    }
  }
  
  const flushUnshieldBatch = () => {
    try {
      if (unshieldBatchRef.current.length === 0) return
      
      // Calculate total amount per token
      const totalsByToken = new Map<string, bigint>()
      
      unshieldBatchRef.current.forEach(({ amount, token }) => {
        try {
          const currentTotal = totalsByToken.get(token) || BigInt(0)
          totalsByToken.set(token, currentTotal + amount)
        } catch (error) {
          console.error('[ShieldedHeader] Error calculating unshield batch total for token:', token, error)
        }
      })
      
      // Show one notification per token with total amount
      totalsByToken.forEach((totalAmount, token) => {
        try {
          toast({
            title: <span className="flex items-center gap-2"><Coins className="h-4 w-4 text-[#C2A633]" /> Unshield Complete!</span>,
            description: `Received ${formatWeiToAmount(totalAmount).toFixed(4)} ${token} to your wallet`,
            variant: "success" as const,
            duration: 7000,
          })
        } catch (error) {
          console.error('[ShieldedHeader] Error showing unshield notification for token:', token, error)
        }
      })
    } catch (error) {
      console.error('[ShieldedHeader] Error flushing unshield batch:', error)
      // Fallback: show individual notifications if batch fails
      unshieldBatchRef.current.forEach(({ amount, token }) => {
        try {
          toast({
            title: <span className="flex items-center gap-2"><Coins className="h-4 w-4 text-[#C2A633]" /> Unshield Complete!</span>,
            description: `Received ${formatWeiToAmount(amount).toFixed(4)} ${token} to your wallet`,
            variant: "success" as const,
            duration: 7000,
          })
        } catch (fallbackError) {
          console.error('[ShieldedHeader] Error showing fallback unshield notification:', fallbackError)
        }
      })
    } finally {
      unshieldBatchRef.current = []
      unshieldBatchTimeoutRef.current = null
    }
  }
  
  // Initialize shielded wallet when wallet is connected
  useEffect(() => {
    if (!mounted || !wallet?.isConnected || !wallet?.address) {
      setIsInitialized(false)
      setWalletState(null)
      return
    }
    
    async function init() {
      try {
        setIsLoadingShielded(true)
        // Pass wallet address and sign message function to initialize
        const identity = await initializeShieldedWallet(
          wallet.address!,
          signMessage ? async (msg: string) => signMessage(msg) : undefined,
          shieldedPool.address
        )
        
        if (identity) {
          setIsInitialized(true)
          // Add delays to make loading more convincing and ensure everything is ready
          await new Promise(resolve => setTimeout(resolve, 400))
          refreshState()
          // Give more time for notes to be calculated and synced
          await new Promise(resolve => setTimeout(resolve, 500))
          setIsLoadingShielded(false)
          
          // Initialize transaction history for this wallet (required for addTransaction to work)
          await initTransactionHistory(wallet.address!).catch(err => {
            console.warn('[ShieldedHeader] Failed to init transaction history:', err)
          })
          
          // Start auto-discovery for incoming transfers
          // Track shown notifications to prevent duplicate alerts on refresh
          const shownNotificationsKey = `shielded_notifications_${wallet?.address || ''}`
          const getShownNotifications = (): Set<string> => {
            if (typeof window === 'undefined') return new Set()
            try {
              const stored = localStorage.getItem(shownNotificationsKey)
              return stored ? new Set(JSON.parse(stored)) : new Set()
            } catch {
              return new Set()
            }
          }
          const markNotificationShown = (commitment: string, txHash?: string) => {
            if (typeof window === 'undefined') return
            try {
              const shown = getShownNotifications()
              const key = txHash ? `${commitment}:${txHash}` : commitment
              shown.add(key)
              // Keep only last 100 notifications to avoid localStorage bloat
              if (shown.size > 100) {
                const arr = Array.from(shown)
                arr.shift()
                localStorage.setItem(shownNotificationsKey, JSON.stringify(Array.from(arr)))
              } else {
                localStorage.setItem(shownNotificationsKey, JSON.stringify(Array.from(shown)))
              }
            } catch {
              // Ignore localStorage errors
            }
          }
          
          startAutoDiscovery(
            shieldedPool.address,
            identity,
            getNotes(),
            (discoveredNote, txHash) => {
              // New note discovered! Add it and refresh UI
              const added = addDiscoveredNote(discoveredNote)
              if (added) {
                // Check if we've already shown this notification
                const notificationKey = txHash ? `${discoveredNote.commitment}:${txHash}` : discoveredNote.commitment.toString()
                const shownNotifications = getShownNotifications()
                
                if (!shownNotifications.has(notificationKey)) {
                  // Mark as shown BEFORE showing (prevents race conditions)
                  markNotificationShown(discoveredNote.commitment.toString(), txHash)
                  
                  // Add to transaction history (always add individual transactions)
                  if (txHash && wallet?.address) {
                    addTransaction({
                      type: 'transfer',
                      txHash: txHash,
                      timestamp: Math.floor(Date.now() / 1000),
                      token: discoveredNote.token || 'DOGE',
                      amount: formatWeiToAmount(discoveredNote.amount).toFixed(4),
                      amountWei: discoveredNote.amount.toString(),
                      status: 'confirmed', // Received transfers are already confirmed on-chain
                      isIncoming: true, // Mark as incoming transfer
                    }).catch(err => {
                      console.warn('[ShieldedHeader] Failed to add transaction to history:', err)
                    })
                  }
                  refreshState()
                  
                  // Add to batch for notification
                  const token = discoveredNote.token || 'DOGE'
                  notificationBatchRef.current.push({ note: discoveredNote, txHash, token })
                  
                  // Clear existing timeout and set new one
                  if (batchTimeoutRef.current) {
                    clearTimeout(batchTimeoutRef.current)
                  }
                  batchTimeoutRef.current = setTimeout(flushNotificationBatch, BATCH_WINDOW_MS)
                } else {
                  console.log(`[ShieldedHeader] Notification already shown for commitment ${discoveredNote.commitment.toString(16).slice(0, 16)}..., skipping`)
                }
              }
            }
          )
          
          // Start unshield monitoring for incoming unshield transactions
          if (wallet?.address) {
            // Track shown unshield notifications to prevent duplicates
            const shownUnshieldNotificationsKey = `shielded_unshield_notifications_${wallet.address}`
            const getShownUnshieldNotifications = (): Set<string> => {
              if (typeof window === 'undefined') return new Set()
              try {
                const stored = localStorage.getItem(shownUnshieldNotificationsKey)
                return stored ? new Set(JSON.parse(stored)) : new Set()
              } catch {
                return new Set()
              }
            }
            const markUnshieldNotificationShown = (nullifierHash: string, txHash: string) => {
              if (typeof window === 'undefined') return
              try {
                const shown = getShownUnshieldNotifications()
                const key = `${txHash}:${nullifierHash}`
                shown.add(key)
                // Keep only last 100 notifications to avoid localStorage bloat
                if (shown.size > 100) {
                  const arr = Array.from(shown)
                  arr.shift()
                  localStorage.setItem(shownUnshieldNotificationsKey, JSON.stringify(Array.from(arr)))
                } else {
                  localStorage.setItem(shownUnshieldNotificationsKey, JSON.stringify(Array.from(shown)))
                }
              } catch {
                // Ignore localStorage errors
              }
            }
            
            startUnshieldMonitoring(
              shieldedPool.address,
              wallet.address,
              (unshieldEvent) => {
                // Check if we've already shown this notification
                const notificationKey = `${unshieldEvent.txHash}:${unshieldEvent.nullifierHash}`
                const shownNotifications = getShownUnshieldNotifications()
                
                if (!shownNotifications.has(notificationKey)) {
                  // Mark as shown BEFORE showing (prevents race conditions)
                  markUnshieldNotificationShown(unshieldEvent.nullifierHash, unshieldEvent.txHash)
                  
                  // Get token symbol and decimals
                  const tokenSymbol = unshieldEvent.tokenSymbol
                  const tokenConfig = shieldedPool.supportedTokens[tokenSymbol as keyof typeof shieldedPool.supportedTokens]
                  const decimals = tokenConfig?.decimals || 18
                  
                  // Calculate amount received (amount - fee)
                  const amountReceived = unshieldEvent.amount - unshieldEvent.fee
                  
                  // Add to transaction history (always add individual transactions)
                  if (wallet?.address) {
                    addTransaction({
                      type: 'unshield',
                      txHash: unshieldEvent.txHash,
                      timestamp: unshieldEvent.timestamp,
                      token: tokenSymbol,
                      amount: formatWeiToAmount(amountReceived, decimals).toFixed(4),
                      amountWei: amountReceived.toString(),
                      recipientPublicAddress: unshieldEvent.recipient,
                      relayerFee: formatWeiToAmount(unshieldEvent.fee, decimals).toFixed(4),
                      status: 'confirmed', // Unshield events are already confirmed on-chain
                    }).catch(err => {
                      console.warn('[ShieldedHeader] Failed to add unshield transaction to history:', err)
                    })
                  }
                  
                  // Refresh public balance (unshield adds to public wallet)
                  refreshState()
                  if (wallet?.refreshBalance) {
                    wallet.refreshBalance().catch(err => console.warn('[ShieldedHeader] Failed to refresh public balance:', err))
                  }
                  
                  // Add to batch for notification
                  unshieldBatchRef.current.push({
                    amount: amountReceived,
                    token: tokenSymbol,
                    txHash: unshieldEvent.txHash,
                    fee: unshieldEvent.fee,
                  })
                  
                  // Clear existing timeout and set new one
                  if (unshieldBatchTimeoutRef.current) {
                    clearTimeout(unshieldBatchTimeoutRef.current)
                  }
                  unshieldBatchTimeoutRef.current = setTimeout(flushUnshieldBatch, BATCH_WINDOW_MS)
                } else {
                  console.log(`[ShieldedHeader] Unshield notification already shown for ${unshieldEvent.txHash.slice(0, 10)}..., skipping`)
                }
              }
            )
          }
        }
      } catch (error) {
        console.error("Failed to initialize shielded wallet:", error)
        setIsLoadingShielded(false)
      }
    }
    
    init()
    
    return () => {
      stopAutoDiscovery()
      stopUnshieldMonitoring()
      // Clean up batch timeouts if component unmounts
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current)
        batchTimeoutRef.current = null
      }
      if (unshieldBatchTimeoutRef.current) {
        clearTimeout(unshieldBatchTimeoutRef.current)
        unshieldBatchTimeoutRef.current = null
      }
      // Flush any pending notifications before unmounting
      // This ensures user doesn't miss notifications if component unmounts during batching
      if (notificationBatchRef.current.length > 0) {
        try {
          flushNotificationBatch()
        } catch (error) {
          console.error('[ShieldedHeader] Error flushing batch on unmount:', error)
        }
      }
      if (unshieldBatchRef.current.length > 0) {
        try {
          flushUnshieldBatch()
        } catch (error) {
          console.error('[ShieldedHeader] Error flushing unshield batch on unmount:', error)
        }
      }
    }
  }, [mounted, wallet?.isConnected, wallet?.address])
  
  const refreshState = () => {
    // Reload state from storage to ensure we have the latest notes
    if (wallet?.address) {
      // CRITICAL: getWalletState() syncs module-level walletState with storage
      // This ensures getShieldedBalancePerToken() reads the latest notes
      const state = getWalletState()
      setWalletState(state)
      // Once state is refreshed, we're done loading
      if (state) {
        setIsLoadingShielded(false)
      }
      // Force a re-render to recalculate shieldedBalance via useMemo
      // The useMemo will recalculate because walletState reference changes
    }
    onStateChange?.()
  }
  
  // CRITICAL: Use useMemo BEFORE any conditional returns to follow Rules of Hooks
  // This ensures balance updates immediately after swap/transfer
  // The balanceUpdateCounter ensures we recalculate even when notes.length stays the same (swap scenarios)
  const shieldedBalance = useMemo(() => {
    if (!walletState) return {}
    // Force recalculation by calling getShieldedBalancePerToken() which reads from module-level walletState
    // This will be in sync after refreshState() updates the module-level state via getWalletState()
    // The balanceUpdateCounter ensures we recalculate even when notes.length stays the same (swap scenarios)
    return getShieldedBalancePerToken()
  }, [walletState, walletState?.notes?.length, balanceUpdateCounter]) // Recalculate when walletState, notes count, or counter changes
  
  const allNotes = useMemo(() => {
    if (!walletState) return []
    return getNotes()
  }, [walletState, walletState?.notes?.length]) // Recalculate when walletState or notes count changes
  
  const tokenNotes = useMemo(() => {
    return allNotes.filter(note => (note.token || 'DOGE') === selectedToken)
  }, [allNotes, selectedToken])
  
  const isAutoDiscovery = isAutoDiscoveryRunning()
  
  const copyAddress = async () => {
    if (!walletState?.shieldedAddress) return
    await navigator.clipboard.writeText(`zdoge:${walletState.shieldedAddress}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast({ title: "Address copied!", duration: 3000 })
  }
  
  // Pull-to-refresh handler
  const handlePullRefresh = useCallback(async () => {
    // Refresh public balances
    await fetchAllPublicBalances()
    // Trigger balance recalculation
    setBalanceUpdateCounter(prev => prev + 1)
    // Notify parent
    onStateChange?.()
    toast({ title: "Refreshed", description: "Balances updated", duration: 2000 })
  }, [fetchAllPublicBalances, onStateChange, toast])
  
  const {
    pullDistance,
    isRefreshing,
    progress,
    containerRef,
  } = usePullToRefresh({
    onRefresh: handlePullRefresh,
    threshold: 80,
    disabled: !wallet?.isConnected,
  })
  
  if (!mounted) return null
  
  // Show connect wallet prompt if not connected
  if (!wallet?.isConnected || !wallet?.address) {
    return (
      <Card className="p-6 mb-6 bg-muted/30 border border-muted">
        <div className="text-center py-8">
          <WalletIcon className="h-12 w-12 mx-auto mb-4" />
          <h3 className="text-lg font-display font-semibold mb-2">Connect Your Wallet</h3>
          <p className="text-sm font-body text-muted-foreground mb-6">
            {connectDescription || "Connect your wallet to access your shielded balance"}
          </p>
          <WalletConnectButton variant="default" />
        </div>
      </Card>
    )
  }
  
  return (
    <Card 
      ref={containerRef as React.RefObject<HTMLDivElement>}
      className={`${compact ? 'p-4' : 'p-6'} mb-6 bg-card/50 backdrop-blur border-primary/20 overflow-hidden`}
    >
      {/* Pull-to-refresh indicator */}
      <PullToRefreshIndicator
        pullDistance={pullDistance}
        isRefreshing={isRefreshing}
        progress={progress}
      />
      
      <div className={`grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 ${compact ? '' : 'mb-4'}`}>
        <div className={`${compact ? 'p-3 sm:p-4' : 'p-4 sm:p-5'} rounded-lg bg-muted/30 border`}>
          <div className="flex items-center gap-2 font-mono text-[11px] sm:text-[10px] uppercase tracking-[0.14em] text-white/60 mb-1.5 sm:mb-1">
            <Wallet className="h-3.5 w-3.5 sm:h-3 w-3 opacity-85" strokeWidth={1.75} />
            Public Balance
          </div>
          {onTokenChange ? (
              <Select value={selectedToken} onValueChange={onTokenChange}>
                <SelectTrigger className="h-auto py-0 px-0 border-0 bg-transparent hover:bg-transparent shadow-none focus:ring-0 focus:ring-offset-0 w-fit">
                  <SelectValue>
                    <div className="flex items-center gap-2">
                      <img 
                        src={tokenConfig.logo} 
                        alt={selectedToken} 
                        className={`${compact ? 'w-5 h-5' : 'w-6 h-6 sm:w-7 sm:h-7'} rounded-full flex-shrink-0`}
                      />
                      <span className={`${compact ? 'text-lg sm:text-xl' : 'text-xl sm:text-2xl'} font-mono font-bold tracking-[-0.01em] break-words`}>{publicBalance}</span>
                      <span className="font-body text-sm sm:text-base text-white/70 flex-shrink-0">{selectedToken}</span>
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TOKEN_CONFIG).map(([symbol, config]) => (
                    <SelectItem key={symbol} value={symbol}>
                      <div className="flex items-center gap-2">
                        <img 
                          src={config.logo} 
                          alt={symbol} 
                          className="w-5 h-5 rounded-full"
                        />
                        <span className="font-body">{symbol}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className={`${compact ? 'text-lg sm:text-xl' : 'text-xl sm:text-2xl'} font-bold flex items-center gap-2 flex-wrap`}>
                <img 
                  src={tokenConfig.logo} 
                  alt={selectedToken} 
                  className={`${compact ? 'w-5 h-5' : 'w-6 h-6 sm:w-7 sm:h-7'} rounded-full flex-shrink-0`}
                />
                <span className="break-words">{publicBalance}</span> <span className="flex-shrink-0">{selectedToken}</span>
              </div>
            )}
        </div>
        
        <div className={`${compact ? 'p-3 sm:p-4' : 'p-4 sm:p-5'} rounded-lg bg-primary/5 border border-primary/20`}>
          <div className="flex items-center gap-2 font-mono text-[11px] sm:text-[10px] uppercase tracking-[0.14em] text-white/60 mb-1.5 sm:mb-1">
            <Lock className="h-3.5 w-3.5 sm:h-3 w-3 opacity-85" strokeWidth={1.75} />
            Shielded Balance
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <img 
              src={tokenConfig.logo} 
              alt={selectedToken} 
              className={`${compact ? 'w-5 h-5' : 'w-6 h-6 sm:w-7 sm:h-7'} rounded-full flex-shrink-0`}
            />
            <span className="font-body text-sm sm:text-base text-white/70 flex-shrink-0">{selectedToken}</span>
            <span className={`ml-auto ${compact ? 'text-lg sm:text-xl' : 'text-xl sm:text-2xl'} font-mono font-bold tracking-[-0.01em] break-words`}>{formatWeiToAmount(shieldedBalance[selectedToken] || 0n).toFixed(4)}</span>
          </div>
        </div>
      </div>
      
      {walletState?.shieldedAddress && !compact && (
        <div className="p-3 sm:p-4 rounded-lg bg-muted/30 border mt-3 sm:mt-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 font-mono text-[10px] sm:text-[11px] uppercase tracking-[0.14em] text-white/60 mb-1 flex-wrap">
                <Shield className="h-3 w-3 sm:h-3.5 sm:w-3.5 opacity-85 flex-shrink-0" strokeWidth={1.75} />
                Your Shielded Address
                <Badge variant="outline" className="text-[9px] sm:text-[10px] ml-1">Permanent</Badge>
              </div>
              <code className="text-xs sm:text-sm font-mono bg-muted px-2 sm:px-3 py-1.5 rounded block break-all sm:break-normal">
                {showAddress 
                  ? `zdoge:${walletState.shieldedAddress}`
                  : `zdoge:${shortenAddress(walletState.shieldedAddress)}`
                }
              </code>
              <p className="text-[10px] sm:text-xs font-body text-white/60 mt-1">
                Share this address to receive private payments • This address never changes
              </p>
            </div>
            <div className="flex items-center gap-2 sm:ml-3 self-start sm:self-auto">
              <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-8 sm:w-8" onClick={() => setShowAddress(!showAddress)}>
                {showAddress ? <EyeOff className="h-4 w-4 opacity-85" strokeWidth={1.75} /> : <Eye className="h-4 w-4 opacity-85" strokeWidth={1.75} />}
              </Button>
              <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-8 sm:w-8" onClick={copyAddress}>
                {copied ? <Check className="h-4 w-4 text-green-500" strokeWidth={1.75} /> : <Copy className="h-4 w-4 opacity-85" strokeWidth={1.75} />}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}

export function useShieldedState() {
  const [notes, setNotes] = useState(getNotes())
  const [balance, setBalance] = useState(getShieldedBalancePerToken())
  
  const refresh = () => {
    setNotes(getNotes())
    setBalance(getShieldedBalancePerToken())
  }
  
  // Listen for shielded-wallet-updated events to auto-refresh
  useEffect(() => {
    let debounceTimer: NodeJS.Timeout | null = null
    
    const handleUpdate = () => {
      // Debounce rapid-fire events (multiple dispatches in quick succession)
      if (debounceTimer) {
        clearTimeout(debounceTimer)
      }
      
      debounceTimer = setTimeout(() => {
        console.log('[useShieldedState] Refreshing notes and balance from shielded-wallet-updated event')
        refresh()
        debounceTimer = null
      }, 150) // Wait 150ms for any additional events before refreshing
    }
    
    window.addEventListener('shielded-wallet-updated', handleUpdate)
    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer)
      }
      window.removeEventListener('shielded-wallet-updated', handleUpdate)
    }
  }, []) // Empty deps - only set up listener once
  
  return { notes, balance, refresh }
}

