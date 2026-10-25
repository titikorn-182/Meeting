import { ResolutionDetail } from '@/components/screens/resolution-detail';
export default async function ResolutionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ResolutionDetail id={id} />;
}
