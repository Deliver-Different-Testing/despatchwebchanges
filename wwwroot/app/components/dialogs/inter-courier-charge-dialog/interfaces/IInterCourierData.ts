interface IInterCourierData {
    fromCourierId: number;
    toCourierId: number;
    clientId: number;
    reference: string;
    zones: number;
    amount: number;
}

export default IInterCourierData;