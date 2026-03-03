using System;

namespace DespatchWeb.Models.RequestModels;

public class TruckCourierStatusViewModel
{
    public int CourierId { get; init; }

    public string CourierCode { get; init; }

    public string FirstName { get; init; }

    public int? MaxPallets { get; init; }

    public double? MaxPayLoad { get; init; }

    public int? CurrentPallets { get; init; }

    public double? CurrentWeight { get; init; }

    public double? AvailablePalletCapacity { get; init; }

    public double? AvailablePallets { get; init; }

    public DateTime LastUpdated { get; init; }
}