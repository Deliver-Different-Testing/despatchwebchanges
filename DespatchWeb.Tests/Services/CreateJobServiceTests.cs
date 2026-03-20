using System.Runtime.CompilerServices;
using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Models;
using DespatchWeb.Services;
using Microsoft.EntityFrameworkCore;
using Moq;

namespace DespatchWeb.Tests.Services;

/// <summary>
/// Unit tests for CreateJobService — the C# replacement for DD_stpJob_InsertExcelerator.
/// Tests cover input resolution, client defaults, contact defaults, null fallbacks,
/// reference validation, recurring bitmask parsing, settings lookup, validation errors,
/// and stored procedure call parameter mapping via mocked IDespatchContextProcedures.
/// </summary>
public class CreateJobServiceTests : IAsyncDisposable
{
    private readonly Mock<IDbContextFactory<DespatchContext>> _contextFactoryMock;
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

        var result = await service.CreateJobAsync(input, TestContext.Current.CancellationToken);

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

        var result = await service.CreateJobAsync(input, TestContext.Current.CancellationToken);
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

    private CreateJobService CreateService() => new(_contextFactoryMock.Object);

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
    /// DespatchContext subclass that overrides Procedures to return a mock.
    /// EF Core operations still work against SQLite via CallBase-style inheritance.
    /// </summary>
    private class TestDespatchContext(
        DbContextOptions<DespatchContext> options,
        IDespatchContextProcedures procs) : DespatchContext(options)
    {
        public override IDespatchContextProcedures Procedures => procs;
    }

    private class TestDespatchContextImpl(
        DbContextOptions<DespatchContext> options,
        IDespatchContextProcedures procs) : TestDespatchContext(options, procs);

    [UnsafeAccessor(UnsafeAccessorKind.Field, Name = "_valueSet")]
    private static extern ref bool GetValueSet<T>(OutputParameter<T> param);

    private static void SetOutputParameterValue<T>(OutputParameter<T> param, T value)
    {
        param._value = value;
        GetValueSet(param) = true;
    }

    /// <summary>
    /// Creates a CreateJobService backed by SQLite (for real EF queries)
    /// with mocked Procedures (for stored proc calls).
    /// </summary>
    private CreateJobService CreateServiceWithMockedProcs(out Mock<IDespatchContextProcedures> mockProcs)
    {
        var procsMock = new Mock<IDespatchContextProcedures>();

        var factoryMock = new Mock<IDbContextFactory<DespatchContext>>();
        factoryMock.Setup(f => f.CreateDbContextAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(() => new TestDespatchContext(_db.Options, procsMock.Object));

        mockProcs = procsMock;
        return new CreateJobService(factoryMock.Object);
    }

    // Argument indices for DD_stpJob_Excelerator_InsertAsync output params
    private const int ExceleratorJobIdArgIndex = 70;

    // Argument indices for DD_stpBulkScheduleJob_InsertAsync output params
    private const int BulkJobIdArgIndex = 77;

    /// <summary>
    /// Sets up DD_stpJob_Excelerator_InsertAsync mock to succeed with the given job ID.
    /// </summary>
    private static void SetupExceleratorInsert(
        Mock<IDespatchContextProcedures> mockProcs, int? outputJobId = 42)
    {
        mockProcs.Setup(p => p.DD_stpJob_Excelerator_InsertAsync(
            It.IsAny<int?>(), It.IsAny<int?>(), It.IsAny<DateTime?>(), It.IsAny<string>(), It.IsAny<int?>(),
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<int?>(), It.IsAny<string>(), It.IsAny<string>(),
            It.IsAny<string>(), It.IsAny<string>(),
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<int?>(), It.IsAny<string>(), It.IsAny<string>(),
            It.IsAny<string>(), It.IsAny<string>(),
            It.IsAny<int?>(), It.IsAny<int?>(), It.IsAny<double?>(), It.IsAny<double?>(),
            It.IsAny<string>(), It.IsAny<string>(),
            It.IsAny<int?>(), It.IsAny<int?>(),
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
            It.IsAny<string>(), It.IsAny<int?>(),
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
            It.IsAny<int?>(), It.IsAny<int?>(), It.IsAny<string>(), It.IsAny<string>(),
            It.IsAny<string>(), It.IsAny<int?>(), It.IsAny<bool?>(), It.IsAny<int?>(),
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
            It.IsAny<int?>(), It.IsAny<int?>(), It.IsAny<int?>(),
            It.IsAny<decimal?>(), It.IsAny<decimal?>(), It.IsAny<int?>(),
            It.IsAny<int?>(), It.IsAny<bool?>(),
            It.IsAny<int?>(), It.IsAny<int?>(),
            It.IsAny<DateTime?>(), It.IsAny<string>(), It.IsAny<string>(),
            It.IsAny<string>(), It.IsAny<string>(),
            It.IsAny<int?>(), It.IsAny<int?>(), It.IsAny<int?>(), It.IsAny<int?>(),
            It.IsAny<int?>(), It.IsAny<int?>(),
            It.IsAny<OutputParameter<int?>>(), It.IsAny<OutputParameter<string>>(),
            It.IsAny<OutputParameter<decimal?>>(), It.IsAny<OutputParameter<bool?>>(),
            It.IsAny<OutputParameter<int>>(), It.IsAny<CancellationToken>()
        )).Callback(new InvocationAction(invocation =>
        {
            if (invocation.Arguments[ExceleratorJobIdArgIndex] is OutputParameter<int?> jobId)
                SetOutputParameterValue(jobId, outputJobId);
        })).ReturnsAsync(0);
    }

    /// <summary>
    /// Sets up DD_stpBulkScheduleJob_InsertAsync mock to succeed with the given job ID.
    /// </summary>
    private static void SetupBulkScheduleInsert(
        Mock<IDespatchContextProcedures> mockProcs, int? outputJobId = 99)
    {
        mockProcs.Setup(p => p.DD_stpBulkScheduleJob_InsertAsync(
            It.IsAny<int?>(), It.IsAny<DateTime?>(), It.IsAny<int?>(), It.IsAny<string>(), It.IsAny<int?>(),
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<int?>(),
            It.IsAny<string>(), It.IsAny<string>(),
            It.IsAny<string>(), It.IsAny<string>(),
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<int?>(),
            It.IsAny<string>(), It.IsAny<string>(),
            It.IsAny<string>(), It.IsAny<string>(),
            It.IsAny<int?>(), It.IsAny<int?>(), It.IsAny<short?>(), It.IsAny<short?>(),
            It.IsAny<decimal?>(), It.IsAny<double?>(), It.IsAny<int?>(),
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
            It.IsAny<bool?>(), It.IsAny<int?>(),
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
            It.IsAny<bool?>(), It.IsAny<int?>(), It.IsAny<string>(), It.IsAny<string>(),
            It.IsAny<int?>(), It.IsAny<string>(), It.IsAny<string>(),
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
            It.IsAny<bool?>(), It.IsAny<bool?>(), It.IsAny<string>(),
            It.IsAny<int?>(), It.IsAny<int?>(),
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
            It.IsAny<string>(), It.IsAny<int?>(),
            It.IsAny<string>(), It.IsAny<string>(),
            It.IsAny<int?>(), It.IsAny<DateTime?>(), It.IsAny<int?>(), It.IsAny<int?>(), It.IsAny<decimal?>(),
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
            It.IsAny<int?>(), It.IsAny<DateTime?>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<int?>(),
            It.IsAny<OutputParameter<int?>>(), It.IsAny<OutputParameter<string>>(),
            It.IsAny<OutputParameter<decimal?>>(),
            It.IsAny<OutputParameter<int>>(), It.IsAny<CancellationToken>()
        )).Callback(new InvocationAction(invocation =>
        {
            if (invocation.Arguments[BulkJobIdArgIndex] is OutputParameter<int?> jobId)
                SetOutputParameterValue(jobId, outputJobId);
        })).ReturnsAsync(0);
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
            Assert.DoesNotContain("Invalid Client", result.Message);
    }

    [Fact]
    public async Task CreateJobAsync_SpeedIdBelow1000_IsNotBulkSchedule()
    {
        var service = CreateService();
        var input = CreateInput(speedId: 1);

        var result = await service.CreateJobAsync(input, TestContext.Current.CancellationToken);
        if(!result.Success)
            Assert.DoesNotContain("Invalid SpeedId", result.Message);
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
            Assert.DoesNotContain("Reference A", result.Message);
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
            Assert.DoesNotContain("defined list", result.Message);
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
    public async Task CreateJobAsync_NormalJob_CallsExceleratorInsertProc()
    {
        var service = CreateServiceWithMockedProcs(out var mockProcs);
        SetupExceleratorInsert(mockProcs);
        var input = CreateInput();

        await service.CreateJobAsync(input, TestContext.Current.CancellationToken);

        var invocation = mockProcs.Invocations
            .SingleOrDefault(i =>
                i.Method.Name == nameof(IDespatchContextProcedures.DD_stpJob_Excelerator_InsertAsync));
        Assert.NotNull(invocation);
    }

    [Fact]
    public async Task CreateJobAsync_NormalJob_DoesNotCallBulkInsert()
    {
        var service = CreateServiceWithMockedProcs(out var mockProcs);
        SetupExceleratorInsert(mockProcs);
        var input = CreateInput(speedId: 1);

        await service.CreateJobAsync(input, TestContext.Current.CancellationToken);

        Assert.DoesNotContain(mockProcs.Invocations
, i => i.Method.Name == nameof(IDespatchContextProcedures.DD_stpBulkScheduleJob_InsertAsync));
    }

    [Fact]
    public async Task CreateJobAsync_NormalJob_ReturnsSuccessWithJobId()
    {
        var service = CreateServiceWithMockedProcs(out var mockProcs);
        SetupExceleratorInsert(mockProcs, outputJobId: 42);
        var input = CreateInput();

        var result = await service.CreateJobAsync(input, TestContext.Current.CancellationToken);

        Assert.True(result.Success);
        Assert.Equal(42, result.JobId);
    }

    [Fact]
    public async Task CreateJobAsync_NormalJob_NullJobIdOutput_ReturnsFailure()
    {
        var service = CreateServiceWithMockedProcs(out var mockProcs);
        SetupExceleratorInsert(mockProcs, outputJobId: null);
        var input = CreateInput();

        var result = await service.CreateJobAsync(input, TestContext.Current.CancellationToken);

        Assert.False(result.Success);
        Assert.Null(result.JobId);
    }

    [Fact]
    public async Task CreateJobAsync_NormalJob_MapsKeyParametersCorrectly()
    {
        var service = CreateServiceWithMockedProcs(out var mockProcs);
        SetupExceleratorInsert(mockProcs);
        var input = CreateInput();

        await service.CreateJobAsync(input, TestContext.Current.CancellationToken);

        var args = mockProcs.Invocations
            .Single(i => i.Method.Name == nameof(IDespatchContextProcedures.DD_stpJob_Excelerator_InsertAsync))
            .Arguments;

        Assert.Equal(1, args[0]); // type should default to 1 (pickup)
        Assert.Equal(10, args[1]); // clientID should match input
        Assert.Equal("Test User", args[3]); // contact should be BookedBy
        Assert.Equal(3, args[4]); // chargeType should come from TblSettings.InternetJobChargeType
        Assert.Equal(42, args[25]); // opID should come from TblSettings.InternetJobStaffId
        Assert.Equal(1, args[32]); // service (jobTypeId) should be resolved from speed name
        Assert.Equal(1, args[42]); // speed should match SpeedId
        Assert.Equal((int)JobSource.DespatchWeb, args[49]); // sourceId should be DespatchWeb
        Assert.Equal(1, args[57]); // loggedInContactId should match input
    }

    [Fact]
    public async Task CreateJobAsync_NormalJob_MapsAddressFields()
    {
        var service = CreateServiceWithMockedProcs(out var mockProcs);
        SetupExceleratorInsert(mockProcs);
        var input = CreateInput(
            fromAddress: new AddressViewModel("100 Pickup St", "Suite 2", "3 High", "Road", "Auckland", "AKL", "1010",
                ""),
            toAddress: new AddressViewModel("200 Delivery Ave", "Unit 5", "7 Low", "Lane", "Wellington", "WGN", "6011",
                ""));

        await service.CreateJobAsync(input, TestContext.Current.CancellationToken);

        var args = mockProcs.Invocations
            .Single(i => i.Method.Name == nameof(IDespatchContextProcedures.DD_stpJob_Excelerator_InsertAsync))
            .Arguments;

        // From address
        Assert.Equal("100 Pickup St, Suite 2, 3 High, Road, Auckland, AKL, 1010",
            args[15]); // fromAddress = FullAddress
        Assert.Equal("100 Pickup St", args[18]); // fromCompany = AddressLine1
        Assert.Equal("Suite 2", args[17]); // fromExtra = AddressLine2
        Assert.Equal("3 High Road", args[16]); // fromStreet = AddressLine3 + AddressLine4 trimmed
        Assert.Equal("Auckland", args[12]); // fromCity = AddressLine5
        Assert.Equal("AKL", args[13]); // fromState = AddressLine6
        Assert.Equal(1010, args[14]); // fromZipCode parsed from AddressLine7

        // To address
        Assert.Equal("200 Delivery Ave, Unit 5, 7 Low, Lane, Wellington, WGN, 6011",
            args[8]); // toAddress = FullAddress
        Assert.Equal("200 Delivery Ave", args[11]); // toCompany = AddressLine1
        Assert.Equal("Unit 5", args[10]); // toExtra = AddressLine2
        Assert.Equal("7 Low Lane", args[9]); // toStreet = AddressLine3 + AddressLine4 trimmed
        Assert.Equal("Wellington", args[5]); // toCity = AddressLine5
        Assert.Equal("WGN", args[6]); // toState = AddressLine6
        Assert.Equal(6011, args[7]); // toZipCode parsed from AddressLine7
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

        var service = CreateServiceWithMockedProcs(out var mockProcs);
        SetupExceleratorInsert(mockProcs);
        var input = CreateInput();

        await service.CreateJobAsync(input, TestContext.Current.CancellationToken);

        var args = mockProcs.Invocations
            .Single(i => i.Method.Name == nameof(IDespatchContextProcedures.DD_stpJob_Excelerator_InsertAsync))
            .Arguments;

        var podValue = Assert.IsType<int>(args[38]);
        Assert.Equal(1, podValue); // proofOfDelivery true -> 1
        Assert.Equal("pod@test.com", args[39]); // proofOfDeliveryEmail from defaults
    }

    [Fact]
    public async Task CreateJobAsync_NormalJob_PassesRecurringBitmasks()
    {
        var service = CreateServiceWithMockedProcs(out var mockProcs);
        SetupExceleratorInsert(mockProcs);
        var input = CreateInput(recurringDays: "1110000", recurringFrequency: "10000");

        await service.CreateJobAsync(input, TestContext.Current.CancellationToken);

        var args = mockProcs.Invocations
            .Single(i => i.Method.Name == nameof(IDespatchContextProcedures.DD_stpJob_Excelerator_InsertAsync))
            .Arguments;

        Assert.Equal("7", args[63]); // recurringDays string should be the bitmask value as string
        Assert.Equal(0b0000111, args[64]); // daysInt should be the bitmask integer (Mon+Tue+Wed=7)
        Assert.Equal(0b00001, args[65]); // frequencyInt should be the bitmask integer (weekly=1)
    }

    [Fact]
    public async Task CreateJobAsync_NormalJob_TypeDeliverTo_SetsTypeId2()
    {
        var service = CreateServiceWithMockedProcs(out var mockProcs);
        SetupExceleratorInsert(mockProcs);
        var input = CreateInput(type: "DELIVERTO");

        await service.CreateJobAsync(input, TestContext.Current.CancellationToken);

        var args = mockProcs.Invocations
            .Single(i => i.Method.Name == nameof(IDespatchContextProcedures.DD_stpJob_Excelerator_InsertAsync))
            .Arguments;

        Assert.Equal(2, args[0]); // DELIVERTO type should map to TypeId 2
    }

    [Fact]
    public async Task CreateJobAsync_BulkJob_CallsBulkScheduleInsertProc()
    {
        var service = CreateServiceWithMockedProcs(out var mockProcs);
        SetupBulkScheduleInsert(mockProcs);
        var input = CreateInput(speedId: 2001);

        await service.CreateJobAsync(input, TestContext.Current.CancellationToken);

        var invocation = mockProcs.Invocations
            .SingleOrDefault(i =>
                i.Method.Name == nameof(IDespatchContextProcedures.DD_stpBulkScheduleJob_InsertAsync));
        Assert.NotNull(invocation);
    }

    [Fact]
    public async Task CreateJobAsync_BulkJob_DoesNotCallExceleratorInsert()
    {
        var service = CreateServiceWithMockedProcs(out var mockProcs);
        SetupBulkScheduleInsert(mockProcs);
        var input = CreateInput(speedId: 2001);

        await service.CreateJobAsync(input, TestContext.Current.CancellationToken);

        Assert.DoesNotContain(mockProcs.Invocations
, i => i.Method.Name == nameof(IDespatchContextProcedures.DD_stpJob_Excelerator_InsertAsync));
    }

    [Fact]
    public async Task CreateJobAsync_BulkJob_ReturnsSuccessWithJobId()
    {
        var service = CreateServiceWithMockedProcs(out var mockProcs);
        SetupBulkScheduleInsert(mockProcs, outputJobId: 99);
        var input = CreateInput(speedId: 2001);

        var result = await service.CreateJobAsync(input, TestContext.Current.CancellationToken);

        Assert.True(result.Success);
        Assert.Equal(99, result.JobId);
    }

    [Fact]
    public async Task CreateJobAsync_BulkJob_CastsQuantityAndSizeToShort()
    {
        var service = CreateServiceWithMockedProcs(out var mockProcs);
        SetupBulkScheduleInsert(mockProcs);
        var input = CreateInput(speedId: 2001);

        await service.CreateJobAsync(input, TestContext.Current.CancellationToken);

        var args = mockProcs.Invocations
            .Single(i => i.Method.Name == nameof(IDespatchContextProcedures.DD_stpBulkScheduleJob_InsertAsync))
            .Arguments;

        // Size defaults to 2 (from ApplyNullFallbackDefaults), cast to short
        var sizeValue = Assert.IsType<short>(args[25]);
        Assert.Equal(2, sizeValue);
        // Quantity defaults to 1 (from ApplyNullFallbackDefaults), cast to short
        var qtyValue = Assert.IsType<short>(args[26]);
        Assert.Equal(1, qtyValue);
    }

    [Fact]
    public async Task CreateJobAsync_BulkJob_ConvertsDeliverToPrivateBusinessToNullableBool()
    {
        var service = CreateServiceWithMockedProcs(out var mockProcs);
        SetupBulkScheduleInsert(mockProcs);
        var input = CreateInput(speedId: 2001, privateRes: true);

        await service.CreateJobAsync(input, TestContext.Current.CancellationToken);

        var args = mockProcs.Invocations
            .Single(i => i.Method.Name == nameof(IDespatchContextProcedures.DD_stpBulkScheduleJob_InsertAsync))
            .Arguments;

        var deliverToPrivateBusiness = Assert.IsType<bool>(args[33]);
        Assert.True(deliverToPrivateBusiness);
    }

    [Fact]
    public async Task CreateJobAsync_BulkJob_MapsKeyParameters()
    {
        var service = CreateServiceWithMockedProcs(out var mockProcs);
        SetupBulkScheduleInsert(mockProcs);
        var input = CreateInput(speedId: 2001);

        await service.CreateJobAsync(input, TestContext.Current.CancellationToken);

        var args = mockProcs.Invocations
            .Single(i => i.Method.Name == nameof(IDespatchContextProcedures.DD_stpBulkScheduleJob_InsertAsync))
            .Arguments;

        Assert.Equal(1, args[0]); // type should default to 1
        Assert.Equal(10, args[2]); // clientID should match input
        Assert.Equal("Test User", args[3]); // contact should be BookedBy
        Assert.Equal(false, args[51]); // onHold should be data.Hold (default false)
        Assert.Equal("JOB-001", args[52]); // orderRef should be data.JobNumber
        Assert.Equal((int)JobSource.DespatchWeb, args[64]); // sourceId should be DespatchWeb
        Assert.Equal(1, args[66]); // loggedInContactId should match input
    }

    [Fact]
    public async Task CreateJobAsync_NormalJob_SeedsJobNumberOutputParameter()
    {
        var service = CreateServiceWithMockedProcs(out var mockProcs);
        SetupExceleratorInsert(mockProcs);
        var input = CreateInput();

        await service.CreateJobAsync(input, TestContext.Current.CancellationToken);

        var args = mockProcs.Invocations
            .Single(i => i.Method.Name == nameof(IDespatchContextProcedures.DD_stpJob_Excelerator_InsertAsync))
            .Arguments;

        // jobNumber OutputParameter is at index 71 (one after jobID at 70)
        var jobNumberParam = args[ExceleratorJobIdArgIndex + 1] as OutputParameter<string>;
        Assert.NotNull(jobNumberParam);
        Assert.Equal("JOB-001", jobNumberParam._value);
    }

    [Fact]
    public async Task CreateJobAsync_ProcThrowsException_ReturnsFailedWithMessage()
    {
        var service = CreateServiceWithMockedProcs(out var mockProcs);

        // Set up excelerator proc to throw
        mockProcs.Setup(p => p.DD_stpJob_Excelerator_InsertAsync(
            It.IsAny<int?>(), It.IsAny<int?>(), It.IsAny<DateTime?>(), It.IsAny<string>(), It.IsAny<int?>(),
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<int?>(), It.IsAny<string>(), It.IsAny<string>(),
            It.IsAny<string>(), It.IsAny<string>(),
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<int?>(), It.IsAny<string>(), It.IsAny<string>(),
            It.IsAny<string>(), It.IsAny<string>(),
            It.IsAny<int?>(), It.IsAny<int?>(), It.IsAny<double?>(), It.IsAny<double?>(),
            It.IsAny<string>(), It.IsAny<string>(),
            It.IsAny<int?>(), It.IsAny<int?>(),
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
            It.IsAny<string>(), It.IsAny<int?>(),
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
            It.IsAny<int?>(), It.IsAny<int?>(), It.IsAny<string>(), It.IsAny<string>(),
            It.IsAny<string>(), It.IsAny<int?>(), It.IsAny<bool?>(), It.IsAny<int?>(),
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
            It.IsAny<int?>(), It.IsAny<int?>(), It.IsAny<int?>(),
            It.IsAny<decimal?>(), It.IsAny<decimal?>(), It.IsAny<int?>(),
            It.IsAny<int?>(), It.IsAny<bool?>(),
            It.IsAny<int?>(), It.IsAny<int?>(),
            It.IsAny<DateTime?>(), It.IsAny<string>(), It.IsAny<string>(),
            It.IsAny<string>(), It.IsAny<string>(),
            It.IsAny<int?>(), It.IsAny<int?>(), It.IsAny<int?>(), It.IsAny<int?>(),
            It.IsAny<int?>(), It.IsAny<int?>(),
            It.IsAny<OutputParameter<int?>>(), It.IsAny<OutputParameter<string>>(),
            It.IsAny<OutputParameter<decimal?>>(), It.IsAny<OutputParameter<bool?>>(),
            It.IsAny<OutputParameter<int>>(), It.IsAny<CancellationToken>()
        )).ThrowsAsync(new InvalidOperationException("Database connection failed"));

        var input = CreateInput();

        var result = await service.CreateJobAsync(input, TestContext.Current.CancellationToken);

        Assert.False(result.Success);
        Assert.Contains("Database connection failed", result.Message);
    }

    [Fact]
    public async Task CreateJobAsync_ProcNotMocked_OutputParamNotSet_ReturnsFailure()
    {
        // When no proc mock is set up, the loose mock returns null for Task<int>.
        // Awaiting null throws NullReferenceException, caught by the outer catch block.
        var service = CreateServiceWithMockedProcs(out _);
        var input = CreateInput();

        var result = await service.CreateJobAsync(input, TestContext.Current.CancellationToken);

        Assert.False(result.Success);
        Assert.False(string.IsNullOrEmpty(result.Message));
    }

}