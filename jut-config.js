{
    backends: [
        'statsd-jut-backend'
    ],
    jut: {
        // URL of your Jut HTTP receiver (required):
        url: 'http://example.jut.io:9000/?source_type=metric',
        // set to true to split key-value pairs delimited by __:
        split_keys: false, // defaults to false
        // set to true to send a pre-calculated rate for each counter:
        counter_rates: false // defaults to false
        // add static tags to each point (optional):
        tags: {
            answer: 42,
            foo: 'bar'
        }
     }

 }
