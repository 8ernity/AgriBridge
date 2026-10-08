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
  History,
  MessageSquare,
  Trash2,
  X
} from 'lucide-react';
import { TRANSLATIONS, Locale } from '../services/i18n';
import { AdvisoryMessage, Plot, ScanResult, SourceCitation, ChatSession } from '../types';
import { apiClient, API_BASE } from '../services/api';
import { useSpeechToText } from '../hooks/useSpeechToText';

interface AskTabProps {
  locale: Locale;
  activePlot: Plot | null;
  latestScan: ScanResult | null;
}

export const AskTab: React.FC<AskTabProps> = ({ locale, activePlot, latestScan }) => {
  const t = TRANSLATIONS[locale] || TRANSLATIONS.en;

const [inputQuestion, setInputQuestion] = useState('');
  const [interimText, setInterimText] = useState('');
  const [messages, setMessages] = useState<AdvisoryMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeCitationDrawer, setActiveCitationDrawer] = useState<SourceCitation | null>(null);
  const [feedbackSent, setFeedbackSent] = useState<Record<string, boolean>>({});

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<ChatSession | null>(null);
  const lastScanIdRef = useRef<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const getLocale = (lang: string) => {
    if (lang === 'bn') return 'bn-IN';
    if (lang === 'hi') return 'hi-IN';
    return 'en-IN';
  };

  const handleTranscriptChange = (finalText: string, liveInterim: string) => {
    if (finalText) {
      setInputQuestion((prev) => prev + finalText);
    }
    setInterimText(liveInterim);
  };

  const { isListening, toggleListening, error: micError } = useSpeechToText({
    onTranscriptChange: handleTranscriptChange,
    language: getLocale(locale),
  });

  useEffect(() => {
    const loadedSessions = apiClient.getChatSessions();
    setSessions(loadedSessions);

    if (!currentSessionId) {
      if (loadedSessions.length > 0) {
        const mostRecent = loadedSessions[0];
        if (mostRecent.messages.length <= 1) {
          setCurrentSessionId(mostRecent.id);
          setMessages(mostRecent.messages);
        } else {
          createNewSession();
        }
      } else {
        createNewSession();
      }
    }
  }, []);

  const createNewSession = () => {
    const initialGreeting =
        locale === 'hi'
          ? "नमस्ते! मैं एग्रीब्रिज का प्रयोगात्मक कृषि सूचना सहायक हूँ। उत्तर उदाहरणात्मक हो सकते हैं।"
          : locale === 'bn'
          ? "নমস্কার! আমি এগ্রিব্রিজ ডিজিটাল কৃষি উপদেষ্টা। প্রশ্ন করতে পারেন।"
          : "Hello! I am AgriBridge's experimental agricultural information assistant. Confirm advice with a local agricultural professional.";

    const welcomeMsg: AdvisoryMessage = {
      id: `msg_welcome_${Date.now()}`,
      sender: 'assistant',
      text: initialGreeting,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    
    const newSession: ChatSession = {
      id: `session_${Date.now()}`,
      title: 'New Chat',
      updatedAt: new Date().toISOString(),
      messages: [welcomeMsg]
    };
    
    apiClient.saveChatSession(newSession);
    setSessions(apiClient.getChatSessions());
    setCurrentSessionId(newSession.id);
    setMessages(newSession.messages);
    setShowHistory(false);
  };
  
  const selectSession = (id: string) => {
    const session = sessions.find(s => s.id === id);
    if (session) {
      setCurrentSessionId(id);
      setMessages(session.messages);
      setShowHistory(false);
    }
  };

  const confirmDeleteSession = () => {
    if (!sessionToDelete) return;
    apiClient.deleteChatSession(sessionToDelete.id);
    const updatedSessions = apiClient.getChatSessions();
    setSessions(updatedSessions);
    if (currentSessionId === sessionToDelete.id) {
      if (updatedSessions.length > 0) {
        setCurrentSessionId(updatedSessions[0].id);
        setMessages(updatedSessions[0].messages);
      } else {
        createNewSession();
      }
    }
    setSessionToDelete(null);
  };

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

    const currentSession = sessions.find(s => s.id === currentSessionId);
    const sessionScanId = currentSession?.scanId || latestScan?.scan_id;
    const sessionPlotId = currentSession?.plotId || activePlot?.id;

    await apiClient.askAdvisoryStreaming(
      textToSend,
      sessionPlotId,
      sessionScanId,
      locale,
      messages.map(m => ({ role: m.sender === 'user' ? 'user' : 'assistant', content: m.text })),
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
          
          // Update current session
          if (currentSessionId) {
            const sess = apiClient.getChatSession(currentSessionId);
            if (sess) {
              sess.messages = finalMessages;
              if (sess.title === 'New Chat' && userMsg.text) {
                sess.title = userMsg.text.substring(0, 30) + '...';
                sess.scanId = sessionScanId;
                sess.plotId = sessionPlotId;
              }
              sess.updatedAt = new Date().toISOString();
              apiClient.saveChatSession(sess);
              setSessions(apiClient.getChatSessions());
            }
          }
    
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
    fetch(`${API_BASE}/advisories/${msgId}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feedback: rating })
    }).catch(() => {});
  };

return (
    <div className="content-area animate-fade-in" style={{ 
      display: 'flex', 
      flexDirection: 'row',
      height: 'calc(100dvh - 140px)', // Fixed height for chat bot feel
      overflow: 'hidden'
    }}>
      {/* Left Sidebar (History) */}
      <div style={{
        width: showHistory ? '260px' : '0',
        opacity: showHistory ? 1 : 0,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        overflow: 'hidden',
        borderRight: showHistory ? '1px solid var(--border)' : 'none',
        display: 'flex',
        flexDirection: 'column',
        marginRight: showHistory ? '16px' : '0',
        flexShrink: 0
      }}>
        <div style={{ minWidth: '240px', display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--foreground)' }}>Chat History</h3>
          </div>
          
          <button className="btn-primary" onClick={createNewSession} style={{ marginBottom: 16, width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <MessageSquare size={16} style={{ marginRight: 8 }} /> New Chat
          </button>
          
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, paddingRight: '4px' }}>
            {sessions.map(s => (
              <div 
                key={s.id} 
                onClick={() => selectSession(s.id)}
                style={{ 
                  padding: 12, 
                  borderRadius: 12, 
                  background: s.id === currentSessionId ? 'var(--brand-green)' : 'var(--card)',
                  color: s.id === currentSessionId ? '#fff' : 'var(--foreground)',
                  border: '1px solid var(--border)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, paddingRight: 8 }}>{s.title}</div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setSessionToDelete(s); }}
                    style={{ 
                      background: 'none', 
                      border: 'none', 
                      color: s.id === currentSessionId ? 'rgba(255,255,255,0.7)' : 'var(--muted-foreground)', 
                      cursor: 'pointer',
                      padding: 0
                    }}
                    title="Delete Chat"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>
                  {new Date(s.updatedAt).toLocaleDateString()} {new Date(s.updatedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </div>
              </div>
            ))}
            {sessions.length === 0 && <p style={{ color: 'var(--muted-foreground)', fontSize: '0.85rem', textAlign: 'center', marginTop: 20 }}>No previous chats.</p>}
          </div>
        </div>
      </div>

      {/* Main Chat Content */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0
      }}>
{/* Title Header with History Toggle */}
      <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--foreground)', fontFamily: 'var(--font-heading)' }}>
            {t.navAsk}: Localized RAG Advisory
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)' }}>
            Source-Grounded - Multilingual - Extension-Aligned
          </p>
        </div>
        <button 
          onClick={() => setShowHistory(prev => !prev)}
          style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px', cursor: 'pointer', color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <History size={18} />
          <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>History</span>
        </button>
      </div>



      {/* Active Context Chips Bar (FR-5.1) */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8, flexShrink: 0 }}>
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
      <div
        className="scrollbar-hide"
        style={{
          display: 'flex',
          gap: 6,
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          paddingBottom: 4,
          marginTop: 8,
          flexShrink: 0
        }}
      >
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
        flex: 1, // takes up remaining space!
        padding: '12px 2px',
        overflowY: 'auto'
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
        flexShrink: 0,
        background: 'var(--background)',
        paddingTop: 8,
        paddingBottom: 8,
        display: 'flex',
        gap: 8,
        alignItems: 'center',
        borderTop: '1px solid var(--border)',
        marginTop: 'auto'
      }}>
        {micError && <p style={{ position: 'absolute', transform: 'translateY(-30px)', color: '#ef4444', fontSize: '0.75rem', fontWeight: 600 }}>{micError}</p>}
        <button
          onClick={toggleListening}
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
          title="Real-time voice input"
        >
          <Mic size={20} color={isListening ? '#ef4444' : 'var(--brand-green)'} className={isListening ? 'dot-pulse' : ''} />
        </button>

        <input
          id="advisory-query-input"
          type="text"
          value={inputQuestion + (interimText ? ` ${interimText}` : '')}
          onChange={(e) => setInputQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSendMessage(inputQuestion);
          }}
          placeholder={isListening ? 'Listening... speak now...' : t.askPlaceholder}
          style={{
            flex: 1,
            padding: '13px 16px',
            borderRadius: 12,
            background: 'var(--card)',
            border: '1px solid var(--border)',
            color: 'var(--foreground)',
            fontSize: '16px'
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

      {/* Delete Confirmation Modal */}
      {sessionToDelete && (
        <div className="modal-overlay" style={{ zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="bottom-sheet" style={{ maxWidth: 360, width: '90%', margin: '0 auto', textAlign: 'center', padding: '24px', animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Trash2 size={24} color="#ef4444" />
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--foreground)', marginBottom: 8 }}>Delete Chat?</h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--muted-foreground)', marginBottom: 24 }}>
              Are you sure you want to delete "{sessionToDelete.title}"? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button 
                onClick={() => setSessionToDelete(null)}
                style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--foreground)', fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button 
                onClick={confirmDeleteSession}
                style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', background: '#ef4444', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
    </div>
  );
};
