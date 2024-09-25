using System;
using System.Linq;
using System.Reflection;

namespace DespatchWeb.Enums
{
    public enum AddressComponent
    {
        [CountrySpecific("Company", Country.Us, 1)] [CountrySpecific("Company", Country.Nz, 1)]
        Company = 1,

        [CountrySpecific("AddressLine2 (Apt, Unit, Suite)", Country.Us, 2)]
        [CountrySpecific("AddressLine2", Country.Nz, 2)]
        AddressLine2 = 2,

        [CountrySpecific("Street Number", Country.Us, 3)] [CountrySpecific("Street Number", Country.Nz, 3)]
        StreetNumber = 3,

        [CountrySpecific("Street Name", Country.Us, 4)] [CountrySpecific("Street Name", Country.Nz, 4)]
        StreetName = 4,

        [CountrySpecific("City", Country.Us, 5)] [CountrySpecific("City", Country.Nz, 5)]
        City = 5,

        [CountrySpecific("State", Country.Us, 6)] [CountrySpecific("Region", Country.Nz, 6)]
        StateOrRegion = 6,

        [CountrySpecific("ZipCode", Country.Us, 7)] [CountrySpecific("PostCode", Country.Nz, 7)]
        PostalCode = 7
    }

    [AttributeUsage(AttributeTargets.Field, AllowMultiple = true)]
    public class CountrySpecificAttribute : Attribute
    {
        public CountrySpecificAttribute(string description, Country country, int order)
        {
            Description = description;
            Country = country;
            Order = order;
        }

        public string Description { get; }
        public Country Country { get; }
        public int Order { get; }
    }

    public static class AddressComponentExtensions
    {
        public static string GetDescription(this AddressComponent component, Country country)
        {
            var attr = GetCountrySpecificAttribute(component, country);
            return attr?.Description ?? component.ToString();
        }

        public static int GetOrder(this AddressComponent component, Country country)
        {
            var attr = GetCountrySpecificAttribute(component, country);
            return attr?.Order ?? (int)component;
        }

        private static CountrySpecificAttribute GetCountrySpecificAttribute(AddressComponent component, Country country)
        {
            var memberInfo = typeof(AddressComponent).GetMember(component.ToString()).FirstOrDefault();
            if (memberInfo == null) return null;

            return memberInfo.GetCustomAttributes<CountrySpecificAttribute>(false)
                .FirstOrDefault(a => a.Country == country);
        }

        public static AddressComponent ParseAddressComponent(string description, Country country)
        {
            foreach (AddressComponent component in Enum.GetValues(typeof(AddressComponent)))
            {
                if (component.GetDescription(country).Equals(description, StringComparison.OrdinalIgnoreCase))
                    return component;
            }

            throw new ArgumentException($"'{description}' is not a valid AddressComponent description for {country}",
                nameof(description));
        }
    }
}
