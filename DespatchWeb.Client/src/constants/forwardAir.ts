export const FORWARD_AIR_CARRIER_CODE = 'FWD';
export const FORWARD_AIR_CARRIER_NAME = 'Forward Air';
export const FORWARD_AIR_DOCUMENT_TYPES = ['LABEL', 'BOL', 'DELIVER'] as const;
export type ForwardAirDocumentType = typeof FORWARD_AIR_DOCUMENT_TYPES[number];

export function forwardAirDocumentUrl(legId: number, type: ForwardAirDocumentType): string {
    return `/api/nationwide/${legId}/forwardair/documents/${type}`;
}

export function isForwardAirCarrier(code: string | undefined | null): boolean {
    return code === FORWARD_AIR_CARRIER_CODE;
}
