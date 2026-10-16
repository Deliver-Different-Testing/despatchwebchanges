#nullable enable
using System.Security.Claims;
using DespatchWeb.Enums;
using DespatchWeb.Helpers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using Serilog;

namespace DespatchWeb.Services;

public sealed class SessionContextService(
    IClientRepository clientRepository,
    IFeatureVisibilityService featureVisibilityService,
    INetworkPartnerContextService networkPartnerContextService) : ISessionContextService
{
    public async Task<SessionContextDto> BuildAsync(ClaimsPrincipal user)
    {
        var contactId = user.FindFirst("ContactID")?.Value;
        if (!int.TryParse(contactId, out var parsedContactId))
        {
            throw new ArgumentException($"Invalid contact ID: {contactId}", nameof(user));
        }

        var clientDetail = await clientRepository.ValidateClientAsync(parsedContactId)
                           ?? throw new InvalidOperationException(
                               $"Contact {parsedContactId} has no tucClientContact row in this tenant's database.");

        var countryCode = user.FindFirst("CountryCode")?.Value;
        var isUsTenant = string.Equals(countryCode, Country.Us.GetDescription(), StringComparison.OrdinalIgnoreCase);
        var visibleDashboards = await TryResolveAsync(
            featureVisibilityService.GetVisibleDashboardsAsync, "Dashboard visibility lookup");
        var mapCentre = await TryResolveAsync(
            networkPartnerContextService.GetMapCentreAsync, "Network partner map centre lookup");

        return new SessionContextDto(
            ContactId: clientDetail.StaffID ?? parsedContactId,
            StaffId: int.TryParse(user.FindFirst("StaffID")?.Value, out var staffId) ? staffId : null,
            FirstName: clientDetail.FirstName,
            FullName: clientDetail.FullName,
            Email: clientDetail.Email,
            Dispatcher: null,
            TimeZone: user.FindFirst("TimeZone")?.Value,
            CountryCode: countryCode,
            IsUsTenant: isUsTenant,
            CurrencyCode: isUsTenant ? "USD" : "NZD",
            ClientInternal: clientDetail.Internal,
            IsNetworkPartner: clientDetail.IsNetworkPartner,
            VisibleFeatures: visibleDashboards?.ToArray(),
            NpMapCenter: mapCentre,
            HubUrl: Environment.GetEnvironmentVariable("HubUrl"));
    }

    private static async Task<T?> TryResolveAsync<T>(Func<Task<T?>> resolve, string description)
    {
        try
        {
            return await resolve();
        }
        catch (Exception ex)
        {
            Log.Warning(ex, "{Description} failed; continuing without it", description);
            return default;
        }
    }
}
