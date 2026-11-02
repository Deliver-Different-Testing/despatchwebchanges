using System.Text.Json;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Models.Response;
using DespatchWeb.Services.AutoMate;
using DespatchWeb.Services.AutoMate.Tools;
using NSubstitute;

namespace DespatchWeb.Tests.Services.AutoMate.Tools;

public class JobToolsTests
{
    private readonly IJobQueryRepository _jobs = Substitute.For<IJobQueryRepository>();
    private readonly INoteRepository _notes = Substitute.For<INoteRepository>();
    private readonly ITaskRepository _tasks = Substitute.For<ITaskRepository>();
    private readonly IDeliveryJourneyService _journey = Substitute.For<IDeliveryJourneyService>();
    private readonly ITenantClock _clock = Substitute.For<ITenantClock>();

    public JobToolsTests()
    {
        _notes.GetNotesByJobIdAsync(Arg.Any<int>()).Returns(new List<TucNoteViewModel>());
        _tasks.GetAllTasksAsync(Arg.Any<TaskTableFiltersRequest>()).Returns(new List<TaskViewModel>());
        _journey.GetStatusHistoryForJobAsync(Arg.Any<int>()).Returns(new List<JobStatusHistoryEntry>());
        _clock.TenantToday.Returns(new DateTime(2026, 11, 2));
    }

    private GetJobTool GetJob(AutoMateAudience? audience = null) =>
        new(_jobs, _notes, _tasks, audience ?? AutoMateTestEnv.Staff());

    private GetJobActivityTool GetActivity(AutoMateAudience? audience = null) =>
        new(_jobs, _notes, _tasks, _journey, audience ?? AutoMateTestEnv.Staff());

    private SearchJobsTool SearchJobs(AutoMateAudience? audience = null) =>
        new(_jobs, _clock, audience ?? AutoMateTestEnv.Staff());

    private static JsonElement Input(string json) => JsonDocument.Parse(json).RootElement.Clone();

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private static JobViewModel Job(int id) => new() { Id = id, JobNo = $"J{id}", Status = "Allocated" };

    [Fact]
    public void AllJobTools_AreStaffOnly()
    {
        Assert.True(GetJob().StaffOnly);
        Assert.True(GetActivity().StaffOnly);
        Assert.True(SearchJobs().StaffOnly);
    }

    [Fact]
    public async Task GetJob_ReadsWithoutMarkingRead_NeverTheMarkingReaders()
    {
        _jobs.GetJobWithoutMarkingReadAsync(5).Returns(Job(5));

        var result = await GetJob().ExecuteAsync(Input("""{"job_id":5}"""), Ct);

        Assert.False(ToolOutput.IsError(result));
        Assert.StartsWith("Job id 5", result);
        await _jobs.Received(1).GetJobWithoutMarkingReadAsync(5);
        await _jobs.Received(0).GetJobByIdAsync(Arg.Any<int>());
        await _jobs.Received(0).GetSingleJobById(Arg.Any<int>());
    }

    [Fact]
    public async Task GetJob_ByJobNumber_ResolvesTheId_ThenReadsWithoutMarkingRead()
    {
        _jobs.GetJobIdByNumberAsync("J-77").Returns(77);
        _jobs.GetJobWithoutMarkingReadAsync(77).Returns(Job(77));

        var result = await GetJob().ExecuteAsync(Input("""{"job_number":" J-77 "}"""), Ct);

        Assert.StartsWith("Job id 77", result);
        await _jobs.Received(1).GetJobWithoutMarkingReadAsync(77);
        await _jobs.Received(0).GetJobByIdAsync(Arg.Any<int>());
        await _jobs.Received(0).GetSingleJobById(Arg.Any<int>());
    }

    [Fact]
    public async Task GetJob_KeyNotFound_IsANotFoundError_NotACrash()
    {
        _jobs.GetJobWithoutMarkingReadAsync(9).Returns<Task<JobViewModel?>>(_ => throw new KeyNotFoundException());

        var result = await GetJob().ExecuteAsync(Input("""{"job_id":9}"""), Ct);

        Assert.True(ToolOutput.IsError(result));
        Assert.Contains("No job 9 was found", result);
    }

    [Fact]
    public async Task GetJob_NullJob_IsANotFoundError()
    {
        _jobs.GetJobWithoutMarkingReadAsync(9).Returns((JobViewModel?)null);

        var result = await GetJob().ExecuteAsync(Input("""{"job_id":9}"""), Ct);

        Assert.Contains("No job 9 was found", result);
        await _notes.DidNotReceive().GetNotesByJobIdAsync(Arg.Any<int>());
    }

    [Fact]
    public async Task GetJob_UnknownJobNumber_IsAnError_WithoutLoadingAJob()
    {
        _jobs.GetJobIdByNumberAsync("nope").Returns((int?)null);

        var result = await GetJob().ExecuteAsync(Input("""{"job_number":"nope"}"""), Ct);

        Assert.True(ToolOutput.IsError(result));
        Assert.Contains("No job has the number nope", result);
        await _jobs.Received(0).GetJobWithoutMarkingReadAsync(Arg.Any<int>());
    }

    [Theory]
    [InlineData("{}")]
    [InlineData("""{"job_id":0}""")]
    [InlineData("""{"job_id":"abc"}""")]
    public async Task GetJob_WithoutAUsableReference_IsAnError(string json)
    {
        var result = await GetJob().ExecuteAsync(Input(json), Ct);

        Assert.True(ToolOutput.IsError(result));
        await _jobs.Received(0).GetJobWithoutMarkingReadAsync(Arg.Any<int>());
    }

    [Fact]
    public async Task GetJob_NonStaff_IsRefused_WithoutTouchingAnyRepository()
    {
        var result = await GetJob(AutoMateTestEnv.Customer()).ExecuteAsync(Input("""{"job_id":5}"""), Ct);

        Assert.Equal(ToolOutput.Error(ToolOutput.StaffOnlyMessage), result);
        await _jobs.Received(0).GetJobWithoutMarkingReadAsync(Arg.Any<int>());
        await _jobs.Received(0).GetJobIdByNumberAsync(Arg.Any<string>());
        await _notes.DidNotReceive().GetNotesByJobIdAsync(Arg.Any<int>());
    }

    [Fact]
    public async Task GetJobActivity_NonStaff_IsRefused()
    {
        var result = await GetActivity(AutoMateTestEnv.Customer()).ExecuteAsync(Input("""{"job_id":5}"""), Ct);

        Assert.Equal(ToolOutput.Error(ToolOutput.StaffOnlyMessage), result);
        await _notes.DidNotReceive().GetNotesByJobIdAsync(Arg.Any<int>());
        await _journey.DidNotReceive().GetStatusHistoryForJobAsync(Arg.Any<int>());
    }

    [Fact]
    public async Task GetJobActivity_WithNothingRecorded_SaysSo()
    {
        var result = await GetActivity().ExecuteAsync(Input("""{"job_id":5}"""), Ct);

        Assert.Equal("Job 5 has no notes, events or status history.", result);
    }

    [Fact]
    public async Task GetJobActivity_ListsStatusHistory_AndNeverMarksTheJobRead()
    {
        _journey.GetStatusHistoryForJobAsync(5).Returns(new List<JobStatusHistoryEntry>
        {
            new() { ActionTime = new DateTime(2026, 11, 1, 9, 30, 0), Status = "Allocated" }
        });

        var result = await GetActivity().ExecuteAsync(Input("""{"job_id":5}"""), Ct);

        Assert.Contains("--- Status history ---", result);
        Assert.Contains("[2026-11-01 09:30] Allocated", result);
        await _jobs.Received(0).GetJobByIdAsync(Arg.Any<int>());
        await _jobs.Received(0).GetSingleJobById(Arg.Any<int>());
    }

    [Fact]
    public async Task GetJobActivity_UnknownJobNumber_IsAnError()
    {
        _jobs.GetJobIdByNumberAsync("nope").Returns((int?)null);

        var result = await GetActivity().ExecuteAsync(Input("""{"job_number":"nope"}"""), Ct);

        Assert.True(ToolOutput.IsError(result));
    }

    [Fact]
    public async Task SearchJobs_NonStaff_IsRefused()
    {
        var result = await SearchJobs(AutoMateTestEnv.Customer()).ExecuteAsync(Input("{}"), Ct);

        Assert.Equal(ToolOutput.Error(ToolOutput.StaffOnlyMessage), result);
        await _jobs.DidNotReceive().PodSearchAsync(Arg.Any<PodSearchRequest>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task SearchJobs_CapsAtTenRows_AndPassesFiltersAndDates()
    {
        PodSearchRequest? sent = null;
        _jobs.PodSearchAsync(Arg.Do<PodSearchRequest>(r => sent = r), Arg.Any<CancellationToken>())
            .Returns(new JobSearchResult { Jobs = [], TotalCount = 0 });

        await SearchJobs().ExecuteAsync(Input("""
            {"job_number":"J1","text":"airport","client_id":12,"courier_id":34,"from_date":"2026-10-01","to_date":"2026-10-15"}
            """), Ct);

        Assert.NotNull(sent);
        Assert.Equal(10, sent.PageSize);
        Assert.Equal("J1", sent.Job);
        Assert.Equal("airport", sent.Wild);
        Assert.Equal([12], sent.ClientIds);
        Assert.Equal([34], sent.CourierIds);
        Assert.Equal(new DateTimeOffset(2026, 10, 1, 0, 0, 0, TimeSpan.Zero), sent.FromDate);
        Assert.Equal(new DateTimeOffset(2026, 10, 15, 0, 0, 0, TimeSpan.Zero), sent.ToDate);
        Assert.Equal("desc", sent.SortDirection);
    }

    [Fact]
    public async Task SearchJobs_WithoutDates_DefaultsToTheLastSevenTenantDays()
    {
        PodSearchRequest? sent = null;
        _jobs.PodSearchAsync(Arg.Do<PodSearchRequest>(r => sent = r), Arg.Any<CancellationToken>())
            .Returns(new JobSearchResult { Jobs = [], TotalCount = 0 });

        var result = await SearchJobs().ExecuteAsync(Input("{}"), Ct);

        Assert.Equal(new DateTimeOffset(2026, 10, 26, 0, 0, 0, TimeSpan.Zero), sent!.FromDate);
        Assert.Equal(new DateTimeOffset(2026, 11, 2, 0, 0, 0, TimeSpan.Zero), sent.ToDate);
        Assert.Null(sent.ClientIds);
        Assert.Null(sent.CourierIds);
        Assert.Equal("No jobs matched between 2026-10-26 and 2026-11-02.", result);
    }

    [Fact]
    public async Task SearchJobs_ReportsTotalAndShownCount_AndEachJobsFields()
    {
        _jobs.PodSearchAsync(Arg.Any<PodSearchRequest>(), Arg.Any<CancellationToken>()).Returns(new JobSearchResult
        {
            TotalCount = 37,
            Jobs =
            [
                new DispatchJobViewModel { Id = 5, JobNo = "J5", Status = "Allocated", ClientName = "Acme", Courier = "Sam", IsArchived = true }
            ]
        });

        var result = await SearchJobs().ExecuteAsync(Input("{}"), Ct);

        Assert.Contains("37 job(s) matched", result);
        Assert.Contains("showing 1", result);
        Assert.Contains("id 5, job J5: Allocated, client <user_text>Acme</user_text>, driver Sam", result);
        Assert.Contains("archived", result);
    }

    [Theory]
    [InlineData("""{"from_date":"2026-10-20","to_date":"2026-10-01"}""", "on or before")]
    [InlineData("""{"from_date":"garbage"}""", "must be a date")]
    [InlineData("""{"client_id":"abc"}""", "must be an integer")]
    public async Task SearchJobs_BadArguments_AreErrors_WithoutSearching(string json, string expected)
    {
        var result = await SearchJobs().ExecuteAsync(Input(json), Ct);

        Assert.True(ToolOutput.IsError(result));
        Assert.Contains(expected, result);
        await _jobs.DidNotReceive().PodSearchAsync(Arg.Any<PodSearchRequest>(), Arg.Any<CancellationToken>());
    }
}
