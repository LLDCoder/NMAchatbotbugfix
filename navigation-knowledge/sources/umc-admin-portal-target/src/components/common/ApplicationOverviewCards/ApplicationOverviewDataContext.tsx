import React, { useContext, useEffect, useMemo, useState } from "react"
import { getRelateApps, type IRelateAppsResponse } from "@/services/tickets"
import {
  getUserProfileRelateApps,
  profileAndApplicant,
} from "@/services/userProfile"
import { resolveOverviewProfileType } from "./utils/profileType"
import { resolveProfileTypeFromUserTypeId } from "./utils/userType"
import type {
  ApplicationOverviewProfileData,
  ApplicationOverviewProfileType,
} from "./types"

export interface ApplicationOverviewDataContextValue {
  userProfileId?: number
  profileAndApplicantData: ApplicationOverviewProfileData | null
  applicationOverviewRelatedSectionData: IRelateAppsResponse | null
  applicationOverviewRelatedProfileType: ApplicationOverviewProfileType
  applicationType: ApplicationOverviewProfileType
  loading: boolean
  relatedSectionLoading: boolean
}

interface ApplicationOverviewDataProviderProps {
  userProfileId?: string | number | false | null
  enquiryId?: string | number | false | null
  applicationId?: string | number | false | null
  profileAndApplicantData?: ApplicationOverviewProfileData | null
  children: React.ReactNode
}

const DEFAULT_CONTEXT_VALUE: ApplicationOverviewDataContextValue = {
  userProfileId: undefined,
  profileAndApplicantData: null,
  applicationOverviewRelatedSectionData: null,
  applicationOverviewRelatedProfileType: "Individual",
  applicationType: "Individual",
  loading: false,
  relatedSectionLoading: false,
}

const ApplicationOverviewDataContext =
  React.createContext<ApplicationOverviewDataContextValue>(DEFAULT_CONTEXT_VALUE)

const toApplicationType = (
  userTypeId: ApplicationOverviewProfileData["userTypeId"],
): ApplicationOverviewProfileType =>
  resolveProfileTypeFromUserTypeId(userTypeId, "Individual")

const toNumericProfileId = (
  value: string | number | false | null | undefined,
): number | undefined => {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? value : undefined
  }

  if (typeof value === "string") {
    const numericValue = Number(value)
    return Number.isFinite(numericValue) && numericValue > 0
      ? numericValue
      : undefined
  }

  return undefined
}

const toRelatedSectionData = (
  value: unknown,
): IRelateAppsResponse | null => {
  if (!value || typeof value !== "object") {
    return null
  }

  const payload = value as IRelateAppsResponse

  return {
    ...payload,
    applications: Array.isArray(payload.applications) ? payload.applications : [],
    enquiryServices: Array.isArray(payload.enquiryServices)
      ? payload.enquiryServices
      : [],
    refunds: Array.isArray(payload.refunds) ? payload.refunds : [],
    appeals: Array.isArray(payload.appeals) ? payload.appeals : [],
  }
}

export const ApplicationOverviewDataProvider: React.FC<
  ApplicationOverviewDataProviderProps
> = ({
  userProfileId,
  enquiryId,
  applicationId,
  profileAndApplicantData: providedProfileAndApplicantData,
  children,
}) => {
  const [profileAndApplicantData, setProfileAndApplicantData] =
    useState<ApplicationOverviewProfileData | null>(null)
  const [applicationOverviewRelatedSectionData, setApplicationOverviewRelatedSectionData] =
    useState<IRelateAppsResponse | null>(null)
  const [applicationType, setApplicationType] =
    useState<ApplicationOverviewProfileType>("Individual")
  const [loading, setLoading] = useState(false)
  const [relatedSectionLoading, setRelatedSectionLoading] = useState(false)
  const normalizedUserProfileId = useMemo(
    () => toNumericProfileId(userProfileId),
    [userProfileId],
  )
  const normalizedEnquiryId = useMemo(
    () => toNumericProfileId(enquiryId),
    [enquiryId],
  )
  const normalizedApplicationId = useMemo(
    () => toNumericProfileId(applicationId),
    [applicationId],
  )
  const isProfileAndApplicantDataControlled =
    providedProfileAndApplicantData !== undefined
  const resolvedProfileAndApplicantData =
    isProfileAndApplicantDataControlled
      ? providedProfileAndApplicantData
      : profileAndApplicantData
  const resolvedApplicationType = isProfileAndApplicantDataControlled
    ? toApplicationType(providedProfileAndApplicantData?.userTypeId)
    : applicationType

  useEffect(() => {
    let isCancelled = false

    setApplicationOverviewRelatedSectionData(null)
    setRelatedSectionLoading(false)

    if (!normalizedEnquiryId && !normalizedUserProfileId) {
      return () => {
        isCancelled = true
      }
    }

    const loadRelatedSectionData = async () => {
      setRelatedSectionLoading(true)

      try {
        const response = normalizedEnquiryId
          ? await getRelateApps(normalizedEnquiryId)
          : await getUserProfileRelateApps(
              normalizedUserProfileId as number,
              normalizedApplicationId,
            )
        const nextData = toRelatedSectionData(response?.data)

        if (isCancelled) {
          return
        }

        setApplicationOverviewRelatedSectionData(nextData)
      } catch {
        if (!isCancelled) {
          setApplicationOverviewRelatedSectionData(null)
        }
      } finally {
        if (!isCancelled) {
          setRelatedSectionLoading(false)
        }
      }
    }

    void loadRelatedSectionData()

    return () => {
      isCancelled = true
    }
  }, [normalizedApplicationId, normalizedEnquiryId, normalizedUserProfileId])

  const applicationOverviewRelatedProfileType = useMemo(() => {
    const fallbackType = resolvedApplicationType

    if (
      applicationOverviewRelatedSectionData?.type !== undefined &&
      applicationOverviewRelatedSectionData?.type !== null &&
      String(applicationOverviewRelatedSectionData.type).trim() !== ""
    ) {
      return resolveOverviewProfileType(
        applicationOverviewRelatedSectionData.type,
        fallbackType,
      )
    }

    if (
      applicationOverviewRelatedSectionData?.userTypeId !== undefined &&
      applicationOverviewRelatedSectionData?.userTypeId !== null
    ) {
      return toApplicationType(applicationOverviewRelatedSectionData.userTypeId)
    }

    return fallbackType
  }, [applicationOverviewRelatedSectionData, resolvedApplicationType])

  useEffect(() => {
    let isCancelled = false

    setProfileAndApplicantData(null)
    setApplicationType("Individual")
    setLoading(false)

    if (isProfileAndApplicantDataControlled) {
      return () => {
        isCancelled = true
      }
    }

    if (!normalizedUserProfileId) {
      return () => {
        isCancelled = true
      }
    }

    const loadProfileAndApplicantData = async () => {
      setLoading(true)
      try {
        const response = await profileAndApplicant(normalizedUserProfileId)
        const rawData =
          response?.data && typeof response.data === "object"
            ? (response.data as ApplicationOverviewProfileData)
            : null

        if (isCancelled) {
          return
        }

        setProfileAndApplicantData(rawData)
        setApplicationType(toApplicationType(rawData?.userTypeId))
      } catch {
        if (isCancelled) {
          return
        }

        setProfileAndApplicantData(null)
        setApplicationType("Individual")
      } finally {
        if (!isCancelled) {
          setLoading(false)
        }
      }
    }

    void loadProfileAndApplicantData()

    return () => {
      isCancelled = true
    }
  }, [isProfileAndApplicantDataControlled, normalizedUserProfileId])

  const value = useMemo(
    () => ({
      userProfileId: normalizedUserProfileId,
      profileAndApplicantData: resolvedProfileAndApplicantData,
      applicationOverviewRelatedSectionData,
      applicationOverviewRelatedProfileType,
      applicationType: resolvedApplicationType,
      loading: isProfileAndApplicantDataControlled ? false : loading,
      relatedSectionLoading,
    }),
    [
      applicationOverviewRelatedProfileType,
      applicationOverviewRelatedSectionData,
      isProfileAndApplicantDataControlled,
      loading,
      normalizedUserProfileId,
      relatedSectionLoading,
      resolvedApplicationType,
      resolvedProfileAndApplicantData,
    ],
  )

  return (
    <ApplicationOverviewDataContext.Provider value={value}>
      {children}
    </ApplicationOverviewDataContext.Provider>
  )
}

export const useApplicationOverviewData = () =>
  useContext(ApplicationOverviewDataContext)
