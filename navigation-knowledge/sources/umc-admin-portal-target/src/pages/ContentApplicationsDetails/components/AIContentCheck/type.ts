import type { IAIFiles } from "@/services/content"

interface IAICheck {
  aiStatus: number
  aiResult: string
  aiCheckTime: string
}

interface IProps {
  aiContent: IAICheck
  conflictFiles: IAIFiles[]
}

type TAllergicItem = Record<
  string,
  {
    entities: string[]
    para_num: number
  }
>

interface IExtraInfo {
  paragraph_content: string
  reason?: string
  imageUrl?: string
  mimeType?: string
  ner_paragraph?: number | string
  ner_page?: number | string
  tags: string[]
  entities: string[]
  timeRange?: string
  timestampMs?: number
  segmentVideoUrl?: string
  segmentInitialTimeMs?: number
}

type TSubjects = {
  icon: string
  confidence_score: number
  value: IExtraInfo[]
}

interface IJsonData {
  text_length?: number
  data_quality?: string
  ner_results: TAllergicItem
  ner_extra_info: IExtraInfo[]
  visual_findings?: IExtraInfo[]
  book_title?: string
  author_name?: string
  subject_category?: string
  sub_subject_category?: string
  senti_total?: string
  senti_aspects: {
    person_evaluation?: string
    content?: Record<string, string>
    institution?: Record<string, string>
    policy?: Record<string, string>
  }
  abstract: string
  people_rule_dict: {
    sensitive_words: string[]
    model_threshold: number
  }
  risk_level?: string
  is_compliant?: boolean
  confidence_score: number
  children_unhealthy_content?: string[]
  people_label?: string
  standard_review?: string
  analysis_report?: string
  file_path?: string | string[]
  language?: string
  tranlate_text_en?: string
  total_keyframes?: number
  keyframe_urls?: string | string[]
  pdf_cover_image_url?: string | string[]
  convert_speech2text?: {
    convert_speech2text?: {
      language?: string
      language_probability?: number
      segments?: Record<string, string>
    }
  }
}

export const createDownload = (url: string, fileName: string) => {
  const link = document.createElement("a")
  link.href = url
  link.download = decodeURIComponent(fileName)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export type {
  IProps,
  IAICheck,
  IJsonData,
  IExtraInfo,
  TAllergicItem,
  TSubjects,
}
