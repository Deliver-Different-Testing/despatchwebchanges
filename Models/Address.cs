namespace DespatchWeb.Models;

public sealed class Address
{
    public string Label { get; init; }
    public string CountryCode { get; init; }
    public string CountryName { get; init; }
    public string StateCode { get; init; }
    public string State { get; init; }
    public string County { get; init; }
    public string City { get; init; }
    public string District { get; init; }
    public string Street { get; init; }
    public string PostalCode { get; init; }
    public string HouseNumber { get; init; }
}
