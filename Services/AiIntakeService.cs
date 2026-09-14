using System.Globalization;
using System.Text;
using System.Text.Json;
using DespatchWeb.Helpers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Models.Response;
using Microsoft.Extensions.Options;
using Serilog;

namespace DespatchWeb.Services;

/// <summary>
/// Turns free text the operator supplies into structured input for a form they then
/// review and submit. Nothing here creates a job or runs a search — both members fill
/// a form and hand it back.
///
/// The model never returns an id. It returns the words the source used and this service
/// resolves them against the application's own lists, so a name read wrongly shows up as
/// unmatched rather than as a confident link to the wrong record.
/// </summary>
public sealed class AiIntakeService(
    IAiClientService aiClient,
    IClientRepository clientRepository,
    IJobQueryRepository jobRepository,
    ICourierRepository courierRepository,
    ITenantInfoService tenantInfo,
    IOptions<AnthropicSettings> settings) : IAiIntakeService
{
    private const string EmitJobIntakeTool = "emit_job_intake";
    private const string EmitSearchCriteriaTool = "emit_search_criteria";

    /// <summary>A paste longer than this is almost certainly a thread, not a booking.</summary>
    private const int MaxIntakeCharacters = 8000;

    private const int MaxQueryCharacters = 300;

    private static readonly JsonSerializerOptions ToolJsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    private string RegionContext => tenantInfo.IsUsTenant()
        ? "a US-based courier dispatch company"
        : "a New Zealand courier dispatch company";

    /// <summary>
    /// The eight address lines carry different meanings per region, so the model has to
    /// be told which layout it is filling rather than inferring it from the data.
    /// </summary>
    private string AddressLineGuide => tenantInfo.IsUsTenant()
        ? "1 company, 2 unit/suite, 3 street number, 4 street name, 5 city, 6 state, 7 ZIP code, 8 notes"
        : "1 company, 2 unit, 3 street number, 4 street name, 5 suburb, 6 city, 7 post code, 8 notes";

    // ---- Job intake -------------------------------------------------------

    private const string EmitJobIntakeDescription =
        "Returns the fields of a new courier job read out of one pasted booking request. The operator sees "
        + "every field beside the text it came from and must approve before the job is created, so an omitted "
        + "field costs them a keystroke and an invented one costs a wrong delivery. `clientText`, `speedText` "
        + "and `vehicleText` are the words the source used — the application resolves them against its own "
        + "lists, so never return an id and never normalise the wording. `unresolved` is the first thing the "
        + "operator reads: put in it everything a human must decide that you could not. Return every field "
        + "empty with confidence 0 when the text is not a booking request.";

    private const string AddressSchemaFragment = """
        {
          "type": "object",
          "properties": {
            "addressLine1": { "type": "string", "description": "Company, building or complex name." },
            "addressLine2": { "type": "string", "description": "Unit or suite." },
            "addressLine3": { "type": "string", "description": "Street number." },
            "addressLine4": { "type": "string", "description": "Street name." },
            "addressLine5": { "type": "string", "description": "City on US tenants, suburb on NZ tenants." },
            "addressLine6": { "type": "string", "description": "State on US tenants, city on NZ tenants." },
            "addressLine7": { "type": "string", "description": "ZIP on US tenants, post code on NZ tenants." },
            "addressLine8": { "type": "string", "description": "Anything that is not part of the postal address: level, door code, 'rear entrance', 'loading dock 4'." }
          },
          "required": ["addressLine1", "addressLine2", "addressLine3", "addressLine4", "addressLine5", "addressLine6", "addressLine7", "addressLine8"]
        }
        """;

    private static readonly string EmitJobIntakeSchema =
        $$"""
          {
            "type": "object",
            "properties": {
              "pickupAddress": {{AddressSchemaFragment}},
              "deliveryAddress": {{AddressSchemaFragment}},
              "clientText": { "type": "string", "description": "The customer name as the source wrote it. Never an id." },
              "speedText": { "type": "string", "description": "The service level as the source wrote it ('urgent', 'overnight'). Never an id." },
              "vehicleText": { "type": "string", "description": "The vehicle as the source wrote it ('van', '2 ton'). Never an id." },
              "fromContactName": { "type": "string", "description": "Who releases the goods at pickup." },
              "deliverToContact": { "type": "string", "description": "Who receives the goods at delivery." },
              "podName": { "type": "string", "description": "Who the source says will sign, when it names someone different from the delivery contact." },
              "date": { "type": "string", "description": "ISO yyyy-MM-dd resolved against TODAY in the user message. Empty when the source names no date." },
              "refA": { "type": "string", "maxLength": 20, "description": "The customer's own reference, PO or order number." },
              "refB": { "type": "string", "maxLength": 20, "description": "A second customer reference, when the source gives one." },
              "pickupNotes": { "type": "string", "maxLength": 150, "description": "Instructions the courier needs at pickup." },
              "deliveryNotes": { "type": "string", "maxLength": 150, "description": "Instructions the courier needs at delivery." },
              "jobNotes": { "type": "string", "maxLength": 150, "description": "Instructions that belong to the job rather than to one leg." },
              "weight": { "type": ["number", "null"], "description": "Weight as a number, or null when the source gives none." },
              "weightUnit": { "type": ["string", "null"], "enum": ["kg", "lb", null], "description": "Null when a weight is given without a unit; say so in unresolved instead of guessing." },
              "confidence": { "type": "number", "description": "0.0 to 1.0. How complete and unambiguous the source was." },
              "unresolved": {
                "type": "array",
                "items": { "type": "string" },
                "description": "Everything a human must decide that you could not: two candidate addresses, a missing suburb, an ambiguous date, a weight with no unit."
              }
            },
            "required": ["pickupAddress", "deliveryAddress", "clientText", "speedText", "vehicleText", "fromContactName", "deliverToContact", "podName", "date", "refA", "refB", "pickupNotes", "deliveryNotes", "jobNotes", "weight", "weightUnit", "confidence", "unresolved"]
          }
          """;

    private string JobIntakeSystemPrompt =>
        $"""
         You are a booking-intake extractor for {RegionContext}.
         You read one pasted booking request — an email, a transcribed phone call, or a
         message thread — and fill the fields of a new job so the operator only has to
         check them.

         The operator sees every field you return beside the text you read, and must
         approve before anything is created. A field you leave empty costs them one
         keystroke; a field you invent costs them a wrong delivery.

         ADDRESSES — Split each into the numbered lines: {AddressLineGuide}.
           Anything that is not part of the postal address (level, door code, "rear
           entrance", "loading dock 4") goes in line 8, never line 1.
           Return each line exactly as written in the source: do not correct spelling,
           expand abbreviations, or add a suburb the text does not give.

         CONTACTS — fromContactName releases the goods, deliverToContact receives them.
           A name appearing only in an email signature is the sender, not a contact.

         SERVICE — clientText, speedText and vehicleText are the words the source uses
           ("Acme Ltd", "urgent", "2 ton"). The application resolves them against its own
           lists. Never return an id and never tidy the wording.

         DATE — Resolve relative wording ("tomorrow", "Friday", "next week") against
           TODAY in the user message. Return ISO yyyy-MM-dd. Leave it empty when no date
           is given; do not default to today.

         NOTES — pickupNotes, deliveryNotes and jobNotes carry the instructions the
           courier needs, close to the source wording. Do not repeat one instruction in
           more than one of them.

         REFERENCES — refA and refB are the customer's own reference, PO or order
           numbers. They are not your own labels and not the job charge.

         CONFIDENCE AND UNRESOLVED — confidence reports how complete and unambiguous the
           source was. List in `unresolved` everything a human must decide that you could
           not: two candidate addresses, a missing suburb, an ambiguous date, a weight
           given without a unit. The operator reads that list first.

         Rules:
         - Extract only what the text states or unambiguously implies. Omit a field
           rather than guessing it.
         - Phone numbers and emails arrive redacted as [PHONE_1], [EMAIL_1]. Copy the
           placeholders through unchanged; the application restores the originals.
         - Never invent a charge, weight or dimension. Numbers come from the text or not
           at all.
         - If the text is not a booking request, return every field empty, confidence 0,
           and a single `unresolved` entry saying so.
         """;

    public async Task<JobIntakeResponse> ExtractJobIntakeAsync(
        ExtractJobIntakeRequest request, CancellationToken ct = default)
    {
        var text = request?.Text;
        if (string.IsNullOrWhiteSpace(text))
        {
            return EmptyIntake("Nothing was pasted to read.", new AiUsageInfo());
        }

        if (text.Length > MaxIntakeCharacters)
        {
            text = text[..MaxIntakeCharacters];
        }

        var sanitized = AiDataSanitizer.SanitizeWithTokens(text);

        var sb = new StringBuilder();
        sb.AppendLine($"TODAY: {Today()}");
        sb.AppendLine();
        sb.AppendLine("--- Pasted booking request ---");
        sb.AppendLine(sanitized.Text);

        var (json, usage) = await SendToolRequestAsync(
            AiTaskClass.Judgment, JobIntakeSystemPrompt, sb.ToString(),
            EmitJobIntakeTool, EmitJobIntakeDescription, EmitJobIntakeSchema, ct);

        if (json == null)
        {
            return EmptyIntake("Auto-mate could not read this text. Fill the job in manually.", usage);
        }

        JobIntakeToolOutput parsed;
        try
        {
            parsed = JsonSerializer.Deserialize<JobIntakeToolOutput>(json, ToolJsonOptions);
        }
        catch (JsonException e)
        {
            Log.Warning(e, "Failed to parse job intake extraction");
            return EmptyIntake("Auto-mate returned an answer that could not be read.", usage);
        }

        if (parsed == null)
        {
            return EmptyIntake("Auto-mate returned nothing to fill in.", usage);
        }

        var map = sanitized.Placeholders;

        // Each lookup is a round trip, so only make the ones the extraction needs.
        var client = await ResolveClientAsync(parsed.ClientText);
        var speed = string.IsNullOrWhiteSpace(parsed.SpeedText)
            ? new AiResolvedLookup()
            : ResolveFromCatalog(parsed.SpeedText, await jobRepository.GetSpeedsAsync());
        var vehicle = string.IsNullOrWhiteSpace(parsed.VehicleText)
            ? new AiResolvedLookup()
            : ResolveFromCatalog(parsed.VehicleText, await courierRepository.GetVehicleSizesAsync());

        return new JobIntakeResponse
        {
            PickupAddress = RestoreAddress(parsed.PickupAddress, map),
            DeliveryAddress = RestoreAddress(parsed.DeliveryAddress, map),
            Client = client,
            Speed = speed,
            Vehicle = vehicle,
            FromContactName = AiDataSanitizer.Restore(parsed.FromContactName, map),
            DeliverToContact = AiDataSanitizer.Restore(parsed.DeliverToContact, map),
            PodName = AiDataSanitizer.Restore(parsed.PodName, map),
            Date = NullIfBlank(parsed.Date),
            RefA = parsed.RefA,
            RefB = parsed.RefB,
            PickupNotes = AiDataSanitizer.Restore(parsed.PickupNotes, map),
            DeliveryNotes = AiDataSanitizer.Restore(parsed.DeliveryNotes, map),
            JobNotes = AiDataSanitizer.Restore(parsed.JobNotes, map),
            Weight = parsed.Weight,
            WeightUnit = NullIfBlank(parsed.WeightUnit),
            Confidence = parsed.Confidence,
            Unresolved = parsed.Unresolved ?? [],
            Usage = usage
        };
    }

    // ---- Search query -----------------------------------------------------

    private const string EmitSearchCriteriaDescription =
        "Returns job-search criteria read out of one line of dispatcher shorthand. The criteria are written "
        + "into the search form for the dispatcher to adjust and run themselves — nothing searches on this "
        + "output alone. `clientNames`, `courierNames` and `speedNames` are names as typed. Never an id: the "
        + "application resolves them against its own lists and shows the dispatcher any it could not match, "
        + "so a name passed through wrong is visible while a name silently dropped is not. Every word of the "
        + "query must land in exactly one field or in `ignored` with a reason.";

    private const string EmitSearchCriteriaSchema = """
        {
          "type": "object",
          "properties": {
            "clientNames": { "type": "array", "items": { "type": "string" }, "maxItems": 5, "description": "Customer names as typed. Never an id." },
            "courierNames": { "type": "array", "items": { "type": "string" }, "maxItems": 5, "description": "Driver or courier names as typed. Never an id." },
            "speedNames": { "type": "array", "items": { "type": "string" }, "maxItems": 5, "description": "Service levels as typed. Never an id." },
            "jobId": { "type": ["integer", "null"], "description": "Only for a bare number the text presents as a job id." },
            "bulkJobId": { "type": ["integer", "null"], "description": "Only for a bare number the text presents as a bulk or scheduled job id." },
            "jobNumber": { "type": ["string", "null"], "description": "A job reference containing letters, e.g. 'J48213', 'E4672MD'." },
            "wildcard": { "type": ["string", "null"], "description": "Free text to match anywhere: a suburb, a person, a product, a customer reference." },
            "fromDate": { "type": ["string", "null"], "description": "ISO yyyy-MM-dd resolved against TODAY in the user message." },
            "toDate": { "type": ["string", "null"], "description": "ISO yyyy-MM-dd resolved against TODAY in the user message." },
            "ignored": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "term": { "type": "string", "description": "The word or phrase that did not become a criterion." },
                  "reason": { "type": "string", "description": "Why it was dropped, in words the dispatcher can act on." }
                },
                "required": ["term", "reason"]
              },
              "description": "Every word of the query that landed in no field. Silent loss is the failure that matters here."
            }
          },
          "required": ["clientNames", "courierNames", "speedNames", "jobId", "bulkJobId", "jobNumber", "wildcard", "fromDate", "toDate", "ignored"]
        }
        """;

    private string SearchQuerySystemPrompt =>
        $"""
         You turn one line of dispatcher shorthand into job-search criteria for
         {RegionContext}.

         The dispatcher types how they would say it out loud — "Smith deliveries last
         week", "anything for Acme still sitting today", "job 48213". You fill the search
         form; they see it filled, adjust it, and press Search themselves.

         FIELDS
           clientNames, courierNames, speedNames — the names as typed. The application
             resolves them against its own lists and shows the dispatcher anything it
             could not match.
           jobId, bulkJobId — only for a bare number the text presents as an id.
           jobNumber — a job reference containing letters, e.g. "J48213", "E4672MD".
           wildcard — free text to match anywhere: a suburb, a person, a product, a
             customer reference. Use it for anything plainly a search term that is not
             one of the fields above.
           fromDate, toDate — ISO yyyy-MM-dd, resolved against TODAY in the user message.
             "Last week" is the previous Monday to Sunday; "this week" the current one.
             Leave both null when the text names no time at all.

         Rules:
         - Every word of the query lands in exactly one field, or in `ignored` with the
           reason it was dropped. Silent loss is the failure that matters here.
         - Do not widen the search. A query naming one client must not return two.
         - Words describing job state ("late", "unallocated", "on hold", "voided") are
           not criteria in this form. Put them in `ignored` so the dispatcher knows to
           filter the results themselves.
         - Return every field empty with one `ignored` entry when the text is not a
           search.
         """;

    public async Task<SearchCriteriaResponse> ParseSearchQueryAsync(
        ParseSearchQueryRequest request, CancellationToken ct = default)
    {
        var query = request?.Query;
        if (string.IsNullOrWhiteSpace(query))
        {
            return new SearchCriteriaResponse { Usage = new AiUsageInfo() };
        }

        if (query.Length > MaxQueryCharacters)
        {
            query = query[..MaxQueryCharacters];
        }

        var sb = new StringBuilder();
        sb.AppendLine($"TODAY: {Today()}");
        sb.AppendLine();
        sb.AppendLine("--- Query ---");
        sb.AppendLine(AiDataSanitizer.Sanitize(query));

        var (json, usage) = await SendToolRequestAsync(
            AiTaskClass.Drafting, SearchQuerySystemPrompt, sb.ToString(),
            EmitSearchCriteriaTool, EmitSearchCriteriaDescription, EmitSearchCriteriaSchema, ct);

        if (json == null)
        {
            return new SearchCriteriaResponse { Usage = usage };
        }

        SearchCriteriaToolOutput parsed;
        try
        {
            parsed = JsonSerializer.Deserialize<SearchCriteriaToolOutput>(json, ToolJsonOptions);
        }
        catch (JsonException e)
        {
            Log.Warning(e, "Failed to parse search criteria");
            return new SearchCriteriaResponse { Usage = usage };
        }

        if (parsed == null)
        {
            return new SearchCriteriaResponse { Usage = usage };
        }

        var unmatched = new List<string>();

        var clients = new List<Suggestion>();
        foreach (var name in parsed.ClientNames ?? [])
        {
            var match = await ResolveClientAsync(name);
            AddOrReport(clients, unmatched, match);
        }

        var speeds = new List<Suggestion>();
        if (parsed.SpeedNames is { Count: > 0 } speedNames)
        {
            var speedList = await jobRepository.GetSpeedsAsync();
            foreach (var name in speedNames)
            {
                AddOrReport(speeds, unmatched, ResolveFromCatalog(name, speedList));
            }
        }

        var couriers = new List<Suggestion>();
        foreach (var name in parsed.CourierNames ?? [])
        {
            var candidates = string.IsNullOrWhiteSpace(name)
                ? []
                : await courierRepository.AllActiveCouriersAsync(name);
            AddOrReport(couriers, unmatched, ResolveFromSearch(name, candidates));
        }

        return new SearchCriteriaResponse
        {
            Clients = clients,
            Couriers = couriers,
            Speeds = speeds,
            JobId = parsed.JobId,
            BulkJobId = parsed.BulkJobId,
            JobNumber = NullIfBlank(parsed.JobNumber),
            Wildcard = NullIfBlank(parsed.Wildcard),
            FromDate = NullIfBlank(parsed.FromDate),
            ToDate = NullIfBlank(parsed.ToDate),
            Ignored = parsed.Ignored ?? [],
            UnmatchedNames = unmatched,
            Usage = usage
        };
    }

    // ---- Shared -----------------------------------------------------------

    private string Today() =>
        tenantInfo.GetCurrentTenantTime().ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

    private async Task<AiResolvedLookup> ResolveClientAsync(string text)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            return new AiResolvedLookup { Text = null };
        }

        return ResolveFromSearch(text, await clientRepository.ActiveClientsAsync(text));
    }

    /// <summary>
    /// Matches a name against results the repository already filtered by that same
    /// name, so a lone survivor is the answer. Never use this against a full catalog:
    /// a catalog of one would match every term the model could read.
    /// </summary>
    private static AiResolvedLookup ResolveFromSearch(string text, IReadOnlyList<Suggestion> results)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            return new AiResolvedLookup { Text = null };
        }

        var match = Exact(text, results) ?? (results is { Count: 1 } ? results[0] : null);
        return new AiResolvedLookup { Text = text, Id = match?.Id, Name = match?.Text };
    }

    /// <summary>
    /// Matches a name against a closed catalog (speeds, vehicle sizes). An exact
    /// case-insensitive hit wins; failing that a substring hit counts only while it
    /// is unique, so "2 ton" finds "2 Ton Truck" but an ambiguous term resolves to no
    /// id and the operator picks it themselves.
    /// </summary>
    private static AiResolvedLookup ResolveFromCatalog(string text, IReadOnlyList<Suggestion> catalog)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            return new AiResolvedLookup { Text = null };
        }

        var match = Exact(text, catalog);

        if (match == null && catalog != null)
        {
            var partial = catalog
                .Where(c => !string.IsNullOrEmpty(c.Text)
                            && (c.Text.Contains(text, StringComparison.OrdinalIgnoreCase)
                                || text.Contains(c.Text, StringComparison.OrdinalIgnoreCase)))
                .Take(2)
                .ToList();

            match = partial.Count == 1 ? partial[0] : null;
        }

        return new AiResolvedLookup { Text = text, Id = match?.Id, Name = match?.Text };
    }

    private static Suggestion Exact(string text, IReadOnlyList<Suggestion> candidates) =>
        candidates?.FirstOrDefault(c => string.Equals(c.Text, text, StringComparison.OrdinalIgnoreCase));

    private static void AddOrReport(List<Suggestion> resolved, List<string> unmatched, AiResolvedLookup lookup)
    {
        if (lookup.Id is { } id)
        {
            resolved.Add(new Suggestion { Id = id, Text = lookup.Name });
        }
        else if (!string.IsNullOrWhiteSpace(lookup.Text))
        {
            unmatched.Add(lookup.Text);
        }
    }

    private static JobIntakeResponse EmptyIntake(string reason, AiUsageInfo usage) => new()
    {
        PickupAddress = new AiIntakeAddress(),
        DeliveryAddress = new AiIntakeAddress(),
        Client = new AiResolvedLookup(),
        Speed = new AiResolvedLookup(),
        Vehicle = new AiResolvedLookup(),
        Confidence = 0,
        Unresolved = [reason],
        Usage = usage
    };

    private static AiIntakeAddress RestoreAddress(
        AiIntakeAddress address, IReadOnlyDictionary<string, string> map)
    {
        if (address == null)
        {
            return new AiIntakeAddress();
        }

        return new AiIntakeAddress
        {
            AddressLine1 = AiDataSanitizer.Restore(address.AddressLine1, map),
            AddressLine2 = AiDataSanitizer.Restore(address.AddressLine2, map),
            AddressLine3 = AiDataSanitizer.Restore(address.AddressLine3, map),
            AddressLine4 = AiDataSanitizer.Restore(address.AddressLine4, map),
            AddressLine5 = AiDataSanitizer.Restore(address.AddressLine5, map),
            AddressLine6 = AiDataSanitizer.Restore(address.AddressLine6, map),
            AddressLine7 = AiDataSanitizer.Restore(address.AddressLine7, map),
            AddressLine8 = AiDataSanitizer.Restore(address.AddressLine8, map)
        };
    }

    private static string NullIfBlank(string value) => string.IsNullOrWhiteSpace(value) ? null : value;

    private async Task<(string Json, AiUsageInfo Usage)> SendToolRequestAsync(
        AiTaskClass taskClass, string systemPrompt, string userMessage, string toolName,
        string toolDescription, string schema, CancellationToken ct)
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
            Log.Warning("AI {ToolName} refused ({Category})", toolName, response.RefusalCategory);
            return (null, usage);
        }

        var call = response.ToolCalls.FirstOrDefault(c => c.ToolName == toolName);
        return (call?.ArgumentsJson, usage);
    }

    // ---- Tool output shapes ----------------------------------------------

    private sealed record JobIntakeToolOutput
    {
        public AiIntakeAddress PickupAddress { get; init; }
        public AiIntakeAddress DeliveryAddress { get; init; }
        public string ClientText { get; init; }
        public string SpeedText { get; init; }
        public string VehicleText { get; init; }
        public string FromContactName { get; init; }
        public string DeliverToContact { get; init; }
        public string PodName { get; init; }
        public string Date { get; init; }
        public string RefA { get; init; }
        public string RefB { get; init; }
        public string PickupNotes { get; init; }
        public string DeliveryNotes { get; init; }
        public string JobNotes { get; init; }
        public decimal? Weight { get; init; }
        public string WeightUnit { get; init; }
        public double Confidence { get; init; }
        public List<string> Unresolved { get; init; }
    }

    private sealed record SearchCriteriaToolOutput
    {
        public List<string> ClientNames { get; init; }
        public List<string> CourierNames { get; init; }
        public List<string> SpeedNames { get; init; }
        public int? JobId { get; init; }
        public int? BulkJobId { get; init; }
        public string JobNumber { get; init; }
        public string Wildcard { get; init; }
        public string FromDate { get; init; }
        public string ToDate { get; init; }
        public List<AiIgnoredTerm> Ignored { get; init; }
    }
}
