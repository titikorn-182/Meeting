import { ResolutionsScreen } from '@/components/screens/resolutions';
export default async function ResolutionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[] }>;
}) {
  const { status } = await searchParams;
  const initialStatus = typeof status === 'string' ? status : 'all';
  return <ResolutionsScreen key={initialStatus} initialStatus={initialStatus} />;
}
