using System;
using System.Runtime.InteropServices.JavaScript;
using System.Threading.Tasks;
using DespatchWeb.Helpers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using Microsoft.AspNetCore.Mvc;
using Serilog;

namespace DespatchWeb.Controllers;

public class NoteController(
    IJobRepository jobRepository,
    IRecurringJobRepository recurringJobRepository
    ) : Controller
{
    public async Task<IActionResult> GetNotes(int jobId)
    {
        try
        {
            ArgumentNullException.ThrowIfNull(jobId);

            var notes = await jobRepository.GetNotesByJobIdAsync(jobId);
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
            ArgumentNullException.ThrowIfNull(bulkJobId);

            var bulkJobNotes = await jobRepository.GetBulkJobNotesByBulkJobIdAsync(bulkJobId);
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
            ArgumentNullException.ThrowIfNull(jobId);

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
            ArgumentNullException.ThrowIfNull(noteViewModel.NoteId);

            if (noteViewModel.JobBookingId.HasValue)
                await recurringJobRepository.SaveRecurringJobNote(noteViewModel);
            else
                await jobRepository.SaveNoteAsync(noteViewModel);

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
            ArgumentNullException.ThrowIfNull(noteViewModel.NoteId);

            await jobRepository.SaveBulkNoteAsync(noteViewModel);
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

            // Check if a note exists
            var existingNote = await jobRepository.GetNoteByIdAsync(noteViewModel.NoteId);
            if (existingNote == null)
                return NotFound($"Note with ID {noteViewModel.NoteId} not found.");

            await jobRepository.SaveNoteAsync(noteViewModel);

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

            // Check if a note exists
            var existingNote = await jobRepository.GetNoteByIdAsync(noteViewModel.NoteId);
            if (existingNote == null)
                return NotFound($"Note with ID {noteViewModel.NoteId} not found.");

            await jobRepository.SaveBulkNoteAsync(noteViewModel);

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
            var note = await jobRepository.GetNoteByIdAsync(noteId);
            ArgumentNullException.ThrowIfNull(note);

            await jobRepository.DeleteNoteAsync(noteId);

            return Ok();
        }
        catch (Exception ex)
        {
            Log.Error(ex, "{Message}", 
                ErrorMessageStringFormatter.FormatForLogging(ex, nameof(NoteController), nameof(DeleteNote)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    public async Task<IActionResult> GetNoteTypes()
    {
        try
        {
            var noteTypes = await jobRepository.GetNoteTypesAsync();
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
            await jobRepository.AddNewTucNoteTypeAsync(noteType);
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
