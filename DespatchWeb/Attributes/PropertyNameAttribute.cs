using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace DespatchWeb.Attributes
{
    // Multiuse attribute.  
    [System.AttributeUsage(System.AttributeTargets.Class | System.AttributeTargets.Property | System.AttributeTargets.Struct, AllowMultiple = true)  // Multiuse attribute.  
    ]
    public class PropName : System.Attribute
    {
        string name;


        public PropName(string name)
        {
            this.name = name;

            
        }

        public string GetName()
        {
            return name;
        }
    }
}
