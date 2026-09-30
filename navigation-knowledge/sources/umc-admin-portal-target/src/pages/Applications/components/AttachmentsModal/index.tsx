import DocumentViewer from "@/components/common/DocumentViewer"
import { Modal } from "antd"
import { forwardRef, useImperativeHandle, useState } from "react"
import { useTranslation } from "react-i18next"
import "./index.less"

interface IProps {
  attachments: string[]
}

interface IAttachmentsRef {
  show: () => void
}

export type { IAttachmentsRef, IProps }

export const AttachmentsModal = forwardRef<IAttachmentsRef, IProps>(
  ({ attachments }: IProps, ref) => {
    const { t } = useTranslation()
    console.log(">>>", attachments)
    const [visible, setVisible] = useState(false)

    useImperativeHandle(ref, () => ({
      show: () => setVisible(true),
    }))

    return (
      <Modal
        centered
        title={t("applications.approvalModals.common.attachments")}
        visible={visible}
        footer={null}
        onCancel={() => setVisible(false)}
      >
        <div className="attachments-list">
          {attachments.map((item) => (
            <div key={item} className="attachment-item">
              <DocumentViewer hasDownload fileName={item} />
            </div>
          ))}
        </div>
      </Modal>
    )
  }
)
