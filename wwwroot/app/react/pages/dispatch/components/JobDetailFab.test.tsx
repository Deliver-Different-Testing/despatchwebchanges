/** @jest-environment jest-environment-jsdom */

import React from 'react';
import {screen, fireEvent} from '@testing-library/react';
import {renderWithTheme} from '../../../__testUtils__';
import {JobDetailFab} from './JobDetailFab';
import type {JobDetailFabProps} from './JobDetailFab';
import type {DispatchJob} from '../../../interfaces/dispatchJob';
import dayjs from 'dayjs';

function createDispatchJob(overrides?: Partial<DispatchJob>): DispatchJob {
    return {
        angularId: 'job-1',
        selected: false,
        showCourierSearch: false,
        id: 1,
        jobNo: 'JOB-001',
        hasBeenRead: true,
        parentId: 0,
        isFlightJob: false,
        isAgentJob: false,
        isBulkJob: false,
        isArchived: false,
        courierSearchLoading: false,
        booked: dayjs(),
        preBook: false,
        ...overrides,
    } as DispatchJob;
}

function renderFab(overrides?: Partial<JobDetailFabProps>) {
    const defaultProps: JobDetailFabProps = {
        job: createDispatchJob(),
        onAttachments: jest.fn(),
        onAddTask: jest.fn(),
        onCloseTask: jest.fn(),
        onLockUnlock: jest.fn(),
        ...overrides,
    };
    return renderWithTheme(<JobDetailFab {...defaultProps} />);
}

function openFab() {
    // The outermost Box wraps the FAB container - fire mouseEnter on it
    const trigger = screen.getByRole('button', {name: 'Job detail options'});
    // The container Box is the parent that has onMouseEnter
    const container = trigger.closest('div')!;
    fireEvent.mouseEnter(container);
}

function getActionButton(name: string) {
    return screen.getByRole('button', {name});
}

function queryActionButton(name: string) {
    return screen.queryByRole('button', {name});
}

describe('JobDetailFab', () => {
    it('renders the trigger FAB button', () => {
        renderFab();
        expect(screen.getByRole('button', {name: 'Job detail options'})).toBeInTheDocument();
    });

    it('shows Attachments action on hover when onAttachments provided', () => {
        renderFab();
        openFab();
        expect(getActionButton('Attachments')).toBeInTheDocument();
    });

    it('shows Add Task action on hover when onAddTask provided', () => {
        renderFab();
        openFab();
        expect(getActionButton('Add Task')).toBeInTheDocument();
    });

    it('shows Add Stop only for agent jobs', () => {
        renderFab({
            job: createDispatchJob({isAgentJob: true}),
            onAddStop: jest.fn(),
        });
        openFab();
        expect(getActionButton('Add Stop')).toBeInTheDocument();
    });

    it('does not show Add Stop for non-agent jobs', () => {
        renderFab({
            job: createDispatchJob({isAgentJob: false}),
            onAddStop: jest.fn(),
        });
        openFab();
        expect(queryActionButton('Add Stop')).not.toBeInTheDocument();
    });

    it('shows Accessorial Charges when job has accessorialChargeGroupId', () => {
        renderFab({
            job: createDispatchJob({accessorialChargeGroupId: 5}),
            onAccessorialCharges: jest.fn(),
        });
        openFab();
        expect(getActionButton('Accessorial Charges')).toBeInTheDocument();
    });

    it('shows Lock Job when job is not locked and not invoiced', () => {
        renderFab({job: createDispatchJob({locked: false, invoiced: false})});
        openFab();
        expect(getActionButton('Lock Job')).toBeInTheDocument();
    });

    it('shows Unlock Job when job is locked', () => {
        renderFab({job: createDispatchJob({locked: true, invoiced: false})});
        openFab();
        expect(getActionButton('Unlock Job')).toBeInTheDocument();
    });

    it('does not show Lock/Unlock when job is invoiced', () => {
        renderFab({job: createDispatchJob({invoiced: true})});
        openFab();
        expect(queryActionButton('Lock Job')).not.toBeInTheDocument();
        expect(queryActionButton('Unlock Job')).not.toBeInTheDocument();
    });

    it('shows Split Job when allowSplit is true', () => {
        renderFab({
            job: createDispatchJob({allowSplit: true}),
            onSplitJob: jest.fn(),
        });
        openFab();
        expect(getActionButton('Split Job')).toBeInTheDocument();
    });

    it('shows Swap POD when job is done, not bulk, and not prebook', () => {
        renderFab({
            job: createDispatchJob({done: true, isBulkJob: false, preBook: false}),
            onSwapPod: jest.fn(),
        });
        openFab();
        expect(getActionButton('Swap POD')).toBeInTheDocument();
    });

    it('does not show Swap POD when job is not done', () => {
        renderFab({
            job: createDispatchJob({done: false}),
            onSwapPod: jest.fn(),
        });
        openFab();
        expect(queryActionButton('Swap POD')).not.toBeInTheDocument();
    });

    it('calls the correct handler when an action is clicked', () => {
        const onAttachments = jest.fn();
        renderFab({onAttachments});
        openFab();
        fireEvent.click(getActionButton('Attachments'));
        expect(onAttachments).toHaveBeenCalledTimes(1);
    });

    it('disables Close Task when hasOpenTask is false', () => {
        renderFab({hasOpenTask: false});
        openFab();
        expect(getActionButton('Close Task')).toBeDisabled();
    });
});
