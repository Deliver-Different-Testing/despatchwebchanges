namespace DespatchWeb.Models.RequestModels;

public class VoidJobBaseRequest
{
    public bool VoidSingleJobOnly { get; init; }
    public string VoidReason { get; init; }
}
