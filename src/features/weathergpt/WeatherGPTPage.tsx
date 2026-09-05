import React, { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Send, Sparkles, Bot, User, Loader2, AlertTriangle, CloudRain, MapPin, Droplets } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/api';


// --- Types ---
type CardItem = {
  type: string;
  data: any;
};

type ChatMessage = {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: string;
  cards?: CardItem[];
  isError?: boolean;
};

const AGENT_MODES = [
  { id: 'auto', label: 'Auto (Triage)' },
  { id: 'general', label: 'General Weather' },
  { id: 'agriculture', label: 'Agriculture' },
  { id: 'disaster', label: 'Disaster Risk' },
  { id: 'aviation', label: 'Aviation' },
  { id: 'marine', label: 'Marine' },
  { id: 'research', label: 'Research' },
  { id: 'urban', label: 'Urban' }
];


// --- Component ---
export default function WeatherGPTPage() {
  const [searchParams] = useSearchParams();
  const defaultCity = searchParams.get('city') || 'Pune';
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [agentMode, setAgentMode] = useState<string>('auto');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Initial Greeting
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: 'init-msg',
          role: 'model',
          content: `Hi! I'm WeatherGPT. I can give you detailed forecasts, evaluate rain risks, and help you plan your activities for **${defaultCity}** or anywhere else. What would you like to know?`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    }
  }, [defaultCity, messages.length]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const userText = inputValue.trim();
    const newUserMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, newUserMsg]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await apiFetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: userText,
          city: defaultCity,
          session_id: sessionId,
          agent_mode: agentMode,
          context: {
             page: '/weathergpt',
             active_city: defaultCity
          }
        })
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.session_id) {
        setSessionId(data.session_id);
      }

      const newModelMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: data.reply,
        timestamp: data.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        cards: data.cards
      };

      setMessages(prev => [...prev, newModelMsg]);

    } catch (err) {
      console.error("Chat Error:", err);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: "I'm sorry, I encountered an error connecting to the weather intelligence servers. Please try again.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isError: true
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const renderMessageContent = (content: string) => {
    const parts = content.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
      }
      return <span key={i}>{part}</span>;
    });
  };

  const renderCard = (card: CardItem, index: number) => {
    if (card.type === 'forecast' || card.type === 'hourly_forecast') {
      const data = card.data;
      const target = data.target_period || data.day_forecast || {};
      const temp = target.temperature_c ?? target.avg_temperature_c ?? target.high_c ?? '--';
      const cond = target.condition || 'Unknown';
      const rain = target.rain_chance_pct ?? target.precipitation_probability ?? target.daily_precipitation_probability ?? 0;
      const label = target.time_range || target.hour || target.day || 'Forecast';
      return (
        <Card key={index} className="my-3 border-sky-border bg-sky-surface-elevated/50 shadow-sm max-w-sm">
          <CardContent className="p-4 flex items-center gap-4">
             <div className="bg-sky-background p-3 rounded-full border border-sky-border shadow-sm">
                <CloudRain className="h-6 w-6 text-sky-primary" />
             </div>
             <div>
                <p className="font-semibold text-sky-text-primary text-base">
                  {temp}°C • {cond}
                </p>
                <div className="flex items-center text-sm text-sky-text-secondary mt-1 gap-2">
                   <Badge variant="outline" className="text-[10px] font-normal py-0">
                      {rain}% Rain
                   </Badge>
                   <span>{label}</span>
                </div>
             </div>
          </CardContent>
        </Card>
      );
    }

    if (card.type === 'activity_suitability') {
      const data = card.data;
      return (
        <Card key={index} className="my-3 border-sky-border bg-sky-surface-elevated/50 shadow-sm max-w-sm">
           <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                 <AlertTriangle className={cn("h-4 w-4", data.is_suitable ? "text-sky-success" : "text-sky-warning")} />
                 {data.is_suitable ? "Good to Go!" : "Use Caution"}
              </CardTitle>
           </CardHeader>
           <CardContent className="px-4 pb-4">
              <p className="text-sm text-sky-text-secondary">{data.reason}</p>
           </CardContent>
        </Card>
      )
    }

    if (card.type === 'rain_timeline') {
      const data = card.data;
      const bestWindow = data.dry_windows && data.dry_windows.length > 0 
        ? `${data.dry_windows[0].start_time} - ${data.dry_windows[0].end_time}` 
        : "None expected";

      return (
        <Card key={index} className="my-3 border-sky-border bg-sky-surface-elevated/50 shadow-sm max-w-sm w-full">
          <CardHeader className="pb-2 pt-4 px-4 border-b border-sky-border/50">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-sky-text-primary">
               <Droplets className="h-4 w-4 text-sky-ai" />
               Rain Analysis: {data.location}
            </CardTitle>
            <p className="text-xs text-sky-text-secondary mt-1 font-medium">
               {data.target_date} {data.time_span ? `(Between ${data.time_span[0]}:00 and ${data.time_span[1]}:00)` : (data.time_range ? `(${data.time_range})` : '')}
            </p>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-3">
             <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-sky-background rounded p-2 text-center border border-sky-border/50">
                   <p className="text-[10px] text-sky-text-secondary uppercase tracking-wider mb-1">Max Risk</p>
                   <p className="font-bold text-sky-text-primary">{data.overall_chance}%</p>
                </div>
                <div className="bg-sky-background rounded p-2 text-center border border-sky-border/50">
                   <p className="text-[10px] text-sky-text-secondary uppercase tracking-wider mb-1">Total Rainfall</p>
                   <p className="font-bold text-sky-text-primary">{data.total_precipitation_mm} mm</p>
                </div>
                <div className="col-span-2 bg-sky-background rounded p-2 text-center border border-sky-border/50">
                   <p className="text-[10px] text-sky-text-secondary uppercase tracking-wider mb-1">Best Dry Window</p>
                   <p className="font-medium text-sky-success text-sm">{bestWindow}</p>
                </div>
             </div>
             
             {data.slots && data.slots.length > 0 && (
               <div className="mt-4 border-t border-sky-border/50 pt-3">
                 <p className="text-[10px] text-sky-text-secondary uppercase tracking-wider mb-2">Hourly Breakdown</p>
                 <div className="space-y-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                    {data.slots.map((s: any, idx: number) => (
                       <div key={idx} className="flex justify-between items-center text-sm py-1 border-b border-sky-border/30 last:border-0">
                         <span className="font-medium text-sky-text-primary w-12">{s.time}</span>
                         <div className="flex-1 px-3 flex items-center gap-2">
                           <div className="flex-1 h-1.5 bg-sky-border/50 rounded-full overflow-hidden">
                             <div 
                               className="h-full bg-sky-ai rounded-full" 
                               style={{ width: `${s.precipitation_probability}%` }}
                             />
                           </div>
                           <span className="text-[10px] text-sky-text-secondary w-8 text-right">{s.precipitation_probability}%</span>
                         </div>
                         <span className="text-xs text-sky-text-secondary w-12 text-right">{s.precipitation_mm}mm</span>
                       </div>
                    ))}
                 </div>
               </div>
             )}
          </CardContent>
        </Card>
      );
    }

    return null;
  };

  return (
    <div className="flex flex-col h-full bg-sky-background relative overflow-hidden">
      {/* Header */}
      <div className="flex-none px-6 py-4 border-b border-sky-border bg-sky-surface flex items-center justify-between z-10 shrink-0">
         <div>
           <h1 className="text-xl font-bold text-sky-text-primary flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-sky-ai" />
              WeatherGPT
           </h1>
           <p className="text-sm text-sky-text-secondary mt-0.5">
             AI-powered weather intelligence
           </p>
         </div>
         <div className="flex items-center gap-3">
           <select 
             value={agentMode} 
             onChange={(e) => setAgentMode(e.target.value)}
             className="text-sm bg-sky-surface-elevated border border-sky-border rounded-md px-2 py-1 text-sky-text-primary focus:outline-none focus:ring-1 focus:ring-sky-ai"
           >
             {AGENT_MODES.map(mode => (
               <option key={mode.id} value={mode.id}>{mode.label}</option>
             ))}
           </select>
           <Badge variant="ai" className="shadow-sm hidden md:inline-flex">v2.0 Active</Badge>
         </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 space-y-6 scroll-smooth">
        {messages.map((msg) => (
          <div 
            key={msg.id} 
            className={cn(
              "flex w-full max-w-3xl mx-auto gap-4",
              msg.role === 'user' ? "flex-row-reverse" : "flex-row"
            )}
          >
            {/* Avatar */}
            <div className={cn(
              "flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center shadow-sm border",
              msg.role === 'user' 
                ? "bg-sky-surface text-sky-text-primary border-sky-border" 
                : "bg-sky-ai/10 text-sky-ai border-sky-ai/20"
            )}>
              {msg.role === 'user' ? <User className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
            </div>

            {/* Bubble */}
            <div className={cn(
              "flex flex-col max-w-[85%]",
              msg.role === 'user' ? "items-end" : "items-start"
            )}>
              <div className={cn(
                "px-4 py-3 rounded-2xl shadow-sm border",
                msg.role === 'user'
                  ? "bg-sky-primary text-white border-transparent rounded-tr-sm"
                  : msg.isError 
                    ? "bg-sky-danger/10 text-sky-danger border-sky-danger/20 rounded-tl-sm"
                    : "bg-sky-surface text-sky-text-primary border-sky-border rounded-tl-sm"
              )}>
                <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{renderMessageContent(msg.content)}</p>
              </div>
              
              {/* Cards rendered below the bubble if any */}
              {msg.cards && msg.cards.length > 0 && (
                <div className="mt-2 flex flex-col gap-2 w-full">
                  {msg.cards.map((c, i) => renderCard(c, i))}
                </div>
              )}
              
              <span className="text-[10px] font-medium text-sky-text-secondary mt-1.5 px-1 uppercase tracking-wider">
                {msg.timestamp}
              </span>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex w-full max-w-3xl mx-auto gap-4 flex-row">
             <div className="flex-shrink-0 h-8 w-8 rounded-full bg-sky-ai/10 text-sky-ai flex items-center justify-center shadow-sm border border-sky-ai/20">
               <Sparkles className="h-4 w-4" />
             </div>
             <div className="px-5 py-4 rounded-2xl rounded-tl-sm shadow-sm border border-sky-border bg-sky-surface text-sky-text-primary flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-sky-ai" />
                <span className="text-sm font-medium text-sky-text-secondary">Analyzing weather data...</span>
             </div>
          </div>
        )}

        <div ref={messagesEndRef} className="h-4" />
      </div>

      {/* Input Area */}
      <div className="flex-none p-4 bg-sky-background border-t border-sky-border/50 pb-[max(env(safe-area-inset-bottom),1rem)]">
        <div className="max-w-3xl mx-auto relative">
          <form onSubmit={handleSubmit} className="relative flex items-center shadow-sm rounded-full bg-sky-surface border border-sky-border transition-all focus-within:ring-2 focus-within:ring-sky-ai/20 focus-within:border-sky-ai/50 overflow-hidden">
            <Input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={`Ask about weather in ${defaultCity}...`}
              className="flex-1 h-12 md:h-14 bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-4 md:px-6 text-sm md:text-base shadow-none"
              disabled={isLoading}
            />
            <Button 
              type="submit" 
              size="icon" 
              className={cn("h-9 w-9 md:h-10 md:w-10 mr-1.5 md:mr-2 rounded-full transition-all duration-300 shadow-sm", inputValue.trim() ? "bg-sky-ai hover:bg-sky-ai/90 text-white" : "bg-sky-surface-elevated text-sky-text-secondary")}
              disabled={isLoading || !inputValue.trim()}
            >
              <Send className="h-4 w-4 ml-0.5" />
            </Button>
          </form>
          <div className="text-center mt-2 md:mt-3 hidden md:block">
             <span className="text-xs text-sky-text-secondary flex items-center justify-center gap-1.5">
               <MapPin className="h-3 w-3" />
               Current context: <span className="font-semibold text-sky-text-primary">{defaultCity}</span>
             </span>
          </div>
        </div>
      </div>
    </div>
  );
}
