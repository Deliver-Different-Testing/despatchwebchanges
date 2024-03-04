using System;
using System.Collections.Generic;
using System.Text;

namespace DespatchWeb.EntityClasses
{
    public partial class DeswebQryDespatch : CommonEntityBase
    {
        public decimal? CourierLatitude { get; set; }

        public decimal? CourierLongitude { get; set; }
    }
}
