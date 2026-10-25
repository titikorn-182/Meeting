import { ResolutionDetail } from '@/components/screens/resolution-detail';
export default async function ResolutionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ addTask?: string | string[] }>;
}) {
  const { id } = await params;
  const { addTask } = await searchParams;
  return <ResolutionDetail id={id} initialAddTask={addTask === '1'} />;
}
