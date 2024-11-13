using System;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Dynamic.Core;
using System.Linq.Expressions;
using DespatchWeb.EntityClasses;
using Microsoft.Extensions.Logging;

namespace DespatchWeb.Helpers;

public class DynamicQueryHelper
{
    private static readonly Dictionary<string, (Expression<Func<TucJob, object>> Expression, Type Type)> AllowedFields =
        new()
        {
            // Using FirstOrDefault() in dynamic LINQ requires different syntax
            { "BulkRegionId", (j => j.TblBulkJobs.Select(b => b.RegionId).FirstOrDefault(), typeof(int)) },
            { "ucclId", (j => j.UcjbClientId, typeof(int)) },
            { "ucjsId", (j => j.UcjbStatus, typeof(int)) },
            { "UcjtId", (j => j.UcjbSpeed, typeof(int)) },
            { "IsParentJob", (j => j.ParentId != null, typeof(bool)) },
            { "RemoteJob", (j => j.RemoteJob, typeof(bool)) },
            { "VehicleSizeId", (j => j.UcjbSize, typeof(short)) },
            {
                "clearListAreaId",
                (j => j.TblBulkJobs.Select(b => b.Region.ZoneNames.Select(z => z.ZoneGroup.ClearListAreaId).FirstOrDefault()).FirstOrDefault(),
                    typeof(int))
            }
        };

    private readonly ILogger _logger;

    public DynamicQueryHelper(ILogger logger)
    {
        _logger = logger;
    }

    private static string GetPropertyPath<T>(Expression<Func<TucJob, T>> expression)
    {
        if (expression.Body is MethodCallExpression { Method.Name: "FirstOrDefault" } methodCallExpression)
        {
            // Handle FirstOrDefault calls
            if (methodCallExpression.Arguments[0] is not MethodCallExpression selectExpression)
                return GetExpressionPath(methodCallExpression.Arguments[0]);

            var source = (methodCallExpression.Arguments[0] as MethodCallExpression)?.Arguments[0];
            if (source == null) return GetExpressionPath(methodCallExpression.Arguments[0]);
            var sourcePath = GetExpressionPath(source);
            var selectPath = GetExpressionPath(selectExpression.Arguments[1]);
            return $"{sourcePath}.Select({selectPath}).FirstOrDefault()";
        }

        var memberExpression = expression.Body as MemberExpression;
        if (memberExpression != null) return GetMemberExpressionPath(memberExpression);

        switch (expression.Body)
        {
            case UnaryExpression unaryExpression:
                memberExpression = unaryExpression.Operand as MemberExpression;
                break;
            case BinaryExpression binaryExpression:
                return expression.ToString().Split("=>")[1].Trim();
        }

        return GetMemberExpressionPath(memberExpression);
    }

    private static string GetExpressionPath(Expression expression)
    {
        return expression switch
        {
            MemberExpression memberExpression => GetMemberExpressionPath(memberExpression),
            MethodCallExpression methodCallExpression => GetMethodCallPath(methodCallExpression),
            LambdaExpression lambdaExpression => GetPropertyPath(lambdaExpression as Expression<Func<TucJob, object>>),
            _ => expression.ToString()
        };
    }

    private static string GetMethodCallPath(MethodCallExpression methodCall)
    {
        var methodName = methodCall.Method.Name;
        var arguments = methodCall.Arguments.Select(GetExpressionPath);
        return $"{GetExpressionPath(methodCall.Object)}.{methodName}({string.Join(", ", arguments)})";
    }

    private static string GetMemberExpressionPath(MemberExpression memberExpression)
    {
        var parts = new List<string>();
        var current = memberExpression;

        while (current != null)
        {
            parts.Add(current.Member.Name);
            current = current.Expression as MemberExpression;
        }

        parts.Reverse();
        return string.Join(".", parts);
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
                var (expression, fieldType) = field;
                var op = ParseOperator(parts[++i]);
                var value = parts[++i];

                var propertyPath = GetPropertyPath(expression);
                string finalExpression = BuildExpression(propertyPath, op, value, fieldType);
                expressions.Add(finalExpression);
            }
            else
            {
                throw new ArgumentException($"Invalid field name: {part}");
            }
        }

        return string.Join(" ", expressions);
    }

    private static string BuildExpression(string propertyPath, AllowedOperator op, string value, Type fieldType)
    {
        switch (op)
        {
            case AllowedOperator.IsNull:
                return $"{propertyPath} == null";
            case AllowedOperator.IsNotNull:
                return $"{propertyPath} != null";
            case AllowedOperator.In:
            case AllowedOperator.NotIn:
                var values = ParseInValues(value, fieldType);
                return BuildInCondition(propertyPath, values, op == AllowedOperator.NotIn);
            default:
                var parsedValue = ParseValue(value, fieldType);
                return BuildComparison(propertyPath, op, parsedValue);
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

        if (targetType != typeof(int) && targetType != typeof(short)) return $"\"{value}\"";
        if (!int.TryParse(value, out _))
            throw new ArgumentException($"Invalid numeric value: {value}");
        return value;
    }

    private static List<string> ParseInValues(string values, Type targetType)
    {
        values = values.Trim('(', ')');
        return values.Split(',')
            .Select(v => v.Trim())
            .Select(v => ParseValue(v, targetType))
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