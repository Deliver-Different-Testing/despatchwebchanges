declare global {
    const FirstName: string;
    const ContactID: number;
    const ClientInternal: string;
}

const FirstName: string = (window as any).FirstName;
const ContactID: number = (window as any).ContactID;
const ClientInternal: string = (window as any).ClientInternal;

export { FirstName, ContactID, ClientInternal };
