using DespatchWeb.EntityClasses;
using DespatchWeb.Helpers;
using FluentAssertions;

namespace DespatchWeb.Tests.Helpers;

/// <summary>
/// Tests for JobMappings.LiveJobDownloadMapping and ArchivedJobDownloadMapping.
/// These test the simplified direct mappings introduced in the bug-fixes branch.
/// </summary>
public class JobMappingsTests
{
    #region LiveJobDownloadMapping Tests

    [Fact]
    public void LiveJobDownloadMapping_Amount_UsesParentPricingSumFirst()
    {
        // Arrange - Parent has pricing breakdown
        var parentJob = new TucJob
        {
            UcjbId = 1,
            PricingBreakdownJobs = new List<PricingBreakdown>
            {
                new() { ChargeAmount = 100m },
                new() { ChargeAmount = 50m }
            }
        };

        var childJob = new TucJob
        {
            UcjbId = 2,
            ParentId = 1,
            Parent = parentJob,
            UcjbAmount = 999m, // Should be ignored
            PricingBreakdownJobs = new List<PricingBreakdown>
            {
                new() { ChargeAmount = 25m } // Should be ignored
            }
        };

        // Act
        var mapping = JobMappings.LiveJobDownloadMapping.Compile();
        var result = mapping(childJob);

        // Assert - Should use parent's pricing sum (100 + 50 = 150)
        result.Amount.Should().Be(150m);
    }

    [Fact]
    public void LiveJobDownloadMapping_Amount_UsesJobPricingSumWhenNoParent()
    {
        // Arrange - No parent, but job has pricing breakdown
        var job = new TucJob
        {
            UcjbId = 1,
            ParentId = null,
            Parent = null,
            UcjbAmount = 999m, // Should be ignored
            PricingBreakdownJobs = new List<PricingBreakdown>
            {
                new() { ChargeAmount = 75m },
                new() { ChargeAmount = 25m }
            }
        };

        // Act
        var mapping = JobMappings.LiveJobDownloadMapping.Compile();
        var result = mapping(job);

        // Assert - Should use job's own pricing sum (75 + 25 = 100)
        result.Amount.Should().Be(100m);
    }

    [Fact]
    public void LiveJobDownloadMapping_Amount_EmptyCollectionUsesUcjbAmount()
    {
        // Arrange - No parent, empty pricing breakdown
        // With .Any() fix: empty collection.Any() returns FALSE, so UcjbAmount is used
        var job = new TucJob
        {
            UcjbId = 1,
            ParentId = null,
            Parent = null,
            UcjbAmount = 250m,
            PricingBreakdownJobs = new List<PricingBreakdown>() // Empty - Any() returns FALSE
        };

        // Act
        var mapping = JobMappings.LiveJobDownloadMapping.Compile();
        var result = mapping(job);

        // Assert - With .Any() fix: no parent, no pricing, so UcjbAmount is used
        result.Amount.Should().Be(250m);
    }

    [Fact]
    public void LiveJobDownloadMapping_Amount_EmptyParentPricingUsesChildPricing()
    {
        // Arrange - Parent exists but has empty pricing
        // With .Any() fix: parent.PricingBreakdownJobs.Any() returns FALSE
        // So it falls through to check child's pricing
        var parentJob = new TucJob
        {
            UcjbId = 1,
            PricingBreakdownJobs = new List<PricingBreakdown>() // Empty - Any() returns FALSE
        };

        var childJob = new TucJob
        {
            UcjbId = 2,
            ParentId = 1,
            Parent = parentJob,
            UcjbAmount = 500m,
            PricingBreakdownJobs = new List<PricingBreakdown>
            {
                new() { ChargeAmount = 100m }
            }
        };

        // Act
        var mapping = JobMappings.LiveJobDownloadMapping.Compile();
        var result = mapping(childJob);

        // Assert - With .Any() fix: parent has no pricing, child has pricing (100m)
        result.Amount.Should().Be(100m);
    }

    [Fact]
    public void LiveJobDownloadMapping_MapsBasicFieldsCorrectly()
    {
        // Arrange
        var job = new TucJob
        {
            UcjbId = 123,
            ParentId = 100,
            UcjbNumber = "JOB-001",
            UcjbDate = new DateTime(2024, 1, 15),
            UcjbTime = new DateTime(2024, 1, 15, 10, 30, 0),
            PickUpTime = new DateTime(2024, 1, 15, 11, 0, 0),
            UcjbComplTime = new DateTime(2024, 1, 15, 12, 0, 0),
            UcjbAmount = 150m,
            FuelSurchargeAmount = 15m,
            PpdexclusiveAmount = 10m,
            CourierPayment = 80m,
            CourierFuel = 8m,
            CourierBonus = 5m,
            UcjbQty = 3,
            UcjbWeight = 25.5,
            UcjbSize = 2,
            PickupAddressLine1 = "123 Pickup St",
            PickupAddressLine2 = "Unit 1",
            DeliveryAddressLine1 = "456 Delivery Ave",
            DeliveryAddressLine2 = "Suite 200",
            UcjbClientRefa = "REF-A",
            UcjbClientRefb = "REF-B",
            UcjbClientRefc = "REF-C",
            RawBaseAmount = 125m,
            PricingBreakdownJobs = new List<PricingBreakdown>(),
            TucJobNationwides = new List<TucJobNationwide>(),
            UcjbClient = new TucClient { UcclName = "Test Customer" },
            UcjbStatusNavigation = new TucJobStatus { UcjsName = "Completed" },
            UcjbCourier = new TucCourier { Code = "C001" },
            LoggedInContact = new TucClientContact { UcctFirstname = "John", UcctSurname = "Doe" }
        };

        // Act
        var mapping = JobMappings.LiveJobDownloadMapping.Compile();
        var result = mapping(job);

        // Assert
        result.Id.Should().Be(123);
        result.ParentId.Should().Be(100);
        result.JobNumber.Should().Be("JOB-001");
        result.CustomerName.Should().Be("Test Customer");
        result.BookDate.Should().Be(new DateTime(2024, 1, 15, 10, 30, 0));
        result.PickedUpDate.Should().Be(new DateTime(2024, 1, 15, 11, 0, 0));
        result.DeliveredDate.Should().Be(new DateTime(2024, 1, 15, 12, 0, 0));
        result.Fuel.Should().Be(15m);
        result.Ppd.Should().Be(10m);
        result.CourierPayment.Should().Be(80m);
        result.CourierFuel.Should().Be(8m);
        result.CourierBonus.Should().Be(5m);
        result.Quantity.Should().Be(3);
        result.Weight.Should().Be(25.5);
        result.Size.Should().Be(2);
        result.PickupAddressLine1.Should().Be("123 Pickup St");
        result.PickupAddressLine2.Should().Be("Unit 1");
        result.DeliveryAddressLine1.Should().Be("456 Delivery Ave");
        result.DeliveryAddressLine2.Should().Be("Suite 200");
        result.ClientReferenceA.Should().Be("REF-A");
        result.ClientReferenceB.Should().Be("REF-B");
        result.ClientReferenceC.Should().Be("REF-C");
        result.StatusName.Should().Be("Completed");
        result.CourierCode.Should().Be("C001");
        result.LoggedInContact.Should().Be("John Doe");
        result.RawBaseAmount.Should().Be(125m);
        result.IsArchived.Should().BeFalse();
        result.InvoiceNumber.Should().BeNull(); // Live jobs don't have invoice
        result.InvoiceDate.Should().BeNull();
    }

    [Fact]
    public void LiveJobDownloadMapping_AgentAirlineName_UsesNationwideFirst()
    {
        // Arrange
        var job = new TucJob
        {
            UcjbId = 1,
            TucJobNationwides = new List<TucJobNationwide>
            {
                new() { UcnwAirlineName = "Air NZ", UcnwFlightNo = "NZ123" }
            },
            Agent = new TucAgent { UcagName = "Agent Smith" }, // Should be ignored
            PricingBreakdownJobs = new List<PricingBreakdown>()
        };

        // Act
        var mapping = JobMappings.LiveJobDownloadMapping.Compile();
        var result = mapping(job);

        // Assert
        result.AgentAirlineName.Should().Be("Air NZ");
        result.AWB.Should().Be("NZ123");
    }

    [Fact]
    public void LiveJobDownloadMapping_AgentAirlineName_FallsBackToAgent()
    {
        // Arrange
        var job = new TucJob
        {
            UcjbId = 1,
            TucJobNationwides = new List<TucJobNationwide>(), // Empty
            Agent = new TucAgent { UcagName = "Agent Smith" },
            PricingBreakdownJobs = new List<PricingBreakdown>()
        };

        // Act
        var mapping = JobMappings.LiveJobDownloadMapping.Compile();
        var result = mapping(job);

        // Assert
        result.AgentAirlineName.Should().Be("Agent Smith");
        result.AWB.Should().BeNull();
    }

    #endregion

    #region ArchivedJobDownloadMapping Tests

    [Fact]
    public void ArchivedJobDownloadMapping_Amount_UsesSamePriorityAsLive()
    {
        // Arrange - Parent has pricing breakdown
        var parentJob = new TucJobArchive
        {
            UcjbId = 1,
            PricingBreakdowns = new List<PricingBreakdownArchive>
            {
                new() { ChargeAmount = 200m },
                new() { ChargeAmount = 100m }
            }
        };

        var archivedJob = new TucJobArchive
        {
            UcjbId = 2,
            ParentId = 1,
            Parent = parentJob,
            UcjbDate = DateTime.Now,
            UcjbAmount = 999m, // Should be ignored
            PricingBreakdowns = new List<PricingBreakdownArchive>
            {
                new() { ChargeAmount = 50m } // Should be ignored
            }
        };

        // Act
        var mapping = JobMappings.ArchivedJobDownloadMapping.Compile();
        var result = mapping(archivedJob);

        // Assert - Should use parent's pricing sum (200 + 100 = 300)
        result.Amount.Should().Be(300m);
    }

    [Fact]
    public void ArchivedJobDownloadMapping_IsArchived_ReturnsTrue()
    {
        // Arrange
        var archivedJob = new TucJobArchive
        {
            UcjbId = 1,
            UcjbDate = DateTime.Now,
            PricingBreakdowns = new List<PricingBreakdownArchive>()
        };

        // Act
        var mapping = JobMappings.ArchivedJobDownloadMapping.Compile();
        var result = mapping(archivedJob);

        // Assert
        result.IsArchived.Should().BeTrue();
    }

    [Fact]
    public void ArchivedJobDownloadMapping_InvoiceDate_FromInvoiceNavigation()
    {
        // Arrange
        var invoiceDate = new DateTime(2024, 2, 1);
        var archivedJob = new TucJobArchive
        {
            UcjbId = 1,
            UcjbDate = DateTime.Now,
            UcjbInvoiceNo = 12345,
            Invoice = new TucInvoiceNo { Created = invoiceDate },
            PricingBreakdowns = new List<PricingBreakdownArchive>()
        };

        // Act
        var mapping = JobMappings.ArchivedJobDownloadMapping.Compile();
        var result = mapping(archivedJob);

        // Assert
        result.InvoiceNumber.Should().Be(12345);
        result.InvoiceDate.Should().Be(invoiceDate);
    }

    [Fact]
    public void ArchivedJobDownloadMapping_MapsBasicFieldsCorrectly()
    {
        // Arrange
        var archivedJob = new TucJobArchive
        {
            UcjbId = 456,
            ParentId = 400,
            UcjbNumber = "ARCH-001",
            UcjbDate = new DateTime(2023, 6, 15),
            UcjbTime = new DateTime(2023, 6, 15, 9, 0, 0),
            PickUpTime = new DateTime(2023, 6, 15, 10, 0, 0),
            UcjbComplTime = new DateTime(2023, 6, 15, 11, 0, 0),
            UcjbAmount = 300m,
            FuelSurchargeAmount = 30m,
            PpdexclusiveAmount = 20m,
            CourierPayment = 150m,
            CourierFuel = 15m,
            CourierBonus = 10m,
            UcjbQty = 5,
            UcjbWeight = 50.0,
            UcjbSize = 3,
            PickupAddressLine1 = "789 Archive Pickup",
            DeliveryAddressLine1 = "321 Archive Delivery",
            UcjbClientRefa = "ARCH-REF-A",
            RawBaseAmount = 250m,
            PricingBreakdowns = new List<PricingBreakdownArchive>(),
            UcjbClient = new TucClient { UcclName = "Archived Customer" },
            UcjbStatusNavigation = new TucJobStatus { UcjsName = "Archived" },
            UcjbCourier = new TucCourier { Code = "C002" },
            Agent = new TucAgent { UcagName = "Archive Agent" }
        };

        // Act
        var mapping = JobMappings.ArchivedJobDownloadMapping.Compile();
        var result = mapping(archivedJob);

        // Assert
        result.Id.Should().Be(456);
        result.ParentId.Should().Be(400);
        result.JobNumber.Should().Be("ARCH-001");
        result.CustomerName.Should().Be("Archived Customer");
        result.Fuel.Should().Be(30m);
        result.Ppd.Should().Be(20m);
        result.StatusName.Should().Be("Archived");
        result.CourierCode.Should().Be("C002");
        result.AgentAirlineName.Should().Be("Archive Agent");
        result.AWB.Should().BeNull(); // Archived jobs don't have nationwide navigation
        result.IsArchived.Should().BeTrue();
        result.RawBaseAmount.Should().Be(250m);
    }

    [Fact]
    public void ArchivedJobDownloadMapping_NullDate_ReturnsDefault()
    {
        // Arrange
        var archivedJob = new TucJobArchive
        {
            UcjbId = 1,
            UcjbDate = null, // Nullable in archive
            PricingBreakdowns = new List<PricingBreakdownArchive>()
        };

        // Act
        var mapping = JobMappings.ArchivedJobDownloadMapping.Compile();
        var result = mapping(archivedJob);

        // Assert
        result.BookDate.Should().Be(default);
    }

    #endregion

    #region Amount Consistency Tests

    /// <summary>
    /// Tests the critical fix: When parent exists but has no pricing breakdowns,
    /// the calculation should fall through to child's pricing breakdowns.
    /// The .Any() check ensures this proper fallback behavior.
    /// </summary>
    [Fact]
    public void LiveJobDownloadMapping_Amount_ParentExistsButNoPricing_FallsToChildPricing()
    {
        // Arrange - Parent exists but has NO pricing breakdowns
        // Child has pricing breakdowns that should be used
        var parentJob = new TucJob
        {
            UcjbId = 1,
            PricingBreakdownJobs = new List<PricingBreakdown>() // Empty!
        };

        var childJob = new TucJob
        {
            UcjbId = 2,
            ParentId = 1,
            Parent = parentJob,
            UcjbAmount = 50m, // Fallback if no pricing breakdowns at all
            PricingBreakdownJobs = new List<PricingBreakdown>
            {
                new() { ChargeAmount = 200m } // This SHOULD be used
            }
        };

        // Act
        var mapping = JobMappings.LiveJobDownloadMapping.Compile();
        var result = mapping(childJob);

        // Assert - With the .Any() fix, parent.PricingBreakdownJobs.Any() returns FALSE,
        // so it falls through to check child pricing, which has 200m
        result.Amount.Should().Be(200m, "Parent has no pricing, so child's pricing should be used");
    }

    /// <summary>
    /// Tests that when parent has pricing, it takes priority over child's pricing.
    /// </summary>
    [Fact]
    public void LiveJobDownloadMapping_Amount_ParentWithPricing_TakesPriorityOverChild()
    {
        // Arrange
        var parentJob = new TucJob
        {
            UcjbId = 1,
            PricingBreakdownJobs = new List<PricingBreakdown>
            {
                new() { ChargeAmount = 500m }
            }
        };

        var childJob = new TucJob
        {
            UcjbId = 2,
            ParentId = 1,
            Parent = parentJob,
            UcjbAmount = 50m,
            PricingBreakdownJobs = new List<PricingBreakdown>
            {
                new() { ChargeAmount = 200m }
            }
        };

        // Act
        var mapping = JobMappings.LiveJobDownloadMapping.Compile();
        var result = mapping(childJob);

        // Assert - Parent pricing should be used
        result.Amount.Should().Be(500m);
    }

    /// <summary>
    /// Tests that when job has no parent and no pricing breakdowns, UcjbAmount is used.
    /// </summary>
    [Fact]
    public void LiveJobDownloadMapping_Amount_NoParentNoPricing_UsesUcjbAmount()
    {
        // Arrange
        var job = new TucJob
        {
            UcjbId = 1,
            ParentId = null,
            Parent = null,
            UcjbAmount = 150m,
            PricingBreakdownJobs = new List<PricingBreakdown>() // Empty
        };

        // Act
        var mapping = JobMappings.LiveJobDownloadMapping.Compile();
        var result = mapping(job);

        // Assert - With the .Any() fix:
        // - Parent is null, so first condition (j.Parent != null && ...) is FALSE
        // - j.PricingBreakdownJobs.Any() returns FALSE (empty list)
        // - Falls through to UcjbAmount (150m)
        result.Amount.Should().Be(150m, "No pricing breakdowns, so UcjbAmount should be used");
    }

    /// <summary>
    /// Tests archived job with same scenario - parent exists but no pricing.
    /// The .Any() check ensures proper fallback to child's pricing.
    /// </summary>
    [Fact]
    public void ArchivedJobDownloadMapping_Amount_ParentExistsButNoPricing_FallsToChildPricing()
    {
        // Arrange
        var parentJob = new TucJobArchive
        {
            UcjbId = 1,
            PricingBreakdowns = new List<PricingBreakdownArchive>() // Empty!
        };

        var archivedJob = new TucJobArchive
        {
            UcjbId = 2,
            ParentId = 1,
            Parent = parentJob,
            UcjbDate = DateTime.Now,
            UcjbAmount = 50m,
            PricingBreakdowns = new List<PricingBreakdownArchive>
            {
                new() { ChargeAmount = 300m }
            }
        };

        // Act
        var mapping = JobMappings.ArchivedJobDownloadMapping.Compile();
        var result = mapping(archivedJob);

        // Assert - With .Any() check:
        // - Parent.PricingBreakdowns.Any() is FALSE (empty)
        // - archivedJob.PricingBreakdowns.Any() is TRUE
        // - Returns 300m from child's pricing
        result.Amount.Should().Be(300m, "Parent has no pricing, so child's pricing should be used");
    }

    /// <summary>
    /// Tests that null UcjbAmount falls back to 0 when no pricing available.
    /// </summary>
    [Fact]
    public void LiveJobDownloadMapping_Amount_NullUcjbAmount_ReturnsZero()
    {
        // Arrange
        var job = new TucJob
        {
            UcjbId = 1,
            ParentId = null,
            Parent = null,
            UcjbAmount = null, // Null!
            PricingBreakdownJobs = new List<PricingBreakdown>()
        };

        // Act
        var mapping = JobMappings.LiveJobDownloadMapping.Compile();
        var result = mapping(job);

        // Assert - Should default to 0 when all else fails
        result.Amount.Should().Be(0m);
    }

    /// <summary>
    /// Tests multiple pricing breakdown entries are summed correctly.
    /// </summary>
    [Fact]
    public void LiveJobDownloadMapping_Amount_MultiplePricingBreakdowns_SumsAll()
    {
        // Arrange
        var job = new TucJob
        {
            UcjbId = 1,
            ParentId = null,
            Parent = null,
            UcjbAmount = 999m,
            PricingBreakdownJobs = new List<PricingBreakdown>
            {
                new() { ChargeAmount = 100m },
                new() { ChargeAmount = 50.50m },
                new() { ChargeAmount = 25.25m },
                new() { ChargeAmount = 24.25m }
            }
        };

        // Act
        var mapping = JobMappings.LiveJobDownloadMapping.Compile();
        var result = mapping(job);

        // Assert
        result.Amount.Should().Be(200m); // 100 + 50.50 + 25.25 + 24.25 = 200
    }

    #endregion

    #region Amount Consistency Tests

    [Fact]
    public void AmountCalculation_IsConsistentBetweenLiveAndArchived()
    {
        // Arrange - Same scenario for both live and archived
        var liveParent = new TucJob
        {
            UcjbId = 1,
            PricingBreakdownJobs = new List<PricingBreakdown>
            {
                new() { ChargeAmount = 100m }
            }
        };

        var liveJob = new TucJob
        {
            UcjbId = 2,
            ParentId = 1,
            Parent = liveParent,
            UcjbAmount = 999m,
            PricingBreakdownJobs = new List<PricingBreakdown>()
        };

        var archivedParent = new TucJobArchive
        {
            UcjbId = 1,
            PricingBreakdowns = new List<PricingBreakdownArchive>
            {
                new() { ChargeAmount = 100m }
            }
        };

        var archivedJob = new TucJobArchive
        {
            UcjbId = 2,
            ParentId = 1,
            Parent = archivedParent,
            UcjbDate = DateTime.Now,
            UcjbAmount = 999m,
            PricingBreakdowns = new List<PricingBreakdownArchive>()
        };

        // Act
        var liveMapping = JobMappings.LiveJobDownloadMapping.Compile();
        var archivedMapping = JobMappings.ArchivedJobDownloadMapping.Compile();
        var liveResult = liveMapping(liveJob);
        var archivedResult = archivedMapping(archivedJob);

        // Assert - Both should calculate Amount the same way
        liveResult.Amount.Should().Be(100m);
        archivedResult.Amount.Should().Be(100m);
    }

    #endregion
}
