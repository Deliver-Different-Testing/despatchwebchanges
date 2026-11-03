using DespatchWeb.Enums;
using DespatchWeb.Helpers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Services;
using NSubstitute;
using NSubstitute.ExceptionExtensions;

namespace DespatchWeb.Tests.Services;

public class ComplianceReminderServiceTests
{
    private readonly ICourierRepository _couriers = Substitute.For<ICourierRepository>();
    private readonly IMessageRepository _messages = Substitute.For<IMessageRepository>();

    private ComplianceReminderService CreateService() => new(_couriers, _messages);

    private static ComplianceAttentionItem Item(string label, DateTime? expiry, int? days, ComplianceStatus status) =>
        new() { TypeLabel = label, Expiry = expiry, DaysUntilExpiry = days, Status = status };

    private static DriverComplianceAttention Driver(int id, string name, params ComplianceAttentionItem[] items) =>
        new() { CourierId = id, FirstName = name, Name = name, Items = items };

    [Fact]
    public void Compose_ListsExpiredThenExpiringThenNotSet_WithDatesAndDays()
    {
        var driver = Driver(1, "Aroha",
            Item("Registration", null, null, ComplianceStatus.NotSet),
            Item("WOF", new DateTime(2026, 11, 15), 12, ComplianceStatus.ExpiringSoon),
            Item("Driver licence", new DateTime(2026, 11, 2), -1, ComplianceStatus.Expired));

        var message = ComplianceReminderService.Compose(driver);

        Assert.Equal(
            "Hi Aroha, these need renewing: Driver licence expired 2 Nov 2026. WOF expires 15 Nov 2026 (12 days). " +
            "Registration: no expiry date on file. Please update the office.",
            message);
    }

    [Theory]
    [InlineData(0, "today")]
    [InlineData(1, "1 day")]
    public void Compose_ExpiringSoonDayPhrases(int days, string phrase)
    {
        var driver = Driver(1, "Ben", Item("WOF", new DateTime(2026, 11, 3), days, ComplianceStatus.ExpiringSoon));

        Assert.Contains($"WOF expires 3 Nov 2026 ({phrase}).", ComplianceReminderService.Compose(driver));
    }

    private void Returns(params DriverComplianceAttention[] drivers) =>
        _couriers.GetComplianceAttentionAsync(Arg.Any<IReadOnlyCollection<int>>(), Arg.Any<CourierComplianceFilterRequest>())
            .Returns(drivers);

    private static readonly ComplianceAttentionItem Wof =
        Item("WOF", new DateTime(2026, 11, 15), 12, ComplianceStatus.ExpiringSoon);

    [Fact]
    public async Task SendAsync_SendsOneMessagePerDriverAndCountsNothingDueAndUnknownIds()
    {
        Returns(Driver(1, "Aroha", Wof), Driver(2, "Ben"));

        var result = await CreateService().SendAsync(new SendComplianceRemindersRequest
        {
            CourierIds = [1, 2, 3],
            Channel = MessageDeliveryType.Sms
        });

        Assert.Equal((1, 1, 1, 1), (result.Recipients, result.Sent, result.NothingDue, result.Failed));
        Assert.Equal(new ComplianceReminderFailure(3, "", "Not an active driver"), Assert.Single(result.Failures));
        Assert.Equal(200, result.MaxRecipients);
        await _messages.Received(1).SendMessageAsync(Arg.Is<SendMessageRequest>(r =>
            r.SendToCourierId == 1 && r.MessageType == 2 && r.Message.StartsWith("Hi Aroha,")));
    }

    [Fact]
    public async Task SendAsync_Preview_SendsNothingAndNeverHitsTheCap()
    {
        Returns([.. Enumerable.Range(1, 250).Select(i => Driver(i, "D", Wof)), Driver(999, "None")]);

        var result = await CreateService().SendAsync(new SendComplianceRemindersRequest
        {
            Filter = new ComplianceReminderFilter(), Channel = MessageDeliveryType.Sms, Preview = true
        });

        Assert.Equal((250, 0, 1, 0, 200), (result.Recipients, result.Sent, result.NothingDue, result.Failed, result.MaxRecipients));
        await _messages.DidNotReceiveWithAnyArgs().SendMessageAsync(null!);
    }

    [Fact]
    public async Task SendAsync_OverCap_ThrowsAndSendsNothing()
    {
        Returns([.. Enumerable.Range(1, 201).Select(i => Driver(i, "D", Wof))]);

        var ex = await Assert.ThrowsAsync<InvalidListQueryException>(() => CreateService().SendAsync(
            new SendComplianceRemindersRequest { Filter = new ComplianceReminderFilter(), Channel = MessageDeliveryType.App }));

        Assert.Equal("That's 201 drivers. Narrow the filters to 200 or fewer.", ex.Message);
        await _messages.DidNotReceiveWithAnyArgs().SendMessageAsync(null!);
    }

    [Fact]
    public async Task SendAsync_FilterTarget_PassesFilterToRepository()
    {
        Returns();

        await CreateService().SendAsync(new SendComplianceRemindersRequest
        {
            Filter = new ComplianceReminderFilter { SearchTerm = "ar", Fleet = 2, Type = "wof", Status = "attention" },
            Channel = MessageDeliveryType.App
        });

        await _couriers.Received(1).GetComplianceAttentionAsync(null!,
            Arg.Is<CourierComplianceFilterRequest>(f =>
                f.SearchTerm == "ar" && f.Fleet == 2 && f.Type == "wof" && f.Status == "attention"));
    }

    [Fact]
    public async Task SendAsync_AnyFailureIsIsolatedRecordedWithReasonAndLaterDriversStillSend()
    {
        Returns(Driver(1, "Aroha", Wof), Driver(2, "Ben", Wof), Driver(3, "Cy", Wof));
        _messages.SendMessageAsync(Arg.Is<SendMessageRequest>(r => r.SendToCourierId == 1))
            .ThrowsAsync(new ArgumentException("Courier A01 must have a mobile number to send SMS"));
        _messages.SendMessageAsync(Arg.Is<SendMessageRequest>(r => r.SendToCourierId == 2))
            .ThrowsAsync(new InvalidOperationException("db down"));

        var result = await CreateService().SendAsync(new SendComplianceRemindersRequest
        {
            CourierIds = [1, 2, 3],
            Channel = MessageDeliveryType.Sms
        });

        Assert.Equal((3, 1, 2), (result.Recipients, result.Sent, result.Failed));
        Assert.Equal(["No mobile number", "Couldn't send"], result.Failures.Select(f => f.Reason));
        Assert.Equal(["Aroha", "Ben"], result.Failures.Select(f => f.Name));
    }

    [Fact]
    public async Task SendAsync_BothOrNeitherTarget_Throws()
    {
        var service = CreateService();

        await Assert.ThrowsAsync<InvalidListQueryException>(() =>
            service.SendAsync(new SendComplianceRemindersRequest { Channel = MessageDeliveryType.App }));
        await Assert.ThrowsAsync<InvalidListQueryException>(() =>
            service.SendAsync(new SendComplianceRemindersRequest
            {
                CourierIds = [1], Filter = new ComplianceReminderFilter(), Channel = MessageDeliveryType.App
            }));
        await _messages.DidNotReceiveWithAnyArgs().SendMessageAsync(null!);
    }

    [Fact]
    public async Task SendAsync_UndefinedChannel_Throws()
    {
        await Assert.ThrowsAsync<InvalidListQueryException>(() =>
            CreateService().SendAsync(new SendComplianceRemindersRequest { CourierIds = [1], Channel = 0 }));
    }
}
