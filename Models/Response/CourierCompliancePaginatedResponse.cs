namespace DespatchWeb.Models.Response;

public sealed record CourierCompliancePaginatedResponse : PaginatedResponse<CourierComplianceViewModel>
{
    public int TotalExpired { get; init; }
    public int TotalExpiringSoon { get; init; }
    public int TotalValid { get; init; }
}
