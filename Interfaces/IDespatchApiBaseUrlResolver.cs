namespace DespatchWeb.Interfaces;

/// <summary>
/// Resolves the Despatch API base URL for the current request. In every deployed
/// environment DespatchWeb and the api project share a parent domain — DespatchWeb at
/// <c>despatch.{tenant}.deliverdifferent.com</c>, the api at
/// <c>api.{tenant}.deliverdifferent.com</c> — so the URL is derived per-request
/// from the inbound Host header. Mirrors IntegrationManager.Core.Interfaces.IDespatchApiBaseUrlResolver.
/// </summary>
public interface IDespatchApiBaseUrlResolver
{
    Uri Resolve();
}
