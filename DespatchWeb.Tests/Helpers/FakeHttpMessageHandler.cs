using System.Net;

namespace DespatchWeb.Tests.Helpers;

public class FakeHttpMessageHandler : HttpMessageHandler
{
    private HttpResponseMessage _response = new(HttpStatusCode.OK);
    public List<HttpRequestMessage> Requests { get; } = [];

    /// <summary>Request body strings, captured before the caller can dispose the request content.</summary>
    public List<string> RequestBodies { get; } = [];

    public void SetResponse(HttpResponseMessage response) => _response = response;

    protected override async Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request, CancellationToken cancellationToken)
    {
        Requests.Add(request);
        RequestBodies.Add(request.Content is null
            ? string.Empty
            : await request.Content.ReadAsStringAsync(cancellationToken));
        return _response;
    }
}
