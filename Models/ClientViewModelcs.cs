namespace DespatchWeb.Models
{
    public class ClientViewModel
    {
        public string FirstName { get; set; }
        public string FullName { get; set; }
        public string Email { get; set; }
        public bool Active { get; set; }
        public bool Internal { get; set; }
        public int? StaffID { get; set; }
    }
}
