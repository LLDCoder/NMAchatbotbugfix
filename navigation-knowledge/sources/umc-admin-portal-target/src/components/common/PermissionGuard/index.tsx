import type { ReactNode } from "react";
import { useCanRenderButton } from "@/routes/access";

export interface PermissionGuardProps {
  permissionCode: string;
  routePath?: string;
  children: ReactNode;
  fallback?: ReactNode;
}

export default function PermissionGuard({
  permissionCode,
  routePath,
  children,
  fallback = null,
}: PermissionGuardProps) {
  const canRender = useCanRenderButton(permissionCode, routePath);

  if (!canRender) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
