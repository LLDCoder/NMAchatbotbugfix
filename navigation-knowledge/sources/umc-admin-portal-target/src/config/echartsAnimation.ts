import * as echarts from "echarts";

let isEChartsAnimationConfigured = false;

/** Keep animation enabled for every chart option, including future charts. */
export function installEChartsAnimationDefaults() {
  if (isEChartsAnimationConfigured) {
    return;
  }

  echarts.registerPreprocessor((option) => {
    option.animation = true;
    option.animationDuration = 1000;
    option.animationDurationUpdate = 1000;
  });

  isEChartsAnimationConfigured = true;
}
