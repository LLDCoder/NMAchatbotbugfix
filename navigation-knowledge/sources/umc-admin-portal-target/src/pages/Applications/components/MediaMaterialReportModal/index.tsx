import {
  forwardRef,
  type ChangeEvent,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from "react"
import { Button, Checkbox, Form, Input, Modal, Select, Table } from "antd"
import { DownOutlined, RightOutlined } from "@ant-design/icons"
import type { ColumnsType } from "antd/lib/table"
import { CustomButton, CustomMessage } from "@/components/common"
import DocumentViewer from "@/components/common/DocumentViewer"
import { documentUpload } from "@/services/serviceApi"
import { taskApprovalAction } from "@/services/application"
import {
  getAgeClassifications,
  getMediaMaterialCategoryTree,
  type AgeClassificationDto,
  type MediaMaterialCategoryDto,
} from "@/services/services"
import {
  buildApplicationActionPayload,
  buildApplicationApprovalPayload,
  normalizeTaskAttachmentFileName,
  resolveApplicationWorkflowAction,
  type WorkflowActionIntent,
} from "../../utils/workflowActionRouting"
import { getMediaMaterialReportTitle } from "../../utils/workflowActionModalCopy"
import { useTranslation } from "react-i18next"
import type {
  IFieldType,
  IMediaMaterialReportModalProps,
  IMediaMaterialReportModalRef,
  IReportNote,
} from "./type"
import {
  type ResponsiveActionColumnButtonWidthMap,
  useResponsiveActionColumnWidth,
} from "@/hooks/useResponsiveActionColumnWidth"
import "./index.less"

type ReportType =
  | "Book"
  | "Cinema & Visual Media"
  | "Video Game"
  | "Newspaper Magazine & Other Media Content"
  | "Media Material"

interface ReportSection {
  key: string
  title: string
  options: ReportOption[]
}

interface ReportOption {
  label: string
  value: string | number
}

const REPORT_TYPE_BY_ACTION: Record<number, ReportType> = {
  3: "Book",
  4: "Cinema & Visual Media",
  5: "Video Game",
  6: "Newspaper Magazine & Other Media Content",
  104: "Book",
  105: "Cinema & Visual Media",
  106: "Video Game",
  107: "Newspaper Magazine & Other Media Content",
}

const MEDIA_MATERIAL_TYPE_ID_BY_ACTION: Partial<Record<number, number>> = {
  3: 9,
  4: 1,
  5: 4,
  104: 9,
  105: 1,
  106: 4,
}

const NOTE_ACTION_VALUES = ["Add", "Delete", "Change"]
const NOTE_ACTION_TRANSLATION_KEYS: Record<string, string> = {
  Add: "add",
  Delete: "delete",
  Change: "change",
}

type MediaReportNoteActionKey = "edit" | "delete"

const MEDIA_REPORT_NOTE_ACTION_WIDTH_MAP: ResponsiveActionColumnButtonWidthMap<MediaReportNoteActionKey> = {}

const MEDIA_REPORT_NOTE_ACTION_COLUMN_DESKTOP_CONFIG = {
  gap: 12,
  padding: 32,
  minWidth: 112,
  maxWidth: 160,
}

const MEDIA_REPORT_NOTE_ACTION_COLUMN_COMPACT_CONFIG = {
  gap: 8,
  padding: 32,
  minWidth: 112,
  maxWidth: 144,
}

const MEDIA_REPORT_NOTE_ACTION_TEXT_MEASURE_CONFIG = {
  font: "500 16px Inter, sans-serif",
  narrowFont: "500 14px Inter, sans-serif",
  textPadding: 0,
}

const getClassificationIds = (
  checks?: Record<string, Array<string | number> | null | undefined>
) => {
  return Object.values(checks || {})
    .flatMap((sectionValues) =>
      Array.isArray(sectionValues) ? sectionValues : []
    )
    .filter((value) => value !== null && value !== undefined && `${value}` !== "")
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value))
}

const toNullableString = (value?: string | number | null) => {
  if (value === null || value === undefined) {
    return null
  }

  const text = String(value).trim()
  return text || null
}

const SCENE_TIME_DEFAULT_VALUE = "00:00:00"

const getSceneTimeParts = (value?: string) => {
  const source = value || SCENE_TIME_DEFAULT_VALUE
  const parts = source.split(":")

  return [0, 1, 2].map((index) => {
    const digits = (parts[index] || "").replace(/\D/g, "").slice(0, 2)
    return digits || "00"
  })
}

const normalizeSceneTimePart = (value: string, index: number) => {
  const digits = value.replace(/\D/g, "").slice(0, 2)

  if (!digits) {
    return "00"
  }

  const max = index === 0 ? 99 : 59
  return Number(digits) > max ? String(max) : digits
}

const formatSceneTimePart = (value: string, index: number) =>
  normalizeSceneTimePart(value, index).padStart(2, "0")

const SceneTimeInput = ({
  value,
  onChange,
}: {
  value?: string
  onChange?: (value: string) => void
}) => {
  const parts = getSceneTimeParts(value)

  const updatePart = (index: number, event: ChangeEvent<HTMLInputElement>) => {
    const nextParts = [...parts]
    nextParts[index] = normalizeSceneTimePart(event.target.value, index)
    onChange?.(nextParts.join(":"))
  }

  const formatPart = (index: number) => {
    const nextParts = [...parts]
    nextParts[index] = formatSceneTimePart(nextParts[index], index)
    onChange?.(nextParts.join(":"))
  }

  return (
    <div className="media-note-scene-time-input">
      {parts.map((part, index) => (
        <div className="scene-time-segment" key={index}>
          {index > 0 && <span className="scene-time-separator">:</span>}
          <input
            aria-label={["Hours", "Minutes", "Seconds"][index]}
            inputMode="numeric"
            maxLength={2}
            value={part}
            onChange={(event) => updatePart(index, event)}
            onBlur={() => formatPart(index)}
            onFocus={(event) => event.target.select()}
          />
        </div>
      ))}
    </div>
  )
}

const buildReportNotes = (notes?: IReportNote[]) =>
  (notes || []).map((note) => ({
    Note: toNullableString(note.note),
    PageNumber: toNullableString(note.pageNumber),
    SceneTime: toNullableString(note.sceneTime),
    Action: toNullableString(note.action),
  }))

const normalizeLookupText = (value?: string) =>
  (value || "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim()

const getLocalizedName = (
  item: { nameEn?: string; nameAr?: string },
  isArabic: boolean
) =>
  normalizeLookupText(
    isArabic ? item.nameAr || item.nameEn : item.nameEn || item.nameAr
  )

const mapCategoryTreeToReportSections = (
  categories: MediaMaterialCategoryDto[],
  isArabic: boolean
): ReportSection[] =>
  categories.map((category) => ({
    key: `category:${category.id}`,
    title: getLocalizedName(category, isArabic),
    options: (category.children || [])
      .filter(
        (child) =>
          child.id !== null &&
          child.id !== undefined &&
          Number.isInteger(Number(child.id))
      )
      .map((child) => ({
        label: getLocalizedName(child, isArabic),
        value: Number(child.id),
      })),
  }))

const mapAgeClassificationsToOptions = (
  items: AgeClassificationDto[],
  isArabic: boolean
) =>
  items.map((item) => ({
    label: getLocalizedName(item, isArabic),
    value: item.id,
  }))

export const MediaMaterialReportModal = forwardRef<
  IMediaMaterialReportModalRef,
  IMediaMaterialReportModalProps
>((props, ref) => {
  const {
    current,
    onOkCb,
  } = props
  const { t, i18n } = useTranslation()
  const [visible, setVisible] = useState(false)
  const [loading, setLoading] = useState(false)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [noteVisible, setNoteVisible] = useState(false)
  const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null)
  const [lookupSections, setLookupSections] = useState<ReportSection[]>([])
  const [ageClassificationOptions, setAgeClassificationOptions] = useState<
    Array<{ label: string; value: string | number }>
  >([])
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    general: true,
  })
  const [intent, setIntent] = useState<WorkflowActionIntent>("approve")
  const [form] = Form.useForm<IFieldType>()
  const [noteForm] = Form.useForm<IReportNote>()
  const { config } = resolveApplicationWorkflowAction(current, intent)

  const reportType = REPORT_TYPE_BY_ACTION[config.action] || "Media Material"
  const usesPageNumber = reportType === "Book"
  const reportSections = lookupSections
  const noteActionOptions = useMemo(
    () =>
      NOTE_ACTION_VALUES.map((value) => ({
        label: t(
          `applications.approvalModals.mediaReport.noteActions.${NOTE_ACTION_TRANSLATION_KEYS[value]}`,
          value
        ),
        value,
      })),
    [t]
  )
  const requiresAgeClassification =
    reportType !== "Newspaper Magazine & Other Media Content"
  const watchedNotes = Form.useWatch("notes", form)
  const notes = useMemo(() => watchedNotes || [], [watchedNotes])
  const getVisibleNoteActions = () => ["edit", "delete"] as const
  const getNoteActionLabel = (actionKey: MediaReportNoteActionKey) => {
    if (actionKey === "edit") {
      return t("applications.approvalModals.mediaReport.edit", "Edit")
    }

    return t("applications.approvalModals.mediaReport.delete", "Delete")
  }
  const noteActionColumnWidth = useResponsiveActionColumnWidth<
    IReportNote,
    MediaReportNoteActionKey
  >({
    rows: notes,
    buttonWidthMap: MEDIA_REPORT_NOTE_ACTION_WIDTH_MAP,
    getVisibleActions: getVisibleNoteActions,
    getActionLabel: getNoteActionLabel,
    desktopConfig: MEDIA_REPORT_NOTE_ACTION_COLUMN_DESKTOP_CONFIG,
    compactConfig: MEDIA_REPORT_NOTE_ACTION_COLUMN_COMPACT_CONFIG,
    textMeasureConfig: MEDIA_REPORT_NOTE_ACTION_TEXT_MEASURE_CONFIG,
  })
  const checkedSections = Form.useWatch("checks", form) || {}
  const detailedReport = Form.useWatch("detailedReport", form)
  const ageClassification = Form.useWatch("ageClassification", form)
  const noteAction = Form.useWatch("action", noteForm)
  const noteText = Form.useWatch("note", noteForm)
  const notePageNumber = Form.useWatch("pageNumber", noteForm)
  const noteSceneTime = Form.useWatch("sceneTime", noteForm)
  const mediaMaterialTypeId = MEDIA_MATERIAL_TYPE_ID_BY_ACTION[config.action]
  const canSubmit = Boolean(
    detailedReport && (!requiresAgeClassification || ageClassification)
  )
  const canSaveNote = Boolean(
    toNullableString(noteAction) &&
      toNullableString(noteText) &&
      (usesPageNumber
        ? toNullableString(notePageNumber)
        : toNullableString(noteSceneTime))
  )

  const resetNoteFields = () => {
    noteForm.resetFields()

    if (!usesPageNumber) {
      noteForm.setFieldsValue({ sceneTime: SCENE_TIME_DEFAULT_VALUE })
    }
  }

  const closeNoteModal = () => {
    setNoteVisible(false)
    setEditingNoteIndex(null)
    resetNoteFields()
  }

  useEffect(() => {
    if (!visible || !mediaMaterialTypeId) {
      setLookupSections([])
      setAgeClassificationOptions([])
      return
    }

    let isActive = true
    const isArabic = i18n.language?.startsWith("ar")

    setLookupLoading(true)
    setLookupSections([])
    setAgeClassificationOptions([])
    Promise.all([
      getMediaMaterialCategoryTree(mediaMaterialTypeId),
      getAgeClassifications(mediaMaterialTypeId),
    ])
      .then(([categoryResponse, ageResponse]) => {
        if (!isActive) return

        const nextSections = mapCategoryTreeToReportSections(
          categoryResponse?.data || [],
          isArabic
        )
        const nextAgeOptions = mapAgeClassificationsToOptions(
          ageResponse?.data || [],
          isArabic
        )

        setLookupSections(nextSections)
        setAgeClassificationOptions(nextAgeOptions)
        setOpenSections(
          nextSections[0]
            ? { [nextSections[0].key]: true }
            : { general: true }
        )
      })
      .catch((error) => {
        console.error("Load media material report lookup failed:", error)
        if (!isActive) return
        setLookupSections([])
        setAgeClassificationOptions([])
        setOpenSections({ general: true })
      })
      .finally(() => {
        if (isActive) {
          setLookupLoading(false)
        }
      })

    return () => {
      isActive = false
    }
  }, [i18n.language, mediaMaterialTypeId, visible])

  useImperativeHandle(ref, () => ({
    show: (nextIntent) => {
      setIntent(nextIntent)
      form.resetFields()
      noteForm.resetFields()
      setEditingNoteIndex(null)
      setLookupSections([])
      setAgeClassificationOptions([])
      setOpenSections({ general: true })
      setVisible(true)
    },
  }))

  const noteColumns = useMemo<ColumnsType<IReportNote>>(
    () => [
      {
        title:
          usesPageNumber
            ? t("applications.approvalModals.mediaReport.pageNumber", "Page Number")
            : t("applications.approvalModals.mediaReport.sceneTime", "Scene Time"),
        dataIndex: usesPageNumber ? "pageNumber" : "sceneTime",
        width: 140,
      },
      {
        title: t("applications.approvalModals.mediaReport.action", "Action"),
        dataIndex: "action",
        width: 120,
        render: (value?: string) =>
          value
            ? t(
                `applications.approvalModals.mediaReport.noteActions.${NOTE_ACTION_TRANSLATION_KEYS[value]}`,
                value
              )
            : "",
      },
      {
        title: t("applications.approvalModals.mediaReport.note", "Note"),
        dataIndex: "note",
        ellipsis: true,
      },
      {
        title: t("applications.approvalModals.mediaReport.actions", "Actions"),
        width: noteActionColumnWidth,
        render: (_, record, index) => (
          <div className="media-report-table-actions">
            <Button
              type="link"
              onClick={() => {
                setEditingNoteIndex(index)
                noteForm.setFieldsValue({
                  ...record,
                  ...(!usesPageNumber && !record.sceneTime
                    ? { sceneTime: SCENE_TIME_DEFAULT_VALUE }
                    : {}),
                })
                setNoteVisible(true)
              }}
            >
              {t("applications.approvalModals.mediaReport.edit", "Edit")}
            </Button>
            <Button
              type="link"
              onClick={() => {
                const nextNotes = [...notes]
                nextNotes.splice(index, 1)
                form.setFieldValue("notes", nextNotes)
              }}
            >
              {t("applications.approvalModals.mediaReport.delete", "Delete")}
            </Button>
          </div>
        ),
      },
    ],
    [form, noteActionColumnWidth, noteForm, notes, t, usesPageNumber]
  )

  const upload = async (options: Record<string, any>) => {
    const { file, onSuccess, onError } = options
    const formData = new FormData()
    formData.append("files", file)
    try {
      const res = await documentUpload(formData)
      if (res.data && res.data.length > 0) {
        onSuccess(res.data[0])
      }
    } catch (error) {
      console.error("Upload failed:", error)
      onError?.(error)
    }
  }

  const onSubmit = async () => {
    try {
      const values = await form.validateFields()
      setLoading(true)
      const response = await taskApprovalAction(
        buildApplicationApprovalPayload(current, config, {
          approvalComment: values.detailedReport,
          rejectReasonFile: normalizeTaskAttachmentFileName(
            values.obligationLetter
          ),
          actionPayload: buildApplicationActionPayload({
            detailedReport: values.detailedReport,
            ageClassification: values.ageClassification,
            classificationIds: getClassificationIds(values.checks),
            notes: buildReportNotes(values.notes),
          }),
        })
      )
      await onOkCb?.(response?.data?.nextTaskId)
      setVisible(false)
    } catch (error) {
      if (error && typeof error === "object" && "errorFields" in (error as any)) {
        return
      }
      CustomMessage.error(error as string)
    } finally {
      setLoading(false)
    }
  }

  const onAddNote = async () => {
    try {
      const values = await noteForm.validateFields()
      if (editingNoteIndex === null) {
        form.setFieldValue("notes", [...notes, values])
      } else {
        const nextNotes = [...notes]
        nextNotes[editingNoteIndex] = values
        form.setFieldValue("notes", nextNotes)
      }
      setNoteVisible(false)
      setEditingNoteIndex(null)
      resetNoteFields()
    } catch (error) {}
  }

  const getSelectedOptions = (section: ReportSection) =>
    checkedSections?.[section.key] || []

  const toggleSection = (sectionKey: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }))
  }

  const toggleSectionOptions = (
    section: ReportSection,
    checked: boolean
  ) => {
    form.setFieldValue(
      ["checks", section.key],
      checked ? section.options.map((option) => option.value) : []
    )
  }

  const renderReportSections = () => {
    if (!reportSections.length) {
      return null
    }

    return (
      <div className="media-report-sections">
        {reportSections.map((section) => {
          const selectedOptions = getSelectedOptions(section)
          const isOpen = Boolean(openSections[section.key])
          const isAllChecked =
            section.options.length > 0 &&
            selectedOptions.length === section.options.length

          return (
            <div
              key={section.key}
              className={`media-report-section ${isOpen ? "is-open" : ""}`}
            >
              <div
                className="media-report-section-header"
                role="button"
                tabIndex={0}
                onClick={() => toggleSection(section.key)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    toggleSection(section.key)
                  }
                }}
              >
                <div className="media-report-section-title">
                  {isOpen ? <DownOutlined /> : <RightOutlined />}
                  <Checkbox
                    checked={isAllChecked}
                    indeterminate={
                      selectedOptions.length > 0 &&
                      selectedOptions.length < section.options.length
                    }
                    onClick={(event) => {
                      event.stopPropagation()
                    }}
                    onChange={(event) =>
                      toggleSectionOptions(section, event.target.checked)
                    }
                  />
                  <span>{section.title}</span>
                </div>
                <span className="media-report-section-count">
                  <span>{selectedOptions.length}</span> / {section.options.length}
                </span>
              </div>
              <Form.Item name={["checks", section.key]} noStyle>
                <Checkbox.Group
                  className={`media-report-option-list ${
                    isOpen ? "" : "is-collapsed"
                  }`}
                >
                  {isOpen &&
                    section.options.map((option) => (
                      <Checkbox
                        className="media-report-option"
                        key={String(option.value)}
                        value={option.value}
                      >
                        {option.label}
                      </Checkbox>
                    ))}
                </Checkbox.Group>
              </Form.Item>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <>
      <Modal
        centered
        title={getMediaMaterialReportTitle(t)}
        visible={visible}
        destroyOnClose
        width={960}
        className="form-modal media-material-report-modal"
        onCancel={() => setVisible(false)}
        footer={
          <div>
            <CustomButton
              text={t("applications.approvalModals.common.cancel", "Cancel")}
              variant="outline"
              disabled={loading}
              onClick={() => setVisible(false)}
            />
            <CustomButton
              text={t("applications.approvalModals.common.confirm", "Confirm")}
              variant="primary"
              disabled={!canSubmit}
              loading={loading}
              onClick={onSubmit}
            />
          </div>
        }
      >
        <Form
          form={form}
          layout="vertical"
          className="custom-form media-report-form"
        >
          {renderReportSections()}

          <div
            className={`media-report-row ${
              requiresAgeClassification ? "" : "media-report-row-single"
            }`}
          >
            {requiresAgeClassification && (
              <Form.Item
                name="ageClassification"
                label={t(
                  "applications.approvalModals.mediaReport.ageClassification",
                  "Age Classification"
                )}
                className="media-report-row-field"
                rules={[
                  {
                    required: true,
                    message: t(
                      "applications.approvalModals.mediaReport.ageClassificationRequired",
                      "Please select age classification"
                    ),
                  },
                ]}
              >
                <Select
                  placeholder={t(
                    "applications.approvalModals.mediaReport.selectAgeClassification",
                    "Select Age Classification"
                  )}
                  loading={lookupLoading}
                  options={ageClassificationOptions}
                />
              </Form.Item>
            )}
            <Form.Item
              name="obligationLetter"
              label={t(
                "applications.approvalModals.mediaReport.uploadObligationLetter",
                "Upload Obligation Letter"
              )}
              className="media-report-row-field"
            >
              <DocumentViewer
                hasDelete
                hasDownload
                uploadConfig={{
                  customRequest: upload,
                  maxSize: 5,
                  maxCount: 5,
                  placeholder: t(
                    "applications.approvalModals.common.upload",
                    "Upload"
                  ),
                  uploadTip: t(
                    "applications.approvalModals.common.uploadTip",
                    "Maximum Size: 5MB, File Types: jpg, jpeg, png, and pdf."
                  ),
                }}
              />
            </Form.Item>
          </div>

          <Form.Item
            name="detailedReport"
            label={t(
              "applications.approvalModals.mediaReport.detailedReport",
              "Detailed Report"
            )}
            className="media-report-detail-item"
            rules={[
              {
                required: true,
                message: t(
                  "applications.approvalModals.mediaReport.detailedReportRequired",
                  "Detailed report is required"
                ),
              },
            ]}
          >
            <Input.TextArea
              className="custom-textarea"
              showCount
              rows={4}
              placeholder={t(
                "applications.approvalModals.common.enterNotes",
                "Enter notes"
              )}
              maxLength={1000}
            />
          </Form.Item>

          <Form.Item name="notes" hidden initialValue={[]} />

          <div className="media-report-note-header">
            <h3>
              {t("applications.approvalModals.mediaReport.noteList", "Note List")}
            </h3>
            <Button
              type="primary"
              onClick={() => {
                setEditingNoteIndex(null)
                resetNoteFields()
                setNoteVisible(true)
              }}
            >
              {t("applications.approvalModals.mediaReport.addNew", "Add New")}
            </Button>
          </div>
          <div className="media-report-note-table">
            <Table
              rowKey={(_, index) => String(index)}
              pagination={false}
              columns={noteColumns}
              dataSource={notes}
              size="small"
            />
          </div>
        </Form>
      </Modal>

      <Modal
        centered
        title={t(
          "applications.approvalModals.mediaReport.addNewNote",
          "Add New Note"
        )}
        visible={noteVisible}
        destroyOnClose
        width={720}
        className="form-modal media-note-modal"
        onCancel={closeNoteModal}
        footer={
          <div>
            <CustomButton
              text={t("applications.approvalModals.common.cancel", "Cancel")}
              variant="outline"
              onClick={closeNoteModal}
            />
            <CustomButton
              text={t("common.save", "Save")}
              variant="primary"
              disabled={!canSaveNote}
              onClick={onAddNote}
            />
          </div>
        }
      >
        <Form form={noteForm} layout="vertical" className="custom-form media-note-form">
          {usesPageNumber ? (
            <Form.Item
              name="pageNumber"
              label={t("applications.approvalModals.mediaReport.pageNumber", "Page Number")}
              rules={[
                {
                  required: true,
                  message: t(
                    "applications.approvalModals.mediaReport.fieldRequired",
                    "This field is required"
                  ),
                },
              ]}
            >
              <Input
                placeholder={t(
                  "applications.approvalModals.mediaReport.enterPageNumber",
                  "Enter page number"
                )}
              />
            </Form.Item>
          ) : (
            <Form.Item
              name="sceneTime"
              initialValue={SCENE_TIME_DEFAULT_VALUE}
              label={t("applications.approvalModals.mediaReport.sceneTime", "Scene Time")}
              rules={[
                {
                  required: true,
                  message: t(
                    "applications.approvalModals.mediaReport.fieldRequired",
                    "This field is required"
                  ),
                },
              ]}
            >
              <SceneTimeInput />
            </Form.Item>
          )}
          <Form.Item
            name="action"
            label={t("applications.approvalModals.mediaReport.action", "Action")}
            rules={[
              {
                required: true,
                message: t(
                  "applications.approvalModals.mediaReport.actionRequired",
                  "Please select action"
                ),
              },
            ]}
          >
            <Select
              placeholder={t(
                "applications.approvalModals.mediaReport.selectAction",
                "Select action"
              )}
              options={noteActionOptions}
            />
          </Form.Item>
          <Form.Item
            name="note"
            label={t("applications.approvalModals.mediaReport.note", "Note")}
            rules={[
              {
                required: true,
                message: t(
                  "applications.approvalModals.mediaReport.noteRequired",
                  "Note is required"
                ),
              },
            ]}
          >
            <Input.TextArea
              className="custom-textarea"
              showCount
              rows={4}
              maxLength={1000}
              placeholder={t(
                "applications.approvalModals.mediaReport.enterNote",
                "Enter note"
              )}
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
})
