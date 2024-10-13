using System;
using System.Reflection;
using System.Runtime.Serialization;

namespace DespatchWeb.Helpers;

public static class EnumExtensions
{
    public static T ParseEnumMember<T>(string value) where T : Enum
    {
        var type = typeof(T);
        foreach (var field in type.GetFields())
        {
            var attribute = field.GetCustomAttribute<EnumMemberAttribute>();
            if (attribute != null && attribute.Value == value)
            {
                return (T)field.GetValue(null);
            }
        }

        return default;
    }
}
