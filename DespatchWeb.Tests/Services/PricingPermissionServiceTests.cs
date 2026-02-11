using DespatchWeb.EntityClasses;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Services;
using FluentAssertions;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Moq;

namespace DespatchWeb.Tests.Services;

/// <summary>
/// Unit tests for PricingPermissionService - tests authorization/access control for pricing operations.
/// </summary>
public class PricingPermissionServiceTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly DbContextOptions<DespatchContext> _dbOptions;
    private readonly Mock<IDbContextFactory<DespatchContext>> _contextFactoryMock = new();
    private readonly Mock<ITenantInfoService> _tenantInfoServiceMock = new();
    private readonly Mock<IClientRepository> _clientRepositoryMock = new();

    public PricingPermissionServiceTests()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();

        _connection.CreateFunction("getdate", () => DateTime.Now);
        _connection.CreateFunction("getutcdate", () => DateTime.UtcNow);

        using (var command = _connection.CreateCommand())
        {
            command.CommandText = "PRAGMA foreign_keys = OFF;";
            command.ExecuteNonQuery();
        }

        _dbOptions = new DbContextOptionsBuilder<DespatchContext>()
            .UseSqlite(_connection)
            .Options;

        using (var context = new DespatchContext(_dbOptions))
        {
            context.Database.EnsureCreated();
        }

        // Create tblJob view that maps to tucJob table for query compatibility
        // The service queries TblJobs (keyless view) which needs to read from the tucJob table
        using (var command = _connection.CreateCommand())
        {
            command.CommandText = """
                CREATE VIEW IF NOT EXISTS tblJob AS
                SELECT
                    ucjbID AS JobId,
                    ucjbNumber AS Number,
                    ucjbClientID AS ClientId,
                    NULL AS ClientCode,
                    ucjbCourierID AS CourierID,
                    ucjbDate AS Date,
                    ucjbTime AS Time,
                    ucjbSpeed AS Speed,
                    ucjbFrom AS FromSuburbId,
                    ucjbTo AS ToSuburbId,
                    ucjbAmount AS Amount,
                    NULL AS Locked,
                    NULL AS Month,
                    NULL AS Year,
                    NULL AS OurRef,
                    0 AS JobDone,
                    ucjbVoid AS Void,
                    NULL AS Podname,
                    NULL AS JobTypeId,
                    NULL AS LatePickUp,
                    NULL AS LateDelivery,
                    NULL AS CompletedTime,
                    NULL AS DispatchDate,
                    NULL AS DispatchTime,
                    NULL AS DispatcherId,
                    NULL AS ZoneCount,
                    0 AS RtnJob,
                    NULL AS PickUpTime,
                    ucjbStatus AS Status,
                    NULL AS Rebate,
                    NULL AS Weight,
                    NULL AS Quantity,
                    ucjbFromAddr AS FromAddress,
                    ucjbToAddr AS ToAddress,
                    ucjbNotes AS Notes,
                    NULL AS ClientReferenceA,
                    NULL AS ClientReferenceB,
                    NULL AS Recipient,
                    NULL AS Size,
                    NULL AS ClientNotes,
                    NULL AS InternalNotes,
                    NULL AS OperatorId,
                    NULL AS ChargeType,
                    0 AS FuelSurchargeAmount,
                    NULL AS Km,
                    0 AS SaturdayDelivery,
                    NULL AS Type,
                    NULL AS Contact,
                    NULL AS ToSpecial,
                    0 AS Cbd,
                    NULL AS FlightDetails,
                    0 AS Van,
                    0 AS Attention,
                    NULL AS PickupFrom,
                    NULL AS RefJobId,
                    NULL AS ContactPhone,
                    0 AS [Return],
                    0 AS RemoteJob,
                    NULL AS InvoiceNo,
                    NULL AS ContactId,
                    0 AS LatePickupNotificationHasBeenSent,
                    NULL AS WhenLatePickupNotificationSent,
                    0 AS LateDeliveryNotificationHasBeenSent,
                    NULL AS WhenLateDeliveryNotificationSent,
                    NULL AS ProofOfDelivery,
                    NULL AS ProofOfDeliveryEmail,
                    NULL AS ProofOfDeliveryMobile,
                    0 AS PodnotificationHasBeenSent,
                    NULL AS WhenPodnotificationSent,
                    NULL AS PickupFromContact,
                    NULL AS PickupFromPhone,
                    NULL AS DeliverToContact,
                    NULL AS DeliverToPhone,
                    NULL AS DeliverToPrivateBusiness,
                    NULL AS LeaveNotHomeId,
                    0 AS RuralDelivery,
                    NULL AS PickUpSignature,
                    NULL AS DeliverySignature,
                    NULL AS PickUpLongitude,
                    NULL AS PickUpLatitude,
                    NULL AS DeliveryLongitude,
                    NULL AS DeliveryLatitude,
                    NULL AS WaitedPickUp,
                    NULL AS WaitedDelivery,
                    NULL AS DesiredJobTypeId,
                    NULL AS AcceptedJobTypeID,
                    0 AS Direct,
                    NULL AS OriginalSpeedId,
                    NULL AS NotifiedJobTypeId,
                    NULL AS UndeliverableLocationId,
                    JobRelationshipTypeId,
                    ParentId,
                    NULL AS InformationParentId,
                    RootParentId,
                    NULL AS Sequence,
                    NULL AS MobileSend,
                    NULL AS SendTime,
                    NULL AS ExternalCodingId,
                    NULL AS ExternalCourierCodingId,
                    NULL AS Ppdexclusiveamount,
                    NULL AS Gstrate,
                    0 AS Truck,
                    NULL AS Dgclass,
                    NULL AS Dgdocument,
                    NULL AS TextRef1,
                    NULL AS TextRef2,
                    NULL AS TextRef3,
                    NULL AS TextRef4,
                    NULL AS FromAddressExtras,
                    NULL AS FromAddressStreetName,
                    NULL AS FromAddressExtras2,
                    NULL AS ToAddressExtras,
                    NULL AS ToAddressStreetName,
                    NULL AS ToAddressExtras2,
                    NULL AS ClientReferenceC,
                    NULL AS Gssamount,
                    NULL AS RawAmount,
                    NULL AS Gssconnote,
                    NULL AS GsstrackingUrl,
                    NULL AS JobTrackingNotificationHasBeenSent,
                    NULL AS WhenJobTrackingNotificationSent,
                    NULL AS TrackingMethod,
                    NULL AS TrackingEmail,
                    NULL AS TrackingMobile,
                    0 AS RatedManually,
                    NULL AS DeliveryPhoto,
                    NULL AS DeliveryGps,
                    NULL AS RunName,
                    NULL AS RawBaseAmount,
                    NULL AS CourierPercentage,
                    NULL AS CourierPayment,
                    NULL AS CourierFuel,
                    NULL AS CourierBonus,
                    NULL AS CourierPercentageOverride,
                    NULL AS Duration,
                    NULL AS TruckHours,
                    NULL AS TruckStartTime,
                    NULL AS ShopId,
                    NULL AS ShopRef1,
                    NULL AS ShopRef2,
                    NULL AS ShopRef3,
                    NULL AS ShopRef4,
                    NULL AS ShopRef5,
                    NULL AS DepotId,
                    NULL AS Barcode,
                    NULL AS StorageState,
                    NULL AS DeliveryState,
                    NULL AS InternalStatus,
                    NULL AS FollowupTime,
                    NULL AS Reprice,
                    NULL AS VanOk,
                    NULL AS SourceId,
                    NULL AS InvoiceProcessId,
                    NULL AS LoggedInContactId,
                    NULL AS BulkParentId,
                    PickupAddressLine1,
                    PickupAddressLine2,
                    PickupAddressLine3,
                    PickupAddressLine4,
                    PickupAddressLine5,
                    PickupAddressLine6,
                    PickupAddressLine7,
                    PickupAddressLine8,
                    DeliveryAddressLine1,
                    DeliveryAddressLine2,
                    DeliveryAddressLine3,
                    DeliveryAddressLine4,
                    DeliveryAddressLine5,
                    DeliveryAddressLine6,
                    DeliveryAddressLine7,
                    DeliveryAddressLine8,
                    NULL AS ToAirportId,
                    NULL AS FromAirportId,
                    NULL AS DryIceWeight,
                    NULL AS DeliverByTime,
                    NULL AS AgentID,
                    NULL AS Connote,
                    NULL AS PickupTimeZoneId,
                    NULL AS DeliverByTimeZoneId,
                    NULL AS TotalDistance,
                    NULL AS PickUpWindowMins,
                    NULL AS DeliverByWindowMins,
                    NULL AS MasterCourierId,
                    NULL AS SubContractorPercentage,
                    NULL AS SubContractorFuelPercentage,
                    NULL AS SubContractorBonusPercentage,
                    NULL AS PickRunOrder,
                    NULL AS Archived,
                    NULL AS DimensionsType,
                    NULL AS OutForDelivery
                FROM tucJob
                """;
            command.ExecuteNonQuery();
        }

        _contextFactoryMock.Setup(f => f.CreateDbContextAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(() => new DespatchContext(_dbOptions));
    }

    public void Dispose()
    {
        _connection.Dispose();
    }

    private DespatchContext CreateContext() => new(_dbOptions);

    private PricingPermissionService CreateService() => new(
        _tenantInfoServiceMock.Object,
        _clientRepositoryMock.Object,
        _contextFactoryMock.Object
    );

    private async Task SeedJobAsync(int jobId, int? clientId = 1)
    {
        await using var context = CreateContext();
        context.TucJobs.Add(new TucJob
        {
            UcjbId = jobId,
            UcjbClientId = clientId,
            UcjbNumber = $"JOB-{jobId}"
        });
        await context.SaveChangesAsync();
    }

    private void SetupAsStaff(int staffId = 1)
    {
        _tenantInfoServiceMock.Setup(x => x.GetStaffId()).Returns(staffId);
        _tenantInfoServiceMock.Setup(x => x.GetContactId()).Returns(0);
    }

    private void SetupAsContact(int contactId, List<int> accessibleClientIds)
    {
        _tenantInfoServiceMock.Setup(x => x.GetStaffId()).Returns(0);
        _tenantInfoServiceMock.Setup(x => x.GetContactId()).Returns(contactId);
        _clientRepositoryMock.Setup(x => x.ClientContactsAsync(contactId))
            .ReturnsAsync(accessibleClientIds.Select(id => new Suggestion { Id = id, Text = $"Client {id}" }).ToList());
    }

    private void SetupAsUnauthenticated()
    {
        _tenantInfoServiceMock.Setup(x => x.GetStaffId()).Returns(0);
        _tenantInfoServiceMock.Setup(x => x.GetContactId()).Returns(0);
    }

    #region CanModifyPricesAsync

    [Fact]
    public async Task CanModifyPricesAsync_ReturnsTrue()
    {
        var service = CreateService();
        var result = await service.CanModifyPricesAsync();
        result.Should().BeTrue();
    }

    #endregion

    #region CanBulkUpdatePricesAsync

    [Fact]
    public async Task CanBulkUpdatePricesAsync_ReturnsTrue()
    {
        var service = CreateService();
        var result = await service.CanBulkUpdatePricesAsync();
        result.Should().BeTrue();
    }

    #endregion

    #region CanModifyPriceBreakdownAsync

    [Fact]
    public async Task CanModifyPriceBreakdownAsync_ReturnsTrue()
    {
        var service = CreateService();
        var result = await service.CanModifyPriceBreakdownAsync();
        result.Should().BeTrue();
    }

    #endregion

    #region CanUsePricingModeAsync

    [Theory]
    [InlineData("recalculate")]
    [InlineData("base")]
    [InlineData("gross")]
    public async Task CanUsePricingModeAsync_ValidMode_ReturnsTrue(string mode)
    {
        var service = CreateService();
        var result = await service.CanUsePricingModeAsync(mode);
        result.Should().BeTrue();
    }

    [Theory]
    [InlineData("Recalculate")]
    [InlineData("BASE")]
    [InlineData("Gross")]
    public async Task CanUsePricingModeAsync_ValidModeCaseInsensitive_ReturnsTrue(string mode)
    {
        var service = CreateService();
        var result = await service.CanUsePricingModeAsync(mode);
        result.Should().BeTrue();
    }

    [Theory]
    [InlineData("invalid")]
    [InlineData("discount")]
    [InlineData("wholesale")]
    public async Task CanUsePricingModeAsync_InvalidMode_ReturnsFalse(string mode)
    {
        var service = CreateService();
        var result = await service.CanUsePricingModeAsync(mode);
        result.Should().BeFalse();
    }

    [Fact]
    public async Task CanUsePricingModeAsync_NullMode_ReturnsFalse()
    {
        var service = CreateService();
        var result = await service.CanUsePricingModeAsync(null!);
        result.Should().BeFalse();
    }

    [Fact]
    public async Task CanUsePricingModeAsync_EmptyMode_ReturnsFalse()
    {
        var service = CreateService();
        var result = await service.CanUsePricingModeAsync("");
        result.Should().BeFalse();
    }

    #endregion

    #region ValidatePricingMode

    [Theory]
    [InlineData("recalculate")]
    [InlineData("base")]
    [InlineData("gross")]
    public void ValidatePricingMode_ValidModes_DoesNotThrow(string mode)
    {
        var service = CreateService();
        var act = () => service.ValidatePricingMode(mode);
        act.Should().NotThrow();
    }

    [Theory]
    [InlineData("Recalculate")]
    [InlineData("BASE")]
    [InlineData("GROSS")]
    public void ValidatePricingMode_CaseInsensitive_DoesNotThrow(string mode)
    {
        var service = CreateService();
        var act = () => service.ValidatePricingMode(mode);
        act.Should().NotThrow();
    }

    [Fact]
    public void ValidatePricingMode_InvalidMode_ThrowsArgumentException()
    {
        var service = CreateService();
        var act = () => service.ValidatePricingMode("invalid");
        act.Should().Throw<ArgumentException>()
            .WithMessage("*Invalid pricing mode*invalid*");
    }

    [Fact]
    public void ValidatePricingMode_NullMode_ThrowsArgumentException()
    {
        var service = CreateService();
        var act = () => service.ValidatePricingMode(null!);
        act.Should().Throw<ArgumentException>()
            .WithMessage("*Pricing mode is required*");
    }

    [Fact]
    public void ValidatePricingMode_EmptyMode_ThrowsArgumentException()
    {
        var service = CreateService();
        var act = () => service.ValidatePricingMode("");
        act.Should().Throw<ArgumentException>()
            .WithMessage("*Pricing mode is required*");
    }

    #endregion

    #region ValidateJobAccessAsync - Staff Access

    [Fact]
    public async Task ValidateJobAccessAsync_StaffUser_AlwaysAllowed()
    {
        SetupAsStaff();
        var service = CreateService();

        var act = async () => await service.ValidateJobAccessAsync(999);
        await act.Should().NotThrowAsync();
    }

    [Fact]
    public async Task ValidateJobAccessAsync_StaffUser_DoesNotQueryDatabase()
    {
        SetupAsStaff();
        var service = CreateService();

        await service.ValidateJobAccessAsync(1);

        _contextFactoryMock.Verify(f => f.CreateDbContextAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    #endregion

    #region ValidateJobAccessAsync - Client Contact Access

    [Fact]
    public async Task ValidateJobAccessAsync_ContactWithAccess_DoesNotThrow()
    {
        SetupAsContact(contactId: 10, accessibleClientIds: [1, 2, 3]);
        await SeedJobAsync(jobId: 100, clientId: 2);
        var service = CreateService();

        var act = async () => await service.ValidateJobAccessAsync(100);
        await act.Should().NotThrowAsync();
    }

    [Fact]
    public async Task ValidateJobAccessAsync_ContactWithoutAccess_ThrowsUnauthorized()
    {
        SetupAsContact(contactId: 10, accessibleClientIds: [1, 2]);
        await SeedJobAsync(jobId: 100, clientId: 99);
        var service = CreateService();

        var act = async () => await service.ValidateJobAccessAsync(100);
        await act.Should().ThrowAsync<UnauthorizedAccessException>()
            .WithMessage("Access denied to job 100");
    }

    [Fact]
    public async Task ValidateJobAccessAsync_ContactJobNotFound_ThrowsUnauthorizedWithNotFound()
    {
        SetupAsContact(contactId: 10, accessibleClientIds: [1, 2]);
        var service = CreateService();

        var act = async () => await service.ValidateJobAccessAsync(999);
        await act.Should().ThrowAsync<UnauthorizedAccessException>()
            .WithMessage("Job 999 not found");
    }

    [Fact]
    public async Task ValidateJobAccessAsync_ContactNoClients_ThrowsUnauthorized()
    {
        SetupAsContact(contactId: 10, accessibleClientIds: []);
        var service = CreateService();

        var act = async () => await service.ValidateJobAccessAsync(1);
        await act.Should().ThrowAsync<UnauthorizedAccessException>()
            .WithMessage("User has no accessible clients");
    }

    #endregion

    #region ValidateJobAccessAsync - Unauthenticated

    [Fact]
    public async Task ValidateJobAccessAsync_Unauthenticated_ThrowsUnauthorized()
    {
        SetupAsUnauthenticated();
        var service = CreateService();

        var act = async () => await service.ValidateJobAccessAsync(1);
        await act.Should().ThrowAsync<UnauthorizedAccessException>()
            .WithMessage("User not authenticated");
    }

    #endregion

    #region ValidateJobsAccessAsync - Staff Access

    [Fact]
    public async Task ValidateJobsAccessAsync_StaffUser_ReturnsEmptyList()
    {
        SetupAsStaff();
        var service = CreateService();

        var result = await service.ValidateJobsAccessAsync([1, 2, 3]);
        result.Should().BeEmpty();
    }

    #endregion

    #region ValidateJobsAccessAsync - Client Contact Access

    [Fact]
    public async Task ValidateJobsAccessAsync_ContactAllAccessible_ReturnsEmptyList()
    {
        SetupAsContact(contactId: 10, accessibleClientIds: [1]);
        await SeedJobAsync(jobId: 100, clientId: 1);
        await SeedJobAsync(jobId: 101, clientId: 1);
        var service = CreateService();

        var result = await service.ValidateJobsAccessAsync([100, 101]);
        result.Should().BeEmpty();
    }

    [Fact]
    public async Task ValidateJobsAccessAsync_ContactSomeInaccessible_ReturnsInaccessibleIds()
    {
        SetupAsContact(contactId: 10, accessibleClientIds: [1]);
        await SeedJobAsync(jobId: 100, clientId: 1);
        await SeedJobAsync(jobId: 101, clientId: 99);
        var service = CreateService();

        var result = await service.ValidateJobsAccessAsync([100, 101]);
        result.Should().ContainSingle().Which.Should().Be(101);
    }

    [Fact]
    public async Task ValidateJobsAccessAsync_ContactAllInaccessible_ReturnsAllIds()
    {
        SetupAsContact(contactId: 10, accessibleClientIds: [1]);
        await SeedJobAsync(jobId: 100, clientId: 99);
        await SeedJobAsync(jobId: 101, clientId: 99);
        var service = CreateService();

        var result = await service.ValidateJobsAccessAsync([100, 101]);
        result.Should().BeEquivalentTo([100, 101]);
    }

    [Fact]
    public async Task ValidateJobsAccessAsync_ContactNoClients_ReturnsAllJobIds()
    {
        SetupAsContact(contactId: 10, accessibleClientIds: []);
        var service = CreateService();

        var result = await service.ValidateJobsAccessAsync([1, 2, 3]);
        result.Should().BeEquivalentTo([1, 2, 3]);
    }

    [Fact]
    public async Task ValidateJobsAccessAsync_EmptyList_ReturnsEmptyList()
    {
        SetupAsContact(contactId: 10, accessibleClientIds: [1]);
        var service = CreateService();

        var result = await service.ValidateJobsAccessAsync([]);
        result.Should().BeEmpty();
    }

    [Fact]
    public async Task ValidateJobsAccessAsync_NullList_ReturnsEmptyList()
    {
        SetupAsContact(contactId: 10, accessibleClientIds: [1]);
        var service = CreateService();

        var result = await service.ValidateJobsAccessAsync(null!);
        result.Should().BeEmpty();
    }

    #endregion

    #region ValidateJobsAccessAsync - Unauthenticated

    [Fact]
    public async Task ValidateJobsAccessAsync_Unauthenticated_ReturnsAllJobIds()
    {
        SetupAsUnauthenticated();
        var service = CreateService();

        var result = await service.ValidateJobsAccessAsync([1, 2, 3]);
        result.Should().BeEquivalentTo([1, 2, 3]);
    }

    #endregion

    #region GetPricingPermissionsAsync

    [Fact]
    public async Task GetPricingPermissionsAsync_ReturnsAllPermissionsEnabled()
    {
        var service = CreateService();
        var result = await service.GetPricingPermissionsAsync();

        result.CanModifyPrices.Should().BeTrue();
        result.CanBulkUpdate.Should().BeTrue();
        result.CanRecalculate.Should().BeTrue();
        result.CanSetBaseAmount.Should().BeTrue();
        result.CanManageBreakdown.Should().BeTrue();
    }

    #endregion

    #region GetAccessibleClientIdsAsync - Caching

    [Fact]
    public async Task ValidateJobAccessAsync_CalledTwice_CachesClientIds()
    {
        SetupAsContact(contactId: 10, accessibleClientIds: [1]);
        await SeedJobAsync(jobId: 100, clientId: 1);
        await SeedJobAsync(jobId: 101, clientId: 1);
        var service = CreateService();

        await service.ValidateJobAccessAsync(100);
        await service.ValidateJobAccessAsync(101);

        // ClientContactsAsync should only be called once due to caching
        _clientRepositoryMock.Verify(x => x.ClientContactsAsync(10), Times.Once);
    }

    [Fact]
    public async Task ValidateJobAccessAsync_DifferentServiceInstances_NoSharedCache()
    {
        SetupAsContact(contactId: 10, accessibleClientIds: [1]);
        await SeedJobAsync(jobId: 100, clientId: 1);

        var service1 = CreateService();
        var service2 = CreateService();

        await service1.ValidateJobAccessAsync(100);
        await service2.ValidateJobAccessAsync(100);

        // Each service instance should call ClientContactsAsync separately
        _clientRepositoryMock.Verify(x => x.ClientContactsAsync(10), Times.Exactly(2));
    }

    #endregion
}
