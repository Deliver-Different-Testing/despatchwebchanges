namespace DespatchWeb.Enums;

// Mirrors tucClient.ClientTypeId. Values are non-IDENTITY and stable across
// tenants — drives the row-level data-scope predicate selected per request.
// See docs/CLIENT-TYPE-FILTERING-CURRENT-STATE-2026-06-02.md.
public enum ClientType
{
    Internal = 1,
    Customer = 2,
    NetworkPartner = 3,
    Tenant = 4,
    DfrntAdmin = 5,
    ConnectedTenant = 6
}
