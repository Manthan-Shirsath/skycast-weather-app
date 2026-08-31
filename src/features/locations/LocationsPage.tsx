import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Search, Plus, Trash2, Loader2, Info } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

// NOTE: The backend currently lacks a dedicated `/api/user/locations` persistence endpoint.
// For now, this uses localStorage as a fallback, but a future backend expansion should 
// migrate this state to a persistent database table for the authenticated user.

export default function LocationsPage() {
  const navigate = useNavigate();
  const [locations, setLocations] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [weatherData, setWeatherData] = useState<Record<string, any>>({});

  useEffect(() => {
    // Load from local storage
    const saved = localStorage.getItem('skycast_saved_locations');
    let parsed = ['Pune', 'Mumbai']; // defaults
    if (saved) {
      try {
        parsed = JSON.parse(saved);
      } catch (e) {}
    }
    setLocations(parsed);
  }, []);

  useEffect(() => {
    // Fetch current weather for all saved locations
    async function fetchAllWeather() {
      if (locations.length === 0) {
        setLoading(false);
        return;
      }
      
      setLoading(true);
      try {
        const results: Record<string, any> = {};
        await Promise.all(locations.map(async (city) => {
          try {
            const res = await fetch(`/api/weather/current?city=${encodeURIComponent(city)}`);
            if (res.ok) {
              results[city] = await res.json();
            }
          } catch (e) {
            console.error(`Failed to fetch for ${city}`, e);
          }
        }));
        setWeatherData(results);
      } finally {
        setLoading(false);
      }
    }
    
    if (locations.length > 0) {
      fetchAllWeather();
    }
  }, [locations]);

  const addLocation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    const city = searchQuery.trim();
    if (!locations.includes(city)) {
      const newLocs = [...locations, city];
      setLocations(newLocs);
      localStorage.setItem('skycast_saved_locations', JSON.stringify(newLocs));
    }
    setSearchQuery('');
  };

  const removeLocation = (city: string) => {
    const newLocs = locations.filter(l => l !== city);
    setLocations(newLocs);
    localStorage.setItem('skycast_saved_locations', JSON.stringify(newLocs));
  };

  return (
    <div className="flex flex-col h-full bg-sky-background p-4 md:p-8 overflow-y-auto">
      
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-sky-text-primary flex items-center gap-3">
          <MapPin className="h-8 w-8 text-sky-primary" />
          Saved Locations
        </h1>
        <p className="text-sky-text-secondary mt-1">Manage your favorite cities</p>
      </div>

      {/* Info Banner about Backend */}
      <div className="bg-sky-primary/10 border border-sky-primary/20 rounded-lg p-4 mb-8 flex gap-3 items-start max-w-4xl">
        <Info className="h-5 w-5 text-sky-primary flex-shrink-0 mt-0.5" />
        <div className="text-sm text-sky-text-primary">
          <p className="font-semibold">Local Storage Mode</p>
          <p className="text-sky-text-secondary">
            Your locations are currently saved in this browser. A future update will sync these securely with your SkyCast account via a new backend API endpoint.
          </p>
        </div>
      </div>

      <div className="max-w-4xl flex flex-col md:flex-row gap-4 mb-8">
        <form onSubmit={addLocation} className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-sky-text-secondary" />
            <Input 
              placeholder="Search for a city to add..." 
              className="pl-10 h-12"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button type="submit" className="h-12 px-6">
            <Plus className="h-5 w-5 mr-2" />
            Add
          </Button>
        </form>
      </div>

      {loading && Object.keys(weatherData).length === 0 ? (
         <div className="flex justify-center p-12">
            <Loader2 className="h-8 w-8 animate-spin text-sky-primary" />
         </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-6xl pb-12">
          {locations.map((city) => {
             const data = weatherData[city];
             return (
               <Card key={city} className="border-sky-border bg-sky-surface shadow-sm hover:shadow-md transition-shadow group relative overflow-hidden">
                 <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 w-8 p-0 text-sky-danger hover:bg-sky-danger/10 hover:text-sky-danger"
                      onClick={(e) => { e.stopPropagation(); removeLocation(city); }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                 </div>
                 
                 <CardContent 
                   className="p-5 cursor-pointer" 
                   onClick={() => navigate(`/?city=${encodeURIComponent(city)}`)}
                 >
                   <h3 className="font-bold text-xl text-sky-text-primary mb-4">{city}</h3>
                   
                   {data ? (
                     <div className="flex items-center justify-between">
                       <div>
                         <div className="text-3xl font-black text-sky-text-primary">{data.tempC}°</div>
                         <div className="text-sm font-medium text-sky-text-secondary">{data.condition}</div>
                       </div>
                       <div className="text-right text-xs text-sky-text-secondary flex flex-col gap-1">
                         <span>H: {data.highC}° L: {data.lowC}°</span>
                         <span>Wind: {data.windSpeedKmh} km/h</span>
                       </div>
                     </div>
                   ) : (
                     <div className="flex items-center gap-2 text-sky-text-secondary">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm">Fetching...</span>
                     </div>
                   )}
                 </CardContent>
               </Card>
             )
          })}
          
          {locations.length === 0 && (
            <div className="col-span-full p-12 text-center border-2 border-dashed border-sky-border rounded-xl">
               <p className="text-sky-text-secondary">No locations saved. Search and add a city above.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
