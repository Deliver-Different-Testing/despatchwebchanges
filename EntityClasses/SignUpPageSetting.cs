namespace DespatchWeb.EntityClasses;

/// <summary>The sign-up app's settings row (SignUpPageSettingsId = 1). DespatchWeb only reads the map centre.</summary>
public class SignUpPageSetting
{
    public int SignUpPageSettingsId { get; set; }

    public decimal MapCenterLatitude { get; set; }

    public decimal MapCenterLongitude { get; set; }
}
