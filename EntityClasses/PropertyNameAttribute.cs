namespace DespatchWeb.EntityClasses
{
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
