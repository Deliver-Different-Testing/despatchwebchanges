import { Dayjs } from 'dayjs';

/** Airports chosen in the dialog when the airport pickers are shown. */
export interface SavedFlightAirports {
    fromAirportId: number;
    toAirportId: number;
}

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
    /**
     * When true the dialog renders From/To airport autocompletes (loaded from
     * the airport table) and the flight search runs off the operator's
     * selection. Used for recurring bookings that have no airports yet — the
     * chosen airports are returned to `onSubmit` so they can be persisted
     * alongside the flight number. When false the dialog uses the airports
     * passed in and returns no airports (the existing flight-booking path).
     */
    showAirportPickers?: boolean;
    onClose: () => void;
    /**
     * Returns the complete flight number to save (empty string clears it).
     * When the airport pickers are shown, the chosen airports are supplied so
     * the caller can persist route + flight together.
     */
    onSubmit: (flightNumber: string, airports?: SavedFlightAirports) => void | Promise<void>;
}

export interface FlightOption {
    /** Complete flight number saved/matched, e.g. "NZ123". */
    value: string;
    /** Display label, e.g. "NZ123 · AKL→WLG 08:00". */
    label: string;
}

/** Airport option for the From/To autocompletes (from GetAllActiveAirports). */
export interface AirportOption {
    id: number;
    label: string;
}
