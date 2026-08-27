export const CITIES_DATA = {
  "pune": {
    city: "Pune",
    region: "Maharashtra",
    displayLocation: "Pune, Maharashtra",
    date: "TUESDAY, AUGUST 25",
    tempC: 28,
    condition: "Partly Cloudy",
    feelsLikeC: 30,
    highC: 31,
    lowC: 23,
    humidity: 72,
    windSpeedKmh: 14,
    insight: {
      title: "Comfortable afternoon",
      description: "Cloud cover will keep temperatures pleasant. Rain is unlikely today.",
      rainChance: 18
    },
    hourly: [
      { time: "Now", tempC: 28, icon: "sun-fill", active: true },
      { time: "17:00", tempC: 29, icon: "partly-cloudy" },
      { time: "18:00", tempC: 27, icon: "partly-cloudy" },
      { time: "19:00", tempC: 25, icon: "cloudy" },
      { time: "20:00", tempC: 24, icon: "cloudy" },
      { time: "21:00", tempC: 24, icon: "cloudy" },
      { time: "22:00", tempC: 23, icon: "cloudy" }
    ],
    daily: [
      { day: "Today", condition: "Partly cloudy", highC: 28, lowC: 23, rainChance: 20, icon: "partly-cloudy" },
      { day: "Wed", condition: "Sunny", highC: 30, lowC: 22, rainChance: 20, icon: "sun" },
      { day: "Thu", condition: "Scattered rain", highC: 27, lowC: 22, rainChance: 20, icon: "rain" },
      { day: "Fri", condition: "Thunderstorms", highC: 26, lowC: 21, rainChance: 20, icon: "thunderstorm" },
      { day: "Sat", condition: "Cloudy", highC: 27, lowC: 22, rainChance: 20, icon: "cloudy" },
      { day: "Sun", condition: "Sunny", highC: 29, lowC: 23, rainChance: 20, icon: "sun" },
      { day: "Mon", condition: "Partly cloudy", highC: 29, lowC: 23, rainChance: 20, icon: "partly-cloudy" }
    ]
  },
  "mumbai": {
    city: "Mumbai",
    region: "Maharashtra",
    displayLocation: "Mumbai, Maharashtra",
    date: "TUESDAY, AUGUST 25",
    tempC: 31,
    condition: "Humid & Sunny",
    feelsLikeC: 36,
    highC: 33,
    lowC: 26,
    humidity: 82,
    windSpeedKmh: 18,
    insight: {
      title: "Warm and humid day",
      description: "High humidity levels with coastal sea breeze in the evening.",
      rainChance: 25
    },
    hourly: [
      { time: "Now", tempC: 31, icon: "sun-fill", active: true },
      { time: "17:00", tempC: 31, icon: "partly-cloudy" },
      { time: "18:00", tempC: 30, icon: "partly-cloudy" },
      { time: "19:00", tempC: 29, icon: "cloudy" },
      { time: "20:00", tempC: 28, icon: "cloudy" },
      { time: "21:00", tempC: 28, icon: "cloudy" },
      { time: "22:00", tempC: 27, icon: "cloudy" }
    ],
    daily: [
      { day: "Today", condition: "Humid & Sunny", highC: 31, lowC: 26, rainChance: 25, icon: "sun" },
      { day: "Wed", condition: "Partly cloudy", highC: 32, lowC: 26, rainChance: 30, icon: "partly-cloudy" },
      { day: "Thu", condition: "Scattered rain", highC: 30, lowC: 25, rainChance: 65, icon: "rain" },
      { day: "Fri", condition: "Thunderstorms", highC: 29, lowC: 25, rainChance: 80, icon: "thunderstorm" },
      { day: "Sat", condition: "Moderate rain", highC: 30, lowC: 25, rainChance: 70, icon: "rain" },
      { day: "Sun", condition: "Cloudy", highC: 31, lowC: 26, rainChance: 40, icon: "cloudy" },
      { day: "Mon", condition: "Partly cloudy", highC: 32, lowC: 26, rainChance: 30, icon: "partly-cloudy" }
    ]
  },
  "delhi": {
    city: "New Delhi",
    region: "Delhi",
    displayLocation: "New Delhi, Delhi",
    date: "TUESDAY, AUGUST 25",
    tempC: 34,
    condition: "Mostly Clear",
    feelsLikeC: 37,
    highC: 36,
    lowC: 27,
    humidity: 58,
    windSpeedKmh: 12,
    insight: {
      title: "Warm sunny afternoon",
      description: "Dry winds and sunny skies throughout the late afternoon.",
      rainChance: 10
    },
    hourly: [
      { time: "Now", tempC: 34, icon: "sun-fill", active: true },
      { time: "17:00", tempC: 35, icon: "sun" },
      { time: "18:00", tempC: 33, icon: "sun" },
      { time: "19:00", tempC: 31, icon: "partly-cloudy" },
      { time: "20:00", tempC: 30, icon: "cloudy" },
      { time: "21:00", tempC: 29, icon: "cloudy" },
      { time: "22:00", tempC: 28, icon: "cloudy" }
    ],
    daily: [
      { day: "Today", condition: "Mostly Clear", highC: 34, lowC: 27, rainChance: 10, icon: "sun" },
      { day: "Wed", condition: "Sunny", highC: 36, lowC: 27, rainChance: 10, icon: "sun" },
      { day: "Thu", condition: "Sunny", highC: 37, lowC: 28, rainChance: 15, icon: "sun" },
      { day: "Fri", condition: "Partly cloudy", highC: 35, lowC: 27, rainChance: 25, icon: "partly-cloudy" },
      { day: "Sat", condition: "Scattered rain", highC: 33, lowC: 26, rainChance: 50, icon: "rain" },
      { day: "Sun", condition: "Partly cloudy", highC: 34, lowC: 26, rainChance: 20, icon: "partly-cloudy" },
      { day: "Mon", condition: "Sunny", highC: 35, lowC: 27, rainChance: 10, icon: "sun" }
    ]
  },
  "london": {
    city: "London",
    region: "United Kingdom",
    displayLocation: "London, UK",
    date: "TUESDAY, AUGUST 25",
    tempC: 21,
    condition: "Scattered Showers",
    feelsLikeC: 20,
    highC: 22,
    lowC: 15,
    humidity: 78,
    windSpeedKmh: 22,
    insight: {
      title: "Brisk & breezy afternoon",
      description: "Passing showers expected intermittently before clearing this evening.",
      rainChance: 60
    },
    hourly: [
      { time: "Now", tempC: 21, icon: "rain", active: true },
      { time: "17:00", tempC: 21, icon: "rain" },
      { time: "18:00", tempC: 20, icon: "partly-cloudy" },
      { time: "19:00", tempC: 19, icon: "cloudy" },
      { time: "20:00", tempC: 18, icon: "cloudy" },
      { time: "21:00", tempC: 17, icon: "cloudy" },
      { time: "22:00", tempC: 16, icon: "cloudy" }
    ],
    daily: [
      { day: "Today", condition: "Scattered rain", highC: 21, lowC: 15, rainChance: 60, icon: "rain" },
      { day: "Wed", condition: "Cloudy", highC: 22, lowC: 14, rainChance: 35, icon: "cloudy" },
      { day: "Thu", condition: "Partly cloudy", highC: 23, lowC: 15, rainChance: 20, icon: "partly-cloudy" },
      { day: "Fri", condition: "Sunny", highC: 24, lowC: 16, rainChance: 15, icon: "sun" },
      { day: "Sat", condition: "Scattered rain", highC: 22, lowC: 15, rainChance: 55, icon: "rain" },
      { day: "Sun", condition: "Thunderstorms", highC: 20, lowC: 14, rainChance: 75, icon: "thunderstorm" },
      { day: "Mon", condition: "Partly cloudy", highC: 21, lowC: 14, rainChance: 25, icon: "partly-cloudy" }
    ]
  },
  "new york": {
    city: "New York",
    region: "New York, USA",
    displayLocation: "New York, USA",
    date: "TUESDAY, AUGUST 25",
    tempC: 26,
    condition: "Sunny",
    feelsLikeC: 27,
    highC: 28,
    lowC: 19,
    humidity: 55,
    windSpeedKmh: 16,
    insight: {
      title: "Pleasant sunny afternoon",
      description: "Clear skies and moderate breeze making for excellent outdoor conditions.",
      rainChance: 5
    },
    hourly: [
      { time: "Now", tempC: 26, icon: "sun-fill", active: true },
      { time: "17:00", tempC: 27, icon: "sun" },
      { time: "18:00", tempC: 26, icon: "sun" },
      { time: "19:00", tempC: 24, icon: "partly-cloudy" },
      { time: "20:00", tempC: 23, icon: "cloudy" },
      { time: "21:00", tempC: 22, icon: "cloudy" },
      { time: "22:00", tempC: 21, icon: "cloudy" }
    ],
    daily: [
      { day: "Today", condition: "Sunny", highC: 26, lowC: 19, rainChance: 5, icon: "sun" },
      { day: "Wed", condition: "Sunny", highC: 28, lowC: 20, rainChance: 10, icon: "sun" },
      { day: "Thu", condition: "Partly cloudy", highC: 29, lowC: 21, rainChance: 25, icon: "partly-cloudy" },
      { day: "Fri", condition: "Thunderstorms", highC: 27, lowC: 20, rainChance: 70, icon: "thunderstorm" },
      { day: "Sat", condition: "Scattered rain", highC: 25, lowC: 19, rainChance: 45, icon: "rain" },
      { day: "Sun", condition: "Sunny", highC: 27, lowC: 19, rainChance: 15, icon: "sun" },
      { day: "Mon", condition: "Sunny", highC: 28, lowC: 20, rainChance: 10, icon: "sun" }
    ]
  },
  "srinagar": {
    city: "Srinagar",
    region: "Jammu & Kashmir",
    displayLocation: "Srinagar, Jammu & Kashmir",
    date: "TUESDAY, AUGUST 25",
    tempC: 22,
    condition: "Pleasant & Clear",
    feelsLikeC: 22,
    highC: 24,
    lowC: 14,
    humidity: 50,
    windSpeedKmh: 8,
    insight: {
      title: "Pleasant Valley Climate",
      description: "Crisp mountain breeze with clear visibility across the valley.",
      rainChance: 10
    },
    hourly: [
      { time: "Now", tempC: 22, icon: "sun-fill", active: true },
      { time: "17:00", tempC: 23, icon: "sun" },
      { time: "18:00", tempC: 21, icon: "sun" },
      { time: "19:00", tempC: 19, icon: "partly-cloudy" },
      { time: "20:00", tempC: 17, icon: "cloudy" },
      { time: "21:00", tempC: 16, icon: "cloudy" },
      { time: "22:00", tempC: 15, icon: "cloudy" }
    ],
    daily: [
      { day: "Today", condition: "Sunny", highC: 24, lowC: 14, rainChance: 10, icon: "sun" },
      { day: "Wed", condition: "Sunny", highC: 25, lowC: 14, rainChance: 10, icon: "sun" },
      { day: "Thu", condition: "Partly cloudy", highC: 23, lowC: 13, rainChance: 20, icon: "partly-cloudy" },
      { day: "Fri", condition: "Scattered rain", highC: 21, lowC: 12, rainChance: 40, icon: "rain" },
      { day: "Sat", condition: "Sunny", highC: 23, lowC: 13, rainChance: 15, icon: "sun" },
      { day: "Sun", condition: "Sunny", highC: 24, lowC: 14, rainChance: 10, icon: "sun" },
      { day: "Mon", condition: "Sunny", highC: 25, lowC: 14, rainChance: 10, icon: "sun" }
    ]
  },
  "leh": {
    city: "Leh",
    region: "Ladakh",
    displayLocation: "Leh, Ladakh",
    date: "TUESDAY, AUGUST 25",
    tempC: 17,
    condition: "Sunny & Crisp",
    feelsLikeC: 16,
    highC: 19,
    lowC: 8,
    humidity: 32,
    windSpeedKmh: 14,
    insight: {
      title: "High Altitude Clear Sky",
      description: "High UV index with dry and clear Himalayan atmosphere.",
      rainChance: 0
    },
    hourly: [
      { time: "Now", tempC: 17, icon: "sun-fill", active: true },
      { time: "17:00", tempC: 18, icon: "sun" },
      { time: "18:00", tempC: 16, icon: "sun" },
      { time: "19:00", tempC: 14, icon: "partly-cloudy" },
      { time: "20:00", tempC: 12, icon: "cloudy" },
      { time: "21:00", tempC: 10, icon: "cloudy" },
      { time: "22:00", tempC: 9, icon: "cloudy" }
    ],
    daily: [
      { day: "Today", condition: "Sunny", highC: 19, lowC: 8, rainChance: 0, icon: "sun" },
      { day: "Wed", condition: "Sunny", highC: 20, lowC: 9, rainChance: 0, icon: "sun" },
      { day: "Thu", condition: "Sunny", highC: 20, lowC: 8, rainChance: 0, icon: "sun" },
      { day: "Fri", condition: "Partly cloudy", highC: 18, lowC: 7, rainChance: 10, icon: "partly-cloudy" },
      { day: "Sat", condition: "Sunny", highC: 19, lowC: 8, rainChance: 0, icon: "sun" },
      { day: "Sun", condition: "Sunny", highC: 20, lowC: 9, rainChance: 0, icon: "sun" },
      { day: "Mon", condition: "Sunny", highC: 21, lowC: 9, rainChance: 0, icon: "sun" }
    ]
  },
  "jammu": {
    city: "Jammu",
    region: "Jammu & Kashmir",
    displayLocation: "Jammu, Jammu & Kashmir",
    date: "TUESDAY, AUGUST 25",
    tempC: 32,
    condition: "Warm & Sunny",
    feelsLikeC: 35,
    highC: 34,
    lowC: 25,
    humidity: 62,
    windSpeedKmh: 10,
    insight: {
      title: "Warm Foothills Weather",
      description: "Sunny afternoon with moderate humidity.",
      rainChance: 15
    },
    hourly: [
      { time: "Now", tempC: 32, icon: "sun-fill", active: true },
      { time: "17:00", tempC: 33, icon: "sun" },
      { time: "18:00", tempC: 31, icon: "sun" },
      { time: "19:00", tempC: 29, icon: "partly-cloudy" },
      { time: "20:00", tempC: 28, icon: "cloudy" },
      { time: "21:00", tempC: 27, icon: "cloudy" },
      { time: "22:00", tempC: 26, icon: "cloudy" }
    ],
    daily: [
      { day: "Today", condition: "Warm & Sunny", highC: 34, lowC: 25, rainChance: 15, icon: "sun" },
      { day: "Wed", condition: "Sunny", highC: 35, lowC: 26, rainChance: 10, icon: "sun" },
      { day: "Thu", condition: "Scattered rain", highC: 32, lowC: 24, rainChance: 45, icon: "rain" },
      { day: "Fri", condition: "Thunderstorms", highC: 30, lowC: 23, rainChance: 65, icon: "thunderstorm" },
      { day: "Sat", condition: "Partly cloudy", highC: 33, lowC: 24, rainChance: 25, icon: "partly-cloudy" },
      { day: "Sun", condition: "Sunny", highC: 34, lowC: 25, rainChance: 15, icon: "sun" },
      { day: "Mon", condition: "Sunny", highC: 35, lowC: 25, rainChance: 10, icon: "sun" }
    ]
  }
};
