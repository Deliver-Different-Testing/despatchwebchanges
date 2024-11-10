using System;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Dynamic.Core;
using DespatchWeb.EntityClasses;
using Microsoft.Extensions.Logging;

namespace DespatchWeb.Helpers;

public class DynamicQueryHelper
{
    private readonly ILogger _logger;
    private readonly Dictionary<string, Type> _propertyTypes;

    public DynamicQueryHelper(ILogger logger)
    {
        _logger = logger;
        _propertyTypes = typeof(TucJob)
            .GetProperties()
            .ToDictionary(p => p.Name, p => p.PropertyType);
    }

    public IQueryable<TucJob> AddDynamicConditions(IQueryable<TucJob> query, string sqlConditions)
    {
        try
        {
            var convertedCondition = ConvertSqlConditionToCSharp(sqlConditions);
            _logger.LogDebug($"Converted SQL condition '{sqlConditions}' to '{convertedCondition}'");
            return query.Where(convertedCondition);
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error applying dynamic conditions. Original: {sqlConditions}, Error: {ex.Message}");
            throw;
        }
    }

    private string ConvertSqlConditionToCSharp(string sqlCondition)
    {
        // Handle AND/OR operators
        sqlCondition = sqlCondition
            .Replace(" AND ", " && ")
            .Replace(" OR ", " || ");

        // Split on spaces but preserve quoted strings and parentheses
        var parts = SplitPreservingQuotes(sqlCondition);
        var result = new List<string>();

        for (var i = 0; i < parts.Count; i++)
        {
            var part = parts[i];

            if (part is "(" or ")")
            {
                result.Add(part);
                continue;
            }

            // Look for field comparisons
            if (i + 2 < parts.Count && IsComparisonOperator(parts[i + 1]))
            {
                var operation = parts[i + 1];
                var value = parts[i + 2];

                result.Add(ConvertComparison(part, operation, value));
                i += 2; // Skip the next two parts as we've handled them
            }
            else
            {
                result.Add(part);
            }
        }

        return string.Join(" ", result);
    }

    private string ConvertComparison(string fieldName, string operation, string value)
    {
        if (_propertyTypes.TryGetValue(fieldName, out var propertyType))
        {
            // Convert the value based on property type
            value = ConvertValue(value, propertyType);

            // Convert SQL operators to C# operators
            operation = operation switch
            {
                "=" => "==",
                "<>" => "!=",
                _ => operation
            };

            return $"{fieldName} {operation} {value}";
        }

        return $"{fieldName} {operation} {value}";
    }

    private static string ConvertValue(string value, Type propertyType)
    {
        value = value.Trim('\'', '"');

        if (propertyType == typeof(bool) || propertyType == typeof(bool?))
        {
            return value switch
            {
                "0" => "false",
                "1" => "true",
                _ => value.ToLower()
            };
        }

        if (propertyType == typeof(DateTime) || propertyType == typeof(DateTime?))
        {
            if (DateTime.TryParse(value, out var dateValue))
            {
                return
                    $"DateTime({dateValue.Year}, {dateValue.Month}, {dateValue.Day}, {dateValue.Hour}, {dateValue.Minute}, {dateValue.Second})";
            }
        }

        if (propertyType == typeof(string))
        {
            return $"\"{value}\"";
        }

        // For numeric types, just return the value
        return propertyType.IsValueType ? value : value;
    }

    private static bool IsComparisonOperator(string part) => part is "=" or ">" or "<" or ">=" or "<=" or "<>" or "!=";

    private static List<string> SplitPreservingQuotes(string input)
    {
        var result = new List<string>();
        var current = new System.Text.StringBuilder();
        var inQuotes = false;

        foreach (var c in input)
        {
            switch (c)
            {
                case '"' or '\'':
                    inQuotes = !inQuotes;
                    current.Append(c);
                    break;
                case ' ' when !inQuotes:
                {
                    if (current.Length > 0)
                    {
                        result.Add(current.ToString());
                        current.Clear();
                    }

                    break;
                }
                default:
                    current.Append(c);
                    break;
            }
        }

        if (current.Length > 0) result.Add(current.ToString());

        return result;
    }
}
