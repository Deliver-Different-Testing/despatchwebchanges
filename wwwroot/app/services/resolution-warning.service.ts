class ResolutionWarningService implements angular.IServiceProvider {
    static $inject = [
        '$mdDialog',
        '$window'
    ];

    private readonly STORAGE_KEY = `resolution-warning-shown_${ContactID}`;
    private readonly MIN_WIDTH = 1920;
    private readonly MIN_HEIGHT = 1200;

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private $window: angular.IWindowService) {
        console.log('ResolutionWarningService: Service instantiated');
    }

    $get() {
        return this;
    }

    checkAndShowResolutionWarning(): void {
        // Check if a warning has already been shown
        if (localStorage.getItem(this.STORAGE_KEY)) {
            return;
        }

        // Check screen resolution
        const screenWidth = this.$window.screen.width;
        const screenHeight = this.$window.screen.height;

        if (screenWidth < this.MIN_WIDTH || screenHeight < this.MIN_HEIGHT) {
            this.showResolutionWarning();
        } else {
            // Mark as shown even if not displayed, so it doesn't check again
            localStorage.setItem(this.STORAGE_KEY, 'true');
        }
    }

    private showResolutionWarning(): void {
        this.$mdDialog.show({
            template: `
            <md-dialog class="resolution-warning-dialog" aria-label="Display Resolution Warning">
                <md-dialog-content class="md-dialog-content">
                    <div class="dialog-header">
                        <md-icon md-font-set="material-symbols-outlined" class="warning-icon">warning</md-icon>
                        <h2 class="md-title">Display Resolution Notice</h2>
                    </div>
                    
                    <div class="dialog-body">
                        <p class="md-body-1">This application is optimized for higher resolution displays (minimum ${this.MIN_WIDTH}x${this.MIN_HEIGHT}).</p>
                        
                        <div class="current-resolution">
                            <md-icon md-font-set="material-symbols-outlined" class="info-icon">info</md-icon>
                            <span class="md-body-2">Current resolution: ${this.$window.screen.width}x${this.$window.screen.height}</span>
                        </div>
                        
                        <div class="recommendations">
                            <p class="md-body-1 recommendations-title">For the best experience, please consider:</p>
                            <div class="recommendation-item" layout="row" layout-align="start center">
                                <md-icon md-font-set="material-symbols-outlined" class="recommendation-icon">monitor</md-icon>
                                <span class="md-body-2">Using a higher resolution display</span>
                            </div>
                            <div class="recommendation-item" layout="row" layout-align="start center">
                                <md-icon md-font-set="material-symbols-outlined" class="recommendation-icon">zoom_out</md-icon>
                                <span class="md-body-2">Zooming out your browser (Ctrl + Mouse Wheel or Ctrl + -)</span>
                            </div>
                            <div class="recommendation-item" layout="row" layout-align="start center">
                                <md-icon md-font-set="material-symbols-outlined" class="recommendation-icon">fullscreen</md-icon>
                                <span class="md-body-2">Maximizing your browser window</span>
                            </div>
                        </div>
                    </div>
                </md-dialog-content>
                
                <md-dialog-actions layout="row" layout-align="end center">
                    <md-button ng-click="ctrl.dismiss()" class="md-primary">
                        Don't show again
                    </md-button>
                    <md-button ng-click="ctrl.close()" class="md-primary md-raised">
                        Got it
                    </md-button>
                </md-dialog-actions>
            </md-dialog>
            
            <style>
                .resolution-warning-dialog {
                    max-width: 480px;
                    min-width: 320px;
                }
                
                .resolution-warning-dialog .md-dialog-content {
                    padding: 24px;
                }
                
                .resolution-warning-dialog .dialog-header {
                    display: flex;
                    align-items: center;
                    margin-bottom: 16px;
                }
                
                .resolution-warning-dialog .warning-icon {
                    color: #ff9800;
                    font-size: 28px;
                    margin-right: 12px;
                }
                
                .resolution-warning-dialog .md-title {
                    margin: 0;
                    color: rgba(0, 0, 0, 0.87);
                    font-weight: 500;
                }
                
                .resolution-warning-dialog .dialog-body {
                    margin-bottom: 16px;
                }
                
                .resolution-warning-dialog .md-body-1 {
                    margin-bottom: 16px;
                    line-height: 1.5;
                    color: rgba(0, 0, 0, 0.87);
                }
                
                .resolution-warning-dialog .current-resolution {
                    display: flex;
                    align-items: center;
                    background-color: #e3f2fd;
                    padding: 12px;
                    border-radius: 4px;
                    margin-bottom: 20px;
                }
                
                .resolution-warning-dialog .info-icon {
                    color: #2196f3;
                    font-size: 20px;
                    margin-right: 8px;
                }
                
                .resolution-warning-dialog .recommendations {
                    margin-top: 16px;
                }
                
                .resolution-warning-dialog .recommendations-title {
                    font-weight: 500;
                    margin-bottom: 12px;
                    color: rgba(0, 0, 0, 0.87);
                }
                
                .resolution-warning-dialog .recommendation-item {
                    margin-bottom: 12px;
                    padding: 8px 0;
                }
                
                .resolution-warning-dialog .recommendation-icon {
                    color: #4caf50;
                    font-size: 20px;
                    margin-right: 12px;
                    min-width: 20px;
                }
                
                .resolution-warning-dialog .md-body-2 {
                    color: rgba(0, 0, 0, 0.87);
                    line-height: 1.4;
                }
                
                .resolution-warning-dialog md-dialog-actions {
                    padding: 8px 24px 24px;
                    margin: 0;
                }
                
                .resolution-warning-dialog md-dialog-actions .md-button {
                    margin-left: 8px;
                    min-width: 64px;
                }
                
                .resolution-warning-dialog md-dialog-actions .md-button.md-raised {
                    background-color: #2196f3;
                    color: white;
                }
                
                .resolution-warning-dialog md-dialog-actions .md-button.md-raised:hover {
                    background-color: #1976d2;
                }
                
                /* Responsive design */
                @media (max-width: 600px) {
                    .resolution-warning-dialog {
                        margin: 16px;
                        max-width: calc(100vw - 32px);
                    }
                    
                    .resolution-warning-dialog .md-dialog-content {
                        padding: 16px;
                    }
                    
                    .resolution-warning-dialog md-dialog-actions {
                        padding: 8px 16px 16px;
                    }
                }
            </style>
        `,
            controller: ResolutionWarningDialogController,
            controllerAs: 'ctrl',
            locals: {
                STORAGE_KEY: this.STORAGE_KEY
            },
            clickOutsideToClose: false,
            escapeToClose: false,
            fullscreen: false
        });
    }
}

class ResolutionWarningDialogController {
    static $inject = [
        '$mdDialog',
        'STORAGE_KEY'
    ];

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private STORAGE_KEY: string
    ) {
        console.log('ResolutionWarningDialogController: Controller instantiated');
    }

    close(): void {
        this.$mdDialog.hide();
    }

    dismiss(): void {
        localStorage.setItem(this.STORAGE_KEY, 'true');
        this.$mdDialog.hide();
    }
}

export default ResolutionWarningService;