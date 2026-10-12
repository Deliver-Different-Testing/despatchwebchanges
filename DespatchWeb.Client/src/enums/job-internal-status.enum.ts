 enum InternalJobStatus {
    NewJobs = 1,
    ActionRequired = 2,
    AwaitingPod = 3,
    Reprice = 4,
    OvernightCp = 5
}

export default InternalJobStatus;
