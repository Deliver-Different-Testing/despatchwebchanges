using System.Linq.Expressions;

namespace DespatchWeb.Helpers;

public enum ComplianceStatus
{
    NotSet,
    Expired,
    ExpiringSoon,
    Valid
}

public sealed class ComplianceItemRow
{
    public int CourierId { get; init; }
    public string Code { get; init; }
    public string Name { get; init; }
    public string FirstName { get; init; }
    public string TypeKey { get; init; }
    public DateTime? Expiry { get; init; }
}

public static class CourierCompliance
{
    /// <summary>NZTA sends vehicle reminders six weeks ahead.</summary>
    public const int ExpiringSoonDays = 42;

    public const string DriversLicense = "drivers_license";
    public const string DgEndorsement = "dg_endorsement";
    public const string Wof = "wof";
    public const string Registration = "registration";

    public static readonly IReadOnlyList<string> TypeKeys =
        [DriversLicense, DgEndorsement, Wof, Registration];

    public static readonly IReadOnlyList<string> StatusFilters =
        ["expired", "expiring", "valid", "not_set", "attention"];

    public static string TypeLabel(string key) => key switch
    {
        DriversLicense => "Driver licence",
        DgEndorsement => "DG endorsement",
        Wof => "WOF",
        Registration => "Registration",
        _ => key
    };

    public static string StatusLabel(ComplianceStatus status) => status switch
    {
        ComplianceStatus.Expired => "Expired",
        ComplianceStatus.ExpiringSoon => "Expiring soon",
        ComplianceStatus.Valid => "Valid",
        _ => "Not set"
    };

    public static ComplianceStatus StatusOf(DateTime today, DateTime? expiry)
    {
        if (!expiry.HasValue)
        {
            return ComplianceStatus.NotSet;
        }

        var days = DaysUntil(today, expiry)!.Value;
        return days < 0 ? ComplianceStatus.Expired
            : days <= ExpiringSoonDays ? ComplianceStatus.ExpiringSoon
            : ComplianceStatus.Valid;
    }

    public static int? DaysUntil(DateTime today, DateTime? expiry) =>
        expiry.HasValue ? (expiry.Value.Date - today.Date).Days : null;

    /// <summary>
    /// SQL-translatable twin of <see cref="StatusOf"/>: the day-granular rules expressed as
    /// comparisons against midnight boundaries so no date function is needed server-side.
    /// </summary>
    public static Expression<Func<ComplianceItemRow, bool>> IsStatus(ComplianceStatus status, DateTime today)
    {
        var start = today.Date;
        var validFrom = start.AddDays(ExpiringSoonDays + 1);
        return status switch
        {
            ComplianceStatus.NotSet => r => r.Expiry == null,
            ComplianceStatus.Expired => r => r.Expiry != null && r.Expiry < start,
            ComplianceStatus.ExpiringSoon => r => r.Expiry >= start && r.Expiry < validFrom,
            _ => r => r.Expiry >= validFrom
        };
    }

    public static Expression<Func<ComplianceItemRow, bool>> Attention(DateTime today)
    {
        var validFrom = today.Date.AddDays(ExpiringSoonDays + 1);
        return r => r.Expiry == null || r.Expiry < validFrom;
    }

    public static Expression<Func<ComplianceItemRow, bool>> ForStatusFilter(string statusFilter, DateTime today) =>
        statusFilter switch
        {
            "expired" => IsStatus(ComplianceStatus.Expired, today),
            "expiring" => IsStatus(ComplianceStatus.ExpiringSoon, today),
            "valid" => IsStatus(ComplianceStatus.Valid, today),
            "not_set" => IsStatus(ComplianceStatus.NotSet, today),
            "attention" => Attention(today),
            _ => null
        };
}
