using System.Security.AccessControl;
using System.Security.Principal;
using DeliverDifferentReporting.Extensions;
using DespatchWeb;
using DespatchWeb.Extensions;
using DespatchWeb.Middleware;
using DespatchWeb.Models;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Server.Kestrel.Core;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.Extensions.FileProviders;
using Newtonsoft.Json;
using Serilog;
using StackExchange.Redis;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddHealthChecks()
    .AddCheck<SqlServerHealthCheck>("sql_server_health_check");
builder.Services.AddControllersWithViews()
    .AddNewtonsoftJson(options =>
    {
        options.SerializerSettings.DateTimeZoneHandling = DateTimeZoneHandling.RoundtripKind;
        options.SerializerSettings.DateParseHandling = DateParseHandling.DateTimeOffset;
    });

builder.Configuration.AddJsonFile("appsettings.json", optional: true, reloadOnChange: true);
Log.Logger = new LoggerConfiguration().ReadFrom.Configuration(builder.Configuration).WriteTo.Console().CreateLogger();

if (builder.Environment.IsDevelopment())
{
    builder.Host.UseDefaultServiceProvider(options =>
    {
        options.ValidateScopes = true;
        options.ValidateOnBuild = true;
    });

    var keyDirectory = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "DeliverDifferent", "DataProtection-Keys");

    // Ensure the directory exists with proper permissions
    if (!Directory.Exists(keyDirectory))
    {
        var dirInfo = Directory.CreateDirectory(keyDirectory);

        if (OperatingSystem.IsWindows())
        {
            // Get the current user's identity
            var currentUser = WindowsIdentity.GetCurrent();
            const FileSystemRights fileSystemRights = FileSystemRights.FullControl;
            const InheritanceFlags inheritanceFlags = InheritanceFlags.ContainerInherit |
                                                      InheritanceFlags.ObjectInherit;
            const PropagationFlags propagationFlags = PropagationFlags.None;
            const AccessControlType accessControlType = AccessControlType.Allow;

            var accessRule = new FileSystemAccessRule(
                currentUser.Name,
                fileSystemRights,
                inheritanceFlags,
                propagationFlags,
                accessControlType);

            var security = dirInfo.GetAccessControl();
            security.AddAccessRule(accessRule);
            dirInfo.SetAccessControl(security);
        }
    }

    if (OperatingSystem.IsWindows())
    {
        builder.Services.AddDataProtection()
            .PersistKeysToFileSystem(new DirectoryInfo(keyDirectory))
            .SetApplicationName("DeliverDifferent")
            .ProtectKeysWithDpapi();

        Log.Information("DataProtection configured to use directory: {KeyDirectory}", keyDirectory);
    }
}
else
{
    builder.Services.AddDataProtection().PersistKeysToAWSSystemsManager("/Hub/DataProtection")
        .SetApplicationName("DeliverDifferent");
}


builder.Services.AddInfrastructureServices();

builder.Services.Configure<CookiePolicyOptions>(options =>
{
    // This lambda determines whether user consent for non-essential cookies is needed for a given request.
    options.CheckConsentNeeded = _ => true;
    options.MinimumSameSitePolicy = SameSiteMode.Lax; // Changed from None to prevent CSRF
    options.Secure = CookieSecurePolicy.Always; // Ensure cookies only sent over HTTPS
});

// Set reasonable file upload limits (25MB max to prevent DoS)
const long maxFileSize = 25 * 1024 * 1024; // 25MB
builder.Services.Configure<FormOptions>(x =>
{
    x.ValueLengthLimit = (int)maxFileSize;
    x.MultipartBodyLengthLimit = maxFileSize;
    x.MultipartHeadersLengthLimit = 32768; // 32KB for headers
});
builder.Services.Configure<IISServerOptions>(options => { options?.MaxRequestBodySize = maxFileSize; });

builder.Services.Configure<KestrelServerOptions>(options => { options?.Limits.MaxRequestBodySize = maxFileSize; });

// Bind application settings from environment variables and validate at startup
builder.Services.AddOptions<AppSettings>()
    .Configure<IConfiguration>((settings, config) =>
    {
        settings.Domain = config["Domain"] ?? string.Empty;
        settings.RedisConfig = config["RedisConfig"] ?? string.Empty;
        settings.PublicPath = config["PublicPath"] ?? string.Empty;
        settings.HubUrl = config["HubUrl"] ?? string.Empty;
        settings.S3BucketMars = config["S3BucketMars"] ?? string.Empty;
    })
    .ValidateDataAnnotations()
    .ValidateOnStart();

builder.Services
    .AddRepositories()
    .AddJobServices(builder.Configuration)
    .AddPricingServices()
    .AddReportingServices()
    .AddSupportServices()
    .AddTenantServices()
    .AddAiServices();

builder.Services.AddTenantBranding(opts =>
{
    opts.BrandingApiBaseUrl = builder.Configuration["HubUrl"]!;
});

builder.Services.AddMultiTenantDatabase();


// Read build-time settings from configuration (validated at startup via AppSettings options)
var domain = builder.Configuration["Domain"]
    ?? throw new InvalidOperationException("Missing required configuration: 'Domain'.");
var redisConfig = builder.Configuration["RedisConfig"]
    ?? throw new InvalidOperationException("Missing required configuration: 'RedisConfig'.");
var redisConfigurationOptions = ConfigurationOptions.Parse(redisConfig);

builder.Services.AddStackExchangeRedisCache(redisCacheConfig =>
{
    redisCacheConfig.ConfigurationOptions = redisConfigurationOptions;
});

builder.Services.AddAppAuthentication(domain);


var app = builder.Build();
app.MapHealthChecks("/health/live", new HealthCheckOptions { Predicate = _ => false });
app.MapHealthChecks("/healthz", new HealthCheckOptions
{
    ResponseWriter = async (context, report) =>
    {
        context.Response.ContentType = "application/json";

        var response = new
        {
            Status = report.Status.ToString(),
            Checks = report.Entries.Select(e => new
            {
                Component = e.Key,
                Status = e.Value.Status.ToString(),
                e.Value.Description
            }),
            Duration = report.TotalDuration
        };

        await context.Response.WriteAsJsonAsync(response);
    }
});
// Configure the HTTP request pipeline.
var provider = new FileExtensionContentTypeProvider
{
    Mappings =
    {
        [".map"] = "application/json"
    }
};

app.UseStaticFiles(new StaticFileOptions
{
    ContentTypeProvider = provider
});

var distDir = Path.Combine(builder.Environment.ContentRootPath, "wwwroot", "dist");
Directory.CreateDirectory(distDir);
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(distDir),
    RequestPath = "/dist",
    ContentTypeProvider = provider // Make sure to use the same provider here
});

app.UseCsrfProtection();
app.UseSecurityHeaders();

app.UseCookiePolicy();
app.UseRouting();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");

if (string.IsNullOrEmpty(builder.Configuration["S3BucketMars"])) Log.Warning("S3BucketMars environment variable is not set");

app.Run();