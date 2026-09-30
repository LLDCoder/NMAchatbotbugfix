import * as echarts from "echarts";
import ReactEChartsCore from "echarts-for-react/lib/core";
import type { EChartsReactProps } from "echarts-for-react/lib/types";

export default class ClassNameECharts extends ReactEChartsCore {
  constructor(props: EChartsReactProps) {
    super(props);
    this.echarts = echarts;
  }

  render() {
    const { style, className = "" } = this.props;
    const divHTMLAttributes: Partial<EChartsReactProps> = {
      ...this.props,
    };

    [
      "style",
      "className",
      "echarts",
      "option",
      "theme",
      "notMerge",
      "replaceMerge",
      "lazyUpdate",
      "showLoading",
      "loadingOption",
      "opts",
      "onChartReady",
      "onEvents",
      "shouldSetOption",
      "autoResize",
    ].forEach((key) => {
      delete divHTMLAttributes[key as keyof EChartsReactProps];
    });

    return (
      <div
        ref={(element) => {
          this.ele = element as HTMLElement;
        }}
        style={style}
        className={`echarts-for-react ${className}`.trim()}
        {...divHTMLAttributes}
      />
    );
  }
}
