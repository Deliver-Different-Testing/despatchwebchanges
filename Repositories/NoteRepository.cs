using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Helpers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using Microsoft.EntityFrameworkCore;

namespace DespatchWeb.Repositories;

public class NoteRepository(
    IDbContextFactory<DespatchContext> contextFactory,
    ITenantInfoService infoService)
    : BaseRepository(contextFactory), INoteRepository
{
    private const string Space = " ";

    public async Task<List<TucNoteViewModel>> GetBulkJobNotesByBulkJobIdAsync(int bulkJobId)
    {
        var bulkNotes = await Context.TblBulkJobNotes
            .AsNoTracking()
            .AsSplitQuery()
            .Where(n => n.BulkJobId == bulkJobId)
            .OrderByDescending(n => n.CreatedDate)
            .Select(n => new TucNoteViewModel
            {
                NoteId = n.NoteId,
                NoteTypeId = n.NoteTypeId,
                NoteTypeName = n.NoteType != null ? n.NoteType.NoteTypeName : string.Empty,
                BulkJobId = n.BulkJobId,
                JobNumber = n.BulkJob != null ? n.BulkJob.JobNumber : string.Empty,
                NoteText = n.NoteText,
                IsImportant = n.IsImportant,
                CreatedDate = n.CreatedDate,
                CreatedByName = n.CreatedBy.HasValue && n.CreatedByNavigation != null
                    ? FormatName(n.CreatedByNavigation.UcstFirstName, n.CreatedByNavigation.UcstLastName)
                    : string.Empty,
                UpdatedDate = n.UpdatedDate,
                UpdatedBy = n.UpdatedBy,
                UpdatedByName = n.UpdatedBy.HasValue && n.UpdatedByNavigation != null
                    ? FormatName(n.UpdatedByNavigation.UcstFirstName, n.UpdatedByNavigation.UcstLastName)
                    : string.Empty
            })
            .ToListAsync();

        return bulkNotes;
    }

    private static string FormatName(string firstName, string lastName) => string.Concat(firstName, " ", lastName);

    public async Task<List<TucNoteViewModel>> GetNotesByJobIdAsync(int jobId) =>
        await IsJobArchived(jobId)
            ? await GetArchivedNotesByJobIdAsync(jobId)
            : await GetActiveNotesByJobIdAsync(jobId);

    public async Task<TucNoteViewModel> GetNoteByIdAsync(int noteId)
    {
        await using var activeContext = CreateNewContext();
        await using var archivedContext = CreateNewContext();

        var tenantTimeZone = infoService.GetTenantTimeZone();

        var activeTask = activeContext.GetActiveNotesByNoteIdAsync(noteId);
        var archivedTask = CreateArchivedNoteQuery(archivedContext)
            .Where(note => note.NoteId == noteId)
            .FirstOrDefaultAsync();

        await Task.WhenAll(activeTask, archivedTask);

        var activeNote = await activeTask;
        var archivedNote = await archivedTask;

        var result = activeNote ?? archivedNote;
        if (result != null)
            UpdateNoteDate(result, tenantTimeZone);

        return result;
    }

    public async Task SaveNoteAsync(TucNoteViewModel viewModel, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(viewModel);
        if (!viewModel.JobId.HasValue) throw new ArgumentNullException(nameof(viewModel.JobId));

        var staffId = infoService.GetStaffId();
        var currentTime = infoService.GetCurrentTenantTime();

        if (viewModel.NoteId == 0)
            await CreateNoteAsync(viewModel, staffId, currentTime, cancellationToken);
        else
            await UpdateNoteAsync(viewModel, staffId, currentTime, cancellationToken);
    }

    public async Task SaveBulkNoteAsync(TucNoteViewModel viewModel, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(viewModel);
        if (!viewModel.BulkJobId.HasValue) throw new ArgumentNullException(nameof(viewModel.BulkJobId));

        ArgumentException.ThrowIfNullOrWhiteSpace(viewModel.NoteText);

        // If a note type is not found, default to the internal note
        var noteTypeExists = await Context.TucNoteTypes.AnyAsync(nt => nt.NoteTypeId == viewModel.NoteTypeId,
            cancellationToken: cancellationToken);
        if (!noteTypeExists) viewModel.NoteTypeId = (int)NoteType.InternalNote;

        var newNote = new TblBulkJobNote
        {
            BulkJobId = viewModel.BulkJobId.Value,
            IsImportant = viewModel.IsImportant,
            NoteText = viewModel.NoteText,
            NoteTypeId = viewModel.NoteTypeId
        };

        await Context.TblBulkJobNotes.AddAsync(newNote, cancellationToken);
        await Context.SaveChangesAsync(cancellationToken);
    }

    public async Task DeleteNoteAsync(int noteId, CancellationToken cancellationToken = default) =>
        await Context.TucNotes
            .Where(note => note.NoteId == noteId)
            .ExecuteDeleteAsync(cancellationToken);

    public async Task<bool> IsJobArchived(int jobId) => await Context.IsJobArchivedAsync(jobId);

    public async Task<List<NoteTypeViewModel>> GetNoteTypesAsync() =>
        await Context.TucNoteTypes
            .Where(x => x.IsActive)
            .Select(x => new NoteTypeViewModel
            {
                Id = x.NoteTypeId,
                Text = x.NoteTypeName,
                IsPublic = x.IsPublic
            })
            .AsNoTracking()
            .ToListAsync();

    public async Task AddNewTucNoteTypeAsync(NoteTypeViewModel noteType)
    {
        var newType = new TucNoteType
        {
            IsActive = true,
            IsPublic = noteType.IsPublic,
            NoteTypeName = noteType.Text,
            Description = noteType.Description
        };

        await Context.TucNoteTypes.AddAsync(newType);
        await Context.SaveChangesAsync();
    }

    // Helper Methods
    private async Task<int> GetEffectiveJobId(int jobId, bool isArchived)
    {
        if (isArchived)
            return await Context.GetEffectiveArchiveJobIdAsync(jobId);

        return await Context.GetEffectiveJobIdAsync(jobId);
    }

    // Note Create/Update Operations
    private async Task CreateNoteAsync(TucNoteViewModel viewModel, int staffId, DateTime currentTime,
        CancellationToken cancellationToken = default)
    {
        var isArchived = viewModel.JobId.HasValue && await IsJobArchived(viewModel.JobId.Value) &&
                         !viewModel.JobBookingId.HasValue;
        if (isArchived)
        {
            var archivedNote = viewModel.ToArchivedEntity();
            archivedNote.CreatedDate = currentTime;
            archivedNote.CreatedBy = staffId;

            var effectiveJobId = await GetEffectiveJobId(viewModel.JobId.Value, true);
            archivedNote.JobId = effectiveJobId;

            await Context.TucNoteArchives.AddAsync(archivedNote, cancellationToken);
            await Context.SaveChangesAsync(cancellationToken);

            // Also update UcjbNotes so the note syncs to the device
            await Context.TucJobArchives
                .Where(j => j.UcjbId == viewModel.JobId.Value)
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(j => j.UcjbNotes, viewModel.NoteText), cancellationToken);
            return;
        }

        var activeNote = viewModel.ToEntity();
        activeNote.CreatedDate = currentTime;
        activeNote.CreatedBy = staffId;

        var isPrebook = viewModel.JobBookingId.HasValue;

        if (isPrebook)
        {
            var effectiveJobBookingId = await Context.GetEffectiveJobBookingIdAsync(viewModel.JobBookingId.Value);
            activeNote.JobBookingId = effectiveJobBookingId;
        }
        else
        {
            if (!viewModel.JobId.HasValue) throw new ArgumentNullException(nameof(viewModel.JobId));
            // Use the actual job ID instead of the effective job ID to avoid FK constraint issues
            // The note should be associated with the specific job being voided, not its parent
            activeNote.JobId = viewModel.JobId.Value;
        }

        await Context.TucNotes.AddAsync(activeNote, cancellationToken);
        await Context.SaveChangesAsync(cancellationToken);

        // Also update UcjbNotes so the note syncs to the device (only for active jobs, not prebooks)
        if (!isPrebook && viewModel.JobId.HasValue)
        {
            await Context.TucJobs
                .Where(j => j.UcjbId == viewModel.JobId.Value)
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(j => j.UcjbNotes, viewModel.NoteText), cancellationToken);
        }
    }

    private async Task UpdateNoteAsync(TucNoteViewModel viewModel, int staffId, DateTime currentTime,
        CancellationToken cancellationToken = default)
    {
        var isArchived = viewModel.JobId.HasValue && await IsJobArchived(viewModel.JobId.Value);
        var isPrebook = viewModel.JobBookingId.HasValue;

        if (isArchived)
        {
            var archivedNote = await Context.TucNoteArchives.FindAsync([viewModel.NoteId], cancellationToken);
            ArgumentNullException.ThrowIfNull(archivedNote);

            archivedNote.NoteTypeId = viewModel.NoteTypeId;
            archivedNote.JobId = viewModel.JobId;
            archivedNote.JobBookingId = viewModel.JobBookingId;
            archivedNote.NoteText = viewModel.NoteText;
            archivedNote.IsImportant = viewModel.IsImportant;
            archivedNote.UpdatedDate = currentTime;
            archivedNote.UpdatedBy = staffId;

            var effectiveJobId = await GetEffectiveJobId(viewModel.JobId.Value, true);
            archivedNote.JobId = effectiveJobId;

            Context.TucNoteArchives.Update(archivedNote);
            await Context.SaveChangesAsync(cancellationToken);
            return;
        }

        var activeNote = await Context.TucNotes.FindAsync([viewModel.NoteId], cancellationToken);
        ArgumentNullException.ThrowIfNull(activeNote);

        activeNote.NoteTypeId = viewModel.NoteTypeId;
        activeNote.JobId = viewModel.JobId;
        activeNote.JobBookingId = viewModel.JobBookingId;
        activeNote.NoteText = viewModel.NoteText;
        activeNote.IsImportant = viewModel.IsImportant;
        activeNote.UpdatedDate = currentTime;
        activeNote.UpdatedBy = staffId;

        if (isPrebook)
        {
            var effectiveJobBookingId = await Context.GetEffectiveJobBookingIdAsync(viewModel.JobBookingId.Value);
            activeNote.JobBookingId = effectiveJobBookingId;
        }
        else
        {
            if (!viewModel.JobId.HasValue) throw new ArgumentNullException(nameof(viewModel.JobId));

            var effectiveJobId = await GetEffectiveJobId(viewModel.JobId.Value, false);
            activeNote.JobId = effectiveJobId;
        }

        Context.TucNotes.Update(activeNote);
        await Context.SaveChangesAsync(cancellationToken);
    }

    // Query Methods
    private async Task<List<TucNoteViewModel>> GetActiveNotesByJobIdAsync(int jobId)
    {
        var effectiveJobId = await GetEffectiveJobId(jobId, false);
        var tenantTimeZone = infoService.GetTenantTimeZone();

        var notes = await Context.GetActiveNotesByJobIdAsync(effectiveJobId);
        UpdateNoteDate(notes, tenantTimeZone);
        return notes;
    }

    private async Task<List<TucNoteViewModel>> GetArchivedNotesByJobIdAsync(int jobId)
    {
        var effectiveJobId = await GetEffectiveJobId(jobId, true);

        var query = CreateArchivedNoteQuery()
            .Where(note => note.JobId == effectiveJobId || note.JobBookingId == effectiveJobId);

        var notes = await query.ToListAsync();
        // Order in memory as TucNoteViewModel.CreatedDate is DateTimeOffset which some providers don't support in ORDER BY
        return notes.OrderByDescending(note => note.CreatedDate).ToList();
    }

    private IQueryable<TucNoteViewModel> CreateArchivedNoteQuery() => CreateArchivedNoteQuery(Context);

    private static IQueryable<TucNoteViewModel> CreateArchivedNoteQuery(DespatchContext context)
    {
        return from note in context.TucNoteArchives
            join noteType in context.TucNoteTypes
                on note.NoteTypeId equals noteType.NoteTypeId into noteTypes
            from nt in noteTypes.DefaultIfEmpty()
            join createdBy in context.TucStaffs
                on note.CreatedBy equals createdBy.UcstId into createdStaff
            from cs in createdStaff.DefaultIfEmpty()
            join updatedBy in context.TucStaffs
                on note.UpdatedBy equals updatedBy.UcstId into updatedStaff
            from us in updatedStaff.DefaultIfEmpty()
            join job in context.TucJobArchives
                on note.JobId equals job.UcjbId into jobs
            from j in jobs.DefaultIfEmpty()
            select new TucNoteViewModel
            {
                // Note properties
                NoteId = note.NoteId,
                NoteText = note.NoteText,
                CreatedDate = note.CreatedDate ?? j.UcjbComplTime ?? DateTime.MinValue,
                UpdatedDate = note.UpdatedDate,
                JobId = note.JobId,
                JobBookingId = note.JobBookingId,
                IsImportant = note.IsImportant,

                // Related entity properties
                NoteTypeId = note.NoteTypeId,
                NoteTypeName = nt.NoteTypeName,

                // Staff information
                CreatedBy = note.CreatedBy,
                CreatedByName = cs != null ? cs.UcstFirstName + Space + cs.UcstLastName : null,
                UpdatedBy = note.UpdatedBy,
                UpdatedByName = us != null ? us.UcstFirstName + Space + us.UcstLastName : null,

                // Job information
                JobNumber = j != null ? j.UcjbNumber : null
            };
    }

    private static void UpdateNoteDate(List<TucNoteViewModel> notes, string tenantTimeZone)
    {
        foreach (var note in notes) UpdateNoteDate(note, tenantTimeZone);
    }

    private static void UpdateNoteDate(TucNoteViewModel note, string tenantTimeZone)
    {
        note.CreatedDate = TimeZoneHelper.SetDateTimeWithTimeZone(note.CreatedDate, tenantTimeZone);
        if (note.UpdatedDate.HasValue)
            note.UpdatedDate = TimeZoneHelper.SetDateTimeWithTimeZone(note.UpdatedDate.Value, tenantTimeZone);
    }
}
