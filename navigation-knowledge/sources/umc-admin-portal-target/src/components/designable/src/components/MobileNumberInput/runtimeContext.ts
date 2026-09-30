import { createContext, useContext } from "react";
import { DEFAULT_COUNTRY_DIAL_CODE } from "@/components/common/CountrySelect/constants";

export interface MobileNumberRuntimeConfig {
  defaultCountryCode: string;
}

export type MobileNumberRuntimeConfigInput = Partial<MobileNumberRuntimeConfig>;

export const EMPTY_MOBILE_NUMBER_RUNTIME_CONFIG: MobileNumberRuntimeConfig = {
  defaultCountryCode: DEFAULT_COUNTRY_DIAL_CODE,
};

export const MobileNumberRuntimeContext =
  createContext<MobileNumberRuntimeConfig>(
    EMPTY_MOBILE_NUMBER_RUNTIME_CONFIG,
  );

export const resolveMobileNumberDefaultCountryCode = (
  explicitDefaultCountryCode?: string,
  runtimeDefaultCountryCode?: string,
) =>
  explicitDefaultCountryCode?.trim() ||
  runtimeDefaultCountryCode?.trim() ||
  DEFAULT_COUNTRY_DIAL_CODE;

export const useMobileNumberRuntime = () =>
  useContext(MobileNumberRuntimeContext);

export const useResolvedMobileNumberDefaultCountryCode = (
  explicitDefaultCountryCode?: string,
) => {
  const { defaultCountryCode } = useMobileNumberRuntime();
  return resolveMobileNumberDefaultCountryCode(
    explicitDefaultCountryCode,
    defaultCountryCode,
  );
};
