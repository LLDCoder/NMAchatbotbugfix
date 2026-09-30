using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using UMC.AdminPortal.Application.Dtos.Refunds;
using UMC.AdminPortal.Application.Dtos.UserDto;
using UMC.AdminPortal.Application.Services.Permissions;
using UMC.AdminPortal.Application.Services.SendTemplate;
using UMC.AdminPortal.Application.Services.CustomerPortalInternalApi;
using UMC.AdminPortal.Domain.Models;
using UMC.AdminPortal.Domain.Models.Application;
using UMC.AdminPortal.Domain.Models.Inspection;
using UMC.AdminPortal.Domain.Models.Refunds;
using UMC.AdminPortal.Domain.Service.Account;
using UMC.AdminPortal.Domain.Service.Refunds;
using UMC.AdminPortal.Domain.Service.UserInfo;
using UMC.AdminPortal.Domain.Share;
using UMC.AdminPortal.Domain.Shares.Enums;
using UMC.Utils.Framework.Module.Attributes;
using UMC.Utils.Framework.RestSharpClient;

namespace UMC.AdminPortal.Application.Services.Refunds
{
    [InjectOnScoped]
    public class RefundsAppService : IRefundsAppService
    {
        private readonly IRefundsDomainService _refundsDomainService;
        private readonly ICurrentUserService _currentUserService;
        private readonly IPermissionService _permissionService;
        private readonly IUserService _userService;
        private readonly ISendTemplateService _sendTemplateService;
        private readonly IQueryableContext _queryable;
        private readonly ICustomerPortalInternalApiClient _customerPortalInternalApiClient;
        private readonly IRefundActorAssertionService _refundActorAssertionService;
        public RefundsAppService(
            IRefundsDomainService refundsDomainService,
            ICurrentUserService currentUserService,
            IPermissionService permissionService,
            IConfiguration configuration,
            IUserService userService,
            ISendTemplateService sendTemplateService,
            IQueryableContext queryable,
            ICustomerPortalInternalApiClient customerPortalInternalApiClient,
            IRefundActorAssertionService refundActorAssertionService)
        {
            _refundsDomainService = refundsDomainService;
            _currentUserService = currentUserService;
            _permissionService = permissionService;
            _userService = userService;
            _sendTemplateService = sendTemplateService;
            _queryable = queryable;
            _customerPortalInternalApiClient = customerPortalInternalApiClient;
            _refundActorAssertionService = refundActorAssertionService;
        }

        public async Task<RefundListResponseDto> GetListAsync(RefundListRequestDto request)
        {
            // Non-leader Finance staff only see refunds whose [Payment].[Refunds].HandlerUserId is themselves.
            // Finance-department leaders see everything (no handler restriction). Status/time/search filters are unchanged.
            // Leadership is determined by the [Account].[UserDepartments] row for department 5 (Finance),
            // NOT by the JWT DepartmentId claim (which may be missing or point at another department).
            string? handlerUserIdFilter = null;
            var currentUserId = _currentUserService.UserId;
            if (!string.IsNullOrWhiteSpace(currentUserId))
            {
                var isLeader = await _userService.IsLeaderAsync(
                    currentUserId,
                    ((int)DepartmentEnum.Finance).ToString());
                if (!isLeader)
                {
                    handlerUserIdFilter = currentUserId;
                }
            }

            var result = await _refundsDomainService.GetListAsync(new RefundQueryRequest
            {
                Search = request.Search,
                Status = request.Status,
                StartTime = request.StartTime,
                EndTime = request.EndTime,
                PageIndex = request.PageIndex,
                PageSize = request.PageSize,
                SortBy = request.SortBy,
                SortDirection = request.SortDirection,
                HandlerUserId = handlerUserIdFilter
            });

            var items = result.Items.Select(item => new RefundListItemDto
            {
                RefundNo = item.RefundNo,
                OriginalTransactionNo = item.OriginalTransactionNo,
                Type = item.Type,
                RefundScope = item.RefundScope,
                ApplyFor = new RefundApplyForDto
                {
                UserTypeId = item.ApplyFor.UserTypeId,
                Name = item.ApplyFor.Name,
                IconKey = item.ApplyFor.IconKey
                },
                AccountOrCardHolder = item.AccountOrCardHolder,
                PaymentMethod = item.PaymentMethod,
                Amount = item.Amount,
                Currency = item.Currency,
                Status = item.Status,
                LastUpdatedOn = item.LastUpdatedOn,
                CanExecuteRefund = item.CanExecuteRefund,
                UnsupportedReason = item.UnsupportedReason
            }).ToList();

            // When the caller requests Arabic, translate the enum-backed display fields
            // (type / paymentMethod / status) and resolve the bilingual "applyFor" name from
            // [Core].[Persons] (individuals) or [Core].[Establishments] (establishments).
            if (_currentUserService.IsArabicLanguage)
            {
                await LocalizeRefundListItemsToArabicAsync(items);
            }

            return new RefundListResponseDto
            {
                Items = items,
                PageIndex = result.PageIndex,
                PageSize = result.PageSize,
                TotalCount = result.TotalCount
            };
            }

            /// <summary>
            /// Localizes refund list rows for Arabic callers. The <c>type</c>, <c>paymentMethod</c> and
            /// <c>status</c> fields are backed by fixed enums, so their English display strings are mapped
            /// to Arabic directly. The <c>applyFor</c> name is resolved bilingually by walking
            /// [Payment].[Refunds].ProfileId → establishment ([Account].[UserEstablishments] →
            /// [Core].[Establishments].NameAr) or individual ([Account].[UserProfiles].PersonId →
            /// [Core].[Persons].NameAr). Unresolvable rows keep their original English name.
            /// </summary>
            private async Task LocalizeRefundListItemsToArabicAsync(List<RefundListItemDto> items)
            {
            foreach (var item in items)
            {
                item.Type = MapRefundTypeToArabic(item.Type);
                item.PaymentMethod = MapPaymentMethodToArabic(item.PaymentMethod);
                item.Status = MapRefundStatusToArabic(item.Status);
            }

            var refundNos = items
                .Select(x => x.RefundNo)
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .Distinct()
                .ToList();
            if (refundNos.Count == 0)
            {
                return;
            }

            // RefundNo == [Payment].[Refunds].ApplicationNumber → ProfileId, with fallback through
            // [Payment].[RefundPendingRecords].OriginalTransactionId → [Payment].[Transactions].ProfileId.
            var refundProfiles = await (
                from pendingRecord in _queryable.GetQueryable<RefundPendingRecord>()
                where refundNos.Contains(pendingRecord.RefundNo)
                join refund in _queryable.GetQueryable<Refund>()
                    on pendingRecord.RefundNo equals refund.ApplicationNumber into refundGroup
                from refund in refundGroup.DefaultIfEmpty()
                join transaction in _queryable.GetQueryable<Transaction>()
                    on pendingRecord.OriginalTransactionId equals transaction.Id into transactionGroup
                from transaction in transactionGroup.DefaultIfEmpty()
                join application in _queryable.GetQueryable<ApplicationModel>()
                    on transaction.ApplicationId equals application.Id into applicationGroup
                from application in applicationGroup.DefaultIfEmpty()
                select new
                {
                    pendingRecord.RefundNo,
                    RefundProfileId = refund == null ? null : refund.ProfileId,
                    TransactionProfileId = transaction == null ? null : transaction.ProfileId,
                    ApplicationProfileId = application == null ? null : (int?)application.ProfileId
                })
                .ToListAsync();

            var refundNoToProfileId = new Dictionary<string, int>();
            foreach (var r in refundProfiles)
            {
                var profileId = r.TransactionProfileId ?? r.ApplicationProfileId ?? r.RefundProfileId;
                if (profileId is > 0 && !refundNoToProfileId.ContainsKey(r.RefundNo))
                {
                refundNoToProfileId[r.RefundNo] = profileId.Value;
                }
            }

            if (refundNoToProfileId.Count == 0)
            {
                return;
            }

            var profileIds = refundNoToProfileId.Values.Distinct().ToList();
            var profiles = await _queryable.GetQueryable<UserProfile>()
                .Where(up => profileIds.Contains(up.Id))
                .Select(up => new { up.Id, up.PersonId, up.UserTypeId })
                .ToListAsync();
            var profileMap = profiles.ToDictionary(up => up.Id);
            var userTypeIds = profiles.Select(up => up.UserTypeId).Distinct().ToList();
            var userTypes = userTypeIds.Count == 0
                ? new Dictionary<short, string>()
                : await _queryable.GetQueryable<UserType>()
                .Where(ut => userTypeIds.Contains(ut.Id))
                .Select(ut => new { ut.Id, ut.Code })
                .ToDictionaryAsync(ut => ut.Id, ut => ut.Code);

            // Establishment profiles: [Account].[UserEstablishments].UserProfileId → EstablishmentId
            var establishmentLinks = await _queryable.GetQueryable<UserEstablishment>()
                .Where(ue => profileIds.Contains(ue.UserProfileId))
                .Select(ue => new { ue.UserProfileId, ue.EstablishmentId })
                .ToListAsync();

            var establishmentProfileMap = establishmentLinks
                .GroupBy(x => x.UserProfileId)
                .ToDictionary(g => g.Key, g => g.First().EstablishmentId);

            var establishmentIds = establishmentProfileMap.Values.Distinct().ToList();
            var establishmentNames = establishmentIds.Count == 0
                ? new Dictionary<int, string?>()
                : await _queryable.GetQueryable<Establishment>()
                .Where(e => establishmentIds.Contains(e.Id))
                .Select(e => new { e.Id, e.NameAr })
                .ToDictionaryAsync(e => e.Id, e => (string?)e.NameAr);

            // Individual profiles: [Account].[UserProfiles].PersonId → [Core].[Persons].NameAr.
            // Decide "individual" from [Account].[UserProfiles].UserTypeId / [Account].[UserTypes].Code,
            // not from the absence of a UserEstablishments row; otherwise personal rows with any stale
            // establishment link resolve the establishment Arabic name.
            var profileToPersonId = profiles
                .Where(up => up.PersonId > 0)
                .ToDictionary(up => up.Id, up => up.PersonId);

            var personIds = profileToPersonId.Values.Distinct().ToList();
            var personNames = personIds.Count == 0
                ? new Dictionary<int, string?>()
                : await _queryable.GetQueryable<Person>()
                .Where(p => personIds.Contains(p.Id))
                .Select(p => new { p.Id, p.NameAr })
                .ToDictionaryAsync(p => p.Id, p => p.NameAr);

            foreach (var item in items)
            {
                if (!refundNoToProfileId.TryGetValue(item.RefundNo, out var profileId))
                {
                continue;
                }

                string? arabicName = null;
                var isIndividual = (profileMap.TryGetValue(profileId, out var profile)
                        && IsIndividualUserType(profile.UserTypeId, userTypes))
                    || item.ApplyFor.UserTypeId == (short)UserTypeCode.Individual
                    || item.ApplyFor.UserTypeId == (short)UserTypeIdEnum.Individual;
                if (isIndividual
                    && profileToPersonId.TryGetValue(profileId, out var personId)
                    && personNames.TryGetValue(personId, out var personNameAr))
                {
                arabicName = personNameAr;
                }
                else if (establishmentProfileMap.TryGetValue(profileId, out var establishmentId)
                && establishmentNames.TryGetValue(establishmentId, out var establishmentNameAr))
                {
                arabicName = establishmentNameAr;
                }

                if (!string.IsNullOrWhiteSpace(arabicName))
                {
                item.ApplyFor.Name = arabicName;
                }
            }
            }

            private static bool IsIndividualUserType(short userTypeId, Dictionary<short, string> userTypes)
            {
                return userTypeId == (short)UserTypeIdEnum.Individual
                    || (userTypes.TryGetValue(userTypeId, out var code)
                        && (string.Equals(code, ((short)UserTypeCode.Individual).ToString(), StringComparison.OrdinalIgnoreCase)
                            || string.Equals(code, nameof(UserTypeCode.Individual), StringComparison.OrdinalIgnoreCase)));
            }
            private static string MapRefundTypeToArabic(string type) => type switch
            {
            "Refund" => "استرداد",
            _ => type
            };

            private static string MapPaymentMethodToArabic(string paymentMethod) => paymentMethod switch
            {
            "Credit / Debit Card" => "بطاقة ائتمان / خصم",
            "Wallet" => "محفظة",
            "Unknown" => "غير معروف",
            _ => paymentMethod
            };

            private static string MapRefundStatusToArabic(string status) => status switch
            {
            "Pending Refund" => "في انتظار الاسترداد",
            "Completed" => "مكتمل",
            "Refunded" => "تم الاسترداد",
            _ => status
            };

        public async Task<RefundDetailDto> GetDetailAsync(string refundNo)
        {
            var result = await _refundsDomainService.GetDetailAsync(refundNo);
            var detail = new RefundDetailDto
            {
                RefundNo = result.RefundNo,
                Status = result.Status,
                LastUpdatedOn = result.LastUpdatedOn,
                Type = result.Type,
                ApplicationInformation = new RefundApplicationInformationDto
                {
                    PaymentMethod = result.ApplicationInformation.PaymentMethod,
                    AccountOrCardHolder = result.ApplicationInformation.AccountOrCardHolder,
                    CardInformation = result.ApplicationInformation.CardInformation,
                    Email = result.ApplicationInformation.Email,
                    ApplyFor = result.ApplicationInformation.ApplyFor,
                    AmountCharged = result.ApplicationInformation.AmountCharged,
                    Currency = result.ApplicationInformation.Currency,
                    RefundScope = result.ApplicationInformation.RefundScope,
                    RefundReason = result.ApplicationInformation.RefundReason
                },
                FailureReason = result.FailureReason == null
                    ? null
                    : new RefundFailureReasonDto
                    {
                        IsVisible = result.FailureReason.IsVisible,
                        Message = result.FailureReason.Message,
                        LastExecutionStatus = result.FailureReason.LastExecutionStatus,
                        LastUpdatedOn = result.FailureReason.LastUpdatedOn
                    },
                RelatedPaymentInformation = new RefundRelatedPaymentDto
                {
                    TransactionNo = result.RelatedPaymentInformation.TransactionNo,
                    Status = result.RelatedPaymentInformation.Status,
                    TransactionType = result.RelatedPaymentInformation.TransactionType,
                    LastUpdatedOn = result.RelatedPaymentInformation.LastUpdatedOn,
                    PaymentMethod = result.RelatedPaymentInformation.PaymentMethod,
                    CardInformation = result.RelatedPaymentInformation.CardInformation,
                    AmountCharged = result.RelatedPaymentInformation.AmountCharged,
                    Currency = result.RelatedPaymentInformation.Currency,
                    ApplyFor = result.RelatedPaymentInformation.ApplyFor,
                    Description = result.RelatedPaymentInformation.Description
                },
                CanExecuteRefund = result.CanExecuteRefund,
                UnsupportedReason = result.UnsupportedReason
            };

            var canViewFailureReason = await CurrentUserHasPermissionAsync(AccountPermissionCodes.Finance.Refund.FailReason);
            if (!canViewFailureReason)
            {
                detail.FailureReason = null;
            }

            // ── Overview identity fields ──
// ── Overview identity fields ──
            try
            {
                // Load the Refund row to get ProfileId, CategoryId, ReferenceNumber
                var refundRow = await _queryable.GetQueryable<Refund>()
                    .Where(r => r.ApplicationNumber == refundNo)
                    .Select(r => new { r.ProfileId, r.CategoryId, r.ReferenceNumber })
                    .FirstOrDefaultAsync();

                if (refundRow?.CategoryId == 1)
                {
                    // ── Violation refund path ──
                    // ReferenceNumber links to InspectionViolation (ViolationNo or Id).
                    // Chain: Violation.SourceTaskId → InspectionTask → identity fields.
                    int? sourceTaskId = null;
                    if (!string.IsNullOrEmpty(refundRow.ReferenceNumber))
                    {
                        // Try parse as int (ViolationId) first, fall back to ViolationNo
                        if (int.TryParse(refundRow.ReferenceNumber, out var violationId))
                        {
                            sourceTaskId = await _queryable.GetQueryable<InspectionViolation>()
                                .Where(v => v.Id == violationId)
                                .Select(v => v.SourceTaskId)
                                .FirstOrDefaultAsync();
                        }
                        else
                        {
                            sourceTaskId = await _queryable.GetQueryable<InspectionViolation>()
                                .Where(v => v.ViolationNo == refundRow.ReferenceNumber)
                                .Select(v => v.SourceTaskId)
                                .FirstOrDefaultAsync();
                        }
                    }

                    if (sourceTaskId is > 0)
                    {
                        var task = await _queryable.GetQueryable<InspectionTask>()
                            .Where(t => t.Id == sourceTaskId.Value)
                            .Select(t => new { t.EstablishmentId, t.IndividualId })
                            .FirstOrDefaultAsync();

                        if (task != null)
                        {
                            int? userProfileId = null;

                            if (task.IndividualId is > 0)
                            {
                                // Individual case: IndividualId == UserProfiles.Id
                                detail.IndividualId = task.IndividualId;
                                userProfileId = task.IndividualId;
                                detail.UserProfileId = userProfileId;
                                detail.ProfileId = userProfileId;
                            }
                            else if (task.EstablishmentId is > 0)
                            {
                                detail.EstablishmentId = task.EstablishmentId;
                                detail.IndividualId = null;

                                // Establishment → UserEstablishment → UserProfileId
                                var ue = await _queryable.GetQueryable<UserEstablishment>()
                                    .Where(x => x.EstablishmentId == task.EstablishmentId.Value)
                                    .Select(x => new { x.UserProfileId })
                                    .FirstOrDefaultAsync();
                                if (ue != null)
                                {
                                    userProfileId = ue.UserProfileId;
                                    detail.UserProfileId = userProfileId;
                                    detail.ProfileId = userProfileId;
                                }

                                // Establishment → name & license
                                var estab = await _queryable.GetQueryable<Establishment>()
                                    .Where(e => e.Id == task.EstablishmentId.Value)
                                    .Select(e => new { e.NameEn, e.NameAr, e.LicenseNumber })
                                    .FirstOrDefaultAsync();
                                if (estab != null)
                                {
                                    detail.EstablishmentName = estab.NameEn;
                                    detail.EstablishmentNameAr = estab.NameAr;
                                    detail.LicenseNumber = estab.LicenseNumber;
                                    detail.ApplyFor = estab.NameEn;
                                    detail.ApllyFor = estab.NameEn;
                                }
                            }

                            // Resolve UserProfile → UserId, UserTypeId → UserType.Code
                            if (userProfileId is > 0)
                            {
                                var up = await _queryable.GetQueryable<UserProfile>()
                                    .Where(x => x.Id == userProfileId.Value)
                                    .Select(x => new { x.UserId, x.UserTypeId })
                                    .FirstOrDefaultAsync();
                                if (up != null)
                                {
                                    detail.UserId = up.UserId;
                                    detail.UserTypeId = up.UserTypeId;

                                    if (up.UserTypeId > 0)
                                    {
                                        var utCode = await _queryable.GetQueryable<UserType>()
                                            .Where(ut => ut.Id == up.UserTypeId)
                                            .Select(ut => ut.Code)
                                            .FirstOrDefaultAsync();
                                        detail.UserTypeCode = utCode ?? up.UserTypeId.ToString();
                                    }
                                }
                            }
                        }
                    }
                    // CategoryId=1: no applicationId/applicationNumber
                }
                else
                {
                    // ── Normal (non-violation) refund path ──
                    var refundEntity = await _refundsDomainService.GetAsync(refundNo);
                    if (refundEntity?.ProfileId != null)
                    {
                        var profileId = refundEntity.ProfileId.Value;
                        detail.ProfileId = profileId;

                        // Check if a UserEstablishment record exists for this profile
                        var userEstablishment = await _queryable.GetQueryable<UserEstablishment>()
                            .Where(ue => ue.UserProfileId == profileId)
                            .Select(ue => new { ue.EstablishmentId })
                            .FirstOrDefaultAsync();

                        int userProfileId;

                        if (userEstablishment != null)
                        {
                            // Establishment case
                            detail.EstablishmentId = userEstablishment.EstablishmentId;
                            detail.IndividualId = null;
                            userProfileId = profileId;
                            detail.UserProfileId = userProfileId;

                            // Look up Establishment for name & license
                            var estab = await _queryable.GetQueryable<Establishment>()
                                .Where(e => e.Id == userEstablishment.EstablishmentId)
                                .Select(e => new { e.NameEn, e.NameAr, e.LicenseNumber })
                                .FirstOrDefaultAsync();
                            if (estab != null)
                            {
                                detail.EstablishmentName = estab.NameEn;
                                detail.EstablishmentNameAr = estab.NameAr;
                                detail.LicenseNumber = estab.LicenseNumber;
                                detail.ApplyFor = estab.NameEn;
                                detail.ApllyFor = estab.NameEn;
                            }
                        }
                        else
                        {
                            // Individual case — IndividualId equals ProfileId
                            detail.IndividualId = profileId;
                            userProfileId = profileId;
                            detail.UserProfileId = userProfileId;
                        }

                        // Resolve UserProfile → UserId, UserTypeId
                        var userProfile = await _queryable.GetQueryable<UserProfile>()
                            .Where(up => up.Id == userProfileId)
                            .Select(up => new { up.UserId, up.UserTypeId })
                            .FirstOrDefaultAsync();
                        if (userProfile != null)
                        {
                            detail.UserId = userProfile.UserId;
                            detail.UserTypeId = userProfile.UserTypeId;

                            // Resolve UserType.Code from lookup
                            if (userProfile.UserTypeId > 0)
                            {
                                var userTypeCode = await _queryable.GetQueryable<UserType>()
                                    .Where(ut => ut.Id == userProfile.UserTypeId)
                                    .Select(ut => ut.Code)
                                    .FirstOrDefaultAsync();
                                detail.UserTypeCode = userTypeCode ?? userProfile.UserTypeId.ToString();
                            }
                        }

                        // Application lookup via Refund.ReferenceNumber → [Application].[Applications]
                        if (!string.IsNullOrEmpty(refundRow?.ReferenceNumber))
                        {
                            var app = await _queryable.GetQueryable<ApplicationModel>()
                                .Where(a => a.ApplicationNumber == refundRow.ReferenceNumber)
                                .Select(a => new { a.Id, a.ApplicationNumber })
                                .FirstOrDefaultAsync();
                            if (app != null)
                            {
                                detail.ApplicationId = app.Id;
                                detail.ApplicationNumber = app.ApplicationNumber;
                            }
                        }
                    }
                }
            }
            catch
            {
                // identity fields are best-effort; do not fail the detail response
            }

            return detail;
        }
      
        public async Task<RefundStatisticsDto> GetStatisticsAsync()
        {
            var result = await _refundsDomainService.GetStatisticsAsync();
            return new RefundStatisticsDto
            {
                TotalRefundAmount = new RefundAmountStatisticsDto
                {
                    WalletRefundAmount = result.TotalRefundAmount.WalletRefundAmount,
                    CardRefundAmount = result.TotalRefundAmount.CardRefundAmount,
                    TotalRefundAmount = result.TotalRefundAmount.TotalRefundAmount,
                    Hint = result.TotalRefundAmount.Hint
                },
                TotalRefundCount = new RefundCountStatisticsDto
                {
                    WalletRefundCount = result.TotalRefundCount.WalletRefundCount,
                    CardRefundCount = result.TotalRefundCount.CardRefundCount,
                    TotalRefundCount = result.TotalRefundCount.TotalRefundCount,
                    Hint = result.TotalRefundCount.Hint
                },
                PendingRefundCount = result.PendingRefundCount,
                PendingRefundAmount = result.PendingRefundAmount,
                Currency = result.Currency
            };
        }

        public async Task<ExecuteRefundResponseDto> ExecuteAsync(string refundNo, ExecuteRefundRequestDto request)
        {
            var result = await _refundsDomainService.ExecuteAsync(refundNo, new RefundExecutionRequest
            {
                RefundNo = string.IsNullOrWhiteSpace(request.RefundNo) ? refundNo : request.RefundNo,
                OperatorId = request.OperatorId,
                OperatorName = request.OperatorName,
                ExpectedLastUpdatedOn = request.ExpectedLastUpdatedOn
            });
            if (result.IsSuccess)
            {
                // AP-036 is the Finance hand-off notification and is sent when the refund enters
                // PendingRefund. A successful payout execution is the customer-facing CP-028 moment only.
                //CP-028
                await SendRefundCompletedCustomerNotificationAsync(result);
            }
            return new ExecuteRefundResponseDto
            {
                IsSuccess = result.IsSuccess,
                BusinessStatus = result.BusinessStatus,
                TransactionStatus = result.TransactionStatus,
                Message = result.Message,
                FailureReason = result.FailureReason,
                RefundNo = result.RefundNo,
                OriginalTransactionNo = result.OriginalTransactionNo,
                RefundTransactionNo = result.RefundTransactionNo,
                LastUpdatedOn = result.LastUpdatedOn,
                CanRetry = result.CanRetry
            };
        }
        /// <summary>
        /// Sends CP-028 "Refund Completed Successfully" to the customer once Finance has executed the
        /// payout.
        /// </summary>
        /// <remarks>
        /// This is the only correct trigger for CP-028, because the template states the money has been
        /// credited. The earlier Customer Happiness approval merely queues the refund for execution and
        /// is announced to the customer with CP-026 from the Customer Portal service.
        /// The greeting comes from the applicant name captured on the pending record, so an
        /// establishment refund is addressed to the establishment rather than to the operator account.
        /// </remarks>
        private async Task SendRefundCompletedCustomerNotificationAsync(RefundExecutionResult result)
        {
            try
            {
                var refund = await _refundsDomainService.GetAsync(result.RefundNo);
                if (refund?.ProfileId is not > 0)
                {
                    return;
                }

                // The payer is a Customer Portal account, so resolve it through
                // [Account].[UserProfiles] → [Account].[Users]. IUserService.GetByProfileIdAsync reads
                // [Account].[AdminUsers] instead and therefore never matches a customer, which silently
                // suppressed every CP-028.
                var profileOwnerUserId = await _queryable.GetQueryable<UserProfile>()
                    .AsNoTracking()
                    .Where(up => up.Id == refund.ProfileId.Value)
                    .Select(up => up.UserId)
                    .FirstOrDefaultAsync();
                if (string.IsNullOrWhiteSpace(profileOwnerUserId))
                {
                    return;
                }

                var user = await _queryable.GetQueryable<User>()
                    .AsNoTracking()
                    .Where(u => u.Id == profileOwnerUserId)
                    .Select(u => new { u.Id, u.FirstName, u.LastName, u.Email })
                    .FirstOrDefaultAsync();
                if (string.IsNullOrWhiteSpace(user?.Id))
                {
                    return;
                }

                var pendingRecord = await _queryable.GetQueryable<RefundPendingRecord>()
                    .AsNoTracking()
                    .FirstOrDefaultAsync(x => x.RefundNo == result.RefundNo);

                var customerName = pendingRecord?.ApplyForName?.Trim();
                if (string.IsNullOrWhiteSpace(customerName))
                {
                    customerName = $"{user.FirstName} {user.LastName}".Trim();
                }

                var variables = new List<TemplateVariable>
                {
                    new() { Key = "customer_name", Value = customerName },
                    new() { Key = "refund_number", Value = result.RefundNo },
                    new() { Key = "refund_amount", Value = refund.RefundAmount.ToString("0.00") },
                    new() { Key = "completion_date", Value = result.LastUpdatedOn.ToString("yyyy-MM-dd") },
                    new() { Key = "transaction_number", Value = string.IsNullOrWhiteSpace(result.RefundTransactionNo)
                        ? result.OriginalTransactionNo
                        : result.RefundTransactionNo },
                };

                var customerEmail = string.IsNullOrWhiteSpace(pendingRecord?.Email) ? user.Email : pendingRecord.Email;
                await _sendTemplateService.GetSendTemplateForEstablishmentProfile(
                    "CP-028",
                    user.Id,
                    refund.ProfileId.Value,
                    variables,
                    customerEmail);
            }
            catch (Exception)
            {
                // A notification failure must never roll back a refund that the gateway already settled.
            }
        }

        private async Task<bool> CurrentUserHasPermissionAsync(string permissionCode)
        {
            return await _permissionService.HasPermissionAsync(permissionCode);
        }

        public Task<TResponse?> GetCustomerPortalRefundAsync<TResponse>(string relativePath, CancellationToken cancellationToken = default)
            => _customerPortalInternalApiClient.GetRefundAsync<TResponse>(relativePath, cancellationToken);

        public Task<TResponse?> GetCustomerPortalRefundAsync<TResponse>(
            string relativePath,
            string action,
            int refundId,
            CancellationToken cancellationToken = default)
            => _customerPortalInternalApiClient.GetRefundAsync<TResponse>(
                relativePath,
                _refundActorAssertionService.CreateHeaders(action, refundId),
                cancellationToken);

        public Task<TResponse?> PostCustomerPortalRefundAsync<TRequest, TResponse>(
            string relativePath,
            TRequest request,
            string action,
            int refundId,
            CancellationToken cancellationToken = default)
            => _customerPortalInternalApiClient.PostRefundAsync<TRequest, TResponse>(
                relativePath,
                request,
                _refundActorAssertionService.CreateHeaders(action, refundId),
                cancellationToken);

        public Task<UMC.AdminPortal.Application.Dtos.CustomerPortalInternalApi.CustomerPortalCertificatePdfDownloadResult> DownloadCustomerPortalRefundExportAsync(
            string relativePath,
            CancellationToken cancellationToken = default)
            => _customerPortalInternalApiClient.DownloadRefundExportAsync(relativePath, cancellationToken);

        public Task<UMC.AdminPortal.Application.Dtos.CustomerPortalInternalApi.CustomerPortalCertificatePdfDownloadResult> DownloadCustomerPortalRefundExportAsync(
            string relativePath,
            string action,
            CancellationToken cancellationToken = default)
            => _customerPortalInternalApiClient.DownloadRefundExportAsync(
                relativePath,
                _refundActorAssertionService.CreateHeaders(action, 0),
                cancellationToken);
    }
}
