#nullable enable
using System.Net;
using System.Net.Mail;
using DespatchWeb.Interfaces;

namespace DespatchWeb.Services;

/// <summary>
/// SMTP implementation of <see cref="IEmailSender"/>. Mirrors the connection
/// settings used elsewhere in the app (SMTPServer / SMTPUser / SMTPPass /
/// SMTP_Port / FromAddress environment variables) and sends the message
/// synchronously, so the caller learns immediately if delivery fails.
/// </summary>
public sealed class SmtpEmailSender : IEmailSender
{
    public async Task SendAsync(
        string toAddress,
        string subject,
        string htmlBody,
        string? replyToAddress = null,
        EmailAttachment? attachment = null,
        CancellationToken cancellationToken = default)
    {
        var fromAddress = Environment.GetEnvironmentVariable("FromAddress");

        using var message = new MailMessage();
        message.From = new MailAddress(fromAddress!);
        message.Subject = subject;
        message.Body = htmlBody;
        message.IsBodyHtml = true;
        message.Priority = MailPriority.High;
        message.To.Add(toAddress);
        message.Headers.Add("Message-ID", $"<{Guid.NewGuid()}@DFRNT.com>");

        if (!string.IsNullOrEmpty(replyToAddress))
        {
            message.ReplyToList.Add(new MailAddress(replyToAddress));
        }

        using var attachmentStream = attachment is null ? null : new MemoryStream(attachment.Content);
        if (attachment is not null)
        {
            message.Attachments.Add(new Attachment(attachmentStream!, attachment.FileName, attachment.ContentType));
        }

        using var smtp = new SmtpClient();
        smtp.Host = Environment.GetEnvironmentVariable("SMTPServer")
            ?? throw new InvalidOperationException("SMTPServer environment variable is not configured.");
        smtp.UseDefaultCredentials = false;
        smtp.EnableSsl = true;
        smtp.Credentials = new NetworkCredential(
            Environment.GetEnvironmentVariable("SMTPUser"),
            Environment.GetEnvironmentVariable("SMTPPass"));
        smtp.Port = int.TryParse(Environment.GetEnvironmentVariable("SMTP_Port"), out var port) ? port : 587;

        await smtp.SendMailAsync(message, cancellationToken);
    }
}
