import { MeetingDetailScreen } from '@/components/screens/meetings';

export default async function MeetingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MeetingDetailScreen id={id} />;
}
