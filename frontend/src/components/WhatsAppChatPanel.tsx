import React, { useEffect, useRef, useState } from 'react';
import { whatsappAPI } from '../utils/api-service';

type WhatsAppMessage = {
  id: string;
  direction: 'inbound' | 'outbound';
  message_type: string;
  message_text: string | null;
  status: string;
  timestamp: string;
};

export const WhatsAppChatPanel: React.FC<{ leadId: string; leadName: string }> = ({
  leadId,
  leadName,
}) => {
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    whatsappAPI.listMessages(leadId)
      .then((response) => {
        if (active) setMessages(response.data?.messages || []);
      })
      .catch((requestError: any) => {
        if (active) setError(requestError?.response?.data?.message || 'Unable to load WhatsApp chat');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    const handleRealtimeMessage = (event: Event) => {
      const payload = (event as CustomEvent).detail;
      if (String(payload?.leadId) !== String(leadId)) return;
      setMessages((current) => [
        ...current,
        {
          id: `live-${Date.now()}`,
          direction: payload.direction,
          message_type: payload.messageType || 'text',
          message_text: payload.text || null,
          status: payload.direction === 'inbound' ? 'received' : 'sent',
          timestamp: payload.timestamp || new Date().toISOString(),
        },
      ]);
    };
    window.addEventListener('whatsapp-message', handleRealtimeMessage);
    return () => {
      active = false;
      window.removeEventListener('whatsapp-message', handleRealtimeMessage);
    };
  }, [leadId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    const message = text.trim();
    if (!message || sending) return;
    setSending(true);
    setError('');
    try {
      await whatsappAPI.sendMessage(leadId, message);
      setText('');
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Unable to send WhatsApp message');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="rounded-2xl border border-emerald-200 bg-white overflow-hidden dark:bg-slate-900 dark:border-emerald-900">
      <div className="px-4 py-3 bg-emerald-600 text-white">
        <p className="font-bold">WhatsApp Chat</p>
        <p className="text-xs text-emerald-100">{leadName}</p>
      </div>
      <div className="h-72 overflow-y-auto px-4 py-3 space-y-2 bg-slate-50 dark:bg-slate-950">
        {loading && <p className="text-sm text-slate-500">Loading conversation...</p>}
        {!loading && messages.length === 0 && (
          <p className="text-sm text-slate-500">No WhatsApp messages yet.</p>
        )}
        {messages.map((message) => (
          <div
            key={message.id}
            className={`max-w-[82%] rounded-2xl px-3 py-2 text-sm ${
              message.direction === 'outbound'
                ? 'ml-auto bg-emerald-500 text-white'
                : 'mr-auto bg-white text-slate-900 border border-slate-200'
            }`}
          >
            <p className="whitespace-pre-wrap break-words">{message.message_text || `[${message.message_type}]`}</p>
            <p className={`mt-1 text-[10px] ${message.direction === 'outbound' ? 'text-emerald-100' : 'text-slate-400'}`}>
              {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              {message.direction === 'outbound' ? ` · ${message.status}` : ''}
            </p>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      {error && <p className="px-4 py-2 text-xs text-red-600">{error}</p>}
      <div className="flex gap-2 p-3 border-t border-slate-200 dark:border-slate-800">
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              void send();
            }
          }}
          placeholder="Type a WhatsApp message..."
          className="input-field flex-1"
        />
        <button
          type="button"
          disabled={!text.trim() || sending}
          onClick={() => void send()}
          className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-semibold disabled:opacity-50"
        >
          {sending ? 'Sending...' : 'Send'}
        </button>
      </div>
    </div>
  );
};
