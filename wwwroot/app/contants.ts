declare global {
    const FirstName: string;
    const ContactID: number;
}

const FirstName: string = (window as any).FirstName;
const ContactID: number = (window as any).ContactID;

export { FirstName, ContactID };
