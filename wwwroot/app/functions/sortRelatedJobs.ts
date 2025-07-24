import {JobGroup, Suggestion} from "../interfaces/job.interface";

function sortRelatedJobs(relatedJobs: Suggestion[]): JobGroup[] {
    console.log('[SortRelatedJobs] input: ', relatedJobs);

    if (!relatedJobs || relatedJobs.length === 0) {
        return [];
    }

    // Group jobs by their base number
    const jobMap = new Map<string, Suggestion[]>();

    // First pass: identify base job numbers
    relatedJobs.forEach(job => {
        // For KT175DF1, KT175DF1a, KT175DF1b pattern
        const match = job.text.match(/^([A-Z0-9]+)([a-z]*)$/);

        if (match) {
            const [, baseJob, suffix] = match;

            if (!jobMap.has(baseJob)) {
                jobMap.set(baseJob, []);
            }

            jobMap.get(baseJob)!.push(job);
        }
    });

    // Build result
    const result: JobGroup[] = [];

    // Process each group
    jobMap.forEach((jobs: Suggestion[], baseJob: string) => {
        // Sort jobs - main job first (no suffix), then others alphabetically
        jobs.sort((a, b) => {
            const suffixA = a.text.replace(baseJob, '');
            const suffixB = b.text.replace(baseJob, '');

            if (suffixA === '' && suffixB !== '') return -1;
            if (suffixA !== '' && suffixB === '') return 1;
            return suffixA.localeCompare(suffixB);
        });

        // Get the main job and sub-jobs
        const mainJob = jobs.find(job => job.text === baseJob) || jobs[0];
        const subJobs = jobs.filter(job => job !== mainJob);

        result.push({
            job: mainJob,
            subJobs: subJobs
        });
    });

    // Sort job groups alphabetically
    result.sort((a, b) => a.job.text.localeCompare(b.job.text));

    console.log('SortRelatedJobs result: ', result);
    return result;
}

export default sortRelatedJobs;
