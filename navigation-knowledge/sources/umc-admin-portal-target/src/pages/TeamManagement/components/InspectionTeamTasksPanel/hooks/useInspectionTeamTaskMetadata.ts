import { useCallback, useRef, useState, type MutableRefObject } from "react"
import { CustomMessage } from "@/components/common"
import {
  getInspectionTeamManagementMembers,
  getInspectionTeamManagementMetadata,
} from "@/services/inspectionTeamManagement"
import type { InspectorSelectOption } from "@/pages/InspectionTaskManagement/components/InspectorSelect"
import {
  buildInspectionTeamTaskMetadataOptions,
  createDefaultInspectionTeamTaskMetadataOptions,
  normalizeInspectionMemberInspectorOptions,
} from "../utils"
import type { InspectionTeamTaskMetadataOptions } from "../type"

interface UseInspectionTeamTaskMetadataParams {
  mountedRef: MutableRefObject<boolean>
  t: (key: string) => string
  language: string
}

export const useInspectionTeamTaskMetadata = ({
  mountedRef,
  t,
  language,
}: UseInspectionTeamTaskMetadataParams) => {
  const [metadata, setMetadata] = useState<InspectionTeamTaskMetadataOptions>(
    createDefaultInspectionTeamTaskMetadataOptions()
  )
  const [taskInspectorOptions, setTaskInspectorOptions] = useState<
    InspectorSelectOption[]
  >([])
  const [taskInspectorOptionsLoading, setTaskInspectorOptionsLoading] =
    useState(false)
  const taskInspectorOptionsLoadedRef = useRef(false)
  const taskInspectorOptionsLoadingRef = useRef(false)
  const metadataRequestRef = useRef(0)

  const loadMetadata = useCallback(async () => {
    const requestId = metadataRequestRef.current + 1
    metadataRequestRef.current = requestId
    try {
      const response = await getInspectionTeamManagementMetadata()
      const nextMetadata = buildInspectionTeamTaskMetadataOptions(response, language)
      if (!mountedRef.current || requestId !== metadataRequestRef.current) {
        return
      }

      setMetadata(nextMetadata)
    } catch {
      if (!mountedRef.current || requestId !== metadataRequestRef.current) {
        return
      }

      setMetadata(createDefaultInspectionTeamTaskMetadataOptions())
    }
  }, [language, mountedRef])

  const loadTaskInspectorOptions = useCallback(async () => {
    if (
      taskInspectorOptionsLoadedRef.current ||
      taskInspectorOptionsLoadingRef.current
    ) {
      return
    }

    taskInspectorOptionsLoadingRef.current = true

    try {
      if (mountedRef.current) {
        setTaskInspectorOptionsLoading(true)
      }

      const response = await getInspectionTeamManagementMembers({})
      if (!mountedRef.current) {
        return
      }

      setTaskInspectorOptions(
        normalizeInspectionMemberInspectorOptions(response?.cards)
      )
      taskInspectorOptionsLoadedRef.current = true
    } catch {
      if (!mountedRef.current) {
        return
      }

      setTaskInspectorOptions([])
      taskInspectorOptionsLoadedRef.current = false
      CustomMessage.error(t("teamManagement.messages.failedToLoadMembers"))
    } finally {
      taskInspectorOptionsLoadingRef.current = false

      if (mountedRef.current) {
        setTaskInspectorOptionsLoading(false)
      }
    }
  }, [mountedRef, t])

  const ensureTaskInspectorOptionsLoaded = useCallback(async () => {
    if (
      taskInspectorOptionsLoadedRef.current ||
      taskInspectorOptionsLoadingRef.current
    ) {
      return
    }

    await loadTaskInspectorOptions()
  }, [loadTaskInspectorOptions])

  return {
    ensureTaskInspectorOptionsLoaded,
    loadMetadata,
    metadata,
    taskInspectorOptions,
    taskInspectorOptionsLoading,
  }
}
