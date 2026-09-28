namespace DespatchWeb.Tests.Helpers;

public static class TestDates
{
    public static readonly DateTime Now = new(2024, 6, 15, 14, 30, 0);
    public static readonly DateTime Today = new(2024, 6, 15);
    public static readonly DateTime UtcNow = new(2024, 6, 15, 2, 30, 0, DateTimeKind.Utc);
}
