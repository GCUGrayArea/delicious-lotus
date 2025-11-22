import { Outlet } from 'react-router-dom';

/**
 * AdGeneratorLayout Component
 *
 * Minimal layout wrapper for the ad generator flow.
 * Uses React Router's Outlet to render nested routes.
 */
export function AdGeneratorLayout() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="w-full">
        <Outlet />
      </main>
    </div>
  );
}
