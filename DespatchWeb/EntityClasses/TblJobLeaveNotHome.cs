using System;

namespace DespatchWeb.EntityClasses
{
    public partial class TblJobLeaveNotHome
    {
        public int LeaveNotHomeId { get; set; }
        public string Name { get; set; } = null!;
        public string Smsname { get; set; } = null!;
        public bool RequireCourierNotes { get; set; }
        public bool? AllowLeave { get; set; }
        public int Sequence { get; set; }
        public string? Category { get; set; }
        public DateTime LastModified { get; set; }
        public string LastModifiedBy { get; set; } = null!;
        public DateTime Created { get; set; }
        public string CreatedBy { get; set; } = null!;
        public string? Notes { get; set; }
    }
}