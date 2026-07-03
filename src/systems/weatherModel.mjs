// Node-safe mood to weather mapping shared by classifier, ambient appearance,
// and legacy furniture/weather imports.

export const WEATHER_KIND = Object.freeze({
  CLEAR: 'clear',
  CLOUDY: 'cloudy',
  RAIN: 'rain',
  THUNDERSTORM: 'thunderstorm',
})

export const MOOD_WEATHER = {
  normal: 'clear',
  smooth: 'clear',
  intense: 'clear',
  idle: 'clear',
  rushing: 'cloudy',
  frustrated: 'rain',
  stuck: 'thunderstorm',
}

export function moodToWeather(mood) {
  return MOOD_WEATHER[mood] || 'clear'
}
