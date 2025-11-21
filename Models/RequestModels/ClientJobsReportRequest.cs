using System;

namespace DespatchWeb.Models.RequestModels;

/// <summary>
/// Request model for client jobs report download
/// Uses same search criteria as POD search
/// </summary>
public class ClientJobsReportRequest
{
    /// <summary>
    /// Start date for report range (required)
    /// </summary>
    public DateTime StartDate { get; set; }

    /// <summary>
    /// End date for report range (required)
    /// </summary>
    public DateTime EndDate { get; set; }

    /// <summary>
    /// Filter by specific client ID (optional)
    /// </summary>
    public int? ClientId { get; set; }

    /// <summary>
    /// Filter by specific courier ID (optional)
    /// </summary>
    public int? CourierId { get; set; }

    /// <summary>
    /// Wildcard search across addresses, contacts, references (optional)
    /// </summary>
    public string Wild { get; set; }

    /// <summary>
    /// Job number search (optional)
    /// </summary>
    public string Job { get; set; }

    // Helper properties
    public bool ClientSet => ClientId.HasValue;
    public bool CourierSet => CourierId.HasValue;
    public bool WildSet => !string.IsNullOrWhiteSpace(Wild);
    public bool JobSet => !string.IsNullOrWhiteSpace(Job);
}
