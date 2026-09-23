import React, {useState} from 'react';
import {SearchSelect} from '../../../components/common/search-select/SearchSelect';
import {useCourierSearch} from '../../../hooks/useCourierApi';
import {getExactCourierByCode} from '../../../services/courierApi';
import {filterCouriersForNumericSearch} from '../../job-search/lib/searchCriteria';
import type {ShowToastFn} from '../../../services/toastTypes';
import type {CourierSuggestion} from '../../../interfaces';

export interface CourierSearchFieldProps {
    onSelect: (courier: CourierSuggestion) => void;
    placeholder?: string;
    /** Used to warn when a typed code matches no courier (V1 parity). */
    showToast?: ShowToastFn;
    /** Grabs focus on mount — used when the field is revealed from a header toggle. */
    autoFocus?: boolean;
}

/**
 * Async courier search for the Current Work panel. Wraps the shared
 * `useCourierSearch` hook (which hits `courier/AllActiveSearch`, matching both
 * name and courier code) so picking a courier focuses their work — covering V1
 * `searchCourier` / `onCourierSearchSelect` and the exact-code lookup.
 *
 * `AllActiveSearch` matches codes as substrings and orders them as text, so
 * typing "78" can list "178" first. Narrowing to the exact code (the same rule
 * the job-search filters use) plus `autoHighlight` restores V1's "type the code,
 * press Enter" flow. When the search has no results at all — a code the substring
 * search missed, or Enter beaten to the punch by the debounce — Enter falls back
 * to the exact-code endpoint V1 used.
 */
export const CourierSearchField: React.FC<CourierSearchFieldProps> = ({
    onSelect,
    placeholder = 'Search courier by name or code…',
    showToast,
    autoFocus,
}) => {
    const [term, setTerm] = useState('');
    const [lookingUp, setLookingUp] = useState(false);
    // A search box, not a value picker: after a pick the field clears ready for
    // the next code (V1 parity). Remounting is how an uncontrolled-text picker
    // gets reset without inventing a "clear" prop on the shared component.
    const [resetKey, setResetKey] = useState(0);

    const {data: results = [], isFetching} = useCourierSearch(term, {minLength: 1});
    const options = filterCouriersForNumericSearch(results, term);

    const select = (courier: CourierSuggestion) => {
        onSelect(courier);
        setTerm('');
        setResetKey(k => k + 1);
    };

    // Enter is the Combobox's whenever the dropdown has something to offer —
    // `autoHighlight` means it selects the first option — so only take over when
    // the search came back empty.
    const handleKeyDown = async (event: React.KeyboardEvent) => {
        if (event.key !== 'Enter' || options.length > 0 || lookingUp) return;
        // Read the live input rather than `term`: `term` is the debounced search
        // term, and Enter routinely beats the debounce — which is exactly the case
        // this fallback exists for.
        const code = (event.target as HTMLInputElement).value?.trim() ?? '';
        if (!code) return;
        event.preventDefault();

        setLookingUp(true);
        try {
            const match = await getExactCourierByCode(code);
            if (match) select(match);
            else showToast?.(`No courier found with code: ${code}`, 'warning');
        } catch {
            // Distinct from "not found" — the code may well exist.
            showToast?.(`Could not look up courier code: ${code}`, 'error');
        } finally {
            setLookingUp(false);
        }
    };

    return (
        <div onKeyDown={handleKeyDown}>
            <SearchSelect<CourierSuggestion>
                key={resetKey}
                aria-label="Search courier"
                placeholder={placeholder}
                autoFocus={autoFocus}
                value={null}
                onChange={(courier) => {
                    if (courier) select(courier);
                }}
                options={options}
                onSearchChange={setTerm}
                loading={isFetching || lookingUp}
                autoHighlight
                getOptionKey={(courier) => courier.id}
                getOptionLabel={(courier) => courier.text}
                minSearchLength={1}
                debounceMs={0}
            />
        </div>
    );
};
