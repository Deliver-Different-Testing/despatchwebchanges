using DespatchWeb;
using DespatchWeb.EntityClasses;
using DespatchWeb.Repositories;
using EntityFrameworkCore.UseRowNumberForPaging;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Server.IISIntegration;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Mindscape.Raygun4Net.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddRaygun(builder.Configuration);
builder.Services.AddControllersWithViews();

// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
//builder.Services.AddEndpointsApiExplorer();
builder.Services.Configure<CookiePolicyOptions>(options =>
{
    // This lambda determines whether user consent for non-essential cookies is needed for a given request.
    options.CheckConsentNeeded = context => true;
    options.MinimumSameSitePolicy = SameSiteMode.None;
});
builder.Services.AddScoped<JobRepository, JobRepository>();
builder.Services.AddScoped<CourierRepository, CourierRepository>();
builder.Services.AddScoped<ClientRepository, ClientRepository>();

var connectionString = builder.Configuration.GetConnectionString("Connection");
//var connectionTimeout = builder.Configuration.GetValue<int>("ConnectionTimeout");
builder.Services.AddDbContext<DespatchContext>(x =>
{
    x.UseSqlServer(connectionString, oa => oa.UseRowNumberForPaging());
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