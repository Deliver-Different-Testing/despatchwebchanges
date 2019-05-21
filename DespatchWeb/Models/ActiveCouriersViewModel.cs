using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using DespatchWeb.Attributes;
using Newtonsoft.Json;

namespace DespatchWeb.Models
{
    public class ActiveCouriersViewModel
    {

        private string _label;
        public int CourierID { get; set; }

        [JsonProperty("id")]
        public string Code{ get; set; }

        public string Name { get; set; }

        public string Label
        {
            get => $"{Code} {Name}";
            set => _label = value;
        }
    }
}
