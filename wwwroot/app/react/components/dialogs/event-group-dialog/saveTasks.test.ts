/** @jest-environment node */
/**
 * saveTasks Tests
 */

import {saveTasks} from './saveTasks';
import {addTasks} from '../../../services/tasksApi';
import {queryClient, queryKeys} from '../../../query';
import {EventGroupViewModel} from '../../../interfaces';

jest.mock('../../../services/tasksApi', () => ({
    addTasks: jest.fn(),
}));

jest.mock('../../../query', () => ({
    queryClient: {invalidateQueries: jest.fn()},
    queryKeys: {tasks: {all: ['tasks']}},
}));

const mockAddTasks = addTasks as jest.MockedFunction<typeof addTasks>;
const mockInvalidateQueries = queryClient.invalidateQueries as jest.MockedFunction<
    typeof queryClient.invalidateQueries
>;

const events = [{id: 1}, {id: 2}] as unknown as EventGroupViewModel[];

describe('saveTasks', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockAddTasks.mockResolvedValue(undefined as never);
    });

    it('adds the tasks then invalidates the task cache', async () => {
        // The dialog renders in its own React root, so nothing else refreshes an open
        // Task Dashboard or dispatch Tasks panel — without this invalidation the tasks a
        // user just created stay invisible until the next poll.
        await saveTasks(7, events);

        expect(mockAddTasks).toHaveBeenCalledWith(7, events);
        expect(mockInvalidateQueries).toHaveBeenCalledWith({queryKey: queryKeys.tasks.all});
    });

    it('does not invalidate when the save fails', async () => {
        mockAddTasks.mockRejectedValueOnce(new Error('boom'));

        await expect(saveTasks(7, events)).rejects.toThrow('boom');

        expect(mockInvalidateQueries).not.toHaveBeenCalled();
    });
});
