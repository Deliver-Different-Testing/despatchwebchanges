using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace DespatchWeb.Attributes
{
    // Multiuse attribute.  
    [System.AttributeUsage(System.AttributeTargets.Class | System.AttributeTargets.Property | System.AttributeTargets.Struct, AllowMultiple = true)  // Multiuse attribute.  
    ]
    public class PropName(string name) : System.Attribute
    {
        string name = name;

        public string GetName()
        {
            return name;
        }
    }
}
