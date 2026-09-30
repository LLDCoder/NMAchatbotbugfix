import request from "@/utils/request";

export interface TypeDictionary {
  id: number;
  code: string;
  scope: string;
  nameEn: string;
  nameAr: string;
  isShown: boolean;
  descAr: string | null;
  descEn: string | null;
}

export interface TypeDictionaryResponse {
  isSuccess?: boolean;
  statusCode?: number;
  message?: string;
  data: TypeDictionary[];
}

const typeDictionaryCache: Record<string, TypeDictionary[]> = {};
const pendingTypeDictionaryRequests: Record<
  string,
  Promise<TypeDictionaryResponse> | undefined
> = {};

const hasCachedTypeDictionary = (type: string) =>
  Object.prototype.hasOwnProperty.call(typeDictionaryCache, type);

export const getTypeDictionaries = (
  type: string
): Promise<TypeDictionaryResponse> => {
  if (hasCachedTypeDictionary(type)) {
    return Promise.resolve({ data: typeDictionaryCache[type] });
  }

  const pendingRequest = pendingTypeDictionaryRequests[type];
  if (pendingRequest) {
    return pendingRequest;
  }

  const requestPromise = request
    .get<TypeDictionary[], TypeDictionaryResponse>(
      `/api/TypeDictionary/GetTypeDictionaries/${type}`
    )
    .then((res) => {
      const data = Array.isArray(res?.data) ? res.data : [];
      typeDictionaryCache[type] = data;
      return { ...res, data };
    })
    .finally(() => {
      pendingTypeDictionaryRequests[type] = undefined;
    });

  pendingTypeDictionaryRequests[type] = requestPromise;
  return requestPromise;
};

export const GetNationalityList = () => {
  return request.get<TypeDictionary[]>(
    `/api/UserManagement/GetNationalityList`
  );
};

export const GetPorts = () => {
  return request.get<TypeDictionary[]>(`/api/ServiceInfo/GetPorts`);
};
