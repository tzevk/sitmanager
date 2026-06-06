import { redirect } from 'next/navigation';

export default async function EditTrainerMasterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/dashboard/masters/faculty/edit/${id}`);
}
