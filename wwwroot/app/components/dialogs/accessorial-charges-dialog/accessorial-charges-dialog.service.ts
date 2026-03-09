import { IDispatchJob, IJob } from "../../../interfaces/job.interface";
import ToastrService from "../../../services/toastr.service";
import angular from 'angular';

interface PortionJobInfo {
    jobId: number;
    label: string;
    accessorialChargeGroupId?: number;
}

// Type declaration for the React dialog on window
declare global {
    interface Window {
        ReactAccessorialChargesDialog?: {
            open: (options: {
                job: {
                    id: number;
                    accessorialChargeGroupId: number;
                    amount?: number;
                    weight?: number;
                    quantity?: number;
                    portionJobs?: PortionJobInfo[];
                };
                toastService?: {
                    showToast: (message: string, type: 'success' | 'warning' | 'error') => void;
                };
            }) => Promise<boolean>;
        };
    }
}

class AccessorialChargesDialogService implements angular.IServiceProvider {
    static $inject = [
        'toastrService',
        '$ocLazyLoad',
        '$http',
    ];

    constructor(
        private toastrService: ToastrService,
        private $ocLazyLoad: oc.ILazyLoad,
        private $http: angular.IHttpService,
    ) {
        console.log('AccessorialChargesDialogService: Service instantiated');
    }

    $get() {
        return this;
    }

    private async loadReactDialog(): Promise<void> {
        if (window.ReactAccessorialChargesDialog) {
            return;
        }

        try {
            const manifestResponse = await this.$http.get<Record<string, string>>('dist/manifest.json');
            const manifest = manifestResponse.data;
            const getAssetPath = (filename: string) => `dist/${manifest[filename] || filename}`;

            if (!(window as any).React) {
                await this.$ocLazyLoad.load(getAssetPath('vendor-react.js'));
            }

            await this.$ocLazyLoad.load({
                name: 'uDispatch.accessorialChargesDialogReact',
                files: [getAssetPath('accessorialChargesDialogReact.js')]
            });
        } catch (error) {
            console.error('[AccessorialChargesDialogService] Failed to load React dialog:', error);
            throw error;
        }
    }

    async showAccessorialChargesDialog($event: MouseEvent, job: IJob | IDispatchJob): Promise<void> {
        const groupId = job.accessorialChargeGroupId;

        // Fetch portion jobs (child Pickup/Flight/Delivery jobs) for this job
        let portionJobs: PortionJobInfo[] = [];
        try {
            const resp = await this.$http.get<PortionJobInfo[]>(`/AccessorialCharge/GetPortions?parentJobId=${job.id ?? 0}`);
            portionJobs = resp.data ?? [];
        } catch {
            // Non-fatal — continue without portions
        }

        if (!groupId && portionJobs.length === 0) {
            console.debug('[AccessorialChargesDialogService] Job has no accessorialChargeGroupId and no portion jobs — skipping.');
            return;
        }

        try {
            await this.loadReactDialog();

            if (!window.ReactAccessorialChargesDialog) {
                throw new Error('React accessorial charges dialog not loaded');
            }

            const toastService = {
                showToast: (message: string, type: 'success' | 'warning' | 'error') => {
                    switch (type) {
                        case 'success':
                            this.toastrService.showSuccessToast(message);
                            break;
                        case 'warning':
                            this.toastrService.showWarningToast(message);
                            break;
                        case 'error':
                            this.toastrService.showErrorToast(message);
                            break;
                    }
                },
            };

            await window.ReactAccessorialChargesDialog.open({
                job: {
                    id: job.id ?? 0,
                    accessorialChargeGroupId: groupId ?? 0,
                    amount: (job as any).amount,
                    weight: (job as any).weight,
                    quantity: (job as any).quantity,
                    portionJobs: portionJobs.length > 0 ? portionJobs : undefined,
                },
                toastService,
            });
        } catch (error: any) {
            if (error === undefined) {
                console.log('[AccessorialChargesDialogService] User canceled dialog.');
            } else {
                console.error('[AccessorialChargesDialogService] Error:', error);
            }
        }
    }
}

export default AccessorialChargesDialogService;
