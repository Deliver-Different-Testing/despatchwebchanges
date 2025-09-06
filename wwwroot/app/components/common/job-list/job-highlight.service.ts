class JobHighlightService implements angular.IServiceProvider {
    private highlightedRelatedJobIds: number[] = [];
    private listeners: Array<(jobIds: number[]) => void> = [];

    static $inject = ['$log'];

    constructor(private $log: angular.ILogService) {
        this.$log.error('JobHighlightService: Service instantiated');
    }
    
    $get() { 
        return this;
    }

    updateHighlightedRelatedJobs(selectedJob: any): void {
        this.highlightedRelatedJobIds = [];

        if (!selectedJob || !selectedJob.relatedJobs || selectedJob.relatedJobs.length === 0) {
            this.notifyListeners();
            return;
        }

        this.highlightedRelatedJobIds = selectedJob.relatedJobs.map((relatedJob: any) => relatedJob.id);
        this.notifyListeners();
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
        this.listeners.forEach(listener => {
            try {
                listener([...this.highlightedRelatedJobIds]);
            } catch (error) {
                this.$log.error('Error notifying job highlight listener:', error);
            }
        });
    }

    clearHighlights(): void {
        this.highlightedRelatedJobIds = [];
        this.notifyListeners();
    }
}

export default JobHighlightService;