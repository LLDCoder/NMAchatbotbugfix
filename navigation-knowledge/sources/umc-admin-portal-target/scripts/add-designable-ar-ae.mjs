/**
 * Adds 'ar-AE' blocks by cloning each en-US object and translating title: values.
 * Run: node scripts/add-designable-ar-ae.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCALES_DIR = path.join(
  __dirname,
  "../src/components/designable/src/locales",
);

const TITLE_AR = {
  Void: "فراغ",
  Remove: "إزالة",
  "Move Up": "نقل لأعلى",
  "Move Down": "نقل لأسفل",
  Index: "الفهرس",
  "Sort Handle": "مقبض الفرز",
  Grid: "شبكة",
  "Grid Column": "عمود الشبكة",
  "Add Grid Column": "إضافة عمود شبكة",
  "Min Width": "الحد الأدنى للعرض",
  "Min Columns": "الحد الأدنى للأعمدة",
  "Max Width": "الحد الأقصى للعرض",
  "Max Columns": "الحد الأقصى للأعمدة",
  Breakpoints: "نقاط الانقطاع",
  "Column Gap": "فجوة الأعمدة",
  "Row Gap": "فجوة الصفوف",
  "Col Wrap": "لف الأعمدة",
  Cascader: "متسلسل",
  "Change On Select": "تغيير عند الاختيار",
  "Display Render": "عرض العرض",
  "Field Names": "أسماء الحقول",
  TreeSelect: "اختيار شجري",
  "Show Checked Strategy": "استراتيجية إظهار المحدد",
  "Show All": "إظهار الكل",
  "Show Parent Node": "إظهار العقدة الأم",
  "Show Child Nodes": "إظهار العقد الفرعية",
  "Tree Default Expanded Keys": "مفاتيح التوسيع الافتراضية للشجرة",
  "Tree Node Filter Properties": "خصائص تصفية عقد الشجرة",
  "Tree Data Simple Mode": "وضع بيانات الشجرة المبسط",
  "Tree Node Label Properties": "خصائص تسمية عقد الشجرة",
  Acquaintance: "نموذج المعارف",
  "Acquaintance Form": "نموذج المعارف",
  Title: "العنوان",
  Address: "العنوان",
  "Address List": "قائمة العناوين",
  AddressPicker: "منتقي العنوان",
  "Array Cards": "بطاقات مصفوفة",
  "Array Table": "جدول مصفوفة",
  Column: "عمود",
  "Tab Panel": "لوحة تبويب",
  Tabs: "تبويبات",
  Information: "معلومات",
  Container: "حاوية",
  "Multi-Select": "اختيار متعدد",
  Divider: "فاصل",
  Form: "نموذج",
  "Form Layout": "تخطيط النموذج",
  Object: "كائن",
  Space: "مسافة",
  Switch: "مفتاح",
  Slider: "منزلق",
  Rate: "تقييم",
  Password: "كلمة المرور",
  Input: "حقل إدخال",
  TextArea: "مساحة نص",
  Text: "نص",
  "Single Dropdown": "قائمة منسدلة مفردة",
  "Multi-Dropdown": "قائمة منسدلة متعددة",
  "Single Select": "اختيار مفرد",
  "Time Picker": "منتقي الوقت",
  "Time Range": "نطاق زمني",
  DatePicker: "منتقي التاريخ",
  DateRange: "نطاق التاريخ",
  NumberInput: "إدخال رقم",
  "Format Converter": "محوّل التنسيق",
  "Format Parser": "محلل التنسيق",
  "String Format": "تنسيق النص",
  Transfer: "نقل",
  Upload: "رفع",
  UploadDragger: "رفع بالسحب",
  RichText: "نص منسق",
  Video: "فيديو",
  "Required Viewing": "مشاهدة مطلوبة",
  "Publication Form": "نموذج النشر",
  "Book Trading Form": "نموذج تداول الكتب",
  "Filming Team": "فريق التصوير",
  "Social Media Account": "حساب وسائل التواصل",
  "Persons in Charge": "الأشخاص المسؤولون",
  "Partner List": "قائمة الشركاء",
  "Game Distribution Form": "نموذج توزيع الألعاب",
  "Video Game Package Form": "نموذج حزمة ألعاب الفيديو",
  "Movie Package Form": "نموذج حزمة الأفلام",
  "Filming Purpose": "غرض التصوير",
  "Film Re-screening Form": "نموذج إعادة عرض الفيلم",
  "Film Screening Form": "نموذج عرض الفيلم",
  "Film Age Rating": "التصنيف العمري للفيلم",
  "Profile Form": "نموذج الملف الشخصي",
  "License Transfer Form": "نموذج نقل الترخيص",
  "License Information Form": "نموذج معلومات الترخيص",
  "Trade License Details": "تفاصيل الرخصة التجارية",
  "Guardian Consent Details": "تفاصيل موافقة الوصي",
  "Newpaper Magazine Circulation": "توزيع الصحف والمجلات",
  "Transfer Information": "معلومات النقل",
  "Transfer History": "سجل النقل",
  "Script Publication Form": "نموذج نشر النص",
  "Social Media Manager": "مدير وسائل التواصل",
  "Filming Locations": "مواقع التصوير",
  "Press Card Selector": "منتقي بطاقة الصحافة",
  "ID Selector": "منتقي الهوية",
  "Data List": "قائمة البيانات",
  "Data Form": "نموذج البيانات",
  "Book List": "قائمة الكتب",
  "Image List": "قائمة الصور",
  "URL List": "قائمة الروابط",
  "Region Selector": "منتقي المنطقة",
  "Emirate Port": "ميناء الإمارة",
  "Single Language": "لغة مفردة",
  "Multi-Language": "لغات متعددة",
  Mode: "الوضع",
  Multiple: "متعدد",
  Tags: "وسوم",
  Single: "مفرد",
  "Label Name": "اسم التسمية",
  "Label Align": "محاذاة التسمية",
  "Wrapper Align": "محاذاة الغلاف",
  Size: "الحجم",
  Layout: "التخطيط",
  "Feedback Layout": "تخطيط التغذية الراجعة",
  "Tooltip Layout": "تخطيط التلميح",
  "Field Width": "عرض الحقل",
  "Full Line": "سطر كامل",
  "1/2": "نصف",
  "Required Field": "حقل مطلوب",
  Visible: "مرئي",
  Editable: "قابل للتحرير",
  Description: "الوصف",
  Placeholder: "النص التوضيحي",
  "Placeholder Text": "النص التوضيحي",
  Format: "التنسيق",
  "Word Limit": "حد الكلمات",
  Rtl: "من اليمين لليسار",
  "Unique Value": "قيمة فريدة",
  Options: "خيارات",
  "Options Source": "مصدر الخيارات",
  Type: "النوع",
  Align: "المحاذاة",
  Fixed: "ثابت",
  Left: "يسار",
  Right: "يمين",
  Vertical: "عمودي",
  Horizontal: "أفقي",
  Inline: "في السطر",
  Large: "كبير",
  Small: "صغير",
  Default: "افتراضي",
  Loose: "واسع",
  Terse: "مختصر",
  Popup: "منبثق",
  Icon: "أيقونة",
  "Activity Title": "عنوان النشاط",
  "Activity Configuration": "إعداد النشاط",
  "Multiple Activity": "أنشطة متعددة",
  "Single Activity": "نشاط مفرد",
  Name: "الاسم",
  Required: "مطلوب",
  "Display State": "حالة العرض",
  "UI Pattern": "نمط الواجهة",
  Validator: "المتحقق",
  Decorator: "المزخرف",
  Reactions: "التفاعلات",
  "Field Properties": "خصائص الحقل",
  "Component Properties": "خصائص المكوّن",
  "Decorator Properties": "خصائص المزخرف",
  "Component Style": "نمط المكوّن",
  "Decorator Style": "نمط المزخرف",
  "Allow Clear": "السماح بالمسح",
  "Auto Focus": "تركيز تلقائي",
  "Show Search": "إظهار البحث",
  "Not Found Content": "لا يوجد محتوى",
  Bordered: "بإطار",
  "Addon After": "لاحقة",
  "Addon Before": "بادئة",
  Tooltip: "تلميح",
  Asterisk: "نجمة",
  "Grid Span": "امتداد الشبكة",
  "Label Col": "عمود التسمية",
  "Wrapper Col": "عمود الغلاف",
  Colon: "نقطتان",
  "Label Wrap": "التفاف التسمية",
  "Wrapper Wrap": "التفاف الغلاف",
  "Label Width": "عرض التسمية",
  "Wrapper Width": "عرض الغلاف",
  Fullness: "الامتلاء",
  Inset: "داخلي",
  Shallow: "سطحي",
  Width: "العرض",
  Height: "الارتفاع",
  Display: "العرض",
  Background: "الخلفية",
  "Box Shadow": "ظل الصندوق",
  Font: "الخط",
  Margin: "الهامش",
  Padding: "الحشو",
  Radius: "نصف القطر",
  Border: "الحدود",
  Opacity: "الشفافية",
  Hidden: "مخفي",
  None: "لا شيء",
  Inherit: "موروث",
  EditablePat: "قابل للتحرير",
  Disabled: "معطّل",
  ReadOnly: "للقراءة فقط",
  ReadPretty: "عرض مقروء",
  "Add Button Label": "نص زر الإضافة",
  "Field Settings": "إعدادات الحقل",
  "Auto Clear Search Value": "مسح قيمة البحث تلقائياً",
  "Max Tag Placeholder": "نص وسوم مخفية",
  "Dropdown Match Select Width": "مطابقة عرض القائمة",
  Collapse: "طي",
  Panel: "لوحة",
  Collapsible: "قابل للطي",
  EquipmentList: "قائمة المعدات",
  CustomizeAddress: "تخصيص العنوان",
  Operations: "العمليات",
  Titles: "العناوين",
  Tooltips: "تلميحات",
  "Tooltip Placement": "موضع التلميح",
  "Tooltip Visible": "إظهار التلميح",
  Direction: "الاتجاه",
  "Table Layout": "تخطيط الجدول",
  "Text Mode": "وضع النص",
  EquipmentListTitle: "قائمة المعدات",
  "Max Items": "الحد الأقصى للعناصر",
  "Max File Size (MB)": "الحد الأقصى لحجم الملف (ميجابايت)",
  Restriction: "قيود",
  "File Format": "تنسيق الملف",
  "File Size Limit (MB)": "حد حجم الملف (ميجابايت)",
  "Tree Checkable": "شجرة قابلة للتحديد",
  "Tree Default Expand All": "توسيع الشجرة بالكامل افتراضياً",
  "Filter Tree Node": "تصفية عقدة الشجرة",
  "Label In Value": "التسمية في القيمة",
  "List Height": "ارتفاع القائمة",
  "Max Tag Count": "الحد الأقصى للوسوم",
  "Max Tag Text Length": "طول نص الوسم",
  "Show Arrow": "إظهار السهم",
  "Use Virtual Scroll": "تمرير افتراضي",
};

function extractBalanced(src, openBraceIndex) {
  let depth = 0;
  for (let j = openBraceIndex; j < src.length; j++) {
    if (src[j] === "{") depth++;
    else if (src[j] === "}") {
      depth--;
      if (depth === 0) return { end: j + 1, text: src.slice(openBraceIndex, j + 1) };
    }
  }
  return null;
}

function findNextEnUS(src, fromIndex) {
  const s1 = src.indexOf("'en-US':", fromIndex);
  const s2 = src.indexOf('"en-US":', fromIndex);
  if (s1 < 0) return s2;
  if (s2 < 0) return s1;
  return Math.min(s1, s2);
}

function translateTitleStrings(block) {
  const doit =
    (quote) =>
    (match, text) => {
      if (text === "") return match;
      const ar = TITLE_AR[text];
      if (ar === undefined) {
        console.warn(`Missing AR for title: "${text}"`);
        return match;
      }
      return `title: ${quote}${ar}${quote}`;
    };
  // Require whitespace after colon so tooltip examples like title:"test1" are not matched.
  return block
    .replace(/title:\s+"([^"]*)"/g, doit('"'))
    .replace(/title:\s+'([^']*)'/g, doit("'"));
}

function removeArAE(src) {
  let out = src;
  for (const q of [`"ar-AE"`, `'ar-AE'`]) {
    let pos = 0;
    while (true) {
      const i = out.indexOf(`${q}:`, pos);
      if (i < 0) break;
      const b = out.indexOf("{", i);
      const ex = extractBalanced(out, b);
      if (!ex) break;
      let end = ex.end;
      while (end < out.length && /[\s,]/.test(out[end])) end++;
      out = out.slice(0, i) + out.slice(end);
      pos = i;
    }
  }
  return out;
}

function removeArSA(src) {
  let out = src;
  for (const q of [`"ar-SA"`, `'ar-SA'`]) {
    let pos = 0;
    while (true) {
      const i = out.indexOf(`${q}:`, pos);
      if (i < 0) break;
      const b = out.indexOf("{", i);
      const ex = extractBalanced(out, b);
      if (!ex) break;
      let end = ex.end;
      while (end < out.length && /[\s,]/.test(out[end])) end++;
      out = out.slice(0, i) + out.slice(end);
      pos = i;
    }
  }
  return out;
}

function processSource(src) {
  let out = removeArAE(removeArSA(src));
  let searchFrom = 0;
  while (true) {
    const enPos = findNextEnUS(out, searchFrom);
    if (enPos < 0) break;
    const braceStart = out.indexOf("{", enPos);
    const ex = extractBalanced(out, braceStart);
    if (!ex) break;
    const arBody = translateTitleStrings(ex.text);
    const insert = `,\n  'ar-AE': ${arBody}`;
    out = out.slice(0, ex.end) + insert + out.slice(ex.end);
    searchFrom = ex.end + insert.length;
  }
  return out;
}

function main() {
  const files = fs
    .readdirSync(LOCALES_DIR)
    .filter((f) => f.endsWith(".ts") && f !== "index.ts" && f !== "all.ts");

  for (const f of files) {
    const fp = path.join(LOCALES_DIR, f);
    const before = fs.readFileSync(fp, "utf8");
    const after = processSource(before);
    fs.writeFileSync(fp, after, "utf8");
    if (after !== before) console.log("Updated:", f);
  }
}

main();
