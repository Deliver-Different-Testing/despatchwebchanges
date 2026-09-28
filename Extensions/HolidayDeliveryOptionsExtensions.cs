using DespatchWeb.Enums;

namespace DespatchWeb.Extensions;

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