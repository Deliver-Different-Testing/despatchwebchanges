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
    IMessageRepository messageRepository,
    ITenantInfoService tenantInfo,
    IOptions<AnthropicSettings> settings) : IAiInsightsService
{
    private const decimal OutlierThresholdPercent = 15m;

    // ---- Blockers ---------------------------------------------------------

    private const string EmitBlockersTool = "emit_blockers";

    private const string EmitBlockersDescription =
        "Returns the delivery and pickup blockers found in this job's notes, rendered as tag chips on the "
        + "job card with the quoted note text behind each. A blocker is anything the dispatcher or courier "
        + "must know or act on before pickup or delivery: call-before-delivery, access or gate codes, "
        + "tail-lift and equipment needs, hazards on site, dangerous-goods handling, signature and "
        + "leave-unattended rules, time-window restrictions. `tag` is a short kebab-case name reused across "
        + "jobs, so prefer a wording that would match other jobs over a novel one. `evidence` quotes the "
        + "supporting note text verbatim, [PHONE]/[EMAIL] placeholders included, because it is shown to the "
        + "dispatcher as the justification. `actionRequired` is true only when someone must do something "
        + "before the job can proceed, not merely be aware of it. Return an empty list and severity Ok when "
        + "the notes contain no real blocker.";

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

    private const string EmitSuggestionsDescription =
        "Returns accessorial charges to propose adding to this job. The dispatcher sees each as a suggestion "
        + "they accept or dismiss, so a wrong suggestion costs their attention and a missed one costs revenue. "
        + "`accessorialChargeId` must come from the catalog supplied in this request; ids outside it are "
        + "discarded before the dispatcher ever sees them. `reason` cites the specific job flag or note phrase "
        + "that triggers the charge, because that text is displayed next to the suggestion. "
        + "`suggestedInputValue` carries the quantity for per-unit or quoted charges when the notes imply one "
        + "(waiting minutes, flights of stairs), and is null otherwise. Return an empty list when nothing in "
        + "the job clearly supports a charge.";

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

    private const string EmitTriageDescription =
        "Returns an advisory recommendation on one pending job change request, shown as a badge beside the "
        + "request in the approval queue. A human approver always makes the final decision and clicks approve "
        + "or reject; this only pre-sorts their queue. `recommendedAction` is approve, reject, or clarify (ask "
        + "the requester for more information). `confidence` runs 0.0 to 1.0 and should fall when the stated "
        + "reason is thin or the commercial impact is large and unexplained. `rationale` is the single sentence "
        + "the approver reads. `riskFactors` name what could go wrong if this were approved; return an empty "
        + "array when there are none.";

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
             """;

        var sb = new StringBuilder();
        sb.AppendLine("Extract blockers from these job notes:");
        sb.AppendLine();
        AppendNotes(sb, notes);

        var (json, usage) =
            await SendToolRequestAsync(systemPrompt, sb.ToString(), EmitBlockersTool, EmitBlockersDescription,
                EmitBlockersSchema, ct);
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
             - Return an empty list if nothing clearly applies.
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
            await SendToolRequestAsync(systemPrompt, sb.ToString(), EmitSuggestionsTool, EmitSuggestionsDescription,
                EmitSuggestionsSchema, ct);

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
             Do not invent facts.
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
            await SendToolRequestAsync(systemPrompt, sb.ToString(), EmitTriageTool, EmitTriageDescription,
                EmitTriageSchema, ct);
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

    /// <summary>
    /// Insights default to the judgment tier because they drive money and safety. The
    /// exception is inbox triage, which is classification firing on every inbox open —
    /// hence the task class being a parameter rather than a constant.
    /// </summary>
    private async Task<(string? Json, AiUsageInfo Usage)> SendToolRequestAsync(
        string systemPrompt, string userMessage, string toolName, string toolDescription, string schema,
        CancellationToken ct, AiTaskClass taskClass = AiTaskClass.Judgment)
    {
        var tools = new List<AiToolDefinition>
        {
            new() { Name = toolName, Description = toolDescription, InputSchemaJson = schema }
        };

        var profile = settings.Value.For(taskClass);

        var response = await aiClient.SendMessageAsync(
            taskClass,
            systemPrompt,
            [new AiMessage { Role = "user", Content = userMessage }],
            profile.MaxTokens,
            tools,
            forceToolName: toolName,
            enableCaching: true,
            cacheResponse: true,
            ct: ct);

        var usage = AiUsageInfo.From(response);

        if (response.WasTruncated)
        {
            Log.Warning("AI {ToolName} hit the {MaxTokens}-token ceiling before finishing",
                toolName, profile.MaxTokens);
            return (null, usage);
        }

        if (response.WasRefused)
        {
            Log.Warning("AI {ToolName} declined by the model ({Category})",
                toolName, response.RefusalCategory ?? "unspecified");
            return (null, usage);
        }

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

    // ---- Inbox triage -----------------------------------------------------

    private const string EmitInboxTriageTool = "emit_inbox_triage";

    /// <summary>Enough to judge a message; beyond it the sender is telling a story.</summary>
    private const int MaxMessageCharacters = 400;

    private const string EmitInboxTriageDescription =
        "Returns one triage row per open conversation in the courier and staff message inbox, rendered as a "
        + "chip in a list the dispatcher is about to work down. Its only job is ordering their attention — "
        + "they read every message themselves before replying. `suggestedResponseId` must be an id from the "
        + "quick-response catalog in this request; ids outside it are discarded before the dispatcher sees "
        + "them, and null is always a better answer than a near-miss. Return one entry per conversation index "
        + "supplied, in the same order, none added and none dropped.";

    private const string EmitInboxTriageSchema = """
                                                 {
                                                   "type": "object",
                                                   "properties": {
                                                     "conversations": {
                                                       "type": "array",
                                                       "items": {
                                                         "type": "object",
                                                         "properties": {
                                                           "conversationIndex": { "type": "integer", "description": "The [n] index the conversation was supplied under. One row per index, in the same order." },
                                                           "intent": { "type": "string", "enum": ["jobQuery", "statusUpdate", "problem", "availability", "pay", "admin", "other"], "description": "What the sender wants. Choose 'other' rather than forcing a poor fit." },
                                                           "urgency": { "type": "string", "enum": ["critical", "urgent", "soon", "routine"], "description": "critical = someone is stuck, goods are at risk, or a deadline passes within the hour. routine = no reply is needed today." },
                                                           "summary": { "type": "string", "maxLength": 80, "description": "At most twelve words, the ask itself. 'Needs gate code for Wiri drop', not 'The driver is asking about access'." },
                                                           "jobReferences": { "type": "array", "items": { "type": "string" }, "description": "Job numbers or ids the message names, copied exactly. Empty when it names none." },
                                                           "suggestedResponseId": { "type": ["integer", "null"], "description": "An id from the supplied quick-response catalog that answers this message as written, or null." }
                                                         },
                                                         "required": ["conversationIndex", "intent", "urgency", "summary", "jobReferences", "suggestedResponseId"]
                                                       }
                                                     }
                                                   },
                                                   "required": ["conversations"]
                                                 }
                                                 """;

    private string InboxTriageSystemPrompt =>
        $"""
         You triage a courier and staff message inbox for {RegionContext}.

         You are given the most recent message in each open conversation. The dispatcher
         sees your output as one chip per conversation in a list they are about to work
         down, so your only job is ordering their attention.

         Per conversation:
           intent — what the sender wants, from the fixed list. Choose `other` rather
             than forcing a poor fit.
           urgency — how long this can wait. Critical means someone is stuck, goods are
             at risk, or a deadline passes within the hour. Routine means no reply is
             needed today.
           summary — at most twelve words, the ask itself. Write "Needs gate code for
             Wiri drop", not "The driver is asking about access".
           jobReferences — the job numbers or ids the message names, copied exactly.
             Empty when it names none.
           suggestedResponseId — the id of a quick response from the catalog in the user
             message that answers this message as written, or null.

         Rules:
         - One entry per conversation index supplied, in the same order, none added or
           dropped.
         - Judge only the message text supplied. Do not assume history you were not
           given.
         - Phone numbers and emails are redacted as [PHONE] and [EMAIL]. Leave them.
         - A message you cannot read confidently gets intent `other`, urgency `routine`,
           and a summary naming what is unclear.
         """;

    public async Task<InboxTriageResponse> TriageInboxAsync(CancellationToken ct = default)
    {
        var conversations = await messageRepository.GetRecentListAsync();
        if (conversations is not { Count: > 0 })
        {
            return new InboxTriageResponse { Conversations = [], Usage = new AiUsageInfo() };
        }

        var catalog = await messageRepository.GetSavedQuickResponsesAsync() ?? [];

        var sb = new StringBuilder();
        sb.AppendLine("--- Open conversations (one row per index) ---");
        for (var i = 0; i < conversations.Count; i++)
        {
            var c = conversations[i];
            var message = AiDataSanitizer.Sanitize(c.LastMessage ?? string.Empty);
            if (message.Length > MaxMessageCharacters)
            {
                message = message[..MaxMessageCharacters];
            }

            sb.AppendLine(
                $"[{i}] from {c.OtherPartyName} ({c.OtherPartyType}), {c.UnreadCount} unread, " +
                $"last {FormatAge(c.LastMessageTime)}: {message}");
        }

        sb.AppendLine();
        sb.AppendLine("--- Quick response catalog (suggest only from these ids) ---");
        if (catalog.Count == 0)
        {
            sb.AppendLine("(none saved — always return null for suggestedResponseId)");
        }
        else
        {
            foreach (var r in catalog)
            {
                sb.AppendLine($"[id {r.Id}] {r.Text}");
            }
        }

        var (json, usage) = await SendToolRequestAsync(
            InboxTriageSystemPrompt, sb.ToString(), EmitInboxTriageTool, EmitInboxTriageDescription,
            EmitInboxTriageSchema, ct, AiTaskClass.Drafting);

        if (json == null)
        {
            return new InboxTriageResponse { Conversations = [], Usage = usage };
        }

        InboxTriageWrapper wrapper;
        try
        {
            wrapper = JsonSerializer.Deserialize<InboxTriageWrapper>(json, ToolJsonOptions);
        }
        catch (JsonException e)
        {
            Log.Warning(e, "Failed to parse inbox triage");
            return new InboxTriageResponse { Conversations = [], Usage = usage };
        }

        var allowedResponseIds = catalog.Select(r => r.Id).ToHashSet();

        var rows = new List<InboxTriageItem>();
        foreach (var row in wrapper?.Conversations ?? [])
        {
            // A row pointing outside the list we supplied belongs to no conversation, so
            // there is nowhere on screen to render it.
            if (row.ConversationIndex < 0 || row.ConversationIndex >= conversations.Count)
            {
                continue;
            }

            var conversation = conversations[row.ConversationIndex];

            rows.Add(new InboxTriageItem
            {
                OtherPartyId = conversation.OtherPartyId,
                OtherPartyType = conversation.OtherPartyType,
                Intent = row.Intent,
                Urgency = row.Urgency,
                Summary = row.Summary,
                JobReferences = row.JobReferences ?? [],
                // Guard: a near-miss id would pre-select the wrong canned reply.
                SuggestedResponseId = allowedResponseIds.Contains(row.SuggestedResponseId ?? 0)
                    ? row.SuggestedResponseId
                    : null
            });
        }

        return new InboxTriageResponse { Conversations = rows, Usage = usage };
    }

    // ---- Price explanation ------------------------------------------------

    private const string EmitPriceExplanationTool = "emit_price_explanation";

    private const string EmitPriceExplanationDescription =
        "Returns a plain-English account of why one courier job cost what it did, read by a dispatcher who is "
        + "on the phone to the customer asking. Every number is supplied in this request — this turns rate "
        + "lines into sentences and never recalculates. `lines` carries the component name verbatim and the "
        + "amount exactly as given. `queryRisks` names the components a customer is most likely to dispute "
        + "together with the evidence in this job that answers the dispute. `caveats` is for anything the "
        + "data does not let you explain, such as a manual override or a component with no matching job "
        + "detail.";

    private const string EmitPriceExplanationSchema = """
                                                      {
                                                        "type": "object",
                                                        "properties": {
                                                          "headline": { "type": "string", "maxLength": 160, "description": "One sentence giving the total and the single biggest reason it is that size." },
                                                          "lines": {
                                                            "type": "array",
                                                            "items": {
                                                              "type": "object",
                                                              "properties": {
                                                                "name": { "type": "string", "description": "The component name from the data, verbatim." },
                                                                "amount": { "type": "number", "description": "Copied exactly from the data. Never recomputed and never rounded." },
                                                                "explanation": { "type": "string", "description": "What the customer was charged for and what drove it, in words they would recognise." }
                                                              },
                                                              "required": ["name", "amount", "explanation"]
                                                            },
                                                            "description": "One entry per charge component, largest amount first."
                                                          },
                                                          "queryRisks": {
                                                            "type": "array",
                                                            "maxItems": 3,
                                                            "items": {
                                                              "type": "object",
                                                              "properties": {
                                                                "component": { "type": "string", "description": "The component a customer is most likely to dispute." },
                                                                "evidence": { "type": "string", "description": "The evidence in this job that answers the dispute, e.g. 'driver on site 10:05, signed 10:50'." }
                                                              },
                                                              "required": ["component", "evidence"]
                                                            },
                                                            "description": "Empty when the price is unremarkable."
                                                          },
                                                          "caveats": {
                                                            "type": "array",
                                                            "items": { "type": "string" },
                                                            "description": "Anything the data does not let you explain. Empty when none."
                                                          }
                                                        },
                                                        "required": ["headline", "lines", "queryRisks", "caveats"]
                                                      }
                                                      """;

    private string CurrencyExample => tenantInfo.IsUsTenant() ? "$145" : "$145 NZD";

    private string PriceExplanationSystemPrompt =>
        $"""
         You explain a courier job's price to the dispatcher who has to defend it, for
         {RegionContext}.

         They are on the phone to a customer asking why this job cost what it did. Every
         number you need is in the user message. You are turning rate lines into
         sentences, not recalculating anything.

         FIELDS
           headline — one sentence giving the total and the single biggest reason it is
             that size, e.g. "{CurrencyExample} — a 42 km urgent run, with waiting time
             the largest add-on".
           lines — one entry per charge component, largest amount first. `name` is the
             component name from the data, verbatim. `amount` is copied exactly.
             `explanation` says in plain words what the customer was charged for and what
             drove it.
           queryRisks — the components a customer is most likely to dispute, each with
             the evidence in this job that answers the dispute ("Waiting 45 min — driver
             on site 10:05, signed 10:50"). Empty when the price is unremarkable.
           caveats — anything the data does not let you explain: a manual override, a
             component with no matching job detail, a zero-amount line. Empty when none.

         Rules:
         - Never state a number the data does not contain, never round one it does, and
           never add the components up yourself. The total is given.
         - Write currency as {CurrencyExample}.
         - Say "manually priced" rather than inventing a rationale when a component is
           flagged as an override.
         - Write for reading aloud: no markdown, no jargon a customer would not
           recognise, no sentence longer than one breath.
         """;

    public async Task<PriceExplanationResponse> ExplainPriceAsync(
        int jobId, bool isPrebook = false, bool isArchived = false, CancellationToken ct = default)
    {
        var components = await jobRepository.GetJobPriceBreakdownAsync(jobId, isPrebook, isArchived);
        if (components is not { Count: > 0 })
        {
            return new PriceExplanationResponse
            {
                Headline = "This job has no price breakdown to explain.",
                Usage = new AiUsageInfo()
            };
        }

        var job = await jobRepository.GetSingleJobById(jobId);

        var sb = new StringBuilder();
        if (job != null)
        {
            AppendPricingContext(sb, job);
        }

        sb.AppendLine("--- Price components ---");
        foreach (var c in components.OrderByDescending(c => c.Amount))
        {
            var cost = c.CostAmount is { } costAmount ? $", cost {costAmount:0.00}" : string.Empty;
            sb.AppendLine($"{c.Name}: {c.Amount:0.00}{cost}");
        }

        sb.AppendLine($"Total: {components.Sum(c => c.Amount):0.00}");
        sb.AppendLine();

        var notes = await noteRepository.GetNotesByJobIdAsync(jobId);
        AppendNotes(sb, notes);

        var (json, usage) = await SendToolRequestAsync(
            PriceExplanationSystemPrompt, sb.ToString(), EmitPriceExplanationTool,
            EmitPriceExplanationDescription, EmitPriceExplanationSchema, ct);

        if (json == null)
        {
            return new PriceExplanationResponse
            {
                Headline = "Auto-mate could not explain this price.",
                Usage = usage
            };
        }

        try
        {
            var parsed = JsonSerializer.Deserialize<PriceExplanationResponse>(json, ToolJsonOptions);
            return (parsed ?? new PriceExplanationResponse()) with { Usage = usage };
        }
        catch (JsonException e)
        {
            Log.Warning(e, "Failed to parse price explanation for job {JobId}", jobId);
            return new PriceExplanationResponse
            {
                Headline = "Auto-mate returned an answer that could not be read.",
                Usage = usage
            };
        }
    }

    /// <summary>
    /// Elapsed wording rather than a timestamp: the model is ranking urgency, and a
    /// clock time makes it do date arithmetic it has no reliable way to get right.
    /// </summary>
    private string FormatAge(DateTime when)
    {
        var age = tenantInfo.GetCurrentTenantTime() - when;
        if (age < TimeSpan.Zero)
        {
            return "just now";
        }

        return age.TotalMinutes < 60
            ? $"{(int)age.TotalMinutes}m ago"
            : age.TotalHours < 48
                ? $"{(int)age.TotalHours}h ago"
                : $"{(int)age.TotalDays}d ago";
    }

    private sealed record InboxTriageWrapper(List<InboxTriageRow> Conversations);

    private sealed record InboxTriageRow
    {
        public int ConversationIndex { get; init; }
        public MessageIntent Intent { get; init; }
        public MessageUrgency Urgency { get; init; }
        public string Summary { get; init; }
        public List<string> JobReferences { get; init; }
        public int? SuggestedResponseId { get; init; }
    }

    private sealed record SuggestionWrapper(List<AccessorialSuggestion> Suggestions);
}
