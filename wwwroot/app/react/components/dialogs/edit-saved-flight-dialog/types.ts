import { Dayjs } from 'dayjs';

export interface EditSavedFlightDialogProps {
    open: boolean;
    /** Recurring booking id — passed to the search endpoint for logging. */
    bookingId: number;
    fromAirportId?: number;
    toAirportId?: number;
    /** Currently saved flight number (e.g. "NZ123"); empty when none. */
    currentValue?: string;
    /** Representative date to search the route on (defaults to next-due). */
    departureDate?: Dayjs;
    onClose: () => void;
    /** Returns the complete flight number to save; empty string clears it. */
    onSubmit: (flightNumber: string) => void | Promise<void>;
}

export interface FlightOption {
    /** Complete flight number saved/matched, e.g. "NZ123". */
    value: string;
    /** Display label, e.g. "NZ123 · AKL→WLG 08:00". */
    label: string;
}
