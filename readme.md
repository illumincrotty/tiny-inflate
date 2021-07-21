# Mini Inflate

<!-- PROJECT LOGO -->
<img src="https://i.imgur.com/emKXzqK.png" alt="logo" width="200"/>

<!-- Shields -->
![npm](https://img.shields.io/npm/l/mini_inflate.svg)
![size-badge](https://img.badgesize.io/https:/unpkg.com/mini_inflate/dist/index.modern.js?compression=brotli)
![dependency-count-badge](https://badgen.net/bundlephobia/dependency-count/mini_inflate)
![Types](https://badgen.net/npm/types/mini_inflate)

- [Mini Inflate](#mini-inflate)
  - [About the Project](#about-the-project)
  - [Install](#install)
    - [Package Manager](#package-manager)
    - [CDN](#cdn)
  - [Usage](#usage)
  - [Example](#example)
  - [Similar Tools](#similar-tools)
  - [License](#license)
  - [Contact](#contact)
  
## About the Project

This is an update and port to typescript of Devon Govett [port](https://github.com/foliojs/tiny-inflate/) of Joergen Ibsen's [tiny inflate](https://bitbucket.org/jibsen/tinf). Minified it is about 3KB and after brotli it barely break 1 kb. It's also dependency free!

## Install

### Package Manager

#### NPM <!-- omit in TOC -->

```sh
npm i mini_inflate
```

#### PNPM <!-- omit in TOC -->

```sh
pnpm add mini_inflate
```

#### Yarn <!-- omit in TOC -->

```sh
yarn add mini_inflate
```

### CDN

#### Skypack <!-- omit in TOC -->

For Web and Deno, no install is required! Just put this line at the top of your file:

```typescript
import { inflate } from 'https://cdn.skypack.dev/mini_inflate';
```

If you want type support with skypack, follow the directions [here]('https://docs.skypack.dev/skypack-cdn/code/javascript#using-skypack-urls-in-typescript')

#### UNPKG <!-- omit in TOC -->

```html
<script src="https://unpkg.com/mini_inflate"></script>
```

And use it like you would any other package from UNPKG

## Usage

Here's the great part. Unsurprisingly, the dead simple pubsub is really easy to use!
Thanks to [microbundle](https://github.com/developit/microbundle), this package supports CJS, UMD, and ESM formats.
That means that wherever and however you use this package — in browser or node, with import or require — you *should* be set, no configuration required.

## Example

To use mini_inflate, you need two things: a buffer of data compressed with deflate,
and the decompressed size (often stored in a file header) to allocate your output buffer.
Input and output buffers can be either node `Buffer`s, or `Uint8Array`s.

```javascript
var inflate = require('tiny-inflate');

var compressedBuffer = new Bufer([ ... ]);
var decompressedSize = ...;
var outputBuffer = new Buffer(decompressedSize);

inflate(compressedBuffer, outputBuffer);
```

## Similar Tools

If this tool isn't working for you, try one of these:

- [pako](https://github.com/nodeca/pako)
- [minizlib](https://github.com/isaacs/minizlib)
- [fast-zlib](https://github.com/timotejroiko/fast-zlib)

<!-- LICENSE -->
## License

Distributed under the MIT License. See `LICENSE` for more information.

## Contact

Find me [@Brian-Crotty](https://github.com/Brian-Crotty) on github or [@illumincrotty](https://twitter.com/illumincrotty) on twitter
