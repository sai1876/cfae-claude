'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Bot } from 'lucide-react';
import { askStaffCopilotAction } from '@/app/_actions/groqActions';

export default function StaffCopilot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{role: 'user' | 'ai', content: string}[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    
    const userMsg = input.trim();
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setInput('');
    setLoading(true);

    try {
      // Mock context for now. In a real app, this could be fetched from a config doc or menu items.
      const context = "Standard Frappe Recipe: 1 shot espresso, 2 pumps caramel, 1 cup ice, 1/2 cup milk. Blend until smooth. Wi-fi password for staff is Hau HauStaff2026. Peak hours are usually 8 PM to 10 PM. Always smile and greet the customer with 'Welcome to Hau Hau'.";
      const reply = await askStaffCopilotAction(userMsg, context);
      setMessages(prev => [...prev, { role: 'ai', content: reply }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'ai', content: "Error communicating with Groq API." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating Button */}
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 p-4 bg-[#f8bc51] text-[#060403] rounded-full shadow-2xl hover:scale-105 transition-transform z-50 flex items-center gap-2"
      >
        <Bot size={24} />
        <span className="font-bold font-mono text-sm hidden md:block">Copilot</span>
      </button>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            className="fixed bottom-24 right-6 w-80 md:w-96 bg-[#120a06]/95 backdrop-blur-xl border border-[#f8bc51]/30 rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col"
            style={{ height: '500px', maxHeight: '80vh' }}
          >
            {/* Header */}
            <div className="flex justify-between items-center p-4 border-b border-[#f8bc51]/20 bg-[#f8bc51]/10">
              <div className="flex items-center gap-2 text-[#f8bc51]">
                <Bot size={20} />
                <h3 className="font-serif italic font-bold">Staff Copilot</h3>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-[#f8bc51]/60 hover:text-[#f8bc51]">
                <X size={20} />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
              {messages.length === 0 && (
                <div className="text-center text-[#d4c4b0]/50 text-sm italic mt-10">
                  Ask me about cafe SOPs, recipes, or operations!
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-xl p-3 text-sm whitespace-pre-wrap ${
                    m.role === 'user' 
                      ? 'bg-[#f8bc51] text-[#060403] font-medium' 
                      : 'bg-[#302117]/80 text-[#f7dec4] border border-[#f8bc51]/10'
                  }`}>
                    {m.content}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-[#302117]/80 text-[#f8bc51] border border-[#f8bc51]/10 rounded-xl p-3 text-sm animate-pulse">
                    Thinking...
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="p-4 border-t border-[#f8bc51]/20 bg-[#060403]">
              <div className="flex items-center gap-2">
                <input 
                  type="text" 
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSend()}
                  placeholder="Ask a question..."
                  className="flex-1 bg-[#302117]/50 text-[#f7dec4] placeholder-[#d4c4b0]/30 rounded-lg px-4 py-2 outline-none border border-transparent focus:border-[#f8bc51]/50 text-sm font-mono"
                />
                <button 
                  onClick={handleSend}
                  disabled={loading || !input.trim()}
                  className="p-2 bg-[#f8bc51] text-[#060403] rounded-lg disabled:opacity-50"
                >
                  <Send size={18} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
