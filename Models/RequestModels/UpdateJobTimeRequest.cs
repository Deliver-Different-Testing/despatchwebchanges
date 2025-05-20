namespace DespatchWeb.Models.RequestModels;

public class UpdateJobTimeRequest
{
   public int JobId { get; set; }
   public string DateTime { get; set; }
   public bool IsRecurring { get; set; }
   public int TimeZoneId { get; set; }
}
