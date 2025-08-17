namespace DespatchWeb.Models.RequestModels;

public class VoidJobRequest
{
    public int JobId { get; set; }
    public bool VoidSingleJobOnly { get; set; }
    public string VoidReason { get; set; }
}