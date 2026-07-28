namespace DespatchWeb.Models.Dto;

public sealed record RateJobUsDto
{
    public int JobId { get; init; }

    public int ClientId { get; init; }

    public int Speed { get; init; }

    public string FromZip { get; init; }
    public decimal FromLat { get; init; }
    public decimal FromLong { get; init; }

    public string ToZip { get; init; }
    public decimal ToLat { get; init; }
    public decimal ToLong { get; init; }

    public decimal TotalMiles { get; init; }

    public decimal FromMiles { get; init; }

    public decimal ToMiles { get; init; }

    public int Weight { get; init; }

    public DateTime Booked { get; init; }

    public int Size { get; init; }

    public bool DangerousGoods { get; init; }

    public int TotalPallets { get; init; }

    public int ExtraStopOffs { get; init; }

    public int DryIceWeight { get; init; }

    public int PickupWaitTime { get; init; }
    public int DeliveryWaitTime { get; init; }

    public int? FromAgentId { get; init; }

    public int? FromAirportId { get; init; }

    public int? ToAgentId { get; init; }

    public int? ToAirportId { get; init; }

    public int? Quantity { get; init; }
    public decimal? Cubic { get; init; }
    public bool IsPrebook { get; init; }
    
    public bool CalculateDimsOncePerJob { get; init; }
    public decimal? PreviousRate { get; init; }

    /// <summary>
    /// When set, bypasses the DoesAddressMatchAirportAsync DB query for the pickup address.
    /// </summary>
    public bool? PrecomputedIsFromAddressAirport { get; init; }

    /// <summary>
    /// When set, bypasses the DoesAddressMatchAirportAsync DB query for the delivery address.
    /// </summary>
    public bool? PrecomputedIsToAddressAirport { get; init; }
}
