export type LayoutWideScreenMode = "centered" | "legacy" | "fluid";

const configuredLayoutWideScreenMode =
  import.meta.env.VITE_LAYOUT_WIDE_SCREEN_MODE;

export const layoutWideScreenMode: LayoutWideScreenMode =
  configuredLayoutWideScreenMode === "centered" ||
  configuredLayoutWideScreenMode === "fluid"
    ? configuredLayoutWideScreenMode
    : "legacy";

export const isWideScreenCenteredMode = layoutWideScreenMode === "centered";
export const isWideScreenFluidMode = layoutWideScreenMode === "fluid";

export const layoutWideScreenBaseWidthPx = isWideScreenCenteredMode
  ? 1724
  : 1920;
export const layoutWideScreenBaseWidthCssVar =
  "--layout-wide-screen-base-width";

export function applyLayoutWideScreenCssVariables() {
  document.documentElement.style.setProperty(
    layoutWideScreenBaseWidthCssVar,
    `${layoutWideScreenBaseWidthPx}px`,
  );
}
