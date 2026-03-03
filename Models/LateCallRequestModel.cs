namespace DespatchWeb.Models;

public class LateCallRequest
{
    public int JobId { get; init; }
    public int LateType { get; init; }
    public int LateTime { get; init; }
    public bool CalculationRequired { get; init; }
}
