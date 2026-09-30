# ReportsAnalytics API Reference

Base URL used in the checked-in source docs:
- `http://localhost:5246`

## Service Operations Analytics

### Dashboard statistics
- `GET /api/Application/dashboard/statistics`
- Includes `statusStats`, `emirateStats`, `trendStats`, `deviceStats`, `categoryStats`, `typeStats`, and `revenueTrendList`.

### Service Performance table
- `GET /api/Application/dashboard/service/list`
- Query params: `days`, `keyword`, `option`, `pageIndex`, `pageSize`, `orderby`, `sort`
- `option`: `AllServices`, `AllCategories`
- `orderby`: `Applications`, `TotalRevenue`, `ApprovalRate`, `AvgProcessingTime`, `AvgSatisfaction`, `RefundApplications`, `TotalRefunds`, `RefundRate`

### Service Performance export
- `GET /api/Application/dashboard/service/list/export`
- Query params: `days`, `keyword`, `option`, `orderby`, `sort`

### Team Performance table
- `GET /api/Application/dashboard/team/list`
- Query params: `days`, `keyword`, `pageIndex`, `pageSize`, `orderby`, `sort`
- `orderby`: `ApplicationTasks`, `ApprovedApplications`, `RejectedApplications`, `ApprovalRate`, `AvgProcessingTime`, `SLA`
- Response includes `avgSLACompliance`, `avgProcessingTime`, `avgApprovalRate`, and nested `page`

### Team Performance export
- `GET /api/Application/dashboard/team/list/export`
- Query params: `days`, `keyword`, `pageIndex`, `pageSize`, `orderby`, `sort`

## Profile Analytics

### Dashboard statistics
- `GET /api/UserManagement/dashboard/profile/statistics`
- Query params: `days`

### Bottom table
- `GET /api/UserManagement/dashboard/list`
- Query params: `days`, `keyword`, `pageIndex`, `pageSize`, `orderby`, `sort`
- `orderby`: `applicationtasks`, `approvedapplications`, `rejectedapplications`, `approvalrate`

### Export
- `GET /api/UserManagement/dashboard/list/export`
- Query params: `days`, `keyword`, `pageIndex`, `pageSize`

## License Analytics

### Dashboard statistics
- `GET /api/LicenseManagement/dashboard/statistics`
- Query params: `days`
- License trend types in the latest docs also include `Press Card License` and `Marine Photography Permit`.
- License user-type docs also include `Establishment`.

### Bottom table
- `GET /api/LicenseManagement/dashboard/report`
- Query params: `days`, `keyword`, `pageIndex`, `pageSize`, `orderby`, `sort`
- `orderby`: `issued`, `active`, `expiringsoon`, `expired`

### Export
- `GET /api/LicenseManagement/dashboard/report/export`
- Query params: `days`, `keyword`
