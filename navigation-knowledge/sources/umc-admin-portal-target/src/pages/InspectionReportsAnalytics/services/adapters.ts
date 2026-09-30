import {
  COLORS,
  EMIRATE_COLORS,
  RISK_BAND_COLORS,
  RISK_BANDS,
  TASK_STATUS_COLORS,
  VIOLATION_STATUS_COLORS,
} from "../constants";
import type {
  DonutData,
  EmirateBreakdownRow,
  HeatmapData,
  HorizontalBarItem,
  OperationalAnalyticsData,
  RiskAnalyticsData,
  RiskBand,
  RiskProfileRow,
  SummaryCard,
  StackedDistributionRow,
  TaskStatus,
  TrendData,
  ViolationStatus,
} from "../types";
import type {
  DistributionItemDto,
  EmirateBreakdownRowDto,
  EmirateTrendByEmirateDto,
  FineCollectionDto,
  HighRiskProfileDto,
  OperationalInsightsDto,
  PenaltiesByViolationDegreeDto,
  RepeatViolatorDto,
  RiskBandByEmirateRowDto,
  RiskBandBySourceRowDto,
  RiskInsightsDto,
  SummaryDistributionDto,
  StatusDistributionItemDto,
  TeamPerformanceTrendDto,
  TrendBucketDto,
  ViolationsByEmirateDto,
} from "./api";

const asNumber = (value: unknown) => {
  if (value === null || value === "") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const isNumberValue = (value: unknown) =>
  value !== null && value !== "" && Number.isFinite(Number(value));

const hasOwn = (value: unknown, key: string) =>
  Boolean(
    value &&
      typeof value === "object" &&
      Object.prototype.hasOwnProperty.call(value, key),
  );

const isCompleteDistribution = (items: StatusDistributionItemDto[] | null | undefined) =>
  Array.isArray(items) &&
  items.every((item) => typeof item.label === "string" && isNumberValue(item.count));

const isCompleteTrend = (
  items: TrendBucketDto[] | null | undefined,
  fields: Array<keyof TrendBucketDto>,
) =>
  Array.isArray(items) &&
  items.every(
    (item) =>
      typeof item.label === "string" &&
      fields.every((field) => isNumberValue(item[field])),
  );

const distributionTotal = (items: StatusDistributionItemDto[]) =>
  items.reduce((total, item) => total + asNumber(item.count), 0);

const mapDistribution = (
  items: StatusDistributionItemDto[],
  total: number,
  colorOf: (label: string, index: number) => string,
): DonutData => ({
  total,
  items: items.map((item, index) => ({
    label: item.label || "Unknown",
    value: asNumber(item.count),
    color: colorOf(item.label || "", index),
    percentage: isNumberValue(item.percentage) ? asNumber(item.percentage) : undefined,
  })),
});

const mapTrend = (
  buckets: TrendBucketDto[],
  format: TrendData["format"],
  series: Array<{
    name: string;
    color: string;
    field: keyof TrendBucketDto;
    type?: "line" | "bar";
  }>,
): TrendData => ({
  categories: buckets.map((bucket) => bucket.label || ""),
  format,
  series: series.map((item) => ({
    name: item.name,
    color: item.color,
    type: item.type,
    values: buckets.map((bucket) => asNumber(bucket[item.field])),
  })),
});

const EMIRATE_FALLBACK_COLORS = [
  COLORS.blueDark,
  COLORS.green,
  COLORS.gold,
  COLORS.orange,
  COLORS.pink,
  COLORS.teal,
  COLORS.purple,
];

const getEmirateColor = (emirateName: string, index: number) =>
  EMIRATE_COLORS[emirateName] ||
  EMIRATE_FALLBACK_COLORS[index % EMIRATE_FALLBACK_COLORS.length];

const isCompleteViolationHeatmap = (
  source: ViolationsByEmirateDto | null | undefined,
) =>
  Boolean(
    source &&
      Array.isArray(source.violationItemCodes) &&
      source.violationItemCodes.every(
        (violationItemCode) =>
          typeof violationItemCode === "string" && violationItemCode.length > 0,
      ) &&
      Array.isArray(source.rows) &&
      source.rows.every(
        (row) =>
          typeof row.emirateName === "string" &&
          Array.isArray(row.counts) &&
          row.counts.length === source.violationItemCodes!.length &&
          row.counts.every(isNumberValue) &&
          isNumberValue(row.total),
      ),
  );

const mapViolationHeatmap = (
  source: ViolationsByEmirateDto,
  color: HeatmapData["color"],
): HeatmapData => {
  const rows = source.rows || [];
  const violationItemCodes = source.violationItemCodes || [];

  return {
    emirates: rows.map((row) => row.emirateName || "Unknown"),
    reasons: violationItemCodes,
    values: rows.flatMap((row, emirateIndex) =>
    (row.counts || []).map((count, reasonIndex) => [
      reasonIndex,
      emirateIndex,
      asNumber(count),
    ] as [number, number, number]),
    ),
    totals: violationItemCodes.map((violationItemCode, reasonIndex) => ({
      label: violationItemCode,
      value: rows.reduce(
        (total, row) => total + asNumber(row.counts?.[reasonIndex]),
        0,
      ),
    })),
    color,
  };
};

const isCompleteEmirateTrend = (
  rows: EmirateTrendByEmirateDto[] | null | undefined,
  valueField: "count" | "amount",
) =>
  Array.isArray(rows) &&
  rows.every(
    (row) =>
      typeof row.emirateName === "string" &&
      Array.isArray(row.points) &&
      row.points.every(
        (point) =>
          typeof point.label === "string" && isNumberValue(point[valueField]),
      ),
  );

const mapEmirateTrend = (
  rows: EmirateTrendByEmirateDto[],
  format: TrendData["format"],
  valueField: "count" | "amount",
): TrendData => {
  const categories: string[] = [];
  const categorySet = new Set<string>();

  rows.forEach((row) => {
    (row.points || []).forEach((point) => {
      const label = point.label || "";
      if (!categorySet.has(label)) {
        categorySet.add(label);
        categories.push(label);
      }
    });
  });

  return {
    categories,
    format,
    series: rows.map((row, index) => {
      const valuesByCategory = new Map(
        (row.points || []).map((point) => [
          point.label || "",
          asNumber(point[valueField]),
        ]),
      );
      const emirateName = row.emirateName || "Unknown";

      return {
        name: emirateName,
        color: getEmirateColor(emirateName, index),
        values: categories.map((category) => valuesByCategory.get(category) || 0),
      };
    }),
  };
};

const isCompleteFineCollection = (source: FineCollectionDto | null | undefined) =>
  Boolean(
    source &&
      ["paid", "outstanding", "collectionRate"].every((field) =>
        isNumberValue(source[field as keyof FineCollectionDto]),
      ),
  );

const isCompleteSummaryDistribution = (
  source: SummaryDistributionDto | null | undefined,
) =>
  Boolean(
    source &&
      isNumberValue(source.total) &&
      isCompleteDistribution(source.items),
  );

const isCompletePenaltyDistribution = (
  source: PenaltiesByViolationDegreeDto | null | undefined,
) =>
  Boolean(
    source &&
      Array.isArray(source.items) &&
      source.items.every(
        (item) => typeof item.label === "string" && isNumberValue(item.count),
      ),
  );

const isCompleteTeamSummary = (source: TeamPerformanceTrendDto | null | undefined) => {
  const kpis = source?.kpis;
  return Boolean(
    kpis &&
      ["slaCompliance", "slaBreached", "avgProcessingTimeMinutes"].every((field) =>
        isNumberValue(kpis[field as keyof typeof kpis]),
      ),
  );
};

const isCompleteTeamTrend = (source: TeamPerformanceTrendDto | null | undefined) =>
  Array.isArray(source?.buckets) &&
  source.buckets.every(
    (bucket) =>
      typeof bucket.label === "string" &&
      isNumberValue(bucket.slaCompliance) &&
      isNumberValue(bucket.avgProcessingTimeMinutes),
  );

const mapTeamSummary = (
  baseline: SummaryCard[],
  source: NonNullable<TeamPerformanceTrendDto["kpis"]>,
) => {
  const values: Record<string, number> = {
    slaCompliance: asNumber(source.slaCompliance),
    slaBreached: asNumber(source.slaBreached),
    avgProcessingTime: asNumber(source.avgProcessingTimeMinutes) / 60,
  };

  return baseline.map((card) =>
    hasOwn(values, card.key) ? { ...card, value: values[card.key] } : card,
  );
};

const mapTeamTrend = (
  buckets: NonNullable<TeamPerformanceTrendDto["buckets"]>,
): TrendData => ({
  categories: buckets.map((bucket) => bucket.label || ""),
  format: "percentage",
  series: [
    {
      name: "SLA Compliance",
      color: COLORS.green,
      lineType: "solid",
      values: buckets.map((bucket) => asNumber(bucket.slaCompliance)),
    },
    {
      name: "Avg. Processing Time",
      color: COLORS.red,
      lineType: "dashed",
      yAxisIndex: 1,
      values: buckets.map((bucket) => asNumber(bucket.avgProcessingTimeMinutes) / 60),
    },
  ],
});

const isCompleteRepeatViolators = (rows: RepeatViolatorDto[] | null | undefined) =>
  Array.isArray(rows) &&
  rows.every(
    (row) => typeof row.profileName === "string" && isNumberValue(row.violationCount),
  );

const mapRepeatViolators = (rows: RepeatViolatorDto[]): HorizontalBarItem[] =>
  rows
    .map((row, index) => ({
      index,
      rank: isNumberValue(row.rank) ? asNumber(row.rank) : index + 1,
      label: row.profileName || "Unknown",
      value: asNumber(row.violationCount),
      color: COLORS.gold,
    }))
    .sort((left, right) => left.rank - right.rank)
    .map(({ label, value, color }) => ({ label, value, color }));

const hasCompleteKpis = (source: OperationalInsightsDto) => {
  const kpis = source.kpis;
  return Boolean(
    kpis &&
      ["totalInspections", "violationsFound", "fineCollected", "refund", "appeals"].every(
        (key) => isNumberValue(kpis[key as keyof typeof kpis]),
      ),
  );
};

export const mapOperationalInsights = (
  source: OperationalInsightsDto,
  baseline: OperationalAnalyticsData,
): OperationalAnalyticsData => {
  let next = baseline;
  const hasKpis = hasCompleteKpis(source);
  const kpis = source.kpis;

  if (hasKpis && kpis) {
    const values: Record<string, number> = {
      totalInspections: asNumber(kpis.totalInspections),
      violationsFound: asNumber(kpis.violationsFound),
      fineCollected: asNumber(kpis.fineCollected),
      refund: asNumber(kpis.refund),
      appeals: asNumber(kpis.appeals),
    };
    next = {
      ...next,
      summaryCards: next.summaryCards.map((card) =>
        hasOwn(values, card.key) ? { ...card, value: values[card.key] } : card,
      ),
    };
  }

  if (
    hasOwn(source, "inspectionStatusDistribution") &&
    isCompleteDistribution(source.inspectionStatusDistribution)
  ) {
    const items = source.inspectionStatusDistribution || [];
    next = {
      ...next,
      inspectionStatus: mapDistribution(
        items,
        hasKpis && kpis ? asNumber(kpis.totalInspections) : distributionTotal(items),
        (label) => TASK_STATUS_COLORS[label as TaskStatus] || COLORS.gray,
      ),
    };
  }

  if (
    hasOwn(source, "violationStatusDistribution") &&
    isCompleteDistribution(source.violationStatusDistribution)
  ) {
    const items = source.violationStatusDistribution || [];
    next = {
      ...next,
      violationStatus: mapDistribution(
        items,
        hasKpis && kpis ? asNumber(kpis.violationsFound) : distributionTotal(items),
        (label) => VIOLATION_STATUS_COLORS[label as ViolationStatus] || COLORS.gray,
      ),
    };
  }

  if (
    hasOwn(source, "inspectionViolationTrend") &&
    isCompleteTrend(source.inspectionViolationTrend, [
      "inspectionCount",
      "violationCount",
      "contentViolationCount",
      "licenseViolationCount",
      "appealCount",
    ])
  ) {
    next = {
      ...next,
      inspectionAndViolationTrend: mapTrend(source.inspectionViolationTrend || [], "count", [
        { name: "Inspections", color: COLORS.green, field: "inspectionCount" },
        { name: "Total Violations", color: COLORS.blue, field: "violationCount" },
        { name: "Content Violations", color: COLORS.orange, field: "contentViolationCount" },
        { name: "License Violations", color: COLORS.gold, field: "licenseViolationCount" },
        { name: "Appeals", color: COLORS.purple, field: "appealCount" },
      ]),
    };
  }

  if (
    hasOwn(source, "fineTrendByCategory") &&
    isCompleteTrend(source.fineTrendByCategory, [
      "licenseFineAmount",
      "contentFineAmount",
      "totalFineAmount",
    ])
  ) {
    next = {
      ...next,
      fineTrend: mapTrend(source.fineTrendByCategory || [], "currency", [
        {
          name: "License Fine",
          color: COLORS.red,
          field: "licenseFineAmount",
          type: "bar",
        },
        {
          name: "Content Fine",
          color: COLORS.yellow,
          field: "contentFineAmount",
          type: "bar",
        },
        { name: "Total Fine", color: COLORS.gold, field: "totalFineAmount" },
      ]),
    };
  }

  if (
    hasOwn(source, "inspectionTrendByEmirate") &&
    isCompleteEmirateTrend(source.inspectionTrendByEmirate, "count")
  ) {
    next = {
      ...next,
      inspectionByEmirate: mapEmirateTrend(
        source.inspectionTrendByEmirate || [],
        "count",
        "count",
      ),
    };
  }

  if (
    hasOwn(source, "violationTrendByEmirate") &&
    isCompleteEmirateTrend(source.violationTrendByEmirate, "count")
  ) {
    next = {
      ...next,
      violationsByEmirate: mapEmirateTrend(
        source.violationTrendByEmirate || [],
        "count",
        "count",
      ),
    };
  }

  if (
    hasOwn(source, "fineTrendByEmirate") &&
    isCompleteEmirateTrend(source.fineTrendByEmirate, "amount")
  ) {
    next = {
      ...next,
      fineByEmirate: mapEmirateTrend(
        source.fineTrendByEmirate || [],
        "currency",
        "amount",
      ),
    };
  }

  if (
    hasOwn(source, "licenseViolationsByEmirate") &&
    isCompleteViolationHeatmap(source.licenseViolationsByEmirate)
  ) {
    next = {
      ...next,
      licenseHeatmap: mapViolationHeatmap(source.licenseViolationsByEmirate!, "blue"),
    };
  }

  if (
    hasOwn(source, "contentViolationsByEmirate") &&
    isCompleteViolationHeatmap(source.contentViolationsByEmirate)
  ) {
    next = {
      ...next,
      contentHeatmap: mapViolationHeatmap(source.contentViolationsByEmirate!, "orange"),
    };
  }

  const fineCollection = source.fineCollection;
  if (fineCollection && isCompleteFineCollection(fineCollection)) {
    const collectionRate = asNumber(fineCollection.collectionRate);
    next = {
      ...next,
      fineCollection: {
        isAvailable: true,
        value: collectionRate,
        primaryLabel: "Paid",
        primaryValue: asNumber(fineCollection.paid),
        secondaryLabel: "Outstanding",
        secondaryValue: asNumber(fineCollection.outstanding),
        format: "currency",
      },
    };
  }

  const appealOutcomes = source.appealOutcomes;
  if (appealOutcomes && isCompleteSummaryDistribution(appealOutcomes)) {
    const items = appealOutcomes.items || [];
    next = {
      ...next,
      appealOutcomes: mapDistribution(
        items,
        asNumber(appealOutcomes.total),
        (label, index) => {
          if (label === "Violation Maintained") return COLORS.red;
          if (label === "Violation Modified") return COLORS.yellow;
          if (label === "Violation Cancelled") return COLORS.green;
          return [COLORS.red, COLORS.yellow, COLORS.green][index % 3];
        },
      ),
    };
  }

  const penaltiesByViolationDegree = source.penaltiesByViolationDegree;
  if (
    penaltiesByViolationDegree &&
    isCompletePenaltyDistribution(penaltiesByViolationDegree)
  ) {
    next = {
      ...next,
      penaltiesByDegree: (penaltiesByViolationDegree.items || []).map((item) => ({
        label: item.label || "Unknown",
        value: asNumber(item.count),
        percentage: isNumberValue(item.percentage) ? asNumber(item.percentage) : undefined,
      })),
    };
  }

  const teamPerformanceTrend = source.teamPerformanceTrend;
  if (
    teamPerformanceTrend?.kpis &&
    isCompleteTeamSummary(teamPerformanceTrend)
  ) {
    next = {
      ...next,
      teamSummary: mapTeamSummary(next.teamSummary, teamPerformanceTrend.kpis),
    };
  }

  if (
    teamPerformanceTrend?.buckets &&
    isCompleteTeamTrend(teamPerformanceTrend)
  ) {
    next = {
      ...next,
      teamPerformanceTrend: mapTeamTrend(teamPerformanceTrend.buckets),
    };
  }

  const topRepeatViolators = source.topRepeatViolators;
  if (
    topRepeatViolators &&
    isCompleteRepeatViolators(topRepeatViolators.items)
  ) {
    next = {
      ...next,
      repeatViolators: mapRepeatViolators(topRepeatViolators.items || []),
    };
  }

  return next;
};

export const mapEmirateBreakdownRows = (
  rows: EmirateBreakdownRowDto[] | null | undefined,
): EmirateBreakdownRow[] =>
  (rows || [])
    .filter((row) => typeof row.emirateName === "string" && row.emirateName.length > 0)
    .map((row) => ({
      emirate: row.emirateName || "Unknown",
      inspections: asNumber(row.inspections),
      violations: asNumber(row.violations),
      content: asNumber(row.contentViolations),
      license: asNumber(row.licenseViolations),
      violationRate: asNumber(row.violationRate),
      fines: asNumber(row.fines),
      collectedRate: asNumber(row.collectedRate),
    }));

const RISK_DISTRIBUTION_COLORS = [
  COLORS.green,
  COLORS.yellow,
  COLORS.red,
  COLORS.blue,
  COLORS.purple,
];

const getRiskBand = (value: unknown): RiskBand | null => {
  const normalized = String(value || "")
    .replace(/\s/g, "")
    .toLowerCase();

  if (normalized === "critical") return "Critical";
  if (normalized === "high") return "High";
  if (normalized === "medium") return "Medium";
  if (normalized === "low") return "Low";
  return null;
};

const createRiskBandValues = (
  valueOf: (band: RiskBand) => number,
): Record<RiskBand, number> => ({
  Critical: valueOf("Critical"),
  High: valueOf("High"),
  Medium: valueOf("Medium"),
  Low: valueOf("Low"),
});

const isCompleteRiskKpis = (source: RiskInsightsDto) => {
  const kpis = source.kpis;
  return Boolean(
    kpis &&
      [
        "totalRiskTasks",
        "confirmedAiFindings",
        "highCriticalRiskTasks",
        "highRiskProfiles",
        "avgRiskScore",
      ].every((key) => isNumberValue(kpis[key as keyof typeof kpis])),
  );
};

const isCompleteRiskBandBySource = (
  rows: RiskBandBySourceRowDto[] | null | undefined,
) =>
  Array.isArray(rows) &&
  rows.every(
    (row) =>
      Boolean(getRiskBand(row.riskBand)) &&
      ["total", "aiGenerated", "officerInitiated"].every((field) =>
        isNumberValue(row[field as keyof RiskBandBySourceRowDto]),
      ),
  );

const mapRiskBandBySource = (
  rows: RiskBandBySourceRowDto[],
): StackedDistributionRow[] => {
  const rowsByBand = new Map<RiskBand, RiskBandBySourceRowDto>();
  rows.forEach((row) => {
    const riskBand = getRiskBand(row.riskBand);
    if (riskBand) rowsByBand.set(riskBand, row);
  });

  const makeRow = (
    label: string,
    field: "total" | "aiGenerated" | "officerInitiated",
  ): StackedDistributionRow => {
    const values = createRiskBandValues((band) =>
      asNumber(rowsByBand.get(band)?.[field]),
    );
    return {
      label,
      total: RISK_BANDS.reduce((total, band) => total + values[band], 0),
      values,
    };
  };

  return [
    makeRow("All Risk Tasks", "total"),
    makeRow("AI-Generated Tasks", "aiGenerated"),
    makeRow("Officer-Initiated Tasks", "officerInitiated"),
  ];
};

const isCompleteRiskBandByEmirate = (
  rows: RiskBandByEmirateRowDto[] | null | undefined,
) =>
  Array.isArray(rows) &&
  rows.every(
    (row) =>
      typeof row.emirateName === "string" &&
      ["total", "critical", "high", "medium", "low"].every((field) =>
        isNumberValue(row[field as keyof RiskBandByEmirateRowDto]),
      ),
  );

const mapRiskBandByEmirate = (
  rows: RiskBandByEmirateRowDto[],
): StackedDistributionRow[] =>
  rows.map((row) => ({
    label: row.emirateName || "Unknown",
    total: asNumber(row.total),
    values: {
      Critical: asNumber(row.critical),
      High: asNumber(row.high),
      Medium: asNumber(row.medium),
      Low: asNumber(row.low),
    },
  }));

const mapHighRiskProfiles = (
  rows: HighRiskProfileDto[] | null | undefined,
): RiskProfileRow[] =>
  (rows || []).reduce<RiskProfileRow[]>((profiles, row, index) => {
    const riskLevel = getRiskBand(row.riskLevel);
    if (
      (riskLevel !== "Critical" && riskLevel !== "High") ||
      typeof row.profileName !== "string" ||
      typeof row.emirate !== "string" ||
      !isNumberValue(row.riskScore)
    ) {
      return profiles;
    }

    profiles.push({
      id: `${row.rank ?? index + 1}-${row.profileName}`,
      rank: isNumberValue(row.rank) ? asNumber(row.rank) : index + 1,
      profile: row.profileName,
      emirate: row.emirate,
      factors: (row.triggeredFactors || []).filter(
        (factor): factor is string => typeof factor === "string",
      ),
      riskScore: asNumber(row.riskScore),
      riskLevel,
    });
    return profiles;
  }, []);

const mapRiskDistribution = (
  items: DistributionItemDto[],
  total: number,
  colorOf: (label: string, index: number) => string,
) => mapDistribution(items, total, colorOf);

const mapRiskBandDistribution = (
  items: DistributionItemDto[],
  total: number,
): DonutData => ({
  total,
  items: items.map((item, index) => {
    const riskBand = getRiskBand(item.code) || getRiskBand(item.label);
    return {
      label: riskBand || item.label || "Unknown",
      value: asNumber(item.count),
      percentage: isNumberValue(item.percentage) ? asNumber(item.percentage) : undefined,
      color:
        (riskBand && RISK_BAND_COLORS[riskBand]) ||
        RISK_DISTRIBUTION_COLORS[index % RISK_DISTRIBUTION_COLORS.length],
    };
  }),
});

export const mapRiskInsights = (
  source: RiskInsightsDto,
  baseline: RiskAnalyticsData,
): RiskAnalyticsData => {
  let next = baseline;
  const hasKpis = isCompleteRiskKpis(source);
  const kpis = source.kpis;

  if (hasKpis && kpis) {
    const values: Record<string, number> = {
      totalRiskTasks: asNumber(kpis.totalRiskTasks),
      confirmedAiFindings: asNumber(kpis.confirmedAiFindings),
      highCriticalRiskTasks: asNumber(kpis.highCriticalRiskTasks),
      highRiskProfiles: asNumber(kpis.highRiskProfiles),
      avgRiskScore: asNumber(kpis.avgRiskScore),
    };
    next = {
      ...next,
      summaryCards: next.summaryCards.map((card) =>
        hasOwn(values, card.key) ? { ...card, value: values[card.key] } : card,
      ),
    };
  }

  if (
    hasOwn(source, "topRiskDrivenReasons") &&
    isCompleteDistribution(source.topRiskDrivenReasons)
  ) {
    const items = source.topRiskDrivenReasons || [];
    next = {
      ...next,
      riskReasons: mapRiskDistribution(
        items,
        distributionTotal(items),
        (_label, index) => RISK_DISTRIBUTION_COLORS[index % RISK_DISTRIBUTION_COLORS.length],
      ),
    };
  }

  if (
    source.aiHitRate &&
    ["completed", "hits", "hitRate"].every((field) =>
      isNumberValue(source.aiHitRate?.[field as keyof typeof source.aiHitRate]),
    )
  ) {
    next = {
      ...next,
      aiHitRate: {
        isAvailable: true,
        value: asNumber(source.aiHitRate.hitRate),
        primaryLabel: "Hits",
        primaryValue: asNumber(source.aiHitRate.hits),
        secondaryLabel: "Completed",
        secondaryValue: asNumber(source.aiHitRate.completed),
        format: "count",
      },
    };
  }

  if (
    source.taskSource &&
    ["aiGenerated", "officerInitiated", "total", "autoTriageRate", "tasksPerDay"].every(
      (field) => isNumberValue(source.taskSource?.[field as keyof typeof source.taskSource]),
    )
  ) {
    const taskSource = source.taskSource;
    const aiGenerated = asNumber(taskSource.aiGenerated);
    const officerInitiated = asNumber(taskSource.officerInitiated);
    const sourceDistributionTotal = aiGenerated + officerInitiated;
    const autoTriageRate = asNumber(taskSource.autoTriageRate);
    next = {
      ...next,
      sourceMetrics: {
        autoTriageRate,
        tasksPerDay: asNumber(taskSource.tasksPerDay),
        total: asNumber(taskSource.total),
        sourceDistribution: {
          total: sourceDistributionTotal,
          items: [
            {
              label: "AI-Generated Tasks",
              value: aiGenerated,
              color: COLORS.green,
            },
            {
              label: "Officer-Initiated Tasks",
              value: officerInitiated,
              color: COLORS.yellow,
            },
          ],
        },
      },
    };
  }

  if (
    hasOwn(source, "riskBandDistribution") &&
    isCompleteDistribution(source.riskBandDistribution)
  ) {
    const items = source.riskBandDistribution || [];
    next = {
      ...next,
      riskBands: mapRiskBandDistribution(items, distributionTotal(items)),
    };
  }

  if (
    hasOwn(source, "riskBandBySource") &&
    isCompleteRiskBandBySource(source.riskBandBySource)
  ) {
    next = {
      ...next,
      bandsBySource: mapRiskBandBySource(source.riskBandBySource || []),
    };
  }

  if (
    hasOwn(source, "riskBandByEmirate") &&
    isCompleteRiskBandByEmirate(source.riskBandByEmirate)
  ) {
    next = {
      ...next,
      bandsByEmirate: mapRiskBandByEmirate(source.riskBandByEmirate || []),
    };
  }

  if (hasOwn(source, "topRiskFactors") && isCompleteDistribution(source.topRiskFactors)) {
    next = {
      ...next,
      riskFactors: (source.topRiskFactors || []).map((item) => ({
        label: item.label || "Unknown",
        value: asNumber(item.count),
        color: COLORS.green,
        percentage: isNumberValue(item.percentage) ? asNumber(item.percentage) : undefined,
      })),
    };
  }

  if (hasOwn(source, "topHighRiskProfiles") && Array.isArray(source.topHighRiskProfiles)) {
    next = {
      ...next,
      highRiskProfiles: mapHighRiskProfiles(source.topHighRiskProfiles),
    };
  }

  return next;
};
