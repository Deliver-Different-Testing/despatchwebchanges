import {useCallback} from 'react';
import {loadDialog, requireDialog, type DialogLoader} from '../dialogs/dialogRegistry';
import {AddressType} from '../../enums/address-type.enum';
import {getSession} from '../session';
import {toastService} from '../services/toastService';
import {
    addStopToJob,
    blankAddress,
    hasBothAddresses,
    stopKindForJob,
    type AddStopJob,
    type AddStopJobWithNumber,
} from '../services/jobAddStop';

export interface UseAddStopFlowOptions {
    openDialog?: DialogLoader;
}

export interface UseAddStopFlow {
    addRecurringJobStop: (job: AddStopJob, isPickup: boolean) => Promise<number | undefined>;
    /** Suffix-driven variant (pickup/delivery chosen from the job number). */
    addNewStop: (job: AddStopJobWithNumber) => Promise<number | undefined>;
}

export function useAddStopFlow({openDialog = loadDialog}: UseAddStopFlowOptions = {}): UseAddStopFlow {
    const addStop = useCallback(async (job: AddStopJob, isPickup: boolean) => {
        if (!hasBothAddresses(job)) return undefined;
        const dialog = await requireDialog('EditAddress', openDialog);
        if (!dialog) return undefined;

        try {
            const address = await dialog.open(
                blankAddress(),
                isPickup ? 'Add Pick Up Stop' : 'Add Delivery Stop',
                'Add Stop',
                true,
                getSession().isUsCustomer,
                toastService,
                isPickup ? AddressType.Pickup : AddressType.Delivery,
            );
            if (!address) return undefined;

            return isPickup
                ? await addStopToJob(job.id, address, undefined)
                : await addStopToJob(job.id, undefined, address);
        } catch (err) {
            console.error('[addStop] failed', err);
            toastService.showErrorToast('Could not add the stop. Please try again.');
            return undefined;
        }
    }, [openDialog]);

    const addRecurringJobStop = useCallback(
        (job: AddStopJob, isPickup: boolean) => addStop(job, isPickup), [addStop]);

    const addNewStop = useCallback(async (job: AddStopJobWithNumber) => {
        const kind = stopKindForJob(job.jobNo);
        return kind ? addStop(job, kind === 'pickup') : undefined;
    }, [addStop]);

    return {addRecurringJobStop, addNewStop};
}
