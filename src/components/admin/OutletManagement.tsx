'use client';

import { useState, useEffect } from 'react';
import { LayoutGrid, Sparkles, MapPin, ClipboardList, Plus, Search, Trash2 } from 'lucide-react';
import { Outlet, Staff } from '@/lib/types';
import { fetchOutlets, fetchStaffList } from '@/lib/dbService';
import { secureSaveOutlet, secureDeleteOutlet } from '@/app/_actions/secureDbActions';
import TOTPModal from './TOTPModal';

interface HUDItem {
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'warning' | 'info';
}

import dynamic from 'next/dynamic';

const LocationPickerMap = dynamic(() => import('@/components/admin/LocationPickerMap'), { ssr: false });

export default function OutletManagement({ userRole = 'admin' }: { userRole?: 'admin' | 'owner' | 'manager' }) {
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [editingOutletId, setEditingOutletId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState('28.363'); // default BITS Pilani Lat
  const [lng, setLng] = useState('75.587'); // default BITS Pilani Lng
  const [hatches, setHatches] = useState(''); // Comma separated hatches
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [mapLink, setMapLink] = useState('');
  const [isParsingLink, setIsParsingLink] = useState(false);

  // AI HUD State
  const [hudItems, setHudItems] = useState<HUDItem[]>([]);
  const [loadingHud, setLoadingHud] = useState(false);
  const [currentUserUid, setCurrentUserUid] = useState<string | null>(null);

  // TOTP Security State
  type PendingOutletAction = 
    | { type: 'add_outlet'; outlet: Outlet }
    | { type: 'delete_outlet'; id: string }
    | null;
  const [pendingAction, setPendingAction] = useState<PendingOutletAction>(null);

  useEffect(() => {
    import('@/lib/firebase').then(({ auth }) => {
      import('firebase/auth').then(({ onAuthStateChanged }) => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
          if (user) {
            setCurrentUserUid(user.uid);
            loadOutlets();
            fetchAIInsights();
          } else {
            // Still try to load outlets even if unauthenticated, 
            // the error state will catch 'Missing or insufficient permissions'.
            loadOutlets();
          }
        });
        return () => unsubscribe();
      });
    });
  }, []);

  const fetchAIInsights = async () => {
    setLoadingHud(true);
    try {
      const res = await fetch('/api/admin/morning-hud');
      const data = await res.json();
      if (data.tasks) {
        setHudItems(data.tasks);
      }
    } catch (e) {
      console.error("Failed to fetch HUD", e);
    } finally {
      setLoadingHud(false);
    }
  };

  const loadOutlets = async () => {
    setLoading(true);
    try {
      const data = await fetchOutlets();
      setOutlets(data);
      const sData = await fetchStaffList();
      setStaffList(sData);
    } catch (err: any) {
      setError(err.message || 'Failed to load outlets.');
    } finally {
      setLoading(false);
    }
  };

  const handleAutoFind = async () => {
    if (!address) {
      setError("Please enter an address first.");
      return;
    }
    setIsGeocoding(true);
    setError(null);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`);
      const data = await res.json();
      if (data && data.length > 0) {
        setLat(data[0].lat);
        setLng(data[0].lon);
      } else {
        setError("Could not find coordinates for this address.");
      }
    } catch (err) {
      setError("Geocoding failed. You may need to enter coordinates manually.");
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleAutoFetchLocation = () => {
    if (!('geolocation' in navigator)) {
      setError("Geolocation is not supported by your browser.");
      return;
    }
    setIsGeocoding(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const newLat = position.coords.latitude;
        const newLng = position.coords.longitude;
        setLat(newLat.toFixed(6));
        setLng(newLng.toFixed(6));
        
        // Reverse geocode to get address
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${newLat}&lon=${newLng}`);
          const data = await res.json();
          if (data && data.display_name) {
            setAddress(data.display_name);
          }
        } catch (err) {
          console.error("Reverse geocoding failed", err);
        } finally {
          setIsGeocoding(false);
        }
      },
      (error) => {
        setError("Failed to retrieve location: " + error.message);
        setIsGeocoding(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleParseMapLink = async () => {
    if (!mapLink) return;
    setIsParsingLink(true);
    setError(null);
    try {
      const res = await fetch(`/api/expand-map-link?url=${encodeURIComponent(mapLink)}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to parse link');
      }
      
      setLat(data.lat.toFixed(6));
      setLng(data.lng.toFixed(6));
      
      // Auto reverse geocode
      try {
        const reverseRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${data.lat}&lon=${data.lng}`);
        const reverseData = await reverseRes.json();
        if (reverseData && reverseData.display_name) {
          setAddress(reverseData.display_name);
        }
      } catch (e) {
        console.error("Reverse geocoding failed", e);
      }

      setMapLink(''); // clear after success
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsParsingLink(false);
    }
  };

  const handleMapChange = (newLat: number, newLng: number, newAddress?: string) => {
    setLat(newLat.toFixed(6));
    setLng(newLng.toFixed(6));
    if (newAddress) {
      setAddress(newAddress);
    }
  };

  const handleAddOutlet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !address || !lat || !lng) {
      setError("Please fill all fields, including placing a map pin.");
      return;
    }
    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);
    if (isNaN(parsedLat) || isNaN(parsedLng)) {
      setError("Latitude and Longitude must be valid numbers.");
      return;
    }

    setError(null);
    const existing = outlets.find(o => o.id === editingOutletId);
    
    const newOutlet: Outlet = {
      id: editingOutletId || `out_${Date.now()}`,
      name,
      address,
      latitude: parsedLat,
      longitude: parsedLng,
      status: existing?.status || 'active',
      hatches: hatches ? hatches.split(',').map(h => h.trim()).filter(h => h) : [],
      created_at: existing?.created_at || Date.now()
    };

    // Strip any possible undefined values that Next.js Server Actions hate
    const safeOutlet = JSON.parse(JSON.stringify(newOutlet));

    setPendingAction({ type: 'add_outlet', outlet: safeOutlet });
  };

  const handleEdit = (outlet: Outlet) => {
    setEditingOutletId(outlet.id);
    setName(outlet.name);
    setAddress(outlet.address);
    setLat(outlet.latitude.toString());
    setLng(outlet.longitude.toString());
    setHatches(outlet.hatches ? outlet.hatches.join(', ') : '');
    setMapLink('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = (id: string) => {
    setPendingAction({ type: 'delete_outlet', id });
  };

  const executeSecureAction = async (totpCode: string) => {
    if (!pendingAction) return;
    setError(null);

    try {
      if (pendingAction.type === 'add_outlet') {
        await secureSaveOutlet(pendingAction.outlet, totpCode);
        await loadOutlets();
        setEditingOutletId(null);
        setName('');
        setAddress('');
        setHatches('');
      } else if (pendingAction.type === 'delete_outlet') {
        await secureDeleteOutlet(pendingAction.id, totpCode);
        await loadOutlets();
      }
    } catch (err: any) {
      console.error("Secure action failed:", err);
      throw err;
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-[#f7dec4]">
      {/* Outlets configuration and queue counts */}
      <div className="lg:col-span-2 flex flex-col gap-6">
        
        <div className="bg-[#120a06]/40 backdrop-blur-xl border border-[#302117] rounded-3xl p-6 flex flex-col gap-4">
          <div className="flex justify-between items-center border-b border-[#302117]/60 pb-3">
            <div>
              <h2 className="font-serif italic text-2xl text-white">Outlet Management</h2>
              <p className="text-xs font-mono text-[#d4c4b0]/50 uppercase tracking-widest mt-0.5">Physical Locations & Telemetry</p>
            </div>
            <span className="bg-[#302117]/50 text-[#f8bc51] px-3 py-1.5 rounded-full border border-[#302117] font-mono text-[10px] flex items-center gap-1.5">
              <LayoutGrid size={12} />
              {outlets.length} Registered Outlets
            </span>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-300 rounded-xl p-3 text-xs font-mono">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {outlets
              .filter(outlet => {
                if (userRole !== 'manager') return true;
                const me = staffList.find(s => s.id === currentUserUid);
                return outlet.name === me?.outlet;
              })
              .map((outlet) => {
              const manager = staffList.find(s => s.outlet === outlet.name && s.role === 'manager');
              return (
              <div
                key={outlet.id}
                className={`bg-[#070402]/30 border ${editingOutletId === outlet.id ? 'border-[#f8bc51]' : 'border-[#302117] hover:border-[#f8bc51]/40'} rounded-2xl p-4 flex flex-col gap-4 transition-colors duration-500 relative`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin size={15} className="text-[#f8bc51]" />
                    <h4 className="font-serif italic text-base text-white font-bold">{outlet.name}</h4>
                  </div>
                  <span className={`w-1.5 h-1.5 rounded-full ${outlet.status === 'active' ? 'bg-[#10B981] shadow-[0_0_8px_#10B981]' : 'bg-[#d4c4b0]/30'}`} />
                </div>

                <div className="bg-[#070402] border border-[#302117]/50 p-3 rounded-xl font-mono">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[#d4c4b0]/40 text-[8px] uppercase tracking-wider">Address</p>
                    <p className="text-[#d4c4b0]/40 text-[8px] uppercase tracking-wider text-right">Manager: 
                      {manager ? (
                        <button 
                          onClick={() => window.location.href = `?tab=staff&open_staff=${manager.id}`}
                          className="text-[#f8bc51] hover:text-[#ffce7b] hover:underline ml-1 font-bold transition-colors cursor-pointer"
                        >
                          {manager.name} ({manager.employee_id || 'N/A'})
                        </button>
                      ) : (
                        <span className="text-[#f8bc51] ml-1">Nill</span>
                      )}
                    </p>
                  </div>
                  <p className="text-[#d4c4b0] text-[10px] leading-relaxed truncate">{outlet.address}</p>
                  <div className="flex gap-4 mt-2 border-t border-[#302117]/30 pt-2">
                    <div>
                      <span className="text-[#d4c4b0]/40 text-[8px] uppercase tracking-wider">Lat: </span>
                      <span className="text-[#f8bc51] text-[9px]">{outlet.latitude.toFixed(4)}</span>
                    </div>
                    <div>
                      <span className="text-[#d4c4b0]/40 text-[8px] uppercase tracking-wider">Lng: </span>
                      <span className="text-[#f8bc51] text-[9px]">{outlet.longitude.toFixed(4)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-1 gap-2">
                  <button onClick={() => handleEdit(outlet)} className="text-[#f8bc51]/70 hover:text-[#f8bc51] text-[10px] uppercase font-mono tracking-wider transition-colors px-2">
                    Edit
                  </button>
                  {userRole !== 'manager' && (
                    <button onClick={() => handleDelete(outlet.id)} className="text-red-400 hover:text-red-300 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
              );
            })}
            
            {outlets.length === 0 && !loading && (
              <div className="md:col-span-2 border border-dashed border-[#302117] bg-[#070402]/20 rounded-2xl p-8 text-center flex flex-col items-center gap-3">
                 <MapPin size={24} className="text-[#d4c4b0]/30" />
                 <p className="text-white text-sm font-semibold">No Outlets Registered</p>
                 <p className="text-xs text-[#d4c4b0]/50 max-w-xs mx-auto leading-relaxed">Add your first physical cafe outlet below to enable location-aware inventory and weather forecasting.</p>
              </div>
            )}
          </div>
        </div>

        {/* Add/Edit Outlet Form */}
        {(userRole !== 'manager' || editingOutletId) && (
          <div className="bg-[#120a06]/40 backdrop-blur-xl border border-[#f8bc51]/20 rounded-3xl p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-[#302117]/60 pb-2">
              <div>
                <h3 className="font-serif italic text-lg text-[#f8bc51]">{editingOutletId ? 'Edit Outlet Details' : 'Register New Outlet'}</h3>
              <p className="text-xs font-mono text-[#d4c4b0]/50 uppercase tracking-widest mt-0.5">{editingOutletId ? 'Update location boundaries' : 'Define location boundaries'}</p>
            </div>
            <Sparkles size={14} className="text-[#f8bc51]" />
          </div>

          <form onSubmit={handleAddOutlet} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-mono uppercase tracking-wider text-[#d4c4b0]/70">Outlet Name</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. Oasis Canopy Hub" className="bg-[#070402] border border-[#302117] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#f8bc51] transition-colors" />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-mono uppercase tracking-wider text-[#d4c4b0]/70">Full Address</label>
              <input type="text" value={address} onChange={e => setAddress(e.target.value)} required placeholder="Search on the map to auto-fill..." className="bg-[#070402] border border-[#302117] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#f8bc51] transition-colors flex-1" />
            </div>
            
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-mono uppercase tracking-wider text-[#d4c4b0]/70">Google Maps Link (Optional)</label>
              <div className="flex gap-2">
                <input 
                  type="url" 
                  value={mapLink} 
                  onChange={e => setMapLink(e.target.value)} 
                  placeholder="https://maps.app.goo.gl/..." 
                  className="bg-[#070402] border border-[#302117] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#f8bc51] transition-colors flex-1" 
                />
                <button 
                  type="button" 
                  onClick={handleParseMapLink}
                  disabled={isParsingLink || !mapLink}
                  className="bg-[#302117]/50 hover:bg-[#f8bc51]/20 text-[#f8bc51] border border-[#302117] hover:border-[#f8bc51]/50 px-4 py-2.5 rounded-xl font-mono text-xs uppercase tracking-wider transition-all disabled:opacity-50 flex items-center justify-center min-w-[80px]"
                >
                  {isParsingLink ? 'Parsing...' : 'Sync Pin'}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2 mt-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-mono uppercase tracking-wider text-[#d4c4b0]/70">Interactive Location Picker</label>
                <button 
                  type="button"
                  onClick={handleAutoFetchLocation}
                  disabled={isGeocoding}
                  className="text-[10px] font-mono text-[#f8bc51] hover:text-[#ffce7b] flex items-center gap-1 uppercase tracking-wider disabled:opacity-50 transition-colors"
                >
                  <MapPin size={10} />
                  {isGeocoding ? 'Locating...' : 'Use My Location'}
                </button>
              </div>
              <LocationPickerMap lat={parseFloat(lat) || 28.363} lng={parseFloat(lng) || 75.587} onChange={handleMapChange} />
              <p className="text-[9px] text-[#d4c4b0]/50 font-mono">Use the map's search icon or click anywhere to drop a pin.</p>
            </div>

            <div className="flex flex-col gap-1.5 mt-2">
              <label className="text-[10px] font-mono uppercase tracking-wider text-[#d4c4b0]/70">Hatches / Pickup Points (Comma Separated)</label>
              <input type="text" value={hatches} onChange={e => setHatches(e.target.value)} placeholder="e.g. OASIS, SMOKING, MAIN" className="bg-[#070402] border border-[#302117] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#f8bc51] transition-colors" />
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-mono uppercase tracking-wider text-[#d4c4b0]/70">Latitude</label>
                <input type="number" step="any" value={lat} onChange={e => setLat(e.target.value)} required placeholder="28.363" className="bg-[#070402] border border-[#302117] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#f8bc51] transition-colors" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-mono uppercase tracking-wider text-[#d4c4b0]/70">Longitude</label>
                <input type="number" step="any" value={lng} onChange={e => setLng(e.target.value)} required placeholder="75.587" className="bg-[#070402] border border-[#302117] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#f8bc51] transition-colors" />
              </div>
            </div>

            <div className="flex gap-3 mt-2">
              <button type="submit" className="flex-1 bg-[#f8bc51] hover:bg-[#ffce7b] text-[#0A0604] py-3 rounded-xl font-mono font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all">
                <Plus size={14} /> {editingOutletId ? 'Update Physical Outlet' : 'Register Physical Outlet'}
              </button>
              {editingOutletId && (
                <button 
                  type="button" 
                  onClick={() => { setEditingOutletId(null); setName(''); setAddress(''); setHatches(''); setMapLink(''); }}
                  className="bg-[#302117]/40 hover:bg-[#302117] text-[#d4c4b0] py-3 px-6 rounded-xl font-mono font-bold text-xs uppercase tracking-widest transition-all border border-[#302117]"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>
        )}

      </div>

      {/* Right Column - AI Morning Action HUD */}
      <div>
        <div className="bg-[#120a06]/40 backdrop-blur-xl border border-[#302117] rounded-3xl p-6 flex flex-col gap-4 relative overflow-hidden">
          {/* Glowing back mesh */}
          <div className="absolute top-[-30%] right-[-20%] w-48 h-48 bg-[#f8bc51]/5 rounded-full filter blur-xl" />

          <div className="flex items-center justify-between border-b border-[#302117]/60 pb-3">
            <div className="flex items-center gap-2">
              <ClipboardList size={16} className="text-[#f8bc51]" />
              <h3 className="font-serif italic text-lg text-white">Morning HUD Checklist</h3>
            </div>
            <button 
              onClick={fetchAIInsights} 
              disabled={loadingHud} 
              className={`text-[#f8bc51] hover:text-[#ffce7b] transition-colors p-1 rounded-full ${loadingHud ? 'animate-spin' : ''}`}
              title="Refresh AI Insights"
            >
              <Sparkles size={14} />
            </button>
          </div>

          <div className="flex flex-col gap-4 mt-2">
            {loadingHud ? (
              // Skeleton loaders
              [1,2,3].map(i => (
                <div key={i} className="bg-[#302117]/20 border border-[#302117]/40 rounded-2xl p-4 animate-pulse flex items-start gap-3">
                  <div className="w-5 h-5 bg-[#302117]/50 rounded mt-0.5" />
                  <div className="flex-1">
                    <div className="h-4 w-32 bg-[#302117]/80 rounded mb-2"></div>
                    <div className="h-8 w-full bg-[#302117]/50 rounded"></div>
                  </div>
                </div>
              ))
            ) : hudItems.length > 0 ? (
              hudItems.map((task, idx) => {
                const isCrit = task.severity === 'critical';
                const isWarn = task.severity === 'warning';
                
                const colorCode = isCrit ? '#e8621a' : (isWarn ? '#f8bc51' : '#d4c4b0');
                const bgClass = isCrit ? 'bg-[#e8621a]/5 border-[#e8621a]/20' : (isWarn ? 'bg-[#f8bc51]/5 border-[#f8bc51]/20' : 'bg-[#302117]/40 border-[#302117]/85');

                return (
                  <div key={idx} className={`${bgClass} border rounded-2xl p-4 transition-colors`}>
                    <div className="flex items-start gap-2.5">
                      <span className="font-mono text-sm font-bold" style={{ color: colorCode }}>{task.id}</span>
                      <div>
                        <h5 className="font-serif italic text-sm text-white font-bold">{task.title}</h5>
                        <p className="text-[10px] text-[#d4c4b0]/70 mt-1 leading-relaxed">
                          {task.description}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-6">
                <p className="text-xs text-[#d4c4b0]/50 font-mono">No insights generated yet.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <TOTPModal
        isOpen={!!pendingAction}
        onClose={() => setPendingAction(null)}
        onVerify={executeSecureAction}
        title={pendingAction?.type === 'delete_outlet' ? "Delete Outlet" : "Register Outlet"}
        description="Please enter your Google Authenticator code to authorize this action."
      />
    </div>
  );
}
