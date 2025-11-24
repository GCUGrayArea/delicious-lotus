import { Link } from 'react-router';
import { ROUTES } from '../types/routes';
import { Film, Image, Music, Megaphone } from 'lucide-react';

/**
 * Landing page with welcome content and getting started guide
 */
export default function LandingPage() {
  return (
    <div className="min-h-full flex items-center justify-center p-8">
      <div className="max-w-4xl w-full text-center space-y-8">
        {/* Hero Section */}
        <div className="space-y-4">
          <div className="flex justify-center">
            <Film className="w-20 h-20 text-blue-500" />
          </div>
          <h1 className="text-5xl font-bold text-zinc-100">
            Welcome to Delicious Lotus
          </h1>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
          <Link to={ROUTES.MEDIA} className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 space-y-3 hover:border-blue-500 transition-colors block">
            <Image className="w-10 h-10 text-blue-500 mx-auto" />
            <h3 className="text-lg font-semibold text-zinc-100">Create Images & Videos</h3>
            <p className="text-sm text-zinc-400">
              Generate stunning visuals with AI-powered tools
            </p>
          </Link>

          <Link to={ROUTES.MEDIA} className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 space-y-3 hover:border-blue-500 transition-colors block">
            <Music className="w-10 h-10 text-blue-500 mx-auto" />
            <h3 className="text-lg font-semibold text-zinc-100">Create Audio & Music</h3>
            <p className="text-sm text-zinc-400">
              Compose and generate audio tracks with AI assistance
            </p>
          </Link>

          <Link to={ROUTES.AD_GENERATOR} className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 space-y-3 hover:border-blue-500 transition-colors block">
            <Megaphone className="w-10 h-10 text-blue-500 mx-auto" />
            <h3 className="text-lg font-semibold text-zinc-100">Ad Generator</h3>
            <p className="text-sm text-zinc-400">
              Create high-converting video ads with AI-powered templates
            </p>
          </Link>
        </div>

        {/* Call to Action */}
        <div className="pt-8">
          <Link
            to={ROUTES.PROJECTS}
            className="inline-block bg-blue-500 hover:bg-blue-600 text-white font-semibold px-8 py-3 rounded-lg transition-colors"
          >
            Get Started
          </Link>
        </div>
      </div>
    </div>
  );
}
