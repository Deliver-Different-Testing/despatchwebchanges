using System;

namespace DespatchWeb.Models;

public class NoteHistoryViewModel
{
    public int NoteHistoryId { get; set; }
    public int NoteId { get; set; }
    public int EditedBy { get; set; }
    public string EditedByName { get; set; }
    public DateTimeOffset EditedAt { get; set; }
    public string OldNoteText { get; set; }
    public string NewNoteText { get; set; }
    public int? OldNoteTypeId { get; set; }
    public string OldNoteTypeName { get; set; }
    public int? NewNoteTypeId { get; set; }
    public string NewNoteTypeName { get; set; }
    public bool? OldIsImportant { get; set; }
    public bool? NewIsImportant { get; set; }
}
