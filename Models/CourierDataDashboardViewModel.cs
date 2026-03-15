namespace DespatchWeb.Models;

public class CourierDataDashboardViewModel
{
    public int CourierId { get; init; }
    public BasicInformation BasicInformation { get; init; }
    public ContactInformation ContactInformation { get; init; }
    public VehicleInformation VehicleInformation { get; init; }
    public Compliance Compliance { get; init; }
    public BankingAndEmergency BankingAndEmergency { get; init; }
    public AdditionalInformation AdditionalInformation { get; init; }
}

public class BasicInformation
{
    public string Code { get; init; }
    public string FirstName { get; init; }
    public string Surname { get; init; }
    public string Email { get; init; }
    public string Address { get; init; }
}

public class ContactInformation
{
    public string Mobile { get; init; }
    public string Home { get; init; }
    public string GstNumber { get; init; }
    public string IrdNumber { get; init; }
}

public class VehicleInformation
{
    public string Rego { get; init; }
    public int? VehicleYear { get; init; }
    public string VehicleModel { get; init; }
    public string VehicleInsurance { get; init; }
}

public class Compliance
{
    public bool? DangerousGoods { get; init; }
    public DateTime? DangerousGoodsExpiry { get; init; }
    public DateTime? DriversLicenceExpiry { get; init; }
}

public class BankingAndEmergency
{
    public bool EmergencyContact { get; init; }
    public string Bank { get; init; }
    public bool SecurityCheck { get; init; }
}

public class AdditionalInformation
{
    public DateTime? ContactSignDate { get; init; }
    public decimal? MobileInsurence { get; init; }
    public decimal DailyProfitAdjust { get; init; }
    public string Notes { get; init; }
}