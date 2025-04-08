namespace DespatchWeb.Models;

public class LateCallRequest
{
    public int JobId { get; set; }
    public int LateType { get; set; }
    public int LateTime { get; set; }
    public int StaffId { get; set; }
    public string DespatcherName { get; set; }
    public bool CalculationRequired { get; set; }
}
