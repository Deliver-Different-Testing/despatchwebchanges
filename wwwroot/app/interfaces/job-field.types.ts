export type TimeField = 'Time' | 'CompletedTime' | 'FollowupTime';

export type DateField = 'Date' | 'StopDate' | 'RestartDate' | 'InActiveDate' | 'FirstDue' | 'LastDone' | 'NextDue' | 'DueDate';

export type JobField = TimeField | DateField | 'DeliverToContact' | string;
