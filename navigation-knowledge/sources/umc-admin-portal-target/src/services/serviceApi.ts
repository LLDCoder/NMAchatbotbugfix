import type { CustomFee } from "@/pages/AddNewService/components/FeeConfiguration"
import request from "@/utils/request"

export interface GetAllServicesParams {
  pageIndex: number
  pageSize: number
  search?: string
  listServiceCategoryId?: string | number[]
  departmentId?: string | number
  type?: string
  priority?: string
  startTime?: string
  endTime?: string
  status?: string
}

export interface TypeDictionaryInfo {
  id: number
  code: string
  scope: string
  nameEn: string
  nameAr: string
  isShown: boolean
  descAr: string | null
  descEn: string | null
}

export interface ServiceChildItem {
  id: number
  parentId?: number | null
  nameAr: string
  nameEn: string
  code: string
  serviceFeeEn?: string | null
  serviceFeeAr?: string | null
  serviceFee?: string | null
  serviceDeliveryTimeEn?: string | null
  serviceDeliveryTimeAr?: string | null
  serviceDeliveryTime?: string | null
  termsAndConditionsEn?: string | null
  termsAndConditionsAr?: string | null
  termsAndConditions?: string | null
  serviceCategoryId: number
  serviceCategories?: any
  roleId?: string
  pmocode?: string | null
  pmopulseCode?: string | null
  serviceDescriptionEn?: string | null
  serviceDescriptionAr?: string | null
  status: string
  statusInfo?: TypeDictionaryInfo
  type: string
  typeInfo?: TypeDictionaryInfo
  scope?: string
  orderNum?: number
  department: string
  departmentInfo?: TypeDictionaryInfo
  loginToPay?: string | null
  updateAt?: string | null
  createAt: string
  formId?: string | null
  workFlowId?: string | null
  feeId?: string | null
  certificateId?: string | null
  ruleId?: string | null
  iscollect: boolean
  version?: string
  createBy?: string | null
  isLoginRequired?: boolean
  userType?: string
  userTypeInfo?: TypeDictionaryInfo | null
}

export interface ServiceItem {
  id: number
  parentId?: number | null
  nameAr: string
  nameEn: string
  code: string
  serviceFeeEn?: string | null
  serviceFeeAr?: string | null
  serviceFee?: string | null
  serviceDeliveryTimeEn?: string | null
  serviceDeliveryTimeAr?: string | null
  serviceDeliveryTime?: string | null
  termsAndConditionsEn?: string | null
  termsAndConditionsAr?: string | null
  termsAndConditions?: string | null
  serviceCategoryId: number
  serviceCategories?: any
  roleId?: string
  pmocode?: string | null
  pmopulseCode?: string | null
  serviceDescriptionEn?: string | null
  serviceDescriptionAr?: string | null
  status: string
  statusInfo?: TypeDictionaryInfo
  type: string
  typeInfo?: TypeDictionaryInfo
  scope?: string
  orderNum?: number
  department: string
  departmentInfo?: TypeDictionaryInfo
  loginToPay?: string | null
  updateAt?: string | null
  createAt: string
  formId?: string | null
  workFlowId?: string | null
  feeId?: string | null
  certificateId?: string | null
  ruleId?: string | null
  iscollect: boolean
  version?: string
  createBy?: string | null
  isLoginRequired?: boolean
  userType?: string
  userTypeInfo?: TypeDictionaryInfo | null
  serviceChildrens: ServiceChildItem[]
  forms: any[]
  workflowConfigurations: any[]
  serviceFees: any[]
  serivceCertificates: any[]
}

export interface GetAllServicesResponse {
  statusCode: number
  message: string
  data: {
    totalPage: number
    currentPage: number
    totalItems: number
    itemsPerPage: number
    totalAmount: number
    items: ServiceItem[]
  }
}
export interface serviceCategoriesPageParams {
  pageIndex?: number
  pageSize?: number
  searchKeyword?: string
  sortBy?: string
  isDesc?: boolean
}

export const getAllServices = (params: GetAllServicesParams) => {
  return request.get<GetAllServicesResponse>(
    "/api/ServiceInfo/GetServicesToPage",
    params
  )
}

export interface SaveSortItem {
  id: number
  orderNum: number
}

export interface SaveSortResponse {
  statusCode: number
  message: string
  data: any
}

export interface ServicesToPageParams {
  pageIndex?: number
  pageSize?: number
  ServiceCategoryId: string
}

export interface ServicesToPageByCategoryParams {
  pageIndex?: number;
  pageSize?: number;
  ServiceCategoryId: string;
}

export interface ServicesToPageByCategoryItem {
  id: string;
  code: string;
  nameEn: string;
  nameAr: string;
  status: string;
}

export interface ServicesToPageByCategoryResponse {
  totalItems: number;
  items: ServicesToPageByCategoryItem[];
}

export const saveSortOrder = (data: SaveSortItem[]) => {
  return request.post<SaveSortResponse>("/api/Role/SaveSort", data)
}

// service categories
export const serviceCategoriesPageList = (
  params: serviceCategoriesPageParams
) => {
  return request.get<SaveSortResponse>(
    "/api/ServiceCategories/PageList",
    params
  )
}

export const serviceCategoriesDetail = (id: string | number) => {
  return request.get<SaveSortResponse>(`/api/ServiceCategories/${id}`)
}

export const addServiceCategory = (data: UpdateServiceCategoryParams) => {
  return request.post<void>("/api/ServiceCategories", data)
}
export const delServiceCategories = (id: string | number) => {
  return request.delete<SaveSortResponse>(`/api/ServiceCategories/${id}`)
}

export const categoriesUpdateSort = (
  data: { id: string; displayOrder: number }[]
) => {
  return request.put<SaveSortResponse>(
    "/api/ServiceCategories/UpdateSort",
    data
  )
}

export const getServicesToPageByCategory = (
  params: ServicesToPageByCategoryParams
) => {
  return request.get<ServicesToPageByCategoryResponse>(
    "/api/ServiceInfo/GetServicesToPageByCategory",
    params
  )
}
export const getServicesToPage = (params: ServicesToPageParams) => {
  return request.get<SaveSortResponse>(
    "/api/ServiceInfo/GetServicesToPage",
    params
  )
}
export interface DeleteServiceResponse {
  statusCode: number
  message: string
  data: any
}

export const deleteService = (id: number) => {
  return request.delete<DeleteServiceResponse>(
    `/api/ServiceInfo/DeleteService?id=${id}`
  )
}

export interface UpdateFeaturedParams {
  id: number
  isCollect: boolean
}

export interface UpdateFeaturedResponse {
  statusCode: number
  message: string
  data: any
}

export const updateFeatured = (params: UpdateFeaturedParams) => {
  return request.post<UpdateFeaturedResponse>(
    "/api/Role/UpdateFeatured",
    params
  )
}

export interface AddServiceParams {
  nameAr: string
  nameEn: string
  code?: string
  serviceFeeEn?: string
  serviceFeeAr?: string
  serviceDeliveryTimeEn?: string
  serviceDeliveryTimeAr?: string
  termsConditionsEn?: string
  termsConditionsAr?: string
  serviceCategoryId?: number
  roleId?: string
  pmocode?: string
  pmopulseCode?: string
  serviceDescriptionEn: string
  serviceDescriptionAr: string
  status?: string
  type: string
  scope: string
  orderNum?: number
  department: string
  loginToPay?: string
  updateAt?: string
  createAt?: string
  formCode?: string
  workFlowCode?: string
  feeCode?: string
  certificateCode?: string
  ruleCode?: string
  iscollect?: boolean
  parentId?: number
  version?: string
  createBy?: string
  publishAt?: string
  isLoginRequired?: boolean
  userType?: string
}

export interface AddServiceResponse {
  id: number
  code: string
}

export const addService = (data: AddServiceParams) => {
  return request.post<AddServiceResponse>("/api/ServiceInfo/AddService", data, {
    skipErrorMessage: true,
  })
}
export interface ServiceCustomActivityFee {
  id: number
  customFeeId: number
  code: string
  g3code: string
  economicActivityId: number
  nameAr: string
  nameEn: string
  fee: number
  creatAt: string
  updaterAt: string
  customFee: null | any
}

export interface ServiceFee {
  id: number
  serviceId: number
  ruleType: string
  ruleConfigFile: null | string
  isFee: boolean
  version: string
  creatAt: string
  updaterAt: string
  linkedServiceCode: string
  serviceCustomActivityFeeDtos: ServiceCustomActivityFee[]
}

export const getServiceFeeByServiceId = (serviceId: number) => {
  return request.get<ServiceFee>(
    `/api/ServiceInfo/GetEconomicActivitys?ServiceCode=${serviceId}`
  ) 
}

interface PutServiceFeeParam {
  id: number
  fee: number
  serviceId: number
}
export const putServiceFee = (params: PutServiceFeeParam) => {
  return request.put(`/api/ServiceFree/UpdateServiceFee/${params.id}`, params)
}

interface putSerivceCertificateParam {
  id: number
  serviceId: number
  templateId: number
  nameEn: string
  nameAr: string
  validityPeriod: string
  status: string
  isUnifiedExpiry: boolean
  serivceCertificatesFields: any[]
}
export const putSerivceCertificate = (params: putSerivceCertificateParam) => {
  return request.put(
    `/api/ServiceCertificate/UpdateSerivceCertificate/${params.id}`,
    params
  )
}

export interface ServiceCategory {
  id: string
  code: string
  nameAr: string
  nameEn: string
  descriptionEn: string
  descriptionAr: string
  iconUri: string
  displayOrder: number
  isActive: boolean
  pmocode: string
  createdAt: string
  updatedAt: string
  isDeleted: boolean
  serviceInfoCount: number
}

export const getAllServiceCategories = (params?: { name?: string }) => {
  return request.get<ServiceCategory[]>("/api/ServiceCategories", params)
}

export interface ServiceCategoriesPageParams {
  pageIndex?: number
  pageSize?: number
  searchKeyword?: string
  sortBy?: string
  isDesc?: boolean
}

export interface ServiceCategoriesPageResponse {
  total: number
  pageIndex: number
  pageSize: number
  data: ServiceCategory[]
}

export const getServiceCategoriesPage = (
  params: ServiceCategoriesPageParams
) => {
  return request.get<ServiceCategoriesPageResponse>(
    "/api/ServiceCategories/PageList",
    params
  )
}

export const getServiceCategoryById = (id: string) => {
  return request.get<ServiceCategory>(`/api/ServiceCategories/${id}`)
}

export interface CreateServiceCategoryParams {
  code?: string
  nameAr: string
  nameEn: string
  descriptionEn: string
  descriptionAr: string
  iconUri: string
  displayOrder?: number
  pmocode?: string
}

export const createServiceCategory = (data: CreateServiceCategoryParams) => {
  return request.post<ServiceCategory>("/api/ServiceCategories", data)
}

export interface CheckServiceCategoryNameExistsResponse {
  statusCode: number
  message: string
  data: boolean
}

export interface CheckServiceCategoryNameExistsParams {
  nameEn?: string
  nameAr?: string
}

export const checkServiceCategoryNameExists = (
  params: CheckServiceCategoryNameExistsParams
) => {
  return request.get<
    CheckServiceCategoryNameExistsResponse,
    CheckServiceCategoryNameExistsResponse
  >(
    "/api/ServiceCategories/CheckNameExists",
    params,
    { skipErrorMessage: true }
  )
}

export interface UpdateServiceCategoryParams {
  id: string
  code: string
  nameAr: string
  nameEn: string
  descriptionEn: string
  descriptionAr: string
  iconUri: string
  displayOrder?: number
  pmocode?: string
}

export const updateServiceCategory = (
  id: string,
  data: UpdateServiceCategoryParams
) => {
  return request.put<void>(`/api/ServiceCategories/${id}`, data)
}

export const deleteServiceCategory = (id: string) => {
  return request.delete<void>(`/api/ServiceCategories/${id}`)
}

export interface UpdateCategorySortItem {
  id: string
  displayOrder: number
}

export const updateServiceCategorySort = (data: UpdateCategorySortItem[]) => {
  return request.put<{ message: string }>(
    "/api/ServiceCategories/UpdateSort",
    data
  )
}

export interface ServiceInfoDetail {
  id: number
  parentId: number | null
  nameAr: string
  nameEn: string
  code: string
  serviceFeeEn?: string | null
  serviceFeeAr?: string | null
  serviceFee?: string | null
  serviceDeliveryTimeEn?: string | null
  serviceDeliveryTimeAr?: string | null
  serviceDeliveryTime?: string | null
  termsAndConditionsEn?: string | null
  termsAndConditionsAr?: string | null
  termsAndConditions?: string | null
  feeDescriptionEn?: string | null
  feeDescriptionAr?: string | null
  deliveryTimeEn?: string | null
  deliveryTimeAr?: string | null
  termsConditionsEn?: string | null
  termsConditionsAr?: string | null
  serviceCategoryId: number
  roleId: string
  pmocode: string
  pmopulseCode: string | null
  serviceDescriptionEn: string
  serviceDescriptionAr: string
  status: string
  type: string
  scope: string
  orderNum: number
  department: string
  userType: string
  isLoginRequired: boolean
  loginToPay: string
  updateAt: string
  createAt: string
  formCode: string
  workFlowCode: string
  feeCode: string
  certificateCode: string
  ruleCode: string
  iscollect: boolean
  version: string
  createBy: string
  serviceChildrens: any[]
  forms: any[]
  serviceFees: CustomFee;
  serivceCertificateDtos: any[]
  serivceCertificates: any[]
  workFlowId: number | null
  workflowConfigurations: any[]
}
export const createServiceCode = () => {
  return request.get<string>("/api/ServiceInfo/CreateServiceCode")
}

export interface GetAllServicesV2Params {
  pageIndex?: number
  pageSize?: number
  search?: string
  listServiceCategoryId?: number[]
  isCollect?: boolean
  listDepartment?: number[]
  type?: string
}

export interface GetAllServicesV2Response {
  items: ServiceInfoDetail[]
  totalItems: number
  pageIndex: number
  pageSize: number
  totalPages: number
}

export const getAllServicesV2 = (params: GetAllServicesV2Params) => {
  return request.get<GetAllServicesV2Response>(
    "/api/ServiceInfo/GetAllServices",
    params
  )
}

export interface UpdateServiceParams {
  id: number
  parentId?: number | null
  nameAr: string
  nameEn: string
  code: string
  serviceFeeEn?: string
  serviceFeeAr?: string
  serviceDeliveryTimeEn?: string
  serviceDeliveryTimeAr?: string
  termsConditionsEn?: string
  termsConditionsAr?: string
  serviceCategoryId: number
  serviceDescriptionEn: string
  serviceDescriptionAr: string
  status?: string
  type: string
  scope: string
  orderNum?: number
  department: string
  loginToPay?: string
  formCode?: string
  workFlowCode?: string
  feeCode?: string
  certificateCode?: string
  ruleCode?: string
  isLoginRequired?: boolean
  userType: string
  roleId?: string
}
export interface UpdateServiceResponese {
  id: number
  nameAr: string
  nameEn: string
  code: string
  serviceFeeEn?: string | null
  serviceFeeAr?: string | null
  serviceFee?: string | null
  serviceDeliveryTimeEn?: string | null
  serviceDeliveryTimeAr?: string | null
  serviceDeliveryTime?: string | null
  termsAndConditionsEn?: string | null
  termsAndConditionsAr?: string | null
  termsAndConditions?: string | null
  feeDescriptionEn?: string | null
  feeDescriptionAr?: string | null
  deliveryTimeEn?: string | null
  deliveryTimeAr?: string | null
  termsConditionsEn?: string | null
  termsConditionsAr?: string | null
  serviceCategoryId: number
  roleId: string
  pmocode: string | null
  pmopulseCode: string | null
  serviceDescriptionEn: string
  serviceDescriptionAr: string
  status: string
  type: string
  scope: string
  orderNum: number
  department: string
  loginToPay: string | null
  updateAt: string
  createAt: string
  formId: string | null
  workFlowId: string | null
  feeId: string | null
  certificateId: string | null
  ruleId: string | null
  iscollect: boolean
  parentId: number
  version: string
  createBy: string
  publishAt: string | null
  isLoginRequired: boolean
  userType: string
}
export const updateService = (data: UpdateServiceParams) => {
  return request.post<UpdateServiceResponese>(
    "/api/ServiceInfo/UpdateService",
    data
  )
}

export interface TypeDictionary {
  id: number
  code: string
  scope: string
  nameEn: string
  nameAr: string
  isShown: boolean
  descAr: string
  descEn: string
}

export const getTypeDictionaryList = (scope: string) => {
  return request.post<TypeDictionary[]>(
    "/api/ServiceInfo/GetTypeDictionaryList",
    { scope }
  )
}

export const getTypeDictionaries = (type: string) => {
  return request.get<TypeDictionary[]>(
    `/api/TypeDictionary/GetTypeDictionaries/${type}`
  )
}

export const getCoverType = () => {
  return request.get<TypeDictionary[]>("/api/TypeDictionary/GetTypeDictionaries/CoverType")
}

export const getAllUserType = () => {
  return request.get<TypeDictionary[]>("/api/serviceInfo/GetAllUserType")
}
interface ServiceInfoCountDto {
  status: string
  count: number
}
export interface ServiceIndexCount {
  all: "All"
  count: number
  serviceInfoCountDto: ServiceInfoCountDto[]
}

export const getServiceIndexCount = () => {
  return request.get<ServiceIndexCount>(
    "/api/ServiceInfo/GetServiceIndextCount"
  )
}

export const deleteServiceV2 = (id: number) => {
  return request.delete<string>(`/api/ServiceInfo/DeleteService?id=${id}`)
}

export const getServiceById = (id: string | number) => {
  return request.get<ServiceInfoDetail>(
    `/api/ServiceInfo/GetServiceById/${id}`
  )
}

export interface SaveSortDto {
  id: number
  orderNum: number
}

export const saveServiceSort = (data: SaveSortDto[]) => {
  return request.post<boolean>("/api/ServiceInfo/SaveSort", data)
}

export interface UpdateFeaturedDto {
  id: number
  isCollect: boolean
}

export const updateServiceFeatured = (data: UpdateFeaturedDto) => {
  return request.post<boolean>("/api/ServiceInfo/UpdateFeatured", data)
}

export const getServiceInfoFeatured = () => {
  return request.get<ServiceInfoDetail[]>(
    "/api/ServiceInfo/GetServiceInfoFeatured"
  )
}

export const getServiceCanPublish = (serviceId: number) => {
  return request.get<boolean>(
    `/api/ServiceInfo/GetServiceCanPublish?serviceId=${serviceId}`
  )
}

export interface PrePublishTestAccountResponse {
  testAccountEmail: string
}

export const getPrePublishTestAccount = () => {
  return request.get<PrePublishTestAccountResponse>(
    "/api/ServiceInfo/GetPrePublishTestAccount"
  )
}

export interface ServicePublishDto {
  id: number
  status: string
}

export const updateServiceStatus = (data: ServicePublishDto) => {
  return request.post<boolean>("/api/ServiceInfo/UpdateStatus", data)
}

export const updateMiddleConfigWorkflowId = (
  serviceId: number,
  workflowId: string
) => {
  return request.post<boolean>(
    `/api/ServiceInfo/UpdateMiddleConfigWorkflowId?serviceId=${serviceId}&workflowId=${workflowId}`
  )
}

export interface ServiceAddFormDto {
  [key: string]: any
}

export interface ServicePublishFormDto {
  [key: string]: any
}

export interface ServiceUpdateFormDto {
  [key: string]: any
}

export interface ServiceGetFormDto {
  [key: string]: any
}

export const publishServiceForm = (data: ServicePublishFormDto) => {
  return request.post<boolean>("/api/ServiceInfo/ServicePublishForm", data)
}

export const updateServiceForm = (data: ServiceUpdateFormDto) => {
  return request.post<boolean>("/api/ServiceInfo/UpdaeServiceForm", data)
}

export const getServiceForms = (serviceCode?: string) => {
  return request.get<ServiceGetFormDto[]>(
    `/api/ServiceInfo/GetServiceForms/${serviceCode || ""}`
  )
}

export interface ServiceCertificateTemplate {
  id: number
  nameEn: string
  nameAr: string
  code: string
  contentHtml: string
  icon?: string | null
  templateUrl?: string
  description?: string
  isActive: boolean
  createdAt?: string
  updatedAt?: string
}

export const getServiceCertificateTemplate = () => {
  return request.get<ServiceCertificateTemplate[]>(
    "/api/ServiceCertificate/GetServiceCertificateTemplate"
  )
}

export const getServiceOnlyParent = () => {
  return request.get<ServiceInfoDetail[]>(
    "/api/ServiceInfo/GetServiceOnlyParent"
  )
}

interface IAddCertificateParams {
  serviceId: number
  templateId: number
  nameEn: string
  nameAr: string
  validityPeriod: string
  status: string
  isUnifiedExpiry: boolean
}
export const addServiceCertificate = (params: IAddCertificateParams) => {
  return request.post("/api/ServiceCertificate", params)
}
export const prePublishService = () => {
  return request.post("/api/ServiceInfo/UpdateStatus", {
    Status: 64,
  })
}

export const publishService = () => {
  return request.post("/api/ServiceInfo/UpdateStatus", {
    Status: 65,
  })
}

export interface ServiceSaveForminterface {
  serviceId: number
  title: string
  description: string
  formsData: string
  status?: string
  version?: string
  createdAt?: string
  updatedAt?: string
  stepNameEN: string
  stepNameAR: string
  code: string
  stepId: number
}
export const ServiceSaveForm = (data?: ServiceSaveForminterface) => {
  return request.post<boolean>("/api/ServiceInfo/ServiceSaveForm", data)
}
export interface UpdateFormStepinterface {
  id: number
  stepNameEN: string
  stepNameAR: string
  code: string
  serviceId: number
  formId?: string | number | null
}
export interface AddFormStepinterface {
  id: number
  NameEN: string
  NameAR: string
  code: string
  serviceId: number
}
export const UpdateFormStep = (data?: UpdateFormStepinterface) => {
  return request.post<boolean>("/api/ServiceInfo/UpdateFormStep", data)
}
export const getFormStepList = (serviceId?: number) => {
  return request.get(`/api/ServiceInfo/GetFormStepList/${serviceId || ""}`)
}
export const AddFormStep = (data?: AddFormStepinterface) => {
  return request.post<boolean>("/api/ServiceInfo/AddFormStep", data)
}
export const delFormStep = (id: string | number) => {
  return request.delete<SaveSortResponse>(
    `/api/ServiceInfo/DeleteFormStep/${id}`
  )
}
export const DocumentDowload = (fileName?: string) => {
  return request.get(`/api/Document/Dowload?fileName=${fileName || ""}`)
}

export const documentUpload = (files: FormData) => {
  return request.post("/api/Document/Upload", files, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  })
}

export const getServiceCategories = () =>
  request.get<ServiceCategory[]>("/api/ServiceCategories")

export function getEconomicActivitys(feeLinkedServiceCode: string) {
  return request.get(
    `/api/ServiceInfo/GetEconomicActivitys?ServiceCode=${feeLinkedServiceCode}`
  )
}

export function createServiceFee(data: any) {
  return request.post("/api/ServiceFree/CreateServiceFee", data)
}

export function putUpdateServiceFee(id: number, data: any) {
  return request.put(`/api/ServiceFree/UpdateServiceFee/${id}`, data)
}

export function postDuplicate(servieId: number) {
  return request.post(`/api/ServiceInfo/${servieId}/Duplicate`)
}

interface IGetMainHaveChildrenRequest {
  serviceId: number;
  typeCode: string;
  childServiceCode?: string;
}

export function getMainHaveChildren(params: IGetMainHaveChildrenRequest){
  return request.get(`/api/ServiceInfo/GetMainHaveChildren`, params)
}
export interface IServiceHistoryBackUpsRequest{
  pageIndex: number;
  pageSize: number;
  keyword?: string;
}
interface IServiceHistoryBackUpsData{
  serviceId: number;
  serviceCode: string;
  version: string;
  isCurrentVersion: boolean;
  updateAt: string;
  updateName: string;
  updateTime: string;
  text: string;
}
export interface IServiceHistoryBackUpsResponse{
  totalPage: number;
  currentPage: number;
  totalItems: number;
  itemsPerPage: number;
  totalAmount: number;
  items: IServiceHistoryBackUpsData[];
}
export function getServiceHistoryBackUps(serviceCode: string, data: IServiceHistoryBackUpsRequest){
  return request.get<IServiceHistoryBackUpsResponse>(`/api/ServiceInfo/GetServiceHistoryBackUps/${serviceCode}`, data)
}
export interface IServiceCurrentVersionResponse{
  serviceId: number;
  serviceCode: string;
  version: string;
  isCurrentVersion: boolean;
  updateAt: string;
  updateName: string;
  updateTime: string;
  text: string;
}
export function getServiceCurrentVersion(serviceCode: string){
  return request.get<IServiceCurrentVersionResponse>(`/api/ServiceInfo/GetServiceCurrentVersion/${serviceCode}`)
}

export function getServiceRestore(serviceId: number){
  return request.get(`/api/ServiceInfo/Restore/${serviceId}`)
}

export type ServiceEngineKind = "rule" | "fee" | "penalty"

export type ServiceEngineConfigMode = "engine" | "simple"

export type ServicePricingSource = "engine" | "manual"

export type ServiceManualPricingType = "free" | "paid"

export type ServiceEngineStatusValue =
  | "Ready"
  | "Blocked"
  | "Unavailable"
  | "NotApplicable"
  | "Disabled"
  | (string & {})

export interface ServiceEngineConfig {
  serviceId: number
  configMode?: ServiceEngineConfigMode | null
  rowVersion?: string | null
  businessRule?: {
    enabled?: boolean | null
    version?: string | null
  } | null
  pricingRule?: {
    source?: ServicePricingSource | null
    manualPricingType?: ServiceManualPricingType | null
    feeEngineVersion?: string | null
    manualPricingReady?: boolean | null
    details?: ServiceManualPricingDetail[] | null
  } | null
  penaltyRule?: {
    enabled?: boolean | null
    version?: string | null
  } | null
  ruleEnabled: boolean
  ruleVersion: string | null
  feeEnabled: boolean
  feeVersion: string | null
  penaltyEnabled: boolean
  penaltyVersion: string | null
  serviceFeeAmount?: number | null
  createdAt?: string | null
  createdBy?: string | null
  updatedAt?: string | null
  updatedBy?: string | null
}

export interface ServiceManualPricingDetail {
  userTypeCode: string
  amount: number | null
  currencyCode: string
}

export interface ServiceEngineConfigPayload {
  configMode: ServiceEngineConfigMode
  businessRuleEnabled: boolean
  businessRuleVersion: string | null
  pricingSource: ServicePricingSource
  manualPricingType: ServiceManualPricingType | null
  manualPricingDetails: ServiceManualPricingDetail[]
  feeEngineVersion: string | null
  penaltyRuleEnabled: boolean
  penaltyVersion: string | null
  rowVersion?: string | null
  ruleEnabled?: boolean
  ruleVersion?: string | null
  feeEnabled?: boolean
  feeVersion?: string | null
  penaltyEnabled?: boolean
}

export interface ServiceEngineBaseReadiness {
  serviceId: number
  enabled: boolean
  status: ServiceEngineStatusValue
  canPublish: boolean
  expectedVersion: string | null
  activeVersion: string | null
  blockingReasons: string[]
  scopeSummaryMarkdown: string | null
  scopeSummary?: string | null
}

export interface ServiceRuleReadiness extends ServiceEngineBaseReadiness {
  expectedMatchesActive: boolean | null
  implementationStatus: number | null
}

export interface ServiceFeeReadiness extends ServiceEngineBaseReadiness {
  expectedMatchesActive: boolean | null
  pricingSource?: ServicePricingSource | null
  manualPricingType?: ServiceManualPricingType | null
  manualPricingReady?: boolean | null
}

export interface ServicePenaltyReadiness extends ServiceEngineBaseReadiness {
  penaltyStatus: number | null
  supportedScenarios: string[]
}

export type ServiceEngineReadinessResult =
  | ServiceRuleReadiness
  | ServiceFeeReadiness
  | ServicePenaltyReadiness

interface ServiceEngineReadinessMap {
  rule: ServiceRuleReadiness
  fee: ServiceFeeReadiness
  penalty: ServicePenaltyReadiness
}

export interface ServiceRuleEngineStatus {
  enabled: boolean
  endpointAvailable: boolean
  configuredVersion: string | null
  activeVersion: string | null
  implementationStatus: number | null
  supportsActions: number[]
  scopeSummary: string | null
  isPublishReady: boolean | null
  activatedAt: string | null
  activatedBy: string | null
  errorMessage: string | null
}

export interface ServiceFeeEngineStatus {
  enabled: boolean
  endpointAvailable: boolean
  configuredVersion: string | null
  activeVersion: string | null
  implementationStatus: number | null
  supportsActions: number[]
  feeMode: number | null
  scopeSummary: string | null
  isPublishReady: boolean | null
  activatedAt: string | null
  activatedBy: string | null
  errorMessage: string | null
}

export interface ServicePenaltyEngineStatus {
  enabled: boolean
  endpointAvailable: boolean
  configuredVersion: string | null
  activeVersion: string | null
  penaltyStatus: number | null
  supportedScenarios: string[]
  canPublish: boolean | null
  activatedAt: string | null
  activatedBy: string | null
  errorMessage: string | null
}

export interface ServiceEngineStatusResponse {
  serviceId: number
  configuredVersions: ServiceEngineConfig
  ruleEngine: ServiceRuleEngineStatus
  feeEngine: ServiceFeeEngineStatus
  penaltyEngine: ServicePenaltyEngineStatus
}

export interface ServicePublishReadinessResponse {
  serviceId: number
  configMode?: ServiceEngineConfigMode | null
  canPublish: boolean
  overallStatus: ServiceEngineStatusValue
  blockingReasons: string[]
  ruleEngine: ServiceRuleReadiness
  feeEngine: ServiceFeeReadiness
  penaltyEngine: ServicePenaltyReadiness
}

const ENGINE_CONFIG_PROXY_PREFIX = ""

const getEngineConfigBaseUrl = (serviceCode: string | number) =>
  `${ENGINE_CONFIG_PROXY_PREFIX}/api/admin/services/${serviceCode}/engine-config`

const getEngineConfigRequestConfig = (skipErrorMessage = false) =>
  import.meta.env.DEV ? { baseURL: undefined, skipErrorMessage } : { skipErrorMessage }

export const getServiceEngineConfig = (serviceCode: string | number) => {
  return request.get<ServiceEngineConfig>(
    getEngineConfigBaseUrl(serviceCode),
    {},
    getEngineConfigRequestConfig(true)
  )
}

export const saveServiceEngineConfig = (
  serviceCode: string | number,
  data: ServiceEngineConfigPayload
) => {
  return request.put<ServiceEngineConfig>(
    getEngineConfigBaseUrl(serviceCode),
    data,
    getEngineConfigRequestConfig()
  )
}

export const getServiceEngineReadiness = <T extends ServiceEngineKind>(
  serviceCode: string | number,
  engine: T,
  expectedVersion: string
) => {
  return request.get<ServiceEngineReadinessMap[T]>(
    `${getEngineConfigBaseUrl(serviceCode)}/${engine}/readiness`,
    { expectedVersion },
    getEngineConfigRequestConfig()
  )
}

export const getServiceEngineVersions = (serviceCode: string | number) => {
  return request.get<ServiceEngineConfig>(
    `${getEngineConfigBaseUrl(serviceCode)}/versions`,
    {},
    getEngineConfigRequestConfig()
  )
}

export const getServiceEngineStatus = (serviceCode: string | number) => {
  return request.get<ServiceEngineStatusResponse>(
    `${getEngineConfigBaseUrl(serviceCode)}/status`,
    {},
    getEngineConfigRequestConfig()
  )
}

export const getServicePublishReadiness = (serviceCode: string | number) => {
  return request.get<ServicePublishReadinessResponse>(
    `${getEngineConfigBaseUrl(serviceCode)}/readiness`,
    {},
    getEngineConfigRequestConfig()
  )
}

export function getSerivceRuleStatus(id: number | string){
  return request.get(`/api/rule-strategies/GetSerivceRuleAsync/${id}`)
}

export function saveServiceRule(data: any) {
  return request.post(`/api/rule-strategies/AddServiceRuleAsync`, data)
}

export function IsExistingCodes(code: string, type: string, id = "") {
  const q = new URLSearchParams({
    code,
    type,
    id: String(id ?? "").trim(),
  });
  return request.get(`/api/ServiceInfo/IsExistingCodes?${q.toString()}`);
}
