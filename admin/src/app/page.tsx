import { redirect } from 'next/navigation'
import { isSetupComplete } from '@/lib/state'
import { getSession } from '@/lib/auth'

export default async function RootPage() {
  if (!isSetupComplete()) redirect('/setup')
  if (!(await getSession())) redirect('/login')
  redirect('/dashboard')
}
