namespace DespatchWeb.Extensions;

public static class StringExtensions
{
    extension(string? value)
    {
        /// <summary>
        /// Returns the string clipped to <paramref name="maxLength"/> characters, or unchanged if it
        /// already fits (or is null). Used to keep values within their SQL column length so an
        /// over-length insert can't raise SQL Server error 8152 ("String or binary data would be
        /// truncated").
        /// </summary>
        public string? Truncate(int maxLength) =>
            value is not null && value.Length > maxLength ? value[..maxLength] : value;
    }
}
