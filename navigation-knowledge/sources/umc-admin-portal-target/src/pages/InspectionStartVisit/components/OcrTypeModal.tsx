import React, { useEffect, useMemo, useState } from 'react';
import { Button, Modal } from 'antd';
import { Trans, useTranslation } from 'react-i18next';
import { inspectionFigmaAssets } from '@/pages/InspectionCommon/assets';

const DEFAULT_OCR_TYPE = 'BOOK';
const CHECKLIST_OCR_TYPES = ['BOOK', 'NEWSPAPER_MAGAZINE', 'MOVIE', 'GAME'];
const SEIZED_MATERIAL_OCR_TYPES = ['BOOK', 'ART_PUBLICATION', 'DOCUMENT', 'CD', 'OTHER'];

export type OcrTypeModalVariant = 'checklist' | 'seizedMaterials';

type OcrTypeOption = {
  key: string;
  labelKey: string;
};

export type OcrActionSource = 'upload' | 'camera';

export type OcrTypeModalSelection = {
  publicationType: string;
  source: OcrActionSource;
};

type OcrTypeModalProps = {
  visible: boolean;
  types: readonly OcrTypeOption[];
  variant?: OcrTypeModalVariant;
  loadingSource?: OcrActionSource | null;
  onCancel: () => void;
  onSelect: (selection: OcrTypeModalSelection) => void | Promise<void>;
};

const OcrTypeModal: React.FC<OcrTypeModalProps> = ({
  visible,
  types,
  variant = 'checklist',
  loadingSource = null,
  onCancel,
  onSelect,
}) => {
  const { t } = useTranslation();
  const [selectedType, setSelectedType] = useState(DEFAULT_OCR_TYPE);
  const typeKeys = variant === 'seizedMaterials' ? SEIZED_MATERIAL_OCR_TYPES : CHECKLIST_OCR_TYPES;
  const visibleTypes = useMemo(
    () => types.filter((type) => typeKeys.includes(type.key)),
    [typeKeys, types],
  );
  const selectedTypeOption = visibleTypes.find((type) => type.key === selectedType);
  const isLoading = Boolean(loadingSource);
  const isSeizedMaterialVariant = variant === 'seizedMaterials';

  useEffect(() => {
    if (visible) {
      setSelectedType(DEFAULT_OCR_TYPE);
    }
  }, [visible]);

  const getTypeIcon = (key: string) => {
    if (key === 'NEWSPAPER_MAGAZINE') return inspectionFigmaAssets.ocrTypeIcons.newspaper;
    if (key === 'MOVIE') return inspectionFigmaAssets.ocrTypeIcons.movie;
    if (key === 'GAME') return inspectionFigmaAssets.ocrTypeIcons.game;
    if (key === 'ART_PUBLICATION' || key === 'DOCUMENT' || key === 'CD' || key === 'OTHER') {
      return inspectionFigmaAssets.ocrTypeIcons.other;
    }
    return inspectionFigmaAssets.ocrTypeIcons.book;
  };

  const handleStartScan = (source: OcrActionSource) => {
    if (!selectedTypeOption || isLoading) return;
    void onSelect({ publicationType: selectedTypeOption.key, source });
  };

  const renderActionIcon = (src: string, className: string) => (
    <img className={className} src={src} alt="" />
  );

  return (
    <Modal
      title={(
        <div className="inspection-start-visit__ocr-type-title">
          <strong className="inspection-start-visit__ocr-type-title-text">
            {isSeizedMaterialVariant
              ? t('inspection.execution.scanMaterialToAutoFill')
              : t('inspection.execution.quickScan')}
          </strong>
          {!isSeizedMaterialVariant ? (
            <span className="inspection-start-visit__ocr-type-title-description">{t('inspection.execution.quickScanDescription')}</span>
          ) : null}
        </div>
      )}
      visible={visible}
      footer={(
        <div className="inspection-start-visit__ocr-type-footer-actions">
          <Button
            className="inspection-start-visit__ocr-type-upload-button"
            disabled={isLoading || !selectedTypeOption}
            icon={renderActionIcon(inspectionFigmaAssets.ocrTypeIcons.upload, 'inspection-start-visit__ocr-type-action-icon')}
            loading={loadingSource === 'upload'}
            onClick={() => handleStartScan('upload')}
          >
            {t('inspection.ocr.uploadImage')}
          </Button>
          <Button
            className="inspection-start-visit__ocr-type-photo-button"
            disabled={isLoading || !selectedTypeOption}
            icon={renderActionIcon(inspectionFigmaAssets.ocrTypeIcons.camera, 'inspection-start-visit__ocr-type-action-icon')}
            loading={loadingSource === 'camera'}
            onClick={() => handleStartScan('camera')}
          >
            {t('inspection.ocr.takePhoto')}
          </Button>
        </div>
      )}
      onCancel={onCancel}
      centered
      destroyOnClose
      maskClosable={false}
      className={`inspection-start-visit__standard-modal inspection-start-visit__ocr-type-modal${isSeizedMaterialVariant ? ' inspection-start-visit__ocr-type-modal--seized-materials' : ''}`}
    >
      {selectedType === DEFAULT_OCR_TYPE ? (
        <div className="inspection-start-visit__ocr-type-alert">
          <img className="inspection-start-visit__ocr-type-alert-icon" src={inspectionFigmaAssets.ocrTypeIcons.info} alt="" />
          {isSeizedMaterialVariant ? (
            <span className="inspection-start-visit__ocr-type-alert-text">
              <Trans
                i18nKey="inspection.ocr.bookScanHintV2"
                components={{ strong: <strong /> }}
              />
            </span>
          ) : (
            <span className="inspection-start-visit__ocr-type-alert-text">{t('inspection.ocr.bookScanHint')}</span>
          )}
        </div>
      ) : null}
      <div className="inspection-start-visit__ocr-type-body">
        <p className="inspection-start-visit__ocr-type-label">{t('inspection.ocr.selectPublicationType')}</p>
        <div className="inspection-start-visit__ocr-type-grid">
          {visibleTypes.map((type) => {
            const selected = type.key === selectedType;

            return (
              <button
                key={type.key}
                type="button"
                aria-pressed={selected}
                className={`inspection-start-visit__ocr-type-card${selected ? ' inspection-start-visit__ocr-type-card--selected' : ''}`}
                disabled={isLoading}
                onClick={() => setSelectedType(type.key)}
              >
                <img className="inspection-start-visit__ocr-type-card-icon" src={getTypeIcon(type.key)} alt="" />
                <strong className="inspection-start-visit__ocr-type-card-title">{t(type.labelKey)}</strong>
                <img
                  className="inspection-start-visit__ocr-type-card-check"
                  src={selected ? inspectionFigmaAssets.ocrTypeIcons.selected : inspectionFigmaAssets.ocrTypeIcons.unselected}
                  alt=""
                />
              </button>
            );
          })}
        </div>
      </div>
    </Modal>
  );
};

export default OcrTypeModal;
