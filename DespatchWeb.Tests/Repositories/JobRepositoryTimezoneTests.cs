using DespatchWeb.Helpers;
using DespatchWeb.Models;
using FluentAssertions;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// Tests for JobRepository timezone conversion functionality.
/// Tests that JobViewModel date fields are correctly converted to DateTimeOffset with tenant timezone.
/// </summary>
public class JobRepositoryTimezoneTests
{
    private const string NzTimeZone = "New Zealand Standard Time";
    private const string PstTimeZone = "Pacific Standard Time";
    private const string UtcTimeZone = "UTC";

    /// <summary>
    /// Helper method that mimics the ApplyTimezoneToJobDates logic from JobRepository.
    /// This allows us to test the timezone conversion behavior in isolation.
    /// </summary>
    private static void ApplyTimezoneToJobDates(List<JobViewModel> jobs, string tenantTimeZone)
    {
        foreach (var job in jobs)
        {
            if (job.DispatchTime.HasValue)
                job.DispatchTime = TimeZoneHelper.SetDateTimeWithTimeZone(job.DispatchTime.Value, tenantTimeZone);

            if (job.PuTime.HasValue)
                job.PuTime = TimeZoneHelper.SetDateTimeWithTimeZone(job.PuTime.Value, tenantTimeZone);

            if (job.FollowupTime.HasValue)
                job.FollowupTime = TimeZoneHelper.SetDateTimeWithTimeZone(job.FollowupTime.Value, tenantTimeZone);

            if (job.CompletedTime.HasValue)
                job.CompletedTime = TimeZoneHelper.SetDateTimeWithTimeZone(job.CompletedTime.Value, tenantTimeZone);

            if (job.CreatedDate.HasValue)
                job.CreatedDate = TimeZoneHelper.SetDateTimeWithTimeZone(job.CreatedDate.Value, tenantTimeZone);

            if (job.DeliverByTime.HasValue)
                job.DeliverByTime = TimeZoneHelper.SetDateTimeWithTimeZone(job.DeliverByTime.Value, tenantTimeZone);
        }
    }

    #region DispatchTime Tests

    [Fact]
    public void ApplyTimezoneToJobDates_DispatchTime_AppliesNzTimezone()
    {
        // Arrange
        var jobs = new List<JobViewModel>
        {
            new() { Id = 1, DispatchTime = new DateTimeOffset(2024, 6, 15, 10, 30, 0, TimeSpan.Zero) }
        };

        // Act
        ApplyTimezoneToJobDates(jobs, NzTimeZone);

        // Assert - NZ is UTC+12 in winter
        jobs[0].DispatchTime!.Value.Offset.Should().Be(TimeSpan.FromHours(12));
        jobs[0].DispatchTime!.Value.DateTime.Should().Be(new DateTime(2024, 6, 15, 10, 30, 0));
    }

    [Fact]
    public void ApplyTimezoneToJobDates_DispatchTime_WhenNull_RemainsNull()
    {
        // Arrange
        var jobs = new List<JobViewModel>
        {
            new() { Id = 1, DispatchTime = null }
        };

        // Act
        ApplyTimezoneToJobDates(jobs, NzTimeZone);

        // Assert
        jobs[0].DispatchTime.Should().BeNull();
    }

    #endregion

    #region PuTime Tests

    [Fact]
    public void ApplyTimezoneToJobDates_PuTime_AppliesNzTimezone()
    {
        // Arrange
        var jobs = new List<JobViewModel>
        {
            new() { Id = 1, PuTime = new DateTimeOffset(2024, 6, 15, 14, 45, 0, TimeSpan.Zero) }
        };

        // Act
        ApplyTimezoneToJobDates(jobs, NzTimeZone);

        // Assert
        jobs[0].PuTime!.Value.Offset.Should().Be(TimeSpan.FromHours(12));
        jobs[0].PuTime!.Value.DateTime.Should().Be(new DateTime(2024, 6, 15, 14, 45, 0));
    }

    [Fact]
    public void ApplyTimezoneToJobDates_PuTime_WhenNull_RemainsNull()
    {
        // Arrange
        var jobs = new List<JobViewModel>
        {
            new() { Id = 1, PuTime = null }
        };

        // Act
        ApplyTimezoneToJobDates(jobs, NzTimeZone);

        // Assert
        jobs[0].PuTime.Should().BeNull();
    }

    #endregion

    #region FollowupTime Tests

    [Fact]
    public void ApplyTimezoneToJobDates_FollowupTime_AppliesPstTimezone()
    {
        // Arrange
        var jobs = new List<JobViewModel>
        {
            new() { Id = 1, FollowupTime = new DateTimeOffset(2024, 1, 15, 9, 0, 0, TimeSpan.Zero) }
        };

        // Act
        ApplyTimezoneToJobDates(jobs, PstTimeZone);

        // Assert - PST is UTC-8 in winter
        jobs[0].FollowupTime!.Value.Offset.Should().Be(TimeSpan.FromHours(-8));
        jobs[0].FollowupTime!.Value.DateTime.Should().Be(new DateTime(2024, 1, 15, 9, 0, 0));
    }

    [Fact]
    public void ApplyTimezoneToJobDates_FollowupTime_WhenNull_RemainsNull()
    {
        // Arrange
        var jobs = new List<JobViewModel>
        {
            new() { Id = 1, FollowupTime = null }
        };

        // Act
        ApplyTimezoneToJobDates(jobs, PstTimeZone);

        // Assert
        jobs[0].FollowupTime.Should().BeNull();
    }

    #endregion

    #region CompletedTime Tests

    [Fact]
    public void ApplyTimezoneToJobDates_CompletedTime_AppliesUtcTimezone()
    {
        // Arrange
        var jobs = new List<JobViewModel>
        {
            new() { Id = 1, CompletedTime = new DateTimeOffset(2024, 3, 20, 16, 30, 0, TimeSpan.Zero) }
        };

        // Act
        ApplyTimezoneToJobDates(jobs, UtcTimeZone);

        // Assert
        jobs[0].CompletedTime!.Value.Offset.Should().Be(TimeSpan.Zero);
        jobs[0].CompletedTime!.Value.DateTime.Should().Be(new DateTime(2024, 3, 20, 16, 30, 0));
    }

    [Fact]
    public void ApplyTimezoneToJobDates_CompletedTime_WhenNull_RemainsNull()
    {
        // Arrange
        var jobs = new List<JobViewModel>
        {
            new() { Id = 1, CompletedTime = null }
        };

        // Act
        ApplyTimezoneToJobDates(jobs, UtcTimeZone);

        // Assert
        jobs[0].CompletedTime.Should().BeNull();
    }

    #endregion

    #region CreatedDate Tests

    [Fact]
    public void ApplyTimezoneToJobDates_CreatedDate_AppliesNzTimezone()
    {
        // Arrange
        var jobs = new List<JobViewModel>
        {
            new() { Id = 1, CreatedDate = new DateTimeOffset(2024, 12, 25, 8, 0, 0, TimeSpan.Zero) }
        };

        // Act
        ApplyTimezoneToJobDates(jobs, NzTimeZone);

        // Assert - NZ is UTC+13 in summer (December) due to daylight saving
        jobs[0].CreatedDate!.Value.Offset.Should().Be(TimeSpan.FromHours(13));
        jobs[0].CreatedDate!.Value.DateTime.Should().Be(new DateTime(2024, 12, 25, 8, 0, 0));
    }

    [Fact]
    public void ApplyTimezoneToJobDates_CreatedDate_WhenNull_RemainsNull()
    {
        // Arrange
        var jobs = new List<JobViewModel>
        {
            new() { Id = 1, CreatedDate = null }
        };

        // Act
        ApplyTimezoneToJobDates(jobs, NzTimeZone);

        // Assert
        jobs[0].CreatedDate.Should().BeNull();
    }

    #endregion

    #region DeliverByTime Tests

    [Fact]
    public void ApplyTimezoneToJobDates_DeliverByTime_AppliesPstTimezone()
    {
        // Arrange
        var jobs = new List<JobViewModel>
        {
            new() { Id = 1, DeliverByTime = new DateTimeOffset(2024, 7, 4, 17, 0, 0, TimeSpan.Zero) }
        };

        // Act
        ApplyTimezoneToJobDates(jobs, PstTimeZone);

        // Assert - PST becomes PDT (UTC-7) in summer
        jobs[0].DeliverByTime!.Value.Offset.Should().Be(TimeSpan.FromHours(-7));
        jobs[0].DeliverByTime!.Value.DateTime.Should().Be(new DateTime(2024, 7, 4, 17, 0, 0));
    }

    [Fact]
    public void ApplyTimezoneToJobDates_DeliverByTime_WhenNull_RemainsNull()
    {
        // Arrange
        var jobs = new List<JobViewModel>
        {
            new() { Id = 1, DeliverByTime = null }
        };

        // Act
        ApplyTimezoneToJobDates(jobs, PstTimeZone);

        // Assert
        jobs[0].DeliverByTime.Should().BeNull();
    }

    #endregion

    #region Multiple Jobs Tests

    [Fact]
    public void ApplyTimezoneToJobDates_MultipleJobs_AppliesTimezoneToAll()
    {
        // Arrange
        var jobs = new List<JobViewModel>
        {
            new() { Id = 1, DispatchTime = new DateTimeOffset(2024, 6, 15, 10, 0, 0, TimeSpan.Zero) },
            new() { Id = 2, DispatchTime = new DateTimeOffset(2024, 6, 15, 11, 0, 0, TimeSpan.Zero) },
            new() { Id = 3, DispatchTime = new DateTimeOffset(2024, 6, 15, 12, 0, 0, TimeSpan.Zero) }
        };

        // Act
        ApplyTimezoneToJobDates(jobs, NzTimeZone);

        // Assert - All jobs should have NZ timezone applied
        jobs.Should().AllSatisfy(j => j.DispatchTime!.Value.Offset.Should().Be(TimeSpan.FromHours(12)));
    }

    [Fact]
    public void ApplyTimezoneToJobDates_MixedNullAndPopulatedDates_HandlesCorrectly()
    {
        // Arrange
        var jobs = new List<JobViewModel>
        {
            new()
            {
                Id = 1,
                DispatchTime = new DateTimeOffset(2024, 6, 15, 10, 0, 0, TimeSpan.Zero),
                PuTime = null,
                CompletedTime = new DateTimeOffset(2024, 6, 15, 15, 0, 0, TimeSpan.Zero),
                CreatedDate = null,
                DeliverByTime = new DateTimeOffset(2024, 6, 15, 14, 0, 0, TimeSpan.Zero),
                FollowupTime = null
            }
        };

        // Act
        ApplyTimezoneToJobDates(jobs, NzTimeZone);

        // Assert
        jobs[0].DispatchTime!.Value.Offset.Should().Be(TimeSpan.FromHours(12));
        jobs[0].PuTime.Should().BeNull();
        jobs[0].CompletedTime!.Value.Offset.Should().Be(TimeSpan.FromHours(12));
        jobs[0].CreatedDate.Should().BeNull();
        jobs[0].DeliverByTime!.Value.Offset.Should().Be(TimeSpan.FromHours(12));
        jobs[0].FollowupTime.Should().BeNull();
    }

    [Fact]
    public void ApplyTimezoneToJobDates_EmptyJobList_DoesNotThrow()
    {
        // Arrange
        var jobs = new List<JobViewModel>();

        // Act
        var act = () => ApplyTimezoneToJobDates(jobs, NzTimeZone);

        // Assert
        act.Should().NotThrow();
    }

    #endregion

    #region All Fields Populated Tests

    [Fact]
    public void ApplyTimezoneToJobDates_AllFieldsPopulated_AppliesTimezoneToAll()
    {
        // Arrange
        var baseDate = new DateTimeOffset(2024, 6, 15, 12, 0, 0, TimeSpan.Zero);
        var jobs = new List<JobViewModel>
        {
            new()
            {
                Id = 1,
                DispatchTime = baseDate,
                PuTime = baseDate.AddHours(1),
                FollowupTime = baseDate.AddHours(2),
                CompletedTime = baseDate.AddHours(3),
                CreatedDate = baseDate.AddDays(-1),
                DeliverByTime = baseDate.AddHours(4)
            }
        };

        // Act
        ApplyTimezoneToJobDates(jobs, NzTimeZone);

        // Assert - All fields should have NZ timezone offset
        var expectedOffset = TimeSpan.FromHours(12);
        jobs[0].DispatchTime!.Value.Offset.Should().Be(expectedOffset);
        jobs[0].PuTime!.Value.Offset.Should().Be(expectedOffset);
        jobs[0].FollowupTime!.Value.Offset.Should().Be(expectedOffset);
        jobs[0].CompletedTime!.Value.Offset.Should().Be(expectedOffset);
        jobs[0].CreatedDate!.Value.Offset.Should().Be(expectedOffset);
        jobs[0].DeliverByTime!.Value.Offset.Should().Be(expectedOffset);
    }

    #endregion
}
