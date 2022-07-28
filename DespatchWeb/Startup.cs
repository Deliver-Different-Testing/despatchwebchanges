using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using DespatchWeb.Repositories;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.HttpsPolicy;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Server.IISIntegration;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Mindscape.Raygun4Net.AspNetCore;

namespace DespatchWeb
{
    public class Startup
    {
        public Startup(IConfiguration configuration)
        {
            Configuration = configuration;
        }

        public IConfiguration Configuration { get; }

        // This method gets called by the runtime. Use this method to add services to the container.
        public void ConfigureServices(IServiceCollection services)
        {
            services.Configure<CookiePolicyOptions>(options =>
            {
                // This lambda determines whether user consent for non-essential cookies is needed for a given request.
                options.CheckConsentNeeded = context => true;
                options.MinimumSameSitePolicy = SameSiteMode.None;
            });
            services.AddDbContext<DespatchWebDataContext>(c =>
            {
                //// Test
                //c.UseSqlServer(Configuration.GetConnectionString("ConnectionTest"));

                // Live 
                c.UseSqlServer(Configuration.GetConnectionString("Connection"), builder => builder.UseRowNumberForPaging());
            });
            services.AddAuthentication(IISDefaults.AuthenticationScheme);
            services.AddMvc().SetCompatibilityVersion(CompatibilityVersion.Version_2_1);
            services.AddRaygun(Configuration);
            services.AddScoped<JobRepository, JobRepository>();
            services.AddScoped<CourierRepository, CourierRepository>();
            services.AddScoped<ClientRepository, ClientRepository>();
        }

        // This method gets called by the runtime. Use this method to configure the HTTP request pipeline.
        public void Configure(IApplicationBuilder app, IHostingEnvironment env)
        {
            if (env.IsDevelopment())
            {
                app.UseDeveloperExceptionPage();
            }
            else
            {
                app.UseExceptionHandler("/Home/Error");
                app.UseHsts();
            }

            // Add new mappings
            var provider = new FileExtensionContentTypeProvider {Mappings = {[".tpl"] = "text/plain"}};

            app.UseStaticFiles(new StaticFileOptions
            {

                ContentTypeProvider = provider
            });

            app.UseHttpsRedirection();
            app.UseRaygun();
            app.UseStaticFiles();
            app.UseCookiePolicy();

            app.UseMvc(routes =>
            {
                routes.MapRoute(
                    name: "default",
                    template: "{controller=Home}/{action=Index}/{id?}");
            });
        }
    }
}
