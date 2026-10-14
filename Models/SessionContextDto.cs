#nullable enable
namespace DespatchWeb.Models;

/// <summary>Session data the React frontend needs at boot; serialised camelCase by /api/context.</summary>
public sealed record SessionContextDto(
    int ContactId,
    int? StaffId,
    string? FirstName,
    string? FullName,
    string? Email,
    string? Dispatcher,
    string? TimeZone,
    string? CountryCode,
    bool IsUsTenant,
    string CurrencyCode,
    bool ClientInternal,
    bool IsNetworkPartner,
    string[]? VisibleFeatures,
    MapCentre? NpMapCenter,
    string? HubUrl);
