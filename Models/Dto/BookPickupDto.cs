namespace DespatchWeb.Models.Dto;

/// <summary>
/// JSON shape sent to api POST /api/Jobs (BookPickupAsync). Mirrors
/// WebAPICore.Models.Request.BookPickup. Tracks the same surface as
/// IntegrationManager.Core.Http.Models.BookPickupDto so partner-style
/// and DespatchWeb-style job creation share one contract.
/// </summary>
public sealed class BookPickupDto
{
    public string QuoteId { get; set; }
    public int SpeedId { get; set; }
    public int? JobType { get; set; } = 1; // 1 = Pickup
    public PickupDto Pickup { get; set; } = new();
    public DeliveryDto Delivery { get; set; } = new();
    public List<PackageDto> Packages { get; set; } = [];

    /// <summary>Unit selector for Length/Width/Height on Package (api default is inches).</summary>
    public int? DimensionsType { get; set; }

    public DateTime? DateTime { get; set; }
    public int JobNotificationType { get; set; } = 1; // 1 = EMAIL
    public string JobNotificationEmail { get; set; }
    public string JobNotificationMobile { get; set; }
    public bool IsSignatureRequired { get; set; } = true;
    public bool IsSaturdayDelivery { get; set; }
    public bool IsDangerousGoods { get; set; }
    public bool? HasDgDocument { get; set; }
    public int? DgClass { get; set; }
    public decimal? DryIceWeight { get; set; }
    public string OurReference { get; set; }
    public string ClientReferenceA { get; set; }
    public string ClientReferenceB { get; set; }
    public string ClientNotes { get; set; }
    public int? VehicleSizeId { get; set; }

    /// <summary>Vehicle hint: van required.</summary>
    public bool Van { get; set; }

    /// <summary>Vehicle hint: bike required.</summary>
    public bool Bike { get; set; }

    /// <summary>
    /// Fixed rate that bypasses Tenant B's rate card. Used for partner-agreed pricing
    /// or when the calling UI already presented a charge to the user.
    /// </summary>
    public decimal? FixedAmount { get; set; }

    /// <summary>Prebook job as on-hold rather than booking it live.</summary>
    public bool? OnHold { get; set; }

    /// <summary>Shop / retail integration data. [SwaggerExclude] on the api.</summary>
    public ShopDto Shop { get; set; }

    /// <summary>Truck-job requirements (tail lifts, residential, hours).</summary>
    public TruckInfoDto Truck { get; set; }

    /// <summary>Force a specific job number on the api side. [SwaggerExclude] on the api.</summary>
    public string JobNumber { get; set; }

    public int? StorageState { get; set; }
    public int? DeliveryState { get; set; }
    public int? SourceId { get; set; }
    public DateTime? PickupReadyDateTime { get; set; }

    /// <summary>Contact who booked the job (overrides the SC-claim ContactId).</summary>
    public int? LoggedInContactId { get; set; }

    public int? AccessorialChargeGroupId { get; set; }
    public DateTime? DeliverByDateTime { get; set; }
    public string PickupTimeZone { get; set; }
    public string DeliverByTimeZone { get; set; }

    /// <summary>Recurring-job schedule.</summary>
    public RecurringInfoDto Recurring { get; set; }
}

public sealed class PickupDto
{
    public string Name { get; set; } = string.Empty;
    public string ContactPerson { get; set; } = string.Empty;
    public string PhoneNumber { get; set; }
    public string Email { get; set; }

    /// <summary>If true, the api emails Email a tracking link.</summary>
    public bool? SendTrackingEmail { get; set; }

    public AddressDto From { get; set; } = new();
    public string Notes { get; set; }
}

public sealed class DeliveryDto
{
    public string Name { get; set; } = string.Empty;
    public string ContactPerson { get; set; }
    public string PhoneNumber { get; set; }
    public string Email { get; set; }

    /// <summary>If true, the api emails Email a tracking link.</summary>
    public bool? SendTrackingEmail { get; set; }

    public AddressDto To { get; set; } = new();
    public string Notes { get; set; }
}

public sealed class AddressDto
{
    public string CompanyName { get; set; }
    public string BuildingName { get; set; }
    public string StreetAddress { get; set; }
    public string Suburb { get; set; }
    public string City { get; set; } = string.Empty;
    public string State { get; set; }
    public string ZipCode { get; set; }
    public string PostCode { get; set; }
    public string CountryCode { get; set; }
    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }
}

public sealed class PackageDto
{
    public string Name { get; set; }
    public decimal? Length { get; set; }
    public decimal? Width { get; set; }
    public decimal? Height { get; set; }
    public decimal Cubic { get; set; }
    public decimal? Kg { get; set; }
    public decimal? Lb { get; set; }
    public string Type { get; set; }

    /// <summary>Trackpack code (DLE / A5 / A4).</summary>
    public string PackageCode { get; set; }

    public int Units { get; set; } = 1;

    /// <summary>Pre-allocated package barcodes (one per Unit).</summary>
    public List<string> Barcodes { get; set; }
}

public sealed class TruckInfoDto
{
    public bool? PickupTailLift { get; set; }
    public bool? DropoffTailLift { get; set; }
    public bool? PrivateRes { get; set; }
    public bool? HasDgDocuments { get; set; }
    public DateTime? TruckStartTime { get; set; }
    public int? TruckHours { get; set; }
}

public sealed class RecurringInfoDto
{
    public string Name { get; set; }

    /// <summary>Days of week mask, e.g. "0101010". Default "0000000" on the api.</summary>
    public string Days { get; set; }

    /// <summary>None / Daily / Weekly / Monthly etc.</summary>
    public string Frequency { get; set; }

    /// <summary>0 = don't book; 1 = book next day; 2 = book anyway.</summary>
    public int? HolidayBehaviour { get; set; }

    public int? InitialDays { get; set; }
}

public sealed class ShopDto
{
    public int Id { get; set; }
    public string ShopRef1 { get; set; }
    public string ShopRef2 { get; set; }
    public string ShopRef3 { get; set; }
    public string ShopRef4 { get; set; }
    public string ShopRef5 { get; set; }
}
