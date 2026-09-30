import type { InspectionTaskAttachmentPayload } from '@/services/inspection';
import InspectionAttachmentUpload from '../../InspectionCommon/components/InspectionAttachmentUpload';

type TaskAttachmentUploadProps = {
  value: InspectionTaskAttachmentPayload[];
  uploadText: string;
  disabled?: boolean;
  className?: string;
  attachmentGridClassName?: string;
  onChange: (attachments: InspectionTaskAttachmentPayload[]) => void;
  onUploadingChange?: (uploading: boolean) => void;
};

const TaskAttachmentUpload = (props: TaskAttachmentUploadProps) => (
  <InspectionAttachmentUpload {...props} />
);

export default TaskAttachmentUpload;
