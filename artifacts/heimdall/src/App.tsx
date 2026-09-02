import { useEffect, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { AppShell, DetailView, FeedView, type LocalState, type Post } from '@/components/heimdall/HeimdallUI';
import feed from '@/data/feed.json';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, useParams, Router as WouterRouter } from 'wouter';

const queryClient = new QueryClient();
const seedPosts = feed as Post[];
const bucketOrder: Record<Post['bucket'], number> = { now: 0, serendipity: 1, later: 2 };

function readLocalPosts(): Post[] {
  try {
    return JSON.parse(localStorage.getItem('heimdall-local-posts') ?? '[]') as Post[];
  } catch {
    return [];
  }
}

function readLocalState(): LocalState {
  try {
    return JSON.parse(localStorage.getItem('heimdall-actions') ?? '{}') as LocalState;
  } catch {
    return {};
  }
}

function Home() {
  const [, setLocation] = useLocation();
  const [posts, setPosts] = useState<Post[]>(() => [...readLocalPosts(), ...seedPosts]);
  const [actionState, setActionState] = useState<LocalState>(readLocalState);
  const orderedPosts = useMemo(() => [...posts].sort((a, b) => bucketOrder[a.bucket] - bucketOrder[b.bucket] || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), [posts]);

  useEffect(() => {
    localStorage.setItem('heimdall-actions', JSON.stringify(actionState));
  }, [actionState]);

  const toggle = (id: string, key: 'liked' | 'reposted' | 'bookmarked') => {
    setActionState((current) => {
      const previous = current[id] ?? {};
      const active = !previous[key];
      const countKey = key === 'liked' ? 'likes' : key === 'reposted' ? 'reposts' : 'bookmarks';
      const next = { ...previous, [key]: active, [countKey]: active ? 1 : 0 };
      return { ...current, [id]: next };
    });
  };

  const addPost = (text: string) => {
    const localPost: Post = {
      id: `local-${Date.now()}`,
      author: { name: 'Gagan Gehani', handle: 'GaganGehani', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=160&q=80', verified: true },
      text,
      createdAt: new Date().toISOString(),
      media: [],
      article: null,
      metrics: { replies: 0, reposts: 0, likes: 0, bookmarks: 0, views: 0 },
      bucket: 'now',
    };
    setPosts((current) => [localPost, ...current]);
    localStorage.setItem('heimdall-local-posts', JSON.stringify([localPost, ...readLocalPosts()]));
  };

  return (
    <AppShell>
      <FeedView posts={orderedPosts} state={actionState} onPost={addPost} onToggle={toggle} onOpen={(id) => setLocation(`/status/${id}`)} />
    </AppShell>
  );
}

function StatusPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [actionState, setActionState] = useState<LocalState>(readLocalState);
  const post = [...readLocalPosts(), ...seedPosts].find((item) => item.id === id);
  useEffect(() => { localStorage.setItem('heimdall-actions', JSON.stringify(actionState)); }, [actionState]);
  if (!post) return <AppShell><div className="not-found-inline"><span className="eyebrow">404 / gate closed</span><h2>This keeper isn't in the cut.</h2><button type="button" onClick={() => setLocation('/')} data-testid="button-return-home">Return home</button></div></AppShell>;
  const toggle = (postId: string, key: 'liked' | 'reposted' | 'bookmarked') => {
    setActionState((current) => {
      const previous = current[postId] ?? {};
      const active = !previous[key];
      const countKey = key === 'liked' ? 'likes' : key === 'reposted' ? 'reposts' : 'bookmarks';
      return { ...current, [postId]: { ...previous, [key]: active, [countKey]: active ? 1 : 0 } };
    });
  };
  return <AppShell><DetailView post={post} state={actionState[post.id]} onToggle={toggle} /></AppShell>;
}

function Router() {
  return (
    <ErrorBoundary resetKey={window.location.pathname}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/status/:id" component={StatusPage} />
        <Route component={NotFound} />
      </Switch>
    </ErrorBoundary>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;