import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import {
  ArrowLeft,
  Bell,
  Bookmark,
  Check,
  ChevronDown,
  Home as HomeIcon,
  Image as ImageIcon,
  Link2,
  LoaderCircle,
  MessageCircle,
  MoreHorizontal,
  PenLine,
  Plus,
  Repeat2,
  Search,
  Share2,
  Heart,
  Sparkles,
  Target,
  UserRound,
} from 'lucide-react';

export type Bucket = 'now' | 'later' | 'serendipity';
export type Post = {
  id: string;
  author: { name: string; handle: string; avatar: string; verified: boolean };
  text: string;
  createdAt: string;
  media: { type: string; url: string; alt?: string }[];
  article: { url: string; domain: string; title: string; excerpt: string; image: string | null } | null;
  metrics: { replies: number; reposts: number; likes: number; bookmarks: number; views: number };
  bucket: Bucket;
  url?: string;
};
export type LocalState = Record<string, { liked?: boolean; reposted?: boolean; bookmarked?: boolean; likes?: number; reposts?: number; bookmarks?: number }>;
const gaganAvatar = 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=160&q=80';

export function formatCount(value: number) {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(value > 10000 ? 0 : 1)}K`;
  return String(value);
}

export function relativeTime(date: string) {
  const diff = Math.max(0, Date.now() - new Date(date).getTime());
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${Math.max(1, minutes)}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 8) return `${days}d`;
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(date));
}

function Verified() {
  return <span className="verified-mark" aria-label="Verified account"><Check size={10} strokeWidth={3} /></span>;
}

function LogoMark({ small = false }: { small?: boolean }) {
  return (
    <div className={small ? 'logo-mark logo-mark-small' : 'logo-mark'} aria-label="Heimdall gate mark">
      <span className="logo-arch" />
      <span className="logo-pillar" />
      <span className="logo-pillar logo-pillar-right" />
    </div>
  );
}

function Avatar({ author, size = 'md' }: { author: Post['author']; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <div className={`avatar avatar-${size}`} aria-label={`${author.name} avatar`} data-testid={`img-avatar-${author.handle}`}>
      <img src={author.avatar} alt="" />
    </div>
  );
}

export function ActionButton({
  label,
  count,
  active,
  tone,
  id,
  onClick,
}: {
  label: 'reply' | 'repost' | 'like' | 'bookmark' | 'share';
  count?: number;
  active?: boolean;
  tone?: 'repost' | 'like' | 'bookmark';
  id?: string;
  onClick: () => void;
}) {
  const icons = {
    reply: <MessageCircle size={16} />,
    repost: <Repeat2 size={17} />,
    like: <Heart size={16} />,
    bookmark: <Bookmark size={16} />,
    share: <Share2 size={16} />,
  };
  return (
    <button
      type="button"
      className={`action-button ${active ? `is-active ${tone ?? ''}` : ''}`}
      onClick={(event) => { event.stopPropagation(); onClick(); }}
      aria-label={`${active ? 'Remove ' : ''}${label}${count !== undefined ? `, ${count}` : ''}`}
      data-testid={`button-${label}-${id ?? 'action'}`}
    >
      {icons[label]} {count !== undefined && <span>{formatCount(count)}</span>}
    </button>
  );
}

function RichText({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/\S+|@\w+)/g);
  return (
    <>
      {parts.map((part, index) =>
        part.startsWith('@') ? (
          <a key={`${part}-${index}`} href={`https://x.com/${part.slice(1)}`} target="_blank" rel="noreferrer" className="inline-link" onClick={(event) => event.stopPropagation()} data-testid={`link-mention-${part.slice(1)}`}>{part}</a>
        ) : part.startsWith('http') ? (
          <a key={`${part}-${index}`} href={part} target="_blank" rel="noreferrer" className="inline-link" onClick={(event) => event.stopPropagation()} data-testid={`link-url-${index}`}>{part}</a>
        ) : part
      )}
    </>
  );
}

export function PostCard({
  post,
  state,
  onToggle,
  onOpen,
  index,
  selected,
}: {
  post: Post;
  state?: LocalState[string];
  onToggle: (id: string, key: 'liked' | 'reposted' | 'bookmarked') => void;
  onOpen: (id: string) => void;
  index?: number;
  selected?: boolean;
}) {
  const likes = post.metrics.likes + (state?.likes ?? 0);
  const reposts = post.metrics.reposts + (state?.reposts ?? 0);
  const bookmarks = post.metrics.bookmarks + (state?.bookmarks ?? 0);
  return (
    <article
      className={`post-card ${selected ? 'post-selected' : ''}`}
      onClick={() => onOpen(post.id)}
      data-testid={`card-post-${post.id}`}
      tabIndex={0}
      onKeyDown={(event) => { if (event.key === 'Enter') onOpen(post.id); }}
    >
      <div className="post-avatar-column"><Avatar author={post.author} /></div>
      <div className="post-content">
        <header className="post-header">
          <span className="post-author">{post.author.name}</span>
          {post.author.verified && <Verified />}
          <span className="post-handle">@{post.author.handle}</span>
          <span className="post-dot">·</span>
          <time dateTime={post.createdAt}>{relativeTime(post.createdAt)}</time>
          <button type="button" className="icon-button post-more" aria-label="More post actions" data-testid={`button-more-${post.id}`} onClick={(event) => event.stopPropagation()}><MoreHorizontal size={17} /></button>
        </header>
        <p className="post-text"><RichText text={post.text} /></p>
        {post.media.length > 0 && <img className="post-media" src={post.media[0].url} alt={post.media[0].alt ?? ''} />}
        {post.article && (
          <a className="article-card" href={post.article.url} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()} data-testid={`link-article-${post.id}`}>
            {post.article.image ? <img src={post.article.image} alt="" /> : <div className="article-art"><Sparkles size={20} /></div>}
            <div className="article-copy"><span className="article-domain">{post.article.domain}</span><strong>{post.article.title}</strong><span>{post.article.excerpt}</span></div>
          </a>
        )}
        <footer className="post-actions">
          <ActionButton id={post.id} label="reply" count={post.metrics.replies} onClick={() => onOpen(post.id)} />
          <ActionButton id={post.id} label="repost" count={reposts} active={state?.reposted} tone="repost" onClick={() => onToggle(post.id, 'reposted')} />
          <ActionButton id={post.id} label="like" count={likes} active={state?.liked} tone="like" onClick={() => onToggle(post.id, 'liked')} />
          <ActionButton id={post.id} label="bookmark" count={bookmarks} active={state?.bookmarked} tone="bookmark" onClick={() => onToggle(post.id, 'bookmarked')} />
          <ActionButton id={post.id} label="share" onClick={() => navigator.clipboard?.writeText(post.url ?? `${window.location.origin}/status/${post.id}`)} />
        </footer>
      </div>
    </article>
  );
}

function Sidebar() {
  const [location] = useLocation();
  const navItems: { label: string; icon: ReactNode; href?: string; disabled?: boolean }[] = [
    { label: 'Home', icon: <HomeIcon size={22} />, href: '/' },
    { label: 'Search', icon: <Search size={22} /> },
    { label: 'Alerts', icon: <Bell size={22} />, disabled: true },
    { label: 'Bookmarks', icon: <Bookmark size={22} />, disabled: true },
    { label: 'Goals', icon: <Target size={22} />, href: '/goals' },
    { label: 'Profile', icon: <UserRound size={22} /> },
  ];
  return (
    <aside className="sidebar">
      <Link href="/" className="brand-link" aria-label="Heimdall home" data-testid="link-home-logo"><LogoMark /><span>heimdall</span></Link>
      <nav className="side-nav" aria-label="Primary navigation">
        {navItems.map((item) => {
          const active = Boolean(item.href && (item.href === '/' ? location === '/' : location.startsWith(item.href)));
          const className = `nav-item${active ? ' active' : ''}${item.disabled ? ' nav-disabled' : ''}`;
          if (item.disabled) {
            return <button key={item.label} type="button" className={className} disabled aria-label={`${item.label} disabled`} data-testid={`button-nav-${item.label.toLowerCase()}`}>{item.icon}<span>{item.label}</span></button>;
          }
          if (item.href) {
            return <Link key={item.label} href={item.href} className={className} data-testid={`link-nav-${item.label.toLowerCase()}`}>{item.icon}<span>{item.label}</span></Link>;
          }
          return <button key={item.label} type="button" className={className} onClick={() => undefined} data-testid={`button-nav-${item.label.toLowerCase()}`}>{item.icon}<span>{item.label}</span></button>;
        })}
      </nav>
      <button type="button" className="compose-side-button" onClick={() => document.getElementById('composer-input')?.focus()} data-testid="button-compose-side"><PenLine size={19} /><span>Post</span></button>
      <div className="sidebar-bottom">
        <Link href="/goals" className="account-chip" data-testid="text-account-chip"><Avatar author={{ name: 'Gagan Gehani', handle: 'GaganGehani', avatar: gaganAvatar, verified: true }} size="sm" /><div><strong>Gagan Gehani</strong><small>Goals</small></div><ChevronDown size={16} /></Link>
      </div>
    </aside>
  );
}

function RightRail() {
  return (
    <aside className="right-rail">
      <div className="search-box"><Search size={17} /><input aria-label="Search" placeholder="Search" data-testid="input-search" /></div>
      <section className="rail-section rail-now" data-testid="card-now-intent">
        <div className="rail-label">Now</div>
        <h2>Job hunt</h2>
      </section>
      <section className="rail-section rail-lanes" data-testid="card-lanes">
        <h2>Lanes</h2>
        <div className="lane-list">
          <span>Senior / founding PM</span><span>AI · crypto · consumer</span><span>India · UAE · SG · MY · JP remote</span><span>Vegetarian high-protein</span>
        </div>
      </section>
    </aside>
  );
}

export function AppShell({ children, onRefresh }: { children: ReactNode; onRefresh?: () => void }) {
  const [location] = useLocation();
  const [refreshing, setRefreshing] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const node = mainRef.current;
    if (!node) return;
    const onScroll = () => setShowNew(node.scrollTop > 180);
    node.addEventListener('scroll', onScroll);
    return () => node.removeEventListener('scroll', onScroll);
  }, []);
  const refresh = () => {
    setRefreshing(true);
    window.setTimeout(() => { setRefreshing(false); onRefresh?.(); }, 400);
  };
  const top = () => mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  const onGoals = location === '/goals';
  const title = location === '/' ? 'Home' : onGoals ? 'Goals' : 'Post';
  return (
    <div className="heimdall-app">
      <Sidebar />
      <main ref={mainRef} className="main-column feed-scroll">
        {showNew && location === '/' && <button type="button" className="new-keepers-pill rise-in" onClick={top} data-testid="button-new-keepers"><Plus size={14} /> 3 new keepers</button>}
        <header className="topbar">
          {location !== '/' && <Link href="/" className="back-button heimdall-focus" aria-label="Back to home" data-testid="link-back-home"><ArrowLeft size={19} /></Link>}
      <div><h1>{title}</h1></div>
          <button type="button" className={`refresh-button ${refreshing ? 'refreshing' : ''}`} onClick={refresh} aria-label={onGoals ? 'Refresh goals' : 'Refresh feed'} data-testid="button-refresh"><LoaderCircle size={18} /></button>
        </header>
        {children}
        <div className="mobile-spacer" />
      </main>
      <RightRail />
      <nav className="mobile-tabs" aria-label="Mobile navigation">
        <Link href="/" className={`mobile-tab ${location === '/' ? 'active' : ''}`} aria-label="Home" data-testid="mobile-home"><HomeIcon size={21} /></Link>
        <button type="button" className="mobile-tab" aria-label="Search" data-testid="mobile-search"><Search size={21} /></button>
          <button type="button" className="mobile-tab" aria-label="Alerts disabled" disabled data-testid="mobile-alerts"><Bell size={21} /></button>
          <button type="button" className="mobile-tab" aria-label="Bookmarks disabled" disabled data-testid="mobile-bookmarks"><Bookmark size={21} /></button>
        <Link href="/goals" className={`mobile-tab mobile-tab-goals ${onGoals ? 'active' : ''}`} aria-label="Goals" data-testid="mobile-goals"><Target size={21} /><span>Goals</span></Link>
      </nav>
    </div>
  );
}

export function Composer({ onPost }: { onPost: (text: string) => void }) {
  const [text, setText] = useState('');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!text.trim() || text.length > 280) return;
    onPost(text.trim());
    setText('');
  };
  return (
    <form className="composer" onSubmit={submit}>
      <Avatar author={{ name: 'Gagan Gehani', handle: 'GaganGehani', avatar: gaganAvatar, verified: true }} />
      <div className="composer-body">
      <textarea id="composer-input" value={text} onChange={(event) => setText(event.target.value)} placeholder="What's happening?" maxLength={300} aria-label="Compose a post" data-testid="input-composer" />
        <div className="composer-footer">
          <div className="composer-tools"><button type="button" aria-label="Add image" data-testid="button-add-image"><ImageIcon size={17} /></button><button type="button" aria-label="Add link" data-testid="button-add-link"><Link2 size={17} /></button></div>
          <div className="composer-meta"><span className={text.length > 280 ? 'count-over' : ''}>{text.length}/280</span><button type="submit" disabled={!text.trim() || text.length > 280} className="post-submit" data-testid="button-submit-post">Post</button></div>
        </div>
      </div>
    </form>
  );
}

export function FeedView({ posts, onPost, state, onToggle, onOpen }: { posts: Post[]; onPost: (text: string) => void; state: LocalState; onToggle: (id: string, key: 'liked' | 'reposted' | 'bookmarked') => void; onOpen: (id: string) => void }) {
  const [selected, setSelected] = useState(0);
  const postRefs = useRef<Record<string, HTMLElement | null>>({});
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.key === 'j') setSelected((current) => Math.min(current + 1, posts.length - 1));
      if (event.key === 'k') setSelected((current) => Math.max(current - 1, 0));
      if (event.key === 'Enter' && posts[selected]) onOpen(posts[selected].id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [posts, selected, onOpen]);
  useEffect(() => { postRefs.current[posts[selected]?.id ?? '']?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, [selected, posts]);
  return (
    <>
      <Composer onPost={onPost} />
      <div className="post-list">
        {posts.map((post, index) => <div key={post.id} ref={(element) => { postRefs.current[post.id] = element; }}><PostCard post={post} state={state[post.id]} onToggle={onToggle} onOpen={onOpen} index={index} selected={index === selected} /></div>)}
      </div>
      <div className="feed-end" data-testid="status-feed-end"><div className="end-rule"><LogoMark small /></div><strong>You're done.</strong><span>Nothing else earned a slot tonight.</span></div>
      <div className="keyboard-hint"><kbd>j</kbd><kbd>k</kbd> move <kbd>Enter</kbd> open</div>
    </>
  );
}

export function DetailView({ post, state, onToggle }: { post: Post; state?: LocalState[string]; onToggle: (id: string, key: 'liked' | 'reposted' | 'bookmarked') => void }) {
  return (
    <div className="detail-view">
      <PostCard post={post} state={state} onToggle={onToggle} onOpen={() => undefined} />
      <div className="thread-label">Thread <span>1 post</span></div>
      <div className="thread-placeholder"><div className="thread-line" /><Avatar author={{ name: 'Gagan Gehani', handle: 'GaganGehani', avatar: gaganAvatar, verified: true }} size="sm" /><span>Replies are quiet here by design.</span></div>
    </div>
  );
}