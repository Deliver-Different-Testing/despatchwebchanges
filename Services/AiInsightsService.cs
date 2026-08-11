#nullable enable annotations
using System.Globalization;
using System.Text;
using System.Text.Json;
using DespatchWeb.Helpers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.Response;
using Microsoft.Extensions.Options;
using Serilog;

namespace DespatchWeb.Services;

public sealed class AiInsightsService(
    IAiClientService aiClient,
    INoteRepository noteRepository,
    IJobQueryRepository jobRepository,
    IAccessorialChargeService accessorialChargeService,
    IRateJobService rateJobService,
    IJobChangeRequestService changeRequestService,
    ITenantInfoService tenantInfo,
    IOptions<AnthropicSettings> settings) : IAiInsightsService
{
    private const decimal OutlierThresholdPercent = 15m;

    // ---- Blockers ---------------------------------------------------------

    private const string EmitBlockersTool = "emit_blockers";

    private const string EmitBlockersSchema = """
                                              {
                                                "type": "object",
                                                "properties": {
                                                  "blockers": {
                                                    "type": "array",
                                                    "items": {
                                                      "type": "object",
                                                      "properties": {
                                                        "tag": { "type": "string", "description": "Short kebab-case blocker name, e.g. 'call-before-delivery', 'gate-code-needed', 'tail-lift-required', 'dog-on-property', 'dg-handling'." },
                                                        "severity": { "type": "string", "enum": ["Info", "Caution", "Urgent"], "description": "Operational urgency." },
                                                        "evidence": { "type": "string", "description": "Quote the note phrase that supports this blocker." },
                                                        "actionRequired": { "type": "boolean", "description": "True if the dispatcher/courier must do something before pickup/delivery." }
                                                      },
                                                      "required": ["tag", "severity", "evidence", "actionRequired"]
                                                    }
                                                  },
                                                  "summary": { "type": "string", "description": "One-line summary, e.g. '3 blockers: call-before, gate-code, tail-lift'." },
                                                  "severity": { "type": "string", "enum": ["Ok", "Info", "Caution", "Urgent", "Critical"], "description": "Highest blocker severity, or Ok if none." }
                                                },
                                                "required": ["blockers", "summary", "severity"]
                                              }
                                              """;

    // ---- Pricing ----------------------------------------------------------

    private const string EmitSuggestionsTool = "emit_accessorial_suggestions";

    private const string EmitSuggestionsSchema = """
                                                 {
                                                   "type": "object",
                                                   "properties": {
                                                     "suggestions": {
                                                       "type": "array",
                                                       "items": {
                                                         "type": "object",
                                                         "properties": {
                                                           "accessorialChargeId": { "type": "integer", "description": "MUST be an id from the supplied catalog." },
                                                           "name": { "type": "string", "description": "The catalog charge name." },
                                                           "reason": { "type": "string", "description": "Why it applies, citing the specific job flag or note phrase." },
                                                           "suggestedInputValue": { "type": ["number", "null"], "description": "For per-unit/quote charges a value if implied by the notes (e.g. waiting minutes); otherwise null." }
                                                         },
                                                         "required": ["accessorialChargeId", "name", "reason"]
                                                       }
                                                     }
                                                   },
                                                   "required": ["suggestions"]
                                                 }
                                                 """;

    // ---- Change-request triage -------------------------------------------

    private const string EmitTriageTool = "emit_triage";

    private const string EmitTriageSchema = """
                                            {
                                              "type": "object",
                                              "properties": {
                                                "recommendedAction": { "type": "string", "enum": ["approve", "reject", "clarify"], "description": "Advisory only — a human approver decides." },
                                                "confidence": { "type": "number", "description": "0.0 to 1.0." },
                                                "rationale": { "type": "string", "description": "One sentence explaining the recommendation." },
                                                "riskFactors": { "type": "array", "items": { "type": "string" }, "description": "Short risk/consideration phrases. Empty if none." }
                                              },
                                              "required": ["recommendedAction", "confidence", "rationale", "riskFactors"]
                                            }
                                            """;

    private static readonly JsonSerializerOptions ToolJsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    private string RegionContext => tenantInfo.IsUsTenant()
        ? "a US-based courier dispatch company"
        : "a New Zealand courier dispatch company";

    public async Task<ExtractBlockersResponse> ExtractBlockersAsync(int jobId, CancellationToken ct = default)
    {
        var notes = await noteRepository.GetNotesByJobIdAsync(jobId);
        if (notes.Count == 0)
        {
            return new ExtractBlockersResponse
            {
                Blockers = [],
                Summary = "No notes to analyse.",
                Severity = SummarySeverity.Ok,
                Usage = new AiUsageInfo()
            };
        }

        var systemPrompt =
            $"""
             You extract delivery/pickup blockers and operational constraints from job notes for {RegionContext}.
             A "blocker" is anything the dispatcher or courier must know or act on before pickup/delivery
             (e.g. call before delivery, gate/access code, tail-lift required, dangerous animal, DG handling,
             signature required, cannot leave unattended, time-window restriction).

             Rules:
             - Only extract blockers that are clearly stated or strongly implied by the notes. Do NOT invent any.
             - severity: Urgent = safety/legal/time-critical; Caution = access/special handling; Info = optional instruction.
             - evidence MUST quote the supporting note text. Phone/email are redacted as [PHONE]/[EMAIL]; leave them.
             - If there are no real blockers, return an empty list and severity Ok.
             You MUST call the tool `{EmitBlockersTool}`.
             """;

        var sb = new StringBuilder();
        sb.AppendLine("Extract blockers from these job notes:");
        sb.AppendLine();
        AppendNotes(sb, notes);

        var (json, usage) =
            await SendToolRequestAsync(systemPrompt, sb.ToString(), EmitBlockersTool, EmitBlockersSchema, ct);
        if (json == null)
        {
            return new ExtractBlockersResponse
                { Blockers = [], Summary = "Unable to analyse notes.", Severity = SummarySeverity.Ok, Usage = usage };
        }

        try
        {
            var parsed = JsonSerializer.Deserialize<ExtractBlockersResponse>(json, ToolJsonOptions);
            return (parsed ?? new ExtractBlockersResponse()) with { Usage = usage };
        }
        catch (JsonException)
        {
            return new ExtractBlockersResponse
                { Blockers = [], Summary = "Unable to parse blockers.", Severity = SummarySeverity.Ok, Usage = usage };
        }
    }

    public async Task<PricingAnalysisResponse> AnalyzePricingAsync(int jobId, int accessorialChargeGroupId,
        CancellationToken ct = default)
    {
        var job = await jobRepository.GetSingleJobById(jobId);
        if (job == null)
        {
            return new PricingAnalysisResponse { Anomaly = null, Suggestions = [], Usage = new AiUsageInfo() };
        }

        var anomaly = await ComputeAnomalyAsync(jobId, job.Charge);

        var catalog = accessorialChargeGroupId > 0
            ? await accessorialChargeService.GetAvailableChargesAsync(accessorialChargeGroupId, jobId)
            : [];

        if (catalog.Count == 0)
        {
            return new PricingAnalysisResponse { Anomaly = anomaly, Suggestions = [], Usage = new AiUsageInfo() };
        }

        var notes = await noteRepository.GetNotesByJobIdAsync(jobId);

        var systemPrompt =
            $"""
             You suggest which accessorial (additional) charges apply to a courier job for {RegionContext}.
             You are given the job's flags + notes and a CATALOG of available charges.

             Rules:
             - Only suggest charges whose accessorialChargeId appears in the supplied catalog. Never invent an id.
             - Suggest a charge only when a job flag or note clearly supports it (e.g. tail-lift flag, "waited 40 min",
               "up three flights of stairs", private residence). Cite the trigger in `reason`.
             - Do not suggest charges already marked applied. When unsure, omit it.
             - You MUST call the tool `{EmitSuggestionsTool}`. Return an empty list if nothing clearly applies.
             """;

        var sb = new StringBuilder();
        AppendPricingContext(sb, job);
        AppendNotes(sb, notes);
        sb.AppendLine("--- Available charge catalog (suggest only from these ids) ---");
        foreach (var c in catalog.Where(c => !c.AlreadyApplied))
        {
            var desc = string.IsNullOrWhiteSpace(c.Description) ? "" : $" — {c.Description}";
            sb.AppendLine($"[id {c.AccessorialChargeId}] {c.Name} ({c.ChargeType}){desc}");
        }

        var (json, usage) =
            await SendToolRequestAsync(systemPrompt, sb.ToString(), EmitSuggestionsTool, EmitSuggestionsSchema, ct);

        var suggestions = new List<AccessorialSuggestion>();
        if (json == null)
        {
            return new PricingAnalysisResponse { Anomaly = anomaly, Suggestions = suggestions, Usage = usage };
        }

        try
        {
            var wrapper = JsonSerializer.Deserialize<SuggestionWrapper>(json, ToolJsonOptions);
            var allowedIds = catalog.Select(c => c.AccessorialChargeId).ToHashSet();
            // Guard: drop anything the model hallucinated outside the catalog.
            suggestions =
            [
                .. (wrapper?.Suggestions ?? [])
                .Where(s => allowedIds.Contains(s.AccessorialChargeId))
            ];
        }
        catch (JsonException e)
        {
            Log.Warning(e, "Failed to parse accessorial suggestions for job {JobId}", jobId);
        }

        return new PricingAnalysisResponse { Anomaly = anomaly, Suggestions = suggestions, Usage = usage };
    }

    public async Task<ChangeRequestTriageResponse> TriageChangeRequestAsync(int requestId, int jobId,
        CancellationToken ct = default)
    {
        var requests = await changeRequestService.ListForJobAsync(jobId, ct);
        var request = requests.FirstOrDefault(r => r.Id == requestId);
        if (request == null)
        {
            return new ChangeRequestTriageResponse
            {
                RecommendedAction = "clarify",
                Confidence = 0,
                Rationale = "Change request not found.",
                RiskFactors = [],
                Usage = new AiUsageInfo()
            };
        }

        var job = await jobRepository.GetSingleJobById(jobId);

        var systemPrompt =
            $"""
             You are an advisory assistant helping an approver triage a job change request for {RegionContext}.
             Your output is a SUGGESTION ONLY — a human approver always makes the final decision and clicks approve/reject.

             Recommend one of: approve, reject, clarify (ask the requester for more info).
             Consider: whether the requested change is reasonable for the field, the size of any rate change,
             whether the stated reason justifies it, and the request's age. Be conservative on commercial (rate)
             changes — recommend clarify if the reason is thin or the rate move is large and unexplained.
             Do not invent facts. You MUST call the tool `{EmitTriageTool}`.
             """;

        var sb = new StringBuilder();
        sb.AppendLine("--- Change request ---");
        sb.AppendLine($"Field: {request.FieldName}");
        sb.AppendLine($"Current value: {AiDataSanitizer.Sanitize(request.CurrentValue ?? "(none)")}");
        sb.AppendLine($"Requested value: {AiDataSanitizer.Sanitize(request.RequestedValue ?? "(none)")}");
        sb.AppendLine($"Reason: {AiDataSanitizer.Sanitize(request.Reason ?? "(none given)")}");
        sb.AppendLine($"Requested by: {request.RequestingPartyType}");
        sb.AppendLine($"Approval mode: {request.ApprovalMode}");
        sb.AppendLine($"Requires commercial refresh: {request.RequiresCommercialRefresh}");
        if (request.OldCommercialAmount.HasValue || request.NewCommercialAmount.HasValue)
        {
            sb.AppendLine(
                $"Commercial amount: {request.OldCommercialAmount?.ToString("N2", CultureInfo.InvariantCulture) ?? "?"} -> {request.NewCommercialAmount?.ToString("N2", CultureInfo.InvariantCulture) ?? "?"}");
        }

        sb.AppendLine($"Requested at (UTC): {request.RequestedAt:yyyy-MM-dd HH:mm}");
        if (job != null)
        {
            sb.AppendLine();
            sb.AppendLine(
                $"Job {job.JobNo} — status {job.Status ?? job.StatusName ?? "?"}, client {job.ClientName ?? "?"}.");
        }

        var (json, usage) =
            await SendToolRequestAsync(systemPrompt, sb.ToString(), EmitTriageTool, EmitTriageSchema, ct);
        if (json == null)
        {
            return new ChangeRequestTriageResponse
            {
                RecommendedAction = "clarify",
                Confidence = 0,
                Rationale = "Unable to generate a recommendation.",
                RiskFactors = [],
                Usage = usage
            };
        }

        try
        {
            var parsed = JsonSerializer.Deserialize<ChangeRequestTriageResponse>(json, ToolJsonOptions);
            return (parsed ?? new ChangeRequestTriageResponse { RecommendedAction = "clarify" }) with { Usage = usage };
        }
        catch (JsonException)
        {
            return new ChangeRequestTriageResponse
            {
                RecommendedAction = "clarify",
                Confidence = 0,
                Rationale = "Unable to parse the recommendation.",
                RiskFactors = [],
                Usage = usage
            };
        }
    }

    private async Task<PricingAnomaly?> ComputeAnomalyAsync(int jobId, decimal? storedCharge)
    {
        if (storedCharge is not > 0)
        {
            return null;
        }

        try
        {
            ApiRerate rerate;
            if (tenantInfo.IsUsTenant())
            {
                var dto = await jobRepository.GetJobDetailsForRatingAsync(jobId);
                rerate = await rateJobService.GetJobRateUsAsync(dto);
            }
            else
            {
                var dto = await jobRepository.GetJobDetailsForRatingNzAsync(jobId, false);
                rerate = await rateJobService.GetJobRateNzAsync(dto);
            }

            if (rerate.Rate <= 0)
            {
                return null;
            }

            var stored = storedCharge.Value;
            var delta = Math.Round((stored - rerate.Rate) / rerate.Rate * 100m, 1);
            return new PricingAnomaly
            {
                StoredCharge = stored,
                RecomputedRate = rerate.Rate,
                DeltaPercent = delta,
                IsOutlier = Math.Abs(delta) > OutlierThresholdPercent
            };
        }
        catch (Exception e)
        {
            // Re-rating (esp. the external NZ API) can fail; treat as "no anomaly", never block suggestions.
            Log.Warning(e, "Pricing re-rate failed for job {JobId}; skipping anomaly", jobId);
            return null;
        }
    }

    // ---- Helpers ----------------------------------------------------------

    private async Task<(string? Json, AiUsageInfo Usage)> SendToolRequestAsync(
        string systemPrompt, string userMessage, string toolName, string schema, CancellationToken ct)
    {
        var tools = new List<AiToolDefinition>
        {
            new()
            {
                Name = toolName, Description = $"Emit the structured result for {toolName}.", InputSchemaJson = schema
            }
        };

        var response = await aiClient.SendMessageAsync(
            systemPrompt,
            [new AiMessage { Role = "user", Content = userMessage }],
            settings.Value.MaxTokensPerSummary,
            tools,
            forceToolName: toolName,
            enableCaching: true,
            cacheResponse: true,
            ct: ct);

        var usage = AiUsageInfo.From(response);
        var toolCall = response.ToolCalls.FirstOrDefault(t => t.ToolName == toolName);
        return (toolCall?.ArgumentsJson, usage);
    }

    private static void AppendNotes(StringBuilder sb, IReadOnlyList<TucNoteViewModel> notes)
    {
        if (notes.Count == 0)
        {
            return;
        }

        sb.AppendLine($"--- Notes ({notes.Count}) ---");
        foreach (var note in notes.OrderBy(n => n.CreatedDate).TakeLast(25))
        {
            var important = note.IsImportant ? " IMPORTANT" : string.Empty;
            sb.AppendLine(
                $"({note.NoteTypeName}{important}) {AiDataSanitizer.Sanitize(note.NoteText ?? string.Empty)}");
        }

        sb.AppendLine();
    }

    private static void AppendPricingContext(StringBuilder sb, JobViewModel job)
    {
        sb.AppendLine("--- Job ---");
        sb.AppendLine($"Job {job.JobNo}; charge {job.Charge?.ToString("N2", CultureInfo.InvariantCulture) ?? "?"}.");
        var flags = new List<string>();
        if (job.TailLiftPu)
        {
            flags.Add("tail-lift at pickup");
        }

        if (job.TailLiftDo)
        {
            flags.Add("tail-lift at delivery");
        }

        if (job.DeliverToPrivateRes)
        {
            flags.Add("delivery to private residence");
        }

        if (job.DgDocumentation == true)
        {
            flags.Add("dangerous goods documentation");
        }

        if (job.Truck == true)
        {
            flags.Add("truck");
        }

        if (job.Van)
        {
            flags.Add("van");
        }

        if (job.Weight is > 0)
        {
            flags.Add($"weight {job.Weight}");
        }

        if (job.Items > 0)
        {
            flags.Add($"{job.Items} item(s)");
        }

        if (job.PalletInfo is { Count: > 0 } pallets)
        {
            flags.Add($"{pallets.Count} pallet row(s)");
        }

        sb.AppendLine(flags.Count > 0 ? "Flags: " + string.Join(", ", flags) : "Flags: none");
        sb.AppendLine();
    }

    private sealed record SuggestionWrapper(List<AccessorialSuggestion> Suggestions);
}