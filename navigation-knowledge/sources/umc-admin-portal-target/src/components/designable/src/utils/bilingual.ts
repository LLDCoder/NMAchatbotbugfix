import type {
  FormLanguageHost,
  PortalFormLang,
} from "@/components/designable/playground/FormPreviewLangContext";

type MaybeString = unknown;

interface BilingualValueInput {
  en?: MaybeString;
  ar?: MaybeString;
  legacy?: MaybeString;
}

interface BilingualResolveOptions extends BilingualValueInput {
  lang: PortalFormLang;
  host?: FormLanguageHost;
  fallback?: string;
}

interface BilingualDefaultOptions {
  defaultTitleEn: string;
  defaultTitleAr: string;
  defaultPlaceholderEn?: string;
  defaultPlaceholderAr?: string;
}

type GenericRecord = Record<string, unknown>;

function isRecord(value: unknown): value is GenericRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function asOptionalString(value: MaybeString): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function getBilingualValueByLang({
  lang,
  host = "runtime",
  en,
  ar,
  legacy,
  fallback = "",
}: BilingualResolveOptions): string {
  const primary = lang === "ar" ? asOptionalString(ar) : asOptionalString(en);
  const secondary = lang === "ar" ? asOptionalString(en) : asOptionalString(ar);
  const legacyValue = asOptionalString(legacy);
  const isDesigner = host === "designer";

  if (typeof primary === "string") {
    if (primary !== "") {
      return primary;
    }
    if (isDesigner && lang === "en") {
      return fallback;
    }
  }

  if (isDesigner) {
    if (lang === "ar" && typeof secondary === "string" && secondary !== "") {
      return secondary;
    }
    return fallback;
  }

  if (lang === "ar" && typeof secondary === "string" && secondary !== "") {
    return secondary;
  }

  if (typeof legacyValue === "string" && legacyValue !== "") {
    return legacyValue;
  }

  return fallback;
}

export function getEditableTitlePathByLang(lang: PortalFormLang) {
  return lang === "ar"
    ? "x-component-props.titleAr"
    : "x-component-props.titleEn";
}

export function buildBilingualComponentDefaults(
  node: { props?: Record<string, unknown> } | undefined,
  options: BilingualDefaultOptions,
) {
  const xcp = isRecord(node?.props?.["x-component-props"])
    ? node.props["x-component-props"]
    : {};
  const legacyTitle = asOptionalString(node?.props?.title) ?? asOptionalString(xcp.title);
  const legacyPlaceholder = asOptionalString(xcp.placeholder);

  const titleEn = asOptionalString(xcp.titleEn) ?? legacyTitle ?? options.defaultTitleEn;
  const titleAr = asOptionalString(xcp.titleAr) ?? options.defaultTitleAr;

  const defaults: GenericRecord = {
    title: titleEn,
    "x-component-props": {
      ...xcp,
      titleEn,
      titleAr,
    },
  };

  if (typeof options.defaultPlaceholderEn === "string") {
    defaults["x-component-props"].placeholderEn =
      asOptionalString(xcp.placeholderEn) ??
      legacyPlaceholder ??
      options.defaultPlaceholderEn;
  }

  if (typeof options.defaultPlaceholderAr === "string") {
    defaults["x-component-props"].placeholderAr =
      asOptionalString(xcp.placeholderAr) ?? options.defaultPlaceholderAr;
  }

  return defaults;
}

export function normalizeBilingualComponentProps(
  props: Record<string, unknown>,
  options: {
    lang: PortalFormLang;
    host?: FormLanguageHost;
    placeholderFallback?: string;
  },
) {
  const {
    placeholderEn,
    placeholderAr,
    titleEn,
    titleAr,
    placeholder,
    title,
    ...rest
  } = props;

  const placeholderValue = getBilingualValueByLang({
    lang: options.lang,
    host: options.host,
    en: placeholderEn,
    ar: placeholderAr,
    legacy: options.host === "designer" ? undefined : placeholder,
    fallback: options.placeholderFallback ?? "",
  });
  const titleValue = getBilingualValueByLang({
    lang: options.lang,
    host: options.host,
    en: titleEn,
    ar: titleAr,
    legacy: options.host === "designer" ? undefined : title,
    fallback: "",
  });

  return {
    ...rest,
    placeholder: placeholderValue,
    ...(options.host === "designer" ? {} : { title: titleValue }),
  };
}

function migrateBilingualNode(node: GenericRecord) {
  const xcp = isRecord(node["x-component-props"]) ? { ...node["x-component-props"] } : null;
  const xdp = isRecord(node["x-decorator-props"]) ? { ...node["x-decorator-props"] } : null;
  let changed = false;

  if (xcp) {
    const legacyTitle = asOptionalString(xcp.title) ?? asOptionalString(node.title);
    const legacyPlaceholder = asOptionalString(xcp.placeholder);

    if (asOptionalString(xcp.titleEn) == null && legacyTitle != null) {
      xcp.titleEn = legacyTitle;
      changed = true;
    }

    if (asOptionalString(xcp.placeholderEn) == null && legacyPlaceholder != null) {
      xcp.placeholderEn = legacyPlaceholder;
      changed = true;
    }

    if ("title" in xcp) {
      delete xcp.title;
      changed = true;
    }

    if ("placeholder" in xcp) {
      delete xcp.placeholder;
      changed = true;
    }

    if (changed) {
      node["x-component-props"] = xcp;
    }
  }

  if (xdp) {
    const legacyTooltip = asOptionalString(xdp.tooltip);
    let decoratorChanged = false;

    if (asOptionalString(xdp.tooltipEn) == null && legacyTooltip != null) {
      xdp.tooltipEn = legacyTooltip;
      decoratorChanged = true;
    }

    if ("tooltip" in xdp) {
      delete xdp.tooltip;
      decoratorChanged = true;
    }

    if (decoratorChanged) {
      node["x-decorator-props"] = xdp;
      changed = true;
    }
  }

  return changed;
}

/** Keep Card runtime props (descTooltip*) aligned with designer decorator tooltips on save/load. */
function mirrorCardDescTooltipToComponentProps(node: GenericRecord): boolean {
  if (node["x-component"] !== "Card") return false;
  const xdpRaw = node["x-decorator-props"];
  if (!isRecord(xdpRaw)) return false;
  let changed = false;
  const xcp = isRecord(node["x-component-props"])
    ? { ...node["x-component-props"] }
    : {};
  const pairs: [string, string][] = [
    ["tooltipEn", "descTooltipEn"],
    ["tooltipAr", "descTooltipAr"],
  ];
  for (const [decoratorKey, componentKey] of pairs) {
    if (!(decoratorKey in xdpRaw)) continue;
    const dv = typeof xdpRaw[decoratorKey] === "string" ? xdpRaw[decoratorKey] : "";
    const cv = typeof xcp[componentKey] === "string" ? xcp[componentKey] : "";
    if (dv !== cv) {
      xcp[componentKey] = dv;
      changed = true;
    }
  }
  if (changed) {
    node["x-component-props"] = xcp;
  }
  return changed;
}

function walkAndMigrate(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => walkAndMigrate(item));
  }

  if (!isRecord(value)) {
    return value;
  }

  const next: GenericRecord = { ...value };

  Object.keys(next).forEach((key) => {
    next[key] = walkAndMigrate(next[key]);
  });

  migrateBilingualNode(next);
  mirrorCardDescTooltipToComponentProps(next);
  return next;
}

export function migrateLegacyBilingualProps<T>(schema: T): T {
  return walkAndMigrate(schema) as T;
}
