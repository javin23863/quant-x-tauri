import { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface ChatModel {
  id: string;
  name: string;
  emoji?: string;
  role?: string;
  status?: string;
  model?: string;
  messageCount?: number;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  tokens?: number;
  latencyMs?: number;
  isError?: boolean;
}

const MODEL_COLORS: Record<string, string> = {
  ai: '#3B82F6',
  'research-director': '#22C55E',
  'trade-manager': '#F59E0B',
  'mission-control': '#EF4444',
  'meta-harness': '#A855F7',
};

const HANDS_FREE_STORAGE_KEY = 'mission-control:hands-free';
const VOICE_MODEL = 'gemini-3-flash-preview:cloud';
const OLLAMA_STREAM_URL = 'http://localhost:8118/ollama-chat-stream';

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return '--:--:--';
  }
}

function LoadingDots() {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '2px 0' }}>
      {[0, 1, 2].map(i => (
        <span
          key={i}
          style={{
            width: '5px', height: '5px', borderRadius: '50%',
            background: 'var(--text-muted)',
            animation: 'chatDotPulse 1.2s ease-in-out infinite',
            animationDelay: `${i * 0.2}s`,
          }}
        />
      ))}
    </span>
  );
}

function loadHandsFreePreference(): boolean {
  try {
    return localStorage.getItem(HANDS_FREE_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function toSpeechText(text: string): string {
  return String(text || '')
    .replace(/```[\s\S]*?```/g, ' Code block omitted. ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function MessageBubble({ msg, modelInfo, modelColor }: { msg: ChatMessage; modelInfo: ChatModel; modelColor: string }) {
  const isUser = msg.role === 'user';

  if (isUser) {
    return (
      <div className="chat-msg-bubble" style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ maxWidth: '75%' }}>
          <div style={{
            background: 'var(--bg-active)',
            border: '1px solid var(--border-active)',
            borderRadius: 'var(--radius-md) var(--radius-md) 0 var(--radius-md)',
            padding: '10px 14px',
            fontSize: '13px',
            color: 'var(--text-primary)',
            lineHeight: 1.6,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}>
            {msg.content}
          </div>
          <div style={{
            fontSize: '10px',
            color: 'var(--text-muted)',
            textAlign: 'right',
            marginTop: '3px',
            fontFamily: 'var(--font-mono)',
          }}>
            You · {formatTime(msg.timestamp)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-msg-bubble" style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
      <div style={{
        width: '28px', height: '28px', borderRadius: '50%',
        background: modelColor + '20',
        border: `1px solid ${modelColor}40`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '14px', flexShrink: 0, marginTop: '2px',
      }}>
        {modelInfo.emoji}
      </div>

      <div style={{ flex: 1, minWidth: 0, maxWidth: '80%' }}>
        <div style={{
          background: msg.isError ? 'rgba(239,68,68,0.08)' : 'var(--bg-panel-alt)',
          border: msg.isError ? '1px solid rgba(239,68,68,0.3)' : '1px solid var(--border-subtle)',
          borderRadius: '0 var(--radius-md) var(--radius-md) var(--radius-md)',
          padding: '10px 14px',
          fontSize: '13px',
          color: msg.isError ? 'var(--accent-red)' : 'var(--text-primary)',
          lineHeight: 1.6,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}>
          {msg.content}
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginTop: '3px',
          fontSize: '10px',
          color: 'var(--text-muted)',
          fontFamily: 'var(--font-mono)',
        }}>
          <span style={{ color: modelColor, fontWeight: 600 }}>{modelInfo.name}</span>
          <span>·</span>
          <span>{formatTime(msg.timestamp)}</span>
          {msg.latencyMs && <span>· {msg.latencyMs}ms</span>}
          {msg.tokens && msg.tokens > 0 && <span>· {msg.tokens} tok</span>}
        </div>
      </div>
    </div>
  );
}

export default function ChatView() {
  const [models, setModels] = useState<ChatModel[]>([]);
  const [selectedModel, setSelectedModel] = useState('ai');
  const [chatHistories, setChatHistories] = useState<Record<string, ChatMessage[]>>({});
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [handsFreeEnabled, setHandsFreeEnabled] = useState(loadHandsFreePreference);
  const [voiceSupport, setVoiceSupport] = useState({ canListen: false, canSpeak: false });
  const [voiceStatus, setVoiceStatus] = useState('Hands-free off');
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recognitionRef = useRef<any>(null);
  const handsFreeEnabledRef = useRef(handsFreeEnabled);
  const listeningRef = useRef(false);
  const speakingRef = useRef(false);
  const loadingRef = useRef(false);
  const sendMessageRef = useRef<typeof sendMessage | null>(null);
  const mountedRef = useRef(true);
  const timerRefs = useRef(new Set<ReturnType<typeof setTimeout>>());
  const sttsBufferRef = useRef<string>('');
  const firstAudioStampRef = useRef<number | null>(null);
  const speechEndStampRef = useRef<number | null>(null);

  const schedule = useCallback((fn: () => void, delay = 0) => {
    const timerId = setTimeout(() => {
      timerRefs.current.delete(timerId);
      if (mountedRef.current) fn();
    }, delay);
    timerRefs.current.add(timerId);
    return timerId;
  }, []);

  const clearScheduledTimers = useCallback(() => {
    timerRefs.current.forEach((timerId) => clearTimeout(timerId));
    timerRefs.current.clear();
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearScheduledTimers();
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    };
  }, [clearScheduledTimers]);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return;
    try { recognitionRef.current.stop(); } catch {}
  }, []);

  const startListening = useCallback(() => {
    if (!recognitionRef.current || !voiceSupport.canListen) return;
    if (!handsFreeEnabledRef.current || listeningRef.current || speakingRef.current || loadingRef.current) return;
    try {
      recognitionRef.current.start();
    } catch (error: unknown) {
      const err = error as Error;
      const errorMessage = String(err?.message || '');
      const invalidState = err?.name === 'InvalidStateError' || errorMessage.includes('already started');
      if (!invalidState && mountedRef.current) {
        setVoiceStatus('Microphone unavailable');
      }
    }
  }, [voiceSupport.canListen]);

  const speakAssistantReply = useCallback((text: string) => {
    const speechText = toSpeechText(text);
    if (!speechText) {
      if (handsFreeEnabledRef.current && voiceSupport.canListen) {
        schedule(() => startListening(), 0);
      }
      return;
    }

    if (!voiceSupport.canSpeak || !window.speechSynthesis || typeof window.SpeechSynthesisUtterance !== 'function') {
      setVoiceStatus(handsFreeEnabledRef.current ? 'Hands-free ready' : 'Hands-free off');
      if (handsFreeEnabledRef.current && voiceSupport.canListen) {
        schedule(() => startListening(), 0);
      }
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new window.SpeechSynthesisUtterance(speechText);
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.onstart = () => {
      if (!mountedRef.current) return;
      setSpeaking(true);
      setVoiceStatus('Speaking');
    };
    utterance.onend = () => {
      if (!mountedRef.current) return;
      setSpeaking(false);
      if (handsFreeEnabledRef.current && voiceSupport.canListen) {
        setVoiceStatus('Listening');
        schedule(() => startListening(), 50);
      } else {
        setVoiceStatus(handsFreeEnabledRef.current ? 'Hands-free ready' : 'Hands-free off');
      }
    };
    utterance.onerror = () => {
      if (!mountedRef.current) return;
      setSpeaking(false);
      setVoiceStatus('Voice playback failed');
      if (handsFreeEnabledRef.current && voiceSupport.canListen) {
        schedule(() => startListening(), 50);
      }
    };

    window.speechSynthesis.speak(utterance);
  }, [schedule, startListening, voiceSupport.canListen, voiceSupport.canSpeak]);

  const speakStreaming = useCallback((chunk: string) => {
    if (!voiceSupport.canSpeak || !window.speechSynthesis || typeof window.SpeechSynthesisUtterance !== 'function') {
      return;
    }
    sttsBufferRef.current += chunk;
    const SENT_RE = /[.!?](?=\s|$)/g;
    let lastFlushEnd = 0;
    let match: RegExpExecArray | null;
    while ((match = SENT_RE.exec(sttsBufferRef.current)) !== null) {
      const end = match.index + 1;
      const sentence = sttsBufferRef.current.slice(lastFlushEnd, end).trim();
      if (sentence) {
        const utter = new window.SpeechSynthesisUtterance(toSpeechText(sentence));
        utter.rate = 1;
        utter.pitch = 1;
        if (firstAudioStampRef.current === null) {
          utter.onstart = () => { if (firstAudioStampRef.current === null) firstAudioStampRef.current = performance.now(); };
        }
        window.speechSynthesis.speak(utter);
      }
      lastFlushEnd = end;
    }
    if (lastFlushEnd > 0) {
      sttsBufferRef.current = sttsBufferRef.current.slice(lastFlushEnd);
    }
  }, [voiceSupport.canSpeak]);

  const flushStreamingTail = useCallback(() => {
    const tail = sttsBufferRef.current.trim();
    sttsBufferRef.current = '';
    if (tail && voiceSupport.canSpeak && window.speechSynthesis && typeof window.SpeechSynthesisUtterance === 'function') {
      const utter = new window.SpeechSynthesisUtterance(toSpeechText(tail));
      utter.rate = 1;
      utter.pitch = 1;
      window.speechSynthesis.speak(utter);
    }
  }, [voiceSupport.canSpeak]);

  useEffect(() => {
    const SpeechRecognitionCtor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const canListen = typeof SpeechRecognitionCtor === 'function';
    const canSpeak = !!window.speechSynthesis && typeof window.SpeechSynthesisUtterance === 'function';

    setVoiceSupport({ canListen, canSpeak });

    if (!canListen) return undefined;

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      if (!mountedRef.current) return;
      setListening(true);
      setVoiceStatus('Listening');
    };

    recognition.onresult = (event: any) => {
      if (!mountedRef.current || !handsFreeEnabledRef.current) return;
      const transcript = Array.from(event.results || [])
        .map((result: any) => result?.[0]?.transcript || '')
        .join(' ')
        .trim();

      if (!transcript) return;

      setInputText(transcript);
      setVoiceStatus('Awaiting reply');
      speechEndStampRef.current = performance.now();
      sendMessageRef.current?.(transcript);
    };

    recognition.onerror = (event: any) => {
      if (!mountedRef.current) return;
      setListening(false);
      if (event.error === 'not-allowed') {
        setVoiceStatus('Microphone blocked');
      } else if (event.error !== 'aborted') {
        setVoiceStatus(`Mic error: ${event.error}`);
      }
    };

    recognition.onend = () => {
      if (!mountedRef.current) return;
      setListening(false);
      if (!handsFreeEnabledRef.current) {
        setVoiceStatus('Hands-free off');
        return;
      }
      if (speakingRef.current) {
        setVoiceStatus('Speaking');
        return;
      }
      if (loadingRef.current) {
        setVoiceStatus('Awaiting reply');
        return;
      }
      setVoiceStatus('Hands-free ready');
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.onstart = null;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      try { recognition.stop(); } catch {}
      recognitionRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!handsFreeEnabled) {
      stopListening();
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      setSpeaking(false);
      setVoiceStatus('Hands-free off');
      return undefined;
    }

    if (!voiceSupport.canListen && !voiceSupport.canSpeak) {
      setHandsFreeEnabled(false);
      setVoiceStatus('Hands-free unsupported');
      return undefined;
    }

    if (!voiceSupport.canListen && voiceSupport.canSpeak) {
      setVoiceStatus('Voice replies only');
      return undefined;
    }

    setVoiceStatus('Hands-free ready');
    const timer = schedule(() => startListening(), 200);
    return () => {
      clearTimeout(timer);
      timerRefs.current.delete(timer);
    };
  }, [handsFreeEnabled, schedule, startListening, stopListening, voiceSupport.canListen, voiceSupport.canSpeak]);

  useEffect(() => { handsFreeEnabledRef.current = handsFreeEnabled; try { localStorage.setItem(HANDS_FREE_STORAGE_KEY, handsFreeEnabled ? '1' : '0'); } catch {} }, [handsFreeEnabled]);
  useEffect(() => { listeningRef.current = listening; }, [listening]);
  useEffect(() => { speakingRef.current = speaking; }, [speaking]);
  useEffect(() => { loadingRef.current = loading; }, [loading]);

  async function fetchModels() {
    try {
      if (!mountedRef.current) return;
      setModels([
        { id: 'ai', name: 'AI', emoji: '🤖', role: 'Primary Interface', status: 'online', model: 'glm-5:cloud', messageCount: 0 },
        { id: 'research-director', name: 'Research Director', emoji: '📚', role: 'Hypothesis generation', status: 'online', model: 'glm-5:cloud', messageCount: 0 },
        { id: 'trade-manager', name: 'Trade Manager', emoji: '📈', role: 'Trade supervision', status: 'online', model: 'glm-5:cloud', messageCount: 0 },
        { id: 'mission-control', name: 'Mission Control', emoji: '🎛️', role: 'Final authority', status: 'online', model: 'glm-5:cloud', messageCount: 0 },
        { id: 'meta-harness', name: 'Meta Harness', emoji: '🧠', role: 'System governance advisory', status: 'online', model: 'minimax-m2.7:cloud', messageCount: 0 },
      ]);
    } finally {
      if (mountedRef.current) setModelsLoading(false);
    }
  }

  useEffect(() => {
    fetchModels();
    pollingRef.current = setInterval(fetchModels, 15000);
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, []);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistories, selectedModel, loading]);

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, [selectedModel]);

  function getHistory(modelId: string): ChatMessage[] {
    return chatHistories[modelId] || [];
  }

  function addMessage(modelId: string, msg: ChatMessage) {
    setChatHistories(prev => ({
      ...prev,
      [modelId]: [...(prev[modelId] || []), msg],
    }));
  }

  function updateMessage(modelId: string, msgId: string, patch: Partial<ChatMessage>) {
    setChatHistories(prev => {
      const msgs = prev[modelId] || [];
      const idx = msgs.findIndex(m => m.id === msgId);
      if (idx < 0) return prev;
      const updated = [...msgs];
      updated[idx] = { ...updated[idx], ...patch };
      return { ...prev, [modelId]: updated };
    });
  }

  function clearHistory(modelId: string) {
    setChatHistories(prev => ({ ...prev, [modelId]: [] }));
  }

  async function sendMessage(messageOverride?: string) {
    const text = (messageOverride ?? inputText).trim();
    if (!text || loadingRef.current) return;

    setInputText('');
    setLoading(true);
    loadingRef.current = true;
    if (handsFreeEnabledRef.current && voiceSupport.canListen) {
      stopListening();
      setVoiceStatus('Awaiting reply');
    }

    let speechReply: string | null = null;
    let resumeListening = false;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };
    addMessage(selectedModel, userMsg);

    const history = getHistory(selectedModel)
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .slice(-20)
      .map(m => ({ role: m.role, content: m.content }));

    const voicePath = !!messageOverride && handsFreeEnabledRef.current;

    try {
      const assistantId = `a-${Date.now()}`;
      addMessage(selectedModel, {
        id: assistantId,
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
      });

      const tSpeechEnd = speechEndStampRef.current ?? performance.now();
      speechEndStampRef.current = null;

      const modelInfo = models.find(m => m.id === selectedModel);
      const actualModel = voicePath ? VOICE_MODEL : (modelInfo?.model || 'glm-5:cloud');

      sttsBufferRef.current = '';
      firstAudioStampRef.current = null;
      if (voicePath && window.speechSynthesis) window.speechSynthesis.cancel();

      const res = await fetch(OLLAMA_STREAM_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: actualModel,
          messages: [...history, { role: 'user', content: text }],
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`Bridge returned ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accum = '';
      let buf = '';
      let tFirstChunk: number | null = null;

      outer: while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const obj = JSON.parse(trimmed);
            const delta = obj?.message?.content ?? '';
            if (delta) {
              if (tFirstChunk === null) tFirstChunk = performance.now();
              accum += delta;
              updateMessage(selectedModel, assistantId, { content: accum });
              if (voicePath) speakStreaming(delta);
            }
            if (obj?.done) break outer;
          } catch { /* ignore malformed line */ }
        }
      }

      // Flush any residue in buf (final line without newline)
      if (buf.trim()) {
        try {
          const obj = JSON.parse(buf.trim());
          const delta = obj?.message?.content ?? '';
          if (delta) {
            accum += delta;
            updateMessage(selectedModel, assistantId, { content: accum });
            if (voicePath) speakStreaming(delta);
          }
        } catch { /* ignore */ }
      }

      if (voicePath) flushStreamingTail();

      const tStreamEnd = performance.now();
      const latencyMs = voicePath
        ? Math.round((firstAudioStampRef.current ?? tStreamEnd) - tSpeechEnd)
        : Math.round(tStreamEnd - tSpeechEnd);
      updateMessage(selectedModel, assistantId, { content: accum, latencyMs });

      console.debug('[voice-latency]', {
        voicePath, speechEnd: tSpeechEnd, firstChunk: tFirstChunk, streamEnd: tStreamEnd, firstAudio: firstAudioStampRef.current, latencyMs,
      });

      speechReply = accum;
    } catch (e: unknown) {
      resumeListening = handsFreeEnabledRef.current && voiceSupport.canListen;
      addMessage(selectedModel, {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `Network error: ${(e as Error).message}`,
        isError: true,
        timestamp: new Date().toISOString(),
      });
    } finally {
      if (!mountedRef.current) return;
      setLoading(false);
      loadingRef.current = false;
      if (handsFreeEnabledRef.current && speechReply && !voicePath) {
        speakAssistantReply(speechReply);
      } else if (handsFreeEnabledRef.current && voicePath && voiceSupport.canListen && !speaking) {
        // Voice path: re-arm listening when speech queue drains
        const rearm = () => {
          if (!mountedRef.current || !handsFreeEnabledRef.current) return;
          if (window.speechSynthesis && window.speechSynthesis.speaking) {
            schedule(rearm, 120);
          } else {
            setVoiceStatus('Listening');
            startListening();
          }
        };
        schedule(rearm, 0);
      } else if (resumeListening) {
        setVoiceStatus('Hands-free ready');
        schedule(() => startListening(), 50);
      }
      if (inputRef.current) inputRef.current.focus();
    }
  }

  sendMessageRef.current = sendMessage;

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  const selectedModelInfo = models.find(m => m.id === selectedModel) || {
    id: selectedModel,
    name: selectedModel.charAt(0).toUpperCase() + selectedModel.slice(1),
    emoji: '🤖',
    role: '',
    status: 'unknown',
  };

  const modelColor = MODEL_COLORS[selectedModel] || 'var(--accent-blue)';
  const currentHistory = getHistory(selectedModel);
  const handsFreeAvailable = voiceSupport.canListen || voiceSupport.canSpeak;

  function toggleHandsFree() {
    if (!handsFreeAvailable && !handsFreeEnabled) return;
    setHandsFreeEnabled(prev => !prev);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <style>{`
        @keyframes chatDotPulse {
          0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
        .chat-model-item:hover { background: var(--bg-hover) !important; }
        .chat-msg-bubble { transition: opacity 150ms; }
        .chat-input:focus { outline: none; border-color: var(--accent-blue) !important; }
        .chat-send-btn:hover:not(:disabled) { opacity: 0.85; }
        .chat-send-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        @media (max-width: 1024px) {
          .chat-model-pane { width: 180px !important; }
          .chat-shell { gap: 10px !important; }
        }
        @media (max-width: 768px) {
          .chat-shell { flex-direction: column !important; }
          .chat-model-pane { width: 100% !important; max-height: 148px; padding-bottom: 4px; }
          .chat-input-row { flex-wrap: wrap; }
          .chat-input-row .chat-send-btn { margin-left: auto; }
        }
      `}</style>

      <div className="view-header" style={{ marginBottom: '16px' }}>
        <div>
          <div className="view-title">Chat</div>
          <div className="view-subtitle">Direct line to AI and role subagents</div>
        </div>
      </div>

      <div className="chat-shell" style={{ display: 'flex', flex: 1, gap: '16px', overflow: 'hidden', minHeight: 0 }}>
        <div className="chat-model-pane" style={{
          width: '220px',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          overflowY: 'auto',
        }}>
          <div style={{
            fontSize: '10px',
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            padding: '0 8px 6px',
          }}>
            AI Fleet
          </div>

          {modelsLoading
            ? [1,2,3,4,5,6].map(i => (
                <div key={i} style={{
                  height: '68px', borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-panel)', opacity: 0.5,
                }} />
              ))
            : models.map(m => {
                const isSelected = m.id === selectedModel;
                const color = MODEL_COLORS[m.id] || 'var(--accent-blue)';
                const msgCount = (chatHistories[m.id] || []).length;
                return (
                  <div
                    key={m.id}
                    className="chat-model-item"
                    onClick={() => setSelectedModel(m.id)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-md)',
                      cursor: 'pointer',
                      background: isSelected ? 'var(--bg-active)' : 'var(--bg-panel)',
                      border: isSelected ? `1px solid ${color}40` : '1px solid transparent',
                      boxShadow: isSelected ? `0 0 0 1px ${color}20` : 'none',
                      transition: 'all var(--transition)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                      <span style={{ fontSize: '18px', lineHeight: 1 }}>{m.emoji}</span>
                      <span style={{
                        fontWeight: 600,
                        fontSize: '13px',
                        color: isSelected ? color : 'var(--text-primary)',
                      }}>
                        {m.name}
                      </span>
                      <span style={{
                        marginLeft: 'auto',
                        width: '7px', height: '7px', borderRadius: '50%',
                        flexShrink: 0,
                        background: m.status === 'online' ? 'var(--accent-green)'
                          : m.status === 'offline' ? 'var(--text-muted)'
                          : 'var(--accent-yellow)',
                        boxShadow: m.status === 'online' ? '0 0 4px var(--glow-green)' : 'none',
                      }} />
                    </div>
                    <div style={{
                      fontSize: '11px',
                      color: 'var(--text-muted)',
                      paddingLeft: '26px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {m.role}
                    </div>
                    {msgCount > 0 && (
                      <div style={{
                        fontSize: '10px',
                        fontFamily: 'var(--font-mono)',
                        color: color,
                        paddingLeft: '26px',
                        marginTop: '2px',
                        opacity: 0.8,
                      }}>
                        {msgCount} msg{msgCount !== 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                );
              })
          }
        </div>

        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg-panel)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-subtle)',
          overflow: 'hidden',
          minWidth: 0,
        }}>
          <div className="chat-thread-header" style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            rowGap: '8px',
            padding: '12px 16px',
            borderBottom: '1px solid var(--border-subtle)',
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '22px' }}>{selectedModelInfo.emoji}</span>
              <div>
                <div style={{
                  fontWeight: 600,
                  fontSize: '14px',
                  color: modelColor,
                }}>
                  {selectedModelInfo.name}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {selectedModelInfo.role}
                  {selectedModelInfo.model && (
                    <span style={{ fontFamily: 'var(--font-mono)', marginLeft: '6px', fontSize: '10px' }}>
                      {selectedModelInfo.model}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="chat-thread-controls" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                fontSize: '11px', color: 'var(--text-muted)',
                fontFamily: 'var(--font-mono)',
              }}>
                <span style={{
                  width: '6px', height: '6px', borderRadius: '50%',
                  background: selectedModelInfo.status === 'online' ? 'var(--accent-green)' : 'var(--text-muted)',
                  boxShadow: selectedModelInfo.status === 'online' ? '0 0 4px var(--glow-green)' : 'none',
                }} />
                {selectedModelInfo.status || 'unknown'}
              </span>

              {currentHistory.length > 0 && (
                <button
                  onClick={() => clearHistory(selectedModel)}
                  style={{
                    background: 'none',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '3px 8px',
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-sans)',
                    transition: 'all var(--transition)',
                  }}
                  onMouseOver={e => e.currentTarget.style.color = 'var(--accent-red)'}
                  onMouseOut={e => e.currentTarget.style.color = 'var(--text-muted)'}
                >
                  Clear Chat
                </button>
              )}

              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px',
                color: handsFreeEnabled ? modelColor : 'var(--text-muted)',
                fontFamily: 'var(--font-mono)',
              }}>
                <span style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: listening ? 'var(--accent-green)' : speaking ? 'var(--accent-yellow)' : 'var(--text-muted)',
                  boxShadow: listening ? '0 0 4px var(--glow-green)' : 'none',
                }} />
                {voiceStatus}
              </span>
            </div>
          </div>

          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}>
            {currentHistory.length === 0 && !loading && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: 'var(--text-muted)',
                gap: '10px',
              }}>
                <span style={{ fontSize: '36px', opacity: 0.4 }}>{selectedModelInfo.emoji}</span>
                <div style={{ fontSize: '13px' }}>
                  Message {selectedModelInfo.name}...
                </div>
                <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', opacity: 0.7 }}>
                  {selectedModelInfo.model}
                </div>
              </div>
            )}

            {currentHistory.map(msg => (
              <MessageBubble
                key={msg.id}
                msg={msg}
                modelInfo={selectedModelInfo}
                modelColor={modelColor}
              />
            ))}

            {loading && (
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <div style={{
                  width: '28px', height: '28px', borderRadius: '50%',
                  background: modelColor + '20',
                  border: `1px solid ${modelColor}40`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '14px', flexShrink: 0,
                }}>
                  {selectedModelInfo.emoji}
                </div>
                <div style={{
                  background: 'var(--bg-panel-alt)',
                  borderRadius: '0 var(--radius-md) var(--radius-md) var(--radius-md)',
                  padding: '10px 14px',
                  border: '1px solid var(--border-subtle)',
                }}>
                  <LoadingDots />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <div style={{
            padding: '12px 16px',
            borderTop: '1px solid var(--border-subtle)',
            flexShrink: 0,
          }}>
            <div className="chat-input-row" style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
              <textarea
                ref={inputRef}
                className="chat-input"
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Message ${selectedModelInfo.name}...`}
                rows={1}
                style={{
                  flex: 1,
                  resize: 'none',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '10px 12px',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  fontFamily: 'var(--font-sans)',
                  lineHeight: 1.5,
                  maxHeight: '120px',
                  overflowY: 'auto',
                  transition: 'border-color var(--transition)',
                }}
                onInput={e => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = Math.min(target.scrollHeight, 120) + 'px';
                }}
              />
              <button
                onClick={toggleHandsFree}
                disabled={!handsFreeAvailable && !handsFreeEnabled}
                style={{
                  background: handsFreeEnabled ? `${modelColor}18` : 'transparent',
                  border: `1px solid ${handsFreeEnabled ? `${modelColor}55` : 'var(--border-subtle)'}`,
                  borderRadius: 'var(--radius-md)',
                  minWidth: '104px',
                  height: '38px',
                  padding: '0 12px',
                  color: handsFreeEnabled ? modelColor : 'var(--text-muted)',
                  cursor: handsFreeAvailable ? 'pointer' : 'not-allowed',
                  flexShrink: 0,
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  opacity: handsFreeAvailable || handsFreeEnabled ? 1 : 0.45,
                }}
                title={handsFreeAvailable ? 'Toggle hands-free voice mode' : 'Browser speech APIs unavailable'}
              >
                {listening ? 'Listening' : handsFreeEnabled ? 'Hands-Free On' : 'Hands-Free Off'}
              </button>
              <button
                className="chat-send-btn"
                onClick={() => sendMessage()}
                disabled={!inputText.trim() || loading}
                style={{
                  background: modelColor,
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  width: '38px',
                  height: '38px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  flexShrink: 0,
                  fontSize: '16px',
                  transition: 'opacity var(--transition)',
                }}
              >
                ↑
              </button>
            </div>
            <div style={{
              fontSize: '10px',
              color: 'var(--text-muted)',
              marginTop: '5px',
              fontFamily: 'var(--font-mono)',
            }}>
              Enter to send · Shift+Enter for newline · Hands-free uses browser mic and voice
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}