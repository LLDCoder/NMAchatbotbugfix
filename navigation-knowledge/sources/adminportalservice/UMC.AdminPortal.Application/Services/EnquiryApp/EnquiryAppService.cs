using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Linq;
using System.Linq.Expressions;
using System.Text;
using AutoMapper;
using MC.AdminPortal.Domain.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Minio.DataModel;
using NanoidDotNet;
using NPOI.SS.Formula.Functions;
using UMC.AdminPortal.Application.Dtos;
using UMC.AdminPortal.Application.Dtos.Application;
using UMC.AdminPortal.Application.Dtos.PermissionDto;
using UMC.AdminPortal.Application.Dtos.TeamManagement;
using UMC.AdminPortal.Application.Dtos.UserDto;
using UMC.AdminPortal.Application.Services.SendTemplate;
using UMC.AdminPortal.Application.Services.CustomerPortalInternalApi;
using UMC.AdminPortal.Domain.Models;
using UMC.AdminPortal.Domain.Models.Application;
using UMC.AdminPortal.Domain.Models.Inspection;
using UMC.AdminPortal.Domain.Models.Lookup;
using UMC.AdminPortal.Domain.Models.Workflow;
using UMC.AdminPortal.Domain.Service;
using UMC.AdminPortal.Domain.Service.Application;
using UMC.AdminPortal.Domain.Service.UserInfo;
using UMC.AdminPortal.Domain.Share;
using UMC.AdminPortal.Domain.Shares;
using UMC.AdminPortal.Domain.Shares.Enums;
using UMC.AdminPortal.Domain.Shares.Enums.TypeDics;
using UMC.AdminPortal.Infrastructure;
using UMC.AdminPortal.Infrastructure.Models;
using UMC.AdminPortal.Infrastructure.Repositorys;
using UMC.CustomerPortal.Domain.Service;
using UMC.CustomerPortal.Domain.Service.EnquiryInfo;
using UMC.Utils.Framework.GlobalException;
using UMC.Utils.Framework.Helps;
using UMC.Utils.Framework.Module.Attributes;
using UMC.Utils.Framework.Page;
using UMC.Utils.Framework.RestSharpClient;
using static Microsoft.EntityFrameworkCore.DbLoggerCategory;
using static UMC.AdminPortal.Domain.Shares.Enums.EnquiryEnum;


namespace UMC.AdminPortal.Application.Services.EnquiryApp
{
    [InjectOnScoped]
    public class EnquiryAppService(IEnquiryDomainService domainEnq, ICurrentUserService _currentDomain, IMapper mapper, IUnitOfWork unit, IQueryableContext _queryable
        , RestSharpClient _restClient, IConfiguration _conf, IUserDomainService iUser, IHttpClientFactory _httpClientFactory, IBaseRepository<Enquiry> _enquirydb, IBaseRepository<Department> _dep, IBaseRepository<UserProfile> _pro, IBaseRepository<AdminUser> _adminUser,
        IHttpContextAccessor _httpContextAccessor, IServiceScopeFactory _serviceScopeFactory, ILogger<EnquiryAppService> _logger, IHostEnvironment _hostEnvironment, IEnquiryNotificationQueue _enquiryNotificationQueue, IApplicationService _appService, AdminPortalDBContext _dbContext) : IEnquiryAppService
    {
        /// <summary>
        /// Snapshot for a single SignalR template invocation executed outside the request thread.
        /// </summary>
        private sealed record EnquiryTemplateSendRequest(string TemplateNumber, string UserId, int? ProfileId, List<TemplateVariable> Variables, string? Email = "");

        /// <summary>
        /// The customer a CP-038 ticket notification belongs to, resolved from the ticket itself.
        /// </summary>
        private sealed record EnquiryCustomerRecipient(string UserId, int? ProfileId, string? Email, string? UserName);
        private const string SupportEmail = "info@nma.gov.ae";
        internal const string TaskReassignedTrackingReason = "TaskReassigned";

        internal static string BuildAdminTicketLink(string? adminPortalUrl, int enquiryId)
            => $"{adminPortalUrl?.TrimEnd('/')}/happiness/tickets/tickets-details?id={enquiryId}";

        internal static bool ShouldApplyTransferEnquiryTypeChange(short targetStatusId, short? enquiryTypeId)
            => enquiryTypeId.HasValue && targetStatusId != (short)EnquiryAdminStatus.DepartmentProcessing;

        internal static string ResolveTicketTypeName(IEnumerable<TypeDictionary> types, string scope, short enquiryTypeId)
            => types.FirstOrDefault(t =>
                t.Scope == scope &&
                short.TryParse(t.Code, out var code) &&
                code == enquiryTypeId)?.NameEn ?? string.Empty;

        internal static string ResolveAssignUserTemplateNumber(short statusId)
            => statusId == (short)EnquiryAdminStatus.DepartmentProcessing ? "AP-022" : "AP-021";

        internal static IQueryable<int> GetReopenedEnquiryIdsQuery(IQueryable<EnquiryStatusTracking> statusTrackingQuery)
            => statusTrackingQuery
                .Where(x => x.FromStatusId == (int)EnquiryAdminStatus.Resolved
                    && x.ToStatusId < (int)EnquiryAdminStatus.Resolved)
                .Select(x => x.EnquiryId)
                .Distinct();

        /// <summary>
        /// Display name for notification template variables: full name, falling back to the login
        /// account and then the email, so a person is never rendered as a lone separator space.
        /// Prefers the account over the email (unlike <c>AdminUserLoginService.BuildStaffDisplayName</c>,
        /// which is email-first) because these variables appear in ticket text read by colleagues.
        /// </summary>
        internal static string ResolveAdminDisplayName(AdminUser? user)
        {
            if (user == null) return string.Empty;

            var fullName = string.Join(" ", new[] { user.FirstName, user.LastName }
                .Where(part => !string.IsNullOrWhiteSpace(part)));

            if (!string.IsNullOrWhiteSpace(fullName)) return fullName;

            return !string.IsNullOrWhiteSpace(user.UserName)
                ? user.UserName
                : user.Email ?? string.Empty;
        }

        /// <summary>
        /// Resolves AP-022's <c>original_handler</c> variable. The template reads
        /// "Ticket {{ticket_number}} transferred to you by {{original_handler}}", so the value is the
        /// ACTOR who performed the transfer — not the ticket's previous handler. The two differ
        /// whenever a Happiness Center leader transfers on behalf of the assigned handler
        /// (see <see cref="EnsureCanChangeStatusAsync"/>, which permits both).
        /// Falls back to the previous handler when there is no actor in context (automated or
        /// system-triggered transfers), so the sentence never renders with an empty name.
        /// </summary>
        internal static string ResolveTransferredByName(AdminUser? actor, AdminUser? previousHandler)
        {
            var actorName = ResolveAdminDisplayName(actor);

            return !string.IsNullOrWhiteSpace(actorName)
                ? actorName
                : ResolveAdminDisplayName(previousHandler);
        }

        internal static EnquiryStatusTracking BuildReassignmentTracking(
            Enquiry enquiry,
            string? actorUserId,
            string? handlerUserId,
            DateTime changedOn)
            => new()
            {
                EnquiryId = enquiry.Id,
                FromStatusId = enquiry.EnquiryStatusId,
                ToStatusId = enquiry.EnquiryStatusId,
                Reason = TaskReassignedTrackingReason,
                CreatedBy = actorUserId,
                HandlerUserId = handlerUserId,
                DepartmentId = enquiry.DepartmentId,
                CreatedOn = changedOn
            };

        internal static string BuildReassignmentTimelineDescription(string? actorName, string? handlerName)
        {
            var target = string.IsNullOrWhiteSpace(handlerName) ? "the selected handler" : handlerName;
            return string.IsNullOrWhiteSpace(actorName)
                ? $"Ticket reassigned to {target}"
                : $"{actorName} reassigned the ticket to {target}";
        }

        internal static bool HasHandlerChanged(string? currentHandlerUserId, string? requestedHandlerUserId)
            => !string.Equals(currentHandlerUserId, requestedHandlerUserId, StringComparison.OrdinalIgnoreCase);

        private static string ResolveAdminPortalUrl(IConfiguration configuration)
            => configuration["TemplateServices:AdminPortal"] ?? configuration["TemplateServices:AdminProtal"] ?? string.Empty;

        private void TrySyncEnquiryToAdminPortal(int enquiryId)
        {
            Task.Run(async () =>
            {
                try
                {
                    var adminPortalBaseUrl = _conf.GetSection("Services:AdminProtal").Value;
                    if (string.IsNullOrEmpty(adminPortalBaseUrl)) return;
                    var client = _httpClientFactory.CreateClient();
                    await client.PostAsync($"{adminPortalBaseUrl}/api/Webhook/syncenquiry/{enquiryId}", null);
                }
                catch
                {
                    // Ignore errors so the original request is not affected
                }
            });
        }

        /// <summary>
        /// Runs post-save enquiry notifications with a fresh DI scope.
        /// Production: enqueue to <see cref="EnquiryNotificationQueue"/> (HostedService), not Task.Run —
        /// work survives HTTP response completion because it lives in the app process queue.
        /// Local debug: executes inline when Development / debugger attached / RunNotificationsSynchronously=true.
        /// </summary>
        private async Task RunEnquiryNotificationInBackground(Func<IServiceProvider, Task> notificationWork)
        {
            if (ShouldRunEnquiryNotificationSynchronouslyForDebugging())
            {
                try
                {
                    _logger.LogDebug("Running enquiry notification synchronously for debugging.");
                    using var scope = _serviceScopeFactory.CreateScope();
                    await notificationWork(scope.ServiceProvider);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Enquiry template notification failed during synchronous debug execution.");
                    throw;
                }

                return;
            }

            // Enqueue only waits for the item to enter the in-process channel, not for SignalR HTTP to finish.
            await _enquiryNotificationQueue.EnqueueAsync(notificationWork);
            _logger.LogDebug("Enquiry notification submitted to background queue; HTTP response may return now.");
        }

        /// <summary>
        /// When true, notifications run on the request thread (breakpoints work, queue is bypassed).
        /// Set TemplateServices:RunNotificationsSynchronously=false in Development to test the production queue path.
        /// </summary>
        private bool ShouldRunEnquiryNotificationSynchronouslyForDebugging() =>
            _conf.GetValue("TemplateServices:RunNotificationsSynchronously", false)
            || Debugger.IsAttached
            || (_hostEnvironment.IsDevelopment() && _conf.GetValue("TemplateServices:UseNotificationQueueInDevelopment", false) == false);

        private static List<TemplateVariable> CloneTemplateVariables(IEnumerable<TemplateVariable> variables) =>
            variables.Select(v => new TemplateVariable { Key = v.Key, Value = v.Value ?? string.Empty }).ToList();

        private Task SendEnquiryTemplatesAsync(
            ISendTemplateService sendTemplateService,
            IQueryableContext queryableContext,
            params EnquiryTemplateSendRequest[] sends) =>
            SendEnquiryTemplatesCoreAsync(sendTemplateService, queryableContext, sends);

        private async Task SendEnquiryTemplatesCoreAsync(
            ISendTemplateService sendTemplateService,
            IQueryableContext queryableContext,
            IReadOnlyList<EnquiryTemplateSendRequest> sends)
        {
            if (sends == null || sends.Count == 0)
            {
                _logger.LogWarning("Enquiry template send skipped: no templates matched the current status transition.");
                return;
            }

            var templateNumbers = string.Join(", ", sends.Select(s => s.TemplateNumber));
            _logger.LogInformation(
                "Sending {TemplateCount} enquiry templates via SignalR: {TemplateNumbers}",
                sends.Count,
                templateNumbers);

            var resolvedSends = await ResolveEnquiryTemplateRecipientEmailsAsync(queryableContext, sends);
            var successCount = 0;
            for (var index = 0; index < resolvedSends.Count; index++)
            {
                var send = resolvedSends[index];
                try
                {
                    // CP templates with a real business Profile may include that Profile's Work Email.
                    // Staff/AP and profile-less notifications continue through the unchanged legacy method.
                    var sent = send.TemplateNumber.StartsWith("CP", StringComparison.OrdinalIgnoreCase)
                               && send.ProfileId is > 0
                        ? await sendTemplateService.GetSendTemplateForEstablishmentProfile(
                            send.TemplateNumber,
                            send.UserId,
                            send.ProfileId.Value,
                            CloneTemplateVariables(send.Variables),
                            send.Email)
                        : await sendTemplateService.GetSendTemplate(
                            send.TemplateNumber,
                            send.UserId,
                            send.ProfileId,
                            CloneTemplateVariables(send.Variables),
                            send.Email);

                    if (sent)
                    {
                        successCount++;
                    }

                    _logger.LogInformation(
                        "Enquiry template {Index}/{Total} {TemplateNumber} for user {UserId} completed with result {Sent}.",
                        index + 1,
                        sends.Count,
                        send.TemplateNumber,
                        send.UserId,
                        sent);
                }
                catch (Exception ex)
                {
                    _logger.LogError(
                        ex,
                        "Enquiry template {Index}/{Total} {TemplateNumber} for user {UserId} threw before completion.",
                        index + 1,
                        sends.Count,
                        send.TemplateNumber,
                        send.UserId);
                }
            }

            if (successCount < sends.Count)
            {
                _logger.LogWarning(
                    "Enquiry template batch finished with {SuccessCount}/{TotalCount} successful sends ({TemplateNumbers}).",
                    successCount,
                    sends.Count,
                    templateNumbers);
            }
        }

        private static bool IsCustomerTemplate(string? templateNumber) =>
            templateNumber?.StartsWith("CP", StringComparison.OrdinalIgnoreCase) == true;

        private static bool IsAdminTemplate(string? templateNumber) =>
            templateNumber?.StartsWith("AP", StringComparison.OrdinalIgnoreCase) == true;

        private async Task<IReadOnlyList<EnquiryTemplateSendRequest>> ResolveEnquiryTemplateRecipientEmailsAsync(
            IQueryableContext queryableContext,
            IReadOnlyList<EnquiryTemplateSendRequest> sends)
        {
            var userIds = sends
                .Where(send => !string.IsNullOrWhiteSpace(send.UserId))
                .Select(send => send.UserId.Trim())
                .Distinct()
                .ToList();

            var customerEmails = userIds.Count == 0
                ? new Dictionary<string, string?>()
                : await queryableContext.GetQueryable<User>()
                    .AsNoTracking()
                    .Where(user => userIds.Contains(user.Id))
                    .Select(user => new { user.Id, user.Email })
                    .ToDictionaryAsync(user => user.Id, user => user.Email);

            var adminEmails = userIds.Count == 0
                ? new Dictionary<string, string?>()
                : await queryableContext.GetQueryable<AdminUser>()
                    .AsNoTracking()
                    .Where(user => userIds.Contains(user.Id))
                    .Select(user => new { user.Id, user.Email })
                    .ToDictionaryAsync(user => user.Id, user => user.Email);

            return sends
                .Select(send =>
                {
                    var userId = send.UserId?.Trim();
                    var resolvedEmail = send.Email;

                    if (!string.IsNullOrWhiteSpace(userId))
                    {
                        customerEmails.TryGetValue(userId, out var customerEmail);
                        adminEmails.TryGetValue(userId, out var adminEmail);

                        if (IsCustomerTemplate(send.TemplateNumber))
                        {
                            resolvedEmail = !string.IsNullOrWhiteSpace(customerEmail)
                                ? customerEmail
                                : adminEmail;
                        }
                        else if (IsAdminTemplate(send.TemplateNumber))
                        {
                            resolvedEmail = !string.IsNullOrWhiteSpace(adminEmail)
                                ? adminEmail
                                : customerEmail;
                        }
                        else
                        {
                            resolvedEmail = !string.IsNullOrWhiteSpace(adminEmail)
                                ? adminEmail
                                : customerEmail;
                        }
                    }

                    return send with { Email = resolvedEmail?.Trim() ?? string.Empty };
                })
                .ToList();
        }




        public async Task<List<EnquiryApplicaitonDto>> GetEnquirApplicationsAsync(string? applicatinNo, int? size = 100)
        {

            //int[] appStatusIds = new int[] { (short)ApplicationStatusesEnum.Cancelled, (short)ApplicationStatusesEnum.Completed };

            var apps = from app in _queryable.GetQueryable<ApplicationModel>()
                       join det in _queryable.GetQueryable<ApplicationDetailModel>() on app.Id equals det.ApplicationId
                       where det.ApplicationStatusId != (short)ApplicationStatusesEnum.Draft
                       select new EnquiryApplicaitonDto(det.Id, app.Id, app.ServiceId, app.ApplicationNumber);
            if (!string.IsNullOrWhiteSpace(applicatinNo))
            {
                apps = from app in _queryable.GetQueryable<ApplicationModel>()
                       join det in _queryable.GetQueryable<ApplicationDetailModel>() on app.Id equals det.ApplicationId
                       where det.ApplicationStatusId != (short)ApplicationStatusesEnum.Draft && app.ApplicationNumber.Contains(applicatinNo)
                       select new EnquiryApplicaitonDto(det.Id, app.Id, app.ServiceId, app.ApplicationNumber);
            }

            return await apps.AsNoTracking().Take(size ?? 0).ToListAsync();

        }


        public async Task<EnquiryResponseValueObjDto?> GetEnquiryByIdAsync(int id)
        {
            var enquiry = await domainEnq.GetEnquiryByIdAsync(id);

            if (enquiry != null)
            {
                var _enquiryStatusId = enquiry.EnquiryStatusId < (short)EnquiryAdminStatus.Resolved ? (short)EnquiryStatus.UnderProcessing : enquiry.EnquiryStatusId;

                var typeObj = new EnquiryTypeDto();
                var types = await domainEnq.GetEnquiryTypesAsync(typeObj.EnquiryType, typeObj.EnquirySource, typeObj.EnquiryStatus, typeObj.EnquiryAdminStatus, typeObj.EnquiryPlatform);
                var enquiryType = types.FirstOrDefault(t => t.Scope == typeObj.EnquiryType && Convert.ToInt16(t.Code) == enquiry.EnquiryTypeId);
                var enquirySource = types.FirstOrDefault(t => t.Scope == typeObj.EnquirySource && Convert.ToInt16(t.Code) == enquiry.EnquirySourceId);
                var enquiryStatus = types.FirstOrDefault(t => t.Scope == typeObj.EnquiryStatus && Convert.ToInt16(t.Code) == _enquiryStatusId);
                var EnquiryIssueCategorys = types.FirstOrDefault(t => t.Scope == typeObj.EnquiryIssueCategory && Convert.ToInt16(t.Code) == enquiry.IssueCategoryId);
                var services = await domainEnq.GetServiceConfigsAsync();


                var queryConversation = from con in _queryable.GetQueryable<EnquiryConversation>()
                                        from up in _queryable.GetQueryable<UserProfile>().Where(w => w.Id == con.UserProfileId).DefaultIfEmpty()
                                        from person in _queryable.GetQueryable<Person>().Where(w => w.Id == up.PersonId).DefaultIfEmpty()
                                        from um in _queryable.GetQueryable<UserEstablishment>().Where(w => w.UserProfileId == con.UserProfileId).DefaultIfEmpty()
                                        from e in _queryable.GetQueryable<Establishment>().Where(w => w.Id == um.EstablishmentId).DefaultIfEmpty()
                                        from adminUser in _queryable.GetQueryable<AdminUser>().Where(w => w.Id == con.CreatedBy).DefaultIfEmpty()

                                        where con.EnquiryId == id
                                        orderby con.CreatedOn ascending
                                        select new
                                        {
                                            con.MessageContent,
                                            con.AttachmentUrl1,
                                            con.AttachmentUrl2,
                                            con.AttachmentUrl3, //(new string[] { con.AttachmentUrl1 , con.AttachmentUrl2 ?? "", con.AttachmentUrl3 ?? "" }).Where(x => !string.IsNullOrEmpty(x)).ToArray(),
                                            UserName = adminUser != null ? adminUser.UserName : ((int?)up.UserTypeId == 1 ? person.Name : e.NameEn),
                                            UserTypeId = (int?)up.UserTypeId,
                                            PhotoUrl = adminUser != null ? adminUser.PersonalPhotoUrl : (string?)person.PhotoUrl,
                                            con.CreatedBy,
                                            con.CreatedOn,
                                            con.UserProfileId,
                                            con.SourceTypeId,
                                            con.CurrentDepartmentId,
                                            con.IsRead
                                        };


                var conversationDepartments = await this.GetDepartmentsAsync();
                var enquiryConversationDetails = (await queryConversation.Where(f => (f.SourceTypeId ?? (short)EnquiryConversationSource.CustomerPortal) <= (short)EnquiryConversationSource.CustomerHappness).AsNoTracking().ToListAsync())
                    .Select(s =>
                    {
                        var attachements = (new string[] { s.AttachmentUrl1, s.AttachmentUrl2, s.AttachmentUrl3 }).Where(url => !url.IsNullOrEmpty()).ToArray();

                        // This response is served to anonymous callers (ticket number + email). A Customer
                        // Happiness reply is attributed to the unit, never to the agent who typed it.
                        if ((s.SourceTypeId ?? (short)EnquiryConversationSource.CustomerPortal) == (short)EnquiryConversationSource.CustomerHappness)
                        {
                            var departmentId = (s.CurrentDepartmentId ?? 0) > 0 ? s.CurrentDepartmentId!.Value : (int)DeptEnum.HappinessCenter;
                            var department = conversationDepartments?.FirstOrDefault(d => d.Id == departmentId);
                            return new EnquiryConversationDetailDto(s.MessageContent, attachements, null, null, s.CreatedOn, null, null, false, null, s.IsRead, s.SourceTypeId, null,
                                new ValueObj(departmentId, department?.NameEn, department?.NameAr));
                        }

                        return new EnquiryConversationDetailDto(s.MessageContent, attachements, s.UserName, s.CreatedBy, s.CreatedOn, s.UserTypeId, s.UserProfileId, s.UserProfileId == _currentDomain.UserProfileId, s.PhotoUrl, s.IsRead, s.SourceTypeId);
                    }).ToList();

                // service
                var quearySvc = from enq in _queryable.GetQueryable<Enquiry>()
                                from enq2 in _queryable.GetQueryable<Enquiry>().Where(f => f.CreatedBy == enq.CreatedBy && f.ServiceId == enq.ServiceId).DefaultIfEmpty()
                                from ser in _queryable.GetQueryable<ServiceConfig>().Where(s => s.Id == enq2.ServiceId).DefaultIfEmpty()
                                where enq.Id == id && enq.ServiceId > 0 && ser.Id > 0
                                orderby enq2.CreatedOn descending
                                select new { enq2.Id, enq2.EnquiryTypeId, enq2.ApplicationDetailId, enq2.EnquiryStatusId, ServiceId = ser.Id, ser.NameEn, ser.NameAr, enq2.CreatedOn, enq2.EnquiryNumber, enq2.Description };

                var quearySrcs = await quearySvc.AsNoTracking().ToListAsync();

                var currentEnquiry = quearySvc.FirstOrDefault(f => f.Id == id);

                quearySrcs = quearySrcs.Where(w => w.Id != id && ((w.ApplicationDetailId > 0 && w.ApplicationDetailId == currentEnquiry?.ApplicationDetailId) || (w.ServiceId == currentEnquiry.ServiceId && w.EnquiryTypeId == currentEnquiry?.EnquiryTypeId))).ToList();

                var appServices = quearySrcs.Select(s =>
                {
                    var enquiryStatus = types.FirstOrDefault(t => t.Scope == typeObj.EnquiryStatus && Convert.ToInt16(t.Code) == s.EnquiryStatusId);
                    return new EnquiryServiceDto(s.Id, s.EnquiryNumber, s.EnquiryStatusId, s.CreatedOn, new ValueObj(enquiryStatus?.Id ?? 0, enquiryStatus?.NameEn, enquiryStatus?.NameAr), s.ServiceId, new ValueObj(s.ServiceId, s.NameEn, s.NameAr), s.Description);
                }).ToList() ?? new List<EnquiryServiceDto>();

                //types.FirstOrDefault(t => t.Scope == typeObj.EnquiryStatus && Convert.ToInt16(t.Code) == enquiry.EnquiryStatusId)
                // var enquiryMap = mapper.Map<Enquiry, EnquiryResponseDto>(enquiry);

                var reOpenData = (await domainEnq.GetEnquiryReOpentDataAsync(new int[] { enquiry.Id })).FirstOrDefault();
                var reOpentimes = reOpenData.ReOpenTimes;

                var trackings = (await domainEnq.GetEnquiryStatusTrackingAsync(id)).Distinct().OrderBy(s => s.CreatedOn).Take(3).ToList();

                var historys = trackings.Select(s => new EnquiryHistoryDto(trackings.IndexOf(s) + 1, s.Reason, s.CreatedOn)).OrderByDescending(o => o.number).ToList();

                List<string?> attachments = new List<string?>() { enquiry?.AttachementUrl, enquiry?.AttachementUrl2, enquiry?.AttachementUrl3 };
                attachments = attachments.Where(x => !x.IsNullOrEmpty()).ToList();

                var replyMessages = enquiryConversationDetails.Where(f => f.IsRead == false && f.SurceTypeId == (short)EnquiryConversationSource.CustomerHappness);
                if (replyMessages.Any())
                {
                    await EnquiryMessgeReadAsync(enquiry!.Id);
                }

                var applicationDic = await domainEnq.GetApplicationNoAsync(enquiry!.ApplicationDetailId ?? 0);


                var _applincationNo = (enquiry.ApplicationDetailId > 0 && applicationDic.TryGetValue(enquiry.ApplicationDetailId ?? 0, out string? applincationNo)) ? applincationNo : "";
                var userInfo = await iUser.GetUserInfo(enquiry.CreatedBy);
                var IsCustormer = userInfo == null ? 0 : 1;
                var enquiryMap = new EnquiryResponseDto(enquiry.Id, enquiry.EnquiryNumber, _applincationNo, enquiry.EnquiryTypeId, enquiry.EnquirySourceId, enquiry.ServiceId, enquiry.CreatedOn, _enquiryStatusId, enquiry.AttachementUrl, (short)reOpentimes, enquiryConversationDetails.Count, enquiry.Description, enquiry.IssueCategoryId, enquiry.UserProfileId, enquiry.CreatedBy, IsCustormer) { PlatformId = enquiry.PlatformId };
                return new EnquiryResponseValueObjDto(
                          new ValueObj(Convert.ToInt16(enquiryType?.Code ?? "0"), enquiryType?.NameEn ?? "", enquiryType?.NameAr ?? ""),
                          new ValueObj(enquiry.ServiceId ?? 0, services?.FirstOrDefault(f => f.Id == enquiry.ServiceId)?.NameEn, services?.FirstOrDefault(f => f.Id == enquiry.ServiceId)?.NameAr),
                          new ValueObj(Convert.ToInt16(enquiryStatus?.Code ?? "0"), enquiryStatus?.NameEn ?? "", enquiryStatus?.NameAr ?? ""),
                          new ValueObj(Convert.ToInt16(enquirySource?.Code ?? "0"), enquirySource?.NameEn ?? "", enquirySource?.NameAr ?? ""),
                          new ValueObj(Convert.ToInt16(EnquiryIssueCategorys?.Code ?? "0"), EnquiryIssueCategorys?.NameEn ?? "", EnquiryIssueCategorys?.NameAr ?? ""),
                          enquiryMap,
                          enquiryConversationDetails,
                          appServices,
                          historys,
                          attachments
                          )
                { PlatformObj = BuildPlatformObj(types.FirstOrDefault(t => t.Scope == typeObj.EnquiryPlatform && t.Code == enquiry.PlatformId)) };
            }


            return default(EnquiryResponseValueObjDto);
        }

        public async Task<bool> EnquiryMessgeReadAsync(int enquiryId)
        {
            var isChange = await domainEnq.CustomerMessageReadAsync(enquiryId, (short)EnquiryConversationSource.CustomerHappness);
            if (isChange)
            {
                await unit.SaveChangesAsync();
                return true;
            }
            return false;
        }

        public async Task<bool> EnquiryCustomerPortalMessgeReadAsync(int enquiryId)
        {
            var isChange = await domainEnq.CustomerMessageReadAsync(enquiryId, (short)EnquiryConversationSource.CustomerPortal);
            if (isChange)
            {
                await unit.SaveChangesAsync();
                return true;
            }
            return false;
        }

        public async Task<List<EnquiryTypeObjDto>> GetEnquiryTypes(string typeStr)
            => (await domainEnq.GetEnquiryTypesAsync(typeStr)).Where(f => f.IsShown == true).
            Select(s => new EnquiryTypeObjDto(Convert.ToInt16(s.Code), s.NameEn, s.NameAr)).ToList();

        public async Task<List<EnquiryTypeObjDto>> GetEnquiryPrioritiesAsync()
        {
            var priortis = await domainEnq.GetEnquiryPrioritiesAsync();
            return priortis.Select(s => new EnquiryTypeObjDto(Convert.ToInt16(s.Code), s.NameEn, s.NameAr)).ToList();
        }

        public async Task<List<EnquiryTypeObjDto>> GetProblemCausesAsync()
        {

            var userId = _currentDomain.UserId;
            if (string.IsNullOrWhiteSpace(userId)) throw new BusinessException("Unauthorized access. Please log in.", 401);
            var userDept = await _queryable.GetQueryable<UserDepartmentModel>().Where(w => w.UserId == userId).AsNoTracking().FirstOrDefaultAsync();

            var problemCauses = (await GetDeptProblemCausesByDeptIdsAsync(userDept?.DepartmentId ?? 0))
                .TryGetValue((userDept?.DepartmentId ?? 0), out List<EnquiryTypeObjDto>? _problemCauses) ? _problemCauses : new List<EnquiryTypeObjDto>();
            return problemCauses;
            //return await this.GetDeptProblemCausesAsync(userDept?.DepartmentId ?? 0);
        }



        public async Task<Dictionary<int, List<EnquiryTypeObjDto>>> GetDeptProblemCausesByDeptIdsAsync(params int[] deptIds)
        {
            Dictionary<int, List<EnquiryTypeObjDto>> dicProblemCauses = new Dictionary<int, List<EnquiryTypeObjDto>>();
            var problemCauses = (await domainEnq.GetEnquiryProblemCausesAsync()).Where(f => f.IsShown == true);

            if (problemCauses.Any())
            {
                var detpids = problemCauses.Select(s => s.DepartmentId).Distinct().ToList();
                foreach (var deptId in detpids)
                {
                    dicProblemCauses.Add(deptId,
                        problemCauses.Where(w => w.DepartmentId == deptId)
                        .Select(s => new EnquiryTypeObjDto(Convert.ToInt16(s.Code), s.NameEn, s.NameAr)).ToList());
                }

            }

            return dicProblemCauses;

        }

        #region  admin 
        public async Task<PageResponse<EnquiryResponseValueObjAdminDto>> GetAdminEnquiriesAsync(EnquiryPageRequestAdminDto requestDto, bool? isTeams = false)
        {

            List<Expression<Func<Enquiry, bool>>> parms = new List<Expression<Func<Enquiry, bool>>>();
            Func<IQueryable<Enquiry>, IOrderedQueryable<Enquiry>>? orderByFunc = null;
            var _sortBy = requestDto.SortBy;
            if (!(requestDto.SearchKey ?? "").IsNullOrEmpty())
            {
                var _keyWorld = requestDto.SearchKey?.Trim();
                var serviceids = domainEnq.GetEnquiriesSerivceQuery(_keyWorld!);
                var detailIds = domainEnq.GetEnquiriesApplicationDetialIds(null, _keyWorld!);

                var curstomerUser = domainEnq.GetProfileUserCreateByNameSearch(_keyWorld!);
                var handleUserIds = domainEnq.GetProfileHandleUserIdsQueryable(_keyWorld!);

                //Expression<Func<Enquiry, bool>> expFunc = (Enquiry e) => e.EnquiryNumber.Contains(_keyWorld);
                //if (serviceids.Any()) expFunc = (Enquiry e) => e.EnquiryNumber.Contains(_keyWorld) || serviceids.Contains(e.ServiceId ?? 0);
                //if (detailIds.Any()) expFunc = (Enquiry e) => e.EnquiryNumber.Contains(_keyWorld) || detailIds.Contains(e.ApplicationDetailId ?? 0);
                //if (serviceids.Any() && detailIds.Any()) expFunc = (Enquiry e) => e.EnquiryNumber.Contains(_keyWorld) || serviceids.Contains(e.ServiceId ?? 0) || detailIds.Contains(e.ApplicationDetailId ?? 0);

                Expression<Func<Enquiry, bool>> expFunc = (Enquiry e) =>
                                                e.EnquiryNumber.Contains(_keyWorld) ||
                                                serviceids.Contains(e.ServiceId ?? 0) ||
                                                detailIds.Contains(e.ApplicationDetailId ?? 0) ||
                                                curstomerUser.Any(s => s == e.Id) ||
                                                handleUserIds.Contains(e.Id)

                ;

                parms.Add(expFunc);

            }

            if (isTeams ?? false)
            {
                if (requestDto.StartTime.HasValue)
                {
                    var startDate = requestDto.StartTime.Value.Date;
                    parms.Add(d => d.CreatedOn >= startDate);
                }
                if (requestDto.EndTime.HasValue)
                {
                    var endExclusive = requestDto.EndTime.Value.Date.AddDays(1);
                    parms.Add(d => d.CreatedOn < endExclusive);
                }
            }
            else
            {
                if (requestDto.StartTime.HasValue)
                {
                    var startDate = requestDto.StartTime.Value.Date;
                    parms.Add(d => d.UpdatedOn.HasValue && d.UpdatedOn.Value >= startDate);
                }
                if (requestDto.EndTime.HasValue)
                {
                    var endExclusive = requestDto.EndTime.Value.Date.AddDays(1);
                    parms.Add(d => d.UpdatedOn.HasValue && d.UpdatedOn.Value < endExclusive);
                }
            }
            if (requestDto.EnquiryType.HasValue) parms.Add(d => d.EnquiryTypeId == requestDto.EnquiryType);

            if (requestDto.IssueCategoryId.HasValue) parms.Add(d => d.IssueCategoryId == requestDto.IssueCategoryId);
            if (requestDto.PriorityId.HasValue) parms.Add(d => d.PriorityId == requestDto.PriorityId);
            if (requestDto.EnquirySourceId.HasValue) parms.Add(d => d.EnquirySourceId == requestDto.EnquirySourceId);

            var isReopened = requestDto.IsReopened == true;
            if (isReopened)
            {
                var reopenedEnquiryIds = GetReopenedEnquiryIdsQuery(_queryable.GetQueryable<EnquiryStatusTracking>());
                parms.Add(d => reopenedEnquiryIds.Contains(d.Id));
            }
            else if (!string.IsNullOrWhiteSpace(requestDto.EnquiryStatusId))
            {
                var ids = requestDto.EnquiryStatusId.Split(',').Select(s => short.TryParse(s, out short _s) ? _s : 0).ToList();
                parms.Add(d => ids.Contains(d.EnquiryStatusId));
            }
            if (!string.IsNullOrWhiteSpace(requestDto.EnquiryNumber)) parms.Add(d => d.EnquiryNumber == requestDto.EnquiryNumber);

            var deptIds = await iUser.GetUserDepartmentIdsAsync(_currentDomain.UserId);
            var isHappinessUser = deptIds.Contains((int)DeptEnum.HappinessCenter);
            if (!(isTeams ?? false))
            {
                // team task
                //  parms.Add(d => d.HandlerUserId == _currentDomain.UserId || d.ManangerUserId == _currentDomain.UserId);
                //parms.Add(d=>d.Id)
                //var querys = GetQueryableTrancking(_currentDomain.UserId ?? "");
                //parms.Add(d => d.HandlerUserId == _currentDomain.UserId || querys.Contains(d.Id));

                // my task

                if (deptIds.Any())
                {

                    if (isReopened)
                    {
                        var querys = GetQueryableTrancking(_currentDomain.UserId ?? "");
                        parms.Add(d => d.HandlerUserId == _currentDomain.UserId || d.ManangerUserId == _currentDomain.UserId || querys.Contains(d.Id));
                    }
                    else if (deptIds.Contains((int)DeptEnum.HappinessCenter))
                    {
                        // happiness
                        var querys = GetQueryableTrancking(_currentDomain.UserId ?? "");
                        if (requestDto.IsEnquiryComplete ?? false)
                        {

                            parms.Add(d => d.EnquiryStatusId >= (short)EnquiryAdminStatus.Resolved && (d.HandlerUserId == _currentDomain.UserId || d.ManangerUserId == _currentDomain.UserId || querys.Contains(d.Id)));
                        }
                        else
                        {

                            parms.Add(d => d.EnquiryStatusId < (short)EnquiryAdminStatus.Resolved && (d.HandlerUserId == _currentDomain.UserId | d.ManangerUserId == _currentDomain.UserId || querys.Contains(d.Id)));
                        }
                    }
                    else
                    {
                        //busseness department

                        if (requestDto.IsEnquiryComplete ?? false)
                        {
                            // completed list

                            //var querys = GetQueryableTrancking(_currentDomain.UserId ?? "");
                            //parms.Add(d => d.HandlerUserId == _currentDomain.UserId || querys.Contains(d.Id));

                            var querys = GetQueryableTrancking(_currentDomain.UserId ?? "");

                            parms.Add(d => (d.HandlerUserId == _currentDomain.UserId && d.EnquiryStatusId != (short)EnquiryAdminStatus.DepartmentProcessing) || (querys.Contains(d.Id) && d.HandlerUserId != _currentDomain.UserId));

                        }
                        else
                        {
                            // todo list
                            parms.Add(BuildBusinessDepartmentTodoPredicate(_currentDomain.UserId, isHappinessUser));

                        }
                    }

                }
                else
                {
                    return new PageResponse<EnquiryResponseValueObjAdminDto>(new List<EnquiryResponseValueObjAdminDto>(), 0, requestDto.PageIndex, requestDto.PageSize);
                }

            }
            else
            {
                // team task
                // Happiness Center keeps its existing full-queue view. Business departments are
                // scoped server-side: a department leader sees the queue of the departments they
                // lead, everyone else only sees the tickets assigned to them. Without this the
                // endpoint returned every ticket in the platform to any authenticated caller.
                if (!isHappinessUser)
                {
                    var leaderDeptIds = await GetCurrentUserLeaderDepartmentIdsAsync();
                    parms.Add(BuildDepartmentTeamTaskPredicate(
                        _currentDomain.UserId,
                        leaderDeptIds,
                        requestDto.IsEnquiryComplete ?? false));
                }

                if (!isReopened)
                {
                    // The two views split their buckets differently and must keep doing so.
                    // Happiness Center owns a ticket end to end, so its boundary is Resolved.
                    // A business department only owns it while it sits in DepartmentProcessing;
                    // once it is sent back the department is done with it. Using the Resolved
                    // boundary here would drop every DepartmentProcessed ticket out of both tabs,
                    // which is exactly what the personal business-department list already avoids.
                    if (isHappinessUser)
                    {
                        if (requestDto.IsEnquiryComplete ?? false)
                        {

                            parms.Add(d => d.EnquiryStatusId >= (short)EnquiryAdminStatus.Resolved);
                        }
                        else
                        {

                            parms.Add(d => d.EnquiryStatusId < (short)EnquiryAdminStatus.Resolved);
                        }
                    }
                    else if (requestDto.IsEnquiryComplete ?? false)
                    {
                        parms.Add(d => d.EnquiryStatusId != (short)EnquiryAdminStatus.DepartmentProcessing);
                    }
                    else
                    {
                        parms.Add(d => d.EnquiryStatusId == (short)EnquiryAdminStatus.DepartmentProcessing);
                    }
                }

            }

            if (!string.IsNullOrWhiteSpace(requestDto.SortBy) && requestDto.SortBy.Equals("sla", StringComparison.OrdinalIgnoreCase))
            {
                _sortBy = "SLAEndTime";
                if (!isHappinessUser) _sortBy = "DepartmentDeadLine";
            }

            // order by
            var orderbyFunc = GetOrderedQueryableByFunc(requestDto, isTeams);

            var (total, pageData) = await domainEnq.GetEnquiriesAsync(requestDto.PageIndex, requestDto.PageSize, requestDto.SortDirection == SortDirection.Descending, _sortBy, parms, orderbyFunc);
            var enquiryObjs = new List<EnquiryResponseValueObjAdminDto>();
            if (pageData.Any())
            {
                var reOpenData = await domainEnq.GetEnquiryReOpentDataAsync(pageData.Select(s => s.Id).ToArray());


                var applicationDic = await domainEnq.GetApplicationNoAsync(pageData.Where(w => w.ApplicationDetailId > 0).Select(s => s.ApplicationDetailId ?? 0).ToArray());

                var enquiryIds = pageData.Select(s => s.Id).ToArray();
                var customerUsers = await this.GetEnquiryCustomerInfosAsync(enquiryIds);
                var customerUsersByEnquiryId = customerUsers
                    .Where(user => user.EnquiryId.HasValue)
                    .GroupBy(user => user.EnquiryId!.Value)
                    .ToDictionary(group => group.Key, group => group.First());
                var handlerUserIds = pageData.Select(s => s.HandlerUserId).Where(id => !string.IsNullOrWhiteSpace(id)).Cast<string>().Distinct().ToArray();
                var managerUserIds = pageData.Select(s => s.ManangerUserId).Where(id => !string.IsNullOrWhiteSpace(id)).Cast<string>().Distinct().ToArray();
                var adminDisplayNames = await GetAdminDisplayNamesAsync(handlerUserIds.Concat(managerUserIds).ToArray());
                var createdByUsers = await iUser.GetByIdUsers(pageData.Select(o => o.CreatedBy).Distinct().ToArray());
                var customerCreatedUserIds = createdByUsers.Select(user => user.Id).ToHashSet();
                var customerCreatedUserDisplayNames = createdByUsers.ToDictionary(
                    user => user.Id,
                    user => BuildDisplayName(user.FirstName, user.LastName, user.UserName) ?? user.UserName ?? user.Id);
                var applicationProfileIdsByNumber = await GetApplicationProfileIdsByNumbersAsync(applicationDic.Values.ToArray());
                var customerProfileIds = pageData
                    .Where(enquiry => customerCreatedUserIds.Contains(enquiry.CreatedBy) && (enquiry.UserProfileId ?? 0) > 0)
                    .Select(enquiry => enquiry.UserProfileId ?? 0)
                    .Concat(applicationProfileIdsByNumber.Values)
                    .Distinct()
                    .ToArray();
                var customerProfiles = await GetEnquiryCustomerProfilesAsync(customerProfileIds);
                var customerProfilesById = customerProfiles
                    .Where(profile => profile.UserProfileId.HasValue)
                    .GroupBy(profile => profile.UserProfileId!.Value)
                    .ToDictionary(group => group.Key, group => group.First());
                var reOpenTimesByEnquiryId = reOpenData.ToDictionary(item => item.EnquiryId, item => item.ReOpenTimes);

                var customerMessgeDic = await this.GetEnquiryCustomerMessageCountByIdAsync(pageData.Select(s => s.Id).ToArray());
                var resolvedCustomerUsers = new Dictionary<int, EnquiryUserObjDto?>();

                var enquirys = pageData.ToList().Select(s =>
                {
                    reOpenTimesByEnquiryId.TryGetValue(s.Id, out var reOpenTimes);
                    string? sla = null;
                    bool isOverDue = false;
                    if (isHappinessUser)
                    {

                        if (s.SLAEndTime.HasValue && s.EnquiryStatusId < (short)EnquiryAdminStatus.Resolved)
                        {
                            sla = EnquirySLaTime(DateTime.UtcNow.AddHours(4), s.SLAEndTime.Value);
                            if (DateTime.UtcNow.AddHours(4) > s.SLAEndTime) isOverDue = true;
                        }

                        if (s.EnquiryStatusId >= (short)EnquiryAdminStatus.Resolved)
                        {
                            var isArSla = _currentDomain?.IsArabicLanguage ?? false;
                            if (DateTime.UtcNow.AddHours(4) <= s.SLAEndTime)
                            {
                                sla = isArSla ? "في الوقت المحدد" : "On Time";
                            }
                            else
                            {
                                sla = isArSla ? "تجاوز الوقت" : "Exceeded";
                                isOverDue = true;
                            }
                        }
                    }
                    else
                    {
                        if (s.DepartmentDeadLine.HasValue && s.EnquiryStatusId == (short)EnquiryAdminStatus.DepartmentProcessing)
                        {
                            sla = EnquirySLaTime(DateTime.UtcNow.AddHours(4), s.DepartmentDeadLine.Value);
                            if (DateTime.UtcNow.AddHours(4) > s.DepartmentDeadLine) isOverDue = true;
                        }

                        if (s.EnquiryStatusId != (short)EnquiryAdminStatus.DepartmentProcessing || (s.EnquiryStatusId == (short)EnquiryAdminStatus.DepartmentProcessing && s.HandlerUserId != _currentDomain.UserId))
                        {
                            var isArSla = _currentDomain?.IsArabicLanguage ?? false;
                            if (DateTime.UtcNow.AddHours(4) <= s.DepartmentDeadLine)
                            {
                                sla = isArSla ? "في الوقت المحدد" : "On Time";
                            }
                            else
                            {
                                sla = isArSla ? "تجاوز الوقت" : "Exceeded";
                                isOverDue = true;
                            }
                        }

                    }


                    customerUsersByEnquiryId.TryGetValue(s.Id, out var customerInfoUser);

                    EnquiryUserObjDto? resolvedCustomerUser = null;
                    string? customerName = null;
                    int? appUserProfileId = null;
                    var isCustormer = customerCreatedUserIds.Contains(s.CreatedBy) ? 1 : 0;

                    if (isCustormer == 1)
                    {
                        if ((s.UserProfileId ?? 0) > 0 && customerProfilesById.TryGetValue(s.UserProfileId ?? 0, out var createdProfileUser))
                        {
                            resolvedCustomerUser = createdProfileUser;
                            appUserProfileId = createdProfileUser.UserProfileId;
                        }

                        customerName =
                            customerInfoUser?.NameEn ??
                            resolvedCustomerUser?.NameEn ??
                            (customerCreatedUserDisplayNames.TryGetValue(s.CreatedBy, out var createdByCustomerName) ? createdByCustomerName : null);

                        if (resolvedCustomerUser == null && !string.IsNullOrWhiteSpace(customerName))
                        {
                            resolvedCustomerUser = customerInfoUser
                                ?? new EnquiryUserObjDto(null, customerName, customerName, null, null, null, s.CreatedBy, null);
                        }
                    }
                    else
                    {
                        var applicationNumber = (s.ApplicationDetailId ?? 0) > 0
                            && applicationDic.TryGetValue(s.ApplicationDetailId ?? 0, out var currentApplicationNumber)
                            ? currentApplicationNumber
                            : null;

                        if (!string.IsNullOrWhiteSpace(applicationNumber)
                            && applicationProfileIdsByNumber.TryGetValue(applicationNumber, out var applicationProfileId)
                            && customerProfilesById.TryGetValue(applicationProfileId, out var applicationProfileUser))
                        {
                            resolvedCustomerUser = applicationProfileUser;
                            customerName = applicationProfileUser.NameEn ?? customerInfoUser?.NameEn;
                            appUserProfileId = applicationProfileUser.UserProfileId;
                        }
                        else
                        {
                            resolvedCustomerUser = customerInfoUser;
                            customerName = customerInfoUser?.NameEn;
                        }
                    }

                    resolvedCustomerUsers[s.Id] = resolvedCustomerUser;

                    var agnetname = !string.IsNullOrWhiteSpace(s.ManangerUserId) && adminDisplayNames.TryGetValue(s.ManangerUserId, out var managerName)
                        ? managerName
                        : null;
                    var handleName = !string.IsNullOrWhiteSpace(s.HandlerUserId) && adminDisplayNames.TryGetValue(s.HandlerUserId, out var currentHandlerName)
                        ? currentHandlerName
                        : "";

                    if (s.EnquiryStatusId == (short)EnquiryAdminStatus.PendingCustomer)
                    {
                        handleName = customerName;
                        if (string.IsNullOrWhiteSpace(handleName) && customerCreatedUserDisplayNames.TryGetValue(s.CreatedBy, out var pendingCustomerName))
                        {
                            handleName = pendingCustomerName;
                        }
                    }

                    var messgeCount = customerMessgeDic.TryGetValue(s.Id, out int _messgeCount) ? _messgeCount : 0;
                    var _applincationNo = (s.ApplicationDetailId > 0 && applicationDic.TryGetValue(s.ApplicationDetailId ?? 0, out string? applincationNo)) ? applincationNo : "";
                    return new EnquiryResponseAdminDto(s.Id, s.EnquiryNumber, _applincationNo, s.EnquiryTypeId, s.EnquirySourceId, s.ServiceId, s.CreatedOn, s.UpdatedOn, s.EnquiryStatusId, s.AttachementUrl, reOpenTimes, s.Description, customerName, sla, handleName, agnetname, s.IssueCategoryId, s.PriorityId, s.UserProfileId, resolvedCustomerUser?.IsVip, s.CreatedBy, isCustormer, s.DepartmentId, messgeCount, isOverDue, s.SLAEndTime, appUserProfileId) { PlatformId = s.PlatformId, IsCurrentHandler = IsCurrentTicketHandler(s.HandlerUserId) };
                }).ToList();

                var typeObj = new EnquiryTypeDto();
                var types = await domainEnq.GetEnquiryTypesAsync(typeObj.EnquiryType, typeObj.EnquirySource, typeObj.EnquiryAdminStatus, typeObj.EnquiryIssueCategory, typeObj.EnquiryPriorityType, typeObj.EnquiryPlatform);
                var services = await domainEnq.GetServiceConfigsAsync();
                var depts = await this.DepartmentDataAsync();
                var priorityTypes = await domainEnq.GetEnquiryPrioritiesAsync();

                foreach (var item in enquirys)
                {
                    resolvedCustomerUsers.TryGetValue(item.Id, out var custormUserInfo);

                    ValueObj? deptObj = null;
                    if (item.DepartmenId.HasValue)
                    {
                        var currentDept = depts.FirstOrDefault(f => f.Id == item.DepartmenId);
                        deptObj = new ValueObj(item.DepartmenId ?? 0, currentDept?.NameEn ?? "", currentDept?.NameAr ?? "");
                        if (item.EnquiryStatusId == (short)EnquiryAdminStatus.PendingCustomer) deptObj = new ValueObj(0, "Curstomer");
                    }

                    var enquiryType = types.Where(t => t.Scope == typeObj.EnquiryType && Convert.ToInt16(t.Code) == item.EnquiryTypeId).Select(s => new ValueObj(Convert.ToInt16(s.Code), s.NameEn, s.NameAr)).FirstOrDefault();
                    var enquirySource = types.Where(t => t.Scope == typeObj.EnquirySource && Convert.ToInt16(t.Code) == item.EnquirySourceId).Select(s => new ValueObj(Convert.ToInt16(s.Code), s.NameEn, s.NameAr)).FirstOrDefault();
                    var enquiryStatus = types.Where(t => t.Scope == typeObj.EnquiryAdminStatus && Convert.ToInt16(t.Code) == item.EnquiryStatusId).Select(s => new ValueObj(Convert.ToInt16(s.Code), s.NameEn, s.NameAr)).FirstOrDefault();
                    var enquiryIssueCategorys = types.Where(t => t.Scope == typeObj.EnquiryIssueCategory && Convert.ToInt16(t.Code) == item.IssueCategoryId).Select(s => new ValueObj(Convert.ToInt16(s.Code), s.NameEn, s.NameAr)).FirstOrDefault();
                    var enquiryPriorityType = priorityTypes.Where(t => t.Id == item.PriorityId).Select(s => new ValueObj(s.Id, s.NameEn, s.NameAr)).FirstOrDefault();
                    var equiryService = services?.Where(f => f.Id == item.ServiceId).Select(s => new ValueObj(s.Id, s.NameEn, s.NameAr)).FirstOrDefault();
                    enquiryObjs.Add(new EnquiryResponseValueObjAdminDto(
                        enquiryType,
                        equiryService,
                        enquiryStatus,
                        enquirySource,
                        enquiryIssueCategorys,
                        item, null, null, null, custormUserInfo, deptObj, enquiryPriorityType
                        )
                    { PlatformObj = BuildPlatformObj(types.FirstOrDefault(t => t.Scope == typeObj.EnquiryPlatform && t.Code == item.PlatformId)) });
                }
                return new PageResponse<EnquiryResponseValueObjAdminDto>(enquiryObjs, total, requestDto.PageIndex, requestDto.PageSize);
            }

            return new PageResponse<EnquiryResponseValueObjAdminDto>(enquiryObjs, 0, requestDto.PageIndex, requestDto.PageSize);
        }


        public async Task<IDictionary<int, int>> GetEnquiryCustomerMessageCountByIdAsync(int[] enquiryIds)
        {
            var enquiryConversations = await _queryable.GetQueryable<EnquiryConversation>()
                   .Where(f => enquiryIds.Contains(f.EnquiryId) && f.IsRead == false && f.SourceTypeId == (short)EnquiryConversationSource.CustomerPortal)
                   .AsNoTracking()
                   .GroupBy(c => c.EnquiryId)
                   .Select(g => new { EnquiryId = g.Key, Count = g.Count() })
                   .ToListAsync();
            return enquiryConversations.ToDictionary(s => s.EnquiryId, c => c.Count);
        }

        public async Task<PageResponse<EnquiryResponseValueObjAdminDto>> GetAdminAccountEnquiriesAsync(EnquiryPageRequestAccountAdminDto requestDto, int? userProfileId, string? userId)
        {

            List<Expression<Func<Enquiry, bool>>> parms = new List<Expression<Func<Enquiry, bool>>>();
            var _sortBy = requestDto.SortBy;
            if (!(requestDto.SearchKey ?? "").IsNullOrEmpty())
            {
                var _keyWorld = requestDto.SearchKey?.Trim();
                var serviceids = domainEnq.GetEnquiriesSerivceQuery(_keyWorld!);
                var detailIds = domainEnq.GetEnquiriesApplicationDetialIds(null, _keyWorld!);

                var curstomerUser = domainEnq.GetProfileUserIdsQueryable(_keyWorld!);
                var handleUserIds = domainEnq.GetProfileHandleUserIdsQueryable(_keyWorld!);

                //Expression<Func<Enquiry, bool>> expFunc = (Enquiry e) => e.EnquiryNumber.Contains(_keyWorld);
                //if (serviceids.Any()) expFunc = (Enquiry e) => e.EnquiryNumber.Contains(_keyWorld) || serviceids.Contains(e.ServiceId ?? 0);
                //if (detailIds.Any()) expFunc = (Enquiry e) => e.EnquiryNumber.Contains(_keyWorld) || detailIds.Contains(e.ApplicationDetailId ?? 0);
                //if (serviceids.Any() && detailIds.Any()) expFunc = (Enquiry e) => e.EnquiryNumber.Contains(_keyWorld) || serviceids.Contains(e.ServiceId ?? 0) || detailIds.Contains(e.ApplicationDetailId ?? 0);

                Expression<Func<Enquiry, bool>> expFunc = (Enquiry e) =>
                                                e.EnquiryNumber.Contains(_keyWorld) ||
                                                serviceids.Contains(e.ServiceId ?? 0) ||
                                                detailIds.Contains(e.ApplicationDetailId ?? 0) ||
                                                curstomerUser.Contains(e.Id) ||
                                                handleUserIds.Contains(e.Id)

                ;

                parms.Add(expFunc);

            }
            if (requestDto.StartTime.HasValue)
                parms.Add(d => d.CreatedOn.Date >= requestDto.StartTime);
            if (requestDto.EndTime.HasValue)
            {
                parms.Add(d => d.CreatedOn.Date <= requestDto.EndTime);
            }
            if (requestDto.EnquiryType.HasValue) parms.Add(d => d.EnquiryTypeId == requestDto.EnquiryType);

            if (requestDto.IssueCategoryId.HasValue) parms.Add(d => d.IssueCategoryId == requestDto.IssueCategoryId);

            if (requestDto.PriorityId.HasValue) parms.Add(d => d.PriorityId == requestDto.PriorityId);

            //if (requestDto.IsEnquiryComplete ?? false)
            //{

            //    parms.Add(d => d.EnquiryStatusId >= (short)EnquiryAdminStatus.Resolved);
            //}
            //else
            //{

            //    parms.Add(d => d.EnquiryStatusId < (short)EnquiryAdminStatus.Resolved);
            //}

            if (!string.IsNullOrWhiteSpace(requestDto.EnquiryStatusId))
            {
                var ids = requestDto.EnquiryStatusId.Split(',').Select(s => short.TryParse(s, out short _s) ? _s : 0).ToList();
                parms.Add(d => ids.Contains(d.EnquiryStatusId));
            }
            if (!string.IsNullOrWhiteSpace(requestDto.EnquiryNumber)) parms.Add(d => d.EnquiryNumber == requestDto.EnquiryNumber);

            if (userProfileId > 0)
            {
                var applicatinDetailQuerys = domainEnq.GetEnquiryApplicatonByProfileQuery(userProfileId ?? 0);
                parms.Add(d => d.UserProfileId == userProfileId || applicatinDetailQuerys.Contains(d.ApplicationDetailId ?? 0));
            }
            else if (!string.IsNullOrEmpty(userId))
            {
                parms.Add(d => d.CreatedBy == userId);
            }

            if (!string.IsNullOrWhiteSpace(requestDto.SortBy) && requestDto.SortBy.Equals("sla", StringComparison.OrdinalIgnoreCase))
            {
                _sortBy = "SLAEndTime";
            }

            var (total, pageData) = await domainEnq.GetEnquiriesAsync(requestDto.PageIndex, requestDto.PageSize, requestDto.SortDirection == SortDirection.Descending, _sortBy, parms);
            var enquiryObjs = new List<EnquiryResponseValueObjAdminDto>();
            if (pageData.Any())
            {
                var reOpenData = await domainEnq.GetEnquiryReOpentDataAsync(pageData.Select(s => s.Id).ToArray());

                var applicationDic = await domainEnq.GetApplicationNoAsync(pageData.Where(w => w.ApplicationDetailId > 0).Select(s => s.ApplicationDetailId ?? 0).ToArray());

                var handUserIds = pageData.Select(s => s.HandlerUserId).Distinct().ToArray();
                var createdByIds = pageData.Select(s => s.CreatedBy).Distinct().ToArray();
                var agentUserIds = pageData.Select(s => s.ManangerUserId).Distinct().ToArray();
                handUserIds = handUserIds.Concat(createdByIds).Concat(agentUserIds).Where(w => !string.IsNullOrWhiteSpace(w)).Distinct().ToArray();
                var handUsers = await this.GetEnquiryAdminUsersListAsync(handUserIds);
                var enquiryIds = pageData.Select(s => s.Id).ToArray();
                var customerUsers = await this.GetEnquiryCustomerInfosAsync(enquiryIds);

                var enquirys = pageData.ToList().Select(s =>
                {
                    var reOpenTimes = reOpenData.FirstOrDefault(f => f.EnquiryId == s.Id).ReOpenTimes;

                    string? sla = null;
                    if (s.SLAEndTime.HasValue && s.EnquiryStatusId < (short)EnquiryAdminStatus.Resolved)
                    {
                        sla = EnquirySLaTime(DateTime.UtcNow.AddHours(4), s.SLAEndTime.Value);
                    }

                    if (s.EnquiryStatusId >= (short)EnquiryAdminStatus.Resolved)
                    {
                        var isArSla = _currentDomain?.IsArabicLanguage ?? false;
                        if (DateTime.UtcNow.AddHours(4) <= s.SLAEndTime) sla = isArSla ? "في الوقت المحدد" : "On Time";
                        else sla = isArSla ? "تجاوز الوقت" : "Exceeded";
                    }

                    var agnetname = handUsers?.FirstOrDefault(f => f.UserId == s.ManangerUserId)?.NameEn;
                    var customerName = customerUsers?.FirstOrDefault(f => f.EnquiryId == s.Id)?.NameEn ?? handUsers?.FirstOrDefault(f => f.UserProfileId == s.UserProfileId)?.NameEn ?? handUsers?.FirstOrDefault(f => f.UserId == s.CreatedBy && f.UserTypeId == (int)UserTypeCode.Individual)?.NameEn;
                    var handleName = handUsers?.FirstOrDefault(f => f.UserTypeId == (int)UserTypeCode.Individual && f.UserId == s.HandlerUserId)?.NameEn ?? "";

                    var isVip = handUsers?.FirstOrDefault(f => f.UserProfileId == s.UserProfileId)?.IsVip;

                    if (s.EnquiryStatusId == (short)EnquiryAdminStatus.PendingCustomer) handleName = handUsers?.FirstOrDefault(f => f.UserId == s.CreatedBy)?.NameEn;

                    var _applincationNo = (s.ApplicationDetailId > 0 && applicationDic.TryGetValue(s.ApplicationDetailId ?? 0, out string? applincationNo)) ? applincationNo : "";
                    return new EnquiryResponseAdminDto(s.Id, s.EnquiryNumber, _applincationNo, s.EnquiryTypeId, s.EnquirySourceId, s.ServiceId, s.CreatedOn, s.UpdatedOn, s.EnquiryStatusId, s.AttachementUrl, reOpenTimes, s.Description, customerName, sla, handleName, agnetname, s.IssueCategoryId, s.PriorityId, s.UserProfileId, isVip, s.CreatedBy, s.DepartmentId) { PlatformId = s.PlatformId, IsCurrentHandler = IsCurrentTicketHandler(s.HandlerUserId) };
                }).ToList();

                var typeObj = new EnquiryTypeDto();
                var types = await domainEnq.GetEnquiryTypesAsync(typeObj.EnquiryType, typeObj.EnquirySource, typeObj.EnquiryAdminStatus, typeObj.EnquiryIssueCategory, typeObj.EnquiryPriorityType, typeObj.EnquiryPlatform);
                var services = await domainEnq.GetServiceConfigsAsync();
                var depts = await this.DepartmentDataAsync(); ;

                foreach (var item in enquirys)
                {
                    var custormUserInfo = customerUsers.FirstOrDefault(f => f.EnquiryId == item.Id);
                    if (custormUserInfo == null) custormUserInfo = handUsers.FirstOrDefault(f => f.UserProfileId == item.UserProfileId);

                    ValueObj? deptObj = null;
                    if (item.DepartmenId.HasValue)
                    {
                        var currentDept = depts.FirstOrDefault(f => f.Id == item.DepartmenId);
                        deptObj = new ValueObj(item.DepartmenId ?? 0, currentDept?.NameEn ?? "", currentDept?.NameAr ?? "");
                        if (item.EnquiryStatusId == (short)EnquiryAdminStatus.PendingCustomer) deptObj = new ValueObj(0, "Curstomer");
                    }

                    var enquiryType = types.FirstOrDefault(t => t.Scope == typeObj.EnquiryType && Convert.ToInt16(t.Code) == item.EnquiryTypeId);
                    var enquirySource = types.FirstOrDefault(t => t.Scope == typeObj.EnquirySource && Convert.ToInt16(t.Code) == item.EnquirySourceId);
                    var enquiryStatus = types.FirstOrDefault(t => t.Scope == typeObj.EnquiryAdminStatus && Convert.ToInt16(t.Code) == item.EnquiryStatusId);
                    var enquiryIssueCategorys = types.FirstOrDefault(t => t.Scope == typeObj.EnquiryIssueCategory && Convert.ToInt16(t.Code) == item.IssueCategoryId);
                    var enquiryPriorityType = types.Where(t => t.Scope == typeObj.EnquiryPriorityType && Convert.ToInt16(t.Code) == item.PriorityId).Select(s => new ValueObj(Convert.ToInt16(s?.Code ?? "0"), s?.NameEn, s?.NameAr)).FirstOrDefault();
                    enquiryObjs.Add(new EnquiryResponseValueObjAdminDto(
                        new ValueObj(Convert.ToInt16(enquiryType?.Code ?? "0"), enquiryType?.NameEn ?? "", enquiryType?.NameAr ?? ""),
                        new ValueObj(item.ServiceId ?? 0, services?.FirstOrDefault(f => f.Id == item.ServiceId)?.NameEn, services?.FirstOrDefault(f => f.Id == item.ServiceId)?.NameAr),
                        new ValueObj(Convert.ToInt16(enquiryStatus?.Code ?? "0"), enquiryStatus?.NameEn ?? "", enquiryStatus?.NameAr ?? ""),
                        new ValueObj(Convert.ToInt16(enquirySource?.Code ?? "0"), enquirySource?.NameEn ?? "", enquirySource?.NameAr ?? ""),
                        new ValueObj(Convert.ToInt16(enquiryIssueCategorys?.Code ?? "0"), enquiryIssueCategorys?.NameEn ?? "", enquiryIssueCategorys?.NameAr ?? ""),
                        item, null, null, null, custormUserInfo, deptObj, enquiryPriorityType
                        )
                    { PlatformObj = BuildPlatformObj(types.FirstOrDefault(t => t.Scope == typeObj.EnquiryPlatform && t.Code == item.PlatformId)) });
                }
                return new PageResponse<EnquiryResponseValueObjAdminDto>(enquiryObjs, total, requestDto.PageIndex, requestDto.PageSize);
            }

            return new PageResponse<EnquiryResponseValueObjAdminDto>(enquiryObjs, 0, requestDto.PageIndex, requestDto.PageSize); ;
        }

        private IQueryable<int> GetQueryableTrancking(string userId)
        {
            return _queryable.GetQueryable<EnquiryStatusTracking>().Where(f => f.CreatedBy == userId).Select(s => s.EnquiryId).Distinct();
        }

        /// <summary>
        /// Departments the current user leads, excluding Happiness Center. Happiness Center keeps
        /// its own full-queue flow, so it must never widen a business department scope.
        /// </summary>
        private async Task<List<int>> GetCurrentUserLeaderDepartmentIdsAsync()
        {
            var userDepts = await this.GetUserIdDepartmentAsync(_currentDomain.UserId ?? "");
            return GetLeaderDepartmentIds(userDepts);
        }

        /// <summary>
        /// Same projection as <see cref="GetCurrentUserLeaderDepartmentIdsAsync"/> for callers that
        /// already loaded the department rows.
        /// </summary>
        private static List<int> GetLeaderDepartmentIds(List<UserDepartmentDto>? userDepts)
            => userDepts?
                .Where(d => (d.IsLeader ?? false)
                            && (d.DepartmentId ?? 0) > 0
                            && d.DepartmentId != (int)DeptEnum.HappinessCenter)
                .Select(d => d.DepartmentId!.Value)
                .Distinct()
                .ToList() ?? new List<int>();

        /// <summary>
        /// Server-side scope for the business-department team task queue.
        ///  - To do: the leader sees every ticket currently assigned to a department they lead
        ///    (Enquiry.DepartmentId), plus their own tickets. A non-leader only sees their own.
        ///  - Completed: visibility follows EnquiryStatusTracking, which stores the target
        ///    DepartmentId on every "transfer to department" step. A leader therefore sees every
        ///    ticket their department took part in, a non-leader only the steps they created or
        ///    were the handler of.
        /// </summary>
        private Expression<Func<Enquiry, bool>> BuildDepartmentTeamTaskPredicate(
            string? currentUserId,
            List<int> leaderDeptIds,
            bool isCompleted)
        {
            if (string.IsNullOrWhiteSpace(currentUserId)) return d => false;

            if (isCompleted)
            {
                var visibleIds = GetDepartmentVisibleTrackingQuery(currentUserId, leaderDeptIds);
                return d => visibleIds.Contains(d.Id);
            }

            if (leaderDeptIds.Count == 0)
            {
                return d => d.HandlerUserId == currentUserId;
            }

            return d => d.HandlerUserId == currentUserId
                        || (d.DepartmentId.HasValue && leaderDeptIds.Contains(d.DepartmentId.Value));
        }

        /// <summary>
        /// Union of the two team task buckets, used by the status counters so the tab numbers match
        /// exactly the rows the caller can page through. Returns null for Happiness Center, which
        /// keeps counting the whole queue.
        /// </summary>
        private async Task<Expression<Func<Enquiry, bool>>?> BuildDepartmentTeamTaskScopeAsync()
        {
            var currentUserId = _currentDomain.UserId;
            var deptIds = await iUser.GetUserDepartmentIdsAsync(currentUserId);
            if (deptIds.Contains((int)DeptEnum.HappinessCenter)) return null;

            if (string.IsNullOrWhiteSpace(currentUserId)) return d => false;

            var leaderDeptIds = await GetCurrentUserLeaderDepartmentIdsAsync();
            var visibleIds = GetDepartmentVisibleTrackingQuery(currentUserId, leaderDeptIds);
            var processing = (short)EnquiryAdminStatus.DepartmentProcessing;

            if (leaderDeptIds.Count == 0)
            {
                return d => (d.EnquiryStatusId == processing && d.HandlerUserId == currentUserId)
                            || (d.EnquiryStatusId != processing && visibleIds.Contains(d.Id));
            }

            return d => (d.EnquiryStatusId == processing
                         && (d.HandlerUserId == currentUserId
                             || (d.DepartmentId.HasValue && leaderDeptIds.Contains(d.DepartmentId.Value))))
                        || (d.EnquiryStatusId != processing && visibleIds.Contains(d.Id));
        }

        private IQueryable<int> GetDepartmentVisibleTrackingQuery(string currentUserId, List<int> leaderDeptIds)
        {
            var trackings = _queryable.GetQueryable<EnquiryStatusTracking>();

            if (leaderDeptIds.Count == 0)
            {
                return trackings
                    .Where(t => t.CreatedBy == currentUserId || t.HandlerUserId == currentUserId)
                    .Select(t => t.EnquiryId)
                    .Distinct();
            }

            return trackings
                .Where(t => t.CreatedBy == currentUserId
                            || t.HandlerUserId == currentUserId
                            || (t.DepartmentId.HasValue && leaderDeptIds.Contains(t.DepartmentId.Value)))
                .Select(t => t.EnquiryId)
                .Distinct();
        }

        private IQueryable<int> GetDepartmentHandledEnquiryTracking(string userId)
        {
            return _queryable.GetQueryable<EnquiryStatusTracking>()
                .Where(f => f.CreatedBy == userId && f.ToStatusId == (short)EnquiryAdminStatus.DepartmentProcessed)
                .Select(s => s.EnquiryId)
                .Distinct();
        }

        private Func<IQueryable<Enquiry>, IOrderedQueryable<Enquiry>>? GetOrderedQueryableByFunc(EnquiryPageRequestAdminDto request, bool? isTeams = false)
        {
            //EnquiryPageRequestAdminDto requestDto, bool? isTeams = false
            Func<IQueryable<Enquiry>, IOrderedQueryable<Enquiry>>? orderByFunc = null;

            if (string.IsNullOrWhiteSpace(request.SortBy) || request.SortBy.ToLower() == "id".ToLower())
            {

                orderByFunc = s => s.OrderBy(s => s.SLAEndTime)
                .ThenBy(
                    s =>
                    s.EnquiryStatusId == (short)EnquiryAdminStatus.Open ? 1 :
                    s.EnquiryStatusId == (short)EnquiryAdminStatus.DepartmentProcessed ? 2 :
                    s.EnquiryStatusId == (short)EnquiryAdminStatus.PendingCustomer ? 3 :
                    s.EnquiryStatusId == (short)EnquiryAdminStatus.DepartmentProcessing ? 4 :
                    s.EnquiryStatusId == (short)EnquiryAdminStatus.Resolved ? 5 :
                    s.EnquiryStatusId == (short)EnquiryAdminStatus.Completed ? 6 :
                    s.EnquiryStatusId == (short)EnquiryAdminStatus.Cancelled ? 7
                : 100);

                if (request.IsEnquiryComplete == true)
                {
                    if (isTeams == true)
                    {
                        orderByFunc = s => s.OrderByDescending(s => s.CreatedOn);
                    }
                    else
                    {
                        orderByFunc = s => s.OrderByDescending(s => s.UpdatedOn);
                    }
                }

            }
            else if (request.SortBy.ToLower() == "sla".ToLower())
            {
                if (request.SortDirection == SortDirection.Descending)
                {
                    orderByFunc = s => s.OrderByDescending(s => s.SLAEndTime);

                }
                else
                {
                    orderByFunc = s => s.OrderBy(s => s.SLAEndTime);
                }
            }
            else if (request.SortBy.ToLower() == "UpdatedOn".ToLower())
            {
                if (request.SortDirection == SortDirection.Descending)
                {
                    orderByFunc = s => s.OrderByDescending(s => s.UpdatedOn);

                }
                else
                {
                    orderByFunc = s => s.OrderBy(s => s.UpdatedOn);
                }
            }
            else if (request.SortBy.ToLower() == "createdOn".ToLower())
            {
                if (request.SortDirection == SortDirection.Descending)
                {
                    orderByFunc = s => s.OrderByDescending(s => s.CreatedOn);

                }
                else
                {
                    orderByFunc = s => s.OrderBy(s => s.CreatedOn);
                }
            }

            return orderByFunc;
        }
        private IQueryable<int> GetQueryableTrancking(string userId, int tostatuId)
        {
            return _queryable.GetQueryable<EnquiryStatusTracking>().Where(f => f.CreatedBy == userId && f.ToStatusId == tostatuId).Select(s => s.EnquiryId).Distinct();
        }

        private static string? BuildDisplayName(string? firstName, string? lastName, string? fallback = null)
        {
            var fullName = string.Join(" ", new[] { firstName, lastName }.Where(value => !string.IsNullOrWhiteSpace(value))).Trim();
            return string.IsNullOrWhiteSpace(fullName) ? fallback : fullName;
        }

        private async Task<Dictionary<string, string>> GetAdminDisplayNamesAsync(params string[] userIds)
        {
            var normalizedIds = userIds.Where(id => !string.IsNullOrWhiteSpace(id)).Distinct().ToArray();
            if (!normalizedIds.Any())
            {
                return new Dictionary<string, string>();
            }

            var adminUsers = await _queryable.GetQueryable<AdminUser>()
                .Where(user => normalizedIds.Contains(user.Id))
                .Select(user => new
                {
                    user.Id,
                    DisplayName = BuildDisplayName(user.FirstName, user.LastName, user.UserName)
                })
                .ToListAsync();

            return adminUsers
                .Where(user => !string.IsNullOrWhiteSpace(user.DisplayName))
                .ToDictionary(user => user.Id, user => user.DisplayName!);
        }

        private async Task<List<EnquiryUserObjDto>> GetEnquiryCustomerProfilesAsync(params int[] profileIds)
        {
            var normalizedProfileIds = profileIds.Where(id => id > 0).Distinct().ToArray();
            if (!normalizedProfileIds.Any())
            {
                return new List<EnquiryUserObjDto>();
            }

            var query = from up in _queryable.GetQueryable<UserProfile>()
                        join u in _queryable.GetQueryable<User>() on up.UserId equals u.Id
                        from p in _queryable.GetQueryable<Person>().Where(person => person.Id == up.PersonId).DefaultIfEmpty()
                        from em in _queryable.GetQueryable<UserEstablishment>().Where(mapping => mapping.UserProfileId == up.Id).DefaultIfEmpty()
                        from e in _queryable.GetQueryable<Establishment>().Where(establishment => establishment.Id == em.EstablishmentId).DefaultIfEmpty()
                        where normalizedProfileIds.Contains(up.Id)
                        select new EnquiryUserObjDto(
                            null,
                            p.Name ?? e.NameEn,
                            p.NameAr ?? e.NameAr,
                            up.UserTypeId,
                            up.UserTypeId > 0 ? up.UserTypeId.ToString() : null,
                            up.Id,
                            u.Id,
                            up.IsVip);

            return await query.AsNoTracking().ToListAsync();
        }

        private async Task<Dictionary<string, int>> GetApplicationProfileIdsByNumbersAsync(params string[] applicationNumbers)
        {
            var normalizedNumbers = applicationNumbers
                .Where(number => !string.IsNullOrWhiteSpace(number))
                .Distinct()
                .ToArray();

            if (!normalizedNumbers.Any())
            {
                return new Dictionary<string, int>();
            }

            var rows = await _queryable.GetQueryable<ApplicationModel>()
                .Where(application => normalizedNumbers.Contains(application.ApplicationNumber) && application.ProfileId > 0)
                .Select(application => new { application.Id, application.ApplicationNumber, application.ProfileId })
                .ToListAsync();

            // Sub-service applications share their main-service ApplicationNumber after lifecycle
            // unification; collapse each number to its main (earliest) application to keep the key unique.
            return rows
                .GroupBy(row => row.ApplicationNumber)
                .ToDictionary(group => group.Key, group => group.OrderBy(row => row.Id).First().ProfileId);
        }

        public async Task<List<EnquiryUserObjDto>> GetEnquiryAdminUsersListAsync(params string[] parmas)
        {

            List<EnquiryUserObjDto> userList = new List<EnquiryUserObjDto>();
            var admminUsers =
                 _queryable.GetQueryable<AdminUser>()
                 .Where(adm => parmas.Contains(adm.Id))
                 .Select(
                      s => new EnquiryUserObjDto(null, s.FirstName + " " + s.LastName, null, 1, null, null, s.Id, null)
                    ).ToList();

            userList = admminUsers;
            List<string> userIds = new List<string>();
            if (admminUsers.Count > 0)
            {
                userIds = (parmas.ToList().Except(admminUsers.Select(s => s.UserId).ToList()).ToList()) ?? new List<string>();

            }

            var q = from u in _queryable.GetQueryable<User>()
                    join up in _queryable.GetQueryable<UserProfile>() on u.Id equals up.UserId
                    from p in _queryable.GetQueryable<Person>().Where(w => w.Id == up.PersonId).DefaultIfEmpty()
                    from em in _queryable.GetQueryable<UserEstablishment>().Where(ue => ue.UserProfileId == up.Id).DefaultIfEmpty()
                    from e in _queryable.GetQueryable<Establishment>().Where(e => e.Id == em.EstablishmentId).DefaultIfEmpty()
                    where userIds.Contains(u.Id)
                    select new EnquiryUserObjDto(null, p.Name ?? e.NameEn, p.NameAr ?? e.NameAr, up.UserTypeId, up.UserTypeId > 0 ? (up.UserTypeId + "") : null, up.Id, u.Id, up.IsVip);

            var profileUseIds = await q.AsNoTracking().ToListAsync();

            return userList.Concat(profileUseIds).ToList();


        }

        public async Task<PageResponse<EnquiryResponseValueObjAdminDto>> GetAdminTeamTaskEnquiriesAsync(EnquiryPageRequestAdminDto requestDto)
        {
            //Happiness Center

            //int? departmentId = (int)DeptEnum.HappinessCenter;
            return await this.GetAdminEnquiriesAsync(requestDto, true);
        }

        public async Task<byte[]> GetAdminTeamTaskEnquiriesExportAsync(EnquiryPageRequestAdminDto requestDto, bool? isTeams = false, int? departmentId = null)
        {

            requestDto.PageSize = 10000;
            var dataPageList = await this.GetAdminEnquiriesAsync(requestDto, isTeams);
            var _isArabicLanguage = _currentDomain.IsArabicLanguage;
            var headers = _isArabicLanguage
                ? new[] { "رقم التذكرة", "المصدر", "النوع", "رقم الطلب", "اسم الخدمة", "العميل", "الأولوية", "SLA", "المعالج الحالي", "الحالة", "آخر تحديث" }
                : new[] { "Ticket No.", "Source", "Type", "Application No.", "Service Name", "Customer", "Priority", "SLA", "Current Handler", "Status", "Last Updated" };
            var dataExports = new List<List<string?>>();
            if (dataPageList.Total > 0)
            {
                var dataList = dataPageList.Items.ToList();
                foreach (var item in dataList)
                {
                    dataExports.Add(new List<string?>()
                    {
                        item?.EnquiryNumber,
                        _isArabicLanguage?item?.EnquirySoruceObj?.NameAr:  item?.EnquirySoruceObj?.NameEn,
                        _isArabicLanguage? item?.EnquiryTypeObj?.NameAr:item?.EnquiryTypeObj?.NameEn,
                        item?.ApplicationNo,
                        _isArabicLanguage? item?.ServiceObj?.NameAr : item?.ServiceObj?.NameEn,
                        item?.Custormer,
                        _isArabicLanguage? item?.PriorityObj?.NameAr:item?.PriorityObj?.NameEn,
                        item?.Sla,
                        item?.currentHander,
                        _isArabicLanguage? item?.EnquiryStatusObj?.NameAr: item?.EnquiryStatusObj?.NameEn,
                        item?.UpdatedOn?.ToString("dd/MM/yyyy HH:mm:ss")
                    });
                }

            }
            using (var ms = new MemoryStream())
            {
                using (var sw = new StreamWriter(ms, Encoding.UTF8))
                {
                    sw.WriteLine(string.Join(",", headers));
                    foreach (var item in dataExports)
                    {
                        sw.WriteLine(string.Join(",", item));
                    }
                }
                return ms.ToArray();
            }


        }

        public async Task<List<TeamMemberEnquiryTaskResponse>> GetTeamMenberInfoAsync(TeamMemberEnquiryTaskRequest request)
        {
            var maxWorkTaskCount = 30;
            var teamEnquirys = new List<TeamMemberEnquiryTaskResponse>();
            var leaveLogs = await this.GetUserDepartmentsLeavelogsAsync();
            if (!leaveLogs?.Any() ?? false) return teamEnquirys;
            if (!string.IsNullOrWhiteSpace(request.MemberId)) leaveLogs = leaveLogs.Where(s => s.UserId == request.MemberId).ToList();
            if (!string.IsNullOrWhiteSpace(request.Keyword)) leaveLogs = leaveLogs.Where(s => s.UserName?.Contains(request.Keyword) ?? false).ToList();
            if (!leaveLogs?.Any() ?? false) return teamEnquirys;

            if (request.EndTime.HasValue) request.EndTime = request.EndTime.Value.AddDays(1).Date.AddMicroseconds(-1);

            var leaveTypes = await this.GetEnquiryTypes("LeaveTypes");
            var data = await domainEnq.GetTeameberEnquiryAsync(request.MemberId, request.StartTime, request.EndTime);
            if (data.Any())
            {
                var userIds = leaveLogs!.Select(s => s.UserId).Distinct().ToList();
                if (!string.IsNullOrWhiteSpace(request.MemberId)) data = data.Where(f => f.HandlerUserId == request.MemberId).ToList();
                if (request.StartTime.HasValue && request.StartTime.HasValue) data = data.Where(f => f.CreatedOn >= request.StartTime && f.CreatedOn <= request.EndTime).ToList();

                var completeds = data.Where(e => e.EnquiryStatusId >= (short)EnquiryAdminStatus.Resolved);

                foreach (var userId in userIds)
                {
                    var userCompleteds = completeds.Where(f => f.HandlerUserId == userId).ToList();
                    var userTaskDatas = data.Where(f => f.HandlerUserId == userId).ToList();

                    var totalTaskCountOnTime = userTaskDatas.Where(f => f.SLAEndTime >= DateTime.UtcNow.AddHours(4)).Count();
                    var totalTaskCount = userTaskDatas.Count();
                    var completedTaskCount = userCompleteds.Count();
                    var overCompleteCount = userCompleteds.Where(f => f.CompletedOn > f.SLAEndTime).Count();
                    var userLeaveInfo = leaveLogs?.FirstOrDefault(f => f.UserId == userId);

                    var durationTotal = userCompleteds.Where(s => s.CompletedOn.HasValue).Select(s => (s.CompletedOn - s.CreatedOn)?.TotalMinutes ?? 0).Sum();
                    var overdueCount = userTaskDatas.Where(f => f.CompletedOn > f.SLAEndTime).Count();
                    var avgDuration = durationTotal > 0 ? durationTotal / completedTaskCount : 0;
                    var _sla = completedTaskCount > 0 ? totalTaskCountOnTime / completedTaskCount : 0;

                    var _leavetype = leaveTypes.FirstOrDefault(f => f.Id + "" == userLeaveInfo?.LeaveTypeCode);
                    //item.TotalTaskCount = totalTaskList.Count;
                    //item.CompletedTaskCount = completedTaskList.Count;
                    //item.AvgDuration = completedTaskList.Count > 0 ? Math.Ceiling(completedTaskList.Average(a => a.Duration)) : 0;
                    //item.SLA = completedTaskList.Count > 0 ? totalTaskList.Count(a => a.IsOverdue == false) / completedTaskList.Count : 0;
                    //item.OverdueCount = totalTaskList.Count(a => a.IsOverdue);

                    teamEnquirys.Add(new TeamMemberEnquiryTaskResponse() { UserId = userLeaveInfo?.UserId ?? "", UserName = userLeaveInfo?.UserName ?? "", IsLeave = userLeaveInfo?.IsLeave, LeaveTypeNameEn = _leavetype?.NameAr, LeaveTypeNameAr = _leavetype?.NameAr, BriefDescription = userLeaveInfo?.BriefDescription, ExpectedReturnDate = userLeaveInfo?.ExpectedReturnDate, LeaveCreatedOn = userLeaveInfo?.CreatedOn, MaxWorkTaskCount = maxWorkTaskCount, TotalTaskCount = totalTaskCount, CompletedTaskCount = completedTaskCount, OverdueCount = overCompleteCount, AvgDuration = avgDuration, SLA = _sla });
                }
            }
            else
            {
                if (leaveLogs?.Any() ?? false)
                {
                    foreach (var userLeaveInfo in leaveLogs)
                    {
                        var _leavetype = leaveTypes.FirstOrDefault(f => f.Id + "" == userLeaveInfo?.LeaveTypeCode);
                        teamEnquirys.Add(new TeamMemberEnquiryTaskResponse() { UserId = userLeaveInfo?.UserId ?? "", UserName = userLeaveInfo?.UserName ?? "", IsLeave = userLeaveInfo?.IsLeave, LeaveTypeNameEn = _leavetype?.NameAr, LeaveTypeNameAr = _leavetype?.NameAr, BriefDescription = userLeaveInfo?.BriefDescription, ExpectedReturnDate = userLeaveInfo?.ExpectedReturnDate, LeaveCreatedOn = userLeaveInfo?.CreatedOn, MaxWorkTaskCount = maxWorkTaskCount });
                    }
                }
            }
            return teamEnquirys;
        }

        public async Task<List<DepartmentDto>?> GetDepartmentsAsync()
        {
            //var dics = new Dictionary<string, string>
            //{
            //    { "PageSize", "1000" },
            //    { "PageIndex", "1" }
            //};
            //var adminApi = _conf.GetSection("Services:AdminProtal").Value;
            //var userTeams = await _restClient.GetDataAsync<UMC.Utils.Framework.ApiResponse.ApiResponse<PageList<DepartmentDto>>>(adminApi, "api/Departments/Departments", queryData: dics, headerData: InternalApiHttpHeaders.FromConfiguration(_conf));
            //return userTeams?.Data?.Items?.ToList();

            return _queryable.GetQueryable<Department>().AsNoTracking().Select(s => new DepartmentDto(s.Id, s.NameEn, s.NameAr)).ToList();
        }


        private async Task<List<UserDepartLogsDto>?> GetUserDepartmentsLeavelogsAsync()
        {
            //var dics = new Dictionary<string, string>
            //{
            //    { "departmentId", (int)DeptEnum.HappinessCenter+"" },
            //};
            //var adminApi = _conf.GetSection("Services:AdminProtal").Value;
            //var userTeams = await _restClient.GetDataAsync<UMC.Utils.Framework.ApiResponse.ApiResponse<List<UserDepartLogsDto>>>(adminApi, "api/Team/{departmentId}/TeamUserLogs", pathData: dics);
            //return userTeams?.Data;
            var departmentId = (int)DeptEnum.HappinessCenter;
            return await this.GetUserDepartmentsLeavelogsAsync(departmentId);
        }

        /// <summary>
        /// Department members with their current duty status. Leave comes from
        /// Extensions.TeamMemberDutyStatusRecords — the table Team Management writes when a leader marks
        /// emergency leave / resume work — taking the latest row per user so only the current state
        /// counts. Pass <paramref name="activeOnly"/> = true for auto-assignment, where a deactivated
        /// account must never be picked; the team/dashboard callers keep the default so their rosters
        /// still list suspended members.
        /// </summary>
        private async Task<List<UserDepartLogsDto>?> GetUserDepartmentsLeavelogsAsync(int departmentId, bool activeOnly = false)
        {
            var userleavelogsQuery = from ud in _queryable.GetQueryable<UserDepartmentModel>()
                                     from u in _queryable.GetQueryable<UMC.AdminPortal.Domain.Models.AdminUser>().Where(w => w.Id == ud.UserId).DefaultIfEmpty()

                                     let duty = _queryable.GetQueryable<TeamMemberDutyStatusRecord>()
                                         .Where(d => d.DepartmentId == departmentId && d.UserId == ud.UserId)
                                         .OrderByDescending(d => d.CreatedOn)
                                         .ThenByDescending(d => d.Id)
                                         .FirstOrDefault()

                                     where ud.DepartmentId == departmentId && u.Id != null
                                           && (!activeOnly || u.IsActive)
                                     select new UserDepartLogsDto(ud.UserId, u.FirstName + " " + u.LastName, ud.DepartmentId, ud.IsMaster, ud.IsLeader,
                                         duty != null && duty.StatusType == TeamManagementConstants.DutyStatusEmergencyLeave,
                                         duty.LeaveReasonCode, duty.Notes, duty.ExpectedReturnDate, duty.CreatedOn);

            return await userleavelogsQuery.AsNoTracking().ToListAsync();
        }


        private async Task<List<UserDepartmentDto>?> GetTeamEnquiriesAsync(int departmentId)
        {
            //Dictionary<string, string> dics = new Dictionary<string, string>
            //{
            //    { "departmentId", departmentId+"" }
            //};

            //var adminApi = _conf.GetSection("Services:AdminProtal").Value;
            //var userTeams = await _restClient.GetDataAsync<UMC.Utils.Framework.ApiResponse.ApiResponse<List<UserDepartmentDto>>>(adminApi, "api/Departments/DepartmentUsers/{departmentId}", pathData: dics, headerData: InternalApiHttpHeaders.FromConfiguration(_conf));
            //return userTeams.Data;

            var useDepts = await _queryable.GetQueryable<UserDepartmentModel>().Where(w => w.DepartmentId == departmentId).ToListAsync();
            return useDepts.Select(s => new UserDepartmentDto(s.Id, s.UserId, s.DepartmentId, s.IsLeader)).ToList();

        }


        private async Task<List<UserDepartmentDto>?> GetUserIdDepartmentAsync(string userId)
        {
            //Dictionary<string, string> dics = new Dictionary<string, string>
            //{
            //    { "userId", userId+"" }
            //};

            //var adminApi = _conf.GetSection("Services:AdminProtal").Value;
            //var userTeams = await _restClient.GetDataAsync<UMC.Utils.Framework.ApiResponse.ApiResponse<List<UserDepartmentDto>>>(adminApi, "api/Departments/DepartmentUsers/UserDepartment", queryData: dics, headerData: InternalApiHttpHeaders.FromConfiguration(_conf));
            //return userTeams.Data;

            var useDepts = await _queryable.GetQueryable<UserDepartmentModel>().Where(w => w.UserId == userId).ToListAsync();
            return useDepts.Select(s => new UserDepartmentDto(s.Id, s.UserId, s.DepartmentId, s.IsLeader)).ToList();
        }

        /// <summary>
        /// Server-side guard mirroring the <c>CanChangeStatus</c> flag returned by the detail API.
        /// Only the current ticket handler (HandlerUserId) or a Happiness Center leader may change a ticket's status.
        /// Prevents non-handlers from bypassing the hidden frontend button by calling the API directly.
        /// </summary>
        private async Task EnsureCanChangeStatusAsync(Enquiry enquiry)
        {
            var currentUserId = _currentDomain.UserId;
            if (!string.IsNullOrEmpty(currentUserId) && currentUserId == enquiry.HandlerUserId) return;

            var userDepts = await this.GetUserIdDepartmentAsync(currentUserId ?? "");
            var isHappinessLeader = userDepts?.Any(d => d.DepartmentId == (int)DeptEnum.HappinessCenter && (d.IsLeader ?? false)) ?? false;
            if (isHappinessLeader) return;

            throw new BusinessException("You are not the handler of this ticket and cannot change its status.");
        }

        /// <summary>
        /// Resource-level guard for Process / Send Back. The ticket assignment is re-read from the
        /// database inside the action, so a business-department member who still has the ticket open
        /// after it was reopened and transferred elsewhere cannot act on it by calling the API directly.
        /// The [RequirePermission] attribute on the endpoint is role-wide and cannot express this.
        /// </summary>
        private async Task EnsureCanProcessTicketAsync(Enquiry enquiry)
        {
            var currentUserId = _currentDomain.UserId;
            if (string.IsNullOrWhiteSpace(currentUserId)) throw new BusinessException("Unauthorized access. Please log in.", null, 401);

            // Only a ticket sitting with a business department can be processed or sent back.
            if (enquiry.EnquiryStatusId != (short)EnquiryAdminStatus.DepartmentProcessing)
            {
                throw new BusinessException("This ticket is not awaiting department processing and cannot be processed.", null, 403);
            }

            var userDepts = await this.GetUserIdDepartmentAsync(currentUserId);

            // The caller must belong to the department that currently owns the ticket.
            var owningDept = userDepts?.Where(d => d.DepartmentId == enquiry.DepartmentId).ToList() ?? new List<UserDepartmentDto>();
            if (owningDept.Count == 0)
            {
                throw new BusinessException("You are not the current handler of this ticket and cannot process it.", null, 403);
            }

            // Within that department, either the assigned handler or a department leader may act.
            if (IsCurrentTicketHandler(enquiry.HandlerUserId)) return;
            if (owningDept.Any(d => d.IsLeader ?? false)) return;

            throw new BusinessException("You are not the current handler of this ticket and cannot process it.", null, 403);
        }

        /// <summary>
        /// Resource-level guard for the Reassign endpoint. Reassignment is a Customer Happiness leader
        /// action over their own team's active queue; the target must be a currently assignable member.
        /// Only the HTTP endpoint goes through this; the team-management services reassign through
        /// <see cref="SaveAssignUserAsync"/> under their own permissions.
        /// </summary>
        private async Task EnsureCanAssignTicketAsync(Enquiry enquiry, string? targetUserId)
        {
            var currentUserId = _currentDomain.UserId;
            if (string.IsNullOrWhiteSpace(currentUserId)) throw new BusinessException("Unauthorized access. Please log in.", null, 401);

            var userDepts = await this.GetUserIdDepartmentAsync(currentUserId);
            var isHappinessLeader = userDepts?.Any(d => d.DepartmentId == (int)DeptEnum.HappinessCenter && (d.IsLeader ?? false)) ?? false;
            if (!isHappinessLeader)
            {
                throw new BusinessException("Only a Customer Happiness leader can reassign a ticket.", null, 403);
            }

            // The Happiness Center owns a ticket until it is resolved; after that there is nothing to reassign.
            if (enquiry.EnquiryStatusId >= (short)EnquiryAdminStatus.Resolved)
            {
                throw new BusinessException("This ticket is already closed and cannot be reassigned.", null, 403);
            }

            // Team scope: the ticket must carry a Happiness Center ownership slot (ManangerUserId) or
            // still sit in the Happiness Center queue. Anything else is not this leader's to hand out.
            if (string.IsNullOrWhiteSpace(enquiry.ManangerUserId) && enquiry.DepartmentId != (int)DeptEnum.HappinessCenter)
            {
                throw new BusinessException("This ticket does not belong to your team and cannot be reassigned.", null, 403);
            }

            if (string.IsNullOrWhiteSpace(targetUserId))
            {
                throw new BusinessException("Please select a team member to assign this ticket to.", null, 400);
            }

            var assignableUsers = await this.GetCurtormerAssignUserAsync();
            if (!assignableUsers.Any(u => u.UserId == targetUserId))
            {
                throw new BusinessException("The selected user is not an assignable member of your team.", null, 403);
            }
        }

        private string EnquirySLaTime(DateTime SLAStartTime, DateTime SLAEndTime)
        {
            var isAr = _currentDomain?.IsArabicLanguage ?? false;
            var slaTimeSpan = SLAEndTime - SLAStartTime;
            if (slaTimeSpan.TotalMinutes > 0)
            {
                if (slaTimeSpan.Days > 0)
                {
                    return isAr ? $"متبقي {slaTimeSpan.Days} يوم" : $"Due in {slaTimeSpan.Days}d";
                }
                else if (slaTimeSpan.Hours > 0)
                {
                    return isAr ? $"متبقي {slaTimeSpan.Hours} ساعة" : $"Due in {slaTimeSpan.Hours}h";
                }
                else if (slaTimeSpan.Minutes > 0)
                {
                    return isAr ? $"متبقي {slaTimeSpan.Minutes} دقيقة" : $"Due in {slaTimeSpan.Minutes}min";
                }

            }
            else
            {
                if (Math.Abs(slaTimeSpan.Days) > 0)
                {
                    return isAr ? $"متأخر {Math.Abs(slaTimeSpan.Days)} يوم" : $"{Math.Abs(slaTimeSpan.Days)}d Overdue";
                }
                else if (Math.Abs(slaTimeSpan.Hours) > 0)
                {
                    return isAr ? $"متأخر {Math.Abs(slaTimeSpan.Hours)} ساعة" : $"{Math.Abs(slaTimeSpan.Hours)}h Overdue";
                }
                else if (Math.Abs(slaTimeSpan.Minutes) > 0)
                {
                    return isAr ? $"متأخر {Math.Abs(slaTimeSpan.Minutes)} دقيقة" : $"{Math.Abs(slaTimeSpan.Minutes)}min Overdue";
                }
            }

            return slaTimeSpan.TotalMinutes >= 0 
                ? (isAr ? "متبقي 1 دقيقة" : "Due in 1min")
                : (isAr ? "متأخر 1 دقيقة" : "1min Overdue");
        }

        public async Task<List<EnquiryUserObjDto>> GetEnquiryCustomerInfosAsync(params int[] enquiryIds)
        {
            var custormerInfos = await domainEnq.GetEnquiryCustomerInfoAsync(enquiryIds);
            if (custormerInfos != null && custormerInfos.Count() > 0)
            {
                var _userTypeCodes = custormerInfos.Where(c => !string.IsNullOrWhiteSpace(c.UserTypeCode)).Select(s => s.UserTypeCode).Distinct().ToList();
                var _userTypes = await domainEnq.GetEnquiryUserTypeByCodeAsync(_userTypeCodes.ToArray());
                return custormerInfos.Select(s => new EnquiryUserObjDto(s.EnquiryId, s.FullName, s.FullName, _userTypes.FirstOrDefault(ut => ut.Code == s.UserTypeCode)?.Id, s.UserTypeCode, null)).ToList();
            }
            return new List<EnquiryUserObjDto>();
        }


        public async Task<EnquiryAdminCountDto> EnquiryAdminStatusCountAync(bool? isTeamTask = false)
        {
            var teamTaskScope = (isTeamTask ?? false)
                ? await BuildDepartmentTeamTaskScopeAsync()
                : null;

            var data = await domainEnq.EnquiryStatusCountAync(_currentDomain.UserId ?? "", isTeamTask ?? false, false, teamTaskScope);
            data.TryGetValue((short)EnquiryAdminStatus.Open, out int openCount);
            data.TryGetValue((short)EnquiryAdminStatus.PendingCustomer, out int pendingCustomerCount);
            data.TryGetValue((short)EnquiryAdminStatus.DepartmentProcessing, out int departmentProcessingCount);
            data.TryGetValue((short)EnquiryAdminStatus.DepartmentProcessed, out int departmentProcessedCount);
            data.TryGetValue((short)EnquiryAdminStatus.Resolved, out int resolvedProcessedrCount);

            data.TryGetValue((short)EnquiryAdminStatus.Cancelled, out int cancelledCount);
            data.TryGetValue((short)EnquiryAdminStatus.Completed, out int completedCount);

            var reOpenCount = await EnquiryAdminReOpenStatusCountAync(isTeamTask, _currentDomain.UserId ?? "", teamTaskScope);

            var totalCount = data.Sum(s => s.Value);
            return new EnquiryAdminCountDto(openCount, pendingCustomerCount, departmentProcessingCount, departmentProcessedCount, resolvedProcessedrCount, completedCount, cancelledCount, totalCount, reOpenCount);
        }

        private async Task<int> EnquiryAdminReOpenStatusCountAync(bool? isTeamTask = false, string? _userId = null, Expression<Func<Enquiry, bool>>? teamTaskScope = null)
        {

            var query = _queryable.GetQueryable<Enquiry>();
            var reopenedEnquiryIds = GetReopenedEnquiryIdsQuery(_queryable.GetQueryable<EnquiryStatusTracking>());

            if ((isTeamTask ?? false) && teamTaskScope != null)
            {
                query = query.Where(teamTaskScope);
            }

            if (!isTeamTask ?? false)
            {
                if (!string.IsNullOrWhiteSpace(_userId))
                {
                    var trianckingQuery = GetQueryableTrancking(_userId ?? "");
                    query = query.Where(o => o.HandlerUserId == _userId || o.ManangerUserId == _userId || trianckingQuery.Contains(o.Id));
                }

                //if (_profileId > 0)
                //{
                //    query.Where(o => o.UserProfileId == _profileId);
                //}
            }
            query = query.Where(en => reopenedEnquiryIds.Contains(en.Id));
            return await query.CountAsync();

        }

        /// <summary>
        /// admin account manager reopen count
        /// </summary>
        /// <param name="_userId"></param>
        /// <param name="_profileId"></param>
        /// <returns></returns>
        private async Task<int> EnquiryAdminAccountManagerReOpenStatusCountAync(string? _userId = null, int? _profileId = null)
        {
            if (string.IsNullOrWhiteSpace(_userId) || ((_profileId ?? 0) <= 0)) return 0;
            var query = _queryable.GetQueryable<Enquiry>();
            var resolvedEnquiryIds = _queryable.GetQueryable<EnquiryStatusTracking>()
                .Where(w => w.FromStatusId == (int)EnquiryAdminStatus.Resolved)
                .Select(s => s.EnquiryId);

            query = query.Where(en => resolvedEnquiryIds.Contains(en.Id));

            var trianckingQuery = _queryable.GetQueryable<EnquiryStatusTracking>().Where(f => f.CreatedBy == _userId).Select(s => s.EnquiryId).Distinct();
            if (!string.IsNullOrWhiteSpace(_userId))
            {
                query.Where(o => o.HandlerUserId == _userId || trianckingQuery.Contains(o.Id));
            }

            if (_profileId > 0)
            {
                query.Where(o => o.UserProfileId == _profileId);
            }

            return await query.CountAsync();

        }

        public async Task<EnquiryAdminCountDto> EnquiryAdminStatusAccountManagementCountAync(string? _userId, int? _profileId)
        {

            var data = await domainEnq.EnquiryStatusCountUserProfileAync(_userId, _profileId);
            data.TryGetValue((short)EnquiryAdminStatus.Open, out int openCount);
            data.TryGetValue((short)EnquiryAdminStatus.PendingCustomer, out int pendingCustomerCount);
            data.TryGetValue((short)EnquiryAdminStatus.DepartmentProcessing, out int departmentProcessingCount);
            data.TryGetValue((short)EnquiryAdminStatus.DepartmentProcessed, out int departmentProcessedCount);
            data.TryGetValue((short)EnquiryAdminStatus.Resolved, out int resolvedProcessedrCount);

            data.TryGetValue((short)EnquiryAdminStatus.Cancelled, out int cancelledCount);
            data.TryGetValue((short)EnquiryAdminStatus.Completed, out int completedCount);

            var reOpenTimes = await EnquiryAdminAccountReOpenStatusCountAync(_userId, _profileId);

            var totalCount = data.Sum(s => s.Value);
            return new EnquiryAdminCountDto(openCount, pendingCustomerCount, departmentProcessingCount, departmentProcessedCount, resolvedProcessedrCount, completedCount, cancelledCount, totalCount, reOpenTimes);
        }

        private async Task<int> EnquiryAdminAccountReOpenStatusCountAync(string? _userId = null, int? _profileId = null)
        {

            var query = _queryable.GetQueryable<Enquiry>();
            var resolvedEnquiryIds = _queryable.GetQueryable<EnquiryStatusTracking>()
                .Where(w => w.FromStatusId == (int)EnquiryAdminStatus.Resolved && w.ToStatusId < (int)EnquiryAdminStatus.Resolved)
                .Select(s => s.EnquiryId);


            if (!string.IsNullOrWhiteSpace(_userId))
            {

                query = query.Where(o => o.CreatedBy == _userId);
            }

            if (_profileId > 0)
            {
                query = query.Where(o => o.UserProfileId == _profileId);
            }

            //if (_profileId > 0)
            //{
            //    query.Where(o => o.UserProfileId == _profileId);
            //}

            query = query.Where(en => resolvedEnquiryIds.Contains(en.Id));
            return await query.CountAsync();

        }

        /// <summary>
        /// Single definition of "the signed-in admin is this ticket's current handler", shared by the
        /// list, team-task and detail endpoints so the same ticket never reports two different values.
        /// </summary>
        private bool IsCurrentTicketHandler(string? handlerUserId)
        {
            var currentUserId = _currentDomain.UserId;
            return !string.IsNullOrEmpty(currentUserId) && currentUserId == handlerUserId;
        }

        /// <summary>
        /// True when the conversation row belongs to the Customer &lt;-&gt; Customer Happiness thread
        /// (a customer message, or a Customer Happiness reply to the customer). A missing SourceTypeId
        /// is a legacy customer message, which is how the rest of the service reads it too.
        /// </summary>
        private static bool IsCustomerFacingConversation(int? sourceTypeId)
        {
            var source = sourceTypeId ?? (short)EnquiryConversationSource.CustomerPortal;
            return source == (short)EnquiryConversationSource.CustomerPortal
                || source == (short)EnquiryConversationSource.CustomerHappness;
        }

        public async Task<EnquiryResponseValueObjAdminDto?> GetEnquiryAdminByIdAsync(int id)
        {
            var enquiry = await domainEnq.GetEnquiryByIdAsync(id);
            var isArabic = _currentDomain.IsArabicLanguage;
            var _currentUserId = _currentDomain.UserId;

            if (enquiry != null)
            {
                var typeObj = new EnquiryTypeDto();

                var priorityTypes = await domainEnq.GetEnquiryPrioritiesAsync();
                var types = await domainEnq.GetEnquiryTypesAsync(typeObj.EnquiryType, typeObj.EnquirySource, typeObj.EnquiryStatus, typeObj.EnquiryIssueCategory, typeObj.EnquiryAdminStatus, typeObj.EnquiryPriorityType, typeObj.EnquiryPlatform);
                var enquiryType = types.FirstOrDefault(t => t.Scope == typeObj.EnquiryType && Convert.ToInt16(t.Code) == enquiry.EnquiryTypeId);
                var enquirySource = types.FirstOrDefault(t => t.Scope == typeObj.EnquirySource && Convert.ToInt16(t.Code) == enquiry.EnquirySourceId);
                var enquiryAdminStatus = types.FirstOrDefault(t => t.Scope == typeObj.EnquiryAdminStatus && Convert.ToInt16(t.Code) == enquiry.EnquiryStatusId);
                var enquiryIssueCategory = types.FirstOrDefault(t => t.Scope == typeObj.EnquiryIssueCategory && Convert.ToInt16(t.Code) == enquiry.IssueCategoryId);
                var enquiryPriorityType = priorityTypes.FirstOrDefault(t => Convert.ToInt16(t.Id) == enquiry.PriorityId);

                var services = await domainEnq.GetServiceConfigsAsync();

                var userDepts = await this.GetUserIdDepartmentAsync(_currentUserId ?? "");
                var isHappinessTeam = userDepts?.Select(d => d.DepartmentId ?? 0).Contains((int)DeptEnum.HappinessCenter) ?? false;

                // 
                var queryConversation = from con in _queryable.GetQueryable<EnquiryConversation>()
                                        from up in _queryable.GetQueryable<UserProfile>().Where(w => w.Id == con.UserProfileId).DefaultIfEmpty()
                                        from person in _queryable.GetQueryable<Person>().Where(w => w.Id == up.PersonId).DefaultIfEmpty()
                                        from um in _queryable.GetQueryable<UserEstablishment>().Where(w => w.UserProfileId == con.UserProfileId).DefaultIfEmpty()
                                        from e in _queryable.GetQueryable<Establishment>().Where(w => w.Id == um.EstablishmentId).DefaultIfEmpty()
                                        from adminUser in _queryable.GetQueryable<AdminUser>().Where(w => w.Id == con.CreatedBy).DefaultIfEmpty()

                                        where con.EnquiryId == id
                                        orderby con.CreatedOn ascending
                                        select new
                                        {
                                            con.MessageContent,
                                            con.AttachmentUrl1,
                                            con.AttachmentUrl2,
                                            con.AttachmentUrl3, //(new string[] { con.AttachmentUrl1 , con.AttachmentUrl2 ?? "", con.AttachmentUrl3 ?? "" }).Where(x => !string.IsNullOrEmpty(x)).ToArray(),
                                            UserName = adminUser != null ? adminUser.UserName : ((int?)up.UserTypeId == 1
                                                ? (isArabic ? (person.NameAr ?? person.Name) : person.Name)
                                                : (isArabic ? (e.NameAr ?? e.NameEn) : e.NameEn)),
                                            PhotoUrl = (string?)adminUser.PersonalPhotoUrl == null ? ((int?)up.UserTypeId == 1 ? person.PhotoUrl : null) : (string?)adminUser.PersonalPhotoUrl,
                                            adminUser.PersonalPhotoUrl,
                                            UserTypeId = (int?)up.UserTypeId,
                                            con.CreatedBy,
                                            con.CreatedOn,
                                            con.UserProfileId,
                                            con.SourceTypeId,
                                            con.ProblemCauseId,
                                            con.TransferDepartmentId,
                                            con.CurrentDepartmentId,
                                            con.DepartmentDeadLine,
                                            con.IsRead
                                        };

                var deps = await this.GetDepartmentsAsync();
                var qconversations = await queryConversation.AsNoTracking().ToListAsync();

                // The Customer <-> Customer Happiness thread is client-service correspondence: a business
                // department (Content / Licensing / ...) only handles the transfer notes, internal notes and
                // its own processing records. Dropping the whole row - not just hiding it on screen - keeps
                // the message body, attachment keys and the customer/agent identity out of the response.
                if (!isHappinessTeam)
                {
                    qconversations = qconversations
                        .Where(s => !IsCustomerFacingConversation(s.SourceTypeId))
                        .ToList();
                }

                //var probleCases = await this.GetDeptProblemCausesAsync(qconversations?.FirstOrDefault()?.CurrentDepartmentId ?? 0);
                //var probleCaseObj = probleCases.Where(f => f.Id == qconversations?.FirstOrDefault()?.ProblemCauseId).Select(s => new ValueObj(s.Id, s.NameEn, s.NameAr)).FirstOrDefault();

                var deptIds = qconversations.Where(s => s.ProblemCauseId > 0 && s.CurrentDepartmentId > 0).Select(s => s.CurrentDepartmentId ?? 0).Distinct().ToList();
                var problemCauseDict = new Dictionary<int, List<EnquiryTypeObjDto>>();
                if (deptIds.Count > 0)
                {
                    problemCauseDict = await GetDeptProblemCausesByDeptIdsAsync(deptIds.ToArray());
                }

                var enquiryConversationDetails = qconversations.Select(s =>
                    {
                        var probleCaseTypes = problemCauseDict.TryGetValue(s.CurrentDepartmentId ?? 0, out var problemCauses);
                        ValueObj? probleCaseObj = null;
                        if (probleCaseTypes && (problemCauses?.Any() ?? false))
                        {
                            probleCaseObj = problemCauses.Where(f => f.Id == s.ProblemCauseId).Select(pc => new ValueObj(pc.Id, pc.NameEn, pc.NameAr)).FirstOrDefault();
                        }

                        return new EnquiryConversationDetailDto(s.MessageContent, (new string[] { s.AttachmentUrl1, s.AttachmentUrl2, s.AttachmentUrl3 }).Where(s => !s.IsNullOrEmpty()).ToArray(), s.UserName, s.CreatedBy, s.CreatedOn, s.UserTypeId, s.UserProfileId, null, s.PhotoUrl, s.IsRead, s.SourceTypeId, s.DepartmentDeadLine, new ValueObj(deps?.FirstOrDefault(f => f.Id == s.CurrentDepartmentId)?.Id ?? 0, deps?.FirstOrDefault(f => f.Id == s.CurrentDepartmentId)?.NameEn, deps?.FirstOrDefault(f => f.Id == s.CurrentDepartmentId)?.NameAr), new ValueObj(deps?.FirstOrDefault(f => f.Id == s.TransferDepartmentId)?.Id ?? 0, deps?.FirstOrDefault(f => f.Id == s.TransferDepartmentId)?.NameEn, deps?.FirstOrDefault(f => f.Id == s.TransferDepartmentId)?.NameAr), s.ProblemCauseId, probleCaseObj);
                    }
                ).ToList();

                // service
                var quearySvc = from enq in _queryable.GetQueryable<Enquiry>()
                                from enq2 in _queryable.GetQueryable<Enquiry>().Where(f => f.CreatedBy == enq.CreatedBy && f.ServiceId == enq.ServiceId).DefaultIfEmpty()
                                from ser in _queryable.GetQueryable<ServiceConfig>().Where(s => s.Id == enq2.ServiceId).DefaultIfEmpty()
                                where enq.Id == id && enq.ServiceId > 0 && ser.Id > 0
                                orderby enq2.CreatedOn descending
                                select new { enq2.Id, enq2.EnquiryTypeId, enq2.ApplicationDetailId, enq2.EnquiryStatusId, ServiceId = ser.Id, ser.NameEn, ser.NameAr, enq2.CreatedOn, enq2.EnquiryNumber, enq2.Description };

                var quearySrcs = await quearySvc.AsNoTracking().ToListAsync();

                var currentEnquiry = quearySvc.FirstOrDefault(f => f.Id == id);

                quearySrcs = quearySrcs.Where(w => w.Id != id && ((w.ApplicationDetailId > 0 && w.ApplicationDetailId == currentEnquiry?.ApplicationDetailId) || (w.ServiceId == currentEnquiry.ServiceId && w.EnquiryTypeId == currentEnquiry?.EnquiryTypeId))).ToList();

                var appServices = quearySrcs.Select(s =>
                {
                    var enquiryStatus = types.FirstOrDefault(t => t.Scope == typeObj.EnquiryAdminStatus && Convert.ToInt16(t.Code) == s.EnquiryStatusId);
                    return new EnquiryServiceDto(s.Id, s.EnquiryNumber, s.EnquiryStatusId, s.CreatedOn, new ValueObj(enquiryStatus?.Id ?? 0, enquiryStatus?.NameEn, enquiryStatus?.NameAr), s.ServiceId, new ValueObj(s.ServiceId, s.NameEn, s.NameAr), s.Description);
                }).ToList() ?? new List<EnquiryServiceDto>();

                var trackings = (await domainEnq.GetEnquiryStatusTrackingAsync(id)).Distinct().OrderByDescending(s => s.CreatedOn).Take(3).ToList();

                List<string?> attachments = new List<string?>() { enquiry?.AttachementUrl, enquiry?.AttachementUrl2, enquiry?.AttachementUrl3 };
                attachments = attachments.Where(x => !x.IsNullOrEmpty()).ToList();

                var applicationDic = await domainEnq.GetApplicationNoAsync(enquiry?.ApplicationDetailId ?? 0);

                var _applincationNo = (enquiry.ApplicationDetailId > 0 && applicationDic.TryGetValue(enquiry.ApplicationDetailId ?? 0, out string? applincationNo)) ? applincationNo : "";

                string? sla = null;
                bool? isOverDue = false;
                if (isHappinessTeam)
                {
                    if (enquiry.SLAEndTime.HasValue && enquiry.EnquiryStatusId < (short)EnquiryAdminStatus.Resolved)
                    {
                        sla = EnquirySLaTime(DateTime.UtcNow.AddHours(4), enquiry.SLAEndTime.Value);
                    }
                    if (DateTime.UtcNow.AddHours(4) > enquiry.SLAEndTime)
                    {
                        isOverDue = true;
                    }
                    if (enquiry.EnquiryStatusId >= (short)EnquiryAdminStatus.Resolved)
                    {

                        var isArSla = _currentDomain?.IsArabicLanguage ?? false;
                        if (DateTime.UtcNow.AddHours(4) <= enquiry.SLAEndTime) sla = isArSla ? "في الوقت المحدد" : "On Time";
                        else sla = isArSla ? "تجاوز الوقت" : "Exceeded";

                        isOverDue = null;
                    }


                }
                else
                {
                    if (enquiry.DepartmentDeadLine.HasValue && enquiry.EnquiryStatusId == (short)EnquiryAdminStatus.DepartmentProcessing)
                    {
                        sla = EnquirySLaTime(DateTime.UtcNow.AddHours(4), enquiry.DepartmentDeadLine.Value);
                    }
                    if (DateTime.UtcNow.AddHours(4) > enquiry.DepartmentDeadLine)
                    {
                        isOverDue = true;
                    }
                    if (enquiry.EnquiryStatusId != (short)EnquiryAdminStatus.DepartmentProcessing || (enquiry.EnquiryStatusId == (short)EnquiryAdminStatus.DepartmentProcessing && enquiry.HandlerUserId != _currentUserId))
                    {

                        var isArSla = _currentDomain?.IsArabicLanguage ?? false;
                        if (DateTime.UtcNow.AddHours(4) <= enquiry.SLAEndTime) sla = isArSla ? "في الوقت المحدد" : "On Time";
                        else sla = isArSla ? "تجاوز الوقت" : "Exceeded";

                        isOverDue = null;
                    }


                }

                var replyMessages = enquiryConversationDetails.Where(f => f.IsRead == false && f.SurceTypeId == (short)EnquiryConversationSource.CustomerPortal);
                if (replyMessages.Any())
                {
                    await EnquiryCustomerPortalMessgeReadAsync(enquiry!.Id);
                }

                var handUsers = await this.GetEnquiryAdminUsersListAsync(enquiry.CreatedBy);
                EnquiryUserObjDto? enquiryUserObj = null;
                if (enquiry.UserProfileId > 0) enquiryUserObj = handUsers.FirstOrDefault(f => f.UserProfileId == enquiry.UserProfileId);
                else enquiryUserObj = handUsers.FirstOrDefault(f => f.UserTypeId == (short)UserTypeCode.Individual);
                var userInfo = await iUser.GetUserInfoByUserID(enquiry.CreatedBy);
                var IsCustormer = userInfo == null ? 0 : 1;

                int? appUserProfileId = IsCustormer == 1 ? enquiry.UserProfileId : null;
                if (IsCustormer == 0 && enquiry.ApplicationDetailId > 0)
                {
                    appUserProfileId = await (
                        from detail in _queryable.GetQueryable<ApplicationDetailModel>()
                        join app in _queryable.GetQueryable<ApplicationModel>() on detail.ApplicationId equals app.Id
                        where detail.Id == enquiry.ApplicationDetailId
                        select (int?)app.ProfileId
                    ).FirstOrDefaultAsync();
                }

                var enquiryCustomerInfo = (await domainEnq.GetEnquiryCustomerInfoAsync(enquiry.Id)).FirstOrDefault();
                var enquiryCustomerInfoDto = enquiryCustomerInfo == null
                    ? null
                    : new EnquiryCustomerInfoDto(
                        enquiryCustomerInfo.Id,
                        enquiryCustomerInfo.EnquiryId,
                        enquiryCustomerInfo.UserTypeCode,
                        enquiryCustomerInfo.FullName,
                        enquiryCustomerInfo.Email,
                        ContactNumberHelper.Compose(enquiryCustomerInfo.MobileCountryCode, enquiryCustomerInfo.MobileLocalNumber, enquiryCustomerInfo.MobileNumber),
                        enquiryCustomerInfo.CreatedBy,
                        enquiryCustomerInfo.CreatedOn,
                        enquiryCustomerInfo.MobileCountryCode,
                        enquiryCustomerInfo.MobileLocalNumber);

                // Only the current ticket handler (HandlerUserId) or a Happiness Center leader may change status.
                // Surfaced to the frontend so the "Change Status" button is hidden for everyone else.
                var isCurrentUserHandler = IsCurrentTicketHandler(enquiry.HandlerUserId);
                var isHappinessLeader = userDepts?.Any(d => d.DepartmentId == (int)DeptEnum.HappinessCenter && (d.IsLeader ?? false)) ?? false;
                var canChangeStatus = isCurrentUserHandler || isHappinessLeader;
                // Customer-visible replies belong to the assigned Customer Happiness handler; a Happiness Center leader may also reply.
                var isCanMessage = CanSendCustomerVisibleMessage(enquiry.ManangerUserId, _currentUserId, isHappinessLeader);
                var canAddInternalNote = CanAddInternalNote(enquiry, _currentUserId, isHappinessTeam, GetLeaderDepartmentIds(userDepts));

                // Reopen count, owning department, current handler and unread-message count are resolved
                // exactly the way the list endpoints resolve them; the detail response used to hard-code
                // null for all four, so the same ticket described itself differently in list and detail.
                var reOpenTimes = (await domainEnq.GetEnquiryReOpentDataAsync(new int[] { enquiry.Id })).FirstOrDefault().ReOpenTimes;
                var customerName = enquiryCustomerInfoDto?.FullName ?? enquiryUserObj?.NameEn;
                var handlerNames = await GetAdminDisplayNamesAsync(
                    new[] { enquiry.HandlerUserId, enquiry.ManangerUserId }.Where(userId => !string.IsNullOrWhiteSpace(userId)).Cast<string>().ToArray());
                var currentHandlerName = !string.IsNullOrWhiteSpace(enquiry.HandlerUserId) && handlerNames.TryGetValue(enquiry.HandlerUserId, out var resolvedHandlerName)
                    ? resolvedHandlerName
                    : "";
                var agentName = !string.IsNullOrWhiteSpace(enquiry.ManangerUserId) && handlerNames.TryGetValue(enquiry.ManangerUserId, out var resolvedAgentName)
                    ? resolvedAgentName
                    : null;
                // While the ticket waits on the customer the "current handler" column shows the customer.
                if (enquiry.EnquiryStatusId == (short)EnquiryAdminStatus.PendingCustomer) currentHandlerName = customerName;
                var detailMessageCount = (await this.GetEnquiryCustomerMessageCountByIdAsync(new int[] { enquiry.Id })).TryGetValue(enquiry.Id, out var _detailMessageCount) ? _detailMessageCount : 0;

                ValueObj? detailDeptObj = null;
                if (enquiry.DepartmentId.HasValue)
                {
                    var currentDept = deps?.FirstOrDefault(f => f.Id == enquiry.DepartmentId);
                    detailDeptObj = new ValueObj(enquiry.DepartmentId ?? 0, currentDept?.NameEn ?? "", currentDept?.NameAr ?? "");
                    if (enquiry.EnquiryStatusId == (short)EnquiryAdminStatus.PendingCustomer) detailDeptObj = new ValueObj(0, "Curstomer");
                }

                var enquiryMap = new EnquiryResponseAdminDto(enquiry.Id, enquiry.EnquiryNumber, _applincationNo, enquiry.EnquiryTypeId, enquiry.EnquirySourceId, enquiry.ServiceId, enquiry.CreatedOn, enquiry.UpdatedOn, enquiry.EnquiryStatusId, enquiry.AttachementUrl, reOpenTimes, enquiry.Description, customerName, sla, currentHandlerName, agentName, enquiry.IssueCategoryId, enquiry.PriorityId, enquiry.UserProfileId, enquiryUserObj?.IsVip, enquiry.CreatedBy, IsCustormer, enquiry.DepartmentId, detailMessageCount, isOverDue, enquiry.SLAEndTime, AppUserProfileId: appUserProfileId)
                { PlatformId = enquiry.PlatformId, CanChangeStatus = canChangeStatus, IsCurrentHandler = isCurrentUserHandler, IsLeader = isHappinessLeader, IsCanMessage = isCanMessage, CanAddInternalNote = canAddInternalNote };
                return new EnquiryResponseValueObjAdminDto(
                          new ValueObj(Convert.ToInt16(enquiryType?.Code ?? "0"), enquiryType?.NameEn ?? "", enquiryType?.NameAr ?? ""),
                          new ValueObj(enquiry.ServiceId ?? 0, services?.FirstOrDefault(f => f.Id == enquiry.ServiceId)?.NameEn, services?.FirstOrDefault(f => f.Id == enquiry.ServiceId)?.NameAr),
                          new ValueObj(Convert.ToInt16(enquiryAdminStatus?.Code ?? "0"), enquiryAdminStatus?.NameEn ?? "", enquiryAdminStatus?.NameAr ?? ""),
                          new ValueObj(Convert.ToInt16(enquirySource?.Code ?? "0"), enquirySource?.NameEn ?? "", enquirySource?.NameAr ?? ""),
                          new ValueObj(Convert.ToInt16(enquiryIssueCategory?.Code ?? "0"), enquiryIssueCategory?.NameEn ?? "", enquiryIssueCategory?.NameAr ?? ""),
                          enquiryMap,
                          enquiryConversationDetails,
                          appServices,
                          attachments,
                          enquiryUserObj,
                          detailDeptObj,
                          new ValueObj(Convert.ToInt16(enquiryPriorityType?.Code ?? "0"), enquiryPriorityType?.NameEn ?? "", enquiryPriorityType?.NameAr ?? ""),
                          enquiryCustomerInfoDto

                          )
                { PlatformObj = BuildPlatformObj(types.FirstOrDefault(t => t.Scope == typeObj.EnquiryPlatform && t.Code == enquiry.PlatformId)), IsCurrentHandler = isCurrentUserHandler, IsLeader = isHappinessLeader, IsCanMessage = isCanMessage, CanAddInternalNote = canAddInternalNote };
            }

            return default(EnquiryResponseValueObjAdminDto);
        }

        /// <summary>
        /// Builds the platform <see cref="ValueObj"/> from its TypeDictionary (Scope='Platform') entry.
        /// English name only; no Arabic conversion is applied.
        /// </summary>
        private static ValueObj? BuildPlatformObj(TypeDictionary? platformType)
        {
            if (platformType == null) return null;

            var id = int.TryParse(platformType.Code, out var code) ? code : (int?)null;
            return new ValueObj(id, platformType.NameEn);
        }

        private async Task<List<EnquiryServiceDto>> GetEnquiryServiceInfosAsync(int enquiryid, int? profileId, List<TypeDictionary> statusTypes, bool currentEnquiryOnly = false)
        {
            var hasProfile = profileId.HasValue && profileId.Value > 0;
            if (!currentEnquiryOnly && !hasProfile)
            {
                return new List<EnquiryServiceDto>();
            }

            var relatedApplicationDetailIds = currentEnquiryOnly || !hasProfile
                ? Enumerable.Empty<int>().AsQueryable()
                : domainEnq.GetEnquiryApplicatonByProfileQuery(profileId.Value);

            var quearySvc = from enq in _queryable.GetQueryable<Enquiry>()
                            from ser in _queryable.GetQueryable<ServiceConfig>().Where(s => s.Id == enq.ServiceId).DefaultIfEmpty()
                            where enq.Id == enquiryid
                                || (!currentEnquiryOnly && hasProfile && (enq.UserProfileId == profileId || relatedApplicationDetailIds.Contains(enq.ApplicationDetailId ?? 0)))
                            orderby enq.CreatedOn descending
                            select new { enq.Id, enq.EnquiryTypeId, enq.ApplicationDetailId, enq.EnquiryStatusId, ServiceId = (short?)ser.Id, ser.NameEn, ser.NameAr, enq.CreatedOn, enq.EnquiryNumber, enq.Description };

            var quearySrcs = await quearySvc.AsNoTracking().ToListAsync();

            var appServices = quearySrcs.Select(s =>
            {
                var enquiryStatus = statusTypes.FirstOrDefault(t => Convert.ToInt16(t.Code) == s.EnquiryStatusId);
                return new EnquiryServiceDto(s.Id, s.EnquiryNumber, s.EnquiryStatusId, s.CreatedOn, new ValueObj(enquiryStatus?.Id ?? 0, enquiryStatus?.NameEn, enquiryStatus?.NameAr), s.ServiceId, new ValueObj(s.ServiceId, s.NameEn, s.NameAr), s.Description);
            }).ToList() ?? new List<EnquiryServiceDto>();

            return appServices;

        }


        private async Task<List<EnquiryServiceDto>> GetEnquiryServiceInfosBySourceAsync(Enquiry enquirySource, int? profileId, List<TypeDictionary> statusTypes) 
        {
            var enquirySources = from enq in _queryable.GetQueryable<Enquiry>()
                            from ser in _queryable.GetQueryable<ServiceConfig>().Where(s => s.Id == enq.ServiceId).DefaultIfEmpty()
                            where enq.UserProfileId == profileId && enq.CreatedOn >= DateTimeHelper.Now.AddDays(-15) && enq.Id != enquirySource.Id
                            &&( enq.ApplicationDetailId== enquirySource.ApplicationDetailId || (enq.ServiceId==enquirySource.ServiceId && enq.EnquiryTypeId== enquirySource.EnquiryTypeId))
                            orderby enq.CreatedOn descending
                            select new { enq.Id, enq.EnquiryTypeId, enq.ApplicationDetailId, enq.EnquiryStatusId, ServiceId = (short?)ser.Id, ser.NameEn, ser.NameAr, enq.CreatedOn, enq.EnquiryNumber, enq.Description }
                            ;

            var quearySrcs=  await enquirySources.AsNoTracking().ToListAsync();

            var appServices = quearySrcs.Select(s =>
            {
                var enquiryStatus = statusTypes.FirstOrDefault(t => Convert.ToInt16(t.Code) == s.EnquiryStatusId);
                return new EnquiryServiceDto(s.Id, s.EnquiryNumber, s.EnquiryStatusId, s.CreatedOn, new ValueObj(enquiryStatus?.Id ?? 0, enquiryStatus?.NameEn, enquiryStatus?.NameAr), s.ServiceId, new ValueObj(s.ServiceId, s.NameEn, s.NameAr), s.Description);
            }).ToList() ?? new List<EnquiryServiceDto>();

            return appServices;


        }

        private async Task<(int? ProfileId, short? UserTypeId, bool CurrentEnquiryOnly)> ResolveEnquiryRelatedProfileAsync(Enquiry enquiry)
        {
            var isCustomerCreated = await _queryable.GetQueryable<User>()
                .AnyAsync(user => user.Id == enquiry.CreatedBy);

            int? resolvedProfileId = null;
            if (isCustomerCreated)
            {
                resolvedProfileId = enquiry.UserProfileId > 0 ? enquiry.UserProfileId : null;
            }
            else if ((enquiry.ApplicationDetailId ?? 0) > 0)
            {
                resolvedProfileId = await (
                    from detail in _queryable.GetQueryable<ApplicationDetailModel>()
                    join app in _queryable.GetQueryable<ApplicationModel>() on detail.ApplicationId equals app.Id
                    where detail.Id == enquiry.ApplicationDetailId
                        && !string.IsNullOrWhiteSpace(app.ApplicationNumber)
                        && app.ProfileId > 0
                    select (int?)app.ProfileId
                ).FirstOrDefaultAsync();
            }

            if (!resolvedProfileId.HasValue || resolvedProfileId.Value <= 0)
            {
                return (null, null, true);
            }

            var relatedProfile = await _queryable.GetQueryable<UserProfile>()
                .Where(profile => profile.Id == resolvedProfileId.Value)
                .Select(profile => new { ProfileId = (int?)profile.Id, UserTypeId = (short?)profile.UserTypeId })
                .FirstOrDefaultAsync();

            if (relatedProfile == null)
            {
                return (null, null, true);
            }

            return (relatedProfile.ProfileId, relatedProfile.UserTypeId, false);
        }
        public async Task<bool> AddEnquiryAdminAsync(EnquiryAdminReqestDot requestDto)
        {
            var _number = $"HC-01-{DateTime.UtcNow.AddHours(4).Year}-" + Nanoid.Generate("0123456789", 7);

            //var taskUserId = await this.EnquiryManangerUserAsync();
            var taskUserId = _currentDomain.UserId ?? await this.EnquiryManangerUserAsync();
            // Normally the acting admin owns the ticket they raise; the least-load pick only covers
            // calls with no signed-in user. If neither resolves, the ticket is still created (losing a
            // customer's enquiry is worse than an unassigned one) but it lands in no queue, so record
            // it — the AP-033-style notification below is already skipped when taskUserId is empty.
            if (string.IsNullOrWhiteSpace(taskUserId))
            {
                _logger.LogError(
                    "Enquiry {EnquiryNumber}: no assignable member in Happiness Center and no acting user; ticket is being created without a handler.",
                    _number);
            }
            var departmentId = (int)DeptEnum.HappinessCenter;
            var enquiryStatusId = (short)EnquiryAdminStatus.Open;
            //string? hadleUserId = null;

            int days = 3;
            if (requestDto.EnquiryTypeId == (short)EnquiryTypeEnum.Complaint)
            {
                days = 5;
            }
            var slaEndTime = DateTime.UtcNow.AddHours(4).AddDays(days);

            var profiles = await iUser.GetCurrentUserProfileListAsync(_currentDomain?.UserId);
            var profileId = profiles.FirstOrDefault(f => f.UserTypeId == (short)UserTypeCode.Individual)?.Id;
            var nowDate = DateTime.UtcNow.AddHours(4);
            var serviceObj = await _queryable.GetQueryable<ServiceConfig>().FirstOrDefaultAsync(w => w.Id == requestDto.ServiceId);

            // Resolve the source platform (Web/Mobile/Tablet) from the request User-Agent and
            // map it to its TypeDictionary (Scope='Platform') Code, stored as PlatformId.
            var platformName = _currentDomain?.Platform;
            string? platformId = null;
            if (!string.IsNullOrWhiteSpace(platformName))
            {
                var platformTypes = await domainEnq.GetEnquiryTypesAsync(new EnquiryTypeDto().EnquiryPlatform);
                var matchedPlatform = platformTypes.FirstOrDefault(t => string.Equals(t.NameEn, platformName, StringComparison.OrdinalIgnoreCase))
                    ?? platformTypes.FirstOrDefault(t => !string.IsNullOrWhiteSpace(t.NameEn) && t.NameEn.Contains(platformName, StringComparison.OrdinalIgnoreCase));
                platformId = matchedPlatform?.Code;
            }

            Enquiry enquiry = new Enquiry()
            {
                EnquiryTypeId = requestDto.EnquiryTypeId,
                Description = requestDto.Description,
                AttachementUrl = requestDto?.AttachmentUrls?.FirstOrDefault(),
                AttachementUrl2 = requestDto?.AttachmentUrls?.Length >= 2 ? requestDto?.AttachmentUrls?.ElementAtOrDefault(1) : null,
                AttachementUrl3 = requestDto?.AttachmentUrls?.Length >= 3 ? requestDto?.AttachmentUrls?.ElementAtOrDefault(2) : null,
                EnquiryStatusId = enquiryStatusId,
                EnquirySourceId = requestDto.EnquirySourceId,
                IssueCategoryId = requestDto.EnquiryIssueCategoryId,
                //EnquiryStateId = 1,
                EnquiryNumber = _number,
                DepartmentId = departmentId,
                CreatedOn = nowDate,
                UpdatedOn = nowDate,
                CreatedBy = _currentDomain?.UserId ?? "",
                UserProfileId = profileId,
                ServiceId = requestDto.ServiceId,
                ServiceCode = serviceObj?.Code ?? "",
                HandlerUserId = taskUserId,
                ManangerUserId = taskUserId,
                ApplicationDetailId = requestDto.ApplicationDetailId,
                SLAEndTime = slaEndTime,
                SourceName = "UMC",
                PriorityId = requestDto.PriorityId,
                PlatformId = platformId
            };

            var enq = await domainEnq.AddEnquiryAsync(enquiry);
            await unit.SaveChangesAsync();
            if (!string.IsNullOrWhiteSpace(requestDto.UserTypeCode))
            {

                EnquiryCustomerInfo enquiryCustormer = new EnquiryCustomerInfo()
                {
                    EnquiryId = enq.Id,
                    UserTypeCode = requestDto.UserTypeCode,
                    FullName = requestDto?.FullName,
                    //FullNameAr = requestDto?.FullNameAr,
                    Email = requestDto?.Email,
                    MobileNumber = requestDto.MobileNumber,
                    MobileCountryCode = requestDto?.MobileCountryCode,
                    MobileLocalNumber = requestDto?.MobileLocalNumber,
                    CreatedBy = _currentDomain?.UserId ?? "",
                    CreatedOn = nowDate
                };
                var curstomerInfo = await domainEnq.AddEnquiryCustomerInfoAsync(enquiryCustormer);
            }

            var currentUserDepts = await domainEnq.GetUserDepartmentAsync(_currentDomain?.UserId ?? "");

            if (!currentUserDepts.Select(s => s.DepartmentId).Contains((int)DeptEnum.HappinessCenter)) throw new BusinessException("User is not in Happiness Center Department");

            var firsUserDept = currentUserDepts.FirstOrDefault(f => f.DepartmentId == (int)DeptEnum.HappinessCenter);
            EnquiryCreatedReason createdReason = new EnquiryCreatedReason();
            await domainEnq.SaveEnquiryCStatusTrackingAsync(enq.Id, null, (short)EnquiryAdminStatus.Open, createdReason.CreatedReason, _currentDomain?.UserId, _currentDomain?.UserId, _currentDomain?.UserProfileId?.ToInt(), firsUserDept?.DepartmentId, nowDate);
            //if (requestDto.EnquiryTypeId == (short)EnquiryTypeEnum.Complaint && !string.IsNullOrWhiteSpace(hadleUserId)) await domainEnq.SaveEnquiryCStatusTrackingAsync(enq.Id, null, 2, null, _currentDomain?.UserId, _currentDomain?.UserProfileId?.ToInt(), firsUserDept?.DepartmentId, nowDate);
            await unit.SaveChangesAsync();

            if (!string.IsNullOrEmpty(taskUserId))
            {
                var enquiryNumber = _number;
                var managerUserId = taskUserId;
                var issueCategoryId = requestDto.EnquiryIssueCategoryId;
                var enquiryTypeId = requestDto.EnquiryTypeId;
                var applicationDetailId = requestDto.ApplicationDetailId;
                var customerName = requestDto.FullName ?? string.Empty;
                var customerEmail = requestDto.Email;
                var customerUserTypeCode = requestDto.UserTypeCode;
                var creationDate = nowDate.ToString(DateTimeHelper.TemplateDateTimeFormat);

                await RunEnquiryNotificationInBackground(async sp =>
                {
                    var domain = sp.GetRequiredService<IEnquiryDomainService>();
                    var sendTemplate = sp.GetRequiredService<ISendTemplateService>();
                    var adminUserRepo = sp.GetRequiredService<IBaseRepository<AdminUser>>();
                    var proRepo = sp.GetRequiredService<IBaseRepository<UserProfile>>();
                    var queryable = sp.GetRequiredService<IQueryableContext>();
                    var configuration = sp.GetRequiredService<IConfiguration>();
                    var typeObj = new EnquiryTypeDto();
                    var ticketLink = BuildAdminTicketLink(ResolveAdminPortalUrl(configuration), enq.Id);

                    var types = await domain.GetEnquiryTypesAsync(typeObj.EnquiryIssueCategory, typeObj.EnquiryType);
                    var adminUser = await adminUserRepo.FirstOrDefaultAsync(o => o.Id == managerUserId);
                    var pro = await proRepo.FirstOrDefaultAsync(o => o.UserId == managerUserId);
                    var category = types.FirstOrDefault(f => f.Scope == typeObj.EnquiryIssueCategory && f.Code == issueCategoryId.ToString());
                    var ticketType = types.FirstOrDefault(f => f.Scope == typeObj.EnquiryType && f.Code == enquiryTypeId.ToString());
                    var priorityTypes = await domain.GetEnquiryPrioritiesAsync();
                    var priority = priorityTypes.FirstOrDefault(t => t.Id == requestDto.PriorityId);

                    var sends = new List<EnquiryTemplateSendRequest>
                    {
                        new EnquiryTemplateSendRequest(
                            "AP-021",
                            managerUserId,
                            pro?.Id,
                            new List<TemplateVariable>
                            {
                                new() { Key = "staff_name", Value = adminUser != null ? adminUser.FirstName + " " + adminUser.LastName : string.Empty },
                                new() { Key = "ticket_number", Value = enquiryNumber },
                                new() { Key = "ticket_category", Value = category?.NameEn ?? string.Empty },
                                new() { Key = "priority", Value = priority?.NameEn ?? string.Empty },
                                new() { Key = "sla_deadline", Value = slaEndTime.ToString(DateTimeHelper.TemplateDateTimeFormat) },
                                new() { Key = "ticket_link", Value = ticketLink },
                            }),
                    };

                    var customerRecipient = await ResolveEnquiryCustomerRecipientAsync(
                        queryable,
                        applicationDetailId,
                        customerEmail,
                        customerUserTypeCode);
                    if (customerRecipient != null)
                    {
                        sends.Add(new EnquiryTemplateSendRequest(
                            "CP-038",
                            customerRecipient.UserId,
                            customerRecipient.ProfileId,
                            new List<TemplateVariable>
                            {
                                new() { Key = "customer_name", Value = !string.IsNullOrWhiteSpace(customerName) ? customerName : customerRecipient.UserName },
                                new() { Key = "ticket_number", Value = enquiryNumber },
                                new() { Key = "ticket_type", Value = ticketType?.NameEn ?? string.Empty },
                                new() { Key = "creation_date", Value = creationDate },
                            },
                            customerRecipient.Email));
                    }
                    else
                    {
                        _logger.LogWarning(
                            "CP-038 notification skipped: the ticket customer could not be identified. EnquiryId={EnquiryId}, ApplicationDetailId={ApplicationDetailId}, HasCustomerEmail={HasCustomerEmail}, UserTypeCode={UserTypeCode}.",
                            enq.Id,
                            applicationDetailId,
                            !string.IsNullOrWhiteSpace(customerEmail),
                            customerUserTypeCode);
                    }

                    await SendEnquiryTemplatesAsync(sendTemplate, queryable, sends.ToArray());
                });
            }

            TrySyncEnquiryToAdminPortal(enq.Id);
            return true;
        }

        /// <summary>
        /// Resolves the customer a Happiness Center agent filed a ticket for, so CP-038 reaches the
        /// customer rather than the agent. Deliberately does NOT read <c>Enquiry.UserProfileId</c>: that
        /// column is filled from the CURRENT (admin) user's own Individual profile, so on an
        /// agent-created ticket it identifies the agent, never the customer.
        ///
        /// The linked application is the only unambiguous source, because its ProfileId is the profile
        /// that actually filed it. Agents may also open a ticket with no application, in which case the
        /// only customer data on record is what they typed into EnquiryCustomerInfo (Email + UserTypeCode).
        /// The email decides WHO is notified, so it must identify exactly one account (shared mailboxes
        /// exist); anything ambiguous returns null and the caller skips CP-038, because notifying the
        /// wrong customer is worse than notifying none.
        ///
        /// The user type only decides WHICH profile the in-app copy is filed under, never whether the
        /// customer is told at all. One account routinely holds several profiles of the same type, so
        /// requiring a unique profile silently dropped CP-038 for every non-Individual customer; the
        /// profile is now a best-effort pick and a missing one falls back to an account-level send.
        /// </summary>
        private static async Task<EnquiryCustomerRecipient?> ResolveEnquiryCustomerRecipientAsync(
            IQueryableContext queryable,
            short? applicationDetailId,
            string? customerEmail,
            string? customerUserTypeCode)
        {
            if (applicationDetailId.HasValue)
            {
                var byApplication = await (
                    from detail in queryable.GetQueryable<ApplicationDetailModel>()
                    join application in queryable.GetQueryable<ApplicationModel>() on detail.ApplicationId equals application.Id
                    join profile in queryable.GetQueryable<UserProfile>() on application.ProfileId equals profile.Id
                    join user in queryable.GetQueryable<User>() on profile.UserId equals user.Id
                    where detail.Id == applicationDetailId.Value
                    select new EnquiryCustomerRecipient(profile.UserId, (int?)profile.Id, user.Email, user.UserName))
                    .AsNoTracking()
                    .FirstOrDefaultAsync();
                if (byApplication != null)
                {
                    return byApplication;
                }
            }

            var email = customerEmail?.Trim();
            if (string.IsNullOrWhiteSpace(email))
            {
                return null;
            }

            var accounts = await queryable.GetQueryable<User>()
                .AsNoTracking()
                .Where(user => user.Email == email)
                .Select(user => new { user.Id, user.Email, user.UserName })
                .Take(2)
                .ToListAsync();
            if (accounts.Count != 1)
            {
                return null;
            }

            var account = accounts[0];

            // EnquiryCustomerInfo stores the user-type CODE while UserProfile stores the user-type ID,
            // and the two disagree for most types (e.g. Embassy is Code 13 / Id 31), so the mapping must
            // go through Lookup.UserTypes instead of comparing the raw values.
            var userTypeCode = customerUserTypeCode?.Trim();
            short? userTypeId = null;
            if (!string.IsNullOrWhiteSpace(userTypeCode))
            {
                var userTypeIds = await queryable.GetQueryable<UserType>()
                    .AsNoTracking()
                    .Where(type => type.Code == userTypeCode)
                    .Select(type => type.Id)
                    .Take(2)
                    .ToListAsync();
                if (userTypeIds.Count == 1)
                {
                    userTypeId = userTypeIds[0];
                }
            }

            var profiles = await queryable.GetQueryable<UserProfile>()
                .AsNoTracking()
                .Where(profile => profile.UserId == account.Id)
                .Select(profile => new { profile.Id, profile.UserTypeId, profile.Status })
                .ToListAsync();

            var approvedStatus = ((int)UserProfileStatusEnum.Approved).ToString();
            var profileId = profiles
                .OrderByDescending(profile => userTypeId.HasValue && profile.UserTypeId == userTypeId.Value)
                .ThenByDescending(profile => profile.Status == approvedStatus)
                .ThenBy(profile => profile.Id)
                .Select(profile => (int?)profile.Id)
                .FirstOrDefault();

            return new EnquiryCustomerRecipient(account.Id, profileId, account.Email, account.UserName);
        }

        private async Task<int?> GetDepartmentIdByServiceId(int serviceId)
        {
            var serv = await _queryable.GetQueryable<ServiceConfig>().FirstOrDefaultAsync(f => f.Id == serviceId);
            return serv?.Department;
        }

        public async Task<IEnumerable<EnquiryTransDto>> GetEnquiryTrackingsAsync(int enquiryId)
        {
            var trackings = await domainEnq.GetEnquiryTrackingsAsync(enquiryId);
            var typeObj = new EnquiryTypeDto();
            var typesStatus = await domainEnq.GetEnquiryTypesAsync(typeObj.EnquiryAdminStatus);


            var _isArabic = _currentDomain.IsArabicLanguage;
            var trackingsDatas = new List<EnquiryTransDto>();
            if (trackings != null && trackings.Any())
            {
                var processConversations = await GetProcessConversationInfo(enquiryId);
                var depts = await this.DepartmentDataAsync();

                var createUserIds = trackings.Where(s => !string.IsNullOrWhiteSpace(s.trancking.CreatedBy))
                    .Select(s => s.trancking.CreatedBy).ToList();
                var handUserIds = trackings.Where(s => !string.IsNullOrWhiteSpace(s.trancking.HandlerUserId))
                    .Select(s => s.trancking.HandlerUserId);
                var allUserIds = createUserIds.Concat(handUserIds).Distinct().ToList();
                var userLists = await this.GetUsersAsync(allUserIds);

                var pendingCustomerHanderName = trackings.Any(t=>t.trancking.ToStatusId== (int)EnquiryAdminStatus.PendingCustomer) ? await GetEnquiryPendingCustomerHandlerNameAsync(enquiryId):null;

                foreach (var (trancking, creatUser) in trackings)
                {
                    //var userDep = (await domainEnq.GetUserDepartmentAsync(adminUser?.Id??"")).FirstOrDefault();
                    var currDept = depts.FirstOrDefault(f => f.Id == trancking?.DepartmentId);

                    var createName = userLists.FirstOrDefault(f => f.UserId == trancking.CreatedBy)?.FullName;
                    var handleUserName = userLists.FirstOrDefault(f => f.UserId == trancking.HandlerUserId)?.FullName;
                    var isTaskReassigned = string.Equals(
                        trancking.Reason,
                        TaskReassignedTrackingReason,
                        StringComparison.OrdinalIgnoreCase);

                    string handleDec = "";

                    var defaultDept = depts.FirstOrDefault(f => f.Id == (int)DeptEnum.HappinessCenter);
                    string departmentName = trancking?.DepartmentId > 0 ? (_isArabic ? currDept?.NameAr : currDept?.NameEn) ?? "" : (_isArabic ? defaultDept?.NameAr : defaultDept?.NameEn) ?? "";

                    EnqiryProcessConversationInfoDto? processConversationInfo = null;
                    switch (trancking.ToStatusId)
                    {
                        case (int)EnquiryAdminStatus.Open:
                            handleDec = $"Ticket automatically assigned to {handleUserName}";
                            break;
                        case (int)EnquiryAdminStatus.PendingCustomer:
                            departmentName = _isArabic ? "عميل" : "Customer";
                            handleDec = $"{createName} changed status to Pending Customer";
                            handleUserName = pendingCustomerHanderName ?? handleUserName;
                            break;
                        case (int)EnquiryAdminStatus.DepartmentProcessing:
                            //departmentName = trancking?.DepartmentId > 0 ? ((DeptEnum)(trancking?.DepartmentId ?? 0)).GetEnumDescription().descriptionEn : DeptEnum.LicensingDepartment.GetEnumDescription().descriptionEn;

                            handleDec = $"{createName} changed the status to Department Processing and transferred the ticket to  {handleUserName}";
                            if (processConversations.Any(w => w.SourceTypeId == (short)EnquiryConversationSource.DepartmentAutomatic))
                            {
                                processConversationInfo = processConversations.FirstOrDefault(f => f.SourceTypeId == (short)EnquiryConversationSource.DepartmentAutomatic && f.CreatedOn == trancking.CreatedOn);
                                handleDec = $"Ticket was automatically transferred to {handleUserName}";
                            }
                            break;
                        case (int)EnquiryAdminStatus.DepartmentProcessed:
                            handleDec = $"{createName} processed the application, and it was automatically transferred to {handleUserName}";
                            processConversationInfo = processConversations.Where(st =>
                                (st.SourceTypeId == (short)EnquiryConversationSource.DepartmentSendback
                                || st.SourceTypeId == (short)EnquiryConversationSource.DepartmentProcessed)
                                && st.CreatedOn == trancking.CreatedOn).FirstOrDefault();
                            if (processConversationInfo?.SourceTypeId == (short)EnquiryConversationSource.DepartmentSendback) handleDec = $"{createName} sent back the application, and it was automatically transferred to {handleUserName}";
                            break;
                        case (int)EnquiryAdminStatus.Resolved:
                            handleDec = $"{createName} changed the status Resolved.";
                            departmentName = _isArabic ? "عميل" : "Customer";
                            break;
                        case (int)EnquiryAdminStatus.Completed:
                            handleDec = $"The ticket process has been completed.";
                            break;
                        case (int)EnquiryAdminStatus.Cancelled:
                            handleDec = $"The customer has cancelled the application.";
                            break;
                    }
                    if (isTaskReassigned)
                    {
                        handleDec = BuildReassignmentTimelineDescription(createName, handleUserName);
                    }
                    var enquiryStatusFirst = typesStatus.FirstOrDefault(f => f.Code == trancking.ToStatusId + "");

                    if (trancking.FromStatusId == (int)EnquiryAdminStatus.Resolved && trancking.ToStatusId == (int)EnquiryAdminStatus.Open)
                    {
                        departmentName = _isArabic ? "عميل" : "Customer";
                        handleUserName = createName;
                        handleDec = null;
                    }

                    var tranckingReason = isTaskReassigned || (trancking.FromStatusId is null && trancking.ToStatusId == (int)EnquiryAdminStatus.Open)
                        ? ""
                        : trancking.Reason;
                    var isReOpen = (trancking.FromStatusId == (short)EnquiryAdminStatus.Resolved && trancking.ToStatusId == (short)EnquiryAdminStatus.Open);
                    var trans = new EnquiryTransDto(trancking.EnquiryId, trancking.ToStatusId, new StatusValueObj(enquiryStatusFirst?.Id ?? 0, isReOpen ? "Reopen" : enquiryStatusFirst?.NameEn, isReOpen ? "إعادة فتح" : enquiryStatusFirst?.NameAr, enquiryStatusFirst?.NameEn), tranckingReason, createName, handleUserName, handleDec, departmentName, trancking.CreatedOn, processConversationInfo);
                    trackingsDatas.Add(trans);

                    if (trancking.FromStatusId is null && trancking.ToStatusId == (int)EnquiryAdminStatus.Open)
                    {
                        EnquiryCreatedReason createdReason = new EnquiryCreatedReason();
                        if (trancking.Reason == createdReason.CreatedReason)
                        {

                            departmentName = _isArabic ? (currDept?.NameAr ?? "سعادة العملاء") : currDept?.NameEn ?? "Customer Happiness";
                            var createdTrans = new EnquiryTransDto(trancking.EnquiryId, 0, new StatusValueObj(0, "Ticket Created", "تم إنشاء التذكرة", "Ticket Created"), null, createName, createName, null, departmentName, trancking.CreatedOn, null);
                            trackingsDatas.Add(createdTrans);
                        }
                        else
                        {
                            departmentName = _isArabic ? "عميل" : "Customer";
                            var createdTrans = new EnquiryTransDto(trancking.EnquiryId, 0, new StatusValueObj(0, "Ticket Submitted", "تم إرسال التذكرة", "Ticket Submitted"), null, createName, createName, null, departmentName, trancking.CreatedOn, null);
                            trackingsDatas.Add(createdTrans);
                        }
                    }

                }
            }
            return trackingsDatas;

        }

        private async Task<string?> GetEnquiryPendingCustomerHandlerNameAsync(int enquiryId)
        {
            var query = from enq in _queryable.GetQueryable<Enquiry>()
                        from adu in _queryable.GetQueryable<AdminUser>().Where(ad => ad.Id == enq.CreatedBy).DefaultIfEmpty()
                        from customerInfo in _queryable.GetQueryable<EnquiryCustomerInfo>().Where(ci => ci.EnquiryId == enq.Id).DefaultIfEmpty()
                        from appDet in _queryable.GetQueryable<ApplicationDetailModel>().Where(det => det.Id == enq.ApplicationDetailId).DefaultIfEmpty()
                        from app in _queryable.GetQueryable<ApplicationModel>().Where(det => det.Id == appDet.ApplicationId).DefaultIfEmpty()
                        from u in _queryable.GetQueryable<User>().Where(u => u.Id == app.UserId).DefaultIfEmpty()
                        where enq.Id == enquiryId
                        select new
                        {
                            enq.ApplicationDetailId,
                            admUserId = (string?)adu.Id,
                            customerFullName = (string?)customerInfo.FullName,
                            admUserName = (string?)adu.UserName,
                            appFirstName = u.FirstName,
                            appLastName = u.LastName

                        };
            var enquiryPendingCustomers = await query.AsNoTracking().FirstOrDefaultAsync();
            if (!string.IsNullOrWhiteSpace(enquiryPendingCustomers?.admUserId))
            {
                // adi create

                if (!string.IsNullOrWhiteSpace(enquiryPendingCustomers?.customerFullName))
                {
                    return enquiryPendingCustomers?.customerFullName;
                }
                else if ((enquiryPendingCustomers?.ApplicationDetailId ?? 0) > 0 && !string.IsNullOrWhiteSpace(enquiryPendingCustomers?.appFirstName))
                {
                    return enquiryPendingCustomers?.appFirstName + " " + enquiryPendingCustomers?.appLastName;
                }
            }


            return null;

        }



        private async Task<List<Department>> DepartmentDataAsync()
        {
            return await _queryable.GetQueryable<Department>().AsNoTracking().ToListAsync();
        }

        private async Task<List<EnquiryUserInfo>> GetUsersAsync(List<string> userIds)
        {
            if (userIds.Any())
            {
                userIds = userIds.Distinct().ToList();
                var adminUsers = (await _queryable.GetQueryable<AdminUser>()
                   .Where(u => userIds.Contains(u.Id)).AsNoTracking().ToListAsync())
                   .Select(s => new EnquiryUserInfo(s.Id, (s.FirstName + " " + s.LastName), s.PersonalPhotoUrl)).ToList();



                if (adminUsers.Count > 0) userIds = userIds.Except(adminUsers.Select(s => s.UserId)).ToList();

                var users = (await _queryable.GetQueryable<User>()
                    .Where(u => userIds.Contains(u.Id)).AsNoTracking().ToListAsync())
                    .Select(s => new EnquiryUserInfo(s.Id, (s.FirstName + " " + s.LastName), ""));

                return adminUsers.Concat(users).Distinct().ToList();

            }
            return new List<EnquiryUserInfo>();
        }

        private async Task<List<EnqiryProcessConversationInfoDto>> GetProcessConversationInfo(int enquiryId)
        {

            int[] processedIds = new int[] { (short)EnquiryConversationSource.DepartmentProcessed, (short)EnquiryConversationSource.DepartmentSendback, (short)EnquiryConversationSource.DepartmentAutomatic };
            var conversations = await _queryable.GetQueryable<EnquiryConversation>().Where(ec => ec.EnquiryId == enquiryId && processedIds.Contains(ec.SourceTypeId ?? 0)).AsNoTracking().ToListAsync();

            List<EnqiryProcessConversationInfoDto> enqiryProcessConversations = new List<EnqiryProcessConversationInfoDto>();
            if (conversations != null && conversations.Any())
            {

                var deptIds = conversations.Where(w => w.CurrentDepartmentId > 0).Select(c => c.CurrentDepartmentId ?? 0).ToArray();
                var dicProblemCausesData = await this.GetDeptProblemCausesByDeptIdsAsync(deptIds);
                foreach (var conversation in conversations)
                {
                    var attachments = new List<string>();
                    if (!string.IsNullOrWhiteSpace(conversation.AttachmentUrl1)) attachments.Add(conversation.AttachmentUrl1);
                    if (!string.IsNullOrWhiteSpace(conversation.AttachmentUrl2)) attachments.Add(conversation.AttachmentUrl2);
                    if (!string.IsNullOrWhiteSpace(conversation.AttachmentUrl3)) attachments.Add(conversation.AttachmentUrl3);

                    //var deptProblems = await this.GetDeptProblemCausesAsync(conversation.CurrentDepartmentId ?? 0);
                    var deptProblems = dicProblemCausesData.TryGetValue(conversation.CurrentDepartmentId ?? 0, out List<EnquiryTypeObjDto>? _deptProblems) ? _deptProblems : new List<EnquiryTypeObjDto>();

                    var problemCauseObj = deptProblems.Where(f => f.Id == conversation.ProblemCauseId).Select(p => new ValueObj(p.Id, p.NameEn, p.NameAr)).FirstOrDefault();

                    var processConversationInfo = new EnqiryProcessConversationInfoDto(conversation.MessageContent, attachments.ToArray(), conversation.ProblemCauseId, conversation.SourceTypeId, conversation.CreatedOn, problemCauseObj);
                    enqiryProcessConversations.Add(processConversationInfo);
                }
            }
            return enqiryProcessConversations;

        }

        public async Task<IEnumerable<EnquiryTransDto>> GetEnquiryTrackingNumbersAsync(string enquiryNumber)
        {
            var enqiry = await domainEnq.GetEnquiryNumberTaskAsync(enquiryNumber);
            if (enqiry == null) return new List<EnquiryTransDto>();
            return await GetEnquiryTrackingsAsync(enqiry.Id);
        }


        public async Task<bool> SaveConversationAdminAsync(int EnquiryId, EnquiryConversationAdminDto reqest)
        {
            await using var transaction = await _dbContext.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);
            try
            {
                var enquiry = await _dbContext.Enquiries
                    .AsNoTracking()
                    .SingleOrDefaultAsync(item => item.Id == EnquiryId);
                if (enquiry == null)
                {
                    throw new BusinessException("The ticket not found.", null, 404);
                }

                var userDepartments = await this.GetUserIdDepartmentAsync(_currentDomain.UserId ?? "");
                var isHappinessUser = userDepartments?.Any(s => s.DepartmentId == (int)DeptEnum.HappinessCenter) ?? false;
                var isHappinessLeader = userDepartments?.Any(s => s.DepartmentId == (int)DeptEnum.HappinessCenter && (s.IsLeader ?? false)) ?? false;

                if (IsCustomerVisibleMessage(reqest.SourceTypeId)
                    && !CanSendCustomerVisibleMessage(enquiry.ManangerUserId, _currentDomain.UserId, isHappinessLeader))
                {
                    throw new BusinessException("Only the assigned Customer Happiness handler or a Happiness Center leader can send customer-visible messages.", null, 403);
                }

                if (IsInternalNote(reqest.SourceTypeId)
                    && !CanSendInternalNote(enquiry, _currentDomain.UserId, isHappinessUser, GetLeaderDepartmentIds(userDepartments)))
                {
                    throw new BusinessException("Only the current business-department To-Do handler, a leader of the owning department, or Customer Happiness staff on a Department Processing ticket can add internal notes.", null, 403);
                }

                var profiles = await iUser.GetCurrentUserProfileListAsync(_currentDomain.UserId);
                var profileId = profiles.FirstOrDefault(f => f.UserTypeId == (short)UserTypeCode.Individual)?.Id;
                int? _departmentId = null;

                if (isHappinessUser) _departmentId = (int)DeptEnum.HappinessCenter;
                else if (userDepartments?.Any(s => s.DepartmentId == enquiry.DepartmentId) ?? false) _departmentId = enquiry.DepartmentId;
                else _departmentId = userDepartments?.FirstOrDefault()?.DepartmentId;

                var con = new EnquiryConversation()
                {
                    EnquiryId = EnquiryId,
                    MessageContent = reqest.MessageContent,
                    CreatedBy = _currentDomain.UserId,
                    CreatedOn = DateTime.UtcNow.AddHours(4),
                    SourceTypeId = reqest.SourceTypeId,
                    AttachmentUrl1 = reqest.Attachments?.FirstOrDefault(),
                    AttachmentUrl2 = reqest.Attachments?.ElementAtOrDefault(1),
                    AttachmentUrl3 = reqest.Attachments?.ElementAtOrDefault(2),
                    CurrentDepartmentId = _departmentId,
                    UserProfileId = profileId
                };
                await domainEnq.SaveConversationAsync(con);

                await unit.SaveChangesAsync();
                await transaction.CommitAsync();
                return true;
            }
            catch
            {
                await transaction.RollbackAsync();
                throw;
            }
        }


        public async Task<bool> SaveCustomerTransferAsync(int enquiryId, EnquiryTransferRequest request)
        {
            var enquiry = await domainEnq.GetEnquiryByIdAsync(enquiryId);
            if (enquiry != null)
            {
                // Only the assigned handler or a Happiness Center leader may change the status.
                await EnsureCanChangeStatusAsync(enquiry);

                //if (request.EnquiryStatusId == enquiry.EnquiryStatusId) throw new BusinessException("Current status is already up to date, no need to repeat the operation.");
                int? courrentDepartmentId = (int)DeptEnum.HappinessCenter;
                var fromStatusId = enquiry.EnquiryStatusId;
                enquiry.EnquiryStatusId = request.EnquiryStatusId;
                var org_handUserId = enquiry.HandlerUserId;

                if (fromStatusId == (short)EnquiryAdminStatus.Resolved) throw new BusinessException("The ticket has been resolved.");
                if (fromStatusId == (short)EnquiryAdminStatus.Completed) throw new BusinessException("The ticket has been completed.");
                if (fromStatusId == (short)EnquiryAdminStatus.Cancelled) throw new BusinessException("The ticket has been cancelled.");


                if (request.DepartmentId > 0)
                {
                    // When a roleId is supplied, assign the handler from within that role: the on-duty
                    // member of that role IN THE TARGET DEPARTMENT with the fewest open tasks. Otherwise
                    // keep the legacy department-wide least-load assignment. Both stay inside the target
                    // department — a handler is never picked from another department.
                    var taskUserId = !string.IsNullOrWhiteSpace(request.RoleId)
                        ? await this.EnquiryRoleHandlerUserAsync(request.RoleId!, departmentId: request.DepartmentId, groupKey: "HandlerUserId")
                        : await this.EnquiryManangerUserAsync(departmentId: request.DepartmentId, groupKey: "HandlerUserId");

                    if (!string.IsNullOrWhiteSpace(taskUserId))
                    {
                        enquiry.HandlerUserId = taskUserId;
                        // Only stamp the role once resolution actually succeeded, so the row never
                        // claims a role the current handler was not picked from.
                        if (!string.IsNullOrWhiteSpace(request.RoleId)) enquiry.HandlerRoleId = request.RoleId;
                    }
                    else
                    {
                        // The target department (or role within it) has nobody assignable — a staffing or
                        // configuration gap. Leave the handler untouched: do NOT fall back to
                        // ManangerUserId, which belongs to the Happiness Center and would put the ticket
                        // on someone outside the target department.
                        _logger.LogError(
                            "Enquiry {EnquiryId}: no assignable member in department {DepartmentId} for role {RoleId}; handler left unchanged ({HandlerUserId}).",
                            enquiryId, request.DepartmentId, request.RoleId, enquiry.HandlerUserId);
                    }
                }

                if (ShouldApplyTransferEnquiryTypeChange(request.EnquiryStatusId, request.EnquiryTypeId) && request.EnquiryTypeId == (short)EnquiryTypeEnum.Complaint && enquiry.EnquiryTypeId > 0  && enquiry.EnquiryTypeId != (short)EnquiryTypeEnum.Complaint)
                {
                     if(enquiry.SLAEndTime!=null)  enquiry.SLAEndTime = enquiry.SLAEndTime.Value.AddDays(2);
                }

                if (ShouldApplyTransferEnquiryTypeChange(request.EnquiryStatusId, request.EnquiryTypeId)) enquiry.EnquiryTypeId = request.EnquiryTypeId ?? 0;
                if (request.PriorityId.HasValue) enquiry.PriorityId = request.PriorityId ?? 0;

                var handleUserId = enquiry.HandlerUserId;
                if (request.EnquiryStatusId == (short)EnquiryAdminStatus.Resolved)
                {
                    enquiry.CompletedOn = DateTime.UtcNow.AddHours(4);
                    handleUserId = enquiry.CreatedBy;
                    var reOpenData = await domainEnq.GetEnquiryReOpentDataAsync(new int[] { enquiryId });
                    if (reOpenData.Any())
                    {
                        var reOpenTimes = reOpenData.First().ReOpenTimes;

                        if (reOpenTimes >= 3)
                        {
                            enquiry.EnquiryStatusId = (short)EnquiryAdminStatus.Completed;
                        }
                    }
                }
                else if (request.EnquiryStatusId == (short)EnquiryAdminStatus.PendingCustomer)
                {
                    handleUserId = enquiry.CreatedBy;
                }
                else if (request.EnquiryStatusId == (short)EnquiryAdminStatus.Open)
                {
                    enquiry.CompletedOn = null;
                    handleUserId = enquiry.ManangerUserId;

                }


                var profiles = await iUser.GetCurrentUserProfileListAsync(_currentDomain.UserId);

                var profileId = profiles.FirstOrDefault(f => f.UserTypeId == (short)UserTypeCode.Individual)?.Id;

                var nowDate = DateTime.UtcNow.AddHours(4);
                enquiry.UpdatedOn = nowDate;
                if (request.EnquiryStatusId == (int)EnquiryAdminStatus.DepartmentProcessing)
                {
                    enquiry.DepartmentId = request.DepartmentId;
                    enquiry.DepartmentDeadLine = request.DeadLine;
                    //enquiry.DepartmentDeadLine = request.DeadLine;
                    var con = new EnquiryConversation()
                    {
                        EnquiryId = enquiryId,
                        MessageContent = request.Note,
                        CreatedBy = _currentDomain.UserId,
                        CreatedOn = nowDate,
                        SourceTypeId = (short)EnquiryConversationSource.TransferNote,
                        AttachmentUrl1 = request.AttachmentUrls?.FirstOrDefault(),
                        AttachmentUrl2 = request.AttachmentUrls?.ElementAtOrDefault(1),
                        AttachmentUrl3 = request.AttachmentUrls?.ElementAtOrDefault(2),
                        UserProfileId = profileId,
                        TransferDepartmentId = request.DepartmentId,
                        CurrentDepartmentId = courrentDepartmentId,
                        DepartmentDeadLine = request.DeadLine
                    };
                    await domainEnq.SaveConversationAsync(con);
                }



                if (enquiry.EnquiryStatusId == (short)EnquiryAdminStatus.PendingCustomer) handleUserId = enquiry.CreatedBy;

                if (fromStatusId != request.EnquiryStatusId) await domainEnq.SaveEnquiryCStatusTrackingAsync(enquiry.Id, fromStatusId, enquiry.EnquiryStatusId, null, _currentDomain?.UserId, handleUserId, _currentDomain?.UserProfileId?.ToInt(), request.DepartmentId, nowDate);

                await unit.SaveChangesAsync();

                var targetStatusId = request.EnquiryStatusId;
                var enquiryNumber = enquiry.EnquiryNumber;
                var createdBy = enquiry.CreatedBy ?? string.Empty;
                var userProfileId = enquiry.UserProfileId;
                var applicationDetailId = enquiry.ApplicationDetailId;
                var handlerUserId = enquiry.HandlerUserId ?? string.Empty;
                var originalHandlerUserId = org_handUserId ?? string.Empty;
                // Captured on the request thread, NOT inside the notification closure: notifications run
                // on the background queue after the HTTP response completes, where
                // IHttpContextAccessor.HttpContext is null and _currentDomain.UserId resolves to null.
                var actorUserId = _currentDomain?.UserId ?? string.Empty;
                var enquiryTypeId = enquiry.EnquiryTypeId;
                var slaDeadline = enquiry.SLAEndTime?.ToString(DateTimeHelper.TemplateDateTimeFormat) ?? string.Empty;
                var transferSlaDeadline = request.DeadLine?.ToString(DateTimeHelper.TemplateDateTimeFormat) ?? slaDeadline;

                await RunEnquiryNotificationInBackground(async sp =>
                {
                    var domain = sp.GetRequiredService<IEnquiryDomainService>();
                    var sendTemplate = sp.GetRequiredService<ISendTemplateService>();
                    var adminUserRepo = sp.GetRequiredService<IBaseRepository<AdminUser>>();
                    var proRepo = sp.GetRequiredService<IBaseRepository<UserProfile>>();
                    var userDomain = sp.GetRequiredService<IUserDomainService>();
                    var queryable = sp.GetRequiredService<IQueryableContext>();
                    var configuration = sp.GetRequiredService<IConfiguration>();
                    var ticketLink = BuildAdminTicketLink(ResolveAdminPortalUrl(configuration), enquiryId);

                    var sends = new List<EnquiryTemplateSendRequest>();
                    var customerUserId = createdBy;
                    var customerProfileId = userProfileId;
                    var customerEmail = string.Empty;
                    var customerName = string.Empty;

                    var customer = string.IsNullOrWhiteSpace(createdBy)
                        ? null
                        : await userDomain.GetUserInfoByUserID(createdBy);
                    if (customer != null)
                    {
                        customerEmail = customer.Email ?? string.Empty;
                        customerName = customer.UserName ?? string.Empty;
                    }
                    else if (applicationDetailId > 0)
                    {
                        customerUserId = string.Empty;
                        customerProfileId = null;
                        var applicationCustomer = await (
                            from detail in queryable.GetQueryable<ApplicationDetailModel>()
                            join application in queryable.GetQueryable<ApplicationModel>() on detail.ApplicationId equals application.Id
                            join profile in queryable.GetQueryable<UserProfile>() on application.ProfileId equals profile.Id
                            join user in queryable.GetQueryable<User>() on profile.UserId equals user.Id
                            where detail.Id == applicationDetailId.Value
                            select new
                            {
                                profile.Id,
                                profile.UserId,
                                user.Email,
                                user.UserName
                            })
                            .AsNoTracking()
                            .FirstOrDefaultAsync();

                        if (applicationCustomer != null)
                        {
                            customerUserId = applicationCustomer.UserId;
                            customerProfileId = applicationCustomer.Id;
                            customerEmail = applicationCustomer.Email ?? string.Empty;
                            customerName = applicationCustomer.UserName ?? string.Empty;
                        }
                    }
                    else
                    {
                        customerUserId = string.Empty;
                        customerProfileId = null;
                        var customerInfo = (await domain.GetEnquiryCustomerInfoAsync(enquiryId)).FirstOrDefault();
                        if (customerInfo != null)
                        {
                            customerEmail = customerInfo.Email ?? string.Empty;
                            customerName = customerInfo.FullName ?? string.Empty;
                        }
                    }
                    var hasCustomerRecipient = !string.IsNullOrWhiteSpace(customerUserId)
                        || !string.IsNullOrWhiteSpace(customerEmail);

                    if (targetStatusId == (short)EnquiryAdminStatus.Open)
                    {
                        var reopenDate = DateTime.UtcNow.AddHours(4).ToString(DateTimeHelper.TemplateDateTimeFormat);
                        var reCount = await domain.GetEnquiryReopenCountAsync(enquiryId);
                        var adminUser = await adminUserRepo.FirstOrDefaultAsync(o => o.Id == handlerUserId);
                        var pro = await proRepo.FirstOrDefaultAsync(o => o.UserId == handlerUserId);

                        if (hasCustomerRecipient)
                        {
                            sends.Add(new EnquiryTemplateSendRequest(
                                "CP-032",
                                customerUserId,
                                customerProfileId,
                                new List<TemplateVariable>
                                {
                                    new() { Key = "customer_name", Value = customerName },
                                    new() { Key = "ticket_number", Value = enquiryNumber },
                                    new() { Key = "reopen_count", Value = reCount.ToString() },
                                    new() { Key = "reopen_date", Value = reopenDate },
                                },
                                customerEmail));
                        }
                        sends.Add(new EnquiryTemplateSendRequest(
                            "AP-024",
                            handlerUserId,
                            pro?.Id,
                            new List<TemplateVariable>
                            {
                                new() { Key = "staff_name", Value = adminUser != null ? adminUser.FirstName + " " + adminUser.LastName : string.Empty },
                                new() { Key = "ticket_number", Value = enquiryNumber },
                                new() { Key = "reopen_date", Value = reopenDate },
                                new() { Key = "sla_deadline", Value = slaDeadline },
                                new() { Key = "ticket_link", Value = ticketLink },
                            }, adminUser?.Email));
                    }
                    else if (targetStatusId == (short)EnquiryAdminStatus.DepartmentProcessing)
                    {
                        var adminUserIds = new[] { originalHandlerUserId, handlerUserId, actorUserId }
                            .Where(id => !string.IsNullOrEmpty(id))
                            .Distinct()
                            .ToList();

                        var adminUsers = adminUserIds.Count > 0
                            ? await queryable.GetQueryable<AdminUser>()
                                .Where(o => adminUserIds.Contains(o.Id))
                                .AsNoTracking()
                                .ToListAsync()
                            : new List<AdminUser>();
                        var pro = await proRepo.FirstOrDefaultAsync(o => o.UserId == handlerUserId);
                        var adminUser = adminUsers.FirstOrDefault(o => o.Id == originalHandlerUserId);
                        var handlerUser = adminUsers.FirstOrDefault(o => o.Id == handlerUserId);
                        var actorUser = adminUsers.FirstOrDefault(o => o.Id == actorUserId);
                        var typeObj = new EnquiryTypeDto();
                        var types = await domain.GetEnquiryTypesAsync(typeObj.EnquiryType);
                        var ticketTypeName = ResolveTicketTypeName(types, typeObj.EnquiryType, enquiryTypeId);

                        sends.Add(new EnquiryTemplateSendRequest(
                            "AP-022",
                            handlerUserId,
                            pro?.Id,
                            new List<TemplateVariable>
                            {
                                new() { Key = "staff_name", Value = ResolveAdminDisplayName(handlerUser) },
                                new() { Key = "ticket_number", Value = enquiryNumber },
                                new() { Key = "ticket_type", Value = ticketTypeName },
                                new() { Key = "original_handler", Value = ResolveTransferredByName(actorUser, adminUser) },
                                new() { Key = "sla_deadline", Value = transferSlaDeadline },
                                new() { Key = "ticket_link", Value = ticketLink },
                            }, handlerUser?.Email));
                    }
                    else if (targetStatusId == (short)EnquiryAdminStatus.PendingCustomer)
                    {
                        if (hasCustomerRecipient)
                        {
                            sends.Add(new EnquiryTemplateSendRequest(
                                "CP-030",
                                customerUserId,
                                customerProfileId,
                                new List<TemplateVariable>
                                {
                                    new() { Key = "customer_name", Value = customerName },
                                    new() { Key = "ticket_number", Value = enquiryNumber },
                                    new() { Key = "support_email", Value = SupportEmail },
                                },
                                customerEmail));
                        }
                    }

                    var eventDate = DateTime.UtcNow.AddHours(4).ToString(DateTimeHelper.TemplateDateTimeFormat);
                    if (targetStatusId == (short)EnquiryAdminStatus.Resolved || targetStatusId == (short)EnquiryAdminStatus.Cancelled)
                    {
                        if (hasCustomerRecipient)
                        {
                            sends.Add(new EnquiryTemplateSendRequest(
                                "CP-031",
                                customerUserId,
                                customerProfileId,
                                new List<TemplateVariable>
                                {
                                    new() { Key = "customer_name", Value = customerName },
                                    new() { Key = "ticket_number", Value = enquiryNumber },
                                    new() { Key = "resolution_date", Value = eventDate },
                                },
                                customerEmail));
                        }
                    }

                    await SendEnquiryTemplatesAsync(sendTemplate, queryable, sends.ToArray());
                });

                return true;
            }
            throw new BusinessException("Data is null");

        }

        public async Task<bool> SaveProcessedTransferAsync(int enquiryId, EnquiryTransferRequest request)
        {
            int transforDepartmentId = (int)DeptEnum.HappinessCenter; // Customer happness department
            var enquiry = await domainEnq.GetEnquiryByIdAsync(enquiryId);
            if (enquiry?.EnquiryStatusId == (short)EnquiryAdminStatus.DepartmentProcessing)
            {
                // Same transition as Process / Send Back, so it carries the same resource-level guard;
                // otherwise the department that no longer owns the ticket could hand it back from here.
                await EnsureCanProcessTicketAsync(enquiry);

                var fromDepartmentId = enquiry.DepartmentId;
                var fromStatusId = enquiry.EnquiryStatusId;
                enquiry.EnquiryStatusId = (short)EnquiryAdminStatus.DepartmentProcessed;
                enquiry.DepartmentId = transforDepartmentId;
                enquiry.PriorityId = request.PriorityId;
                //enquiry.DepartmentDeadLine = request.DeadLine;
                string? taskUserId = null;
                if (!string.IsNullOrWhiteSpace(enquiry.ManangerUserId))
                {
                    enquiry.HandlerUserId = enquiry.ManangerUserId;
                }
                else
                {
                    taskUserId = await this.EnquiryManangerUserAsync(groupKey: "HandlerUserId");
                    // Only overwrite once resolution succeeded. Happiness Center having nobody
                    // assignable is a staffing gap, and blanking the handler would orphan the ticket
                    // (invisible in every queue) and send AP-20b to an empty recipient — so keep the
                    // handler the department was working with and let ops fix the roster.
                    if (!string.IsNullOrWhiteSpace(taskUserId))
                    {
                        enquiry.HandlerUserId = taskUserId;
                        enquiry.ManangerUserId = taskUserId;
                    }
                    else
                    {
                        _logger.LogError(
                            "Enquiry {EnquiryId}: no assignable member in Happiness Center department {DepartmentId}; handler left unchanged ({HandlerUserId}).",
                            enquiryId, transforDepartmentId, enquiry.HandlerUserId);
                    }
                }

                var profiles = await iUser.GetCurrentUserProfileListAsync(_currentDomain.UserId);

                var profileId = profiles.FirstOrDefault(f => f.UserTypeId == (short)UserTypeCode.Individual)?.Id;

                var nowDate = DateTime.UtcNow.AddHours(4);
                enquiry.UpdatedOn = nowDate;
                var con = new EnquiryConversation()
                {
                    EnquiryId = enquiryId,
                    MessageContent = request.Note,
                    CreatedBy = _currentDomain.UserId,
                    CreatedOn = DateTime.UtcNow.AddHours(4),
                    SourceTypeId = (short)EnquiryConversationSource.DepartmentProcessed,
                    UserProfileId = profileId,
                    AttachmentUrl1 = request.AttachmentUrls?.FirstOrDefault(),
                    AttachmentUrl2 = request.AttachmentUrls?.ElementAtOrDefault(1),
                    AttachmentUrl3 = request.AttachmentUrls?.ElementAtOrDefault(2),
                    CurrentDepartmentId = fromDepartmentId,
                    TransferDepartmentId = transforDepartmentId
                };
                await domainEnq.SaveConversationAsync(con);
                await domainEnq.SaveEnquiryCStatusTrackingAsync(enquiry.Id, fromStatusId, enquiry.EnquiryStatusId, null, _currentDomain?.UserId, enquiry.HandlerUserId, _currentDomain?.UserProfileId?.ToInt(), transforDepartmentId, nowDate);

                await unit.SaveChangesAsync();

                var savedEnquiryId = enquiry.Id;
                var enquiryNumber = enquiry.EnquiryNumber;
                var handlerUserId = enquiry.HandlerUserId ?? string.Empty;
                var departmentId = fromDepartmentId;
                var resolutionNote = request.Note ?? string.Empty;

                await RunEnquiryNotificationInBackground(async sp =>
                {
                    var sendTemplate = sp.GetRequiredService<ISendTemplateService>();
                    var adminUserRepo = sp.GetRequiredService<IBaseRepository<AdminUser>>();
                    var proRepo = sp.GetRequiredService<IBaseRepository<UserProfile>>();
                    var depRepo = sp.GetRequiredService<IBaseRepository<Department>>();
                    var configuration = sp.GetRequiredService<IConfiguration>();
                    var queryable = sp.GetRequiredService<IQueryableContext>();

                    var adminUser = await adminUserRepo.FirstOrDefaultAsync(o => o.Id == handlerUserId);
                    var pro = await proRepo.FirstOrDefaultAsync(o => o.UserId == handlerUserId);
                    var dep = await depRepo.FirstOrDefaultAsync(o => o.Id == departmentId);
                    var adminUrl = ResolveAdminPortalUrl(configuration);
                    var ticketLink = BuildAdminTicketLink(adminUrl, savedEnquiryId);

                    await SendEnquiryTemplatesAsync(
                        sendTemplate,
                        queryable,
                        new EnquiryTemplateSendRequest(
                            "AP-20b",
                            handlerUserId,
                            pro?.Id,
                            new List<TemplateVariable>
                            {
                                new() { Key = "staff_name", Value = adminUser != null ? adminUser.FirstName + " " + adminUser.LastName : string.Empty },
                                new() { Key = "ticket_id", Value = enquiryNumber },
                                new() { Key = "department_name", Value = dep?.NameEn ?? string.Empty },
                                new() { Key = "department_resolution", Value = resolutionNote },
                                new() { Key = "ticket_link", Value = ticketLink },
                            }));
                });

                return true;
            }
            throw new BusinessException("Processing is only allowed for items in Department Processing status");
        }


        public async Task<bool> DepartmentProcessTicketAsync(int enquiryId, EnquiryProcessRequestDto request)
        {
            var souceTypeId = (short)EnquiryConversationSource.DepartmentProcessed;
            if (request.DepartmentProcessTypeId == (short)EnquiryProcessTypeEnum.Process)
            {
                souceTypeId = (short)EnquiryConversationSource.DepartmentProcessed;
                if (!request.ProblemCauseId.HasValue) throw new BusinessException("Problem Cause must not be blank", 400);
            }
            else if (request.DepartmentProcessTypeId == (short)EnquiryProcessTypeEnum.SendBack)
            {
                souceTypeId = (short)EnquiryConversationSource.DepartmentSendback;

            }


            var enquiry = await domainEnq.GetEnquiryByIdAsync(enquiryId);
            if (enquiry == null) throw new BusinessException("The ticket not found.", null, 404);
            // Re-read assignment from the database and authorize before touching any state: nothing in
            // the request body is trusted as proof of ownership.
            await EnsureCanProcessTicketAsync(enquiry);

            int transforDepartmentId = (int)DeptEnum.HappinessCenter; // Customer happness department

            var fromDepartmentId = enquiry.DepartmentId;
            var fromStatusId = enquiry.EnquiryStatusId;
            enquiry.EnquiryStatusId = (short)EnquiryAdminStatus.DepartmentProcessed;
            enquiry.DepartmentId = transforDepartmentId;
            enquiry.DepartmentProcessTypeId = (short)request.DepartmentProcessTypeId;
            enquiry.ProblemCauseId = request.ProblemCauseId;
            //enquiry.DepartmentDeadLine = request.DeadLine;
            enquiry.DepartmentProcessTime = DateTime.UtcNow.AddHours(4);
            string? taskUserId = null;
            if (!string.IsNullOrWhiteSpace(enquiry.ManangerUserId))
            {
                enquiry.HandlerUserId = enquiry.ManangerUserId;
            }
            else
            {
                taskUserId = await this.EnquiryManangerUserAsync(groupKey: "HandlerUserId");
                // See SaveProcessedTransferAsync: keep the existing handler when the Happiness Center
                // has nobody assignable, rather than blanking it.
                if (!string.IsNullOrWhiteSpace(taskUserId))
                {
                    enquiry.HandlerUserId = taskUserId;
                    enquiry.ManangerUserId = taskUserId;
                }
                else
                {
                    _logger.LogError(
                        "Enquiry {EnquiryId}: no assignable member in Happiness Center department {DepartmentId}; handler left unchanged ({HandlerUserId}).",
                        enquiryId, transforDepartmentId, enquiry.HandlerUserId);
                }
            }

            var profiles = await iUser.GetCurrentUserProfileListAsync(_currentDomain.UserId);

            var profileId = profiles.FirstOrDefault(f => f.UserTypeId == (short)UserTypeCode.Individual)?.Id;
            var nowDate = DateTime.UtcNow.AddHours(4);
            enquiry.UpdatedOn = nowDate;
            var con = new EnquiryConversation()
            {
                EnquiryId = enquiryId,
                MessageContent = request.Note,
                CreatedBy = _currentDomain.UserId,
                CreatedOn = nowDate,
                SourceTypeId = souceTypeId,
                UserProfileId = profileId,
                AttachmentUrl1 = request.AttachmentUrls?.FirstOrDefault(),
                AttachmentUrl2 = request.AttachmentUrls?.ElementAtOrDefault(1),
                AttachmentUrl3 = request.AttachmentUrls?.ElementAtOrDefault(2),
                CurrentDepartmentId = fromDepartmentId,
                TransferDepartmentId = transforDepartmentId,
                DepartmentProcessTypeId = (short)request.DepartmentProcessTypeId,
                ProblemCauseId = request.ProblemCauseId
            };
            await domainEnq.SaveConversationAsync(con);
            await domainEnq.SaveOrUpdateEnquiryCStatusTrackingAsync(enquiry.Id, fromStatusId, enquiry.EnquiryStatusId, null, _currentDomain?.UserId, enquiry.HandlerUserId, _currentDomain?.UserProfileId?.ToInt(), transforDepartmentId, nowDate);

            await unit.SaveChangesAsync();

            var enquiryNumber = enquiry.EnquiryNumber;
            var handlerUserId = enquiry.HandlerUserId ?? string.Empty;
            var departmentId = fromDepartmentId;

            await RunEnquiryNotificationInBackground(async sp =>
            {
                var sendTemplate = sp.GetRequiredService<ISendTemplateService>();
                var proRepo = sp.GetRequiredService<IBaseRepository<UserProfile>>();
                var depRepo = sp.GetRequiredService<IBaseRepository<Department>>();
                var queryable = sp.GetRequiredService<IQueryableContext>();
                var configuration = sp.GetRequiredService<IConfiguration>();
                var ticketLink = BuildAdminTicketLink(ResolveAdminPortalUrl(configuration), enquiryId);

                var pro = await proRepo.FirstOrDefaultAsync(o => o.UserId == handlerUserId);
                var dep = await depRepo.FirstOrDefaultAsync(o => o.Id == departmentId);

                await SendEnquiryTemplatesAsync(
                    sendTemplate,
                    queryable,
                    new EnquiryTemplateSendRequest(
                        "AP-023",
                        handlerUserId,
                        pro?.Id,
                        new List<TemplateVariable>
                        {
                            new() { Key = "ticket_number", Value = enquiryNumber },
                            new() { Key = "department_name", Value = dep?.NameEn ?? string.Empty },
                            new() { Key = "ticket_link", Value = ticketLink },
                        }));
            });

            return true;
        }


        /// <summary>
        /// Picks a handler for a department-processing transfer, constrained to members of the given
        /// role. Selection rule: among the role's on-duty members (not on leave) in the target
        /// department, choose the one with the fewest current open tasks (least-load), breaking ties
        /// at random. Fallback: if every one of them is on leave, ignore leave only and still pick the
        /// least-loaded of the same role+department set, so a fully-on-leave role never leaves the
        /// ticket unassigned. Returns null only when the role has no active member in the target
        /// department at all — the caller then keeps the existing handler rather than blanking it.
        /// </summary>
        public async Task<string?> EnquiryRoleHandlerUserAsync(string roleId, int? departmentId = (int)DeptEnum.HappinessCenter, string? groupKey = "HandlerUserId")
        {
            if (string.IsNullOrWhiteSpace(roleId)) return null;

            // All active users that belong to the role.
            var roleUserIds = (await domainEnq.GetRoleUserIdsAsync(roleId))
                .Where(id => !string.IsNullOrWhiteSpace(id))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
            if (roleUserIds.Count == 0) return null;

            var roleUserSet = roleUserIds.ToHashSet(StringComparer.OrdinalIgnoreCase);

            // Active members of the role within the target department, on leave or not.
            var userDepartMents = await this.GetUserDepartmentsLeavelogsAsync(departmentId ?? 0, activeOnly: true);
            var roleMembersInDept = await ExcludePrivilegedMembersAsync((userDepartMents ?? new List<UserDepartLogsDto>())
                .Where(w => !string.IsNullOrWhiteSpace(w.UserId) && roleUserSet.Contains(w.UserId!))
                .ToList());

            // The role is not staffed in this department. Let the caller decide (it keeps the current
            // handler) instead of assigning someone outside the target department.
            if (roleMembersInDept.Count == 0)
            {
                _logger.LogWarning(
                    "Enquiry assignment: role {RoleId} has no active member in department {DepartmentId}; no handler could be resolved.",
                    roleId, departmentId);
                return null;
            }

            // Rule 1: on-duty members only. Rule 2: if every one of them is on leave, ignore leave and
            // keep the same role+department pool so the ticket is still assigned.
            var onDuty = roleMembersInDept.Where(w => !(w.IsLeave ?? false)).ToList();
            var candidates = roleMembersInDept;
            if (onDuty.Count > 0)
            {
                candidates = onDuty;
            }
            else
            {
                _logger.LogWarning(
                    "Enquiry assignment: every member of role {RoleId} in department {DepartmentId} is on leave; assigning the least-loaded of them anyway.",
                    roleId, departmentId);
            }

            return PickLeastLoaded(candidates, await domainEnq.GetManangerUsersAsync(groupKey));
        }

        /// <summary>
        /// Least-load pick: the candidate with the fewest open tasks wins, and ties are broken at
        /// random so an even workload spreads across equally-loaded members instead of always
        /// landing on the same one (all-zero loads on a freshly cleared queue would otherwise pin
        /// every ticket to one person until they alone accumulate work). A candidate missing from
        /// <paramref name="loadByUser"/> has no open tasks. Single pass — only the current minimum
        /// group is kept, so there is no need to order the whole list.
        /// </summary>
        private static string? PickLeastLoaded(List<UserDepartLogsDto> candidates, Dictionary<string, int>? loadByUser)
        {
            var tied = new List<UserDepartLogsDto>();
            var lowestLoad = int.MaxValue;

            foreach (var candidate in candidates)
            {
                var load = loadByUser != null && loadByUser.TryGetValue(candidate.UserId ?? "", out int count) ? count : 0;
                if (load > lowestLoad) continue;

                if (load < lowestLoad)
                {
                    lowestLoad = load;
                    tied.Clear();
                }

                tied.Add(candidate);
            }

            // Callers filter out empty candidate lists before getting here, so tied is never empty.
            return tied[Random.Shared.Next(tied.Count)].UserId;
        }

        /// <summary>
        /// Removes privileged accounts (super / system administrators) from an auto-assignment pool.
        /// SuperAdminUser is a member — and leader — of nearly every department, so a department-wide
        /// pool would otherwise hand it real tickets. Applied only on the auto-assignment paths: team
        /// rosters and dashboards keep listing those accounts.
        /// </summary>
        private async Task<List<UserDepartLogsDto>> ExcludePrivilegedMembersAsync(List<UserDepartLogsDto> members)
        {
            if (members.Count == 0) return members;

            var excludedUserIds = PrivilegedAssignmentAccounts.ResolveExcludedUserIds();
            var kept = members
                .Where(m => !PrivilegedAssignmentAccounts.IsPrivilegedUserId(excludedUserIds, m.UserId))
                .ToList();
            if (kept.Count == 0) return kept;

            var excludedRoleKeys = PrivilegedAssignmentAccounts.ResolveExcludedRoleKeys();
            var privilegedRoleIds = (await _queryable.GetQueryable<Role>()
                    .AsNoTracking()
                    .Select(r => new { r.Id, r.Name, r.NameEn, r.NameAr })
                    .ToListAsync())
                .Where(r => PrivilegedAssignmentAccounts.IsPrivilegedRole(excludedRoleKeys, r.Id, r.Name, r.NameEn, r.NameAr))
                .Select(r => r.Id)
                .ToList();
            if (privilegedRoleIds.Count == 0) return kept;

            var candidateIds = kept.Select(m => m.UserId!).ToList();
            var privilegedHolders = (await _queryable.GetQueryable<UserRole>()
                    .AsNoTracking()
                    .Where(ur => candidateIds.Contains(ur.UserId) && privilegedRoleIds.Contains(ur.RoleId))
                    .Select(ur => ur.UserId)
                    .ToListAsync())
                .ToHashSet(StringComparer.OrdinalIgnoreCase);

            return privilegedHolders.Count == 0
                ? kept
                : kept.Where(m => !privilegedHolders.Contains(m.UserId!)).ToList();
        }

        public async Task<string?> EnquiryManangerUserAsync(int? enquiryId = null, int? departmentId = (int)DeptEnum.HappinessCenter, string? groupKey = "ManangerUserId")
        {
            //var userDepartMents = await this.GetTeamEnquiriesAsync(departmentId ?? 0);
            var userDepartMents = await this.GetUserDepartmentsLeavelogsAsync(departmentId ?? 0, activeOnly: true);
            var members = await ExcludePrivilegedMembersAsync((userDepartMents ?? new List<UserDepartLogsDto>())
                .Where(w => !string.IsNullOrWhiteSpace(w.UserId))
                .ToList());
            if (members.Count == 0) return null;

            // On-duty members only; if every member is on leave, ignore leave rather than leaving the
            // ticket unassigned. Filtering before the emptiness check also avoids random.Next(0)
            // indexing [0] on an empty list (ArgumentOutOfRangeException).
            var onDuty = members.Where(w => !(w.IsLeave ?? false)).ToList();
            var candidates = members;
            if (onDuty.Count > 0)
            {
                candidates = onDuty;
            }
            else
            {
                _logger.LogWarning(
                    "Enquiry assignment: every member of department {DepartmentId} is on leave; assigning the least-loaded of them anyway.",
                    departmentId);
            }

            return PickLeastLoaded(candidates, await domainEnq.GetManangerUsersAsync(groupKey));
        }

        //private async Task<string> GetDefaultCurstomerDepartmentId()
        //{
        //    await this.GetDepartmentsAsync();
        //    return string.Empty;
        //}

        public async Task<EnquiryCurrentUserInfoDto> GetEnquiryCurrentUserInfoAsync()
        {
            var userId = _currentDomain.UserId;
            // Leadership is read from the user's own department rows, not from the Happiness Center
            // roster: a business department leader is a leader too and must land on the team task
            // queue instead of the personal one. IsCustomerHappness stays "member of department 8",
            // which is what drives the Happiness-Center-only columns and actions.
            var userDepts = await this.GetUserIdDepartmentAsync(userId ?? "");
            var isLeader = userDepts?.Any(d => d.IsLeader ?? false) ?? false;
            var isCustomerHappness = userDepts?.Any(d => d.DepartmentId == (int)DeptEnum.HappinessCenter) ?? false;
            return new EnquiryCurrentUserInfoDto(userId, isLeader, isCustomerHappness);
        }

        /// <summary>
        /// Reassign entry point for the Admin Portal endpoint. Authorizes the caller against the ticket
        /// as it currently stands in the database, then delegates to <see cref="SaveAssignUserAsync"/>,
        /// which the team-management services keep calling directly under their own permission checks.
        /// </summary>
        public async Task<bool> AssignTicketAsync(int enquiryId, EnquiryAssignReqeust request)
        {
            var enquiry = await domainEnq.GetEnquiryByIdAsync(enquiryId);
            if (enquiry == null) throw new BusinessException("The ticket not found.", null, 404);

            await EnsureCanAssignTicketAsync(enquiry, request.UserId);

            return await SaveAssignUserAsync(enquiryId, request);
        }

        public async Task<bool> SaveAssignUserAsync(int enquiryId, EnquiryAssignReqeust request, bool updateManagerUserId = true)
        {
            var enquiry = await domainEnq.GetEnquiryByIdAsync(enquiryId);
            if (enquiry == null)
            {
                return false;
            }
            var originalHandlerUserId = enquiry.HandlerUserId ?? string.Empty;
            var actorUserId = _currentDomain?.UserId ?? string.Empty;
            var changedOn = DateTimeHelper.Now;
            var handlerChanged = HasHandlerChanged(originalHandlerUserId, request.UserId);

            enquiry.HandlerUserId = request.UserId;
            enquiry.UpdatedOn = changedOn;
            if (updateManagerUserId)
            {
                enquiry.ManangerUserId = request.UserId;
            }
            if (handlerChanged)
            {
                var reassignmentTracking = BuildReassignmentTracking(
                    enquiry,
                    actorUserId,
                    request.UserId,
                    changedOn);
                await domainEnq.SaveEnquiryCStatusTrackingAsync(
                    reassignmentTracking.EnquiryId,
                    reassignmentTracking.FromStatusId,
                    reassignmentTracking.ToStatusId,
                    reassignmentTracking.Reason,
                    reassignmentTracking.CreatedBy,
                    reassignmentTracking.HandlerUserId,
                    _currentDomain?.UserProfileId?.ToInt(),
                    reassignmentTracking.DepartmentId,
                    reassignmentTracking.CreatedOn);
            }
            await unit.SaveChangesAsync();

            var enquiryNumber = enquiry.EnquiryNumber;
            var assignUserId = request.UserId ?? string.Empty;
            var issueCategoryId = enquiry.IssueCategoryId;
            // Captured on the request thread, NOT inside the notification closure: notifications run on
            // the background queue after the HTTP response completes, where IHttpContextAccessor.HttpContext
            // is null and _currentDomain.UserId resolves to null.
            await RunEnquiryNotificationInBackground(async sp =>
            {
                var domain = sp.GetRequiredService<IEnquiryDomainService>();
                var sendTemplate = sp.GetRequiredService<ISendTemplateService>();
                var adminUserRepo = sp.GetRequiredService<IBaseRepository<AdminUser>>();
                var proRepo = sp.GetRequiredService<IBaseRepository<UserProfile>>();
                var queryable = sp.GetRequiredService<IQueryableContext>();
                var configuration = sp.GetRequiredService<IConfiguration>();
                var ticketLink = BuildAdminTicketLink(ResolveAdminPortalUrl(configuration), enquiryId);

                var typeObj = new EnquiryTypeDto();

                var types = await domain.GetEnquiryTypesAsync(typeObj.EnquiryIssueCategory, typeObj.EnquiryType);
                var pro = await proRepo.FirstOrDefaultAsync(o => o.UserId == assignUserId);
                var adminUser = await adminUserRepo.FirstOrDefaultAsync(o => o.Id == assignUserId);
                var originalHandler = string.IsNullOrWhiteSpace(originalHandlerUserId)
                    ? null
                    : await adminUserRepo.FirstOrDefaultAsync(o => o.Id == originalHandlerUserId);
                // Reuse the users already loaded above when the actor is one of them; only hit the
                // database when a third party performed the transfer (e.g. a Happiness Center leader).
                var actorUser = string.IsNullOrWhiteSpace(actorUserId) ? null
                    : actorUserId == assignUserId ? adminUser
                    : actorUserId == originalHandlerUserId ? originalHandler
                    : await adminUserRepo.FirstOrDefaultAsync(o => o.Id == actorUserId);

                var enquiryIssueCategory = types.FirstOrDefault(t => t.Scope == typeObj.EnquiryIssueCategory && Convert.ToInt16(t.Code) == issueCategoryId);
                var ticketType = types.FirstOrDefault(t => t.Scope == typeObj.EnquiryType && Convert.ToInt16(t.Code) == enquiry.EnquiryTypeId);
                var priorityTypes = await domain.GetEnquiryPrioritiesAsync();
                var priority = priorityTypes.FirstOrDefault(t => t.Id == enquiry.PriorityId);
                var templateNumber = ResolveAssignUserTemplateNumber(enquiry.EnquiryStatusId);
                var variables = templateNumber == "AP-022"
                    ? new List<TemplateVariable>
                    {
                        new() { Key = "staff_name", Value = ResolveAdminDisplayName(adminUser) },
                        new() { Key = "ticket_number", Value = enquiryNumber },
                        new() { Key = "ticket_type", Value = ticketType?.NameEn ?? string.Empty },
                        new() { Key = "original_handler", Value = ResolveTransferredByName(actorUser, originalHandler) },
                        new() { Key = "sla_deadline", Value = enquiry.DepartmentDeadLine?.ToString(DateTimeHelper.TemplateDateTimeFormat) ?? enquiry.SLAEndTime?.ToString(DateTimeHelper.TemplateDateTimeFormat) ?? string.Empty },
                        new() { Key = "ticket_link", Value = ticketLink },
                    }
                    : new List<TemplateVariable>
                    {
                        new() { Key = "staff_name", Value = ResolveAdminDisplayName(adminUser) },
                        new() { Key = "ticket_number", Value = enquiryNumber },
                        new() { Key = "ticket_type", Value = ticketType?.NameEn ?? string.Empty },
                        new() { Key = "ticket_category", Value = enquiryIssueCategory?.NameEn ?? string.Empty },
                        new() { Key = "priority", Value = priority?.NameEn ?? string.Empty },
                        new() { Key = "sla_deadline", Value = enquiry.SLAEndTime?.ToString(DateTimeHelper.TemplateDateTimeFormat) ?? string.Empty },
                        new() { Key = "ticket_link", Value = ticketLink },
                    };
                await SendEnquiryTemplatesAsync(
                    sendTemplate,
                    queryable,
                    new EnquiryTemplateSendRequest(
                        templateNumber,
                        assignUserId,
                        pro?.Id,
                        variables));
            });

            return true;
        }

        public async Task<List<EnquiryAssignResponse>> GetCurtormerAssignUserAsync()
        {

            var teams = await this.GetUserDepartmentsLeavelogsAsync();
            var userIds = teams.Where(w => !(w.IsLeave ?? false))?.Select(s => s.UserId).ToArray();
            if (userIds?.Any() ?? false)
            {
                var profiles = await GetEnquiryAdminUsersListAsync(userIds);

                return profiles.Where(f => f.UserTypeId == 1).Select(s => new EnquiryAssignResponse(s.UserId, s.NameEn, s.NameAr)).ToList();
            }

            return new List<EnquiryAssignResponse>();
        }

        public async Task<EnquiryApplicationInfoDto?> GetEnquiryApplicationTaskAsync(string? applicationNo)
        {
            var query = from app in _queryable.GetQueryable<ApplicationModel>()
                        join appDetail in _queryable.GetQueryable<ApplicationDetailModel>() on app.Id equals appDetail.ApplicationId
                        from serv in _queryable.GetQueryable<ServiceConfig>().Where(c => c.Id == app.ServiceId).DefaultIfEmpty()
                        from appTask in _queryable.GetQueryable<CamundaTask>().Where(c => c.ProcessInstance.ApplicationId == app.Id).OrderByDescending(c => c.CreatedTime).Take(1).DefaultIfEmpty()
                        where app.ApplicationNumber == applicationNo
                        orderby app.Id
                        select new EnquiryApplicationInfoDto(app.Id, appDetail.Id, app.ApplicationNumber, appTask.TaskId, app.ServiceId, serv.Department);
            // Sub-service applications share their main-service ApplicationNumber; take the main (earliest) row.
            return await query.AsNoTracking().FirstOrDefaultAsync() ?? default(EnquiryApplicationInfoDto);

        }

        public async Task<EnquiryRelatedInfoDto?> GetEnquiryRelatedInfoAsync(int enquiryId)
        {
            var enquiry = await domainEnq.GetEnquiryByIdAsync(enquiryId);

            if (enquiry == null) return default;
            var relatedProfile = await ResolveEnquiryRelatedProfileAsync(enquiry);

            var typeObj = new EnquiryTypeDto();
            var types = await domainEnq.GetEnquiryTypesAsync("ApplicationStatuses", "Refund Status", typeObj.EnquiryAdminStatus);

            var enquiryAdminStatus = types.Where(t => t.Scope == typeObj.EnquiryAdminStatus).ToList() ?? new List<TypeDictionary>();

            //var enquiryServies = await this.GetEnquiryServiceInfosAsync(enquiryId, relatedProfile.ProfileId, enquiryAdminStatus, relatedProfile.CurrentEnquiryOnly);
            var enquiryServies = await this.GetEnquiryServiceInfosBySourceAsync(enquiry, relatedProfile.ProfileId, enquiryAdminStatus);

            var refunds = await this.GetRefundsAsync(relatedProfile.ProfileId, types.Where(t => t.Scope == "Refund Status").ToList());

            var applications = await this.GetEnquriyApplicationsAsync(relatedProfile.ProfileId);

            var appeals = await this.GetAppealsByProfileAsync(relatedProfile.ProfileId);

            var recentEnquiryServies = enquiryServies
            .Where(service => service.CreatedOn >= DateTime.UtcNow.AddHours(4).AddDays(-15))
            .ToList();

            // EnquiryServiceCount is the "total enquiries for this profile" summary figure, aligned with
            // ApplicationCount/RefundCount/AppealCount semantics. enquiryServies is the *related* list
            // (last-15-days, same-source, excluding the current ticket), so it must NOT drive this count.
            var enquiryServiceCount = relatedProfile.ProfileId.HasValue && relatedProfile.ProfileId.Value > 0
            ? await _queryable.GetQueryable<Enquiry>()
            .CountAsync(enq => enq.UserProfileId == relatedProfile.ProfileId)
            : 0;

            return new EnquiryRelatedInfoDto(enquiryId, relatedProfile.ProfileId, relatedProfile.UserTypeId, applications.Count, enquiryServiceCount, refunds.Count(), appeals.Count, recentEnquiryServies, refunds, applications, appeals);
        }

        public async Task<EnquiryApplicantInfo> GetEnquiryTaskApplicantsAsync(int enquiryId)
        {
            var enquiry = await domainEnq.GetEnquiryByIdAsync(enquiryId);

            if (enquiry == null) return default;
            var UserTypeId = 0;

            var queryInfo = from enq in _queryable.GetQueryable<Enquiry>()
                            from u in _queryable.GetQueryable<User>().Where(c => c.Id == enq.CreatedBy).DefaultIfEmpty()
                            from up in _queryable.GetQueryable<UserProfile>().Where(c => c.Id == enq.UserProfileId).DefaultIfEmpty()
                            from upp in _queryable.GetQueryable<Person>().Where(p => p.Id == up.PersonId).DefaultIfEmpty()
                            where enq.Id == enquiryId
                            select new
                            {
                                UserId = enq.CreatedBy,
                                enquiry = enq.Id,
                                enq.UserProfileId,
                                UserName = u.FirstName + " " + u.LastName,
                                u.Email,
                                u.PhoneNumber,
                                PhoneCountryCode = u.PhoneCountryCode,
                                PhoneLocalNumber = u.PhoneLocalNumber,
                                NationalityId = (int?)upp.NationalityId,
                                PersonalName = (string?)upp.Name,
                                PersonalNameAr = upp.NameAr,
                                upp.EmiratesId,
                                PersonalEmail = upp.PersonalEmail,
                                PersonalPhoneNumber = u.PhoneNumber,
                                PhotoUrl = upp.PhotoUrl,
                                upp.EmiratesIdCopyUrl,
                                upp.PassportCopyUrl,
                                upp.VisaCopyUrl,
                                UserTypeId = (short?)up.UserTypeId,
                                up.IsVip,
                                up.Status
                            };

            var userEnquiryInfo = await queryInfo.FirstOrDefaultAsync();
            ValueObj? NationalityObj = null;
            if (userEnquiryInfo?.NationalityId > 0)
            {
                NationalityObj = await _queryable.GetQueryable<Country>().Where(f => f.Id == userEnquiryInfo.NationalityId).Select(s => new ValueObj(s.Id, s.NameEn, s.NameAr)).FirstOrDefaultAsync();
            }
            int documentCounts = 0;
            if (userEnquiryInfo?.PhotoUrl != null) documentCounts++;
            if (userEnquiryInfo?.EmiratesIdCopyUrl != null) documentCounts++;
            if (userEnquiryInfo?.PassportCopyUrl != null) documentCounts++;
            if (userEnquiryInfo?.VisaCopyUrl != null) documentCounts++;

            return new EnquiryApplicantInfo(enquiryId, enquiry.CreatedBy, enquiry.UserProfileId ?? 0, userEnquiryInfo?.UserTypeId,
                enquiry?.CreatedBy, userEnquiryInfo?.Email, ContactNumberHelper.Compose(userEnquiryInfo?.PhoneCountryCode, userEnquiryInfo?.PhoneLocalNumber, userEnquiryInfo?.PhoneNumber), userEnquiryInfo?.UserName,
                userEnquiryInfo?.PhotoUrl, userEnquiryInfo?.PersonalName, userEnquiryInfo?.PersonalNameAr, userEnquiryInfo?.EmiratesId, userEnquiryInfo?.PersonalEmail, userEnquiryInfo?.PersonalPhoneNumber, userEnquiryInfo?.NationalityId, NationalityObj, documentCounts, userEnquiryInfo?.IsVip ?? false, userEnquiryInfo?.PhoneCountryCode, userEnquiryInfo?.PhoneLocalNumber);
        }

        public async Task<List<EnquiryRelatedSubDto>> GetRefundsAsync(int? profileId, List<TypeDictionary> refundStatus)
        {
            if (!profileId.HasValue || profileId.Value <= 0)
            {
                return new List<EnquiryRelatedSubDto>();
            }

            var dataList = await _queryable.GetQueryable<Refund>().Where(f => f.ProfileId == profileId).Select(s => new { s.Id, s.ApplicationNumber, s.CreatedOn, s.StatusId, s.AdditionalComments }).ToListAsync();

            if (dataList == null) return new List<EnquiryRelatedSubDto>();
            return dataList.Select(s =>
                 new EnquiryRelatedSubDto(s.Id, s.ApplicationNumber, s.CreatedOn,
                 new ValueObj(
                     refundStatus.FirstOrDefault(t => Convert.ToInt16(t.Code) == s.StatusId)?.Id ?? 0,
                     refundStatus.FirstOrDefault(t => Convert.ToInt16(t.Code) == s.StatusId)?.NameEn,
                     refundStatus.FirstOrDefault(t => Convert.ToInt16(t.Code) == s.StatusId)?.NameEn)
                 , null, null, s.AdditionalComments)).ToList();
        }

        private async Task<List<EnquiryRelatedSubDto>> GetAppealsByProfileAsync(int? profileId)
        {
            if (!profileId.HasValue || profileId.Value <= 0)
            {
                return new List<EnquiryRelatedSubDto>();
            }
            var dataList = await _queryable.GetQueryable<InspectionViolationAppeal>()
                .AsNoTracking()
                .Where(appeal => appeal.UserProfileId == profileId.Value)
                .OrderByDescending(appeal => appeal.CreatedOn)
                .Select(appeal => new
                {
                    appeal.Id,
                    appeal.AppealNo,
                    appeal.CreatedOn,
                    appeal.StatusId,
                    appeal.AppealReason
                })
                .ToListAsync();

            return dataList.Select(appeal => new EnquiryRelatedSubDto(
                appeal.Id,
                appeal.AppealNo,
                appeal.CreatedOn,
                new ValueObj(appeal.StatusId, GetAppealStatusName(appeal.StatusId)),
                null,
                null,
                appeal.AppealReason)).ToList();
        }

        private static string GetAppealStatusName(int statusId)
        {
            return Enum.IsDefined(typeof(InspectionAppealStatus), statusId)
                ? ((InspectionAppealStatus)statusId).ToString()
                : statusId.ToString();
        }

        public async Task<List<EnquiryRelatedSubDto>> GetEnquriyApplicationsAsync(int? userProfileId)
        {
            if (!userProfileId.HasValue || userProfileId.Value <= 0)
            {
                return new List<EnquiryRelatedSubDto>();
            }

            var query = from app in _queryable.GetQueryable<ApplicationModel>()
                        join appDetail in _queryable.GetQueryable<ApplicationDetailModel>() on app.Id equals appDetail.ApplicationId
                        where app.ProfileId == userProfileId.Value && appDetail.ApplicationStatusId != (short)ApplicationStatusesEnum.Draft
                        select new { app.Id, app.ProfileId, app.ApplicationNumber, app.CreatedOn };

            var dataList = await query.ToListAsync();

            return dataList.Select(app => new EnquiryRelatedSubDto(app.Id, app.ApplicationNumber, app.CreatedOn, null, null, null, null)).ToList();
        }


        #endregion

        public async Task<EnquiryResponseValueObjDto?> GetEnquiryNumberInfoAsync(string email, string enquiryNumber)
        {
            var enquiryId = await (from e in _queryable.GetQueryable<Enquiry>()
                                   join u in _queryable.GetQueryable<User>() on e.CreatedBy equals u.Id
                                   where e.EnquiryNumber == enquiryNumber && u.Email == email
                                   orderby e.CreatedOn descending
                                   select e.Id).FirstOrDefaultAsync();

            if (enquiryId <= 0) return default;
            return (await this.GetEnquiryByIdAsync(enquiryId))!;

        }



        public async Task<bool> GetEnquiryAndTicketSLAExceeded()
        {
            // CustomerPortal is the only Ticket SLA owner; this preserves the legacy Admin contract.
            using var scope = _serviceScopeFactory.CreateScope();
            return await scope.ServiceProvider.GetRequiredService<ICustomerPortalInternalApiClient>()
                .ProcessTicketSlaNotificationsAsync();
        }

        internal static bool CanSendCustomerVisibleMessage(string? managerUserId, string? currentUserId, bool isHappinessLeader)
            => (isHappinessLeader && !string.IsNullOrWhiteSpace(currentUserId))
               || (!string.IsNullOrWhiteSpace(managerUserId)
                   && !string.IsNullOrWhiteSpace(currentUserId)
                   && string.Equals(managerUserId, currentUserId, StringComparison.OrdinalIgnoreCase));

        internal static Expression<Func<Enquiry, bool>> BuildBusinessDepartmentTodoPredicate(
            string? currentUserId,
            bool isHappinessUser)
            => enquiry => !isHappinessUser
                          && !string.IsNullOrWhiteSpace(currentUserId)
                          && enquiry.EnquiryStatusId == (short)EnquiryAdminStatus.DepartmentProcessing
                          && enquiry.HandlerUserId == currentUserId;

        internal static bool CanAddInternalNote(
            Enquiry enquiry,
            string? currentUserId,
            bool isHappinessUser,
            IReadOnlyCollection<int>? leaderDepartmentIds = null)
            => BuildBusinessDepartmentTodoPredicate(currentUserId, isHappinessUser)
                .Compile()
                .Invoke(enquiry)
               || IsBusinessDepartmentLeaderNote(enquiry, currentUserId, isHappinessUser, leaderDepartmentIds);

        /// <summary>
        /// A business department leader may add an internal note on any ticket currently assigned to
        /// a department they lead, mirroring the team task queue scope. Once the ticket leaves
        /// DepartmentProcessing it is back with Customer Happiness and the department is done with it.
        /// </summary>
        internal static bool IsBusinessDepartmentLeaderNote(
            Enquiry enquiry,
            string? currentUserId,
            bool isHappinessUser,
            IReadOnlyCollection<int>? leaderDepartmentIds)
            => !isHappinessUser
               && !string.IsNullOrWhiteSpace(currentUserId)
               && leaderDepartmentIds is { Count: > 0 }
               && enquiry.EnquiryStatusId == (short)EnquiryAdminStatus.DepartmentProcessing
               && enquiry.DepartmentId.HasValue
               && leaderDepartmentIds.Contains(enquiry.DepartmentId.Value);

        /// <summary>
        /// Server-side guard for posting an internal note. Mirrors the appeal/refund contract:
        /// the business-department To-Do handler owns it, and Customer Happiness (staff or leader)
        /// may also add one while the ticket sits in Department Processing.
        /// Distinct from <see cref="CanAddInternalNote"/>, which stays the department-only display flag.
        /// </summary>
        internal static bool CanSendInternalNote(
            Enquiry enquiry,
            string? currentUserId,
            bool isHappinessUser,
            IReadOnlyCollection<int>? leaderDepartmentIds = null)
            => CanAddInternalNote(enquiry, currentUserId, isHappinessUser, leaderDepartmentIds)
               || (isHappinessUser
                   && !string.IsNullOrWhiteSpace(currentUserId)
                   && enquiry.EnquiryStatusId == (short)EnquiryAdminStatus.DepartmentProcessing);

        internal static bool IsCustomerVisibleMessage(short sourceTypeId)
            => sourceTypeId == (short)EnquiryConversationSource.CustomerHappness;

        internal static bool IsInternalNote(short sourceTypeId)
            => sourceTypeId == (short)EnquiryConversationSource.InternalNode;

    }
}
