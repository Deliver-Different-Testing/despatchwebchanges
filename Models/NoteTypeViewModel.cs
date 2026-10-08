namespace DespatchWeb.Models;

public sealed class NoteTypeViewModel : Suggestion
{
    public bool IsPublic { get; set; }
    public bool IsCourierFacing { get; set; }
    public string Description { get; set; }
}
