namespace DespatchWeb.Models;

public sealed class AreaClearList
{
    public int Id { get; set; }
    public string Name { get; set; }
    public int Order { get; set; }
    public int PercentHeight { get; set; }
    public List<ClearListSection> Top { get; set; } = [];
    public List<ClearListSection> Middle { get; set; } = [];
    public List<ClearListSection> Bottom { get; set; } = [];
    public int TotalRemaining { get; set; }
}
