import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Input, Select } from "antd";
import SortIcon from "@/assets/images/sort.png";
import FilterCountBadge, {
  countAppliedFilters,
} from "@/components/common/FilterCountBadge";
import Sousuo from "@/assets/icons/Sousuo";
import {
  TablePanel,
  CustomButton,
  ConfirmModal,
  ResponsiveFilterModal,
} from "@/components/common";
import { useHistory } from "react-router-dom";
import EmptyBox from "@/components/common/EmptyBox/EmptyBox";
import type { ColumnsType } from "antd/es/table";
import { getRoleList, deleteRole } from "@/services/role";
import "./index.less";
import CustomStatusTag from "@/components/common/CustomStatusTag";
import { getTypeDictionaries } from "@/services/serviceApi";
import { debounce } from "lodash";
import { useTranslation } from "react-i18next";
import useKeepAliveActivated from "@/components/KeepAlive/useKeepAliveActivated";
import {
  type ResponsiveActionColumnButtonWidthMap,
  useResponsiveActionColumnWidth,
} from "@/hooks/useResponsiveActionColumnWidth";

interface RoleRecord {
  key: string;
  roleName: string;
  associatedDepartment: string;
  description: string;
  status: "Active" | "Disabled";
  hasUsers: boolean;
  id: string;
}

type RoleManagementActionColumnKey = "edit" | "delete";

const ROLE_MANAGEMENT_ACTION_BUTTON_WIDTH_MAP: ResponsiveActionColumnButtonWidthMap<RoleManagementActionColumnKey> =
  {
    edit: {
      default: 30,
      compact: 26,
    },
    delete: {
      default: 50,
      compact: 43,
    },
  };
const ROLE_MANAGEMENT_ACTION_COLUMN_DESKTOP_CONFIG = {
  gap: 16,
  padding: 32,
  minWidth: 128,
  maxWidth: 160,
};
const ROLE_MANAGEMENT_ACTION_COLUMN_COMPACT_CONFIG = {
  gap: 12,
  padding: 32,
  minWidth: 116,
  maxWidth: 148,
};
const ROLE_MANAGEMENT_ACTION_COLUMN_TEXT_MEASURE_CONFIG = {
  font: "500 16px Inter, sans-serif",
  narrowFont: "500 14px Inter, sans-serif",
  textPadding: 0,
};

const RoleManagement: React.FC = () => {
  const { t } = useTranslation();
  const rm = useCallback(
    (key: string, opts?: Record<string, unknown>) =>
      t(`Settings.roleManagement.${key}`, opts as object),
    [t],
  );
  const history = useHistory();
  const [keyword, setKeyword] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | undefined>(
    undefined,
  );
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [draftStatusFilter, setDraftStatusFilter] = useState<
    string | undefined
  >(undefined);
  const [initRoles, setInitRoles] = useState<RoleRecord[]>([]);
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [statusList, setStatusList] = useState<any[]>([]);

  const [deleteRoleVisible, setDeleteRoleVisible] = useState(false);
  const [deleteFailedVisible, setDeleteFailedVisible] = useState(false);
  const [currentRole, setCurrentRole] = useState<RoleRecord | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const latestRequestIdRef = useRef(0);

  const debouncedSearch = useCallback(
    debounce((value: string) => {
      setSearchKeyword(value);
    }, 500),
    [],
  );
  const getRoleQueryParams = () => ({
    pageIndex: 1,
    pageSize: 100,
    keyWord: searchKeyword || undefined,
    status: statusFilter || undefined,
  });
  const loadRoles = (params?: any) => {
    const requestId = latestRequestIdRef.current + 1;
    latestRequestIdRef.current = requestId;
    setRolesLoading(true);
    getRoleList(params)
      .then((res) => {
        if (requestId !== latestRequestIdRef.current) return;
        const list = (res as any).data?.items || (res as any).data || [];
        setRoles(list);
        if (!params) {
          setInitRoles(list);
        }
      })
      .catch((error) => {
        if (requestId !== latestRequestIdRef.current) return;
        console.error("Load roles failed", error);
      })
      .finally(() => {
        if (requestId === latestRequestIdRef.current) {
          setRolesLoading(false);
        }
      });
  };
  useKeepAliveActivated({
    onActivated: () => {
      loadRoles(getRoleQueryParams());
    },
    onDeactivated: () => {
      latestRequestIdRef.current += 1;
      setRolesLoading(false);
      setDeleteRoleVisible(false);
      setDeleteFailedVisible(false);
      setCurrentRole(null);
      setDeleteLoading(false);
    },
  });
  useEffect(() => {
    loadRoles(getRoleQueryParams());
  }, [searchKeyword, statusFilter]);

  useEffect(() => {
    loadStatus();
  }, []);
  const loadStatus = async () => {
    getTypeDictionaries("RoleStatus")
      .then((res) => {
        const list = (res as any).data;
        setStatusList(
          list.map((item: any) => ({
            label: item.nameEn,
            value: item.code,
          })),
        );
      })
      .catch((error) => {
        console.error("failed", error);
      });
  };
  const handleAddRole = () => {
    history.push("/system-management/roleManagement/roledetails");
  };

  // The filter modal edits status only.
  const appliedFilterCount = countAppliedFilters([statusFilter]);

  const handleOpenFilterModal = () => {
    setDraftStatusFilter(statusFilter);
    setFilterModalVisible(true);
  };

  const handleApplyFilterModal = () => {
    setStatusFilter(draftStatusFilter);
    setFilterModalVisible(false);
  };

  const handleResetFilters = () => {
    debouncedSearch.cancel();
    setKeyword("");
    setSearchKeyword("");
    setStatusFilter(undefined);
    setDraftStatusFilter(undefined);
  };

  const handleEditRole = useCallback((record: RoleRecord) => {
    history.push(
      `/system-management/roleManagement/roledetails?id=${record.id}`,
    );
  }, [history]);

  const handleRequestDelete = useCallback((record: RoleRecord) => {
    if (record.hasUsers) {
      setDeleteFailedVisible(true);
    } else {
      setCurrentRole(record);
      setDeleteRoleVisible(true);
    }
  }, []);

  const handleConfirmDelete = async () => {
    if (!currentRole?.id) {
      setDeleteRoleVisible(false);
      setCurrentRole(null);
      return;
    }
    setDeleteLoading(true);
    try {
      await deleteRole(currentRole.id);
      loadRoles(getRoleQueryParams());
    } catch (error) {
      console.error("Delete role failed", error);
    } finally {
      setDeleteLoading(false);
      setDeleteRoleVisible(false);
      setCurrentRole(null);
    }
  };

  const roleActionColumnWidth = useResponsiveActionColumnWidth<
    RoleRecord,
    RoleManagementActionColumnKey
  >({
    rows: roles,
    buttonWidthMap: ROLE_MANAGEMENT_ACTION_BUTTON_WIDTH_MAP,
    getVisibleActions: () => ["edit", "delete"],
    getActionLabel: (actionKey) => {
      switch (actionKey) {
        case "edit":
          return String(rm("actions.edit"));
        case "delete":
          return String(rm("actions.delete"));
        default:
          return undefined;
      }
    },
    desktopConfig: ROLE_MANAGEMENT_ACTION_COLUMN_DESKTOP_CONFIG,
    compactConfig: ROLE_MANAGEMENT_ACTION_COLUMN_COMPACT_CONFIG,
    textMeasureConfig: ROLE_MANAGEMENT_ACTION_COLUMN_TEXT_MEASURE_CONFIG,
  });

  const columns: ColumnsType<RoleRecord> = useMemo(
    () => [
      {
        title: rm("table.role"),
        dataIndex: "nameEn",
        key: "nameEn",
      },
      {
        title: rm("table.associatedDepartment"),
        dataIndex: "departmentInfo",
        key: "departmentInfo",
        render: (value: any) => <span>{value?.name}</span>,
      },
      {
        title: rm("table.description"),
        dataIndex: "descEn",
        key: "descEn",
        ellipsis: true,
      },
      {
        title: rm("table.status"),
        dataIndex: "status",
        key: "status",
        render: (text: any) => (
          <CustomStatusTag type="roleManagement" status={Number(text)} />
        ),
      },
      {
        title: rm("table.actions"),
        key: "actions",
        // Design: keep actions reachable while the table scrolls sideways.
        fixed: "right" as const,
        width: roleActionColumnWidth,
        render: (_, record) => {
          return (
            <div className="role-actions">
              <span
                className="action-link"
                onClick={() => handleEditRole(record)}
              >
                {rm("actions.edit")}
              </span>
              <span
                className="action-link"
                onClick={() => handleRequestDelete(record)}
              >
                {rm("actions.delete")}
              </span>
            </div>
          );
        },
      },
    ],
    [handleEditRole, handleRequestDelete, rm, roleActionColumnWidth],
  );

  return (
    <div className="role-management">
      <div className="header responsive-filter-toolbar">
        <div className="filters responsive-filter-toolbar__controls">
          <Input
            placeholder={rm("filters.searchPlaceholder")}
            prefix={<Sousuo className="search-icon" />}
            value={keyword}
            allowClear
            onChange={(e) => {
              setKeyword(e.target.value);
              debouncedSearch(e.target.value);
            }}
            className="search-input responsive-filter-toolbar__field responsive-filter-toolbar__field--search role-management-filter-toolbar__search"
          />
          <Select
            placeholder={rm("filters.allStatus")}
            value={statusFilter}
            onChange={setStatusFilter}
            className="status-select responsive-filter-toolbar__field role-management-filter-toolbar__field--secondary"
            options={[{ label: rm("filters.allStatus"), value: "" }, ...statusList]}
            allowClear
          />
          <CustomButton
            variant="outline"
            customClassName="responsive-filter-toolbar__button responsive-filter-toolbar__filter-button role-management-filter-toolbar__filter-button filter-trigger-with-count"
            onClick={handleOpenFilterModal}
          >
            {String(t("common.filter"))}
            <img className="filter-trigger-funnel" src={SortIcon} alt="" />
            <FilterCountBadge count={appliedFilterCount} />
          </CustomButton>
          <CustomButton
            text={String(t("common.reset"))}
            variant="outline"
            customClassName="responsive-filter-toolbar__button responsive-filter-toolbar__reset-button role-management-filter-toolbar__reset-button"
            onClick={handleResetFilters}
          />
        </div>
        {initRoles && (
          <CustomButton
            text={rm("actions.addRole")}
            variant="primary"
            customClassName="responsive-filter-toolbar__action"
            onClick={handleAddRole}
          />
        )}
      </div>

      <ResponsiveFilterModal
        visible={filterModalVisible}
        onCancel={() => setFilterModalVisible(false)}
        onApply={handleApplyFilterModal}
        fields={[
          {
            key: "status",
            label: rm("table.status"),
            element: (
              <Select
                placeholder={rm("filters.allStatus")}
                value={draftStatusFilter}
                onChange={setDraftStatusFilter}
                options={[
                  { label: rm("filters.allStatus"), value: "" },
                  ...statusList,
                ]}
                allowClear
              />
            ),
          },
        ]}
      />

      {roles.length > 0 ? (
        <TablePanel
          className="role-table"
          tableProps={{
            rowKey: "id",
            columns,
            dataSource: roles,
            loading: rolesLoading,
            pagination: false,
          }}
        />
      ) : (
        <div className="role-empty-wrapper">
          {initRoles ? (
            <EmptyBox title={rm("empty.noData")} onClick={handleAddRole} />
          ) : (
            <EmptyBox
              title={rm("empty.noData")}
              buttonText={rm("actions.addRole")}
              hasButton
              onClick={handleAddRole}
            />
          )}
        </div>
      )}

      <ConfirmModal
        visible={deleteRoleVisible}
        type="danger"
        title={rm("confirm.deleteRole.title")}
        content={rm("confirm.deleteRole.content")}
        cancelText={rm("buttons.cancel")}
        confirmText={rm("buttons.delete")}
        onCancel={() => setDeleteRoleVisible(false)}
        onConfirm={handleConfirmDelete}
        loading={deleteLoading}
      />

      <ConfirmModal
        visible={deleteFailedVisible}
        type="danger"
        title={rm("confirm.deleteFailed.title")}
        content={rm("confirm.deleteFailed.content")}
        cancelText=""
        confirmText={rm("buttons.close")}
        onCancel={() => setDeleteFailedVisible(false)}
        onConfirm={() => setDeleteFailedVisible(false)}
      />
    </div>
  );
};

export default RoleManagement;
