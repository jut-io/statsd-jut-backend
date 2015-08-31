// this modules takes parsed metrics and sends them to the Jut
// receiver

var http = require('http');
var https = require('https');
var request_fn;
var url = require('url');
var logger;

var jut_stats;
var options = {
    debug: false,
};

var http_opts;

exports.init = function init(config, jut_stats_in, logger_in) {
    jut_stats = jut_stats_in;
    logger = logger_in;

    var jut_config = config.jut || {};
    options.debug = !!config.debug;

    var receiver_url = jut_config.url;

    if (! receiver_url) {
        throw new Error('jut.url must be specified');
    }

    http_opts = url.parse(receiver_url);
    http_opts.method = 'POST';
    http_opts.headers = {
        'Content-Type': 'application/json',
    };
    http_opts.agent = false;
    http_opts.rejectUnauthorized = true;

    if (config.jut.insecure_https) {
        http_opts.rejectUnauthorized = false;
    }

    if (http_opts.protocol === 'https:') {
        request_fn = https.request;
    }
    else if (http_opts.protocol === 'http:') {
        request_fn = http.request;
    }
    else {
        throw new Error('invalid protocol ' + http_opts.protocol);
    }
};

exports.send = function send(payload) {
    if (!(payload instanceof Array && payload.length > 0)) {
        return;
    }

    var post_body = JSON.stringify(payload);

    http_opts.headers['Content-Length'] = post_body.length;

    var req = request_fn(http_opts, function(res) {

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
};
