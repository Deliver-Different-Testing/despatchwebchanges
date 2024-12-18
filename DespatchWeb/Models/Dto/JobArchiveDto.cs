using System;
using System.Collections.Generic;
using DespatchWeb.EntityClasses;

namespace DespatchWeb.Models.Dto;

public class JobArchiveDto
{
    public int UcjbId { get; set; }
    public string? Connote { get; set; }
    public DateTime? UcjbTime { get; set; }
    public DateTime? UcjbDate { get; set; }
    public short? UcjbSize { get; set; }
    public short? UcjbQty { get; set; }
    public short? UcjbSpeed { get; set; }
    public float? UcjbWeight { get; set; }
    public int? UcjbClientId { get; set; }
    public string? UcjbClientCode { get; set; }
    public int? ContactId { get; set; }
    public string? UcjbContact { get; set; }
    public bool? UcjbCbd { get; set; }
    public bool? UcjbAttention { get; set; }
    public bool? Reprice { get; set; }
    public bool? Truck { get; set; }
    public bool? UcjbVan { get; set; }
    public bool? VanOk { get; set; }
    public int? InternalStatus { get; set; }
    public DateTime? FollowupTime { get; set; }
    public int? UcjbStatus { get; set; }
    public string? UcjbClientRefa { get; set; }
    public string? UcjbClientRefb { get; set; }
    public string? UcjbOurRef { get; set; }
    public string? PickUpFromContact { get; set; }
    public string? DeliverToContact { get; set; }
    public string? PickUpFromPhone { get; set; }
    public string? DeliverToPhone { get; set; }
    public int? DeliverToLeaveId { get; set; }
    public int? DeliverToPrivateBusiness { get; set; }
    public int? UndeliverableLocationId { get; set; }
    public bool UcjbJobDone { get; set; }
    public DateTime? UcjbComplTime { get; set; }
    public string? UcjbPodname { get; set; }
    public int? Dgclass { get; set; }
    public bool? Dgdocument { get; set; }
    public int? TrackingMethod { get; set; }
    public bool? Direct { get; set; }
    public bool? UcjbVoid { get; set; }
    public string? TrackingMobile { get; set; }
    public string? TrackingEmail { get; set; }
    public decimal? UcjbAmount { get; set; }
    public short? NotifiedJobTypeId { get; set; }
    public short? AcceptedJobTypeId { get; set; }
    public int? UcjbLocked { get; set; }
    public int? ParentId { get; set; }
    public bool? SpeedChangeNotificationHasBeenSent { get; set; }
    public DateTime? WhenSpeedChangeNotificationSent { get; set; }

    // Navigation properties
    public TucClient? UcjbClient { get; set; }
    public TucClientContact? Contact { get; set; }
    public TucJobInternalStatus? InternalStatusNavigation { get; set; }
    public TblUndeliverableLocation? UndeliverableLocation { get; set; }
    public TucJobType? NotifiedJobType { get; set; }
    public TucJobType? SpeedNavigation { get; set; }
    public TblUndeliverableLocation? DeliverToLeave { get; set; }
    public TucJobArchive? Parent { get; set; }
    public IEnumerable<TucJobArchive>? InverseParent { get; set; }
    public TucJobNationwide? Nationwide { get; set; }
}