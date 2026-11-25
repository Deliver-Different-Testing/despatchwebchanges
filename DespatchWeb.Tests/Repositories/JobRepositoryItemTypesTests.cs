using DespatchWeb.EntityClasses;
using DespatchWeb.Interfaces;
using DespatchWeb.Repositories;
using NSubstitute;

namespace DespatchWeb.Tests.Repositories;

public class JobRepositoryItemTypesTests : IAsyncDisposable
{
    private const int SharedId = 100;

    private readonly SqliteTestDatabase _db = new();

    public async ValueTask DisposeAsync()
    {
        GC.SuppressFinalize(this);
        await _db.DisposeAsync();
    }

    private JobRepository CreateRepository() => new(
        _db.CreateFactoryMock(),
        Substitute.For<ITenantInfoService>(),
        new FakeTenantClock(TestDates.Now),
        Substitute.For<IClearListEnvelopeService>(),
        Substitute.For<ICreateJobService>(),
        Substitute.For<ICourierRepository>(),
        Substitute.For<ISuburbResolver>());

    // A live job and a recurring booking share id 100, the collision behind ticket #846.
    private async Task SeedCollidingIdsAsync()
    {
        await using var ctx = _db.CreateContext();
        ctx.TucItemTypes.AddRange(
            new TucItemType { ItemTypeId = 1, Name = "Live type", CreatedBy = "t", LastModifiedBy = "t" },
            new TucItemType { ItemTypeId = 2, Name = "Booking type", CreatedBy = "t", LastModifiedBy = "t" });
        ctx.TucJobs.Add(new TucJob { UcjbId = SharedId, UcjbNumber = "LIVE" });
        ctx.TucJobItems.Add(new TucJobItem { JobId = SharedId, ItemId = 1, Items = 1, Weight = 1 });
        ctx.TucJobItemTypes.Add(new TucJobItemType { JobId = SharedId, ItemId = 1, ItemTypeId = 1, Quantity = 1 });
        ctx.TucJobBookings.AddRange(
            new TucJobBooking { UcbkId = SharedId, UcbkJobNumber = "BOOK", UcbkAttention = false },
            new TucJobBooking { UcbkId = 101, UcbkJobNumber = "BOOK-LEG", BookingParentId = SharedId, UcbkAttention = false });
        ctx.TucJobBookingItems.Add(new TucJobBookingItem { BookingId = SharedId, ItemId = 1, Items = 1, Weight = 1 });
        ctx.TucJobBookingItemTypes.Add(new TucJobBookingItemType { BookingId = SharedId, ItemId = 1, ItemTypeId = 2, Quantity = 1 });
        await ctx.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task GetJobItemTypesAsync_JobId_ReturnsOnlyTheJobsTypes()
    {
        await SeedCollidingIdsAsync();

        var types = await CreateRepository().GetJobItemTypesAsync(SharedId, null, null);

        Assert.Equal("Live type", Assert.Single(types).Name);
    }

    [Theory]
    [InlineData(SharedId)]
    [InlineData(101)]
    public async Task GetJobItemTypesAsync_BookingId_ReturnsOnlyTheBookingFamilysTypes(int bookingId)
    {
        await SeedCollidingIdsAsync();

        var types = await CreateRepository().GetJobItemTypesAsync(null, null, bookingId);

        Assert.Equal("Booking type", Assert.Single(types).Name);
    }
}
