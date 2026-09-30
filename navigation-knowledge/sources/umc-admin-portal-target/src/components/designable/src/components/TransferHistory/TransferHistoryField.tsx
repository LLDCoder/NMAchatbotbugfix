/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react";
import { observer, useField } from "@formily/react";
import { Table, Card as AntdCard, Pagination } from "antd";
import { useTranslation } from "react-i18next";
import EmptyBox from "../../../../common/EmptyBox/EmptyBox";
import {
  mapDesignerLanguageToContentLang,
  useFormContentLang,
  useFormLanguageHost,
} from "@/components/designable/playground/FormPreviewLangContext";
import i18n from "@/localization/config";
import "./styles.less";

type TransferRecord = {
  id: string;
  no: number;
  previousHolder: string;
  newHolder: string;
  effectiveDate: string;
  applicationNo: string;
};

const MOCK_TRANSFER_HISTORY: TransferRecord[] = [
  {
    id: "1",
    no: 3,
    previousHolder: "Emirates Media Group LLC",
    newHolder: "Gulf Broadcasting Corp.",
    effectiveDate: "15/03/2025",
    applicationNo: "ML-2025-0034",
  },
  {
    id: "2",
    no: 2,
    previousHolder: "Dubai Broadcasting Corp.",
    newHolder: "Emirates Media Group LLC",
    effectiveDate: "11/01/2025",
    applicationNo: "ML-2025-0001",
  },
  {
    id: "3",
    no: 1,
    previousHolder: "Arabian Media House",
    newHolder: "Dubai Broadcasting Corp.",
    effectiveDate: "20/06/2024",
    applicationNo: "ML-2024-0198",
  },
];

const PAGE_SIZE = 6;

export const TransferHistoryField: React.FC<any> = observer((props) => {
  const field = useField<any>();
  const host = useFormLanguageHost();
  const contentLang = useFormContentLang();
  const { i18n: i18nReact } = useTranslation();
  const [currentPage, setCurrentPage] = React.useState(1);
  const previewLang =
    host === "designer"
      ? contentLang
      : mapDesignerLanguageToContentLang(i18nReact.language);
  const tf = React.useCallback(
    (key: string) =>
      String(
        i18n.t(`TransferHistory.${key}`, {
          lng: previewLang,
        })
      ),
    [previewLang]
  );

  const records: TransferRecord[] = field.value ?? MOCK_TRANSFER_HISTORY;

  const columns = React.useMemo(
    () => [
      {
        title: tf("columnNo"),
        dataIndex: "no",
        key: "no",
        width: 80,
      },
      {
        title: tf("columnPreviousHolder"),
        dataIndex: "previousHolder",
        key: "previousHolder",
      },
      {
        title: tf("columnNewHolder"),
        dataIndex: "newHolder",
        key: "newHolder",
      },
      {
        title: tf("columnEffectiveDate"),
        dataIndex: "effectiveDate",
        key: "effectiveDate",
        width: 150,
      },
      {
        title: tf("columnApplicationNo"),
        dataIndex: "applicationNo",
        key: "applicationNo",
        width: 180,
      },
    ],
    [tf]
  );

  const sorted = React.useMemo(
    () => [...records].sort((a, b) => b.no - a.no),
    [records]
  );

  const paged = React.useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return sorted.slice(start, start + PAGE_SIZE);
  }, [sorted, currentPage]);

  return (
    <div className="transfer-history-container" {...props}>
      <AntdCard className="transfer-history-card" title={tf("defaultCardTitle")}>
        <Table
          className="transfer-history-table"
          dataSource={paged}
          columns={columns}
          rowKey="id"
          pagination={false}
          locale={{
            emptyText: (
              <EmptyBox
                title={tf("emptyDescription")}
                customClassName="transfer-history-empty"
              />
            ),
          }}
        />
        {sorted.length > PAGE_SIZE && (
          <div className="transfer-history-pagination">
            <Pagination
              current={currentPage}
              total={sorted.length}
              pageSize={PAGE_SIZE}
              onChange={setCurrentPage}
              showSizeChanger={false}
            />
          </div>
        )}
      </AntdCard>
    </div>
  );
});

TransferHistoryField.displayName = "TransferHistoryField";

export default TransferHistoryField;
