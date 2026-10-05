"""Open-Meteo environmental adapter with 1-hour caching for AgriBridge."""
import datetime
import json
import logging
from typing import Dict, Any, Optional
import httpx
from app.db import SessionLocal
from app.models.entities import EnvCache
from app.schemas.entities import WeatherResponse, WeatherDayForecast

logger = logging.getLogger(__name__)

WEATHER_CODE_MAP = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    71: "Slight snow fall",
    73: "Moderate snow fall",
    75: "Heavy snow fall",
    80: "Slight rain showers",
    81: "Moderate rain showers",
    82: "Violent rain showers",
    95: "Thunderstorm",
    96: "Thunderstorm with slight hail",
    99: "Thunderstorm with heavy hail"
}


def _get_cached_weather(cache_key: str) -> Optional[Dict[str, Any]]:
    db = SessionLocal()
    try:
        now = datetime.datetime.utcnow()
        entry = db.query(EnvCache).filter(
            EnvCache.key == cache_key,
            EnvCache.expires_at > now
        ).first()
        if entry:
            return json.loads(entry.payload_json)
    except Exception as e:
        logger.warning(f"Cache lookup failed for {cache_key}: {e}")
    finally:
        db.close()
    return None


def _set_cached_weather(cache_key: str, data: Dict[str, Any], ttl_seconds: int = 3600):
    db = SessionLocal()
    try:
        now = datetime.datetime.utcnow()
        expires = now + datetime.timedelta(seconds=ttl_seconds)
        entry = db.query(EnvCache).filter(EnvCache.key == cache_key).first()
        if entry:
            entry.payload_json = json.dumps(data)
            entry.fetched_at = now
            entry.expires_at = expires
        else:
            entry = EnvCache(
                key=cache_key,
                source="open_meteo",
                payload_json=json.dumps(data),
                fetched_at=now,
                expires_at=expires
            )
            db.add(entry)
        db.commit()
    except Exception as e:
        logger.warning(f"Failed to cache weather for {cache_key}: {e}")
        db.rollback()
    finally:
        db.close()


async def get_plot_weather(lat: float, lon: float) -> WeatherResponse:
    """Fetch current conditions, 7-day forecast, and 30-day precipitation."""
    # Round coordinates to 3 decimals (~100m) for cache efficiency
    lat_round = round(lat, 3)
    lon_round = round(lon, 3)
    cache_key = f"weather_{lat_round}_{lon_round}"

    cached = _get_cached_weather(cache_key)
    if cached:
        return WeatherResponse(**cached)

    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": lat_round,
        "longitude": lon_round,
        "current": "temperature_2m,relative_humidity_2m,weather_code",
        "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code",
        "timezone": "auto",
        "past_days": 30
    }

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(url, params=params)
            if resp.status_code == 200:
                data = resp.json()
                current = data.get("current", {})
                daily = data.get("daily", {})

                # Weather code translation
                w_code = current.get("weather_code", current.get("weathercode", 0))
                condition_desc = WEATHER_CODE_MAP.get(w_code, "Partly cloudy")

                # Daily forecast parsing
                time_list = daily.get("time", [])
                max_t = daily.get("temperature_2m_max", [])
                min_t = daily.get("temperature_2m_min", [])
                precip = daily.get("precipitation_sum", [])
                w_codes = daily.get("weather_code", daily.get("weathercode", []))

                forecast_items = []
                today_str = datetime.date.today().isoformat()
                
                # Filter for future days (next 7 days starting from today)
                for i in range(len(time_list)):
                    if time_list[i] >= today_str and len(forecast_items) < 7:
                        day_code = w_codes[i] if i < len(w_codes) and w_codes[i] is not None else 0
                        forecast_items.append(WeatherDayForecast(
                            date=time_list[i],
                            max_temp_c=float(max_t[i]) if i < len(max_t) and max_t[i] is not None else 28.0,
                            min_temp_c=float(min_t[i]) if i < len(min_t) and min_t[i] is not None else 18.0,
                            precipitation_sum_mm=float(precip[i]) if i < len(precip) and precip[i] is not None else 0.0,
                            condition=WEATHER_CODE_MAP.get(day_code, "Clear")
                        ))

                # Real 30-day historical precipitation sum from Open-Meteo
                past_30d_precip = [
                    float(precip[i]) for i in range(len(time_list))
                    if time_list[i] < today_str and precip[i] is not None
                ][-30:]
                precip_30d = round(sum(past_30d_precip), 1) if past_30d_precip else 0.0

                current_temp = float(current.get("temperature_2m", current.get("temperature", 26.5)))
                current_humidity = float(current.get("relative_humidity_2m", 55.0))

                result = WeatherResponse(
                    lat=lat_round,
                    lon=lon_round,
                    current_temp_c=current_temp,
                    current_humidity_pct=current_humidity,
                    current_condition=condition_desc,
                    precipitation_30d_mm=precip_30d,
                    forecast_7d=forecast_items,
                    source_attribution="Open-Meteo Weather Forecast & Historical Observations (CC BY 4.0)",
                    license="CC BY 4.0",
                    cached_at=datetime.datetime.utcnow().isoformat()
                )

                _set_cached_weather(cache_key, result.model_dump())
                return result
    except Exception as err:
        logger.warning(f"Open-Meteo API call error: {err}. Using synthetic demo weather data.")

    # Synthetic values are only for a visibly labeled demo fallback.
    today = datetime.date.today()
    fallback_forecast = [
        WeatherDayForecast(
            date=(today + datetime.timedelta(days=i)).isoformat(),
            max_temp_c=29.0 + (i % 3),
            min_temp_c=19.0 + (i % 2),
            precipitation_sum_mm=1.5 if i in [2, 5] else 0.0,
            condition="Partly cloudy" if i % 2 == 0 else "Sunny"
        )
        for i in range(7)
    ]

    fallback = WeatherResponse(
        lat=lat_round,
        lon=lon_round,
        current_temp_c=27.5,
        current_humidity_pct=55.0,
        current_condition="Partly cloudy",
        precipitation_30d_mm=45.0,
        forecast_7d=fallback_forecast,
        source_attribution="DEMO DATA: synthetic fallback; not an Open-Meteo observation or forecast",
        license="Not applicable",
        cached_at=datetime.datetime.utcnow().isoformat(),
        is_demo_data=True
    )
    return fallback
