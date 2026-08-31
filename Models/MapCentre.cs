#nullable enable
namespace DespatchWeb.Models;

/// <summary>
/// A map's opening centre. Property names are deliberately <c>Lat</c>/<c>Lng</c>
/// so the camelCase serializer emits the <c>{lat, lng}</c> shape the HERE map
/// helpers expect (<c>HereMap.types.ts</c>).
/// </summary>
public sealed record MapCentre(decimal Lat, decimal Lng);
