declare global {
    const FirstName: string;
    const ContactID: number;
    const ClientInternal: boolean;
    const serverConfig: any;
}

const FirstName: string = (window as any).FirstName;
const ContactID: number = (window as any).ContactID;
const ClientInternal: boolean = (window as any).ClientInternal;
const serverConfig: any = (window as any).serverConfig;

export {FirstName, ContactID, ClientInternal, serverConfig};
