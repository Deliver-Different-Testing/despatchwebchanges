using DespatchWeb.Enums;
using DespatchWeb.Models;
using DespatchWeb.Repositories;

namespace DespatchWeb.Tests.Repositories;

public class JobRepositorySortingTests
{
    private static IQueryable<PodSearchSortKey> CreateSortableKeys() =>
        new List<PodSearchSortKey>
        {
            new()
            {
                JobId = 1,
                IsArchived = false,
                Date = new DateTime(2024, 1, 10),
                Time = new DateTime(2024, 1, 10, 8, 0, 0),
                JobNumber = "A001",
                ClientCode = "Alpha Corp",
                RefA = "PO-100",
                StatusCode = "Pending",
                SpeedName = "Express",
                CourierCode = "Alice",
                PickupSuburb = "Auckland",
                DeliveryAddress = "Wellington",
                VehicleName = "Car"
            },
            new()
            {
                JobId = 2,
                IsArchived = true,
                Date = new DateTime(2024, 1, 12),
                Time = new DateTime(2024, 1, 12, 10, 0, 0),
                JobNumber = "C003",
                ClientCode = "Charlie Ltd",
                RefA = "PO-300",
                StatusCode = "Active",
                SpeedName = "Standard",
                CourierCode = "Carol",
                PickupSuburb = "Christchurch",
                DeliveryAddress = "Dunedin",
                VehicleName = "Van"
            },
            new()
            {
                JobId = 3,
                IsArchived = false,
                Date = new DateTime(2024, 1, 11),
                Time = new DateTime(2024, 1, 11, 9, 0, 0),
                JobNumber = "B002",
                ClientCode = "Bravo Inc",
                RefA = "PO-200",
                StatusCode = "Completed",
                SpeedName = "Economy",
                CourierCode = "Bob",
                PickupSuburb = "Brisbane",
                DeliveryAddress = "Sydney",
                VehicleName = "Truck"
            }
        }.AsQueryable();

    [Theory]
    [InlineData("date", false, 1, 2)]
    [InlineData("date", true, 2, 1)]
    [InlineData("time", false, 1, 2)]
    [InlineData("time", true, 2, 1)]
    [InlineData("jobno", false, 1, 2)]
    [InlineData("jobno", true, 2, 1)]
    [InlineData("client", false, 1, 2)]
    [InlineData("client", true, 2, 1)]
    [InlineData("refa", false, 1, 2)]
    [InlineData("refa", true, 2, 1)]
    [InlineData("status", false, 2, 1)]
    [InlineData("status", true, 1, 2)]
    [InlineData("speed", false, 3, 2)]
    [InlineData("speed", true, 2, 3)]
    [InlineData("courier", false, 1, 2)]
    [InlineData("courier", true, 2, 1)]
    [InlineData("pickup", false, 1, 2)]
    [InlineData("pickup", true, 2, 1)]
    [InlineData("delivery", false, 2, 1)]
    [InlineData("delivery", true, 1, 2)]
    [InlineData("vehicle", false, 1, 2)]
    [InlineData("vehicle", true, 2, 1)]
    [InlineData("isarchived", false, 1, 2)]
    [InlineData("isarchived", true, 2, 1)]
    public void ApplyPodSearchSorting_SortsCorrectly(
        string column, bool descending, int expectedFirstId, int expectedLastId)
    {
        var keys = CreateSortableKeys();

        var result = JobRepository.ApplyPodSearchSorting(keys, column, descending).ToList();

        Assert.Equal(3, result.Count);
        Assert.Equal(expectedFirstId, result.First().JobId);
        Assert.Equal(expectedLastId, result.Last().JobId);
    }

    [Theory]
    [InlineData("unknown")]
    [InlineData("")]
    [InlineData(null)]
    public void ApplyPodSearchSorting_UnrecognisedColumn_FallsBackToDateAsc(string? column)
    {
        var keys = CreateSortableKeys();

        var result = JobRepository.ApplyPodSearchSorting(keys, column, false).ToList();

        Assert.Equal(1, result.First().JobId);
        Assert.Equal(2, result.Last().JobId);
    }

    [Fact]
    public void ApplyPodSearchSorting_UnrecognisedColumnDescending_SortsDateDescending()
    {
        var keys = CreateSortableKeys();

        var result = JobRepository.ApplyPodSearchSorting(keys, "unknown", true).ToList();

        Assert.Equal([2, 3, 1], result.Select(k => k.JobId).ToList());
    }

    [Fact]
    public void ApplyPodSearchSorting_TiedSortKeys_BreaksTheTieOnJobId()
    {
        // Without a total order, OFFSET/FETCH can serve the same row on two consecutive pages.
        var keys = new List<PodSearchSortKey>
        {
            new() {JobId = 3, ClientCode = "Same"},
            new() {JobId = 1, ClientCode = "Same"},
            new() {JobId = 2, ClientCode = "Same"}
        }.AsQueryable();

        var result = JobRepository.ApplyPodSearchSorting(keys, "client", false).ToList();

        Assert.Equal([1, 2, 3], result.Select(k => k.JobId).ToList());
    }

    [Fact]
    public void MapToPerformanceSpendReportModel_FullData_MapsAllFields()
    {
        var row = new ClientJobsReportRow
        {
            JobNumber = "J100",
            JobType = 1,
            Date = new DateTime(2024, 3, 15),
            Booked = new DateTime(2024, 3, 15, 9, 0, 0),
            BookedBy = "admin",
            PickedUpTime = new DateTime(2024, 3, 15, 9, 30, 0),
            Delivered = new DateTime(2024, 3, 15, 10, 30, 0),
            Minutes = 60,
            PodName = "John",
            AcceptedSpeed = "Express",
            FromSuburb = "Newmarket",
            FromPostcode = "1023",
            ToSuburb = "Parnell",
            ToPostcode = "1052",
            FromAddr = "1 Queen St",
            ToAddr = "5 Broadway",
            CourierId = 42,
            LatePickup = true,
            LateDelivery = false,
            ClientLegalName = "Test Corp",
            Speed = "1 Hour",
            Notes = "Fragile",
            Amount = 25.50m,
            RefA = "REF-A",
            RefB = "REF-B",
            OurRef = "OUR-1",
            Weight = 5.5m,
            Size = 1,
            Quantity = 3,
            Year = 2024,
            Month = 3,
            CourierCode = "C01",
            CourierName = "Alice",
            InvoiceNo = 999,
            Locked = true,
            ClientId = 7,
            ClientNote = "VIP",
            RawBaseAmount = 20.00m,
            FuelSurchargeAmount = 2.50m
        };

        var result = JobRepository.MapToPerformanceSpendReportModel(row);

        Assert.Equal("J100", result.JobNumber);
        Assert.Equal("Pick up from us", result.UcjbType);
        Assert.Equal("15-Mar-24", result.Date);
        Assert.Equal("09:00", result.Booked);
        Assert.Equal("admin", result.BookedBy);
        Assert.Equal("2024-03-15 09:30:00", result.PickedUpTime);
        Assert.Equal("2024-03-15 10:30:00", result.Delivered);
        Assert.Equal("90", result.TotalTime);
        Assert.Equal("30", result.DeliveryMins);
        Assert.Equal("John", result.PodName);
        Assert.Equal("admin", result.Booker);
        Assert.Equal("Express", result.AchievedSpeed);
        Assert.Equal("Newmarket", result.From);
        Assert.Equal("1023", result.FromPostcode);
        Assert.Equal("Parnell", result.To);
        Assert.Equal("1052", result.ToPostcode);
        Assert.Equal("1 Queen St", result.UcjbFromAddr);
        Assert.Equal("5 Broadway", result.Address);
        Assert.Equal("42", result.Courier);
        Assert.Equal("True", result.LatePickup);
        Assert.Equal("False", result.LateDelivery);
        Assert.Equal("Test Corp", result.UcclLegalName);
        Assert.Equal("1 Hour", result.UcjbSpeed);
        Assert.Equal("Fragile", result.Notes);
        Assert.Equal("25.50", result.ChargeExclGst);
        Assert.Equal("REF-A", result.RefA);
        Assert.Equal("REF-B", result.RefB);
        Assert.Equal("OUR-1", result.UrgentRef);
        Assert.Equal("5.5", result.Weight);
        Assert.Equal("Car", result.Vehicle);
        Assert.Equal("3", result.Quantity);
        Assert.Equal("2024", result.UcjbYear);
        Assert.Equal("3", result.UcjbMonth);
        Assert.Equal("C01", result.Code);
        Assert.Equal("Alice", result.UccrName);
        Assert.Equal("999", result.UcjbInvoiceNo);
        Assert.Equal("True", result.UcjbLocked);
        Assert.Equal("7", result.UcjbClientId);
        Assert.Equal("VIP", result.UcclNote);
        Assert.Equal("60", result.Minutes);
        Assert.Equal(20.00m, result.RawBaseAmount);
        Assert.Equal(2.50m, result.FuelSurchargeAmount);
    }

    [Fact]
    public void MapToPerformanceSpendReportModel_NullBookedAndDelivered_TotalTimeAndDeliveryMinsAreNull()
    {
        var row = new ClientJobsReportRow { Booked = null, Delivered = null, Minutes = 30 };

        var result = JobRepository.MapToPerformanceSpendReportModel(row);

        Assert.Null(result.TotalTime);
        Assert.Null(result.DeliveryMins);
    }

    [Theory]
    [InlineData(1, "Pick up from us")]
    [InlineData(2, "Deliver to us")]
    [InlineData(3, "3rd party")]
    [InlineData(0, null)]
    [InlineData(99, null)]
    public void MapToPerformanceSpendReportModel_JobType_MapsCorrectly(int jobType, string? expected)
    {
        var row = new ClientJobsReportRow { JobType = jobType };

        var result = JobRepository.MapToPerformanceSpendReportModel(row);

        Assert.Equal(expected, result.UcjbType);
    }

    [Theory]
    [InlineData(1, "Car")]
    [InlineData(2, "Car")]
    [InlineData(3, "Van")]
    [InlineData(4, "Truck")]
    [InlineData(5, null)]
    [InlineData(0, null)]
    public void MapToPerformanceSpendReportModel_Size_MapsToVehicle(int size, string? expected)
    {
        var row = new ClientJobsReportRow { Size = size };

        var result = JobRepository.MapToPerformanceSpendReportModel(row);

        Assert.Equal(expected, result.Vehicle);
    }

    [Theory]
    [InlineData("", null, "Unknown")]
    [InlineData("Unknown", null, "Unknown")]
    [InlineData("Unknown", "Fallback", "Fallback")]
    [InlineData("", "Fallback", "Fallback")]
    [InlineData("ValidSuburb", null, "ValidSuburb")]
    [InlineData("ValidSuburb", "Fallback", "ValidSuburb")]
    public void MapToPerformanceSpendReportModel_ToSuburb_FallsBackCorrectly(
        string toSuburb, string? toSuburbFromAddress, string expected)
    {
        var row = new ClientJobsReportRow
        {
            ToSuburb = toSuburb,
            ToSuburbFromAddress = toSuburbFromAddress
        };

        var result = JobRepository.MapToPerformanceSpendReportModel(row);

        Assert.Equal(expected, result.To);
    }

    private static JobRepository.CourierLite MakeCourier(int id, string code, string name, string surname) =>
        new(id, code, name, surname);

    [Fact]
    public void GetCourierDescription_Transfer_RunViewerCourier_FormatsOpsDescription()
    {
        var courier = MakeCourier(999, "OPS", "Ops", "User");
        var transferTo = MakeCourier(5, "T05", "Transfer", "Target");

        var result = JobRepository.GetCourierDescription(
            (int)ScanType.Transfer, courier, null, transferTo, "RUN1");

        Assert.Equal("Ops (Run Viewer) to T05 Transfer Target", result);
    }

    [Fact]
    public void GetCourierDescription_Transfer_RunViewerCourier_NoTransferTo_OmitsTransferPart()
    {
        var courier = MakeCourier(999, "OPS", "Ops", "User");

        var result = JobRepository.GetCourierDescription(
            (int)ScanType.Transfer, courier, null, null, null);

        Assert.Equal("Ops (Run Viewer)", result);
    }

    [Fact]
    public void GetCourierDescription_Transfer_NormalCourier_WithTransferTo()
    {
        var courier = MakeCourier(1, "C01", "Alice", "Smith");
        var transferTo = MakeCourier(2, "C02", "Bob", "Jones");

        var result = JobRepository.GetCourierDescription(
            (int)ScanType.Transfer, courier, transferTo, null, null);

        Assert.Equal("C01 Alice Smith to C02 Bob Jones", result);
    }

    [Fact]
    public void GetCourierDescription_Transfer_NormalCourier_NoTransferTo()
    {
        var courier = MakeCourier(1, "C01", "Alice", "Smith");

        var result = JobRepository.GetCourierDescription(
            (int)ScanType.Transfer, courier, null, null, null);

        Assert.Equal("C01 Alice Smith", result);
    }

    [Fact]
    public void GetCourierDescription_Transfer_NullCourier_DoesNotThrow()
    {
        // A Transfer scan can have a null/unmatched CourierId (the courier is a
        // LEFT JOIN). It must not NRE — render an empty courier, plus any TransferTo.
        var transferTo = MakeCourier(2, "C02", "Bob", "Jones");

        var result = JobRepository.GetCourierDescription(
            (int)ScanType.Transfer, null, transferTo, null, null);

        Assert.Equal("   to C02 Bob Jones", result);
    }

    [Fact]
    public void GetCourierDescription_InvalidRun_IncludesRunName()
    {
        var courier = MakeCourier(1, "C01", "Alice", "Smith");

        var result = JobRepository.GetCourierDescription(
            (int)ScanType.InvalidRun, courier, null, null, "north");

        Assert.Equal("C01 Alice - Run NORTH", result);
    }

    [Fact]
    public void GetCourierDescription_InvalidRun_NullRunName_UsesEmpty()
    {
        var courier = MakeCourier(1, "C01", "Alice", "Smith");

        var result = JobRepository.GetCourierDescription(
            (int)ScanType.InvalidRun, courier, null, null, null);

        Assert.Equal("C01 Alice - Run ", result);
    }

    [Fact]
    public void GetCourierDescription_InwardsDepot_IncludesRunName()
    {
        var courier = MakeCourier(1, "C01", "Alice", "Smith");

        var result = JobRepository.GetCourierDescription(
            (int)ScanType.InwardsDepot, courier, null, null, "depot-a");

        Assert.Equal("C01 Alice depot-a", result);
    }

    [Fact]
    public void GetCourierDescription_DefaultScanType_ReturnsCodeAndName()
    {
        var courier = MakeCourier(1, "C01", "Alice", "Smith");

        var result = JobRepository.GetCourierDescription(
            (int)ScanType.Pickup, courier, null, null, null);

        Assert.Equal("C01 Alice", result);
    }
}
