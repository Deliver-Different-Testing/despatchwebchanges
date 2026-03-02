declare global {
    const FirstName: string;
    const ContactID: number;
    const ClientInternal: boolean;
    const serverConfig: any;
    const TimeZone: string;
}

const FirstName: string = (window as any).FirstName;
const ContactID: number = (window as any).ContactID;
const TimeZone: string = (window as any).TimeZone;

export {FirstName, ContactID, TimeZone};
