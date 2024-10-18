using Microsoft.Extensions.DependencyInjection;
using Serilog;
using System.Collections.Generic;
using System.IO;
using System.Security.Cryptography;
using System;
using System.Text.Json;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace DespatchWeb
{
    public static class AuthenticationExtensions
    {
        public static JwtSecurityToken CreateApiToken(string name, int tenantId, string connection)
        {
            var symmetricSecurityKey =
                new SymmetricSecurityKey(Encoding.UTF8.GetBytes(Environment.GetEnvironmentVariable("JWTSecretKey")));

            var sensitiveClaims = JsonSerializer.Serialize(new
            {
                TenantId = tenantId.ToString(),
                Connection = connection
            });
            var encryptedClaims = EncryptClaims(sensitiveClaims, Environment.GetEnvironmentVariable("ClaimsKey"));
            var claims = new Claim[]
            {
                new Claim(ClaimTypes.Name, name),
                new Claim("SC", encryptedClaims)
            };

            return new JwtSecurityToken(
                issuer: Environment.GetEnvironmentVariable("Issuer"),
                audience: Environment.GetEnvironmentVariable("Audience"),
                claims: claims,
                expires: DateTime.UtcNow.AddDays(7), // expires in 7 days by default, but we don't validate the expiry date
                signingCredentials: new SigningCredentials(symmetricSecurityKey, SecurityAlgorithms.HmacSha256)
            );
        }


        internal static string EncryptClaims(string claims, string key)
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
}
