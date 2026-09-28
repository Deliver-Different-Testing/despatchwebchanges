using DespatchWeb.Models;
using DespatchWeb.Repositories;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// QuickAddJobAsync creates the job by running the DD_stpJob_InsertExcelerator stored proc.
/// The proc call itself is thin plumbing that can't execute under SQLite, so these tests cover
/// the testable part: the JobCreateViewModel -> CreateMinimalTucJobInputModel mapping
/// (<see cref="JobRepository.BuildQuickAddInputModel"/>).
/// </summary>
public class JobRepositoryQuickAddJobTests
{
    private static readonly DateTime Now = new(2026, 1, 6, 9, 30, 0, DateTimeKind.Unspecified);
    private static readonly Suggestion Staff = new() { Id = 7, Text = "Jane Despatcher" };

    private static JobCreateViewModel Request() => new()
    {
        ClientId = 42,
        SpeedId = 3,
        Charge = 125.50m,
        RefA = "REF-A",
        RefB = "REF-B",
        JobNotes = "job notes",
        FromContactName = "Alice Sender",
        DeliverToContact = "Bob Receiver",
        PickupNotes = "ring bell",
        DeliveryNotes = "leave at door",
        Date = new DateTimeOffset(2026, 1, 7, 14, 0, 0, TimeSpan.Zero),
        PickUpAddress = new AddressViewModel
        {
            AddressLine1 = "Pickup Co", AddressLine5 = "Ponsonby",
            Latitude = -36.85m, Longitude = 174.74m
        },
        DeliveryAddress = new AddressViewModel
        {
            AddressLine1 = "Delivery Co", AddressLine5 = "Newmarket",
            Latitude = -36.87m, Longitude = 174.77m
        }
    };

    [Fact]
    public void BuildQuickAddInputModel_MapsCoreFields()
    {
        var request = Request();

        var input = JobRepository.BuildQuickAddInputModel(request, Staff, "JOB-123", "Same Day", Now);

        Assert.Equal("JOB-123", input.JobNumber);
        Assert.Equal(42, input.ClientId);
        Assert.Equal(3, input.SpeedId);
        Assert.Equal("Same Day", input.Speed);
        Assert.Equal(125.50m, input.Amount);
        Assert.Equal("REF-A", input.Reference);
        Assert.Equal("REF-B", input.ReferenceB);
        Assert.Equal("job notes", input.Notes);
        Assert.Equal("Jane Despatcher", input.BookedBy);
        Assert.Equal(7, input.LoggedInContactId);
        Assert.Equal(Now, input.TenantCurrentTime);
        Assert.False(input.Hold);
        Assert.Null(input.AgentCourierId);
    }

    [Fact]
    public void BuildQuickAddInputModel_MapsContactsAndNotes()
    {
        var input = JobRepository.BuildQuickAddInputModel(Request(), Staff, "JOB-123", "Same Day", Now);

        Assert.Equal("Alice Sender", input.FromContactName);
        Assert.Equal("Bob Receiver", input.ToContactName);
        Assert.Equal("ring bell", input.PickupNotes);
        Assert.Equal("leave at door", input.DeliveryNotes);
    }

    [Fact]
    public void BuildQuickAddInputModel_MapsAddressesAndCoordinates()
    {
        var input = JobRepository.BuildQuickAddInputModel(Request(), Staff, "JOB-123", "Same Day", Now);

        Assert.Equal("Pickup Co", input.FromAddress.AddressLine1);
        Assert.Equal("Delivery Co", input.ToAddress.AddressLine1);
        Assert.Equal(-36.85m, input.PickUpLatitude);
        Assert.Equal(174.74m, input.PickUpLongitude);
        Assert.Equal(-36.87m, input.DeliveryLatitude);
        Assert.Equal(174.77m, input.DeliveryLongitude);
    }

    [Fact]
    public void BuildQuickAddInputModel_WithNullAddresses_LeavesCoordinatesNull()
    {
        var request = new JobCreateViewModel { ClientId = 1, SpeedId = 2, Charge = 10m };

        var input = JobRepository.BuildQuickAddInputModel(request, Staff, "JOB-9", "Overnight", Now);

        Assert.Null(input.FromAddress);
        Assert.Null(input.ToAddress);
        Assert.Null(input.PickUpLatitude);
        Assert.Null(input.DeliveryLongitude);
    }
}
