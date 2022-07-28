using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Newtonsoft.Json;

namespace DespatchWeb.Models
{
    public class ClientContactViewModel
    {
        [JsonProperty("id")] 
        public int ID { get; set; }

        [JsonProperty("label")] 
        public string Text { get; set; }
    }
}
