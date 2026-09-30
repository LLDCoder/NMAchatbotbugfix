type ServiceCodeValue = string | number | null | undefined;

const normalizeServiceCode = (value: ServiceCodeValue): string | number | "" => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? "" : trimmed;
  }

  return "";
};

const readServiceCodeFromUrl = (): string | "" => {
  if (typeof window === "undefined") {
    return "";
  }

  const serviceCode = new URLSearchParams(window.location.search)
    .get("serviceCode")
    ?.trim();

  return serviceCode || "";
};

const readServiceCodeFromLocalStorage = (): string | number | "" => {
  if (typeof window === "undefined") {
    return "";
  }

  try {
    const directServiceCode = window.localStorage.getItem("serviceCode")?.trim();
    if (directServiceCode) {
      return directServiceCode;
    }

    const persistedServicesStore = window.localStorage.getItem("services-storage");
    if (!persistedServicesStore) {
      return "";
    }

    const parsed = JSON.parse(persistedServicesStore) as {
      state?: {
        userInfo?: {
          servicesCode?: ServiceCodeValue;
        };
      };
    };

    return normalizeServiceCode(parsed?.state?.userInfo?.servicesCode);
  } catch (error) {
    console.error("Failed to resolve serviceCode from storage", error);
    return "";
  }
};

export const resolveServiceCode = (
  serviceCode?: ServiceCodeValue,
): string | number => {
  const explicitServiceCode = normalizeServiceCode(serviceCode);
  if (explicitServiceCode !== "") {
    return explicitServiceCode;
  }

  const serviceCodeFromUrl = readServiceCodeFromUrl();
  if (serviceCodeFromUrl !== "") {
    return serviceCodeFromUrl;
  }

  return readServiceCodeFromLocalStorage();
};
