import { Modal } from 'antd';

type ShowCancelTaskConfirmParams = {
  title: string;
  content: string;
  okText: string;
  onOk: () => void | Promise<void>;
};

export const showCancelTaskConfirm = ({
  title,
  content,
  okText,
  onOk,
}: ShowCancelTaskConfirmParams) => {
  Modal.confirm({
    centered: true,
    title,
    content,
    okText,
    okButtonProps: { danger: true },
    onOk,
  });
};
