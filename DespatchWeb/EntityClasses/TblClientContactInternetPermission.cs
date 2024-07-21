using System;

namespace DespatchWeb.EntityClasses
{
    public partial class TblClientContactInternetPermission
    {
        public int ClientContactId { get; set; }
        public int InternetPermissionId { get; set; }
        public DateTime Created { get; set; }
        public string CreatedBy { get; set; } = null!;

        public virtual TblClientContact ClientContact { get; set; } = null!;
        public virtual TblInternetPermission InternetPermission { get; set; } = null!;
    }
}