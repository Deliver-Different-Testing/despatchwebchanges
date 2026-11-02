import type {SuggestedPrompt} from '../types/autoMateChat';

const prompt = (label: string): SuggestedPrompt => ({label, prompt: label});

const DEFAULT_PROMPTS: SuggestedPrompt[] = [
    prompt('How do I book a job?'),
    prompt('What can you help with?'),
];

const PROMPTS_BY_STATE: Record<string, SuggestedPrompt[]> = {
    dispatch: [
        prompt('Which jobs look at risk right now?'),
        prompt('How do I reassign a job to another driver?'),
        prompt('How do I read the dispatch board?'),
    ],
    nationwide: [
        prompt('How do nationwide jobs work?'),
        prompt('How do I send a job to a partner?'),
    ],
    jobSearch: [
        prompt('How do I find a job?'),
        prompt('How do I filter the job search results?'),
    ],
    recurringJobs: [
        prompt('How do I set up a recurring job?'),
        prompt('How do I add a stop to a recurring job?'),
    ],
    overview: [
        prompt('What do the overview metrics mean?'),
        prompt('What can you help with?'),
    ],
    taskDashboard: [
        prompt('What are tasks used for?'),
        prompt('How do I resolve a task?'),
    ],
    driverManagement: [
        prompt('How do I add a driver?'),
        prompt('How do driver compliance checks work?'),
    ],
    courierMap: [
        prompt('How do I see where a driver is?'),
        prompt('What do the map markers mean?'),
    ],
    settings: [
        prompt('What does Auto-mate do?'),
        prompt('How do I change how dates and times are shown?'),
    ],
};

const JOB_DETAIL_PROMPTS: SuggestedPrompt[] = [
    prompt("What's happening with this job?"),
    prompt("Summarise this job's notes"),
    prompt('How do I change the delivery address?'),
];

const PAGE_CONTEXT_BY_STATE: Record<string, string> = {
    dispatch: 'Dispatch board - live jobs and drivers',
    nationwide: 'Nationwide - jobs sent to and from network partners',
    jobSearch: 'Job search',
    recurringJobs: 'Recurring jobs - scheduled repeat deliveries',
    overview: 'Overview dashboard',
    taskDashboard: 'Task dashboard',
    driverManagement: 'Driver management',
    courierMap: 'Courier map - live driver locations',
    settings: 'Settings',
};

const JOB_PAGES = new Set(['dispatch', 'nationwide', 'jobSearch']);

const isJobView = (state: string, jobId?: number): jobId is number =>
    jobId !== undefined && JOB_PAGES.has(state);

export function getPageContext(currentState: string, jobId?: number): string {
    if (isJobView(currentState, jobId)) return `Job details for job ${jobId}`;
    return PAGE_CONTEXT_BY_STATE[currentState] ?? 'Despatch';
}

export function getSuggestedPrompts(currentState: string, jobId?: number): SuggestedPrompt[] {
    if (isJobView(currentState, jobId)) return JOB_DETAIL_PROMPTS;
    return PROMPTS_BY_STATE[currentState] ?? DEFAULT_PROMPTS;
}
