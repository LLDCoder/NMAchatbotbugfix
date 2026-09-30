import create from "zustand"

type FirstApprovalRejectedValue = boolean | null

interface ContentApplicationReviewStore {
  isFirstApprovalRejected: FirstApprovalRejectedValue
  setIsFirstApprovalRejected: (value: unknown) => void
  resetIsFirstApprovalRejected: () => void
}

const normalizeFirstApprovalRejected = (
  value: unknown,
): FirstApprovalRejectedValue => {
  if (typeof value === "boolean") {
    return value
  }

  if (typeof value === "number") {
    if (value === 1) {
      return true
    }

    if (value === 0) {
      return false
    }
  }

  if (typeof value === "string") {
    const normalizedValue = value.trim().toLowerCase()

    if (normalizedValue === "true") {
      return true
    }

    if (normalizedValue === "false") {
      return false
    }
  }

  return null
}

export const useContentApplicationReviewStore =
  create<ContentApplicationReviewStore>((set) => ({
    isFirstApprovalRejected: null,
    setIsFirstApprovalRejected: (value: unknown) =>
      set({ isFirstApprovalRejected: normalizeFirstApprovalRejected(value) }),
    resetIsFirstApprovalRejected: () =>
      set({ isFirstApprovalRejected: null }),
  }))
