using System.Net;
using System.Text;
using DespatchWeb.Models;
using DespatchWeb.Services.AutoMate;
using Microsoft.Extensions.Hosting;
using NSubstitute;

namespace DespatchWeb.Tests.Services.AutoMate;

internal sealed record CapturedRequest(
    HttpMethod Method, string Uri, string? ContentType, string? Authorization, string[] Form, string Body);

/// <summary>Records every request and answers from <see cref="Responder"/> or <see cref="AsyncResponder"/>.</summary>
internal sealed class StubHandler : HttpMessageHandler
{
    private readonly List<CapturedRequest> _requests = [];

    public List<CapturedRequest> Requests
    {
        get
        {
            lock (_requests)
            {
                return [.. _requests];
            }
        }
    }

    public Func<HttpRequestMessage, HttpResponseMessage> Responder { get; set; } = _ => new HttpResponseMessage(HttpStatusCode.OK);

    public Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>>? AsyncResponder { get; set; }

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        var body = request.Content is null ? string.Empty : await request.Content.ReadAsStringAsync(cancellationToken);
        var isForm = request.Content?.Headers.ContentType?.MediaType == "application/x-www-form-urlencoded";
        var form = isForm && body.Length > 0
            ? body.Split('&').Select(p => Uri.UnescapeDataString(p.Replace('+', ' '))).ToArray()
            : [];
        lock (_requests)
        {
            _requests.Add(new CapturedRequest(
                request.Method,
                request.RequestUri!.AbsoluteUri,
                request.Content?.Headers.ContentType?.MediaType,
                request.Headers.Authorization?.ToString(),
                form,
                body));
        }

        return AsyncResponder is null ? Responder(request) : await AsyncResponder(request, cancellationToken);
    }
}

internal static class AutoMateTestEnv
{
    public static IHostEnvironment Environment(string name)
    {
        var env = Substitute.For<IHostEnvironment>();
        env.EnvironmentName.Returns(name);
        return env;
    }

    public static AutoMateAudience Audience(ScopeContext? scope)
    {
        var provider = Substitute.For<DespatchWeb.Interfaces.IScopeProvider>();
        provider.Scope.Returns(scope);
        return new AutoMateAudience(provider);
    }

    public static AutoMateAudience Staff() => Audience(new ScopeContext(ClientTypeId: 1, ClientId: null, NpAgentId: null));

    public static AutoMateAudience Customer() => Audience(new ScopeContext(ClientTypeId: 2, ClientId: 7, NpAgentId: null));
}
