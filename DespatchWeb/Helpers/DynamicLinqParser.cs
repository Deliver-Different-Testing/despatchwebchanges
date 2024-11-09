using System;
using System.Linq;
using System.Linq.Expressions;

namespace DespatchWeb.Helpers;

public class DynamicLinqParser<T>
{
    public Expression ParseExpression(string filter, ParameterExpression parameter)
    {
        // This is a simplified example - you would need to implement actual parsing logic
        // based on your specific filter string format
        var properties = typeof(T).GetProperties();

        // Example implementation assuming filter format: "PropertyName == Value"
        var parts = filter.Split(new[] { "==", "!=", ">", "<", ">=", "<=" },
                StringSplitOptions.RemoveEmptyEntries)
            .Select(p => p.Trim())
            .ToArray();

        if (parts.Length != 2)
        {
            throw new ArgumentException($"Invalid filter format: {filter}");
        }

        var propertyName = parts[0];
        var value = parts[1];

        var property = properties.FirstOrDefault(p =>
            p.Name.Equals(propertyName, StringComparison.OrdinalIgnoreCase));

        if (property == null)
        {
            throw new ArgumentException($"Property not found: {propertyName}");
        }

        var propertyAccess = Expression.Property(parameter, property);
        var convertedValue = Convert.ChangeType(value, property.PropertyType);
        var constant = Expression.Constant(convertedValue);

        // Create the comparison
        if (filter.Contains("=="))
            return Expression.Equal(propertyAccess, constant);
        if (filter.Contains("!="))
            return Expression.NotEqual(propertyAccess, constant);
        if (filter.Contains(">="))
            return Expression.GreaterThanOrEqual(propertyAccess, constant);
        if (filter.Contains("<="))
            return Expression.LessThanOrEqual(propertyAccess, constant);
        if (filter.Contains('>'))
            return Expression.GreaterThan(propertyAccess, constant);
        if (filter.Contains('<'))
            return Expression.LessThan(propertyAccess, constant);

        throw new ArgumentException($"Unsupported operator in filter: {filter}");
    }
}