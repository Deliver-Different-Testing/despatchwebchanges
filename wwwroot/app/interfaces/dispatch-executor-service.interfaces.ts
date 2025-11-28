export interface ValidationResult {
    isValid: boolean;
    message: string;
}

export interface DispatchState {
    processing: boolean;
    selectedJobs: Set<number>;
}