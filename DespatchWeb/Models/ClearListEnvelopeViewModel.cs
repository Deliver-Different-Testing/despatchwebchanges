using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace DespatchWeb.Models
{
    public class ClearListEnvelopeViewModel
    {
        public decimal MinimumLatitude { get; set; }
        public decimal MinimumLongitude { get; set; }
        public decimal MaximumLatitude { get; set; }
        public decimal MaximumLongitude { get; set; }

    }
}
