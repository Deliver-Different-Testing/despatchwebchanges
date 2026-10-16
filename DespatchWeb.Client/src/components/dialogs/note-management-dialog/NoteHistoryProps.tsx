import {NoteHistoryEntry} from "../../../types";

export interface NoteHistoryProps {
    history: NoteHistoryEntry[];
    isLoading: boolean;
    timeZoneAbbr: string;
}