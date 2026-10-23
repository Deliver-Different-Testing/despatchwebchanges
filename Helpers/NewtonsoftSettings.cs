using Newtonsoft.Json;

namespace DespatchWeb.Helpers;

public static class NewtonsoftSettings
{
    public static void Apply(JsonSerializerSettings settings)
    {
        settings.DateTimeZoneHandling = DateTimeZoneHandling.RoundtripKind;
        settings.DateParseHandling = DateParseHandling.DateTimeOffset;
    }
}
