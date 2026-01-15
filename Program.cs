using System;
using System.IO;
using System.Linq;
using System.Security.AccessControl;
using System.Threading.Tasks;
using Amazon;
using Amazon.Runtime;
using Amazon.Runtime.CredentialManagement;
using Amazon.S3;
using DespatchWeb;
using DespatchWeb.EntityClasses;
using DespatchWeb.Interfaces;
using DespatchWeb.Repositories;
using DespatchWeb.Services;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Server.Kestrel.Core;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Serilog;
using StackExchange.Redis;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddHealthChecks()
    .AddCheck<SqlServerHealthCheck>("sql_server_health_check");
builder.Services.AddControllersWithViews()
    .AddNewtonsoftJson(options =>
    {
        options.SerializerSettings.DateTimeZoneHandling = Newtonsoft.Json.DateTimeZoneHandling.RoundtripKind;
        options.SerializerSettings.DateParseHandling = Newtonsoft.Json.DateParseHandling.DateTimeOffset;
    });

builder.Configuration.AddJsonFile("appsettings.json", optional: true, reloadOnChange: true);
Log.Logger =  new LoggerConfiguration().ReadFrom.Configuration(builder.Configuration).WriteTo.Console().CreateLogger();

if (builder.Environment.IsDevelopment())
{
    var keyDirectory = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "DeliverDifferent", "DataProtection-Keys");
    
    // Ensure the directory exists with proper permissions
    if (!Directory.Exists(keyDirectory))
    {
        var dirInfo = Directory.CreateDirectory(keyDirectory);

        if (OperatingSystem.IsWindows())
        {
            // Get the current user's identity
            var currentUser = System.Security.Principal.WindowsIdentity.GetCurrent();
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
    builder.Services.AddDataProtection().PersistKeysToAWSSystemsManager("/Hub/DataProtection").SetApplicationName("DeliverDifferent");
}


builder.Services.AddSingleton<IConnectionStringManager, ConnectionStringManager>();
builder.Services.AddSingleton<IAmazonS3>(_ =>
{
    var awsOptions = builder.Configuration.GetAWSOptions();

    Log.Information("AWS Region from config: {Region}", awsOptions.Region?.SystemName ?? "null");

    var ssoCreds = LoadSsoCredentials("default");
    return new AmazonS3Client(ssoCreds, new AmazonS3Config
    {
        RegionEndpoint = awsOptions.Region ?? RegionEndpoint.APSoutheast2
    });
});

builder.Services.Configure<CookiePolicyOptions>(options =>
{
    // This lambda determines whether user consent for non-essential cookies is needed for a given request.
    options.CheckConsentNeeded = _ => true;
    options.MinimumSameSitePolicy = SameSiteMode.Lax; // Changed from None to prevent CSRF
    options.Secure = CookieSecurePolicy.Always; // Ensure cookies only sent over HTTPS
});

// Set reasonable file upload limits (100MB max)
const long maxFileSize = 100 * 1024 * 1024; // 100MB
builder.Services.Configure<FormOptions>(x =>
{
    x.ValueLengthLimit = (int)maxFileSize;
    x.MultipartBodyLengthLimit = maxFileSize;
    x.MultipartHeadersLengthLimit = 32768; // 32KB for headers
});
builder.Services.Configure<IISServerOptions>(options =>
{
    options?.MaxRequestBodySize = maxFileSize;
});

builder.Services.Configure<KestrelServerOptions>(options =>
{
    options?.Limits.MaxRequestBodySize = maxFileSize;
});

builder.Services.AddHttpClient();
builder.Services.AddHttpContextAccessor();

builder.Services.AddScoped<IJobRepository, JobRepository>();
builder.Services.AddScoped<INationwideJobRepository, NationwideJobRepository>();
builder.Services.AddScoped<ICourierRepository, CourierRepository>();
builder.Services.AddScoped<IClientRepository, ClientRepository>();
builder.Services.AddScoped<IDfrntViewsRepository, DfrntViewsRepository>();
builder.Services.AddScoped<ITaskRepository, TaskRepository>();
builder.Services.AddScoped<IRecurringJobRepository, RecurringJobRepository>();
builder.Services.AddScoped<IMessageRepository, MessageRepository>();

builder.Services.AddScoped<IFlightStatsService, FlightStatsService>();
builder.Services.AddScoped<IClientAccessValidatorService, ClientAccessValidatorService>();
builder.Services.AddScoped<IRateJobService, RateJobService>();
builder.Services.AddScoped<ITenantInfoService, TenantInfoService>();
builder.Services.AddScoped<IFlightRateService, FlightRateService>();
builder.Services.AddScoped<IAddStopJobService, AddStopJobService>();
builder.Services.AddScoped<IMessageHelperService, MessageHelperService>();
builder.Services.AddScoped<IAddAgentRecoveryJobService, AddAgentRecoveryJobService>();
builder.Services.AddScoped<IAddressLookupService, AddressLookupService>();
builder.Services.AddScoped<IJobReportService, JobReportService>();
builder.Services.AddScoped<IJobPhotoService, JobPhotoService>();
builder.Services.AddScoped<IClearListEnvelopeService, ClearListEnvelopeService>();
builder.Services.AddScoped<IDispatchJobService, DispatchJobService>();
builder.Services.AddScoped<IDeliveryJourneyService, DeliveryJourneyService>();

// Register DespatchContext with a fake connection string
builder.Services.AddDbContextFactory<DespatchContext>(options =>
    options.UseSqlServer("Server=(localdb)\\mssqllocaldb;Database=dummy;Trusted_Connection=True;"), ServiceLifetime.Transient);

builder.Services.AddScoped<IDbContextFactory<DespatchContext>, DynamicDespatchDbContextFactory>();


var domain = Environment.GetEnvironmentVariable("Domain") ?? string.Empty;
if (string.IsNullOrEmpty(domain))
{
    throw new InvalidOperationException(
        "Could not find a env var string named 'Domain'.");
}

// Configure Redis Based Distributed Session
var redisConfig = Environment.GetEnvironmentVariable("RedisConfig");
if (string.IsNullOrEmpty(redisConfig))
{
    throw new InvalidOperationException(
        "Could not find a Redis Env Var named 'RedisConfig'.");
}
var redisConfigurationOptions = ConfigurationOptions.Parse(redisConfig);

builder.Services.AddStackExchangeRedisCache(redisCacheConfig =>
{
    redisCacheConfig.ConfigurationOptions = redisConfigurationOptions;
});

builder.Services.AddAuthentication("Identity.Application")
    .AddCookie("Identity.Application", options =>
    {
        options.Cookie.Name = ".AspNet.SharedCookie";
        options.ExpireTimeSpan = TimeSpan.FromMinutes(20);
        options.SlidingExpiration = true;
        options.AccessDeniedPath = "/Forbidden/";
        options.Events = new CookieAuthenticationEvents
        {
            OnRedirectToLogin = context =>
            {
                context.HttpContext.Response.Redirect(Environment.GetEnvironmentVariable("PublicPath") ?? string.Empty);
                return Task.CompletedTask;
            }
        };
        options.Cookie.HttpOnly = true;
        options.Cookie.Domain = domain;
    });

builder.Services.AddSession(options => {
    options.Cookie.Name = "hub_session";
    options.IdleTimeout = TimeSpan.FromMinutes(60 * 24);
});


var app = builder.Build();
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
var provider = new FileExtensionContentTypeProvider {
    Mappings = {
        [".map"] = "application/json" 
    }
};

app.UseStaticFiles(new StaticFileOptions
{
    ContentTypeProvider = provider
});

app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(
        Path.Combine(builder.Environment.ContentRootPath, "wwwroot", "dist")),
    RequestPath = "/dist",
    ContentTypeProvider = provider  // Make sure to use the same provider here
});

// CSRF protection for API requests - verify X-Requested-With header
// Combined with SameSite cookies, this prevents CSRF attacks
app.Use(async (context, next) =>
{
    var method = context.Request.Method;
    var isStateChangingRequest = method is "POST" or "PUT" or "PATCH" or "DELETE";

    if (isStateChangingRequest && !context.Request.Path.StartsWithSegments("/healthz"))
    {
        var hasXhrHeader = context.Request.Headers.XRequestedWith == "XMLHttpRequest";
        if (!hasXhrHeader)
        {
            context.Response.StatusCode = 400;
            await context.Response.WriteAsync("Invalid request - missing required header");
            return;
        }
    }

    await next();
});

// Security headers middleware
app.Use(async (context, next) =>
{
    var headers = context.Response.Headers;

    // Prevent MIME type sniffing
    headers.XContentTypeOptions = "nosniff";

    // Prevent clickjacking
    headers.XFrameOptions = "DENY";

    // XSS filter (legacy browsers)
    headers.XXSSProtection = "1; mode=block";

    // Control referrer information
    headers["Referrer-Policy"] = "strict-origin-when-cross-origin";

    // Restrict browser features
    headers["Permissions-Policy"] = "geolocation=(self), microphone=()";

    // HSTS - Force HTTPS for 1 year, include subdomains
    headers.StrictTransportSecurity = "max-age=31536000; includeSubDomains";

    // Content Security Policy - restrict resource loading
    // Note: 'unsafe-inline' and 'unsafe-eval' required for AngularJS
    headers.ContentSecurityPolicy =
        "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://maps.googleapis.com https://maps.google.com https://js.api.here.com https://ajax.googleapis.com https://cdnjs.cloudflare.com; " +
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://ajax.googleapis.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; " +
        "img-src 'self' data: blob: https: http:; " +
        "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net data:; " +
        "connect-src 'self' https://*.here.com https://*.googleapis.com https://*.hereapi.com https://cdn.jsdelivr.net wss: ws:; " +
        "frame-ancestors 'none'; " +
        "base-uri 'self'; " +
        "form-action 'self';";

    await next();
});

app.UseCookiePolicy();
app.UseRouting();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");

var s3BucketMars = Environment.GetEnvironmentVariable("S3BucketMars");
if (string.IsNullOrEmpty(s3BucketMars)) Log.Warning("S3BucketMars environment variable is not set");

app.Run();
return;

// Method to get SSO credentials from the information in the shared config file.
static AWSCredentials LoadSsoCredentials(string profile)
{
    var chain = new CredentialProfileStoreChain();
    if (chain.TryGetAWSCredentials(profile, out var credentials)) return credentials;
    // If the SSO credentials are not found, use FallbackCredentialsFactory to get credentials
#pragma warning disable CS0618 // Type or member is obsolete
    credentials = FallbackCredentialsFactory.GetCredentials();
#pragma warning restore CS0618 // Type or member is obsolete
    return credentials ?? throw new Exception($"Failed to find the {profile} profile or any fallback credentials");
}

