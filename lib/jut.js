var build_metric = require('./parse').build_metric;
var sender = require('./send-receiver');
var active_sender;

var jut_stats = {};
var logger;
var options = {
    debug: false,
    split_keys: false,
    counter_rates: false,
    extra_tags: {},
};

function flush_metrics(timestamp, metrics) {
    var counters = metrics.counters;
    var gauges = metrics.gauges;
    var timer_data = metrics.timer_data;
    var counter_rates = metrics.counter_rates;
    // XXX currently unimplemented
    // var pctThreshold = metrics.pctThreshold;
    // var sets = metrics.sets;
    // var timer_counters = metrics.timer_counters;

    var payload = [];
    var key;

    timestamp = timestamp * 1000;

    // send counters
    for (key in counters) {
        payload.push(build_metric(options, 'counter', key, timestamp, counters[key], 'sum'));
    }

    // send gauges
    for (key in gauges) {
        // Check for NaN which seems to happen for the internal statsd.timestamp_lag
        if (isNaN(gauges[key])) {
            continue;
        }

        payload.push(build_metric(options, 'gauge', key, timestamp, gauges[key]));
    }

    // send timer_data
    for (key in timer_data) {
        for (var stat_type in timer_data[key]) {
            // some (like 'histogram') are objects
            if (typeof timer_data[key][stat_type] === 'number') {
                payload.push(build_metric(options, 'timer', key, timestamp, timer_data[key][stat_type], stat_type));
            }
        }
    }

    // send counter_rates
    if (options.counter_rates) {
        for (key in counter_rates) {
            payload.push(build_metric(options, 'counter', key, timestamp, counter_rates[key], 'rate'));
        }
    }

    active_sender.send(payload);
}

function status(callback) {
    jut_stats.keys().forEach(function(key) {
        callback(null, 'jut', key, jut_stats[key]);
    });
}

exports.init = function init(startup_time, config, events, logger_in) {
    logger = logger_in;

    options.debug = !!config.debug;

    var jut_config = config.jut || {};

    options.extra_tags = jut_config.tags || {};

    Object.keys(options.extra_tags).forEach(function(tag) {
        if (RESERVED_TAGS[tag]) {
            throw new Error('tag ' + tag + ' is reserved for internal use');
        }
    });

    if (jut_config.sender_module) {
        active_sender = require(jut_config.sender_module);
    }
    else {
        active_sender = sender;
    }

    options.extra_tags.interval = config.flushInterval || 10000;

    options.split_keys = !!jut_config.split_keys;
    options.counter_rates = !!jut_config.counter_rates;

    jut_stats.lastFlush = Date.now() / 1000;
    jut_stats.lastException = Date.now() / 1000;

    active_sender.init(config, jut_stats);

    events.on('flush', flush_metrics);
    events.on('status', status);

    return true;
};
