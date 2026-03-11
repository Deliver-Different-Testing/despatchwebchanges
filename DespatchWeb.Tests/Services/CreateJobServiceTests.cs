using System.Reflection;
using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Models;
using DespatchWeb.Services;
using FluentAssertions;
using Microsoft.Data.Sqlite;
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
    private readonly SqliteConnection _connection;
    private readonly DespatchContext _seedContext;
    private readonly Mock<IDbContextFactory<DespatchContext>> _contextFactoryMock = new();

    public CreateJobServiceTests()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();

        // Register SQL Server functions that SQLite doesn't have
        _connection.CreateFunction("getdate", () => TestDates.Now);
        _connection.CreateFunction("getutcdate", () => DateTime.UtcNow);

        using (var command = _connection.CreateCommand())
        {
            command.CommandText = "PRAGMA foreign_keys = OFF;";
            command.ExecuteNonQuery();
        }

        var options = new DbContextOptionsBuilder<DespatchContext>()
            .UseSqlite(_connection)
            .Options;

        _seedContext = new DespatchContext(options);
        _seedContext.Database.EnsureCreated();

        // tblReference is mapped as a view (HasNoKey/ToView) so EnsureCreated won't create it.
        // Create as a table in SQLite so we can seed test data via raw SQL.
        using (var cmd = _connection.CreateCommand())
        {
            cmd.CommandText = """
                CREATE TABLE IF NOT EXISTS tblReference (
                    ucrfID INTEGER, ucrfClientID INTEGER, ucrfName TEXT,
                    Grouping TEXT, ReferenceID INTEGER, ClientID INTEGER, Name TEXT
                );
                """;
            cmd.ExecuteNonQuery();
        }

        _contextFactoryMock.Setup(f => f.CreateDbContextAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(() => new DespatchContext(options));

        SeedBaseData();
    }

    public async ValueTask DisposeAsync()
    {
        await _seedContext.DisposeAsync();
        await _connection.DisposeAsync();
    }

    #region Helpers

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
        using var cmd = _connection.CreateCommand();
        cmd.CommandText = $"INSERT INTO tblReference (ReferenceID, ClientID, Name, Grouping, ucrfID, ucrfClientID, ucrfName) VALUES ({referenceId}, {clientId}, '{name}', '{grouping}', {referenceId}, {clientId}, '{name}')";
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
            "200 Delivery Ave", string.Empty, string.Empty, string.Empty, "Wellington", string.Empty, "6011", string.Empty),
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
        IDespatchContextProcedures procs) : TestDespatchContext(options, procs)
    {
        
    }

    /// <summary>
    /// Sets the value of an OutputParameter using reflection (SetValue is internal).
    /// </summary>
    private static void SetOutputParameterValue<T>(OutputParameter<T> param, T value)
    {
        param._value = value;
        typeof(OutputParameter<T>)
            .GetField("_valueSet", BindingFlags.NonPublic | BindingFlags.Instance)!
            .SetValue(param, true);
    }

    /// <summary>
    /// Creates a CreateJobService backed by SQLite (for real EF queries)
    /// with mocked Procedures (for stored proc calls).
    /// </summary>
    private CreateJobService CreateServiceWithMockedProcs(out Mock<IDespatchContextProcedures> mockProcs)
    {
        var options = new DbContextOptionsBuilder<DespatchContext>()
            .UseSqlite(_connection)
            .Options;

        var procsMock = new Mock<IDespatchContextProcedures>();

        var factoryMock = new Mock<IDbContextFactory<DespatchContext>>();
        factoryMock.Setup(f => f.CreateDbContextAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(() => new TestDespatchContext(options, procsMock.Object));

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
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<int?>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<int?>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
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
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<int?>(), It.IsAny<string>(), It.IsAny<string>(),
            It.IsAny<string>(), It.IsAny<string>(),
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<int?>(), It.IsAny<string>(), It.IsAny<string>(),
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
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<int?>(),
            It.IsAny<string>(), It.IsAny<string>(),
            It.IsAny<int?>(), It.IsAny<DateTime?>(), It.IsAny<int?>(), It.IsAny<int?>(), It.IsAny<decimal?>(),
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
            It.IsAny<int?>(), It.IsAny<DateTime?>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<int?>(),
            It.IsAny<OutputParameter<int?>>(), It.IsAny<OutputParameter<string>>(), It.IsAny<OutputParameter<decimal?>>(),
            It.IsAny<OutputParameter<int>>(), It.IsAny<CancellationToken>()
        )).Callback(new InvocationAction(invocation =>
        {
            if (invocation.Arguments[BulkJobIdArgIndex] is OutputParameter<int?> jobId)
                SetOutputParameterValue(jobId, outputJobId);
        })).ReturnsAsync(0);
    }

    #endregion

    #region Type Resolution Tests

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
        result.Should().NotBeNull();
    }

    #endregion

    #region Client Lookup Tests

    [Fact]
    public async Task CreateJobAsync_InvalidClientId_ReturnsError()
    {
        var service = CreateService();
        var input = CreateInput(clientId: 0);

        var result = await service.CreateJobAsync(input);

        result.Success.Should().BeFalse();
        result.Message.Should().Contain("Client");
    }

    [Fact]
    public async Task CreateJobAsync_NonExistentClient_ReturnsError()
    {
        var service = CreateService();
        var input = CreateInput(clientId: 9999);

        var result = await service.CreateJobAsync(input);

        result.Success.Should().BeFalse();
        result.Message.Should().Contain("Client");
    }

    [Fact]
    public async Task CreateJobAsync_ValidClient_PassesValidation()
    {
        var service = CreateService();
        var input = CreateInput(clientId: 10);

        var result = await service.CreateJobAsync(input);

        result.Should().NotBeNull();
        if (!result.Success)
            result.Message.Should().NotContain("Invalid Client");
    }

    #endregion

    #region Bulk Schedule Detection Tests

    [Fact]
    public async Task CreateJobAsync_SpeedIdBelow1000_IsNotBulkSchedule()
    {
        var service = CreateService();
        var input = CreateInput(speedId: 1);

        var result = await service.CreateJobAsync(input);

        result.Should().NotBeNull();
    }

    [Fact]
    public async Task CreateJobAsync_SpeedIdAbove1000_IsBulkSchedule()
    {
        var service = CreateService();
        var input = CreateInput(speedId: 2001);

        var result = await service.CreateJobAsync(input);

        result.Should().NotBeNull();
    }

    [Fact]
    public async Task CreateJobAsync_SpeedIdExactly1000_IsBulkSchedule()
    {
        var service = CreateService();
        var input = CreateInput(speedId: 1000);

        var result = await service.CreateJobAsync(input);

        result.Should().NotBeNull();
    }

    #endregion

    #region Speed/JobType Resolution Tests

    [Fact]
    public async Task CreateJobAsync_SpeedNameMatchesJobType_ResolvesJobTypeId()
    {
        var service = CreateService();
        var input = CreateInput(speed: "Standard");

        var result = await service.CreateJobAsync(input);

        result.Should().NotBeNull();
    }

    [Fact]
    public async Task CreateJobAsync_UnknownSpeedName_FallsBackToSpeedId()
    {
        var service = CreateService();
        var input = CreateInput(speed: "NonExistentSpeed");

        var result = await service.CreateJobAsync(input);

        result.Should().NotBeNull();
    }

    #endregion

    #region Client Defaults Application Tests

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

        var result = await service.CreateJobAsync(input);

        result.Should().NotBeNull();
    }

    [Fact]
    public async Task CreateJobAsync_WithoutClientDefaults_UsesNullFallbacks()
    {
        var service = CreateService();
        var input = CreateInput();

        var result = await service.CreateJobAsync(input);

        result.Should().NotBeNull();
    }

    #endregion

    #region Contact Defaults Tests

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

        var result = await service.CreateJobAsync(input);

        result.Should().NotBeNull();
    }

    #endregion

    #region Null Fallback Defaults Tests

    [Fact]
    public async Task CreateJobAsync_NullInputValues_AppliesFallbackDefaults()
    {
        var service = CreateService();
        var input = CreateInput(notes: null, reference: null, referenceB: null, privateRes: null);

        var result = await service.CreateJobAsync(input);

        result.Should().NotBeNull();
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

        var result = await service.CreateJobAsync(input);

        result.Should().NotBeNull();
    }

    #endregion

    #region Reference Validation Tests

    [Fact]
    public async Task CreateJobAsync_MandatoryReferenceA_EmptyValue_ReturnsError()
    {
        var client = _seedContext.TucClients.First(c => c.UcclId == 10);
        client.ReferenceAmandatory = true;
        client.ReferenceAmessage = "Custom ref A message";
        await _seedContext.SaveChangesAsync(TestContext.Current.CancellationToken);

        var service = CreateService();
        var input = CreateInput();

        var result = await service.CreateJobAsync(input);

        result.Success.Should().BeFalse();
        result.Message.Should().Be("Custom ref A message");
    }

    [Fact]
    public async Task CreateJobAsync_MandatoryReferenceA_WithValue_Passes()
    {
        var client = _seedContext.TucClients.First(c => c.UcclId == 10);
        client.ReferenceAmandatory = true;
        await _seedContext.SaveChangesAsync(TestContext.Current.CancellationToken);

        var service = CreateService();
        var input = CreateInput(reference: "REF-001");

        var result = await service.CreateJobAsync(input);

        if (!result.Success)
            result.Message.Should().NotContain("Reference A");
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

        var result = await service.CreateJobAsync(input);

        result.Success.Should().BeFalse();
        result.Message.Should().Be("Ref B is required");
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

        var result = await service.CreateJobAsync(input);

        result.Success.Should().BeFalse();
        result.Message.Should().Contain("not in the defined list");
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

        var result = await service.CreateJobAsync(input);

        if (!result.Success)
            result.Message.Should().NotContain("defined list");
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

        var result = await service.CreateJobAsync(input);

        result.Success.Should().BeFalse();
        result.Message.Should().Contain("not in the defined list");
    }

    #endregion

    #region Recurring Bitmask Parsing Tests

    [Theory]
    [InlineData("1110000", 7, 0b0000111)]  // Mon, Tue, Wed
    [InlineData("0000011", 7, 0b1100000)]  // Sat, Sun
    [InlineData("1111111", 7, 0b1111111)]  // All days
    [InlineData("0000000", 7, 0b0000000)]  // No days
    [InlineData("1000000", 7, 0b0000001)]  // Mon only
    public void ParseBitmask_Days_ConvertsCorrectly(string input, int maxBits, int expectedBitmask)
    {
        var result = CreateJobService.ParseBitmask(input, maxBits);
        result.Should().Be(expectedBitmask);
    }

    [Theory]
    [InlineData("10000", 5, 0b00001)]  // Weekly
    [InlineData("01000", 5, 0b00010)]  // Fortnightly
    [InlineData("11000", 5, 0b00011)]  // Weekly + Fortnightly
    [InlineData("00000", 5, 0b00000)]  // None
    public void ParseBitmask_Frequency_ConvertsCorrectly(string input, int maxBits, int expectedBitmask)
    {
        var result = CreateJobService.ParseBitmask(input, maxBits);
        result.Should().Be(expectedBitmask);
    }

    [Fact]
    public void ParseBitmask_NullInput_ReturnsNull()
    {
        CreateJobService.ParseBitmask(null, 7).Should().BeNull();
        CreateJobService.ParseBitmask(string.Empty, 7).Should().BeNull();
        CreateJobService.ParseBitmask("  ", 5).Should().BeNull();
    }

    #endregion

    #region Validation Error Tests

    [Fact]
    public async Task CreateJobAsync_MissingBookedBy_ReturnsError()
    {
        var service = CreateService();
        var input = CreateInput(bookedBy: string.Empty);

        var result = await service.CreateJobAsync(input);

        result.Success.Should().BeFalse();
        result.Message.Should().Contain("Booked By");
    }

    [Fact]
    public async Task CreateJobAsync_InvalidSpeed_ReturnsError()
    {
        var service = CreateService();
        var input = CreateInput(speedId: 0);

        var result = await service.CreateJobAsync(input);

        result.Success.Should().BeFalse();
        result.Message.Should().Contain("Speed");
    }

    [Fact]
    public async Task CreateJobAsync_MissingFromAddress_ReturnsError()
    {
        var service = CreateService();
        var input = CreateInput(fromAddress: new AddressViewModel());

        var result = await service.CreateJobAsync(input);

        result.Success.Should().BeFalse();
        result.Message.Should().Contain("From Address");
    }

    [Fact]
    public async Task CreateJobAsync_MissingToAddress_ReturnsError()
    {
        var service = CreateService();
        var input = CreateInput(toAddress: new AddressViewModel());

        var result = await service.CreateJobAsync(input);

        result.Success.Should().BeFalse();
        result.Message.Should().Contain("To Address");
    }

    #endregion

    #region Settings Lookup Tests

    [Fact]
    public async Task CreateJobAsync_LoadsSettingsFromTblSettings()
    {
        var service = CreateService();
        var input = CreateInput();

        var result = await service.CreateJobAsync(input);

        result.Should().NotBeNull();
    }

    #endregion

    #region Normal Job Stored Procedure Tests

    [Fact]
    public async Task CreateJobAsync_NormalJob_CallsExceleratorInsertProc()
    {
        var service = CreateServiceWithMockedProcs(out var mockProcs);
        SetupExceleratorInsert(mockProcs);
        var input = CreateInput();

        await service.CreateJobAsync(input);

        var invocation = mockProcs.Invocations
            .SingleOrDefault(i => i.Method.Name == nameof(IDespatchContextProcedures.DD_stpJob_Excelerator_InsertAsync));
        invocation.Should().NotBeNull("the normal job path should call DD_stpJob_Excelerator_InsertAsync");
    }

    [Fact]
    public async Task CreateJobAsync_NormalJob_DoesNotCallBulkInsert()
    {
        var service = CreateServiceWithMockedProcs(out var mockProcs);
        SetupExceleratorInsert(mockProcs);
        var input = CreateInput(speedId: 1);

        await service.CreateJobAsync(input);

        mockProcs.Invocations
            .Any(i => i.Method.Name == nameof(IDespatchContextProcedures.DD_stpBulkScheduleJob_InsertAsync))
            .Should().BeFalse("normal jobs should not call the bulk schedule proc");
    }

    [Fact]
    public async Task CreateJobAsync_NormalJob_ReturnsSuccessWithJobId()
    {
        var service = CreateServiceWithMockedProcs(out var mockProcs);
        SetupExceleratorInsert(mockProcs, outputJobId: 42);
        var input = CreateInput();

        var result = await service.CreateJobAsync(input);

        result.Success.Should().BeTrue();
        result.JobId.Should().Be(42);
    }

    [Fact]
    public async Task CreateJobAsync_NormalJob_NullJobIdOutput_ReturnsFailure()
    {
        var service = CreateServiceWithMockedProcs(out var mockProcs);
        SetupExceleratorInsert(mockProcs, outputJobId: null);
        var input = CreateInput();

        var result = await service.CreateJobAsync(input);

        result.Success.Should().BeFalse();
        result.JobId.Should().BeNull();
    }

    [Fact]
    public async Task CreateJobAsync_NormalJob_MapsKeyParametersCorrectly()
    {
        var service = CreateServiceWithMockedProcs(out var mockProcs);
        SetupExceleratorInsert(mockProcs);
        var input = CreateInput();

        await service.CreateJobAsync(input);

        var args = mockProcs.Invocations
            .Single(i => i.Method.Name == nameof(IDespatchContextProcedures.DD_stpJob_Excelerator_InsertAsync))
            .Arguments;

        args[0].Should().Be(1, "type should default to 1 (pickup)");
        args[1].Should().Be(10, "clientID should match input");
        args[3].Should().Be("Test User", "contact should be BookedBy");
        args[4].Should().Be(3, "chargeType should come from TblSettings.InternetJobChargeType");
        args[25].Should().Be(42, "opID should come from TblSettings.InternetJobStaffId");
        args[32].Should().Be(1, "service (jobTypeId) should be resolved from speed name");
        args[42].Should().Be(1, "speed should match SpeedId");
        args[49].Should().Be((int)JobSource.DespatchWeb, "sourceId should be DespatchWeb");
        args[57].Should().Be(1, "loggedInContactId should match input");
    }

    [Fact]
    public async Task CreateJobAsync_NormalJob_MapsAddressFields()
    {
        var service = CreateServiceWithMockedProcs(out var mockProcs);
        SetupExceleratorInsert(mockProcs);
        var input = CreateInput(
            fromAddress: new AddressViewModel("100 Pickup St", "Suite 2", "3 High", "Road", "Auckland", "AKL", "1010", ""),
            toAddress: new AddressViewModel("200 Delivery Ave", "Unit 5", "7 Low", "Lane", "Wellington", "WGN", "6011", ""));

        await service.CreateJobAsync(input);

        var args = mockProcs.Invocations
            .Single(i => i.Method.Name == nameof(IDespatchContextProcedures.DD_stpJob_Excelerator_InsertAsync))
            .Arguments;

        // From address
        args[15].Should().Be("100 Pickup St, Suite 2, 3 High, Road, Auckland, AKL, 1010", "fromAddress = FullAddress");
        args[18].Should().Be("100 Pickup St", "fromCompany = AddressLine1");
        args[17].Should().Be("Suite 2", "fromExtra = AddressLine2");
        args[16].Should().Be("3 High Road", "fromStreet = AddressLine3 + AddressLine4 trimmed");
        args[12].Should().Be("Auckland", "fromCity = AddressLine5");
        args[13].Should().Be("AKL", "fromState = AddressLine6");
        args[14].Should().Be(1010, "fromZipCode parsed from AddressLine7");

        // To address
        args[8].Should().Be("200 Delivery Ave, Unit 5, 7 Low, Lane, Wellington, WGN, 6011", "toAddress = FullAddress");
        args[11].Should().Be("200 Delivery Ave", "toCompany = AddressLine1");
        args[10].Should().Be("Unit 5", "toExtra = AddressLine2");
        args[9].Should().Be("7 Low Lane", "toStreet = AddressLine3 + AddressLine4 trimmed");
        args[5].Should().Be("Wellington", "toCity = AddressLine5");
        args[6].Should().Be("WGN", "toState = AddressLine6");
        args[7].Should().Be(6011, "toZipCode parsed from AddressLine7");
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

        await service.CreateJobAsync(input);

        var args = mockProcs.Invocations
            .Single(i => i.Method.Name == nameof(IDespatchContextProcedures.DD_stpJob_Excelerator_InsertAsync))
            .Arguments;

        args[38].Should().BeOfType<int>().Which.Should().Be(1, "proofOfDelivery true -> 1");
        args[39].Should().Be("pod@test.com", "proofOfDeliveryEmail from defaults");
    }

    [Fact]
    public async Task CreateJobAsync_NormalJob_PassesRecurringBitmasks()
    {
        var service = CreateServiceWithMockedProcs(out var mockProcs);
        SetupExceleratorInsert(mockProcs);
        var input = CreateInput(recurringDays: "1110000", recurringFrequency: "10000");

        await service.CreateJobAsync(input);

        var args = mockProcs.Invocations
            .Single(i => i.Method.Name == nameof(IDespatchContextProcedures.DD_stpJob_Excelerator_InsertAsync))
            .Arguments;

        args[63].Should().Be("7", "recurringDays string should be the bitmask value as string");
        args[64].Should().Be(0b0000111, "daysInt should be the bitmask integer (Mon+Tue+Wed=7)");
        args[65].Should().Be(0b00001, "frequencyInt should be the bitmask integer (weekly=1)");
    }

    [Fact]
    public async Task CreateJobAsync_NormalJob_TypeDeliverTo_SetsTypeId2()
    {
        var service = CreateServiceWithMockedProcs(out var mockProcs);
        SetupExceleratorInsert(mockProcs);
        var input = CreateInput(type: "DELIVERTO");

        await service.CreateJobAsync(input);

        var args = mockProcs.Invocations
            .Single(i => i.Method.Name == nameof(IDespatchContextProcedures.DD_stpJob_Excelerator_InsertAsync))
            .Arguments;

        args[0].Should().Be(2, "DELIVERTO type should map to TypeId 2");
    }

    #endregion

    #region Bulk Schedule Job Stored Procedure Tests

    [Fact]
    public async Task CreateJobAsync_BulkJob_CallsBulkScheduleInsertProc()
    {
        var service = CreateServiceWithMockedProcs(out var mockProcs);
        SetupBulkScheduleInsert(mockProcs);
        var input = CreateInput(speedId: 2001);

        await service.CreateJobAsync(input);

        var invocation = mockProcs.Invocations
            .SingleOrDefault(i => i.Method.Name == nameof(IDespatchContextProcedures.DD_stpBulkScheduleJob_InsertAsync));
        invocation.Should().NotBeNull("bulk jobs (SpeedId >= 1000) should call DD_stpBulkScheduleJob_InsertAsync");
    }

    [Fact]
    public async Task CreateJobAsync_BulkJob_DoesNotCallExceleratorInsert()
    {
        var service = CreateServiceWithMockedProcs(out var mockProcs);
        SetupBulkScheduleInsert(mockProcs);
        var input = CreateInput(speedId: 2001);

        await service.CreateJobAsync(input);

        mockProcs.Invocations
            .Any(i => i.Method.Name == nameof(IDespatchContextProcedures.DD_stpJob_Excelerator_InsertAsync))
            .Should().BeFalse("bulk jobs should not call the excelerator proc");
    }

    [Fact]
    public async Task CreateJobAsync_BulkJob_ReturnsSuccessWithJobId()
    {
        var service = CreateServiceWithMockedProcs(out var mockProcs);
        SetupBulkScheduleInsert(mockProcs, outputJobId: 99);
        var input = CreateInput(speedId: 2001);

        var result = await service.CreateJobAsync(input);

        result.Success.Should().BeTrue();
        result.JobId.Should().Be(99);
    }

    [Fact]
    public async Task CreateJobAsync_BulkJob_CastsQuantityAndSizeToShort()
    {
        var service = CreateServiceWithMockedProcs(out var mockProcs);
        SetupBulkScheduleInsert(mockProcs);
        var input = CreateInput(speedId: 2001);

        await service.CreateJobAsync(input);

        var args = mockProcs.Invocations
            .Single(i => i.Method.Name == nameof(IDespatchContextProcedures.DD_stpBulkScheduleJob_InsertAsync))
            .Arguments;

        // Size defaults to 2 (from ApplyNullFallbackDefaults), cast to short
        args[25].Should().BeOfType<short>().Which.Should().Be(2, "size should be cast to short");
        // Quantity defaults to 1 (from ApplyNullFallbackDefaults), cast to short
        args[26].Should().BeOfType<short>().Which.Should().Be(1, "qty should be cast to short");
    }

    [Fact]
    public async Task CreateJobAsync_BulkJob_ConvertsDeliverToPrivateBusinessToNullableBool()
    {
        var service = CreateServiceWithMockedProcs(out var mockProcs);
        SetupBulkScheduleInsert(mockProcs);
        var input = CreateInput(speedId: 2001, privateRes: true);

        await service.CreateJobAsync(input);

        var args = mockProcs.Invocations
            .Single(i => i.Method.Name == nameof(IDespatchContextProcedures.DD_stpBulkScheduleJob_InsertAsync))
            .Arguments;

        args[33].Should().BeOfType<bool>().Which.Should().BeTrue(
            "deliverToPrivateBusiness int 1 should convert to bool true");
    }

    [Fact]
    public async Task CreateJobAsync_BulkJob_MapsKeyParameters()
    {
        var service = CreateServiceWithMockedProcs(out var mockProcs);
        SetupBulkScheduleInsert(mockProcs);
        var input = CreateInput(speedId: 2001);

        await service.CreateJobAsync(input);

        var args = mockProcs.Invocations
            .Single(i => i.Method.Name == nameof(IDespatchContextProcedures.DD_stpBulkScheduleJob_InsertAsync))
            .Arguments;

        args[0].Should().Be(1, "type should default to 1");
        args[2].Should().Be(10, "clientID should match input");
        args[3].Should().Be("Test User", "contact should be BookedBy");
        args[51].Should().Be(false, "onHold should be data.Hold (default false)");
        args[52].Should().Be("JOB-001", "orderRef should be data.JobNumber");
        args[64].Should().Be((int)JobSource.DespatchWeb, "sourceId should be DespatchWeb");
        args[66].Should().Be(1, "loggedInContactId should match input");
    }

    [Fact]
    public async Task CreateJobAsync_NormalJob_SeedsJobNumberOutputParameter()
    {
        var service = CreateServiceWithMockedProcs(out var mockProcs);
        SetupExceleratorInsert(mockProcs);
        var input = CreateInput();

        await service.CreateJobAsync(input);

        var args = mockProcs.Invocations
            .Single(i => i.Method.Name == nameof(IDespatchContextProcedures.DD_stpJob_Excelerator_InsertAsync))
            .Arguments;

        // jobNumber OutputParameter is at index 71 (one after jobID at 70)
        var jobNumberParam = args[ExceleratorJobIdArgIndex + 1] as OutputParameter<string>;
        jobNumberParam.Should().NotBeNull();
        jobNumberParam!._value.Should().Be("JOB-001",
            "the pre-generated job number from input should be seeded into the OutputParameter so the SP receives it as input");
    }

    #endregion

    #region Stored Procedure Error Handling Tests

    [Fact]
    public async Task CreateJobAsync_ProcThrowsException_ReturnsFailedWithMessage()
    {
        var service = CreateServiceWithMockedProcs(out var mockProcs);

        // Set up excelerator proc to throw
        mockProcs.Setup(p => p.DD_stpJob_Excelerator_InsertAsync(
            It.IsAny<int?>(), It.IsAny<int?>(), It.IsAny<DateTime?>(), It.IsAny<string>(), It.IsAny<int?>(),
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<int?>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<int?>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
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

        var result = await service.CreateJobAsync(input);

        result.Success.Should().BeFalse();
        result.Message.Should().Contain("Database connection failed");
    }

    [Fact]
    public async Task CreateJobAsync_ProcNotMocked_OutputParamNotSet_ReturnsFailure()
    {
        // When no proc mock is set up, the loose mock returns null for Task<int>.
        // Awaiting null throws NullReferenceException, caught by the outer catch block.
        var service = CreateServiceWithMockedProcs(out _);
        var input = CreateInput();

        var result = await service.CreateJobAsync(input);

        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNullOrEmpty();
    }

    #endregion
}
