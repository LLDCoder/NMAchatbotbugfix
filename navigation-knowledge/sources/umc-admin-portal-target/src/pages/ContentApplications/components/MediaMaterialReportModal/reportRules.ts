interface MediaMaterialReportRules {
  showAgeClassification: boolean
  showDetailedReport: boolean
  showNotes: boolean
  includeNotesInPayload: boolean
}

interface MediaMaterialReportSubmissionValues {
  detailedReport?: string
  ageClassification?: string | number
  classificationIds?: number[]
  notes?: unknown[]
}

const SERVICES_WITHOUT_AGE_CLASSIFICATION = new Set(["21", "1005"])
const AGE_CLASSIFICATION_ONLY_SERVICE_CODE = "2201"

export const getMediaMaterialReportRules = (
  serviceCode?: string | number | null,
  isNewspaperMagazineReport = false
): MediaMaterialReportRules => {
  const normalizedServiceCode = String(serviceCode ?? "").trim()
  const isAgeClassificationOnly =
    normalizedServiceCode === AGE_CLASSIFICATION_ONLY_SERVICE_CODE

  return {
    showAgeClassification:
      !isNewspaperMagazineReport &&
      !SERVICES_WITHOUT_AGE_CLASSIFICATION.has(normalizedServiceCode),
    showDetailedReport: !isAgeClassificationOnly,
    showNotes: !isNewspaperMagazineReport && !isAgeClassificationOnly,
    includeNotesInPayload: !isAgeClassificationOnly,
  }
}

export const buildMediaMaterialReportSubmission = (
  rules: MediaMaterialReportRules,
  values: MediaMaterialReportSubmissionValues
) => ({
  ...(rules.showDetailedReport
    ? { approvalComment: values.detailedReport }
    : {}),
  actionPayload: {
    ...(rules.showDetailedReport && values.detailedReport
      ? { detailedReport: values.detailedReport }
      : {}),
    ...(rules.showAgeClassification && values.ageClassification
      ? { ageClassification: values.ageClassification }
      : {}),
    ...(values.classificationIds
      ? { classificationIds: values.classificationIds }
      : {}),
    ...(rules.includeNotesInPayload && values.notes
      ? { notes: values.notes }
      : {}),
  },
})
