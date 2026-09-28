using DespatchWeb.Interfaces;
using DespatchWeb.Repositories;
using DespatchWeb.Services;

namespace DespatchWeb.Extensions;

public static class RepositoryServiceCollectionExtensions
{
    public static IServiceCollection AddRepositories(this IServiceCollection services)
    {
        services.AddScoped<IInboundAgentLinkService, InboundAgentLinkService>();
        services.AddScoped<JobRepository>();
        services.AddScoped<IJobQueryRepository>(sp => sp.GetRequiredService<JobRepository>());
        services.AddScoped<IJobCommandRepository>(sp => sp.GetRequiredService<JobRepository>());
        services.AddScoped<INoteRepository, NoteRepository>();
        services.AddScoped<INationwideJobRepository, NationwideJobRepository>();
        services.AddScoped<ICourierRepository, CourierRepository>();
        services.AddScoped<IClientRepository, ClientRepository>();
        services.AddScoped<IDfrntViewsRepository, DfrntViewsRepository>();
        services.AddScoped<ITaskRepository, TaskRepository>();
        services.AddScoped<IRecurringJobRepository, RecurringJobRepository>();
        services.AddScoped<IMessageRepository, MessageRepository>();
        services.AddScoped<IAccessorialChargeRepository, AccessorialChargeRepository>();
        services.AddScoped<IDispatchLayoutRepository, DispatchLayoutRepository>();
        services.AddScoped<IStaffPreferenceRepository, StaffPreferenceRepository>();
        services.AddScoped<ITenantSettingsService, TenantSettingsService>();

        return services;
    }
}
