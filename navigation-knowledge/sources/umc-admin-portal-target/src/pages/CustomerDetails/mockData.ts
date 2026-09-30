import { DEFAULT_COUNTRY_DIAL_CODE } from "@/components/common/MobileNumberInput";
import type {
  ApplicationItem,
  AppealItem,
  DocumentItem,
  InfoItem,
  LicenseItem,
  OverviewRowItem,
  PaymentItem,
  ProfileItem,
  RefundItem,
  TicketItem,
  ViolationFineItem,
} from "./types";

export const mockCustomerData = {
  accountId: "3112202512345",
  fullName: "James Wade",
  email: "democommercial@gmail.com",
  mobileNumber: `${DEFAULT_COUNTRY_DIAL_CODE} 50 123 4567`,
  emiratesId: "784-5546-6545654-6",
  nationality: "United Arab Emirates",
  registerTime: "2025-09-28T14:00:00",
  status: "Active",
  walletBalance: "888,000.00",
  totalSpending: "1,000,000.00",
  totalRefunds: "2,000.00",
  totalRecharge: "1,888,000.00",
};

export const mockProfiles: ProfileItem[] = [
  {
    id: "1",
    profileId: "NMA-4458",
    profileName: "BANDAI NAMCO",
    profileNameAr: "نانسي هفسندكن",
    profileType: "Commercial",
    emirate: "Dubai",
    status: "Approved",
    tier: "VIP",
    stats: {
      apps: 1,
      tickets: 1,
      refund: 1,
      appeal: 1,
      violations: 1,
      fines: 1,
    },
    createdTime: "2024-01-15T10:30:00",
  },
  {
    id: "2",
    profileId: "784-5546-6545654-6",
    profileName: "John Smith",
    profileNameAr: "جون سميت",
    profileType: "Individual",
    emirate: "Abu Dhabi",
    status: "Approved",
    tier: "Standard",
    stats: {
      apps: 1,
      tickets: 1,
      refund: 1,
      appeal: 1,
      violations: 1,
      fines: 1,
    },
    createdTime: "2024-03-20T14:20:00",
  },
  {
    id: "3",
    profileId: "NMA-4458",
    profileName: "BANDAI NAMCO",
    profileNameAr: "نانسي هفسندكن",
    profileType: "Commercial",
    emirate: "Sharjah",
    status: "Expired",
    tier: "VIP",
    stats: {
      apps: 1,
      tickets: 1,
      refund: 1,
      appeal: 1,
      violations: 1,
      fines: 1,
    },
    createdTime: "2024-05-10T09:15:00",
  },
];

export const mockProfileDetails: Record<
  string,
  {
    personalInfo: InfoItem[];
    addressInfo: InfoItem[];
    documents: DocumentItem[];
  }
> = {
  "2": {
    personalInfo: [
      {
        key: "verify-method",
        label: "Verification Method",
        value: "Emirates ID",
        span: 3,
        fullWidth: true,
      },
      { key: "date-birth", label: "Date of Birth", value: "26/04/1990" },
      {
        key: "emirates-id",
        label: "Emirates ID",
        value: "784-5546-6545654-6",
      },
      {
        key: "full-name-ar",
        label: "Full Name in Arabic",
        value: "جون سميت",
      },
      { key: "full-name-en", label: "Full Name in English", value: "John Smith" },
      {
        key: "nationality",
        label: "Nationality",
        value: "United Arab Emirates",
      },
      { key: "gender", label: "Gender", value: "Male" },
      { key: "occupation", label: "Occupation", value: "Programmer" },
      { key: "expiry", label: "Expiry Date", value: "25/03/2029" },
    ],
    addressInfo: [
      { key: "emirate", label: "Emirate", value: "Abu Dhabi" },
      { key: "region", label: "Region", value: "Abu Dhabi" },
      { key: "area", label: "Area", value: "Map" },
      {
        key: "street",
        label: "Street",
        value: "Apt 301, Building 12, Khalifah A City, Al Salam Street",
        span: 2,
      },
    ],
    documents: [
      { key: "personal-photo", label: "Personal Photo", url: "Personal Photo.pdf" },
      { key: "emirates-id", label: "Emirates ID", url: "Emirates ID.pdf" },
    ],
  },
};

export const mockEstablishmentData = {
  establishment: {
    establishmentTypeObj: { nameEn: "Commercial" },
    workMobileNumibe: `${DEFAULT_COUNTRY_DIAL_CODE} 50 123 4321`,
    workEmail: "democommercial@business.ae",
    licenseNumber: "NMA-4458",
    licenseExpiryDate: "2028-08-09T00:00:00",
    nameEn: "BANDAI NAMCO",
    nameAr: "نانسي هفسندكن",
    emirateObj: { nameEn: "Abu Dhabi" },
    licensingAutharityId: "Abu Dhabi Department of Economic Development",
    personalMobile: "0212345678",
    tenancyContractEndDate: "2027-07-07T00:00:00",
  },
  documentInfo: {
    licenseCopyUrl: "https://example.com/files/license.jpg",
    tenancyContractCopyUrl: "https://example.com/files/tenancy.jpg",
    memorandumOfAssociationCopyUrl: "https://example.com/files/moa.jpg",
    powerOfAttorneyCopyUrl: "https://example.com/files/poa.jpg",
  },
  legalPersonal: {
    nameEn: "John Smith",
    idTypeObj: { nameEn: "Emirates ID" },
    emiratesId: "784-5546-6545654-6",
    birthDate: "1990-04-26T00:00:00",
    personalEmail: "john.smith@example.com",
  },
  addressInfo: {
    emirateObj: { nameEn: "Abu Dhabi" },
    regionObj: { nameEn: "Abu Dhabi" },
    areaObj: { nameEn: "Map" },
    streetObj: { nameEn: "Apt 301, Building 12, Khalifah A City, Al Salam Street" },
  },
  partnerList: [
    {
      id: 1,
      fullNameEn: "John Smith",
      emiratesId: "784-5546-6545654-6",
      emirateObj: { nameEn: "Abu Dhabi" },
    },
    {
      id: 2,
      fullNameEn: "Sky News Arabia",
      emiratesId: "NMA-1158",
      emirateObj: { nameEn: "Abu Dhabi" },
    },
  ],
};

export const mockApplications: ApplicationItem[] = Array.from({ length: 5 }, (_, index) => ({
  id: `${index + 1}`,
  applicationNo: `APP-2024-${String(index + 1).padStart(4, "0")}`,
  applicationType: index % 2 === 0 ? "New License" : "License Renewal",
  submissionDate: "2024-09-15T10:30:00",
  status: index === 0 ? "102" : index === 1 ? "105" : "106",
  serviceName:
    index % 3 === 0
      ? "Social Media Advertising Licens"
      : index % 3 === 1
      ? "Permit for Printing Local Media Material"
      : "Book Distribution Permit - eBooks",
  serviceCategory: "Books & Publications",
  type: index % 2 === 0 ? "Renew" : "New",
  sla: index % 5 === 0 ? "2d Overdue" : "On Time",
  submissionTime: "2025-10-30T12:25:00",
}));

export const mockPayments: PaymentItem[] = Array.from({ length: 5 }, (_, index) => ({
  id: `${index + 1}`,
  paymentId: `PAY-2024-${String(index + 1).padStart(4, "0")}`,
  amount: `AED ${(Math.random() * 1000 + 100).toFixed(2)}`,
  paymentMethod: index % 2 === 0 ? "Credit Card" : "Wallet",
  paymentDate: "2024-09-20T15:45:00",
  status: index === 0 ? "1" : "3",
  transactionNo: `283391177${index + 8413}`,
  transactionType: "Service Application",
  amountCharged: "5,000.00",
  refundCategory: "Unlicensed Media Content",
  transactionTime: "2025-10-30T12:25:00",
}));

export const mockLicenses: LicenseItem[] = [];

export const mockTickets: TicketItem[] = Array.from({ length: 10 }, (_, index) => ({
  id: `${index + 1}`,
  ticketNo: `HC-01-312-${2837654 + index}`,
  reopen: index % 4 === 0,
  type: index % 3 === 0 ? "Enquiry" : index % 3 === 1 ? "Suggestion" : "Complaint",
  applicationNo: index % 2 === 0 ? "ML-01-092-847 5683" : "-",
  serviceName:
    index % 2 === 0
      ? "Issuing commercial media"
      : "Renewal of a Commercial Media...",
  issueCategory: index % 2 === 0 ? "Business" : "Technical",
  currentHandler: index % 2 === 0 ? "James Customer Dept" : "Jack License Dept",
  status: index % 4 === 0 ? "1" : index % 4 === 1 ? "2" : index % 4 === 2 ? "3" : "4",
}));

export const mockViolationsFines: ViolationFineItem[] = Array.from(
  { length: 10 },
  (_, index) => ({
    id: `${index + 1}`,
    fineNo: `F-01-312-${2837654 + index}`,
    inspectionNo: `IN-02-231-${2332468 + index}`,
    violationType: "Unlicensed Media Content",
    fineAmount: "5,000.00",
    status:
      index % 5 === 0
        ? "Paid"
        : index % 5 === 1
        ? "Pending Payment"
        : index % 5 === 2
        ? "Under Appeal"
        : index % 5 === 3
        ? "Appeal Rejected"
        : "Appeal Approved",
    issueDate: "2025-10-30T12:25:00",
    paymentDate: "2025-10-30T12:25:00",
  })
);

export const mockRefunds: RefundItem[] = Array.from({ length: 10 }, (_, index) => ({
  id: `${index + 1}`,
  refundNo: `RF-01-312-${2837654 + index}`,
  applicationNo: `ML-01-231-${2332468 + index}`,
  amount: "5,000.00",
  refundCategory: "Unlicensed Media Content",
  status:
    index % 5 === 0
      ? "Approved"
      : index % 5 === 1
      ? "Completed"
      : index % 5 === 2
      ? "Pending Review"
      : index % 5 === 3
      ? "Rejected"
      : "Cancelled",
  requestDate: "2025-10-30",
}));

export const mockAppeals: AppealItem[] = Array.from({ length: 10 }, (_, index) => ({
  id: `${index + 1}`,
  appealNo: `AP-01-312-${2837654 + index}`,
  fineNo: `F-01-312-${2837654 + index}`,
  appealCategory: "Unlicensed Media Content",
  status:
    index % 4 === 0
      ? "Approved"
      : index % 4 === 1
      ? "Pending Review"
      : index % 4 === 2
      ? "Rejected"
      : "Cancelled",
  requestDate: "2025-10-30",
}));

export const buildMockAllOverviewRows = (): OverviewRowItem[] =>
  Array.from({ length: 10 }, (_, index) => ({
    id: `${index + 1}`,
    applicationNo: "ML-01-123-123 4567",
    serviceName:
      index % 3 === 0
        ? "Social Media Advertising Licens"
        : index % 3 === 1
        ? "Permit for Printing Local Media Material"
        : "Book Distribution Permit - eBooks",
    serviceCategory: "Books & Publications",
    type: index % 3 === 0 ? "Renew" : "New",
    finalDecision: index % 5 === 0 ? "Request Modification" : "Approved",
    sla: index % 5 === 0 ? "2d Overdue" : "On Time",
    applyFor: index % 2 === 0 ? "John" : "ABC Trading LLC",
    applyForType: index % 2 === 0 ? "individual" : "establishment",
  }));
