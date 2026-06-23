'use client';

import { useState, useEffect } from 'react';
import { Users, Plus, Shield, MapPin, Trash2, Key, Clock, Sparkles, RefreshCw, ScanFace, Calendar } from 'lucide-react';
import { Outlet, Staff } from '@/lib/types';
import { sendStaffCodeAction } from '@/app/_actions/emailActions';
import { autoScheduleAction } from '@/app/_actions/groqActions';
import { fetchOutlets, fetchStaffList, submitApprovalRequest } from '@/lib/dbService';
import { secureSaveStaff, secureDeleteStaff, secureUpdateStaffPassword, secureEditStaff } from '@/app/_actions/secureDbActions';
import TOTPModal from './TOTPModal';
import FaceEnrollmentModal from './FaceEnrollmentModal';

export default function StaffManagement({ userRole }: { userRole?: string }) {
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  
  const [employeeId, setEmployeeId] = useState('');
  const [name, setName] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [role, setRole] = useState<'owner' | 'manager' | 'deep_fryer' | 'grill_fryer' | 'biryani_master' | 'brewer' | 'rider'>('deep_fryer');
  const [outlet, setOutlet] = useState('Global Outlets');
  const [loading, setLoading] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  
  // Face Enrollment State
  const [enrollStaff, setEnrollStaff] = useState<{id: string, name: string} | null>(null);
  
  // Scheduling State
  const [isSchedulingTransfer, setIsSchedulingTransfer] = useState(false);
  const [transferDate, setTransferDate] = useState('');
  const [transferTime, setTransferTime] = useState('00:00');
  
  // OTP Verification State
  const [step, setStep] = useState<'form' | 'otp'>('form');
  const [expectedOtp, setExpectedOtp] = useState('');
  const [enteredOtp, setEnteredOtp] = useState('');
  const [enteredTotp, setEnteredTotp] = useState('');
  
  // TOTP & Inline Edit State
  type PendingAction = 
    | { type: 'delete'; id: string }
    | { type: 'update_password'; id: string; newPassword: string }
    | { type: 'edit_staff'; id: string };
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  
  const [editingPasswordId, setEditingPasswordId] = useState<string | null>(null);
  const [newInlinePassword, setNewInlinePassword] = useState('');
  
  // AI Scheduling State
  const [aiSchedule, setAiSchedule] = useState<string | null>(null);
  const [isGeneratingSchedule, setIsGeneratingSchedule] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [outletsData, staffData] = await Promise.all([
        fetchOutlets(),
        fetchStaffList()
      ]);
      setOutlets(outletsData);
      setStaffList(staffData);
      if (outletsData.length > 0 && outlet === 'Global Outlets') {
        setOutlet(outletsData[0].name);
      }

      // Check URL for direct deep link
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const openStaff = params.get('open_staff');
        if (openStaff) {
          setHighlightId(openStaff);
          window.history.replaceState({}, '', '/admin?tab=staff');
          setTimeout(() => {
            const el = document.getElementById(`staff-card-${openStaff}`);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => setHighlightId(null), 4000); // clear highlight after 4s
          }, 300);
        }
      }
    } catch (err) {
      console.error("Failed to load staff management data:", err);
    }
  };



  const handleEdit = (staff: Staff) => {
    setEditingStaffId(staff.id);
    setEmployeeId(staff.employee_id || '');
    setName(staff.name || '');
    setStaffEmail(staff.email || '');
    setRole(staff.role || 'deep_fryer');
    
    if (staff.pending_transfer) {
      setIsSchedulingTransfer(true);
      setOutlet(staff.pending_transfer.target_outlet);
      const d = new Date(staff.pending_transfer.effective_time);
      setTransferDate(d.toISOString().split('T')[0]);
      setTransferTime(d.toTimeString().slice(0, 5));
    } else {
      setIsSchedulingTransfer(false);
      setOutlet(staff.outlet || 'Global Outlets');
      setTransferDate('');
      setTransferTime('00:00');
    }

    setStep('form');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const initiateProvisioning = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !employeeId) return;

    if (editingStaffId) {
      if (userRole === 'manager') {
        setLoading(true);
        try {
          await submitApprovalRequest({
            action_type: 'staff_edit',
            requested_by: 'Manager',
            payload: {
              id: editingStaffId,
              employee_id: employeeId,
              name,
              email: staffEmail,
              role,
              outlet
            },
            reason: `Requested to update staff member ${name} (${role}) at ${outlet}`
          });
          alert('Approval request submitted to the Owner successfully!');
          setStep('form');
          setEditingStaffId(null);
          setEmployeeId('');
          setName('');
          setStaffEmail('');
          setStaffPassword('');
        } catch (err) {
          console.error(err);
          alert('Failed to submit approval request.');
        } finally {
          setLoading(false);
        }
        return;
      }
      setPendingAction({ type: 'edit_staff', id: editingStaffId });
      return;
    }

    if (!staffPassword) return;

    if (userRole === 'manager') {
      setLoading(true);
      try {
        await submitApprovalRequest({
          action_type: 'staff_edit',
          requested_by: 'Manager', // Real auth would use logged in manager name
          payload: {
            employee_id: employeeId,
            name,
            email: staffEmail,
            role,
            outlet,
            password: staffPassword // In a real app, this should be handled securely
          },
          reason: `Requested new staff member ${name} (${role}) for ${outlet}`
        });
        alert('Approval request submitted to the Owner successfully!');
        setStep('form');
        setEmployeeId('');
        setName('');
        setStaffEmail('');
        setStaffPassword('');
      } catch (err) {
        console.error(err);
        alert('Failed to submit approval request.');
      } finally {
        setLoading(false);
      }
      return;
    }

    // All roles (except manager needing approval) require OTP verification
    setLoading(true);
    const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
    setExpectedOtp(generatedOtp);
    
    try {
      await sendStaffCodeAction({
        action: 'send_otp',
        otp: generatedOtp,
        name,
        email: staffEmail
      });
      
      setStep('otp');
    } catch (err: any) {
      console.error(err);
      alert(`Email Service Error: ${err.message || 'Failed to send verification code.'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (enteredOtp !== expectedOtp) {
      alert("Invalid email verification code. Please check your email and try again.");
      return;
    }
    if (enteredTotp.length !== 6) {
      alert("Please enter the 6-digit Authenticator code.");
      return;
    }
    await finalizeProvisioning(enteredTotp);
  };

  const finalizeProvisioning = async (totpCode: string) => {
    setLoading(true);
    
    const newStaff: Staff = {
      id: `st_${Date.now()}`,
      employee_id: employeeId,
      name,
      email: staffEmail,
      role,
      outlet,
      status: 'offline',
      created_at: Date.now()
    };

    try {
      await secureSaveStaff(newStaff, totpCode, staffPassword);

      await sendStaffCodeAction({
        action: 'send_passcode',
        name: newStaff.name,
        email: staffEmail,
        role: newStaff.role,
        outlet: newStaff.outlet,
        password: staffPassword,
        employeeId: newStaff.employee_id
      });

      await loadData();
      
      setEmployeeId('');
      setName('');
      setStaffEmail('');
      setStaffPassword('');
      setEnteredOtp('');
      setEnteredTotp('');
      setStep('form');
      
      alert(`Terminal Provisioned Successfully!\n\nThe account has been created and credentials emailed to the staff.`);
    } catch (err: any) {
      console.error(err);
      alert(`Provisioning Failed: ${err.message || 'Error saving staff.'}`);
    } finally {
      setLoading(false);
    }
  };

  const executeSecureAction = async (totpCode: string) => {
    if (!pendingAction) return;
    try {
      if (pendingAction.type === 'delete') {
        await secureDeleteStaff(pendingAction.id, totpCode);
      } else if (pendingAction.type === 'update_password') {
        await secureUpdateStaffPassword(pendingAction.id, pendingAction.newPassword, totpCode);
        setEditingPasswordId(null);
        setNewInlinePassword('');
      } else if (pendingAction.type === 'edit_staff') {
        const originalStaff = staffList.find(s => s.id === pendingAction.id);
        const currentOutlet = originalStaff?.outlet || 'Global Outlets';

        let pendingTransfer;
        if (isSchedulingTransfer && transferDate && transferTime && outlet !== currentOutlet) {
            const dateStr = `${transferDate}T${transferTime}:00`;
            const effectiveTime = new Date(dateStr).getTime();
            pendingTransfer = {
                target_outlet: outlet,
                effective_time: effectiveTime
            };
        }

        const updatedStaff: Staff = {
          id: pendingAction.id,
          employee_id: employeeId,
          name,
          email: staffEmail,
          role,
          outlet: (isSchedulingTransfer && pendingTransfer) ? currentOutlet : outlet,
          status: originalStaff?.status || 'offline',
          created_at: originalStaff?.created_at || Date.now()
        };

        if (pendingTransfer) {
          updatedStaff.pending_transfer = pendingTransfer;
        } else if (originalStaff?.pending_transfer && !isSchedulingTransfer) {
          // If scheduling was unchecked, remove the transfer
          updatedStaff.pending_transfer = undefined;
        }

        await secureEditStaff(updatedStaff, totpCode);
        setEditingStaffId(null);
        setIsSchedulingTransfer(false);
        setEmployeeId('');
        setName('');
        setStaffEmail('');
        setRole('deep_fryer');
        setOutlet('Global Outlets');
      }
      await loadData();
      setPendingAction(null);
    } catch (err: any) {
      console.error("Secure action failed:", err);
      throw err; // Let the modal catch and display it
    }
  };

  const handleGenerateSchedule = async () => {
    setIsGeneratingSchedule(true);
    try {
      const peakHours = "12:00 PM - 2:00 PM (Lunch Rush), 6:00 PM - 8:30 PM (Dinner Rush)";
      const schedule = await autoScheduleAction(staffList, peakHours);
      setAiSchedule(schedule);
    } catch (err) {
      console.error(err);
      setAiSchedule("Failed to generate schedule.");
    } finally {
      setIsGeneratingSchedule(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-[#f7dec4]">
      {/* Staff terminal grid */}
      <div className="lg:col-span-2 flex flex-col gap-5">
        <div className="bg-[#120a06]/40 backdrop-blur-xl border border-[#302117] rounded-3xl p-6 flex flex-col gap-4">
          <div className="flex justify-between items-center border-b border-[#302117]/60 pb-3">
            <div>
              <h2 className="font-serif italic text-2xl text-white">Staff Registry & KDS Access</h2>
              <p className="text-xs font-mono text-[#d4c4b0]/50 uppercase tracking-widest mt-0.5">Terminal Authentication Tokens</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleGenerateSchedule}
                disabled={isGeneratingSchedule}
                className="bg-[#302117]/50 hover:bg-[#302117] text-[#f8bc51] px-3 py-1.5 rounded-full border border-[#f8bc51]/40 font-mono text-[10px] uppercase tracking-wider flex items-center gap-1.5 transition-colors"
              >
                {isGeneratingSchedule ? <RefreshCw size={12} className="animate-spin" /> : <Sparkles size={12} />}
                {isGeneratingSchedule ? 'Generating...' : 'AI Auto-Schedule'}
              </button>
              <span className="bg-[#302117]/50 text-[#f8bc51] px-3 py-1.5 rounded-full border border-[#302117] font-mono text-[10px] flex items-center gap-1.5">
                <Users size={12} />
                {staffList.length} Terminals
              </span>
            </div>
          </div>

          {aiSchedule && (
            <div className="bg-[#120a06]/80 border border-[#f8bc51]/40 rounded-xl p-4 shadow-sm animate-in fade-in slide-in-from-top-2 mb-2">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={14} className="text-[#f8bc51]" />
                <h3 className="text-[#f8bc51] text-xs font-bold font-mono uppercase tracking-widest">Optimized AI Shift Schedule</h3>
              </div>
              <p className="text-[#d4c4b0] text-sm whitespace-pre-wrap leading-relaxed">{aiSchedule}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {staffList.map((staff) => (
              <div
                id={`staff-card-${staff.id}`}
                key={staff.id}
                className={`bg-[#070402]/30 border ${highlightId === staff.id ? 'border-[#10B981] shadow-[0_0_30px_rgba(16,185,129,0.15)] scale-[1.02]' : 'border-[#302117]'} rounded-2xl p-4 flex flex-col justify-between gap-4 hover:border-[#f8bc51]/40 transition-all duration-700`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex gap-3">
                    <div className={`p-2.5 rounded-xl border ${staff.status === 'active' ? 'bg-[#10B981]/10 border-[#10B981]/20 text-[#10B981]' : 'bg-[#302117]/30 border-[#302117]/60 text-[#d4c4b0]/40'}`}>
                      <Shield size={16} />
                    </div>
                    <div>
                      <h4 className="font-serif italic text-base text-white font-bold leading-tight">{staff.name}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="bg-[#f8bc51]/20 text-[#f8bc51] px-1.5 py-0.5 rounded text-[8px] uppercase font-bold tracking-wider">{staff.employee_id || 'N/A'}</span>
                        <p className="font-mono text-[9px] text-[#d4c4b0]/70 uppercase tracking-wider font-bold">{staff.role}</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Status Indicator */}
                  <span className={`w-1.5 h-1.5 rounded-full ${staff.status === 'active' ? 'bg-[#10B981] shadow-[0_0_8px_#10B981]' : 'bg-[#d4c4b0]/30'}`} />
                </div>

                <div className="flex flex-col gap-2 font-mono text-[10px] text-[#d4c4b0]/70 border-t border-[#302117]/30 pt-3">
                  <div className="flex items-center gap-1.5">
                    <MapPin size={11} className="text-[#f8bc51]" />
                    <span>{staff.outlet}</span>
                  </div>

                  {staff.pending_transfer && (
                    <div className="flex items-center gap-1.5 text-[#34D399] mt-0.5 p-1.5 bg-[#10B981]/10 rounded border border-[#10B981]/20">
                      <Clock size={11} />
                      <span className="font-bold uppercase tracking-widest leading-tight">
                        Transfer to {staff.pending_transfer.target_outlet} <br/>
                        on {new Date(staff.pending_transfer.effective_time).toLocaleDateString()} at {new Date(staff.pending_transfer.effective_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </span>
                    </div>
                  )}
                  
                  {editingPasswordId === staff.id ? (
                    <div className="flex items-center gap-2 mt-1">
                      <input 
                        type="text" 
                        placeholder="New Password" 
                        value={newInlinePassword}
                        onChange={(e) => setNewInlinePassword(e.target.value)}
                        className="bg-[#070402] border border-[#f8bc51]/50 rounded-lg px-2 py-1.5 text-white flex-1 focus:outline-none"
                      />
                      <button 
                        onClick={() => {
                          if (newInlinePassword.length < 6) return alert("Password must be at least 6 characters.");
                          setPendingAction({ type: 'update_password', id: staff.id, newPassword: newInlinePassword });
                        }}
                        className="bg-[#f8bc51] text-[#0A0604] px-2 py-1.5 rounded uppercase tracking-wider font-bold hover:bg-[#ffce7b] transition-colors"
                      >
                        Save
                      </button>
                      <button 
                        onClick={() => { setEditingPasswordId(null); setNewInlinePassword(''); }}
                        className="text-[#d4c4b0]/50 hover:text-white uppercase px-1"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => setEditingPasswordId(staff.id)}
                      className="text-[#f8bc51]/70 hover:text-[#f8bc51] uppercase tracking-wider text-left transition-colors flex items-center gap-1 mt-1"
                    >
                      <Key size={10} />
                      Update Password
                    </button>
                  )}
                </div>

                <div className="flex justify-end pt-2 border-t border-[#302117]/20 gap-2">
                  {staff.role === 'rider' && (
                    <button
                      onClick={() => setEnrollStaff({ id: staff.id, name: staff.name })}
                      className="p-1.5 rounded-lg hover:bg-[#60A5FA]/10 border border-transparent hover:border-[#60A5FA]/20 text-[#60A5FA]/70 hover:text-[#60A5FA] transition-all text-[10px] font-mono flex items-center gap-1 uppercase tracking-wider mr-auto"
                    >
                      <ScanFace size={11} />
                      {staff.faceDescriptor ? 'Update Biometrics' : 'Enroll Biometrics'}
                    </button>
                  )}
                  <button
                    onClick={() => handleEdit(staff)}
                    className="p-1.5 rounded-lg hover:bg-[#f8bc51]/10 border border-transparent hover:border-[#f8bc51]/20 text-[#f8bc51]/70 hover:text-[#f8bc51] transition-all text-[10px] font-mono flex items-center gap-1 uppercase tracking-wider"
                  >
                    Edit Profile
                  </button>
                  <button
                    onClick={() => setPendingAction({ type: 'delete', id: staff.id })}
                    className="p-1.5 rounded-lg hover:bg-red-500/10 border border-transparent hover:border-red-500/20 text-red-400 transition-all text-[10px] font-mono flex items-center gap-1 uppercase tracking-wider"
                  >
                    <Trash2 size={11} />
                    Suspend Access
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Register Staff Form */}
      <div>
        {step === 'form' ? (
          <form
            onSubmit={initiateProvisioning}
            className="bg-[#120a06]/40 backdrop-blur-xl border border-[#302117] rounded-3xl p-6 flex flex-col gap-4"
          >
            <h3 className="font-serif italic text-lg text-white border-b border-[#302117]/60 pb-2">{editingStaffId ? 'Edit Terminal Access' : 'Register Terminal'}</h3>
            
            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[10px] uppercase tracking-wider text-[#d4c4b0]">Employee ID *</label>
              <input
                type="text"
                required
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                placeholder="e.g. EMP-001"
                className="bg-[#070402] border border-[#302117] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[10px] uppercase tracking-wider text-[#d4c4b0]">Staff Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Amit Singh"
                className="bg-[#070402] border border-[#302117] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[10px] uppercase tracking-wider text-[#d4c4b0]">Staff Email *</label>
              <input
                type="email"
                required
                value={staffEmail}
                onChange={(e) => setStaffEmail(e.target.value)}
                placeholder="e.g. staff@example.com"
                className="bg-[#070402] border border-[#302117] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none"
              />
            </div>

            {!editingStaffId && (
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[10px] uppercase tracking-wider text-[#d4c4b0]">Starting Password *</label>
                <input
                  type="text"
                  required
                  value={staffPassword}
                  onChange={(e) => setStaffPassword(e.target.value)}
                  placeholder="e.g. securePass123"
                  className="bg-[#070402] border border-[#302117] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none font-mono"
                />
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[10px] uppercase tracking-wider text-[#d4c4b0]">Terminal Access Tier</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as 'owner' | 'manager' | 'deep_fryer' | 'grill_fryer' | 'biryani_master' | 'brewer' | 'rider')}
                className="bg-[#070402] border border-[#302117] rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none font-mono"
              >
                <option value="owner">Owner / Master Admin</option>
                <option value="manager">Manager Panel access</option>
                <option value="deep_fryer">KDS: Deep Fryer (Snacks, Burgers)</option>
                <option value="grill_fryer">KDS: Grill Fryer (Waffles, Sandwiches)</option>
                <option value="biryani_master">KDS: Biryani Master</option>
                <option value="brewer">KDS: Barista / Brewer</option>
                <option value="rider">Rider Delivery Dispatcher</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[10px] uppercase tracking-wider text-[#d4c4b0]">Outlet Hub Location</label>
              <select
                value={outlet}
                onChange={(e) => setOutlet(e.target.value)}
                className="bg-[#070402] border border-[#302117] rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none font-mono"
              >
                <option value="Global Outlets">Global Outlets (Riders)</option>
                {outlets.map((o) => (
                  <option key={o.id} value={o.name}>{o.name}</option>
                ))}
              </select>
            </div>

            {editingStaffId && (
               <div className="flex flex-col gap-2 p-4 border border-[#302117]/60 rounded-xl bg-[#070402]/30 mt-1">
                 <div className="flex items-center gap-2">
                    <input 
                      type="checkbox" 
                      id="sched" 
                      checked={isSchedulingTransfer} 
                      onChange={(e) => setIsSchedulingTransfer(e.target.checked)} 
                      className="accent-[#f8bc51] w-4 h-4 rounded" 
                    />
                    <label htmlFor="sched" className="text-[10px] text-[#d4c4b0] font-mono tracking-widest uppercase cursor-pointer hover:text-white transition-colors">Schedule Future Transfer</label>
                 </div>
                 {isSchedulingTransfer && (
                    <div className="flex gap-3 mt-2">
                      <div className="flex flex-col gap-1 flex-1">
                        <label className="text-[8px] uppercase tracking-widest text-[#d4c4b0]/50 font-mono">Date</label>
                        <input 
                          type="date" 
                          required
                          value={transferDate} 
                          onChange={(e) => setTransferDate(e.target.value)} 
                          className="bg-[#120a06] border border-[#302117] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#f8bc51]/50 font-mono" 
                        />
                      </div>
                      <div className="flex flex-col gap-1 flex-1">
                        <label className="text-[8px] uppercase tracking-widest text-[#d4c4b0]/50 font-mono">Time</label>
                        <input 
                          type="time" 
                          required
                          value={transferTime} 
                          onChange={(e) => setTransferTime(e.target.value)} 
                          className="bg-[#120a06] border border-[#302117] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#f8bc51]/50 font-mono" 
                        />
                      </div>
                    </div>
                 )}
               </div>
            )}

            <div className="flex gap-3 mt-2">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-[#f8bc51] text-[#0A0604] hover:bg-[#ffce7b] disabled:opacity-50 rounded-xl py-3 font-mono font-bold text-xs uppercase tracking-widest transition-colors flex items-center justify-center gap-1.5"
              >
                {loading ? <div className="w-4 h-4 border-2 border-[#0A0604] border-t-transparent rounded-full animate-spin" /> : <Plus size={14} />}
                {loading ? "Saving..." : userRole === 'manager' ? "Request Approval" : editingStaffId ? "Update Staff Profile" : "Provision Token"}
              </button>
              {editingStaffId && (
                <button
                  type="button"
                  onClick={() => { setEditingStaffId(null); setIsSchedulingTransfer(false); setEmployeeId(''); setName(''); setStaffEmail(''); setRole('deep_fryer'); setOutlet('Global Outlets'); }}
                  className="bg-[#302117]/40 hover:bg-[#302117] text-[#d4c4b0] py-3 px-6 rounded-xl font-mono font-bold text-xs uppercase tracking-widest transition-all border border-[#302117]"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        ) : (
          <form
            onSubmit={handleOtpSubmit}
            className="bg-[#120a06]/40 backdrop-blur-xl border border-[#f8bc51]/40 rounded-3xl p-6 flex flex-col gap-6"
          >
            <div>
              <h3 className="font-serif italic text-xl text-[#f8bc51] mb-2">Verify Authorization</h3>
              <p className="text-xs text-[#d4c4b0]/70 leading-relaxed font-mono">
                An authorization code has been sent to the Master Admin email. Please enter the 6-digit code below to finalize the <strong>{role === 'owner' ? 'Owner' : 'Staff'}</strong> provisioning.
              </p>
            </div>

            <div className="flex flex-col gap-4 text-center mt-2">
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[10px] uppercase tracking-wider text-[#d4c4b0]">6-Digit Email OTP</label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={enteredOtp}
                  onChange={(e) => setEnteredOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="bg-[#070402] border border-[#f8bc51]/50 rounded-xl px-4 py-4 text-2xl text-center text-white focus:outline-none tracking-[0.5em] font-mono"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[10px] uppercase tracking-wider text-[#10B981]">Google Authenticator OTP</label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={enteredTotp}
                  onChange={(e) => setEnteredTotp(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="bg-[#070402] border border-[#10B981]/50 rounded-xl px-4 py-4 text-2xl text-center text-white focus:outline-none tracking-[0.5em] font-mono"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep('form')}
                className="flex-1 bg-transparent border border-[#302117] text-[#d4c4b0] hover:bg-[#302117]/50 rounded-xl py-3 font-mono font-bold text-xs uppercase tracking-widest transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || enteredOtp.length !== 6}
                className="flex-1 bg-[#10B981] text-white hover:bg-[#059669] disabled:opacity-50 rounded-xl py-3 font-mono font-bold text-xs uppercase tracking-widest transition-colors flex items-center justify-center"
              >
                {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : "Verify & Save"}
              </button>
            </div>
          </form>
        )}
      </div>

      <TOTPModal
        isOpen={!!pendingAction}
        onClose={() => setPendingAction(null)}
        onVerify={executeSecureAction}
        title={
          pendingAction?.type === 'delete' ? "Suspend Staff Access" : 
          pendingAction?.type === 'edit_staff' ? "Update Profile" :
          "Update Password"
        }
        description={
          pendingAction?.type === 'delete'
            ? "Please enter your Google Authenticator code to permanently delete this terminal access token."
            : pendingAction?.type === 'edit_staff'
            ? "Please enter your Google Authenticator code to authorize these profile changes."
            : "Please enter your Google Authenticator code to authorize this password change."
        }
      />

      <FaceEnrollmentModal 
        isOpen={!!enrollStaff}
        onClose={() => setEnrollStaff(null)}
        staffId={enrollStaff?.id || ''}
        staffName={enrollStaff?.name || ''}
        onSuccess={loadData}
      />
    </div>
  );
}
