using DespatchWeb.Enums;
using DespatchWeb.Repositories;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// Regression tests for <see cref="JobRepository.CreateIccJobEntry"/>.
///
/// Inter-courier charge jobs are paired "phantom" rows used to move money between
/// couriers — they must NOT appear on the dispatch board and must NOT look like work
/// to be performed. A 2025-09 refactor accidentally routed these through the generic
/// CreateJobService pipeline, which produced live, undispatched jobs visible to staff.
/// These tests pin the field set that keeps the rows invisible.
/// </summary>
public class JobRepositoryInterCourierChargeTests
{
    private static readonly DateTime FixedTime = new(2026, 6, 16, 9, 30, 0);

    [Fact]
    public void CreateIccJobEntry_IsAlreadyCompleted_NotALiveDispatchJob()
    {
        var job = JobRepository.CreateIccJobEntry(
            jobNumber: "ICC-001", clientId: 42, courierId: 235, amount: 7m,
            reference: "ref", clientRefB: "ICC", ourRef: "To # 191",
            note: "From # 235 To # 191", currentTime: FixedTime, staffId: 1);

        Assert.Equal((int)JobStatus.Completed, job.UcjbStatus);
        Assert.True(job.UcjbJobDone);
        Assert.Equal(FixedTime, job.UcjbComplTime);
        Assert.False(job.DisplayInDespatch);
        Assert.False(job.UcjbVoid);
    }

    [Fact]
    public void CreateIccJobEntry_AttributesToDialogPickedClient()
    {
        var job = JobRepository.CreateIccJobEntry(
            jobNumber: "ICC-001", clientId: 7842, courierId: 235, amount: 7m,
            reference: "ref", clientRefB: "ICC", ourRef: "To # 191",
            note: "note", currentTime: FixedTime, staffId: 1);

        Assert.Equal(7842, job.UcjbClientId);
    }

    [Fact]
    public void CreateIccJobEntry_StoresCourierAndAmount()
    {
        var job = JobRepository.CreateIccJobEntry(
            jobNumber: "ICC-001", clientId: 42, courierId: 235, amount: 42.5m,
            reference: "ref", clientRefB: "ICC", ourRef: "To # 191",
            note: "note", currentTime: FixedTime, staffId: 1);

        Assert.Equal(235, job.UcjbCourierId);
        Assert.Equal(42.5m, job.UcjbAmount);
        Assert.Equal("Courier 235", job.UcjbContact);
        Assert.Equal("Courier 235", job.UcjbPodname);
    }

    [Theory]
    [InlineData("short ref", "short ref")]
    [InlineData("this reference is more than twenty characters long",
        "this reference is mo")]
    public void CreateIccJobEntry_TruncatesReferenceAToTwentyChars(string input, string expected)
    {
        var job = JobRepository.CreateIccJobEntry(
            jobNumber: "ICC-001", clientId: 42, courierId: 235, amount: 7m,
            reference: input, clientRefB: "ICC", ourRef: "ourRef",
            note: "note", currentTime: FixedTime, staffId: 1);

        Assert.Equal(expected, job.UcjbClientRefa);
        Assert.True(job.UcjbClientRefa.Length <= 20);
    }

    [Fact]
    public void CreateIccJobEntry_TruncatesReferenceBToFifteenChars()
    {
        var job = JobRepository.CreateIccJobEntry(
            jobNumber: "ICC-001", clientId: 42, courierId: 235, amount: 7m,
            reference: "ref", clientRefB: "this is a very long marker",
            ourRef: "ourRef", note: "note", currentTime: FixedTime, staffId: 1);

        Assert.Equal("this is a very ", job.UcjbClientRefb);
        Assert.True(job.UcjbClientRefb.Length <= 15);
    }

    [Fact]
    public void CreateIccJobEntry_TruncatesOurRefToTwentyChars()
    {
        var job = JobRepository.CreateIccJobEntry(
            jobNumber: "ICC-001", clientId: 42, courierId: 235, amount: 7m,
            reference: "ref", clientRefB: "ICC",
            ourRef: "Some long our-reference value here",
            note: "note", currentTime: FixedTime, staffId: 1);

        Assert.True(job.UcjbOurRef.Length <= 20);
        Assert.Equal("Some long our-refere", job.UcjbOurRef);
    }

    [Fact]
    public void CreateIccJobEntry_HandlesNullReferenceFields()
    {
        // Null safety: legacy DB allowed null references; guard against NRE in case the
        // dialog sends null through (the React form requires reference but defence in depth).
        var job = JobRepository.CreateIccJobEntry(
            jobNumber: "ICC-001", clientId: 42, courierId: 235, amount: 7m,
            reference: null, clientRefB: null, ourRef: null,
            note: "note", currentTime: FixedTime, staffId: 1);

        Assert.Equal(string.Empty, job.UcjbClientRefa);
        Assert.Equal(string.Empty, job.UcjbClientRefb);
        Assert.Equal(string.Empty, job.UcjbOurRef);
    }

    [Fact]
    public void CreateIccJobEntry_RecordsNoteInPickupLine_AndMarksDespatchWebSource()
    {
        var job = JobRepository.CreateIccJobEntry(
            jobNumber: "ICC-001", clientId: 42, courierId: 235, amount: 7m,
            reference: "ref", clientRefB: "ICC", ourRef: "To # 191",
            note: "From # 235 To # 191", currentTime: FixedTime, staffId: 9);

        Assert.Equal("From # 235 To # 191", job.PickupAddressLine1);
        Assert.Equal((int)JobSource.DespatchWeb, job.SourceId);
        Assert.Equal((int)JobServiceType.AllServices, (int)job.UcjbType!.Value);
        Assert.Equal(9, job.UcjbOpId);
    }
}
