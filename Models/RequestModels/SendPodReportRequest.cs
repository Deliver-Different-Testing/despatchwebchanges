using System.Collections.Generic;

namespace DespatchWeb.Models.RequestModels;

public class SendPodReportRequest
{
    public int JobId { get; set; }
    public List<string> Recipients { get; set; }
    public string Subject { get; set; }
    public string Body { get; set; }
}
