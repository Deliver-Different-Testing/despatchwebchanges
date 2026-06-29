using DespatchWeb.EntityClasses;
using DespatchWeb.Interfaces;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Repositories;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// Integration tests for JobRepository.GetClientJobsReportDataAsync. Exercises the EF Core
/// query, the LEFT JOINs to job type / suburb / address detail / client / courier / relationship
/// type, the WHERE filter combination, and the magic-key ORDER BY.
/// </summary>
public class JobRepositoryClientJobsReportTests : IAsyncDisposable
{
    private readonly IClearListEnvelopeService _clearListEnvelopeServiceMock = Substitute.For<IClearListEnvelopeService>();
    private readonly FakeTenantClock _clock = new(new DateTime(2024, 6, 15, 10, 0, 0));
    private readonly DespatchContext _context;
    private readonly IDbContextFactory<DespatchContext> _contextFactoryMock;
    private readonly ICreateJobService _createJobServiceMock = Substitute.For<ICreateJobService>();
    private readonly IJobApiClient _jobApiClientMock = Substitute.For<IJobApiClient>();
    private readonly SqliteTestDatabase _db = new();
    private readonly ITenantInfoService _tenantInfoServiceMock = Substitute.For<ITenantInfoService>();

    public JobRepositoryClientJobsReportTests()
    {
        _context = _db.CreateContext();
        _contextFactoryMock = SqliteTestDatabase.CreateFactoryMock(_context);
        _tenantInfoServiceMock.GetTenantTimeZone().Returns("New Zealand Standard Time");
    }

    public async ValueTask DisposeAsync()
    {
        GC.SuppressFinalize(this);
        await _context.DisposeAsync();
        await _db.DisposeAsync();
    }

    private JobRepository CreateRepository() => new(
        _contextFactoryMock,
        _tenantInfoServiceMock,
        _clock,
        _clearListEnvelopeServiceMock,
        _createJobServiceMock,
        _jobApiClientMock
    );

    private static ClientJobsReportRequest BuildRequest(IEnumerable<int> clientIds) => new()
    {
        StartDate = new DateTimeOffset(2024, 3, 1, 0, 0, 0, TimeSpan.Zero),
        EndDate = new DateTimeOffset(2024, 3, 31, 0, 0, 0, TimeSpan.Zero),
        ClientIds = clientIds.ToList()
    };

    [Fact]
    public async Task ReturnsMatchingJob_WithJoinedFieldsPopulated()
    {
        _context.TucJobTypes.AddRange(
            BuildJobType(10, "1 Hour", "1 Hour", minutes: 60),
            BuildJobType(11, "Express", "Express", minutes: 30)
        );
        _context.TucSuburbs.AddRange(
            BuildSuburb(20, "Newmarket", "1023"),
            BuildSuburb(21, "Parnell", "1052")
        );
        _context.TucClients.Add(BuildClient(30, "Test Corp", "VIP"));
        _context.TucCouriers.Add(new TucCourier
        {
            UccrId = 40, Code = "C01", UccrName = "Alice", UccrSurname = "Smith",
            CreatedBy = "test", LastModifiedBy = "test"
        });
        _context.TucJobAddressDeatils.Add(new TucJobAddressDeatil { Id = 1, JobId = 100, ToSuburb = "AltSuburb" });

        _context.TucJobArchives.Add(new TucJobArchive
        {
            UcjbId = 100,
            UcjbNumber = "JOB-100",
            UcjbDate = new DateTime(2024, 3, 15),
            UcjbTime = new DateTime(2024, 3, 15, 9, 0, 0),
            UcjbType = 1,
            UcjbContact = "admin",
            UcjbAmount = 25.50m,
            UcjbSpeed = 10,
            AcceptedJobTypeId = 11,
            UcjbFrom = 20,
            UcjbFromAddr = "1 Queen St",
            UcjbTo = 21,
            UcjbToAddr = "5 Broadway",
            UcjbSize = 1,
            UcjbQty = 3,
            UcjbWeight = 5.5,
            UcjbCourierId = 40,
            UcjbComplTime = new DateTime(2024, 3, 15, 10, 30, 0),
            PickUpTime = new DateTime(2024, 3, 15, 9, 30, 0),
            UcjbJobDone = true,
            UcjbVoid = false,
            UcjbClientId = 30,
            UcjbLatePick = 1,
            UcjbLateDel = 0,
            UcjbClientRefa = "REF-A",
            UcjbClientRefb = "REF-B",
            UcjbOurRef = "OUR-1",
            UcjbInvoiceNo = 999,
            UcjbLocked = 1,
            UcjbMonth = 3,
            UcjbYear = 2024,
            UcjbNotes = "Fragile",
            UcjbPodname = "John",
            RawBaseAmount = 20m,
            FuelSurchargeAmount = 2.5m
        });
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var result = await CreateRepository().GetClientJobsReportDataAsync(BuildRequest([30]));

        var row = Assert.Single(result);
        Assert.Equal("JOB-100", row.JobNumber);
        Assert.Equal("Pick up from us", row.UcjbType);
        Assert.Equal("15-Mar-24", row.Date);
        Assert.Equal("09:00", row.Booked);
        Assert.Equal("admin", row.BookedBy);
        Assert.Equal("2024-03-15 09:30:00", row.PickedUpTime);
        Assert.Equal("2024-03-15 10:30:00", row.Delivered);
        Assert.Equal("John", row.PodName);
        Assert.Equal("Newmarket", row.From);
        Assert.Equal("1023", row.FromPostcode);
        Assert.Equal("Parnell", row.To);
        Assert.Equal("1052", row.ToPostcode);
        Assert.Equal("1 Queen St", row.UcjbFromAddr);
        Assert.Equal("5 Broadway", row.Address);
        Assert.Equal("40", row.Courier);
        Assert.Equal("True", row.LatePickup);
        Assert.Equal("False", row.LateDelivery);
        Assert.Equal("Test Corp", row.UcclLegalName);
        Assert.Equal("1 Hour", row.UcjbSpeed);
        Assert.Equal("Express", row.AchievedSpeed);
        Assert.Equal("Fragile", row.Notes);
        Assert.Equal("25.50", row.ChargeExclGst);
        Assert.Equal("C01", row.Code);
        Assert.Equal("Alice", row.UccrName);
        Assert.Equal("999", row.UcjbInvoiceNo);
        Assert.Equal("True", row.UcjbLocked);
        Assert.Equal("30", row.UcjbClientId);
        Assert.Equal("VIP", row.UcclNote);
        Assert.Equal("60", row.Minutes);
        Assert.Equal("Car", row.Vehicle);
        Assert.Equal("3", row.Quantity);
        Assert.Equal(20m, row.RawBaseAmount);
        Assert.Equal(2.5m, row.FuelSurchargeAmount);
    }

    [Fact]
    public async Task ExcludesVoidJobs_NotDoneJobs_AndOutOfRangeDates()
    {
        _context.TucJobArchives.AddRange(
            BuildBasicJob(1, "MATCH", new DateTime(2024, 3, 10), clientId: 30),
            BuildBasicJob(2, "VOID", new DateTime(2024, 3, 10), clientId: 30, isVoid: true),
            BuildBasicJob(3, "NOT-DONE", new DateTime(2024, 3, 10), clientId: 30, isDone: false),
            BuildBasicJob(4, "BEFORE-RANGE", new DateTime(2024, 2, 28), clientId: 30),
            BuildBasicJob(5, "AFTER-RANGE", new DateTime(2024, 4, 1), clientId: 30)
        );
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var result = await CreateRepository().GetClientJobsReportDataAsync(BuildRequest([30]));

        Assert.Single(result);
        Assert.Equal("MATCH", result[0].JobNumber);
    }

    [Fact]
    public async Task FiltersByClientIds_AndTreatsNullClientIdAsZero()
    {
        _context.TucJobArchives.AddRange(
            BuildBasicJob(1, "CLIENT-30", new DateTime(2024, 3, 10), clientId: 30),
            BuildBasicJob(2, "CLIENT-99", new DateTime(2024, 3, 10), clientId: 99),
            BuildBasicJob(3, "NO-CLIENT", new DateTime(2024, 3, 10), clientId: null)
        );
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var withZero = await CreateRepository().GetClientJobsReportDataAsync(BuildRequest([30, 0]));
        Assert.Equal(2, withZero.Count);
        Assert.Contains(withZero, r => r.JobNumber == "CLIENT-30");
        Assert.Contains(withZero, r => r.JobNumber == "NO-CLIENT");

        var withoutZero = await CreateRepository().GetClientJobsReportDataAsync(BuildRequest([30]));
        var single = Assert.Single(withoutZero);
        Assert.Equal("CLIENT-30", single.JobNumber);
    }

    [Fact]
    public async Task ExcludesJobs_WhenRelationshipTypeDisplayStatementIsFalse()
    {
        _context.TblJobRelationshipTypes.AddRange(
            BuildRelationshipType(1, "Show", displayStatement: true),
            BuildRelationshipType(2, "Hide", displayStatement: false)
        );
        _context.TucJobArchives.AddRange(
            BuildBasicJob(1, "REL-NULL", new DateTime(2024, 3, 10), clientId: 30, relationshipTypeId: null),
            BuildBasicJob(2, "REL-SHOW", new DateTime(2024, 3, 10), clientId: 30, relationshipTypeId: 1),
            BuildBasicJob(3, "REL-HIDE", new DateTime(2024, 3, 10), clientId: 30, relationshipTypeId: 2)
        );
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var result = await CreateRepository().GetClientJobsReportDataAsync(BuildRequest([30]));

        Assert.Equal(2, result.Count);
        Assert.Contains(result, r => r.JobNumber == "REL-NULL");
        Assert.Contains(result, r => r.JobNumber == "REL-SHOW");
        Assert.DoesNotContain(result, r => r.JobNumber == "REL-HIDE");
    }

    [Fact]
    public async Task OrdersByJobTypeDescription_UsingMagicSortKey()
    {
        _context.TucJobTypes.AddRange(
            BuildJobType(1, "A", "3 Hour"),
            BuildJobType(2, "B", "15 Minute"),
            BuildJobType(3, "C", "1 Hour"),
            BuildJobType(4, "D", "Other")
        );
        _context.TucJobArchives.AddRange(
            BuildBasicJob(101, "J-3HR", new DateTime(2024, 3, 10), clientId: 30, speedId: 1),
            BuildBasicJob(102, "J-15M", new DateTime(2024, 3, 10), clientId: 30, speedId: 2),
            BuildBasicJob(103, "J-1HR", new DateTime(2024, 3, 10), clientId: 30, speedId: 3),
            BuildBasicJob(104, "J-OTHER", new DateTime(2024, 3, 10), clientId: 30, speedId: 4)
        );
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var result = await CreateRepository().GetClientJobsReportDataAsync(BuildRequest([30]));

        Assert.Equal(["J-15M", "J-1HR", "J-3HR", "J-OTHER"], result.Select(r => r.JobNumber));
    }

    private static TucSuburb BuildSuburb(int id, string name, string postCode) => new()
    {
        UcsuId = id,
        UcsuName = name,
        PostCode = postCode,
        UcsuArea = 1,
        Smsname = name,
        CreatedBy = "test",
        LastModifiedBy = "test"
    };

    private static TucJobType BuildJobType(int id, string name, string description, int? minutes = null) => new()
    {
        UcjtId = id,
        UcjtName = name,
        UcjtDescription = description,
        Minutes = minutes,
        CreatedBy = "test",
        LastModifiedBy = "test"
    };

    private static TucClient BuildClient(int id, string legalName, string note) => new()
    {
        UcclId = id,
        UcclName = legalName,
        UcclLegalName = legalName,
        UcclNote = note,
        Smsname = legalName,
        UcclCode = $"C{id}",
        CreatedBy = "test",
        LastModifiedBy = "test"
    };

    private static TblJobRelationshipType BuildRelationshipType(int id, string name, bool displayStatement) => new()
    {
        JobRelationshipTypeId = id,
        Name = name,
        SystemName = name.ToLower(),
        DisplayStatement = displayStatement,
        CreatedBy = "test",
        LastModifiedBy = "test"
    };

    private static TucJobArchive BuildBasicJob(
        int id,
        string number,
        DateTime date,
        int? clientId,
        bool isVoid = false,
        bool isDone = true,
        int? relationshipTypeId = null,
        int? speedId = null) => new()
    {
        UcjbId = id,
        UcjbNumber = number,
        UcjbDate = date,
        UcjbClientId = clientId,
        UcjbVoid = isVoid,
        UcjbJobDone = isDone,
        JobRelationshipTypeId = relationshipTypeId,
        UcjbSpeed = speedId
    };
}
