using System.Collections.Generic;

namespace DespatchWeb.EntityClasses;

public partial class TucJob
{
    public virtual TucJob Parent { get; set; }
    public virtual ICollection<TucJob> InverseParent { get; set; } = new List<TucJob>();
}