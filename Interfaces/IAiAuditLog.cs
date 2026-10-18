namespace DespatchWeb.Interfaces;

/// <summary>
/// Structured record of what the AI suggested for decisions with commercial effect, and which
/// of those suggestions the human went on to accept, so "did the AI cause this charge?" and
/// the acceptance rate can be answered from the log sink.
/// </summary>
public interface IAiAuditLog
{
    void Suggested(string feature, int jobId, int staffId, string tenantId, object suggestion);

    void Decided(
        string feature, int jobId, int staffId, string tenantId,
        IReadOnlyList<int> suggestedIds, IReadOnlyList<int> acceptedIds);
}
