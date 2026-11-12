using System.Globalization;
using System.Text.Json.Nodes;
using DespatchWeb.Models;

namespace DespatchWeb.Tests.Services.AgentRead;

/// <summary>Loads the fixtures ported from the dfrntmcp prototype (proposed/&lt;tool&gt;/fixture.json).</summary>
internal static class AgentFixture
{
    public static JsonObject Load(string name) =>
        JsonNode.Parse(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "Fixtures", "AgentRead", name + ".json")))!.AsObject();

    public static List<Dictionary<string, string>> Csv(string text)
    {
        var rows = new List<List<string>>();
        var row = new List<string>();
        var field = new System.Text.StringBuilder();
        var quoted = false;
        text = text.Replace("\r\n", "\n");
        for (var i = 0; i < text.Length; i++)
        {
            var c = text[i];
            if (quoted)
            {
                if (c == '"' && i + 1 < text.Length && text[i + 1] == '"') { field.Append('"'); i++; }
                else if (c == '"') quoted = false;
                else field.Append(c);
            }
            else if (c == '"') quoted = true;
            else if (c == ',') { row.Add(field.ToString()); field.Clear(); }
            else if (c == '\n') { row.Add(field.ToString()); field.Clear(); rows.Add(row); row = []; }
            else field.Append(c);
        }

        if (field.Length > 0 || row.Count > 0) { row.Add(field.ToString()); rows.Add(row); }

        var headers = rows[0];
        return [.. rows.Skip(1).Where(r => !(r.Count == 1 && r[0] == ""))
            .Select(r => headers.Select((h, i) => (h, v: i < r.Count ? r[i] : "")).ToDictionary(x => x.h, x => x.v))];
    }

    public static IReadOnlyList<JobDownloadModel> Jobs(string csv) => [.. Csv(csv).Select(Job)];

    private static JobDownloadModel Job(Dictionary<string, string> r)
    {
        string S(string k) => r.GetValueOrDefault(k) ?? "";
        decimal? Dec(string k) => decimal.TryParse(S(k).Replace("$", ""), CultureInfo.InvariantCulture, out var d) ? d : null;
        DateTime? Dt(string k) => DateTime.TryParse(S(k), CultureInfo.InvariantCulture, out var d) ? d : null;
        return new JobDownloadModel
        {
            Id = int.Parse(S("Id"), CultureInfo.InvariantCulture),
            JobNumber = S("JobNumber"),
            CustomerName = S("CustomerName"),
            CourierCode = S("CourierCode"),
            BookDate = Dt("BookDate") ?? default,
            PickedUpDate = Dt("PickedUpDate"),
            DeliveredDate = Dt("DeliveredDate"),
            Amount = Dec("Amount"),
            Fuel = Dec("Fuel") ?? 0,
            StatusName = S("StatusName"),
            PickupAddressLine1 = S("PickupAddressLine1"),
            DeliveryAddressLine1 = S("DeliveryAddressLine1"),
            ClientReferenceA = S("ClientReferenceA"),
            ClientReferenceB = S("ClientReferenceB"),
            ClientReferenceC = S("ClientReferenceC"),
            OurReference = S("OurReference"),
            Speed = S("Speed"),
            Notes = S("Notes"),
            InvoiceNumber = int.TryParse(S("InvoiceNumber"), CultureInfo.InvariantCulture, out var inv) ? inv : null,
            IsArchived = S("IsArchived").Equals("true", StringComparison.OrdinalIgnoreCase),
            LoggedInContact = S("LoggedInContact"),
            Void = S("Void").Equals("true", StringComparison.OrdinalIgnoreCase)
        };
    }
}
