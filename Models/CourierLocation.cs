namespace DespatchWeb.Models
{

    public  class CourierLocation
    {
        public decimal Longitude { get; set; }

        public decimal Latitude { get; set; }

        public string Time { get; set; }

        public string Status { get; set; }

        public int JobId { get; set; }

        public bool GpsWasEstimated { get; set; }

        public string RawData { get; set; }

        public string CourierName { get; set; }

        public string FirstName { get; set; }
    }
}

