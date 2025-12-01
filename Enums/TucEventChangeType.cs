using System;
using System.ComponentModel;

namespace DespatchWeb.Enums;

public enum TucEventChangeType
{
    [Description("INSERT")]
    Insert,
    
    [Description("UPDATE")]
    Update,
    
    [Description("DELETE")]
    Delete
}

public static class EventChangeTypeExtensions
{
    public static string ToDbString(this TucEventChangeType changeType)
    {
        return changeType switch
        {
            TucEventChangeType.Insert => "INSERT",
            TucEventChangeType.Update => "UPDATE",
            TucEventChangeType.Delete => "DELETE",
            _ => throw new ArgumentOutOfRangeException(nameof(changeType))
        };
    }
}