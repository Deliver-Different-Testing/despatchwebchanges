using System.Text.Json.Serialization;

namespace DespatchWeb.Models
{
    public class ClientContactDetailViewModel
    {
        [JsonPropertyName("id")] 
        public int ID { get; set; }

        public string FullName { get; set; }
        public string JobTitle { get; set; }
        public string DirectDial { get; set; }
        public string Mobile { get; set; }
        public string Email { get; set; }
    }
}
