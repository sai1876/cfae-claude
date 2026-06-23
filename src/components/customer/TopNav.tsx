import Link from 'next/link';

export default function TopNav() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/60 backdrop-blur-xl border-b border-foreground/5">
      <div className="max-w-7xl mx-auto px-6 md:px-[80px] h-20 flex items-center justify-between">
        <Link href="/" className="font-serif italic text-2xl text-primary tracking-wide">
          Hau Hau.
        </Link>
        <div className="hidden md:flex items-center space-x-12 text-sm font-mono uppercase tracking-widest text-on-surface">
          <Link href="/menu" className="hover:text-primary transition-colors">Menu</Link>
          <Link href="/about" className="hover:text-primary transition-colors">Story</Link>
          <Link href="/locations" className="hover:text-primary transition-colors">Sanctuaries</Link>
        </div>
      </div>
    </nav>
  );
}
