using DespatchWeb.EntityClasses;
using DespatchWeb.Services;

namespace DespatchWeb.Tests.Services;

/// <summary>
/// Tests for TenantSettingsService — read-only access to tenant-wide JSON
/// settings on tblSetting (one row per tenant database).
/// </summary>
public class TenantSettingsServiceTests : IAsyncDisposable
{
    private readonly SqliteTestDatabase _db = new();

    public async ValueTask DisposeAsync()
    {
        GC.SuppressFinalize(this);
        await _db.DisposeAsync();
    }

    private TenantSettingsService CreateService() => new(_db.CreateFactoryMock());

    [Fact]
    public async Task GetDispatchAddressFormatDefaultAsync_WhenNotConfigured_ReturnsNull()
    {
        await using (var context = _db.CreateContext())
        {
            context.TblSettings.Add(CreateMinimalSetting());
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }
        var service = CreateService();

        var result = await service.GetDispatchAddressFormatDefaultAsync();

        Assert.Null(result);
    }

    [Fact]
    public async Task GetDispatchAddressFormatDefaultAsync_ReturnsTheStoredJson()
    {
        await using (var context = _db.CreateContext())
        {
            var setting = CreateMinimalSetting();
            setting.DispatchAddressFormatJson = "{\"fields\":[\"streetNumber\",\"streetName\"]}";
            context.TblSettings.Add(setting);
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }
        var service = CreateService();

        var result = await service.GetDispatchAddressFormatDefaultAsync();

        Assert.Equal("{\"fields\":[\"streetNumber\",\"streetName\"]}", result);
    }

    private static TblSetting CreateMinimalSetting() => new()
    {
        SettingId = 1,
        // All IsRequired() string properties must be set for SQLite NOT NULL constraints
        SystemName = "Test",
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
        // IsRequired() byte[] properties
        FaxHeadLogo = [],
        FaxHeadLogoSmall = [],
        LetterHeadLogo = [],
        // Audit fields
        Created = TestDates.Now,
        CreatedBy = "Test",
        LastModified = TestDates.Now,
        LastModifiedBy = "Test",
    };
}
