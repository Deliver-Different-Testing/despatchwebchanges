/** @jest-environment node */
/**
 * Extracted from `NationwideControl.updateUIState` (1787) + `resetAllFlags`.
 * The AngularJS controller delegates to this, so its existing
 * `nationwide.controller.ui-state.test.ts` suite is the parity check.
 */

import {deriveWidgetUiState, emptyWidgetUiState} from './widgetUiState';

const flightJob = (extra: object = {}) => ({
    id: 1,
    isAgentJob: false,
    fromAirportId: 10,
    toAirportId: 20,
    ...extra,
} as never);

const agentJob = (extra: object = {}) => ({
    id: 2,
    isAgentJob: true,
    ...extra,
} as never);

const base = {
    flightsLoading: false,
    flightOptions: [] as unknown[],
    agentsLoading: false,
    agentOptions: [] as unknown[],
};

describe('deriveWidgetUiState', () => {
    it('exposes exactly one flag at a time, with the rest reset', () => {
        const state = deriveWidgetUiState(undefined, base as never);
        const set = Object.entries(state).filter(([k, v]) => k !== 'isDeliveryJobType' && v === true);
        expect(set).toEqual([['showNoJobSelectedMessage', true]]);
    });

    describe('with no job selected', () => {
        it('shows the no-job message and is not in agent mode', () => {
            const state = deriveWidgetUiState(undefined, base as never);
            expect(state.showNoJobSelectedMessage).toBe(true);
            expect(state.isDeliveryJobType).toBe(false);
        });

        it('never shows the agent-specific no-job message', () => {
            // V1's agent branch has its own `!activeJob` arm, but it is
            // unreachable: with no job `isDeliveryJobType` is forced false, so
            // the flight branch always wins. Kept in the shape (always false)
            // so the flag set stays identical to V1's.
            const state = deriveWidgetUiState(undefined, base as never);
            expect(state.showNoAgentJobSelectedMessage).toBe(false);
        });
    });

    describe('flight jobs', () => {
        it('reports an already-assigned flight ahead of everything else', () => {
            const state = deriveWidgetUiState(flightJob({assignedFlight: {id: 5}}), base as never);
            expect(state.showJobHasAssignedFlightMessage).toBe(true);
        });

        it.each([
            ['no toAirportId', {toAirportId: undefined}],
            ['no fromAirportId', {fromAirportId: undefined}],
            ['neither airport', {toAirportId: undefined, fromAirportId: undefined}],
        ])('asks for airport info when there is %s', (_label, patch) => {
            const state = deriveWidgetUiState(flightJob(patch), base as never);
            expect(state.showMissingAirportInfoMessage).toBe(true);
        });

        it('reports no flights available once loading has finished and none came back', () => {
            const state = deriveWidgetUiState(flightJob(), {...base, flightOptions: []} as never);
            expect(state.showNoFlightsAvailableMessage).toBe(true);
        });

        it('shows the flight list when options are present', () => {
            const state = deriveWidgetUiState(flightJob(), {...base, flightOptions: [{}]} as never);
            expect(state.showFlightList).toBe(true);
        });

        it('sets no message at all while flights are loading', () => {
            // Deliberate: every flag false is the loading state, so the widget
            // can show its spinner without a competing empty-state message.
            const state = deriveWidgetUiState(flightJob(), {...base, flightsLoading: true} as never);
            expect(state.showNoFlightsAvailableMessage).toBe(false);
            expect(state.showFlightList).toBe(false);
            expect(state.showMissingAirportInfoMessage).toBe(false);
        });
    });

    describe('agent jobs', () => {
        it('enters agent mode for an agent job', () => {
            const state = deriveWidgetUiState(agentJob(), base as never);
            expect(state.isDeliveryJobType).toBe(true);
        });

        it('reports an already-assigned agent ahead of everything else', () => {
            const state = deriveWidgetUiState(agentJob({assignedAgent: {id: 3}}), base as never);
            expect(state.showJobHasAssignedAgentMessage).toBe(true);
        });

        it('reports no agents available once loading has finished and none came back', () => {
            const state = deriveWidgetUiState(agentJob(), {...base, agentOptions: []} as never);
            expect(state.showNoAgentsAvailableMessage).toBe(true);
        });

        it('shows the agent list when options are present', () => {
            const state = deriveWidgetUiState(agentJob(), {...base, agentOptions: [{}]} as never);
            expect(state.showAgentList).toBe(true);
        });

        it('sets no message at all while agents are loading', () => {
            const state = deriveWidgetUiState(agentJob(), {...base, agentsLoading: true} as never);
            expect(state.showNoAgentsAvailableMessage).toBe(false);
            expect(state.showAgentList).toBe(false);
        });

        it('never leaks a flight-side flag', () => {
            const state = deriveWidgetUiState(agentJob({assignedAgent: {id: 3}}), base as never);
            expect(state.showFlightList).toBe(false);
            expect(state.showJobHasAssignedFlightMessage).toBe(false);
            expect(state.showMissingAirportInfoMessage).toBe(false);
        });
    });

    it('emptyWidgetUiState has every flag off', () => {
        expect(Object.values(emptyWidgetUiState).every(v => v === false)).toBe(true);
    });
});
