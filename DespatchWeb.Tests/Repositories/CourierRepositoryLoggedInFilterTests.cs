using FluentAssertions;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// Tests for CourierRepository AllActiveCouriersAsync method with loggedInOnly filter.
/// These tests verify the logic for filtering couriers based on their login status.
/// </summary>
public class CourierRepositoryLoggedInFilterTests
{
    /// <summary>
    /// Represents a simplified courier structure for testing login/logout filtering.
    /// </summary>
    private class TestCourier
    {
        public int Id { get; init; }
        public string Code { get; init; } = string.Empty;
        public string Name { get; init; } = string.Empty;
        public string Surname { get; init; } = string.Empty;
        public bool Active { get; init; } = true;
        public int? DangerousGoods { get; init; }
        public DateTime? DgLicenseExpiry { get; init; }
        public CourierLogInOutRecord? LogInOutRecord { get; init; }
    }

    private class CourierLogInOutRecord
    {
        public DateTime LogInTime { get; init; }
        public DateTime? LogOutTime { get; init; }
    }

    /// <summary>
    /// Mimics the filter logic from CourierRepository.AllActiveCouriersAsync.
    /// </summary>
    private static List<TestCourier> FilterCouriers(
        List<TestCourier> couriers,
        string searchTerm,
        bool dgOnly,
        bool loggedInOnly,
        DateTime currentTenantTime)
    {
        var query = couriers.Where(c =>
            c.Active &&
            (c.Code + " " + c.Name + " " + c.Surname).Contains(searchTerm, StringComparison.OrdinalIgnoreCase)
        );

        // Filter for DG-certified couriers if dgOnly is true
        if (dgOnly)
        {
            query = query.Where(c =>
                c is { DangerousGoods: 1, DgLicenseExpiry: not null } &&
                c.DgLicenseExpiry >= currentTenantTime.AddDays(-1)
            );
        }

        // Filter for logged-in couriers if loggedInOnly is true
        if (!loggedInOnly) return query.OrderBy(c => c.Code).ToList();
        var today = currentTenantTime.Date;
        query = query.Where(c =>
            c.LogInOutRecord != null &&
            c.LogInOutRecord.LogInTime.Date == today &&
            c.LogInOutRecord.LogOutTime == null
        );

        return query.OrderBy(c => c.Code).ToList();
    }

    #region LoggedInOnly Filter Tests

    [Fact]
    public void FilterCouriers_LoggedInOnly_ReturnsOnlyLoggedInCouriers()
    {
        // Arrange
        var today = DateTime.Today;
        var couriers = new List<TestCourier>
        {
            new()
            {
                Id = 1,
                Code = "001",
                Name = "John",
                Surname = "Doe",
                LogInOutRecord = new CourierLogInOutRecord
                {
                    LogInTime = today.AddHours(8), // Logged in today
                    LogOutTime = null // Still logged in
                }
            },
            new()
            {
                Id = 2,
                Code = "002",
                Name = "Jane",
                Surname = "Smith",
                LogInOutRecord = new CourierLogInOutRecord
                {
                    LogInTime = today.AddHours(7),
                    LogOutTime = today.AddHours(16) // Logged out
                }
            },
            new()
            {
                Id = 3,
                Code = "003",
                Name = "Bob",
                Surname = "Wilson",
                LogInOutRecord = null // Never logged in
            }
        };

        // Act
        var result = FilterCouriers(couriers, "", dgOnly: false, loggedInOnly: true, today.AddHours(12));

        // Assert
        result.Should().HaveCount(1);
        result.Should().ContainSingle(c => c.Id == 1);
    }

    [Fact]
    public void FilterCouriers_LoggedInOnly_ExcludesCouriersLoggedInYesterday()
    {
        // Arrange
        var today = DateTime.Today;
        var couriers = new List<TestCourier>
        {
            new()
            {
                Id = 1,
                Code = "001",
                Name = "John",
                Surname = "Doe",
                LogInOutRecord = new CourierLogInOutRecord
                {
                    LogInTime = today.AddDays(-1).AddHours(8), // Logged in yesterday
                    LogOutTime = null // Still "logged in" from yesterday
                }
            },
            new()
            {
                Id = 2,
                Code = "002",
                Name = "Jane",
                Surname = "Smith",
                LogInOutRecord = new CourierLogInOutRecord
                {
                    LogInTime = today.AddHours(9), // Logged in today
                    LogOutTime = null
                }
            }
        };

        // Act
        var result = FilterCouriers(couriers, "", dgOnly: false, loggedInOnly: true, today.AddHours(12));

        // Assert
        result.Should().HaveCount(1);
        result.Should().ContainSingle(c => c.Id == 2);
    }

    [Fact]
    public void FilterCouriers_LoggedInOnly_ExcludesCouriersWithNoLoginRecord()
    {
        // Arrange
        var today = DateTime.Today;
        var couriers = new List<TestCourier>
        {
            new()
            {
                Id = 1,
                Code = "001",
                Name = "John",
                Surname = "Doe",
                LogInOutRecord = null // No login record
            },
            new()
            {
                Id = 2,
                Code = "002",
                Name = "Jane",
                Surname = "Smith",
                LogInOutRecord = new CourierLogInOutRecord
                {
                    LogInTime = today.AddHours(9),
                    LogOutTime = null
                }
            }
        };

        // Act
        var result = FilterCouriers(couriers, "", dgOnly: false, loggedInOnly: true, today.AddHours(12));

        // Assert
        result.Should().HaveCount(1);
        result.Should().ContainSingle(c => c.Id == 2);
    }

    [Fact]
    public void FilterCouriers_LoggedInOnlyFalse_ReturnsAllActiveCouriers()
    {
        // Arrange
        var today = DateTime.Today;
        var couriers = new List<TestCourier>
        {
            new()
            {
                Id = 1,
                Code = "001",
                Name = "John",
                Surname = "Doe",
                LogInOutRecord = new CourierLogInOutRecord
                {
                    LogInTime = today.AddHours(8),
                    LogOutTime = null
                }
            },
            new()
            {
                Id = 2,
                Code = "002",
                Name = "Jane",
                Surname = "Smith",
                LogInOutRecord = new CourierLogInOutRecord
                {
                    LogInTime = today.AddHours(7),
                    LogOutTime = today.AddHours(16) // Logged out
                }
            },
            new()
            {
                Id = 3,
                Code = "003",
                Name = "Bob",
                Surname = "Wilson",
                LogInOutRecord = null // Never logged in
            }
        };

        // Act
        var result = FilterCouriers(couriers, "", dgOnly: false, loggedInOnly: false, today.AddHours(12));

        // Assert
        result.Should().HaveCount(3);
    }

    [Fact]
    public void FilterCouriers_LoggedInOnly_NoLoggedInCouriers_ReturnsEmpty()
    {
        // Arrange
        var today = DateTime.Today;
        var couriers = new List<TestCourier>
        {
            new()
            {
                Id = 1,
                Code = "001",
                Name = "John",
                Surname = "Doe",
                LogInOutRecord = new CourierLogInOutRecord
                {
                    LogInTime = today.AddHours(8),
                    LogOutTime = today.AddHours(17) // Logged out
                }
            },
            new()
            {
                Id = 2,
                Code = "002",
                Name = "Jane",
                Surname = "Smith",
                LogInOutRecord = null // Never logged in
            }
        };

        // Act
        var result = FilterCouriers(couriers, "", dgOnly: false, loggedInOnly: true, today.AddHours(18));

        // Assert
        result.Should().BeEmpty();
    }

    #endregion

    #region Combined DG and LoggedInOnly Filter Tests

    [Fact]
    public void FilterCouriers_DgOnlyAndLoggedInOnly_ReturnsDgCertifiedLoggedInCouriers()
    {
        // Arrange
        var today = DateTime.Today;
        var couriers = new List<TestCourier>
        {
            new()
            {
                Id = 1,
                Code = "001",
                Name = "John",
                Surname = "Doe",
                DangerousGoods = 1,
                DgLicenseExpiry = today.AddMonths(6),
                LogInOutRecord = new CourierLogInOutRecord
                {
                    LogInTime = today.AddHours(8),
                    LogOutTime = null
                }
            },
            new()
            {
                Id = 2,
                Code = "002",
                Name = "Jane",
                Surname = "Smith",
                DangerousGoods = 1,
                DgLicenseExpiry = today.AddMonths(6),
                LogInOutRecord = new CourierLogInOutRecord
                {
                    LogInTime = today.AddHours(7),
                    LogOutTime = today.AddHours(16) // Logged out
                }
            },
            new()
            {
                Id = 3,
                Code = "003",
                Name = "Bob",
                Surname = "Wilson",
                DangerousGoods = 0, // Not DG certified
                LogInOutRecord = new CourierLogInOutRecord
                {
                    LogInTime = today.AddHours(9),
                    LogOutTime = null // Logged in but not DG
                }
            },
            new()
            {
                Id = 4,
                Code = "004",
                Name = "Alice",
                Surname = "Brown",
                DangerousGoods = 1,
                DgLicenseExpiry = today.AddDays(-10), // Expired DG license
                LogInOutRecord = new CourierLogInOutRecord
                {
                    LogInTime = today.AddHours(8),
                    LogOutTime = null
                }
            }
        };

        // Act
        var result = FilterCouriers(couriers, "", dgOnly: true, loggedInOnly: true, today.AddHours(12));

        // Assert - Only courier 1 is DG certified AND logged in
        result.Should().HaveCount(1);
        result.Should().ContainSingle(c => c.Id == 1);
    }

    [Fact]
    public void FilterCouriers_DgOnlyAndLoggedInOnly_NoneMatch_ReturnsEmpty()
    {
        // Arrange
        var today = DateTime.Today;
        var couriers = new List<TestCourier>
        {
            new()
            {
                Id = 1,
                Code = "001",
                Name = "John",
                Surname = "Doe",
                DangerousGoods = 1,
                DgLicenseExpiry = today.AddMonths(6),
                LogInOutRecord = new CourierLogInOutRecord
                {
                    LogInTime = today.AddHours(7),
                    LogOutTime = today.AddHours(16) // DG but logged out
                }
            },
            new()
            {
                Id = 2,
                Code = "002",
                Name = "Jane",
                Surname = "Smith",
                DangerousGoods = 0, // Not DG
                LogInOutRecord = new CourierLogInOutRecord
                {
                    LogInTime = today.AddHours(9),
                    LogOutTime = null // Logged in but not DG
                }
            }
        };

        // Act
        var result = FilterCouriers(couriers, "", dgOnly: true, loggedInOnly: true, today.AddHours(12));

        // Assert
        result.Should().BeEmpty();
    }

    #endregion

    #region Search Term with LoggedInOnly Filter Tests

    [Fact]
    public void FilterCouriers_SearchTermAndLoggedInOnly_FiltersCorrectly()
    {
        // Arrange
        var today = DateTime.Today;
        var couriers = new List<TestCourier>
        {
            new()
            {
                Id = 1,
                Code = "001",
                Name = "John",
                Surname = "Doe",
                LogInOutRecord = new CourierLogInOutRecord
                {
                    LogInTime = today.AddHours(8),
                    LogOutTime = null
                }
            },
            new()
            {
                Id = 2,
                Code = "002",
                Name = "Johnny",
                Surname = "Smith",
                LogInOutRecord = new CourierLogInOutRecord
                {
                    LogInTime = today.AddHours(9),
                    LogOutTime = null
                }
            },
            new()
            {
                Id = 3,
                Code = "003",
                Name = "Jane",
                Surname = "Johnson", // Contains "John" in surname
                LogInOutRecord = new CourierLogInOutRecord
                {
                    LogInTime = today.AddHours(7),
                    LogOutTime = today.AddHours(16) // Logged out
                }
            }
        };

        // Act - Search for "John" with loggedInOnly
        var result = FilterCouriers(couriers, "John", dgOnly: false, loggedInOnly: true, today.AddHours(12));

        // Assert - Should return couriers 1 and 2 (both contain "John" and are logged in)
        // Courier 3 matches search but is logged out
        result.Should().HaveCount(2);
        result.Should().Contain(c => c.Id == 1);
        result.Should().Contain(c => c.Id == 2);
        result.Should().NotContain(c => c.Id == 3);
    }

    #endregion

    #region Edge Cases

    [Fact]
    public void FilterCouriers_LoggedInOnly_MultipleLoggedInCouriers_ReturnsAllLoggedIn()
    {
        // Arrange
        var today = DateTime.Today;
        var couriers = new List<TestCourier>();

        // Add 10 logged-in couriers
        for (var i = 1; i <= 10; i++)
        {
            couriers.Add(new TestCourier
            {
                Id = i,
                Code = i.ToString("D3"),
                Name = $"Courier{i}",
                Surname = "Test",
                LogInOutRecord = new CourierLogInOutRecord
                {
                    LogInTime = today.AddHours(6 + i),
                    LogOutTime = null
                }
            });
        }

        // Add 5 logged-out couriers
        for (var i = 11; i <= 15; i++)
        {
            couriers.Add(new TestCourier
            {
                Id = i,
                Code = i.ToString("D3"),
                Name = $"Courier{i}",
                Surname = "Test",
                LogInOutRecord = new CourierLogInOutRecord
                {
                    LogInTime = today.AddHours(8),
                    LogOutTime = today.AddHours(17)
                }
            });
        }

        // Act
        var result = FilterCouriers(couriers, "", dgOnly: false, loggedInOnly: true, today.AddHours(18));

        // Assert
        result.Should().HaveCount(10);
        result.All(c => c.Id <= 10).Should().BeTrue();
    }

    [Fact]
    public void FilterCouriers_LoggedInOnly_InactiveLoggedInCourier_ExcludesInactive()
    {
        // Arrange
        var today = DateTime.Today;
        var couriers = new List<TestCourier>
        {
            new()
            {
                Id = 1,
                Code = "001",
                Name = "John",
                Surname = "Doe",
                Active = false, // Inactive
                LogInOutRecord = new CourierLogInOutRecord
                {
                    LogInTime = today.AddHours(8),
                    LogOutTime = null
                }
            },
            new()
            {
                Id = 2,
                Code = "002",
                Name = "Jane",
                Surname = "Smith",
                Active = true,
                LogInOutRecord = new CourierLogInOutRecord
                {
                    LogInTime = today.AddHours(9),
                    LogOutTime = null
                }
            }
        };

        // Act
        var result = FilterCouriers(couriers, "", dgOnly: false, loggedInOnly: true, today.AddHours(12));

        // Assert - Only active and logged-in courier
        result.Should().HaveCount(1);
        result.Should().ContainSingle(c => c.Id == 2);
    }

    [Fact]
    public void FilterCouriers_LoggedInOnly_CourierLoggedInAtMidnight_IncludesCorrectly()
    {
        // Arrange
        var today = DateTime.Today;
        var couriers = new List<TestCourier>
        {
            new()
            {
                Id = 1,
                Code = "001",
                Name = "John",
                Surname = "Doe",
                LogInOutRecord = new CourierLogInOutRecord
                {
                    LogInTime = today, // Logged in at midnight (start of day)
                    LogOutTime = null
                }
            }
        };

        // Act
        var result = FilterCouriers(couriers, "", dgOnly: false, loggedInOnly: true, today.AddHours(12));

        // Assert
        result.Should().HaveCount(1);
    }

    [Fact]
    public void FilterCouriers_LoggedInOnly_CourierLoggedInJustBeforeMidnight_ExcludedNextDay()
    {
        // Arrange
        var today = DateTime.Today;
        var couriers = new List<TestCourier>
        {
            new()
            {
                Id = 1,
                Code = "001",
                Name = "John",
                Surname = "Doe",
                LogInOutRecord = new CourierLogInOutRecord
                {
                    LogInTime = today.AddDays(-1).AddHours(23).AddMinutes(59), // 11:59 PM yesterday
                    LogOutTime = null
                }
            }
        };

        // Act
        var result = FilterCouriers(couriers, "", dgOnly: false, loggedInOnly: true, today.AddHours(8));

        // Assert - Should not be included because login was yesterday
        result.Should().BeEmpty();
    }

    #endregion
}
