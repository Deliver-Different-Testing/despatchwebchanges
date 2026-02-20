using System;
using System.Threading.Tasks;
using DespatchWeb.Enums;
using DespatchWeb.Helpers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Serilog;

namespace DespatchWeb.Controllers;

[Authorize]
public class NoteController(
    INoteRepository noteRepository,
    IRecurringJobRepository recurringJobRepository
    ) : Controller
{
    public async Task<IActionResult> GetNotes(int jobId)
    {
        try
        {

            var notes = await noteRepository.GetNotesByJobIdAsync(jobId);
            return Json(notes);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(ex, nameof(NoteController), nameof(GetNotes)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    public async Task<IActionResult> GetBulkJobNotes(int bulkJobId)
    {
        try
        {

            var bulkJobNotes = await noteRepository.GetBulkJobNotesByBulkJobIdAsync(bulkJobId);
            return Json(bulkJobNotes);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(ex, nameof(NoteController), nameof(GetBulkJobNotes)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    public async Task<IActionResult> GetRecurringNotes(int jobId)
    {
        try
        {

            var notes = await recurringJobRepository.GetRecurringNotesByJobIdAsync(jobId);
            return Json(notes);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(ex, nameof(NoteController), nameof(GetRecurringNotes)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    [HttpPost]
    public async Task<ActionResult<TucNoteViewModel>> CreateNote([FromBody] TucNoteViewModel noteViewModel)
    {
        try
        {
            ArgumentNullException.ThrowIfNull(noteViewModel);

            if (noteViewModel.JobBookingId.HasValue)
                await recurringJobRepository.SaveRecurringJobNote(noteViewModel);
            else if (noteViewModel.BulkJobId.HasValue)
                await noteRepository.SaveBulkNoteAsync(noteViewModel);
            else
                await noteRepository.SaveNoteAsync(noteViewModel);

            return Ok();
        }
        catch (Exception ex)
        {
            Log.Error(ex, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(ex, nameof(NoteController), nameof(CreateNote)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

   [HttpPost]
    public async Task<ActionResult<TucNoteViewModel>> CreateBulkJobNote([FromBody] TucNoteViewModel noteViewModel)
    {
        try
        {
            ArgumentNullException.ThrowIfNull(noteViewModel);

            await noteRepository.SaveBulkNoteAsync(noteViewModel);
            return Ok();
        }
        catch (Exception ex)
        {
            Log.Error(ex, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(ex, nameof(NoteController), nameof(CreateBulkJobNote)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    [HttpPost]
    public async Task<IActionResult> UpdateNote([FromBody] TucNoteViewModel noteViewModel)
    {
        try
        {
            ArgumentNullException.ThrowIfNull(noteViewModel);

            if (noteViewModel.BulkJobId.HasValue)
            {
                // Bulk notes live in TblBulkJobNotes, not TucNotes
                var existingBulkNote = await noteRepository.GetBulkNoteByIdAsync(noteViewModel.NoteId);
                if (existingBulkNote == null)
                    return NotFound($"Note with ID {noteViewModel.NoteId} not found.");

                await noteRepository.SaveBulkNoteAsync(noteViewModel);
            }
            else
            {
                // Check if a note exists in TucNotes / TucNoteArchives
                var existingNote = await noteRepository.GetNoteByIdAsync(noteViewModel.NoteId);
                if (existingNote == null)
                    return NotFound($"Note with ID {noteViewModel.NoteId} not found.");

                if (noteViewModel.JobBookingId.HasValue)
                    await recurringJobRepository.SaveRecurringJobNote(noteViewModel);
                else
                    await noteRepository.SaveNoteAsync(noteViewModel);
            }

            return Ok();
        }
        catch (Exception ex)
        {
            Log.Error(ex, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(ex, nameof(NoteController), nameof(UpdateNote)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    [HttpPost]
    public async Task<IActionResult> UpdateBulkJobNote([FromBody] TucNoteViewModel noteViewModel)
    {
        try
        {
            ArgumentNullException.ThrowIfNull(noteViewModel);

            // Check if a bulk note exists (query TblBulkJobNotes, not TucNotes)
            var existingNote = await noteRepository.GetBulkNoteByIdAsync(noteViewModel.NoteId);
            if (existingNote == null)
                return NotFound($"Note with ID {noteViewModel.NoteId} not found.");

            await noteRepository.SaveBulkNoteAsync(noteViewModel);

            return Ok();
        }
        catch (Exception ex)
        {
            Log.Error(ex, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(ex, nameof(NoteController), nameof(UpdateBulkJobNote)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    [HttpDelete]
    public async Task<IActionResult> DeleteNote(int noteId)
    {
        try
        {
            var note = await noteRepository.GetNoteByIdAsync(noteId);
            ArgumentNullException.ThrowIfNull(note);

            await noteRepository.DeleteNoteAsync(noteId);

            return Ok();
        }
        catch (Exception ex)
        {
            Log.Error(ex, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(ex, nameof(NoteController), nameof(DeleteNote)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    public async Task<IActionResult> GetNoteHistory(int noteId, string noteSource = "Note")
    {
        try
        {
            if (!Enum.TryParse<NoteHistorySource>(noteSource, ignoreCase: true, out var source))
                return BadRequest($"Invalid noteSource: {noteSource}");

            var history = await noteRepository.GetNoteHistoryAsync(noteId, source);
            return Json(history);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(ex, nameof(NoteController), nameof(GetNoteHistory)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    public async Task<IActionResult> GetNoteTypes()
    {
        try
        {
            var noteTypes = await noteRepository.GetNoteTypesAsync();
            return Json(noteTypes);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(ex, nameof(NoteController), nameof(GetNoteTypes)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    [HttpPost]
    public async Task<IActionResult> CreateNoteType([FromBody] NoteTypeViewModel noteType)
    {
        try
        {
            await noteRepository.AddNewTucNoteTypeAsync(noteType);
            return Ok();
        }
        catch (Exception ex)
        {
            Log.Error(ex, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(ex, nameof(NoteController), nameof(CreateNoteType)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }
}
