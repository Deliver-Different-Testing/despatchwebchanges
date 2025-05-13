using System;

namespace DespatchWeb.Models.Dto;

public class RateJobUsDto
{
    public int JobId { get; set; }

    public int ClientId { get; set; }

    public int Speed { get; set; }

    public string FromZip { get; set; }

    public string ToZip { get; set; }

    public decimal TotalMiles { get; set; }

    public decimal FromMiles { get; set; }

    public decimal ToMiles { get; set; }

    public int Weight { get; set; }

    public DateTime Booked { get; set; }

    public int Size { get; set; }

    public bool DangerousGoods { get; set; }

    public int TotalPallets { get; set; }

    public int ExtraStopOffs { get; set; }

    public int DryIceWeight { get; set; }

    public int WaitTime { get; set; }

    public int? FromAgentId { get; set; }

    public int? FromAirportId { get; set; }

    public int? ToAgentId { get; set; }

    public int? ToAirportId { get; set; }

    public int? Quantity { get; set; }
    public decimal? Cubic { get; set; }
}
