import { useCallback, useEffect, useMemo, useRef, useState, type FC } from "react"
import moment, { type Moment } from "moment"
import { DatePicker, Form, Input, Select } from "antd"
import { useTranslation } from "react-i18next"
import { CustomMessage } from "@/components/common"
import { getTypeDictionaries, type TypeDictionary } from "@/services/serviceApi"
import {
  getTeamManagementLeaveReasonOptions,
  markTeamManagementMemberLeave,
} from "@/services/teamManagement"
import { TeamManagementModal } from "../TeamManagementModal"
import type {
  LeaveFormValues,
  LeaveReasonOption,
  MarkEmergencyLeaveModalProps,
} from "./type"
import "./index.less"

const EXPECTED_RETURN_DATE_SUBMIT_FORMAT = "YYYY-MM-DDTHH:mm:ss"

const formatExpectedReturnDate = (value?: Moment) => {
  if (!value || !moment.isMoment(value)) {
    return undefined
  }

  const normalizedValue = value.clone()
  if (!normalizedValue.isValid()) {
    return undefined
  }

  return normalizedValue.format(EXPECTED_RETURN_DATE_SUBMIT_FORMAT)
}

export const MarkEmergencyLeaveModal: FC<MarkEmergencyLeaveModalProps> = ({
  scope,
  serviceAdapterMode = "default",
  confirmPermissionCode,
  permissionRoutePath,
  visible,
  memberId,
  onCancel,
  onSuccess,
}) => {
  const { t } = useTranslation()
  const [form] = Form.useForm<LeaveFormValues>()
  const [loading, setLoading] = useState(false)
  const [options, setOptions] = useState<LeaveReasonOption[]>([])
  const [canSubmit, setCanSubmit] = useState(false)
  const submittingRef = useRef(false)

  const title = useMemo(
    () => t("teamManagement.memberActions.markEmergencyLeave"),
    [t]
  )

  const refreshSubmitState = useCallback(() => {
    const leaveType = form.getFieldValue("leaveType")
    const expectedReturnDate = form.getFieldValue("expectedReturnDate")
    const isValidDate =
      Boolean(expectedReturnDate) &&
      moment(expectedReturnDate).isValid() &&
      moment(expectedReturnDate).isAfter(moment())
    setCanSubmit(Boolean(leaveType) && isValidDate)
  }, [form])

  const loadLeaveTypes = useCallback(async () => {
    try {
      const metadataOptions = await getTeamManagementLeaveReasonOptions({
        scope,
        adapterMode: serviceAdapterMode,
      })

      if (Array.isArray(metadataOptions) && metadataOptions.length) {
        setOptions(metadataOptions)
        return
      }

      const response = await getTypeDictionaries("LeaveTypes")
      const dictionaryOptions = Array.isArray(response?.data)
        ? response.data
        : []
      setOptions(
        dictionaryOptions.map((item: TypeDictionary) => ({
          label: item.nameEn,
          value: item.code,
        }))
      )
    } catch (error) {
      CustomMessage.error(t("teamManagement.messages.failedToLoadLeaveReasons"))
    }
  }, [scope, serviceAdapterMode, t])

  const handleConfirm = useCallback(async () => {
    if (submittingRef.current) {
      return
    }

    submittingRef.current = true
    try {
      const values = await form.validateFields()
      const formattedExpectedReturnDate = formatExpectedReturnDate(
        values.expectedReturnDate
      )
      if (!formattedExpectedReturnDate) {
        form.setFields([
          {
            name: "expectedReturnDate",
            errors: [t("teamManagement.validation.futureDateRequired")],
          },
        ])
        refreshSubmitState()
        return
      }

      setLoading(true)
      await markTeamManagementMemberLeave({
        scope,
        adapterMode: serviceAdapterMode,
        memberId,
        leaveType: values.leaveType || "",
        expectedReturnDate: formattedExpectedReturnDate,
        briefDescription: values.briefDescription || "",
      })
      CustomMessage.success(t("teamManagement.messages.operationSuccess"))
      form.resetFields()
      setCanSubmit(false)
      onSuccess()
    } catch (error) {
      if ((error as { errorFields?: unknown[] })?.errorFields) {
        return
      }
      CustomMessage.error(t("teamManagement.messages.operationFailed"))
    } finally {
      submittingRef.current = false
      setLoading(false)
    }
  }, [
    form,
    memberId,
    onSuccess,
    refreshSubmitState,
    scope,
    serviceAdapterMode,
    t,
  ])

  useEffect(() => {
    if (!visible) {
      form.resetFields()
      setCanSubmit(false)
      return
    }

    void loadLeaveTypes()
  }, [form, loadLeaveTypes, visible])

  return (
    <TeamManagementModal
      visible={visible}
      title={title}
      onCancel={onCancel}
      onConfirm={() => void handleConfirm()}
      loading={loading}
      confirmDisabled={!canSubmit}
      confirmPermissionCode={confirmPermissionCode}
      permissionRoutePath={permissionRoutePath}
      className="team-management-modal--leave"
    >
      <Form<LeaveFormValues>
        form={form}
        layout="vertical"
        onValuesChange={refreshSubmitState}
      >
        <Form.Item<LeaveFormValues>
          label={t("teamManagement.leave.leaveReason")}
          name="leaveType"
          rules={[
            {
              required: true,
              message: t("common.required"),
            },
          ]}
        >
          <Select
            className="team-management-modal__control"
            placeholder={t("teamManagement.leave.selectLeaveReason")}
            options={options}
          />
        </Form.Item>
        <Form.Item<LeaveFormValues>
          label={t("teamManagement.leave.expectedReturnDate")}
          name="expectedReturnDate"
          rules={[
            {
              required: true,
              message: t("common.required"),
            },
            {
              validator: (_, value?: Moment) => {
                if (!value || moment(value).isAfter(moment())) {
                  return Promise.resolve()
                }

                return Promise.reject(
                  new Error(t("teamManagement.validation.futureDateRequired"))
                )
              },
            },
          ]}
        >
          <DatePicker
            showTime
            format="DD/MM/YYYY HH:mm:ss"
            placeholder={t("teamManagement.leave.expectedReturnDatePlaceholder")}
            className="team-management-modal__control"
          />
        </Form.Item>
        <Form.Item<LeaveFormValues>
          label={t("teamManagement.leave.notes")}
          name="briefDescription"
        >
          <Input.TextArea
            className="team-management-modal__control team-management-modal__textarea"
            placeholder={t("teamManagement.leave.enterNotes")}
            maxLength={1000}
            showCount
            autoSize={{ minRows: 4, maxRows: 6 }}
          />
        </Form.Item>
      </Form>
    </TeamManagementModal>
  )
}
