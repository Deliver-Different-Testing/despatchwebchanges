namespace DespatchWeb.Models.Dto;

public class NoteDto
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

public class ArchivedNoteDto
{
    public int NoteId { get; init; }
    public string NoteText { get; init; }
    public DateTime? CreatedDate { get; init; }
    public DateTime? UpdatedDate { get; init; }
}