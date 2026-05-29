namespace DespatchWeb.Tests.Infrastructure;

/// <summary>
/// Marker collection that serializes any test class which mutates the process-wide
/// JWT / Integration Manager environment variables
/// (<c>JWTSecretKey</c>, <c>ClaimsKey</c>, <c>Issuer</c>, <c>Audience</c>,
/// <c>IntegrationManagerUrl</c>).
///
/// xUnit v3 runs test classes from different collections in parallel. Because
/// <see cref="Environment.SetEnvironmentVariable(string, string)"/> mutates global
/// process state, two classes touching the same variable will race and produce
/// flaky failures (e.g. <c>JWTSecretKey</c> set to <c>null</c> mid-run by
/// <c>AuthenticationExtensionsTests</c> while another class is minting a token).
/// Assigning all such classes to this single collection forces them to run
/// sequentially.
/// </summary>
[CollectionDefinition(Name, DisableParallelization = true)]
public sealed class JwtEnvironmentCollection
{
    public const string Name = "JwtEnvironmentMutation";
}
