namespace DespatchWeb.Models;

    public sealed class NationwideJobDetail
    {
        public int? AirPortId { get; init; }
        public int? VehicleSizeId { get; init; }
        public int? ClientId { get; init; }
        public string FromState { get; init; }
        public string ToState { get; init; }
        public string FromZipCode { get; init; }
        public string ToZipCode { get; init; }
        public int? TotalMiles { get; init; }
        public decimal? TotalWeight { get; init; }
        public DateTime? BookTime { get; init; }
        public bool? DangerousGoods { get; init; }
        public decimal? DryIceWeight { get; init; }
        public int? Quantity { get; init; }
        public decimal? Cubic { get; init; }
        public int? TotalPallets { get; init; }
        public bool ExtraStopOffs { get; init; }
        public int? WaitTime { get; init; }
}
