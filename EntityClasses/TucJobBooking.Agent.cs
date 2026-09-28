#nullable disable

namespace DespatchWeb.EntityClasses;

// Hand-written partial for tucJobBooking.AgentId — column added by
// dbmigrationsv2/20260526140000_AddAgentIdToTucJobBooking.sql for the
// 3-way Assign Route picker (Steve 2026-05-26). The recurring jobs
// modal needs to write to AgentId (regular agent) and to AgentId +
// NpAgentId together (Network Partner) on the booking template the
// same way the materialised tucJob row carries both columns.
//
// Move this property into the auto-generated TucJobBooking.cs on the
// next EF Core Power Tools regen; this file can be deleted afterwards
// (no nav property to preserve — the picker writes a scalar UcagId).
public partial class TucJobBooking
{
    public int? AgentId { get; set; }
}
