using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using DespatchWeb.Helpers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Models.Response;
using Microsoft.Extensions.Options;

namespace DespatchWeb.Services;

public class AiSummarizationService(
    IAiClientService aiClient,
    INoteRepository noteRepository,
    ITaskRepository taskRepository,
    IOptions<AnthropicSettings> settings) : IAiSummarizationService
{
    private const string SummarizationSystemPrompt =
        """
        You are a logistics data summarizer. Provide concise, actionable summaries.
        Focus on: current status, key issues, timeline of important events, and any pending actions.
        Keep the summary to 2-4 sentences. Use plain language.
        """;

    public async Task<AiSummaryResponse> SummarizeJobNotesAsync(int jobId, CancellationToken ct = default)
    {
        var notes = await noteRepository.GetNotesByJobIdAsync(jobId);

        if (notes == null || notes.Count == 0)
        {
            return new AiSummaryResponse
            {
                Summary = "No notes found for this job.",
                Usage = new AiUsageInfo()
            };
        }

        var sb = new StringBuilder();
        sb.AppendLine("Summarize the following job notes:");
        sb.AppendLine();

        foreach (var note in notes.OrderBy(n => n.CreatedDate))
        {
            var sanitized = AiDataSanitizer.Sanitize(note.NoteText);
            sb.AppendLine($"[{note.CreatedDate:yyyy-MM-dd HH:mm}] ({note.NoteTypeName}) by {note.CreatedByName}: {sanitized}");
        }

        var messages = new List<AiMessage>
        {
            new() { Role = "user", Content = sb.ToString() }
        };

        var response = await aiClient.SendMessageAsync(
            SummarizationSystemPrompt,
            messages,
            settings.Value.MaxTokensPerSummary,
            ct: ct);

        return new AiSummaryResponse
        {
            Summary = response.TextContent ?? "Unable to generate summary.",
            Usage = new AiUsageInfo
            {
                InputTokens = response.InputTokens,
                OutputTokens = response.OutputTokens
            }
        };
    }

    public async Task<AiSummaryResponse> SummarizeJobEventsAsync(int jobId, CancellationToken ct = default)
    {
        var filters = new TaskTableFiltersRequest { JobId = jobId, ShowCompleted = true };
        var events = await taskRepository.GetAllTasksAsync(filters);

        if (events == null || events.Count == 0)
        {
            return new AiSummaryResponse
            {
                Summary = "No events found for this job.",
                Usage = new AiUsageInfo()
            };
        }

        var sb = new StringBuilder();
        sb.AppendLine("Summarize the following job event history:");
        sb.AppendLine();

        foreach (var evt in events.OrderBy(e => e.DueDate))
        {
            var status = evt.Closed ? "CLOSED" : "OPEN";
            var sanitized = AiDataSanitizer.Sanitize(evt.Description ?? evt.Title);
            sb.AppendLine($"[{evt.DueDate:yyyy-MM-dd HH:mm}] {evt.EventType} - {sanitized} [{status}]");
        }

        var messages = new List<AiMessage>
        {
            new() { Role = "user", Content = sb.ToString() }
        };

        var response = await aiClient.SendMessageAsync(
            SummarizationSystemPrompt,
            messages,
            settings.Value.MaxTokensPerSummary,
            ct: ct);

        return new AiSummaryResponse
        {
            Summary = response.TextContent ?? "Unable to generate summary.",
            Usage = new AiUsageInfo
            {
                InputTokens = response.InputTokens,
                OutputTokens = response.OutputTokens
            }
        };
    }
}
