import React from 'react'
import { Card as AntdCard, Tooltip } from 'antd'
import { QuestionCircleOutlined } from '@ant-design/icons'
import { useFieldSchema } from '@formily/react'

import { createBehavior, createResource } from '@designable/core'
import type { DnFC } from '@designable/react'
import { AllSchemas } from '../../schemas'
import { AllLocales } from '../../locales'
import {
  useFormLanguageHost,
  useFormPreviewLang,
} from '@/components/designable/playground/FormPreviewLangContext'
import i18n from '@/localization/config'
import {
  getBilingualValueByLang,
  getEditableTitlePathByLang,
} from '@/components/designable/src/utils/bilingual'
import { resourceIcons } from '../../assets/resource-icons'

import { sanitizeHtml } from '@/utils/sanitizeHtml'

import {
  FORMILY_COMPONENT_KEYS,
  FORMILY_SLOT_KEYS,
} from '@/components/common/FormliyView/runtimeSlots'
import { useFormilyRenderSlot } from '@/components/common/FormliyView/useFormilyRenderSlot'


function isTooltipEmpty(html: string | undefined): boolean {
  if (!html) return true
  const text = html.replace(/<[^>]*>/g, '').trim()
  return text.length === 0 && !/<img\s/i.test(html) && !/<video\s/i.test(html)
}

type CardExtraProps = {
  descTooltip?: string
  descTooltipEn?: string
  descTooltipAr?: string
  titleEn?: string
  titleAr?: string
}

export const Card: DnFC<React.ComponentProps<typeof AntdCard> & CardExtraProps> = (props) => {
  const lang = useFormPreviewLang()
  const host = useFormLanguageHost()
  const fieldSchema = useFieldSchema()
  const renderSlot = useFormilyRenderSlot()
  const { descTooltip, descTooltipEn, descTooltipAr, titleEn, titleAr, className, ...restProps } = props
  const hideDefaultTitle = className?.split(/\s+/).includes('training-program-card')
  const displayTitle = getBilingualValueByLang({
    lang,
    host,
    en: titleEn,
    ar: titleAr,
    legacy: restProps.title,
    fallback:
      host === 'designer' || hideDefaultTitle
        ? ''
        : (restProps.title as string) || i18n.t('Card.defaultTitle', { lng: lang === 'ar' ? 'ar' : 'en' }),
  })

  const resolvedTooltip = getBilingualValueByLang({
    lang,
    host,
    en: descTooltipEn,
    ar: descTooltipAr,
    legacy: descTooltip,
    fallback: "",
  })
  const hasTooltip = !isTooltipEmpty(resolvedTooltip)
  // Use the schema instance id so pages with multiple Card nodes can target one Card.
  const rawDesignableId = (
    fieldSchema as unknown as Record<string, unknown> | undefined
  )?.['x-designable-id']
  const designableId =
    typeof rawDesignableId === 'string' ? rawDesignableId : undefined
  const headerExtra = renderSlot?.({
    componentKey: FORMILY_COMPONENT_KEYS.CARD,
    designableId,
    slotKey: FORMILY_SLOT_KEYS.HEADER_EXTRA,
    componentProps: props as Readonly<Record<string, unknown>>,
  })
  const resolvedExtra = headerExtra === undefined ? restProps.extra : headerExtra

  const titleNode = (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span data-content-editable={getEditableTitlePathByLang(lang)}>{displayTitle}</span>
      {hasTooltip && (
        <Tooltip
          title={
            <div
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(resolvedTooltip) }}
              style={{ maxWidth: 800 }}
            />
          }
          placement="top"
        >
          <QuestionCircleOutlined style={{ fontSize: 14, color: '#999', cursor: 'pointer' }} />
        </Tooltip>
      )}
    </span>
  )

  return (
    <AntdCard
      {...restProps}
      extra={resolvedExtra}
      title={displayTitle || hasTooltip ? titleNode : undefined}
      className={['formliy-container', className].filter(Boolean).join(' ')}
    >
      {props.children}
    </AntdCard>
  )
}

Card.Behavior = createBehavior({
  name: 'Card',
  extends: ['Field'],
  selector: (node) => node.props?.['x-component'] === 'Card',
  designerProps: {
    droppable: true,
    propsSchema: AllSchemas.Card,
  },
  designerLocales: AllLocales.Card,
})

Card.Resource = createResource({
  icon: resourceIcons.container,
  elements: [
    {
      componentName: 'Field',
      props: {
        type: 'void',
        'x-component': 'Card',
        'x-component-props': {
          title: i18n.t('Card.defaultTitleEn', { lng: 'en' }),
          titleEn: i18n.t('Card.defaultTitleEn', { lng: 'en' }),
          titleAr: i18n.t('Card.defaultTitleAr', { lng: 'ar' }),
          descTooltipEn: '',
          descTooltipAr: '',
        },
      },
    },
  ],
})
