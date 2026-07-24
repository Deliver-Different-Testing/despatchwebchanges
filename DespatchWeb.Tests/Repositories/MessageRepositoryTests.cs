using DespatchWeb.EntityClasses;
using DespatchWeb.Interfaces;
using DespatchWeb.Repositories;
using DespatchWeb.Tests.Helpers;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using NSubstitute;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// Tests for MessageRepository conversation ordering — GetMessagesByCourierIdAsync
/// and GetMessagesByStaffIdAsync. Uses SQLite in-memory database.
///
/// Regression guard for the "messages re-shuffle a few seconds after send" bug:
/// the projected MessageTime must be the stable creation/received time (UcmmDate),
/// NOT the asynchronously-stamped transmission time (UcmmTimeSent), so the client
/// re-sort cannot reorder messages once the delivery worker stamps UcmmTimeSent.
/// </summary>
public sealed class MessageRepositoryTests : IAsyncDisposable
{
    private const int StaffId = 10;
    private const int CourierId = 20;
    private const int OtherStaffId = 30;

    private readonly SqliteTestDatabase _db = new();
    private readonly MemoryCache _cache = new(new MemoryCacheOptions());
    private readonly IDbContextFactory<DespatchContext> _contextFactoryMock;
    private readonly ITenantInfoService _infoServiceMock = Substitute.For<ITenantInfoService>();
    private readonly ITenantClock _clock = new FakeTenantClock(new DateTime(2024, 1, 15, 10, 0, 0));
    private readonly IMessageHelperService _messageHelperMock = Substitute.For<IMessageHelperService>();

    public MessageRepositoryTests()
    {
        _contextFactoryMock = _db.CreateFactoryMock();
    }

    public async ValueTask DisposeAsync()
    {
        _cache.Dispose();
        await _db.DisposeAsync();
    }

    private MessageRepository CreateRepository() => new(
        _contextFactoryMock,
        _infoServiceMock,
        _clock,
        _messageHelperMock,
        _cache
    );

    private DespatchContext CreateContext() => _db.CreateContext();

    /// <summary>
    /// Seeds an interleaved staff↔courier conversation in received order
    /// (msg 1..4 by UcmmDate) where the outgoing staff messages have a
    /// transmission timestamp (UcmmTimeSent) stamped LATER and out of creation
    /// order — simulating the delivery worker's batched send.
    /// </summary>
    private async Task SeedStaffCourierConversationAsync()
    {
        await using var context = CreateContext();

        context.TucManualMessages.AddRange(
            // 1 — staff → courier (outgoing), transmitted late
            new TucManualMessage
            {
                UcmmId = 1, UcmmMessage = "staff-first",
                UcmmDate = new DateTime(2024, 1, 15, 10, 0, 0),
                UcmmTimeSent = new DateTime(2024, 1, 15, 10, 5, 0), UcmmSent = true,
                UcmmSendFromStaffId = StaffId, UcmmSendToCourierId = CourierId
            },
            // 2 — courier → staff (incoming), never stamped with a send time
            new TucManualMessage
            {
                UcmmId = 2, UcmmMessage = "courier-reply",
                UcmmDate = new DateTime(2024, 1, 15, 10, 1, 0),
                UcmmTimeSent = null, UcmmSent = false,
                UcmmSendFromCourierId = CourierId, UcmmSendToStaffId = StaffId
            },
            // 3 — staff → courier (outgoing), transmitted late (after msg 1)
            new TucManualMessage
            {
                UcmmId = 3, UcmmMessage = "staff-second",
                UcmmDate = new DateTime(2024, 1, 15, 10, 2, 0),
                UcmmTimeSent = new DateTime(2024, 1, 15, 10, 5, 30), UcmmSent = true,
                UcmmSendFromStaffId = StaffId, UcmmSendToCourierId = CourierId
            },
            // 4 — courier → staff (incoming)
            new TucManualMessage
            {
                UcmmId = 4, UcmmMessage = "courier-reply-2",
                UcmmDate = new DateTime(2024, 1, 15, 10, 3, 0),
                UcmmTimeSent = null, UcmmSent = false,
                UcmmSendFromCourierId = CourierId, UcmmSendToStaffId = StaffId
            }
        );

        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task GetMessagesByCourierIdAsync_ReturnsMessagesInReceivedOrder()
    {
        await SeedStaffCourierConversationAsync();
        var repository = CreateRepository();

        var result = await repository.GetMessagesByCourierIdAsync(CourierId, StaffId);

        Assert.Equal([1, 2, 3, 4], result.Select(m => m.MessageId));
    }

    [Fact]
    public async Task GetMessagesByCourierIdAsync_MessageTimeIsCreationTimeNotTransmissionTime()
    {
        await SeedStaffCourierConversationAsync();
        var repository = CreateRepository();

        var result = await repository.GetMessagesByCourierIdAsync(CourierId, StaffId);

        // MessageTime must equal UcmmDate (stable received time), never the later
        // UcmmTimeSent — otherwise the client re-sort reorders once the worker stamps it.
        Assert.Equal(new DateTime(2024, 1, 15, 10, 0, 0), result.Single(m => m.MessageId == 1).MessageTime);
        Assert.Equal(new DateTime(2024, 1, 15, 10, 2, 0), result.Single(m => m.MessageId == 3).MessageTime);
        Assert.Equal(new DateTime(2024, 1, 15, 10, 1, 0), result.Single(m => m.MessageId == 2).MessageTime);
    }

    [Fact]
    public async Task GetMessagesByCourierIdAsync_SameTimestamp_OrdersByMessageId()
    {
        await using (var context = CreateContext())
        {
            var sameTime = new DateTime(2024, 1, 15, 10, 0, 0);
            context.TucManualMessages.AddRange(
                new TucManualMessage
                {
                    UcmmId = 2, UcmmMessage = "second", UcmmDate = sameTime,
                    UcmmSendFromCourierId = CourierId, UcmmSendToStaffId = StaffId
                },
                new TucManualMessage
                {
                    UcmmId = 1, UcmmMessage = "first", UcmmDate = sameTime,
                    UcmmSendFromStaffId = StaffId, UcmmSendToCourierId = CourierId
                }
            );
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        var result = await repository.GetMessagesByCourierIdAsync(CourierId, StaffId);

        Assert.Equal([1, 2], result.Select(m => m.MessageId));
    }

    [Fact]
    public async Task GetMessagesByStaffIdAsync_MessageTimeIsCreationTimeNotTransmissionTime()
    {
        await using (var context = CreateContext())
        {
            context.TucManualMessages.AddRange(
                new TucManualMessage
                {
                    UcmmId = 1, UcmmMessage = "outgoing",
                    UcmmDate = new DateTime(2024, 1, 15, 10, 0, 0),
                    UcmmTimeSent = new DateTime(2024, 1, 15, 10, 9, 0), UcmmSent = true,
                    UcmmSendFromStaffId = StaffId, UcmmSendToStaffId = OtherStaffId
                },
                new TucManualMessage
                {
                    UcmmId = 2, UcmmMessage = "incoming",
                    UcmmDate = new DateTime(2024, 1, 15, 10, 1, 0),
                    UcmmTimeSent = null, UcmmSent = false,
                    UcmmSendFromStaffId = OtherStaffId, UcmmSendToStaffId = StaffId
                }
            );
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        var result = await repository.GetMessagesByStaffIdAsync(OtherStaffId, StaffId);

        Assert.Equal([1, 2], result.Select(m => m.MessageId));
        Assert.Equal(new DateTime(2024, 1, 15, 10, 0, 0), result.Single(m => m.MessageId == 1).MessageTime);
    }
}
