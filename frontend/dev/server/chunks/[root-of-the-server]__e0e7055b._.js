module.exports = [
"[project]/node_modules/delayed-stream/lib/delayed_stream.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {

var Stream = __turbopack_context__.r("[externals]/stream [external] (stream, cjs)").Stream;
var util = __turbopack_context__.r("[externals]/util [external] (util, cjs)");
module.exports = DelayedStream;
function DelayedStream() {
    this.source = null;
    this.dataSize = 0;
    this.maxDataSize = 1024 * 1024;
    this.pauseStream = true;
    this._maxDataSizeExceeded = false;
    this._released = false;
    this._bufferedEvents = [];
}
util.inherits(DelayedStream, Stream);
DelayedStream.create = function(source, options) {
    var delayedStream = new this();
    options = options || {};
    for(var option in options){
        delayedStream[option] = options[option];
    }
    delayedStream.source = source;
    var realEmit = source.emit;
    source.emit = function() {
        delayedStream._handleEmit(arguments);
        return realEmit.apply(source, arguments);
    };
    source.on('error', function() {});
    if (delayedStream.pauseStream) {
        source.pause();
    }
    return delayedStream;
};
Object.defineProperty(DelayedStream.prototype, 'readable', {
    configurable: true,
    enumerable: true,
    get: function() {
        return this.source.readable;
    }
});
DelayedStream.prototype.setEncoding = function() {
    return this.source.setEncoding.apply(this.source, arguments);
};
DelayedStream.prototype.resume = function() {
    if (!this._released) {
        this.release();
    }
    this.source.resume();
};
DelayedStream.prototype.pause = function() {
    this.source.pause();
};
DelayedStream.prototype.release = function() {
    this._released = true;
    this._bufferedEvents.forEach((function(args) {
        this.emit.apply(this, args);
    }).bind(this));
    this._bufferedEvents = [];
};
DelayedStream.prototype.pipe = function() {
    var r = Stream.prototype.pipe.apply(this, arguments);
    this.resume();
    return r;
};
DelayedStream.prototype._handleEmit = function(args) {
    if (this._released) {
        this.emit.apply(this, args);
        return;
    }
    if (args[0] === 'data') {
        this.dataSize += args[1].length;
        this._checkIfMaxDataSizeExceeded();
    }
    this._bufferedEvents.push(args);
};
DelayedStream.prototype._checkIfMaxDataSizeExceeded = function() {
    if (this._maxDataSizeExceeded) {
        return;
    }
    if (this.dataSize <= this.maxDataSize) {
        return;
    }
    this._maxDataSizeExceeded = true;
    var message = 'DelayedStream#maxDataSize of ' + this.maxDataSize + ' bytes exceeded.';
    this.emit('error', new Error(message));
};
}),
"[project]/node_modules/combined-stream/lib/combined_stream.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {

var util = __turbopack_context__.r("[externals]/util [external] (util, cjs)");
var Stream = __turbopack_context__.r("[externals]/stream [external] (stream, cjs)").Stream;
var DelayedStream = __turbopack_context__.r("[project]/node_modules/delayed-stream/lib/delayed_stream.js [app-route] (ecmascript)");
module.exports = CombinedStream;
function CombinedStream() {
    this.writable = false;
    this.readable = true;
    this.dataSize = 0;
    this.maxDataSize = 2 * 1024 * 1024;
    this.pauseStreams = true;
    this._released = false;
    this._streams = [];
    this._currentStream = null;
    this._insideLoop = false;
    this._pendingNext = false;
}
util.inherits(CombinedStream, Stream);
CombinedStream.create = function(options) {
    var combinedStream = new this();
    options = options || {};
    for(var option in options){
        combinedStream[option] = options[option];
    }
    return combinedStream;
};
CombinedStream.isStreamLike = function(stream) {
    return typeof stream !== 'function' && typeof stream !== 'string' && typeof stream !== 'boolean' && typeof stream !== 'number' && !Buffer.isBuffer(stream);
};
CombinedStream.prototype.append = function(stream) {
    var isStreamLike = CombinedStream.isStreamLike(stream);
    if (isStreamLike) {
        if (!(stream instanceof DelayedStream)) {
            var newStream = DelayedStream.create(stream, {
                maxDataSize: Infinity,
                pauseStream: this.pauseStreams
            });
            stream.on('data', this._checkDataSize.bind(this));
            stream = newStream;
        }
        this._handleErrors(stream);
        if (this.pauseStreams) {
            stream.pause();
        }
    }
    this._streams.push(stream);
    return this;
};
CombinedStream.prototype.pipe = function(dest, options) {
    Stream.prototype.pipe.call(this, dest, options);
    this.resume();
    return dest;
};
CombinedStream.prototype._getNext = function() {
    this._currentStream = null;
    if (this._insideLoop) {
        this._pendingNext = true;
        return; // defer call
    }
    this._insideLoop = true;
    try {
        do {
            this._pendingNext = false;
            this._realGetNext();
        }while (this._pendingNext)
    } finally{
        this._insideLoop = false;
    }
};
CombinedStream.prototype._realGetNext = function() {
    var stream = this._streams.shift();
    if (typeof stream == 'undefined') {
        this.end();
        return;
    }
    if (typeof stream !== 'function') {
        this._pipeNext(stream);
        return;
    }
    var getStream = stream;
    getStream((function(stream) {
        var isStreamLike = CombinedStream.isStreamLike(stream);
        if (isStreamLike) {
            stream.on('data', this._checkDataSize.bind(this));
            this._handleErrors(stream);
        }
        this._pipeNext(stream);
    }).bind(this));
};
CombinedStream.prototype._pipeNext = function(stream) {
    this._currentStream = stream;
    var isStreamLike = CombinedStream.isStreamLike(stream);
    if (isStreamLike) {
        stream.on('end', this._getNext.bind(this));
        stream.pipe(this, {
            end: false
        });
        return;
    }
    var value = stream;
    this.write(value);
    this._getNext();
};
CombinedStream.prototype._handleErrors = function(stream) {
    var self = this;
    stream.on('error', function(err) {
        self._emitError(err);
    });
};
CombinedStream.prototype.write = function(data) {
    this.emit('data', data);
};
CombinedStream.prototype.pause = function() {
    if (!this.pauseStreams) {
        return;
    }
    if (this.pauseStreams && this._currentStream && typeof this._currentStream.pause == 'function') this._currentStream.pause();
    this.emit('pause');
};
CombinedStream.prototype.resume = function() {
    if (!this._released) {
        this._released = true;
        this.writable = true;
        this._getNext();
    }
    if (this.pauseStreams && this._currentStream && typeof this._currentStream.resume == 'function') this._currentStream.resume();
    this.emit('resume');
};
CombinedStream.prototype.end = function() {
    this._reset();
    this.emit('end');
};
CombinedStream.prototype.destroy = function() {
    this._reset();
    this.emit('close');
};
CombinedStream.prototype._reset = function() {
    this.writable = false;
    this._streams = [];
    this._currentStream = null;
};
CombinedStream.prototype._checkDataSize = function() {
    this._updateDataSize();
    if (this.dataSize <= this.maxDataSize) {
        return;
    }
    var message = 'DelayedStream#maxDataSize of ' + this.maxDataSize + ' bytes exceeded.';
    this._emitError(new Error(message));
};
CombinedStream.prototype._updateDataSize = function() {
    this.dataSize = 0;
    var self = this;
    this._streams.forEach(function(stream) {
        if (!stream.dataSize) {
            return;
        }
        self.dataSize += stream.dataSize;
    });
    if (this._currentStream && this._currentStream.dataSize) {
        this.dataSize += this._currentStream.dataSize;
    }
};
CombinedStream.prototype._emitError = function(err) {
    this._reset();
    this.emit('error', err);
};
}),
"[project]/node_modules/mime-types/index.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

/*!
 * mime-types
 * Copyright(c) 2014 Jonathan Ong
 * Copyright(c) 2015 Douglas Christopher Wilson
 * MIT Licensed
 */ /**
 * Module dependencies.
 * @private
 */ var db = __turbopack_context__.r("[project]/node_modules/mime-db/index.js [app-route] (ecmascript)");
var extname = __turbopack_context__.r("[externals]/path [external] (path, cjs)").extname;
/**
 * Module variables.
 * @private
 */ var EXTRACT_TYPE_REGEXP = /^\s*([^;\s]*)(?:;|\s|$)/;
var TEXT_TYPE_REGEXP = /^text\//i;
/**
 * Module exports.
 * @public
 */ exports.charset = charset;
exports.charsets = {
    lookup: charset
};
exports.contentType = contentType;
exports.extension = extension;
exports.extensions = Object.create(null);
exports.lookup = lookup;
exports.types = Object.create(null);
// Populate the extensions/types maps
populateMaps(exports.extensions, exports.types);
/**
 * Get the default charset for a MIME type.
 *
 * @param {string} type
 * @return {boolean|string}
 */ function charset(type) {
    if (!type || typeof type !== 'string') {
        return false;
    }
    // TODO: use media-typer
    var match = EXTRACT_TYPE_REGEXP.exec(type);
    var mime = match && db[match[1].toLowerCase()];
    if (mime && mime.charset) {
        return mime.charset;
    }
    // default text/* to utf-8
    if (match && TEXT_TYPE_REGEXP.test(match[1])) {
        return 'UTF-8';
    }
    return false;
}
/**
 * Create a full Content-Type header given a MIME type or extension.
 *
 * @param {string} str
 * @return {boolean|string}
 */ function contentType(str) {
    // TODO: should this even be in this module?
    if (!str || typeof str !== 'string') {
        return false;
    }
    var mime = str.indexOf('/') === -1 ? exports.lookup(str) : str;
    if (!mime) {
        return false;
    }
    // TODO: use content-type or other module
    if (mime.indexOf('charset') === -1) {
        var charset = exports.charset(mime);
        if (charset) mime += '; charset=' + charset.toLowerCase();
    }
    return mime;
}
/**
 * Get the default extension for a MIME type.
 *
 * @param {string} type
 * @return {boolean|string}
 */ function extension(type) {
    if (!type || typeof type !== 'string') {
        return false;
    }
    // TODO: use media-typer
    var match = EXTRACT_TYPE_REGEXP.exec(type);
    // get extensions
    var exts = match && exports.extensions[match[1].toLowerCase()];
    if (!exts || !exts.length) {
        return false;
    }
    return exts[0];
}
/**
 * Lookup the MIME type for a file path/extension.
 *
 * @param {string} path
 * @return {boolean|string}
 */ function lookup(path) {
    if (!path || typeof path !== 'string') {
        return false;
    }
    // get the extension ("ext" or ".ext" or full path)
    var extension = extname('x.' + path).toLowerCase().substr(1);
    if (!extension) {
        return false;
    }
    return exports.types[extension] || false;
}
/**
 * Populate the extensions and types maps.
 * @private
 */ function populateMaps(extensions, types) {
    // source preference (least -> most)
    var preference = [
        'nginx',
        'apache',
        undefined,
        'iana'
    ];
    Object.keys(db).forEach(function forEachMimeType(type) {
        var mime = db[type];
        var exts = mime.extensions;
        if (!exts || !exts.length) {
            return;
        }
        // mime -> extensions
        extensions[type] = exts;
        // extension -> mime
        for(var i = 0; i < exts.length; i++){
            var extension = exts[i];
            if (types[extension]) {
                var from = preference.indexOf(db[types[extension]].source);
                var to = preference.indexOf(mime.source);
                if (types[extension] !== 'application/octet-stream' && (from > to || from === to && types[extension].substr(0, 12) === 'application/')) {
                    continue;
                }
            }
            // set the extension -> mime
            types[extension] = type;
        }
    });
}
}),
"[project]/node_modules/asynckit/lib/defer.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {

module.exports = defer;
/**
 * Runs provided function on next iteration of the event loop
 *
 * @param {function} fn - function to run
 */ function defer(fn) {
    var nextTick = typeof setImmediate == 'function' ? setImmediate : typeof process == 'object' && typeof process.nextTick == 'function' ? process.nextTick : null;
    if (nextTick) {
        nextTick(fn);
    } else {
        setTimeout(fn, 0);
    }
}
}),
"[project]/node_modules/asynckit/lib/async.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {

var defer = __turbopack_context__.r("[project]/node_modules/asynckit/lib/defer.js [app-route] (ecmascript)");
// API
module.exports = async;
/**
 * Runs provided callback asynchronously
 * even if callback itself is not
 *
 * @param   {function} callback - callback to invoke
 * @returns {function} - augmented callback
 */ function async(callback) {
    var isAsync = false;
    // check if async happened
    defer(function() {
        isAsync = true;
    });
    return function async_callback(err, result) {
        if (isAsync) {
            callback(err, result);
        } else {
            defer(function nextTick_callback() {
                callback(err, result);
            });
        }
    };
}
}),
"[project]/node_modules/asynckit/lib/abort.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {

// API
module.exports = abort;
/**
 * Aborts leftover active jobs
 *
 * @param {object} state - current state object
 */ function abort(state) {
    Object.keys(state.jobs).forEach(clean.bind(state));
    // reset leftover jobs
    state.jobs = {};
}
/**
 * Cleans up leftover job by invoking abort function for the provided job id
 *
 * @this  state
 * @param {string|number} key - job id to abort
 */ function clean(key) {
    if (typeof this.jobs[key] == 'function') {
        this.jobs[key]();
    }
}
}),
"[project]/node_modules/asynckit/lib/iterate.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {

var async = __turbopack_context__.r("[project]/node_modules/asynckit/lib/async.js [app-route] (ecmascript)"), abort = __turbopack_context__.r("[project]/node_modules/asynckit/lib/abort.js [app-route] (ecmascript)");
// API
module.exports = iterate;
/**
 * Iterates over each job object
 *
 * @param {array|object} list - array or object (named list) to iterate over
 * @param {function} iterator - iterator to run
 * @param {object} state - current job status
 * @param {function} callback - invoked when all elements processed
 */ function iterate(list, iterator, state, callback) {
    // store current index
    var key = state['keyedList'] ? state['keyedList'][state.index] : state.index;
    state.jobs[key] = runJob(iterator, key, list[key], function(error, output) {
        // don't repeat yourself
        // skip secondary callbacks
        if (!(key in state.jobs)) {
            return;
        }
        // clean up jobs
        delete state.jobs[key];
        if (error) {
            // don't process rest of the results
            // stop still active jobs
            // and reset the list
            abort(state);
        } else {
            state.results[key] = output;
        }
        // return salvaged results
        callback(error, state.results);
    });
}
/**
 * Runs iterator over provided job element
 *
 * @param   {function} iterator - iterator to invoke
 * @param   {string|number} key - key/index of the element in the list of jobs
 * @param   {mixed} item - job description
 * @param   {function} callback - invoked after iterator is done with the job
 * @returns {function|mixed} - job abort function or something else
 */ function runJob(iterator, key, item, callback) {
    var aborter;
    // allow shortcut if iterator expects only two arguments
    if (iterator.length == 2) {
        aborter = iterator(item, async(callback));
    } else {
        aborter = iterator(item, key, async(callback));
    }
    return aborter;
}
}),
"[project]/node_modules/asynckit/lib/state.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {

// API
module.exports = state;
/**
 * Creates initial state object
 * for iteration over list
 *
 * @param   {array|object} list - list to iterate over
 * @param   {function|null} sortMethod - function to use for keys sort,
 *                                     or `null` to keep them as is
 * @returns {object} - initial state object
 */ function state(list, sortMethod) {
    var isNamedList = !Array.isArray(list), initState = {
        index: 0,
        keyedList: isNamedList || sortMethod ? Object.keys(list) : null,
        jobs: {},
        results: isNamedList ? {} : [],
        size: isNamedList ? Object.keys(list).length : list.length
    };
    if (sortMethod) {
        // sort array keys based on it's values
        // sort object's keys just on own merit
        initState.keyedList.sort(isNamedList ? sortMethod : function(a, b) {
            return sortMethod(list[a], list[b]);
        });
    }
    return initState;
}
}),
"[project]/node_modules/asynckit/lib/terminator.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {

var abort = __turbopack_context__.r("[project]/node_modules/asynckit/lib/abort.js [app-route] (ecmascript)"), async = __turbopack_context__.r("[project]/node_modules/asynckit/lib/async.js [app-route] (ecmascript)");
// API
module.exports = terminator;
/**
 * Terminates jobs in the attached state context
 *
 * @this  AsyncKitState#
 * @param {function} callback - final callback to invoke after termination
 */ function terminator(callback) {
    if (!Object.keys(this.jobs).length) {
        return;
    }
    // fast forward iteration index
    this.index = this.size;
    // abort jobs
    abort(this);
    // send back results we have so far
    async(callback)(null, this.results);
}
}),
"[project]/node_modules/asynckit/parallel.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {

var iterate = __turbopack_context__.r("[project]/node_modules/asynckit/lib/iterate.js [app-route] (ecmascript)"), initState = __turbopack_context__.r("[project]/node_modules/asynckit/lib/state.js [app-route] (ecmascript)"), terminator = __turbopack_context__.r("[project]/node_modules/asynckit/lib/terminator.js [app-route] (ecmascript)");
// Public API
module.exports = parallel;
/**
 * Runs iterator over provided array elements in parallel
 *
 * @param   {array|object} list - array or object (named list) to iterate over
 * @param   {function} iterator - iterator to run
 * @param   {function} callback - invoked when all elements processed
 * @returns {function} - jobs terminator
 */ function parallel(list, iterator, callback) {
    var state = initState(list);
    while(state.index < (state['keyedList'] || list).length){
        iterate(list, iterator, state, function(error, result) {
            if (error) {
                callback(error, result);
                return;
            }
            // looks like it's the last one
            if (Object.keys(state.jobs).length === 0) {
                callback(null, state.results);
                return;
            }
        });
        state.index++;
    }
    return terminator.bind(state, callback);
}
}),
"[project]/node_modules/asynckit/serialOrdered.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {

var iterate = __turbopack_context__.r("[project]/node_modules/asynckit/lib/iterate.js [app-route] (ecmascript)"), initState = __turbopack_context__.r("[project]/node_modules/asynckit/lib/state.js [app-route] (ecmascript)"), terminator = __turbopack_context__.r("[project]/node_modules/asynckit/lib/terminator.js [app-route] (ecmascript)");
// Public API
module.exports = serialOrdered;
// sorting helpers
module.exports.ascending = ascending;
module.exports.descending = descending;
/**
 * Runs iterator over provided sorted array elements in series
 *
 * @param   {array|object} list - array or object (named list) to iterate over
 * @param   {function} iterator - iterator to run
 * @param   {function} sortMethod - custom sort function
 * @param   {function} callback - invoked when all elements processed
 * @returns {function} - jobs terminator
 */ function serialOrdered(list, iterator, sortMethod, callback) {
    var state = initState(list, sortMethod);
    iterate(list, iterator, state, function iteratorHandler(error, result) {
        if (error) {
            callback(error, result);
            return;
        }
        state.index++;
        // are we there yet?
        if (state.index < (state['keyedList'] || list).length) {
            iterate(list, iterator, state, iteratorHandler);
            return;
        }
        // done here
        callback(null, state.results);
    });
    return terminator.bind(state, callback);
}
/*
 * -- Sort methods
 */ /**
 * sort helper to sort array elements in ascending order
 *
 * @param   {mixed} a - an item to compare
 * @param   {mixed} b - an item to compare
 * @returns {number} - comparison result
 */ function ascending(a, b) {
    return a < b ? -1 : a > b ? 1 : 0;
}
/**
 * sort helper to sort array elements in descending order
 *
 * @param   {mixed} a - an item to compare
 * @param   {mixed} b - an item to compare
 * @returns {number} - comparison result
 */ function descending(a, b) {
    return -1 * ascending(a, b);
}
}),
"[project]/node_modules/asynckit/serial.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {

var serialOrdered = __turbopack_context__.r("[project]/node_modules/asynckit/serialOrdered.js [app-route] (ecmascript)");
// Public API
module.exports = serial;
/**
 * Runs iterator over provided array elements in series
 *
 * @param   {array|object} list - array or object (named list) to iterate over
 * @param   {function} iterator - iterator to run
 * @param   {function} callback - invoked when all elements processed
 * @returns {function} - jobs terminator
 */ function serial(list, iterator, callback) {
    return serialOrdered(list, iterator, null, callback);
}
}),
"[project]/node_modules/asynckit/index.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {

module.exports = {
    parallel: __turbopack_context__.r("[project]/node_modules/asynckit/parallel.js [app-route] (ecmascript)"),
    serial: __turbopack_context__.r("[project]/node_modules/asynckit/serial.js [app-route] (ecmascript)"),
    serialOrdered: __turbopack_context__.r("[project]/node_modules/asynckit/serialOrdered.js [app-route] (ecmascript)")
};
}),
"[project]/node_modules/es-object-atoms/index.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

/** @type {import('.')} */ module.exports = Object;
}),
"[project]/node_modules/es-errors/index.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

/** @type {import('.')} */ module.exports = Error;
}),
"[project]/node_modules/es-errors/eval.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

/** @type {import('./eval')} */ module.exports = EvalError;
}),
"[project]/node_modules/es-errors/range.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

/** @type {import('./range')} */ module.exports = RangeError;
}),
"[project]/node_modules/es-errors/ref.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

/** @type {import('./ref')} */ module.exports = ReferenceError;
}),
"[project]/node_modules/es-errors/syntax.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

/** @type {import('./syntax')} */ module.exports = SyntaxError;
}),
"[project]/node_modules/es-errors/type.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

/** @type {import('./type')} */ module.exports = TypeError;
}),
"[project]/node_modules/es-errors/uri.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

/** @type {import('./uri')} */ module.exports = URIError;
}),
"[project]/node_modules/math-intrinsics/abs.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

/** @type {import('./abs')} */ module.exports = Math.abs;
}),
"[project]/node_modules/math-intrinsics/floor.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

/** @type {import('./floor')} */ module.exports = Math.floor;
}),
"[project]/node_modules/math-intrinsics/max.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

/** @type {import('./max')} */ module.exports = Math.max;
}),
"[project]/node_modules/math-intrinsics/min.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

/** @type {import('./min')} */ module.exports = Math.min;
}),
"[project]/node_modules/math-intrinsics/pow.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

/** @type {import('./pow')} */ module.exports = Math.pow;
}),
"[project]/node_modules/math-intrinsics/round.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

/** @type {import('./round')} */ module.exports = Math.round;
}),
"[project]/node_modules/math-intrinsics/isNaN.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

/** @type {import('./isNaN')} */ module.exports = Number.isNaN || function isNaN(a) {
    return a !== a;
};
}),
"[project]/node_modules/math-intrinsics/sign.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

var $isNaN = __turbopack_context__.r("[project]/node_modules/math-intrinsics/isNaN.js [app-route] (ecmascript)");
/** @type {import('./sign')} */ module.exports = function sign(number) {
    if ($isNaN(number) || number === 0) {
        return number;
    }
    return number < 0 ? -1 : +1;
};
}),
"[project]/node_modules/gopd/gOPD.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

/** @type {import('./gOPD')} */ module.exports = Object.getOwnPropertyDescriptor;
}),
"[project]/node_modules/gopd/index.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

/** @type {import('.')} */ var $gOPD = __turbopack_context__.r("[project]/node_modules/gopd/gOPD.js [app-route] (ecmascript)");
if ($gOPD) {
    try {
        $gOPD([], 'length');
    } catch (e) {
        // IE 8 has a broken gOPD
        $gOPD = null;
    }
}
module.exports = $gOPD;
}),
"[project]/node_modules/es-define-property/index.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

/** @type {import('.')} */ var $defineProperty = Object.defineProperty || false;
if ($defineProperty) {
    try {
        $defineProperty({}, 'a', {
            value: 1
        });
    } catch (e) {
        // IE 8 has a broken defineProperty
        $defineProperty = false;
    }
}
module.exports = $defineProperty;
}),
"[project]/node_modules/has-symbols/shams.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

/** @type {import('./shams')} */ /* eslint complexity: [2, 18], max-statements: [2, 33] */ module.exports = function hasSymbols() {
    if (typeof Symbol !== 'function' || typeof Object.getOwnPropertySymbols !== 'function') {
        return false;
    }
    if (typeof Symbol.iterator === 'symbol') {
        return true;
    }
    /** @type {{ [k in symbol]?: unknown }} */ var obj = {};
    var sym = Symbol('test');
    var symObj = Object(sym);
    if (typeof sym === 'string') {
        return false;
    }
    if (Object.prototype.toString.call(sym) !== '[object Symbol]') {
        return false;
    }
    if (Object.prototype.toString.call(symObj) !== '[object Symbol]') {
        return false;
    }
    // temp disabled per https://github.com/ljharb/object.assign/issues/17
    // if (sym instanceof Symbol) { return false; }
    // temp disabled per https://github.com/WebReflection/get-own-property-symbols/issues/4
    // if (!(symObj instanceof Symbol)) { return false; }
    // if (typeof Symbol.prototype.toString !== 'function') { return false; }
    // if (String(sym) !== Symbol.prototype.toString.call(sym)) { return false; }
    var symVal = 42;
    obj[sym] = symVal;
    for(var _ in obj){
        return false;
    } // eslint-disable-line no-restricted-syntax, no-unreachable-loop
    if (typeof Object.keys === 'function' && Object.keys(obj).length !== 0) {
        return false;
    }
    if (typeof Object.getOwnPropertyNames === 'function' && Object.getOwnPropertyNames(obj).length !== 0) {
        return false;
    }
    var syms = Object.getOwnPropertySymbols(obj);
    if (syms.length !== 1 || syms[0] !== sym) {
        return false;
    }
    if (!Object.prototype.propertyIsEnumerable.call(obj, sym)) {
        return false;
    }
    if (typeof Object.getOwnPropertyDescriptor === 'function') {
        // eslint-disable-next-line no-extra-parens
        var descriptor = Object.getOwnPropertyDescriptor(obj, sym);
        if (descriptor.value !== symVal || descriptor.enumerable !== true) {
            return false;
        }
    }
    return true;
};
}),
"[project]/node_modules/has-symbols/index.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

var origSymbol = typeof Symbol !== 'undefined' && Symbol;
var hasSymbolSham = __turbopack_context__.r("[project]/node_modules/has-symbols/shams.js [app-route] (ecmascript)");
/** @type {import('.')} */ module.exports = function hasNativeSymbols() {
    if (typeof origSymbol !== 'function') {
        return false;
    }
    if (typeof Symbol !== 'function') {
        return false;
    }
    if (typeof origSymbol('foo') !== 'symbol') {
        return false;
    }
    if (typeof Symbol('bar') !== 'symbol') {
        return false;
    }
    return hasSymbolSham();
};
}),
"[project]/node_modules/get-proto/Reflect.getPrototypeOf.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

/** @type {import('./Reflect.getPrototypeOf')} */ module.exports = typeof Reflect !== 'undefined' && Reflect.getPrototypeOf || null;
}),
"[project]/node_modules/get-proto/Object.getPrototypeOf.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

var $Object = __turbopack_context__.r("[project]/node_modules/es-object-atoms/index.js [app-route] (ecmascript)");
/** @type {import('./Object.getPrototypeOf')} */ module.exports = $Object.getPrototypeOf || null;
}),
"[project]/node_modules/get-proto/index.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

var reflectGetProto = __turbopack_context__.r("[project]/node_modules/get-proto/Reflect.getPrototypeOf.js [app-route] (ecmascript)");
var originalGetProto = __turbopack_context__.r("[project]/node_modules/get-proto/Object.getPrototypeOf.js [app-route] (ecmascript)");
var getDunderProto = __turbopack_context__.r("[project]/node_modules/dunder-proto/get.js [app-route] (ecmascript)");
/** @type {import('.')} */ module.exports = reflectGetProto ? function getProto(O) {
    // @ts-expect-error TS can't narrow inside a closure, for some reason
    return reflectGetProto(O);
} : originalGetProto ? function getProto(O) {
    if (!O || typeof O !== 'object' && typeof O !== 'function') {
        throw new TypeError('getProto: not an object');
    }
    // @ts-expect-error TS can't narrow inside a closure, for some reason
    return originalGetProto(O);
} : getDunderProto ? function getProto(O) {
    // @ts-expect-error TS can't narrow inside a closure, for some reason
    return getDunderProto(O);
} : null;
}),
"[project]/node_modules/function-bind/implementation.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

/* eslint no-invalid-this: 1 */ var ERROR_MESSAGE = 'Function.prototype.bind called on incompatible ';
var toStr = Object.prototype.toString;
var max = Math.max;
var funcType = '[object Function]';
var concatty = function concatty(a, b) {
    var arr = [];
    for(var i = 0; i < a.length; i += 1){
        arr[i] = a[i];
    }
    for(var j = 0; j < b.length; j += 1){
        arr[j + a.length] = b[j];
    }
    return arr;
};
var slicy = function slicy(arrLike, offset) {
    var arr = [];
    for(var i = offset || 0, j = 0; i < arrLike.length; i += 1, j += 1){
        arr[j] = arrLike[i];
    }
    return arr;
};
var joiny = function(arr, joiner) {
    var str = '';
    for(var i = 0; i < arr.length; i += 1){
        str += arr[i];
        if (i + 1 < arr.length) {
            str += joiner;
        }
    }
    return str;
};
module.exports = function bind(that) {
    var target = this;
    if (typeof target !== 'function' || toStr.apply(target) !== funcType) {
        throw new TypeError(ERROR_MESSAGE + target);
    }
    var args = slicy(arguments, 1);
    var bound;
    var binder = function() {
        if (this instanceof bound) {
            var result = target.apply(this, concatty(args, arguments));
            if (Object(result) === result) {
                return result;
            }
            return this;
        }
        return target.apply(that, concatty(args, arguments));
    };
    var boundLength = max(0, target.length - args.length);
    var boundArgs = [];
    for(var i = 0; i < boundLength; i++){
        boundArgs[i] = '$' + i;
    }
    bound = Function('binder', 'return function (' + joiny(boundArgs, ',') + '){ return binder.apply(this,arguments); }')(binder);
    if (target.prototype) {
        var Empty = function Empty() {};
        Empty.prototype = target.prototype;
        bound.prototype = new Empty();
        Empty.prototype = null;
    }
    return bound;
};
}),
"[project]/node_modules/function-bind/index.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

var implementation = __turbopack_context__.r("[project]/node_modules/function-bind/implementation.js [app-route] (ecmascript)");
module.exports = Function.prototype.bind || implementation;
}),
"[project]/node_modules/call-bind-apply-helpers/functionCall.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

/** @type {import('./functionCall')} */ module.exports = Function.prototype.call;
}),
"[project]/node_modules/call-bind-apply-helpers/functionApply.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

/** @type {import('./functionApply')} */ module.exports = Function.prototype.apply;
}),
"[project]/node_modules/call-bind-apply-helpers/reflectApply.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

/** @type {import('./reflectApply')} */ module.exports = typeof Reflect !== 'undefined' && Reflect && Reflect.apply;
}),
"[project]/node_modules/call-bind-apply-helpers/actualApply.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

var bind = __turbopack_context__.r("[project]/node_modules/function-bind/index.js [app-route] (ecmascript)");
var $apply = __turbopack_context__.r("[project]/node_modules/call-bind-apply-helpers/functionApply.js [app-route] (ecmascript)");
var $call = __turbopack_context__.r("[project]/node_modules/call-bind-apply-helpers/functionCall.js [app-route] (ecmascript)");
var $reflectApply = __turbopack_context__.r("[project]/node_modules/call-bind-apply-helpers/reflectApply.js [app-route] (ecmascript)");
/** @type {import('./actualApply')} */ module.exports = $reflectApply || bind.call($call, $apply);
}),
"[project]/node_modules/call-bind-apply-helpers/index.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

var bind = __turbopack_context__.r("[project]/node_modules/function-bind/index.js [app-route] (ecmascript)");
var $TypeError = __turbopack_context__.r("[project]/node_modules/es-errors/type.js [app-route] (ecmascript)");
var $call = __turbopack_context__.r("[project]/node_modules/call-bind-apply-helpers/functionCall.js [app-route] (ecmascript)");
var $actualApply = __turbopack_context__.r("[project]/node_modules/call-bind-apply-helpers/actualApply.js [app-route] (ecmascript)");
/** @type {(args: [Function, thisArg?: unknown, ...args: unknown[]]) => Function} TODO FIXME, find a way to use import('.') */ module.exports = function callBindBasic(args) {
    if (args.length < 1 || typeof args[0] !== 'function') {
        throw new $TypeError('a function is required');
    }
    return $actualApply(bind, $call, args);
};
}),
"[project]/node_modules/dunder-proto/get.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

var callBind = __turbopack_context__.r("[project]/node_modules/call-bind-apply-helpers/index.js [app-route] (ecmascript)");
var gOPD = __turbopack_context__.r("[project]/node_modules/gopd/index.js [app-route] (ecmascript)");
var hasProtoAccessor;
try {
    // eslint-disable-next-line no-extra-parens, no-proto
    hasProtoAccessor = /** @type {{ __proto__?: typeof Array.prototype }} */ [].__proto__ === Array.prototype;
} catch (e) {
    if (!e || typeof e !== 'object' || !('code' in e) || e.code !== 'ERR_PROTO_ACCESS') {
        throw e;
    }
}
// eslint-disable-next-line no-extra-parens
var desc = !!hasProtoAccessor && gOPD && gOPD(Object.prototype, '__proto__');
var $Object = Object;
var $getPrototypeOf = $Object.getPrototypeOf;
/** @type {import('./get')} */ module.exports = desc && typeof desc.get === 'function' ? callBind([
    desc.get
]) : typeof $getPrototypeOf === 'function' ? /** @type {import('./get')} */ function getDunder(value) {
    // eslint-disable-next-line eqeqeq
    return $getPrototypeOf(value == null ? value : $Object(value));
} : false;
}),
"[project]/node_modules/hasown/index.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

var call = Function.prototype.call;
var $hasOwn = Object.prototype.hasOwnProperty;
var bind = __turbopack_context__.r("[project]/node_modules/function-bind/index.js [app-route] (ecmascript)");
/** @type {import('.')} */ module.exports = bind.call(call, $hasOwn);
}),
"[project]/node_modules/get-intrinsic/index.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

var undefined1;
var $Object = __turbopack_context__.r("[project]/node_modules/es-object-atoms/index.js [app-route] (ecmascript)");
var $Error = __turbopack_context__.r("[project]/node_modules/es-errors/index.js [app-route] (ecmascript)");
var $EvalError = __turbopack_context__.r("[project]/node_modules/es-errors/eval.js [app-route] (ecmascript)");
var $RangeError = __turbopack_context__.r("[project]/node_modules/es-errors/range.js [app-route] (ecmascript)");
var $ReferenceError = __turbopack_context__.r("[project]/node_modules/es-errors/ref.js [app-route] (ecmascript)");
var $SyntaxError = __turbopack_context__.r("[project]/node_modules/es-errors/syntax.js [app-route] (ecmascript)");
var $TypeError = __turbopack_context__.r("[project]/node_modules/es-errors/type.js [app-route] (ecmascript)");
var $URIError = __turbopack_context__.r("[project]/node_modules/es-errors/uri.js [app-route] (ecmascript)");
var abs = __turbopack_context__.r("[project]/node_modules/math-intrinsics/abs.js [app-route] (ecmascript)");
var floor = __turbopack_context__.r("[project]/node_modules/math-intrinsics/floor.js [app-route] (ecmascript)");
var max = __turbopack_context__.r("[project]/node_modules/math-intrinsics/max.js [app-route] (ecmascript)");
var min = __turbopack_context__.r("[project]/node_modules/math-intrinsics/min.js [app-route] (ecmascript)");
var pow = __turbopack_context__.r("[project]/node_modules/math-intrinsics/pow.js [app-route] (ecmascript)");
var round = __turbopack_context__.r("[project]/node_modules/math-intrinsics/round.js [app-route] (ecmascript)");
var sign = __turbopack_context__.r("[project]/node_modules/math-intrinsics/sign.js [app-route] (ecmascript)");
var $Function = Function;
// eslint-disable-next-line consistent-return
var getEvalledConstructor = function(expressionSyntax) {
    try {
        return $Function('"use strict"; return (' + expressionSyntax + ').constructor;')();
    } catch (e) {}
};
var $gOPD = __turbopack_context__.r("[project]/node_modules/gopd/index.js [app-route] (ecmascript)");
var $defineProperty = __turbopack_context__.r("[project]/node_modules/es-define-property/index.js [app-route] (ecmascript)");
var throwTypeError = function() {
    throw new $TypeError();
};
var ThrowTypeError = $gOPD ? function() {
    try {
        // eslint-disable-next-line no-unused-expressions, no-caller, no-restricted-properties
        arguments.callee; // IE 8 does not throw here
        return throwTypeError;
    } catch (calleeThrows) {
        try {
            // IE 8 throws on Object.getOwnPropertyDescriptor(arguments, '')
            return $gOPD(arguments, 'callee').get;
        } catch (gOPDthrows) {
            return throwTypeError;
        }
    }
}() : throwTypeError;
var hasSymbols = __turbopack_context__.r("[project]/node_modules/has-symbols/index.js [app-route] (ecmascript)")();
var getProto = __turbopack_context__.r("[project]/node_modules/get-proto/index.js [app-route] (ecmascript)");
var $ObjectGPO = __turbopack_context__.r("[project]/node_modules/get-proto/Object.getPrototypeOf.js [app-route] (ecmascript)");
var $ReflectGPO = __turbopack_context__.r("[project]/node_modules/get-proto/Reflect.getPrototypeOf.js [app-route] (ecmascript)");
var $apply = __turbopack_context__.r("[project]/node_modules/call-bind-apply-helpers/functionApply.js [app-route] (ecmascript)");
var $call = __turbopack_context__.r("[project]/node_modules/call-bind-apply-helpers/functionCall.js [app-route] (ecmascript)");
var needsEval = {};
var TypedArray = typeof Uint8Array === 'undefined' || !getProto ? undefined : getProto(Uint8Array);
var INTRINSICS = {
    __proto__: null,
    '%AggregateError%': typeof AggregateError === 'undefined' ? undefined : AggregateError,
    '%Array%': Array,
    '%ArrayBuffer%': typeof ArrayBuffer === 'undefined' ? undefined : ArrayBuffer,
    '%ArrayIteratorPrototype%': hasSymbols && getProto ? getProto([][Symbol.iterator]()) : undefined,
    '%AsyncFromSyncIteratorPrototype%': undefined,
    '%AsyncFunction%': needsEval,
    '%AsyncGenerator%': needsEval,
    '%AsyncGeneratorFunction%': needsEval,
    '%AsyncIteratorPrototype%': needsEval,
    '%Atomics%': typeof Atomics === 'undefined' ? undefined : Atomics,
    '%BigInt%': typeof BigInt === 'undefined' ? undefined : BigInt,
    '%BigInt64Array%': typeof BigInt64Array === 'undefined' ? undefined : BigInt64Array,
    '%BigUint64Array%': typeof BigUint64Array === 'undefined' ? undefined : BigUint64Array,
    '%Boolean%': Boolean,
    '%DataView%': typeof DataView === 'undefined' ? undefined : DataView,
    '%Date%': Date,
    '%decodeURI%': decodeURI,
    '%decodeURIComponent%': decodeURIComponent,
    '%encodeURI%': encodeURI,
    '%encodeURIComponent%': encodeURIComponent,
    '%Error%': $Error,
    '%eval%': eval,
    '%EvalError%': $EvalError,
    '%Float16Array%': typeof Float16Array === 'undefined' ? undefined : Float16Array,
    '%Float32Array%': typeof Float32Array === 'undefined' ? undefined : Float32Array,
    '%Float64Array%': typeof Float64Array === 'undefined' ? undefined : Float64Array,
    '%FinalizationRegistry%': typeof FinalizationRegistry === 'undefined' ? undefined : FinalizationRegistry,
    '%Function%': $Function,
    '%GeneratorFunction%': needsEval,
    '%Int8Array%': typeof Int8Array === 'undefined' ? undefined : Int8Array,
    '%Int16Array%': typeof Int16Array === 'undefined' ? undefined : Int16Array,
    '%Int32Array%': typeof Int32Array === 'undefined' ? undefined : Int32Array,
    '%isFinite%': isFinite,
    '%isNaN%': isNaN,
    '%IteratorPrototype%': hasSymbols && getProto ? getProto(getProto([][Symbol.iterator]())) : undefined,
    '%JSON%': typeof JSON === 'object' ? JSON : undefined,
    '%Map%': typeof Map === 'undefined' ? undefined : Map,
    '%MapIteratorPrototype%': typeof Map === 'undefined' || !hasSymbols || !getProto ? undefined : getProto(new Map()[Symbol.iterator]()),
    '%Math%': Math,
    '%Number%': Number,
    '%Object%': $Object,
    '%Object.getOwnPropertyDescriptor%': $gOPD,
    '%parseFloat%': parseFloat,
    '%parseInt%': parseInt,
    '%Promise%': typeof Promise === 'undefined' ? undefined : Promise,
    '%Proxy%': typeof Proxy === 'undefined' ? undefined : Proxy,
    '%RangeError%': $RangeError,
    '%ReferenceError%': $ReferenceError,
    '%Reflect%': typeof Reflect === 'undefined' ? undefined : Reflect,
    '%RegExp%': RegExp,
    '%Set%': typeof Set === 'undefined' ? undefined : Set,
    '%SetIteratorPrototype%': typeof Set === 'undefined' || !hasSymbols || !getProto ? undefined : getProto(new Set()[Symbol.iterator]()),
    '%SharedArrayBuffer%': typeof SharedArrayBuffer === 'undefined' ? undefined : SharedArrayBuffer,
    '%String%': String,
    '%StringIteratorPrototype%': hasSymbols && getProto ? getProto(''[Symbol.iterator]()) : undefined,
    '%Symbol%': hasSymbols ? Symbol : undefined,
    '%SyntaxError%': $SyntaxError,
    '%ThrowTypeError%': ThrowTypeError,
    '%TypedArray%': TypedArray,
    '%TypeError%': $TypeError,
    '%Uint8Array%': typeof Uint8Array === 'undefined' ? undefined : Uint8Array,
    '%Uint8ClampedArray%': typeof Uint8ClampedArray === 'undefined' ? undefined : Uint8ClampedArray,
    '%Uint16Array%': typeof Uint16Array === 'undefined' ? undefined : Uint16Array,
    '%Uint32Array%': typeof Uint32Array === 'undefined' ? undefined : Uint32Array,
    '%URIError%': $URIError,
    '%WeakMap%': typeof WeakMap === 'undefined' ? undefined : WeakMap,
    '%WeakRef%': typeof WeakRef === 'undefined' ? undefined : WeakRef,
    '%WeakSet%': typeof WeakSet === 'undefined' ? undefined : WeakSet,
    '%Function.prototype.call%': $call,
    '%Function.prototype.apply%': $apply,
    '%Object.defineProperty%': $defineProperty,
    '%Object.getPrototypeOf%': $ObjectGPO,
    '%Math.abs%': abs,
    '%Math.floor%': floor,
    '%Math.max%': max,
    '%Math.min%': min,
    '%Math.pow%': pow,
    '%Math.round%': round,
    '%Math.sign%': sign,
    '%Reflect.getPrototypeOf%': $ReflectGPO
};
if (getProto) {
    try {
        null.error; // eslint-disable-line no-unused-expressions
    } catch (e) {
        // https://github.com/tc39/proposal-shadowrealm/pull/384#issuecomment-1364264229
        var errorProto = getProto(getProto(e));
        INTRINSICS['%Error.prototype%'] = errorProto;
    }
}
var doEval = function doEval(name) {
    var value;
    if (name === '%AsyncFunction%') {
        value = getEvalledConstructor('async function () {}');
    } else if (name === '%GeneratorFunction%') {
        value = getEvalledConstructor('function* () {}');
    } else if (name === '%AsyncGeneratorFunction%') {
        value = getEvalledConstructor('async function* () {}');
    } else if (name === '%AsyncGenerator%') {
        var fn = doEval('%AsyncGeneratorFunction%');
        if (fn) {
            value = fn.prototype;
        }
    } else if (name === '%AsyncIteratorPrototype%') {
        var gen = doEval('%AsyncGenerator%');
        if (gen && getProto) {
            value = getProto(gen.prototype);
        }
    }
    INTRINSICS[name] = value;
    return value;
};
var LEGACY_ALIASES = {
    __proto__: null,
    '%ArrayBufferPrototype%': [
        'ArrayBuffer',
        'prototype'
    ],
    '%ArrayPrototype%': [
        'Array',
        'prototype'
    ],
    '%ArrayProto_entries%': [
        'Array',
        'prototype',
        'entries'
    ],
    '%ArrayProto_forEach%': [
        'Array',
        'prototype',
        'forEach'
    ],
    '%ArrayProto_keys%': [
        'Array',
        'prototype',
        'keys'
    ],
    '%ArrayProto_values%': [
        'Array',
        'prototype',
        'values'
    ],
    '%AsyncFunctionPrototype%': [
        'AsyncFunction',
        'prototype'
    ],
    '%AsyncGenerator%': [
        'AsyncGeneratorFunction',
        'prototype'
    ],
    '%AsyncGeneratorPrototype%': [
        'AsyncGeneratorFunction',
        'prototype',
        'prototype'
    ],
    '%BooleanPrototype%': [
        'Boolean',
        'prototype'
    ],
    '%DataViewPrototype%': [
        'DataView',
        'prototype'
    ],
    '%DatePrototype%': [
        'Date',
        'prototype'
    ],
    '%ErrorPrototype%': [
        'Error',
        'prototype'
    ],
    '%EvalErrorPrototype%': [
        'EvalError',
        'prototype'
    ],
    '%Float32ArrayPrototype%': [
        'Float32Array',
        'prototype'
    ],
    '%Float64ArrayPrototype%': [
        'Float64Array',
        'prototype'
    ],
    '%FunctionPrototype%': [
        'Function',
        'prototype'
    ],
    '%Generator%': [
        'GeneratorFunction',
        'prototype'
    ],
    '%GeneratorPrototype%': [
        'GeneratorFunction',
        'prototype',
        'prototype'
    ],
    '%Int8ArrayPrototype%': [
        'Int8Array',
        'prototype'
    ],
    '%Int16ArrayPrototype%': [
        'Int16Array',
        'prototype'
    ],
    '%Int32ArrayPrototype%': [
        'Int32Array',
        'prototype'
    ],
    '%JSONParse%': [
        'JSON',
        'parse'
    ],
    '%JSONStringify%': [
        'JSON',
        'stringify'
    ],
    '%MapPrototype%': [
        'Map',
        'prototype'
    ],
    '%NumberPrototype%': [
        'Number',
        'prototype'
    ],
    '%ObjectPrototype%': [
        'Object',
        'prototype'
    ],
    '%ObjProto_toString%': [
        'Object',
        'prototype',
        'toString'
    ],
    '%ObjProto_valueOf%': [
        'Object',
        'prototype',
        'valueOf'
    ],
    '%PromisePrototype%': [
        'Promise',
        'prototype'
    ],
    '%PromiseProto_then%': [
        'Promise',
        'prototype',
        'then'
    ],
    '%Promise_all%': [
        'Promise',
        'all'
    ],
    '%Promise_reject%': [
        'Promise',
        'reject'
    ],
    '%Promise_resolve%': [
        'Promise',
        'resolve'
    ],
    '%RangeErrorPrototype%': [
        'RangeError',
        'prototype'
    ],
    '%ReferenceErrorPrototype%': [
        'ReferenceError',
        'prototype'
    ],
    '%RegExpPrototype%': [
        'RegExp',
        'prototype'
    ],
    '%SetPrototype%': [
        'Set',
        'prototype'
    ],
    '%SharedArrayBufferPrototype%': [
        'SharedArrayBuffer',
        'prototype'
    ],
    '%StringPrototype%': [
        'String',
        'prototype'
    ],
    '%SymbolPrototype%': [
        'Symbol',
        'prototype'
    ],
    '%SyntaxErrorPrototype%': [
        'SyntaxError',
        'prototype'
    ],
    '%TypedArrayPrototype%': [
        'TypedArray',
        'prototype'
    ],
    '%TypeErrorPrototype%': [
        'TypeError',
        'prototype'
    ],
    '%Uint8ArrayPrototype%': [
        'Uint8Array',
        'prototype'
    ],
    '%Uint8ClampedArrayPrototype%': [
        'Uint8ClampedArray',
        'prototype'
    ],
    '%Uint16ArrayPrototype%': [
        'Uint16Array',
        'prototype'
    ],
    '%Uint32ArrayPrototype%': [
        'Uint32Array',
        'prototype'
    ],
    '%URIErrorPrototype%': [
        'URIError',
        'prototype'
    ],
    '%WeakMapPrototype%': [
        'WeakMap',
        'prototype'
    ],
    '%WeakSetPrototype%': [
        'WeakSet',
        'prototype'
    ]
};
var bind = __turbopack_context__.r("[project]/node_modules/function-bind/index.js [app-route] (ecmascript)");
var hasOwn = __turbopack_context__.r("[project]/node_modules/hasown/index.js [app-route] (ecmascript)");
var $concat = bind.call($call, Array.prototype.concat);
var $spliceApply = bind.call($apply, Array.prototype.splice);
var $replace = bind.call($call, String.prototype.replace);
var $strSlice = bind.call($call, String.prototype.slice);
var $exec = bind.call($call, RegExp.prototype.exec);
/* adapted from https://github.com/lodash/lodash/blob/4.17.15/dist/lodash.js#L6735-L6744 */ var rePropName = /[^%.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]|(?=(?:\.|\[\])(?:\.|\[\]|%$))/g;
var reEscapeChar = /\\(\\)?/g; /** Used to match backslashes in property paths. */ 
var stringToPath = function stringToPath(string) {
    var first = $strSlice(string, 0, 1);
    var last = $strSlice(string, -1);
    if (first === '%' && last !== '%') {
        throw new $SyntaxError('invalid intrinsic syntax, expected closing `%`');
    } else if (last === '%' && first !== '%') {
        throw new $SyntaxError('invalid intrinsic syntax, expected opening `%`');
    }
    var result = [];
    $replace(string, rePropName, function(match, number, quote, subString) {
        result[result.length] = quote ? $replace(subString, reEscapeChar, '$1') : number || match;
    });
    return result;
};
/* end adaptation */ var getBaseIntrinsic = function getBaseIntrinsic(name, allowMissing) {
    var intrinsicName = name;
    var alias;
    if (hasOwn(LEGACY_ALIASES, intrinsicName)) {
        alias = LEGACY_ALIASES[intrinsicName];
        intrinsicName = '%' + alias[0] + '%';
    }
    if (hasOwn(INTRINSICS, intrinsicName)) {
        var value = INTRINSICS[intrinsicName];
        if (value === needsEval) {
            value = doEval(intrinsicName);
        }
        if (typeof value === 'undefined' && !allowMissing) {
            throw new $TypeError('intrinsic ' + name + ' exists, but is not available. Please file an issue!');
        }
        return {
            alias: alias,
            name: intrinsicName,
            value: value
        };
    }
    throw new $SyntaxError('intrinsic ' + name + ' does not exist!');
};
module.exports = function GetIntrinsic(name, allowMissing) {
    if (typeof name !== 'string' || name.length === 0) {
        throw new $TypeError('intrinsic name must be a non-empty string');
    }
    if (arguments.length > 1 && typeof allowMissing !== 'boolean') {
        throw new $TypeError('"allowMissing" argument must be a boolean');
    }
    if ($exec(/^%?[^%]*%?$/, name) === null) {
        throw new $SyntaxError('`%` may not be present anywhere but at the beginning and end of the intrinsic name');
    }
    var parts = stringToPath(name);
    var intrinsicBaseName = parts.length > 0 ? parts[0] : '';
    var intrinsic = getBaseIntrinsic('%' + intrinsicBaseName + '%', allowMissing);
    var intrinsicRealName = intrinsic.name;
    var value = intrinsic.value;
    var skipFurtherCaching = false;
    var alias = intrinsic.alias;
    if (alias) {
        intrinsicBaseName = alias[0];
        $spliceApply(parts, $concat([
            0,
            1
        ], alias));
    }
    for(var i = 1, isOwn = true; i < parts.length; i += 1){
        var part = parts[i];
        var first = $strSlice(part, 0, 1);
        var last = $strSlice(part, -1);
        if ((first === '"' || first === "'" || first === '`' || last === '"' || last === "'" || last === '`') && first !== last) {
            throw new $SyntaxError('property names with quotes must have matching quotes');
        }
        if (part === 'constructor' || !isOwn) {
            skipFurtherCaching = true;
        }
        intrinsicBaseName += '.' + part;
        intrinsicRealName = '%' + intrinsicBaseName + '%';
        if (hasOwn(INTRINSICS, intrinsicRealName)) {
            value = INTRINSICS[intrinsicRealName];
        } else if (value != null) {
            if (!(part in value)) {
                if (!allowMissing) {
                    throw new $TypeError('base intrinsic for ' + name + ' exists, but the property is not available.');
                }
                return void undefined;
            }
            if ($gOPD && i + 1 >= parts.length) {
                var desc = $gOPD(value, part);
                isOwn = !!desc;
                // By convention, when a data property is converted to an accessor
                // property to emulate a data property that does not suffer from
                // the override mistake, that accessor's getter is marked with
                // an `originalValue` property. Here, when we detect this, we
                // uphold the illusion by pretending to see that original data
                // property, i.e., returning the value rather than the getter
                // itself.
                if (isOwn && 'get' in desc && !('originalValue' in desc.get)) {
                    value = desc.get;
                } else {
                    value = value[part];
                }
            } else {
                isOwn = hasOwn(value, part);
                value = value[part];
            }
            if (isOwn && !skipFurtherCaching) {
                INTRINSICS[intrinsicRealName] = value;
            }
        }
    }
    return value;
};
}),
"[project]/node_modules/has-tostringtag/shams.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

var hasSymbols = __turbopack_context__.r("[project]/node_modules/has-symbols/shams.js [app-route] (ecmascript)");
/** @type {import('.')} */ module.exports = function hasToStringTagShams() {
    return hasSymbols() && !!Symbol.toStringTag;
};
}),
"[project]/node_modules/es-set-tostringtag/index.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

var GetIntrinsic = __turbopack_context__.r("[project]/node_modules/get-intrinsic/index.js [app-route] (ecmascript)");
var $defineProperty = GetIntrinsic('%Object.defineProperty%', true);
var hasToStringTag = __turbopack_context__.r("[project]/node_modules/has-tostringtag/shams.js [app-route] (ecmascript)")();
var hasOwn = __turbopack_context__.r("[project]/node_modules/hasown/index.js [app-route] (ecmascript)");
var $TypeError = __turbopack_context__.r("[project]/node_modules/es-errors/type.js [app-route] (ecmascript)");
var toStringTag = hasToStringTag ? Symbol.toStringTag : null;
/** @type {import('.')} */ module.exports = function setToStringTag(object, value) {
    var overrideIfSet = arguments.length > 2 && !!arguments[2] && arguments[2].force;
    var nonConfigurable = arguments.length > 2 && !!arguments[2] && arguments[2].nonConfigurable;
    if (typeof overrideIfSet !== 'undefined' && typeof overrideIfSet !== 'boolean' || typeof nonConfigurable !== 'undefined' && typeof nonConfigurable !== 'boolean') {
        throw new $TypeError('if provided, the `overrideIfSet` and `nonConfigurable` options must be booleans');
    }
    if (toStringTag && (overrideIfSet || !hasOwn(object, toStringTag))) {
        if ($defineProperty) {
            $defineProperty(object, toStringTag, {
                configurable: !nonConfigurable,
                enumerable: false,
                value: value,
                writable: false
            });
        } else {
            object[toStringTag] = value; // eslint-disable-line no-param-reassign
        }
    }
};
}),
"[project]/node_modules/form-data/lib/populate.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

// populates missing values
module.exports = function(dst, src) {
    Object.keys(src).forEach(function(prop) {
        dst[prop] = dst[prop] || src[prop]; // eslint-disable-line no-param-reassign
    });
    return dst;
};
}),
"[project]/node_modules/form-data/lib/form_data.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

var CombinedStream = __turbopack_context__.r("[project]/node_modules/combined-stream/lib/combined_stream.js [app-route] (ecmascript)");
var util = __turbopack_context__.r("[externals]/util [external] (util, cjs)");
var path = __turbopack_context__.r("[externals]/path [external] (path, cjs)");
var http = __turbopack_context__.r("[externals]/http [external] (http, cjs)");
var https = __turbopack_context__.r("[externals]/https [external] (https, cjs)");
var parseUrl = __turbopack_context__.r("[externals]/url [external] (url, cjs)").parse;
var fs = __turbopack_context__.r("[externals]/fs [external] (fs, cjs)");
var Stream = __turbopack_context__.r("[externals]/stream [external] (stream, cjs)").Stream;
var crypto = __turbopack_context__.r("[externals]/crypto [external] (crypto, cjs)");
var mime = __turbopack_context__.r("[project]/node_modules/mime-types/index.js [app-route] (ecmascript)");
var asynckit = __turbopack_context__.r("[project]/node_modules/asynckit/index.js [app-route] (ecmascript)");
var setToStringTag = __turbopack_context__.r("[project]/node_modules/es-set-tostringtag/index.js [app-route] (ecmascript)");
var hasOwn = __turbopack_context__.r("[project]/node_modules/hasown/index.js [app-route] (ecmascript)");
var populate = __turbopack_context__.r("[project]/node_modules/form-data/lib/populate.js [app-route] (ecmascript)");
/**
 * Create readable "multipart/form-data" streams.
 * Can be used to submit forms
 * and file uploads to other web applications.
 *
 * @constructor
 * @param {object} options - Properties to be added/overriden for FormData and CombinedStream
 */ function FormData(options) {
    if (!(this instanceof FormData)) {
        return new FormData(options);
    }
    this._overheadLength = 0;
    this._valueLength = 0;
    this._valuesToMeasure = [];
    CombinedStream.call(this);
    options = options || {}; // eslint-disable-line no-param-reassign
    for(var option in options){
        this[option] = options[option];
    }
}
// make it a Stream
util.inherits(FormData, CombinedStream);
FormData.LINE_BREAK = '\r\n';
FormData.DEFAULT_CONTENT_TYPE = 'application/octet-stream';
FormData.prototype.append = function(field, value, options) {
    options = options || {}; // eslint-disable-line no-param-reassign
    // allow filename as single option
    if (typeof options === 'string') {
        options = {
            filename: options
        }; // eslint-disable-line no-param-reassign
    }
    var append = CombinedStream.prototype.append.bind(this);
    // all that streamy business can't handle numbers
    if (typeof value === 'number' || value == null) {
        value = String(value); // eslint-disable-line no-param-reassign
    }
    // https://github.com/felixge/node-form-data/issues/38
    if (Array.isArray(value)) {
        /*
     * Please convert your array into string
     * the way web server expects it
     */ this._error(new Error('Arrays are not supported.'));
        return;
    }
    var header = this._multiPartHeader(field, value, options);
    var footer = this._multiPartFooter();
    append(header);
    append(value);
    append(footer);
    // pass along options.knownLength
    this._trackLength(header, value, options);
};
FormData.prototype._trackLength = function(header, value, options) {
    var valueLength = 0;
    /*
   * used w/ getLengthSync(), when length is known.
   * e.g. for streaming directly from a remote server,
   * w/ a known file a size, and not wanting to wait for
   * incoming file to finish to get its size.
   */ if (options.knownLength != null) {
        valueLength += Number(options.knownLength);
    } else if (Buffer.isBuffer(value)) {
        valueLength = value.length;
    } else if (typeof value === 'string') {
        valueLength = Buffer.byteLength(value);
    }
    this._valueLength += valueLength;
    // @check why add CRLF? does this account for custom/multiple CRLFs?
    this._overheadLength += Buffer.byteLength(header) + FormData.LINE_BREAK.length;
    // empty or either doesn't have path or not an http response or not a stream
    if (!value || !value.path && !(value.readable && hasOwn(value, 'httpVersion')) && !(value instanceof Stream)) {
        return;
    }
    // no need to bother with the length
    if (!options.knownLength) {
        this._valuesToMeasure.push(value);
    }
};
FormData.prototype._lengthRetriever = function(value, callback) {
    if (hasOwn(value, 'fd')) {
        // take read range into a account
        // `end` = Infinity –> read file till the end
        //
        // TODO: Looks like there is bug in Node fs.createReadStream
        // it doesn't respect `end` options without `start` options
        // Fix it when node fixes it.
        // https://github.com/joyent/node/issues/7819
        if (value.end != undefined && value.end != Infinity && value.start != undefined) {
            // when end specified
            // no need to calculate range
            // inclusive, starts with 0
            callback(null, value.end + 1 - (value.start ? value.start : 0)); // eslint-disable-line callback-return
        // not that fast snoopy
        } else {
            // still need to fetch file size from fs
            fs.stat(value.path, function(err, stat) {
                if (err) {
                    callback(err);
                    return;
                }
                // update final size based on the range options
                var fileSize = stat.size - (value.start ? value.start : 0);
                callback(null, fileSize);
            });
        }
    // or http response
    } else if (hasOwn(value, 'httpVersion')) {
        callback(null, Number(value.headers['content-length'])); // eslint-disable-line callback-return
    // or request stream http://github.com/mikeal/request
    } else if (hasOwn(value, 'httpModule')) {
        // wait till response come back
        value.on('response', function(response) {
            value.pause();
            callback(null, Number(response.headers['content-length']));
        });
        value.resume();
    // something else
    } else {
        callback('Unknown stream'); // eslint-disable-line callback-return
    }
};
FormData.prototype._multiPartHeader = function(field, value, options) {
    /*
   * custom header specified (as string)?
   * it becomes responsible for boundary
   * (e.g. to handle extra CRLFs on .NET servers)
   */ if (typeof options.header === 'string') {
        return options.header;
    }
    var contentDisposition = this._getContentDisposition(value, options);
    var contentType = this._getContentType(value, options);
    var contents = '';
    var headers = {
        // add custom disposition as third element or keep it two elements if not
        'Content-Disposition': [
            'form-data',
            'name="' + field + '"'
        ].concat(contentDisposition || []),
        // if no content type. allow it to be empty array
        'Content-Type': [].concat(contentType || [])
    };
    // allow custom headers.
    if (typeof options.header === 'object') {
        populate(headers, options.header);
    }
    var header;
    for(var prop in headers){
        if (hasOwn(headers, prop)) {
            header = headers[prop];
            // skip nullish headers.
            if (header == null) {
                continue; // eslint-disable-line no-restricted-syntax, no-continue
            }
            // convert all headers to arrays.
            if (!Array.isArray(header)) {
                header = [
                    header
                ];
            }
            // add non-empty headers.
            if (header.length) {
                contents += prop + ': ' + header.join('; ') + FormData.LINE_BREAK;
            }
        }
    }
    return '--' + this.getBoundary() + FormData.LINE_BREAK + contents + FormData.LINE_BREAK;
};
FormData.prototype._getContentDisposition = function(value, options) {
    var filename;
    if (typeof options.filepath === 'string') {
        // custom filepath for relative paths
        filename = path.normalize(options.filepath).replace(/\\/g, '/');
    } else if (options.filename || value && (value.name || value.path)) {
        /*
     * custom filename take precedence
     * formidable and the browser add a name property
     * fs- and request- streams have path property
     */ filename = path.basename(options.filename || value && (value.name || value.path));
    } else if (value && value.readable && hasOwn(value, 'httpVersion')) {
        // or try http response
        filename = path.basename(value.client._httpMessage.path || '');
    }
    if (filename) {
        return 'filename="' + filename + '"';
    }
};
FormData.prototype._getContentType = function(value, options) {
    // use custom content-type above all
    var contentType = options.contentType;
    // or try `name` from formidable, browser
    if (!contentType && value && value.name) {
        contentType = mime.lookup(value.name);
    }
    // or try `path` from fs-, request- streams
    if (!contentType && value && value.path) {
        contentType = mime.lookup(value.path);
    }
    // or if it's http-reponse
    if (!contentType && value && value.readable && hasOwn(value, 'httpVersion')) {
        contentType = value.headers['content-type'];
    }
    // or guess it from the filepath or filename
    if (!contentType && (options.filepath || options.filename)) {
        contentType = mime.lookup(options.filepath || options.filename);
    }
    // fallback to the default content type if `value` is not simple value
    if (!contentType && value && typeof value === 'object') {
        contentType = FormData.DEFAULT_CONTENT_TYPE;
    }
    return contentType;
};
FormData.prototype._multiPartFooter = function() {
    return (function(next) {
        var footer = FormData.LINE_BREAK;
        var lastPart = this._streams.length === 0;
        if (lastPart) {
            footer += this._lastBoundary();
        }
        next(footer);
    }).bind(this);
};
FormData.prototype._lastBoundary = function() {
    return '--' + this.getBoundary() + '--' + FormData.LINE_BREAK;
};
FormData.prototype.getHeaders = function(userHeaders) {
    var header;
    var formHeaders = {
        'content-type': 'multipart/form-data; boundary=' + this.getBoundary()
    };
    for(header in userHeaders){
        if (hasOwn(userHeaders, header)) {
            formHeaders[header.toLowerCase()] = userHeaders[header];
        }
    }
    return formHeaders;
};
FormData.prototype.setBoundary = function(boundary) {
    if (typeof boundary !== 'string') {
        throw new TypeError('FormData boundary must be a string');
    }
    this._boundary = boundary;
};
FormData.prototype.getBoundary = function() {
    if (!this._boundary) {
        this._generateBoundary();
    }
    return this._boundary;
};
FormData.prototype.getBuffer = function() {
    var dataBuffer = new Buffer.alloc(0); // eslint-disable-line new-cap
    var boundary = this.getBoundary();
    // Create the form content. Add Line breaks to the end of data.
    for(var i = 0, len = this._streams.length; i < len; i++){
        if (typeof this._streams[i] !== 'function') {
            // Add content to the buffer.
            if (Buffer.isBuffer(this._streams[i])) {
                dataBuffer = Buffer.concat([
                    dataBuffer,
                    this._streams[i]
                ]);
            } else {
                dataBuffer = Buffer.concat([
                    dataBuffer,
                    Buffer.from(this._streams[i])
                ]);
            }
            // Add break after content.
            if (typeof this._streams[i] !== 'string' || this._streams[i].substring(2, boundary.length + 2) !== boundary) {
                dataBuffer = Buffer.concat([
                    dataBuffer,
                    Buffer.from(FormData.LINE_BREAK)
                ]);
            }
        }
    }
    // Add the footer and return the Buffer object.
    return Buffer.concat([
        dataBuffer,
        Buffer.from(this._lastBoundary())
    ]);
};
FormData.prototype._generateBoundary = function() {
    // This generates a 50 character boundary similar to those used by Firefox.
    // They are optimized for boyer-moore parsing.
    this._boundary = '--------------------------' + crypto.randomBytes(12).toString('hex');
};
// Note: getLengthSync DOESN'T calculate streams length
// As workaround one can calculate file size manually and add it as knownLength option
FormData.prototype.getLengthSync = function() {
    var knownLength = this._overheadLength + this._valueLength;
    // Don't get confused, there are 3 "internal" streams for each keyval pair so it basically checks if there is any value added to the form
    if (this._streams.length) {
        knownLength += this._lastBoundary().length;
    }
    // https://github.com/form-data/form-data/issues/40
    if (!this.hasKnownLength()) {
        /*
     * Some async length retrievers are present
     * therefore synchronous length calculation is false.
     * Please use getLength(callback) to get proper length
     */ this._error(new Error('Cannot calculate proper length in synchronous way.'));
    }
    return knownLength;
};
// Public API to check if length of added values is known
// https://github.com/form-data/form-data/issues/196
// https://github.com/form-data/form-data/issues/262
FormData.prototype.hasKnownLength = function() {
    var hasKnownLength = true;
    if (this._valuesToMeasure.length) {
        hasKnownLength = false;
    }
    return hasKnownLength;
};
FormData.prototype.getLength = function(cb) {
    var knownLength = this._overheadLength + this._valueLength;
    if (this._streams.length) {
        knownLength += this._lastBoundary().length;
    }
    if (!this._valuesToMeasure.length) {
        process.nextTick(cb.bind(this, null, knownLength));
        return;
    }
    asynckit.parallel(this._valuesToMeasure, this._lengthRetriever, function(err, values) {
        if (err) {
            cb(err);
            return;
        }
        values.forEach(function(length) {
            knownLength += length;
        });
        cb(null, knownLength);
    });
};
FormData.prototype.submit = function(params, cb) {
    var request;
    var options;
    var defaults = {
        method: 'post'
    };
    // parse provided url if it's string or treat it as options object
    if (typeof params === 'string') {
        params = parseUrl(params); // eslint-disable-line no-param-reassign
        /* eslint sort-keys: 0 */ options = populate({
            port: params.port,
            path: params.pathname,
            host: params.hostname,
            protocol: params.protocol
        }, defaults);
    } else {
        options = populate(params, defaults);
        // if no port provided use default one
        if (!options.port) {
            options.port = options.protocol === 'https:' ? 443 : 80;
        }
    }
    // put that good code in getHeaders to some use
    options.headers = this.getHeaders(params.headers);
    // https if specified, fallback to http in any other case
    if (options.protocol === 'https:') {
        request = https.request(options);
    } else {
        request = http.request(options);
    }
    // get content length and fire away
    this.getLength((function(err, length) {
        if (err && err !== 'Unknown stream') {
            this._error(err);
            return;
        }
        // add content length
        if (length) {
            request.setHeader('Content-Length', length);
        }
        this.pipe(request);
        if (cb) {
            var onResponse;
            var callback = function(error, responce) {
                request.removeListener('error', callback);
                request.removeListener('response', onResponse);
                return cb.call(this, error, responce);
            };
            onResponse = callback.bind(this, null);
            request.on('error', callback);
            request.on('response', onResponse);
        }
    }).bind(this));
    return request;
};
FormData.prototype._error = function(err) {
    if (!this.error) {
        this.error = err;
        this.pause();
        this.emit('error', err);
    }
};
FormData.prototype.toString = function() {
    return '[object FormData]';
};
setToStringTag(FormData.prototype, 'FormData');
// Public API
module.exports = FormData;
}),
"[project]/node_modules/proxy-from-env/index.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

var parseUrl = __turbopack_context__.r("[externals]/url [external] (url, cjs)").parse;
var DEFAULT_PORTS = {
    ftp: 21,
    gopher: 70,
    http: 80,
    https: 443,
    ws: 80,
    wss: 443
};
var stringEndsWith = String.prototype.endsWith || function(s) {
    return s.length <= this.length && this.indexOf(s, this.length - s.length) !== -1;
};
/**
 * @param {string|object} url - The URL, or the result from url.parse.
 * @return {string} The URL of the proxy that should handle the request to the
 *  given URL. If no proxy is set, this will be an empty string.
 */ function getProxyForUrl(url) {
    var parsedUrl = typeof url === 'string' ? parseUrl(url) : url || {};
    var proto = parsedUrl.protocol;
    var hostname = parsedUrl.host;
    var port = parsedUrl.port;
    if (typeof hostname !== 'string' || !hostname || typeof proto !== 'string') {
        return ''; // Don't proxy URLs without a valid scheme or host.
    }
    proto = proto.split(':', 1)[0];
    // Stripping ports in this way instead of using parsedUrl.hostname to make
    // sure that the brackets around IPv6 addresses are kept.
    hostname = hostname.replace(/:\d*$/, '');
    port = parseInt(port) || DEFAULT_PORTS[proto] || 0;
    if (!shouldProxy(hostname, port)) {
        return ''; // Don't proxy URLs that match NO_PROXY.
    }
    var proxy = getEnv('npm_config_' + proto + '_proxy') || getEnv(proto + '_proxy') || getEnv('npm_config_proxy') || getEnv('all_proxy');
    if (proxy && proxy.indexOf('://') === -1) {
        // Missing scheme in proxy, default to the requested URL's scheme.
        proxy = proto + '://' + proxy;
    }
    return proxy;
}
/**
 * Determines whether a given URL should be proxied.
 *
 * @param {string} hostname - The host name of the URL.
 * @param {number} port - The effective port of the URL.
 * @returns {boolean} Whether the given URL should be proxied.
 * @private
 */ function shouldProxy(hostname, port) {
    var NO_PROXY = (getEnv('npm_config_no_proxy') || getEnv('no_proxy')).toLowerCase();
    if (!NO_PROXY) {
        return true; // Always proxy if NO_PROXY is not set.
    }
    if (NO_PROXY === '*') {
        return false; // Never proxy if wildcard is set.
    }
    return NO_PROXY.split(/[,\s]/).every(function(proxy) {
        if (!proxy) {
            return true; // Skip zero-length hosts.
        }
        var parsedProxy = proxy.match(/^(.+):(\d+)$/);
        var parsedProxyHostname = parsedProxy ? parsedProxy[1] : proxy;
        var parsedProxyPort = parsedProxy ? parseInt(parsedProxy[2]) : 0;
        if (parsedProxyPort && parsedProxyPort !== port) {
            return true; // Skip if ports don't match.
        }
        if (!/^[.*]/.test(parsedProxyHostname)) {
            // No wildcards, so stop proxying if there is an exact match.
            return hostname !== parsedProxyHostname;
        }
        if (parsedProxyHostname.charAt(0) === '*') {
            // Remove leading wildcard.
            parsedProxyHostname = parsedProxyHostname.slice(1);
        }
        // Stop proxying if the hostname ends with the no_proxy host.
        return !stringEndsWith.call(hostname, parsedProxyHostname);
    });
}
/**
 * Get the value for an environment variable.
 *
 * @param {string} key - The name of the environment variable.
 * @return {string} The value of the environment variable.
 * @private
 */ function getEnv(key) {
    return process.env[key.toLowerCase()] || process.env[key.toUpperCase()] || '';
}
exports.getProxyForUrl = getProxyForUrl;
}),
"[project]/node_modules/ms/index.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {

/**
 * Helpers.
 */ var s = 1000;
var m = s * 60;
var h = m * 60;
var d = h * 24;
var w = d * 7;
var y = d * 365.25;
/**
 * Parse or format the given `val`.
 *
 * Options:
 *
 *  - `long` verbose formatting [false]
 *
 * @param {String|Number} val
 * @param {Object} [options]
 * @throws {Error} throw an error if val is not a non-empty string or a number
 * @return {String|Number}
 * @api public
 */ module.exports = function(val, options) {
    options = options || {};
    var type = typeof val;
    if (type === 'string' && val.length > 0) {
        return parse(val);
    } else if (type === 'number' && isFinite(val)) {
        return options.long ? fmtLong(val) : fmtShort(val);
    }
    throw new Error('val is not a non-empty string or a valid number. val=' + JSON.stringify(val));
};
/**
 * Parse the given `str` and return milliseconds.
 *
 * @param {String} str
 * @return {Number}
 * @api private
 */ function parse(str) {
    str = String(str);
    if (str.length > 100) {
        return;
    }
    var match = /^(-?(?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)?$/i.exec(str);
    if (!match) {
        return;
    }
    var n = parseFloat(match[1]);
    var type = (match[2] || 'ms').toLowerCase();
    switch(type){
        case 'years':
        case 'year':
        case 'yrs':
        case 'yr':
        case 'y':
            return n * y;
        case 'weeks':
        case 'week':
        case 'w':
            return n * w;
        case 'days':
        case 'day':
        case 'd':
            return n * d;
        case 'hours':
        case 'hour':
        case 'hrs':
        case 'hr':
        case 'h':
            return n * h;
        case 'minutes':
        case 'minute':
        case 'mins':
        case 'min':
        case 'm':
            return n * m;
        case 'seconds':
        case 'second':
        case 'secs':
        case 'sec':
        case 's':
            return n * s;
        case 'milliseconds':
        case 'millisecond':
        case 'msecs':
        case 'msec':
        case 'ms':
            return n;
        default:
            return undefined;
    }
}
/**
 * Short format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */ function fmtShort(ms) {
    var msAbs = Math.abs(ms);
    if (msAbs >= d) {
        return Math.round(ms / d) + 'd';
    }
    if (msAbs >= h) {
        return Math.round(ms / h) + 'h';
    }
    if (msAbs >= m) {
        return Math.round(ms / m) + 'm';
    }
    if (msAbs >= s) {
        return Math.round(ms / s) + 's';
    }
    return ms + 'ms';
}
/**
 * Long format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */ function fmtLong(ms) {
    var msAbs = Math.abs(ms);
    if (msAbs >= d) {
        return plural(ms, msAbs, d, 'day');
    }
    if (msAbs >= h) {
        return plural(ms, msAbs, h, 'hour');
    }
    if (msAbs >= m) {
        return plural(ms, msAbs, m, 'minute');
    }
    if (msAbs >= s) {
        return plural(ms, msAbs, s, 'second');
    }
    return ms + ' ms';
}
/**
 * Pluralization helper.
 */ function plural(ms, msAbs, n, name) {
    var isPlural = msAbs >= n * 1.5;
    return Math.round(ms / n) + ' ' + name + (isPlural ? 's' : '');
}
}),
"[project]/node_modules/debug/src/common.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {

/**
 * This is the common logic for both the Node.js and web browser
 * implementations of `debug()`.
 */ function setup(env) {
    createDebug.debug = createDebug;
    createDebug.default = createDebug;
    createDebug.coerce = coerce;
    createDebug.disable = disable;
    createDebug.enable = enable;
    createDebug.enabled = enabled;
    createDebug.humanize = __turbopack_context__.r("[project]/node_modules/ms/index.js [app-route] (ecmascript)");
    createDebug.destroy = destroy;
    Object.keys(env).forEach((key)=>{
        createDebug[key] = env[key];
    });
    /**
	* The currently active debug mode names, and names to skip.
	*/ createDebug.names = [];
    createDebug.skips = [];
    /**
	* Map of special "%n" handling functions, for the debug "format" argument.
	*
	* Valid key names are a single, lower or upper-case letter, i.e. "n" and "N".
	*/ createDebug.formatters = {};
    /**
	* Selects a color for a debug namespace
	* @param {String} namespace The namespace string for the debug instance to be colored
	* @return {Number|String} An ANSI color code for the given namespace
	* @api private
	*/ function selectColor(namespace) {
        let hash = 0;
        for(let i = 0; i < namespace.length; i++){
            hash = (hash << 5) - hash + namespace.charCodeAt(i);
            hash |= 0; // Convert to 32bit integer
        }
        return createDebug.colors[Math.abs(hash) % createDebug.colors.length];
    }
    createDebug.selectColor = selectColor;
    /**
	* Create a debugger with the given `namespace`.
	*
	* @param {String} namespace
	* @return {Function}
	* @api public
	*/ function createDebug(namespace) {
        let prevTime;
        let enableOverride = null;
        let namespacesCache;
        let enabledCache;
        function debug(...args) {
            // Disabled?
            if (!debug.enabled) {
                return;
            }
            const self = debug;
            // Set `diff` timestamp
            const curr = Number(new Date());
            const ms = curr - (prevTime || curr);
            self.diff = ms;
            self.prev = prevTime;
            self.curr = curr;
            prevTime = curr;
            args[0] = createDebug.coerce(args[0]);
            if (typeof args[0] !== 'string') {
                // Anything else let's inspect with %O
                args.unshift('%O');
            }
            // Apply any `formatters` transformations
            let index = 0;
            args[0] = args[0].replace(/%([a-zA-Z%])/g, (match, format)=>{
                // If we encounter an escaped % then don't increase the array index
                if (match === '%%') {
                    return '%';
                }
                index++;
                const formatter = createDebug.formatters[format];
                if (typeof formatter === 'function') {
                    const val = args[index];
                    match = formatter.call(self, val);
                    // Now we need to remove `args[index]` since it's inlined in the `format`
                    args.splice(index, 1);
                    index--;
                }
                return match;
            });
            // Apply env-specific formatting (colors, etc.)
            createDebug.formatArgs.call(self, args);
            const logFn = self.log || createDebug.log;
            logFn.apply(self, args);
        }
        debug.namespace = namespace;
        debug.useColors = createDebug.useColors();
        debug.color = createDebug.selectColor(namespace);
        debug.extend = extend;
        debug.destroy = createDebug.destroy; // XXX Temporary. Will be removed in the next major release.
        Object.defineProperty(debug, 'enabled', {
            enumerable: true,
            configurable: false,
            get: ()=>{
                if (enableOverride !== null) {
                    return enableOverride;
                }
                if (namespacesCache !== createDebug.namespaces) {
                    namespacesCache = createDebug.namespaces;
                    enabledCache = createDebug.enabled(namespace);
                }
                return enabledCache;
            },
            set: (v)=>{
                enableOverride = v;
            }
        });
        // Env-specific initialization logic for debug instances
        if (typeof createDebug.init === 'function') {
            createDebug.init(debug);
        }
        return debug;
    }
    function extend(namespace, delimiter) {
        const newDebug = createDebug(this.namespace + (typeof delimiter === 'undefined' ? ':' : delimiter) + namespace);
        newDebug.log = this.log;
        return newDebug;
    }
    /**
	* Enables a debug mode by namespaces. This can include modes
	* separated by a colon and wildcards.
	*
	* @param {String} namespaces
	* @api public
	*/ function enable(namespaces) {
        createDebug.save(namespaces);
        createDebug.namespaces = namespaces;
        createDebug.names = [];
        createDebug.skips = [];
        const split = (typeof namespaces === 'string' ? namespaces : '').trim().replace(/\s+/g, ',').split(',').filter(Boolean);
        for (const ns of split){
            if (ns[0] === '-') {
                createDebug.skips.push(ns.slice(1));
            } else {
                createDebug.names.push(ns);
            }
        }
    }
    /**
	 * Checks if the given string matches a namespace template, honoring
	 * asterisks as wildcards.
	 *
	 * @param {String} search
	 * @param {String} template
	 * @return {Boolean}
	 */ function matchesTemplate(search, template) {
        let searchIndex = 0;
        let templateIndex = 0;
        let starIndex = -1;
        let matchIndex = 0;
        while(searchIndex < search.length){
            if (templateIndex < template.length && (template[templateIndex] === search[searchIndex] || template[templateIndex] === '*')) {
                // Match character or proceed with wildcard
                if (template[templateIndex] === '*') {
                    starIndex = templateIndex;
                    matchIndex = searchIndex;
                    templateIndex++; // Skip the '*'
                } else {
                    searchIndex++;
                    templateIndex++;
                }
            } else if (starIndex !== -1) {
                // Backtrack to the last '*' and try to match more characters
                templateIndex = starIndex + 1;
                matchIndex++;
                searchIndex = matchIndex;
            } else {
                return false; // No match
            }
        }
        // Handle trailing '*' in template
        while(templateIndex < template.length && template[templateIndex] === '*'){
            templateIndex++;
        }
        return templateIndex === template.length;
    }
    /**
	* Disable debug output.
	*
	* @return {String} namespaces
	* @api public
	*/ function disable() {
        const namespaces = [
            ...createDebug.names,
            ...createDebug.skips.map((namespace)=>'-' + namespace)
        ].join(',');
        createDebug.enable('');
        return namespaces;
    }
    /**
	* Returns true if the given mode name is enabled, false otherwise.
	*
	* @param {String} name
	* @return {Boolean}
	* @api public
	*/ function enabled(name) {
        for (const skip of createDebug.skips){
            if (matchesTemplate(name, skip)) {
                return false;
            }
        }
        for (const ns of createDebug.names){
            if (matchesTemplate(name, ns)) {
                return true;
            }
        }
        return false;
    }
    /**
	* Coerce `val`.
	*
	* @param {Mixed} val
	* @return {Mixed}
	* @api private
	*/ function coerce(val) {
        if (val instanceof Error) {
            return val.stack || val.message;
        }
        return val;
    }
    /**
	* XXX DO NOT USE. This is a temporary stub function.
	* XXX It WILL be removed in the next major release.
	*/ function destroy() {
        console.warn('Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.');
    }
    createDebug.enable(createDebug.load());
    return createDebug;
}
module.exports = setup;
}),
"[project]/node_modules/debug/src/node.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {

/**
 * Module dependencies.
 */ const tty = __turbopack_context__.r("[externals]/tty [external] (tty, cjs)");
const util = __turbopack_context__.r("[externals]/util [external] (util, cjs)");
/**
 * This is the Node.js implementation of `debug()`.
 */ exports.init = init;
exports.log = log;
exports.formatArgs = formatArgs;
exports.save = save;
exports.load = load;
exports.useColors = useColors;
exports.destroy = util.deprecate(()=>{}, 'Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.');
/**
 * Colors.
 */ exports.colors = [
    6,
    2,
    3,
    4,
    5,
    1
];
try {
    // Optional dependency (as in, doesn't need to be installed, NOT like optionalDependencies in package.json)
    // eslint-disable-next-line import/no-extraneous-dependencies
    const supportsColor = __turbopack_context__.r("[project]/node_modules/supports-color/index.js [app-route] (ecmascript)");
    if (supportsColor && (supportsColor.stderr || supportsColor).level >= 2) {
        exports.colors = [
            20,
            21,
            26,
            27,
            32,
            33,
            38,
            39,
            40,
            41,
            42,
            43,
            44,
            45,
            56,
            57,
            62,
            63,
            68,
            69,
            74,
            75,
            76,
            77,
            78,
            79,
            80,
            81,
            92,
            93,
            98,
            99,
            112,
            113,
            128,
            129,
            134,
            135,
            148,
            149,
            160,
            161,
            162,
            163,
            164,
            165,
            166,
            167,
            168,
            169,
            170,
            171,
            172,
            173,
            178,
            179,
            184,
            185,
            196,
            197,
            198,
            199,
            200,
            201,
            202,
            203,
            204,
            205,
            206,
            207,
            208,
            209,
            214,
            215,
            220,
            221
        ];
    }
} catch (error) {
// Swallow - we only care if `supports-color` is available; it doesn't have to be.
}
/**
 * Build up the default `inspectOpts` object from the environment variables.
 *
 *   $ DEBUG_COLORS=no DEBUG_DEPTH=10 DEBUG_SHOW_HIDDEN=enabled node script.js
 */ exports.inspectOpts = Object.keys(process.env).filter((key)=>{
    return /^debug_/i.test(key);
}).reduce((obj, key)=>{
    // Camel-case
    const prop = key.substring(6).toLowerCase().replace(/_([a-z])/g, (_, k)=>{
        return k.toUpperCase();
    });
    // Coerce string value into JS value
    let val = process.env[key];
    if (/^(yes|on|true|enabled)$/i.test(val)) {
        val = true;
    } else if (/^(no|off|false|disabled)$/i.test(val)) {
        val = false;
    } else if (val === 'null') {
        val = null;
    } else {
        val = Number(val);
    }
    obj[prop] = val;
    return obj;
}, {});
/**
 * Is stdout a TTY? Colored output is enabled when `true`.
 */ function useColors() {
    return 'colors' in exports.inspectOpts ? Boolean(exports.inspectOpts.colors) : tty.isatty(process.stderr.fd);
}
/**
 * Adds ANSI color escape codes if enabled.
 *
 * @api public
 */ function formatArgs(args) {
    const { namespace: name, useColors } = this;
    if (useColors) {
        const c = this.color;
        const colorCode = '\u001B[3' + (c < 8 ? c : '8;5;' + c);
        const prefix = `  ${colorCode};1m${name} \u001B[0m`;
        args[0] = prefix + args[0].split('\n').join('\n' + prefix);
        args.push(colorCode + 'm+' + module.exports.humanize(this.diff) + '\u001B[0m');
    } else {
        args[0] = getDate() + name + ' ' + args[0];
    }
}
function getDate() {
    if (exports.inspectOpts.hideDate) {
        return '';
    }
    return new Date().toISOString() + ' ';
}
/**
 * Invokes `util.formatWithOptions()` with the specified arguments and writes to stderr.
 */ function log(...args) {
    return process.stderr.write(util.formatWithOptions(exports.inspectOpts, ...args) + '\n');
}
/**
 * Save `namespaces`.
 *
 * @param {String} namespaces
 * @api private
 */ function save(namespaces) {
    if (namespaces) {
        process.env.DEBUG = namespaces;
    } else {
        // If you set a process.env field to null or undefined, it gets cast to the
        // string 'null' or 'undefined'. Just delete instead.
        delete process.env.DEBUG;
    }
}
/**
 * Load `namespaces`.
 *
 * @return {String} returns the previously persisted debug modes
 * @api private
 */ function load() {
    return process.env.DEBUG;
}
/**
 * Init logic for `debug` instances.
 *
 * Create a new `inspectOpts` object in case `useColors` is set
 * differently for a particular `debug` instance.
 */ function init(debug) {
    debug.inspectOpts = {};
    const keys = Object.keys(exports.inspectOpts);
    for(let i = 0; i < keys.length; i++){
        debug.inspectOpts[keys[i]] = exports.inspectOpts[keys[i]];
    }
}
module.exports = __turbopack_context__.r("[project]/node_modules/debug/src/common.js [app-route] (ecmascript)")(exports);
const { formatters } = module.exports;
/**
 * Map %o to `util.inspect()`, all on a single line.
 */ formatters.o = function(v) {
    this.inspectOpts.colors = this.useColors;
    return util.inspect(v, this.inspectOpts).split('\n').map((str)=>str.trim()).join(' ');
};
/**
 * Map %O to `util.inspect()`, allowing multiple lines if needed.
 */ formatters.O = function(v) {
    this.inspectOpts.colors = this.useColors;
    return util.inspect(v, this.inspectOpts);
};
}),
"[project]/node_modules/debug/src/browser.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {

/* eslint-env browser */ /**
 * This is the web browser implementation of `debug()`.
 */ exports.formatArgs = formatArgs;
exports.save = save;
exports.load = load;
exports.useColors = useColors;
exports.storage = localstorage();
exports.destroy = (()=>{
    let warned = false;
    return ()=>{
        if (!warned) {
            warned = true;
            console.warn('Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.');
        }
    };
})();
/**
 * Colors.
 */ exports.colors = [
    '#0000CC',
    '#0000FF',
    '#0033CC',
    '#0033FF',
    '#0066CC',
    '#0066FF',
    '#0099CC',
    '#0099FF',
    '#00CC00',
    '#00CC33',
    '#00CC66',
    '#00CC99',
    '#00CCCC',
    '#00CCFF',
    '#3300CC',
    '#3300FF',
    '#3333CC',
    '#3333FF',
    '#3366CC',
    '#3366FF',
    '#3399CC',
    '#3399FF',
    '#33CC00',
    '#33CC33',
    '#33CC66',
    '#33CC99',
    '#33CCCC',
    '#33CCFF',
    '#6600CC',
    '#6600FF',
    '#6633CC',
    '#6633FF',
    '#66CC00',
    '#66CC33',
    '#9900CC',
    '#9900FF',
    '#9933CC',
    '#9933FF',
    '#99CC00',
    '#99CC33',
    '#CC0000',
    '#CC0033',
    '#CC0066',
    '#CC0099',
    '#CC00CC',
    '#CC00FF',
    '#CC3300',
    '#CC3333',
    '#CC3366',
    '#CC3399',
    '#CC33CC',
    '#CC33FF',
    '#CC6600',
    '#CC6633',
    '#CC9900',
    '#CC9933',
    '#CCCC00',
    '#CCCC33',
    '#FF0000',
    '#FF0033',
    '#FF0066',
    '#FF0099',
    '#FF00CC',
    '#FF00FF',
    '#FF3300',
    '#FF3333',
    '#FF3366',
    '#FF3399',
    '#FF33CC',
    '#FF33FF',
    '#FF6600',
    '#FF6633',
    '#FF9900',
    '#FF9933',
    '#FFCC00',
    '#FFCC33'
];
/**
 * Currently only WebKit-based Web Inspectors, Firefox >= v31,
 * and the Firebug extension (any Firefox version) are known
 * to support "%c" CSS customizations.
 *
 * TODO: add a `localStorage` variable to explicitly enable/disable colors
 */ // eslint-disable-next-line complexity
function useColors() {
    // NB: In an Electron preload script, document will be defined but not fully
    // initialized. Since we know we're in Chrome, we'll just detect this case
    // explicitly
    if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
    ;
    // Internet Explorer and Edge do not support colors.
    if (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/(edge|trident)\/(\d+)/)) {
        return false;
    }
    let m;
    // Is webkit? http://stackoverflow.com/a/16459606/376773
    // document is undefined in react-native: https://github.com/facebook/react-native/pull/1632
    // eslint-disable-next-line no-return-assign
    return typeof document !== 'undefined' && document.documentElement && document.documentElement.style && document.documentElement.style.WebkitAppearance || ("TURBOPACK compile-time value", "undefined") !== 'undefined' && window.console && (window.console.firebug || window.console.exception && window.console.table) || typeof navigator !== 'undefined' && navigator.userAgent && (m = navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/)) && parseInt(m[1], 10) >= 31 || typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/);
}
/**
 * Colorize log arguments if enabled.
 *
 * @api public
 */ function formatArgs(args) {
    args[0] = (this.useColors ? '%c' : '') + this.namespace + (this.useColors ? ' %c' : ' ') + args[0] + (this.useColors ? '%c ' : ' ') + '+' + module.exports.humanize(this.diff);
    if (!this.useColors) {
        return;
    }
    const c = 'color: ' + this.color;
    args.splice(1, 0, c, 'color: inherit');
    // The final "%c" is somewhat tricky, because there could be other
    // arguments passed either before or after the %c, so we need to
    // figure out the correct index to insert the CSS into
    let index = 0;
    let lastC = 0;
    args[0].replace(/%[a-zA-Z%]/g, (match)=>{
        if (match === '%%') {
            return;
        }
        index++;
        if (match === '%c') {
            // We only are interested in the *last* %c
            // (the user may have provided their own)
            lastC = index;
        }
    });
    args.splice(lastC, 0, c);
}
/**
 * Invokes `console.debug()` when available.
 * No-op when `console.debug` is not a "function".
 * If `console.debug` is not available, falls back
 * to `console.log`.
 *
 * @api public
 */ exports.log = console.debug || console.log || (()=>{});
/**
 * Save `namespaces`.
 *
 * @param {String} namespaces
 * @api private
 */ function save(namespaces) {
    try {
        if (namespaces) {
            exports.storage.setItem('debug', namespaces);
        } else {
            exports.storage.removeItem('debug');
        }
    } catch (error) {
    // Swallow
    // XXX (@Qix-) should we be logging these?
    }
}
/**
 * Load `namespaces`.
 *
 * @return {String} returns the previously persisted debug modes
 * @api private
 */ function load() {
    let r;
    try {
        r = exports.storage.getItem('debug') || exports.storage.getItem('DEBUG');
    } catch (error) {
    // Swallow
    // XXX (@Qix-) should we be logging these?
    }
    // If debug isn't set in LS, and we're in Electron, try to load $DEBUG
    if (!r && typeof process !== 'undefined' && 'env' in process) {
        r = process.env.DEBUG;
    }
    return r;
}
/**
 * Localstorage attempts to return the localstorage.
 *
 * This is necessary because safari throws
 * when a user disables cookies/localstorage
 * and you attempt to access it.
 *
 * @return {LocalStorage}
 * @api private
 */ function localstorage() {
    try {
        // TVMLKit (Apple TV JS Runtime) does not have a window object, just localStorage in the global context
        // The Browser also has localStorage in the global context.
        return localStorage;
    } catch (error) {
    // Swallow
    // XXX (@Qix-) should we be logging these?
    }
}
module.exports = __turbopack_context__.r("[project]/node_modules/debug/src/common.js [app-route] (ecmascript)")(exports);
const { formatters } = module.exports;
/**
 * Map %j to `JSON.stringify()`, since no Web Inspectors do that by default.
 */ formatters.j = function(v) {
    try {
        return JSON.stringify(v);
    } catch (error) {
        return '[UnexpectedJSONParseError]: ' + error.message;
    }
};
}),
"[project]/node_modules/debug/src/index.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {

/**
 * Detect Electron renderer / nwjs process, which is node, but we should
 * treat as a browser.
 */ if (typeof process === 'undefined' || process.type === 'renderer' || ("TURBOPACK compile-time value", false) === true || process.__nwjs) {
    module.exports = __turbopack_context__.r("[project]/node_modules/debug/src/browser.js [app-route] (ecmascript)");
} else {
    module.exports = __turbopack_context__.r("[project]/node_modules/debug/src/node.js [app-route] (ecmascript)");
}
}),
"[project]/node_modules/has-flag/index.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

module.exports = (flag, argv = process.argv)=>{
    const prefix = flag.startsWith('-') ? '' : flag.length === 1 ? '-' : '--';
    const position = argv.indexOf(prefix + flag);
    const terminatorPosition = argv.indexOf('--');
    return position !== -1 && (terminatorPosition === -1 || position < terminatorPosition);
};
}),
"[project]/node_modules/supports-color/index.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

const os = __turbopack_context__.r("[externals]/os [external] (os, cjs)");
const tty = __turbopack_context__.r("[externals]/tty [external] (tty, cjs)");
const hasFlag = __turbopack_context__.r("[project]/node_modules/has-flag/index.js [app-route] (ecmascript)");
const { env } = process;
let forceColor;
if (hasFlag('no-color') || hasFlag('no-colors') || hasFlag('color=false') || hasFlag('color=never')) {
    forceColor = 0;
} else if (hasFlag('color') || hasFlag('colors') || hasFlag('color=true') || hasFlag('color=always')) {
    forceColor = 1;
}
if ('FORCE_COLOR' in env) {
    if (env.FORCE_COLOR === 'true') {
        forceColor = 1;
    } else if (env.FORCE_COLOR === 'false') {
        forceColor = 0;
    } else {
        forceColor = env.FORCE_COLOR.length === 0 ? 1 : Math.min(parseInt(env.FORCE_COLOR, 10), 3);
    }
}
function translateLevel(level) {
    if (level === 0) {
        return false;
    }
    return {
        level,
        hasBasic: true,
        has256: level >= 2,
        has16m: level >= 3
    };
}
function supportsColor(haveStream, streamIsTTY) {
    if (forceColor === 0) {
        return 0;
    }
    if (hasFlag('color=16m') || hasFlag('color=full') || hasFlag('color=truecolor')) {
        return 3;
    }
    if (hasFlag('color=256')) {
        return 2;
    }
    if (haveStream && !streamIsTTY && forceColor === undefined) {
        return 0;
    }
    const min = forceColor || 0;
    if (env.TERM === 'dumb') {
        return min;
    }
    if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
    ;
    if ('CI' in env) {
        if ([
            'TRAVIS',
            'CIRCLECI',
            'APPVEYOR',
            'GITLAB_CI',
            'GITHUB_ACTIONS',
            'BUILDKITE'
        ].some((sign)=>sign in env) || env.CI_NAME === 'codeship') {
            return 1;
        }
        return min;
    }
    if ('TEAMCITY_VERSION' in env) {
        return /^(9\.(0*[1-9]\d*)\.|\d{2,}\.)/.test(env.TEAMCITY_VERSION) ? 1 : 0;
    }
    if (env.COLORTERM === 'truecolor') {
        return 3;
    }
    if ('TERM_PROGRAM' in env) {
        const version = parseInt((env.TERM_PROGRAM_VERSION || '').split('.')[0], 10);
        switch(env.TERM_PROGRAM){
            case 'iTerm.app':
                return version >= 3 ? 3 : 2;
            case 'Apple_Terminal':
                return 2;
        }
    }
    if (/-256(color)?$/i.test(env.TERM)) {
        return 2;
    }
    if (/^screen|^xterm|^vt100|^vt220|^rxvt|color|ansi|cygwin|linux/i.test(env.TERM)) {
        return 1;
    }
    if ('COLORTERM' in env) {
        return 1;
    }
    return min;
}
function getSupportLevel(stream) {
    const level = supportsColor(stream, stream && stream.isTTY);
    return translateLevel(level);
}
module.exports = {
    supportsColor: getSupportLevel,
    stdout: translateLevel(supportsColor(true, tty.isatty(1))),
    stderr: translateLevel(supportsColor(true, tty.isatty(2)))
};
}),
"[project]/node_modules/follow-redirects/debug.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {

var debug;
module.exports = function() {
    if (!debug) {
        try {
            /* eslint global-require: off */ debug = __turbopack_context__.r("[project]/node_modules/debug/src/index.js [app-route] (ecmascript)")("follow-redirects");
        } catch (error) {}
        if (typeof debug !== "function") {
            debug = function() {};
        }
    }
    debug.apply(null, arguments);
};
}),
"[project]/node_modules/follow-redirects/index.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {

var url = __turbopack_context__.r("[externals]/url [external] (url, cjs)");
var URL = url.URL;
var http = __turbopack_context__.r("[externals]/http [external] (http, cjs)");
var https = __turbopack_context__.r("[externals]/https [external] (https, cjs)");
var Writable = __turbopack_context__.r("[externals]/stream [external] (stream, cjs)").Writable;
var assert = __turbopack_context__.r("[externals]/assert [external] (assert, cjs)");
var debug = __turbopack_context__.r("[project]/node_modules/follow-redirects/debug.js [app-route] (ecmascript)");
// Preventive platform detection
// istanbul ignore next
(function detectUnsupportedEnvironment() {
    var looksLikeNode = typeof process !== "undefined";
    var looksLikeBrowser = ("TURBOPACK compile-time value", "undefined") !== "undefined" && typeof document !== "undefined";
    var looksLikeV8 = isFunction(Error.captureStackTrace);
    if (!looksLikeNode && (looksLikeBrowser || !looksLikeV8)) {
        console.warn("The follow-redirects package should be excluded from browser builds.");
    }
})();
// Whether to use the native URL object or the legacy url module
var useNativeURL = false;
try {
    assert(new URL(""));
} catch (error) {
    useNativeURL = error.code === "ERR_INVALID_URL";
}
// URL fields to preserve in copy operations
var preservedUrlFields = [
    "auth",
    "host",
    "hostname",
    "href",
    "path",
    "pathname",
    "port",
    "protocol",
    "query",
    "search",
    "hash"
];
// Create handlers that pass events from native requests
var events = [
    "abort",
    "aborted",
    "connect",
    "error",
    "socket",
    "timeout"
];
var eventHandlers = Object.create(null);
events.forEach(function(event) {
    eventHandlers[event] = function(arg1, arg2, arg3) {
        this._redirectable.emit(event, arg1, arg2, arg3);
    };
});
// Error types with codes
var InvalidUrlError = createErrorType("ERR_INVALID_URL", "Invalid URL", TypeError);
var RedirectionError = createErrorType("ERR_FR_REDIRECTION_FAILURE", "Redirected request failed");
var TooManyRedirectsError = createErrorType("ERR_FR_TOO_MANY_REDIRECTS", "Maximum number of redirects exceeded", RedirectionError);
var MaxBodyLengthExceededError = createErrorType("ERR_FR_MAX_BODY_LENGTH_EXCEEDED", "Request body larger than maxBodyLength limit");
var WriteAfterEndError = createErrorType("ERR_STREAM_WRITE_AFTER_END", "write after end");
// istanbul ignore next
var destroy = Writable.prototype.destroy || noop;
// An HTTP(S) request that can be redirected
function RedirectableRequest(options, responseCallback) {
    // Initialize the request
    Writable.call(this);
    this._sanitizeOptions(options);
    this._options = options;
    this._ended = false;
    this._ending = false;
    this._redirectCount = 0;
    this._redirects = [];
    this._requestBodyLength = 0;
    this._requestBodyBuffers = [];
    // Attach a callback if passed
    if (responseCallback) {
        this.on("response", responseCallback);
    }
    // React to responses of native requests
    var self = this;
    this._onNativeResponse = function(response) {
        try {
            self._processResponse(response);
        } catch (cause) {
            self.emit("error", cause instanceof RedirectionError ? cause : new RedirectionError({
                cause: cause
            }));
        }
    };
    // Perform the first request
    this._performRequest();
}
RedirectableRequest.prototype = Object.create(Writable.prototype);
RedirectableRequest.prototype.abort = function() {
    destroyRequest(this._currentRequest);
    this._currentRequest.abort();
    this.emit("abort");
};
RedirectableRequest.prototype.destroy = function(error) {
    destroyRequest(this._currentRequest, error);
    destroy.call(this, error);
    return this;
};
// Writes buffered data to the current native request
RedirectableRequest.prototype.write = function(data, encoding, callback) {
    // Writing is not allowed if end has been called
    if (this._ending) {
        throw new WriteAfterEndError();
    }
    // Validate input and shift parameters if necessary
    if (!isString(data) && !isBuffer(data)) {
        throw new TypeError("data should be a string, Buffer or Uint8Array");
    }
    if (isFunction(encoding)) {
        callback = encoding;
        encoding = null;
    }
    // Ignore empty buffers, since writing them doesn't invoke the callback
    // https://github.com/nodejs/node/issues/22066
    if (data.length === 0) {
        if (callback) {
            callback();
        }
        return;
    }
    // Only write when we don't exceed the maximum body length
    if (this._requestBodyLength + data.length <= this._options.maxBodyLength) {
        this._requestBodyLength += data.length;
        this._requestBodyBuffers.push({
            data: data,
            encoding: encoding
        });
        this._currentRequest.write(data, encoding, callback);
    } else {
        this.emit("error", new MaxBodyLengthExceededError());
        this.abort();
    }
};
// Ends the current native request
RedirectableRequest.prototype.end = function(data, encoding, callback) {
    // Shift parameters if necessary
    if (isFunction(data)) {
        callback = data;
        data = encoding = null;
    } else if (isFunction(encoding)) {
        callback = encoding;
        encoding = null;
    }
    // Write data if needed and end
    if (!data) {
        this._ended = this._ending = true;
        this._currentRequest.end(null, null, callback);
    } else {
        var self = this;
        var currentRequest = this._currentRequest;
        this.write(data, encoding, function() {
            self._ended = true;
            currentRequest.end(null, null, callback);
        });
        this._ending = true;
    }
};
// Sets a header value on the current native request
RedirectableRequest.prototype.setHeader = function(name, value) {
    this._options.headers[name] = value;
    this._currentRequest.setHeader(name, value);
};
// Clears a header value on the current native request
RedirectableRequest.prototype.removeHeader = function(name) {
    delete this._options.headers[name];
    this._currentRequest.removeHeader(name);
};
// Global timeout for all underlying requests
RedirectableRequest.prototype.setTimeout = function(msecs, callback) {
    var self = this;
    // Destroys the socket on timeout
    function destroyOnTimeout(socket) {
        socket.setTimeout(msecs);
        socket.removeListener("timeout", socket.destroy);
        socket.addListener("timeout", socket.destroy);
    }
    // Sets up a timer to trigger a timeout event
    function startTimer(socket) {
        if (self._timeout) {
            clearTimeout(self._timeout);
        }
        self._timeout = setTimeout(function() {
            self.emit("timeout");
            clearTimer();
        }, msecs);
        destroyOnTimeout(socket);
    }
    // Stops a timeout from triggering
    function clearTimer() {
        // Clear the timeout
        if (self._timeout) {
            clearTimeout(self._timeout);
            self._timeout = null;
        }
        // Clean up all attached listeners
        self.removeListener("abort", clearTimer);
        self.removeListener("error", clearTimer);
        self.removeListener("response", clearTimer);
        self.removeListener("close", clearTimer);
        if (callback) {
            self.removeListener("timeout", callback);
        }
        if (!self.socket) {
            self._currentRequest.removeListener("socket", startTimer);
        }
    }
    // Attach callback if passed
    if (callback) {
        this.on("timeout", callback);
    }
    // Start the timer if or when the socket is opened
    if (this.socket) {
        startTimer(this.socket);
    } else {
        this._currentRequest.once("socket", startTimer);
    }
    // Clean up on events
    this.on("socket", destroyOnTimeout);
    this.on("abort", clearTimer);
    this.on("error", clearTimer);
    this.on("response", clearTimer);
    this.on("close", clearTimer);
    return this;
};
// Proxy all other public ClientRequest methods
[
    "flushHeaders",
    "getHeader",
    "setNoDelay",
    "setSocketKeepAlive"
].forEach(function(method) {
    RedirectableRequest.prototype[method] = function(a, b) {
        return this._currentRequest[method](a, b);
    };
});
// Proxy all public ClientRequest properties
[
    "aborted",
    "connection",
    "socket"
].forEach(function(property) {
    Object.defineProperty(RedirectableRequest.prototype, property, {
        get: function() {
            return this._currentRequest[property];
        }
    });
});
RedirectableRequest.prototype._sanitizeOptions = function(options) {
    // Ensure headers are always present
    if (!options.headers) {
        options.headers = {};
    }
    // Since http.request treats host as an alias of hostname,
    // but the url module interprets host as hostname plus port,
    // eliminate the host property to avoid confusion.
    if (options.host) {
        // Use hostname if set, because it has precedence
        if (!options.hostname) {
            options.hostname = options.host;
        }
        delete options.host;
    }
    // Complete the URL object when necessary
    if (!options.pathname && options.path) {
        var searchPos = options.path.indexOf("?");
        if (searchPos < 0) {
            options.pathname = options.path;
        } else {
            options.pathname = options.path.substring(0, searchPos);
            options.search = options.path.substring(searchPos);
        }
    }
};
// Executes the next native request (initial or redirect)
RedirectableRequest.prototype._performRequest = function() {
    // Load the native protocol
    var protocol = this._options.protocol;
    var nativeProtocol = this._options.nativeProtocols[protocol];
    if (!nativeProtocol) {
        throw new TypeError("Unsupported protocol " + protocol);
    }
    // If specified, use the agent corresponding to the protocol
    // (HTTP and HTTPS use different types of agents)
    if (this._options.agents) {
        var scheme = protocol.slice(0, -1);
        this._options.agent = this._options.agents[scheme];
    }
    // Create the native request and set up its event handlers
    var request = this._currentRequest = nativeProtocol.request(this._options, this._onNativeResponse);
    request._redirectable = this;
    for (var event of events){
        request.on(event, eventHandlers[event]);
    }
    // RFC7230§5.3.1: When making a request directly to an origin server, […]
    // a client MUST send only the absolute path […] as the request-target.
    this._currentUrl = /^\//.test(this._options.path) ? url.format(this._options) : // When making a request to a proxy, […]
    // a client MUST send the target URI in absolute-form […].
    this._options.path;
    // End a redirected request
    // (The first request must be ended explicitly with RedirectableRequest#end)
    if (this._isRedirect) {
        // Write the request entity and end
        var i = 0;
        var self = this;
        var buffers = this._requestBodyBuffers;
        (function writeNext(error) {
            // Only write if this request has not been redirected yet
            // istanbul ignore else
            if (request === self._currentRequest) {
                // Report any write errors
                // istanbul ignore if
                if (error) {
                    self.emit("error", error);
                } else if (i < buffers.length) {
                    var buffer = buffers[i++];
                    // istanbul ignore else
                    if (!request.finished) {
                        request.write(buffer.data, buffer.encoding, writeNext);
                    }
                } else if (self._ended) {
                    request.end();
                }
            }
        })();
    }
};
// Processes a response from the current native request
RedirectableRequest.prototype._processResponse = function(response) {
    // Store the redirected response
    var statusCode = response.statusCode;
    if (this._options.trackRedirects) {
        this._redirects.push({
            url: this._currentUrl,
            headers: response.headers,
            statusCode: statusCode
        });
    }
    // RFC7231§6.4: The 3xx (Redirection) class of status code indicates
    // that further action needs to be taken by the user agent in order to
    // fulfill the request. If a Location header field is provided,
    // the user agent MAY automatically redirect its request to the URI
    // referenced by the Location field value,
    // even if the specific status code is not understood.
    // If the response is not a redirect; return it as-is
    var location = response.headers.location;
    if (!location || this._options.followRedirects === false || statusCode < 300 || statusCode >= 400) {
        response.responseUrl = this._currentUrl;
        response.redirects = this._redirects;
        this.emit("response", response);
        // Clean up
        this._requestBodyBuffers = [];
        return;
    }
    // The response is a redirect, so abort the current request
    destroyRequest(this._currentRequest);
    // Discard the remainder of the response to avoid waiting for data
    response.destroy();
    // RFC7231§6.4: A client SHOULD detect and intervene
    // in cyclical redirections (i.e., "infinite" redirection loops).
    if (++this._redirectCount > this._options.maxRedirects) {
        throw new TooManyRedirectsError();
    }
    // Store the request headers if applicable
    var requestHeaders;
    var beforeRedirect = this._options.beforeRedirect;
    if (beforeRedirect) {
        requestHeaders = Object.assign({
            // The Host header was set by nativeProtocol.request
            Host: response.req.getHeader("host")
        }, this._options.headers);
    }
    // RFC7231§6.4: Automatic redirection needs to done with
    // care for methods not known to be safe, […]
    // RFC7231§6.4.2–3: For historical reasons, a user agent MAY change
    // the request method from POST to GET for the subsequent request.
    var method = this._options.method;
    if ((statusCode === 301 || statusCode === 302) && this._options.method === "POST" || // RFC7231§6.4.4: The 303 (See Other) status code indicates that
    // the server is redirecting the user agent to a different resource […]
    // A user agent can perform a retrieval request targeting that URI
    // (a GET or HEAD request if using HTTP) […]
    statusCode === 303 && !/^(?:GET|HEAD)$/.test(this._options.method)) {
        this._options.method = "GET";
        // Drop a possible entity and headers related to it
        this._requestBodyBuffers = [];
        removeMatchingHeaders(/^content-/i, this._options.headers);
    }
    // Drop the Host header, as the redirect might lead to a different host
    var currentHostHeader = removeMatchingHeaders(/^host$/i, this._options.headers);
    // If the redirect is relative, carry over the host of the last request
    var currentUrlParts = parseUrl(this._currentUrl);
    var currentHost = currentHostHeader || currentUrlParts.host;
    var currentUrl = /^\w+:/.test(location) ? this._currentUrl : url.format(Object.assign(currentUrlParts, {
        host: currentHost
    }));
    // Create the redirected request
    var redirectUrl = resolveUrl(location, currentUrl);
    debug("redirecting to", redirectUrl.href);
    this._isRedirect = true;
    spreadUrlObject(redirectUrl, this._options);
    // Drop confidential headers when redirecting to a less secure protocol
    // or to a different domain that is not a superdomain
    if (redirectUrl.protocol !== currentUrlParts.protocol && redirectUrl.protocol !== "https:" || redirectUrl.host !== currentHost && !isSubdomain(redirectUrl.host, currentHost)) {
        removeMatchingHeaders(/^(?:(?:proxy-)?authorization|cookie)$/i, this._options.headers);
    }
    // Evaluate the beforeRedirect callback
    if (isFunction(beforeRedirect)) {
        var responseDetails = {
            headers: response.headers,
            statusCode: statusCode
        };
        var requestDetails = {
            url: currentUrl,
            method: method,
            headers: requestHeaders
        };
        beforeRedirect(this._options, responseDetails, requestDetails);
        this._sanitizeOptions(this._options);
    }
    // Perform the redirected request
    this._performRequest();
};
// Wraps the key/value object of protocols with redirect functionality
function wrap(protocols) {
    // Default settings
    var exports = {
        maxRedirects: 21,
        maxBodyLength: 10 * 1024 * 1024
    };
    // Wrap each protocol
    var nativeProtocols = {};
    Object.keys(protocols).forEach(function(scheme) {
        var protocol = scheme + ":";
        var nativeProtocol = nativeProtocols[protocol] = protocols[scheme];
        var wrappedProtocol = exports[scheme] = Object.create(nativeProtocol);
        // Executes a request, following redirects
        function request(input, options, callback) {
            // Parse parameters, ensuring that input is an object
            if (isURL(input)) {
                input = spreadUrlObject(input);
            } else if (isString(input)) {
                input = spreadUrlObject(parseUrl(input));
            } else {
                callback = options;
                options = validateUrl(input);
                input = {
                    protocol: protocol
                };
            }
            if (isFunction(options)) {
                callback = options;
                options = null;
            }
            // Set defaults
            options = Object.assign({
                maxRedirects: exports.maxRedirects,
                maxBodyLength: exports.maxBodyLength
            }, input, options);
            options.nativeProtocols = nativeProtocols;
            if (!isString(options.host) && !isString(options.hostname)) {
                options.hostname = "::1";
            }
            assert.equal(options.protocol, protocol, "protocol mismatch");
            debug("options", options);
            return new RedirectableRequest(options, callback);
        }
        // Executes a GET request, following redirects
        function get(input, options, callback) {
            var wrappedRequest = wrappedProtocol.request(input, options, callback);
            wrappedRequest.end();
            return wrappedRequest;
        }
        // Expose the properties on the wrapped protocol
        Object.defineProperties(wrappedProtocol, {
            request: {
                value: request,
                configurable: true,
                enumerable: true,
                writable: true
            },
            get: {
                value: get,
                configurable: true,
                enumerable: true,
                writable: true
            }
        });
    });
    return exports;
}
function noop() {}
function parseUrl(input) {
    var parsed;
    // istanbul ignore else
    if (useNativeURL) {
        parsed = new URL(input);
    } else {
        // Ensure the URL is valid and absolute
        parsed = validateUrl(url.parse(input));
        if (!isString(parsed.protocol)) {
            throw new InvalidUrlError({
                input
            });
        }
    }
    return parsed;
}
function resolveUrl(relative, base) {
    // istanbul ignore next
    return useNativeURL ? new URL(relative, base) : parseUrl(url.resolve(base, relative));
}
function validateUrl(input) {
    if (/^\[/.test(input.hostname) && !/^\[[:0-9a-f]+\]$/i.test(input.hostname)) {
        throw new InvalidUrlError({
            input: input.href || input
        });
    }
    if (/^\[/.test(input.host) && !/^\[[:0-9a-f]+\](:\d+)?$/i.test(input.host)) {
        throw new InvalidUrlError({
            input: input.href || input
        });
    }
    return input;
}
function spreadUrlObject(urlObject, target) {
    var spread = target || {};
    for (var key of preservedUrlFields){
        spread[key] = urlObject[key];
    }
    // Fix IPv6 hostname
    if (spread.hostname.startsWith("[")) {
        spread.hostname = spread.hostname.slice(1, -1);
    }
    // Ensure port is a number
    if (spread.port !== "") {
        spread.port = Number(spread.port);
    }
    // Concatenate path
    spread.path = spread.search ? spread.pathname + spread.search : spread.pathname;
    return spread;
}
function removeMatchingHeaders(regex, headers) {
    var lastValue;
    for(var header in headers){
        if (regex.test(header)) {
            lastValue = headers[header];
            delete headers[header];
        }
    }
    return lastValue === null || typeof lastValue === "undefined" ? undefined : String(lastValue).trim();
}
function createErrorType(code, message, baseClass) {
    // Create constructor
    function CustomError(properties) {
        // istanbul ignore else
        if (isFunction(Error.captureStackTrace)) {
            Error.captureStackTrace(this, this.constructor);
        }
        Object.assign(this, properties || {});
        this.code = code;
        this.message = this.cause ? message + ": " + this.cause.message : message;
    }
    // Attach constructor and set default properties
    CustomError.prototype = new (baseClass || Error)();
    Object.defineProperties(CustomError.prototype, {
        constructor: {
            value: CustomError,
            enumerable: false
        },
        name: {
            value: "Error [" + code + "]",
            enumerable: false
        }
    });
    return CustomError;
}
function destroyRequest(request, error) {
    for (var event of events){
        request.removeListener(event, eventHandlers[event]);
    }
    request.on("error", noop);
    request.destroy(error);
}
function isSubdomain(subdomain, domain) {
    assert(isString(subdomain) && isString(domain));
    var dot = subdomain.length - domain.length - 1;
    return dot > 0 && subdomain[dot] === "." && subdomain.endsWith(domain);
}
function isString(value) {
    return typeof value === "string" || value instanceof String;
}
function isFunction(value) {
    return typeof value === "function";
}
function isBuffer(value) {
    return typeof value === "object" && "length" in value;
}
function isURL(value) {
    return URL && value instanceof URL;
}
// Exports
module.exports = wrap({
    http: http,
    https: https
});
module.exports.wrap = wrap;
}),
"[externals]/@prisma/client [external] (@prisma/client, cjs, [project]/node_modules/@prisma/client)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("@prisma/client-2c3a283f134fdcb6", () => require("@prisma/client-2c3a283f134fdcb6"));

module.exports = mod;
}),
"[project]/node_modules/@clerk/shared/dist/runtime/runtimeEnvironment-BB2sO-19.mjs [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "isDevelopmentEnvironment",
    ()=>isDevelopmentEnvironment,
    "isProductionEnvironment",
    ()=>isProductionEnvironment,
    "isTestEnvironment",
    ()=>isTestEnvironment
]);
//#region src/utils/runtimeEnvironment.ts
const isDevelopmentEnvironment = ()=>{
    try {
        return ("TURBOPACK compile-time value", "development") === "development";
    } catch  {}
    return false;
};
const isTestEnvironment = ()=>{
    try {
        return ("TURBOPACK compile-time value", "development") === "test";
    } catch  {}
    return false;
};
const isProductionEnvironment = ()=>{
    try {
        return ("TURBOPACK compile-time value", "development") === "production";
    } catch  {}
    return false;
};
;
 //# sourceMappingURL=runtimeEnvironment-BB2sO-19.mjs.map
}),
"[project]/node_modules/@clerk/shared/dist/runtime/deprecated-BqlFbLHj.mjs [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "deprecated",
    ()=>deprecated,
    "deprecatedObjectProperty",
    ()=>deprecatedObjectProperty,
    "deprecatedProperty",
    ()=>deprecatedProperty
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$runtimeEnvironment$2d$BB2sO$2d$19$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@clerk/shared/dist/runtime/runtimeEnvironment-BB2sO-19.mjs [app-route] (ecmascript)");
;
//#region src/deprecated.ts
/**
* Mark class method / function as deprecated.
*
* A console WARNING will be displayed when class method / function is invoked.
*
* Examples
* 1. Deprecate class method
* class Example {
*   getSomething = (arg1, arg2) => {
*       deprecated('Example.getSomething', 'Use `getSomethingElse` instead.');
*       return `getSomethingValue:${arg1 || '-'}:${arg2 || '-'}`;
*   };
* }
*
* 2. Deprecate function
* const getSomething = () => {
*   deprecated('getSomething', 'Use `getSomethingElse` instead.');
*   return 'getSomethingValue';
* };
*/ const displayedWarnings = /* @__PURE__ */ new Set();
const deprecated = (fnName, warning, key)=>{
    const hideWarning = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$runtimeEnvironment$2d$BB2sO$2d$19$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["isTestEnvironment"])() || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$runtimeEnvironment$2d$BB2sO$2d$19$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["isProductionEnvironment"])();
    const messageId = key ?? fnName;
    if (displayedWarnings.has(messageId) || hideWarning) return;
    displayedWarnings.add(messageId);
    console.warn(`Clerk - DEPRECATION WARNING: "${fnName}" is deprecated and will be removed in the next major release.\n${warning}`);
};
const deprecatedProperty = (cls, propName, warning, isStatic = false)=>{
    const target = isStatic ? cls : cls.prototype;
    let value = target[propName];
    Object.defineProperty(target, propName, {
        get () {
            deprecated(propName, warning, `${cls.name}:${propName}`);
            return value;
        },
        set (v) {
            value = v;
        }
    });
};
/**
* Mark object property as deprecated.
*
* A console WARNING will be displayed when object property is being accessed.
*
* 1. Deprecate object property
* const obj = { something: 'aloha' };
*
* deprecatedObjectProperty(obj, 'something', 'Use `somethingElse` instead.');
*/ const deprecatedObjectProperty = (obj, propName, warning, key)=>{
    let value = obj[propName];
    Object.defineProperty(obj, propName, {
        get () {
            deprecated(propName, warning, key);
            return value;
        },
        set (v) {
            value = v;
        }
    });
};
;
 //# sourceMappingURL=deprecated-BqlFbLHj.mjs.map
}),
"[project]/node_modules/@clerk/shared/dist/runtime/deprecated.mjs [app-route] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$runtimeEnvironment$2d$BB2sO$2d$19$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@clerk/shared/dist/runtime/runtimeEnvironment-BB2sO-19.mjs [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$deprecated$2d$BqlFbLHj$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@clerk/shared/dist/runtime/deprecated-BqlFbLHj.mjs [app-route] (ecmascript)");
;
;
;
}),
"[project]/node_modules/@clerk/shared/dist/runtime/constants-ByUssRbE.mjs [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "CURRENT_DEV_INSTANCE_SUFFIXES",
    ()=>CURRENT_DEV_INSTANCE_SUFFIXES,
    "DEV_OR_STAGING_SUFFIXES",
    ()=>DEV_OR_STAGING_SUFFIXES,
    "LEGACY_DEV_INSTANCE_SUFFIXES",
    ()=>LEGACY_DEV_INSTANCE_SUFFIXES,
    "LOCAL_API_URL",
    ()=>LOCAL_API_URL,
    "LOCAL_ENV_SUFFIXES",
    ()=>LOCAL_ENV_SUFFIXES,
    "PROD_API_URL",
    ()=>PROD_API_URL,
    "STAGING_API_URL",
    ()=>STAGING_API_URL,
    "STAGING_ENV_SUFFIXES",
    ()=>STAGING_ENV_SUFFIXES,
    "iconImageUrl",
    ()=>iconImageUrl
]);
//#region src/constants.ts
const LEGACY_DEV_INSTANCE_SUFFIXES = [
    ".lcl.dev",
    ".lclstage.dev",
    ".lclclerk.com"
];
const CURRENT_DEV_INSTANCE_SUFFIXES = [
    ".accounts.dev",
    ".accountsstage.dev",
    ".accounts.lclclerk.com"
];
const DEV_OR_STAGING_SUFFIXES = [
    ".lcl.dev",
    ".stg.dev",
    ".lclstage.dev",
    ".stgstage.dev",
    ".dev.lclclerk.com",
    ".stg.lclclerk.com",
    ".accounts.lclclerk.com",
    "accountsstage.dev",
    "accounts.dev"
];
const LOCAL_ENV_SUFFIXES = [
    ".lcl.dev",
    "lclstage.dev",
    ".lclclerk.com",
    ".accounts.lclclerk.com"
];
const STAGING_ENV_SUFFIXES = [
    ".accountsstage.dev"
];
const LOCAL_API_URL = "https://api.lclclerk.com";
const STAGING_API_URL = "https://api.clerkstage.dev";
const PROD_API_URL = "https://api.clerk.com";
/**
* Returns the URL for a static image
* using the new img.clerk.com service
*/ function iconImageUrl(id, format = "svg") {
    return `https://img.clerk.com/static/${id}.${format}`;
}
;
 //# sourceMappingURL=constants-ByUssRbE.mjs.map
}),
"[project]/node_modules/@clerk/shared/dist/runtime/isomorphicAtob-DybBXGFR.mjs [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "isomorphicAtob",
    ()=>isomorphicAtob
]);
//#region src/isomorphicAtob.ts
/**
* A function that decodes a string of data which has been encoded using base-64 encoding.
* Uses `atob` if available, otherwise uses `Buffer` from `global`. If neither are available, returns the data as-is.
*/ const isomorphicAtob = (data)=>{
    if (typeof atob !== "undefined" && typeof atob === "function") return atob(data);
    else if (("TURBOPACK compile-time value", "object") !== "undefined" && /*TURBOPACK member replacement*/ __turbopack_context__.g.Buffer) return new /*TURBOPACK member replacement*/ __turbopack_context__.g.Buffer(data, "base64").toString();
    return data;
};
;
 //# sourceMappingURL=isomorphicAtob-DybBXGFR.mjs.map
}),
"[project]/node_modules/@clerk/shared/dist/runtime/isomorphicBtoa-Dr7WubZv.mjs [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "isomorphicBtoa",
    ()=>isomorphicBtoa
]);
//#region src/isomorphicBtoa.ts
const isomorphicBtoa = (data)=>{
    if (typeof btoa !== "undefined" && typeof btoa === "function") return btoa(data);
    else if (("TURBOPACK compile-time value", "object") !== "undefined" && /*TURBOPACK member replacement*/ __turbopack_context__.g.Buffer) return new /*TURBOPACK member replacement*/ __turbopack_context__.g.Buffer(data).toString("base64");
    return data;
};
;
 //# sourceMappingURL=isomorphicBtoa-Dr7WubZv.mjs.map
}),
"[project]/node_modules/@clerk/shared/dist/runtime/keys-YNv6yjKk.mjs [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "buildPublishableKey",
    ()=>buildPublishableKey,
    "createDevOrStagingUrlCache",
    ()=>createDevOrStagingUrlCache,
    "getCookieSuffix",
    ()=>getCookieSuffix,
    "getSuffixedCookieName",
    ()=>getSuffixedCookieName,
    "isDevelopmentFromPublishableKey",
    ()=>isDevelopmentFromPublishableKey,
    "isDevelopmentFromSecretKey",
    ()=>isDevelopmentFromSecretKey,
    "isProductionFromPublishableKey",
    ()=>isProductionFromPublishableKey,
    "isProductionFromSecretKey",
    ()=>isProductionFromSecretKey,
    "isPublishableKey",
    ()=>isPublishableKey,
    "parsePublishableKey",
    ()=>parsePublishableKey
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$constants$2d$ByUssRbE$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@clerk/shared/dist/runtime/constants-ByUssRbE.mjs [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$isomorphicAtob$2d$DybBXGFR$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@clerk/shared/dist/runtime/isomorphicAtob-DybBXGFR.mjs [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$isomorphicBtoa$2d$Dr7WubZv$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@clerk/shared/dist/runtime/isomorphicBtoa-Dr7WubZv.mjs [app-route] (ecmascript)");
;
;
;
//#region src/keys.ts
/** Prefix used for production publishable keys */ const PUBLISHABLE_KEY_LIVE_PREFIX = "pk_live_";
/** Prefix used for development publishable keys */ const PUBLISHABLE_KEY_TEST_PREFIX = "pk_test_";
/**
* Regular expression that matches development frontend API keys.
* Matches patterns like: foo-bar-13.clerk.accounts.dev.
*/ const PUBLISHABLE_FRONTEND_API_DEV_REGEX = /^(([a-z]+)-){2}([0-9]{1,2})\.clerk\.accounts([a-z.]*)(dev|com)$/i;
/**
* Converts a frontend API URL into a base64-encoded publishable key.
*
* @param frontendApi - The frontend API URL (e.g., 'clerk.example.com').
* @returns A base64-encoded publishable key with appropriate prefix (pk_live_ or pk_test_).
*/ function buildPublishableKey(frontendApi) {
    return `${PUBLISHABLE_FRONTEND_API_DEV_REGEX.test(frontendApi) || frontendApi.startsWith("clerk.") && __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$constants$2d$ByUssRbE$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["LEGACY_DEV_INSTANCE_SUFFIXES"].some((s)=>frontendApi.endsWith(s)) ? PUBLISHABLE_KEY_TEST_PREFIX : PUBLISHABLE_KEY_LIVE_PREFIX}${(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$isomorphicBtoa$2d$Dr7WubZv$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["isomorphicBtoa"])(`${frontendApi}$`)}`;
}
/**
* Validates that a decoded publishable key has the correct format.
* The decoded value should be a frontend API followed by exactly one '$' at the end.
*
* @param decoded - The decoded publishable key string to validate.
* @returns `true` if the decoded key has valid format, `false` otherwise.
*/ function isValidDecodedPublishableKey(decoded) {
    if (!decoded.endsWith("$")) return false;
    const withoutTrailing = decoded.slice(0, -1);
    if (withoutTrailing.includes("$")) return false;
    return withoutTrailing.includes(".");
}
/**
* Parses and validates a publishable key, extracting the frontend API and instance type.
*
* @param key - The publishable key to parse.
* @param options - Configuration options for parsing.
* @param options.fatal
* @param options.domain
* @param options.proxyUrl
* @param options.isSatellite
* @returns Parsed publishable key object with instanceType and frontendApi, or null if invalid.
*
* @throws {Error} When options.fatal is true and key is missing or invalid.
*/ function parsePublishableKey(key, options = {}) {
    key = key || "";
    if (!key || !isPublishableKey(key)) {
        if (options.fatal && !key) throw new Error("Publishable key is missing. Ensure that your publishable key is correctly configured. Double-check your environment configuration for your keys, or access them here: https://dashboard.clerk.com/last-active?path=api-keys");
        if (options.fatal && !isPublishableKey(key)) throw new Error("Publishable key not valid.");
        return null;
    }
    const instanceType = key.startsWith(PUBLISHABLE_KEY_LIVE_PREFIX) ? "production" : "development";
    let decodedFrontendApi;
    try {
        decodedFrontendApi = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$isomorphicAtob$2d$DybBXGFR$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["isomorphicAtob"])(key.split("_")[2]);
    } catch  {
        if (options.fatal) throw new Error("Publishable key not valid: Failed to decode key.");
        return null;
    }
    if (!isValidDecodedPublishableKey(decodedFrontendApi)) {
        if (options.fatal) throw new Error("Publishable key not valid: Decoded key has invalid format.");
        return null;
    }
    let frontendApi = decodedFrontendApi.slice(0, -1);
    if (options.proxyUrl) frontendApi = options.proxyUrl;
    else if (instanceType !== "development" && options.domain && options.isSatellite) frontendApi = `clerk.${options.domain}`;
    return {
        instanceType,
        frontendApi
    };
}
/**
* Checks if the provided key is a valid publishable key.
*
* @param key - The key to be checked. Defaults to an empty string if not provided.
* @returns `true` if 'key' is a valid publishable key, `false` otherwise.
*/ function isPublishableKey(key = "") {
    try {
        if (!(key.startsWith(PUBLISHABLE_KEY_LIVE_PREFIX) || key.startsWith(PUBLISHABLE_KEY_TEST_PREFIX))) return false;
        const parts = key.split("_");
        if (parts.length !== 3) return false;
        const encodedPart = parts[2];
        if (!encodedPart) return false;
        return isValidDecodedPublishableKey((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$isomorphicAtob$2d$DybBXGFR$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["isomorphicAtob"])(encodedPart));
    } catch  {
        return false;
    }
}
/**
* Creates a memoized cache for checking if URLs are development or staging environments.
* Uses a Map to cache results for better performance on repeated checks.
*
* @returns An object with an isDevOrStagingUrl method that checks if a URL is dev/staging.
*/ function createDevOrStagingUrlCache() {
    const devOrStagingUrlCache = /* @__PURE__ */ new Map();
    return {
        isDevOrStagingUrl: (url)=>{
            if (!url) return false;
            const hostname = typeof url === "string" ? url : url.hostname;
            let res = devOrStagingUrlCache.get(hostname);
            if (res === void 0) {
                res = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$constants$2d$ByUssRbE$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["DEV_OR_STAGING_SUFFIXES"].some((s)=>hostname.endsWith(s));
                devOrStagingUrlCache.set(hostname, res);
            }
            return res;
        }
    };
}
/**
* Checks if a publishable key is for a development environment.
* Supports both legacy format (test_) and new format (pk_test_).
*
* @param apiKey - The API key to check.
* @returns `true` if the key is for development, `false` otherwise.
*/ function isDevelopmentFromPublishableKey(apiKey) {
    return apiKey.startsWith("test_") || apiKey.startsWith("pk_test_");
}
/**
* Checks if a publishable key is for a production environment.
* Supports both legacy format (live_) and new format (pk_live_).
*
* @param apiKey - The API key to check.
* @returns `true` if the key is for production, `false` otherwise.
*/ function isProductionFromPublishableKey(apiKey) {
    return apiKey.startsWith("live_") || apiKey.startsWith("pk_live_");
}
/**
* Checks if a secret key is for a development environment.
* Supports both legacy format (test_) and new format (sk_test_).
*
* @param apiKey - The secret key to check.
* @returns `true` if the key is for development, `false` otherwise.
*/ function isDevelopmentFromSecretKey(apiKey) {
    return apiKey.startsWith("test_") || apiKey.startsWith("sk_test_");
}
/**
* Checks if a secret key is for a production environment.
* Supports both legacy format (live_) and new format (sk_live_).
*
* @param apiKey - The secret key to check.
* @returns `true` if the key is for production, `false` otherwise.
*/ function isProductionFromSecretKey(apiKey) {
    return apiKey.startsWith("live_") || apiKey.startsWith("sk_live_");
}
/**
* Generates a unique cookie suffix based on the publishable key using SHA-1 hashing.
* The suffix is base64-encoded and URL-safe (+ and / characters are replaced).
*
* @param publishableKey - The publishable key to generate suffix from.
* @param subtle - The SubtleCrypto interface to use for hashing (defaults to globalThis.crypto.subtle).
* @returns A promise that resolves to an 8-character URL-safe base64 string.
*/ async function getCookieSuffix(publishableKey, subtle = globalThis.crypto.subtle) {
    const data = new TextEncoder().encode(publishableKey);
    const digest = await subtle.digest("sha-1", data);
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$isomorphicBtoa$2d$Dr7WubZv$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["isomorphicBtoa"])(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/gi, "-").replace(/\//gi, "_").substring(0, 8);
}
/**
* Creates a suffixed cookie name by appending the cookie suffix to the base name.
* Used to create unique cookie names based on the publishable key.
*
* @param cookieName - The base cookie name.
* @param cookieSuffix - The suffix to append (typically generated by getCookieSuffix).
* @returns The suffixed cookie name in format: `${cookieName}_${cookieSuffix}`.
*/ const getSuffixedCookieName = (cookieName, cookieSuffix)=>{
    return `${cookieName}_${cookieSuffix}`;
};
;
 //# sourceMappingURL=keys-YNv6yjKk.mjs.map
}),
"[project]/node_modules/@clerk/shared/dist/runtime/keys.mjs [app-route] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$constants$2d$ByUssRbE$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@clerk/shared/dist/runtime/constants-ByUssRbE.mjs [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$isomorphicAtob$2d$DybBXGFR$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@clerk/shared/dist/runtime/isomorphicAtob-DybBXGFR.mjs [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$isomorphicBtoa$2d$Dr7WubZv$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@clerk/shared/dist/runtime/isomorphicBtoa-Dr7WubZv.mjs [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$keys$2d$YNv6yjKk$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@clerk/shared/dist/runtime/keys-YNv6yjKk.mjs [app-route] (ecmascript)");
;
;
;
;
;
}),
"[project]/node_modules/@clerk/shared/dist/runtime/retry-DAlTROH9.mjs [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "retry",
    ()=>retry
]);
//#region src/retry.ts
const defaultOptions = {
    initialDelay: 125,
    maxDelayBetweenRetries: 0,
    factor: 2,
    shouldRetry: (_, iteration)=>iteration < 5,
    retryImmediately: false,
    jitter: true
};
const RETRY_IMMEDIATELY_DELAY = 100;
const sleep = async (ms)=>new Promise((s)=>setTimeout(s, ms));
const applyJitter = (delay, jitter)=>{
    return jitter ? delay * (1 + Math.random()) : delay;
};
const createExponentialDelayAsyncFn = (opts)=>{
    let timesCalled = 0;
    const calculateDelayInMs = ()=>{
        const constant = opts.initialDelay;
        const base = opts.factor;
        let delay = constant * Math.pow(base, timesCalled);
        delay = applyJitter(delay, opts.jitter);
        return Math.min(opts.maxDelayBetweenRetries || delay, delay);
    };
    return async ()=>{
        await sleep(calculateDelayInMs());
        timesCalled++;
    };
};
/**
* Retries a callback until it succeeds or the shouldRetry function returns false.
* See {@link RetryOptions} for the available options.
*/ const retry = async (callback, options = {})=>{
    let iterations = 0;
    const { shouldRetry, initialDelay, maxDelayBetweenRetries, factor, retryImmediately, jitter, onBeforeRetry } = {
        ...defaultOptions,
        ...options
    };
    const delay = createExponentialDelayAsyncFn({
        initialDelay,
        maxDelayBetweenRetries,
        factor,
        jitter
    });
    while(true)try {
        return await callback();
    } catch (e) {
        iterations++;
        if (!shouldRetry(e, iterations)) throw e;
        if (onBeforeRetry) await onBeforeRetry(iterations);
        if (retryImmediately && iterations === 1) await sleep(applyJitter(RETRY_IMMEDIATELY_DELAY, jitter));
        else await delay();
    }
};
;
 //# sourceMappingURL=retry-DAlTROH9.mjs.map
}),
"[project]/node_modules/@clerk/shared/dist/runtime/retry.mjs [app-route] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$retry$2d$DAlTROH9$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@clerk/shared/dist/runtime/retry-DAlTROH9.mjs [app-route] (ecmascript)");
;
;
}),
"[project]/node_modules/@clerk/shared/dist/runtime/instance-Cze6Nv61.mjs [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "isStaging",
    ()=>isStaging
]);
//#region src/utils/instance.ts
/**
* Check if the frontendApi ends with a staging domain
*/ function isStaging(frontendApi) {
    return frontendApi.endsWith(".lclstage.dev") || frontendApi.endsWith(".stgstage.dev") || frontendApi.endsWith(".clerkstage.dev") || frontendApi.endsWith(".accountsstage.dev");
}
;
 //# sourceMappingURL=instance-Cze6Nv61.mjs.map
}),
"[project]/node_modules/@clerk/shared/dist/runtime/url-Cdy8w8vK.mjs [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "addClerkPrefix",
    ()=>addClerkPrefix,
    "cleanDoubleSlashes",
    ()=>cleanDoubleSlashes,
    "getClerkJsMajorVersionOrTag",
    ()=>getClerkJsMajorVersionOrTag,
    "getScriptUrl",
    ()=>getScriptUrl,
    "hasLeadingSlash",
    ()=>hasLeadingSlash,
    "hasTrailingSlash",
    ()=>hasTrailingSlash,
    "isAbsoluteUrl",
    ()=>isAbsoluteUrl,
    "isCurrentDevAccountPortalOrigin",
    ()=>isCurrentDevAccountPortalOrigin,
    "isLegacyDevAccountPortalOrigin",
    ()=>isLegacyDevAccountPortalOrigin,
    "isNonEmptyURL",
    ()=>isNonEmptyURL,
    "joinURL",
    ()=>joinURL,
    "parseSearchParams",
    ()=>parseSearchParams,
    "stripScheme",
    ()=>stripScheme,
    "withLeadingSlash",
    ()=>withLeadingSlash,
    "withTrailingSlash",
    ()=>withTrailingSlash,
    "withoutLeadingSlash",
    ()=>withoutLeadingSlash,
    "withoutTrailingSlash",
    ()=>withoutTrailingSlash
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$constants$2d$ByUssRbE$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@clerk/shared/dist/runtime/constants-ByUssRbE.mjs [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$instance$2d$Cze6Nv61$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@clerk/shared/dist/runtime/instance-Cze6Nv61.mjs [app-route] (ecmascript)");
;
;
//#region src/url.ts
function parseSearchParams(queryString = "") {
    if (queryString.startsWith("?")) queryString = queryString.slice(1);
    return new URLSearchParams(queryString);
}
function stripScheme(url = "") {
    return (url || "").replace(/^.+:\/\//, "");
}
function addClerkPrefix(str) {
    if (!str) return "";
    let regex;
    if (str.match(/^(clerk\.)+\w*$/)) regex = /(clerk\.)*(?=clerk\.)/;
    else if (str.match(/\.clerk.accounts/)) return str;
    else regex = /^(clerk\.)*/gi;
    return `clerk.${str.replace(regex, "")}`;
}
/**
*
* Retrieve the clerk-js major tag using the major version from the pkgVersion
* param or use the frontendApi to determine if the canary tag should be used.
* The default tag is `latest`.
*/ const getClerkJsMajorVersionOrTag = (frontendApi, version)=>{
    if (!version && (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$instance$2d$Cze6Nv61$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["isStaging"])(frontendApi)) return "canary";
    if (!version) return "latest";
    return version.split(".")[0] || "latest";
};
/**
*
* Retrieve the clerk-js script url from the frontendApi and the major tag
* using the {@link getClerkJsMajorVersionOrTag} or a provided clerkJSVersion tag.
*/ const getScriptUrl = (frontendApi, { clerkJSVersion })=>{
    const noSchemeFrontendApi = frontendApi.replace(/http(s)?:\/\//, "");
    const major = getClerkJsMajorVersionOrTag(frontendApi, clerkJSVersion);
    return `https://${noSchemeFrontendApi}/npm/@clerk/clerk-js@${clerkJSVersion || major}/dist/clerk.browser.js`;
};
function isLegacyDevAccountPortalOrigin(host) {
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$constants$2d$ByUssRbE$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["LEGACY_DEV_INSTANCE_SUFFIXES"].some((legacyDevSuffix)=>{
        return host.startsWith("accounts.") && host.endsWith(legacyDevSuffix);
    });
}
function isCurrentDevAccountPortalOrigin(host) {
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$constants$2d$ByUssRbE$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["CURRENT_DEV_INSTANCE_SUFFIXES"].some((currentDevSuffix)=>{
        return host.endsWith(currentDevSuffix) && !host.endsWith(".clerk" + currentDevSuffix);
    });
}
const TRAILING_SLASH_RE = /\/$|\/\?|\/#/;
function hasTrailingSlash(input = "", respectQueryAndFragment) {
    if (!respectQueryAndFragment) return input.endsWith("/");
    return TRAILING_SLASH_RE.test(input);
}
function withTrailingSlash(input = "", respectQueryAndFragment) {
    if (!respectQueryAndFragment) return input.endsWith("/") ? input : input + "/";
    if (hasTrailingSlash(input, true)) return input || "/";
    let path = input;
    let fragment = "";
    const fragmentIndex = input.indexOf("#");
    if (fragmentIndex >= 0) {
        path = input.slice(0, fragmentIndex);
        fragment = input.slice(fragmentIndex);
        if (!path) return fragment;
    }
    const [s0, ...s] = path.split("?");
    return s0 + "/" + (s.length > 0 ? `?${s.join("?")}` : "") + fragment;
}
function withoutTrailingSlash(input = "", respectQueryAndFragment) {
    if (!respectQueryAndFragment) return (hasTrailingSlash(input) ? input.slice(0, -1) : input) || "/";
    if (!hasTrailingSlash(input, true)) return input || "/";
    let path = input;
    let fragment = "";
    const fragmentIndex = input.indexOf("#");
    if (fragmentIndex >= 0) {
        path = input.slice(0, fragmentIndex);
        fragment = input.slice(fragmentIndex);
    }
    const [s0, ...s] = path.split("?");
    return (s0.slice(0, -1) || "/") + (s.length > 0 ? `?${s.join("?")}` : "") + fragment;
}
function hasLeadingSlash(input = "") {
    return input.startsWith("/");
}
function withoutLeadingSlash(input = "") {
    return (hasLeadingSlash(input) ? input.slice(1) : input) || "/";
}
function withLeadingSlash(input = "") {
    return hasLeadingSlash(input) ? input : "/" + input;
}
function cleanDoubleSlashes(input = "") {
    return input.split("://").map((string_)=>string_.replace(/\/{2,}/g, "/")).join("://");
}
function isNonEmptyURL(url) {
    return url && url !== "/";
}
const JOIN_LEADING_SLASH_RE = /^\.?\//;
function joinURL(base, ...input) {
    let url = base || "";
    for (const segment of input.filter((url$1)=>isNonEmptyURL(url$1)))if (url) {
        const _segment = segment.replace(JOIN_LEADING_SLASH_RE, "");
        url = withTrailingSlash(url) + _segment;
    } else url = segment;
    return url;
}
const ABSOLUTE_URL_REGEX = /^[a-zA-Z][a-zA-Z\d+\-.]*?:/;
const isAbsoluteUrl = (url)=>ABSOLUTE_URL_REGEX.test(url);
;
 //# sourceMappingURL=url-Cdy8w8vK.mjs.map
}),
"[project]/node_modules/@clerk/shared/dist/runtime/url.mjs [app-route] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$constants$2d$ByUssRbE$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@clerk/shared/dist/runtime/constants-ByUssRbE.mjs [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$instance$2d$Cze6Nv61$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@clerk/shared/dist/runtime/instance-Cze6Nv61.mjs [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$url$2d$Cdy8w8vK$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@clerk/shared/dist/runtime/url-Cdy8w8vK.mjs [app-route] (ecmascript)");
;
;
;
;
}),
"[project]/node_modules/@clerk/shared/dist/runtime/error-Dl9xmUf3.mjs [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ClerkAPIError",
    ()=>ClerkAPIError,
    "ClerkAPIResponseError",
    ()=>ClerkAPIResponseError,
    "ClerkError",
    ()=>ClerkError,
    "ClerkRuntimeError",
    ()=>ClerkRuntimeError,
    "ClerkWebAuthnError",
    ()=>ClerkWebAuthnError,
    "EmailLinkError",
    ()=>EmailLinkError,
    "EmailLinkErrorCode",
    ()=>EmailLinkErrorCode,
    "EmailLinkErrorCodeStatus",
    ()=>EmailLinkErrorCodeStatus,
    "MissingExpiredTokenError",
    ()=>MissingExpiredTokenError,
    "buildErrorThrower",
    ()=>buildErrorThrower,
    "createClerkGlobalHookError",
    ()=>createClerkGlobalHookError,
    "errorToJSON",
    ()=>errorToJSON,
    "is4xxError",
    ()=>is4xxError,
    "isCaptchaError",
    ()=>isCaptchaError,
    "isClerkAPIError",
    ()=>isClerkAPIError,
    "isClerkAPIResponseError",
    ()=>isClerkAPIResponseError,
    "isClerkError",
    ()=>isClerkError,
    "isClerkRuntimeError",
    ()=>isClerkRuntimeError,
    "isEmailLinkError",
    ()=>isEmailLinkError,
    "isKnownError",
    ()=>isKnownError,
    "isMetamaskError",
    ()=>isMetamaskError,
    "isNetworkError",
    ()=>isNetworkError,
    "isPasswordCompromisedError",
    ()=>isPasswordCompromisedError,
    "isPasswordPwnedError",
    ()=>isPasswordPwnedError,
    "isReverificationCancelledError",
    ()=>isReverificationCancelledError,
    "isUnauthorizedError",
    ()=>isUnauthorizedError,
    "isUserLockedError",
    ()=>isUserLockedError,
    "parseError",
    ()=>parseError,
    "parseErrors",
    ()=>parseErrors
]);
//#region src/errors/createErrorTypeGuard.ts
/**
* Creates a type guard function for any error class.
* The returned function can be called as a standalone function or as a method on an error object.
*
* @example
* ```typescript
* class MyError extends Error {}
* const isMyError = createErrorTypeGuard(MyError);
*
* // As a standalone function
* if (isMyError(error)) { ... }
*
* // As a method (when attached to error object)
* if (error.isMyError()) { ... }
* ```
*/ function createErrorTypeGuard(ErrorClass) {
    function typeGuard(error) {
        const target = error ?? this;
        if (!target) throw new TypeError(`${ErrorClass.kind || ErrorClass.name} type guard requires an error object`);
        if (ErrorClass.kind && typeof target === "object" && target !== null && "constructor" in target) {
            if (target.constructor?.kind === ErrorClass.kind) return true;
        }
        return target instanceof ErrorClass;
    }
    return typeGuard;
}
//#endregion
//#region src/errors/clerkApiError.ts
/**
* This error contains the specific error message, code, and any additional metadata that was returned by the Clerk API.
*/ var ClerkAPIError = class {
    static kind = "ClerkApiError";
    code;
    message;
    longMessage;
    meta;
    constructor(json){
        const parsedError = {
            code: json.code,
            message: json.message,
            longMessage: json.long_message,
            meta: {
                paramName: json.meta?.param_name,
                sessionId: json.meta?.session_id,
                emailAddresses: json.meta?.email_addresses,
                identifiers: json.meta?.identifiers,
                zxcvbn: json.meta?.zxcvbn,
                plan: json.meta?.plan,
                isPlanUpgradePossible: json.meta?.is_plan_upgrade_possible
            }
        };
        this.code = parsedError.code;
        this.message = parsedError.message;
        this.longMessage = parsedError.longMessage;
        this.meta = parsedError.meta;
    }
};
/**
* Type guard to check if a value is a ClerkAPIError instance.
*/ const isClerkAPIError = createErrorTypeGuard(ClerkAPIError);
//#endregion
//#region src/errors/parseError.ts
/**
* Parses an array of ClerkAPIErrorJSON objects into an array of ClerkAPIError objects.
*
* @internal
*/ function parseErrors(data = []) {
    return data.length > 0 ? data.map((e)=>new ClerkAPIError(e)) : [];
}
/**
* Parses a ClerkAPIErrorJSON object into a ClerkAPIError object.
*
* @deprecated Use `ClerkAPIError` class instead
*
* @internal
*/ function parseError(error) {
    return new ClerkAPIError(error);
}
/**
* Converts a ClerkAPIError object into a ClerkAPIErrorJSON object.
*
* @internal
*/ function errorToJSON(error) {
    return {
        code: error?.code || "",
        message: error?.message || "",
        long_message: error?.longMessage,
        meta: {
            param_name: error?.meta?.paramName,
            session_id: error?.meta?.sessionId,
            email_addresses: error?.meta?.emailAddresses,
            identifiers: error?.meta?.identifiers,
            zxcvbn: error?.meta?.zxcvbn,
            plan: error?.meta?.plan,
            is_plan_upgrade_possible: error?.meta?.isPlanUpgradePossible
        }
    };
}
//#endregion
//#region src/errors/clerkError.ts
var ClerkError = class ClerkError extends Error {
    static kind = "ClerkError";
    clerkError = true;
    code;
    longMessage;
    docsUrl;
    cause;
    get name() {
        return this.constructor.name;
    }
    constructor(opts){
        super(new.target.formatMessage(new.target.kind, opts.message, opts.code, opts.docsUrl), {
            cause: opts.cause
        });
        Object.setPrototypeOf(this, ClerkError.prototype);
        this.code = opts.code;
        this.docsUrl = opts.docsUrl;
        this.longMessage = opts.longMessage;
        this.cause = opts.cause;
    }
    toString() {
        return `[${this.name}]\nMessage:${this.message}`;
    }
    static formatMessage(name, msg, code, docsUrl) {
        const prefix = "Clerk:";
        const regex = new RegExp(prefix.replace(" ", "\\s*"), "i");
        msg = msg.replace(regex, "");
        msg = `${prefix} ${msg.trim()}\n\n(code="${code}")\n\n`;
        if (docsUrl) msg += `\n\nDocs: ${docsUrl}`;
        return msg;
    }
};
/**
* Type guard to check if a value is a ClerkError instance.
*/ function isClerkError(val) {
    return createErrorTypeGuard(ClerkError)(val) || !!val && typeof val === "object" && "clerkError" in val && val.clerkError === true;
}
//#endregion
//#region src/errors/clerkApiResponseError.ts
var ClerkAPIResponseError = class ClerkAPIResponseError extends ClerkError {
    static kind = "ClerkAPIResponseError";
    status;
    clerkTraceId;
    retryAfter;
    errors;
    constructor(message, options){
        const { data: errorsJson, status, clerkTraceId, retryAfter } = options;
        super({
            ...options,
            message,
            code: "api_response_error"
        });
        Object.setPrototypeOf(this, ClerkAPIResponseError.prototype);
        this.status = status;
        this.clerkTraceId = clerkTraceId;
        this.retryAfter = retryAfter;
        this.errors = (errorsJson || []).map((e)=>new ClerkAPIError(e));
    }
    toString() {
        let message = `[${this.name}]\nMessage:${this.message}\nStatus:${this.status}\nSerialized errors: ${this.errors.map((e)=>JSON.stringify(e))}`;
        if (this.clerkTraceId) message += `\nClerk Trace ID: ${this.clerkTraceId}`;
        return message;
    }
    static formatMessage(name, msg, _, __) {
        return msg;
    }
};
/**
* Type guard to check if an error is a ClerkAPIResponseError.
* Can be called as a standalone function or as a method on an error object.
*
* @example
* // As a standalone function
* if (isClerkAPIResponseError(error)) { ... }
*
* // As a method (when attached to error object)
* if (error.isClerkAPIResponseError()) { ... }
*/ const isClerkAPIResponseError = createErrorTypeGuard(ClerkAPIResponseError);
//#endregion
//#region src/errors/missingExpiredTokenError.ts
/**
* Error class representing a missing expired token error from the API.
* This error occurs when the server requires an expired token to mint a new session token.
*
* Use the static `is` method to check if a ClerkAPIResponseError matches this error type.
*
* @example
* ```typescript
* if (MissingExpiredTokenError.is(error)) {
*   // Handle the missing expired token error
* }
* ```
*/ var MissingExpiredTokenError = class MissingExpiredTokenError extends ClerkAPIResponseError {
    static kind = "MissingExpiredTokenError";
    static ERROR_CODE = "missing_expired_token";
    static STATUS = 422;
    /**
	* Type guard to check if an error is a MissingExpiredTokenError.
	* This checks the error's properties (status and error code) rather than instanceof,
	* allowing it to work with ClerkAPIResponseError instances thrown from the API layer.
	*
	* @example
	* ```typescript
	* try {
	*   await someApiCall();
	* } catch (e) {
	*   if (MissingExpiredTokenError.is(e)) {
	*     // e is typed as ClerkAPIResponseError with the specific error properties
	*   }
	* }
	* ```
	*/ static is(err) {
        return isClerkAPIResponseError(err) && err.status === MissingExpiredTokenError.STATUS && err.errors.length > 0 && err.errors[0].code === MissingExpiredTokenError.ERROR_CODE;
    }
};
//#endregion
//#region src/errors/errorThrower.ts
const DefaultMessages = Object.freeze({
    InvalidProxyUrlErrorMessage: `The proxyUrl passed to Clerk is invalid. The expected value for proxyUrl is an absolute URL or a relative path with a leading '/'. (key={{url}})`,
    InvalidPublishableKeyErrorMessage: `The publishableKey passed to Clerk is invalid. You can get your Publishable key at https://dashboard.clerk.com/last-active?path=api-keys. (key={{key}})`,
    MissingPublishableKeyErrorMessage: `Missing publishableKey. You can get your key at https://dashboard.clerk.com/last-active?path=api-keys.`,
    MissingSecretKeyErrorMessage: `Missing secretKey. You can get your key at https://dashboard.clerk.com/last-active?path=api-keys.`,
    MissingClerkProvider: `{{source}} can only be used within the <ClerkProvider /> component. Learn more: https://clerk.com/docs/components/clerk-provider`
});
/**
* Builds an error thrower.
*
* @internal
*/ function buildErrorThrower({ packageName, customMessages }) {
    let pkg = packageName;
    /**
	* Builds a message from a raw message and replacements.
	*
	* @internal
	*/ function buildMessage(rawMessage, replacements) {
        if (!replacements) return `${pkg}: ${rawMessage}`;
        let msg = rawMessage;
        const matches = rawMessage.matchAll(/{{([a-zA-Z0-9-_]+)}}/g);
        for (const match of matches){
            const replacement = (replacements[match[1]] || "").toString();
            msg = msg.replace(`{{${match[1]}}}`, replacement);
        }
        return `${pkg}: ${msg}`;
    }
    const messages = {
        ...DefaultMessages,
        ...customMessages
    };
    return {
        setPackageName ({ packageName: packageName$1 }) {
            if (typeof packageName$1 === "string") pkg = packageName$1;
            return this;
        },
        setMessages ({ customMessages: customMessages$1 }) {
            Object.assign(messages, customMessages$1 || {});
            return this;
        },
        throwInvalidPublishableKeyError (params) {
            throw new Error(buildMessage(messages.InvalidPublishableKeyErrorMessage, params));
        },
        throwInvalidProxyUrl (params) {
            throw new Error(buildMessage(messages.InvalidProxyUrlErrorMessage, params));
        },
        throwMissingPublishableKeyError () {
            throw new Error(buildMessage(messages.MissingPublishableKeyErrorMessage));
        },
        throwMissingSecretKeyError () {
            throw new Error(buildMessage(messages.MissingSecretKeyErrorMessage));
        },
        throwMissingClerkProviderError (params) {
            throw new Error(buildMessage(messages.MissingClerkProvider, params));
        },
        throw (message) {
            throw new Error(buildMessage(message));
        }
    };
}
//#endregion
//#region src/errors/emailLinkError.ts
var EmailLinkError = class EmailLinkError extends Error {
    code;
    constructor(code){
        super(code);
        this.code = code;
        this.name = "EmailLinkError";
        Object.setPrototypeOf(this, EmailLinkError.prototype);
    }
};
/**
* @deprecated Use `EmailLinkErrorCodeStatus` instead.
*
* @internal
*/ const EmailLinkErrorCode = {
    Expired: "expired",
    Failed: "failed",
    ClientMismatch: "client_mismatch"
};
const EmailLinkErrorCodeStatus = {
    Expired: "expired",
    Failed: "failed",
    ClientMismatch: "client_mismatch"
};
//#endregion
//#region src/errors/clerkRuntimeError.ts
/**
* Custom error class for representing Clerk runtime errors.
*
* @class ClerkRuntimeError
*
* @example
*   throw new ClerkRuntimeError('An error occurred', { code: 'password_invalid' });
*/ var ClerkRuntimeError = class ClerkRuntimeError extends ClerkError {
    static kind = "ClerkRuntimeError";
    /**
	* @deprecated Use `clerkError` property instead. This property is maintained for backward compatibility.
	*/ clerkRuntimeError = true;
    constructor(message, options){
        super({
            ...options,
            message
        });
        Object.setPrototypeOf(this, ClerkRuntimeError.prototype);
    }
};
/**
* Type guard to check if an error is a ClerkRuntimeError.
* Can be called as a standalone function or as a method on an error object.
*
* @example
* // As a standalone function
* if (isClerkRuntimeError(error)) { ... }
*
* // As a method (when attached to error object)
* if (error.isClerkRuntimeError()) { ... }
*/ const isClerkRuntimeError = createErrorTypeGuard(ClerkRuntimeError);
//#endregion
//#region src/errors/webAuthNError.ts
var ClerkWebAuthnError = class extends ClerkRuntimeError {
    /**
	* A unique code identifying the error, can be used for localization.
	*/ code;
    constructor(message, { code }){
        super(message, {
            code
        });
        this.code = code;
    }
};
//#endregion
//#region src/errors/helpers.ts
/**
* Checks if the provided error object is an unauthorized error.
*
* @internal
*
* @deprecated This is no longer used, and will be removed in the next major version.
*/ function isUnauthorizedError(e) {
    const status = e?.status;
    return e?.errors?.[0]?.code === "authentication_invalid" && status === 401;
}
/**
* Checks if the provided error object is a captcha error.
*
* @internal
*/ function isCaptchaError(e) {
    return [
        "captcha_invalid",
        "captcha_not_enabled",
        "captcha_missing_token"
    ].includes(e.errors[0].code);
}
/**
* Checks if the provided error is a 4xx error.
*
* @internal
*/ function is4xxError(e) {
    const status = e?.status;
    return !!status && status >= 400 && status < 500;
}
/**
* Checks if the provided error is a network error.
*
* @internal
*/ function isNetworkError(e) {
    return (`${e.message}${e.name}` || "").toLowerCase().replace(/\s+/g, "").includes("networkerror");
}
/**
* Checks if the provided error is either a ClerkAPIResponseError, a ClerkRuntimeError, or a MetamaskError.
*
* @internal
*/ function isKnownError(error) {
    return isClerkAPIResponseError(error) || isMetamaskError(error) || isClerkRuntimeError(error);
}
/**
* Checks if the provided error is a Clerk runtime error indicating a reverification was cancelled.
*
* @internal
*/ function isReverificationCancelledError(err) {
    return isClerkRuntimeError(err) && err.code === "reverification_cancelled";
}
/**
* Checks if the provided error is a Metamask error.
*
* @internal
*/ function isMetamaskError(err) {
    return "code" in err && [
        4001,
        32602,
        32603
    ].includes(err.code) && "message" in err;
}
/**
* Checks if the provided error is clerk api response error indicating a user is locked.
*
* @internal
*/ function isUserLockedError(err) {
    return isClerkAPIResponseError(err) && err.errors?.[0]?.code === "user_locked";
}
/**
* Checks if the provided error is a clerk api response error indicating a password was pwned.
*
* @internal
*/ function isPasswordPwnedError(err) {
    return isClerkAPIResponseError(err) && err.errors?.[0]?.code === "form_password_pwned";
}
/**
* Checks if the provided error is a clerk api response error indicating a password was compromised.
*
* @internal
*/ function isPasswordCompromisedError(err) {
    return isClerkAPIResponseError(err) && err.errors?.[0]?.code === "form_password_compromised";
}
/**
* Checks if the provided error is an EmailLinkError.
*
* @internal
*/ function isEmailLinkError(err) {
    return err.name === "EmailLinkError";
}
//#endregion
//#region src/errors/globalHookError.ts
/**
* Creates a ClerkGlobalHookError object from a ClerkError instance.
* It's a wrapper for all the different instances of Clerk errors that can
* be returned when using Clerk hooks.
*/ function createClerkGlobalHookError(error) {
    const predicates = {
        isClerkAPIResponseError,
        isClerkRuntimeError
    };
    for (const [name, fn] of Object.entries(predicates))Object.assign(error, {
        [name]: fn
    });
    return error;
}
;
 //# sourceMappingURL=error-Dl9xmUf3.mjs.map
}),
"[project]/node_modules/@clerk/shared/dist/runtime/error.mjs [app-route] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$error$2d$Dl9xmUf3$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@clerk/shared/dist/runtime/error-Dl9xmUf3.mjs [app-route] (ecmascript)");
;
;
}),
"[project]/node_modules/@clerk/shared/dist/runtime/isomorphicAtob.mjs [app-route] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$isomorphicAtob$2d$DybBXGFR$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@clerk/shared/dist/runtime/isomorphicAtob-DybBXGFR.mjs [app-route] (ecmascript)");
;
;
}),
"[project]/node_modules/@clerk/shared/dist/runtime/buildAccountsBaseUrl.mjs [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "buildAccountsBaseUrl",
    ()=>buildAccountsBaseUrl
]);
//#region src/buildAccountsBaseUrl.ts
/**
* Builds a full origin string pointing to the Account Portal for the given frontend API.
*/ function buildAccountsBaseUrl(frontendApi) {
    if (!frontendApi) return "";
    return `https://${frontendApi.replace(/clerk\.accountsstage\./, "accountsstage.").replace(/clerk\.accounts\.|clerk\./, "accounts.")}`;
}
;
 //# sourceMappingURL=buildAccountsBaseUrl.mjs.map
}),
"[project]/node_modules/@clerk/shared/dist/runtime/authorization-D2ans7vW.mjs [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "createCheckAuthorization",
    ()=>createCheckAuthorization,
    "resolveAuthState",
    ()=>resolveAuthState,
    "splitByScope",
    ()=>splitByScope,
    "validateReverificationConfig",
    ()=>validateReverificationConfig
]);
//#region src/authorization.ts
const TYPES_TO_OBJECTS = {
    strict_mfa: {
        afterMinutes: 10,
        level: "multi_factor"
    },
    strict: {
        afterMinutes: 10,
        level: "second_factor"
    },
    moderate: {
        afterMinutes: 60,
        level: "second_factor"
    },
    lax: {
        afterMinutes: 1440,
        level: "second_factor"
    }
};
const ALLOWED_LEVELS = new Set([
    "first_factor",
    "second_factor",
    "multi_factor"
]);
const ALLOWED_TYPES = new Set([
    "strict_mfa",
    "strict",
    "moderate",
    "lax"
]);
const isValidMaxAge = (maxAge)=>typeof maxAge === "number" && maxAge > 0;
const isValidLevel = (level)=>ALLOWED_LEVELS.has(level);
const isValidVerificationType = (type)=>ALLOWED_TYPES.has(type);
const prefixWithOrg = (value)=>value.replace(/^(org:)*/, "org:");
/**
* Checks if a user has the required Organization-level authorization.
* Verifies if the user has the specified Role or Permission within their Organization.
* @returns null, if unable to determine due to missing data or unspecified Role/Permission.
*/ const checkOrgAuthorization = (params, options)=>{
    const { orgId, orgRole, orgPermissions } = options;
    if (!params.role && !params.permission) return null;
    if (!orgId || !orgRole || !orgPermissions) return null;
    if (params.permission) return orgPermissions.includes(prefixWithOrg(params.permission));
    if (params.role) return prefixWithOrg(orgRole) === prefixWithOrg(params.role);
    return null;
};
const checkForFeatureOrPlan = (claim, featureOrPlan)=>{
    const { org: orgFeatures, user: userFeatures } = splitByScope(claim);
    const [scope, _id] = featureOrPlan.split(":");
    const id = _id || scope;
    if (scope === "org") return orgFeatures.includes(id);
    else if (scope === "user") return userFeatures.includes(id);
    else return [
        ...orgFeatures,
        ...userFeatures
    ].includes(id);
};
const checkBillingAuthorization = (params, options)=>{
    const { features, plans } = options;
    if (params.feature && features) return checkForFeatureOrPlan(features, params.feature);
    if (params.plan && plans) return checkForFeatureOrPlan(plans, params.plan);
    return null;
};
const splitByScope = (fea)=>{
    const features = fea ? fea.split(",").map((f)=>f.trim()) : [];
    return {
        org: features.filter((f)=>f.split(":")[0].includes("o")).map((f)=>f.split(":")[1]),
        user: features.filter((f)=>f.split(":")[0].includes("u")).map((f)=>f.split(":")[1])
    };
};
const validateReverificationConfig = (config)=>{
    if (!config) return false;
    const convertConfigToObject = (config$1)=>{
        if (typeof config$1 === "string") return TYPES_TO_OBJECTS[config$1];
        return config$1;
    };
    const isValidStringValue = typeof config === "string" && isValidVerificationType(config);
    const isValidObjectValue = typeof config === "object" && isValidLevel(config.level) && isValidMaxAge(config.afterMinutes);
    if (isValidStringValue || isValidObjectValue) return convertConfigToObject.bind(null, config);
    return false;
};
/**
* Evaluates if the user meets re-verification authentication requirements.
* Compares the user's factor verification ages against the specified maxAge.
* Handles different verification levels (first factor, second factor, multi-factor).
* @returns null, if requirements or verification data are missing.
*/ const checkReverificationAuthorization = (params, { factorVerificationAge })=>{
    if (!params.reverification || !factorVerificationAge) return null;
    const isValidReverification = validateReverificationConfig(params.reverification);
    if (!isValidReverification) return null;
    const { level, afterMinutes } = isValidReverification();
    const [factor1Age, factor2Age] = factorVerificationAge;
    const isValidFactor1 = factor1Age !== -1 ? afterMinutes > factor1Age : null;
    const isValidFactor2 = factor2Age !== -1 ? afterMinutes > factor2Age : null;
    switch(level){
        case "first_factor":
            return isValidFactor1;
        case "second_factor":
            return factor2Age !== -1 ? isValidFactor2 : isValidFactor1;
        case "multi_factor":
            return factor2Age === -1 ? isValidFactor1 : isValidFactor1 && isValidFactor2;
    }
};
/**
* Creates a function for comprehensive user authorization checks.
* Combines organization-level and reverification authentication checks.
* The returned function authorizes if both checks pass, or if at least one passes
* when the other is indeterminate. Fails if userId is missing.
*/ const createCheckAuthorization = (options)=>{
    return (params)=>{
        if (!options.userId) return false;
        const billingAuthorization = checkBillingAuthorization(params, options);
        const orgAuthorization = checkOrgAuthorization(params, options);
        const reverificationAuthorization = checkReverificationAuthorization(params, options);
        if ([
            billingAuthorization || orgAuthorization,
            reverificationAuthorization
        ].some((a)=>a === null)) return [
            billingAuthorization || orgAuthorization,
            reverificationAuthorization
        ].some((a)=>a === true);
        return [
            billingAuthorization || orgAuthorization,
            reverificationAuthorization
        ].every((a)=>a === true);
    };
};
/**
* Shared utility function that centralizes auth state resolution logic,
* preventing duplication across different packages.
* @internal
*/ const resolveAuthState = ({ authObject: { sessionId, sessionStatus, userId, actor, orgId, orgRole, orgSlug, signOut, getToken, has, sessionClaims }, options: { treatPendingAsSignedOut = true } })=>{
    if (sessionId === void 0 && userId === void 0) return {
        isLoaded: false,
        isSignedIn: void 0,
        sessionId,
        sessionClaims: void 0,
        userId,
        actor: void 0,
        orgId: void 0,
        orgRole: void 0,
        orgSlug: void 0,
        has: void 0,
        signOut,
        getToken
    };
    if (sessionId === null && userId === null) return {
        isLoaded: true,
        isSignedIn: false,
        sessionId,
        userId,
        sessionClaims: null,
        actor: null,
        orgId: null,
        orgRole: null,
        orgSlug: null,
        has: ()=>false,
        signOut,
        getToken
    };
    if (treatPendingAsSignedOut && sessionStatus === "pending") return {
        isLoaded: true,
        isSignedIn: false,
        sessionId: null,
        userId: null,
        sessionClaims: null,
        actor: null,
        orgId: null,
        orgRole: null,
        orgSlug: null,
        has: ()=>false,
        signOut,
        getToken
    };
    if (!!sessionId && !!sessionClaims && !!userId && !!orgId && !!orgRole) return {
        isLoaded: true,
        isSignedIn: true,
        sessionId,
        sessionClaims,
        userId,
        actor: actor || null,
        orgId,
        orgRole,
        orgSlug: orgSlug || null,
        has,
        signOut,
        getToken
    };
    if (!!sessionId && !!sessionClaims && !!userId && !orgId) return {
        isLoaded: true,
        isSignedIn: true,
        sessionId,
        sessionClaims,
        userId,
        actor: actor || null,
        orgId: null,
        orgRole: null,
        orgSlug: null,
        has,
        signOut,
        getToken
    };
};
;
 //# sourceMappingURL=authorization-D2ans7vW.mjs.map
}),
"[project]/node_modules/@clerk/shared/dist/runtime/authorization.mjs [app-route] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$authorization$2d$D2ans7vW$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@clerk/shared/dist/runtime/authorization-D2ans7vW.mjs [app-route] (ecmascript)");
;
;
}),
"[project]/node_modules/@clerk/shared/dist/runtime/jwtPayloadParser.mjs [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "__experimental_JWTPayloadToAuthObjectProperties",
    ()=>__experimental_JWTPayloadToAuthObjectProperties,
    "parsePermissions",
    ()=>parsePermissions
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$authorization$2d$D2ans7vW$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@clerk/shared/dist/runtime/authorization-D2ans7vW.mjs [app-route] (ecmascript)");
;
//#region src/jwtPayloadParser.ts
const parsePermissions = ({ per, fpm })=>{
    if (!per || !fpm) return {
        permissions: [],
        featurePermissionMap: []
    };
    const permissions = per.split(",").map((p)=>p.trim());
    return {
        permissions,
        featurePermissionMap: fpm.split(",").map((permission)=>Number.parseInt(permission.trim(), 10)).map((permission)=>permission.toString(2).padStart(permissions.length, "0").split("").map((bit)=>Number.parseInt(bit, 10)).reverse()).filter(Boolean)
    };
};
/**
*
*/ function buildOrgPermissions({ features, permissions, featurePermissionMap }) {
    if (!features || !permissions || !featurePermissionMap) return [];
    const orgPermissions = [];
    for(let featureIndex = 0; featureIndex < features.length; featureIndex++){
        const feature = features[featureIndex];
        if (featureIndex >= featurePermissionMap.length) continue;
        const permissionBits = featurePermissionMap[featureIndex];
        if (!permissionBits) continue;
        for(let permIndex = 0; permIndex < permissionBits.length; permIndex++)if (permissionBits[permIndex] === 1) orgPermissions.push(`org:${feature}:${permissions[permIndex]}`);
    }
    return orgPermissions;
}
/**
* Resolves the signed-in auth state from JWT claims.
*
* @experimental
*/ const __experimental_JWTPayloadToAuthObjectProperties = (claims)=>{
    let orgId;
    let orgRole;
    let orgSlug;
    let orgPermissions;
    const factorVerificationAge = claims.fva ?? null;
    const sessionStatus = claims.sts ?? null;
    switch(claims.v){
        case 2:
            if (claims.o) {
                orgId = claims.o?.id;
                orgSlug = claims.o?.slg;
                if (claims.o?.rol) orgRole = `org:${claims.o?.rol}`;
                const { org } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$authorization$2d$D2ans7vW$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["splitByScope"])(claims.fea);
                const { permissions, featurePermissionMap } = parsePermissions({
                    per: claims.o?.per,
                    fpm: claims.o?.fpm
                });
                orgPermissions = buildOrgPermissions({
                    features: org,
                    featurePermissionMap,
                    permissions
                });
            }
            break;
        default:
            orgId = claims.org_id;
            orgRole = claims.org_role;
            orgSlug = claims.org_slug;
            orgPermissions = claims.org_permissions;
            break;
    }
    return {
        sessionClaims: claims,
        sessionId: claims.sid,
        sessionStatus,
        actor: claims.act,
        userId: claims.sub,
        orgId,
        orgRole,
        orgSlug,
        orgPermissions,
        factorVerificationAge
    };
};
;
 //# sourceMappingURL=jwtPayloadParser.mjs.map
}),
"[project]/node_modules/@clerk/shared/dist/runtime/pathToRegexp-Bu45OrlU.mjs [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "match",
    ()=>match,
    "pathToRegexp",
    ()=>pathToRegexp
]);
//#region src/compiled/path-to-regexp/index.js
function _(r) {
    for(var n = [], e = 0; e < r.length;){
        var a = r[e];
        if (a === "*" || a === "+" || a === "?") {
            n.push({
                type: "MODIFIER",
                index: e,
                value: r[e++]
            });
            continue;
        }
        if (a === "\\") {
            n.push({
                type: "ESCAPED_CHAR",
                index: e++,
                value: r[e++]
            });
            continue;
        }
        if (a === "{") {
            n.push({
                type: "OPEN",
                index: e,
                value: r[e++]
            });
            continue;
        }
        if (a === "}") {
            n.push({
                type: "CLOSE",
                index: e,
                value: r[e++]
            });
            continue;
        }
        if (a === ":") {
            for(var u = "", t = e + 1; t < r.length;){
                var c = r.charCodeAt(t);
                if (c >= 48 && c <= 57 || c >= 65 && c <= 90 || c >= 97 && c <= 122 || c === 95) {
                    u += r[t++];
                    continue;
                }
                break;
            }
            if (!u) throw new TypeError("Missing parameter name at ".concat(e));
            n.push({
                type: "NAME",
                index: e,
                value: u
            }), e = t;
            continue;
        }
        if (a === "(") {
            var o = 1, m = "", t = e + 1;
            if (r[t] === "?") throw new TypeError("Pattern cannot start with \"?\" at ".concat(t));
            for(; t < r.length;){
                if (r[t] === "\\") {
                    m += r[t++] + r[t++];
                    continue;
                }
                if (r[t] === ")") {
                    if (o--, o === 0) {
                        t++;
                        break;
                    }
                } else if (r[t] === "(" && (o++, r[t + 1] !== "?")) throw new TypeError("Capturing groups are not allowed at ".concat(t));
                m += r[t++];
            }
            if (o) throw new TypeError("Unbalanced pattern at ".concat(e));
            if (!m) throw new TypeError("Missing pattern at ".concat(e));
            n.push({
                type: "PATTERN",
                index: e,
                value: m
            }), e = t;
            continue;
        }
        n.push({
            type: "CHAR",
            index: e,
            value: r[e++]
        });
    }
    return n.push({
        type: "END",
        index: e,
        value: ""
    }), n;
}
function F(r, n) {
    n === void 0 && (n = {});
    for(var e = _(r), a = n.prefixes, u = a === void 0 ? "./" : a, t = n.delimiter, c = t === void 0 ? "/#?" : t, o = [], m = 0, h = 0, p = "", f = function(l) {
        if (h < e.length && e[h].type === l) return e[h++].value;
    }, w = function(l) {
        var v = f(l);
        if (v !== void 0) return v;
        var E = e[h], N = E.type, S = E.index;
        throw new TypeError("Unexpected ".concat(N, " at ").concat(S, ", expected ").concat(l));
    }, d = function() {
        for(var l = "", v; v = f("CHAR") || f("ESCAPED_CHAR");)l += v;
        return l;
    }, M = function(l) {
        for(var v = 0, E = c; v < E.length; v++){
            var N = E[v];
            if (l.indexOf(N) > -1) return !0;
        }
        return !1;
    }, A = function(l) {
        var v = o[o.length - 1], E = l || (v && typeof v == "string" ? v : "");
        if (v && !E) throw new TypeError("Must have text between two parameters, missing text after \"".concat(v.name, "\""));
        return !E || M(E) ? "[^".concat(s(c), "]+?") : "(?:(?!".concat(s(E), ")[^").concat(s(c), "])+?");
    }; h < e.length;){
        var T = f("CHAR"), x = f("NAME"), C = f("PATTERN");
        if (x || C) {
            var g = T || "";
            u.indexOf(g) === -1 && (p += g, g = ""), p && (o.push(p), p = ""), o.push({
                name: x || m++,
                prefix: g,
                suffix: "",
                pattern: C || A(g),
                modifier: f("MODIFIER") || ""
            });
            continue;
        }
        var i = T || f("ESCAPED_CHAR");
        if (i) {
            p += i;
            continue;
        }
        p && (o.push(p), p = "");
        if (f("OPEN")) {
            var g = d(), y = f("NAME") || "", O = f("PATTERN") || "", b = d();
            w("CLOSE"), o.push({
                name: y || (O ? m++ : ""),
                pattern: y && !O ? A(g) : O,
                prefix: g,
                suffix: b,
                modifier: f("MODIFIER") || ""
            });
            continue;
        }
        w("END");
    }
    return o;
}
function H(r, n) {
    var e = [];
    return I(P(r, e, n), e, n);
}
function I(r, n, e) {
    e === void 0 && (e = {});
    var a = e.decode, u = a === void 0 ? function(t) {
        return t;
    } : a;
    return function(t) {
        var c = r.exec(t);
        if (!c) return !1;
        for(var o = c[0], m = c.index, h = Object.create(null), p = function(w) {
            if (c[w] === void 0) return "continue";
            var d = n[w - 1];
            d.modifier === "*" || d.modifier === "+" ? h[d.name] = c[w].split(d.prefix + d.suffix).map(function(M) {
                return u(M, d);
            }) : h[d.name] = u(c[w], d);
        }, f = 1; f < c.length; f++)p(f);
        return {
            path: o,
            index: m,
            params: h
        };
    };
}
function s(r) {
    return r.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
function D(r) {
    return r && r.sensitive ? "" : "i";
}
function $(r, n) {
    if (!n) return r;
    for(var e = /\((?:\?<(.*?)>)?(?!\?)/g, a = 0, u = e.exec(r.source); u;)n.push({
        name: u[1] || a++,
        prefix: "",
        suffix: "",
        modifier: "",
        pattern: ""
    }), u = e.exec(r.source);
    return r;
}
function W(r, n, e) {
    var a = r.map(function(u) {
        return P(u, n, e).source;
    });
    return new RegExp("(?:".concat(a.join("|"), ")"), D(e));
}
function L(r, n, e) {
    return U(F(r, e), n, e);
}
function U(r, n, e) {
    e === void 0 && (e = {});
    for(var a = e.strict, u = a === void 0 ? !1 : a, t = e.start, c = t === void 0 ? !0 : t, o = e.end, m = o === void 0 ? !0 : o, h = e.encode, p = h === void 0 ? function(v) {
        return v;
    } : h, f = e.delimiter, w = f === void 0 ? "/#?" : f, d = e.endsWith, M = d === void 0 ? "" : d, A = "[".concat(s(M), "]|$"), T = "[".concat(s(w), "]"), x = c ? "^" : "", C = 0, g = r; C < g.length; C++){
        var i = g[C];
        if (typeof i == "string") x += s(p(i));
        else {
            var R = s(p(i.prefix)), y = s(p(i.suffix));
            if (i.pattern) if (n && n.push(i), R || y) if (i.modifier === "+" || i.modifier === "*") {
                var O = i.modifier === "*" ? "?" : "";
                x += "(?:".concat(R, "((?:").concat(i.pattern, ")(?:").concat(y).concat(R, "(?:").concat(i.pattern, "))*)").concat(y, ")").concat(O);
            } else x += "(?:".concat(R, "(").concat(i.pattern, ")").concat(y, ")").concat(i.modifier);
            else {
                if (i.modifier === "+" || i.modifier === "*") throw new TypeError("Can not repeat \"".concat(i.name, "\" without a prefix and suffix"));
                x += "(".concat(i.pattern, ")").concat(i.modifier);
            }
            else x += "(?:".concat(R).concat(y, ")").concat(i.modifier);
        }
    }
    if (m) u || (x += "".concat(T, "?")), x += e.endsWith ? "(?=".concat(A, ")") : "$";
    else {
        var b = r[r.length - 1], l = typeof b == "string" ? T.indexOf(b[b.length - 1]) > -1 : b === void 0;
        u || (x += "(?:".concat(T, "(?=").concat(A, "))?")), l || (x += "(?=".concat(T, "|").concat(A, ")"));
    }
    return new RegExp(x, D(e));
}
function P(r, n, e) {
    return r instanceof RegExp ? $(r, n) : Array.isArray(r) ? W(r, n, e) : L(r, n, e);
}
//#endregion
//#region src/pathToRegexp.ts
const pathToRegexp = (path)=>{
    try {
        return P(path);
    } catch (e) {
        throw new Error(`Invalid path: ${path}.\nConsult the documentation of path-to-regexp here: https://github.com/pillarjs/path-to-regexp/tree/6.x\n${e.message}`);
    }
};
/**
*
*/ function match(str, options) {
    try {
        return H(str, options);
    } catch (e) {
        throw new Error(`Invalid path and options: Consult the documentation of path-to-regexp here: https://github.com/pillarjs/path-to-regexp/tree/6.x\n${e.message}`);
    }
}
;
 //# sourceMappingURL=pathToRegexp-Bu45OrlU.mjs.map
}),
"[project]/node_modules/@clerk/shared/dist/runtime/pathToRegexp.mjs [app-route] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$pathToRegexp$2d$Bu45OrlU$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@clerk/shared/dist/runtime/pathToRegexp-Bu45OrlU.mjs [app-route] (ecmascript)");
;
;
}),
"[project]/node_modules/@clerk/shared/dist/runtime/authorization-errors-CS1pNy8i.mjs [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "isReverificationHint",
    ()=>isReverificationHint,
    "reverificationError",
    ()=>reverificationError,
    "reverificationErrorResponse",
    ()=>reverificationErrorResponse
]);
//#region src/authorization-errors.ts
const REVERIFICATION_REASON = "reverification-error";
const reverificationError = (missingConfig)=>({
        clerk_error: {
            type: "forbidden",
            reason: REVERIFICATION_REASON,
            metadata: {
                reverification: missingConfig
            }
        }
    });
const reverificationErrorResponse = (...args)=>new Response(JSON.stringify(reverificationError(...args)), {
        status: 403
    });
const isReverificationHint = (result)=>{
    return result && typeof result === "object" && "clerk_error" in result && result.clerk_error?.type === "forbidden" && result.clerk_error?.reason === REVERIFICATION_REASON;
};
;
 //# sourceMappingURL=authorization-errors-CS1pNy8i.mjs.map
}),
"[project]/node_modules/@clerk/shared/dist/runtime/authorization-errors.mjs [app-route] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$authorization$2d$errors$2d$CS1pNy8i$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@clerk/shared/dist/runtime/authorization-errors-CS1pNy8i.mjs [app-route] (ecmascript)");
;
;
}),
"[project]/node_modules/@clerk/shared/dist/runtime/apiUrlFromPublishableKey-B2KkwQp6.mjs [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "apiUrlFromPublishableKey",
    ()=>apiUrlFromPublishableKey
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$constants$2d$ByUssRbE$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@clerk/shared/dist/runtime/constants-ByUssRbE.mjs [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$keys$2d$YNv6yjKk$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@clerk/shared/dist/runtime/keys-YNv6yjKk.mjs [app-route] (ecmascript)");
;
;
//#region src/apiUrlFromPublishableKey.ts
/**
* Get the correct API url based on the publishable key.
*
* @param publishableKey - The publishable key to parse.
* @returns One of Clerk's API URLs.
*/ const apiUrlFromPublishableKey = (publishableKey)=>{
    const frontendApi = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$keys$2d$YNv6yjKk$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["parsePublishableKey"])(publishableKey)?.frontendApi;
    if (frontendApi?.startsWith("clerk.") && __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$constants$2d$ByUssRbE$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["LEGACY_DEV_INSTANCE_SUFFIXES"].some((suffix)=>frontendApi?.endsWith(suffix))) return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$constants$2d$ByUssRbE$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["PROD_API_URL"];
    if (__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$constants$2d$ByUssRbE$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["LOCAL_ENV_SUFFIXES"].some((suffix)=>frontendApi?.endsWith(suffix))) return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$constants$2d$ByUssRbE$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["LOCAL_API_URL"];
    if (__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$constants$2d$ByUssRbE$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["STAGING_ENV_SUFFIXES"].some((suffix)=>frontendApi?.endsWith(suffix))) return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$constants$2d$ByUssRbE$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["STAGING_API_URL"];
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$constants$2d$ByUssRbE$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["PROD_API_URL"];
};
;
 //# sourceMappingURL=apiUrlFromPublishableKey-B2KkwQp6.mjs.map
}),
"[project]/node_modules/@clerk/shared/dist/runtime/apiUrlFromPublishableKey.mjs [app-route] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$constants$2d$ByUssRbE$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@clerk/shared/dist/runtime/constants-ByUssRbE.mjs [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$isomorphicAtob$2d$DybBXGFR$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@clerk/shared/dist/runtime/isomorphicAtob-DybBXGFR.mjs [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$isomorphicBtoa$2d$Dr7WubZv$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@clerk/shared/dist/runtime/isomorphicBtoa-Dr7WubZv.mjs [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$keys$2d$YNv6yjKk$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@clerk/shared/dist/runtime/keys-YNv6yjKk.mjs [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$apiUrlFromPublishableKey$2d$B2KkwQp6$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@clerk/shared/dist/runtime/apiUrlFromPublishableKey-B2KkwQp6.mjs [app-route] (ecmascript)");
;
;
;
;
;
;
}),
"[project]/node_modules/@clerk/shared/dist/runtime/underscore-DjQrhefX.mjs [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "camelToSnake",
    ()=>camelToSnake,
    "deepCamelToSnake",
    ()=>deepCamelToSnake,
    "deepSnakeToCamel",
    ()=>deepSnakeToCamel,
    "getNonUndefinedValues",
    ()=>getNonUndefinedValues,
    "isIPV4Address",
    ()=>isIPV4Address,
    "isTruthy",
    ()=>isTruthy,
    "snakeToCamel",
    ()=>snakeToCamel,
    "titleize",
    ()=>titleize,
    "toSentence",
    ()=>toSentence
]);
//#region src/underscore.ts
/**
* Convert words to a sentence.
*
* @param items - An array of words to be joined.
* @returns A string with the items joined by a comma and the last item joined by ", or".
*/ const toSentence = (items)=>{
    if (items.length == 0) return "";
    if (items.length == 1) return items[0];
    let sentence = items.slice(0, -1).join(", ");
    sentence += `, or ${items.slice(-1)}`;
    return sentence;
};
const IP_V4_ADDRESS_REGEX = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
/**
* Checks if a string is a valid IPv4 address.
*
* @returns True if the string is a valid IPv4 address, false otherwise.
*/ function isIPV4Address(str) {
    return IP_V4_ADDRESS_REGEX.test(str || "");
}
/**
* Converts the first character of a string to uppercase.
*
* @param str - The string to be converted.
* @returns The modified string with the rest of the string unchanged.
*
* @example
* ```ts
* titleize('hello world') // 'Hello world'
* ```
*/ function titleize(str) {
    const s = str || "";
    return s.charAt(0).toUpperCase() + s.slice(1);
}
/**
* Converts a string from snake_case to camelCase.
*/ function snakeToCamel(str) {
    return str ? str.replace(/([-_][a-z])/g, (match)=>match.toUpperCase().replace(/-|_/, "")) : "";
}
/**
* Converts a string from camelCase to snake_case.
*/ function camelToSnake(str) {
    return str ? str.replace(/[A-Z]/g, (letter)=>`_${letter.toLowerCase()}`) : "";
}
const createDeepObjectTransformer = (transform)=>{
    const deepTransform = (obj)=>{
        if (!obj) return obj;
        if (Array.isArray(obj)) return obj.map((el)=>{
            if (typeof el === "object" || Array.isArray(el)) return deepTransform(el);
            return el;
        });
        const copy = {
            ...obj
        };
        const keys = Object.keys(copy);
        for (const oldName of keys){
            const newName = transform(oldName.toString());
            if (newName !== oldName) {
                copy[newName] = copy[oldName];
                delete copy[oldName];
            }
            if (typeof copy[newName] === "object") copy[newName] = deepTransform(copy[newName]);
        }
        return copy;
    };
    return deepTransform;
};
/**
* Transforms camelCased objects/ arrays to snake_cased.
* This function recursively traverses all objects and arrays of the passed value
* camelCased keys are removed.
*
* @function
*/ const deepCamelToSnake = createDeepObjectTransformer(camelToSnake);
/**
* Transforms snake_cased objects/ arrays to camelCased.
* This function recursively traverses all objects and arrays of the passed value
* camelCased keys are removed.
*
* @function
*/ const deepSnakeToCamel = createDeepObjectTransformer(snakeToCamel);
/**
* A function to determine if a value is truthy.
*
* @returns True for `true`, true, positive numbers. False for `false`, false, 0, negative integers and anything else.
*/ function isTruthy(value) {
    if (typeof value === `boolean`) return value;
    if (value === void 0 || value === null) return false;
    if (typeof value === `string`) {
        if (value.toLowerCase() === `true`) return true;
        if (value.toLowerCase() === `false`) return false;
    }
    const number = parseInt(value, 10);
    if (isNaN(number)) return false;
    if (number > 0) return true;
    return false;
}
/**
* Get all non-undefined values from an object.
*/ function getNonUndefinedValues(obj) {
    return Object.entries(obj).reduce((acc, [key, value])=>{
        if (value !== void 0) acc[key] = value;
        return acc;
    }, {});
}
;
 //# sourceMappingURL=underscore-DjQrhefX.mjs.map
}),
"[project]/node_modules/@clerk/shared/dist/runtime/underscore.mjs [app-route] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$underscore$2d$DjQrhefX$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@clerk/shared/dist/runtime/underscore-DjQrhefX.mjs [app-route] (ecmascript)");
;
;
}),
"[project]/node_modules/@clerk/shared/dist/runtime/logger-B9q7E6uE.mjs [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "logger",
    ()=>logger
]);
//#region src/logger.ts
const loggedMessages = /* @__PURE__ */ new Set();
const logger = {
    warnOnce: (msg)=>{
        if (loggedMessages.has(msg)) return;
        loggedMessages.add(msg);
        console.warn(msg);
    },
    logOnce: (msg)=>{
        if (loggedMessages.has(msg)) return;
        console.log(msg);
        loggedMessages.add(msg);
    }
};
;
 //# sourceMappingURL=logger-B9q7E6uE.mjs.map
}),
"[project]/node_modules/@clerk/shared/dist/runtime/logger.mjs [app-route] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$logger$2d$B9q7E6uE$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@clerk/shared/dist/runtime/logger-B9q7E6uE.mjs [app-route] (ecmascript)");
;
;
}),
"[project]/node_modules/@clerk/shared/dist/runtime/proxy-Bq8EHApG.mjs [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "isHttpOrHttps",
    ()=>isHttpOrHttps,
    "isProxyUrlRelative",
    ()=>isProxyUrlRelative,
    "isValidProxyUrl",
    ()=>isValidProxyUrl,
    "proxyUrlToAbsoluteURL",
    ()=>proxyUrlToAbsoluteURL
]);
//#region src/proxy.ts
function isValidProxyUrl(key) {
    if (!key) return true;
    return isHttpOrHttps(key) || isProxyUrlRelative(key);
}
function isHttpOrHttps(key) {
    return /^http(s)?:\/\//.test(key || "");
}
function isProxyUrlRelative(key) {
    return key.startsWith("/");
}
function proxyUrlToAbsoluteURL(url) {
    if (!url) return "";
    return isProxyUrlRelative(url) ? new URL(url, window.location.origin).toString() : url;
}
;
 //# sourceMappingURL=proxy-Bq8EHApG.mjs.map
}),
"[project]/node_modules/@clerk/shared/dist/runtime/proxy.mjs [app-route] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$proxy$2d$Bq8EHApG$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@clerk/shared/dist/runtime/proxy-Bq8EHApG.mjs [app-route] (ecmascript)");
;
;
}),
"[project]/node_modules/@clerk/shared/dist/runtime/handleValueOrFn-CcwnRX-K.mjs [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "handleValueOrFn",
    ()=>handleValueOrFn
]);
//#region src/utils/handleValueOrFn.ts
function handleValueOrFn(value, url, defaultValue) {
    if (typeof value === "function") return value(url);
    if (typeof value !== "undefined") return value;
    if (typeof defaultValue !== "undefined") return defaultValue;
}
;
 //# sourceMappingURL=handleValueOrFn-CcwnRX-K.mjs.map
}),
"[project]/node_modules/@clerk/shared/dist/runtime/noop-B3MbDAfb.mjs [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "noop",
    ()=>noop
]);
//#region src/utils/noop.ts
const noop = (..._args)=>{};
;
 //# sourceMappingURL=noop-B3MbDAfb.mjs.map
}),
"[project]/node_modules/@clerk/shared/dist/runtime/createDeferredPromise-CjYZzUuU.mjs [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "createDeferredPromise",
    ()=>createDeferredPromise
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$noop$2d$B3MbDAfb$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@clerk/shared/dist/runtime/noop-B3MbDAfb.mjs [app-route] (ecmascript)");
;
//#region src/utils/createDeferredPromise.ts
/**
* Create a promise that can be resolved or rejected from
* outside the Promise constructor callback
* A ES6 compatible utility that implements `Promise.withResolvers`
* @internal
*/ const createDeferredPromise = ()=>{
    let resolve = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$noop$2d$B3MbDAfb$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["noop"];
    let reject = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$noop$2d$B3MbDAfb$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["noop"];
    return {
        promise: new Promise((res, rej)=>{
            resolve = res;
            reject = rej;
        }),
        resolve,
        reject
    };
};
;
 //# sourceMappingURL=createDeferredPromise-CjYZzUuU.mjs.map
}),
"[project]/node_modules/@clerk/shared/dist/runtime/utils-BfsP_p13.mjs [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "allSettled",
    ()=>allSettled,
    "fastDeepMergeAndKeep",
    ()=>fastDeepMergeAndKeep,
    "fastDeepMergeAndReplace",
    ()=>fastDeepMergeAndReplace,
    "logErrorInDevMode",
    ()=>logErrorInDevMode
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$runtimeEnvironment$2d$BB2sO$2d$19$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@clerk/shared/dist/runtime/runtimeEnvironment-BB2sO-19.mjs [app-route] (ecmascript)");
;
//#region src/utils/allSettled.ts
/**
* A ES6 compatible utility that implements `Promise.allSettled`
* @internal
*/ function allSettled(iterable) {
    const promises = Array.from(iterable).map((p)=>p.then((value)=>({
                status: "fulfilled",
                value
            }), (reason)=>({
                status: "rejected",
                reason
            })));
    return Promise.all(promises);
}
//#endregion
//#region src/utils/logErrorInDevMode.ts
const logErrorInDevMode = (message)=>{
    if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$runtimeEnvironment$2d$BB2sO$2d$19$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["isDevelopmentEnvironment"])()) console.error(`Clerk: ${message}`);
};
//#endregion
//#region src/utils/fastDeepMerge.ts
const DANGEROUS_KEYS = new Set([
    "__proto__",
    "constructor",
    "prototype"
]);
/**
* Merges 2 objects without creating new object references
* The merged props will appear on the `target` object
* If `target` already has a value for a given key it will not be overwritten
*/ const fastDeepMergeAndReplace = (source, target)=>{
    if (!source || !target) return;
    for(const key in source){
        if (DANGEROUS_KEYS.has(key)) continue;
        if (Object.prototype.hasOwnProperty.call(source, key) && source[key] !== null && typeof source[key] === `object`) {
            if (target[key] === void 0) target[key] = new (Object.getPrototypeOf(source[key])).constructor();
            fastDeepMergeAndReplace(source[key], target[key]);
        } else if (Object.prototype.hasOwnProperty.call(source, key) && source[key] !== void 0) target[key] = source[key];
    }
};
const fastDeepMergeAndKeep = (source, target)=>{
    if (!source || !target) return;
    for(const key in source){
        if (DANGEROUS_KEYS.has(key)) continue;
        if (Object.prototype.hasOwnProperty.call(source, key) && source[key] !== null && typeof source[key] === `object`) {
            if (target[key] === void 0) target[key] = new (Object.getPrototypeOf(source[key])).constructor();
            fastDeepMergeAndKeep(source[key], target[key]);
        } else if (Object.prototype.hasOwnProperty.call(source, key) && target[key] === void 0) target[key] = source[key];
    }
};
;
 //# sourceMappingURL=utils-BfsP_p13.mjs.map
}),
"[project]/node_modules/@clerk/shared/dist/runtime/utils/index.mjs [app-route] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$runtimeEnvironment$2d$BB2sO$2d$19$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@clerk/shared/dist/runtime/runtimeEnvironment-BB2sO-19.mjs [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$handleValueOrFn$2d$CcwnRX$2d$K$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@clerk/shared/dist/runtime/handleValueOrFn-CcwnRX-K.mjs [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$noop$2d$B3MbDAfb$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@clerk/shared/dist/runtime/noop-B3MbDAfb.mjs [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$createDeferredPromise$2d$CjYZzUuU$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@clerk/shared/dist/runtime/createDeferredPromise-CjYZzUuU.mjs [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$utils$2d$BfsP_p13$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@clerk/shared/dist/runtime/utils-BfsP_p13.mjs [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$instance$2d$Cze6Nv61$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@clerk/shared/dist/runtime/instance-Cze6Nv61.mjs [app-route] (ecmascript)");
;
;
;
;
;
;
;
}),
"[project]/node_modules/@clerk/nextjs/dist/esm/server/constants.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "API_URL",
    ()=>API_URL,
    "API_VERSION",
    ()=>API_VERSION,
    "CLERK_JS_URL",
    ()=>CLERK_JS_URL,
    "CLERK_JS_VERSION",
    ()=>CLERK_JS_VERSION,
    "DOMAIN",
    ()=>DOMAIN,
    "ENCRYPTION_KEY",
    ()=>ENCRYPTION_KEY,
    "IS_SATELLITE",
    ()=>IS_SATELLITE,
    "KEYLESS_DISABLED",
    ()=>KEYLESS_DISABLED,
    "MACHINE_SECRET_KEY",
    ()=>MACHINE_SECRET_KEY,
    "PROXY_URL",
    ()=>PROXY_URL,
    "PUBLISHABLE_KEY",
    ()=>PUBLISHABLE_KEY,
    "SDK_METADATA",
    ()=>SDK_METADATA,
    "SECRET_KEY",
    ()=>SECRET_KEY,
    "SIGN_IN_URL",
    ()=>SIGN_IN_URL,
    "SIGN_UP_URL",
    ()=>SIGN_UP_URL,
    "TELEMETRY_DEBUG",
    ()=>TELEMETRY_DEBUG,
    "TELEMETRY_DISABLED",
    ()=>TELEMETRY_DISABLED
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$apiUrlFromPublishableKey$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/@clerk/shared/dist/runtime/apiUrlFromPublishableKey.mjs [app-route] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$apiUrlFromPublishableKey$2d$B2KkwQp6$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@clerk/shared/dist/runtime/apiUrlFromPublishableKey-B2KkwQp6.mjs [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$underscore$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/@clerk/shared/dist/runtime/underscore.mjs [app-route] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$underscore$2d$DjQrhefX$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@clerk/shared/dist/runtime/underscore-DjQrhefX.mjs [app-route] (ecmascript)");
;
;
;
const CLERK_JS_VERSION = process.env.NEXT_PUBLIC_CLERK_JS_VERSION || "";
const CLERK_JS_URL = process.env.NEXT_PUBLIC_CLERK_JS_URL || "";
const API_VERSION = process.env.CLERK_API_VERSION || "v1";
const SECRET_KEY = process.env.CLERK_SECRET_KEY || "";
const MACHINE_SECRET_KEY = process.env.CLERK_MACHINE_SECRET_KEY || "";
const PUBLISHABLE_KEY = ("TURBOPACK compile-time value", "pk_test_dHJ1c3R5LWtvZGlhay0zOC5jbGVyay5hY2NvdW50cy5kZXYk") || "";
const ENCRYPTION_KEY = process.env.CLERK_ENCRYPTION_KEY || "";
const API_URL = process.env.CLERK_API_URL || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$apiUrlFromPublishableKey$2d$B2KkwQp6$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["apiUrlFromPublishableKey"])(PUBLISHABLE_KEY);
const DOMAIN = process.env.NEXT_PUBLIC_CLERK_DOMAIN || "";
const PROXY_URL = process.env.NEXT_PUBLIC_CLERK_PROXY_URL || "";
const IS_SATELLITE = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$underscore$2d$DjQrhefX$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["isTruthy"])(process.env.NEXT_PUBLIC_CLERK_IS_SATELLITE) || false;
const SIGN_IN_URL = ("TURBOPACK compile-time value", "/sign-in") || "";
const SIGN_UP_URL = ("TURBOPACK compile-time value", "/sign-up") || "";
const SDK_METADATA = {
    name: "@clerk/nextjs",
    version: "6.37.0",
    environment: ("TURBOPACK compile-time value", "development")
};
const TELEMETRY_DISABLED = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$underscore$2d$DjQrhefX$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["isTruthy"])(process.env.NEXT_PUBLIC_CLERK_TELEMETRY_DISABLED);
const TELEMETRY_DEBUG = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$underscore$2d$DjQrhefX$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["isTruthy"])(process.env.NEXT_PUBLIC_CLERK_TELEMETRY_DEBUG);
const KEYLESS_DISABLED = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$underscore$2d$DjQrhefX$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["isTruthy"])(process.env.NEXT_PUBLIC_CLERK_KEYLESS_DISABLED) || false;
;
 //# sourceMappingURL=constants.js.map
}),
"[project]/node_modules/@clerk/nextjs/dist/esm/utils/logFormatter.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "logFormatter",
    ()=>logFormatter
]);
;
const maskSecretKey = (str)=>{
    if (!str || typeof str !== "string") {
        return str;
    }
    try {
        return (str || "").replace(/^(sk_(live|test)_)(.+?)(.{3})$/, "$1*********$4");
    } catch  {
        return "";
    }
};
const logFormatter = (entry)=>{
    return (Array.isArray(entry) ? entry : [
        entry
    ]).map((entry2)=>{
        if (typeof entry2 === "string") {
            return maskSecretKey(entry2);
        }
        const masked = Object.fromEntries(Object.entries(entry2).map(([k, v])=>[
                k,
                maskSecretKey(v)
            ]));
        return JSON.stringify(masked, null, 2);
    }).join(", ");
};
;
 //# sourceMappingURL=logFormatter.js.map
}),
"[project]/node_modules/@clerk/nextjs/dist/esm/utils/debugLogger.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "createDebugLogger",
    ()=>createDebugLogger,
    "withLogger",
    ()=>withLogger
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$package$2e$json__$28$json$29$__ = __turbopack_context__.i("[project]/node_modules/next/package.json (json)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$utils$2f$logFormatter$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@clerk/nextjs/dist/esm/utils/logFormatter.js [app-route] (ecmascript)");
;
;
;
const createDebugLogger = (name, formatter)=>()=>{
        const entries = [];
        let isEnabled = false;
        return {
            enable: ()=>{
                isEnabled = true;
            },
            debug: (...args)=>{
                if (isEnabled) {
                    entries.push(args.map((arg)=>typeof arg === "function" ? arg() : arg));
                }
            },
            commit: ()=>{
                if (isEnabled) {
                    console.log(debugLogHeader(name));
                    for (const log of entries){
                        let output = formatter(log);
                        output = output.split("\n").map((l)=>`  ${l}`).join("\n");
                        if (process.env.VERCEL) {
                            output = truncate(output, 4096);
                        }
                        console.log(output);
                    }
                    console.log(debugLogFooter(name));
                }
            }
        };
    };
const withLogger = (loggerFactoryOrName, handlerCtor)=>{
    return (...args)=>{
        const factory = typeof loggerFactoryOrName === "string" ? createDebugLogger(loggerFactoryOrName, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$utils$2f$logFormatter$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["logFormatter"]) : loggerFactoryOrName;
        const logger = factory();
        const handler = handlerCtor(logger);
        try {
            const res = handler(...args);
            if (typeof res === "object" && "then" in res && typeof res.then === "function") {
                return res.then((val)=>{
                    logger.commit();
                    return val;
                }).catch((err)=>{
                    logger.commit();
                    throw err;
                });
            }
            logger.commit();
            return res;
        } catch (err) {
            logger.commit();
            throw err;
        }
    };
};
function debugLogHeader(name) {
    return `[clerk debug start: ${name}]`;
}
function debugLogFooter(name) {
    return `[clerk debug end: ${name}] (@clerk/nextjs=${"6.37.0"},next=${__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$package$2e$json__$28$json$29$__["default"].version},timestamp=${Math.round(/* @__PURE__ */ new Date().getTime() / 1e3)})`;
}
function truncate(str, maxLength) {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder("utf-8");
    const encodedString = encoder.encode(str);
    const truncatedString = encodedString.slice(0, maxLength);
    return decoder.decode(truncatedString).replace(/\uFFFD/g, "");
}
;
 //# sourceMappingURL=debugLogger.js.map
}),
"[project]/node_modules/@clerk/nextjs/dist/esm/utils/sdk-versions.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "isNext13",
    ()=>isNext13,
    "isNext16OrHigher",
    ()=>isNext16OrHigher,
    "isNextWithUnstableServerActions",
    ()=>isNextWithUnstableServerActions
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$package$2e$json__$28$json$29$__ = __turbopack_context__.i("[project]/node_modules/next/package.json (json)");
;
var _a, _b, _c, _d, _e, _f;
;
function meetsNextMinimumVersion(minimumMajorVersion) {
    var _a2;
    if (!((_a2 = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$package$2e$json__$28$json$29$__["default"]) == null ? void 0 : _a2.version)) {
        return false;
    }
    const majorVersion = parseInt(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$package$2e$json__$28$json$29$__["default"].version.split(".")[0], 10);
    return !isNaN(majorVersion) && majorVersion >= minimumMajorVersion;
}
const isNext13 = (_c = (_b = (_a = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$package$2e$json__$28$json$29$__["default"]) == null ? void 0 : _a.version) == null ? void 0 : _b.startsWith("13.")) != null ? _c : false;
const isNextWithUnstableServerActions = isNext13 || ((_f = (_e = (_d = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$package$2e$json__$28$json$29$__["default"]) == null ? void 0 : _d.version) == null ? void 0 : _e.startsWith("14.0")) != null ? _f : false);
const isNext16OrHigher = meetsNextMinimumVersion(16);
;
 //# sourceMappingURL=sdk-versions.js.map
}),
"[project]/node_modules/@clerk/nextjs/dist/esm/server/headers-utils.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "detectClerkMiddleware",
    ()=>detectClerkMiddleware,
    "getAuthKeyFromRequest",
    ()=>getAuthKeyFromRequest,
    "getCustomAttributeFromRequest",
    ()=>getCustomAttributeFromRequest,
    "getHeader",
    ()=>getHeader,
    "isNextRequest",
    ()=>isNextRequest,
    "isRequestWebAPI",
    ()=>isRequestWebAPI
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$backend$2f$dist$2f$internal$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/@clerk/backend/dist/internal.mjs [app-route] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$backend$2f$dist$2f$chunk$2d$LKXQFRRM$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/@clerk/backend/dist/chunk-LKXQFRRM.mjs [app-route] (ecmascript) <locals>");
;
;
function getCustomAttributeFromRequest(req, key) {
    return key in req ? req[key] : void 0;
}
function getAuthKeyFromRequest(req, key) {
    return getCustomAttributeFromRequest(req, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$backend$2f$dist$2f$chunk$2d$LKXQFRRM$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__["constants"].Attributes[key]) || getHeader(req, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$backend$2f$dist$2f$chunk$2d$LKXQFRRM$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__["constants"].Headers[key]);
}
function getHeader(req, name) {
    var _a, _b;
    if (isNextRequest(req) || isRequestWebAPI(req)) {
        return req.headers.get(name);
    }
    return req.headers[name] || req.headers[name.toLowerCase()] || ((_b = (_a = req.socket) == null ? void 0 : _a._httpMessage) == null ? void 0 : _b.getHeader(name));
}
function detectClerkMiddleware(req) {
    return Boolean(getAuthKeyFromRequest(req, "AuthStatus"));
}
function isNextRequest(val) {
    try {
        const { headers, nextUrl, cookies } = val || {};
        return typeof (headers == null ? void 0 : headers.get) === "function" && typeof (nextUrl == null ? void 0 : nextUrl.searchParams.get) === "function" && typeof (cookies == null ? void 0 : cookies.get) === "function";
    } catch  {
        return false;
    }
}
function isRequestWebAPI(val) {
    try {
        const { headers } = val || {};
        return typeof (headers == null ? void 0 : headers.get) === "function";
    } catch  {
        return false;
    }
}
;
 //# sourceMappingURL=headers-utils.js.map
}),
"[project]/node_modules/@clerk/nextjs/dist/esm/constants.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "constants",
    ()=>constants
]);
;
const Headers = {
    NextRewrite: "x-middleware-rewrite",
    NextResume: "x-middleware-next",
    NextRedirect: "Location",
    // Used by next to identify internal navigation for app router
    NextUrl: "next-url",
    NextAction: "next-action",
    // Used by next to identify internal navigation for pages router
    NextjsData: "x-nextjs-data"
};
const constants = {
    Headers
};
;
 //# sourceMappingURL=constants.js.map
}),
"[project]/node_modules/@clerk/nextjs/dist/esm/utils/feature-flags.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "canUseKeyless",
    ()=>canUseKeyless
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$utils$2f$index$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/@clerk/shared/dist/runtime/utils/index.mjs [app-route] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$runtimeEnvironment$2d$BB2sO$2d$19$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@clerk/shared/dist/runtime/runtimeEnvironment-BB2sO-19.mjs [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$server$2f$constants$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@clerk/nextjs/dist/esm/server/constants.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$utils$2f$sdk$2d$versions$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@clerk/nextjs/dist/esm/utils/sdk-versions.js [app-route] (ecmascript)");
;
;
;
;
const canUseKeyless = !__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$utils$2f$sdk$2d$versions$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["isNextWithUnstableServerActions"] && // Next.js will inline the value of 'development' or 'production' on the client bundle, so this is client-safe.
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$runtimeEnvironment$2d$BB2sO$2d$19$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["isDevelopmentEnvironment"])() && !__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$server$2f$constants$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["KEYLESS_DISABLED"];
;
 //# sourceMappingURL=feature-flags.js.map
}),
"[project]/node_modules/@clerk/nextjs/dist/esm/vendor/crypto-es.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AES",
    ()=>Ht,
    "HmacSHA1",
    ()=>Dt,
    "Utf8",
    ()=>X
]);
var kt = Object.defineProperty;
var bt = (c, t, s)=>t in c ? kt(c, t, {
        enumerable: !0,
        configurable: !0,
        writable: !0,
        value: s
    }) : c[t] = s;
var it = (c, t, s)=>bt(c, typeof t != "symbol" ? t + "" : t, s);
var lt, ht, dt, pt, xt, _t, at = ((lt = typeof globalThis != "undefined" ? globalThis : void 0) == null ? void 0 : lt.crypto) || ((ht = ("TURBOPACK compile-time truthy", 1) ? /*TURBOPACK member replacement*/ __turbopack_context__.g : "TURBOPACK unreachable") == null ? void 0 : ht.crypto) || ((dt = ("TURBOPACK compile-time falsy", 0) ? "TURBOPACK unreachable" : void 0) == null ? void 0 : dt.crypto) || ((pt = typeof self != "undefined" ? self : void 0) == null ? void 0 : pt.crypto) || ((_t = (xt = typeof frames != "undefined" ? frames : void 0) == null ? void 0 : xt[0]) == null ? void 0 : _t.crypto), Z;
at ? Z = (c)=>{
    let t = [];
    for(let s = 0, e; s < c; s += 4)t.push(at.getRandomValues(new Uint32Array(1))[0]);
    return new u(t, c);
} : Z = (c)=>{
    let t = [], s = (e)=>{
        let r = e, o = 987654321, n = 4294967295;
        return ()=>{
            o = 36969 * (o & 65535) + (o >> 16) & n, r = 18e3 * (r & 65535) + (r >> 16) & n;
            let h = (o << 16) + r & n;
            return h /= 4294967296, h += .5, h * (Math.random() > .5 ? 1 : -1);
        };
    };
    for(let e = 0, r; e < c; e += 4){
        let o = s((r || Math.random()) * 4294967296);
        r = o() * 987654071, t.push(o() * 4294967296 | 0);
    }
    return new u(t, c);
};
var m = class {
    static create(...t) {
        return new this(...t);
    }
    mixIn(t) {
        return Object.assign(this, t);
    }
    clone() {
        let t = new this.constructor;
        return Object.assign(t, this), t;
    }
}, u = class extends m {
    constructor(t = [], s = t.length * 4){
        super();
        let e = t;
        if (e instanceof ArrayBuffer && (e = new Uint8Array(e)), (e instanceof Int8Array || e instanceof Uint8ClampedArray || e instanceof Int16Array || e instanceof Uint16Array || e instanceof Int32Array || e instanceof Uint32Array || e instanceof Float32Array || e instanceof Float64Array) && (e = new Uint8Array(e.buffer, e.byteOffset, e.byteLength)), e instanceof Uint8Array) {
            let r = e.byteLength, o = [];
            for(let n = 0; n < r; n += 1)o[n >>> 2] |= e[n] << 24 - n % 4 * 8;
            this.words = o, this.sigBytes = r;
        } else this.words = t, this.sigBytes = s;
    }
    toString(t = Mt) {
        return t.stringify(this);
    }
    concat(t) {
        let s = this.words, e = t.words, r = this.sigBytes, o = t.sigBytes;
        if (this.clamp(), r % 4) for(let n = 0; n < o; n += 1){
            let h = e[n >>> 2] >>> 24 - n % 4 * 8 & 255;
            s[r + n >>> 2] |= h << 24 - (r + n) % 4 * 8;
        }
        else for(let n = 0; n < o; n += 4)s[r + n >>> 2] = e[n >>> 2];
        return this.sigBytes += o, this;
    }
    clamp() {
        let { words: t, sigBytes: s } = this;
        t[s >>> 2] &= 4294967295 << 32 - s % 4 * 8, t.length = Math.ceil(s / 4);
    }
    clone() {
        let t = super.clone.call(this);
        return t.words = this.words.slice(0), t;
    }
};
it(u, "random", Z);
var Mt = {
    stringify (c) {
        let { words: t, sigBytes: s } = c, e = [];
        for(let r = 0; r < s; r += 1){
            let o = t[r >>> 2] >>> 24 - r % 4 * 8 & 255;
            e.push((o >>> 4).toString(16)), e.push((o & 15).toString(16));
        }
        return e.join("");
    },
    parse (c) {
        let t = c.length, s = [];
        for(let e = 0; e < t; e += 2)s[e >>> 3] |= parseInt(c.substr(e, 2), 16) << 24 - e % 8 * 4;
        return new u(s, t / 2);
    }
}, ft = {
    stringify (c) {
        let { words: t, sigBytes: s } = c, e = [];
        for(let r = 0; r < s; r += 1){
            let o = t[r >>> 2] >>> 24 - r % 4 * 8 & 255;
            e.push(String.fromCharCode(o));
        }
        return e.join("");
    },
    parse (c) {
        let t = c.length, s = [];
        for(let e = 0; e < t; e += 1)s[e >>> 2] |= (c.charCodeAt(e) & 255) << 24 - e % 4 * 8;
        return new u(s, t);
    }
}, X = {
    stringify (c) {
        try {
            return decodeURIComponent(escape(ft.stringify(c)));
        } catch  {
            throw new Error("Malformed UTF-8 data");
        }
    },
    parse (c) {
        return ft.parse(unescape(encodeURIComponent(c)));
    }
}, N = class extends m {
    constructor(){
        super(), this._minBufferSize = 0;
    }
    reset() {
        this._data = new u, this._nDataBytes = 0;
    }
    _append(t) {
        let s = t;
        typeof s == "string" && (s = X.parse(s)), this._data.concat(s), this._nDataBytes += s.sigBytes;
    }
    _process(t) {
        let s, { _data: e, blockSize: r } = this, o = e.words, n = e.sigBytes, h = r * 4, x = n / h;
        t ? x = Math.ceil(x) : x = Math.max((x | 0) - this._minBufferSize, 0);
        let p = x * r, _ = Math.min(p * 4, n);
        if (p) {
            for(let y = 0; y < p; y += r)this._doProcessBlock(o, y);
            s = o.splice(0, p), e.sigBytes -= _;
        }
        return new u(s, _);
    }
    clone() {
        let t = super.clone.call(this);
        return t._data = this._data.clone(), t;
    }
}, H = class extends N {
    constructor(t){
        super(), this.blockSize = 512 / 32, this.cfg = Object.assign(new m, t), this.reset();
    }
    static _createHelper(t) {
        return (s, e)=>new t(e).finalize(s);
    }
    static _createHmacHelper(t) {
        return (s, e)=>new $(t, e).finalize(s);
    }
    reset() {
        super.reset.call(this), this._doReset();
    }
    update(t) {
        return this._append(t), this._process(), this;
    }
    finalize(t) {
        return t && this._append(t), this._doFinalize();
    }
}, $ = class extends m {
    constructor(t, s){
        super();
        let e = new t;
        this._hasher = e;
        let r = s;
        typeof r == "string" && (r = X.parse(r));
        let o = e.blockSize, n = o * 4;
        r.sigBytes > n && (r = e.finalize(s)), r.clamp();
        let h = r.clone();
        this._oKey = h;
        let x = r.clone();
        this._iKey = x;
        let p = h.words, _ = x.words;
        for(let y = 0; y < o; y += 1)p[y] ^= 1549556828, _[y] ^= 909522486;
        h.sigBytes = n, x.sigBytes = n, this.reset();
    }
    reset() {
        let t = this._hasher;
        t.reset(), t.update(this._iKey);
    }
    update(t) {
        return this._hasher.update(t), this;
    }
    finalize(t) {
        let s = this._hasher, e = s.finalize(t);
        return s.reset(), s.finalize(this._oKey.clone().concat(e));
    }
};
var zt = (c, t, s)=>{
    let e = [], r = 0;
    for(let o = 0; o < t; o += 1)if (o % 4) {
        let n = s[c.charCodeAt(o - 1)] << o % 4 * 2, h = s[c.charCodeAt(o)] >>> 6 - o % 4 * 2, x = n | h;
        e[r >>> 2] |= x << 24 - r % 4 * 8, r += 1;
    }
    return u.create(e, r);
}, tt = {
    stringify (c) {
        let { words: t, sigBytes: s } = c, e = this._map;
        c.clamp();
        let r = [];
        for(let n = 0; n < s; n += 3){
            let h = t[n >>> 2] >>> 24 - n % 4 * 8 & 255, x = t[n + 1 >>> 2] >>> 24 - (n + 1) % 4 * 8 & 255, p = t[n + 2 >>> 2] >>> 24 - (n + 2) % 4 * 8 & 255, _ = h << 16 | x << 8 | p;
            for(let y = 0; y < 4 && n + y * .75 < s; y += 1)r.push(e.charAt(_ >>> 6 * (3 - y) & 63));
        }
        let o = e.charAt(64);
        if (o) for(; r.length % 4;)r.push(o);
        return r.join("");
    },
    parse (c) {
        let t = c.length, s = this._map, e = this._reverseMap;
        if (!e) {
            this._reverseMap = [], e = this._reverseMap;
            for(let o = 0; o < s.length; o += 1)e[s.charCodeAt(o)] = o;
        }
        let r = s.charAt(64);
        if (r) {
            let o = c.indexOf(r);
            o !== -1 && (t = o);
        }
        return zt(c, t, e);
    },
    _map: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/="
};
var d = [];
for(let c = 0; c < 64; c += 1)d[c] = Math.abs(Math.sin(c + 1)) * 4294967296 | 0;
var w = (c, t, s, e, r, o, n)=>{
    let h = c + (t & s | ~t & e) + r + n;
    return (h << o | h >>> 32 - o) + t;
}, B = (c, t, s, e, r, o, n)=>{
    let h = c + (t & e | s & ~e) + r + n;
    return (h << o | h >>> 32 - o) + t;
}, k = (c, t, s, e, r, o, n)=>{
    let h = c + (t ^ s ^ e) + r + n;
    return (h << o | h >>> 32 - o) + t;
}, b = (c, t, s, e, r, o, n)=>{
    let h = c + (s ^ (t | ~e)) + r + n;
    return (h << o | h >>> 32 - o) + t;
}, L = class extends H {
    _doReset() {
        this._hash = new u([
            1732584193,
            4023233417,
            2562383102,
            271733878
        ]);
    }
    _doProcessBlock(t, s) {
        let e = t;
        for(let Y = 0; Y < 16; Y += 1){
            let ct = s + Y, G = t[ct];
            e[ct] = (G << 8 | G >>> 24) & 16711935 | (G << 24 | G >>> 8) & 4278255360;
        }
        let r = this._hash.words, o = e[s + 0], n = e[s + 1], h = e[s + 2], x = e[s + 3], p = e[s + 4], _ = e[s + 5], y = e[s + 6], M = e[s + 7], z = e[s + 8], v = e[s + 9], g = e[s + 10], O = e[s + 11], S = e[s + 12], P = e[s + 13], I = e[s + 14], W = e[s + 15], i = r[0], a = r[1], f = r[2], l = r[3];
        i = w(i, a, f, l, o, 7, d[0]), l = w(l, i, a, f, n, 12, d[1]), f = w(f, l, i, a, h, 17, d[2]), a = w(a, f, l, i, x, 22, d[3]), i = w(i, a, f, l, p, 7, d[4]), l = w(l, i, a, f, _, 12, d[5]), f = w(f, l, i, a, y, 17, d[6]), a = w(a, f, l, i, M, 22, d[7]), i = w(i, a, f, l, z, 7, d[8]), l = w(l, i, a, f, v, 12, d[9]), f = w(f, l, i, a, g, 17, d[10]), a = w(a, f, l, i, O, 22, d[11]), i = w(i, a, f, l, S, 7, d[12]), l = w(l, i, a, f, P, 12, d[13]), f = w(f, l, i, a, I, 17, d[14]), a = w(a, f, l, i, W, 22, d[15]), i = B(i, a, f, l, n, 5, d[16]), l = B(l, i, a, f, y, 9, d[17]), f = B(f, l, i, a, O, 14, d[18]), a = B(a, f, l, i, o, 20, d[19]), i = B(i, a, f, l, _, 5, d[20]), l = B(l, i, a, f, g, 9, d[21]), f = B(f, l, i, a, W, 14, d[22]), a = B(a, f, l, i, p, 20, d[23]), i = B(i, a, f, l, v, 5, d[24]), l = B(l, i, a, f, I, 9, d[25]), f = B(f, l, i, a, x, 14, d[26]), a = B(a, f, l, i, z, 20, d[27]), i = B(i, a, f, l, P, 5, d[28]), l = B(l, i, a, f, h, 9, d[29]), f = B(f, l, i, a, M, 14, d[30]), a = B(a, f, l, i, S, 20, d[31]), i = k(i, a, f, l, _, 4, d[32]), l = k(l, i, a, f, z, 11, d[33]), f = k(f, l, i, a, O, 16, d[34]), a = k(a, f, l, i, I, 23, d[35]), i = k(i, a, f, l, n, 4, d[36]), l = k(l, i, a, f, p, 11, d[37]), f = k(f, l, i, a, M, 16, d[38]), a = k(a, f, l, i, g, 23, d[39]), i = k(i, a, f, l, P, 4, d[40]), l = k(l, i, a, f, o, 11, d[41]), f = k(f, l, i, a, x, 16, d[42]), a = k(a, f, l, i, y, 23, d[43]), i = k(i, a, f, l, v, 4, d[44]), l = k(l, i, a, f, S, 11, d[45]), f = k(f, l, i, a, W, 16, d[46]), a = k(a, f, l, i, h, 23, d[47]), i = b(i, a, f, l, o, 6, d[48]), l = b(l, i, a, f, M, 10, d[49]), f = b(f, l, i, a, I, 15, d[50]), a = b(a, f, l, i, _, 21, d[51]), i = b(i, a, f, l, S, 6, d[52]), l = b(l, i, a, f, x, 10, d[53]), f = b(f, l, i, a, g, 15, d[54]), a = b(a, f, l, i, n, 21, d[55]), i = b(i, a, f, l, z, 6, d[56]), l = b(l, i, a, f, W, 10, d[57]), f = b(f, l, i, a, y, 15, d[58]), a = b(a, f, l, i, P, 21, d[59]), i = b(i, a, f, l, p, 6, d[60]), l = b(l, i, a, f, O, 10, d[61]), f = b(f, l, i, a, h, 15, d[62]), a = b(a, f, l, i, v, 21, d[63]), r[0] = r[0] + i | 0, r[1] = r[1] + a | 0, r[2] = r[2] + f | 0, r[3] = r[3] + l | 0;
    }
    _doFinalize() {
        let t = this._data, s = t.words, e = this._nDataBytes * 8, r = t.sigBytes * 8;
        s[r >>> 5] |= 128 << 24 - r % 32;
        let o = Math.floor(e / 4294967296), n = e;
        s[(r + 64 >>> 9 << 4) + 15] = (o << 8 | o >>> 24) & 16711935 | (o << 24 | o >>> 8) & 4278255360, s[(r + 64 >>> 9 << 4) + 14] = (n << 8 | n >>> 24) & 16711935 | (n << 24 | n >>> 8) & 4278255360, t.sigBytes = (s.length + 1) * 4, this._process();
        let h = this._hash, x = h.words;
        for(let p = 0; p < 4; p += 1){
            let _ = x[p];
            x[p] = (_ << 8 | _ >>> 24) & 16711935 | (_ << 24 | _ >>> 8) & 4278255360;
        }
        return h;
    }
    clone() {
        let t = super.clone.call(this);
        return t._hash = this._hash.clone(), t;
    }
}, St = H._createHelper(L), Pt = H._createHmacHelper(L);
var T = class extends m {
    constructor(t){
        super(), this.cfg = Object.assign(new m, {
            keySize: 128 / 32,
            hasher: L,
            iterations: 1
        }, t);
    }
    compute(t, s) {
        let e, { cfg: r } = this, o = r.hasher.create(), n = u.create(), h = n.words, { keySize: x, iterations: p } = r;
        for(; h.length < x;){
            e && o.update(e), e = o.update(t).finalize(s), o.reset();
            for(let _ = 1; _ < p; _ += 1)e = o.finalize(e), o.reset();
            n.concat(e);
        }
        return n.sigBytes = x * 4, n;
    }
};
var C = class extends N {
    constructor(t, s, e){
        super(), this.cfg = Object.assign(new m, e), this._xformMode = t, this._key = s, this.reset();
    }
    static createEncryptor(t, s) {
        return this.create(this._ENC_XFORM_MODE, t, s);
    }
    static createDecryptor(t, s) {
        return this.create(this._DEC_XFORM_MODE, t, s);
    }
    static _createHelper(t) {
        let s = (e)=>typeof e == "string" ? q : E;
        return {
            encrypt (e, r, o) {
                return s(r).encrypt(t, e, r, o);
            },
            decrypt (e, r, o) {
                return s(r).decrypt(t, e, r, o);
            }
        };
    }
    reset() {
        super.reset.call(this), this._doReset();
    }
    process(t) {
        return this._append(t), this._process();
    }
    finalize(t) {
        return t && this._append(t), this._doFinalize();
    }
};
C._ENC_XFORM_MODE = 1;
C._DEC_XFORM_MODE = 2;
C.keySize = 128 / 32;
C.ivSize = 128 / 32;
var et = class extends m {
    constructor(t, s){
        super(), this._cipher = t, this._iv = s;
    }
    static createEncryptor(t, s) {
        return this.Encryptor.create(t, s);
    }
    static createDecryptor(t, s) {
        return this.Decryptor.create(t, s);
    }
};
function yt(c, t, s) {
    let e = c, r, o = this._iv;
    o ? (r = o, this._iv = void 0) : r = this._prevBlock;
    for(let n = 0; n < s; n += 1)e[t + n] ^= r[n];
}
var j = class extends et {
};
j.Encryptor = class extends j {
    processBlock(c, t) {
        let s = this._cipher, { blockSize: e } = s;
        yt.call(this, c, t, e), s.encryptBlock(c, t), this._prevBlock = c.slice(t, t + e);
    }
};
j.Decryptor = class extends j {
    processBlock(c, t) {
        let s = this._cipher, { blockSize: e } = s, r = c.slice(t, t + e);
        s.decryptBlock(c, t), yt.call(this, c, t, e), this._prevBlock = r;
    }
};
var vt = {
    pad (c, t) {
        let s = t * 4, e = s - c.sigBytes % s, r = e << 24 | e << 16 | e << 8 | e, o = [];
        for(let h = 0; h < e; h += 4)o.push(r);
        let n = u.create(o, e);
        c.concat(n);
    },
    unpad (c) {
        let t = c, s = t.words[t.sigBytes - 1 >>> 2] & 255;
        t.sigBytes -= s;
    }
}, U = class extends C {
    constructor(t, s, e){
        super(t, s, Object.assign({
            mode: j,
            padding: vt
        }, e)), this.blockSize = 128 / 32;
    }
    reset() {
        let t;
        super.reset.call(this);
        let { cfg: s } = this, { iv: e, mode: r } = s;
        this._xformMode === this.constructor._ENC_XFORM_MODE ? t = r.createEncryptor : (t = r.createDecryptor, this._minBufferSize = 1), this._mode = t.call(r, this, e && e.words), this._mode.__creator = t;
    }
    _doProcessBlock(t, s) {
        this._mode.processBlock(t, s);
    }
    _doFinalize() {
        let t, { padding: s } = this.cfg;
        return this._xformMode === this.constructor._ENC_XFORM_MODE ? (s.pad(this._data, this.blockSize), t = this._process(!0)) : (t = this._process(!0), s.unpad(t)), t;
    }
}, V = class extends m {
    constructor(t){
        super(), this.mixIn(t);
    }
    toString(t) {
        return (t || this.formatter).stringify(this);
    }
}, Rt = {
    stringify (c) {
        let t, { ciphertext: s, salt: e } = c;
        return e ? t = u.create([
            1398893684,
            1701076831
        ]).concat(e).concat(s) : t = s, t.toString(tt);
    },
    parse (c) {
        let t, s = tt.parse(c), e = s.words;
        return e[0] === 1398893684 && e[1] === 1701076831 && (t = u.create(e.slice(2, 4)), e.splice(0, 4), s.sigBytes -= 16), V.create({
            ciphertext: s,
            salt: t
        });
    }
}, E = class extends m {
    static encrypt(t, s, e, r) {
        let o = Object.assign(new m, this.cfg, r), n = t.createEncryptor(e, o), h = n.finalize(s), x = n.cfg;
        return V.create({
            ciphertext: h,
            key: e,
            iv: x.iv,
            algorithm: t,
            mode: x.mode,
            padding: x.padding,
            blockSize: n.blockSize,
            formatter: o.format
        });
    }
    static decrypt(t, s, e, r) {
        let o = s, n = Object.assign(new m, this.cfg, r);
        return o = this._parse(o, n.format), t.createDecryptor(e, n).finalize(o.ciphertext);
    }
    static _parse(t, s) {
        return typeof t == "string" ? s.parse(t, this) : t;
    }
};
E.cfg = Object.assign(new m, {
    format: Rt
});
var Ft = {
    execute (c, t, s, e, r) {
        let o = e;
        o || (o = u.random(64 / 8));
        let n;
        r ? n = T.create({
            keySize: t + s,
            hasher: r
        }).compute(c, o) : n = T.create({
            keySize: t + s
        }).compute(c, o);
        let h = u.create(n.words.slice(t), s * 4);
        return n.sigBytes = t * 4, V.create({
            key: n,
            iv: h,
            salt: o
        });
    }
}, q = class extends E {
    static encrypt(t, s, e, r) {
        let o = Object.assign(new m, this.cfg, r), n = o.kdf.execute(e, t.keySize, t.ivSize, o.salt, o.hasher);
        o.iv = n.iv;
        let h = E.encrypt.call(this, t, s, n.key, o);
        return h.mixIn(n), h;
    }
    static decrypt(t, s, e, r) {
        let o = s, n = Object.assign(new m, this.cfg, r);
        o = this._parse(o, n.format);
        let h = n.kdf.execute(e, t.keySize, t.ivSize, o.salt, n.hasher);
        return n.iv = h.iv, E.decrypt.call(this, t, o, h.key, n);
    }
};
q.cfg = Object.assign(E.cfg, {
    kdf: Ft
});
var R = [], ut = [], gt = [], mt = [], wt = [], Bt = [], st = [], rt = [], ot = [], nt = [], A = [];
for(let c = 0; c < 256; c += 1)c < 128 ? A[c] = c << 1 : A[c] = c << 1 ^ 283;
var F = 0, D = 0;
for(let c = 0; c < 256; c += 1){
    let t = D ^ D << 1 ^ D << 2 ^ D << 3 ^ D << 4;
    t = t >>> 8 ^ t & 255 ^ 99, R[F] = t, ut[t] = F;
    let s = A[F], e = A[s], r = A[e], o = A[t] * 257 ^ t * 16843008;
    gt[F] = o << 24 | o >>> 8, mt[F] = o << 16 | o >>> 16, wt[F] = o << 8 | o >>> 24, Bt[F] = o, o = r * 16843009 ^ e * 65537 ^ s * 257 ^ F * 16843008, st[t] = o << 24 | o >>> 8, rt[t] = o << 16 | o >>> 16, ot[t] = o << 8 | o >>> 24, nt[t] = o, F ? (F = s ^ A[A[A[r ^ s]]], D ^= A[A[D]]) : (D = 1, F = D);
}
var At = [
    0,
    1,
    2,
    4,
    8,
    16,
    32,
    64,
    128,
    27,
    54
], J = class extends U {
    _doReset() {
        let t;
        if (this._nRounds && this._keyPriorReset === this._key) return;
        this._keyPriorReset = this._key;
        let s = this._keyPriorReset, e = s.words, r = s.sigBytes / 4;
        this._nRounds = r + 6;
        let n = (this._nRounds + 1) * 4;
        this._keySchedule = [];
        let h = this._keySchedule;
        for(let p = 0; p < n; p += 1)p < r ? h[p] = e[p] : (t = h[p - 1], p % r ? r > 6 && p % r === 4 && (t = R[t >>> 24] << 24 | R[t >>> 16 & 255] << 16 | R[t >>> 8 & 255] << 8 | R[t & 255]) : (t = t << 8 | t >>> 24, t = R[t >>> 24] << 24 | R[t >>> 16 & 255] << 16 | R[t >>> 8 & 255] << 8 | R[t & 255], t ^= At[p / r | 0] << 24), h[p] = h[p - r] ^ t);
        this._invKeySchedule = [];
        let x = this._invKeySchedule;
        for(let p = 0; p < n; p += 1){
            let _ = n - p;
            p % 4 ? t = h[_] : t = h[_ - 4], p < 4 || _ <= 4 ? x[p] = t : x[p] = st[R[t >>> 24]] ^ rt[R[t >>> 16 & 255]] ^ ot[R[t >>> 8 & 255]] ^ nt[R[t & 255]];
        }
    }
    encryptBlock(t, s) {
        this._doCryptBlock(t, s, this._keySchedule, gt, mt, wt, Bt, R);
    }
    decryptBlock(t, s) {
        let e = t, r = e[s + 1];
        e[s + 1] = e[s + 3], e[s + 3] = r, this._doCryptBlock(e, s, this._invKeySchedule, st, rt, ot, nt, ut), r = e[s + 1], e[s + 1] = e[s + 3], e[s + 3] = r;
    }
    _doCryptBlock(t, s, e, r, o, n, h, x) {
        let p = t, _ = this._nRounds, y = p[s] ^ e[0], M = p[s + 1] ^ e[1], z = p[s + 2] ^ e[2], v = p[s + 3] ^ e[3], g = 4;
        for(let W = 1; W < _; W += 1){
            let i = r[y >>> 24] ^ o[M >>> 16 & 255] ^ n[z >>> 8 & 255] ^ h[v & 255] ^ e[g];
            g += 1;
            let a = r[M >>> 24] ^ o[z >>> 16 & 255] ^ n[v >>> 8 & 255] ^ h[y & 255] ^ e[g];
            g += 1;
            let f = r[z >>> 24] ^ o[v >>> 16 & 255] ^ n[y >>> 8 & 255] ^ h[M & 255] ^ e[g];
            g += 1;
            let l = r[v >>> 24] ^ o[y >>> 16 & 255] ^ n[M >>> 8 & 255] ^ h[z & 255] ^ e[g];
            g += 1, y = i, M = a, z = f, v = l;
        }
        let O = (x[y >>> 24] << 24 | x[M >>> 16 & 255] << 16 | x[z >>> 8 & 255] << 8 | x[v & 255]) ^ e[g];
        g += 1;
        let S = (x[M >>> 24] << 24 | x[z >>> 16 & 255] << 16 | x[v >>> 8 & 255] << 8 | x[y & 255]) ^ e[g];
        g += 1;
        let P = (x[z >>> 24] << 24 | x[v >>> 16 & 255] << 16 | x[y >>> 8 & 255] << 8 | x[M & 255]) ^ e[g];
        g += 1;
        let I = (x[v >>> 24] << 24 | x[y >>> 16 & 255] << 16 | x[M >>> 8 & 255] << 8 | x[z & 255]) ^ e[g];
        g += 1, p[s] = O, p[s + 1] = S, p[s + 2] = P, p[s + 3] = I;
    }
};
J.keySize = 256 / 32;
var Ht = U._createHelper(J);
var K = [], Q = class extends H {
    _doReset() {
        this._hash = new u([
            1732584193,
            4023233417,
            2562383102,
            271733878,
            3285377520
        ]);
    }
    _doProcessBlock(t, s) {
        let e = this._hash.words, r = e[0], o = e[1], n = e[2], h = e[3], x = e[4];
        for(let p = 0; p < 80; p += 1){
            if (p < 16) K[p] = t[s + p] | 0;
            else {
                let y = K[p - 3] ^ K[p - 8] ^ K[p - 14] ^ K[p - 16];
                K[p] = y << 1 | y >>> 31;
            }
            let _ = (r << 5 | r >>> 27) + x + K[p];
            p < 20 ? _ += (o & n | ~o & h) + 1518500249 : p < 40 ? _ += (o ^ n ^ h) + 1859775393 : p < 60 ? _ += (o & n | o & h | n & h) - 1894007588 : _ += (o ^ n ^ h) - 899497514, x = h, h = n, n = o << 30 | o >>> 2, o = r, r = _;
        }
        e[0] = e[0] + r | 0, e[1] = e[1] + o | 0, e[2] = e[2] + n | 0, e[3] = e[3] + h | 0, e[4] = e[4] + x | 0;
    }
    _doFinalize() {
        let t = this._data, s = t.words, e = this._nDataBytes * 8, r = t.sigBytes * 8;
        return s[r >>> 5] |= 128 << 24 - r % 32, s[(r + 64 >>> 9 << 4) + 14] = Math.floor(e / 4294967296), s[(r + 64 >>> 9 << 4) + 15] = e, t.sigBytes = s.length * 4, this._process(), this._hash;
    }
    clone() {
        let t = super.clone.call(this);
        return t._hash = this._hash.clone(), t;
    }
}, Xt = H._createHelper(Q), Dt = H._createHmacHelper(Q);
;
}),
"[project]/node_modules/@clerk/nextjs/dist/esm/server/errors.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "authAuthHeaderMissing",
    ()=>authAuthHeaderMissing,
    "authSignatureInvalid",
    ()=>authSignatureInvalid,
    "encryptionKeyInvalid",
    ()=>encryptionKeyInvalid,
    "encryptionKeyInvalidDev",
    ()=>encryptionKeyInvalidDev,
    "getAuthAuthHeaderMissing",
    ()=>getAuthAuthHeaderMissing,
    "missingDomainAndProxy",
    ()=>missingDomainAndProxy,
    "missingSignInUrlInDev",
    ()=>missingSignInUrlInDev
]);
;
const missingDomainAndProxy = `
Missing domain and proxyUrl. A satellite application needs to specify a domain or a proxyUrl.

1) With middleware
   e.g. export default clerkMiddleware({domain:'YOUR_DOMAIN',isSatellite:true});
2) With environment variables e.g.
   NEXT_PUBLIC_CLERK_DOMAIN='YOUR_DOMAIN'
   NEXT_PUBLIC_CLERK_IS_SATELLITE='true'
   `;
const missingSignInUrlInDev = `
Invalid signInUrl. A satellite application requires a signInUrl for development instances.
Check if signInUrl is missing from your configuration or if it is not an absolute URL

1) With middleware
   e.g. export default clerkMiddleware({signInUrl:'SOME_URL', isSatellite:true});
2) With environment variables e.g.
   NEXT_PUBLIC_CLERK_SIGN_IN_URL='SOME_URL'
   NEXT_PUBLIC_CLERK_IS_SATELLITE='true'`;
const getAuthAuthHeaderMissing = ()=>authAuthHeaderMissing("getAuth");
const authAuthHeaderMissing = (helperName = "auth", prefixSteps)=>`Clerk: ${helperName}() was called but Clerk can't detect usage of clerkMiddleware(). Please ensure the following:
- ${prefixSteps ? [
        ...prefixSteps,
        ""
    ].join("\n- ") : " "}clerkMiddleware() is used in your Next.js Middleware.
- Your Middleware matcher is configured to match this route or page.
- If you are using the src directory, make sure the Middleware file is inside of it.

For more details, see https://clerk.com/err/auth-middleware
`;
const authSignatureInvalid = `Clerk: Unable to verify request, this usually means the Clerk middleware did not run. Ensure Clerk's middleware is properly integrated and matches the current route. For more information, see: https://clerk.com/docs/reference/nextjs/clerk-middleware. (code=auth_signature_invalid)`;
const encryptionKeyInvalid = `Clerk: Unable to decrypt request data, this usually means the encryption key is invalid. Ensure the encryption key is properly set. For more information, see: https://clerk.com/docs/reference/nextjs/clerk-middleware#dynamic-keys. (code=encryption_key_invalid)`;
const encryptionKeyInvalidDev = `Clerk: Unable to decrypt request data.

Refresh the page if your .env file was just updated. If the issue persists, ensure the encryption key is valid and properly set.

For more information, see: https://clerk.com/docs/reference/nextjs/clerk-middleware#dynamic-keys. (code=encryption_key_invalid)`;
;
 //# sourceMappingURL=errors.js.map
}),
"[project]/node_modules/@clerk/nextjs/dist/esm/server/errorThrower.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "errorThrower",
    ()=>errorThrower
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$error$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/@clerk/shared/dist/runtime/error.mjs [app-route] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$error$2d$Dl9xmUf3$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@clerk/shared/dist/runtime/error-Dl9xmUf3.mjs [app-route] (ecmascript)");
;
;
const errorThrower = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$error$2d$Dl9xmUf3$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["buildErrorThrower"])({
    packageName: "@clerk/nextjs"
});
;
 //# sourceMappingURL=errorThrower.js.map
}),
"[project]/node_modules/@clerk/nextjs/dist/esm/server/utils.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "assertAuthStatus",
    ()=>assertAuthStatus,
    "assertKey",
    ()=>assertKey,
    "assertTokenSignature",
    ()=>assertTokenSignature,
    "decorateRequest",
    ()=>decorateRequest,
    "decryptClerkRequestData",
    ()=>decryptClerkRequestData,
    "encryptClerkRequestData",
    ()=>encryptClerkRequestData,
    "handleMultiDomainAndProxy",
    ()=>handleMultiDomainAndProxy,
    "redirectAdapter",
    ()=>redirectAdapter,
    "setRequestHeadersOnNextResponse",
    ()=>setRequestHeadersOnNextResponse
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$backend$2f$dist$2f$internal$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/@clerk/backend/dist/internal.mjs [app-route] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$backend$2f$dist$2f$chunk$2d$LKXQFRRM$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/@clerk/backend/dist/chunk-LKXQFRRM.mjs [app-route] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$keys$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/@clerk/shared/dist/runtime/keys.mjs [app-route] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$keys$2d$YNv6yjKk$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@clerk/shared/dist/runtime/keys-YNv6yjKk.mjs [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$logger$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/@clerk/shared/dist/runtime/logger.mjs [app-route] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$logger$2d$B9q7E6uE$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@clerk/shared/dist/runtime/logger-B9q7E6uE.mjs [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$proxy$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/@clerk/shared/dist/runtime/proxy.mjs [app-route] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$proxy$2d$Bq8EHApG$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@clerk/shared/dist/runtime/proxy-Bq8EHApG.mjs [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$utils$2f$index$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/@clerk/shared/dist/runtime/utils/index.mjs [app-route] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$handleValueOrFn$2d$CcwnRX$2d$K$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@clerk/shared/dist/runtime/handleValueOrFn-CcwnRX-K.mjs [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$runtimeEnvironment$2d$BB2sO$2d$19$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@clerk/shared/dist/runtime/runtimeEnvironment-BB2sO-19.mjs [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$constants$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@clerk/nextjs/dist/esm/constants.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$utils$2f$feature$2d$flags$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@clerk/nextjs/dist/esm/utils/feature-flags.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$vendor$2f$crypto$2d$es$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@clerk/nextjs/dist/esm/vendor/crypto-es.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$server$2f$constants$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@clerk/nextjs/dist/esm/server/constants.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$server$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@clerk/nextjs/dist/esm/server/errors.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$server$2f$errorThrower$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@clerk/nextjs/dist/esm/server/errorThrower.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$server$2f$headers$2d$utils$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@clerk/nextjs/dist/esm/server/headers-utils.js [app-route] (ecmascript)");
;
;
;
;
;
;
;
;
;
;
;
;
;
;
const OVERRIDE_HEADERS = "x-middleware-override-headers";
const MIDDLEWARE_HEADER_PREFIX = "x-middleware-request";
const setRequestHeadersOnNextResponse = (res, req, newHeaders)=>{
    if (!res.headers.get(OVERRIDE_HEADERS)) {
        res.headers.set(OVERRIDE_HEADERS, [
            ...req.headers.keys()
        ]);
        req.headers.forEach((val, key)=>{
            res.headers.set(`${MIDDLEWARE_HEADER_PREFIX}-${key}`, val);
        });
    }
    Object.entries(newHeaders).forEach(([key, val])=>{
        res.headers.set(OVERRIDE_HEADERS, `${res.headers.get(OVERRIDE_HEADERS)},${key}`);
        res.headers.set(`${MIDDLEWARE_HEADER_PREFIX}-${key}`, val);
    });
};
function decorateRequest(req, res, requestState, requestData, keylessMode, machineAuthObject) {
    const { reason, message, status, token } = requestState;
    if (!res) {
        res = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].next();
    }
    if (res.headers.get(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$constants$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["constants"].Headers.NextRedirect)) {
        return res;
    }
    let rewriteURL;
    if (res.headers.get(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$constants$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["constants"].Headers.NextResume) === "1") {
        res.headers.delete(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$constants$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["constants"].Headers.NextResume);
        rewriteURL = new URL(req.url);
    }
    const rewriteURLHeader = res.headers.get(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$constants$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["constants"].Headers.NextRewrite);
    if (rewriteURLHeader) {
        const reqURL = new URL(req.url);
        rewriteURL = new URL(rewriteURLHeader);
        if (rewriteURL.origin !== reqURL.origin) {
            return res;
        }
    }
    if (rewriteURL) {
        const clerkRequestData = encryptClerkRequestData(requestData, keylessMode, machineAuthObject);
        setRequestHeadersOnNextResponse(res, req, {
            [__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$backend$2f$dist$2f$chunk$2d$LKXQFRRM$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__["constants"].Headers.AuthStatus]: status,
            [__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$backend$2f$dist$2f$chunk$2d$LKXQFRRM$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__["constants"].Headers.AuthToken]: token || "",
            [__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$backend$2f$dist$2f$chunk$2d$LKXQFRRM$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__["constants"].Headers.AuthSignature]: token ? createTokenSignature(token, (requestData == null ? void 0 : requestData.secretKey) || __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$server$2f$constants$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["SECRET_KEY"] || keylessMode.secretKey || "") : "",
            [__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$backend$2f$dist$2f$chunk$2d$LKXQFRRM$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__["constants"].Headers.AuthMessage]: message || "",
            [__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$backend$2f$dist$2f$chunk$2d$LKXQFRRM$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__["constants"].Headers.AuthReason]: reason || "",
            [__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$backend$2f$dist$2f$chunk$2d$LKXQFRRM$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__["constants"].Headers.ClerkUrl]: req.clerkUrl.toString(),
            ...clerkRequestData ? {
                [__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$backend$2f$dist$2f$chunk$2d$LKXQFRRM$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__["constants"].Headers.ClerkRequestData]: clerkRequestData
            } : {}
        });
        res.headers.set(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$constants$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["constants"].Headers.NextRewrite, rewriteURL.href);
    }
    return res;
}
const handleMultiDomainAndProxy = (clerkRequest, opts)=>{
    const relativeOrAbsoluteProxyUrl = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$handleValueOrFn$2d$CcwnRX$2d$K$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["handleValueOrFn"])(opts == null ? void 0 : opts.proxyUrl, clerkRequest.clerkUrl, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$server$2f$constants$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["PROXY_URL"]);
    let proxyUrl;
    if (!!relativeOrAbsoluteProxyUrl && !(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$proxy$2d$Bq8EHApG$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["isHttpOrHttps"])(relativeOrAbsoluteProxyUrl)) {
        proxyUrl = new URL(relativeOrAbsoluteProxyUrl, clerkRequest.clerkUrl).toString();
    } else {
        proxyUrl = relativeOrAbsoluteProxyUrl;
    }
    const isSatellite = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$handleValueOrFn$2d$CcwnRX$2d$K$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["handleValueOrFn"])(opts.isSatellite, new URL(clerkRequest.url), __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$server$2f$constants$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["IS_SATELLITE"]);
    const domain = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$handleValueOrFn$2d$CcwnRX$2d$K$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["handleValueOrFn"])(opts.domain, new URL(clerkRequest.url), __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$server$2f$constants$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["DOMAIN"]);
    const signInUrl = (opts == null ? void 0 : opts.signInUrl) || __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$server$2f$constants$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["SIGN_IN_URL"];
    if (isSatellite && !proxyUrl && !domain) {
        throw new Error(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$server$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["missingDomainAndProxy"]);
    }
    if (isSatellite && !(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$proxy$2d$Bq8EHApG$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["isHttpOrHttps"])(signInUrl) && (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$keys$2d$YNv6yjKk$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["isDevelopmentFromSecretKey"])(opts.secretKey || __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$server$2f$constants$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["SECRET_KEY"])) {
        throw new Error(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$server$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["missingSignInUrlInDev"]);
    }
    return {
        proxyUrl,
        isSatellite,
        domain,
        signInUrl
    };
};
const redirectAdapter = (url)=>{
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].redirect(url, {
        headers: {
            [__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$backend$2f$dist$2f$chunk$2d$LKXQFRRM$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__["constants"].Headers.ClerkRedirectTo]: "true"
        }
    });
};
function assertAuthStatus(req, error) {
    if (!(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$server$2f$headers$2d$utils$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["detectClerkMiddleware"])(req)) {
        throw new Error(error);
    }
}
function assertKey(key, onError) {
    if (!key) {
        onError();
    }
    return key;
}
function createTokenSignature(token, key) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$vendor$2f$crypto$2d$es$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["HmacSHA1"])(token, key).toString();
}
function assertTokenSignature(token, key, signature) {
    if (!signature) {
        throw new Error(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$server$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["authSignatureInvalid"]);
    }
    const expectedSignature = createTokenSignature(token, key);
    if (expectedSignature !== signature) {
        throw new Error(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$server$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["authSignatureInvalid"]);
    }
}
const KEYLESS_ENCRYPTION_KEY = "clerk_keyless_dummy_key";
function encryptClerkRequestData(requestData, keylessModeKeys, machineAuthObject) {
    const isEmpty = (obj)=>{
        if (!obj) {
            return true;
        }
        return !Object.values(obj).some((v)=>v !== void 0);
    };
    if (isEmpty(requestData) && isEmpty(keylessModeKeys) && !machineAuthObject) {
        return;
    }
    if (requestData.secretKey && !__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$server$2f$constants$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ENCRYPTION_KEY"]) {
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$logger$2d$B9q7E6uE$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["logger"].warnOnce("Clerk: Missing `CLERK_ENCRYPTION_KEY`. Required for propagating `secretKey` middleware option. See docs: https://clerk.com/docs/reference/nextjs/clerk-middleware#dynamic-keys");
        return;
    }
    const maybeKeylessEncryptionKey = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$runtimeEnvironment$2d$BB2sO$2d$19$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["isProductionEnvironment"])() ? __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$server$2f$constants$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ENCRYPTION_KEY"] || assertKey(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$server$2f$constants$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["SECRET_KEY"], ()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$server$2f$errorThrower$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["errorThrower"].throwMissingSecretKeyError()) : __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$server$2f$constants$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ENCRYPTION_KEY"] || __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$server$2f$constants$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["SECRET_KEY"] || KEYLESS_ENCRYPTION_KEY;
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$vendor$2f$crypto$2d$es$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["AES"].encrypt(JSON.stringify({
        ...keylessModeKeys,
        ...requestData,
        machineAuthObject: machineAuthObject != null ? machineAuthObject : void 0
    }), maybeKeylessEncryptionKey).toString();
}
function decryptClerkRequestData(encryptedRequestData) {
    if (!encryptedRequestData) {
        return {};
    }
    const maybeKeylessEncryptionKey = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$runtimeEnvironment$2d$BB2sO$2d$19$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["isProductionEnvironment"])() ? __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$server$2f$constants$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ENCRYPTION_KEY"] || __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$server$2f$constants$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["SECRET_KEY"] : __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$server$2f$constants$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ENCRYPTION_KEY"] || __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$server$2f$constants$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["SECRET_KEY"] || KEYLESS_ENCRYPTION_KEY;
    try {
        return decryptData(encryptedRequestData, maybeKeylessEncryptionKey);
    } catch  {
        if (__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$utils$2f$feature$2d$flags$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["canUseKeyless"]) {
            try {
                return decryptData(encryptedRequestData, KEYLESS_ENCRYPTION_KEY);
            } catch  {
                throwInvalidEncryptionKey();
            }
        }
        throwInvalidEncryptionKey();
    }
}
function throwInvalidEncryptionKey() {
    if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$runtimeEnvironment$2d$BB2sO$2d$19$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["isProductionEnvironment"])()) {
        throw new Error(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$server$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["encryptionKeyInvalid"]);
    }
    throw new Error(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$server$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["encryptionKeyInvalidDev"]);
}
function decryptData(data, key) {
    const decryptedBytes = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$vendor$2f$crypto$2d$es$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["AES"].decrypt(data, key);
    const encoded = decryptedBytes.toString(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$vendor$2f$crypto$2d$es$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["Utf8"]);
    return JSON.parse(encoded);
}
;
 //# sourceMappingURL=utils.js.map
}),
"[project]/node_modules/@clerk/nextjs/dist/esm/server/data/getAuthDataFromRequest.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "getAuthDataFromRequest",
    ()=>getAuthDataFromRequest,
    "getSessionAuthDataFromRequest",
    ()=>getSessionAuthDataFromRequest
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$backend$2f$dist$2f$internal$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/@clerk/backend/dist/internal.mjs [app-route] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$backend$2f$dist$2f$chunk$2d$LKXQFRRM$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/@clerk/backend/dist/chunk-LKXQFRRM.mjs [app-route] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$backend$2f$dist$2f$jwt$2f$index$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@clerk/backend/dist/jwt/index.mjs [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$server$2f$constants$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@clerk/nextjs/dist/esm/server/constants.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$server$2f$headers$2d$utils$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@clerk/nextjs/dist/esm/server/headers-utils.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$server$2f$utils$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@clerk/nextjs/dist/esm/server/utils.js [app-route] (ecmascript)");
;
;
;
;
;
;
const getAuthHeaders = (req)=>{
    return {
        authStatus: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$server$2f$headers$2d$utils$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getAuthKeyFromRequest"])(req, "AuthStatus"),
        authToken: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$server$2f$headers$2d$utils$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getAuthKeyFromRequest"])(req, "AuthToken"),
        authMessage: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$server$2f$headers$2d$utils$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getAuthKeyFromRequest"])(req, "AuthMessage"),
        authReason: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$server$2f$headers$2d$utils$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getAuthKeyFromRequest"])(req, "AuthReason"),
        authSignature: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$server$2f$headers$2d$utils$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getAuthKeyFromRequest"])(req, "AuthSignature")
    };
};
const createAuthOptions = (req, opts, treatPendingAsSignedOut = true)=>{
    const encryptedRequestData = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$server$2f$headers$2d$utils$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getHeader"])(req, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$backend$2f$dist$2f$chunk$2d$LKXQFRRM$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__["constants"].Headers.ClerkRequestData);
    const decryptedRequestData = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$server$2f$utils$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["decryptClerkRequestData"])(encryptedRequestData);
    return {
        secretKey: (opts == null ? void 0 : opts.secretKey) || decryptedRequestData.secretKey || __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$server$2f$constants$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["SECRET_KEY"],
        publishableKey: decryptedRequestData.publishableKey || __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$server$2f$constants$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["PUBLISHABLE_KEY"],
        apiUrl: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$server$2f$constants$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["API_URL"],
        apiVersion: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$server$2f$constants$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["API_VERSION"],
        authStatus: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$server$2f$headers$2d$utils$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getAuthKeyFromRequest"])(req, "AuthStatus"),
        authMessage: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$server$2f$headers$2d$utils$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getAuthKeyFromRequest"])(req, "AuthMessage"),
        authReason: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$server$2f$headers$2d$utils$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getAuthKeyFromRequest"])(req, "AuthReason"),
        treatPendingAsSignedOut
    };
};
const getSessionAuthDataFromRequest = (req, { treatPendingAsSignedOut = true, ...opts } = {})=>{
    var _a, _b;
    const { authStatus, authMessage, authReason, authToken, authSignature } = getAuthHeaders(req);
    (_a = opts.logger) == null ? void 0 : _a.debug("headers", {
        authStatus,
        authMessage,
        authReason
    });
    const options = createAuthOptions(req, opts, treatPendingAsSignedOut);
    if (!(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$backend$2f$dist$2f$chunk$2d$LKXQFRRM$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__["isTokenTypeAccepted"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$backend$2f$dist$2f$chunk$2d$LKXQFRRM$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__["TokenType"].SessionToken, opts.acceptsToken || __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$backend$2f$dist$2f$chunk$2d$LKXQFRRM$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__["TokenType"].SessionToken)) {
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$backend$2f$dist$2f$chunk$2d$LKXQFRRM$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__["signedOutAuthObject"])(options);
    }
    let authObject;
    if (!authStatus || authStatus !== __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$backend$2f$dist$2f$chunk$2d$LKXQFRRM$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__["AuthStatus"].SignedIn) {
        authObject = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$backend$2f$dist$2f$chunk$2d$LKXQFRRM$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__["signedOutAuthObject"])(options);
    } else {
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$server$2f$utils$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["assertTokenSignature"])(authToken, options.secretKey, authSignature);
        const jwt = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$backend$2f$dist$2f$jwt$2f$index$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["decodeJwt"])(authToken);
        (_b = opts.logger) == null ? void 0 : _b.debug("jwt", jwt.raw);
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$backend$2f$dist$2f$chunk$2d$LKXQFRRM$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__["getAuthObjectFromJwt"])(jwt, options);
    }
    return authObject;
};
const getAuthDataFromRequest = (req, opts = {})=>{
    var _a, _b;
    const { authStatus, authMessage, authReason } = getAuthHeaders(req);
    (_a = opts.logger) == null ? void 0 : _a.debug("headers", {
        authStatus,
        authMessage,
        authReason
    });
    const encryptedRequestData = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$server$2f$headers$2d$utils$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getHeader"])(req, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$backend$2f$dist$2f$chunk$2d$LKXQFRRM$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__["constants"].Headers.ClerkRequestData);
    const decryptedRequestData = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$server$2f$utils$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["decryptClerkRequestData"])(encryptedRequestData);
    const bearerToken = (_b = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$server$2f$headers$2d$utils$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getHeader"])(req, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$backend$2f$dist$2f$chunk$2d$LKXQFRRM$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__["constants"].Headers.Authorization)) == null ? void 0 : _b.replace("Bearer ", "");
    const acceptsToken = opts.acceptsToken || __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$backend$2f$dist$2f$chunk$2d$LKXQFRRM$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__["TokenType"].SessionToken;
    const options = createAuthOptions(req, opts);
    const machineAuthObject = handleMachineToken(bearerToken, decryptedRequestData.machineAuthObject, acceptsToken, options);
    if (machineAuthObject) {
        return machineAuthObject;
    }
    if (bearerToken && Array.isArray(acceptsToken) && !acceptsToken.includes(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$backend$2f$dist$2f$chunk$2d$LKXQFRRM$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__["TokenType"].SessionToken)) {
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$backend$2f$dist$2f$chunk$2d$LKXQFRRM$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__["invalidTokenAuthObject"])();
    }
    return getSessionAuthDataFromRequest(req, opts);
};
const handleMachineToken = (bearerToken, rawAuthObject, acceptsToken, options)=>{
    const hasMachineToken = bearerToken && (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$backend$2f$dist$2f$chunk$2d$LKXQFRRM$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__["isMachineTokenByPrefix"])(bearerToken);
    const acceptsOnlySessionToken = acceptsToken === __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$backend$2f$dist$2f$chunk$2d$LKXQFRRM$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__["TokenType"].SessionToken || Array.isArray(acceptsToken) && acceptsToken.length === 1 && acceptsToken[0] === __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$backend$2f$dist$2f$chunk$2d$LKXQFRRM$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__["TokenType"].SessionToken;
    if (hasMachineToken && rawAuthObject && !acceptsOnlySessionToken) {
        const authObject = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$backend$2f$dist$2f$chunk$2d$LKXQFRRM$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__["getAuthObjectForAcceptedToken"])({
            authObject: {
                ...rawAuthObject,
                debug: ()=>options
            },
            acceptsToken
        });
        return {
            ...authObject,
            getToken: ()=>authObject.isAuthenticated ? Promise.resolve(bearerToken) : Promise.resolve(null),
            has: ()=>false
        };
    }
    return null;
};
;
 //# sourceMappingURL=getAuthDataFromRequest.js.map
}),
"[project]/node_modules/@clerk/nextjs/dist/esm/server/createGetAuth.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "createAsyncGetAuth",
    ()=>createAsyncGetAuth,
    "createSyncGetAuth",
    ()=>createSyncGetAuth,
    "getAuth",
    ()=>getAuth
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$backend$2f$dist$2f$internal$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/@clerk/backend/dist/internal.mjs [app-route] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$backend$2f$dist$2f$chunk$2d$LKXQFRRM$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/@clerk/backend/dist/chunk-LKXQFRRM.mjs [app-route] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$underscore$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/@clerk/shared/dist/runtime/underscore.mjs [app-route] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$underscore$2d$DjQrhefX$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@clerk/shared/dist/runtime/underscore-DjQrhefX.mjs [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$utils$2f$debugLogger$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@clerk/nextjs/dist/esm/utils/debugLogger.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$utils$2f$sdk$2d$versions$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@clerk/nextjs/dist/esm/utils/sdk-versions.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$server$2f$data$2f$getAuthDataFromRequest$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@clerk/nextjs/dist/esm/server/data/getAuthDataFromRequest.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$server$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@clerk/nextjs/dist/esm/server/errors.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$server$2f$headers$2d$utils$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@clerk/nextjs/dist/esm/server/headers-utils.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$server$2f$utils$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@clerk/nextjs/dist/esm/server/utils.js [app-route] (ecmascript)");
;
;
;
;
;
;
;
;
;
const createAsyncGetAuth = ({ debugLoggerName, noAuthStatusMessage })=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$utils$2f$debugLogger$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["withLogger"])(debugLoggerName, (logger)=>{
        return async (req, opts)=>{
            if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$underscore$2d$DjQrhefX$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["isTruthy"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$server$2f$headers$2d$utils$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getHeader"])(req, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$backend$2f$dist$2f$chunk$2d$LKXQFRRM$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__["constants"].Headers.EnableDebug))) {
                logger.enable();
            }
            if (!(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$server$2f$headers$2d$utils$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["detectClerkMiddleware"])(req)) {
                if (__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$utils$2f$sdk$2d$versions$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["isNextWithUnstableServerActions"]) {
                    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$server$2f$utils$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["assertAuthStatus"])(req, noAuthStatusMessage);
                }
                const missConfiguredMiddlewareLocation = await __turbopack_context__.A("[project]/node_modules/@clerk/nextjs/dist/esm/server/fs/middleware-location.js [app-route] (ecmascript, async loader)").then((m)=>m.suggestMiddlewareLocation()).catch(()=>void 0);
                if (missConfiguredMiddlewareLocation) {
                    throw new Error(missConfiguredMiddlewareLocation);
                }
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$server$2f$utils$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["assertAuthStatus"])(req, noAuthStatusMessage);
            }
            const getAuthDataFromRequest = (req2, opts2 = {})=>{
                return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$server$2f$data$2f$getAuthDataFromRequest$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getAuthDataFromRequest"])(req2, {
                    ...opts2,
                    logger,
                    acceptsToken: opts2 == null ? void 0 : opts2.acceptsToken
                });
            };
            return getAuthDataFromRequest(req, {
                ...opts,
                logger,
                acceptsToken: opts == null ? void 0 : opts.acceptsToken
            });
        };
    });
const createSyncGetAuth = ({ debugLoggerName, noAuthStatusMessage })=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$utils$2f$debugLogger$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["withLogger"])(debugLoggerName, (logger)=>{
        return (req, opts)=>{
            if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$underscore$2d$DjQrhefX$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["isTruthy"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$server$2f$headers$2d$utils$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getHeader"])(req, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$backend$2f$dist$2f$chunk$2d$LKXQFRRM$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__["constants"].Headers.EnableDebug))) {
                logger.enable();
            }
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$server$2f$utils$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["assertAuthStatus"])(req, noAuthStatusMessage);
            const getAuthDataFromRequest = (req2, opts2 = {})=>{
                return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$server$2f$data$2f$getAuthDataFromRequest$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getSessionAuthDataFromRequest"])(req2, {
                    ...opts2,
                    logger,
                    acceptsToken: opts2 == null ? void 0 : opts2.acceptsToken
                });
            };
            return getAuthDataFromRequest(req, {
                ...opts,
                logger,
                acceptsToken: opts == null ? void 0 : opts.acceptsToken
            });
        };
    });
const getAuth = createSyncGetAuth({
    debugLoggerName: "getAuth()",
    noAuthStatusMessage: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$server$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getAuthAuthHeaderMissing"])()
});
;
 //# sourceMappingURL=createGetAuth.js.map
}),
"[project]/node_modules/@clerk/nextjs/dist/esm/server/nextErrors.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "HTTP_ERROR_FALLBACK_ERROR_CODE",
    ()=>HTTP_ERROR_FALLBACK_ERROR_CODE,
    "isHTTPAccessFallbackError",
    ()=>isHTTPAccessFallbackError,
    "isLegacyNextjsNotFoundError",
    ()=>isLegacyNextjsNotFoundError,
    "isNextjsNotFoundError",
    ()=>isNextjsNotFoundError,
    "isNextjsRedirectError",
    ()=>isNextjsRedirectError,
    "isNextjsUnauthorizedError",
    ()=>isNextjsUnauthorizedError,
    "isRedirectToSignInError",
    ()=>isRedirectToSignInError,
    "isRedirectToSignUpError",
    ()=>isRedirectToSignUpError,
    "nextjsRedirectError",
    ()=>nextjsRedirectError,
    "redirectToSignInError",
    ()=>redirectToSignInError,
    "redirectToSignUpError",
    ()=>redirectToSignUpError,
    "unauthorized",
    ()=>unauthorized,
    "whichHTTPAccessFallbackError",
    ()=>whichHTTPAccessFallbackError
]);
;
const CONTROL_FLOW_ERROR = {
    REDIRECT_TO_URL: "CLERK_PROTECT_REDIRECT_TO_URL",
    REDIRECT_TO_SIGN_IN: "CLERK_PROTECT_REDIRECT_TO_SIGN_IN",
    REDIRECT_TO_SIGN_UP: "CLERK_PROTECT_REDIRECT_TO_SIGN_UP"
};
const LEGACY_NOT_FOUND_ERROR_CODE = "NEXT_NOT_FOUND";
function isLegacyNextjsNotFoundError(error) {
    if (typeof error !== "object" || error === null || !("digest" in error)) {
        return false;
    }
    return error.digest === LEGACY_NOT_FOUND_ERROR_CODE;
}
const HTTPAccessErrorStatusCodes = {
    NOT_FOUND: 404,
    FORBIDDEN: 403,
    UNAUTHORIZED: 401
};
const ALLOWED_CODES = new Set(Object.values(HTTPAccessErrorStatusCodes));
const HTTP_ERROR_FALLBACK_ERROR_CODE = "NEXT_HTTP_ERROR_FALLBACK";
function isHTTPAccessFallbackError(error) {
    if (typeof error !== "object" || error === null || !("digest" in error) || typeof error.digest !== "string") {
        return false;
    }
    const [prefix, httpStatus] = error.digest.split(";");
    return prefix === HTTP_ERROR_FALLBACK_ERROR_CODE && ALLOWED_CODES.has(Number(httpStatus));
}
function whichHTTPAccessFallbackError(error) {
    if (!isHTTPAccessFallbackError(error)) {
        return void 0;
    }
    const [, httpStatus] = error.digest.split(";");
    return Number(httpStatus);
}
function isNextjsNotFoundError(error) {
    return isLegacyNextjsNotFoundError(error) || // Checks for the error thrown from `notFound()` for canary versions of next@15
    whichHTTPAccessFallbackError(error) === HTTPAccessErrorStatusCodes.NOT_FOUND;
}
const REDIRECT_ERROR_CODE = "NEXT_REDIRECT";
function nextjsRedirectError(url, extra, type = "replace", statusCode = 307) {
    const error = new Error(REDIRECT_ERROR_CODE);
    error.digest = `${REDIRECT_ERROR_CODE};${type};${url};${statusCode};`;
    error.clerk_digest = CONTROL_FLOW_ERROR.REDIRECT_TO_URL;
    Object.assign(error, extra);
    throw error;
}
function buildReturnBackUrl(url, returnBackUrl) {
    return returnBackUrl === null ? "" : returnBackUrl || url;
}
function redirectToSignInError(url, returnBackUrl) {
    nextjsRedirectError(url, {
        clerk_digest: CONTROL_FLOW_ERROR.REDIRECT_TO_SIGN_IN,
        returnBackUrl: buildReturnBackUrl(url, returnBackUrl)
    });
}
function redirectToSignUpError(url, returnBackUrl) {
    nextjsRedirectError(url, {
        clerk_digest: CONTROL_FLOW_ERROR.REDIRECT_TO_SIGN_UP,
        returnBackUrl: buildReturnBackUrl(url, returnBackUrl)
    });
}
function isNextjsRedirectError(error) {
    if (typeof error !== "object" || error === null || !("digest" in error) || typeof error.digest !== "string") {
        return false;
    }
    const digest = error.digest.split(";");
    const [errorCode, type] = digest;
    const destination = digest.slice(2, -2).join(";");
    const status = digest.at(-2);
    const statusCode = Number(status);
    return errorCode === REDIRECT_ERROR_CODE && (type === "replace" || type === "push") && typeof destination === "string" && !isNaN(statusCode) && statusCode === 307;
}
function isRedirectToSignInError(error) {
    if (isNextjsRedirectError(error) && "clerk_digest" in error) {
        return error.clerk_digest === CONTROL_FLOW_ERROR.REDIRECT_TO_SIGN_IN;
    }
    return false;
}
function isRedirectToSignUpError(error) {
    if (isNextjsRedirectError(error) && "clerk_digest" in error) {
        return error.clerk_digest === CONTROL_FLOW_ERROR.REDIRECT_TO_SIGN_UP;
    }
    return false;
}
function isNextjsUnauthorizedError(error) {
    return whichHTTPAccessFallbackError(error) === HTTPAccessErrorStatusCodes.UNAUTHORIZED;
}
function unauthorized() {
    const error = new Error(HTTP_ERROR_FALLBACK_ERROR_CODE);
    error.digest = `${HTTP_ERROR_FALLBACK_ERROR_CODE};${HTTPAccessErrorStatusCodes.UNAUTHORIZED}`;
    throw error;
}
;
 //# sourceMappingURL=nextErrors.js.map
}),
"[project]/node_modules/@clerk/nextjs/dist/esm/server/nextFetcher.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "isNextFetcher",
    ()=>isNextFetcher
]);
;
function isNextFetcher(fetch) {
    return "__nextPatched" in fetch && fetch.__nextPatched === true;
}
;
 //# sourceMappingURL=nextFetcher.js.map
}),
"[project]/node_modules/@clerk/nextjs/dist/esm/server/protect.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "createProtect",
    ()=>createProtect
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$backend$2f$dist$2f$internal$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/@clerk/backend/dist/internal.mjs [app-route] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$backend$2f$dist$2f$chunk$2d$LKXQFRRM$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/@clerk/backend/dist/chunk-LKXQFRRM.mjs [app-route] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$constants$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@clerk/nextjs/dist/esm/constants.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$server$2f$nextFetcher$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@clerk/nextjs/dist/esm/server/nextFetcher.js [app-route] (ecmascript)");
;
;
;
;
function createProtect(opts) {
    const { redirectToSignIn, authObject, redirect, notFound, request, unauthorized } = opts;
    return async (...args)=>{
        var _a, _b, _c, _d, _e, _f;
        const paramsOrFunction = getAuthorizationParams(args[0]);
        const unauthenticatedUrl = ((_a = args[0]) == null ? void 0 : _a.unauthenticatedUrl) || ((_b = args[1]) == null ? void 0 : _b.unauthenticatedUrl);
        const unauthorizedUrl = ((_c = args[0]) == null ? void 0 : _c.unauthorizedUrl) || ((_d = args[1]) == null ? void 0 : _d.unauthorizedUrl);
        const requestedToken = ((_e = args[0]) == null ? void 0 : _e.token) || ((_f = args[1]) == null ? void 0 : _f.token) || __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$backend$2f$dist$2f$chunk$2d$LKXQFRRM$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__["TokenType"].SessionToken;
        const handleUnauthenticated = ()=>{
            if (unauthenticatedUrl) {
                return redirect(unauthenticatedUrl);
            }
            if (isPageRequest(request)) {
                return redirectToSignIn();
            }
            return notFound();
        };
        const handleUnauthorized = ()=>{
            if (authObject.tokenType !== __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$backend$2f$dist$2f$chunk$2d$LKXQFRRM$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__["TokenType"].SessionToken) {
                return unauthorized();
            }
            if (unauthorizedUrl) {
                return redirect(unauthorizedUrl);
            }
            return notFound();
        };
        if (!(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$backend$2f$dist$2f$chunk$2d$LKXQFRRM$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__["isTokenTypeAccepted"])(authObject.tokenType, requestedToken)) {
            return handleUnauthorized();
        }
        if (authObject.tokenType !== __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$backend$2f$dist$2f$chunk$2d$LKXQFRRM$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__["TokenType"].SessionToken) {
            if (!authObject.isAuthenticated) {
                return handleUnauthorized();
            }
            return authObject;
        }
        if (authObject.sessionStatus === "pending") {
            return handleUnauthenticated();
        }
        if (!authObject.userId) {
            return handleUnauthenticated();
        }
        if (!paramsOrFunction) {
            return authObject;
        }
        if (typeof paramsOrFunction === "function") {
            if (paramsOrFunction(authObject.has)) {
                return authObject;
            }
            return handleUnauthorized();
        }
        if (authObject.has(paramsOrFunction)) {
            return authObject;
        }
        return handleUnauthorized();
    };
}
const getAuthorizationParams = (arg)=>{
    if (!arg) {
        return void 0;
    }
    if (arg.unauthenticatedUrl || arg.unauthorizedUrl || arg.token) {
        return void 0;
    }
    if (Object.keys(arg).length === 1 && "token" in arg) {
        return void 0;
    }
    return arg;
};
const isServerActionRequest = (req)=>{
    var _a, _b;
    return !!req.headers.get(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$constants$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["constants"].Headers.NextUrl) && (((_a = req.headers.get(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$backend$2f$dist$2f$chunk$2d$LKXQFRRM$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__["constants"].Headers.Accept)) == null ? void 0 : _a.includes("text/x-component")) || ((_b = req.headers.get(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$backend$2f$dist$2f$chunk$2d$LKXQFRRM$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__["constants"].Headers.ContentType)) == null ? void 0 : _b.includes("multipart/form-data")) || !!req.headers.get(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$constants$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["constants"].Headers.NextAction));
};
const isPageRequest = (req)=>{
    var _a;
    return req.headers.get(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$backend$2f$dist$2f$chunk$2d$LKXQFRRM$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__["constants"].Headers.SecFetchDest) === "document" || req.headers.get(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$backend$2f$dist$2f$chunk$2d$LKXQFRRM$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__["constants"].Headers.SecFetchDest) === "iframe" || ((_a = req.headers.get(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$backend$2f$dist$2f$chunk$2d$LKXQFRRM$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__["constants"].Headers.Accept)) == null ? void 0 : _a.includes("text/html")) || isAppRouterInternalNavigation(req) || isPagesRouterInternalNavigation(req);
};
const isAppRouterInternalNavigation = (req)=>!!req.headers.get(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$constants$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["constants"].Headers.NextUrl) && !isServerActionRequest(req) || isPagePathAvailable();
const isPagePathAvailable = ()=>{
    const __fetch = globalThis.fetch;
    if (!(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$server$2f$nextFetcher$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["isNextFetcher"])(__fetch)) {
        return false;
    }
    const { page, pagePath } = __fetch.__nextGetStaticStore().getStore() || {};
    return Boolean(// available on next@14
    pagePath || // available on next@15
    page);
};
const isPagesRouterInternalNavigation = (req)=>!!req.headers.get(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$constants$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["constants"].Headers.NextjsData);
;
 //# sourceMappingURL=protect.js.map
}),
"[project]/node_modules/@clerk/nextjs/dist/esm/app-router/server/utils.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "buildRequestLike",
    ()=>buildRequestLike,
    "getScriptNonceFromHeader",
    ()=>getScriptNonceFromHeader,
    "isPrerenderingBailout",
    ()=>isPrerenderingBailout
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
;
;
const isPrerenderingBailout = (e)=>{
    if (!(e instanceof Error) || !("message" in e)) {
        return false;
    }
    const { message } = e;
    const lowerCaseInput = message.toLowerCase();
    const dynamicServerUsage = lowerCaseInput.includes("dynamic server usage");
    const bailOutPrerendering = lowerCaseInput.includes("this page needs to bail out of prerendering");
    const routeRegex = /Route .*? needs to bail out of prerendering at this point because it used .*?./;
    return routeRegex.test(message) || dynamicServerUsage || bailOutPrerendering;
};
async function buildRequestLike() {
    try {
        const { headers } = await __turbopack_context__.A("[project]/node_modules/next/headers.js [app-route] (ecmascript, async loader)");
        const resolvedHeaders = await headers();
        return new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextRequest"]("https://placeholder.com", {
            headers: resolvedHeaders
        });
    } catch (e) {
        if (e && isPrerenderingBailout(e)) {
            throw e;
        }
        throw new Error(`Clerk: auth(), currentUser() and clerkClient(), are only supported in App Router (/app directory).
If you're using /pages, try getAuth() instead.
Original error: ${e}`);
    }
}
function getScriptNonceFromHeader(cspHeaderValue) {
    var _a;
    const directives = cspHeaderValue.split(";").map((directive2)=>directive2.trim());
    const directive = directives.find((dir)=>dir.startsWith("script-src")) || directives.find((dir)=>dir.startsWith("default-src"));
    if (!directive) {
        return;
    }
    const nonce = (_a = directive.split(" ").slice(1).map((source)=>source.trim()).find((source)=>source.startsWith("'nonce-") && source.length > 8 && source.endsWith("'"))) == null ? void 0 : _a.slice(7, -1);
    if (!nonce) {
        return;
    }
    if (/[&><\u2028\u2029]/g.test(nonce)) {
        throw new Error("Nonce value from Content-Security-Policy contained invalid HTML escape characters, which is disallowed for security reasons. Make sure that your nonce value does not contain the following characters: `<`, `>`, `&`");
    }
    return nonce;
}
;
 //# sourceMappingURL=utils.js.map
}),
"[project]/node_modules/@clerk/nextjs/dist/esm/app-router/server/auth.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "auth",
    ()=>auth
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$backend$2f$dist$2f$internal$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/@clerk/backend/dist/internal.mjs [app-route] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$backend$2f$dist$2f$chunk$2d$LKXQFRRM$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/@clerk/backend/dist/chunk-LKXQFRRM.mjs [app-route] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$api$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/next/dist/api/navigation.react-server.js [app-route] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/client/components/navigation.react-server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$server$2f$constants$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@clerk/nextjs/dist/esm/server/constants.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$server$2f$createGetAuth$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@clerk/nextjs/dist/esm/server/createGetAuth.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$server$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@clerk/nextjs/dist/esm/server/errors.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$server$2f$headers$2d$utils$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@clerk/nextjs/dist/esm/server/headers-utils.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$server$2f$nextErrors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@clerk/nextjs/dist/esm/server/nextErrors.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$server$2f$protect$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@clerk/nextjs/dist/esm/server/protect.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$server$2f$utils$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@clerk/nextjs/dist/esm/server/utils.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$utils$2f$sdk$2d$versions$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@clerk/nextjs/dist/esm/utils/sdk-versions.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$app$2d$router$2f$server$2f$utils$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@clerk/nextjs/dist/esm/app-router/server/utils.js [app-route] (ecmascript)");
;
;
;
;
;
;
;
;
;
;
;
;
const auth = async (options)=>{
    var _a;
    __turbopack_context__.r("[project]/node_modules/next/dist/compiled/server-only/empty.js [app-route] (ecmascript)");
    const request = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$app$2d$router$2f$server$2f$utils$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["buildRequestLike"])();
    const stepsBasedOnSrcDirectory = async ()=>{
        if (__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$utils$2f$sdk$2d$versions$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["isNextWithUnstableServerActions"]) {
            return [];
        }
        try {
            const isSrcAppDir = await __turbopack_context__.A("[project]/node_modules/@clerk/nextjs/dist/esm/server/fs/middleware-location.js [app-route] (ecmascript, async loader)").then((m)=>m.hasSrcAppDir());
            const fileName = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$utils$2f$sdk$2d$versions$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["isNext16OrHigher"] ? "middleware.(ts|js) or proxy.(ts|js)" : "middleware.(ts|js)";
            return [
                `Your Middleware exists at ./${isSrcAppDir ? "src/" : ""}${fileName}`
            ];
        } catch  {
            return [];
        }
    };
    const authObject = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$server$2f$createGetAuth$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["createAsyncGetAuth"])({
        debugLoggerName: "auth()",
        noAuthStatusMessage: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$server$2f$errors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["authAuthHeaderMissing"])("auth", await stepsBasedOnSrcDirectory())
    })(request, {
        treatPendingAsSignedOut: options == null ? void 0 : options.treatPendingAsSignedOut,
        acceptsToken: (_a = options == null ? void 0 : options.acceptsToken) != null ? _a : __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$backend$2f$dist$2f$chunk$2d$LKXQFRRM$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__["TokenType"].SessionToken
    });
    const clerkUrl = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$server$2f$headers$2d$utils$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getAuthKeyFromRequest"])(request, "ClerkUrl");
    const createRedirectForRequest = (...args)=>{
        const { returnBackUrl } = args[0] || {};
        const clerkRequest = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$backend$2f$dist$2f$chunk$2d$LKXQFRRM$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__["createClerkRequest"])(request);
        const devBrowserToken = clerkRequest.clerkUrl.searchParams.get(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$backend$2f$dist$2f$chunk$2d$LKXQFRRM$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__["constants"].QueryParameters.DevBrowser) || clerkRequest.cookies.get(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$backend$2f$dist$2f$chunk$2d$LKXQFRRM$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__["constants"].Cookies.DevBrowser);
        const encryptedRequestData = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$server$2f$headers$2d$utils$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getHeader"])(request, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$backend$2f$dist$2f$chunk$2d$LKXQFRRM$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__["constants"].Headers.ClerkRequestData);
        const decryptedRequestData = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$server$2f$utils$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["decryptClerkRequestData"])(encryptedRequestData);
        return [
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$backend$2f$dist$2f$chunk$2d$LKXQFRRM$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__["createRedirect"])({
                redirectAdapter: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["redirect"],
                devBrowserToken,
                baseUrl: clerkRequest.clerkUrl.toString(),
                publishableKey: decryptedRequestData.publishableKey || __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$server$2f$constants$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["PUBLISHABLE_KEY"],
                signInUrl: decryptedRequestData.signInUrl || __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$server$2f$constants$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["SIGN_IN_URL"],
                signUpUrl: decryptedRequestData.signUpUrl || __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$server$2f$constants$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["SIGN_UP_URL"],
                sessionStatus: authObject.tokenType === __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$backend$2f$dist$2f$chunk$2d$LKXQFRRM$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__["TokenType"].SessionToken ? authObject.sessionStatus : null
            }),
            returnBackUrl === null ? "" : returnBackUrl || (clerkUrl == null ? void 0 : clerkUrl.toString())
        ];
    };
    const redirectToSignIn = (opts = {})=>{
        const [r, returnBackUrl] = createRedirectForRequest(opts);
        return r.redirectToSignIn({
            returnBackUrl
        });
    };
    const redirectToSignUp = (opts = {})=>{
        const [r, returnBackUrl] = createRedirectForRequest(opts);
        return r.redirectToSignUp({
            returnBackUrl
        });
    };
    if (authObject.tokenType === __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$backend$2f$dist$2f$chunk$2d$LKXQFRRM$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__["TokenType"].SessionToken) {
        return Object.assign(authObject, {
            redirectToSignIn,
            redirectToSignUp
        });
    }
    return authObject;
};
auth.protect = async (...args)=>{
    var _a, _b;
    __turbopack_context__.r("[project]/node_modules/next/dist/compiled/server-only/empty.js [app-route] (ecmascript)");
    const request = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$app$2d$router$2f$server$2f$utils$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["buildRequestLike"])();
    const requestedToken = ((_a = args == null ? void 0 : args[0]) == null ? void 0 : _a.token) || ((_b = args == null ? void 0 : args[1]) == null ? void 0 : _b.token) || __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$backend$2f$dist$2f$chunk$2d$LKXQFRRM$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__["TokenType"].SessionToken;
    const authObject = await auth({
        acceptsToken: requestedToken
    });
    const protect = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$server$2f$protect$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["createProtect"])({
        request,
        authObject,
        redirectToSignIn: authObject.redirectToSignIn,
        notFound: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["notFound"],
        redirect: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["redirect"],
        unauthorized: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$server$2f$nextErrors$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["unauthorized"]
    });
    return protect(...args);
};
;
 //# sourceMappingURL=auth.js.map
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__e0e7055b._.js.map