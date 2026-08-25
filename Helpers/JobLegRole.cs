namespace DespatchWeb.Helpers;

/// <summary>
/// A leg's place in a linehaul movement. Nothing in the database records this — no column, no
/// relationship type — so it is derived from the job-number suffix, the same convention the legacy
/// <c>uspPrebookSet</c> CASE (mirrored in <c>RecurringJobRepository</c>) and the job-detail tab
/// ordering already rely on.
/// </summary>
public enum JobLegRole
{
    /// <summary>Not part of a linehaul movement, or the family's own parent row.</summary>
    None,

    /// <summary>Collected from the client and taken to the first depot.</summary>
    LinehaulPickup,

    /// <summary>A depot-to-depot linehaul segment (LH1, LH2, …).</summary>
    Linehaul,

    /// <summary>The final-mile delivery. Its completion is what finishes the family.</summary>
    FinalMileDelivery
}

public static class JobLegRoles
{
    public static JobLegRole FromJobNumber(string jobNumber)
    {
        if (string.IsNullOrWhiteSpace(jobNumber))
        {
            return JobLegRole.None;
        }

        var number = jobNumber.Trim().ToUpperInvariant();

        if (number.EndsWith("LHP", StringComparison.Ordinal))
        {
            return JobLegRole.LinehaulPickup;
        }

        if (number.EndsWith("DEL", StringComparison.Ordinal))
        {
            return JobLegRole.FinalMileDelivery;
        }

        return IsLinehaulSegment(number) ? JobLegRole.Linehaul : JobLegRole.None;
    }

    public static bool IsLinehaul(string jobNumber) =>
        FromJobNumber(jobNumber) is JobLegRole.LinehaulPickup or JobLegRole.Linehaul;

    /// <summary>Matches an LH suffix followed by at least one digit, e.g. LH1, LH2, LH12.</summary>
    private static bool IsLinehaulSegment(string number)
    {
        var trailingDigits = 0;
        var index = number.Length - 1;

        while (index >= 0 && char.IsAsciiDigit(number[index]))
        {
            trailingDigits++;
            index--;
        }

        // index >= 2 so there is a parent job number in front of the LH marker — a bare "LH1" is not
        // a leg of anything.
        return trailingDigits > 0
               && index >= 2
               && number[index] == 'H'
               && number[index - 1] == 'L';
    }
}
