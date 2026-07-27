using System.Text.RegularExpressions;

namespace DespatchWeb.Helpers;

/// <summary>
/// Hardcoded default templates for the inbound-agent assignment email, plus the token
/// substitution applied at send time. Tokens are written as <c>[FieldName]</c>; a dispatcher
/// may edit the template freely, so unknown tokens are left untouched rather than throwing,
/// and a null value renders empty.
/// </summary>
public static partial class AgentEmailTemplates
{
    public const string DefaultSubject = "New job assigned [JobNumber]";

    public const string DefaultBody =
        "Hi [AgentName]\n" +
        "\n" +
        "You have been assigned a new job [JobNumber]. This job is going to [DeliveryCompany] [DeliveryStreetNumber] [DeliveryStreetName] [DeliveryCity] Please click here to accept the job and upload proof of delivery. [InboundUrl]\n" +
        "The flight is arriving on [FlightNumber] at [FlightETA] from [FromSuburbCity] with [Quantity] items weighing [Weight].\n" +
        "The delivery contact name is [DeliveryContactName] and you can call them on [DeliveryContactPhone].";

    /// <summary>
    /// Replaces every <c>[Token]</c> in <paramref name="template"/> with its value from
    /// <paramref name="tokens"/> (case-insensitive). Tokens with no matching entry are left
    /// verbatim so free-text edits never break a send.
    /// </summary>
    public static string Substitute(string? template, IReadOnlyDictionary<string, string> tokens) =>
        string.IsNullOrEmpty(template)
            ? string.Empty
            : TokenRegex().Replace(template, match =>
                tokens.TryGetValue(match.Groups[1].Value, out var value) ? value : match.Value);

    [GeneratedRegex(@"\[(\w+)\]")]
    private static partial Regex TokenRegex();
}
