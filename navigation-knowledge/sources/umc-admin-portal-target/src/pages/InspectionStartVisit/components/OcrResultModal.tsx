import React, { useEffect, useMemo, useState } from 'react';
import { Button, Form, Input, Modal, Select } from 'antd';
import { useTranslation } from 'react-i18next';
import { inspectionFigmaAssets } from '@/pages/InspectionCommon/assets';
import saveCompleteIcon from '@/pages/InspectionCommon/assets/images/wancheng.svg';
import { AuthenticatedDocumentImage } from '@/components/common/AuthenticatedDocumentMedia';
import type {
  InspectionOcrEditPayload,
  InspectionOcrMatch,
  InspectionOcrResult,
  InspectionOcrScanSubType,
  InspectionOcrScanTypeId,
} from '@/services/inspection';

type OcrEditFieldName = keyof InspectionOcrEditPayload;

type OcrEditField = {
  labelKey: string;
  name: OcrEditFieldName;
  placeholderKey?: string;
  required?: boolean;
};

type OcrDisplayField = {
  labelKey: string;
  value: unknown;
};

type OcrCoverFit = 'cover' | 'contain';

type OcrMaterialTypeOption = {
  value: string;
  label: string;
};

type OcrSeizedMaterialSaveAction = 'save' | 'saveAndContinue';

type OcrSeizedMaterialSaveValue = {
  materialType: string;
  materialName: string;
  isbn?: string;
  author?: string;
  languageId?: string;
};

export type OcrResultModalVariant = 'checklist' | 'seizedMaterials';

type OcrResultModalProps = {
  visible: boolean;
  result: InspectionOcrResult | null;
  ocrType: string;
  editSaving?: boolean;
  onEditSave?: (values: InspectionOcrEditPayload) => Promise<boolean>;
  variant?: OcrResultModalVariant;
  materialTypeOptions?: OcrMaterialTypeOption[];
  materialTypeLoading?: boolean;
  defaultMaterialType?: string;
  languageOptions?: OcrMaterialTypeOption[];
  languageLoading?: boolean;
  defaultLanguageValue?: string;
  onCancel: () => void;
  onResultChange: (result: InspectionOcrResult) => void;
  onScanAnother: () => void;
  onSeizedMaterialSave?: (value: OcrSeizedMaterialSaveValue, action: OcrSeizedMaterialSaveAction) => void;
};

const EMPTY_VALUE = '-';

const PUBLICATION_SUB_TYPES = ['BOOK', 'NEWSPAPER_MAGAZINE', 'MOVIE', 'GAME', 'OTHER'];
const MATERIAL_SUB_TYPES = ['BOOK', 'ART_PUBLICATION', 'DOCUMENT', 'CD', 'OTHER'];

const normalizePublicationType = (
  result: InspectionOcrResult | null,
  fallback: string,
  scanType: InspectionOcrScanTypeId,
): InspectionOcrScanSubType => {
  const type = String(result?.publicationType || fallback || 'BOOK').toUpperCase();
  const allowed = scanType === 2 ? MATERIAL_SUB_TYPES : PUBLICATION_SUB_TYPES;

  if (allowed.includes(type)) {
    return type as InspectionOcrScanSubType;
  }

  return 'BOOK';
};

const getDisplayValue = (value: unknown): string => {
  if (value === null || value === undefined) return EMPTY_VALUE;
  const normalized = String(value).trim();
  return normalized || EMPTY_VALUE;
};

const isEmptyValue = (value: unknown): boolean => getDisplayValue(value) === EMPTY_VALUE;

const getNormalizedValue = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

const getPublicationTypeLabelKey = (
  type: InspectionOcrScanSubType,
  scanType: InspectionOcrScanTypeId = 1,
): string => {
  if (scanType === 2) {
    if (type === 'ART_PUBLICATION') return 'inspection.ocr.artPublication';
    if (type === 'DOCUMENT') return 'inspection.ocr.document';
    if (type === 'CD') return 'inspection.ocr.cd';
    if (type === 'OTHER') return 'inspection.ocr.other';
    return 'inspection.ocr.book';
  }

  if (type === 'NEWSPAPER_MAGAZINE') return 'inspection.ocr.newspaperMagazine';
  if (type === 'MOVIE') return 'inspection.ocr.movie';
  if (type === 'GAME') return 'inspection.ocr.game';
  if (type === 'OTHER') return 'inspection.ocr.other';
  return 'inspection.ocr.book';
};

const getCoverFallback = (type: InspectionOcrScanSubType): string => {
  if (type === 'NEWSPAPER_MAGAZINE') return inspectionFigmaAssets.ocrResult.covers.newspaper;
  if (type === 'MOVIE') return inspectionFigmaAssets.ocrResult.covers.movie;
  if (type === 'GAME') return inspectionFigmaAssets.ocrResult.covers.game;
  if (type === 'BOOK') return inspectionFigmaAssets.ocrResult.covers.book;
  return '';
};

const getCoverSource = (
  type: InspectionOcrScanSubType,
  result?: InspectionOcrResult | null,
  match?: InspectionOcrMatch,
): string => {
  const coverFromData = match?.coverImageUrl || match?.imageUrl || result?.coverImageUrl || result?.imageUrl;
  if (typeof coverFromData === 'string' && coverFromData.trim()) return coverFromData;

  return getCoverFallback(type);
};

const getPrimaryTitle = (
  type: InspectionOcrScanSubType,
  result?: InspectionOcrResult | null,
  match?: InspectionOcrMatch,
): string => {
  const title = match?.title || match?.name || result?.title || result?.name;
  if (!isEmptyValue(title)) return getDisplayValue(title);
  return getDisplayValue(result?.title || result?.name);
};

const getSecondaryTitle = (
  type: InspectionOcrScanSubType,
  result?: InspectionOcrResult | null,
  match?: InspectionOcrMatch,
): string => {
  if (type === 'BOOK') return getDisplayValue(match?.author || result?.author);
  if (type === 'MOVIE') return getDisplayValue(match?.director || result?.director);
  if (type === 'NEWSPAPER_MAGAZINE') {
    return getDisplayValue(
      match?.publishingHouse || match?.publisher || result?.publishingHouse || result?.publisher,
    );
  }
  return getDisplayValue(
    match?.publishingHouse || match?.publisher || result?.publishingHouse || result?.publisher,
  );
};

const getBarcodeValue = (
  result?: InspectionOcrResult | null,
  match?: InspectionOcrMatch,
): string => getDisplayValue(match?.barcode || match?.isbn || result?.barcode || result?.isbn);

const getStatusLabelKey = (status: unknown): string => {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'rejected') return 'inspection.ocr.rejected';
  if (normalized === 'pending') return 'inspection.ocr.pending';
  if (normalized === 'approved') return 'inspection.ocr.approved';
  return '';
};

const getStatusTone = (status: unknown): string => {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'rejected') return 'rejected';
  if (normalized === 'pending') return 'pending';
  if (normalized === 'approved') return 'approved';
  return 'unknown';
};

const getEditFields = (
  type: InspectionOcrScanSubType,
  scanType: InspectionOcrScanTypeId = 1,
): OcrEditField[] => {
  if (scanType === 2) {
    if (type === 'BOOK') {
      return [
        {
          labelKey: 'inspection.ocr.bookName',
          name: 'title',
          placeholderKey: 'inspection.execution.enterBookName',
          required: true,
        },
        {
          labelKey: 'inspection.ocr.author',
          name: 'author',
          placeholderKey: 'inspection.execution.enterAuthorName',
        },
        {
          labelKey: 'inspection.ocr.isbn',
          name: 'isbn',
          placeholderKey: 'inspection.execution.enterIsbn',
        },
        {
          labelKey: 'inspection.ocr.language',
          name: 'language',
          placeholderKey: 'inspection.ocr.enterLanguage',
        },
      ];
    }

    return [
      {
        labelKey: 'inspection.execution.materialName',
        name: 'title',
        placeholderKey: 'inspection.execution.enterMaterialName',
        required: true,
      },
    ];
  }

  if (type === 'NEWSPAPER_MAGAZINE') {
    return [
      {
        labelKey: 'inspection.ocr.newspaperMagazineName',
        name: 'title',
        placeholderKey: 'inspection.ocr.enterNewspaperMagazineName',
        required: true,
      },
    ];
  }

  if (type === 'MOVIE') {
    return [
      {
        labelKey: 'inspection.ocr.movieName',
        name: 'title',
        placeholderKey: 'inspection.ocr.enterMovieName',
        required: true,
      },
      {
        labelKey: 'inspection.ocr.director',
        name: 'director',
        placeholderKey: 'inspection.ocr.enterDirectorName',
      },
      {
        labelKey: 'inspection.ocr.writer',
        name: 'writer',
        placeholderKey: 'inspection.ocr.enterWriterName',
      },
    ];
  }

  if (type === 'GAME') {
    return [
      {
        labelKey: 'inspection.ocr.gameName',
        name: 'title',
        placeholderKey: 'inspection.ocr.enterGameName',
        required: true,
      },
    ];
  }

  return [
    {
      labelKey: 'inspection.ocr.bookName',
      name: 'title',
      placeholderKey: 'inspection.execution.enterBookName',
      required: true,
    },
    {
      labelKey: 'inspection.ocr.author',
      name: 'author',
      placeholderKey: 'inspection.execution.enterAuthorName',
    },
    {
      labelKey: 'inspection.ocr.isbn',
      name: 'isbn',
      placeholderKey: 'inspection.execution.enterIsbn',
    },
  ];
};

const isMatchFieldSeparatorTarget = (field: OcrDisplayField): boolean => (
  field.labelKey === 'inspection.ocr.applicationNo'
);

const getSummaryFields = (
  type: InspectionOcrScanSubType,
  match: InspectionOcrMatch,
): OcrDisplayField[] => {
  if (type === 'NEWSPAPER_MAGAZINE') {
    return [
      { labelKey: 'inspection.ocr.type', value: match.mediaType || match.type },
      { labelKey: 'inspection.ocr.periodicalType', value: match.periodicalType },
      { labelKey: 'inspection.ocr.language', value: match.language },
      { labelKey: 'inspection.ocr.source', value: match.source },
    ];
  }

  if (type === 'MOVIE') {
    return [
      { labelKey: 'inspection.ocr.writer', value: match.writer },
      { labelKey: 'inspection.ocr.language', value: match.language },
      { labelKey: 'inspection.ocr.source', value: match.source },
    ];
  }

  if (type === 'GAME') {
    return [
      { labelKey: 'inspection.ocr.category', value: match.category },
      { labelKey: 'inspection.ocr.language', value: match.language },
      { labelKey: 'inspection.ocr.source', value: match.source },
    ];
  }

  return [
    { labelKey: 'inspection.ocr.language', value: match.language },
    { labelKey: 'inspection.ocr.source', value: match.source },
  ];
};

const getExpandedFields = (
  type: InspectionOcrScanSubType,
  match: InspectionOcrMatch,
): OcrDisplayField[] => {
  if (type === 'NEWSPAPER_MAGAZINE') {
    return [
      { labelKey: 'inspection.ocr.subjectCategory', value: match.subjectCategory },
      { labelKey: 'inspection.ocr.versionNumber', value: match.versionNumber },
      { labelKey: 'inspection.ocr.numberOfCopies', value: match.numberOfCopies },
      { labelKey: 'inspection.ocr.publishingHouse', value: match.publishingHouse || match.publisher },
      { labelKey: 'inspection.ocr.applicationNo', value: match.applicationNo },
      { labelKey: 'inspection.ocr.serviceName', value: match.serviceName },
      { labelKey: 'inspection.ocr.lastUpdateTime', value: match.lastUpdateTime },
    ];
  }

  if (type === 'MOVIE' || type === 'GAME') {
    return [
      ...(type === 'MOVIE'
        ? [{ labelKey: 'inspection.ocr.type', value: match.type }]
        : [{ labelKey: 'inspection.ocr.platform', value: match.platform }]),
      { labelKey: 'inspection.ocr.copywritingType', value: match.copywritingType },
      { labelKey: 'inspection.ocr.ageRating', value: match.ageRating },
      { labelKey: 'inspection.ocr.applicationNo', value: match.applicationNo },
      { labelKey: 'inspection.ocr.serviceName', value: match.serviceName },
      { labelKey: 'inspection.ocr.lastUpdateTime', value: match.lastUpdateTime },
    ];
  }

  return [
    { labelKey: 'inspection.ocr.printYear', value: match.printYear },
    { labelKey: 'inspection.ocr.subjectCategory', value: match.subCategory || match.subjectCategory },
    { labelKey: 'inspection.ocr.versionNumber', value: match.versionNumber },
    { labelKey: 'inspection.ocr.nationalDepositoryNumber', value: match.nationalDepositoryNumber },
    { labelKey: 'inspection.ocr.numberOfCopies', value: match.numberOfCopies },
    { labelKey: 'inspection.ocr.applicationNo', value: match.applicationNo },
    { labelKey: 'inspection.ocr.serviceName', value: match.serviceName },
    { labelKey: 'inspection.ocr.lastUpdateTime', value: match.lastUpdateTime },
  ];
};

const getMatchKey = (match: InspectionOcrMatch, index: number): string => {
  const id = match.id || match.applicationNo || match.title || match.name || index;
  return String(id);
};

const getExtractedCoverFit = (type: InspectionOcrScanSubType): OcrCoverFit => (
  type === 'BOOK' ? 'cover' : 'contain'
);

const getRejectionFields = (match: InspectionOcrMatch): OcrDisplayField[] => {
  if (getStatusTone(match.status) !== 'rejected') return [];

  return [
    { labelKey: 'inspection.ocr.rejectionNotes', value: match.notes },
  ].filter((field) => !isEmptyValue(field.value));
};

const OcrResultModal: React.FC<OcrResultModalProps> = ({
  visible,
  result,
  ocrType,
  variant = 'checklist',
  materialTypeOptions = [],
  materialTypeLoading = false,
  defaultMaterialType = '',
  languageOptions = [],
  languageLoading = false,
  defaultLanguageValue = '',
  editSaving = false,
  onEditSave,
  onCancel,
  onResultChange,
  onScanAnother,
  onSeizedMaterialSave,
}) => {
  const { t } = useTranslation();
  const [editForm] = Form.useForm();
  const [seizedMaterialForm] = Form.useForm();
  const [editVisible, setEditVisible] = useState(false);
  const [expandedMatchKey, setExpandedMatchKey] = useState('');
  const [failedCoverSources, setFailedCoverSources] = useState<Record<string, boolean>>({});

  const scanType: InspectionOcrScanTypeId = variant === 'seizedMaterials' ? 2 : 1;
  const publicationType = normalizePublicationType(result, ocrType, scanType);
  const isSeizedMaterialsResult = variant === 'seizedMaterials';
  const isBookSeizedMaterialResult = isSeizedMaterialsResult && publicationType === 'BOOK';
  const editFields = useMemo(
    () => getEditFields(publicationType, scanType),
    [publicationType, scanType],
  );
  const editValues = Form.useWatch([], editForm) as Record<string, unknown> | undefined;
  const hasEditValue = editFields.some(
    (field) => Boolean(getNormalizedValue(editValues?.[field.name])),
  );
  const normalizedMaterialTypeOptions = useMemo(() => {
    const options = materialTypeOptions.filter((option) => option.value && option.label);
    if (!defaultMaterialType || options.some((option) => option.value === defaultMaterialType)) {
      return options;
    }
    return [
      ...options,
      {
        value: defaultMaterialType,
        label: t(getPublicationTypeLabelKey(publicationType, scanType)),
      },
    ];
  }, [defaultMaterialType, materialTypeOptions, publicationType, scanType, t]);
  const normalizedLanguageOptions = useMemo(
    () => languageOptions.filter((option) => option.value && option.label),
    [languageOptions],
  );
  const matches = useMemo(() => {
    const nextMatches = result?.matches || [];

    return nextMatches
      .map((match, index) => ({ match, index }))
      .sort((left, right) => {
        const leftTime = Date.parse(String(left.match.lastUpdateTime || ''));
        const rightTime = Date.parse(String(right.match.lastUpdateTime || ''));
        if (Number.isNaN(leftTime) && Number.isNaN(rightTime)) return left.index - right.index;
        if (Number.isNaN(leftTime)) return 1;
        if (Number.isNaN(rightTime)) return -1;
        return rightTime - leftTime;
      });
  }, [result?.matches]);
  const hasMatch = result?.matchStatusCode
    ? result.matchStatusCode === 'matched' && matches.length > 0
    : result?.matchStatus !== 'UNMATCHED' && matches.length > 0;
  const isOcrPending = result?.ocrStatusId === 1 || result?.matchStatusCode === 'pending';
  const isOcrFailed = result?.ocrStatusId === 3;
  const alertText = isOcrFailed
    ? t('inspection.ocr.scanFailedHint')
    : isOcrPending
      ? t('inspection.ocr.scanPendingHint')
      : hasMatch
        ? t('inspection.ocr.scanMatchFound')
        : t('inspection.ocr.scanNoMatchFound');
  const primaryTitle = getPrimaryTitle(publicationType, result);

  useEffect(() => {
    if (!visible) {
      setExpandedMatchKey('');
      setEditVisible(false);
      return;
    }

    if (result?.autoExpand && matches.length === 1) {
      setExpandedMatchKey(getMatchKey(matches[0].match, matches[0].index));
      return;
    }

    setExpandedMatchKey('');
  }, [matches, result?.autoExpand, visible]);

  useEffect(() => {
    if (!visible || !isSeizedMaterialsResult) return;

    seizedMaterialForm.setFieldsValue({
      materialType: defaultMaterialType || undefined,
      materialName: result?.title || result?.name || '',
      isbn: result?.isbn || result?.barcode || '',
      author: result?.author || '',
      languageId: defaultLanguageValue || undefined,
    });
  }, [
    defaultLanguageValue,
    defaultMaterialType,
    isSeizedMaterialsResult,
    publicationType,
    result?.author,
    result?.barcode,
    result?.isbn,
    result?.name,
    result?.title,
    seizedMaterialForm,
    visible,
  ]);

  const handleOpenEdit = () => {
    if (!result) return;
    editForm.setFieldsValue({
      title: result.title || result.name,
      author: result.author,
      isbn: result.isbn,
      language: result.language,
      chiefEditor: result.chiefEditor || result.editor,
      publishingHouse: result.publishingHouse || result.publisher,
      director: result.director,
      writer: result.writer,
    });
    setEditVisible(true);
  };

  const handleSaveEdit = async () => {
    if (!result || editSaving) return;
    const values = await editForm.validateFields();
    const payload: InspectionOcrEditPayload = {};

    editFields.forEach((field) => {
      payload[field.name] = getNormalizedValue(values[field.name]);
    });

    if (!onEditSave) {
      onResultChange({ ...result, ...payload });
      setEditVisible(false);
      return;
    }

    const saved = await onEditSave(payload);
    if (saved) {
      setEditVisible(false);
    }
  };

  const handleSaveSeizedMaterial = async (action: OcrSeizedMaterialSaveAction) => {
    if (editSaving) return;
    const values = await seizedMaterialForm.validateFields();

    if (!onSeizedMaterialSave) return;

    if (onEditSave && result?.scanId) {
      const saved = await onEditSave({
        title: getNormalizedValue(values.materialName),
        isbn: isBookSeizedMaterialResult ? getNormalizedValue(values.isbn) : undefined,
        author: isBookSeizedMaterialResult ? getNormalizedValue(values.author) : undefined,
        language: isBookSeizedMaterialResult
          ? normalizedLanguageOptions.find(
            (option) => option.value === getNormalizedValue(values.languageId),
          )?.label
          : undefined,
      });

      if (!saved) return;
    }

    onSeizedMaterialSave({
      materialType: getNormalizedValue(values.materialType),
      materialName: getNormalizedValue(values.materialName),
      isbn: isBookSeizedMaterialResult ? getNormalizedValue(values.isbn) : undefined,
      author: isBookSeizedMaterialResult ? getNormalizedValue(values.author) : undefined,
      languageId: isBookSeizedMaterialResult ? getNormalizedValue(values.languageId) : undefined,
    }, action);
  };

  const handleCoverError = (source: string) => {
    if (!source) return;
    setFailedCoverSources((previous) => {
      if (previous[source]) return previous;
      return { ...previous, [source]: true };
    });
  };

  const renderOcrCover = (
    source: string,
    frameClassName: string,
    imageClassName: string,
  ) => {
    const normalizedSource = source.trim();
    const shouldRenderImage = normalizedSource && !failedCoverSources[normalizedSource];

    // Backend covers are served by the token protected preview endpoint, so the
    // image element cannot load them directly and has to reuse the shared
    // authenticated media component that streams the file as an object URL.
    return (
    <div className={frameClassName}>
      {shouldRenderImage ? (
      <AuthenticatedDocumentImage
        className={imageClassName}
        src={normalizedSource}
        fallbackSrc={getCoverFallback(publicationType)}
        alt=""
        onError={() => handleCoverError(normalizedSource)}
      />
      ) : null}
    </div>
    );
  };

  const renderExtractedCover = () => {
    const coverFit = getExtractedCoverFit(publicationType);
    const imageClassName = [
      'inspection-start-visit__scan-results-cover',
      `inspection-start-visit__scan-results-cover--${coverFit}`,
    ].join(' ');

    return renderOcrCover(
      getCoverSource(publicationType, result),
      'inspection-start-visit__scan-results-cover-frame',
      imageClassName,
    );
  };

  const renderExtractedFieldRows = (fields: OcrDisplayField[]) => (
    fields.map((field) => (
      <div className="inspection-start-visit__scan-results-extracted-field-row" key={field.labelKey}>
        <span className="inspection-start-visit__scan-results-extracted-field-label">{t(field.labelKey)}</span>
        <span className="inspection-start-visit__scan-results-extracted-field-value">{getDisplayValue(field.value)}</span>
      </div>
    ))
  );

  const renderExtractedCard = () => {
    // Figma extracted card layout differs per publication type: Book adds the
    // author line plus the barcode footer, Cinema adds the director/writer rows,
    // Newspaper/Magazine and Game only show the cover and the title.
    if (publicationType === 'BOOK') {
      return (
        <div className="inspection-start-visit__scan-results-extracted-card inspection-start-visit__scan-results-extracted-card--book">
          {renderExtractedCover()}
          <div className="inspection-start-visit__scan-results-extracted-content inspection-start-visit__scan-results-extracted-content--book">
            <strong className="inspection-start-visit__scan-results-extracted-title">{primaryTitle}</strong>
            <span className="inspection-start-visit__scan-results-extracted-subtitle">
              {getSecondaryTitle(publicationType, result)}
            </span>
          </div>
          <div className="inspection-start-visit__scan-results-barcode-row">
            <img className="inspection-start-visit__scan-results-barcode-icon" src={inspectionFigmaAssets.ocrResult.barcode} alt="" />
            <span className="inspection-start-visit__scan-results-barcode-text">{getBarcodeValue(result)}</span>
          </div>
        </div>
      );
    }

    if (publicationType === 'MOVIE') {
      return (
        <div className="inspection-start-visit__scan-results-extracted-card inspection-start-visit__scan-results-extracted-card--movie">
          {renderExtractedCover()}
          <div className="inspection-start-visit__scan-results-extracted-content inspection-start-visit__scan-results-extracted-content--movie">
            <strong className="inspection-start-visit__scan-results-extracted-title">{primaryTitle}</strong>
            <div className="inspection-start-visit__scan-results-extracted-divider" />
            {renderExtractedFieldRows([
              { labelKey: 'inspection.ocr.director', value: result?.director },
              { labelKey: 'inspection.ocr.writer', value: result?.writer },
            ])}
          </div>
        </div>
      );
    }

    return (
      <div className="inspection-start-visit__scan-results-extracted-card inspection-start-visit__scan-results-extracted-card--simple">
        {renderExtractedCover()}
        <div className="inspection-start-visit__scan-results-extracted-content inspection-start-visit__scan-results-extracted-content--simple">
          <strong className="inspection-start-visit__scan-results-extracted-title">{primaryTitle}</strong>
        </div>
      </div>
    );
  };

  const renderMatchCover = (match: InspectionOcrMatch) => (
    renderOcrCover(
      getCoverSource(publicationType, result, match),
      'inspection-start-visit__scan-results-match-cover-frame',
      'inspection-start-visit__scan-results-match-cover',
    )
  );

  const renderMatchFieldRows = (fields: OcrDisplayField[]) => (
    fields.map((field) => (
      <React.Fragment key={field.labelKey}>
        {isMatchFieldSeparatorTarget(field) ? (
          <div className="inspection-start-visit__scan-results-field-divider" />
        ) : null}
        <div className="inspection-start-visit__scan-results-field-row">
          <span className="inspection-start-visit__scan-results-field-label">{t(field.labelKey)}</span>
          <span className="inspection-start-visit__scan-results-field-value">{getDisplayValue(field.value)}</span>
        </div>
      </React.Fragment>
    ))
  );

  const renderSeizedMaterialResultBody = () => (
    <div className={`inspection-start-visit__other-ocr-body${isBookSeizedMaterialResult ? ' inspection-start-visit__other-ocr-body--book' : ''}`}>
      {renderOcrCover(
        getCoverSource(publicationType, result),
        'inspection-start-visit__other-ocr-preview-frame',
        'inspection-start-visit__other-ocr-preview-image',
      )}
      <Form
      form={seizedMaterialForm}
      layout="vertical"
      className="inspection-start-visit__other-ocr-form"
      >
        <Form.Item
          label={t('inspection.execution.materialType')}
          name="materialType"
          rules={[{ required: true, message: t('inspection.ocr.fieldRequired') }]}
        >
          <Select
            className="inspection-start-visit__other-ocr-select"
            loading={materialTypeLoading}
            placeholder={t('inspection.execution.pleaseSelect')}
            options={normalizedMaterialTypeOptions}
          />
        </Form.Item>
        {isBookSeizedMaterialResult ? (
          <Form.Item
            label={t('inspection.execution.isbn')}
            name="isbn"
            rules={[
              { required: true, whitespace: true, message: t('inspection.ocr.fieldRequired') },
            ]}
          >
            <Input
              className="inspection-start-visit__other-ocr-input"
              placeholder={t('inspection.execution.enterIsbn')}
              allowClear
            />
          </Form.Item>
        ) : null}
        <Form.Item
          label={t('inspection.execution.materialName')}
          name="materialName"
          rules={[
            { required: true, whitespace: true, message: t('inspection.ocr.fieldRequired') },
          ]}
        >
          <Input
            className="inspection-start-visit__other-ocr-input"
            placeholder={t(
              isBookSeizedMaterialResult
                ? 'inspection.execution.enterBookName'
                : 'inspection.execution.enterMaterialName',
            )}
            allowClear
          />
        </Form.Item>
        {isBookSeizedMaterialResult ? (
          <>
            <Form.Item
              label={t('inspection.ocr.author')}
              name="author"
              rules={[
                { required: true, whitespace: true, message: t('inspection.ocr.fieldRequired') },
              ]}
            >
              <Input
                className="inspection-start-visit__other-ocr-input"
                placeholder={t('inspection.execution.enterAuthorName')}
                allowClear
              />
            </Form.Item>
            <Form.Item
              label={t('inspection.ocr.language')}
              name="languageId"
              rules={[{ required: true, message: t('inspection.ocr.fieldRequired') }]}
            >
              <Select
                className="inspection-start-visit__other-ocr-select"
                loading={languageLoading}
                placeholder={t('inspection.execution.pleaseSelect')}
                options={normalizedLanguageOptions}
                showSearch
                optionFilterProp="label"
              />
            </Form.Item>
          </>
        ) : null}
      </Form>
    </div>
  );

  const renderStandardResultBody = () => (
    <>
      <div className="inspection-start-visit__scan-results-alert">
        <img className="inspection-start-visit__scan-results-alert-icon" src={inspectionFigmaAssets.ocrResult.info} alt="" />
        <span className="inspection-start-visit__scan-results-alert-text">{alertText}</span>
      </div>

      <div className="inspection-start-visit__scan-results-body">
        <section className="inspection-start-visit__scan-results-extracted">
          <h3 className="inspection-start-visit__scan-results-section-title">
            {t('inspection.ocr.extractedData')}
          </h3>

          {renderExtractedCard()}

          <Button
            className="inspection-start-visit__scan-results-edit-button"
            onClick={handleOpenEdit}
            disabled={!result}
          >
            <img className="inspection-start-visit__scan-results-edit-icon" src={inspectionFigmaAssets.ocrResult.edit} alt="" />
            {t('inspection.ocr.edit')}
          </Button>
        </section>

        <section className="inspection-start-visit__scan-results-matches">
          <h3 className="inspection-start-visit__scan-results-section-title">
            {t('inspection.ocr.databaseMatchingResult')}
          </h3>

          {hasMatch ? (
            <div className="inspection-start-visit__scan-results-match-list">
              {matches.map(({ match, index }) => {
                const matchKey = getMatchKey(match, index);
                const expanded = expandedMatchKey === matchKey;
                const statusTone = getStatusTone(match.status);
                const statusLabelKey = getStatusLabelKey(match.status);
                const matchBarcode = getBarcodeValue(result, match);
                const matchSubtitle = getSecondaryTitle(publicationType, result, match);

                return (
                  <article className="inspection-start-visit__scan-results-card" key={matchKey}>
                    <span
                      className={`inspection-start-visit__scan-results-status inspection-start-visit__scan-results-status--${statusTone}`}
                    >
                      {statusLabelKey ? t(statusLabelKey) : '-'}
                    </span>
                    <div className="inspection-start-visit__scan-results-card-header">
                      {renderMatchCover(match)}
                      <div className="inspection-start-visit__scan-results-card-heading">
                        <strong className="inspection-start-visit__scan-results-card-title">
                          {getPrimaryTitle(publicationType, result, match)}
                        </strong>
                        {!isEmptyValue(matchSubtitle) ? (
                          <span className="inspection-start-visit__scan-results-card-subtitle">
                            {matchSubtitle}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {!isEmptyValue(matchBarcode) ? (
                      <div className="inspection-start-visit__scan-results-card-barcode">
                        <img className="inspection-start-visit__scan-results-barcode-icon" src={inspectionFigmaAssets.ocrResult.barcode} alt="" />
                        <span className="inspection-start-visit__scan-results-barcode-text">{matchBarcode}</span>
                      </div>
                    ) : null}

                    <div className="inspection-start-visit__scan-results-card-fields">
                      {renderMatchFieldRows(getSummaryFields(publicationType, match))}
                      {expanded ? renderMatchFieldRows(getExpandedFields(publicationType, match)) : null}
                      {expanded ? renderMatchFieldRows(getRejectionFields(match)) : null}
                      {expanded && match.attachmentsUrl ? (
                        <div className="inspection-start-visit__scan-results-field-row">
                          <span className="inspection-start-visit__scan-results-field-label">
                            {t('inspection.ocr.rejectionAttachment')}
                          </span>
                          <a
                            className="inspection-start-visit__scan-results-field-value"
                            href={String(match.attachmentsUrl)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {t('inspection.ocr.viewAttachment')}
                          </a>
                        </div>
                      ) : null}
                    </div>

                    <button
                      type="button"
                      className="inspection-start-visit__scan-results-toggle"
                      aria-expanded={expanded}
                      onClick={() => setExpandedMatchKey(expanded ? '' : matchKey)}
                    >
                      <span>{t(expanded ? 'inspection.ocr.collapse' : 'inspection.ocr.viewDetails')}</span>
                      <img
                        className={`inspection-start-visit__scan-results-toggle-icon${expanded ? ' inspection-start-visit__scan-results-toggle-icon--expanded' : ''}`}
                        src={inspectionFigmaAssets.ocrResult.caret}
                        alt=""
                      />
                    </button>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="inspection-start-visit__scan-results-no-result">
              {t('inspection.ocr.noResult')}
            </div>
          )}
        </section>
      </div>
    </>
  );

  return (
    <>
      <Modal
        title={t('inspection.ocr.scanResults')}
        visible={visible}
        onCancel={onCancel}
        centered
        width={960}
        destroyOnClose
        maskClosable={false}
        className={`inspection-start-visit__standard-modal inspection-start-visit__scan-results-modal${isSeizedMaterialsResult ? ' inspection-start-visit__scan-results-modal--seized-materials' : ''}`}
        footer={(
          isSeizedMaterialsResult ? (
            <div className="inspection-start-visit__other-ocr-footer-actions">
              <Button
                className="inspection-start-visit__other-ocr-rescan-button"
                onClick={() => { void handleSaveSeizedMaterial('saveAndContinue'); }}
              >
                <img className="inspection-start-visit__other-ocr-action-icon" src={inspectionFigmaAssets.ocrResult.scan} alt="" />
                {t('inspection.ocr.saveAndContinueToScan')}
              </Button>
              <Button
                className="inspection-start-visit__other-ocr-save-button"
                onClick={() => { void handleSaveSeizedMaterial('save'); }}
              >
                <img className="inspection-start-visit__other-ocr-action-icon" src={saveCompleteIcon} alt="" />
                {t('inspection.ocr.save')}
              </Button>
            </div>
          ) : (
            <div className="inspection-start-visit__scan-results-footer">
              <Button
                className="inspection-start-visit__primary-button inspection-start-visit__scan-results-scan-button"
                onClick={onScanAnother}
              >
                <img className="inspection-start-visit__scan-results-scan-icon" src={inspectionFigmaAssets.ocrResult.scan} alt="" />
                {t('inspection.ocr.scanAnotherItem')}
              </Button>
            </div>
          )
        )}
      >
        {isSeizedMaterialsResult ? renderSeizedMaterialResultBody() : renderStandardResultBody()}
      </Modal>

      <Modal
        title={t('inspection.ocr.edit')}
        visible={editVisible}
        onCancel={() => setEditVisible(false)}
        centered
        width={640}
        zIndex={1010}
        forceRender
        destroyOnClose
        maskClosable={false}
        className="inspection-start-visit__standard-modal inspection-start-visit__ocr-edit-modal"
        footer={(
          <div className="inspection-start-visit__modal-footer-actions">
            <Button className="inspection-start-visit__outline-button" onClick={() => setEditVisible(false)}>
              {t('inspection.common.cancel')}
            </Button>
            <Button
            className="inspection-start-visit__primary-button"
            onClick={handleSaveEdit}
            loading={editSaving}
            disabled={!hasEditValue}
            >
            {t('inspection.ocr.save')}
            </Button>
          </div>
        )}
      >
        <Form
          form={editForm}
          layout="vertical"
          requiredMark={false}
          className="inspection-start-visit__contact-form inspection-start-visit__ocr-edit-form"
        >
          {editFields.map((field) => (
            <Form.Item
              key={field.name}
              label={t(field.labelKey)}
              name={field.name}
              >
              <Input allowClear placeholder={field.placeholderKey ? t(field.placeholderKey) : undefined} />
            </Form.Item>
          ))}
        </Form>
      </Modal>
    </>
  );
};

export default OcrResultModal;
