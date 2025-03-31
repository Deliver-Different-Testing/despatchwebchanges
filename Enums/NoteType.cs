using System;
using System.ComponentModel;

namespace DespatchWeb.Enums;

public enum NoteType
{
    [Description("Internal Note")] InternalNote = 1,

    [Description("Client Note")] ClientNote = 2,

    [Description("Flight Update")] FlightUpdate = 3,

    [Description("Agent Update")] AgentUpdate = 4,

    [Description("Consignment Note")] ConsignmentNote = 4
}

public static class NoteTypeExtensions
{
    public static bool IsPublic(this NoteType noteType)
    {
        return noteType switch
        {
            NoteType.ClientNote => true,
            _ => false
        };
    }

    public static string GetDescription(this NoteType noteType)
    {
        var field = noteType.GetType().GetField(noteType.ToString());
        if (field == null) return noteType.ToString();

        var attribute = Attribute.GetCustomAttribute(field, typeof(DescriptionAttribute)) as DescriptionAttribute;
        return attribute?.Description ?? noteType.ToString();
    }
}
