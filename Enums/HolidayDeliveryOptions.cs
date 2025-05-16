using System;

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


    public static HolidayDeliveryOptions[] GetSelectedOptions(this HolidayDeliveryOptions options) => [options];

    public static bool IsOption(this HolidayDeliveryOptions options, HolidayDeliveryOptions option) =>
        options == option;

    public static HolidayDeliveryOptions FromInt(int value) => (HolidayDeliveryOptions)value;

    public static int ToInt(this HolidayDeliveryOptions options) => (int)options;

    public static HolidayDeliveryOptions ParseFromString(string optionString)
    {
        if (string.IsNullOrWhiteSpace(optionString))
            return HolidayDeliveryOptions.DontBook;

        var sanitizedName = optionString.Trim().ToLowerInvariant();

        switch (sanitizedName)
        {
            case "deliver next day":
                return HolidayDeliveryOptions.DeliverNextDay;
            case "dont book":
            case "don't book":
                return HolidayDeliveryOptions.DontBook;
            case "book anyway":
                return HolidayDeliveryOptions.BookAnyway;
            default:
            {
                if (Enum.TryParse<HolidayDeliveryOptions>(optionString, true, out var option))
                    return option;
                break;
            }
        }

        return HolidayDeliveryOptions.DontBook; // Default
    }

    public static DateTime? ApplyOption(this HolidayDeliveryOptions options, DateTime holidayDate)
    {
        return options switch
        {
            HolidayDeliveryOptions.DontBook => null, // No booking
            HolidayDeliveryOptions.DeliverNextDay => holidayDate.AddDays(1), // Move to next day
            HolidayDeliveryOptions.BookAnyway => holidayDate, //Book anyway
            _ => null // Default is DontBook
        };
    }

    public static string GetHolidayBehaviorDescription(this HolidayDeliveryOptions options)
    {
        return options switch
        {
            HolidayDeliveryOptions.DontBook => "No deliveries will be booked on holidays",
            HolidayDeliveryOptions.DeliverNextDay => "Deliveries will be rescheduled to the next day",
            HolidayDeliveryOptions.BookAnyway => "Deliveries will be booked on the holiday",
            _ => "No deliveries will be booked on holidays" // Default
        };
    }
}
