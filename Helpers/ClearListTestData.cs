using DespatchWeb.Models;

namespace DespatchWeb.Helpers;

public static class ClearListTestData
{
    public static ClearListViewModel GetTopFiveUsCities()
    {
        return new ClearListViewModel
        {
            Areas =
            [
                GetNewYorkCity(),
                GetLosAngeles(),
                GetChicago(),
                GetHouston(),
                GetPhoenix()
            ]
        };
    }

    private static AreaClearList GetNewYorkCity()
    {
        return new AreaClearList
        {
            Id = 1,
            Name = "New York City",
            Order = 1,
            PercentHeight = 33,
            TotalRemaining = 45,
            Top =
            [
                new ClearListSection
                {
                    CourierNumber = "NYC001",
                    JobCount = 8,
                    CourierData = new CourierData
                    {
                        Courier = "NYC001",
                        Location = "Manhattan - Midtown",
                        Pu = "12",
                        Del = "8",
                        Lrm = "5",
                        Eta2Lrm = "15m",
                        CourierId = 1001,
                        CourierName = "John Smith",
                        CourierMobile = "(212) 555-0101"
                    },
                    Destinations =
                    [
                        new Destination { Id = 1, Label = "Empire State Building" },
                        new Destination { Id = 2, Label = "Times Square" },
                        new Destination { Id = 3, Label = "Central Park South" }
                    ]
                }
            ],
            Middle =
            [
                new ClearListSection
                {
                    CourierNumber = "NYC002",
                    JobCount = 12,
                    CourierData = new CourierData
                    {
                        Courier = "NYC002",
                        Location = "Brooklyn - Downtown",
                        Pu = "15",
                        Del = "10",
                        Lrm = "8",
                        Eta2Lrm = "22m",
                        CourierId = 1002,
                        CourierName = "Maria Rodriguez",
                        CourierMobile = "(718) 555-0102"
                    },
                    Destinations =
                    [
                        new Destination { Id = 4, Label = "Brooklyn Bridge Park" },
                        new Destination { Id = 5, Label = "DUMBO" }
                    ]
                }
            ],
            Bottom =
            [
                new ClearListSection
                {
                    CourierNumber = "NYC003",
                    JobCount = 6,
                    CourierData = new CourierData
                    {
                        Courier = "NYC003",
                        Location = "Queens - Astoria",
                        Pu = "8",
                        Del = "5",
                        Lrm = "3",
                        Eta2Lrm = "18m",
                        CourierId = 1003,
                        CourierName = "David Chen",
                        CourierMobile = "(347) 555-0103"
                    },
                    Destinations = [new Destination { Id = 6, Label = "Queensboro Plaza" }]
                }
            ]
        };
    }

    private static AreaClearList GetLosAngeles()
    {
        return new AreaClearList
        {
            Id = 2,
            Name = "Los Angeles",
            Order = 2,
            PercentHeight = 33,
            TotalRemaining = 38,
            Top =
            [
                new ClearListSection
                {
                    CourierNumber = "LA001",
                    JobCount = 10,
                    CourierData = new CourierData
                    {
                        Courier = "LA001",
                        Location = "Downtown LA",
                        Pu = "14",
                        Del = "9",
                        Lrm = "6",
                        Eta2Lrm = "20m",
                        CourierId = 2001,
                        CourierName = "Michael Johnson",
                        CourierMobile = "(213) 555-0201"
                    },
                    Destinations =
                    [
                        new Destination { Id = 7, Label = "Staples Center" },
                        new Destination { Id = 8, Label = "LA Live" },
                        new Destination { Id = 9, Label = "Grand Central Market" }
                    ]
                }
            ],
            Middle =
            [
                new ClearListSection
                {
                    CourierNumber = "LA002",
                    JobCount = 15,
                    CourierData = new CourierData
                    {
                        Courier = "LA002",
                        Location = "Santa Monica",
                        Pu = "18",
                        Del = "12",
                        Lrm = "10",
                        Eta2Lrm = "25m",
                        CourierId = 2002,
                        CourierName = "Sarah Williams",
                        CourierMobile = "(310) 555-0202"
                    },
                    Destinations =
                    [
                        new Destination { Id = 10, Label = "Santa Monica Pier" },
                        new Destination { Id = 11, Label = "Third Street Promenade" }
                    ]
                }
            ],
            Bottom =
            [
                new ClearListSection
                {
                    CourierNumber = "LA003",
                    JobCount = 7,
                    CourierData = new CourierData
                    {
                        Courier = "LA003",
                        Location = "Hollywood",
                        Pu = "10",
                        Del = "6",
                        Lrm = "4",
                        Eta2Lrm = "12m",
                        CourierId = 2003,
                        CourierName = "Carlos Martinez",
                        CourierMobile = "(323) 555-0203"
                    },
                    Destinations = [new Destination { Id = 12, Label = "Hollywood & Highland" }]
                }
            ]
        };
    }

    private static AreaClearList GetChicago()
    {
        return new AreaClearList
        {
            Id = 3,
            Name = "Chicago",
            Order = 3,
            PercentHeight = 33,
            TotalRemaining = 32,
            Top =
            [
                new ClearListSection
                {
                    CourierNumber = "CHI001",
                    JobCount = 9,
                    CourierData = new CourierData
                    {
                        Courier = "CHI001",
                        Location = "Loop",
                        Pu = "11",
                        Del = "7",
                        Lrm = "5",
                        Eta2Lrm = "14m",
                        CourierId = 3001,
                        CourierName = "James Anderson",
                        CourierMobile = "(312) 555-0301"
                    },
                    Destinations =
                    [
                        new Destination { Id = 13, Label = "Willis Tower" },
                        new Destination { Id = 14, Label = "Millennium Park" }
                    ]
                }
            ],
            Middle =
            [
                new ClearListSection
                {
                    CourierNumber = "CHI002",
                    JobCount = 11,
                    CourierData = new CourierData
                    {
                        Courier = "CHI002",
                        Location = "River North",
                        Pu = "13",
                        Del = "9",
                        Lrm = "7",
                        Eta2Lrm = "19m",
                        CourierId = 3002,
                        CourierName = "Patricia Lee",
                        CourierMobile = "(773) 555-0302"
                    },
                    Destinations =
                    [
                        new Destination { Id = 15, Label = "Navy Pier" },
                        new Destination { Id = 16, Label = "Magnificent Mile" }
                    ]
                }
            ],
            Bottom =
            [
                new ClearListSection
                {
                    CourierNumber = "CHI003",
                    JobCount = 5,
                    CourierData = new CourierData
                    {
                        Courier = "CHI003",
                        Location = "Wicker Park",
                        Pu = "7",
                        Del = "4",
                        Lrm = "2",
                        Eta2Lrm = "10m",
                        CourierId = 3003,
                        CourierName = "Robert Taylor",
                        CourierMobile = "(872) 555-0303"
                    },
                    Destinations = [new Destination { Id = 17, Label = "Division Street" }]
                }
            ]
        };
    }

    private static AreaClearList GetHouston()
    {
        return new AreaClearList
        {
            Id = 4,
            Name = "Houston",
            Order = 4,
            PercentHeight = 33,
            TotalRemaining = 28,
            Top =
            [
                new ClearListSection
                {
                    CourierNumber = "HOU001",
                    JobCount = 8,
                    CourierData = new CourierData
                    {
                        Courier = "HOU001",
                        Location = "Downtown Houston",
                        Pu = "10",
                        Del = "6",
                        Lrm = "4",
                        Eta2Lrm = "16m",
                        CourierId = 4001,
                        CourierName = "Jennifer Garcia",
                        CourierMobile = "(713) 555-0401"
                    },
                    Destinations =
                    [
                        new Destination { Id = 18, Label = "Minute Maid Park" },
                        new Destination { Id = 19, Label = "Discovery Green" }
                    ]
                }
            ],
            Middle =
            [
                new ClearListSection
                {
                    CourierNumber = "HOU002",
                    JobCount = 13,
                    CourierData = new CourierData
                    {
                        Courier = "HOU002",
                        Location = "Galleria",
                        Pu = "16",
                        Del = "11",
                        Lrm = "8",
                        Eta2Lrm = "23m",
                        CourierId = 4002,
                        CourierName = "Thomas Nguyen",
                        CourierMobile = "(281) 555-0402"
                    },
                    Destinations =
                    [
                        new Destination { Id = 20, Label = "Galleria Mall" },
                        new Destination { Id = 21, Label = "Highland Village" }
                    ]
                }
            ],
            Bottom =
            [
                new ClearListSection
                {
                    CourierNumber = "HOU003",
                    JobCount = 4,
                    CourierData = new CourierData
                    {
                        Courier = "HOU003",
                        Location = "Midtown",
                        Pu = "6",
                        Del = "3",
                        Lrm = "2",
                        Eta2Lrm = "11m",
                        CourierId = 4003,
                        CourierName = "Lisa Thompson",
                        CourierMobile = "(832) 555-0403"
                    },
                    Destinations = [new Destination { Id = 22, Label = "Museum District" }]
                }
            ]
        };
    }

    private static AreaClearList GetPhoenix()
    {
        return new AreaClearList
        {
            Id = 5,
            Name = "Phoenix",
            Order = 5,
            PercentHeight = 33,
            TotalRemaining = 25,
            Top =
            [
                new ClearListSection
                {
                    CourierNumber = "PHX001",
                    JobCount = 7,
                    CourierData = new CourierData
                    {
                        Courier = "PHX001",
                        Location = "Downtown Phoenix",
                        Pu = "9",
                        Del = "5",
                        Lrm = "3",
                        Eta2Lrm = "13m",
                        CourierId = 5001,
                        CourierName = "Christopher White",
                        CourierMobile = "(602) 555-0501"
                    },
                    Destinations =
                    [
                        new Destination { Id = 23, Label = "Chase Field" },
                        new Destination { Id = 24, Label = "Roosevelt Row" }
                    ]
                }
            ],
            Middle =
            [
                new ClearListSection
                {
                    CourierNumber = "PHX002",
                    JobCount = 10,
                    CourierData = new CourierData
                    {
                        Courier = "PHX002",
                        Location = "Scottsdale",
                        Pu = "12",
                        Del = "8",
                        Lrm = "6",
                        Eta2Lrm = "21m",
                        CourierId = 5002,
                        CourierName = "Amanda Harris",
                        CourierMobile = "(480) 555-0502"
                    },
                    Destinations =
                    [
                        new Destination { Id = 25, Label = "Old Town Scottsdale" },
                        new Destination { Id = 26, Label = "Fashion Square" }
                    ]
                }
            ],
            Bottom =
            [
                new ClearListSection
                {
                    CourierNumber = "PHX003",
                    JobCount = 6,
                    CourierData = new CourierData
                    {
                        Courier = "PHX003",
                        Location = "Tempe",
                        Pu = "8",
                        Del = "5",
                        Lrm = "3",
                        Eta2Lrm = "15m",
                        CourierId = 5003,
                        CourierName = "Daniel Martinez",
                        CourierMobile = "(623) 555-0503"
                    },
                    Destinations = [new Destination { Id = 27, Label = "Mill Avenue" }]
                }
            ]
        };
    }
}