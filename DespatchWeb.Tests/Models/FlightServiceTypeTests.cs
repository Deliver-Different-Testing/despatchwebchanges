using DespatchWeb.Models.FlightStats;

namespace DespatchWeb.Tests.Models;

public class FlightServiceTypeTests
{
    [Theory]
    [InlineData("C")]
    [InlineData("O")]
    [InlineData("L")]
    [InlineData("H")]
    [InlineData("c")] // case-insensitive
    [InlineData(" C ")] // trimmed
    public void IsCharter_CharterCodes_ReturnsTrue(string serviceType) =>
        Assert.True(FlightServiceType.IsCharter(serviceType));

    [Theory]
    [InlineData("J")]
    [InlineData("S")]
    [InlineData("F")]
    [InlineData("")]
    [InlineData(" ")]
    [InlineData(null)]
    public void IsCharter_NonCharterOrEmpty_ReturnsFalse(string? serviceType) =>
        Assert.False(FlightServiceType.IsCharter(serviceType));

    [Theory]
    [InlineData("J", "Scheduled Passenger")]
    [InlineData("C", "Charter (Passenger)")]
    [InlineData("L", "Charter (Passenger & Cargo)")]
    [InlineData("H", "Charter (Cargo/Mail)")]
    [InlineData("F", "Scheduled Cargo/Mail")]
    public void Describe_KnownCode_ReturnsDescription(string serviceType, string expected) =>
        Assert.Equal(expected, FlightServiceType.Describe(serviceType));

    [Fact]
    public void Describe_UnknownCode_ReturnsRawCode() =>
        Assert.Equal("Z", FlightServiceType.Describe("z"));

    [Theory]
    [InlineData("")]
    [InlineData(" ")]
    [InlineData(null)]
    public void Describe_NullOrEmpty_ReturnsNull(string? serviceType) =>
        Assert.Null(FlightServiceType.Describe(serviceType));
}
