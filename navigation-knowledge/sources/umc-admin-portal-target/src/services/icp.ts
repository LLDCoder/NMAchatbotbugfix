import request from "@/utils/request";
export const getIcpPerson = (eid: string) => {
  // P8 Plan A: route through the gateway (relative /api). The gateway maps /api/icp/* to the
  // admin portal service; the frontend no longer hardcodes a per-service base URL.
  return request.get(`/api/icp/person?emiratesId=${eid}`);
};

export interface IcpApplicantDescribedEntity {
  Id?: number | string | null;
  DescriptionArabic?: string | null;
  DescriptionEnglish?: string | null;
}

export interface IcpApplicantName {
  FullNameArabic?: string | null;
  FullNameEnglish?: string | null;
  FamilyNameArabic?: string | null;
  FamilyNameEnglish?: string | null;
}

export interface IcpApplicantIdentityCard {
  EmiratesId?: string | null;
  IssueDate?: string | null;
  ExpiryDate?: string | null;
}

export interface IcpApplicantPassport {
  PassportNo?: string | null;
  IssuePlace?: string | null;
  IssueCountry?: IcpApplicantDescribedEntity | null;
  IssueDate?: string | null;
  ExpiryDate?: string | null;
}

export interface IcpApplicantAddress {
  Emirate?: IcpApplicantDescribedEntity | null;
  City?: IcpApplicantDescribedEntity | null;
  Area?: IcpApplicantDescribedEntity | null;
  Street?: IcpApplicantDescribedEntity | string | null;
  BuildingNumber?: string | null;
  Building?: string | null;
  HomePhone?: string | null;
  MobileNo?: string | null;
  WorkPhone?: string | null;
}

export interface IcpApplicantSponsor {
  NameEnglish?: string | null;
  NameArabic?: string | null;
  Addresses?: IcpApplicantAddress[] | null;
}

export interface IcpApplicantQualification {
  AcademyName?: string | null;
  Specialization?: IcpApplicantDescribedEntity | null;
  Grade?: string | null;
}

export interface IcpApplicantImmigrationFile {
  FileNo?: string | null;
  IssueDate?: string | null;
  ExpiryDate?: string | null;
}

export interface IcpApplicantWife {
  Name?: IcpApplicantName | null;
  Nationality?: IcpApplicantDescribedEntity | null;
  BirthDate?: string | null;
}

export interface IcpApplicantRelative {
  Relation?: IcpApplicantDescribedEntity | null;
  Name?: IcpApplicantName | null;
  NameEnglish?: string | null;
  nameEnglish?: string | null;
  Employer?: string | null;
  employer?: string | null;
  Nationality?: IcpApplicantDescribedEntity | null;
  BirthDate?: string | null;
}

export interface IcpApplicantFriend {
  NameEnglish?: string | null;
  nameEnglish?: string | null;
  NameArabic?: string | null;
  nameArabic?: string | null;
  Employer?: string | null;
  employer?: string | null;
}

export interface IcpApplicantChild {
  EmiratesId?: string | null;
}

export interface IcpApplicantPersonProfile {
  UnifiedNumber?: string | null;
  IdentityCard?: IcpApplicantIdentityCard | null;
  Nationality?: IcpApplicantDescribedEntity | null;
  PreviousNationality?: IcpApplicantDescribedEntity | null;
  PersonName?: IcpApplicantName | null;
  Gender?: IcpApplicantDescribedEntity | null;
  BirthDate?: string | null;
  BirthPlaceEnglish?: string | null;
  BirthCountry?: IcpApplicantDescribedEntity | null;
  BirthCity?: IcpApplicantDescribedEntity | null;
  MaritalStatus?: IcpApplicantDescribedEntity | null;
  Religion?: IcpApplicantDescribedEntity | null;
  Faith?: IcpApplicantDescribedEntity | null;
  Occupation?: IcpApplicantDescribedEntity | null;
  PrimaryLangCode?: number | string | null;
  LastEntryDate?: string | null;
  Passport?: IcpApplicantPassport | null;
  Sponsor?: IcpApplicantSponsor | null;
  ImmigrationFile?: IcpApplicantImmigrationFile | null;
  Qualification?: IcpApplicantQualification | null;
  MotherNameEnglish?: string | null;
  MotherChildCount?: number | string | null;
  MotherChildren?: IcpApplicantChild[] | null;
  Wives?: IcpApplicantWife[] | null;
  Relatives?: IcpApplicantRelative[] | null;
  Friends?: IcpApplicantFriend[] | null;
  Addresses?: IcpApplicantAddress[] | null;
  Signature?: string | null;
}

export interface ApplicantProfileResponse {
  TransactionRefNo?: string | null;
  ResponseCode?: string | null;
  ResponseDescription?: string | null;
  ResponseDescriptionArabic?: string | null;
  PersonProfile?: IcpApplicantPersonProfile | null;
}

export interface ApplicantProfileEnvelope {
  Success?: boolean | null;
  Source?: string | null;
  ProfileId?: number | string | null;
  Key?: string | null;
  Profile?: ApplicantProfileResponse | null;
}

export const getApplicantProfile = (profileId: string | number) => {
  return request.get<ApplicantProfileEnvelope, ApplicantProfileEnvelope>(
    `/api/icp/applicant-profile/?eid=${encodeURIComponent(String(profileId))}`,
  );
};

export interface IcpPersonApiBody {
  data: {
    personProfile: {
      personName: { fullNameEnglish?: string; fullNameArabic?: string }
      addresses: Array<{ emailAddress?: string }>
    }
  }
}
export const getEmiratesIdInfotickets = (
  emiratesId: string,
  dateOfBirth: string,
  config: Record<string, unknown> = {},
) => {
  return request.get<IcpPersonApiBody, IcpPersonApiBody>(
    "api/icp/person-tickets",
    { emiratesId, dateOfBirth },
    config,
  );
};

