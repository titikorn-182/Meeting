import { ReviewsScreen } from '@/components/screens/reviews';

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ task?: string }>;
}) {
  const { task } = await searchParams;
  return <ReviewsScreen initialTaskId={task} />;
}
