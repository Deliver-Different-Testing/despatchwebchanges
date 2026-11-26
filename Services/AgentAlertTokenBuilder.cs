#nullable enable
using System.Globalization;
using DeliverDifferent.AgentAlerts.Rendering;
using DespatchWeb.Constants;
using DespatchWeb.EntityClasses;
using DespatchWeb.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace DespatchWeb.Services;

/// <summary>
/// The value of every agent alert token (<see cref="AgentAlertTokens.All"/>) for one leg. Address lines follow the
/// automation engine's mapping (1 company, 2 suite, 3 street number, 4 street name, 5 city, 6 state, 7 ZIP), so a
/// token means the same thing in both senders. Flight and carrier tokens come from the family's linehaul rows: a
/// delivery leg recovers from the final one, any other leg drops to the first.
/// </summary>
public sealed class AgentAlertTokenBuilder(DespatchContext context, ITenantInfoService tenantInfo)
{
    private const string InstructionSeparator = " · ";

    public async Task<IReadOnlyDictionary<string, string>> BuildAsync(int jobId, int agentId, string inboundUrl,
        AgentAlertType alertType, CancellationToken ct = default)
    {
        var leg = await context.TucJobs.AsNoTracking().FirstAsync(j => j.UcjbId == jobId, ct);
        var parent = leg.ParentId is { } parentId
            ? await context.TucJobs.AsNoTracking().FirstOrDefaultAsync(j => j.UcjbId == parentId, ct)
            : null;
        var familyId = parent?.UcjbId ?? leg.UcjbId;

        var agentName = await context.TucAgents.Where(a => a.UcagId == agentId).Select(a => a.UcagName)
            .FirstOrDefaultAsync(ct);
        var tenantName = await context.TblSettings.Select(s => s.SystemName).FirstOrDefaultAsync(ct);
        var dispatchPhone = await context.AgentAlertSettings.OrderBy(s => s.Id).Select(s => s.DispatchPhone)
            .FirstOrDefaultAsync(ct);
        var clientId = parent?.UcjbClientId ?? leg.UcjbClientId;
        var clientName = clientId is null
            ? null
            : await context.TucClients.Where(c => c.UcclId == clientId).Select(c => c.UcclName).FirstOrDefaultAsync(ct);

        var items = await context.TucJobItems.AsNoTracking().Where(i => i.JobId == jobId).OrderBy(i => i.ItemId)
            .ToListAsync(ct);
        if (items.Count == 0 && parent is not null)
        {
            items = await context.TucJobItems.AsNoTracking().Where(i => i.JobId == parent.UcjbId)
                .OrderBy(i => i.ItemId).ToListAsync(ct);
        }

        var linehaul = await context.TucJobNationwides.AsNoTracking()
            .Where(n => context.TucJobs.Where(j => j.UcjbId == familyId || j.ParentId == familyId)
                .Select(j => (int?)j.UcjbId).Contains(n.UcnwJobId))
            .ToListAsync(ct);
        var first = linehaul.OrderBy(n => n.UcnwEtd).ThenBy(n => n.UcnwLegNumber).FirstOrDefault();
        var last = linehaul.OrderByDescending(n => n.UcnwEta).ThenByDescending(n => n.UcnwLegNumber).FirstOrDefault();
        var flight = alertType == AgentAlertType.Delivery ? last : first;

        var culture = tenantInfo.GetCulture();
        var us = tenantInfo.IsUsTenant();

        var tokens = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["AgentName"] = agentName,
            ["JobNumber"] = leg.UcjbNumber,
            ["ParentJobNumber"] = parent?.UcjbNumber ?? leg.UcjbNumber,
            ["TenantName"] = tenantName,
            ["ClientName"] = clientName,
            ["ClientRefA"] = parent?.UcjbClientRefa ?? leg.UcjbClientRefa,
            ["ClientRefB"] = parent?.UcjbClientRefb ?? leg.UcjbClientRefb,
            ["Date"] = leg.UcjbDate == default ? null : leg.UcjbDate.ToString("d", culture),
            ["Time"] = (leg.UcjbTime ?? leg.PickUpTime)?.ToString("t", culture),
            ["Quantity"] = leg.UcjbQty?.ToString(culture),
            ["Weight"] = leg.UcjbWeight is { } weight ? $"{weight.ToString(culture)} {(us ? "lb" : "kg")}" : null,
            ["Description"] = string.Join(", ", items.Select(i => i.Notes?.Trim()).Where(n => !string.IsNullOrEmpty(n)).Distinct()),
            ["Dimensions"] = Dimensions(items, us ? "in" : "cm", culture),
            ["ConNote"] = Blank(leg.Connote) ?? parent?.Connote,
            ["SpecialInstructions"] = string.Join(InstructionSeparator,
                new[] { leg.UcjbNotes, leg.UcjbToSpecial }.Select(n => n?.Trim()).Where(n => !string.IsNullOrEmpty(n))),

            ["PickupCompany"] = leg.PickupAddressLine1,
            ["PickupStreetNumber"] = leg.PickupAddressLine3,
            ["PickupStreetName"] = leg.PickupAddressLine4,
            ["PickupCity"] = leg.PickupAddressLine5,
            ["PickupState"] = leg.PickupAddressLine6,
            ["PickupZip"] = leg.PickupAddressLine7,
            ["PickupContactName"] = leg.PickupFromContact,
            ["PickupContactPhone"] = leg.PickupFromPhone,
            ["PickupNotes"] = leg.UcjbNotes,

            ["DeliveryCompany"] = leg.DeliveryAddressLine1,
            ["DeliveryStreetNumber"] = leg.DeliveryAddressLine3,
            ["DeliveryStreetName"] = leg.DeliveryAddressLine4,
            ["DeliveryCity"] = leg.DeliveryAddressLine5,
            ["DeliveryState"] = leg.DeliveryAddressLine6,
            ["DeliveryZip"] = leg.DeliveryAddressLine7,
            ["DeliveryContactName"] = leg.DeliverToContact,
            ["DeliveryContactPhone"] = leg.DeliverToPhone,
            ["DeliveryNotes"] = leg.UcjbToSpecial,
            ["DeliverByTime"] = tenantInfo.FormatDateForTenant(leg.DeliverByTime),

            ["Airline"] = flight?.UcnwAirlineName,
            ["FlightNumber"] = flight?.UcnwFlightNo,
            ["FlightETD"] = tenantInfo.FormatDateForTenant(flight?.UcnwEtd),
            ["FlightETA"] = tenantInfo.FormatDateForTenant(flight?.UcnwEta),
            ["FromSuburbCity"] = flight?.DepartureAirportCity,
            ["CarrierName"] = flight is null ? null
                : flight.CarrierFsCode == ForwardAirCarrier.Code ? ForwardAirCarrier.Name : flight.UcnwAirlineName,
            ["WaybillNumber"] = flight?.UcnwConNote,
            ["OriginStation"] = first?.DepartureAirportFsCode,
            ["DestinationStation"] = last?.ArrivalAirportFsCode,

            [AgentAlertTokens.InboundUrl] = inboundUrl,
            ["DispatchPhone"] = dispatchPhone,
        };

        string?[] pickupLines =
        [
            leg.PickupAddressLine1, leg.PickupAddressLine2, leg.PickupAddressLine3, leg.PickupAddressLine4,
            leg.PickupAddressLine5, leg.PickupAddressLine6, leg.PickupAddressLine7,
        ];
        string?[] deliveryLines =
        [
            leg.DeliveryAddressLine1, leg.DeliveryAddressLine2, leg.DeliveryAddressLine3, leg.DeliveryAddressLine4,
            leg.DeliveryAddressLine5, leg.DeliveryAddressLine6, leg.DeliveryAddressLine7,
        ];
        for (var i = 0; i < 7; i++)
        {
            tokens[$"PickupAddressLine{i + 1}"] = pickupLines[i];
            tokens[$"DeliveryAddressLine{i + 1}"] = deliveryLines[i];
        }

        return tokens.ToDictionary(kv => kv.Key, kv => kv.Value?.Trim() ?? string.Empty, StringComparer.OrdinalIgnoreCase);
    }

    private static string? Blank(string? value) => string.IsNullOrWhiteSpace(value) ? null : value;

    private static string Dimensions(IEnumerable<TucJobItem> items, string unit, CultureInfo culture) =>
        string.Join(", ", items
            .Where(i => i is { Length: > 0, Height: > 0, Depth: > 0 })
            .Select(i => string.Create(culture,
                $"{i.Items} @ {i.Length!.Value} x {i.Height!.Value} x {i.Depth!.Value} {unit}")));
}
