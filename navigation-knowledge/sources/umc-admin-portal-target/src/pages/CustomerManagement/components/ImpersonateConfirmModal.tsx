import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { ConfirmModal } from "@/components/common";

export interface ImpersonateAccount {
  userId: string;
  displayName: string;
}

export interface ImpersonateConfirmModalRef {
  open: (account: ImpersonateAccount) => void;
  close: () => void;
}

export interface ImpersonateConfirmModalProps {
  onConfirm: (account: ImpersonateAccount) => void | Promise<void>;
}

const ImpersonateConfirmModal = forwardRef<
  ImpersonateConfirmModalRef,
  ImpersonateConfirmModalProps
>(({ onConfirm }, ref) => {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [account, setAccount] = useState<ImpersonateAccount | null>(null);

  const close = useCallback(() => {
    setVisible(false);
  }, []);

  const open = useCallback((nextAccount: ImpersonateAccount) => {
    setAccount(nextAccount);
    setVisible(true);
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      open,
      close,
    }),
    [close, open],
  );

  const handleConfirm = useCallback(async () => {
    if (!account || loading) return;

    setLoading(true);
    try {
      await onConfirm(account);
      close();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [account, close, loading, onConfirm]);

  return (
    <ConfirmModal
      visible={visible}
      loading={loading}
      type="warning"
      width={660}
      title={t("Customer.accounts.impersonateModal.title")}
      content={t("Customer.accounts.impersonateModal.content", {
        name: account?.displayName ?? "",
      })}
      cancelText={t("common.cancel")}
      confirmText={t("Customer.accounts.impersonateModal.continue")}
      onCancel={loading ? () => undefined : close}
      onConfirm={handleConfirm}
    />
  );
});

ImpersonateConfirmModal.displayName = "ImpersonateConfirmModal";

export default ImpersonateConfirmModal;
