var worldBankUrl = 'https://api.worldbank.org/v2';
var mapDataUrl = 'https://cdn.jsdelivr.net/npm/@highcharts/map-collection@2.3.3/custom/world.geo.json';

// how many years back to look for each country's latest value
var indicatorYears = 10;

var Game = {
  log: function $this(message, options) {
    if (!options) options = {};
    console && console.log('[' + new Date() + '] ' + message);
    if (!options.quiet) {
      document.getElementById('status').textContent = message;
      document.body.classList.toggle('busy', /\.\.\.$/.test(message));
    }
  },

  progress: function $this(options) {
    // options.point
    // options.diff (km to the nearest answer, or nothing if correct)
    // options.restart

    var list = document.getElementById('progress');
    if (options.restart) {
      list.replaceChildren();
      Game.log('Progress cleared', {quiet: true});
    }
    if (options.point) {
      var result = document.createElement('span');
      if (options.diff == null) {
        result.className = 'correct';
        result.textContent = 'Correct!';
      } else {
        result.className = 'distance';
        result.textContent = Game.formatKm(options.diff) + ' off';
      }
      var item = document.createElement('li');
      item.append(Game.countryLabel(options.point), result);
      list.prepend(item);
      Game.log(options.point.name + ': ' + result.textContent, {quiet: true});
    }
  },

  // a flag and a country name, for the guess list
  countryLabel: function(point) {
    var label = document.createElement('span');
    label.className = 'country';
    var flag = document.createElement('img');
    flag.className = 'flag';
    flag.src = 'https://flagcdn.com/24x18/' + point.flag + '.png';
    flag.width = 24;
    flag.height = 18;
    flag.alt = '';
    var name = document.createElement('span');
    name.textContent = point.name;
    label.append(flag, name);
    return label;
  },

  formatKm: function(km) {
    return Math.round(km).toLocaleString() + ' km';
  },

  // short numbers like 1.23M or 45.6 so tooltips and the legend stay readable
  formatValue: function(value) {
    if (value == null) return '';
    return new Intl.NumberFormat(undefined, {
      notation: Math.abs(value) >= 1e6 ? 'compact' : 'standard',
      maximumSignificantDigits: 4
    }).format(value);
  },

  loadFeatures: function $this(options, callback) {
    // use cache if possible
    if (Game.features) {
      callback && callback(null, Game.features);
      return;
    }

    Game.log('Loading features...');
    // no options
    getJSON(mapDataUrl).then(function(response) {
      Game.log('Processing features...');
      if (!response || !response.features) {
        //callback('Error loading country map data - invalid response');
        window.setTimeout(function() { $this(options, callback); }, 100);
        return;
      }
      
      var features = {};
      response.features.forEach(function(feature) {
        if (feature.id) {
          features[feature.id] = feature.properties;
        }
      });
      Game.log('Features loaded.');
      Game.mapData = response;
      Game.features = features;
      callback && callback(null, features);
    }, function() {
      Game.log('Error loading country map data - connection failure');
      window.setTimeout(function() { $this(options, callback); }, 100);
    });
  },

  loadIndicators: function $this(options, callback) {
    // use cache if possible
    if (Game.indicators) {
      callback && callback(null, Game.indicators);
      return;
    }

    Game.log('Loading indicators...');
    // no options
    // source 2 is World Development Indicators, the full list is 15MB
    var url = worldBankUrl + '/source/2/indicator?format=json&per_page=32767';
    getJSON(url).then(function(response) {
      Game.log('Processing indicators...');
      if (!response || !response.length || response.length != 2 || !response[1]) {
        //callback('Error loading world indicators - invalid response');
        window.setTimeout(function() { $this(options, callback); }, 100);
        return;
      }

      var indicators = response[1];
      Game.log('Indicators loaded');
      Game.indicators = indicators;
      callback && callback(null, indicators);
    }, function() {
      Game.log('Error loading world indicators - connection failure');
      window.setTimeout(function() { $this(options, callback); }, 100);
    });
  },

  loadCountries: function $this(options, callback) {
    // use cache if possible
    if (Game.countries) {
      callback && callback(null, Game.countries);
      return;
    }

    Game.log('Loading countries...');
    // no options
    var url = worldBankUrl + '/country?format=json&per_page=32767';
    getJSON(url).then(function(response) {
      Game.log('Processing countries...');
      if (!response || !response.length || response.length != 2 || !response[1]) {
        //callback('Error loading countries - invalid response');
        window.setTimeout(function() { $this(options, callback); }, 100);
        return;
      }
      
      var countries = {};
      response[1].forEach(function(country) {
        if (country.iso2Code) {
          countries[country.iso2Code] = country;
        }
      });
      Game.log('Countries loaded.');
      Game.countries = countries;
      callback && callback(null, countries);
    }, function() {
      Game.log('Error loading countries - connection failure');
      window.setTimeout(function() { $this(options, callback); }, 100);
    });
  },

  loadIndicator: function $this(options, callback) {
    Game.log('Loading indicator ' + options.indicator.id + '...', {quiet: true});
    // options.indicator
    // options.features
    var year = new Date().getFullYear();
    var url = worldBankUrl + '/country/all/indicator/' + encodeURIComponent(options.indicator.id)
      + '?format=json&per_page=32767&date=' + (year - indicatorYears) + ':' + year;
    // some indicators make the World Bank API hang, so give up and pick another
    getJSON(url, {signal: AbortSignal.timeout(15000)}).then(function(response) {
      Game.log('Processing indicator ' + options.indicator.id + '...', {quiet: true});
      if (!response || !response.length || response.length != 2) {
        callback && callback('Error loading world indicator - invalid response');
        //window.setTimeout(function() { $this(options, callback); }, 100);
        return;
      }

      // keep only the most recent value for each country
      var latest = {};
      (response[1] || []).forEach(function(result) {
        if (result.value === null || result.value === undefined) return;
        var countryId = result.country.id;
        if (!latest[countryId] || result.date > latest[countryId].date) {
          latest[countryId] = result;
        }
      });

      var data = [];
      Object.keys(latest).forEach(function(countryId) {
        var result = latest[countryId];
        var feature = options.features[countryId];
        if (feature) {
          data.push({
            code: countryId,
            name: feature.name,
            flag: countryId.replace('UK', 'GB').toLowerCase(),
            actualValue: parseFloat(result.value),
            color: 'var(--hidden)',
            index: data.length
          });
        }
      });
      Game.log('Indicator ' + options.indicator.id + ' loaded', {quiet: true});
      callback && callback(null, data);
    }, function() {
      callback && callback('Error loading world indicator - connection failure');
      //window.setTimeout(function() { $this(options, callback); }, 100);
    });
  },

  // colors from far off to the answer, the same in light and dark mode
  palette: ['#312e81', '#6d28d9', '#c026d3', '#f472b6', '#fbbf24'],

  // the answer end of the scale is always the last palette color
  colorStops: function(useMax) {
    var colors = useMax ? Game.palette : Game.palette.slice().reverse();
    return colors.map(function(color, i) {
      return [i / (colors.length - 1), color];
    });
  },

  // returns why an indicator makes a bad game, or nothing if it's fine
  checkIndicatorData: function(data) {
    if (data.length == 0) return 'No data';
    if (data.length < 100) return 'No challenge';
    var first = data[0].actualValue;
    if (data.every(function(point) { return point.actualValue == first; })) return 'No difference';
  },

  // the World Bank API is slow and many indicators are too sparse to play,
  // so try a few random ones at once and use the first good one
  findIndicator: function $this(options, callback) {
    var tries = 4;
    var pending = tries;
    var found = false;
    for (var i = 0; i < tries; i++) {
      var indicator = options.indicators[Math.floor(Math.random() * options.indicators.length)];
      (function(indicator) {
        Game.loadIndicator({features: options.features, indicator: indicator}, function(err, data) {
          pending--;
          if (found) return;
          var problem = err || Game.checkIndicatorData(data);
          if (!problem) {
            found = true;
            callback(null, {indicator: indicator, data: data});
            return;
          }
          Game.log(indicator.id + ': ' + problem, {quiet: true});
          if (pending == 0) $this(options, callback);
        });
      })(indicator);
    }
  },

  loadRandomIndicator: function $this(options, callback) {
    var giveUp = document.getElementById('give-up');
    var next = document.getElementById('next');
    giveUp.disabled = true;
    next.disabled = true;
    Game.log('Finding a playable indicator...');

    var useMax = Math.random() < 0.5;
    // use the indicator found in the background during the last game, if any
    var nextIndicator = Game.nextIndicator || defer(Game.findIndicator, options);
    Game.nextIndicator = null;
    nextIndicator.then(function(result) {
      var indicator = result.indicator;
      var data = result.data;
      var max = data.reduce(function(max, point) {return max == null ? point.actualValue : Math.max(max, point.actualValue)}, null);
      var min = data.reduce(function(min, point) {return min == null ? point.actualValue : Math.min(min, point.actualValue)}, null);

      var correctValue = useMax ? max : min;
      var correctPoints = data.reduce(function(arr, point) {return point.actualValue == correctValue ? arr.concat(point) : arr;}, []);

      defer(Game.loadMap, {
        countries: options.countries,
        indicator: indicator,
        data: data,
        correctPoints: correctPoints,
        container: document.getElementById('container'),
        min: min,
        max: max,
        useMax: useMax,
        useLogarithmic: false
      }).then(function(map) {
        giveUp.disabled = false;
        giveUp.onclick = function() {
          giveUp.disabled = true;
          giveUp.onclick = null;
          next.disabled = false;
          Game.reveal(map, correctPoints);
          Game.log('The answer is outlined on the map.');
        };
        next.onclick = function() {
          next.disabled = true;
          next.onclick = null;
          $this(options, callback);
        };
        Game.log('Click a country to guess.');
        Game.progress({restart: true});
        Game.nextIndicator = defer(Game.findIndicator, options);
        callback && callback();
      }, function(err) {
        Game.log(err);
        $this(options, callback);
      });
    });
  },

  loadMap: function(options, callback) {
    // options.countries
    // options.indicator
    // options.data
    // options.correctPoints
    // options.container
    // options.min
    // options.max
    // options.useMax
    // options.useLogarithmic

    var target = options.useMax ? options.max : options.min;
    var guesses = 0;

    var mapOptions = {
      // follow the OS light or dark mode, like the page
      palette: {
        colorScheme: 'light dark'
      },

      chart: {
        backgroundColor: 'transparent',
        // leave room on the left for the panel so it doesn't hide countries
        spacing: [12, 12, 12, 364],
        style: { fontFamily: 'inherit' }
      },

      title: { text: null },

      legend: {
        title: {
          text: options.useMax ? 'Answer is the highest' : 'Answer is the lowest',
          style: { color: 'var(--muted)', fontWeight: 'normal', fontSize: '12px' }
        },
        align: 'right',
        verticalAlign: 'bottom',
        floating: true,
        backgroundColor: 'var(--panel)',
        borderColor: 'var(--border)',
        borderWidth: 1,
        borderRadius: 12,
        padding: 12,
        symbolWidth: 220,
        itemStyle: { color: 'var(--text)' }
      },

      credits: { enabled: false },

      exporting: {
        buttons: {
          contextButton: {
            theme: {
              fill: 'var(--panel)',
              stroke: 'var(--border)',
              r: 8,
              states: { hover: { fill: 'var(--control-hover)' }, select: { fill: 'var(--control-hover)' } }
            },
            symbolStroke: 'var(--text)'
          }
        }
      },

      mapNavigation: {
        enabled: true,
        buttonOptions: {
          align: 'right',
          verticalAlign: 'top',
          y: 40,
          theme: {
            fill: 'var(--panel)',
            stroke: 'var(--border)',
            'stroke-width': 1,
            r: 8,
            style: { color: 'var(--text)' },
            states: { hover: { fill: 'var(--control-hover)' } }
          }
        }
      },

      tooltip: {
        useHTML: true,
        backgroundColor: 'var(--panel)',
        borderColor: 'var(--border)',
        borderRadius: 10,
        shadow: false,
        style: { color: 'var(--text)' },
        headerFormat: '',
        pointFormatter: function() {
          var value = this.value == null ? '' : ': <b>' + Game.formatValue(this.value) + '</b>';
          return '<img class="flag" src="https://flagcdn.com/24x18/' + this.flag + '.png" width="24" height="18" alt=""> '
            + this.name + value;
        },
        nullFormat: 'No data'
      },

      colorAxis: {
        min: options.min,
        max: options.max,
        stops: Game.colorStops(options.useMax),
        // put the answer on the right end of the legend
        reversed: !options.useMax,
        type: options.useLogarithmic ? 'logarithmic' : 'linear',
        labels: {
          style: { color: 'var(--muted)' },
          formatter: function() {
            return Game.formatValue(this.value);
          }
        }
      },

      // on phones the panel is below the map, so move the legend to the top
      responsive: {
        rules: [{
          condition: { maxWidth: 700 },
          chartOptions: {
            chart: { spacing: [12, 12, 12, 12] },
            legend: { verticalAlign: 'top', align: 'left', symbolWidth: 160 }
          }
        }]
      },

      series: [{
        data: options.data,
        joinBy: ['iso-a2', 'code'],
        mapData: Game.mapData,
        name: options.indicator.name,
        borderColor: 'var(--border)',
        // no-data countries get /// stripes and no hover, so they don't look clickable
        nullColor: {
          pattern: {
            path: { d: 'M 0 8 L 8 0 M -2 2 L 2 -2 M 6 10 L 10 6', stroke: 'var(--null-line)', strokeWidth: 1.5 },
            width: 8,
            height: 8,
            backgroundColor: 'var(--null)'
          }
        },
        nullInteraction: false,
        cursor: 'pointer',
        states: {
          hover: {
            borderColor: 'var(--bright)',
            borderWidth: 1.5
          }
        },
        point: {
          events: {
            click: function(e) {
              if (map.gameOver || this.guessed || this.actualValue == null) return;
              this.guessed = true;
              guesses++;

              this.update({
                value: this.actualValue,
                color: null
              }, false);
              map.redraw();

              if (this.actualValue == target) {
                Game.progress({
                  point: this
                });

                Game.reveal(map, options.correctPoints);
                Game.log('You found it in ' + guesses + (guesses == 1 ? ' guess!' : ' guesses.'));

                var giveUp = document.getElementById('give-up');
                giveUp.disabled = true;
                giveUp.onclick = null;
                document.getElementById('next').disabled = false;
              } else {
                var guessCountry = options.countries[this.code];

                var diff = options.correctPoints.map(function(point) {
                  return options.countries[point.code];
                }).reduce(function(min, country) {
                  var distance = Game.distance(guessCountry, country);
                  return Math.min(min, distance);
                }, Number.MAX_VALUE);

                Game.progress({
                  point: this,
                  diff: diff
                });
              }
            }
          }
        }
      }]
    };

    document.getElementById('goal').textContent = options.useMax ? 'highest' : 'lowest';
    document.getElementById('indicator').textContent = options.indicator.name;
    document.getElementById('note').textContent = options.indicator.sourceNote || 'No description.';
    document.getElementById('note-source').textContent = options.indicator.sourceOrganization
      ? 'Source: ' + options.indicator.sourceOrganization : '';
    var indicatorUrl = 'https://data.worldbank.org/indicator/' + encodeURIComponent(options.indicator.id);
    document.getElementById('indicator-link').href = indicatorUrl;
    document.getElementById('source-link').href = indicatorUrl;
    document.getElementById('answer').replaceChildren();
    document.getElementById('about').open = false;

    if (Game.map) Game.map.destroy();
    var map = Game.map = Highcharts.mapChart(options.container, mapOptions);

    callback && callback(null, map);
  },

  reveal: function $this(map, correctPoints) {
    map.gameOver = true;
    var correct = {};
    correctPoints.forEach(function(point) {
      correct[point.code] = true;
    });

    map.series[0].data.forEach(function(point) {
      point.update({
        color: null,
        value: point.actualValue,
        // outline the answers so small countries are easier to spot
        borderColor: correct[point.code] ? 'var(--bright)' : undefined,
        borderWidth: correct[point.code] ? 2 : undefined
      }, false);
    });
    map.redraw();

    var answers = correctPoints.slice().sort(function(a, b) {
      return a.name.localeCompare(b.name);
    });
    var answer = document.getElementById('answer');
    var heading = document.createElement('div');
    heading.className = 'answer-heading';
    heading.textContent = (answers.length == 1 ? 'Answer' : 'Answers') + ' (' + Game.formatValue(answers[0].actualValue) + ')';
    answer.replaceChildren(heading);
    answers.forEach(function(point) {
      answer.append(Game.countryLabel(point));
    });
  },

  distance: function $this(country1, country2) {
    var lat1 = parseFloat(country1.latitude);
    var lat2 = parseFloat(country2.latitude);
    var lon1 = parseFloat(country1.longitude);
    var lon2 = parseFloat(country2.longitude);
    var p = 0.017453292519943295;    // Math.PI / 180
    var c = Math.cos;
    var a = 0.5 - c((lat2 - lat1) * p)/2 + 
            c(lat1 * p) * c(lat2 * p) * 
            (1 - c((lon2 - lon1) * p))/2;

    return 12742 * Math.asin(Math.sqrt(a)); // 2 * R; R = 6371 km
  }
}

// fetch JSON, failing on HTTP errors and bad JSON too
function getJSON(url, options) {
  return fetch(url, options).then(function(response) {
    if (!response.ok) throw new Error(response.status + ' ' + response.statusText);
    return response.json();
  });
}

// Convert a function of the form
//   fn(optionsObject, callback)
// to a promise
function defer(fn, options) {
  var resolve, reject;
  var promise = new Promise(function(res, rej) {
    resolve = res;
    reject = rej;
  });
  // call fn outside the Promise so its errors throw instead of rejecting
  fn(options, function(err, data) {
    if(err !== null) {
      return reject(err);
    }
    resolve(data);
  });
  return promise;
}

document.addEventListener('DOMContentLoaded', function init() {
  Promise.all([
    defer(Game.loadFeatures, {}),
    defer(Game.loadIndicators, {}),
    defer(Game.loadCountries, {})
  ]).then(function(results) {
    Game.loadRandomIndicator({features: results[0], indicators: results[1], countries: results[2]});
  }, function(err) {
    //alert(err ' - please try again (reload the page)');
    Game.log(err);
    window.setTimeout(function() { init(); }, 100);
  });
});

