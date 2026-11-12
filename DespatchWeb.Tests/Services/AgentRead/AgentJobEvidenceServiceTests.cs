using System.Globalization;
using System.Text.Json.Nodes;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Services.AgentRead;
using NSubstitute;

namespace DespatchWeb.Tests.Services.AgentRead;

// Parity with dfrntmcp prototype-ts/proposed/job_evidence (job_evidence.test.ts), minus the restore blast radius and the
// overlay-document probe, which belong to write tools and another service.
public class AgentJobEvidenceServiceTests
{
    private static readonly JsonObject Fixture = AgentFixture.Load("job_evidence");

    private readonly IJobQueryRepository _jobs = Substitute.For<IJobQueryRepository>();
    private readonly IJobPhotoService _photos = Substitute.For<IJobPhotoService>();
    private readonly AgentJobEvidenceService _service;

    public AgentJobEvidenceServiceTests()
    {
        _service = new AgentJobEvidenceService(_jobs, _photos);
        var byNumber = AgentFixture.Csv((string)Fixture["searchCsv"]!).ToDictionary(r => r["JobNumber"], r => int.Parse(r["Id"], CultureInfo.InvariantCulture));
        _jobs.GetJobIdByNumberAsync(default!).ReturnsForAnyArgs(ci => byNumber.TryGetValue(ci.Arg<string>(), out var id) ? id : null);
        _jobs.GetJobWithoutMarkingReadAsync(default).ReturnsForAnyArgs(ci =>
        {
            var j = Fixture["detail"]![ci.ArgAt<int>(0).ToString()]!["job"]!;
            return new JobViewModel
            {
                Id = (int)j["jobId"]!, JobNo = (string?)j["jobNumber"], Client = (string?)j["clientName"], StatusName = (string?)j["statusName"],
                Void = (bool?)j["void"], PodName = (string?)j["podName"],
                CompletedTime = j["completedTime"] is { } c ? DateTime.Parse((string)c, CultureInfo.InvariantCulture) : null
            };
        });
        _photos.ListCapturedMediaAsync(default, default, default).ReturnsForAnyArgs(ci =>
        {
            var id = ci.ArgAt<int>(0).ToString();
            if (ci.ArgAt<int>(1) != 2026 || ci.ArgAt<int>(2) != 3) return Task.FromResult<IReadOnlyList<CapturedMediaInfo>>([]);
            IEnumerable<CapturedMediaInfo> Of(string leg, string set) =>
                (Fixture[set]![id]?.AsArray() ?? []).Select(p => new CapturedMediaInfo(leg, (string)p!["s3Key"]!, (long)p["size"]!, DateTime.Parse((string)p["lastModified"]!, CultureInfo.InvariantCulture)));
            return Task.FromResult<IReadOnlyList<CapturedMediaInfo>>([.. Of("delivery", "deliveryPhotos"), .. Of("pickup", "pickupPhotos")]);
        });
        _photos.GetAttachedFilesAsync(default).ReturnsForAnyArgs(ci => Task.FromResult<IReadOnlyList<S3FileInfo>>(
            [.. (Fixture["attachedFiles"]![ci.ArgAt<int>(0).ToString()]?.AsArray() ?? []).Select(f => new S3FileInfo
            {
                S3Key = (string)f!["s3Key"]!, FileName = (string)f["fileName"]!, Size = (long)f["size"]!,
                LastModified = DateTime.Parse((string)f["lastModified"]!, CultureInfo.InvariantCulture)
            })]));
    }

    private static string[] Warnings(JsonObject o) => [.. o["warnings"]!.AsArray().Select(w => (string)w!)];
    private static string[] Flags(JsonObject o) => [.. o["flags"]!.AsArray().Select(w => (string)w!)];

    [Fact]
    public async Task KeysThePhotoReadsOffCompletedTime_AndNeverReturnsImageBytesOrKeys()
    {
        var o = await _service.GetAsync("QQ4401ZZ", null, null, all: true, 100);

        Assert.True((bool)o["found"]!);
        Assert.Equal("QQ4401ZZ", (string?)o["job"]!["number"]);
        Assert.Equal("R. Alvarez", (string?)o["job"]!["podName"]);
        await _photos.Received(1).ListCapturedMediaAsync(900101, 2026, 3);
        Assert.Equal("completedTime", (string?)o["month"]!["source"]);
        Assert.Equal("signed_and_captured", (string?)o["verdict"]);
        var counts = o["counts"]!;
        Assert.Equal(1, (int)counts["deliverySignatures"]!);
        Assert.Equal(2, (int)counts["deliveryPhotos"]!);
        Assert.Equal(0, (int)counts["pickupSignatures"]!);
        Assert.Equal(0, (int)counts["pickupPhotos"]!);
        Assert.Equal(1, (int)counts["pickupScannedDocuments"]!);
        Assert.Equal(1, (int)counts["attachments"]!);
        Assert.Equal(0, (int)counts["unclassified"]!);
        Assert.Equal(5, o["artefacts"]!.AsArray().Count);
        Assert.Contains(o["artefacts"]!.AsArray(), a => (string?)a!["kind"] == "signature" && (string?)a["leg"] == "delivery");
        var body = o.ToJsonString();
        Assert.DoesNotContain("iVBORw0KGgo", body);
        Assert.DoesNotContain("s3Key", body);
        Assert.DoesNotContain("data", o["artefacts"]![0]!.AsObject().Select(kv => kv.Key));
    }

    [Fact]
    public async Task APodNameWithNoImage_IsNameOnly()
    {
        var o = await _service.GetAsync(null, 900102, null, false, 100);

        Assert.Equal("name_only", (string?)o["verdict"]);
        Assert.Contains(Flags(o), f => f.Contains("POD name only"));
        Assert.Null(o["artefacts"]);
    }

    [Fact]
    public async Task NoCompletedTime_SkipsThePhotoReads_RatherThanRunningThemAgainstTodaysMonth()
    {
        var o = await _service.GetAsync("QQ4403ZZ", null, null, false, 100);

        Assert.Equal("not_completed", (string?)o["verdict"]);
        Assert.Equal("none", (string?)o["month"]!["source"]);
        await _photos.DidNotReceiveWithAnyArgs().ListCapturedMediaAsync(default, default, default);
        Assert.Contains(Warnings(o), w => w.Contains("SKIPPED"));
        Assert.Contains(Flags(o), f => f.Contains("no month to key the S3 lookup by"));
    }

    [Fact]
    public async Task ACallerSuppliedMonth_IsLabelled_AndFlaggedWhenItContradictsTheRecord()
    {
        var o = await _service.GetAsync(null, 900101, "2026-04", false, 100);

        await _photos.Received(1).ListCapturedMediaAsync(900101, 2026, 4);
        Assert.Equal("caller", (string?)o["month"]!["source"]);
        Assert.Equal(0, (int)o["counts"]!["deliveryPhotos"]!);
        Assert.Equal("name_only", (string?)o["verdict"]);
        Assert.Contains(Warnings(o), w => w.Contains("does not match completedTime"));
    }

    [Fact]
    public async Task AnUnknownJobNumber_IsNotFound_NotGuessed() =>
        Assert.False((bool)(await _service.GetAsync("NOSUCH1", null, null, false, 100))["found"]!);

    [Fact]
    public async Task AMalformedMonth_IsRefused() =>
        await Assert.ThrowsAsync<AgentReadException>(() => _service.GetAsync(null, 900101, "March", false, 100));

    [Fact]
    public void Helpers_MonthComesOffTheRecord_FoldersClassify_VerdictsFollow()
    {
        Assert.Equal((2026, 3), AgentJobEvidenceService.CompletionMonth(new DateTime(2026, 3, 14, 15, 22, 10)));
        Assert.Null(AgentJobEvidenceService.CompletionMonth(null));

        Assert.Equal("signature", AgentJobEvidenceService.Classify(new CapturedMediaInfo("delivery", "DeliverySignatures/2026/03/1-a.png", 1, null)).Kind);
        Assert.Equal("scanned_document", AgentJobEvidenceService.Classify(new CapturedMediaInfo("pickup", "PickupScannedDocuments/2026/03/1-a.pdf", 1, null)).Kind);
        Assert.Equal("unclassified", AgentJobEvidenceService.Classify(new CapturedMediaInfo("delivery", "somewhere/else/1-a.jpg", 1, null)).Kind);

        var empty = AgentJobEvidenceService.Count([]);
        Assert.Equal("void", AgentJobEvidenceService.Assess(new DateTime(2026, 3, 14), "R", true, empty, true).Verdict);
        Assert.Equal("not_completed", AgentJobEvidenceService.Assess(null, "R", false, empty, false).Verdict);
        Assert.Equal("no_proof", AgentJobEvidenceService.Assess(new DateTime(2026, 3, 14), null, false, empty, true).Verdict);
        var pickupSigOnly = AgentJobEvidenceService.Count([new Artifact("signature", "pickup", null, null, null, null, null)]);
        var (verdict, flags) = AgentJobEvidenceService.Assess(new DateTime(2026, 3, 14), "R", false, pickupSigOnly, true);
        Assert.Equal("name_and_photos", verdict);
        Assert.Contains(flags, f => f.Contains("only signature is on the PICKUP leg"));
    }

    [Fact]
    public async Task TheService_OnlyListsAndReads()
    {
        await _service.GetAsync("QQ4401ZZ", null, null, true, 100);

        await _photos.DidNotReceiveWithAnyArgs().UploadJobAttachmentAsync(default, default!);
        await _photos.DidNotReceiveWithAnyArgs().DeleteFileAsync(default!);
        await _photos.DidNotReceiveWithAnyArgs().ArchiveJobPhotoAsync(default, default!);
        await _photos.DidNotReceiveWithAnyArgs().ArchiveJobCapturedMediaAsync(default, default, default);
        await _photos.DidNotReceiveWithAnyArgs().GetDeliveryPhotosAsync(default, default, default);
        await _photos.DidNotReceiveWithAnyArgs().GetPickupPhotosAsync(default, default, default);
    }
}
