var fetch = require('node-fetch');
var moment = require('moment');
var results = {};
var scoreboard = {'atLeastOne': {},
               'atLeastFive': {},
               'atLeastTen': {},
               'atLeastTwenty': {}};

var repeats = {
    repeatsWholePeriod: {},
    repeatsSixMonths: {},
    repeatsThreeMonths: {}
};

var leftPad = require('left-pad');
var fs = require('fs');
var csvWriter = require('csv-write-stream');
var writer = csvWriter();

var versions = ["cf_status_firefox42", "cf_status_firefox43",
         "cf_status_firefox44", "cf_status_firefox45",
         "cf_status_firefox46", "cf_status_firefox47",
         "cf_status_firefox48", "cf_status_firefox49"];
var months = ["2015-05-01", "2015-06-01", "2015-07-01", "2015-08-01", "2015-09-01",
         "2015-10-01", "2015-11-01", "2015-12-01", "2016-01-01", "2016-02-01", 
         "2016-03-01", "2016-04-01", "2016-05-01"];
var monthsCount = months.length;
var monthEnds = ["2015-05-31", "2015-06-30", "2015-07-31", "2015-08-31", "2015-09-30",
         "2015-10-31", "2015-11-30", "2015-12-31", "2016-01-31", "2016-02-29", 
         "2016-03-31", "2016-04-30", "2016-05-31"];

var foundMonths = {"2015-05-01": 0, "2015-06-01": 0, "2015-07-01": 0,
         "2015-08-01": 0, "2015-09-01": 0, "2015-10-01": 0,
         "2015-11-01": 0, "2015-12-01": 0, "2016-01-01": 0,
         "2016-02-01": 0, "2016-03-01": 0, "2016-04-01": 0,
         "2016-05-01": 0};

var count = 0;

createScoreboard();

months.forEach(function(month, i) { fetch('https://bugzilla.mozilla.org/rest/bug?include_fields=id,creator,creation_time,keywords,whiteboard&bug_severity=blocker&bug_severity=critical&bug_severity=major&bug_severity=normal&bug_severity=minor&bug_severity=trivial&chfield=%5BBug%20creation%5D&chfieldfrom=' + month + '&chfieldto=' + monthEnds[i] + '&limit=0&product=Core&product=Firefox&product=Firefox%20for%20Android&product=Firefox%20for%20iOS&product=Toolkit&resolution=---&resolution=FIXED&resolution=WONTFIX&resolution=DUPLICATE&resolution=WORKSFORME&resolution=SUPPORT&resolution=EXPIRED&resolution=MOVED', {timeout: 0}).then(function(res) { return res.json(); }).then(function(json) { var buglist = json.bugs; rollup(buglist); count++; if(count === months.length) { report(); } }); });

function rollup(buglist) {

    var found, created; 

    buglist.forEach(function(bug, i) {
        // get date
        created = moment.utc(bug.creation_time);

        // count unique contributors
        if (typeof results[bug.creator] === 'undefined') {
            results[bug.creator] = {total: 1};
            results[bug.creator].name = bug.creator;
            months.forEach(function(month, i) {
                results[bug.creator][month] = 0;
                // results[bug.creator]['regressions-' + month] = 0;
            });
        }  
        else {
            results[bug.creator].total ++;
        }

        // mark where found
        found = created.get('year') + '-' + leftPad(created.get('month') + 1, 2, 0) + '-01';

        foundMonths[found]++;
        results[bug.creator][found]++;

        /**
        if (isRegression(bug)) {
            results[bug.creator]['regressions-' + found]++;
        }
        **/

    });    
};

var atLeastX = function atLeastX(x) {
    return function(value) {
        return (value >= x);
    }
}

var atLeastOne    = atLeastX(1);
var atLeastFive   = atLeastX(5);
var atLeastTen    = atLeastX(10);
var atLeastTwenty = atLeastX(20);

function isRegression(bug) {
    if ((bug.keywords.indexOf('regression') > -1) ||
        (bug.whiteboard.indexOf('regression') > -1)) {
        return true;
    }
    return false;
}

function createScoreboard() {
    var keys = Object.keys(scoreboard);
    keys.forEach(function(key, i) {
        months.forEach(function(month, j) {
            scoreboard[key][month] = 0;
        });
    }); 
}

function report() {
    var contributors = Object.keys(results);
    contributors.forEach(function(contributor, i) {

        var monthsContributing = 0, lastSixMonthsContributing = 0,
            lastThreeMonthsContributing = 0;

        months.forEach(function(month, j) {

            if (atLeastOne(results[contributor][month])) {
                scoreboard.atLeastOne[month]++;

                // update repeat contributions
                monthsContributing++;

                if (monthsCount - j <= 6) {
                    lastSixMonthsContributing++;
                }                

                if (monthsCount - j <= 3) {
                    lastThreeMonthsContributing++;
                }
        
            }
            if (atLeastFive(results[contributor][month])) {
                scoreboard.atLeastFive[month]++;
            }
            if (atLeastTen(results[contributor][month])) {
                scoreboard.atLeastTen[month]++;
            }
            if (atLeastTwenty(results[contributor][month])) {
                scoreboard.atLeastTwenty[month]++;
            }
        });
       
        // record repeat contributions over different time scale
 
        if (repeats.repeatsWholePeriod[monthsContributing]) {
            repeats.repeatsWholePeriod[monthsContributing] ++;
        } else {
            repeats.repeatsWholePeriod[monthsContributing] = 1;
        }

        if (repeats.repeatsSixMonths[lastSixMonthsContributing]) {
            repeats.repeatsSixMonths[lastSixMonthsContributing] ++;
        } else {
            repeats.repeatsSixMonths[lastSixMonthsContributing] = 1;
        }

        if (repeats.repeatsThreeMonths[lastThreeMonthsContributing]) {
            repeats.repeatsThreeMonths[lastThreeMonthsContributing] ++;
        } else {
            repeats.repeatsThreeMonths[lastThreeMonthsContributing] = 1;
        }
        
    }); 

    getCSV();   

    console.log(repeats);
}

function getCSV() {
    console.log('in getCSV');
    try {
        var keys = Object.keys(scoreboard);
        writer.pipe(fs.createWriteStream('./out.csv'));
        writer.write(foundMonths)
        keys.forEach(function(key, i) {
            writer.write(scoreboard[key]);        
        });
    }
    catch (e) {
        console.log(e);
    }
};


