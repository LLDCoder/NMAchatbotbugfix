import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from "react";
import Sousuo from "@/assets/icons/Sousuo";
import { useTranslation } from "react-i18next";
import { useHistory } from "react-router-dom";
import {
  Input,
  Select,
  Tree,
  Dropdown,
  Menu,
  Form,
  Modal,
  Tooltip,
  Spin,
} from "antd";
import {
  TablePanel,
  CustomButton,
  ConfirmModal,
  FormPanel,
  CustomMessage,
  ResponsiveFilterModal,
  SelectAllDropdown,
} from "@/components/common";
import EmiratesIdInput from "@/components/common/EmiratesIdInput";
import PaginationTotal from "@/components/common/PaginationTotal";
import OverflowTooltip from "@/components/common/OverflowTooltip";
import {
  type ResponsiveActionColumnButtonWidthMap,
  useResponsiveActionColumnWidth,
} from "@/hooks/useResponsiveActionColumnWidth";
import {
  createMobileNumberFormRule,
  DEFAULT_COUNTRY_DIAL_CODE,
  FormMobileNumberInput,
} from "@/components/common/MobileNumberInput";
import type { ColumnsType } from "antd/es/table";
import type { FormPanelSectionConfig } from "@/components/common/FormPanel";
import { MoreOutlined, PlusOutlined } from "@ant-design/icons";
import "./index.less";
import EmptyBox from "@/components/common/EmptyBox/EmptyBox";
import SimpleBar from "@/components/SimpleBar";
import LeaderSvg from "@/assets/images/Leader.svg";
import CustomStatusTag from "@/components/common/CustomStatusTag";
import userManagementFilterIcon from "@/assets/images/user-management-filter.svg";
import FilterCountBadge, {
  countAppliedFilters,
} from "@/components/common/FilterCountBadge";
import {
  addDepartment,
  updateDepartment,
  deleteDepartment,
  getDepartmentById,
  getDepartments,
} from "@/services/department";
import {
  addAdminUser,
  updateAdminUser,
  getAdminUserList,
  deleteAdminUser,
  resendAdminDefaultPassword,
  SetAdminUserLeaderAsync,
  type AdminUserRecord,
} from "@/services/userManagement";
import {
  getEmirateList,
  getRegionList,
  getAreaList,
  type EmirateItem,
  type RegionItem,
  type AreaItem,
} from "@/services/address";
import {
  getRoleList,
  getRoleListByDepartmentId,
} from "@/services/role";
import { getTypeDictionaries } from "@/services/serviceApi";
import Avatar from "./Avatar";
import aesEncrypt from "@/utils/aesEncrypt";
import {
  emiratesIdToDisplay,
  formatEmiratesIdDigits,
  isCompleteEmiratesId,
  EMIRATES_ID_DISPLAY_MAX_LENGTH,
} from "@/utils/emiratesId";
import { useUserStore } from "@/store/user";
import { performAuthenticatedLogout } from "@/utils/authSession";
import { debounce } from "lodash";
import {
  buildContactNumberFields,
  createContactNumberSnapshot,
  readContactFormValue,
  toContactFormValue,
} from "@/components/common/MobileNumberInput";
import { getApiResponseMessage } from "@/components/common/FormErrorPrompt/utils";

import { getTextError, getFieldsToUnlock, trimText, NAME_MAX_LENGTH,
  DEPARTMENT_NAME_MAX_LENGTH, type TextKind, type LockedUserField } from "./validation";

type UserState = "Active" | "Suspended" | "Inactive";
type UserRecord = AdminUserRecord;
type UserManagementActionColumnKey = "edit" | "delete" | "setLeader";


interface AdminRoleOption {
  label: string;
  value: string;
  departmentId: number;
  disabled?: boolean;
}

interface RoleOptionSource {
  id?: string | number | null;
  nameEn?: string | null;
  nameAr?: string | null;
  departmentId?: string | number | null;
  status?: string | number | null;
}

interface DepartmentNameValues {
  nameEn: string;
  nameAr: string;
}

const USER_MANAGEMENT_ACTION_COLUMN_BASE_SCROLL_X = 1000;
const USER_MANAGEMENT_ACTION_BUTTON_WIDTH_MAP: ResponsiveActionColumnButtonWidthMap<UserManagementActionColumnKey> =
  {};
const USER_MANAGEMENT_ACTION_COLUMN_DESKTOP_CONFIG = {
  gap: 12,
  padding: 32,
  minWidth: 128,
  maxWidth: 260,
};
const USER_MANAGEMENT_ACTION_COLUMN_COMPACT_CONFIG = {
  gap: 8,
  padding: 32,
  minWidth: 112,
  maxWidth: 240,
};
const USER_MANAGEMENT_ACTION_COLUMN_TEXT_MEASURE_CONFIG = {
  font: "500 16px Inter, sans-serif",
  narrowFont: "500 14px Inter, sans-serif",
  textPadding: 0,
};
const adminMobileFieldNames = {
  countryCode: "mobileCountryCode",
  phoneNumber: "mobileLocalNumber",
};
const normalizeEmail = (value: unknown) =>
  String(value ?? "").trim().toLowerCase();

const isUserFieldFilled = (user: UserRecord | null, field: LockedUserField) => {
  const value = user?.[field];
  if (typeof value === "string") return value.trim() !== "";
  return value !== null && value !== undefined && value !== 0;
};

const UserManagement: React.FC = () => {
  const { t, i18n } = useTranslation();
  const history = useHistory();
  const currentUserEmail = useUserStore((state) => state.userInfo?.email);
  const um = useCallback(
    (key: string, opts?: Record<string, unknown>) =>
      t(`Settings.userManagement.${key}`, opts as object),
    [t],
  );

  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [roleFilter, setRoleFilter] = useState<string | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(
    undefined,
  );
  const [accountFilter, setAccountFilter] = useState<string | undefined>(
    undefined,
  );
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [draftRoleFilter, setDraftRoleFilter] = useState<string | undefined>(
    undefined,
  );
  const [draftStatusFilter, setDraftStatusFilter] = useState<
    string | undefined
  >(undefined);
  const [draftAccountFilter, setDraftAccountFilter] = useState<
    string | undefined
  >(undefined);
  const [keyword, setKeyword] = useState<string | undefined>(undefined);
  const [searchKeyword, setSearchKeyword] = useState<string | undefined>(
    undefined,
  );

  const debouncedSearch = useCallback(
    debounce((value: string | undefined) => {
      setSearchKeyword(value);
      setCurrentPage(1);
    }, 500),
    [],
  );
  const [headerHovered, setHeaderHovered] = useState(false);
  const [form] = Form.useForm();
  const [departmentForm] = Form.useForm();
  const [addDepartmentVisible, setAddDepartmentVisible] = useState(false);
  const [editDepartmentVisible, setEditDepartmentVisible] = useState(false);
  const [deleteDepartmentVisible, setDeleteDepartmentVisible] = useState(false);
  const [LeaderVisible, setLeaderVisible] = useState(false);
  const [LeaderData, setLeaderData] = useState<UserRecord>({} as UserRecord);
  const [deleteDepartmentFailedVisible, setDeleteDepartmentFailedVisible] =
    useState(false);
  const [deleteUserFailedVisible, setDeleteUserFailedVisible] = useState(false);

  const [deleteUserVisible, setDeleteUserVisible] = useState(false);
  const [deactivateVisible, setDeactivateVisible] = useState(false);
  const [changeDepartmentVisible, setChangeDepartmentVisible] = useState(false);
  const [changeRoleVisible, setChangeRoleVisible] = useState(false);
  const [addUserVisible, setAddUserVisible] = useState(false);
  const [editUserVisible, setEditUserVisible] = useState(false);
  const [userForm] = Form.useForm();
  const [isUserFormValid, setIsUserFormValid] = useState(false);
  const [isFormValid, setIsFormValid] = useState(false);
  const [userSaving, setUserSaving] = useState(false);
  const [departmentSaving, setDepartmentSaving] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const userFormSessionRef = useRef(0);
  const [unlockedUserFields, setUnlockedUserFields] = useState<LockedUserField[]>([]);
  const pendingErrorField = useRef<(string | number)[] | null>(null);
  const focusFormError = useCallback((form: typeof userForm, name: (string | number)[]) => {
    form.scrollToField(name, { block: "center" });
    const instance = form.getFieldInstance(name);
    if (instance?.focus) instance.focus();
    else if (name.length === 1) document.getElementById(String(name[0]))?.focus();
  }, []);
  useEffect(() => {

    if (pendingErrorField.current && (editUserVisible || addUserVisible) && !userSaving) {
      focusFormError(userForm, pendingErrorField.current);
      pendingErrorField.current = null;
    }
  }, [editUserVisible, addUserVisible, unlockedUserFields, userForm, focusFormError, userSaving]);
  useEffect(() => {
    if (!editUserVisible) {
      setUnlockedUserFields([]);
      pendingErrorField.current = null;
    }
  }, [editUserVisible]);
  const isEditingUserFieldLocked = useCallback(
    (field: LockedUserField) =>
      userSaving || (editUserVisible && isUserFieldFilled(editingUser, field) && !unlockedUserFields.includes(field)),
    [editUserVisible, editingUser, unlockedUserFields, userSaving],
  );
  const [selectedDepartment, setSelectedDepartment] = useState<any>({});
  const [editingDepartment, setEditingDepartment] = useState<any>(null);
  const [initialDepartmentNames, setInitialDepartmentNames] =
    useState<DepartmentNameValues | null>(null);
  const [departmentTree, setDepartmentTree] = useState<any[]>([]);
  const [departmentOptions, setDepartmentOptions] = useState<any[]>([]);
  const [userList, setUserList] = useState<UserRecord[]>([]);
  const [userListLoading, setUserListLoading] = useState(false);
  const isMountedRef = useRef(true);
  const departmentDetailRequestSeqRef = useRef(0);
  const userListRequestSeqRef = useRef(0);
  const [roleList, setRoleList] = useState<AdminRoleOption[]>([]);
  const [rolesForUserForm, setRolesForUserForm] = useState<
    AdminRoleOption[]
  >([]);
  const [rolesForUserFormLoading, setRolesForUserFormLoading] =
    useState(false);
  const rolesForUserFormRequestSeqRef = useRef(0);
  const [userStatusList, setUserStatusList] = useState<any[]>([]);
  const [userLinkedList, setUserLinkedList] = useState<any[]>([]);
  const [emirateList, setEmirateList] = useState<EmirateItem[]>([]);
  const [allRegionList, setAllRegionList] = useState<RegionItem[]>([]);
  const [allAreaList, setAllAreaList] = useState<AreaItem[]>([]);
  const [filteredRegionList, setFilteredRegionList] = useState<RegionItem[]>(
    [],
  );
  const [filteredAreaList, setFilteredAreaList] = useState<AreaItem[]>([]);
  const [selectedEmirateId, setSelectedEmirateId] = useState<number | null>(
    null,
  );

  const [userDepartmentSelection, setUserDepartmentSelection] = useState<
    number[]
  >([]);
  // Keeps the last settled answer so switching departments does not flash the
  // wrong layout (table vs. no-role empty state) while the request is in flight.
  const [departmentRoleState, setDepartmentRoleState] = useState<{
    departmentId: number | null;
    hasRole: boolean;
  } | null>(null);
  const [departmentRoleLoading, setDepartmentRoleLoading] = useState(false);
  const departmentRoleRequestSeqRef = useRef(0);

  const isAbuDhabiEmirate = useCallback(
    (emirateId: number | null | undefined) => {
      if (emirateId == null) return false;
      const em = emirateList.find((e) => Number(e.id) === Number(emirateId));
      return /abu\s*dhabi/i.test(String(em?.nameEn ?? ""));
    },
    [emirateList],
  );

  const getRoleOptions = useCallback(
    (res: unknown): AdminRoleOption[] => {
      const data = (res as { data?: unknown })?.data;
      const list = Array.isArray((data as { items?: unknown })?.items)
        ? (data as { items: unknown[] }).items
        : Array.isArray(data)
          ? data
          : [];

      return list
        .map((item) => {
          const role = item as RoleOptionSource;
          return {
            label: String(
              i18n.resolvedLanguage === "ar"
                ? role.nameAr ?? ""
                : role.nameEn ?? "",
            ),
            value: String(role.id ?? ""),
            departmentId: Number(role.departmentId),
            disabled: String(role.status ?? "") === "2",
          };
        })
        .filter(
          (item) =>
            Boolean(item.value) && Number.isFinite(item.departmentId),
        );
    },
    [i18n.language],
  );
  const [hoveredNodeKey, setHoveredNodeKey] = useState<string | null>(null);
  const [selectedTreeKeys, setSelectedTreeKeys] = useState<string[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const departmentNameEnWatch = Form.useWatch("nameEn", departmentForm);
  const departmentNameArWatch = Form.useWatch("nameAr", departmentForm);
  const isAddDepartmentConfirmDisabled =
    Boolean(getTextError(departmentNameEnWatch, "departmentEn") || getTextError(departmentNameArWatch, "departmentAr"));
  const currentDepartmentNames = {
    nameEn: String(departmentNameEnWatch ?? "").trim(),
    nameAr: String(departmentNameArWatch ?? "").trim(),
  };
  const isEditDepartmentConfirmDisabled =
    departmentSaving ||
    !initialDepartmentNames ||
    Boolean(getTextError(currentDepartmentNames.nameEn, "departmentEn") || getTextError(currentDepartmentNames.nameAr, "departmentAr")) ||
    (currentDepartmentNames.nameEn === initialDepartmentNames.nameEn &&
      currentDepartmentNames.nameAr === initialDepartmentNames.nameAr);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      userListRequestSeqRef.current += 1;
      debouncedSearch.cancel();
    };
  }, [debouncedSearch]);

  const handleAddDepartment = () => {
    departmentDetailRequestSeqRef.current += 1;
    departmentForm.resetFields();
    setDepartmentSaving(false);
    setAddDepartmentVisible(true);
  };

  const handleDeleteUser = async () => {
    if (!editingUser?.userId) {
      setDeleteUserVisible(false);
      return;
    }
    try {
      const res = await deleteAdminUser(editingUser.userId);
      if (res?.isSuccess) {
        loadUsers({
          DepartmentName: selectedDepartment?.id,
          Status: statusFilter,
          RoleId: roleFilter,
          AdminUserStatus: accountFilter,
          keyword: searchKeyword,
          PageIndex: 1,
          PageSize: pageSize,
        });
      }
      setDeleteUserVisible(false);
    } catch (error) {
      setDeleteUserVisible(false);

      console.error("Failed to load department detail", error);
    }
  };

  const handleEditDepartment = async (department: any) => {
    const requestId = departmentDetailRequestSeqRef.current + 1;
    departmentDetailRequestSeqRef.current = requestId;
    setDepartmentSaving(false);
    setInitialDepartmentNames(null);
    let initialValues: DepartmentNameValues & { code: string };

    try {
      const id = department.id || department.key;
      const res = await getDepartmentById(id);
      const data = (res as any).data || res;
      initialValues = {
        nameEn: String(data.nameEn ?? ""),
        nameAr: String(data.nameAr ?? ""),
        code: String(data.code ?? ""),
      };
    } catch (error) {
      console.error("Failed to load department detail", error);
      initialValues = {
        nameEn: String(department.title ?? ""),
        nameAr: String(department.titleAr ?? ""),
        code: String(department.code ?? ""),
      };
    }

    if (
      !isMountedRef.current ||
      requestId !== departmentDetailRequestSeqRef.current
    ) {
      return;
    }

    setEditingDepartment(department);
    departmentForm.setFieldsValue(initialValues);
    setInitialDepartmentNames({
      nameEn: initialValues.nameEn.trim(),
      nameAr: initialValues.nameAr.trim(),
    });
    setEditDepartmentVisible(true);
  };

  const handleDeleteDepartment = (department: any) => {
    if (department.userCount > 0) {
      setDeleteDepartmentFailedVisible(true);
      setDeleteDepartmentVisible(false);
    } else {
      setSelectedDepartment(department);
      setDeleteDepartmentVisible(true);
    }
  };

  const handleAddDepartmentSubmit = async () => {
    const session = departmentDetailRequestSeqRef.current;
    try {
      setDepartmentSaving(true);
      trimFormFields(departmentForm, ["nameEn", "nameAr"]);
      const values = await departmentForm.validateFields();
      if (session !== departmentDetailRequestSeqRef.current) return;
      const payload = {
        nameEn: trimText(values.nameEn),
        nameAr: trimText(values.nameAr),
        code: values.code || "",
      };
      await addDepartment(payload);
      if (session !== departmentDetailRequestSeqRef.current) return;
      CustomMessage.success(um("messages.departmentAdded"));
      setAddDepartmentVisible(false);
      departmentForm.resetFields();
      loadDepartments({});
    } catch (error) {
      if (session !== departmentDetailRequestSeqRef.current) return;
      if (
        error &&
        typeof error === "object" &&
        "errorFields" in error
      ) {
        const firstError = (error as { errorFields: { name: (string | number)[] }[] }).errorFields[0];
        if (firstError) focusFormError(departmentForm, firstError.name);
        return;
      }
      CustomMessage.error(um("messages.departmentSaveFailed"));
      console.error("Add department failed", error);
    } finally {
      if (session === departmentDetailRequestSeqRef.current) setDepartmentSaving(false);
    }
  };

  const handleEditDepartmentSubmit = async () => {
    const session = departmentDetailRequestSeqRef.current;
    try {
      setDepartmentSaving(true);
      trimFormFields(departmentForm, ["nameEn", "nameAr"]);
      const values = await departmentForm.validateFields();
      if (session !== departmentDetailRequestSeqRef.current) return;
      if (!editingDepartment || (values.nameEn === initialDepartmentNames?.nameEn && values.nameAr === initialDepartmentNames?.nameAr)) {
        return;
      }
      const payload = {
        id: Number(editingDepartment.id || editingDepartment.key),
        nameEn: trimText(values.nameEn),
        nameAr: trimText(values.nameAr),
        code: values.code,
      };
      await updateDepartment(payload);
      if (session !== departmentDetailRequestSeqRef.current) return;
      CustomMessage.success(um("messages.departmentUpdated"));
      setEditDepartmentVisible(false);
      setInitialDepartmentNames(null);
      departmentForm.resetFields();
      loadDepartments({});
    } catch (error) {
      if (session !== departmentDetailRequestSeqRef.current) return;
      if (error && typeof error === "object" && "errorFields" in error) {
        const firstError = (error as { errorFields: { name: (string | number)[] }[] }).errorFields[0];
        if (firstError) focusFormError(departmentForm, firstError.name);
        return;
      }
      CustomMessage.error(um("messages.departmentSaveFailed"));
      console.error("Edit department failed", error);
    } finally {
      if (session === departmentDetailRequestSeqRef.current) setDepartmentSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedDepartment) {
      return;
    }

    try {
      const id = Number(selectedDepartment.id || selectedDepartment.key);
      await deleteDepartment(id);
      CustomMessage.success(um("messages.departmentDeleted"));
      setDeleteDepartmentVisible(false);
      setSelectedDepartment(null);
      loadDepartments({});
    } catch (error) {
      setDeleteDepartmentVisible(false);
      setDeleteDepartmentFailedVisible(true);
    }
  };

  const handleConfirmDeactivate = () => {
    setDeactivateVisible(false);
  };

  const handleChangeDepartment = async () => {
    try {
      const values = await form.validateFields();
      setChangeDepartmentVisible(false);
      form.resetFields();
    } catch (error) {
      console.error("Form validation failed:", error);
    }
  };
  const handleSync = () => {};

  const handleChangeRole = async () => {
    try {
      const values = await form.validateFields();
      setChangeRoleVisible(false);
      form.resetFields();
    } catch (error) {
      console.error("Form validation failed:", error);
    }
  };

  const openAddUser = () => {
    userFormSessionRef.current += 1;
    const mobileSnapshot = createContactNumberSnapshot({
      countryCode: DEFAULT_COUNTRY_DIAL_CODE,
      localNumber: "",
      fullNumber: "",
    });
    setUnlockedUserFields([]);
    pendingErrorField.current = null;
    setEditingUser(null);
    userForm.resetFields();
    setAddUserVisible(true);
    setIsUserFormValid(false);
    setUserSaving(false);
    const selectedDepartmentId = Number(selectedDepartment?.id);
    const defaultDeptIds =
      selectedDepartment?.id != null &&
      selectedDepartment?.id !== "" &&
      Number.isFinite(selectedDepartmentId)
        ? [selectedDepartmentId]
        : [];
    userForm.setFieldsValue({
      status: "1",
      mobileNumber: toContactFormValue(
        mobileSnapshot,
        adminMobileFieldNames,
      ),
      ...(defaultDeptIds.length ? { department: defaultDeptIds } : {}),
    });
    setUserDepartmentSelection(defaultDeptIds);
    setRolesForUserFormLoading(defaultDeptIds.length > 0);
    if (defaultDeptIds.length === 0) {
      setRolesForUserForm([]);
    }
    setSelectedEmirateId(null);
    setFilteredRegionList([]);
    setFilteredAreaList([]);
    setTimeout(() => {
      checkUserFormValidity();
    }, 50);
  };

  const openEditUser = (record: any) => {
    userFormSessionRef.current += 1;
    const mobileSnapshot = createContactNumberSnapshot({
      countryCode: record.mobileCountryCode,
      localNumber: record.mobileLocalNumber,
      fullNumber: record.mobileNumber,
    });
    setUnlockedUserFields([]);
    pendingErrorField.current = null;
    setEditingUser(record);
    userForm.resetFields();
    setEditUserVisible(true);
    setUserSaving(false);
    // const parts = record.username ? record.username.split(" ") : ["", ""];
    // const firstName = parts[0] || "";
    // const lastName = parts.slice(1).join(" ") || "";
    userForm.setFieldsValue({
      personalPhotoUrl: record.personalPhotoUrl,
      firstName: record.firstName,
      lastName: record.lastName,
      emiratesId: emiratesIdToDisplay(record.emiratesId),
      email: record.email,
      mobileNumber: toContactFormValue(
        mobileSnapshot,
        adminMobileFieldNames,
      ),
      gender: record.gender,
      department: record.departmentsInfo?.map((item: any) => item.id),
      assignRoles: (() => {
        const fromIds = Array.isArray(record.assignRolesIds)
          ? record.assignRolesIds
              .map((id: unknown) => String(id ?? "").trim())
              .filter(Boolean)
          : [];
        if (fromIds.length > 0) return fromIds;
        return (
          record.assignRolesIdsInfo?.map((item: any) => String(item.id)) ?? []
        );
      })(),

      emirate: record.emirateId,
      areaId: record.areaId,
      area: record.areaId,
      region: record.regionId,
      street: record.street,
      status: record.status,
    });

    const recordDepartmentIds = Array.isArray(record.departmentsInfo)
      ? record.departmentsInfo
          .map((item: any) => Number(item?.id))
          .filter(Number.isFinite)
      : [];
    setUserDepartmentSelection(recordDepartmentIds);
    setRolesForUserFormLoading(recordDepartmentIds.length > 0);
    if (recordDepartmentIds.length === 0) {
      setRolesForUserForm([]);
      userForm.setFieldsValue({ assignRoles: [] });
    }

    if (record.emirateId) {
      const emirateId = Number(record.emirateId);
      setSelectedEmirateId(emirateId);
      const regions = allRegionList.filter(
        (region) => region.emirateId === emirateId,
      );
      setFilteredRegionList(regions);
      if (isAbuDhabiEmirate(emirateId)) {
        if (record.regionId) {
          const regionId = Number(record.regionId);
          const areas = allAreaList.filter(
            (area) => area.regionId === regionId,
          );
          setFilteredAreaList(areas);
        } else {
          setFilteredAreaList([]);
        }
      } else {
        const regionIds = regions.map((r) => r.id);
        const areas = allAreaList.filter((a) => regionIds.includes(a.regionId));
        setFilteredAreaList(areas);
      }
    } else {
      setSelectedEmirateId(null);
      setFilteredRegionList([]);
      setFilteredAreaList([]);
    }
    // setIsUserFormValid(false);
    setTimeout(() => {
      checkUserFormValidity();
    }, 50);
  };

  const checkUserFormValidity = (values?: Record<string, any>) => {
    const v = values ?? userForm.getFieldsValue();
    const dept = v.department;
    const roles = v.assignRoles;
    const hasDepts = Array.isArray(dept) && dept.length > 0;
    const hasRoles = Array.isArray(roles) && roles.length > 0;
    const genderNum = Number(v.gender);
    const filled = Boolean(
      !getTextError(v.firstName, "name") &&
        !getTextError(v.lastName, "name") &&
        v.email &&
        (genderNum === 1 || genderNum === 2) &&
        isCompleteEmiratesId(String(v.emiratesId ?? "")) &&
        hasDepts &&
        hasRoles &&
        v.status !== undefined &&
        v.status !== null &&
        v.status !== "",
    );
    setIsUserFormValid(filled);
  };

  const buildTextRule = useCallback((kind: TextKind, label: React.ReactNode) => ({
    required: true,
    validator: (_: unknown, value: unknown) => {
      const error = getTextError(value, kind);
      if (!error) return Promise.resolve();
      const options = {
        field: String(label), min: 2,
        max: kind === "name" ? NAME_MAX_LENGTH : DEPARTMENT_NAME_MAX_LENGTH,
      };
      const message = error === "required" ? um("validation.pleaseEnter", options)
        : error === "length" ? um("validation.textLength", options)
        : error === "letter" ? um("validation.textLetter", options)
        : kind === "name" ? um("validation.nameCharacters")
        : kind === "departmentEn" ? um("validation.departmentEnCharacters")
        : um("validation.departmentArCharacters");
      return Promise.reject(new Error(message));
    },
  }), [um]);

  const trimFormFields = useCallback((form: typeof userForm, names: string[]) => {
    form.setFieldsValue(Object.fromEntries(names.map((name) => [name, trimText(form.getFieldValue(name))])));
  }, []);
  const trimFieldOnBlur = useCallback((form: typeof userForm, name: string) => {
    trimFormFields(form, [name]);
    void form.validateFields([name]).catch(() => undefined);
  }, [trimFormFields]);

  const buildUserFormItemRules = useCallback(
    (itemKey: string, label: React.ReactNode) => {
      const optionalKeys = [
        "personalPhotoUrl",
        "mobileNumber",
        "emirate",
        "region",
        "area",
        "street",
      ];
      const required = !optionalKeys.includes(itemKey);
      const rules: any[] = [];
      const isNameField = itemKey === "firstName" || itemKey === "lastName";

      if (required && !isNameField) {
        rules.push({
          required: true,
          message: um("validation.pleaseEnter", {
            field: String(label),
          }),
        });
      }

      if (itemKey === "email") {
        rules.push({
          type: "email",
          message: um("validation.emailInvalid"),
        });
      }

      if (isNameField) {
        rules.push(buildTextRule("name", label));
      }
      if (itemKey === "gender") {
        rules.push({ validator: (_: unknown, value: unknown) =>
          value == null || value === "" || [1, 2].includes(Number(value))
            ? Promise.resolve()
            : Promise.reject(new Error(um("validation.genderInvalid"))) });
      }

      if (itemKey === "mobileNumber") {
        rules.push(
          createMobileNumberFormRule({
            fieldNames: adminMobileFieldNames,
          }),
        );
      }

      if (itemKey === "emiratesId") {
        rules.push({
          validator: (_: any, value: any) => {
            const v = String(value ?? "").trim();
            if (!v) return Promise.resolve();
            if (!isCompleteEmiratesId(v)) {
              return Promise.reject(
                new Error(um("validation.emiratesIdInvalid")),
              );
            }
            return Promise.resolve();
          },
        });
      }

      return rules;
    },
    [buildTextRule, um],
  );

  const buildDepartmentFormItemRules = (itemKey: string, label: React.ReactNode) => [
    buildTextRule(itemKey === "nameEn" ? "departmentEn" : "departmentAr", label),
  ];

  const checkFormValidity = (requiredFields: any) => {
    const values = form.getFieldsValue();
    const allFilled = requiredFields.every((f) => {
      const v = values[f];
      return v !== undefined && v !== null && v !== "";
    });
    setIsFormValid(allFilled);
  };

  const handleUserValuesChange = (
    changedValues: Record<string, unknown>,
    allValues: Record<string, unknown>,
  ) => {
    if (Object.prototype.hasOwnProperty.call(changedValues, "department")) {
      const depts = (changedValues.department ?? allValues.department) as
        | number[]
        | undefined;
      const nextDepts = Array.isArray(depts)
        ? depts.map((d) => Number(d)).filter(Number.isFinite)
        : [];
      setUserDepartmentSelection(nextDepts);
      setRolesForUserFormLoading(nextDepts.length > 0);
      if (nextDepts.length === 0) {
        setRolesForUserForm([]);
        userForm.setFieldsValue({ assignRoles: [] });
      }
    }
    checkUserFormValidity(allValues);
  };
  const handleChangeRoleValuesChange = (fields: any) => {
    checkFormValidity(fields);
  };

  const loadAddressData = async () => {
    try {
      const [emirateRes, regionRes, areaRes] = await Promise.all([
        getEmirateList(),
        getRegionList(),
        getAreaList(),
      ]);
      const emirates = (emirateRes as any).data || emirateRes;
      const regions = (regionRes as any).data || regionRes;
      const areas = (areaRes as any).data || areaRes;
      setEmirateList(emirates || []);
      setAllRegionList(regions || []);
      setAllAreaList(areas || []);
    } catch (error) {
      console.error("Load address data failed", error);
    }
  };

  const handleEmirateChange = useCallback(
    (value: number) => {
      setSelectedEmirateId(value);
      const regions = allRegionList.filter(
        (region) => region.emirateId === value,
      );
      setFilteredRegionList(regions);
      userForm.setFieldsValue({ region: undefined, area: undefined });
      if (isAbuDhabiEmirate(value)) {
        setFilteredAreaList([]);
      } else {
        const regionIds = regions.map((r) => r.id);
        const areas = allAreaList.filter((a) => regionIds.includes(a.regionId));
        setFilteredAreaList(areas);
      }
    },
    [allRegionList, allAreaList, isAbuDhabiEmirate, userForm],
  );

  const handleRegionChange = useCallback(
    (value: number) => {
      const areas = allAreaList.filter((area) => area.regionId === value);
      setFilteredAreaList(areas);
      userForm.setFieldsValue({ area: undefined });
    },
    [allAreaList, userForm],
  );

  const loadDepartments = (params?: any) => {
    getDepartments(params)
      .then((res) => {
        const list = (res as any).data?.items || [];
        const treeData = list.map((item: any) => ({
          ...item,
          title: item.nameEn,
          key: String(item.id),
          id: item.id,
          titleAr: item.nameAr,
          code: item.code,
        }));
        setDepartmentTree(treeData);
        setDepartmentOptions(
          list.map((item: any) => ({
            label: item.nameEn,
            value: item.id,
          })),
        );
      })
      .catch((error) => {
        console.error("Load departments failed", error);
      });
  };

  useEffect(() => {
    loadRoles();
    loadAddressData();
    loadUserStatus();
    loadUserLinked();
  }, [i18n.language]);

  useEffect(() => {
    loadUsers({
      DepartmentName: selectedDepartment?.id,
      Status: statusFilter,
      RoleId: roleFilter,
      AdminUserStatus: accountFilter,
      keyword: searchKeyword,
      PageIndex: currentPage,
      PageSize: pageSize,
    });
  }, [
    selectedDepartment,
    roleFilter,
    statusFilter,
    accountFilter,
    searchKeyword,
    pageSize,
    currentPage,
  ]);
  useEffect(() => {
    loadDepartments({});
  }, []);

  const loadUserStatus = async () => {
    getTypeDictionaries("AdminUserStatus")
      .then((res) => {
        let list = (res as any).data || [];
        // list.length > 2 && (list.length = 2);
        setUserStatusList(
          list.map((item: any) => ({
            label: i18n.resolvedLanguage === "ar" ? item.nameAr : item.nameEn,
            value: item.code,
          })),
        );
      })
      .catch((error) => {
        console.error("failed", error);
      });
  };
  const loadUserLinked = () => {
    getTypeDictionaries("AdminUserLinked")
      .then((res) => {
        let list = (res as any).data;
        list.length = 2;
        setUserLinkedList(
          list.map((item: any) => ({
            label: i18n.resolvedLanguage === "ar" ? item.nameAr : item.nameEn,
            value: item.code,
          })),
        );
      })
      .catch((error) => {
        console.error("failed", error);
      });
  };

  const loadUsers = async (params?: any) => {
    const requestSeq = userListRequestSeqRef.current + 1;
    userListRequestSeqRef.current = requestSeq;
    const canUpdate = () =>
      isMountedRef.current && userListRequestSeqRef.current === requestSeq;

    if (isMountedRef.current) {
      setUserListLoading(true);
    }

    try {
      const res = await getAdminUserList(params);
      if (!canUpdate()) return;

      const list = (res as any).data?.items || [];
      setUserList(Array.isArray(list) ? list : []);
      setTotalCount(Number((res as any).data?.totalItems) || 0);
    } catch (error) {
      if (!canUpdate()) return;

      setUserList([]);
      setTotalCount(0);
      console.error("Load admin users failed", error);
    } finally {
      if (canUpdate()) {
        setUserListLoading(false);
      }
    }
  };

  const handleResendDefaultPassword = useCallback(
    async (userId?: string) => {
      if (!userId) {
        return;
      }
      try {
        const res = (await resendAdminDefaultPassword(userId)) as {
          isSuccess?: boolean;
        };
        if (res?.isSuccess) {
          CustomMessage.success(um("messages.defaultPasswordResent"));
          loadUsers({
            DepartmentName: selectedDepartment?.id,
            Status: statusFilter,
            RoleId: roleFilter,
            AdminUserStatus: accountFilter,
            keyword: searchKeyword,
            PageIndex: currentPage,
            PageSize: pageSize,
          });
        }
      } catch (error) {
        console.error("Resend default password failed", error);
      }
    },
    [
      um,
      selectedDepartment?.id,
      statusFilter,
      roleFilter,
      accountFilter,
      searchKeyword,
      currentPage,
      pageSize,
    ],
  );
  const handleLeader = () => {
    console.log(selectedDepartment, LeaderData);
    SetAdminUserLeaderAsync({
      UserId: LeaderData.userId,
      DepartmentId: LeaderData.departmentIds[0],
    }).then((res) => {
      setLeaderVisible(false);
      loadUsers({
        DepartmentName: selectedDepartment?.id,
        Status: statusFilter,
        RoleId: roleFilter,
        AdminUserStatus: accountFilter,
        keyword: searchKeyword,
        PageIndex: currentPage,
        PageSize: pageSize,
      });
    });
  };
  const loadRoles = () => {
    getRoleList({
      pageIndex: 1,
      pageSize: 100,
    })
      .then((res) => {
        const list = (res as any).data?.items || (res as any).data || [];
        setRoleList(
          list.map((item: any) => ({
            label: i18n.resolvedLanguage === "ar" ? item.nameAr : item.nameEn,
            value: String(item.id),
            departmentId: Number(item.departmentId),
          })),
        );
      })
      .catch((error) => {
        console.error("Load admin users failed", error);
      });
  };

  const loadRolesForUserForm = useCallback(
    async (departmentIds: number[]) => {
      const requestSeq = ++rolesForUserFormRequestSeqRef.current;

      if (departmentIds.length === 0) {
        setRolesForUserForm([]);
        setRolesForUserFormLoading(false);
        userForm.setFieldsValue({ assignRoles: [] });
        return;
      }

      setRolesForUserFormLoading(true);

      try {
        const res = await getRoleListByDepartmentId(departmentIds);
        if (requestSeq !== rolesForUserFormRequestSeqRef.current) return;

        const nextRoles = getRoleOptions(res);
        const allowedRoleIds = new Set(
          nextRoles.map((role) => String(role.value)),
        );
        const currentRoles = userForm.getFieldValue("assignRoles");
        const validRoles = Array.isArray(currentRoles)
          ? currentRoles
              .map((roleId) => String(roleId ?? "").trim())
              .filter((roleId) => allowedRoleIds.has(roleId))
          : [];

        setRolesForUserForm(nextRoles);
        userForm.setFieldsValue({ assignRoles: validRoles });
      } catch (error) {
        if (requestSeq !== rolesForUserFormRequestSeqRef.current) return;

        setRolesForUserForm([]);
        userForm.setFieldsValue({ assignRoles: [] });
        CustomMessage.error(um("messages.rolesLoadFailed"));
        console.error("Load user form roles failed", error);
      } finally {
        if (requestSeq === rolesForUserFormRequestSeqRef.current) {
          setRolesForUserFormLoading(false);
        }
      }
    },
    [getRoleOptions, um, userForm],
  );

  useEffect(() => {
    void loadRolesForUserForm(userDepartmentSelection);
  }, [loadRolesForUserForm, userDepartmentSelection]);

  const loadDepartmentRoleCount = useCallback(
    async (departmentId?: number | string | null) => {
      const requestSeq = ++departmentRoleRequestSeqRef.current;

      if (
        departmentId === undefined ||
        departmentId === null ||
        departmentId === ""
      ) {
        setDepartmentRoleState({ departmentId: null, hasRole: true });
        setDepartmentRoleLoading(false);
        return;
      }

      const numericDepartmentId = Number(departmentId);
      if (!Number.isFinite(numericDepartmentId)) {
        setDepartmentRoleState({ departmentId: null, hasRole: true });
        setDepartmentRoleLoading(false);
        return;
      }

      // Intentionally keep the previous settled value here: clearing it would
      // force the table branch to render for one frame before the real answer
      // arrives, which is exactly the flicker on department switch.
      setDepartmentRoleLoading(true);

      try {
        const res = await getRoleListByDepartmentId([numericDepartmentId]);
        if (requestSeq !== departmentRoleRequestSeqRef.current) return;
        const data = (res as { data?: unknown })?.data;
        const items = Array.isArray((data as { items?: unknown })?.items)
          ? (data as { items: unknown[] }).items
          : Array.isArray(data)
            ? data
            : [];
        setDepartmentRoleState({
          departmentId: numericDepartmentId,
          hasRole: items.length > 0,
        });
      } catch (error) {
        if (requestSeq !== departmentRoleRequestSeqRef.current) return;
        // On failure fall back to the table so users are never blocked by a
        // false "no roles" empty state.
        setDepartmentRoleState({
          departmentId: numericDepartmentId,
          hasRole: true,
        });
        console.error("Load department roles failed", error);
      } finally {
        if (requestSeq === departmentRoleRequestSeqRef.current) {
          setDepartmentRoleLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    void loadDepartmentRoleCount(selectedDepartment?.id);
  }, [loadDepartmentRoleCount, selectedDepartment?.id]);

  const selectedDepartmentRoleId = Number(selectedDepartment?.id);
  const resolvedDepartmentRoleId = Number.isFinite(selectedDepartmentRoleId)
    ? selectedDepartmentRoleId
    : null;
  // Treat a response for a different department as unresolved so its result
  // cannot temporarily render the wrong empty state during a department switch.
  const isDepartmentRoleUnresolved =
    departmentRoleState === null ||
    departmentRoleState.departmentId !== resolvedDepartmentRoleId;
  const isDepartmentWithoutRole =
    resolvedDepartmentRoleId !== null &&
    departmentRoleState !== null &&
    departmentRoleState.departmentId === resolvedDepartmentRoleId &&
    !departmentRoleState.hasRole;

  const handleAddRole = useCallback(() => {
    history.push("/system-management/roleManagement/roledetails");
  }, [history]);

  useEffect(() => {
    return () => {
      departmentRoleRequestSeqRef.current += 1;
      rolesForUserFormRequestSeqRef.current += 1;
    };
  }, []);

  const handleSaveUser = async () => {
    const session = userFormSessionRef.current;
    try {
      setUserSaving(true);
      trimFormFields(userForm, ["firstName", "lastName", "email", "emiratesId"]);
      const values = await userForm.validateFields();
      if (session !== userFormSessionRef.current) return;
      const adminMobileValue = readContactFormValue(
        values.mobileNumber,
        adminMobileFieldNames,
      );
      const adminMobileFields = buildContactNumberFields({
        value: adminMobileValue,
        initial: createContactNumberSnapshot({
          countryCode: editingUser?.mobileCountryCode,
          localNumber: editingUser?.mobileLocalNumber,
          fullNumber: editingUser?.mobileNumber,
        }),
        keys: {
          fullNumber: "mobileNumber",
          countryCode: "mobileCountryCode",
          localNumber: "mobileLocalNumber",
        },
      });

      const basePayload = {
        personalPhotoUrl: values.personalPhotoUrl || "",
        firstName: trimText(values.firstName),
        lastName: trimText(values.lastName),
        email: trimText(values.email),
        gender: Number(values.gender),
        emiratesId: emiratesIdToDisplay(values.emiratesId) || "",
        mobileNumber: adminMobileFields.mobileNumber,
        mobileCountryCode: adminMobileFields.mobileCountryCode,
        mobileLocalNumber: adminMobileFields.mobileLocalNumber,
        occupation: "",
        departmentIds: Array.isArray(values.department)
          ? values.department.map((id: any) => Number(id))
          : [],
        assignRolesIds: (values.assignRoles || []).map((id: any) => String(id)),
        emirateId: Number(values.emirate) || 0,
        regionId: Number(values.region) || 0,
        areaId: Number(values.area) || 0,
        street: values.street || "",
        status: values.status,
        password: values.password ? aesEncrypt(values.password) : "",
      };

      if (!editingUser) {
        await addAdminUser(basePayload);
        if (session === userFormSessionRef.current) CustomMessage.success(um("messages.userAdded"));
      } else {
        const updatePayload = {
          userId: editingUser.userId,
          ...basePayload,
        };
        await updateAdminUser(updatePayload);
        if (session === userFormSessionRef.current) CustomMessage.success(um("messages.userUpdated"));

        const normalizedCurrentUserEmail = normalizeEmail(currentUserEmail);
        const normalizedEditingUserEmail = normalizeEmail(editingUser.email);
        if (
          normalizedCurrentUserEmail &&
          normalizedEditingUserEmail &&
          normalizedCurrentUserEmail === normalizedEditingUserEmail
        ) {
          performAuthenticatedLogout({});
          return;
        }
      }

      if (session !== userFormSessionRef.current) return;
      setAddUserVisible(false);
      setEditUserVisible(false);
      loadUsers({
        DepartmentName: selectedDepartment?.id,
        Status: statusFilter,
        RoleId: roleFilter,
        AdminUserStatus: accountFilter,
        keyword: searchKeyword,
        PageIndex: 1,
        PageSize: pageSize,
      });
    } catch (error) {
      if (session !== userFormSessionRef.current) return;
      if (
        error &&
        typeof error === "object" &&
        "errorFields" in error
      ) {
        setIsUserFormValid(false);
        const fields = (error as { errorFields: { name: (string | number)[] }[] }).errorFields;
        if (fields[0]) {
          const unlock = getFieldsToUnlock(fields.map((field) => field.name))
            .filter((field) => isUserFieldFilled(editingUser, field));
          pendingErrorField.current = fields[0].name;
          if (editUserVisible && unlock.length) {
            setUnlockedUserFields((previous) => [...new Set([...previous, ...unlock])]);
          }
        }
        return;
      }
      const responseData =
        error && typeof error === "object" && "response" in error
          ? (error as { response?: { data?: unknown } }).response?.data
          : undefined;
      const addUserErrorMessage = !editingUser
        ? getApiResponseMessage(responseData)
        : "";

      CustomMessage.error(
        addUserErrorMessage || um("messages.userSaveFailed"),
      );
      console.error("User form validation failed or save failed:", error);
    } finally {
      if (session === userFormSessionRef.current) setUserSaving(false);
    }
  };

  const handleRoleFilterChange = useCallback((value?: string) => {
    setRoleFilter(value);
    setCurrentPage(1);
  }, []);

  const handleStatusFilterChange = useCallback((value?: string) => {
    setStatusFilter(value);
    setCurrentPage(1);
  }, []);

  const handleAccountFilterChange = useCallback((value?: string) => {
    setAccountFilter(value);
    setCurrentPage(1);
  }, []);

  // The filter modal edits role, status and account.
  const appliedFilterCount = countAppliedFilters([
    roleFilter,
    statusFilter,
    accountFilter,
  ]);

  const handleOpenFilterModal = () => {
    setDraftRoleFilter(roleFilter);
    setDraftStatusFilter(statusFilter);
    setDraftAccountFilter(accountFilter);
    setFilterModalVisible(true);
  };

  const handleApplyFilterModal = () => {
    setRoleFilter(draftRoleFilter);
    setStatusFilter(draftStatusFilter);
    setAccountFilter(draftAccountFilter);
    setCurrentPage(1);
    setFilterModalVisible(false);
  };

  const handleResetFilters = () => {
    debouncedSearch.cancel();
    setKeyword("");
    setSearchKeyword("");
    setRoleFilter(undefined);
    setStatusFilter(undefined);
    setAccountFilter(undefined);
    setDraftRoleFilter(undefined);
    setDraftStatusFilter(undefined);
    setDraftAccountFilter(undefined);
    setCurrentPage(1);
  };

  const departmentMenu = (
    <Menu>
      <Menu.Item key="add" onClick={handleAddDepartment}>
        {um("departmentMenu.addDepartment")}
      </Menu.Item>
      <Menu.Item
        key="edit"
        onClick={() => handleEditDepartment({ title: "New Department" })}
      >
        {um("departmentMenu.editDepartment")}
      </Menu.Item>
    </Menu>
  );

  const departmentMenu2 = (
    <Menu>
      <Menu.Item
        key="delete"
        onClick={() => {
          setDeleteUserVisible(true);
        }}
      >
        {um("departmentMenu.delete")}
      </Menu.Item>
    </Menu>
  );

  const treeNodeMenu = (nodeData: any) => (
    <Menu>
      <Menu.Item key="edit" onClick={() => handleEditDepartment(nodeData)}>
        {um("departmentMenu.editDepartment")}
      </Menu.Item>
      <Menu.Item key="delete" onClick={() => handleDeleteDepartment(nodeData)}>
        {um("departmentMenu.deleteDepartment")}
      </Menu.Item>
    </Menu>
  );

  const renderTreeTitle = (nodeData: any) => (
    <div
      className={`tree-node-wrapper ${
        hoveredNodeKey === nodeData.key ? "hovered" : ""
      } ${
        selectedTreeKeys.includes(String(nodeData.key)) ? "selected" : ""
      }`}
      onMouseEnter={() => setHoveredNodeKey(nodeData.key)}
      onMouseLeave={() => setHoveredNodeKey(null)}
    >
      <span className="node-title">{nodeData.title}</span>
      {(hoveredNodeKey === nodeData.key ||
        selectedTreeKeys.includes(String(nodeData.key))) && (
        <Dropdown
          overlay={treeNodeMenu(nodeData)}
          className="user-management-dropdown"
          trigger={["click"]}
        >
          <button
            type="button"
            className="node-more-button"
            aria-label={`More actions for ${nodeData.title}`}
            onClick={(event) => event.stopPropagation()}
          >
            <MoreOutlined className="node-more-icon" />
          </button>
        </Dropdown>
      )}
    </div>
  );

  const hasSelectedDepartment =
    selectedDepartment && Object.keys(selectedDepartment).length > 0;
  const userActionColumnWidth = useResponsiveActionColumnWidth<
    UserRecord,
    UserManagementActionColumnKey
  >({
    rows: userList,
    buttonWidthMap: USER_MANAGEMENT_ACTION_BUTTON_WIDTH_MAP,
    getVisibleActions: (record) => {
      const visibleActions: UserManagementActionColumnKey[] = ["edit", "delete"];

      if (!record.isLeader && hasSelectedDepartment) {
        visibleActions.push("setLeader");
      }

      return visibleActions;
    },
    getActionLabel: (actionKey) => {
      switch (actionKey) {
        case "edit":
          return String(um("actions.edit"));
        case "delete":
          return String(um("actions.delete"));
        case "setLeader":
          return String(um("actions.setLeader"));
        default:
          return undefined;
      }
    },
    desktopConfig: USER_MANAGEMENT_ACTION_COLUMN_DESKTOP_CONFIG,
    compactConfig: USER_MANAGEMENT_ACTION_COLUMN_COMPACT_CONFIG,
    textMeasureConfig: USER_MANAGEMENT_ACTION_COLUMN_TEXT_MEASURE_CONFIG,
  });
  const userTableScrollX =
    USER_MANAGEMENT_ACTION_COLUMN_BASE_SCROLL_X + userActionColumnWidth;

  const columns: ColumnsType<UserRecord> = [
    {
      width: 30,
      className: "leader-icon-cell",
      render: (_, record) => (
        <div className="leader-icon">
          {record.isLeader &&
            selectedDepartment &&
            Object.keys(selectedDepartment).length > 0 && (
              <img src={LeaderSvg} alt="" />
            )}
        </div>
      ),
    },
    {
      title: um("table.username"),
      dataIndex: "userName",
      key: "userName",
    },
    {
      title: um("table.department"),
      dataIndex: "departmentsInfo",
      key: "departmentsInfo",
      ellipsis: {
        showTitle: false,
      },

      render: (text: any) => (
        <Tooltip
          color={"#fff"}
          overlayInnerStyle={{ backgroundColor: "#fff", color: "#000" }}
          placement="topLeft"
          title={text?.map((item: any) => item.name)?.toString()}
        >
          <span>{text?.map((item: any) => item.name)?.toString()}</span>
        </Tooltip>
      ),
    },
    {
      title: um("table.role"),
      dataIndex: "assignRolesIdsInfo",
      key: "assignRolesIdsInfo",
      ellipsis: {
        showTitle: false,
      },
      render: (text: any) => (
        <Tooltip
          color={"#fff"}
          overlayInnerStyle={{ backgroundColor: "#fff", color: "#000" }}
          placement="topLeft"
          title={text?.map((item: any) => item.name)?.toString()}
        >
          <span>{text?.map((item: any) => item.name)?.toString()}</span>
        </Tooltip>
      ),
    },
    {
      title: um("table.linkedAccounts"),
      dataIndex: "adminUserLinkedInfo",
      key: "adminUserLinkedInfo",
      render: (text: any) => {
        let textNew =
          text?.length >= 2
            ? text?.filter((item: any) => item.name !== "Unlinked only")
            : text;
        return (
          <span>{textNew?.map((item: any) => item.name)?.toString()}</span>
        );
      },
    },

    {
      title: um("table.email"),
      dataIndex: "email",
      key: "email",
      width: 240,
      ellipsis: { showTitle: false },
      render: (email: UserRecord["email"]) => (
        <OverflowTooltip
          className="user-management__email"
          title={<bdi>{email}</bdi>}
        >
          <bdi>{email}</bdi>
        </OverflowTooltip>
      ),
    },
    {
      title: um("table.status"),
      dataIndex: "status",
      key: "status",
      render: (text: UserState) => (
        <CustomStatusTag type="userManagement" status={Number(text)} />
      ),
    },
    {
      title: um("table.actions"),
      key: "actions",
      // Design: keep actions reachable while the table scrolls sideways.
      fixed: "right" as const,
      width: userActionColumnWidth,
      render: (_, record) => (
        <div className="actions">
          <div
            className="table-btn"
            onClick={() => {
              openEditUser(record);
            }}
          >
            {um("actions.edit")}
          </div>
          {/* {record.state === "3" &&  */}
          <div
            className="table-btn"
            onClick={() => {
              if (record.status === "1") {
                setDeleteUserFailedVisible(true);
                setDeleteUserVisible(false);
              } else {
                setEditingUser(record);
                setDeleteUserVisible(true);
              }
            }}
          >
            {um("actions.delete")}
          </div>
          {!record.isLeader &&
            selectedDepartment &&
            Object.keys(selectedDepartment).length > 0 && (
              <div
                className="table-btn"
                onClick={() => {
                  setLeaderVisible(true);
                  setLeaderData(record);
                }}
              >
                {um("actions.setLeader")}
              </div>
            )}

          {/* {record.isChangePwd ? (
            <div
              className="table-btn"
              onClick={() => handleResendDefaultPassword(record.userId)}
            >
              {um("actions.resetPassword")}
            </div>
          ) : null} */}
          {/* } */}
          {/* <div className="table-btn">
            <Dropdown
              className="user-management-dropdown"
              overlay={departmentMenu2}
              trigger={["click"]}
            >
              <MoreOutlined className="more-icon" />
            </Dropdown>
          </div> */}
        </div>
      ),
    },
  ];

  const userStatusSelectOptions = useMemo(() => {
    if (addUserVisible && !editUserVisible) {
      return userStatusList.filter((s) => String(s.value) === "1");
    }
    if (editUserVisible) {
      return userStatusList.filter((s) => ["1", "2"].includes(String(s.value)));
    }
    return userStatusList;
  }, [userStatusList, addUserVisible, editUserVisible]);

  const showAbuDhabiRegionField = useMemo(
    () => isAbuDhabiEmirate(selectedEmirateId),
    [selectedEmirateId, isAbuDhabiEmirate],
  );

  const userFormAddressItems: FormPanelSectionConfig["items"] = useMemo(
    () => [
      {
        key: "emirate",
        label: um("labels.emirate"),
        colSpan: 1 as const,
        renderEdit: () => (
          <Select
            placeholder={um("placeholders.selectEmirate")}
            onChange={handleEmirateChange}
            options={(emirateList || []).map((item) => ({
              label: item.nameEn,
              value: item.id,
            }))}
          />
        ),
      },
      ...(showAbuDhabiRegionField
        ? [
            {
              key: "region",
              label: um("labels.region"),
              colSpan: 1 as const,
              renderEdit: () => (
                <Select
                  placeholder={um("placeholders.selectRegion")}
                  onChange={handleRegionChange}
                  options={(filteredRegionList || []).map((item) => ({
                    label: item.nameEn,
                    value: item.id,
                  }))}
                />
              ),
            },
          ]
        : []),
      {
        key: "area",
        label: um("labels.area"),
        colSpan: 1 as const,
        renderEdit: () => (
          <Select
            placeholder={um("placeholders.selectArea")}
            options={(filteredAreaList || []).map((item) => ({
              label: item.nameEn,
              value: item.id,
            }))}
          />
        ),
      },
      {
        key: "street",
        label: um("labels.street"),
        colSpan: 1 as const,
        renderEdit: () => (
          <Input placeholder={um("placeholders.enterStreet")} maxLength={200} />
        ),
      },
    ],
    [
      um,
      emirateList,
      filteredRegionList,
      filteredAreaList,
      handleEmirateChange,
      handleRegionChange,
      showAbuDhabiRegionField,
    ],
  );

  const userFormSections: FormPanelSectionConfig[] = useMemo(
    () => [
      {
        key: "personal",
        title: um("sections.personal"),
        columns: 2,
        items: [
          {
            key: "personalPhotoUrl",
            label: um("labels.personalPhoto"),
            colSpan: 1,
            editClassName: "avatar-personalPhotoUrl",
            renderEdit: () =>
              editingUser?.personalPhotoUrl ? (
                <Avatar
                  onSuccess={(val: string) => {
                    setEditingUser({
                      ...editingUser,
                      personalPhotoUrl: val,
                    });
                    userForm.setFieldsValue({
                      personalPhotoUrl: val,
                    });
                  }}
                  url={editingUser?.personalPhotoUrl}
                />
              ) : (
                <Avatar
                  isAdd
                  onSuccess={(val: string) => {
                    userForm.setFieldsValue({ personalPhotoUrl: val });
                  }}
                  url={undefined}
                />
              ),
          },
          {
            key: "",
            label: "",
            colSpan: 1,
            renderEdit: () => null,
          },
          {
            key: "firstName",
            label: um("labels.firstName"),
            colSpan: 1,
            renderEdit: () => (
              <Input
                placeholder={um("placeholders.enter")}
                onBlur={() => trimFieldOnBlur(userForm, "firstName")}
                disabled={isEditingUserFieldLocked("firstName")}
              />
            ),
          },
          {
            key: "lastName",
            label: um("labels.lastName"),
            colSpan: 1,
            renderEdit: () => (
              <Input
                placeholder={um("placeholders.enter")}
                onBlur={() => trimFieldOnBlur(userForm, "lastName")}
                disabled={isEditingUserFieldLocked("lastName")}
              />
            ),
          },
          {
            key: "email",
            label: um("labels.email"),
            colSpan: 1,
            renderEdit: () => (
              <Input
                type="email"
                maxLength={254}
                placeholder={um("placeholders.enter")}
                onBlur={() => trimFieldOnBlur(userForm, "email")}
                disabled={isEditingUserFieldLocked("email")}
              />
            ),
          },
          {
            key: "gender",
            label: um("labels.gender"),
            colSpan: 1,
            renderEdit: () => (
              <Select
                placeholder={um("placeholders.select")}
                disabled={isEditingUserFieldLocked("gender")}
                options={[
                  { label: um("gender.male"), value: 1 },
                  { label: um("gender.female"), value: 2 },
                ]}
              />
            ),
          },
          {
            key: "emiratesId",
            label: um("labels.emiratesId"),
            colSpan: 1,
            renderEdit: () => (
              <EmiratesIdInput
                placeholder={um("placeholders.emiratesId")}
                maxLength={EMIRATES_ID_DISPLAY_MAX_LENGTH}
                inputMode="numeric"
                autoComplete="off"
                showInteractiveMask
                onBlur={() => trimFieldOnBlur(userForm, "emiratesId")}
                disabled={isEditingUserFieldLocked("emiratesId")}
              />
            ),
          },
          {
            key: "mobileNumber",
            label: um("labels.mobileNumber"),
            colSpan: 1,
            renderEdit: () => (
              <FormMobileNumberInput
                fieldNames={adminMobileFieldNames}
                defaultCountryCode=""
              />
            ),
          },
        ],
      },

      {
        key: "organization",
        title: um("sections.organization"),
        columns: 2,
        items: [
          {
            key: "department",
            label: um("labels.department"),
            colSpan: 1,
            renderEdit: (formInstance) => (
              <SelectAllDropdown
                placeholder={um("placeholders.select")}
                value={formInstance.getFieldValue("department") || []}
                options={departmentOptions}
                showSearch={false}
                showSelectAll={false}
                selectionDisplay="tags"
                clearable={false}
                tagRemovable
                maxTagCount={99}
                className="user-management-org-dropdown"
              />
            ),
          },
          {
            key: "assignRoles",
            label: um("labels.assignRoles"),
            colSpan: 1,
            renderEdit: (formInstance) => (
              <SelectAllDropdown
                placeholder={um("placeholders.select")}
                value={formInstance.getFieldValue("assignRoles") || []}
                options={rolesForUserForm}
                showSearch={false}
                showSelectAll={false}
                selectionDisplay="tags"
                clearable={false}
                tagRemovable
                maxTagCount={99}
                disabled={rolesForUserFormLoading}
                className="user-management-org-dropdown"
              />
            ),
          },
        ],
      },

      {
        key: "address",
        title: um("sections.address"),
        columns: 2,
        items: userFormAddressItems,
      },
      {
        key: "login",
        title: um("sections.login"),
        columns: 2,
        items: [
          {
            key: "status",
            label: um("labels.status"),
            colSpan: 1,
            renderEdit: () => (
              <Select
                placeholder={um("placeholders.allStatus")}
                options={userStatusSelectOptions as any}
              />
            ),
          },
        ],
      },
    ],
    [
      um,
      departmentOptions,
      rolesForUserForm,
      rolesForUserFormLoading,
      userFormAddressItems,
      userStatusSelectOptions,
      editingUser,
      editUserVisible,
      isEditingUserFieldLocked,
      trimFieldOnBlur,
    ],
  );

  const rowSelection = {
    selectedRowKeys,
    onChange: (keys: React.Key[]) => setSelectedRowKeys(keys),
  };

  const departmentFormSections: FormPanelSectionConfig[] = useMemo(
    () => [
      {
        key: "basic",
        columns: 2,
        items: [
          {
            key: "nameEn",
            label: um("labels.departmentNameEn"),
            renderEdit: () => (
              <Input
                onBlur={() => trimFieldOnBlur(departmentForm, "nameEn")}
                placeholder={um("placeholders.departmentNameEn")}
              />
            ),
            colSpan: 1,
          },
          {
            key: "nameAr",
            label: um("labels.departmentNameAr"),
            renderEdit: () => (
              <Input
                onBlur={() => trimFieldOnBlur(departmentForm, "nameAr")}
                placeholder={um("placeholders.departmentNameAr")}
                style={{ direction: "rtl" }}
              />
            ),
            colSpan: 1,
          },
          // {
          //   key: "parentDepartment",
          //   label: "Parent Department",
          //   renderEdit: () => (
          //     <Select
          //       placeholder="Select parent department"
          //       options={departmentOptions}
          //     />
          //   ),
          //   colSpan: 2,
          // },
        ],
      },
    ],
    [um, departmentForm, trimFieldOnBlur],
  );

  const selectedDepartmentTitle =
    selectedDepartment?.title ?? um("rootOrganization");

  return (
    <div className="user-management">
      <Modal
        centered
        title={um("modals.addUser.title")}
        visible={addUserVisible}
        width={""}
        maskClosable={false}
        onCancel={() => {
          userFormSessionRef.current += 1;
          setUserSaving(false);
          setAddUserVisible(false);
        }}
        footer={[
          <CustomButton
            key="cancel"
            text={um("buttons.cancel")}
            variant="outline"
            onClick={() => {
              userFormSessionRef.current += 1;
              setUserSaving(false);
              setAddUserVisible(false);
            }}
            disabled={userSaving}
          />,
          <CustomButton
            key="confirm"
            text={um("buttons.confirm")}
            variant="primary"
            disabled={userSaving}
            customClassName={
              !isUserFormValid ? "user-modal__confirm--invalid" : ""
            }
            loading={userSaving}
            onClick={handleSaveUser}
          />,
        ]}
        className="user-modal"
      >
        <SimpleBar className="user-modal-scroll">
          <FormPanel
            form={userForm}
            mode="edit"
            // record={editingUser}
            className="userForm"
            onValuesChange={handleUserValuesChange}
            sections={userFormSections.map((section) => ({
              ...section,
              items: section.items.map((item) => ({
                ...item,
                renderEdit: (formInstance) =>
                  item.key ? (
                    <Form.Item
                      name={item.key}
                      label={item.label}
                      validateTrigger={
                        item.key === "firstName" || item.key === "lastName"
                          ? "onBlur"
                          : undefined
                      }
                      normalize={item.key === "emiratesId" ? (v) => formatEmiratesIdDigits(String(v ?? "")) : undefined}
                      rules={buildUserFormItemRules(
                        String(item.key),
                        item.label,
                      )}
                    >
                      {item.renderEdit ? item.renderEdit(formInstance) : null}
                    </Form.Item>
                  ) : item.renderEdit ? (
                    item.renderEdit(formInstance)
                  ) : null,
              })),
            }))}
          />
        </SimpleBar>
      </Modal>

      <Modal
        centered
        title={um("modals.editUser.title")}
        visible={editUserVisible}
        width={""}
        onCancel={() => {
          userFormSessionRef.current += 1;
          setUserSaving(false);
          setEditUserVisible(false);
        }}
        destroyOnClose
        footer={[
          <CustomButton
            key="cancel"
            text={um("buttons.cancel")}
            variant="outline"
            onClick={() => {
              userFormSessionRef.current += 1;
              setUserSaving(false);
              setEditUserVisible(false);
            }}
            disabled={userSaving}
          />,
          <CustomButton
            key="confirm"
            text={um("buttons.confirm")}
            variant="primary"
            disabled={userSaving}
            customClassName={
              !isUserFormValid ? "user-modal__confirm--invalid" : ""
            }
            loading={userSaving}
            onClick={handleSaveUser}
          />,
        ]}
        className="user-modal"
      >
        <SimpleBar className="user-modal-scroll">
          <FormPanel
            form={userForm}
            mode="edit"
            className="userForm"
            onValuesChange={handleUserValuesChange}
            sections={userFormSections.map((section) => ({
              ...section,
              items: section.items.map((item) => ({
                ...item,
                renderEdit: (formInstance) =>
                  item.key ? (
                    <Form.Item
                      name={item.key}
                      label={item.label}
                      validateTrigger={
                        item.key === "firstName" || item.key === "lastName"
                          ? "onBlur"
                          : undefined
                      }
                      normalize={item.key === "emiratesId" ? (v) => formatEmiratesIdDigits(String(v ?? "")) : undefined}
                      rules={buildUserFormItemRules(
                        String(item.key),
                        item.label,
                      )}
                    >
                      {item.renderEdit ? item.renderEdit(formInstance) : null}
                    </Form.Item>
                  ) : item.renderEdit ? (
                    item.renderEdit(formInstance)
                  ) : null,
              })),
            }))}
          />
        </SimpleBar>
      </Modal>
      <Modal
        centered
        title={um("modals.addDepartment.title")}
        visible={addDepartmentVisible}
        maskClosable={false}
        width={""}
        onCancel={() => {
          departmentDetailRequestSeqRef.current += 1;
          setDepartmentSaving(false);
          setAddDepartmentVisible(false);
        }}
        footer={[
          <CustomButton
            key="cancel"
            text={um("buttons.cancel")}
            variant="outline"
            onClick={() => {
              departmentDetailRequestSeqRef.current += 1;
              setDepartmentSaving(false);
              setAddDepartmentVisible(false);
            }}
            disabled={departmentSaving}
          />,
          <CustomButton
            key="confirm"
            text={um("buttons.confirm")}
            variant="primary"
            disabled={departmentSaving}
            customClassName={isAddDepartmentConfirmDisabled ? "user-modal__confirm--invalid" : ""}
            loading={departmentSaving}
            onClick={handleAddDepartmentSubmit}
          />,
        ]}
        className="department-modal"
      >
        <FormPanel
          form={departmentForm}
          mode="edit"
          sections={departmentFormSections.map((section) => ({
            ...section,
            items: section.items.map((item) => ({
              ...item,
              renderEdit: (formInstance) => (
                <Form.Item
                  name={item.key}
                  label={item.label}
                  validateTrigger="onBlur"
                  rules={buildDepartmentFormItemRules(String(item.key), item.label)}
                >
                  {item.renderEdit ? item.renderEdit(formInstance) : null}
                </Form.Item>
              ),
            })),
          }))}
        />
      </Modal>

      <Modal
        centered
        title={um("modals.editDepartment.title")}
        visible={editDepartmentVisible}
        width={""}
        onCancel={() => {
          departmentDetailRequestSeqRef.current += 1;
          setDepartmentSaving(false);
          setInitialDepartmentNames(null);
          setEditDepartmentVisible(false);
        }}
        footer={[
          <CustomButton
            key="cancel"
            text={um("buttons.cancel")}
            variant="outline"
            onClick={() => {
              departmentDetailRequestSeqRef.current += 1;
              setDepartmentSaving(false);
              setInitialDepartmentNames(null);
              setEditDepartmentVisible(false);
            }}
            disabled={departmentSaving}
          />,
          <CustomButton
            key="confirm"
            text={um("buttons.confirm")}
            variant="primary"
            disabled={departmentSaving}
            customClassName={isEditDepartmentConfirmDisabled ? "user-modal__confirm--invalid" : ""}
            loading={departmentSaving}
            onClick={handleEditDepartmentSubmit}
          />,
        ]}
        className="department-modal"
      >
        <FormPanel
          form={departmentForm}
          mode="edit"
          sections={departmentFormSections.map((section) => ({
            ...section,
            items: section.items.map((item) => ({
              ...item,
              renderEdit: (formInstance) => (
                <Form.Item
                  name={item.key}
                  label={item.label}
                  validateTrigger="onBlur"
                  rules={buildDepartmentFormItemRules(String(item.key), item.label)}
                >
                  {item.renderEdit ? item.renderEdit(formInstance) : null}
                </Form.Item>
              ),
            })),
          }))}
        />
      </Modal>

      <ConfirmModal
        visible={deleteDepartmentVisible}
        type="danger"
        title={um("confirm.deleteDepartment.title")}
        content={um("confirm.deleteDepartment.content")}
        cancelText={um("buttons.cancel")}
        confirmText={um("buttons.delete")}
        onCancel={() => setDeleteDepartmentVisible(false)}
        onConfirm={handleConfirmDelete}
      />

      <ConfirmModal
        visible={deleteDepartmentFailedVisible}
        type="danger"
        title={um("confirm.deleteDepartmentFailed.title")}
        content={um("confirm.deleteDepartmentFailed.content")}
        cancelText=""
        confirmText={um("buttons.close")}
        onCancel={() => setDeleteDepartmentFailedVisible(false)}
        onConfirm={() => setDeleteDepartmentFailedVisible(false)}
      />

      <ConfirmModal
        visible={deleteUserFailedVisible}
        type="danger"
        title={um("confirm.deleteUserFailed.title")}
        content={um("confirm.deleteUserFailed.content")}
        width={600}
        cancelText=""
        confirmText={um("buttons.close")}
        onCancel={() => setDeleteUserFailedVisible(false)}
        onConfirm={() => setDeleteUserFailedVisible(false)}
      />

      <ConfirmModal
        visible={deleteUserVisible}
        type="danger"
        title={um("confirm.deleteUser.title")}
        content={um("confirm.deleteUser.content")}
        width={600}
        cancelText={um("buttons.cancel")}
        confirmText={um("buttons.delete")}
        onCancel={() => setDeleteUserVisible(false)}
        onConfirm={() => handleDeleteUser()}
      />

      <ConfirmModal
        visible={deactivateVisible}
        type="warning"
        title={um("confirm.deactivate.title")}
        content={
          <div>
            {um("confirm.deactivate.intro")}
            <ul>
              <li>{um("confirm.deactivate.bullet1")}</li>
              <li>{um("confirm.deactivate.bullet2")}</li>
            </ul>
          </div>
        }
        cancelText={um("buttons.cancel")}
        confirmText={um("buttons.confirm")}
        onCancel={() => setDeactivateVisible(false)}
        onConfirm={handleConfirmDeactivate}
      />

      <Modal
        centered
        title={um("modals.changeDepartment.title")}
        visible={changeDepartmentVisible}
        width={""}
        destroyOnClose
        onCancel={() => {
          checkFormValidity([]);
          setChangeDepartmentVisible(false);
        }}
        footer={[
          <CustomButton
            key="cancel"
            text={um("buttons.cancel")}
            variant="outline"
            onClick={() => setChangeDepartmentVisible(false)}
          />,
          <CustomButton
            key="confirm"
            text={um("buttons.confirm")}
            variant="primary"
            disabled={!isFormValid}
            onClick={handleChangeDepartment}
          />,
        ]}
        className="department-modal"
      >
        <FormPanel
          form={form}
          mode="edit"
          onValuesChange={() => {
            handleChangeRoleValuesChange(["department"]);
          }}
          sections={[
            {
              key: "department",
              columns: 1,
              items: [
                {
                  key: "department",
                  label: um("labels.department"),
                  renderEdit: (formInstance) => (
                    <Form.Item
                      name="department"
                      label={um("labels.department")}
                      rules={[
                        {
                          required: true,
                          message: um("validation.selectDepartment"),
                        },
                      ]}
                    >
                      <Select
                        placeholder={um("placeholders.selectDepartment")}
                        options={departmentOptions}
                      />
                    </Form.Item>
                  ),
                  colSpan: 1,
                },
              ],
            },
          ]}
        />
      </Modal>

      <Modal
        centered
        title={um("modals.changeRole.title")}
        visible={changeRoleVisible}
        width={""}
        destroyOnClose
        onCancel={() => {
          checkFormValidity([]);
          setChangeRoleVisible(false);
        }}
        footer={[
          <CustomButton
            key="cancel"
            text={um("buttons.cancel")}
            variant="outline"
            onClick={() => setChangeRoleVisible(false)}
          />,
          <CustomButton
            key="confirm"
            text={um("buttons.confirm")}
            variant="primary"
            disabled={!isFormValid}
            onClick={handleChangeRole}
          />,
        ]}
        className="department-modal"
      >
        <FormPanel
          form={form}
          mode="edit"
          onValuesChange={() => {
            handleChangeRoleValuesChange(["role"]);
          }}
          sections={[
            {
              key: "role",
              columns: 1,
              items: [
                {
                  key: "role",
                  label: um("labels.assignRoles"),
                  renderEdit: (formInstance) => (
                    <Form.Item
                      name="role"
                      label={um("labels.assignRoles")}
                      rules={[
                        {
                          required: true,
                          message: um("validation.selectRole"),
                        },
                      ]}
                    >
                      <Select
                        placeholder={um("placeholders.select")}
                        options={roleList}
                      />
                    </Form.Item>
                  ),
                  colSpan: 1,
                },
              ],
            },
          ]}
        />
      </Modal>
      <ConfirmModal
        visible={LeaderVisible}
        type="warning"
        title={um("actions.leaderTitle")}
        content={um("actions.leaderContent")}
        width={600}
        cancelText={um("buttons.cancel")}
        confirmText={um("buttons.confirm")}
        onCancel={() => setLeaderVisible(false)}
        onConfirm={() => handleLeader()}
      />

      <div className="sidebar">
        <div
          className="sidebar-header "
          onMouseEnter={() => setHeaderHovered(true)}
          onMouseLeave={() => setHeaderHovered(false)}
        >
          <div
            className="header-content"
            onClick={() => {
              setSelectedDepartment({});
              setSelectedTreeKeys([]);
              setCurrentPage(1);
            }}
          >
            <span>{um("rootOrganization")}</span>
            {/* {headerHovered && (
              <Dropdown
                className="user-management-dropdown"
                overlay={departmentMenu}
                trigger={["click"]}
              >
                <MoreOutlined className="more-icon" />
              </Dropdown>
            )} */}
            <PlusOutlined
              className="more-icon"
              onClick={(event) => {
                event.stopPropagation();
                handleAddDepartment();
              }}
            />
          </div>
        </div>
        <div className="sidebar-tree">
          {departmentTree.length > 0 ? (
            <Tree
              treeData={departmentTree as any}
              defaultExpandAll
              showIcon={false}
              selectedKeys={selectedTreeKeys}
              onSelect={(keys, info: any) => {
                setSelectedTreeKeys((keys as React.Key[]).map(String));
                setSelectedDepartment(info.node);
                setCurrentPage(1);
              }}
              titleRender={(nodeData: any) => renderTreeTitle(nodeData)}
            />
          ) : (
            <EmptyBox
              title={um("empty.noDepartments")}
              buttonText={um("empty.addDepartment")}
              hasButton
              onClick={handleAddDepartment}
            ></EmptyBox>
          )}
        </div>
        {/* <CustomButton
          text="Sync Azure AD"
          variant="primary"
          onClick={handleSync}
        /> */}
      </div>
      <div className="main">
        {departmentTree.length > 0 ? (
          <>
            <div className="main-header">
              <div className="title">
                {selectedDepartmentTitle} ({totalCount})
              </div>
              <div className="filters responsive-filter-toolbar">
                <div className="filters-selects responsive-filter-toolbar__controls">
                  <Input
                    placeholder={um("filters.search")}
                    prefix={<Sousuo className="search-icon" />}
                    value={keyword}
                    allowClear
                    onChange={(e) => {
                      setKeyword(e.target.value);
                      debouncedSearch(e.target.value);
                    }}
                    className="sidebar-search responsive-filter-toolbar__field responsive-filter-toolbar__field--search user-management-filter-toolbar__search"
                  />
                  <Select
                    placeholder={um("filters.allRoles")}
                    value={roleFilter}
                    onChange={handleRoleFilterChange}
                    className="filters-select responsive-filter-toolbar__field user-management-filter-toolbar__field--secondary"
                    options={[
                      {
                        label: um("filters.allRoles"),
                        value: "",
                      },
                      ...roleList,
                    ]}
                    allowClear
                  />
                  <Select
                    placeholder={um("filters.allStatus")}
                    value={statusFilter}
                    onChange={handleStatusFilterChange}
                    className="filters-select responsive-filter-toolbar__field user-management-filter-toolbar__field--modal-only"
                    options={[
                      {
                        label: um("filters.allStatus"),
                        value: "",
                      },
                      ...userStatusList,
                    ]}
                    allowClear
                  />
                  <Select
                    placeholder={um("filters.allAccounts")}
                    value={accountFilter}
                    onChange={handleAccountFilterChange}
                    className="filters-select filters-account-select responsive-filter-toolbar__field user-management-filter-toolbar__field--overflow"
                    options={[
                      {
                        label: um("filters.allAccounts"),
                        value: "",
                      },
                      ...userLinkedList,
                    ]}
                    allowClear
                  />
                  <CustomButton
                    variant="outline"
                    customClassName="responsive-filter-toolbar__button responsive-filter-toolbar__filter-button user-management-filter-toolbar__filter-button filter-trigger-with-count"
                    onClick={handleOpenFilterModal}
                  >
                    {String(t("common.filter"))}
                    <img
                      className="filter-trigger-funnel"
                      src={userManagementFilterIcon}
                      alt=""
                      aria-hidden="true"
                    />
                    <FilterCountBadge count={appliedFilterCount} />
                  </CustomButton>
                  <CustomButton
                    text={String(t("common.reset"))}
                    variant="outline"
                    customClassName="responsive-filter-toolbar__button responsive-filter-toolbar__reset-button user-management-filter-toolbar__reset-button"
                    onClick={handleResetFilters}
                  />
                </div>
                <div className="header-actions responsive-filter-toolbar__action">
                  {/* <CustomButton text="Export" variant="outline" /> */}
                  {!isDepartmentWithoutRole && !isDepartmentRoleUnresolved && (
                    <CustomButton
                      text={um("actions.addUser")}
                      variant="primary"
                      onClick={openAddUser}
                    />
                  )}
                </div>
              </div>
            </div>

            <ResponsiveFilterModal
              visible={filterModalVisible}
              onCancel={() => setFilterModalVisible(false)}
              onApply={handleApplyFilterModal}
              fields={[
                {
                  key: "role",
                  label: um("table.role"),
                  compactOnly: true,
                  element: (
                    <Select
                      placeholder={um("filters.allRoles")}
                      value={draftRoleFilter}
                      onChange={setDraftRoleFilter}
                      options={[
                        { label: um("filters.allRoles"), value: "" },
                        ...roleList,
                      ]}
                      allowClear
                    />
                  ),
                },
                {
                  key: "status",
                  label: um("table.status"),
                  element: (
                    <Select
                      placeholder={um("filters.allStatus")}
                      value={draftStatusFilter}
                      onChange={setDraftStatusFilter}
                      options={[
                        { label: um("filters.allStatus"), value: "" },
                        ...userStatusList,
                      ]}
                      allowClear
                    />
                  ),
                },
                {
                  key: "accounts",
                  label: um("table.linkedAccounts"),
                  element: (
                    <Select
                      placeholder={um("filters.allAccounts")}
                      value={draftAccountFilter}
                      onChange={setDraftAccountFilter}
                      options={[
                        { label: um("filters.allAccounts"), value: "" },
                        ...userLinkedList,
                      ]}
                      allowClear
                    />
                  ),
                },
              ]}
            />

            {/* {selectedRowKeys.length > 0 && (
              <div className="selection-tip">
                <span className="count">
                  {selectedRowKeys.length} tasks selected
                </span>
                <div className="tip-actions">
                  <CustomButton
                    text="Batch Unlock"
                    variant="outline"
                    size="medium"
                  />
                  <CustomButton
                    text="Batch Deactivate"
                    variant="outline"
                    size="medium"
                    onClick={() => setDeactivateVisible(true)}
                  />
                  <CustomButton
                    text="Change Department"
                    variant="outline"
                    size="medium"
                    onClick={() => {
                      setChangeDepartmentVisible(true);
                    }}
                  />
                  <CustomButton
                    text="Change Role"
                    variant="outline"
                    size="medium"
                    onClick={() => {
                      setChangeRoleVisible(true);
                    }}
                  />
                </div>
              </div>
            )} */}
            {isDepartmentRoleUnresolved ? (
              <div className="user-main-loading">
                <Spin />
              </div>
            ) : isDepartmentWithoutRole ? (
              <div className="department-no-role">
                <EmptyBox
                  title={um("empty.noRoles", {
                    defaultValue:
                      "No roles have been assigned to this department yet",
                  })}
                  buttonText={um("empty.addRole", { defaultValue: "Add Role" })}
                  hasButton
                  onClick={handleAddRole}
                  customClassName="department-no-role-empty"
                />
              </div>
            ) : (
              <TablePanel
                className="service-table admin-table user-table"
                tableProps={{
                  rowKey: (record: any) => record.userId || record.id,
                  columns,
                  dataSource: userList,
                  loading: userListLoading || departmentRoleLoading,
                  scroll: { x: userTableScrollX },
                  locale: {
                    emptyText: departmentRoleLoading ? (
                      <div className="user-table-empty-placeholder" />
                    ) : (
                      <EmptyBox
                        title={um("empty.noUsers", {
                          defaultValue: "No users yet",
                        })}
                        customClassName="user-table-empty"
                      />
                    ),
                  },
                  // rowSelection,
                  pagination: {
                    total: totalCount,
                    pageSize: pageSize,
                    current: currentPage,
                    showSizeChanger: true,
                    onChange: (page, pageSize) => {
                      setCurrentPage(page);
                      setPageSize(pageSize);
                    },
                    showTotal: (total) => (
                      <PaginationTotal
                        label={t("common.total")}
                        total={total}
                        current={currentPage}
                        pageSize={pageSize}
                      />
                    ),
                  },
                }}
              />
            )}
          </>
        ) : null}
      </div>
    </div>
  );
};

export default UserManagement;
