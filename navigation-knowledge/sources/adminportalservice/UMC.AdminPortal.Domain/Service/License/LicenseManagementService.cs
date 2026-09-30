using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using UMC.AdminPortal.Domain.Shares;
using UMC.AdminPortal.Domain.Shares.Enums;
using UMC.AdminPortal.Domain.Models;
using UMC.AdminPortal.Domain.Models.Application;
using UMC.AdminPortal.Domain.Models.License;
using UMC.AdminPortal.Domain.Models.ServiceCertificate;
using UMC.AdminPortal.Domain.Service.UserInfo;
using UMC.AdminPortal.Domain.Share;
using UMC.AdminPortal.Infrastructure.Models;
using MC.AdminPortal.Domain.Models;
using UMC.Utils.Framework.Helps;
using UMC.Utils.Framework.Module.Attributes;
using UMC.Utils.Framework.Page;

namespace UMC.AdminPortal.Domain.Service.License
{
    /// <summary>
    /// License management service implementation
    /// </summary>
    [InjectOnScoped]
    public class LicenseManagementService : ILicenseManagementService
    {
        // A licence can cover several media activities; the list renders them in one cell.
        private const string MediaActivitySeparator = ", ";

        // The submitted form can declare several works (a book list, a material list), all rendered in
        // one cell, the same way media activities are.
        private const string SubmittedValueSeparator = ", ";

        // How deep the reader is allowed to walk into a submitted form before giving up. Forms nest a
        // few levels at most (step -> formValues -> section -> row); the cap only stops a pathological
        // document from costing the whole page.
        private const int SubmittedFormMaxDepth = 12;

        /// <summary>
        /// Field names the applicant fills the title of the work into. Every content service spells it
        /// differently - 203 "PublicationTitle", 204 "BookTitle", 1101/1102 "publicationTitle",
        /// 30x "title" inside a material or book row - so the reader matches the field name wherever it
        /// sits in the submitted form instead of pinning one path per service, and a service whose form
        /// has none of them simply yields nothing.
        /// </summary>
        private static readonly HashSet<string> SubmittedTitleKeys = new(StringComparer.OrdinalIgnoreCase)
        {
            "title",
            "publicationTitle",
            "bookTitle",
            "publication_title"
        };

        /// <summary>
        /// Field names carrying the author or the publishing house. Both feed the single
        /// Author/Publishing House column: no content service asks for both, so they never collide.
        /// The film services' "filmWriter" is deliberately NOT read here - it is a writer credit, not
        /// the author of a published work.
        /// </summary>
        private static readonly HashSet<string> SubmittedAuthorKeys = new(StringComparer.OrdinalIgnoreCase)
        {
            "authorName",
            "author",
            "publishingHouse"
        };

        private readonly IQueryableContext _queryableContext;
        private readonly IBaseRepository<ApplicationModel> _applicationRepository;
        private readonly IBaseRepository<ApplicationDetailModel> _applicationDetailRepository;
        private readonly IBaseRepository<Certificate> _certificateRepsitory;
        private readonly IUnitOfWork _unitOfWork;
        private readonly ICurrentUserService _currentUserService;

        public LicenseManagementService(IQueryableContext queryableContext, IBaseRepository<ApplicationModel> applicationRepository,
            IBaseRepository<ApplicationDetailModel> applicationDetailRepository, ICurrentUserService currentUserService,
            IBaseRepository<Certificate> certificateRepsitory, IUnitOfWork unitOfWork)
        {
            _queryableContext = queryableContext;
            _applicationRepository = applicationRepository;
            _applicationDetailRepository = applicationDetailRepository;
            _certificateRepsitory = certificateRepsitory;
            _unitOfWork = unitOfWork;
            _currentUserService = currentUserService;
        }

        public async Task<(int Total, IEnumerable<LicenseListItem> Items)> GetLicenseListAsync(
            PageRequest request,
            string? keyword,
            string? status,
            string? licenseType,
            DateTime? issuanceDateStart,
            DateTime? issuanceDateEnd,
            DateTime? expirationDateStart,
            DateTime? expirationDateEnd,
            string? sortBy = null,
            bool isDescending = true,
            string? userId = null,
            int? profileId = null,
            int? Department = null)
        {
            // Validate and normalize pagination parameters
            var pageIndex = request.PageIndex > 0 ? request.PageIndex : 1;
            var pageSize = request.PageSize > 0 ? request.PageSize : 10;

            // Get current time once for use in queries and calculations
            var now = DateTimeHelper.Now;

            // Query licenses from database using raw SQL or LINQ
            // Since MediaLicenses and Certificates are in Application schema, we need to query them directly
            // JOIN with Establishment, User, UserProfile, and Person to get applicant information
            var query = from cert in _queryableContext.GetQueryable<Certificate>()
                        join appDetail in _queryableContext.GetQueryable<ApplicationDetailModel>() on cert.ApplicationDetailId equals appDetail.Id
                        join app in _queryableContext.GetQueryable<ApplicationModel>() on appDetail.ApplicationId equals app.Id

                        join user in _queryableContext.GetQueryable<User>() on app.UserId equals user.Id into userGroup
                        from user in userGroup.DefaultIfEmpty()
                            // JOIN UserProfile to get PersonId for personal applicants
                        from userProfile in _queryableContext.GetQueryable<UserProfile>().Where(up => user != null && up.UserId == user.Id && up.Id == app.ProfileId).DefaultIfEmpty()

                            // JOIN Person to get person name
                        join person in _queryableContext.GetQueryable<Person>() on (userProfile != null ? userProfile.PersonId : (int?)null) equals person.Id into personGroup
                        from person in personGroup.DefaultIfEmpty()

                        from userEst in _queryableContext.GetQueryable<UserEstablishment>().Where(ue => ue.UserProfileId == app.ProfileId).DefaultIfEmpty()
                        from est in _queryableContext.GetQueryable<Establishment>().Where(e => userEst != null && e.Id == userEst.EstablishmentId).DefaultIfEmpty()

                            // JOIN Service to get license type
                        join service in _queryableContext.GetQueryable<ServiceConfig>() on app.ServiceId equals service.Id into serviceGroup
                        from service in serviceGroup.DefaultIfEmpty()

                        where app.IsDelete == false
                            && (string.IsNullOrWhiteSpace(userId) || app.UserId == userId)
                            && (!profileId.HasValue || app.ProfileId == profileId.Value)
                        select new
                        {
                            CertificateId = cert.Id,
                            ApplicationNumber = app.ApplicationNumber,
                            LicenseNumber = cert.CertificateNo,
                            // Licenses that own a media-license shell are identified by the media license
                            // number printed on the issued document, not by the certificate number, so that
                            // is what the License No. column renders. Resolve it through the same chain the
                            // certificate renderer uses - the application's MedialLicenseId first, then the
                            // shell created on the certificate's application detail. Rows with no shell
                            // (permits) stay null and fall back to the certificate number.
                            MediaLicenseNumber = _queryableContext.GetQueryable<MediaLicense>()
                                .Where(mediaLicense => app.MedialLicenseId.HasValue
                                    && mediaLicense.Id == app.MedialLicenseId.Value)
                                .Select(mediaLicense => mediaLicense.MediaLicenseNumber)
                                .FirstOrDefault()
                                ?? _queryableContext.GetQueryable<MediaLicense>()
                                    .Where(mediaLicense => mediaLicense.ApplicationDetailId == appDetail.Id)
                                    .OrderByDescending(mediaLicense => mediaLicense.Id)
                                    .Select(mediaLicense => mediaLicense.MediaLicenseNumber)
                                    .FirstOrDefault(),
                            // Media-license shell behind this certificate, resolved the same way as
                            // MediaLicenseNumber above (application anchor first, then the shell created on
                            // the certificate's application detail). Used to read the licence's media
                            // activities; null for rows that own no shell.
                            MedialLicenseId = app.MedialLicenseId ?? _queryableContext.GetQueryable<MediaLicense>()
                                .Where(mediaLicense => mediaLicense.ApplicationDetailId == appDetail.Id)
                                .OrderByDescending(mediaLicense => mediaLicense.Id)
                                .Select(mediaLicense => (int?)mediaLicense.Id)
                                .FirstOrDefault(),
                            ApplicationDetailId = appDetail.Id,
                            ApplicationId = app.Id,
                            userTypeId = userProfile != null ? userProfile.UserTypeId : (short?)null,
                            ServiceId = app.ServiceId,
                            DepartmentId = service != null ? service.Department : (int?)null,
                            // For Certificate: use IssueDate/ExpiryDate directly
                            IssuanceTime = cert.IssueDate,
                            // ExpirationTime will be calculated in memory for MediaLicense (AddYears cannot be translated to SQL)
                            ExpirationTime = cert.ExpiryDate,
                            CertificateUrl = cert.CertificateUrl,
                            // Store raw data for status calculation (cannot call DetermineStatus in LINQ to SQL)
                            // For MediaLicense, ExpiryDate = CreatedOn + YearsOfLicense (calculated in memory)
                            ExpiryDate = cert.ExpiryDate,
                            ApplicationStatusId = appDetail.ApplicationStatusId,
                            CertificateStatus = cert.Status,
                            CertificatePassword = cert.CertificatePassword,
                            DisabledReason = cert.DisabledReason,
                            Remarks = cert.Remarks,
                            // Store raw data for DaysRemaining calculation (DateTime.Now cannot be used in LINQ to SQL)
                            CertExpiryDate = cert.ExpiryDate,
                            CertIssueDate = cert.IssueDate,
                            // Applicant information - store raw data to avoid string interpolation in LINQ
                            EstablishmentId = app.EstablishmentId,
                            EstNameEn = est != null ? est.NameEn : null,
                            EstNameAr = est != null ? est.NameAr : null,
                            PersonName = person != null ? person.Name : null,
                            UserFirstName = user != null ? user.FirstName : null,
                            UserLastName = user != null ? user.LastName : null,
                            UserName = user != null ? user.UserName : null,
                            ApplicantType = userProfile != null && userProfile.UserTypeId > 1 ? "Establishment" : "Person",
                            // Service information
                            ServiceNameEn = cert != null ? cert.CertificateNameEn : "Unknown",
                            ServiceNameAr = cert != null ? cert.CertificateNameAr : "غير معروف"
                        };

            // Apply filters that can be translated to SQL
            if (!string.IsNullOrWhiteSpace(keyword))
            {
                var normalizedKeyword = keyword.Trim();
                // The media license number is a different value from the certificate number, and it is what
                // the grid now shows in the License No. column, so a search for a number read off the grid
                // must match it too - otherwise a valid license number returns an empty list.
                query = query.Where(x => x.ApplicationNumber.Contains(normalizedKeyword) ||
                                        x.LicenseNumber.Contains(normalizedKeyword) ||
                                        (x.MediaLicenseNumber != null && x.MediaLicenseNumber.Contains(normalizedKeyword)) ||
                                        x.ServiceNameEn.Contains(normalizedKeyword) ||
                                        x.ServiceNameAr.Contains(normalizedKeyword) ||
                                        (x.EstNameEn != null && x.EstNameEn.Contains(normalizedKeyword)) ||
                                        (x.EstNameAr != null && x.EstNameAr.Contains(normalizedKeyword)) ||
                                        (x.PersonName != null && x.PersonName.Contains(normalizedKeyword)) ||
                                        (x.UserFirstName != null && x.UserFirstName.Contains(normalizedKeyword)) ||
                                        (x.UserLastName != null && x.UserLastName.Contains(normalizedKeyword)) ||
                                        (x.UserName != null && x.UserName.Contains(normalizedKeyword)));
            }
            if (Department != null && Department != 0)
            {
                query = query.Where(x => x.DepartmentId == Department);
            }

            if (issuanceDateStart.HasValue)
            {
                query = query.Where(x => x.IssuanceTime >= issuanceDateStart.Value);
            }

            if (issuanceDateEnd.HasValue)
            {
                query = query.Where(x => x.IssuanceTime < issuanceDateEnd.Value.Date.AddDays(1));
            }

            // Expiration date filtering - only filter Certificate ExpiryDate at database level
            // MediaLicense ExpiryDate filtering will be done in memory (AddYears cannot be translated to SQL)
            if (expirationDateStart.HasValue)
            {
                query = query.Where(x => x.ExpirationTime.HasValue && x.ExpirationTime.Value >= expirationDateStart.Value);
            }

            if (expirationDateEnd.HasValue)
            {
                query = query.Where(x => x.ExpirationTime.HasValue && x.ExpirationTime.Value < expirationDateEnd.Value.Date.AddDays(1));
            }

            // Apply status filter in database if possible (before loading to memory)
            // Use Certificate.Status field for filtering, but expired/active need memory filtering after calculating ExpiryDate
            var normalizedStatusFilter = NormalizeCertificateStatusFilter(status);
            if (!string.IsNullOrWhiteSpace(normalizedStatusFilter))
            {
                var statusLower = normalizedStatusFilter;

                // Filter by Certificate.Status at database level for statuses that don't depend on expiry date calculation
                if (statusLower == "202")
                {
                    query = query.Where(x => x.ExpirationTime < now);
                }
                else
                {
                    query = query.Where(x => x.CertificateStatus != null && x.CertificateStatus.ToLower() == statusLower);
                }
                // For expired and active, we need to filter in memory after calculating ExpiryDate for MediaLicense
                // So we don't filter here for these statuses
            }

            // Order by before pagination (EF Core can handle nullable DateTime sorting)
            // Apply sorting based on sortBy parameter
            var orderedQuery = !string.IsNullOrWhiteSpace(sortBy)
                ? sortBy.ToLower() switch
                {
                    "applicationnumber" => isDescending
                        ? query.OrderByDescending(x => x.ApplicationNumber)
                        : query.OrderBy(x => x.ApplicationNumber),
                    // Sort on the value the column actually renders (media license number when there is a
                    // shell), otherwise the order looks arbitrary against what the user sees.
                    "licensenumber" => isDescending
                        ? query.OrderByDescending(x => x.MediaLicenseNumber ?? x.LicenseNumber)
                        : query.OrderBy(x => x.MediaLicenseNumber ?? x.LicenseNumber),
                    "licensetype" => isDescending
                        ? query.OrderByDescending(x => x.ServiceNameEn)
                        : query.OrderBy(x => x.ServiceNameEn),
                    "applicant" => isDescending
                        ? query.OrderByDescending(x => x.EstNameEn ?? x.PersonName ?? (x.UserFirstName != null ? $"{x.UserFirstName} {x.UserLastName ?? ""}".Trim() : x.UserName ?? ""))
                        : query.OrderBy(x => x.EstNameEn ?? x.PersonName ?? (x.UserFirstName != null ? $"{x.UserFirstName} {x.UserLastName ?? ""}".Trim() : x.UserName ?? "")),
                    "issuancetime" => isDescending
                        ? query.OrderByDescending(x => x.IssuanceTime)
                        : query.OrderBy(x => x.IssuanceTime),
                    "expirationtime" => isDescending
                        ? query.OrderByDescending(x => x.ExpirationTime)
                        : query.OrderBy(x => x.ExpirationTime),
                    "status" => isDescending
                        ? query.OrderByDescending(x => x.CertificateStatus ?? "")
                        : query.OrderBy(x => x.CertificateStatus ?? ""),
                    _ => query.OrderByDescending(x => x.IssuanceTime) // Default sorting
                }
                // Default sorting by IssuanceTime descending
                : query.OrderByDescending(x => x.IssuanceTime);

            // Every sort key above is non-unique (many certificates share an IssueDate, a status, or an
            // applicant), and SQL Server does not guarantee any particular order among tied rows. The
            // relative order it picks depends on the execution plan, which differs between a paged read
            // (FETCH NEXT 10) and the export's full read (FETCH NEXT 2147483647) — so the same data could
            // come back in a different order in the CSV than on the grid. Appending the unique certificate
            // id makes the ordering total, and therefore identical across both callers and page sizes.
            query = orderedQuery.ThenByDescending(x => x.CertificateId);

            // Check if memory filtering is needed:
            // 1. For expired/active status, we need to calculate ExpiryDate in memory
            // 2. For expiration date filtering, MediaLicense ExpiryDate needs to be calculated in memory
            // 3. For sorting by Status or DaysRemaining, we need to calculate these fields in memory
            bool needsMemoryFiltering = (!string.IsNullOrWhiteSpace(normalizedStatusFilter) &&
                                        (normalizedStatusFilter == "202" || normalizedStatusFilter == "201" || normalizedStatusFilter == "205")) ||
                                       (expirationDateStart.HasValue || expirationDateEnd.HasValue) ||
                                       (!string.IsNullOrWhiteSpace(sortBy) &&
                                        (sortBy.ToLower() == "status" || sortBy.ToLower() == "daysremaining"));

            // Load data: all data if memory filtering needed, otherwise paginated data
            var itemsQuery = query.AsNoTracking();
            var allItems = needsMemoryFiltering
                ? await itemsQuery.ToListAsync()
                : await itemsQuery.Skip((pageIndex - 1) * pageSize).Take(pageSize).ToListAsync();

            // Get total count: at database level if no memory filtering needed
            int total;
            if (!needsMemoryFiltering)
            {
                total = await query.AsNoTracking().CountAsync();
            }
            else
            {
                // Will be calculated after memory filtering
                total = 0;
            }

            // Calculate status and other computed fields in memory
            var itemsWithStatus = allItems.Select(item =>
            {
                // Calculate ExpiryDate for MediaLicense (if Certificate doesn't have it)
                DateTime? expiryDate = item.ExpiryDate;
                DateTime? issuanceTime = item.IssuanceTime;

                // Calculate ExpirationTime (same as ExpiryDate)
                DateTime? expirationTime = expiryDate;

                // Calculate DaysRemaining
                int? daysRemaining = null;
                if (expiryDate.HasValue)
                {
                    daysRemaining = (int?)(expiryDate.Value - now).Days;
                }

                // Calculate Applicant name
                string applicant;
                if (item.userTypeId > 1)
                {
                    applicant = !string.IsNullOrWhiteSpace(item.EstNameEn) ? item.EstNameEn
                        : (!string.IsNullOrWhiteSpace(item.EstNameAr) ? item.EstNameAr : "Unknown");
                }
                else
                {
                    if (!string.IsNullOrWhiteSpace(item.PersonName))
                    {
                        applicant = item.PersonName;
                    }
                    else if (!string.IsNullOrWhiteSpace(item.UserFirstName) || !string.IsNullOrWhiteSpace(item.UserLastName))
                    {
                        applicant = $"{item.UserFirstName ?? ""} {item.UserLastName ?? ""}".Trim();
                    }
                    else
                    {
                        applicant = item.UserName ?? "Unknown";
                    }
                }

                return new
                {
                    item.CertificateId,
                    item.ApplicationNumber,
                    item.LicenseNumber,
                    // Blank shells must read as "no media license number" so the fallback kicks in instead
                    // of rendering an empty column.
                    MediaLicenseNumber = string.IsNullOrWhiteSpace(item.MediaLicenseNumber)
                        ? null
                        : item.MediaLicenseNumber.Trim(),
                    item.MedialLicenseId,
                    item.ApplicationDetailId,
                    item.ApplicationId,
                    item.ServiceId,
                    IssuanceTime = issuanceTime,
                    ExpirationTime = expirationTime,
                    item.CertificateUrl,
                    Status = DetermineStatus(expiryDate, item.CertificateStatus),
                    DaysRemaining = daysRemaining,
                    Applicant = applicant,
                    item.CertificatePassword,
                    item.DisabledReason,
                    item.Remarks,
                    item.ApplicantType,
                    item.ServiceNameEn,
                    item.ServiceNameAr
                };
            }).ToList();

            // Apply status filter in memory (for expired and active, after calculating ExpiryDate for MediaLicense)
            // Also apply expiration date filter for MediaLicense in memory
            //if (!string.IsNullOrWhiteSpace(status))
            //{
            //    var statusLower = status.ToLower();
            //    if (statusLower == "202" || statusLower == "201")
            //    {
            //        itemsWithStatus = itemsWithStatus.Where(x =>
            //        {
            //            if (statusLower == "202")
            //            {
            //                return x.Status.ToLower() == "202";
            //            }
            //            else // active
            //            {
            //                return x.Status.ToLower() == "201";
            //            }
            //        }).ToList();
            //    }
            //}

            // Expire Soon is overridden by the expiry-date check in DetermineStatus, so a certificate
            // stored as 205 but already past its expiry date is listed (and counted) as 202 instead.
            if (normalizedStatusFilter == "205")
            {
                itemsWithStatus = itemsWithStatus.Where(x => x.Status == "205").ToList();
            }

            // Expired (202) is pre-filtered at DB level only by "ExpirationTime < now",
            // but DetermineStatus keeps cancelled(203)/suspended(204) certificates as 203/204
            // even when their expiry date has passed. Without this memory-side closure, such
            // records leak into the 202 result with Status 203/204. Keep only real 202 here.
            if (normalizedStatusFilter == "202")
            {
                itemsWithStatus = itemsWithStatus.Where(x => x.Status == "202").ToList();
            }

            // Apply expiration date filter for MediaLicense in memory (if filters were provided)
            if (expirationDateStart.HasValue || expirationDateEnd.HasValue)
            {
                itemsWithStatus = itemsWithStatus.Where(x =>
                {
                    if (!x.ExpirationTime.HasValue) return false;

                    if (expirationDateStart.HasValue && x.ExpirationTime.Value < expirationDateStart.Value)
                        return false;

                    if (expirationDateEnd.HasValue && x.ExpirationTime.Value >= expirationDateEnd.Value.Date.AddDays(1))
                        return false;

                    return true;
                }).ToList();
            }

            // Apply memory sorting for computed fields (Status, DaysRemaining)
            // Note: Database fields (ApplicationNumber, LicenseNumber, etc.) are already sorted at database level
            // ThenByDescending(CertificateId) mirrors the database-side tie-break so that a Status or
            // DaysRemaining sort resolves ties the same way for the grid and the export.
            if (!string.IsNullOrWhiteSpace(sortBy) && needsMemoryFiltering)
            {
                itemsWithStatus = sortBy.ToLower() switch
                {
                    "status" => (isDescending
                        ? itemsWithStatus.OrderByDescending(x => x.Status)
                        : itemsWithStatus.OrderBy(x => x.Status))
                        .ThenByDescending(x => x.CertificateId).ToList(),
                    "daysremaining" => (isDescending
                        ? itemsWithStatus.OrderByDescending(x => x.DaysRemaining ?? int.MaxValue)
                        : itemsWithStatus.OrderBy(x => x.DaysRemaining ?? int.MaxValue))
                        .ThenByDescending(x => x.CertificateId).ToList(),
                    _ => itemsWithStatus // Keep database sorting for other fields
                };
            }

            // Get total count: after memory filtering if needed, otherwise already calculated at database level
            if (needsMemoryFiltering)
            {
                // Calculate total after memory filtering, before pagination
                total = itemsWithStatus.Count();

                // Apply pagination in memory
                itemsWithStatus = itemsWithStatus
                    .Skip((pageIndex - 1) * pageSize)
                    .Take(pageSize)
                    .ToList();
            }
            // else: total was already calculated at database level before pagination

            // Get current language
            var language = _currentUserService.GetLanguageOrDefault("en");
            var isArabic = language.ToLower() == "ar";

            // Media activities of the rows on this page. Resolved in one batched query after paging rather
            // than as a correlated subquery per row, so the export's full read costs one query too, and
            // rows that own no media-license shell (permits) never reach the database.
            var mediaActivityNames = await ResolveMediaActivityNamesAsync(
                itemsWithStatus.Select(item => item.MedialLicenseId));

            // Title and author / publishing house live only in the submitted application form, so they
            // are read the same way: one batched query for the rows on this page, parsed in memory.
            var submittedWorkDetails = await ResolveSubmittedWorkDetailsAsync(
                itemsWithStatus.Select(item => item.ApplicationDetailId));

            // Map to LicenseListItem
            var licenseItems = itemsWithStatus.Select(item => new LicenseListItem
            {
                Id = item.CertificateId,
                ApplicationNumber = item.ApplicationNumber,
                LicenseNumber = item.LicenseNumber,
                ShowLicenseNumber = item.MediaLicenseNumber ?? item.LicenseNumber,
                MediaLicenseNumber = item.MediaLicenseNumber,
                LicenseType = isArabic ? (item.ServiceNameAr ?? "غير معروف") : (item.ServiceNameEn ?? "Unknown"),
                LicenseTypeAr = item.ServiceNameAr ?? "غير معروف",
                MediaActivity = item.MedialLicenseId.HasValue
                    && mediaActivityNames.TryGetValue(item.MedialLicenseId.Value, out var activityNames)
                        ? (isArabic ? activityNames.NamesAr : activityNames.NamesEn)
                        : string.Empty,
                Title = submittedWorkDetails.TryGetValue(item.ApplicationDetailId, out var workDetails)
                    ? workDetails.Title
                    : string.Empty,
                AuthorOrPublishingHouse = submittedWorkDetails.TryGetValue(item.ApplicationDetailId, out var authorDetails)
                    ? authorDetails.AuthorOrPublishingHouse
                    : string.Empty,
                Applicant = item.Applicant,
                ApplicantType = item.ApplicantType,
                IssuanceTime = item.IssuanceTime,
                ExpirationTime = item.ExpirationTime,
                Status = item.Status,
                DaysRemaining = item.DaysRemaining,
                CertificateUrl = item.CertificateUrl,
                CertificatePassword = item.CertificatePassword,
                DisabledReason = item.DisabledReason,
                Remarks = item.Remarks
            }).ToList();

            return (total, licenseItems);
        }

        /// <summary>
        /// Reads the media activities each media-license shell currently covers
        /// (Application.MediaLicenseEconomicActivities -> Lookup.EconomicActivities), joined in
        /// activity-id order and returned in both languages so the caller renders the one the request
        /// asked for. Cancelled links are excluded: they record what the licence used to cover.
        /// </summary>
        private async Task<Dictionary<int, (string NamesEn, string NamesAr)>> ResolveMediaActivityNamesAsync(
            IEnumerable<int?> mediaLicenseIds)
        {
            var shellIds = mediaLicenseIds
                .Where(mediaLicenseId => mediaLicenseId.HasValue)
                .Select(mediaLicenseId => mediaLicenseId!.Value)
                .Distinct()
                .ToList();

            if (shellIds.Count == 0)
            {
                return [];
            }

            var activities = await (
                from link in _queryableContext.GetQueryable<MediaLicenseEconomicActivity>().AsNoTracking()
                join activity in _queryableContext.GetQueryable<EconomicActivity>().AsNoTracking()
                    on link.EconomicActivityId equals activity.Id
                where shellIds.Contains(link.MedialLicenseId) && link.CancelledDate == null
                select new
                {
                    link.MedialLicenseId,
                    link.EconomicActivityId,
                    activity.NameEn,
                    activity.NameAr
                })
                .ToListAsync();

            return activities
                .GroupBy(activity => activity.MedialLicenseId)
                .ToDictionary(
                    shellGroup => shellGroup.Key,
                    shellGroup =>
                    {
                        var ordered = shellGroup
                            .DistinctBy(activity => activity.EconomicActivityId)
                            .OrderBy(activity => activity.EconomicActivityId)
                            .ToList();

                        return (
                            NamesEn: string.Join(MediaActivitySeparator, ordered.Select(activity => activity.NameEn)),
                            NamesAr: string.Join(MediaActivitySeparator, ordered.Select(activity => activity.NameAr)));
                    });
        }

        /// <summary>
        /// Reads the title and the author / publishing house the applicant typed into the application
        /// form (Extensions.ApplicationDetailsExt.FormDataValues) for the rows on the current page.
        /// One batched query, parsed in memory, mirroring <see cref="ResolveMediaActivityNamesAsync"/>.
        /// </summary>
        private async Task<Dictionary<int, (string Title, string AuthorOrPublishingHouse)>> ResolveSubmittedWorkDetailsAsync(
            IEnumerable<int> applicationDetailIds)
        {
            var detailIds = applicationDetailIds.Distinct().ToList();

            if (detailIds.Count == 0)
            {
                return [];
            }

            var submittedForms = await _queryableContext.GetQueryable<ApplicationDetailExtModel>().AsNoTracking()
                .Where(extension => detailIds.Contains(extension.ApplicationDetailId)
                    && extension.FormDataValues != null)
                .Select(extension => new { extension.ApplicationDetailId, extension.FormDataValues })
                .ToListAsync();

            var workDetails = new Dictionary<int, (string Title, string AuthorOrPublishingHouse)>();

            foreach (var submittedForm in submittedForms)
            {
                var titles = new List<string>();
                var authors = new List<string>();
                CollectSubmittedValues(submittedForm.FormDataValues, titles, authors);

                workDetails[submittedForm.ApplicationDetailId] = (
                    string.Join(SubmittedValueSeparator, titles),
                    string.Join(SubmittedValueSeparator, authors));
            }

            return workDetails;
        }

        /// <summary>
        /// Walks a submitted form and collects every value stored under a title / author key, in document
        /// order and without repeats. The form is JSON nested inside JSON - the step array holds a
        /// "formData" string that parses into another object - and a value can sit at the top of a
        /// section (203) or inside a row of a repeating list (302), so the walker re-parses any string
        /// that is itself JSON and descends through both objects and arrays.
        /// </summary>
        private static void CollectSubmittedValues(string? formDataValues, List<string> titles, List<string> authors)
        {
            if (string.IsNullOrWhiteSpace(formDataValues))
            {
                return;
            }

            try
            {
                using var document = JsonDocument.Parse(formDataValues);
                CollectSubmittedValues(document.RootElement, titles, authors, depth: 0);
            }
            catch (JsonException)
            {
                // A form that does not parse simply has no title to show; the columns stay empty.
            }
        }

        private static void CollectSubmittedValues(JsonElement element, List<string> titles, List<string> authors, int depth)
        {
            if (depth > SubmittedFormMaxDepth)
            {
                return;
            }

            switch (element.ValueKind)
            {
                case JsonValueKind.Object:
                    foreach (var property in element.EnumerateObject())
                    {
                        if (property.Value.ValueKind == JsonValueKind.Object
                            || property.Value.ValueKind == JsonValueKind.Array)
                        {
                            CollectSubmittedValues(property.Value, titles, authors, depth + 1);
                            continue;
                        }

                        if (property.Value.ValueKind == JsonValueKind.String
                            && TryParseNestedJson(property.Value.GetString(), out var nested))
                        {
                            using (nested)
                            {
                                CollectSubmittedValues(nested!.RootElement, titles, authors, depth + 1);
                            }

                            continue;
                        }

                        if (SubmittedTitleKeys.Contains(property.Name))
                        {
                            AddSubmittedValue(titles, property.Value);
                        }
                        else if (SubmittedAuthorKeys.Contains(property.Name))
                        {
                            AddSubmittedValue(authors, property.Value);
                        }
                    }

                    break;

                case JsonValueKind.Array:
                    foreach (var item in element.EnumerateArray())
                    {
                        CollectSubmittedValues(item, titles, authors, depth + 1);
                    }

                    break;
            }
        }

        /// <summary>
        /// The submitted form stores nested sections as JSON strings ("formData"), so a string value is
        /// re-parsed when it looks like an object or an array. Anything else - including a plain answer
        /// that happens to start with a brace - is left alone.
        /// </summary>
        private static bool TryParseNestedJson(string? value, out JsonDocument? document)
        {
            document = null;

            if (string.IsNullOrWhiteSpace(value))
            {
                return false;
            }

            var trimmed = value.TrimStart();
            if (trimmed.Length == 0 || (trimmed[0] != '{' && trimmed[0] != '['))
            {
                return false;
            }

            try
            {
                document = JsonDocument.Parse(value);
                return true;
            }
            catch (JsonException)
            {
                return false;
            }
        }

        private static void AddSubmittedValue(List<string> values, JsonElement value)
        {
            var text = value.ValueKind switch
            {
                JsonValueKind.String => value.GetString(),
                JsonValueKind.Number => value.GetRawText(),
                _ => null
            };

            if (string.IsNullOrWhiteSpace(text))
            {
                return;
            }

            text = text.Trim();

            // 302 stores the same person under both "author" and "authorName", and a book list can
            // repeat a title; the cell shows each value once.
            if (!values.Contains(text, StringComparer.OrdinalIgnoreCase))
            {
                values.Add(text);
            }
        }

        public async Task<LicenseDetail?> GetLicenseDetailAsync(int licenseId)
        {
            // Get certificate
            var cert = await _queryableContext.GetQueryable<Certificate>()
                .FirstOrDefaultAsync(c => c.Id == licenseId);

            if (cert == null) return null;

            // Get application detail
            var appDetail = await _applicationDetailRepository.GetByIdAsync(cert.ApplicationDetailId);
            if (appDetail == null) return null;

            // Get application
            var app = await _applicationRepository.GetByIdAsync(appDetail.ApplicationId);
            if (app == null) return null;

            // Same resolution the list uses, so the detail header shows the number the grid row showed
            // instead of flipping back to the certificate number on a direct open/refresh.
            var mediaLicenseNumber = await _queryableContext.GetQueryable<MediaLicense>()
                .Where(m => app.MedialLicenseId.HasValue && m.Id == app.MedialLicenseId.Value)
                .Select(m => m.MediaLicenseNumber)
                .FirstOrDefaultAsync()
                ?? await _queryableContext.GetQueryable<MediaLicense>()
                    .Where(m => m.ApplicationDetailId == appDetail.Id)
                    .OrderByDescending(m => m.Id)
                    .Select(m => m.MediaLicenseNumber)
                    .FirstOrDefaultAsync();
            mediaLicenseNumber = string.IsNullOrWhiteSpace(mediaLicenseNumber) ? null : mediaLicenseNumber.Trim();

            // Get holder info
            LicenseHolder? holder = null;
            LicenseEstablishment? establishment = null;

            if (app.EstablishmentId.HasValue)
            {
                var est = await _queryableContext.GetQueryable<Establishment>()
                    .FirstOrDefaultAsync(e => e.Id == app.EstablishmentId.Value);
                if (est != null)
                {
                    holder = new LicenseHolder
                    {
                        Type = "Establishment",
                        Id = est.Id,
                        NameEn = est.NameEn ?? string.Empty,
                        NameAr = est.NameAr ?? string.Empty,
                        CommercialLicenseNumber = est.LicenseNumber
                    };

                    establishment = new LicenseEstablishment
                    {
                        Id = est.Id,
                        NameEn = est.NameEn ?? string.Empty,
                        NameAr = est.NameAr ?? string.Empty,
                        CommercialLicenseNumber = est.LicenseNumber,
                        WarningsCount = 0, // TODO: Get from actual data
                        UnpaidFinesCount = 0, // TODO: Get from actual data
                        DocumentsCount = 0, // TODO: Get from actual data
                        PartnersCount = 0 // TODO: Get from actual data
                    };
                }
            }
            else
            {
                var user = await _queryableContext.GetQueryable<User>()
                    .FirstOrDefaultAsync(u => u.Id == app.UserId);
                if (user != null)
                {
                    // Try to get Person from UserProfile first
                    var userProfile = await _queryableContext.GetQueryable<UserProfile>()
                        .Where(up => up.UserId == user.Id)
                        .OrderByDescending(up => up.CreatedOn)
                        .FirstOrDefaultAsync();

                    Person? person = null;
                    if (userProfile != null)
                    {
                        person = await _queryableContext.GetQueryable<Person>()
                            .FirstOrDefaultAsync(p => p.Id == userProfile.PersonId);
                    }

                    // Determine name: Person.Name > User.FirstName+LastName > User.UserName
                    string nameEn = person?.Name ??
                                   (!string.IsNullOrWhiteSpace(user.FirstName) || !string.IsNullOrWhiteSpace(user.LastName)
                                       ? $"{user.FirstName ?? ""} {user.LastName ?? ""}".Trim()
                                       : user.UserName) ?? string.Empty;

                    holder = new LicenseHolder
                    {
                        Type = "Person",
                        Id = person?.Id ?? 0,
                        NameEn = nameEn,
                        NameAr = person?.NameAr ?? string.Empty,
                        Email = user.Email,
                        EmiratesId = person?.EmiratesId
                    };
                }
            }


            // Get economic activities
            var economicActivities = new List<LicenseEconomicActivity>();
            // TODO: Implement economic activities query when MediaLicenseEconomicActivity entity is available
            // if (mediaLicense != null)
            // {
            //     var activities = await _queryableContext.GetQueryable<MediaLicenseEconomicActivity>()
            //         .Where(mla => mla.MedialLicenseId == mediaLicense.Id)
            //         .ToListAsync();
            //     // TODO: Map to economic activity names
            // }

            // Calculate expiry date: for Certificate use ExpiryDate, for MediaLicense calculate from CreatedOn + YearsOfLicense
            var expiryDate = cert.ExpiryDate;
            var daysRemaining = expiryDate.HasValue ? (int?)(expiryDate.Value - DateTimeHelper.Now).Days : null;

            // Get ProfileId: 
            // Step 1: From Certificate table, get ApplicationDetailId (already done: cert.ApplicationDetailId)
            // Step 2: From ApplicationDetail table, get ApplicationId (already done: appDetail.ApplicationId)
            // Step 3: From Application table, get ProfileId
            int? profileId = app.ProfileId;

            // Get UserType from UserProfile based on ProfileId
            short? userTypeId = null;
            string? userTypeNameEn = null;
            string? userTypeNameAr = null;
            string? userTypeCode = null;

            if (profileId.HasValue)
            {
                var userProfile = await _queryableContext.GetQueryable<UserProfile>()
                    .FirstOrDefaultAsync(up => up.Id == profileId.Value);

                if (userProfile != null)
                {
                    userTypeId = userProfile.UserTypeId;

                    // Get UserType details
                    var userType = await _queryableContext.GetQueryable<UserType>()
                        .FirstOrDefaultAsync(ut => ut.Id == userProfile.UserTypeId);

                    if (userType != null)
                    {
                        userTypeNameEn = userType.NameEn;
                        userTypeNameAr = userType.NameAr;
                        userTypeCode = userType.Code;
                    }
                }
            }

            // Get historical Application records
            // Logic: Based on current License/Certificate's ApplicationDetailId,
            // find the ApplicationId from ApplicationDetail table,
            // then query all ApplicationDetail records with the same ApplicationId,
            // and finally get the corresponding Application records
            var currentApplicationId = appDetail.ApplicationId;

            // Get all ApplicationDetail records with the same ApplicationId (all history records for this Application)
            // These represent all the detail records for the same Application
            var relatedApplicationDetailIds = await _queryableContext.GetQueryable<ApplicationDetailModel>()
                .Where(ad => ad.ApplicationId == currentApplicationId)
                .Select(ad => ad.Id)
                .ToListAsync();

            // Query Application records based on the ApplicationId
            // Since all ApplicationDetail records with the same ApplicationId point to the same Application,
            // we query the Application directly by ApplicationId
            var historicalApplicationsQuery = _queryableContext.GetQueryable<ApplicationModel>()
                .Where(a => !a.IsDelete && a.Id == currentApplicationId);

            // Get application history with service information using JOIN
            var applicationHistoryQuery = from histApp in historicalApplicationsQuery
                                          join histService in _queryableContext.GetQueryable<ServiceConfig>()
                                          on histApp.ServiceId equals histService.Id into serviceGroup
                                          from svc in serviceGroup.DefaultIfEmpty()
                                          orderby histApp.CreatedOn descending
                                          select new LicenseApplicationHistory
                                          {
                                              ApplicationNumber = histApp.ApplicationNumber,
                                              ServiceName = svc != null ? (svc.NameEn ?? "Unknown") : "Unknown",
                                              Type = svc != null ? svc.Type : null,
                                              SubmissionTime = histApp.CreatedOn
                                          };

            var applicationHistory = await applicationHistoryQuery.ToListAsync();

            // Get current language
            var language = _currentUserService.GetLanguageOrDefault("en");
            var isArabic = language.ToLower() == "ar";

            // Update holder name based on language
            if (holder != null)
            {
                holder.NameEn = isArabic ? (holder.NameAr ?? holder.NameEn) : holder.NameEn;
            }

            // Update establishment name based on language
            if (establishment != null)
            {
                establishment.NameEn = isArabic ? (establishment.NameAr ?? establishment.NameEn) : establishment.NameEn;
            }

            // Update service fees names based on language
            var serviceFees = new List<LicenseServiceFee>();
            // Note: ServiceFees are currently empty, but if they were populated, we would update them here
            // foreach (var fee in serviceFees)
            // {
            //     fee.NameEn = isArabic ? fee.NameAr : fee.NameEn;
            // }

            // Update economic activities names based on language
            foreach (var activity in economicActivities)
            {
                activity.NameEn = isArabic ? (activity.NameAr ?? activity.NameEn) : activity.NameEn;
            }

            // Update application history service names based on language
            // Note: ApplicationHistory currently only has ServiceName (not ServiceNameEn/Ar), so we keep it as is
            // If ServiceNameEn/Ar were available, we would update them here

            return new LicenseDetail
            {
                Id = cert.Id,
                ApplicationNumber = app.ApplicationNumber,
                LicenseNumber = cert.CertificateNo,
                ShowLicenseNumber = mediaLicenseNumber ?? cert.CertificateNo,
                MediaLicenseNumber = mediaLicenseNumber,
                LicenseType = isArabic ? (cert.CertificateNameAr ?? "غير معروف") : (cert.CertificateNameEn ?? "Unknown"),
                LicenseTypeAr = cert.CertificateNameAr ?? "غير معروف",
                // For Certificate: use IssueDate, for MediaLicense: use CreatedOn
                IssuanceDate = cert.IssueDate,
                EffectiveDate = cert.IssueDate,
                ExpiryDate = expiryDate,
                DaysRemaining = daysRemaining,
                Status = DetermineStatus(expiryDate, cert.Status),
                //YearsOfLicense = mediaLicense?.YearsOfLicense,
                CertificateUrl = cert.CertificateUrl,
                CertificateWithHeaderUrl = cert.CertificateWithHeaderUrl,
                CertificatePassword = cert.CertificatePassword,
                DisabledReason = cert.DisabledReason,
                Remarks = cert.Remarks,
                Holder = holder,
                Establishment = establishment,
                ServiceFees = serviceFees,
                EconomicActivities = economicActivities,
                ProfileId = profileId,
                UserTypeId = userTypeId,
                UserTypeNameEn = isArabic ? (userTypeNameAr ?? userTypeNameEn) : userTypeNameEn,
                UserTypeNameAr = userTypeNameAr,
                UserTypeCode = userTypeCode,
                ApplicationHistory = applicationHistory
            };
        }

        public async Task<LicenseStatistics> GetLicenseStatisticsAsync(string? userId = null, int? profileId = null, int? departmentId = null, DateTime? issuanceDateStart = null, DateTime? issuanceDateEnd = null)
        {
        // Issuance-date window mirrors /api/LicenseManagement/list (GetLicenseListAsync :172-180):
        // filter Certificate.IssueDate, start inclusive, end + 1 day exclusive. When both are null
        // (the default, used by /api/LicenseManagement/statistics) NO date filter is applied, so the
        // statistics endpoint's totals are unchanged. The license dashboard passes its request window
        // to make the SAME buckets honor the date filter without ever diverging from statistics.
        var issuanceEndExclusive = issuanceDateEnd?.Date.AddDays(1);
        var query = from cert in _queryableContext.GetQueryable<Certificate>()
                join appDetail in _queryableContext.GetQueryable<ApplicationDetailModel>() on cert.ApplicationDetailId equals appDetail.Id
                join app in _queryableContext.GetQueryable<ApplicationModel>() on appDetail.ApplicationId equals app.Id
                // JOIN Service to get license type
                join service in _queryableContext.GetQueryable<ServiceConfig>() on app.ServiceId equals service.Id

                where app.IsDelete == false 
                && (string.IsNullOrWhiteSpace(userId) || app.UserId == userId)
                && (!profileId.HasValue || app.ProfileId == profileId.Value)
                && (!departmentId.HasValue || service.Department == departmentId.Value)
                // NULL IssueDate certificates are undated: a date window cannot apply to them,
                // so they are ALWAYS included (matching /statistics, which has no date filter).
                // Only genuinely dated certificates are narrowed by the window. This is why the
                // total stays equal to /statistics for a wide window instead of dropping by the
                // count of undated certificates.
                && (!issuanceDateStart.HasValue || cert.IssueDate == null || cert.IssueDate >= issuanceDateStart.Value)
                && (issuanceEndExclusive == null || cert.IssueDate == null || cert.IssueDate < issuanceEndExclusive.Value)
                select new
                        {
                            // For Certificate: use ExpiryDate, for MediaLicense: calculate from CreatedOn + YearsOfLicense
                            CertExpiryDate = cert.ExpiryDate,
                            CertificateStatus = cert.Status
                        };

            var allLicenses = await query.ToListAsync();

            // Calculate ExpiryDate for each license (for MediaLicense, calculate from CreatedOn + YearsOfLicense)
            var licensesWithExpiryDate = allLicenses.Select(l =>
            {
                var expiryDate = l.CertExpiryDate;
                return new { ExpiryDate = expiryDate, CertificateStatus = l.CertificateStatus };
            }).ToList();

            var stats = new LicenseStatistics
            {
                Total = licensesWithExpiryDate.Count,
                Active = licensesWithExpiryDate.Count(l => DetermineStatus(l.ExpiryDate, l.CertificateStatus) == "201"),
                ExpireSoon = licensesWithExpiryDate.Count(l => DetermineStatus(l.ExpiryDate, l.CertificateStatus) == "205"),
                Expired = licensesWithExpiryDate.Count(l => DetermineStatus(l.ExpiryDate, l.CertificateStatus) == "202"),
                Cancelled = licensesWithExpiryDate.Count(l => DetermineStatus(l.ExpiryDate, l.CertificateStatus) == "203"),
                Disabled = licensesWithExpiryDate.Count(l => DetermineStatus(l.ExpiryDate, l.CertificateStatus) == "204")
            };

            return stats;
        }

        private static string DetermineStatus(DateTime? expiryDate, string? certificateStatus)
        {
            var normalizedStatus = certificateStatus?.Trim().ToLowerInvariant();
            var now = DateTimeHelper.Now;

            if (normalizedStatus == "203" || normalizedStatus == "204")
            {
                return normalizedStatus;
            }

            if (expiryDate.HasValue && expiryDate.Value < now)
            {
                return "202";
            }

            if (!string.IsNullOrWhiteSpace(normalizedStatus))
            {
                return normalizedStatus;
            }

            return expiryDate.HasValue && expiryDate.Value >= now ? "201" : "202";
        }

        private static string? NormalizeCertificateStatusFilter(string? status)
        {
            if (string.IsNullOrWhiteSpace(status))
            {
                return null;
            }

            return status.Trim().ToLowerInvariant() switch
            {
                "active" => "201",
                "expired" => "202",
                "cancelled" or "canceled" => "203",
                "suspended" or "disabled" => "204",
                "expiresoon" or "expiringsoon" => "205",
                var statusCode => statusCode
            };
        }

        public async Task<Certificate> GetCertificateByIdAsync(int certificateId)
        {
            return await _certificateRepsitory.GetByIdAsync(certificateId);
        }
        public async Task<bool> UpdateCertificateStuatsAsync(List<Models.License.Certificate> certificates)
        {
            foreach (var item in certificates)
            {
                _certificateRepsitory.Update(item);
            }
            await _unitOfWork.SaveChangesAsync();
            return true;
        }

        public async Task<List<Certificate>> GetCertificatesByStatusAsync(string status)
        {
            var Certificates = await _certificateRepsitory.FindAsync(x => x.Status == status);
            return Certificates.ToList();
        }
        
        public async Task<CertificateDashboardStatisticsDto> GetCertificateDashboardStatisticsAsync(int days, DateTime? startDate = null, DateTime? endDate = null)
        {
            var start = startDate ?? DateTimeHelper.Now.Date.AddDays(-(days - 1));
            var end = endDate?.Date.AddDays(1).AddTicks(-1) ?? DateTimeHelper.Now;
            var expiringThreshold = DateTimeHelper.Now.AddDays(30);

            // Fetch filtered certificates
            var query = from cert in _queryableContext.GetQueryable<Certificate>()
                        join appDetail in _queryableContext.GetQueryable<ApplicationDetailModel>() on cert.ApplicationDetailId equals appDetail.Id
                        join app in _queryableContext.GetQueryable<ApplicationModel>() on appDetail.ApplicationId equals app.Id
                        where app.IsDelete == false && cert.IssueDate >= start && cert.IssueDate <= end
                        
                        join userProfile in _queryableContext.GetQueryable<UserProfile>() on app.ProfileId equals userProfile.Id
                        join userType in _queryableContext.GetQueryable<UserType>() on userProfile.UserTypeId equals userType.Id
                        
                        //join service in _queryableContext.GetQueryable<ServiceConfig>() on app.ServiceId equals service.Id into serviceGroup
                        //from service in serviceGroup.DefaultIfEmpty()
                        
                        join service in _queryableContext.GetQueryable<ServiceConfig>() on app.ServiceId equals service.Id 
                        where service.Department == (int)DepartmentEnum.Licensing

                        // Link to Address and Emirate via Establishment
                        //from userEst in _queryableContext.GetQueryable<UserEstablishment>().Where(ue => ue.UserProfileId == app.ProfileId).DefaultIfEmpty()
                        //from est in _queryableContext.GetQueryable<Establishment>().Where(e => userEst != null && e.Id == userEst.EstablishmentId).DefaultIfEmpty()
                        from addr in _queryableContext.GetQueryable<Address>().Where(a => userProfile != null && a.Id == userProfile.AddressId).DefaultIfEmpty()
                        from emirate in _queryableContext.GetQueryable<Emirate>().Where(em => addr != null && em.Id == addr.EmirateId).DefaultIfEmpty()

                        select new
                        {
                            cert.Id,
                            cert.Status,
                            cert.ExpiryDate,
                            cert.IssueDate,
                            CertificateNameEn = service != null ? service.NameEn : cert.CertificateNameEn,
                            UserTypeCode = userType.Code,
                            EmirateId = emirate != null ? (short?)emirate.Id : null,
                            EmirateName = emirate != null ? emirate.NameEn : "Unknown"
                        };

            var data = await query.ToListAsync();

            var result = new CertificateDashboardStatisticsDto();

            // 1. Status Stats
            var activeCount = data.Count(c => DetermineStatus(c.ExpiryDate, c.Status) == "201");
            var expiredCount = data.Count(c => DetermineStatus(c.ExpiryDate, c.Status) == "202");
            var expiringSoonCount = data.Count(c => DetermineStatus(c.ExpiryDate, c.Status) == "201" && c.ExpiryDate.HasValue && c.ExpiryDate.Value <= expiringThreshold);
            var suspendedCount = data.Count(c => DetermineStatus(c.ExpiryDate, c.Status) == "204");
            var cancelledCount = data.Count(c => DetermineStatus(c.ExpiryDate, c.Status) == "203");

            // Calculate Renew Rate: 
            // Denominator: Certificates that will expire within 'days' days (future)
            var futureExpiringThreshold = DateTimeHelper.Now.AddDays(days);
            var expiringCertNos = await _queryableContext.GetQueryable<Certificate>()
                .Join(_queryableContext.GetQueryable<ApplicationDetailModel>(), c => c.ApplicationDetailId, ad => ad.Id, (c, ad) => new { c, ad })
                .Join(_queryableContext.GetQueryable<ApplicationModel>(), x => x.ad.ApplicationId, a => a.Id, (x, a) => new { x.c, x.ad, a })
                .Join(_queryableContext.GetQueryable<ServiceConfig>(), x => x.a.ServiceId, s => s.Id, (x, s) => new { x.c, x.ad, x.a, s })
                .Where(x => x.a.IsDelete == false && x.c.ExpiryDate >= DateTimeHelper.Now && x.c.ExpiryDate <= futureExpiringThreshold && x.s.Department == (int)DepartmentEnum.Licensing)
                .Select(x => x.c.CertificateNo)
                .Distinct()
                .ToListAsync();

            var totalExpiringInPeriodCount = expiringCertNos.Count;

            // Numerator: Renewal certificates (ServiceConfig.Type == "3") whose CertificateNo is in the expiring list
            var renewedInPeriodCount = 0;
            if (totalExpiringInPeriodCount > 0)
            {
                renewedInPeriodCount = await _queryableContext.GetQueryable<Certificate>()
                    .Join(_queryableContext.GetQueryable<ApplicationDetailModel>(), c => c.ApplicationDetailId, ad => ad.Id, (c, ad) => new { c, ad })
                    .Join(_queryableContext.GetQueryable<ApplicationModel>(), x => x.ad.ApplicationId, a => a.Id, (x, a) => new { x.c, x.ad, a })
                    .Join(_queryableContext.GetQueryable<ServiceConfig>(), x => x.a.ServiceId, s => s.Id, (x, s) => new { x.c, x.ad, x.a, s })
                    .Where(x => x.a.IsDelete == false && x.s.Type == "3" && x.s.Department == (int)DepartmentEnum.Licensing && expiringCertNos.Contains(x.c.CertificateNo))
                    .Select(x => x.c.CertificateNo)
                    .Distinct()
                    .CountAsync();
            }

            result.StatusStats = new CertificateStatusStatsDto
            {
                Total = data.Count,
                Active = activeCount,
                ActivePercentage = data.Count > 0 ? Math.Round((double)activeCount / data.Count * 100, 1) : 0,
                Expired = expiredCount,
                ExpiredPercentage = data.Count > 0 ? Math.Round((double)expiredCount / data.Count * 100, 1) : 0,
                ExpiringSoon = expiringSoonCount,
                ExpiringSoonPercentage = data.Count > 0 ? Math.Round((double)expiringSoonCount / data.Count * 100, 1) : 0,
                RenewRate = totalExpiringInPeriodCount > 0 ? Math.Round((double)renewedInPeriodCount / totalExpiringInPeriodCount * 100, 1) : 0,
                Suspended = suspendedCount,
                SuspendedPercentage = data.Count > 0 ? Math.Round((double)suspendedCount / data.Count * 100, 1) : 0,
                Cancelled = cancelledCount,
                CancelledPercentage = data.Count > 0 ? Math.Round((double)cancelledCount / data.Count * 100, 1) : 0
            };

            // 2. User Type Stats
            var userTypes = await _queryableContext.GetQueryable<UserType>().Where(u => u.IsShown).ToListAsync();
            var userTypeGroups = data.GroupBy(c => c.UserTypeCode)
                .Select(g => new
                {
                    Code = g.Key,
                    Count = g.Count()
                })
                .ToList();

            result.UserTypeStats = userTypes.Select(t => new CertificateUserTypeStatsDto
            {
                UserType = t.NameEn,
                Count = userTypeGroups.FirstOrDefault(x => x.Code == t.Code)?.Count ?? 0,
                Percentage = data.Count > 0 ? Math.Round((double)(userTypeGroups.FirstOrDefault(x => x.Code == t.Code)?.Count ?? 0) / data.Count * 100, 2) : 0
            }).ToList();

            // 3. Emirate Stats
            var allEmirates = await _queryableContext.GetQueryable<Emirate>().ToListAsync();
            var emirateGroups = data.GroupBy(c => c.EmirateId)
                .Select(g => new
                {
                    EmirateId = g.Key,
                    Count = g.Count()
                })
                .ToList();

            result.EmirateStats = allEmirates.Select(e => new CertificateEmirateStatsDto
            {
                Emirate = e.NameEn,
                Count = emirateGroups.FirstOrDefault(x => x.EmirateId == e.Id)?.Count ?? 0,
                Percentage = data.Count > 0 ? Math.Round((double)(emirateGroups.FirstOrDefault(x => x.EmirateId == e.Id)?.Count ?? 0) / data.Count * 100, 2) : 0
            }).ToList();

            // Add Foreign
            var foreignCount = emirateGroups.FirstOrDefault(x => x.EmirateId == null)?.Count ?? 0;
            result.EmirateStats.Add(new CertificateEmirateStatsDto
            {
                Emirate = "Foreign",
                Count = foreignCount,
                Percentage = data.Count > 0 ? Math.Round((double)foreignCount / data.Count * 100, 2) : 0
            });

            // 4. Trend Stats
            var trendResult = TrendChartHelper.GetTrendGroups(start, end);
            string unit = trendResult.Unit;
            var groups = trendResult.Groups;

            var distinctLicenseTypes = data
                .Where(c => !string.IsNullOrEmpty(c.CertificateNameEn))
                .Select(c => c.CertificateNameEn.Trim())
                .Distinct()
                .ToList();

            result.TrendStats = groups.Select(group =>
            {
                var dateStr = TrendChartHelper.GetFormatDate(group.Start, group.End, unit);
                var groupData = data.Where(c => c.IssueDate.HasValue && c.IssueDate.Value.Date >= group.Start && c.IssueDate.Value.Date <= group.End).ToList();
                return new CertificateTrendStatsDto
                {
                    Date = dateStr,
                    Unit = unit,
                    TypeCounts = distinctLicenseTypes.Select(t => new CertificateTypeCountDto
                    {
                        Type = t,
                        Count = groupData.Count(c => (c.CertificateNameEn ?? "").Trim().Equals(t, StringComparison.OrdinalIgnoreCase))
                    }).ToList()
                };
            }).ToList();

            return result;
        }

        public async Task<PageResponse<LicenseReportListItemDto>> GetLicenseReportListAsync(int days, DateTime? startDate = null, DateTime? endDate = null, string? keyword = null, PageRequest pageRequest = null, string? orderby = null, string? sort = "desc")
        {
            var start = startDate ?? DateTimeHelper.Now.Date.AddDays(-(days - 1));
            var end = endDate?.Date.AddDays(1).AddTicks(-1) ?? DateTimeHelper.Now;
            var expiringThreshold = DateTimeHelper.Now.AddDays(30);

            var query = from cert in _queryableContext.GetQueryable<Certificate>()
                        join appDetail in _queryableContext.GetQueryable<ApplicationDetailModel>() on cert.ApplicationDetailId equals appDetail.Id
                        join app in _queryableContext.GetQueryable<ApplicationModel>() on appDetail.ApplicationId equals app.Id
                        where app.IsDelete == false && cert.IssueDate >= start && cert.IssueDate <= end

                        join userProfile in _queryableContext.GetQueryable<UserProfile>() on app.ProfileId equals userProfile.Id
                        join userType in _queryableContext.GetQueryable<UserType>() on userProfile.UserTypeId equals userType.Id

                        //join service in _queryableContext.GetQueryable<ServiceConfig>() on app.ServiceId equals service.Id into serviceGroup
                        //from service in serviceGroup.DefaultIfEmpty()
                        
                        join service in _queryableContext.GetQueryable<ServiceConfig>() on app.ServiceId equals service.Id 
                        where service.Department == (int)DepartmentEnum.Licensing

                        from userEst in _queryableContext.GetQueryable<UserEstablishment>().Where(ue => ue.UserProfileId == app.ProfileId).DefaultIfEmpty()
                        from est in _queryableContext.GetQueryable<Establishment>().Where(e => userEst != null && e.Id == userEst.EstablishmentId).DefaultIfEmpty()
                        // Establishment.AddressId is a legacy misnamed column holding an Emirate id, not an
                        // Address.Id; the address always comes from the applying UserProfile.
                        from addr in _queryableContext.GetQueryable<Address>().Where(a => a.Id == userProfile.AddressId).DefaultIfEmpty()
                        from emirate in _queryableContext.GetQueryable<Emirate>().Where(em => addr != null && em.Id == addr.EmirateId).DefaultIfEmpty()
                        from country in _queryableContext.GetQueryable<Country>().Where(co => addr != null && co.Id == addr.CountryId).DefaultIfEmpty()

                        select new
                        {
                            cert.Id,
                            cert.Status,
                            cert.ExpiryDate,
                            cert.IssueDate,
                            CertificateNameEn = service != null ? service.NameEn : cert.CertificateNameEn,
                            UserTypeCode = userType.Code,
                            UserTypeNameEn = userType.NameEn,
                            EmirateId = emirate != null ? (short?)emirate.Id : null,
                            EmirateName = emirate != null ? emirate.NameEn : "Unknown",
                            CountryId = addr != null ? addr.CountryId : null,
                            CountryNameEn = country != null ? country.NameEn : "Unknown"
                        };

            if (!string.IsNullOrEmpty(keyword))
            {
                query = query.Where(c => c.CertificateNameEn.Contains(keyword));
            }

            // AP-16: aggregate on the DB side instead of materializing every joined certificate
            // row into memory. Status is computed as a SQL CASE column; per-license counts and
            // the per-(license,emirate)/(license,userType) distributions are produced by DB GroupBy.
            var now = DateTimeHelper.Now;
            var statusQuery = query.Select(c => new
            {
                c.CertificateNameEn,
                c.EmirateId,
                c.UserTypeCode,
                c.CountryNameEn,
                c.CountryId,
                c.ExpiryDate,
                StatusComputed =
                    (c.ExpiryDate.HasValue && c.ExpiryDate.Value < now) ? "202"
                    : (c.Status != null && c.Status != "") ? c.Status.ToLower()
                    : (c.ExpiryDate.HasValue && c.ExpiryDate.Value >= now) ? "201" : "202"
            });

            // All user types and emirates for percentage calculations
            var userTypes = await _queryableContext.GetQueryable<UserType>().Where(u => u.IsShown).ToListAsync();
            var allEmirates = await _queryableContext.GetQueryable<Emirate>().ToListAsync();
            var emirateNamesToReport = new[] { "Dubai", "Abu Dhabi", "Sharjah", "Ajman", "RAK", "Fujairah", "Umm Al Quwain" };
            var emirateMappings = allEmirates
                .Select(e => new
                {
                    Emirate = e,
                    ReportName = emirateNamesToReport.FirstOrDefault(name =>
                        e.NameEn.Contains(name, StringComparison.OrdinalIgnoreCase) ||
                        (name == "RAK" && e.NameEn.Contains("Ras Al Khaimah", StringComparison.OrdinalIgnoreCase)))
                })
                .Where(x => x.ReportName != null)
                .ToList();

            // DB-side aggregates (bounded result sets, no full-table materialization)
            var licenseAgg = await statusQuery
                .GroupBy(c => c.CertificateNameEn)
                .Select(g => new
                {
                    License = g.Key,
                    Issued = g.Count(),
                    Active = g.Count(c => c.StatusComputed == "201"),
                    Expired = g.Count(c => c.StatusComputed == "202"),
                    ExpiringSoon = g.Count(c => c.StatusComputed == "201" && c.ExpiryDate.HasValue && c.ExpiryDate.Value <= expiringThreshold),
                    Foreign = g.Count(c => c.CountryNameEn != "United Arab Emirates" && c.CountryNameEn != "UAE" && c.CountryId != 1)
                })
                .ToListAsync();

            var emirateAgg = await statusQuery
                .GroupBy(c => new { c.CertificateNameEn, c.EmirateId })
                .Select(g => new { g.Key.CertificateNameEn, g.Key.EmirateId, Count = g.Count() })
                .ToListAsync();

            var userTypeAgg = await statusQuery
                .GroupBy(c => new { c.CertificateNameEn, c.UserTypeCode })
                .Select(g => new { g.Key.CertificateNameEn, g.Key.UserTypeCode, Count = g.Count() })
                .ToListAsync();

            var groups = licenseAgg.Select(lic =>
            {
                var issued = lic.Issued;
                return new LicenseReportListItemDto
                {
                    License = lic.License ?? "Unknown",
                    Issued = issued,
                    Active = lic.Active,
                    Expired = lic.Expired,
                    ExpiringSoon = lic.ExpiringSoon,
                    GeographicDistribution = emirateNamesToReport.Select(name =>
                    {
                        var mapping = emirateMappings.FirstOrDefault(m => m.ReportName == name);
                        var count = mapping != null
                            ? emirateAgg.Where(x => x.CertificateNameEn == lic.License && x.EmirateId == mapping.Emirate.Id).Sum(x => x.Count)
                            : 0;
                        return new GeographicDistributionDto
                        {
                            Region = name,
                            Percentage = issued > 0 ? Math.Round((double)count / issued * 100, 2) : 0
                        };
                    }).Concat(new[]
                    {
                        new GeographicDistributionDto
                        {
                            Region = "Foreign",
                            Percentage = issued > 0 ? Math.Round((double)lic.Foreign / issued * 100, 2) : 0
                        }
                    }).ToList(),
                    UserTypeDistribution = userTypes.Select(t => new UserTypeDistributionDto
                    {
                        UserType = t.NameEn,
                        Percentage = issued > 0
                            ? Math.Round((double)userTypeAgg.Where(x => x.CertificateNameEn == lic.License && x.UserTypeCode == t.Code).Sum(x => x.Count) / issued * 100, 2)
                            : 0
                    }).ToList()
                };
            }).ToList();

            if (!string.IsNullOrEmpty(orderby))
            {
                bool isDesc = sort?.ToLower() == "desc";
                switch (orderby.ToLower())
                {
                    case "issued":
                        groups = isDesc ? groups.OrderByDescending(x => x.Issued).ToList() : groups.OrderBy(x => x.Issued).ToList();
                        break;
                    case "active":
                        groups = isDesc ? groups.OrderByDescending(x => x.Active).ToList() : groups.OrderBy(x => x.Active).ToList();
                        break;
                    case "expiringsoon":
                        groups = isDesc ? groups.OrderByDescending(x => x.ExpiringSoon).ToList() : groups.OrderBy(x => x.ExpiringSoon).ToList();
                        break;
                    case "expired":
                        groups = isDesc ? groups.OrderByDescending(x => x.Expired).ToList() : groups.OrderBy(x => x.Expired).ToList();
                        break;
                }
            }

            var total = groups.Count;
            var items = groups.Skip((pageRequest.PageIndex - 1) * pageRequest.PageSize).Take(pageRequest.PageSize).ToList();

            return new PageResponse<LicenseReportListItemDto>(items, total, pageRequest.PageIndex, pageRequest.PageSize);
        }
        public async Task<byte[]> ExportLicenseReportAsync(int days, DateTime? startDate = null, DateTime? endDate = null, string? keyword = null)
        {
            var reportData = await GetLicenseReportListAsync(days, startDate, endDate, keyword, new PageRequest { PageIndex = 1, PageSize = int.MaxValue });
            var items = reportData.Items;

            var headers = new List<string> { "License", "Issued", "Active", "Expiring Soon", "Expired" };
            
            // Add Geographic Distribution headers
            if (items.Any())
            {
                foreach (var geo in items.First().GeographicDistribution)
                {
                    headers.Add($"{geo.Region} (%)");
                }
                foreach (var ut in items.First().UserTypeDistribution)
                {
                    headers.Add($"{ut.UserType} (%)");
                }
            }

            using (var ms = new MemoryStream())
            {
                using (var sw = new StreamWriter(ms, Encoding.UTF8))
                {
                    sw.WriteLine(string.Join(",", headers.Select(h => $"\"{h}\"")));
                    foreach (var item in items)
                    {
                        var row = new List<string>
                        {
                            item.License,
                            item.Issued.ToString(),
                            item.Active.ToString(),
                            item.ExpiringSoon.ToString(),
                            item.Expired.ToString()
                        };
                        foreach (var geo in item.GeographicDistribution)
                        {
                            row.Add($"{geo.Percentage}%");
                        }
                        foreach (var ut in item.UserTypeDistribution)
                        {
                            row.Add($"{ut.Percentage}%");
                        }
                        sw.WriteLine(string.Join(",", row.Select(cell => $"\"{cell.Replace("\"", "\"\"")}\"")));
                    }
                }
                return ms.ToArray();
            }
        }
        public async Task<PageResponse<LicenseReportListItemDto>> GetPermitReportListAsync(int days, DateTime? startDate = null, DateTime? endDate = null, string? keyword = null, PageRequest pageRequest = null, string? orderby = null, string? sort = "desc")
        {
            var start = startDate ?? DateTimeHelper.Now.Date.AddDays(-(days - 1));
            var end = endDate?.Date.AddDays(1).AddTicks(-1) ?? DateTimeHelper.Now;
            var expiringThreshold = DateTimeHelper.Now.AddDays(30);

            var query = from cert in _queryableContext.GetQueryable<Certificate>()
                        join appDetail in _queryableContext.GetQueryable<ApplicationDetailModel>() on cert.ApplicationDetailId equals appDetail.Id
                        join app in _queryableContext.GetQueryable<ApplicationModel>() on appDetail.ApplicationId equals app.Id
                        where app.IsDelete == false && cert.IssueDate >= start && cert.IssueDate <= end

                        join userProfile in _queryableContext.GetQueryable<UserProfile>() on app.ProfileId equals userProfile.Id
                        join userType in _queryableContext.GetQueryable<UserType>() on userProfile.UserTypeId equals userType.Id

                        join service in _queryableContext.GetQueryable<ServiceConfig>() on app.ServiceId equals service.Id 
                        where service.Department == (int)DepartmentEnum.Content

                        from addr in _queryableContext.GetQueryable<Address>().Where(a => userProfile != null && a.Id == userProfile.AddressId).DefaultIfEmpty()
                        from emirate in _queryableContext.GetQueryable<Emirate>().Where(em => addr != null && em.Id == addr.EmirateId).DefaultIfEmpty()

                        select new
                        {
                            cert.Id,
                            cert.Status,
                            cert.ExpiryDate,
                            cert.IssueDate,
                            CertificateNameEn = service != null ? service.NameEn : cert.CertificateNameEn,
                            UserTypeNameEn = userType.NameEn,
                            EmirateName = emirate != null ? emirate.NameEn : "Foreign"
                        };

            if (!string.IsNullOrEmpty(keyword))
            {
                query = query.Where(c => c.CertificateNameEn.Contains(keyword));
            }

            var data = await query.ToListAsync();

            var targetUserTypes = new[] { "Commercial", "Individual", "Government", "Free Zone", "Talent Agency", "Embassy", "Consulate", "Cultural Clubs" };
            var targetEmirates = new[] { "Dubai", "Abu Dhabi", "Ajman", "RAK", "Sharjah", "Umm Al Quwain", "Fujairah", "Foreign" };

            var groups = data.GroupBy(c => c.CertificateNameEn)
                .Select(g => new LicenseReportListItemDto
                {
                    License = g.Key ?? "Unknown",
                    Issued = g.Count(),
                    Active = g.Count(c => DetermineStatus(c.ExpiryDate, c.Status) == "201"),
                    Expired = g.Count(c => DetermineStatus(c.ExpiryDate, c.Status) == "202"),
                    ExpiringSoon = g.Count(c => DetermineStatus(c.ExpiryDate, c.Status) == "201" && c.ExpiryDate.HasValue && c.ExpiryDate.Value <= expiringThreshold),
                    GeographicDistribution = targetEmirates.Select(name => new GeographicDistributionDto
                    {
                        Region = name,
                        Percentage = g.Count() > 0 ? Math.Round((double)g.Count(c => c.EmirateName.Contains(name, StringComparison.OrdinalIgnoreCase) || (name == "Foreign" && c.EmirateName == "Foreign")) / g.Count() * 100, 2) : 0
                    }).ToList(),
                    UserTypeDistribution = targetUserTypes.Select(type => new UserTypeDistributionDto
                    {
                        UserType = type,
                        Percentage = g.Count() > 0 ? Math.Round((double)g.Count(c => c.UserTypeNameEn == type) / g.Count() * 100, 2) : 0
                    }).ToList()
                }).ToList();

            if (!string.IsNullOrEmpty(orderby))
            {
                bool isDesc = sort?.ToLower() == "desc";
                switch (orderby.ToLower())
                {
                    case "permit":
                    case "license":
                        groups = isDesc ? groups.OrderByDescending(x => x.License).ToList() : groups.OrderBy(x => x.License).ToList();
                        break;
                    case "issued":
                        groups = isDesc ? groups.OrderByDescending(x => x.Issued).ToList() : groups.OrderBy(x => x.Issued).ToList();
                        break;
                    case "active":
                        groups = isDesc ? groups.OrderByDescending(x => x.Active).ToList() : groups.OrderBy(x => x.Active).ToList();
                        break;
                    case "expiringsoon":
                        groups = isDesc ? groups.OrderByDescending(x => x.ExpiringSoon).ToList() : groups.OrderBy(x => x.ExpiringSoon).ToList();
                        break;
                    case "expired":
                        groups = isDesc ? groups.OrderByDescending(x => x.Expired).ToList() : groups.OrderBy(x => x.Expired).ToList();
                        break;
                }
            }

            var total = groups.Count;
            var items = groups.Skip((pageRequest.PageIndex - 1) * pageRequest.PageSize).Take(pageRequest.PageSize).ToList();

            return new PageResponse<LicenseReportListItemDto>(items, total, pageRequest.PageIndex, pageRequest.PageSize);
        }

        public async Task<byte[]> ExportPermitReportAsync(int days, DateTime? startDate = null, DateTime? endDate = null, string? keyword = null)
        {
            var reportData = await GetPermitReportListAsync(days, startDate, endDate, keyword, new PageRequest { PageIndex = 1, PageSize = int.MaxValue });
            var items = reportData.Items;

            var headers = new List<string> { "Permit", "Issued", "Active", "Expiring Soon", "Expired" };

            if (items.Any())
            {
                foreach (var geo in items.First().GeographicDistribution)
                {
                    headers.Add($"{geo.Region} (%)");
                }
                foreach (var ut in items.First().UserTypeDistribution)
                {
                    headers.Add($"{ut.UserType} (%)");
                }
            }

            using (var ms = new MemoryStream())
            {
                using (var sw = new StreamWriter(ms, Encoding.UTF8))
                {
                    sw.WriteLine(string.Join(",", headers.Select(h => $"\"{h}\"")));
                    foreach (var item in items)
                    {
                        var row = new List<string>
                        {
                            item.License,
                            item.Issued.ToString(),
                            item.Active.ToString(),
                            item.ExpiringSoon.ToString(),
                            item.Expired.ToString()
                        };
                        foreach (var geo in item.GeographicDistribution)
                        {
                            row.Add($"{geo.Percentage}%");
                        }
                        foreach (var ut in item.UserTypeDistribution)
                        {
                            row.Add($"{ut.Percentage}%");
                        }
                        sw.WriteLine(string.Join(",", row.Select(cell => $"\"{cell.Replace("\"", "\"\"")}\"")));
                    }
                }
                return ms.ToArray();
            }
        }

        public async Task<PermitAnalyticsDto> GetPermitAnalyticsAsync(int days, DateTime? startDate = null, DateTime? endDate = null)
        {
            var start = startDate ?? DateTimeHelper.Now.Date.AddDays(-(days - 1));
            var end = endDate?.Date.AddDays(1).AddTicks(-1) ?? DateTimeHelper.Now;
            var expiringThreshold = DateTimeHelper.Now.AddDays(30);

            // Query LicensePermitIndex (PERMIT) joined through
            // EstablishmentId → UserEstablishments → UserProfiles → UserTypes
            // and optionally to Address → Emirate for location stats.
            var query = from permit in _queryableContext.GetQueryable<LicensePermitIndex>()
                        where permit.DocumentType == "PERMIT"
                              && permit.UpdatedOn >= start && permit.UpdatedOn <= end

                        join ue in _queryableContext.GetQueryable<UserEstablishment>()
                            on permit.EstablishmentId equals ue.EstablishmentId
                        join up in _queryableContext.GetQueryable<UserProfile>()
                            on ue.UserProfileId equals up.Id
                        join ut in _queryableContext.GetQueryable<UserType>()
                            on up.UserTypeId equals ut.Id

                        from addr in _queryableContext.GetQueryable<Address>()
                            .Where(a => a.Id == up.AddressId).DefaultIfEmpty()
                        from emirate in _queryableContext.GetQueryable<Emirate>()
                            .Where(em => addr != null && em.Id == addr.EmirateId).DefaultIfEmpty()

                        select new
                        {
                            permit.Id,
                            permit.CurrentStatus,
                            permit.ExpireDate,
                            UserTypeName = ut.NameEn,
                            EmirateId = emirate != null ? (short?)emirate.Id : null
                        };

            var data = await query.ToListAsync();

            var result = new PermitAnalyticsDto();

            // 1. Status Stats
            var activeCount = data.Count(c => c.CurrentStatus == "ACTIVE");
            var expiredCount = data.Count(c => c.CurrentStatus == "EXPIRED");
            var expiringSoonCount = data.Count(c => c.CurrentStatus == "ACTIVE" && c.ExpireDate.HasValue && c.ExpireDate.Value <= expiringThreshold);

            result.StatusStats = new PermitStatusStatsDto
            {
                Total = data.Count,
                Active = activeCount,
                ActivePercentage = data.Count > 0 ? Math.Round((double)activeCount / data.Count * 100, 2) : 0,
                Expired = expiredCount,
                ExpiredPercentage = data.Count > 0 ? Math.Round((double)expiredCount / data.Count * 100, 2) : 0,
                ExpiringSoon = expiringSoonCount,
                ExpiringSoonPercentage = data.Count > 0 ? Math.Round((double)expiringSoonCount / data.Count * 100, 2) : 0
            };

            // 2. Permits by User Type
            var userTypeGroups = data.GroupBy(c => c.UserTypeName ?? "Unknown")
                .Select(g => new CertificateUserTypeStatsDto
                {
                    UserType = g.Key,
                    Count = g.Count(),
                    Percentage = data.Count > 0 ? Math.Round((double)g.Count() / data.Count * 100, 2) : 0
                })
                .OrderByDescending(x => x.Count)
                .ToList();
            result.PermitsByUserType = userTypeGroups;

            // 3. Permits by Location
            var allEmirates = await _queryableContext.GetQueryable<Emirate>().ToListAsync();
            var emirateGroups = data.GroupBy(c => c.EmirateId)
                .Select(g => new
                {
                    EmirateId = (short?)g.FirstOrDefault()?.EmirateId,
                    Count = g.Count()
                })
                .ToList();

            result.PermitsByLocation = allEmirates.Select(e => new CertificateEmirateStatsDto
            {
                Emirate = e.NameEn,
                Count = data.Count(c => c.EmirateId == e.Id),
                Percentage = data.Count > 0 ? Math.Round((double)data.Count(c => c.EmirateId == e.Id) / data.Count * 100, 2) : 0
            }).ToList();

            // Add Foreign
            var foreignCount = data.Count(c => c.EmirateId == null);
            result.PermitsByLocation.Add(new CertificateEmirateStatsDto
            {
                Emirate = "Foreign",
                Count = foreignCount,
                Percentage = data.Count > 0 ? Math.Round((double)foreignCount / data.Count * 100, 2) : 0
            });

            return result;
        }

        public async Task<ProfileDashboardStatisticsDto> GetProfileDashboardStatisticsAsync(int days, DateTime? startDate = null, DateTime? endDate = null)
        {
            var start = startDate ?? DateTimeHelper.Now.Date.AddDays(-(days - 1));
            var end = endDate?.Date.AddDays(1).AddTicks(-1) ?? DateTimeHelper.Now;

            // 1. Fetch filtered UserProfiles with associated data
            var query = from up in _queryableContext.GetQueryable<UserProfile>()
                        join ut in _queryableContext.GetQueryable<UserType>() on up.UserTypeId equals ut.Id
                        join person in _queryableContext.GetQueryable<Person>() on up.PersonId equals person.Id
                        
                        // Device/Platform info via ApplicationDetail
                        join app in _queryableContext.GetQueryable<ApplicationModel>() on up.Id equals app.ProfileId into appGroup
                        from app in appGroup.DefaultIfEmpty()
                        join appDetail in _queryableContext.GetQueryable<ApplicationDetailModel>() on app.Id equals appDetail.ApplicationId into appDetailGroup
                        from appDetail in appDetailGroup.DefaultIfEmpty()

                        // Emirate info via Address
                        join addr in _queryableContext.GetQueryable<Address>() on up.AddressId equals addr.Id into addrGroup
                        from addr in addrGroup.DefaultIfEmpty()
                        join comm in _queryableContext.GetQueryable<Community>() on addr.CommunityId equals comm.Id into commGroup
                        from comm in commGroup.DefaultIfEmpty()
                        join region in _queryableContext.GetQueryable<Region>() on comm.RegionId equals region.Id into regionGroup
                        from region in regionGroup.DefaultIfEmpty()
                        join emirate in _queryableContext.GetQueryable<Emirate>() on region.EmirateId equals emirate.Id into emirateGroup
                        from emirate in emirateGroup.DefaultIfEmpty()
                        join country in _queryableContext.GetQueryable<Country>() on addr.CountryId equals country.Id into countryGroup
                        from country in countryGroup.DefaultIfEmpty()

                        where up.CreatedOn >= start && up.CreatedOn <= end && up.Status == "2" // Approved profiles

                        select new
                        {
                            up.Id,
                            up.CreatedOn,
                            UserTypeCode = ut.Code,
                            UserTypeNameEn = ut.NameEn,
                            person.EmiratesId,
                            person.PassportNumber,
                            person.UID,
                            PlatformId = appDetail != null ? appDetail.PlatformId : null,
                            EmirateId = emirate != null ? (short?)emirate.Id : null,
                            EmirateNameEn = emirate != null ? emirate.NameEn : "Foreign",
                            CountryId = addr != null ? addr.CountryId : null,
                            CountryNameEn = country != null ? country.NameEn : "Unknown"
                        };

            var allData = await query.ToListAsync();
            
            // Deduplicate by ProfileId as one profile might have multiple applications
            var profilesData = allData.GroupBy(p => p.Id).Select(g => g.First()).ToList();

            var result = new ProfileDashboardStatisticsDto();

            // 1. Status Stats (Profile Types)
            result.StatusStats = new ProfileStatusStatsDto
            {
                Total = profilesData.Count,
                Individual = profilesData.Count(p => p.UserTypeCode == "1"),
                Commercial = profilesData.Count(p => p.UserTypeCode == "2"),
                TalentAgency = profilesData.Count(p => p.UserTypeCode == "12"),
                FreeZone = profilesData.Count(p => p.UserTypeCode == "9"),
                Embassy = profilesData.Count(p => p.UserTypeCode == "13"),
                Consulate = profilesData.Count(p => p.UserTypeCode == "14"),
                CulturalClubs = profilesData.Count(p => p.UserTypeCode == "15"),
                Government = profilesData.Count(p => p.UserTypeCode == "3")
            };

            // 2. Emirate Stats
            var emirateNamesToReport = new[] { "Dubai", "Abu Dhabi", "Sharjah", "Ajman", "RAK", "Fujairah", "Umm Al Quwain" };
            var allEmirates = await _queryableContext.GetQueryable<Emirate>().ToListAsync();
            var emirateMappings = allEmirates
                .Select(e => new
                {
                    Emirate = e,
                    ReportName = emirateNamesToReport.FirstOrDefault(name =>
                        e.NameEn.Contains(name, StringComparison.OrdinalIgnoreCase) ||
                        (name == "RAK" && e.NameEn.Contains("Ras Al Khaimah", StringComparison.OrdinalIgnoreCase)))
                })
                .Where(x => x.ReportName != null)
                .ToList();

            result.EmirateStats = emirateNamesToReport.Select(name =>
            {
                var mapping = emirateMappings.FirstOrDefault(m => m.ReportName == name);
                var count = mapping != null ? profilesData.Count(p => p.EmirateId == mapping.Emirate.Id) : 0;
                return new ProfileEmirateStatsDto
                {
                    Emirate = name,
                    Count = count,
                    Percentage = profilesData.Count > 0 ? Math.Round((double)count / profilesData.Count * 100, 2) : 0
                };
            }).ToList();

            // Add Foreign
            var foreignCount = profilesData.Count(p => p.CountryId != 1 && (p.CountryNameEn != "United Arab Emirates" && p.CountryNameEn != "UAE"));
            result.EmirateStats.Add(new ProfileEmirateStatsDto
            {
                Emirate = "Foreign",
                Count = foreignCount,
                Percentage = profilesData.Count > 0 ? Math.Round((double)foreignCount / profilesData.Count * 100, 2) : 0
            });

            // 3. Trend Stats (Profile registrations)
            var periodDays = (int)(end - start).TotalDays + 1;
            var allDates = Enumerable.Range(0, periodDays)
                .Select(offset => start.AddDays(offset).ToString("yyyy-MM-dd"))
                .ToList();

            var trendData = profilesData
                .GroupBy(p => p.CreatedOn.ToString("yyyy-MM-dd"))
                .ToDictionary(g => g.Key, g => g.Count());

            result.TrendStats = allDates.Select(date => new ProfileTrendStatsDto
            {
                Date = date,
                ApprovedCount = trendData.GetValueOrDefault(date, 0)
            }).ToList();

            // 4. Verification Stats (Only for Individual Profiles)
            var individualProfiles = profilesData.Where(p => p.UserTypeCode == "1").ToList();
            result.VerificationStats = new List<ProfileVerificationStatsDto>
            {
                new ProfileVerificationStatsDto { VerificationMethod = "Emirates ID", Count = individualProfiles.Count(p => !string.IsNullOrWhiteSpace(p.EmiratesId)) },
                new ProfileVerificationStatsDto { VerificationMethod = "UAE Unified Number", Count = individualProfiles.Count(p => !string.IsNullOrWhiteSpace(p.UID)) },
                new ProfileVerificationStatsDto { VerificationMethod = "Passport", Count = individualProfiles.Count(p => !string.IsNullOrWhiteSpace(p.PassportNumber)) }
            };

            // 5. Device Stats
            var platforms = await _queryableContext.GetQueryable<TypeDictionary>().Where(t => t.Scope == "Platform").ToListAsync();

            result.DeviceStats = new List<ProfileDeviceStatsDto>
            {
                new ProfileDeviceStatsDto { DeviceType = "Web", Count = allData.Count(d => platforms.Any(plt => plt.Code == d.PlatformId?.ToString() && plt.NameEn.Contains("Web", StringComparison.OrdinalIgnoreCase))) },
                new ProfileDeviceStatsDto { DeviceType = "Mobile", Count = allData.Count(d => platforms.Any(plt => plt.Code == d.PlatformId?.ToString() && plt.NameEn.Contains("Mobile", StringComparison.OrdinalIgnoreCase))) },
                new ProfileDeviceStatsDto { DeviceType = "Tablet", Count = allData.Count(d => platforms.Any(plt => plt.Code == d.PlatformId?.ToString() && plt.NameEn.Contains("Tablet", StringComparison.OrdinalIgnoreCase))) }
            };
            
            if (result.DeviceStats.All(s => s.Count == 0))
            {
                result.DeviceStats = new List<ProfileDeviceStatsDto>
                {
                    new ProfileDeviceStatsDto { DeviceType = "Web", Count = allData.Count(d => d.PlatformId == 1) },
                    new ProfileDeviceStatsDto { DeviceType = "Mobile", Count = allData.Count(d => d.PlatformId == 2) },
                    new ProfileDeviceStatsDto { DeviceType = "Tablet", Count = allData.Count(d => d.PlatformId == 3) }
                };
            }

            return result;
        }
        private string MapEmirateName(string name)
        {
            if (string.IsNullOrEmpty(name)) return "Unknown";
            
            if (name.Contains("Dubai", StringComparison.OrdinalIgnoreCase)) return "Dubai";
            if (name.Contains("Abu Dhabi", StringComparison.OrdinalIgnoreCase)) return "Abu Dhabi";
            if (name.Contains("Sharjah", StringComparison.OrdinalIgnoreCase)) return "Sharjah";
            if (name.Contains("Ajman", StringComparison.OrdinalIgnoreCase)) return "Ajman";
            if (name.Contains("Ras Al Khaimah", StringComparison.OrdinalIgnoreCase) || name.Contains("RAK", StringComparison.OrdinalIgnoreCase)) return "RAK";
            if (name.Contains("Fujairah", StringComparison.OrdinalIgnoreCase)) return "Fujairah";
            if (name.Contains("Umm Al Quwain", StringComparison.OrdinalIgnoreCase) || name.Contains("UAQ", StringComparison.OrdinalIgnoreCase)) return "Umm Al Quwain";
            
            return name;
        }
    }

    // Temporary model classes for database access
    // These should match the actual database table structure
    // Note: CertificateModel and MediaLicenseModel have been replaced with actual entity classes
    // (Certificate and MediaLicense from UMC.AdminPortal.Domain.Models.License)

    internal class MediaLicenseEconomicActivityModel
    {
        public int Id { get; set; }
        public int MedialLicenseId { get; set; }
        public short EconomicActivityId { get; set; }
    }

    internal class ServiceConfigModel
    {
        public short Id { get; set; }
        public string NameEn { get; set; } = string.Empty;
        public string NameAr { get; set; } = string.Empty;
    }

    internal class EstablishmentModel
    {
        public int Id { get; set; }
        public string NameEn { get; set; } = string.Empty;
        public string NameAr { get; set; } = string.Empty;
        public string LicenseNumber { get; set; } = string.Empty;
    }

    internal class UserModel
    {
        public string Id { get; set; } = string.Empty;
        public string UserName { get; set; } = string.Empty;
        public string? Email { get; set; }
        public string? FirstName { get; set; }
        public string? LastName { get; set; }
    }

    internal class UserProfileModel
    {
        public int Id { get; set; }
        public string UserId { get; set; } = string.Empty;
        public int PersonId { get; set; }
    }

    internal class PersonModel
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? NameAr { get; set; }
        public string? EmiratesId { get; set; }
    }

    internal class ServiceFeeModel
    {
        public short ServiceId { get; set; }
        public string? NameEn { get; set; }
        public string? NameAr { get; set; }
        public decimal Fee { get; set; }
        public string? Code { get; set; }
    }
}

