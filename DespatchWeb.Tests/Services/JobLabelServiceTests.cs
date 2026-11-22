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
    private static readonly DateTime Today = new(2026, 11, 20);
    private const int JobTemplate = 11;
    private const int BulkTemplate = 13;

    private readonly SqliteTestDatabase _db = new();
    private readonly IAlertLabelService _alertLabels = Substitute.For<IAlertLabelService>();
    private readonly ILabelTemplateResolver _templates = Substitute.For<ILabelTemplateResolver>();
    private AlertLabelRequest? _request;

    public JobLabelServiceTests()
    {
        _alertLabels.GeneratePdfAsync(Arg.Do<AlertLabelRequest>(r => _request = r)).Returns([1, 2, 3]);
        _templates.ResolveAsync(Arg.Any<DespatchContext>(), Arg.Any<int?>(), Arg.Any<int?>(), false, Arg.Any<CancellationToken>()).Returns(JobTemplate);
        _templates.ResolveAsync(Arg.Any<DespatchContext>(), Arg.Any<int?>(), Arg.Any<int?>(), true, Arg.Any<CancellationToken>()).Returns(BulkTemplate);
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
        return new JobLabelService(SqliteTestDatabase.CreateFactoryMock(new DespatchContext(_db.Options, provider)), _alertLabels, _templates, new FakeTenantClock(Today));
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
    public async Task Template_IsResolvedFromTheDelLegsClientAndSpeed()
    {
        var lhp = Job(21, "E15EDLHP", parentId: 30, relationshipType: 20);
        lhp.UcjbSpeed = 4;
        var del = Job(23, "E15EDDEL", parentId: 30, relationshipType: 20, clientId: 10);
        del.UcjbSpeed = 5;
        await Seed(lhp, del);

        await Service().GetLabelAsync(21, isBulk: false, Ct);

        await _templates.Received(1).ResolveAsync(Arg.Any<DespatchContext>(), 10, 5, false, Arg.Any<CancellationToken>());
        Assert.Equal(JobTemplate, _request!.TemplateId);
    }

    [Theory]
    [InlineData(null)]
    [InlineData(0)]
    public async Task NoJobTemplate_IsRefused(int? resolved)
    {
        _templates.ResolveAsync(Arg.Any<DespatchContext>(), Arg.Any<int?>(), Arg.Any<int?>(), false, Arg.Any<CancellationToken>()).Returns(resolved);
        await Seed(Job(1, "AB100"));

        await Assert.ThrowsAsync<JobLabelException>(() => Service().GetLabelAsync(1, isBulk: false, Ct));
        await _alertLabels.DidNotReceive().GeneratePdfAsync(Arg.Any<AlertLabelRequest>());
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
    public async Task BulkRow_PrintsTheBulkLabel()
    {
        await Seed(Bulk());

        var label = await Service().GetLabelAsync(7, isBulk: true);

        Assert.Equal("Label-BK7.pdf", label!.FileName);
        Assert.Equal((7, 2, BulkTemplate), (_request!.JobId, _request.Mode, _request.TemplateId));
        await _templates.Received(1).ResolveAsync(Arg.Any<DespatchContext>(), 10, 3, true, Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData(null)]
    [InlineData(0)]
    public async Task NoBulkTemplate_IsRefused(int? resolved)
    {
        _templates.ResolveAsync(Arg.Any<DespatchContext>(), Arg.Any<int?>(), Arg.Any<int?>(), true, Arg.Any<CancellationToken>()).Returns(resolved);
        await Seed(Bulk());

        await Assert.ThrowsAsync<JobLabelException>(() => Service().GetLabelAsync(7, isBulk: true, Ct));
        await _alertLabels.DidNotReceive().GeneratePdfAsync(Arg.Any<AlertLabelRequest>());
    }

    [Fact]
    public async Task OutOfScopeBulkRow_ReturnsNull()
    {
        await Seed(Bulk());

        Assert.Null(await Service(new ScopeContext((int)ClientType.Customer, ClientId: 99, null)).GetLabelAsync(7, isBulk: true));
    }

    private static TblBulkJob Bulk(DateTime? bookDate = null, bool isVoid = false) =>
        new() { BulkJobId = 7, JobNumber = "BK7", ClientId = 10, Speed = 3, BookDate = bookDate ?? Today, Void = isVoid };

    [Fact]
    public async Task VoidBulkRow_IsRefused()
    {
        await Seed(Bulk(isVoid: true));

        await Assert.ThrowsAsync<JobLabelException>(() => Service().GetLabelAsync(7, isBulk: true, Ct));
        await _alertLabels.DidNotReceive().GeneratePdfAsync(Arg.Any<AlertLabelRequest>());
    }

    [Fact]
    public async Task BulkRowOlderThanAYear_IsRefused()
    {
        await Seed(Bulk(Today.AddYears(-1).AddDays(-1)));

        await Assert.ThrowsAsync<JobLabelException>(() => Service().GetLabelAsync(7, isBulk: true, Ct));
    }

    [Fact]
    public async Task VoidJob_IsRefused()
    {
        var job = Job(1, "AB100");
        job.UcjbVoid = true;
        await Seed(job);

        await Assert.ThrowsAsync<JobLabelException>(() => Service().GetLabelAsync(1, isBulk: false, Ct));
        await _alertLabels.DidNotReceive().GeneratePdfAsync(Arg.Any<AlertLabelRequest>());
    }

    [Fact]
    public async Task VoidDelLeg_IsRefusedNamingTheLeg()
    {
        var del = Job(23, "E15EDDEL", parentId: 30, relationshipType: 20);
        del.UcjbVoid = true;
        await Seed(Job(21, "E15EDLHP", parentId: 30, relationshipType: 20), del);

        var refusal = await Assert.ThrowsAsync<JobLabelException>(() => Service().GetLabelAsync(21, isBulk: false, Ct));

        Assert.Contains("E15EDDEL", refusal.Message);
    }
}
