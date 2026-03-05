import Dashboard from '@/components/Dashboard';
import { getCategories, getLibraryItems, getPanels } from '@/lib/dashboard-data';
import { getLoggedInUser } from '@/lib/auth-session';
import { redirect } from 'next/navigation';

export default async function Home() {
  const user = await getLoggedInUser();
  if (!user) redirect('/login');

  const panels = await getPanels();
  const categories = await getCategories();
  const libraryItems = await getLibraryItems();

  return (
    <Dashboard
      initialCategories={categories}
      initialLibraryItems={libraryItems}
      initialPanels={panels}
    />
  );
}
