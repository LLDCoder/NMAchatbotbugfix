import { useEffect, useMemo, useState } from "react";
import type { SelectOption } from "@/components/common";
import { getUserTypes, type TypeDictionary } from "@/services/messageTemplate";
import { getDepartments, type DepartmentItem } from "@/services/department";
import { BROADCAST_PORTAL } from "./constants";

export const useBroadcastRecipientOptions = (
  portal: string,
  language: string,
) => {
  const [userTypesOptions, setUserTypesOptions] = useState<TypeDictionary[]>([]);
  const [departmentOptions, setDepartmentOptions] = useState<DepartmentItem[]>([]);

  useEffect(() => {
    const loadOptions = async () => {
      try {
        const [userTypesResult, departmentsResult] = await Promise.allSettled([
          getUserTypes(),
          getDepartments(),
        ]);

        if (userTypesResult.status === "rejected") {
          console.error("Failed to fetch user types", userTypesResult.reason);
        }
        if (departmentsResult.status === "rejected") {
          console.error("Failed to fetch departments", departmentsResult.reason);
        }

        const userTypesResponse =
          userTypesResult.status === "fulfilled" ? userTypesResult.value : null;
        const departmentsResponse =
          departmentsResult.status === "fulfilled" ? departmentsResult.value : null;

        const userTypesEnvelope = userTypesResponse as unknown as {
          data?: TypeDictionary[];
        };
        const departmentEnvelope = departmentsResponse as unknown as {
          items?: DepartmentItem[];
          data?: { items?: DepartmentItem[] };
        };

        const userTypes = Array.isArray(userTypesResponse)
          ? userTypesResponse
          : userTypesEnvelope?.data || [];
        const departments =
          departmentEnvelope?.items || departmentEnvelope?.data?.items || [];

        setUserTypesOptions(userTypes.filter((item) => item.isShown));
        setDepartmentOptions(departments);
      } catch (error) {
        console.error("Failed to fetch broadcast recipient options", error);
        setUserTypesOptions([]);
        setDepartmentOptions([]);
      }
    };

    loadOptions();
  }, []);

  const recipientOptions = useMemo<SelectOption[]>(() => {
    const isArabic = language.toLowerCase().startsWith("ar");

    if (portal === BROADCAST_PORTAL.Customer) {
      return userTypesOptions.map((item) => ({
        label: isArabic
          ? item.nameAr || item.nameEn || item.code
          : item.nameEn || item.nameAr || item.code,
        value: item.code,
      }));
    }

    return departmentOptions.map((item) => ({
      label: isArabic
        ? item.nameAr || item.nameEn || String(item.id)
        : item.nameEn || item.nameAr || String(item.id),
      value: String(item.id),
    }));
  }, [departmentOptions, language, portal, userTypesOptions]);

  return {
    recipientOptions,
    userTypesOptions,
    departmentOptions,
  };
};
