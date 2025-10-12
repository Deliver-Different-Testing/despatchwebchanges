import ResolutionWarningDialogController from "./resolution-warning-dialog.controller";

class ResolutionWarningService implements angular.IServiceProvider {
    static $inject = [
        '$mdDialog',
        '$window'
    ];

    private readonly STORAGE_KEY_Old = `resolution-warning-shown_${ContactID}`;
    private readonly STORAGE_KEY = `resolution-warning-shown}`;
    private readonly MIN_WIDTH = 1920;
    private readonly MIN_HEIGHT = 1200;
    private currentScreenWidth?: number;
    private currentScreenHeight?: number;

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private $window: angular.IWindowService) {
        console.debug('ResolutionWarningService: Service instantiated');
    }

    $get() {
        return this;
    }

    checkAndShowResolutionWarning(): void {
        // Check if a warning has already been shown
        if (localStorage.getItem(this.STORAGE_KEY) || localStorage.getItem(this.STORAGE_KEY_Old)) {
            console.debug('ResolutionWarningService: Warning already shown');
            return;
        }

        // Check screen resolution
        this.currentScreenWidth = this.$window.screen.width;
        this.currentScreenHeight = this.$window.screen.height;

        if (this.currentScreenWidth < this.MIN_WIDTH || this.currentScreenHeight < this.MIN_HEIGHT) {
            this.showResolutionWarning();
        } else {
            console.debug('ResolutionWarningService: Screen resolution is sufficient');
            
            // Mark as shown even if not displayed, so it doesn't check again
            localStorage.setItem(this.STORAGE_KEY, 'true');
        }
    }

    private showResolutionWarning(): void {
        console.debug('ResolutionWarningService: Showing resolution warning');
        
        this.$mdDialog.show({
            template: require('./resolution-warning-dialog.template.html'),
            controller: ResolutionWarningDialogController,
            controllerAs: 'ctrl',
            locals: {
                STORAGE_KEY: this.STORAGE_KEY,
                MIN_WIDTH: this.MIN_WIDTH,
                MIN_HEIGHT: this.MIN_HEIGHT,
                currentScreenWidth: this.currentScreenWidth,
                currentScreenHeight: this.currentScreenHeight
            },
            clickOutsideToClose: false,
            escapeToClose: false,
            fullscreen: false
        });
        
        console.debug('ResolutionWarningService: Resolution warning shown');
    }
}

export default ResolutionWarningService;