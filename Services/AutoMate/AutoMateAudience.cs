#nullable enable
using DespatchWeb.Interfaces;

namespace DespatchWeb.Services.AutoMate;

/// <summary>
/// Who the chat is talking to. Staff (Internal, Tenant, DFRNT admin) get the app tools and the full
/// knowledge base; customers and network partners get CSP's limited "customer" profile and no app tools,
/// because notes, events, drivers and clients aren't scoped per customer in the database.
/// </summary>
public sealed class AutoMateAudience(IScopeProvider scopeProvider)
{
    public const string LimitedProfile = "customer";

    // BypassFilters alone is the background (no user) context, which must not count as staff.
    public bool IsStaff => scopeProvider.Scope is { } scope && (scope.IsInternal || scope.IsTenant || scope.IsDfAdmin);

    public string? CspProfile => IsStaff ? null : LimitedProfile;
}
