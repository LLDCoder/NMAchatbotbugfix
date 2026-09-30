import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { PAGE_HEADING_EXTRA_PORTAL_ID } from "./constants";

interface PageHeadingPortalProps {
  children: ReactNode;
  targetId?: string;
}

export default function PageHeadingPortal({
  children,
  targetId = PAGE_HEADING_EXTRA_PORTAL_ID,
}: PageHeadingPortalProps) {
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setHost(document.getElementById(targetId));

    return () => {
      setHost(null);
    };
  }, [targetId]);

  if (!host) {
    return null;
  }

  return createPortal(children, host);
}
