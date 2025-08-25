namespace DespatchWeb.Enums;

public enum JobRelationshipTypes
{
    Single = 1,
    UrgentTonight = 2,
    UrgentTonightSingle = 4,
    ReturnParent = 5,
    ReturnChild = 6,
    Multi = 7,
    SplitParent = 8,
    SplitChild = 9,
    Baggage = 10,
    BaggageSingle = 11,
    MedicalRun = 12,
    MedicalRunSingle = 13,
    OverNightPremium = 16,
    OverNightPremiumSingle = 18,
    BulkParent = 19,
    BulkChild = 20
}