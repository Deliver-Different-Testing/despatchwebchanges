using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Repositories;
using DespatchWeb.Services;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace DespatchWeb.Tests.Services;

public class InboundAgentLinkServiceTests : IAsyncDisposable
{
    private const int JobId = 100;
    private const int AgentId = 1;
    private const string BaseUrl = "https://in.x.deliverdifferent.com/Job/Details";

    private static readonly DateTime LocalJobDate = new(2024, 6, 20);
    private static readonly DateTime UtcNow = new(2024, 6, 15, 2, 30, 0, DateTimeKind.Utc);

    private readonly DespatchContext _context;
    private readonly SqliteTestDatabase _db = new();
    private readonly ITenantInfoService _tenantInfo = Substitute.For<ITenantInfoService>();
    private readonly FakeTenantClock _clock = new(TestDates.Now);

    public InboundAgentLinkServiceTests()
    {
        _context = _db.CreateContext();
        _tenantInfo.GetTenantTimeZone().Returns("New Zealand Standard Time");
        _tenantInfo.GetStaffId().Returns(7);
        _tenantInfo.GetStaffIdOrNull().Returns(7);
    }

    public async ValueTask DisposeAsync()
    {
        GC.SuppressFinalize(this);
        await _context.DisposeAsync();
        await _db.DisposeAsync();
    }

    private InboundAgentLinkService Service() =>
        new(_db.CreateFactoryMock(), _tenantInfo, _clock);

    private NationwideJobRepository Repository() => new(SqliteTestDatabase.CreateFactoryMock(_context), _tenantInfo,
        _clock, Substitute.For<IClearListEnvelopeService>(), Service());

    private static TblSetting Settings(string? inboundUrl)
    {
        return new TblSetting
        {
            InternetJobChargeType = 3,
            InternetJobStaffId = 42,
            SystemName = "OTG Cargo",
            Version = "1.0",
            ApplicationName = "Test",
            AdminEmail = "test@test.com",
            ReportUserName = "test",
            ReportPassword = "test",
            ReportDomain = "test",
            DefaultDateRange = "30",
            EnquiryEmail = "test@test.com",
            Smtpserver = "localhost",
            ContactUsEmailSubject = "Test",
            NewsImageDirectory = "/img",
            StaffImageDirectory = "/img",
            CommunicationFileDirectory = "/files",
            JoinOurTeamEmail = "test@test.com",
            JoinOurTeamSubject = "Test",
            JobFeedbackSubject = "Test",
            InternetJobEmailSubject = "Test",
            InternetJobPoaemail = "test@test.com",
            InternetJobPoaemailSubject = "Test",
            ToolTipImageDirectory = "/img",
            InternetRoot = "http://test",
            InternetClientDetailsEmail = "test@test.com",
            InternetClientDetailsSubject = "Test",
            JoinOurTeamReplyFromEmail = "test@test.com",
            JoinOurTeamReplySubject = "Test",
            JoinOurTeamReplyMessage = "Test",
            JobDetailsReplyFromEmail = "test@test.com",
            TrackAndTrackReplyFromEmail = "test@test.com",
            PpdDescription = "Test",
            PpdAppliedDescription = "Test",
            UncheckDirectEmailMessage = "Test",
            UncheckDirectEmailSubject = "Test",
            UncheckDirectEmailReply = "test@test.com",
            FaxHeadLogo = [],
            FaxHeadLogoSmall = [],
            LetterHeadLogo = [],
            Created = TestDates.Now,
            CreatedBy = "Test",
            LastModified = TestDates.Now,
            LastModifiedBy = "Test",
            InboundUrl = inboundUrl
        };
    }

    private async Task SeedAsync(DateTime? jobDate = null, string? inboundUrl = BaseUrl)
    {
        _context.TblSettings.Add(Settings(inboundUrl));
        _context.TucJobs.Add(new TucJob
        {
            UcjbId = JobId, UcjbNumber = "KT2103CRTDEL", UcjbDate = jobDate ?? LocalJobDate
        });
        _context.TucAgents.Add(new TucAgent
        {
            UcagId = AgentId, UcagName = "Metro Air", UcagFax = "ops@metro.example", CreatedBy = "Test", LastModifiedBy = "Test"
        });
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    private async Task<string> MintAsync(int agentId = AgentId)
    {
        var link = await Service().MintJobLinkAsync(_context, JobId, agentId, TestContext.Current.CancellationToken);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);
        return link!;
    }

    private static string TokenOf(string link) => link[(link.LastIndexOf('/') + 1)..];

    private Task<List<AgentAssignmentToken>> TokensAsync() => _context.AgentAssignmentTokens.AsNoTracking()
        .OrderBy(t => t.AgentAssignmentTokenId).ToListAsync(TestContext.Current.CancellationToken);

    [Fact]
    public async Task Link_IsTheBaseUrlWithA_t_PrefixedFortyThreeCharBase64UrlToken()
    {
        await SeedAsync();

        var link = await MintAsync();

        Assert.StartsWith(BaseUrl + "/t_", link);
        Assert.Matches(new Regex("^t_[A-Za-z0-9_-]{43}$"), TokenOf(link));
    }

    [Fact]
    public async Task BaseUrlWithATrailingSlash_IsTrimmed()
    {
        await SeedAsync(inboundUrl: BaseUrl + "/");

        var link = await MintAsync();

        Assert.StartsWith(BaseUrl + "/t_", link);
    }

    [Fact]
    public async Task StoredHash_IsSha256OfTheTokenString_AndTheRawTokenIsNeverStored()
    {
        await SeedAsync();

        var token = TokenOf(await MintAsync())[2..];

        var row = Assert.Single(await TokensAsync());
        Assert.Equal(SHA256.HashData(Encoding.UTF8.GetBytes(token)), row.TokenHash);
        Assert.Equal(32, row.TokenHash.Length);
        Assert.Equal(JobId, row.JobId);
        Assert.Equal(AgentId, row.AgentId);
        Assert.Null(row.RevokedUtc);
    }

    [Fact]
    public async Task EachMint_IsADifferentToken()
    {
        await SeedAsync();

        var first = await MintAsync();
        var second = await MintAsync();

        Assert.NotEqual(TokenOf(first), TokenOf(second));
    }

    [Fact]
    public async Task Expiry_IsTheJobDateInUtcPlusFourteenDays()
    {
        await SeedAsync();
        var tenantZone = TimeZoneInfo.FindSystemTimeZoneById("New Zealand Standard Time");
        var expected = TimeZoneInfo.ConvertTimeToUtc(LocalJobDate, tenantZone).AddDays(14);

        await MintAsync();

        var row = Assert.Single(await TokensAsync());
        Assert.Equal(expected, row.ExpiresUtc);
    }

    [Fact]
    public async Task Expiry_FallsBackToCreatedPlusFourteenDays_WhenThereIsNoJobDate()
    {
        await SeedAsync(jobDate: default(DateTime));

        await MintAsync();

        var row = Assert.Single(await TokensAsync());
        Assert.Equal(_clock.UtcNow.AddDays(14), row.ExpiresUtc);
        Assert.Equal(_clock.UtcNow, row.CreatedUtc);
    }

    [Fact]
    public async Task NoInboundUrl_MintsNothing()
    {
        await SeedAsync(inboundUrl: null);

        var link = await Service().MintJobLinkAsync(_context, JobId, AgentId, TestContext.Current.CancellationToken);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        Assert.Null(link);
        Assert.Empty(await TokensAsync());
    }

    [Fact]
    public async Task MintingForANewAssignment_RevokesEveryEarlierTokenForTheJob()
    {
        await SeedAsync();
        await MintAsync();
        await MintAsync(agentId: 2);

        var rows = await TokensAsync();

        Assert.Equal(2, rows.Count);
        Assert.Equal(_clock.UtcNow, rows[0].RevokedUtc);
        Assert.Null(rows[1].RevokedUtc);
    }

    [Fact]
    public async Task MintingForOneJob_LeavesAnotherJobsTokensAlone()
    {
        await SeedAsync();
        _context.AgentAssignmentTokens.Add(new AgentAssignmentToken
        {
            TokenHash = new byte[32], JobId = 999, AgentId = AgentId, CreatedUtc = UtcNow, ExpiresUtc = UtcNow.AddDays(1)
        });
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        await MintAsync();

        Assert.Null((await TokensAsync()).Single(t => t.JobId == 999).RevokedUtc);
    }

    [Fact]
    public async Task Revoke_StampsEveryLiveTokenOfTheJob_AndKeepsTheEarlierRevocationTime()
    {
        await SeedAsync();
        var earlier = new DateTime(2024, 6, 1, 0, 0, 0, DateTimeKind.Utc);
        _context.AgentAssignmentTokens.AddRange(
            new AgentAssignmentToken
            {
                TokenHash = new byte[32], JobId = JobId, AgentId = AgentId, CreatedUtc = UtcNow, ExpiresUtc = UtcNow,
                RevokedUtc = earlier
            },
            new AgentAssignmentToken
            {
                TokenHash = new byte[32], JobId = JobId, AgentId = AgentId, CreatedUtc = UtcNow, ExpiresUtc = UtcNow
            });
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        await Service().RevokeJobTokensAsync(_context, JobId, TestContext.Current.CancellationToken);

        var rows = await TokensAsync();
        Assert.Equal(earlier, rows[0].RevokedUtc);
        Assert.Equal(_clock.UtcNow, rows[1].RevokedUtc);
    }

    [Fact]
    public async Task PreviewLink_MintsNothing_AndUsesAPlaceholderToken()
    {
        await SeedAsync();

        var link = await Service().BuildPreviewLinkAsync(JobId, TestContext.Current.CancellationToken);

        Assert.StartsWith(BaseUrl + "/t_", link);
        Assert.Empty(await TokensAsync());
    }

    [Fact]
    public async Task Assigning_MintsAToken_AndTheEmailCarriesItsLink()
    {
        await SeedAsync();

        await Repository().AddAgentToJobAsync(AgentId, JobId);

        var row = Assert.Single(await TokensAsync());
        var body = (await _context.TucManualMessages.SingleAsync(TestContext.Current.CancellationToken)).UcmmMessage;
        var token = Regex.Match(body, "t_[A-Za-z0-9_-]{43}").Value;
        Assert.NotEmpty(token);
        Assert.Equal(SHA256.HashData(Encoding.UTF8.GetBytes(token[2..])), row.TokenHash);
        Assert.Equal(AgentId, row.AgentId);
    }

    [Fact]
    public async Task ReassigningToAnotherAgent_RevokesTheFirstAgentsLink()
    {
        await SeedAsync();
        _context.TucAgents.Add(new TucAgent
        {
            UcagId = 2, UcagName = "Swift", UcagFax = "desk@swift.example", CreatedBy = "Test", LastModifiedBy = "Test"
        });
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);
        var repository = Repository();

        await repository.AddAgentToJobAsync(AgentId, JobId);
        await repository.AddAgentToJobAsync(2, JobId);

        var rows = await TokensAsync();
        Assert.Equal(2, rows.Count);
        Assert.NotNull(rows[0].RevokedUtc);
        Assert.Null(rows[1].RevokedUtc);
        Assert.Equal(2, rows[1].AgentId);
    }

    [Fact]
    public async Task SendItAgain_MintsAFreshToken_AndRevokesThePriorOne()
    {
        await SeedAsync();
        var repository = Repository();
        await repository.AddAgentToJobAsync(AgentId, JobId);

        await repository.AddAgentToJobAsync(AgentId, JobId, resend: true);

        var rows = await TokensAsync();
        Assert.Equal(2, rows.Count);
        Assert.NotNull(rows[0].RevokedUtc);
        Assert.Null(rows[1].RevokedUtc);
        Assert.NotEqual(rows[0].TokenHash, rows[1].TokenHash);
    }

    [Fact]
    public async Task AReAssignThatSendsNothing_DoesNotRevokeTheLiveLink()
    {
        await SeedAsync();
        var repository = Repository();
        await repository.AddAgentToJobAsync(AgentId, JobId);

        var again = await repository.AddAgentToJobAsync(AgentId, JobId);

        Assert.Equal(AgentInboundEmailStatus.AlreadySent, again.Status);
        var row = Assert.Single(await TokensAsync());
        Assert.Null(row.RevokedUtc);
    }
}
