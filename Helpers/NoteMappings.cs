using System;
using System.Linq.Expressions;
using DespatchWeb.EntityClasses;
using DespatchWeb.Models;

namespace DespatchWeb.Helpers;

public static class NoteMappings
{
    public static readonly Expression<Func<TucNote, TucNoteViewModel>> ActiveNoteMap = note =>
        new TucNoteViewModel
        {
            NoteId = note.NoteId,
            NoteTypeId = note.NoteTypeId,
            NoteTypeName = note.NoteType.NoteTypeName,
            JobId = note.JobId,
            JobNumber = note.Job.UcjbNumber,
            JobBookingId = note.JobBookingId,
            NoteText = note.NoteText,
            IsImportant = note.IsImportant,
            CreatedDate = note.CreatedDate,
            CreatedBy = note.CreatedBy,
            CreatedByName = note.CreatedBy.HasValue && note.CreatedByNavigation != null
                ? FormatName(note.CreatedByNavigation.UcstFirstName, note.CreatedByNavigation.UcstLastName)
                : "System",
            UpdatedDate = note.UpdatedDate,
            UpdatedBy = note.UpdatedBy,
            UpdatedByName = note.UpdatedBy.HasValue && note.UpdatedByNavigation != null
                ? FormatName(note.UpdatedByNavigation.UcstFirstName, note.UpdatedByNavigation.UcstLastName)
                : string.Empty
        };

    private static string FormatName(string firstName, string lastName) => string.Concat(firstName, " ", lastName);
}