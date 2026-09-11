import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import type {Dayjs} from 'dayjs';
import type {DispatchJob} from '../../../interfaces/dispatchJob';
import type {Agent} from '../../../interfaces/agent';
import type {
    AirlineSuggestion,
    AirportSuggestion,
    FlightViewModel,
} from '../../../interfaces/nationwideJobs';
import {nationwideApi} from '../../../services/nationwideApi';
import {formatDateForApiWithTzs} from '../../../utils/dateUtils';
import {filterFlights} from '../lib/flightFormatting';
import {deriveWidgetUiState} from '../lib/widgetUiState';
import {
    MINIMUM_LAYOVER_MINUTES,
    flightResultMessage,
    flightSearchErrorMessage,
    flightSearchGuard,
    nextDayDeparture,
    resolveDepartureDate,
} from '../lib/flightSearch';

export interface UseFlightAgentWidgetOptions {
    /**
     * The job the widget is showing. Distinct from the page's selected job:
     * switching the related-job tab retargets the widget without changing the
     * page selection (V1 `flightAgentWidgetJob`).
     */
    job?: DispatchJob;
    /** Page timezone, the last resort for the search start date. */
    timeZone: string;
    onWarning: (message: string) => void;
}

/**
 * Flight and agent state for the Nationwide widget.
 *
 * Owns the IO; every decision — may a search run, which date it starts from,
 * what the operator is told, which empty state shows — comes from the shared
 * `lib/flightSearch` and `lib/widgetUiState` modules that the AngularJS
 * controller also uses.
 */
export function useFlightAgentWidget({job, timeZone, onWarning}: UseFlightAgentWidgetOptions) {
    const [flightOptions, setFlightOptions] = useState<FlightViewModel[]>([]);
    const [flightMessage, setFlightMessage] = useState<string | undefined>();
    const [flightsLoading, setFlightsLoading] = useState(false);
    const [flightSearchText, setFlightSearchText] = useState('');

    const [agentOptions, setAgentOptions] = useState<Agent[]>([]);
    const [agentMessage, setAgentMessage] = useState<string | undefined>();
    const [agentsLoading, setAgentsLoading] = useState(false);

    const [activeAirlineOptions, setActiveAirlineOptions] = useState<AirlineSuggestion[]>([]);
    const [selectedAirline, setSelectedAirline] = useState<AirlineSuggestion | undefined>();
    const [includeNearbyAirports, setIncludeNearbyAirports] = useState(false);

    const [outboundAirportOptions, setOutboundAirportOptions] = useState<AirportSuggestion[]>([]);
    const [inboundAirportOptions, setInboundAirportOptions] = useState<AirportSuggestion[]>([]);
    const [selectedOutboundAirport, setSelectedOutboundAirport] = useState<AirportSuggestion | undefined>();
    const [selectedInboundAirport, setSelectedInboundAirport] = useState<AirportSuggestion | undefined>();

    /** Paging cursor from the previous search; drives "next day". */
    const lastDepartureTimeRef = useRef<Dayjs | undefined>(undefined);
    /** Guards re-entrancy without waiting for a state flush. */
    const searchingRef = useRef(false);
    /** Ignores results for a job the operator has already navigated away from. */
    const jobIdRef = useRef<number | undefined>(job?.id);
    jobIdRef.current = job?.id;

    const isAgentJob = !!job?.isAgentJob;

    // Airlines are tenant-wide, so they load once rather than per job.
    useEffect(() => {
        let cancelled = false;
        nationwideApi.getActiveAirlines()
            .then(airlines => { if (!cancelled) setActiveAirlineOptions(airlines); })
            .catch(() => { /* the filter simply stays empty */ });
        return () => { cancelled = true; };
    }, []);

    const runFlightSearch = useCallback(async () => {
        const guard = flightSearchGuard({
            job,
            airports: {outbound: selectedOutboundAirport, inbound: selectedInboundAirport},
            loading: searchingRef.current,
        });

        if (guard.action === 'skip') return;

        if (guard.action === 'block') {
            setFlightOptions([]);
            setFlightMessage(guard.message);
            return;
        }

        const jobId = job!.id;
        searchingRef.current = true;
        setFlightsLoading(true);

        try {
            const departureDate = resolveDepartureDate({
                lastDepartureTime: lastDepartureTimeRef.current,
                booked: job!.booked,
                jobTimeZone: job!.pickUpTimeZone?.text,
                pageTimeZone: timeZone,
            });

            const result = await nationwideApi.getScheduledFlightOptions({
                jobId,
                departureDate: formatDateForApiWithTzs(departureDate),
                airlineId: selectedAirline?.id,
                departureAirportId: selectedOutboundAirport?.id,
                arrivalAirportId: selectedInboundAirport?.id,
                minimumLayoverMinutes: MINIMUM_LAYOVER_MINUTES,
                includeNearbyAirports,
            });

            if (jobIdRef.current !== jobId) return;

            setFlightOptions(result.flights ?? []);
            setFlightMessage(flightResultMessage(result));
            lastDepartureTimeRef.current = result.lastDepartureTime;
        } catch (error) {
            if (jobIdRef.current !== jobId) return;
            console.error('Error loading flights:', error);
            setFlightMessage(flightSearchErrorMessage(error));
            setFlightOptions([]);
        } finally {
            searchingRef.current = false;
            setFlightsLoading(false);
        }
    }, [job, selectedAirline, selectedOutboundAirport, selectedInboundAirport, includeNearbyAirports, timeZone]);

    const loadAgents = useCallback(async () => {
        if (!job) return;

        const jobId = job.id;
        setAgentsLoading(true);
        setAgentOptions([]);

        try {
            const agents = await nationwideApi.getAgentsForJob(jobId);
            if (jobIdRef.current !== jobId) return;

            setAgentOptions(agents);
            setAgentMessage(agents.length === 0
                ? "Sorry, we couldn't find any agents that applied to this specific job. "
                  + 'Please check the job information is correct and try again.'
                : undefined);
        } catch (error) {
            if (jobIdRef.current !== jobId) return;
            console.error('Error loading agents:', error);
            setAgentMessage('Could not load agents for this job. Please try again.');
        } finally {
            setAgentsLoading(false);
        }
    }, [job]);

    /*
     * Re-seed for a newly targeted job (V1 `handleJobSelectionRelatedData`):
     * reset the search, load the nearby airports for both ends and default the
     * selectors from the job, or load agents for an agent job.
     */
    useEffect(() => {
        let cancelled = false;

        setFlightOptions([]);
        setFlightMessage(undefined);
        setFlightSearchText('');
        lastDepartureTimeRef.current = undefined;
        setSelectedOutboundAirport(undefined);
        setSelectedInboundAirport(undefined);
        setOutboundAirportOptions([]);
        setInboundAirportOptions([]);

        if (!job) return;

        if (isAgentJob) {
            if (!job.assignedAgent) {
                void loadAgents();
            } else {
                setAgentOptions([]);
                setAgentMessage('Agent already assigned to this job');
            }
            return () => { cancelled = true; };
        }

        if (job.assignedFlight) {
            setFlightMessage('Flight already assigned to this job');
            return () => { cancelled = true; };
        }

        void (async () => {
            const [outbound, inbound] = await Promise.all([
                nationwideApi.getNearbyAirports(job.id, true).catch(() => []),
                nationwideApi.getNearbyAirports(job.id, false).catch(() => []),
            ]);
            if (cancelled) return;

            setOutboundAirportOptions(outbound);
            setInboundAirportOptions(inbound);
            setSelectedOutboundAirport(outbound.find(a => a.id === job.fromAirportId));
            setSelectedInboundAirport(inbound.find(a => a.id === job.toAirportId));
        })();

        return () => { cancelled = true; };
    // `loadAgents` is keyed on the same job; re-running on its identity would double-fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [job?.id, isAgentJob, job?.assignedFlight, job?.assignedAgent]);

    /*
     * Once both airports resolve, search. Kept separate from the seeding effect
     * so a manual airport change re-runs the search without re-fetching the
     * airport lists.
     */
    useEffect(() => {
        if (!job || isAgentJob || job.assignedFlight) return;
        if (!selectedOutboundAirport || !selectedInboundAirport) return;
        void runFlightSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [job?.id, selectedOutboundAirport?.id, selectedInboundAirport?.id, selectedAirline?.id, includeNearbyAirports]);

    const filteredFlightOptions = useMemo(
        () => filterFlights(flightOptions, flightSearchText),
        [flightOptions, flightSearchText],
    );

    const uiState = useMemo(() => deriveWidgetUiState(job, {
        flightsLoading,
        flightOptions,
        agentsLoading,
        agentOptions,
    }), [job, flightsLoading, flightOptions, agentsLoading, agentOptions]);

    /** "Next day": advance the cursor a day, snap to midnight, search again. */
    const loadNextDayFlights = useCallback(() => {
        if (!job) {
            onWarning('Please select a job to view flight options');
            return;
        }
        lastDepartureTimeRef.current = nextDayDeparture(lastDepartureTimeRef.current, job.booked);
        void runFlightSearch();
    }, [job, onWarning, runFlightSearch]);

    /** Changing the airline or an airport restarts paging from the beginning. */
    const resetPagingAnd = useCallback((apply: () => void) => {
        lastDepartureTimeRef.current = undefined;
        apply();
    }, []);

    return {
        // Flight state
        flightOptions,
        filteredFlightOptions,
        flightMessage,
        flightsLoading,
        flightSearchText,

        // Agent state
        agentOptions,
        agentMessage,
        agentsLoading,

        // Filters and selectors
        activeAirlineOptions,
        selectedAirline,
        includeNearbyAirports,
        outboundAirportOptions,
        inboundAirportOptions,
        selectedOutboundAirport,
        selectedInboundAirport,

        // Derived empty/loading states
        uiState,

        // Actions
        onFlightSearchChange: setFlightSearchText,
        onFilterFlightsByAirline: (airline: AirlineSuggestion | null) =>
            resetPagingAnd(() => setSelectedAirline(airline ?? undefined)),
        onToggleNearbyAirports: (value: boolean) =>
            resetPagingAnd(() => setIncludeNearbyAirports(value)),
        onOutboundAirportChange: (airport: AirportSuggestion | null) =>
            resetPagingAnd(() => setSelectedOutboundAirport(airport ?? undefined)),
        onInboundAirportChange: (airport: AirportSuggestion | null) =>
            resetPagingAnd(() => setSelectedInboundAirport(airport ?? undefined)),
        loadMoreFlights: runFlightSearch,
        loadNextDayFlights,
        reloadAgents: loadAgents,
    };
}
