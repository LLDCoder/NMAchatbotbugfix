import React, { useEffect, useMemo, useRef } from "react";
import { KeepAliveContext } from "./context";

type KeepAliveProps = {
  activeKey: string;
  activeLocationKey: string;
  children: React.ReactNode;
};

export default function KeepAlive({
  activeKey,
  activeLocationKey,
  children,
}: KeepAliveProps) {
  const previousActiveKeyRef = useRef(activeKey);
  const previousActiveLocationKeyRef = useRef(activeLocationKey);

  const contextValue = useMemo(
    () => ({
      activeKey,
      prevActiveKey: previousActiveKeyRef.current,
      activeLocationKey,
      prevActiveLocationKey: previousActiveLocationKeyRef.current,
    }),
    [activeKey, activeLocationKey],
  );

  useEffect(() => {
    // Track the previous pathname so child hooks can tell whether they were reactivated.
    previousActiveKeyRef.current = activeKey;
  }, [activeKey]);

  useEffect(() => {
    // Track the full previous location for query-aware restore and activation flows.
    previousActiveLocationKeyRef.current = activeLocationKey;
  }, [activeLocationKey]);

  return (
    <KeepAliveContext.Provider value={contextValue}>
      {children}
    </KeepAliveContext.Provider>
  );
}
