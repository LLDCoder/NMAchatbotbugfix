/* eslint-disable @typescript-eslint/no-explicit-any -- Formily connect / designable Field props */
import React from 'react'
import { observer } from '@formily/react'
import { Information as InformationCompoent } from './Information'
import { createBehavior, createResource } from '@designable/core'
import { DnFC } from '@designable/react'
import { AllSchemas } from '../../schemas'
import { createFieldSchemaInfo } from '../Field'
import { AllLocales } from '../../locales'
import i18n from '@/localization/config'
import {
  useFormLanguageHost,
  useFormPreviewLang,
} from '@/components/designable/playground/FormPreviewLangContext'
import { getBilingualValueByLang } from '@/components/designable/src/utils/bilingual'
import { resourceIcons } from '../../assets/resource-icons'

function resolveText(
  props: { text?: unknown; textEn?: unknown; textAr?: unknown },
  lang: string,
  host: "designer" | "runtime",
): string {
  const raw = getBilingualValueByLang({
    lang: lang === "ar" ? "ar" : "en",
    host,
    en: props.textEn,
    ar: props.textAr,
    legacy: props.text,
    fallback: "",
  })
  return typeof raw === 'string' ? raw : ''
}

/**
 * Canvas preview wrapper. Resolves textEn/textAr against the current Formily
 * preview language and forwards the picked string as `text` to the connected
 * InformationCompoent. observer + useFormPreviewLang ensure the canvas
 * re-renders when the settings panel writes new values.
 */
const InformationInner = observer((props: any) => {
  const lang = useFormPreviewLang()
  const host = useFormLanguageHost()
  const text = resolveText(props, lang, host)
  const { textEn, textAr, text: legacyText, Style, ...rest } = props
  void textEn
  void textAr
  void legacyText
  return React.createElement(InformationCompoent as any, {
    ...rest,
    Style: Style ?? 'warning',
    text,
  })
})

export const Information: DnFC<React.ComponentProps<typeof InformationCompoent>> =
  InformationInner as any

Information.Behavior = createBehavior({
  name: 'Information',
  extends: ['Field'],
  selector: (node) => node.props['x-component'] === 'Information',
  designerProps: {
    propsSchema: createFieldSchemaInfo(AllSchemas.Information),
  },
  designerLocales: AllLocales.Information,
})

Information.Resource = createResource({
  icon: resourceIcons.information,
  elements: [
    {
      componentName: 'Field',
      props: {
        'x-decorator': 'FormItem',
        'x-component': 'Information',
        'x-component-props': {
          Style: 'warning',
          textEn: i18n.t('Information.defaultHtmlWarning', { lng: 'en' }),
          textAr: i18n.t('Information.defaultHtmlWarning', { lng: 'ar' }),
        },
      },
    },
  ],
})
