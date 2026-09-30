import { useMemo } from "react"

const useSyncedVisible = (
  visible: boolean,
  onVisibleChange: (visible: boolean) => void
) => useMemo(() => ({
  get value() {
    return visible
  },
  set value(nextVisible: boolean) {
    onVisibleChange(nextVisible)
  },
}), [onVisibleChange, visible])

export default useSyncedVisible
