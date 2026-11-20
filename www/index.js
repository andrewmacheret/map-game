var worldBankUrl = 'https://api.worldbank.org/v2';
var mapDataUrl = 'https://cdn.jsdelivr.net/npm/@highcharts/map-collection@2.3.3/custom/world.geo.json';

// how many years back to look for each country's latest value
var indicatorYears = 10;

var Game = {
  log: function $this(message, options) {
    if (!options) options = {};
    console && console.log('[' + new Date() + '] ' + message);
    if (!options.quiet) $('#status').text(message);
  },

  progress: function $this(options) {
    // options.guess
    // options.diff
    // options.restart

    if (options.restart) {
      $('#progress').empty();
      Game.log('Progress cleared', {quiet: true});
    }
    if (options.guess) {
      var message;
      if (options.diff) {
        message = options.guess + ' is off by <span class="distance">' + options.diff + '</span>.';
      } else {
        message = options.guess + ' is correct!';
      }
      $('#progress').append('<li>' + message + '</li>');
      Game.log(message, {quiet: true});
    }
  },

  loadFeatures: function $this(options, callback) {
    // use cache if possible
    if (Game.features) {
      callback && callback(null, Game.features);
      return;
    }

    Game.log('Loading features...');
    // no options
    $.getJSON(mapDataUrl).done(function(response) {
      Game.log('Processing features...');
      if (!response || !response.features) {
        //callback('Error loading country map data - invalid response');
        window.setTimeout(function() { $this(options, callback); }, 100);
        return;
      }
      
      var features = {};
      $.each(response.features, function(i, feature) {
        if (feature.id) {
          features[feature.id] = feature.properties;
        }
      });
      Game.log('Features loaded.');
      Game.mapData = response;
      Game.features = features;
      callback && callback(null, features);
    }).fail(function(jqXHR, textStatus, errorThrown) {
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
    $.getJSON(url).done(function(response) {
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
    }).fail(function() {
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
    $.getJSON(url).done(function(response) {
      Game.log('Processing countries...');
      if (!response || !response.length || response.length != 2 || !response[1]) {
        //callback('Error loading countries - invalid response');
        window.setTimeout(function() { $this(options, callback); }, 100);
        return;
      }
      
      var countries = {};
      $.each(response[1], function(i, country) {
        if (country.iso2Code) {
          countries[country.iso2Code] = country;
        }
      });
      Game.log('Countries loaded.');
      Game.countries = countries;
      callback && callback(null, countries);
    }).fail(function(jqXHR, textStatus, errorThrown) {
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
    $.ajax({url: url, dataType: 'json', timeout: 15000}).done(function(response) {
      Game.log('Processing indicator ' + options.indicator.id + '...', {quiet: true});
      if (!response || !response.length || response.length != 2) {
        callback && callback('Error loading world indicator - invalid response');
        //window.setTimeout(function() { $this(options, callback); }, 100);
        return;
      }

      // keep only the most recent value for each country
      var latest = {};
      $.each(response[1] || [], function(i, result) {
        if (result.value === null || result.value === undefined) return;
        var countryId = result.country.id;
        if (!latest[countryId] || result.date > latest[countryId].date) {
          latest[countryId] = result;
        }
      });

      var data = [];
      $.each(latest, function(countryId, result) {
        var feature = options.features[countryId];
        if (feature) {
          data.push({
            code: countryId,
            name: feature.name,
            flag: countryId.replace('UK', 'GB').toLowerCase(),
            actualValue: parseFloat(result.value),
            color: '#cccccc',
            index: data.length
          });
        }
      });
      Game.log('Indicator ' + options.indicator.id + ' loaded', {quiet: true});
      callback && callback(null, data);
    }).fail(function() {
      callback && callback('Error loading world indicator - connection failure');
      //window.setTimeout(function() { $this(options, callback); }, 100);
    });
  },

  rgb2hex: function(rgb) {
    rgb = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
    function hex(x) {
      return ('0' + parseInt(x).toString(16)).slice(-2);
    }
    return '#' + hex(rgb[1]) + hex(rgb[2]) + hex(rgb[3]);
  },

  buildColorFunction: function(min, max, useMax) {
    return function(value) {
      if (value === null) {
        return Game.rgb2hex('rgb(192,192,192)');
      }
    
      if (useMax ? value == max : value == min) {
        return Game.rgb2hex('rgb(0,255,0)');
      }

      var percent = useMax
        ? (value - min) / (max - min)
        : (value - max) / (min - max);
      var red = Math.round(255 * (1 - percent*.80));
      var green = Math.round(255 * (percent*.80));
      var blue = 0;
      return Game.rgb2hex('rgb(' + red + ',' + green + ',' + blue + ')');
    };
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
          Game.log(problem);
          if (pending == 0) $this(options, callback);
        });
      })(indicator);
    }
  },

  loadRandomIndicator: function $this(options, callback) {
    $('#give-up').prop('disabled', true);
    $('#next').prop('disabled', true);

    var useMax = Math.random() < 0.5;
    // use the indicator found in the background during the last game, if any
    var nextIndicator = Game.nextIndicator || $defer(Game.findIndicator, options);
    Game.nextIndicator = null;
    nextIndicator.done(function(result) {
      var indicator = result.indicator;
      var data = result.data;
      var max = data.reduce(function(max, point) {return max == null ? point.actualValue : Math.max(max, point.actualValue)}, null);
      var min = data.reduce(function(min, point) {return min == null ? point.actualValue : Math.min(min, point.actualValue)}, null);

      var initValue = useMax ? min : max;
      var correctValue = useMax ? max : min;
      var correctPoints = data.reduce(function(arr, point) {return point.actualValue == correctValue ? arr.concat(point) : arr;}, []);

      $.each(data, function(i, point) {
        data.value = initValue;
      });

      $.when(
        $defer(Game.loadMap, {
          countries: options.countries,
          indicator: indicator,
          data: data,
          correctPoints: correctPoints,
          colorFunction: Game.buildColorFunction(min, max, useMax),
          container: $("#container"),
          min: min,
          max: max,
          useMax: useMax,
          useLogarithmic: false
        })
      ).fail(function(err) {
        Game.log(err);
        $this(options, callback);
      }).done(function(map) {
        $('#give-up').prop('disabled', false).click(function(event) {
          $(this).prop('disabled', true).unbind(event);
          $('#next').prop('disabled', false);
          Game.reveal(map, correctPoints);
        });
        $('#next').click(function(event) {
          $(this).prop('disabled', true).unbind(event);
          $this(options, callback);
        });
        Game.log('Loaded.');
        Game.progress({restart: true});
        Game.nextIndicator = $defer(Game.findIndicator, options);
        callback && callback();
      });
    });
  },

  loadMap: function(options, callback) {
    // options.countries
    // options.indicator
    // options.data
    // options.correctPoints
    // options.colorFunction
    // options.container
    // options.min
    // options.max
    // options.useMax
    // options.useLogarithmic

    var mapOptions = {
      // the page is always light, so don't follow the OS dark mode
      palette: {
        colorScheme: 'light'
      },

      title: {
        text: 'World Indicators Guessing Game'
      },

      subtitle: {
        text: 'Find country(s) with the ' + (options.useMax ? 'largest' : 'smallest') + ' value for the given indicator'
      },

      legend: {
        title: {
          text: options.indicator.name,
          style: {
            color: (Highcharts.theme && Highcharts.theme.textColor) || 'black'
          }
        }
      },

      credits: {
        href: 'https://data.worldbank.org',
        text: 'Data provided by data.worldbank.org, '
          + 'mapping provided by highcharts.com'
      },

      mapNavigation: {
        enabled: true,
        buttonOptions: {
          verticalAlign: 'bottom'
        }
      },

      tooltip: {
        useHTML: true,
        style: {
          width: '250px'
        },
        pointFormat: '<img class="flag" src="https://flagcdn.com/24x18/{point.flag}.png" width="24" height="18" alt="">'
          + ' {point.name}: <b>{point.value}</b>',
        positioner: function () {
          return { x: 0, y: this.chart.chartHeight - 300 };
        }
      },

      colorAxis: {
        min: options.min,
        max: options.max,
        minColor: options.colorFunction(options.min),
        maxColor: options.colorFunction(options.max),
        reversed: !options.useMax,
        type: options.useLogarithmic ? 'logarithmic' : 'linear'
      },

      series: [{
        data: options.data,
        joinBy: ['iso-a2', 'code'],
        mapData: Game.mapData,
        name: options.indicator.sourceNote + ' ... Source: ' + options.indicator.sourceOrganization,
        states: {
          hover: {
            //color: '#bada55'
          }
        },
        cursor: 'pointer',
        point: {
          events: {
            click: function(e) {
              this.update({
                value: this.actualValue,
                color: null
              }, false);
              map.highcharts().redraw();

              if (this.actualValue == (options.useMax ? options.max : options.min)) {
                Game.progress({
                  guess: this.name
                });

                Game.reveal(map, options.correctPoints);

                $('#give-up').prop('disabled', true).unbind('click');
                $('#next').prop('disabled', false);
              } else {
                //var diff = Math.abs((options.useMax ? options.max : options.min) - this.value);

                var guessCountry = options.countries[this.code];

                var diff = options.correctPoints.map(function(point) {
                  return options.countries[point.code];
                }).reduce(function(min, country) {
                  var distance = Game.distance(guessCountry, country);
                  return Math.min(min, distance);
                }, Number.MAX_VALUE);

                Game.progress({
                  guess: this.name,
                  diff: Math.round(diff) + ' km'
                });
              }
            }
          }
        }
      }]
    };

    var map = options.container.highcharts('Map', mapOptions);

    callback && callback(null, map);
  },

  reveal: function $this(map, correctPoints) {
    var data = map.highcharts().series[0].data;
    $.each(data, function(i, point) {
      this.update({
        color: null,
        value: point.actualValue
      }, false);
    });
    map.highcharts().redraw();
    
    var correctAnswers = correctPoints.map(function(point) {
      return point.name;
    }).sort();

    $('#progress').append('<li>All correct answers: ' + correctAnswers.join(', ') + '</li>');
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

// Convert a function of the form
//   fn(optionsObject, callback)
// to a jquery promise
function $defer(fn, options) {
  var deferred = $.Deferred();
  fn(options, function(err, data) {
    if(err !== null) {
      return deferred.reject(err);
    }
    deferred.resolve(data);
  });
  return deferred.promise();   
}

$(function $this() {
  $.when(
    $defer(Game.loadFeatures, {}),
    $defer(Game.loadIndicators, {}),
    $defer(Game.loadCountries, {})
  ).fail(function(err) {
    //alert(err ' - please try again (reload the page)');
    Game.log(err);
    window.setTimeout(function() { $this(); }, 100);
  }).done(function(features, indicators, countries) {
    Game.loadRandomIndicator({features: features, indicators: indicators, countries: countries});
  });
});

