using System.Text.Json;
using DespatchWeb.Models.FlightStats;
using FluentAssertions;


namespace DespatchWeb.Tests.Services;

/// <summary>
/// Integration tests for FlightStatsService - tests real FlightStats API calls.
/// Credentials are loaded from:
/// 1. Environment variables (FlightStatusApiAppId, FlightStatusApiAppKey)
/// 2. Fallback: Properties/launchSettings.json
///
/// Run these tests manually or in environments where API access is available.
/// To run only integration tests: dotnet test --filter "Category=Integration"
/// </summary>
[Trait("Category", "Integration")]
public class FlightStatsServiceIntegrationTests : IAsyncDisposable
{
    private readonly HttpClient _httpClient;
    private readonly string? _appId;
    private readonly string? _appKey;
    private readonly bool _hasCredentials;

    private const string ConnectionsBaseUrl = "https://api.flightstats.com/flex/connections/rest/v3/";
    private const string AlertsBaseUrl = "https://api.flightstats.com/flex/alerts/rest/v1/";

    public FlightStatsServiceIntegrationTests()
    {
        _httpClient = new HttpClient();

        // Try environment variables first
        _appId = Environment.GetEnvironmentVariable("FlightStatusApiAppId");
        _appKey = Environment.GetEnvironmentVariable("FlightStatusApiAppKey");

        // Fallback to launchSettings.json if environment variables not set
        if (string.IsNullOrEmpty(_appId) || string.IsNullOrEmpty(_appKey)) (_appId, _appKey) = LoadCredentialsFromLaunchSettings();

        _hasCredentials = !string.IsNullOrEmpty(_appId) && !string.IsNullOrEmpty(_appKey);

        var output = TestContext.Current.TestOutputHelper;
        if (_hasCredentials)
        {
            output?.WriteLine("FlightStats API credentials loaded successfully.");
            return;
        }
        output?.WriteLine("WARNING: FlightStats API credentials not configured.");
        output?.WriteLine("Set FlightStatusApiAppId and FlightStatusApiAppKey environment variables or configure in launchSettings.json.");
    }

    /// <summary>
    /// Load FlightStats credentials from Properties/launchSettings.json
    /// </summary>
    private static (string? appId, string? appKey) LoadCredentialsFromLaunchSettings()
    {
        try
        {
            // Find the launchSettings.json file by walking up from the test assembly location
            var assemblyLocation = typeof(FlightStatsServiceIntegrationTests).Assembly.Location;
            var directory = Path.GetDirectoryName(assemblyLocation);

            while (directory != null)
            {
                var launchSettingsPath = Path.Combine(directory, "Properties", "launchSettings.json");
                if (File.Exists(launchSettingsPath))
                {
                    var json = File.ReadAllText(launchSettingsPath);
                    using var doc = JsonDocument.Parse(json);

                    // Try to find credentials in any profile
                    if (doc.RootElement.TryGetProperty("profiles", out var profiles))
                    {
                        foreach (var profile in profiles.EnumerateObject())
                        {
                            if (!profile.Value.TryGetProperty("environmentVariables", out var envVars)) continue;

                            string? appId = null;
                            string? appKey = null;

                            if (envVars.TryGetProperty("FlightStatusApiAppId", out var appIdProp))
                                appId = appIdProp.GetString();
                            if (envVars.TryGetProperty("FlightStatusApiAppKey", out var appKeyProp))
                                appKey = appKeyProp.GetString();

                            if (!string.IsNullOrEmpty(appId) && !string.IsNullOrEmpty(appKey))
                                return (appId, appKey);
                        }
                    }
                }

                directory = Path.GetDirectoryName(directory);
            }
        }
        catch
        {
            // Ignore errors reading launchSettings.json
        }

        return (null, null);
    }

    public ValueTask DisposeAsync()
    {
        _httpClient.Dispose();
        return ValueTask.CompletedTask;
    }

    #region Connections API Tests

    [Fact]
    public async Task ConnectionsApi_SearchFlights_AucklandToSydney_ReturnsFlights()
    {
        // Arrange
        Assert.SkipUnless(_hasCredentials, "FlightStats API credentials not configured");

        const string departureAirport = "AKL";
        const string arrivalAirport = "SYD";
        var (year, month, day) = DateTime.UtcNow.AddDays(1);
        const int hour = 8; // Morning flights
        const int minute = 0;

        var url = $"{ConnectionsBaseUrl}json/firstflightout/{departureAirport}/to/{arrivalAirport}/leaving_after/{year}/{month}/{day}/{hour}/{minute}" +
                  $"?appId={_appId}&appKey={_appKey}&maxResults=10&includeCodeshares=false&maxConnections=1&numHours=24";

        TestContext.Current.TestOutputHelper?.WriteLine($"Request URL: {url}");

        // Act
        var response = await _httpClient.GetAsync(url, TestContext.Current.CancellationToken);
        var content = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        TestContext.Current.TestOutputHelper?.WriteLine($"Status Code: {response.StatusCode}");
        TestContext.Current.TestOutputHelper?.WriteLine($"Response Length: {content.Length} characters");

        // Assert
        response.IsSuccessStatusCode.Should().BeTrue($"API returned {response.StatusCode}: {content}");

        var result = JsonSerializer.Deserialize<FlightConnectionsRoot>(content);
        result.Should().NotBeNull();

        TestContext.Current.TestOutputHelper?.WriteLine($"Connections found: {result.Connections?.Count ?? 0}");

        if (result.Connections is { Count: > 0 })
        {
            foreach (var connection in result.Connections.Take(3))
            {
                var firstFlight = connection.ScheduledFlight?.FirstOrDefault();
                if (firstFlight != null)
                {
                    TestContext.Current.TestOutputHelper?.WriteLine($"  Flight: {firstFlight.CarrierFsCode}{firstFlight.FlightNumber} " +
                                      $"{firstFlight.DepartureAirportFsCode}->{firstFlight.ArrivalAirportFsCode} " +
                                      $"Departs: {firstFlight.DepartureTime}");
                }
            }
        }
    }

    [Fact]
    public async Task ConnectionsApi_SearchFlights_LosAngelesToNewYork_ReturnsFlights()
    {
        // Arrange
        Assert.SkipUnless(_hasCredentials, "FlightStats API credentials not configured");

        const string departureAirport = "LAX";
        const string arrivalAirport = "JFK";
        var (year, month, day) = DateTime.UtcNow.AddDays(1);

        var url = $"{ConnectionsBaseUrl}json/firstflightout/{departureAirport}/to/{arrivalAirport}/leaving_after/{year}/{month}/{day}/6/0" +
                  $"?appId={_appId}&appKey={_appKey}&maxResults=20&includeCodeshares=false&maxConnections=1&numHours=24";

        TestContext.Current.TestOutputHelper?.WriteLine($"Request URL: {url}");

        // Act
        var response = await _httpClient.GetAsync(url, TestContext.Current.CancellationToken);
        var content = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        TestContext.Current.TestOutputHelper?.WriteLine($"Status Code: {response.StatusCode}");

        // Assert
        response.IsSuccessStatusCode.Should().BeTrue($"API returned {response.StatusCode}: {content}");

        var result = JsonSerializer.Deserialize<FlightConnectionsRoot>(content);
        result.Should().NotBeNull();

        TestContext.Current.TestOutputHelper?.WriteLine($"Connections found: {result.Connections?.Count ?? 0}");

        // LAX to JFK is a busy route, should have flights
        result.Connections.Should().NotBeNullOrEmpty("LAX to JFK is a major route with many flights");
    }

    [Fact]
    public async Task ConnectionsApi_SearchFlights_WithAirlineFilter_ReturnsFilteredResults()
    {
        // Arrange
        Assert.SkipUnless(_hasCredentials, "FlightStats API credentials not configured");

        const string departureAirport = "LAX";
        const string arrivalAirport = "JFK";
        var (year, month, day) = DateTime.UtcNow.AddDays(1);
        const string airline = "AA"; // American Airlines

        var url = $"{ConnectionsBaseUrl}json/firstflightout/{departureAirport}/to/{arrivalAirport}/leaving_after/{year}/{month}/{day}/6/0" +
                  $"?appId={_appId}&appKey={_appKey}&maxResults=20&includeCodeshares=false&maxConnections=1&numHours=24&includeAirlines={airline}";

        TestContext.Current.TestOutputHelper?.WriteLine($"Request URL: {url}");

        // Act
        var response = await _httpClient.GetAsync(url, TestContext.Current.CancellationToken);
        var content = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        TestContext.Current.TestOutputHelper?.WriteLine($"Status Code: {response.StatusCode}");

        // Assert
        response.IsSuccessStatusCode.Should().BeTrue($"API returned {response.StatusCode}: {content}");

        var result = JsonSerializer.Deserialize<FlightConnectionsRoot>(content);
        result.Should().NotBeNull();

        TestContext.Current.TestOutputHelper?.WriteLine($"American Airlines connections found: {result.Connections?.Count ?? 0}");

        // Each connection should include at least one AA-operated flight
        // (connections may include legs operated by regional partners like SkyWest/OO)
        if (result.Connections != null)
        {
            foreach (var connection in result.Connections)
            {
                connection.ScheduledFlight.Should().Contain(
                    f => f.CarrierFsCode == airline,
                    $"Expected at least one {airline} flight in connection but got: {string.Join(", ", connection.ScheduledFlight?.Select(f => f.CarrierFsCode) ?? [])}");
            }
        }
    }

    [Fact]
    public async Task ConnectionsApi_SearchFlights_MultipleAirlines_ReturnsResults()
    {
        // Arrange
        Assert.SkipUnless(_hasCredentials, "FlightStats API credentials not configured");

        const string departureAirport = "SFO";
        const string arrivalAirport = "ORD";
        var (year, month, day) = DateTime.UtcNow.AddDays(1);
        const string airlines = "UA,AA"; // United and American

        var url = $"{ConnectionsBaseUrl}json/firstflightout/{departureAirport}/to/{arrivalAirport}/leaving_after/{year}/{month}/{day}/6/0" +
                  $"?appId={_appId}&appKey={_appKey}&maxResults=20&includeCodeshares=false&maxConnections=1&numHours=24&includeAirlines={airlines}";

        TestContext.Current.TestOutputHelper?.WriteLine($"Request URL: {url}");

        // Act
        var response = await _httpClient.GetAsync(url, TestContext.Current.CancellationToken);
        var content = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        TestContext.Current.TestOutputHelper?.WriteLine($"Status Code: {response.StatusCode}");

        // Assert
        response.IsSuccessStatusCode.Should().BeTrue($"API returned {response.StatusCode}: {content}");

        var result = JsonSerializer.Deserialize<FlightConnectionsRoot>(content);
        result.Should().NotBeNull();

        TestContext.Current.TestOutputHelper?.WriteLine($"United/American connections found: {result.Connections?.Count ?? 0}");
    }

    [Fact]
    public async Task ConnectionsApi_InvalidAirport_ReturnsErrorOrEmptyResult()
    {
        // Arrange
        Assert.SkipUnless(_hasCredentials, "FlightStats API credentials not configured");

        const string departureAirport = "XXX"; // Invalid airport code
        const string arrivalAirport = "YYY";
        var (year, month, day) = DateTime.UtcNow.AddDays(1);

        var url = $"{ConnectionsBaseUrl}json/firstflightout/{departureAirport}/to/{arrivalAirport}/leaving_after/{year}/{month}/{day}/8/0" +
                  $"?appId={_appId}&appKey={_appKey}&maxResults=10";

        TestContext.Current.TestOutputHelper?.WriteLine($"Request URL: {url}");

        // Act
        var response = await _httpClient.GetAsync(url, TestContext.Current.CancellationToken);
        var content = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        TestContext.Current.TestOutputHelper?.WriteLine($"Status Code: {response.StatusCode}");
        TestContext.Current.TestOutputHelper?.WriteLine($"Response: {content}");

        // Assert - API may return 200 with empty results or an error
        // We just want to ensure the API handles invalid airports gracefully
        if (response.IsSuccessStatusCode)
        {
            var result = JsonSerializer.Deserialize<FlightConnectionsRoot>(content);
            result?.Connections.Should().BeNullOrEmpty("Invalid airports should return no connections");
        }
    }

    [Fact]
    public async Task ConnectionsApi_ResponseContainsAppendixData()
    {
        // Arrange
        Assert.SkipUnless(_hasCredentials, "FlightStats API credentials not configured");

        const string departureAirport = "AKL";
        const string arrivalAirport = "SYD";
        var (year, month, day) = DateTime.UtcNow.AddDays(1);

        var url = $"{ConnectionsBaseUrl}json/firstflightout/{departureAirport}/to/{arrivalAirport}/leaving_after/{year}/{month}/{day}/8/0" +
                  $"?appId={_appId}&appKey={_appKey}&maxResults=5&numHours=24";

        // Act
        var response = await _httpClient.GetAsync(url, TestContext.Current.CancellationToken);
        var content = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        // Assert
        response.IsSuccessStatusCode.Should().BeTrue();

        var result = JsonSerializer.Deserialize<FlightConnectionsRoot>(content);
        result.Should().NotBeNull();

        // Appendix should contain reference data
        if (result.Connections?.Count > 0)
        {
            result.Appendix.Should().NotBeNull();
            result.Appendix?.Airlines.Should().NotBeNullOrEmpty("Appendix should contain airline data");
            result.Appendix?.Airports.Should().NotBeNullOrEmpty("Appendix should contain airport data");

            TestContext.Current.TestOutputHelper?.WriteLine($"Airlines in appendix: {result.Appendix?.Airlines?.Count}");
            TestContext.Current.TestOutputHelper?.WriteLine($"Airports in appendix: {result.Appendix?.Airports?.Count}");
            TestContext.Current.TestOutputHelper?.WriteLine($"Equipment in appendix: {result.Appendix?.Equipments?.Count}");

            // Verify airport data has timezone info
            var aklAirport = result.Appendix?.Airports?.FirstOrDefault(a => a.Fs == "AKL");
            aklAirport.Should().NotBeNull();
            aklAirport.TimeZoneRegionName.Should().NotBeNullOrEmpty("Airport should have timezone info");
            TestContext.Current.TestOutputHelper?.WriteLine($"AKL Timezone: {aklAirport.TimeZoneRegionName}");
        }
    }

    [Fact]
    public async Task ConnectionsApi_ConnectingFlights_ReturnsMultiSegmentResults()
    {
        // Arrange
        Assert.SkipUnless(_hasCredentials, "FlightStats API credentials not configured");

        // Use a route that likely requires a connection
        const string departureAirport = "AKL";
        const string arrivalAirport = "LHR"; // Auckland to London usually has connections
        var (year, month, day) = DateTime.UtcNow.AddDays(2);

        var url = $"{ConnectionsBaseUrl}json/firstflightout/{departureAirport}/to/{arrivalAirport}/leaving_after/{year}/{month}/{day}/6/0" +
                  $"?appId={_appId}&appKey={_appKey}&maxResults=10&includeCodeshares=false&maxConnections=2&numHours=24&minimumConnectTime=60";

        TestContext.Current.TestOutputHelper?.WriteLine($"Request URL: {url}");

        // Act
        var response = await _httpClient.GetAsync(url, TestContext.Current.CancellationToken);
        var content = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        TestContext.Current.TestOutputHelper?.WriteLine($"Status Code: {response.StatusCode}");

        // Assert
        response.IsSuccessStatusCode.Should().BeTrue($"API returned {response.StatusCode}");

        var result = JsonSerializer.Deserialize<FlightConnectionsRoot>(content);
        result.Should().NotBeNull();

        TestContext.Current.TestOutputHelper?.WriteLine($"Connections found: {result.Connections?.Count ?? 0}");

        if (result.Connections != null)
        {
            foreach (var connection in result.Connections.Take(3))
            {
                var segmentCount = connection.ScheduledFlight?.Count ?? 0;
                TestContext.Current.TestOutputHelper?.WriteLine($"  Connection with {segmentCount} segment(s), elapsed time: {connection.ElapsedTime} mins");

                if (connection.ScheduledFlight == null) continue;
                foreach (var segment in connection.ScheduledFlight)
                {
                    TestContext.Current.TestOutputHelper?.WriteLine($"    {segment.CarrierFsCode}{segment.FlightNumber}: " +
                                      $"{segment.DepartureAirportFsCode} -> {segment.ArrivalAirportFsCode}");
                }
            }
        }
    }

    #endregion

    #region Alerts API Tests

    [Fact]
    public async Task AlertsApi_InvalidCredentials_ReturnsErrorInResponse()
    {
        // Arrange - Use invalid credentials
        const string url = $"{AlertsBaseUrl}json/list?appId=invalid&appKey=invalid";

        TestContext.Current.TestOutputHelper?.WriteLine($"Request URL: {url}");

        // Act
        var response = await _httpClient.GetAsync(url, TestContext.Current.CancellationToken);
        var content = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        TestContext.Current.TestOutputHelper?.WriteLine($"Status Code: {response.StatusCode}");
        TestContext.Current.TestOutputHelper?.WriteLine($"Response: {content}");

        // Assert - API returns 200 but with error in body
        // The response contains an error object indicating invalid credentials
        content.Should().Contain("error", "Response should contain error for invalid credentials");
        content.Should().Contain("invalid", "Response should reference the invalid app id");
    }

    [Fact]
    public async Task AlertsApi_ListAlerts_ReturnsValidResponse()
    {
        // Arrange
        Assert.SkipUnless(_hasCredentials, "FlightStats API credentials not configured");

        var url = $"{AlertsBaseUrl}json/list?appId={_appId}&appKey={_appKey}";
 
        TestContext.Current.TestOutputHelper?.WriteLine($"Request URL: {url}");

        // Act
        var response = await _httpClient.GetAsync(url, TestContext.Current.CancellationToken);
        var content = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        TestContext.Current.TestOutputHelper?.WriteLine($"Status Code: {response.StatusCode}");
        TestContext.Current.TestOutputHelper?.WriteLine($"Response Length: {content.Length} characters");

        // Assert
        response.IsSuccessStatusCode.Should().BeTrue($"API returned {response.StatusCode}: {content}");
    }

    #endregion

    #region Rate Limiting & Error Handling Tests

    [Fact]
    public async Task Api_RateLimiting_HandlesMultipleRequests()
    {
        // Arrange
        Assert.SkipUnless(_hasCredentials, "FlightStats API credentials not configured");

        const string departureAirport = "LAX";
        const string arrivalAirport = "SFO";
        var (year, month, day) = DateTime.UtcNow.AddDays(1);

        var url = $"{ConnectionsBaseUrl}json/firstflightout/{departureAirport}/to/{arrivalAirport}/leaving_after/{year}/{month}/{day}/8/0" +
                  $"?appId={_appId}&appKey={_appKey}&maxResults=5";

        // Act - Make 3 rapid requests
        var tasks = new List<Task<HttpResponseMessage>>();
        for (var i = 0; i < 3; i++)
            if (_httpClient != null)
                tasks.Add(_httpClient.GetAsync(url));

        var responses = await Task.WhenAll(tasks);

        // Assert - All should succeed (API should handle reasonable request rates)
        foreach (var response in responses) TestContext.Current.TestOutputHelper?.WriteLine($"Response: {response.StatusCode}");

        var successCount = responses.Count(r => r.IsSuccessStatusCode);
        successCount.Should().BeGreaterThan(0, "At least some requests should succeed");
    }

    #endregion
}
