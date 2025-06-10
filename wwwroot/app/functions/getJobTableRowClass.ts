import {IDispatchJob} from "../interfaces/job.interface";
import {JobStatus} from "../enums/job-status.enum";
import dayjs from "dayjs";

function getJobTableRowClass(job: IDispatchJob, currentlySelectedJob?: IDispatchJob): string {
    if (!job) {
        return '';
    }

    if (currentlySelectedJob && currentlySelectedJob.relatedJobs && currentlySelectedJob.relatedJobs.length > 0) {
        if (currentlySelectedJob?.relatedJobs.find(j => j.id === job.id)) return 'related-job';
    }

    if (job.statusId === JobStatus.Warning) return 'status-warning';

    if (!job.followupTime) return '';

    const followupTime = dayjs(job.followupTime);
    const now = dayjs();
    const diffMinutes = followupTime.diff(now, 'minutes');

    if (diffMinutes > 30) {
        return 'status-future';
    } else if (diffMinutes < -30) {
        return 'status-past';
    } else {
        return 'status-current';
    }
}

export default getJobTableRowClass;
