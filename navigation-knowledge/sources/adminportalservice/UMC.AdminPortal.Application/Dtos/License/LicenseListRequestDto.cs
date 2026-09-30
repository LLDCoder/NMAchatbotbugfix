using UMC.Utils.Framework.Page;

namespace UMC.AdminPortal.Application.Dtos.License
{
    /// <summary>
    /// License list request DTO
    /// </summary>
    public record LicenseListRequestDto : PageRequest
    {
        /// <summary>
        /// Search keyword (License Number, Application Number, Applicant Name)
        /// </summary>
        public string? Keyword { get; set; }

        /// <summary>
        /// License status filter (active, expired, cancelled, disabled)
        /// </summary>
        public string? Status { get; set; }

        /// <summary>
        /// License type filter
        /// </summary>
        public string? LicenseType { get; set; }

        /// <summary>
        /// Issuance date start
        /// </summary>
        public DateTime? IssuanceDateStart { get; set; }

        /// <summary>
        /// Issuance date end
        /// </summary>
        public DateTime? IssuanceDateEnd { get; set; }

        /// <summary>
        /// Expiration date start
        /// </summary>
        public DateTime? ExpirationDateStart { get; set; }

        /// <summary>
        /// Expiration date end
        /// </summary>
        public DateTime? ExpirationDateEnd { get; set; }

        /// <summary>
        /// User ID filter (optional)
        /// </summary>
        public string? UserId { get; set; }

        /// <summary>
        /// Profile ID filter (optional)
        /// </summary>
        public int? ProfileId { get; set; }
        /// <summary>
        /// Department filter (optional)
        /// </summary>
        public int? Department { get; set;}
    }
}

