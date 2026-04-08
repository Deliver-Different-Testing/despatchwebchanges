using DespatchWeb.EntityClasses;
using DespatchWeb.Helpers;
using TimeZone = DespatchWeb.EntityClasses.TimeZone;

namespace DespatchWeb.Tests.Helpers;

/// <summary>
/// Tests for JobMappings.LiveJobDownloadMapping and ArchivedJobDownloadMapping.
/// These test the simplified direct mappings introduced in the bug-fixes branch.
/// </summary>
public class JobMappingsTests
{

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
            UcjbDate = TestDates.Now,
            UcjbAmount = 999m,
            PricingBreakdowns = new List<PricingBreakdownArchive>()
        };

        // Act
        var liveMapping = JobMappings.LiveJobDownloadMapping.Compile();
        var archivedMapping = JobMappings.ArchivedJobDownloadMapping.Compile();
        var liveResult = liveMapping(liveJob);
        var archivedResult = archivedMapping(archivedJob);

        // Assert - Both should use UcjbAmount directly
        Assert.Equal(999m, liveResult.Amount);
        Assert.Equal(999m, archivedResult.Amount);
    }

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
            UcjbNumber = "LIVE-001",
            PricingBreakdownJobs = new List<PricingBreakdown>(),
            TucJobItemJobs = new List<TucJobItem>(),
            TucJobItemChildJobs = new List<TucJobItem>(),
            TucJobNationwides = new List<TucJobNationwide>()
        };

        var archivedJob = new TucJobArchive
        {
            UcjbId = 1,
            UcjbDate = new DateTime(2024, 1, 15),
            UcjbTime = new DateTime(2024, 1, 15, 10, 0, 0),
            UcjbNumber = "ARCH-001",
            PricingBreakdowns = new List<PricingBreakdownArchive>(),
            TucJobItemsArchives = new List<TucJobItemsArchive>()
        };

        // Act
        var liveMapping = JobMappings.JobMappingCore(isUsCustomer).Compile();
        var archiveMapping = JobMappings.JobArchiveMapping.Compile();
        var liveResult = liveMapping(liveJob);
        var archiveResult = archiveMapping(archivedJob);

        // Assert - Both should have same default values for collections when no items exist
        Assert.Equal(archiveResult.TailLiftPu, liveResult.TailLiftPu);
        Assert.Equal(archiveResult.TailLiftDo, liveResult.TailLiftDo);
        Assert.Equal(archiveResult.DeliverToPrivateRes, liveResult.DeliverToPrivateRes);
        // With inline mapping, empty collections result in empty list
        Assert.Empty(liveResult.ParcelDimensions);
        Assert.True(archiveResult.ParcelDimensions is null or []); // Either null or empty depending on expression evaluation
        Assert.Null(liveResult.PalletInfo);
        Assert.Null(archiveResult.PalletInfo);
        Assert.Null(liveResult.AssignedFlight);
        Assert.Null(archiveResult.AssignedFlight);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public void JobMappingCore_MapsPickupArrivalTime(bool isUsCustomer)
    {
        // Arrange
        var arrivalTime = new DateTime(2024, 6, 10, 9, 30, 0);
        var job = new TucJob
        {
            UcjbId = 1,
            UcjbDate = new DateTime(2024, 6, 10),
            UcjbTime = new DateTime(2024, 6, 10, 8, 0, 0),
            UcjbNumber = "JOB-001",
            PickupArrivalTime = arrivalTime,
            PricingBreakdownJobs = new List<PricingBreakdown>(),
            TucJobItemJobs = new List<TucJobItem>(),
            TucJobItemChildJobs = new List<TucJobItem>(),
            TucJobNationwides = new List<TucJobNationwide>()
        };

        // Act
        var mapping = JobMappings.JobMappingCore(isUsCustomer).Compile();
        var result = mapping(job);

        // Assert
        Assert.Equal(arrivalTime, result.PickupArrivalTime);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public void JobMappingCore_MapsDeliveryArrivalTime(bool isUsCustomer)
    {
        // Arrange
        var arrivalTime = new DateTime(2024, 6, 10, 14, 45, 0);
        var job = new TucJob
        {
            UcjbId = 1,
            UcjbDate = new DateTime(2024, 6, 10),
            UcjbTime = new DateTime(2024, 6, 10, 8, 0, 0),
            UcjbNumber = "JOB-001",
            DeliveryArrivalTime = arrivalTime,
            PricingBreakdownJobs = new List<PricingBreakdown>(),
            TucJobItemJobs = new List<TucJobItem>(),
            TucJobItemChildJobs = new List<TucJobItem>(),
            TucJobNationwides = new List<TucJobNationwide>()
        };

        // Act
        var mapping = JobMappings.JobMappingCore(isUsCustomer).Compile();
        var result = mapping(job);

        // Assert
        Assert.Equal(arrivalTime, result.DeliveryArrivalTime);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public void JobMappingCore_ArrivalTimes_NullWhenNotSet(bool isUsCustomer)
    {
        // Arrange
        var job = new TucJob
        {
            UcjbId = 1,
            UcjbDate = new DateTime(2024, 6, 10),
            UcjbTime = new DateTime(2024, 6, 10, 8, 0, 0),
            UcjbNumber = "JOB-001",
            PickupArrivalTime = null,
            DeliveryArrivalTime = null,
            PricingBreakdownJobs = new List<PricingBreakdown>(),
            TucJobItemJobs = new List<TucJobItem>(),
            TucJobItemChildJobs = new List<TucJobItem>(),
            TucJobNationwides = new List<TucJobNationwide>()
        };

        // Act
        var mapping = JobMappings.JobMappingCore(isUsCustomer).Compile();
        var result = mapping(job);

        // Assert
        Assert.Null(result.PickupArrivalTime);
        Assert.Null(result.DeliveryArrivalTime);
    }

    [Fact]
    public void LiveJobDownloadMapping_Amount_UsesUcjbAmountDirectly()
    {
        // Arrange - Parent has pricing breakdown but UcjbAmount is used directly
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
            UcjbAmount = 999m,
            PricingBreakdownJobs = new List<PricingBreakdown>
            {
                new() { ChargeAmount = 25m }
            }
        };

        // Act
        var mapping = JobMappings.LiveJobDownloadMapping.Compile();
        var result = mapping(childJob);

        // Assert - Should use UcjbAmount directly
        Assert.Equal(999m, result.Amount);
    }

    [Fact]
    public void LiveJobDownloadMapping_Amount_UsesUcjbAmountWhenNoParent()
    {
        // Arrange - No parent, but job has pricing breakdown - UcjbAmount is used directly
        var job = new TucJob
        {
            UcjbId = 1,
            ParentId = null,
            Parent = null,
            UcjbAmount = 999m,
            PricingBreakdownJobs = new List<PricingBreakdown>
            {
                new() { ChargeAmount = 75m },
                new() { ChargeAmount = 25m }
            }
        };

        // Act
        var mapping = JobMappings.LiveJobDownloadMapping.Compile();
        var result = mapping(job);

        // Assert - Should use UcjbAmount directly
        Assert.Equal(999m, result.Amount);
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
        Assert.Equal(250m, result.Amount);
    }

    [Fact]
    public void LiveJobDownloadMapping_Amount_UsesUcjbAmountRegardlessOfParentPricing()
    {
        // Arrange - Parent exists but has empty pricing - UcjbAmount is used directly
        var parentJob = new TucJob
        {
            UcjbId = 1,
            PricingBreakdownJobs = new List<PricingBreakdown>()
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

        // Assert - Should use UcjbAmount directly
        Assert.Equal(500m, result.Amount);
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
        Assert.Equal(123, result.Id);
        Assert.Equal(100, result.ParentId);
        Assert.Equal("JOB-001", result.JobNumber);
        Assert.Equal("Test Customer", result.CustomerName);
        Assert.Equal(new DateTime(2024, 1, 15, 10, 30, 0), result.BookDate);
        Assert.Equal(new DateTime(2024, 1, 15, 11, 0, 0), result.PickedUpDate);
        Assert.Equal(new DateTime(2024, 1, 15, 12, 0, 0), result.DeliveredDate);
        Assert.Equal(15m, result.Fuel);
        Assert.Equal(10m, result.Ppd);
        Assert.Equal(80m, result.CourierPayment);
        Assert.Equal(8m, result.CourierFuel);
        Assert.Equal(5m, result.CourierBonus);
        Assert.Equal((short)3, result.Quantity);
        Assert.Equal(25.5, result.Weight);
        Assert.Equal(2, result.Size);
        Assert.Equal("123 Pickup St", result.PickupAddressLine1);
        Assert.Equal("Unit 1", result.PickupAddressLine2);
        Assert.Equal("456 Delivery Ave", result.DeliveryAddressLine1);
        Assert.Equal("Suite 200", result.DeliveryAddressLine2);
        Assert.Equal("REF-A", result.ClientReferenceA);
        Assert.Equal("REF-B", result.ClientReferenceB);
        Assert.Equal("REF-C", result.ClientReferenceC);
        Assert.Equal("Completed", result.StatusName);
        Assert.Equal("C001", result.CourierCode);
        Assert.Equal("John Doe", result.LoggedInContact);
        Assert.Equal(125m, result.RawBaseAmount);
        Assert.False(result.IsArchived);
        Assert.Null(result.InvoiceNumber); // Live jobs don't have invoice
        Assert.Null(result.InvoiceDate);
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
        Assert.Equal("Air NZ", result.AgentAirlineName);
        Assert.Equal("NZ123", result.AWB);
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
        Assert.Equal("Agent Smith", result.AgentAirlineName);
        Assert.Null(result.AWB);
    }

    [Fact]
    public void ArchivedJobDownloadMapping_Amount_UsesUcjbAmountDirectly()
    {
        // Arrange - Parent has pricing breakdown but UcjbAmount is used directly
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
            UcjbDate = TestDates.Now,
            UcjbAmount = 999m,
            PricingBreakdowns = new List<PricingBreakdownArchive>
            {
                new() { ChargeAmount = 50m }
            }
        };

        // Act
        var mapping = JobMappings.ArchivedJobDownloadMapping.Compile();
        var result = mapping(archivedJob);

        // Assert - Should use UcjbAmount directly
        Assert.Equal(999m, result.Amount);
    }

    [Fact]
    public void ArchivedJobDownloadMapping_IsArchived_ReturnsTrue()
    {
        // Arrange
        var archivedJob = new TucJobArchive
        {
            UcjbId = 1,
            UcjbDate = TestDates.Now,
            PricingBreakdowns = new List<PricingBreakdownArchive>()
        };

        // Act
        var mapping = JobMappings.ArchivedJobDownloadMapping.Compile();
        var result = mapping(archivedJob);

        // Assert
        Assert.True(result.IsArchived);
    }

    [Fact]
    public void ArchivedJobDownloadMapping_InvoiceDate_FromInvoiceNavigation()
    {
        // Arrange
        var invoiceDate = new DateTime(2024, 2, 1);
        var archivedJob = new TucJobArchive
        {
            UcjbId = 1,
            UcjbDate = TestDates.Now,
            UcjbInvoiceNo = 12345,
            Invoice = new TucInvoiceNo { Created = invoiceDate },
            PricingBreakdowns = new List<PricingBreakdownArchive>()
        };

        // Act
        var mapping = JobMappings.ArchivedJobDownloadMapping.Compile();
        var result = mapping(archivedJob);

        // Assert
        Assert.Equal(12345, result.InvoiceNumber);
        Assert.Equal(invoiceDate, result.InvoiceDate);
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
        Assert.Equal(456, result.Id);
        Assert.Equal(400, result.ParentId);
        Assert.Equal("ARCH-001", result.JobNumber);
        Assert.Equal("Archived Customer", result.CustomerName);
        Assert.Equal(30m, result.Fuel);
        Assert.Equal(20m, result.Ppd);
        Assert.Equal("Archived", result.StatusName);
        Assert.Equal("C002", result.CourierCode);
        Assert.Equal("Archive Agent", result.AgentAirlineName);
        Assert.Null(result.AWB); // Archived jobs don't have nationwide navigation
        Assert.True(result.IsArchived);
        Assert.Equal(250m, result.RawBaseAmount);
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
        Assert.Equal(default, result.BookDate);
    }

    /// <summary>
    /// Tests that UcjbAmount is used directly regardless of parent pricing.
    /// </summary>
    [Fact]
    public void LiveJobDownloadMapping_Amount_UsesUcjbAmountNotParentPricing()
    {
        // Arrange - Parent exists but has NO pricing breakdowns
        var parentJob = new TucJob
        {
            UcjbId = 1,
            PricingBreakdownJobs = new List<PricingBreakdown>()
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

        // Assert - UcjbAmount is used directly
        Assert.Equal(50m, result.Amount);
    }

    /// <summary>
    /// Tests that UcjbAmount is used directly even when parent has pricing.
    /// </summary>
    [Fact]
    public void LiveJobDownloadMapping_Amount_UsesUcjbAmountEvenWithParentPricing()
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

        // Assert - UcjbAmount is used directly
        Assert.Equal(50m, result.Amount);
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
        Assert.True(result.Amount == 150m, "No pricing breakdowns, so UcjbAmount should be used");
    }

    /// <summary>
    /// Tests archived job uses UcjbAmount directly regardless of pricing.
    /// </summary>
    [Fact]
    public void ArchivedJobDownloadMapping_Amount_UsesUcjbAmountRegardlessOfPricing()
    {
        // Arrange
        var parentJob = new TucJobArchive
        {
            UcjbId = 1,
            PricingBreakdowns = new List<PricingBreakdownArchive>()
        };

        var archivedJob = new TucJobArchive
        {
            UcjbId = 2,
            ParentId = 1,
            Parent = parentJob,
            UcjbDate = TestDates.Now,
            UcjbAmount = 50m,
            PricingBreakdowns = new List<PricingBreakdownArchive>
            {
                new() { ChargeAmount = 300m }
            }
        };

        // Act
        var mapping = JobMappings.ArchivedJobDownloadMapping.Compile();
        var result = mapping(archivedJob);

        // Assert - UcjbAmount is used directly
        Assert.Equal(50m, result.Amount);
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
        Assert.Equal(0m, result.Amount);
    }

    /// <summary>
    /// Tests that UcjbAmount is used directly regardless of pricing breakdowns.
    /// </summary>
    [Fact]
    public void LiveJobDownloadMapping_Amount_UsesUcjbAmountIgnoringBreakdowns()
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

        // Assert - Uses UcjbAmount directly, not pricing breakdowns
        Assert.Equal(999m, result.Amount);
    }

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
            PricingBreakdowns = new List<PricingBreakdownArchive>(),
            TucJobItemsArchives = new List<TucJobItemsArchive>()
        };

        // Act
        var mapping = JobMappings.JobArchiveMapping.Compile();
        var result = mapping(archivedJob);

        // Assert - Collections have default values when no items exist (now loaded inline)
        Assert.False(result.TailLiftPu);
        Assert.False(result.TailLiftDo);
        Assert.False(result.DeliverToPrivateRes);
        Assert.True(result.ParcelDimensions is null or []); // Either null or empty depending on expression evaluation
        Assert.Null(result.PalletInfo);
        Assert.Null(result.AssignedFlight);
        Assert.False(result.IsFlightAssigned);
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
        Assert.True(result.IsArchived);
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
            TucJobItemsArchives = new List<TucJobItemsArchive>
            {
                new() { ItemId = 1, Items = 1 },
                new() { ItemId = 2, Items = 1 },
                new() { ItemId = 3, Items = 1 }
            },
            UcjbClient = new TucClient { UcclName = "Test Client" },
            UcjbStatusNavigation = new TucJobStatus { UcjsCode = "DEL", UcjsName = "Delivered" }
        };

        // Act
        var mapping = JobMappings.JobArchiveMapping.Compile();
        var result = mapping(archivedJob);

        // Assert
        Assert.Equal(123, result.Id);
        Assert.Equal("ARCH-123", result.JobNo);
        Assert.Equal(100, result.ParentId);
        Assert.Equal(100, result.RootParentId);
        Assert.Equal("Daily Schedule", result.ScheduleName);
        Assert.False(result.Void);
        Assert.Equal("BARCODE123", result.Barcode);
        Assert.Equal(25.5, result.Weight);
        Assert.Equal(3, result.Items);
        Assert.Equal("REF-A", result.RefA);
        Assert.Equal("REF-B", result.RefB);
        Assert.Equal("OUR-REF", result.OurRef);
        Assert.True(result.Direct);
        Assert.True(result.Van);
        Assert.True(result.VanOk);
        Assert.False(result.Truck);
        Assert.Equal(3, result.DgClass);
        Assert.True(result.Done);
        Assert.Equal(1, result.Lp);
        Assert.Equal(0, result.Ld);
        Assert.True(result.Attention);
        Assert.Equal("Custom Job", result.CustomJobName);
        Assert.Equal("Test Client", result.ClientName);
        Assert.Equal("DEL", result.Status);
        Assert.Equal("Delivered", result.StatusName);
        Assert.True(result.IsArchived);
        Assert.False(result.PreBook);
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
        Assert.Equal("123 Pickup St", result.PickupAddress.AddressLine1);
        Assert.Equal("Unit 1", result.PickupAddress.AddressLine2);
        Assert.Equal(-36.8485m, result.PickupAddress.Latitude);
        Assert.Equal(174.7633m, result.PickupAddress.Longitude);

        // Assert - Delivery Address
        Assert.Equal("456 Delivery Ave", result.DeliveryAddress.AddressLine1);
        Assert.Equal("Suite 200", result.DeliveryAddress.AddressLine2);
        Assert.Equal(-36.8600m, result.DeliveryAddress.Latitude);
        Assert.Equal(174.7700m, result.DeliveryAddress.Longitude);

        // Assert - Direct location properties
        Assert.Equal(-36.8485m, result.PickUpLatitude);
        Assert.Equal(174.7633m, result.PickUpLongitude);
        Assert.Equal(-36.8600m, result.DeliveryLatitude);
        Assert.Equal(174.7700m, result.DeliveryLongitude);
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
        Assert.Equal("C042", result.Courier);
        Assert.NotNull(result.CourierData);
        Assert.Equal("C042", result.CourierData!.Courier);
        Assert.Equal(42, result.CourierData.CourierId);
        Assert.Equal("021-123-4567", result.CourierData.CourierMobile);
        Assert.Equal("John Courier", result.CourierData.CourierName);
        Assert.NotNull(result.AssignedCourier);
        Assert.Equal(42, result.AssignedCourier!.Id);
        Assert.Equal("John Courier", result.AssignedCourier.Text);
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
        Assert.NotNull(result.AssignedAgent);
        Assert.Equal(10, result.AssignedAgent!.AgentId);
        Assert.Equal("Test Agent", result.AssignedAgent.AgentName);
        Assert.Equal("agent@test.com", result.AssignedAgent.AgentEmail);
        Assert.Equal("09-123-4567", result.AssignedAgent.AgentPhone);
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
        Assert.Equal(5, result.SpeedId);
        Assert.Equal("2HR", result.Speed);
        Assert.Equal("2 Hour Delivery", result.SpeedName);
        Assert.Equal(30, result.PickupTime);
        Assert.Equal(120, result.DeliveryTime);
        Assert.Equal(6, result.NotifiedJobTypeId);
        Assert.Equal("Notified Speed", result.NotifiedName);
        Assert.Equal(7, result.AcceptedJobTypeId);
        Assert.Equal("Accepted Speed", result.AcceptedName);
    }

    [Fact]
    public void JobArchiveMapping_ChargeUsesUcjbAmountDirectly()
    {
        // Arrange
        var archivedJob = new TucJobArchive
        {
            UcjbId = 1,
            UcjbDate = new DateTime(2024, 1, 15),
            UcjbAmount = 100m,
            PricingBreakdowns = new List<PricingBreakdownArchive>
            {
                new() { ChargeAmount = 150m },
                new() { ChargeAmount = 50m }
            }
        };

        // Act
        var mapping = JobMappings.JobArchiveMapping.Compile();
        var result = mapping(archivedJob);

        // Assert - Should use UcjbAmount directly
        Assert.Equal(100m, result.Charge);
    }

    [Fact]
    public void JobArchiveMapping_ChargeUsesUcjbAmountIgnoringParentPricing()
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
            UcjbAmount = 50m,
            PricingBreakdowns = new List<PricingBreakdownArchive>
            {
                new() { ChargeAmount = 25m }
            }
        };

        // Act
        var mapping = JobMappings.JobArchiveMapping.Compile();
        var result = mapping(archivedJob);

        // Assert - Should use UcjbAmount directly
        Assert.Equal(50m, result.Charge);
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
        Assert.Equal(250m, result.Charge);
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
        Assert.Equal(1, result.TrackingMethod);
        Assert.Equal("021-555-1234", result.TrackingMobile);
        Assert.Equal("track@test.com", result.TrackingEmail);
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
        Assert.NotNull(result.PickUpTimeZone);
        Assert.Equal(1, result.PickUpTimeZone!.Id);
        Assert.Equal("Pacific/Auckland", result.PickUpTimeZone.Text);
        Assert.NotNull(result.DeliveryTimeZone);
        Assert.Equal(2, result.DeliveryTimeZone!.Id);
        Assert.Equal("America/Los_Angeles", result.DeliveryTimeZone.Text);
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
        Assert.True(lockedResult.Locked);
        Assert.False(unlockedResult.Locked);
        Assert.False(nullResult.Locked);
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
        Assert.True(result.PrivateRes);
        Assert.True(result.Return);
        Assert.True(result.SaturdayDelivery);
        Assert.NotNull(result.CompletedTime);
        Assert.Equal("John Smith", result.DeliverToContact);
        Assert.Equal("09-555-1234", result.ToContactPhone);
        Assert.Equal(2, result.DeliverToLeaveId);
        Assert.Equal("Leave at door", result.SigNotRequired);
        Assert.Equal("Returned to depot", result.UdStatus);
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
        Assert.Equal("Pickup Person", result.FromContactName);
        Assert.Equal("09-111-2222", result.FromContactNumber);
        Assert.Equal("Job", result.FromContactNumberSource);
        Assert.Equal("Delivery Person", result.DeliverToContact);
        Assert.Equal("09-333-4444", result.ToContactPhone);
        Assert.Equal("Admin User", result.LoggedInContactName);
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
        Assert.Equal(1, result.Id);
        Assert.Equal("TEST-001", result.JobNo);
        Assert.Null(result.Courier);
        Assert.Null(result.CourierData);
        Assert.Null(result.AssignedCourier);
        Assert.Null(result.AssignedAgent);
        Assert.Null(result.Speed);
        Assert.Null(result.SpeedName);
        Assert.Null(result.Status);
        Assert.Null(result.StatusName);
        Assert.Equal(string.Empty, result.ClientName);
        Assert.Equal(string.Empty, result.LoggedInContactName);
        Assert.Null(result.PickUpTimeZone);
        Assert.Null(result.DeliveryTimeZone);
    }

    [Fact]
    public void JobMappingCore_Charge_UsesUcjbAmountDirectly()
    {
        // Arrange
        var job = new TucJob
        {
            UcjbId = 1,
            UcjbDate = new DateTime(2024, 1, 15),
            UcjbTime = new DateTime(2024, 1, 15, 10, 0, 0),
            UcjbAmount = 50m,
            PricingBreakdownJobs = new List<PricingBreakdown>
            {
                new() { ChargeAmount = 100m },
                new() { ChargeAmount = 75m }
            },
            TucJobItemJobs = new List<TucJobItem>(),
            TucJobItemChildJobs = new List<TucJobItem>(),
            TucJobNationwides = new List<TucJobNationwide>()
        };

        // Act
        var mapping = JobMappings.JobMappingCore(false).Compile();
        var result = mapping(job);

        // Assert - Should use UcjbAmount directly
        Assert.Equal(50m, result.Charge);
    }

    [Fact]
    public void JobMappingCore_Charge_FallsBackToUcjbAmount_WhenNoPricing()
    {
        // Arrange
        var job = new TucJob
        {
            UcjbId = 1,
            UcjbDate = new DateTime(2024, 1, 15),
            UcjbTime = new DateTime(2024, 1, 15, 10, 0, 0),
            UcjbAmount = 200m,
            PricingBreakdownJobs = new List<PricingBreakdown>(), // Empty
            TucJobItemJobs = new List<TucJobItem>(),
            TucJobItemChildJobs = new List<TucJobItem>(),
            TucJobNationwides = new List<TucJobNationwide>()
        };

        // Act
        var mapping = JobMappings.JobMappingCore(false).Compile();
        var result = mapping(job);

        // Assert - Should fall back to UcjbAmount
        Assert.Equal(200m, result.Charge);
    }

    [Fact]
    public void JobMappingCore_TailLiftPu_TrueWhenJobItemHasPu()
    {
        // Arrange
        var job = new TucJob
        {
            UcjbId = 1,
            UcjbDate = new DateTime(2024, 1, 15),
            UcjbTime = new DateTime(2024, 1, 15, 10, 0, 0),
            PricingBreakdownJobs = new List<PricingBreakdown>(),
            TucJobItemJobs = new List<TucJobItem>
            {
                new() { JobId = 1, ItemId = 1, Pu = true },
                new() { JobId = 1, ItemId = 2, Pu = false }
            },
            TucJobItemChildJobs = new List<TucJobItem>(),
            TucJobNationwides = new List<TucJobNationwide>()
        };

        // Act
        var mapping = JobMappings.JobMappingCore(false).Compile();
        var result = mapping(job);

        // Assert
        Assert.True(result.TailLiftPu);
    }

    [Fact]
    public void JobMappingCore_TailLiftDo_TrueWhenJobItemHasDo()
    {
        // Arrange
        var job = new TucJob
        {
            UcjbId = 1,
            UcjbDate = new DateTime(2024, 1, 15),
            UcjbTime = new DateTime(2024, 1, 15, 10, 0, 0),
            PricingBreakdownJobs = new List<PricingBreakdown>(),
            TucJobItemJobs = new List<TucJobItem>
            {
                new() { JobId = 1, ItemId = 1, Do = true }
            },
            TucJobItemChildJobs = new List<TucJobItem>(),
            TucJobNationwides = new List<TucJobNationwide>()
        };

        // Act
        var mapping = JobMappings.JobMappingCore(false).Compile();
        var result = mapping(job);

        // Assert
        Assert.True(result.TailLiftDo);
    }

    [Fact]
    public void JobMappingCore_DeliverToPrivateRes_TrueWhenJobItemHasPrivateRes()
    {
        // Arrange
        var job = new TucJob
        {
            UcjbId = 1,
            UcjbDate = new DateTime(2024, 1, 15),
            UcjbTime = new DateTime(2024, 1, 15, 10, 0, 0),
            PricingBreakdownJobs = new List<PricingBreakdown>(),
            TucJobItemJobs = new List<TucJobItem>
            {
                new() { JobId = 1, ItemId = 1, PrivateRes = true }
            },
            TucJobItemChildJobs = new List<TucJobItem>(),
            TucJobNationwides = new List<TucJobNationwide>()
        };

        // Act
        var mapping = JobMappings.JobMappingCore(false).Compile();
        var result = mapping(job);

        // Assert
        Assert.True(result.DeliverToPrivateRes);
    }

    [Fact]
    public void JobMappingCore_Flags_FalseWhenNoJobItems()
    {
        // Arrange
        var job = new TucJob
        {
            UcjbId = 1,
            UcjbDate = new DateTime(2024, 1, 15),
            UcjbTime = new DateTime(2024, 1, 15, 10, 0, 0),
            PricingBreakdownJobs = new List<PricingBreakdown>(),
            TucJobItemJobs = new List<TucJobItem>(),
            TucJobItemChildJobs = new List<TucJobItem>(),
            TucJobNationwides = new List<TucJobNationwide>()
        };

        // Act
        var mapping = JobMappings.JobMappingCore(false).Compile();
        var result = mapping(job);

        // Assert
        Assert.False(result.TailLiftPu);
        Assert.False(result.TailLiftDo);
        Assert.False(result.DeliverToPrivateRes);
    }

    [Fact]
    public void JobMappingCore_ParcelDimensions_UsesChildJobItems()
    {
        // Arrange
        var job = new TucJob
        {
            UcjbId = 1,
            UcjbDate = new DateTime(2024, 1, 15),
            UcjbTime = new DateTime(2024, 1, 15, 10, 0, 0),
            PricingBreakdownJobs = new List<PricingBreakdown>(),
            TucJobItemJobs = new List<TucJobItem>
            {
                new() { JobId = 1, ItemId = 1, Notes = "Parent Item", Height = 10 }
            },
            TucJobItemChildJobs = new List<TucJobItem>
            {
                new() { JobId = 1, ItemId = 2, ChildJobId = 1, Notes = "Child Item", Height = 20, Depth = 30, Length = 40, Barcode = "CHILD123" }
            },
            TucJobNationwides = new List<TucJobNationwide>()
        };

        // Act
        var mapping = JobMappings.JobMappingCore(false).Compile();
        var result = mapping(job);

        // Assert - Should use child items when available
        Assert.NotNull(result.ParcelDimensions);
        Assert.Single(result.ParcelDimensions);
        Assert.Equal("Child Item", result.ParcelDimensions![0].ItemName);
        Assert.Equal(20, result.ParcelDimensions[0].Height);
        Assert.Equal(30, result.ParcelDimensions[0].Depth);
        Assert.Equal(40, result.ParcelDimensions[0].Length);
        Assert.Equal("CHILD123", result.ParcelDimensions[0].Barcode);
    }

    [Fact]
    public void JobMappingCore_ParcelDimensions_FallsBackToParentItems()
    {
        // Arrange
        var job = new TucJob
        {
            UcjbId = 1,
            UcjbDate = new DateTime(2024, 1, 15),
            UcjbTime = new DateTime(2024, 1, 15, 10, 0, 0),
            PricingBreakdownJobs = new List<PricingBreakdown>(),
            TucJobItemJobs = new List<TucJobItem>
            {
                new() { JobId = 1, ItemId = 1, ChildJobId = null, Notes = "Parent Item", Height = 15, Depth = 25, Length = 35 }
            },
            TucJobItemChildJobs = new List<TucJobItem>(), // No child items
            TucJobNationwides = new List<TucJobNationwide>()
        };

        // Act
        var mapping = JobMappings.JobMappingCore(false).Compile();
        var result = mapping(job);

        // Assert - Should fall back to parent items
        Assert.NotNull(result.ParcelDimensions);
        Assert.Single(result.ParcelDimensions);
        Assert.Equal("Parent Item", result.ParcelDimensions![0].ItemName);
        Assert.Equal(15, result.ParcelDimensions[0].Height);
    }

    [Fact]
    public void JobMappingCore_ParcelDimensions_EmptyWhenNoItems()
    {
        // Arrange
        var job = new TucJob
        {
            UcjbId = 1,
            UcjbDate = new DateTime(2024, 1, 15),
            UcjbTime = new DateTime(2024, 1, 15, 10, 0, 0),
            PricingBreakdownJobs = new List<PricingBreakdown>(),
            TucJobItemJobs = new List<TucJobItem>(),
            TucJobItemChildJobs = new List<TucJobItem>(),
            TucJobNationwides = new List<TucJobNationwide>()
        };

        // Act
        var mapping = JobMappings.JobMappingCore(false).Compile();
        var result = mapping(job);

        // Assert
        Assert.Empty(result.ParcelDimensions);
    }

    [Fact]
    public void JobMappingCore_PalletInfo_MapsFromParentJobItems()
    {
        // Arrange
        var job = new TucJob
        {
            UcjbId = 1,
            UcjbDate = new DateTime(2024, 1, 15),
            UcjbTime = new DateTime(2024, 1, 15, 10, 0, 0),
            PricingBreakdownJobs = new List<PricingBreakdown>(),
            TucJobItemJobs = new List<TucJobItem>
            {
                new()
                {
                    JobId = 1,
                    ItemId = 1,
                    ChildJobId = null, // Parent item
                    Items = 5,
                    Weight = 100,
                    Length = 120,
                    Depth = 80,
                    Height = 100,
                    Pu = true,
                    Do = false,
                    Dgclass = 3,
                    Notes = "Pallet Notes"
                }
            },
            TucJobItemChildJobs = new List<TucJobItem>(),
            TucJobNationwides = new List<TucJobNationwide>()
        };

        // Act
        var mapping = JobMappings.JobMappingCore(false).Compile();
        var result = mapping(job);

        // Assert
        Assert.NotNull(result.PalletInfo);
        Assert.Single(result.PalletInfo);
        Assert.Equal(5, result.PalletInfo![0].Quantity);
        Assert.Equal(100, result.PalletInfo[0].Weight);
        Assert.Equal(120, result.PalletInfo[0].Length);
        Assert.Equal(80, result.PalletInfo[0].Depth);
        Assert.Equal(100, result.PalletInfo[0].Height);
        Assert.True(result.PalletInfo[0].Pu);
        Assert.False(result.PalletInfo[0].Do);
        Assert.Equal(3, result.PalletInfo[0].DgClass);
        Assert.Equal("Pallet Notes", result.PalletInfo[0].Notes);
    }

    [Fact]
    public void JobMappingCore_PalletInfo_ExcludesChildItems()
    {
        // Arrange
        var job = new TucJob
        {
            UcjbId = 1,
            UcjbDate = new DateTime(2024, 1, 15),
            UcjbTime = new DateTime(2024, 1, 15, 10, 0, 0),
            PricingBreakdownJobs = new List<PricingBreakdown>(),
            TucJobItemJobs = new List<TucJobItem>
            {
                new() { JobId = 1, ItemId = 1, ChildJobId = 2, Items = 10 }, // Child item - should be excluded
                new() { JobId = 1, ItemId = 2, ChildJobId = null, Items = 5 } // Parent item - should be included
            },
            TucJobItemChildJobs = new List<TucJobItem>(),
            TucJobNationwides = new List<TucJobNationwide>()
        };

        // Act
        var mapping = JobMappings.JobMappingCore(false).Compile();
        var result = mapping(job);

        // Assert - Only parent item should be in pallet info
        Assert.NotNull(result.PalletInfo);
        Assert.Single(result.PalletInfo);
        Assert.Equal(5, result.PalletInfo![0].Quantity);
    }

    [Fact]
    public void JobMappingCore_PalletInfo_NullWhenNoParentItems()
    {
        // Arrange
        var job = new TucJob
        {
            UcjbId = 1,
            UcjbDate = new DateTime(2024, 1, 15),
            UcjbTime = new DateTime(2024, 1, 15, 10, 0, 0),
            PricingBreakdownJobs = new List<PricingBreakdown>(),
            TucJobItemJobs = new List<TucJobItem>(), // No items
            TucJobItemChildJobs = new List<TucJobItem>(),
            TucJobNationwides = new List<TucJobNationwide>()
        };

        // Act
        var mapping = JobMappings.JobMappingCore(false).Compile();
        var result = mapping(job);

        // Assert
        Assert.Null(result.PalletInfo);
    }

    [Fact]
    public void JobMappingCore_AssignedFlight_MapsFromNationwides()
    {
        // Arrange
        var depTimezone = new TimeZone { Id = 1, Name = "Pacific/Auckland" };
        var arrTimezone = new TimeZone { Id = 2, Name = "America/Los_Angeles" };

        var job = new TucJob
        {
            UcjbId = 1,
            UcjbDate = new DateTime(2024, 1, 15),
            UcjbTime = new DateTime(2024, 1, 15, 10, 0, 0),
            PricingBreakdownJobs = new List<PricingBreakdown>(),
            TucJobItemJobs = new List<TucJobItem>(),
            TucJobItemChildJobs = new List<TucJobItem>(),
            TucJobNationwides = new List<TucJobNationwide>
            {
                new()
                {
                    UcnwLegNumber = 1,
                    UcnwFlightNo = "NZ123",
                    UcnwEtd = new DateTime(2024, 1, 15, 10, 0, 0),
                    UcnwEta = new DateTime(2024, 1, 15, 14, 0, 0),
                    UcnwNotes = "First leg notes",
                    DepartureAirportFsCode = "AKL",
                    DepartureAirportName = "Auckland Airport",
                    DepartureAirportCity = "Auckland",
                    DepartureAirportCountry = "New Zealand",
                    DepartureAirportTimeZoneNavigation = depTimezone,
                    DepartureAirportTimeZoneId = 1,
                    DepartureTerminal = "Int",
                    ArrivalAirportFsCode = "LAX",
                    ArrivalAirportName = "Los Angeles Airport",
                    ArrivalAirportCity = "Los Angeles",
                    ArrivalAirportCountry = "USA",
                    ArrivalAirportTimeZoneNavigation = arrTimezone,
                    ArrivalAirportTimeZoneId = 2,
                    ArrivalTerminal = "B",
                    AircraftName = "Boeing 787",
                    UcnwAirlineName = "Air New Zealand"
                }
            }
        };

        // Act
        var mapping = JobMappings.JobMappingCore(false).Compile();
        var result = mapping(job);

        // Assert
        Assert.NotNull(result.AssignedFlight);
        Assert.Equal("NZ123", result.AssignedFlight!.FlightNumber);
        Assert.Equal("First leg notes", result.AssignedFlight.Notes);
        Assert.Equal(new DateTime(2024, 1, 15, 10, 0, 0), result.AssignedFlight.ExpectedDeparture);
        Assert.Equal(new DateTime(2024, 1, 15, 14, 0, 0), result.AssignedFlight.ExpectedArrival);
        Assert.Equal("Pacific/Auckland", result.AssignedFlight.DepartureTimeZone);
        Assert.Equal("America/Los_Angeles", result.AssignedFlight.ArrivalTimeZone);
        Assert.True(result.IsFlightAssigned);
    }

    [Fact]
    public void JobMappingCore_AssignedFlight_MapsMultipleSegments()
    {
        // Arrange
        var job = new TucJob
        {
            UcjbId = 1,
            UcjbDate = new DateTime(2024, 1, 15),
            UcjbTime = new DateTime(2024, 1, 15, 10, 0, 0),
            PricingBreakdownJobs = new List<PricingBreakdown>(),
            TucJobItemJobs = new List<TucJobItem>(),
            TucJobItemChildJobs = new List<TucJobItem>(),
            TucJobNationwides = new List<TucJobNationwide>
            {
                new()
                {
                    UcnwLegNumber = 1,
                    UcnwFlightNo = "NZ1",
                    UcnwEtd = new DateTime(2024, 1, 15, 8, 0, 0),
                    UcnwEta = new DateTime(2024, 1, 15, 12, 0, 0),
                    DepartureAirportFsCode = "AKL",
                    ArrivalAirportFsCode = "SYD"
                },
                new()
                {
                    UcnwLegNumber = 2,
                    UcnwFlightNo = "QF2",
                    UcnwEtd = new DateTime(2024, 1, 15, 14, 0, 0),
                    UcnwEta = new DateTime(2024, 1, 15, 22, 0, 0),
                    DepartureAirportFsCode = "SYD",
                    ArrivalAirportFsCode = "LAX"
                }
            }
        };

        // Act
        var mapping = JobMappings.JobMappingCore(false).Compile();
        var result = mapping(job);

        // Assert
        Assert.NotNull(result.AssignedFlight);
        Assert.Equal(2, result.AssignedFlight!.FlightSegments.Count);

        // First segment (departure info)
        Assert.Equal(new DateTime(2024, 1, 15, 8, 0, 0), result.AssignedFlight.ExpectedDeparture);
        Assert.Equal("NZ1", result.AssignedFlight.FlightNumber);

        // Last segment (arrival info)
        Assert.Equal(new DateTime(2024, 1, 15, 22, 0, 0), result.AssignedFlight.ExpectedArrival);

        // Segment details
        Assert.Equal("AKL", result.AssignedFlight.FlightSegments[0].DepartureAirportFsCode);
        Assert.Equal("SYD", result.AssignedFlight.FlightSegments[0].ArrivalAirportFsCode);
        Assert.Equal("SYD", result.AssignedFlight.FlightSegments[1].DepartureAirportFsCode);
        Assert.Equal("LAX", result.AssignedFlight.FlightSegments[1].ArrivalAirportFsCode);
    }

    [Fact]
    public void JobMappingCore_AssignedFlight_ParsesCarrierAndFlightNumber()
    {
        // Arrange
        var job = new TucJob
        {
            UcjbId = 1,
            UcjbDate = new DateTime(2024, 1, 15),
            UcjbTime = new DateTime(2024, 1, 15, 10, 0, 0),
            PricingBreakdownJobs = new List<PricingBreakdown>(),
            TucJobItemJobs = new List<TucJobItem>(),
            TucJobItemChildJobs = new List<TucJobItem>(),
            TucJobNationwides = new List<TucJobNationwide>
            {
                new()
                {
                    UcnwLegNumber = 1,
                    UcnwFlightNo = "NZ123"
                }
            }
        };

        // Act
        var mapping = JobMappings.JobMappingCore(false).Compile();
        var result = mapping(job);

        // Assert
        Assert.NotNull(result.AssignedFlight);
        Assert.Equal("NZ", result.AssignedFlight!.FlightSegments[0].CarrierFsCode);
        Assert.Equal("123", result.AssignedFlight.FlightSegments[0].FlightNumber);
    }

    [Fact]
    public void JobMappingCore_AssignedFlight_NullWhenNoNationwides()
    {
        // Arrange
        var job = new TucJob
        {
            UcjbId = 1,
            UcjbDate = new DateTime(2024, 1, 15),
            UcjbTime = new DateTime(2024, 1, 15, 10, 0, 0),
            PricingBreakdownJobs = new List<PricingBreakdown>(),
            TucJobItemJobs = new List<TucJobItem>(),
            TucJobItemChildJobs = new List<TucJobItem>(),
            TucJobNationwides = new List<TucJobNationwide>()
        };

        // Act
        var mapping = JobMappings.JobMappingCore(false).Compile();
        var result = mapping(job);

        // Assert
        Assert.Null(result.AssignedFlight);
        Assert.False(result.IsFlightAssigned);
    }

    [Fact]
    public void JobArchiveMapping_TailLiftPu_TrueWhenArchivedItemHasPu()
    {
        // Arrange
        var archivedJob = new TucJobArchive
        {
            UcjbId = 1,
            UcjbDate = new DateTime(2024, 1, 15),
            PricingBreakdowns = new List<PricingBreakdownArchive>(),
            TucJobItemsArchives = new List<TucJobItemsArchive>
            {
                new() { JobId = 1, ItemId = 1, Pu = true }
            }
        };

        // Act
        var mapping = JobMappings.JobArchiveMapping.Compile();
        var result = mapping(archivedJob);

        // Assert
        Assert.True(result.TailLiftPu);
    }

    [Fact]
    public void JobArchiveMapping_TailLiftDo_TrueWhenArchivedItemHasDo()
    {
        // Arrange
        var archivedJob = new TucJobArchive
        {
            UcjbId = 1,
            UcjbDate = new DateTime(2024, 1, 15),
            PricingBreakdowns = new List<PricingBreakdownArchive>(),
            TucJobItemsArchives = new List<TucJobItemsArchive>
            {
                new() { JobId = 1, ItemId = 1, Do = true }
            }
        };

        // Act
        var mapping = JobMappings.JobArchiveMapping.Compile();
        var result = mapping(archivedJob);

        // Assert
        Assert.True(result.TailLiftDo);
    }

    [Fact]
    public void JobArchiveMapping_DeliverToPrivateRes_TrueWhenArchivedItemHasPrivateRes()
    {
        // Arrange
        var archivedJob = new TucJobArchive
        {
            UcjbId = 1,
            UcjbDate = new DateTime(2024, 1, 15),
            PricingBreakdowns = new List<PricingBreakdownArchive>(),
            TucJobItemsArchives = new List<TucJobItemsArchive>
            {
                new() { JobId = 1, ItemId = 1, PrivateRes = true }
            }
        };

        // Act
        var mapping = JobMappings.JobArchiveMapping.Compile();
        var result = mapping(archivedJob);

        // Assert
        Assert.True(result.DeliverToPrivateRes);
    }

    [Fact]
    public void JobArchiveMapping_ParcelDimensions_MapsFromArchivedItems()
    {
        // Arrange
        var archivedJob = new TucJobArchive
        {
            UcjbId = 1,
            UcjbDate = new DateTime(2024, 1, 15),
            PricingBreakdowns = new List<PricingBreakdownArchive>(),
            TucJobItemsArchives = new List<TucJobItemsArchive>
            {
                new()
                {
                    JobId = 1,
                    ItemId = 1,
                    ChildJobId = null,
                    Notes = "Archived Parcel",
                    Height = 10,
                    Depth = 20,
                    Length = 30,
                    Barcode = "ARCH123"
                }
            }
        };

        // Act
        var mapping = JobMappings.JobArchiveMapping.Compile();
        var result = mapping(archivedJob);

        // Assert
        Assert.NotNull(result.ParcelDimensions);
        Assert.Single(result.ParcelDimensions);
        Assert.Equal("Archived Parcel", result.ParcelDimensions![0].ItemName);
        Assert.Equal(10, result.ParcelDimensions[0].Height);
        Assert.Equal(20, result.ParcelDimensions[0].Depth);
        Assert.Equal(30, result.ParcelDimensions[0].Length);
        Assert.Equal("ARCH123", result.ParcelDimensions[0].Barcode);
    }

    [Fact]
    public void JobArchiveMapping_PalletInfo_MapsFromArchivedItems()
    {
        // Arrange
        var archivedJob = new TucJobArchive
        {
            UcjbId = 1,
            UcjbDate = new DateTime(2024, 1, 15),
            PricingBreakdowns = new List<PricingBreakdownArchive>(),
            TucJobItemsArchives = new List<TucJobItemsArchive>
            {
                new()
                {
                    JobId = 1,
                    ItemId = 1,
                    ChildJobId = null, // Parent item
                    Items = 3,
                    Weight = 50,
                    Length = 100,
                    Depth = 80,
                    Height = 120,
                    Pu = true,
                    Do = false,
                    Dgclass = 2,
                    Notes = "Archived Pallet"
                }
            }
        };

        // Act
        var mapping = JobMappings.JobArchiveMapping.Compile();
        var result = mapping(archivedJob);

        // Assert
        Assert.NotNull(result.PalletInfo);
        Assert.Single(result.PalletInfo);
        Assert.Equal(3, result.PalletInfo![0].Quantity);
        Assert.Equal(50, result.PalletInfo[0].Weight);
        Assert.Equal(100, result.PalletInfo[0].Length);
        Assert.Equal(80, result.PalletInfo[0].Depth);
        Assert.Equal(120, result.PalletInfo[0].Height);
        Assert.Equal(2, result.PalletInfo[0].DgClass);
        Assert.Equal("Archived Pallet", result.PalletInfo[0].Notes);
    }

    [Fact]
    public void JobArchiveMapping_AssignedFlight_AlwaysNullForArchivedJobs()
    {
        // Arrange - Flight info is not loaded inline for archived jobs
        // Use BatchLoadFlightInfo to load flight data separately
        var archivedJob = new TucJobArchive
        {
            UcjbId = 1,
            UcjbDate = new DateTime(2024, 1, 15),
            PricingBreakdowns = new List<PricingBreakdownArchive>(),
            TucJobItemsArchives = new List<TucJobItemsArchive>()
        };

        // Act
        var mapping = JobMappings.JobArchiveMapping.Compile();
        var result = mapping(archivedJob);

        // Assert - Flight info is always null for archived jobs in the mapping
        Assert.Null(result.AssignedFlight);
        Assert.False(result.IsFlightAssigned);
    }

    [Fact]
    public void ConvertUtcToTimeZone_WithNullDateTime_ReturnsSqlMinDateTime()
    {
        // Arrange
        DateTime? nullDateTime = null;

        // Act
        var method = typeof(JobMappings).GetMethod(
            "ConvertUtcToTimeZone",
            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static,
            null,
            [typeof(DateTime?), typeof(string)],
            null);
        var result = (DateTimeOffset)method!.Invoke(null, [nullDateTime, "Pacific Standard Time"])!;

        // Assert - Should return SqlMinDateTime (1753-01-01)
        Assert.Equal(1753, result.Year);
    }

    [Fact]
    public void ConvertUtcToTimeZone_WithNullTimeZone_ReturnsUtcOffset()
    {
        // Arrange
        var utcTime = new DateTime(2024, 1, 15, 12, 0, 0, DateTimeKind.Utc);

        // Act
        var method = typeof(JobMappings).GetMethod(
            "ConvertUtcToTimeZone",
            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static,
            null,
            [typeof(DateTime), typeof(string)],
            null);
        var result = (DateTimeOffset)method!.Invoke(null, [utcTime, null])!;

        // Assert - Should return with zero offset (UTC)
        Assert.Equal(12, result.Hour);
        Assert.Equal(TimeSpan.Zero, result.Offset);
    }

    [Fact]
    public void ConvertUtcToTimeZone_WithEmptyTimeZone_ReturnsUtcOffset()
    {
        // Arrange
        var utcTime = new DateTime(2024, 1, 15, 12, 0, 0, DateTimeKind.Utc);

        // Act
        var method = typeof(JobMappings).GetMethod(
            "ConvertUtcToTimeZone",
            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static,
            null,
            [typeof(DateTime), typeof(string)],
            null);
        var result = (DateTimeOffset)method!.Invoke(null, [utcTime, ""])!;

        // Assert
        Assert.Equal(12, result.Hour);
        Assert.Equal(TimeSpan.Zero, result.Offset);
    }

    [Fact]
    public void JobMappingCore_FromContactNumber_UsesJobPhone_WhenSet()
    {
        // Arrange
        var job = new TucJob
        {
            UcjbId = 1,
            UcjbDate = new DateTime(2024, 1, 15),
            UcjbTime = new DateTime(2024, 1, 15, 10, 0, 0),
            PickupFromPhone = "09-123-4567",
            Contact = new TucClientContact { UcctDirectDial = "09-111-1111", UcctMobile = "021-222-2222" },
            UcjbClient = new TucClient { UcclPhone = "09-333-3333" },
            PricingBreakdownJobs = new List<PricingBreakdown>(),
            TucJobItemJobs = new List<TucJobItem>(),
            TucJobItemChildJobs = new List<TucJobItem>(),
            TucJobNationwides = new List<TucJobNationwide>()
        };

        // Act
        var mapping = JobMappings.JobMappingCore(false).Compile();
        var result = mapping(job);

        // Assert - Job phone takes priority
        Assert.Equal("09-123-4567", result.FromContactNumber);
        Assert.Equal("Job", result.FromContactNumberSource);
    }

    [Fact]
    public void JobMappingCore_FromContactNumber_FallsBackToDirectLine()
    {
        // Arrange
        var job = new TucJob
        {
            UcjbId = 1,
            UcjbDate = new DateTime(2024, 1, 15),
            UcjbTime = new DateTime(2024, 1, 15, 10, 0, 0),
            PickupFromPhone = null,
            Contact = new TucClientContact { UcctDirectDial = "09-111-1111", UcctMobile = "021-222-2222" },
            UcjbClient = new TucClient { UcclPhone = "09-333-3333" },
            PricingBreakdownJobs = new List<PricingBreakdown>(),
            TucJobItemJobs = new List<TucJobItem>(),
            TucJobItemChildJobs = new List<TucJobItem>(),
            TucJobNationwides = new List<TucJobNationwide>()
        };

        // Act
        var mapping = JobMappings.JobMappingCore(false).Compile();
        var result = mapping(job);

        // Assert
        Assert.Equal("09-111-1111", result.FromContactNumber);
        Assert.Equal("Direct Line", result.FromContactNumberSource);
    }

    [Fact]
    public void JobMappingCore_FromContactNumber_FallsBackToMobile()
    {
        // Arrange
        var job = new TucJob
        {
            UcjbId = 1,
            UcjbDate = new DateTime(2024, 1, 15),
            UcjbTime = new DateTime(2024, 1, 15, 10, 0, 0),
            PickupFromPhone = null,
            Contact = new TucClientContact { UcctDirectDial = "", UcctMobile = "021-222-2222" },
            UcjbClient = new TucClient { UcclPhone = "09-333-3333" },
            PricingBreakdownJobs = new List<PricingBreakdown>(),
            TucJobItemJobs = new List<TucJobItem>(),
            TucJobItemChildJobs = new List<TucJobItem>(),
            TucJobNationwides = new List<TucJobNationwide>()
        };

        // Act
        var mapping = JobMappings.JobMappingCore(false).Compile();
        var result = mapping(job);

        // Assert
        Assert.Equal("021-222-2222", result.FromContactNumber);
        Assert.Equal("Mobile", result.FromContactNumberSource);
    }

    [Fact]
    public void JobMappingCore_FromContactNumber_FallsBackToCompanyPhone()
    {
        // Arrange
        var job = new TucJob
        {
            UcjbId = 1,
            UcjbDate = new DateTime(2024, 1, 15),
            UcjbTime = new DateTime(2024, 1, 15, 10, 0, 0),
            PickupFromPhone = null,
            Contact = null,
            UcjbClient = new TucClient { UcclPhone = "09-333-3333" },
            PricingBreakdownJobs = new List<PricingBreakdown>(),
            TucJobItemJobs = new List<TucJobItem>(),
            TucJobItemChildJobs = new List<TucJobItem>(),
            TucJobNationwides = new List<TucJobNationwide>()
        };

        // Act
        var mapping = JobMappings.JobMappingCore(false).Compile();
        var result = mapping(job);

        // Assert
        Assert.Equal("09-333-3333", result.FromContactNumber);
        Assert.Equal("Company", result.FromContactNumberSource);
    }

    [Fact]
    public void JobMappingCore_FromContactNumber_NullWhenNothingAvailable()
    {
        // Arrange
        var job = new TucJob
        {
            UcjbId = 1,
            UcjbDate = new DateTime(2024, 1, 15),
            UcjbTime = new DateTime(2024, 1, 15, 10, 0, 0),
            PickupFromPhone = null,
            Contact = null,
            UcjbClient = null,
            PricingBreakdownJobs = new List<PricingBreakdown>(),
            TucJobItemJobs = new List<TucJobItem>(),
            TucJobItemChildJobs = new List<TucJobItem>(),
            TucJobNationwides = new List<TucJobNationwide>()
        };

        // Act
        var mapping = JobMappings.JobMappingCore(false).Compile();
        var result = mapping(job);

        // Assert
        Assert.Null(result.FromContactNumber);
        Assert.Null(result.FromContactNumberSource);
    }

    [Fact]
    public void JobMappingCore_FromContactNumber_EmptyStringTreatedAsNull()
    {
        // Arrange - Empty string should fall through to next level
        var job = new TucJob
        {
            UcjbId = 1,
            UcjbDate = new DateTime(2024, 1, 15),
            UcjbTime = new DateTime(2024, 1, 15, 10, 0, 0),
            PickupFromPhone = "",
            Contact = new TucClientContact { UcctDirectDial = "09-111-1111" },
            PricingBreakdownJobs = new List<PricingBreakdown>(),
            TucJobItemJobs = new List<TucJobItem>(),
            TucJobItemChildJobs = new List<TucJobItem>(),
            TucJobNationwides = new List<TucJobNationwide>()
        };

        // Act
        var mapping = JobMappings.JobMappingCore(false).Compile();
        var result = mapping(job);

        // Assert - Should skip empty job phone and use direct line
        Assert.Equal("09-111-1111", result.FromContactNumber);
        Assert.Equal("Direct Line", result.FromContactNumberSource);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public void JobMappingCore_ParcelDimensions_ChildJobInheritsParentItems(bool isUsCustomer)
    {
        // Arrange - Parent has items, child has none (non-stop child scenario)
        var parentJob = new TucJob
        {
            UcjbId = 100,
            TucJobItemJobs = new List<TucJobItem>
            {
                new() { JobId = 100, ItemId = 1, Notes = "Box A", Height = 10, Depth = 20, Length = 30, Barcode = "BC1" },
                new() { JobId = 100, ItemId = 2, Notes = "Box B", Height = 15, Depth = 25, Length = 35, Barcode = "BC2" }
            },
            TucJobItemChildJobs = new List<TucJobItem>(),
            TucJobNationwides = new List<TucJobNationwide>(),
            PricingBreakdownJobs = new List<PricingBreakdown>()
        };

        var childJob = new TucJob
        {
            UcjbId = 200,
            ParentId = 100,
            Parent = parentJob,
            UcjbDate = new DateTime(2024, 6, 10),
            UcjbTime = new DateTime(2024, 6, 10, 8, 0, 0),
            UcjbNumber = "CHILD-001",
            TucJobItemJobs = new List<TucJobItem>(),
            TucJobItemChildJobs = new List<TucJobItem>(),
            TucJobNationwides = new List<TucJobNationwide>(),
            PricingBreakdownJobs = new List<PricingBreakdown>()
        };

        // Act
        var mapping = JobMappings.JobMappingCore(isUsCustomer).Compile();
        var result = mapping(childJob);

        // Assert - Should inherit parent's items
        Assert.Equal(2, result.ParcelDimensions.Count);
        Assert.Equal("Box A", result.ParcelDimensions[0].ItemName);
        Assert.Equal("BC1", result.ParcelDimensions[0].Barcode);
        Assert.Equal("Box B", result.ParcelDimensions[1].ItemName);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public void JobMappingCore_PalletInfo_ChildJobInheritsParentItems(bool isUsCustomer)
    {
        // Arrange - Parent has pallet items, child has none
        var parentJob = new TucJob
        {
            UcjbId = 100,
            TucJobItemJobs = new List<TucJobItem>
            {
                new() { JobId = 100, ItemId = 1, Items = 5, Weight = 100, Length = 120, Depth = 80, Height = 100, Notes = "Pallet 1" }
            },
            TucJobItemChildJobs = new List<TucJobItem>(),
            TucJobNationwides = new List<TucJobNationwide>(),
            PricingBreakdownJobs = new List<PricingBreakdown>()
        };

        var childJob = new TucJob
        {
            UcjbId = 200,
            ParentId = 100,
            Parent = parentJob,
            UcjbDate = new DateTime(2024, 6, 10),
            UcjbTime = new DateTime(2024, 6, 10, 8, 0, 0),
            UcjbNumber = "CHILD-002",
            TucJobItemJobs = new List<TucJobItem>(),
            TucJobItemChildJobs = new List<TucJobItem>(),
            TucJobNationwides = new List<TucJobNationwide>(),
            PricingBreakdownJobs = new List<PricingBreakdown>()
        };

        // Act
        var mapping = JobMappings.JobMappingCore(isUsCustomer).Compile();
        var result = mapping(childJob);

        // Assert - Should inherit parent's pallet info
        Assert.Single(result.PalletInfo);
        Assert.Equal(5, result.PalletInfo[0].Quantity);
        Assert.Equal(100, result.PalletInfo[0].Weight);
        Assert.Equal("Pallet 1", result.PalletInfo[0].Notes);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public void JobMappingCore_Flags_ChildJobInheritsParentFlags(bool isUsCustomer)
    {
        // Arrange - Parent has tail lift and private res flags
        var parentJob = new TucJob
        {
            UcjbId = 100,
            TucJobItemJobs = new List<TucJobItem>
            {
                new() { JobId = 100, ItemId = 1, Pu = true, Do = true, PrivateRes = true }
            },
            TucJobItemChildJobs = new List<TucJobItem>(),
            TucJobNationwides = new List<TucJobNationwide>(),
            PricingBreakdownJobs = new List<PricingBreakdown>()
        };

        var childJob = new TucJob
        {
            UcjbId = 200,
            ParentId = 100,
            Parent = parentJob,
            UcjbDate = new DateTime(2024, 6, 10),
            UcjbTime = new DateTime(2024, 6, 10, 8, 0, 0),
            UcjbNumber = "CHILD-003",
            TucJobItemJobs = new List<TucJobItem>(),
            TucJobItemChildJobs = new List<TucJobItem>(),
            TucJobNationwides = new List<TucJobNationwide>(),
            PricingBreakdownJobs = new List<PricingBreakdown>()
        };

        // Act
        var mapping = JobMappings.JobMappingCore(isUsCustomer).Compile();
        var result = mapping(childJob);

        // Assert - Should inherit parent's flags
        Assert.True(result.TailLiftPu, "child job should inherit TailLiftPu from parent");
        Assert.True(result.TailLiftDo, "child job should inherit TailLiftDo from parent");
        Assert.True(result.DeliverToPrivateRes, "child job should inherit DeliverToPrivateRes from parent");
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public void JobMappingCore_Items_ChildJobInheritsParentItemCount(bool isUsCustomer)
    {
        // Arrange - Parent has 3 items, child has none
        var parentJob = new TucJob
        {
            UcjbId = 100,
            TucJobItemJobs = new List<TucJobItem>
            {
                new() { JobId = 100, ItemId = 1 },
                new() { JobId = 100, ItemId = 2 },
                new() { JobId = 100, ItemId = 3 }
            },
            TucJobItemChildJobs = new List<TucJobItem>(),
            TucJobNationwides = new List<TucJobNationwide>(),
            PricingBreakdownJobs = new List<PricingBreakdown>()
        };

        var childJob = new TucJob
        {
            UcjbId = 200,
            ParentId = 100,
            Parent = parentJob,
            UcjbDate = new DateTime(2024, 6, 10),
            UcjbTime = new DateTime(2024, 6, 10, 8, 0, 0),
            UcjbNumber = "CHILD-004",
            TucJobItemJobs = new List<TucJobItem>(),
            TucJobItemChildJobs = new List<TucJobItem>(),
            TucJobNationwides = new List<TucJobNationwide>(),
            PricingBreakdownJobs = new List<PricingBreakdown>()
        };

        // Act
        var mapping = JobMappings.JobMappingCore(isUsCustomer).Compile();
        var result = mapping(childJob);

        // Assert
        Assert.True(result.Items == 3, "child job should inherit item count from parent");
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public void JobMappingCore_StopChildJob_UsesOwnChildItems(bool isUsCustomer)
    {
        // Arrange - Stop child has items via TucJobItemChildJobs (ChildJobId = this job)
        var parentJob = new TucJob
        {
            UcjbId = 100,
            TucJobItemJobs = new List<TucJobItem>
            {
                new() { JobId = 100, ItemId = 1, Notes = "Parent Item", Height = 99 }
            },
            TucJobItemChildJobs = new List<TucJobItem>(),
            TucJobNationwides = new List<TucJobNationwide>(),
            PricingBreakdownJobs = new List<PricingBreakdown>()
        };

        var stopChildJob = new TucJob
        {
            UcjbId = 300,
            ParentId = 100,
            Parent = parentJob,
            UcjbDate = new DateTime(2024, 6, 10),
            UcjbTime = new DateTime(2024, 6, 10, 8, 0, 0),
            UcjbNumber = "STOP-001",
            TucJobItemJobs = new List<TucJobItem>(),
            TucJobItemChildJobs = new List<TucJobItem>
            {
                new() { JobId = 100, ChildJobId = 300, ItemId = 10, Notes = "Stop Item", Height = 50, Depth = 40, Length = 60, Barcode = "STOP-BC" }
            },
            TucJobNationwides = new List<TucJobNationwide>(),
            PricingBreakdownJobs = new List<PricingBreakdown>()
        };

        // Act
        var mapping = JobMappings.JobMappingCore(isUsCustomer).Compile();
        var result = mapping(stopChildJob);

        // Assert - Should use its own child items, NOT parent's
        Assert.Equal(1, result.Items);
        var parcel = Assert.Single(result.ParcelDimensions);
        Assert.Equal("Stop Item", parcel.ItemName);
        Assert.Equal("STOP-BC", parcel.Barcode);
        var pallet = Assert.Single(result.PalletInfo);
        Assert.Equal("Stop Item", pallet.Notes);
    }

}
