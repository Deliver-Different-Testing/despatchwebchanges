#nullable enable
using ClosedXML.Excel;
using DeliverDifferentReporting.Models;

namespace DespatchWeb.Reporting;

// Renders the assembled PriceDetailReportData into a multi-sheet, branded .xlsx audit workbook.
// RENDER-ONLY: no DB, no EF, no fetching. Mirrors ClientMonthlyReportSpreadsheet's Compose*Sheet
// structure and PodSpreadsheet's styling. ClosedXML is on the compile surface transitively via
// the DeliverDifferentReporting package.
public sealed class PriceDetailSpreadsheet(PriceDetailReportData data, ReportBranding branding)
{
    private static readonly string[] AccessorialHeaders =
        ["Weight", "Cubic", "Congestion", "After Hours", "Wait Time", "Tolls", "Hazmat/DG", "Surcharge", "Other"];

    public void Generate(Stream stream)
    {
        using var wb = new XLWorkbook();
        ComposeJobDetail(wb);
        ComposeAsBookedLines(wb);
        ComposeCurrentLines(wb);
        ComposeBookedVsCurrent(wb);
        ComposeChangeLog(wb);
        ComposeFindings(wb);
        ComposeNotes(wb);
        wb.SaveAs(stream);
    }

    private void ComposeJobDetail(XLWorkbook wb)
    {
        var ws = wb.Worksheets.Add("Job Detail");
        var headers = new List<string>
        {
            "Customer", "Job #", "Reference", "Booked At", "Picked Up", "Delivered", "From", "To",
            "Pcs", "Wt (lb)", "Cubic", "Dims", "Service", "Basis (booked)", "Basis (now)",
            "Road Miles", "System Miles", "Rated Manually", "Recurring",
            "Booked: Base+Dist", "Booked: Fuel", "Booked: Access.", "Booked Total",
            "Cur: Base+Dist", "Cur: Fuel"
        };
        headers.AddRange(AccessorialHeaders.Select(a => $"Acc: {a}"));
        headers.AddRange([
            "Cur Access. Total", "Cur Lines Total", "Header Amount", "Header-vs-Lines Gap",
            "Diff Booked->Cur", "Void", "On-site PU (min)", "On-site DEL (min)",
            "As-Booked Source", "Pricing Changed By", "Changes Since Booking"
        ]);
        WriteHeaderRow(ws, headers);

        // "Pricing Changed By" = distinct non-SYSTEM actors from the change log, per job, sorted.
        var actorsByJob = data.ChangeLog
            .Where(e => e.Who != "SYSTEM")
            .GroupBy(e => e.JobNo)
            .ToDictionary(g => g.Key, g => string.Join(", ", g.Select(e => e.Who).Distinct().OrderBy(w => w)));

        var r = 2;
        foreach (var j in data.Jobs)
        {
            var c = 1;

            Set(j.Header.ClientName);
            Set(j.Header.JobNo);
            Set(j.Header.Reference);
            Set(j.Header.BookedAt);
            Set(j.Header.PickedUpAt);
            Set(j.Header.DeliveredAt);
            Set(j.Header.PickupAddress);
            Set(j.Header.DeliveryAddress);
            Set(j.Header.Qty.HasValue ? j.Header.Qty.Value : (int?)null);
            Set(j.Header.Weight);
            Set(j.Header.Cubic);
            Set(j.Header.Dims);
            Set(j.Header.Service);
            Set(j.IsManual ? "manual" : j.RateBasis(true));
            Set(j.RateBasis(false));
            MoneyCol(j.Header.TotalDistance);
            MoneyCol(j.SystemMiles);
            Set(j.Header.RatedManually ? "Y" : "");
            Set(j.IsRecurring ? "Y" : "");

            MoneyCol(j.IsManual ? null : j.BucketTotal(PriceLineClassifier.Bucket.BaseDistance, booked: true));
            MoneyCol(j.IsManual ? null : j.BucketTotal(PriceLineClassifier.Bucket.Fuel, booked: true));
            var bookedAcc = PriceLineClassifier.AccessorialBuckets.Sum(b => j.BucketTotal(b, booked: true));
            MoneyCol(j.IsManual ? null : bookedAcc);
            MoneyCol(j.IsManual ? null : j.Booked.Sum(l => l.Amount));

            MoneyCol(j.BucketTotal(PriceLineClassifier.Bucket.BaseDistance));
            MoneyCol(j.BucketTotal(PriceLineClassifier.Bucket.Fuel));
            foreach (var b in PriceLineClassifier.AccessorialBuckets) MoneyCol(j.BucketTotal(b));
            MoneyCol(PriceLineClassifier.AccessorialBuckets.Sum(b => j.BucketTotal(b)));
            MoneyCol(j.CurrentLinesTotal);
            MoneyCol(j.Header.HeaderAmount);

            var gapCell = ws.Cell(r, c++);
            gapCell.Value = j.HeaderVsLinesGap;
            gapCell.Style.NumberFormat.Format = "$#,##0.00";
            if (Math.Abs(j.HeaderVsLinesGap) > 0.02m)
            {
                gapCell.Style.Font.FontColor = XLColor.FromHtml("#C00000");
            }

            MoneyCol(j.IsManual ? null : j.CurrentLinesTotal - j.Booked.Sum(l => l.Amount));

            Set(j.Header.Void ? "Y" : "");
            Set(j.OnSitePickupMinutes);
            Set(j.OnSiteDeliveryMinutes);
            Set(j.AsBookedSource.ToString());
            Set(actorsByJob.TryGetValue(j.Header.JobNo, out var actors) ? actors : "");
            Set(string.Join("; ", j.ChangeSummary));

            RowFill(ws, r, headers.Count, j);
            r++;
            continue;

            void Set(object? v) => SetCell(ws.Cell(r, c++), v);

            void MoneyCol(decimal? v)
            {
                var cell = ws.Cell(r, c++);
                cell.Value = v ?? 0;
                cell.Style.NumberFormat.Format = "$#,##0.00";
            }
        }

        ws.SheetView.FreezeRows(1);
    }

    private void ComposeAsBookedLines(XLWorkbook wb)
    {
        var ws = wb.Worksheets.Add("As-Booked Lines");
        WriteHeaderRow(ws, ["Customer", "Job #", "Booked At (local)", "Charge Line", "Bucket", "Amount"]);
        var r = 2;
        foreach (var j in data.Jobs)
        foreach (var l in j.Booked)
        {
            ws.Cell(r, 1).Value = j.Header.ClientName;
            ws.Cell(r, 2).Value = j.Header.JobNo;
            ws.Cell(r, 3).Value = j.BookedAtStamp;
            ws.Cell(r, 4).Value = l.ChargeName;
            ws.Cell(r, 5).Value = PriceLineClassifier.Classify(l.ChargeName).ToString();
            Money(ws.Cell(r, 6), l.Amount);
            r++;
        }

        ws.SheetView.FreezeRows(1);
    }

    private void ComposeCurrentLines(XLWorkbook wb)
    {
        var ws = wb.Worksheets.Add("Current Lines");
        WriteHeaderRow(ws, ["Customer", "Job #", "Charge Line", "Bucket", "Amount", "Courier Pay"]);
        var r = 2;
        foreach (var j in data.Jobs)
        foreach (var l in j.Current)
        {
            ws.Cell(r, 1).Value = j.Header.ClientName;
            ws.Cell(r, 2).Value = j.Header.JobNo;
            ws.Cell(r, 3).Value = l.ChargeName;
            ws.Cell(r, 4).Value = PriceLineClassifier.Classify(l.ChargeName).ToString();
            Money(ws.Cell(r, 5), l.ChargeAmount);
            Money(ws.Cell(r, 6), l.CourierPay ?? 0);
            r++;
        }

        ws.SheetView.FreezeRows(1);
    }

    private void ComposeBookedVsCurrent(XLWorkbook wb)
    {
        var ws = wb.Worksheets.Add("Booked vs Current");
        WriteHeaderRow(ws, ["Customer", "Job #", "Charge Line", "Booked", "Current", "Diff"]);
        var r = 2;
        foreach (var j in data.Jobs)
        {
            if (j.Booked.Count == 0)
            {
                continue;
            }

            var booked = j.Booked.GroupBy(b => b.ChargeName).ToDictionary(g => g.Key, g => g.Sum(x => x.Amount));
            var cur = j.Current.GroupBy(c => c.ChargeName).ToDictionary(g => g.Key, g => g.Sum(x => x.ChargeAmount));
            foreach (var name in booked.Keys.Union(cur.Keys))
            {
                var b = booked.GetValueOrDefault(name);
                var cv = cur.GetValueOrDefault(name);
                ws.Cell(r, 1).Value = j.Header.ClientName;
                ws.Cell(r, 2).Value = j.Header.JobNo;
                ws.Cell(r, 3).Value = name;
                if (booked.ContainsKey(name))
                {
                    Money(ws.Cell(r, 4), b);
                }

                if (cur.ContainsKey(name))
                {
                    Money(ws.Cell(r, 5), cv);
                }

                Money(ws.Cell(r, 6), cv - b);
                if (!booked.ContainsKey(name) || !cur.ContainsKey(name) || Math.Abs(b - cv) > 0.011m)
                {
                    ws.Range(r, 1, r, 6).Style.Fill.BackgroundColor = XLColor.FromHtml("#FFF2CC");
                }

                r++;
            }
        }

        ws.SheetView.FreezeRows(1);
    }

    private void ComposeChangeLog(XLWorkbook wb)
    {
        var ws = wb.Worksheets.Add("Change Log");
        WriteHeaderRow(ws, ["Customer", "Job #", "When (local)", "Who", "Field", "Old", "New"]);
        var r = 2;
        foreach (var e in data.ChangeLog)
        {
            ws.Cell(r, 2).Value = e.JobNo;
            ws.Cell(r, 3).Value = e.WhenLocal.DateTime;
            ws.Cell(r, 4).Value = e.Who;
            ws.Cell(r, 5).Value = e.Field;
            ws.Cell(r, 6).Value = e.Old ?? "";
            ws.Cell(r, 7).Value = e.New ?? "";
            r++;
        }

        ws.SheetView.FreezeRows(1);
    }

    // Narrative-sectioned findings sheet (matches Dane's hand-run OTG format).
    // Each numbered section leads with a one-line summary, then either a small table (when the
    // section has rows) or a "none" note (when it doesn't). Job-level data pulled straight from
    // _data.Jobs so we don't have to serialise it through PriceFinding.
    private void ComposeFindings(XLWorkbook wb)
    {
        var ws = wb.Worksheets.Add("Findings");
        var r = 1;

        // Title
        var title = ws.Cell(r++, 1);
        title.Value = $"AUTO-FINDINGS from DB reconstruction ({DateTime.UtcNow:yyyy-MM-dd})";
        title.Style.Font.Bold = true;
        title.Style.Font.FontSize = 12;
        r++; // blank

        // Findings 1 + 2 are both header <> lines cases (x1.25 vs "other"). Bucket the jobs.
        var fuelGapJobs = data.Findings
            .Where(f => f.Type == "Header fuel, no fuel line")
            .Select(f => data.Jobs.FirstOrDefault(j => j.Header.JobNo == f.JobNo))
            .Where(j => j is not null).Cast<PriceDetailJob>().ToList();
        var otherMismatchJobs = data.Findings
            .Where(f => f.Type is "Header <> lines" or "Invariant: lines<>header")
            .Select(f => data.Jobs.FirstOrDefault(j => j.Header.JobNo == f.JobNo))
            .Where(j => j is not null).Cast<PriceDetailJob>()
            .Where(j => fuelGapJobs.All(fg => fg.Header.JobNo != j.Header.JobNo))
            .Distinct().ToList();

        // 1. Header fuel on top of lines (x1.25). Preserves Dane's section numbering from the
        // OTG sample workbook so reviewers reading both side-by-side see the same layout.
        var section1Total = fuelGapJobs.Sum(j => j.HeaderVsLinesGap);
        var s1 = ws.Cell(r++, 1);
        s1.Value =
            $"1. HEADER FUEL ON TOP OF LINES - {fuelGapJobs.Count} jobs have Header Amount = breakdown lines x 1.25 exactly:";
        s1.Style.Font.Bold = true;
        ws.Cell(r++, 1).Value = "   a 25% fuel surcharge sits in the header with NO fuel breakdown line.";
        if (fuelGapJobs.Count > 0)
        {
            ws.Cell(r++, 1).Value = $"   Total header-over-lines across these jobs: {section1Total:C}";
            r++;
            WriteTableHeader(ws, r++, "Job", "Customer", "Header Amount", "Lines Sum", "Gap (25%)");
            foreach (var j in fuelGapJobs.OrderBy(j => j.Header.ClientName).ThenBy(j => j.Header.JobNo))
            {
                ws.Cell(r, 1).Value = j.Header.JobNo;
                ws.Cell(r, 2).Value = j.Header.ClientName;
                Money(ws.Cell(r, 3), j.Header.HeaderAmount ?? 0m);
                Money(ws.Cell(r, 4), j.CurrentLinesTotal);
                Money(ws.Cell(r, 5), j.HeaderVsLinesGap);
                r++;
            }
        }

        r++;

        // 2. Other header <> lines mismatches
        var s2 = ws.Cell(r++, 1);
        s2.Value = $"2. OTHER header-vs-lines mismatches ({otherMismatchJobs.Count}):";
        s2.Style.Font.Bold = true;
        if (otherMismatchJobs.Count > 0)
        {
            WriteTableHeader(ws, r++, "Job", "Customer", "Header Amount", "Lines Sum", "Gap");
            foreach (var j in otherMismatchJobs.OrderBy(j => j.Header.ClientName).ThenBy(j => j.Header.JobNo))
            {
                ws.Cell(r, 1).Value = j.Header.JobNo;
                ws.Cell(r, 2).Value = j.Header.ClientName;
                Money(ws.Cell(r, 3), j.Header.HeaderAmount ?? 0m);
                Money(ws.Cell(r, 4), j.CurrentLinesTotal);
                Money(ws.Cell(r, 5), j.HeaderVsLinesGap);
                r++;
            }
        }

        r++;

        // 3. Deleted pricing lines
        var deletedJobs = data.Findings.Where(f => f.Type == "Deleted line")
            .Select(f => f.JobNo).Distinct().OrderBy(j => j).ToList();
        var s3 = ws.Cell(r++, 1);
        s3.Value = deletedJobs.Count > 0
            ? $"3. Jobs with DELETED pricing lines: {string.Join(", ", deletedJobs)}"
            : "3. Jobs with DELETED pricing lines: none";
        s3.Style.Font.Bold = true;
        r++;

        // 4. Staff pricing-field edits (matches Dane's OTG section #4). Pulled from ChangeLog
        // directly so we can render per-staff counts sorted by activity - more useful than one
        // finding row per edit.
        var staffCounts = data.ChangeLog
            .Where(e => e.Who != "SYSTEM"
                        && (e.Field == "PricingBreakdown" || e.Field.StartsWith("Pricing: ", StringComparison.Ordinal)))
            .GroupBy(e => e.Who)
            .Select(g => new { Staff = g.Key, Count = g.Count() })
            .OrderByDescending(x => x.Count)
            .ToList();
        var s4 = ws.Cell(r++, 1);
        s4.Value = staffCounts.Count > 0
            ? $"4. Staff pricing-field edits (journey rows) ({staffCounts.Sum(x => x.Count)} across {staffCounts.Count} staff):"
            : "4. Staff pricing-field edits (journey rows): none";
        s4.Style.Font.Bold = true;
        foreach (var s in staffCounts)
        {
            ws.Cell(r++, 1).Value = $"   {s.Staff}: {s.Count} edits";
        }

        r++;

        // 5. Possible double-charges (added beyond Dane's OTG sections - covers spec §6 rule #2)
        var dupFindings = data.Findings.Where(f => f.Type == "Possible double-charge").ToList();
        var s5 = ws.Cell(r++, 1);
        s5.Value = $"5. Possible double-charges (line appears more than once at same amount) ({dupFindings.Count}):";
        s5.Style.Font.Bold = true;
        if (dupFindings.Count > 0)
        {
            WriteTableHeader(ws, r++, "Job", "Detail");
            foreach (var f in dupFindings.OrderBy(f => f.JobNo))
            {
                ws.Cell(r, 1).Value = f.JobNo;
                ws.Cell(r, 2).Value = f.Detail;
                r++;
            }
        }

        r++;

        // 6. Rate basis changes (added beyond Dane's OTG sections - covers spec §6 rule #4)
        var basisFindings = data.Findings.Where(f => f.Type == "Rate basis changed").ToList();
        var s6 = ws.Cell(r++, 1);
        s6.Value = $"6. Rate basis changes (Zone <-> Mileage) ({basisFindings.Count}):";
        s6.Style.Font.Bold = true;
        if (basisFindings.Count > 0)
        {
            WriteTableHeader(ws, r++, "Job", "Change");
            foreach (var f in basisFindings.OrderBy(f => f.JobNo))
            {
                ws.Cell(r, 1).Value = f.JobNo;
                ws.Cell(r, 2).Value = f.Detail;
                r++;
            }
        }

        ws.Column(1).Width = 28;
        ws.Column(2).Width = 36;
        ws.Column(3).Width = 16;
        ws.Column(4).Width = 16;
        ws.Column(5).Width = 12;
    }

    private void WriteTableHeader(IXLWorksheet ws, int row, params string[] headers)
    {
        var bg = string.IsNullOrWhiteSpace(branding.PrimaryColour) ? "#1F3864" : branding.PrimaryColour;
        for (var i = 0; i < headers.Length; i++)
        {
            var cell = ws.Cell(row, i + 1);
            cell.Value = headers[i];
            cell.Style.Font.Bold = true;
            cell.Style.Font.FontColor = XLColor.White;
            cell.Style.Fill.BackgroundColor = XLColor.FromHtml(bg);
        }
    }

    private void ComposeNotes(XLWorkbook wb)
    {
        var ws = wb.Worksheets.Add("Notes");
        var totalJobs = data.Jobs.Count;
        var totalCustomers = data.Jobs.Select(j => j.Header.ClientName)
            .Where(c => !string.IsNullOrWhiteSpace(c)).Distinct().Count();

        var lines = new[]
        {
            $"Job-by-job price detail generated {DateTime.UtcNow:yyyy-MM-dd} ({totalJobs} jobs, {totalCustomers} customers).",
            "Source: DespatchWeb live + archive tables (TucJob(Archive), PricingBreakdown(Archive),",
            "        JobDeliveryJourney(Archive), TucJobItems(Archive)). Read-only export - never uploaded / reapplied.",
            "",
            "AS BOOKED = PricingBreakdown insert rows in the DB delivery journey at job creation (first 120s batch).",
            "  The 120s window captures accessorial lines typed on the booking screen seconds after the engine rate lines",
            "  (booking-screen accessorials often land ~30s after the engine writes rate lines - both count as \"booked\").",
            "  As-Booked Source: Engine = interactive booking / rate SP; NightlySp = uspPrebookSet recurring spawn",
            "  (fuel legitimately deferred, so $0 booked fuel is correct - not a defect); Manual = hand-priced.",
            "  As-booked COURIER PAY is not shown - the journey tracks charge amount only, never cost.",
            "CURRENT   = Pricing Breakdown table rows (ChargeAmount column) at the moment of export.",
            "            Courier Pay column = CostAmount (driver pay, not \"cost\").",
            "CHANGES   = journey rows after booking: line adds / renames / deletes, per-line value changes",
            "            (Pricing: X old->new), header changes (ucjbAmount, FuelSurchargeAmount, ucjbVoid),",
            "            each attributed to SYSTEM or a named staff member.",
            "Change timestamps shown in tenant-local time (DB stores UTC).",
            "",
            "ACCESSORIAL BREAKOUT: one column per accessorial bucket, classified by charge-line NAME. The DB",
            "  IsAccessorial flag is 0 on ALL engine-inserted rows (known insert-path bug) so name classification is",
            "  the only reliable method. 'Fuel' bucket includes Base / Distance / Weight / Cubic Fuel lines.",
            "  Included / Charged unit columns are all 0 in the DB - parse units from the line name where present.",
            "",
            "ROAD MI: TucJob.TotalDistance - populated on live jobs only; blank on archived rows until the",
            "  distance backfill lands. A blank cell is a booking that didn't capture road miles at all, not a bug.",
            "SYS MI (LINES): parsed from distance charge-line names (e.g. \"Distance (20 mi incl., 65 mi charged)\" -> 85).",
            "ON-SITE MIN: DeliveryArrival->Completion and PickupArrival->PickupTime gaps where the DB has arrival",
            "  stamps - use for wait-time billing checks (values > 600 min or negative are blanked).",
            "",
            "Colours: yellow = pricing changed after booking; orange = voided (ucjbVoid); green = manually-priced",
            "  or no engine booking price. Red bold gap = header Amount <> sum of lines.",
            "See Findings sheet for auto-detected issues (header-fuel x1.25 pattern, double-charges, deleted lines,",
            "  zone <-> mileage restructures, per-staff pricing-edit counts)."
        };
        for (var i = 0; i < lines.Length; i++) ws.Cell(i + 1, 1).Value = lines[i];
        ws.Column(1).Width = 120;
    }

    private void WriteHeaderRow(IXLWorksheet ws, List<string> headers)
    {
        // ReportBranding exposes PrimaryColour (British spelling) as the header/accent colour;
        // fall back to the house dark navy when the branding record has none configured.
        var bg = string.IsNullOrWhiteSpace(branding.PrimaryColour) ? "#1F3864" : branding.PrimaryColour;
        for (var i = 0; i < headers.Count; i++)
        {
            var cell = ws.Cell(1, i + 1);
            cell.Value = headers[i];
            cell.Style.Font.Bold = true;
            cell.Style.Font.FontColor = XLColor.White;
            cell.Style.Fill.BackgroundColor = XLColor.FromHtml(bg);
            cell.Style.Alignment.WrapText = true;
        }
    }

    private static void Money(IXLCell cell, decimal v)
    {
        cell.Value = v;
        cell.Style.NumberFormat.Format = "$#,##0.00";
    }

    private static void RowFill(IXLWorksheet ws, int row, int cols, PriceDetailJob j)
    {
        var hex = j.Header.Void ? "#F8CBAD"
            : j.IsManual ? "#E2EFDA"
            : j.ChangeSummary.Count > 0 ? "#FFF2CC"
            : null;
        if (hex is not null)
        {
            ws.Range(row, 1, row, cols).Style.Fill.BackgroundColor = XLColor.FromHtml(hex);
        }
    }

    // Boxed nullable value types with a value come through as their underlying type; nulls hit
    // the "case null" arm. No need for separate int? / decimal? / DateTime? cases.
    private static void SetCell(IXLCell cell, object? v)
    {
        switch (v)
        {
            case null:
                cell.Clear();
                return;
            case string s:
                cell.Value = s;
                return;
            case int i:
                cell.Value = i;
                return;
            case short sh:
                cell.Value = sh;
                return;
            case long l:
                cell.Value = l;
                return;
            case decimal d:
                cell.Value = d;
                return;
            case double db:
                cell.Value = db;
                return;
            case DateTime dt:
                cell.Value = dt;
                return;
            case DateTimeOffset dto:
                cell.Value = dto.DateTime;
                return;
            case bool b:
                cell.Value = b;
                return;
            default:
                cell.Value = v.ToString();
                return;
        }
    }
}