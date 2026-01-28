import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-16 px-4 sm:py-24 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-4xl font-extrabold text-gray-900 sm:text-5xl sm:tracking-tight lg:text-6xl">
            XSUAA + PostgreSQL
          </h1>
          <p className="mt-4 text-xl text-gray-500">
            Hybrid Authentication on SAP BTP
          </p>
        </div>

        <div className="mt-12 bg-white shadow rounded-lg p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Architecture</h2>
          <div className="space-y-4 text-gray-600">
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
              <div>
                <strong>XSUAA</strong> - Platform-level security (who can access the app)
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
              <div>
                <strong>Better Auth</strong> - Application-level user management
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-purple-500 rounded-full mt-2"></div>
              <div>
                <strong>Drizzle ORM</strong> - Type-safe PostgreSQL with migrations
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-orange-500 rounded-full mt-2"></div>
              <div>
                <strong>Next.js</strong> - Full-stack React framework
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 flex gap-4 justify-center">
          <Link
            href="/login"
            className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center px-6 py-3 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Create Account
          </Link>
        </div>

        <div className="mt-16 border-t border-gray-200 pt-8">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Start</h3>
          <div className="bg-gray-900 rounded-lg p-4 text-sm">
            <pre className="text-gray-300 overflow-x-auto">
{`# Start local PostgreSQL
docker compose -f docker-compose.yml up -d

# Push schema to database
npm run db:push

# Start development server
npm run dev`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
