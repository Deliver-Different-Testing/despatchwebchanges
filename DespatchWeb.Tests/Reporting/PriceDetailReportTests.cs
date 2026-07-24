using DespatchWeb.Interfaces;
using DespatchWeb.Models.Dto;
using DespatchWeb.Reporting;
using DespatchWeb.Repositories;
using NSubstitute;
using Bucket = DespatchWeb.Reporting.PriceLineClassifier.Bucket;

namespace DespatchWeb.Tests.Reporting;

// Unit tests for the pure audit logic - classification, as-booked reconstruction, findings, and
// the invariants. These are the crown jewels; keep them green when the rating engine changes.
public class PriceDetailReportTests
{
    // ---- accessorial classification --------------------------------------------------------

    [Theory]
    [InlineData("Base", Bucket.BaseDistance)]
    [InlineData("Distance (20 mi incl., 65 mi charged)", Bucket.BaseDistance)]
    [InlineData("Base Fuel", Bucket.Fuel)]
    [InlineData("Weight Fuel", Bucket.Fuel)]        // fuel wins over weight
    [InlineData("Weight", Bucket.Weight)]
    [InlineData("Cubic", Bucket.Cubic)]
    [InlineData("Congestion", Bucket.Congestion)]
    [InlineData("After Hours", Bucket.AfterHours)]
    [InlineData("Wait Time", Bucket.WaitTime)]
    [InlineData("Dangerous Goods", Bucket.HazmatDg)] // maps from Dangerous Goods
    [InlineData("Holiday", Bucket.Other)]
    [InlineData("Some New Engine Fee", Bucket.Other)]
    public void Classify_maps_by_name(string name, Bucket expected)
    {
        Assert.Equal(expected, PriceLineClassifier.Classify(name));
    }

    [Fact]
    public void ParseMiles_handles_all_shapes()
    {
        Assert.Equal((20m, 65m), PriceLineClassifier.ParseMiles("Distance (20 mi incl., 65 mi charged)"));
        Assert.Equal((0m, 69m), PriceLineClassifier.ParseMiles("Distance (69 mi charged)"));
        Assert.Equal((0m, 108m), PriceLineClassifier.ParseMiles("Base (108 miles)"));
        Assert.Null(PriceLineClassifier.ParseMiles("Congestion"));
    }

    // ---- as-booked reconstruction ----------------------------------------------------------

    [Fact]
    public void AsBooked_takes_first_120s_insert_batch_including_booking_screen_accessorials()
    {
        var t0 = new DateTime(2026, 7, 13, 12, 0, 0, DateTimeKind.Utc);
        var raw = OneJob(
            Header(jobNo: "E100V", headerAmount: 118m),
            new[] { Line("Base", 75m), Line("Base Fuel", 18.75m), Line("Inside Delivery", 25m) },
            new[]
            {
                Insert("Base: $75.00", t0),
                Insert("Base Fuel: $18.75", t0),
                Insert("Inside Delivery: $25.00", t0.AddSeconds(30)),      // booking-screen accessorial - INCLUDED
                Insert("After Hours: $25.00", t0.AddHours(2)),             // later re-rate - EXCLUDED
            });

        var job = PriceDetailReportData.From(raw, InfoMock()).Jobs.Single();

        var names = job.Booked.Select(b => b.ChargeName).OrderBy(n => n).ToArray();
        Assert.Equal(new[] { "Base", "Base Fuel", "Inside Delivery" }, names);
        Assert.DoesNotContain(job.Booked, b => b.ChargeName == "After Hours");
    }

    [Fact]
    public void AsBooked_falls_back_to_rolling_back_value_deltas_when_no_early_batch()
    {
        // No PricingBreakdown inserts; only value-change rows -> reconstruct current - sum(new-old).
        var raw = OneJob(
            Header("E200V", 93.75m),
            new[] { Line("Base", 75m), Line("Base Fuel", 18.75m) },
            new[]
            {
                Change("Pricing: Base", "50", "75", new DateTime(2026, 7, 14, 9, 0, 0, DateTimeKind.Utc)),
            });

        var job = PriceDetailReportData.From(raw, InfoMock()).Jobs.Single();
        Assert.Equal(50m, job.Booked.Single(b => b.ChargeName == "Base").Amount); // 75 - (75-50)
    }

    // ---- findings --------------------------------------------------------------------------

    [Fact]
    public void Detect_flags_header_fuel_with_no_fuel_line_x125()
    {
        var raw = OneJob(
            Header("P2836V", headerAmount: 244.375m),   // 195.50 * 1.25
            new[] { Line("Base", 195.50m) },             // no fuel line
            Array.Empty<PricingChangeRow>());
        var data = PriceDetailReportData.From(raw, InfoMock());
        data.Findings = PriceDetailFindings.Detect(data);

        Assert.Single(data.Findings.Where(f => f.Type == "Header fuel, no fuel line" && f.Severity == "High"));
    }

    [Fact]
    public void Detect_finds_two_same_named_lines_at_matching_amounts_as_double_charge()
    {
        var t0 = new DateTime(2026, 7, 17, 12, 0, 0, DateTimeKind.Utc);
        var raw = OneJob(
            Header("E347V", 231.75m),
            new[] { Line("Base", 50m), Line("Milage to CT", 90m), Line("Milage to CT", 90m) },
            new[] { Insert("Milage to CT: $90.00", t0), Insert("Milage to CT: $90.00", t0.AddSeconds(10)) });
        var data = PriceDetailReportData.From(raw, InfoMock());
        data.Findings = PriceDetailFindings.Detect(data);

        Assert.Contains(data.Findings, f => f.Type == "Possible double-charge");
    }

    [Fact]
    public void Detect_flags_deleted_line()
    {
        var t0 = new DateTime(2026, 7, 13, 20, 0, 0, DateTimeKind.Utc);
        var raw = OneJob(
            Header("E245OTG", 0m),
            Array.Empty<PriceDetailLineRow>(),                 // all zeroed / removed
            new[] { Insert("Base: $50.00", t0), Delete("Base: $50.00", t0.AddMinutes(3)) });
        var data = PriceDetailReportData.From(raw, InfoMock());
        data.Findings = PriceDetailFindings.Detect(data);
        Assert.Contains(data.Findings, f => f.Type == "Deleted line");
    }

    // ---- invariant: recurring detected by parent / P-prefix, not the dead IsRecurringJob flag ----

    [Fact]
    public void Recurring_detected_by_p_prefix_not_IsRecurringJob_flag()
    {
        var raw = OneJob(Header("P2843OTG", 100m, bookingParentId: null),
            new[] { Line("Base", 100m) }, Array.Empty<PricingChangeRow>());
        Assert.True(PriceDetailReportData.From(raw, InfoMock()).Jobs.Single().IsRecurring);
    }

    // ---- change-log timestamp formatting: US vs NZ tenant ----------------------------------
    // A pricing edit at 2026-07-13 14:30 UTC should print as "07-13 14:30" for a US tenant
    // (MM-dd HH:mm) and "13-07 14:30" for a non-US tenant (dd-MM HH:mm).

    [Fact]
    public void Change_summary_stamp_uses_MMdd_for_US_and_ddMM_for_NZ()
    {
        var t0 = new DateTime(2026, 7, 13, 12, 0, 0, DateTimeKind.Utc);
        var editAt = new DateTime(2026, 7, 13, 14, 30, 0, DateTimeKind.Utc);
        var raw = OneJob(
            Header("E900V", 75m),
            new[] { Line("Base", 75m) },
            new[]
            {
                Insert("Base: $50.00", t0),                                  // booking
                Insert("Extra Handling: $25.00", editAt),                    // later add, outside 120s window -> change
            });

        var us = PriceDetailReportData.From(raw, InfoMock(usTenant: true)).Jobs.Single();
        Assert.Contains("07-13 14:30", string.Join("|", us.ChangeSummary));

        var nz = PriceDetailReportData.From(raw, InfoMock(usTenant: false)).Jobs.Single();
        Assert.Contains("13-07 14:30", string.Join("|", nz.ChangeSummary));
    }

    // ---- live + archive merge with live precedence -----------------------------------------
    // Model 3 jobs: id 1 lives only in "live", id 2 lives in both, id 3 lives only in "archive".
    // After MergePreferLive, id 2 comes from the live list (its "live" tag wins).

    [Fact]
    public void MergePreferLive_wins_when_a_job_id_is_present_in_both_and_includes_archive_only()
    {
        var live = new List<TaggedRow>
        {
            new(JobId: 1, Tag: "live"),
            new(JobId: 2, Tag: "live"),
        };
        var archive = new List<TaggedRow>
        {
            new(JobId: 2, Tag: "archive"),
            new(JobId: 3, Tag: "archive"),
        };

        var merged = JobRepository.MergePreferLive(live, archive, r => r.JobId);

        Assert.Equal(3, merged.Count);
        Assert.Equal("live", merged.Single(r => r.JobId == 1).Tag);
        Assert.Equal("live", merged.Single(r => r.JobId == 2).Tag);        // live wins the collision
        Assert.Equal("archive", merged.Single(r => r.JobId == 3).Tag);     // archive-only included
    }

    private sealed record TaggedRow(int JobId, string Tag);

    // ---- split-child fallback --------------------------------------------------------------
    // Two jobs in one raw payload: parent (id 100) has lines; child (id 101, BookingParentId=100)
    // has none of its own. From() itself does NOT do the parent-lookup (that's the repository's
    // job), so exercise the child-inherits-parent-lines behaviour by pre-populating the raw as
    // the repository would after its fallback runs. The invariant we assert: once the child's
    // lines are populated from the parent, the child's rollups reflect them (not doubled, not
    // vanished).

    [Fact]
    public void Split_child_inherits_parent_lines_without_doubling()
    {
        var parentHeader = Header("E500V-parent", 100m);
        var childHeader = new PriceDetailHeaderRow
        {
            JobId = parentHeader.JobId + 1,
            JobNo = "E500V-child",
            HeaderAmount = 100m,
            BookingParentId = parentHeader.JobId,
        };
        var raw = new PriceDetailReportRaw
        {
            Headers = new[] { parentHeader, childHeader },
            // parent has its own lines; child has none of its own but was re-keyed by the repo:
            CurrentLines = new[]
            {
                new PriceDetailLineRow { JobId = parentHeader.JobId, ChargeName = "Base", ChargeAmount = 100m },
                new PriceDetailLineRow { JobId = childHeader.JobId,  ChargeName = "Base", ChargeAmount = 100m },
            },
            History = Array.Empty<PricingChangeRow>(),
        };

        var jobs = PriceDetailReportData.From(raw, InfoMock()).Jobs;
        Assert.Equal(100m, jobs.Single(j => j.Header.JobNo == "E500V-parent").CurrentLinesTotal);
        Assert.Equal(100m, jobs.Single(j => j.Header.JobNo == "E500V-child").CurrentLinesTotal);
    }

    // ---- Findings: zone <-> mileage restructure --------------------------------------------

    [Fact]
    public void Detect_flags_zone_to_mileage_rate_basis_change()
    {
        // Booked with a flat "Base" (Zone); current has a "Distance (N mi charged)" line (Mileage).
        // Must NOT be IsManual for this rule to fire, so include a CreatedBySp = engine row.
        var t0 = new DateTime(2026, 7, 20, 9, 0, 0, DateTimeKind.Utc);
        var raw = OneJob(
            Header("E600V", 200m),
            new[] { Line("Distance (0 mi incl., 45 mi charged)", 200m) },
            new[]
            {
                CreatedBySp("DD_stpJob_InsertExcelerator", t0),           // engine-sourced booking
                Insert("Base: $200.00", t0),                              // booked with a Zone-shaped line
            });
        var data = PriceDetailReportData.From(raw, InfoMock());
        data.Findings = PriceDetailFindings.Detect(data);

        Assert.Contains(data.Findings, f => f.Type == "Rate basis changed");
    }

    // ---- helpers ---------------------------------------------------------------------------

    // Threads the header's JobId through the lines + history so GroupBy joins in From().
    private static PriceDetailReportRaw OneJob(PriceDetailHeaderRow header,
        IReadOnlyList<PriceDetailLineRow> currentLines, IReadOnlyList<PricingChangeRow> history)
    {
        var lines = currentLines.Select(l => new PriceDetailLineRow { JobId = header.JobId, ChargeName = l.ChargeName, ChargeAmount = l.ChargeAmount, CourierPay = l.CourierPay }).ToList();
        var hist = history.Select(h => new PricingChangeRow { JobId = header.JobId, ChangeType = h.ChangeType, FieldName = h.FieldName, OldValue = h.OldValue, NewValue = h.NewValue, AtUtc = h.AtUtc, UpdatedByType = h.UpdatedByType, StaffFirstName = h.StaffFirstName, StaffLastName = h.StaffLastName }).ToList();
        return new() { Headers = new[] { header }, CurrentLines = lines, History = hist };
    }

    private static PriceDetailHeaderRow Header(string jobNo, decimal headerAmount, int? bookingParentId = null) =>
        new() { JobId = jobNo.GetHashCode() & 0x7fffffff, JobNo = jobNo, HeaderAmount = headerAmount, BookingParentId = bookingParentId };

    private static PriceDetailLineRow Line(string name, decimal amount) =>
        new() { ChargeName = name, ChargeAmount = amount };

    private static PricingChangeRow Insert(string newVal, DateTime atUtc) =>
        new() { ChangeType = "JobUpdate", FieldName = "PricingBreakdown", OldValue = null, NewValue = newVal, AtUtc = atUtc, UpdatedByType = "System" };

    private static PricingChangeRow Delete(string oldVal, DateTime atUtc) =>
        new() { ChangeType = "JobUpdate", FieldName = "PricingBreakdown", OldValue = oldVal, NewValue = null, AtUtc = atUtc, UpdatedByType = "System" };

    private static PricingChangeRow Change(string field, string oldVal, string newVal, DateTime atUtc) =>
        new() { ChangeType = "JobUpdate", FieldName = field, OldValue = oldVal, NewValue = newVal, AtUtc = atUtc, UpdatedByType = "System" };

    private static PricingChangeRow CreatedBySp(string spName, DateTime atUtc) =>
        new() { ChangeType = "JobCreated", FieldName = "CreatedBySp", OldValue = null, NewValue = spName, AtUtc = atUtc, UpdatedByType = "System" };

    private static ITenantInfoService InfoMock(bool usTenant = true)
    {
        var m = Substitute.For<ITenantInfoService>();
        m.ConvertUtcToTenantTimeZone(Arg.Any<DateTime>())
            .Returns(ci => new DateTimeOffset(ci.Arg<DateTime>(), TimeSpan.Zero));
        m.IsUsTenant().Returns(usTenant);
        return m;
    }
}
