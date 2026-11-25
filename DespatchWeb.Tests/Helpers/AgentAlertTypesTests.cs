using DespatchWeb.Helpers;
using JetBrains.Annotations;

namespace DespatchWeb.Tests.Helpers;

/// <summary>
/// The alert follows what the agent physically does on the leg. Airports decide it: a leg that ends at an airport is
/// a pickup (shipper to terminal), one that starts at an airport is a delivery (terminal to consignee). Nationwide
/// legs read DF1 = to-airport (status 103 Outbound), DF3 = from-airport (104 Inbound). Legs with no airport fall back
/// to the LHP / DEL suffix, then to door to door.
/// </summary>
[TestSubject(typeof(AgentAlertTypes))]
public class AgentAlertTypesTests
{
    [Theory]
    [InlineData("KT107DF1", null, 12, AgentAlertType.Pickup)]
    [InlineData("KT107DF1a", null, 12, AgentAlertType.Pickup)]
    [InlineData("KT107DF3", 12, null, AgentAlertType.Delivery)]
    [InlineData("KT107DF3b", 12, null, AgentAlertType.Delivery)]
    [InlineData("KT107DF2", 12, 14, AgentAlertType.Delivery)]
    [InlineData("KT2103CRTLHP", null, null, AgentAlertType.Pickup)]
    [InlineData("KT2103CRTDEL", null, null, AgentAlertType.Delivery)]
    [InlineData("KT193VANS", null, null, AgentAlertType.DoorToDoor)]
    [InlineData("E29T", null, null, AgentAlertType.DoorToDoor)]
    [InlineData(null, null, null, AgentAlertType.DoorToDoor)]
    public void Resolve_FollowsWhatTheAgentDoesOnTheLeg(string? jobNumber, int? fromAirportId, int? toAirportId,
        AgentAlertType expected) =>
        Assert.Equal(expected, AgentAlertTypes.Resolve(jobNumber, fromAirportId, toAirportId));

    [Fact]
    public void Resolve_AirportsWinOverTheSuffix()
    {
        Assert.Equal(AgentAlertType.Delivery, AgentAlertTypes.Resolve("KT2103CRTLHP", 12, null));
        Assert.Equal(AgentAlertType.Pickup, AgentAlertTypes.Resolve("KT2103CRTDEL", null, 12));
    }
}
