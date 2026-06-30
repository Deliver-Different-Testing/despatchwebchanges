using System.Text;
using System.Text.Json;
using DespatchWeb.Enums;
using DespatchWeb.Helpers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.MessageModels;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Models.Response;
using Microsoft.Extensions.Options;

namespace DespatchWeb.Services;

public sealed class AiDraftingService(
    IAiClientService aiClient,
    IJobQueryRepository jobRepository,
    INoteRepository noteRepository,
    ITenantInfoService tenantInfo,
    IOptions<AnthropicSettings> settings) : IAiDraftingService
{
    private const string EmitEmailDraftToolName = "emit_email_draft";

    private static readonly JsonSerializerOptions ToolJsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    private const string EmitEmailDraftSchema = """
    {
      "type": "object",
      "properties": {
        "subject": { "type": "string", "description": "Concise, professional email subject line." },
        "body": { "type": "string", "description": "The email body, professional and ready to send. Plain text with line breaks." }
      },
      "required": ["subject", "body"]
    }
    """;

    private string RegionContext => tenantInfo.IsUsTenant()
        ? "a US-based courier dispatch company"
        : "a New Zealand courier dispatch company";

    // ---------------------------------------------------------------------
    //  Courier / staff message
    // ---------------------------------------------------------------------

    public async Task<AiDraftResponse> DraftCourierMessageAsync(DraftMessageRequest request, CancellationToken ct = default)
    {
        var recipient = request.RecipientType == OtherMessagePartyType.Courier ? "courier (driver)" : "staff member";
        var channel = request.MessageType switch
        {
            2 => "SMS — keep it under 160 characters, no greeting fluff, get straight to the point",
            1 => "in-app message — short and friendly",
            _ => "message — short, clear and professional"
        };

        var systemPrompt =
            $"""
             You are a dispatcher at {RegionContext} writing a {channel}.
             You are writing TO a {recipient}{(string.IsNullOrWhiteSpace(request.RecipientName) ? "" : $" named {request.RecipientName}")}.

             Rewrite the dispatcher's rough note into a polished, professional message ready to send.
             - Preserve the intent and any specific facts (times, job numbers, addresses) exactly.
             - Do not invent details that aren't given.
             - Phone numbers and emails are redacted as [PHONE]/[EMAIL]; leave them as-is.
             - Return ONLY the message text. No subject line, no quotation marks, no "Here is..." preamble.
             """;

        var sb = new StringBuilder();
        if (!string.IsNullOrWhiteSpace(request.Seed))
        {
            sb.AppendLine("Dispatcher's rough note to polish:");
            sb.AppendLine(AiDataSanitizer.Sanitize(request.Seed));
        }
        else
        {
            sb.AppendLine("The dispatcher hasn't written anything yet. Draft a sensible message based on the context below.");
        }

        await AppendJobContextAsync(sb, request.JobId);
        AppendRecentMessages(sb, request.RecentMessages);

        var response = await aiClient.SendMessageAsync(
            systemPrompt,
            [new AiMessage { Role = "user", Content = sb.ToString() }],
            settings.Value.MaxTokensPerDraft,
            enableCaching: true,
            ct: ct);

        return new AiDraftResponse
        {
            Draft = response.TextContent?.Trim() ?? string.Empty,
            Usage = ToUsage(response)
        };
    }

    // ---------------------------------------------------------------------
    //  Compose email (subject + body)
    // ---------------------------------------------------------------------

    public async Task<AiEmailDraftResponse> DraftEmailAsync(DraftEmailRequest request, CancellationToken ct = default)
    {
        var systemPrompt =
            $"""
             You are a dispatcher at {RegionContext} composing an email to one or more couriers (drivers).
             You MUST call the tool `{EmitEmailDraftToolName}` with a subject and body.

             Rewrite the dispatcher's rough draft into a polished, professional email.
             - Preserve the intent and any specific facts exactly. Do not invent details.
             - If the rough draft is empty, write a sensible general email based on the recipients.
             - Phone numbers and emails are redacted as [PHONE]/[EMAIL]; leave them as-is.
             """;

        var sb = new StringBuilder();
        if (request.RecipientNames.Count > 0)
        {
            sb.AppendLine($"Recipients: {string.Join(", ", request.RecipientNames)}");
            sb.AppendLine();
        }

        sb.AppendLine("Rough subject (may be empty):");
        sb.AppendLine(AiDataSanitizer.Sanitize(request.SeedSubject));
        sb.AppendLine();
        sb.AppendLine("Rough body to polish (may be empty):");
        sb.AppendLine(AiDataSanitizer.Sanitize(request.SeedBody));

        return await SendEmailDraftRequestAsync(systemPrompt, sb.ToString(), ct);
    }

    // ---------------------------------------------------------------------
    //  POD delivery email (subject + body)
    // ---------------------------------------------------------------------

    public async Task<AiEmailDraftResponse> DraftPodEmailAsync(int jobId, CancellationToken ct = default)
    {
        var job = await jobRepository.GetSingleJobById(jobId);
        if (job == null)
        {
            return new AiEmailDraftResponse
            {
                Subject = "Proof of Delivery",
                Body = "Job not found.",
                Usage = new AiUsageInfo()
            };
        }

        var systemPrompt =
            $"""
             You are writing a Proof of Delivery (POD) notification email from {RegionContext} to a customer.
             You MUST call the tool `{EmitEmailDraftToolName}` with a subject and body.

             Write a brief, professional email confirming the delivery, using only the facts below.
             - Reference the job/booking number and any client reference.
             - Mention the delivery date/time and who signed for it if available.
             - Note that the POD report is attached.
             - Do not invent details that aren't provided. Phone numbers/emails are redacted as [PHONE]/[EMAIL].
             - Keep it to a short paragraph plus a sign-off.
             """;

        var sb = new StringBuilder();
        sb.AppendLine("--- Delivery details ---");
        sb.AppendLine($"Job/Booking no: {job.JobNo}");
        if (!string.IsNullOrWhiteSpace(job.ClientName))
        {
            sb.AppendLine($"Customer: {job.ClientName}");
        }

        if (!string.IsNullOrWhiteSpace(job.RefA))
        {
            sb.AppendLine($"Client ref: {job.RefA}");
        }

        var deliveryAddr = AiDataSanitizer.Sanitize(job.DeliveryAddress?.FullAddress ?? job.ToAddress ?? string.Empty);
        if (!string.IsNullOrWhiteSpace(deliveryAddr))
        {
            sb.AppendLine($"Delivered to: {deliveryAddr}");
        }

        if (job.CompletedTime.HasValue)
        {
            sb.AppendLine($"Delivered at: {job.CompletedTime:yyyy-MM-dd HH:mm}");
        }

        if (!string.IsNullOrWhiteSpace(job.PodName))
        {
            sb.AppendLine($"Signed by: {AiDataSanitizer.Sanitize(job.PodName)}");
        }

        if (!string.IsNullOrWhiteSpace(job.Courier))
        {
            sb.AppendLine($"Courier: {job.Courier}");
        }

        var notes = await noteRepository.GetNotesByJobIdAsync(jobId);
        var deliveryNote = notes.FirstOrDefault(n =>
            n.NoteTypeId is (int)NoteType.DeliveryNotes or (int)NoteType.ClientNote);
        if (deliveryNote != null && !string.IsNullOrWhiteSpace(deliveryNote.NoteText))
        {
            sb.AppendLine($"Delivery note: {AiDataSanitizer.Sanitize(deliveryNote.NoteText)}");
        }

        return await SendEmailDraftRequestAsync(systemPrompt, sb.ToString(), ct);
    }

    // ---------------------------------------------------------------------
    //  Job note
    // ---------------------------------------------------------------------

    public async Task<AiDraftResponse> DraftNoteAsync(DraftNoteRequest request, CancellationToken ct = default)
    {
        var (audience, tone) = NoteTypeGuidance(request.NoteTypeId);

        var systemPrompt =
            $"""
             You are a dispatcher at {RegionContext} writing a {audience}.
             {tone}

             Rewrite the dispatcher's rough note into a clear, well-formed note.
             - Preserve the intent and all specific facts (times, job numbers, names) exactly.
             - Do not invent details. Phone numbers/emails are redacted as [PHONE]/[EMAIL]; leave them as-is.
             - Return ONLY the note text. No preamble, no quotation marks.
             """;

        var sb = new StringBuilder();
        if (!string.IsNullOrWhiteSpace(request.Seed))
        {
            sb.AppendLine("Rough note to polish:");
            sb.AppendLine(AiDataSanitizer.Sanitize(request.Seed));
        }
        else
        {
            sb.AppendLine("The dispatcher hasn't written anything yet. Draft a sensible note from the context below.");
        }

        await AppendJobContextAsync(sb, request.JobId);

        var response = await aiClient.SendMessageAsync(
            systemPrompt,
            [new AiMessage { Role = "user", Content = sb.ToString() }],
            settings.Value.MaxTokensPerDraft,
            enableCaching: true,
            ct: ct);

        return new AiDraftResponse
        {
            Draft = response.TextContent?.Trim() ?? string.Empty,
            Usage = ToUsage(response)
        };
    }

    // ---------------------------------------------------------------------
    //  Helpers
    // ---------------------------------------------------------------------

    private async Task<AiEmailDraftResponse> SendEmailDraftRequestAsync(string systemPrompt, string userMessage, CancellationToken ct)
    {
        var tools = new List<AiToolDefinition>
        {
            new()
            {
                Name = EmitEmailDraftToolName,
                Description = "Emit the drafted email subject and body.",
                InputSchemaJson = EmitEmailDraftSchema
            }
        };

        var response = await aiClient.SendMessageAsync(
            systemPrompt,
            [new AiMessage { Role = "user", Content = userMessage }],
            settings.Value.MaxTokensPerDraft,
            tools,
            forceToolName: EmitEmailDraftToolName,
            enableCaching: true,
            ct: ct);

        var usage = ToUsage(response);

        var toolCall = response.ToolCalls.FirstOrDefault(t => t.ToolName == EmitEmailDraftToolName);
        if (toolCall == null || string.IsNullOrWhiteSpace(toolCall.ArgumentsJson))
        {
            return new AiEmailDraftResponse { Subject = string.Empty, Body = string.Empty, Usage = usage };
        }

        try
        {
            var parsed = JsonSerializer.Deserialize<AiEmailDraftResponse>(toolCall.ArgumentsJson, ToolJsonOptions);
            return (parsed ?? new AiEmailDraftResponse()) with { Usage = usage };
        }
        catch (JsonException)
        {
            return new AiEmailDraftResponse { Subject = string.Empty, Body = string.Empty, Usage = usage };
        }
    }

    private async Task AppendJobContextAsync(StringBuilder sb, int? jobId)
    {
        if (jobId is not > 0)
        {
            return;
        }

        var job = await jobRepository.GetSingleJobById(jobId.Value);
        if (job == null)
        {
            return;
        }

        sb.AppendLine();
        sb.AppendLine("--- Job context ---");
        sb.AppendLine($"Job no: {job.JobNo}");
        if (!string.IsNullOrWhiteSpace(job.ClientName))
        {
            sb.AppendLine($"Client: {job.ClientName}");
        }

        if (!string.IsNullOrWhiteSpace(job.Status ?? job.StatusName))
        {
            sb.AppendLine($"Status: {job.Status ?? job.StatusName}");
        }

        var fromAddr = AiDataSanitizer.Sanitize(job.PickupAddress?.FullAddress ?? job.From ?? string.Empty);
        var toAddr = AiDataSanitizer.Sanitize(job.DeliveryAddress?.FullAddress ?? job.ToAddress ?? string.Empty);
        if (!string.IsNullOrWhiteSpace(fromAddr))
        {
            sb.AppendLine($"From: {fromAddr}");
        }

        if (!string.IsNullOrWhiteSpace(toAddr))
        {
            sb.AppendLine($"To: {toAddr}");
        }

        if (!string.IsNullOrWhiteSpace(job.Courier))
        {
            sb.AppendLine($"Courier: {job.Courier}");
        }
    }

    private static void AppendRecentMessages(StringBuilder sb, List<string> recentMessages)
    {
        if (recentMessages is not { Count: > 0 })
        {
            return;
        }

        sb.AppendLine();
        sb.AppendLine("--- Recent conversation (oldest first) ---");
        foreach (var line in recentMessages.TakeLast(8))
        {
            sb.AppendLine(AiDataSanitizer.Sanitize(line));
        }
    }

    private static (string audience, string tone) NoteTypeGuidance(int noteTypeId) =>
        (NoteType)noteTypeId switch
        {
            NoteType.ClientNote => ("client-facing note", "Audience: the customer. Use courteous, customer-safe language. No internal jargon."),
            NoteType.AgentUpdate => ("note to a partner agent", "Audience: a partner agent. Professional and concise."),
            NoteType.FlightUpdate => ("flight update note", "Factual update about the flight/transport leg."),
            NoteType.ConsignmentNote => ("consignment note", "Factual consignment detail."),
            NoteType.PickupNotes => ("pickup instructions note", "Clear instructions for the pickup."),
            NoteType.DeliveryNotes => ("delivery instructions note", "Clear instructions for the delivery."),
            _ => ("internal note", "Audience: dispatch staff. Concise operational shorthand is fine.")
        };

    private static AiUsageInfo ToUsage(AiClientResponse response) => new()
    {
        InputTokens = response.InputTokens,
        OutputTokens = response.OutputTokens
    };
}
