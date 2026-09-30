using System.ComponentModel.DataAnnotations.Schema;

namespace UMC.AdminPortal.Domain.Models;

public partial class ServiceConfig
{
    public short Id { get; set; }

    public string? NameAr { get; set; }

    public string? NameEn { get; set; }

    public string? Code { get; set; }

    public short ServiceCategoryId { get; set; }

    public string RoleId { get; set; } = null!;

    public string? Pmocode { get; set; }

    public string? PmopulseCode { get; set; }

    public string? ServiceDescriptionEn { get; set; }

    public string? ServiceDescriptionAr { get; set; }

    public string? Status { get; set; }

    public string? Type { get; set; }

    public string? Scope { get; set; }

    public int? OrderNum { get; set; }

    public int? Department { get; set; }

    public string? LoginToPay { get; set; }

    public DateTime? UpdateAt { get; set; }

    public DateTime? CreateAt { get; set; }

    public bool? Iscollect { get; set; }

    public int? ParentId { get; set; }

    public string? Version { get; set; }

    public string? CreateBy { get; set; }

    public DateTime? PublishAt { get; set; }

    public bool IsLoginRequired { get; set; }

    public string? UserType { get; set; }

    public bool IsCurrentVersion { get; set; }

    public string? UpdateBy { get; set; }
    public string? ConfigMode { get; set; }
    public string? ServiceFeeEn { get; set; }
    public string? ServiceFeeAr { get; set; }
    public string? ServiceDeliveryTimeEn { get; set; }
    public string? ServiceDeliveryTimeAr { get; set; }
    public string? TermsConditionsEn { get; set; }
    public string? TermsConditionsAr { get; set; }
    [NotMapped]
    public virtual ServiceCategories ServiceCategory { get; set; } = null!;
    [NotMapped]
    public virtual Department DepartmentInfo { get; set; } = null!;
}
