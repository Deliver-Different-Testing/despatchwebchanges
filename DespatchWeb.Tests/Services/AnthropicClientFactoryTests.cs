using System.Net;
using System.Text;
using System.Text.Json;
using Anthropic.Models.Messages;
using DespatchWeb.Models;
using DespatchWeb.Services;

namespace DespatchWeb.Tests.Services;

public sealed class AnthropicClientFactoryTests : IDisposable
{
    private const string IdentityJwt = "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJzeXN0ZW06c2VydmljZWFjY291bnQ6ZHc6ZHcifQ.sig";
    private const string AccessToken = "sk-ant-oat01-federated";

    private readonly string _tokenFile = Path.GetTempFileName();
    private readonly RecordingHandler _handler = new();

    public AnthropicClientFactoryTests() => File.WriteAllText(_tokenFile, IdentityJwt);

    public void Dispose() => File.Delete(_tokenFile);

    private AnthropicSettings.FederationSettings Federation(string? tokenFile = null) => new()
    {
        RuleId = "fdrl_test",
        OrganizationId = "00000000-0000-0000-0000-000000000001",
        ServiceAccountId = "svac_test",
        WorkspaceId = "wrkspc_test",
        IdentityTokenFile = tokenFile ?? _tokenFile
    };

    private static MessageCreateParams Request() => new()
    {
        Model = "claude-haiku-4-5",
        MaxTokens = 16,
        Messages = [new UserMessageParam { Content = "hi" }]
    };

    [Fact]
    public async Task Create_WithFederation_ExchangesIdentityTokenAndSendsBearer()
    {
        var client = AnthropicClientFactory.Create(new AnthropicSettings { Federation = Federation() }, 0, new HttpClient(_handler));

        await client.Messages.Create(Request(), TestContext.Current.CancellationToken);

        var exchange = Assert.Single(_handler.Requests, r => r.Path == "/v1/oauth/token");
        using var body = JsonDocument.Parse(exchange.Body);
        Assert.Equal("urn:ietf:params:oauth:grant-type:jwt-bearer", body.RootElement.GetProperty("grant_type").GetString());
        Assert.Equal(IdentityJwt, body.RootElement.GetProperty("assertion").GetString());
        Assert.Equal("fdrl_test", body.RootElement.GetProperty("federation_rule_id").GetString());
        Assert.Equal("00000000-0000-0000-0000-000000000001", body.RootElement.GetProperty("organization_id").GetString());
        Assert.Equal("svac_test", body.RootElement.GetProperty("service_account_id").GetString());
        Assert.Equal("wrkspc_test", body.RootElement.GetProperty("workspace_id").GetString());

        var message = Assert.Single(_handler.Requests, r => r.Path == "/v1/messages");
        Assert.Equal($"Bearer {AccessToken}", message.Authorization);
        Assert.Null(message.ApiKeyHeader);
    }

    [Fact]
    public async Task Create_WithFederation_ReusesTheExchangedTokenAcrossCalls()
    {
        var client = AnthropicClientFactory.Create(new AnthropicSettings { Federation = Federation() }, 0, new HttpClient(_handler));

        await client.Messages.Create(Request(), TestContext.Current.CancellationToken);
        await client.Messages.Create(Request(), TestContext.Current.CancellationToken);

        Assert.Single(_handler.Requests, r => r.Path == "/v1/oauth/token");
        Assert.Equal(2, _handler.Requests.Count(r => r.Path == "/v1/messages"));
    }

    [Fact]
    public async Task Create_WithoutFederation_IgnoresAnApiKeyInTheEnvironment()
    {
        var previous = Environment.GetEnvironmentVariable("ANTHROPIC_API_KEY");
        Environment.SetEnvironmentVariable("ANTHROPIC_API_KEY", "sk-ant-api03-leftover");
        try
        {
            var client = AnthropicClientFactory.Create(new AnthropicSettings(), 0, new HttpClient(_handler));

            await Record.ExceptionAsync(() => client.Messages.Create(Request(), TestContext.Current.CancellationToken));

            Assert.DoesNotContain(_handler.Requests, r => r.ApiKeyHeader == "sk-ant-api03-leftover");
            Assert.DoesNotContain(_handler.Requests, r => r.Path == "/v1/oauth/token");
        }
        finally
        {
            Environment.SetEnvironmentVariable("ANTHROPIC_API_KEY", previous);
        }
    }

    [Fact]
    public void IsConnected_RequiresCompleteFederationAndAnIdentityTokenFile()
    {
        Assert.False(new AnthropicSettings().IsConnected);
        Assert.True(new AnthropicSettings { Federation = Federation() }.IsConnected);
        Assert.False(new AnthropicSettings { Federation = new() { RuleId = "fdrl_test", IdentityTokenFile = _tokenFile } }.IsConnected);
        Assert.False(new AnthropicSettings
        {
            Federation = Federation(Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString("N")))
        }.IsConnected);
    }

    private sealed record RecordedRequest(string Path, string Body, string? Authorization, string? ApiKeyHeader);

    private sealed class RecordingHandler : HttpMessageHandler
    {
        private readonly List<RecordedRequest> _requests = [];

        public List<RecordedRequest> Requests
        {
            get
            {
                lock (_requests)
                {
                    return [.. _requests];
                }
            }
        }

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            var body = request.Content is null ? "" : await request.Content.ReadAsStringAsync(ct);
            lock (_requests)
            {
                _requests.Add(new RecordedRequest(
                    request.RequestUri!.AbsolutePath,
                    body,
                    request.Headers.Authorization?.ToString(),
                    request.Headers.TryGetValues("x-api-key", out var key) ? key.Single() : null));
            }

            var json = request.RequestUri.AbsolutePath == "/v1/oauth/token"
                ? $$"""{"access_token":"{{AccessToken}}","token_type":"Bearer","expires_in":3600}"""
                : """
                  {"id":"msg_1","type":"message","role":"assistant","model":"claude-haiku-4-5",
                   "content":[{"type":"text","text":"ok"}],"stop_reason":"end_turn","stop_sequence":null,
                   "usage":{"input_tokens":1,"output_tokens":1}}
                  """;
            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json")
            };
        }
    }
}
