module.exports = {
    basic_counter: {
        input: {
            timestamp: 123,
            metrics: {
                counters: {
                    foo: 42
                },
                counter_rates: {
                    foo: 4.2
                }
            }
        },
        request: {
            body: [
                {
                    "metric_type": "counter",
                    "name": "foo",
                    "time": 123000,
                    "value": 42,
                    "source_type": "metric",
                    "stat": "sum",
                    "interval": 10000
                }
            ],
        },
        response: {
            status: 200,
            body: 'OK',
        }
    },
    counter_with_rate: {
        input: {
            timestamp: 123,
            metrics: {
                counters: {
                    foo: 42
                },
                counter_rates: {
                    foo: 4.2
                }
            }
        },
        request: {
            body: [
                {
                    "metric_type": "counter",
                    "name": "foo",
                    "time": 123000,
                    "value": 42,
                    "source_type": "metric",
                    "stat": "sum",
                    "interval": 10000
                },
                {
                    "metric_type": "counter",
                    "name": "foo",
                    "time": 123000,
                    "value": 4.2,
                    "source_type": "metric",
                    "stat": "rate",
                    "interval": 10000
                }
            ],
        },
        response: {
            status: 200,
            body: 'OK',
        }
    },
    basic_gauge: {
        input: {
            timestamp: 456,
            metrics: {
                gauges: {
                    bar: 42
                }
            }
        },
        request: {
            body: [
                {
                    "metric_type": "gauge",
                    "name": "bar",
                    "time": 456000,
                    "value": 42,
                    "source_type": "metric",
                    "interval": 10000
                }
            ],
        },
        response: {
            status: 200,
            body: 'OK',
        }
    },
    timer_with_stats: {
        input: {
            timestamp: 789,
            metrics: {
                timer_data: {
                    baz: {
                        min: 2.4,
                        max: 5.8,
                        coolest: 3.2
                    }
                }
            }
        },
        request: {
            body: [
                {
                    "metric_type": "timer",
                    "name": "baz",
                    "time": 789000,
                    "value": 2.4,
                    "source_type": "metric",
                    "stat": "min",
                    "interval": 10000
                },
                {
                    "metric_type": "timer",
                    "name": "baz",
                    "time": 789000,
                    "value": 5.8,
                    "source_type": "metric",
                    "stat": "max",
                    "interval": 10000
                },
                {
                    "metric_type": "timer",
                    "name": "baz",
                    "time": 789000,
                    "value": 3.2,
                    "source_type": "metric",
                    "stat": "coolest",
                    "interval": 10000
                }
            ],
        },
        response: {
            status: 200,
            body: 'OK',
        }
    },
    metric_with_tags: {
        input: {
            timestamp: 987,
            metrics: {
                gauges: {
                    'food.weight__9.pet_name__fluffy.species__cat.crepuscular__1.time__123': 4,
                    'food.weight__30.pet_name__babou.species__ocelot.crepuscular__1': 27,
                    'food.weight__20.pet_name__duchess.species__dog': 17,
                }
            }
        },
        request: {
            body: [
                {
                    "metric_type": "gauge",
                    "name": "food.time__123", // time is an invalid tag name
                    "pet_name": "fluffy",
                    "weight": "9",
                    "species": "cat",
                    "crepuscular": "1",
                    "time": 987000,
                    "value": 4,
                    "source_type": "metric",
                    "interval": 10000
                },
                {
                    "metric_type": "gauge",
                    "pet_name": "babou",
                    "name": "food",
                    "weight": "30",
                    "species": "ocelot",
                    "crepuscular": "1",
                    "time": 987000,
                    "value": 27,
                    "source_type": "metric",
                    "interval": 10000
                },
                {
                    "metric_type": "gauge",
                    "pet_name": "duchess",
                    "name": "food",
                    "weight": "20",
                    "species": "dog",
                    "time": 987000,
                    "value": 17,
                    "source_type": "metric",
                    "interval": 10000
                }
            ],
        },
        response: {
            status: 200,
            body: 'OK',
        }
    },
    key_split_disabled: {
        input: {
            timestamp: 987,
            metrics: {
                gauges: {
                    'food.weight__9.pet_name__fluffy.species__cat.crepuscular__1.time__123': 4,
                }
            }
        },
        request: {
            body: [
                {
                    "metric_type": "gauge",
                    "name": "food.weight__9.pet_name__fluffy.species__cat.crepuscular__1.time__123",
                    "time": 987000,
                    "value": 4,
                    "source_type": "metric",
                    "interval": 10000
                },
            ],
        },
        response: {
            status: 200,
            body: 'OK',
        }
    },

};
