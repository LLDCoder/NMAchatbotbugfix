import create from 'zustand'
import { persist } from 'zustand/middleware'

export type VerificationLockType = 'code' | 'send'

export interface VerificationLock {
  deadline: number
  message: string
}

interface VerificationCountdownStore {
  resendDeadlines: Record<string, number>
  verificationLocks: Record<string, VerificationLock>
  startCountdown: (countdownKey: string, durationSec: number) => void
  clearCountdown: (countdownKey: string) => void
  startLock: (
    lockKey: string,
    durationSec: number,
    message: string,
  ) => void
  clearLock: (lockKey: string) => void
}

export const VERIFICATION_RESEND_SECONDS = 59
export const VERIFICATION_LOCK_SECONDS = 30 * 60

const getDeadline = (durationSec: number) =>
  Date.now() + Math.max(durationSec, 0) * 1000

export const getVerificationCountdownKey = (
  from: string | null | undefined,
  email: string | null | undefined,
) => `${from || 'default'}:${String(email || '').trim().toLowerCase()}`

export const getVerificationLockKey = (
  from: string | null | undefined,
  email: string | null | undefined,
  lockType: VerificationLockType,
) => `${getVerificationCountdownKey(from, email)}:${lockType}`

export const getVerificationCountdownRemaining = (
  resendDeadline: number | null,
) => {
  if (!resendDeadline) {
    return 0
  }

  return Math.max(0, Math.ceil((resendDeadline - Date.now()) / 1000))
}

export const getVerificationLockRemaining = (
  lock: VerificationLock | null | undefined,
) =>
  getVerificationCountdownRemaining(
    typeof lock?.deadline === 'number' && Number.isFinite(lock.deadline)
      ? lock.deadline
      : null,
  )

export const getVerificationLockMessage = (
  lock: VerificationLock | null | undefined,
) => (typeof lock?.message === 'string' ? lock.message.trim() : '')

export const useVerificationCountdownStore = create<VerificationCountdownStore>(
  persist(
    (set) => ({
      resendDeadlines: {},
      verificationLocks: {},
      startCountdown: (countdownKey: string, durationSec: number) =>
        set((state) => ({
          resendDeadlines: {
            ...state.resendDeadlines,
            [countdownKey]: getDeadline(durationSec),
          },
        })),
      clearCountdown: (countdownKey: string) =>
        set((state) => {
          const nextDeadlines = { ...state.resendDeadlines }
          delete nextDeadlines[countdownKey]
          return {
            resendDeadlines: nextDeadlines,
          }
        }),
      startLock: (
        lockKey: string,
        durationSec: number,
        message: string,
      ) =>
        set((state) => ({
          verificationLocks: {
            ...(state.verificationLocks || {}),
            [lockKey]: {
              deadline: getDeadline(durationSec),
              message: typeof message === 'string' ? message.trim() : '',
            },
          },
        })),
      clearLock: (lockKey: string) =>
        set((state) => {
          const nextLocks = { ...(state.verificationLocks || {}) }
          delete nextLocks[lockKey]
          return {
            verificationLocks: nextLocks,
          }
        }),
    }),
    {
      name: 'verification-countdown-storage',
      getStorage: () => sessionStorage,
    },
  ),
)
