import create from "zustand"
import { persist } from "zustand/middleware"

export interface IApplicationInfo {
  id: number
  applicationNumber: string
  serviceId: number
  serviceNameAr: string
  serviceNameEn: string
  serviceCode: string | number
  serviceCategoryNameAr: string
  serviceCategoryNameEn: string
  serviceTypeId: string
  serviceTypeNameAr: string
  serviceTypeNameEn: string
  statusId:number
  sla: number
  userName: string
  processInstanceStatus: string
  createdOn: string
  applicationDetailId: number
  taskId: string
  processInstanceId: string
  status: string
  buttonJson: string
  dispositionCaseId?: number | null
  dispositionCase?: {
    caseId?: number | null
  } | null
  userTypeCode: string
  // CARE is different from createOn above?
  submissionTime: string
  lastUpdatedTime?: string | null
  profileIsVIP: boolean
  isEligible?: boolean
  requiresFahrApproval?: boolean
}

const initialApplicationsDetails: IApplicationInfo = {
  id: 0,
  applicationNumber: "",
  serviceId: 0,
  serviceNameAr: "",
  serviceNameEn: "",
  serviceCategoryNameAr: "",
  serviceCategoryNameEn: "",
  serviceTypeId: "",
  serviceTypeNameAr: "",
  serviceTypeNameEn: "",
  sla: 0,
  userName: "",
  processInstanceStatus: "",
  createdOn: "",
  applicationDetailId: 0,
  taskId: "",
  processInstanceId: "",
  status: "",
  buttonJson: "",
  userTypeCode: "",
  submissionTime: "",
}
interface IDictStore {
  applicationsDetails: IApplicationInfo
  setApplicationsDetails: (data: IApplicationInfo) => void
  resetApplicationsDetails: () => void
}

export const useAppStore = create<IDictStore>(
  persist(
    (set) => ({
      applicationsDetails: initialApplicationsDetails,
      setApplicationsDetails: (data: IApplicationInfo) =>
        set({ applicationsDetails: data }),
      resetApplicationsDetails: () => {
        set({ applicationsDetails: initialApplicationsDetails })
      },
    }),
    {
      name: "app-storage", // name of the item in the storage (must be unique)
      getStorage: () => sessionStorage, // (optional) by default, 'localStorage' is used
    }
  )
)
