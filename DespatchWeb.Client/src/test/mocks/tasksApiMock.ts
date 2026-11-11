export const createTasksApiMock = () => ({
    tasksApi: {
        getAllTasks: vi.fn(),
        getActiveStaff: vi.fn(),
        getEventTypes: vi.fn(),
        getDeliveryJourney: vi.fn(),
        markTaskAsClosed: vi.fn(),
        updateTaskDate: vi.fn(),
        updateTaskTime: vi.fn(),
        reassignTaskToStaff: vi.fn(),
        unassignTask: vi.fn(),
    },
});
