using System;

namespace DespatchWeb.Models;

public class NoteHistoryViewModel
{
    public int NoteHistoryId { get; init; }
    public int NoteId { get; init; }
    public int EditedBy { get; init; }
    public string EditedByName { get; init; }
    public DateTimeOffset EditedAt { get; init; }
    public string OldNoteText { get; init; }
    public string NewNoteText { get; init; }
    public int? OldNoteTypeId { get; init; }
    public string OldNoteTypeName { get; init; }
    public int? NewNoteTypeId { get; init; }
    public string NewNoteTypeName { get; init; }
    public bool? OldIsImportant { get; init; }
    public bool? NewIsImportant { get; init; }
}
