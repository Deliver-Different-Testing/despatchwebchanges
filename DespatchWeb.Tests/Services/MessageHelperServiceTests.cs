using DespatchWeb.EntityClasses;
using DespatchWeb.Models.MessageModels;
using DespatchWeb.Services;
using FluentAssertions;

namespace DespatchWeb.Tests.Services;

/// <summary>
/// Unit tests for MessageHelperService - tests message participant determination and status checks.
/// </summary>
public class MessageHelperServiceTests
{
    private readonly FakeTenantClock _clock = new(TestDates.Now);

    private MessageHelperService CreateService() => new(_clock);

    #region GetOtherParty Tests - Message FROM Current Staff

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
        result.Id.Should().Be(100);
        result.Type.Should().Be(OtherMessagePartyType.Courier);
        result.Name.Should().Be("John Driver");
        result.Initials.Should().Be("JD");
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
        result.Id.Should().Be(2);
        result.Type.Should().Be(OtherMessagePartyType.Staff);
        result.Name.Should().Be("Jane Manager");
        result.Initials.Should().Be("JM");
        result.Status.Should().Be("online"); // Staff are always online
    }

    #endregion

    #region GetOtherParty Tests - Message TO Current Staff

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
        result.Id.Should().Be(100);
        result.Type.Should().Be(OtherMessagePartyType.Courier);
        result.Name.Should().Be("Bob Courier");
        result.Initials.Should().Be("BC");
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
        result.Id.Should().Be(3);
        result.Type.Should().Be(OtherMessagePartyType.Staff);
        result.Name.Should().Be("Alice Admin");
        result.Initials.Should().Be("AA");
    }

    #endregion

    #region GetOtherParty Tests - Edge Cases

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
        result.Id.Should().Be(0);
        result.Type.Should().Be(OtherMessagePartyType.Staff);
        result.Name.Should().Be("Unknown");
        result.Initials.Should().Be("??");
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
        result.Name.Should().Be("Unknown Courier");
        result.Initials.Should().Be("??");
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
        result.Name.Should().Be("Unknown Staff");
        result.Initials.Should().Be("??");
    }

    #endregion

    #region IsIncomingMessage Tests

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
        result.Should().BeTrue();
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
        result.Should().BeFalse();
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
        result.Should().BeFalse();
    }

    #endregion

    #region GetCourierStatus Tests

    [Fact]
    public void GetCourierStatus_NullCourier_ReturnsOffline()
    {
        // Arrange
        var service = CreateService();
        var currentDate = TestDates.Now;

        // Act
        var result = service.GetCourierStatus(null, currentDate);

        // Assert
        result.Should().Be("offline");
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
        result.Should().Be("offline");
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
        result.Should().Be("online");
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
        result.Should().Be("offline");
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
        result.Should().Be("offline");
    }

    #endregion
}
