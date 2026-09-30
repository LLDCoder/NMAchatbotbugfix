import { DownloadOutlined, EyeOutlined, MinusOutlined, PlusOutlined } from "@ant-design/icons"
import warningRedIcon from "@/assets/images/warning-red.svg"
import aiIcon from "@/assets/images/ai.svg"
import "./index.less"
import adultIcon from "@/assets/images/adult.svg"
import handFistIcon from "@/assets/images/handFist.svg"
import shieldWarningIcon from "@/assets/images/shieldWarning.svg"
import intersectThreeIcon from "@/assets/images/intersectThree.svg"
import monitorIcon from "@/assets/images/monitor.svg"
import foldFinishmentIcon from "@/assets/images/foldFinishment.svg"
import lgbtIcon from "@/assets/images/rainbow.svg"
import crownIcon from "@/assets/images/crown.svg"
import { Button, Divider, Empty, Input, Modal, Tabs } from "antd"
import { ExpandContext } from "../../context"
import { useContext, type FC, useEffect, useMemo, useRef, useState } from "react"
import {
  createDownload,
  type IExtraInfo,
  type IJsonData,
  type IProps,
  type TAllergicItem,
  type TSubjects,
} from "./type"
import bookCoverIcon from "@/assets/images/defaultCover.png"
import magicWandIcon from "@/assets/images/magicWand.svg"
import { ImageBaseUrl } from "@/utils/url"
import HighlightKeyword from "../HighlightKeyword"
import checkCircleIcon from "@/assets/images/checkcircle.png"
import babyIcon from "@/assets/images/baby.svg"
import prohibitIcon from "@/assets/images/prohibit.svg"
import { ExpandBtn } from "../ExpandBtn"
import moment from "moment"
import play from '@/assets/images/play.png';
import BookDefaultVideioCover from '@/assets/images/book-default-video-cover.png';
import { useTranslation } from "react-i18next"
import PreviewModal from "@/components/common/PreviewModal"
import MoviePreviewModal from "@/components/common/MoviePreviewModal"
import PdfScrollPreview from "@/components/common/PdfScrollPreview"
import {
  isPdfFile,
  resolveDocumentAccessUrl,
  resolvePdfPreviewUrl,
} from "@/utils/pdfPreview"
import { useAuthenticatedDocumentUrl } from "@/hooks/useAuthenticatedDocumentUrl"
import { loadAuthenticatedDocumentSource } from "@/utils/loadAuthenticatedDocumentSource"
import { CustomMessage } from "@/components/common"
import { PasswordResponses } from "pdfjs-dist"
import PlayCircle from '@/assets/icons/PlayCircle.svg'
const MOVIE_FILE_EXTENSIONS = [".mp4", ".mov", ".m4v", ".webm", ".avi", ".mkv"]
const IMAGE_FILE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".svg"]
const MOVIE_AI_RESULT_MARKERS = ["convert_speech2text", "total_keyframes", "tranlate_text_en"] as const

type TAiCheckType = "book" | "movie" | "image"
type TEvidenceTab = "text" | "image"
type TJsonRecord = Record<string, unknown>
type TPreviewFileData = { name: string; url: string; filePath?: string }
type TEvidencePreviewData = {
  fileData: TPreviewFileData
  mediaType: "image" | "video"
  autoPlay?: boolean
  initialTime?: number
}
type TVisualEvidenceAsset = { url: string; mimeType?: string }
type TVisualEvidenceAssetMap = Map<string, TVisualEvidenceAsset>
type TVisualEvidenceSegment = { url: string; startMs: number }
type TVisualEvidenceSegmentMap = Map<string, TVisualEvidenceSegment>

type TMovieSpeechRecord = TJsonRecord & {
  language?: string
  language_probability?: number
  segments?: unknown
}

const getFileExtension = (value?: string) => {
  const fileName = String(value ?? "").trim().split(/[?#]/)[0]
  const dotIndex = fileName.lastIndexOf(".")
  return dotIndex >= 0 ? fileName.slice(dotIndex).toLowerCase() : ""
}

const getRecord = (value: unknown): TJsonRecord | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as TJsonRecord)
    : null

const getArray = <T,>(value: unknown): T[] =>
  Array.isArray(value) ? (value as T[]) : []

const getString = (value: unknown) =>
  typeof value === "string" ? value.trim() : ""

const isMp4MimeType = (value?: string) =>
  getString(value).toLowerCase() === "video/mp4"

const getMediaPreviewName = (url: string, fallbackName: string) => {
  const fileName = getString(url).split(/[?#]/)[0].split("/").pop()
  if (!fileName) return fallbackName

  try {
    return decodeURIComponent(fileName)
  } catch {
    return fileName
  }
}

// AI results may return review fields as an object (e.g. { report, recommendation })
// instead of a plain string. React cannot render an object as a child, so flatten it
// into readable text before it reaches JSX.
const getReviewText = (value: unknown): string => {
  if (typeof value === "string") return value.trim()
  const record = getRecord(value)
  if (!record) return ""

  const parts = [
    getString(record.report),
    getString(record.recommendation),
    getString(record.final_standard_review),
    getString(record.standard_review),
    getString(record.analysis_report),
    getString(record.abstract),
  ].filter(Boolean)

  return parts.join("\n\n")
}


const getFirstPathString = (value: unknown) => {
  if (Array.isArray(value)) {
    return value.find(
      (item): item is string => typeof item === "string" && item.trim() !== "",
    )?.trim() || ""
  }

  return getString(value)
}

const getPathList = (value: unknown) => {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string" && item.trim() !== "")
      .map((item) => item.trim())
  }

  const text = getString(value)
  return text ? [text] : []
}

const getMaterialFilePaths = (payload: unknown) => {
  const materials = getArray<TJsonRecord>(getRecord(payload)?.Materials)

  return materials.flatMap((material) =>
    getPathList(material.MaterialFilePath),
  )
}

const isAbsoluteUrl = (value: string) => /^https?:\/\//i.test(value)

const getNumber = (value: unknown) => {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue : undefined
}

const parseMaybeJson = (value: unknown): unknown => {
  if (typeof value !== "string") return value
  const trimmedValue = value.trim()
  if (!trimmedValue) return value
  if (
    !(
      (trimmedValue.startsWith("{") && trimmedValue.endsWith("}")) ||
      (trimmedValue.startsWith("[") && trimmedValue.endsWith("]"))
    )
  ) {
    return value
  }

  try {
    return JSON.parse(trimmedValue)
  } catch {
    return value
  }
}

const collectObjectCandidates = (
  value: unknown,
  acc: TJsonRecord[],
  seen: Set<unknown>,
  depth = 0,
) => {
  if (depth > 8 || value === null || value === undefined || seen.has(value)) {
    return
  }

  const parsedValue = parseMaybeJson(value)
  if (parsedValue !== value) {
    collectObjectCandidates(parsedValue, acc, seen, depth + 1)
    return
  }

  seen.add(value)

  if (Array.isArray(value)) {
    value.forEach((item) => collectObjectCandidates(item, acc, seen, depth + 1))
    return
  }

  const record = getRecord(value)
  if (!record) return

  acc.push(record)
  Object.values(record).forEach((item) =>
    collectObjectCandidates(item, acc, seen, depth + 1),
  )
}

const getAiResultCandidates = (...payloads: unknown[]) => {
  const candidates: TJsonRecord[] = []
  const seen = new Set<unknown>()

  payloads.forEach((payload) => {
    collectObjectCandidates(payload, candidates, seen)
  })

  return candidates
}

const getVisualEvidenceAssetMap = (
  candidates: TJsonRecord[],
): TVisualEvidenceAssetMap =>
  candidates.reduce<TVisualEvidenceAssetMap>((assetMap, candidate) => {
    const visualEvidence = getRecord(candidate.visual_evidence)
    getArray<TJsonRecord>(visualEvidence?.assets).forEach((asset) => {
      const assetId = getString(asset.asset_id)
      const url = getString(asset.url)
      if (!assetId || !url) return

      assetMap.set(assetId, {
        url,
        mimeType: getString(asset.mime_type) || undefined,
      })
    })
    return assetMap
  }, new Map<string, TVisualEvidenceAsset>())

const getFrameIdKey = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value)
  }
  return getString(value)
}

const getVisualEvidenceSegmentMap = (
  candidates: TJsonRecord[],
  assetMap: TVisualEvidenceAssetMap,
): TVisualEvidenceSegmentMap =>
  candidates.reduce<TVisualEvidenceSegmentMap>((segmentMap, candidate) => {
    const visualEvidence = getRecord(candidate.visual_evidence)
    getArray<TJsonRecord>(visualEvidence?.segments).forEach((segment) => {
      const asset = assetMap.get(getString(segment.asset_id))
      if (!asset?.url || !isMp4MimeType(asset.mimeType)) return

      const rawStartMs =
        segment.start_ms == null ? undefined : getNumber(segment.start_ms)
      const startMs = Math.max(0, rawStartMs ?? 0)

      getArray<unknown>(segment.keyframe_ids).forEach((frameId) => {
        const frameIdKey = getFrameIdKey(frameId)
        if (!frameIdKey || segmentMap.has(frameIdKey)) return

        segmentMap.set(frameIdKey, {
          url: asset.url,
          startMs,
        })
      })
    })
    return segmentMap
  }, new Map<string, TVisualEvidenceSegment>())

const getFindingMedia = (
  finding: TJsonRecord,
  assetMap: TVisualEvidenceAssetMap,
  segmentMap: TVisualEvidenceSegmentMap,
) => {
  const matchedAsset = assetMap.get(getString(finding.asset_id))
  const matchedSegment = segmentMap.get(getFrameIdKey(finding.frame_id))
  const timestampMs =
    finding.timestamp_ms == null ? undefined : getNumber(finding.timestamp_ms)
  return {
    imageUrl: matchedAsset?.url || getString(finding.url) || undefined,
    mimeType:
      matchedAsset?.mimeType || getString(finding.mime_type) || undefined,
    segmentVideoUrl: matchedSegment?.url,
    segmentInitialTimeMs: matchedSegment
      ? Math.max(0, (timestampMs ?? matchedSegment.startMs) - matchedSegment.startMs)
      : undefined,
  }
}

const hasMovieAiMarkers = (value: unknown) => {
  const record = getRecord(value)
  if (!record) return false

  return MOVIE_AI_RESULT_MARKERS.some((key) => key in record)
}

const resolveAiCheckType = (
  fileType?: string,
  filePath?: string,
  ...payloads: unknown[]
): TAiCheckType => {
  const normalizedFileType = String(fileType ?? "").trim().toLowerCase()
  const extension = getFileExtension(filePath)
  const aiResultCandidates = getAiResultCandidates(...payloads)

  if (aiResultCandidates.some(hasMovieAiMarkers)) {
    return "movie"
  }

  if (normalizedFileType.startsWith("video/") || MOVIE_FILE_EXTENSIONS.includes(extension)) {
    return "movie"
  }

  if (normalizedFileType.startsWith("image/") || IMAGE_FILE_EXTENSIONS.includes(extension)) {
    return "image"
  }

  return "book"
}

const parseAiResultPayload = (value?: string) => {
  try {
    return parseMaybeJson(JSON.parse(value || "{}"))
  } catch {
    return {}
  }
}

const hasAiResultContent = (value: unknown) => {
  const record = getRecord(value)
  if (!record) return false

  return [
    "ner_results",
    "ner_extra_info",
    "abstract",
    "standard_review",
    "analysis_report",
    "convert_speech2text",
    "comprehensive_evaluation",
    "book_title",
  ].some((key) => key in record)
}

const hasValue = (value: unknown) => {
  if (Array.isArray(value)) return value.length > 0
  return value !== undefined && value !== null && value !== ""
}

const normalizeNestedAiResultPayload = (payload: unknown): IJsonData => {
  const record = getRecord(payload)
  if (!record) return {} as IJsonData

  const files = getArray<TJsonRecord>(record.files)
  const firstFile = files[0]
  const firstFileData = getRecord(firstFile?.data)
  const innerAiResult = getRecord(firstFileData?.data)

  if (!innerAiResult) {
    return record as unknown as IJsonData
  }

  const fallbackPath = getString(firstFile?.path)
  const filePath = hasValue(innerAiResult.file_path)
    ? innerAiResult.file_path
    : fallbackPath
  const textUrl = hasValue(innerAiResult.text_url)
    ? innerAiResult.text_url
    : fallbackPath

  return {
    ...record,
    ...innerAiResult,
    comprehensive_evaluation: record.comprehensive_evaluation,
    files: record.files,
    file_path: filePath,
    text_url: textUrl,
  } as unknown as IJsonData
}

const AI_CATEGORY_LABELS = {
  political: "Political Sensitive",
  religious: "Religious Content",
  lgbt: "LGBT+ ",
  royal: "Royal Family",
  adult: "Adult Content",
  violence: "Violence & Hate Speech",
  child: "Child Protection",
  prohibited: "Prohibited Words",
} as const

// The newer AI payload labels its findings with its own taxonomy (NER entity
// types such as PERSON / SENSITIVE, child-safety category slugs) instead of the
// eight review categories this panel counts, so map what it sends onto them.
// Matching is case-insensitive and substring based; the first row that matches
// wins, and an unmapped label keeps its own group so no finding is dropped.
const AI_CATEGORY_KEYWORDS: Array<readonly [string, string[]]> = [
  [AI_CATEGORY_LABELS.child, ["child", "minor", "underage", "juvenile"]],
  [AI_CATEGORY_LABELS.royal, ["royal", "monarch", "ruler", "sheikh"]],
  [AI_CATEGORY_LABELS.lgbt, ["lgbt", "homosexual", "transgender", "queer"]],
  [AI_CATEGORY_LABELS.religious, ["religio", "blasphem", "sectarian"]],
  [AI_CATEGORY_LABELS.political, ["politic", "government", "separatis", "sovereign"]],
  [AI_CATEGORY_LABELS.violence, ["violen", "hate", "terror", "extremis", "weapon", "gore"]],
  [AI_CATEGORY_LABELS.adult, ["adult", "sexual", "porn", "nudity", "erotic", "infidelity", "mistress"]],
  [AI_CATEGORY_LABELS.prohibited, ["sensitive", "prohibit", "banned", "forbidden", "profan"]],
]

const resolveAiCategoryLabel = (label: string) => {
  const normalizedLabel = label.trim().toLowerCase()
  if (!normalizedLabel) return ""

  // The legacy payload already speaks in review categories.
  const knownLabel = Object.values(AI_CATEGORY_LABELS).find(
    (category) => category.trim().toLowerCase() === normalizedLabel,
  )
  if (knownLabel) return knownLabel

  return (
    AI_CATEGORY_KEYWORDS.find(([, keywords]) =>
      keywords.some((keyword) => normalizedLabel.includes(keyword)),
    )?.[0] ?? ""
  )
}

const appendRiskInfo = (
  acc: TAllergicItem,
  label: string,
  entities: string[],
  paraNum?: number,
  // The legacy payload keeps zero-count categories, so preserve them as-is;
  // only the synthesized ones are dropped when they carry nothing.
  keepEmpty = false,
) => {
  const resolvedParaNum = paraNum ?? entities.length
  if (!label || (!keepEmpty && entities.length === 0 && !resolvedParaNum)) {
    return acc
  }

  const existing = acc[label]
  const mergedEntities = Array.from(
    new Set([...(existing?.entities ?? []), ...entities]),
  )
  acc[label] = {
    entities: mergedEntities,
    // A derived count has to follow the deduped list, otherwise two sources
    // feeding the same category report more hits than the group can show.
    para_num:
      paraNum === undefined
        ? Math.max(existing?.para_num ?? 0, mergedEntities.length)
        : (existing?.para_num ?? 0) + paraNum,
  }

  return acc
}

const getStringList = (value: unknown) =>
  getArray<unknown>(value)
    .map((item) => getString(item))
    .filter(Boolean)

const humanizeReviewKey = (key: string) =>
  key.replace(/[_-]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())

// The review fields below render as plain text, so a structured payload has to
// be flattened before it reaches React.
const flattenReviewText = (value: unknown, depth = 0): string => {
  if (depth > 4) return ""
  if (typeof value === "string") return value.trim()
  if (typeof value === "number" || typeof value === "boolean") return String(value)

  if (Array.isArray(value)) {
    return value
      .map((item) => flattenReviewText(item, depth + 1))
      .filter(Boolean)
      .join("\n")
  }

  const record = getRecord(value)
  if (!record) return ""

  return Object.entries(record)
    .map(([key, item]) => {
      const text = flattenReviewText(item, depth + 1)
      return text ? `${humanizeReviewKey(key)}: ${text}` : ""
    })
    .filter(Boolean)
    .join("\n")
}

const normalizeNerResults = (value: unknown): TAllergicItem => {
  const record = getRecord(value)
  if (!record) return {}

  return Object.entries(record).reduce<TAllergicItem>((acc, [label, riskInfo]) => {
    const riskRecord = getRecord(riskInfo)
    // Newer payload: each label maps straight to its entity list.
    const entities = riskRecord
      ? getStringList(riskRecord.entities)
      : getStringList(riskInfo)

    return appendRiskInfo(
      acc,
      resolveAiCategoryLabel(label) || label,
      entities,
      riskRecord ? getNumber(riskRecord.para_num) : undefined,
      Boolean(riskRecord),
    )
  }, {})
}

// The newer payload repeats its flagged terms under `ner_extra_info`, which has
// no category of its own. Fold them into the same category the table already
// gives `ner_results.SENSITIVE`, so they reach the panel instead of ending up on
// a paragraph no consumer can render.
const collectExtraInfoSensitiveWords = (
  value: unknown,
  nerResults: TAllergicItem,
) => {
  const record = getRecord(value)
  if (!record) return

  appendRiskInfo(
    nerResults,
    AI_CATEGORY_LABELS.prohibited,
    getStringList(record.sensitive_words),
  )
}

// `children_unhealthy_content` is the only child-safety signal the newer payload
// carries, so route its categories through the same table instead of leaving the
// counter at zero while the payload reports the content as unhealthy.
const collectChildSafetyRisks = (
  value: unknown,
  nerResults: TAllergicItem,
) => {
  const record = getRecord(value)
  if (!record || record.is_unhealthy !== true) return

  getStringList(record.categories).forEach((category) => {
    const label = resolveAiCategoryLabel(category) || AI_CATEGORY_LABELS.child
    appendRiskInfo(nerResults, label, [category], 1)
  })
}

const normalizeNerExtraInfo = (
  value: unknown,
  assetMap: TVisualEvidenceAssetMap,
  segmentMap: TVisualEvidenceSegmentMap,
): IExtraInfo[] => {
  if (Array.isArray(value)) return value as IExtraInfo[]

  const record = getRecord(value)
  if (!record) return []

  const sensitiveWords = getStringList(record.sensitive_words)
  const findings = getArray<TJsonRecord>(record.findings)

  return findings.reduce<IExtraInfo[]>((items, finding) => {
    const label = resolveAiCategoryLabel(getString(finding.category))
    const evidence = getString(finding.evidence)
    const reason = getString(finding.reason)
    const media = getFindingMedia(finding, assetMap, segmentMap)
    if (!label || (!evidence && !reason)) return items

    const normalizedEvidence = evidence.toLocaleLowerCase()
    const getLocationValue = (location: unknown) => {
      if (typeof location === "number" && Number.isFinite(location)) return location
      return getString(location) || undefined
    }

    items.push({
      paragraph_content: evidence,
      reason: reason || undefined,
      ...media,
      tags: [label],
      entities: sensitiveWords.filter((word) =>
        normalizedEvidence.includes(word.toLocaleLowerCase()),
      ),
      ner_page: getLocationValue(finding.page_no),
      ner_paragraph: getLocationValue(finding.para_no),
      timestampMs:
        finding.timestamp_ms == null
          ? undefined
          : getNumber(finding.timestamp_ms),
    })
    return items
  }, [])
}

const normalizeVisualFindings = (
  value: unknown,
  assetMap: TVisualEvidenceAssetMap,
  segmentMap: TVisualEvidenceSegmentMap,
): IExtraInfo[] => {
  const record = getRecord(value)
  if (!record) return []

  return getArray<TJsonRecord>(record.visual_findings).reduce<IExtraInfo[]>(
    (items, finding) => {
      const rawCategory = getString(finding.category)
      const label = resolveAiCategoryLabel(rawCategory) || rawCategory
      const evidence = getString(finding.evidence)
      const reason = getString(finding.reason)
      const media = getFindingMedia(finding, assetMap, segmentMap)
      if (!label || (!evidence && !reason)) return items

      const pageNo =
        typeof finding.page_no === "number" && Number.isFinite(finding.page_no)
          ? finding.page_no
          : getString(finding.page_no) || undefined

      items.push({
        paragraph_content: evidence,
        reason: reason || undefined,
        ...media,
        tags: [label],
        entities: [],
        ner_page: pageNo,
        timestampMs:
          finding.timestamp_ms == null
            ? undefined
            : getNumber(finding.timestamp_ms),
      })

      return items
    },
    [],
  )
}

// The AI engine answers with two payload shapes for the same review fields:
// the legacy one keeps ner_results entries as {entities, para_num}, ner_extra_info
// as a paragraph list and standard_review / analysis_report / people_label as
// plain strings; the newer one sends entity arrays, a {sensitive_words, findings}
// record and structured review objects. Normalize the newer shape into the
// legacy one so both responses render instead of throwing.
const normalizeAiResultSchema = (
  aiResult: IJsonData,
  assetMap: TVisualEvidenceAssetMap,
  segmentMap: TVisualEvidenceSegmentMap,
): IJsonData => {
  const record = getRecord(aiResult)
  if (!record) return aiResult

  const nerResults = normalizeNerResults(record.ner_results)
  collectExtraInfoSensitiveWords(record.ner_extra_info, nerResults)
  collectChildSafetyRisks(
    record.children_unhealthy_content,
    nerResults,
  )
  const normalized: TJsonRecord = {
    ...record,
    ner_results: nerResults,
    ner_extra_info: normalizeNerExtraInfo(
      record.ner_extra_info,
      assetMap,
      segmentMap,
    ),
    visual_findings: normalizeVisualFindings(
      record.ner_extra_info,
      assetMap,
      segmentMap,
    ),
  }

  // Every field here reaches JSX as a raw React child, so a structured payload
  // in any one of them would throw the same "not valid as a React child" error.
  const TEXT_FIELDS = [
    "standard_review",
    "analysis_report",
    "people_label",
    "abstract",
    "book_title",
    "author_name",
    "language",
  ] as const
  TEXT_FIELDS.forEach((key) => {
    const rawValue = record[key]
    if (rawValue != null && typeof rawValue !== "string") {
      normalized[key] = flattenReviewText(rawValue)
    }
  })

  return normalized as unknown as IJsonData
}

const getNormalizedAiResult = (
  aiCheckType: TAiCheckType,
  ...payloads: unknown[]
) => {
  const aiResultCandidates = getAiResultCandidates(...payloads)
  const visualEvidenceAssetMap = getVisualEvidenceAssetMap(aiResultCandidates)
  const visualEvidenceSegmentMap = getVisualEvidenceSegmentMap(
    aiResultCandidates,
    visualEvidenceAssetMap,
  )

  if (aiCheckType === "movie") {
    return normalizeAiResultSchema(
      (aiResultCandidates.find((candidate) => hasMovieAiMarkers(candidate)) ??
        ({} as IJsonData)) as IJsonData,
      visualEvidenceAssetMap,
      visualEvidenceSegmentMap,
    )
  }

  const aiResult =
    aiResultCandidates.find((candidate) => hasAiResultContent(candidate)) ??
    ({} as IJsonData)

  return normalizeAiResultSchema(
    normalizeNestedAiResultPayload(aiResult),
    visualEvidenceAssetMap,
    visualEvidenceSegmentMap,
  )
}

const formatVideoTimestamp = (seconds: number) => {
  const safeSeconds = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)
  const secs = safeSeconds % 60

  return [hours, minutes, secs]
    .map((value) => String(value).padStart(2, "0"))
    .join(":")
}

const getMovieSpeechRecord = (aiResult: IJsonData): TMovieSpeechRecord | null => {
  const speechCandidates = [
    aiResult?.convert_speech2text?.convert_speech2text,
    aiResult?.convert_speech2text,
    getRecord((aiResult as unknown as TJsonRecord)?.speech2text),
    getRecord((aiResult as unknown as TJsonRecord)?.speech_to_text),
    getRecord((aiResult as unknown as TJsonRecord)?.asr_result),
  ]

  return (
    speechCandidates.find((candidate) => {
      const record = getRecord(candidate)
      return record && ("segments" in record || "language" in record)
    }) ?? null
  ) as TMovieSpeechRecord | null
}

const getMovieSummary = (aiResult: IJsonData) => {
  const comprehensiveEvaluation = getRecord(
    (aiResult as unknown as TJsonRecord)?.comprehensive_evaluation,
  )

  return (
    getString(comprehensiveEvaluation?.final_standard_review) ||
    getString(aiResult?.standard_review) ||
    getString(aiResult?.analysis_report) ||
    getString(aiResult?.abstract)
  )
}

const getMovieLanguage = (aiResult: IJsonData) => {
  const speechRecord = getMovieSpeechRecord(aiResult)
  return (
    getString(speechRecord?.language) ||
    getString(aiResult?.language) ||
    "-"
  )
}

const getMovieDisplayName = (
  aiResult: IJsonData,
  files?: IProps["conflictFiles"][number],
) =>
  getString(files?.title) ||
  getString(files?.filePath?.split("/").pop()) ||
  getString(getFirstPathString(aiResult?.file_path).split("/").pop()) ||
  "-"

const getMovieMeta = (aiResult: IJsonData) => {
  const speechRecord = getMovieSpeechRecord(aiResult)
  return [
    getString(speechRecord?.language).toUpperCase(),
    getString(aiResult?.data_quality),
    getString(aiResult?.people_label),
  ].filter(Boolean)
}

const buildMovieSubjectMap = (
  aiResult: IJsonData,
  confidenceScore: number,
): Record<string, TSubjects> => {
  const findingItems = [
    ...getArray<IExtraInfo>(aiResult?.ner_extra_info),
    ...getArray<IExtraInfo>(aiResult?.visual_findings),
  ]

  return findingItems.reduce<Record<string, TSubjects>>((subjects, item) => {
    const timeRange =
      item.timeRange ??
      (typeof item.timestampMs === "number" && Number.isFinite(item.timestampMs)
        ? formatVideoTimestamp(item.timestampMs / 1000)
        : undefined)
    const tags = item.tags ?? []

    tags.forEach((tag) => {
      if (!tag) return

      if (!subjects[tag]) {
        subjects[tag] = {
          confidence_score: confidenceScore,
          icon: FILE_RELATED.find((relatedItem) => relatedItem.label === tag)?.icon ?? "",
          value: [],
        }
      }

      subjects[tag].value.push({
        ...item,
        timeRange,
      })
    })

    return subjects
  }, {})
}

const FILE_RELATED = [
  {
    icon: shieldWarningIcon,
    label: AI_CATEGORY_LABELS.political,
  },
  {
    icon: intersectThreeIcon,
    label: AI_CATEGORY_LABELS.religious,
  },
  {
    icon: lgbtIcon,
    label: AI_CATEGORY_LABELS.lgbt,
  },
  {
    icon: crownIcon,
    label: AI_CATEGORY_LABELS.royal,
  },
  {
    icon: adultIcon,
    label: AI_CATEGORY_LABELS.adult,
  },
  {
    icon: handFistIcon,
    label: AI_CATEGORY_LABELS.violence,
  },
  {
    icon: babyIcon,
    label: AI_CATEGORY_LABELS.child,
  },
  {
    icon: prohibitIcon,
    label: AI_CATEGORY_LABELS.prohibited,
  },
]

export const AIContentCheck: FC<IProps> = (props) => {
  const { t } = useTranslation()
  const expandContext = useContext(ExpandContext)
  const { aiContent, conflictFiles } = props
  const [clickItem, setClickItem] = useState<string>("All")
  const [activeTabs, setActiveTabs] = useState<Record<string, TEvidenceTab>>({})
  const [previewVisible, setPreviewVisible] = useState(false)
  const [moviePreviewVisible, setMoviePreviewVisible] = useState(false)
  const [currentPreviewFileData, setCurrentPreviewFileData] =
    useState<TPreviewFileData | null>(null)
  const [evidencePreviewData, setEvidencePreviewData] =
    useState<TEvidencePreviewData | null>(null)
  const [currentPdfFileData, setCurrentPdfFileData] =
    useState<TPreviewFileData | null>(null)
  const [pdfVisible, setPdfVisible] = useState(false)
  const [pdfUrl, setPdfUrl] = useState("")
  const [scale, setScale] = useState(100)
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [pdfPassword, setPdfPassword] = useState("")
  const [passwordError, setPasswordError] = useState("")
  const [passwordCallback, setPasswordCallback] = useState<
    ((password: string) => void) | null
  >(null)
  const [aiCheckType, setAiCheckType] = useState<TAiCheckType>("book")
  const [isDownloading, setIsDownloading] = useState(false)
  const isMountedRef = useRef(true)
  // pdf.js fetches the file itself and cannot attach the bearer token, so the
  // protected preview endpoint is streamed through the authenticated client.
  const authenticatedPdfUrl = useAuthenticatedDocumentUrl(pdfUrl)
  const files = conflictFiles?.[0]
  const parsedContentAiPayload = useMemo(
    () => parseAiResultPayload(aiContent?.aiResult),
    [aiContent?.aiResult],
  )
  const parsedFileAiPayload = useMemo(
    () => parseAiResultPayload(files?.aiResult),
    [files?.aiResult],
  )

  useEffect(() => {
    setAiCheckType(
      resolveAiCheckType(
        files?.fileType,
        files?.filePath,
        parsedContentAiPayload,
        parsedFileAiPayload,
      ),
    )
  }, [files?.filePath, files?.fileType, parsedContentAiPayload, parsedFileAiPayload])

  const aiResult = useMemo(
    () => getNormalizedAiResult(aiCheckType, parsedContentAiPayload, parsedFileAiPayload),
    [aiCheckType, parsedContentAiPayload, parsedFileAiPayload],
  )
  // TODO: Remove these leftover debug logs once the AI payload work is signed off.
  console.log(610,aiResult)
  const isVideo = aiCheckType === "movie"
  const videoCoverUrl = getFirstPathString(aiResult?.keyframe_urls)
  const pdfCoverUrl = getFirstPathString(aiResult?.pdf_cover_image_url)
  const [hasVideoCoverError, setHasVideoCoverError] = useState(false)
  const [hasPdfCoverError, setHasPdfCoverError] = useState(false)

  useEffect(() => {
    setHasVideoCoverError(false)
  }, [videoCoverUrl])

  useEffect(() => {
    setHasPdfCoverError(false)
  }, [pdfCoverUrl])

  const coverUrl = isVideo
    ? videoCoverUrl && !hasVideoCoverError
      ? videoCoverUrl
      : BookDefaultVideioCover
    : pdfCoverUrl && !hasPdfCoverError
      ? pdfCoverUrl
      : bookCoverIcon

  const displayInfo = useMemo(() => {
    if (!isVideo) {
      return {
        language: aiResult?.language || "-",
        name: aiResult?.book_title || "-",
        authorName: aiResult?.author_name || "-",
        // TODO: Strip the model's <think>...</think> reasoning block from the
        // abstract; the older AI payload still leaks it into the summary.
        summary: getReviewText(aiResult?.abstract) || "-",
      }
    }

    const movieMeta = getMovieMeta(aiResult)

    return {
      language: getMovieLanguage(aiResult),
      name: getMovieDisplayName(aiResult, files),
      authorName: movieMeta.length > 0 ? movieMeta.join(" · ") : "-",
      summary: getReviewText(aiResult?.abstract) || "-",
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiResult, files?.title, isVideo])

  const previewFileList = useMemo(() => {
    const candidatePaths = [
      ...getPathList(files?.filePath),
      ...getPathList(aiResult?.file_path),
      ...getMaterialFilePaths(parsedContentAiPayload),
    ]
    const uniquePaths = Array.from(new Set(candidatePaths))

    return uniquePaths.map((filePath, index) => {
      const encodedFilePath = (() => {
        try {
          return encodeURIComponent(decodeURIComponent(filePath))
        } catch {
          return encodeURIComponent(filePath)
        }
      })()

      const fileName = (() => {
        const rawName =
          filePath.split("/").pop() ||
          (index === 0 ? displayInfo.name : `${displayInfo.name || "video"}-${index + 1}`) ||
          "preview-file"
        try {
          return decodeURIComponent(rawName)
        } catch {
          return rawName
        }
      })()

      return {
        name: fileName,
        url: isAbsoluteUrl(filePath)
          ? filePath
          : `${ImageBaseUrl}${encodedFilePath}`,
        filePath,
      }
    })
  }, [
    aiResult?.file_path,
    displayInfo.name,
    files?.filePath,
    parsedContentAiPayload,
  ])

  const previewFileData = previewFileList[0] ?? null

  console.log('aiResult', aiResult)

  const getSubjectLabel = (label: string) =>
    t(`Content.contentApplicationsDetails.aiContentCheck.subjects.${label}`, { defaultValue: label })

  const ALLERGIC_SUBJECTS = useMemo(() => {
    const confidenceLevel = aiResult?.confidence_score || 0

    if (isVideo) {
      return buildMovieSubjectMap(aiResult, confidenceLevel)
    }

    const paragraphs = getArray<IExtraInfo>(aiResult?.ner_extra_info)
    const subjects: Record<string, TSubjects> = {}
    paragraphs.forEach((item) =>
      (item?.tags ?? []).forEach((tag) => {
        const searchIcon = FILE_RELATED.find((v) => v.label === tag) ?? {
          icon: "",
        }
        if (!Reflect.has(subjects, tag)) {
          subjects[tag] = {
            confidence_score: confidenceLevel,
            icon: searchIcon.icon,
            value: [item],
          }
        } else {
          subjects[tag].value.push(item)
        }
      })
    )
    return subjects
  }, [aiResult, isVideo])

  const VISUAL_SUBJECTS = useMemo(() => {
    if (isVideo) return {}

    const confidenceLevel = aiResult?.confidence_score || 0
    const subjects: Record<string, TSubjects> = {}
    getArray<IExtraInfo>(aiResult?.visual_findings).forEach((item) =>
      (item?.tags ?? []).forEach((tag) => {
        const searchIcon = FILE_RELATED.find((value) => value.label === tag) ?? {
          icon: "",
        }
        if (!Reflect.has(subjects, tag)) {
          subjects[tag] = {
            confidence_score: confidenceLevel,
            icon: searchIcon.icon,
            value: [item],
          }
        } else {
          subjects[tag].value.push(item)
        }
      }),
    )
    return subjects
  }, [aiResult, isVideo])

  const ALLERGIC_ITEMS = FILE_RELATED.map((item) => {
    const textCount = ALLERGIC_SUBJECTS[item.label]?.value?.length ?? 0
    const imageCount = VISUAL_SUBJECTS[item.label]?.value?.length ?? 0
    const value = textCount + imageCount
    return {
      ...item,
      cls: value > 0 ? "has-allergic-words" : "normal-words",
      vCls: value > 0 ? "allergic-value" : "normal-value",
      value,
    }
  })

  const resetPdfAuthState = () => {
    setPasswordVisible(false)
    setPdfPassword("")
    setPasswordError("")
    setPasswordCallback(null)
  }

  const closePdfPreview = () => {
    setPdfVisible(false)
    resetPdfAuthState()
    setScale(100)
    setPdfUrl("")
    setCurrentPdfFileData(null)
  }

  const openPdfPreview = (fileData: TPreviewFileData, url: string) => {
    setCurrentPreviewFileData(null)
    setPreviewVisible(false)
    setCurrentPdfFileData({
      ...fileData,
      url,
    })
    setPdfUrl(url)
    setScale(100)
    resetPdfAuthState()
    setPdfVisible(true)
  }

  const onPassword = (callback: (password: string) => void, reason: number) => {
    if (reason === PasswordResponses.INCORRECT_PASSWORD) {
      setPasswordError(t("sharedComponents.previewModal.password.incorrect"))
    }
    if (reason === PasswordResponses.NEED_PASSWORD) {
      setPasswordError("")
    }
    setPasswordCallback(() => callback)
    setPasswordVisible(true)
  }

  const handlePasswordSubmit = () => {
    if (!pdfPassword.trim()) {
      setPasswordError(t("sharedComponents.previewModal.password.required"))
      return
    }

    if (passwordCallback) {
      setPasswordError("")
      passwordCallback(pdfPassword)
    }
  }

  const handleZoomIn = () => {
    setScale((currentScale) => Math.min(200, currentScale + 10))
  }

  const handleZoomOut = () => {
    setScale((currentScale) => Math.max(50, currentScale - 10))
  }

  const renderFileBriefInfo = () => {
    const onPreview = () => {
      if (!previewFileData) return
      const isPdf = isPdfFile(
        previewFileData.name,
        previewFileData.filePath,
        previewFileData.url,
      )
      const resolvedUrl = isPdf
        ? resolvePdfPreviewUrl(previewFileData.url, previewFileData.filePath)
        : resolveDocumentAccessUrl(previewFileData.url)

      if (isPdf) {
        if (!resolvedUrl) return
        openPdfPreview(previewFileData, resolvedUrl)
      } else {
        closePdfPreview()
        setCurrentPreviewFileData({
          ...previewFileData,
          url: resolvedUrl,
        })
        setPreviewVisible(true)
      }
    }

    const onDownload = async () => {
    // Native <a download> cannot attach the Admin bearer token, so the protected
    // download endpoint is streamed through the authenticated client first.
    if (!previewFileData || isDownloading) return
    setIsDownloading(true)
    let objectUrl = ""
    try {
      const resolvedSource = await loadAuthenticatedDocumentSource(
      previewFileData.url,
      )
      objectUrl = resolvedSource.objectUrl || ""
      createDownload(resolvedSource.source, previewFileData.name)
    } catch {
      CustomMessage.error(
      t("Content.contentApplicationsDetails.aiContentCheck.downloadFailed"),
      )
    } finally {
      if (objectUrl) {
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
      }
      if (isMountedRef.current) {
      setIsDownloading(false)
      }
    }
    }

    const onMoviePreview = () => {
      if (!previewFileData) return
      setMoviePreviewVisible(true)
    }
    return (
      <div className="brief-info-container">
        <img
          className="book-cover"
          src={coverUrl}
          onError={
            isVideo
              ? videoCoverUrl && !hasVideoCoverError
                ? () => setHasVideoCoverError(true)
                : undefined
              : pdfCoverUrl && !hasPdfCoverError
                ? () => setHasPdfCoverError(true)
                : undefined
          }
        />
        <div className="book-detail">
          <div className="book-title">
            <div className="title-name">{displayInfo.name}</div>
            <div className="btn-container">
              {aiCheckType === "book" && (
                <Button
                  className="preview-btn"
                  icon={<EyeOutlined />}
                  aria-label={t("Content.contentApplicationsDetails.aiContentCheck.preview")}
                  disabled={!previewFileData}
                  onClick={onPreview}
                >
                  <span className="ai-content-check__action-label">
                    {t("Content.contentApplicationsDetails.aiContentCheck.preview")}
                  </span>
                </Button>
              )}
              {["movie", "video"].includes(aiCheckType) && (
                <Button
                  className="preview-btn"
                  icon={<EyeOutlined />}
                  aria-label={t("Content.contentApplicationsDetails.aiContentCheck.preview")}
                  disabled={!previewFileData}
                  onClick={onMoviePreview}
                >
                  <span className="ai-content-check__action-label">
                    {t("Content.contentApplicationsDetails.aiContentCheck.preview")}
                  </span>
                </Button>
              )}
              <Button
                className="download-btn"
                icon={<DownloadOutlined />}
                aria-label={t("Content.contentApplicationsDetails.aiContentCheck.download")}
                disabled={!previewFileData || isDownloading}
                loading={isDownloading}
                onClick={onDownload}
              >
                <span className="ai-content-check__action-label">
                  {t("Content.contentApplicationsDetails.aiContentCheck.download")}
                </span>
              </Button>
            </div>
          </div>
          <div>{displayInfo.authorName}</div>
          <div>
            <div className="book-summary">
              <span className="summary-name">
                {isVideo
                  ? t("Content.contentApplicationsDetails.aiContentCheck.aiSummary")
                  : t("Content.contentApplicationsDetails.aiContentCheck.aiBookSummary")}
              </span>
              <img src={magicWandIcon} className="magic-wand-icon" />
            </div>
            <p className="summary-desc">{displayInfo.summary}</p>
          </div>
        </div>
      </div>
    )
  }

  const renderWarningPanel = () => {
    const isApprove = aiResult?.is_compliant === true
    const isReject = aiResult?.is_compliant === false
    const statusTitle = isApprove
      ? t("Content.contentApplicationsDetails.aiContentCheck.strongApprove")
      : isReject
        ? t("Content.contentApplicationsDetails.aiContentCheck.strongReject")
        : "-"
    const warningDesc =
    (isVideo
      ? getMovieSummary(aiResult)
      : "") || getReviewText(aiResult?.standard_review)

    const renderApplyStatus = () =>
      isApprove ? (
        <img src={checkCircleIcon} className="approve-icon" />
      ) : isReject ? (
        <img src={warningRedIcon} className="warning-icon" />
      ) : null
    return (
      <div className={`warning-panel ${isApprove ? "approve-panel" : ""}`}>
        {renderApplyStatus()}
        <div className="warning-content">
          <b className={`warning-title ${isApprove ? "approve-title" : ""}`}>
            {statusTitle}
          </b>
          <p className="warning-desc">{warningDesc}</p>
        </div>
      </div>
    )
  }

  const renderBriefAllergicSubjects = () => (
    <div className="allergic-content">
        {/* {item.icon && <img src={item.icon} alt={item.label} />} */}
      {/* <div className={`display-item normal-words`} key="all">
        <p className="item-label">{t("Content.contentApplicationsDetails.aiContentCheck.all")}</p>
        <b className={`item-value normal-words`}>{sumConut(ALLERGIC_ITEMS)}</b>
      </div> */}
      {ALLERGIC_ITEMS.map((item) => (
        <div className={`display-item ${item.cls}`} key={item.label}>
          {item.icon && <img src={item.icon} alt={item.label} />}
          <p className="item-label">{getSubjectLabel(item.label)}</p>
          <b className={`item-value ${item.vCls}`}>{item.value }</b>
        </div>
      ))}
    </div>
  )

  // click item to filter
  const onClickItem = (item: string) => {
    setClickItem(item)
  }

  const onEvidenceTabChange = (subject: string, key: string) => {
    if (key !== "text" && key !== "image") return
    setActiveTabs((current) => ({ ...current, [subject]: key }))
  }

  const onEvidenceMediaPreview = (item: IExtraInfo, index: number) => {
    const url = isVideo
      ? getString(item.segmentVideoUrl)
      : getString(item.imageUrl)
    if (!url) return

    const mediaType = isVideo || isMp4MimeType(item.mimeType) ? "video" : "image"
    const fallbackName =
      mediaType === "video" ? `evidence-${index + 1}.mp4` : `evidence-${index + 1}`
    const initialTimeMs =
      typeof item.segmentInitialTimeMs === "number" &&
      Number.isFinite(item.segmentInitialTimeMs)
        ? Math.max(0, item.segmentInitialTimeMs)
        : 0

    setEvidencePreviewData({
      mediaType,
      autoPlay: isVideo,
      initialTime: isVideo ? initialTimeMs / 1000 : undefined,
      fileData: {
        name: getMediaPreviewName(url, fallbackName),
        url,
      },
    })
  }

  const renderMoreContent = () => {
    const renderAllergicSubjects = () => {
      const subjectKeys = Array.from(
        new Set([
          ...Object.keys(ALLERGIC_SUBJECTS),
          ...Object.keys(VISUAL_SUBJECTS),
        ]),
      )
      const total = subjectKeys.reduce(
        (count, subject) =>
          count +
          (ALLERGIC_SUBJECTS[subject]?.value?.length ?? 0) +
          (VISUAL_SUBJECTS[subject]?.value?.length ?? 0),
        0,
      )
      return (
        <div className="preview-items">
          <div
            className={`all-item ${clickItem === "All" ? "active-item" : ""}`}
            onClick={() => setClickItem("All")}
          >
            {t("Content.contentApplicationsDetails.aiContentCheck.all")} <span className="all-item-value">{total}</span>
          </div>
          {ALLERGIC_ITEMS.map((item) => (
            <div
              className={`display-item ${item.cls} ${
                clickItem === item.label ? "active-item" : ""
              }`}
              key={item.label}
              onClick={() => onClickItem(item.label)}
            >
              <img src={item.icon} alt={item.label} />
              <p className="item-label">{getSubjectLabel(item.label)}</p>
              <b className={`item-value ${item.vCls}`}>{item.value}</b>
            </div>
          ))}
        </div>
      )
    }
    const renderEveryItemContent = () => {
      const allSubjects = Array.from(
        new Set([
          ...Object.keys(ALLERGIC_SUBJECTS),
          ...Object.keys(VISUAL_SUBJECTS),
        ]),
      )
      const subjects = clickItem === "All" ? allSubjects : [clickItem]
      // check if clickItem is list in the obj and do not click All
      if (
        subjects.length === 0 ||
        (clickItem !== "All" &&
          !ALLERGIC_SUBJECTS[clickItem] &&
          !VISUAL_SUBJECTS[clickItem])
      ) {
        return (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={t("Content.contentApplicationsDetails.aiContentCheck.noEvidence")}
          />
        )
      }
      return (
        <div className="conflict-container">
          {subjects.map((item) => {
            const textSubject = ALLERGIC_SUBJECTS[item]
            const visualSubject = VISUAL_SUBJECTS[item]
            const subjectInfo = textSubject ?? visualSubject
            const textItems = textSubject?.value ?? []
            const imageItems = visualSubject?.value ?? []
            const hasImageEvidence = imageItems.length > 0
            const defaultTab: TEvidenceTab =
              textItems.length > 0 || !hasImageEvidence ? "text" : "image"
            const selectedTab = isVideo ? "text" : activeTabs[item] ?? defaultTab
            const activeTab: TEvidenceTab =
              selectedTab === "image" && !hasImageEvidence ? "text" : selectedTab
            const evidenceItems = activeTab === "image" ? imageItems : textItems

            return (
              <div className="conflict-item" key={item}>
                <div className="conflict-title">
                  <p className="item-label">
                    {subjectInfo?.icon ? (
                      <img src={subjectInfo.icon} alt={item} />
                    ) : null}
                    <span className="label-style">{getSubjectLabel(item as string)}</span>
                  </p>
                </div>
                {!isVideo ? (
                  <Tabs
                    activeKey={activeTab}
                    onChange={(key) => onEvidenceTabChange(item, key)}
                  >
                    <Tabs.TabPane
                      tab={t("Content.contentApplicationsDetails.aiContentCheck.text")}
                      key="text"
                    />
                    {hasImageEvidence ? (
                      <Tabs.TabPane
                        tab={t("Content.contentApplicationsDetails.aiContentCheck.image")}
                        key="image"
                      />
                    ) : null}
                  </Tabs>
                ) : null}
                {evidenceItems.length > 0 ? (
                  evidenceItems.map((v, index) => {
                    const isVideoEvidence = isMp4MimeType(v.mimeType)
                    const showEvidenceMedia =
                      Boolean(v.imageUrl) && (isVideo || activeTab === "image")
                    const canPreviewEvidence =
                      !isVideo || Boolean(v.segmentVideoUrl)

                    return (
                      <div className="political-sensitive" key={`${item}-${activeTab}-${index}`}>
                        {showEvidenceMedia ? (
                          <button
                            type="button"
                            className={`ai-content-check__evidence-media ${
                              isVideo || isVideoEvidence
                                ? "ai-content-check__evidence-media--landscape"
                                : ""
                            }`}
                            onClick={() => onEvidenceMediaPreview(v, index)}
                            disabled={!canPreviewEvidence}
                            aria-label={
                              isVideo
                                ? t("sharedComponents.moviePreviewModal.play")
                                : t("Content.contentApplicationsDetails.aiContentCheck.preview")
                            }
                          >
                            {isVideoEvidence ? (
                              <video
                                className="ai-content-check__evidence-media-content ai-content-check__evidence-media-content--video"
                                src={v.imageUrl}
                                muted
                                playsInline
                                preload="metadata"
                              />
                            ) : (
                              <img
                                className="ai-content-check__evidence-media-content"
                                src={v.imageUrl}
                                alt=""
                              />
                            )}
                            {isVideo && canPreviewEvidence ? (
                              <img
                                className="ai-content-check__evidence-play"
                                src={PlayCircle}
                                alt=""
                              />
                            ) : null}
                          </button>
                        ) : null}
                        <div className="conflict-content">
                          {!isVideo && v.ner_page != null ? (
                            <p className="paragraph-value">
                              {activeTab === "image" || v.ner_paragraph == null
                                ? t("Content.contentApplicationsDetails.aiContentCheck.page", {
                                    page: v.ner_page,
                                  })
                                : t("Content.contentApplicationsDetails.aiContentCheck.pageParagraph", {
                                    page: v.ner_page,
                                    paragraph: v.ner_paragraph,
                                  })}
                            </p>
                          ) : null}
                          {isVideo && v.timeRange ? (
                            <p className="paragraph-value-video">
                              <img src={play} alt="" />{" "}
                              {t("Content.contentApplicationsDetails.aiContentCheck.timestamp")}: {v.timeRange}
                            </p>
                          ) : null}
                          {v.paragraph_content ? (
                            <p className="conflict-value">
                              "
                              <HighlightKeyword
                                text={v.paragraph_content}
                                keyword={v.entities}
                              />
                              "
                            </p>
                          ) : null}
                          {v.reason ? <p className="conflict-value">{v.reason}</p> : null}
                          <div className="conflict-detail">
                            <div className="detail-item">
                              <img src={monitorIcon} alt="" />
                              <span className="detail-label-style">
                                {t("Content.contentApplicationsDetails.aiContentCheck.detectionType")}:
                                {v.tags?.join(", ")}
                              </span>
                            </div>
                            <div className="detail-item">
                              <img src={foldFinishmentIcon} alt="" />
                              <span className="detail-label-style">
                                {t("Content.contentApplicationsDetails.aiContentCheck.confidenceLevel")}:
                                {(subjectInfo?.confidence_score ?? 0) * 100}%
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={t("Content.contentApplicationsDetails.aiContentCheck.noEvidence")}
                  />
                )}
              </div>
            )
          })}
        </div>
      )
    }

    const renderAllergicContent = () => {
      return (
        <div className="display-more-content">
          {renderAllergicSubjects()}
          <Divider dashed />
          {renderEveryItemContent()}
        </div>
      )
    }

    return (
      <div className="file-display">
        {renderWarningPanel()}
        {renderAllergicContent()}
      </div>
    )
  }

  const renderExpandBtn = () => {
    const { ai: isExpanded } = expandContext?.whichIsExpanded || {}
    return (
      <ExpandBtn
        isExpanded={isExpanded || false}
        onExpandClick={() => expandContext?.dispatch?.({ ai: true })}
        onShrinkClick={() => expandContext?.dispatch?.({ ai: false })}
      />
    )
  }

  const renderExpandContent = () => {
    
    switch (expandContext?.whichIsExpanded?.ai) {
      case true:
        return (
          <>
            {renderFileBriefInfo()}
            {renderMoreContent()}
          </>
        )
      case false:
      default:
        return (
          <>
            {renderFileBriefInfo()}
            {renderWarningPanel()}
            {renderBriefAllergicSubjects()}
          </>
        )
    }
  }
  return ["3", "4"].includes(aiContent?.aiStatus?.toString()) ? (
    <div className="linear-background">
      <div className="ai-content-check">
        <div className="content-title">
          <img src={aiIcon} alt="" />
          <div className="title-content">
            <b>{t("Content.contentApplicationsDetails.aiContentCheck.title")}</b>
            <p className="title-desc">
              {t("Content.contentApplicationsDetails.aiContentCheck.desc")} {t("Content.contentApplicationsDetails.aiContentCheck.detectionTime")}:{" "}
              {moment(aiContent?.aiCheckTime).format("DD/MM/YYYY HH:mm:ss")}
            </p>
          </div>
          {renderExpandBtn()}
        </div>
        {renderExpandContent()}
        {currentPreviewFileData && !isVideo ? (
          <PreviewModal
            visible={previewVisible}
            fileData={currentPreviewFileData}
            onCancel={() => {
              setPreviewVisible(false)
              setCurrentPreviewFileData(null)
            }}
          />
        ) : null}
        {evidencePreviewData?.mediaType === "image" ? (
          <PreviewModal
            visible
            fileData={evidencePreviewData.fileData}
            onCancel={() => setEvidencePreviewData(null)}
          />
        ) : null}
        {evidencePreviewData?.mediaType === "video" ? (
          <MoviePreviewModal
            visible
            fileData={evidencePreviewData.fileData}
            initialTime={evidencePreviewData.initialTime}
            autoPlay={evidencePreviewData.autoPlay}
            onCancel={() => setEvidencePreviewData(null)}
          />
        ) : null}
        <Modal
          title={currentPdfFileData?.name || t("sharedComponents.previewModal.defaultTitle")}
          visible={pdfVisible}
          onCancel={closePdfPreview}
          width="90vw"
          className="ai-content-check-pdf-modal"
          style={{ maxWidth: "1200px", top: 20 }}
          footer={null}
          centered
          destroyOnClose
        >
          <div className="ai-content-check-pdf-preview-shell">
            {authenticatedPdfUrl ? (
            <div className="ai-content-check-pdf-stage">
            <PdfScrollPreview
            file={authenticatedPdfUrl}
                  scale={scale}
                  className="ai-content-check-pdf-preview"
                  onDocumentLoadSuccess={resetPdfAuthState}
                  onPassword={onPassword}
                />
                <div className="pdf-preview-toolbar">
                  <MinusOutlined
                    className={`pdf-preview-toolbar__button ${scale <= 50 ? "is-disabled" : ""}`}
                    onClick={scale <= 50 ? undefined : handleZoomOut}
                  />
                  <span className="pdf-preview-toolbar__value">{scale}%</span>
                  <PlusOutlined
                    className={`pdf-preview-toolbar__button ${scale >= 200 ? "is-disabled" : ""}`}
                    onClick={scale >= 200 ? undefined : handleZoomIn}
                  />
                </div>
              </div>
            ) : null}
          </div>
        </Modal>
        <Modal
          centered
          title={t("sharedComponents.previewModal.password.title")}
          visible={passwordVisible}
          onCancel={closePdfPreview}
          footer={[
            <Button key="cancel" onClick={closePdfPreview}>
              {t("common.cancel")}
            </Button>,
            <Button key="submit" type="primary" onClick={handlePasswordSubmit}>
              {t("common.confirm")}
            </Button>,
          ]}
          className="ai-content-check-password-modal"
          destroyOnClose
          zIndex={1001}
          closable={false}
          maskClosable={false}
        >
          <div className="ai-content-check-password-modal__body">
            <div>
              {t("sharedComponents.previewModal.password.description")}
            </div>
            <Input.Password
              value={pdfPassword}
              onChange={(e) => {
                setPdfPassword(e.target.value)
                if (passwordError) {
                  setPasswordError("")
                }
              }}
              onPressEnter={handlePasswordSubmit}
              placeholder={t("sharedComponents.previewModal.password.placeholder")}
              autoFocus
              status={passwordError ? "error" : undefined}
            />
            {passwordError ? (
              <div className="ai-content-check-password-modal__error">
                {passwordError}
              </div>
            ) : null}
          </div>
        </Modal>
        {previewFileData && isVideo ? (
          <MoviePreviewModal
            visible={moviePreviewVisible}
            fileData={previewFileData}
            fileList={previewFileList}
            onCancel={() => setMoviePreviewVisible(false)}
          />
        ) : null}
      </div>
    </div>
  ) : null
}
