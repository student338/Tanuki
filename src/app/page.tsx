import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';

export default async function Home() {
  const user = await getCurrentUser();
  if (user?.role === 'admin') redirect('/admin');
  if (user?.role === 'teacher') redirect('/teacher');
  if (user?.role === 'student') redirect('/student');
  redirect('/login');
}
