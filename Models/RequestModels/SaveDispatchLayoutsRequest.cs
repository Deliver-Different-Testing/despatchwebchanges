using DespatchWeb.Models;

namespace DespatchWeb.Models.RequestModels;

public sealed class SaveDispatchLayoutsRequest
{
    public string Page { get; init; }

    public IReadOnlyList<DispatchLayoutDto> Layouts { get; init; } = [];
}
