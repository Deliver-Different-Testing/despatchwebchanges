using System;
using System.ComponentModel.DataAnnotations;

namespace DespatchWeb.Models;

public class CarrierFlightRateViewModel
    {
        [Display(Name = "Job Type")]
        public int? JobTypeId { get; set; }

        [Display(Name = "Carrier Name")]
        [StringLength(250)]
        public string Name { get; set; }

        [Display(Name = "Delivery Speed")]
        [StringLength(50)]
        public string Speed { get; set; }

        [Display(Name = "Service Description")]
        [StringLength(500)]
        [DataType(DataType.MultilineText)]
        public string Description { get; set; }

        [Display(Name = "Base Rate")]
        [DataType(DataType.Currency)]
        [DisplayFormat(DataFormatString = "{0:C}", ApplyFormatInEditMode = false)]
        public decimal? Rate { get; set; }

        [Display(Name = "Sale Rate")]
        [DataType(DataType.Currency)]
        [DisplayFormat(DataFormatString = "{0:C}", ApplyFormatInEditMode = false)]
        public decimal? SaleRate { get; set; }

        [Display(Name = "Availability Status")]
        [StringLength(250)]
        public string Availability { get; set; }

        [Display(Name = "Status Color")]
        [StringLength(250)]
        public string AvailabilityColour { get; set; }

        [Display(Name = "Booking Date")]
        [DataType(DataType.DateTime)]
        [DisplayFormat(DataFormatString = "{0:dd/MM/yyyy HH:mm}", ApplyFormatInEditMode = true)]
        public DateTime? BookDate { get; set; }

        [Display(Name = "Transit Duration (Hours)")]
        [Range(0, int.MaxValue)]
        public int? Duration { get; set; }

        [Display(Name = "Flight Rate")]
        [DataType(DataType.Currency)]
        [DisplayFormat(DataFormatString = "{0:C}", ApplyFormatInEditMode = false)]
        public decimal? FlightRate { get; set; }

        // Computed properties
        [Display(Name = "Total Rate")]
        [DataType(DataType.Currency)]
        public decimal? TotalRate => FlightRate ?? Rate;

        [Display(Name = "Estimated Delivery")]
        public DateTime? EstimatedDelivery => BookDate?.AddHours(Duration ?? 0);

        [Display(Name = "Has Discount")]
        public bool HasDiscount => SaleRate < Rate;

        // Helper method for availability styling
        public string GetAvailabilityStyle()
        {
            return !string.IsNullOrEmpty(AvailabilityColour)
                ? $"color: {AvailabilityColour};"
                : string.Empty;
        }
    }
