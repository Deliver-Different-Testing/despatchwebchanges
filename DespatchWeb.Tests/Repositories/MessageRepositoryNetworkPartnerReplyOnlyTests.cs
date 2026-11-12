using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.MessageModels;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Repositories;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using NSubstitute;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// Network partners may only reply to staff who messaged them first (product decision 2026-11-13);
/// they can't search the tenant's staff directory. Staff are unaffected.
/// </summary>
public class MessageRepositoryNetworkPartnerReplyOnlyTests : IAsyncDisposable
{
    private const int NpStaffId = 5;
    private const int StaffWhoWrote = 9;
    private const int StaffWhoNeverWrote = 10;

    private readonly SqliteTestDatabase _db = new();
    private readonly ITenantInfoService _infoService = Substitute.For<ITenantInfoService>();

    public MessageRepositoryNetworkPartnerReplyOnlyTests()
    {
        _infoService.GetStaffId().Returns(NpStaffId);
        _infoService.GetTenantTimeZone().Returns("New Zealand Standard Time");
    }

    public async ValueTask DisposeAsync()
    {
        GC.SuppressFinalize(this);
        await _db.DisposeAsync();
    }

    private MessageRepository CreateRepository(ClientType clientType)
    {
        var provider = Substitute.For<IScopeProvider>();
        provider.Scope.Returns(new ScopeContext(ClientTypeId: (int)clientType, ClientId: null, NpAgentId: 77));
        var context = new DespatchContext(_db.Options, provider);
        return new MessageRepository(SqliteTestDatabase.CreateFactoryMock(context), _infoService,
            new FakeTenantClock(TestDates.Now), Substitute.For<IMessageHelperService>(),
            new MemoryCache(new MemoryCacheOptions()));
    }

    private async Task SeedAsync()
    {
        await using var seed = _db.CreateContext();
        seed.TucStaffs.AddRange(
            Staff(NpStaffId, "Nate"), Staff(StaffWhoWrote, "Wendy"), Staff(StaffWhoNeverWrote, "Nora"));
        seed.TucManualMessages.Add(new TucManualMessage
        {
            UcmmId = 1, UcmmSendFromStaffId = StaffWhoWrote, UcmmSendToStaffId = NpStaffId,
            UcmmMessage = "Can you take this one?", UcmmDate = TestDates.Now
        });
        await seed.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    private static TucStaff Staff(int id, string firstName) => new()
    {
        UcstId = id, UcstFirstName = firstName, UcstLastName = "Staff", UcstActive = true,
        CreatedBy = "t", LastModifiedBy = "t"
    };

    private async Task<int> MessagesToAsync(int staffId)
    {
        await using var check = _db.CreateContext();
        return await check.TucManualMessages.CountAsync(m => m.UcmmSendToStaffId == staffId,
            TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task SendMessageAsync_Np_CanReplyToStaffWhoMessagedIt()
    {
        await SeedAsync();

        await CreateRepository(ClientType.NetworkPartner).SendMessageAsync(
            new SendMessageRequest { SendToStaffId = StaffWhoWrote, Message = "On it" });

        Assert.Equal(1, await MessagesToAsync(StaffWhoWrote));
    }

    [Fact]
    public async Task SendMessageAsync_Np_CannotStartAConversationWithOtherStaff()
    {
        await SeedAsync();

        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            CreateRepository(ClientType.NetworkPartner).SendMessageAsync(
                new SendMessageRequest { SendToStaffId = StaffWhoNeverWrote, Message = "Hello" }));

        Assert.Equal(0, await MessagesToAsync(StaffWhoNeverWrote));
    }

    [Fact]
    public async Task SendMessageAsync_Tenant_CanMessageAnyStaff()
    {
        await SeedAsync();

        await CreateRepository(ClientType.Tenant).SendMessageAsync(
            new SendMessageRequest { SendToStaffId = StaffWhoNeverWrote, Message = "Hello" });

        Assert.Equal(1, await MessagesToAsync(StaffWhoNeverWrote));
    }

    [Fact]
    public async Task GetNewMessageContactOptionsAsync_Np_OffersNoStaff_TenantDoes()
    {
        await SeedAsync();

        var np = await CreateRepository(ClientType.NetworkPartner).GetNewMessageContactOptionsAsync("");
        var tenant = await CreateRepository(ClientType.Tenant).GetNewMessageContactOptionsAsync("");

        Assert.DoesNotContain(np, o => o.OtherMessagePartyType == OtherMessagePartyType.Staff);
        Assert.Contains(tenant, o => o.OtherMessagePartyType == OtherMessagePartyType.Staff);
    }
}
