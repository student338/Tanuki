import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';

export default async function Home() {
  const user = await getCurrentUser();
  if (user?.role === 'admin' || user?.role === 'teacher') redirect('/admin');
  if (user?.role === 'student') redirect('/student');
  redirect('/login');
}
