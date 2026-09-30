/**
 * Designer settings labels (follow `Input` locale shape). Sync copy with
 * `IDSelector` in `src/localization/formily/en.json` and `ar.json` (paletteTitle + designer* keys).
 */
export const IDSelector = {
  "en-US": {
    title: "ID Selector",
    settings: {
      "x-component-props": {
        showEmiratesId: {
          title: "Show Emirates ID",
        },
        showUID: {
          title: "Show UAE Unified Number (UID)",
        },
        showPassport: {
          title: "Show Passport",
        },
      },
      required: {
        title: "Required",
      },
      "x-display": {
        title: "Visible",
      },
    },
  },
  "ar-AE": {
    title: "منتقي الهوية",
    settings: {
      "x-component-props": {
        showEmiratesId: {
          title: "عرض الهوية الإماراتية",
        },
        showUID: {
          title: "عرض الرقم الموحد للدولة (UID)",
        },
        showPassport: {
          title: "عرض جواز السفر",
        },
      },
      required: {
        title: "مطلوب",
      },
      "x-display": {
        title: "مرئي",
      },
    },
  },
};
