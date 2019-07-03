using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Newtonsoft.Json;


namespace DespatchWeb.Models
{

    public  class SuburbLookup
    {
        [JsonProperty("id")] public int ID { get; set; }

        public string Text { get; set; }

        public string Alias { get; set; }

    }
}

