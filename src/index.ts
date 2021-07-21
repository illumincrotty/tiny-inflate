const OK = 0;
const DATA_ERROR = -3;

class Tree {
	/**table of code length counts */
	table = new Uint16Array(16);
	/**code -> symbol translation table */
	trans = new Uint16Array(288);
}

class Data {
	sourceIndex = 0;
	tag = 0;
	bitCount = 0;
	destLen = 0;
	/** dynamic length/symbol tree */
	lengthTree = new Tree();
	/** dynamic distance tree */
	distanceTree = new Tree();
	source: Buffer | Uint8Array;
	dest: Buffer | Uint8Array;

	constructor(
		source: Buffer | Uint8Array,
		dest: Buffer | Uint8Array
	) {
		this.source = source;
		this.dest = dest;
	}
}

/*-------------------------------------------------------*
 *---- uninitialized global data (static structures) ----*
 *-------------------------------------------------------*/

const staticLengthTree = new Tree();
const staticDistanceTree = new Tree();

/* extra bits and base tables for length codes */
const length_bits = new Uint8Array(30);
const length_base = new Uint16Array(30);

/* extra bits and base tables for distance codes */
const dist_bits = new Uint8Array(30);
const dist_base = new Uint16Array(30);

/* special ordering of code length codes */
const clcidx = new Uint8Array([
	16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15,
]);

/* used by tinf_decode_trees, avoids allocations every call */
const code_tree = new Tree();
const lengths = new Uint8Array(288 + 32);

/* --------------------------- *
 * ---- utility functions ---- *
 * --------------------------- */

/** build extra bits and base tables */
function buildBitAndBaseTables(
	bits: Uint8Array,
	base: Uint16Array,
	delta: number,
	first: number
) {
	/* build bits table */
	for (let i = 0; i < delta; ++i) bits[i] = 0;
	for (let i = 0; i < 30 - delta; ++i)
		bits[i + delta] = (i / delta) | 0;

	/* build base table */
	for (let i = 0, sum = first; i < 30; ++i) {
		base[i] = sum;
		sum += 1 << bits[i];
	}
}

/**build the fixed huffman trees*/
function tinf_build_fixed_trees(
	lengthTree: Tree,
	distanceTree: Tree
) {
	let i = 0;

	/* build fixed length tree */
	for (i = 0; i < 7; ++i) lengthTree.table[i] = 0;

	lengthTree.table[7] = 24;
	lengthTree.table[8] = 152;
	lengthTree.table[9] = 112;

	for (i = 0; i < 24; ++i) lengthTree.trans[i] = 256 + i;
	for (i = 0; i < 144; ++i) lengthTree.trans[24 + i] = i;
	for (i = 0; i < 8; ++i) lengthTree.trans[24 + 144 + i] = 280 + i;
	for (i = 0; i < 112; ++i)
		lengthTree.trans[24 + 144 + 8 + i] = 144 + i;

	/* build fixed distance tree */
	for (i = 0; i < 5; ++i) distanceTree.table[i] = 0;

	distanceTree.table[5] = 32;

	for (i = 0; i < 32; ++i) distanceTree.trans[i] = i;
}

/* given an array of code lengths, build a tree */
const offsets = new Uint16Array(16);

function tinf_build_tree(
	tree: Tree,
	lengths: Uint8Array,
	offset: number,
	num: number
) {
	let i, sum;

	/* clear code length count table */
	for (i = 0; i < 16; ++i) tree.table[i] = 0;

	/* scan symbol lengths, and sum code length counts */
	for (i = 0; i < num; ++i) tree.table[lengths[offset + i]]++;

	tree.table[0] = 0;

	/* compute offset table for distribution sort */
	for (sum = 0, i = 0; i < 16; ++i) {
		offsets[i] = sum;
		sum += tree.table[i];
	}

	/* create code->symbol translation table (symbols sorted by code) */
	for (i = 0; i < num; ++i) {
		if (lengths[offset + i])
			tree.trans[offsets[lengths[offset + i]]++] = i;
	}
}

/* -------------------------- *
 * ---- decode functions ---- *
 * -------------------------- */

/**get one bit from source stream */
function getNextBit(d: Data) {
	/* check if tag is empty */
	if (!d.bitCount--) {
		/* load next tag */
		d.tag = d.source[d.sourceIndex++];
		d.bitCount = 7;
	}

	/* shift bit out of tag */
	const bit = d.tag & 1;
	d.tag >>>= 1;

	return bit;
}

/** read a num bit value from a stream and add base */
function readBits(d: Data, num: number, base: number) {
	if (!num) return base;

	while (d.bitCount < 24) {
		d.tag |= d.source[d.sourceIndex++] << d.bitCount;
		d.bitCount += 8;
	}

	const val = d.tag & (0xffff >>> (16 - num));
	d.tag >>>= num;
	d.bitCount -= num;
	return val + base;
}

/** given a data stream and a tree, decode a symbol */
function decodeSymbols(d: Data, t: Tree) {
	while (d.bitCount < 24) {
		d.tag |= d.source[d.sourceIndex++] << d.bitCount;
		d.bitCount += 8;
	}

	let sum = 0,
		cur = 0,
		len = 0;
	let tag = d.tag;

	/* get more bits while code value is above sum */
	do {
		cur = 2 * cur + (tag & 1);
		tag >>>= 1;
		++len;

		sum += t.table[len];
		cur -= t.table[len];
	} while (cur >= 0);

	d.tag = tag;
	d.bitCount -= len;

	return t.trans[sum + cur];
}

/* given a data stream, decode dynamic trees from it */
function tinf_decode_trees(
	data: Data,
	lengthTree: Tree,
	distanceTree: Tree
) {
	let i, num, length;

	/* get 5 bits HLIT (257-286) */
	const hlit = readBits(data, 5, 257);

	/* get 5 bits HDIST (1-32) */
	const hdist = readBits(data, 5, 1);

	/* get 4 bits HCLEN (4-19) */
	const hclen = readBits(data, 4, 4);

	for (i = 0; i < 19; ++i) lengths[i] = 0;

	/* read code lengths for code length alphabet */
	for (i = 0; i < hclen; ++i) {
		/* get 3 bits code length (0-7) */
		const codeLength = readBits(data, 3, 0);
		lengths[clcidx[i]] = codeLength;
	}

	/* build code length tree */
	tinf_build_tree(code_tree, lengths, 0, 19);

	/* decode code lengths for the dynamic trees */
	for (num = 0; num < hlit + hdist; ) {
		const sym = decodeSymbols(data, code_tree);

		switch (sym) {
			case 16: {
				/* copy previous code length 3-6 times (read 2 bits) */
				const prev = lengths[num - 1];
				for (
					length = readBits(data, 2, 3);
					length;
					--length
				) {
					lengths[num++] = prev;
				}
				break;
			}
			case 17: {
				/* repeat code length 0 for 3-10 times (read 3 bits) */
				for (
					length = readBits(data, 3, 3);
					length;
					--length
				) {
					lengths[num++] = 0;
				}
				break;
			}
			case 18: {
				/* repeat code length 0 for 11-138 times (read 7 bits) */
				for (
					length = readBits(data, 7, 11);
					length;
					--length
				) {
					lengths[num++] = 0;
				}
				break;
			}
			default: {
				/* values 0-15 represent the actual code lengths */
				lengths[num++] = sym;
				break;
			}
		}
	}

	/* build dynamic trees */
	tinf_build_tree(lengthTree, lengths, 0, hlit);
	tinf_build_tree(distanceTree, lengths, hlit, hdist);
}

/* ----------------------------- *
 * -- block inflate functions -- *
 * ----------------------------- */
/* given a stream and two trees, inflate a block of data */
function tinf_inflate_block_data(
	data: Data,
	lengthTree: Tree,
	distanceTree: Tree
) {
	let sym = decodeSymbols(data, lengthTree);
	while (sym !== 256) {
		if (sym < 256) {
			data.dest[data.destLen++] = sym;
		} else {
			let i;

			sym -= 257;

			/* possibly get more bits from length code */
			const length = readBits(
				data,
				length_bits[sym],
				length_base[sym]
			);

			const dist = decodeSymbols(data, distanceTree);

			/* possibly get more bits from distance code */
			const offsets =
				data.destLen -
				readBits(data, dist_bits[dist], dist_base[dist]);

			/* copy match */
			for (i = offsets; i < offsets + length; ++i) {
				data.dest[data.destLen++] = data.dest[i];
			}
		}
		sym = decodeSymbols(data, lengthTree);
	}
	return OK;
}

/* inflate an uncompressed block of data */
/**
 * @param {Data} d
 */
function inflateUncompressedBlock(d: Data) {
	let length, lengthComplement;

	/* unread from bitbuffer */
	while (d.bitCount > 8) {
		d.sourceIndex--;
		d.bitCount -= 8;
	}

	/* get length */
	length = d.source[d.sourceIndex + 1];
	length = 256 * length + d.source[d.sourceIndex];

	/* get one's complement of length */
	lengthComplement = d.source[d.sourceIndex + 3];
	lengthComplement =
		256 * lengthComplement + d.source[d.sourceIndex + 2];

	/* check length */
	if (length !== (~lengthComplement & 0x0000ffff))
		return DATA_ERROR;

	d.sourceIndex += 4;

	/* copy block */
	for (let i = length; i; --i)
		d.dest[d.destLen++] = d.source[d.sourceIndex++];

	/* make sure we start next block on a byte boundary */
	d.bitCount = 0;

	return OK;
}

/* inflate stream from source to dest */
function inflate(
	source: Buffer | Uint8Array,
	dest: Buffer | Uint8Array
): Buffer | Uint8Array {
	const d = new Data(source, dest);
	let bitFinal: number, bitType: number, result: number;

	do {
		/* read final block flag */
		bitFinal = getNextBit(d);

		/* read block type (2 bits) */
		bitType = readBits(d, 2, 0);

		/* decompress block */
		switch (bitType) {
			case 0:
				/* decompress uncompressed block */
				result = inflateUncompressedBlock(d);
				break;
			case 1:
				/* decompress block with fixed huffman trees */
				result =
					tinf_inflate_block_data(
						d,
						staticLengthTree,
						staticDistanceTree
					) || 0;
				break;
			case 2:
				/* decompress block with dynamic huffman trees */
				tinf_decode_trees(d, d.lengthTree, d.distanceTree);
				result =
					tinf_inflate_block_data(
						d,
						d.lengthTree,
						d.distanceTree
					) || 0;
				break;
			default:
				result = DATA_ERROR;
		}

		if (result !== OK) throw new Error('Data error');
	} while (!bitFinal);

	if (d.destLen < d.dest.length) {
		if (typeof d.dest.slice === 'function')
			return d.dest.slice(0, d.destLen);
		else return d.dest.subarray(0, d.destLen);
	}

	return d.dest;
}

/* ------------------------ *
 * ---- initialization ---- *
 * ------------------------ */

/* build fixed huffman trees */
tinf_build_fixed_trees(staticLengthTree, staticDistanceTree);

/* build extra bits and base tables */
buildBitAndBaseTables(length_bits, length_base, 4, 3);
buildBitAndBaseTables(dist_bits, dist_base, 2, 1);

/* fix a special case */
length_bits[28] = 0;
length_base[28] = 258;

export default inflate;
