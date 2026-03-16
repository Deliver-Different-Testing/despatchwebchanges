namespace DespatchWeb.Models.Dto;

public sealed record NoteDto
{
    public int NoteId { get; init; }
    public string NoteText { get; init; }
    public DateTime CreatedDate { get; init; }
    public DateTime? UpdatedDate { get; init; }
    public string CreatedByFirstName { get; init; }
    public string CreatedByLastName { get; init; }
    public string UpdatedByFirstName { get; init; }
    public string UpdatedByLastName { get; init; }
}

public sealed record ArchivedNoteDto
{
    public int NoteId { get; init; }
    public string NoteText { get; init; }
    public DateTime? CreatedDate { get; init; }
    public DateTime? UpdatedDate { get; init; }
}