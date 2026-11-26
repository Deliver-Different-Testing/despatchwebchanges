#nullable enable
using System.Security.Cryptography;
using System.Text;

namespace DespatchWeb.Services;

public static class AgentLinkToken
{
    public const string Prefix = "t_";
    public const int Length = 43;

    public static string PreviewPlaceholder => Prefix + new string('x', Length);

    public static (string Token, byte[] Hash) Create()
    {
        var token = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
        return (token, Hash(token));
    }

    public static byte[] Hash(string token) => SHA256.HashData(Encoding.UTF8.GetBytes(token));
}
