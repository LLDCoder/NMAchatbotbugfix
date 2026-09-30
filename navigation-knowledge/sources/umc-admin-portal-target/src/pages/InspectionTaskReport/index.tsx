import React, { useCallback, useEffect, useState } from 'react';
import { Spin } from 'antd';
import { useHistory, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CustomMessage } from '@/components/common';
import { buildInspectionPath } from '../InspectionCommon/helpers';
import { INSPECTION_PATHS, INSPECTION_QUERY_KEYS } from '../InspectionCommon/constants';
import { downloadInspectionTaskReportPdf } from '../InspectionCommon/reportDownload';
import './index.less';

const InspectionTaskReportPage: React.FC = () => {
  const history = useHistory();
  const location = useLocation();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);

  const params = new URLSearchParams(location.search);
  const taskId = params.get('taskId') || '';
  const taskNo = params.get('taskNo') || '';
  const reportNo = params.get('reportNo') || '';

  const returnToTaskDetail = useCallback(() => {
    history.replace(buildInspectionPath(INSPECTION_PATHS.taskDetail, location.search, {
      [INSPECTION_QUERY_KEYS.mode]: null,
      taskId,
      taskNo,
      reportNo: null,
    }));
  }, [history, location.search, taskId, taskNo]);

  useEffect(() => {
    let cancelled = false;

    const runDownload = async () => {
      if (!taskId && !taskNo && !reportNo) {
        CustomMessage.warning(t('inspection.taskDetail.reportDownloadUnavailable'));
        returnToTaskDetail();
        return;
      }

      setLoading(true);
      try {
        const downloaded = await downloadInspectionTaskReportPdf({
          taskId,
          taskNo,
          reportId: reportNo,
          reportNo,
        });
        if (!downloaded) {
          CustomMessage.warning(t('inspection.taskDetail.reportDownloadUnavailable'));
        }
      } catch {
        CustomMessage.warning(t('inspection.taskDetail.reportDownloadFailed'));
      } finally {
        if (!cancelled) {
          setLoading(false);
          returnToTaskDetail();
        }
      }
    };

    void runDownload();

    return () => {
      cancelled = true;
    };
  }, [reportNo, returnToTaskDetail, t, taskId, taskNo]);

  return (
    <div className="inspection-task-report inspection-task-report--download">
      <Spin spinning={loading} tip={t('inspection.common.loading')} />
    </div>
  );
};

export default InspectionTaskReportPage;
