import { ResolutionCreate } from '@/components/screens/resolution-create';
export default async function NewResolutionPage({
  searchParams,
}: {
  searchParams: Promise<{ meetingId?: string | string[]; agenda?: string | string[] }>;
}) {
  const params = await searchParams;
  const initialMeetingId = typeof params.meetingId === 'string' ? params.meetingId : undefined;
  const initialAgenda = typeof params.agenda === 'string' ? params.agenda : undefined;
  return (
    <ResolutionCreate
      key={`${initialMeetingId ?? ''}:${initialAgenda ?? ''}`}
      initialMeetingId={initialMeetingId}
      initialAgenda={initialAgenda}
    />
  );
}
