using DespatchWeb.EntityClasses;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Repositories;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// Tests for JobRepository.UpdateDeliveryAddressAsync / UpdatePickupAddressAsync.
/// Regression coverage for AddressLine8 (country) persistence — previously dropped
/// for active and archived jobs in the JobRepository (vs the equivalent
/// RecurringJobRepository methods which save it correctly).
/// </summary>
public class JobRepositoryUpdateAddressTests : IAsyncDisposable
{
    private readonly IClearListEnvelopeService _clearListEnvelopeServiceMock = Substitute.For<IClearListEnvelopeService>();
    private readonly FakeTenantClock _clock = new(new DateTime(2024, 6, 15, 10, 0, 0));
    private readonly DespatchContext _context;
    private readonly IDbContextFactory<DespatchContext> _contextFactoryMock;
    private readonly ICreateJobService _createJobServiceMock = Substitute.For<ICreateJobService>();
    private readonly SqliteTestDatabase _db = new();
    private readonly ITenantInfoService _tenantInfoServiceMock = Substitute.For<ITenantInfoService>();

    public JobRepositoryUpdateAddressTests()
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
        Substitute.For<ICourierRepository>()
    );

    private static AddressViewModel BuildAddress(string country) => new(
        addressLine1: "Unit 5",
        addressLine2: "Building A",
        addressLine3: "123",
        addressLine4: "Main Street",
        addressLine5: "Auckland",
        addressLine6: "Auckland Central",
        addressLine7: "1010",
        addressLine8: country)
    {
        Latitude = -36.8485m,
        Longitude = 174.7633m
    };

    [Fact]
    public async Task UpdateDeliveryAddressAsync_ActiveJob_PersistsCountryToAddressLine8()
    {
        const int jobId = 100;
        _context.TucJobs.Add(new TucJob { UcjbId = jobId, UcjbNumber = "JOB-100" });
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        await CreateRepository().UpdateDeliveryAddressAsync(new UpdateAddressRequest
        {
            JobId = jobId,
            Address = BuildAddress("New Zealand")
        });

        var job = await _context.TucJobs.AsNoTracking()
            .FirstAsync(j => j.UcjbId == jobId, TestContext.Current.CancellationToken);
        Assert.Equal("New Zealand", job.DeliveryAddressLine8);
    }

    [Fact]
    public async Task UpdateDeliveryAddressAsync_ArchivedJob_PersistsCountryToAddressLine8()
    {
        const int jobId = 200;
        _context.TucJobArchives.Add(new TucJobArchive { UcjbId = jobId, UcjbNumber = "ARCH-200" });
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        await CreateRepository().UpdateDeliveryAddressAsync(new UpdateAddressRequest
        {
            JobId = jobId,
            Address = BuildAddress("Australia")
        });

        var archive = await _context.TucJobArchives.AsNoTracking()
            .FirstAsync(j => j.UcjbId == jobId, TestContext.Current.CancellationToken);
        Assert.Equal("Australia", archive.DeliveryAddressLine8);
    }

    [Fact]
    public async Task UpdatePickupAddressAsync_ActiveJob_PersistsCountryToAddressLine8()
    {
        const int jobId = 300;
        _context.TucJobs.Add(new TucJob { UcjbId = jobId, UcjbNumber = "JOB-300" });
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        await CreateRepository().UpdatePickupAddressAsync(new UpdateAddressRequest
        {
            JobId = jobId,
            Address = BuildAddress("United States")
        });

        var job = await _context.TucJobs.AsNoTracking()
            .FirstAsync(j => j.UcjbId == jobId, TestContext.Current.CancellationToken);
        Assert.Equal("United States", job.PickupAddressLine8);
    }

    [Fact]
    public async Task UpdatePickupAddressAsync_ArchivedJob_PersistsCountryToAddressLine8()
    {
        const int jobId = 400;
        _context.TucJobArchives.Add(new TucJobArchive { UcjbId = jobId, UcjbNumber = "ARCH-400" });
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        await CreateRepository().UpdatePickupAddressAsync(new UpdateAddressRequest
        {
            JobId = jobId,
            Address = BuildAddress("Canada")
        });

        var archive = await _context.TucJobArchives.AsNoTracking()
            .FirstAsync(j => j.UcjbId == jobId, TestContext.Current.CancellationToken);
        Assert.Equal("Canada", archive.PickupAddressLine8);
    }
}
