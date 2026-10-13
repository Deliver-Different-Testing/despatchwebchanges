namespace DespatchWeb.Models;

public class AddressViewModel
{
    public AddressViewModel(string addressLine1, string addressLine2, string addressLine3, string addressLine4,
        string addressLine5, string addressLine6, string addressLine7, string addressLine8)
    {
        AddressLine1 = addressLine1;
        AddressLine2 = addressLine2;
        AddressLine3 = addressLine3;
        AddressLine4 = addressLine4;
        AddressLine5 = addressLine5;
        AddressLine6 = addressLine6;
        AddressLine7 = addressLine7;
        AddressLine8 = addressLine8;
    }

    public AddressViewModel()
    {
    }

    public string AddressLine1 { get; init; }
    public string AddressLine2 { get; init; }
    public string AddressLine3 { get; init; }
    public string AddressLine4 { get; init; }
    public string AddressLine5 { get; init; }
    public string AddressLine6 { get; init; }
    public string AddressLine7 { get; init; }
    public string AddressLine8 { get; init; }
    public decimal? Latitude { get; init; }
    public decimal? Longitude { get; init; }

    public string FullAddress =>
        string.Join(
            ", ",
            new[]
            {
                AddressLine1,
                AddressLine2,
                AddressLine3,
                AddressLine4,
                AddressLine5,
                AddressLine6,
                AddressLine7,
                AddressLine8
            }.Where(line => !string.IsNullOrWhiteSpace(line))
        );
}
