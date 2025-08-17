import ResolutionWarningDialogController from "./resolution-warning-dialog.controller";

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
            template: require('./resolution-warning-dialog.template.html'),
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

export default ResolutionWarningService;