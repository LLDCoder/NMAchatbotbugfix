namespace UMC.AdminPortal.Domain.Shares.Enums.TypeDics
{
    // Identifies an approval workflow node's position in the chain and several
    // terminal/special states. Values 2-7 are positional (Initial → Final),
    // 8-15 are terminal/branch states (Rejected, PendingPayment, etc.).
    //
    // Backed by Lookup.TypeDictionary rows with Scope = 'ApprovalNodeOrder';
    // Code on each row equals the enum's int value. Use ITypeDictionaryService
    // (redis-cached) for both UI-facing en/ar display text and the canonical
    // English label string:
    //   await typeDict.GetByCodeAsync("ApprovalNodeOrder", id.ToString())
    public enum ApprovalNodeOrder
    {
        InitialApproval = 2,
        SecondaryApproval = 3,
        TertiaryApproval = 4,
        SeniorApproval = 5,
        ExecutiveApproval = 6,
        FinalApproval = 7,
        Rejected = 8,
        PendingPayment = 9,
        Cancelled = 10,
        ExternalApproval = 11,
        Completed = 12,
        PendingModification = 13,
        SendBack = 14,
        Approved = 15
    }
}
