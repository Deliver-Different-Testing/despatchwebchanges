import {Suggestion} from "../interfaces/job.interface";

function countSubJobs(jobNumber: string, relatedJobs: Suggestion[]): number {
    console.log('[CountSubJobs] input: ', { jobNumber, relatedJobs });

    if (!relatedJobs || relatedJobs.length === 0) {
        return 0;
    }

    // Extract the base job number from the input job number
    const match = jobNumber.match(/^([A-Z0-9]+)([a-z]*)$/);

    if (!match) {
        console.log('[CountSubJobs] Invalid job number format:', jobNumber);
        return 0;
    }

    const [, baseJob] = match;

    // Find all jobs that belong to this base job group
    const jobsInGroup = relatedJobs.filter(job => {
        const jobMatch = job.text.match(/^([A-Z0-9]+)([a-z]*)$/);
        return jobMatch && jobMatch[1] === baseJob;
    });

    // Count sub-jobs (jobs with suffixes, excluding the main job)
    const subJobCount = jobsInGroup.filter(job => {
        const jobMatch = job.text.match(/^([A-Z0-9]+)([a-z]*)$/);
        return jobMatch && jobMatch[2] !== ''; // Has a suffix
    }).length;

    console.log('[CountSubJobs] result: ', subJobCount);
    return subJobCount;
}

export default countSubJobs;
