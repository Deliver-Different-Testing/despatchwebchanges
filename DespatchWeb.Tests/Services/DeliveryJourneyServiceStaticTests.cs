using DespatchWeb.Models.Dto;
using DespatchWeb.Services;

namespace DespatchWeb.Tests.Services;

/// <summary>
/// Tests for the internal static helper methods in DeliveryJourneyService.
/// These are pure functions with no database or service dependencies.
/// </summary>
public class DeliveryJourneyServiceStaticTests
{
    #region FormatFieldName

    [Theory]
    [InlineData(null, null)]
    [InlineData("", "")]
    [InlineData("ucjbStatus", "Status")]
    [InlineData("ucjbCourierID", "Courier")]
    [InlineData("ucjbJobDone", "Job Completed")]
    [InlineData("ucjbFromAddr", "Pickup Address")]
    [InlineData("ucjbToAddr", "Delivery Address")]
    [InlineData("ucjbWeight", "Weight")]
    [InlineData("ucjbKm", "Distance (km)")]
    [InlineData("ucjbAmount", "Amount")]
    [InlineData("ucjbClientRefa", "Client Ref A")]
    [InlineData("Connote", "Connote")]
    [InlineData("FuelSurchargeAmount", "Fuel Surcharge")]
    [InlineData("RuralDelivery", "Rural Delivery")]
    [InlineData("PricingBreakdown", "Pricing")]
    public void FormatFieldName_KnownFields_ReturnsExpectedDisplayName(string? fieldName, string? expected)
    {
        var result = DeliveryJourneyService.FormatFieldName(fieldName);

        Assert.Equal(expected, result);
    }

    [Theory]
    [InlineData("PricingTier1", "PricingTier1")]
    [InlineData("PricingZoneRate", "PricingZoneRate")]
    public void FormatFieldName_PricingFields_ReturnedAsIs(string fieldName, string expected)
    {
        var result = DeliveryJourneyService.FormatFieldName(fieldName);

        Assert.Equal(expected, result);
    }

    [Theory]
    [InlineData("CustomNewField", "Custom New Field")]
    [InlineData("ucjbSomeCustomField", "Some Custom Field")]
    public void FormatFieldName_UnknownFields_ConvertedToTitleCase(string fieldName, string expected)
    {
        var result = DeliveryJourneyService.FormatFieldName(fieldName);

        Assert.Equal(expected, result);
    }

    #endregion

    #region GetIconForFieldName

    [Theory]
    [InlineData(null, "edit_note")]
    [InlineData("", "edit_note")]
    [InlineData("ucjbJobDone", "check_circle")]
    [InlineData("ucjbWeight", "scale")]
    [InlineData("ucjbVoid", "cancel")]
    [InlineData("ucjbAttention", "warning")]
    [InlineData("ucjbLocked", "lock")]
    [InlineData("ucjbFromAddr", "location_on")]
    [InlineData("ucjbToAddr", "pin_drop")]
    [InlineData("ucjbAmount", "payments")]
    [InlineData("Connote", "qr_code_2")]
    [InlineData("PricingTier1", "attach_money")]
    [InlineData("SomeUnknownField", "edit_note")]
    public void GetIconForFieldName_ReturnsExpectedIcon(string? fieldName, string expectedIcon)
    {
        var result = DeliveryJourneyService.GetIconForFieldName(fieldName);

        Assert.Equal(expectedIcon, result);
    }

    #endregion

    #region FormatFieldValue

    [Theory]
    [InlineData("ucjbStatus", null, null)]
    [InlineData("ucjbStatus", "", "")]
    public void FormatFieldValue_NullOrEmpty_ReturnsAsIs(string fieldName, string value, string expected)
    {
        var result = DeliveryJourneyService.FormatFieldValue(fieldName, value);

        Assert.Equal(expected, result);
    }

    [Theory]
    [InlineData("ucjbJobDone", "True", "Yes")]
    [InlineData("ucjbJobDone", "true", "Yes")]
    [InlineData("ucjbVoid", "False", "No")]
    [InlineData("ucjbVoid", "false", "No")]
    public void FormatFieldValue_BooleanValues_ConvertedToYesNo(string fieldName, string value, string expected)
    {
        var result = DeliveryJourneyService.FormatFieldValue(fieldName, value);

        Assert.Equal(expected, result);
    }

    [Fact]
    public void FormatFieldValue_CurrencyField_FormattedAsCurrency()
    {
        var result = DeliveryJourneyService.FormatFieldValue("ucjbAmount", "150.50");

        // Currency formatting is locale-dependent, so just verify it parses and formats
        Assert.Contains("150.50", result);
    }

    [Fact]
    public void FormatFieldValue_WeightField_FormattedWithKg()
    {
        var result = DeliveryJourneyService.FormatFieldValue("ucjbWeight", "5.75");

        Assert.Equal("5.75 kg", result);
    }

    [Theory]
    [InlineData("ucjbKm", "12.3", "12.3 km")]
    [InlineData("TotalDistance", "8.0", "8.0 km")]
    public void FormatFieldValue_DistanceFields_FormattedWithKm(string fieldName, string value, string expected)
    {
        var result = DeliveryJourneyService.FormatFieldValue(fieldName, value);

        Assert.Equal(expected, result);
    }

    [Fact]
    public void FormatFieldValue_LongValue_TruncatedWithEllipsis()
    {
        var longValue = new string('A', 60);

        var result = DeliveryJourneyService.FormatFieldValue("ucjbNotes", longValue);

        Assert.Equal(50, result.Length);
        Assert.EndsWith("...", result);
        Assert.StartsWith(new string('A', 47), result);
    }

    [Fact]
    public void FormatFieldValue_NormalValue_ReturnedAsIs()
    {
        var result = DeliveryJourneyService.FormatFieldValue("ucjbNotes", "Short note");

        Assert.Equal("Short note", result);
    }

    [Fact]
    public void FormatFieldValue_InvalidDecimalForCurrency_ReturnedAsIs()
    {
        var result = DeliveryJourneyService.FormatFieldValue("ucjbAmount", "N/A");

        Assert.Equal("N/A", result);
    }

    #endregion

    #region GetDescription (live DTOs)

    [Fact]
    public void GetDescription_Live_StatusChange_ReturnsStatusDescription()
    {
        var updates = new List<JobDeliveryJourneyDto>
        {
            new() { OldJobStatusName = "Booked", NewJobStatusName = "Dispatched" }
        };

        var result = DeliveryJourneyService.GetDescription(updates);

        Assert.Equal("Status: Booked \u2192 Dispatched", result);
    }

    [Fact]
    public void GetDescription_Live_CourierAssigned_ReturnsAssignedDescription()
    {
        var updates = new List<JobDeliveryJourneyDto>
        {
            new() { NewCourierName = "John Smith" }
        };

        var result = DeliveryJourneyService.GetDescription(updates);

        Assert.Equal("Assigned to courier: John Smith", result);
    }

    [Fact]
    public void GetDescription_Live_CourierRemoved_ReturnsRemovedDescription()
    {
        var updates = new List<JobDeliveryJourneyDto>
        {
            new() { OldCourierName = "John Smith" }
        };

        var result = DeliveryJourneyService.GetDescription(updates);

        Assert.Equal("Removed from courier: John Smith", result);
    }

    [Fact]
    public void GetDescription_Live_CourierChanged_ReturnsChangeDescription()
    {
        var updates = new List<JobDeliveryJourneyDto>
        {
            new() { OldCourierName = "John Smith", NewCourierName = "Jane Doe" }
        };

        var result = DeliveryJourneyService.GetDescription(updates);

        Assert.Equal("Courier: John Smith \u2192 Jane Doe", result);
    }

    [Fact]
    public void GetDescription_Live_AgentChange_ReturnsAgentDescription()
    {
        var updates = new List<JobDeliveryJourneyDto>
        {
            new() { OldAgentName = "Agent A", NewAgentName = "Agent B" }
        };

        var result = DeliveryJourneyService.GetDescription(updates);

        Assert.Equal("Agent: Agent A \u2192 Agent B", result);
    }

    [Fact]
    public void GetDescription_Live_AgentAssigned_ReturnsAssignedDescription()
    {
        var updates = new List<JobDeliveryJourneyDto>
        {
            new() { NewAgentName = "Agent B" }
        };

        var result = DeliveryJourneyService.GetDescription(updates);

        Assert.Equal("Assigned to agent: Agent B", result);
    }

    [Fact]
    public void GetDescription_Live_AgentRemoved_ReturnsRemovedDescription()
    {
        var updates = new List<JobDeliveryJourneyDto>
        {
            new() { OldAgentName = "Agent A" }
        };

        var result = DeliveryJourneyService.GetDescription(updates);

        Assert.Equal("Removed from agent: Agent A", result);
    }

    [Fact]
    public void GetDescription_Live_FieldChange_ReturnsFieldDescription()
    {
        var updates = new List<JobDeliveryJourneyDto>
        {
            new() { FieldName = "ucjbWeight", OldValue = "2.0", NewValue = "5.0" }
        };

        var result = DeliveryJourneyService.GetDescription(updates);

        Assert.Equal("Weight: 2.0 \u2192 5.0", result);
    }

    [Fact]
    public void GetDescription_Live_FieldSetOnly_ReturnsSetDescription()
    {
        var updates = new List<JobDeliveryJourneyDto>
        {
            new() { FieldName = "Connote", NewValue = "CON-123" }
        };

        var result = DeliveryJourneyService.GetDescription(updates);

        Assert.Equal("Connote set to: CON-123", result);
    }

    [Fact]
    public void GetDescription_Live_FieldCleared_ReturnsClearedDescription()
    {
        var updates = new List<JobDeliveryJourneyDto>
        {
            new() { FieldName = "ucjbClientRefa", OldValue = "REF-001" }
        };

        var result = DeliveryJourneyService.GetDescription(updates);

        Assert.Equal("Client Ref A cleared (was: REF-001)", result);
    }

    [Fact]
    public void GetDescription_Live_WithComments_IncludesComments()
    {
        var updates = new List<JobDeliveryJourneyDto>
        {
            new() { NewCourierName = "John Smith", Comments = "Urgent reassignment" }
        };

        var result = DeliveryJourneyService.GetDescription(updates);

        Assert.Contains("Assigned to courier: John Smith", result);
        Assert.Contains("Urgent reassignment", result);
    }

    [Fact]
    public void GetDescription_Live_MultipleUpdates_JoinedBySemicolon()
    {
        var updates = new List<JobDeliveryJourneyDto>
        {
            new() { OldJobStatusName = "Booked", NewJobStatusName = "Dispatched" },
            new() { FieldName = "ucjbWeight", NewValue = "5.0" }
        };

        var result = DeliveryJourneyService.GetDescription(updates);

        Assert.Contains("Status: Booked \u2192 Dispatched", result);
        Assert.Contains("Weight set to: 5.0", result);
        Assert.Contains("; ", result);
    }

    #endregion

    #region GetDescription (archive DTOs)

    [Fact]
    public void GetDescription_Archive_StatusChange_ReturnsStatusDescription()
    {
        var updates = new List<JobDeliveryJourneyArchiveDto>
        {
            new() { OldJobStatusName = "Pending", NewJobStatusName = "Completed" }
        };

        var result = DeliveryJourneyService.GetDescription(updates);

        Assert.Equal("Status: Pending \u2192 Completed", result);
    }

    [Fact]
    public void GetDescription_Archive_CourierAssigned_ReturnsAssignedDescription()
    {
        var updates = new List<JobDeliveryJourneyArchiveDto>
        {
            new() { NewCourierName = "Jane Doe" }
        };

        var result = DeliveryJourneyService.GetDescription(updates);

        Assert.Equal("Assigned to courier: Jane Doe", result);
    }

    [Fact]
    public void GetDescription_Archive_CourierRemoved_ReturnsRemovedDescription()
    {
        var updates = new List<JobDeliveryJourneyArchiveDto>
        {
            new() { OldCourierName = "Jane Doe" }
        };

        var result = DeliveryJourneyService.GetDescription(updates);

        Assert.Equal("Removed from courier: Jane Doe", result);
    }

    [Fact]
    public void GetDescription_Archive_FieldChange_ReturnsFieldDescription()
    {
        var updates = new List<JobDeliveryJourneyArchiveDto>
        {
            new() { FieldName = "ucjbAmount", OldValue = "100", NewValue = "200" }
        };

        var result = DeliveryJourneyService.GetDescription(updates);

        Assert.Equal("Amount: 100 \u2192 200", result);
    }

    [Fact]
    public void GetDescription_Archive_MultipleUpdates_JoinedBySemicolon()
    {
        var updates = new List<JobDeliveryJourneyArchiveDto>
        {
            new() { OldAgentName = "Agent A", NewAgentName = "Agent B" },
            new() { FieldName = "Connote", NewValue = "CON-999", Comments = "Updated connote" }
        };

        var result = DeliveryJourneyService.GetDescription(updates);

        Assert.Contains("Agent: Agent A \u2192 Agent B", result);
        Assert.Contains("Connote set to: CON-999", result);
        Assert.Contains("Updated connote", result);
    }

    #endregion

    #region ConvertToTitleCase

    [Theory]
    [InlineData("ucjbSomeField", "Some Field")]
    [InlineData("ucjbCBDZone", "C B D Zone")]
    [InlineData("CustomNewField", "Custom New Field")]
    [InlineData("Simple", "Simple")]
    public void ConvertToTitleCase_ConvertsCorrectly(string fieldName, string expected)
    {
        var result = DeliveryJourneyService.ConvertToTitleCase(fieldName);

        Assert.Equal(expected, result);
    }

    [Fact]
    public void ConvertToTitleCase_StripsUcjbPrefix_CaseInsensitive()
    {
        var result = DeliveryJourneyService.ConvertToTitleCase("UcjbTestField");

        Assert.Equal("Test Field", result);
    }

    #endregion
}
