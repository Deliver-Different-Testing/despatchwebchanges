import {toastService} from '../services/toastService';
import type {ShowToastFn} from '../services/toastTypes';
import type {ShowToastFn as OverviewShowToastFn} from './overview/OverviewPage.interfaces';

export const showPageToast: ShowToastFn = (message, type, action) => toastService.showToast(message, type, action);

export const overviewToast: OverviewShowToastFn = {
    showSuccessToast: (m) => toastService.showSuccessToast(m),
    showWarningToast: (m) => toastService.showWarningToast(m),
    showErrorToast: (m) => toastService.showErrorToast(m ?? 'Something went wrong'),
    showInfoToast: (m) => toastService.showInfoToast(m),
};
