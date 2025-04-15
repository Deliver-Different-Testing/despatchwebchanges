using System;
using DespatchWeb.EntityClasses;

namespace DespatchWeb.Models;

 public class TucNoteViewModel
    {
        public int NoteId { get; set; }

        public int NoteTypeId { get; set; }
        public string NoteTypeName { get; set; }

        public int? JobId { get; set; }
        public string JobNumber { get; set; }

        public int? JobBookingId { get; set; }

        public string NoteText { get; set; }

        public bool IsImportant { get; set; }

        public DateTime CreatedDate { get; set; }

        public int? CreatedBy { get; set; }
        public string CreatedByName { get; set; }

        public DateTime? UpdatedDate { get; set; }

        public int? UpdatedBy { get; set; }
        public string UpdatedByName { get; set; }

        public string NoteTextSummary
        {
            get
            {
                if (string.IsNullOrEmpty(NoteText))
                    return string.Empty;

                return NoteText.Length <= 100 ? NoteText : string.Concat(NoteText.AsSpan(0, 97), "...");
            }
        }

        public TucNoteViewModel() { }

        public TucNoteViewModel(TucNote note)
        {
            if (note == null) return;

            NoteId = note.NoteId;
            NoteTypeId = note.NoteTypeId;
            NoteTypeName = note.NoteType?.NoteTypeName;
            JobId = note.JobId;
            JobNumber = note.Job?.UcjbNumber;
            JobBookingId = note.JobBookingId;
            NoteText = note.NoteText;
            IsImportant = note.IsImportant;
            CreatedDate = note.CreatedDate;
            CreatedBy = note.CreatedBy;
          CreatedByName = note.CreatedBy.HasValue && note.CreatedByNavigation != null
              ? FormatName(note.CreatedByNavigation.UcstFirstName, note.CreatedByNavigation.UcstLastName)
              : string.Empty;
            UpdatedDate = note.UpdatedDate;
            UpdatedBy = note.UpdatedBy;
            UpdatedByName = note.UpdatedBy.HasValue && note.UpdatedByNavigation != null
                ? FormatName(note.UpdatedByNavigation.UcstFirstName, note.UpdatedByNavigation.UcstLastName)
                : string.Empty;
        }

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
                CreatedDate = CreatedDate,
                CreatedBy = CreatedBy,
                UpdatedDate = UpdatedDate,
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
                CreatedDate = CreatedDate,
                CreatedBy = CreatedBy ?? 0,
                UpdatedDate = UpdatedDate,
                UpdatedBy = UpdatedBy
            };
        }

        private static string FormatName(string firstName, string lastName) => string.Concat(firstName, " ", lastName);
    }
