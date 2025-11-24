namespace DespatchWeb.Enums;

public enum CourierFleet
{
    MainChannel = 1,
    CityChannel = 2,
    PedalChannel = 3,
    Relief = 5,
    CompanyExtras = 6,
    ExCouriers = 7,
    Specials = 8,
    OnNotice = 9,
    Prospective = 10,
    Wellington = 11,
    Woolworths = 12,
    Emergency = 13,
    InTraining = 14,
    UaChristchurch = 15,
    Clients = 16,
    System = 17,
    PedalWlg = 18,
    MainPartTime = 19,
    CityPartTime = 20,
    Holiday = 21,
    FridayFred = 22,
    IdChanged = 23,
    ExCourierShortTerm = 24, // <12 mth
    Agent = 26,
    TruckChannel = 27,
    ClientDriver = 29,
    Library = 30,
    Staff = 31,
    UaAuckland = 32,
    UaTauranga = 33,
    UaWellington = 34,
    UaAucklandP2P = 35,
    UaPalmerstonNorth = 36,
    UaNapierHastings = 37,
    UaHamilton = 38,
    Regional = 39,
    UaFulltime = 40,
    UaGisborne = 41,
    UaNelson = 42,
    ChristchurchSorter = 44,
    AucklandSorter = 45,
    AucklandCs = 46,
    AucklandSupervisor = 47,
    ChristchurchSupervisor = 48,
    HamiltonSupervisor = 49,
    NapierSupervisor = 50,
    NelsonSorter = 51,
    NelsonSupervisor = 52,
    PalmerstonNorthSupervisor = 53,
    TaurangaSupervisor = 54,
    WellingtonSorter = 55,
    WellingtonStaff = 56,
    WellingtonSupervisor = 57,
    AucklandSortSupervisor = 58,
    UaAucklandMonday = 64,
    DndAuckland = 65,
    AucklandCool = 66,
    TaurangaCool = 67,
    WellingtonCool = 68,
    HamiltonCool = 69,
    ChristchurchCool = 70,
    AgentAzap = 71,
    AgentHjBruce = 72
}

public static class CourierFleetExtensions
{
    public static bool IsUrgentArmy(this CourierFleet fleet)
    {
        return fleet switch
        {
            CourierFleet.UaChristchurch or
            CourierFleet.UaAuckland or
            CourierFleet.UaTauranga or
            CourierFleet.UaWellington or
            CourierFleet.UaAucklandP2P or
            CourierFleet.UaPalmerstonNorth or
            CourierFleet.UaNapierHastings or
            CourierFleet.UaHamilton or
            CourierFleet.UaFulltime or
            CourierFleet.UaGisborne or
            CourierFleet.UaNelson or
            CourierFleet.UaAucklandMonday => true,
            _ => false
        };
    }
}