using System;
using System.Collections.Generic;
using System.IdentityModel.Tokens.Jwt;
using System.IO;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using DespatchWeb.Helpers;
using Microsoft.IdentityModel.Tokens;
using Serilog;

namespace DespatchWeb;

public static class AuthenticationExtensions
{
    private const int MinimumKeyLengthBytes = 32; // 256 bits minimum for HMAC-SHA256

    public static JwtSecurityToken CreateApiToken(string name, int tenantId, string connection, string timeZone, int? clientId = null)
    {
        try
        {
            var jwtSecretKey = Environment.GetEnvironmentVariable("JWTSecretKey");
            if (string.IsNullOrEmpty(jwtSecretKey))
            {
                throw new InvalidOperationException(
                    "JWTSecretKey environment variable is not set. Cannot create secure tokens.");
            }

            var keyBytes = Encoding.UTF8.GetBytes(jwtSecretKey);
            if (keyBytes.Length < MinimumKeyLengthBytes)
            {
                throw new InvalidOperationException(
                    $"JWTSecretKey must be at least {MinimumKeyLengthBytes} bytes (256 bits) for secure token signing.");
            }

            var symmetricSecurityKey = new SymmetricSecurityKey(keyBytes);

            var sensitiveClaims = new Dictionary<string, string>
            {
                ["TenantId"] = tenantId.ToString(),
                ["Connection"] = connection,
                ["TimeZone"] = timeZone
            };

            if (clientId.HasValue)
            {
                sensitiveClaims["ClientId"] = clientId.Value.ToString();
                sensitiveClaims["SubAccounts"] = string.Empty;
            }

            var sensitiveClaimsJson = JsonSerializer.Serialize(sensitiveClaims);
            var encryptedClaims = EncryptClaims(sensitiveClaimsJson, Environment.GetEnvironmentVariable("ClaimsKey"));
            var claims = new Claim[]
            {
                new(ClaimTypes.Name, name),
                new("SC", encryptedClaims)
            };
            Log.Debug("JWT token create process");
            Log.Debug("JWT Issuer: {Issuer}, Audience: {Audience}", Environment.GetEnvironmentVariable("Issuer"),
                Environment.GetEnvironmentVariable("Audience"));
            return new JwtSecurityToken(
                issuer: Environment.GetEnvironmentVariable("Issuer"),
                audience: Environment.GetEnvironmentVariable("Audience"),
                claims: claims,
                expires: DateTime.UtcNow.AddDays(7), // Token expires in 7 days - expiry is validated by JWT middleware
                signingCredentials: new SigningCredentials(symmetricSecurityKey, SecurityAlgorithms.HmacSha256)
            );
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(AuthenticationExtensions),
                    nameof(CreateApiToken)));
            throw;
        }
    }

    private static string EncryptClaims(string claims, string key)
    {
        using var aesAlg = Aes.Create();
        var keyBytes = Convert.FromBase64String(key);
        aesAlg.Key = keyBytes;
        // Generate a cryptographically secure random IV
        aesAlg.GenerateIV();
        var iv = aesAlg.IV;

        using var encryptor = aesAlg.CreateEncryptor(aesAlg.Key, aesAlg.IV);
        using var msEncrypt = new MemoryStream();
        // Write the IV to the beginning of the stream
        msEncrypt.Write(iv, 0, iv.Length);
        using (var csEncrypt = new CryptoStream(msEncrypt, encryptor, CryptoStreamMode.Write))
        using (var swEncrypt = new StreamWriter(csEncrypt))
        {
            swEncrypt.Write(claims);
        }

        return Convert.ToBase64String(msEncrypt.ToArray());
    }
}