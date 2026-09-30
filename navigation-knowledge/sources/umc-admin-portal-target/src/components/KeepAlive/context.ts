import { createContext } from "react";

// Shared route-level state for a keep-alive group.
export type KeepAliveContextValue = {
  activeKey: string;
  prevActiveKey: string;
  activeLocationKey: string;
  prevActiveLocationKey: string;
};

// Shared item-level state for the currently cached route.
export type KeepAliveItemContextValue = {
  cacheKey: string;
};

export const KeepAliveContext = createContext<KeepAliveContextValue>({
  activeKey: "",
  prevActiveKey: "",
  activeLocationKey: "",
  prevActiveLocationKey: "",
});

export const KeepAliveItemContext = createContext<KeepAliveItemContextValue>({
  cacheKey: "",
});
