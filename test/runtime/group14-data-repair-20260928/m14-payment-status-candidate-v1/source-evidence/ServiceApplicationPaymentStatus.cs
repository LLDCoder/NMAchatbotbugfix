namespace UMC.CustomerPortal.Domain.Share.Enums
{
    /// <summary>
    /// Defines the persisted lifecycle of a frozen service-application payment order.
    /// </summary>
    public enum ServiceApplicationPaymentStatus : short
    {
        /// <summary>
        /// The payment order has been created and is waiting for payment initiation.
        /// </summary>
        Pending = 1,

        /// <summary>
        /// The payment order is currently being processed through a hosted payment journey.
        /// </summary>
        InProgress = 2,

        /// <summary>
        /// The payment order has been fully settled or completed through a free-flow shortcut.
        /// </summary>
        Completed = 3
    }
}
