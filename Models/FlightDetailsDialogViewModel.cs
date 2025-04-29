namespace DespatchWeb.Models;

public class FlightDetailsDialogViewModel
        {
            // Basic flight details
            public string FlightNumber { get; set; }
            public string CarrierCode { get; set; }
            public string AirlineName { get; set; }
            public string ServiceType { get; set; }

            // Route information
            public AirportViewModel Origin { get; set; }
            public AirportViewModel Destination { get; set; }
            public string DepartureTime { get; set; }
            public string ArrivalTime { get; set; }
            public string Duration { get; set; }
            public int Stops { get; set; }
            public bool IsNonStop { get; set; }
            public string ArrivalTerminal { get; set; }

            // Aircraft details
            public string Aircraft { get; set; }
            public string AircraftType { get; set; }

            // Service details
            public string[] ServiceClasses { get; set; }
            public bool IsCodeShare { get; set; }
            public bool IsWetLease { get; set; }

            // Related flight details
            public OperatorViewModel OperatedBy { get; set; }
            public CodeShareViewModel[] CodeShares { get; set; }

            // Metadata
            public string FlightId { get; set; }
            public string ReferenceCode { get; set; }
        }

        public class AirportViewModel
        {
            public string Code { get; set; }
            public string Name { get; set; }
            public string City { get; set; }
            public string Country { get; set; }
            public string Timezone { get; set; }
            public int Elevation { get; set; }
            public double Latitude { get; set; }
            public double Longitude { get; set; }
        }

        public class OperatorViewModel
        {
            public string CarrierCode { get; set; }
            public string FlightNumber { get; set; }
            public string AirlineName { get; set; }
            public string ServiceType { get; set; }
        }

        public class CodeShareViewModel
        {
            public string CarrierCode { get; set; }
            public string FlightNumber { get; set; }
            public string ServiceType { get; set; }
            public string[] ServiceClasses { get; set; }
        }
