import { MeetingManageScreen } from '@/features/meetings/manage-screen';
export const metadata = { title: 'จัดการการประชุม' };
export default async function MeetingManagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MeetingManageScreen id={id} />;
}
