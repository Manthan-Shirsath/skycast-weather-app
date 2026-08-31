import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { CloudRain, Home, Map, Sparkles, TrendingUp, AlertTriangle, Leaf, MapPin, Menu, Sun, Moon, Search, Bell, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/Command';

const NAV_ITEMS = [
  { name: 'Home', path: '/', icon: Home },
  { name: 'WeatherGPT', path: '/weathergpt', icon: Sparkles, badge: 'AI' },
  { name: 'Forecast', path: '/forecast', icon: TrendingUp },
  { name: 'Forecast Intelligence', path: '/forecast-intelligence', icon: Sparkles, badge: 'PRO' },
  { name: 'Weather Map', path: '/map', icon: Map },
  { name: 'Alerts', path: '/alerts', icon: AlertTriangle },
  { name: 'Climate', path: '/climate', icon: CloudRain },
  { name: 'Agriculture', path: '/agriculture', icon: Leaf },
  { name: 'Locations', path: '/locations', icon: MapPin },
];

function NavLinks({ isMobile, onNavigate }: { isMobile?: boolean, onNavigate?: () => void }) {
  const location = useLocation();
  return (
    <nav className={cn("space-y-1.5 px-3", isMobile ? "mt-6" : "flex-1 overflow-y-auto py-6")}>
      {NAV_ITEMS.map((item) => {
        const isActive = location.pathname === item.path;
        const Icon = item.icon;
        return (
          <Link
            key={item.name}
            to={item.path}
            onClick={onNavigate}
            className={cn(
              "group relative flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 overflow-hidden",
              isActive 
                ? "text-sky-primary shadow-[0_4px_12px_rgba(0,0,0,0.05)] dark:shadow-[0_4px_12px_rgba(0,0,0,0.2)]" 
                : "text-sky-text-secondary hover:text-sky-text-primary hover:bg-sky-surface-elevated/40"
            )}
          >
            {isActive && (
              <div className="absolute inset-0 bg-sky-primary/10 dark:bg-sky-primary/20 backdrop-blur-md rounded-xl -z-10" />
            )}
            {isActive && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-1/2 bg-sky-primary rounded-r-full shadow-glow" />
            )}
            
            <div className="flex items-center">
              <Icon className={cn(
                "h-4 w-4 mr-3 transition-transform duration-300", 
                isActive ? "text-sky-primary scale-110" : "text-sky-text-secondary group-hover:text-sky-text-primary group-hover:scale-110"
              )} />
              <span className="tracking-wide">{item.name}</span>
            </div>
            {item.badge && (
              <span className={cn(
                "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-sm",
                item.badge === 'AI' ? "bg-sky-ai/10 text-sky-ai" : "bg-sky-primary/10 text-sky-primary"
              )}>
                {item.badge}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  );
}

export function AppLayout() {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  const handleLocationSelect = (city: string) => {
    setIsSearchOpen(false);
    setSearchQuery('');
    navigate(`/?city=${encodeURIComponent(city)}`);
  };

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsSearchOpen((open) => !open);
      }
    }
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const toggleTheme = () => {
    document.documentElement.classList.toggle('dark');
  };

  return (
    <div className="flex h-screen w-full bg-sky-background overflow-hidden text-sky-text-primary font-sans antialiased">
      {/* Desktop Sidebar - Premium floating look */}
      <aside className="hidden lg:flex w-72 flex-col bg-sky-surface/60 backdrop-blur-2xl border-r border-sky-border z-20 transition-all duration-300">
        <div className="flex h-20 items-center px-8">
          <div className="bg-gradient-to-tr from-sky-primary to-sky-ai p-2 rounded-xl shadow-md mr-3">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <span className="text-xl font-bold tracking-tight text-sky-text-primary">SkyCast</span>
            <span className="block text-[10px] text-sky-ai font-bold tracking-[0.2em] uppercase -mt-1">Intelligence</span>
          </div>
        </div>
        
        <NavLinks />

        <div className="p-6">
           <button onClick={toggleTheme} className="flex w-full items-center justify-between px-4 py-3 text-sm text-sky-text-secondary hover:text-sky-text-primary rounded-xl hover:bg-sky-surface-elevated/60 transition-all duration-300 group border border-transparent hover:border-sky-border">
              <span className="font-semibold tracking-wide">Toggle Theme</span>
              <div className="bg-sky-surface-elevated p-1.5 rounded-lg group-hover:shadow-sm transition-all">
                <Sun className="h-4 w-4 block dark:hidden text-amber-500" />
                <Moon className="h-4 w-4 hidden dark:block text-sky-primary" />
              </div>
           </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative bg-gradient-to-br from-sky-background to-sky-surface-elevated/30">
        
        {/* Top Header - Glassmorphism */}
        <header className="h-20 glass-panel border-b-0 border-b-[var(--border-glass)] flex items-center justify-between px-4 lg:px-10 z-10 shrink-0 sticky top-0">
          <div className="flex items-center lg:hidden">
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="mr-3">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[300px] p-0 flex flex-col bg-sky-surface/95 backdrop-blur-2xl border-r border-sky-border">
                <div className="flex h-20 items-center px-8 border-b border-sky-border">
                  <div className="bg-gradient-to-tr from-sky-primary to-sky-ai p-2 rounded-xl shadow-md mr-3">
                    <Sparkles className="h-5 w-5 text-white" />
                  </div>
                  <span className="text-xl font-bold tracking-tight">SkyCast</span>
                </div>
                <NavLinks isMobile onNavigate={() => setIsMobileMenuOpen(false)} />
              </SheetContent>
            </Sheet>
            <div className="bg-gradient-to-tr from-sky-primary to-sky-ai p-1.5 rounded-lg shadow-sm mr-2">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight">SkyCast</span>
          </div>

          {/* Desktop/Tablet Topbar Controls */}
          <div className="hidden lg:flex flex-1 items-center gap-6">
             <button 
                onClick={() => setIsSearchOpen(true)}
                className="group flex items-center gap-3 px-4 py-2.5 text-sm text-sky-text-secondary bg-sky-surface/50 hover:bg-sky-surface border border-sky-border hover:border-sky-primary/30 rounded-2xl transition-all shadow-sm hover:shadow-md w-80"
             >
                <Search className="h-4 w-4 text-sky-text-secondary group-hover:text-sky-primary transition-colors" />
                <span className="font-medium">Search locations...</span>
                <kbd className="ml-auto pointer-events-none inline-flex h-6 select-none items-center gap-1 rounded-md border border-sky-border bg-sky-surface-elevated px-2 font-mono text-[10px] font-bold text-sky-text-secondary shadow-sm">
                  <span className="text-xs">⌘</span>K
                </kbd>
             </button>
          </div>

          <div className="flex items-center gap-3">
             <Button variant="ghost" size="icon" onClick={() => setIsSearchOpen(true)} className="lg:hidden rounded-full hover:bg-sky-surface-elevated">
                <Search className="h-5 w-5" />
             </Button>
             <Button variant="ghost" size="icon" className="hidden sm:inline-flex relative rounded-full hover:bg-sky-surface-elevated transition-transform hover:scale-105">
                <Bell className="h-5 w-5 text-sky-text-secondary" />
                <span className="absolute top-2 right-2 h-2.5 w-2.5 rounded-full bg-sky-danger border-2 border-sky-surface animate-pulse"></span>
             </Button>
             <Button variant="ghost" size="icon" className="rounded-full hover:bg-sky-surface-elevated transition-transform hover:scale-105">
                <Settings className="h-5 w-5 text-sky-text-secondary" />
             </Button>
             <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-sky-primary to-sky-ai ml-2 flex items-center justify-center text-white font-bold text-sm shadow-md cursor-pointer hover:shadow-lg transition-all hover:scale-105 border-2 border-sky-surface">
                U
             </div>
          </div>
        </header>

        {/* Global Command Palette */}
        <CommandDialog open={isSearchOpen} onOpenChange={setIsSearchOpen}>
          <CommandInput 
            placeholder="Search locations, forecasts, or ask AI..." 
            value={searchQuery}
            onValueChange={setSearchQuery}
            className="text-lg"
          />
          <CommandList className="p-2">
            <CommandEmpty className="py-6 text-center text-sky-text-secondary">No results found.</CommandEmpty>
            
            {searchQuery.trim().length > 0 && (
              <CommandGroup heading="Search" className="px-2">
                <CommandItem onSelect={() => handleLocationSelect(searchQuery.trim())} className="rounded-lg cursor-pointer">
                  <Search className="mr-3 h-4 w-4 text-sky-primary" />
                  <span className="font-medium">Get weather for <span className="text-sky-primary font-bold">"{searchQuery.trim()}"</span></span>
                </CommandItem>
              </CommandGroup>
            )}

            <CommandGroup heading="Explore Diverse Weather" className="px-2">
              <CommandItem onSelect={() => handleLocationSelect('Yakutsk')} className="rounded-lg cursor-pointer my-1">
                <MapPin className="mr-3 h-4 w-4 text-sky-400" />
                <span className="font-medium">Yakutsk, Russia <span className="text-sky-text-secondary text-xs ml-2">(Extreme Cold / Snow)</span></span>
              </CommandItem>
              <CommandItem onSelect={() => handleLocationSelect('Death Valley')} className="rounded-lg cursor-pointer my-1">
                <MapPin className="mr-3 h-4 w-4 text-orange-500" />
                <span className="font-medium">Death Valley, USA <span className="text-sky-text-secondary text-xs ml-2">(Extreme Heat / Clear)</span></span>
              </CommandItem>
              <CommandItem onSelect={() => handleLocationSelect('Cherrapunji')} className="rounded-lg cursor-pointer my-1">
                <MapPin className="mr-3 h-4 w-4 text-blue-500" />
                <span className="font-medium">Cherrapunji, India <span className="text-sky-text-secondary text-xs ml-2">(Heavy Rain)</span></span>
              </CommandItem>
              <CommandItem onSelect={() => handleLocationSelect('London')} className="rounded-lg cursor-pointer my-1">
                <MapPin className="mr-3 h-4 w-4 text-slate-400" />
                <span className="font-medium">London, UK <span className="text-sky-text-secondary text-xs ml-2">(Cloudy / Fog)</span></span>
              </CommandItem>
              <CommandItem onSelect={() => handleLocationSelect('Pune')} className="rounded-lg cursor-pointer my-1">
                <MapPin className="mr-3 h-4 w-4 text-emerald-500" />
                <span className="font-medium">Pune, India <span className="text-sky-text-secondary text-xs ml-2">(Current Location)</span></span>
              </CommandItem>
            </CommandGroup>
            <CommandGroup heading="Quick Actions" className="px-2">
              <CommandItem onSelect={() => { setIsSearchOpen(false); navigate('/weathergpt'); }} className="rounded-lg cursor-pointer my-1 bg-sky-ai/5">
                <Sparkles className="mr-3 h-4 w-4 text-sky-ai" />
                <span className="text-sky-ai font-bold">Ask WeatherGPT</span>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </CommandDialog>

        {/* Page Content Viewport */}
        <div className="flex-1 overflow-y-auto hide-scrollbar relative z-0">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
