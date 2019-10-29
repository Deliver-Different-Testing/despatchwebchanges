using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace DespatchWeb.Models
{
    public class PotentialCouriersViewModel
    {

        public int CourierID { get; set; }
        public string Code { get; set; }
        public string Reason { get; set; }
        public int RuleNumber { get; set; }
        public string FirstName { get; set; }

    }
}
