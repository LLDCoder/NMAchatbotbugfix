/* eslint-disable react-refresh/only-export-components */
export const Status = {
  QUEUED: 'Queued',
  PENDING_VISIT: 'Pending Visit',
  IN_PROGRESS: 'In Progress',
  ACCESS_FAILED: 'Access Failed',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  PENDING_MODIFICATION: 'Pending Modification',
} as const;

export const Priority = {
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
} as const;

export const tableColumns = [
  {
    title: 'Task no.',
    dataIndex: 'taskNo',
    key: 'taskNo',
  },
  {
    title: 'Inspection Target',
    dataIndex: 'inspectionTarget',
    key: 'inspectionTarget',
  },
  {
    title: 'Inspection Reason',
    dataIndex: 'inspectionReason',
    key: 'inspectionReason',
  },
  {
    title: 'Priority',
    dataIndex: 'priority',
    key: 'priority',
    render: (priority: keyof typeof Priority) => (
      <span className={`priority-${String(priority).toLowerCase()} _table-row-text`}>
        {Priority[priority] || '-'}
      </span>
    ),
  },
  {
    title: 'Due Date',
    dataIndex: 'dueDate',
    key: 'dueDate',
  },
  {
    title: 'SLA',
    dataIndex: 'sla',
    key: 'sla',
  },
  {
    title: 'Status',
    dataIndex: 'status',
    key: 'status',
    render: (status: keyof typeof Status) => (
      <span className={`status-${String(status).toLowerCase()} _table-row-text`}>
        {Status[status] || '-'}
      </span>
    ),
  },
  {
    title: 'Emirate',
    dataIndex: 'emirate',
    key: 'emirate',
  },
  {
    title: 'Inspector',
    dataIndex: 'inspector',
    key: 'inspector',
  },
  {
    title: 'Authority',
    dataIndex: 'authority',
    key: 'authority',
  },
  {
    title: 'Inspection Method',
    dataIndex: 'inspectionMethod',
    key: 'inspectionMethod',
  },
  {
    title: 'Created By',
    dataIndex: 'createdBy',
    key: 'createdBy',
  },
  {
    title: 'Creation Time',
    dataIndex: 'creationTime',
    key: 'creationTime',
  },
  {
    title: 'Action',
    dataIndex: 'action',
    key: 'action',
  },
];
