import create from 'zustand'
import { persist } from 'zustand/middleware'

export const useForgotPwdStore = create(
  persist(
    (set) => ({
      email: '',
      setEmail: (email: string) => set({ email }),
      reset: () => set({ email: ''}),
    }),
    {
      name: 'forgot-pwd-storage', // name of the item in the storage (must be unique)
      getStorage: () => sessionStorage, // (optional) by default, 'localStorage' is used
    },
  ),
)