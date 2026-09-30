/* eslint-disable @typescript-eslint/no-explicit-any */
import { Tooltip } from 'antd';
import i18next from 'i18next';
import { getCurrentLanguage, getLocalizedText } from '../helpers';
import { inspectionFigmaAssets } from '../assets';

import './AiRiskInsightCard.less';

type RiskTone = 'success' | 'warning' | 'danger' | 'neutral';

type RiskInsightItem = {
  key: string;
  label: string;
  score?: number;
  tone: RiskTone;
};

type AiRiskInsightCardProps = {
  riskProfile?: Record<string, any> | null;
  fallbackInsight?: string | number | null;
  isExpanded?: boolean;
};

const ensureArray = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

const toFiniteRoundedNumber = (value: unknown) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? Math.round(numericValue) : undefined;
};

const getDisplayValue = (value?: string | number | null, fallback = '-') => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : fallback;
  }

  const text = String(value ?? '').trim();
  return text || fallback;
};

const getRiskScoreValue = (riskProfile?: Record<string, any> | null) => {
  const score = Number(riskProfile?.aiRiskScore ?? riskProfile?.riskScore);
  if (!Number.isFinite(score)) return undefined;
  return Math.max(0, Math.min(100, Math.round(score)));
};

const getRiskTone = (score?: number, fallback?: string | null): RiskTone => {
  const normalizedFallback = String(fallback || '').toUpperCase();
  if (normalizedFallback.includes('CRITICAL') || normalizedFallback.includes('HIGH')) return 'danger';
  if (normalizedFallback.includes('MEDIUM')) return 'warning';
  if (normalizedFallback.includes('LOW')) return 'success';

  if (score === undefined) return 'neutral';
  if (score >= 80) return 'danger';
  if (score >= 60) return 'warning';
  return 'success';
};

/** Translated risk-level caption for the known API risk-level codes. */
const getRiskLevelLabelByCode = (value: string) => {
  const normalized = value.replace(/[\s_-]+/g, '').toUpperCase();
  if (normalized.includes('CRITICAL')) return i18next.t('inspection.riskLevels.critical');
  if (normalized.includes('HIGH')) return i18next.t('inspection.riskLevels.high');
  if (normalized.includes('MEDIUM')) return i18next.t('inspection.riskLevels.medium');
  if (normalized.includes('LOW')) return i18next.t('inspection.riskLevels.low');
  return '';
};

const getRiskLevelDisplayValue = (riskProfile?: Record<string, any> | null) => {
  const rawValue = getDisplayValue(
    riskProfile?.aiRiskLevelName ||
      riskProfile?.riskLevelName ||
      riskProfile?.riskLevel,
    '',
  );

  if (!rawValue) return '-';

  return getRiskLevelLabelByCode(rawValue) || rawValue;
};

const getRiskDescriptionValue = (riskProfile?: Record<string, any> | null) =>
  getCurrentLanguage() === 'en' ? getDisplayValue(riskProfile?.riskDescription, '') : '';

const AI_RISK_GAUGE_SEGMENT_PATHS = [
  'M4.28108 59.7821C1.72689 59.5845 -0.183525 57.3538 0.0140419 54.7996C0.211609 52.2454 2.44235 50.335 4.99653 50.5326L16.5584 51.4269C19.1126 51.6245 21.0231 53.8552 20.8255 56.4094C20.6279 58.9636 18.3972 60.874 15.843 60.6764L4.28108 59.7821Z',
  'M7.18726 41.6781C4.83562 40.6618 3.75303 37.9317 4.76924 35.58C5.78544 33.2284 8.51562 32.1458 10.8673 33.162L21.5123 37.762C23.864 38.7782 24.9466 41.5084 23.9304 43.86C22.9142 46.2117 20.184 47.2943 17.8323 46.2781L7.18726 41.6781Z',
  'M15.8144 25.4985C13.9201 23.7738 13.7827 20.84 15.5074 18.9458C17.2321 17.0515 20.1659 16.9141 22.0601 18.6388L30.6348 26.446C32.5291 28.1707 32.6665 31.1045 30.9418 32.9988C29.2171 34.893 26.2833 35.0305 24.389 33.3058L15.8144 25.4985Z',
  'M29.2275 12.9969C27.9959 10.7506 28.8185 7.93112 31.0648 6.69951C33.3112 5.4679 36.1306 6.2905 37.3622 8.53684L42.9373 18.7052C44.1689 20.9516 43.3463 23.771 41.1 25.0026C38.8536 26.2342 36.0342 25.4116 34.8026 23.1653L29.2275 12.9969Z',
  'M45.9732 5.52788C45.5377 3.00335 47.2312 0.60378 49.7557 0.168286C52.2802 -0.267209 54.6798 1.42629 55.1153 3.95082L57.0866 15.3785C57.5221 17.903 55.8286 20.3026 53.3041 20.7381C50.7796 21.1736 48.38 19.4801 47.9445 16.9555L45.9732 5.52788Z',
  'M64.2367 3.90086C64.6445 1.37171 67.0254 -0.34797 69.5545 0.0598454C72.0837 0.467661 73.8033 2.84854 73.3955 5.37769L71.5495 16.8263C71.1417 19.3554 68.7608 21.0751 66.2317 20.6673C63.7025 20.2595 61.9828 17.8786 62.3906 15.3494L64.2367 3.90086Z',
  'M82.0389 8.29214C83.2458 6.03245 86.0561 5.17902 88.3158 6.38595C90.5755 7.59288 91.4289 10.4031 90.222 12.6628L84.7586 22.8917C83.5517 25.1514 80.7415 26.0048 78.4818 24.7979C76.2221 23.5909 75.3686 20.7807 76.5756 18.521L82.0389 8.29214Z',
  'M97.4507 18.2259C99.326 16.4805 102.261 16.5858 104.006 18.4611C105.752 20.3363 105.647 23.2714 103.771 25.0168L95.2826 32.9175C93.4074 34.6628 90.4723 34.5575 88.7269 32.6823C86.9815 30.807 87.0868 27.8719 88.9621 26.1265L97.4507 18.2259Z',
  'M108.802 32.6256C111.142 31.5837 113.884 32.6363 114.926 34.9767C115.968 37.317 114.915 40.0589 112.575 41.1008L101.981 45.8172C99.6407 46.8591 96.8988 45.8064 95.8569 43.4661C94.815 41.1257 95.8676 38.3838 98.208 37.3419L108.802 32.6256Z',
  'M114.863 49.9308C117.415 49.7053 119.666 51.5912 119.892 54.143C120.117 56.6949 118.231 58.9464 115.679 59.172L104.128 60.1929C101.576 60.4184 99.3246 58.5325 99.0991 55.9807C98.8735 53.4288 100.759 51.1773 103.311 50.9517L114.863 49.9308Z',
];

function AiRiskGauge({ score, tone }: { score?: number; tone: RiskTone }) {
  const activeSegments =
    score === undefined ? 0 : Math.min(AI_RISK_GAUGE_SEGMENT_PATHS.length, Math.floor(score / 10));

  return (
    <div
      className={`inspection-common-ai-risk-insight__gauge is-${tone}`}
      aria-label={`${i18next.t('inspection.taskDetail.riskScore')} ${score ?? '-'}`}
    >
      <svg
        className="inspection-common-ai-risk-insight__gauge-svg"
        viewBox="0 0 120 68"
        aria-hidden="true"
        focusable="false"
      >
        <g transform="translate(0 3)">
          {AI_RISK_GAUGE_SEGMENT_PATHS.map((path, index) => (
            <path
              key={path}
              className={`inspection-common-ai-risk-insight__gauge-segment ${
                index < activeSegments ? 'is-active' : ''
              }`}
              d={path}
            />
          ))}
        </g>
      </svg>
      <strong className="inspection-common-ai-risk-insight__gauge-score">
        {score === undefined ? '-' : score}
      </strong>
    </div>
  );
}

function getRiskDimensionItems(riskProfile?: Record<string, any> | null): RiskInsightItem[] {
  const dimensions = ensureArray<any>(riskProfile?.riskDimensions);
  return dimensions.map((item, index) => {
    const score = toFiniteRoundedNumber(item.score);
    return {
      key: String(item.key || item.dimensionKey || item.label || `dimension-${index}`),
      label: getDisplayValue(getLocalizedText(
        item.labelEn || item.label || item.factorNameEn || item.factorName,
        item.labelAr || item.factorNameAr,
        '',
      )),
      score,
      tone: getRiskTone(score, item.tone),
    };
  });
}

function getRiskFactorItems(riskProfile?: Record<string, any> | null): RiskInsightItem[] {
  const factors = ensureArray<any>(riskProfile?.riskFactors);
  const profileScore = getRiskScoreValue(riskProfile);
  const profileToneSource = riskProfile?.aiRiskLevelName || riskProfile?.riskLevelName || riskProfile?.riskLevel;
  return factors.map((item, index) => {
    const score = toFiniteRoundedNumber(item.contributionScore ?? item.score);
    const factorToneSource = item.tone || item.riskLevel || item.riskLevelName;
    return {
      key: String(item.id || item.factorType || item.factorNameEn || item.factorName || `factor-${index}`),
      label: getDisplayValue(getLocalizedText(
        item.factorNameEn || item.factorName || item.factorType,
        item.factorNameAr,
        '',
      )),
      score,
      tone: score !== undefined
        ? getRiskTone(score)
        : getRiskTone(profileScore, factorToneSource || profileToneSource),
    };
  });
}

function getRiskInsightItems(riskProfile?: Record<string, any> | null): RiskInsightItem[] {
  const dimensionItems = getRiskDimensionItems(riskProfile);
  return dimensionItems.length ? dimensionItems : getRiskFactorItems(riskProfile);
}

function AiRiskInsightCard({
  riskProfile,
  isExpanded = false,
}: AiRiskInsightCardProps) {
  const riskScore = getRiskScoreValue(riskProfile);
  const riskLevelSource = riskProfile?.aiRiskLevelName || riskProfile?.riskLevelName || riskProfile?.riskLevel;
  const riskTone = getRiskTone(riskScore, riskLevelSource);
  const riskLevel = getRiskLevelDisplayValue(riskProfile);
  const riskInsightItems = getRiskInsightItems(riskProfile);
  const riskDescription = getRiskDescriptionValue(riskProfile);

  return (
    <div
      className={`inspection-common-ai-risk-insight ${
        isExpanded ? 'inspection-common-ai-risk-insight--expanded' : ''
      }`}
    >
      <div className="inspection-common-ai-risk-insight__panel">
        <AiRiskGauge score={riskScore} tone={riskTone} />
        <div className={`inspection-common-ai-risk-insight__level is-${riskTone}`}>
          <span className="inspection-common-ai-risk-insight__level-text">{riskLevel}</span>
          {riskDescription ? (
            <Tooltip
              title={riskDescription}
              placement="top"
              trigger={['hover', 'focus']}
              overlayClassName="inspection-common-ai-risk-insight__tooltip"
              destroyTooltipOnHide
            >
              <span
                className="inspection-common-ai-risk-insight__info"
                role="img"
                aria-label={riskDescription}
                tabIndex={0}
              >
                <img src={inspectionFigmaAssets.aiRiskInfoIcon} alt="" />
              </span>
            </Tooltip>
          ) : null}
        </div>

        {riskInsightItems.length ? (
          <div className="inspection-common-ai-risk-insight__dimension-list">
            {riskInsightItems.map((item) => (
              <div key={item.key} className="inspection-common-ai-risk-insight__dimension-item">
                <span className="inspection-common-ai-risk-insight__dimension-title">{item.label}</span>
                <span
                  className={`inspection-common-ai-risk-insight__dimension-score ${
                    item.score !== undefined ? `is-${item.tone}` : ''
                  }`}
                >
                  {item.score !== undefined ? item.score : '-'}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="inspection-common-ai-risk-insight__empty-value">-</div>
        )}
      </div>
    </div>
  );
}

export { AiRiskInsightCard };
