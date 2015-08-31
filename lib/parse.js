// This module parses the statsd metrics and builds data structures
// suitable for sending to Jut. It optionally supports arbitrary
// key-value pairs embedded in the metric name.

var RESERVED_TAGS = {
    time: true,
    value: true,
    source_type: true,
    metric_type: true,
    stat: true,
    name: true,
    interval: true,
};

exports.RESERVED_TAGS = RESERVED_TAGS;

function _parse_split(key) {
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

exports.build_metric = function build_metric(options, metric_type, name, timestamp, value, stat_type) {
    options = options || {};

    var metric;
    var o;

    // extract tags from metric name, if enabled
    if (options.split_keys) {
        o = _parse_split(name);
        metric = o.tags;
        metric.name = o.key;
    }
    else {
        metric = {
            name: name
        };
    }

    metric.metric_type = metric_type;

    _copy_tags(metric, options.extra_tags);

    metric.time = new Date(timestamp).toISOString();
    metric.value = value;
    metric.source_type = 'metric';

    if (stat_type) {
        metric.stat = stat_type;
    }

    return metric;
};
