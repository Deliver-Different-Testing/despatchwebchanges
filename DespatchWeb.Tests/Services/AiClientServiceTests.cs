using DespatchWeb.Services;

namespace DespatchWeb.Tests.Services;

/// <summary>
/// Tests for the internal static parsing methods in AiClientService.
/// </summary>
public class AiClientServiceTests
{
    [Fact]
    public void ParseToolProperties_ValidJson_ReturnsDictionaryWithCorrectKeys()
    {
        const string json =
            """{"properties": {"name": {"type": "string"}, "age": {"type": "integer"}}, "required": ["name"]}""";

        var result = AiClientService.ParseToolProperties(json);

        Assert.Equal(2, result.Count);
        Assert.True(result.ContainsKey("name"));
        Assert.True(result.ContainsKey("age"));
    }

    [Fact]
    public void ParseToolProperties_NoPropertiesKey_ReturnsEmptyDictionary()
    {
        const string json = """{"required": ["name"]}""";

        var result = AiClientService.ParseToolProperties(json);

        Assert.Empty(result);
    }

    [Fact]
    public void ParseToolProperties_NestedProperties_ValuesArePreserved()
    {
        const string json =
            """{"properties": {"address": {"type": "object", "properties": {"street": {"type": "string"}}}}}""";

        var result = AiClientService.ParseToolProperties(json);

        Assert.Single(result);
        Assert.True(result.ContainsKey("address"));

        var addressElement = result["address"];
        Assert.True(addressElement.TryGetProperty("properties", out var nested));
        Assert.True(nested.TryGetProperty("street", out _));
    }

    [Fact]
    public void ParseToolRequired_WithRequiredArray_ReturnsStringArray()
    {
        const string json = """{"properties": {"name": {"type": "string"}}, "required": ["name"]}""";

        var result = AiClientService.ParseToolRequired(json);

        Assert.Single(result);
        Assert.Equal("name", result[0]);
    }

    [Fact]
    public void ParseToolRequired_NoRequiredKey_ReturnsEmptyArray()
    {
        const string json = """{"properties": {"name": {"type": "string"}}}""";

        var result = AiClientService.ParseToolRequired(json);

        Assert.Empty(result);
    }

    [Fact]
    public void ParseToolRequired_EmptyRequiredArray_ReturnsEmptyArray()
    {
        const string json = """{"properties": {"name": {"type": "string"}}, "required": []}""";

        var result = AiClientService.ParseToolRequired(json);

        Assert.Empty(result);
    }

    [Fact]
    public void ParseToolRequired_MultipleRequired_ReturnsAll()
    {
        const string json = """{"required": ["name", "age", "email"]}""";

        var result = AiClientService.ParseToolRequired(json);

        Assert.Equal(3, result.Length);
        Assert.Equal("name", result[0]);
        Assert.Equal("age", result[1]);
        Assert.Equal("email", result[2]);
    }
}