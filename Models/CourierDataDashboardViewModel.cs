using System;

namespace DespatchWeb.Models;

public class CourierDataDashboardViewModel
{
    public BasicInformation BasicInformation { get; set; }
    public ContactInformation ContactInformation { get; set; }
    public VehicleInformation VehicleInformation { get; set; }
    public Compliance Compliance { get; set; }
    public BankingAndEmergency BankingAndEmergency { get; set; }
    public AdditionalInformation AdditionalInformation { get; set; }
}

public class BasicInformation
{
    public string Code { get; set; }
    public string FirstName { get; set; }
    public string Surname { get; set; }
    public string Email { get; set; }
    public string Address { get; set; }
}

public class ContactInformation
{
    public string Mobile { get; set; }
    public string Home { get; set; }
    public string GstNumber { get; set; }
    public string IrdNumber { get; set; }
}

public class VehicleInformation
{
    public string Rego { get; set; }
    public int? VehicleYear { get; set; }
    public string VehicleModel { get; set; }
    public string VehicleInsurance { get; set; }
}

public class Compliance
{
    public bool? DangerousGoods { get; set; }
    public DateTime? DangerousGoodsExpiry { get; set; }
    public DateTime? DriversLicenceExpiry { get; set; }
}

public class BankingAndEmergency
{
    public bool EmergencyContact { get; set; }
    public string Bank { get; set; }
    public bool SecurityCheck { get; set; }
}

public class AdditionalInformation
{
    public DateTime? ContactSignDate { get; set; }
    public decimal? MobileInsurence { get; set; }
    public decimal DailyProfitAdjust { get; set; }
    public string Notes { get; set; }
}