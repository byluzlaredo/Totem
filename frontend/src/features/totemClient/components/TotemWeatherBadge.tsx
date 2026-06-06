import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudSnow,
  CloudSun,
  Sun,
  Wind,
} from "lucide-react";
import type {
  TotemClientWeather,
  TotemClientWeatherConditionKey,
} from "../../../types/totemClient";

interface TotemWeatherBadgeProps {
  weather: TotemClientWeather | null;
  className?: string;
}

function resolveWeatherIcon(
  conditionKey: TotemClientWeatherConditionKey,
  isDay: boolean | null,
) {
  if (conditionKey === "clear") {
    return isDay === false ? CloudMoon : Sun;
  }

  if (conditionKey === "partly_cloudy") {
    return isDay === false ? CloudMoon : CloudSun;
  }

  if (conditionKey === "cloudy") {
    return Cloud;
  }

  if (conditionKey === "fog") {
    return CloudFog;
  }

  if (conditionKey === "drizzle") {
    return CloudDrizzle;
  }

  if (conditionKey === "rain") {
    return CloudRain;
  }

  if (conditionKey === "snow") {
    return CloudSnow;
  }

  if (conditionKey === "thunderstorm") {
    return CloudLightning;
  }

  return Cloud;
}

function formatTemperature(temperatureC: number | null) {
  if (temperatureC === null || !Number.isFinite(temperatureC)) {
    return "--";
  }

  return `${Math.round(temperatureC)}°`;
}

function formatWindSpeed(windSpeedKmh: number | null) {
  if (windSpeedKmh === null || !Number.isFinite(windSpeedKmh)) {
    return null;
  }

  return `${Math.round(windSpeedKmh)} km/h`;
}

export default function TotemWeatherBadge({
  weather,
  className = "",
}: TotemWeatherBadgeProps) {
  const WeatherIcon = resolveWeatherIcon(
    weather?.conditionKey ?? "unknown",
    weather?.isDay ?? null,
  );
  const temperatureLabel = formatTemperature(weather?.temperatureC ?? null);
  const windSpeedLabel = formatWindSpeed(weather?.windSpeedKmh ?? null);
  const conditionLabel = weather?.conditionLabel?.trim() || "Clima no disponible";
  const locationLabel = weather?.locationName?.trim() || "Campus";

  return (
    <article
      className={`inline-flex min-w-44 max-w-[18rem] items-center gap-2.5 overflow-hidden rounded-xl border border-(--totem-border-strong) bg-(--totem-surface-3)/90 px-2.5 py-1.5 text-(--totem-text-primary) shadow-sm shadow-black/20 ${className}`}
      aria-live="polite"
    >
      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-(--totem-border) bg-black/20 text-(--totem-accent)">
        <WeatherIcon className="h-4 w-4" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[10px] font-semibold uppercase tracking-[0.08em] text-(--totem-text-muted)">
          {locationLabel}
        </p>
        <p className="truncate text-xs font-semibold leading-tight text-(--totem-text-secondary)">
          {conditionLabel}
        </p>
      </div>

      <div className="flex shrink-0 flex-col items-end leading-tight">
        <span className="text-base font-bold text-(--totem-text-primary)">{temperatureLabel}</span>
        {windSpeedLabel ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-(--totem-text-muted)">
            <Wind className="h-3 w-3" />
            {windSpeedLabel}
          </span>
        ) : null}
      </div>
    </article>
  );
}
