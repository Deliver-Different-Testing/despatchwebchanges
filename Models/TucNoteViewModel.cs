using DespatchWeb.EntityClasses;

namespace DespatchWeb.Models;

public sealed class TucNoteViewModel
{
    public int NoteId { get; init; }

    public int NoteTypeId { get; set; }
    public string NoteTypeName { get; init; }

    public int? JobId { get; init; }
    public int? BulkJobId { get; init; }
    public string JobNumber { get; init; }

    public int? JobBookingId { get; init; }

    public string NoteText { get; init; }

    public bool IsImportant { get; init; }

    public DateTimeOffset CreatedDate { get; set; }

    public int? CreatedBy { get; init; }
    public string CreatedByName { get; init; }

    public DateTimeOffset? UpdatedDate { get; set; }

    public int? UpdatedBy { get; init; }
    public string UpdatedByName { get; init; }

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
}