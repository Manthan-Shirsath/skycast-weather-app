import React, { useState, useRef, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useWeather } from '../context/WeatherContext';
import { useTranslation } from '../context/LanguageContext';
import { useVoiceAssistant } from '../hooks/useVoiceAssistant';
import { sendChatQuestion } from '../services/weatherApi';
import {
  Send,
  Sparkles,
  Bot,
  User,
  Loader2,
  RefreshCcw,
  ExternalLink,
  Thermometer,
  CloudRain,
  Wind,
  ShieldAlert,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Sprout,
  Lightbulb,
  ArrowRight,
  Info
} from 'lucide-react';
import { WeatherIconRenderer, WaterDropIcon } from '../components/WeatherIcons';

export function WeatherGPTPage() {
  const { currentCity, weatherData, formatTemp, formatWind } = useWeather();
  const { t, language } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const city = searchParams.get('city') || currentCity || 'Pune';

  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(() => `session-${Date.now()}`);
  const [speakingMsgId, setSpeakingMsgId] = useState(null);

  const [messages, setMessages] = useState([
    {
      id: 'msg-1',
      sender: 'ai',
      text: `Hello! I'm WeatherGPT, your Atmospheric Intelligence AI for ${city}. Ask me about rain, travel advisories, temperature shifts, packing, or crop spraying schedules!`,
      time: '12:00 PM',
      cards: []
    }
  ]);

  const messagesEndRef = useRef(null);

  // Voice Assistant Integration
  const {
    voiceState,
    transcript,
    isSupported: isVoiceSupported,
    startListening,
    stopListening,
    speak,
    stopSpeaking
  } = useVoiceAssistant({
    onTranscriptReady: (spokenText) => {
      if (spokenText && spokenText.trim()) {
        handleSendMessage(spokenText.trim());
      }
    }
  });

  const suggestedQuestions = [
    t('quick_q_tomorrow', `Will it rain tomorrow in ${city}?`),
    t('quick_q_umbrella', `Do I need an umbrella in ${city}?`),
    t('quick_q_spray', `Can I spray my crop tomorrow in ${city}?`),
    t('quick_q_travel', `Is it good for travel in ${city}?`),
    t('quick_q_event', `Is today good for an outdoor event in ${city}?`),
    `Compare ${city} and Mumbai`
  ];

  // Auto scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Auto-send query param 'q' if provided (e.g. from Home Quick Questions)
  const initialQueryTriggered = useRef(false);
  useEffect(() => {
    const q = searchParams.get('q') || searchParams.get('question');
    if (q && !initialQueryTriggered.current) {
      initialQueryTriggered.current = true;
      handleSendMessage(q);
    }
  }, [searchParams]);

  const handleSendMessage = async (textToSend) => {
    const query = (textToSend || inputMessage).trim();
    if (!query || isLoading) return;

    const userTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newMsgId = `user-${Date.now()}`;

    // Add user message
    const updated = [
      ...messages,
      { id: newMsgId, sender: 'user', text: query, time: userTime, cards: [] }
    ];
    setMessages(updated);
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await sendChatQuestion(query, city, messages, language);
      const aiTime = response.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (response.session_id) {
        setSessionId(response.session_id);
      }

      setMessages(prev => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          sender: 'ai',
          text: response.reply,
          time: aiTime,
          cards: response.cards || [],
          sources: response.sources || []
        }
      ]);
    } catch (err) {
      // Local fallback reasoning
      const fallbackReply = `In ${city}, current temperature is ${weatherData?.tempC || 27}°C with ${weatherData?.condition || 'partly cloudy'} conditions. Rain chance is ${weatherData?.insight?.rainChance || 20}%.`;
      setMessages(prev => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          sender: 'ai',
          text: fallbackReply,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          cards: []
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestedClick = (questionText) => {
    handleSendMessage(questionText);
  };

  const handleClearChat = () => {
    stopSpeaking();
    setSessionId(`session-${Date.now()}`);
    setMessages([
      {
        id: `msg-${Date.now()}`,
        sender: 'ai',
        text: `Conversation reset. How can I assist you with the weather in ${city}?`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        cards: []
      }
    ]);
  };

  const handleToggleSpeak = (msgId, text) => {
    if (speakingMsgId === msgId) {
      stopSpeaking();
      setSpeakingMsgId(null);
    } else {
      stopSpeaking();
      setSpeakingMsgId(msgId);
      speak(text);
    }
  };

  /* Render Structured Tool Cards */
  const renderCard = (card, idx) => {
    if (!card || !card.data) return null;
    const { type, data: p } = card;

    // 1. Current Weather Card
    if (type === 'current_weather') {
      return (
        <div key={idx} className="ai-tool-card ai-current-card animate-scale-up">
          <div className="ai-card-header">
            <Thermometer size={16} />
            <span className="ai-card-title">{p.city || p.location || city} Current Atmosphere</span>
          </div>
          <div className="ai-current-body">
            <div className="ai-current-temp-block">
              <span className="ai-card-temp stitch-display-temp">{formatTemp(p.temperature || p.temperature_c)}</span>
              <span className="ai-card-condition">{p.condition}</span>
            </div>
            <div className="ai-current-metrics">
              <span>Humidity: <strong>{p.humidity || p.humidity_pct}%</strong></span>
              <span>Wind: <strong>{formatWind(p.windSpeed || p.wind_speed_kmh)}</strong></span>
              <span>Rain Chance: <strong>{p.rainChance ?? p.rain_chance_pct ?? 0}%</strong></span>
            </div>
          </div>
        </div>
      );
    }

    // 2. Risk Card
    if (type === 'risk' || type === 'alert') {
      const riskColor = (p.skycastRiskColour || p.severity || 'yellow').toLowerCase();
      return (
        <div key={idx} className={`ai-tool-card ai-risk-card severity-${riskColor} animate-scale-up`}>
          <div className="ai-card-header">
            <ShieldAlert size={16} />
            <span className="ai-card-title">Skycast Weather Risk: {(p.skycastRiskColour || p.severity || 'Normal').toUpperCase()}</span>
          </div>
          <p className="ai-risk-desc">{p.explanation || p.title || p.desc}</p>
          <div className="ai-risk-footer">
            <span className="ai-risk-directive">{p.actionDirective || 'Be Prepared'}</span>
            <button
              type="button"
              className="ai-card-action-link"
              onClick={() => navigate(`/alerts?city=${encodeURIComponent(city)}`)}
            >
              Open Safety Center →
            </button>
          </div>
        </div>
      );
    }

    // 3. Agriculture Card
    if (type === 'agriculture') {
      const spray = p.spraying_advisory || {};
      const irrigation = p.irrigation_advisory || {};
      return (
        <div key={idx} className="ai-tool-card ai-agri-card animate-scale-up">
          <div className="ai-card-header">
            <Sprout size={16} className="text-emerald-500" />
            <span className="ai-card-title">{p.crop || 'Crop'} Advisory: Spraying & Irrigation</span>
          </div>
          <div className="ai-agri-body">
            <div className="ai-agri-status-row">
              <span className="agri-label">Spraying Suitability:</span>
              <strong className={`agri-badge ${spray.status?.toLowerCase()}`}>{spray.status} ({spray.score}/100)</strong>
            </div>
            <p className="ai-agri-text">{spray.summary}</p>
            <div className="ai-agri-window">
              <span className="window-label">Recommended Window:</span> {spray.window}
            </div>
            <div className="ai-agri-irrigation">
              <span className="irrigation-label">Irrigation:</span> {irrigation.guidance}
            </div>
          </div>
          <button
            type="button"
            className="ai-card-action-btn"
            onClick={() => navigate(`/agriculture?city=${encodeURIComponent(p.location || city)}&crop=${encodeURIComponent(p.crop || 'Cotton')}`)}
          >
            <span>Open Full Farmer Advisory</span>
            <ExternalLink size={13} />
          </button>
        </div>
      );
    }

    // 4. Recommendation Card
    if (type === 'recommendation') {
      const recs = Array.isArray(p.recommendations) ? p.recommendations : [p.recommendations || p];
      return (
        <div key={idx} className="ai-tool-card ai-rec-card animate-scale-up">
          <div className="ai-card-header">
            <Lightbulb size={16} className="text-amber-500" />
            <span className="ai-card-title">Practical Decision Guidance</span>
          </div>
          <div className="ai-rec-list">
            {recs.slice(0, 2).map((r, rIdx) => (
              <div key={rIdx} className="ai-rec-item">
                <span className="ai-rec-emoji">{r.emoji || '💡'}</span>
                <div>
                  <div className="ai-rec-title">{r.title} ({r.verdict?.toUpperCase()})</div>
                  <div className="ai-rec-action">{r.action}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    // 5. Comparison Card
    if (type === 'comparison') {
      return (
        <div key={idx} className="ai-tool-card ai-comparison-card animate-scale-up">
          <div className="ai-card-header">
            <span className="ai-card-title">Comparative Analysis: {p.primary} vs {p.comparison}</span>
          </div>
          <div className="ai-comparison-grid">
            <div className="ai-comp-col">
              <span className="ai-comp-city">{p.primary}</span>
              <span className="ai-comp-temp">{formatTemp(p.primaryTemp)}</span>
            </div>
            <div className="ai-comp-vs">VS</div>
            <div className="ai-comp-col">
              <span className="ai-comp-city">{p.comparison}</span>
              <span className="ai-comp-temp">{formatTemp(p.compTemp)}</span>
            </div>
          </div>
        </div>
      );
    }

    // 6. Forecast Card
    if (type === 'forecast') {
      const daily = p.daily || (Array.isArray(p) ? p : [p]);
      return (
        <div key={idx} className="ai-tool-card ai-forecast-card animate-scale-up">
          <div className="ai-card-header">
            <Calendar size={16} />
            <span className="ai-card-title">{p.city || city} 7-Day Forecast Overview</span>
          </div>
          <div className="ai-forecast-grid">
            {daily.slice(0, 5).map((d, i) => (
              <div key={i} className="ai-forecast-day-cell">
                <span className="ai-forecast-day-name">{d.day || d.date}</span>
                <span className="ai-forecast-condition">{d.condition}</span>
                <span className="ai-forecast-temps">{formatTemp(d.highC || d.high_c)} / {formatTemp(d.lowC || d.low_c)}</span>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="ai-card-action-btn"
            onClick={() => navigate(`/details?city=${encodeURIComponent(p.city || city)}`)}
          >
            <span>Explore 7-Day Atmospheric Charts</span>
            <ExternalLink size={13} />
          </button>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="weathergpt-page-layout">
      {/* Left Column: Suggested Questions Chips */}
      <aside className="weathergpt-sidebar" aria-label="Suggested Weather Questions">
        <div className="weathergpt-sidebar-header">
          <Sparkles size={16} className="text-violet-600" />
          <span className="weathergpt-sidebar-title">{t('ask_anything_placeholder', 'Suggested questions')}</span>
        </div>

        <div className="weathergpt-suggestions-list">
          {suggestedQuestions.map((q, idx) => (
            <button
              key={idx}
              type="button"
              className="weathergpt-chip-btn"
              onClick={() => handleSuggestedClick(q)}
            >
              <span>{q}</span>
            </button>
          ))}
        </div>

        <div className="weathergpt-sidebar-footer">
          <button
            type="button"
            className="weathergpt-clear-btn"
            onClick={handleClearChat}
            aria-label="Reset Conversation"
          >
            <RefreshCcw size={14} />
            <span>Reset Conversation</span>
          </button>
        </div>
      </aside>

      {/* Right Column: Interactive Chat Panel */}
      <main className="weathergpt-chat-container" aria-label="WeatherGPT Chat">
        {/* Voice Listening Active Wave Banner */}
        {voiceState === 'listening' && (
          <div className="voice-listening-banner animate-fade-in">
            <Mic size={18} className="voice-mic-pulsing" />
            <span>{transcript ? `"${transcript}"` : t('voice_listening', 'Listening... Speak your weather question')}</span>
            <button
              type="button"
              className="voice-stop-btn"
              onClick={stopListening}
            >
              {t('voice_stop', 'Stop')}
            </button>
          </div>
        )}

        {/* Messages Stream */}
        <div className="weathergpt-messages-stream">
          {messages.map((msg) => {
            const isUser = msg.sender === 'user';
            return (
              <div key={msg.id} className={`weathergpt-message-row ${isUser ? 'user-row' : 'ai-row'}`}>
                {!isUser && (
                  <div className="weathergpt-avatar-ai">
                    <Sparkles size={18} />
                  </div>
                )}

                <div className={`weathergpt-bubble ${isUser ? 'user-bubble' : 'ai-bubble'}`}>
                  {!isUser && (
                    <div className="weathergpt-bot-header">
                      <span className="weathergpt-bot-name">WeatherGPT</span>
                      <span className="weathergpt-bot-badge">AI Atmospheric Intelligence</span>
                      <button
                        type="button"
                        className="weathergpt-tts-btn"
                        onClick={() => handleToggleSpeak(msg.id, msg.text)}
                        title="Read aloud"
                        aria-label="Read response aloud"
                      >
                        {speakingMsgId === msg.id ? <VolumeX size={14} /> : <Volume2 size={14} />}
                      </button>
                    </div>
                  )}
                  <p className="weathergpt-text">{msg.text}</p>

                  {/* Rendered Tool Cards */}
                  {msg.cards && msg.cards.length > 0 && (
                    <div className="weathergpt-cards-container">
                      {msg.cards.map((card, cIdx) => renderCard(card, cIdx))}
                    </div>
                  )}

                  <span className="weathergpt-time">{msg.time}</span>
                </div>

                {isUser && (
                  <div className="weathergpt-avatar-user">
                    <User size={16} />
                  </div>
                )}
              </div>
            );
          })}

          {/* Typing Indicator */}
          {isLoading && (
            <div className="weathergpt-message-row ai-row">
              <div className="weathergpt-avatar-ai">
                <Sparkles size={18} />
              </div>
              <div className="weathergpt-bubble ai-bubble typing-bubble">
                <div className="typing-dots">
                  <span className="dot" />
                  <span className="dot" />
                  <span className="dot" />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Chat Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="weathergpt-input-form"
        >
          <input
            type="text"
            className="weathergpt-chat-input"
            placeholder={`${t('ask_anything_placeholder', 'Ask anything about the weather in')} ${city}...`}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            disabled={isLoading}
            aria-label="Ask WeatherGPT"
          />

          {isVoiceSupported && (
            <button
              type="button"
              className={`weathergpt-mic-btn ${voiceState === 'listening' ? 'active-listening' : ''}`}
              onClick={voiceState === 'listening' ? stopListening : startListening}
              title="Voice Input"
              aria-label="Voice input"
            >
              {voiceState === 'listening' ? <MicOff size={16} /> : <Mic size={16} />}
            </button>
          )}

          <button
            type="submit"
            className="weathergpt-send-btn"
            disabled={!inputMessage.trim() || isLoading}
            aria-label="Send message"
          >
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </form>

        <span className="weathergpt-disclaimer">
          WeatherGPT delivers meteorological intelligence grounded in validated data. Verify critical safety warnings with published authorities.
        </span>
      </main>
    </div>
  );
}
