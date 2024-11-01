using System;
using System.Collections.Generic;
using System.Linq;
using Newtonsoft.Json;

namespace DespatchWeb.Models;

public class JobDownloadModel
{
    public int Id { get; set; }
    public int? ParentId { get; set; }
    public string JobNumber { get; set; }
    public DateTime BookDate { get; set; }
    public decimal? Amount { get; set; }
    public decimal FuelSurcharge { get; set; }
    public decimal? Ppd { get; set; }
    public decimal? CourierPayment { get; set; }
    public decimal? CourierFuel { get; set; }
    public decimal? CourierBonus { get; set; }
    public string DeliveryAddressLine1 { get; set; }
    public string DeliveryAddressLine2 { get; set; }
    public string DeliveryAddressLine3 { get; set; }
    public string DeliveryAddressLine4 { get; set; }
    public string DeliveryAddressLine5 { get; set; }
    public string DeliveryAddressLine6 { get; set; }
    public string DeliveryAddressLine7 { get; set; }
    public string DeliveryAddressLine8 { get; set; }

}