const $ = (selector) => document.querySelector(selector);

const state = {
  place: null,
  celsius: true,
  saved: JSON.parse(localStorage.getItem("weatherly-saved") || "null") || [
    { name: "Bengaluru", country: "India", latitude: 12.9716, longitude: 77.5946 },
    { name: "Mumbai", country: "India", latitude: 19.076, longitude: 72.8777 },
  ],
  forecast: null,
};

function message(text, isError = false) {
  const status = $("#status");
  status.textContent = text;
  status.classList.remove("hidden", "error");
  if (isError) status.classList.add("error");
}

function clearMessage() {
  $("#status").classList.add("hidden");
}

function weatherInfo(code) {
  if (code === 0) return ["Clear sky", "☀", "A lovely clear stretch."];
  if (code === 1) return ["Mostly clear", "🌤", "A little sun, a little cloud."];
  if (code === 2) return ["Partly cloudy", "⛅", "Clouds and sun taking turns."];
  if (code === 3) return ["Overcast", "☁", "A soft grey kind of day."];
  if ([45, 48].includes(code)) return ["Foggy", "🌫", "Take it a little slower."];
  if ([51, 53, 55, 56, 57].includes(code)) return ["Drizzle", "🌦", "A light layer might help."];
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return ["Rain", "🌧", "An umbrella could be a good idea."];
  if ([71, 73, 75, 77, 85, 86].includes(code)) return ["Snow", "❄", "Bundle up and take care."];
  if ([95, 96, 99].includes(code)) return ["Thunderstorms", "⛈", "Keep an eye on the sky."];
  return ["Changing skies", "🌤", "Check back as the day unfolds."];
}

function formatTime(iso, timezone) {
  return new Intl.DateTimeFormat([], {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  }).format(new Date(iso));
}

function formatDay(iso, index, timezone) {
  if (index === 0) return "Today";
  if (index === 1) return "Tomorrow";
  return new Intl.DateTimeFormat([], {
    weekday: "short",
    timeZone: timezone,
  }).format(new Date(`${iso}T12:00:00`));
}

function displayTemp(value) {
  if (value == null || Number.isNaN(Number(value))) return "--°";
  const temp = state.celsius ? Number(value) : Number(value) * 9 / 5 + 32;
  return `${Math.round(temp)}°`;
}

function renderSavedPlaces() {
  $("#saved-places").innerHTML = state.saved.map((place, index) => `
    <div class="saved-place">
      <button data-load-place="${index}">${place.name}<span style="color:#98a69f"> · ${place.country}</span></button>
      <button class="remove-place" data-remove-place="${index}" aria-label="Remove ${place.name}">×</button>
    </div>
  `).join("");

  localStorage.setItem("weatherly-saved", JSON.stringify(state.saved));
}

async function findCities(query) {
  const endpoint = new URL("https://geocoding-api.open-meteo.com/v1/search");
  endpoint.search = new URLSearchParams({
    name: query,
    count: "6",
    language: "en",
    format: "json",
  });

  const response = await fetch(endpoint);
  if (!response.ok) throw new Error("City search is temporarily unavailable.");
  const data = await response.json();
  return data.results || [];
}

async function loadWeather(place) {
  state.place = place;
  message(`Looking up the forecast for ${place.name}…`);

  try {
    const endpoint = new URL("https://api.open-meteo.com/v1/forecast");
    endpoint.search = new URLSearchParams({
      latitude: String(place.latitude),
      longitude: String(place.longitude),
      timezone: "auto",
      forecast_days: "7",
      current: "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m",
      hourly: "temperature_2m,precipitation_probability,weather_code",
      daily: "weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max",
      temperature_unit: "celsius",
      wind_speed_unit: "kmh",
    });

    const response = await fetch(endpoint);
    if (!response.ok) throw new Error("The forecast service returned an error.");
    state.forecast = await response.json();
    renderWeather();
    clearMessage();
  } catch (error) {
    message(`${error.message} Check your internet connection and try again.`, true);
  }
}

function renderWeather() {
  const data = state.forecast;
  if (!data) return;

  const current = data.current;
  const daily = data.daily;
  const hour = data.hourly;
  const timezone = data.timezone;
  const [condition, symbol, description] = weatherInfo(current.weather_code);

  $("#place-name").textContent = `${state.place.name}, ${state.place.country}`;
  $("#current-date").textContent = new Intl.DateTimeFormat([], {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: timezone,
  }).format(new Date(current.time));
  $("#current-temp").textContent = displayTemp(current.temperature_2m);
  $("#current-condition").textContent = condition;
  $("#current-symbol").textContent = symbol;
  $("#feels-like").textContent = `Feels like ${displayTemp(current.apparent_temperature)}`;
  $("#high-low").textContent = `H: ${displayTemp(daily.temperature_2m_max[0])}   L: ${displayTemp(daily.temperature_2m_min[0])}`;
  $("#current-description").textContent = description;

  $("#humidity").textContent = `${current.relative_humidity_2m}%`;
  $("#humidity-note").textContent =
    current.relative_humidity_2m >= 70 ? "A little muggy out" :
    current.relative_humidity_2m <= 35 ? "On the dry side" : "Comfortable for most";
  $("#wind").innerHTML = `${Math.round(current.wind_speed_10m)} <small>km/h</small>`;
  $("#wind-note").textContent =
    current.wind_speed_10m >= 25 ? "A breezy one" :
    current.wind_speed_10m >= 12 ? "A light breeze" : "Mostly calm";

  const uv = Math.round(daily.uv_index_max[0] || 0);
  $("#uv").textContent = uv;
  $("#uv-note").textContent =
    uv <= 2 ? "Low · easy does it" :
    uv <= 5 ? "Moderate · cover up" :
    uv <= 7 ? "High · find some shade" : "Very high · protect your skin";
  $("#uv-meter-fill").style.width = `${Math.min(100, uv * 10)}%`;

  $("#sunrise").textContent = formatTime(daily.sunrise[0], timezone);
  $("#sunset").textContent = formatTime(daily.sunset[0], timezone);
  const daylightHours = (
    (new Date(daily.sunset[0]) - new Date(daily.sunrise[0])) /
    3600000
  ).toFixed(1);
  $("#daylight").textContent = `${daylightHours} hours of daylight`;

  const currentTime = new Date(current.time).getTime();
  let startIndex = hour.time.findIndex((time) => new Date(time).getTime() >= currentTime);
  if (startIndex < 0) startIndex = 0;

  const hours = hour.time.slice(startIndex, startIndex + 6);
  $("#hourly-list").innerHTML = hours.map((time, offset) => {
    const index = startIndex + offset;
    const [label, icon] = weatherInfo(hour.weather_code[index]);
    const timeLabel = offset === 0
      ? "Now"
      : new Intl.DateTimeFormat([], { hour: "numeric", timeZone: timezone }).format(new Date(time));

    return `
      <div class="hour-item">
        <small>${timeLabel}</small>
        <span title="${label}">${icon}</span>
        <b>${displayTemp(hour.temperature_2m[index])}</b>
        <em>${hour.precipitation_probability[index] || 0}% rain</em>
      </div>
    `;
  }).join("");

  $("#weekly-list").innerHTML = daily.time.map((date, index) => {
    const [label, icon] = weatherInfo(daily.weather_code[index]);
    const rainIndex = hour.time.findIndex((time) => time.startsWith(date));
    const rain = rainIndex >= 0 ? hour.precipitation_probability[rainIndex] || 0 : 0;

    return `
      <div class="day-row">
        <span class="day-name">${formatDay(date, index, timezone)}</span>
        <span class="day-icon" title="${label}">${icon}</span>
        <span class="rain">${rain}%</span>
        <span class="temp-range">
          <span>${displayTemp(daily.temperature_2m_min[index])}</span>
          <span class="range-line"></span>
          <b>${displayTemp(daily.temperature_2m_max[index])}</b>
        </span>
      </div>
    `;
  }).join("");

  $("#updated-at").textContent = `Updated ${new Date().toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

async function chooseCity(city) {
  $("#search-results").classList.add("hidden");
  $("#city-input").value = `${city.name}${city.country ? `, ${city.country}` : ""}`;

  await loadWeather({
    name: city.name,
    country: city.country || city.admin1 || "",
    latitude: city.latitude,
    longitude: city.longitude,
  });
}

$("#search-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const query = $("#city-input").value.trim();
  if (!query) {
    message("Type a city name to search.", true);
    return;
  }

  message("Searching for that place…");

  try {
    const results = await findCities(query);
    if (!results.length) {
      message("We couldn’t find that place. Try a nearby city name.", true);
      return;
    }

    $("#search-results").innerHTML = results.map((city, index) => `
      <button class="search-result" data-result="${index}">
        ${city.name}
        <small>${[city.admin1, city.country].filter(Boolean).join(", ")}</small>
      </button>
    `).join("");
    $("#search-results").classList.remove("hidden");
    clearMessage();

    $("#search-results").querySelectorAll("[data-result]").forEach((button) => {
      button.addEventListener("click", () => chooseCity(results[Number(button.dataset.result)]));
    });
  } catch (error) {
    message(`${error.message} Check your internet connection and try again.`, true);
  }
});

$("#unit-toggle").addEventListener("click", () => {
  state.celsius = !state.celsius;
  $("#unit-toggle").innerHTML = state.celsius
    ? "°C <span>/</span> °F"
    : "°F <span>/</span> °C";
  if (state.forecast) renderWeather();
});

$("#refresh-button").addEventListener("click", () => {
  if (state.place) loadWeather(state.place);
});

$("#save-place-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = $("#save-place-input").value.trim();
  if (!name) return;

  try {
    const results = await findCities(name);
    if (!results.length) {
      message(`Couldn’t find ${name}. Try a nearby city name.`, true);
      return;
    }

    const city = results[0];
    const alreadySaved = state.saved.some(
      (place) => place.name.toLowerCase() === city.name.toLowerCase(),
    );

    if (!alreadySaved) {
      state.saved.push({
        name: city.name,
        country: city.country || city.admin1 || "",
        latitude: city.latitude,
        longitude: city.longitude,
      });
      renderSavedPlaces();
    }

    $("#save-place-input").value = "";
    clearMessage();
    await loadWeather({
      name: city.name,
      country: city.country || city.admin1 || "",
      latitude: city.latitude,
      longitude: city.longitude,
    });
  } catch (error) {
    message(`${error.message} Check your connection and try again.`, true);
  }
});

$("#saved-places").addEventListener("click", (event) => {
  const loadButton = event.target.closest("[data-load-place]");
  const removeButton = event.target.closest("[data-remove-place]");

  if (loadButton) {
    const place = state.saved[Number(loadButton.dataset.loadPlace)];
    if (place) loadWeather(place);
  }

  if (removeButton) {
    state.saved.splice(Number(removeButton.dataset.removePlace), 1);
    renderSavedPlaces();
  }
});

document.addEventListener("click", (event) => {
  if (!event.target.closest("#search-form") && !event.target.closest("#search-results")) {
    $("#search-results").classList.add("hidden");
  }
});

renderSavedPlaces();

const defaultPlace = {
  name: "Bengaluru",
  country: "India",
  latitude: 12.9716,
  longitude: 77.5946,
};
loadWeather(defaultPlace);