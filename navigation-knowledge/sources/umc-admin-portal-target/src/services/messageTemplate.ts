import request from "@/utils/request";

export interface TypeDictionary {
  id: number;
  code: string;
  scope: string;
  nameEn: string;
  nameAr: string;
  isShown: boolean;
  descAr: string;
  descEn: string;
}

export interface MessageTemplateDetail {
  id: number;
  templateCode: string;
  templateNumber?: string;
  templateName: string;
  protalType: string;
  description: string;
  channels: string;
  emailSubjectEn: string;
  emailSubjectAr: string;
  emailBodyEn: string;
  emailBodyAr: string;
  smsen: string;
  smsar: string;
  smsTitleEn?: string;
  smsTitleAr?: string;
  inAppTitleEn: string;
  inAppTitleAr: string;
  inAppMessageEn: string;
  inAppMessageAr: string;
  expireTime: string;
  relatedId: string;
  pushTime: string;
  updateAt?: string;
  updateOn: string;
  // Broadcast-specific fields (may be undefined for some templates)
  subjectEn?: string;
  subjectAr?: string;
  userTypeCode?: string;
  departments?: string;
  publishType?: string;
  pulishType?: string;
  recipients?: string;
  // Extra metadata from API
  status?: number | string;
  protalTypeInfo?: Array<{ code: string; name: string }>;
  channelsInfo?: Array<{ code: string; name: string }>;
  userTypeCodeInfo?: Array<{ code: string; name: string }>;
  departmentsInfo?: Array<{ id: number; nameEn: string }>;
  createOn?: string;
  createOnInfo?: { code?: string; name?: string };
  updateOnInfo?: { code?: string; name?: string };
}

export interface GetTemplateByIdResponse {
  statusCode: number;
  message: string;
  data: MessageTemplateDetail;
}

export const getMessageTemplateById = (
  id: number | string,
  type?: string,
) => {
  return request.get<GetTemplateByIdResponse, GetTemplateByIdResponse>(
    "/api/SignalR/GetTemplateById",
    { id, type },
  );
};

export interface GetTemplateListParams {
  type: string;
  pageIndex: number;
  pageSize: number;
  keyWorld?: string | null;
  status?: string | null;
  channels?: string | null;
  protalType?: string | null;
  userTypeCodes?: string[];
  departmentIds?: number[];
  startDate?: string;
  endDate?: string;
}

export interface MessageTemplateListItem {
  id: number;
  templateCode: string;
  templateName: string;
  protalType: string;
  description: string;
  channels: string;
  updateOn: string;
  createOnInfo?: { code?: string; name?: string };
  updateOnInfo?: { code?: string; name?: string };
  modifiedBy?: string;
  role?: string;
  status?: number | string | null;
  pushTime?: string;
  expireTime?: string;
  protalTypeInfo?: Array<{ code: string; name: string }>;
  channelsInfo?: Array<{ code: string; name: string }>;
  userTypeCodeInfo?: Array<{ code: string; name: string }>;
  departmentsInfo?: Array<{ id: number; nameEn: string; name?: string }>;
}

export interface GetTemplateListData {
  totalPage?: number;
  currentPage?: number;
  totalItems: number;
  itemsPerPage?: number;
  items: MessageTemplateListItem[];
}

export interface GetTemplateListResponse {
  statusCode: number;
  message: string;
  data: GetTemplateListData;
}

export const getMessageTemplateList = (params: GetTemplateListParams) => {
  return request.post<GetTemplateListResponse>(
    "/api/SignalR/GetTemplateList",
    params
  );
};

export type UpdateMessageTemplateParams = MessageTemplateDetail;

export interface SaveTemplateResponse {
  isSuccess?: boolean;
  statusCode: number;
  message: string;
  data?: boolean;
}

export type BroadcastSendResponse =
  | boolean
  | {
      isSuccess?: boolean;
      statusCode?: number;
      message?: string;
      data?: boolean;
    };

export const updateMessageTemplate = (data: UpdateMessageTemplateParams) => {
  return request.post<SaveTemplateResponse, SaveTemplateResponse>(
    "/api/SignalR/UpdateTemplate",
    data
  );
};

// Broadcast save payload (UpdateTemplate / AddTemplate)
export interface BroadcastTemplatePayload {
  id?: number; // optional for AddTemplate
  subjectEn?: string;
  subjectAr?: string;
  templateCode?: string;
  userTypeCode?: string;
  departments?: string;
  templateName?: string;
  publishType?: string;
  pulishType?: string;
  protalType?: string;
  recipients?: string;
  description?: string;
  channels?: string;
  emailSubjectEn?: string;
  emailSubjectAr?: string;
  emailBodyEn?: string;
  emailBodyAr?: string;
  smsen?: string;
  smsar?: string;
  inAppTitleEn?: string;
  inAppTitleAr?: string;
  inAppMessageEn?: string;
  inAppMessageAr?: string;
  expireTime?: string;
  relatedId?: string;
  pushTime?: string;
  createOn?: string;
  updateOn?: string;
  type?: string;
  showBox?: boolean;
  emailLayoutCode?: string;
}

export type BroadcastOperation = "DraftAndTest" | "Publish";

export interface BroadcastSendPayload extends BroadcastTemplatePayload {
  operation: BroadcastOperation;
  id?: number;
}

export const sendBroadcastByNow = (data: BroadcastSendPayload) => {
  return request.post<BroadcastSendResponse, BroadcastSendResponse>(
    "/api/Broadcast/send",
    data,
  );
};

export const updateBroadcastTemplate = (data: BroadcastTemplatePayload) => {
  return request.post<SaveTemplateResponse, SaveTemplateResponse>(
    "/api/SignalR/UpdateTemplate",
    data
  );
};

export const addBroadcastTemplate = (data: BroadcastTemplatePayload) => {
  return request.post<BroadcastSendResponse, BroadcastSendResponse>(
    "/api/Broadcast/publish",
    data
  );
};

export const testBroadcastTemplate = (templateId: number) => {
  return request.post<BroadcastSendResponse, BroadcastSendResponse>(
    "/api/SignalR/SendToUsersBySystemTest",
    { templateId }
  );
};

export const unpublishBroadcastTemplate = (id: number | string) => {
  return request.post<BroadcastSendResponse, BroadcastSendResponse>(
    "/api/Broadcast/unpublish",
    { id }
  );
};

// http://192.168.2.24:5005/api/TypeDictionary/GetTypeDictionaries/1

export const getTypeDictionariesByScope = (scope: string) => {
  return request.post<TypeDictionary[]>(
    `/api/SignalR/GetTypeDictionaries/${scope}`
  );
};
export const getTypeDictionaries = (scope: string) => {
  return request.get<TypeDictionary[]>(
    `/api/TypeDictionary/GetTypeDictionaries/${scope}`
  );
};
export const getTemplateTypeDictionaryByScope = (scope: string) => {
  return request.post<TypeDictionary[]>(
    `/api/SignalR/GetTypeDictionaryByScope/${scope}`
  );
};

export const getUserTypes = () => {
  return request.get<TypeDictionary[]>("/api/SignalR/GetUserTypes");
};
