// Service data storage utilities for localStorage

export interface StoredServiceData {
  serviceId: number;
  serviceCode: string;
  nameEn: string;
  nameAr: string;
  serviceCategoryId: number;
  type: string;
  department: string;
  scope?: string;
  userType?: string;
  isLoginRequired?: boolean;
  status?: string;
  createdAt?: string;
  loadedAt?: string;
}

const STORAGE_KEY = "currentServiceData";

/**
 * Save service data to localStorage
 */
export const saveServiceData = (data: StoredServiceData): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    console.log("Service data saved to localStorage:", data);
  } catch (error) {
    console.error("Failed to save service data to localStorage:", error);
  }
};

/**
 * Get service data from localStorage
 */
export const getServiceData = (): StoredServiceData | null => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      return JSON.parse(data);
    }
    return null;
  } catch (error) {
    console.error("Failed to get service data from localStorage:", error);
    return null;
  }
};

/**
 * Get only serviceId from localStorage
 */
export const getServiceId = (): number | null => {
  const data = getServiceData();
  return data?.serviceId || null;
};

/**
 * Get only serviceCode from localStorage
 */
export const getServiceCode = (): string | null => {
  const data = getServiceData();
  return data?.serviceCode || null;
};

/**
 * Clear service data from localStorage
 */
export const clearServiceData = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
    console.log("Service data cleared from localStorage");
  } catch (error) {
    console.error("Failed to clear service data from localStorage:", error);
  }
};

/**
 * Update specific fields in stored service data
 */
export const updateServiceData = (updates: Partial<StoredServiceData>): void => {
  const currentData = getServiceData();
  if (currentData) {
    const updatedData = { ...currentData, ...updates };
    saveServiceData(updatedData);
  } else {
    console.warn("No existing service data to update");
  }
};
