import angular from 'angular';
class UrlService implements angular.IServiceProvider {
    static $inject = ['$location'];

    constructor(
        private $location: angular.ILocationService
    ) {}

    $get() {
        return this;
    }

    private getCurrentUrl(): string {
        return this.$location.absUrl();
    }

    getHubUrl(): string {
        const currentUrl = this.getCurrentUrl();
        return currentUrl.replace(/despatch/g, 'hub');
    }   
    
    getAdminManagerUrl(): string {
        const currentUrl = this.getCurrentUrl();
        return currentUrl.replace(/adminmanager/g, 'hub');
    }
}

export default UrlService;