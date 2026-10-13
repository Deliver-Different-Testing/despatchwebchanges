#nullable enable
namespace DespatchWeb.Models.Dto;

// Wire DTOs for the DespatchWeb -> Integration Manager Cirium gateway. These mirror the neutral
// contracts in IntegrationManager.Core/Carriers/Cirium/Contracts by JSON shape (camelCase, matched
// case-insensitively on deserialize). DespatchWeb does not reference the IM assembly — these POCOs
// ARE the contract; a parity test guards against drift.

public sealed class CiriumAlertStatusDto
{
    public bool Active { get; init; }
}
