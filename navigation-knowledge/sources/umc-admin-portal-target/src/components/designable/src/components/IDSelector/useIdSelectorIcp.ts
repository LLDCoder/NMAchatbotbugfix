import { useCallback, useEffect, useRef, useState } from "react";
import type { NationalityInfo } from "@/services/userProfile";
import { getNationalityList, getPassportInfo, getEmiratesIdInfo  } from "@/services/userProfile";
import {
  type IDSelectorValue,
  type IdSelectorType,
  type LookupStateMap,
  type NationalityOption,
  QUERY_FIELD_BY_TYPE,
  INITIAL_LOOKUP_STATE_MAP,
  getErrorMessage,
  getQuerySignature,
  getQueryValidationErrors,
  isLookupFresh,
  mergeIcpProfileIntoValue,
} from "./idSelectorUtils";
import { useIDSelectorLabels } from "./useIdSelectorLabels";

interface QueryableSubField {
  setFeedback: (feedback: { type: string; code?: string; messages: string[] }) => void;
}

interface QueryableField {
  value?: unknown;
  address: string;
  setValue: (value: IDSelectorValue) => void;
  query: (pattern: string) => { take: () => QueryableSubField | undefined };
}

interface UseIdSelectorIcpParams {
  field: QueryableField;
  current: IDSelectorValue;
  currentType: IdSelectorType;
  onIcpLoadedChange?: (loaded: boolean) => void;
}

const ERROR_MESSAGE_BY_TYPE = {
  emiratesId: "valLoadFailedEmiratesId",
  uid: "valLoadFailedUid",
  passport: "valLoadFailedPassport",
} as const;

export const useIdSelectorIcp = ({
  field,
  current,
  currentType,
  onIcpLoadedChange,
}: UseIdSelectorIcpParams) => {
  const labels = useIDSelectorLabels();
  const [nationalityList, setNationalityList] = useState<NationalityInfo[]>([]);
  const [lookupStateMap, setLookupStateMap] =
    useState<LookupStateMap>(INITIAL_LOOKUP_STATE_MAP);
  const nationalityListRef = useRef<NationalityInfo[]>([]);
  const controllerRef = useRef<Partial<Record<IdSelectorType, AbortController>>>({});

  const setFieldError = useCallback(
    (fieldName: keyof IDSelectorValue, message: string) => {
      const subField = field.query(`${field.address}.${fieldName}`).take();
      if (!subField) return;
      subField.setFeedback({
        type: "error",
        code: "icp_error",
        messages: message ? [message] : [],
      });
    },
    [field],
  );

  const setLookupState = useCallback(
    (type: IdSelectorType, nextState: LookupStateMap[IdSelectorType]) => {
      setLookupStateMap((prev) => ({
        ...prev,
        [type]: nextState,
      }));
    },
    [],
  );

  useEffect(() => {
    const loadNationalityList = async () => {
      try {
        const response = await getNationalityList();
        if (response.data) {
          setNationalityList(response.data);
        }
      } catch (error) {
        console.error("Failed to load nationality list:", error);
      }
    };

    loadNationalityList();
  }, []);

  useEffect(() => {
    nationalityListRef.current = nationalityList;
  }, [nationalityList]);

  useEffect(() => {
    if (!current.nationality || nationalityList.length === 0) {
      return;
    }

    const hasMatchedId = nationalityList.some(
      (nationality) => nationality.id === current.nationality,
    );
    if (hasMatchedId) {
      return;
    }

    const mappedNationalityId = nationalityList.find(
      (nationality) =>
        String(nationality.numericCode) === String(current.nationality),
    )?.id;

    if (!mappedNationalityId) {
      return;
    }

    field.setValue({
      ...(field.value as IDSelectorValue),
      nationality: mappedNationalityId,
    });
  }, [current.nationality, field, nationalityList]);

  useEffect(() => {
    return () => {
      Object.values(controllerRef.current).forEach((controller) => {
        controller?.abort();
      });
    };
  }, []);

  const triggerQuery = useCallback(
    async (type: IdSelectorType) => {
      const signature = getQuerySignature(type, current);
      const queryFieldName = QUERY_FIELD_BY_TYPE[type];
      const fallbackMessage = labels[ERROR_MESSAGE_BY_TYPE[type]];

      setFieldError("dateOfBirth", "");
      setFieldError(queryFieldName, "");

      const validationErrors = getQueryValidationErrors(type, current, labels);
      if (Object.keys(validationErrors).length > 0) {
        Object.entries(validationErrors).forEach(([fieldName, message]) => {
          if (message) {
            setFieldError(fieldName as keyof IDSelectorValue, message);
          }
        });
        setLookupState(type, {
          status: "error",
          signature,
          message: validationErrors[queryFieldName],
        });
        return false;
      }

      controllerRef.current[type]?.abort();
      const controller = new AbortController();
      controllerRef.current[type] = controller;

      setLookupState(type, { status: "loading", signature });

      try {
        const requestConfig = {
          signal: controller.signal,
          skipErrorToast: true,
          customErrorMessage: true,
        };

        let response:
          | { data?: { personProfile?: unknown } }
          | undefined;

        if (type === "passport") {
          response = (await getPassportInfo(
            String(current.passportNumber || "").trim(),
            String(current.dateOfBirth || ""),
            requestConfig,
          )) as { data?: { personProfile?: unknown } };
        } else {
          const identifier =
            type === "emiratesId"
              ? String(current.emiratesId || "").replace(/\D/g, "")
              : String(current.uid || "").replace(/\D/g, "");

          response = (await getEmiratesIdInfo(
            identifier,
            String(current.dateOfBirth || ""),
            requestConfig,
          )) as { data?: { personProfile?: unknown } };
        }

        const personProfile = response?.data?.personProfile;
        if (!personProfile || controllerRef.current[type] !== controller) {
          setLookupState(type, {
            status: "error",
            signature,
            message: fallbackMessage,
          });
          return false;
        }

        field.setValue(
          mergeIcpProfileIntoValue(
            type,
            (field.value || {}) as IDSelectorValue,
            personProfile as never,
            nationalityListRef.current as NationalityOption[],
          ),
        );
        setFieldError(queryFieldName, "");
        setLookupState(type, { status: "success", signature });
        return true;
      } catch (error) {
        if (
          (error as { code?: string; name?: string })?.code === "ERR_CANCELED" ||
          (error as { code?: string; name?: string })?.name === "CanceledError" ||
          (error as { code?: string; name?: string })?.name === "AbortError"
        ) {
          return false;
        }

        const message = getErrorMessage(error, fallbackMessage);
        setFieldError(queryFieldName, message);
        setLookupState(type, { status: "error", signature, message });
        console.error(`Failed to load ${type} info:`, error);
        return false;
      }
    },
    [current, field, labels, setFieldError, setLookupState],
  );

  const isIcpInfoLoaded = isLookupFresh(
    currentType,
    lookupStateMap[currentType],
    current,
  );

  useEffect(() => {
    if (typeof onIcpLoadedChange !== "function") return;
    onIcpLoadedChange(isIcpInfoLoaded);
  }, [currentType, isIcpInfoLoaded, onIcpLoadedChange]);

  return {
    nationalityList,
    lookupStateMap,
    isIcpInfoLoaded,
    triggerQuery,
  };
};

export default useIdSelectorIcp;
