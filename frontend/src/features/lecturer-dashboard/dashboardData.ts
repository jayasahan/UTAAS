import type { RequestListItem } from '../requests/contracts';

export interface RecentStatusCounts {
  pending: number;
  returned: number;
  completed: number;
}

export function countRecentRequestStatuses(
  items: readonly RequestListItem[],
): RecentStatusCounts {
  return items.reduce<RecentStatusCounts>(
    (counts, item) => {
      if (item.status === 'SUBMITTED' || item.status === 'UNDER_REVIEW')
        counts.pending += 1;
      if (item.status === 'RETURNED_FOR_CORRECTION') counts.returned += 1;
      if (item.status === 'APPROVED' || item.status === 'SETTLED')
        counts.completed += 1;
      return counts;
    },
    { pending: 0, returned: 0, completed: 0 },
  );
}

export function recentRequestTitle(item: RequestListItem): string {
  const courseCode =
    typeof item.metadata.courseCode === 'string'
      ? item.metadata.courseCode.trim()
      : '';
  const courseTitle =
    typeof item.metadata.courseTitle === 'string'
      ? item.metadata.courseTitle.trim()
      : '';
  if (courseCode && courseTitle) return courseCode + ' · ' + courseTitle;
  if (courseTitle) return courseTitle;
  return item.requestType;
}

export function requestHref(item: RequestListItem): string {
  if (item.status === 'DRAFT')
    return '/requests/new?draftId=' + encodeURIComponent(item.id);
  return '/requests/' + encodeURIComponent(item.id);
}

export function latestDraftHref(
  items: readonly RequestListItem[],
): string | null {
  const draft = items.find((item) => item.status === 'DRAFT');
  return draft ? requestHref(draft) : null;
}

export function latestTrackableRequestHref(
  items: readonly RequestListItem[],
): string | null {
  const request = items.find((item) => item.status !== 'DRAFT');
  return request ? requestHref(request) : null;
}
