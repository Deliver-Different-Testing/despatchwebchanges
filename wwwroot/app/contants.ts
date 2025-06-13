declare global {
    const FirstName: string;
    const ContactID: number;
    const ClientInternal: boolean;
    const serverConfig: any;
    const TimeZone: string;
    const FullName: string;
}

const FirstName: string = (window as any).FirstName;
const ContactID: number = (window as any).ContactID;
const ClientInternal: boolean = (window as any).ClientInternal;
const serverConfig: any = (window as any).serverConfig;
const TimeZone: any = (window as any).TimeZone;
const FullName: any = (window as any).FullName;

export {FirstName, ContactID, ClientInternal, serverConfig, TimeZone, FullName};
