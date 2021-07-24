import { strict as assert } from 'assert';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { Buffer } from 'buffer';
import mocha from 'mocha';
import zlib, { createDeflateRaw, deflateRaw, constants } from 'zlib';
import inflate from '../dist/index.module.js';

const uncompressed = readFileSync(resolve() + '/test/lorem.txt');

mocha.describe('tiny-inflate', async () => {
	/**
	 * @type {Uint8Array}
	 */
	let compressed;
	/**
	 * @type {Uint8Array}
	 */
	let noCompression;
	/**
	 * @type {Uint8Array}
	 */
	let fixed;

	/**
	 * @param {Buffer} buf
	 * @param {zlib.ZlibOptions} options
	 * @param {function(reject:string|null, resolve:Uint8Array|Buffer):void} fn
	 */
	function deflate(buf, options, fn) {
		/**
		 * @type {Uint8Array[]}
		 */
		var chunks = [];
		createDeflateRaw(options)
			.on('data', function (chunk) {
				chunks.push(chunk);
			})
			.on('error', fn)
			.on('end', function () {
				fn(null, Buffer.concat(chunks));
			})
			.end(buf);
	}

	mocha.before(function (done) {
		deflateRaw(uncompressed, function (_err, data) {
			compressed = data;
			done();
		});
	});

	mocha.before(function (done) {
		deflate(
			uncompressed,
			{ level: constants.Z_NO_COMPRESSION },
			(_err, data) => {
				noCompression = data;
				done();
			}
		);
	});

	mocha.before(function (done) {
		deflate(
			uncompressed,
			{ strategy: constants.Z_FIXED },
			(_err, data) => {
				fixed = data;
				done();
			}
		);
	});

	mocha.it('should inflate some data', function () {
		var out = Buffer.alloc(uncompressed.length);
		inflate(compressed, out);
		assert.strict.deepEqual(out, uncompressed);
	});

	mocha.it('should slice output buffer', function () {
		var out = Buffer.alloc(uncompressed.length + 1024);
		var res = inflate(compressed, out);
		assert.strict.deepEqual(res, uncompressed);
		assert.strict.equal(res.length, uncompressed.length);
	});

	mocha.it('should handle uncompressed blocks', function () {
		var out = Buffer.alloc(uncompressed.length);
		inflate(noCompression, out);
		assert.deepEqual(out, uncompressed);
	});

	mocha.it('should handle fixed huffman blocks', function () {
		var out = Buffer.alloc(uncompressed.length);
		inflate(fixed, out);
		assert.strict.deepEqual(out, uncompressed);
	});

	mocha.it('should handle typed arrays', function () {
		var input = new Uint8Array(compressed);
		var out = new Uint8Array(uncompressed.length);
		inflate(input, out);
		assert.strict.deepEqual(out, new Uint8Array(uncompressed));
	});
});
