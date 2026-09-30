# Licensing / My Application Tasks 页面说明

页面：`/licensing/applications`；组件：`Applications`；门户：Admin。

本说明描述页面及其数据含义，不包含问答模板、用例编号或实时业务数量。内容依据已检查的前后端源码与页面目录；目标服务器的部署版本尚未与源码核实，当前为知识草案。

## 1. 页面用途与访问范围

页面用于查看当前登录人员的许可申请工作，包括待办与已完成两个视图。它与团队任务页面、已签发许可证存量页面是不同数据范围。入口需要登录及页面权限；列表接口另外检查对应读取权限，具体可见记录以当前账号和服务端授权为准。Manager 等角色名称本身不能把此页面解释为团队范围。

## 2. 视图与页面区域

| 视图 | Tab 标识 | 数据范围与源端投影 |
| --- | --- | --- |
| To Do | 1，默认 | 当前个人未完成工作；源码先排除已完成、被替代流程实例，再按申请 ID 与处置案例 ID 的组合选取记录 |
| Completed | 2 | 当前个人已完成工作；源码按申请 ID 选取记录，另提供本人审批决定 |

切换 Tab 会重置页码、列表和筛选表单。卡片区读取 `statusCount`，列表区读取 `page.items`，分页总数读取 `page.total`。

## 3. 实体与标识

| 字段 | 含义 |
| --- | --- |
| id | 申请标识；申请层面的实体键 |
| applicationNumber | 对用户显示的申请编号 |
| taskId | 工作流任务标识，也是进入任务详情的参数 |
| dispositionCaseId | 处置案例标识，可为空；是个人待办投影键的一部分 |
| processInstanceId | 当前行关联的工作流实例 |
| oldProcessInstanceId | 历史 DTO 命名；源码实际将其解释为当前 canonical 实例，不能只根据字段名理解为旧实例 |

个人待办源码按 `(id, dispositionCaseId)` 形成列表；已完成源码按 `id` 形成列表。同一申请与多个处置案例、任务或流程实例的关系不能由某次列表没有重复来推定为一对一。

## 4. 列表字段

| 页面标签或字段 | 绑定字段 | 语义 |
| --- | --- | --- |
| Application No. | applicationNumber | 申请编号 |
| Service Name | serviceNameEn | 服务显示名；服务端可能按语言映射 |
| Service Category | serviceCategoryNameEn | 服务类别 |
| Type | serviceTypeNameEn | 业务类型 |
| Status | status | 申请/流程状态；与任务节点状态是不同维度 |
| taskStatus（待办响应） | taskStatus | 工作流任务/节点状态 |
| My Decision（已完成） | taskStatus | 当前前端读取的兼容字段；后端在个人已完成响应中把任务字段映射成本人的审批决定 |
| myDecision | myDecision | 已完成视图的审批决定语义字段；缺失时页面显示横线 |
| SLA | slaDescription / sla | 展示 SLA；已完成列使用数值符号区分 On Time 与 Exceeded。具体时钟、暂停与期限规则待另行核实 |
| Submission Time | lastUpdatedTime | 当前列标签与实际字段不一致；源码绑定的是更新时间，不是独立的 submissionTime 字段 |

状态选项来自响应中的 `processInstanceStatus`；审批决定选项来自 `myDecisionOptions`。分类值随数据和语言变化，页面说明不固定一份状态全集。

## 5. 卡片统计口径

| 卡片 | 字段 | 已检查的源码定义 |
| --- | --- | --- |
| To Do | statusCount.todoCount | 个人待办投影的总行数，属于总数 |
| Pending Review | statusCount.pendingReviewCount | 待办投影中排除 PendingModification、ExternalApproval 的记录；是较粗分类 |
| Pending Modification | statusCount.pendingModificationCount | 指定补件状态的待办投影行数 |
| External Approval | statusCount.externalApproveCount | 指定外部审批状态的待办投影行数 |
| Pending Disposition | statusCount.pendingDispositionCount | 指定处置待处理状态的待办投影行数 |
| Disposition Verification | statusCount.dispositionVerificationCount | 指定处置核验状态的待办投影行数 |
| Completed | statusCount.completedCount | 已完成投影的总行数，属于另一生命周期总体 |

卡片在列表筛选之前计算；`page.total` 是所选视图经过筛选后的总行数。卡片分类与列表 Status 列不是相同维度，Pending Review 还可能包含处置类记录，因此整组卡片未被定义为互斥分组。任务投影行数也不是无条件等于去重申请数。

## 6. 筛选、排序与分页

搜索使用 keyword，源码匹配申请编号、服务名和 Apply For 名称；类型筛选使用 serviceTypeId，其中字符串 `1` 表示所有类型，并不是许可部门编号。Status 筛选以 processInstanceStatus 与行 status 精确匹配；Completed 的 My Decision 使用 approvalStatus 与本人决定匹配。

日期控件显示提交时间，但已检查的后端对 lastUpdatedTime 筛选：开始日期含当天，结束边界为所选结束日次日零点之前。后端时区尚未确认，不能仅凭控件标签或浏览器时区解释其口径。

页面默认从第 1 页开始，每页 10 条，默认按 LastUpdatedTime 降序。分页参数是 pageIndex/pageSize；响应包含页码、页大小、total 和 items。当前页条数、筛选总数、卡片总数是不同概念。服务端支持的最大页大小和一致性快照能力尚未核实。

## 7. 操作与跳转

| 操作 | 页面/接口说明 |
| --- | --- |
| 待办查询 | POST /api/Application/MyTodoPage；源码权限符号 Workflow.MyTodo.View |
| 已完成查询 | POST /api/Application/MyComplatedPage；接口名沿用已有拼写；源码权限符号 Workflow.MyCompleted.View |
| 进入详情 | /licensing/applications/applicationsDetails，参数 taskId 与 activeTab |
| 筛选、重置、排序、翻页 | 改变当前列表视图，需要保持同一登录身份与权限 |
| 导出 | 独立 Export 权限；具有筛选兼容处理，目标版本仍需核验 |
| 审批、驳回、补件、退回、外部审批、撤回 | 业务写操作，不属于只读采集 |

这里列出操作用于描述页面能力，不提供执行授权。只读工具仍需使用当前用户和受信任策略验证每次操作。

## 8. 读取状态与待核实内容

成功响应、已结束的加载状态以及明确空列表，才能支撑数据解释。加载失败、权限拒绝、未返回字段、截断或默认零值不能解释为业务数量为零。

待核实项见 [待核实项.json](待核实项.json)，包括部署版本、实体投影、时间字段、分页一致性、语言映射和操作验证记录。[page.json](page.json) 提供同页结构化定义，不包含特定问题匹配规则或预设回答步骤。

## 9. 来源

- [frontend](../../../../../sources/umc-admin-portal-target/src/pages/Applications/index.tsx)，定位 234; 701-880; 932-1105; 1231-1285; 1528-1660。
- [services](../../../../../sources/umc-admin-portal-target/src/services/application.ts)，定位 326-353。
- [backend](../../../../../sources/adminportalservice/UMC.AdminPortal.Application/Services/ApplicationApp/ApplicationAppService.cs)，定位 216-319。
- [projection](../../../../../sources/adminportalservice/UMC.AdminPortal.Application/Services/ApplicationApp/ReviewTaskProjection.cs)，定位 11-51; 88-106。
- [filters](../../../../../sources/adminportalservice/UMC.AdminPortal.Application/Services/ApplicationApp/MyReviewFilter.cs)，定位 22-99。
- [dto](../../../../../sources/adminportalservice/UMC.AdminPortal.Application/Dtos/Application/ApplicationDto.cs)，定位 12-157。
- [controller](../../../../../sources/adminportalservice/UMC.AdminPortal.Api/Controllers/ApplicationController.cs)，定位 30-57。
- [catalog](../../../../../artifacts/page-catalog.json)，定位 Applications。
