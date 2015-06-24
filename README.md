# statsd-jut-backend [![Build Status: Linux](https://travis-ci.org/jut-io/statsd-jut-backend.png?branch=master)](https://travis-ci.org/jut-io/statsd-jut-backend)

`statsd-jut-backend` is a backend module for
[StatsD](https://github.com/etsy/statsd) that allows users to write
StatsD metrics directly into a [Jut](http://jut.io) HTTP receiver.

Installing
----------

Change to the StatsD root directory and execute the following:

    npm install statsd-jut-backend

This should install the Jut backend module in the correct
location. Alternatively, `lib/jut.js` can be copied into the StatsD
`backend` directory.

Configuring
-----------

First enable the Jut backend in StatsD `config.js`:

    backends: ['./backends/graphite', 'statsd-jut-backend']

Then create a new config section for the Jut backend:

    jut: {
        url: 'http://example.jut.io:9000/?source_type=metric'
    }

Of course, use your own receiver URL from the Jut setup app.

Please see [`jut-config.js`](./jut-config.js) for more detailed
information on configuring the backend.

Tagging
-------

Each point is automatically given a number of tags before it is sent
to the Jut receiver:

    {
      "metric_type": "<counter|gauge|timer>",
      "name": "<name of metric"",
      "time": <epoch time in ms>,
      "value": <raw value>,
      "source_type": "metric",
      "stat": "<sum|avg|upper|etc..(mainly for timer)>",
      "interval": <statsd flush interval in ms>
    }

In addition, arbitrary tags can be added to every point by setting
`jut.tags`. This can be useful for identifying which part of the
infrastructure the data originates from.

Key-Value Parsing
-----------------

The Jut backend optionally supports tagging metrics based upon
key-value pairs that are embedded in the name of a metric. To enable,
first set `jut.split_keys` to `true` in `config.js`.

Now a tag can be created by separating the key from the value with
`__`. This is easier indicated with an example:

    pizza.topping__pepperoni.diameter_inches__18

This will send a metric to the Jut system with the name `pizza`,
tagged with `topping=pepperoni` and `diameter_inches=18`. This is in
addition to any standard tags that are applied to every point. Note
that some tags are reserved for internal use (please see
`RESERVED_TAGS` in `lib/jut.js`).

Testing
-------

    npm install
    grunt test

TODO
----

- Implement sets and some more obscure StatsD metric types
