using DespatchWeb.Enums;

namespace DespatchWeb.Models.Dto;

public sealed record RecurringJourneyDto
{
    public RecurringJourneyBreakdownDto Breakdown { get; init; } = new();
    public IReadOnlyList<RecurringJourneyRunDto> Runs { get; init; } = [];
}

public sealed record RecurringJourneyBreakdownDto
{
    public int Total { get; init; }
    public int Completed { get; init; }
    public int Voided { get; init; }
    public int Pending { get; init; }
}

public sealed record RecurringJourneyRunDto
{
    public int ParentJobId { get; init; }
    public string ParentJobNumber { get; init; }
    public DateTimeOffset ServiceDate { get; init; }
    public RecurringJourneyStatus Status { get; init; }
    public decimal? Miles { get; init; }
    public RecurringJourneyPodDto Pod { get; init; }
    public IReadOnlyList<RecurringJourneyChildDto> Children { get; init; } = [];
}

public sealed record RecurringJourneyPodDto
{
    public DateTimeOffset Time { get; init; }
    public string SignedBy { get; init; }
}

public sealed record RecurringJourneyChildDto
{
    public int JobId { get; init; }
    public string JobNumber { get; init; }
}