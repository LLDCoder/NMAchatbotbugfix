import { useCallback, useEffect, useMemo, useState, type FC } from "react"
import { Form } from "antd"
import { useTranslation } from "react-i18next"
import warningYellowBg from "@/assets/images/warning_yellow_bg.png"
import { CustomMessage, SelectAllDropdown } from "@/components/common"
import {
  assignInspectionTeamManagementMemberArea,
  getInspectionTeamManagementMetadata,
  type InspectionTeamManagementLocationOptionDto,
} from "@/services/inspectionTeamManagement"
import {
  buildInspectionAssignedAreaNodes,
  isInspectionCampaignSelectionValid,
  pruneInspectionAreaSelection,
  requiresInspectionRegion,
  type InspectionLocationOption,
} from "@/pages/InspectionCommon/inspectionAreaSelection"
import { TeamManagementModal } from "../TeamManagementModal"
import type { AreaFormValues, AreaOption, AssignedAreaModalProps } from "./type"
import "./index.less"

const getSelectPopupContainer = () => document.body

const toLocationOption = (
  item: InspectionTeamManagementLocationOptionDto,
  level: "emirate" | "region" | "area",
): InspectionLocationOption => ({
  id: item.id,
  code: item.code || undefined,
  nameEn: item.nameEn || item.display || item.code || String(item.id),
  nameAr: item.nameAr || undefined,
  emirateId: item.emirateId || undefined,
  regionId: level === "area" ? item.parentId || undefined : undefined,
  requiresRegion: Boolean(item.requiresRegion),
})

export const AssignedAreaModal: FC<AssignedAreaModalProps> = ({
  scope,
  serviceAdapterMode = "default",
  visible,
  isEdit,
  memberId,
  currentArea,
  onCancel,
  onSuccess,
}) => {
  const { t, i18n } = useTranslation()
  const [form] = Form.useForm<AreaFormValues>()
  const [loading, setLoading] = useState(false)
  const [metadataLoading, setMetadataLoading] = useState(false)
  const [canSubmit, setCanSubmit] = useState(false)
  const [emirates, setEmirates] = useState<InspectionLocationOption[]>([])
  const [regions, setRegions] = useState<InspectionLocationOption[]>([])
  const [areas, setAreas] = useState<InspectionLocationOption[]>([])
  const watchedAssignedEmirateIds = Form.useWatch("assignedEmirateIds", form)
  const watchedAssignedRegionIds = Form.useWatch("assignedRegionIds", form)
  const assignedEmirateIds = useMemo(
    () => watchedAssignedEmirateIds || [],
    [watchedAssignedEmirateIds]
  )
  const assignedRegionIds = useMemo(
    () => watchedAssignedRegionIds || [],
    [watchedAssignedRegionIds]
  )
  const isInspectionScope = scope === "inspection"
  const isArabic = i18n.resolvedLanguage === "ar"
  const shouldShowRegion = requiresInspectionRegion(emirates, assignedEmirateIds)
  const hasAssignedEmirateWithoutRequiredRegion = emirates.some(
    (emirate) => assignedEmirateIds.includes(emirate.id) && !emirate.requiresRegion
  )
  const assignedAreaDisabled = !assignedEmirateIds.length
    || metadataLoading
    || (
      shouldShowRegion
      && !assignedRegionIds.length
      && !hasAssignedEmirateWithoutRequiredRegion
    )

  const title = useMemo(
    () => isEdit
      ? t("teamManagement.memberActions.editAssignedArea")
      : t("teamManagement.memberActions.setAssignedArea"),
    [t, isEdit]
  )
  const warningMessages = useMemo(() => {
    const messages = isEdit
      ? [
          t("teamManagement.assignedArea.editWarning1"),
          t("teamManagement.assignedArea.editWarning2"),
        ]
      : [t("teamManagement.assignedArea.setDescription")]

    return messages.map((message) => String(message || "").trim()).filter(Boolean)
  }, [t, isEdit])

  const toSelectOptions = useCallback((items: InspectionLocationOption[]): AreaOption[] => (
    items.map((item) => ({
      value: item.id,
      label: (isArabic ? item.nameAr : item.nameEn) || item.nameEn,
    }))
  ), [isArabic])

  const regionOptions = useMemo(
    () => regions.filter((item) => (
      item.emirateId
      && assignedEmirateIds.includes(item.emirateId)
      && emirates.some((emirate) => emirate.id === item.emirateId && emirate.requiresRegion)
    )),
    [assignedEmirateIds, emirates, regions]
  )
  const areaOptions = useMemo(
    () => areas.filter((item) => (
      Boolean(item.emirateId && assignedEmirateIds.includes(item.emirateId))
      && (
        !item.regionId
        || !emirates.some((emirate) => emirate.id === item.emirateId && emirate.requiresRegion)
        || assignedRegionIds.includes(item.regionId)
      )
    )),
    [areas, assignedEmirateIds, assignedRegionIds, emirates]
  )

  const refreshSubmitState = useCallback((values = form.getFieldsValue(true)) => {
    setCanSubmit(isInspectionCampaignSelectionValid({
      emirates,
      emirateIds: values.assignedEmirateIds || [],
      regionIds: values.assignedRegionIds || [],
      areaIds: values.assignedAreaIds || [],
      activityIds: [],
    }))
  }, [emirates, form])

  const loadAreaOptions = useCallback(async () => {
    if (!isInspectionScope) {
      setEmirates([])
      setRegions([])
      setAreas([])
      return
    }

    setMetadataLoading(true)
    try {
      const metadata = await getInspectionTeamManagementMetadata()
      setEmirates((metadata?.geography?.emirates || []).map((item) => toLocationOption(item, "emirate")))
      setRegions((metadata?.geography?.regions || []).map((item) => toLocationOption(item, "region")))
      setAreas((metadata?.geography?.areas || []).map((item) => toLocationOption(item, "area")))
    } catch {
      setEmirates([])
      setRegions([])
      setAreas([])
      CustomMessage.error(t("teamManagement.messages.operationFailed"))
    } finally {
      setMetadataLoading(false)
    }
  }, [isInspectionScope, t])

  const handleValuesChange = useCallback((_: unknown, values: AreaFormValues) => {
    const pruned = pruneInspectionAreaSelection({
      emirateIds: values.assignedEmirateIds || [],
      regionIds: values.assignedRegionIds || [],
      areaIds: values.assignedAreaIds || [],
      emirates,
      regions,
      areas,
    })
    const nextValues = {
      assignedEmirateIds: pruned.emirateIds,
      assignedRegionIds: pruned.regionIds,
      assignedAreaIds: pruned.areaIds,
    }
    form.setFieldsValue(nextValues)
    refreshSubmitState(nextValues)
  }, [areas, emirates, form, refreshSubmitState, regions])

  const handleConfirm = async () => {
    try {
      const values = await form.validateFields()
      setLoading(true)

      if (isInspectionScope) {
        await assignInspectionTeamManagementMemberArea(memberId, {
          nodes: buildInspectionAssignedAreaNodes({
            emirates,
            regions,
            areas,
            emirateIds: values.assignedEmirateIds || [],
            regionIds: values.assignedRegionIds || [],
            areaIds: values.assignedAreaIds || [],
          }),
        })
      }

      CustomMessage.success(t("teamManagement.messages.operationSuccess"))
      form.resetFields()
      onSuccess()
    } catch (error) {
      if ((error as { errorFields?: unknown[] })?.errorFields) return
      CustomMessage.error(t("teamManagement.messages.operationFailed"))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!visible) {
      form.resetFields()
      setCanSubmit(false)
      return
    }

    void loadAreaOptions()
  }, [form, loadAreaOptions, serviceAdapterMode, visible])

  useEffect(() => {
    if (!visible || !emirates.length) return

    const nextValues = {
      assignedEmirateIds: currentArea?.emirateIds || [],
      assignedRegionIds: currentArea?.regionIds || [],
      assignedAreaIds: currentArea?.areaIds || [],
    }
    form.setFieldsValue(nextValues)
    refreshSubmitState(nextValues)
  }, [currentArea, emirates, form, refreshSubmitState, visible])

  return (
    <TeamManagementModal
      visible={visible}
      title={title}
      onCancel={onCancel}
      onConfirm={() => void handleConfirm()}
      loading={loading}
      confirmDisabled={!canSubmit || metadataLoading}
      className="team-management-modal--assigned-area"
    >
      {warningMessages.length ? (
        <div className="team-management-assigned-area-modal__warnings">
          <div className="team-management-assigned-area-modal__warning-icon">
            <img src={warningYellowBg} alt="" aria-hidden="true" />
          </div>
          <div className="team-management-assigned-area-modal__warning-copy">
            {warningMessages.map((message, index) => (
              <p key={`${index}-${message}`} className="team-management-assigned-area-modal__warning-text">
                {message}
              </p>
            ))}
          </div>
        </div>
      ) : null}

      <Form<AreaFormValues>
        form={form}
        layout="vertical"
        onValuesChange={handleValuesChange}
        className="team-management-assigned-area-modal__form"
      >
        <Form.Item<AreaFormValues>
          label={t("teamManagement.assignedArea.emirate")}
          name="assignedEmirateIds"
          rules={[{ required: true, message: t("common.required") }]}
        >
          <SelectAllDropdown
            options={toSelectOptions(emirates)}
            placeholder={t("teamManagement.assignedArea.selectOneOrMoreEmirates")}
            showSearch={false}
            maxTagCount="responsive"
            compactMoreTag
            clearable={false}
            tagRemovable
            disabled={metadataLoading}
            getPopupContainer={getSelectPopupContainer}
            className="team-management-assigned-area-modal__select"
            dropdownPanelClassName="team-management-assigned-area-modal__dropdown"
          />
        </Form.Item>
        {shouldShowRegion ? (
          <Form.Item<AreaFormValues>
            label={t("teamManagement.assignedArea.region")}
            name="assignedRegionIds"
            rules={[{ required: true, message: t("common.required") }]}
            extra={isEdit ? t("teamManagement.assignedArea.regionShownBecause") : undefined}
          >
            <SelectAllDropdown
              options={toSelectOptions(regionOptions)}
              placeholder={t("teamManagement.assignedArea.selectOneOrMoreRegions")}
              showSearch={false}
              maxTagCount="responsive"
              compactMoreTag
              clearable={false}
              tagRemovable
              getPopupContainer={getSelectPopupContainer}
              className="team-management-assigned-area-modal__select"
              dropdownPanelClassName="team-management-assigned-area-modal__dropdown"
            />
          </Form.Item>
        ) : null}
        <Form.Item<AreaFormValues>
          label={t("teamManagement.assignedArea.area")}
          name="assignedAreaIds"
        >
          <SelectAllDropdown
            options={toSelectOptions(areaOptions)}
            placeholder={t("teamManagement.assignedArea.searchOrSelectAreas")}
            searchPlaceholder={t("teamManagement.assignedArea.searchArea")}
            maxTagCount="responsive"
            compactMoreTag
            clearable={false}
            tagRemovable
            disabled={assignedAreaDisabled}
            getPopupContainer={getSelectPopupContainer}
            className="team-management-assigned-area-modal__select"
            dropdownPanelClassName="team-management-assigned-area-modal__dropdown"
          />
        </Form.Item>
      </Form>
    </TeamManagementModal>
  )
}
