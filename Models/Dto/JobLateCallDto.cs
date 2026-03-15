namespace DespatchWeb.Models.Dto;

public class JobLateCallDto
{
     public int Id { get; init; }
        public int ClientId { get; init; }
        public int MinutesRemaining { get; init; }
        public int PickupTime { get; init; }
        public int DeliveryTime { get; init; }
        public int AlertLatePickup { get; init; }
        public int AlertLateDelivery { get; init; }
        public DateTime JobTime { get; init; }
        public string BookedSpeed { get; init; }
        public string NotifiedSpeed { get; init; }
}
