/**
 * Job Detail Widget - Thin AngularJS bridge to React component
 *
 * Lazy-loads the React job details bundle and mounts it into a container div.
 * All business logic lives in the React component.
 */

import ToastrService from "../../../services/toastr.service";
import {IAppConfig} from "../../../interfaces/app-config.interface";
import angular from 'angular';

class JobDetailBridgeController implements angular.IController {
    static $inject = [
        'toastrService',
        'APP_CONFIG',
        '$element',
        '$scope',
        '$ocLazyLoad',
        '$http',
        '$rootScope',
    ];

    // Component bindings
    jobId?: number;
    angularId?: string;
    appPage?: string;
    isRecurringJob: boolean = false;
    isBulkJob: boolean = false;
    onStatusChange?: (args: { $event: number }) => void;
    onJobUpdate?: () => void;

    private containerId: string;
    private loadPromise: Promise<void> | null = null;
    private manifest: Record<string, string> | null = null;
    private initialized = false;
    private container: HTMLDivElement | null = null;

    constructor(
        private toastrService: ToastrService,
        private appConfig: IAppConfig,
        private $element: angular.IAugmentedJQuery,
        private $scope: angular.IScope,
        private $ocLazyLoad: oc.ILazyLoad,
        private $http: angular.IHttpService,
        private $rootScope: angular.IRootScopeService,
    ) {
        this.containerId = `react-job-details-${Math.random().toString(36).substring(2, 9)}`;
    }

    $onInit(): void {
        // Create container div inside the component element
        this.container = document.createElement('div');
        this.container.id = this.containerId;
        this.container.style.height = '100%';
        this.$element[0].appendChild(this.container);

        this.initialized = true;

        console.log('[JobDetailBridge] $onInit, jobId:', this.jobId, 'containerId:', this.containerId);

        // Always mount — the React component handles the no-job-selected state
        this.loadAndMount();
    }

    $onChanges(changes: angular.IOnChangesObject): void {
        // $onChanges fires before $onInit for initial values — skip if not ready
        if (!this.initialized) return;

        if (changes['jobId']) {
            console.log('[JobDetailBridge] $onChanges jobId:', changes['jobId'].currentValue);
            this.loadAndMount();
        }
    }

    $onDestroy(): void {
        console.log('[JobDetailBridge] $onDestroy');
        if (window.ReactJobDetails) {
            window.ReactJobDetails.unmount();
        }
    }

    private async loadAndMount(): Promise<void> {
        try {
            await this.ensureReactLoaded();
            this.mountReactComponent();
        } catch (error) {
            console.error('[JobDetailBridge] Failed to load React job details:', error);
            // Show error in the container so it's visible
            if (this.container) {
                this.container.innerHTML = `<div style="padding: 16px; color: #d32f2f;">Failed to load job details component. Check console for errors.</div>`;
            }
        }
    }

    private ensureReactLoaded(): Promise<void> {
        // If already loaded, resolve immediately
        if (window.ReactJobDetails) return Promise.resolve();

        // If currently loading, return the existing promise so callers wait
        if (this.loadPromise) return this.loadPromise;

        this.loadPromise = this.doLoad();
        return this.loadPromise;
    }

    private async doLoad(): Promise<void> {
        try {
            // Load manifest
            if (!this.manifest) {
                try {
                    const response = await this.$http.get<Record<string, string>>('dist/manifest.json');
                    this.manifest = response.data;
                } catch {
                    console.warn('[JobDetailBridge] Failed to load manifest, using fallback names');
                    this.manifest = {
                        'vendor-react.js': 'vendor-react.js',
                        'jobDetailsReact.js': 'jobDetailsReact.js',
                    };
                }
            }

            const getAssetPath = (filename: string) =>
                `dist/${this.manifest![filename] || filename}`;

            // Ensure vendor-react is loaded (may already be loaded by parent page)
            if (!window.React) {
                console.log('[JobDetailBridge] Loading vendor-react...');
                await this.$ocLazyLoad.load(getAssetPath('vendor-react.js'));
            }

            // Load the job details React module
            console.log('[JobDetailBridge] Loading jobDetailsReact...');
            await this.$ocLazyLoad.load(getAssetPath('jobDetailsReact.js'));

            console.log('[JobDetailBridge] React job details loaded, ReactJobDetails available:', !!window.ReactJobDetails);

            if (!window.ReactJobDetails) {
                throw new Error('jobDetailsReact.js loaded but window.ReactJobDetails is not available');
            }
        } catch (error) {
            // Reset so next attempt can retry
            this.loadPromise = null;
            throw error;
        }
    }

    private mountReactComponent(): void {
        if (!window.ReactJobDetails) {
            console.error('[JobDetailBridge] Cannot mount: ReactJobDetails not available');
            return;
        }

        const showToast = (message: string, type: 'success' | 'error' | 'warning' | 'info') => {
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
                case 'info':
                    this.toastrService.showInfoToast(message);
                    break;
            }
        };

        console.log('[JobDetailBridge] Mounting React job details, jobId:', this.jobId, 'container:', this.containerId);

        window.ReactJobDetails.mount(this.containerId, {
            jobId: this.jobId,
            isRecurringJob: this.isRecurringJob,
            isBulkJob: this.isBulkJob,
            isUsCustomer: this.appConfig.US_Customer,
            showToast,
            onJobUpdate: () => {
                if (this.onJobUpdate) {
                    this.onJobUpdate();
                }
            },
            onStatusChange: (statusId: number) => {
                if (this.onStatusChange) {
                    this.onStatusChange({$event: statusId});
                }
            },
            onJobReadChanged: (jobId: number, isRead: boolean) => {
                this.$rootScope.$broadcast('jobReadChanged', {jobId, hasBeenRead: isRead});
                this.$scope.$applyAsync();
            },
        });
    }
}

const JobDetailComponent: angular.IComponentOptions = {
    template: '',
    bindings: {
        jobId: "<",
        angularId: "<",
        appPage: "<",
        onStatusChange: "&",
        isRecurringJob: "<",
        isBulkJob: "<",
        onJobUpdate: "&"
    },
    controller: JobDetailBridgeController,
    controllerAs: "ctrl",
};
export default JobDetailComponent;
