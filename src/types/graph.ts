export interface GraphTodoTask {
  id: string;
  title: string;
  status?: string;
  importance?: string;
  body?: { content?: string; contentType?: string };
  dueDateTime?: { dateTime: string; timeZone: string };
  startDateTime?: { dateTime: string; timeZone: string };
  reminderDateTime?: { dateTime: string; timeZone: string };
  isReminderOn?: boolean;
  completedDateTime?: { dateTime: string; timeZone: string };
  lastModifiedDateTime?: string;
  "@removed"?: { reason: string };
}

export interface GraphChecklistItem {
  id: string;
  displayName: string;
  isChecked: boolean;
}

export interface GraphTodoTaskList {
  id: string;
  displayName: string;
}

export interface GraphLinkedResource {
  id?: string;
  applicationName: string;
  displayName: string;
  webUrl: string;
  externalId: string;
}

export interface GraphDeltaResponse<T> {
  value: T[];
  "@odata.nextLink"?: string;
  "@odata.deltaLink"?: string;
}
