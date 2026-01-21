using DespatchWeb.EntityClasses;
using DespatchWeb.Helpers;
using FluentAssertions;
using TimeZone = DespatchWeb.EntityClasses.TimeZone;

namespace DespatchWeb.Tests.Helpers;

/// <summary>
/// Tests for JobMappings.LiveJobDownloadMapping and ArchivedJobDownloadMapping.
/// These test the simplified direct mappings introduced in the bug-fixes branch.
/// </summary>
public class JobMappingsTests
{
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

    #region JobMappingCore vs JobArchiveMapping Consistency Tests

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public void JobArchiveMapping_HasSameCollectionDefaults_AsJobMappingCore(bool isUsCustomer)
    {
        // Arrange
        var liveJob = new TucJob
        {
            UcjbId = 1,
            UcjbDate = new DateTime(2024, 1, 15),
            UcjbTime = new DateTime(2024, 1, 15, 10, 0, 0),
            UcjbNumber = "LIVE-001"
        };

        var archivedJob = new TucJobArchive
        {
            UcjbId = 1,
            UcjbDate = new DateTime(2024, 1, 15),
            UcjbTime = new DateTime(2024, 1, 15, 10, 0, 0),
            UcjbNumber = "ARCH-001",
            PricingBreakdowns = new List<PricingBreakdownArchive>()
        };

        // Act
        var liveMapping = JobMappings.JobMappingCore(isUsCustomer).Compile();
        var archiveMapping = JobMappings.JobArchiveMapping.Compile();
        var liveResult = liveMapping(liveJob);
        var archiveResult = archiveMapping(archivedJob);

        // Assert - Both should have same default values for collections
        liveResult.TailLiftPu.Should().Be(archiveResult.TailLiftPu);
        liveResult.TailLiftDo.Should().Be(archiveResult.TailLiftDo);
        liveResult.DeliverToPrivateRes.Should().Be(archiveResult.DeliverToPrivateRes);
        liveResult.ParcelDimensions.Should().BeNull();
        archiveResult.ParcelDimensions.Should().BeNull();
        liveResult.PalletInfo.Should().BeNull();
        archiveResult.PalletInfo.Should().BeNull();
        liveResult.AssignedFlight.Should().BeNull();
        archiveResult.AssignedFlight.Should().BeNull();
    }

    #endregion

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

    #region JobArchiveMapping Tests

    [Fact]
    public void JobArchiveMapping_SetsDefaultValuesForCollections()
    {
        // Arrange
        var archivedJob = new TucJobArchive
        {
            UcjbId = 1,
            UcjbNumber = "TEST-001",
            UcjbDate = new DateTime(2024, 1, 15),
            UcjbTime = new DateTime(2024, 1, 15, 10, 0, 0),
            PricingBreakdowns = new List<PricingBreakdownArchive>()
        };

        // Act
        var mapping = JobMappings.JobArchiveMapping.Compile();
        var result = mapping(archivedJob);

        // Assert - Collections should have default values for later enrichment
        result.TailLiftPu.Should().BeFalse();
        result.TailLiftDo.Should().BeFalse();
        result.DeliverToPrivateRes.Should().BeFalse();
        result.ParcelDimensions.Should().BeNull();
        result.PalletInfo.Should().BeNull();
        result.AssignedFlight.Should().BeNull();
    }

    [Fact]
    public void JobArchiveMapping_SetsIsArchivedTrue()
    {
        // Arrange
        var archivedJob = new TucJobArchive
        {
            UcjbId = 1,
            UcjbDate = new DateTime(2024, 1, 15),
            PricingBreakdowns = new List<PricingBreakdownArchive>()
        };

        // Act
        var mapping = JobMappings.JobArchiveMapping.Compile();
        var result = mapping(archivedJob);

        // Assert
        result.IsArchived.Should().BeTrue();
    }

    [Fact]
    public void JobArchiveMapping_MapsBasicFieldsCorrectly()
    {
        // Arrange
        var archivedJob = new TucJobArchive
        {
            UcjbId = 123,
            UcjbNumber = "ARCH-123",
            ParentId = 100,
            RootParentId = 100,
            UcjbDate = new DateTime(2024, 6, 15),
            UcjbTime = new DateTime(2024, 6, 15, 14, 30, 0),
            UcjbDispTime = new DateTime(2024, 6, 15, 14, 35, 0),
            ScheduleName = "Daily Schedule",
            UcjbVoid = false,
            Barcode = "BARCODE123",
            UcjbWeight = 25.5,
            UcjbQty = 3,
            UcjbClientRefa = "REF-A",
            UcjbClientRefb = "REF-B",
            UcjbOurRef = "OUR-REF",
            UcjbAmount = 150m,
            Direct = true,
            UcjbVan = true,
            VanOk = true,
            Truck = false,
            Dgclass = 3,
            UcjbJobDone = true,
            UcjbLatePick = 1,
            UcjbLateDel = 0,
            UcjbAttention = true,
            CustomJobName = "Custom Job",
            PricingBreakdowns = new List<PricingBreakdownArchive>(),
            UcjbClient = new TucClient { UcclName = "Test Client" },
            UcjbStatusNavigation = new TucJobStatus { UcjsCode = "DEL", UcjsName = "Delivered" }
        };

        // Act
        var mapping = JobMappings.JobArchiveMapping.Compile();
        var result = mapping(archivedJob);

        // Assert
        result.Id.Should().Be(123);
        result.JobNo.Should().Be("ARCH-123");
        result.ParentId.Should().Be(100);
        result.RootParentId.Should().Be(100);
        result.ScheduleName.Should().Be("Daily Schedule");
        result.Void.Should().BeFalse();
        result.Barcode.Should().Be("BARCODE123");
        result.Weight.Should().Be(25.5);
        result.Items.Should().Be(3);
        result.RefA.Should().Be("REF-A");
        result.RefB.Should().Be("REF-B");
        result.OurRef.Should().Be("OUR-REF");
        result.Direct.Should().BeTrue();
        result.Van.Should().BeTrue();
        result.VanOk.Should().BeTrue();
        result.Truck.Should().BeFalse();
        result.DgClass.Should().Be(3);
        result.Done.Should().BeTrue();
        result.Lp.Should().Be(1);
        result.Ld.Should().Be(0);
        result.Attention.Should().BeTrue();
        result.CustomJobName.Should().Be("Custom Job");
        result.ClientName.Should().Be("Test Client");
        result.Status.Should().Be("DEL");
        result.StatusName.Should().Be("Delivered");
        result.IsArchived.Should().BeTrue();
        result.PreBook.Should().BeFalse();
    }

    [Fact]
    public void JobArchiveMapping_MapsAddressesCorrectly()
    {
        // Arrange
        var archivedJob = new TucJobArchive
        {
            UcjbId = 1,
            UcjbDate = new DateTime(2024, 1, 15),
            PickupAddressLine1 = "123 Pickup St",
            PickupAddressLine2 = "Unit 1",
            PickupAddressLine3 = "Suburb",
            PickupAddressLine4 = "City",
            PickupAddressLine5 = "State",
            PickupAddressLine6 = "Country",
            PickupAddressLine7 = "12345",
            PickupAddressLine8 = "Extra",
            PickUpLatitude = -36.8485m,
            PickUpLongitude = 174.7633m,
            DeliveryAddressLine1 = "456 Delivery Ave",
            DeliveryAddressLine2 = "Suite 200",
            DeliveryAddressLine3 = "Delivery Suburb",
            DeliveryAddressLine4 = "Delivery City",
            DeliveryAddressLine5 = "Delivery State",
            DeliveryAddressLine6 = "Delivery Country",
            DeliveryAddressLine7 = "67890",
            DeliveryAddressLine8 = "Extra 2",
            DeliveryLatitude = -36.8600m,
            DeliveryLongitude = 174.7700m,
            PricingBreakdowns = new List<PricingBreakdownArchive>()
        };

        // Act
        var mapping = JobMappings.JobArchiveMapping.Compile();
        var result = mapping(archivedJob);

        // Assert - Pickup Address
        result.PickupAddress.AddressLine1.Should().Be("123 Pickup St");
        result.PickupAddress.AddressLine2.Should().Be("Unit 1");
        result.PickupAddress.Latitude.Should().Be(-36.8485m);
        result.PickupAddress.Longitude.Should().Be(174.7633m);

        // Assert - Delivery Address
        result.DeliveryAddress.AddressLine1.Should().Be("456 Delivery Ave");
        result.DeliveryAddress.AddressLine2.Should().Be("Suite 200");
        result.DeliveryAddress.Latitude.Should().Be(-36.8600m);
        result.DeliveryAddress.Longitude.Should().Be(174.7700m);

        // Assert - Direct location properties
        result.PickUpLatitude.Should().Be(-36.8485m);
        result.PickUpLongitude.Should().Be(174.7633m);
        result.DeliveryLatitude.Should().Be(-36.8600m);
        result.DeliveryLongitude.Should().Be(174.7700m);
    }

    [Fact]
    public void JobArchiveMapping_MapsCourierCorrectly()
    {
        // Arrange
        var archivedJob = new TucJobArchive
        {
            UcjbId = 1,
            UcjbDate = new DateTime(2024, 1, 15),
            UcjbCourierId = 42,
            UcjbCourier = new TucCourier
            {
                UccrId = 42,
                Code = "C042",
                UccrName = "John",
                UccrSurname = "Courier",
                UccrMobile = "021-123-4567"
            },
            PricingBreakdowns = new List<PricingBreakdownArchive>()
        };

        // Act
        var mapping = JobMappings.JobArchiveMapping.Compile();
        var result = mapping(archivedJob);

        // Assert
        result.Courier.Should().Be("C042");
        result.CourierData.Should().NotBeNull();
        result.CourierData!.Courier.Should().Be("C042");
        result.CourierData.CourierId.Should().Be(42);
        result.CourierData.CourierMobile.Should().Be("021-123-4567");
        result.CourierData.CourierName.Should().Be("John Courier");
        result.AssignedCourier.Should().NotBeNull();
        result.AssignedCourier!.Id.Should().Be(42);
        result.AssignedCourier.Text.Should().Be("John Courier");
    }

    [Fact]
    public void JobArchiveMapping_MapsAgentCorrectly()
    {
        // Arrange
        var archivedJob = new TucJobArchive
        {
            UcjbId = 1,
            UcjbDate = new DateTime(2024, 1, 15),
            Agent = new TucAgent
            {
                UcagId = 10,
                UcagName = "Test Agent",
                UcagFax = "agent@test.com",
                UcagPhone = "09-123-4567"
            },
            PricingBreakdowns = new List<PricingBreakdownArchive>()
        };

        // Act
        var mapping = JobMappings.JobArchiveMapping.Compile();
        var result = mapping(archivedJob);

        // Assert
        result.AssignedAgent.Should().NotBeNull();
        result.AssignedAgent!.AgentId.Should().Be(10);
        result.AssignedAgent.AgentName.Should().Be("Test Agent");
        result.AssignedAgent.AgentEmail.Should().Be("agent@test.com");
        result.AssignedAgent.AgentPhone.Should().Be("09-123-4567");
    }

    [Fact]
    public void JobArchiveMapping_MapsSpeedInfoCorrectly()
    {
        // Arrange
        var archivedJob = new TucJobArchive
        {
            UcjbId = 1,
            UcjbDate = new DateTime(2024, 1, 15),
            UcjbSpeed = 5,
            SpeedNavigation = new TucJobType
            {
                UcjtId = 5,
                ShortName = "2HR",
                UcjtName = "2 Hour Delivery",
                PickupTime = 30,
                DeliveryTime = 120
            },
            NotifiedJobTypeId = 6,
            NotifiedJobType = new TucJobType { UcjtName = "Notified Speed" },
            AcceptedJobTypeId = 7,
            AcceptedJobType = new TucJobType { UcjtName = "Accepted Speed" },
            PricingBreakdowns = new List<PricingBreakdownArchive>()
        };

        // Act
        var mapping = JobMappings.JobArchiveMapping.Compile();
        var result = mapping(archivedJob);

        // Assert
        result.SpeedId.Should().Be(5);
        result.Speed.Should().Be("2HR");
        result.SpeedName.Should().Be("2 Hour Delivery");
        result.PickupTime.Should().Be(30);
        result.DeliveryTime.Should().Be(120);
        result.NotifiedJobTypeId.Should().Be(6);
        result.NotifiedName.Should().Be("Notified Speed");
        result.AcceptedJobTypeId.Should().Be(7);
        result.AcceptedName.Should().Be("Accepted Speed");
    }

    [Fact]
    public void JobArchiveMapping_MapsPricingFromPricingBreakdowns()
    {
        // Arrange
        var archivedJob = new TucJobArchive
        {
            UcjbId = 1,
            UcjbDate = new DateTime(2024, 1, 15),
            UcjbAmount = 100m, // Should be ignored when pricing breakdowns exist
            PricingBreakdowns = new List<PricingBreakdownArchive>
            {
                new() { ChargeAmount = 150m },
                new() { ChargeAmount = 50m }
            }
        };

        // Act
        var mapping = JobMappings.JobArchiveMapping.Compile();
        var result = mapping(archivedJob);

        // Assert - Should sum pricing breakdowns (150 + 50 = 200)
        result.Charge.Should().Be(200m);
    }

    [Fact]
    public void JobArchiveMapping_MapsPricingFromParentWhenAvailable()
    {
        // Arrange
        var parentJob = new TucJobArchive
        {
            UcjbId = 100,
            PricingBreakdowns = new List<PricingBreakdownArchive>
            {
                new() { ChargeAmount = 300m },
                new() { ChargeAmount = 100m }
            }
        };

        var archivedJob = new TucJobArchive
        {
            UcjbId = 1,
            ParentId = 100,
            Parent = parentJob,
            UcjbDate = new DateTime(2024, 1, 15),
            UcjbAmount = 50m, // Should be ignored
            PricingBreakdowns = new List<PricingBreakdownArchive>
            {
                new() { ChargeAmount = 25m } // Should be ignored when parent has pricing
            }
        };

        // Act
        var mapping = JobMappings.JobArchiveMapping.Compile();
        var result = mapping(archivedJob);

        // Assert - Should use parent's pricing (300 + 100 = 400)
        result.Charge.Should().Be(400m);
    }

    [Fact]
    public void JobArchiveMapping_MapsPricingFallsBackToUcjbAmount()
    {
        // Arrange
        var archivedJob = new TucJobArchive
        {
            UcjbId = 1,
            UcjbDate = new DateTime(2024, 1, 15),
            UcjbAmount = 250m,
            PricingBreakdowns = new List<PricingBreakdownArchive>() // Empty
        };

        // Act
        var mapping = JobMappings.JobArchiveMapping.Compile();
        var result = mapping(archivedJob);

        // Assert - Should fall back to UcjbAmount
        result.Charge.Should().Be(250m);
    }

    [Fact]
    public void JobArchiveMapping_MapsTrackingInfoCorrectly()
    {
        // Arrange
        var archivedJob = new TucJobArchive
        {
            UcjbId = 1,
            UcjbDate = new DateTime(2024, 1, 15),
            TrackingMethod = 1, // 1 = Email
            TrackingMobile = "021-555-1234",
            TrackingEmail = "track@test.com",
            PricingBreakdowns = new List<PricingBreakdownArchive>()
        };

        // Act
        var mapping = JobMappings.JobArchiveMapping.Compile();
        var result = mapping(archivedJob);

        // Assert
        result.TrackingMethod.Should().Be(1);
        result.TrackingMobile.Should().Be("021-555-1234");
        result.TrackingEmail.Should().Be("track@test.com");
    }

    [Fact]
    public void JobArchiveMapping_MapsTimezonesSuggestions()
    {
        // Arrange
        var archivedJob = new TucJobArchive
        {
            UcjbId = 1,
            UcjbDate = new DateTime(2024, 1, 15),
            PickupTimeZone = new TimeZone { Id = 1, Name = "Pacific/Auckland" },
            DeliverByTimeZone = new TimeZone { Id = 2, Name = "America/Los_Angeles" },
            PricingBreakdowns = new List<PricingBreakdownArchive>()
        };

        // Act
        var mapping = JobMappings.JobArchiveMapping.Compile();
        var result = mapping(archivedJob);

        // Assert
        result.PickUpTimeZone.Should().NotBeNull();
        result.PickUpTimeZone!.Id.Should().Be(1);
        result.PickUpTimeZone.Text.Should().Be("Pacific/Auckland");
        result.DeliveryTimeZone.Should().NotBeNull();
        result.DeliveryTimeZone!.Id.Should().Be(2);
        result.DeliveryTimeZone.Text.Should().Be("America/Los_Angeles");
    }

    [Fact]
    public void JobArchiveMapping_MapsLockedStatusCorrectly()
    {
        // Arrange - Locked job
        var lockedJob = new TucJobArchive
        {
            UcjbId = 1,
            UcjbDate = new DateTime(2024, 1, 15),
            UcjbLocked = 1,
            PricingBreakdowns = new List<PricingBreakdownArchive>()
        };

        var unlockedJob = new TucJobArchive
        {
            UcjbId = 2,
            UcjbDate = new DateTime(2024, 1, 15),
            UcjbLocked = 0,
            PricingBreakdowns = new List<PricingBreakdownArchive>()
        };

        var nullLockedJob = new TucJobArchive
        {
            UcjbId = 3,
            UcjbDate = new DateTime(2024, 1, 15),
            UcjbLocked = null,
            PricingBreakdowns = new List<PricingBreakdownArchive>()
        };

        // Act
        var mapping = JobMappings.JobArchiveMapping.Compile();
        var lockedResult = mapping(lockedJob);
        var unlockedResult = mapping(unlockedJob);
        var nullResult = mapping(nullLockedJob);

        // Assert
        lockedResult.Locked.Should().BeTrue();
        unlockedResult.Locked.Should().BeFalse();
        nullResult.Locked.Should().BeFalse();
    }

    [Fact]
    public void JobArchiveMapping_MapsDeliveryDetailsCorrectly()
    {
        // Arrange
        var archivedJob = new TucJobArchive
        {
            UcjbId = 1,
            UcjbDate = new DateTime(2024, 1, 15),
            DeliverToPrivateBusiness = 1,
            UcjbReturn = true,
            SaturdayDelivery = true,
            UcjbComplTime = new DateTime(2024, 1, 15, 16, 30, 0),
            DeliverToContact = "John Smith",
            DeliverToPhone = "09-555-1234",
            DeliverToLeaveId = 2,
            DeliverToLeave = new TblJobLeaveNotHome { Name = "Leave at door" },
            UndeliverableLocation = new TblUndeliverableLocation { Name = "Returned to depot" },
            PricingBreakdowns = new List<PricingBreakdownArchive>()
        };

        // Act
        var mapping = JobMappings.JobArchiveMapping.Compile();
        var result = mapping(archivedJob);

        // Assert
        result.PrivateRes.Should().BeTrue();
        result.Return.Should().BeTrue();
        result.SaturdayDelivery.Should().BeTrue();
        result.CompletedTime.Should().NotBeNull();
        result.DeliverToContact.Should().Be("John Smith");
        result.ToContactPhone.Should().Be("09-555-1234");
        result.DeliverToLeaveId.Should().Be(2);
        result.SigNotRequired.Should().Be("Leave at door");
        result.UdStatus.Should().Be("Returned to depot");
    }

    [Fact]
    public void JobArchiveMapping_MapsContactInfoCorrectly()
    {
        // Arrange
        var archivedJob = new TucJobArchive
        {
            UcjbId = 1,
            UcjbDate = new DateTime(2024, 1, 15),
            PickUpFromContact = "Pickup Person",
            PickUpFromPhone = "09-111-2222",
            DeliverToContact = "Delivery Person",
            DeliverToPhone = "09-333-4444",
            LoggedInContact = new TucClientContact
            {
                UcctFirstname = "Admin",
                UcctSurname = "User"
            },
            PricingBreakdowns = new List<PricingBreakdownArchive>()
        };

        // Act
        var mapping = JobMappings.JobArchiveMapping.Compile();
        var result = mapping(archivedJob);

        // Assert
        result.FromContactName.Should().Be("Pickup Person");
        result.FromContactNumber.Should().Be("09-111-2222");
        result.DeliverToContact.Should().Be("Delivery Person");
        result.ToContactPhone.Should().Be("09-333-4444");
        result.LoggedInContactName.Should().Be("Admin User");
    }

    [Fact]
    public void JobArchiveMapping_HandlesNullNavigationProperties()
    {
        // Arrange - Minimal job with no navigation properties
        var archivedJob = new TucJobArchive
        {
            UcjbId = 1,
            UcjbDate = new DateTime(2024, 1, 15),
            UcjbNumber = "TEST-001",
            PricingBreakdowns = new List<PricingBreakdownArchive>()
            // All navigation properties are null
        };

        // Act
        var mapping = JobMappings.JobArchiveMapping.Compile();
        var result = mapping(archivedJob);

        // Assert - Should not throw and should have sensible defaults
        result.Id.Should().Be(1);
        result.JobNo.Should().Be("TEST-001");
        result.Courier.Should().BeNull();
        result.CourierData.Should().BeNull();
        result.AssignedCourier.Should().BeNull();
        result.AssignedAgent.Should().BeNull();
        result.Speed.Should().BeNull();
        result.SpeedName.Should().BeNull();
        result.Status.Should().BeNull();
        result.StatusName.Should().BeNull();
        result.ClientName.Should().Be(string.Empty);
        result.LoggedInContactName.Should().Be(string.Empty);
        result.PickUpTimeZone.Should().BeNull();
        result.DeliveryTimeZone.Should().BeNull();
    }

    #endregion
}