import { GlobalRegistry } from "@designable/core";

const ValidatorFormatsEn = [
  { label: "Custom Rule", value: "global1" },
  { label: "Number", value: "number" },
  { label: "Email", value: "email" },
  { label: "Website", value: "url" },
];

const ValidatorFormatsAr = [
  { label: "قاعدة مخصصة", value: "global1" },
  { label: "رقم", value: "number" },
  { label: "البريد الإلكتروني", value: "email" },
  { label: "موقع الويب", value: "url" },
];

export function registerValidatorLocales() {
  GlobalRegistry.registerDesignerLocales({
    "en-US": {
      sources: {
        Inputs: "Inputs",
        Layouts: "Layouts",
        Arrays: "Arrays",
        Displays: "Displays",
      },
      settings: {
        "x-validator": {
          title: "Validator",
          addValidatorRules: "Add Validator Rules",
          drawer: "Edit Rules",
          triggerType: {
            title: "Trigger Type",
            placeholder: "Please Select",
            dataSource: ["onInput", "onFocus", "onBlur"],
          },
          format: {
            title: "Format",
            placeholder: "Please Select",
            dataSource: ValidatorFormatsEn,
          },
          validator: {
            title: "Custom Validator",
            tooltip:
              'Format: function (value){ return "Error Message"}',
          },
          pattern: "RegExp",
          len: "Length Limit",
          max: "Length/Value Lt",
          min: "Length/Value Gt",
          exclusiveMaximum: "Length/Value Lte",
          exclusiveMinimum: "Length/Value Gte",
          whitespace: "No Whitespace",
          required: "Required",
          message: {
            title: "Error Message",
            tooltip:
              "The error message is only effective for one built-in rule of the current rule set.",
          },
        },
      },
      SettingComponents: {
        ValidatorSetter: {
          pleaseSelect: "Please Select",
          formats: ValidatorFormatsEn,
        },
      },
    },
    "ar-AE": {
      sources: {
        Inputs: "المدخلات",
        Layouts: "التخطيطات",
        Arrays: "المصفوفات",
        Displays: "العناصر المرئية",
      },
      settings: {
        "x-validator": {
          title: "قواعد التحقق",
          addValidatorRules: "إضافة قاعدة تحقق",
          drawer: "تعديل القواعد",
          triggerType: {
            title: "نوع التشغيل",
            placeholder: "يرجى الاختيار",
            dataSource: ["عند الإدخال", "عند التركيز", "عند فقدان التركيز"],
          },
          format: {
            title: "تنسيق التحقق",
            placeholder: "يرجى الاختيار",
            dataSource: ValidatorFormatsAr,
          },
          validator: {
            title: "محقق مخصص",
            tooltip:
              'الصيغة: function (value){ return "رسالة الخطأ"}',
          },
          pattern: "تعبير نمطي",
          len: "حد الطول",
          max: "الطول/القيمة أقل من",
          min: "الطول/القيمة أكبر من",
          exclusiveMaximum: "الطول/القيمة أقل من أو يساوي",
          exclusiveMinimum: "الطول/القيمة أكبر من أو يساوي",
          whitespace: "لا يُسمح بالمسافات البيضاء",
          required: "مطلوب",
          message: {
            title: "رسالة الخطأ",
            tooltip:
              "رسالة الخطأ سارية على قاعدة مدمجة واحدة فقط في المجموعة الحالية.",
          },
        },
      },
      SettingComponents: {
        ValidatorSetter: {
          pleaseSelect: "يرجى الاختيار",
          formats: ValidatorFormatsAr,
        },
      },
    },
  });
}
