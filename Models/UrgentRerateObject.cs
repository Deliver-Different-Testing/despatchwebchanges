using System;
using System.Collections.Generic;

namespace DespatchWeb.Models;

public class UrgentRerateObject
{
    public int SpeedId { get; set; }
    public int SizeId { get; set; }
    public UrgentRerateAddressObject From { get; set; }
    public UrgentRerateAddressObject To { get; set; }
    public IEnumerable<UrgentPackageObject> Packages { get; set; }
    public int Weight { get; set; }
    public int Quantity { get; set; }
    public bool? IsDangerousGoods { get; set; }
    public bool? IsPrebook { get; set; }
    public DateTime? DateTime { get; set; }
    public bool? Van { get; set; }
    public bool? Bike { get; set; }
    public UrgentTruckObject? Truck { get; set; }
    public string? OurReference { get; set; }
    public string? ClientReferenceA { get; set; }
    public string? ClientReferenceB { get; set; }
}

public class RerateAddressObject : UrgentRerateAddressObject
{
    public int SuburbId { get; set; }
}

public class UrgentRerateAddressObject
{
    public string? CompanyName { get; set; }
    public string? BuildingName { get; set; }
    public string StreetAddress { get; set; }
    public string City { get; set; }
    public string? State { get; set; }
    public string? Suburb { get; set; }
    public string? ZipCode { get; set; }
    public string? PostCode { get; set; }
    public string? CountryCode { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
}

public class UrgentPackageObject
{
    public string? Name { get; set; }
    public double? Length { get; set; }
    public double? Width { get; set; }
    public double? Height { get; set; }
    public double Cubic { get; set; }
    public double Kg { get; set; }
    public string? Type { get; set; }
    public string? PackageCode { get; set; }
    public int Units { get; set; }
}

public class UrgentTruckObject
{
    public bool? PickupTailLift { get; set; }
    public bool? DropoffTailLift { get; set; }
    public bool? PrivateRes { get; set; }
    public bool? HasDgDocuments { get; set; }
    public string? TruckStartTime { get; set; }
    public int? TruckHours { get; set; }
}