namespace DespatchWeb.Models.RequestModels;

/// <summary>Request to draft a job note of a chosen type.</summary>
public sealed class DraftNoteRequest
{
    public int? JobId { get; init; }
    public int? JobBookingId { get; init; }
    public int? BulkJobId { get; init; }

    /// <summary>NoteType enum value — drives audience/tone (Client/Agent vs Internal).</summary>
    public int NoteTypeId { get; init; }

    /// <summary>Rough text the user already typed; the draft polishes/expands it. May be empty.</summary>
    public string Seed { get; init; } = string.Empty;
}
