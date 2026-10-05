import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Mic,
  Volume2,
  BookOpen,
  ThumbsUp,
  ThumbsDown,
  ShieldCheck,
  AlertCircle,
  ExternalLink,
  Sparkles,
  RefreshCw,
  X
} from 'lucide-react';
import { TRANSLATIONS, Locale } from '../services/i18n';
import { AdvisoryMessage, Plot, ScanResult, SourceCitation } from '../types';
import { apiClient } from '../services/api';

interface AskTabProps {
  locale: Locale;
  activePlot: Plot | null;
  latestScan: ScanResult | null;
}

export const AskTab: React.FC<AskTabProps> = ({ locale, activePlot, latestScan }) => {
  const t = TRANSLATIONS[locale] || TRANSLATIONS.en;

  const [inputQuestion, setInputQuestion] = useState('');
  const [messages, setMessages] = useState<AdvisoryMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [activeCitationDrawer, setActiveCitationDrawer] = useState<SourceCitation | null>(null);
  const [feedbackSent, setFeedbackSent] = useState<Record<string, boolean>>({});

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => () => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  useEffect(() => {
    const history = apiClient.getAdvisoryHistory();
    if (history.length > 0) {
      setMessages(history);
    } else {
      // Welcome message in current language
      const initialGreeting =
        locale === 'hi'
          ? "नमस्ते! मैं एग्रीब्रिज का प्रयोगात्मक कृषि सूचना सहायक हूँ। उत्तर उदाहरणात्मक हो सकते हैं और इनके स्रोत सत्यापित नहीं हैं।"
          : locale === 'bn'
          ? "নমস্কার! আমি এগ্রিব্রিজ ডিজিটাল কৃষি উপদেষ্টা। রোগ দমন, জৈব সার ও ফসল পর্যায়ক্রম সংক্রান্ত প্রশ্ন করতে পারেন।"
          : "Hello! I am AgriBridge's experimental agricultural information assistant. Replies may use illustrative content with unverified sources; confirm advice with a local agricultural professional.";

      const welcomeMsg: AdvisoryMessage = {
        id: 'msg_welcome',
        sender: 'assistant',
        text: initialGreeting,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages([welcomeMsg]);
    }
  }, [locale]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  const quickChips = [
    locale === 'hi' ? "टमाटर झुलसा रोग का जैविक उपचार क्या है?" : "How to treat early blight organically?",
    locale === 'hi' ? "मक्के के बाद कौन सी दलहनी फसल लगाएं?" : "Best legume rotation after maize?",
    locale === 'hi' ? "क्या बारिश से पहले यूरिया डालना चाहिए?" : "Should I apply fertilizer before rain?"
  ];

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || isStreaming) return;

    const userMsg: AdvisoryMessage = {
      id: `msg_user_${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const botMsgId = `msg_bot_${Date.now()}`;
    const initialBotMsg: AdvisoryMessage = {
      id: botMsgId,
      sender: 'assistant',
      text: '',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const updatedMessages = [...messages, userMsg, initialBotMsg];
    setMessages(updatedMessages);
    setInputQuestion('');
    setIsStreaming(true);

    let accumulatedText = '';

    await apiClient.askAdvisoryStreaming(
      textToSend,
      activePlot?.id,
      locale,
      (tokenChunk) => {
        accumulatedText += tokenChunk;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === botMsgId ? { ...m, text: accumulatedText } : m
          )
        );
      },
      (fullPayload) => {
        setIsStreaming(false);
        setMessages((prev) => {
          const finalMessages = prev.map((m) =>
            m.id === botMsgId
              ? {
                  ...m,
                  text: fullPayload.answer || accumulatedText,
                  sources: fullPayload.sources,
                  safety_disclaimer: fullPayload.safety_disclaimer,
                  generation_source: fullPayload.generation_source,
                  is_demo_data: fullPayload.is_demo_data
                }
              : m
          );
          apiClient.saveAdvisoryHistory(finalMessages);
          return finalMessages;
        });
      },
      (err) => {
        setIsStreaming(false);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === botMsgId
              ? {
                  ...m,
                  text: "Notice: Unable to connect to streaming gateway. Showing cached knowledge: Prioritize field sanitation, organic neem extracts, and consult your nearest Krishi Vigyan Kendra extension officer.",
                  generation_source: 'local_demo_fallback',
                  is_demo_data: true
                }
              : m
          )
        );
      }
    );
  };

  const handleVoiceInput = async () => {
    if (isListening) {
      recorderRef.current?.stop();
      return;
    }

    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
        throw new Error('Local voice recording is not supported by this browser. You can type your question instead.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : undefined;
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks: BlobPart[] = [];
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onerror = () => {
        setIsListening(false);
        stream.getTracks().forEach((track) => track.stop());
        alert('Audio recording failed. Check microphone access and try again.');
      };
      recorder.onstop = async () => {
        setIsListening(false);
        stream.getTracks().forEach((track) => track.stop());
        if (!chunks.length) return;
        try {
          const result = await apiClient.transcribeVoice(new Blob(chunks, { type: recorder.mimeType }), locale);
          setInputQuestion(result.transcript);
        } catch (error) {
          alert(error instanceof Error ? error.message : 'Local Whisper transcription failed.');
        }
      };
      recorder.start();
      setIsListening(true);
    } catch (err) {
      setIsListening(false);
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      alert(err instanceof Error ? err.message : 'Microphone access failed.');
    }
  };

  // Browser SpeechSynthesis Read-Aloud
  const handleReadAloud = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text.replace(/[*#]/g, ''));
      utterance.rate = 0.95;
      if (locale === 'hi') utterance.lang = 'hi-IN';
      else if (locale === 'bn') utterance.lang = 'bn-IN';
      else utterance.lang = 'en-IN';
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleFeedback = (msgId: string, rating: 'helpful' | 'not_helpful') => {
    setFeedbackSent((prev) => ({ ...prev, [msgId]: true }));
    fetch(`/api/v1/advisories/${msgId}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feedback: rating })
    }).catch(() => {});
  };

  return (
    <div className="content-area animate-fade-in" style={{ paddingBottom: 90 }}>
      {/* Title Header */}
      <div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--foreground)', fontFamily: 'var(--font-heading)' }}>
          {t.navAsk}: Localized RAG Advisory
        </h2>
        <p style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)' }}>
          Source-Grounded • Multilingual • Extension-Aligned
        </p>
      </div>

      {/* Active Context Chips Bar (FR-5.1) */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {activePlot && (
          <span className="tag-chip" style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--brand-green)' }}>
            🌱 Plot: {activePlot.name} ({activePlot.crop})
          </span>
        )}
        {latestScan && (
          <span className="tag-chip" style={{ background: 'rgba(56, 189, 248, 0.15)', color: 'var(--brand-blue)' }}>
            🔬 Latest Scan: {latestScan.top_disease} ({Math.round(latestScan.confidence * 100)}%)
          </span>
        )}
        <span className="tag-chip">
          🛡️ Chemical Guardrail Active
        </span>
      </div>

      {/* Quick Question Chips (FR-5.1) */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
        {quickChips.map((chip, i) => (
          <button
            key={i}
            onClick={() => handleSendMessage(chip)}
            style={{
              flexShrink: 0,
              padding: '8px 12px',
              borderRadius: 20,
              background: 'var(--card)',
              border: '1px solid var(--border)',
              color: 'var(--foreground)',
              fontSize: '0.78rem',
              fontWeight: 500,
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Chat Messages Stream */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        minHeight: 280,
        maxHeight: '52vh',
        overflowY: 'auto',
        padding: '6px 2px'
      }}>
        {messages.map((m) => (
          <div
            key={m.id}
            style={{
              alignSelf: m.sender === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '88%',
              background: m.sender === 'user' ? 'linear-gradient(135deg, var(--brand-green) 0%, #059669 100%)' : 'var(--card)',
              border: `1px solid ${m.sender === 'user' ? 'var(--brand-green)' : 'var(--border)'}`,
              borderRadius: m.sender === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
              padding: '12px 16px',
              color: m.sender === 'user' ? '#ffffff' : 'var(--foreground)',
              fontSize: '0.9rem',
              lineHeight: 1.5,
              boxShadow: '0 2px 8px rgba(0,0,0,0.12)'
            }}
          >
            <div style={{ whiteSpace: 'pre-wrap' }}>
              {m.text || (isStreaming ? "Thinking..." : "")}
            </div>

            {m.sender === 'assistant' && m.generation_source && m.id !== 'msg_welcome' && (
              <p role="status" style={{ marginTop: 8, color: m.is_demo_data ? 'var(--brand-amber)' : 'var(--muted-foreground)', fontSize: '0.72rem', fontWeight: 700 }}>
                {m.generation_source === 'gemma_4_api'
                  ? 'Gemma 4 API response'
                  : m.generation_source === 'local_safety_guardrail'
                  ? 'Local safety guardrail'
                  : 'DEMO DATA — local fallback; not generated by Gemma 4'}
              </p>
            )}

            {/* Source Citation Chips (FR-5.2) */}
            {m.sources && m.sources.length > 0 && (
              <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', display: 'block', marginBottom: 4 }}>
                  Demonstration excerpts (source attribution unverified):
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {m.sources.map((src, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveCitationDrawer(src)}
                      style={{
                        background: 'rgba(16, 185, 129, 0.15)',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        borderRadius: 6,
                        padding: '3px 8px',
                        color: 'var(--brand-green)',
                        fontSize: '0.72rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}
                    >
                      <BookOpen size={12} />
                      <span>[{src.source_id}] {src.publisher}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Assistant Message Footer: Read Aloud & Feedback (FR-5.6, FR-7.2) */}
            {m.sender === 'assistant' && m.id !== 'msg_welcome' && m.text && (
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: 8,
                fontSize: '0.72rem',
                color: 'var(--muted-foreground)'
              }}>
                <button
                  onClick={() => handleReadAloud(m.text)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--brand-green)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                >
                  <Volume2 size={14} />
                  <span>Read Aloud</span>
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>Helpful?</span>
                  {!feedbackSent[m.id] ? (
                    <>
                      <button
                        onClick={() => handleFeedback(m.id, 'helpful')}
                        style={{ background: 'none', border: 'none', color: 'var(--muted-foreground)', cursor: 'pointer' }}
                      >
                        <ThumbsUp size={14} />
                      </button>
                      <button
                        onClick={() => handleFeedback(m.id, 'not_helpful')}
                        style={{ background: 'none', border: 'none', color: 'var(--muted-foreground)', cursor: 'pointer' }}
                      >
                        <ThumbsDown size={14} />
                      </button>
                    </>
                  ) : (
                    <span style={{ color: 'var(--brand-green)', fontWeight: 600 }}>Recorded ✓</span>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Control Box */}
      <div style={{
        position: 'sticky',
        bottom: 0,
        background: 'var(--background)',
        paddingTop: 8,
        display: 'flex',
        gap: 8,
        alignItems: 'center'
      }}>
        <button
          onClick={handleVoiceInput}
          className="btn-secondary"
          style={{
            minHeight: 48,
            width: 48,
            padding: 0,
            borderRadius: 12,
            background: isListening ? 'rgba(239, 68, 68, 0.2)' : 'var(--card)',
            borderColor: isListening ? '#ef4444' : 'var(--border)',
            flexShrink: 0
          }}
          title="Local Whisper voice input"
        >
          <Mic size={20} color={isListening ? '#ef4444' : 'var(--brand-green)'} className={isListening ? 'dot-pulse' : ''} />
        </button>

        <input
          id="advisory-query-input"
          type="text"
          value={inputQuestion}
          onChange={(e) => setInputQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSendMessage(inputQuestion);
          }}
          placeholder={isListening ? t.listening : t.askPlaceholder}
          style={{
            flex: 1,
            padding: '13px 16px',
            borderRadius: 12,
            background: 'var(--card)',
            border: '1px solid var(--border)',
            color: 'var(--foreground)',
            fontSize: '0.95rem'
          }}
        />

        <button
          id="advisory-send-btn"
          className="btn-primary"
          onClick={() => handleSendMessage(inputQuestion)}
          disabled={!inputQuestion.trim() || isStreaming}
          style={{
            minHeight: 48,
            width: 48,
            padding: 0,
            borderRadius: 12,
            flexShrink: 0
          }}
        >
          <Send size={18} />
        </button>
      </div>

      {/* Source Citation Modal / Drawer (FR-5.2) */}
      {activeCitationDrawer && (
        <div className="modal-overlay">
          <div className="bottom-sheet" style={{ maxWidth: 500 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <BookOpen size={20} color="var(--brand-green)" />
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--foreground)' }}>
                  [{activeCitationDrawer.source_id}] {activeCitationDrawer.title}
                </h3>
              </div>
              <button
                onClick={() => setActiveCitationDrawer(null)}
                style={{ background: 'none', border: 'none', color: 'var(--muted-foreground)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ fontSize: '0.85rem', color: 'var(--foreground)', background: 'var(--muted)', border: '1px solid var(--border)', padding: 14, borderRadius: 10, lineHeight: 1.6, marginBottom: 14 }}>
              "{activeCitationDrawer.passage_text}"
            </div>

            <div style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)', marginBottom: 16 }}>
              <div><strong>Publisher:</strong> {activeCitationDrawer.publisher}</div>
              <div><strong>License:</strong> {activeCitationDrawer.license}</div>
            </div>

            <button
              className="btn-secondary"
              style={{ width: '100%' }}
              onClick={() => setActiveCitationDrawer(null)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
