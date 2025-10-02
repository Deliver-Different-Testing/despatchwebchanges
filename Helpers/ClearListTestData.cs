using DespatchWeb.Models;

namespace DespatchWeb.Helpers;

public static class ClearListTestData
{
    public static ClearListViewModel GenerateClearListViewModel()
    {
        return new ClearListViewModel
        {
            Areas =
            [
                GetCentral1(),
                GetWestMid0(),
                GetEastMid10(),
                GetMangere3()
            ]
        };
    }

    private static AreaClearList GetCentral1()
    {
        return new AreaClearList
        {
            Id = 1,
            Name = "Central 1",
            Order = 1,
            PercentHeight = 25,
            TotalRemaining = 43,
            Top =
            [
                new ClearListSection
                {
                    CourierNumber = "43",
                    JobCount = 12,
                    CourierData = new CourierData
                    {
                        Courier = "43",
                        Location = "Central Auckland",
                        Pu = "15",
                        Del = "12",
                        Lrm = "8",
                        Eta2Lrm = "25m",
                        CourierId = 43,
                        CourierName = "John Smith",
                        CourierMobile = "(021) 555-0043"
                    },
                    Destinations =
                    [
                        new Destination { Id = 1, Label = "A1" },
                        new Destination { Id = 2, Label = "C1" }
                    ]
                },
                new ClearListSection
                {
                    CourierNumber = "44",
                    JobCount = 8,
                    CourierData = new CourierData
                    {
                        Courier = "44",
                        Location = "City Central",
                        Pu = "18",
                        Del = "14",
                        Lrm = "10",
                        Eta2Lrm = "30m",
                        CourierId = 44,
                        CourierName = "Sarah Wilson",
                        CourierMobile = "(021) 555-0044"
                    },
                    Destinations =
                    [
                        new Destination { Id = 3, Label = "S1" },
                        new Destination { Id = 4, Label = "C1" }
                    ]
                }
            ],
            Middle =
            [
                new ClearListSection
                {
                    CourierNumber = "11",
                    JobCount = 15,
                    CourierData = new CourierData
                    {
                        Courier = "11",
                        Location = "South Central",
                        Pu = "8",
                        Del = "6",
                        Lrm = "4",
                        Eta2Lrm = "15m",
                        CourierId = 11,
                        CourierName = "Mike Johnson",
                        CourierMobile = "(021) 555-0011"
                    },
                    Destinations = [new Destination { Id = 5, Label = "S1" }]
                },
                new ClearListSection
                {
                    CourierNumber = "5080",
                    JobCount = 18,
                    CourierData = new CourierData
                    {
                        Courier = "5080",
                        Location = "Special Delivery",
                        Pu = "120",
                        Del = "80",
                        Lrm = "40",
                        Eta2Lrm = "45m",
                        CourierId = 5080,
                        CourierName = "Team Lead",
                        CourierMobile = "(021) 555-5080"
                    },
                    Destinations = [new Destination { Id = 6, Label = "SD" }]
                }
            ],
            Bottom =
            [
                new ClearListSection
                {
                    CourierNumber = "97",
                    JobCount = 7,
                    CourierData = new CourierData
                    {
                        Courier = "97",
                        Location = "West Auckland",
                        Pu = "25",
                        Del = "18",
                        Lrm = "12",
                        Eta2Lrm = "35m",
                        CourierId = 97,
                        CourierName = "Emma Davis",
                        CourierMobile = "(021) 555-0097"
                    },
                    Destinations = [new Destination { Id = 7, Label = "W3" }]
                },
                new ClearListSection
                {
                    CourierNumber = "33",
                    JobCount = 11,
                    CourierData = new CourierData
                    {
                        Courier = "33",
                        Location = "East Auckland",
                        Pu = "12",
                        Del = "9",
                        Lrm = "6",
                        Eta2Lrm = "20m",
                        CourierId = 33,
                        CourierName = "James Brown",
                        CourierMobile = "(021) 555-0033"
                    },
                    Destinations = [new Destination { Id = 8, Label = "E2" }]
                }
            ]
        };
    }

    private static AreaClearList GetWestMid0()
    {
        return new AreaClearList
        {
            Id = 2,
            Name = "West Mid 0",
            Order = 2,
            PercentHeight = 25,
            TotalRemaining = 52,
            Top =
            [
                new ClearListSection
                {
                    CourierNumber = "3",
                    JobCount = 14,
                    CourierData = new CourierData
                    {
                        Courier = "3",
                        Location = "East",
                        Pu = "4",
                        Del = "3",
                        Lrm = "2",
                        Eta2Lrm = "10m",
                        CourierId = 3,
                        CourierName = "David Chen",
                        CourierMobile = "(021) 555-0003"
                    },
                    Destinations = [new Destination { Id = 9, Label = "E1" }]
                },
                new ClearListSection
                {
                    CourierNumber = "52",
                    JobCount = 9,
                    CourierData = new CourierData
                    {
                        Courier = "52",
                        Location = "Mid Region",
                        Pu = "20",
                        Del = "15",
                        Lrm = "10",
                        Eta2Lrm = "28m",
                        CourierId = 52,
                        CourierName = "Lisa Wang",
                        CourierMobile = "(021) 555-0052"
                    },
                    Destinations = [new Destination { Id = 10, Label = "M2" }]
                }
            ],
            Middle =
            [
                new ClearListSection
                {
                    CourierNumber = "120",
                    JobCount = 20,
                    CourierData = new CourierData
                    {
                        Courier = "120",
                        Location = "South",
                        Pu = "35",
                        Del = "25",
                        Lrm = "15",
                        Eta2Lrm = "40m",
                        CourierId = 120,
                        CourierName = "Robert Taylor",
                        CourierMobile = "(021) 555-0120"
                    },
                    Destinations = [new Destination { Id = 11, Label = "S1" }]
                },
                new ClearListSection
                {
                    CourierNumber = "121",
                    JobCount = 16,
                    CourierData = new CourierData
                    {
                        Courier = "121",
                        Location = "Central",
                        Pu = "40",
                        Del = "30",
                        Lrm = "18",
                        Eta2Lrm = "42m",
                        CourierId = 121,
                        CourierName = "Maria Garcia",
                        CourierMobile = "(021) 555-0121"
                    },
                    Destinations = [new Destination { Id = 12, Label = "C1" }]
                }
            ],
            Bottom = 
            [
                new ClearListSection
                {
                    CourierNumber = "99",
                    JobCount = 5,
                    CourierData = new CourierData
                    {
                        Courier = "99",
                        Location = "Shallow West",
                        Pu = "28",
                        Del = "20",
                        Lrm = "14",
                        Eta2Lrm = "35m",
                        CourierId = 99,
                        CourierName = "Tom Harris",
                        CourierMobile = "(021) 555-0099"
                    },
                    Destinations = [new Destination { Id = 13, Label = "M1" }]
                }
            ]
        };
    }

    private static AreaClearList GetEastMid10()
    {
        return new AreaClearList
        {
            Id = 3,
            Name = "East Mid 10",
            Order = 3,
            PercentHeight = 25,
            TotalRemaining = 35,
            Top =
            [
                new ClearListSection
                {
                    CourierNumber = "35",
                    JobCount = 35,
                    CourierData = new CourierData
                    {
                        Courier = "35",
                        Location = "District 1",
                        Pu = "14",
                        Del = "10",
                        Lrm = "7",
                        Eta2Lrm = "22m",
                        CourierId = 35,
                        CourierName = "Kevin Lee",
                        CourierMobile = "(021) 555-0035"
                    },
                    Destinations = [new Destination { Id = 14, Label = "D1" }]
                },
                new ClearListSection
                {
                    CourierNumber = "53",
                    JobCount = 53,
                    CourierData = new CourierData
                    {
                        Courier = "53",
                        Location = "Area 3",
                        Pu = "22",
                        Del = "16",
                        Lrm = "11",
                        Eta2Lrm = "32m",
                        CourierId = 53,
                        CourierName = "Amy Thompson",
                        CourierMobile = "(021) 555-0053"
                    },
                    Destinations = [new Destination { Id = 15, Label = "A3" }]
                }
            ],
            Middle =
            [
                new ClearListSection
                {
                    CourierNumber = "113",
                    JobCount = 113,
                    CourierData = new CourierData
                    {
                        Courier = "113",
                        Location = "Central 3",
                        Pu = "45",
                        Del = "32",
                        Lrm = "20",
                        Eta2Lrm = "48m",
                        CourierId = 113,
                        CourierName = "Peter Zhang",
                        CourierMobile = "(021) 555-0113"
                    },
                    Destinations = [new Destination { Id = 16, Label = "C3" }]
                },
                new ClearListSection
                {
                    CourierNumber = "31",
                    JobCount = 31,
                    CourierData = new CourierData
                    {
                        Courier = "31",
                        Location = "Central 1",
                        Pu = "12",
                        Del = "9",
                        Lrm = "6",
                        Eta2Lrm = "18m",
                        CourierId = 31,
                        CourierName = "Sophie Martin",
                        CourierMobile = "(021) 555-0031"
                    },
                    Destinations = [new Destination { Id = 17, Label = "C1" }]
                }
            ],
            Bottom = 
            [
                new ClearListSection
                {
                    CourierNumber = "161",
                    JobCount = 161,
                    CourierData = new CourierData
                    {
                        Courier = "161",
                        Location = "East 1",
                        Pu = "48",
                        Del = "35",
                        Lrm = "22",
                        Eta2Lrm = "50m",
                        CourierId = 161,
                        CourierName = "Mark Robinson",
                        CourierMobile = "(021) 555-0161"
                    },
                    Destinations = [new Destination { Id = 18, Label = "E1" }]
                },
                new ClearListSection
                {
                    CourierNumber = "21",
                    JobCount = 21,
                    CourierData = new CourierData
                    {
                        Courier = "21",
                        Location = "East 2",
                        Pu = "10",
                        Del = "7",
                        Lrm = "5",
                        Eta2Lrm = "15m",
                        CourierId = 21,
                        CourierName = "Rachel Green",
                        CourierMobile = "(021) 555-0021"
                    },
                    Destinations = [new Destination { Id = 19, Label = "E2" }]
                },
                new ClearListSection
                {
                    CourierNumber = "2",
                    JobCount = 2,
                    CourierData = new CourierData
                    {
                        Courier = "2",
                        Location = "District 2",
                        Pu = "3",
                        Del = "2",
                        Lrm = "1",
                        Eta2Lrm = "8m",
                        CourierId = 2,
                        CourierName = "Chris White",
                        CourierMobile = "(021) 555-0002"
                    },
                    Destinations = [new Destination { Id = 20, Label = "D2" }]
                }
            ]
        };
    }

    private static AreaClearList GetMangere3()
    {
        return new AreaClearList
        {
            Id = 4,
            Name = "Mangere 3",
            Order = 4,
            PercentHeight = 25,
            TotalRemaining = 69,
            Top =
            [
                new ClearListSection
                {
                    CourierNumber = "69",
                    JobCount = 69,
                    CourierData = new CourierData
                    {
                        Courier = "69",
                        Location = "Airport Area",
                        Pu = "28",
                        Del = "20",
                        Lrm = "14",
                        Eta2Lrm = "38m",
                        CourierId = 69,
                        CourierName = "Jason Kim",
                        CourierMobile = "(021) 555-0069"
                    },
                    Destinations = [new Destination { Id = 21, Label = "A1" }]
                },
                new ClearListSection
                {
                    CourierNumber = "51",
                    JobCount = 51,
                    CourierData = new CourierData
                    {
                        Courier = "51",
                        Location = "West 2",
                        Pu = "20",
                        Del = "15",
                        Lrm = "10",
                        Eta2Lrm = "30m",
                        CourierId = 51,
                        CourierName = "Michelle Park",
                        CourierMobile = "(021) 555-0051"
                    },
                    Destinations = [new Destination { Id = 22, Label = "W2" }]
                }
            ],
            Middle =
            [
                new ClearListSection
                {
                    CourierNumber = "181",
                    JobCount = 181,
                    CourierData = new CourierData
                    {
                        Courier = "181",
                        Location = "East 1",
                        Pu = "60",
                        Del = "42",
                        Lrm = "25",
                        Eta2Lrm = "55m",
                        CourierId = 181,
                        CourierName = "Daniel Moore",
                        CourierMobile = "(021) 555-0181"
                    },
                    Destinations = [new Destination { Id = 23, Label = "E1" }]
                },
                new ClearListSection
                {
                    CourierNumber = "17",
                    JobCount = 17,
                    CourierData = new CourierData
                    {
                        Courier = "17",
                        Location = "Mid 1",
                        Pu = "8",
                        Del = "6",
                        Lrm = "4",
                        Eta2Lrm = "12m",
                        CourierId = 17,
                        CourierName = "Jessica Adams",
                        CourierMobile = "(021) 555-0017"
                    },
                    Destinations = [new Destination { Id = 24, Label = "M1" }]
                },
                new ClearListSection
                {
                    CourierNumber = "32",
                    JobCount = 32,
                    CourierData = new CourierData
                    {
                        Courier = "32",
                        Location = "Central 1",
                        Pu = "14",
                        Del = "10",
                        Lrm = "7",
                        Eta2Lrm = "20m",
                        CourierId = 32,
                        CourierName = "Andrew Nelson",
                        CourierMobile = "(021) 555-0032"
                    },
                    Destinations = [new Destination { Id = 25, Label = "C1" }]
                },
                new ClearListSection
                {
                    CourierNumber = "86",
                    JobCount = 86,
                    CourierData = new CourierData
                    {
                        Courier = "86",
                        Location = "Airport 1",
                        Pu = "30",
                        Del = "22",
                        Lrm = "15",
                        Eta2Lrm = "40m",
                        CourierId = 86,
                        CourierName = "Linda Scott",
                        CourierMobile = "(021) 555-0086"
                    },
                    Destinations = [new Destination { Id = 26, Label = "A1" }]
                },
                new ClearListSection
                {
                    CourierNumber = "88",
                    JobCount = 88,
                    CourierData = new CourierData
                    {
                        Courier = "88",
                        Location = "Airport 2",
                        Pu = "32",
                        Del = "24",
                        Lrm = "16",
                        Eta2Lrm = "42m",
                        CourierId = 88,
                        CourierName = "Steve Turner",
                        CourierMobile = "(021) 555-0088"
                    },
                    Destinations = [new Destination { Id = 27, Label = "A2" }]
                }
            ],
            Bottom = 
            [
                new ClearListSection
                {
                    CourierNumber = "106",
                    JobCount = 106,
                    CourierData = new CourierData
                    {
                        Courier = "106",
                        Location = "Deep South 4",
                        Pu = "38",
                        Del = "28",
                        Lrm = "18",
                        Eta2Lrm = "45m",
                        CourierId = 106,
                        CourierName = "George Hall",
                        CourierMobile = "(021) 555-0106"
                    },
                    Destinations = [new Destination { Id = 28, Label = "C2" }]
                },
                new ClearListSection
                {
                    CourierNumber = "5173",
                    JobCount = 5173,
                    CourierData = new CourierData
                    {
                        Courier = "5173",
                        Location = "Deep East",
                        Pu = "150",
                        Del = "110",
                        Lrm = "60",
                        Eta2Lrm = "90m",
                        CourierId = 5173,
                        CourierName = "Team East",
                        CourierMobile = "(021) 555-5173"
                    },
                    Destinations = [new Destination { Id = 29, Label = "SD" }]
                },
                new ClearListSection
                {
                    CourierNumber = "11",
                    JobCount = 11,
                    CourierData = new CourierData
                    {
                        Courier = "11",
                        Location = "East 3",
                        Pu = "6",
                        Del = "4",
                        Lrm = "3",
                        Eta2Lrm = "10m",
                        CourierId = 11,
                        CourierName = "Nancy Walker",
                        CourierMobile = "(021) 555-0011"
                    },
                    Destinations = [new Destination { Id = 30, Label = "E3" }]
                },
                new ClearListSection
                {
                    CourierNumber = "28",
                    JobCount = 28,
                    CourierData = new CourierData
                    {
                        Courier = "28",
                        Location = "Central 1",
                        Pu = "11",
                        Del = "8",
                        Lrm = "6",
                        Eta2Lrm = "18m",
                        CourierId = 28,
                        CourierName = "Paul Wright",
                        CourierMobile = "(021) 555-0028"
                    },
                    Destinations = [new Destination { Id = 31, Label = "C1" }]
                },
                new ClearListSection
                {
                    CourierNumber = "73",
                    JobCount = 73,
                    CourierData = new CourierData
                    {
                        Courier = "73",
                        Location = "District West 2",
                        Pu = "26",
                        Del = "19",
                        Lrm = "13",
                        Eta2Lrm = "35m",
                        CourierId = 73,
                        CourierName = "Helen Lee",
                        CourierMobile = "(021) 555-0073"
                    },
                    Destinations = [new Destination { Id = 32, Label = "DW" }]
                }
            ]
        };
    }
}