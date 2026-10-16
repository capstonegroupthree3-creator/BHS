import React, { useState, useRef, useEffect } from 'react';
import { Bot, X, Send, User, Edit3, CheckCircle2 } from 'lucide-react';
import api from '../lib/api';

interface Message {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: Date;
  editChild?: {
    id: number;
    first_name: string;
    last_name: string;
    bmi?: number;
  };
}

const AiChatbotDrawer: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'bot',
      text: "Hello! I am your **Smart Barangay Health AI Assistant** 🤖.\n\nAsk me about child growth, BMI, stunting/wasting status, vaccination records, or pregnant mother risk levels! Try typing a child's name like *'Show me Maria Cruz'* or type *'Edit data for Juan Cruz'* if you are a health worker.",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  // Inline Form States for Worker Child Data Editing
  const [editForm, setEditForm] = useState<{
    childId: number | null;
    childName: string;
    heightCm: number;
    weightKg: number;
    submitting: boolean;
  }>({
    childId: null,
    childName: '',
    heightCm: 90.0,
    weightKg: 13.5,
    submitting: false,
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSend = async (textToSend?: string) => {
    const messageText = textToSend || input.trim();
    if (!messageText || loading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: messageText,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput('');
    setLoading(true);

    try {
      const { data } = await api.post('/ai/chatbot', { message: messageText });
      
      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'bot',
        text: data.response,
        timestamp: new Date(),
        editChild: data.action_type === 'open_edit_form' && data.target_child ? {
          id: data.target_child.id,
          first_name: data.target_child.first_name,
          last_name: data.target_child.last_name,
          bmi: data.target_child.bmi,
        } : undefined
      };

      if (data.action_type === 'open_edit_form' && data.target_child) {
        setEditForm({
          childId: data.target_child.id,
          childName: `${data.target_child.first_name} ${data.target_child.last_name}`,
          heightCm: 90.0,
          weightKg: 13.5,
          submitting: false,
        });
      }

      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: 'bot',
          text: 'Sorry, I am having trouble connecting to the AI health service. Please try again.',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveInlineGrowth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.childId) return;

    setEditForm((prev) => ({ ...prev, submitting: true }));
    try {
      const { data } = await api.post('/citizens/growth', {
        child_id: editForm.childId,
        height_cm: editForm.heightCm,
        weight_kg: editForm.weightKg,
      });

      const successMsg: Message = {
        id: Date.now().toString(),
        sender: 'bot',
        text: `✅ **Growth Measurement Saved!**\n\n- **Child:** ${editForm.childName}\n- **Updated Height:** ${editForm.heightCm} cm\n- **Updated Weight:** ${editForm.weightKg} kg\n- **New BMI:** ${data.bmi} (${data.nutrition_status})\n- **Stunting Status:** \`${data.stunting_status}\`\n- **Wasting Status:** \`${data.wasting_status}\`\n\n*${data.recommendations}*`,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, successMsg]);
      setEditForm({ childId: null, childName: '', heightCm: 90.0, weightKg: 13.5, submitting: false });
    } catch (err) {
      alert('Failed to save growth measurement.');
    } finally {
      setEditForm((prev) => ({ ...prev, submitting: false }));
    }
  };

  const quickPrompts = [
    '👶 Show child health records',
    '📝 Edit data for Juan Cruz',
    '🤰 Show pregnant mother risks',
    '💉 Overdue vaccine schedule',
  ];

  // Helper to render basic markdown formatting
  const formatMarkdown = (content: string) => {
    const lines = content.split('\n');
    return lines.map((line, idx) => {
      let formatted = line;
      // Bold
      formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      // Italics
      formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
      // Inline Code / Badges
      formatted = formatted.replace(/`(.*?)`/g, '<code class="bg-blue-100 text-blue-800 px-1 py-0.5 rounded text-xs">$1</code>');

      if (line.startsWith('### ')) {
        return <h4 key={idx} className="font-bold text-slate-900 text-sm mt-2 mb-1">{line.replace('### ', '')}</h4>;
      }
      if (line.startsWith('- ')) {
        return <li key={idx} className="ml-4 list-disc text-xs" dangerouslySetInnerHTML={{ __html: formatted.replace('- ', '') }} />;
      }
      if (line.startsWith('  > ')) {
        return <blockquote key={idx} className="ml-2 pl-2 border-l-2 border-amber-400 text-xs italic bg-amber-50/50 p-1.5 rounded my-1" dangerouslySetInnerHTML={{ __html: formatted.replace('  > ', '') }} />;
      }

      return <p key={idx} className="text-xs leading-relaxed mb-1" dangerouslySetInnerHTML={{ __html: formatted }} />;
    });
  };

  return (
    <>
      {/* Floating Trigger Button */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-50 p-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-full shadow-2xl hover:scale-105 transition-all flex items-center gap-2 group"
        aria-label="Ask Health AI Chatbot"
      >
        <div className="relative">
          <Bot className="w-6 h-6 text-white" />
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white animate-pulse" />
        </div>
        <span className="hidden group-hover:inline text-xs font-bold pr-1">Ask Health AI</span>
      </button>

      {/* Floating Chat Drawer Window */}
      {isOpen && (
        <div className="fixed bottom-20 right-6 w-96 max-w-[calc(100vw-3rem)] h-[540px] bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 flex flex-col overflow-hidden animate-slide-in">
          {/* Drawer Header */}
          <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 text-white px-4 py-3.5 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-white/10 backdrop-blur flex items-center justify-center">
                <Bot className="w-5 h-5 text-blue-300" />
              </div>
              <div>
                <p className="text-xs font-bold text-white">Barangay Health AI Assistant</p>
                <p className="text-[10px] text-blue-200">Online · Interactive Clinical Assistant</p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-slate-300 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages Container */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.sender === 'bot' && (
                  <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white flex-shrink-0 mt-0.5">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] p-3 rounded-2xl text-xs ${
                    msg.sender === 'user'
                      ? 'bg-blue-600 text-white rounded-br-none font-medium'
                      : 'bg-white border border-slate-200 text-slate-800 shadow-sm rounded-bl-none'
                  }`}
                >
                  {msg.sender === 'user' ? (
                    <p className="text-xs leading-relaxed">{msg.text}</p>
                  ) : (
                    <div>{formatMarkdown(msg.text)}</div>
                  )}

                  {/* INLINE CHILD DATA EDIT FORM CARD */}
                  {msg.editChild && editForm.childId === msg.editChild.id && (
                    <form onSubmit={handleSaveInlineGrowth} className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-2 text-slate-800">
                      <div className="flex items-center gap-1.5 font-bold text-blue-900 text-xs border-b border-blue-200 pb-1">
                        <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                        Edit Data: {editForm.childName}
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div>
                          <label className="text-[10px] font-semibold text-slate-600 block">Height (cm)</label>
                          <input
                            type="number"
                            step="0.1"
                            min="30"
                            max="150"
                            value={editForm.heightCm}
                            onChange={(e) => setEditForm({ ...editForm, heightCm: Number(e.target.value) })}
                            className="form-input text-xs py-1 px-2"
                            required
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold text-slate-600 block">Weight (kg)</label>
                          <input
                            type="number"
                            step="0.1"
                            min="1"
                            max="50"
                            value={editForm.weightKg}
                            onChange={(e) => setEditForm({ ...editForm, weightKg: Number(e.target.value) })}
                            className="form-input text-xs py-1 px-2"
                            required
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={editForm.submitting}
                        className="btn-primary py-1.5 px-3 w-full text-xs justify-center mt-2"
                      >
                        {editForm.submitting ? (
                          <><span className="spinner w-3 h-3" /> Saving Record...</>
                        ) : (
                          <><CheckCircle2 className="w-3.5 h-3.5" /> Save Updated Growth Record</>
                        )}
                      </button>
                    </form>
                  )}

                  <p className={`text-[9px] mt-1 text-right ${msg.sender === 'user' ? 'text-blue-200' : 'text-slate-400'}`}>
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>

                {msg.sender === 'user' && (
                  <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-white flex-shrink-0 mt-0.5">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex gap-2.5 items-center">
                <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white flex-shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="bg-white border border-slate-200 p-3 rounded-2xl rounded-bl-none shadow-sm flex items-center gap-2">
                  <span className="spinner w-3.5 h-3.5 text-blue-600" />
                  <span className="text-xs text-slate-500 font-medium">Scanning health records...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts Bar */}
          <div className="px-3 py-2 bg-white border-t border-slate-100 overflow-x-auto flex gap-1.5 no-scrollbar flex-shrink-0">
            {quickPrompts.map((prompt, i) => (
              <button
                key={i}
                onClick={() => handleSend(prompt)}
                className="px-2.5 py-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 rounded-full text-[11px] font-medium whitespace-nowrap transition-colors flex-shrink-0"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Input Box */}
          <div className="p-3 bg-white border-t border-slate-200 flex gap-2 flex-shrink-0">
            <input
              type="text"
              placeholder="Ask a question or type 'Edit data for [Name]'..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              className="flex-1 form-input py-2 text-xs"
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || loading}
              className="btn-primary py-2 px-3 justify-center"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default AiChatbotDrawer;
