import request from "@/utils/request";
interface IPageData<T extends Record<string, any>> {
  currentPage: number;
  itemsPerPage: number;
  totalItems: number;
  items: T[];
}
interface IQueryJob {
  pageIndex: number;
  pageSize: number;
  keyWords?: string;
  status?: string;
  StartTime: string | null;
  EndTime: string | null;
}
interface IQueryNews {
  pageIndex: number;
  pageSize: number;
  keyWords?: string;
  status?: string;
  updateTime1?: string | null;
  updateTime2?: string | null;
  publishtime1?: string | null;
  publishtime2?: string | null;
  sortBy?: string;
  sortDirection?: 0 | 1;
}
interface IQueryEvent {
  pageIndex: number;
  pageSize: number;
  keyWords?: string;
  status?: string;
  stime: string | null;
  etime: string | null;
  updateTime1?: string | null;
  updateTime2?: string | null;
  publishtime1?: string | null;
  publishtime2?: string | null;
  EventType?: string | null;
}
interface IAddNewsParams {
  imageUrl: string;
  titleEn: string;
  titleAr: string;
  contentEn: string;
  contentAr: string;
  seotitle: string;
  seodescription: string;
  seokeyWords: string;
  userId: string;
  status: string;
}

interface IInfo {
  id: number;
  code: string;
  name: string;
  nameEn?: string;
  nameAr?: string;
}

interface INewsItem {
  id: number;
  newsNo: string;
  imageUrl: string;
  titleEn: string;
  titleAr: string;
  contentEn: string;
  contentAr: string;
  seotitle: string;
  seodescription: string;
  seokeyWords: string;
  createOn: string;
  createOnInfo: IInfo;
  createAt: string;
  updateOn: string;
  updateOnInfo: IInfo;
  updateAt: string;
  rejectedReason: string;
  pinned: string;
  sort: number;
  status: string;
  statusInfo: IInfo;
  publishTime?: string;
}

interface INewsCount {
  totalNews: number;
  published: number;
  pendingReview: number;
  draft: number;
  rejected: number;
  unpublished: number;
  scheduled: number;
}

interface ReviewData {
  id: number;
  status: number;
  reason?: string;
};

type IPinnedNewsItem = Omit<INewsItem, "statusInfo">;
type TAddNewsRes = IPinnedNewsItem;

type TPageForNews = IPageData<INewsItem>;

export type {
  INewsItem,
  IPinnedNewsItem,
  IQueryNews,
  IQueryEvent,
  INewsCount,
  IAddNewsParams,
  IQueryJob,
};
// CMS banner
interface Cover {
  type: string;
  url: string;
}

// interface any {
//   en: string;
//   ar: string;
// }

interface Button {
  enabled: boolean;
  label: any;
  link: string;
}
interface Highlight {
  isOpen?: boolean;
  title: any;
  description: any;
}
interface PartnershipItem {
  isOpen?: boolean;
  logo: string;
  link: string;
}
export interface BannerItem {
  id?: number;
  isOpen?: boolean;
  order: number;
  enabled: boolean;
  cover: Cover;
  mobileCover?: Cover;
  title: any;
  description: any;
  primaryButton: Button;
  secondaryButton: Button;
}
export interface AboutParam {
  title: any;
  subTitle: any;
  description: any;
  button: Button;
  highlights: Highlight[];
  images: string[];
}
export interface PartnershipParam {
  partners: PartnershipItem[];
  label: any;
  link: string;
}

export interface PulishedPageParam {
  pageIndex: number;
  pageSize: number;
  keyWords?: string;
  startTime?: string | null;
  endTime?: string | null;
  status?: string;
}
export interface FooterParam {
  contactCard: {
    title: any;
    // Bilingual since the PRD update; legacy data may still be a plain string
    // and is migrated on load (see PageManagementHome getPageDetail).
    businessHours: { en: string; ar: string };
    phoneNumber: string;
    whatsApp: string;
    locationLink: string;
  };
  socialMedia: {
    facebook: boolean;
    facebookLink: string;
    instagram: boolean;
    instagramLink: string;
    youTube: boolean;
    youTubeLink: string;
    x: boolean;
    xLink: string;
    linkedIn: boolean;
    linkedInLink: string;
  };
}

// CMS Home
interface HomeNmaParam {
  banner: {
    pageCode: string;
    moduleCode: string;
    config: {
      items: BannerItem[];
    }
  };
  about: {
    pageCode: string;
    moduleCode: string;
    config: AboutParam;
  };
  partnership: {
    pageCode: string;
    moduleCode: string;
    config: PartnershipParam;
  };
  footer: {
    pageCode: string;
    moduleCode: string;
    config: FooterParam;
  };
  auditStatus: number;
  isDraft: boolean;
}
// CMS About 
export interface AboutFormParam {
  image: string;
  title: any;
  description: any;
  responsibilities: {
    title: any;
    description: any;
    isOpen?: boolean;
  }[];
};

// CMS Leadership
export interface ChairmanParam {
  image: string;
  position: any;
  fullName: any;
  positionDescription: any;
};
export interface DirectorParam {
  title: any;
  members: {
    image: string;
    isOpen?: boolean;
    fullName: any;
    positionDescription: any;
  }[]
};
export interface ManagementParam {
  title: any;
  memberOne: {
    image: string;
    fullName: any;
    positionDescription: any;
    quote: any;
    profile: any;
  },
  memberTwo: {
    image: string;
    fullName: any;
    positionDescription: any;
    quote: any;
    profile: any;
  }
};

interface LeadershipParam {
  chairman: ChairmanParam;
  boardOfDirectors: DirectorParam;
  management: ManagementParam;
  auditStatus: number;
  isDraft: boolean;
};

export interface VisionMissionValues {
  image: string;
  vision: {
    title: any;
    description: any;
  };
  mission: {
    title: any;
    description: any;
  };
  values: {
    title: any;
    description: any;
    isOpen?: boolean;
  }[];
};

export interface StrategicObjectives {
  title: any;
  description: any;
  images: string[];
  strategies: any[];
};

export interface AboutPartnership {
  title: any;
  partners: {
    logo: string;
    link: string;
    isOpen?: boolean;
  }[];
};

interface AboutNmaParam {
  about: AboutFormParam;
  visionMissionValues: VisionMissionValues;
  strategicObjectives: StrategicObjectives;
  aboutPartnership: AboutPartnership;
  auditStatus: number;
  isDraft: boolean;
};

export const getNewsList = async (data: IQueryNews) =>
  request.get<TPageForNews>("/api/News/GetCmsNewsListAsync", data);
export const getEventList = async (data: IQueryEvent) =>
  request.get<TPageForNews>("/api/Event/GetCmsEventAllAsync", data);

export const getNewsCount = async () =>
  request.get<INewsCount>("/api/News/GetNewsCount");

export const getNewsTypeDictionaries = async (scope: string) =>
  request.get<{ code: string; nameEn: string; nameAr: string }[]>(
    `/api/News/GetTypeDictionariesAsync/${scope}`,
  );
export const getEventCount = async () =>
  request.get<INewsCount>("/api/Event/GetCmsEventCountAsync");
export const GetCmsEventCountAsync = async () =>
  request.get<INewsCount>("/api/Job/GetStatusStatisticsAsync");

export const addNewsAsync = async (data: IAddNewsParams) =>
  request.post<TAddNewsRes>("/api/News/AddAsync", data);
export const addEventAsync = async (data: IAddNewsParams) =>
  request.post<TAddNewsRes>("/api/Event/AddAsync", data);

export const GetBanner = async () =>
  request.post<{ items: BannerItem[] }>("/api/home/GetBanner");
export const getPinList = async (keyWord: string) =>
  request.get<IPinnedNewsItem[]>(`/api/News/GetPinList?keyWords=${keyWord}`);
export const getUnPinList = async (keyWord: string) =>
  request.get<IPinnedNewsItem[]>(`/api/News/GetUnPinList?keyWords=${keyWord}`);

export const GetAbout = async () =>
  request.post<AboutParam>("/api/home/GetAbout");

export const GetPartnership = async () =>
  request.post<PartnershipParam>("/api/home/GetPartnership");

export const GetFooter = async () =>
  request.post<FooterParam>("/api/home/GetFooter");

export const BannerConfig = async (data: {
  pageCode: string;
  moduleCode: string;
  config: { items: BannerItem[] };
}) => request.post("/api/config/BannerConfig", data);

export const AboutConfig = async (data: {
  pageCode: string;
  moduleCode: string;
  config: AboutParam;
}) => request.post("/api/config/AboutConfig", data);

export const PartnershipConfig = async (data: {
  pageCode: string;
  moduleCode: string;
  config: PartnershipParam;
}) => request.post("/api/config/PartnershipConfig", data);

export const FooterConfig = async (data: {
  pageCode: string;
  moduleCode: string;
  config: FooterParam;
}) => request.post("/api/config/FooterConfig", data);

export const SavePinNew = async (data: { id: number; sort: number }[]) =>
  request.post("/api/News/PinNew", data);

export const UnpinNew = async (keyWord: number) =>
  request.get(`/api/News/UnpinNew?id=${keyWord}`);

export const ApproveNew = async (keyWord: number) =>
  request.get(`/api/News/ApproveNew?id=${keyWord}`);

export const ApproveEvent = async (keyWord: number) =>
  request.get(`/api/Event/ApproveEvent?id=${keyWord}`);
export const ApproveJob = async (keyWord: number) =>
  request.get(`/api/Job/ApproveJob?id=${keyWord}`);

export const RejectNew = async (data: { id: number; reason: string }) =>
  request.post("/api/News/RejectNew", data);

export const RejectEvent = async (data: { id: number; reason: string }) =>
  request.post("/api/Event/RejectEvent", data);

export const RejectJob = async (data: { id: number; reason: string }) =>
  request.post("/api/Job/RejectJob", data);


export const DeleteAsync = async (data: { id: number }) =>
  request.post("/api/News/DeleteAsync", data);
export const DeleteEventAsync = async (data: { id: number }) =>
  request.post("/api/Event/DeleteAsync", data);
export const DeleteJob = async (keyWord: number) =>
  request.get(`/api/Job/DeleteJob?id=${keyWord}`);

export const UnPublishNew = async (keyWord: number) =>
  request.get(`/api/News/UnPublishNew?id=${keyWord}`);
export const UnPublishEvent = async (keyWord: number) =>
  request.get(`/api/Event/UnPublishEvent?id=${keyWord}`);
export const UnpublishJob = async (keyWord: number) =>
  request.get(`/api/Job/UnpublishJob?id=${keyWord}`);

export const UpdateAsync = async (data: IAddNewsParams) =>
  request.post<TAddNewsRes>("/api/News/UpdateAsync", data);
export const UpdateJobAsync = async (data: IAddNewsParams) =>
  request.post<TAddNewsRes>("/api/Job/UpdateAsync", data);

export const UpdateEventAsync = async (data: IAddNewsParams) =>
  request.post<TAddNewsRes>("/api/Event/UpdateAsync", data);

export const GetByIdAsync = async (keyWord: number) =>
  request.get(`/api/News/GetByIdAsync?id=${keyWord}`);

export const GetEventByIdAsync = async (keyWord: number) =>
  request.get(`/api/Event/GetByIdAsync?id=${keyWord}`);

export const GetJobByIdAsync = async (keyWord: number) =>
  request.get(`/api/Job/GetByIdAsync?id=${keyWord}`);

export const GetEmiratesAsync = async () =>
  request.get(`/api/Job/GetEmiratesAsync`);

export const GetJobListAsync = async (data: IQueryJob) =>
  request.get(`/api/Job/GetJobListAsync`, data);

export const GetJobTypesAsync = async () =>
  request.get(`/api/Job/GetJobTypesAsync`);
export const addJobAsync = async (data: IAddNewsParams) =>
  request.post<TAddNewsRes>("/api/Job/AddAsync", data);

export const getPulishedPageList = async (param: PulishedPageParam) =>
  request.get("/api/config/GetPulishedPageListAsync", param);

export const getPageById = async (id: number | string) =>
  request.get(`/api/config/GetByIdAsync?id=${id}`);

export const getDraftPageList = async (param: PulishedPageParam) =>
  request.get('/api/config/GetDraftPageListAsync', param);

export const aboutNmaConfig = async (data: AboutNmaParam) =>
  request.post("/api/config/AboutNmaConfig", data);

export const getAboutNMA = async () =>
  request.post('/api/home/GetAboutNMA');

export const homeConfig = async (data: HomeNmaParam) =>
  request.post("/api/config/HomeConfig", data);

export const reviewConfig = async (data: ReviewData) =>
  request.post("/api/config/review", data);

export const leadershipConfig = async (data: LeadershipParam) =>
  request.post("/api/config/LeadershipConfig", data);
