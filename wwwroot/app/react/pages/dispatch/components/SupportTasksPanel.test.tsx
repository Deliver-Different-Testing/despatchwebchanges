/** @jest-environment jest-environment-jsdom */
/**
 * SupportTasksPanel Component Tests
 */

import React from 'react';
import {screen} from '@testing-library/react';
import {renderWithTheme} from '../../../__testUtils__';
import {createMockTask, createMockTaskAssignee} from '../../../__testUtils__/mockData';
import {SupportTasksPanel} from './SupportTasksPanel';
import type {Task} from '../../../interfaces';

const openTask = createMockTask({
    id: 1,
    title: 'Follow up with customer',
    description: 'Call the customer back',
    closed: false,
    assignee: createMockTaskAssignee({id: 10, text: 'Alice Smith'}),
});

const closedTask = createMockTask({
    id: 2,
    title: 'Check delivery status',
    description: 'Verify package arrived',
    closed: true,
    assignee: null as unknown as Task['assignee'],
});

describe('SupportTasksPanel', () => {
    it('shows placeholder when no job selected, spinner when loading, and empty message when no tasks', () => {
        const {unmount} = renderWithTheme(
            <SupportTasksPanel tasks={[]} loading={false} jobId={null} />
        );
        expect(screen.getByText('Select a job to view support tasks')).toBeInTheDocument();
        unmount();

        const {unmount: unmount2} = renderWithTheme(
            <SupportTasksPanel tasks={[]} loading={true} jobId={1} />
        );
        expect(screen.getByRole('progressbar')).toBeInTheDocument();
        unmount2();

        renderWithTheme(
            <SupportTasksPanel tasks={[]} loading={false} jobId={1} />
        );
        expect(screen.getByText('No support tasks for this job')).toBeInTheDocument();
    });

    it('renders tasks using TaskItem component with titles and status chips', () => {
        renderWithTheme(
            <SupportTasksPanel tasks={[openTask, closedTask]} loading={false} jobId={1} />
        );

        // TaskItem renders task titles
        expect(screen.getByText('Follow up with customer')).toBeInTheDocument();
        expect(screen.getByText('Check delivery status')).toBeInTheDocument();

        // TaskItem renders status chips — open tasks show "To do", closed show "Done"
        expect(screen.getByText('To do')).toBeInTheDocument();
        expect(screen.getByText('Done')).toBeInTheDocument();
    });

    it('renders assignee via TaskItem assignee button', () => {
        renderWithTheme(
            <SupportTasksPanel tasks={[openTask]} loading={false} jobId={1} />
        );

        expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    });

    it('renders checkboxes for task completion', () => {
        renderWithTheme(
            <SupportTasksPanel tasks={[openTask, closedTask]} loading={false} jobId={1} />
        );

        const checkboxes = screen.getAllByRole('checkbox');
        expect(checkboxes).toHaveLength(2);
        expect(checkboxes[0]).not.toBeChecked();
        expect(checkboxes[1]).toBeChecked();
    });
});
