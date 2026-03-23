/**
 * Angular Dialog Bridge
 *
 * Provides functions to open AngularJS $mdDialog-based dialogs from React code.
 * Uses the AngularJS injector to access registered dialog services.
 */

declare const angular: any;

function getAngularInjector(): any {
    const injector = angular?.element(document.body).injector();
    if (!injector) throw new Error('AngularJS injector not available');
    return injector;
}

/**
 * Open the Inter-Courier Charge dialog (AngularJS).
 */
export async function openInterCourierChargeDialog(): Promise<void> {
    const injector = getAngularInjector();
    const service = injector.get('interCourierChargeDialogService');
    await service.showInterCourierCharge(null);
}

/**
 * Open the Job File Upload dialog (AngularJS).
 */
export async function openJobFileUploadDialog(jobId: number): Promise<void> {
    const injector = getAngularInjector();
    const service = injector.get('jobFileUploadDialogService');
    await service.openJobFileUploadDialog(null, {id: jobId});
}
