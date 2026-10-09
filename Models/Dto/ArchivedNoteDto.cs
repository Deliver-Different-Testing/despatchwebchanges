namespace DespatchWeb.Models.Dto;

public sealed record ArchivedNoteDto
{
    public int NoteId { get; init; }
    public string NoteText { get; init; }
    public DateTime? CreatedDate { get; init; }
    public DateTime? UpdatedDate { get; init; }
}
