namespace DespatchWeb.Enums;

public enum ScanType
{
    Sort = 0,
    Transfer = 13,
    Pickup = 14,
    InvalidPickup = 18,
    AlternateSort = 19,  // Since both 0 and 19 map to "Sort"
    Run = 20,
    InvalidRun = 21,
    Transit = 22,
    InwardsDepot = 23
}