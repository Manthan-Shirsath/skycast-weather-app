import React, { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Send, Sparkles, Bot, User, Loader2, AlertTriangle, CloudRain, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';

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

// --- Component ---
export default function WeatherGPTPage() {
  const [searchParams] = useSearchParams();
  const defaultCity = searchParams.get('city') || 'Pune';
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  
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
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: userText,
          city: defaultCity,
          session_id: sessionId,
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

  const renderCard = (card: CardItem, index: number) => {
    if (card.type === 'forecast' || card.type === 'hourly_forecast') {
      const data = card.data;
      const target = data.target_period || {};
      return (
        <Card key={index} className="my-3 border-sky-border bg-sky-surface-elevated/50 shadow-sm max-w-sm">
          <CardContent className="p-4 flex items-center gap-4">
             <div className="bg-sky-background p-3 rounded-full border border-sky-border shadow-sm">
                <CloudRain className="h-6 w-6 text-sky-primary" />
             </div>
             <div>
                <p className="font-semibold text-sky-text-primary text-base">
                  {target.temperature_c || target.avg_temperature_c || '--'}°C • {target.condition || 'Unknown'}
                </p>
                <div className="flex items-center text-sm text-sky-text-secondary mt-1 gap-2">
                   <Badge variant="outline" className="text-[10px] font-normal py-0">
                      {target.rain_chance_pct ?? target.precipitation_probability ?? 0}% Rain
                   </Badge>
                   <span>{target.time_range || target.hour || 'Forecast'}</span>
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
         <Badge variant="ai" className="shadow-sm">v2.0 Active</Badge>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 space-y-6 scroll-smooth pb-32">
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
                <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
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

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-sky-background via-sky-background/95 to-transparent pt-12">
        <div className="max-w-3xl mx-auto relative">
          <form onSubmit={handleSubmit} className="relative flex items-center shadow-lg rounded-full bg-sky-surface border border-sky-border transition-all focus-within:ring-2 focus-within:ring-sky-ai/20 focus-within:border-sky-ai/50 overflow-hidden">
            <Input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={`Ask about weather in ${defaultCity}...`}
              className="flex-1 h-14 bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-6 text-base shadow-none"
              disabled={isLoading}
            />
            <Button 
              type="submit" 
              size="icon" 
              className={cn("h-10 w-10 mr-2 rounded-full transition-all duration-300 shadow-md", inputValue.trim() ? "bg-sky-ai hover:bg-sky-ai/90 text-white" : "bg-sky-surface-elevated text-sky-text-secondary")}
              disabled={isLoading || !inputValue.trim()}
            >
              <Send className="h-4 w-4 ml-0.5" />
            </Button>
          </form>
          <div className="text-center mt-3">
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
