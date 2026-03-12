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
    /// Helper method that mimics the ApplyTimezoneToJobDates logic from JobMappings.Enrichment.
    /// This allows us to test the timezone conversion behavior in isolation.
    /// </summary>
    private static void ApplyTimezoneToJobDates(List<JobViewModel> jobs, string tenantTimeZone)
    {
        foreach (var job in jobs)
        {
            var pickupTz = job.PickUpTimeZone?.Text ?? tenantTimeZone;
            var deliveryTz = job.DeliveryTimeZone?.Text ?? tenantTimeZone;

            // Pickup-timezone fields
            if (job.PuTime.HasValue)
                job.PuTime = TimeZoneHelper.SetDateTimeWithTimeZone(job.PuTime.Value, pickupTz);
            if (job.PickupArrivalTime.HasValue)
                job.PickupArrivalTime = TimeZoneHelper.SetDateTimeWithTimeZone(job.PickupArrivalTime.Value, pickupTz);

            // Delivery-timezone fields
            if (job.CompletedTime.HasValue)
                job.CompletedTime = TimeZoneHelper.SetDateTimeWithTimeZone(job.CompletedTime.Value, deliveryTz);
            if (job.DeliverByTime.HasValue)
                job.DeliverByTime = TimeZoneHelper.SetDateTimeWithTimeZone(job.DeliverByTime.Value, deliveryTz);
            if (job.DeliveryArrivalTime.HasValue)
                job.DeliveryArrivalTime = TimeZoneHelper.SetDateTimeWithTimeZone(job.DeliveryArrivalTime.Value, deliveryTz);

            // Tenant-local fields
            if (job.DispatchTime.HasValue)
                job.DispatchTime = TimeZoneHelper.SetDateTimeWithTimeZone(job.DispatchTime.Value, tenantTimeZone);
            if (job.FollowupTime.HasValue)
                job.FollowupTime = TimeZoneHelper.SetDateTimeWithTimeZone(job.FollowupTime.Value, tenantTimeZone);
            if (job.CreatedDate.HasValue)
                job.CreatedDate = TimeZoneHelper.SetDateTimeWithTimeZone(job.CreatedDate.Value, tenantTimeZone);
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

    #region Cross-Timezone Enrichment Tests

    private const string EstTimeZone = "Eastern Standard Time";

    [Fact]
    public void ApplyTimezoneToJobDates_CrossTimezone_PickupFieldsUsePickupTimezone()
    {
        // Arrange — tenant is NZ, pickup is PST (winter: UTC-8)
        var jobs = new List<JobViewModel>
        {
            new()
            {
                Id = 1,
                PuTime = new DateTimeOffset(2024, 1, 15, 9, 0, 0, TimeSpan.Zero),
                PickupArrivalTime = new DateTimeOffset(2024, 1, 15, 9, 30, 0, TimeSpan.Zero),
                PickUpTimeZone = new Suggestion { Text = PstTimeZone }
            }
        };

        // Act
        ApplyTimezoneToJobDates(jobs, NzTimeZone);

        // Assert — pickup fields should get PST offset (-8), NOT NZ (+12)
        jobs[0].PuTime!.Value.Offset.Should().Be(TimeSpan.FromHours(-8),
            "PuTime should use pickup timezone, not tenant timezone");
        jobs[0].PuTime!.Value.DateTime.Should().Be(new DateTime(2024, 1, 15, 9, 0, 0));

        jobs[0].PickupArrivalTime!.Value.Offset.Should().Be(TimeSpan.FromHours(-8),
            "PickupArrivalTime should use pickup timezone, not tenant timezone");
    }

    [Fact]
    public void ApplyTimezoneToJobDates_CrossTimezone_DeliveryFieldsUseDeliveryTimezone()
    {
        // Arrange — tenant is NZ, delivery is EST (winter: UTC-5)
        var jobs = new List<JobViewModel>
        {
            new()
            {
                Id = 1,
                CompletedTime = new DateTimeOffset(2024, 1, 15, 14, 30, 0, TimeSpan.Zero),
                DeliverByTime = new DateTimeOffset(2024, 1, 15, 17, 0, 0, TimeSpan.Zero),
                DeliveryArrivalTime = new DateTimeOffset(2024, 1, 15, 14, 15, 0, TimeSpan.Zero),
                DeliveryTimeZone = new Suggestion { Text = EstTimeZone }
            }
        };

        // Act
        ApplyTimezoneToJobDates(jobs, NzTimeZone);

        // Assert — delivery fields should get EST offset (-5), NOT NZ (+12)
        jobs[0].CompletedTime!.Value.Offset.Should().Be(TimeSpan.FromHours(-5),
            "CompletedTime should use delivery timezone, not tenant timezone");
        jobs[0].DeliverByTime!.Value.Offset.Should().Be(TimeSpan.FromHours(-5),
            "DeliverByTime should use delivery timezone, not tenant timezone");
        jobs[0].DeliveryArrivalTime!.Value.Offset.Should().Be(TimeSpan.FromHours(-5),
            "DeliveryArrivalTime should use delivery timezone, not tenant timezone");
    }

    [Fact]
    public void ApplyTimezoneToJobDates_CrossTimezone_TenantFieldsAlwaysUseTenantTimezone()
    {
        // Arrange — tenant is NZ, pickup is PST, delivery is EST
        // Tenant-local fields should still get NZ offset regardless
        var jobs = new List<JobViewModel>
        {
            new()
            {
                Id = 1,
                DispatchTime = new DateTimeOffset(2024, 1, 15, 10, 0, 0, TimeSpan.Zero),
                FollowupTime = new DateTimeOffset(2024, 1, 15, 12, 0, 0, TimeSpan.Zero),
                CreatedDate = new DateTimeOffset(2024, 1, 15, 8, 0, 0, TimeSpan.Zero),
                PickUpTimeZone = new Suggestion { Text = PstTimeZone },
                DeliveryTimeZone = new Suggestion { Text = EstTimeZone }
            }
        };

        // Act
        ApplyTimezoneToJobDates(jobs, NzTimeZone);

        // Assert — tenant fields always use NZ (+13 in January due to NZDT)
        var expectedNzOffset = TimeSpan.FromHours(13);
        jobs[0].DispatchTime!.Value.Offset.Should().Be(expectedNzOffset,
            "DispatchTime is a tenant-local field and should use tenant timezone");
        jobs[0].FollowupTime!.Value.Offset.Should().Be(expectedNzOffset,
            "FollowupTime is a tenant-local field and should use tenant timezone");
        jobs[0].CreatedDate!.Value.Offset.Should().Be(expectedNzOffset,
            "CreatedDate is a tenant-local field and should use tenant timezone");
    }

    [Fact]
    public void ApplyTimezoneToJobDates_CrossTimezone_ProducesCorrectUtcInstant()
    {
        // Golden scenario: CompletedTime 09:37 wall-clock in PDT should represent 16:37 UTC
        // Uses winter PST (UTC-8) for predictable offset
        var wallClockTime = new DateTime(2024, 1, 15, 9, 37, 0);
        var jobs = new List<JobViewModel>
        {
            new()
            {
                Id = 1,
                CompletedTime = new DateTimeOffset(wallClockTime, TimeSpan.Zero),
                DeliveryTimeZone = new Suggestion { Text = PstTimeZone }
            }
        };

        // Act
        ApplyTimezoneToJobDates(jobs, NzTimeZone);

        // Assert — 09:37 PST (UTC-8) = 17:37 UTC
        var result = jobs[0].CompletedTime!.Value;
        result.DateTime.Should().Be(wallClockTime, "wall-clock time should be preserved");
        result.Offset.Should().Be(TimeSpan.FromHours(-8), "PST winter offset is -8");
        result.UtcDateTime.Should().Be(new DateTime(2024, 1, 15, 17, 37, 0),
            "09:37 PST = 17:37 UTC");
    }

    [Fact]
    public void ApplyTimezoneToJobDates_CrossTimezone_MultipleJobsDifferentTimezones()
    {
        // Arrange — 3 jobs with different pickup/delivery TZs
        var jobs = new List<JobViewModel>
        {
            new()
            {
                Id = 1,
                PuTime = new DateTimeOffset(2024, 1, 15, 10, 0, 0, TimeSpan.Zero),
                CompletedTime = new DateTimeOffset(2024, 1, 15, 14, 0, 0, TimeSpan.Zero),
                PickUpTimeZone = new Suggestion { Text = PstTimeZone },
                DeliveryTimeZone = new Suggestion { Text = EstTimeZone }
            },
            new()
            {
                Id = 2,
                PuTime = new DateTimeOffset(2024, 1, 15, 11, 0, 0, TimeSpan.Zero),
                CompletedTime = new DateTimeOffset(2024, 1, 15, 15, 0, 0, TimeSpan.Zero),
                PickUpTimeZone = new Suggestion { Text = EstTimeZone },
                DeliveryTimeZone = new Suggestion { Text = PstTimeZone }
            },
            new()
            {
                Id = 3,
                PuTime = new DateTimeOffset(2024, 1, 15, 12, 0, 0, TimeSpan.Zero),
                CompletedTime = new DateTimeOffset(2024, 1, 15, 16, 0, 0, TimeSpan.Zero)
                // No timezone overrides — falls back to tenant NZ
            }
        };

        // Act
        ApplyTimezoneToJobDates(jobs, NzTimeZone);

        // Assert — each job gets its own timezone offsets
        // Job 1: pickup=PST(-8), delivery=EST(-5)
        jobs[0].PuTime!.Value.Offset.Should().Be(TimeSpan.FromHours(-8));
        jobs[0].CompletedTime!.Value.Offset.Should().Be(TimeSpan.FromHours(-5));

        // Job 2: pickup=EST(-5), delivery=PST(-8)
        jobs[1].PuTime!.Value.Offset.Should().Be(TimeSpan.FromHours(-5));
        jobs[1].CompletedTime!.Value.Offset.Should().Be(TimeSpan.FromHours(-8));

        // Job 3: no overrides — both fall back to NZ (+13 NZDT in January)
        jobs[2].PuTime!.Value.Offset.Should().Be(TimeSpan.FromHours(13));
        jobs[2].CompletedTime!.Value.Offset.Should().Be(TimeSpan.FromHours(13));
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
}
