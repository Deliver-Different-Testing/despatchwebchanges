#nullable enable
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using DeliverDifferent.AgentAccess;

namespace DespatchWeb.Services.AgentRead;

/// <summary>
/// Strips the sensitive data classes an agent's role lacks from a read response. A member is classified by the words in
/// its name, so tools keep to one vocabulary (see docs/agent-read-api.md) and a lint test guards it. Omitted members are
/// never zeroed; they are listed under <c>redacted</c>. Free text the role may see, and every member that carries text
/// typed by people, moves under <c>untrusted_text</c> on its parent object.
/// </summary>
public static partial class AgentFieldProjector
{
    public const int MaxFieldChars = 2_000;
    public const int MaxResponseChars = 25_000;
    public const string TruncationMark = "…[truncated]";
    public const string UntrustedTextKey = "untrusted_text";

    private static readonly HashSet<string> CostWords =
        ["amount", "amounts", "price", "prices", "pricing", "cost", "costs", "margin", "earnings", "payment", "money", "rate", "fuel", "totalafter", "charge", "charges", "revenue", "wage", "wages", "salary", "fare"];

    private static readonly HashSet<string> ContactWords = ["phone", "phones", "email", "emails", "mobile", "telephone", "tel", "fax"];

    private static readonly HashSet<string> NoteWords =
        ["note", "notes", "instruction", "instructions", "reason", "comment", "comments", "remark", "remarks"];

    // A member name carries POD only through the word "pod" (podDetail); the wider set applies to typed text and field names.
    private static readonly HashSet<string> PodMemberWords = ["pod"];

    private static readonly HashSet<string> TextPodWords =
        ["pod", "signature", "signatures", "signed", "photo", "photos", "photograph", "photographs", "image", "images"];

    // Member names that carry text a customer or staff member typed. Identifiers the model acts on (job numbers, ids) are not here.
    private static readonly HashSet<string> FreeTextMembers = new(StringComparer.OrdinalIgnoreCase)
    {
        "ourReference", "clientReferenceA", "clientReferenceB", "clientReferenceC", "reference", "fulfilmentOrderId", "jobName",
        "address", "pickupAddress", "deliveryAddress", "pickup", "delivery", "client", "loggedInContact", "createdBy", "bookedBy",
        "what", "detail", "from", "to", "signedBy", "podName", "fileName", "by", "name", "names", "courier", "driver",
        "scheduleName", "destinations", "areas", "vehicle", "region"
    };

    // Free text and field names use a wider vocabulary than member names: `total` or `totalCount` as a member is a count,
    // not money, so the extra words only apply where the content is typed by people.
    private static readonly HashSet<string> TextCostWords =
    [
        .. CostWords,
        "total", "totals", "invoice", "invoices", "invoiced", "surcharge", "surcharges", "discount", "discounts", "gst", "tax", "taxes",
        "pay", "paid", "ppd", "bill", "billed", "billing", "nzd", "usd", "dollar", "dollars"
    ];

    [GeneratedRegex(@"[A-Za-z0-9._%+\-]+@[A-Za-z0-9\-]+\.[A-Za-z0-9.\-]+")]
    private static partial Regex EmailPattern();

    [GeneratedRegex(@"[$€£]\s?\d|\b\d+\.\d{2}\b")]
    private static partial Regex CurrencyPattern();

    [GeneratedRegex(@"\d{4}-\d{2}-\d{2}|\d{1,2}:\d{2}(:\d{2})?")]
    private static partial Regex DateTimePattern();

    [GeneratedRegex(@"(?<![\w.])\+?\(?\d[\d\s().\-]{5,17}\d(?!\w)")]
    private static partial Regex PhonePattern();

    public static string? ClassOf(string memberName) => ClassesOf(memberName).FirstOrDefault();

    /// <summary>Every class a member name belongs to; a member in more than one is shown only to a caller holding all of them.</summary>
    public static IReadOnlyList<string> ClassesOf(string memberName) => ClassesOfWords(Words(memberName), CostWords, PodMemberWords);

    /// <summary>Classes of a field name that sits outside the member vocabulary (a change request's FieldName).</summary>
    public static IReadOnlyList<string> ClassesOfField(string? fieldName) =>
        string.IsNullOrEmpty(fieldName) ? [] : ClassesOfWords(Words(fieldName), TextCostWords, TextPodWords);

    /// <summary>Classes of typed text: the word lists plus literal emails, phone numbers and currency amounts.</summary>
    public static IReadOnlyList<string> ClassesOfText(params string?[] texts)
    {
        var text = string.Join(" ", texts.Where(t => !string.IsNullOrEmpty(t)));
        if (text.Length == 0) return [];

        var words = text.Split([' ', '\t', '\r', '\n', ',', ';', ':', '.', '-', '_', '/', '(', ')', '"', '\'', '!', '?', '=', '>', '<', '→', '$'], StringSplitOptions.RemoveEmptyEntries)
            .Select(w => w.ToLowerInvariant());
        var classes = ClassesOfWords(words, TextCostWords, TextPodWords);

        if (!classes.Contains(AgentCapabilities.SeePod) && text.Contains("proof of delivery", StringComparison.OrdinalIgnoreCase)) classes.Add(AgentCapabilities.SeePod);
        if (!classes.Contains(AgentCapabilities.SeeCosts) && CurrencyPattern().IsMatch(text)) classes.Add(AgentCapabilities.SeeCosts);
        if (!classes.Contains(AgentCapabilities.SeeContactDetails) && (EmailPattern().IsMatch(text) || HasPhoneNumber(text)))
        {
            classes.Add(AgentCapabilities.SeeContactDetails);
        }

        return classes;
    }

    /// <summary>A member-name stem whose words classify to exactly these classes, e.g. priceAndPhoneOrEmail.</summary>
    public static string StemFor(IReadOnlyCollection<string> classes)
    {
        List<string> parts = [];
        if (classes.Contains(AgentCapabilities.SeeCosts)) parts.Add("price");
        if (classes.Contains(AgentCapabilities.SeeContactDetails)) parts.Add("phoneOrEmail");
        if (classes.Contains(AgentCapabilities.SeeNotes)) parts.Add("notes");
        if (classes.Contains(AgentCapabilities.SeePod)) parts.Add("pod");
        return string.Concat(parts.Select((p, i) => i == 0 ? p : "And" + char.ToUpperInvariant(p[0]) + p[1..]));
    }

    private static bool HasPhoneNumber(string text)
    {
        var withoutDates = DateTimePattern().Replace(text, " ");
        foreach (Match m in PhonePattern().Matches(withoutDates))
        {
            var digits = m.Value.Count(char.IsDigit);
            var bare = m.Value.All(c => char.IsDigit(c) || c == '+');
            if (digits is >= 7 and <= 15 && !(bare && digits > 12)) return true;
        }

        return false;
    }

    private static List<string> ClassesOfWords(IEnumerable<string> sequence, HashSet<string> costWords, HashSet<string> podWords)
    {
        var words = sequence as IReadOnlyCollection<string> ?? [.. sequence];
        List<string> classes = [];
        if (words.Any(costWords.Contains) || costWords.Contains(string.Concat(words))) classes.Add(AgentCapabilities.SeeCosts);
        if (words.Any(ContactWords.Contains)) classes.Add(AgentCapabilities.SeeContactDetails);
        if (words.Any(NoteWords.Contains)) classes.Add(AgentCapabilities.SeeNotes);
        if (words.Any(podWords.Contains)) classes.Add(AgentCapabilities.SeePod);
        return classes;
    }

    private static List<string> Words(string name)
    {
        List<string> words = [];
        var current = new System.Text.StringBuilder();
        foreach (var c in name)
        {
            if (c is '_' or '-' or ' ')
            {
                Flush();
            }
            else
            {
                if (char.IsUpper(c)) Flush();
                current.Append(char.ToLowerInvariant(c));
            }
        }

        Flush();
        return words;

        void Flush()
        {
            if (current.Length == 0) return;
            words.Add(current.ToString());
            current.Clear();
        }
    }

    public static JsonObject Apply(JsonObject body, IReadOnlySet<string> capabilities, bool costsPermitted)
    {
        var copy = (JsonObject)body.DeepClone();
        var context = new Context(
            costsPermitted && capabilities.Contains(AgentCapabilities.SeeCosts),
            capabilities.Contains(AgentCapabilities.SeeContactDetails),
            capabilities.Contains(AgentCapabilities.SeeNotes),
            capabilities.Contains(AgentCapabilities.SeePod));

        Walk(copy, "", context);
        var truncated = CapUntrustedText(context.Leaves);

        if (truncated) copy["untrustedTextTruncated"] = true;
        if (context.Redacted.Count > 0)
        {
            copy["redacted"] = new JsonArray([.. context.Redacted.Select(r => (JsonNode)new JsonObject
            {
                ["class"] = r.Key,
                ["members"] = new JsonArray([.. r.Value.Select(m => (JsonNode)JsonValue.Create(m)!)])
            })]);
        }

        return copy;
    }

    private sealed class Context(bool costs, bool contacts, bool notes, bool pod)
    {
        public bool Costs { get; } = costs;
        public bool Contacts { get; } = contacts;
        public bool Notes { get; } = notes;
        public bool Pod { get; } = pod;

        public bool Allows(string capability) => capability switch
        {
            AgentCapabilities.SeeCosts => Costs,
            AgentCapabilities.SeeContactDetails => Contacts,
            AgentCapabilities.SeeNotes => Notes,
            AgentCapabilities.SeePod => Pod,
            _ => true
        };
        public Dictionary<string, SortedSet<string>> Redacted { get; } = [];
        public List<(JsonNode Container, object Key)> Leaves { get; } = [];

        public void Omit(string capability, string path)
        {
            if (!Redacted.TryGetValue(capability, out var set)) Redacted[capability] = set = [];
            set.Add(path);
        }
    }

    private static void Walk(JsonNode? node, string path, Context context)
    {
        switch (node)
        {
            case JsonObject obj:
                WalkObject(obj, path, context);
                break;
            case JsonArray array:
                foreach (var item in array) Walk(item, path + "[]", context);
                break;
        }
    }

    private static void WalkObject(JsonObject obj, string path, Context context)
    {
        JsonObject? untrusted = null;
        foreach (var (name, value) in obj.ToList())
        {
            var memberPath = path.Length == 0 ? name : $"{path}.{name}";
            List<string> classes = [.. ClassesOf(name)];
            if (IsPodMember(path, name)) classes.Add(AgentCapabilities.SeePod);

            var missing = classes.Where(c => !context.Allows(c)).ToList();
            if (missing.Count > 0)
            {
                obj.Remove(name);
                foreach (var cls in missing) context.Omit(cls, memberPath);
                continue;
            }

            if (classes.Count == 0 && !IsIdentityText(name) && !RedactNeutralText(obj, name, memberPath, context)) continue;

            Walk(obj[name], memberPath, context);
            if (!classes.Contains(AgentCapabilities.SeeNotes) && !(FreeTextMembers.Contains(name) && IsText(value))) continue;

            obj.Remove(name);
            untrusted ??= [];
            untrusted[name] = value;
            RegisterLeaves(untrusted, name, context);
        }
        if (untrusted is not null) obj[UntrustedTextKey] = untrusted;
    }

    // Text the roles may always see (names, addresses, references, people) and fixed-vocabulary labels (an artefact `kind` of
    // "photo" is a count-style label, not POD content) are not content-classified; every other string member (flags,
    // warnings, verdict, message...) is. The composers already route `what`/`detail`/`from`/`to` by class themselves.
    private static readonly HashSet<string> LabelMembers = new(StringComparer.OrdinalIgnoreCase)
    {
        "kind", "leg", "folder", "class", "classification", "status", "type", "field"
    };

    private static bool IsIdentityText(string name) => FreeTextMembers.Contains(name) || LabelMembers.Contains(name);

    /// <summary>Drops a string member, or the elements of a string array, whose text hits a class the caller lacks. Returns false when the member was removed.</summary>
    private static bool RedactNeutralText(JsonObject obj, string name, string memberPath, Context context)
    {
        switch (obj[name])
        {
            case JsonValue v when v.TryGetValue<string>(out var text):
                var missing = MissingClasses(text, context);
                if (missing.Count == 0) return true;
                obj.Remove(name);
                foreach (var cls in missing) context.Omit(cls, memberPath);
                return false;
            case JsonArray array:
                for (var i = array.Count - 1; i >= 0; i--)
                {
                    if (array[i] is not JsonValue item || !item.TryGetValue<string>(out var element)) continue;
                    var gone = MissingClasses(element, context);
                    if (gone.Count == 0) continue;
                    array.RemoveAt(i);
                    foreach (var cls in gone) context.Omit(cls, memberPath + "[]");
                }

                return true;
            default:
                return true;
        }
    }

    private static List<string> MissingClasses(string text, Context context) => [.. ClassesOfText(text).Where(c => !context.Allows(c))];

    // POD data is not classified by member name: the name a driver recorded, the signer and the artefact file names.
    private static bool IsPodMember(string parentPath, string name) =>
        name is "podName" or "signedBy" || (parentPath.EndsWith("artefacts[]", StringComparison.Ordinal) && name is "fileName" or "by");

    private static bool IsText(JsonNode? node) => node switch
    {
        JsonValue v => v.TryGetValue<string>(out _),
        JsonArray a => a.Count > 0 && a.All(i => i is JsonValue v && v.TryGetValue<string>(out _)),
        _ => false
    };

    private static void RegisterLeaves(JsonObject container, string key, Context context) => Collect(container[key], container, key, context);

    private static void Collect(JsonNode? node, JsonNode container, object key, Context context)
    {
        switch (node)
        {
            case JsonValue v when v.TryGetValue<string>(out _):
                context.Leaves.Add((container, key));
                break;
            case JsonObject o:
                foreach (var (name, child) in o.ToList()) Collect(child, o, name, context);
                break;
            case JsonArray a:
                for (var i = 0; i < a.Count; i++) Collect(a[i], a, i, context);
                break;
        }
    }

    private static string Read(JsonNode container, object key) =>
        (container is JsonObject o ? o[(string)key] : container.AsArray()[(int)key])!.GetValue<string>();

    private static void Write(JsonNode container, object key, string value)
    {
        if (container is JsonObject o) o[(string)key] = value;
        else container.AsArray()[(int)key] = value;
    }

    private static bool CapUntrustedText(List<(JsonNode Container, object Key)> leaves)
    {
        if (leaves.Count == 0) return false;

        foreach (var (container, key) in leaves) Write(container, key, StripControls(Read(container, key)));

        var lengths = leaves.Select(l => Read(l.Container, l.Key).Length).ToList();
        var cap = MaxFieldChars;
        while (cap > 0 && lengths.Sum(l => Math.Min(l, cap)) > MaxResponseChars) cap = Math.Max(0, cap - Math.Max(1, cap / 50));

        var truncated = false;
        for (var i = 0; i < leaves.Count; i++)
        {
            if (lengths[i] <= cap) continue;
            var (container, key) = leaves[i];
            Write(container, key, Read(container, key)[..cap] + TruncationMark);
            truncated = true;
        }

        return truncated;
    }

    private static string StripControls(string value) =>
        value.Any(c => char.IsControl(c) && c is not ('\n' or '\t')) ? string.Concat(value.Where(c => !char.IsControl(c) || c is '\n' or '\t')) : value;
}
