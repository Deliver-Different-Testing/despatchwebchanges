using System;
using DespatchWeb.EntityClasses;

namespace DespatchWeb.Models;

public class TucNoteViewModel
{
    public int NoteId { get; set; }

    public int NoteTypeId { get; set; }
    public string NoteTypeName { get; set; }

    public int? JobId { get; set; }
    public int? BulkJobId { get; set; }
    public string JobNumber { get; set; }

    public int? JobBookingId { get; set; }

    public string NoteText { get; set; }

    public bool IsImportant { get; set; }

    public DateTimeOffset CreatedDate { get; set; }

    public int? CreatedBy { get; set; }
    public string CreatedByName { get; set; }

    public DateTimeOffset? UpdatedDate { get; set; }

    public int? UpdatedBy { get; set; }
    public string UpdatedByName { get; set; }

    // Method to map from viewmodel to entity
    public TucNote ToEntity()
    {
        return new TucNote
        {
            NoteId = NoteId,
            NoteTypeId = NoteTypeId,
            JobId = JobId,
            JobBookingId = JobBookingId,
            NoteText = NoteText,
            IsImportant = IsImportant,
            CreatedBy = CreatedBy,
            UpdatedBy = UpdatedBy
        };
    }

    public TucNoteArchive ToArchivedEntity()
    {
        return new TucNoteArchive
        {
            NoteId = NoteId,
            NoteTypeId = NoteTypeId,
            JobId = JobId,
            JobBookingId = JobBookingId,
            NoteText = NoteText,
            IsImportant = IsImportant,
            CreatedBy = CreatedBy ?? 0,
            UpdatedBy = UpdatedBy
        };
    }

    private static string FormatName(string firstName, string lastName) => string.Concat(firstName, " ", lastName);
}