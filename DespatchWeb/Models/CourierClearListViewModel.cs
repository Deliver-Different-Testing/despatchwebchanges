using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;


namespace DespatchWeb.Models
{
    public class CourierClearListViewModel
    {

        public int CourierID { get; set; }

        [DespatchWeb.EntityClasses.PropName("#")]
        public string CourierCode{ get; set; }

        public int DisplayOrder { get; set; }

        public string Deliver { get; set; }



    }
}
