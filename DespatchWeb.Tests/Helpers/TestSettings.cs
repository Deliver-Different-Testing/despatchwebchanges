using DespatchWeb.EntityClasses;

namespace DespatchWeb.Tests.Helpers;

/// <summary>A tblSetting row with every NOT NULL column filled, for tests that need the settings anchor row.</summary>
public static class TestSettings
{
    public static TblSetting Minimal(int? parentJobCourierId = null) => new()
    {
        SettingId = 1,
        InternetJobChargeType = 3,
        InternetJobStaffId = 42,
        ParentJobCourierId = parentJobCourierId,
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
        FaxHeadLogo = [],
        FaxHeadLogoSmall = [],
        LetterHeadLogo = [],
        Created = TestDates.Now,
        CreatedBy = "Test",
        LastModified = TestDates.Now,
        LastModifiedBy = "Test"
    };
}
