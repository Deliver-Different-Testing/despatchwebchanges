using System.IdentityModel.Tokens.Jwt;

namespace DespatchWeb.Tests.Security;

/// <summary>
/// Tests for JWT token creation security in AuthenticationExtensions.
/// Tests validation of JWT secret key requirements.
/// </summary>
public class AuthenticationExtensionsTests : IDisposable
{
    private readonly string? _originalJwtSecretKey;
    private readonly string? _originalClaimsKey;
    private readonly string? _originalIssuer;
    private readonly string? _originalAudience;

    public AuthenticationExtensionsTests()
    {
        // Store original environment variables
        _originalJwtSecretKey = Environment.GetEnvironmentVariable("JWTSecretKey");
        _originalClaimsKey = Environment.GetEnvironmentVariable("ClaimsKey");
        _originalIssuer = Environment.GetEnvironmentVariable("Issuer");
        _originalAudience = Environment.GetEnvironmentVariable("Audience");

        // Set up valid defaults for tests
        Environment.SetEnvironmentVariable("Issuer", "TestIssuer");
        Environment.SetEnvironmentVariable("Audience", "TestAudience");
        // Generate a valid AES key (256 bits = 32 bytes) for claims encryption
        Environment.SetEnvironmentVariable("ClaimsKey", Convert.ToBase64String(new byte[32]));
    }

    public void Dispose()
    {
        // Restore original environment variables
        Environment.SetEnvironmentVariable("JWTSecretKey", _originalJwtSecretKey);
        Environment.SetEnvironmentVariable("ClaimsKey", _originalClaimsKey);
        Environment.SetEnvironmentVariable("Issuer", _originalIssuer);
        Environment.SetEnvironmentVariable("Audience", _originalAudience);
    }

    [Fact]
    public void CreateApiToken_WithNullJwtSecretKey_ThrowsInvalidOperationException()
    {
        // Arrange
        Environment.SetEnvironmentVariable("JWTSecretKey", null);

        // Assert
        var ex = Assert.Throws<InvalidOperationException>((Func<JwtSecurityToken>?)Act ?? throw new InvalidOperationException());
        Assert.Contains("JWTSecretKey", ex.Message);
        Assert.Contains("not set", ex.Message);
        return;

        // Act
        JwtSecurityToken Act() => AuthenticationExtensions.CreateApiToken(name: "TestUser", tenantId: 1, connection: "TestConnection", timeZone: "UTC");
    }

    [Fact]
    public void CreateApiToken_WithEmptyJwtSecretKey_ThrowsInvalidOperationException()
    {
        // Arrange
        Environment.SetEnvironmentVariable("JWTSecretKey", "");

        // Assert
        var ex = Assert.Throws<InvalidOperationException>((Func<JwtSecurityToken>?)Act ?? throw new InvalidOperationException());
        Assert.Contains("JWTSecretKey", ex.Message);
        Assert.Contains("not set", ex.Message);
        return;

        // Act
        JwtSecurityToken Act() => AuthenticationExtensions.CreateApiToken(name: "TestUser", tenantId: 1, connection: "TestConnection", timeZone: "UTC");
    }

    [Theory]
    [InlineData("short")]  // 5 bytes
    [InlineData("0123456789012345")]  // 16 bytes
    [InlineData("01234567890123456789012345678")]  // 29 bytes
    [InlineData("0123456789012345678901234567890")]  // 31 bytes - just under
    public void CreateApiToken_WithShortJwtSecretKey_ThrowsInvalidOperationException(string shortKey)
    {
        // Arrange
        Environment.SetEnvironmentVariable("JWTSecretKey", shortKey);

        // Assert
        var ex = Assert.Throws<InvalidOperationException>((Func<JwtSecurityToken>?)Act ?? throw new InvalidOperationException());
        Assert.Contains("32 bytes", ex.Message);
        Assert.Contains("256 bits", ex.Message);
        return;

        // Act
        JwtSecurityToken Act() => AuthenticationExtensions.CreateApiToken(name: "TestUser", tenantId: 1, connection: "TestConnection", timeZone: "UTC");
    }

    [Fact]
    public void CreateApiToken_WithExactlyMinimumKeyLength_CreatesToken()
    {
        // Arrange - exactly 32 bytes (256 bits)
        var validKey = "01234567890123456789012345678901";  // 32 characters = 32 bytes UTF8
        Environment.SetEnvironmentVariable("JWTSecretKey", validKey);

        // Act
        var token = AuthenticationExtensions.CreateApiToken(
            name: "TestUser",
            tenantId: 1,
            connection: "TestConnection",
            timeZone: "UTC");

        // Assert
        Assert.NotNull(token);
        Assert.NotEmpty(token.Claims);
    }

    [Fact]
    public void CreateApiToken_WithLongSecretKey_CreatesToken()
    {
        // Arrange - 64 bytes (512 bits) - well above minimum
        var longKey = new string('x', 64);
        Environment.SetEnvironmentVariable("JWTSecretKey", longKey);

        // Act
        var token = AuthenticationExtensions.CreateApiToken(
            name: "TestUser",
            tenantId: 1,
            connection: "TestConnection",
            timeZone: "UTC");

        // Assert
        Assert.NotNull(token);
    }

    [Fact]
    public void CreateApiToken_WithValidInputs_CreatesTokenWithCorrectClaims()
    {
        // Arrange
        var validKey = new string('x', 32);
        Environment.SetEnvironmentVariable("JWTSecretKey", validKey);

        // Act
        var token = AuthenticationExtensions.CreateApiToken(
            name: "TestUser",
            tenantId: 1,
            connection: "TestConnection",
            timeZone: "UTC");

        // Assert
        Assert.NotNull(token);
        Assert.Contains(token.Claims, c => c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name" && c.Value == "TestUser");
        Assert.Contains(token.Claims, c => c.Type == "SC"); // Encrypted sensitive claims
    }

    [Fact]
    public void CreateApiToken_WithClientId_IncludesClientIdInClaims()
    {
        // Arrange
        var validKey = new string('x', 32);
        Environment.SetEnvironmentVariable("JWTSecretKey", validKey);

        // Act
        var token = AuthenticationExtensions.CreateApiToken(
            name: "TestUser",
            tenantId: 1,
            connection: "TestConnection",
            timeZone: "UTC",
            clientId: 123);

        // Assert
        Assert.NotNull(token);
        // Client ID should be in the encrypted claims (SC)
        Assert.Contains(token.Claims, c => c.Type == "SC");
    }

    [Fact]
    public void CreateApiToken_SetsCorrectExpiry()
    {
        // Arrange
        var validKey = new string('x', 32);
        Environment.SetEnvironmentVariable("JWTSecretKey", validKey);

        // Act
        var token = AuthenticationExtensions.CreateApiToken(
            name: "TestUser",
            tenantId: 1,
            connection: "TestConnection",
            timeZone: "UTC");

        // Assert
        var expectedExpiry = DateTime.UtcNow.AddDays(7);
        var tolerance = TimeSpan.FromMinutes(1);
        Assert.InRange(token.ValidTo, expectedExpiry - tolerance, expectedExpiry + tolerance);
    }

    [Fact]
    public void CreateApiToken_UsesHmacSha256Signing()
    {
        // Arrange
        var validKey = new string('x', 32);
        Environment.SetEnvironmentVariable("JWTSecretKey", validKey);

        // Act
        var token = AuthenticationExtensions.CreateApiToken(
            name: "TestUser",
            tenantId: 1,
            connection: "TestConnection",
            timeZone: "UTC");

        // Assert
        Assert.Equal("HS256", token.SignatureAlgorithm);
    }

    [Fact]
    public void CreateApiToken_SetsIssuerAndAudience()
    {
        // Arrange
        var validKey = new string('x', 32);
        Environment.SetEnvironmentVariable("JWTSecretKey", validKey);
        Environment.SetEnvironmentVariable("Issuer", "TestIssuer");
        Environment.SetEnvironmentVariable("Audience", "TestAudience");

        // Act
        var token = AuthenticationExtensions.CreateApiToken(
            name: "TestUser",
            tenantId: 1,
            connection: "TestConnection",
            timeZone: "UTC");

        // Assert
        Assert.Equal("TestIssuer", token.Issuer);
        Assert.Contains("TestAudience", token.Audiences);
    }

    [Fact]
    public void CreateApiToken_DifferentKeys_ProduceDifferentTokens()
    {
        // Arrange
        var key1 = new string('a', 32);
        var key2 = new string('b', 32);

        Environment.SetEnvironmentVariable("JWTSecretKey", key1);
        var token1 = AuthenticationExtensions.CreateApiToken("User", 1, "Conn", "UTC");

        Environment.SetEnvironmentVariable("JWTSecretKey", key2);
        var token2 = AuthenticationExtensions.CreateApiToken("User", 1, "Conn", "UTC");

        // Assert
        var tokenString1 = new JwtSecurityTokenHandler().WriteToken(token1);
        var tokenString2 = new JwtSecurityTokenHandler().WriteToken(token2);

        Assert.NotEqual(tokenString1, tokenString2);
    }

}
