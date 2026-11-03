using DespatchWeb.Enums;
using DespatchWeb.Helpers;

namespace DespatchWeb.Models;

public sealed class ComplianceReminderFilter
{
    public string SearchTerm { get; init; }
    public int Fleet { get; init; }
    public string Type { get; init; }
    public string Status { get; init; }
}

public sealed class SendComplianceRemindersRequest
{
    public List<int> CourierIds { get; init; }
    public ComplianceReminderFilter Filter { get; init; }
    public MessageDeliveryType Channel { get; init; }
    public bool Preview { get; init; }

    public bool HasExactlyOneTarget => (CourierIds is { Count: > 0 } ? 1 : 0) + (Filter is not null ? 1 : 0) == 1;
}

public sealed record ComplianceReminderFailure(int CourierId, string Name, string Reason);

public sealed record ComplianceReminderResult(
    int Recipients,
    int Sent,
    int NothingDue,
    int Failed,
    IReadOnlyList<ComplianceReminderFailure> Failures,
    int MaxRecipients);

public sealed class ComplianceAttentionItem
{
    public string TypeLabel { get; init; }
    public DateTime? Expiry { get; init; }
    public int? DaysUntilExpiry { get; init; }
    public ComplianceStatus Status { get; init; }
}

public sealed class DriverComplianceAttention
{
    public int CourierId { get; init; }
    public string FirstName { get; init; }
    public string Name { get; init; }
    public IReadOnlyList<ComplianceAttentionItem> Items { get; init; } = [];
}
