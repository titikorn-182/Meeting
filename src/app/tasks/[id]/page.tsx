import { TaskDetailScreen } from '@/components/screens/task-detail';

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TaskDetailScreen id={id} />;
}
