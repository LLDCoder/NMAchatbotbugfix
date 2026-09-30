import type { ISchema } from "@formily/react";

export const PosterAndTrailerPermit: ISchema = {
  type: "object",
  properties: {
    "x-component-props": {
      type: "object",
      properties: {
        posterTitleEn: {
          type: "string",
          title: "Poster Title",
          default: "Film Poster",
          "x-decorator": "FormItem",
          "x-component": "Input",
          "x-display": "{{lang === 'en' ? 'visible' : 'hidden'}}",
        },
        posterTitleAr: {
          type: "string",
          title: "Poster Title",
          default: "ملصق الفيلم",
          "x-decorator": "FormItem",
          "x-component": "Input",
          "x-display": "{{lang === 'ar' ? 'visible' : 'hidden'}}",
        },
        trailerTitleEn: {
          type: "string",
          title: "Trailer Title",
          default: "Film Trailer",
          "x-decorator": "FormItem",
          "x-component": "Input",
          "x-display": "{{lang === 'en' ? 'visible' : 'hidden'}}",
        },
        trailerTitleAr: {
          type: "string",
          title: "Trailer Title",
          default: "المقطع الدعائي للفيلم",
          "x-decorator": "FormItem",
          "x-component": "Input",
          "x-display": "{{lang === 'ar' ? 'visible' : 'hidden'}}",
        },
        posterMaxCount: {
          type: "number",
          title: "Poster Max Count",
          default: 4,
          "x-decorator": "FormItem",
          "x-component": "NumberPicker",
          "x-component-props": {
            min: 1,
            max: 10,
          },
        },
        trailerMaxCount: {
          type: "number",
          title: "Trailer Max Count",
          default: 3,
          "x-decorator": "FormItem",
          "x-component": "NumberPicker",
          "x-component-props": {
            min: 1,
            max: 10,
          },
        },
      },
    },
  },
};
