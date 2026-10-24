import { ChangesScreen } from '@/components/screens/changes';

export default async function ChangesPage({ searchParams }: { searchParams: Promise<{ task?: string | string[]; status?: string | string[] }> }) {
  const params = await searchParams;
  const task = typeof params.task === 'string' ? params.task : undefined;
  const status = typeof params.status === 'string' ? params.status : undefined;
  return <ChangesScreen key={`${task ?? ''}:${status ?? 'all'}`} initialTaskId={task} initialStatus={status} />;
}
