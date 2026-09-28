using System.Net;

namespace DespatchWeb.Tests.Helpers;

public class FakeHttpMessageHandler : HttpMessageHandler
{
    private HttpResponseMessage _response = new(HttpStatusCode.OK);
    public List<HttpRequestMessage> Requests { get; } = [];

    public void SetResponse(HttpResponseMessage response) => _response = response;

    protected override Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request, CancellationToken cancellationToken)
    {
        Requests.Add(request);
        return Task.FromResult(_response);
    }
}
