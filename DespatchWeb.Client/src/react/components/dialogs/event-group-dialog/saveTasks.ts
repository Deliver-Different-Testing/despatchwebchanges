import {addTasks} from '../../../services/tasksApi';
import {queryClient, queryKeys} from '../../../query';
import {EventGroupViewModel} from '../../../interfaces';

/**
 * Persist the dialog's tasks and refresh every cached task list.
 *
 * The dialog mounts its own React root, so its save handler sits outside the
 * component tree and cannot use `useQueryClient` — but `queryClient` is the same
 * shared singleton the providers use, so invalidating here still reaches an open
 * Task Dashboard or dispatch Tasks panel.
 */
export async function saveTasks(jobId: number, events: EventGroupViewModel[]): Promise<void> {
    await addTasks(jobId, events);
    await queryClient.invalidateQueries({queryKey: queryKeys.tasks.all});
}
