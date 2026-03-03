import angular from 'angular';

interface IDfrntStateParams extends angular.ui.IStateParamsService {
    jobId?: string; // Passed as string through url
}

export default IDfrntStateParams;