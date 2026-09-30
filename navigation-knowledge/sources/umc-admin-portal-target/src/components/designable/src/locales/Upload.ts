import { createLocales } from "@designable/core";

export const Upload = {
  "en-US": {
    title: "Upload",
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
        fileFormat: {
          title: "File Format",
        },
        fileSizeLimit: {
          title: "File Size Limit (MB)",
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
      required: {
        title: "Required Field",
      },
      "x-display": {
        title: "Visible",
      },
      "x-pattern": {
        title: "Editable",
      },
    },
  },
  "ar-AE": {
    title: "رفع",
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
        fileFormat: {
          title: "تنسيق الملف",
        },
        fileSizeLimit: {
          title: "حد حجم الملف (ميجابايت)",
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
      required: {
        title: "حقل مطلوب",
      },
      "x-display": {
        title: "مرئي",
      },
      "x-pattern": {
        title: "قابل للتحرير",
      },
    },
  },
  "ko-KR": {
    title: "업로드",
    settings: {
      uniqueValue: {
        title: "고유 값",
      },
      "x-component-props": {
        titleEn: {
          title: "라벨 이름",
        },
        fileFormat: {
          title: "파일 형식",
        },
        fileSizeLimit: {
          title: "파일 크기 제한 (MB)",
        },
      },
      "x-decorator-props": {
        tooltip: {
          title: "",
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
    },
  },
};

export const UploadDragger = createLocales(Upload, {
  "en-US": {
    title: "UploadDragger",
    settings: {
      "x-component-props": {},
    },
  },
  "ar-AE": {
    title: "رفع بالسحب",
    settings: {
      "x-component-props": {},
    },
  },
  "ko-KR": {
    title: "드래그로 업로드",
    settings: {
      "x-component-props": {},
    },
  },
});
