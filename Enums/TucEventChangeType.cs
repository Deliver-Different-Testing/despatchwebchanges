using System.ComponentModel;

namespace DespatchWeb.Enums;

public enum TucEventChangeType
{
    [Description("INSERT")] Insert,

    [Description("UPDATE")] Update,

    [Description("DELETE")] Delete
}