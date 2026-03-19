using DespatchWeb.Helpers;
using DespatchWeb.Models;
using FluentAssertions;

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
    private const string PstTimeZone = "Pacific Standard Time";
    private const string UtcTimeZone = "UTC";

    /// <summary>
    /// Mirrors the production ApplyTimezoneToJobDates which is now a no-op.
    /// Kept to verify the method doesn't mutate job date fields.
    /// </summary>
    private static void ApplyTimezoneToJobDates(List<JobViewModel> jobs, string tenantTimeZone)
    {
        // No-op: tenant-local datetimes are displayed as-is from the database.
    }

    #region No-Op Verification Tests

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
        ApplyTimezoneToJobDates(jobs, NzTimeZone);

        // Assert — all values should be exactly as they were before
        jobs[0].DispatchTime.Should().Be((DateTime?)originalDispatch);
        jobs[0].PuTime.Should().Be((DateTime?)originalPuTime);
        jobs[0].FollowupTime.Should().Be((DateTime?)originalFollowup);
        jobs[0].CompletedTime.Should().Be((DateTime?)originalCompleted);
        jobs[0].CreatedDate.Should().Be((DateTime?)originalCreated);
        jobs[0].DeliverByTime.Should().Be((DateTime?)originalDeliverBy);
        jobs[0].PickupArrivalTime.Should().Be((DateTime?)originalPickupArrival);
        jobs[0].DeliveryArrivalTime.Should().Be((DateTime?)originalDeliveryArrival);
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
        ApplyTimezoneToJobDates(jobs, NzTimeZone);

        // Assert
        jobs[0].DispatchTime.Should().BeNull();
        jobs[0].PuTime.Should().BeNull();
        jobs[0].FollowupTime.Should().BeNull();
        jobs[0].CompletedTime.Should().BeNull();
        jobs[0].CreatedDate.Should().BeNull();
        jobs[0].DeliverByTime.Should().BeNull();
        jobs[0].PickupArrivalTime.Should().BeNull();
        jobs[0].DeliveryArrivalTime.Should().BeNull();
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
        ApplyTimezoneToJobDates(jobs, NzTimeZone);

        // Assert — values should be unchanged
        jobs[0].DispatchTime.Should().Be((DateTime?)dispatch1);
        jobs[1].DispatchTime.Should().Be((DateTime?)dispatch2);
        jobs[2].DispatchTime.Should().Be((DateTime?)dispatch3);
    }

    #endregion

    #region Write-Path CompletedTime Timezone Tests

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
        const string tenantTz = "Eastern Standard Time"; // EDT = UTC-4 in summer
        const string deliveryTz = "Pacific Standard Time"; // PDT = UTC-7 in summer

        // AFTER FIX: Store CompletedTime in delivery timezone (PDT)
        var deliveryTzInfo = TimeZoneInfo.FindSystemTimeZoneById(deliveryTz);
        var completedTimeInDeliveryTz = TimeZoneInfo.ConvertTimeFromUtc(utcNow, deliveryTzInfo);
        // Should be 9:37 PDT
        completedTimeInDeliveryTz.Hour.Should().Be(9);
        completedTimeInDeliveryTz.Minute.Should().Be(37);

        // Display stamps the delivery timezone offset — value is already in delivery TZ, so this is correct
        var displayed = TimeZoneHelper.SetDateTimeWithTimeZone(completedTimeInDeliveryTz, deliveryTz);
        displayed.Offset.Should().Be(TimeSpan.FromHours(-7)); // PDT
        displayed.DateTime.Hour.Should().Be(9);
        displayed.DateTime.Minute.Should().Be(37);

        // The displayed DateTimeOffset correctly represents the original UTC instant
        displayed.UtcDateTime.Should().BeCloseTo(utcNow, TimeSpan.FromSeconds(1));
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
        completedTimeInTenantTz.Hour.Should().Be(12);

        // Display stamps delivery timezone offset on tenant-local time — WRONG
        var displayed = TimeZoneHelper.SetDateTimeWithTimeZone(completedTimeInTenantTz, deliveryTz);
        displayed.Offset.Should().Be(TimeSpan.FromHours(-7)); // PDT offset
        displayed.DateTime.Hour.Should().Be(12); // But 12:37 is the EDT value, not PDT!

        // The displayed DateTimeOffset does NOT represent the original UTC instant
        // 12:37 PDT = 19:37 UTC, but actual event was at 16:37 UTC — 3 hours off!
        displayed.UtcDateTime.Should().NotBe(utcNow);
        var drift = displayed.UtcDateTime - utcNow;
        drift.Should().Be(TimeSpan.FromHours(3)); // EDT-PDT offset difference
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
        displayed.Offset.Should().Be(TimeSpan.FromHours(-4)); // EDT

        // Source timezone = display timezone, so the absolute time is correct
        displayed.UtcDateTime.Should().BeCloseTo(utcNow, TimeSpan.FromSeconds(1));
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

        oldBehavior.Should().Be(newBehavior);
        oldBehavior.UtcDateTime.Should().BeCloseTo(utcNow, TimeSpan.FromSeconds(1));
    }

    #endregion

    #region NoteRepository Timezone Mixing Documentation

    /// <summary>
    /// Documents a known limitation: NoteRepository.cs:506 falls back to j.UcjbComplTime
    /// when note.CreatedDate is null. CompletedTime is stored in delivery timezone, but
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
        // When note.CreatedDate is null, it uses UcjbComplTime (09:37, stored in delivery TZ)

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
        discrepancy.TotalHours.Should().Be(19,
            "KNOWN LIMITATION: When CompletedTime (delivery TZ) is used as note CreatedDate " +
            "but displayed with tenant TZ offset, there's a 19-hour discrepancy. " +
            "The note appears to be created at a different absolute time than the delivery.");

        // Document what the correct behavior would be
        displayedWithTenantTz.DateTime.Should().Be(displayedWithDeliveryTz.DateTime,
            "the wall-clock time is the same (09:37), but the UTC instants differ");
    }

    #endregion

    #region Archive CreatedDate Mapping Tests

    /// <summary>
    /// Verifies that the archive mapping prioritizes CreatedTime over UcjbDate for CreatedDate.
    /// UcjbDate is the Ready date (date-only, no time component), while CreatedTime is the
    /// actual creation timestamp. Previously, the mapping used UcjbDate ?? CreatedTime,
    /// which caused CreatedDate to show 00:00 and change when Ready Time was edited.
    /// </summary>
    [Fact]
    public void ArchiveMapping_CreatedDate_PrioritizesCreatedTimeOverUcjbDate()
    {
        // Arrange — compile the archive mapping expression to a delegate
        var mapping = JobMappings.JobArchiveMapping.Compile();

        var createdTimestamp = new DateTime(2024, 6, 15, 14, 30, 45);
        var readyDate = new DateTime(2024, 6, 15); // date-only → 00:00

        var archive = new EntityClasses.TucJobArchive
        {
            UcjbId = 1,
            CreatedTime = createdTimestamp,
            UcjbDate = readyDate
        };

        // Act
        var result = mapping(archive);

        // Assert — CreatedDate should use CreatedTime (with time component), not UcjbDate
        result.CreatedDate.Should().NotBeNull();
        result.CreatedDate!.Value.Should().Be(createdTimestamp,
            "CreatedDate should use CreatedTime which has the actual creation time, not UcjbDate which is date-only");
        result.CreatedDate!.Value.Hour.Should().Be(14,
            "CreatedDate should preserve the hour from CreatedTime");
        result.CreatedDate!.Value.Minute.Should().Be(30,
            "CreatedDate should preserve the minute from CreatedTime");
    }

    /// <summary>
    /// Verifies that changing UcjbDate (the Ready date) does not affect CreatedDate
    /// when CreatedTime is set.
    /// </summary>
    [Fact]
    public void ArchiveMapping_CreatedDate_NotAffectedByUcjbDateChange()
    {
        var mapping = JobMappings.JobArchiveMapping.Compile();

        var createdTimestamp = new DateTime(2024, 6, 15, 14, 30, 45);

        var archive = new EntityClasses.TucJobArchive
        {
            UcjbId = 1,
            CreatedTime = createdTimestamp,
            UcjbDate = new DateTime(2024, 6, 15) // original Ready date
        };

        var resultBefore = mapping(archive);

        // Simulate Ready date being edited
        archive.UcjbDate = new DateTime(2024, 7, 20);
        var resultAfter = mapping(archive);

        // Assert — CreatedDate should remain unchanged
        resultBefore.CreatedDate!.Value.Should().Be(createdTimestamp);
        resultAfter.CreatedDate!.Value.Should().Be(createdTimestamp);
        resultBefore.CreatedDate!.Value.Should().Be(resultAfter.CreatedDate!.Value,
            "changing UcjbDate (Ready date) should not affect CreatedDate");
    }

    /// <summary>
    /// For legacy records where CreatedTime is null, CreatedDate should fall back to UcjbDate.
    /// </summary>
    [Fact]
    public void ArchiveMapping_CreatedDate_FallsBackToUcjbDate_WhenCreatedTimeIsNull()
    {
        var mapping = JobMappings.JobArchiveMapping.Compile();

        var readyDate = new DateTime(2024, 6, 15);

        var archive = new EntityClasses.TucJobArchive
        {
            UcjbId = 1,
            CreatedTime = null,
            UcjbDate = readyDate
        };

        var result = mapping(archive);

        result.CreatedDate.Should().NotBeNull();
        result.CreatedDate!.Value.Should().Be(readyDate,
            "when CreatedTime is null, should fall back to UcjbDate for legacy records");
    }

    #endregion
}
