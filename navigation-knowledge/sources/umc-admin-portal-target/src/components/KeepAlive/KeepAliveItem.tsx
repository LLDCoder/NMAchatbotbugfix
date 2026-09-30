import React, { useEffect, useRef, useState } from "react";
import { KeepAliveItemContext } from "./context";

type KeepAliveItemProps = {
  cacheKey: string;
  active: boolean;
  children: React.ReactNode;
};

export default function KeepAliveItem({
  cacheKey,
  active,
  children,
}: KeepAliveItemProps) {
  const [mounted, setMounted] = useState(active);
  const cachedNodeRef = useRef<React.ReactNode>(active ? children : null);

  useEffect(() => {
    if (!active) return;

    // Refresh the cached subtree whenever this route becomes active again.
    cachedNodeRef.current = children;
    setMounted(true);
  }, [active, children]);

  if (!mounted || cachedNodeRef.current === null) {
    return null;
  }

  return (
    <KeepAliveItemContext.Provider value={{ cacheKey }}>
      <div
        aria-hidden={active ? "false" : "true"}
        // Keep the subtree mounted while hiding inactive content from layout and a11y.
        style={{ display: active ? "contents" : "none" }}
      >
        {cachedNodeRef.current}
      </div>
    </KeepAliveItemContext.Provider>
  );
}
