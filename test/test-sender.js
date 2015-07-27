var events;

exports.init = function init(config, jut_stats_in) {
    var jut_config = config.jut || {};
    events = jut_config.events;
};

exports.send = function send(payload) {
    // give the exact same data back to the unit test
    events.emit('test', payload);
};
