// Customer app root — hand-rolled hash routing (see lib/router.ts). No router dependency.
import { useRoute } from './lib/router';
import { Home } from './routes/Home';
import { Book } from './routes/Book';
import { Track } from './routes/Track';
import { Mine } from './routes/Mine';
import { Shell } from './components/Shell';
import { Button } from './components/Button';
import { navigate } from './lib/router';

export default function App() {
  const route = useRoute();

  switch (route.name) {
    case 'home':
      return <Home />;
    case 'book':
      return <Book />;
    case 'track':
      return <Track id={route.id} />;
    case 'mine':
      return <Mine />;
    default:
      return (
        <Shell back="/">
          <div className="py-16 text-center">
            <h1 className="font-display text-2xl font-bold text-white">Page not found</h1>
            <p className="mt-2 font-body text-sm text-white/55">
              That link doesn&apos;t lead anywhere in the app.
            </p>
            <div className="mt-6">
              <Button onClick={() => navigate('/')}>Back to home</Button>
            </div>
          </div>
        </Shell>
      );
  }
}
