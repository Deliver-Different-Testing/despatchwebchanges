namespace DespatchWeb.Reporting;

// The verify-the-system-didn't-make-a-mistake engine. Pure functions over the assembled report
// data - no I/O. Emits one PriceFinding per detected anomaly and runs the five audit invariants
// as NON-throwing assertions (a data-quality miss is a finding, never a 500).
public static class PriceDetailFindings
{
    private const decimal AbsTolerance = 0.02m; // dollars
    private const decimal FuelRate = 0.25m; // 25% header-fuel pattern
    private const decimal RelTolerance = 0.005m; // 0.5% for the x1.25 match

    public static List<PriceFinding> Detect(PriceDetailReportData data)
    {
        var findings = new List<PriceFinding>();

        foreach (var job in data.Jobs)
        {
            var no = job.Header.JobNo;

            // 1. Header fuel with no fuel line (the x1.25 phantom-fuel class - a real live bug).
            var gap = job.HeaderVsLinesGap;
            if (Math.Abs(gap) > AbsTolerance && job.CurrentLinesTotal > 0)
            {
                var implied = job.CurrentLinesTotal * (1 + FuelRate);
                var hasFuelLine =
                    job.Current.Any(l => l.ChargeName.Contains("Fuel", StringComparison.OrdinalIgnoreCase));
                if (!hasFuelLine && Within(job.Header.HeaderAmount ?? 0m, implied))
                {
                    findings.Add(new PriceFinding(no, "Header fuel, no fuel line",
                        $"Header {job.Header.HeaderAmount ?? 0m:C} = lines {job.CurrentLinesTotal:C} x1.25 but no fuel breakdown line (+{gap:C}).",
                        "High"));
                }
                else
                {
                    findings.Add(new PriceFinding(no, "Header <> lines",
                        $"Header {job.Header.HeaderAmount ?? 0m:C} vs sum of lines {job.CurrentLinesTotal:C} (gap {gap:C}).",
                        "Medium"));
                }
            }

            // 2. Duplicate near-identical lines (double-charge, e.g. "Milage to CT" twice).
            findings.AddRange(Duplicates(job.Booked.Select(b => (b.ChargeName, b.Amount)))
                .Concat(Duplicates(job.Current.Select(c => (c.ChargeName, c.ChargeAmount))))
                .Distinct()
                .Select(dup => new PriceFinding(no, "Possible double-charge",
                    $"Line \"{dup}\" appears more than once at the same amount.", "High")));

            // 3. Deleted pricing lines (present as-booked, gone now).
            var currentNames = job.Current.Select(c => c.ChargeName.Trim()).ToHashSet(StringComparer.OrdinalIgnoreCase);
            findings.AddRange(from b in job.Booked
                where !currentNames.Contains(b.ChargeName.Trim()) && b.Amount != 0
                select new PriceFinding(no, "Deleted line",
                    $"\"{b.ChargeName}\" ({b.Amount:C}) was booked but is not on the job now.", "Medium"));

            // 4. Zone <-> Mileage restructure.
            if (!job.IsManual && job.RateBasis(booked: true) != job.RateBasis(booked: false))
            {
                findings.Add(new PriceFinding(no, "Rate basis changed",
                    $"{job.RateBasis(true)} -> {job.RateBasis(false)} since booking.", "Medium"));
            }
        }

        // 5. Staff pricing-edit counts (summary block).
        findings.AddRange(data.ChangeLog
            .Where(e => e.Who != "SYSTEM" && (e.Field == "PricingBreakdown" ||
                                              e.Field.StartsWith("Pricing: ", StringComparison.Ordinal)))
            .GroupBy(e => e.Who)
            .OrderByDescending(g => g.Count())
            .Select(g =>
                new PriceFinding("(all)", "Staff pricing edits", $"{g.Key}: {g.Count()} pricing edits", "Info")));

        return findings;
    }

    // Non-throwing invariant checks. Anything wrong becomes a finding; the workbook always renders.
    public static void AssertInvariants(PriceDetailReportData data)
    {
        foreach (var job in data.Jobs)
        {
            if (Math.Abs(job.HeaderVsLinesGap) > AbsTolerance &&
                !data.Findings.Any(f => f.JobNo == job.Header.JobNo && f.Type.StartsWith("Header")))
            {
                data.Findings.Add(new PriceFinding(job.Header.JobNo, "Invariant: lines<>header",
                    $"Unexplained {job.HeaderVsLinesGap:C} gap.", "Medium"));
            }

            if (!job.IsManual && job.Booked.Count == 0)
            {
                data.Findings.Add(new PriceFinding(job.Header.JobNo, "Invariant: as-booked unrecoverable",
                    "No early journey rows to reconstruct as-booked pricing.", "Low"));
            }
        }
    }

    private static bool Within(decimal a, decimal b) =>
        Math.Abs(a - b) <= AbsTolerance || (b != 0 && Math.Abs(a - b) / Math.Abs(b) <= RelTolerance);

    private static IEnumerable<string> Duplicates(IEnumerable<(string Name, decimal Amount)> lines) =>
        lines.GroupBy(l => (l.Name.Trim().ToLowerInvariant(), l.Amount))
            .Where(g => g.Count() > 1)
            .Select(g => g.First().Name);
}