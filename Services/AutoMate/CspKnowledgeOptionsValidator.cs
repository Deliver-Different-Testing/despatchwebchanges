#nullable enable
using DespatchWeb.Models.AutoMate;
using Microsoft.Extensions.Options;

namespace DespatchWeb.Services.AutoMate;

public sealed class CspKnowledgeOptionsValidator(IHostEnvironment environment) : IValidateOptions<CspKnowledgeOptions>
{
    public ValidateOptionsResult Validate(string? name, CspKnowledgeOptions options)
    {
        if (string.IsNullOrWhiteSpace(options.BaseUrl))
        {
            return ValidateOptionsResult.Success;
        }

        if (!Uri.TryCreate(options.BaseUrl, UriKind.Absolute, out var uri))
        {
            return ValidateOptionsResult.Fail("CspKnowledge:BaseUrl must be an absolute URL.");
        }

        if (uri.Scheme == Uri.UriSchemeHttps || (environment.IsDevelopment() && uri.Scheme == Uri.UriSchemeHttp))
        {
            return ValidateOptionsResult.Success;
        }

        return ValidateOptionsResult.Fail(environment.IsDevelopment()
            ? "CspKnowledge:BaseUrl must be an absolute http:// or https:// URL."
            : "CspKnowledge:BaseUrl must be an absolute https:// URL outside Development.");
    }
}
