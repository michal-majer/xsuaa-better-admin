'use client';

import { useRouter } from 'next/navigation';
import { useSession, signOut } from '@/lib/auth-client';
import { useEffect, useState } from 'react';

interface UserData {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  xsuaaSubject?: string | null;
  image?: string | null;
}

export default function DashboardPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch user data directly from our API if Better Auth session is empty
  useEffect(() => {
    async function fetchUserData() {
      try {
        const res = await fetch('/api/me');
        if (res.ok) {
          const data = await res.json();
          setUserData(data.user);
        } else {
          // Session invalid - redirect to login
          router.push('/login');
        }
      } catch (e) {
        console.error('Failed to fetch user data:', e);
        router.push('/login');
      } finally {
        setLoading(false);
      }
    }

    if (!isPending) {
      if (session?.user?.id) {
        // Better Auth session is valid - use it
        setUserData(session.user as UserData);
        setLoading(false);
      } else {
        // Try to get session from our custom endpoint
        fetchUserData();
      }
    }
  }, [session, isPending, router]);

  const handleSignOut = async () => {
    await signOut();
    // Also clear our custom cookie
    document.cookie = 'better-auth.session_token=; Max-Age=0; path=/';
    router.push('/');
    router.refresh();
  };

  if (isPending || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <div className="text-gray-600">Loading...</div>
        </div>
      </div>
    );
  }

  if (!userData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Session not found. Please log in again.</p>
          <button
            onClick={() => router.push('/login')}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">{userData.email}</span>
              <button
                onClick={handleSignOut}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">
              Welcome, {userData.name || 'User'}!
            </h2>
            <p className="text-gray-600 mb-6">
              You are authenticated and your session is stored in PostgreSQL via Better Auth.
            </p>

            <div className="border-t border-gray-200 pt-4">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Session Info</h3>
              <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div>
                  <dt className="text-sm text-gray-500">User ID</dt>
                  <dd className="text-sm font-mono text-gray-900">{userData.id}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">Email</dt>
                  <dd className="text-sm text-gray-900">{userData.email}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">Name</dt>
                  <dd className="text-sm text-gray-900">{userData.name}</dd>
                </div>
                {userData.xsuaaSubject && (
                  <div>
                    <dt className="text-sm text-gray-500">Login Method</dt>
                    <dd className="text-sm text-gray-900">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        SAP SSO
                      </span>
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            <div className="border-t border-gray-200 mt-6 pt-4">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Architecture</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>Authentication: Better Auth (email/password + SAP XSUAA SSO)</li>
                <li>Session storage: PostgreSQL (via Drizzle ORM)</li>
                <li>Platform: SAP BTP Cloud Foundry</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
