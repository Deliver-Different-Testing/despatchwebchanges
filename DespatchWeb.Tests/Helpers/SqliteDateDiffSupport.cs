using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Query;
using Microsoft.EntityFrameworkCore.Query.SqlExpressions;
using Microsoft.Extensions.DependencyInjection;
using System.Reflection;

namespace DespatchWeb.Tests.Helpers;

/// <summary>
/// Provides SQLite-compatible translation for SQL Server's EF.Functions.DateDiffMinute.
/// </summary>
public static class SqliteDateDiffSupport
{
    /// <summary>
    /// Registers a SQLite user function 'datediff_minute' that computes minute difference.
    /// </summary>
    public static void RegisterDateDiffMinute(this SqliteConnection connection) =>
        connection.CreateFunction("datediff_minute", (string? start, string? end) =>
        {
            if (start == null || end == null) return null;
            return (int?)(DateTime.Parse(end) - DateTime.Parse(start)).TotalMinutes;
        });

    /// <summary>
    /// Adds a custom EF Core translator that maps EF.Functions.DateDiffMinute to the SQLite function.
    /// </summary>
    public static TBuilder AddSqliteDateDiffTranslation<TBuilder>(this TBuilder builder)
        where TBuilder : DbContextOptionsBuilder
    {
        ((IDbContextOptionsBuilderInfrastructure)builder).AddOrUpdateExtension(new DateDiffExtension());
        return builder;
    }
}

internal class DateDiffExtension : IDbContextOptionsExtension
{
    public DbContextOptionsExtensionInfo Info => new ExtInfo(this);

    public void ApplyServices(IServiceCollection services) => services.AddSingleton<IMethodCallTranslatorPlugin, DateDiffPlugin>();

    public void Validate(IDbContextOptions options) { }

    private sealed class ExtInfo(IDbContextOptionsExtension extension) : DbContextOptionsExtensionInfo(extension)
    {
        public override bool IsDatabaseProvider => false;
        public override string LogFragment => "SqliteDateDiff ";
        public override int GetServiceProviderHashCode() => 0;
        public override bool ShouldUseSameServiceProvider(DbContextOptionsExtensionInfo other) => other is ExtInfo;
        public override void PopulateDebugInfo(IDictionary<string, string> debugInfo) { }
    }
}

internal class DateDiffPlugin : IMethodCallTranslatorPlugin
{
    public IEnumerable<IMethodCallTranslator> Translators { get; } = [new DateDiffTranslator()];
}

internal class DateDiffTranslator : IMethodCallTranslator
{
    private static readonly HashSet<MethodInfo> SupportedMethods =
        typeof(SqlServerDbFunctionsExtensions)
            .GetMethods(BindingFlags.Public | BindingFlags.Static)
            .Where(m => m.Name == nameof(SqlServerDbFunctionsExtensions.DateDiffMinute))
            .ToHashSet();

    public SqlExpression? Translate(
        SqlExpression? instance,
        MethodInfo method,
        IReadOnlyList<SqlExpression> arguments,
        IDiagnosticsLogger<DbLoggerCategory.Query> logger)
    {
        if (!SupportedMethods.Contains(method))
            return null;

        // arguments[0] = DbFunctions (ignored), [1] = startDate, [2] = endDate
        return new SqlFunctionExpression(
            "datediff_minute",
            [arguments[1], arguments[2]],
            nullable: true,
            argumentsPropagateNullability: [true, true],
            method.ReturnType,
            typeMapping: null);
    }
}
