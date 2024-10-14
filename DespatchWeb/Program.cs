using System.IO;
using DespatchWeb.Automapper;
using DespatchWeb.EntityClasses;
using DespatchWeb.Interfaces;
using DespatchWeb.Repositories;
using DespatchWeb.Services;
using EntityFrameworkCore.UseRowNumberForPaging;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Server.Kestrel.Core;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Logging;
using Mindscape.Raygun4Net.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddRaygun(builder.Configuration);
builder.Services.AddControllersWithViews();

builder.Services.Configure<CookiePolicyOptions>(options =>
{
    // This lambda determines whether user consent for non-essential cookies is needed for a given request.
    if (options == null) return;
    options.CheckConsentNeeded = _ => true;
    options.MinimumSameSitePolicy = SameSiteMode.Strict;
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

// Repositories
builder.Services.AddScoped<IJobRepository, JobRepository>();
builder.Services.AddScoped<INationwideJobRepository, NationwideJobRepository>();
builder.Services.AddScoped<ICourierRepository, CourierRepository>();
builder.Services.AddScoped<IClientRepository, ClientRepository>();
builder.Services.AddScoped<IDfrntViewsRepository, DfrntViewsRepository>();

// Services
builder.Services.AddScoped<IFlightStatsService, FlightStatsService>();
builder.Services.AddScoped<IClientAccessValidatorService, ClientAccessValidatorService>();


// Automapper
builder.Services.AddAutoMapper(typeof(JobViewModelMapperProfile),
    typeof(GenericMapperProfiles));


var connectionString = builder.Configuration.GetConnectionString("Connection");
builder.Services.AddDbContext<DespatchContext>(x =>
{
    if (connectionString != null) x.UseSqlServer(connectionString, oa => oa.UseRowNumberForPaging());
#if DEBUG
    x.UseLoggerFactory(LoggerFactory.Create(c => c.AddDebug()));
#endif
});

var app = builder.Build();

// Configure the HTTP request pipeline.
var provider = new FileExtensionContentTypeProvider { Mappings = { [".tpl"] = "text/plain" } };

app.UseStaticFiles(new StaticFileOptions
{
    ContentTypeProvider = provider
});

if (builder.Environment.ContentRootPath != null)
    app.UseStaticFiles(new StaticFileOptions
    {
        FileProvider = new PhysicalFileProvider(
            Path.Combine(builder.Environment.ContentRootPath, "wwwroot", "dist")),
        RequestPath = "/dist"
    });

app.UseRaygun();
app.UseAuthentication();
app.UseHttpsRedirection();
app.UseCookiePolicy();
app.UseRouting();
app.UseAuthorization();
app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");

app.Run();
