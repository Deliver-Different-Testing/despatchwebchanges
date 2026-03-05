using System;
using DespatchWeb.Enums;

namespace DespatchWeb.Extensions;

public static class EventChangeTypeExtensions
{
    public static string ToDbString(this TucEventChangeType changeType) =>
        changeType switch
        {
            TucEventChangeType.Insert => "INSERT",
            TucEventChangeType.Update => "UPDATE",
            TucEventChangeType.Delete => "DELETE",
            _ => throw new ArgumentOutOfRangeException(nameof(changeType))
        };
}