import merge from "lodash/merge";
import {
  i18nAddResources,
  i18nGetResources,
} from "@wangeditor/editor";

let registered = false;

/**
 * Arabic UI strings layered on wangEditor bundled English (`en`) resources.
 */
const AR_LOCALE_OVERRIDES: Record<string, unknown> = {
  common: {
    ok: "موافق",
  },
  textStyle: {
    bold: "عريض",
    italic: "مائل",
    underline: "تسطير",
  },
  justify: {
    left: "محاذاة لليسار",
    right: "محاذاة لليمين",
    center: "توسيط",
    justify: "ضبط",
  },
  lineHeight: {
    title: "تباعد الأسطر",
    default: "افتراضي",
  },
  link: {
    insert: "إدراج رابط",
    text: "نص الرابط",
    url: "عنوان الرابط",
    unLink: "إزالة الرابط",
    update: "تحديث الرابط",
    view: "عرض الرابط",
  },
  uploadImgModule: {
    uploadImage: "رفع صورة",
    uploadError: "خطأ في رفع {{fileName}}",
  },
  editor: {
    more: "المزيد",
    justify: "المحاذاة",
    indent: "المسافة البادئة",
    image: "صورة",
    video: "فيديو",
  },
  customMenu: {
    textCase: "حالة الأحرف",
  },
};

export function ensureWangEditorArabicLocale(): void {
  if (registered) return;
  registered = true;
  const base = i18nGetResources("en") as Record<string, unknown>;
  i18nAddResources("ar", merge({}, base, AR_LOCALE_OVERRIDES));
}
