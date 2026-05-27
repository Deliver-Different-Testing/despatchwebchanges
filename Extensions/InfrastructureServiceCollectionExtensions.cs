using Amazon;
using Amazon.Runtime;
using Amazon.Runtime.CredentialManagement;
using Amazon.S3;
using DespatchWeb.Interfaces;
using Serilog;

namespace DespatchWeb.Extensions;

public static class InfrastructureServiceCollectionExtensions
{
    public static void AddInfrastructureServices(this IServiceCollection services)
    {
        services.AddSingleton<IConnectionStringManager, ConnectionStringManager>();
        services.AddSingleton<IAmazonS3>(sp =>
        {
            var config = sp.GetRequiredService<IConfiguration>();
            var awsOptions = config.GetAWSOptions();

            Log.Information("AWS Region from config: {Region}", awsOptions.Region?.SystemName ?? "null");

            var ssoCreds = LoadSsoCredentials("default");
            return new AmazonS3Client(ssoCreds, new AmazonS3Config
            {
                RegionEndpoint = awsOptions.Region ?? RegionEndpoint.APSoutheast2
            });
        });
        services.AddHttpClient();
        services.AddHttpContextAccessor();
    }

    // Method to get SSO credentials from the information in the shared config file.
    private static AWSCredentials LoadSsoCredentials(string profile)
    {
        var chain = new CredentialProfileStoreChain();
        if (chain.TryGetAWSCredentials(profile, out var credentials))
        {
            return credentials;
        }
        // If the SSO credentials are not found, use FallbackCredentialsFactory to get credentials
#pragma warning disable CS0618 // Type or member is obsolete
        credentials = FallbackCredentialsFactory.GetCredentials();
#pragma warning restore CS0618 // Type or member is obsolete
        return credentials ?? throw new Exception($"Failed to find the {profile} profile or any fallback credentials");
    }
}
