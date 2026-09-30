import { useMemo } from "react";
import AED from "@/assets/icons/Aed";
import { Table } from "antd";
import "./ServicesFee.less";
import "@/components/common/FormliyView/index.less";
import { useTranslation } from "react-i18next";

type FeeTableRow = Record<string, unknown>;

export default function ReviewDeclaration({ tableData }: { tableData: FeeTableRow[] }) {
  const { t } = useTranslation();
  const totalFee = useMemo(() => {
    if (!Array.isArray(tableData)) return 0;
    return tableData.reduce((sum, row) => {
      const price = Number((row as { money?: unknown }).money ?? 0);
      return sum + (Number.isNaN(price) ? 0 : price);
    }, 0);
  }, [tableData]);
  const tableProps = {};
  const columns = [
    {
      title: t("FormilyReviewList.number"),
      dataIndex: "Number",
      key: "Number",
      align: "left" as const,
    },
    {
      title: t("FormilyReviewList.activity"),
      dataIndex: "Activity",
      key: "Activity",
      align: "left" as const,
    },
    {
      title: (
        <div className="moneybox">
          {t("FormilyReviewList.feesInAED")} (
          <AED withParentheses={false} className="service-fees-header-currency-icon" aria-hidden />
          )
        </div>
      ),
      width: 200,
      dataIndex: "money",
      key: "money",
      align: "right" as const,
      render: (money: number) => (
        <div className="select-table-node-right service-fees-amount-cell">
          <span className="select-table-node-fee">
            {money.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        </div>
      ),
    },
  ];
  return (
    <div className="ServicesFeesCard">
      <p>{t("FormilyReviewList.servicesFees")}</p>
      <Table
        className="formtable service-fees-table"
        dataSource={tableData}
        columns={columns}
        pagination={false}
        size="small"
        bordered={false}
        {...tableProps}
      />
      <div className="table-footer">
        <div className="total-label">{t("FormilyReviewList.totalFee")}</div>
        <div className="total-amount">
          <AED withParentheses={false} className="service-fees-total-currency-icon" aria-hidden />
          <span className="total-value">
            {totalFee.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        </div>
      </div>
    </div>
  );
}
