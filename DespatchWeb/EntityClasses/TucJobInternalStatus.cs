namespace DespatchWeb.EntityClasses
{
    public partial class TucJobInternalStatus
    {
        public int Tcis { get; set; }
        public string? TcisName { get; set; }
        public string? DefaultSchedule { get; set; }
        public int? DefaultMinutes { get; set; }
    }
}