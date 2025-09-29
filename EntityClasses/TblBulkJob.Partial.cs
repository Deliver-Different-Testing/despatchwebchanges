using System.Collections.Generic;

namespace DespatchWeb.EntityClasses;

public partial class TblBulkJob
{
    public virtual TucJob Job { get; set; }
    public virtual TblBulkJob Parent { get; set; }
    public virtual ICollection<TblBulkJob> InverseParent { get; set; } = new List<TblBulkJob>();
}