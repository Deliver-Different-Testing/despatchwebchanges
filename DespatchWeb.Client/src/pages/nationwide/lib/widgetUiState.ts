/**
 * Empty-state derivation for the Nationwide flight/agent widget.
 *
 * One pure function from (selected job, load state, option lists) to the set of
 * mutually-exclusive display flags. Framework-free so the AngularJS controller
 * and the React page share it. Extracted from
 * `NationwideControl.updateUIState` (1787) and `resetAllFlags`.
 */

/** Only the job fields the derivation reads. */
export interface WidgetUiStateJob {
    isAgentJob?: boolean;
    assignedFlight?: unknown;
    assignedAgent?: unknown;
    fromAirportId?: number | null;
    toAirportId?: number | null;
}

export interface WidgetUiStateInputs {
    /** Absent counts as "not loading" — the AngularJS flag is optional. */
    flightsLoading?: boolean;
    flightOptions?: unknown[];
    agentsLoading?: boolean;
    agentOptions?: unknown[];
}

export interface WidgetUiState {
    /** True when the widget is in agent mode rather than flight mode. */
    isDeliveryJobType: boolean;

    // Flight section
    showNoJobSelectedMessage: boolean;
    showJobHasAssignedFlightMessage: boolean;
    showMissingAirportInfoMessage: boolean;
    showNoFlightsAvailableMessage: boolean;
    showFlightList: boolean;

    // Agent section
    showNoAgentJobSelectedMessage: boolean;
    showJobHasAssignedAgentMessage: boolean;
    showNoAgentsAvailableMessage: boolean;
    showAgentList: boolean;
}

/** Every flag off — the reset baseline, and the widget's loading state. */
export const emptyWidgetUiState: Omit<WidgetUiState, 'isDeliveryJobType'> = {
    showNoJobSelectedMessage: false,
    showJobHasAssignedFlightMessage: false,
    showMissingAirportInfoMessage: false,
    showNoFlightsAvailableMessage: false,
    showFlightList: false,
    showNoAgentJobSelectedMessage: false,
    showJobHasAssignedAgentMessage: false,
    showNoAgentsAvailableMessage: false,
    showAgentList: false,
};

/**
 * Which single message (if any) the widget should show.
 *
 * All flags false is meaningful, not a gap: it is the in-flight state, so the
 * widget shows its spinner without a competing empty-state message.
 *
 * `showNoAgentJobSelectedMessage` is retained for shape-compatibility with V1
 * but is unreachable — with no job, `isDeliveryJobType` is false, so the flight
 * branch always claims the no-job case.
 */
export function deriveWidgetUiState(
    job: WidgetUiStateJob | undefined,
    inputs: WidgetUiStateInputs,
): WidgetUiState {
    const isDeliveryJobType = job ? !!job.isAgentJob : false;
    const state: WidgetUiState = {...emptyWidgetUiState, isDeliveryJobType};

    if (!isDeliveryJobType) {
        if (!job) {
            state.showNoJobSelectedMessage = true;
        } else if (job.assignedFlight) {
            state.showJobHasAssignedFlightMessage = true;
        } else if (!job.toAirportId || !job.fromAirportId) {
            state.showMissingAirportInfoMessage = true;
        } else if (!inputs.flightsLoading && !inputs.flightOptions?.length) {
            state.showNoFlightsAvailableMessage = true;
        } else if (!inputs.flightsLoading && !!inputs.flightOptions?.length) {
            state.showFlightList = true;
        }
        return state;
    }

    if (!job) {
        // Unreachable: `isDeliveryJobType` is only true when a job is present,
        // so the flight branch above already claimed the no-job case. Kept to
        // mirror V1's structure (and to narrow `job` below).
        state.showNoAgentJobSelectedMessage = true;
    } else if (job.assignedAgent) {
        state.showJobHasAssignedAgentMessage = true;
    } else if (!inputs.agentsLoading && !inputs.agentOptions?.length) {
        state.showNoAgentsAvailableMessage = true;
    } else if (!inputs.agentsLoading && !!inputs.agentOptions?.length) {
        state.showAgentList = true;
    }
    return state;
}
