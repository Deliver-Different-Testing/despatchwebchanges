using System.Text.Json;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Models.Response;
using DespatchWeb.Services;
using Microsoft.Extensions.Options;
using NSubstitute;

namespace DespatchWeb.Tests.Services;

public class AiSummarizationServiceTests
{
    private readonly IAiClientService _aiClientMock = Substitute.For<IAiClientService>();
    private readonly INoteRepository _noteRepositoryMock = Substitute.For<INoteRepository>();
    private readonly ITaskRepository _taskRepositoryMock = Substitute.For<ITaskRepository>();
    private readonly IJobQueryRepository _jobRepositoryMock = Substitute.For<IJobQueryRepository>();
    private readonly ICourierRepository _courierRepositoryMock = Substitute.For<ICourierRepository>();
    private readonly ITenantInfoService _tenantInfoMock = Substitute.For<ITenantInfoService>();

    private readonly IOptions<AnthropicSettings> _settings = Options.Create(new AnthropicSettings
    {
        MaxTokensPerSummary = 1024
    });

    private AiSummarizationService CreateService() => new(
        _aiClientMock,
        _noteRepositoryMock,
        _taskRepositoryMock,
        _jobRepositoryMock,
        _courierRepositoryMock,
        _tenantInfoMock,
        _settings);

    // ----- Helpers ----------------------------------------------------------

    private static string ToolJson(
        string verdict,
        string severity = "Info",
        string[]? keyFacts = null,
        object[]? attention = null,
        object[]? timeline = null,
        string[]? highlights = null) =>
        JsonSerializer.Serialize(new
        {
            verdict,
            severity,
            keyFacts = keyFacts ?? [],
            attention = attention ?? [],
            timeline = timeline ?? [],
            highlights = highlights ?? Array.Empty<string>()
        });

    private void StubMarkdownResponse(string text, int inputTokens = 50, int outputTokens = 10) =>
        _aiClientMock.SendMessageAsync(
                Arg.Any<string>(), Arg.Any<List<AiMessage>>(), Arg.Any<int>(),
                Arg.Any<List<AiToolDefinition>>(), Arg.Any<string>(),
                Arg.Any<bool>(), Arg.Any<bool>(), Arg.Any<CancellationToken>())
            .Returns(new AiClientResponse
            {
                TextContent = text,
                InputTokens = inputTokens,
                OutputTokens = outputTokens
            });

    private void StubStructuredResponse(string toolJson, int inputTokens = 100, int outputTokens = 20)
    {
        var response = new AiClientResponse
        {
            InputTokens = inputTokens,
            OutputTokens = outputTokens
        };
        response.ToolCalls.Add(new AiToolCall
        {
            ToolUseId = "tool_1",
            ToolName = "emit_summary",
            ArgumentsJson = toolJson
        });

        _aiClientMock.SendMessageAsync(
                Arg.Any<string>(), Arg.Any<List<AiMessage>>(), Arg.Any<int>(),
                Arg.Any<List<AiToolDefinition>>(), Arg.Any<string>(),
                Arg.Any<bool>(), Arg.Any<bool>(), Arg.Any<CancellationToken>())
            .Returns(response);
    }

    private List<AiMessage> CaptureSendStructured(string toolJson)
    {
        List<AiMessage>? captured = null;
        var response = new AiClientResponse { InputTokens = 100, OutputTokens = 20 };
        response.ToolCalls.Add(new AiToolCall
        {
            ToolUseId = "tool_1",
            ToolName = "emit_summary",
            ArgumentsJson = toolJson
        });
        _aiClientMock.SendMessageAsync(
                Arg.Any<string>(), Arg.Any<List<AiMessage>>(), Arg.Any<int>(),
                Arg.Any<List<AiToolDefinition>>(), Arg.Any<string>(),
                Arg.Any<bool>(), Arg.Any<bool>(), Arg.Any<CancellationToken>())
            .Returns(call =>
            {
                captured = call.ArgAt<List<AiMessage>>(1);
                return response;
            });
        return captured ??= [];
    }

    // ----- Markdown summaries (notes / events) ------------------------------

    [Fact]
    public async Task SummarizeJobNotesAsync_NoNotes_ReturnsDefaultMessage()
    {
        _noteRepositoryMock.GetNotesByJobIdAsync(1).Returns([]);

        var result = await CreateService().SummarizeJobNotesAsync(1, TestContext.Current.CancellationToken);

        Assert.Equal("No notes found for this job.", result.Summary);
        Assert.Equal(0, result.Usage.InputTokens);
    }

    [Fact]
    public async Task SummarizeJobNotesAsync_WithNotes_ReturnsSummaryFromClient()
    {
        _noteRepositoryMock.GetNotesByJobIdAsync(1).Returns([
            new TucNoteViewModel
            {
                NoteId = 1, NoteText = "Driver arrived", NoteTypeName = "Status",
                CreatedByName = "Admin", CreatedDate = DateTimeOffset.UtcNow
            }
        ]);
        StubMarkdownResponse("Driver arrived and collected.", 150, 30);

        var result = await CreateService().SummarizeJobNotesAsync(1, TestContext.Current.CancellationToken);

        Assert.Equal("Driver arrived and collected.", result.Summary);
        Assert.Equal(150, result.Usage.InputTokens);
    }

    [Fact]
    public async Task SummarizeJobNotesAsync_SanitizesPii()
    {
        _noteRepositoryMock.GetNotesByJobIdAsync(1).Returns([
            new TucNoteViewModel
            {
                NoteId = 1, NoteText = "Contact driver@test.com for details",
                NoteTypeName = "Note", CreatedByName = "Admin",
                CreatedDate = DateTimeOffset.UtcNow
            }
        ]);
        List<AiMessage>? captured = null;
        _aiClientMock.SendMessageAsync(
                Arg.Any<string>(), Arg.Any<List<AiMessage>>(), Arg.Any<int>(),
                Arg.Any<List<AiToolDefinition>>(), Arg.Any<string>(),
                Arg.Any<bool>(), Arg.Any<bool>(), Arg.Any<CancellationToken>())
            .Returns(call =>
            {
                captured = call.ArgAt<List<AiMessage>>(1);
                return new AiClientResponse { TextContent = "ok", InputTokens = 1, OutputTokens = 1 };
            });

        await CreateService().SummarizeJobNotesAsync(1, TestContext.Current.CancellationToken);

        Assert.NotNull(captured);
        Assert.Contains("[EMAIL]", captured![0].Content);
        Assert.DoesNotContain("driver@test.com", captured[0].Content);
    }

    [Fact]
    public async Task SummarizeJobEventsAsync_NoEvents_ReturnsDefaultMessage()
    {
        _taskRepositoryMock.GetAllTasksAsync(Arg.Any<TaskTableFiltersRequest>()).Returns([]);

        var result = await CreateService().SummarizeJobEventsAsync(1, TestContext.Current.CancellationToken);

        Assert.Equal("No events found for this job.", result.Summary);
    }

    // ----- Structured summaries: job ----------------------------------------

    [Fact]
    public async Task SummarizeJobAsync_NoJob_ReturnsJobNotFoundResponse()
    {
        _jobRepositoryMock.GetSingleJobById(1).Returns((JobViewModel?)null);
        _noteRepositoryMock.GetNotesByJobIdAsync(1).Returns([]);
        _taskRepositoryMock.GetAllTasksAsync(Arg.Any<TaskTableFiltersRequest>()).Returns([]);

        var result = await CreateService().SummarizeJobAsync(1, TestContext.Current.CancellationToken);

        Assert.Equal("Job not found.", result.Verdict);
        Assert.Equal(SummarySeverity.Info, result.Severity);
        Assert.Empty(result.Attention);
    }

    [Fact]
    public async Task SummarizeJobAsync_ParsesStructuredResponse()
    {
        _jobRepositoryMock.GetSingleJobById(1).Returns(new JobViewModel
        {
            Id = 1, JobNo = "J100", Status = "Active",
            ClientName = "Client A", SpeedName = "Standard",
            From = "Auckland", ToAddress = "Wellington",
            PickupAddress = new AddressViewModel { AddressLine1 = "1 Queen St" },
            DeliveryAddress = new AddressViewModel { AddressLine1 = "10 Lambton Quay" },
            FromContactName = "Sam", DeliverToContact = "Pat",
            Courier = "Driver Jane"
        });
        _noteRepositoryMock.GetNotesByJobIdAsync(1).Returns([]);
        _taskRepositoryMock.GetAllTasksAsync(Arg.Any<TaskTableFiltersRequest>()).Returns([]);

        StubStructuredResponse(ToolJson(
            "✅ On track — picked up 10m ago",
            severity: "Ok",
            keyFacts: ["Client A", "Std", "Akl→Wlg"],
            attention: [],
            timeline: new object[] { new { label = "Booked", detail = "4h ago", status = "Ok" } },
            highlights: ["Customer requested call before delivery"]));

        var result = await CreateService().SummarizeJobAsync(1, TestContext.Current.CancellationToken);

        Assert.Equal("✅ On track — picked up 10m ago", result.Verdict);
        Assert.Equal(SummarySeverity.Ok, result.Severity);
        Assert.Equal(3, result.KeyFacts.Count);
        Assert.Single(result.Timeline);
        Assert.Equal("Booked", result.Timeline[0].Label);
        Assert.Equal(TimelineStatus.Ok, result.Timeline[0].Status);
        Assert.Single(result.Highlights);
    }

    [Fact]
    public async Task SummarizeJobAsync_OverdueDelivery_RaisesSeverityFloor()
    {
        _jobRepositoryMock.GetSingleJobById(1).Returns(new JobViewModel
        {
            Id = 1, JobNo = "J100", Status = "Active",
            From = "Auckland", ToAddress = "Wellington",
            FromContactName = "Sam",
            DeliverByTime = DateTime.UtcNow.AddHours(-3),
            Courier = "Jim Smith"
        });
        _noteRepositoryMock.GetNotesByJobIdAsync(1).Returns([]);
        _taskRepositoryMock.GetAllTasksAsync(Arg.Any<TaskTableFiltersRequest>()).Returns([]);

        // LLM tries to under-call severity — service must clamp up to Critical
        StubStructuredResponse(ToolJson(
            "Delivery is late",
            severity: "Caution",
            keyFacts: ["Jim Smith"],
            attention: new object[] {
                new { headline = "Delivery 3h past deadline", action = "Call Jim Smith", severity = "Critical" }
            }));

        var result = await CreateService().SummarizeJobAsync(1, TestContext.Current.CancellationToken);

        Assert.Equal(SummarySeverity.Critical, result.Severity);
    }

    [Fact]
    public async Task SummarizeJobAsync_SendsSignalLinesInUserMessage()
    {
        _jobRepositoryMock.GetSingleJobById(1).Returns(new JobViewModel
        {
            Id = 1, JobNo = "J100", Status = "Active",
            From = "A", ToAddress = "B",
            FromContactName = "Sam", DeliverToContact = "Pat",
            Attention = true
        });
        _noteRepositoryMock.GetNotesByJobIdAsync(1).Returns([]);
        _taskRepositoryMock.GetAllTasksAsync(Arg.Any<TaskTableFiltersRequest>()).Returns([]);

        List<AiMessage>? captured = null;
        var response = new AiClientResponse { InputTokens = 100, OutputTokens = 20 };
        response.ToolCalls.Add(new AiToolCall
        {
            ToolName = "emit_summary",
            ArgumentsJson = ToolJson("ok", "Info")
        });
        _aiClientMock.SendMessageAsync(
                Arg.Any<string>(), Arg.Any<List<AiMessage>>(), Arg.Any<int>(),
                Arg.Any<List<AiToolDefinition>>(), Arg.Any<string>(),
                Arg.Any<bool>(), Arg.Any<bool>(), Arg.Any<CancellationToken>())
            .Returns(call =>
            {
                captured = call.ArgAt<List<AiMessage>>(1);
                return response;
            });

        await CreateService().SummarizeJobAsync(1, TestContext.Current.CancellationToken);

        Assert.NotNull(captured);
        Assert.Contains("SIGNAL", captured![0].Content);
        Assert.Contains("ATTENTION", captured[0].Content);
    }

    [Fact]
    public async Task SummarizeJobAsync_ForcesEmitSummaryTool()
    {
        _jobRepositoryMock.GetSingleJobById(1).Returns(new JobViewModel
        {
            Id = 1, JobNo = "J1", Status = "Active",
            From = "A", ToAddress = "B", FromContactName = "S"
        });
        _noteRepositoryMock.GetNotesByJobIdAsync(1).Returns([]);
        _taskRepositoryMock.GetAllTasksAsync(Arg.Any<TaskTableFiltersRequest>()).Returns([]);

        string? capturedToolName = null;
        List<AiToolDefinition>? capturedTools = null;
        bool? capturedCaching = null;
        var response = new AiClientResponse { InputTokens = 10, OutputTokens = 10 };
        response.ToolCalls.Add(new AiToolCall
        {
            ToolName = "emit_summary",
            ArgumentsJson = ToolJson("ok")
        });
        _aiClientMock.SendMessageAsync(
                Arg.Any<string>(), Arg.Any<List<AiMessage>>(), Arg.Any<int>(),
                Arg.Any<List<AiToolDefinition>>(), Arg.Any<string>(),
                Arg.Any<bool>(), Arg.Any<bool>(), Arg.Any<CancellationToken>())
            .Returns(call =>
            {
                capturedTools = call.ArgAt<List<AiToolDefinition>>(3);
                capturedToolName = call.ArgAt<string>(4);
                capturedCaching = call.ArgAt<bool>(5);
                return response;
            });

        await CreateService().SummarizeJobAsync(1, TestContext.Current.CancellationToken);

        Assert.Equal("emit_summary", capturedToolName);
        Assert.NotNull(capturedTools);
        Assert.Single(capturedTools!);
        Assert.Equal("emit_summary", capturedTools![0].Name);
        Assert.True(capturedCaching);
    }

    [Fact]
    public async Task SummarizeJobAsync_NoToolCall_ReturnsFallback()
    {
        _jobRepositoryMock.GetSingleJobById(1).Returns(new JobViewModel
        {
            Id = 1, JobNo = "J1", Status = "Active",
            From = "A", ToAddress = "B", FromContactName = "S"
        });
        _noteRepositoryMock.GetNotesByJobIdAsync(1).Returns([]);
        _taskRepositoryMock.GetAllTasksAsync(Arg.Any<TaskTableFiltersRequest>()).Returns([]);

        _aiClientMock.SendMessageAsync(
                Arg.Any<string>(), Arg.Any<List<AiMessage>>(), Arg.Any<int>(),
                Arg.Any<List<AiToolDefinition>>(), Arg.Any<string>(),
                Arg.Any<bool>(), Arg.Any<bool>(), Arg.Any<CancellationToken>())
            .Returns(new AiClientResponse { InputTokens = 10, OutputTokens = 0 });

        var result = await CreateService().SummarizeJobAsync(1, TestContext.Current.CancellationToken);

        Assert.Equal("Unable to generate summary.", result.Verdict);
    }

    [Fact]
    public async Task SummarizeJobAsync_MalformedToolJson_ReturnsParseErrorFallback()
    {
        _jobRepositoryMock.GetSingleJobById(1).Returns(new JobViewModel
        {
            Id = 1, JobNo = "J1", Status = "Active",
            From = "A", ToAddress = "B", FromContactName = "S"
        });
        _noteRepositoryMock.GetNotesByJobIdAsync(1).Returns([]);
        _taskRepositoryMock.GetAllTasksAsync(Arg.Any<TaskTableFiltersRequest>()).Returns([]);

        var response = new AiClientResponse { InputTokens = 10, OutputTokens = 10 };
        response.ToolCalls.Add(new AiToolCall { ToolName = "emit_summary", ArgumentsJson = "{not json" });
        _aiClientMock.SendMessageAsync(
                Arg.Any<string>(), Arg.Any<List<AiMessage>>(), Arg.Any<int>(),
                Arg.Any<List<AiToolDefinition>>(), Arg.Any<string>(),
                Arg.Any<bool>(), Arg.Any<bool>(), Arg.Any<CancellationToken>())
            .Returns(response);

        var result = await CreateService().SummarizeJobAsync(1, TestContext.Current.CancellationToken);

        Assert.Equal("Unable to parse AI summary.", result.Verdict);
    }

    [Fact]
    public async Task SummarizeJobAsync_SanitisesAddresses()
    {
        _jobRepositoryMock.GetSingleJobById(1).Returns(new JobViewModel
        {
            Id = 1, JobNo = "J1", Status = "Active",
            From = "Contact: driver@test.com, 123 Street",
            ToAddress = "Call 021-555-1234",
            FromContactName = "S"
        });
        _noteRepositoryMock.GetNotesByJobIdAsync(1).Returns([]);
        _taskRepositoryMock.GetAllTasksAsync(Arg.Any<TaskTableFiltersRequest>()).Returns([]);

        List<AiMessage>? captured = null;
        var response = new AiClientResponse { InputTokens = 10, OutputTokens = 10 };
        response.ToolCalls.Add(new AiToolCall { ToolName = "emit_summary", ArgumentsJson = ToolJson("ok") });
        _aiClientMock.SendMessageAsync(
                Arg.Any<string>(), Arg.Any<List<AiMessage>>(), Arg.Any<int>(),
                Arg.Any<List<AiToolDefinition>>(), Arg.Any<string>(),
                Arg.Any<bool>(), Arg.Any<bool>(), Arg.Any<CancellationToken>())
            .Returns(call =>
            {
                captured = call.ArgAt<List<AiMessage>>(1);
                return response;
            });

        await CreateService().SummarizeJobAsync(1, TestContext.Current.CancellationToken);

        Assert.Contains("[EMAIL]", captured?[0].Content);
        Assert.DoesNotContain("driver@test.com", captured?[0].Content);
        Assert.Contains("[PHONE]", captured?[0].Content);
    }

    // ----- Task dashboard ---------------------------------------------------

    [Fact]
    public async Task SummarizeTaskDashboardAsync_NoTasks_ReturnsClearQueueResponse()
    {
        _taskRepositoryMock.GetAllTasksAsync(Arg.Any<TaskTableFiltersRequest>()).Returns([]);

        var result = await CreateService().SummarizeTaskDashboardAsync(TestContext.Current.CancellationToken);

        Assert.Equal(SummarySeverity.Ok, result.Severity);
        Assert.Contains("clear", result.Verdict, StringComparison.OrdinalIgnoreCase);
        Assert.Empty(result.Attention);
    }

    [Fact]
    public async Task SummarizeTaskDashboardAsync_WithOverdue_ClampsSeverityUp()
    {
        var tasks = new List<TaskViewModel>();
        for (var i = 0; i < 6; i++)
        {
            tasks.Add(new TaskViewModel
            {
                Id = i + 1, Title = $"T{i}", DueDate = DateTimeOffset.UtcNow.AddHours(-2),
                Closed = false, EventType = "Alert", JobNumber = $"J{i}"
            });
        }
        _taskRepositoryMock.GetAllTasksAsync(Arg.Any<TaskTableFiltersRequest>()).Returns(tasks);
        StubStructuredResponse(ToolJson("queue is heavy", severity: "Info"));

        var result = await CreateService().SummarizeTaskDashboardAsync(TestContext.Current.CancellationToken);

        // 6 overdue → Critical floor; LLM Info gets clamped up
        Assert.Equal(SummarySeverity.Critical, result.Severity);
    }

    // ----- Operations -------------------------------------------------------

    [Fact]
    public async Task SummarizeOperationsAsync_ParsesResponse()
    {
        _jobRepositoryMock.GetOverviewStatsAsync().Returns(new OverviewStatsViewModel
        {
            Active = 30, Inactive = 2, Completed = 42
        });
        StubStructuredResponse(ToolJson("All good", "Ok", keyFacts: ["30 active"]));

        var result = await CreateService().SummarizeOperationsAsync(TestContext.Current.CancellationToken);

        Assert.Equal("All good", result.Verdict);
        Assert.Equal(SummarySeverity.Ok, result.Severity);
    }

    // ----- Compliance -------------------------------------------------------

    [Fact]
    public async Task SummarizeComplianceAsync_NoRecords_ReturnsEmptyOkResponse()
    {
        _courierRepositoryMock.GetCourierComplianceForExportAsync(Arg.Any<CourierComplianceFilterRequest>())
            .Returns([]);

        var result = await CreateService().SummarizeComplianceAsync(TestContext.Current.CancellationToken);

        Assert.Equal(SummarySeverity.Ok, result.Severity);
        Assert.Empty(result.Attention);
    }

    [Fact]
    public async Task SummarizeComplianceAsync_WithExpiredItems_ClampsToCritical()
    {
        _courierRepositoryMock.GetCourierComplianceForExportAsync(Arg.Any<CourierComplianceFilterRequest>())
            .Returns([
                new CourierComplianceViewModel
                {
                    Code = "D1", Name = "John", ComplianceType = "License",
                    ExpiryDate = DateTimeOffset.UtcNow.AddDays(-10)
                }
            ]);
        StubStructuredResponse(ToolJson("1 expired", "Caution"));

        var result = await CreateService().SummarizeComplianceAsync(TestContext.Current.CancellationToken);

        Assert.Equal(SummarySeverity.Critical, result.Severity);
    }

    // ----- Region context ---------------------------------------------------

    [Fact]
    public async Task SummarizeJobNotesAsync_NzTenant_UsesNzRegion()
    {
        _tenantInfoMock.IsUsTenant().Returns(false);
        _noteRepositoryMock.GetNotesByJobIdAsync(1).Returns([
            new TucNoteViewModel
            {
                NoteId = 1, NoteText = "Test", NoteTypeName = "Note",
                CreatedByName = "Admin", CreatedDate = DateTimeOffset.UtcNow
            }
        ]);

        string? capturedSystemPrompt = null;
        _aiClientMock.SendMessageAsync(
                Arg.Any<string>(), Arg.Any<List<AiMessage>>(), Arg.Any<int>(),
                Arg.Any<List<AiToolDefinition>>(), Arg.Any<string>(),
                Arg.Any<bool>(), Arg.Any<bool>(), Arg.Any<CancellationToken>())
            .Returns(call =>
            {
                capturedSystemPrompt = call.ArgAt<string>(0);
                return new AiClientResponse { TextContent = "ok", InputTokens = 1, OutputTokens = 1 };
            });

        await CreateService().SummarizeJobNotesAsync(1, TestContext.Current.CancellationToken);

        Assert.Contains("New Zealand", capturedSystemPrompt);
    }

    [Fact]
    public async Task SummarizeJobAsync_UsTenant_UsesUsRegionInJobBriefingPrompt()
    {
        _tenantInfoMock.IsUsTenant().Returns(true);
        _jobRepositoryMock.GetSingleJobById(1).Returns(new JobViewModel
        {
            Id = 1, JobNo = "J1", Status = "Active",
            From = "A", ToAddress = "B", FromContactName = "S"
        });
        _noteRepositoryMock.GetNotesByJobIdAsync(1).Returns([]);
        _taskRepositoryMock.GetAllTasksAsync(Arg.Any<TaskTableFiltersRequest>()).Returns([]);

        string? capturedSystem = null;
        var response = new AiClientResponse { InputTokens = 1, OutputTokens = 1 };
        response.ToolCalls.Add(new AiToolCall { ToolName = "emit_summary", ArgumentsJson = ToolJson("ok") });
        _aiClientMock.SendMessageAsync(
                Arg.Any<string>(), Arg.Any<List<AiMessage>>(), Arg.Any<int>(),
                Arg.Any<List<AiToolDefinition>>(), Arg.Any<string>(),
                Arg.Any<bool>(), Arg.Any<bool>(), Arg.Any<CancellationToken>())
            .Returns(call =>
            {
                capturedSystem = call.ArgAt<string>(0);
                return response;
            });

        await CreateService().SummarizeJobAsync(1, TestContext.Current.CancellationToken);

        Assert.Contains("US-based", capturedSystem);
    }
}
