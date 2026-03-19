using DespatchWeb.EntityClasses;
using DespatchWeb.Models.MessageModels;
using DespatchWeb.Services;

namespace DespatchWeb.Tests.Services;

/// <summary>
/// Unit tests for MessageHelperService - tests message participant determination and status checks.
/// </summary>
public class MessageHelperServiceTests
{
    private readonly FakeTenantClock _clock = new(TestDates.Now);

    private MessageHelperService CreateService() => new(_clock);

    [Fact]
    public void GetOtherParty_MessageFromCurrentStaffToCourier_ReturnsCourierAsOtherParty()
    {
        // Arrange
        var service = CreateService();
        const int currentStaffId = 1;
        var message = new TucManualMessage
        {
            UcmmSendFromStaffId = currentStaffId,
            UcmmSendToCourierId = 100,
            UcmmSendToCourier = new TucCourier
            {
                UccrId = 100,
                UccrName = "John",
                UccrSurname = "Driver"
            }
        };

        // Act
        var result = service.GetOtherParty(message, currentStaffId);

        // Assert
        Assert.Equal(100, result.Id);
        Assert.Equal(OtherMessagePartyType.Courier, result.Type);
        Assert.Equal("John Driver", result.Name);
        Assert.Equal("JD", result.Initials);
    }

    [Fact]
    public void GetOtherParty_MessageFromCurrentStaffToStaff_ReturnsStaffAsOtherParty()
    {
        // Arrange
        var service = CreateService();
        const int currentStaffId = 1;
        var message = new TucManualMessage
        {
            UcmmSendFromStaffId = currentStaffId,
            UcmmSendToStaffId = 2,
            UcmmSendToStaff = new TucStaff
            {
                UcstId = 2,
                UcstFirstName = "Jane",
                UcstLastName = "Manager"
            }
        };

        // Act
        var result = service.GetOtherParty(message, currentStaffId);

        // Assert
        Assert.Equal(2, result.Id);
        Assert.Equal(OtherMessagePartyType.Staff, result.Type);
        Assert.Equal("Jane Manager", result.Name);
        Assert.Equal("JM", result.Initials);
        Assert.Equal("online", result.Status); // Staff are always online
    }

    [Fact]
    public void GetOtherParty_MessageToCurrentStaffFromCourier_ReturnsCourierAsOtherParty()
    {
        // Arrange
        var service = CreateService();
        const int currentStaffId = 1;
        var message = new TucManualMessage
        {
            UcmmSendToStaffId = currentStaffId,
            UcmmSendFromCourierId = 100,
            UcmmSendFromCourier = new TucCourier
            {
                UccrId = 100,
                UccrName = "Bob",
                UccrSurname = "Courier"
            }
        };

        // Act
        var result = service.GetOtherParty(message, currentStaffId);

        // Assert
        Assert.Equal(100, result.Id);
        Assert.Equal(OtherMessagePartyType.Courier, result.Type);
        Assert.Equal("Bob Courier", result.Name);
        Assert.Equal("BC", result.Initials);
    }

    [Fact]
    public void GetOtherParty_MessageToCurrentStaffFromStaff_ReturnsStaffAsOtherParty()
    {
        // Arrange
        var service = CreateService();
        const int currentStaffId = 1;
        var message = new TucManualMessage
        {
            UcmmSendToStaffId = currentStaffId,
            UcmmSendFromStaffId = 3,
            UcmmSendFromStaff = new TucStaff
            {
                UcstId = 3,
                UcstFirstName = "Alice",
                UcstLastName = "Admin"
            }
        };

        // Act
        var result = service.GetOtherParty(message, currentStaffId);

        // Assert
        Assert.Equal(3, result.Id);
        Assert.Equal(OtherMessagePartyType.Staff, result.Type);
        Assert.Equal("Alice Admin", result.Name);
        Assert.Equal("AA", result.Initials);
    }

    [Fact]
    public void GetOtherParty_NoOtherParty_ReturnsUnknown()
    {
        // Arrange
        var service = CreateService();
        const int currentStaffId = 1;
        var message = new TucManualMessage
        {
            UcmmSendFromStaffId = currentStaffId
            // No recipient specified
        };

        // Act
        var result = service.GetOtherParty(message, currentStaffId);

        // Assert
        Assert.Equal(0, result.Id);
        Assert.Equal(OtherMessagePartyType.Staff, result.Type);
        Assert.Equal("Unknown", result.Name);
        Assert.Equal("??", result.Initials);
    }

    [Fact]
    public void GetOtherParty_CourierWithMissingName_ReturnsUnknownCourier()
    {
        // Arrange
        var service = CreateService();
        const int currentStaffId = 1;
        var message = new TucManualMessage
        {
            UcmmSendFromStaffId = currentStaffId,
            UcmmSendToCourierId = 100,
            UcmmSendToCourier = new TucCourier
            {
                UccrId = 100,
                UccrName = null,
                UccrSurname = null
            }
        };

        // Act
        var result = service.GetOtherParty(message, currentStaffId);

        // Assert
        Assert.Equal("Unknown Courier", result.Name);
        Assert.Equal("??", result.Initials);
    }

    [Fact]
    public void GetOtherParty_StaffWithMissingName_ReturnsUnknownStaff()
    {
        // Arrange
        var service = CreateService();
        const int currentStaffId = 1;
        var message = new TucManualMessage
        {
            UcmmSendFromStaffId = currentStaffId,
            UcmmSendToStaffId = 2,
            UcmmSendToStaff = new TucStaff
            {
                UcstId = 2,
                UcstFirstName = string.Empty,
                UcstLastName = string.Empty
            }
        };

        // Act
        var result = service.GetOtherParty(message, currentStaffId);

        // Assert
        Assert.Equal("Unknown Staff", result.Name);
        Assert.Equal("??", result.Initials);
    }

    [Fact]
    public void IsIncomingMessage_MessageSentToStaff_ReturnsTrue()
    {
        // Arrange
        var service = CreateService();
        const int staffId = 1;
        var message = new TucManualMessage { UcmmSendToStaffId = staffId };

        // Act
        var result = service.IsIncomingMessage(message, staffId);

        // Assert
        Assert.True(result);
    }

    [Fact]
    public void IsIncomingMessage_MessageNotSentToStaff_ReturnsFalse()
    {
        // Arrange
        var service = CreateService();
        const int staffId = 1;
        var message = new TucManualMessage { UcmmSendToStaffId = 2 };

        // Act
        var result = service.IsIncomingMessage(message, staffId);

        // Assert
        Assert.False(result);
    }

    [Fact]
    public void IsIncomingMessage_MessageSentToCourier_ReturnsFalse()
    {
        // Arrange
        var service = CreateService();
        const int staffId = 1;
        var message = new TucManualMessage { UcmmSendToCourierId = 100 };

        // Act
        var result = service.IsIncomingMessage(message, staffId);

        // Assert
        Assert.False(result);
    }

    [Fact]
    public void GetCourierStatus_NullCourier_ReturnsOffline()
    {
        // Arrange
        var service = CreateService();
        var currentDate = TestDates.Now;

        // Act
        var result = service.GetCourierStatus(null, currentDate);

        // Assert
        Assert.Equal("offline", result);
    }

    [Fact]
    public void GetCourierStatus_CourierWithNoLoginRecord_ReturnsOffline()
    {
        // Arrange
        var service = CreateService();
        var courier = new TucCourier { CourierLogInOut = null };
        var currentDate = TestDates.Now;

        // Act
        var result = service.GetCourierStatus(courier, currentDate);

        // Assert
        Assert.Equal("offline", result);
    }

    [Fact]
    public void GetCourierStatus_CourierLoggedOutInPast_ReturnsOnline()
    {
        // Arrange
        var service = CreateService();
        var currentDate = new DateTime(2024, 6, 15, 12, 0, 0);
        var courier = new TucCourier
        {
            CourierLogInOut = new TblCourierLogInOut
            {
                LogOutTime = new DateTime(2024, 6, 15, 8, 0, 0) // Logged out before current time
            }
        };

        // Act
        var result = service.GetCourierStatus(courier, currentDate);

        // Assert
        Assert.Equal("online", result);
    }

    [Fact]
    public void GetCourierStatus_CourierWithNoLogoutTime_ReturnsOffline()
    {
        // Arrange
        var service = CreateService();
        var currentDate = new DateTime(2024, 6, 15, 12, 0, 0);
        var courier = new TucCourier
        {
            CourierLogInOut = new TblCourierLogInOut
            {
                LogOutTime = null // Not logged out
            }
        };

        // Act
        var result = service.GetCourierStatus(courier, currentDate);

        // Assert
        Assert.Equal("offline", result);
    }

    [Fact]
    public void GetCourierStatus_CourierLogoutTimeInFuture_ReturnsOffline()
    {
        // Arrange
        var service = CreateService();
        var currentDate = new DateTime(2024, 6, 15, 12, 0, 0);
        var courier = new TucCourier
        {
            CourierLogInOut = new TblCourierLogInOut
            {
                LogOutTime = new DateTime(2024, 6, 15, 18, 0, 0) // Logout scheduled for later
            }
        };

        // Act
        var result = service.GetCourierStatus(courier, currentDate);

        // Assert
        Assert.Equal("offline", result);
    }

}
