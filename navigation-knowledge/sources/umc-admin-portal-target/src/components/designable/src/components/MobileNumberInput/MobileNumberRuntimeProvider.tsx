import { useMemo, type ReactNode } from "react";
import {
  EMPTY_MOBILE_NUMBER_RUNTIME_CONFIG,
  MobileNumberRuntimeContext,
  type MobileNumberRuntimeConfig,
  type MobileNumberRuntimeConfigInput,
} from "./runtimeContext";

interface MobileNumberRuntimeProviderProps {
  config?: MobileNumberRuntimeConfigInput;
  children: ReactNode;
}

export const MobileNumberRuntimeProvider = ({
  config,
  children,
}: MobileNumberRuntimeProviderProps) => {
  const value = useMemo<MobileNumberRuntimeConfig>(
    () => ({
      defaultCountryCode:
        config?.defaultCountryCode ??
        EMPTY_MOBILE_NUMBER_RUNTIME_CONFIG.defaultCountryCode,
    }),
    [config?.defaultCountryCode],
  );

  return (
    <MobileNumberRuntimeContext.Provider value={value}>
      {children}
    </MobileNumberRuntimeContext.Provider>
  );
};
