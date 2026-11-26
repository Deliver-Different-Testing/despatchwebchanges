using System.Globalization;
using DeliverDifferent.AgentAlerts.Rendering;
using DespatchWeb.Constants;
using DespatchWeb.EntityClasses;
using DespatchWeb.Interfaces;
using DespatchWeb.Services;
using NSubstitute;
using DespatchWeb.Tests.Helpers;

namespace DespatchWeb.Tests.Services;

/// <summary>
/// Every token in the shared catalogue is filled from the leg, its parent and the family's linehaul rows, so a
/// tenant's template (OTG's Admin Manager names included) renders with no [Token] left behind.
/// </summary>
public class AgentAlertTokenBuilderTests : IAsyncDisposable
{
    private const int ParentId = 10;
    private const int LegId = 11;
    private const int AgentId = 1;
    private const string Link = "https://in.otgcargo.deliverdifferent.com/Job/Details/TOKEN";

    private readonly SqliteTestDatabase _db = new();
    private readonly DespatchContext _context;
    private readonly ITenantInfoService _tenantInfo = Substitute.For<ITenantInfoService>();

    public AgentAlertTokenBuilderTests()
    {
        _context = _db.CreateContext();
        _tenantInfo.IsUsTenant().Returns(true);
        _tenantInfo.GetCulture().Returns(CultureInfo.GetCultureInfo("en-US"));
        _tenantInfo.FormatDateForTenant(Arg.Any<DateTime?>())
            .Returns(c => c.Arg<DateTime?>()?.ToString("g", CultureInfo.GetCultureInfo("en-US")) ?? string.Empty);
    }

    // ICU (Linux CI) puts U+202F before AM/PM; Windows NLS uses a plain space.
    private static string Us(DateTime value, string format) => value.ToString(format, CultureInfo.GetCultureInfo("en-US"));

    public async ValueTask DisposeAsync()
    {
        GC.SuppressFinalize(this);
        await _context.DisposeAsync();
        await _db.DisposeAsync();
    }

    private AgentAlertTokenBuilder Builder() => new(_context, _tenantInfo);

    private async Task SeedFamilyAsync(string carrierFsCode = "UA")
    {
        var setting = TestSettings.Minimal();
        setting.SystemName = "OTG Cargo";
        _context.TblSettings.Add(setting);
        _context.AgentAlertSettings.Add(new AgentAlertSetting { Enabled = true, DispatchPhone = "201-438-0606" });
        _context.TucClients.Add(new TucClient
        {
            UcclId = 5, UcclCode = "ACM", UcclName = "Acme Medical", UcclLegalName = "Acme Medical Inc", Smsname = "ACM",
            CreatedBy = "T", LastModifiedBy = "T"
        });
        _context.TucAgents.Add(new TucAgent
        {
            UcagId = AgentId, UcagName = "Hot Shot Delivery", UcagFax = "ops@hotshot.example", CreatedBy = "T", LastModifiedBy = "T"
        });
        _context.TucJobs.Add(new TucJob
        {
            UcjbId = ParentId, UcjbNumber = "E3516OTG", UcjbClientId = 5, UcjbClientRefa = "PO-55120",
            UcjbClientRefb = "R2", Connote = "CN-1"
        });
        _context.TucJobs.Add(new TucJob
        {
            UcjbId = LegId, ParentId = ParentId, UcjbNumber = "E3516OTGDF1", ToAirportId = 3,
            UcjbDate = new DateTime(2026, 11, 19), UcjbTime = new DateTime(1899, 12, 30, 9, 30, 0),
            DeliverByTime = new DateTime(2026, 11, 19, 13, 0, 0),
            PickupAddressLine1 = "Acme Medical", PickupAddressLine2 = "Suite 4", PickupAddressLine3 = "100",
            PickupAddressLine4 = "Main St", PickupAddressLine5 = "Nashville", PickupAddressLine6 = "Tennessee",
            PickupAddressLine7 = "37203", PickupAddressLine8 = "United States",
            PickupFromContact = "Dana Lee", PickupFromPhone = "615-555-0110",
            DeliveryAddressLine1 = "Forward Air BNA", DeliveryAddressLine3 = "1", DeliveryAddressLine4 = "Terminal Rd",
            DeliveryAddressLine5 = "Nashville", DeliveryAddressLine6 = "Tennessee", DeliveryAddressLine7 = "37217",
            DeliverToContact = "Dock", DeliverToPhone = "615-555-0199",
            UcjbQty = 5, UcjbWeight = 410, UcjbNotes = "Dock 4, ask for Sam", UcjbToSpecial = "Liftgate"
        });
        _context.TucJobItems.AddRange(
            new TucJobItem { JobId = LegId, ItemId = 1, Items = 3, Weight = 100, Length = 20, Height = 16, Depth = 12, Notes = "Medical supplies" },
            new TucJobItem { JobId = LegId, ItemId = 2, Items = 2, Weight = 110, Notes = "Medical supplies" },
            new TucJobItem { JobId = LegId, ItemId = 3, Items = 1, Weight = 0, Length = 40, Height = 40, Depth = 40, Notes = "Pallet" });
        _context.TucJobs.AddRange(
            new TucJob { UcjbId = 12, ParentId = ParentId, UcjbNumber = "E3516OTGDF2" },
            new TucJob { UcjbId = 13, ParentId = ParentId, UcjbNumber = "E3516OTGDF3" });
        _context.TucJobNationwides.AddRange(
            new TucJobNationwide
            {
                UcnwId = 1, UcnwJobId = 12, UcnwLegNumber = 1, CarrierFsCode = carrierFsCode,
                UcnwAirlineName = "United", UcnwFlightNo = "UA1142", UcnwConNote = "016-12345675",
                UcnwEtd = new DateTime(2026, 11, 19, 15, 10, 0), UcnwEta = new DateTime(2026, 11, 19, 17, 0, 0),
                DepartureAirportFsCode = "BNA", DepartureAirportCity = "Nashville",
                ArrivalAirportFsCode = "ORD", ArrivalAirportCity = "Chicago"
            },
            new TucJobNationwide
            {
                UcnwId = 2, UcnwJobId = 13, UcnwLegNumber = 2, CarrierFsCode = "UA",
                UcnwAirlineName = "United", UcnwFlightNo = "UA220", UcnwConNote = "016-99999999",
                UcnwEtd = new DateTime(2026, 11, 19, 18, 0, 0), UcnwEta = new DateTime(2026, 11, 19, 21, 0, 0),
                DepartureAirportFsCode = "ORD", DepartureAirportCity = "Chicago",
                ArrivalAirportFsCode = "EWR", ArrivalAirportCity = "Newark"
            });
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    private Task<IReadOnlyDictionary<string, string>> BuildAsync(AgentAlertType type) =>
        Builder().BuildAsync(LegId, AgentId, Link, type, TestContext.Current.CancellationToken);

    [Fact]
    public async Task FillsEveryCatalogueToken()
    {
        await SeedFamilyAsync();

        var tokens = await BuildAsync(AgentAlertType.Pickup);

        var missing = AgentAlertTokens.All.Select(t => t.Name).Where(n => !tokens.ContainsKey(n)).ToList();
        Assert.Empty(missing);
    }

    [Fact]
    public async Task Addresses_FollowTheAutomationEngineLineMapping()
    {
        await SeedFamilyAsync();

        var t = await BuildAsync(AgentAlertType.Pickup);

        Assert.Equal("Acme Medical", t["PickupCompany"]);
        Assert.Equal("100", t["PickupStreetNumber"]);
        Assert.Equal("Main St", t["PickupStreetName"]);
        Assert.Equal("Nashville", t["PickupCity"]);
        Assert.Equal("Tennessee", t["PickupState"]);
        Assert.Equal("37203", t["PickupZip"]);
        Assert.Equal("Suite 4", t["PickupAddressLine2"]);
        Assert.Equal("Forward Air BNA", t["DeliveryCompany"]);
        Assert.Equal("Nashville", t["DeliveryCity"]);
        Assert.Equal("Tennessee", t["DeliveryState"]);
        Assert.Equal("37217", t["DeliveryZip"]);
        Assert.Equal("Dana Lee", t["PickupContactName"]);
        Assert.Equal("615-555-0110", t["PickupContactPhone"]);
        Assert.Equal("Dock 4, ask for Sam", t["PickupNotes"]);
        Assert.Equal("Liftgate", t["DeliveryNotes"]);
    }

    [Fact]
    public async Task JobAndClient_ComeFromTheLegAndItsParent()
    {
        await SeedFamilyAsync();

        var t = await BuildAsync(AgentAlertType.Pickup);

        Assert.Equal("Hot Shot Delivery", t["AgentName"]);
        Assert.Equal("E3516OTGDF1", t["JobNumber"]);
        Assert.Equal("E3516OTG", t["ParentJobNumber"]);
        Assert.Equal("OTG Cargo", t["TenantName"]);
        Assert.Equal("Acme Medical", t["ClientName"]);
        Assert.Equal("PO-55120", t["ClientRefA"]);
        Assert.Equal("R2", t["ClientRefB"]);
        Assert.Equal("CN-1", t["ConNote"]);
        Assert.Equal("11/19/2026", t["Date"]);
        Assert.Equal(Us(new DateTime(1899, 12, 30, 9, 30, 0), "t"), t["Time"]);
        Assert.Equal(Us(new DateTime(2026, 11, 19, 13, 0, 0), "g"), t["DeliverByTime"]);
        Assert.Equal("201-438-0606", t["DispatchPhone"]);
        Assert.Equal(Link, t["InboundUrl"]);
    }

    [Fact]
    public async Task Freight_SummarisesTheItemsInTenantUnits()
    {
        await SeedFamilyAsync();

        var t = await BuildAsync(AgentAlertType.Pickup);

        Assert.Equal("5", t["Quantity"]);
        Assert.Equal("410 lb", t["Weight"]);
        Assert.Equal("Medical supplies, Pallet", t["Description"]);
        Assert.Equal("3 @ 20 x 16 x 12 in, 1 @ 40 x 40 x 40 in", t["Dimensions"]);
        Assert.Equal("Dock 4, ask for Sam · Liftgate", t["SpecialInstructions"]);
    }

    [Fact]
    public async Task Freight_UsesKgAndCmOutsideTheUs()
    {
        _tenantInfo.IsUsTenant().Returns(false);
        await SeedFamilyAsync();

        var t = await BuildAsync(AgentAlertType.Pickup);

        Assert.Equal("410 kg", t["Weight"]);
        Assert.EndsWith("40 x 40 x 40 cm", t["Dimensions"]);
    }

    [Fact]
    public async Task PickupLeg_TakesTheFirstLinehaulLeg_WholeJourneyStations()
    {
        await SeedFamilyAsync();

        var t = await BuildAsync(AgentAlertType.Pickup);

        Assert.Equal("United", t["CarrierName"]);
        Assert.Equal("016-12345675", t["WaybillNumber"]);
        Assert.Equal("UA1142", t["FlightNumber"]);
        Assert.Equal("BNA", t["OriginStation"]);
        Assert.Equal("EWR", t["DestinationStation"]);
    }

    [Fact]
    public async Task DeliveryLeg_TakesTheFinalLinehaulLeg()
    {
        await SeedFamilyAsync();

        var t = await BuildAsync(AgentAlertType.Delivery);

        Assert.Equal("UA220", t["FlightNumber"]);
        Assert.Equal("016-99999999", t["WaybillNumber"]);
        Assert.Equal("Chicago", t["FromSuburbCity"]);
        Assert.Equal(Us(new DateTime(2026, 11, 19, 21, 0, 0), "g"), t["FlightETA"]);
    }

    [Fact]
    public async Task ForwardAirLinehaul_NamesTheCarrierAndUsesTheAirbill()
    {
        await SeedFamilyAsync(carrierFsCode: ForwardAirCarrier.Code);

        var t = await BuildAsync(AgentAlertType.Pickup);

        Assert.Equal(ForwardAirCarrier.Name, t["CarrierName"]);
        Assert.Equal("016-12345675", t["WaybillNumber"]);
    }

    [Fact]
    public async Task LegWithNoFamilyOrItems_LeavesThoseTokensEmpty()
    {
        _context.TucAgents.Add(new TucAgent { UcagId = AgentId, UcagName = "A", CreatedBy = "T", LastModifiedBy = "T" });
        _context.TucJobs.Add(new TucJob { UcjbId = LegId, UcjbNumber = "E29T" });
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var t = await BuildAsync(AgentAlertType.DoorToDoor);

        Assert.Equal("E29T", t["ParentJobNumber"]);
        Assert.Equal(string.Empty, t["CarrierName"]);
        Assert.Equal(string.Empty, t["Dimensions"]);
        Assert.Equal(string.Empty, t["TenantName"]);
        Assert.Equal(string.Empty, t["DispatchPhone"]);
    }
}
