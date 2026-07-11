'use client';

export default function Footer() {
  return (
    <footer className="bg-surface-container-lowest text-on-surface py-20 px-container-mobile md:px-container-desktop border-t border-outline-variant pb-32">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
        {/* Col 1 */}
        <div className="col-span-1 md:col-span-1">
          <h3 className="font-serif italic text-3xl text-primary mb-6">Hau Hau.</h3>
          <p className="text-base text-on-surface-variant leading-relaxed font-sans max-w-xs">
            Your escape from the heat. 
            Engineered to feel like a resort hidden next to campus.
          </p>
        </div>

        {/* Col 2 */}
        <div>
          <h4 className="font-mono text-xs uppercase tracking-widest text-outline mb-6">Quick Links</h4>
          <ul className="space-y-4 text-sm font-medium">
            <li><a href="#" className="hover:text-primary transition-colors">Menu</a></li>
            <li><a href="#" className="hover:text-primary transition-colors">Rewards</a></li>
            <li><a href="#" className="hover:text-primary transition-colors">Track Order</a></li>
          </ul>
        </div>

        {/* Col 3 */}
        <div>
          <h4 className="font-mono text-xs uppercase tracking-widest text-outline mb-6">Visit Us</h4>
          <ul className="space-y-4 text-sm text-on-surface-variant">
            <li>Open Daily: 11:00 AM - 1:00 AM</li>
            <li>
              <a href="#" className="text-on-surface hover:text-primary underline decoration-outline-variant underline-offset-4 transition-colors">
                View on Google Maps
              </a>
            </li>
          </ul>
        </div>

        {/* Col 4 */}
        <div>
          <h4 className="font-mono text-xs uppercase tracking-widest text-outline mb-6">Contact</h4>
          <a 
            href="#" 
            className="inline-flex items-center gap-2 px-6 py-3 bg-surface border border-outline-variant rounded-full text-sm font-medium hover:bg-surface-bright hover:border-outline hover:text-primary transition-all"
          >
            Chat on WhatsApp
          </a>
        </div>
      </div>

      <div className="max-w-7xl mx-auto pt-8 border-t border-outline-variant flex flex-col md:flex-row items-center justify-between gap-4 text-xs font-mono text-on-surface-variant">
        <p>© {new Date().getFullYear()} HAU HAU CAFE</p>
        <p className="text-center md:text-right">
          BUILT FOR STUDENTS.
        </p>
      </div>
    </footer>
  );
}
