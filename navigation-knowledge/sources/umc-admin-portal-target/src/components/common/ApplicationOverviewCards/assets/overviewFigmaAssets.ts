import FileJpgIcon from "@/assets/images/FileJpg.svg";
import EyeIcon from "@/assets/images/Eye.svg";
import DownloadIcon from "@/assets/images/Download.svg";
import TotalIcon from "@/assets/images/TotalAll.svg";
import CompletedIcon from "@/assets/images/Completed.svg";
import CancelledIcon from "@/assets/images/Cancelled 2.svg";
import PendingCustomerIcon from "@/assets/images/Pending Customer.svg";
import DepartmentProcessingIcon from "@/assets/images/Department Processing.svg";
import DepartmentProcessedIcon from "@/assets/images/Department Processed.svg";
import PendingReviewIcon from "@/assets/images/PendingReview.svg";
import { inspectionFigmaAssets } from "@/pages/InspectionCommon/assets";

export const overviewFigmaAssets = {
  files: {
    jpg: FileJpgIcon,
    eye: EyeIcon,
    download: DownloadIcon,
  },
  search: inspectionFigmaAssets.violationSearchIcons,
  filter: {
    funnel: inspectionFigmaAssets.violationFilterIcons.funnel,
  },
  inspectionStats: inspectionFigmaAssets.taskStatIconsInspection,
  inspectionTargets: inspectionFigmaAssets.taskTargetIcons,
  violationStats: inspectionFigmaAssets.violationStatIcons,
  refundStats: {
    total: TotalIcon,
    departmentProcessing: DepartmentProcessingIcon,
    departmentProcessed: DepartmentProcessedIcon,
    pendingCustomer: PendingCustomerIcon,
    pendingRefund: PendingReviewIcon,
    refunded: CompletedIcon,
    rejected: CancelledIcon,
    cancelled: CancelledIcon,
  },
  appealStats: {
    total: TotalIcon,
    departmentProcessing: DepartmentProcessingIcon,
    departmentProcessed: DepartmentProcessedIcon,
    pendingCustomer: PendingCustomerIcon,
    approved: CompletedIcon,
    rejected: CancelledIcon,
    cancelled: CancelledIcon,
  },
};
