// Bilingual sample data for the "match the public portal" preview sections.
// Used only by the shell sections of the CMS Homepage preview that are NOT
// driven by CMS config (Services / Knowledge Hub / Media / top nav / footer
// subscribe & bottom nav). On the public portal these come from separate APIs
// or static i18n copy; the preview renders fixed bilingual placeholders that
// follow the page-local language toggle (RTL in Arabic) without any backend
// dependency. Copy is aligned with public src/localization/locales.

export type Localized = { en: string; ar: string };
export type Lan = "en" | "ar";

/** Pick a localized field: Arabic prefers ar with en fallback, and vice versa. */
export const pick = (field: Localized | undefined, lan: string): string => {
  if (!field) return "";
  const isAr = (lan || "en").startsWith("ar");
  return isAr ? field.ar || field.en : field.en || field.ar;
};

/** Shared UI copy for the sections (titles / buttons, etc.) */
export const ui = {
  services: {
    title: { en: "SERVICES", ar: "الخدمات" },
    viewAll: { en: "View All", ar: "عرض الكل" },
    learnMore: { en: "Learn More", ar: "اعرف المزيد" },
    startService: { en: "Start Service", ar: "بدء الخدمة" },
  },
  knowledgeHub: {
    title: { en: "KNOWLEDGE HUB", ar: "مركز المعرفة" },
  },
  media: {
    title: { en: "MEDIA", ar: "الإعلام" },
    viewAll: { en: "View All", ar: "عرض الكل" },
    newsTab: { en: "News", ar: "الأخبار" },
    eventsTab: { en: "Events", ar: "الفعاليات" },
  },
  login: { en: "Login", ar: "تسجيل الدخول" },
  trackRequest: {
    title: {
      en: "Track Public Service Application",
      ar: "تتبع طلب الخدمة العامة",
    },
    placeholder: { en: "Search request number", ar: "ابحث برقم الطلب" },
  },
  subscribe: {
    title: { en: "Subscribe Newsletter", ar: "اشترك في النشرة الإخبارية" },
    desc: {
      en: "Keep updated with the latest information from UAEMC",
      ar: "تابع آخر المستجدات من مجلس الإمارات للإعلام",
    },
    placeholder: { en: "Email Address", ar: "عنوان البريد الإلكتروني" },
    button: { en: "Subscribe", ar: "اشترك" },
  },
};

/** Services — category tabs (including All) */
export const serviceCategories: { id: number; name: Localized }[] = [
  { id: 0, name: { en: "All", ar: "الكل" } },
  { id: 1, name: { en: "Media Licensing", ar: "ترخيص الإعلام" } },
  { id: 2, name: { en: "Content Permits", ar: "تصاريح المحتوى" } },
  { id: 3, name: { en: "Accreditation", ar: "الاعتماد" } },
  { id: 4, name: { en: "Complaints", ar: "الشكاوى" } },
];

/** Services — service cards (iconIndex maps to Frame1..4) */
export const services: {
  id: number;
  categoryId: number;
  iconIndex: number;
  name: Localized;
  category: Localized;
}[] = [
  {
    id: 1,
    categoryId: 1,
    iconIndex: 0,
    name: { en: "Media Content License", ar: "رخصة محتوى إعلامي" },
    category: { en: "Media Licensing", ar: "ترخيص الإعلام" },
  },
  {
    id: 2,
    categoryId: 2,
    iconIndex: 1,
    name: { en: "Print Media Permit", ar: "تصريح إعلام مطبوع" },
    category: { en: "Content Permits", ar: "تصاريح المحتوى" },
  },
  {
    id: 3,
    categoryId: 3,
    iconIndex: 2,
    name: { en: "Journalist Accreditation", ar: "اعتماد صحفي" },
    category: { en: "Accreditation", ar: "الاعتماد" },
  },
  {
    id: 4,
    categoryId: 2,
    iconIndex: 3,
    name: { en: "Filming Permit", ar: "تصريح تصوير" },
    category: { en: "Content Permits", ar: "تصاريح المحتوى" },
  },
  {
    id: 5,
    categoryId: 1,
    iconIndex: 0,
    name: { en: "Advertising Approval", ar: "موافقة إعلانية" },
    category: { en: "Media Licensing", ar: "ترخيص الإعلام" },
  },
  {
    id: 6,
    categoryId: 4,
    iconIndex: 1,
    name: { en: "Event Media Coverage", ar: "تغطية إعلامية للفعاليات" },
    category: { en: "Complaints", ar: "الشكاوى" },
  },
];

/** Knowledge Hub — 4 groups (copy from public publicsPage.knowledgeHub) */
export const knowledgeHub: {
  slug: string;
  title: Localized;
  links: { en: string[]; ar: string[] };
}[] = [
  {
    slug: "mediaLegislation",
    title: { en: "Media Legislation", ar: "التشريعات الإعلامية" },
    links: {
      en: [
        "UAE Media Law",
        "Media Services Fees",
        "Media Content Standards",
        "Violations and Penalties",
      ],
      ar: [
        "قانون الإعلام في دولة الإمارات",
        "رسوم الخدمات الإعلامية",
        "معايير المحتوى الإعلامي",
        "المخالفات والعقوبات",
      ],
    },
  },
  {
    slug: "openData",
    title: { en: "Open Data", ar: "البيانات المفتوحة" },
    links: {
      en: ["Open Data Policy", "Bayanat.ae", "Downloads", "Statistics", "Request Data"],
      ar: [
        "سياسة البيانات المفتوحة",
        "بيانات.إي",
        "التنزيلات",
        "الإحصائيات",
        "طلب بيانات",
      ],
    },
  },
  {
    slug: "initiatives",
    title: { en: "Initiatives", ar: "المبادرات" },
    links: {
      en: ["Golden Visa", "Media Apprenticeship Programme"],
      ar: ["الإقامة الذهبية", "برنامج التدريب الإعلامي"],
    },
  },
  {
    slug: "digitalParticipation",
    title: { en: "Digital Participation", ar: "المشاركة الرقمية" },
    links: {
      en: ["Digital Participation Policy", "Social Media Policy", "Blogs", "Consultations"],
      ar: [
        "سياسة المشاركة الرقمية",
        "سياسة وسائل التواصل",
        "المدونات",
        "الاستشارات",
      ],
    },
  },
];

/** Media — News / Events samples (imgIndex maps to new1..5.png, bilingual dates) */
export interface MediaItem {
  id: number;
  imgIndex: number;
  title: Localized;
  date: Localized;
}

export const news: MediaItem[] = [
  {
    id: 1,
    imgIndex: 1,
    title: {
      en: "AED 800 Million in Cinema Revenue in UAE in 2024",
      ar: "800 مليون درهم إيرادات السينما في الإمارات في 2024",
    },
    date: { en: "15 Jul, 2025", ar: "١٥ يوليو ٢٠٢٥" },
  },
  {
    id: 2,
    imgIndex: 2,
    title: {
      en: "National Media Authority receives “Humanized Buildings” certification",
      ar: "الهيئة الوطنية للإعلام تحصل على شهادة “المباني الإنسانية”",
    },
    date: { en: "10 Jul, 2025", ar: "١٠ يوليو ٢٠٢٥" },
  },
  {
    id: 3,
    imgIndex: 3,
    title: {
      en: "Launch of a comprehensive system to regulate the media sector",
      ar: "إطلاق نظام شامل لتنظيم القطاع الإعلامي",
    },
    date: { en: "02 Jul, 2025", ar: "٢ يوليو ٢٠٢٥" },
  },
  {
    id: 4,
    imgIndex: 4,
    title: {
      en: "NMA participates in the Abu Dhabi Book Fair 2025",
      ar: "الهيئة تشارك في معرض أبوظبي للكتاب 2025",
    },
    date: { en: "28 Jun, 2025", ar: "٢٨ يونيو ٢٠٢٥" },
  },
  {
    id: 5,
    imgIndex: 5,
    title: {
      en: "New media content standards announced",
      ar: "الإعلان عن معايير جديدة للمحتوى الإعلامي",
    },
    date: { en: "20 Jun, 2025", ar: "٢٠ يونيو ٢٠٢٥" },
  },
];

export const events: MediaItem[] = [
  {
    id: 1,
    imgIndex: 3,
    title: {
      en: "Dubai International Content Forum 2025",
      ar: "منتدى دبي الدولي للمحتوى 2025",
    },
    date: { en: "18 Aug, 2025", ar: "١٨ أغسطس ٢٠٢٥" },
  },
  {
    id: 2,
    imgIndex: 4,
    title: { en: "Media Innovation Workshop", ar: "ورشة الابتكار الإعلامي" },
    date: { en: "12 Aug, 2025", ar: "١٢ أغسطس ٢٠٢٥" },
  },
  {
    id: 3,
    imgIndex: 1,
    title: {
      en: "Annual Press Freedom Summit",
      ar: "القمة السنوية لحرية الصحافة",
    },
    date: { en: "05 Aug, 2025", ar: "٥ أغسطس ٢٠٢٥" },
  },
  {
    id: 4,
    imgIndex: 5,
    title: {
      en: "Digital Media Skills Bootcamp",
      ar: "معسكر مهارات الإعلام الرقمي",
    },
    date: { en: "30 Jul, 2025", ar: "٣٠ يوليو ٢٠٢٥" },
  },
  {
    id: 5,
    imgIndex: 2,
    title: {
      en: "National Media Awards Ceremony",
      ar: "حفل جوائز الإعلام الوطني",
    },
    date: { en: "25 Jul, 2025", ar: "٢٥ يوليو ٢٠٢٥" },
  },
];

/** Top nav menu — same 5 items as the public Header (hasDropdown = caret icon) */
export const topNavMenu: { label: Localized; hasDropdown: boolean }[] = [
  {
    label: { en: "About NMA", ar: "حول الهيئة الوطنية للإعلام" },
    hasDropdown: true,
  },
  { label: { en: "Services", ar: "الخدمات" }, hasDropdown: false },
  { label: { en: "Knowledge Hub", ar: "مركز المعرفة" }, hasDropdown: true },
  { label: { en: "Media", ar: "الإعلام" }, hasDropdown: true },
  { label: { en: "Contact Us", ar: "اتصل بنا" }, hasDropdown: false },
];

/** Footer bottom-nav columns (copy from public footer.*) */
export const footerNav: { title: Localized; items: Localized[] }[] = [
  {
    title: { en: "The Council", ar: "الهيئة" },
    items: [
      { en: "About Us", ar: "من نحن" },
      { en: "Knowledge Hub", ar: "مركز المعرفة" },
      { en: "Careers", ar: "وظائف" },
    ],
  },
  {
    title: { en: "Using the Website", ar: "استخدام الموقع" },
    items: [
      { en: "Sitemap", ar: "خريطة الموقع" },
      { en: "Accessibility", ar: "إمكانية الوصول" },
      { en: "Disclaimer", ar: "إخلاء المسؤولية" },
      { en: "Privacy Policy", ar: "سياسة الخصوصية" },
      { en: "Terms and Conditions", ar: "الشروط والأحكام" },
    ],
  },
  {
    title: { en: "Info and Support", ar: "معلومات ودعم" },
    items: [
      { en: "FAQs", ar: "الأسئلة الشائعة" },
      { en: "Contact Us", ar: "اتصل بنا" },
      { en: "Inquiries & Feedback", ar: "الاستفسارات والملاحظات" },
      { en: "Terminologies", ar: "المصطلحات" },
    ],
  },
];
