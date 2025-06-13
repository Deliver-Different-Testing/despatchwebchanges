namespace DespatchWeb.Enums;

public enum HolidayDeliveryOptions
{
    DontBook = 0, // Default option
    DeliverNextDay = 1,
    BookAnyway = 2
}

public static class HolidayDeliveryOptionsExtensions
{
    public static string ToDisplayString(this HolidayDeliveryOptions options) => options switch
    {
        HolidayDeliveryOptions.DontBook => "Don't Book",
        HolidayDeliveryOptions.DeliverNextDay => "Deliver Next Day",
        HolidayDeliveryOptions.BookAnyway => "Book Anyway",
        _ => options.ToString()
    };
}
