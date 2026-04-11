const suncalc = require('suncalc')
const _ = require('lodash')

module.exports = function (app, plugin) {
  return {
    group: 'sun',
    optionKey: 'Sun',
    title:
      'Sets environment.sun to nauticalDawn, dawn, sunrise, day, sunset, dusk, nauticalDusk or night. Sets environment.mode to day or night.',
    derivedFrom: ['navigation.datetime', 'navigation.position'],
    defaults: ['', undefined],
    debounceDelay: 60 * 1000,
    calculator: function (datetime, position) {
      var value
      var mode
      var date

      if (datetime && datetime.length > 0) {
        date = new Date(datetime)
      } else {
        date = new Date()
      }

      app.debug(`Using datetime: ${date} position: ${JSON.stringify(position)}`)

      var times = suncalc.getTimes(date, position.latitude, position.longitude)
      var now = date.getTime()

      _.keys(times).forEach(key => {
        times[key] = new Date(times[key]).getTime()
      })

      if (now >= times.sunrise) {
        if (now < times.sunriseEnd) {
          value = 'sunrise'
          mode = 'day'
        } else if (now <= times.sunsetStart) {
          value = 'day'
          mode = 'day'
        } else if (now >= times.sunsetStart && now < times.dusk) {
          value = 'sunset'
          mode = 'night'
        } else if (now < times.nauticalDusk) {
          value = 'dusk'
          mode = 'night'
        } else if (now < times.night) {
          value = 'nauticalDusk'
          mode = 'night'
        } else {
          value = 'night'
          mode = 'night'
        }
      } else {
        mode = 'night'
        if (now >= times.dawn) {
          value = 'dawn'
        } else if (now >= times.nauticalDawn) {
          value = 'nauticalDawn'
        } else {
          value = 'night'
        }
      }

      app.debug(`Setting sun to ${value} and mode to ${mode}`)

      return [
        { path: 'environment.sun', value: value },
        { path: 'environment.mode', value: mode }
      ]
    },
    // Reference sun times for San Francisco (37.77, -122.42) on 2024-01-15 UTC:
    //   nauticalDawn 14:24:11  dawn 14:56:29  sunrise 15:25:11  sunriseEnd 15:28:12
    //   sunsetStart  01:11:53 (+1d)  dusk 01:43:36 (+1d)
    //   nauticalDusk 02:15:54 (+1d)  night 02:47:24 (+1d)
    tests: (function () {
      const position = { latitude: 37.77, longitude: -122.42 }
      const cases = [
        ['2024-01-15T14:00:00Z', 'night', 'night'], //  before nauticalDawn
        ['2024-01-15T14:40:00Z', 'nauticalDawn', 'night'], // between nauticalDawn and dawn
        ['2024-01-15T15:10:00Z', 'dawn', 'night'], //  between dawn and sunrise
        ['2024-01-15T15:26:00Z', 'sunrise', 'day'], //  between sunrise and sunriseEnd
        ['2024-01-15T20:00:00Z', 'day', 'day'], //  full daylight
        ['2024-01-16T01:20:00Z', 'sunset', 'night'], //  between sunsetStart and dusk
        ['2024-01-16T01:50:00Z', 'dusk', 'night'], //  between dusk and nauticalDusk
        ['2024-01-16T02:30:00Z', 'nauticalDusk', 'night'], // between nauticalDusk and night
        ['2024-01-16T03:00:00Z', 'night', 'night'] //  after night
      ]
      return cases.map(([datetime, sun, mode]) => ({
        input: [datetime, position],
        expected: [
          { path: 'environment.sun', value: sun },
          { path: 'environment.mode', value: mode }
        ]
      }))
    })()
  }
}
