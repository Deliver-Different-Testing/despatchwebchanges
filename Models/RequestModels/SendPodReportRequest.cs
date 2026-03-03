using System.Collections.Generic;

namespace DespatchWeb.Models.RequestModels;

public class SendPodReportRequest
{
    public int JobId { get; init; }
    public List<string> Recipients { get; init; }
    public string Subject { get; init; }
    public string Body { get; init; }
}
