// ==UserScript==
// @name         Profile History
// @namespace    http://tampermonkey.net/
// @version      1.0.6
// @description  Shows Profile History
// @author       Krzysztof Kruk
// @match        https://*.eyewire.org/*
// @exclude      https://*.eyewire.org/1.0/*
// @downloadURL  https://raw.githubusercontent.com/ChrisRaven/EyeWire-Profile-History/master/profile_history.user.js
// @connect      ewstats.feedia.co
// @require      https://cdnjs.cloudflare.com/ajax/libs/Chart.js/2.6.0/Chart.min.js
// ==/UserScript==

/*jshint esversion: 6 */
/*globals $, account, Chart, Cell, ColorUtils */


var LOCAL = false;
if (LOCAL) {
  console.log('%c--== TURN OFF "LOCAL" BEFORE RELEASING!!! ==--', "color: red; font-style: italic; font-weight: bold;");
}

(function() {
  'use strict';
  'esversion: 6';

  var K = {
    gid: function (id) {
      return document.getElementById(id);
    },
    
    qS: function (sel) {
      return document.querySelector(sel);
    },
    
    qSa: function (sel) {
      return document.querySelectorAll(sel);
    },


    addCSSFile: function (path) {
      $("head").append('<link href="' + path + '" rel="stylesheet" type="text/css">');
    },

    // localStorage
    ls: {
      get: function (key) {
        return localStorage.getItem(account.account.uid + '-ews-' + key);
      },

      set: function (key, val) {
        localStorage.setItem(account.account.uid + '-ews-' + key, val);
      },

      remove: function (key) {
        localStorage.removeItem(account.account.uid + '-ews-' + key);
      }
    },

    // Source: https://stackoverflow.com/a/6805461
    injectJS: function (text, sURL) {
      var
        tgt,
        scriptNode = document.createElement('script');

      scriptNode.type = "text/javascript";
      if (text) {
        scriptNode.textContent = text;
      }
      if (sURL) {
        scriptNode.src = sURL;
      }

      tgt = document.getElementsByTagName('head')[0] || document.body || document.documentElement;
      tgt.appendChild(scriptNode);
    },

    JSON_CORS: function (params) {
      fetch(params.url, {
        method: params.method,
        mode: 'cors'
      })
      .then(function (response) {
        if (response.ok) {
          return response.json();
        }
        throw new Error('Something went wrong');
      })
      .then(function (json) {
        params.onload(json);
      })
      .catch(function (error) {
        params.onerror(error);
      });
    },

    date: {
      dayLengthInMs: 1000 * 60 * 60 * 24,

      // returns date in format of YYYY-MM-DD
      ISO8601DateStr: function (date) {
        return new Intl.DateTimeFormat('en-CA', {
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric',
            hour12: false
          }).format(date);
      },
      
      // returns a string in format YYYY-MM-DD calculated basing on the user time
      calculateHqDate: function () {
        return new Intl.DateTimeFormat('en-CA', {
            timeZone: 'America/New_York',
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric',
            hour12: false
          }).format(Date.now());
      },

      getWeek: function (date) {
        let firstDayOfTheYear = K.date.firstDayOfAYear(date.getFullYear());
        let firstWednesday = 7 - firstDayOfTheYear - 3;
        if (firstWednesday <= 0) {
          firstWednesday += 7;
        }

        let startOfTheFirstWeek = firstWednesday - 3;
        let startOfTheFirstWeekDate = new Date(date.getFullYear(), 0, startOfTheFirstWeek);
        let currentWeek = Math.ceil(((date - startOfTheFirstWeekDate) / 86400000) / 7);

        return currentWeek;
      },

      // source: https://stackoverflow.com/a/16353241
      isLeapYear: function (year) {
        return ((year % 4 === 0) && (year % 100 !== 0)) || (year % 400 === 0);
      },
      
      firstDayOfAYear: function (year) {
        // 0 = Sunday, 1 = Monday, etc.
        return (new Date(year, 0, 1)).getDay();
      },
      
      numberOfWeeksInAYear: function (year) {
        // assuming, that week belongs to the year, which contains the middle day
        // of that week (which is Wednesday in case of Sun-Mon week)
        let firstDay = K.date.firstDayOfAYear(year);
        if (firstDay === 3 || K.date.isLeapYear(year) && (firstDay === 2 || firstDay === 4)) {
          return 53;
        }
        return 52;
      },

      getLast: {
        sevenDays: function (asDates = false) {
          let result = [];
          let currentHqDate = new Date(K.date.calculateHqDate());
          let weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
          let currentDayOfWeek = currentHqDate.getDay();  
          let weekLength = 7;
          let cursor;

          if (asDates) {
            cursor = new Date(currentHqDate.getTime() - weekLength * K.date.dayLengthInMs);

            while (weekLength--) {
              result.push(new Intl.DateTimeFormat('en-CA', {
                year: 'numeric',
                month: 'numeric',
                day: 'numeric'
              }).format(cursor));
              cursor.setDate(cursor.getDate() + 1);
            }
          }
          else {
            cursor = currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1;
            while (weekLength--) {
              if (cursor >= 6) {
                cursor -= 6;
              }
              else {
                ++cursor;
              }

              result.push(weekdays[cursor]);
            }
          }

          return result;
        },

        tenWeeks: function (asDates = false) {
          let result = [];
          let currentHqDate = new Date(K.date.calculateHqDate());
          let year = currentHqDate.getFullYear();
          let currentWeek = K.date.getWeek(currentHqDate);
          let periodLength = 10;
          // -1 below, because we want the last day of the period to be the last completed week, not the current one,
          // but +1, because we want to start at the first day of the period not from
          // before the period started
          let starter = currentWeek - periodLength - 1 + 1;
          let cursor;
          let numberOfWeeksInTheCurrentYear = K.date.numberOfWeeksInAYear(year);
          let numberOfWeeksInThePreviousYear = K.date.numberOfWeeksInAYear(year - 1);

          if (asDates) {
            if (starter <= 0) {
              year--;
              starter += numberOfWeeksInThePreviousYear;
            }
            cursor = starter;
            while (periodLength--) {
              result.push(year + '-' + (cursor < 10 ? '0' : '') + cursor);
              ++cursor;
              if (cursor >= 53) {
                if (numberOfWeeksInTheCurrentYear === 52 || cursor === 54) {
                  cursor = 1;
                  year++;
                }
              }
            }
          }
          else {
            if (starter <= 0) {
              starter += numberOfWeeksInThePreviousYear;
            }
            cursor = starter;
            while (periodLength--) {
              result.push(cursor);
              ++cursor;
              if (cursor >= 53) {
                if (numberOfWeeksInTheCurrentYear === 52 || cursor === 54) {
                  cursor = 1;
                }
              }
            }
          }
          return result;
        },

        twelveMonths: function (asDates = false) {
          let result = [];
          let currentHqDate = new Date(K.date.calculateHqDate());
          let months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          let currentMonth = currentHqDate.getMonth();
          let year = currentHqDate.getFullYear();
          let yearLength = 12;
          let cursor = currentMonth;
          
          // no matter what, if we substract 12 months from the current date, we'll be in the previous year
          --year;

          if (asDates) {
            result.push(year + '-' + (cursor < 9 ? '0' : '') + (cursor + 1));
            --yearLength;
            while (yearLength--) {
              if (cursor > 10) {
                cursor = 0;
                ++year;
              }
              else {
                ++cursor;
              }
              result.push(year + '-' + (cursor < 9 ? '0' : '') + (cursor + 1));
            }
          }
          else {
            result.push(months[cursor]);
            --yearLength;
            while (yearLength--) {
              if (cursor > 10) {
                cursor = 0;
              }
              else {
                ++cursor;
              }
              result.push(months[cursor]);
            }
          }

          return result;
        }
      },

      daysInMonth: function (month, year) {
        if (['April', 'June', 'September', 'November'].indexOf(month) !== -1) {
          return 30;
        }
        if (month === 'February') {
          return K.date.isLeapYear(year) ? 29 : 28;
        }
        return 31;
      },
      
      monthsFullNames: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    }
  };


  var intv = setInterval(function () {
    if (typeof account === 'undefined' || !account.account.uid) {
      return;
    }
    clearInterval(intv);
    main();
  }, 100);
  
  function main() {


// TRACKER
function Tracker() {
  var _this = this;
  
  this.result = {};
  this.collectingInProgress = false;
  
  this.chart = null;
  
  $('#profStats').before(`
  <div class="profileNavButtonGroup" id="profileTimeRangeSelection">
      <div class="profileNavButton selected" data-type="current">current</div>
      <div class="profileNavButton" data-type="previous">previous</div>
      <div class="profileNavButton" data-type="best">best</div>
    </div>
  `);

  $('#profProfile').append(`
    <div id="lastChartsWrapper">
      <div class="ewsProfileHistoryButtonGroup" id="ews-profile-history-period-selection">
        <div class="ewsProfileHistoryButton selected" data-time-range="days">last 7 days</div>
        <div class="ewsProfileHistoryButton" data-time-range="weeks">last 10 weeks</div>
        <div class="ewsProfileHistoryButton" data-time-range="months">last 12 months</div>
      </div>
      <canvas id="ewsProfileHistoryChart" width=800 height=200></canvas>
    </div>
  `);

  this.changeTab = function (type) {
    var
      columnHeaders, lastRowVisible, color;

    switch (type) {
      case 'current':
        columnHeaders = ['Today', 'Week', 'Month', 'Overall'];
        lastRowVisible = true;
        color = '#bfbfbf';
        break;
      case 'previous':
        columnHeaders = ['Day', 'Week', 'Month'];
        lastRowVisible = false;
        color = '#00ee00';
        break;
      case 'best':
        columnHeaders = ['Day', 'Week', 'Month'];
        lastRowVisible = false;
        color = 'gold';
        break;
    }
    
    this.fillTable(type, columnHeaders, lastRowVisible, color);
  };

  
  function fillingHelper(res, el, property, type, period) {
    let prop = property;

    if (property === 'complete') {
      prop = 'completes';
    }

    let entry = res[type][period][prop];
    let val = entry.value;
    let targetVal;

    if (val === null || val === undefined) {
      targetVal = '&mdash;';
    }
    else if (typeof val === 'string' && val.indexOf(',') !== -1) { // built-in values (for current periods)
      targetVal = val;
    }
    else {
      targetVal = new Intl.NumberFormat('en-EN').format(val);
    }
    
    let cell = el.getElementsByClassName(property)[0];
    cell.innerHTML = targetVal;
    
    if (type === 'best') {
      cell.title = entry.date;
    }
    else {
      cell.title = '';
    }
  }
  
  function fillingHelper2(res, el, type, period) {
    fillingHelper(res, el, 'points', type, period);
    fillingHelper(res, el, 'cubes', type, period);
    fillingHelper(res, el, 'trailblazes', type, period);
    if (account.can('scout')) {
      fillingHelper(res, el, 'scythes', type, period);
      if (account.can('scythe mystic admin')) {
        fillingHelper(res, el, 'complete', type, period);
      }
    }
  }
  
  this.fillTable = function (type, columnHeaders, lastRowVisible, color) {
    let table = K.gid('profStats');
    let day = table.getElementsByClassName('day')[0];
    let week = table.getElementsByClassName('week')[0];
    let month = table.getElementsByClassName('month')[0];
    let overall = table.getElementsByClassName('forever')[0];
    let res;

    day.firstElementChild.textContent = columnHeaders[0];
    week.firstElementChild.textContent = columnHeaders[1];
    month.firstElementChild.textContent = columnHeaders[2];
    
    if (!this.dontChangeTheData) {
      res = this.result;

      fillingHelper2(res, day, type, 'day');
      fillingHelper2(res, week, type, 'week');
      fillingHelper2(res, month, type, 'month');
    }

    if (lastRowVisible) {
      overall.style.visibility = 'visible';
      
      overall.firstElementChild.textContent = columnHeaders[3];
      
      if (!this.dontChangeTheData) {
        fillingHelper2(res, overall, type, 'overall');
      }
    }
    else {
      overall.style.visibility = 'hidden';
    }
    
    $('tbody', table).find('.points, .cubes, .trailblazes, .scythes, .complete').css({color: color});
  };


  // creates and object with date and value. Short name, because it's used quite often
  let o = function (value, date) {
    return {
      value: (value !== null && value !== undefined) ? value : null,
      date: (date !== null && date !== undefined) ? date : null
    };
  };
  
  // to make to function also available in public
  this.o = function (value, date) {
    return o(value, date);
  };

  this.getChartSettings = function (labels) {
    let lbl = 'cubes, tbs';
    if (account.can('scout')) {
      lbl += ', scythes';
      if (account.can('scythe mystic admin')) {
        lbl += ', scs';
      }
    }
    return {
      'type': 'line',
      "data":{
        "labels": labels,
        "datasets": []
      },
      "options":{
        "responsive": false,
        "maintainAspectRatio": false,
        "scales":{
          'xAxes': [{
            "ticks":{
              fontColor: '#bfbfbf'
            },
            'gridLines': {
              'display': false
            },
            'stacked': true,
            barPercentage: 0.7,
          }],
          "yAxes":[
            {
              "ticks":{
                "beginAtZero": true,
                fontColor: '#bfbfbf'
              },
              'gridLines': {
                'display': false
              },
              id: 'y-axis-left',
              position: 'left',
              scaleLabel: {
                display: true,
                labelString: lbl,
                fontSize: 14,
                fontColor: '#bfbfbf'
              }
            },
            {
              "ticks":{
                "beginAtZero": true,
                fontColor: '#bfbfbf'
              },
              'gridLines': {
                'display': false
              },
              id: 'y-axis-right',
              position: 'right',
              scaleLabel: {
                display: true,
                labelString: 'points',
                fontSize: 14,
                fontColor: '#bfbfbf'
              }
            }
          ]
        },
        'legend':{
          'display': true,
          position: 'bottom',
          labels: {
            fontColor: '#bfbfbf'
          }
        }
      }
    };
  };
  
  
  this.addDataSeries = function (args) {
    // {settings, type, data, backgroundColor, borderColor}
    // args is an object, so settings is passed by reference, no need to return anything
    args.settings.data.datasets.push({
      type: args.type || 'line',
      label: args.label || '',
      data: args.data,
      fill: false,
      yAxisID: args.yAxisID || 'y-axis-left',
      backgroundColor: args.backgroundColor || 'white',
      borderColor: args.borderColor || 'white',
      borderWidth: args.borderWidth || 1,
      pointRadius: args.pointRadius || 3
    });
  };
  
  
  this.getDataAsArray = function (period, type) {
    let val, result = [], keys;
    let res = this.result.charts[period];

    switch (period) {
      case 'days': keys = K.date.getLast.sevenDays(true); break;
      case 'weeks': keys = K.date.getLast.tenWeeks(true); break;
      case 'months': keys = K.date.getLast.twelveMonths(true); break;
    }
    if (res) {
      for (let i = 0, len = keys.length; i < len; i++) {
        val = res[keys[i]] ? res[keys[i]][type] : null;
        result.push(val === null ? 0 : val);
      }
    }

    return result;
  };
  
  this.addCharts = function (period, labels, update) {
    if (update === undefined) {
      update = false;
    }

    if (this.chart && !update) {
      return;
    }
    
    if (update) {
      this.chart.data.labels.pop();
      this.chart.data.datasets.forEach((dataset) => {
          dataset.data.pop();
      });
    }
    
    this.result.charts = JSON.parse(K.ls.get('profile-history-charts'));

    let settings = this.getChartSettings(labels);

    this.addDataSeries({
      settings: settings,
      label: 'trailblazes',
      data: this.getDataAsArray(period, 'trailblazes'),
      backgroundColor: "rgba(200, 200, 200, 0.3)",
      borderColor: "rgb(200, 200, 200)",
    });

    this.addDataSeries({
      settings: settings,
      label: 'cubes',
      data: this.getDataAsArray(period, 'cubes'),
      backgroundColor: "rgba(0, 200, 0, 0.2)",
      borderColor: "rgb(0, 200, 0)",
    });
    
    let color = ColorUtils.hexToRGB('#FFA500');
    this.addDataSeries({
      settings: settings,
      label: 'points',
      data: this.getDataAsArray(period, 'points'),
      yAxisID: 'y-axis-right',
      backgroundColor: 'rgba(' + color.r + ', ' + color.g + ', ' + color.b + ', 0.2)',
      borderColor: '#FFA500',
    });

    if (account.can('scout')) {
      color = ColorUtils.hexToRGB(Cell.ScytheVisionColors.scythed);
      this.addDataSeries({
        settings: settings,
        label: 'scythes',
        data: this.getDataAsArray(period, 'scythes'),
        backgroundColor: 'rgba(' + color.r + ', ' + color.g + ', ' + color.b + ', 0.2)',
        borderColor: Cell.ScytheVisionColors.scythed,
      });

      if (account.can('scythe mystic admin')) {
        color = ColorUtils.hexToRGB(Cell.ScytheVisionColors.complete2);
        this.addDataSeries({
          settings: settings,
          label: 'completes',
          data: this.getDataAsArray(period, 'completes'),
          backgroundColor: 'rgba(' + color.r + ', ' + color.g + ', ' + color.b + ', 0.2)',
          borderColor: Cell.ScytheVisionColors.complete2,
        });
      }
    }
    
    if (update) {
      this.chart.data.labels = settings.data.labels;
      this.chart.data.datasets = settings.data.datasets;
      this.chart.update();
    }
    else {
      let ctxChart = K.gid('ewsProfileHistoryChart').getContext('2d');
      this.chart = new Chart(ctxChart, settings);
      this.changeChartRange('days');
    }
  };
  
  this.changeChartRange = function (timeRange) {
    let labels = [];
    switch (timeRange) {
      case 'days':
        labels = K.date.getLast.sevenDays();
        break;

      case 'weeks':
        labels = K.date.getLast.tenWeeks();
        break;

      case 'months':
        labels = K.date.getLast.twelveMonths();
        break;
    }
    this.addCharts(timeRange, labels, true);
  };
  
  this.updateDataInProfile = function () {
    let intv = setInterval(function () {
      if (_this.collectingInProgress) {
        return;
      }

      let o = _this.o; // to shorten the name

      let empty = {
        day:   { points: o(), cubes: o(), trailblazes: o(), scythes: o(), completes: o() },
        week:  { points: o(), cubes: o(), trailblazes: o(), scythes: o(), completes: o() },
        month: { points: o(), cubes: o(), trailblazes: o(), scythes: o(), completes: o() }
      };

      clearInterval(intv);
      
      let table = K.gid('profStats');
      let day = table.getElementsByClassName('day')[0];
      let week = table.getElementsByClassName('week')[0];
      let month = table.getElementsByClassName('month')[0];
      let overall = table.getElementsByClassName('forever')[0];
      
      _this.result.current = {
        day: {
          points: o(day.getElementsByClassName('points')[0].textContent),
          cubes: o(day.getElementsByClassName('cubes')[0].textContent),
          trailblazes: o(day.getElementsByClassName('trailblazes')[0].textContent),
          scythes: o(day.getElementsByClassName('scythes')[0].textContent),
          completes: o(day.getElementsByClassName('complete')[0].textContent)
        },
        week: {
          points: o(week.getElementsByClassName('points')[0].textContent),
          cubes: o(week.getElementsByClassName('cubes')[0].textContent),
          trailblazes: o(week.getElementsByClassName('trailblazes')[0].textContent),
          scythes: o(week.getElementsByClassName('scythes')[0].textContent),
          completes: o(week.getElementsByClassName('complete')[0].textContent)
        },
        month: {
          points: o(month.getElementsByClassName('points')[0].textContent),
          cubes: o(month.getElementsByClassName('cubes')[0].textContent),
          trailblazes: o(month.getElementsByClassName('trailblazes')[0].textContent),
          scythes: o(month.getElementsByClassName('scythes')[0].textContent),
          completes: o(month.getElementsByClassName('complete')[0].textContent)
        },
        overall: {
          points: o(overall.getElementsByClassName('points')[0].textContent),
          cubes: o(overall.getElementsByClassName('cubes')[0].textContent),
          trailblazes: o(overall.getElementsByClassName('trailblazes')[0].textContent),
          scythes: o(overall.getElementsByClassName('scythes')[0].textContent),
          completes: o(overall.getElementsByClassName('complete')[0].textContent)
        }
      };

      let previous = K.ls.get('profile-history-previous');
      _this.result.previous = previous ? JSON.parse(previous) : empty;

      let best = K.ls.get('profile-history-best');
      _this.result.best = best ? JSON.parse(best) : empty;

      _this.addCharts('days', K.date.getLast.sevenDays());

    }, 50);
  };
  
  this.fillTheGaps = function (obj, valueOnly = false) {
    obj.points = obj.points || o();
    obj.cubes = obj.cubes || o();
    obj.trailblazes = obj.trailblazes || o();
    obj.scythes = obj.scythes || o();
    obj.completes = obj.completes || o();

    return obj;
  };

  
  this.updateClient = function (callback) {
    let data = [
      'uid=' + account.account.uid,
      'previous=1',
      'best=1',
      'charts=1'
    ].join('&');

    K.JSON_CORS({
      method: 'GET',
      url: 'https://ewstats.feedia.co/update_local_counters.php?' + data,
      onload: function (response) {
        if (response) {
          K.ls.set('profile-history-previous', JSON.stringify({
            day: _this.fillTheGaps(response.previous.day || {}),
            week: _this.fillTheGaps(response.previous.week || {}),
            month: _this.fillTheGaps(response.previous.month || {})
          }));
          K.ls.set('profile-history-best', JSON.stringify({
            day: _this.fillTheGaps(response.best.day || {}),
            week: _this.fillTheGaps(response.best.week || {}),
            month: _this.fillTheGaps(response.best.month || {})
          }));
          K.ls.set('profile-history-charts', JSON.stringify({
            days: response.charts.days,
            weeks: response.charts.weeks,
            months: response.charts.months
          }));
          _this.updateDataInProfile();

          if (callback) {
            callback();
          }
        }
        else {
          console.error('Something went wrong while updating the data from the server');
        }
      },
      onerror: function (error) {
        console.error('error: ', error.message);
      }
    });
  };
  
  
  (function update() {
    let propName = 'profile-history-last-update-date';
    let hqDate = K.date.calculateHqDate().split(',')[0];
    let lastUpdateDate = K.ls.get(propName);
    if (!lastUpdateDate || lastUpdateDate != hqDate) {
      _this.updateClient(function () {
        K.ls.set(propName, hqDate);
      });
    }
  })();

  
  // When a user clicks on his profile first, then change tab to best or previous,
  // then opens another profile, the color of best or previous stood for current tab,
  // so we have to click the current tab first to change the colors and rows.
  // However, when the user clicks on some other profile first, then trying to click
  // on the current tab was giving an error, so we have to check first, the user
  // profile has been loaded
  this.mainProfileLoaded = false;

  $(document)
    .on('click', '#acc', function () {
      _this.collectingInProgress = true;
      _this.updateDataInProfile();
      _this.mainProfileLoaded = true;
    })
    .on('profile-stats-ready', function () {
      _this.collectingInProgress = false;
    });

  $('.profileNavButtonGroup').on('click', '.profileNavButton', function (event, dontChangeTheData) {
    var
      $this = $(this),
      data = $this.data();

    $this
      .parent()
        .find('.profileNavButton')
          .removeClass('selected')
        .end()
      .end()
      .addClass('selected');

    _this.dontChangeTheData = !!dontChangeTheData;
    _this.changeTab(data.type);
  });

  $('.ewsProfileHistoryButtonGroup').on('click', '.ewsProfileHistoryButton', function (event) {
    var
      $this = $(this),
      data = $this.data();

    $this
      .parent()
        .find('.ewsProfileHistoryButton')
          .removeClass('selected')
        .end()
      .end()
      .addClass('selected');

    _this.changeChartRange(data.timeRange);
  });

  this.dontChangeTheData = false;
 
  var observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
      if (mutation.target.classList.contains('attention-display')) {
        let intv = setInterval(function () {
          if (!K.gid('profUsername').textContent.length) {
            return;
          }
          
          clearInterval(intv);
          // we have to turn off observing for a bit, to make the changes without
          // triggering the obverver and falling into an endless loop...
          observer.disconnect();
          if (document.getElementById('profUsername').textContent === account.account.username) {
            K.gid('profileContainer').classList.add('own-profile');
          }
          else {
            if (_this.mainProfileLoaded) {
              $('.profileNavButton:first').trigger('click', [true]);
            }
            K.gid('profileContainer').classList.remove('own-profile');
          }
          // ... end then turn it on again
          observer.observe(K.gid('profileContainer'), {attributes: true});
        }, 50);
      }
    });
  });
 
  observer.observe(K.gid('profileContainer'), {attributes: true});
}
// end: TRACKER


if (LOCAL) {
  K.addCSSFile('http://127.0.0.1:8887/styles.css');
}
else {
  K.addCSSFile('https://chrisraven.github.io/EyeWire-Profile-History/styles.css?v=1');
}



new Tracker(); // jshint ignore:line


$('.spawnerBacklog > h1').append('<button id="pizza-button" class="smallButton flat darkGrayButton">🍕</button>');
$('#pizza-button').click(function () {
  var popup = new Attention.Confirmation({
    situation: 'information calm',
    title: 'SPAWNER',
    message: 'THANKS!<br><div style="font-size: 10px">*om nom nom*</div>',
    ok: { label: 'You\'re Welcome!', klass: 'flat' },
    cancel: { skip: true }
  });

  popup.show();
});

} // end: main()



})(); // end: wrapper
