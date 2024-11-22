using System;
using System.Collections.Generic;
using DespatchWeb.Enums;

namespace DespatchWeb.Constants;

public static class JobStatusGroups
{
    public static readonly List<int> Active = new()
    {
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
    };

    public static readonly List<int> Completed = new()
    {
        (int)JobStatus.Completed,
        (int)JobStatus.Undeliverable,
    };

    // Helper method to check if status is active
    public static bool IsActive(int? status) => status.HasValue && Active.Contains(status.Value);

    // Helper method to check if status is completed
    public static bool IsCompleted(int? status) => status.HasValue && Completed.Contains(status.Value);

    // Helper method to get statuses for a specific group
    public static List<int> GetStatusesForGroup(JobStatusGroup group)
    {
        return group switch
        {
            JobStatusGroup.Active => Active,
            JobStatusGroup.Completed => Completed,
            _ => throw new ArgumentException($"Unsupported status group: {group}")
        };
    }
}
