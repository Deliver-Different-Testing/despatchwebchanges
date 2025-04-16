using System;
using System.Threading.Tasks;
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
    [HttpGet]
    public async Task<IActionResult> GetNotes(int jobId)
    {
        try
        {
            ArgumentNullException.ThrowIfNull(jobId);

            var notes = await jobRepository.GetNotesByJobId(jobId);
            return Json(notes);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error getting notes");
            return StatusCode(500, "An error occurred while getting the notes.");
        }
    }

    [HttpGet]
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
            Log.Error(ex, "Error getting notes");
            return StatusCode(500, "An error occurred while getting the notes.");
        }
    }

    [HttpPost]
    public async Task<ActionResult<TucNoteViewModel>> CreateNote([FromBody] TucNoteViewModel noteViewModel)
    {
        try
        {
            if (noteViewModel == null)
                return BadRequest("Note data is required.");

            if (noteViewModel.NoteId != 0)
                return BadRequest("Note ID should not be provided for new notes.");

            var savedNoteId = await jobRepository.SaveNoteAsync(noteViewModel);

            var savedViewModel = await jobRepository.GetNoteByIdAsync(savedNoteId);
            return savedViewModel;
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error creating note");
            return StatusCode(500, "An error occurred while creating the note.");
        }
    }

    [HttpPost]
    public async Task<IActionResult> UpdateNote([FromBody] TucNoteViewModel noteViewModel)
    {
        try
        {
            ArgumentNullException.ThrowIfNull(noteViewModel);

            // Check if note exists
            var existingNote = await jobRepository.GetNoteByIdAsync(noteViewModel.NoteId);
            if (existingNote == null)
                return NotFound($"Note with ID {noteViewModel.NoteId} not found.");

            await jobRepository.SaveNoteAsync(noteViewModel);

            return Ok();
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error updating note {NoteId}", noteViewModel.NoteId);
            return StatusCode(500, "An error occurred while updating the note.");
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
           Log.Error(ex, "Error deleting note {NoteId}", noteId);
            return StatusCode(500, "An error occurred while deleting the note.");
        }
    }

    [HttpGet]
    public async Task<IActionResult> GetNoteTypes()
    {
        try
        {
            var noteTypes = await jobRepository.GetNoteTypesAsync();
            return Json(noteTypes);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error occured getting note types");
            return StatusCode(500, "An error occurred getting note types.");
        }
    }
}
