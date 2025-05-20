namespace DespatchWeb.Models.RequestModels;

public class UpdatePodDetailsRequest
{
    public int JobId { get; set; }
    public int JobStatus { get; set; }
    public string PodName { get; set; }
    public string PodTime { get; set; }
}
