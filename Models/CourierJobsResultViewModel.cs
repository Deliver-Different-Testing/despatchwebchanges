using System;
using System.Text.Json.Serialization;


namespace DespatchWeb.Models
{
    

    public class Welcome
    {
        [JsonPropertyName("ucjbClientID")]
        public int UcjbClientId { get; set; }

        [JsonPropertyName("ucjbNumber")]
        public string UcjbNumber { get; set; }

        [JsonPropertyName("ucjbDispTime")]
        public string UcjbDispTime { get; set; }

        [JsonPropertyName("ucjbTime")]
        public DateTime UcjbTime { get; set; }

        [JsonPropertyName("ucjbID")]
        public int UcjbId { get; set; }

        [JsonPropertyName("ucjbCourierID")]
        public int UcjbCourierId { get; set; }

        [JsonPropertyName("CourierCode")]
        public string CourierCode { get; set; }

        [JsonPropertyName("SuburbFrom")]
        public string SuburbFrom { get; set; }

        [JsonPropertyName("SuburbTo")]
        public string SuburbTo { get; set; }

        [JsonPropertyName("ucjbSpeed")]
        public int UcjbSpeed { get; set; }

        [JsonPropertyName("ucjbComplTime")]
        public DateTime UcjbComplTime { get; set; }

        [JsonPropertyName("ucjbDispID")]
        public int UcjbDispId { get; set; }

        [JsonPropertyName("ucjbAttention")]
        public int UcjbAttention { get; set; }

        [JsonPropertyName("ucjbPickUpFrom")]
        public int UcjbPickUpFrom { get; set; }

        [JsonPropertyName("RegionFromID")]
        public int RegionFromId { get; set; }

        [JsonPropertyName("RegionToID")]
        public int RegionToId { get; set; }

        [JsonPropertyName("ucjbJobDone")]
        public bool UcjbJobDone { get; set; }

        [JsonPropertyName("ucjbPaged")]
        public bool UcjbPaged { get; set; }

        [JsonPropertyName("ucjbPagedTime")]
        public DateTime UcjbPagedTime { get; set; }

        [JsonPropertyName("ucjbLatePick")]
        public string UcjbLatePick { get; set; }

        [JsonPropertyName("ucjbLateDel")]
        public string UcjbLateDel { get; set; }

        [JsonPropertyName("ucjbContact")]
        public string UcjbContact { get; set; }

        [JsonPropertyName("ucjbToAddr")]
        public string UcjbToAddr { get; set; }

        [JsonPropertyName("ucjbType")]
        public int UcjbType { get; set; }

        [JsonPropertyName("ucjbVoid")]
        public string UcjbVoid { get; set; }

        [JsonPropertyName("ucjbVan")]
        public string UcjbVan { get; set; }

        [JsonPropertyName("ucjbReturn")]
        public string UcjbReturn { get; set; }

        [JsonPropertyName("ucjbDispDate")]
        public string UcjbDispDate { get; set; }

        [JsonPropertyName("ucjbSize")]
        public int UcjbSize { get; set; }

        [JsonPropertyName("ucjbStatus")]
        public int UcjbStatus { get; set; }

        [JsonPropertyName("ucjbDate")]
        public string UcjbDate { get; set; }

        [JsonPropertyName("ucclCode")]
        public string UcclCode { get; set; }

        [JsonPropertyName("ucjbToSpecial")]
        public string UcjbToSpecial { get; set; }

        [JsonPropertyName("ucjsCode")]
        public string UcjsCode { get; set; }

        [JsonPropertyName("SaturdayDelivery")]
        public string SaturdayDelivery { get; set; }

        [JsonPropertyName("EmailForJobFU")]
        public string EmailForJobFu { get; set; }

        [JsonPropertyName("PickupRemain")]
        public string PickupRemain { get; set; }

        [JsonPropertyName("Remain")]
        public int Remain { get; set; }

        [JsonPropertyName("RemainTime")]
        public int RemainTime { get; set; }

        [JsonPropertyName("RemoteJob")]
        public string RemoteJob { get; set; }

        [JsonPropertyName("SpeedShortName")]
        public string SpeedShortName { get; set; }

        [JsonPropertyName("Minutes")]
        public int Minutes { get; set; }

        [JsonPropertyName("PickupTime")]
        public int PickupTime { get; set; }

        [JsonPropertyName("DeliveryTime")]
        public int DeliveryTime { get; set; }

        [JsonPropertyName("AlertLatePickUp")]
        public int AlertLatePickUp { get; set; }

        [JsonPropertyName("AlertLateDelivery")]
        public int AlertLateDelivery { get; set; }

        [JsonPropertyName("OriginalSpeed")]
        public string OriginalSpeed { get; set; }

        [JsonPropertyName("ucjbPODName")]
        public string UcjbPodName { get; set; }

        [JsonPropertyName("NotifiedSpeed")]
        public string NotifiedSpeed { get; set; }

        [JsonPropertyName("Direct")]
        public string Direct { get; set; }

        [JsonPropertyName("FirstJob")]
        public string FirstJob { get; set; }

        [JsonPropertyName("NotifiedJobTypeID")]
        public int NotifiedJobTypeId { get; set; }

        [JsonPropertyName("IsParentJob")]
        public int IsParentJob { get; set; }

        [JsonPropertyName("RootParentID")]
        public int RootParentId { get; set; }

        [JsonPropertyName("DisplaySplitJobDetail")]
        public int DisplaySplitJobDetail { get; set; }

        [JsonPropertyName("DisplayReturnJobDetail")]
        public int DisplayReturnJobDetail { get; set; }

        [JsonPropertyName("DisplayMultiJobDetail")]
        public int DisplayMultiJobDetail { get; set; }

        [JsonPropertyName("IsChildJob")]
        public int IsChildJob { get; set; }

        [JsonPropertyName("AllowSplit")]
        public string AllowSplit { get; set; }

        [JsonPropertyName("ChildNotes")]
        public string ChildNotes { get; set; }

        [JsonPropertyName("AllowDespatch")]
        public string AllowDespatch { get; set; }

        [JsonPropertyName("ClosestCourierID")]
        public string ClosestCourierId { get; set; }

        [JsonPropertyName("JobRelationshipTypeID")]
        public int JobRelationshipTypeId { get; set; }

        [JsonPropertyName("ucclAccountStatus")]
        public int UcclAccountStatus { get; set; }

        [JsonPropertyName("CDT")]
        public int Cdt { get; set; }

        [JsonPropertyName("PickRunOrder")]
        public int PickRunOrder { get; set; }

        [JsonPropertyName("DropRunOrder")]
        public int DropRunOrder { get; set; }

        [JsonPropertyName("ucjbMobileSend")]
        public string UcjbMobileSend { get; set; }

        [JsonPropertyName("SendJobsViaSMS")]
        public string SendJobsViaSms { get; set; }

        [JsonPropertyName("ucjbFromAddr")]
        public string UcjbFromAddr { get; set; }

        [JsonPropertyName("Truck")]
        public string Truck { get; set; }

        [JsonPropertyName("InternalStatus")]
        public string InternalStatus { get; set; }

        [JsonPropertyName("FollowupTime")]
        public string FollowupTime { get; set; }

        [JsonPropertyName("Reprice")]
        public string Reprice { get; set; }

        [JsonPropertyName("SiteID")]
        public int SiteId { get; set; }

        [JsonPropertyName("PickupAmount")]
        public string PickupAmount { get; set; }

        [JsonPropertyName("DropoffAmount")]
        public string DropoffAmount { get; set; }

        [JsonPropertyName("BulletFreight")]
        public string BulletFreight { get; set; }

        [JsonPropertyName("VanOK")]
        public string VanOk { get; set; }

        [JsonPropertyName("DGClass")]
        public string DgClass { get; set; }

        [JsonPropertyName("InternalAccount")]
        public string InternalAccount { get; set; }

        [JsonPropertyName("FromArea")]
        public int FromArea { get; set; }

        [JsonPropertyName("ToArea")]
        public int ToArea { get; set; }

        [JsonPropertyName("FromSuburbID")]
        public int FromSuburbId { get; set; }

        [JsonPropertyName("ToSuburbID")]
        public int ToSuburbId { get; set; }

        [JsonPropertyName("DesCheck")]
        public string DesCheck { get; set; }

        [JsonPropertyName("FDCourierID")]
        public string FdCourierId { get; set; }

        [JsonPropertyName("FDCourierCode")]
        public string FdCourierCode { get; set; }

        [JsonPropertyName("HasGeoLocation")]
        public int HasGeoLocation { get; set; }

        [JsonPropertyName("Code")]
        public int Code { get; set; }

        [JsonPropertyName("intAddress")]
        public string intAddress { get; set; }

        [JsonPropertyName("intAddressFrom")]
        public string intAddressFrom { get; set; }
    }


}

