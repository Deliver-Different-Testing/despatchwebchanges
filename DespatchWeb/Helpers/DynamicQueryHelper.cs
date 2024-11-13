using System;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Dynamic.Core;
using DespatchWeb.EntityClasses;
using Microsoft.Extensions.Logging;

namespace DespatchWeb.Helpers;

public class DynamicQueryHelper
{
    private static readonly Dictionary<string, (string Path, Type Type)> AllowedFields = new()
    {
        { "BulkRegionId", ("TblBulkJobs.Any(Region.BulkRegionId", typeof(int)) },
        { "UcclId", ("UcclId", typeof(int)) },
        { "UcjtId", ("UcjtId", typeof(int)) },
        { "IsParentJob", ("ParentId != null", typeof(bool)) },
        { "ClearListAreaId", ("TblBulkJobs.Any(Region.ZoneNames.Any(ZoneGroup.ClearListAreaId", typeof(int)) },
        { "ZoneGroupId", ("TblBulkJobs.Any(Region.ZoneNames.Any(ZoneGroupId", typeof(int)) },
        { "RemoteJob", ("RemoteJob", typeof(bool)) },
        { "VehicleSizeId", ("VehicleSizeId", typeof(int)) }
    };

    private readonly ILogger _logger;

    public DynamicQueryHelper(ILogger logger)
    {
        _logger = logger;
    }

    public IQueryable<TucJob> AddSecureConditions(IQueryable<TucJob> query, string condition)
    {
        try
        {
            var parsedCondition = ParseCondition(condition);
            _logger.LogDebug($"Parsed condition: {parsedCondition}");

            var config = new ParsingConfig
            {
                ResolveTypesBySimpleName = true
            };

            return query.Where(config, parsedCondition);
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error applying secure conditions. Original: {condition}, Error: {ex.Message}");
            throw;
        }
    }

    private static string ParseCondition(string condition)
    {
        var parts = SplitCondition(condition);
        var expressions = new List<string>();

        for (var i = 0; i < parts.Count; i++)
        {
            var part = parts[i].Trim();

            if (part.Equals("AND", StringComparison.OrdinalIgnoreCase))
            {
                expressions.Add("&&");
                continue;
            }

            if (part.Equals("OR", StringComparison.OrdinalIgnoreCase))
            {
                expressions.Add("||");
                continue;
            }

            if (part is "(" or ")")
            {
                expressions.Add(part);
                continue;
            }

            if (AllowedFields.TryGetValue(part, out var field))
            {
                var (fieldPath, fieldType) = field;
                var op = ParseOperator(parts[++i]);
                var value = parts[++i];

                var expression = fieldPath.Contains("Any(")
                    ? BuildAnyExpression(fieldPath, op, value, fieldType)
                    : BuildSimpleExpression(fieldPath, op, value, fieldType);

                expressions.Add(expression);
            }
            else
            {
                throw new ArgumentException($"Invalid field name: {part}");
            }
        }

        return string.Join(" ", expressions);
    }

    private static string BuildAnyExpression(string fieldPath, AllowedOperator op, string value, Type fieldType)
    {
        var parsedValue = ParseValue(value, fieldType);
        var operation = op switch
        {
            AllowedOperator.Equals => "==",
            AllowedOperator.NotEquals => "!=",
            _ => throw new ArgumentException($"Operator {op} not supported for collection fields")
        };

        // Extract the property path after Any(
        var propertyPath = fieldPath[(fieldPath.IndexOf("Any(") + 4)..];
        return $"{fieldPath.Split('.')[0]}.Any(x => x.{propertyPath} {operation} {parsedValue}))";
    }

    private static string BuildSimpleExpression(string fieldPath, AllowedOperator op, string value, Type fieldType)
    {
        switch (op)
        {
            case AllowedOperator.IsNull:
                return BuildNullCheck(fieldPath, true);
            case AllowedOperator.IsNotNull:
                return BuildNullCheck(fieldPath, false);
            case AllowedOperator.In:
            case AllowedOperator.NotIn:
                var values = ParseInValues(value);
                return BuildInCondition(fieldPath, values, op == AllowedOperator.NotIn);
            default:
                var parsedValue = ParseValue(value, fieldType);
                return BuildComparison(fieldPath, op, parsedValue);
        }
    }

    private static AllowedOperator ParseOperator(string op)
    {
        return op.ToUpper() switch
        {
            "=" => AllowedOperator.Equals,
            "<>" or "!=" => AllowedOperator.NotEquals,
            "IN" => AllowedOperator.In,
            "NOT IN" => AllowedOperator.NotIn,
            "IS NULL" => AllowedOperator.IsNull,
            "IS NOT NULL" => AllowedOperator.IsNotNull,
            _ => throw new ArgumentException($"Invalid operator: {op}")
        };
    }

    private static string BuildComparison(string fieldPath, AllowedOperator op, string value)
    {
        var operation = op switch
        {
            AllowedOperator.Equals => "==",
            AllowedOperator.NotEquals => "!=",
            _ => throw new ArgumentException($"Unexpected operator: {op}")
        };

        return $"{fieldPath} {operation} {value}";
    }

    private static string BuildNullCheck(string fieldPath, bool isNull) =>
        isNull ? $"{fieldPath} == null" : $"{fieldPath} != null";

    private static string BuildInCondition(string fieldPath, IEnumerable<string> values, bool notIn)
    {
        var valuesList = string.Join(", ", values);
        var method = notIn ? "!Contains" : "Contains";
        return $"new [] {{{valuesList}}}.{method}({fieldPath})";
    }

    private static string ParseValue(string value, Type targetType)
    {
        value = value.Trim('\'', '"');

        if (targetType == typeof(bool))
        {
            return value.ToLower() switch
            {
                "1" or "true" => "true",
                "0" or "false" => "false",
                _ => throw new ArgumentException($"Invalid boolean value: {value}")
            };
        }

        if (targetType != typeof(int)) return $"\"{value}\"";

        if (!int.TryParse(value, out _))
            throw new ArgumentException($"Invalid integer value: {value}");
        return value;
    }

    private static List<string> ParseInValues(string values)
    {
        values = values.Trim('(', ')');
        return values.Split(',')
            .Select(v => v.Trim())
            .Select(v => ParseValue(v, typeof(int)))
            .ToList();
    }

    private static List<string> SplitCondition(string condition)
    {
        var parts = new List<string>();
        var current = new System.Text.StringBuilder();
        var inQuotes = false;
        var inParentheses = false;

        for (var i = 0; i < condition.Length; i++)
        {
            var c = condition[i];

            switch (c)
            {
                case '"' or '\'':
                    inQuotes = !inQuotes;
                    current.Append(c);
                    break;
                case '(':
                    if (!inQuotes)
                    {
                        if (current.Length > 0)
                        {
                            parts.Add(current.ToString().Trim());
                            current.Clear();
                        }

                        parts.Add("(");
                        inParentheses = true;
                    }
                    else
                    {
                        current.Append(c);
                    }

                    break;
                case ')':
                    if (!inQuotes)
                    {
                        if (current.Length > 0)
                        {
                            parts.Add(current.ToString().Trim());
                            current.Clear();
                        }

                        parts.Add(")");
                        inParentheses = false;
                    }
                    else
                    {
                        current.Append(c);
                    }

                    break;
                case ' ':
                    if (inQuotes || inParentheses)
                    {
                        current.Append(c);
                    }
                    else if (current.Length > 0)
                    {
                        parts.Add(current.ToString().Trim());
                        current.Clear();
                    }

                    break;
                default:
                    current.Append(c);
                    break;
            }
        }

        if (current.Length > 0)
            parts.Add(current.ToString().Trim());

        return parts.Where(p => !string.IsNullOrWhiteSpace(p)).ToList();
    }

    private enum AllowedOperator
    {
        Equals,
        NotEquals,
        In,
        NotIn,
        IsNull,
        IsNotNull
    }
}
