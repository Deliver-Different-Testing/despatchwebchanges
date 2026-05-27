using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Text;
using System.Text.Json;
using DespatchWeb.Interfaces;
using DespatchWeb.Models.Dto;
using DespatchWeb.Services.JobApi;
using NSubstitute;

namespace DespatchWeb.Tests.Services.JobApi;

public class DespatchApiClientTests : IDisposable
{
    private readonly FakeHttpMessageHandler _httpHandler = new();
    private readonly IDespatchApiBaseUrlResolver _baseUrlResolver = Substitute.For<IDespatchApiBaseUrlResolver>();

    private readonly string _originalJwtSecretKey;
    private readonly string _originalClaimsKey;
    private readonly string _originalIssuer;
    private readonly string _originalAudience;

    public DespatchApiClientTests()
    {
        _originalJwtSecretKey = Environment.GetEnvironmentVariable("JWTSecretKey") ?? string.Empty;
        _originalClaimsKey = Environment.GetEnvironmentVariable("ClaimsKey") ?? string.Empty;
        _originalIssuer = Environment.GetEnvironmentVariable("Issuer") ?? string.Empty;
        _originalAudience = Environment.GetEnvironmentVariable("Audience") ?? string.Empty;

        Environment.SetEnvironmentVariable("JWTSecretKey", new string('k', 32));
        Environment.SetEnvironmentVariable("ClaimsKey", Convert.ToBase64String(new byte[32]));
        Environment.SetEnvironmentVariable("Issuer", "TestIssuer");
        Environment.SetEnvironmentVariable("Audience", "TestAudience");

        _baseUrlResolver.Resolve().Returns(new Uri("https://api.test/"));
    }

    public void Dispose()
    {
        Environment.SetEnvironmentVariable("JWTSecretKey", _originalJwtSecretKey);
        Environment.SetEnvironmentVariable("ClaimsKey", _originalClaimsKey);
        Environment.SetEnvironmentVariable("Issuer", _originalIssuer);
        Environment.SetEnvironmentVariable("Audience", _originalAudience);
        GC.SuppressFinalize(this);
    }

    private DespatchApiClient CreateClient() => new(new HttpClient(_httpHandler), _baseUrlResolver);

    private static BookPickupDto SamplePayload() => new()
    {
        SpeedId = 7,
        Pickup = { Name = "Acme", ContactPerson = "Alice", From = { City = "Auckland" } },
        Delivery = { Name = "Beta", ContactPerson = "Bob", To = { City = "Wellington" } },
        Packages = [new PackageDto { Cubic = 0, Kg = 0, Units = 1 }]
    };

    private static StringContent JsonBody(object payload, JsonSerializerOptions? opts = null) =>
        new(JsonSerializer.Serialize(payload, opts), Encoding.UTF8, "application/json");

    [Fact]
    public async Task BookPickupAsync_PostsToApiJobsWithBearer()
    {
        _httpHandler.SetResponse(new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = JsonBody(new { JobId = 7, JobNumber = "JOB-1" })
        });

        await CreateClient().BookPickupAsync(1, "conn", "Pacific/Auckland", 42, 99, SamplePayload(),
            TestContext.Current.CancellationToken);

        var sent = Assert.Single(_httpHandler.Requests);
        Assert.Equal("https://api.test/api/Jobs", sent.RequestUri!.ToString());
        Assert.Equal(HttpMethod.Post, sent.Method);
        var auth = sent.Headers.GetValues("Authorization").Single();
        Assert.StartsWith("Bearer ", auth);

        var token = new JwtSecurityTokenHandler().ReadJwtToken(auth["Bearer ".Length..]);
        Assert.Equal("TestIssuer", token.Issuer);
        Assert.Contains(token.Claims, c => c.Type == "SC");
    }

    [Fact]
    public async Task BookPickupAsync_DeserializesJobIdCaseInsensitively()
    {
        // api returns "JobID" (uppercase D) in NWJobResponse; IM and DespatchWeb model it as "JobId".
        // PropertyNameCaseInsensitive must let both spellings populate the same property.
        _httpHandler.SetResponse(new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent("{\"JobID\":42,\"JobNumber\":\"JOB-X\"}", Encoding.UTF8, "application/json")
        });

        var result = await CreateClient().BookPickupAsync(1, "conn", "tz", null, 0, SamplePayload(),
            TestContext.Current.CancellationToken);

        Assert.Equal(42, result.JobId);
        Assert.Equal("JOB-X", result.JobNumber);
        Assert.Null(result.Error);
    }

    [Fact]
    public async Task BookPickupAsync_PropagatesApiErrors()
    {
        _httpHandler.SetResponse(new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = JsonBody(new
            {
                Errors = new[] { new { Property = "Pickup.From.City", Message = "Required" } }
            })
        });

        var result = await CreateClient().BookPickupAsync(1, "conn", "tz", null, 0, SamplePayload(),
            TestContext.Current.CancellationToken);

        Assert.Null(result.Error);
        Assert.NotNull(result.Errors);
        Assert.Single(result.Errors);
        Assert.Equal("Pickup.From.City", result.Errors[0].Property);
    }

    [Fact]
    public async Task BookPickupAsync_NonSuccessStatus_ReturnsErrorEnvelope()
    {
        _httpHandler.SetResponse(new HttpResponseMessage(HttpStatusCode.BadGateway)
        {
            Content = new StringContent("upstream timeout", Encoding.UTF8, "text/plain")
        });

        var result = await CreateClient().BookPickupAsync(1, "conn", "tz", null, 0, SamplePayload(),
            TestContext.Current.CancellationToken);

        Assert.NotNull(result.Error);
        Assert.Equal("upstream timeout", result.Error.Message);
    }

    [Fact]
    public async Task BookPickupAsync_EmptyBody_ReturnsErrorEnvelope()
    {
        _httpHandler.SetResponse(new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent("null", Encoding.UTF8, "application/json")
        });

        var result = await CreateClient().BookPickupAsync(1, "conn", "tz", null, 0, SamplePayload(),
            TestContext.Current.CancellationToken);

        Assert.NotNull(result.Error);
        Assert.Equal("Empty response from api", result.Error.Message);
    }
}
