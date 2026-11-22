using System.Linq.Expressions;
using DespatchWeb.EntityClasses;

namespace DespatchWeb.Helpers;

/// <summary>
/// Which side of a partner hand-off a job is on. IM writes every pairing row with OwnerTenantId = the local tenant on
/// both sides, so ownership can't tell sender from receiver. The receiver's copy is booked under the pairing's
/// connected-tenant client; the sender's job belongs to a real customer. A job whose PartnerJobGuid has been cleared
/// was unlinked and is an ordinary local job again (PartnerPairingId stays as audit).
/// </summary>
public static class PartnerJobDirection
{
    public static readonly Expression<Func<TucJob, bool>> IsOutbound = j =>
        j.PartnerJobGuid != null
        && j.PartnerPairing != null
        && (j.PartnerPairing.ClientId == null || j.UcjbClientId != j.PartnerPairing.ClientId);

    public static readonly Expression<Func<TucJob, bool>> IsInboundCopy = j =>
        j.PartnerJobGuid != null
        && j.PartnerPairing != null
        && j.PartnerPairing.ClientId != null
        && j.UcjbClientId == j.PartnerPairing.ClientId;
}
