import { redis } from '../config/redis.js';

export const taskListCacheKey = ({ orgId, assignee, page, limit, status, priority }) =>
  `tasks:list:org:${orgId}:assignee:${assignee || 'all'}:page:${page}:limit:${limit}:status:${status || 'all'}:priority:${priority || 'all'}`;

export const invalidateTaskListCache = async (orgId, assigneeId) => {
  const patterns = [`tasks:list:org:${orgId}:assignee:all:*`, `tasks:list:org:${orgId}:assignee:${assigneeId}:*`];
  for (const pattern of patterns) {
    let cursor = '0';
    do {
      const [next, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = next;
      if (keys.length) await redis.del(...keys);
    } while (cursor !== '0');
  }
};
