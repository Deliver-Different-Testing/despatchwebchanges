namespace DespatchWeb.Models.RequestModels;

public sealed class UpdateRecurringJobPackagesRequest : UpdateJobPackagesBase
{
    public int BookingId { get; init; }
}
