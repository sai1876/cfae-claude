import React, { useState, useEffect } from 'react';
import { Staff, StaffShift } from '@/lib/types';
import { fetchStaffList } from '@/lib/dbService';
import { secureUpdateStaffSchedule } from '@/app/_actions/secureDbActions';
import { Calendar as CalendarIcon, Users, Clock, ShieldAlert, Plus, Trash2, ChevronRight, X } from 'lucide-react';

export default function ScheduleDashboard() {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [totpCode, setTotpCode] = useState('');
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [viewMode, setViewMode] = useState<'staff' | 'day'>('staff');
  const [loading, setLoading] = useState(true);

  // Staff View State
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);

  // Day View State
  const [selectedDay, setSelectedDay] = useState<string>('Monday');

  // New Shift Form State
  const [isAddingShift, setIsAddingShift] = useState(false);
  const [newShiftStaffId, setNewShiftStaffId] = useState('');
  const [newShiftDay, setNewShiftDay] = useState('Monday');
  const [newShiftDate, setNewShiftDate] = useState('');
  const [newShiftType, setNewShiftType] = useState('Morning Shift');
  const [newShiftStart, setNewShiftStart] = useState('08:00');
  const [newShiftEnd, setNewShiftEnd] = useState('16:00');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // Component unmounts when tab changes. When it mounts again, it starts locked.
    loadStaff();
  }, []);

  const loadStaff = async () => {
    setLoading(true);
    try {
      const staff = await fetchStaffList();
      setStaffList(staff);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Convert 24h to 12h AM/PM
  const formatTime = (timeStr: string) => {
    const [h, m] = timeStr.split(':');
    const hour = parseInt(h);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const formattedHour = hour % 12 || 12;
    return `${formattedHour.toString().padStart(2, '0')}:${m} ${ampm}`;
  };

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (totpCode.length === 6) {
      // Optimistically unlock. If a save fails later due to bad code, it will alert.
      setIsUnlocked(true);
    }
  };

  const handleAddShift = async () => {
    if (!newShiftDate) return alert("Please enter a date");
    if (!newShiftStaffId) return alert("Please select a staff member");

    setIsSaving(true);
    try {
      const staff = staffList.find(s => s.id === newShiftStaffId);
      if (!staff) throw new Error("Staff not found");

      let timeString = 'Off';
      if (newShiftType !== 'Day Off') {
        timeString = `${formatTime(newShiftStart)} - ${formatTime(newShiftEnd)}`;
      }

      const newShift: StaffShift = {
        id: `shift_${Date.now()}`,
        day: newShiftDay,
        date: newShiftDate,
        time: timeString,
        type: newShiftType
      };

      const updatedSchedule = [...(staff.schedule || []), newShift];
      await secureUpdateStaffSchedule(staff.id, updatedSchedule, totpCode);
      
      await loadStaff(); // Reload all staff to get new schedule
      setIsAddingShift(false);
      setNewShiftDate('');
    } catch (e: any) {
      console.error(e);
      alert(`Save failed: ${e.message}`);
      if (e.message.includes("Authenticator")) {
        setIsUnlocked(false);
        setTotpCode('');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveShift = async (staffId: string, shiftId: string) => {
    if (!confirm("Remove this shift?")) return;
    
    try {
      const staff = staffList.find(s => s.id === staffId);
      if (!staff) return;

      const updatedSchedule = (staff.schedule || []).filter(s => s.id !== shiftId);
      await secureUpdateStaffSchedule(staff.id, updatedSchedule, totpCode);
      await loadStaff();
    } catch (e: any) {
      console.error(e);
      alert(`Remove failed: ${e.message}`);
      if (e.message.includes("Authenticator")) {
        setIsUnlocked(false);
        setTotpCode('');
      }
    }
  };

  if (!isUnlocked) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full p-6">
        <form onSubmit={handleUnlock} className="bg-[#120a06]/80 backdrop-blur-xl border border-[#f8bc51]/40 rounded-3xl p-8 flex flex-col gap-6 max-w-md w-full">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-[#f8bc51]/10 rounded-full flex items-center justify-center text-[#f8bc51] mb-4 border border-[#f8bc51]/20">
              <ShieldAlert size={32} />
            </div>
            <h2 className="text-2xl font-serif italic text-white mb-2">Schedule Manager</h2>
            <p className="text-sm text-[#d4c4b0]/70 font-mono leading-relaxed">
              Master scheduling is protected. Enter your 6-digit Google Authenticator code to unlock the dashboard.
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <input
              type="text"
              required
              maxLength={6}
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              className="bg-[#070402] border border-[#f8bc51]/50 rounded-xl px-4 py-4 text-3xl text-center text-white focus:outline-none tracking-[0.5em] font-mono shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]"
            />
          </div>
          <button
            type="submit"
            disabled={totpCode.length !== 6}
            className="w-full bg-[#f8bc51] text-[#0A0604] font-bold uppercase tracking-widest text-sm py-4 rounded-xl disabled:opacity-50 hover:bg-[#ffce7b] transition-colors"
          >
            Unlock Dashboard
          </button>
        </form>
      </div>
    );
  }

  const selectedStaff = staffList.find(s => s.id === selectedStaffId);

  // Group shifts for Day View
  const shiftsForDay = staffList.flatMap(staff => {
    const shifts = (staff.schedule || []).filter(s => s.day === selectedDay);
    return shifts.map(shift => ({ ...shift, staff }));
  }).sort((a, b) => {
    // basic sort by time string
    return a.time.localeCompare(b.time);
  });

  return (
    <div className="flex flex-col gap-6 h-full">
      <div className="flex justify-between items-end shrink-0">
        <div>
          <h1 className="text-3xl font-serif italic font-black text-[#f8bc51] leading-none mb-2">Master Schedule</h1>
          <p className="text-xs font-mono uppercase tracking-widest text-[#d4c4b0]/60">Manage shifts across all terminals</p>
        </div>
        
        {/* View Toggle */}
        <div className="flex bg-[#120a06] rounded-xl border border-[#302117] p-1">
          <button 
            onClick={() => setViewMode('staff')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-xs uppercase tracking-widest transition-colors ${viewMode === 'staff' ? 'bg-[#f8bc51] text-[#0A0604] font-bold' : 'text-[#d4c4b0] hover:text-white'}`}
          >
            <Users size={14} /> Staff View
          </button>
          <button 
            onClick={() => setViewMode('day')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-xs uppercase tracking-widest transition-colors ${viewMode === 'day' ? 'bg-[#f8bc51] text-[#0A0604] font-bold' : 'text-[#d4c4b0] hover:text-white'}`}
          >
            <CalendarIcon size={14} /> Day View
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 bg-[#120a06]/40 backdrop-blur-xl border border-[#302117] rounded-3xl flex overflow-hidden">
        
        {/* LEFT PANEL */}
        <div className="w-1/3 border-r border-[#302117] flex flex-col bg-[#0A0604]/50">
          {viewMode === 'staff' ? (
            <>
              <div className="p-4 border-b border-[#302117] shrink-0">
                <h3 className="font-bold text-white uppercase tracking-wider text-sm">Select Staff</h3>
              </div>
              <div className="flex-1 overflow-y-auto theme-scrollbar p-3 space-y-2">
                {staffList.map(staff => (
                  <button 
                    key={staff.id}
                    onClick={() => { setSelectedStaffId(staff.id); setIsAddingShift(false); }}
                    className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between ${
                      selectedStaffId === staff.id 
                        ? 'bg-[#f8bc51]/10 border-[#f8bc51]/40 text-white' 
                        : 'bg-[#120a06] border-[#302117] text-[#d4c4b0] hover:border-[#f8bc51]/20'
                    }`}
                  >
                    <div>
                      <div className="font-bold">{staff.name}</div>
                      <div className="text-[10px] uppercase font-mono tracking-wider mt-1 opacity-60">{staff.role.replace('_', ' ')}</div>
                    </div>
                    <div className="text-xs bg-[#0A0604] px-2 py-1 rounded-md border border-[#302117]">
                      {staff.schedule?.length || 0} shifts
                    </div>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="p-4 border-b border-[#302117] shrink-0">
                <h3 className="font-bold text-white uppercase tracking-wider text-sm">Select Day</h3>
              </div>
              <div className="flex-1 overflow-y-auto theme-scrollbar p-3 space-y-2">
                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => (
                  <button 
                    key={day}
                    onClick={() => { setSelectedDay(day); setIsAddingShift(false); }}
                    className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between ${
                      selectedDay === day 
                        ? 'bg-[#f8bc51]/10 border-[#f8bc51]/40 text-white' 
                        : 'bg-[#120a06] border-[#302117] text-[#d4c4b0] hover:border-[#f8bc51]/20'
                    }`}
                  >
                    <div className="font-bold">{day}</div>
                    <ChevronRight size={14} className={selectedDay === day ? "text-[#f8bc51]" : "opacity-0"} />
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* RIGHT PANEL */}
        <div className="w-2/3 flex flex-col bg-transparent relative">
          
          {isAddingShift ? (
            <div className="absolute inset-0 bg-[#0A0604] z-10 flex flex-col p-6 animate-in slide-in-from-bottom-8">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-white flex items-center gap-2"><Plus className="text-[#f8bc51]"/> Add New Shift</h3>
                <button onClick={() => setIsAddingShift(false)} className="text-[#d4c4b0] hover:text-white"><X size={20}/></button>
              </div>
              
              <div className="bg-[#120a06] border border-[#302117] rounded-2xl p-6 flex flex-col gap-5 flex-1">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5 col-span-2">
                    <label className="text-[10px] uppercase tracking-wider text-[#d4c4b0] font-mono">Staff Member</label>
                    <select 
                      value={newShiftStaffId} 
                      onChange={e => setNewShiftStaffId(e.target.value)}
                      className="bg-[#070402] border border-[#302117] rounded-lg px-3 py-3 text-sm text-white focus:outline-none focus:border-[#f8bc51]/50"
                    >
                      <option value="">Select Staff...</option>
                      {staffList.map(s => <option key={s.id} value={s.id}>{s.name} ({s.role})</option>)}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] uppercase tracking-wider text-[#d4c4b0] font-mono">Day</label>
                    <select 
                      value={newShiftDay} 
                      onChange={e => setNewShiftDay(e.target.value)}
                      className="bg-[#070402] border border-[#302117] rounded-lg px-3 py-3 text-sm text-white focus:outline-none focus:border-[#f8bc51]/50"
                    >
                      {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] uppercase tracking-wider text-[#d4c4b0] font-mono">Date (e.g. Oct 24)</label>
                    <input 
                      type="text" 
                      value={newShiftDate} 
                      onChange={e => setNewShiftDate(e.target.value)}
                      placeholder="Oct 24"
                      className="bg-[#070402] border border-[#302117] rounded-lg px-3 py-3 text-sm text-white focus:outline-none focus:border-[#f8bc51]/50"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5 col-span-2">
                    <label className="text-[10px] uppercase tracking-wider text-[#d4c4b0] font-mono">Shift Type</label>
                    <select 
                      value={newShiftType} 
                      onChange={e => setNewShiftType(e.target.value)}
                      className="bg-[#070402] border border-[#302117] rounded-lg px-3 py-3 text-sm text-white focus:outline-none focus:border-[#f8bc51]/50"
                    >
                      <option value="Morning Shift">Morning Shift</option>
                      <option value="Evening Shift">Evening Shift</option>
                      <option value="Night Shift">Night Shift</option>
                      <option value="Day Off">Day Off</option>
                    </select>
                  </div>
                </div>

                {newShiftType !== 'Day Off' && (
                  <div className="grid grid-cols-2 gap-4 border-t border-[#302117]/50 pt-5 mt-2">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] uppercase tracking-wider text-[#d4c4b0] font-mono flex items-center gap-1"><Clock size={10} /> Start Time</label>
                      <input 
                        type="time" 
                        value={newShiftStart} 
                        onChange={e => setNewShiftStart(e.target.value)}
                        className="bg-[#070402] border border-[#302117] rounded-lg px-3 py-3 text-sm text-white focus:outline-none focus:border-[#f8bc51]/50"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] uppercase tracking-wider text-[#d4c4b0] font-mono flex items-center gap-1"><Clock size={10} /> End Time</label>
                      <input 
                        type="time" 
                        value={newShiftEnd} 
                        onChange={e => setNewShiftEnd(e.target.value)}
                        className="bg-[#070402] border border-[#302117] rounded-lg px-3 py-3 text-sm text-white focus:outline-none focus:border-[#f8bc51]/50"
                      />
                    </div>
                  </div>
                )}
                
                <div className="mt-auto flex gap-3 pt-6">
                  <button 
                    onClick={() => setIsAddingShift(false)}
                    className="flex-1 py-3 rounded-xl border border-[#302117] text-[#d4c4b0] hover:text-white uppercase text-xs tracking-widest font-mono font-bold"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleAddShift}
                    disabled={isSaving}
                    className="flex-1 bg-[#f8bc51] text-[#0A0604] py-3 rounded-xl uppercase text-xs tracking-widest font-mono font-bold hover:bg-[#ffce7b]"
                  >
                    {isSaving ? 'Saving...' : 'Save Shift'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col h-full">
              {viewMode === 'staff' ? (
                selectedStaffId ? (
                  <>
                    <div className="p-6 border-b border-[#302117] flex justify-between items-center bg-[#120a06]/40 shrink-0">
                      <div>
                        <h2 className="text-xl font-bold text-white">{selectedStaff?.name}'s Schedule</h2>
                        <p className="text-[#d4c4b0] text-sm mt-0.5">{selectedStaff?.role.replace('_', ' ')} • {selectedStaff?.outlet}</p>
                      </div>
                      <button 
                        onClick={() => {
                          setNewShiftStaffId(selectedStaffId);
                          setNewShiftDay('Monday');
                          setIsAddingShift(true);
                        }}
                        className="bg-[#302117]/50 hover:bg-[#302117] text-[#f8bc51] px-4 py-2 flex items-center gap-2 rounded-xl font-mono text-xs uppercase tracking-widest border border-[#f8bc51]/20 transition-colors"
                      >
                        <Plus size={14}/> Add Shift
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto theme-scrollbar p-6 space-y-3">
                      {!selectedStaff?.schedule || selectedStaff.schedule.length === 0 ? (
                        <div className="text-center py-20 text-[#d4c4b0]/30 border border-dashed border-[#302117] rounded-2xl">
                          No shifts scheduled.
                        </div>
                      ) : (
                        selectedStaff.schedule.map(shift => (
                          <div key={shift.id} className="bg-[#120a06] border border-[#302117] p-5 rounded-2xl flex justify-between items-center group">
                            <div>
                              <div className="flex items-center gap-2 mb-1.5">
                                <span className="font-bold text-white text-lg">{shift.day}, {shift.date}</span>
                                <span className="bg-[#302117] text-[#d4c4b0] text-[10px] px-2 py-0.5 rounded uppercase tracking-wider font-bold">{shift.type}</span>
                              </div>
                              <div className={`font-mono ${shift.time === 'Off' ? 'text-[#d4c4b0]/50' : 'text-[#f8bc51]'}`}>
                                {shift.time}
                              </div>
                            </div>
                            <button 
                              onClick={() => handleRemoveShift(selectedStaff.id, shift.id)}
                              className="text-red-500/50 hover:text-red-500 hover:bg-red-500/10 p-3 rounded-xl transition-colors opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-[#d4c4b0]/40 flex-col gap-4">
                    <Users size={48} className="opacity-20" />
                    <p className="font-mono uppercase tracking-widest text-sm">Select a staff member</p>
                  </div>
                )
              ) : (
                <>
                  <div className="p-6 border-b border-[#302117] flex justify-between items-center bg-[#120a06]/40 shrink-0">
                    <div>
                      <h2 className="text-xl font-bold text-white">Shifts for {selectedDay}</h2>
                      <p className="text-[#d4c4b0] text-sm mt-0.5">{shiftsForDay.length} shifts scheduled</p>
                    </div>
                    <button 
                      onClick={() => {
                        setNewShiftDay(selectedDay);
                        setNewShiftStaffId(staffList[0]?.id || '');
                        setIsAddingShift(true);
                      }}
                      className="bg-[#302117]/50 hover:bg-[#302117] text-[#f8bc51] px-4 py-2 flex items-center gap-2 rounded-xl font-mono text-xs uppercase tracking-widest border border-[#f8bc51]/20 transition-colors"
                    >
                      <Plus size={14}/> Add Shift
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto theme-scrollbar p-6 space-y-3">
                    {shiftsForDay.length === 0 ? (
                      <div className="text-center py-20 text-[#d4c4b0]/30 border border-dashed border-[#302117] rounded-2xl">
                        No shifts scheduled for {selectedDay}.
                      </div>
                    ) : (
                      shiftsForDay.map(shift => (
                        <div key={shift.id} className="bg-[#120a06] border border-[#302117] p-5 rounded-2xl flex justify-between items-center group">
                          <div>
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="font-bold text-white text-lg">{shift.staff.name}</span>
                              <span className="bg-[#302117] text-[#d4c4b0] text-[10px] px-2 py-0.5 rounded uppercase tracking-wider font-bold">{shift.type}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className={`font-mono ${shift.time === 'Off' ? 'text-[#d4c4b0]/50' : 'text-[#f8bc51]'}`}>
                                {shift.time}
                              </span>
                              <span className="text-[#d4c4b0]/50 text-sm">• {shift.staff.role.replace('_', ' ')}</span>
                            </div>
                          </div>
                          <button 
                            onClick={() => handleRemoveShift(shift.staff.id, shift.id)}
                            className="text-red-500/50 hover:text-red-500 hover:bg-red-500/10 p-3 rounded-xl transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
