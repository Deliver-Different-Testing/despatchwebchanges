namespace DespatchWeb.EntityClasses
{
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
