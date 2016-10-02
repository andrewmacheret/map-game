var remoteApiUrl = 'https://andrewmacheret.com/servers/remote-apis';

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
      callback && callback(null, features);
      return;
    }

    Game.log('Loading features...');
    // no options
    var url = remoteApiUrl + '/highmaps/worlds/custom/world';
    $.getJSON(url).done(function(response) {
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
      callback(null, indicators);
      return;
    }

    Game.log('Loading indicators...');
    // no options
    var url = remoteApiUrl + '/worldbank/indicators';
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
      callback && callback(null, countries);
      return;
    }

    Game.log('Loading countries...');
    // no options
    var url = remoteApiUrl + '/worldbank/countries';
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
    Game.log('Loading indicator...');
    // options.indicator
    // options.features
    var url = remoteApiUrl + '/worldbank/indicators/' + options.indicator.id;
    $.getJSON(url).done(function(response) {
      Game.log('Processing indicator...');
      if (!response || !response.length || response.length != 2) {
        callback && callback('Error loading world indicator - invalid response');
        //window.setTimeout(function() { $this(options, callback); }, 100);
        return;
      }

      var data = [];
      $.each(response[1] || [], function(i, result) {
        var countryId = result.country.id;
        var feature = options.features[countryId];
        if (feature && result.value !== null && result.value !== undefined) {
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
      Game.log('Indicator loaded');
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

  loadRandomIndicator: function $this(options, callback) {
    $('#give-up').prop('disabled', true);
    $('#next').prop('disabled', true);

    var indicator = options.indicators[Math.floor(Math.random() * options.indicators.length)];
    var useMax = Math.random() < 0.5;
    $.when(
      $defer(Game.loadIndicator, {features: options.features, indicator: indicator})
    ).fail(function(err) {
      Game.log(err);
      $this(options, callback);
    }).done(function(data) {
      if (data.length == 0) {
        Game.log('No data');
        $this(options, callback);
        return;
      }
      //Game.log(JSON.stringify({data: data}, 0, 4));
      var max = data.reduce(function(max, point) {return max == null ? point.actualValue : Math.max(max, point.actualValue)}, null);
      var min = data.reduce(function(min, point) {return min == null ? point.actualValue : Math.min(min, point.actualValue)}, null);
      if (max == min) {
        Game.log('No difference');
        $this(options, callback);
        return;
      } else if (data.length < 100) {
        Game.log('No challenge');
        $this(options, callback);
        return;
      }

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
        href: 'http://data.worldbank.org',
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
        pointFormat: '<span class="f32"><span class="flag {point.flag}"></span></span>'
          + ' {point.name}: <b>{point.value}</b>',
        positioner: function () {
          return { x: 0, y: map.height() - 300 };
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
        mapData: Highcharts.maps['custom/world'],
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

    Game.progress('All correct answers: ' + correctAnswers);
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

