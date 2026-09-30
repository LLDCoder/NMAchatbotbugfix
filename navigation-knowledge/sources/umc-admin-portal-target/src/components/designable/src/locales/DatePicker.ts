import { createLocales } from "@designable/core";

export const DatePicker = {
  "en-US": {
    title: "DatePicker",
    settings: {
      uniqueValue: {
        title: "Unique Value",
      },
      "x-component-props": {
        titleEn: {
          title: "Label Name",
        },
        titleAr: {
          title: "Label Name(Ar)",
        },
        placeholderEn: {
          title: "Placeholder text",
        },
        placeholderAr: {
          title: "Placeholder text(Ar)",
        },
      },
      "x-decorator-props": {
        tooltipEn: {
          title: "Description",
        },
        tooltipAr: {
          title: "Description(Ar)",
        },
      },
      "x-decorator-props.style": {
        "style.width": {
          title: "Field Width",
          dataSource: ["Full Line", "1/2"],
        },
      },
      required: {
        title: "Required Field",
      },
      "x-display": {
        title: "Visible",
      },
      "x-pattern": {
        title: "Editable",
      },
      "x-component-props.restriction": {
        title: "Restriction",
      },
    },
  },
  "ar-AE": {
    title: "منتقي التاريخ",
    settings: {
      uniqueValue: {
        title: "قيمة فريدة",
      },
      "x-component-props": {
        titleEn: {
          title: "Label Name",
        },
        titleAr: {
          title: "Label Name(Ar)",
        },
        placeholderEn: {
          title: "Placeholder text",
        },
        placeholderAr: {
          title: "Placeholder text(Ar)",
        },
      },
      "x-decorator-props": {
        tooltipEn: {
          title: "Description",
        },
        tooltipAr: {
          title: "Description(Ar)",
        },
      },
      "x-decorator-props.style": {
        "style.width": {
          title: "عرض الحقل",
          dataSource: ["Full Line", "1/2"],
        },
      },
      required: {
        title: "حقل مطلوب",
      },
      "x-display": {
        title: "مرئي",
      },
      "x-pattern": {
        title: "قابل للتحرير",
      },
      "x-component-props.restriction": {
        title: "قيود",
      },
    },
  },
  "ko-KR": {
    title: "날짜 선택 상자",
    settings: {
      uniqueValue: {
        title: "고유 값",
      },
      "x-component-props": {
        titleEn: {
          title: "라벨 이름",
        },
        placeholderEn: {
          title: "플레이스홀더 텍스트",
        },
      },
      "x-decorator-props": {
        tooltip: {
          title: "설명",
        },
      },
      "x-decorator-props.style": {
        "style.width": {
          title: "필드 너비",
          dataSource: ["전체 라인", "1/2"],
        },
      },
      required: {
        title: "필수 필드",
      },
      "x-display": {
        title: "보이기",
      },
      "x-pattern": {
        title: "편집 가능",
      },
      "x-component-props.restriction": {
        title: "제한",
      },
    },
  },
};

export const DateRangePicker = createLocales(DatePicker, {
  "en-US": {
    title: "DateRange",
  },
  "ar-AE": {
    title: "نطاق التاريخ",
  },
  "ko-KR": {
    title: "날짜범위 선택 상자",
  },
});
