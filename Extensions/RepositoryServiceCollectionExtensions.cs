using DespatchWeb.Interfaces;
using DespatchWeb.Repositories;

namespace DespatchWeb.Extensions;

public static class RepositoryServiceCollectionExtensions
{
    public static IServiceCollection AddRepositories(this IServiceCollection services)
    {
        services.AddScoped<IJobRepository, JobRepository>();
        services.AddScoped<IJobQueryRepository>(sp => sp.GetRequiredService<IJobRepository>());
        services.AddScoped<IJobCommandRepository>(sp => sp.GetRequiredService<IJobRepository>());
        services.AddScoped<INoteRepository, NoteRepository>();
        services.AddScoped<INationwideJobRepository, NationwideJobRepository>();
        services.AddScoped<ICourierRepository, CourierRepository>();
        services.AddScoped<IClientRepository, ClientRepository>();
        services.AddScoped<IDfrntViewsRepository, DfrntViewsRepository>();
        services.AddScoped<ITaskRepository, TaskRepository>();
        services.AddScoped<IRecurringJobRepository, RecurringJobRepository>();
        services.AddScoped<IMessageRepository, MessageRepository>();
        services.AddScoped<IAccessorialChargeRepository, AccessorialChargeRepository>();

        return services;
    }
}
