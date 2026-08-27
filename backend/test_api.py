import httpx

def test_weather_api():
    cities = ['Pune', 'Mumbai', 'New Delhi', 'London', 'Tokyo', 'New York']
    for city in cities:
        r = httpx.get(f'http://127.0.0.1:8000/api/weather?city={city}', timeout=10.0)
        data = r.json()
        print(f"[{r.status_code}] {city} -> {data['displayLocation']}: {data['tempC']}°C ({data['condition']}) | Insight: \"{data['insight']['title']}\" | Hourly count: {len(data['hourly'])} | 7-day: {[d['day'] for d in data['daily']]}")

    # Invalid city test
    inv_r = httpx.get('http://127.0.0.1:8000/api/weather?city=ThisCityDoesNotExistXYZ999', timeout=10.0)
    print(f"Invalid city status: {inv_r.status_code}, body: {inv_r.json()}")

if __name__ == '__main__':
    test_weather_api()
