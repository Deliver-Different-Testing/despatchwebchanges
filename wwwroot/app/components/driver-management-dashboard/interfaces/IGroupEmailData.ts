interface IGroupEmailData {
    recipients: string[];
    subject: string;
    body: string;
    ccRecipients?: string[];
    bccRecipients?: string[];
    attachments?: IEmailAttachment[];
    priority?: EmailPriority;
    isHtml?: boolean;
    templateId?: string;
    templateData?: any;
    scheduledSendTime?: Date;
    trackOpens?: boolean;
    trackClicks?: boolean;
}

interface IEmailAttachment {
    filename: string;
    content: string;
    contentType: string;
    size?: number;
}

enum EmailPriority {
    Low = 'low',
    Normal = 'normal',
    High = 'high',
    Urgent = 'urgent'
}

export default IGroupEmailData;
export { IEmailAttachment, EmailPriority };