"use client"

/**
 * Haptic feedback utility for mobile devices
 * Uses the Vibration API when available
 */

type HapticPattern = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error'

const patterns: Record<HapticPattern, number | number[]> = {
  light: 10,
  medium: 25,
  heavy: 50,
  success: [10, 50, 10], // Short-pause-short
  warning: [30, 50, 30], // Medium-pause-medium
  error: [50, 30, 50, 30, 50], // Long pattern for errors
}

/**
 * Check if haptic feedback is supported
 */
export function isHapticSupported(): boolean {
  if (typeof window === 'undefined') return false
  return 'vibrate' in navigator
}

/**
 * Trigger haptic feedback
 * @param pattern - The haptic pattern to use
 */
export function haptic(pattern: HapticPattern = 'light'): void {
  if (!isHapticSupported()) return
  
  try {
    const vibrationPattern = patterns[pattern]
    navigator.vibrate(vibrationPattern)
  } catch {
    // Silently fail if vibration is not allowed
  }
}

/**
 * Trigger haptic feedback for button press
 */
export function hapticButtonPress(): void {
  haptic('light')
}

/**
 * Trigger haptic feedback for successful action
 */
export function hapticSuccess(): void {
  haptic('success')
}

/**
 * Trigger haptic feedback for warning
 */
export function hapticWarning(): void {
  haptic('warning')
}

/**
 * Trigger haptic feedback for error
 */
export function hapticError(): void {
  haptic('error')
}

/**
 * Trigger haptic feedback for confirmation dialogs
 */
export function hapticConfirmation(): void {
  haptic('medium')
}
