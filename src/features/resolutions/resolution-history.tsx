'use client';
import { EmptyState } from '@/components/ui';
import { formatThaiDate } from '@/lib/workflow';
import { History } from 'lucide-react';

import type { ResolutionDetailModel } from './use-resolution-detail';
export function ResolutionHistory({
  model,
}: {
  model: Pick<ResolutionDetailModel, 'tab' | 'events' | 'users'>;
}) {
  const { tab, events, users } = model;
  return (
    <>
      {tab === 'history' &&
        (events.length ? (
          <div className="event-timeline">
            {events.map((event) => (
              <div className="timeline-item" key={event.id}>
                <span className="timeline-dot" />
                <div>
                  <h3>{event.action}</h3>
                  <p>{event.detail}</p>
                  <small>
                    {users.find((user) => user.id === event.actorId)?.name} ·{' '}
                    {formatThaiDate(event.createdAt)}
                  </small>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={History}
            title="ยังไม่มีความเคลื่อนไหวเพิ่มเติม"
            description="การมอบหมาย ส่งผลงาน และตัดสินใจจะบันทึกไว้ในประวัตินี้"
          />
        ))}
    </>
  );
}
