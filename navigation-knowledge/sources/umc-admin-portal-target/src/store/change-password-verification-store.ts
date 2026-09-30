import create from 'zustand'
import { persist } from 'zustand/middleware'

interface ChangePasswordVerificationStore {
  sessions: Record<string, number>
  startSession: (sessionKey: string, durationMs: number) => void
  clearSession: (sessionKey: string) => void
}

export const getChangePasswordVerificationKey = (
  email: string | null | undefined,
) => `change-password:${String(email || '').trim().toLowerCase()}`

export const useChangePasswordVerificationStore =
  create<ChangePasswordVerificationStore>(
    persist(
      (set) => ({
        sessions: {},
        startSession: (sessionKey: string, durationMs: number) =>
          set((state) => ({
            sessions: {
              ...state.sessions,
              [sessionKey]: Date.now() + Math.max(durationMs, 0),
            },
          })),
        clearSession: (sessionKey: string) =>
          set((state) => {
            const nextSessions = { ...state.sessions }
            delete nextSessions[sessionKey]
            return {
              sessions: nextSessions,
            }
          }),
      }),
      {
        name: 'change-password-verification-storage',
        getStorage: () => sessionStorage,
      },
    ),
  )
