interface SkipWhen {
  stepIndex: number;
  field: string;
  equals: string | number | (string | number)[];
  arrayField?: string;
  arrayItemField?: string;
  matchMode?: "every" | "some";
}

function parseStepFormData(step: any): Record<string, any> {
  try {
    return typeof step?.formData === "string"
      ? JSON.parse(step.formData)
      : step?.formData || {};
  } catch {
    return {};
  }
}

function getFormValues(step: any): Record<string, any> {
  const parsed = parseStepFormData(step);
  return parsed?.formValues || {};
}

function getSkipWhen(step: any): SkipWhen | undefined {
  const parsed = parseStepFormData(step);
  return parsed?.skipWhen || step?.skipWhen;
}

function matchesEquals(
  fieldValue: unknown,
  equals: SkipWhen["equals"],
): boolean {
  if (Array.isArray(equals)) {
    return equals.some((v) => String(v) === String(fieldValue));
  }
  return String(fieldValue) === String(equals);
}

function evaluateRule(
  rule: SkipWhen,
  depValues: Record<string, any>,
): boolean {
  const fieldValue = depValues[rule.field];

  if (!rule.arrayField) {
    return matchesEquals(fieldValue, rule.equals);
  }

  const arr = fieldValue?.[rule.arrayField];
  if (!Array.isArray(arr) || arr.length === 0) return false;

  const itemValues = rule.arrayItemField
    ? arr.map((item: any) => item?.[rule.arrayItemField!])
    : arr;
  const equalsArr = Array.isArray(rule.equals)
    ? rule.equals
    : [rule.equals];

  if (rule.matchMode === "every") {
    return itemValues.every((v: unknown) =>
      equalsArr.some((e) => String(e) === String(v)),
    );
  }
  return itemValues.some((v: unknown) =>
    equalsArr.some((e) => String(e) === String(v)),
  );
}

function isStepSkipped(step: any, fullList: any[]): boolean {
  const rule = getSkipWhen(step);
  if (!rule) return false;
  const depValues = getFormValues(fullList[rule.stepIndex]);
  return evaluateRule(rule, depValues);
}

const HIDE_TRAINING_PROGRAM_SERVICE_CODES = new Set([8006, 8007]);

function getStepSchema(step: any): unknown {
  return parseStepFormData(step)?.schema;
}

function nodeHasTrainingProgram(node: unknown): boolean {
  if (!node || typeof node !== "object") return false;
  const current = node as Record<string, any>;
  const componentProps =
    current["x-component-props"] && typeof current["x-component-props"] === "object"
      ? current["x-component-props"]
      : {};

  if (
    current.name === "TrainingVideoWatched" ||
    componentProps.uniqueValue === "TrainingVideoWatched"
  ) {
    return true;
  }

  const text = String(componentProps.text ?? componentProps.textEn ?? "").toLowerCase();
  if (current["x-component"] === "Information" && text.includes("training program video")) {
    return true;
  }

  return Object.values(current).some(nodeHasTrainingProgram);
}

function isTrainingProgramStep(step: any): boolean {
  if (String(step?.stepNameEn ?? "").trim().toLowerCase() === "training program") {
    return true;
  }
  return nodeHasTrainingProgram(getStepSchema(step));
}

export function getVisibleFormilyList(
  fullList: any[],
  serviceCode?: string | number | null,
): any[] {
  const hideTrainingProgram = HIDE_TRAINING_PROGRAM_SERVICE_CODES.has(
    Number(serviceCode),
  );
  return fullList.filter((step) => {
    if (hideTrainingProgram && isTrainingProgramStep(step)) return false;
    return !isStepSkipped(step, fullList);
  });
}

export function getVisibleFormilyListWithLiveValues(
  fullList: any[],
  liveOriginalIndex: number,
  liveValues: Record<string, any>,
): any[] {
  return fullList.filter((step) => {
    const rule = getSkipWhen(step);
    if (!rule) return true;
    const depValues =
      rule.stepIndex === liveOriginalIndex
        ? liveValues
        : getFormValues(fullList[rule.stepIndex]);
    return !evaluateRule(rule, depValues);
  });
}
