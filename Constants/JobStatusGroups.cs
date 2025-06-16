using System.Collections.Generic;
using DespatchWeb.Enums;

namespace DespatchWeb.Constants;

public static class JobStatusGroups
{
    public static readonly List<int> Active =
    [
        (int)JobStatus.Dispatched,
        (int)JobStatus.New,
        (int)JobStatus.Accepted,
        (int)JobStatus.LatePickup,
        (int)JobStatus.PickedUp,
        (int)JobStatus.Warning,
        (int)JobStatus.LateDelivery,
        (int)JobStatus.AwaitingPod,
        (int)JobStatus.InTransit,
        (int)JobStatus.Acknowledge,
        (int)JobStatus.AssumingCompleted,
        (int)JobStatus.AwaitingProcessing,
        (int)JobStatus.Preassigned,
        (int)JobStatus.Rejected,
        (int)JobStatus.ReadyForPacking,
        (int)JobStatus.ReadyToPickup,
        (int)JobStatus.OutForDelivery
    ];

    public static readonly List<int> Completed =
    [
        (int)JobStatus.Completed,
        (int)JobStatus.Undeliverable
    ];
}
