import Sousuo from "@/assets/icons/Sousuo";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FC,
  type MouseEvent as ReactMouseEvent,
} from "react"
import { Form, Spin } from "antd"
import {
  CloseCircleFilled,
  DownOutlined,
  LoadingOutlined,
} from "@ant-design/icons"
import { useTranslation } from "react-i18next"
import { CustomMessage } from "@/components/common"
import emptyIcon from "@/assets/images/empty.svg"
import {
  getTeamManagementMembers,
  reassignTeamManagementTasks,
  type TeamManagementReassignTask,
} from "@/services/teamManagement"
import { TeamManagementModal } from "../TeamManagementModal"
import type {
  MemberOption,
  MemberSelectFieldProps,
  ReassignFormValues,
  ReassignTasksModalProps,
} from "./type"
import "./index.less"

const MemberSelectField: FC<MemberSelectFieldProps> = ({
  value,
  onChange,
  options,
  loading = false,
  placeholder,
  searchPlaceholder,
  emptyText,
  searchEmptyText,
}) => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [searchKeyword, setSearchKeyword] = useState("")
  const containerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value),
    [options, value]
  )
  const normalizedSearchKeyword = searchKeyword.trim().toLowerCase()
  const hasSearchKeyword = searchKeyword.trim().length > 0
  const resolvedEmptyText = hasSearchKeyword ? searchEmptyText : emptyText
  const filteredOptions = useMemo(() => {
    if (!normalizedSearchKeyword) {
      return options
    }

    return options.filter((option) =>
      String(option.label || "")
        .toLowerCase()
        .includes(normalizedSearchKeyword)
    )
  }, [options, normalizedSearchKeyword])

  useEffect(() => {
    if (!open) {
      setSearchKeyword("")
      return
    }

    const focusTimer = window.setTimeout(() => {
      searchInputRef.current?.focus()
    })

    return () => {
      window.clearTimeout(focusTimer)
    }
  }, [open])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  const handleToggle = () => {
    if (loading) {
      return
    }
    setOpen((current) => !current)
  }

  const handleSelect = (option: MemberOption) => {
    onChange?.(option.value)
    setSearchKeyword("")
    setOpen(false)
  }

  const handleClearSearch = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setSearchKeyword("")
    searchInputRef.current?.focus()
  }

  return (
    <div className="team-management-member-select" ref={containerRef}>
      <button
        type="button"
        className={`team-management-member-select__trigger${
          open ? " is-open" : ""
        }${loading ? " is-loading" : ""}`}
        onClick={handleToggle}
        disabled={loading}
        aria-busy={loading}
      >
        <span
          className={`team-management-member-select__trigger-text${
            selectedOption ? "" : " is-placeholder"
          }`}
          title={selectedOption?.label}
        >
          {selectedOption?.label || placeholder}
        </span>
        <span className="team-management-member-select__trigger-icon">
          {loading ? <LoadingOutlined spin /> : <DownOutlined />}
        </span>
      </button>

      {open ? (
        <div className="team-management-member-select__panel">
          <div
            className={`team-management-member-select__search${
              hasSearchKeyword ? " is-active" : ""
            }`}
            onMouseDown={(event) => {
              event.preventDefault()
            }}
            onClick={() => searchInputRef.current?.focus()}
          >
            <Sousuo className="team-management-member-select__search-icon" />
            <input
              ref={searchInputRef}
              className="team-management-member-select__search-input"
              value={searchKeyword}
              placeholder={searchPlaceholder}
              onChange={(event) => setSearchKeyword(event.target.value)}
              onKeyDown={(event) => event.stopPropagation()}
            />
            {hasSearchKeyword ? (
              <button
                type="button"
                className="team-management-member-select__search-clear"
                onClick={handleClearSearch}
                onMouseDown={(event) => event.preventDefault()}
                aria-label={t("common.clearSearch")}
              >
                <CloseCircleFilled />
              </button>
            ) : null}
          </div>

          <div className="team-management-member-select__menu">
            {loading ? (
              <div className="team-management-member-select__status">
                <Spin size="small" />
              </div>
            ) : filteredOptions.length ? (
              filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`team-management-member-select__option${
                    option.value === value ? " is-selected" : ""
                  }`}
                  onClick={() => handleSelect(option)}
                >
                  <span
                    className="team-management-member-select__option-text"
                    title={option.label}
                  >
                    {option.label}
                  </span>
                </button>
              ))
            ) : (
              <div className="team-management-member-select__empty">
                <img
                  src={emptyIcon}
                  alt=""
                  className="team-management-member-select__empty-icon"
                />
                <span>{resolvedEmptyText}</span>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export const ReassignTasksModal: FC<ReassignTasksModalProps> = ({
  scope,
  serviceAdapterMode = "default",
  manualReassignSelection = true,
  confirmPermissionCode,
  permissionRoutePath,
  visible,
  tasks,
  selectedCount,
  onCancel,
  onSuccess,
}) => {
  const { t } = useTranslation()
  const [form] = Form.useForm<ReassignFormValues>()
  const [members, setMembers] = useState<MemberOption[]>([])
  const [loading, setLoading] = useState(false)
  const [membersLoading, setMembersLoading] = useState(false)
  const [canSubmit, setCanSubmit] = useState(false)
  const mountedRef = useRef(true)
  const membersRequestIdRef = useRef(0)
  const modalTitle =
    selectedCount > 1
      ? `${t("teamManagement.reassign.title")} ${t(
          "teamManagement.reassign.selectedCount",
          {
            count: selectedCount,
          }
        )}`
      : t("teamManagement.reassign.title")
  const reassignmentSourceType = useMemo(() => {
    const validSourceTypes = tasks.reduce<string[]>((result, item) => {
      const sourceType = String(item?.sourceType || "").trim()

      if (!sourceType || result.includes(sourceType)) {
        return result
      }

      result.push(sourceType)
      return result
    }, [])

    return validSourceTypes.length === 1
      ? validSourceTypes[0]
      : undefined
  }, [tasks])

  const resolveReassignTasks = (): TeamManagementReassignTask[] => {
    return tasks.reduce<TeamManagementReassignTask[]>((result, item) => {
      const sourceType = String(item?.sourceType || "").trim()
      const fallbackSourceId = String(item?.sourceId || "").trim()
      const sourceId =
        scope === "inspection"
          ? fallbackSourceId ||
            String(item?.userId || "").trim() ||
            String(item?.assignedToUserId || "").trim()
          : fallbackSourceId

      if (!sourceType || !sourceId) {
        return result
      }

      result.push({
        sourceType,
        sourceId,
      })

      return result
    }, [])
  }

  const refreshSubmitState = () => {
    const memberId = form.getFieldValue("memberId")
    setCanSubmit(
      manualReassignSelection
        ? Boolean(memberId) && tasks.length > 0
        : tasks.length > 0
    )
  }

  const loadMembers = useCallback(async () => {
    const requestId = membersRequestIdRef.current + 1
    membersRequestIdRef.current = requestId

    if (!manualReassignSelection) {
      if (mountedRef.current) {
        setMembers([])
      }
      return
    }

    if (mountedRef.current) {
      setMembersLoading(true)
    }

    try {
      const resolvedTasks = resolveReassignTasks()
      const response = await getTeamManagementMembers({
        scope,
        adapterMode: serviceAdapterMode,
        assignableOnly: true,
        purpose: "reassignment",
        sourceType: reassignmentSourceType,
        tasks: resolvedTasks,
      })

      if (
        requestId !== membersRequestIdRef.current ||
        !mountedRef.current
      ) {
        return
      }

      setMembers(Array.isArray(response) ? response : [])
    } catch (error) {
      if (
        requestId !== membersRequestIdRef.current ||
        !mountedRef.current
      ) {
        return
      }

      setMembers([])
      CustomMessage.error(t("teamManagement.messages.failedToLoadMembers"))
    } finally {
      if (
        requestId === membersRequestIdRef.current &&
        mountedRef.current
      ) {
        setMembersLoading(false)
      }
    }
  }, [
    manualReassignSelection,
    reassignmentSourceType,
    scope,
    serviceAdapterMode,
    t,
  ])

  const handleConfirm = useCallback(async () => {
    try {
      const values: ReassignFormValues = manualReassignSelection
        ? await form.validateFields()
        : {}
      const resolvedTasks = resolveReassignTasks()

      if (!resolvedTasks.length) {
        CustomMessage.error(t("teamManagement.messages.operationFailed"))
        return
      }

      if (mountedRef.current) {
        setLoading(true)
      }
      await reassignTeamManagementTasks({
        scope,
        adapterMode: serviceAdapterMode,
        memberId: values.memberId,
        assignedUserId: values.memberId,
        tasks: resolvedTasks,
      })
      CustomMessage.success(t("teamManagement.messages.operationSuccess"))
      form.resetFields()
      onSuccess()
    } catch (error) {
      if ((error as { errorFields?: unknown[] })?.errorFields) {
        return
      }
      CustomMessage.error(t("teamManagement.messages.operationFailed"))
    } finally {
      if (mountedRef.current) {
        setLoading(false)
      }
    }
  }, [
    form,
    manualReassignSelection,
    onSuccess,
    scope,
    serviceAdapterMode,
    t,
    tasks,
  ])

  useEffect(() => {
    mountedRef.current = true

    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!visible) {
      membersRequestIdRef.current += 1
      form.resetFields()
      setCanSubmit(false)
      setMembersLoading(false)
      return
    }

    void loadMembers()
  }, [form, loadMembers, visible])

  useEffect(() => {
    if (!visible) {
      return
    }

    refreshSubmitState()
  }, [tasks.length, visible])

  return (
    <TeamManagementModal
      visible={visible}
      title={modalTitle}
      onCancel={onCancel}
      onConfirm={() => void handleConfirm()}
      loading={loading}
      confirmDisabled={!canSubmit}
      confirmPermissionCode={confirmPermissionCode}
      permissionRoutePath={permissionRoutePath}
      centered
      className="team-management-modal--reassign"
    >
      {manualReassignSelection ? (
        <Form<ReassignFormValues>
          form={form}
          layout="vertical"
          onValuesChange={refreshSubmitState}
        >
          <Form.Item<ReassignFormValues>
            required
            label={
              <span className="team-management-modal__label">
                {t("teamManagement.reassign.assignedPerson")}
              </span>
            }
            name="memberId"
            rules={[
              {
                required: true,
                message: t("teamManagement.validation.assignedPersonRequired"),
              },
            ]}
          >
            <MemberSelectField
              options={members}
              loading={membersLoading}
              placeholder={t("teamManagement.reassign.selectTeamMember")}
              searchPlaceholder={t("common.search")}
              emptyText={t("teamManagement.reassign.noEligibleMembers")}
              searchEmptyText={t("teamManagement.reassign.noRecordsFound")}
            />
          </Form.Item>
        </Form>
      ) : (
        <div>
          {t("teamManagement.reassign.tasksSelected", {
            count: selectedCount,
          })}
        </div>
      )}
    </TeamManagementModal>
  )
}
