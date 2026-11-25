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

    private static readonly ConversationKey CourierConversation = new(CourierId, OtherMessagePartyType.Courier);
    private static readonly ConversationKey StaffConversation = new(OtherStaffId, OtherMessagePartyType.Staff);

    [Fact]
    public async Task ArchiveConversationsAsync_HidesReadConversations_AndListsThemUnderArchived()
    {
        await SeedAsync(
            Message(Now.AddHours(-3), "courier", fromCourier: CourierId, toStaff: StaffId, read: true),
            Message(Now.AddHours(-2), "staff", fromStaff: StaffId, toStaff: OtherStaffId),
            Message(Now.AddHours(-1), "keep", fromStaff: StaffId, toCourier: SecondCourierId));
        var repository = CreateRepository();

        var archived = await repository.ArchiveConversationsAsync([CourierConversation, StaffConversation]);

        Assert.Equal(2, archived);
        Assert.Equal([SecondCourierId], (await repository.GetRecentListAsync()).Select(c => c.OtherPartyId));
        Assert.Equal([OtherStaffId, CourierId], (await repository.GetRecentListAsync(archived: true)).Select(c => c.OtherPartyId));
    }

    [Fact]
    public async Task ArchiveConversationsAsync_NewMessageAfterArchiving_BringsTheConversationBack()
    {
        await SeedAsync(Message(Now.AddHours(-2), "old", fromStaff: StaffId, toCourier: CourierId));
        await CreateRepository().ArchiveConversationsAsync([CourierConversation]);

        await using (var context = _db.CreateContext())
        {
            context.TucManualMessages.Add(Message(Now.AddHours(-1), "new", fromCourier: CourierId, toStaff: StaffId));
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();
        var conversation = Assert.Single(await repository.GetRecentListAsync());
        Assert.Equal(("new", 1), (conversation.LastMessage, conversation.UnreadCount));
        Assert.Empty(await repository.GetRecentListAsync(archived: true));
    }

    [Fact]
    public async Task ArchiveConversationsAsync_SkipsConversationsWithUnreadIncomingMessages()
    {
        await SeedAsync(
            Message(Now.AddHours(-2), "unread", fromCourier: CourierId, toStaff: StaffId),
            Message(Now.AddHours(-1), "read", fromStaff: OtherStaffId, toStaff: StaffId, read: true));
        var repository = CreateRepository();

        var archived = await repository.ArchiveConversationsAsync([CourierConversation, StaffConversation]);

        Assert.Equal(1, archived);
        Assert.Equal([CourierId], (await repository.GetRecentListAsync()).Select(c => c.OtherPartyId));
    }

    [Fact]
    public async Task ArchiveConversationsAsync_RepeatedArchive_KeepsOneRowPerConversation()
    {
        await SeedAsync(Message(Now.AddHours(-1), "hi", fromStaff: StaffId, toCourier: CourierId));
        var repository = CreateRepository();

        await repository.ArchiveConversationsAsync([CourierConversation]);
        var second = await repository.ArchiveConversationsAsync([CourierConversation, CourierConversation]);

        Assert.Equal(1, second);
        await using var context = _db.CreateContext();
        var row = Assert.Single(context.StaffConversationArchives);
        Assert.Equal((StaffId, (byte)OtherMessagePartyType.Courier, CourierId),
            (row.StaffId, row.OtherPartyType, row.OtherPartyId));
    }

    [Fact]
    public async Task UnarchiveConversationsAsync_PutsTheConversationBackInTheList()
    {
        await SeedAsync(Message(Now.AddHours(-1), "hi", fromStaff: StaffId, toCourier: CourierId));
        var repository = CreateRepository();
        await repository.ArchiveConversationsAsync([CourierConversation]);

        await repository.UnarchiveConversationsAsync([CourierConversation]);

        Assert.Single(await repository.GetRecentListAsync());
        Assert.Empty(await repository.GetRecentListAsync(archived: true));
    }

    [Fact]
    public async Task ArchiveConversationsAsync_OnlyHidesTheConversationForTheCurrentStaffMember()
    {
        await SeedAsync(
            Message(Now.AddHours(-2), "mine", fromStaff: StaffId, toCourier: CourierId),
            Message(Now.AddHours(-1), "theirs", fromStaff: OtherStaffId, toCourier: CourierId));
        await CreateRepository().ArchiveConversationsAsync([CourierConversation]);

        _infoService.GetStaffId().Returns(OtherStaffId);

        Assert.Equal([CourierId], (await CreateRepository().GetRecentListAsync()).Select(c => c.OtherPartyId));
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

    [Fact]
    public void ConversationStatsQuery_TranslatesToOneGroupedStatementOnSqlServer()
    {
        var options = new DbContextOptionsBuilder<DespatchContext>()
            .UseSqlServer("Server=unused;Database=unused")
            .Options;
        using var context = new DespatchContext(options);

        var sql = MessageRepository.ConversationStatsQuery(
                MessageRepository.PartnerMessages(context.TucManualMessages, StaffId, Now.AddDays(-90)))
            .ToQueryString();

        Assert.Contains("GROUP BY", sql, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("MAX(", sql, StringComparison.OrdinalIgnoreCase);
    }
}
