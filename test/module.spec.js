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
                expect(req.method).to.equal('POST');
                expect(req.url).to.equal('/');

                var json_body = JSON.parse(req_body);
                expect(json_body).to.deep.equal(expected_request.body);

                res.writeHead(current_response.status, {'Content-Type': 'application/json'});

                if (typeof current_response.body !== 'string') {
                    res.end(JSON.stringify(current_response.body, null, 2));
                }
                else {
                    res.end(current_response.body);
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
            expect(payload).to.deep.equal(mock_server_data.basic_counter.request.body);
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

    it('initializes the backend module with key splitting and counter rates', function() {
        events = new EventEmitter();

        var retval = jut_statsd_backend.init(
            Date.now() / 1000,
            {
                jut: {
                    url: receiver_url,
                    split_keys: true,
                    counter_rates: true
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


    after(function(done) {
        mock_receiver.stop(done);
    });
});
