import {ISuggestion} from "../interfaces/job.interface";

export function getMinsSelectionOptions(
    startSeconds: number = 30,
    intervalSeconds: number = 30,
    maxMinutes: number = 15
): ISuggestion[] {
    const options: ISuggestion[] = [];

    const maxSeconds = maxMinutes * 60; // 15 minutes in seconds

    for (let seconds = startSeconds; seconds <= maxSeconds; seconds += intervalSeconds) {
        options.push({
            id: seconds,
            text: formatDuration(seconds)
        });
    }

    return options;
}

function formatDuration(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes === 0) {
        return `${seconds} seconds`;
    } else if (remainingSeconds === 0) {
        return minutes === 1 ? `${minutes} min` : `${minutes} mins`;
    } else {
        const minText = minutes === 1 ? 'min' : 'mins';
        return `${minutes} ${minText} ${remainingSeconds} seconds`;
    }
}