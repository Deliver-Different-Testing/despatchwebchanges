using System;

namespace DespatchWeb.EntityClasses
{
    public partial class TblDespatchView
    {
        public int DespatchViewId { get; set; }
        public string Name { get; set; } = null!;
        public string? WhereCondition { get; set; }
        public DateTime Created { get; set; }
        public string CreatedBy { get; set; } = null!;
        public DateTime LastModified { get; set; }
        public string LastModifiedBy { get; set; } = null!;
        public string? Notes { get; set; }
        public bool? ShowOnDespatch { get; set; }
        public bool? ShowOnAssistDespatch { get; set; }
        public bool? ShowOnJobFollowup { get; set; }
    }
}