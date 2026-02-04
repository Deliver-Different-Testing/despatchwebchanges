import {IDispatchJob, IJob} from "../../../interfaces/job.interface";
import angular from 'angular';

class JobHighlightService implements angular.IServiceProvider {
    private highlightedRelatedJobIds: number[] = [];
    private listeners: Array<(jobIds: number[]) => void> = [];

    constructor() {
        console.log('JobHighlightService: Service instantiated');
    }
    
    $get() { 
        return this;
    }

    updateHighlightedRelatedJobs(selectedJob: IDispatchJob | IJob): void {
        console.log('Updating highlighted related jobs');
        this.highlightedRelatedJobIds = [];

        if (!selectedJob || !selectedJob.relatedJobs || selectedJob.relatedJobs.length === 0) {
            console.log('No related jobs found or selected job is null');
            this.notifyListeners();
            return;
        }

        this.highlightedRelatedJobIds = selectedJob.relatedJobs.map((relatedJob: any) => relatedJob.id);
        this.notifyListeners();
        console.log('Highlighted related jobs updated:', this.highlightedRelatedJobIds);
    }
    
    getHighlightedRelatedJobIds(): number[] {
        return [...this.highlightedRelatedJobIds];
    }
    
    isJobHighlighted(jobId: number): boolean {
        return this.highlightedRelatedJobIds.includes(jobId);
    }
    
    subscribe(callback: (jobIds: number[]) => void): () => void {
        this.listeners.push(callback);

        // Return unsubscribe function
        return () => {
            const index = this.listeners.indexOf(callback);
            if (index > -1) {
                this.listeners.splice(index, 1);
            }
        };
    }
    
    private notifyListeners(): void {
        console.log('Notifying job highlight listeners');
        
        this.listeners.forEach((listener: (jobIds: number[]) => void) => {
            try {
                listener([...this.highlightedRelatedJobIds]);
            } catch (error) {
                console.error('Error notifying job highlight listener:', error);
            }
        });
    }

    clearHighlights(): void {
        console.log('Clearing all job highlights');
        this.highlightedRelatedJobIds = [];
        this.notifyListeners();
    }
}

export default JobHighlightService;