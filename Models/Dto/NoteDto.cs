using System;

namespace DespatchWeb.Models.Dto;

public class NoteDto
{
    public int NoteId { get; set; }
    public string NoteText { get; set; }
    public DateTime CreatedDate { get; set; }
    public DateTime? UpdatedDate { get; set; }
    public string CreatedByFirstName { get; set; }
    public string CreatedByLastName { get; set; }
    public string UpdatedByFirstName { get; set; }
    public string UpdatedByLastName { get; set; }
}

public class ArchivedNoteDto
{
    public int NoteId { get; set; }
    public string NoteText { get; set; }
    public DateTime? CreatedDate { get; set; }
    public DateTime? UpdatedDate { get; set; }
}