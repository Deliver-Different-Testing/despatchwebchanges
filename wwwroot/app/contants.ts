declare global {
    const FirstName: string;
    const ContactID: string;
}

const FirstName: string = (window as any).FirstName;
const ContactID: string = (window as any).ContactID;

export { FirstName, ContactID };
