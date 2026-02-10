/**
 * Task API Handlers
 *
 * MSW handlers for task-related API endpoints.
 */

import { http, HttpResponse } from 'msw';
import type { TaskApiResponse, StaffSuggestion, EventTypeSuggestion } from '../../../interfaces';
import type { DeliveryJourneyDto } from '../../../components/common/task-history/TaskHistory.interfaces';

// Mock data
export const mockTaskApiResponses: TaskApiResponse[] = [
    {
        id: 1,
        title: 'Follow up with client',
        description: 'Call client about delivery delay',
        dueDate: '2024-01-20T10:00:00+00:00',
        closed: false,
        assignee: { id: 10, text: 'John Smith' },
        jobId: 100,
        eventType: 'Follow Up',
        jobNumber: 'JOB-001',
        priority: 'high',
    },
    {
        id: 2,
        title: 'Check courier availability',
        description: 'Verify courier schedule for next week',
        dueDate: '2024-01-21T14:00:00+00:00',
        closed: false,
        assignee: { id: 20, text: 'Jane Doe' },
        jobId: 200,
        eventType: 'Reminder',
        jobNumber: 'JOB-002',
    },
    {
        id: 3,
        title: 'Completed task',
        description: 'Already done',
        dueDate: '2024-01-19T09:00:00+00:00',
        closed: true,
        assignee: { id: 10, text: 'John Smith' },
        jobId: 100,
        eventType: 'Follow Up',
        jobNumber: 'JOB-001',
    },
];

export const mockStaffSuggestions: StaffSuggestion[] = [
    { id: 10, text: 'John Smith' },
    { id: 20, text: 'Jane Doe' },
    { id: 30, text: 'Bob Wilson' },
];

export const mockEventTypeSuggestions: EventTypeSuggestion[] = [
    { id: 1, text: 'Follow Up' },
    { id: 2, text: 'Reminder' },
    { id: 3, text: 'Complaint' },
];

export const mockDeliveryJourneyDtos: DeliveryJourneyDto[] = [
    {
        id: 'dj-1',
        jobId: 100,
        title: 'Job Created',
        icon: 'create',
        description: 'Job was created by dispatch',
        date: '2024-01-15T08:00:00+00:00',
        tags: ['dispatch'],
        status: 'completed',
        notes: '',
    },
    {
        id: 'dj-2',
        jobId: 100,
        title: 'Courier Assigned',
        icon: 'person',
        description: 'Assigned to John Smith',
        date: '2024-01-15T08:30:00+00:00',
        tags: ['courier', 'assigned'],
        status: 'completed',
        notes: 'Express delivery',
    },
    {
        id: 'dj-3',
        jobId: 100,
        title: 'In Transit',
        icon: 'local_shipping',
        description: 'Package is in transit',
        date: '2024-01-15T09:00:00+00:00',
        tags: ['transit'],
        status: 'current',
        notes: '',
    },
];

export const taskHandlers = [
    // Get all tasks with optional filters
    http.get('*/task/GetAllTasks', ({ request }) => {
        const url = new URL(request.url);
        const showCompleted = url.searchParams.get('showCompleted');
        const staffId = url.searchParams.get('staffId');
        const jobId = url.searchParams.get('jobId');

        let results = [...mockTaskApiResponses];

        if (showCompleted === 'false') {
            results = results.filter(t => !t.closed);
        }

        if (staffId) {
            results = results.filter(t => t.assignee.id === Number(staffId));
        }

        if (jobId) {
            results = results.filter(t => t.jobId === Number(jobId));
        }

        return HttpResponse.json(results);
    }),

    // Mark task as closed/reopened
    http.post('*/task/MarkTaskAsClosed', async ({ request }) => {
        if (request.headers.get('X-Requested-With') !== 'XMLHttpRequest') {
            return new HttpResponse('Missing CSRF header', { status: 400 });
        }

        const body = await request.json();
        if (!body || typeof body !== 'object') {
            return new HttpResponse('Invalid request body', { status: 400 });
        }

        const { eventId, closed } = body as { eventId?: number; closed?: boolean };
        if (typeof eventId !== 'number' || typeof closed !== 'boolean') {
            return new HttpResponse('Invalid parameters', { status: 400 });
        }

        return new HttpResponse(null, { status: 200 });
    }),

    // Update task date
    http.post('*/task/UpdateTaskDate', async ({ request }) => {
        if (request.headers.get('X-Requested-With') !== 'XMLHttpRequest') {
            return new HttpResponse('Missing CSRF header', { status: 400 });
        }

        const body = await request.json();
        if (!body || typeof body !== 'object') {
            return new HttpResponse('Invalid request body', { status: 400 });
        }

        const { eventId, date } = body as { eventId?: number; date?: string };
        if (typeof eventId !== 'number' || typeof date !== 'string') {
            return new HttpResponse('Invalid parameters', { status: 400 });
        }

        return new HttpResponse(null, { status: 200 });
    }),

    // Update task time
    http.post('*/task/UpdateTaskTime', async ({ request }) => {
        if (request.headers.get('X-Requested-With') !== 'XMLHttpRequest') {
            return new HttpResponse('Missing CSRF header', { status: 400 });
        }

        const body = await request.json();
        if (!body || typeof body !== 'object') {
            return new HttpResponse('Invalid request body', { status: 400 });
        }

        const { eventId, time } = body as { eventId?: number; time?: string };
        if (typeof eventId !== 'number' || typeof time !== 'string') {
            return new HttpResponse('Invalid parameters', { status: 400 });
        }

        return new HttpResponse(null, { status: 200 });
    }),

    // Reassign task to staff
    http.post('*/task/ReassignTask', async ({ request }) => {
        if (request.headers.get('X-Requested-With') !== 'XMLHttpRequest') {
            return new HttpResponse('Missing CSRF header', { status: 400 });
        }

        const body = await request.json();
        if (!body || typeof body !== 'object') {
            return new HttpResponse('Invalid request body', { status: 400 });
        }

        const { eventId, staffId } = body as { eventId?: number; staffId?: number };
        if (typeof eventId !== 'number' || typeof staffId !== 'number') {
            return new HttpResponse('Invalid parameters', { status: 400 });
        }

        return new HttpResponse(null, { status: 200 });
    }),

    // Get active staff list
    http.get('*/task/GetStaff', () => {
        return HttpResponse.json(mockStaffSuggestions);
    }),

    // Get event type list
    http.get('*/job/EventTypeList', () => {
        return HttpResponse.json(mockEventTypeSuggestions);
    }),

    // Get delivery journey for a job
    http.get('*/job/GetDeliveryJourney', ({ request }) => {
        const url = new URL(request.url);
        const jobId = url.searchParams.get('jobId');

        if (!jobId) {
            return new HttpResponse('Missing jobId parameter', { status: 400 });
        }

        return HttpResponse.json(mockDeliveryJourneyDtos);
    }),
];
