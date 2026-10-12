import type {JobChangeRequestDto} from "../../interfaces/jobChangeRequest";

export interface PendingChangeBadgeProps {
    request: JobChangeRequestDto;
    variant?: 'corner' | 'inline';
}