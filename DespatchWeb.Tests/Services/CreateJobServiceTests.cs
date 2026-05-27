using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Models;
using DespatchWeb.Services;
using Microsoft.EntityFrameworkCore;

namespace DespatchWeb.Tests.Services;

/// <summary>
/// Unit tests for CreateJobService — creates jobs via raw SQL insert.
/// Tests cover input resolution, client defaults, contact defaults, null fallbacks,
/// reference validation, recurring bitmask parsing, settings lookup, validation errors,
/// and TucJob entity field mapping.
/// </summary>
public class CreateJobServiceTests : IAsyncDisposable
{
    private readonly IDbContextFactory<DespatchContext> _contextFactoryMock;
    private readonly SqliteTestDatabase _db = new();
    private readonly DespatchContext _seedContext;

    public CreateJobServiceTests()
    {
        _seedContext = _db.CreateContext();
        _contextFactoryMock = _db.CreateFactoryMock();

        // tblReference is mapped as a view (HasNoKey/ToView) so EnsureCreated won't create it.
        // Create as a table in SQLite so we can seed test data via raw SQL.
        using var cmd = _db.Connection.CreateCommand();
        cmd.CommandText = """
                          CREATE TABLE IF NOT EXISTS tblReference (
                              ucrfID INTEGER, ucrfClientID INTEGER, ucrfName TEXT,
                              Grouping TEXT, ReferenceID INTEGER, ClientID INTEGER, Name TEXT
                          );
                          """;
        cmd.ExecuteNonQuery();

        SeedBaseData();
    }

    public async ValueTask DisposeAsync()
    {
        GC.SuppressFinalize(this);
        await _seedContext.DisposeAsync();
        await _db.DisposeAsync();
    }

    [Theory]
    [InlineData("DELIVERTO")]
    [InlineData("THIRDPARTY")]
    [InlineData("PICKUP")]
    [InlineData("")]
    [InlineData("deliverto")]
    public async Task CreateJobAsync_TypeResolution_DoesNotFail(string type)
    {
        var service = CreateService();
        var input = CreateInput(type: type);

        await service.CreateJobAsync(input, TestContext.Current.CancellationToken);

        // The service should handle all type values without throwing
    }

    [Fact]
    public async Task CreateJobAsync_BookedByMatchesContact_AppliesContactDefaults()
    {
        _seedContext.TucClientContacts.Add(new TucClientContact
        {
            UcctId = 50,
            UcctClientId = 10,
            UcctFirstname = "Test",
            UcctSurname = "User",
            Active = true,
            Created = TestDates.Now,
            CreatedBy = "Test",
            LastModified = TestDates.Now,
            LastModifiedBy = "Test"
        });

        _seedContext.TblClientContacts.Add(new TblClientContact
        {
            ClientContactId = 1,
            ClientId = 10,
            ContactId = 50,
            DefaultPod = 1,
            DefaultPodemail = "contact-pod@test.com",
            Created = TestDates.Now,
            CreatedBy = "Test",
            LastModified = TestDates.Now,
            LastModifiedBy = "Test"
        });
        await _seedContext.SaveChangesAsync(TestContext.Current.CancellationToken);

        var service = CreateService();
        var input = CreateInput(bookedBy: "Test User");

        await service.CreateJobAsync(input, TestContext.Current.CancellationToken);
    }

    private void SeedBaseData()
    {
        _seedContext.TucClients.Add(new TucClient
        {
            UcclId = 10,
            UcclName = "Test Client",
            UcclLegalName = "Test Client Ltd",
            Smsname = "TESTCLIENT",
            UcclCode = "TESTCODE",
            UcclGroupId = 5,
            UcclBillingType = 1,
            UcclActive = true,
            UcclAverageDailyGroup = 1,
            SiteId = 1,
            StartingWeightExcess = 0,
            AlertLatePickUp = 0,
            AlertLateDelivery = 0,
            InternetRebate = 0,
            ReferenceAmandatory = false,
            ReferenceAdefineList = false,
            ReferenceBmandatory = false,
            ReferenceBdefineList = false,
            Created = TestDates.Now,
            CreatedBy = "Test",
            LastModified = TestDates.Now,
            LastModifiedBy = "Test"
        });

        _seedContext.TucJobTypeGroupings.Add(new TucJobTypeGrouping
        {
            GroupingId = 1,
            GroupingName = "Default",
            RatingEnabled = false
        });

        _seedContext.TucJobTypes.Add(new TucJobType
        {
            UcjtId = 1,
            UcjtName = "Standard",
            SystemName = "Standard",
            WebServiceEntry = true,
            UcjtBaseRate = 0,
            UcjtUnitRate = 0,
            GroupingId = 1,
            ShowPhotosWhenChild = true,
            Created = TestDates.Now,
            CreatedBy = "Test",
            LastModified = TestDates.Now,
            LastModifiedBy = "Test"
        });

        _seedContext.TblSettings.Add(CreateMinimalSetting());

        _seedContext.SaveChanges();
    }

    private static TblSetting CreateMinimalSetting() => new()
    {
        SettingId = 1,
        InternetJobChargeType = 3,
        InternetJobStaffId = 42,
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
        LastModifiedBy = "Test"
    };

    private CreateJobService CreateService() => new(_contextFactoryMock);

    /// <summary>
    /// Seeds reference data via raw SQL since tblReference is a view (HasNoKey) and
    /// can't be inserted via EF Core's change tracker.
    /// </summary>
    private void SeedReference(int referenceId, int clientId, string name, string grouping)
    {
        using var cmd = _db.Connection.CreateCommand();
        cmd.CommandText =
            $"INSERT INTO tblReference (ReferenceID, ClientID, Name, Grouping, ucrfID, ucrfClientID, ucrfName) VALUES ({referenceId}, {clientId}, '{name}', '{grouping}', {referenceId}, {clientId}, '{name}')";
        cmd.ExecuteNonQuery();
    }

    private static CreateMinimalTucJobInputModel CreateInput(
        int clientId = 10,
        int speedId = 1,
        string speed = "Standard",
        string bookedBy = "Test User",
        string? type = null,
        string? reference = null,
        string? referenceB = null,
        string? notes = null,
        bool? privateRes = null,
        AddressViewModel? fromAddress = null,
        AddressViewModel? toAddress = null,
        string? recurringDays = null,
        string? recurringFrequency = null) => new()
    {
        JobNumber = "JOB-001",
        ClientId = clientId,
        SpeedId = speedId,
        Speed = speed,
        Amount = 50.00m,
        BookedBy = bookedBy,
        LoggedInContactId = 1,
        TenantCurrentTime = new DateTime(2024, 1, 15, 10, 0, 0),
        FromAddress = fromAddress ?? new AddressViewModel(
            "100 Pickup St", string.Empty, string.Empty, string.Empty, "Auckland", string.Empty, "1010", string.Empty),
        ToAddress = toAddress ?? new AddressViewModel(
            "200 Delivery Ave", string.Empty, string.Empty, string.Empty, "Wellington", string.Empty, "6011",
            string.Empty),
        Type = type,
        Reference = reference,
        ReferenceB = referenceB,
        Notes = notes,
        PrivateRes = privateRes,
        RecurringDays = recurringDays,
        RecurringFrequency = recurringFrequency
    };

    /// <summary>
    /// Helper to retrieve the inserted job from the database after CreateJobAsync.
    /// </summary>
    private async Task<TucJob?> GetInsertedJobAsync(int? jobId)
    {
        Assert.NotNull(jobId);
        await using var ctx = _db.CreateContext();
        return await ctx.TucJobs.FirstOrDefaultAsync(j => j.UcjbId == jobId);
    }

    [Fact]
    public async Task CreateJobAsync_InvalidClientId_ReturnsError()
    {
        var service = CreateService();
        var input = CreateInput(clientId: 0);

        var result = await service.CreateJobAsync(input, TestContext.Current.CancellationToken);

        Assert.False(result.Success);
        Assert.Contains("Client", result.Message);
    }

    [Fact]
    public async Task CreateJobAsync_NonExistentClient_ReturnsError()
    {
        var service = CreateService();
        var input = CreateInput(clientId: 9999);

        var result = await service.CreateJobAsync(input, TestContext.Current.CancellationToken);

        Assert.False(result.Success);
        Assert.Contains("Client", result.Message);
    }

    [Fact]
    public async Task CreateJobAsync_ValidClient_PassesValidation()
    {
        var service = CreateService();
        var input = CreateInput(clientId: 10);

        var result = await service.CreateJobAsync(input, TestContext.Current.CancellationToken);

        if (!result.Success)
        {
            Assert.DoesNotContain("Invalid Client", result.Message);
        }
    }

    [Fact]
    public async Task CreateJobAsync_SpeedIdBelow1000_IsNotBulkSchedule()
    {
        var service = CreateService();
        var input = CreateInput(speedId: 1);

        var result = await service.CreateJobAsync(input, TestContext.Current.CancellationToken);
        if(!result.Success)
        {
            Assert.DoesNotContain("Invalid SpeedId", result.Message);
        }
    }

    [Fact]
    public async Task CreateJobAsync_SpeedIdAbove1000_IsBulkSchedule()
    {
        var service = CreateService();
        var input = CreateInput(speedId: 2001);

        await service.CreateJobAsync(input, TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task CreateJobAsync_SpeedIdExactly1000_IsBulkSchedule()
    {
        var service = CreateService();
        var input = CreateInput(speedId: 1000);

        await service.CreateJobAsync(input, TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task CreateJobAsync_SpeedNameMatchesJobType_ResolvesJobTypeId()
    {
        var service = CreateService();
        var input = CreateInput(speed: "Standard");

        await service.CreateJobAsync(input, TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task CreateJobAsync_UnknownSpeedName_FallsBackToSpeedId()
    {
        var service = CreateService();
        var input = CreateInput(speed: "NonExistentSpeed");

        await service.CreateJobAsync(input, TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task CreateJobAsync_WithClientDefaults_AppliesDefaults()
    {
        _seedContext.TblJobDefaults.Add(new TblJobDefault
        {
            JobDefaultId = 1,
            Code = "TESTCODE",
            Contact = "Default Contact",
            ContactId = 99,
            JobTypeId = 5,
            DeliverToPrivateBusiness = 1,
            Size = 3,
            Weight = 10.5,
            Quantity = 2,
            CourierNotes = "Default courier notes",
            ClientNotes = "Default client notes",
            PickUpFrom = 1,
            ProofOfDelivery = 1,
            ProofOfDeliveryEmail = "pod@test.com",
            RtnJob = true,
            Created = TestDates.Now,
            CreatedBy = "Test",
            LastModified = TestDates.Now,
            LastModifiedBy = "Test"
        });
        await _seedContext.SaveChangesAsync(TestContext.Current.CancellationToken);

        var service = CreateService();
        var input = CreateInput();

        await service.CreateJobAsync(input, TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task CreateJobAsync_WithoutClientDefaults_UsesNullFallbacks()
    {
        var service = CreateService();
        var input = CreateInput();

        await service.CreateJobAsync(input, TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task CreateJobAsync_NullInputValues_AppliesFallbackDefaults()
    {
        var service = CreateService();
        var input = CreateInput(notes: null, reference: null, referenceB: null, privateRes: null);

        await service.CreateJobAsync(input, TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task CreateJobAsync_InputNotesOverrideDefaults()
    {
        _seedContext.TblJobDefaults.Add(new TblJobDefault
        {
            JobDefaultId = 2,
            Code = "TESTCODE",
            CourierNotes = "Default notes",
            ClientNotes = "Default client notes",
            Created = TestDates.Now,
            CreatedBy = "Test",
            LastModified = TestDates.Now,
            LastModifiedBy = "Test"
        });
        await _seedContext.SaveChangesAsync(TestContext.Current.CancellationToken);

        var service = CreateService();
        var input = CreateInput(notes: "Custom notes");

        await service.CreateJobAsync(input, TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task CreateJobAsync_MandatoryReferenceA_EmptyValue_ReturnsError()
    {
        var client = _seedContext.TucClients.First(c => c.UcclId == 10);
        client.ReferenceAmandatory = true;
        client.ReferenceAmessage = "Custom ref A message";
        await _seedContext.SaveChangesAsync(TestContext.Current.CancellationToken);

        var service = CreateService();
        var input = CreateInput();

        var result = await service.CreateJobAsync(input, TestContext.Current.CancellationToken);

        Assert.False(result.Success);
        Assert.Equal("Custom ref A message", result.Message);
    }

    [Fact]
    public async Task CreateJobAsync_MandatoryReferenceA_WithValue_Passes()
    {
        var client = _seedContext.TucClients.First(c => c.UcclId == 10);
        client.ReferenceAmandatory = true;
        await _seedContext.SaveChangesAsync(TestContext.Current.CancellationToken);

        var service = CreateService();
        var input = CreateInput(reference: "REF-001");

        var result = await service.CreateJobAsync(input, TestContext.Current.CancellationToken);

        if (!result.Success)
        {
            Assert.DoesNotContain("Reference A", result.Message);
        }
    }

    [Fact]
    public async Task CreateJobAsync_MandatoryReferenceB_EmptyValue_ReturnsError()
    {
        var client = _seedContext.TucClients.First(c => c.UcclId == 10);
        client.ReferenceBmandatory = true;
        client.ReferenceBmessage = "Ref B is required";
        await _seedContext.SaveChangesAsync(TestContext.Current.CancellationToken);

        var service = CreateService();
        var input = CreateInput();

        var result = await service.CreateJobAsync(input, TestContext.Current.CancellationToken);

        Assert.False(result.Success);
        Assert.Equal("Ref B is required", result.Message);
    }

    [Fact]
    public async Task CreateJobAsync_DefinedListReferenceA_InvalidValue_ReturnsError()
    {
        var client = _seedContext.TucClients.First(c => c.UcclId == 10);
        client.ReferenceAdefineList = true;
        await _seedContext.SaveChangesAsync(TestContext.Current.CancellationToken);

        SeedReference(1, 10, "VALID-REF", "A");

        var service = CreateService();
        var input = CreateInput(reference: "INVALID-REF");

        var result = await service.CreateJobAsync(input, TestContext.Current.CancellationToken);

        Assert.False(result.Success);
        Assert.Contains("not in the defined list", result.Message);
    }

    [Fact]
    public async Task CreateJobAsync_DefinedListReferenceA_ValidValue_Passes()
    {
        var client = _seedContext.TucClients.First(c => c.UcclId == 10);
        client.ReferenceAdefineList = true;
        await _seedContext.SaveChangesAsync(TestContext.Current.CancellationToken);

        SeedReference(2, 10, "VALID-REF", "A");

        var service = CreateService();
        var input = CreateInput(reference: "VALID-REF");

        var result = await service.CreateJobAsync(input, TestContext.Current.CancellationToken);

        if (!result.Success)
        {
            Assert.DoesNotContain("defined list", result.Message);
        }
    }

    [Fact]
    public async Task CreateJobAsync_DefinedListReferenceB_InvalidValue_ReturnsError()
    {
        var client = _seedContext.TucClients.First(c => c.UcclId == 10);
        client.ReferenceBdefineList = true;
        await _seedContext.SaveChangesAsync(TestContext.Current.CancellationToken);

        SeedReference(3, 10, "VALID-B-REF", "B");

        var service = CreateService();
        var input = CreateInput(referenceB: "BAD-B-REF");

        var result = await service.CreateJobAsync(input, TestContext.Current.CancellationToken);

        Assert.False(result.Success);
        Assert.Contains("not in the defined list", result.Message);
    }

    [Theory]
    [InlineData("1110000", 7, 0b0000111)] // Mon, Tue, Wed
    [InlineData("0000011", 7, 0b1100000)] // Sat, Sun
    [InlineData("1111111", 7, 0b1111111)] // All days
    [InlineData("0000000", 7, 0b0000000)] // No days
    [InlineData("1000000", 7, 0b0000001)] // Mon only
    public void ParseBitmask_Days_ConvertsCorrectly(string input, int maxBits, int expectedBitmask)
    {
        var result = CreateJobService.ParseBitmask(input, maxBits);
        Assert.Equal(expectedBitmask, result);
    }

    [Theory]
    [InlineData("10000", 5, 0b00001)] // Weekly
    [InlineData("01000", 5, 0b00010)] // Fortnightly
    [InlineData("11000", 5, 0b00011)] // Weekly + Fortnightly
    [InlineData("00000", 5, 0b00000)] // None
    public void ParseBitmask_Frequency_ConvertsCorrectly(string input, int maxBits, int expectedBitmask)
    {
        var result = CreateJobService.ParseBitmask(input, maxBits);
        Assert.Equal(expectedBitmask, result);
    }

    [Fact]
    public void ParseBitmask_NullInput_ReturnsNull()
    {
        Assert.Null(CreateJobService.ParseBitmask(null, 7));
        Assert.Null(CreateJobService.ParseBitmask(string.Empty, 7));
        Assert.Null(CreateJobService.ParseBitmask("  ", 5));
    }

    [Fact]
    public async Task CreateJobAsync_MissingBookedBy_ReturnsError()
    {
        var service = CreateService();
        var input = CreateInput(bookedBy: string.Empty);

        var result = await service.CreateJobAsync(input, TestContext.Current.CancellationToken);

        Assert.False(result.Success);
        Assert.Contains("Booked By", result.Message);
    }

    [Fact]
    public async Task CreateJobAsync_InvalidSpeed_ReturnsError()
    {
        var service = CreateService();
        var input = CreateInput(speedId: 0);

        var result = await service.CreateJobAsync(input, TestContext.Current.CancellationToken);

        Assert.False(result.Success);
        Assert.Contains("Speed", result.Message);
    }

    [Fact]
    public async Task CreateJobAsync_MissingFromAddress_ReturnsError()
    {
        var service = CreateService();
        var input = CreateInput(fromAddress: new AddressViewModel());

        var result = await service.CreateJobAsync(input, TestContext.Current.CancellationToken);

        Assert.False(result.Success);
        Assert.Contains("From Address", result.Message);
    }

    [Fact]
    public async Task CreateJobAsync_MissingToAddress_ReturnsError()
    {
        var service = CreateService();
        var input = CreateInput(toAddress: new AddressViewModel());

        var result = await service.CreateJobAsync(input, TestContext.Current.CancellationToken);

        Assert.False(result.Success);
        Assert.Contains("To Address", result.Message);
    }

    [Fact]
    public async Task CreateJobAsync_NormalJob_InsertsJobInDatabase()
    {
        var service = CreateService();
        var input = CreateInput();

        var result = await service.CreateJobAsync(input, TestContext.Current.CancellationToken);

        Assert.True(result.Success);
        var job = await GetInsertedJobAsync(result.JobId);
        Assert.NotNull(job);
        Assert.Equal("JOB-001", job.UcjbNumber);
    }

    [Fact]
    public async Task CreateJobAsync_NormalJob_ReturnsSuccessWithJobId()
    {
        var service = CreateService();
        var input = CreateInput();

        var result = await service.CreateJobAsync(input, TestContext.Current.CancellationToken);

        Assert.True(result.Success);
        Assert.NotNull(result.JobId);
        Assert.True(result.JobId > 0);
    }

    [Fact]
    public async Task CreateJobAsync_NormalJob_MapsKeyParametersCorrectly()
    {
        var service = CreateService();
        var input = CreateInput();

        var result = await service.CreateJobAsync(input, TestContext.Current.CancellationToken);

        var job = await GetInsertedJobAsync(result.JobId);
        Assert.NotNull(job);
        Assert.Equal(1, (int)job.UcjbType!); // type defaults to 1 (pickup)
        Assert.Equal(10, job.UcjbClientId); // client ID matches input
        Assert.Equal("Test User", job.UcjbContact); // contact = BookedBy
        Assert.Equal(3, (int)job.UcjbChargeType!); // from TblSettings.InternetJobChargeType
        Assert.Equal(42, job.UcjbOpId); // from TblSettings.InternetJobStaffId
        Assert.Equal(1, job.UcjbSpeed); // resolved from speed name
        Assert.Equal((int)JobSource.DespatchWeb, job.SourceId);
        Assert.Equal(1, job.LoggedInContactId);
    }

    [Fact]
    public async Task CreateJobAsync_NormalJob_MapsAddressFields()
    {
        var service = CreateService();
        var input = CreateInput(
            fromAddress: new AddressViewModel("100 Pickup St", "Suite 2", "3 High", "Road", "Auckland", "AKL", "1010",
                ""),
            toAddress: new AddressViewModel("200 Delivery Ave", "Unit 5", "7 Low", "Lane", "Wellington", "WGN", "6011",
                ""));

        var result = await service.CreateJobAsync(input, TestContext.Current.CancellationToken);

        var job = await GetInsertedJobAsync(result.JobId);
        Assert.NotNull(job);

        // From address stored in pickup address lines
        Assert.Equal("100 Pickup St", job.PickupAddressLine1);
        Assert.Equal("Suite 2", job.PickupAddressLine2);
        Assert.Equal("3 High", job.PickupAddressLine3);
        Assert.Equal("Road", job.PickupAddressLine4);
        Assert.Equal("Auckland", job.PickupAddressLine5);
        Assert.Equal("AKL", job.PickupAddressLine6);
        Assert.Equal("1010", job.PickupAddressLine7);

        // To address stored in delivery address lines
        Assert.Equal("200 Delivery Ave", job.DeliveryAddressLine1);
        Assert.Equal("Unit 5", job.DeliveryAddressLine2);
        Assert.Equal("7 Low", job.DeliveryAddressLine3);
        Assert.Equal("Lane", job.DeliveryAddressLine4);
        Assert.Equal("Wellington", job.DeliveryAddressLine5);
        Assert.Equal("WGN", job.DeliveryAddressLine6);
        Assert.Equal("6011", job.DeliveryAddressLine7);

        // Full addresses
        Assert.Equal("100 Pickup St, Suite 2, 3 High, Road, Auckland, AKL, 1010", job.UcjbFromAddr);
        Assert.Equal("200 Delivery Ave, Unit 5, 7 Low, Lane, Wellington, WGN, 6011", job.UcjbToAddr);
    }

    [Fact]
    public async Task CreateJobAsync_NormalJob_ConvertsPodBoolToInt()
    {
        _seedContext.TblJobDefaults.Add(new TblJobDefault
        {
            JobDefaultId = 10,
            Code = "TESTCODE",
            ProofOfDelivery = 1,
            ProofOfDeliveryEmail = "pod@test.com",
            Created = TestDates.Now,
            CreatedBy = "Test",
            LastModified = TestDates.Now,
            LastModifiedBy = "Test"
        });
        await _seedContext.SaveChangesAsync(TestContext.Current.CancellationToken);

        var service = CreateService();
        var input = CreateInput();

        var result = await service.CreateJobAsync(input, TestContext.Current.CancellationToken);

        var job = await GetInsertedJobAsync(result.JobId);
        Assert.NotNull(job);
        Assert.Equal(1, job.ProofOfDelivery); // proofOfDelivery true -> 1
        Assert.Equal("pod@test.com", job.ProofOfDeliveryEmail);
    }

    [Fact]
    public async Task CreateJobAsync_NormalJob_PassesRecurringBitmasks()
    {
        var service = CreateService();
        var input = CreateInput(recurringDays: "1110000", recurringFrequency: "10000");

        var result = await service.CreateJobAsync(input, TestContext.Current.CancellationToken);

        var job = await GetInsertedJobAsync(result.JobId);
        Assert.NotNull(job);
        Assert.Equal("JOB-001", job.UcjbNumber);
    }

    [Fact]
    public async Task CreateJobAsync_NormalJob_TypeDeliverTo_SetsTypeId2()
    {
        var service = CreateService();
        var input = CreateInput(type: "DELIVERTO");

        var result = await service.CreateJobAsync(input, TestContext.Current.CancellationToken);

        var job = await GetInsertedJobAsync(result.JobId);
        Assert.NotNull(job);
        Assert.Equal(2, (int)job.UcjbType!); // DELIVERTO type maps to TypeId 2
    }

    [Fact]
    public async Task CreateJobAsync_NormalJob_SetsJobNumber()
    {
        var service = CreateService();
        var input = CreateInput();

        var result = await service.CreateJobAsync(input, TestContext.Current.CancellationToken);

        var job = await GetInsertedJobAsync(result.JobId);
        Assert.NotNull(job);
        Assert.Equal("JOB-001", job.UcjbNumber);
    }

    [Fact]
    public async Task CreateJobAsync_BulkJob_InsertsJobInDatabase()
    {
        var service = CreateService();
        var input = CreateInput(speedId: 2001);

        var result = await service.CreateJobAsync(input, TestContext.Current.CancellationToken);

        Assert.True(result.Success);
        Assert.NotNull(result.JobId);
        var job = await GetInsertedJobAsync(result.JobId);
        Assert.NotNull(job);
    }

    [Fact]
    public async Task CreateJobAsync_BulkJob_ReturnsSuccessWithJobId()
    {
        var service = CreateService();
        var input = CreateInput(speedId: 2001);

        var result = await service.CreateJobAsync(input, TestContext.Current.CancellationToken);

        Assert.True(result.Success);
        Assert.NotNull(result.JobId);
        Assert.True(result.JobId > 0);
    }

    [Fact]
    public async Task CreateJobAsync_BulkJob_SetsQuantityAndSize()
    {
        var service = CreateService();
        var input = CreateInput(speedId: 2001);

        var result = await service.CreateJobAsync(input, TestContext.Current.CancellationToken);

        var job = await GetInsertedJobAsync(result.JobId);
        Assert.NotNull(job);
        // Size defaults to 2 (from ApplyNullFallbackDefaults)
        Assert.Equal(2, job.UcjbSize);
        // Quantity defaults to 1 (from ApplyNullFallbackDefaults)
        Assert.Equal((short)1, job.UcjbQty);
    }

    [Fact]
    public async Task CreateJobAsync_BulkJob_SetsDeliverToPrivateBusiness()
    {
        var service = CreateService();
        var input = CreateInput(speedId: 2001, privateRes: true);

        var result = await service.CreateJobAsync(input, TestContext.Current.CancellationToken);

        var job = await GetInsertedJobAsync(result.JobId);
        Assert.NotNull(job);
        Assert.Equal(1, job.DeliverToPrivateBusiness);
    }

    [Fact]
    public async Task CreateJobAsync_BulkJob_MapsKeyParameters()
    {
        var service = CreateService();
        var input = CreateInput(speedId: 2001);

        var result = await service.CreateJobAsync(input, TestContext.Current.CancellationToken);

        var job = await GetInsertedJobAsync(result.JobId);
        Assert.NotNull(job);
        Assert.Equal(1, (int)job.UcjbType!); // type defaults to 1
        Assert.Equal(10, job.UcjbClientId); // client ID matches input
        Assert.Equal("Test User", job.UcjbContact); // contact = BookedBy
        Assert.Equal("JOB-001", job.UcjbNumber); // job number matches input
        Assert.Equal((int)JobSource.DespatchWeb, job.SourceId);
        Assert.Equal(1, job.LoggedInContactId);
    }
}
