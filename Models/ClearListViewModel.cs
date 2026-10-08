namespace DespatchWeb.Models;

public sealed class ClearListViewModel
{
    public List<AreaClearList> Areas { get; set; } = [];
    public List<ClearListColumn> Columns { get; set; } = [];
}
