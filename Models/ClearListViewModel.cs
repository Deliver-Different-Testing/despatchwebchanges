using System.Collections.Generic;

namespace DespatchWeb.Models
{

    public class ClearListViewModel
    {
        public AreaClearList Central { get; set; }
        public AreaClearList City { get; set; }
        public AreaClearList Parnell { get; set; }
        public AreaClearList NewMarket { get; set; }
        public AreaClearList Ponsonby { get; set; }
        public AreaClearList Eden { get; set; }
        public AreaClearList Other { get; set; }
        public AreaClearList WestMid { get; set; }
        public AreaClearList EastMid { get; set; }
        public AreaClearList ShallowWest { get; set; }
        public AreaClearList DeepWest { get; set; }
        public AreaClearList ShallowShore { get; set; }
        public AreaClearList DeepShore { get; set; }
        public AreaClearList Mangere { get; set; }
        public AreaClearList DeepSouth { get; set; }
        public AreaClearList DeepEast { get; set; }
    }

    public class AreaClearList
    {
        public int PercentHeight { get; set; }
        public List<ClearListSection> Top { get; set; }
        public List<ClearListSection> Middle { get; set; }
        public List<ClearListSection> Bottom { get; set; }
        public int TotalRemaining { get; set; }
    }

    public class ClearListSection
    {
        public string CourierNumber { get; set; }
        public CourierData CourierData { get; set; }
        public List<Destination> Destinations { get; set; }
    }

    public class CourierData
    {
        public string Courier { get; set; }
        public string Location { get; set; }
        public string Pu { get; set; }
        public string Del { get; set; }
        public string Lrm { get; set; }
        public string Eta2lrm { get; set; }
        public int? CourierID { get; set; }
        public string? CourierName { get; set; }
        public string? CourierMobile { get; set; }
    }

    public class Destination
    {
        public int Id { get; set; }
        public string Label { get; set; }
    }

}
