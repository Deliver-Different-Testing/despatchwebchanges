using System;

namespace DespatchWeb.Models.Dto;

public class JobLateCallDto
{
     public int Id { get; set; }
        public int ClientId { get; set; }
        public int MinutesRemaining { get; set; }
        public int PickupTime { get; set; }
        public int DeliveryTime { get; set; }
        public int AlertLatePickup { get; set; }
        public int AlertLateDelivery { get; set; }
        public DateTime JobTime { get; set; }
        public string BookedSpeed { get; set; }
        public string NotifiedSpeed { get; set; }
}
