'use strict';

// The Replay module holds global configution properties and methods.


const Catalog = require('./catalog');
const Chain = require('./chain');
const debug = require('./debug');

var _require = require('events');

const EventEmitter = _require.EventEmitter;

const logger = require('./logger');
const passThrough = require('./pass_through');
const recorder = require('./recorder');
const HTTP = require('http');
const HTTPS = require('https');
const DNS = require('dns');
const origHttpRequest = HTTP.request;
const origHttpGet = HTTP.get;
const origHttpsGet = HTTPS.get;
const originalLookup = DNS.lookup;

// Supported modes
const MODES = [
// Allow outbound HTTP requests, don't replay anything.  Use this to test your
// code against changes to 3rd party API.
'bloody',

// Allow outbound HTTP requests, replay captured responses.  This mode is
// particularly useful when new code makes new requests, but unstable yet and
// you don't want these requests saved.
'cheat',

// Allow outbound HTTP requests, capture responses for future replay.  This
// mode allows you to capture and record new requests, e.g. when adding tests
// or making code changes.
'record',

// Do not allow outbound HTTP requests, replay captured responses.  This is
// the default mode and the one most useful for running tests
'replay'];

// This is the standard mode for running tests
const DEFAULT_MODE = 'replay';

// Headers that are recorded/matched during replay.
const MATCH_HEADERS = [/^accept/, /^authorization/, /^body/, /^content-type/, /^host/, /^if-/, /^x-/];

// Instance properties:
//
// catalog   - The catalog is responsible for loading pre-recorded responses
//             into memory, from where they can be replayed, and storing captured responses.
//
// chain     - The proxy chain.  Essentially an array of handlers through which
//             each request goes, and concludes when the last handler returns a
//             response.
//
// headers   - Only these headers are matched when recording/replaying.  A list
//             of regular expressions.
//
// fixtures  - Main directory for replay fixtures.
//
// mode      - The mode we're running in, see MODES.
class Replay extends EventEmitter {

  constructor(mode) {
    if (!(MODES.indexOf(mode) > -1)) throw new Error(`Unsupported mode '${mode}', must be one of ${MODES.join(', ')}.`);

    super();
    this.mode = mode;
    this.chain = new Chain();

    // Localhost servers: pass request to localhost
    this._localhosts = new Set(['localhost', '127.0.0.1', '::1']);
    // Pass through requests to these servers
    this._passThrough = new Set();
    // Dropp connections to these servers
    this._dropped = new Set();

    this.catalog = new Catalog(this);
    this.headers = MATCH_HEADERS;

    // Automatically emit connection errors and such, also prevent process from crashing
    this.on('error', function (error) {
      debug(`Replay: ${error.message || error}`);
    });
  }

  // Addes a proxy to the beginning of the processing chain, so it executes ahead of any existing proxy.
  //
  // Example
  //     replay.use(replay.logger())
  use(proxy) {
    this.chain.prepend(proxy);
    return this;
  }

  // Pass through all requests to these hosts
  passThrough() {
    for (var _len = arguments.length, hosts = Array(_len), _key = 0; _key < _len; _key++) {
      hosts[_key] = arguments[_key];
    }

    this.reset.apply(this, hosts);
    for (let host of hosts) this._passThrough.add(host);
    return this;
  }

  // True to pass through requests to this host
  isPassThrough(host) {
    const domain = host.replace(/^[^.]+/, '*');
    return !!(this._passThrough.has(host) || this._passThrough.has(domain) || this._passThrough.has(`*.${host}`));
  }

  // Do not allow network access to these hosts (drop connection)
  drop() {
    for (var _len2 = arguments.length, hosts = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
      hosts[_key2] = arguments[_key2];
    }

    this.reset.apply(this, hosts);
    for (let host of hosts) this._dropped.add(host);
    return this;
  }

  // True if this host is on the dropped list
  isDropped(host) {
    const domain = host.replace(/^[^.]+/, '*');
    return !!(this._dropped.has(host) || this._dropped.has(domain) || this._dropped.has(`*.${host}`));
  }

  // Treats this host as localhost: requests are routed directly to 127.0.0.1, no
  // replay.  Useful when you want to send requests to the test server using its
  // production host name.
  localhost() {
    for (var _len3 = arguments.length, hosts = Array(_len3), _key3 = 0; _key3 < _len3; _key3++) {
      hosts[_key3] = arguments[_key3];
    }

    this.reset.apply(this, hosts);
    for (let host of hosts) this._localhosts.add(host);
    return this;
  }

  // True if this host should be treated as localhost.
  isLocalhost(host) {
    const domain = host.replace(/^[^.]+/, '*');
    return !!(this._localhosts.has(host) || this._localhosts.has(domain) || this._localhosts.has(`*.${host}`));
  }

  // Use this when you want to exclude host from dropped/pass-through/localhost
  reset() {
    for (var _len4 = arguments.length, hosts = Array(_len4), _key4 = 0; _key4 < _len4; _key4++) {
      hosts[_key4] = arguments[_key4];
    }

    for (let host of hosts) {
      this._localhosts.delete(host);
      this._passThrough.delete(host);
      this._dropped.delete(host);
    }
    return this;
  }

  restore() {
    HTTP.request = origHttpRequest;
    HTTP.get = origHttpGet;
    HTTPS.get = origHttpsGet;
    DNS.lookup = originalLookup;
  }

  get fixtures() {
    return this.catalog.getFixturesDir();
  }

  set fixtures(dir) {
    // Clears loaded fixtures, and updates to new dir
    this.catalog.setFixturesDir(dir);
  }

}

const replay = new Replay(process.env.REPLAY || DEFAULT_MODE);

function passWhenBloodyOrCheat(request) {
  return replay.isPassThrough(request.url.hostname) || replay.mode === 'cheat' && !replay.isDropped(request.url.hostname);
}

function passToLocalhost(request) {
  return replay.isLocalhost(request.url.hostname) || replay.mode === 'bloody';
}

// The default processing chain (from first to last):
// - Pass through requests to localhost
// - Log request to console is `debug` is true
// - Replay recorded responses
// - Pass through requests in bloody and cheat modes
replay.use(passThrough(passWhenBloodyOrCheat)).use(recorder(replay)).use(logger(replay)).use(passThrough(passToLocalhost));

module.exports = replay;

// These must come last since they need module.exports to exist
require('./patch_http_request');
require('./patch_dns_lookup');
//# sourceMappingURL=index.js.map