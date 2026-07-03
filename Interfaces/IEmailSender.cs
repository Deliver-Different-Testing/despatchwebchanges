#nullable enable
namespace DespatchWeb.Interfaces;

/// <summary>
/// A single email attachment: the file name shown to the recipient, its MIME
/// content type, and the raw bytes.
/// </summary>
public sealed record EmailAttachment(string FileName, string ContentType, byte[] Content);

/// <summary>
/// Sends transactional emails directly (synchronously to the caller) rather than
/// queueing them for an external processor. Abstracted so callers are testable
/// without opening a real SMTP connection.
/// </summary>
public interface IEmailSender
{
    Task SendAsync(
        string toAddress,
        string subject,
        string htmlBody,
        string? replyToAddress = null,
        EmailAttachment? attachment = null,
        CancellationToken cancellationToken = default);
}
