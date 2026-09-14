using DespatchWeb.Models.RequestModels;
using DespatchWeb.Models.Response;

namespace DespatchWeb.Interfaces;

/// <summary>
/// Turns operator-supplied free text into structured input for a form. Both members
/// fill a form the operator then reviews and submits — neither creates or runs anything.
/// </summary>
public interface IAiIntakeService
{
    Task<JobIntakeResponse> ExtractJobIntakeAsync(ExtractJobIntakeRequest request, CancellationToken ct = default);

    Task<SearchCriteriaResponse> ParseSearchQueryAsync(ParseSearchQueryRequest request, CancellationToken ct = default);
}
