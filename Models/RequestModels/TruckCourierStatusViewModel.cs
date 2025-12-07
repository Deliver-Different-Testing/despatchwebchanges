using System;

namespace DespatchWeb.Models.RequestModels;

public class TruckCourierStatusViewModel
{
    public int CourierId { get; set; }

    public string CourierCode { get; set; }

    public string FirstName { get; set; }

    public int? MaxPallets { get; set; }

    public double? MaxPayLoad { get; set; }

    public int? CurrentPallets { get; set; }

    public double? CurrentWeight { get; set; }

    public double? AvailablePalletCapacity { get; set; }

    public double? AvailablePallets { get; set; }

    public bool IsAtCapacity =>
        CurrentPallets >= MaxPallets ||
        CurrentWeight >= MaxPayLoad;

    public DateTime LastUpdated { get; set; }
}