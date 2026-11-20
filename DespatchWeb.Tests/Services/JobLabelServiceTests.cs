using DeliverDifferent.AlertLabel.Data.Models;
using DeliverDifferent.AlertLabel.Data.Services;
using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Exceptions;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Services;
using NSubstitute;

namespace DespatchWeb.Tests.Services;

public class JobLabelServiceTests : IAsyncDisposable
{
    private const int JobTemplate = 11;
    private const int SpeedTemplate = 12;
    private const int BulkTemplate = 13;
    private const int SpeedWithLabel = 5;

    private readonly SqliteTestDatabase _db = new();
    private readonly IAlertLabelService _alertLabels = Substitute.For<IAlertLabelService>();
    private AlertLabelRequest? _request;

    public JobLabelServiceTests()
    {
        _alertLabels.GeneratePdfAsync(Arg.Do<AlertLabelRequest>(r => _request = r)).Returns([1, 2, 3]);

        using var seed = _db.CreateContext();
        var settings = TestSettings.Minimal();
        settings.DefaultJobLabelId = JobTemplate;
        settings.DefaultBulkLabelId = BulkTemplate;
        seed.TblSettings.Add(settings);
        seed.TucJobTypes.Add(new TucJobType { UcjtId = SpeedWithLabel, UcjtName = "Overnight", ShortName = "ON", CreatedBy = "tests", LastModifiedBy = "tests", LabelId = SpeedTemplate });
        seed.SaveChanges();
    }

    public async ValueTask DisposeAsync()
    {
        GC.SuppressFinalize(this);
        await _db.DisposeAsync();
    }

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private async Task Seed(params object[] rows)
    {
        await using var seed = _db.CreateContext();
        seed.AddRange(rows);
        await seed.SaveChangesAsync(Ct);
    }

    private JobLabelService Service(ScopeContext? scope = null)
    {
        var provider = Substitute.For<IScopeProvider>();
        provider.Scope.Returns(scope ?? new ScopeContext((int)ClientType.Tenant, null, null));
        return new JobLabelService(SqliteTestDatabase.CreateFactoryMock(new DespatchContext(_db.Options, provider)), _alertLabels);
    }

    private static TucJob Job(int id, string number, int? parentId = null, int? relationshipType = null, int clientId = 10) =>
        new() { UcjbId = id, UcjbNumber = number, ParentId = parentId, JobRelationshipTypeId = relationshipType, UcjbClientId = clientId };

    [Fact]
    public async Task PlainJob_PrintsItsOwnLabelWithTheParentDatedMode()
    {
        await Seed(Job(1, "AB100"));

        var label = await Service().GetLabelAsync(1, isBulk: false);

        Assert.NotNull(label);
        Assert.Equal("Label-AB100.pdf", label.FileName);
        Assert.Equal([1, 2, 3], label.Pdf);
        Assert.Equal((1, 7, JobTemplate), (_request!.JobId, _request.Mode, _request.TemplateId));
    }

    [Theory]
    [InlineData(21)] // LHP
    [InlineData(22)] // LH1
    [InlineData(23)] // DEL itself
    public async Task LinehaulLeg_PrintsTheDelLegDatedFromTheLeg(int selectedId)
    {
        await Seed(
            Job(21, "E15EDLHP", parentId: 30, relationshipType: 20),
            Job(22, "E15EDLH1", parentId: 30, relationshipType: 20),
            Job(23, "E15EDDEL", parentId: 30, relationshipType: 20));

        var label = await Service().GetLabelAsync(selectedId, isBulk: false);

        Assert.Equal("Label-E15EDDEL.pdf", label!.FileName);
        Assert.Equal((23, 9), (_request!.JobId, _request.Mode));
    }

    [Theory]
    [InlineData(87)] // flight parent
    [InlineData(88)] // DF1
    [InlineData(89)] // DF2
    public async Task FlightJob_PrintsTheDf3Leg(int selectedId)
    {
        await Seed(
            Job(87, "KT161DF", relationshipType: 12),
            Job(88, "KT161DF1", parentId: 87, relationshipType: 13),
            Job(89, "KT161DF2", parentId: 87, relationshipType: 13),
            Job(90, "KT161DF3", parentId: 87, relationshipType: 13));

        await Service().GetLabelAsync(selectedId, isBulk: false);

        Assert.Equal((90, 9), (_request!.JobId, _request.Mode));
    }

    [Theory]
    [InlineData("LH123")]
    [InlineData("MODEL")]
    [InlineData("ABDF2")]
    public async Task ParentlessJobWithALegLikeNumber_PrintsItselfDatedFromItsParent(string number)
    {
        await Seed(Job(1, number));

        await Service().GetLabelAsync(1, isBulk: false);

        Assert.Equal((1, 7), (_request!.JobId, _request.Mode));
    }

    [Fact]
    public async Task LegWithoutADelSibling_IsRefused()
    {
        await Seed(Job(21, "E15EDLHP", parentId: 30, relationshipType: 20));

        var refusal = await Assert.ThrowsAsync<JobLabelException>(() => Service().GetLabelAsync(21, isBulk: false));

        Assert.Contains("E15EDDEL", refusal.Message);
        await _alertLabels.DidNotReceive().GeneratePdfAsync(Arg.Any<AlertLabelRequest>());
    }

    [Fact]
    public async Task FlightParentWithoutADf3Leg_IsRefused()
    {
        await Seed(Job(87, "KT161DF", relationshipType: 12));

        await Assert.ThrowsAsync<JobLabelException>(() => Service().GetLabelAsync(87, isBulk: false));
    }

    [Fact]
    public async Task BulkChildWithoutALegSuffix_IsItsOwnParent()
    {
        await Seed(Job(40, "BK40", parentId: 7, relationshipType: 20));

        await Service().GetLabelAsync(40, isBulk: false);

        Assert.Equal((40, 9), (_request!.JobId, _request.Mode));
    }

    [Fact]
    public async Task SplitChildEndingInDel_IsNotTreatedAsALeg()
    {
        await Seed(
            Job(1, "AB100", relationshipType: 8),
            Job(2, "AB1DEL", parentId: 1, relationshipType: 9),
            Job(3, "AB1DF3", parentId: 1, relationshipType: 9));

        await Service().GetLabelAsync(2, isBulk: false);

        Assert.Equal((2, 7), (_request!.JobId, _request.Mode));
    }

    [Fact]
    public async Task DelNumberedJobOutsideTheFamilyTypes_IsNotPickedUp()
    {
        await Seed(
            Job(21, "E15EDLHP", parentId: 30, relationshipType: 20),
            Job(23, "E15EDDEL", relationshipType: 1));

        await Assert.ThrowsAsync<JobLabelException>(() => Service().GetLabelAsync(21, isBulk: false));
    }

    [Fact]
    public async Task DelLegOfAnotherClient_IsNotPickedUp()
    {
        await Seed(
            Job(21, "E15EDLHP", parentId: 30, relationshipType: 20),
            Job(23, "E15EDDEL", parentId: 30, relationshipType: 20, clientId: 99));

        await Assert.ThrowsAsync<JobLabelException>(() => Service().GetLabelAsync(21, isBulk: false));
    }

    [Fact]
    public async Task ArchivedDelLeg_IsFound()
    {
        await Seed(
            Job(21, "E15EDLHP", parentId: 30, relationshipType: 20),
            new TucJobArchive { UcjbId = 23, UcjbNumber = "E15EDDEL", ParentId = 30, JobRelationshipTypeId = 20, UcjbClientId = 10 });

        await Service().GetLabelAsync(21, isBulk: false);

        Assert.Equal(23, _request!.JobId);
    }

    [Fact]
    public async Task SpeedLabel_WinsOverTheDefault()
    {
        var job = Job(1, "AB100");
        job.UcjbSpeed = SpeedWithLabel;
        await Seed(job);

        await Service().GetLabelAsync(1, isBulk: false);

        Assert.Equal(SpeedTemplate, _request!.TemplateId);
    }

    [Fact]
    public async Task ZeroSpeedLabel_FallsBackToTheDefault()
    {
        await Seed(new TucJobType { UcjtId = 55, UcjtName = "Standard", ShortName = "ST", CreatedBy = "tests", LastModifiedBy = "tests", LabelId = 0 });
        var job = Job(1, "AB100");
        job.UcjbSpeed = 55;
        await Seed(job);

        await Service().GetLabelAsync(1, isBulk: false);

        Assert.Equal(JobTemplate, _request!.TemplateId);
    }

    [Fact]
    public async Task OutOfScopeJob_ReturnsNull()
    {
        await Seed(Job(1, "AB100"));

        var label = await Service(new ScopeContext((int)ClientType.NetworkPartner, null, NpAgentId: 77)).GetLabelAsync(1, isBulk: false);

        Assert.Null(label);
        await _alertLabels.DidNotReceive().GeneratePdfAsync(Arg.Any<AlertLabelRequest>());
    }

    [Fact]
    public async Task MissingJob_ReturnsNull()
    {
        Assert.Null(await Service().GetLabelAsync(404, isBulk: false));
    }

    [Fact]
    public async Task CourierNetworkJob_IsRefused()
    {
        var job = Job(1, "AB100");
        job.Gssconnote = "CP-123";
        await Seed(job);

        await Assert.ThrowsAsync<JobLabelException>(() => Service().GetLabelAsync(1, isBulk: false));
        await _alertLabels.DidNotReceive().GeneratePdfAsync(Arg.Any<AlertLabelRequest>());
    }

    [Fact]
    public async Task CarrierTrunkLeg_StillPrintsOurOwnDelLeg()
    {
        var trunk = Job(21, "E15EDLHP", parentId: 30, relationshipType: 20);
        trunk.Gssconnote = "GSS-1";
        await Seed(trunk, Job(23, "E15EDDEL", parentId: 30, relationshipType: 20));

        await Service().GetLabelAsync(21, isBulk: false);

        Assert.Equal(23, _request!.JobId);
    }

    [Fact]
    public async Task CarrierDelLeg_IsRefused()
    {
        var del = Job(23, "E15EDDEL", parentId: 30, relationshipType: 20);
        del.Gssconnote = "GSS-1";
        await Seed(Job(21, "E15EDLHP", parentId: 30, relationshipType: 20), del);

        await Assert.ThrowsAsync<JobLabelException>(() => Service().GetLabelAsync(21, isBulk: false));
    }

    [Fact]
    public async Task NoTemplateAnywhere_IsRefused()
    {
        await using (var context = _db.CreateContext())
        {
            context.TblSettings.Single().DefaultJobLabelId = null;
            await context.SaveChangesAsync(Ct);
        }
        await Seed(Job(1, "AB100"));

        await Assert.ThrowsAsync<JobLabelException>(() => Service().GetLabelAsync(1, isBulk: false));
    }

    [Fact]
    public async Task BulkRow_PrintsTheBulkLabel()
    {
        await Seed(new TblBulkJob { BulkJobId = 7, JobNumber = "BK7", ClientId = 10, Speed = 0 });

        var label = await Service().GetLabelAsync(7, isBulk: true);

        Assert.Equal("Label-BK7.pdf", label!.FileName);
        Assert.Equal((7, 2, BulkTemplate), (_request!.JobId, _request.Mode, _request.TemplateId));
    }

    [Fact]
    public async Task OutOfScopeBulkRow_ReturnsNull()
    {
        await Seed(new TblBulkJob { BulkJobId = 7, JobNumber = "BK7", ClientId = 10, Speed = 0 });

        Assert.Null(await Service(new ScopeContext((int)ClientType.Customer, ClientId: 99, null)).GetLabelAsync(7, isBulk: true));
    }
}
