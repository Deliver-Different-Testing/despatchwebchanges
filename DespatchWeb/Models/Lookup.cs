using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace DespatchWeb.Models
{
    public class Lookup
    {
        [JsonProperty("id")] public int ID { get; set; }

        public string Text { get; set; }

    }
}
