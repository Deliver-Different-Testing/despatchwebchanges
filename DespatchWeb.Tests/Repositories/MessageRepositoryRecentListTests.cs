using DespatchWeb.EntityClasses;
using DespatchWeb.Interfaces;
using DespatchWeb.Models.MessageModels;
using DespatchWeb.Repositories;
using DespatchWeb.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using NSubstitute;

namespace DespatchWeb.Tests.Repositories;

public sealed class MessageRepositoryRecentListTests : IAsyncDisposable
{
    private const int StaffId = 10;
    private const int CourierId = 20;
    private const int OtherStaffId = 30;
    private const int SecondCourierId = 21;
    private static readonly DateTime Now = new(2024, 1, 15, 10, 0, 0);

    private readonly SqliteTestDatabase _db = new();
    private readonly MemoryCache _cache = new(new MemoryCacheOptions());
    private readonly ITenantInfoService _infoService = Substitute.For<ITenantInfoService>();
    private readonly ITenantClock _clock = new FakeTenantClock(Now);

    public MessageRepositoryRecentListTests()
    {
        _infoService.GetStaffId().Returns(StaffId);
    }

    public async ValueTask DisposeAsync()
    {
        _cache.Dispose();
        await _db.DisposeAsync();
    }

    private MessageRepository CreateRepository() => new(
        _db.CreateFactoryMock(),
        _infoService,
        _clock,
        new MessageHelperService(_clock),
        _cache);

    private static TucCourier Courier(int id, string first, string last) => new()
    {
        UccrId = id, Code = $"C{id}", UccrName = first, UccrSurname = last,
        UccrEmail = $"{id}@t.com", UccrMobile = id.ToString(),
        Created = TestDates.Now, CreatedBy = "T", LastModified = TestDates.Now, LastModifiedBy = "T"
    };

    private static TucStaff Staff(int id, string first, string last) => new()
    {
        UcstId = id, UcstFirstName = first, UcstLastName = last,
        Created = TestDates.Now, CreatedBy = "T", LastModified = TestDates.Now, LastModifiedBy = "T"
    };

    private static int _nextMessageId = 1;

    private static TucManualMessage Message(DateTime date, string text, int? fromStaff = null, int? toStaff = null,
        int? fromCourier = null, int? toCourier = null, bool read = false) => new()
    {
        UcmmId = Interlocked.Increment(ref _nextMessageId), UcmmMessage = text, UcmmDate = date,
        UcmmSendFromStaffId = fromStaff, UcmmSendToStaffId = toStaff,
        UcmmSendFromCourierId = fromCourier, UcmmSendToCourierId = toCourier,
        Read = read
    };

    private async Task SeedAsync(params TucManualMessage[] messages)
    {
        await using var context = _db.CreateContext();
        context.TucCouriers.AddRange(Courier(CourierId, "Cara", "Courier"), Courier(SecondCourierId, "Dan", "Driver"));
        context.TucStaffs.AddRange(Staff(StaffId, "Me", "Myself"), Staff(OtherStaffId, "Sam", "Staff"));
        context.TucManualMessages.AddRange(messages);
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task GetRecentListAsync_OneRowPerPartner_WithLatestMessageAndPartnerDetails_NewestFirst()
    {
        await SeedAsync(
            Message(Now.AddHours(-3), "to courier", fromStaff: StaffId, toCourier: CourierId),
            Message(Now.AddHours(-2), "courier reply", fromCourier: CourierId, toStaff: StaffId),
            Message(Now.AddHours(-1), "from staff", fromStaff: OtherStaffId, toStaff: StaffId),
            Message(Now.AddMinutes(-90), "to staff", fromStaff: StaffId, toStaff: OtherStaffId));

        var result = await CreateRepository().GetRecentListAsync();

        Assert.Collection(result,
            staff =>
            {
                Assert.Equal((OtherStaffId, OtherMessagePartyType.Staff), (staff.OtherPartyId, staff.OtherPartyType));
                Assert.Equal(("Sam Staff", "SS", "offline"), (staff.OtherPartyName, staff.OtherPartyInitials, staff.OtherPartyStatus));
                Assert.Equal(("from staff", Now.AddHours(-1)), (staff.LastMessage, staff.LastMessageTime));
            },
            courier =>
            {
                Assert.Equal((CourierId, OtherMessagePartyType.Courier), (courier.OtherPartyId, courier.OtherPartyType));
                Assert.Equal(("Cara Courier", "CC", "offline"), (courier.OtherPartyName, courier.OtherPartyInitials, courier.OtherPartyStatus));
                Assert.Equal(("courier reply", Now.AddHours(-2)), (courier.LastMessage, courier.LastMessageTime));
            });
    }

    [Fact]
    public async Task GetRecentListAsync_UnreadCountsOnlyIncomingUnreadMessages()
    {
        await SeedAsync(
            Message(Now.AddHours(-4), "in read", fromCourier: CourierId, toStaff: StaffId, read: true),
            Message(Now.AddHours(-3), "in unread 1", fromCourier: CourierId, toStaff: StaffId),
            Message(Now.AddHours(-2), "in unread 2", fromCourier: CourierId, toStaff: StaffId),
            Message(Now.AddHours(-1), "out unread", fromStaff: StaffId, toCourier: CourierId));

        var conversation = Assert.Single(await CreateRepository().GetRecentListAsync());

        Assert.Equal(2, conversation.UnreadCount);
        Assert.Equal("out unread", conversation.LastMessage);
    }

    [Fact]
    public async Task GetRecentListAsync_ExcludesMessagesOlderThanNinetyDaysAndOtherStaffsConversations()
    {
        await SeedAsync(
            Message(Now.AddDays(-91), "too old", fromCourier: SecondCourierId, toStaff: StaffId),
            Message(Now.AddHours(-1), "not mine", fromCourier: CourierId, toStaff: OtherStaffId),
            Message(Now.AddHours(-1), "mine", fromCourier: CourierId, toStaff: StaffId));

        var conversation = Assert.Single(await CreateRepository().GetRecentListAsync());

        Assert.Equal(CourierId, conversation.OtherPartyId);
        Assert.Equal("mine", conversation.LastMessage);
    }

    [Fact]
    public async Task GetRecentListAsync_PartnerWithMissingCourierRow_StillListedAsUnknown()
    {
        const int deletedCourierId = 99;
        await SeedAsync(Message(Now.AddHours(-1), "ghost", fromCourier: deletedCourierId, toStaff: StaffId));

        var conversation = Assert.Single(await CreateRepository().GetRecentListAsync());

        Assert.Equal((deletedCourierId, OtherMessagePartyType.Courier), (conversation.OtherPartyId, conversation.OtherPartyType));
        Assert.Equal(("Unknown", "??", "offline"), (conversation.OtherPartyName, conversation.OtherPartyInitials, conversation.OtherPartyStatus));
    }

    [Fact]
    public async Task GetRecentListAsync_BusyConversationDoesNotHideOlderPartnersOrUndercountUnread()
    {
        var busy = Enumerable.Range(0, 1001)
            .Select(i => Message(Now.AddMinutes(-i - 1), $"busy {i}", fromCourier: CourierId, toStaff: StaffId));
        var quiet = Message(Now.AddDays(-30), "quiet", fromCourier: SecondCourierId, toStaff: StaffId);
        await SeedAsync([.. busy, quiet]);

        var result = await CreateRepository().GetRecentListAsync();

        Assert.Equal([CourierId, SecondCourierId], result.Select(c => c.OtherPartyId));
        Assert.Equal(1001, result[0].UnreadCount);
    }

    [Fact]
    public void LatestMessagePerPartner_TranslatesToAWindowedStatementOnSqlServer()
    {
        var options = new DbContextOptionsBuilder<DespatchContext>()
            .UseSqlServer("Server=unused;Database=unused")
            .Options;
        using var context = new DespatchContext(options);

        var sql = MessageRepository.LatestMessagePerPartner(
                MessageRepository.PartnerMessages(context.TucManualMessages, StaffId, Now.AddDays(-90)))
            .ToQueryString();

        Assert.Contains("ROW_NUMBER", sql, StringComparison.OrdinalIgnoreCase);
    }
}
