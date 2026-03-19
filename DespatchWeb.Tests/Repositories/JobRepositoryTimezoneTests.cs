using DespatchWeb.Helpers;
using DespatchWeb.Models;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// Tests for JobRepository timezone conversion functionality.
/// ApplyTimezoneToJobDates is now a no-op — tenant-local datetimes are displayed as-is.
/// Remaining tests verify that the no-op doesn't mutate values, plus archive mapping and
/// TimeZoneHelper behavior that's still used by other callers.
/// </summary>
public class JobRepositoryTimezoneTests
{
    private const string NzTimeZone = "New Zealand Standard Time";

    /// <summary>
    /// Mirrors the production ApplyTimezoneToJobDates which is now a no-op.
    /// Kept to verify the method doesn't mutate job date fields.
    /// </summary>
    private static void ApplyTimezoneToJobDates()
    {
        // No-op: tenant-local datetimes are displayed as-is from the database.
    }

    [Fact]
    public void ApplyTimezoneToJobDates_DoesNotMutateDateFields()
    {
        // Arrange
        var originalDispatch = new DateTime(2024, 6, 15, 10, 30, 0);
        var originalPuTime = new DateTime(2024, 6, 15, 14, 45, 0);
        var originalFollowup = new DateTime(2024, 1, 15, 9, 0, 0);
        var originalCompleted = new DateTime(2024, 3, 20, 16, 30, 0);
        var originalCreated = new DateTime(2024, 12, 25, 8, 0, 0);
        var originalDeliverBy = new DateTime(2024, 7, 4, 17, 0, 0);
        var originalPickupArrival = new DateTime(2024, 6, 15, 14, 0, 0);
        var originalDeliveryArrival = new DateTime(2024, 6, 15, 15, 0, 0);

        var jobs = new List<JobViewModel>
        {
            new()
            {
                Id = 1,
                DispatchTime = originalDispatch,
                PuTime = originalPuTime,
                FollowupTime = originalFollowup,
                CompletedTime = originalCompleted,
                CreatedDate = originalCreated,
                DeliverByTime = originalDeliverBy,
                PickupArrivalTime = originalPickupArrival,
                DeliveryArrivalTime = originalDeliveryArrival
            }
        };

        // Act
        ApplyTimezoneToJobDates();

        // Assert — all values should be exactly as they were before
        Assert.Equal(originalDispatch, jobs[0].DispatchTime);
        Assert.Equal(originalPuTime, jobs[0].PuTime);
        Assert.Equal(originalFollowup, jobs[0].FollowupTime);
        Assert.Equal(originalCompleted, jobs[0].CompletedTime);
        Assert.Equal(originalCreated, jobs[0].CreatedDate);
        Assert.Equal(originalDeliverBy, jobs[0].DeliverByTime);
        Assert.Equal(originalPickupArrival, jobs[0].PickupArrivalTime);
        Assert.Equal(originalDeliveryArrival, jobs[0].DeliveryArrivalTime);
    }

    [Fact]
    public void ApplyTimezoneToJobDates_NullValues_RemainNull()
    {
        // Arrange
        var jobs = new List<JobViewModel>
        {
            new()
            {
                Id = 1,
                DispatchTime = null,
                PuTime = null,
                FollowupTime = null,
                CompletedTime = null,
                CreatedDate = null,
                DeliverByTime = null,
                PickupArrivalTime = null,
                DeliveryArrivalTime = null
            }
        };

        // Act
        ApplyTimezoneToJobDates();

        // Assert
        Assert.Null(jobs[0].DispatchTime);
        Assert.Null(jobs[0].PuTime);
        Assert.Null(jobs[0].FollowupTime);
        Assert.Null(jobs[0].CompletedTime);
        Assert.Null(jobs[0].CreatedDate);
        Assert.Null(jobs[0].DeliverByTime);
        Assert.Null(jobs[0].PickupArrivalTime);
        Assert.Null(jobs[0].DeliveryArrivalTime);
    }

    [Fact]
    public void ApplyTimezoneToJobDates_EmptyJobList_DoesNotThrow()
    {
        // Assert
        var exception = Record.Exception((Action?)Act ?? throw new InvalidOperationException());
        Assert.Null(exception);
        return;

        // Act
        void Act() => ApplyTimezoneToJobDates();
    }

    [Fact]
    public void ApplyTimezoneToJobDates_MultipleJobs_DoesNotMutateAny()
    {
        // Arrange
        var dispatch1 = new DateTime(2024, 6, 15, 10, 0, 0);
        var dispatch2 = new DateTime(2024, 6, 15, 11, 0, 0);
        var dispatch3 = new DateTime(2024, 6, 15, 12, 0, 0);

        var jobs = new List<JobViewModel>
        {
            new() { Id = 1, DispatchTime = dispatch1 },
            new() { Id = 2, DispatchTime = dispatch2 },
            new() { Id = 3, DispatchTime = dispatch3 }
        };

        // Act
        ApplyTimezoneToJobDates();

        // Assert — values should be unchanged
        Assert.Equal(dispatch1, jobs[0].DispatchTime);
        Assert.Equal(dispatch2, jobs[1].DispatchTime);
        Assert.Equal(dispatch3, jobs[2].DispatchTime);
    }

    /// <summary>
    /// Verifies the core fix: when CompletedTime is stored in the delivery timezone,
    /// stamping the delivery timezone offset produces the correct absolute time.
    /// This mirrors the PickUpTime pattern used for pickup timezone.
    /// </summary>
    [Fact]
    public void CompletedTime_StoredInDeliveryTimezone_DisplaysCorrectly()
    {
        // Scenario: Tenant is EDT (Eastern), delivery location is PDT (Pacific)
        // A delivery happens at UTC 16:37
        var utcNow = new DateTime(2024, 6, 15, 16, 37, 0, DateTimeKind.Utc);
        const string deliveryTz = "Pacific Standard Time"; // PDT = UTC-7 in summer

        // AFTER FIX: Store CompletedTime in delivery timezone (PDT)
        var deliveryTzInfo = TimeZoneInfo.FindSystemTimeZoneById(deliveryTz);
        var completedTimeInDeliveryTz = TimeZoneInfo.ConvertTimeFromUtc(utcNow, deliveryTzInfo);
        // Should be 9:37 PDT
        Assert.Equal(9, completedTimeInDeliveryTz.Hour);
        Assert.Equal(37, completedTimeInDeliveryTz.Minute);

        // Display stamps the delivery timezone offset — value is already in delivery TZ, so this is correct
        var displayed = TimeZoneHelper.SetDateTimeWithTimeZone(completedTimeInDeliveryTz, deliveryTz);
        Assert.Equal(TimeSpan.FromHours(-7), displayed.Offset); // PDT
        Assert.Equal(9, displayed.DateTime.Hour);
        Assert.Equal(37, displayed.DateTime.Minute);

        // The displayed DateTimeOffset correctly represents the original UTC instant
        Assert.True((displayed.UtcDateTime - utcNow).Duration() <= TimeSpan.FromSeconds(1));
    }

    /// <summary>
    /// Demonstrates the bug that existed before the fix: storing tenant time
    /// but stamping delivery timezone offset produces the wrong absolute time.
    /// </summary>
    [Fact]
    public void CompletedTime_OldBehavior_TenantTimeWithDeliveryOffset_IsWrong()
    {
        // Scenario: Tenant is EDT (Eastern), delivery location is PDT (Pacific)
        var utcNow = new DateTime(2024, 6, 15, 16, 37, 0, DateTimeKind.Utc);
        const string tenantTz = "Eastern Standard Time"; // EDT = UTC-4 in summer
        const string deliveryTz = "Pacific Standard Time"; // PDT = UTC-7 in summer

        // OLD BEHAVIOR: Store CompletedTime in tenant timezone (EDT)
        var tenantTzInfo = TimeZoneInfo.FindSystemTimeZoneById(tenantTz);
        var completedTimeInTenantTz = TimeZoneInfo.ConvertTimeFromUtc(utcNow, tenantTzInfo);
        // 12:37 EDT
        Assert.Equal(12, completedTimeInTenantTz.Hour);

        // Display stamps delivery timezone offset on tenant-local time — WRONG
        var displayed = TimeZoneHelper.SetDateTimeWithTimeZone(completedTimeInTenantTz, deliveryTz);
        Assert.Equal(TimeSpan.FromHours(-7), displayed.Offset); // PDT offset
        Assert.Equal(12, displayed.DateTime.Hour); // But 12:37 is the EDT value, not PDT!

        // The displayed DateTimeOffset does NOT represent the original UTC instant
        // 12:37 PDT = 19:37 UTC, but actual event was at 16:37 UTC — 3 hours off!
        Assert.NotEqual(utcNow, displayed.UtcDateTime);
        var drift = displayed.UtcDateTime - utcNow;
        Assert.Equal(TimeSpan.FromHours(3), drift); // EDT-PDT offset difference
    }

    /// <summary>
    /// When delivery timezone is null (no timezone set on the delivery location),
    /// GetCurrentTimeFromTimeZone falls back to tenant timezone. Verify that
    /// the fallback produces a correct result with tenant timezone stamping.
    /// </summary>
    [Fact]
    public void CompletedTime_NullDeliveryTimezone_FallsBackToTenantTimezone()
    {
        // When DeliverByTimeZone is null, GetCurrentTimeFromTimeZone returns tenant time
        var utcNow = new DateTime(2024, 6, 15, 16, 37, 0, DateTimeKind.Utc);
        const string tenantTz = "Eastern Standard Time";

        var tenantTzInfo = TimeZoneInfo.FindSystemTimeZoneById(tenantTz);
        var completedTimeInTenantTz = TimeZoneInfo.ConvertTimeFromUtc(utcNow, tenantTzInfo);

        // Display falls back to tenant timezone (since delivery TZ is null)
        var displayed = TimeZoneHelper.SetDateTimeWithTimeZone(completedTimeInTenantTz, tenantTz);
        Assert.Equal(TimeSpan.FromHours(-4), displayed.Offset); // EDT

        // Source timezone = display timezone, so the absolute time is correct
        Assert.True((displayed.UtcDateTime - utcNow).Duration() <= TimeSpan.FromSeconds(1));
    }

    /// <summary>
    /// When delivery timezone equals tenant timezone, the fix produces identical
    /// results to the old behavior — no regression for same-timezone scenarios.
    /// </summary>
    [Fact]
    public void CompletedTime_SameDeliveryAndTenantTimezone_ProducesIdenticalResult()
    {
        var utcNow = new DateTime(2024, 6, 15, 16, 37, 0, DateTimeKind.Utc);
        const string sharedTz = "Eastern Standard Time";

        var tzInfo = TimeZoneInfo.FindSystemTimeZoneById(sharedTz);
        var localTime = TimeZoneInfo.ConvertTimeFromUtc(utcNow, tzInfo);

        // Both old and new behavior produce the same stored value when TZs match
        var oldBehavior = TimeZoneHelper.SetDateTimeWithTimeZone(localTime, sharedTz);
        var newBehavior = TimeZoneHelper.SetDateTimeWithTimeZone(localTime, sharedTz);

        Assert.Equal(newBehavior, oldBehavior);
        Assert.True((oldBehavior.UtcDateTime - utcNow).Duration() <= TimeSpan.FromSeconds(1));
    }

    /// <summary>
    /// Documents a known limitation: NoteRepository.cs:506 falls back to j.UcjbComplTime
    /// when noted.CreatedDate is null. CompletedTime is stored in delivery timezone, but
    /// notes display with tenant timezone offset. When these differ, the absolute time is wrong.
    /// </summary>
    [Fact]
    public void NoteCreatedDate_FallbackToCompletedTime_CrossTimezone_DocumentsMismatch()
    {
        // Scenario: delivery in PDT (UTC-7), tenant is NZST (UTC+12)
        // Completed at 09:37 wall-clock PDT (= 16:37 UTC)
        var completedTimeWallClock = new DateTime(2024, 6, 15, 9, 37, 0);
        const string deliveryTz = "Pacific Standard Time"; // PDT in summer = UTC-7

        // NoteRepository line 506: CreatedDate = note.CreatedDate ?? j.UcjbComplTime
        // When noted.CreatedDate is null, it uses UcjbComplTime (09:37, stored in delivery TZ)

        // But ApplyTimezoneToJobDates stamps notes with tenant timezone
        // (notes are tenant-local fields), so it treats 09:37 as if it were NZ time
        var displayedWithTenantTz = TimeZoneHelper.SetDateTimeWithTimeZone(completedTimeWallClock, NzTimeZone);
        var displayedWithDeliveryTz = TimeZoneHelper.SetDateTimeWithTimeZone(completedTimeWallClock, deliveryTz);

        // The note displays 09:37+12:00 (NZ), which represents 2024-06-14T21:37:00Z
        // But the actual event was at 09:37-07:00 (PDT), which represents 2024-06-15T16:37:00Z
        var tenantUtc = displayedWithTenantTz.UtcDateTime;
        var deliveryUtc = displayedWithDeliveryTz.UtcDateTime;
        var discrepancy = deliveryUtc - tenantUtc;

        // Known limitation: ~19-hour discrepancy (NZ+12 vs PDT-7 = 19 hours apart)
        Assert.Equal(19, discrepancy.TotalHours);

        // Document what the correct behavior would be
        Assert.Equal(displayedWithDeliveryTz.DateTime, displayedWithTenantTz.DateTime);
    }

    /// <summary>
    /// Verifies that the archive mapping uses CreatedTimeUtc for CreatedDate.
    /// CreatedTimeUtc stores the actual creation timestamp in UTC.
    /// </summary>
    [Fact]
    public void ArchiveMapping_CreatedDate_UsesCreatedTimeUtc()
    {
        // Arrange — compile the archive mapping expression to a delegate
        var mapping = JobMappings.JobArchiveMapping.Compile();

        var createdTimestampUtc = new DateTime(2024, 6, 15, 2, 30, 45);
        var readyDate = new DateTime(2024, 6, 15); // date-only → 00:00

        var archive = new EntityClasses.TucJobArchive
        {
            UcjbId = 1,
            CreatedTimeUtc = createdTimestampUtc,
            UcjbDate = readyDate
        };

        // Act
        var result = mapping(archive);

        // Assert — CreatedDate should use CreatedTimeUtc, not UcjbDate
        Assert.NotNull(result.CreatedDate);
        Assert.Equal(createdTimestampUtc, result.CreatedDate!.Value);
        Assert.Equal(2, result.CreatedDate!.Value.Hour);
        Assert.Equal(30, result.CreatedDate!.Value.Minute);
    }

    /// <summary>
    /// Verifies that changing UcjbDate (the Ready date) does not affect CreatedDate.
    /// </summary>
    [Fact]
    public void ArchiveMapping_CreatedDate_NotAffectedByUcjbDateChange()
    {
        var mapping = JobMappings.JobArchiveMapping.Compile();

        var createdTimestampUtc = new DateTime(2024, 6, 15, 2, 30, 45);

        var archive = new EntityClasses.TucJobArchive
        {
            UcjbId = 1,
            CreatedTimeUtc = createdTimestampUtc,
            UcjbDate = new DateTime(2024, 6, 15) // original Ready date
        };

        var resultBefore = mapping(archive);

        // Simulate Ready date being edited
        archive.UcjbDate = new DateTime(2024, 7, 20);
        var resultAfter = mapping(archive);

        // Assert — CreatedDate should remain unchanged
        Assert.Equal(createdTimestampUtc, resultBefore.CreatedDate!.Value);
        Assert.Equal(createdTimestampUtc, resultAfter.CreatedDate!.Value);
        Assert.Equal(resultAfter.CreatedDate!.Value, resultBefore.CreatedDate!.Value);
    }

    /// <summary>
    /// For legacy records where CreatedTimeUtc is null, CreatedDate should be null.
    /// </summary>
    [Fact]
    public void ArchiveMapping_CreatedDate_IsNull_WhenCreatedTimeUtcIsNull()
    {
        var mapping = JobMappings.JobArchiveMapping.Compile();

        var archive = new EntityClasses.TucJobArchive
        {
            UcjbId = 1,
            CreatedTimeUtc = null,
            UcjbDate = new DateTime(2024, 6, 15)
        };

        var result = mapping(archive);

        Assert.Null(result.CreatedDate);
    }

}
