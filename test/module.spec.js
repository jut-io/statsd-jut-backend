/* global it, describe, console, after */

var http = require('http');
var _ = require('underscore');
var expect = require('chai').expect;
var EventEmitter = require('events').EventEmitter;
var mock_server_data = require('./mock-server-data');

var jut_statsd_backend = require('../lib/jut');

var fake_logger = {
    log: function() {
        console.log(arguments);
    }
};

var mock_receiver = {
    events: new EventEmitter(),
    current_test: '',
    port: null,
    srv: null,
    start: function(callback) {
        var self = this;

        var srv = http.createServer(function(req, res) {
            var expected_request = mock_server_data[self.current_test].request;
            var current_response = mock_server_data[self.current_test].response;
            var req_body = '';
            req.on('data', function(chunk) {
                req_body += chunk;
            });

            req.on('end', function() {
                try {
                    expect(req.method).to.equal('POST');
                    expect(req.url).to.equal('/');

                    var json_body = JSON.parse(req_body);

                    // both check that the time is ISO-8601 and
                    // rewrite as ms-since-epoch so the deep compare
                    // below succeeds
                    json_body.forEach(function(item) {
                        var d = new Date(item.time);
                        expect(item.time).to.be.a('string');
                        expect(item.time).to.equal(d.toISOString());
                        item.time = d.getTime();
                    });

                    expect(json_body).to.deep.equal(expected_request.body);

                    res.writeHead(current_response.status, {'Content-Type': 'application/json'});

                    if (typeof current_response.body !== 'string') {
                        res.end(JSON.stringify(current_response.body, null, 2));
                    }
                    else {
                        res.end(current_response.body);
                    }
                } catch(err) {
                    res.end();
                    return self.events.emit('done', err);
                }
                self.events.emit('done');
            });

        });

        srv.listen(0, function() {
            self.port = srv.address().port;
            callback();
        });

        this.srv = srv;
    },

    stop: function(callback) {
        this.srv.close(callback);
    }
};

describe('jut statsd backend basic init tests', function() {

    it('can initialize the module successfully', function() {
        var retval = jut_statsd_backend.init(
            Date.now() / 1000,
            {
                jut: {
                    url: 'http://example.com'
                },
            },
            new EventEmitter(),
            fake_logger
        );

        expect(retval).to.be.true;
    });

    it('fails if receiver url is omitted', function(done) {
        try {
            jut_statsd_backend.init(
                Date.now(),
                {
                },
                new EventEmitter(),
                fake_logger
            );
        } catch(e) {
            return done();
        }

        throw new Error('init() should have failed');
    });

    it('fails if a reserved tag is used', function(done) {
        try {
            jut_statsd_backend.init(
                Date.now(),
                {
                    jut: {
                        url: 'http://example.com',
                        tags: {
                            time: 42
                        }
                    }
                },
                new EventEmitter(),
                fake_logger
            );
        } catch(e) {
            return done();
        }

        throw new Error('init() should have failed');
    });

});

describe('jut statsd backend custom sender test', function() {
    var events;

    it('initializes the module with a custom sender', function() {
        events = new EventEmitter();

        var retval = jut_statsd_backend.init(
            Date.now() / 1000,
            {
                jut: {
                    sender_module: __dirname + '/test-sender',
                    events: events,
                },
                debug: true,
                flushInterval: 10000,
            },
            events,
            fake_logger
        );

        expect(retval).to.be.true;
    });

    it('calls the test sender correctly', function(done) {
        events.on('test', function(payload) {
            // quick and dirty test, stricter tests later on
            expect(payload).to.have.length(mock_server_data.basic_counter.request.body.length);
            expect(_.omit(payload[0], 'time')).to.deep.equal(_.omit(mock_server_data.basic_counter.request.body[0], 'time'));
            done();
        });

        events.emit(
            'flush',
            mock_server_data.basic_counter.input.timestamp,
            mock_server_data.basic_counter.input.metrics
        );
    });
});

describe('jut statsd backend mock receiver tests', function() {
    this.timeout(30000);

    var receiver_url;
    var events;

    function emit_event(test_name) {
        // send defaults so we don't have to set unnecessary stuff
        _.defaults(mock_server_data[test_name].input.metrics, {
            counters: {},
            gauges: {},
            timers: {},
            sets: {},
            counter_rates: {},
            timer_data: {},
            statsd_metrics: {},
            pctThreshold: {}
        });
        events.emit(
            'flush',
            mock_server_data[test_name].input.timestamp,
            mock_server_data[test_name].input.metrics
        );
    }

    it('starts the mock receiver', function(done) {
        mock_receiver.start(function() {
            receiver_url = 'http://localhost:' + mock_receiver.port;

            done();
        });
    });

    it('initializes the backend with default settings', function() {
        events = new EventEmitter();

        var retval = jut_statsd_backend.init(
            Date.now() / 1000,
            {
                jut: {
                    url: receiver_url,
                },
                debug: true,
                flushInterval: 10000,
            },
            events,
            fake_logger
        );

        expect(retval).to.be.true;
    });

    it('imports a counter with no rate', function(done) {
        mock_receiver.current_test = 'basic_counter';
        emit_event('basic_counter');

        mock_receiver.events.once('done', done);
    });

    it('imports a gauge', function(done) {
        mock_receiver.current_test = 'basic_gauge';
        emit_event('basic_gauge');

        mock_receiver.events.once('done', done);
    });

    it('imports timer data', function(done) {
        mock_receiver.current_test = 'timer_with_stats';
        emit_event('timer_with_stats');

        mock_receiver.events.once('done', done);
    });

    it('does not split keys by default', function(done) {
        mock_receiver.current_test = 'key_split_disabled';
        emit_event('key_split_disabled');

        mock_receiver.events.once('done', done);
    });

    it('initializes the backend module with key splitting, counter rates, and extra tags', function() {
        events = new EventEmitter();

        var retval = jut_statsd_backend.init(
            Date.now() / 1000,
            {
                jut: {
                    url: receiver_url,
                    split_keys: true,
                    counter_rates: true,
                    tags: {
                        cats: 'cute',
                        lives: 9
                    }
                },
                debug: true,
                flushInterval: 10000,
            },
            events,
            fake_logger
        );

        expect(retval).to.be.true;
    });

    it('imports a counter with a rate', function(done) {
        mock_receiver.current_test = 'counter_with_rate';
        emit_event('counter_with_rate');

        mock_receiver.events.once('done', done);
    });

    it('tries out some tags', function(done) {
        mock_receiver.current_test = 'metric_with_tags';
        emit_event('metric_with_tags');

        mock_receiver.events.once('done', done);
    });

    it('is able to override some internal tags', function(done) {
        mock_receiver.current_test = 'override_internal_tags';
        emit_event('override_internal_tags');

        mock_receiver.events.once('done', done);
    });

    it('initializes the backend module with invalid extra tags', function() {
        events = new EventEmitter();

        try {
            jut_statsd_backend.init(
                Date.now() / 1000,
                {
                    jut: {
                        url: receiver_url,
                        split_keys: true,
                        counter_rates: true,
                        tags: {
                            time: 1234,
                            value: 5678
                        }
                    },
                    debug: true,
                    flushInterval: 10000,
                },
                events,
                fake_logger
            );
        } catch(e) {
            return;
        }

        throw new Error('this test should fail');
    });

    it('checks some stats', function(done) {
        var seen_flush = false;
        var seen_exception = false;

        function check_stats(key, value) {
            if (key === 'lastFlush') {
                seen_flush = true;
                expect(value * 1000).to.be.at.most(Date.now());
            }
            else if (key === 'lastException') {
                seen_exception = true;
                expect(value * 1000).to.be.at.most(Date.now());
            }

            if (seen_flush && seen_exception) {
                done();
            }
        }

        jut_statsd_backend.status(function(a, backend, key, value) {
            check_stats(key, value);
        });
    });

    after(function(done) {
        mock_receiver.stop(done);
    });
});
