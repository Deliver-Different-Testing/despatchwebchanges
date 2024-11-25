using Amazon.Runtime;
using Amazon.Runtime.CredentialManagement;
using Amazon.S3;
using DespatchWeb.Automapper;
using DespatchWeb.EntityClasses;
using DespatchWeb.Interfaces;
using DespatchWeb.Repositories;
using DespatchWeb.Services;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Server.Kestrel.Core;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.FileProviders;
using Serilog;
using StackExchange.Redis;
using System;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Amazon;
using DespatchWeb;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.Extensions.Hosting;
using DespatchWeb.Helpers;
using Microsoft.Extensions.Logging;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddHealthChecks()
    .AddCheck<SqlServerHealthCheck>("sql_server_health_check");
builder.Services.AddControllersWithViews();
builder.Configuration.AddJsonFile("appsettings.json", optional: true, reloadOnChange: true);
Log.Logger =  new LoggerConfiguration().ReadFrom.Configuration(builder.Configuration).WriteTo.Console().CreateLogger();

if (builder.Environment.IsDevelopment())
{
    var keyDirectory = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "DeliverDifferent", "DataProtection-Keys");


    // Ensure directory exists with proper permissions
    if (!Directory.Exists(keyDirectory))
    {
        var dirInfo = Directory.CreateDirectory(keyDirectory);

        if (OperatingSystem.IsWindows())
        {
            // Get current user's identity
            var currentUser = System.Security.Principal.WindowsIdentity.GetCurrent();
            var fileSystemRights = System.Security.AccessControl.FileSystemRights.FullControl;
            var inheritanceFlags = System.Security.AccessControl.InheritanceFlags.ContainerInherit |
                                   System.Security.AccessControl.InheritanceFlags.ObjectInherit;
            var propagationFlags = System.Security.AccessControl.PropagationFlags.None;
            var accessControlType = System.Security.AccessControl.AccessControlType.Allow;

            var accessRule = new System.Security.AccessControl.FileSystemAccessRule(
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

    builder.Services.AddDataProtection()
        .PersistKeysToFileSystem(new DirectoryInfo(keyDirectory))
        .SetApplicationName("DeliverDifferent")
        .ProtectKeysWithDpapi();

    Log.Information($"DataProtection configured to use directory: {keyDirectory}");

}
else
{
    builder.Services.AddDataProtection().PersistKeysToAWSSystemsManager("/Hub/DataProtection").SetApplicationName("DeliverDifferent");
}


builder.Services.AddSingleton<IConnectionStringManager, ConnectionStringManager>();
builder.Services.AddSingleton<IAmazonS3>(serviceProvider =>
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
    options.CheckConsentNeeded = context => true;
    options.MinimumSameSitePolicy = SameSiteMode.None;
});

builder.Services.Configure<FormOptions>(x =>
{
    x.ValueLengthLimit = int.MaxValue;
    x.MultipartBodyLengthLimit = int.MaxValue;
    x.MultipartHeadersLengthLimit = int.MaxValue;
});
builder.Services.Configure<IISServerOptions>(options =>
{
    if (options != null) options.MaxRequestBodySize = int.MaxValue;
});

builder.Services.Configure<KestrelServerOptions>(options =>
{
    if (options != null) options.Limits.MaxRequestBodySize = int.MaxValue;
});

builder.Services.AddHttpClient();
builder.Services.AddHttpContextAccessor();

builder.Services.AddScoped<IJobRepository, JobRepository>();
builder.Services.AddScoped<INationwideJobRepository, NationwideJobRepository>();
builder.Services.AddScoped<ICourierRepository, CourierRepository>();
builder.Services.AddScoped<IClientRepository, ClientRepository>();
builder.Services.AddScoped<IDfrntViewsRepository, DfrntViewsRepository>();

builder.Services.AddScoped<IFlightStatsService, FlightStatsService>();
builder.Services.AddScoped<IClientAccessValidatorService, ClientAccessValidatorService>();

// Automapper
builder.Services.AddAutoMapper(typeof(GenericMapperProfiles));


// Register DespatchContext with a dummy connection string
builder.Services.AddDbContextFactory<DespatchContext>(options =>
    options.UseSqlServer("Server=(localdb)\\mssqllocaldb;Database=dummy;Trusted_Connection=True;"), ServiceLifetime.Transient);

builder.Services.AddScoped<IDbContextFactory<DespatchContext>, DynamicDespatchDbContextFactory>();


var domain = Environment.GetEnvironmentVariable("Domain") ?? "";
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
        options.Events = new CookieAuthenticationEvents()
        {
            OnRedirectToLogin = (context) =>
            {
                context.HttpContext.Response.Redirect(Environment.GetEnvironmentVariable("PublicPath") ?? "");
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
                Description = e.Value.Description
            }),
            Duration = report.TotalDuration
        };

        await context.Response.WriteAsJsonAsync(response);
    }
});
// Configure the HTTP request pipeline.
var provider = new FileExtensionContentTypeProvider { Mappings = { [".tpl"] = "text/plain" } };

app.UseStaticFiles(new StaticFileOptions
{

    ContentTypeProvider = provider
});

app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(
        Path.Combine(builder.Environment.ContentRootPath, "wwwroot", "dist")),
    RequestPath = "/dist"
});
//app.UseRaygun();
//app.UseHttpsRedirection();
app.UseCookiePolicy();
app.UseRouting();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");


app.Run();
return;

//
// Method to get SSO credentials from the information in the shared config file.
static AWSCredentials LoadSsoCredentials(string profile)
{
    var chain = new CredentialProfileStoreChain();
    if (!chain.TryGetAWSCredentials(profile, out var credentials))
    {
        // If the SSO credentials are not found, use FallbackCredentialsFactory to get credentials
        credentials = FallbackCredentialsFactory.GetCredentials();
        if (credentials == null)
            throw new Exception($"Failed to find the {profile} profile or any fallback credentials");
    }
    return credentials;
}