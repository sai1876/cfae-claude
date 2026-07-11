'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import './CinematicScroller.css';

interface CinematicScrollerProps {
  onComplete: () => void;
}

import { fetchOutlets } from '@/lib/dbService';
import { Outlet } from '@/lib/types';

// Fallback coordinates if no outlets found
const FALLBACK_COORDS = {
  lat: 12.971598,
  lng: 77.594562,
};

// Premium SVG Icons
const BikeIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="5.5" cy="17.5" r="3.5" />
    <circle cx="18.5" cy="17.5" r="3.5" />
    <path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-3 11.5V14l-3-3 4-3 2 3h2" />
  </svg>
);

const CarIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
    <circle cx="7" cy="17" r="2" />
    <circle cx="17" cy="17" r="2" />
  </svg>
);

const MapPinIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

const CompassIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
  </svg>
);

export default function CinematicScroller({ onComplete }: CinematicScrollerProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [particles, setParticles] = useState<{ id: number; left: number; height: number; delay: number; duration: number }[]>([]);

  // Geolocation & travel estimation states
  const [locationStatus, setLocationStatus] = useState<'prompting' | 'calculating' | 'success' | 'failed'>('prompting');
  const [distance, setDistance] = useState<number | null>(null); // in km
  const [duration, setDuration] = useState<number | null>(null); // in minutes
  const [transitMode, setTransitMode] = useState<'bike' | 'car' | null>(null);
  const [nearestOutlet, setNearestOutlet] = useState<Outlet | null>(null);

  // 3D Card Hover Perspective tracking for Geolocation Card
  const locatorMouseX = useMotionValue(0);
  const locatorMouseY = useMotionValue(0);

  const locatorRotateX = useTransform(locatorMouseY, [-150, 150], [6, -6]);
  const locatorRotateY = useTransform(locatorMouseX, [-150, 150], [-6, 6]);

  const handleLocatorMouseMove = (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    const card = event.currentTarget.getBoundingClientRect();
    const width = card.width;
    const height = card.height;
    const x = event.clientX - card.left - width / 2;
    const y = event.clientY - card.top - height / 2;
    locatorMouseX.set(x);
    locatorMouseY.set(y);
  };

  const handleLocatorMouseLeave = () => {
    locatorMouseX.set(0);
    locatorMouseY.set(0);
  };

  // Generate interactive bubble vertical trails
  useEffect(() => {
    const list = Array.from({ length: 18 }, (_, i) => ({
      id: i,
      left: Math.random() * 95,
      height: Math.random() * 120 + 40,
      delay: Math.random() * 5,
      duration: Math.random() * 5 + 6,
    }));
    setParticles(list);
  }, []);

  // Request client browser geolocation
  const triggerGeolocation = async () => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setLocationStatus('failed');
      return;
    }

    setLocationStatus('calculating');
    
    // Fetch active outlets
    let activeOutlets: Outlet[] = [];
    try {
      activeOutlets = await fetchOutlets();
      activeOutlets = activeOutlets.filter(o => o.status === 'active');
    } catch (e) {
      console.error('Failed to fetch outlets', e);
    }

    const options = {
      enableHighAccuracy: false, // Set to false to drastically speed up location fetching
      timeout: 5000,
      maximumAge: Infinity, // Use cached location if available for instant load
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;

        const R = 6371; // Earth's radius in km
        let minDistance = Infinity;
        let closestOutlet: Outlet | null = null;
        
        // If no outlets, use fallback
        if (activeOutlets.length === 0) {
          activeOutlets = [{ id: 'fallback', name: 'Hau Hau Cafe', address: '', latitude: FALLBACK_COORDS.lat, longitude: FALLBACK_COORDS.lng, status: 'active', created_at: Date.now() }];
        }

        // Find nearest outlet
        for (const outlet of activeOutlets) {
          const dLat = ((outlet.latitude - latitude) * Math.PI) / 180;
          const dLon = ((outlet.longitude - longitude) * Math.PI) / 180;
          
          const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((latitude * Math.PI) / 180) *
              Math.cos((outlet.latitude * Math.PI) / 180) *
              Math.sin(dLon / 2) *
              Math.sin(dLon / 2);
          
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          const straightLineDist = R * c;
          
          if (straightLineDist < minDistance) {
            minDistance = straightLineDist;
            closestOutlet = outlet;
          }
        }

        // Apply a street-deviation multiplier (1.3) to represent real road patterns
        const roadDistance = minDistance * 1.3;
        setDistance(roadDistance);
        setNearestOutlet(closestOutlet);

        // Transit speed calculations:
        // Bike ~18 km/h -> time (minutes) = (dist / 18) * 60 = dist * 3.333
        // Car ~25 km/h -> time (minutes) = (dist / 25) * 60 = dist * 2.400
        const bikeTime = (roadDistance / 18) * 60;
        const carTime = (roadDistance / 25) * 60;

        // Determine the faster/preferred travel option
        const fasterMode: 'bike' | 'car' = carTime < bikeTime ? 'car' : 'bike';
        const transitTime = carTime < bikeTime ? carTime : bikeTime;

        setTransitMode(fasterMode);
        setDuration(transitTime);
        setLocationStatus('success');
      },
      (error) => {
        console.warn('Geolocation access failed or denied:', error);
        setLocationStatus('failed');
      },
      options
    );
  };

  useEffect(() => {
    triggerGeolocation();
  }, []);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const scrollTop = containerRef.current.scrollTop;
    const height = containerRef.current.clientHeight;
    if (height === 0) return;
    const index = Math.min(
      Math.round(scrollTop / height),
      3
    );
    if (index !== activeIndex) {
      setActiveIndex(index);
    }
  };

  const scrollToSection = (index: number) => {
    if (!containerRef.current) return;
    const height = containerRef.current.clientHeight;
    containerRef.current.scrollTo({
      top: index * height,
      behavior: 'smooth',
    });
  };

  // Get dynamic headline for slide 3 based on 10-minute threshold rules
  const getSlide3Headline = () => {
    if (locationStatus === 'prompting') {
      return 'Finding your fastest escape route...';
    }
    if (locationStatus === 'calculating') {
      return 'Consulting campus transit channels...';
    }
    if (locationStatus === 'success' && duration !== null && distance !== null) {
      if (duration <= 10) {
        return `Your escape from the heat is ${Math.round(duration)} minutes away.`;
      } else {
        return `Your escape from the heat is ${distance.toFixed(1)} km away.`;
      }
    }
    return 'Your escape from the heat is minutes away.';
  };

  // Build the slides array dynamically to incorporate state values
  const slides = [
    {
      tag: 'THE CAMPUS ESCAPE',
      headline: 'Step out of it.',
      desc: 'Whisper to the winds, leave the heat behind. Nestled close to classrooms, our green garden sanctuary is ready to revive your senses.',
      bgClass: 'section-step-out',
      textColor: '#ffffff',
    },
    {
      tag: 'THE TEMPERATURE DROP',
      headline: 'The heat stops here.',
      desc: 'Mist-cooling, fresh foliage, and chilled vibes. Find the ultimate comfort under the canopy where stress evaporates instantly.',
      bgClass: 'section-heat-stops',
      textColor: '#ffffff',
    },
    {
      tag: 'FAST RELIEF',
      headline: getSlide3Headline(),
      desc: 'Lightning fast ordering and instant table reservation means you go from the blazing sun to icy cold sips in no time.',
      bgClass: 'section-escape-time',
      textColor: '#121212',
    },
    {
      tag: 'WELCOME TO HAU HAU',
      headline: 'A resort engineered for you.',
      desc: 'Ready to immerse your senses in absolute culinary tranquility? Enter the oasis.',
      bgClass: 'section-enter-platform',
      textColor: '#ffffff',
    }
  ];

  return (
    <div className="cinematic-scroller-root">
      <div 
        className="cinematic-scroller-container" 
        ref={containerRef}
        onScroll={handleScroll}
      >
        {slides.map((slide, idx) => (
          <section 
            key={idx} 
            className={`cinematic-section ${slide.bgClass}`}
            style={{ color: slide.textColor }}
          >
            {/* EV-Style Cyber-Coordinate Grid on Slide 3 */}
            {idx === 2 && (
              <div className="cyber-coordinate-grid">
                <div className="grid-lines" />
                <div className="scanline" />
                <div className="glowing-crosshairs" />
                <div className="hud-corner top-left" />
                <div className="hud-corner top-right" />
                <div className="hud-corner bottom-left" />
                <div className="hud-corner bottom-right" />
                <div className="coordinate-readout font-mono">
                  SYS.LOC {"//"} LAT {nearestOutlet?.latitude ?? FALLBACK_COORDS.lat} {"//"} LNG {nearestOutlet?.longitude ?? FALLBACK_COORDS.lng}
                </div>
              </div>
            )}

            {/* Interactive rising atmospheric mist bars */}
            <div className="cinematic-particles">
              {particles.map((p) => (
                <div 
                  key={p.id}
                  className="cinematic-particle-bar"
                  style={{
                    left: `${p.left}%`,
                    height: `${p.height}px`,
                    animationDelay: `${p.delay}s`,
                    animationDuration: `${p.duration}s`,
                  }}
                />
              ))}
            </div>

            <div className="cinematic-content">
              {activeIndex === idx && (
                <>
                  <motion.div 
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 0.8, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="cinematic-tag"
                  >
                    {slide.tag}
                  </motion.div>

                  <motion.h1 
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, delay: 0.2 }}
                    className="cinematic-headline"
                  >
                    {slide.headline}
                  </motion.h1>

                  <motion.p 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 0.85, y: 0 }}
                    transition={{ duration: 0.7, delay: 0.4 }}
                    className="cinematic-desc"
                  >
                    {slide.desc}
                  </motion.p>

                  {/* Render the premium interactive locator card for Slide 3 */}
                  {idx === 2 && (
                    <motion.div
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.8, delay: 0.6 }}
                      className="w-full max-w-md mx-auto"
                    >
                      <motion.div
                        className="premium-locator-card"
                        onMouseMove={handleLocatorMouseMove}
                        onMouseLeave={handleLocatorMouseLeave}
                        style={{
                          rotateX: locatorRotateX,
                          rotateY: locatorRotateY,
                          transformStyle: 'preserve-3d',
                        }}
                      >
                        <AnimatePresence mode="wait">
                          {(locationStatus === 'prompting' || locationStatus === 'calculating') && (
                            <motion.div
                              key="calculating"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="flex flex-col items-center justify-center p-6 text-center gap-4"
                              style={{ transform: 'translateZ(30px)' }}
                            >
                              <div className="radar-container">
                                <div className="radar-ping" />
                                <div className="radar-ring-1" />
                                <div className="radar-ring-2" />
                                <div className="radar-icon-wrapper">
                                  <CompassIcon />
                                </div>
                              </div>
                              <span className="locator-status-text font-mono">
                                {locationStatus === 'prompting' 
                                  ? 'Awaiting location permission...' 
                                  : 'Triangulating campus coordinate grid...'}
                              </span>
                            </motion.div>
                          )}

                          {locationStatus === 'success' && duration !== null && distance !== null && (
                            <motion.div
                              key="success"
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0 }}
                              className="flex flex-col p-6 gap-6"
                              style={{ transform: 'translateZ(35px)' }}
                            >
                              <div className="flex items-center justify-between w-full gap-4">
                                <div className="location-node-badge user-badge animate-pulse">
                                  <div className="node-dot bg-forest" />
                                  <span>You</span>
                                </div>

                                <div className="flex-1 relative flex items-center justify-center px-4">
                                  <svg className="path-line-svg" width="100%" height="24">
                                    <line 
                                      x1="0" 
                                      y1="12" 
                                      x2="100%" 
                                      y2="12" 
                                      className="path-line-bg" 
                                    />
                                    <line 
                                      x1="0" 
                                      y1="12" 
                                      x2="100%" 
                                      y2="12" 
                                      className="path-line-active" 
                                    />
                                  </svg>
                                  <div className="transit-mode-pulsar bg-charcoal text-white">
                                    {transitMode === 'bike' ? <BikeIcon /> : <CarIcon />}
                                  </div>
                                </div>

                                <div className="location-node-badge brand-badge">
                                  <div className="node-dot bg-gold" />
                                  <span>{nearestOutlet?.name || 'Hau Hau Cafe'}</span>
                                </div>
                              </div>

                              <div className="flex justify-around items-center border-t border-black/5 pt-4">
                                <div className="flex flex-col items-center">
                                  <span className="metric-label">Estimated Transit</span>
                                  <span className="metric-value font-syne text-charcoal">
                                    {duration <= 10 ? `${Math.round(duration)} min` : `${distance.toFixed(1)} km`}
                                  </span>
                                </div>
                                <div className="h-8 w-px bg-black/10" />
                                <div className="flex flex-col items-center">
                                  <span className="metric-label">Travel Speed</span>
                                  <span className="metric-value font-syne text-charcoal">
                                    {transitMode === 'bike' ? '18 km/h' : '25 km/h'}
                                  </span>
                                </div>
                                <div className="h-8 w-px bg-black/10" />
                                <div className="flex flex-col items-center">
                                  <span className="metric-label">Transport</span>
                                  <span className="metric-value font-syne text-charcoal capitalize">
                                    {transitMode === 'bike' ? 'Bike' : 'Car'}
                                  </span>
                                </div>
                              </div>
                            </motion.div>
                          )}

                          {locationStatus === 'failed' && (
                            <motion.div
                              key="failed"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="flex flex-col items-center justify-center p-6 text-center gap-4"
                              style={{ transform: 'translateZ(30px)' }}
                            >
                              <div className="fallback-icon-wrapper">
                                <MapPinIcon />
                              </div>
                              <div className="flex flex-col gap-1">
                                <span className="fallback-headline text-charcoal font-syne">Oasis Awaits</span>
                                <span className="fallback-desc text-black/60 text-sm font-sans">
                                  We are situated in the heart of campus. Fresh breeze & iced refreshments are ready.
                                </span>
                              </div>
                              <button 
                                onClick={triggerGeolocation}
                                className="locator-retry-btn"
                              >
                                Enable Location
                              </button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    </motion.div>
                  )}

                  {idx === slides.length - 1 && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.5, delay: 0.6 }}
                      className="enter-btn-wrapper"
                    >
                      <button 
                        className="cinematic-btn-primary"
                        onClick={onComplete}
                      >
                        ENTER PLATFORM MENU
                      </button>
                      <button 
                        className="cinematic-btn-secondary"
                        onClick={() => scrollToSection(0)}
                      >
                        ↑ Read intro again
                      </button>
                    </motion.div>
                  )}
                </>
              )}
            </div>

            {idx < slides.length - 1 && (
              <div className="scroller-bottom-hint">
                <span>SCROLL DOWN TO REFRESH</span>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M19 12l-7 7-7-7" />
                </svg>
              </div>
            )}
          </section>
        ))}
      </div>

      {/* Side Progress Dots Indicator */}
      <div className="cinematic-scroll-progress">
        {slides.map((_, idx) => (
          <div 
            key={idx} 
            className={`progress-dot ${activeIndex === idx ? 'active' : ''}`}
            onClick={() => scrollToSection(idx)}
          />
        ))}
      </div>
    </div>
  );
}
