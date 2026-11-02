using DespatchWeb.Models.AutoMate;
using DespatchWeb.Services.AutoMate;

namespace DespatchWeb.Tests.Services.AutoMate;

public class CspKnowledgeOptionsValidatorTests
{
    private static bool Succeeds(string? baseUrl, string environment) =>
        new CspKnowledgeOptionsValidator(AutoMateTestEnv.Environment(environment))
            .Validate(null, new CspKnowledgeOptions { BaseUrl = baseUrl }).Succeeded;

    [Theory]
    [InlineData(null, "Production")]
    [InlineData("", "Production")]
    [InlineData("  ", "Production")]
    [InlineData("https://csp.example.com", "Production")]
    [InlineData("https://csp.example.com", "Development")]
    [InlineData("http://localhost:5000", "Development")]
    public void Accepts(string? baseUrl, string environment) => Assert.True(Succeeds(baseUrl, environment));

    [Theory]
    [InlineData("http://csp.example.com", "Production")]
    [InlineData("http://csp.example.com", "Staging")]
    [InlineData("ftp://csp.example.com", "Development")]
    [InlineData("csp.example.com", "Production")]
    [InlineData("csp.example.com", "Development")]
    public void Rejects(string baseUrl, string environment) => Assert.False(Succeeds(baseUrl, environment));
}
