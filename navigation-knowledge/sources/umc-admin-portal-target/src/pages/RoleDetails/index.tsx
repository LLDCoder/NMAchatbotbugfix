import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Form, Input, Select } from "antd";
import {
  TablePanel,
  CustomButton,
  CustomFooter,
  ConfirmModal,
} from "@/components/common";
import type { ColumnsType } from "antd/es/table";
import type { TableRowSelection } from "antd/es/table/interface";
import { useHistory, useLocation } from "react-router-dom";
import {
  addRole,
  getRoleById,
  updateRole,
  type RolePayload,
  getSysPermissionList,
} from "@/services/role";
import { getDepartments, type DepartmentItem } from "@/services/department";
import "./index.less";
import { getTypeDictionaries } from "@/services/serviceApi";
import ExpandIcon from "@/assets/images/Tree-Switcher.svg";
import CollapseIcon from "@/assets/images/Tree-Switcher2.svg";
import { useTranslation } from "react-i18next";

interface PermissionItem {
  key: React.Key;
  name: string;
  api?: string;
  description?: string;
  permissionType?: string;
  children?: PermissionItem[];
}

interface TypeDictionaryItem {
  code: string;
  nameEn: string;
}

interface PermissionApiItem {
  id: React.Key | null;
  permissionNameEn?: string;
  apipath?: string;
  descriptionEn?: string;
  permissionType?: string;
  children?: PermissionApiItem[];
  buttonList?: PermissionApiItem[];
}

interface RoleFormValues {
  nameEn: string;
  nameAr: string;
  descEn: string;
  descAr: string;
  status: string;
  departmentId: string | number;
}

type RoleDetailData = Partial<RolePayload> & {
  userCount?: number;
  permissionsIds?: React.Key[];
};

interface PermissionTreeMeta {
  parentByKey: Map<React.Key, React.Key | null>;
  descendantsByKey: Map<React.Key, React.Key[]>;
}

interface PermissionSelectionState {
  halfCheckedKeys: React.Key[];
  fullyCheckedKeys: React.Key[];
}

const ROLE_NAME_MAX_LENGTH = 100;
const ROLE_NAME_EN_FILTER_PATTERN = /[^A-Za-z0-9 -]/g;
const ROLE_NAME_AR_FILTER_PATTERN =
  /[^\p{Script_Extensions=Arabic}\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF0-9\u0660-\u0669 ]/gu;

const normalizeRoleNameEn = (value: unknown) =>
  String(value ?? "")
    .replace(ROLE_NAME_EN_FILTER_PATTERN, "")
    .slice(0, ROLE_NAME_MAX_LENGTH);

const normalizeRoleNameAr = (value: unknown) =>
  String(value ?? "")
    .replace(ROLE_NAME_AR_FILTER_PATTERN, "")
    .slice(0, ROLE_NAME_MAX_LENGTH)
    .replace(/[\uD800-\uDBFF]$/u, "");

const isValidPermissionKey = (
  key: React.Key | null | undefined,
): key is React.Key => key !== null && key !== undefined && key !== "";

const toPermissionKeySet = (keys?: React.Key[] | null) =>
  new Set((keys || []).filter(isValidPermissionKey));

const normalizePermissionKeys = (keys?: React.Key[] | null): React.Key[] =>
  Array.from(toPermissionKeySet(keys));

const arePermissionKeysEqual = (first: React.Key[], second: React.Key[]) => {
  const normalize = (keys: React.Key[]) =>
    Array.from(new Set(keys.filter(isValidPermissionKey).map(String))).sort();
  const firstKeys = normalize(first);
  const secondKeys = normalize(second);

  if (firstKeys.length !== secondKeys.length) {
    return false;
  }

  return firstKeys.every((key, index) => key === secondKeys[index]);
};

const buildPermissionTreeMeta = (tree: PermissionItem[]): PermissionTreeMeta => {
  const parentByKey = new Map<React.Key, React.Key | null>();
  const descendantsByKey = new Map<React.Key, React.Key[]>();

  const visitNode = (
    node: PermissionItem,
    parentKey: React.Key | null,
  ): React.Key[] => {
    if (!isValidPermissionKey(node.key)) {
      return [];
    }

    parentByKey.set(node.key, parentKey);

    const descendants: React.Key[] = [];
    (node.children || []).forEach((child) => {
      const childKeys = visitNode(child, node.key);
      if (isValidPermissionKey(child.key)) {
        descendants.push(child.key);
      }
      descendants.push(...childKeys);
    });

    descendantsByKey.set(node.key, descendants);
    return descendants;
  };

  tree.forEach((node) => {
    visitNode(node, null);
  });

  return {
    parentByKey,
    descendantsByKey,
  };
};

const getPermissionAncestors = (
  key: React.Key,
  meta: PermissionTreeMeta,
): React.Key[] => {
  const ancestors: React.Key[] = [];
  let current = meta.parentByKey.get(key) ?? null;

  while (current !== null) {
    ancestors.push(current);
    current = meta.parentByKey.get(current) ?? null;
  }

  return ancestors;
};

const applyPermissionSelectionChange = (
  currentKeys: React.Key[],
  toggledKey: React.Key,
  selected: boolean,
  descendantsByKey: Map<React.Key, React.Key[]>,
): React.Key[] => {
  const nextKeySet = toPermissionKeySet(currentKeys);
  const relatedKeys = [toggledKey, ...(descendantsByKey.get(toggledKey) || [])];

  relatedKeys.forEach((key) => {
    if (selected) {
      nextKeySet.add(key);
    } else {
      nextKeySet.delete(key);
    }
  });

  return Array.from(nextKeySet);
};

const collectPermissionSelectionState = (
  tree: PermissionItem[],
  selectedKeys: React.Key[],
): PermissionSelectionState => {
  const selectedKeySet = toPermissionKeySet(selectedKeys);
  const halfCheckedKeySet = new Set<React.Key>();
  const fullyCheckedKeySet = new Set<React.Key>();

  const visitNode = (
    node: PermissionItem,
  ): { anySelected: boolean; allSelected: boolean } => {
    const childStates = (node.children || []).map((child) => visitNode(child));
    const hasChildren = childStates.length > 0;
    const anyChildSelected = childStates.some((state) => state.anySelected);
    const allChildrenSelected =
      hasChildren && childStates.every((state) => state.allSelected);
    const isSelected =
      isValidPermissionKey(node.key) && selectedKeySet.has(node.key);
    const anySelected = isSelected || anyChildSelected;
    const allSelected = hasChildren ? allChildrenSelected : isSelected;

    if (isValidPermissionKey(node.key)) {
      if (hasChildren && anySelected && !allChildrenSelected) {
        halfCheckedKeySet.add(node.key);
      } else if (allSelected) {
        fullyCheckedKeySet.add(node.key);
      }
    }

    return {
      anySelected,
      allSelected,
    };
  };

  tree.forEach((node) => {
    visitNode(node);
  });

  return {
    halfCheckedKeys: Array.from(halfCheckedKeySet),
    fullyCheckedKeys: Array.from(fullyCheckedKeySet),
  };
};

const getPermissionIdsForSubmit = (
  selectedKeys: React.Key[],
  meta: PermissionTreeMeta,
): React.Key[] => {
  const result = new Set<React.Key>();

  selectedKeys.filter(isValidPermissionKey).forEach((key) => {
    result.add(key);
    getPermissionAncestors(key, meta).forEach((ancestorKey) => {
      result.add(ancestorKey);
    });
  });

  return Array.from(result);
};

const mapPermissionTree = (items: PermissionApiItem[]): PermissionItem[] => {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.map((item) => {
    const children =
      item.children && item.children.length
        ? mapPermissionTree(item.children)
        : [];
    const buttonList =
      item.buttonList && item.buttonList.length
        ? mapPermissionTree(item.buttonList)
        : [];

    return {
      key: item.id as React.Key,
      name: item.permissionNameEn || "-",
      api: item.apipath,
      description: item.descriptionEn,
      permissionType: item.permissionType,
      children: [...children, ...buttonList],
    };
  });
};

const RoleDetails: React.FC = () => {
  const { t } = useTranslation();
  const rd = useCallback(
    (key: string, opts?: Record<string, unknown>) =>
      opts != null
        ? String(t(`Settings.roleDetails.${key}`, opts))
        : String(t(`Settings.roleDetails.${key}`)),
    [t],
  );
  const [form] = Form.useForm();
  const history = useHistory();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const roleId = searchParams.get("id");

  const [explicitSelectedKeys, setExplicitSelectedKeys] = useState<React.Key[]>(
    [],
  );
  const [saving, setSaving] = useState(false);

  const [leaveVisible, setLeaveVisible] = useState(false);
  const [roleDetail, setRoleDetail] = useState<RoleDetailData | null>(null);
  const [departmentOptions, setDepartmentOptions] = useState<
    { label: string; value: number }[]
  >([]);
  const [statusList, setStatusList] = useState<
    { label: string; value: string }[]
  >([]);
  const [tableData, setTableData] = useState<PermissionItem[]>([]);
  const [initialFormValuesRef, setInitialFormValues] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [initialSubmitPermissionIds, setInitialSubmitPermissionIds] = useState<
    React.Key[]
  >([]);

  const columns: ColumnsType<PermissionItem> = useMemo(
    () => [
      {
        title: rd("permissionsTable.permissionName"),
        dataIndex: "name",
        key: "name",
      },
      {
        title: rd("permissionsTable.permissionType"),
        dataIndex: "permissionType",
        key: "permissionType",
        render: (value: string) => {
          const typeMap: Record<string, string> = {
            M: rd("permissionsTable.permissionTypeM"),
            B: rd("permissionsTable.permissionTypeB"),
            A: rd("permissionsTable.permissionTypeA"),
          };

          return typeMap[value] || value || "-";
        },
      },
      {
        title: rd("permissionsTable.description"),
        dataIndex: "description",
        key: "description",
        ellipsis: true,
        render: (value: string | undefined, record: PermissionItem) =>
          record.permissionType === "B" ? null : value || "-",
      },
    ],
    [rd],
  );

  const permissionTreeMeta = useMemo(
    () => buildPermissionTreeMeta(tableData),
    [tableData],
  );

  const permissionSelectionState = useMemo(
    () => collectPermissionSelectionState(tableData, explicitSelectedKeys),
    [explicitSelectedKeys, tableData],
  );
  const { halfCheckedKeys } = permissionSelectionState;
  const displaySelectedRowKeys = useMemo(() => {
    const halfCheckedKeySet = toPermissionKeySet(halfCheckedKeys);
    const displayKeySet = toPermissionKeySet([
      ...explicitSelectedKeys,
      ...permissionSelectionState.fullyCheckedKeys,
    ]);

    halfCheckedKeySet.forEach((key) => {
      displayKeySet.delete(key);
    });

    return Array.from(displayKeySet);
  }, [explicitSelectedKeys, halfCheckedKeys, permissionSelectionState]);

  const rowSelection = useMemo<TableRowSelection<PermissionItem>>(
    () => ({
      selectedRowKeys: displaySelectedRowKeys,
      onChange: (
        keys: React.Key[],
        _selectedRows: PermissionItem[],
        info: { type: "all" | "none" | "invert" | "single" | "multiple" },
      ) => {
        if (info.type !== "single") {
          setExplicitSelectedKeys(normalizePermissionKeys(keys));
        }
      },
      onSelect: (record: PermissionItem, selected: boolean) => {
        if (!isValidPermissionKey(record.key)) return;
        setExplicitSelectedKeys((currentKeys) =>
          applyPermissionSelectionChange(
            currentKeys,
            record.key,
            selected,
            permissionTreeMeta.descendantsByKey,
          ),
        );
      },
      checkStrictly: true,
      renderCell: (
        _checked: boolean,
        record: PermissionItem,
        _index: number,
        originNode: React.ReactNode,
      ) => {
        if (
          !isValidPermissionKey(record.key) ||
          !halfCheckedKeys.includes(record.key) ||
          !React.isValidElement(originNode)
        ) {
          return originNode;
        }

        return React.cloneElement(
          originNode as React.ReactElement<{ indeterminate?: boolean }>,
          {
            indeterminate: true,
          },
        );
      },
    }),
    [
      displaySelectedRowKeys,
      halfCheckedKeys,
      permissionTreeMeta.descendantsByKey,
    ],
  );

  const loadStatus = useCallback(async () => {
    getTypeDictionaries("RoleStatus")
      .then((res) => {
        const list = (res as { data?: TypeDictionaryItem[] }).data || [];
        setStatusList(
          list.map((item) => ({
            label: item.nameEn,
            value: item.code,
          })),
        );
        if (list.length > 0) {
          form.setFieldsValue({ status: list?.[0]?.code });
        }
      })
      .catch((error) => {
        console.error("failed", error);
      });
  }, [form]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handleBack = () => {
    history.go(-1);
  };
  const handleSubmit = async () => {
    try {
      const values = (await form.validateFields()) as RoleFormValues;
      setSaving(true);

      const basePayload: RolePayload = {
        id: roleId || "",
        name: values.nameEn,
        discriminator: "Role",
        isShown: true,
        nameEn: values.nameEn,
        nameAr: values.nameAr,
        descEn: values.descEn,
        descAr: values.descAr,
        status: values.status,
        departmentId: Number(values.departmentId),
        permissionsIds: getPermissionIdsForSubmit(
          explicitSelectedKeys,
          permissionTreeMeta,
        ) as (string | number)[],
      };
      if (roleId) {
        await updateRole(basePayload);
      } else {
        await addRole(basePayload);
      }

      history.goBack();
    } catch (error) {
      console.error("Save role failed", error);
    } finally {
      setSaving(false);
    }
  };

  const pageHeading = roleId ? rd("pageTitle.edit") : rd("pageTitle.add");

  const loadDepartments = useCallback(async () => {
    try {
      const res = await getDepartments();
      const response = res as {
        data?: { items?: DepartmentItem[] } | DepartmentItem[];
      };
      const list = Array.isArray(response.data)
        ? response.data
        : response.data?.items || [];
      setDepartmentOptions(
        list.map((item) => ({
          label: item.nameEn,
          value: item.id,
        })),
      );
    } catch (error) {
      console.error("Load departments failed", error);
    }
  }, []);

  const loadRoleDetail = useCallback(async (
    id: string,
    permissionTree: PermissionItem[],
  ) => {
    try {
      const res = await getRoleById(id);
      const data = (res as { data?: RoleDetailData }).data;
      if (!data) return;

      form.setFieldsValue({
        nameEn: data.nameEn,
        nameAr: data.nameAr,
        departmentId: data.departmentId,
        descEn: data.descEn,
        descAr: data.descAr,
        status: data.status,
      });
      setRoleDetail(data);
      const initialSelectedPermissionIds = normalizePermissionKeys(
        data.permissionsIds || [],
      );
      const permissionMeta = buildPermissionTreeMeta(permissionTree);
      setExplicitSelectedKeys(initialSelectedPermissionIds);
      setInitialFormValues(form.getFieldsValue());
      setInitialSubmitPermissionIds(
        getPermissionIdsForSubmit(initialSelectedPermissionIds, permissionMeta),
      );
    } catch (error) {
      console.error("Load role detail failed", error);
    }
  }, [form]);

  const loadPermissions = useCallback(async (): Promise<PermissionItem[]> => {
    try {
      const res = await getSysPermissionList();
      const data = (res as { data?: PermissionApiItem[] }).data || [];
      const mapped = mapPermissionTree(data);
      setTableData(mapped);
      return mapped;
    } catch (error) {
      console.error("Load permissions failed", error);
      setTableData([]);
      return [];
    }
  }, []);

  useEffect(() => {
    loadDepartments();
    loadPermissions().then((permissionTree) => {
      if (roleId) {
        loadRoleDetail(roleId, permissionTree);
      }
    });
  }, [loadDepartments, loadPermissions, loadRoleDetail, roleId]);

  const requiredRule = { required: true, message: rd("validation.required") };

  return (
    <div className="role-details-page">
      <div className="role-details-content">
        <div className="role-details-header">
          <h1 className="role-details-title">{pageHeading}</h1>
        </div>
        <div className="role-details-form-section">
          <Form
            form={form}
            layout="vertical"
            className="role-details-form custorm-form"
          >
            <div className="role-details-form-row">
              <Form.Item
                name="nameEn"
                label={rd("labels.nameEn")}
                normalize={normalizeRoleNameEn}
                rules={[
                  requiredRule,
                  {
                    pattern: /^[A-Za-z0-9 -]+$/,
                    message: rd("validation.roleNameFormat"),
                  },
                ]}
              >
                <Input
                  placeholder={rd("placeholders.enter")}
                  maxLength={ROLE_NAME_MAX_LENGTH}
                />
              </Form.Item>
              <Form.Item
                name="nameAr"
                label={rd("labels.nameAr")}
                normalize={normalizeRoleNameAr}
                rules={[requiredRule]}
              >
                <Input
                  placeholder={rd("placeholders.enterAr")}
                  maxLength={ROLE_NAME_MAX_LENGTH}
                  style={{ direction: "rtl" }}
                />
              </Form.Item>
              <Form.Item
                name="departmentId"
                label={rd("labels.departmentId")}
                // rules={[requiredRule]}
              >
                <Select
                  placeholder={rd("placeholders.selectDepartment")}
                  dropdownClassName="role-details__department-dropdown"
                  options={departmentOptions}
                  disabled={Boolean(
                    roleDetail?.userCount && roleDetail.userCount > 0,
                  )}
                />
              </Form.Item>
            </div>

            <div className="role-details-form-row">
              <Form.Item
                name="descEn"
                label={rd("labels.descEn")}
                rules={[requiredRule]}
              >
                <Input placeholder={rd("placeholders.enter")} />
              </Form.Item>
              <Form.Item
                name="descAr"
                label={rd("labels.descAr")}
                rules={[requiredRule]}
              >
                <Input
                  placeholder={rd("placeholders.enterAr")}
                  style={{ direction: "rtl" }}
                />
              </Form.Item>
              <Form.Item label={rd("labels.status")} name="status">
                <Select
                  dropdownClassName="role-details__status-dropdown"
                  options={statusList}
                />
              </Form.Item>
            </div>
          </Form>
        </div>

        <div className="role-details-permissions">
          <TablePanel
            className="role-permissions-table"
            tableProps={{
              rowKey: "key",
              columns,
              dataSource: tableData,
              pagination: false,
              rowSelection,
              expandable: {
                expandIcon: ({ expanded, onExpand, record }) => {
                  if (!record.children || !record.children.length) {
                    return null;
                  } else {
                    return expanded ? (
                      <img
                        src={ExpandIcon}
                        alt=""
                        className="role-permissions-table-expandIcon"
                        onClick={(e) => onExpand(record, e)}
                      />
                    ) : (
                      <img
                        src={CollapseIcon}
                        alt=""
                        className="role-permissions-table-expandIcon"
                        onClick={(e) => onExpand(record, e)}
                      />
                    );
                  }
                },
              },
            }}
          />
        </div>
      </div>

      <CustomFooter
        onBack={() => {
          const currentValues = form.getFieldsValue();
          const initialValues = initialFormValuesRef;
          const formChanged =
            initialValues &&
            JSON.stringify(currentValues) !== JSON.stringify(initialValues);

          const permissionsChanged = !arePermissionKeysEqual(
            getPermissionIdsForSubmit(explicitSelectedKeys, permissionTreeMeta),
            initialSubmitPermissionIds,
          );

          if (formChanged || permissionsChanged) {
            setLeaveVisible(true);
          } else {
            handleBack();
          }
        }}
        rightContent={
          <CustomButton
            text={rd("buttons.save")}
            variant="primary"
            onClick={handleSubmit}
            loading={saving}
          />
        }
      />

      <ConfirmModal
        visible={leaveVisible}
        type="danger"
        title={rd("confirm.unsavedLeave.title")}
        content={rd("confirm.unsavedLeave.content")}
        cancelText={rd("buttons.cancel")}
        confirmText={rd("buttons.leave")}
        onCancel={() => setLeaveVisible(false)}
        onConfirm={handleBack}
      />
    </div>
  );
};

export default RoleDetails;
