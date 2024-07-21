using System;
using System.Collections.Generic;

namespace DespatchWeb.EntityClasses
{
    public partial class TblInternetPermission
    {
        public TblInternetPermission()
        {
            TblClientContactInternetPermissions = new HashSet<TblClientContactInternetPermission>();
        }

        public int InternetPermissionId { get; set; }
        public string Name { get; set; } = null!;
        public string? SystemName { get; set; }
        public bool HideWhenInactive { get; set; }
        public DateTime Created { get; set; }
        public string CreatedBy { get; set; } = null!;
        public DateTime LastModified { get; set; }
        public string LastModifiedBy { get; set; } = null!;
        public string? Notes { get; set; }
        public bool AssignToNewContacts { get; set; }

        public virtual ICollection<TblClientContactInternetPermission> TblClientContactInternetPermissions { get; set; }
    }
}