const iconv = require('iconv-lite');
const linewrap = require('linewrap');
const {createCanvas} = require('canvas');
const Dither = require('canvas-dither');
const Flatten = require('canvas-flatten');


/**
 * Create a byte stream based on commands for ESC/POS printers
 */
class EscPosEncoder {
  /**
     * Create a new object
     *
    */
  constructor() {
    this._reset();
  }

  /**
     * Reset the state of the object
     *
    */
  _reset() {
    this._buffer = [];
    this._codepage = 'ascii';
    this._pageWidth = 576;
    this._baseLine = 3;
    this._state = {
      'bold': false,
      'italic': false,
      'underline': false,
      'hanzi': false,
    };
  }

  /**
     * Encode a string with the current code page
     *
     * @param  {string}   value  String to encode
     * @return {object}          Encoded string as a ArrayBuffer
     *
    */
  _encode(value) {
    return iconv.encode(value, this._codepage);
  }

  /**
     * Add commands to the buffer
     *
     * @param  {array}   value  And array of numbers, arrays, buffers or Uint8Arrays to add to the buffer
     *
    */
  _queue(value) {
    value.forEach((item) => this._buffer.push(item));
  }

  /**
     * Initialize the printer
     *
     * @return {object}          Return the object, for easy chaining commands
     *
     */
  initialize() {
    this._queue([
      0x1b, 0x40,
    ]);

    return this;
  }

  /**
     * Change the code page
     *
     * @param  {string}   value  The codepage that we set the printer to
     * @return {object}          Return the object, for easy chaining commands
     *
     */
  codepage(value) {
    const codepages = {
      'cp437': [0x00, false],
      'cp737': [0x40, false],
      'cp850': [0x02, false],
      'cp775': [0x5f, false],
      'cp852': [0x12, false],
      'cp855': [0x3c, false],
      'cp857': [0x3d, false],
      'cp858': [0x13, false],
      'cp860': [0x03, false],
      'cp861': [0x38, false],
      'cp862': [0x3e, false],
      'cp863': [0x04, false],
      'cp864': [0x1c, false],
      'cp865': [0x05, false],
      'cp866': [0x11, false],
      'cp869': [0x42, false],
      'cp936': [0xff, true],
      'cp949': [0xfd, true],
      'cp950': [0xfe, true],
      'cp1252': [0x10, false],
      'iso88596': [0x16, false],
      'shiftjis': [0xfc, true],
      'windows874': [0x1e, false],
      'windows1250': [0x48, false],
      'windows1251': [0x49, false],
      'windows1252': [0x47, false],
      'windows1253': [0x5a, false],
      'windows1254': [0x5b, false],
      'windows1255': [0x20, false],
      'windows1256': [0x5c, false],
      'windows1257': [0x19, false],
      'windows1258': [0x5e, false],
    };

    let codepage;

    if (!iconv.encodingExists(value)) {
      throw new Error('Unknown codepage');
    }

    if (value in iconv.encodings) {
      if (typeof iconv.encodings[value] === 'string') {
        codepage = iconv.encodings[value];
      } else {
        codepage = value;
      }
    } else {
      throw new Error('Unknown codepage');
    }

    if (typeof codepages[codepage] !== 'undefined') {
      this._codepage = codepage;
      this._state.hanzi = codepages[codepage][1];

      this._queue([
        0x1b, 0x74, codepages[codepage][0],
      ]);
    } else {
      throw new Error('Codepage not supported by printer');
    }

    return this;
  }

  /**
     * Print text
     *
     * @param  {string}   value  Text that needs to be printed
     * @param  {number}   wrap   Wrap text after this many positions
     * @return {object}          Return the object, for easy chaining commands
     *
     */
  text(value, wrap) {
    if (wrap) {
      const w = linewrap(wrap, {lineBreak: '\r\n'});
      value = w(value);
    }

    const bytes = this._encode(value);

    if (this._state.hanzi) {
      this._queue([
        0x1c, 0x26, bytes, 0x1c, 0x2e,
      ]);
    } else {
      this._queue([
        bytes,
      ]);
    }

    return this;
  }

  /**
     * Print a newline
     *
     * @return {object}          Return the object, for easy chaining commands
     *
     */
  newline() {
    this._queue([
      0x0a, 0x0d,
    ]);

    return this;
  }

  /**
     * Print text, followed by a newline
     *
     * @param  {string}   value  Text that needs to be printed
     * @param  {number}   wrap   Wrap text after this many positions
     * @return {object}          Return the object, for easy chaining commands
     *
     */
  line(value, wrap) {
    this.text(value, wrap);
    this.newline();

    return this;
  }

  /**
     * Underline text
     *
     * @param  {boolean|number}   value  true to turn on underline, false to turn off, or 2 for double underline
     * @return {object}                  Return the object, for easy chaining commands
     *
     */
  underline(value) {
    if (typeof value === 'undefined') {
      value = ! this._state.underline;
    }

    this._state.underline = value;

    this._queue([
      0x1b, 0x2d, Number(value),
    ]);

    return this;
  }

  /**
     * Italic text
     *
     * @param  {boolean}          value  true to turn on italic, false to turn off
     * @return {object}                  Return the object, for easy chaining commands
     *
     */
  italic(value) {
    if (typeof value === 'undefined') {
      value = ! this._state.italic;
    }

    this._state.italic = value;

    this._queue([
      0x1b, 0x34, Number(value),
    ]);

    return this;
  }

  /**
     * Bold text
     *
     * @param  {boolean}          value  true to turn on bold, false to turn off, or 2 for double underline
     * @return {object}                  Return the object, for easy chaining commands
     *
     */
  bold(value) {
    if (typeof value === 'undefined') {
      value = ! this._state.bold;
    }

    this._state.bold = value;

    this._queue([
      0x1b, 0x45, Number(value),
    ]);

    return this;
  }

  /**
     * Change text size
     *
     * @param  {string}          value   small or normal
     * @return {object}                  Return the object, for easy chaining commands
     *
     */
  size(value) {
    if (value === 'small') {
      value = 0x01;
    } else {
      value = 0x00;
    }

    this._queue([
      0x1b, 0x4d, value,
    ]);

    return this;
  }

  /**
     * Change text alignment
     *
     * @param  {string}          value   left, center or right
     * @return {object}                  Return the object, for easy chaining commands
     *
     */
  align(value) {
    const alignments = {
      'left': 0x00,
      'center': 0x01,
      'right': 0x02,
    };

    if (value in alignments) {
      this._queue([
        0x1b, 0x61, alignments[value],
      ]);
    } else {
      throw new Error('Unknown alignment');
    }

    return this;
  }

  /**
     * Barcode
     *
     * @param  {string}           value  the value of the barcode
     * @param  {string}           symbology  the type of the barcode
     * @param  {number}           height  height of the barcode
     * @return {object}                  Return the object, for easy chaining commands
     *
     */
  barcode(value, symbology, height) {
    const symbologies = {
      'upca': 0x00,
      'upce': 0x01,
      'ean13': 0x02,
      'ean8': 0x03,
      'code39': 0x04,
      'coda39': 0x04, /* typo, leave here for backwards compatibility */
      'itf': 0x05,
      'codabar': 0x06,
      'code93': 0x48,
      'code128': 0x49,
      'gs1-128': 0x50,
      'gs1-databar-omni': 0x51,
      'gs1-databar-truncated': 0x52,
      'gs1-databar-limited': 0x53,
      'gs1-databar-expanded': 0x54,
      'code128-auto': 0x55,
    };

    if (symbology in symbologies) {
      const bytes = iconv.encode(value, 'ascii');

      this._queue([
        0x1d, 0x68, height,
        0x1d, 0x77, symbology === 'code39' ? 0x02 : 0x03,
      ]);

      if (symbology == 'code128' && bytes[0] !== 0x7b) {
        /* Not yet encodeded Code 128, assume data is Code B, which is similar to ASCII without control chars */

        this._queue([
          0x1d, 0x6b, symbologies[symbology],
          bytes.length + 2,
          0x7b, 0x42,
          bytes,
        ]);
      } else if (symbologies[symbology] > 0x40) {
        /* Function B symbologies */

        this._queue([
          0x1d, 0x6b, symbologies[symbology],
          bytes.length,
          bytes,
        ]);
      } else {
        /* Function A symbologies */

        this._queue([
          0x1d, 0x6b, symbologies[symbology],
          bytes,
          0x00,
        ]);
      }
    } else {
      throw new Error('Symbology not supported by printer');
    }

    return this;
  }

  /**
     * QR code
     *
     * @param  {string}           value  the value of the qr code
     * @param  {number}           model  model of the qrcode, either 1 or 2
     * @param  {number}           size   size of the qrcode, a value between 1 and 8
     * @param  {string}           errorlevel  the amount of error correction used, either 'l', 'm', 'q', 'h'
     * @return {object}                  Return the object, for easy chaining commands
     *
     */
  qrcode(value, model, size, errorlevel) {
    /* Force printing the print buffer and moving to a new line */

    this._queue([
      0x0a,
    ]);

    /* Model */

    const models = {
      1: 0x31,
      2: 0x32,
    };

    if (typeof model === 'undefined') {
      model = 2;
    }

    if (model in models) {
      this._queue([
        0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, models[model], 0x00,
      ]);
    } else {
      throw new Error('Model must be 1 or 2');
    }

    /* Size */

    if (typeof size === 'undefined') {
      size = 6;
    }

    if (typeof size !== 'number') {
      throw new Error('Size must be a number');
    }

    if (size < 1 || size > 8) {
      throw new Error('Size must be between 1 and 8');
    }

    this._queue([
      0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, size,
    ]);

    /* Error level */

    const errorlevels = {
      'l': 0x30,
      'm': 0x31,
      'q': 0x32,
      'h': 0x33,
    };

    if (typeof errorlevel === 'undefined') {
      errorlevel = 'm';
    }

    if (errorlevel in errorlevels) {
      this._queue([
        0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, errorlevels[errorlevel],
      ]);
    } else {
      throw new Error('Error level must be l, m, q or h');
    }

    /* Data */

    const bytes = iconv.encode(value, 'iso88591');
    const length = bytes.length + 3;

    this._queue([
      0x1d, 0x28, 0x6b, length % 0xff, length / 0xff, 0x31, 0x50, 0x30, bytes,
    ]);

    /* Print QR code */

    this._queue([
      0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30,
    ]);

    return this;
  }

  /**
     * Image
     *
     * @param  {object}         element  an element, like a canvas or image that needs to be printed
     * @param  {number}         width  width of the image on the printer
     * @param  {number}         height  height of the image on the printer
     * @param  {string}         algorithm  the dithering algorithm for making the image black and white
     * @param  {number}         threshold  threshold for the dithering algorithm
     * @return {object}                  Return the object, for easy chaining commands
     *
     */
  image(element, width, height, algorithm, threshold) {
    if (width % 8 !== 0) {
      throw new Error('Width must be a multiple of 8');
    }

    if (height % 8 !== 0) {
      throw new Error('Height must be a multiple of 8');
    }

    if (typeof algorithm === 'undefined') {
      algorithm = 'threshold';
    }

    if (typeof threshold === 'undefined') {
      threshold = 128;
    }

    const canvas = createCanvas(width, height);
    const context = canvas.getContext('2d');
    context.drawImage(element, 0, 0, width, height);
    let image = context.getImageData(0, 0, width, height);

    image = Flatten.flatten(image, [0xff, 0xff, 0xff]);

    switch (algorithm) {
      case 'threshold': image = Dither.threshold(image, threshold); break;
      case 'bayer': image = Dither.bayer(image, threshold); break;
      case 'floydsteinberg': image = Dither.floydsteinberg(image); break;
      case 'atkinson': image = Dither.atkinson(image); break;
    }

    const getPixel = (x, y) => image.data[((width * y) + x) * 4] > 0 ? 0 : 1;

    const bytes = new Uint8Array((width * height) >> 3);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x = x + 8) {
        const i = (y * (width >> 3)) + (x >> 3);
        bytes[i] =
                    getPixel(x + 0, y) << 7 |
                    getPixel(x + 1, y) << 6 |
                    getPixel(x + 2, y) << 5 |
                    getPixel(x + 3, y) << 4 |
                    getPixel(x + 4, y) << 3 |
                    getPixel(x + 5, y) << 2 |
                    getPixel(x + 6, y) << 1 |
                    getPixel(x + 7, y);
      }
    }

    this._queue([
      0x1d, 0x76, 0x30, 0x00,
      (width >> 3) & 0xff, (((width >> 3) >> 8) & 0xff),
      height & 0xff, ((height >> 8) & 0xff),
      bytes,
    ]);

    return this;
  }

  /**
     * Cut paper
     *
     * @param  {string}          value   full or partial. When not specified a full cut will be assumed
     * @return {object}                  Return the object, for easy chaining commands
     *
     */
  cut(value) {
    let data = 0x00;

    if (value == 'partial') {
      data = 0x01;
    }

    this._queue([
      0x1d, 0x56, data,
    ]);

    return this;
  }

  /**
     * Add raw printer commands
     *
     * @param  {array}           data   raw bytes to be included
     * @return {object}          Return the object, for easy chaining commands
     *
     */
  raw(data) {
    this._queue(data);

    return this;
  }

  /**
   * set text line height
  * @param  {string}   nLineHeight  height number
  * @return {object}          Return the object, for easy chaining commands

   */
  setTextLineHeight(nLineHeight) {
    this._queue([
      0x1b, 0x33, nLineHeight,
    ]);

    return this;
  }

  /**
   * set text scale
  * @param  {string}   nWidthScale  width 0,1
  * @param  {string}   nHeightScale  height 0,1
  * @return {object}          Return the object, for easy chaining commands

   */
  setTextScale(nWidthScale, nHeightScale) {
    this._queue([
      0x1d, 0x21, (nHeightScale&0x07) | ((nWidthScale&0x07) <<4),
    ]);
    return this;
  }

  /**
   * set text scale
  * @param  {string}   nPosition  position (paperWidth - 12*6)
  * @return {object}          Return the object, for easy chaining commands

   */
  setHorizontalAbsolutePrintPosition(nPosition) {
    this._queue([
      0x1d, 0x24, nPosition%0x100, nPosition/0x100,
    ]);
    return this;
  }

  /**
   * set text scale
  * @param  {string}   string  string
  * @param  {string}   nEngCharWidth  string
  * @param  {string}   nChnCharWidth  string
  * @return {object}          Return the object, for easy chaining commands
   */
  computeStringWidth(string, nEngCharWidth, nChnCharWidth) {
    let nWidth = 0;
    for (let i = 0; i < string.length; i ++) {
      if (string.charAt(i) < 0x20) {
        break;
      } else if (string.charAt(i)< 0x100) {
        nWidth += nEngCharWidth;
      } else {
        nWidth += nChnCharWidth;
      }
    }

    return nWidth;
  }

  /**
   * get text
  * @param  {string}   left  string
  * @param  {string}   right  string
  * @return {object}          Return the object, for easy chaining commands
   */
  drawTextLeftAndRight(left, right) {
    const width = this._pageWidth;
    const spaceNum = parseInt((width - left.length - right.length) / 20);

    const text = left + Array(spaceNum + 1).join(' ') + right;
    this.text(value);
    return this;

  }


  /**
     * Encode all previous commands
     *
     * @return {Uint8Array}         Return the encoded bytes
     *
     */
  encode() {
    let length = 0;

    this._buffer.forEach((item) => {
      if (typeof item === 'number') {
        length++;
      } else {
        length += item.length;
      }
    });

    const result = new Uint8Array(length);

    let index = 0;

    this._buffer.forEach((item) => {
      if (typeof item === 'number') {
        result[index] = item;
        index++;
      } else {
        result.set(item, index);
        index += item.length;
      }
    });

    this._reset();

    return result;
  }
}

module.exports = EscPosEncoder;
