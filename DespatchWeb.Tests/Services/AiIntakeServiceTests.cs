using System.Text.Json;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Services;
using JetBrains.Annotations;
using Microsoft.Extensions.Options;
using NSubstitute;

namespace DespatchWeb.Tests.Services;

[TestSubject(typeof(AiIntakeService))]
public class AiIntakeServiceTests
{
    private readonly IAiClientService _aiClient = Substitute.For<IAiClientService>();
    private readonly IClientRepository _clientRepository = Substitute.For<IClientRepository>();
    private readonly IJobQueryRepository _jobRepository = Substitute.For<IJobQueryRepository>();
    private readonly ICourierRepository _courierRepository = Substitute.For<ICourierRepository>();
    private readonly ITenantInfoService _tenantInfo = Substitute.For<ITenantInfoService>();

    private readonly IOptions<AnthropicSettings> _settings = Options.Create(new AnthropicSettings
    {
        Drafting = new AiModelProfile { Model = "claude-haiku-4-5", MaxTokens = 1024 },
        Judgment = new AiModelProfile { Model = "claude-sonnet-5", Effort = "low", MaxTokens = 2048 }
    });

    private string? _capturedSystemPrompt;
    private string? _capturedUserMessage;
    private string? _capturedForcedTool;
    private AiTaskClass _capturedTaskClass;

    public AiIntakeServiceTests()
    {
        _tenantInfo.IsUsTenant().Returns(false);
        _tenantInfo.GetCurrentTenantTime().Returns(new DateTime(2026, 9, 14, 9, 0, 0));
        _clientRepository.ActiveClientsAsync(Arg.Any<string>()).Returns([]);
        _jobRepository.GetSpeedsAsync().Returns([]);
        _courierRepository.GetVehicleSizesAsync().Returns([]);
        _courierRepository.AllActiveCouriersAsync(Arg.Any<string>(), Arg.Any<bool>(), Arg.Any<bool>()).Returns([]);
    }

    private AiIntakeService CreateService() => new(
        _aiClient, _clientRepository, _jobRepository, _courierRepository, _tenantInfo, _settings);

    private void StubToolResponse(string toolName, object payload)
    {
        var response = new AiClientResponse { InputTokens = 90, OutputTokens = 30 };
        response.ToolCalls.Add(new AiToolCall
        {
            ToolUseId = "tool_1",
            ToolName = toolName,
            ArgumentsJson = JsonSerializer.Serialize(
                payload, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase })
        });

        _aiClient.SendMessageAsync(
                Arg.Any<AiTaskClass>(), Arg.Any<string>(), Arg.Any<List<AiMessage>>(), Arg.Any<int>(),
                Arg.Any<List<AiToolDefinition>>(), Arg.Any<string>(), Arg.Any<bool>(), Arg.Any<bool>(),
                Arg.Any<CancellationToken>())
            .Returns(call =>
            {
                _capturedTaskClass = call.ArgAt<AiTaskClass>(0);
                _capturedSystemPrompt = call.ArgAt<string>(1);
                _capturedUserMessage = call.ArgAt<List<AiMessage>>(2)[0].Content;
                _capturedForcedTool = call.ArgAt<string>(5);
                return response;
            });
    }

    private static object FullIntakePayload() => new
    {
        pickupAddress = new
        {
            addressLine1 = "Acme Ltd", addressLine3 = "12",
            addressLine4 = "Queen Street", addressLine5 = "Newmarket"
        },
        deliveryAddress = new { addressLine3 = "8", addressLine4 = "Dock Road", addressLine5 = "Wiri" },
        clientText = "Acme Ltd",
        speedText = "urgent",
        vehicleText = "van",
        fromContactName = "Jo",
        deliverToContact = "Pat",
        podName = "",
        date = "2026-09-15",
        refA = "PO-8891",
        refB = "",
        pickupNotes = "",
        deliveryNotes = "Call before delivery",
        jobNotes = "",
        weight = 12.5,
        weightUnit = "kg",
        confidence = 0.8,
        unresolved = new[] { "No delivery suburb given" }
    };

    // ---- Job intake -------------------------------------------------------

    [Fact]
    public async Task ExtractJobIntakeAsync_EmptyText_ReturnsEmptyWithoutCallingAi()
    {
        var result = await CreateService().ExtractJobIntakeAsync(
            new ExtractJobIntakeRequest { Text = "   " }, TestContext.Current.CancellationToken);

        Assert.Equal(0, result.Confidence);
        Assert.Single(result.Unresolved);
        await _aiClient.DidNotReceiveWithAnyArgs().SendMessageAsync(
            default, null!, null!, 0, null, null, false, false, CancellationToken.None);
    }

    [Fact]
    public async Task ExtractJobIntakeAsync_MapsEveryFieldAndForcesTheTool()
    {
        StubToolResponse("emit_job_intake", FullIntakePayload());

        var result = await CreateService().ExtractJobIntakeAsync(
            new ExtractJobIntakeRequest { Text = "Please collect from Acme" },
            TestContext.Current.CancellationToken);

        Assert.Equal("emit_job_intake", _capturedForcedTool);
        Assert.Equal(AiTaskClass.Judgment, _capturedTaskClass);
        Assert.Equal("Acme Ltd", result.PickupAddress.AddressLine1);
        Assert.Equal("Queen Street", result.PickupAddress.AddressLine4);
        Assert.Equal("Dock Road", result.DeliveryAddress.AddressLine4);
        Assert.Equal("Jo", result.FromContactName);
        Assert.Equal("Pat", result.DeliverToContact);
        Assert.Equal("2026-09-15", result.Date);
        Assert.Equal("PO-8891", result.RefA);
        Assert.Equal("Call before delivery", result.DeliveryNotes);
        Assert.Equal(12.5m, result.Weight);
        Assert.Equal("kg", result.WeightUnit);
        Assert.Equal(0.8, result.Confidence);
        Assert.Equal("No delivery suburb given", Assert.Single(result.Unresolved));
    }

    [Fact]
    public async Task ExtractJobIntakeAsync_ResolvesNamesAgainstTheApplicationOwnedLists()
    {
        _clientRepository.ActiveClientsAsync("Acme Ltd")
            .Returns([new Suggestion { Id = 7, Text = "ACME LIMITED" }]);
        _jobRepository.GetSpeedsAsync()
            .Returns([new Suggestion { Id = 3, Text = "Urgent" }, new Suggestion { Id = 4, Text = "Standard" }]);
        _courierRepository.GetVehicleSizesAsync()
            .Returns([new Suggestion { Id = 2, Text = "Van" }]);
        StubToolResponse("emit_job_intake", FullIntakePayload());

        var result = await CreateService().ExtractJobIntakeAsync(
            new ExtractJobIntakeRequest { Text = "Acme urgent van job" }, TestContext.Current.CancellationToken);

        Assert.Equal(7, result.Client.Id);
        Assert.Equal("ACME LIMITED", result.Client.Name);
        Assert.Equal("Acme Ltd", result.Client.Text);
        Assert.Equal(3, result.Speed.Id);
        Assert.Equal(2, result.Vehicle.Id);
    }

    [Fact]
    public async Task ExtractJobIntakeAsync_UnmatchedNameKeepsTheTextAndReportsNoId()
    {
        _jobRepository.GetSpeedsAsync().Returns([new Suggestion { Id = 4, Text = "Standard" }]);
        StubToolResponse("emit_job_intake", FullIntakePayload());

        var result = await CreateService().ExtractJobIntakeAsync(
            new ExtractJobIntakeRequest { Text = "urgent" }, TestContext.Current.CancellationToken);

        Assert.Null(result.Speed.Id);
        Assert.Equal("urgent", result.Speed.Text);
    }

    [Fact]
    public async Task ExtractJobIntakeAsync_RedactsPiiFromThePromptAndRestoresItInTheOutput()
    {
        StubToolResponse("emit_job_intake", new
        {
            pickupAddress = new { },
            deliveryAddress = new { },
            deliveryNotes = "Call [PHONE_1] on arrival",
            jobNotes = "Confirm to [EMAIL_1]",
            confidence = 0.5,
            unresolved = Array.Empty<string>()
        });

        var result = await CreateService().ExtractJobIntakeAsync(
            new ExtractJobIntakeRequest { Text = "Call 021-555-1234 on arrival, confirm to jo@acme.co.nz" },
            TestContext.Current.CancellationToken);

        Assert.DoesNotContain("021-555-1234", _capturedUserMessage);
        Assert.DoesNotContain("jo@acme.co.nz", _capturedUserMessage);
        Assert.Equal("Call 021-555-1234 on arrival", result.DeliveryNotes);
        Assert.Equal("Confirm to jo@acme.co.nz", result.JobNotes);
    }

    [Fact]
    public async Task ExtractJobIntakeAsync_PutsTodayAndTheTenantAddressLayoutInThePrompt()
    {
        StubToolResponse("emit_job_intake", FullIntakePayload());

        await CreateService().ExtractJobIntakeAsync(
            new ExtractJobIntakeRequest { Text = "deliver tomorrow" }, TestContext.Current.CancellationToken);

        Assert.Contains("2026-09-14", _capturedUserMessage);
        Assert.Contains("New Zealand", _capturedSystemPrompt);
        Assert.Contains("suburb", _capturedSystemPrompt);
    }

    [Fact]
    public async Task ExtractJobIntakeAsync_UsTenant_DescribesTheUsAddressLayout()
    {
        _tenantInfo.IsUsTenant().Returns(true);
        StubToolResponse("emit_job_intake", FullIntakePayload());

        await CreateService().ExtractJobIntakeAsync(
            new ExtractJobIntakeRequest { Text = "x" }, TestContext.Current.CancellationToken);

        Assert.Contains("US-based", _capturedSystemPrompt);
        Assert.Contains("ZIP", _capturedSystemPrompt);
    }

    [Fact]
    public async Task ExtractJobIntakeAsync_ModelReturnsNothingUsable_ReportsItRatherThanThrowing()
    {
        _aiClient.SendMessageAsync(
                Arg.Any<AiTaskClass>(), Arg.Any<string>(), Arg.Any<List<AiMessage>>(), Arg.Any<int>(),
                Arg.Any<List<AiToolDefinition>>(), Arg.Any<string>(), Arg.Any<bool>(), Arg.Any<bool>(),
                Arg.Any<CancellationToken>())
            .Returns(new AiClientResponse { InputTokens = 10, OutputTokens = 0, StopReason = "max_tokens" });

        var result = await CreateService().ExtractJobIntakeAsync(
            new ExtractJobIntakeRequest { Text = "a booking" }, TestContext.Current.CancellationToken);

        Assert.Equal(0, result.Confidence);
        Assert.NotEmpty(result.Unresolved);
    }

    // ---- Search query -----------------------------------------------------

    [Fact]
    public async Task ParseSearchQueryAsync_EmptyQuery_ReturnsEmptyWithoutCallingAi()
    {
        var result = await CreateService().ParseSearchQueryAsync(
            new ParseSearchQueryRequest { Query = "" }, TestContext.Current.CancellationToken);

        Assert.Empty(result.Clients);
        await _aiClient.DidNotReceiveWithAnyArgs().SendMessageAsync(
            default, null!, null!, 0, null, null, false, false, CancellationToken.None);
    }

    [Fact]
    public async Task ParseSearchQueryAsync_ResolvesNamesAndRunsOnTheDraftingTier()
    {
        _clientRepository.ActiveClientsAsync("Smith").Returns([new Suggestion { Id = 11, Text = "Smith & Co" }]);
        _jobRepository.GetSpeedsAsync().Returns([new Suggestion { Id = 3, Text = "Urgent" }]);
        StubToolResponse("emit_search_criteria", new
        {
            clientNames = new[] { "Smith" },
            courierNames = Array.Empty<string>(),
            speedNames = new[] { "Urgent" },
            jobId = (int?)null,
            bulkJobId = (int?)null,
            jobNumber = (string?)null,
            wildcard = (string?)null,
            fromDate = "2026-09-07",
            toDate = "2026-09-13",
            ignored = new[] { new { term = "late", reason = "Job state is not a search field" } }
        });

        var result = await CreateService().ParseSearchQueryAsync(
            new ParseSearchQueryRequest { Query = "Smith urgent late last week" },
            TestContext.Current.CancellationToken);

        Assert.Equal("emit_search_criteria", _capturedForcedTool);
        Assert.Equal(AiTaskClass.Drafting, _capturedTaskClass);
        Assert.Equal(11, Assert.Single(result.Clients).Id);
        Assert.Equal(3, Assert.Single(result.Speeds).Id);
        Assert.Equal("2026-09-07", result.FromDate);
        Assert.Equal("late", Assert.Single(result.Ignored).Term);
    }

    [Fact]
    public async Task ParseSearchQueryAsync_UnmatchedNameIsReportedRatherThanDropped()
    {
        _clientRepository.ActiveClientsAsync("Smyth").Returns([]);
        StubToolResponse("emit_search_criteria", new
        {
            clientNames = new[] { "Smyth" },
            courierNames = Array.Empty<string>(),
            speedNames = Array.Empty<string>(),
            ignored = Array.Empty<object>()
        });

        var result = await CreateService().ParseSearchQueryAsync(
            new ParseSearchQueryRequest { Query = "Smyth jobs" }, TestContext.Current.CancellationToken);

        Assert.Empty(result.Clients);
        Assert.Equal("Smyth", Assert.Single(result.UnmatchedNames));
    }

    [Fact]
    public async Task ParseSearchQueryAsync_PutsTodayInThePrompt()
    {
        StubToolResponse("emit_search_criteria", new { ignored = Array.Empty<object>() });

        await CreateService().ParseSearchQueryAsync(
            new ParseSearchQueryRequest { Query = "last week" }, TestContext.Current.CancellationToken);

        Assert.Contains("2026-09-14", _capturedUserMessage);
    }
}
