using DespatchWeb.EntityClasses;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Repositories;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace DespatchWeb.Tests.Repositories;

public class RecurringJobRepositoryPackagesTests : IAsyncDisposable
{
    private const int BookingId = 100;

    private readonly DespatchContext _context;
    private readonly SqliteTestDatabase _db = new();
    private readonly RecurringJobRepository _repository;

    public RecurringJobRepositoryPackagesTests()
    {
        _context = _db.CreateContext();
        _repository = new RecurringJobRepository(
            SqliteTestDatabase.CreateFactoryMock(_context),
            Substitute.For<ITenantInfoService>(),
            new FakeTenantClock(TestDates.Now),
            Substitute.For<IClearListEnvelopeService>());
    }

    public async ValueTask DisposeAsync()
    {
        GC.SuppressFinalize(this);
        await _context.DisposeAsync();
        await _db.DisposeAsync();
    }

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task UpdatePackagesForBookingAsync_ReducesTwoParcelsToOne_UpdatingTheKeptRowInPlace()
    {
        _context.TucJobBookings.Add(Booking(BookingId));
        _context.TucJobBookingItems.AddRange(Item(BookingId, 1, weight: 5), Item(BookingId, 2, weight: 5));
        await _context.SaveChangesAsync(Ct);

        await _repository.UpdatePackagesForBookingAsync(BookingId,
            [new ParcelDimensions { ItemId = 1, ItemName = "Box", Weight = 3, Length = 10, Height = 20, Depth = 30, Cubic = 0.006m }],
            calculateDimsOncePerJob: null);

        _context.ChangeTracker.Clear();
        var item = Assert.Single(await _context.TucJobBookingItems.Where(i => i.BookingId == BookingId).ToListAsync(Ct));
        Assert.Equal(1, item.ItemId);
        Assert.Equal(1, item.Items);
        Assert.Equal(3, item.Weight);
        Assert.Equal("Box", item.Notes);
        Assert.Equal(10, item.Length);
        Assert.Equal(20, item.Height);
        Assert.Equal(30, item.Depth);
        Assert.Equal(0.006m, item.Cubic);
    }

    [Fact]
    public async Task UpdatePackagesForBookingAsync_NewParcelWithoutItemId_IsAddedAfterTheHighestItemId()
    {
        _context.TucJobBookings.Add(Booking(BookingId));
        _context.TucJobBookingItems.Add(Item(BookingId, 4, weight: 5));
        await _context.SaveChangesAsync(Ct);

        await _repository.UpdatePackagesForBookingAsync(BookingId,
            [new ParcelDimensions { ItemId = 4, Weight = 5 }, new ParcelDimensions { Weight = 2, Barcode = "B1" }],
            calculateDimsOncePerJob: null);

        _context.ChangeTracker.Clear();
        var items = await _context.TucJobBookingItems.Where(i => i.BookingId == BookingId).OrderBy(i => i.ItemId).ToListAsync(Ct);
        Assert.Equal([4, 5], items.Select(i => i.ItemId));
        Assert.Equal(2, items[1].Weight);
        Assert.Equal(1, items[1].Items);
        Assert.Equal("B1", items[1].Barcode);
    }

    [Fact]
    public async Task UpdatePackagesForBookingAsync_RemovedItem_DropsItsItemTypes_KeptItemKeepsTheirs()
    {
        _context.TucItemTypes.Add(new TucItemType { ItemTypeId = 7, Name = "Tyre", CreatedBy = "t", LastModifiedBy = "t" });
        _context.TucJobBookings.Add(Booking(BookingId));
        _context.TucJobBookingItems.AddRange(Item(BookingId, 1, weight: 5), Item(BookingId, 2, weight: 5));
        _context.TucJobBookingItemTypes.AddRange(
            new TucJobBookingItemType { BookingId = BookingId, ItemId = 1, ItemTypeId = 7, Quantity = 1 },
            new TucJobBookingItemType { BookingId = BookingId, ItemId = 2, ItemTypeId = 7, Quantity = 1 });
        await _context.SaveChangesAsync(Ct);

        await _repository.UpdatePackagesForBookingAsync(BookingId,
            [new ParcelDimensions { ItemId = 1, Weight = 5 }], calculateDimsOncePerJob: null);

        _context.ChangeTracker.Clear();
        var types = await _context.TucJobBookingItemTypes.Where(t => t.BookingId == BookingId).ToListAsync(Ct);
        Assert.Equal(1, Assert.Single(types).ItemId);
    }

    [Fact]
    public async Task UpdatePackagesForBookingAsync_ChildBooking_WritesTheParentBookingsItems()
    {
        _context.TucJobBookings.AddRange(Booking(BookingId), Booking(101, bookingParentId: BookingId));
        _context.TucJobBookingItems.Add(Item(BookingId, 1, weight: 5));
        await _context.SaveChangesAsync(Ct);

        await _repository.UpdatePackagesForBookingAsync(101,
            [new ParcelDimensions { ItemId = 1, Weight = 9 }], calculateDimsOncePerJob: null);

        _context.ChangeTracker.Clear();
        Assert.Equal(9, (await _context.TucJobBookingItems.SingleAsync(i => i.BookingId == BookingId, Ct)).Weight);
        Assert.False(await _context.TucJobBookingItems.AnyAsync(i => i.BookingId == 101, Ct));
    }

    [Fact]
    public async Task UpdatePackagesForBookingAsync_LiveJobWithTheSameId_IsLeftUntouched()
    {
        _context.TucJobBookings.Add(Booking(BookingId));
        _context.TucJobBookingItems.Add(Item(BookingId, 1, weight: 5));
        _context.TucJobs.Add(new TucJob { UcjbId = BookingId, UcjbNumber = "LIVE100", UcjbWeight = 40 });
        _context.TucJobItems.AddRange(
            new TucJobItem { JobId = BookingId, ItemId = 1, Items = 1, Weight = 20 },
            new TucJobItem { JobId = BookingId, ItemId = 2, Items = 1, Weight = 20 });
        await _context.SaveChangesAsync(Ct);

        await _repository.UpdatePackagesForBookingAsync(BookingId,
            [new ParcelDimensions { ItemId = 1, Weight = 1 }], calculateDimsOncePerJob: null);

        _context.ChangeTracker.Clear();
        var liveItems = await _context.TucJobItems.Where(i => i.JobId == BookingId).ToListAsync(Ct);
        Assert.Equal(2, liveItems.Count);
        Assert.All(liveItems, i => Assert.Equal(20, i.Weight));
        Assert.Equal(40, (await _context.TucJobs.SingleAsync(j => j.UcjbId == BookingId, Ct)).UcjbWeight);
    }

    [Theory]
    [InlineData(true, 2)]
    [InlineData(false, null)]
    public async Task UpdatePackagesForBookingAsync_CalculateDimsOncePerJob_SetsDimensionsTypeOnTheFamily(
        bool perJob, int? expected)
    {
        _context.TucJobBookings.AddRange(
            Booking(BookingId, dimensionsType: perJob ? null : 2),
            Booking(101, bookingParentId: BookingId, dimensionsType: perJob ? null : 2),
            Booking(200, dimensionsType: 5));
        await _context.SaveChangesAsync(Ct);

        await _repository.UpdatePackagesForBookingAsync(BookingId,
            [new ParcelDimensions { Weight = 1 }], calculateDimsOncePerJob: perJob);

        _context.ChangeTracker.Clear();
        var types = await _context.TucJobBookings.OrderBy(b => b.UcbkId).Select(b => b.DimensionsType).ToListAsync(Ct);
        Assert.Equal([expected, expected, 5], types);
    }

    [Fact]
    public async Task UpdatePackagesForBookingAsync_ChangedPackages_WritesABookingNoteNamingThem()
    {
        _context.TucJobBookings.Add(Booking(BookingId));
        _context.TucJobBookingItems.Add(Item(BookingId, 1, weight: 5));
        await _context.SaveChangesAsync(Ct);

        await _repository.UpdatePackagesForBookingAsync(BookingId,
            [new ParcelDimensions { ItemId = 1, ItemName = "Banana box", Weight = 8, Length = 53, Depth = 39, Height = 24 }],
            calculateDimsOncePerJob: null);

        _context.ChangeTracker.Clear();
        var note = await _context.TucNotes.SingleAsync(n => n.JobBookingId == BookingId, Ct);
        Assert.Equal("Packages updated from 1 × Item, 5 kg to 1 × Banana box 53 x 39 x 24 cm, 8 kg", note.NoteText);
    }

    [Fact]
    public async Task UpdatePackagesForBookingAsync_UnchangedPackages_WritesNoNote()
    {
        _context.TucJobBookings.Add(Booking(BookingId));
        _context.TucJobBookingItems.Add(Item(BookingId, 1, weight: 5));
        await _context.SaveChangesAsync(Ct);

        await _repository.UpdatePackagesForBookingAsync(BookingId,
            [new ParcelDimensions { ItemId = 1, Weight = 5 }], calculateDimsOncePerJob: null);

        _context.ChangeTracker.Clear();
        Assert.False(await _context.TucNotes.AnyAsync(n => n.JobBookingId == BookingId, Ct));
    }

    [Fact]
    public async Task UpdatePackagesForBookingAsync_UnknownBooking_Throws()
    {
        await Assert.ThrowsAsync<ArgumentException>(() =>
            _repository.UpdatePackagesForBookingAsync(999, [new ParcelDimensions { Weight = 1 }], null));
    }

    private static TucJobBooking Booking(int id, int? bookingParentId = null, int? dimensionsType = null) => new()
    {
        UcbkId = id,
        UcbkJobNumber = $"JOB{id}",
        BookingParentId = bookingParentId,
        DimensionsType = dimensionsType,
        UcbkAttention = false
    };

    private static TucJobBookingItem Item(int bookingId, int itemId, double weight) => new()
    {
        BookingId = bookingId,
        ItemId = itemId,
        Items = 1,
        Weight = weight
    };
}
