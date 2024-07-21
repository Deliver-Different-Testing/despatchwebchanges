using System;

namespace DespatchWeb.EntityClasses
{
    public partial class TucSource
    {
        public int SourceId { get; set; }
        public string Name { get; set; } = null!;
        public DateTime Created { get; set; }
        public string CreatedBy { get; set; } = null!;
        public DateTime LastModified { get; set; }
        public string LastModifiedBy { get; set; } = null!;
    }
}