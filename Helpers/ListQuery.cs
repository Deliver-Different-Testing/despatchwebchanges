using System.Linq.Expressions;

namespace DespatchWeb.Helpers;

public sealed class InvalidListQueryException(string message) : ArgumentException(message);

public static class ListQuery
{
    public static IQueryable<T> Sort<T, TTie>(
        IQueryable<T> query,
        string orderBy,
        bool descending,
        string defaultKey,
        IReadOnlyDictionary<string, Func<IQueryable<T>, bool, IOrderedQueryable<T>>> map,
        Expression<Func<T, TTie>> tieBreaker)
    {
        var key = string.IsNullOrWhiteSpace(orderBy) ? defaultKey : orderBy.Trim();
        if (!map.TryGetValue(key, out var apply))
        {
            throw new InvalidListQueryException(
                $"Unknown sort key '{orderBy}'. Allowed: {string.Join(", ", map.Keys)}.");
        }

        return apply(query, descending).ThenBy(tieBreaker);
    }

    public static Func<IQueryable<T>, bool, IOrderedQueryable<T>> By<T, TKey>(Expression<Func<T, TKey>> key) =>
        (q, desc) => desc ? q.OrderByDescending(key) : q.OrderBy(key);

    public static Func<IQueryable<T>, bool, IOrderedQueryable<T>> By<T, TKey1, TKey2>(
        Expression<Func<T, TKey1>> first, Expression<Func<T, TKey2>> second) =>
        (q, desc) => desc
            ? q.OrderByDescending(first).ThenByDescending(second)
            : q.OrderBy(first).ThenBy(second);

    public static Dictionary<string, Func<IQueryable<T>, bool, IOrderedQueryable<T>>> NewMap<T>() =>
        new(StringComparer.OrdinalIgnoreCase);

    public static string NormaliseFilter(string value, string filterName, IReadOnlyCollection<string> allowed)
    {
        if (string.IsNullOrWhiteSpace(value) || value.Trim().Equals("all", StringComparison.OrdinalIgnoreCase))
        {
            return string.Empty;
        }

        var match = allowed.FirstOrDefault(a => a.Equals(value.Trim(), StringComparison.OrdinalIgnoreCase));
        return match ?? throw new InvalidListQueryException(
            $"Unknown {filterName} '{value}'. Allowed: all, {string.Join(", ", allowed)}.");
    }
}
