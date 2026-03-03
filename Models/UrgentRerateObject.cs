using System;
using System.Collections.Generic;

namespace DespatchWeb.Models;

public class UrgentRerateObject
{
    public int SpeedId { get; init; }
    public int SizeId { get; init; }
    public UrgentRerateAddressObject From { get; init; }
    public UrgentRerateAddressObject To { get; init; }
    public IEnumerable<UrgentPackageObject> Packages { get; init; }
    public int Weight { get; init; }
    public int Quantity { get; init; }
    public bool? IsDangerousGoods { get; init; }
    public bool? IsPrebook { get; init; }
    public DateTime? DateTime { get; init; }
    public bool? Van { get; init; }
    public bool? Bike { get; init; }
    public UrgentTruckObject Truck { get; init; }
    public string OurReference { get; init; }
    public string ClientReferenceA { get; init; }
    public string ClientReferenceB { get; init; }
}

public class UrgentRerateAddressObject
{
    public string CompanyName { get; init; }
    public string BuildingName { get; init; }
    public string StreetAddress { get; init; }
    public string City { get; init; }
    public string State { get; init; }
    public string Suburb { get; init; }
    public int? SuburbId { get; init; }
    public string ZipCode { get; init; }
    public string PostCode { get; init; }
    public string CountryCode { get; init; }
    public decimal? Latitude { get; init; }
    public decimal? Longitude { get; init; }
}

public class UrgentPackageObject
{
    public string Name { get; init; }
    public double? Length { get; init; }
    public double? Width { get; init; }
    public double? Height { get; init; }
    public double Cubic { get; init; }
    public double Kg { get; init; }
    public string Type { get; init; }
    public string PackageCode { get; init; }
    public int Units { get; init; }
}

public class UrgentTruckObject
{
    public bool? PickupTailLift { get; init; }
    public bool? DropoffTailLift { get; init; }
    public bool? PrivateRes { get; init; }
    public bool? HasDgDocuments { get; init; }
    public string TruckStartTime { get; init; }
    public int? TruckHours { get; init; }
}