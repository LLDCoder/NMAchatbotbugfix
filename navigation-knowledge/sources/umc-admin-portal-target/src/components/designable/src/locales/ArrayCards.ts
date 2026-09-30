import { createLocales } from '@designable/core'
import { Card } from './Card'

export const ArrayCards = createLocales(Card, {

  'en-US': {
    title: 'Array Cards',
    addIndex: 'Add Index',
    addOperation: 'Add Operations',
  },
  'ar-AE': {
    title: 'بطاقات مصفوفة',
    addIndex: 'Add Index',
    addOperation: 'Add Operations',
  },
  'ko-KR': {
    title: '배열 카드',
    addIndex: '색인 추가',
    addOperation: '작업 추가',
  },
})
