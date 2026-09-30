import { useEffect, useState } from "react"
import type { TFunction } from "i18next"
import {
  getApplicationStatuses,
  getServiceConfigServiceType,
  type IApplicationStatus,
  type IServiceType,
} from "@/services/application"
import {
  buildApplicationStatusOptions,
  buildApplicationTypeOptions,
  unwrapApplicationDictionaryItems,
} from "@/pages/CustomerDetails/components/allProfilesOverviewTabs/applicationFilterOptions"
import {
  getInspectionInspectors,
  getInspectionPriorities,
  getInspectionReasons,
  getInspectionTaskStatuses,
  type InspectionLookupOption,
} from "@/services/inspection"
import type { InspectionNoFullScanSelectOption } from "@/pages/CustomerDetails/types"
import {
  buildInspectionLookupOptions,
  buildInspectionPriorityOptions,
  buildInspectionStatusOptions,
} from "@/pages/CustomerDetails/components/allProfilesOverviewTabs/inspectionProfileUtils"

type SelectOption = {
  label: string
  value: string
}

type UseFullScreenFilterOptionsParams = {
  isArabic: boolean
  t: TFunction
}

const buildPaymentsTransactionTypeOptions = (t: (key: string) => string) => [
  { label: t("Customer.customerDetails.common.allTypes"), value: "" },
  {
    label: t("Customer.customerDetails.tabs.payments.serviceApplication"),
    value: "2",
  },
  { label: t("Customer.customerDetails.tabs.payments.fines"), value: "3" },
  { label: t("Customer.customerDetails.tabs.payments.refund"), value: "4" },
]

const buildPaymentsStatusOptions = (t: (key: string) => string) => [
  { label: t("Customer.customerDetails.common.allStatuses"), value: "" },
  { label: t("customStatusTag.completed"), value: "3" },
  { label: t("customStatusTag.failedRefund"), value: "8" },
  { label: t("customStatusTag.failed"), value: "4" },
  { label: t("customStatusTag.refunded"), value: "7" },
]

const buildPaymentsPaymentMethodOptions = (t: (key: string) => string) => [
  {
    label: t("Customer.customerDetails.tabs.payments.allPaymentMethod"),
    value: "",
  },
  { label: t("Customer.customerDetails.tabs.payments.wallet"), value: "9" },
  {
    label: t("Customer.customerDetails.tabs.payments.creditDebitCard"),
    value: "8",
  },
]

export const useFullScreenFilterOptions = ({
  isArabic,
  t,
}: UseFullScreenFilterOptionsParams) => {
  const [typeFilterOptions, setTypeFilterOptions] = useState<SelectOption[]>([
    { label: t("applicationOverviewCards.allTypes"), value: "" },
  ])
  const [applicationsStatusOptions, setApplicationsStatusOptions] = useState<
    SelectOption[]
  >([{ label: t("applicationOverviewCards.allStatuses"), value: "" }])
  const [paymentsTransactionTypeOptions, setPaymentsTransactionTypeOptions] =
    useState<SelectOption[]>(buildPaymentsTransactionTypeOptions(t))
  const [paymentsStatusOptions, setPaymentsStatusOptions] = useState<
    SelectOption[]
  >(buildPaymentsStatusOptions(t))
  const [paymentsPaymentMethodOptions, setPaymentsPaymentMethodOptions] =
    useState<SelectOption[]>(buildPaymentsPaymentMethodOptions(t))
  const [
    inspectionNoFullScanReasonOptions,
    setInspectionNoFullScanReasonOptions,
  ] = useState<InspectionNoFullScanSelectOption[]>([])
  const [
    inspectionNoFullScanStatusOptions,
    setInspectionNoFullScanStatusOptions,
  ] = useState<InspectionNoFullScanSelectOption[]>(
    buildInspectionStatusOptions([], isArabic, t),
  )
  const [
    inspectionNoFullScanPriorityOptions,
    setInspectionNoFullScanPriorityOptions,
  ] = useState<InspectionNoFullScanSelectOption[]>(
    buildInspectionPriorityOptions([], isArabic, t),
  )
  const [
    inspectionNoFullScanInspectorOptions,
    setInspectionNoFullScanInspectorOptions,
  ] = useState<InspectionNoFullScanSelectOption[]>([])

  useEffect(() => {
    let cancelled = false

    setPaymentsTransactionTypeOptions(buildPaymentsTransactionTypeOptions(t))
    setPaymentsStatusOptions(buildPaymentsStatusOptions(t))
    setPaymentsPaymentMethodOptions(buildPaymentsPaymentMethodOptions(t))
    setInspectionNoFullScanStatusOptions(
      buildInspectionStatusOptions([], isArabic, t),
    )
    setInspectionNoFullScanPriorityOptions(
      buildInspectionPriorityOptions([], isArabic, t),
    )

    const loadApplicationOptions = async () => {
      try {
        const [serviceTypeRes, applicationStatusRes] = await Promise.all([
          getServiceConfigServiceType(),
          getApplicationStatuses(),
        ])

        const serviceTypeList =
          unwrapApplicationDictionaryItems<IServiceType>(serviceTypeRes)
        const applicationStatusList =
          unwrapApplicationDictionaryItems<IApplicationStatus>(
            applicationStatusRes,
          )

        const mappedServiceTypes = buildApplicationTypeOptions(
          serviceTypeList,
          isArabic,
          t("applicationOverviewCards.allTypes"),
        )
        const mappedApplicationStatuses = buildApplicationStatusOptions(
          applicationStatusList,
          isArabic,
          t("applicationOverviewCards.allStatuses"),
        )

        if (cancelled) return
        setTypeFilterOptions(mappedServiceTypes)
        setApplicationsStatusOptions(mappedApplicationStatuses)
      } catch (error) {
        console.error(error)
        if (cancelled) return
        setTypeFilterOptions(
          buildApplicationTypeOptions(
            [],
            isArabic,
            t("applicationOverviewCards.allTypes"),
          ),
        )
        setApplicationsStatusOptions([
          { label: t("applicationOverviewCards.allStatuses"), value: "" },
        ])
      }
    }

    const loadInspectionOptions = async () => {
      const [reasons, statuses, priorities, inspectors] = await Promise.all([
        getInspectionReasons().catch(() => [] as InspectionLookupOption[]),
        getInspectionTaskStatuses().catch(() => [] as InspectionLookupOption[]),
        getInspectionPriorities().catch(() => [] as InspectionLookupOption[]),
        getInspectionInspectors().catch(() => [] as InspectionLookupOption[]),
      ])

      if (cancelled) return
      setInspectionNoFullScanReasonOptions(
        buildInspectionLookupOptions(reasons, isArabic, "code"),
      )
      setInspectionNoFullScanStatusOptions(
        buildInspectionStatusOptions(statuses, isArabic, t),
      )
      setInspectionNoFullScanPriorityOptions(
        buildInspectionPriorityOptions(priorities, isArabic, t),
      )
      setInspectionNoFullScanInspectorOptions(
        buildInspectionLookupOptions(inspectors, isArabic),
      )
    }

    void loadApplicationOptions()
    void loadInspectionOptions()

    return () => {
      cancelled = true
    }
  }, [isArabic, t])

  return {
    typeFilterOptions,
    applicationsStatusOptions,
    paymentsTransactionTypeOptions,
    paymentsStatusOptions,
    paymentsPaymentMethodOptions,
    inspectionNoFullScanReasonOptions,
    inspectionNoFullScanStatusOptions,
    inspectionNoFullScanPriorityOptions,
    inspectionNoFullScanInspectorOptions,
  }
}
