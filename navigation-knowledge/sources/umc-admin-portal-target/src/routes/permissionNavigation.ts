import { CustomMessage } from "@/components/common";
import i18n from "@/localization/config";
import {
  createPermissionPathSet,
  normalizeRoutePath,
  type PermissionNode,
} from "@/routes/access";
import { useUserStore } from "@/store/user";

export function canAccessRouteWithToast(targetPath?: string | null): boolean {
  const normalizedTargetPath = normalizeRoutePath(targetPath);

  if (!normalizedTargetPath) {
    return false;
  }

  const permissions = (useUserStore.getState().userInfo?.listSysPermission ||
    []) as PermissionNode[];
  const canAccessRoute = createPermissionPathSet(permissions).has(
    normalizedTargetPath,
  );

  if (!canAccessRoute) {
    CustomMessage.warning(i18n.t("response.error.403"));
    return false;
  }

  return true;
}
