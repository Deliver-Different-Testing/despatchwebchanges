using DespatchWeb.Interfaces;
using Serilog;

namespace DespatchWeb.Services;

public sealed class AiAuditLog : IAiAuditLog
{
    private static readonly Serilog.ILogger Audit = Log.ForContext("AiAudit", true);

    public void Suggested(string feature, int jobId, int staffId, string tenantId, object suggestion) =>
        Audit.Information(
            "AI audit - suggestion - Feature: {Feature}, Job: {JobId}, Staff: {StaffId}, Tenant: {TenantId}, " +
            "Suggestion: {@Suggestion}",
            feature, jobId, staffId, tenantId, suggestion);

    public void Decided(
        string feature, int jobId, int staffId, string tenantId,
        IReadOnlyList<int> suggestedIds, IReadOnlyList<int> acceptedIds) =>
        Audit.Information(
            "AI audit - decision - Feature: {Feature}, Job: {JobId}, Staff: {StaffId}, Tenant: {TenantId}, " +
            "Suggested: {SuggestedIds}, Accepted: {AcceptedIds}",
            feature, jobId, staffId, tenantId, suggestedIds, acceptedIds);
}
