#nullable enable
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models.RequestModels;

namespace DespatchWeb.Services;

public sealed class PartnerJobGate(
    IJobQueryRepository jobQueryRepository,
    IJobChangeRequestService changeRequestService) : IPartnerJobGate
{
    public async Task<PartnerJobGateResult> EvaluateAsync(int jobId, JobProperty property, string? requestedValue,
        CancellationToken ct)
    {
        if (!await jobQueryRepository.IsPartnerJobAsync(jobId))
            return new PartnerJobGateResult.NotPartner();

        var mapped = MapJobProperty(property);
        return mapped switch
        {
            null => new PartnerJobGateResult.LocalOnly(),
            UnsupportedField => new PartnerJobGateResult.Blocked(
                $"'{property}' cannot be edited on a partner job in this version"),
            _ => await FileChangeRequestAsync(jobId, mapped.Value, requestedValue, reason: null, ct)
        };
    }

    public async Task<PartnerJobGateResult> EvaluateAsync(int jobId, JobChangeField field, string? requestedValue,
        string? reason, CancellationToken ct)
    {
        if (!await jobQueryRepository.IsPartnerJobAsync(jobId))
            return new PartnerJobGateResult.NotPartner();

        return await FileChangeRequestAsync(jobId, field, requestedValue, reason, ct);
    }

    private async Task<PartnerJobGateResult> FileChangeRequestAsync(int jobId, JobChangeField field,
        string? requestedValue, string? reason, CancellationToken ct)
    {
        var result = await changeRequestService.CreateLocalAsync(new CreateJobChangeRequestRequest
        {
            JobId = jobId,
            FieldName = field.ToString(),
            RequestedValue = requestedValue,
            Reason = reason
        }, ct);

        if (!result.Success || result.Request is null)
            return new PartnerJobGateResult.Blocked(result.Message ?? "Failed to file change request");

        return result.Request.Status == JobChangeRequestStatus.Applied
            ? new PartnerJobGateResult.AutoApplied(result.Request.Id)
            : new PartnerJobGateResult.PendingApproval(result.Request.Id);
    }

    // Routing matrix. Three buckets:
    //   - A JobChangeField — the gate files a change request (Auto or Manual per policy).
    //   - null              — LocalOnly: each tenant owns this field independently
    //                         (dispatch state, locks, void, internal status, client refs,
    //                         POD recording, driver events). Caller writes directly.
    //   - UnsupportedField  — known-but-not-implemented for partner jobs. Block with a
    //                         clear message rather than silently fall through to a write.
    //
    // Keep this in sync with JobChangePolicyService.Evaluate when new fields move from
    // "unsupported" to a real classification.
    private static JobChangeField? MapJobProperty(JobProperty property) => property switch
    {
        // Auto-apply
        JobProperty.ConNote => JobChangeField.ConNote,
        JobProperty.RefA => JobChangeField.RefA,
        JobProperty.RefB => JobChangeField.RefB,
        JobProperty.OurRef => JobChangeField.OurRef,
        JobProperty.Attention => JobChangeField.Attention,
        JobProperty.FromContactName => JobChangeField.FromContactName,
        JobProperty.ToContactName => JobChangeField.ToContactName,
        JobProperty.FromContactPhone => JobChangeField.FromContactPhone,
        JobProperty.ToContactPhone => JobChangeField.ToContactPhone,
        JobProperty.TrackingMobile => JobChangeField.TrackingMobile,
        JobProperty.TrackingEmail => JobChangeField.TrackingEmail,
        JobProperty.TrackingMethod => JobChangeField.TrackingMethod,
        JobProperty.Barcode => JobChangeField.Barcode,
        JobProperty.DeliverToLeaveID => JobChangeField.DeliverToLeaveID,

        // Manual — needs counterparty approval
        JobProperty.Date => JobChangeField.Date,
        JobProperty.Time => JobChangeField.Time,
        JobProperty.PuTime => JobChangeField.PuTime,
        JobProperty.DeliverBy => JobChangeField.DeliverBy,
        JobProperty.BookedTime => JobChangeField.BookedTime,
        JobProperty.Items => JobChangeField.Quantity,
        JobProperty.SpeedID => JobChangeField.Speed,
        JobProperty.AcceptedJobTypeID => JobChangeField.AcceptedJobTypeID,
        JobProperty.Direct => JobChangeField.Direct,
        JobProperty.DGClass => JobChangeField.DGClass,
        JobProperty.DGDocumentation => JobChangeField.DGDocumentation,
        JobProperty.Amount => UnsupportedField, // breakdown-driven; partner side doesn't edit Amount directly

        // LocalOnly — each side owns independently. Partner edits permitted without
        // counterparty involvement; no cross-tenant traffic.
        JobProperty.CourierId => null,
        JobProperty.Locked => null,
        JobProperty.Status => null,
        JobProperty.Void => null,
        JobProperty.InternalStatusID => null,
        JobProperty.ClientID => null,
        JobProperty.ClientCode => null,
        JobProperty.ContactID => null,
        JobProperty.PODName => null,
        JobProperty.PodName => null,
        JobProperty.Delivered => null,
        JobProperty.CompletedTime => null,
        JobProperty.PickupArrivalTime => null,
        JobProperty.DeliveryArrivalTime => null,
        JobProperty.Pedal => null,
        JobProperty.Truck => null,
        JobProperty.Van => null,
        JobProperty.VanOK => null,
        JobProperty.FollowupTime => null,
        JobProperty.UndeliverableLocationID => null,
        JobProperty.InactiveBy => null,
        JobProperty.Reprice => null,
        JobProperty.Active => null,
        JobProperty.CustomJobName => null,

        // Compound / entity-tracked fields whose apply path isn't wired into the
        // change-request flow yet. Refuse cleanly so the user sees a real error rather
        // than a silent no-op. Lift these into the JobChangeField mapping as their
        // apply implementations land.
        _ => UnsupportedField
    };

    // Sentinel used by MapJobProperty to distinguish "LocalOnly" (null) from
    // "known-but-not-yet-supported". JobChangeField is non-nullable, so we encode the
    // unsupported case as a distinct enum value that callers branch on.
    private const JobChangeField UnsupportedField = (JobChangeField)int.MinValue;
}
