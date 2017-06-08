/**
 *
 * @author     richen
 * @copyright  Copyright (c) 2017 - <richenlin(at)gmail.com>
 * @license    MIT
 * @version    17/6/6
 */
const lib = require('think_lib');

module.exports = class {
    constructor(options = {}) {
        options.memcache_timeout && (options.memcache_timeout = options.memcache_timeout * 1000);
        this.options = lib.extend({
            memcache_host: '127.0.0.1',
            memcache_port: 11211,
            memcache_poolsize: 10, //memcache pool size
            memcache_timeout: 10000, //try connection timeout
        }, options);
        this.handle = null;
        this.deferred = null;
    }

    connect() {
        if (this.handle) {
            return this.deferred.promise;
        }
        let deferred = lib.getDefer();
        let memcached = require('memcached');
        //[ '192.168.0.102:11211', '192.168.0.103:11211', '192.168.0.104:11211' ]
        let connection = new memcached([`${this.options.memcache_host}:${this.options.memcache_port}`], {
            poolSize: this.options.memcache_poolsize,
            retry: this.options.memcache_timeout,
            retries: 1
        });
        connection.on('issue', () => {
            this.close();
            deferred.reject('connection issue');
        });
        connection.on('failure', err => {
            this.close();
            deferred.reject(err);
        });

        this.handle = connection;
        if (this.deferred) {
            this.deferred.reject(new Error('connection closed'));
        }
        deferred.resolve();
        this.deferred = deferred;
        return this.deferred.promise;
    }

    close() {
        if (this.handle) {
            this.handle.end();
            this.handle = null;
        }
    }

    /**
     *
     * @param name
     * @param data
     * @returns {*}
     */
    async wrap(name, data) {
        let deferred = lib.getDefer();
        await this.connect().catch(e => deferred.reject(e));
        if (!lib.isArray(data)) {
            data = data === undefined ? [] : [data];
        }
        data.push((err, da) => {
            if (err) {
                deferred.reject(err);
            } else {
                deferred.resolve(da);
            }
        });
        if (this.handle) {
            this.handle[name].apply(this.handle, data);
        } else {
            deferred.reject('connection end');
        }
        return deferred.promise;
    }
};