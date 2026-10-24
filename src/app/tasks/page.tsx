import { TasksScreen } from '@/components/screens/tasks';

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ status?: string; scope?: string; filter?: string }> }) {
  const query = await searchParams;
  return <TasksScreen initialStatus={query.status ?? query.filter} initialScope={query.scope} />;
}
