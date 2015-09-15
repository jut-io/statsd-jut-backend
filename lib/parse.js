// This module parses the statsd metrics and builds data structures
// suitable for sending to Jut. It optionally supports arbitrary
// key-value pairs embedded in the metric name.

// tags that aren't allowed in static config
var RESERVED_TAGS = {
    time: true,
    value: true,
    source_type: true,
    metric_type: true,
    stat: true,
    name: true,
    interval: true,
};

// tags that aren't allowed with split_tags=true
var NO_OVERRIDE_TAGS = {
    time: true,
    value: true,
    interval: true,
    name: true,
};

exports.RESERVED_TAGS = RESERVED_TAGS;

function parse_split(key) {
    var parts = key.split('.');
    if (parts.length === 0) {
        return {key: key, tags: []};
    }

    var pre_keys = [];
    var tags = {};
    parts.forEach(function(p) {
        var tag = p.split('__');
        if (tag.length === 2 && tag[0] !== '' && !NO_OVERRIDE_TAGS[tag[0]]) {
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

exports.build_metric = function build_metric(options, metric_type, name, timestamp, value, stat_type) {
    options = options || {};

    var metric;
    var o;

    // extract tags from metric name, if enabled
    if (options.split_keys) {
        o = parse_split(name);
        metric = o.tags;
        metric.name = o.key;
    }
    else {
        metric = {
            name: name
        };
    }

    // allow overriding some params with tags
    if (typeof metric.metric_type === 'undefined') {
        metric.metric_type = metric_type;
    }
    if (typeof metric.source_type === 'undefined') {
        metric.source_type = 'metric';
    }
    if (stat_type && typeof metric.stat === 'undefined') {
        metric.stat = stat_type;
    }

    _copy_tags(metric, options.extra_tags);

    metric.time = new Date(timestamp).toISOString();
    metric.value = value;

    return metric;
};

exports.parse_split = parse_split;
