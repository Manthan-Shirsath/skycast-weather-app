import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useWeather } from '../context/WeatherContext';
import { useTranslation } from '../context/LanguageContext';
import {
  X,
  Bell,
  AlertTriangle,
  CloudRain,
  Sparkles,
  MapPin,
  CheckCircle2,
  ChevronRight
} from 'lucide-react';

export function NotificationsModal({ isOpen, onClose }) {
  const { currentCity, weatherData } = useWeather();
  const { t } = useTranslation();
  const navigate = useNavigate();

  if (!isOpen) return null;

  const city = weatherData || {};
  const alerts = city.alerts || [];
  const rainChance = city.insight?.rainChance || 0;

  const notifications = [
    {
      id: 'notif-1',
      category: 'risk',
      title: alerts.length > 0 ? alerts[0].title : `Normal weather baseline in ${city.city || currentCity}`,
      desc: alerts.length > 0 ? alerts[0].explanation : 'No adverse meteorological hazard triggers active.',
      time: 'Just now',
      severity: alerts.length > 0 ? alerts[0].severity : 'green',
      actionUrl: `/alerts?city=${encodeURIComponent(currentCity)}`,
      icon: AlertTriangle
    },
    {
      id: 'notif-2',
      category: 'rain',
      title: rainChance > 40 ? `Rain Expected (${rainChance}%)` : 'Low Precipitation Window',
      desc: rainChance > 40 ? 'Carry an umbrella if heading out during afternoon hours.' : 'Clear skies expected throughout the day.',
      time: '15m ago',
      severity: rainChance > 40 ? 'yellow' : 'green',
      actionUrl: `/details?city=${encodeURIComponent(currentCity)}`,
      icon: CloudRain
    },
    {
      id: 'notif-3',
      category: 'ai',
      title: 'WeatherGPT Daily Insight',
      desc: `Check out today's outdoor activity, travel, and agriculture recommendations for ${city.city || currentCity}.`,
      time: '1h ago',
      severity: 'ai',
      actionUrl: `/weathergpt?city=${encodeURIComponent(currentCity)}`,
      icon: Sparkles
    }
  ];

  const handleNotificationClick = (url) => {
    navigate(url);
    onClose();
  };

  return (
    <div className="settings-modal-backdrop" onClick={onClose}>
      <div className="notifications-modal-overlay animate-scale-up" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <div className="flex items-center gap-2">
            <Bell size={18} className="text-primary" />
            <span className="settings-title">{t('nav_notifications', 'Notifications Center')}</span>
          </div>
          <button
            type="button"
            className="settings-close-btn"
            onClick={onClose}
            aria-label="Close Notifications"
          >
            <X size={16} />
          </button>
        </div>

        <div className="notifications-list">
          {notifications.map((n) => {
            const Icon = n.icon;
            return (
              <div
                key={n.id}
                className={`notification-item-card severity-${n.severity}`}
                onClick={() => handleNotificationClick(n.actionUrl)}
                tabIndex={0}
                role="button"
                onKeyDown={(e) => e.key === 'Enter' && handleNotificationClick(n.actionUrl)}
              >
                <div className="notif-icon-col">
                  <Icon size={18} />
                </div>
                <div className="notif-content-col">
                  <div className="notif-top-row">
                    <span className="notif-title">{n.title}</span>
                    <span className="notif-time">{n.time}</span>
                  </div>
                  <p className="notif-desc">{n.desc}</p>
                </div>
                <ChevronRight size={16} className="notif-arrow" />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
