using DespatchWeb.Models;
using DespatchWeb.Models.Response;
using DespatchWeb.Services;

namespace DespatchWeb.Tests.Services;

public class AiJobSignalCalculatorTests
{
    private static readonly DateTimeOffset Now = new(2026, 6, 2, 12, 0, 0, TimeSpan.Zero);

    private static JobViewModel MinimalJob() => new()
    {
        Id = 1,
        JobNo = "J100",
        Status = "Active",
        From = "A",
        ToAddress = "B",
        PickupAddress = new AddressViewModel { AddressLine1 = "1 St" },
        DeliveryAddress = new AddressViewModel { AddressLine1 = "2 St" },
        Courier = "Driver",
        FromContactName = "S"
    };

    [Fact]
    public void HealthyJob_ProducesNoNegativeSignals()
    {
        var signals = AiJobSignalCalculator.Compute(MinimalJob(), [], [], Now);

        Assert.Equal(SummarySeverity.Ok, signals.MaxSeverity);
    }

    [Fact]
    public void DeliveryOverdueByOver60Min_ClampsToCritical()
    {
        var job = MinimalJob();
        job.DeliverByTime = Now.AddHours(-2).UtcDateTime;

        var signals = AiJobSignalCalculator.Compute(job, [], [], Now);

        Assert.Equal(SummarySeverity.Critical, signals.MaxSeverity);
        Assert.Contains(signals.Items, s => s.Line.Contains("delivery overdue"));
    }

    [Fact]
    public void DeliveryOverdueLessThan60Min_ClampsToUrgent()
    {
        var job = MinimalJob();
        job.DeliverByTime = Now.AddMinutes(-30).UtcDateTime;

        var signals = AiJobSignalCalculator.Compute(job, [], [], Now);

        Assert.Equal(SummarySeverity.Urgent, signals.MaxSeverity);
    }

    [Fact]
    public void CompletedJob_OverdueIsIgnored()
    {
        var job = MinimalJob();
        job.Done = true;
        job.CompletedTime = Now.AddMinutes(-30).UtcDateTime;
        job.DeliverByTime = Now.AddHours(-2).UtcDateTime;

        var signals = AiJobSignalCalculator.Compute(job, [], [], Now);

        Assert.DoesNotContain(signals.Items, s => s.Line.Contains("overdue"));
    }

    [Fact]
    public void MissingCourierPastPickup_Urgent()
    {
        var job = MinimalJob();
        job.Courier = null;
        job.AssignedCourier = null;
        job.PuTime = Now.AddMinutes(-30).UtcDateTime;

        var signals = AiJobSignalCalculator.Compute(job, [], [], Now);

        Assert.Contains(signals.Items, s => s.Line.Contains("no courier"));
        Assert.Equal(SummarySeverity.Urgent, signals.MaxSeverity);
    }

    [Fact]
    public void MissingPickupAddress_Urgent()
    {
        var job = MinimalJob();
        job.From = null;
        job.PickupAddress = new AddressViewModel();

        var signals = AiJobSignalCalculator.Compute(job, [], [], Now);

        Assert.Contains(signals.Items, s => s.Line.Contains("pickup address"));
        Assert.Equal(SummarySeverity.Urgent, signals.MaxSeverity);
    }

    [Fact]
    public void AttentionFlag_Urgent()
    {
        var job = MinimalJob();
        job.Attention = true;

        var signals = AiJobSignalCalculator.Compute(job, [], [], Now);

        Assert.Contains(signals.Items, s => s.Line.Contains("ATTENTION"));
        Assert.Equal(SummarySeverity.Urgent, signals.MaxSeverity);
    }

    [Fact]
    public void CompletedWithoutPod_Caution()
    {
        var job = MinimalJob();
        job.Done = true;
        job.CompletedTime = Now.AddMinutes(-30).UtcDateTime;
        job.PodPhoto = null;
        job.PodName = null;

        var signals = AiJobSignalCalculator.Compute(job, [], [], Now);

        Assert.Contains(signals.Items, s => s.Line.Contains("no POD"));
    }

    [Fact]
    public void MultipleOverdueOpenTasks_Urgent()
    {
        var job = MinimalJob();
        var events = new List<TaskViewModel>
        {
            new() { Id = 1, Title = "T1", DueDate = Now.AddHours(-1), Closed = false },
            new() { Id = 2, Title = "T2", DueDate = Now.AddHours(-2), Closed = false },
            new() { Id = 3, Title = "T3", DueDate = Now.AddHours(-3), Closed = false },
        };

        var signals = AiJobSignalCalculator.Compute(job, [], events, Now);

        Assert.Contains(signals.Items, s => s.Line.Contains("3 open task"));
        Assert.Equal(SummarySeverity.Urgent, signals.MaxSeverity);
    }

    [Fact]
    public void ImportantNotes_Caution()
    {
        var job = MinimalJob();
        var notes = new List<TucNoteViewModel>
        {
            new()
            {
                NoteId = 1, NoteText = "Important", NoteTypeName = "Internal",
                CreatedByName = "Admin", CreatedDate = Now.AddMinutes(-15),
                IsImportant = true
            }
        };

        var signals = AiJobSignalCalculator.Compute(job, notes, [], Now);

        Assert.Contains(signals.Items, s => s.Line.Contains("IMPORTANT"));
    }

    [Fact]
    public void VoidedJob_DoesNotFlagLateness()
    {
        var job = MinimalJob();
        job.Void = true;
        job.DeliverByTime = Now.AddHours(-3).UtcDateTime;

        var signals = AiJobSignalCalculator.Compute(job, [], [], Now);

        Assert.DoesNotContain(signals.Items, s => s.Line.Contains("overdue"));
        Assert.Contains(signals.Items, s => s.Line.Contains("VOIDED"));
    }

    [Fact]
    public void NullJob_ReturnsEmpty()
    {
        var signals = AiJobSignalCalculator.Compute(null!, [], [], Now);

        Assert.Empty(signals.Items);
        Assert.Equal(SummarySeverity.Ok, signals.MaxSeverity);
    }
}
