var http = require('http');
var url = require('url');

var receiver_url;
var http_opts;
var jut_stats = {};
var logger;
var options = {
    debug: false,
    split_keys: false,
    counter_rates: false,
    extra_tags: {},
};
var RESERVED_TAGS = {
    time: true,
    value: true,
    source_type: true,
    metric_type: true,
    stat: true,
    name: true,
    interval: true,
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
        payload.push(_build_metric('counter', key, timestamp, counters[key], 'sum'));
    }

    // send gauges
    for (key in gauges) {
        // Check for NaN which seems to happen for the internal statsd.timestamp_lag
        if (isNaN(gauges[key])) {
            continue;
        }

        payload.push(_build_metric('gauge', key, timestamp, gauges[key]));
    }

    // send timer_data
    for (key in timer_data) {
        for (var stat_type in timer_data[key]) {
            // some (like 'histogram') are objects
            if (typeof timer_data[key][stat_type] === 'number') {
                payload.push(_build_metric('timer', key, timestamp, timer_data[key][stat_type], stat_type));
            }
        }
    }

    // send counter_rates
    if (options.counter_rates) {
        for (key in counter_rates) {
            payload.push(_build_metric('counter', key, timestamp, counter_rates[key], 'rate'));
        }
    }

    _post_stats(payload);
}

function _post_stats(payload) {
    if (!(payload instanceof Array && payload.length > 0)) {
        return;
    }

    var post_body = JSON.stringify(payload, null, 2);

    var req = http.request(http_opts, function(res) {

        var res_body = '';

        res.setEncoding('utf8');
        res.on('data', function(chunk) {
            res_body += chunk;
        });

        res.on('end', function() {
            if (res.statusCode === 200) {
                jut_stats.lastFlush = Date.now() / 1000;
            }
            else {
                jut_stats.lastException = Date.now() / 1000;

                if (options.debug) {
                    logger.log('error importing metric:' + ' ' +  res.statusCode + ' ' +  res_body);
                }
            }

            res.removeAllListeners();
            req.removeAllListeners();
        });
    });

    req.on('error', function(e) {
        jut_stats.lastException = Date.now() / 1000;
        if (options.debug) {
            logger.log('error importing metric: ' + e);
        }

        req.removeAllListeners();
    });

    req.end(post_body, 'utf8');
}


function _parse_split(key) {
    if (! options.split_keys) {
        return {
            key: key,
            tags: {}
        };
    }

    var parts = key.split('.');
    if (parts.length === 0) {
        return {key: key, tags: []};
    }

    var pre_keys = [];
    var tags = {};
    parts.forEach(function(p) {
        var tag = p.split('__');
        if (tag.length === 2 && tag[0] !== '' && !RESERVED_TAGS[tag[0]]) {
            tags[tag[0]] = tag[1];
        }
        else {
            pre_keys.push(p);
        }
    });

    return {
        key: pre_keys.join('.'),
        tags: tags
    };
}

function _copy_tags(metric, source) {
    var metric_keys = Object.keys(source);
    var key;

    for (var i = 0; i < metric_keys.length; i++) {
        key = metric_keys[i];
        metric[key] = source[key];
    }
}

function _build_metric(metric_type, name, timestamp, value, stat_type) {
    // extract tags from metric name, if enabled
    var o = _parse_split(name);
    var metric = o.tags;

    metric.metric_type = metric_type;
    metric.name = o.key;

    _copy_tags(metric, options.extra_tags);

    metric.time = timestamp;
    metric.value = value;
    metric.source_type = 'metric';

    if (stat_type) {
        metric.stat = stat_type;
    }

    return metric;
}


function status(callback) {
    jut_stats.keys().forEach(function(key) {
        callback(null, 'jut', key, jut_stats[key]);
    });
}

exports.init = function init(startup_time, config, events, logger_in) {
    logger = logger_in;

    options.debug = config.debug;
    var jut_config = config.jut || {};

    receiver_url = jut_config.url;

    if (! receiver_url) {
        throw new Error('jut.url must be specified');
    }

    options.extra_tags = jut_config.tags || {}; // XXX unit test

    Object.keys(options.extra_tags).forEach(function(tag) {
        if (RESERVED_TAGS[tag]) {
            throw new Error('tag ' + tag + ' is reserved for internal use');
        }
    });

    options.extra_tags.interval = config.flushInterval || 10000;

    options.split_keys = !!jut_config.split_keys;
    options.counter_rates = !!jut_config.counter_rates;

    jut_stats.lastFlush = Date.now() / 1000;
    jut_stats.lastException = Date.now() / 1000;

    http_opts = url.parse(receiver_url);
    http_opts.method = 'POST';
    http_opts.headers = {
        'Content-Type': 'application/json',
    };
    http_opts.agent = false;

    events.on('flush', flush_metrics);
    events.on('status', status);

    return true;
};
