using DeliverDifferent.AgentAlerts.Rendering;
using DespatchWeb.Constants;
using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Helpers;
using DespatchWeb.Interfaces;
using DespatchWeb.Repositories;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// Agent alerts: one email per (job, agent, alert) unless the dispatcher asks to send it again, the tenant's on/off
/// switch, and an AgentAlertLog row written with every message. The SQL Server lock (UPDLOCK, HOLDLOCK) can't run on
/// SQLite; these cover the logic, the lock is checked against a real server.
/// </summary>
public class NationwideJobRepositoryAgentAlertTests : IAsyncDisposable
{
    private const int JobId = 100;
    private const int AgentId = 1;
    private const string Link = "https://in.otgcargo.deliverdifferent.com/Job/Details/TOKEN";

    private readonly DespatchContext _context;
    private readonly IDbContextFactory<DespatchContext> _contextFactoryMock;
    private readonly SqliteTestDatabase _db = new();
    private readonly IInboundAgentLinkService _linkService = Substitute.For<IInboundAgentLinkService>();
    private readonly ITenantInfoService _tenantInfo = Substitute.For<ITenantInfoService>();

    public NationwideJobRepositoryAgentAlertTests()
    {
        _context = _db.CreateContext();
        _contextFactoryMock = SqliteTestDatabase.CreateFactoryMock(_context);
        _tenantInfo.GetTenantTimeZone().Returns("New Zealand Standard Time");
        _tenantInfo.GetStaffId().Returns(7);
        _tenantInfo.GetStaffIdOrNull().Returns(7);
        _linkService.BuildJobLinkAsync(Arg.Any<int>(), Arg.Any<CancellationToken>()).Returns(Link);
    }

    public async ValueTask DisposeAsync()
    {
        GC.SuppressFinalize(this);
        await _context.DisposeAsync();
        await _db.DisposeAsync();
    }

    private NationwideJobRepository Repository() => new(_contextFactoryMock, _tenantInfo, new FakeTenantClock(TestDates.Now),
        Substitute.For<IClearListEnvelopeService>(), _linkService);

    private async Task SeedAsync(string jobNumber = "KT2103CRTDEL")
    {
        _context.TucJobs.Add(new TucJob { UcjbId = JobId, UcjbNumber = jobNumber });
        _context.TucAgents.Add(new TucAgent
        {
            UcagId = AgentId, UcagName = "Metro Air", UcagFax = "ops@metro.example", CreatedBy = "Test", LastModifiedBy = "Test"
        });
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    private Task<int> MessageCountAsync() => _context.TucManualMessages.CountAsync(TestContext.Current.CancellationToken);

    [Fact]
    public async Task Assign_QueuesTheAlert_AndLogsItWithTheMessage()
    {
        await SeedAsync();

        var result = await Repository().AddAgentToJobAsync(AgentId, JobId);

        Assert.Equal(AgentInboundEmailStatus.Queued, result.Status);
        Assert.Equal(AgentAlertType.Delivery, result.AlertType);
        var message = await _context.TucManualMessages.SingleAsync(TestContext.Current.CancellationToken);
        var log = await _context.AgentAlertLogs.SingleAsync(TestContext.Current.CancellationToken);
        Assert.Equal(message.UcmmId, log.ManualMessageId);
        Assert.Equal(JobId, log.JobId);
        Assert.Equal(AgentId, log.AgentId);
        Assert.Equal((byte)AgentAlertType.Delivery, log.AlertType);
        Assert.Equal("ops@metro.example", log.ToEmail);
        Assert.False(log.IsResend);
        Assert.False(log.IsTest);
        Assert.Equal("DespatchWeb", log.Source);
        Assert.Equal(7, log.CreatedByStaffId);
    }

    [Fact]
    public async Task ReAssigningTheSameAgent_DoesNotEmailAgain()
    {
        await SeedAsync();
        var repository = Repository();
        await repository.AddAgentToJobAsync(AgentId, JobId);

        var second = await repository.AddAgentToJobAsync(AgentId, JobId);

        Assert.Equal(AgentInboundEmailStatus.AlreadySent, second.Status);
        Assert.False(second.WillEmail);
        Assert.Equal(1, await MessageCountAsync());
        Assert.Equal(1, await _context.AgentAlertLogs.CountAsync(TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task SendAgain_SendsASecondAlert_MarkedAsAResend()
    {
        await SeedAsync();
        var repository = Repository();
        await repository.AddAgentToJobAsync(AgentId, JobId);

        var again = await repository.AddAgentToJobAsync(AgentId, JobId, resend: true);

        Assert.Equal(AgentInboundEmailStatus.Queued, again.Status);
        Assert.Equal(2, await MessageCountAsync());
        Assert.Equal([false, true], await _context.AgentAlertLogs.OrderBy(l => l.Id).Select(l => l.IsResend)
            .ToListAsync(TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task Preview_SaysAlreadySent_SoTheDialogCanOfferSendAgain()
    {
        await SeedAsync();
        var repository = Repository();
        await repository.AddAgentToJobAsync(AgentId, JobId);

        var preview = await repository.GetAgentInboundEmailPreviewAsync(AgentId, JobId);

        Assert.Equal(AgentInboundEmailStatus.AlreadySent, preview.Status);
        Assert.Equal("ops@metro.example", preview.AgentEmail);
    }

    [Fact]
    public async Task ADifferentAgentOnTheSameJob_GetsTheirOwnAlert()
    {
        await SeedAsync();
        _context.TucAgents.Add(new TucAgent
        {
            UcagId = 2, UcagName = "Swift", UcagFax = "desk@swift.example", CreatedBy = "Test", LastModifiedBy = "Test"
        });
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);
        var repository = Repository();
        await repository.AddAgentToJobAsync(AgentId, JobId);

        var other = await repository.AddAgentToJobAsync(2, JobId);

        Assert.Equal(AgentInboundEmailStatus.Queued, other.Status);
        Assert.Equal(2, await MessageCountAsync());
    }

    [Fact]
    public async Task ATestSendDoesNotCountAsAlreadySent()
    {
        await SeedAsync();
        _context.AgentAlertLogs.Add(new AgentAlertLog
        {
            ManualMessageId = 999, JobId = JobId, AgentId = AgentId, AlertType = (byte)AgentAlertType.Delivery,
            ToEmail = "me@tenant.example", IsTest = true, Source = "Settings", CreatedUtc = TestDates.Now
        });
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var result = await Repository().AddAgentToJobAsync(AgentId, JobId);

        Assert.Equal(AgentInboundEmailStatus.Queued, result.Status);
    }

    [Fact]
    public async Task AlertsSwitchedOff_AssignsTheAgentButSendsNothing()
    {
        await SeedAsync();
        _context.AgentAlertSettings.Add(new AgentAlertSetting { Enabled = false, ModifiedUtc = TestDates.Now });
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var result = await Repository().AddAgentToJobAsync(AgentId, JobId);

        Assert.Equal(AgentInboundEmailStatus.AlertsOff, result.Status);
        Assert.Equal(0, await MessageCountAsync());
        var job = await _context.TucJobs.AsNoTracking().SingleAsync(TestContext.Current.CancellationToken);
        Assert.Equal(AgentId, job.AgentId);
    }

    [Fact]
    public async Task NoSettingsRow_SendsAsBefore()
    {
        await SeedAsync();

        var result = await Repository().AddAgentToJobAsync(AgentId, JobId);

        Assert.Equal(AgentInboundEmailStatus.Queued, result.Status);
    }

    [Fact]
    public async Task AlertsSwitchedOn_Sends()
    {
        await SeedAsync();
        _context.AgentAlertSettings.Add(new AgentAlertSetting { Enabled = true, ModifiedUtc = TestDates.Now });
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var result = await Repository().AddAgentToJobAsync(AgentId, JobId);

        Assert.Equal(AgentInboundEmailStatus.Queued, result.Status);
    }

    [Theory]
    [InlineData("KT2103CRTLHP", AgentAlertType.Pickup)]
    [InlineData("KT2103CRTDEL", AgentAlertType.Delivery)]
    [InlineData("KT193VANS", AgentAlertType.DoorToDoor)]
    public async Task TheLogRecordsTheAlertForTheLeg(string jobNumber, AgentAlertType expected)
    {
        await SeedAsync(jobNumber);

        await Repository().AddAgentToJobAsync(AgentId, JobId);

        var log = await _context.AgentAlertLogs.SingleAsync(TestContext.Current.CancellationToken);
        Assert.Equal((byte)expected, log.AlertType);
    }

    [Fact]
    public async Task SendAgentQuote_IsAnExplicitSend_SoItAlwaysGoes()
    {
        await SeedAsync();
        var repository = Repository();
        await repository.SendAgentRequestMessageAsync(AgentId, JobId);

        var status = await repository.SendAgentRequestMessageAsync(AgentId, JobId, resend: true);

        Assert.Equal(AgentInboundEmailStatus.Queued, status);
        Assert.Equal(2, await MessageCountAsync());
    }

    [Fact]
    public async Task Send_UsesTheTenantsTemplateForTheLegsAlertType()
    {
        await SeedAsync("KT2103CRTDEL");
        _context.AgentAlertSettings.Add(new AgentAlertSetting
        {
            Enabled = true, DeliverySubject = "Recover [JobNumber]", DeliveryBody = "<p>Hello [AgentName]</p>",
            PickupSubject = "Wrong one", ReplyToEmail = "dispatch@otgcargo.example"
        });
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        await Repository().AddAgentToJobAsync(AgentId, JobId);

        var message = await _context.TucManualMessages.SingleAsync(TestContext.Current.CancellationToken);
        Assert.Equal("Recover KT2103CRTDEL", message.Subject);
        Assert.Contains("Hello Metro Air", message.UcmmMessage);
        Assert.Equal("dispatch@otgcargo.example", message.ReplyToEmailAddress);
    }

    [Fact]
    public async Task Send_WithNoSavedTemplate_UsesTheBuiltInDefaultForTheAlertType()
    {
        await SeedAsync("KT2103CRTLHP");

        await Repository().AddAgentToJobAsync(AgentId, JobId);

        var message = await _context.TucManualMessages.SingleAsync(TestContext.Current.CancellationToken);
        Assert.StartsWith("Pickup alert KT2103CRTLHP", message.Subject);
        Assert.Contains("Please collect job KT2103CRTLHP", message.UcmmMessage);
        Assert.Contains(Link, message.UcmmMessage);
    }

    [Fact]
    public async Task Send_DispatcherSubjectAndNote_AreUsed()
    {
        await SeedAsync();

        await Repository().AddAgentToJobAsync(AgentId, JobId, emailSubject: "Urgent [JobNumber]",
            emailNote: "Gate code 4411");

        var message = await _context.TucManualMessages.SingleAsync(TestContext.Current.CancellationToken);
        Assert.Equal("Urgent KT2103CRTDEL", message.Subject);
        Assert.Contains("Gate code 4411", message.UcmmMessage);
    }

    [Fact]
    public async Task Compose_MatchesWhatIsSent()
    {
        await SeedAsync();
        var repository = Repository();

        var preview = await repository.ComposeAgentAlertAsync(AgentId, JobId, emailNote: "Call first");
        await repository.AddAgentToJobAsync(AgentId, JobId, emailNote: "Call first");

        var message = await _context.TucManualMessages.SingleAsync(TestContext.Current.CancellationToken);
        Assert.Equal(AgentAlertType.Delivery, preview.AlertType);
        Assert.Equal(preview.Subject, message.Subject);
        Assert.Equal(preview.HtmlBody, message.UcmmMessage);
    }
}
