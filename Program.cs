using DespatchWeb.EntityClasses;
using DespatchWeb.Repositories;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Mindscape.Raygun4Net.AspNetCore;
using StackExchange.Redis;
using System;
using System.Threading.Tasks;
using Amazon.Runtime;
using Serilog;
using Amazon.Runtime.CredentialManagement;
using Amazon.S3;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddHealthChecks();
builder.Services.AddRaygun(builder.Configuration);
builder.Services.AddControllersWithViews();
builder.Configuration.AddJsonFile("appsettings.json", optional: true, reloadOnChange: true);
Log.Logger =  new LoggerConfiguration().ReadFrom.Configuration(builder.Configuration).WriteTo.Console().CreateLogger();

builder.Services.AddDataProtection().PersistKeysToAWSSystemsManager("/Hub/DataProtection").SetApplicationName("DeliverDifferent");

builder.Services.AddSingleton<IAmazonS3>(serviceProvider =>
{
    var ssoCreds = LoadSsoCredentials("default");
    return new AmazonS3Client(ssoCreds); 
});
builder.Services.AddDefaultAWSOptions(builder.Configuration.GetAWSOptions());

builder.Services.Configure<CookiePolicyOptions>(options =>
{
    // This lambda determines whether user consent for non-essential cookies is needed for a given request.
    options.CheckConsentNeeded = context => true;
    options.MinimumSameSitePolicy = SameSiteMode.None;
});
builder.Services.AddScoped<JobRepository, JobRepository>();
builder.Services.AddScoped<CourierRepository, CourierRepository>();
builder.Services.AddScoped<ClientRepository, ClientRepository>();


var connectionString = Environment.GetEnvironmentVariable("SQLConnection") ?? "";
if (string.IsNullOrEmpty(connectionString))
{
    throw new InvalidOperationException(
        "Could not find a connection string named 'SQLConnection'.");
}
builder.Services.AddHealthChecks().AddSqlServer(connectionString);
//var connectionTimeout = builder.Configuration.GetValue<int>("ConnectionTimeout");
builder.Services.AddDbContext<DespatchContext>(x =>
{
    //x.UseSqlServer(connectionString, oa => oa.UseRowNumberForPaging().UseCompatibilityLevel(120));
    //x.UseSqlServer(connectionString, oa=>oa.UseCompatibilityLevel(120));
    x.UseSqlServer(connectionString);
#if DEBUG
x.UseLoggerFactory(LoggerFactory.Create(c => c.AddDebug()));
#endif
});

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
app.MapHealthChecks("/healthz");
// Configure the HTTP request pipeline.
var provider = new FileExtensionContentTypeProvider { Mappings = { [".tpl"] = "text/plain" } };

app.UseStaticFiles(new StaticFileOptions
{

    ContentTypeProvider = provider
});
app.UseRaygun();
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