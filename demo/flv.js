(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.flvjs = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(_dereq_,module,exports){
/*! MIT License. Copyright 2015-2018 Richard Moore <me@ricmoo.com>. See LICENSE.txt. */
(function(root) {
    "use strict";

    function checkInt(value) {
        return (parseInt(value) === value);
    }

    function checkInts(arrayish) {
        if (!checkInt(arrayish.length)) { return false; }

        for (var i = 0; i < arrayish.length; i++) {
            if (!checkInt(arrayish[i]) || arrayish[i] < 0 || arrayish[i] > 255) {
                return false;
            }
        }

        return true;
    }

    function coerceArray(arg, copy) {

        // ArrayBuffer view
        if (arg.buffer && arg.name === 'Uint8Array') {

            if (copy) {
                if (arg.slice) {
                    arg = arg.slice();
                } else {
                    arg = Array.prototype.slice.call(arg);
                }
            }

            return arg;
        }

        // It's an array; check it is a valid representation of a byte
        if (Array.isArray(arg)) {
            if (!checkInts(arg)) {
                throw new Error('Array contains invalid value: ' + arg);
            }

            return new Uint8Array(arg);
        }

        // Something else, but behaves like an array (maybe a Buffer? Arguments?)
        if (checkInt(arg.length) && checkInts(arg)) {
            return new Uint8Array(arg);
        }

        throw new Error('unsupported array-like object');
    }

    function createArray(length) {
        return new Uint8Array(length);
    }

    function copyArray(sourceArray, targetArray, targetStart, sourceStart, sourceEnd) {
        if (sourceStart != null || sourceEnd != null) {
            if (sourceArray.slice) {
                sourceArray = sourceArray.slice(sourceStart, sourceEnd);
            } else {
                sourceArray = Array.prototype.slice.call(sourceArray, sourceStart, sourceEnd);
            }
        }
        targetArray.set(sourceArray, targetStart);
    }



    var convertUtf8 = (function() {
        function toBytes(text) {
            var result = [], i = 0;
            text = encodeURI(text);
            while (i < text.length) {
                var c = text.charCodeAt(i++);

                // if it is a % sign, encode the following 2 bytes as a hex value
                if (c === 37) {
                    result.push(parseInt(text.substr(i, 2), 16))
                    i += 2;

                // otherwise, just the actual byte
                } else {
                    result.push(c)
                }
            }

            return coerceArray(result);
        }

        function fromBytes(bytes) {
            var result = [], i = 0;

            while (i < bytes.length) {
                var c = bytes[i];

                if (c < 128) {
                    result.push(String.fromCharCode(c));
                    i++;
                } else if (c > 191 && c < 224) {
                    result.push(String.fromCharCode(((c & 0x1f) << 6) | (bytes[i + 1] & 0x3f)));
                    i += 2;
                } else {
                    result.push(String.fromCharCode(((c & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f)));
                    i += 3;
                }
            }

            return result.join('');
        }

        return {
            toBytes: toBytes,
            fromBytes: fromBytes,
        }
    })();

    var convertHex = (function() {
        function toBytes(text) {
            var result = [];
            for (var i = 0; i < text.length; i += 2) {
                result.push(parseInt(text.substr(i, 2), 16));
            }

            return result;
        }

        // http://ixti.net/development/javascript/2011/11/11/base64-encodedecode-of-utf8-in-browser-with-js.html
        var Hex = '0123456789abcdef';

        function fromBytes(bytes) {
                var result = [];
                for (var i = 0; i < bytes.length; i++) {
                    var v = bytes[i];
                    result.push(Hex[(v & 0xf0) >> 4] + Hex[v & 0x0f]);
                }
                return result.join('');
        }

        return {
            toBytes: toBytes,
            fromBytes: fromBytes,
        }
    })();


    // Number of rounds by keysize
    var numberOfRounds = {16: 10, 24: 12, 32: 14}

    // Round constant words
    var rcon = [0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36, 0x6c, 0xd8, 0xab, 0x4d, 0x9a, 0x2f, 0x5e, 0xbc, 0x63, 0xc6, 0x97, 0x35, 0x6a, 0xd4, 0xb3, 0x7d, 0xfa, 0xef, 0xc5, 0x91];

    // S-box and Inverse S-box (S is for Substitution)
    var S = [0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76, 0xca, 0x82, 0xc9, 0x7d, 0xfa, 0x59, 0x47, 0xf0, 0xad, 0xd4, 0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0, 0xb7, 0xfd, 0x93, 0x26, 0x36, 0x3f, 0xf7, 0xcc, 0x34, 0xa5, 0xe5, 0xf1, 0x71, 0xd8, 0x31, 0x15, 0x04, 0xc7, 0x23, 0xc3, 0x18, 0x96, 0x05, 0x9a, 0x07, 0x12, 0x80, 0xe2, 0xeb, 0x27, 0xb2, 0x75, 0x09, 0x83, 0x2c, 0x1a, 0x1b, 0x6e, 0x5a, 0xa0, 0x52, 0x3b, 0xd6, 0xb3, 0x29, 0xe3, 0x2f, 0x84, 0x53, 0xd1, 0x00, 0xed, 0x20, 0xfc, 0xb1, 0x5b, 0x6a, 0xcb, 0xbe, 0x39, 0x4a, 0x4c, 0x58, 0xcf, 0xd0, 0xef, 0xaa, 0xfb, 0x43, 0x4d, 0x33, 0x85, 0x45, 0xf9, 0x02, 0x7f, 0x50, 0x3c, 0x9f, 0xa8, 0x51, 0xa3, 0x40, 0x8f, 0x92, 0x9d, 0x38, 0xf5, 0xbc, 0xb6, 0xda, 0x21, 0x10, 0xff, 0xf3, 0xd2, 0xcd, 0x0c, 0x13, 0xec, 0x5f, 0x97, 0x44, 0x17, 0xc4, 0xa7, 0x7e, 0x3d, 0x64, 0x5d, 0x19, 0x73, 0x60, 0x81, 0x4f, 0xdc, 0x22, 0x2a, 0x90, 0x88, 0x46, 0xee, 0xb8, 0x14, 0xde, 0x5e, 0x0b, 0xdb, 0xe0, 0x32, 0x3a, 0x0a, 0x49, 0x06, 0x24, 0x5c, 0xc2, 0xd3, 0xac, 0x62, 0x91, 0x95, 0xe4, 0x79, 0xe7, 0xc8, 0x37, 0x6d, 0x8d, 0xd5, 0x4e, 0xa9, 0x6c, 0x56, 0xf4, 0xea, 0x65, 0x7a, 0xae, 0x08, 0xba, 0x78, 0x25, 0x2e, 0x1c, 0xa6, 0xb4, 0xc6, 0xe8, 0xdd, 0x74, 0x1f, 0x4b, 0xbd, 0x8b, 0x8a, 0x70, 0x3e, 0xb5, 0x66, 0x48, 0x03, 0xf6, 0x0e, 0x61, 0x35, 0x57, 0xb9, 0x86, 0xc1, 0x1d, 0x9e, 0xe1, 0xf8, 0x98, 0x11, 0x69, 0xd9, 0x8e, 0x94, 0x9b, 0x1e, 0x87, 0xe9, 0xce, 0x55, 0x28, 0xdf, 0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42, 0x68, 0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb, 0x16];
    var Si =[0x52, 0x09, 0x6a, 0xd5, 0x30, 0x36, 0xa5, 0x38, 0xbf, 0x40, 0xa3, 0x9e, 0x81, 0xf3, 0xd7, 0xfb, 0x7c, 0xe3, 0x39, 0x82, 0x9b, 0x2f, 0xff, 0x87, 0x34, 0x8e, 0x43, 0x44, 0xc4, 0xde, 0xe9, 0xcb, 0x54, 0x7b, 0x94, 0x32, 0xa6, 0xc2, 0x23, 0x3d, 0xee, 0x4c, 0x95, 0x0b, 0x42, 0xfa, 0xc3, 0x4e, 0x08, 0x2e, 0xa1, 0x66, 0x28, 0xd9, 0x24, 0xb2, 0x76, 0x5b, 0xa2, 0x49, 0x6d, 0x8b, 0xd1, 0x25, 0x72, 0xf8, 0xf6, 0x64, 0x86, 0x68, 0x98, 0x16, 0xd4, 0xa4, 0x5c, 0xcc, 0x5d, 0x65, 0xb6, 0x92, 0x6c, 0x70, 0x48, 0x50, 0xfd, 0xed, 0xb9, 0xda, 0x5e, 0x15, 0x46, 0x57, 0xa7, 0x8d, 0x9d, 0x84, 0x90, 0xd8, 0xab, 0x00, 0x8c, 0xbc, 0xd3, 0x0a, 0xf7, 0xe4, 0x58, 0x05, 0xb8, 0xb3, 0x45, 0x06, 0xd0, 0x2c, 0x1e, 0x8f, 0xca, 0x3f, 0x0f, 0x02, 0xc1, 0xaf, 0xbd, 0x03, 0x01, 0x13, 0x8a, 0x6b, 0x3a, 0x91, 0x11, 0x41, 0x4f, 0x67, 0xdc, 0xea, 0x97, 0xf2, 0xcf, 0xce, 0xf0, 0xb4, 0xe6, 0x73, 0x96, 0xac, 0x74, 0x22, 0xe7, 0xad, 0x35, 0x85, 0xe2, 0xf9, 0x37, 0xe8, 0x1c, 0x75, 0xdf, 0x6e, 0x47, 0xf1, 0x1a, 0x71, 0x1d, 0x29, 0xc5, 0x89, 0x6f, 0xb7, 0x62, 0x0e, 0xaa, 0x18, 0xbe, 0x1b, 0xfc, 0x56, 0x3e, 0x4b, 0xc6, 0xd2, 0x79, 0x20, 0x9a, 0xdb, 0xc0, 0xfe, 0x78, 0xcd, 0x5a, 0xf4, 0x1f, 0xdd, 0xa8, 0x33, 0x88, 0x07, 0xc7, 0x31, 0xb1, 0x12, 0x10, 0x59, 0x27, 0x80, 0xec, 0x5f, 0x60, 0x51, 0x7f, 0xa9, 0x19, 0xb5, 0x4a, 0x0d, 0x2d, 0xe5, 0x7a, 0x9f, 0x93, 0xc9, 0x9c, 0xef, 0xa0, 0xe0, 0x3b, 0x4d, 0xae, 0x2a, 0xf5, 0xb0, 0xc8, 0xeb, 0xbb, 0x3c, 0x83, 0x53, 0x99, 0x61, 0x17, 0x2b, 0x04, 0x7e, 0xba, 0x77, 0xd6, 0x26, 0xe1, 0x69, 0x14, 0x63, 0x55, 0x21, 0x0c, 0x7d];

    // Transformations for encryption
    var T1 = [0xc66363a5, 0xf87c7c84, 0xee777799, 0xf67b7b8d, 0xfff2f20d, 0xd66b6bbd, 0xde6f6fb1, 0x91c5c554, 0x60303050, 0x02010103, 0xce6767a9, 0x562b2b7d, 0xe7fefe19, 0xb5d7d762, 0x4dababe6, 0xec76769a, 0x8fcaca45, 0x1f82829d, 0x89c9c940, 0xfa7d7d87, 0xeffafa15, 0xb25959eb, 0x8e4747c9, 0xfbf0f00b, 0x41adadec, 0xb3d4d467, 0x5fa2a2fd, 0x45afafea, 0x239c9cbf, 0x53a4a4f7, 0xe4727296, 0x9bc0c05b, 0x75b7b7c2, 0xe1fdfd1c, 0x3d9393ae, 0x4c26266a, 0x6c36365a, 0x7e3f3f41, 0xf5f7f702, 0x83cccc4f, 0x6834345c, 0x51a5a5f4, 0xd1e5e534, 0xf9f1f108, 0xe2717193, 0xabd8d873, 0x62313153, 0x2a15153f, 0x0804040c, 0x95c7c752, 0x46232365, 0x9dc3c35e, 0x30181828, 0x379696a1, 0x0a05050f, 0x2f9a9ab5, 0x0e070709, 0x24121236, 0x1b80809b, 0xdfe2e23d, 0xcdebeb26, 0x4e272769, 0x7fb2b2cd, 0xea75759f, 0x1209091b, 0x1d83839e, 0x582c2c74, 0x341a1a2e, 0x361b1b2d, 0xdc6e6eb2, 0xb45a5aee, 0x5ba0a0fb, 0xa45252f6, 0x763b3b4d, 0xb7d6d661, 0x7db3b3ce, 0x5229297b, 0xdde3e33e, 0x5e2f2f71, 0x13848497, 0xa65353f5, 0xb9d1d168, 0x00000000, 0xc1eded2c, 0x40202060, 0xe3fcfc1f, 0x79b1b1c8, 0xb65b5bed, 0xd46a6abe, 0x8dcbcb46, 0x67bebed9, 0x7239394b, 0x944a4ade, 0x984c4cd4, 0xb05858e8, 0x85cfcf4a, 0xbbd0d06b, 0xc5efef2a, 0x4faaaae5, 0xedfbfb16, 0x864343c5, 0x9a4d4dd7, 0x66333355, 0x11858594, 0x8a4545cf, 0xe9f9f910, 0x04020206, 0xfe7f7f81, 0xa05050f0, 0x783c3c44, 0x259f9fba, 0x4ba8a8e3, 0xa25151f3, 0x5da3a3fe, 0x804040c0, 0x058f8f8a, 0x3f9292ad, 0x219d9dbc, 0x70383848, 0xf1f5f504, 0x63bcbcdf, 0x77b6b6c1, 0xafdada75, 0x42212163, 0x20101030, 0xe5ffff1a, 0xfdf3f30e, 0xbfd2d26d, 0x81cdcd4c, 0x180c0c14, 0x26131335, 0xc3ecec2f, 0xbe5f5fe1, 0x359797a2, 0x884444cc, 0x2e171739, 0x93c4c457, 0x55a7a7f2, 0xfc7e7e82, 0x7a3d3d47, 0xc86464ac, 0xba5d5de7, 0x3219192b, 0xe6737395, 0xc06060a0, 0x19818198, 0x9e4f4fd1, 0xa3dcdc7f, 0x44222266, 0x542a2a7e, 0x3b9090ab, 0x0b888883, 0x8c4646ca, 0xc7eeee29, 0x6bb8b8d3, 0x2814143c, 0xa7dede79, 0xbc5e5ee2, 0x160b0b1d, 0xaddbdb76, 0xdbe0e03b, 0x64323256, 0x743a3a4e, 0x140a0a1e, 0x924949db, 0x0c06060a, 0x4824246c, 0xb85c5ce4, 0x9fc2c25d, 0xbdd3d36e, 0x43acacef, 0xc46262a6, 0x399191a8, 0x319595a4, 0xd3e4e437, 0xf279798b, 0xd5e7e732, 0x8bc8c843, 0x6e373759, 0xda6d6db7, 0x018d8d8c, 0xb1d5d564, 0x9c4e4ed2, 0x49a9a9e0, 0xd86c6cb4, 0xac5656fa, 0xf3f4f407, 0xcfeaea25, 0xca6565af, 0xf47a7a8e, 0x47aeaee9, 0x10080818, 0x6fbabad5, 0xf0787888, 0x4a25256f, 0x5c2e2e72, 0x381c1c24, 0x57a6a6f1, 0x73b4b4c7, 0x97c6c651, 0xcbe8e823, 0xa1dddd7c, 0xe874749c, 0x3e1f1f21, 0x964b4bdd, 0x61bdbddc, 0x0d8b8b86, 0x0f8a8a85, 0xe0707090, 0x7c3e3e42, 0x71b5b5c4, 0xcc6666aa, 0x904848d8, 0x06030305, 0xf7f6f601, 0x1c0e0e12, 0xc26161a3, 0x6a35355f, 0xae5757f9, 0x69b9b9d0, 0x17868691, 0x99c1c158, 0x3a1d1d27, 0x279e9eb9, 0xd9e1e138, 0xebf8f813, 0x2b9898b3, 0x22111133, 0xd26969bb, 0xa9d9d970, 0x078e8e89, 0x339494a7, 0x2d9b9bb6, 0x3c1e1e22, 0x15878792, 0xc9e9e920, 0x87cece49, 0xaa5555ff, 0x50282878, 0xa5dfdf7a, 0x038c8c8f, 0x59a1a1f8, 0x09898980, 0x1a0d0d17, 0x65bfbfda, 0xd7e6e631, 0x844242c6, 0xd06868b8, 0x824141c3, 0x299999b0, 0x5a2d2d77, 0x1e0f0f11, 0x7bb0b0cb, 0xa85454fc, 0x6dbbbbd6, 0x2c16163a];
    var T2 = [0xa5c66363, 0x84f87c7c, 0x99ee7777, 0x8df67b7b, 0x0dfff2f2, 0xbdd66b6b, 0xb1de6f6f, 0x5491c5c5, 0x50603030, 0x03020101, 0xa9ce6767, 0x7d562b2b, 0x19e7fefe, 0x62b5d7d7, 0xe64dabab, 0x9aec7676, 0x458fcaca, 0x9d1f8282, 0x4089c9c9, 0x87fa7d7d, 0x15effafa, 0xebb25959, 0xc98e4747, 0x0bfbf0f0, 0xec41adad, 0x67b3d4d4, 0xfd5fa2a2, 0xea45afaf, 0xbf239c9c, 0xf753a4a4, 0x96e47272, 0x5b9bc0c0, 0xc275b7b7, 0x1ce1fdfd, 0xae3d9393, 0x6a4c2626, 0x5a6c3636, 0x417e3f3f, 0x02f5f7f7, 0x4f83cccc, 0x5c683434, 0xf451a5a5, 0x34d1e5e5, 0x08f9f1f1, 0x93e27171, 0x73abd8d8, 0x53623131, 0x3f2a1515, 0x0c080404, 0x5295c7c7, 0x65462323, 0x5e9dc3c3, 0x28301818, 0xa1379696, 0x0f0a0505, 0xb52f9a9a, 0x090e0707, 0x36241212, 0x9b1b8080, 0x3ddfe2e2, 0x26cdebeb, 0x694e2727, 0xcd7fb2b2, 0x9fea7575, 0x1b120909, 0x9e1d8383, 0x74582c2c, 0x2e341a1a, 0x2d361b1b, 0xb2dc6e6e, 0xeeb45a5a, 0xfb5ba0a0, 0xf6a45252, 0x4d763b3b, 0x61b7d6d6, 0xce7db3b3, 0x7b522929, 0x3edde3e3, 0x715e2f2f, 0x97138484, 0xf5a65353, 0x68b9d1d1, 0x00000000, 0x2cc1eded, 0x60402020, 0x1fe3fcfc, 0xc879b1b1, 0xedb65b5b, 0xbed46a6a, 0x468dcbcb, 0xd967bebe, 0x4b723939, 0xde944a4a, 0xd4984c4c, 0xe8b05858, 0x4a85cfcf, 0x6bbbd0d0, 0x2ac5efef, 0xe54faaaa, 0x16edfbfb, 0xc5864343, 0xd79a4d4d, 0x55663333, 0x94118585, 0xcf8a4545, 0x10e9f9f9, 0x06040202, 0x81fe7f7f, 0xf0a05050, 0x44783c3c, 0xba259f9f, 0xe34ba8a8, 0xf3a25151, 0xfe5da3a3, 0xc0804040, 0x8a058f8f, 0xad3f9292, 0xbc219d9d, 0x48703838, 0x04f1f5f5, 0xdf63bcbc, 0xc177b6b6, 0x75afdada, 0x63422121, 0x30201010, 0x1ae5ffff, 0x0efdf3f3, 0x6dbfd2d2, 0x4c81cdcd, 0x14180c0c, 0x35261313, 0x2fc3ecec, 0xe1be5f5f, 0xa2359797, 0xcc884444, 0x392e1717, 0x5793c4c4, 0xf255a7a7, 0x82fc7e7e, 0x477a3d3d, 0xacc86464, 0xe7ba5d5d, 0x2b321919, 0x95e67373, 0xa0c06060, 0x98198181, 0xd19e4f4f, 0x7fa3dcdc, 0x66442222, 0x7e542a2a, 0xab3b9090, 0x830b8888, 0xca8c4646, 0x29c7eeee, 0xd36bb8b8, 0x3c281414, 0x79a7dede, 0xe2bc5e5e, 0x1d160b0b, 0x76addbdb, 0x3bdbe0e0, 0x56643232, 0x4e743a3a, 0x1e140a0a, 0xdb924949, 0x0a0c0606, 0x6c482424, 0xe4b85c5c, 0x5d9fc2c2, 0x6ebdd3d3, 0xef43acac, 0xa6c46262, 0xa8399191, 0xa4319595, 0x37d3e4e4, 0x8bf27979, 0x32d5e7e7, 0x438bc8c8, 0x596e3737, 0xb7da6d6d, 0x8c018d8d, 0x64b1d5d5, 0xd29c4e4e, 0xe049a9a9, 0xb4d86c6c, 0xfaac5656, 0x07f3f4f4, 0x25cfeaea, 0xafca6565, 0x8ef47a7a, 0xe947aeae, 0x18100808, 0xd56fbaba, 0x88f07878, 0x6f4a2525, 0x725c2e2e, 0x24381c1c, 0xf157a6a6, 0xc773b4b4, 0x5197c6c6, 0x23cbe8e8, 0x7ca1dddd, 0x9ce87474, 0x213e1f1f, 0xdd964b4b, 0xdc61bdbd, 0x860d8b8b, 0x850f8a8a, 0x90e07070, 0x427c3e3e, 0xc471b5b5, 0xaacc6666, 0xd8904848, 0x05060303, 0x01f7f6f6, 0x121c0e0e, 0xa3c26161, 0x5f6a3535, 0xf9ae5757, 0xd069b9b9, 0x91178686, 0x5899c1c1, 0x273a1d1d, 0xb9279e9e, 0x38d9e1e1, 0x13ebf8f8, 0xb32b9898, 0x33221111, 0xbbd26969, 0x70a9d9d9, 0x89078e8e, 0xa7339494, 0xb62d9b9b, 0x223c1e1e, 0x92158787, 0x20c9e9e9, 0x4987cece, 0xffaa5555, 0x78502828, 0x7aa5dfdf, 0x8f038c8c, 0xf859a1a1, 0x80098989, 0x171a0d0d, 0xda65bfbf, 0x31d7e6e6, 0xc6844242, 0xb8d06868, 0xc3824141, 0xb0299999, 0x775a2d2d, 0x111e0f0f, 0xcb7bb0b0, 0xfca85454, 0xd66dbbbb, 0x3a2c1616];
    var T3 = [0x63a5c663, 0x7c84f87c, 0x7799ee77, 0x7b8df67b, 0xf20dfff2, 0x6bbdd66b, 0x6fb1de6f, 0xc55491c5, 0x30506030, 0x01030201, 0x67a9ce67, 0x2b7d562b, 0xfe19e7fe, 0xd762b5d7, 0xabe64dab, 0x769aec76, 0xca458fca, 0x829d1f82, 0xc94089c9, 0x7d87fa7d, 0xfa15effa, 0x59ebb259, 0x47c98e47, 0xf00bfbf0, 0xadec41ad, 0xd467b3d4, 0xa2fd5fa2, 0xafea45af, 0x9cbf239c, 0xa4f753a4, 0x7296e472, 0xc05b9bc0, 0xb7c275b7, 0xfd1ce1fd, 0x93ae3d93, 0x266a4c26, 0x365a6c36, 0x3f417e3f, 0xf702f5f7, 0xcc4f83cc, 0x345c6834, 0xa5f451a5, 0xe534d1e5, 0xf108f9f1, 0x7193e271, 0xd873abd8, 0x31536231, 0x153f2a15, 0x040c0804, 0xc75295c7, 0x23654623, 0xc35e9dc3, 0x18283018, 0x96a13796, 0x050f0a05, 0x9ab52f9a, 0x07090e07, 0x12362412, 0x809b1b80, 0xe23ddfe2, 0xeb26cdeb, 0x27694e27, 0xb2cd7fb2, 0x759fea75, 0x091b1209, 0x839e1d83, 0x2c74582c, 0x1a2e341a, 0x1b2d361b, 0x6eb2dc6e, 0x5aeeb45a, 0xa0fb5ba0, 0x52f6a452, 0x3b4d763b, 0xd661b7d6, 0xb3ce7db3, 0x297b5229, 0xe33edde3, 0x2f715e2f, 0x84971384, 0x53f5a653, 0xd168b9d1, 0x00000000, 0xed2cc1ed, 0x20604020, 0xfc1fe3fc, 0xb1c879b1, 0x5bedb65b, 0x6abed46a, 0xcb468dcb, 0xbed967be, 0x394b7239, 0x4ade944a, 0x4cd4984c, 0x58e8b058, 0xcf4a85cf, 0xd06bbbd0, 0xef2ac5ef, 0xaae54faa, 0xfb16edfb, 0x43c58643, 0x4dd79a4d, 0x33556633, 0x85941185, 0x45cf8a45, 0xf910e9f9, 0x02060402, 0x7f81fe7f, 0x50f0a050, 0x3c44783c, 0x9fba259f, 0xa8e34ba8, 0x51f3a251, 0xa3fe5da3, 0x40c08040, 0x8f8a058f, 0x92ad3f92, 0x9dbc219d, 0x38487038, 0xf504f1f5, 0xbcdf63bc, 0xb6c177b6, 0xda75afda, 0x21634221, 0x10302010, 0xff1ae5ff, 0xf30efdf3, 0xd26dbfd2, 0xcd4c81cd, 0x0c14180c, 0x13352613, 0xec2fc3ec, 0x5fe1be5f, 0x97a23597, 0x44cc8844, 0x17392e17, 0xc45793c4, 0xa7f255a7, 0x7e82fc7e, 0x3d477a3d, 0x64acc864, 0x5de7ba5d, 0x192b3219, 0x7395e673, 0x60a0c060, 0x81981981, 0x4fd19e4f, 0xdc7fa3dc, 0x22664422, 0x2a7e542a, 0x90ab3b90, 0x88830b88, 0x46ca8c46, 0xee29c7ee, 0xb8d36bb8, 0x143c2814, 0xde79a7de, 0x5ee2bc5e, 0x0b1d160b, 0xdb76addb, 0xe03bdbe0, 0x32566432, 0x3a4e743a, 0x0a1e140a, 0x49db9249, 0x060a0c06, 0x246c4824, 0x5ce4b85c, 0xc25d9fc2, 0xd36ebdd3, 0xacef43ac, 0x62a6c462, 0x91a83991, 0x95a43195, 0xe437d3e4, 0x798bf279, 0xe732d5e7, 0xc8438bc8, 0x37596e37, 0x6db7da6d, 0x8d8c018d, 0xd564b1d5, 0x4ed29c4e, 0xa9e049a9, 0x6cb4d86c, 0x56faac56, 0xf407f3f4, 0xea25cfea, 0x65afca65, 0x7a8ef47a, 0xaee947ae, 0x08181008, 0xbad56fba, 0x7888f078, 0x256f4a25, 0x2e725c2e, 0x1c24381c, 0xa6f157a6, 0xb4c773b4, 0xc65197c6, 0xe823cbe8, 0xdd7ca1dd, 0x749ce874, 0x1f213e1f, 0x4bdd964b, 0xbddc61bd, 0x8b860d8b, 0x8a850f8a, 0x7090e070, 0x3e427c3e, 0xb5c471b5, 0x66aacc66, 0x48d89048, 0x03050603, 0xf601f7f6, 0x0e121c0e, 0x61a3c261, 0x355f6a35, 0x57f9ae57, 0xb9d069b9, 0x86911786, 0xc15899c1, 0x1d273a1d, 0x9eb9279e, 0xe138d9e1, 0xf813ebf8, 0x98b32b98, 0x11332211, 0x69bbd269, 0xd970a9d9, 0x8e89078e, 0x94a73394, 0x9bb62d9b, 0x1e223c1e, 0x87921587, 0xe920c9e9, 0xce4987ce, 0x55ffaa55, 0x28785028, 0xdf7aa5df, 0x8c8f038c, 0xa1f859a1, 0x89800989, 0x0d171a0d, 0xbfda65bf, 0xe631d7e6, 0x42c68442, 0x68b8d068, 0x41c38241, 0x99b02999, 0x2d775a2d, 0x0f111e0f, 0xb0cb7bb0, 0x54fca854, 0xbbd66dbb, 0x163a2c16];
    var T4 = [0x6363a5c6, 0x7c7c84f8, 0x777799ee, 0x7b7b8df6, 0xf2f20dff, 0x6b6bbdd6, 0x6f6fb1de, 0xc5c55491, 0x30305060, 0x01010302, 0x6767a9ce, 0x2b2b7d56, 0xfefe19e7, 0xd7d762b5, 0xababe64d, 0x76769aec, 0xcaca458f, 0x82829d1f, 0xc9c94089, 0x7d7d87fa, 0xfafa15ef, 0x5959ebb2, 0x4747c98e, 0xf0f00bfb, 0xadadec41, 0xd4d467b3, 0xa2a2fd5f, 0xafafea45, 0x9c9cbf23, 0xa4a4f753, 0x727296e4, 0xc0c05b9b, 0xb7b7c275, 0xfdfd1ce1, 0x9393ae3d, 0x26266a4c, 0x36365a6c, 0x3f3f417e, 0xf7f702f5, 0xcccc4f83, 0x34345c68, 0xa5a5f451, 0xe5e534d1, 0xf1f108f9, 0x717193e2, 0xd8d873ab, 0x31315362, 0x15153f2a, 0x04040c08, 0xc7c75295, 0x23236546, 0xc3c35e9d, 0x18182830, 0x9696a137, 0x05050f0a, 0x9a9ab52f, 0x0707090e, 0x12123624, 0x80809b1b, 0xe2e23ddf, 0xebeb26cd, 0x2727694e, 0xb2b2cd7f, 0x75759fea, 0x09091b12, 0x83839e1d, 0x2c2c7458, 0x1a1a2e34, 0x1b1b2d36, 0x6e6eb2dc, 0x5a5aeeb4, 0xa0a0fb5b, 0x5252f6a4, 0x3b3b4d76, 0xd6d661b7, 0xb3b3ce7d, 0x29297b52, 0xe3e33edd, 0x2f2f715e, 0x84849713, 0x5353f5a6, 0xd1d168b9, 0x00000000, 0xeded2cc1, 0x20206040, 0xfcfc1fe3, 0xb1b1c879, 0x5b5bedb6, 0x6a6abed4, 0xcbcb468d, 0xbebed967, 0x39394b72, 0x4a4ade94, 0x4c4cd498, 0x5858e8b0, 0xcfcf4a85, 0xd0d06bbb, 0xefef2ac5, 0xaaaae54f, 0xfbfb16ed, 0x4343c586, 0x4d4dd79a, 0x33335566, 0x85859411, 0x4545cf8a, 0xf9f910e9, 0x02020604, 0x7f7f81fe, 0x5050f0a0, 0x3c3c4478, 0x9f9fba25, 0xa8a8e34b, 0x5151f3a2, 0xa3a3fe5d, 0x4040c080, 0x8f8f8a05, 0x9292ad3f, 0x9d9dbc21, 0x38384870, 0xf5f504f1, 0xbcbcdf63, 0xb6b6c177, 0xdada75af, 0x21216342, 0x10103020, 0xffff1ae5, 0xf3f30efd, 0xd2d26dbf, 0xcdcd4c81, 0x0c0c1418, 0x13133526, 0xecec2fc3, 0x5f5fe1be, 0x9797a235, 0x4444cc88, 0x1717392e, 0xc4c45793, 0xa7a7f255, 0x7e7e82fc, 0x3d3d477a, 0x6464acc8, 0x5d5de7ba, 0x19192b32, 0x737395e6, 0x6060a0c0, 0x81819819, 0x4f4fd19e, 0xdcdc7fa3, 0x22226644, 0x2a2a7e54, 0x9090ab3b, 0x8888830b, 0x4646ca8c, 0xeeee29c7, 0xb8b8d36b, 0x14143c28, 0xdede79a7, 0x5e5ee2bc, 0x0b0b1d16, 0xdbdb76ad, 0xe0e03bdb, 0x32325664, 0x3a3a4e74, 0x0a0a1e14, 0x4949db92, 0x06060a0c, 0x24246c48, 0x5c5ce4b8, 0xc2c25d9f, 0xd3d36ebd, 0xacacef43, 0x6262a6c4, 0x9191a839, 0x9595a431, 0xe4e437d3, 0x79798bf2, 0xe7e732d5, 0xc8c8438b, 0x3737596e, 0x6d6db7da, 0x8d8d8c01, 0xd5d564b1, 0x4e4ed29c, 0xa9a9e049, 0x6c6cb4d8, 0x5656faac, 0xf4f407f3, 0xeaea25cf, 0x6565afca, 0x7a7a8ef4, 0xaeaee947, 0x08081810, 0xbabad56f, 0x787888f0, 0x25256f4a, 0x2e2e725c, 0x1c1c2438, 0xa6a6f157, 0xb4b4c773, 0xc6c65197, 0xe8e823cb, 0xdddd7ca1, 0x74749ce8, 0x1f1f213e, 0x4b4bdd96, 0xbdbddc61, 0x8b8b860d, 0x8a8a850f, 0x707090e0, 0x3e3e427c, 0xb5b5c471, 0x6666aacc, 0x4848d890, 0x03030506, 0xf6f601f7, 0x0e0e121c, 0x6161a3c2, 0x35355f6a, 0x5757f9ae, 0xb9b9d069, 0x86869117, 0xc1c15899, 0x1d1d273a, 0x9e9eb927, 0xe1e138d9, 0xf8f813eb, 0x9898b32b, 0x11113322, 0x6969bbd2, 0xd9d970a9, 0x8e8e8907, 0x9494a733, 0x9b9bb62d, 0x1e1e223c, 0x87879215, 0xe9e920c9, 0xcece4987, 0x5555ffaa, 0x28287850, 0xdfdf7aa5, 0x8c8c8f03, 0xa1a1f859, 0x89898009, 0x0d0d171a, 0xbfbfda65, 0xe6e631d7, 0x4242c684, 0x6868b8d0, 0x4141c382, 0x9999b029, 0x2d2d775a, 0x0f0f111e, 0xb0b0cb7b, 0x5454fca8, 0xbbbbd66d, 0x16163a2c];

    // Transformations for decryption
    var T5 = [0x51f4a750, 0x7e416553, 0x1a17a4c3, 0x3a275e96, 0x3bab6bcb, 0x1f9d45f1, 0xacfa58ab, 0x4be30393, 0x2030fa55, 0xad766df6, 0x88cc7691, 0xf5024c25, 0x4fe5d7fc, 0xc52acbd7, 0x26354480, 0xb562a38f, 0xdeb15a49, 0x25ba1b67, 0x45ea0e98, 0x5dfec0e1, 0xc32f7502, 0x814cf012, 0x8d4697a3, 0x6bd3f9c6, 0x038f5fe7, 0x15929c95, 0xbf6d7aeb, 0x955259da, 0xd4be832d, 0x587421d3, 0x49e06929, 0x8ec9c844, 0x75c2896a, 0xf48e7978, 0x99583e6b, 0x27b971dd, 0xbee14fb6, 0xf088ad17, 0xc920ac66, 0x7dce3ab4, 0x63df4a18, 0xe51a3182, 0x97513360, 0x62537f45, 0xb16477e0, 0xbb6bae84, 0xfe81a01c, 0xf9082b94, 0x70486858, 0x8f45fd19, 0x94de6c87, 0x527bf8b7, 0xab73d323, 0x724b02e2, 0xe31f8f57, 0x6655ab2a, 0xb2eb2807, 0x2fb5c203, 0x86c57b9a, 0xd33708a5, 0x302887f2, 0x23bfa5b2, 0x02036aba, 0xed16825c, 0x8acf1c2b, 0xa779b492, 0xf307f2f0, 0x4e69e2a1, 0x65daf4cd, 0x0605bed5, 0xd134621f, 0xc4a6fe8a, 0x342e539d, 0xa2f355a0, 0x058ae132, 0xa4f6eb75, 0x0b83ec39, 0x4060efaa, 0x5e719f06, 0xbd6e1051, 0x3e218af9, 0x96dd063d, 0xdd3e05ae, 0x4de6bd46, 0x91548db5, 0x71c45d05, 0x0406d46f, 0x605015ff, 0x1998fb24, 0xd6bde997, 0x894043cc, 0x67d99e77, 0xb0e842bd, 0x07898b88, 0xe7195b38, 0x79c8eedb, 0xa17c0a47, 0x7c420fe9, 0xf8841ec9, 0x00000000, 0x09808683, 0x322bed48, 0x1e1170ac, 0x6c5a724e, 0xfd0efffb, 0x0f853856, 0x3daed51e, 0x362d3927, 0x0a0fd964, 0x685ca621, 0x9b5b54d1, 0x24362e3a, 0x0c0a67b1, 0x9357e70f, 0xb4ee96d2, 0x1b9b919e, 0x80c0c54f, 0x61dc20a2, 0x5a774b69, 0x1c121a16, 0xe293ba0a, 0xc0a02ae5, 0x3c22e043, 0x121b171d, 0x0e090d0b, 0xf28bc7ad, 0x2db6a8b9, 0x141ea9c8, 0x57f11985, 0xaf75074c, 0xee99ddbb, 0xa37f60fd, 0xf701269f, 0x5c72f5bc, 0x44663bc5, 0x5bfb7e34, 0x8b432976, 0xcb23c6dc, 0xb6edfc68, 0xb8e4f163, 0xd731dcca, 0x42638510, 0x13972240, 0x84c61120, 0x854a247d, 0xd2bb3df8, 0xaef93211, 0xc729a16d, 0x1d9e2f4b, 0xdcb230f3, 0x0d8652ec, 0x77c1e3d0, 0x2bb3166c, 0xa970b999, 0x119448fa, 0x47e96422, 0xa8fc8cc4, 0xa0f03f1a, 0x567d2cd8, 0x223390ef, 0x87494ec7, 0xd938d1c1, 0x8ccaa2fe, 0x98d40b36, 0xa6f581cf, 0xa57ade28, 0xdab78e26, 0x3fadbfa4, 0x2c3a9de4, 0x5078920d, 0x6a5fcc9b, 0x547e4662, 0xf68d13c2, 0x90d8b8e8, 0x2e39f75e, 0x82c3aff5, 0x9f5d80be, 0x69d0937c, 0x6fd52da9, 0xcf2512b3, 0xc8ac993b, 0x10187da7, 0xe89c636e, 0xdb3bbb7b, 0xcd267809, 0x6e5918f4, 0xec9ab701, 0x834f9aa8, 0xe6956e65, 0xaaffe67e, 0x21bccf08, 0xef15e8e6, 0xbae79bd9, 0x4a6f36ce, 0xea9f09d4, 0x29b07cd6, 0x31a4b2af, 0x2a3f2331, 0xc6a59430, 0x35a266c0, 0x744ebc37, 0xfc82caa6, 0xe090d0b0, 0x33a7d815, 0xf104984a, 0x41ecdaf7, 0x7fcd500e, 0x1791f62f, 0x764dd68d, 0x43efb04d, 0xccaa4d54, 0xe49604df, 0x9ed1b5e3, 0x4c6a881b, 0xc12c1fb8, 0x4665517f, 0x9d5eea04, 0x018c355d, 0xfa877473, 0xfb0b412e, 0xb3671d5a, 0x92dbd252, 0xe9105633, 0x6dd64713, 0x9ad7618c, 0x37a10c7a, 0x59f8148e, 0xeb133c89, 0xcea927ee, 0xb761c935, 0xe11ce5ed, 0x7a47b13c, 0x9cd2df59, 0x55f2733f, 0x1814ce79, 0x73c737bf, 0x53f7cdea, 0x5ffdaa5b, 0xdf3d6f14, 0x7844db86, 0xcaaff381, 0xb968c43e, 0x3824342c, 0xc2a3405f, 0x161dc372, 0xbce2250c, 0x283c498b, 0xff0d9541, 0x39a80171, 0x080cb3de, 0xd8b4e49c, 0x6456c190, 0x7bcb8461, 0xd532b670, 0x486c5c74, 0xd0b85742];
    var T6 = [0x5051f4a7, 0x537e4165, 0xc31a17a4, 0x963a275e, 0xcb3bab6b, 0xf11f9d45, 0xabacfa58, 0x934be303, 0x552030fa, 0xf6ad766d, 0x9188cc76, 0x25f5024c, 0xfc4fe5d7, 0xd7c52acb, 0x80263544, 0x8fb562a3, 0x49deb15a, 0x6725ba1b, 0x9845ea0e, 0xe15dfec0, 0x02c32f75, 0x12814cf0, 0xa38d4697, 0xc66bd3f9, 0xe7038f5f, 0x9515929c, 0xebbf6d7a, 0xda955259, 0x2dd4be83, 0xd3587421, 0x2949e069, 0x448ec9c8, 0x6a75c289, 0x78f48e79, 0x6b99583e, 0xdd27b971, 0xb6bee14f, 0x17f088ad, 0x66c920ac, 0xb47dce3a, 0x1863df4a, 0x82e51a31, 0x60975133, 0x4562537f, 0xe0b16477, 0x84bb6bae, 0x1cfe81a0, 0x94f9082b, 0x58704868, 0x198f45fd, 0x8794de6c, 0xb7527bf8, 0x23ab73d3, 0xe2724b02, 0x57e31f8f, 0x2a6655ab, 0x07b2eb28, 0x032fb5c2, 0x9a86c57b, 0xa5d33708, 0xf2302887, 0xb223bfa5, 0xba02036a, 0x5ced1682, 0x2b8acf1c, 0x92a779b4, 0xf0f307f2, 0xa14e69e2, 0xcd65daf4, 0xd50605be, 0x1fd13462, 0x8ac4a6fe, 0x9d342e53, 0xa0a2f355, 0x32058ae1, 0x75a4f6eb, 0x390b83ec, 0xaa4060ef, 0x065e719f, 0x51bd6e10, 0xf93e218a, 0x3d96dd06, 0xaedd3e05, 0x464de6bd, 0xb591548d, 0x0571c45d, 0x6f0406d4, 0xff605015, 0x241998fb, 0x97d6bde9, 0xcc894043, 0x7767d99e, 0xbdb0e842, 0x8807898b, 0x38e7195b, 0xdb79c8ee, 0x47a17c0a, 0xe97c420f, 0xc9f8841e, 0x00000000, 0x83098086, 0x48322bed, 0xac1e1170, 0x4e6c5a72, 0xfbfd0eff, 0x560f8538, 0x1e3daed5, 0x27362d39, 0x640a0fd9, 0x21685ca6, 0xd19b5b54, 0x3a24362e, 0xb10c0a67, 0x0f9357e7, 0xd2b4ee96, 0x9e1b9b91, 0x4f80c0c5, 0xa261dc20, 0x695a774b, 0x161c121a, 0x0ae293ba, 0xe5c0a02a, 0x433c22e0, 0x1d121b17, 0x0b0e090d, 0xadf28bc7, 0xb92db6a8, 0xc8141ea9, 0x8557f119, 0x4caf7507, 0xbbee99dd, 0xfda37f60, 0x9ff70126, 0xbc5c72f5, 0xc544663b, 0x345bfb7e, 0x768b4329, 0xdccb23c6, 0x68b6edfc, 0x63b8e4f1, 0xcad731dc, 0x10426385, 0x40139722, 0x2084c611, 0x7d854a24, 0xf8d2bb3d, 0x11aef932, 0x6dc729a1, 0x4b1d9e2f, 0xf3dcb230, 0xec0d8652, 0xd077c1e3, 0x6c2bb316, 0x99a970b9, 0xfa119448, 0x2247e964, 0xc4a8fc8c, 0x1aa0f03f, 0xd8567d2c, 0xef223390, 0xc787494e, 0xc1d938d1, 0xfe8ccaa2, 0x3698d40b, 0xcfa6f581, 0x28a57ade, 0x26dab78e, 0xa43fadbf, 0xe42c3a9d, 0x0d507892, 0x9b6a5fcc, 0x62547e46, 0xc2f68d13, 0xe890d8b8, 0x5e2e39f7, 0xf582c3af, 0xbe9f5d80, 0x7c69d093, 0xa96fd52d, 0xb3cf2512, 0x3bc8ac99, 0xa710187d, 0x6ee89c63, 0x7bdb3bbb, 0x09cd2678, 0xf46e5918, 0x01ec9ab7, 0xa8834f9a, 0x65e6956e, 0x7eaaffe6, 0x0821bccf, 0xe6ef15e8, 0xd9bae79b, 0xce4a6f36, 0xd4ea9f09, 0xd629b07c, 0xaf31a4b2, 0x312a3f23, 0x30c6a594, 0xc035a266, 0x37744ebc, 0xa6fc82ca, 0xb0e090d0, 0x1533a7d8, 0x4af10498, 0xf741ecda, 0x0e7fcd50, 0x2f1791f6, 0x8d764dd6, 0x4d43efb0, 0x54ccaa4d, 0xdfe49604, 0xe39ed1b5, 0x1b4c6a88, 0xb8c12c1f, 0x7f466551, 0x049d5eea, 0x5d018c35, 0x73fa8774, 0x2efb0b41, 0x5ab3671d, 0x5292dbd2, 0x33e91056, 0x136dd647, 0x8c9ad761, 0x7a37a10c, 0x8e59f814, 0x89eb133c, 0xeecea927, 0x35b761c9, 0xede11ce5, 0x3c7a47b1, 0x599cd2df, 0x3f55f273, 0x791814ce, 0xbf73c737, 0xea53f7cd, 0x5b5ffdaa, 0x14df3d6f, 0x867844db, 0x81caaff3, 0x3eb968c4, 0x2c382434, 0x5fc2a340, 0x72161dc3, 0x0cbce225, 0x8b283c49, 0x41ff0d95, 0x7139a801, 0xde080cb3, 0x9cd8b4e4, 0x906456c1, 0x617bcb84, 0x70d532b6, 0x74486c5c, 0x42d0b857];
    var T7 = [0xa75051f4, 0x65537e41, 0xa4c31a17, 0x5e963a27, 0x6bcb3bab, 0x45f11f9d, 0x58abacfa, 0x03934be3, 0xfa552030, 0x6df6ad76, 0x769188cc, 0x4c25f502, 0xd7fc4fe5, 0xcbd7c52a, 0x44802635, 0xa38fb562, 0x5a49deb1, 0x1b6725ba, 0x0e9845ea, 0xc0e15dfe, 0x7502c32f, 0xf012814c, 0x97a38d46, 0xf9c66bd3, 0x5fe7038f, 0x9c951592, 0x7aebbf6d, 0x59da9552, 0x832dd4be, 0x21d35874, 0x692949e0, 0xc8448ec9, 0x896a75c2, 0x7978f48e, 0x3e6b9958, 0x71dd27b9, 0x4fb6bee1, 0xad17f088, 0xac66c920, 0x3ab47dce, 0x4a1863df, 0x3182e51a, 0x33609751, 0x7f456253, 0x77e0b164, 0xae84bb6b, 0xa01cfe81, 0x2b94f908, 0x68587048, 0xfd198f45, 0x6c8794de, 0xf8b7527b, 0xd323ab73, 0x02e2724b, 0x8f57e31f, 0xab2a6655, 0x2807b2eb, 0xc2032fb5, 0x7b9a86c5, 0x08a5d337, 0x87f23028, 0xa5b223bf, 0x6aba0203, 0x825ced16, 0x1c2b8acf, 0xb492a779, 0xf2f0f307, 0xe2a14e69, 0xf4cd65da, 0xbed50605, 0x621fd134, 0xfe8ac4a6, 0x539d342e, 0x55a0a2f3, 0xe132058a, 0xeb75a4f6, 0xec390b83, 0xefaa4060, 0x9f065e71, 0x1051bd6e, 0x8af93e21, 0x063d96dd, 0x05aedd3e, 0xbd464de6, 0x8db59154, 0x5d0571c4, 0xd46f0406, 0x15ff6050, 0xfb241998, 0xe997d6bd, 0x43cc8940, 0x9e7767d9, 0x42bdb0e8, 0x8b880789, 0x5b38e719, 0xeedb79c8, 0x0a47a17c, 0x0fe97c42, 0x1ec9f884, 0x00000000, 0x86830980, 0xed48322b, 0x70ac1e11, 0x724e6c5a, 0xfffbfd0e, 0x38560f85, 0xd51e3dae, 0x3927362d, 0xd9640a0f, 0xa621685c, 0x54d19b5b, 0x2e3a2436, 0x67b10c0a, 0xe70f9357, 0x96d2b4ee, 0x919e1b9b, 0xc54f80c0, 0x20a261dc, 0x4b695a77, 0x1a161c12, 0xba0ae293, 0x2ae5c0a0, 0xe0433c22, 0x171d121b, 0x0d0b0e09, 0xc7adf28b, 0xa8b92db6, 0xa9c8141e, 0x198557f1, 0x074caf75, 0xddbbee99, 0x60fda37f, 0x269ff701, 0xf5bc5c72, 0x3bc54466, 0x7e345bfb, 0x29768b43, 0xc6dccb23, 0xfc68b6ed, 0xf163b8e4, 0xdccad731, 0x85104263, 0x22401397, 0x112084c6, 0x247d854a, 0x3df8d2bb, 0x3211aef9, 0xa16dc729, 0x2f4b1d9e, 0x30f3dcb2, 0x52ec0d86, 0xe3d077c1, 0x166c2bb3, 0xb999a970, 0x48fa1194, 0x642247e9, 0x8cc4a8fc, 0x3f1aa0f0, 0x2cd8567d, 0x90ef2233, 0x4ec78749, 0xd1c1d938, 0xa2fe8cca, 0x0b3698d4, 0x81cfa6f5, 0xde28a57a, 0x8e26dab7, 0xbfa43fad, 0x9de42c3a, 0x920d5078, 0xcc9b6a5f, 0x4662547e, 0x13c2f68d, 0xb8e890d8, 0xf75e2e39, 0xaff582c3, 0x80be9f5d, 0x937c69d0, 0x2da96fd5, 0x12b3cf25, 0x993bc8ac, 0x7da71018, 0x636ee89c, 0xbb7bdb3b, 0x7809cd26, 0x18f46e59, 0xb701ec9a, 0x9aa8834f, 0x6e65e695, 0xe67eaaff, 0xcf0821bc, 0xe8e6ef15, 0x9bd9bae7, 0x36ce4a6f, 0x09d4ea9f, 0x7cd629b0, 0xb2af31a4, 0x23312a3f, 0x9430c6a5, 0x66c035a2, 0xbc37744e, 0xcaa6fc82, 0xd0b0e090, 0xd81533a7, 0x984af104, 0xdaf741ec, 0x500e7fcd, 0xf62f1791, 0xd68d764d, 0xb04d43ef, 0x4d54ccaa, 0x04dfe496, 0xb5e39ed1, 0x881b4c6a, 0x1fb8c12c, 0x517f4665, 0xea049d5e, 0x355d018c, 0x7473fa87, 0x412efb0b, 0x1d5ab367, 0xd25292db, 0x5633e910, 0x47136dd6, 0x618c9ad7, 0x0c7a37a1, 0x148e59f8, 0x3c89eb13, 0x27eecea9, 0xc935b761, 0xe5ede11c, 0xb13c7a47, 0xdf599cd2, 0x733f55f2, 0xce791814, 0x37bf73c7, 0xcdea53f7, 0xaa5b5ffd, 0x6f14df3d, 0xdb867844, 0xf381caaf, 0xc43eb968, 0x342c3824, 0x405fc2a3, 0xc372161d, 0x250cbce2, 0x498b283c, 0x9541ff0d, 0x017139a8, 0xb3de080c, 0xe49cd8b4, 0xc1906456, 0x84617bcb, 0xb670d532, 0x5c74486c, 0x5742d0b8];
    var T8 = [0xf4a75051, 0x4165537e, 0x17a4c31a, 0x275e963a, 0xab6bcb3b, 0x9d45f11f, 0xfa58abac, 0xe303934b, 0x30fa5520, 0x766df6ad, 0xcc769188, 0x024c25f5, 0xe5d7fc4f, 0x2acbd7c5, 0x35448026, 0x62a38fb5, 0xb15a49de, 0xba1b6725, 0xea0e9845, 0xfec0e15d, 0x2f7502c3, 0x4cf01281, 0x4697a38d, 0xd3f9c66b, 0x8f5fe703, 0x929c9515, 0x6d7aebbf, 0x5259da95, 0xbe832dd4, 0x7421d358, 0xe0692949, 0xc9c8448e, 0xc2896a75, 0x8e7978f4, 0x583e6b99, 0xb971dd27, 0xe14fb6be, 0x88ad17f0, 0x20ac66c9, 0xce3ab47d, 0xdf4a1863, 0x1a3182e5, 0x51336097, 0x537f4562, 0x6477e0b1, 0x6bae84bb, 0x81a01cfe, 0x082b94f9, 0x48685870, 0x45fd198f, 0xde6c8794, 0x7bf8b752, 0x73d323ab, 0x4b02e272, 0x1f8f57e3, 0x55ab2a66, 0xeb2807b2, 0xb5c2032f, 0xc57b9a86, 0x3708a5d3, 0x2887f230, 0xbfa5b223, 0x036aba02, 0x16825ced, 0xcf1c2b8a, 0x79b492a7, 0x07f2f0f3, 0x69e2a14e, 0xdaf4cd65, 0x05bed506, 0x34621fd1, 0xa6fe8ac4, 0x2e539d34, 0xf355a0a2, 0x8ae13205, 0xf6eb75a4, 0x83ec390b, 0x60efaa40, 0x719f065e, 0x6e1051bd, 0x218af93e, 0xdd063d96, 0x3e05aedd, 0xe6bd464d, 0x548db591, 0xc45d0571, 0x06d46f04, 0x5015ff60, 0x98fb2419, 0xbde997d6, 0x4043cc89, 0xd99e7767, 0xe842bdb0, 0x898b8807, 0x195b38e7, 0xc8eedb79, 0x7c0a47a1, 0x420fe97c, 0x841ec9f8, 0x00000000, 0x80868309, 0x2bed4832, 0x1170ac1e, 0x5a724e6c, 0x0efffbfd, 0x8538560f, 0xaed51e3d, 0x2d392736, 0x0fd9640a, 0x5ca62168, 0x5b54d19b, 0x362e3a24, 0x0a67b10c, 0x57e70f93, 0xee96d2b4, 0x9b919e1b, 0xc0c54f80, 0xdc20a261, 0x774b695a, 0x121a161c, 0x93ba0ae2, 0xa02ae5c0, 0x22e0433c, 0x1b171d12, 0x090d0b0e, 0x8bc7adf2, 0xb6a8b92d, 0x1ea9c814, 0xf1198557, 0x75074caf, 0x99ddbbee, 0x7f60fda3, 0x01269ff7, 0x72f5bc5c, 0x663bc544, 0xfb7e345b, 0x4329768b, 0x23c6dccb, 0xedfc68b6, 0xe4f163b8, 0x31dccad7, 0x63851042, 0x97224013, 0xc6112084, 0x4a247d85, 0xbb3df8d2, 0xf93211ae, 0x29a16dc7, 0x9e2f4b1d, 0xb230f3dc, 0x8652ec0d, 0xc1e3d077, 0xb3166c2b, 0x70b999a9, 0x9448fa11, 0xe9642247, 0xfc8cc4a8, 0xf03f1aa0, 0x7d2cd856, 0x3390ef22, 0x494ec787, 0x38d1c1d9, 0xcaa2fe8c, 0xd40b3698, 0xf581cfa6, 0x7ade28a5, 0xb78e26da, 0xadbfa43f, 0x3a9de42c, 0x78920d50, 0x5fcc9b6a, 0x7e466254, 0x8d13c2f6, 0xd8b8e890, 0x39f75e2e, 0xc3aff582, 0x5d80be9f, 0xd0937c69, 0xd52da96f, 0x2512b3cf, 0xac993bc8, 0x187da710, 0x9c636ee8, 0x3bbb7bdb, 0x267809cd, 0x5918f46e, 0x9ab701ec, 0x4f9aa883, 0x956e65e6, 0xffe67eaa, 0xbccf0821, 0x15e8e6ef, 0xe79bd9ba, 0x6f36ce4a, 0x9f09d4ea, 0xb07cd629, 0xa4b2af31, 0x3f23312a, 0xa59430c6, 0xa266c035, 0x4ebc3774, 0x82caa6fc, 0x90d0b0e0, 0xa7d81533, 0x04984af1, 0xecdaf741, 0xcd500e7f, 0x91f62f17, 0x4dd68d76, 0xefb04d43, 0xaa4d54cc, 0x9604dfe4, 0xd1b5e39e, 0x6a881b4c, 0x2c1fb8c1, 0x65517f46, 0x5eea049d, 0x8c355d01, 0x877473fa, 0x0b412efb, 0x671d5ab3, 0xdbd25292, 0x105633e9, 0xd647136d, 0xd7618c9a, 0xa10c7a37, 0xf8148e59, 0x133c89eb, 0xa927eece, 0x61c935b7, 0x1ce5ede1, 0x47b13c7a, 0xd2df599c, 0xf2733f55, 0x14ce7918, 0xc737bf73, 0xf7cdea53, 0xfdaa5b5f, 0x3d6f14df, 0x44db8678, 0xaff381ca, 0x68c43eb9, 0x24342c38, 0xa3405fc2, 0x1dc37216, 0xe2250cbc, 0x3c498b28, 0x0d9541ff, 0xa8017139, 0x0cb3de08, 0xb4e49cd8, 0x56c19064, 0xcb84617b, 0x32b670d5, 0x6c5c7448, 0xb85742d0];

    // Transformations for decryption key expansion
    var U1 = [0x00000000, 0x0e090d0b, 0x1c121a16, 0x121b171d, 0x3824342c, 0x362d3927, 0x24362e3a, 0x2a3f2331, 0x70486858, 0x7e416553, 0x6c5a724e, 0x62537f45, 0x486c5c74, 0x4665517f, 0x547e4662, 0x5a774b69, 0xe090d0b0, 0xee99ddbb, 0xfc82caa6, 0xf28bc7ad, 0xd8b4e49c, 0xd6bde997, 0xc4a6fe8a, 0xcaaff381, 0x90d8b8e8, 0x9ed1b5e3, 0x8ccaa2fe, 0x82c3aff5, 0xa8fc8cc4, 0xa6f581cf, 0xb4ee96d2, 0xbae79bd9, 0xdb3bbb7b, 0xd532b670, 0xc729a16d, 0xc920ac66, 0xe31f8f57, 0xed16825c, 0xff0d9541, 0xf104984a, 0xab73d323, 0xa57ade28, 0xb761c935, 0xb968c43e, 0x9357e70f, 0x9d5eea04, 0x8f45fd19, 0x814cf012, 0x3bab6bcb, 0x35a266c0, 0x27b971dd, 0x29b07cd6, 0x038f5fe7, 0x0d8652ec, 0x1f9d45f1, 0x119448fa, 0x4be30393, 0x45ea0e98, 0x57f11985, 0x59f8148e, 0x73c737bf, 0x7dce3ab4, 0x6fd52da9, 0x61dc20a2, 0xad766df6, 0xa37f60fd, 0xb16477e0, 0xbf6d7aeb, 0x955259da, 0x9b5b54d1, 0x894043cc, 0x87494ec7, 0xdd3e05ae, 0xd33708a5, 0xc12c1fb8, 0xcf2512b3, 0xe51a3182, 0xeb133c89, 0xf9082b94, 0xf701269f, 0x4de6bd46, 0x43efb04d, 0x51f4a750, 0x5ffdaa5b, 0x75c2896a, 0x7bcb8461, 0x69d0937c, 0x67d99e77, 0x3daed51e, 0x33a7d815, 0x21bccf08, 0x2fb5c203, 0x058ae132, 0x0b83ec39, 0x1998fb24, 0x1791f62f, 0x764dd68d, 0x7844db86, 0x6a5fcc9b, 0x6456c190, 0x4e69e2a1, 0x4060efaa, 0x527bf8b7, 0x5c72f5bc, 0x0605bed5, 0x080cb3de, 0x1a17a4c3, 0x141ea9c8, 0x3e218af9, 0x302887f2, 0x223390ef, 0x2c3a9de4, 0x96dd063d, 0x98d40b36, 0x8acf1c2b, 0x84c61120, 0xaef93211, 0xa0f03f1a, 0xb2eb2807, 0xbce2250c, 0xe6956e65, 0xe89c636e, 0xfa877473, 0xf48e7978, 0xdeb15a49, 0xd0b85742, 0xc2a3405f, 0xccaa4d54, 0x41ecdaf7, 0x4fe5d7fc, 0x5dfec0e1, 0x53f7cdea, 0x79c8eedb, 0x77c1e3d0, 0x65daf4cd, 0x6bd3f9c6, 0x31a4b2af, 0x3fadbfa4, 0x2db6a8b9, 0x23bfa5b2, 0x09808683, 0x07898b88, 0x15929c95, 0x1b9b919e, 0xa17c0a47, 0xaf75074c, 0xbd6e1051, 0xb3671d5a, 0x99583e6b, 0x97513360, 0x854a247d, 0x8b432976, 0xd134621f, 0xdf3d6f14, 0xcd267809, 0xc32f7502, 0xe9105633, 0xe7195b38, 0xf5024c25, 0xfb0b412e, 0x9ad7618c, 0x94de6c87, 0x86c57b9a, 0x88cc7691, 0xa2f355a0, 0xacfa58ab, 0xbee14fb6, 0xb0e842bd, 0xea9f09d4, 0xe49604df, 0xf68d13c2, 0xf8841ec9, 0xd2bb3df8, 0xdcb230f3, 0xcea927ee, 0xc0a02ae5, 0x7a47b13c, 0x744ebc37, 0x6655ab2a, 0x685ca621, 0x42638510, 0x4c6a881b, 0x5e719f06, 0x5078920d, 0x0a0fd964, 0x0406d46f, 0x161dc372, 0x1814ce79, 0x322bed48, 0x3c22e043, 0x2e39f75e, 0x2030fa55, 0xec9ab701, 0xe293ba0a, 0xf088ad17, 0xfe81a01c, 0xd4be832d, 0xdab78e26, 0xc8ac993b, 0xc6a59430, 0x9cd2df59, 0x92dbd252, 0x80c0c54f, 0x8ec9c844, 0xa4f6eb75, 0xaaffe67e, 0xb8e4f163, 0xb6edfc68, 0x0c0a67b1, 0x02036aba, 0x10187da7, 0x1e1170ac, 0x342e539d, 0x3a275e96, 0x283c498b, 0x26354480, 0x7c420fe9, 0x724b02e2, 0x605015ff, 0x6e5918f4, 0x44663bc5, 0x4a6f36ce, 0x587421d3, 0x567d2cd8, 0x37a10c7a, 0x39a80171, 0x2bb3166c, 0x25ba1b67, 0x0f853856, 0x018c355d, 0x13972240, 0x1d9e2f4b, 0x47e96422, 0x49e06929, 0x5bfb7e34, 0x55f2733f, 0x7fcd500e, 0x71c45d05, 0x63df4a18, 0x6dd64713, 0xd731dcca, 0xd938d1c1, 0xcb23c6dc, 0xc52acbd7, 0xef15e8e6, 0xe11ce5ed, 0xf307f2f0, 0xfd0efffb, 0xa779b492, 0xa970b999, 0xbb6bae84, 0xb562a38f, 0x9f5d80be, 0x91548db5, 0x834f9aa8, 0x8d4697a3];
    var U2 = [0x00000000, 0x0b0e090d, 0x161c121a, 0x1d121b17, 0x2c382434, 0x27362d39, 0x3a24362e, 0x312a3f23, 0x58704868, 0x537e4165, 0x4e6c5a72, 0x4562537f, 0x74486c5c, 0x7f466551, 0x62547e46, 0x695a774b, 0xb0e090d0, 0xbbee99dd, 0xa6fc82ca, 0xadf28bc7, 0x9cd8b4e4, 0x97d6bde9, 0x8ac4a6fe, 0x81caaff3, 0xe890d8b8, 0xe39ed1b5, 0xfe8ccaa2, 0xf582c3af, 0xc4a8fc8c, 0xcfa6f581, 0xd2b4ee96, 0xd9bae79b, 0x7bdb3bbb, 0x70d532b6, 0x6dc729a1, 0x66c920ac, 0x57e31f8f, 0x5ced1682, 0x41ff0d95, 0x4af10498, 0x23ab73d3, 0x28a57ade, 0x35b761c9, 0x3eb968c4, 0x0f9357e7, 0x049d5eea, 0x198f45fd, 0x12814cf0, 0xcb3bab6b, 0xc035a266, 0xdd27b971, 0xd629b07c, 0xe7038f5f, 0xec0d8652, 0xf11f9d45, 0xfa119448, 0x934be303, 0x9845ea0e, 0x8557f119, 0x8e59f814, 0xbf73c737, 0xb47dce3a, 0xa96fd52d, 0xa261dc20, 0xf6ad766d, 0xfda37f60, 0xe0b16477, 0xebbf6d7a, 0xda955259, 0xd19b5b54, 0xcc894043, 0xc787494e, 0xaedd3e05, 0xa5d33708, 0xb8c12c1f, 0xb3cf2512, 0x82e51a31, 0x89eb133c, 0x94f9082b, 0x9ff70126, 0x464de6bd, 0x4d43efb0, 0x5051f4a7, 0x5b5ffdaa, 0x6a75c289, 0x617bcb84, 0x7c69d093, 0x7767d99e, 0x1e3daed5, 0x1533a7d8, 0x0821bccf, 0x032fb5c2, 0x32058ae1, 0x390b83ec, 0x241998fb, 0x2f1791f6, 0x8d764dd6, 0x867844db, 0x9b6a5fcc, 0x906456c1, 0xa14e69e2, 0xaa4060ef, 0xb7527bf8, 0xbc5c72f5, 0xd50605be, 0xde080cb3, 0xc31a17a4, 0xc8141ea9, 0xf93e218a, 0xf2302887, 0xef223390, 0xe42c3a9d, 0x3d96dd06, 0x3698d40b, 0x2b8acf1c, 0x2084c611, 0x11aef932, 0x1aa0f03f, 0x07b2eb28, 0x0cbce225, 0x65e6956e, 0x6ee89c63, 0x73fa8774, 0x78f48e79, 0x49deb15a, 0x42d0b857, 0x5fc2a340, 0x54ccaa4d, 0xf741ecda, 0xfc4fe5d7, 0xe15dfec0, 0xea53f7cd, 0xdb79c8ee, 0xd077c1e3, 0xcd65daf4, 0xc66bd3f9, 0xaf31a4b2, 0xa43fadbf, 0xb92db6a8, 0xb223bfa5, 0x83098086, 0x8807898b, 0x9515929c, 0x9e1b9b91, 0x47a17c0a, 0x4caf7507, 0x51bd6e10, 0x5ab3671d, 0x6b99583e, 0x60975133, 0x7d854a24, 0x768b4329, 0x1fd13462, 0x14df3d6f, 0x09cd2678, 0x02c32f75, 0x33e91056, 0x38e7195b, 0x25f5024c, 0x2efb0b41, 0x8c9ad761, 0x8794de6c, 0x9a86c57b, 0x9188cc76, 0xa0a2f355, 0xabacfa58, 0xb6bee14f, 0xbdb0e842, 0xd4ea9f09, 0xdfe49604, 0xc2f68d13, 0xc9f8841e, 0xf8d2bb3d, 0xf3dcb230, 0xeecea927, 0xe5c0a02a, 0x3c7a47b1, 0x37744ebc, 0x2a6655ab, 0x21685ca6, 0x10426385, 0x1b4c6a88, 0x065e719f, 0x0d507892, 0x640a0fd9, 0x6f0406d4, 0x72161dc3, 0x791814ce, 0x48322bed, 0x433c22e0, 0x5e2e39f7, 0x552030fa, 0x01ec9ab7, 0x0ae293ba, 0x17f088ad, 0x1cfe81a0, 0x2dd4be83, 0x26dab78e, 0x3bc8ac99, 0x30c6a594, 0x599cd2df, 0x5292dbd2, 0x4f80c0c5, 0x448ec9c8, 0x75a4f6eb, 0x7eaaffe6, 0x63b8e4f1, 0x68b6edfc, 0xb10c0a67, 0xba02036a, 0xa710187d, 0xac1e1170, 0x9d342e53, 0x963a275e, 0x8b283c49, 0x80263544, 0xe97c420f, 0xe2724b02, 0xff605015, 0xf46e5918, 0xc544663b, 0xce4a6f36, 0xd3587421, 0xd8567d2c, 0x7a37a10c, 0x7139a801, 0x6c2bb316, 0x6725ba1b, 0x560f8538, 0x5d018c35, 0x40139722, 0x4b1d9e2f, 0x2247e964, 0x2949e069, 0x345bfb7e, 0x3f55f273, 0x0e7fcd50, 0x0571c45d, 0x1863df4a, 0x136dd647, 0xcad731dc, 0xc1d938d1, 0xdccb23c6, 0xd7c52acb, 0xe6ef15e8, 0xede11ce5, 0xf0f307f2, 0xfbfd0eff, 0x92a779b4, 0x99a970b9, 0x84bb6bae, 0x8fb562a3, 0xbe9f5d80, 0xb591548d, 0xa8834f9a, 0xa38d4697];
    var U3 = [0x00000000, 0x0d0b0e09, 0x1a161c12, 0x171d121b, 0x342c3824, 0x3927362d, 0x2e3a2436, 0x23312a3f, 0x68587048, 0x65537e41, 0x724e6c5a, 0x7f456253, 0x5c74486c, 0x517f4665, 0x4662547e, 0x4b695a77, 0xd0b0e090, 0xddbbee99, 0xcaa6fc82, 0xc7adf28b, 0xe49cd8b4, 0xe997d6bd, 0xfe8ac4a6, 0xf381caaf, 0xb8e890d8, 0xb5e39ed1, 0xa2fe8cca, 0xaff582c3, 0x8cc4a8fc, 0x81cfa6f5, 0x96d2b4ee, 0x9bd9bae7, 0xbb7bdb3b, 0xb670d532, 0xa16dc729, 0xac66c920, 0x8f57e31f, 0x825ced16, 0x9541ff0d, 0x984af104, 0xd323ab73, 0xde28a57a, 0xc935b761, 0xc43eb968, 0xe70f9357, 0xea049d5e, 0xfd198f45, 0xf012814c, 0x6bcb3bab, 0x66c035a2, 0x71dd27b9, 0x7cd629b0, 0x5fe7038f, 0x52ec0d86, 0x45f11f9d, 0x48fa1194, 0x03934be3, 0x0e9845ea, 0x198557f1, 0x148e59f8, 0x37bf73c7, 0x3ab47dce, 0x2da96fd5, 0x20a261dc, 0x6df6ad76, 0x60fda37f, 0x77e0b164, 0x7aebbf6d, 0x59da9552, 0x54d19b5b, 0x43cc8940, 0x4ec78749, 0x05aedd3e, 0x08a5d337, 0x1fb8c12c, 0x12b3cf25, 0x3182e51a, 0x3c89eb13, 0x2b94f908, 0x269ff701, 0xbd464de6, 0xb04d43ef, 0xa75051f4, 0xaa5b5ffd, 0x896a75c2, 0x84617bcb, 0x937c69d0, 0x9e7767d9, 0xd51e3dae, 0xd81533a7, 0xcf0821bc, 0xc2032fb5, 0xe132058a, 0xec390b83, 0xfb241998, 0xf62f1791, 0xd68d764d, 0xdb867844, 0xcc9b6a5f, 0xc1906456, 0xe2a14e69, 0xefaa4060, 0xf8b7527b, 0xf5bc5c72, 0xbed50605, 0xb3de080c, 0xa4c31a17, 0xa9c8141e, 0x8af93e21, 0x87f23028, 0x90ef2233, 0x9de42c3a, 0x063d96dd, 0x0b3698d4, 0x1c2b8acf, 0x112084c6, 0x3211aef9, 0x3f1aa0f0, 0x2807b2eb, 0x250cbce2, 0x6e65e695, 0x636ee89c, 0x7473fa87, 0x7978f48e, 0x5a49deb1, 0x5742d0b8, 0x405fc2a3, 0x4d54ccaa, 0xdaf741ec, 0xd7fc4fe5, 0xc0e15dfe, 0xcdea53f7, 0xeedb79c8, 0xe3d077c1, 0xf4cd65da, 0xf9c66bd3, 0xb2af31a4, 0xbfa43fad, 0xa8b92db6, 0xa5b223bf, 0x86830980, 0x8b880789, 0x9c951592, 0x919e1b9b, 0x0a47a17c, 0x074caf75, 0x1051bd6e, 0x1d5ab367, 0x3e6b9958, 0x33609751, 0x247d854a, 0x29768b43, 0x621fd134, 0x6f14df3d, 0x7809cd26, 0x7502c32f, 0x5633e910, 0x5b38e719, 0x4c25f502, 0x412efb0b, 0x618c9ad7, 0x6c8794de, 0x7b9a86c5, 0x769188cc, 0x55a0a2f3, 0x58abacfa, 0x4fb6bee1, 0x42bdb0e8, 0x09d4ea9f, 0x04dfe496, 0x13c2f68d, 0x1ec9f884, 0x3df8d2bb, 0x30f3dcb2, 0x27eecea9, 0x2ae5c0a0, 0xb13c7a47, 0xbc37744e, 0xab2a6655, 0xa621685c, 0x85104263, 0x881b4c6a, 0x9f065e71, 0x920d5078, 0xd9640a0f, 0xd46f0406, 0xc372161d, 0xce791814, 0xed48322b, 0xe0433c22, 0xf75e2e39, 0xfa552030, 0xb701ec9a, 0xba0ae293, 0xad17f088, 0xa01cfe81, 0x832dd4be, 0x8e26dab7, 0x993bc8ac, 0x9430c6a5, 0xdf599cd2, 0xd25292db, 0xc54f80c0, 0xc8448ec9, 0xeb75a4f6, 0xe67eaaff, 0xf163b8e4, 0xfc68b6ed, 0x67b10c0a, 0x6aba0203, 0x7da71018, 0x70ac1e11, 0x539d342e, 0x5e963a27, 0x498b283c, 0x44802635, 0x0fe97c42, 0x02e2724b, 0x15ff6050, 0x18f46e59, 0x3bc54466, 0x36ce4a6f, 0x21d35874, 0x2cd8567d, 0x0c7a37a1, 0x017139a8, 0x166c2bb3, 0x1b6725ba, 0x38560f85, 0x355d018c, 0x22401397, 0x2f4b1d9e, 0x642247e9, 0x692949e0, 0x7e345bfb, 0x733f55f2, 0x500e7fcd, 0x5d0571c4, 0x4a1863df, 0x47136dd6, 0xdccad731, 0xd1c1d938, 0xc6dccb23, 0xcbd7c52a, 0xe8e6ef15, 0xe5ede11c, 0xf2f0f307, 0xfffbfd0e, 0xb492a779, 0xb999a970, 0xae84bb6b, 0xa38fb562, 0x80be9f5d, 0x8db59154, 0x9aa8834f, 0x97a38d46];
    var U4 = [0x00000000, 0x090d0b0e, 0x121a161c, 0x1b171d12, 0x24342c38, 0x2d392736, 0x362e3a24, 0x3f23312a, 0x48685870, 0x4165537e, 0x5a724e6c, 0x537f4562, 0x6c5c7448, 0x65517f46, 0x7e466254, 0x774b695a, 0x90d0b0e0, 0x99ddbbee, 0x82caa6fc, 0x8bc7adf2, 0xb4e49cd8, 0xbde997d6, 0xa6fe8ac4, 0xaff381ca, 0xd8b8e890, 0xd1b5e39e, 0xcaa2fe8c, 0xc3aff582, 0xfc8cc4a8, 0xf581cfa6, 0xee96d2b4, 0xe79bd9ba, 0x3bbb7bdb, 0x32b670d5, 0x29a16dc7, 0x20ac66c9, 0x1f8f57e3, 0x16825ced, 0x0d9541ff, 0x04984af1, 0x73d323ab, 0x7ade28a5, 0x61c935b7, 0x68c43eb9, 0x57e70f93, 0x5eea049d, 0x45fd198f, 0x4cf01281, 0xab6bcb3b, 0xa266c035, 0xb971dd27, 0xb07cd629, 0x8f5fe703, 0x8652ec0d, 0x9d45f11f, 0x9448fa11, 0xe303934b, 0xea0e9845, 0xf1198557, 0xf8148e59, 0xc737bf73, 0xce3ab47d, 0xd52da96f, 0xdc20a261, 0x766df6ad, 0x7f60fda3, 0x6477e0b1, 0x6d7aebbf, 0x5259da95, 0x5b54d19b, 0x4043cc89, 0x494ec787, 0x3e05aedd, 0x3708a5d3, 0x2c1fb8c1, 0x2512b3cf, 0x1a3182e5, 0x133c89eb, 0x082b94f9, 0x01269ff7, 0xe6bd464d, 0xefb04d43, 0xf4a75051, 0xfdaa5b5f, 0xc2896a75, 0xcb84617b, 0xd0937c69, 0xd99e7767, 0xaed51e3d, 0xa7d81533, 0xbccf0821, 0xb5c2032f, 0x8ae13205, 0x83ec390b, 0x98fb2419, 0x91f62f17, 0x4dd68d76, 0x44db8678, 0x5fcc9b6a, 0x56c19064, 0x69e2a14e, 0x60efaa40, 0x7bf8b752, 0x72f5bc5c, 0x05bed506, 0x0cb3de08, 0x17a4c31a, 0x1ea9c814, 0x218af93e, 0x2887f230, 0x3390ef22, 0x3a9de42c, 0xdd063d96, 0xd40b3698, 0xcf1c2b8a, 0xc6112084, 0xf93211ae, 0xf03f1aa0, 0xeb2807b2, 0xe2250cbc, 0x956e65e6, 0x9c636ee8, 0x877473fa, 0x8e7978f4, 0xb15a49de, 0xb85742d0, 0xa3405fc2, 0xaa4d54cc, 0xecdaf741, 0xe5d7fc4f, 0xfec0e15d, 0xf7cdea53, 0xc8eedb79, 0xc1e3d077, 0xdaf4cd65, 0xd3f9c66b, 0xa4b2af31, 0xadbfa43f, 0xb6a8b92d, 0xbfa5b223, 0x80868309, 0x898b8807, 0x929c9515, 0x9b919e1b, 0x7c0a47a1, 0x75074caf, 0x6e1051bd, 0x671d5ab3, 0x583e6b99, 0x51336097, 0x4a247d85, 0x4329768b, 0x34621fd1, 0x3d6f14df, 0x267809cd, 0x2f7502c3, 0x105633e9, 0x195b38e7, 0x024c25f5, 0x0b412efb, 0xd7618c9a, 0xde6c8794, 0xc57b9a86, 0xcc769188, 0xf355a0a2, 0xfa58abac, 0xe14fb6be, 0xe842bdb0, 0x9f09d4ea, 0x9604dfe4, 0x8d13c2f6, 0x841ec9f8, 0xbb3df8d2, 0xb230f3dc, 0xa927eece, 0xa02ae5c0, 0x47b13c7a, 0x4ebc3774, 0x55ab2a66, 0x5ca62168, 0x63851042, 0x6a881b4c, 0x719f065e, 0x78920d50, 0x0fd9640a, 0x06d46f04, 0x1dc37216, 0x14ce7918, 0x2bed4832, 0x22e0433c, 0x39f75e2e, 0x30fa5520, 0x9ab701ec, 0x93ba0ae2, 0x88ad17f0, 0x81a01cfe, 0xbe832dd4, 0xb78e26da, 0xac993bc8, 0xa59430c6, 0xd2df599c, 0xdbd25292, 0xc0c54f80, 0xc9c8448e, 0xf6eb75a4, 0xffe67eaa, 0xe4f163b8, 0xedfc68b6, 0x0a67b10c, 0x036aba02, 0x187da710, 0x1170ac1e, 0x2e539d34, 0x275e963a, 0x3c498b28, 0x35448026, 0x420fe97c, 0x4b02e272, 0x5015ff60, 0x5918f46e, 0x663bc544, 0x6f36ce4a, 0x7421d358, 0x7d2cd856, 0xa10c7a37, 0xa8017139, 0xb3166c2b, 0xba1b6725, 0x8538560f, 0x8c355d01, 0x97224013, 0x9e2f4b1d, 0xe9642247, 0xe0692949, 0xfb7e345b, 0xf2733f55, 0xcd500e7f, 0xc45d0571, 0xdf4a1863, 0xd647136d, 0x31dccad7, 0x38d1c1d9, 0x23c6dccb, 0x2acbd7c5, 0x15e8e6ef, 0x1ce5ede1, 0x07f2f0f3, 0x0efffbfd, 0x79b492a7, 0x70b999a9, 0x6bae84bb, 0x62a38fb5, 0x5d80be9f, 0x548db591, 0x4f9aa883, 0x4697a38d];

    function convertToInt32(bytes) {
        var result = [];
        for (var i = 0; i < bytes.length; i += 4) {
            result.push(
                (bytes[i    ] << 24) |
                (bytes[i + 1] << 16) |
                (bytes[i + 2] <<  8) |
                 bytes[i + 3]
            );
        }
        return result;
    }

    var AES = function(key) {
        if (!(this instanceof AES)) {
            throw Error('AES must be instanitated with `new`');
        }

        Object.defineProperty(this, 'key', {
            value: coerceArray(key, true)
        });

        this._prepare();
    }


    AES.prototype._prepare = function() {

        var rounds = numberOfRounds[this.key.length];
        if (rounds == null) {
            throw new Error('invalid key size (must be 16, 24 or 32 bytes)');
        }

        // encryption round keys
        this._Ke = [];

        // decryption round keys
        this._Kd = [];

        for (var i = 0; i <= rounds; i++) {
            this._Ke.push([0, 0, 0, 0]);
            this._Kd.push([0, 0, 0, 0]);
        }

        var roundKeyCount = (rounds + 1) * 4;
        var KC = this.key.length / 4;

        // convert the key into ints
        var tk = convertToInt32(this.key);

        // copy values into round key arrays
        var index;
        for (var i = 0; i < KC; i++) {
            index = i >> 2;
            this._Ke[index][i % 4] = tk[i];
            this._Kd[rounds - index][i % 4] = tk[i];
        }

        // key expansion (fips-197 section 5.2)
        var rconpointer = 0;
        var t = KC, tt;
        while (t < roundKeyCount) {
            tt = tk[KC - 1];
            tk[0] ^= ((S[(tt >> 16) & 0xFF] << 24) ^
                      (S[(tt >>  8) & 0xFF] << 16) ^
                      (S[ tt        & 0xFF] <<  8) ^
                       S[(tt >> 24) & 0xFF]        ^
                      (rcon[rconpointer] << 24));
            rconpointer += 1;

            // key expansion (for non-256 bit)
            if (KC != 8) {
                for (var i = 1; i < KC; i++) {
                    tk[i] ^= tk[i - 1];
                }

            // key expansion for 256-bit keys is "slightly different" (fips-197)
            } else {
                for (var i = 1; i < (KC / 2); i++) {
                    tk[i] ^= tk[i - 1];
                }
                tt = tk[(KC / 2) - 1];

                tk[KC / 2] ^= (S[ tt        & 0xFF]        ^
                              (S[(tt >>  8) & 0xFF] <<  8) ^
                              (S[(tt >> 16) & 0xFF] << 16) ^
                              (S[(tt >> 24) & 0xFF] << 24));

                for (var i = (KC / 2) + 1; i < KC; i++) {
                    tk[i] ^= tk[i - 1];
                }
            }

            // copy values into round key arrays
            var i = 0, r, c;
            while (i < KC && t < roundKeyCount) {
                r = t >> 2;
                c = t % 4;
                this._Ke[r][c] = tk[i];
                this._Kd[rounds - r][c] = tk[i++];
                t++;
            }
        }

        // inverse-cipher-ify the decryption round key (fips-197 section 5.3)
        for (var r = 1; r < rounds; r++) {
            for (var c = 0; c < 4; c++) {
                tt = this._Kd[r][c];
                this._Kd[r][c] = (U1[(tt >> 24) & 0xFF] ^
                                  U2[(tt >> 16) & 0xFF] ^
                                  U3[(tt >>  8) & 0xFF] ^
                                  U4[ tt        & 0xFF]);
            }
        }
    }

    AES.prototype.encrypt = function(plaintext) {
        if (plaintext.length != 16) {
            throw new Error('invalid plaintext size (must be 16 bytes)');
        }

        var rounds = this._Ke.length - 1;
        var a = [0, 0, 0, 0];

        // convert plaintext to (ints ^ key)
        var t = convertToInt32(plaintext);
        for (var i = 0; i < 4; i++) {
            t[i] ^= this._Ke[0][i];
        }

        // apply round transforms
        for (var r = 1; r < rounds; r++) {
            for (var i = 0; i < 4; i++) {
                a[i] = (T1[(t[ i         ] >> 24) & 0xff] ^
                        T2[(t[(i + 1) % 4] >> 16) & 0xff] ^
                        T3[(t[(i + 2) % 4] >>  8) & 0xff] ^
                        T4[ t[(i + 3) % 4]        & 0xff] ^
                        this._Ke[r][i]);
            }
            t = a.slice();
        }

        // the last round is special
        var result = createArray(16), tt;
        for (var i = 0; i < 4; i++) {
            tt = this._Ke[rounds][i];
            result[4 * i    ] = (S[(t[ i         ] >> 24) & 0xff] ^ (tt >> 24)) & 0xff;
            result[4 * i + 1] = (S[(t[(i + 1) % 4] >> 16) & 0xff] ^ (tt >> 16)) & 0xff;
            result[4 * i + 2] = (S[(t[(i + 2) % 4] >>  8) & 0xff] ^ (tt >>  8)) & 0xff;
            result[4 * i + 3] = (S[ t[(i + 3) % 4]        & 0xff] ^  tt       ) & 0xff;
        }

        return result;
    }

    AES.prototype.decrypt = function(ciphertext) {
        if (ciphertext.length != 16) {
            throw new Error('invalid ciphertext size (must be 16 bytes)');
        }

        var rounds = this._Kd.length - 1;
        var a = [0, 0, 0, 0];

        // convert plaintext to (ints ^ key)
        var t = convertToInt32(ciphertext);
        for (var i = 0; i < 4; i++) {
            t[i] ^= this._Kd[0][i];
        }

        // apply round transforms
        for (var r = 1; r < rounds; r++) {
            for (var i = 0; i < 4; i++) {
                a[i] = (T5[(t[ i          ] >> 24) & 0xff] ^
                        T6[(t[(i + 3) % 4] >> 16) & 0xff] ^
                        T7[(t[(i + 2) % 4] >>  8) & 0xff] ^
                        T8[ t[(i + 1) % 4]        & 0xff] ^
                        this._Kd[r][i]);
            }
            t = a.slice();
        }

        // the last round is special
        var result = createArray(16), tt;
        for (var i = 0; i < 4; i++) {
            tt = this._Kd[rounds][i];
            result[4 * i    ] = (Si[(t[ i         ] >> 24) & 0xff] ^ (tt >> 24)) & 0xff;
            result[4 * i + 1] = (Si[(t[(i + 3) % 4] >> 16) & 0xff] ^ (tt >> 16)) & 0xff;
            result[4 * i + 2] = (Si[(t[(i + 2) % 4] >>  8) & 0xff] ^ (tt >>  8)) & 0xff;
            result[4 * i + 3] = (Si[ t[(i + 1) % 4]        & 0xff] ^  tt       ) & 0xff;
        }

        return result;
    }


    /**
     *  Mode Of Operation - Electonic Codebook (ECB)
     */
    var ModeOfOperationECB = function(key) {
        if (!(this instanceof ModeOfOperationECB)) {
            throw Error('AES must be instanitated with `new`');
        }

        this.description = "Electronic Code Block";
        this.name = "ecb";

        this._aes = new AES(key);
    }

    ModeOfOperationECB.prototype.encrypt = function(plaintext) {
        plaintext = coerceArray(plaintext);

        if ((plaintext.length % 16) !== 0) {
            throw new Error('invalid plaintext size (must be multiple of 16 bytes)');
        }

        var ciphertext = createArray(plaintext.length);
        var block = createArray(16);

        for (var i = 0; i < plaintext.length; i += 16) {
            copyArray(plaintext, block, 0, i, i + 16);
            block = this._aes.encrypt(block);
            copyArray(block, ciphertext, i);
        }

        return ciphertext;
    }

    ModeOfOperationECB.prototype.decrypt = function(ciphertext) {
        ciphertext = coerceArray(ciphertext);

        if ((ciphertext.length % 16) !== 0) {
            throw new Error('invalid ciphertext size (must be multiple of 16 bytes)');
        }

        var plaintext = createArray(ciphertext.length);
        var block = createArray(16);

        for (var i = 0; i < ciphertext.length; i += 16) {
            copyArray(ciphertext, block, 0, i, i + 16);
            block = this._aes.decrypt(block);
            copyArray(block, plaintext, i);
        }

        return plaintext;
    }


    /**
     *  Mode Of Operation - Cipher Block Chaining (CBC)
     */
    var ModeOfOperationCBC = function(key, iv) {
        if (!(this instanceof ModeOfOperationCBC)) {
            throw Error('AES must be instanitated with `new`');
        }

        this.description = "Cipher Block Chaining";
        this.name = "cbc";

        if (!iv) {
            iv = createArray(16);

        } else if (iv.length != 16) {
            throw new Error('invalid initialation vector size (must be 16 bytes)');
        }

        this._lastCipherblock = coerceArray(iv, true);

        this._aes = new AES(key);
    }

    ModeOfOperationCBC.prototype.encrypt = function(plaintext) {
        plaintext = coerceArray(plaintext);

        if ((plaintext.length % 16) !== 0) {
            throw new Error('invalid plaintext size (must be multiple of 16 bytes)');
        }

        var ciphertext = createArray(plaintext.length);
        var block = createArray(16);

        for (var i = 0; i < plaintext.length; i += 16) {
            copyArray(plaintext, block, 0, i, i + 16);

            for (var j = 0; j < 16; j++) {
                block[j] ^= this._lastCipherblock[j];
            }

            this._lastCipherblock = this._aes.encrypt(block);
            copyArray(this._lastCipherblock, ciphertext, i);
        }

        return ciphertext;
    }

    ModeOfOperationCBC.prototype.decrypt = function(ciphertext) {
        ciphertext = coerceArray(ciphertext);

        if ((ciphertext.length % 16) !== 0) {
            throw new Error('invalid ciphertext size (must be multiple of 16 bytes)');
        }

        var plaintext = createArray(ciphertext.length);
        var block = createArray(16);

        for (var i = 0; i < ciphertext.length; i += 16) {
            copyArray(ciphertext, block, 0, i, i + 16);
            block = this._aes.decrypt(block);

            for (var j = 0; j < 16; j++) {
                plaintext[i + j] = block[j] ^ this._lastCipherblock[j];
            }

            copyArray(ciphertext, this._lastCipherblock, 0, i, i + 16);
        }

        return plaintext;
    }


    /**
     *  Mode Of Operation - Cipher Feedback (CFB)
     */
    var ModeOfOperationCFB = function(key, iv, segmentSize) {
        if (!(this instanceof ModeOfOperationCFB)) {
            throw Error('AES must be instanitated with `new`');
        }

        this.description = "Cipher Feedback";
        this.name = "cfb";

        if (!iv) {
            iv = createArray(16);

        } else if (iv.length != 16) {
            throw new Error('invalid initialation vector size (must be 16 size)');
        }

        if (!segmentSize) { segmentSize = 1; }

        this.segmentSize = segmentSize;

        this._shiftRegister = coerceArray(iv, true);

        this._aes = new AES(key);
    }

    ModeOfOperationCFB.prototype.encrypt = function(plaintext) {
        if ((plaintext.length % this.segmentSize) != 0) {
            throw new Error('invalid plaintext size (must be segmentSize bytes)');
        }

        var encrypted = coerceArray(plaintext, true);

        var xorSegment;
        for (var i = 0; i < encrypted.length; i += this.segmentSize) {
            xorSegment = this._aes.encrypt(this._shiftRegister);
            for (var j = 0; j < this.segmentSize; j++) {
                encrypted[i + j] ^= xorSegment[j];
            }

            // Shift the register
            copyArray(this._shiftRegister, this._shiftRegister, 0, this.segmentSize);
            copyArray(encrypted, this._shiftRegister, 16 - this.segmentSize, i, i + this.segmentSize);
        }

        return encrypted;
    }

    ModeOfOperationCFB.prototype.decrypt = function(ciphertext) {
        if ((ciphertext.length % this.segmentSize) != 0) {
            throw new Error('invalid ciphertext size (must be segmentSize bytes)');
        }

        var plaintext = coerceArray(ciphertext, true);

        var xorSegment;
        for (var i = 0; i < plaintext.length; i += this.segmentSize) {
            xorSegment = this._aes.encrypt(this._shiftRegister);

            for (var j = 0; j < this.segmentSize; j++) {
                plaintext[i + j] ^= xorSegment[j];
            }

            // Shift the register
            copyArray(this._shiftRegister, this._shiftRegister, 0, this.segmentSize);
            copyArray(ciphertext, this._shiftRegister, 16 - this.segmentSize, i, i + this.segmentSize);
        }

        return plaintext;
    }

    /**
     *  Mode Of Operation - Output Feedback (OFB)
     */
    var ModeOfOperationOFB = function(key, iv) {
        if (!(this instanceof ModeOfOperationOFB)) {
            throw Error('AES must be instanitated with `new`');
        }

        this.description = "Output Feedback";
        this.name = "ofb";

        if (!iv) {
            iv = createArray(16);

        } else if (iv.length != 16) {
            throw new Error('invalid initialation vector size (must be 16 bytes)');
        }

        this._lastPrecipher = coerceArray(iv, true);
        this._lastPrecipherIndex = 16;

        this._aes = new AES(key);
    }

    ModeOfOperationOFB.prototype.encrypt = function(plaintext) {
        var encrypted = coerceArray(plaintext, true);

        for (var i = 0; i < encrypted.length; i++) {
            if (this._lastPrecipherIndex === 16) {
                this._lastPrecipher = this._aes.encrypt(this._lastPrecipher);
                this._lastPrecipherIndex = 0;
            }
            encrypted[i] ^= this._lastPrecipher[this._lastPrecipherIndex++];
        }

        return encrypted;
    }

    // Decryption is symetric
    ModeOfOperationOFB.prototype.decrypt = ModeOfOperationOFB.prototype.encrypt;


    /**
     *  Counter object for CTR common mode of operation
     */
    var Counter = function(initialValue) {
        if (!(this instanceof Counter)) {
            throw Error('Counter must be instanitated with `new`');
        }

        // We allow 0, but anything false-ish uses the default 1
        if (initialValue !== 0 && !initialValue) { initialValue = 1; }

        if (typeof(initialValue) === 'number') {
            this._counter = createArray(16);
            this.setValue(initialValue);

        } else {
            this.setBytes(initialValue);
        }
    }

    Counter.prototype.setValue = function(value) {
        if (typeof(value) !== 'number' || parseInt(value) != value) {
            throw new Error('invalid counter value (must be an integer)');
        }

        // We cannot safely handle numbers beyond the safe range for integers
        if (value > Number.MAX_SAFE_INTEGER) {
            throw new Error('integer value out of safe range');
        }

        for (var index = 15; index >= 0; --index) {
            this._counter[index] = value % 256;
            value = parseInt(value / 256);
        }
    }

    Counter.prototype.setBytes = function(bytes) {
        bytes = coerceArray(bytes, true);

        if (bytes.length != 16) {
            throw new Error('invalid counter bytes size (must be 16 bytes)');
        }

        this._counter = bytes;
    };

    Counter.prototype.increment = function() {
        for (var i = 15; i >= 0; i--) {
            if (this._counter[i] === 255) {
                this._counter[i] = 0;
            } else {
                this._counter[i]++;
                break;
            }
        }
    }


    /**
     *  Mode Of Operation - Counter (CTR)
     */
    var ModeOfOperationCTR = function(key, counter) {
        if (!(this instanceof ModeOfOperationCTR)) {
            throw Error('AES must be instanitated with `new`');
        }

        this.description = "Counter";
        this.name = "ctr";

        if (!(counter instanceof Counter)) {
            counter = new Counter(counter)
        }

        this._counter = counter;

        this._remainingCounter = null;
        this._remainingCounterIndex = 16;

        this._aes = new AES(key);
    }

    ModeOfOperationCTR.prototype.encrypt = function(plaintext) {
        var encrypted = coerceArray(plaintext, true);

        for (var i = 0; i < encrypted.length; i++) {
            if (this._remainingCounterIndex === 16) {
                this._remainingCounter = this._aes.encrypt(this._counter._counter);
                this._remainingCounterIndex = 0;
                this._counter.increment();
            }
            encrypted[i] ^= this._remainingCounter[this._remainingCounterIndex++];
        }

        return encrypted;
    }

    // Decryption is symetric
    ModeOfOperationCTR.prototype.decrypt = ModeOfOperationCTR.prototype.encrypt;


    ///////////////////////
    // Padding

    // See:https://tools.ietf.org/html/rfc2315
    function pkcs7pad(data) {
        data = coerceArray(data, true);
        var padder = 16 - (data.length % 16);
        var result = createArray(data.length + padder);
        copyArray(data, result);
        for (var i = data.length; i < result.length; i++) {
            result[i] = padder;
        }
        return result;
    }

    function pkcs7strip(data) {
        data = coerceArray(data, true);
        if (data.length < 16) { throw new Error('PKCS#7 invalid length'); }

        var padder = data[data.length - 1];
        if (padder > 16) { throw new Error('PKCS#7 padding byte out of range'); }

        var length = data.length - padder;
        for (var i = 0; i < padder; i++) {
            if (data[length + i] !== padder) {
                throw new Error('PKCS#7 invalid padding byte');
            }
        }

        var result = createArray(length);
        copyArray(data, result, 0, 0, length);
        return result;
    }

    ///////////////////////
    // Exporting


    // The block cipher
    var aesjs = {
        AES: AES,
        Counter: Counter,

        ModeOfOperation: {
            ecb: ModeOfOperationECB,
            cbc: ModeOfOperationCBC,
            cfb: ModeOfOperationCFB,
            ofb: ModeOfOperationOFB,
            ctr: ModeOfOperationCTR
        },

        utils: {
            hex: convertHex,
            utf8: convertUtf8
        },

        padding: {
            pkcs7: {
                pad: pkcs7pad,
                strip: pkcs7strip
            }
        },

        _arrayTest: {
            coerceArray: coerceArray,
            createArray: createArray,
            copyArray: copyArray,
        }
    };


    // node.js
    if (typeof exports !== 'undefined') {
        module.exports = aesjs

    // RequireJS/AMD
    // http://www.requirejs.org/docs/api.html
    // https://github.com/amdjs/amdjs-api/wiki/AMD
    } else if (typeof(define) === 'function' && define.amd) {
        define([], function() { return aesjs; });

    // Web Browsers
    } else {

        // If there was an existing library at "aesjs" make sure it's still available
        if (root.aesjs) {
            aesjs._aesjs = root.aesjs;
        }

        root.aesjs = aesjs;
    }


})(this);

},{}],2:[function(_dereq_,module,exports){
(function (process,global){
/*!
 * @overview es6-promise - a tiny implementation of Promises/A+.
 * @copyright Copyright (c) 2014 Yehuda Katz, Tom Dale, Stefan Penner and contributors (Conversion to ES6 API by Jake Archibald)
 * @license   Licensed under MIT license
 *            See https://raw.githubusercontent.com/stefanpenner/es6-promise/master/LICENSE
 * @version   v4.2.8+1e68dce6
 */

(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
	typeof define === 'function' && define.amd ? define(factory) :
	(global.ES6Promise = factory());
}(this, (function () { 'use strict';

function objectOrFunction(x) {
  var type = typeof x;
  return x !== null && (type === 'object' || type === 'function');
}

function isFunction(x) {
  return typeof x === 'function';
}



var _isArray = void 0;
if (Array.isArray) {
  _isArray = Array.isArray;
} else {
  _isArray = function (x) {
    return Object.prototype.toString.call(x) === '[object Array]';
  };
}

var isArray = _isArray;

var len = 0;
var vertxNext = void 0;
var customSchedulerFn = void 0;

var asap = function asap(callback, arg) {
  queue[len] = callback;
  queue[len + 1] = arg;
  len += 2;
  if (len === 2) {
    // If len is 2, that means that we need to schedule an async flush.
    // If additional callbacks are queued before the queue is flushed, they
    // will be processed by this flush that we are scheduling.
    if (customSchedulerFn) {
      customSchedulerFn(flush);
    } else {
      scheduleFlush();
    }
  }
};

function setScheduler(scheduleFn) {
  customSchedulerFn = scheduleFn;
}

function setAsap(asapFn) {
  asap = asapFn;
}

var browserWindow = typeof window !== 'undefined' ? window : undefined;
var browserGlobal = browserWindow || {};
var BrowserMutationObserver = browserGlobal.MutationObserver || browserGlobal.WebKitMutationObserver;
var isNode = typeof self === 'undefined' && typeof process !== 'undefined' && {}.toString.call(process) === '[object process]';

// test for web worker but not in IE10
var isWorker = typeof Uint8ClampedArray !== 'undefined' && typeof importScripts !== 'undefined' && typeof MessageChannel !== 'undefined';

// node
function useNextTick() {
  // node version 0.10.x displays a deprecation warning when nextTick is used recursively
  // see https://github.com/cujojs/when/issues/410 for details
  return function () {
    return process.nextTick(flush);
  };
}

// vertx
function useVertxTimer() {
  if (typeof vertxNext !== 'undefined') {
    return function () {
      vertxNext(flush);
    };
  }

  return useSetTimeout();
}

function useMutationObserver() {
  var iterations = 0;
  var observer = new BrowserMutationObserver(flush);
  var node = document.createTextNode('');
  observer.observe(node, { characterData: true });

  return function () {
    node.data = iterations = ++iterations % 2;
  };
}

// web worker
function useMessageChannel() {
  var channel = new MessageChannel();
  channel.port1.onmessage = flush;
  return function () {
    return channel.port2.postMessage(0);
  };
}

function useSetTimeout() {
  // Store setTimeout reference so es6-promise will be unaffected by
  // other code modifying setTimeout (like sinon.useFakeTimers())
  var globalSetTimeout = setTimeout;
  return function () {
    return globalSetTimeout(flush, 1);
  };
}

var queue = new Array(1000);
function flush() {
  for (var i = 0; i < len; i += 2) {
    var callback = queue[i];
    var arg = queue[i + 1];

    callback(arg);

    queue[i] = undefined;
    queue[i + 1] = undefined;
  }

  len = 0;
}

function attemptVertx() {
  try {
    var vertx = Function('return this')().require('vertx');
    vertxNext = vertx.runOnLoop || vertx.runOnContext;
    return useVertxTimer();
  } catch (e) {
    return useSetTimeout();
  }
}

var scheduleFlush = void 0;
// Decide what async method to use to triggering processing of queued callbacks:
if (isNode) {
  scheduleFlush = useNextTick();
} else if (BrowserMutationObserver) {
  scheduleFlush = useMutationObserver();
} else if (isWorker) {
  scheduleFlush = useMessageChannel();
} else if (browserWindow === undefined && typeof _dereq_ === 'function') {
  scheduleFlush = attemptVertx();
} else {
  scheduleFlush = useSetTimeout();
}

function then(onFulfillment, onRejection) {
  var parent = this;

  var child = new this.constructor(noop);

  if (child[PROMISE_ID] === undefined) {
    makePromise(child);
  }

  var _state = parent._state;


  if (_state) {
    var callback = arguments[_state - 1];
    asap(function () {
      return invokeCallback(_state, child, callback, parent._result);
    });
  } else {
    subscribe(parent, child, onFulfillment, onRejection);
  }

  return child;
}

/**
  `Promise.resolve` returns a promise that will become resolved with the
  passed `value`. It is shorthand for the following:

  ```javascript
  let promise = new Promise(function(resolve, reject){
    resolve(1);
  });

  promise.then(function(value){
    // value === 1
  });
  ```

  Instead of writing the above, your code now simply becomes the following:

  ```javascript
  let promise = Promise.resolve(1);

  promise.then(function(value){
    // value === 1
  });
  ```

  @method resolve
  @static
  @param {Any} value value that the returned promise will be resolved with
  Useful for tooling.
  @return {Promise} a promise that will become fulfilled with the given
  `value`
*/
function resolve$1(object) {
  /*jshint validthis:true */
  var Constructor = this;

  if (object && typeof object === 'object' && object.constructor === Constructor) {
    return object;
  }

  var promise = new Constructor(noop);
  resolve(promise, object);
  return promise;
}

var PROMISE_ID = Math.random().toString(36).substring(2);

function noop() {}

var PENDING = void 0;
var FULFILLED = 1;
var REJECTED = 2;

function selfFulfillment() {
  return new TypeError("You cannot resolve a promise with itself");
}

function cannotReturnOwn() {
  return new TypeError('A promises callback cannot return that same promise.');
}

function tryThen(then$$1, value, fulfillmentHandler, rejectionHandler) {
  try {
    then$$1.call(value, fulfillmentHandler, rejectionHandler);
  } catch (e) {
    return e;
  }
}

function handleForeignThenable(promise, thenable, then$$1) {
  asap(function (promise) {
    var sealed = false;
    var error = tryThen(then$$1, thenable, function (value) {
      if (sealed) {
        return;
      }
      sealed = true;
      if (thenable !== value) {
        resolve(promise, value);
      } else {
        fulfill(promise, value);
      }
    }, function (reason) {
      if (sealed) {
        return;
      }
      sealed = true;

      reject(promise, reason);
    }, 'Settle: ' + (promise._label || ' unknown promise'));

    if (!sealed && error) {
      sealed = true;
      reject(promise, error);
    }
  }, promise);
}

function handleOwnThenable(promise, thenable) {
  if (thenable._state === FULFILLED) {
    fulfill(promise, thenable._result);
  } else if (thenable._state === REJECTED) {
    reject(promise, thenable._result);
  } else {
    subscribe(thenable, undefined, function (value) {
      return resolve(promise, value);
    }, function (reason) {
      return reject(promise, reason);
    });
  }
}

function handleMaybeThenable(promise, maybeThenable, then$$1) {
  if (maybeThenable.constructor === promise.constructor && then$$1 === then && maybeThenable.constructor.resolve === resolve$1) {
    handleOwnThenable(promise, maybeThenable);
  } else {
    if (then$$1 === undefined) {
      fulfill(promise, maybeThenable);
    } else if (isFunction(then$$1)) {
      handleForeignThenable(promise, maybeThenable, then$$1);
    } else {
      fulfill(promise, maybeThenable);
    }
  }
}

function resolve(promise, value) {
  if (promise === value) {
    reject(promise, selfFulfillment());
  } else if (objectOrFunction(value)) {
    var then$$1 = void 0;
    try {
      then$$1 = value.then;
    } catch (error) {
      reject(promise, error);
      return;
    }
    handleMaybeThenable(promise, value, then$$1);
  } else {
    fulfill(promise, value);
  }
}

function publishRejection(promise) {
  if (promise._onerror) {
    promise._onerror(promise._result);
  }

  publish(promise);
}

function fulfill(promise, value) {
  if (promise._state !== PENDING) {
    return;
  }

  promise._result = value;
  promise._state = FULFILLED;

  if (promise._subscribers.length !== 0) {
    asap(publish, promise);
  }
}

function reject(promise, reason) {
  if (promise._state !== PENDING) {
    return;
  }
  promise._state = REJECTED;
  promise._result = reason;

  asap(publishRejection, promise);
}

function subscribe(parent, child, onFulfillment, onRejection) {
  var _subscribers = parent._subscribers;
  var length = _subscribers.length;


  parent._onerror = null;

  _subscribers[length] = child;
  _subscribers[length + FULFILLED] = onFulfillment;
  _subscribers[length + REJECTED] = onRejection;

  if (length === 0 && parent._state) {
    asap(publish, parent);
  }
}

function publish(promise) {
  var subscribers = promise._subscribers;
  var settled = promise._state;

  if (subscribers.length === 0) {
    return;
  }

  var child = void 0,
      callback = void 0,
      detail = promise._result;

  for (var i = 0; i < subscribers.length; i += 3) {
    child = subscribers[i];
    callback = subscribers[i + settled];

    if (child) {
      invokeCallback(settled, child, callback, detail);
    } else {
      callback(detail);
    }
  }

  promise._subscribers.length = 0;
}

function invokeCallback(settled, promise, callback, detail) {
  var hasCallback = isFunction(callback),
      value = void 0,
      error = void 0,
      succeeded = true;

  if (hasCallback) {
    try {
      value = callback(detail);
    } catch (e) {
      succeeded = false;
      error = e;
    }

    if (promise === value) {
      reject(promise, cannotReturnOwn());
      return;
    }
  } else {
    value = detail;
  }

  if (promise._state !== PENDING) {
    // noop
  } else if (hasCallback && succeeded) {
    resolve(promise, value);
  } else if (succeeded === false) {
    reject(promise, error);
  } else if (settled === FULFILLED) {
    fulfill(promise, value);
  } else if (settled === REJECTED) {
    reject(promise, value);
  }
}

function initializePromise(promise, resolver) {
  try {
    resolver(function resolvePromise(value) {
      resolve(promise, value);
    }, function rejectPromise(reason) {
      reject(promise, reason);
    });
  } catch (e) {
    reject(promise, e);
  }
}

var id = 0;
function nextId() {
  return id++;
}

function makePromise(promise) {
  promise[PROMISE_ID] = id++;
  promise._state = undefined;
  promise._result = undefined;
  promise._subscribers = [];
}

function validationError() {
  return new Error('Array Methods must be provided an Array');
}

var Enumerator = function () {
  function Enumerator(Constructor, input) {
    this._instanceConstructor = Constructor;
    this.promise = new Constructor(noop);

    if (!this.promise[PROMISE_ID]) {
      makePromise(this.promise);
    }

    if (isArray(input)) {
      this.length = input.length;
      this._remaining = input.length;

      this._result = new Array(this.length);

      if (this.length === 0) {
        fulfill(this.promise, this._result);
      } else {
        this.length = this.length || 0;
        this._enumerate(input);
        if (this._remaining === 0) {
          fulfill(this.promise, this._result);
        }
      }
    } else {
      reject(this.promise, validationError());
    }
  }

  Enumerator.prototype._enumerate = function _enumerate(input) {
    for (var i = 0; this._state === PENDING && i < input.length; i++) {
      this._eachEntry(input[i], i);
    }
  };

  Enumerator.prototype._eachEntry = function _eachEntry(entry, i) {
    var c = this._instanceConstructor;
    var resolve$$1 = c.resolve;


    if (resolve$$1 === resolve$1) {
      var _then = void 0;
      var error = void 0;
      var didError = false;
      try {
        _then = entry.then;
      } catch (e) {
        didError = true;
        error = e;
      }

      if (_then === then && entry._state !== PENDING) {
        this._settledAt(entry._state, i, entry._result);
      } else if (typeof _then !== 'function') {
        this._remaining--;
        this._result[i] = entry;
      } else if (c === Promise$1) {
        var promise = new c(noop);
        if (didError) {
          reject(promise, error);
        } else {
          handleMaybeThenable(promise, entry, _then);
        }
        this._willSettleAt(promise, i);
      } else {
        this._willSettleAt(new c(function (resolve$$1) {
          return resolve$$1(entry);
        }), i);
      }
    } else {
      this._willSettleAt(resolve$$1(entry), i);
    }
  };

  Enumerator.prototype._settledAt = function _settledAt(state, i, value) {
    var promise = this.promise;


    if (promise._state === PENDING) {
      this._remaining--;

      if (state === REJECTED) {
        reject(promise, value);
      } else {
        this._result[i] = value;
      }
    }

    if (this._remaining === 0) {
      fulfill(promise, this._result);
    }
  };

  Enumerator.prototype._willSettleAt = function _willSettleAt(promise, i) {
    var enumerator = this;

    subscribe(promise, undefined, function (value) {
      return enumerator._settledAt(FULFILLED, i, value);
    }, function (reason) {
      return enumerator._settledAt(REJECTED, i, reason);
    });
  };

  return Enumerator;
}();

/**
  `Promise.all` accepts an array of promises, and returns a new promise which
  is fulfilled with an array of fulfillment values for the passed promises, or
  rejected with the reason of the first passed promise to be rejected. It casts all
  elements of the passed iterable to promises as it runs this algorithm.

  Example:

  ```javascript
  let promise1 = resolve(1);
  let promise2 = resolve(2);
  let promise3 = resolve(3);
  let promises = [ promise1, promise2, promise3 ];

  Promise.all(promises).then(function(array){
    // The array here would be [ 1, 2, 3 ];
  });
  ```

  If any of the `promises` given to `all` are rejected, the first promise
  that is rejected will be given as an argument to the returned promises's
  rejection handler. For example:

  Example:

  ```javascript
  let promise1 = resolve(1);
  let promise2 = reject(new Error("2"));
  let promise3 = reject(new Error("3"));
  let promises = [ promise1, promise2, promise3 ];

  Promise.all(promises).then(function(array){
    // Code here never runs because there are rejected promises!
  }, function(error) {
    // error.message === "2"
  });
  ```

  @method all
  @static
  @param {Array} entries array of promises
  @param {String} label optional string for labeling the promise.
  Useful for tooling.
  @return {Promise} promise that is fulfilled when all `promises` have been
  fulfilled, or rejected if any of them become rejected.
  @static
*/
function all(entries) {
  return new Enumerator(this, entries).promise;
}

/**
  `Promise.race` returns a new promise which is settled in the same way as the
  first passed promise to settle.

  Example:

  ```javascript
  let promise1 = new Promise(function(resolve, reject){
    setTimeout(function(){
      resolve('promise 1');
    }, 200);
  });

  let promise2 = new Promise(function(resolve, reject){
    setTimeout(function(){
      resolve('promise 2');
    }, 100);
  });

  Promise.race([promise1, promise2]).then(function(result){
    // result === 'promise 2' because it was resolved before promise1
    // was resolved.
  });
  ```

  `Promise.race` is deterministic in that only the state of the first
  settled promise matters. For example, even if other promises given to the
  `promises` array argument are resolved, but the first settled promise has
  become rejected before the other promises became fulfilled, the returned
  promise will become rejected:

  ```javascript
  let promise1 = new Promise(function(resolve, reject){
    setTimeout(function(){
      resolve('promise 1');
    }, 200);
  });

  let promise2 = new Promise(function(resolve, reject){
    setTimeout(function(){
      reject(new Error('promise 2'));
    }, 100);
  });

  Promise.race([promise1, promise2]).then(function(result){
    // Code here never runs
  }, function(reason){
    // reason.message === 'promise 2' because promise 2 became rejected before
    // promise 1 became fulfilled
  });
  ```

  An example real-world use case is implementing timeouts:

  ```javascript
  Promise.race([ajax('foo.json'), timeout(5000)])
  ```

  @method race
  @static
  @param {Array} promises array of promises to observe
  Useful for tooling.
  @return {Promise} a promise which settles in the same way as the first passed
  promise to settle.
*/
function race(entries) {
  /*jshint validthis:true */
  var Constructor = this;

  if (!isArray(entries)) {
    return new Constructor(function (_, reject) {
      return reject(new TypeError('You must pass an array to race.'));
    });
  } else {
    return new Constructor(function (resolve, reject) {
      var length = entries.length;
      for (var i = 0; i < length; i++) {
        Constructor.resolve(entries[i]).then(resolve, reject);
      }
    });
  }
}

/**
  `Promise.reject` returns a promise rejected with the passed `reason`.
  It is shorthand for the following:

  ```javascript
  let promise = new Promise(function(resolve, reject){
    reject(new Error('WHOOPS'));
  });

  promise.then(function(value){
    // Code here doesn't run because the promise is rejected!
  }, function(reason){
    // reason.message === 'WHOOPS'
  });
  ```

  Instead of writing the above, your code now simply becomes the following:

  ```javascript
  let promise = Promise.reject(new Error('WHOOPS'));

  promise.then(function(value){
    // Code here doesn't run because the promise is rejected!
  }, function(reason){
    // reason.message === 'WHOOPS'
  });
  ```

  @method reject
  @static
  @param {Any} reason value that the returned promise will be rejected with.
  Useful for tooling.
  @return {Promise} a promise rejected with the given `reason`.
*/
function reject$1(reason) {
  /*jshint validthis:true */
  var Constructor = this;
  var promise = new Constructor(noop);
  reject(promise, reason);
  return promise;
}

function needsResolver() {
  throw new TypeError('You must pass a resolver function as the first argument to the promise constructor');
}

function needsNew() {
  throw new TypeError("Failed to construct 'Promise': Please use the 'new' operator, this object constructor cannot be called as a function.");
}

/**
  Promise objects represent the eventual result of an asynchronous operation. The
  primary way of interacting with a promise is through its `then` method, which
  registers callbacks to receive either a promise's eventual value or the reason
  why the promise cannot be fulfilled.

  Terminology
  -----------

  - `promise` is an object or function with a `then` method whose behavior conforms to this specification.
  - `thenable` is an object or function that defines a `then` method.
  - `value` is any legal JavaScript value (including undefined, a thenable, or a promise).
  - `exception` is a value that is thrown using the throw statement.
  - `reason` is a value that indicates why a promise was rejected.
  - `settled` the final resting state of a promise, fulfilled or rejected.

  A promise can be in one of three states: pending, fulfilled, or rejected.

  Promises that are fulfilled have a fulfillment value and are in the fulfilled
  state.  Promises that are rejected have a rejection reason and are in the
  rejected state.  A fulfillment value is never a thenable.

  Promises can also be said to *resolve* a value.  If this value is also a
  promise, then the original promise's settled state will match the value's
  settled state.  So a promise that *resolves* a promise that rejects will
  itself reject, and a promise that *resolves* a promise that fulfills will
  itself fulfill.


  Basic Usage:
  ------------

  ```js
  let promise = new Promise(function(resolve, reject) {
    // on success
    resolve(value);

    // on failure
    reject(reason);
  });

  promise.then(function(value) {
    // on fulfillment
  }, function(reason) {
    // on rejection
  });
  ```

  Advanced Usage:
  ---------------

  Promises shine when abstracting away asynchronous interactions such as
  `XMLHttpRequest`s.

  ```js
  function getJSON(url) {
    return new Promise(function(resolve, reject){
      let xhr = new XMLHttpRequest();

      xhr.open('GET', url);
      xhr.onreadystatechange = handler;
      xhr.responseType = 'json';
      xhr.setRequestHeader('Accept', 'application/json');
      xhr.send();

      function handler() {
        if (this.readyState === this.DONE) {
          if (this.status === 200) {
            resolve(this.response);
          } else {
            reject(new Error('getJSON: `' + url + '` failed with status: [' + this.status + ']'));
          }
        }
      };
    });
  }

  getJSON('/posts.json').then(function(json) {
    // on fulfillment
  }, function(reason) {
    // on rejection
  });
  ```

  Unlike callbacks, promises are great composable primitives.

  ```js
  Promise.all([
    getJSON('/posts'),
    getJSON('/comments')
  ]).then(function(values){
    values[0] // => postsJSON
    values[1] // => commentsJSON

    return values;
  });
  ```

  @class Promise
  @param {Function} resolver
  Useful for tooling.
  @constructor
*/

var Promise$1 = function () {
  function Promise(resolver) {
    this[PROMISE_ID] = nextId();
    this._result = this._state = undefined;
    this._subscribers = [];

    if (noop !== resolver) {
      typeof resolver !== 'function' && needsResolver();
      this instanceof Promise ? initializePromise(this, resolver) : needsNew();
    }
  }

  /**
  The primary way of interacting with a promise is through its `then` method,
  which registers callbacks to receive either a promise's eventual value or the
  reason why the promise cannot be fulfilled.
   ```js
  findUser().then(function(user){
    // user is available
  }, function(reason){
    // user is unavailable, and you are given the reason why
  });
  ```
   Chaining
  --------
   The return value of `then` is itself a promise.  This second, 'downstream'
  promise is resolved with the return value of the first promise's fulfillment
  or rejection handler, or rejected if the handler throws an exception.
   ```js
  findUser().then(function (user) {
    return user.name;
  }, function (reason) {
    return 'default name';
  }).then(function (userName) {
    // If `findUser` fulfilled, `userName` will be the user's name, otherwise it
    // will be `'default name'`
  });
   findUser().then(function (user) {
    throw new Error('Found user, but still unhappy');
  }, function (reason) {
    throw new Error('`findUser` rejected and we're unhappy');
  }).then(function (value) {
    // never reached
  }, function (reason) {
    // if `findUser` fulfilled, `reason` will be 'Found user, but still unhappy'.
    // If `findUser` rejected, `reason` will be '`findUser` rejected and we're unhappy'.
  });
  ```
  If the downstream promise does not specify a rejection handler, rejection reasons will be propagated further downstream.
   ```js
  findUser().then(function (user) {
    throw new PedagogicalException('Upstream error');
  }).then(function (value) {
    // never reached
  }).then(function (value) {
    // never reached
  }, function (reason) {
    // The `PedgagocialException` is propagated all the way down to here
  });
  ```
   Assimilation
  ------------
   Sometimes the value you want to propagate to a downstream promise can only be
  retrieved asynchronously. This can be achieved by returning a promise in the
  fulfillment or rejection handler. The downstream promise will then be pending
  until the returned promise is settled. This is called *assimilation*.
   ```js
  findUser().then(function (user) {
    return findCommentsByAuthor(user);
  }).then(function (comments) {
    // The user's comments are now available
  });
  ```
   If the assimliated promise rejects, then the downstream promise will also reject.
   ```js
  findUser().then(function (user) {
    return findCommentsByAuthor(user);
  }).then(function (comments) {
    // If `findCommentsByAuthor` fulfills, we'll have the value here
  }, function (reason) {
    // If `findCommentsByAuthor` rejects, we'll have the reason here
  });
  ```
   Simple Example
  --------------
   Synchronous Example
   ```javascript
  let result;
   try {
    result = findResult();
    // success
  } catch(reason) {
    // failure
  }
  ```
   Errback Example
   ```js
  findResult(function(result, err){
    if (err) {
      // failure
    } else {
      // success
    }
  });
  ```
   Promise Example;
   ```javascript
  findResult().then(function(result){
    // success
  }, function(reason){
    // failure
  });
  ```
   Advanced Example
  --------------
   Synchronous Example
   ```javascript
  let author, books;
   try {
    author = findAuthor();
    books  = findBooksByAuthor(author);
    // success
  } catch(reason) {
    // failure
  }
  ```
   Errback Example
   ```js
   function foundBooks(books) {
   }
   function failure(reason) {
   }
   findAuthor(function(author, err){
    if (err) {
      failure(err);
      // failure
    } else {
      try {
        findBoooksByAuthor(author, function(books, err) {
          if (err) {
            failure(err);
          } else {
            try {
              foundBooks(books);
            } catch(reason) {
              failure(reason);
            }
          }
        });
      } catch(error) {
        failure(err);
      }
      // success
    }
  });
  ```
   Promise Example;
   ```javascript
  findAuthor().
    then(findBooksByAuthor).
    then(function(books){
      // found books
  }).catch(function(reason){
    // something went wrong
  });
  ```
   @method then
  @param {Function} onFulfilled
  @param {Function} onRejected
  Useful for tooling.
  @return {Promise}
  */

  /**
  `catch` is simply sugar for `then(undefined, onRejection)` which makes it the same
  as the catch block of a try/catch statement.
  ```js
  function findAuthor(){
  throw new Error('couldn't find that author');
  }
  // synchronous
  try {
  findAuthor();
  } catch(reason) {
  // something went wrong
  }
  // async with promises
  findAuthor().catch(function(reason){
  // something went wrong
  });
  ```
  @method catch
  @param {Function} onRejection
  Useful for tooling.
  @return {Promise}
  */


  Promise.prototype.catch = function _catch(onRejection) {
    return this.then(null, onRejection);
  };

  /**
    `finally` will be invoked regardless of the promise's fate just as native
    try/catch/finally behaves
  
    Synchronous example:
  
    ```js
    findAuthor() {
      if (Math.random() > 0.5) {
        throw new Error();
      }
      return new Author();
    }
  
    try {
      return findAuthor(); // succeed or fail
    } catch(error) {
      return findOtherAuther();
    } finally {
      // always runs
      // doesn't affect the return value
    }
    ```
  
    Asynchronous example:
  
    ```js
    findAuthor().catch(function(reason){
      return findOtherAuther();
    }).finally(function(){
      // author was either found, or not
    });
    ```
  
    @method finally
    @param {Function} callback
    @return {Promise}
  */


  Promise.prototype.finally = function _finally(callback) {
    var promise = this;
    var constructor = promise.constructor;

    if (isFunction(callback)) {
      return promise.then(function (value) {
        return constructor.resolve(callback()).then(function () {
          return value;
        });
      }, function (reason) {
        return constructor.resolve(callback()).then(function () {
          throw reason;
        });
      });
    }

    return promise.then(callback, callback);
  };

  return Promise;
}();

Promise$1.prototype.then = then;
Promise$1.all = all;
Promise$1.race = race;
Promise$1.resolve = resolve$1;
Promise$1.reject = reject$1;
Promise$1._setScheduler = setScheduler;
Promise$1._setAsap = setAsap;
Promise$1._asap = asap;

/*global self*/
function polyfill() {
  var local = void 0;

  if (typeof global !== 'undefined') {
    local = global;
  } else if (typeof self !== 'undefined') {
    local = self;
  } else {
    try {
      local = Function('return this')();
    } catch (e) {
      throw new Error('polyfill failed because global object is unavailable in this environment');
    }
  }

  var P = local.Promise;

  if (P) {
    var promiseToString = null;
    try {
      promiseToString = Object.prototype.toString.call(P.resolve());
    } catch (e) {
      // silently ignored
    }

    if (promiseToString === '[object Promise]' && !P.cast) {
      return;
    }
  }

  local.Promise = Promise$1;
}

// Strange compat..
Promise$1.polyfill = polyfill;
Promise$1.Promise = Promise$1;

return Promise$1;

})));





}).call(this,_dereq_('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"_process":4}],3:[function(_dereq_,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      } else {
        // At least give some kind of context to the user
        var err = new Error('Uncaught, unspecified "error" event. (' + er + ')');
        err.context = er;
        throw err;
      }
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        args = Array.prototype.slice.call(arguments, 1);
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    args = Array.prototype.slice.call(arguments, 1);
    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else if (listeners) {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.prototype.listenerCount = function(type) {
  if (this._events) {
    var evlistener = this._events[type];

    if (isFunction(evlistener))
      return 1;
    else if (evlistener)
      return evlistener.length;
  }
  return 0;
};

EventEmitter.listenerCount = function(emitter, type) {
  return emitter.listenerCount(type);
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],4:[function(_dereq_,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],5:[function(_dereq_,module,exports){
var bundleFn = arguments[3];
var sources = arguments[4];
var cache = arguments[5];

var stringify = JSON.stringify;

module.exports = function (fn, options) {
    var wkey;
    var cacheKeys = Object.keys(cache);

    for (var i = 0, l = cacheKeys.length; i < l; i++) {
        var key = cacheKeys[i];
        var exp = cache[key].exports;
        // Using babel as a transpiler to use esmodule, the export will always
        // be an object with the default export as a property of it. To ensure
        // the existing api and babel esmodule exports are both supported we
        // check for both
        if (exp === fn || exp && exp.default === fn) {
            wkey = key;
            break;
        }
    }

    if (!wkey) {
        wkey = Math.floor(Math.pow(16, 8) * Math.random()).toString(16);
        var wcache = {};
        for (var i = 0, l = cacheKeys.length; i < l; i++) {
            var key = cacheKeys[i];
            wcache[key] = key;
        }
        sources[wkey] = [
            'function(require,module,exports){' + fn + '(self); }',
            wcache
        ];
    }
    var skey = Math.floor(Math.pow(16, 8) * Math.random()).toString(16);

    var scache = {}; scache[wkey] = wkey;
    sources[skey] = [
        'function(require,module,exports){' +
            // try to call default if defined to also support babel esmodule exports
            'var f = require(' + stringify(wkey) + ');' +
            '(f.default ? f.default : f)(self);' +
        '}',
        scache
    ];

    var workerSources = {};
    resolveSources(skey);

    function resolveSources(key) {
        workerSources[key] = true;

        for (var depPath in sources[key][1]) {
            var depKey = sources[key][1][depPath];
            if (!workerSources[depKey]) {
                resolveSources(depKey);
            }
        }
    }

    var src = '(' + bundleFn + ')({'
        + Object.keys(workerSources).map(function (key) {
            return stringify(key) + ':['
                + sources[key][0]
                + ',' + stringify(sources[key][1]) + ']'
            ;
        }).join(',')
        + '},{},[' + stringify(skey) + '])'
    ;

    var URL = window.URL || window.webkitURL || window.mozURL || window.msURL;

    var blob = new Blob([src], { type: 'text/javascript' });
    if (options && options.bare) { return blob; }
    var workerUrl = URL.createObjectURL(blob);
    var worker = new Worker(workerUrl);
    worker.objectURL = workerUrl;
    return worker;
};

},{}],6:[function(_dereq_,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.createDefaultConfig = createDefaultConfig;
/*
 * Copyright (C) 2016 Bilibili. All Rights Reserved.
 *
 * @author zheng qian <xqq@xqq.im>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var defaultConfig = exports.defaultConfig = {
    enableWorker: false,
    enableStashBuffer: true,
    stashInitialSize: undefined,

    isLive: false,

    lazyLoad: true,
    lazyLoadMaxDuration: 3 * 60,
    lazyLoadRecoverDuration: 30,
    deferLoadAfterSourceOpen: true,

    // autoCleanupSourceBuffer: default as false, leave unspecified
    autoCleanupMaxBackwardDuration: 3 * 60,
    autoCleanupMinBackwardDuration: 2 * 60,

    statisticsInfoReportInterval: 600,

    fixAudioTimestampGap: true,

    accurateSeek: false,
    seekType: 'range', // [range, param, custom]
    seekParamStart: 'bstart',
    seekParamEnd: 'bend',
    rangeLoadZeroStart: false,
    customSeekHandler: undefined,
    reuseRedirectedURL: false,
    // referrerPolicy: leave as unspecified

    customLoader: undefined
};

function createDefaultConfig() {
    return Object.assign({}, defaultConfig);
}

},{}],7:[function(_dereq_,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); /*
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * Copyright (C) 2016 Bilibili. All Rights Reserved.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * @author zheng qian <xqq@xqq.im>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * Licensed under the Apache License, Version 2.0 (the "License");
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * you may not use this file except in compliance with the License.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * You may obtain a copy of the License at
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *     http://www.apache.org/licenses/LICENSE-2.0
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * Unless required by applicable law or agreed to in writing, software
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * distributed under the License is distributed on an "AS IS" BASIS,
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * See the License for the specific language governing permissions and
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * limitations under the License.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      */

var _ioController = _dereq_('../io/io-controller.js');

var _ioController2 = _interopRequireDefault(_ioController);

var _config = _dereq_('../config.js');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Features = function () {
    function Features() {
        _classCallCheck(this, Features);
    }

    _createClass(Features, null, [{
        key: 'supportMSEH264Playback',
        value: function supportMSEH264Playback() {
            return window.MediaSource && window.MediaSource.isTypeSupported('video/mp4; codecs="avc1.42E01E,mp4a.40.2"');
        }
    }, {
        key: 'supportNetworkStreamIO',
        value: function supportNetworkStreamIO() {
            var ioctl = new _ioController2.default({}, (0, _config.createDefaultConfig)());
            var loaderType = ioctl.loaderType;
            ioctl.destroy();
            return loaderType == 'fetch-stream-loader' || loaderType == 'xhr-moz-chunked-loader';
        }
    }, {
        key: 'getNetworkLoaderTypeName',
        value: function getNetworkLoaderTypeName() {
            var ioctl = new _ioController2.default({}, (0, _config.createDefaultConfig)());
            var loaderType = ioctl.loaderType;
            ioctl.destroy();
            return loaderType;
        }
    }, {
        key: 'supportNativeMediaPlayback',
        value: function supportNativeMediaPlayback(mimeType) {
            if (Features.videoElement == undefined) {
                Features.videoElement = window.document.createElement('video');
            }
            var canPlay = Features.videoElement.canPlayType(mimeType);
            return canPlay === 'probably' || canPlay == 'maybe';
        }
    }, {
        key: 'getFeatureList',
        value: function getFeatureList() {
            var features = {
                mseFlvPlayback: false,
                mseLiveFlvPlayback: false,
                networkStreamIO: false,
                networkLoaderName: '',
                nativeMP4H264Playback: false,
                nativeWebmVP8Playback: false,
                nativeWebmVP9Playback: false
            };

            features.mseFlvPlayback = Features.supportMSEH264Playback();
            features.networkStreamIO = Features.supportNetworkStreamIO();
            features.networkLoaderName = Features.getNetworkLoaderTypeName();
            features.mseLiveFlvPlayback = features.mseFlvPlayback && features.networkStreamIO;
            features.nativeMP4H264Playback = Features.supportNativeMediaPlayback('video/mp4; codecs="avc1.42001E, mp4a.40.2"');
            features.nativeWebmVP8Playback = Features.supportNativeMediaPlayback('video/webm; codecs="vp8.0, vorbis"');
            features.nativeWebmVP9Playback = Features.supportNativeMediaPlayback('video/webm; codecs="vp9"');

            return features;
        }
    }]);

    return Features;
}();

exports.default = Features;

},{"../config.js":6,"../io/io-controller.js":24}],8:[function(_dereq_,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/*
 * Copyright (C) 2016 Bilibili. All Rights Reserved.
 *
 * @author zheng qian <xqq@xqq.im>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var MediaInfo = function () {
    function MediaInfo() {
        _classCallCheck(this, MediaInfo);

        this.mimeType = null;
        this.duration = null;

        this.hasAudio = null;
        this.hasVideo = null;
        this.audioCodec = null;
        this.videoCodec = null;
        this.audioDataRate = null;
        this.videoDataRate = null;

        this.audioSampleRate = null;
        this.audioChannelCount = null;

        this.width = null;
        this.height = null;
        this.fps = null;
        this.profile = null;
        this.level = null;
        this.refFrames = null;
        this.chromaFormat = null;
        this.sarNum = null;
        this.sarDen = null;

        this.metadata = null;
        this.segments = null; // MediaInfo[]
        this.segmentCount = null;
        this.hasKeyframesIndex = null;
        this.keyframesIndex = null;
    }

    _createClass(MediaInfo, [{
        key: "isComplete",
        value: function isComplete() {
            var audioInfoComplete = this.hasAudio === false || this.hasAudio === true && this.audioCodec != null && this.audioSampleRate != null && this.audioChannelCount != null;

            var videoInfoComplete = this.hasVideo === false || this.hasVideo === true && this.videoCodec != null && this.width != null && this.height != null && this.fps != null && this.profile != null && this.level != null && this.refFrames != null && this.chromaFormat != null && this.sarNum != null && this.sarDen != null;

            // keyframesIndex may not be present
            return this.mimeType != null && this.duration != null && this.metadata != null && this.hasKeyframesIndex != null && audioInfoComplete && videoInfoComplete;
        }
    }, {
        key: "isSeekable",
        value: function isSeekable() {
            return this.hasKeyframesIndex === true;
        }
    }, {
        key: "getNearestKeyframe",
        value: function getNearestKeyframe(milliseconds) {
            if (this.keyframesIndex == null) {
                return null;
            }

            var table = this.keyframesIndex;
            var keyframeIdx = this._search(table.times, milliseconds);

            return {
                index: keyframeIdx,
                milliseconds: table.times[keyframeIdx],
                fileposition: table.filepositions[keyframeIdx]
            };
        }
    }, {
        key: "_search",
        value: function _search(list, value) {
            var idx = 0;

            var last = list.length - 1;
            var mid = 0;
            var lbound = 0;
            var ubound = last;

            if (value < list[0]) {
                idx = 0;
                lbound = ubound + 1; // skip search
            }

            while (lbound <= ubound) {
                mid = lbound + Math.floor((ubound - lbound) / 2);
                if (mid === last || value >= list[mid] && value < list[mid + 1]) {
                    idx = mid;
                    break;
                } else if (list[mid] < value) {
                    lbound = mid + 1;
                } else {
                    ubound = mid - 1;
                }
            }

            return idx;
        }
    }]);

    return MediaInfo;
}();

exports.default = MediaInfo;

},{}],9:[function(_dereq_,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/*
 * Copyright (C) 2016 Bilibili. All Rights Reserved.
 *
 * @author zheng qian <xqq@xqq.im>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// Represents an media sample (audio / video)
var SampleInfo = exports.SampleInfo = function SampleInfo(dts, pts, duration, originalDts, isSync) {
    _classCallCheck(this, SampleInfo);

    this.dts = dts;
    this.pts = pts;
    this.duration = duration;
    this.originalDts = originalDts;
    this.isSyncPoint = isSync;
    this.fileposition = null;
};

// Media Segment concept is defined in Media Source Extensions spec.
// Particularly in ISO BMFF format, an Media Segment contains a moof box followed by a mdat box.


var MediaSegmentInfo = exports.MediaSegmentInfo = function () {
    function MediaSegmentInfo() {
        _classCallCheck(this, MediaSegmentInfo);

        this.beginDts = 0;
        this.endDts = 0;
        this.beginPts = 0;
        this.endPts = 0;
        this.originalBeginDts = 0;
        this.originalEndDts = 0;
        this.syncPoints = []; // SampleInfo[n], for video IDR frames only
        this.firstSample = null; // SampleInfo
        this.lastSample = null; // SampleInfo
    }

    _createClass(MediaSegmentInfo, [{
        key: "appendSyncPoint",
        value: function appendSyncPoint(sampleInfo) {
            // also called Random Access Point
            sampleInfo.isSyncPoint = true;
            this.syncPoints.push(sampleInfo);
        }
    }]);

    return MediaSegmentInfo;
}();

// Ordered list for recording video IDR frames, sorted by originalDts


var IDRSampleList = exports.IDRSampleList = function () {
    function IDRSampleList() {
        _classCallCheck(this, IDRSampleList);

        this._list = [];
    }

    _createClass(IDRSampleList, [{
        key: "clear",
        value: function clear() {
            this._list = [];
        }
    }, {
        key: "appendArray",
        value: function appendArray(syncPoints) {
            var list = this._list;

            if (syncPoints.length === 0) {
                return;
            }

            if (list.length > 0 && syncPoints[0].originalDts < list[list.length - 1].originalDts) {
                this.clear();
            }

            Array.prototype.push.apply(list, syncPoints);
        }
    }, {
        key: "getLastSyncPointBeforeDts",
        value: function getLastSyncPointBeforeDts(dts) {
            if (this._list.length == 0) {
                return null;
            }

            var list = this._list;
            var idx = 0;
            var last = list.length - 1;
            var mid = 0;
            var lbound = 0;
            var ubound = last;

            if (dts < list[0].dts) {
                idx = 0;
                lbound = ubound + 1;
            }

            while (lbound <= ubound) {
                mid = lbound + Math.floor((ubound - lbound) / 2);
                if (mid === last || dts >= list[mid].dts && dts < list[mid + 1].dts) {
                    idx = mid;
                    break;
                } else if (list[mid].dts < dts) {
                    lbound = mid + 1;
                } else {
                    ubound = mid - 1;
                }
            }
            return this._list[idx];
        }
    }]);

    return IDRSampleList;
}();

// Data structure for recording information of media segments in single track.


var MediaSegmentInfoList = exports.MediaSegmentInfoList = function () {
    function MediaSegmentInfoList(type) {
        _classCallCheck(this, MediaSegmentInfoList);

        this._type = type;
        this._list = [];
        this._lastAppendLocation = -1; // cached last insert location
    }

    _createClass(MediaSegmentInfoList, [{
        key: "isEmpty",
        value: function isEmpty() {
            return this._list.length === 0;
        }
    }, {
        key: "clear",
        value: function clear() {
            this._list = [];
            this._lastAppendLocation = -1;
        }
    }, {
        key: "_searchNearestSegmentBefore",
        value: function _searchNearestSegmentBefore(originalBeginDts) {
            var list = this._list;
            if (list.length === 0) {
                return -2;
            }
            var last = list.length - 1;
            var mid = 0;
            var lbound = 0;
            var ubound = last;

            var idx = 0;

            if (originalBeginDts < list[0].originalBeginDts) {
                idx = -1;
                return idx;
            }

            while (lbound <= ubound) {
                mid = lbound + Math.floor((ubound - lbound) / 2);
                if (mid === last || originalBeginDts > list[mid].lastSample.originalDts && originalBeginDts < list[mid + 1].originalBeginDts) {
                    idx = mid;
                    break;
                } else if (list[mid].originalBeginDts < originalBeginDts) {
                    lbound = mid + 1;
                } else {
                    ubound = mid - 1;
                }
            }
            return idx;
        }
    }, {
        key: "_searchNearestSegmentAfter",
        value: function _searchNearestSegmentAfter(originalBeginDts) {
            return this._searchNearestSegmentBefore(originalBeginDts) + 1;
        }
    }, {
        key: "append",
        value: function append(mediaSegmentInfo) {
            var list = this._list;
            var msi = mediaSegmentInfo;
            var lastAppendIdx = this._lastAppendLocation;
            var insertIdx = 0;

            if (lastAppendIdx !== -1 && lastAppendIdx < list.length && msi.originalBeginDts >= list[lastAppendIdx].lastSample.originalDts && (lastAppendIdx === list.length - 1 || lastAppendIdx < list.length - 1 && msi.originalBeginDts < list[lastAppendIdx + 1].originalBeginDts)) {
                insertIdx = lastAppendIdx + 1; // use cached location idx
            } else {
                if (list.length > 0) {
                    insertIdx = this._searchNearestSegmentBefore(msi.originalBeginDts) + 1;
                }
            }

            this._lastAppendLocation = insertIdx;
            this._list.splice(insertIdx, 0, msi);
        }
    }, {
        key: "getLastSegmentBefore",
        value: function getLastSegmentBefore(originalBeginDts) {
            var idx = this._searchNearestSegmentBefore(originalBeginDts);
            if (idx >= 0) {
                return this._list[idx];
            } else {
                // -1
                return null;
            }
        }
    }, {
        key: "getLastSampleBefore",
        value: function getLastSampleBefore(originalBeginDts) {
            var segment = this.getLastSegmentBefore(originalBeginDts);
            if (segment != null) {
                return segment.lastSample;
            } else {
                return null;
            }
        }
    }, {
        key: "getLastSyncPointBefore",
        value: function getLastSyncPointBefore(originalBeginDts) {
            var segmentIdx = this._searchNearestSegmentBefore(originalBeginDts);
            var syncPoints = this._list[segmentIdx].syncPoints;
            while (syncPoints.length === 0 && segmentIdx > 0) {
                segmentIdx--;
                syncPoints = this._list[segmentIdx].syncPoints;
            }
            if (syncPoints.length > 0) {
                return syncPoints[syncPoints.length - 1];
            } else {
                return null;
            }
        }
    }, {
        key: "type",
        get: function get() {
            return this._type;
        }
    }, {
        key: "length",
        get: function get() {
            return this._list.length;
        }
    }]);

    return MediaSegmentInfoList;
}();

},{}],10:[function(_dereq_,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); /*
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * Copyright (C) 2016 Bilibili. All Rights Reserved.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * @author zheng qian <xqq@xqq.im>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * Licensed under the Apache License, Version 2.0 (the "License");
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * you may not use this file except in compliance with the License.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * You may obtain a copy of the License at
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *     http://www.apache.org/licenses/LICENSE-2.0
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * Unless required by applicable law or agreed to in writing, software
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * distributed under the License is distributed on an "AS IS" BASIS,
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * See the License for the specific language governing permissions and
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * limitations under the License.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      */

var _events = _dereq_('events');

var _events2 = _interopRequireDefault(_events);

var _logger = _dereq_('../utils/logger.js');

var _logger2 = _interopRequireDefault(_logger);

var _browser = _dereq_('../utils/browser.js');

var _browser2 = _interopRequireDefault(_browser);

var _mseEvents = _dereq_('./mse-events.js');

var _mseEvents2 = _interopRequireDefault(_mseEvents);

var _mediaSegmentInfo = _dereq_('./media-segment-info.js');

var _exception = _dereq_('../utils/exception.js');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

// Media Source Extensions controller
var MSEController = function () {
    function MSEController(config) {
        _classCallCheck(this, MSEController);

        this.TAG = 'MSEController';

        this._config = config;
        this._emitter = new _events2.default();

        if (this._config.isLive && this._config.autoCleanupSourceBuffer == undefined) {
            // For live stream, do auto cleanup by default
            this._config.autoCleanupSourceBuffer = true;
        }

        this.e = {
            onSourceOpen: this._onSourceOpen.bind(this),
            onSourceEnded: this._onSourceEnded.bind(this),
            onSourceClose: this._onSourceClose.bind(this),
            onSourceBufferError: this._onSourceBufferError.bind(this),
            onSourceBufferUpdateEnd: this._onSourceBufferUpdateEnd.bind(this)
        };

        this._mediaSource = null;
        this._mediaSourceObjectURL = null;
        this._mediaElement = null;

        this._isBufferFull = false;
        this._hasPendingEos = false;

        this._requireSetMediaDuration = false;
        this._pendingMediaDuration = 0;

        this._pendingSourceBufferInit = [];
        this._mimeTypes = {
            video: null,
            audio: null
        };
        this._sourceBuffers = {
            video: null,
            audio: null
        };
        this._lastInitSegments = {
            video: null,
            audio: null
        };
        this._pendingSegments = {
            video: [],
            audio: []
        };
        this._pendingRemoveRanges = {
            video: [],
            audio: []
        };
        this._idrList = new _mediaSegmentInfo.IDRSampleList();
    }

    _createClass(MSEController, [{
        key: 'destroy',
        value: function destroy() {
            if (this._mediaElement || this._mediaSource) {
                this.detachMediaElement();
            }
            this.e = null;
            this._emitter.removeAllListeners();
            this._emitter = null;
        }
    }, {
        key: 'on',
        value: function on(event, listener) {
            this._emitter.addListener(event, listener);
        }
    }, {
        key: 'off',
        value: function off(event, listener) {
            this._emitter.removeListener(event, listener);
        }
    }, {
        key: 'attachMediaElement',
        value: function attachMediaElement(mediaElement) {
            if (this._mediaSource) {
                throw new _exception.IllegalStateException('MediaSource has been attached to an HTMLMediaElement!');
            }
            var ms = this._mediaSource = new window.MediaSource();
            ms.addEventListener('sourceopen', this.e.onSourceOpen);
            ms.addEventListener('sourceended', this.e.onSourceEnded);
            ms.addEventListener('sourceclose', this.e.onSourceClose);

            this._mediaElement = mediaElement;
            this._mediaSourceObjectURL = window.URL.createObjectURL(this._mediaSource);
            mediaElement.src = this._mediaSourceObjectURL;
        }
    }, {
        key: 'detachMediaElement',
        value: function detachMediaElement() {
            if (this._mediaSource) {
                var ms = this._mediaSource;
                for (var type in this._sourceBuffers) {
                    // pending segments should be discard
                    var ps = this._pendingSegments[type];
                    ps.splice(0, ps.length);
                    this._pendingSegments[type] = null;
                    this._pendingRemoveRanges[type] = null;
                    this._lastInitSegments[type] = null;

                    // remove all sourcebuffers
                    var sb = this._sourceBuffers[type];
                    if (sb) {
                        if (ms.readyState !== 'closed') {
                            ms.removeSourceBuffer(sb);
                            sb.removeEventListener('error', this.e.onSourceBufferError);
                            sb.removeEventListener('updateend', this.e.onSourceBufferUpdateEnd);
                        }
                        this._mimeTypes[type] = null;
                        this._sourceBuffers[type] = null;
                    }
                }
                if (ms.readyState === 'open') {
                    try {
                        ms.endOfStream();
                    } catch (error) {
                        _logger2.default.e(this.TAG, error.message);
                    }
                }
                ms.removeEventListener('sourceopen', this.e.onSourceOpen);
                ms.removeEventListener('sourceended', this.e.onSourceEnded);
                ms.removeEventListener('sourceclose', this.e.onSourceClose);
                this._pendingSourceBufferInit = [];
                this._isBufferFull = false;
                this._idrList.clear();
                this._mediaSource = null;
            }

            if (this._mediaElement) {
                this._mediaElement.src = '';
                this._mediaElement.removeAttribute('src');
                this._mediaElement = null;
            }
            if (this._mediaSourceObjectURL) {
                window.URL.revokeObjectURL(this._mediaSourceObjectURL);
                this._mediaSourceObjectURL = null;
            }
        }
    }, {
        key: 'appendInitSegment',
        value: function appendInitSegment(initSegment, deferred) {
            if (!this._mediaSource || this._mediaSource.readyState !== 'open') {
                // sourcebuffer creation requires mediaSource.readyState === 'open'
                // so we defer the sourcebuffer creation, until sourceopen event triggered
                this._pendingSourceBufferInit.push(initSegment);
                // make sure that this InitSegment is in the front of pending segments queue
                this._pendingSegments[initSegment.type].push(initSegment);
                return;
            }

            var is = initSegment;
            var mimeType = '' + is.container;
            if (is.codec && is.codec.length > 0) {
                mimeType += ';codecs=' + is.codec;
            }

            var firstInitSegment = false;

            _logger2.default.v(this.TAG, 'Received Initialization Segment, mimeType: ' + mimeType);
            this._lastInitSegments[is.type] = is;

            if (mimeType !== this._mimeTypes[is.type]) {
                if (!this._mimeTypes[is.type]) {
                    // empty, first chance create sourcebuffer
                    firstInitSegment = true;
                    try {
                        var sb = this._sourceBuffers[is.type] = this._mediaSource.addSourceBuffer(mimeType);
                        sb.addEventListener('error', this.e.onSourceBufferError);
                        sb.addEventListener('updateend', this.e.onSourceBufferUpdateEnd);
                    } catch (error) {
                        _logger2.default.e(this.TAG, error.message);
                        this._emitter.emit(_mseEvents2.default.ERROR, { code: error.code, msg: error.message });
                        return;
                    }
                } else {
                    _logger2.default.v(this.TAG, 'Notice: ' + is.type + ' mimeType changed, origin: ' + this._mimeTypes[is.type] + ', target: ' + mimeType);
                }
                this._mimeTypes[is.type] = mimeType;
            }

            if (!deferred) {
                // deferred means this InitSegment has been pushed to pendingSegments queue
                this._pendingSegments[is.type].push(is);
            }
            if (!firstInitSegment) {
                // append immediately only if init segment in subsequence
                if (this._sourceBuffers[is.type] && !this._sourceBuffers[is.type].updating) {
                    this._doAppendSegments();
                }
            }
            if (_browser2.default.safari && is.container === 'audio/mpeg' && is.mediaDuration > 0) {
                // 'audio/mpeg' track under Safari may cause MediaElement's duration to be NaN
                // Manually correct MediaSource.duration to make progress bar seekable, and report right duration
                this._requireSetMediaDuration = true;
                this._pendingMediaDuration = is.mediaDuration / 1000; // in seconds
                this._updateMediaSourceDuration();
            }
        }
    }, {
        key: 'appendMediaSegment',
        value: function appendMediaSegment(mediaSegment) {
            var ms = mediaSegment;
            this._pendingSegments[ms.type].push(ms);

            if (this._config.autoCleanupSourceBuffer && this._needCleanupSourceBuffer()) {
                this._doCleanupSourceBuffer();
            }

            var sb = this._sourceBuffers[ms.type];
            if (sb && !sb.updating && !this._hasPendingRemoveRanges()) {
                this._doAppendSegments();
            }
        }
    }, {
        key: 'seek',
        value: function seek(seconds) {
            // remove all appended buffers
            for (var type in this._sourceBuffers) {
                if (!this._sourceBuffers[type]) {
                    continue;
                }

                // abort current buffer append algorithm
                var sb = this._sourceBuffers[type];
                if (this._mediaSource.readyState === 'open') {
                    try {
                        // If range removal algorithm is running, InvalidStateError will be throwed
                        // Ignore it.
                        sb.abort();
                    } catch (error) {
                        _logger2.default.e(this.TAG, error.message);
                    }
                }

                // IDRList should be clear
                this._idrList.clear();

                // pending segments should be discard
                var ps = this._pendingSegments[type];
                ps.splice(0, ps.length);

                if (this._mediaSource.readyState === 'closed') {
                    // Parent MediaSource object has been detached from HTMLMediaElement
                    continue;
                }

                // record ranges to be remove from SourceBuffer
                for (var i = 0; i < sb.buffered.length; i++) {
                    var start = sb.buffered.start(i);
                    var end = sb.buffered.end(i);
                    this._pendingRemoveRanges[type].push({ start: start, end: end });
                }

                // if sb is not updating, let's remove ranges now!
                if (!sb.updating) {
                    this._doRemoveRanges();
                }

                // Safari 10 may get InvalidStateError in the later appendBuffer() after SourceBuffer.remove() call
                // Internal parser's state may be invalid at this time. Re-append last InitSegment to workaround.
                // Related issue: https://bugs.webkit.org/show_bug.cgi?id=159230
                if (_browser2.default.safari) {
                    var lastInitSegment = this._lastInitSegments[type];
                    if (lastInitSegment) {
                        this._pendingSegments[type].push(lastInitSegment);
                        if (!sb.updating) {
                            this._doAppendSegments();
                        }
                    }
                }
            }
        }
    }, {
        key: 'endOfStream',
        value: function endOfStream() {
            var ms = this._mediaSource;
            var sb = this._sourceBuffers;
            if (!ms || ms.readyState !== 'open') {
                if (ms && ms.readyState === 'closed' && this._hasPendingSegments()) {
                    // If MediaSource hasn't turned into open state, and there're pending segments
                    // Mark pending endOfStream, defer call until all pending segments appended complete
                    this._hasPendingEos = true;
                }
                return;
            }
            if (sb.video && sb.video.updating || sb.audio && sb.audio.updating) {
                // If any sourcebuffer is updating, defer endOfStream operation
                // See _onSourceBufferUpdateEnd()
                this._hasPendingEos = true;
            } else {
                this._hasPendingEos = false;
                // Notify media data loading complete
                // This is helpful for correcting total duration to match last media segment
                // Otherwise MediaElement's ended event may not be triggered
                ms.endOfStream();
            }
        }
    }, {
        key: 'getNearestKeyframe',
        value: function getNearestKeyframe(dts) {
            return this._idrList.getLastSyncPointBeforeDts(dts);
        }
    }, {
        key: '_needCleanupSourceBuffer',
        value: function _needCleanupSourceBuffer() {
            if (!this._config.autoCleanupSourceBuffer) {
                return false;
            }

            var currentTime = this._mediaElement.currentTime;

            for (var type in this._sourceBuffers) {
                var sb = this._sourceBuffers[type];
                if (sb) {
                    var buffered = sb.buffered;
                    if (buffered.length >= 1) {
                        if (currentTime - buffered.start(0) >= this._config.autoCleanupMaxBackwardDuration) {
                            return true;
                        }
                    }
                }
            }

            return false;
        }
    }, {
        key: '_doCleanupSourceBuffer',
        value: function _doCleanupSourceBuffer() {
            var currentTime = this._mediaElement.currentTime;

            for (var type in this._sourceBuffers) {
                var sb = this._sourceBuffers[type];
                if (sb) {
                    var buffered = sb.buffered;
                    var doRemove = false;

                    for (var i = 0; i < buffered.length; i++) {
                        var start = buffered.start(i);
                        var end = buffered.end(i);

                        if (start <= currentTime && currentTime < end + 3) {
                            // padding 3 seconds
                            if (currentTime - start >= this._config.autoCleanupMaxBackwardDuration) {
                                doRemove = true;
                                var removeEnd = currentTime - this._config.autoCleanupMinBackwardDuration;
                                this._pendingRemoveRanges[type].push({ start: start, end: removeEnd });
                            }
                        } else if (end < currentTime) {
                            doRemove = true;
                            this._pendingRemoveRanges[type].push({ start: start, end: end });
                        }
                    }

                    if (doRemove && !sb.updating) {
                        this._doRemoveRanges();
                    }
                }
            }
        }
    }, {
        key: '_updateMediaSourceDuration',
        value: function _updateMediaSourceDuration() {
            var sb = this._sourceBuffers;
            if (this._mediaElement.readyState === 0 || this._mediaSource.readyState !== 'open') {
                return;
            }
            if (sb.video && sb.video.updating || sb.audio && sb.audio.updating) {
                return;
            }

            var current = this._mediaSource.duration;
            var target = this._pendingMediaDuration;

            if (target > 0 && (isNaN(current) || target > current)) {
                _logger2.default.v(this.TAG, 'Update MediaSource duration from ' + current + ' to ' + target);
                this._mediaSource.duration = target;
            }

            this._requireSetMediaDuration = false;
            this._pendingMediaDuration = 0;
        }
    }, {
        key: '_doRemoveRanges',
        value: function _doRemoveRanges() {
            for (var type in this._pendingRemoveRanges) {
                if (!this._sourceBuffers[type] || this._sourceBuffers[type].updating) {
                    continue;
                }
                var sb = this._sourceBuffers[type];
                var ranges = this._pendingRemoveRanges[type];
                while (ranges.length && !sb.updating) {
                    var range = ranges.shift();
                    sb.remove(range.start, range.end);
                }
            }
        }
    }, {
        key: '_doAppendSegments',
        value: function _doAppendSegments() {
            var pendingSegments = this._pendingSegments;

            for (var type in pendingSegments) {
                if (!this._sourceBuffers[type] || this._sourceBuffers[type].updating) {
                    continue;
                }

                if (pendingSegments[type].length > 0) {
                    var segment = pendingSegments[type].shift();

                    if (segment.timestampOffset) {
                        // For MPEG audio stream in MSE, if unbuffered-seeking occurred
                        // We need explicitly set timestampOffset to the desired point in timeline for mpeg SourceBuffer.
                        var currentOffset = this._sourceBuffers[type].timestampOffset;
                        var targetOffset = segment.timestampOffset / 1000; // in seconds

                        var delta = Math.abs(currentOffset - targetOffset);
                        if (delta > 0.1) {
                            // If time delta > 100ms
                            _logger2.default.v(this.TAG, 'Update MPEG audio timestampOffset from ' + currentOffset + ' to ' + targetOffset);
                            this._sourceBuffers[type].timestampOffset = targetOffset;
                        }
                        delete segment.timestampOffset;
                    }

                    if (!segment.data || segment.data.byteLength === 0) {
                        // Ignore empty buffer
                        continue;
                    }

                    try {
                        this._sourceBuffers[type].appendBuffer(segment.data);
                        this._isBufferFull = false;
                        if (type === 'video' && segment.hasOwnProperty('info')) {
                            this._idrList.appendArray(segment.info.syncPoints);
                        }
                    } catch (error) {
                        this._pendingSegments[type].unshift(segment);
                        if (error.code === 22) {
                            // QuotaExceededError
                            /* Notice that FireFox may not throw QuotaExceededError if SourceBuffer is full
                             * Currently we can only do lazy-load to avoid SourceBuffer become scattered.
                             * SourceBuffer eviction policy may be changed in future version of FireFox.
                             *
                             * Related issues:
                             * https://bugzilla.mozilla.org/show_bug.cgi?id=1279885
                             * https://bugzilla.mozilla.org/show_bug.cgi?id=1280023
                             */

                            // report buffer full, abort network IO
                            if (!this._isBufferFull) {
                                this._emitter.emit(_mseEvents2.default.BUFFER_FULL);
                            }
                            this._isBufferFull = true;
                        } else {
                            _logger2.default.e(this.TAG, error.message);
                            this._emitter.emit(_mseEvents2.default.ERROR, { code: error.code, msg: error.message });
                        }
                    }
                }
            }
        }
    }, {
        key: '_onSourceOpen',
        value: function _onSourceOpen() {
            _logger2.default.v(this.TAG, 'MediaSource onSourceOpen');
            this._mediaSource.removeEventListener('sourceopen', this.e.onSourceOpen);
            // deferred sourcebuffer creation / initialization
            if (this._pendingSourceBufferInit.length > 0) {
                var pendings = this._pendingSourceBufferInit;
                while (pendings.length) {
                    var segment = pendings.shift();
                    this.appendInitSegment(segment, true);
                }
            }
            // there may be some pending media segments, append them
            if (this._hasPendingSegments()) {
                this._doAppendSegments();
            }
            this._emitter.emit(_mseEvents2.default.SOURCE_OPEN);
        }
    }, {
        key: '_onSourceEnded',
        value: function _onSourceEnded() {
            // fired on endOfStream
            _logger2.default.v(this.TAG, 'MediaSource onSourceEnded');
        }
    }, {
        key: '_onSourceClose',
        value: function _onSourceClose() {
            // fired on detaching from media element
            _logger2.default.v(this.TAG, 'MediaSource onSourceClose');
            if (this._mediaSource && this.e != null) {
                this._mediaSource.removeEventListener('sourceopen', this.e.onSourceOpen);
                this._mediaSource.removeEventListener('sourceended', this.e.onSourceEnded);
                this._mediaSource.removeEventListener('sourceclose', this.e.onSourceClose);
            }
        }
    }, {
        key: '_hasPendingSegments',
        value: function _hasPendingSegments() {
            var ps = this._pendingSegments;
            return ps.video.length > 0 || ps.audio.length > 0;
        }
    }, {
        key: '_hasPendingRemoveRanges',
        value: function _hasPendingRemoveRanges() {
            var prr = this._pendingRemoveRanges;
            return prr.video.length > 0 || prr.audio.length > 0;
        }
    }, {
        key: '_onSourceBufferUpdateEnd',
        value: function _onSourceBufferUpdateEnd() {
            if (this._requireSetMediaDuration) {
                this._updateMediaSourceDuration();
            } else if (this._hasPendingRemoveRanges()) {
                this._doRemoveRanges();
            } else if (this._hasPendingSegments()) {
                this._doAppendSegments();
            } else if (this._hasPendingEos) {
                this.endOfStream();
            }
            this._emitter.emit(_mseEvents2.default.UPDATE_END);
        }
    }, {
        key: '_onSourceBufferError',
        value: function _onSourceBufferError(e) {
            _logger2.default.e(this.TAG, 'SourceBuffer Error: ' + e);
            // this error might not always be fatal, just ignore it
        }
    }]);

    return MSEController;
}();

exports.default = MSEController;

},{"../utils/browser.js":40,"../utils/exception.js":41,"../utils/logger.js":42,"./media-segment-info.js":9,"./mse-events.js":11,"events":3}],11:[function(_dereq_,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
/*
 * Copyright (C) 2016 Bilibili. All Rights Reserved.
 *
 * @author zheng qian <xqq@xqq.im>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var MSEEvents = {
  ERROR: 'error',
  SOURCE_OPEN: 'source_open',
  UPDATE_END: 'update_end',
  BUFFER_FULL: 'buffer_full'
};

exports.default = MSEEvents;

},{}],12:[function(_dereq_,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); /*
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * Copyright (C) 2016 Bilibili. All Rights Reserved.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * @author zheng qian <xqq@xqq.im>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * Licensed under the Apache License, Version 2.0 (the "License");
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * you may not use this file except in compliance with the License.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * You may obtain a copy of the License at
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *     http://www.apache.org/licenses/LICENSE-2.0
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * Unless required by applicable law or agreed to in writing, software
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * distributed under the License is distributed on an "AS IS" BASIS,
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * See the License for the specific language governing permissions and
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * limitations under the License.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      */

var _events = _dereq_('events');

var _events2 = _interopRequireDefault(_events);

var _logger = _dereq_('../utils/logger.js');

var _logger2 = _interopRequireDefault(_logger);

var _loggingControl = _dereq_('../utils/logging-control.js');

var _loggingControl2 = _interopRequireDefault(_loggingControl);

var _transmuxingController = _dereq_('./transmuxing-controller.js');

var _transmuxingController2 = _interopRequireDefault(_transmuxingController);

var _transmuxingEvents = _dereq_('./transmuxing-events.js');

var _transmuxingEvents2 = _interopRequireDefault(_transmuxingEvents);

var _transmuxingWorker = _dereq_('./transmuxing-worker.js');

var _transmuxingWorker2 = _interopRequireDefault(_transmuxingWorker);

var _mediaInfo = _dereq_('./media-info.js');

var _mediaInfo2 = _interopRequireDefault(_mediaInfo);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Transmuxer = function () {
    function Transmuxer(mediaDataSource, config) {
        _classCallCheck(this, Transmuxer);

        this.TAG = 'Transmuxer';
        this._emitter = new _events2.default();

        if (config.enableWorker && typeof Worker !== 'undefined') {
            try {
                var work = _dereq_('webworkify');
                this._worker = work(_transmuxingWorker2.default);
                this._workerDestroying = false;
                this._worker.addEventListener('message', this._onWorkerMessage.bind(this));
                this._worker.postMessage({ cmd: 'init', param: [mediaDataSource, config] });
                this.e = {
                    onLoggingConfigChanged: this._onLoggingConfigChanged.bind(this)
                };
                _loggingControl2.default.registerListener(this.e.onLoggingConfigChanged);
                this._worker.postMessage({ cmd: 'logging_config', param: _loggingControl2.default.getConfig() });
            } catch (error) {
                _logger2.default.e(this.TAG, 'Error while initialize transmuxing worker, fallback to inline transmuxing');
                this._worker = null;
                this._controller = new _transmuxingController2.default(mediaDataSource, config);
            }
        } else {
            this._controller = new _transmuxingController2.default(mediaDataSource, config);
        }

        if (this._controller) {
            var ctl = this._controller;
            ctl.on(_transmuxingEvents2.default.IO_ERROR, this._onIOError.bind(this));
            ctl.on(_transmuxingEvents2.default.DEMUX_ERROR, this._onDemuxError.bind(this));
            ctl.on(_transmuxingEvents2.default.INIT_SEGMENT, this._onInitSegment.bind(this));
            ctl.on(_transmuxingEvents2.default.MEDIA_SEGMENT, this._onMediaSegment.bind(this));
            ctl.on(_transmuxingEvents2.default.LOADING_COMPLETE, this._onLoadingComplete.bind(this));
            ctl.on(_transmuxingEvents2.default.RECOVERED_EARLY_EOF, this._onRecoveredEarlyEof.bind(this));
            ctl.on(_transmuxingEvents2.default.MEDIA_INFO, this._onMediaInfo.bind(this));
            ctl.on(_transmuxingEvents2.default.METADATA_ARRIVED, this._onMetaDataArrived.bind(this));
            ctl.on(_transmuxingEvents2.default.STATISTICS_INFO, this._onStatisticsInfo.bind(this));
            ctl.on(_transmuxingEvents2.default.RECOMMEND_SEEKPOINT, this._onRecommendSeekpoint.bind(this));
            ctl.on(_transmuxingEvents2.default.DEMUX_MSG, this._onDemuxState.bind(this));
        }
    }

    _createClass(Transmuxer, [{
        key: 'destroy',
        value: function destroy() {
            if (this._worker) {
                if (!this._workerDestroying) {
                    this._workerDestroying = true;
                    this._worker.postMessage({ cmd: 'destroy' });
                    _loggingControl2.default.removeListener(this.e.onLoggingConfigChanged);
                    this.e = null;
                }
            } else {
                this._controller.destroy();
                this._controller = null;
            }
            this._emitter.removeAllListeners();
            this._emitter = null;
        }
    }, {
        key: 'on',
        value: function on(event, listener) {
            this._emitter.addListener(event, listener);
        }
    }, {
        key: 'off',
        value: function off(event, listener) {
            this._emitter.removeListener(event, listener);
        }
    }, {
        key: 'hasWorker',
        value: function hasWorker() {
            return this._worker != null;
        }
    }, {
        key: 'open',
        value: function open() {
            if (this._worker) {
                this._worker.postMessage({ cmd: 'start' });
            } else {
                this._controller.start();
            }
        }
    }, {
        key: 'close',
        value: function close() {
            if (this._worker) {
                this._worker.postMessage({ cmd: 'stop' });
            } else {
                this._controller.stop();
            }
        }
    }, {
        key: 'seek',
        value: function seek(milliseconds) {
            if (this._worker) {
                this._worker.postMessage({ cmd: 'seek', param: milliseconds });
            } else {
                this._controller.seek(milliseconds);
            }
        }
    }, {
        key: 'pause',
        value: function pause() {
            if (this._worker) {
                this._worker.postMessage({ cmd: 'pause' });
            } else {
                this._controller.pause();
            }
        }
    }, {
        key: 'resume',
        value: function resume() {
            if (this._worker) {
                this._worker.postMessage({ cmd: 'resume' });
            } else {
                this._controller.resume();
            }
        }
    }, {
        key: '_onInitSegment',
        value: function _onInitSegment(type, initSegment) {
            var _this = this;

            // do async invoke
            Promise.resolve().then(function () {
                _this._emitter.emit(_transmuxingEvents2.default.INIT_SEGMENT, type, initSegment);
            });
        }
    }, {
        key: '_onMediaSegment',
        value: function _onMediaSegment(type, mediaSegment) {
            var _this2 = this;

            Promise.resolve().then(function () {
                _this2._emitter.emit(_transmuxingEvents2.default.MEDIA_SEGMENT, type, mediaSegment);
            });
        }
    }, {
        key: '_onLoadingComplete',
        value: function _onLoadingComplete() {
            var _this3 = this;

            Promise.resolve().then(function () {
                _this3._emitter.emit(_transmuxingEvents2.default.LOADING_COMPLETE);
            });
        }
    }, {
        key: '_onRecoveredEarlyEof',
        value: function _onRecoveredEarlyEof() {
            var _this4 = this;

            Promise.resolve().then(function () {
                _this4._emitter.emit(_transmuxingEvents2.default.RECOVERED_EARLY_EOF);
            });
        }
    }, {
        key: '_onMediaInfo',
        value: function _onMediaInfo(mediaInfo) {
            var _this5 = this;

            Promise.resolve().then(function () {
                _this5._emitter.emit(_transmuxingEvents2.default.MEDIA_INFO, mediaInfo);
            });
        }
    }, {
        key: '_onMetaDataArrived',
        value: function _onMetaDataArrived(metadata) {
            var _this6 = this;

            Promise.resolve().then(function () {
                _this6._emitter.emit(_transmuxingEvents2.default.METADATA_ARRIVED, metadata);
            });
        }
    }, {
        key: '_onStatisticsInfo',
        value: function _onStatisticsInfo(statisticsInfo) {
            var _this7 = this;

            Promise.resolve().then(function () {
                _this7._emitter.emit(_transmuxingEvents2.default.STATISTICS_INFO, statisticsInfo);
            });
        }
    }, {
        key: '_onIOError',
        value: function _onIOError(type, info) {
            var _this8 = this;

            Promise.resolve().then(function () {
                _this8._emitter.emit(_transmuxingEvents2.default.IO_ERROR, type, info);
            });
        }
    }, {
        key: '_onDemuxError',
        value: function _onDemuxError(type, info) {
            var _this9 = this;

            Promise.resolve().then(function () {
                _this9._emitter.emit(_transmuxingEvents2.default.DEMUX_ERROR, type, info);
            });
        }
    }, {
        key: '_onRecommendSeekpoint',
        value: function _onRecommendSeekpoint(milliseconds) {
            var _this10 = this;

            Promise.resolve().then(function () {
                _this10._emitter.emit(_transmuxingEvents2.default.RECOMMEND_SEEKPOINT, milliseconds);
            });
        }
    }, {
        key: '_onDemuxState',
        value: function _onDemuxState(metadata) {
            var _this11 = this;

            Promise.resolve().then(function () {
                _this11._emitter.emit(_transmuxingEvents2.default.DEMUX_MSG, metadata);
            });
        }
    }, {
        key: '_onLoggingConfigChanged',
        value: function _onLoggingConfigChanged(config) {
            if (this._worker) {
                this._worker.postMessage({ cmd: 'logging_config', param: config });
            }
        }
    }, {
        key: '_onWorkerMessage',
        value: function _onWorkerMessage(e) {
            var message = e.data;
            var data = message.data;

            if (message.msg === 'destroyed' || this._workerDestroying) {
                this._workerDestroying = false;
                this._worker.terminate();
                this._worker = null;
                return;
            }

            switch (message.msg) {
                case _transmuxingEvents2.default.INIT_SEGMENT:
                case _transmuxingEvents2.default.MEDIA_SEGMENT:
                    this._emitter.emit(message.msg, data.type, data.data);
                    break;
                case _transmuxingEvents2.default.LOADING_COMPLETE:
                case _transmuxingEvents2.default.RECOVERED_EARLY_EOF:
                    this._emitter.emit(message.msg);
                    break;
                case _transmuxingEvents2.default.MEDIA_INFO:
                    Object.setPrototypeOf(data, _mediaInfo2.default.prototype);
                    this._emitter.emit(message.msg, data);
                    break;
                case _transmuxingEvents2.default.METADATA_ARRIVED:
                case _transmuxingEvents2.default.STATISTICS_INFO:
                    this._emitter.emit(message.msg, data);
                    break;
                case _transmuxingEvents2.default.IO_ERROR:
                case _transmuxingEvents2.default.DEMUX_ERROR:
                    this._emitter.emit(message.msg, data.type, data.info);
                    break;
                case _transmuxingEvents2.default.RECOMMEND_SEEKPOINT:
                    this._emitter.emit(message.msg, data);
                    break;
                case _transmuxingEvents2.default.DEMUX_MSG:
                    this._emitter.emit(message.msg, data);
                    break;
                case 'logcat_callback':
                    _logger2.default.emitter.emit('log', data.type, data.logcat);
                    break;
                default:
                    break;
            }
        }
    }]);

    return Transmuxer;
}();

exports.default = Transmuxer;

},{"../utils/logger.js":42,"../utils/logging-control.js":43,"./media-info.js":8,"./transmuxing-controller.js":13,"./transmuxing-events.js":14,"./transmuxing-worker.js":15,"events":3,"webworkify":5}],13:[function(_dereq_,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); /*
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * Copyright (C) 2016 Bilibili. All Rights Reserved.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * @author zheng qian <xqq@xqq.im>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * Licensed under the Apache License, Version 2.0 (the "License");
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * you may not use this file except in compliance with the License.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * You may obtain a copy of the License at
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *     http://www.apache.org/licenses/LICENSE-2.0
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * Unless required by applicable law or agreed to in writing, software
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * distributed under the License is distributed on an "AS IS" BASIS,
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * See the License for the specific language governing permissions and
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * limitations under the License.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      */

var _events = _dereq_('events');

var _events2 = _interopRequireDefault(_events);

var _logger = _dereq_('../utils/logger.js');

var _logger2 = _interopRequireDefault(_logger);

var _browser = _dereq_('../utils/browser.js');

var _browser2 = _interopRequireDefault(_browser);

var _mediaInfo = _dereq_('./media-info.js');

var _mediaInfo2 = _interopRequireDefault(_mediaInfo);

var _flvDemuxer = _dereq_('../demux/flv-demuxer.js');

var _flvDemuxer2 = _interopRequireDefault(_flvDemuxer);

var _mp4Remuxer = _dereq_('../remux/mp4-remuxer.js');

var _mp4Remuxer2 = _interopRequireDefault(_mp4Remuxer);

var _demuxErrors = _dereq_('../demux/demux-errors.js');

var _demuxErrors2 = _interopRequireDefault(_demuxErrors);

var _ioController = _dereq_('../io/io-controller.js');

var _ioController2 = _interopRequireDefault(_ioController);

var _transmuxingEvents = _dereq_('./transmuxing-events.js');

var _transmuxingEvents2 = _interopRequireDefault(_transmuxingEvents);

var _loader = _dereq_('../io/loader.js');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

// Transmuxing (IO, Demuxing, Remuxing) controller, with multipart support
var TransmuxingController = function () {
    function TransmuxingController(mediaDataSource, config) {
        _classCallCheck(this, TransmuxingController);

        this.TAG = 'TransmuxingController';
        this._emitter = new _events2.default();

        this._config = config;

        // treat single part media as multipart media, which has only one segment
        if (!mediaDataSource.segments) {
            mediaDataSource.segments = [{
                duration: mediaDataSource.duration,
                filesize: mediaDataSource.filesize,
                url: mediaDataSource.url
            }];
        }

        // fill in default IO params if not exists
        if (typeof mediaDataSource.cors !== 'boolean') {
            mediaDataSource.cors = true;
        }
        if (typeof mediaDataSource.withCredentials !== 'boolean') {
            mediaDataSource.withCredentials = false;
        }

        this._mediaDataSource = mediaDataSource;
        this._currentSegmentIndex = 0;
        var totalDuration = 0;

        this._mediaDataSource.segments.forEach(function (segment) {
            // timestampBase for each segment, and calculate total duration
            segment.timestampBase = totalDuration;
            totalDuration += segment.duration;
            // params needed by IOController
            segment.cors = mediaDataSource.cors;
            segment.withCredentials = mediaDataSource.withCredentials;
            // referrer policy control, if exist
            if (config.referrerPolicy) {
                segment.referrerPolicy = config.referrerPolicy;
            }
        });

        if (!isNaN(totalDuration) && this._mediaDataSource.duration !== totalDuration) {
            this._mediaDataSource.duration = totalDuration;
        }

        this._mediaInfo = null;
        this._demuxer = null;
        this._remuxer = null;
        this._ioctl = null;

        this._pendingSeekTime = null;
        this._pendingResolveSeekPoint = null;

        this._statisticsReporter = null;
    }

    _createClass(TransmuxingController, [{
        key: 'destroy',
        value: function destroy() {
            this._mediaInfo = null;
            this._mediaDataSource = null;

            if (this._statisticsReporter) {
                this._disableStatisticsReporter();
            }
            if (this._ioctl) {
                this._ioctl.destroy();
                this._ioctl = null;
            }
            if (this._demuxer) {
                this._demuxer.destroy();
                this._demuxer = null;
            }
            if (this._remuxer) {
                this._remuxer.destroy();
                this._remuxer = null;
            }

            this._emitter.removeAllListeners();
            this._emitter = null;
        }
    }, {
        key: 'on',
        value: function on(event, listener) {
            this._emitter.addListener(event, listener);
        }
    }, {
        key: 'off',
        value: function off(event, listener) {
            this._emitter.removeListener(event, listener);
        }
    }, {
        key: 'start',
        value: function start() {
            this._loadSegment(0);
            this._enableStatisticsReporter();
        }
    }, {
        key: '_loadSegment',
        value: function _loadSegment(segmentIndex, optionalFrom) {
            this._currentSegmentIndex = segmentIndex;
            var dataSource = this._mediaDataSource.segments[segmentIndex];

            var ioctl = this._ioctl = new _ioController2.default(dataSource, this._config, segmentIndex);
            ioctl.onError = this._onIOException.bind(this);
            ioctl.onSeeked = this._onIOSeeked.bind(this);
            ioctl.onComplete = this._onIOComplete.bind(this);
            ioctl.onRedirect = this._onIORedirect.bind(this);
            ioctl.onRecoveredEarlyEof = this._onIORecoveredEarlyEof.bind(this);

            if (optionalFrom) {
                this._demuxer.bindDataSource(this._ioctl);
            } else {
                ioctl.onDataArrival = this._onInitChunkArrival.bind(this);
            }

            ioctl.open(optionalFrom);
        }
    }, {
        key: 'stop',
        value: function stop() {
            this._internalAbort();
            this._disableStatisticsReporter();
        }
    }, {
        key: '_internalAbort',
        value: function _internalAbort() {
            if (this._ioctl) {
                this._ioctl.destroy();
                this._ioctl = null;
            }
        }
    }, {
        key: 'pause',
        value: function pause() {
            // take a rest
            if (this._ioctl && this._ioctl.isWorking()) {
                this._ioctl.pause();
                this._disableStatisticsReporter();
            }
        }
    }, {
        key: 'resume',
        value: function resume() {
            if (this._ioctl && this._ioctl.isPaused()) {
                this._ioctl.resume();
                this._enableStatisticsReporter();
            }
        }
    }, {
        key: 'seek',
        value: function seek(milliseconds) {
            if (this._mediaInfo == null || !this._mediaInfo.isSeekable()) {
                return;
            }

            var targetSegmentIndex = this._searchSegmentIndexContains(milliseconds);

            if (targetSegmentIndex === this._currentSegmentIndex) {
                // intra-segment seeking
                var segmentInfo = this._mediaInfo.segments[targetSegmentIndex];

                if (segmentInfo == undefined) {
                    // current segment loading started, but mediainfo hasn't received yet
                    // wait for the metadata loaded, then seek to expected position
                    this._pendingSeekTime = milliseconds;
                } else {
                    var keyframe = segmentInfo.getNearestKeyframe(milliseconds);
                    this._remuxer.seek(keyframe.milliseconds);
                    this._ioctl.seek(keyframe.fileposition);
                    // Will be resolved in _onRemuxerMediaSegmentArrival()
                    this._pendingResolveSeekPoint = keyframe.milliseconds;
                }
            } else {
                // cross-segment seeking
                var targetSegmentInfo = this._mediaInfo.segments[targetSegmentIndex];

                if (targetSegmentInfo == undefined) {
                    // target segment hasn't been loaded. We need metadata then seek to expected time
                    this._pendingSeekTime = milliseconds;
                    this._internalAbort();
                    this._remuxer.seek();
                    this._remuxer.insertDiscontinuity();
                    this._loadSegment(targetSegmentIndex);
                    // Here we wait for the metadata loaded, then seek to expected position
                } else {
                    // We have target segment's metadata, direct seek to target position
                    var _keyframe = targetSegmentInfo.getNearestKeyframe(milliseconds);
                    this._internalAbort();
                    this._remuxer.seek(milliseconds);
                    this._remuxer.insertDiscontinuity();
                    this._demuxer.resetMediaInfo();
                    this._demuxer.timestampBase = this._mediaDataSource.segments[targetSegmentIndex].timestampBase;
                    this._loadSegment(targetSegmentIndex, _keyframe.fileposition);
                    this._pendingResolveSeekPoint = _keyframe.milliseconds;
                    this._reportSegmentMediaInfo(targetSegmentIndex);
                }
            }

            this._enableStatisticsReporter();
        }
    }, {
        key: '_searchSegmentIndexContains',
        value: function _searchSegmentIndexContains(milliseconds) {
            var segments = this._mediaDataSource.segments;
            var idx = segments.length - 1;

            for (var i = 0; i < segments.length; i++) {
                if (milliseconds < segments[i].timestampBase) {
                    idx = i - 1;
                    break;
                }
            }
            return idx;
        }
    }, {
        key: '_onInitChunkArrival',
        value: function _onInitChunkArrival(data, byteStart) {
            var _this = this;

            var probeData = null;
            var consumed = 0;

            if (byteStart > 0) {
                // IOController seeked immediately after opened, byteStart > 0 callback may received
                this._demuxer.bindDataSource(this._ioctl);
                this._demuxer.timestampBase = this._mediaDataSource.segments[this._currentSegmentIndex].timestampBase;

                consumed = this._demuxer.parseChunks(data, byteStart);
            } else if ((probeData = _flvDemuxer2.default.probe(data)).match) {
                // Always create new FLVDemuxer
                this._demuxer = new _flvDemuxer2.default(probeData, this._config);

                if (!this._remuxer) {
                    this._remuxer = new _mp4Remuxer2.default(this._config);
                }

                var mds = this._mediaDataSource;
                if (mds.duration != undefined && !isNaN(mds.duration)) {
                    this._demuxer.overridedDuration = mds.duration;
                }
                if (typeof mds.hasAudio === 'boolean') {
                    this._demuxer.overridedHasAudio = mds.hasAudio;
                }
                if (typeof mds.hasVideo === 'boolean') {
                    this._demuxer.overridedHasVideo = mds.hasVideo;
                }

                this._demuxer.timestampBase = mds.segments[this._currentSegmentIndex].timestampBase;

                this._demuxer.onError = this._onDemuxException.bind(this);
                this._demuxer.onMediaInfo = this._onMediaInfo.bind(this);
                this._demuxer.onMetaDataArrived = this._onMetaDataArrived.bind(this);

                // TO zhengfeifei
                this._demuxer._onMessageDx = this._onMessageDx.bind(this);

                this._remuxer.bindDataSource(this._demuxer.bindDataSource(this._ioctl));

                this._remuxer.onInitSegment = this._onRemuxerInitSegmentArrival.bind(this);
                this._remuxer.onMediaSegment = this._onRemuxerMediaSegmentArrival.bind(this);

                consumed = this._demuxer.parseChunks(data, byteStart);
            } else {
                probeData = null;
                _logger2.default.e(this.TAG, 'Non-FLV, Unsupported media type!');
                Promise.resolve().then(function () {
                    _this._internalAbort();
                });
                this._emitter.emit(_transmuxingEvents2.default.DEMUX_ERROR, _demuxErrors2.default.FORMAT_UNSUPPORTED, 'Non-FLV, Unsupported media type');

                consumed = 0;
            }

            return consumed;
        }
    }, {
        key: '_onMessageDx',
        value: function _onMessageDx(codecId) {
            this._emitter.emit(_transmuxingEvents2.default.DEMUX_MSG, codecId);
        }
    }, {
        key: '_onMediaInfo',
        value: function _onMediaInfo(mediaInfo) {
            var _this2 = this;

            if (this._mediaInfo == null) {
                // Store first segment's mediainfo as global mediaInfo
                this._mediaInfo = Object.assign({}, mediaInfo);
                this._mediaInfo.keyframesIndex = null;
                this._mediaInfo.segments = [];
                this._mediaInfo.segmentCount = this._mediaDataSource.segments.length;
                Object.setPrototypeOf(this._mediaInfo, _mediaInfo2.default.prototype);
            }

            var segmentInfo = Object.assign({}, mediaInfo);
            Object.setPrototypeOf(segmentInfo, _mediaInfo2.default.prototype);
            this._mediaInfo.segments[this._currentSegmentIndex] = segmentInfo;

            // notify mediaInfo update
            this._reportSegmentMediaInfo(this._currentSegmentIndex);

            if (this._pendingSeekTime != null) {
                Promise.resolve().then(function () {
                    var target = _this2._pendingSeekTime;
                    _this2._pendingSeekTime = null;
                    _this2.seek(target);
                });
            }
        }
    }, {
        key: '_onMetaDataArrived',
        value: function _onMetaDataArrived(metadata) {
            this._emitter.emit(_transmuxingEvents2.default.METADATA_ARRIVED, metadata);
        }
    }, {
        key: '_onIOSeeked',
        value: function _onIOSeeked() {
            this._remuxer.insertDiscontinuity();
        }
    }, {
        key: '_onIOComplete',
        value: function _onIOComplete(extraData) {
            var segmentIndex = extraData;
            var nextSegmentIndex = segmentIndex + 1;

            if (nextSegmentIndex < this._mediaDataSource.segments.length) {
                this._internalAbort();
                this._remuxer.flushStashedSamples();
                this._loadSegment(nextSegmentIndex);
            } else {
                this._remuxer.flushStashedSamples();
                this._emitter.emit(_transmuxingEvents2.default.LOADING_COMPLETE);
                this._disableStatisticsReporter();
            }
        }
    }, {
        key: '_onIORedirect',
        value: function _onIORedirect(redirectedURL) {
            var segmentIndex = this._ioctl.extraData;
            this._mediaDataSource.segments[segmentIndex].redirectedURL = redirectedURL;
        }
    }, {
        key: '_onIORecoveredEarlyEof',
        value: function _onIORecoveredEarlyEof() {
            this._emitter.emit(_transmuxingEvents2.default.RECOVERED_EARLY_EOF);
        }
    }, {
        key: '_onIOException',
        value: function _onIOException(type, info) {
            _logger2.default.e(this.TAG, 'IOException: type = ' + type + ', code = ' + info.code + ', msg = ' + info.msg);
            this._emitter.emit(_transmuxingEvents2.default.IO_ERROR, type, info);
            this._disableStatisticsReporter();
        }
    }, {
        key: '_onDemuxException',
        value: function _onDemuxException(type, info) {
            _logger2.default.e(this.TAG, 'DemuxException: type = ' + type + ', info = ' + info);
            this._emitter.emit(_transmuxingEvents2.default.DEMUX_ERROR, type, info);
        }
    }, {
        key: '_onRemuxerInitSegmentArrival',
        value: function _onRemuxerInitSegmentArrival(type, initSegment) {
            this._emitter.emit(_transmuxingEvents2.default.INIT_SEGMENT, type, initSegment);
        }
    }, {
        key: '_onRemuxerMediaSegmentArrival',
        value: function _onRemuxerMediaSegmentArrival(type, mediaSegment) {
            if (this._pendingSeekTime != null) {
                // Media segments after new-segment cross-seeking should be dropped.
                return;
            }
            this._emitter.emit(_transmuxingEvents2.default.MEDIA_SEGMENT, type, mediaSegment);

            // Resolve pending seekPoint
            if (this._pendingResolveSeekPoint != null && type === 'video') {
                var syncPoints = mediaSegment.info.syncPoints;
                var seekpoint = this._pendingResolveSeekPoint;
                this._pendingResolveSeekPoint = null;

                // Safari: Pass PTS for recommend_seekpoint
                if (_browser2.default.safari && syncPoints.length > 0 && syncPoints[0].originalDts === seekpoint) {
                    seekpoint = syncPoints[0].pts;
                }
                // else: use original DTS (keyframe.milliseconds)

                this._emitter.emit(_transmuxingEvents2.default.RECOMMEND_SEEKPOINT, seekpoint);
            }
        }
    }, {
        key: '_enableStatisticsReporter',
        value: function _enableStatisticsReporter() {
            if (this._statisticsReporter == null) {
                this._statisticsReporter = self.setInterval(this._reportStatisticsInfo.bind(this), this._config.statisticsInfoReportInterval);
            }
        }
    }, {
        key: '_disableStatisticsReporter',
        value: function _disableStatisticsReporter() {
            if (this._statisticsReporter) {
                self.clearInterval(this._statisticsReporter);
                this._statisticsReporter = null;
            }
        }
    }, {
        key: '_reportSegmentMediaInfo',
        value: function _reportSegmentMediaInfo(segmentIndex) {
            var segmentInfo = this._mediaInfo.segments[segmentIndex];
            var exportInfo = Object.assign({}, segmentInfo);

            exportInfo.duration = this._mediaInfo.duration;
            exportInfo.segmentCount = this._mediaInfo.segmentCount;
            delete exportInfo.segments;
            delete exportInfo.keyframesIndex;

            this._emitter.emit(_transmuxingEvents2.default.MEDIA_INFO, exportInfo);
        }
    }, {
        key: '_reportStatisticsInfo',
        value: function _reportStatisticsInfo() {
            var info = {};

            info.url = this._ioctl.currentURL;
            info.hasRedirect = this._ioctl.hasRedirect;
            if (info.hasRedirect) {
                info.redirectedURL = this._ioctl.currentRedirectedURL;
            }

            info.speed = this._ioctl.currentSpeed;
            info.loaderType = this._ioctl.loaderType;
            info.currentSegmentIndex = this._currentSegmentIndex;
            info.totalSegmentCount = this._mediaDataSource.segments.length;

            this._emitter.emit(_transmuxingEvents2.default.STATISTICS_INFO, info);
        }
    }]);

    return TransmuxingController;
}();

exports.default = TransmuxingController;

},{"../demux/demux-errors.js":17,"../demux/flv-demuxer.js":19,"../io/io-controller.js":24,"../io/loader.js":25,"../remux/mp4-remuxer.js":39,"../utils/browser.js":40,"../utils/logger.js":42,"./media-info.js":8,"./transmuxing-events.js":14,"events":3}],14:[function(_dereq_,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
/*
 * Copyright (C) 2016 Bilibili. All Rights Reserved.
 *
 * @author zheng qian <xqq@xqq.im>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var TransmuxingEvents = {
  IO_ERROR: 'io_error',
  DEMUX_ERROR: 'demux_error',
  INIT_SEGMENT: 'init_segment',
  MEDIA_SEGMENT: 'media_segment',
  LOADING_COMPLETE: 'loading_complete',
  RECOVERED_EARLY_EOF: 'recovered_early_eof',
  MEDIA_INFO: 'media_info',
  METADATA_ARRIVED: 'metadata_arrived',
  STATISTICS_INFO: 'statistics_info',
  RECOMMEND_SEEKPOINT: 'recommend_seekpoint',
  DEMUX_MSG: 'demux_msg'
};

exports.default = TransmuxingEvents;

},{}],15:[function(_dereq_,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _logger = _dereq_('../utils/logger.js');

var _logger2 = _interopRequireDefault(_logger);

var _loggingControl = _dereq_('../utils/logging-control.js');

var _loggingControl2 = _interopRequireDefault(_loggingControl);

var _polyfill = _dereq_('../utils/polyfill.js');

var _polyfill2 = _interopRequireDefault(_polyfill);

var _transmuxingController = _dereq_('./transmuxing-controller.js');

var _transmuxingController2 = _interopRequireDefault(_transmuxingController);

var _transmuxingEvents = _dereq_('./transmuxing-events.js');

var _transmuxingEvents2 = _interopRequireDefault(_transmuxingEvents);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/* post message to worker:
   data: {
       cmd: string
       param: any
   }

   receive message from worker:
   data: {
       msg: string,
       data: any
   }
 */

var TransmuxingWorker = function TransmuxingWorker(self) {

    var TAG = 'TransmuxingWorker';
    var controller = null;
    var logcatListener = onLogcatCallback.bind(this);

    _polyfill2.default.install();

    self.addEventListener('message', function (e) {
        switch (e.data.cmd) {
            case 'init':
                controller = new _transmuxingController2.default(e.data.param[0], e.data.param[1]);
                controller.on(_transmuxingEvents2.default.IO_ERROR, onIOError.bind(this));
                controller.on(_transmuxingEvents2.default.DEMUX_ERROR, onDemuxError.bind(this));
                controller.on(_transmuxingEvents2.default.INIT_SEGMENT, onInitSegment.bind(this));
                controller.on(_transmuxingEvents2.default.MEDIA_SEGMENT, onMediaSegment.bind(this));
                controller.on(_transmuxingEvents2.default.LOADING_COMPLETE, onLoadingComplete.bind(this));
                controller.on(_transmuxingEvents2.default.RECOVERED_EARLY_EOF, onRecoveredEarlyEof.bind(this));
                controller.on(_transmuxingEvents2.default.MEDIA_INFO, onMediaInfo.bind(this));
                controller.on(_transmuxingEvents2.default.METADATA_ARRIVED, onMetaDataArrived.bind(this));
                controller.on(_transmuxingEvents2.default.STATISTICS_INFO, onStatisticsInfo.bind(this));
                controller.on(_transmuxingEvents2.default.RECOMMEND_SEEKPOINT, onRecommendSeekpoint.bind(this));
                // plus
                controller.on(_transmuxingEvents2.default.DEMUX_MSG, onDemuxMsg.bind(this));

                break;
            case 'destroy':
                if (controller) {
                    controller.destroy();
                    controller = null;
                }
                self.postMessage({ msg: 'destroyed' });
                break;
            case 'start':
                controller.start();
                break;
            case 'stop':
                controller.stop();
                break;
            case 'seek':
                controller.seek(e.data.param);
                break;
            case 'pause':
                controller.pause();
                break;
            case 'resume':
                controller.resume();
                break;
            case 'logging_config':
                {
                    var config = e.data.param;
                    _loggingControl2.default.applyConfig(config);

                    if (config.enableCallback === true) {
                        _loggingControl2.default.addLogListener(logcatListener);
                    } else {
                        _loggingControl2.default.removeLogListener(logcatListener);
                    }
                    break;
                }
        }
    });

    function onDemuxMsg(metadata) {
        var obj = {
            msg: _transmuxingEvents2.default.DEMUX_MSG,
            data: metadata
        };
        self.postMessage(obj);
    }

    function onInitSegment(type, initSegment) {
        var obj = {
            msg: _transmuxingEvents2.default.INIT_SEGMENT,
            data: {
                type: type,
                data: initSegment
            }
        };
        self.postMessage(obj, [initSegment.data]); // data: ArrayBuffer
    }

    function onMediaSegment(type, mediaSegment) {
        var obj = {
            msg: _transmuxingEvents2.default.MEDIA_SEGMENT,
            data: {
                type: type,
                data: mediaSegment
            }
        };
        self.postMessage(obj, [mediaSegment.data]); // data: ArrayBuffer
    }

    function onLoadingComplete() {
        var obj = {
            msg: _transmuxingEvents2.default.LOADING_COMPLETE
        };
        self.postMessage(obj);
    }

    function onRecoveredEarlyEof() {
        var obj = {
            msg: _transmuxingEvents2.default.RECOVERED_EARLY_EOF
        };
        self.postMessage(obj);
    }

    function onMediaInfo(mediaInfo) {
        var obj = {
            msg: _transmuxingEvents2.default.MEDIA_INFO,
            data: mediaInfo
        };
        self.postMessage(obj);
    }

    function onMetaDataArrived(metadata) {
        var obj = {
            msg: _transmuxingEvents2.default.METADATA_ARRIVED,
            data: metadata
        };
        self.postMessage(obj);
    }

    function onStatisticsInfo(statInfo) {
        var obj = {
            msg: _transmuxingEvents2.default.STATISTICS_INFO,
            data: statInfo
        };
        self.postMessage(obj);
    }

    function onIOError(type, info) {
        self.postMessage({
            msg: _transmuxingEvents2.default.IO_ERROR,
            data: {
                type: type,
                info: info
            }
        });
    }

    function onDemuxError(type, info) {
        self.postMessage({
            msg: _transmuxingEvents2.default.DEMUX_ERROR,
            data: {
                type: type,
                info: info
            }
        });
    }

    function onRecommendSeekpoint(milliseconds) {
        self.postMessage({
            msg: _transmuxingEvents2.default.RECOMMEND_SEEKPOINT,
            data: milliseconds
        });
    }

    function onLogcatCallback(type, str) {
        self.postMessage({
            msg: 'logcat_callback',
            data: {
                type: type,
                logcat: str
            }
        });
    }
}; /*
    * Copyright (C) 2016 Bilibili. All Rights Reserved.
    *
    * @author zheng qian <xqq@xqq.im>
    *
    * Licensed under the Apache License, Version 2.0 (the "License");
    * you may not use this file except in compliance with the License.
    * You may obtain a copy of the License at
    *
    *     http://www.apache.org/licenses/LICENSE-2.0
    *
    * Unless required by applicable law or agreed to in writing, software
    * distributed under the License is distributed on an "AS IS" BASIS,
    * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    * See the License for the specific language governing permissions and
    * limitations under the License.
    */

exports.default = TransmuxingWorker;

},{"../utils/logger.js":42,"../utils/logging-control.js":43,"../utils/polyfill.js":44,"./transmuxing-controller.js":13,"./transmuxing-events.js":14}],16:[function(_dereq_,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); /*
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * Copyright (C) 2016 Bilibili. All Rights Reserved.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * @author zheng qian <xqq@xqq.im>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * Licensed under the Apache License, Version 2.0 (the "License");
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * you may not use this file except in compliance with the License.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * You may obtain a copy of the License at
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *     http://www.apache.org/licenses/LICENSE-2.0
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * Unless required by applicable law or agreed to in writing, software
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * distributed under the License is distributed on an "AS IS" BASIS,
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * See the License for the specific language governing permissions and
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * limitations under the License.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      */

var _logger = _dereq_('../utils/logger.js');

var _logger2 = _interopRequireDefault(_logger);

var _utf8Conv = _dereq_('../utils/utf8-conv.js');

var _utf8Conv2 = _interopRequireDefault(_utf8Conv);

var _exception = _dereq_('../utils/exception.js');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var le = function () {
    var buf = new ArrayBuffer(2);
    new DataView(buf).setInt16(0, 256, true); // little-endian write
    return new Int16Array(buf)[0] === 256; // platform-spec read, if equal then LE
}();

var AMF = function () {
    function AMF() {
        _classCallCheck(this, AMF);
    }

    _createClass(AMF, null, [{
        key: 'parseScriptData',
        value: function parseScriptData(arrayBuffer, dataOffset, dataSize) {
            var data = {};

            try {
                var name = AMF.parseValue(arrayBuffer, dataOffset, dataSize);
                var value = AMF.parseValue(arrayBuffer, dataOffset + name.size, dataSize - name.size);

                data[name.data] = value.data;
            } catch (e) {
                _logger2.default.e('AMF', e.toString());
            }

            return data;
        }
    }, {
        key: 'parseObject',
        value: function parseObject(arrayBuffer, dataOffset, dataSize) {
            if (dataSize < 3) {
                throw new _exception.IllegalStateException('Data not enough when parse ScriptDataObject');
            }
            var name = AMF.parseString(arrayBuffer, dataOffset, dataSize);
            var value = AMF.parseValue(arrayBuffer, dataOffset + name.size, dataSize - name.size);
            var isObjectEnd = value.objectEnd;

            return {
                data: {
                    name: name.data,
                    value: value.data
                },
                size: name.size + value.size,
                objectEnd: isObjectEnd
            };
        }
    }, {
        key: 'parseVariable',
        value: function parseVariable(arrayBuffer, dataOffset, dataSize) {
            return AMF.parseObject(arrayBuffer, dataOffset, dataSize);
        }
    }, {
        key: 'parseString',
        value: function parseString(arrayBuffer, dataOffset, dataSize) {
            if (dataSize < 2) {
                throw new _exception.IllegalStateException('Data not enough when parse String');
            }
            var v = new DataView(arrayBuffer, dataOffset, dataSize);
            var length = v.getUint16(0, !le);

            var str = void 0;
            if (length > 0) {
                str = (0, _utf8Conv2.default)(new Uint8Array(arrayBuffer, dataOffset + 2, length));
            } else {
                str = '';
            }

            return {
                data: str,
                size: 2 + length
            };
        }
    }, {
        key: 'parseLongString',
        value: function parseLongString(arrayBuffer, dataOffset, dataSize) {
            if (dataSize < 4) {
                throw new _exception.IllegalStateException('Data not enough when parse LongString');
            }
            var v = new DataView(arrayBuffer, dataOffset, dataSize);
            var length = v.getUint32(0, !le);

            var str = void 0;
            if (length > 0) {
                str = (0, _utf8Conv2.default)(new Uint8Array(arrayBuffer, dataOffset + 4, length));
            } else {
                str = '';
            }

            return {
                data: str,
                size: 4 + length
            };
        }
    }, {
        key: 'parseDate',
        value: function parseDate(arrayBuffer, dataOffset, dataSize) {
            if (dataSize < 10) {
                throw new _exception.IllegalStateException('Data size invalid when parse Date');
            }
            var v = new DataView(arrayBuffer, dataOffset, dataSize);
            var timestamp = v.getFloat64(0, !le);
            var localTimeOffset = v.getInt16(8, !le);
            timestamp += localTimeOffset * 60 * 1000; // get UTC time

            return {
                data: new Date(timestamp),
                size: 8 + 2
            };
        }
    }, {
        key: 'parseValue',
        value: function parseValue(arrayBuffer, dataOffset, dataSize) {
            if (dataSize < 1) {
                throw new _exception.IllegalStateException('Data not enough when parse Value');
            }

            var v = new DataView(arrayBuffer, dataOffset, dataSize);

            var offset = 1;
            var type = v.getUint8(0);
            var value = void 0;
            var objectEnd = false;

            try {
                switch (type) {
                    case 0:
                        // Number(Double) type
                        value = v.getFloat64(1, !le);
                        offset += 8;
                        break;
                    case 1:
                        {
                            // Boolean type
                            var b = v.getUint8(1);
                            value = b ? true : false;
                            offset += 1;
                            break;
                        }
                    case 2:
                        {
                            // String type
                            var amfstr = AMF.parseString(arrayBuffer, dataOffset + 1, dataSize - 1);
                            value = amfstr.data;
                            offset += amfstr.size;
                            break;
                        }
                    case 3:
                        {
                            // Object(s) type
                            value = {};
                            var terminal = 0; // workaround for malformed Objects which has missing ScriptDataObjectEnd
                            if ((v.getUint32(dataSize - 4, !le) & 0x00FFFFFF) === 9) {
                                terminal = 3;
                            }
                            while (offset < dataSize - 4) {
                                // 4 === type(UI8) + ScriptDataObjectEnd(UI24)
                                var amfobj = AMF.parseObject(arrayBuffer, dataOffset + offset, dataSize - offset - terminal);
                                if (amfobj.objectEnd) break;
                                value[amfobj.data.name] = amfobj.data.value;
                                offset += amfobj.size;
                            }
                            if (offset <= dataSize - 3) {
                                var marker = v.getUint32(offset - 1, !le) & 0x00FFFFFF;
                                if (marker === 9) {
                                    offset += 3;
                                }
                            }
                            break;
                        }
                    case 8:
                        {
                            // ECMA array type (Mixed array)
                            value = {};
                            offset += 4; // ECMAArrayLength(UI32)
                            var _terminal = 0; // workaround for malformed MixedArrays which has missing ScriptDataObjectEnd
                            if ((v.getUint32(dataSize - 4, !le) & 0x00FFFFFF) === 9) {
                                _terminal = 3;
                            }
                            while (offset < dataSize - 8) {
                                // 8 === type(UI8) + ECMAArrayLength(UI32) + ScriptDataVariableEnd(UI24)
                                var amfvar = AMF.parseVariable(arrayBuffer, dataOffset + offset, dataSize - offset - _terminal);
                                if (amfvar.objectEnd) break;
                                value[amfvar.data.name] = amfvar.data.value;
                                offset += amfvar.size;
                            }
                            if (offset <= dataSize - 3) {
                                var _marker = v.getUint32(offset - 1, !le) & 0x00FFFFFF;
                                if (_marker === 9) {
                                    offset += 3;
                                }
                            }
                            break;
                        }
                    case 9:
                        // ScriptDataObjectEnd
                        value = undefined;
                        offset = 1;
                        objectEnd = true;
                        break;
                    case 10:
                        {
                            // Strict array type
                            // ScriptDataValue[n]. NOTE: according to video_file_format_spec_v10_1.pdf
                            value = [];
                            var strictArrayLength = v.getUint32(1, !le);
                            offset += 4;
                            for (var i = 0; i < strictArrayLength; i++) {
                                var val = AMF.parseValue(arrayBuffer, dataOffset + offset, dataSize - offset);
                                value.push(val.data);
                                offset += val.size;
                            }
                            break;
                        }
                    case 11:
                        {
                            // Date type
                            var date = AMF.parseDate(arrayBuffer, dataOffset + 1, dataSize - 1);
                            value = date.data;
                            offset += date.size;
                            break;
                        }
                    case 12:
                        {
                            // Long string type
                            var amfLongStr = AMF.parseString(arrayBuffer, dataOffset + 1, dataSize - 1);
                            value = amfLongStr.data;
                            offset += amfLongStr.size;
                            break;
                        }
                    default:
                        // ignore and skip
                        offset = dataSize;
                        _logger2.default.w('AMF', 'Unsupported AMF value type ' + type);
                }
            } catch (e) {
                _logger2.default.e('AMF', e.toString());
            }

            return {
                data: value,
                size: offset,
                objectEnd: objectEnd
            };
        }
    }]);

    return AMF;
}();

exports.default = AMF;

},{"../utils/exception.js":41,"../utils/logger.js":42,"../utils/utf8-conv.js":45}],17:[function(_dereq_,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
/*
 * Copyright (C) 2016 Bilibili. All Rights Reserved.
 *
 * @author zheng qian <xqq@xqq.im>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var DemuxErrors = {
  OK: 'OK',
  FORMAT_ERROR: 'FormatError',
  FORMAT_UNSUPPORTED: 'FormatUnsupported',
  CODEC_UNSUPPORTED: 'CodecUnsupported'
};

exports.default = DemuxErrors;

},{}],18:[function(_dereq_,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); /*
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * Copyright (C) 2016 Bilibili. All Rights Reserved.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * @author zheng qian <xqq@xqq.im>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * Licensed under the Apache License, Version 2.0 (the "License");
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * you may not use this file except in compliance with the License.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * You may obtain a copy of the License at
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *     http://www.apache.org/licenses/LICENSE-2.0
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * Unless required by applicable law or agreed to in writing, software
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * distributed under the License is distributed on an "AS IS" BASIS,
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * See the License for the specific language governing permissions and
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * limitations under the License.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      */

var _exception = _dereq_('../utils/exception.js');

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

// Exponential-Golomb buffer decoder
var ExpGolomb = function () {
    function ExpGolomb(uint8array) {
        _classCallCheck(this, ExpGolomb);

        this.TAG = 'ExpGolomb';

        this._buffer = uint8array;
        this._buffer_index = 0;
        this._total_bytes = uint8array.byteLength;
        this._total_bits = uint8array.byteLength * 8;
        this._current_word = 0;
        this._current_word_bits_left = 0;
    }

    _createClass(ExpGolomb, [{
        key: 'destroy',
        value: function destroy() {
            this._buffer = null;
        }
    }, {
        key: '_fillCurrentWord',
        value: function _fillCurrentWord() {
            var buffer_bytes_left = this._total_bytes - this._buffer_index;
            if (buffer_bytes_left <= 0) throw new _exception.IllegalStateException('ExpGolomb: _fillCurrentWord() but no bytes available');

            var bytes_read = Math.min(4, buffer_bytes_left);
            var word = new Uint8Array(4);
            word.set(this._buffer.subarray(this._buffer_index, this._buffer_index + bytes_read));
            this._current_word = new DataView(word.buffer).getUint32(0, false);

            this._buffer_index += bytes_read;
            this._current_word_bits_left = bytes_read * 8;
        }
    }, {
        key: 'readBits',
        value: function readBits(bits) {
            if (bits > 32) throw new _exception.InvalidArgumentException('ExpGolomb: readBits() bits exceeded max 32bits!');

            if (bits <= this._current_word_bits_left) {
                var _result = this._current_word >>> 32 - bits;
                this._current_word <<= bits;
                this._current_word_bits_left -= bits;
                return _result;
            }

            var result = this._current_word_bits_left ? this._current_word : 0;
            result = result >>> 32 - this._current_word_bits_left;
            var bits_need_left = bits - this._current_word_bits_left;

            this._fillCurrentWord();
            var bits_read_next = Math.min(bits_need_left, this._current_word_bits_left);

            var result2 = this._current_word >>> 32 - bits_read_next;
            this._current_word <<= bits_read_next;
            this._current_word_bits_left -= bits_read_next;

            result = result << bits_read_next | result2;
            return result;
        }
    }, {
        key: 'readBool',
        value: function readBool() {
            return this.readBits(1) === 1;
        }
    }, {
        key: 'readByte',
        value: function readByte() {
            return this.readBits(8);
        }
    }, {
        key: '_skipLeadingZero',
        value: function _skipLeadingZero() {
            var zero_count = void 0;
            for (zero_count = 0; zero_count < this._current_word_bits_left; zero_count++) {
                if (0 !== (this._current_word & 0x80000000 >>> zero_count)) {
                    this._current_word <<= zero_count;
                    this._current_word_bits_left -= zero_count;
                    return zero_count;
                }
            }
            this._fillCurrentWord();
            return zero_count + this._skipLeadingZero();
        }
    }, {
        key: 'readUEG',
        value: function readUEG() {
            // unsigned exponential golomb
            var leading_zeros = this._skipLeadingZero();
            return this.readBits(leading_zeros + 1) - 1;
        }
    }, {
        key: 'readSEG',
        value: function readSEG() {
            // signed exponential golomb
            var value = this.readUEG();
            if (value & 0x01) {
                return value + 1 >>> 1;
            } else {
                return -1 * (value >>> 1);
            }
        }
    }]);

    return ExpGolomb;
}();

exports.default = ExpGolomb;

},{"../utils/exception.js":41}],19:[function(_dereq_,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); /*
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * Copyright (C) 2016 Bilibili. All Rights Reserved.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * @author zheng qian <xqq@xqq.im>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * Licensed under the Apache License, Version 2.0 (the "License");
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * you may not use this file except in compliance with the License.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * You may obtain a copy of the License at
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *     http://www.apache.org/licenses/LICENSE-2.0
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * Unless required by applicable law or agreed to in writing, software
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * distributed under the License is distributed on an "AS IS" BASIS,
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * See the License for the specific language governing permissions and
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * limitations under the License
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      */

var _logger = _dereq_('../utils/logger.js');

var _logger2 = _interopRequireDefault(_logger);

var _amfParser = _dereq_('./amf-parser.js');

var _amfParser2 = _interopRequireDefault(_amfParser);

var _spsParser = _dereq_('./sps-parser.js');

var _spsParser2 = _interopRequireDefault(_spsParser);

var _demuxErrors = _dereq_('./demux-errors.js');

var _demuxErrors2 = _interopRequireDefault(_demuxErrors);

var _mediaInfo = _dereq_('../core/media-info.js');

var _mediaInfo2 = _interopRequireDefault(_mediaInfo);

var _exception = _dereq_('../utils/exception.js');

var _aesJs = _dereq_('aes-js');

var _aesJs2 = _interopRequireDefault(_aesJs);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function Swap16(src) {
  return src >>> 8 & 0xff | (src & 0xff) << 8;
}

function Swap32(src) {
  return (src & 0xff000000) >>> 24 | (src & 0x00ff0000) >>> 8 | (src & 0x0000ff00) << 8 | (src & 0x000000ff) << 24;
}

function ReadBig32(array, index) {
  return array[index] << 24 | array[index + 1] << 16 | array[index + 2] << 8 | array[index + 3];
}

var FLVDemuxer = function () {
  function FLVDemuxer(probeData, config) {
    _classCallCheck(this, FLVDemuxer);

    this.TAG = 'FLVDemuxer';

    this._config = config;
    // 新增
    this._lastdts = 0;

    // To zhengfeifei
    this._onMessageDx = null;

    this._onError = null;
    this._onMediaInfo = null;
    this._onMetaDataArrived = null;
    this._onTrackMetadata = null;
    this._onDataAvailable = null;

    this._dataOffset = probeData.dataOffset;
    this._firstParse = true;
    this._dispatch = false;

    this._hasAudio = probeData.hasAudioTrack;
    this._hasVideo = probeData.hasVideoTrack;

    this._hasAudioFlagOverrided = false;
    this._hasVideoFlagOverrided = false;

    this._audioInitialMetadataDispatched = false;
    this._videoInitialMetadataDispatched = false;

    this._mediaInfo = new _mediaInfo2.default();
    this._mediaInfo.hasAudio = this._hasAudio;
    this._mediaInfo.hasVideo = this._hasVideo;
    this._metadata = null;
    this._audioMetadata = null;
    this._videoMetadata = null;

    this._naluLengthSize = 4;
    this._timestampBase = 0; // int32, in milliseconds
    this._timescale = 1000;
    this._duration = 0; // int32, in milliseconds
    this._durationOverrided = false;
    this._referenceFrameRate = {
      fixed: true,
      fps: 23.976,
      fps_num: 23976,
      fps_den: 1000
    };

    this._encryptkey = [0x6a, 0x7c, 0xbb, 0x91, 0xaf, 0x73, 0x01, 0xa3, 0x5a, 0xcf, 0x5b, 0x35, 0xa2, 0x5f, 0x98, 0xdf];
    this._flvSoundRateTable = [5500, 11025, 22050, 44100, 48000];

    this._mpegSamplingRates = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350];

    this._mpegAudioV10SampleRateTable = [44100, 48000, 32000, 0];
    this._mpegAudioV20SampleRateTable = [22050, 24000, 16000, 0];
    this._mpegAudioV25SampleRateTable = [11025, 12000, 8000, 0];

    this._mpegAudioL1BitRateTable = [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448, -1];
    this._mpegAudioL2BitRateTable = [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384, -1];
    this._mpegAudioL3BitRateTable = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, -1];

    this._videoTrack = {
      type: 'video',
      id: 1,
      sequenceNumber: 0,
      samples: [],
      length: 0
    };
    this._audioTrack = {
      type: 'audio',
      id: 2,
      sequenceNumber: 0,
      samples: [],
      length: 0
    };

    /* eslint-disable space-before-function-paren */
    this._littleEndian = function () {
      var buf = new ArrayBuffer(2);
      new DataView(buf).setInt16(0, 256, true); // little-endian write
      return new Int16Array(buf)[0] === 256; // platform-spec read, if equal then LE
    }();
  }

  _createClass(FLVDemuxer, [{
    key: 'destroy',
    value: function destroy() {
      this._mediaInfo = null;
      this._metadata = null;
      this._audioMetadata = null;
      this._videoMetadata = null;
      this._videoTrack = null;
      this._audioTrack = null;

      this._onError = null;
      this._onMediaInfo = null;
      this._onMetaDataArrived = null;
      this._onTrackMetadata = null;
      this._onDataAvailable = null;
    }
  }, {
    key: 'bindDataSource',
    value: function bindDataSource(loader) {
      loader.onDataArrival = this.parseChunks.bind(this);
      return this;
    }

    // prototype: function(type: string, metadata: any): void

  }, {
    key: 'resetMediaInfo',
    value: function resetMediaInfo() {
      this._mediaInfo = new _mediaInfo2.default();
    }
  }, {
    key: '_isInitialMetadataDispatched',
    value: function _isInitialMetadataDispatched() {
      if (this._hasAudio && this._hasVideo) {
        // both audio & video
        return this._audioInitialMetadataDispatched && this._videoInitialMetadataDispatched;
      }
      if (this._hasAudio && !this._hasVideo) {
        // audio only
        return this._audioInitialMetadataDispatched;
      }
      if (!this._hasAudio && this._hasVideo) {
        // video only
        return this._videoInitialMetadataDispatched;
      }
      return false;
    }

    // function parseChunks(chunk: ArrayBuffer, byteStart: number): number;

  }, {
    key: 'parseChunks',
    value: function parseChunks(chunk, byteStart) {
      if (!this._onError || !this._onMediaInfo || !this._onTrackMetadata || !this._onDataAvailable) {
        throw new _exception.IllegalStateException('Flv: onError & onMediaInfo & onTrackMetadata & onDataAvailable callback must be specified');
      }

      var offset = 0;
      var le = this._littleEndian;

      if (byteStart === 0) {
        // buffer with FLV header
        if (chunk.byteLength > 13) {
          var probeData = FLVDemuxer.probe(chunk);
          offset = probeData.dataOffset;
        } else {
          return 0;
        }
      }

      if (this._firstParse) {
        // handle PreviousTagSize0 before Tag1
        this._firstParse = false;
        if (byteStart + offset !== this._dataOffset) {
          _logger2.default.w(this.TAG, 'First time parsing but chunk byteStart invalid!');
        }

        var v = new DataView(chunk, offset);
        var prevTagSize0 = v.getUint32(0, !le);
        if (prevTagSize0 !== 0) {
          _logger2.default.w(this.TAG, 'PrevTagSize0 !== 0 !!!');
        }
        offset += 4;
      }

      while (offset < chunk.byteLength) {
        this._dispatch = true;

        var _v = new DataView(chunk, offset);

        if (offset + 11 + 4 > chunk.byteLength) {
          // data not enough for parsing an flv tag
          break;
        }

        var tagType = _v.getUint8(0);
        var dataSize = _v.getUint32(0, !le) & 0x00ffffff;

        if (offset + 11 + dataSize + 4 > chunk.byteLength) {
          // data not enough for parsing actual data body
          break;
        }

        if (tagType !== 8 && tagType !== 9 && tagType !== 18) {
          _logger2.default.w(this.TAG, 'Unsupported tag type ' + tagType + ', skipped');
          // consume the whole tag (skip it)
          offset += 11 + dataSize + 4;
          continue;
        }

        var ts2 = _v.getUint8(4);
        var ts1 = _v.getUint8(5);
        var ts0 = _v.getUint8(6);
        var ts3 = _v.getUint8(7);

        var timestamp = ts0 | ts1 << 8 | ts2 << 16 | ts3 << 24;

        var streamId = _v.getUint32(7, !le) & 0x00ffffff;
        if (streamId !== 0) {
          _logger2.default.w(this.TAG, 'Meet tag which has StreamID != 0!');
        }

        var dataOffset = offset + 11;

        switch (tagType) {
          case 8:
            // Audio
            this._parseAudioData(chunk, dataOffset, dataSize, timestamp);
            break;
          case 9:
            // Video
            this._parseVideoData(chunk, dataOffset, dataSize, timestamp, byteStart + offset);
            break;
          case 18:
            // ScriptDataObject
            this._parseScriptData(chunk, dataOffset, dataSize);
            break;
        }

        var prevTagSize = _v.getUint32(11 + dataSize, !le);
        if (prevTagSize !== 11 + dataSize) {
          _logger2.default.w(this.TAG, 'Invalid PrevTagSize ' + prevTagSize);
        }

        offset += 11 + dataSize + 4; // tagBody + dataSize + prevTagSize
      }

      // dispatch parsed frames to consumer (typically, the remuxer)
      if (this._isInitialMetadataDispatched()) {
        if (this._dispatch && (this._audioTrack.length || this._videoTrack.length)) {
          this._onDataAvailable(this._audioTrack, this._videoTrack);
        }
      }

      return offset; // consumed bytes, just equals latest offset index
    }
  }, {
    key: '_parseScriptData',
    value: function _parseScriptData(arrayBuffer, dataOffset, dataSize) {
      var scriptData = _amfParser2.default.parseScriptData(arrayBuffer, dataOffset, dataSize);

      if (scriptData.hasOwnProperty('onMetaData')) {
        if (scriptData.onMetaData == null || _typeof(scriptData.onMetaData) !== 'object') {
          _logger2.default.w(this.TAG, 'Invalid onMetaData structure!');
          return;
        }
        if (this._metadata) {
          _logger2.default.w(this.TAG, 'Found another onMetaData tag!');
        }
        this._metadata = scriptData;
        var onMetaData = this._metadata.onMetaData;

        if (this._onMetaDataArrived) {
          this._onMetaDataArrived(Object.assign({}, onMetaData));
        }

        if (typeof onMetaData.hasAudio === 'boolean') {
          // hasAudio
          if (this._hasAudioFlagOverrided === false) {
            this._hasAudio = onMetaData.hasAudio;
            this._mediaInfo.hasAudio = this._hasAudio;
          }
        }
        if (typeof onMetaData.hasVideo === 'boolean') {
          // hasVideo
          if (this._hasVideoFlagOverrided === false) {
            this._hasVideo = onMetaData.hasVideo;
            this._mediaInfo.hasVideo = this._hasVideo;
          }
        }
        if (typeof onMetaData.audiodatarate === 'number') {
          // audiodatarate
          this._mediaInfo.audioDataRate = onMetaData.audiodatarate;
        }
        if (typeof onMetaData.videodatarate === 'number') {
          // videodatarate
          this._mediaInfo.videoDataRate = onMetaData.videodatarate;
        }
        if (typeof onMetaData.width === 'number') {
          // width
          this._mediaInfo.width = onMetaData.width;
        }
        if (typeof onMetaData.height === 'number') {
          // height
          this._mediaInfo.height = onMetaData.height;
        }
        if (typeof onMetaData.duration === 'number') {
          // duration
          if (!this._durationOverrided) {
            var duration = Math.floor(onMetaData.duration * this._timescale);
            this._duration = duration;
            this._mediaInfo.duration = duration;
          }
        } else {
          this._mediaInfo.duration = 0;
        }
        if (typeof onMetaData.framerate === 'number') {
          // framerate
          var fps_num = Math.floor(onMetaData.framerate * 1000);
          if (fps_num > 0) {
            var fps = fps_num / 1000;
            this._referenceFrameRate.fixed = true;
            this._referenceFrameRate.fps = fps;
            this._referenceFrameRate.fps_num = fps_num;
            this._referenceFrameRate.fps_den = 1000;
            this._mediaInfo.fps = fps;
          }
        }
        if (_typeof(onMetaData.keyframes) === 'object') {
          // keyframes
          this._mediaInfo.hasKeyframesIndex = true;
          var keyframes = onMetaData.keyframes;
          this._mediaInfo.keyframesIndex = this._parseKeyframesIndex(keyframes);
          onMetaData.keyframes = null; // keyframes has been extracted, remove it
        } else {
          this._mediaInfo.hasKeyframesIndex = false;
        }
        this._dispatch = false;
        this._mediaInfo.metadata = onMetaData;
        _logger2.default.v(this.TAG, 'Parsed onMetaData');
        if (this._mediaInfo.isComplete()) {
          this._onMediaInfo(this._mediaInfo);
        }
      }
    }
  }, {
    key: '_parseKeyframesIndex',
    value: function _parseKeyframesIndex(keyframes) {
      var times = [];
      var filepositions = [];

      // ignore first keyframe which is actually AVC Sequence Header (AVCDecoderConfigurationRecord)
      for (var i = 1; i < keyframes.times.length; i++) {
        var time = this._timestampBase + Math.floor(keyframes.times[i] * 1000);
        times.push(time);
        filepositions.push(keyframes.filepositions[i]);
      }

      return {
        times: times,
        filepositions: filepositions
      };
    }
  }, {
    key: '_parseAudioData',
    value: function _parseAudioData(arrayBuffer, dataOffset, dataSize, tagTimestamp) {
      if (dataSize <= 1) {
        _logger2.default.w(this.TAG, 'Flv: Invalid audio packet, missing SoundData payload!');
        return;
      }

      if (this._hasAudioFlagOverrided === true && this._hasAudio === false) {
        // If hasAudio: false indicated explicitly in MediaDataSource,
        // Ignore all the audio packets
        return;
      }

      var le = this._littleEndian;
      var v = new DataView(arrayBuffer, dataOffset, dataSize);

      var soundSpec = v.getUint8(0);

      var soundFormat = soundSpec >>> 4;
      if (soundFormat !== 2 && soundFormat !== 10) {
        // MP3 or AAC
        this._onError(_demuxErrors2.default.CODEC_UNSUPPORTED, 'Flv: Unsupported audio codec idx: ' + soundFormat);
        return;
      }

      var soundRate = 0;
      var soundRateIndex = (soundSpec & 12) >>> 2;
      if (soundRateIndex >= 0 && soundRateIndex <= 4) {
        soundRate = this._flvSoundRateTable[soundRateIndex];
      } else {
        this._onError(_demuxErrors2.default.FORMAT_ERROR, 'Flv: Invalid audio sample rate idx: ' + soundRateIndex);
        return;
      }

      var soundSize = (soundSpec & 2) >>> 1; // unused
      var soundType = soundSpec & 1;

      var meta = this._audioMetadata;
      var track = this._audioTrack;

      if (!meta) {
        if (this._hasAudio === false && this._hasAudioFlagOverrided === false) {
          this._hasAudio = true;
          this._mediaInfo.hasAudio = true;
        }

        // initial metadata
        meta = this._audioMetadata = {};
        meta.type = 'audio';
        meta.id = track.id;
        meta.timescale = this._timescale;
        meta.duration = this._duration;
        meta.audioSampleRate = soundRate;
        meta.channelCount = soundType === 0 ? 1 : 2;
      }

      if (soundFormat === 10) {
        // AAC
        var aacData = this._parseAACAudioData(arrayBuffer, dataOffset + 1, dataSize - 1);
        if (aacData == undefined) {
          return;
        }

        if (aacData.packetType === 0) {
          // AAC sequence header (AudioSpecificConfig)
          if (meta.config) {
            _logger2.default.w(this.TAG, 'Found another AudioSpecificConfig!');
          }
          var misc = aacData.data;
          meta.audioSampleRate = misc.samplingRate;
          meta.channelCount = misc.channelCount;
          meta.codec = misc.codec;
          meta.originalCodec = misc.originalCodec;
          meta.config = misc.config;
          // The decode result of an aac sample is 1024 PCM samples
          meta.refSampleDuration = 1024 / meta.audioSampleRate * meta.timescale;
          _logger2.default.v(this.TAG, 'Parsed AudioSpecificConfig');

          if (this._isInitialMetadataDispatched()) {
            // Non-initial metadata, force dispatch (or flush) parsed frames to remuxer
            if (this._dispatch && (this._audioTrack.length || this._videoTrack.length)) {
              this._onDataAvailable(this._audioTrack, this._videoTrack);
            }
          } else {
            this._audioInitialMetadataDispatched = true;
          }
          // then notify new metadata
          this._dispatch = false;
          this._onTrackMetadata('audio', meta);

          var mi = this._mediaInfo;
          mi.audioCodec = meta.originalCodec;
          mi.audioSampleRate = meta.audioSampleRate;
          mi.audioChannelCount = meta.channelCount;
          if (mi.hasVideo) {
            if (mi.videoCodec != null) {
              mi.mimeType = 'video/x-flv; codecs="' + mi.videoCodec + ',' + mi.audioCodec + '"';
            }
          } else {
            mi.mimeType = 'video/x-flv; codecs="' + mi.audioCodec + '"';
          }
          if (mi.isComplete()) {
            this._onMediaInfo(mi);
          }
        } else if (aacData.packetType === 1) {
          // AAC raw frame data
          var dts = this._timestampBase + tagTimestamp;
          var aacSample = {
            unit: aacData.data,
            length: aacData.data.byteLength,
            dts: dts,
            pts: dts
          };
          track.samples.push(aacSample);
          track.length += aacData.data.length;
        } else {
          _logger2.default.e(this.TAG, 'Flv: Unsupported AAC data type ' + aacData.packetType);
        }
      } else if (soundFormat === 2) {
        // MP3
        if (!meta.codec) {
          // We need metadata for mp3 audio track, extract info from frame header
          var _misc = this._parseMP3AudioData(arrayBuffer, dataOffset + 1, dataSize - 1, true);
          if (_misc == undefined) {
            return;
          }
          meta.audioSampleRate = _misc.samplingRate;
          meta.channelCount = _misc.channelCount;
          meta.codec = _misc.codec;
          meta.originalCodec = _misc.originalCodec;
          // The decode result of an mp3 sample is 1152 PCM samples
          meta.refSampleDuration = 1152 / meta.audioSampleRate * meta.timescale;
          _logger2.default.v(this.TAG, 'Parsed MPEG Audio Frame Header');

          this._audioInitialMetadataDispatched = true;
          this._onTrackMetadata('audio', meta);

          var _mi = this._mediaInfo;
          _mi.audioCodec = meta.codec;
          _mi.audioSampleRate = meta.audioSampleRate;
          _mi.audioChannelCount = meta.channelCount;
          _mi.audioDataRate = _misc.bitRate;
          if (_mi.hasVideo) {
            if (_mi.videoCodec != null) {
              _mi.mimeType = 'video/x-flv; codecs="' + _mi.videoCodec + ',' + _mi.audioCodec + '"';
            }
          } else {
            _mi.mimeType = 'video/x-flv; codecs="' + _mi.audioCodec + '"';
          }
          if (_mi.isComplete()) {
            this._onMediaInfo(_mi);
          }
        }

        // This packet is always a valid audio packet, extract it
        var data = this._parseMP3AudioData(arrayBuffer, dataOffset + 1, dataSize - 1, false);
        if (data == undefined) {
          return;
        }
        var _dts = this._timestampBase + tagTimestamp;
        var mp3Sample = {
          unit: data,
          length: data.byteLength,
          dts: _dts,
          pts: _dts
        };
        track.samples.push(mp3Sample);
        track.length += data.length;
      }
    }
  }, {
    key: '_parseAACAudioData',
    value: function _parseAACAudioData(arrayBuffer, dataOffset, dataSize) {
      if (dataSize <= 1) {
        _logger2.default.w(this.TAG, 'Flv: Invalid AAC packet, missing AACPacketType or/and Data!');
        return;
      }

      var result = {};
      var array = new Uint8Array(arrayBuffer, dataOffset, dataSize);

      result.packetType = array[0];

      if (array[0] === 0) {
        result.data = this._parseAACAudioSpecificConfig(arrayBuffer, dataOffset + 1, dataSize - 1);
      } else {
        result.data = array.subarray(1);
      }

      return result;
    }
  }, {
    key: '_parseAACAudioSpecificConfig',
    value: function _parseAACAudioSpecificConfig(arrayBuffer, dataOffset, dataSize) {
      var array = new Uint8Array(arrayBuffer, dataOffset, dataSize);
      var config = null;

      /* Audio Object Type:
             0: Null
             1: AAC Main
             2: AAC LC
             3: AAC SSR (Scalable Sample Rate)
             4: AAC LTP (Long Term Prediction)
             5: HE-AAC / SBR (Spectral Band Replication)
             6: AAC Scalable
          */

      var audioObjectType = 0;
      var originalAudioObjectType = 0;
      var audioExtensionObjectType = null;
      var samplingIndex = 0;
      var extensionSamplingIndex = null;

      // 5 bits
      audioObjectType = originalAudioObjectType = array[0] >>> 3;
      // 4 bits
      samplingIndex = (array[0] & 0x07) << 1 | array[1] >>> 7;
      if (samplingIndex < 0 || samplingIndex >= this._mpegSamplingRates.length) {
        this._onError(_demuxErrors2.default.FORMAT_ERROR, 'Flv: AAC invalid sampling frequency index!');
        return;
      }

      var samplingFrequence = this._mpegSamplingRates[samplingIndex];

      // 4 bits
      var channelConfig = (array[1] & 0x78) >>> 3;
      if (channelConfig < 0 || channelConfig >= 8) {
        this._onError(_demuxErrors2.default.FORMAT_ERROR, 'Flv: AAC invalid channel configuration');
        return;
      }

      if (audioObjectType === 5) {
        // HE-AAC?
        // 4 bits
        extensionSamplingIndex = (array[1] & 0x07) << 1 | array[2] >>> 7;
        // 5 bits
        audioExtensionObjectType = (array[2] & 0x7c) >>> 2;
      }

      // workarounds for various browsers
      var userAgent = self.navigator.userAgent.toLowerCase();

      if (userAgent.indexOf('firefox') !== -1) {
        // firefox: use SBR (HE-AAC) if freq less than 24kHz
        if (samplingIndex >= 6) {
          audioObjectType = 5;
          config = new Array(4);
          extensionSamplingIndex = samplingIndex - 3;
        } else {
          // use LC-AAC
          audioObjectType = 2;
          config = new Array(2);
          extensionSamplingIndex = samplingIndex;
        }
      } else if (userAgent.indexOf('android') !== -1) {
        // android: always use LC-AAC
        audioObjectType = 2;
        config = new Array(2);
        extensionSamplingIndex = samplingIndex;
      } else {
        // for other browsers, e.g. chrome...
        // Always use HE-AAC to make it easier to switch aac codec profile
        audioObjectType = 5;
        extensionSamplingIndex = samplingIndex;
        config = new Array(4);

        if (samplingIndex >= 6) {
          extensionSamplingIndex = samplingIndex - 3;
        } else if (channelConfig === 1) {
          // Mono channel
          audioObjectType = 2;
          config = new Array(2);
          extensionSamplingIndex = samplingIndex;
        }
      }

      config[0] = audioObjectType << 3;
      config[0] |= (samplingIndex & 0x0f) >>> 1;
      config[1] = (samplingIndex & 0x0f) << 7;
      config[1] |= (channelConfig & 0x0f) << 3;
      if (audioObjectType === 5) {
        config[1] |= (extensionSamplingIndex & 0x0f) >>> 1;
        config[2] = (extensionSamplingIndex & 0x01) << 7;
        // extended audio object type: force to 2 (LC-AAC)
        config[2] |= 2 << 2;
        config[3] = 0;
      }

      return {
        config: config,
        samplingRate: samplingFrequence,
        channelCount: channelConfig,
        codec: 'mp4a.40.' + audioObjectType,
        originalCodec: 'mp4a.40.' + originalAudioObjectType
      };
    }
  }, {
    key: '_parseMP3AudioData',
    value: function _parseMP3AudioData(arrayBuffer, dataOffset, dataSize, requestHeader) {
      if (dataSize < 4) {
        _logger2.default.w(this.TAG, 'Flv: Invalid MP3 packet, header missing!');
        return;
      }

      var le = this._littleEndian;
      var array = new Uint8Array(arrayBuffer, dataOffset, dataSize);
      var result = null;

      if (requestHeader) {
        if (array[0] !== 0xff) {
          return;
        }
        var ver = array[1] >>> 3 & 0x03;
        var layer = (array[1] & 0x06) >> 1;

        var bitrate_index = (array[2] & 0xf0) >>> 4;
        var sampling_freq_index = (array[2] & 0x0c) >>> 2;

        var channel_mode = array[3] >>> 6 & 0x03;
        var channel_count = channel_mode !== 3 ? 2 : 1;

        var sample_rate = 0;
        var bit_rate = 0;
        var object_type = 34; // Layer-3, listed in MPEG-4 Audio Object Types

        var codec = 'mp3';

        switch (ver) {
          case 0:
            // MPEG 2.5
            sample_rate = this._mpegAudioV25SampleRateTable[sampling_freq_index];
            break;
          case 2:
            // MPEG 2
            sample_rate = this._mpegAudioV20SampleRateTable[sampling_freq_index];
            break;
          case 3:
            // MPEG 1
            sample_rate = this._mpegAudioV10SampleRateTable[sampling_freq_index];
            break;
        }

        switch (layer) {
          case 1:
            // Layer 3
            object_type = 34;
            if (bitrate_index < this._mpegAudioL3BitRateTable.length) {
              bit_rate = this._mpegAudioL3BitRateTable[bitrate_index];
            }
            break;
          case 2:
            // Layer 2
            object_type = 33;
            if (bitrate_index < this._mpegAudioL2BitRateTable.length) {
              bit_rate = this._mpegAudioL2BitRateTable[bitrate_index];
            }
            break;
          case 3:
            // Layer 1
            object_type = 32;
            if (bitrate_index < this._mpegAudioL1BitRateTable.length) {
              bit_rate = this._mpegAudioL1BitRateTable[bitrate_index];
            }
            break;
        }

        result = {
          bitRate: bit_rate,
          samplingRate: sample_rate,
          channelCount: channel_count,
          codec: codec,
          originalCodec: codec
        };
      } else {
        result = array;
      }

      return result;
    }
  }, {
    key: '_parseVideoData',
    value: function _parseVideoData(arrayBuffer, dataOffset, dataSize, tagTimestamp, tagPosition) {
      if (dataSize <= 1) {
        _logger2.default.w(this.TAG, 'Flv: Invalid video packet, missing VideoData payload!');
        return;
      }

      if (this._hasVideoFlagOverrided === true && this._hasVideo === false) {
        // If hasVideo: false indicated explicitly in MediaDataSource,
        // Ignore all the video packets
        return;
      }

      var spec = new Uint8Array(arrayBuffer, dataOffset, dataSize)[0];

      var frameType = (spec & 240) >>> 4;
      var codecId = spec & 15;

      this._onMessageDx(codecId);

      if (codecId !== 7) {
        this._onError(_demuxErrors2.default.CODEC_UNSUPPORTED, 'Flv: Unsupported codec in video frame: ' + codecId);
        return;
      }

      this._parseAVCVideoPacket(arrayBuffer, dataOffset + 1, dataSize - 1, tagTimestamp, tagPosition, frameType);
    }
  }, {
    key: '_parseAVCVideoPacket',
    value: function _parseAVCVideoPacket(arrayBuffer, dataOffset, dataSize, tagTimestamp, tagPosition, frameType) {
      if (dataSize < 4) {
        _logger2.default.w(this.TAG, 'Flv: Invalid AVC packet, missing AVCPacketType or/and CompositionTime');
        return;
      }

      var le = this._littleEndian;
      var v = new DataView(arrayBuffer, dataOffset, dataSize);

      var packetType = v.getUint8(0);
      var cts_unsigned = v.getUint32(0, !le) & 0x00ffffff;
      var cts = cts_unsigned << 8 >> 8; // convert to 24-bit signed int

      if (packetType === 0) {
        // AVCDecoderConfigurationRecord
        this._parseAVCDecoderConfigurationRecord(arrayBuffer, dataOffset + 4, dataSize - 4);
      } else if (packetType === 1) {
        // One or more Nalus
        this._parseAVCVideoData(arrayBuffer, dataOffset + 4, dataSize - 4, tagTimestamp, tagPosition, frameType, cts);
      } else if (packetType === 2) {
        // empty, AVC end of sequence
      } else {
        this._onError(_demuxErrors2.default.FORMAT_ERROR, 'Flv: Invalid video packet type ' + packetType);
        return;
      }
    }
  }, {
    key: '_parseAVCDecoderConfigurationRecord',
    value: function _parseAVCDecoderConfigurationRecord(arrayBuffer, dataOffset, dataSize) {
      if (dataSize < 7) {
        _logger2.default.w(this.TAG, 'Flv: Invalid AVCDecoderConfigurationRecord, lack of data!');
        return;
      }

      var meta = this._videoMetadata;
      var track = this._videoTrack;
      var le = this._littleEndian;
      var v = new DataView(arrayBuffer, dataOffset, dataSize);

      if (!meta) {
        if (this._hasVideo === false && this._hasVideoFlagOverrided === false) {
          this._hasVideo = true;
          this._mediaInfo.hasVideo = true;
        }

        meta = this._videoMetadata = {};
        meta.type = 'video';
        meta.id = track.id;
        meta.timescale = this._timescale;
        meta.duration = this._duration;
      } else {
        if (typeof meta.avcc !== 'undefined') {
          _logger2.default.w(this.TAG, 'Found another AVCDecoderConfigurationRecord!');
        }
      }

      var version = v.getUint8(0); // configurationVersion
      var avcProfile = v.getUint8(1); // avcProfileIndication
      var profileCompatibility = v.getUint8(2); // profile_compatibility
      var avcLevel = v.getUint8(3); // AVCLevelIndication

      if (version !== 1 || avcProfile === 0) {
        this._onError(_demuxErrors2.default.FORMAT_ERROR, 'Flv: Invalid AVCDecoderConfigurationRecord');
        return;
      }

      this._naluLengthSize = (v.getUint8(4) & 3) + 1; // lengthSizeMinusOne
      if (this._naluLengthSize !== 3 && this._naluLengthSize !== 4) {
        // holy shit!!!
        this._onError(_demuxErrors2.default.FORMAT_ERROR, 'Flv: Strange NaluLengthSizeMinusOne: ' + (this._naluLengthSize - 1));
        return;
      }

      var spsCount = v.getUint8(5) & 31; // numOfSequenceParameterSets
      if (spsCount === 0) {
        this._onError(_demuxErrors2.default.FORMAT_ERROR, 'Flv: Invalid AVCDecoderConfigurationRecord: No SPS');
        return;
      } else if (spsCount > 1) {
        _logger2.default.w(this.TAG, 'Flv: Strange AVCDecoderConfigurationRecord: SPS Count = ' + spsCount);
      }

      var offset = 6;

      for (var i = 0; i < spsCount; i++) {
        var len = v.getUint16(offset, !le); // sequenceParameterSetLength
        offset += 2;

        if (len === 0) {
          continue;
        }

        // Notice: Nalu without startcode header (00 00 00 01)
        var sps = new Uint8Array(arrayBuffer, dataOffset + offset, len);
        offset += len;

        var config = _spsParser2.default.parseSPS(sps);
        if (i !== 0) {
          // ignore other sps's config
          continue;
        }

        meta.codecWidth = config.codec_size.width;
        meta.codecHeight = config.codec_size.height;
        meta.presentWidth = config.present_size.width;
        meta.presentHeight = config.present_size.height;

        meta.profile = config.profile_string;
        meta.level = config.level_string;
        meta.bitDepth = config.bit_depth;
        meta.chromaFormat = config.chroma_format;
        meta.sarRatio = config.sar_ratio;
        meta.frameRate = config.frame_rate;

        if (config.frame_rate.fixed === false || config.frame_rate.fps_num === 0 || config.frame_rate.fps_den === 0) {
          meta.frameRate = this._referenceFrameRate;
        }

        var fps_den = meta.frameRate.fps_den;
        var fps_num = meta.frameRate.fps_num;
        meta.refSampleDuration = meta.timescale * (fps_den / fps_num);

        var codecArray = sps.subarray(1, 4);
        var codecString = 'avc1.';
        for (var j = 0; j < 3; j++) {
          var h = codecArray[j].toString(16);
          if (h.length < 2) {
            h = '0' + h;
          }
          codecString += h;
        }
        meta.codec = codecString;

        var mi = this._mediaInfo;
        mi.width = meta.codecWidth;
        mi.height = meta.codecHeight;
        mi.fps = meta.frameRate.fps;
        mi.profile = meta.profile;
        mi.level = meta.level;
        mi.refFrames = config.ref_frames;
        mi.chromaFormat = config.chroma_format_string;
        mi.sarNum = meta.sarRatio.width;
        mi.sarDen = meta.sarRatio.height;
        mi.videoCodec = codecString;

        if (mi.hasAudio) {
          if (mi.audioCodec != null) {
            mi.mimeType = 'video/x-flv; codecs="' + mi.videoCodec + ',' + mi.audioCodec + '"';
          }
        } else {
          mi.mimeType = 'video/x-flv; codecs="' + mi.videoCodec + '"';
        }
        if (mi.isComplete()) {
          this._onMediaInfo(mi);
        }
      }

      var ppsCount = v.getUint8(offset); // numOfPictureParameterSets
      if (ppsCount === 0) {
        this._onError(_demuxErrors2.default.FORMAT_ERROR, 'Flv: Invalid AVCDecoderConfigurationRecord: No PPS');
        return;
      } else if (ppsCount > 1) {
        _logger2.default.w(this.TAG, 'Flv: Strange AVCDecoderConfigurationRecord: PPS Count = ' + ppsCount);
      }

      offset++;

      for (var _i = 0; _i < ppsCount; _i++) {
        var _len = v.getUint16(offset, !le); // pictureParameterSetLength
        offset += 2;

        if (_len === 0) {
          continue;
        }

        // pps is useless for extracting video information
        offset += _len;
      }

      meta.avcc = new Uint8Array(dataSize);
      meta.avcc.set(new Uint8Array(arrayBuffer, dataOffset, dataSize), 0);
      _logger2.default.v(this.TAG, 'Parsed AVCDecoderConfigurationRecord');

      if (this._isInitialMetadataDispatched()) {
        // flush parsed frames
        if (this._dispatch && (this._audioTrack.length || this._videoTrack.length)) {
          this._onDataAvailable(this._audioTrack, this._videoTrack);
        }
      } else {
        this._videoInitialMetadataDispatched = true;
      }
      // notify new metadata
      this._dispatch = false;
      this._onTrackMetadata('video', meta);
    }
  }, {
    key: '_parseAVCVideoData',
    value: function _parseAVCVideoData(arrayBuffer, dataOffset, dataSize, tagTimestamp, tagPosition, frameType, cts) {
      var le = this._littleEndian;
      var v = new DataView(arrayBuffer, dataOffset, dataSize);

      var units = [],
          length = 0;

      var offset = 0;
      var lengthSize = this._naluLengthSize;
      var dts = this._timestampBase + tagTimestamp;

      if (this._config.isCigLocalRecord) {
        // 只有在 cig 盒子本地录像调阅查看录像时，需要开启这个选项，其他情况请别开启
        // let dts = this._timestampBase + tagTimestamp;
        // 解决 时间戳间隔不相等问题
        // 临时处理
        if (this._lastdts === 0) {
          this._lastdts = tagTimestamp - 66;
        }
        dts = this._timestampBase + this._lastdts;
        this._lastdts = tagTimestamp;
      }

      var keyframe = frameType === 1; // from FLV Frame Type constants
      var encryptflag = false;
      while (offset < dataSize) {
        if (offset + 4 >= dataSize) {
          _logger2.default.w(this.TAG, 'Malformed Nalu near timestamp ' + dts + ', offset = ' + offset + ', dataSize = ' + dataSize);
          break; // data not enough for next Nalu
        }
        // Nalu with length-header (AVC1)
        var naluSize = v.getUint32(offset, !le); // Big-Endian read
        if (lengthSize === 3) {
          naluSize >>>= 8;
        }
        if (naluSize > dataSize - lengthSize) {
          _logger2.default.w(this.TAG, 'Malformed Nalus near timestamp ' + dts + ', NaluSize > DataSize!');
          return;
        }

        var unitType = v.getUint8(offset + lengthSize) & 0x1f;

        if (unitType === 6) {
          // SEI
          encryptflag = v.getUint8(offset + lengthSize + 1);
        }

        var data = new Uint8Array(arrayBuffer, dataOffset + offset, lengthSize + naluSize);
        if (unitType === 5) {
          // IDR
          keyframe = true;
          if (encryptflag == true) {
            //decrypt
            // Log.v(this.TAG, 'decrypt IDR lengthSize :'+lengthSize + ' dataOffset :' + dataOffset + ' offset :' + offset + ' naluSize :'+naluSize);

            var buffer = new Uint8Array(arrayBuffer, dataOffset + offset + lengthSize + 1, lengthSize + naluSize - (lengthSize + 1) - (lengthSize + naluSize - (lengthSize + 1)) % 16);
            var iv = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

            var aesCbc = new _aesJs2.default.ModeOfOperation.cbc(this._encryptkey, iv);
            var decryptedBytes = aesCbc.decrypt(buffer);

            data.set(decryptedBytes, lengthSize + 1);
          }
        }

        var unit = { type: unitType, data: data };
        units.push(unit);
        length += data.byteLength;

        offset += lengthSize + naluSize;
      }

      if (units.length) {
        var track = this._videoTrack;
        var avcSample = {
          units: units,
          length: length,
          isKeyframe: keyframe,
          dts: dts,
          cts: cts,
          pts: dts + cts
        };
        if (keyframe) {
          avcSample.fileposition = tagPosition;
        }
        track.samples.push(avcSample);
        track.length += length;
      }
    }
  }, {
    key: 'onTrackMetadata',
    get: function get() {
      return this._onTrackMetadata;
    },
    set: function set(callback) {
      this._onTrackMetadata = callback;
    }

    // prototype: function(mediaInfo: MediaInfo): void

  }, {
    key: 'onMediaInfo',
    get: function get() {
      return this._onMediaInfo;
    },
    set: function set(callback) {
      this._onMediaInfo = callback;
    }
  }, {
    key: 'onMessageDx',
    get: function get() {
      return this._onMessageDx;
    },
    set: function set(callback) {
      this._onMessageDx = callback;
    }
  }, {
    key: 'onMetaDataArrived',
    get: function get() {
      return this._onMetaDataArrived;
    },
    set: function set(callback) {
      this._onMetaDataArrived = callback;
    }

    // prototype: function(type: number, info: string): void

  }, {
    key: 'onError',
    get: function get() {
      return this._onError;
    },
    set: function set(callback) {
      this._onError = callback;
    }

    // prototype: function(videoTrack: any, audioTrack: any): void

  }, {
    key: 'onDataAvailable',
    get: function get() {
      return this._onDataAvailable;
    },
    set: function set(callback) {
      this._onDataAvailable = callback;
    }

    // timestamp base for output samples, must be in milliseconds

  }, {
    key: 'timestampBase',
    get: function get() {
      return this._timestampBase;
    },
    set: function set(base) {
      this._timestampBase = base;
    }
  }, {
    key: 'overridedDuration',
    get: function get() {
      return this._duration;
    }

    // Force-override media duration. Must be in milliseconds, int32
    ,
    set: function set(duration) {
      this._durationOverrided = true;
      this._duration = duration;
      this._mediaInfo.duration = duration;
    }

    // Force-override audio track present flag, boolean

  }, {
    key: 'overridedHasAudio',
    set: function set(hasAudio) {
      this._hasAudioFlagOverrided = true;
      this._hasAudio = hasAudio;
      this._mediaInfo.hasAudio = hasAudio;
    }

    // Force-override video track present flag, boolean

  }, {
    key: 'overridedHasVideo',
    set: function set(hasVideo) {
      this._hasVideoFlagOverrided = true;
      this._hasVideo = hasVideo;
      this._mediaInfo.hasVideo = hasVideo;
    }
  }], [{
    key: 'probe',
    value: function probe(buffer) {
      var data = new Uint8Array(buffer);
      var mismatch = { match: false };

      if (data[0] !== 0x46 || data[1] !== 0x4c || data[2] !== 0x56 || data[3] !== 0x01) {
        return mismatch;
      }

      var hasAudio = (data[4] & 4) >>> 2 !== 0;
      var hasVideo = (data[4] & 1) !== 0;

      var offset = ReadBig32(data, 5);

      if (offset < 9) {
        return mismatch;
      }

      return {
        match: true,
        consumed: offset,
        dataOffset: offset,
        hasAudioTrack: hasAudio,
        hasVideoTrack: hasVideo
      };
    }
  }]);

  return FLVDemuxer;
}();

exports.default = FLVDemuxer;

},{"../core/media-info.js":8,"../utils/exception.js":41,"../utils/logger.js":42,"./amf-parser.js":16,"./demux-errors.js":17,"./sps-parser.js":20,"aes-js":1}],20:[function(_dereq_,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); /*
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * Copyright (C) 2016 Bilibili. All Rights Reserved.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * @author zheng qian <xqq@xqq.im>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * Licensed under the Apache License, Version 2.0 (the "License");
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * you may not use this file except in compliance with the License.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * You may obtain a copy of the License at
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *     http://www.apache.org/licenses/LICENSE-2.0
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * Unless required by applicable law or agreed to in writing, software
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * distributed under the License is distributed on an "AS IS" BASIS,
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * See the License for the specific language governing permissions and
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * limitations under the License.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      */

var _expGolomb = _dereq_('./exp-golomb.js');

var _expGolomb2 = _interopRequireDefault(_expGolomb);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var SPSParser = function () {
    function SPSParser() {
        _classCallCheck(this, SPSParser);
    }

    _createClass(SPSParser, null, [{
        key: '_ebsp2rbsp',
        value: function _ebsp2rbsp(uint8array) {
            var src = uint8array;
            var src_length = src.byteLength;
            var dst = new Uint8Array(src_length);
            var dst_idx = 0;

            for (var i = 0; i < src_length; i++) {
                if (i >= 2) {
                    // Unescape: Skip 0x03 after 00 00
                    if (src[i] === 0x03 && src[i - 1] === 0x00 && src[i - 2] === 0x00) {
                        continue;
                    }
                }
                dst[dst_idx] = src[i];
                dst_idx++;
            }

            return new Uint8Array(dst.buffer, 0, dst_idx);
        }
    }, {
        key: 'parseSPS',
        value: function parseSPS(uint8array) {
            var rbsp = SPSParser._ebsp2rbsp(uint8array);
            var gb = new _expGolomb2.default(rbsp);

            gb.readByte();
            var profile_idc = gb.readByte(); // profile_idc
            gb.readByte(); // constraint_set_flags[5] + reserved_zero[3]
            var level_idc = gb.readByte(); // level_idc
            gb.readUEG(); // seq_parameter_set_id

            var profile_string = SPSParser.getProfileString(profile_idc);
            var level_string = SPSParser.getLevelString(level_idc);
            var chroma_format_idc = 1;
            var chroma_format = 420;
            var chroma_format_table = [0, 420, 422, 444];
            var bit_depth = 8;

            if (profile_idc === 100 || profile_idc === 110 || profile_idc === 122 || profile_idc === 244 || profile_idc === 44 || profile_idc === 83 || profile_idc === 86 || profile_idc === 118 || profile_idc === 128 || profile_idc === 138 || profile_idc === 144) {

                chroma_format_idc = gb.readUEG();
                if (chroma_format_idc === 3) {
                    gb.readBits(1); // separate_colour_plane_flag
                }
                if (chroma_format_idc <= 3) {
                    chroma_format = chroma_format_table[chroma_format_idc];
                }

                bit_depth = gb.readUEG() + 8; // bit_depth_luma_minus8
                gb.readUEG(); // bit_depth_chroma_minus8
                gb.readBits(1); // qpprime_y_zero_transform_bypass_flag
                if (gb.readBool()) {
                    // seq_scaling_matrix_present_flag
                    var scaling_list_count = chroma_format_idc !== 3 ? 8 : 12;
                    for (var i = 0; i < scaling_list_count; i++) {
                        if (gb.readBool()) {
                            // seq_scaling_list_present_flag
                            if (i < 6) {
                                SPSParser._skipScalingList(gb, 16);
                            } else {
                                SPSParser._skipScalingList(gb, 64);
                            }
                        }
                    }
                }
            }
            gb.readUEG(); // log2_max_frame_num_minus4
            var pic_order_cnt_type = gb.readUEG();
            if (pic_order_cnt_type === 0) {
                gb.readUEG(); // log2_max_pic_order_cnt_lsb_minus_4
            } else if (pic_order_cnt_type === 1) {
                gb.readBits(1); // delta_pic_order_always_zero_flag
                gb.readSEG(); // offset_for_non_ref_pic
                gb.readSEG(); // offset_for_top_to_bottom_field
                var num_ref_frames_in_pic_order_cnt_cycle = gb.readUEG();
                for (var _i = 0; _i < num_ref_frames_in_pic_order_cnt_cycle; _i++) {
                    gb.readSEG(); // offset_for_ref_frame
                }
            }
            var ref_frames = gb.readUEG(); // max_num_ref_frames
            gb.readBits(1); // gaps_in_frame_num_value_allowed_flag

            var pic_width_in_mbs_minus1 = gb.readUEG();
            var pic_height_in_map_units_minus1 = gb.readUEG();

            var frame_mbs_only_flag = gb.readBits(1);
            if (frame_mbs_only_flag === 0) {
                gb.readBits(1); // mb_adaptive_frame_field_flag
            }
            gb.readBits(1); // direct_8x8_inference_flag

            var frame_crop_left_offset = 0;
            var frame_crop_right_offset = 0;
            var frame_crop_top_offset = 0;
            var frame_crop_bottom_offset = 0;

            var frame_cropping_flag = gb.readBool();
            if (frame_cropping_flag) {
                frame_crop_left_offset = gb.readUEG();
                frame_crop_right_offset = gb.readUEG();
                frame_crop_top_offset = gb.readUEG();
                frame_crop_bottom_offset = gb.readUEG();
            }

            var sar_width = 1,
                sar_height = 1;
            var fps = 0,
                fps_fixed = true,
                fps_num = 0,
                fps_den = 0;

            var vui_parameters_present_flag = gb.readBool();
            if (vui_parameters_present_flag) {
                if (gb.readBool()) {
                    // aspect_ratio_info_present_flag
                    var aspect_ratio_idc = gb.readByte();
                    var sar_w_table = [1, 12, 10, 16, 40, 24, 20, 32, 80, 18, 15, 64, 160, 4, 3, 2];
                    var sar_h_table = [1, 11, 11, 11, 33, 11, 11, 11, 33, 11, 11, 33, 99, 3, 2, 1];

                    if (aspect_ratio_idc > 0 && aspect_ratio_idc < 16) {
                        sar_width = sar_w_table[aspect_ratio_idc - 1];
                        sar_height = sar_h_table[aspect_ratio_idc - 1];
                    } else if (aspect_ratio_idc === 255) {
                        sar_width = gb.readByte() << 8 | gb.readByte();
                        sar_height = gb.readByte() << 8 | gb.readByte();
                    }
                }

                if (gb.readBool()) {
                    // overscan_info_present_flag
                    gb.readBool(); // overscan_appropriate_flag
                }
                if (gb.readBool()) {
                    // video_signal_type_present_flag
                    gb.readBits(4); // video_format & video_full_range_flag
                    if (gb.readBool()) {
                        // colour_description_present_flag
                        gb.readBits(24); // colour_primaries & transfer_characteristics & matrix_coefficients
                    }
                }
                if (gb.readBool()) {
                    // chroma_loc_info_present_flag
                    gb.readUEG(); // chroma_sample_loc_type_top_field
                    gb.readUEG(); // chroma_sample_loc_type_bottom_field
                }
                if (gb.readBool()) {
                    // timing_info_present_flag
                    var num_units_in_tick = gb.readBits(32);
                    var time_scale = gb.readBits(32);
                    fps_fixed = gb.readBool(); // fixed_frame_rate_flag

                    fps_num = time_scale;
                    fps_den = num_units_in_tick * 2;
                    fps = fps_num / fps_den;
                }
            }

            var sarScale = 1;
            if (sar_width !== 1 || sar_height !== 1) {
                sarScale = sar_width / sar_height;
            }

            var crop_unit_x = 0,
                crop_unit_y = 0;
            if (chroma_format_idc === 0) {
                crop_unit_x = 1;
                crop_unit_y = 2 - frame_mbs_only_flag;
            } else {
                var sub_wc = chroma_format_idc === 3 ? 1 : 2;
                var sub_hc = chroma_format_idc === 1 ? 2 : 1;
                crop_unit_x = sub_wc;
                crop_unit_y = sub_hc * (2 - frame_mbs_only_flag);
            }

            var codec_width = (pic_width_in_mbs_minus1 + 1) * 16;
            var codec_height = (2 - frame_mbs_only_flag) * ((pic_height_in_map_units_minus1 + 1) * 16);

            codec_width -= (frame_crop_left_offset + frame_crop_right_offset) * crop_unit_x;
            codec_height -= (frame_crop_top_offset + frame_crop_bottom_offset) * crop_unit_y;

            var present_width = Math.ceil(codec_width * sarScale);

            gb.destroy();
            gb = null;

            return {
                profile_string: profile_string, // baseline, high, high10, ...
                level_string: level_string, // 3, 3.1, 4, 4.1, 5, 5.1, ...
                bit_depth: bit_depth, // 8bit, 10bit, ...
                ref_frames: ref_frames,
                chroma_format: chroma_format, // 4:2:0, 4:2:2, ...
                chroma_format_string: SPSParser.getChromaFormatString(chroma_format),

                frame_rate: {
                    fixed: fps_fixed,
                    fps: fps,
                    fps_den: fps_den,
                    fps_num: fps_num
                },

                sar_ratio: {
                    width: sar_width,
                    height: sar_height
                },

                codec_size: {
                    width: codec_width,
                    height: codec_height
                },

                present_size: {
                    width: present_width,
                    height: codec_height
                }
            };
        }
    }, {
        key: '_skipScalingList',
        value: function _skipScalingList(gb, count) {
            var last_scale = 8,
                next_scale = 8;
            var delta_scale = 0;
            for (var i = 0; i < count; i++) {
                if (next_scale !== 0) {
                    delta_scale = gb.readSEG();
                    next_scale = (last_scale + delta_scale + 256) % 256;
                }
                last_scale = next_scale === 0 ? last_scale : next_scale;
            }
        }
    }, {
        key: 'getProfileString',
        value: function getProfileString(profile_idc) {
            switch (profile_idc) {
                case 66:
                    return 'Baseline';
                case 77:
                    return 'Main';
                case 88:
                    return 'Extended';
                case 100:
                    return 'High';
                case 110:
                    return 'High10';
                case 122:
                    return 'High422';
                case 244:
                    return 'High444';
                default:
                    return 'Unknown';
            }
        }
    }, {
        key: 'getLevelString',
        value: function getLevelString(level_idc) {
            return (level_idc / 10).toFixed(1);
        }
    }, {
        key: 'getChromaFormatString',
        value: function getChromaFormatString(chroma) {
            switch (chroma) {
                case 420:
                    return '4:2:0';
                case 422:
                    return '4:2:2';
                case 444:
                    return '4:4:4';
                default:
                    return 'Unknown';
            }
        }
    }]);

    return SPSParser;
}();

exports.default = SPSParser;

},{"./exp-golomb.js":18}],21:[function(_dereq_,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; /*
                                                                                                                                                                                                                                                                               * Copyright (C) 2016 Bilibili. All Rights Reserved.
                                                                                                                                                                                                                                                                               *
                                                                                                                                                                                                                                                                               * @author zheng qian <xqq@xqq.im>
                                                                                                                                                                                                                                                                               *
                                                                                                                                                                                                                                                                               * Licensed under the Apache License, Version 2.0 (the "License");
                                                                                                                                                                                                                                                                               * you may not use this file except in compliance with the License.
                                                                                                                                                                                                                                                                               * You may obtain a copy of the License at
                                                                                                                                                                                                                                                                               *
                                                                                                                                                                                                                                                                               *     http://www.apache.org/licenses/LICENSE-2.0
                                                                                                                                                                                                                                                                               *
                                                                                                                                                                                                                                                                               * Unless required by applicable law or agreed to in writing, software
                                                                                                                                                                                                                                                                               * distributed under the License is distributed on an "AS IS" BASIS,
                                                                                                                                                                                                                                                                               * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
                                                                                                                                                                                                                                                                               * See the License for the specific language governing permissions and
                                                                                                                                                                                                                                                                               * limitations under the License.
                                                                                                                                                                                                                                                                               */

var _polyfill = _dereq_('./utils/polyfill.js');

var _polyfill2 = _interopRequireDefault(_polyfill);

var _features = _dereq_('./core/features.js');

var _features2 = _interopRequireDefault(_features);

var _loader = _dereq_('./io/loader.js');

var _flvPlayer = _dereq_('./player/flv-player.js');

var _flvPlayer2 = _interopRequireDefault(_flvPlayer);

var _nativePlayer = _dereq_('./player/native-player.js');

var _nativePlayer2 = _interopRequireDefault(_nativePlayer);

var _playerEvents = _dereq_('./player/player-events.js');

var _playerEvents2 = _interopRequireDefault(_playerEvents);

var _playerErrors = _dereq_('./player/player-errors.js');

var _loggingControl = _dereq_('./utils/logging-control.js');

var _loggingControl2 = _interopRequireDefault(_loggingControl);

var _exception = _dereq_('./utils/exception.js');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// here are all the interfaces

// install polyfills
_polyfill2.default.install();

// factory method
function createPlayer(mediaDataSource, optionalConfig) {
    var mds = mediaDataSource;
    if (mds == null || (typeof mds === 'undefined' ? 'undefined' : _typeof(mds)) !== 'object') {
        throw new _exception.InvalidArgumentException('MediaDataSource must be an javascript object!');
    }

    if (!mds.hasOwnProperty('type')) {
        throw new _exception.InvalidArgumentException('MediaDataSource must has type field to indicate video file type!');
    }

    switch (mds.type) {
        case 'flv':
            return new _flvPlayer2.default(mds, optionalConfig);
        default:
            return new _nativePlayer2.default(mds, optionalConfig);
    }
}

// feature detection
function isSupported() {
    return _features2.default.supportMSEH264Playback();
}

function getFeatureList() {
    return _features2.default.getFeatureList();
}

// interfaces
var flvjs = {};

flvjs.createPlayer = createPlayer;
flvjs.isSupported = isSupported;
flvjs.getFeatureList = getFeatureList;

flvjs.BaseLoader = _loader.BaseLoader;
flvjs.LoaderStatus = _loader.LoaderStatus;
flvjs.LoaderErrors = _loader.LoaderErrors;

flvjs.Events = _playerEvents2.default;
flvjs.ErrorTypes = _playerErrors.ErrorTypes;
flvjs.ErrorDetails = _playerErrors.ErrorDetails;

flvjs.FlvPlayer = _flvPlayer2.default;
flvjs.NativePlayer = _nativePlayer2.default;
flvjs.LoggingControl = _loggingControl2.default;

Object.defineProperty(flvjs, 'version', {
    enumerable: true,
    get: function get() {
        // replaced by browserify-versionify transform
        return '0.0.3';
    }
});

exports.default = flvjs;

},{"./core/features.js":7,"./io/loader.js":25,"./player/flv-player.js":33,"./player/native-player.js":34,"./player/player-errors.js":35,"./player/player-events.js":36,"./utils/exception.js":41,"./utils/logging-control.js":43,"./utils/polyfill.js":44}],22:[function(_dereq_,module,exports){
'use strict';

// entry/index file

// make it compatible with browserify's umd wrapper
module.exports = _dereq_('./flv.js').default;

},{"./flv.js":21}],23:[function(_dereq_,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _logger = _dereq_('../utils/logger.js');

var _logger2 = _interopRequireDefault(_logger);

var _browser = _dereq_('../utils/browser.js');

var _browser2 = _interopRequireDefault(_browser);

var _loader = _dereq_('./loader.js');

var _exception = _dereq_('../utils/exception.js');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; } /*
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * Copyright (C) 2016 Bilibili. All Rights Reserved.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * @author zheng qian <xqq@xqq.im>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * Licensed under the Apache License, Version 2.0 (the "License");
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * you may not use this file except in compliance with the License.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * You may obtain a copy of the License at
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                *     http://www.apache.org/licenses/LICENSE-2.0
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * Unless required by applicable law or agreed to in writing, software
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * distributed under the License is distributed on an "AS IS" BASIS,
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * See the License for the specific language governing permissions and
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * limitations under the License.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                */

/* fetch + stream IO loader. Currently working on chrome 43+.
 * fetch provides a better alternative http API to XMLHttpRequest
 *
 * fetch spec   https://fetch.spec.whatwg.org/
 * stream spec  https://streams.spec.whatwg.org/
 */
var FetchStreamLoader = function (_BaseLoader) {
    _inherits(FetchStreamLoader, _BaseLoader);

    _createClass(FetchStreamLoader, null, [{
        key: 'isSupported',
        value: function isSupported() {
            try {
                // fetch + stream is broken on Microsoft Edge. Disable before build 15048.
                // see https://developer.microsoft.com/en-us/microsoft-edge/platform/issues/8196907/
                // Fixed in Jan 10, 2017. Build 15048+ removed from blacklist.
                var isWorkWellEdge = _browser2.default.msedge && _browser2.default.version.minor >= 15048;
                var browserNotBlacklisted = _browser2.default.msedge ? isWorkWellEdge : true;
                return self.fetch && self.ReadableStream && browserNotBlacklisted;
            } catch (e) {
                return false;
            }
        }
    }]);

    function FetchStreamLoader(seekHandler, config) {
        _classCallCheck(this, FetchStreamLoader);

        var _this = _possibleConstructorReturn(this, (FetchStreamLoader.__proto__ || Object.getPrototypeOf(FetchStreamLoader)).call(this, 'fetch-stream-loader'));

        _this.TAG = 'FetchStreamLoader';

        _this._seekHandler = seekHandler;
        _this._config = config;
        _this._needStash = true;

        _this._requestAbort = false;
        _this._contentLength = null;
        _this._receivedLength = 0;
        return _this;
    }

    _createClass(FetchStreamLoader, [{
        key: 'destroy',
        value: function destroy() {
            if (this.isWorking()) {
                this.abort();
            }
            _get(FetchStreamLoader.prototype.__proto__ || Object.getPrototypeOf(FetchStreamLoader.prototype), 'destroy', this).call(this);
        }
    }, {
        key: 'open',
        value: function open(dataSource, range) {
            var _this2 = this;

            this._dataSource = dataSource;
            this._range = range;

            var sourceURL = dataSource.url;
            if (this._config.reuseRedirectedURL && dataSource.redirectedURL != undefined) {
                sourceURL = dataSource.redirectedURL;
            }

            var seekConfig = this._seekHandler.getConfig(sourceURL, range);

            var headers = new self.Headers();

            if (_typeof(seekConfig.headers) === 'object') {
                var configHeaders = seekConfig.headers;
                for (var key in configHeaders) {
                    if (configHeaders.hasOwnProperty(key)) {
                        headers.append(key, configHeaders[key]);
                    }
                }
            }

            var params = {
                method: 'GET',
                headers: headers,
                mode: 'cors',
                cache: 'default',
                // The default policy of Fetch API in the whatwg standard
                // Safari incorrectly indicates 'no-referrer' as default policy, fuck it
                referrerPolicy: 'no-referrer-when-downgrade'
            };

            // cors is enabled by default
            if (dataSource.cors === false) {
                // no-cors means 'disregard cors policy', which can only be used in ServiceWorker
                params.mode = 'same-origin';
            }

            // withCredentials is disabled by default
            if (dataSource.withCredentials) {
                params.credentials = 'include';
            }

            // referrerPolicy from config
            if (dataSource.referrerPolicy) {
                params.referrerPolicy = dataSource.referrerPolicy;
            }

            this._status = _loader.LoaderStatus.kConnecting;
            self.fetch(seekConfig.url, params).then(function (res) {
                if (_this2._requestAbort) {
                    _this2._requestAbort = false;
                    _this2._status = _loader.LoaderStatus.kIdle;
                    return;
                }
                if (res.ok && res.status >= 200 && res.status <= 299) {
                    if (res.url !== seekConfig.url) {
                        if (_this2._onURLRedirect) {
                            var redirectedURL = _this2._seekHandler.removeURLParameters(res.url);
                            _this2._onURLRedirect(redirectedURL);
                        }
                    }

                    var lengthHeader = res.headers.get('Content-Length');
                    if (lengthHeader != null) {
                        _this2._contentLength = parseInt(lengthHeader);
                        if (_this2._contentLength !== 0) {
                            if (_this2._onContentLengthKnown) {
                                _this2._onContentLengthKnown(_this2._contentLength);
                            }
                        }
                    }

                    return _this2._pump.call(_this2, res.body.getReader());
                } else {
                    _this2._status = _loader.LoaderStatus.kError;
                    if (_this2._onError) {
                        _this2._onError(_loader.LoaderErrors.HTTP_STATUS_CODE_INVALID, { code: res.status, msg: res.statusText });
                    } else {
                        throw new _exception.RuntimeException('FetchStreamLoader: Http code invalid, ' + res.status + ' ' + res.statusText);
                    }
                }
            }).catch(function (e) {
                _this2._status = _loader.LoaderStatus.kError;
                if (_this2._onError) {
                    _this2._onError(_loader.LoaderErrors.EXCEPTION, { code: -1, msg: e.message });
                } else {
                    throw e;
                }
            });
        }
    }, {
        key: 'abort',
        value: function abort() {
            this._requestAbort = true;
        }
    }, {
        key: '_pump',
        value: function _pump(reader) {
            var _this3 = this;

            // ReadableStreamReader
            return reader.read().then(function (result) {
                if (result.done) {
                    // First check received length
                    if (_this3._contentLength !== null && _this3._receivedLength < _this3._contentLength) {
                        // Report Early-EOF
                        _this3._status = _loader.LoaderStatus.kError;
                        var type = _loader.LoaderErrors.EARLY_EOF;
                        var info = { code: -1, msg: 'Fetch stream meet Early-EOF' };
                        if (_this3._onError) {
                            _this3._onError(type, info);
                        } else {
                            throw new _exception.RuntimeException(info.msg);
                        }
                    } else {
                        // OK. Download complete
                        _this3._status = _loader.LoaderStatus.kComplete;
                        if (_this3._onComplete) {
                            _this3._onComplete(_this3._range.from, _this3._range.from + _this3._receivedLength - 1);
                        }
                    }
                } else {
                    if (_this3._requestAbort === true) {
                        _this3._requestAbort = false;
                        _this3._status = _loader.LoaderStatus.kComplete;
                        return reader.cancel();
                    }

                    _this3._status = _loader.LoaderStatus.kBuffering;

                    var chunk = result.value.buffer;
                    var byteStart = _this3._range.from + _this3._receivedLength;
                    _this3._receivedLength += chunk.byteLength;

                    if (_this3._onDataArrival) {
                        _this3._onDataArrival(chunk, byteStart, _this3._receivedLength);
                    }

                    _this3._pump(reader);
                }
            }).catch(function (e) {
                if (e.code === 11 && _browser2.default.msedge) {
                    // InvalidStateError on Microsoft Edge
                    // Workaround: Edge may throw InvalidStateError after ReadableStreamReader.cancel() call
                    // Ignore the unknown exception.
                    // Related issue: https://developer.microsoft.com/en-us/microsoft-edge/platform/issues/11265202/
                    return;
                }

                _this3._status = _loader.LoaderStatus.kError;
                var type = 0;
                var info = null;

                if ((e.code === 19 || e.message === 'network error') && ( // NETWORK_ERR
                _this3._contentLength === null || _this3._contentLength !== null && _this3._receivedLength < _this3._contentLength)) {
                    type = _loader.LoaderErrors.EARLY_EOF;
                    info = { code: e.code, msg: 'Fetch stream meet Early-EOF' };
                } else {
                    type = _loader.LoaderErrors.EXCEPTION;
                    info = { code: e.code, msg: e.message };
                }

                if (_this3._onError) {
                    _this3._onError(type, info);
                } else {
                    throw new _exception.RuntimeException(info.msg);
                }
            });
        }
    }]);

    return FetchStreamLoader;
}(_loader.BaseLoader);

exports.default = FetchStreamLoader;

},{"../utils/browser.js":40,"../utils/exception.js":41,"../utils/logger.js":42,"./loader.js":25}],24:[function(_dereq_,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); /*
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * Copyright (C) 2016 Bilibili. All Rights Reserved.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * @author zheng qian <xqq@xqq.im>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * Licensed under the Apache License, Version 2.0 (the "License");
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * you may not use this file except in compliance with the License.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * You may obtain a copy of the License at
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *     http://www.apache.org/licenses/LICENSE-2.0
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * Unless required by applicable law or agreed to in writing, software
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * distributed under the License is distributed on an "AS IS" BASIS,
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * See the License for the specific language governing permissions and
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * limitations under the License.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      */

var _logger = _dereq_('../utils/logger.js');

var _logger2 = _interopRequireDefault(_logger);

var _speedSampler = _dereq_('./speed-sampler.js');

var _speedSampler2 = _interopRequireDefault(_speedSampler);

var _loader = _dereq_('./loader.js');

var _fetchStreamLoader = _dereq_('./fetch-stream-loader.js');

var _fetchStreamLoader2 = _interopRequireDefault(_fetchStreamLoader);

var _xhrMozChunkedLoader = _dereq_('./xhr-moz-chunked-loader.js');

var _xhrMozChunkedLoader2 = _interopRequireDefault(_xhrMozChunkedLoader);

var _xhrMsstreamLoader = _dereq_('./xhr-msstream-loader.js');

var _xhrMsstreamLoader2 = _interopRequireDefault(_xhrMsstreamLoader);

var _xhrRangeLoader = _dereq_('./xhr-range-loader.js');

var _xhrRangeLoader2 = _interopRequireDefault(_xhrRangeLoader);

var _websocketLoader = _dereq_('./websocket-loader.js');

var _websocketLoader2 = _interopRequireDefault(_websocketLoader);

var _rangeSeekHandler = _dereq_('./range-seek-handler.js');

var _rangeSeekHandler2 = _interopRequireDefault(_rangeSeekHandler);

var _paramSeekHandler = _dereq_('./param-seek-handler.js');

var _paramSeekHandler2 = _interopRequireDefault(_paramSeekHandler);

var _exception = _dereq_('../utils/exception.js');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * DataSource: {
 *     url: string,
 *     filesize: number,
 *     cors: boolean,
 *     withCredentials: boolean
 * }
 * 
 */

// Manage IO Loaders
var IOController = function () {
    function IOController(dataSource, config, extraData) {
        _classCallCheck(this, IOController);

        this.TAG = 'IOController';

        this._config = config;
        this._extraData = extraData;

        this._stashInitialSize = 1024 * 384; // default initial size: 384KB
        if (config.stashInitialSize != undefined && config.stashInitialSize > 0) {
            // apply from config
            this._stashInitialSize = config.stashInitialSize;
        }

        this._stashUsed = 0;
        this._stashSize = this._stashInitialSize;
        this._bufferSize = 1024 * 1024 * 3; // initial size: 3MB
        this._stashBuffer = new ArrayBuffer(this._bufferSize);
        this._stashByteStart = 0;
        this._enableStash = true;
        if (config.enableStashBuffer === false) {
            this._enableStash = false;
        }

        this._loader = null;
        this._loaderClass = null;
        this._seekHandler = null;

        this._dataSource = dataSource;
        this._isWebSocketURL = /wss?:\/\/(.+?)/.test(dataSource.url);
        this._refTotalLength = dataSource.filesize ? dataSource.filesize : null;
        this._totalLength = this._refTotalLength;
        this._fullRequestFlag = false;
        this._currentRange = null;
        this._redirectedURL = null;

        this._speedNormalized = 0;
        this._speedSampler = new _speedSampler2.default();
        this._speedNormalizeList = [64, 128, 256, 384, 512, 768, 1024, 1536, 2048, 3072, 4096];

        this._isEarlyEofReconnecting = false;

        this._paused = false;
        this._resumeFrom = 0;

        this._onDataArrival = null;
        this._onSeeked = null;
        this._onError = null;
        this._onComplete = null;
        this._onRedirect = null;
        this._onRecoveredEarlyEof = null;

        this._selectSeekHandler();
        this._selectLoader();
        this._createLoader();
    }

    _createClass(IOController, [{
        key: 'destroy',
        value: function destroy() {
            if (this._loader.isWorking()) {
                this._loader.abort();
            }
            this._loader.destroy();
            this._loader = null;
            this._loaderClass = null;
            this._dataSource = null;
            this._stashBuffer = null;
            this._stashUsed = this._stashSize = this._bufferSize = this._stashByteStart = 0;
            this._currentRange = null;
            this._speedSampler = null;

            this._isEarlyEofReconnecting = false;

            this._onDataArrival = null;
            this._onSeeked = null;
            this._onError = null;
            this._onComplete = null;
            this._onRedirect = null;
            this._onRecoveredEarlyEof = null;

            this._extraData = null;
        }
    }, {
        key: 'isWorking',
        value: function isWorking() {
            return this._loader && this._loader.isWorking() && !this._paused;
        }
    }, {
        key: 'isPaused',
        value: function isPaused() {
            return this._paused;
        }
    }, {
        key: '_selectSeekHandler',
        value: function _selectSeekHandler() {
            var config = this._config;

            if (config.seekType === 'range') {
                this._seekHandler = new _rangeSeekHandler2.default(this._config.rangeLoadZeroStart);
            } else if (config.seekType === 'param') {
                var paramStart = config.seekParamStart || 'bstart';
                var paramEnd = config.seekParamEnd || 'bend';

                this._seekHandler = new _paramSeekHandler2.default(paramStart, paramEnd);
            } else if (config.seekType === 'custom') {
                if (typeof config.customSeekHandler !== 'function') {
                    throw new _exception.InvalidArgumentException('Custom seekType specified in config but invalid customSeekHandler!');
                }
                this._seekHandler = new config.customSeekHandler();
            } else {
                throw new _exception.InvalidArgumentException('Invalid seekType in config: ' + config.seekType);
            }
        }
    }, {
        key: '_selectLoader',
        value: function _selectLoader() {
            if (this._config.customLoader != null) {
                this._loaderClass = this._config.customLoader;
            } else if (this._isWebSocketURL) {
                this._loaderClass = _websocketLoader2.default;
            } else if (_fetchStreamLoader2.default.isSupported()) {
                this._loaderClass = _fetchStreamLoader2.default;
            } else if (_xhrMozChunkedLoader2.default.isSupported()) {
                this._loaderClass = _xhrMozChunkedLoader2.default;
            } else if (_xhrRangeLoader2.default.isSupported()) {
                this._loaderClass = _xhrRangeLoader2.default;
            } else {
                throw new _exception.RuntimeException('Your browser doesn\'t support xhr with arraybuffer responseType!');
            }
        }
    }, {
        key: '_createLoader',
        value: function _createLoader() {
            this._loader = new this._loaderClass(this._seekHandler, this._config);
            if (this._loader.needStashBuffer === false) {
                this._enableStash = false;
            }
            this._loader.onContentLengthKnown = this._onContentLengthKnown.bind(this);
            this._loader.onURLRedirect = this._onURLRedirect.bind(this);
            this._loader.onDataArrival = this._onLoaderChunkArrival.bind(this);
            this._loader.onComplete = this._onLoaderComplete.bind(this);
            this._loader.onError = this._onLoaderError.bind(this);
        }
    }, {
        key: 'open',
        value: function open(optionalFrom) {
            this._currentRange = { from: 0, to: -1 };
            if (optionalFrom) {
                this._currentRange.from = optionalFrom;
            }

            this._speedSampler.reset();
            if (!optionalFrom) {
                this._fullRequestFlag = true;
            }

            this._loader.open(this._dataSource, Object.assign({}, this._currentRange));
        }
    }, {
        key: 'abort',
        value: function abort() {
            this._loader.abort();

            if (this._paused) {
                this._paused = false;
                this._resumeFrom = 0;
            }
        }
    }, {
        key: 'pause',
        value: function pause() {
            if (this.isWorking()) {
                this._loader.abort();

                if (this._stashUsed !== 0) {
                    this._resumeFrom = this._stashByteStart;
                    this._currentRange.to = this._stashByteStart - 1;
                } else {
                    this._resumeFrom = this._currentRange.to + 1;
                }
                this._stashUsed = 0;
                this._stashByteStart = 0;
                this._paused = true;
            }
        }
    }, {
        key: 'resume',
        value: function resume() {
            if (this._paused) {
                this._paused = false;
                var bytes = this._resumeFrom;
                this._resumeFrom = 0;
                this._internalSeek(bytes, true);
            }
        }
    }, {
        key: 'seek',
        value: function seek(bytes) {
            this._paused = false;
            this._stashUsed = 0;
            this._stashByteStart = 0;
            this._internalSeek(bytes, true);
        }

        /**
         * When seeking request is from media seeking, unconsumed stash data should be dropped
         * However, stash data shouldn't be dropped if seeking requested from http reconnection
         *
         * @dropUnconsumed: Ignore and discard all unconsumed data in stash buffer
         */

    }, {
        key: '_internalSeek',
        value: function _internalSeek(bytes, dropUnconsumed) {
            if (this._loader.isWorking()) {
                this._loader.abort();
            }

            // dispatch & flush stash buffer before seek
            this._flushStashBuffer(dropUnconsumed);

            this._loader.destroy();
            this._loader = null;

            var requestRange = { from: bytes, to: -1 };
            this._currentRange = { from: requestRange.from, to: -1 };

            this._speedSampler.reset();
            this._stashSize = this._stashInitialSize;
            this._createLoader();
            this._loader.open(this._dataSource, requestRange);

            if (this._onSeeked) {
                this._onSeeked();
            }
        }
    }, {
        key: 'updateUrl',
        value: function updateUrl(url) {
            if (!url || typeof url !== 'string' || url.length === 0) {
                throw new _exception.InvalidArgumentException('Url must be a non-empty string!');
            }

            this._dataSource.url = url;

            // TODO: replace with new url
        }
    }, {
        key: '_expandBuffer',
        value: function _expandBuffer(expectedBytes) {
            var bufferNewSize = this._stashSize;
            while (bufferNewSize + 1024 * 1024 * 1 < expectedBytes) {
                bufferNewSize *= 2;
            }

            bufferNewSize += 1024 * 1024 * 1; // bufferSize = stashSize + 1MB
            if (bufferNewSize === this._bufferSize) {
                return;
            }

            var newBuffer = new ArrayBuffer(bufferNewSize);

            if (this._stashUsed > 0) {
                // copy existing data into new buffer
                var stashOldArray = new Uint8Array(this._stashBuffer, 0, this._stashUsed);
                var stashNewArray = new Uint8Array(newBuffer, 0, bufferNewSize);
                stashNewArray.set(stashOldArray, 0);
            }

            this._stashBuffer = newBuffer;
            this._bufferSize = bufferNewSize;
        }
    }, {
        key: '_normalizeSpeed',
        value: function _normalizeSpeed(input) {
            var list = this._speedNormalizeList;
            var last = list.length - 1;
            var mid = 0;
            var lbound = 0;
            var ubound = last;

            if (input < list[0]) {
                return list[0];
            }

            // binary search
            while (lbound <= ubound) {
                mid = lbound + Math.floor((ubound - lbound) / 2);
                if (mid === last || input >= list[mid] && input < list[mid + 1]) {
                    return list[mid];
                } else if (list[mid] < input) {
                    lbound = mid + 1;
                } else {
                    ubound = mid - 1;
                }
            }
        }
    }, {
        key: '_adjustStashSize',
        value: function _adjustStashSize(normalized) {
            var stashSizeKB = 0;

            if (this._config.isLive) {
                // live stream: always use single normalized speed for size of stashSizeKB
                stashSizeKB = normalized;
            } else {
                if (normalized < 512) {
                    stashSizeKB = normalized;
                } else if (normalized >= 512 && normalized <= 1024) {
                    stashSizeKB = Math.floor(normalized * 1.5);
                } else {
                    stashSizeKB = normalized * 2;
                }
            }

            if (stashSizeKB > 8192) {
                stashSizeKB = 8192;
            }

            var bufferSize = stashSizeKB * 1024 + 1024 * 1024 * 1; // stashSize + 1MB
            if (this._bufferSize < bufferSize) {
                this._expandBuffer(bufferSize);
            }
            this._stashSize = stashSizeKB * 1024;
        }
    }, {
        key: '_dispatchChunks',
        value: function _dispatchChunks(chunks, byteStart) {
            this._currentRange.to = byteStart + chunks.byteLength - 1;
            return this._onDataArrival(chunks, byteStart);
        }
    }, {
        key: '_onURLRedirect',
        value: function _onURLRedirect(redirectedURL) {
            this._redirectedURL = redirectedURL;
            if (this._onRedirect) {
                this._onRedirect(redirectedURL);
            }
        }
    }, {
        key: '_onContentLengthKnown',
        value: function _onContentLengthKnown(contentLength) {
            if (contentLength && this._fullRequestFlag) {
                this._totalLength = contentLength;
                this._fullRequestFlag = false;
            }
        }
    }, {
        key: '_onLoaderChunkArrival',
        value: function _onLoaderChunkArrival(chunk, byteStart, receivedLength) {
            if (!this._onDataArrival) {
                throw new _exception.IllegalStateException('IOController: No existing consumer (onDataArrival) callback!');
            }
            if (this._paused) {
                return;
            }
            if (this._isEarlyEofReconnecting) {
                // Auto-reconnect for EarlyEof succeed, notify to upper-layer by callback
                this._isEarlyEofReconnecting = false;
                if (this._onRecoveredEarlyEof) {
                    this._onRecoveredEarlyEof();
                }
            }

            this._speedSampler.addBytes(chunk.byteLength);

            // adjust stash buffer size according to network speed dynamically
            var KBps = this._speedSampler.lastSecondKBps;
            if (KBps !== 0) {
                var normalized = this._normalizeSpeed(KBps);
                if (this._speedNormalized !== normalized) {
                    this._speedNormalized = normalized;
                    this._adjustStashSize(normalized);
                }
            }

            if (!this._enableStash) {
                // disable stash
                if (this._stashUsed === 0) {
                    // dispatch chunk directly to consumer;
                    // check ret value (consumed bytes) and stash unconsumed to stashBuffer
                    var consumed = this._dispatchChunks(chunk, byteStart);
                    if (consumed < chunk.byteLength) {
                        // unconsumed data remain.
                        var remain = chunk.byteLength - consumed;
                        if (remain > this._bufferSize) {
                            this._expandBuffer(remain);
                        }
                        var stashArray = new Uint8Array(this._stashBuffer, 0, this._bufferSize);
                        stashArray.set(new Uint8Array(chunk, consumed), 0);
                        this._stashUsed += remain;
                        this._stashByteStart = byteStart + consumed;
                    }
                } else {
                    // else: Merge chunk into stashBuffer, and dispatch stashBuffer to consumer.
                    if (this._stashUsed + chunk.byteLength > this._bufferSize) {
                        this._expandBuffer(this._stashUsed + chunk.byteLength);
                    }
                    var _stashArray = new Uint8Array(this._stashBuffer, 0, this._bufferSize);
                    _stashArray.set(new Uint8Array(chunk), this._stashUsed);
                    this._stashUsed += chunk.byteLength;
                    var _consumed = this._dispatchChunks(this._stashBuffer.slice(0, this._stashUsed), this._stashByteStart);
                    if (_consumed < this._stashUsed && _consumed > 0) {
                        // unconsumed data remain
                        var remainArray = new Uint8Array(this._stashBuffer, _consumed);
                        _stashArray.set(remainArray, 0);
                    }
                    this._stashUsed -= _consumed;
                    this._stashByteStart += _consumed;
                }
            } else {
                // enable stash
                if (this._stashUsed === 0 && this._stashByteStart === 0) {
                    // seeked? or init chunk?
                    // This is the first chunk after seek action
                    this._stashByteStart = byteStart;
                }
                if (this._stashUsed + chunk.byteLength <= this._stashSize) {
                    // just stash
                    var _stashArray2 = new Uint8Array(this._stashBuffer, 0, this._stashSize);
                    _stashArray2.set(new Uint8Array(chunk), this._stashUsed);
                    this._stashUsed += chunk.byteLength;
                } else {
                    // stashUsed + chunkSize > stashSize, size limit exceeded
                    var _stashArray3 = new Uint8Array(this._stashBuffer, 0, this._bufferSize);
                    if (this._stashUsed > 0) {
                        // There're stash datas in buffer
                        // dispatch the whole stashBuffer, and stash remain data
                        // then append chunk to stashBuffer (stash)
                        var buffer = this._stashBuffer.slice(0, this._stashUsed);
                        var _consumed2 = this._dispatchChunks(buffer, this._stashByteStart);
                        if (_consumed2 < buffer.byteLength) {
                            if (_consumed2 > 0) {
                                var _remainArray = new Uint8Array(buffer, _consumed2);
                                _stashArray3.set(_remainArray, 0);
                                this._stashUsed = _remainArray.byteLength;
                                this._stashByteStart += _consumed2;
                            }
                        } else {
                            this._stashUsed = 0;
                            this._stashByteStart += _consumed2;
                        }
                        if (this._stashUsed + chunk.byteLength > this._bufferSize) {
                            this._expandBuffer(this._stashUsed + chunk.byteLength);
                            _stashArray3 = new Uint8Array(this._stashBuffer, 0, this._bufferSize);
                        }
                        _stashArray3.set(new Uint8Array(chunk), this._stashUsed);
                        this._stashUsed += chunk.byteLength;
                    } else {
                        // stash buffer empty, but chunkSize > stashSize (oh, holy shit)
                        // dispatch chunk directly and stash remain data
                        var _consumed3 = this._dispatchChunks(chunk, byteStart);
                        if (_consumed3 < chunk.byteLength) {
                            var _remain = chunk.byteLength - _consumed3;
                            if (_remain > this._bufferSize) {
                                this._expandBuffer(_remain);
                                _stashArray3 = new Uint8Array(this._stashBuffer, 0, this._bufferSize);
                            }
                            _stashArray3.set(new Uint8Array(chunk, _consumed3), 0);
                            this._stashUsed += _remain;
                            this._stashByteStart = byteStart + _consumed3;
                        }
                    }
                }
            }
        }
    }, {
        key: '_flushStashBuffer',
        value: function _flushStashBuffer(dropUnconsumed) {
            if (this._stashUsed > 0) {
                var buffer = this._stashBuffer.slice(0, this._stashUsed);
                var consumed = this._dispatchChunks(buffer, this._stashByteStart);
                var remain = buffer.byteLength - consumed;

                if (consumed < buffer.byteLength) {
                    if (dropUnconsumed) {
                        _logger2.default.w(this.TAG, remain + ' bytes unconsumed data remain when flush buffer, dropped');
                    } else {
                        if (consumed > 0) {
                            var stashArray = new Uint8Array(this._stashBuffer, 0, this._bufferSize);
                            var remainArray = new Uint8Array(buffer, consumed);
                            stashArray.set(remainArray, 0);
                            this._stashUsed = remainArray.byteLength;
                            this._stashByteStart += consumed;
                        }
                        return 0;
                    }
                }
                this._stashUsed = 0;
                this._stashByteStart = 0;
                return remain;
            }
            return 0;
        }
    }, {
        key: '_onLoaderComplete',
        value: function _onLoaderComplete(from, to) {
            // Force-flush stash buffer, and drop unconsumed data
            this._flushStashBuffer(true);

            if (this._onComplete) {
                this._onComplete(this._extraData);
            }
        }
    }, {
        key: '_onLoaderError',
        value: function _onLoaderError(type, data) {
            _logger2.default.e(this.TAG, 'Loader error, code = ' + data.code + ', msg = ' + data.msg);

            this._flushStashBuffer(false);

            if (this._isEarlyEofReconnecting) {
                // Auto-reconnect for EarlyEof failed, throw UnrecoverableEarlyEof error to upper-layer
                this._isEarlyEofReconnecting = false;
                type = _loader.LoaderErrors.UNRECOVERABLE_EARLY_EOF;
            }

            switch (type) {
                case _loader.LoaderErrors.EARLY_EOF:
                    {
                        if (!this._config.isLive) {
                            // Do internal http reconnect if not live stream
                            if (this._totalLength) {
                                var nextFrom = this._currentRange.to + 1;
                                if (nextFrom < this._totalLength) {
                                    _logger2.default.w(this.TAG, 'Connection lost, trying reconnect...');
                                    this._isEarlyEofReconnecting = true;
                                    this._internalSeek(nextFrom, false);
                                }
                                return;
                            }
                            // else: We don't know totalLength, throw UnrecoverableEarlyEof
                        }
                        // live stream: throw UnrecoverableEarlyEof error to upper-layer
                        type = _loader.LoaderErrors.UNRECOVERABLE_EARLY_EOF;
                        break;
                    }
                case _loader.LoaderErrors.UNRECOVERABLE_EARLY_EOF:
                case _loader.LoaderErrors.CONNECTING_TIMEOUT:
                case _loader.LoaderErrors.HTTP_STATUS_CODE_INVALID:
                case _loader.LoaderErrors.EXCEPTION:
                    break;
            }

            if (this._onError) {
                this._onError(type, data);
            } else {
                throw new _exception.RuntimeException('IOException: ' + data.msg);
            }
        }
    }, {
        key: 'status',
        get: function get() {
            return this._loader.status;
        }
    }, {
        key: 'extraData',
        get: function get() {
            return this._extraData;
        },
        set: function set(data) {
            this._extraData = data;
        }

        // prototype: function onDataArrival(chunks: ArrayBuffer, byteStart: number): number

    }, {
        key: 'onDataArrival',
        get: function get() {
            return this._onDataArrival;
        },
        set: function set(callback) {
            this._onDataArrival = callback;
        }
    }, {
        key: 'onSeeked',
        get: function get() {
            return this._onSeeked;
        },
        set: function set(callback) {
            this._onSeeked = callback;
        }

        // prototype: function onError(type: number, info: {code: number, msg: string}): void

    }, {
        key: 'onError',
        get: function get() {
            return this._onError;
        },
        set: function set(callback) {
            this._onError = callback;
        }
    }, {
        key: 'onComplete',
        get: function get() {
            return this._onComplete;
        },
        set: function set(callback) {
            this._onComplete = callback;
        }
    }, {
        key: 'onRedirect',
        get: function get() {
            return this._onRedirect;
        },
        set: function set(callback) {
            this._onRedirect = callback;
        }
    }, {
        key: 'onRecoveredEarlyEof',
        get: function get() {
            return this._onRecoveredEarlyEof;
        },
        set: function set(callback) {
            this._onRecoveredEarlyEof = callback;
        }
    }, {
        key: 'currentURL',
        get: function get() {
            return this._dataSource.url;
        }
    }, {
        key: 'hasRedirect',
        get: function get() {
            return this._redirectedURL != null || this._dataSource.redirectedURL != undefined;
        }
    }, {
        key: 'currentRedirectedURL',
        get: function get() {
            return this._redirectedURL || this._dataSource.redirectedURL;
        }

        // in KB/s

    }, {
        key: 'currentSpeed',
        get: function get() {
            if (this._loaderClass === _xhrRangeLoader2.default) {
                // SpeedSampler is inaccuracy if loader is RangeLoader
                return this._loader.currentSpeed;
            }
            return this._speedSampler.lastSecondKBps;
        }
    }, {
        key: 'loaderType',
        get: function get() {
            return this._loader.type;
        }
    }]);

    return IOController;
}();

exports.default = IOController;

},{"../utils/exception.js":41,"../utils/logger.js":42,"./fetch-stream-loader.js":23,"./loader.js":25,"./param-seek-handler.js":26,"./range-seek-handler.js":27,"./speed-sampler.js":28,"./websocket-loader.js":29,"./xhr-moz-chunked-loader.js":30,"./xhr-msstream-loader.js":31,"./xhr-range-loader.js":32}],25:[function(_dereq_,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.BaseLoader = exports.LoaderErrors = exports.LoaderStatus = undefined;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); /*
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * Copyright (C) 2016 Bilibili. All Rights Reserved.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * @author zheng qian <xqq@xqq.im>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * Licensed under the Apache License, Version 2.0 (the "License");
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * you may not use this file except in compliance with the License.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * You may obtain a copy of the License at
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *     http://www.apache.org/licenses/LICENSE-2.0
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * Unless required by applicable law or agreed to in writing, software
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * distributed under the License is distributed on an "AS IS" BASIS,
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * See the License for the specific language governing permissions and
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * limitations under the License.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      */

var _exception = _dereq_('../utils/exception.js');

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var LoaderStatus = exports.LoaderStatus = {
    kIdle: 0,
    kConnecting: 1,
    kBuffering: 2,
    kError: 3,
    kComplete: 4
};

var LoaderErrors = exports.LoaderErrors = {
    OK: 'OK',
    EXCEPTION: 'Exception',
    HTTP_STATUS_CODE_INVALID: 'HttpStatusCodeInvalid',
    CONNECTING_TIMEOUT: 'ConnectingTimeout',
    EARLY_EOF: 'EarlyEof',
    UNRECOVERABLE_EARLY_EOF: 'UnrecoverableEarlyEof'
};

/* Loader has callbacks which have following prototypes:
 *     function onContentLengthKnown(contentLength: number): void
 *     function onURLRedirect(url: string): void
 *     function onDataArrival(chunk: ArrayBuffer, byteStart: number, receivedLength: number): void
 *     function onError(errorType: number, errorInfo: {code: number, msg: string}): void
 *     function onComplete(rangeFrom: number, rangeTo: number): void
 */

var BaseLoader = exports.BaseLoader = function () {
    function BaseLoader(typeName) {
        _classCallCheck(this, BaseLoader);

        this._type = typeName || 'undefined';
        this._status = LoaderStatus.kIdle;
        this._needStash = false;
        // callbacks
        this._onContentLengthKnown = null;
        this._onURLRedirect = null;
        this._onDataArrival = null;
        this._onError = null;
        this._onComplete = null;
    }

    _createClass(BaseLoader, [{
        key: 'destroy',
        value: function destroy() {
            this._status = LoaderStatus.kIdle;
            this._onContentLengthKnown = null;
            this._onURLRedirect = null;
            this._onDataArrival = null;
            this._onError = null;
            this._onComplete = null;
        }
    }, {
        key: 'isWorking',
        value: function isWorking() {
            return this._status === LoaderStatus.kConnecting || this._status === LoaderStatus.kBuffering;
        }
    }, {
        key: 'open',


        // pure virtual
        value: function open(dataSource, range) {
            throw new _exception.NotImplementedException('Unimplemented abstract function!');
        }
    }, {
        key: 'abort',
        value: function abort() {
            throw new _exception.NotImplementedException('Unimplemented abstract function!');
        }
    }, {
        key: 'type',
        get: function get() {
            return this._type;
        }
    }, {
        key: 'status',
        get: function get() {
            return this._status;
        }
    }, {
        key: 'needStashBuffer',
        get: function get() {
            return this._needStash;
        }
    }, {
        key: 'onContentLengthKnown',
        get: function get() {
            return this._onContentLengthKnown;
        },
        set: function set(callback) {
            this._onContentLengthKnown = callback;
        }
    }, {
        key: 'onURLRedirect',
        get: function get() {
            return this._onURLRedirect;
        },
        set: function set(callback) {
            this._onURLRedirect = callback;
        }
    }, {
        key: 'onDataArrival',
        get: function get() {
            return this._onDataArrival;
        },
        set: function set(callback) {
            this._onDataArrival = callback;
        }
    }, {
        key: 'onError',
        get: function get() {
            return this._onError;
        },
        set: function set(callback) {
            this._onError = callback;
        }
    }, {
        key: 'onComplete',
        get: function get() {
            return this._onComplete;
        },
        set: function set(callback) {
            this._onComplete = callback;
        }
    }]);

    return BaseLoader;
}();

},{"../utils/exception.js":41}],26:[function(_dereq_,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/*
 * Copyright (C) 2016 Bilibili. All Rights Reserved.
 *
 * @author zheng qian <xqq@xqq.im>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var ParamSeekHandler = function () {
    function ParamSeekHandler(paramStart, paramEnd) {
        _classCallCheck(this, ParamSeekHandler);

        this._startName = paramStart;
        this._endName = paramEnd;
    }

    _createClass(ParamSeekHandler, [{
        key: 'getConfig',
        value: function getConfig(baseUrl, range) {
            var url = baseUrl;

            if (range.from !== 0 || range.to !== -1) {
                var needAnd = true;
                if (url.indexOf('?') === -1) {
                    url += '?';
                    needAnd = false;
                }

                if (needAnd) {
                    url += '&';
                }

                url += this._startName + '=' + range.from.toString();

                if (range.to !== -1) {
                    url += '&' + this._endName + '=' + range.to.toString();
                }
            }

            return {
                url: url,
                headers: {}
            };
        }
    }, {
        key: 'removeURLParameters',
        value: function removeURLParameters(seekedURL) {
            var baseURL = seekedURL.split('?')[0];
            var params = undefined;

            var queryIndex = seekedURL.indexOf('?');
            if (queryIndex !== -1) {
                params = seekedURL.substring(queryIndex + 1);
            }

            var resultParams = '';

            if (params != undefined && params.length > 0) {
                var pairs = params.split('&');

                for (var i = 0; i < pairs.length; i++) {
                    var pair = pairs[i].split('=');
                    var requireAnd = i > 0;

                    if (pair[0] !== this._startName && pair[0] !== this._endName) {
                        if (requireAnd) {
                            resultParams += '&';
                        }
                        resultParams += pairs[i];
                    }
                }
            }

            return resultParams.length === 0 ? baseURL : baseURL + '?' + resultParams;
        }
    }]);

    return ParamSeekHandler;
}();

exports.default = ParamSeekHandler;

},{}],27:[function(_dereq_,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/*
 * Copyright (C) 2016 Bilibili. All Rights Reserved.
 *
 * @author zheng qian <xqq@xqq.im>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var RangeSeekHandler = function () {
    function RangeSeekHandler(zeroStart) {
        _classCallCheck(this, RangeSeekHandler);

        this._zeroStart = zeroStart || false;
    }

    _createClass(RangeSeekHandler, [{
        key: 'getConfig',
        value: function getConfig(url, range) {
            var headers = {};

            if (range.from !== 0 || range.to !== -1) {
                var param = void 0;
                if (range.to !== -1) {
                    param = 'bytes=' + range.from.toString() + '-' + range.to.toString();
                } else {
                    param = 'bytes=' + range.from.toString() + '-';
                }
                headers['Range'] = param;
            } else if (this._zeroStart) {
                headers['Range'] = 'bytes=0-';
            }

            return {
                url: url,
                headers: headers
            };
        }
    }, {
        key: 'removeURLParameters',
        value: function removeURLParameters(seekedURL) {
            return seekedURL;
        }
    }]);

    return RangeSeekHandler;
}();

exports.default = RangeSeekHandler;

},{}],28:[function(_dereq_,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/*
 * Copyright (C) 2016 Bilibili. All Rights Reserved.
 *
 * @author zheng qian <xqq@xqq.im>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// Utility class to calculate realtime network I/O speed
var SpeedSampler = function () {
    function SpeedSampler() {
        _classCallCheck(this, SpeedSampler);

        // milliseconds
        this._firstCheckpoint = 0;
        this._lastCheckpoint = 0;
        this._intervalBytes = 0;
        this._totalBytes = 0;
        this._lastSecondBytes = 0;

        // compatibility detection
        if (self.performance && self.performance.now) {
            this._now = self.performance.now.bind(self.performance);
        } else {
            this._now = Date.now;
        }
    }

    _createClass(SpeedSampler, [{
        key: "reset",
        value: function reset() {
            this._firstCheckpoint = this._lastCheckpoint = 0;
            this._totalBytes = this._intervalBytes = 0;
            this._lastSecondBytes = 0;
        }
    }, {
        key: "addBytes",
        value: function addBytes(bytes) {
            if (this._firstCheckpoint === 0) {
                this._firstCheckpoint = this._now();
                this._lastCheckpoint = this._firstCheckpoint;
                this._intervalBytes += bytes;
                this._totalBytes += bytes;
            } else if (this._now() - this._lastCheckpoint < 1000) {
                this._intervalBytes += bytes;
                this._totalBytes += bytes;
            } else {
                // duration >= 1000
                this._lastSecondBytes = this._intervalBytes;
                this._intervalBytes = bytes;
                this._totalBytes += bytes;
                this._lastCheckpoint = this._now();
            }
        }
    }, {
        key: "currentKBps",
        get: function get() {
            this.addBytes(0);

            var durationSeconds = (this._now() - this._lastCheckpoint) / 1000;
            if (durationSeconds == 0) durationSeconds = 1;
            return this._intervalBytes / durationSeconds / 1024;
        }
    }, {
        key: "lastSecondKBps",
        get: function get() {
            this.addBytes(0);

            if (this._lastSecondBytes !== 0) {
                return this._lastSecondBytes / 1024;
            } else {
                // lastSecondBytes === 0
                if (this._now() - this._lastCheckpoint >= 500) {
                    // if time interval since last checkpoint has exceeded 500ms
                    // the speed is nearly accurate
                    return this.currentKBps;
                } else {
                    // We don't know
                    return 0;
                }
            }
        }
    }, {
        key: "averageKBps",
        get: function get() {
            var durationSeconds = (this._now() - this._firstCheckpoint) / 1000;
            return this._totalBytes / durationSeconds / 1024;
        }
    }]);

    return SpeedSampler;
}();

exports.default = SpeedSampler;

},{}],29:[function(_dereq_,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _logger = _dereq_('../utils/logger.js');

var _logger2 = _interopRequireDefault(_logger);

var _loader = _dereq_('./loader.js');

var _exception = _dereq_('../utils/exception.js');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; } /*
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * Copyright (C) 2016 Bilibili. All Rights Reserved.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * @author zheng qian <xqq@xqq.im>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * Licensed under the Apache License, Version 2.0 (the "License");
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * you may not use this file except in compliance with the License.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * You may obtain a copy of the License at
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                *     http://www.apache.org/licenses/LICENSE-2.0
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * Unless required by applicable law or agreed to in writing, software
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * distributed under the License is distributed on an "AS IS" BASIS,
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * See the License for the specific language governing permissions and
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * limitations under the License.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                */

// For FLV over WebSocket live stream
var WebSocketLoader = function (_BaseLoader) {
    _inherits(WebSocketLoader, _BaseLoader);

    _createClass(WebSocketLoader, null, [{
        key: 'isSupported',
        value: function isSupported() {
            try {
                return typeof self.WebSocket !== 'undefined';
            } catch (e) {
                return false;
            }
        }
    }]);

    function WebSocketLoader() {
        _classCallCheck(this, WebSocketLoader);

        var _this = _possibleConstructorReturn(this, (WebSocketLoader.__proto__ || Object.getPrototypeOf(WebSocketLoader)).call(this, 'websocket-loader'));

        _this.TAG = 'WebSocketLoader';

        _this._needStash = true;

        _this._ws = null;
        _this._requestAbort = false;
        _this._receivedLength = 0;
        return _this;
    }

    _createClass(WebSocketLoader, [{
        key: 'destroy',
        value: function destroy() {
            if (this._ws) {
                this.abort();
            }
            _get(WebSocketLoader.prototype.__proto__ || Object.getPrototypeOf(WebSocketLoader.prototype), 'destroy', this).call(this);
        }
    }, {
        key: 'open',
        value: function open(dataSource) {
            try {
                var ws = this._ws = new self.WebSocket(dataSource.url);
                ws.binaryType = 'arraybuffer';
                ws.onopen = this._onWebSocketOpen.bind(this);
                ws.onclose = this._onWebSocketClose.bind(this);
                ws.onmessage = this._onWebSocketMessage.bind(this);
                ws.onerror = this._onWebSocketError.bind(this);

                this._status = _loader.LoaderStatus.kConnecting;
            } catch (e) {
                this._status = _loader.LoaderStatus.kError;

                var info = { code: e.code, msg: e.message };

                if (this._onError) {
                    this._onError(_loader.LoaderErrors.EXCEPTION, info);
                } else {
                    throw new _exception.RuntimeException(info.msg);
                }
            }
        }
    }, {
        key: 'abort',
        value: function abort() {
            var ws = this._ws;
            if (ws && (ws.readyState === 0 || ws.readyState === 1)) {
                // CONNECTING || OPEN
                this._requestAbort = true;
                ws.close();
            }

            this._ws = null;
            this._status = _loader.LoaderStatus.kComplete;
        }
    }, {
        key: '_onWebSocketOpen',
        value: function _onWebSocketOpen(e) {
            this._status = _loader.LoaderStatus.kBuffering;
        }
    }, {
        key: '_onWebSocketClose',
        value: function _onWebSocketClose(e) {
            if (this._requestAbort === true) {
                this._requestAbort = false;
                return;
            }

            this._status = _loader.LoaderStatus.kComplete;

            if (this._onComplete) {
                this._onComplete(0, this._receivedLength - 1);
            }
        }
    }, {
        key: '_onWebSocketMessage',
        value: function _onWebSocketMessage(e) {
            var _this2 = this;

            if (e.data instanceof ArrayBuffer) {
                this._dispatchArrayBuffer(e.data);
            } else if (e.data instanceof Blob) {
                var reader = new FileReader();
                reader.onload = function () {
                    _this2._dispatchArrayBuffer(reader.result);
                };
                reader.readAsArrayBuffer(e.data);
            } else {
                this._status = _loader.LoaderStatus.kError;
                var info = { code: -1, msg: 'Unsupported WebSocket message type: ' + e.data.constructor.name };

                if (this._onError) {
                    this._onError(_loader.LoaderErrors.EXCEPTION, info);
                } else {
                    throw new _exception.RuntimeException(info.msg);
                }
            }
        }
    }, {
        key: '_dispatchArrayBuffer',
        value: function _dispatchArrayBuffer(arraybuffer) {
            var chunk = arraybuffer;
            var byteStart = this._receivedLength;
            this._receivedLength += chunk.byteLength;

            if (this._onDataArrival) {
                this._onDataArrival(chunk, byteStart, this._receivedLength);
            }
        }
    }, {
        key: '_onWebSocketError',
        value: function _onWebSocketError(e) {
            this._status = _loader.LoaderStatus.kError;

            var info = {
                code: e.code,
                msg: e.message
            };

            if (this._onError) {
                this._onError(_loader.LoaderErrors.EXCEPTION, info);
            } else {
                throw new _exception.RuntimeException(info.msg);
            }
        }
    }]);

    return WebSocketLoader;
}(_loader.BaseLoader);

exports.default = WebSocketLoader;

},{"../utils/exception.js":41,"../utils/logger.js":42,"./loader.js":25}],30:[function(_dereq_,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _logger = _dereq_('../utils/logger.js');

var _logger2 = _interopRequireDefault(_logger);

var _loader = _dereq_('./loader.js');

var _exception = _dereq_('../utils/exception.js');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; } /*
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * Copyright (C) 2016 Bilibili. All Rights Reserved.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * @author zheng qian <xqq@xqq.im>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * Licensed under the Apache License, Version 2.0 (the "License");
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * you may not use this file except in compliance with the License.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * You may obtain a copy of the License at
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                *     http://www.apache.org/licenses/LICENSE-2.0
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * Unless required by applicable law or agreed to in writing, software
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * distributed under the License is distributed on an "AS IS" BASIS,
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * See the License for the specific language governing permissions and
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * limitations under the License.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                */

// For FireFox browser which supports `xhr.responseType = 'moz-chunked-arraybuffer'`
var MozChunkedLoader = function (_BaseLoader) {
    _inherits(MozChunkedLoader, _BaseLoader);

    _createClass(MozChunkedLoader, null, [{
        key: 'isSupported',
        value: function isSupported() {
            try {
                var xhr = new XMLHttpRequest();
                // Firefox 37- requires .open() to be called before setting responseType
                xhr.open('GET', 'https://example.com', true);
                xhr.responseType = 'moz-chunked-arraybuffer';
                return xhr.responseType === 'moz-chunked-arraybuffer';
            } catch (e) {
                _logger2.default.w('MozChunkedLoader', e.message);
                return false;
            }
        }
    }]);

    function MozChunkedLoader(seekHandler, config) {
        _classCallCheck(this, MozChunkedLoader);

        var _this = _possibleConstructorReturn(this, (MozChunkedLoader.__proto__ || Object.getPrototypeOf(MozChunkedLoader)).call(this, 'xhr-moz-chunked-loader'));

        _this.TAG = 'MozChunkedLoader';

        _this._seekHandler = seekHandler;
        _this._config = config;
        _this._needStash = true;

        _this._xhr = null;
        _this._requestAbort = false;
        _this._contentLength = null;
        _this._receivedLength = 0;
        return _this;
    }

    _createClass(MozChunkedLoader, [{
        key: 'destroy',
        value: function destroy() {
            if (this.isWorking()) {
                this.abort();
            }
            if (this._xhr) {
                this._xhr.onreadystatechange = null;
                this._xhr.onprogress = null;
                this._xhr.onloadend = null;
                this._xhr.onerror = null;
                this._xhr = null;
            }
            _get(MozChunkedLoader.prototype.__proto__ || Object.getPrototypeOf(MozChunkedLoader.prototype), 'destroy', this).call(this);
        }
    }, {
        key: 'open',
        value: function open(dataSource, range) {
            this._dataSource = dataSource;
            this._range = range;

            var sourceURL = dataSource.url;
            if (this._config.reuseRedirectedURL && dataSource.redirectedURL != undefined) {
                sourceURL = dataSource.redirectedURL;
            }

            var seekConfig = this._seekHandler.getConfig(sourceURL, range);
            this._requestURL = seekConfig.url;

            var xhr = this._xhr = new XMLHttpRequest();
            xhr.open('GET', seekConfig.url, true);
            xhr.responseType = 'moz-chunked-arraybuffer';
            xhr.onreadystatechange = this._onReadyStateChange.bind(this);
            xhr.onprogress = this._onProgress.bind(this);
            xhr.onloadend = this._onLoadEnd.bind(this);
            xhr.onerror = this._onXhrError.bind(this);

            // cors is auto detected and enabled by xhr

            // withCredentials is disabled by default
            if (dataSource.withCredentials) {
                xhr.withCredentials = true;
            }

            if (_typeof(seekConfig.headers) === 'object') {
                var headers = seekConfig.headers;

                for (var key in headers) {
                    if (headers.hasOwnProperty(key)) {
                        xhr.setRequestHeader(key, headers[key]);
                    }
                }
            }

            this._status = _loader.LoaderStatus.kConnecting;
            xhr.send();
        }
    }, {
        key: 'abort',
        value: function abort() {
            this._requestAbort = true;
            if (this._xhr) {
                this._xhr.abort();
            }
            this._status = _loader.LoaderStatus.kComplete;
        }
    }, {
        key: '_onReadyStateChange',
        value: function _onReadyStateChange(e) {
            var xhr = e.target;

            if (xhr.readyState === 2) {
                // HEADERS_RECEIVED
                if (xhr.responseURL != undefined && xhr.responseURL !== this._requestURL) {
                    if (this._onURLRedirect) {
                        var redirectedURL = this._seekHandler.removeURLParameters(xhr.responseURL);
                        this._onURLRedirect(redirectedURL);
                    }
                }

                if (xhr.status !== 0 && (xhr.status < 200 || xhr.status > 299)) {
                    this._status = _loader.LoaderStatus.kError;
                    if (this._onError) {
                        this._onError(_loader.LoaderErrors.HTTP_STATUS_CODE_INVALID, { code: xhr.status, msg: xhr.statusText });
                    } else {
                        throw new _exception.RuntimeException('MozChunkedLoader: Http code invalid, ' + xhr.status + ' ' + xhr.statusText);
                    }
                } else {
                    this._status = _loader.LoaderStatus.kBuffering;
                }
            }
        }
    }, {
        key: '_onProgress',
        value: function _onProgress(e) {
            if (this._status === _loader.LoaderStatus.kError) {
                // Ignore error response
                return;
            }

            if (this._contentLength === null) {
                if (e.total !== null && e.total !== 0) {
                    this._contentLength = e.total;
                    if (this._onContentLengthKnown) {
                        this._onContentLengthKnown(this._contentLength);
                    }
                }
            }

            var chunk = e.target.response;
            var byteStart = this._range.from + this._receivedLength;
            this._receivedLength += chunk.byteLength;

            if (this._onDataArrival) {
                this._onDataArrival(chunk, byteStart, this._receivedLength);
            }
        }
    }, {
        key: '_onLoadEnd',
        value: function _onLoadEnd(e) {
            if (this._requestAbort === true) {
                this._requestAbort = false;
                return;
            } else if (this._status === _loader.LoaderStatus.kError) {
                return;
            }

            this._status = _loader.LoaderStatus.kComplete;
            if (this._onComplete) {
                this._onComplete(this._range.from, this._range.from + this._receivedLength - 1);
            }
        }
    }, {
        key: '_onXhrError',
        value: function _onXhrError(e) {
            this._status = _loader.LoaderStatus.kError;
            var type = 0;
            var info = null;

            if (this._contentLength && e.loaded < this._contentLength) {
                type = _loader.LoaderErrors.EARLY_EOF;
                info = { code: -1, msg: 'Moz-Chunked stream meet Early-Eof' };
            } else {
                type = _loader.LoaderErrors.EXCEPTION;
                info = { code: -1, msg: e.constructor.name + ' ' + e.type };
            }

            if (this._onError) {
                this._onError(type, info);
            } else {
                throw new _exception.RuntimeException(info.msg);
            }
        }
    }]);

    return MozChunkedLoader;
}(_loader.BaseLoader);

exports.default = MozChunkedLoader;

},{"../utils/exception.js":41,"../utils/logger.js":42,"./loader.js":25}],31:[function(_dereq_,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _logger = _dereq_('../utils/logger.js');

var _logger2 = _interopRequireDefault(_logger);

var _loader = _dereq_('./loader.js');

var _exception = _dereq_('../utils/exception.js');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; } /*
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * Copyright (C) 2016 Bilibili. All Rights Reserved.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * @author zheng qian <xqq@xqq.im>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * Licensed under the Apache License, Version 2.0 (the "License");
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * you may not use this file except in compliance with the License.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * You may obtain a copy of the License at
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                *     http://www.apache.org/licenses/LICENSE-2.0
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * Unless required by applicable law or agreed to in writing, software
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * distributed under the License is distributed on an "AS IS" BASIS,
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * See the License for the specific language governing permissions and
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * limitations under the License.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                */

/* Notice: ms-stream may cause IE/Edge browser crash if seek too frequently!!!
 * The browser may crash in wininet.dll. Disable for now.
 *
 * For IE11/Edge browser by microsoft which supports `xhr.responseType = 'ms-stream'`
 * Notice that ms-stream API sucks. The buffer is always expanding along with downloading.
 *
 * We need to abort the xhr if buffer size exceeded limit size (e.g. 16 MiB), then do reconnect.
 * in order to release previous ArrayBuffer to avoid memory leak
 *
 * Otherwise, the ArrayBuffer will increase to a terrible size that equals final file size.
 */
var MSStreamLoader = function (_BaseLoader) {
    _inherits(MSStreamLoader, _BaseLoader);

    _createClass(MSStreamLoader, null, [{
        key: 'isSupported',
        value: function isSupported() {
            try {
                if (typeof self.MSStream === 'undefined' || typeof self.MSStreamReader === 'undefined') {
                    return false;
                }

                var xhr = new XMLHttpRequest();
                xhr.open('GET', 'https://example.com', true);
                xhr.responseType = 'ms-stream';
                return xhr.responseType === 'ms-stream';
            } catch (e) {
                _logger2.default.w('MSStreamLoader', e.message);
                return false;
            }
        }
    }]);

    function MSStreamLoader(seekHandler, config) {
        _classCallCheck(this, MSStreamLoader);

        var _this = _possibleConstructorReturn(this, (MSStreamLoader.__proto__ || Object.getPrototypeOf(MSStreamLoader)).call(this, 'xhr-msstream-loader'));

        _this.TAG = 'MSStreamLoader';

        _this._seekHandler = seekHandler;
        _this._config = config;
        _this._needStash = true;

        _this._xhr = null;
        _this._reader = null; // MSStreamReader

        _this._totalRange = null;
        _this._currentRange = null;

        _this._currentRequestURL = null;
        _this._currentRedirectedURL = null;

        _this._contentLength = null;
        _this._receivedLength = 0;

        _this._bufferLimit = 16 * 1024 * 1024; // 16MB
        _this._lastTimeBufferSize = 0;
        _this._isReconnecting = false;
        return _this;
    }

    _createClass(MSStreamLoader, [{
        key: 'destroy',
        value: function destroy() {
            if (this.isWorking()) {
                this.abort();
            }
            if (this._reader) {
                this._reader.onprogress = null;
                this._reader.onload = null;
                this._reader.onerror = null;
                this._reader = null;
            }
            if (this._xhr) {
                this._xhr.onreadystatechange = null;
                this._xhr = null;
            }
            _get(MSStreamLoader.prototype.__proto__ || Object.getPrototypeOf(MSStreamLoader.prototype), 'destroy', this).call(this);
        }
    }, {
        key: 'open',
        value: function open(dataSource, range) {
            this._internalOpen(dataSource, range, false);
        }
    }, {
        key: '_internalOpen',
        value: function _internalOpen(dataSource, range, isSubrange) {
            this._dataSource = dataSource;

            if (!isSubrange) {
                this._totalRange = range;
            } else {
                this._currentRange = range;
            }

            var sourceURL = dataSource.url;
            if (this._config.reuseRedirectedURL) {
                if (this._currentRedirectedURL != undefined) {
                    sourceURL = this._currentRedirectedURL;
                } else if (dataSource.redirectedURL != undefined) {
                    sourceURL = dataSource.redirectedURL;
                }
            }

            var seekConfig = this._seekHandler.getConfig(sourceURL, range);
            this._currentRequestURL = seekConfig.url;

            var reader = this._reader = new self.MSStreamReader();
            reader.onprogress = this._msrOnProgress.bind(this);
            reader.onload = this._msrOnLoad.bind(this);
            reader.onerror = this._msrOnError.bind(this);

            var xhr = this._xhr = new XMLHttpRequest();
            xhr.open('GET', seekConfig.url, true);
            xhr.responseType = 'ms-stream';
            xhr.onreadystatechange = this._xhrOnReadyStateChange.bind(this);
            xhr.onerror = this._xhrOnError.bind(this);

            if (dataSource.withCredentials) {
                xhr.withCredentials = true;
            }

            if (_typeof(seekConfig.headers) === 'object') {
                var headers = seekConfig.headers;

                for (var key in headers) {
                    if (headers.hasOwnProperty(key)) {
                        xhr.setRequestHeader(key, headers[key]);
                    }
                }
            }

            if (this._isReconnecting) {
                this._isReconnecting = false;
            } else {
                this._status = _loader.LoaderStatus.kConnecting;
            }
            xhr.send();
        }
    }, {
        key: 'abort',
        value: function abort() {
            this._internalAbort();
            this._status = _loader.LoaderStatus.kComplete;
        }
    }, {
        key: '_internalAbort',
        value: function _internalAbort() {
            if (this._reader) {
                if (this._reader.readyState === 1) {
                    // LOADING
                    this._reader.abort();
                }
                this._reader.onprogress = null;
                this._reader.onload = null;
                this._reader.onerror = null;
                this._reader = null;
            }
            if (this._xhr) {
                this._xhr.abort();
                this._xhr.onreadystatechange = null;
                this._xhr = null;
            }
        }
    }, {
        key: '_xhrOnReadyStateChange',
        value: function _xhrOnReadyStateChange(e) {
            var xhr = e.target;

            if (xhr.readyState === 2) {
                // HEADERS_RECEIVED
                if (xhr.status >= 200 && xhr.status <= 299) {
                    this._status = _loader.LoaderStatus.kBuffering;

                    if (xhr.responseURL != undefined) {
                        var redirectedURL = this._seekHandler.removeURLParameters(xhr.responseURL);
                        if (xhr.responseURL !== this._currentRequestURL && redirectedURL !== this._currentRedirectedURL) {
                            this._currentRedirectedURL = redirectedURL;
                            if (this._onURLRedirect) {
                                this._onURLRedirect(redirectedURL);
                            }
                        }
                    }

                    var lengthHeader = xhr.getResponseHeader('Content-Length');
                    if (lengthHeader != null && this._contentLength == null) {
                        var length = parseInt(lengthHeader);
                        if (length > 0) {
                            this._contentLength = length;
                            if (this._onContentLengthKnown) {
                                this._onContentLengthKnown(this._contentLength);
                            }
                        }
                    }
                } else {
                    this._status = _loader.LoaderStatus.kError;
                    if (this._onError) {
                        this._onError(_loader.LoaderErrors.HTTP_STATUS_CODE_INVALID, { code: xhr.status, msg: xhr.statusText });
                    } else {
                        throw new _exception.RuntimeException('MSStreamLoader: Http code invalid, ' + xhr.status + ' ' + xhr.statusText);
                    }
                }
            } else if (xhr.readyState === 3) {
                // LOADING
                if (xhr.status >= 200 && xhr.status <= 299) {
                    this._status = _loader.LoaderStatus.kBuffering;

                    var msstream = xhr.response;
                    this._reader.readAsArrayBuffer(msstream);
                }
            }
        }
    }, {
        key: '_xhrOnError',
        value: function _xhrOnError(e) {
            this._status = _loader.LoaderStatus.kError;
            var type = _loader.LoaderErrors.EXCEPTION;
            var info = { code: -1, msg: e.constructor.name + ' ' + e.type };

            if (this._onError) {
                this._onError(type, info);
            } else {
                throw new _exception.RuntimeException(info.msg);
            }
        }
    }, {
        key: '_msrOnProgress',
        value: function _msrOnProgress(e) {
            var reader = e.target;
            var bigbuffer = reader.result;
            if (bigbuffer == null) {
                // result may be null, workaround for buggy M$
                this._doReconnectIfNeeded();
                return;
            }

            var slice = bigbuffer.slice(this._lastTimeBufferSize);
            this._lastTimeBufferSize = bigbuffer.byteLength;
            var byteStart = this._totalRange.from + this._receivedLength;
            this._receivedLength += slice.byteLength;

            if (this._onDataArrival) {
                this._onDataArrival(slice, byteStart, this._receivedLength);
            }

            if (bigbuffer.byteLength >= this._bufferLimit) {
                _logger2.default.v(this.TAG, 'MSStream buffer exceeded max size near ' + (byteStart + slice.byteLength) + ', reconnecting...');
                this._doReconnectIfNeeded();
            }
        }
    }, {
        key: '_doReconnectIfNeeded',
        value: function _doReconnectIfNeeded() {
            if (this._contentLength == null || this._receivedLength < this._contentLength) {
                this._isReconnecting = true;
                this._lastTimeBufferSize = 0;
                this._internalAbort();

                var range = {
                    from: this._totalRange.from + this._receivedLength,
                    to: -1
                };
                this._internalOpen(this._dataSource, range, true);
            }
        }
    }, {
        key: '_msrOnLoad',
        value: function _msrOnLoad(e) {
            // actually it is onComplete event
            this._status = _loader.LoaderStatus.kComplete;
            if (this._onComplete) {
                this._onComplete(this._totalRange.from, this._totalRange.from + this._receivedLength - 1);
            }
        }
    }, {
        key: '_msrOnError',
        value: function _msrOnError(e) {
            this._status = _loader.LoaderStatus.kError;
            var type = 0;
            var info = null;

            if (this._contentLength && this._receivedLength < this._contentLength) {
                type = _loader.LoaderErrors.EARLY_EOF;
                info = { code: -1, msg: 'MSStream meet Early-Eof' };
            } else {
                type = _loader.LoaderErrors.EARLY_EOF;
                info = { code: -1, msg: e.constructor.name + ' ' + e.type };
            }

            if (this._onError) {
                this._onError(type, info);
            } else {
                throw new _exception.RuntimeException(info.msg);
            }
        }
    }]);

    return MSStreamLoader;
}(_loader.BaseLoader);

exports.default = MSStreamLoader;

},{"../utils/exception.js":41,"../utils/logger.js":42,"./loader.js":25}],32:[function(_dereq_,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _logger = _dereq_('../utils/logger.js');

var _logger2 = _interopRequireDefault(_logger);

var _speedSampler = _dereq_('./speed-sampler.js');

var _speedSampler2 = _interopRequireDefault(_speedSampler);

var _loader = _dereq_('./loader.js');

var _exception = _dereq_('../utils/exception.js');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; } /*
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * Copyright (C) 2016 Bilibili. All Rights Reserved.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * @author zheng qian <xqq@xqq.im>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * Licensed under the Apache License, Version 2.0 (the "License");
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * you may not use this file except in compliance with the License.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * You may obtain a copy of the License at
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                *     http://www.apache.org/licenses/LICENSE-2.0
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * Unless required by applicable law or agreed to in writing, software
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * distributed under the License is distributed on an "AS IS" BASIS,
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * See the License for the specific language governing permissions and
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * limitations under the License.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                */

// Universal IO Loader, implemented by adding Range header in xhr's request header
var RangeLoader = function (_BaseLoader) {
    _inherits(RangeLoader, _BaseLoader);

    _createClass(RangeLoader, null, [{
        key: 'isSupported',
        value: function isSupported() {
            try {
                var xhr = new XMLHttpRequest();
                xhr.open('GET', 'https://example.com', true);
                xhr.responseType = 'arraybuffer';
                return xhr.responseType === 'arraybuffer';
            } catch (e) {
                _logger2.default.w('RangeLoader', e.message);
                return false;
            }
        }
    }]);

    function RangeLoader(seekHandler, config) {
        _classCallCheck(this, RangeLoader);

        var _this = _possibleConstructorReturn(this, (RangeLoader.__proto__ || Object.getPrototypeOf(RangeLoader)).call(this, 'xhr-range-loader'));

        _this.TAG = 'RangeLoader';

        _this._seekHandler = seekHandler;
        _this._config = config;
        _this._needStash = false;

        _this._chunkSizeKBList = [128, 256, 384, 512, 768, 1024, 1536, 2048, 3072, 4096, 5120, 6144, 7168, 8192];
        _this._currentChunkSizeKB = 384;
        _this._currentSpeedNormalized = 0;
        _this._zeroSpeedChunkCount = 0;

        _this._xhr = null;
        _this._speedSampler = new _speedSampler2.default();

        _this._requestAbort = false;
        _this._waitForTotalLength = false;
        _this._totalLengthReceived = false;

        _this._currentRequestURL = null;
        _this._currentRedirectedURL = null;
        _this._currentRequestRange = null;
        _this._totalLength = null; // size of the entire file
        _this._contentLength = null; // Content-Length of entire request range
        _this._receivedLength = 0; // total received bytes
        _this._lastTimeLoaded = 0; // received bytes of current request sub-range
        return _this;
    }

    _createClass(RangeLoader, [{
        key: 'destroy',
        value: function destroy() {
            if (this.isWorking()) {
                this.abort();
            }
            if (this._xhr) {
                this._xhr.onreadystatechange = null;
                this._xhr.onprogress = null;
                this._xhr.onload = null;
                this._xhr.onerror = null;
                this._xhr = null;
            }
            _get(RangeLoader.prototype.__proto__ || Object.getPrototypeOf(RangeLoader.prototype), 'destroy', this).call(this);
        }
    }, {
        key: 'open',
        value: function open(dataSource, range) {
            this._dataSource = dataSource;
            this._range = range;
            this._status = _loader.LoaderStatus.kConnecting;

            var useRefTotalLength = false;
            if (this._dataSource.filesize != undefined && this._dataSource.filesize !== 0) {
                useRefTotalLength = true;
                this._totalLength = this._dataSource.filesize;
            }

            if (!this._totalLengthReceived && !useRefTotalLength) {
                // We need total filesize
                this._waitForTotalLength = true;
                this._internalOpen(this._dataSource, { from: 0, to: -1 });
            } else {
                // We have filesize, start loading
                this._openSubRange();
            }
        }
    }, {
        key: '_openSubRange',
        value: function _openSubRange() {
            var chunkSize = this._currentChunkSizeKB * 1024;

            var from = this._range.from + this._receivedLength;
            var to = from + chunkSize;

            if (this._contentLength != null) {
                if (to - this._range.from >= this._contentLength) {
                    to = this._range.from + this._contentLength - 1;
                }
            }

            this._currentRequestRange = { from: from, to: to };
            this._internalOpen(this._dataSource, this._currentRequestRange);
        }
    }, {
        key: '_internalOpen',
        value: function _internalOpen(dataSource, range) {
            this._lastTimeLoaded = 0;

            var sourceURL = dataSource.url;
            if (this._config.reuseRedirectedURL) {
                if (this._currentRedirectedURL != undefined) {
                    sourceURL = this._currentRedirectedURL;
                } else if (dataSource.redirectedURL != undefined) {
                    sourceURL = dataSource.redirectedURL;
                }
            }

            var seekConfig = this._seekHandler.getConfig(sourceURL, range);
            this._currentRequestURL = seekConfig.url;

            var xhr = this._xhr = new XMLHttpRequest();
            xhr.open('GET', seekConfig.url, true);
            xhr.responseType = 'arraybuffer';
            xhr.onreadystatechange = this._onReadyStateChange.bind(this);
            xhr.onprogress = this._onProgress.bind(this);
            xhr.onload = this._onLoad.bind(this);
            xhr.onerror = this._onXhrError.bind(this);

            if (dataSource.withCredentials) {
                xhr.withCredentials = true;
            }

            if (_typeof(seekConfig.headers) === 'object') {
                var headers = seekConfig.headers;

                for (var key in headers) {
                    if (headers.hasOwnProperty(key)) {
                        xhr.setRequestHeader(key, headers[key]);
                    }
                }
            }

            xhr.send();
        }
    }, {
        key: 'abort',
        value: function abort() {
            this._requestAbort = true;
            this._internalAbort();
            this._status = _loader.LoaderStatus.kComplete;
        }
    }, {
        key: '_internalAbort',
        value: function _internalAbort() {
            if (this._xhr) {
                this._xhr.onreadystatechange = null;
                this._xhr.onprogress = null;
                this._xhr.onload = null;
                this._xhr.onerror = null;
                this._xhr.abort();
                this._xhr = null;
            }
        }
    }, {
        key: '_onReadyStateChange',
        value: function _onReadyStateChange(e) {
            var xhr = e.target;

            if (xhr.readyState === 2) {
                // HEADERS_RECEIVED
                if (xhr.responseURL != undefined) {
                    // if the browser support this property
                    var redirectedURL = this._seekHandler.removeURLParameters(xhr.responseURL);
                    if (xhr.responseURL !== this._currentRequestURL && redirectedURL !== this._currentRedirectedURL) {
                        this._currentRedirectedURL = redirectedURL;
                        if (this._onURLRedirect) {
                            this._onURLRedirect(redirectedURL);
                        }
                    }
                }

                if (xhr.status >= 200 && xhr.status <= 299) {
                    if (this._waitForTotalLength) {
                        return;
                    }
                    this._status = _loader.LoaderStatus.kBuffering;
                } else {
                    this._status = _loader.LoaderStatus.kError;
                    if (this._onError) {
                        this._onError(_loader.LoaderErrors.HTTP_STATUS_CODE_INVALID, { code: xhr.status, msg: xhr.statusText });
                    } else {
                        throw new _exception.RuntimeException('RangeLoader: Http code invalid, ' + xhr.status + ' ' + xhr.statusText);
                    }
                }
            }
        }
    }, {
        key: '_onProgress',
        value: function _onProgress(e) {
            if (this._status === _loader.LoaderStatus.kError) {
                // Ignore error response
                return;
            }

            if (this._contentLength === null) {
                var openNextRange = false;

                if (this._waitForTotalLength) {
                    this._waitForTotalLength = false;
                    this._totalLengthReceived = true;
                    openNextRange = true;

                    var total = e.total;
                    this._internalAbort();
                    if (total != null & total !== 0) {
                        this._totalLength = total;
                    }
                }

                // calculate currrent request range's contentLength
                if (this._range.to === -1) {
                    this._contentLength = this._totalLength - this._range.from;
                } else {
                    // to !== -1
                    this._contentLength = this._range.to - this._range.from + 1;
                }

                if (openNextRange) {
                    this._openSubRange();
                    return;
                }
                if (this._onContentLengthKnown) {
                    this._onContentLengthKnown(this._contentLength);
                }
            }

            var delta = e.loaded - this._lastTimeLoaded;
            this._lastTimeLoaded = e.loaded;
            this._speedSampler.addBytes(delta);
        }
    }, {
        key: '_normalizeSpeed',
        value: function _normalizeSpeed(input) {
            var list = this._chunkSizeKBList;
            var last = list.length - 1;
            var mid = 0;
            var lbound = 0;
            var ubound = last;

            if (input < list[0]) {
                return list[0];
            }

            while (lbound <= ubound) {
                mid = lbound + Math.floor((ubound - lbound) / 2);
                if (mid === last || input >= list[mid] && input < list[mid + 1]) {
                    return list[mid];
                } else if (list[mid] < input) {
                    lbound = mid + 1;
                } else {
                    ubound = mid - 1;
                }
            }
        }
    }, {
        key: '_onLoad',
        value: function _onLoad(e) {
            if (this._status === _loader.LoaderStatus.kError) {
                // Ignore error response
                return;
            }

            if (this._waitForTotalLength) {
                this._waitForTotalLength = false;
                return;
            }

            this._lastTimeLoaded = 0;
            var KBps = this._speedSampler.lastSecondKBps;
            if (KBps === 0) {
                this._zeroSpeedChunkCount++;
                if (this._zeroSpeedChunkCount >= 3) {
                    // Try get currentKBps after 3 chunks
                    KBps = this._speedSampler.currentKBps;
                }
            }

            if (KBps !== 0) {
                var normalized = this._normalizeSpeed(KBps);
                if (this._currentSpeedNormalized !== normalized) {
                    this._currentSpeedNormalized = normalized;
                    this._currentChunkSizeKB = normalized;
                }
            }

            var chunk = e.target.response;
            var byteStart = this._range.from + this._receivedLength;
            this._receivedLength += chunk.byteLength;

            var reportComplete = false;

            if (this._contentLength != null && this._receivedLength < this._contentLength) {
                // continue load next chunk
                this._openSubRange();
            } else {
                reportComplete = true;
            }

            // dispatch received chunk
            if (this._onDataArrival) {
                this._onDataArrival(chunk, byteStart, this._receivedLength);
            }

            if (reportComplete) {
                this._status = _loader.LoaderStatus.kComplete;
                if (this._onComplete) {
                    this._onComplete(this._range.from, this._range.from + this._receivedLength - 1);
                }
            }
        }
    }, {
        key: '_onXhrError',
        value: function _onXhrError(e) {
            this._status = _loader.LoaderStatus.kError;
            var type = 0;
            var info = null;

            if (this._contentLength && this._receivedLength > 0 && this._receivedLength < this._contentLength) {
                type = _loader.LoaderErrors.EARLY_EOF;
                info = { code: -1, msg: 'RangeLoader meet Early-Eof' };
            } else {
                type = _loader.LoaderErrors.EXCEPTION;
                info = { code: -1, msg: e.constructor.name + ' ' + e.type };
            }

            if (this._onError) {
                this._onError(type, info);
            } else {
                throw new _exception.RuntimeException(info.msg);
            }
        }
    }, {
        key: 'currentSpeed',
        get: function get() {
            return this._speedSampler.lastSecondKBps;
        }
    }]);

    return RangeLoader;
}(_loader.BaseLoader);

exports.default = RangeLoader;

},{"../utils/exception.js":41,"../utils/logger.js":42,"./loader.js":25,"./speed-sampler.js":28}],33:[function(_dereq_,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); /*
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * Copyright (C) 2016 Bilibili. All Rights Reserved.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * @author zheng qian <xqq@xqq.im>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * Licensed under the Apache License, Version 2.0 (the "License");
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * you may not use this file except in compliance with the License.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * You may obtain a copy of the License at
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *     http://www.apache.org/licenses/LICENSE-2.0
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * Unless required by applicable law or agreed to in writing, software
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * distributed under the License is distributed on an "AS IS" BASIS,
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * See the License for the specific language governing permissions and
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * limitations under the License.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      */

var _events = _dereq_('events');

var _events2 = _interopRequireDefault(_events);

var _logger = _dereq_('../utils/logger.js');

var _logger2 = _interopRequireDefault(_logger);

var _browser = _dereq_('../utils/browser.js');

var _browser2 = _interopRequireDefault(_browser);

var _playerEvents = _dereq_('./player-events.js');

var _playerEvents2 = _interopRequireDefault(_playerEvents);

var _transmuxer = _dereq_('../core/transmuxer.js');

var _transmuxer2 = _interopRequireDefault(_transmuxer);

var _transmuxingEvents = _dereq_('../core/transmuxing-events.js');

var _transmuxingEvents2 = _interopRequireDefault(_transmuxingEvents);

var _mseController = _dereq_('../core/mse-controller.js');

var _mseController2 = _interopRequireDefault(_mseController);

var _mseEvents = _dereq_('../core/mse-events.js');

var _mseEvents2 = _interopRequireDefault(_mseEvents);

var _playerErrors = _dereq_('./player-errors.js');

var _config = _dereq_('../config.js');

var _exception = _dereq_('../utils/exception.js');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var FlvPlayer = function () {
    function FlvPlayer(mediaDataSource, config) {
        _classCallCheck(this, FlvPlayer);

        this.TAG = 'FlvPlayer';
        this._type = 'FlvPlayer';
        this._emitter = new _events2.default();

        this._config = (0, _config.createDefaultConfig)();
        if ((typeof config === 'undefined' ? 'undefined' : _typeof(config)) === 'object') {
            Object.assign(this._config, config);
        }

        if (mediaDataSource.type.toLowerCase() !== 'flv') {
            throw new _exception.InvalidArgumentException('FlvPlayer requires an flv MediaDataSource input!');
        }

        if (mediaDataSource.isLive === true) {
            this._config.isLive = true;
        }

        this.e = {
            onvLoadedMetadata: this._onvLoadedMetadata.bind(this),
            onvSeeking: this._onvSeeking.bind(this),
            onvCanPlay: this._onvCanPlay.bind(this),
            onvStalled: this._onvStalled.bind(this),
            onvProgress: this._onvProgress.bind(this)
        };

        if (self.performance && self.performance.now) {
            this._now = self.performance.now.bind(self.performance);
        } else {
            this._now = Date.now;
        }

        this._pendingSeekTime = null; // in seconds
        this._requestSetTime = false;
        this._seekpointRecord = null;
        this._progressChecker = null;

        this._mediaDataSource = mediaDataSource;
        this._mediaElement = null;
        this._msectl = null;
        this._transmuxer = null;

        this._mseSourceOpened = false;
        this._hasPendingLoad = false;
        this._receivedCanPlay = false;

        this._mediaInfo = null;
        this._statisticsInfo = null;

        var chromeNeedIDRFix = _browser2.default.chrome && (_browser2.default.version.major < 50 || _browser2.default.version.major === 50 && _browser2.default.version.build < 2661);
        this._alwaysSeekKeyframe = chromeNeedIDRFix || _browser2.default.msedge || _browser2.default.msie ? true : false;

        if (this._alwaysSeekKeyframe) {
            this._config.accurateSeek = false;
        }
    }

    _createClass(FlvPlayer, [{
        key: 'destroy',
        value: function destroy() {
            if (this._progressChecker != null) {
                window.clearInterval(this._progressChecker);
                this._progressChecker = null;
            }
            if (this._transmuxer) {
                this.unload();
            }
            if (this._mediaElement) {
                this.detachMediaElement();
            }
            this.e = null;
            this._mediaDataSource = null;

            this._emitter.removeAllListeners();
            this._emitter = null;
        }
    }, {
        key: 'on',
        value: function on(event, listener) {
            var _this = this;

            if (event === _playerEvents2.default.MEDIA_INFO) {
                if (this._mediaInfo != null) {
                    Promise.resolve().then(function () {
                        _this._emitter.emit(_playerEvents2.default.MEDIA_INFO, _this.mediaInfo);
                    });
                }
            } else if (event === _playerEvents2.default.STATISTICS_INFO) {
                if (this._statisticsInfo != null) {
                    Promise.resolve().then(function () {
                        _this._emitter.emit(_playerEvents2.default.STATISTICS_INFO, _this.statisticsInfo);
                    });
                }
            }
            this._emitter.addListener(event, listener);
        }
    }, {
        key: 'off',
        value: function off(event, listener) {
            this._emitter.removeListener(event, listener);
        }
    }, {
        key: 'attachMediaElement',
        value: function attachMediaElement(mediaElement) {
            var _this2 = this;

            this._mediaElement = mediaElement;
            mediaElement.addEventListener('loadedmetadata', this.e.onvLoadedMetadata);
            mediaElement.addEventListener('seeking', this.e.onvSeeking);
            mediaElement.addEventListener('canplay', this.e.onvCanPlay);
            mediaElement.addEventListener('stalled', this.e.onvStalled);
            mediaElement.addEventListener('progress', this.e.onvProgress);

            this._msectl = new _mseController2.default(this._config);

            this._msectl.on(_mseEvents2.default.UPDATE_END, this._onmseUpdateEnd.bind(this));
            this._msectl.on(_mseEvents2.default.BUFFER_FULL, this._onmseBufferFull.bind(this));
            this._msectl.on(_mseEvents2.default.SOURCE_OPEN, function () {
                _this2._mseSourceOpened = true;
                if (_this2._hasPendingLoad) {
                    _this2._hasPendingLoad = false;
                    _this2.load();
                }
            });
            this._msectl.on(_mseEvents2.default.ERROR, function (info) {
                _this2._emitter.emit(_playerEvents2.default.ERROR, _playerErrors.ErrorTypes.MEDIA_ERROR, _playerErrors.ErrorDetails.MEDIA_MSE_ERROR, info);
            });

            this._msectl.attachMediaElement(mediaElement);

            if (this._pendingSeekTime != null) {
                try {
                    mediaElement.currentTime = this._pendingSeekTime;
                    this._pendingSeekTime = null;
                } catch (e) {
                    // IE11 may throw InvalidStateError if readyState === 0
                    // We can defer set currentTime operation after loadedmetadata
                }
            }
        }
    }, {
        key: 'detachMediaElement',
        value: function detachMediaElement() {
            if (this._mediaElement) {
                this._msectl.detachMediaElement();
                this._mediaElement.removeEventListener('loadedmetadata', this.e.onvLoadedMetadata);
                this._mediaElement.removeEventListener('seeking', this.e.onvSeeking);
                this._mediaElement.removeEventListener('canplay', this.e.onvCanPlay);
                this._mediaElement.removeEventListener('stalled', this.e.onvStalled);
                this._mediaElement.removeEventListener('progress', this.e.onvProgress);
                this._mediaElement = null;
            }
            if (this._msectl) {
                this._msectl.destroy();
                this._msectl = null;
            }
        }
    }, {
        key: 'load',
        value: function load() {
            var _this3 = this;

            if (!this._mediaElement) {
                throw new _exception.IllegalStateException('HTMLMediaElement must be attached before load()!');
            }
            if (this._transmuxer) {
                throw new _exception.IllegalStateException('FlvPlayer.load() has been called, please call unload() first!');
            }
            if (this._hasPendingLoad) {
                return;
            }

            if (this._config.deferLoadAfterSourceOpen && this._mseSourceOpened === false) {
                this._hasPendingLoad = true;
                return;
            }

            if (this._mediaElement.readyState > 0) {
                this._requestSetTime = true;
                // IE11 may throw InvalidStateError if readyState === 0
                this._mediaElement.currentTime = 0;
            }

            this._transmuxer = new _transmuxer2.default(this._mediaDataSource, this._config);

            this._transmuxer.on(_transmuxingEvents2.default.INIT_SEGMENT, function (type, is) {
                _this3._msectl.appendInitSegment(is);
            });
            this._transmuxer.on(_transmuxingEvents2.default.MEDIA_SEGMENT, function (type, ms) {
                _this3._msectl.appendMediaSegment(ms);

                // lazyLoad check
                if (_this3._config.lazyLoad && !_this3._config.isLive) {
                    var currentTime = _this3._mediaElement.currentTime;
                    if (ms.info.endDts >= (currentTime + _this3._config.lazyLoadMaxDuration) * 1000) {
                        if (_this3._progressChecker == null) {
                            _logger2.default.v(_this3.TAG, 'Maximum buffering duration exceeded, suspend transmuxing task');
                            _this3._suspendTransmuxer();
                        }
                    }
                }
            });
            this._transmuxer.on(_transmuxingEvents2.default.LOADING_COMPLETE, function () {
                _this3._msectl.endOfStream();
                _this3._emitter.emit(_playerEvents2.default.LOADING_COMPLETE);
            });
            this._transmuxer.on(_transmuxingEvents2.default.RECOVERED_EARLY_EOF, function () {
                _this3._emitter.emit(_playerEvents2.default.RECOVERED_EARLY_EOF);
            });
            this._transmuxer.on(_transmuxingEvents2.default.IO_ERROR, function (detail, info) {
                _this3._emitter.emit(_playerEvents2.default.ERROR, _playerErrors.ErrorTypes.NETWORK_ERROR, detail, info);
            });
            this._transmuxer.on(_transmuxingEvents2.default.DEMUX_ERROR, function (detail, info) {
                _this3._emitter.emit(_playerEvents2.default.ERROR, _playerErrors.ErrorTypes.MEDIA_ERROR, detail, { code: -1, msg: info });
            });
            this._transmuxer.on(_transmuxingEvents2.default.MEDIA_INFO, function (mediaInfo) {
                _this3._mediaInfo = mediaInfo;
                _this3._emitter.emit(_playerEvents2.default.MEDIA_INFO, Object.assign({}, mediaInfo));
            });
            this._transmuxer.on(_transmuxingEvents2.default.METADATA_ARRIVED, function (metadata) {
                _this3._emitter.emit(_playerEvents2.default.METADATA_ARRIVED, metadata);
            });
            this._transmuxer.on(_transmuxingEvents2.default.STATISTICS_INFO, function (statInfo) {
                _this3._statisticsInfo = _this3._fillStatisticsInfo(statInfo);
                _this3._emitter.emit(_playerEvents2.default.STATISTICS_INFO, Object.assign({}, _this3._statisticsInfo));
            });
            this._transmuxer.on(_transmuxingEvents2.default.RECOMMEND_SEEKPOINT, function (milliseconds) {
                if (_this3._mediaElement && !_this3._config.accurateSeek) {
                    _this3._requestSetTime = true;
                    _this3._mediaElement.currentTime = milliseconds / 1000;
                }
            });

            this._transmuxer.on(_transmuxingEvents2.default.DEMUX_MSG, function (metadata) {
                _this3._emitter.emit(_playerEvents2.default.DEMUX_MSG, metadata);
            });

            this._transmuxer.open();
        }
    }, {
        key: 'unload',
        value: function unload() {
            if (this._mediaElement) {
                this._mediaElement.pause();
            }
            if (this._msectl) {
                this._msectl.seek(0);
            }
            if (this._transmuxer) {
                this._transmuxer.close();
                this._transmuxer.destroy();
                this._transmuxer = null;
            }
        }
    }, {
        key: 'play',
        value: function play() {
            return this._mediaElement.play();
        }
    }, {
        key: 'pause',
        value: function pause() {
            this._mediaElement.pause();
        }
    }, {
        key: '_fillStatisticsInfo',
        value: function _fillStatisticsInfo(statInfo) {
            statInfo.playerType = this._type;

            if (!(this._mediaElement instanceof HTMLVideoElement)) {
                return statInfo;
            }

            var hasQualityInfo = true;
            var decoded = 0;
            var dropped = 0;

            if (this._mediaElement.getVideoPlaybackQuality) {
                var quality = this._mediaElement.getVideoPlaybackQuality();
                decoded = quality.totalVideoFrames;
                dropped = quality.droppedVideoFrames;
            } else if (this._mediaElement.webkitDecodedFrameCount != undefined) {
                decoded = this._mediaElement.webkitDecodedFrameCount;
                dropped = this._mediaElement.webkitDroppedFrameCount;
            } else {
                hasQualityInfo = false;
            }

            if (hasQualityInfo) {
                statInfo.decodedFrames = decoded;
                statInfo.droppedFrames = dropped;
            }

            return statInfo;
        }
    }, {
        key: '_onmseUpdateEnd',
        value: function _onmseUpdateEnd() {
            if (!this._config.lazyLoad || this._config.isLive) {
                return;
            }

            var buffered = this._mediaElement.buffered;
            var currentTime = this._mediaElement.currentTime;
            var currentRangeStart = 0;
            var currentRangeEnd = 0;

            for (var i = 0; i < buffered.length; i++) {
                var start = buffered.start(i);
                var end = buffered.end(i);
                if (start <= currentTime && currentTime < end) {
                    currentRangeStart = start;
                    currentRangeEnd = end;
                    break;
                }
            }

            if (currentRangeEnd >= currentTime + this._config.lazyLoadMaxDuration && this._progressChecker == null) {
                _logger2.default.v(this.TAG, 'Maximum buffering duration exceeded, suspend transmuxing task');
                this._suspendTransmuxer();
            }
        }
    }, {
        key: '_onmseBufferFull',
        value: function _onmseBufferFull() {
            _logger2.default.v(this.TAG, 'MSE SourceBuffer is full, suspend transmuxing task');
            if (this._progressChecker == null) {
                this._suspendTransmuxer();
            }
        }
    }, {
        key: '_suspendTransmuxer',
        value: function _suspendTransmuxer() {
            if (this._transmuxer) {
                this._transmuxer.pause();

                if (this._progressChecker == null) {
                    this._progressChecker = window.setInterval(this._checkProgressAndResume.bind(this), 1000);
                }
            }
        }
    }, {
        key: '_checkProgressAndResume',
        value: function _checkProgressAndResume() {
            var currentTime = this._mediaElement.currentTime;
            var buffered = this._mediaElement.buffered;

            var needResume = false;

            for (var i = 0; i < buffered.length; i++) {
                var from = buffered.start(i);
                var to = buffered.end(i);
                if (currentTime >= from && currentTime < to) {
                    if (currentTime >= to - this._config.lazyLoadRecoverDuration) {
                        needResume = true;
                    }
                    break;
                }
            }

            if (needResume) {
                window.clearInterval(this._progressChecker);
                this._progressChecker = null;
                if (needResume) {
                    _logger2.default.v(this.TAG, 'Continue loading from paused position');
                    this._transmuxer.resume();
                }
            }
        }
    }, {
        key: '_isTimepointBuffered',
        value: function _isTimepointBuffered(seconds) {
            var buffered = this._mediaElement.buffered;

            for (var i = 0; i < buffered.length; i++) {
                var from = buffered.start(i);
                var to = buffered.end(i);
                if (seconds >= from && seconds < to) {
                    return true;
                }
            }
            return false;
        }
    }, {
        key: '_internalSeek',
        value: function _internalSeek(seconds) {
            var directSeek = this._isTimepointBuffered(seconds);

            var directSeekBegin = false;
            var directSeekBeginTime = 0;

            if (seconds < 1.0 && this._mediaElement.buffered.length > 0) {
                var videoBeginTime = this._mediaElement.buffered.start(0);
                if (videoBeginTime < 1.0 && seconds < videoBeginTime || _browser2.default.safari) {
                    directSeekBegin = true;
                    // also workaround for Safari: Seek to 0 may cause video stuck, use 0.1 to avoid
                    directSeekBeginTime = _browser2.default.safari ? 0.1 : videoBeginTime;
                }
            }

            if (directSeekBegin) {
                // seek to video begin, set currentTime directly if beginPTS buffered
                this._requestSetTime = true;
                this._mediaElement.currentTime = directSeekBeginTime;
            } else if (directSeek) {
                // buffered position
                if (!this._alwaysSeekKeyframe) {
                    this._requestSetTime = true;
                    this._mediaElement.currentTime = seconds;
                } else {
                    var idr = this._msectl.getNearestKeyframe(Math.floor(seconds * 1000));
                    this._requestSetTime = true;
                    if (idr != null) {
                        this._mediaElement.currentTime = idr.dts / 1000;
                    } else {
                        this._mediaElement.currentTime = seconds;
                    }
                }
                if (this._progressChecker != null) {
                    this._checkProgressAndResume();
                }
            } else {
                if (this._progressChecker != null) {
                    window.clearInterval(this._progressChecker);
                    this._progressChecker = null;
                }
                this._msectl.seek(seconds);
                this._transmuxer.seek(Math.floor(seconds * 1000)); // in milliseconds
                // no need to set mediaElement.currentTime if non-accurateSeek,
                // just wait for the recommend_seekpoint callback
                if (this._config.accurateSeek) {
                    this._requestSetTime = true;
                    this._mediaElement.currentTime = seconds;
                }
            }
        }
    }, {
        key: '_checkAndApplyUnbufferedSeekpoint',
        value: function _checkAndApplyUnbufferedSeekpoint() {
            if (this._seekpointRecord) {
                if (this._seekpointRecord.recordTime <= this._now() - 100) {
                    var target = this._mediaElement.currentTime;
                    this._seekpointRecord = null;
                    if (!this._isTimepointBuffered(target)) {
                        if (this._progressChecker != null) {
                            window.clearTimeout(this._progressChecker);
                            this._progressChecker = null;
                        }
                        // .currentTime is consists with .buffered timestamp
                        // Chrome/Edge use DTS, while FireFox/Safari use PTS
                        this._msectl.seek(target);
                        this._transmuxer.seek(Math.floor(target * 1000));
                        // set currentTime if accurateSeek, or wait for recommend_seekpoint callback
                        if (this._config.accurateSeek) {
                            this._requestSetTime = true;
                            this._mediaElement.currentTime = target;
                        }
                    }
                } else {
                    window.setTimeout(this._checkAndApplyUnbufferedSeekpoint.bind(this), 50);
                }
            }
        }
    }, {
        key: '_checkAndResumeStuckPlayback',
        value: function _checkAndResumeStuckPlayback(stalled) {
            var media = this._mediaElement;
            if (stalled || !this._receivedCanPlay || media.readyState < 2) {
                // HAVE_CURRENT_DATA
                var buffered = media.buffered;
                if (buffered.length > 0 && media.currentTime < buffered.start(0)) {
                    _logger2.default.w(this.TAG, 'Playback seems stuck at ' + media.currentTime + ', seek to ' + buffered.start(0));
                    this._requestSetTime = true;
                    this._mediaElement.currentTime = buffered.start(0);
                    this._mediaElement.removeEventListener('progress', this.e.onvProgress);
                }
            } else {
                // Playback didn't stuck, remove progress event listener
                this._mediaElement.removeEventListener('progress', this.e.onvProgress);
            }
        }
    }, {
        key: '_onvLoadedMetadata',
        value: function _onvLoadedMetadata(e) {
            if (this._pendingSeekTime != null) {
                this._mediaElement.currentTime = this._pendingSeekTime;
                this._pendingSeekTime = null;
            }
        }
    }, {
        key: '_onvSeeking',
        value: function _onvSeeking(e) {
            // handle seeking request from browser's progress bar
            var target = this._mediaElement.currentTime;
            var buffered = this._mediaElement.buffered;

            if (this._requestSetTime) {
                this._requestSetTime = false;
                return;
            }

            if (target < 1.0 && buffered.length > 0) {
                // seek to video begin, set currentTime directly if beginPTS buffered
                var videoBeginTime = buffered.start(0);
                if (videoBeginTime < 1.0 && target < videoBeginTime || _browser2.default.safari) {
                    this._requestSetTime = true;
                    // also workaround for Safari: Seek to 0 may cause video stuck, use 0.1 to avoid
                    this._mediaElement.currentTime = _browser2.default.safari ? 0.1 : videoBeginTime;
                    return;
                }
            }

            if (this._isTimepointBuffered(target)) {
                if (this._alwaysSeekKeyframe) {
                    var idr = this._msectl.getNearestKeyframe(Math.floor(target * 1000));
                    if (idr != null) {
                        this._requestSetTime = true;
                        this._mediaElement.currentTime = idr.dts / 1000;
                    }
                }
                if (this._progressChecker != null) {
                    this._checkProgressAndResume();
                }
                return;
            }

            this._seekpointRecord = {
                seekPoint: target,
                recordTime: this._now()
            };
            window.setTimeout(this._checkAndApplyUnbufferedSeekpoint.bind(this), 50);
        }
    }, {
        key: '_onvCanPlay',
        value: function _onvCanPlay(e) {
            this._receivedCanPlay = true;
            this._mediaElement.removeEventListener('canplay', this.e.onvCanPlay);
        }
    }, {
        key: '_onvStalled',
        value: function _onvStalled(e) {
            this._checkAndResumeStuckPlayback(true);
        }
    }, {
        key: '_onvProgress',
        value: function _onvProgress(e) {
            this._checkAndResumeStuckPlayback();
        }
    }, {
        key: 'type',
        get: function get() {
            return this._type;
        }
    }, {
        key: 'buffered',
        get: function get() {
            return this._mediaElement.buffered;
        }
    }, {
        key: 'duration',
        get: function get() {
            return this._mediaElement.duration;
        }
    }, {
        key: 'volume',
        get: function get() {
            return this._mediaElement.volume;
        },
        set: function set(value) {
            this._mediaElement.volume = value;
        }
    }, {
        key: 'muted',
        get: function get() {
            return this._mediaElement.muted;
        },
        set: function set(muted) {
            this._mediaElement.muted = muted;
        }
    }, {
        key: 'currentTime',
        get: function get() {
            if (this._mediaElement) {
                return this._mediaElement.currentTime;
            }
            return 0;
        },
        set: function set(seconds) {
            if (this._mediaElement) {
                this._internalSeek(seconds);
            } else {
                this._pendingSeekTime = seconds;
            }
        }
    }, {
        key: 'mediaInfo',
        get: function get() {
            return Object.assign({}, this._mediaInfo);
        }
    }, {
        key: 'statisticsInfo',
        get: function get() {
            if (this._statisticsInfo == null) {
                this._statisticsInfo = {};
            }
            this._statisticsInfo = this._fillStatisticsInfo(this._statisticsInfo);
            return Object.assign({}, this._statisticsInfo);
        }
    }]);

    return FlvPlayer;
}();

exports.default = FlvPlayer;

},{"../config.js":6,"../core/mse-controller.js":10,"../core/mse-events.js":11,"../core/transmuxer.js":12,"../core/transmuxing-events.js":14,"../utils/browser.js":40,"../utils/exception.js":41,"../utils/logger.js":42,"./player-errors.js":35,"./player-events.js":36,"events":3}],34:[function(_dereq_,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); /*
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * Copyright (C) 2016 Bilibili. All Rights Reserved.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * @author zheng qian <xqq@xqq.im>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * Licensed under the Apache License, Version 2.0 (the "License");
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * you may not use this file except in compliance with the License.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * You may obtain a copy of the License at
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *     http://www.apache.org/licenses/LICENSE-2.0
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * Unless required by applicable law or agreed to in writing, software
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * distributed under the License is distributed on an "AS IS" BASIS,
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * See the License for the specific language governing permissions and
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * limitations under the License.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      */

var _events = _dereq_('events');

var _events2 = _interopRequireDefault(_events);

var _playerEvents = _dereq_('./player-events.js');

var _playerEvents2 = _interopRequireDefault(_playerEvents);

var _config = _dereq_('../config.js');

var _exception = _dereq_('../utils/exception.js');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

// Player wrapper for browser's native player (HTMLVideoElement) without MediaSource src. 
var NativePlayer = function () {
    function NativePlayer(mediaDataSource, config) {
        _classCallCheck(this, NativePlayer);

        this.TAG = 'NativePlayer';
        this._type = 'NativePlayer';
        this._emitter = new _events2.default();

        this._config = (0, _config.createDefaultConfig)();
        if ((typeof config === 'undefined' ? 'undefined' : _typeof(config)) === 'object') {
            Object.assign(this._config, config);
        }

        if (mediaDataSource.type.toLowerCase() === 'flv') {
            throw new _exception.InvalidArgumentException('NativePlayer does\'t support flv MediaDataSource input!');
        }
        if (mediaDataSource.hasOwnProperty('segments')) {
            throw new _exception.InvalidArgumentException('NativePlayer(' + mediaDataSource.type + ') doesn\'t support multipart playback!');
        }

        this.e = {
            onvLoadedMetadata: this._onvLoadedMetadata.bind(this)
        };

        this._pendingSeekTime = null;
        this._statisticsReporter = null;

        this._mediaDataSource = mediaDataSource;
        this._mediaElement = null;
    }

    _createClass(NativePlayer, [{
        key: 'destroy',
        value: function destroy() {
            if (this._mediaElement) {
                this.unload();
                this.detachMediaElement();
            }
            this.e = null;
            this._mediaDataSource = null;
            this._emitter.removeAllListeners();
            this._emitter = null;
        }
    }, {
        key: 'on',
        value: function on(event, listener) {
            var _this = this;

            if (event === _playerEvents2.default.MEDIA_INFO) {
                if (this._mediaElement != null && this._mediaElement.readyState !== 0) {
                    // HAVE_NOTHING
                    Promise.resolve().then(function () {
                        _this._emitter.emit(_playerEvents2.default.MEDIA_INFO, _this.mediaInfo);
                    });
                }
            } else if (event === _playerEvents2.default.STATISTICS_INFO) {
                if (this._mediaElement != null && this._mediaElement.readyState !== 0) {
                    Promise.resolve().then(function () {
                        _this._emitter.emit(_playerEvents2.default.STATISTICS_INFO, _this.statisticsInfo);
                    });
                }
            }
            this._emitter.addListener(event, listener);
        }
    }, {
        key: 'off',
        value: function off(event, listener) {
            this._emitter.removeListener(event, listener);
        }
    }, {
        key: 'attachMediaElement',
        value: function attachMediaElement(mediaElement) {
            this._mediaElement = mediaElement;
            mediaElement.addEventListener('loadedmetadata', this.e.onvLoadedMetadata);

            if (this._pendingSeekTime != null) {
                try {
                    mediaElement.currentTime = this._pendingSeekTime;
                    this._pendingSeekTime = null;
                } catch (e) {
                    // IE11 may throw InvalidStateError if readyState === 0
                    // Defer set currentTime operation after loadedmetadata
                }
            }
        }
    }, {
        key: 'detachMediaElement',
        value: function detachMediaElement() {
            if (this._mediaElement) {
                this._mediaElement.src = '';
                this._mediaElement.removeAttribute('src');
                this._mediaElement.removeEventListener('loadedmetadata', this.e.onvLoadedMetadata);
                this._mediaElement = null;
            }
            if (this._statisticsReporter != null) {
                window.clearInterval(this._statisticsReporter);
                this._statisticsReporter = null;
            }
        }
    }, {
        key: 'load',
        value: function load() {
            if (!this._mediaElement) {
                throw new _exception.IllegalStateException('HTMLMediaElement must be attached before load()!');
            }
            this._mediaElement.src = this._mediaDataSource.url;

            if (this._mediaElement.readyState > 0) {
                this._mediaElement.currentTime = 0;
            }

            this._mediaElement.preload = 'auto';
            this._mediaElement.load();
            this._statisticsReporter = window.setInterval(this._reportStatisticsInfo.bind(this), this._config.statisticsInfoReportInterval);
        }
    }, {
        key: 'unload',
        value: function unload() {
            if (this._mediaElement) {
                this._mediaElement.src = '';
                this._mediaElement.removeAttribute('src');
            }
            if (this._statisticsReporter != null) {
                window.clearInterval(this._statisticsReporter);
                this._statisticsReporter = null;
            }
        }
    }, {
        key: 'play',
        value: function play() {
            return this._mediaElement.play();
        }
    }, {
        key: 'pause',
        value: function pause() {
            this._mediaElement.pause();
        }
    }, {
        key: '_onvLoadedMetadata',
        value: function _onvLoadedMetadata(e) {
            if (this._pendingSeekTime != null) {
                this._mediaElement.currentTime = this._pendingSeekTime;
                this._pendingSeekTime = null;
            }
            this._emitter.emit(_playerEvents2.default.MEDIA_INFO, this.mediaInfo);
        }
    }, {
        key: '_reportStatisticsInfo',
        value: function _reportStatisticsInfo() {
            this._emitter.emit(_playerEvents2.default.STATISTICS_INFO, this.statisticsInfo);
        }
    }, {
        key: 'type',
        get: function get() {
            return this._type;
        }
    }, {
        key: 'buffered',
        get: function get() {
            return this._mediaElement.buffered;
        }
    }, {
        key: 'duration',
        get: function get() {
            return this._mediaElement.duration;
        }
    }, {
        key: 'volume',
        get: function get() {
            return this._mediaElement.volume;
        },
        set: function set(value) {
            this._mediaElement.volume = value;
        }
    }, {
        key: 'muted',
        get: function get() {
            return this._mediaElement.muted;
        },
        set: function set(muted) {
            this._mediaElement.muted = muted;
        }
    }, {
        key: 'currentTime',
        get: function get() {
            if (this._mediaElement) {
                return this._mediaElement.currentTime;
            }
            return 0;
        },
        set: function set(seconds) {
            if (this._mediaElement) {
                this._mediaElement.currentTime = seconds;
            } else {
                this._pendingSeekTime = seconds;
            }
        }
    }, {
        key: 'mediaInfo',
        get: function get() {
            var mediaPrefix = this._mediaElement instanceof HTMLAudioElement ? 'audio/' : 'video/';
            var info = {
                mimeType: mediaPrefix + this._mediaDataSource.type
            };
            if (this._mediaElement) {
                info.duration = Math.floor(this._mediaElement.duration * 1000);
                if (this._mediaElement instanceof HTMLVideoElement) {
                    info.width = this._mediaElement.videoWidth;
                    info.height = this._mediaElement.videoHeight;
                }
            }
            return info;
        }
    }, {
        key: 'statisticsInfo',
        get: function get() {
            var info = {
                playerType: this._type,
                url: this._mediaDataSource.url
            };

            if (!(this._mediaElement instanceof HTMLVideoElement)) {
                return info;
            }

            var hasQualityInfo = true;
            var decoded = 0;
            var dropped = 0;

            if (this._mediaElement.getVideoPlaybackQuality) {
                var quality = this._mediaElement.getVideoPlaybackQuality();
                decoded = quality.totalVideoFrames;
                dropped = quality.droppedVideoFrames;
            } else if (this._mediaElement.webkitDecodedFrameCount != undefined) {
                decoded = this._mediaElement.webkitDecodedFrameCount;
                dropped = this._mediaElement.webkitDroppedFrameCount;
            } else {
                hasQualityInfo = false;
            }

            if (hasQualityInfo) {
                info.decodedFrames = decoded;
                info.droppedFrames = dropped;
            }

            return info;
        }
    }]);

    return NativePlayer;
}();

exports.default = NativePlayer;

},{"../config.js":6,"../utils/exception.js":41,"./player-events.js":36,"events":3}],35:[function(_dereq_,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.ErrorDetails = exports.ErrorTypes = undefined;

var _loader = _dereq_('../io/loader.js');

var _demuxErrors = _dereq_('../demux/demux-errors.js');

var _demuxErrors2 = _interopRequireDefault(_demuxErrors);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/*
 * Copyright (C) 2016 Bilibili. All Rights Reserved.
 *
 * @author zheng qian <xqq@xqq.im>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var ErrorTypes = exports.ErrorTypes = {
    NETWORK_ERROR: 'NetworkError',
    MEDIA_ERROR: 'MediaError',
    OTHER_ERROR: 'OtherError'
};

var ErrorDetails = exports.ErrorDetails = {
    NETWORK_EXCEPTION: _loader.LoaderErrors.EXCEPTION,
    NETWORK_STATUS_CODE_INVALID: _loader.LoaderErrors.HTTP_STATUS_CODE_INVALID,
    NETWORK_TIMEOUT: _loader.LoaderErrors.CONNECTING_TIMEOUT,
    NETWORK_UNRECOVERABLE_EARLY_EOF: _loader.LoaderErrors.UNRECOVERABLE_EARLY_EOF,

    MEDIA_MSE_ERROR: 'MediaMSEError',

    MEDIA_FORMAT_ERROR: _demuxErrors2.default.FORMAT_ERROR,
    MEDIA_FORMAT_UNSUPPORTED: _demuxErrors2.default.FORMAT_UNSUPPORTED,
    MEDIA_CODEC_UNSUPPORTED: _demuxErrors2.default.CODEC_UNSUPPORTED
};

},{"../demux/demux-errors.js":17,"../io/loader.js":25}],36:[function(_dereq_,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
/*
 * Copyright (C) 2016 Bilibili. All Rights Reserved.
 *
 * @author zheng qian <xqq@xqq.im>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var PlayerEvents = {
  ERROR: 'error',
  LOADING_COMPLETE: 'loading_complete',
  RECOVERED_EARLY_EOF: 'recovered_early_eof',
  MEDIA_INFO: 'media_info',
  METADATA_ARRIVED: 'metadata_arrived',
  STATISTICS_INFO: 'statistics_info',
  DEMUX_MSG: 'demux_msg'
};

exports.default = PlayerEvents;

},{}],37:[function(_dereq_,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/*
 * Copyright (C) 2016 Bilibili. All Rights Reserved.
 *
 * This file is modified from dailymotion's hls.js library (hls.js/src/helper/aac.js)
 * @author zheng qian <xqq@xqq.im>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var AAC = function () {
    function AAC() {
        _classCallCheck(this, AAC);
    }

    _createClass(AAC, null, [{
        key: 'getSilentFrame',
        value: function getSilentFrame(codec, channelCount) {
            if (codec === 'mp4a.40.2') {
                // handle LC-AAC
                if (channelCount === 1) {
                    return new Uint8Array([0x00, 0xc8, 0x00, 0x80, 0x23, 0x80]);
                } else if (channelCount === 2) {
                    return new Uint8Array([0x21, 0x00, 0x49, 0x90, 0x02, 0x19, 0x00, 0x23, 0x80]);
                } else if (channelCount === 3) {
                    return new Uint8Array([0x00, 0xc8, 0x00, 0x80, 0x20, 0x84, 0x01, 0x26, 0x40, 0x08, 0x64, 0x00, 0x8e]);
                } else if (channelCount === 4) {
                    return new Uint8Array([0x00, 0xc8, 0x00, 0x80, 0x20, 0x84, 0x01, 0x26, 0x40, 0x08, 0x64, 0x00, 0x80, 0x2c, 0x80, 0x08, 0x02, 0x38]);
                } else if (channelCount === 5) {
                    return new Uint8Array([0x00, 0xc8, 0x00, 0x80, 0x20, 0x84, 0x01, 0x26, 0x40, 0x08, 0x64, 0x00, 0x82, 0x30, 0x04, 0x99, 0x00, 0x21, 0x90, 0x02, 0x38]);
                } else if (channelCount === 6) {
                    return new Uint8Array([0x00, 0xc8, 0x00, 0x80, 0x20, 0x84, 0x01, 0x26, 0x40, 0x08, 0x64, 0x00, 0x82, 0x30, 0x04, 0x99, 0x00, 0x21, 0x90, 0x02, 0x00, 0xb2, 0x00, 0x20, 0x08, 0xe0]);
                }
            } else {
                // handle HE-AAC (mp4a.40.5 / mp4a.40.29)
                if (channelCount === 1) {
                    // ffmpeg -y -f lavfi -i "aevalsrc=0:d=0.05" -c:a libfdk_aac -profile:a aac_he -b:a 4k output.aac && hexdump -v -e '16/1 "0x%x," "\n"' -v output.aac
                    return new Uint8Array([0x1, 0x40, 0x22, 0x80, 0xa3, 0x4e, 0xe6, 0x80, 0xba, 0x8, 0x0, 0x0, 0x0, 0x1c, 0x6, 0xf1, 0xc1, 0xa, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5e]);
                } else if (channelCount === 2) {
                    // ffmpeg -y -f lavfi -i "aevalsrc=0|0:d=0.05" -c:a libfdk_aac -profile:a aac_he_v2 -b:a 4k output.aac && hexdump -v -e '16/1 "0x%x," "\n"' -v output.aac
                    return new Uint8Array([0x1, 0x40, 0x22, 0x80, 0xa3, 0x5e, 0xe6, 0x80, 0xba, 0x8, 0x0, 0x0, 0x0, 0x0, 0x95, 0x0, 0x6, 0xf1, 0xa1, 0xa, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5e]);
                } else if (channelCount === 3) {
                    // ffmpeg -y -f lavfi -i "aevalsrc=0|0|0:d=0.05" -c:a libfdk_aac -profile:a aac_he_v2 -b:a 4k output.aac && hexdump -v -e '16/1 "0x%x," "\n"' -v output.aac
                    return new Uint8Array([0x1, 0x40, 0x22, 0x80, 0xa3, 0x5e, 0xe6, 0x80, 0xba, 0x8, 0x0, 0x0, 0x0, 0x0, 0x95, 0x0, 0x6, 0xf1, 0xa1, 0xa, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5e]);
                }
            }
            return null;
        }
    }]);

    return AAC;
}();

exports.default = AAC;

},{}],38:[function(_dereq_,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/*
 * Copyright (C) 2016 Bilibili. All Rights Reserved.
 *
 * This file is derived from dailymotion's hls.js library (hls.js/src/remux/mp4-generator.js)
 * @author zheng qian <xqq@xqq.im>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

//  MP4 boxes generator for ISO BMFF (ISO Base Media File Format, defined in ISO/IEC 14496-12)
var MP4 = function () {
    function MP4() {
        _classCallCheck(this, MP4);
    }

    _createClass(MP4, null, [{
        key: 'init',
        value: function init() {
            MP4.types = {
                avc1: [], avcC: [], btrt: [], dinf: [],
                dref: [], esds: [], ftyp: [], hdlr: [],
                mdat: [], mdhd: [], mdia: [], mfhd: [],
                minf: [], moof: [], moov: [], mp4a: [],
                mvex: [], mvhd: [], sdtp: [], stbl: [],
                stco: [], stsc: [], stsd: [], stsz: [],
                stts: [], tfdt: [], tfhd: [], traf: [],
                trak: [], trun: [], trex: [], tkhd: [],
                vmhd: [], smhd: [], '.mp3': []
            };

            for (var name in MP4.types) {
                if (MP4.types.hasOwnProperty(name)) {
                    MP4.types[name] = [name.charCodeAt(0), name.charCodeAt(1), name.charCodeAt(2), name.charCodeAt(3)];
                }
            }

            var constants = MP4.constants = {};

            constants.FTYP = new Uint8Array([0x69, 0x73, 0x6F, 0x6D, // major_brand: isom
            0x0, 0x0, 0x0, 0x1, // minor_version: 0x01
            0x69, 0x73, 0x6F, 0x6D, // isom
            0x61, 0x76, 0x63, 0x31 // avc1
            ]);

            constants.STSD_PREFIX = new Uint8Array([0x00, 0x00, 0x00, 0x00, // version(0) + flags
            0x00, 0x00, 0x00, 0x01 // entry_count
            ]);

            constants.STTS = new Uint8Array([0x00, 0x00, 0x00, 0x00, // version(0) + flags
            0x00, 0x00, 0x00, 0x00 // entry_count
            ]);

            constants.STSC = constants.STCO = constants.STTS;

            constants.STSZ = new Uint8Array([0x00, 0x00, 0x00, 0x00, // version(0) + flags
            0x00, 0x00, 0x00, 0x00, // sample_size
            0x00, 0x00, 0x00, 0x00 // sample_count
            ]);

            constants.HDLR_VIDEO = new Uint8Array([0x00, 0x00, 0x00, 0x00, // version(0) + flags
            0x00, 0x00, 0x00, 0x00, // pre_defined
            0x76, 0x69, 0x64, 0x65, // handler_type: 'vide'
            0x00, 0x00, 0x00, 0x00, // reserved: 3 * 4 bytes
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x56, 0x69, 0x64, 0x65, 0x6F, 0x48, 0x61, 0x6E, 0x64, 0x6C, 0x65, 0x72, 0x00 // name: VideoHandler
            ]);

            constants.HDLR_AUDIO = new Uint8Array([0x00, 0x00, 0x00, 0x00, // version(0) + flags
            0x00, 0x00, 0x00, 0x00, // pre_defined
            0x73, 0x6F, 0x75, 0x6E, // handler_type: 'soun'
            0x00, 0x00, 0x00, 0x00, // reserved: 3 * 4 bytes
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x53, 0x6F, 0x75, 0x6E, 0x64, 0x48, 0x61, 0x6E, 0x64, 0x6C, 0x65, 0x72, 0x00 // name: SoundHandler
            ]);

            constants.DREF = new Uint8Array([0x00, 0x00, 0x00, 0x00, // version(0) + flags
            0x00, 0x00, 0x00, 0x01, // entry_count
            0x00, 0x00, 0x00, 0x0C, // entry_size
            0x75, 0x72, 0x6C, 0x20, // type 'url '
            0x00, 0x00, 0x00, 0x01 // version(0) + flags
            ]);

            // Sound media header
            constants.SMHD = new Uint8Array([0x00, 0x00, 0x00, 0x00, // version(0) + flags
            0x00, 0x00, 0x00, 0x00 // balance(2) + reserved(2)
            ]);

            // video media header
            constants.VMHD = new Uint8Array([0x00, 0x00, 0x00, 0x01, // version(0) + flags
            0x00, 0x00, // graphicsmode: 2 bytes
            0x00, 0x00, 0x00, 0x00, // opcolor: 3 * 2 bytes
            0x00, 0x00]);
        }

        // Generate a box

    }, {
        key: 'box',
        value: function box(type) {
            var size = 8;
            var result = null;
            var datas = Array.prototype.slice.call(arguments, 1);
            var arrayCount = datas.length;

            for (var i = 0; i < arrayCount; i++) {
                size += datas[i].byteLength;
            }

            result = new Uint8Array(size);
            result[0] = size >>> 24 & 0xFF; // size
            result[1] = size >>> 16 & 0xFF;
            result[2] = size >>> 8 & 0xFF;
            result[3] = size & 0xFF;

            result.set(type, 4); // type

            var offset = 8;
            for (var _i = 0; _i < arrayCount; _i++) {
                // data body
                result.set(datas[_i], offset);
                offset += datas[_i].byteLength;
            }

            return result;
        }

        // emit ftyp & moov

    }, {
        key: 'generateInitSegment',
        value: function generateInitSegment(meta) {
            var ftyp = MP4.box(MP4.types.ftyp, MP4.constants.FTYP);
            var moov = MP4.moov(meta);

            var result = new Uint8Array(ftyp.byteLength + moov.byteLength);
            result.set(ftyp, 0);
            result.set(moov, ftyp.byteLength);
            return result;
        }

        // Movie metadata box

    }, {
        key: 'moov',
        value: function moov(meta) {
            var mvhd = MP4.mvhd(meta.timescale, meta.duration);
            var trak = MP4.trak(meta);
            var mvex = MP4.mvex(meta);
            return MP4.box(MP4.types.moov, mvhd, trak, mvex);
        }

        // Movie header box

    }, {
        key: 'mvhd',
        value: function mvhd(timescale, duration) {
            return MP4.box(MP4.types.mvhd, new Uint8Array([0x00, 0x00, 0x00, 0x00, // version(0) + flags
            0x00, 0x00, 0x00, 0x00, // creation_time
            0x00, 0x00, 0x00, 0x00, // modification_time
            timescale >>> 24 & 0xFF, // timescale: 4 bytes
            timescale >>> 16 & 0xFF, timescale >>> 8 & 0xFF, timescale & 0xFF, duration >>> 24 & 0xFF, // duration: 4 bytes
            duration >>> 16 & 0xFF, duration >>> 8 & 0xFF, duration & 0xFF, 0x00, 0x01, 0x00, 0x00, // Preferred rate: 1.0
            0x01, 0x00, 0x00, 0x00, // PreferredVolume(1.0, 2bytes) + reserved(2bytes)
            0x00, 0x00, 0x00, 0x00, // reserved: 4 + 4 bytes
            0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, // ----begin composition matrix----
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x40, 0x00, 0x00, 0x00, // ----end composition matrix----
            0x00, 0x00, 0x00, 0x00, // ----begin pre_defined 6 * 4 bytes----
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // ----end pre_defined 6 * 4 bytes----
            0xFF, 0xFF, 0xFF, 0xFF // next_track_ID
            ]));
        }

        // Track box

    }, {
        key: 'trak',
        value: function trak(meta) {
            return MP4.box(MP4.types.trak, MP4.tkhd(meta), MP4.mdia(meta));
        }

        // Track header box

    }, {
        key: 'tkhd',
        value: function tkhd(meta) {
            var trackId = meta.id,
                duration = meta.duration;
            var width = meta.presentWidth,
                height = meta.presentHeight;

            return MP4.box(MP4.types.tkhd, new Uint8Array([0x00, 0x00, 0x00, 0x07, // version(0) + flags
            0x00, 0x00, 0x00, 0x00, // creation_time
            0x00, 0x00, 0x00, 0x00, // modification_time
            trackId >>> 24 & 0xFF, // track_ID: 4 bytes
            trackId >>> 16 & 0xFF, trackId >>> 8 & 0xFF, trackId & 0xFF, 0x00, 0x00, 0x00, 0x00, // reserved: 4 bytes
            duration >>> 24 & 0xFF, // duration: 4 bytes
            duration >>> 16 & 0xFF, duration >>> 8 & 0xFF, duration & 0xFF, 0x00, 0x00, 0x00, 0x00, // reserved: 2 * 4 bytes
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // layer(2bytes) + alternate_group(2bytes)
            0x00, 0x00, 0x00, 0x00, // volume(2bytes) + reserved(2bytes)
            0x00, 0x01, 0x00, 0x00, // ----begin composition matrix----
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x40, 0x00, 0x00, 0x00, // ----end composition matrix----
            width >>> 8 & 0xFF, // width and height
            width & 0xFF, 0x00, 0x00, height >>> 8 & 0xFF, height & 0xFF, 0x00, 0x00]));
        }

        // Media Box

    }, {
        key: 'mdia',
        value: function mdia(meta) {
            return MP4.box(MP4.types.mdia, MP4.mdhd(meta), MP4.hdlr(meta), MP4.minf(meta));
        }

        // Media header box

    }, {
        key: 'mdhd',
        value: function mdhd(meta) {
            var timescale = meta.timescale;
            var duration = meta.duration;
            return MP4.box(MP4.types.mdhd, new Uint8Array([0x00, 0x00, 0x00, 0x00, // version(0) + flags
            0x00, 0x00, 0x00, 0x00, // creation_time
            0x00, 0x00, 0x00, 0x00, // modification_time
            timescale >>> 24 & 0xFF, // timescale: 4 bytes
            timescale >>> 16 & 0xFF, timescale >>> 8 & 0xFF, timescale & 0xFF, duration >>> 24 & 0xFF, // duration: 4 bytes
            duration >>> 16 & 0xFF, duration >>> 8 & 0xFF, duration & 0xFF, 0x55, 0xC4, // language: und (undetermined)
            0x00, 0x00 // pre_defined = 0
            ]));
        }

        // Media handler reference box

    }, {
        key: 'hdlr',
        value: function hdlr(meta) {
            var data = null;
            if (meta.type === 'audio') {
                data = MP4.constants.HDLR_AUDIO;
            } else {
                data = MP4.constants.HDLR_VIDEO;
            }
            return MP4.box(MP4.types.hdlr, data);
        }

        // Media infomation box

    }, {
        key: 'minf',
        value: function minf(meta) {
            var xmhd = null;
            if (meta.type === 'audio') {
                xmhd = MP4.box(MP4.types.smhd, MP4.constants.SMHD);
            } else {
                xmhd = MP4.box(MP4.types.vmhd, MP4.constants.VMHD);
            }
            return MP4.box(MP4.types.minf, xmhd, MP4.dinf(), MP4.stbl(meta));
        }

        // Data infomation box

    }, {
        key: 'dinf',
        value: function dinf() {
            var result = MP4.box(MP4.types.dinf, MP4.box(MP4.types.dref, MP4.constants.DREF));
            return result;
        }

        // Sample table box

    }, {
        key: 'stbl',
        value: function stbl(meta) {
            var result = MP4.box(MP4.types.stbl, // type: stbl
            MP4.stsd(meta), // Sample Description Table
            MP4.box(MP4.types.stts, MP4.constants.STTS), // Time-To-Sample
            MP4.box(MP4.types.stsc, MP4.constants.STSC), // Sample-To-Chunk
            MP4.box(MP4.types.stsz, MP4.constants.STSZ), // Sample size
            MP4.box(MP4.types.stco, MP4.constants.STCO) // Chunk offset
            );
            return result;
        }

        // Sample description box

    }, {
        key: 'stsd',
        value: function stsd(meta) {
            if (meta.type === 'audio') {
                if (meta.codec === 'mp3') {
                    return MP4.box(MP4.types.stsd, MP4.constants.STSD_PREFIX, MP4.mp3(meta));
                }
                // else: aac -> mp4a
                return MP4.box(MP4.types.stsd, MP4.constants.STSD_PREFIX, MP4.mp4a(meta));
            } else {
                return MP4.box(MP4.types.stsd, MP4.constants.STSD_PREFIX, MP4.avc1(meta));
            }
        }
    }, {
        key: 'mp3',
        value: function mp3(meta) {
            var channelCount = meta.channelCount;
            var sampleRate = meta.audioSampleRate;

            var data = new Uint8Array([0x00, 0x00, 0x00, 0x00, // reserved(4)
            0x00, 0x00, 0x00, 0x01, // reserved(2) + data_reference_index(2)
            0x00, 0x00, 0x00, 0x00, // reserved: 2 * 4 bytes
            0x00, 0x00, 0x00, 0x00, 0x00, channelCount, // channelCount(2)
            0x00, 0x10, // sampleSize(2)
            0x00, 0x00, 0x00, 0x00, // reserved(4)
            sampleRate >>> 8 & 0xFF, // Audio sample rate
            sampleRate & 0xFF, 0x00, 0x00]);

            return MP4.box(MP4.types['.mp3'], data);
        }
    }, {
        key: 'mp4a',
        value: function mp4a(meta) {
            var channelCount = meta.channelCount;
            var sampleRate = meta.audioSampleRate;

            var data = new Uint8Array([0x00, 0x00, 0x00, 0x00, // reserved(4)
            0x00, 0x00, 0x00, 0x01, // reserved(2) + data_reference_index(2)
            0x00, 0x00, 0x00, 0x00, // reserved: 2 * 4 bytes
            0x00, 0x00, 0x00, 0x00, 0x00, channelCount, // channelCount(2)
            0x00, 0x10, // sampleSize(2)
            0x00, 0x00, 0x00, 0x00, // reserved(4)
            sampleRate >>> 8 & 0xFF, // Audio sample rate
            sampleRate & 0xFF, 0x00, 0x00]);

            return MP4.box(MP4.types.mp4a, data, MP4.esds(meta));
        }
    }, {
        key: 'esds',
        value: function esds(meta) {
            var config = meta.config || [];
            var configSize = config.length;
            var data = new Uint8Array([0x00, 0x00, 0x00, 0x00, // version 0 + flags

            0x03, // descriptor_type
            0x17 + configSize, // length3
            0x00, 0x01, // es_id
            0x00, // stream_priority

            0x04, // descriptor_type
            0x0F + configSize, // length
            0x40, // codec: mpeg4_audio
            0x15, // stream_type: Audio
            0x00, 0x00, 0x00, // buffer_size
            0x00, 0x00, 0x00, 0x00, // maxBitrate
            0x00, 0x00, 0x00, 0x00, // avgBitrate

            0x05 // descriptor_type
            ].concat([configSize]).concat(config).concat([0x06, 0x01, 0x02 // GASpecificConfig
            ]));
            return MP4.box(MP4.types.esds, data);
        }
    }, {
        key: 'avc1',
        value: function avc1(meta) {
            var avcc = meta.avcc;
            var width = meta.codecWidth,
                height = meta.codecHeight;

            var data = new Uint8Array([0x00, 0x00, 0x00, 0x00, // reserved(4)
            0x00, 0x00, 0x00, 0x01, // reserved(2) + data_reference_index(2)
            0x00, 0x00, 0x00, 0x00, // pre_defined(2) + reserved(2)
            0x00, 0x00, 0x00, 0x00, // pre_defined: 3 * 4 bytes
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, width >>> 8 & 0xFF, // width: 2 bytes
            width & 0xFF, height >>> 8 & 0xFF, // height: 2 bytes
            height & 0xFF, 0x00, 0x48, 0x00, 0x00, // horizresolution: 4 bytes
            0x00, 0x48, 0x00, 0x00, // vertresolution: 4 bytes
            0x00, 0x00, 0x00, 0x00, // reserved: 4 bytes
            0x00, 0x01, // frame_count
            0x0A, // strlen
            0x78, 0x71, 0x71, 0x2F, // compressorname: 32 bytes
            0x66, 0x6C, 0x76, 0x2E, 0x6A, 0x73, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x18, // depth
            0xFF, 0xFF // pre_defined = -1
            ]);
            return MP4.box(MP4.types.avc1, data, MP4.box(MP4.types.avcC, avcc));
        }

        // Movie Extends box

    }, {
        key: 'mvex',
        value: function mvex(meta) {
            return MP4.box(MP4.types.mvex, MP4.trex(meta));
        }

        // Track Extends box

    }, {
        key: 'trex',
        value: function trex(meta) {
            var trackId = meta.id;
            var data = new Uint8Array([0x00, 0x00, 0x00, 0x00, // version(0) + flags
            trackId >>> 24 & 0xFF, // track_ID
            trackId >>> 16 & 0xFF, trackId >>> 8 & 0xFF, trackId & 0xFF, 0x00, 0x00, 0x00, 0x01, // default_sample_description_index
            0x00, 0x00, 0x00, 0x00, // default_sample_duration
            0x00, 0x00, 0x00, 0x00, // default_sample_size
            0x00, 0x01, 0x00, 0x01 // default_sample_flags
            ]);
            return MP4.box(MP4.types.trex, data);
        }

        // Movie fragment box

    }, {
        key: 'moof',
        value: function moof(track, baseMediaDecodeTime) {
            return MP4.box(MP4.types.moof, MP4.mfhd(track.sequenceNumber), MP4.traf(track, baseMediaDecodeTime));
        }
    }, {
        key: 'mfhd',
        value: function mfhd(sequenceNumber) {
            var data = new Uint8Array([0x00, 0x00, 0x00, 0x00, sequenceNumber >>> 24 & 0xFF, // sequence_number: int32
            sequenceNumber >>> 16 & 0xFF, sequenceNumber >>> 8 & 0xFF, sequenceNumber & 0xFF]);
            return MP4.box(MP4.types.mfhd, data);
        }

        // Track fragment box

    }, {
        key: 'traf',
        value: function traf(track, baseMediaDecodeTime) {
            var trackId = track.id;

            // Track fragment header box
            var tfhd = MP4.box(MP4.types.tfhd, new Uint8Array([0x00, 0x00, 0x00, 0x00, // version(0) & flags
            trackId >>> 24 & 0xFF, // track_ID
            trackId >>> 16 & 0xFF, trackId >>> 8 & 0xFF, trackId & 0xFF]));
            // Track Fragment Decode Time
            var tfdt = MP4.box(MP4.types.tfdt, new Uint8Array([0x00, 0x00, 0x00, 0x00, // version(0) & flags
            baseMediaDecodeTime >>> 24 & 0xFF, // baseMediaDecodeTime: int32
            baseMediaDecodeTime >>> 16 & 0xFF, baseMediaDecodeTime >>> 8 & 0xFF, baseMediaDecodeTime & 0xFF]));
            var sdtp = MP4.sdtp(track);
            var trun = MP4.trun(track, sdtp.byteLength + 16 + 16 + 8 + 16 + 8 + 8);

            return MP4.box(MP4.types.traf, tfhd, tfdt, trun, sdtp);
        }

        // Sample Dependency Type box

    }, {
        key: 'sdtp',
        value: function sdtp(track) {
            var samples = track.samples || [];
            var sampleCount = samples.length;
            var data = new Uint8Array(4 + sampleCount);
            // 0~4 bytes: version(0) & flags
            for (var i = 0; i < sampleCount; i++) {
                var flags = samples[i].flags;
                data[i + 4] = flags.isLeading << 6 | // is_leading: 2 (bit)
                flags.dependsOn << 4 // sample_depends_on
                | flags.isDependedOn << 2 // sample_is_depended_on
                | flags.hasRedundancy; // sample_has_redundancy
            }
            return MP4.box(MP4.types.sdtp, data);
        }

        // Track fragment run box

    }, {
        key: 'trun',
        value: function trun(track, offset) {
            var samples = track.samples || [];
            var sampleCount = samples.length;
            var dataSize = 12 + 16 * sampleCount;
            var data = new Uint8Array(dataSize);
            offset += 8 + dataSize;

            data.set([0x00, 0x00, 0x0F, 0x01, // version(0) & flags
            sampleCount >>> 24 & 0xFF, // sample_count
            sampleCount >>> 16 & 0xFF, sampleCount >>> 8 & 0xFF, sampleCount & 0xFF, offset >>> 24 & 0xFF, // data_offset
            offset >>> 16 & 0xFF, offset >>> 8 & 0xFF, offset & 0xFF], 0);

            for (var i = 0; i < sampleCount; i++) {
                var duration = samples[i].duration;
                var size = samples[i].size;
                var flags = samples[i].flags;
                var cts = samples[i].cts;
                data.set([duration >>> 24 & 0xFF, // sample_duration
                duration >>> 16 & 0xFF, duration >>> 8 & 0xFF, duration & 0xFF, size >>> 24 & 0xFF, // sample_size
                size >>> 16 & 0xFF, size >>> 8 & 0xFF, size & 0xFF, flags.isLeading << 2 | flags.dependsOn, // sample_flags
                flags.isDependedOn << 6 | flags.hasRedundancy << 4 | flags.isNonSync, 0x00, 0x00, // sample_degradation_priority
                cts >>> 24 & 0xFF, // sample_composition_time_offset
                cts >>> 16 & 0xFF, cts >>> 8 & 0xFF, cts & 0xFF], 12 + 16 * i);
            }
            return MP4.box(MP4.types.trun, data);
        }
    }, {
        key: 'mdat',
        value: function mdat(data) {
            return MP4.box(MP4.types.mdat, data);
        }
    }]);

    return MP4;
}();

MP4.init();

exports.default = MP4;

},{}],39:[function(_dereq_,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); /*
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * Copyright (C) 2016 Bilibili. All Rights Reserved.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * @author zheng qian <xqq@xqq.im>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * Licensed under the Apache License, Version 2.0 (the "License");
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * you may not use this file except in compliance with the License.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * You may obtain a copy of the License at
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *     http://www.apache.org/licenses/LICENSE-2.0
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * Unless required by applicable law or agreed to in writing, software
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * distributed under the License is distributed on an "AS IS" BASIS,
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * See the License for the specific language governing permissions and
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * limitations under the License.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      */

var _logger = _dereq_('../utils/logger.js');

var _logger2 = _interopRequireDefault(_logger);

var _mp4Generator = _dereq_('./mp4-generator.js');

var _mp4Generator2 = _interopRequireDefault(_mp4Generator);

var _aacSilent = _dereq_('./aac-silent.js');

var _aacSilent2 = _interopRequireDefault(_aacSilent);

var _browser = _dereq_('../utils/browser.js');

var _browser2 = _interopRequireDefault(_browser);

var _mediaSegmentInfo = _dereq_('../core/media-segment-info.js');

var _exception = _dereq_('../utils/exception.js');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

// Fragmented mp4 remuxer
var MP4Remuxer = function () {
    function MP4Remuxer(config) {
        _classCallCheck(this, MP4Remuxer);

        this.TAG = 'MP4Remuxer';

        this._config = config;
        this._isLive = config.isLive === true ? true : false;

        this._dtsBase = -1;
        this._dtsBaseInited = false;
        this._audioDtsBase = Infinity;
        this._videoDtsBase = Infinity;
        this._audioNextDts = undefined;
        this._videoNextDts = undefined;
        this._audioStashedLastSample = null;
        this._videoStashedLastSample = null;

        this._audioMeta = null;
        this._videoMeta = null;

        this._audioSegmentInfoList = new _mediaSegmentInfo.MediaSegmentInfoList('audio');
        this._videoSegmentInfoList = new _mediaSegmentInfo.MediaSegmentInfoList('video');

        this._onInitSegment = null;
        this._onMediaSegment = null;

        // Workaround for chrome < 50: Always force first sample as a Random Access Point in media segment
        // see https://bugs.chromium.org/p/chromium/issues/detail?id=229412
        this._forceFirstIDR = _browser2.default.chrome && (_browser2.default.version.major < 50 || _browser2.default.version.major === 50 && _browser2.default.version.build < 2661) ? true : false;

        // Workaround for IE11/Edge: Fill silent aac frame after keyframe-seeking
        // Make audio beginDts equals with video beginDts, in order to fix seek freeze
        this._fillSilentAfterSeek = _browser2.default.msedge || _browser2.default.msie;

        // While only FireFox supports 'audio/mp4, codecs="mp3"', use 'audio/mpeg' for chrome, safari, ...
        this._mp3UseMpegAudio = !_browser2.default.firefox;

        this._fillAudioTimestampGap = this._config.fixAudioTimestampGap;
    }

    _createClass(MP4Remuxer, [{
        key: 'destroy',
        value: function destroy() {
            this._dtsBase = -1;
            this._dtsBaseInited = false;
            this._audioMeta = null;
            this._videoMeta = null;
            this._audioSegmentInfoList.clear();
            this._audioSegmentInfoList = null;
            this._videoSegmentInfoList.clear();
            this._videoSegmentInfoList = null;
            this._onInitSegment = null;
            this._onMediaSegment = null;
        }
    }, {
        key: 'bindDataSource',
        value: function bindDataSource(producer) {
            producer.onDataAvailable = this.remux.bind(this);
            producer.onTrackMetadata = this._onTrackMetadataReceived.bind(this);
            return this;
        }

        /* prototype: function onInitSegment(type: string, initSegment: ArrayBuffer): void
           InitSegment: {
               type: string,
               data: ArrayBuffer,
               codec: string,
               container: string
           }
        */

    }, {
        key: 'insertDiscontinuity',
        value: function insertDiscontinuity() {
            this._audioNextDts = this._videoNextDts = undefined;
        }
    }, {
        key: 'seek',
        value: function seek(originalDts) {
            this._audioStashedLastSample = null;
            this._videoStashedLastSample = null;
            this._videoSegmentInfoList.clear();
            this._audioSegmentInfoList.clear();
        }
    }, {
        key: 'remux',
        value: function remux(audioTrack, videoTrack) {
            if (!this._onMediaSegment) {
                throw new _exception.IllegalStateException('MP4Remuxer: onMediaSegment callback must be specificed!');
            }
            if (!this._dtsBaseInited) {
                this._calculateDtsBase(audioTrack, videoTrack);
            }
            this._remuxVideo(videoTrack);
            this._remuxAudio(audioTrack);
        }
    }, {
        key: '_onTrackMetadataReceived',
        value: function _onTrackMetadataReceived(type, metadata) {
            var metabox = null;

            var container = 'mp4';
            var codec = metadata.codec;

            if (type === 'audio') {
                this._audioMeta = metadata;
                if (metadata.codec === 'mp3' && this._mp3UseMpegAudio) {
                    // 'audio/mpeg' for MP3 audio track
                    container = 'mpeg';
                    codec = '';
                    metabox = new Uint8Array();
                } else {
                    // 'audio/mp4, codecs="codec"'
                    metabox = _mp4Generator2.default.generateInitSegment(metadata);
                }
            } else if (type === 'video') {
                this._videoMeta = metadata;
                metabox = _mp4Generator2.default.generateInitSegment(metadata);
            } else {
                return;
            }

            // dispatch metabox (Initialization Segment)
            if (!this._onInitSegment) {
                throw new _exception.IllegalStateException('MP4Remuxer: onInitSegment callback must be specified!');
            }
            this._onInitSegment(type, {
                type: type,
                data: metabox.buffer,
                codec: codec,
                container: type + '/' + container,
                mediaDuration: metadata.duration // in timescale 1000 (milliseconds)
            });
        }
    }, {
        key: '_calculateDtsBase',
        value: function _calculateDtsBase(audioTrack, videoTrack) {
            if (this._dtsBaseInited) {
                return;
            }

            if (audioTrack.samples && audioTrack.samples.length) {
                this._audioDtsBase = audioTrack.samples[0].dts;
            }
            if (videoTrack.samples && videoTrack.samples.length) {
                this._videoDtsBase = videoTrack.samples[0].dts;
            }

            this._dtsBase = Math.min(this._audioDtsBase, this._videoDtsBase);
            this._dtsBaseInited = true;
        }
    }, {
        key: 'flushStashedSamples',
        value: function flushStashedSamples() {
            var videoSample = this._videoStashedLastSample;
            var audioSample = this._audioStashedLastSample;

            var videoTrack = {
                type: 'video',
                id: 1,
                sequenceNumber: 0,
                samples: [],
                length: 0
            };

            if (videoSample != null) {
                videoTrack.samples.push(videoSample);
                videoTrack.length = videoSample.length;
            }

            var audioTrack = {
                type: 'audio',
                id: 2,
                sequenceNumber: 0,
                samples: [],
                length: 0
            };

            if (audioSample != null) {
                audioTrack.samples.push(audioSample);
                audioTrack.length = audioSample.length;
            }

            this._videoStashedLastSample = null;
            this._audioStashedLastSample = null;

            this._remuxVideo(videoTrack, true);
            this._remuxAudio(audioTrack, true);
        }
    }, {
        key: '_remuxAudio',
        value: function _remuxAudio(audioTrack, force) {
            if (this._audioMeta == null) {
                return;
            }

            var track = audioTrack;
            var samples = track.samples;
            var dtsCorrection = undefined;
            var firstDts = -1,
                lastDts = -1,
                lastPts = -1;
            var refSampleDuration = this._audioMeta.refSampleDuration;

            var mpegRawTrack = this._audioMeta.codec === 'mp3' && this._mp3UseMpegAudio;
            var firstSegmentAfterSeek = this._dtsBaseInited && this._audioNextDts === undefined;

            var insertPrefixSilentFrame = false;

            if (!samples || samples.length === 0) {
                return;
            }
            if (samples.length === 1 && !force) {
                // If [sample count in current batch] === 1 && (force != true)
                // Ignore and keep in demuxer's queue
                return;
            } // else if (force === true) do remux

            var offset = 0;
            var mdatbox = null;
            var mdatBytes = 0;

            // calculate initial mdat size
            if (mpegRawTrack) {
                // for raw mpeg buffer
                offset = 0;
                mdatBytes = track.length;
            } else {
                // for fmp4 mdat box
                offset = 8; // size + type
                mdatBytes = 8 + track.length;
            }

            var lastSample = null;

            // Pop the lastSample and waiting for stash
            if (samples.length > 1) {
                lastSample = samples.pop();
                mdatBytes -= lastSample.length;
            }

            // Insert [stashed lastSample in the previous batch] to the front
            if (this._audioStashedLastSample != null) {
                var sample = this._audioStashedLastSample;
                this._audioStashedLastSample = null;
                samples.unshift(sample);
                mdatBytes += sample.length;
            }

            // Stash the lastSample of current batch, waiting for next batch
            if (lastSample != null) {
                this._audioStashedLastSample = lastSample;
            }

            var firstSampleOriginalDts = samples[0].dts - this._dtsBase;

            // calculate dtsCorrection
            if (this._audioNextDts) {
                dtsCorrection = firstSampleOriginalDts - this._audioNextDts;
            } else {
                // this._audioNextDts == undefined
                if (this._audioSegmentInfoList.isEmpty()) {
                    dtsCorrection = 0;
                    if (this._fillSilentAfterSeek && !this._videoSegmentInfoList.isEmpty()) {
                        if (this._audioMeta.originalCodec !== 'mp3') {
                            insertPrefixSilentFrame = true;
                        }
                    }
                } else {
                    var _lastSample = this._audioSegmentInfoList.getLastSampleBefore(firstSampleOriginalDts);
                    if (_lastSample != null) {
                        var distance = firstSampleOriginalDts - (_lastSample.originalDts + _lastSample.duration);
                        if (distance <= 3) {
                            distance = 0;
                        }
                        var expectedDts = _lastSample.dts + _lastSample.duration + distance;
                        dtsCorrection = firstSampleOriginalDts - expectedDts;
                    } else {
                        // lastSample == null, cannot found
                        dtsCorrection = 0;
                    }
                }
            }

            if (insertPrefixSilentFrame) {
                // align audio segment beginDts to match with current video segment's beginDts
                var firstSampleDts = firstSampleOriginalDts - dtsCorrection;
                var videoSegment = this._videoSegmentInfoList.getLastSegmentBefore(firstSampleOriginalDts);
                if (videoSegment != null && videoSegment.beginDts < firstSampleDts) {
                    var silentUnit = _aacSilent2.default.getSilentFrame(this._audioMeta.originalCodec, this._audioMeta.channelCount);
                    if (silentUnit) {
                        var dts = videoSegment.beginDts;
                        var silentFrameDuration = firstSampleDts - videoSegment.beginDts;
                        _logger2.default.v(this.TAG, 'InsertPrefixSilentAudio: dts: ' + dts + ', duration: ' + silentFrameDuration);
                        samples.unshift({ unit: silentUnit, dts: dts, pts: dts });
                        mdatBytes += silentUnit.byteLength;
                    } // silentUnit == null: Cannot generate, skip
                } else {
                    insertPrefixSilentFrame = false;
                }
            }

            var mp4Samples = [];

            // Correct dts for each sample, and calculate sample duration. Then output to mp4Samples
            for (var i = 0; i < samples.length; i++) {
                var _sample = samples[i];
                var unit = _sample.unit;
                var originalDts = _sample.dts - this._dtsBase;
                var _dts = originalDts - dtsCorrection;

                if (firstDts === -1) {
                    firstDts = _dts;
                }

                var sampleDuration = 0;

                if (i !== samples.length - 1) {
                    var nextDts = samples[i + 1].dts - this._dtsBase - dtsCorrection;
                    sampleDuration = nextDts - _dts;
                } else {
                    // the last sample
                    if (lastSample != null) {
                        // use stashed sample's dts to calculate sample duration
                        var _nextDts = lastSample.dts - this._dtsBase - dtsCorrection;
                        sampleDuration = _nextDts - _dts;
                    } else if (mp4Samples.length >= 1) {
                        // use second last sample duration
                        sampleDuration = mp4Samples[mp4Samples.length - 1].duration;
                    } else {
                        // the only one sample, use reference sample duration
                        sampleDuration = Math.floor(refSampleDuration);
                    }
                }

                var needFillSilentFrames = false;
                var silentFrames = null;

                // Silent frame generation, if large timestamp gap detected && config.fixAudioTimestampGap
                if (sampleDuration > refSampleDuration * 1.5 && this._audioMeta.codec !== 'mp3' && this._fillAudioTimestampGap && !_browser2.default.safari) {
                    // We need to insert silent frames to fill timestamp gap
                    needFillSilentFrames = true;
                    var delta = Math.abs(sampleDuration - refSampleDuration);
                    var frameCount = Math.ceil(delta / refSampleDuration);
                    var currentDts = _dts + refSampleDuration; // Notice: in float

                    _logger2.default.w(this.TAG, 'Large audio timestamp gap detected, may cause AV sync to drift. ' + 'Silent frames will be generated to avoid unsync.\n' + ('dts: ' + (_dts + sampleDuration) + ' ms, expected: ' + (_dts + Math.round(refSampleDuration)) + ' ms, ') + ('delta: ' + Math.round(delta) + ' ms, generate: ' + frameCount + ' frames'));

                    var _silentUnit = _aacSilent2.default.getSilentFrame(this._audioMeta.originalCodec, this._audioMeta.channelCount);
                    if (_silentUnit == null) {
                        _logger2.default.w(this.TAG, 'Unable to generate silent frame for ' + (this._audioMeta.originalCodec + ' with ' + this._audioMeta.channelCount + ' channels, repeat last frame'));
                        // Repeat last frame
                        _silentUnit = unit;
                    }
                    silentFrames = [];

                    for (var j = 0; j < frameCount; j++) {
                        var intDts = Math.round(currentDts); // round to integer
                        if (silentFrames.length > 0) {
                            // Set previous frame sample duration
                            var previousFrame = silentFrames[silentFrames.length - 1];
                            previousFrame.duration = intDts - previousFrame.dts;
                        }
                        var frame = {
                            dts: intDts,
                            pts: intDts,
                            cts: 0,
                            unit: _silentUnit,
                            size: _silentUnit.byteLength,
                            duration: 0, // wait for next sample
                            originalDts: originalDts,
                            flags: {
                                isLeading: 0,
                                dependsOn: 1,
                                isDependedOn: 0,
                                hasRedundancy: 0
                            }
                        };
                        silentFrames.push(frame);
                        mdatBytes += unit.byteLength;
                        currentDts += refSampleDuration;
                    }

                    // last frame: align end time to next frame dts
                    var lastFrame = silentFrames[silentFrames.length - 1];
                    lastFrame.duration = _dts + sampleDuration - lastFrame.dts;

                    // silentFrames.forEach((frame) => {
                    //     Log.w(this.TAG, `SilentAudio: dts: ${frame.dts}, duration: ${frame.duration}`);
                    // });

                    // Set correct sample duration for current frame
                    sampleDuration = Math.round(refSampleDuration);
                }

                mp4Samples.push({
                    dts: _dts,
                    pts: _dts,
                    cts: 0,
                    unit: _sample.unit,
                    size: _sample.unit.byteLength,
                    duration: sampleDuration,
                    originalDts: originalDts,
                    flags: {
                        isLeading: 0,
                        dependsOn: 1,
                        isDependedOn: 0,
                        hasRedundancy: 0
                    }
                });

                if (needFillSilentFrames) {
                    // Silent frames should be inserted after wrong-duration frame
                    mp4Samples.push.apply(mp4Samples, silentFrames);
                }
            }

            // allocate mdatbox
            if (mpegRawTrack) {
                // allocate for raw mpeg buffer
                mdatbox = new Uint8Array(mdatBytes);
            } else {
                // allocate for fmp4 mdat box
                mdatbox = new Uint8Array(mdatBytes);
                // size field
                mdatbox[0] = mdatBytes >>> 24 & 0xFF;
                mdatbox[1] = mdatBytes >>> 16 & 0xFF;
                mdatbox[2] = mdatBytes >>> 8 & 0xFF;
                mdatbox[3] = mdatBytes & 0xFF;
                // type field (fourCC)
                mdatbox.set(_mp4Generator2.default.types.mdat, 4);
            }

            // Write samples into mdatbox
            for (var _i = 0; _i < mp4Samples.length; _i++) {
                var _unit = mp4Samples[_i].unit;
                mdatbox.set(_unit, offset);
                offset += _unit.byteLength;
            }

            var latest = mp4Samples[mp4Samples.length - 1];
            lastDts = latest.dts + latest.duration;
            this._audioNextDts = lastDts;

            // fill media segment info & add to info list
            var info = new _mediaSegmentInfo.MediaSegmentInfo();
            info.beginDts = firstDts;
            info.endDts = lastDts;
            info.beginPts = firstDts;
            info.endPts = lastDts;
            info.originalBeginDts = mp4Samples[0].originalDts;
            info.originalEndDts = latest.originalDts + latest.duration;
            info.firstSample = new _mediaSegmentInfo.SampleInfo(mp4Samples[0].dts, mp4Samples[0].pts, mp4Samples[0].duration, mp4Samples[0].originalDts, false);
            info.lastSample = new _mediaSegmentInfo.SampleInfo(latest.dts, latest.pts, latest.duration, latest.originalDts, false);
            if (!this._isLive) {
                this._audioSegmentInfoList.append(info);
            }

            track.samples = mp4Samples;
            track.sequenceNumber++;

            var moofbox = null;

            if (mpegRawTrack) {
                // Generate empty buffer, because useless for raw mpeg
                moofbox = new Uint8Array();
            } else {
                // Generate moof for fmp4 segment
                moofbox = _mp4Generator2.default.moof(track, firstDts);
            }

            track.samples = [];
            track.length = 0;

            var segment = {
                type: 'audio',
                data: this._mergeBoxes(moofbox, mdatbox).buffer,
                sampleCount: mp4Samples.length,
                info: info
            };

            if (mpegRawTrack && firstSegmentAfterSeek) {
                // For MPEG audio stream in MSE, if seeking occurred, before appending new buffer
                // We need explicitly set timestampOffset to the desired point in timeline for mpeg SourceBuffer.
                segment.timestampOffset = firstDts;
            }

            this._onMediaSegment('audio', segment);
        }
    }, {
        key: '_remuxVideo',
        value: function _remuxVideo(videoTrack, force) {
            if (this._videoMeta == null) {
                return;
            }

            var track = videoTrack;
            var samples = track.samples;
            var dtsCorrection = undefined;
            var firstDts = -1,
                lastDts = -1;
            var firstPts = -1,
                lastPts = -1;

            if (!samples || samples.length === 0) {
                return;
            }
            if (samples.length === 1 && !force) {
                // If [sample count in current batch] === 1 && (force != true)
                // Ignore and keep in demuxer's queue
                return;
            } // else if (force === true) do remux

            var offset = 8;
            var mdatbox = null;
            var mdatBytes = 8 + videoTrack.length;

            var lastSample = null;

            // Pop the lastSample and waiting for stash
            if (samples.length > 1) {
                lastSample = samples.pop();
                mdatBytes -= lastSample.length;
            }

            // Insert [stashed lastSample in the previous batch] to the front
            if (this._videoStashedLastSample != null) {
                var sample = this._videoStashedLastSample;
                this._videoStashedLastSample = null;
                samples.unshift(sample);
                mdatBytes += sample.length;
            }

            // Stash the lastSample of current batch, waiting for next batch
            if (lastSample != null) {
                this._videoStashedLastSample = lastSample;
            }

            var firstSampleOriginalDts = samples[0].dts - this._dtsBase;

            // calculate dtsCorrection
            if (this._videoNextDts) {
                dtsCorrection = firstSampleOriginalDts - this._videoNextDts;
            } else {
                // this._videoNextDts == undefined
                if (this._videoSegmentInfoList.isEmpty()) {
                    dtsCorrection = 0;
                } else {
                    var _lastSample2 = this._videoSegmentInfoList.getLastSampleBefore(firstSampleOriginalDts);
                    if (_lastSample2 != null) {
                        var distance = firstSampleOriginalDts - (_lastSample2.originalDts + _lastSample2.duration);
                        if (distance <= 3) {
                            distance = 0;
                        }
                        var expectedDts = _lastSample2.dts + _lastSample2.duration + distance;
                        dtsCorrection = firstSampleOriginalDts - expectedDts;
                    } else {
                        // lastSample == null, cannot found
                        dtsCorrection = 0;
                    }
                }
            }

            var info = new _mediaSegmentInfo.MediaSegmentInfo();
            var mp4Samples = [];

            // Correct dts for each sample, and calculate sample duration. Then output to mp4Samples
            for (var i = 0; i < samples.length; i++) {
                var _sample2 = samples[i];
                var originalDts = _sample2.dts - this._dtsBase;
                var isKeyframe = _sample2.isKeyframe;
                var dts = originalDts - dtsCorrection;
                var cts = _sample2.cts;
                var pts = dts + cts;

                if (firstDts === -1) {
                    firstDts = dts;
                    firstPts = pts;
                }

                var sampleDuration = 0;

                if (i !== samples.length - 1) {
                    var nextDts = samples[i + 1].dts - this._dtsBase - dtsCorrection;
                    sampleDuration = nextDts - dts;
                } else {
                    // the last sample
                    if (lastSample != null) {
                        // use stashed sample's dts to calculate sample duration
                        var _nextDts2 = lastSample.dts - this._dtsBase - dtsCorrection;
                        sampleDuration = _nextDts2 - dts;
                    } else if (mp4Samples.length >= 1) {
                        // use second last sample duration
                        sampleDuration = mp4Samples[mp4Samples.length - 1].duration;
                    } else {
                        // the only one sample, use reference sample duration
                        sampleDuration = Math.floor(this._videoMeta.refSampleDuration);
                    }
                }

                if (isKeyframe) {
                    var syncPoint = new _mediaSegmentInfo.SampleInfo(dts, pts, sampleDuration, _sample2.dts, true);
                    syncPoint.fileposition = _sample2.fileposition;
                    info.appendSyncPoint(syncPoint);
                }

                mp4Samples.push({
                    dts: dts,
                    pts: pts,
                    cts: cts,
                    units: _sample2.units,
                    size: _sample2.length,
                    isKeyframe: isKeyframe,
                    duration: sampleDuration,
                    originalDts: originalDts,
                    flags: {
                        isLeading: 0,
                        dependsOn: isKeyframe ? 2 : 1,
                        isDependedOn: isKeyframe ? 1 : 0,
                        hasRedundancy: 0,
                        isNonSync: isKeyframe ? 0 : 1
                    }
                });
            }

            // allocate mdatbox
            mdatbox = new Uint8Array(mdatBytes);
            mdatbox[0] = mdatBytes >>> 24 & 0xFF;
            mdatbox[1] = mdatBytes >>> 16 & 0xFF;
            mdatbox[2] = mdatBytes >>> 8 & 0xFF;
            mdatbox[3] = mdatBytes & 0xFF;
            mdatbox.set(_mp4Generator2.default.types.mdat, 4);

            // Write samples into mdatbox
            for (var _i2 = 0; _i2 < mp4Samples.length; _i2++) {
                var units = mp4Samples[_i2].units;
                while (units.length) {
                    var unit = units.shift();
                    var data = unit.data;
                    mdatbox.set(data, offset);
                    offset += data.byteLength;
                }
            }

            var latest = mp4Samples[mp4Samples.length - 1];
            lastDts = latest.dts + latest.duration;
            lastPts = latest.pts + latest.duration;
            this._videoNextDts = lastDts;

            // fill media segment info & add to info list
            info.beginDts = firstDts;
            info.endDts = lastDts;
            info.beginPts = firstPts;
            info.endPts = lastPts;
            info.originalBeginDts = mp4Samples[0].originalDts;
            info.originalEndDts = latest.originalDts + latest.duration;
            info.firstSample = new _mediaSegmentInfo.SampleInfo(mp4Samples[0].dts, mp4Samples[0].pts, mp4Samples[0].duration, mp4Samples[0].originalDts, mp4Samples[0].isKeyframe);
            info.lastSample = new _mediaSegmentInfo.SampleInfo(latest.dts, latest.pts, latest.duration, latest.originalDts, latest.isKeyframe);
            if (!this._isLive) {
                this._videoSegmentInfoList.append(info);
            }

            track.samples = mp4Samples;
            track.sequenceNumber++;

            // workaround for chrome < 50: force first sample as a random access point
            // see https://bugs.chromium.org/p/chromium/issues/detail?id=229412
            if (this._forceFirstIDR) {
                var flags = mp4Samples[0].flags;
                flags.dependsOn = 2;
                flags.isNonSync = 0;
            }

            var moofbox = _mp4Generator2.default.moof(track, firstDts);
            track.samples = [];
            track.length = 0;

            this._onMediaSegment('video', {
                type: 'video',
                data: this._mergeBoxes(moofbox, mdatbox).buffer,
                sampleCount: mp4Samples.length,
                info: info
            });
        }
    }, {
        key: '_mergeBoxes',
        value: function _mergeBoxes(moof, mdat) {
            var result = new Uint8Array(moof.byteLength + mdat.byteLength);
            result.set(moof, 0);
            result.set(mdat, moof.byteLength);
            return result;
        }
    }, {
        key: 'onInitSegment',
        get: function get() {
            return this._onInitSegment;
        },
        set: function set(callback) {
            this._onInitSegment = callback;
        }

        /* prototype: function onMediaSegment(type: string, mediaSegment: MediaSegment): void
           MediaSegment: {
               type: string,
               data: ArrayBuffer,
               sampleCount: int32
               info: MediaSegmentInfo
           }
        */

    }, {
        key: 'onMediaSegment',
        get: function get() {
            return this._onMediaSegment;
        },
        set: function set(callback) {
            this._onMediaSegment = callback;
        }
    }]);

    return MP4Remuxer;
}();

exports.default = MP4Remuxer;

},{"../core/media-segment-info.js":9,"../utils/browser.js":40,"../utils/exception.js":41,"../utils/logger.js":42,"./aac-silent.js":37,"./mp4-generator.js":38}],40:[function(_dereq_,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
/*
 * Copyright (C) 2016 Bilibili. All Rights Reserved.
 *
 * @author zheng qian <xqq@xqq.im>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var Browser = {};

function detect() {
    // modified from jquery-browser-plugin

    var ua = self.navigator.userAgent.toLowerCase();

    var match = /(edge)\/([\w.]+)/.exec(ua) || /(opr)[\/]([\w.]+)/.exec(ua) || /(chrome)[ \/]([\w.]+)/.exec(ua) || /(iemobile)[\/]([\w.]+)/.exec(ua) || /(version)(applewebkit)[ \/]([\w.]+).*(safari)[ \/]([\w.]+)/.exec(ua) || /(webkit)[ \/]([\w.]+).*(version)[ \/]([\w.]+).*(safari)[ \/]([\w.]+)/.exec(ua) || /(webkit)[ \/]([\w.]+)/.exec(ua) || /(opera)(?:.*version|)[ \/]([\w.]+)/.exec(ua) || /(msie) ([\w.]+)/.exec(ua) || ua.indexOf('trident') >= 0 && /(rv)(?::| )([\w.]+)/.exec(ua) || ua.indexOf('compatible') < 0 && /(firefox)[ \/]([\w.]+)/.exec(ua) || [];

    var platform_match = /(ipad)/.exec(ua) || /(ipod)/.exec(ua) || /(windows phone)/.exec(ua) || /(iphone)/.exec(ua) || /(kindle)/.exec(ua) || /(android)/.exec(ua) || /(windows)/.exec(ua) || /(mac)/.exec(ua) || /(linux)/.exec(ua) || /(cros)/.exec(ua) || [];

    var matched = {
        browser: match[5] || match[3] || match[1] || '',
        version: match[2] || match[4] || '0',
        majorVersion: match[4] || match[2] || '0',
        platform: platform_match[0] || ''
    };

    var browser = {};
    if (matched.browser) {
        browser[matched.browser] = true;

        var versionArray = matched.majorVersion.split('.');
        browser.version = {
            major: parseInt(matched.majorVersion, 10),
            string: matched.version
        };
        if (versionArray.length > 1) {
            browser.version.minor = parseInt(versionArray[1], 10);
        }
        if (versionArray.length > 2) {
            browser.version.build = parseInt(versionArray[2], 10);
        }
    }

    if (matched.platform) {
        browser[matched.platform] = true;
    }

    if (browser.chrome || browser.opr || browser.safari) {
        browser.webkit = true;
    }

    // MSIE. IE11 has 'rv' identifer
    if (browser.rv || browser.iemobile) {
        if (browser.rv) {
            delete browser.rv;
        }
        var msie = 'msie';
        matched.browser = msie;
        browser[msie] = true;
    }

    // Microsoft Edge
    if (browser.edge) {
        delete browser.edge;
        var msedge = 'msedge';
        matched.browser = msedge;
        browser[msedge] = true;
    }

    // Opera 15+
    if (browser.opr) {
        var opera = 'opera';
        matched.browser = opera;
        browser[opera] = true;
    }

    // Stock android browsers are marked as Safari
    if (browser.safari && browser.android) {
        var android = 'android';
        matched.browser = android;
        browser[android] = true;
    }

    browser.name = matched.browser;
    browser.platform = matched.platform;

    for (var key in Browser) {
        if (Browser.hasOwnProperty(key)) {
            delete Browser[key];
        }
    }
    Object.assign(Browser, browser);
}

detect();

exports.default = Browser;

},{}],41:[function(_dereq_,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/*
 * Copyright (C) 2016 Bilibili. All Rights Reserved.
 *
 * @author zheng qian <xqq@xqq.im>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var RuntimeException = exports.RuntimeException = function () {
    function RuntimeException(message) {
        _classCallCheck(this, RuntimeException);

        this._message = message;
    }

    _createClass(RuntimeException, [{
        key: 'toString',
        value: function toString() {
            return this.name + ': ' + this.message;
        }
    }, {
        key: 'name',
        get: function get() {
            return 'RuntimeException';
        }
    }, {
        key: 'message',
        get: function get() {
            return this._message;
        }
    }]);

    return RuntimeException;
}();

var IllegalStateException = exports.IllegalStateException = function (_RuntimeException) {
    _inherits(IllegalStateException, _RuntimeException);

    function IllegalStateException(message) {
        _classCallCheck(this, IllegalStateException);

        return _possibleConstructorReturn(this, (IllegalStateException.__proto__ || Object.getPrototypeOf(IllegalStateException)).call(this, message));
    }

    _createClass(IllegalStateException, [{
        key: 'name',
        get: function get() {
            return 'IllegalStateException';
        }
    }]);

    return IllegalStateException;
}(RuntimeException);

var InvalidArgumentException = exports.InvalidArgumentException = function (_RuntimeException2) {
    _inherits(InvalidArgumentException, _RuntimeException2);

    function InvalidArgumentException(message) {
        _classCallCheck(this, InvalidArgumentException);

        return _possibleConstructorReturn(this, (InvalidArgumentException.__proto__ || Object.getPrototypeOf(InvalidArgumentException)).call(this, message));
    }

    _createClass(InvalidArgumentException, [{
        key: 'name',
        get: function get() {
            return 'InvalidArgumentException';
        }
    }]);

    return InvalidArgumentException;
}(RuntimeException);

var NotImplementedException = exports.NotImplementedException = function (_RuntimeException3) {
    _inherits(NotImplementedException, _RuntimeException3);

    function NotImplementedException(message) {
        _classCallCheck(this, NotImplementedException);

        return _possibleConstructorReturn(this, (NotImplementedException.__proto__ || Object.getPrototypeOf(NotImplementedException)).call(this, message));
    }

    _createClass(NotImplementedException, [{
        key: 'name',
        get: function get() {
            return 'NotImplementedException';
        }
    }]);

    return NotImplementedException;
}(RuntimeException);

},{}],42:[function(_dereq_,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); /*
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * Copyright (C) 2016 Bilibili. All Rights Reserved.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * @author zheng qian <xqq@xqq.im>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * Licensed under the Apache License, Version 2.0 (the "License");
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * you may not use this file except in compliance with the License.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * You may obtain a copy of the License at
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *     http://www.apache.org/licenses/LICENSE-2.0
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * Unless required by applicable law or agreed to in writing, software
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * distributed under the License is distributed on an "AS IS" BASIS,
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * See the License for the specific language governing permissions and
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * limitations under the License.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      */

var _events = _dereq_('events');

var _events2 = _interopRequireDefault(_events);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Log = function () {
    function Log() {
        _classCallCheck(this, Log);
    }

    _createClass(Log, null, [{
        key: 'e',
        value: function e(tag, msg) {
            if (!tag || Log.FORCE_GLOBAL_TAG) tag = Log.GLOBAL_TAG;

            var str = '[' + tag + '] > ' + msg;

            if (Log.ENABLE_CALLBACK) {
                Log.emitter.emit('log', 'error', str);
            }

            if (!Log.ENABLE_ERROR) {
                return;
            }

            if (console.error) {
                console.error(str);
            } else if (console.warn) {
                console.warn(str);
            } else {
                console.log(str);
            }
        }
    }, {
        key: 'i',
        value: function i(tag, msg) {
            if (!tag || Log.FORCE_GLOBAL_TAG) tag = Log.GLOBAL_TAG;

            var str = '[' + tag + '] > ' + msg;

            if (Log.ENABLE_CALLBACK) {
                Log.emitter.emit('log', 'info', str);
            }

            if (!Log.ENABLE_INFO) {
                return;
            }

            if (console.info) {
                console.info(str);
            } else {
                console.log(str);
            }
        }
    }, {
        key: 'w',
        value: function w(tag, msg) {
            if (!tag || Log.FORCE_GLOBAL_TAG) tag = Log.GLOBAL_TAG;

            var str = '[' + tag + '] > ' + msg;

            if (Log.ENABLE_CALLBACK) {
                Log.emitter.emit('log', 'warn', str);
            }

            if (!Log.ENABLE_WARN) {
                return;
            }

            if (console.warn) {
                console.warn(str);
            } else {
                console.log(str);
            }
        }
    }, {
        key: 'd',
        value: function d(tag, msg) {
            if (!tag || Log.FORCE_GLOBAL_TAG) tag = Log.GLOBAL_TAG;

            var str = '[' + tag + '] > ' + msg;

            if (Log.ENABLE_CALLBACK) {
                Log.emitter.emit('log', 'debug', str);
            }

            if (!Log.ENABLE_DEBUG) {
                return;
            }

            if (console.debug) {
                console.debug(str);
            } else {
                console.log(str);
            }
        }
    }, {
        key: 'v',
        value: function v(tag, msg) {
            if (!tag || Log.FORCE_GLOBAL_TAG) tag = Log.GLOBAL_TAG;

            var str = '[' + tag + '] > ' + msg;

            if (Log.ENABLE_CALLBACK) {
                Log.emitter.emit('log', 'verbose', str);
            }

            if (!Log.ENABLE_VERBOSE) {
                return;
            }

            console.log(str);
        }
    }]);

    return Log;
}();

Log.GLOBAL_TAG = 'flv.js';
Log.FORCE_GLOBAL_TAG = false;
Log.ENABLE_ERROR = true;
Log.ENABLE_INFO = true;
Log.ENABLE_WARN = true;
Log.ENABLE_DEBUG = true;
Log.ENABLE_VERBOSE = true;

Log.ENABLE_CALLBACK = false;

Log.emitter = new _events2.default();

exports.default = Log;

},{"events":3}],43:[function(_dereq_,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); /*
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * Copyright (C) 2016 Bilibili. All Rights Reserved.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * @author zheng qian <xqq@xqq.im>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * Licensed under the Apache License, Version 2.0 (the "License");
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * you may not use this file except in compliance with the License.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * You may obtain a copy of the License at
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *     http://www.apache.org/licenses/LICENSE-2.0
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * Unless required by applicable law or agreed to in writing, software
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * distributed under the License is distributed on an "AS IS" BASIS,
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * See the License for the specific language governing permissions and
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * limitations under the License.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      */

var _events = _dereq_('events');

var _events2 = _interopRequireDefault(_events);

var _logger = _dereq_('./logger.js');

var _logger2 = _interopRequireDefault(_logger);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var LoggingControl = function () {
    function LoggingControl() {
        _classCallCheck(this, LoggingControl);
    }

    _createClass(LoggingControl, null, [{
        key: 'getConfig',
        value: function getConfig() {
            return {
                globalTag: _logger2.default.GLOBAL_TAG,
                forceGlobalTag: _logger2.default.FORCE_GLOBAL_TAG,
                enableVerbose: _logger2.default.ENABLE_VERBOSE,
                enableDebug: _logger2.default.ENABLE_DEBUG,
                enableInfo: _logger2.default.ENABLE_INFO,
                enableWarn: _logger2.default.ENABLE_WARN,
                enableError: _logger2.default.ENABLE_ERROR,
                enableCallback: _logger2.default.ENABLE_CALLBACK
            };
        }
    }, {
        key: 'applyConfig',
        value: function applyConfig(config) {
            _logger2.default.GLOBAL_TAG = config.globalTag;
            _logger2.default.FORCE_GLOBAL_TAG = config.forceGlobalTag;
            _logger2.default.ENABLE_VERBOSE = config.enableVerbose;
            _logger2.default.ENABLE_DEBUG = config.enableDebug;
            _logger2.default.ENABLE_INFO = config.enableInfo;
            _logger2.default.ENABLE_WARN = config.enableWarn;
            _logger2.default.ENABLE_ERROR = config.enableError;
            _logger2.default.ENABLE_CALLBACK = config.enableCallback;
        }
    }, {
        key: '_notifyChange',
        value: function _notifyChange() {
            var emitter = LoggingControl.emitter;

            if (emitter.listenerCount('change') > 0) {
                var config = LoggingControl.getConfig();
                emitter.emit('change', config);
            }
        }
    }, {
        key: 'registerListener',
        value: function registerListener(listener) {
            LoggingControl.emitter.addListener('change', listener);
        }
    }, {
        key: 'removeListener',
        value: function removeListener(listener) {
            LoggingControl.emitter.removeListener('change', listener);
        }
    }, {
        key: 'addLogListener',
        value: function addLogListener(listener) {
            _logger2.default.emitter.addListener('log', listener);
            if (_logger2.default.emitter.listenerCount('log') > 0) {
                _logger2.default.ENABLE_CALLBACK = true;
                LoggingControl._notifyChange();
            }
        }
    }, {
        key: 'removeLogListener',
        value: function removeLogListener(listener) {
            _logger2.default.emitter.removeListener('log', listener);
            if (_logger2.default.emitter.listenerCount('log') === 0) {
                _logger2.default.ENABLE_CALLBACK = false;
                LoggingControl._notifyChange();
            }
        }
    }, {
        key: 'forceGlobalTag',
        get: function get() {
            return _logger2.default.FORCE_GLOBAL_TAG;
        },
        set: function set(enable) {
            _logger2.default.FORCE_GLOBAL_TAG = enable;
            LoggingControl._notifyChange();
        }
    }, {
        key: 'globalTag',
        get: function get() {
            return _logger2.default.GLOBAL_TAG;
        },
        set: function set(tag) {
            _logger2.default.GLOBAL_TAG = tag;
            LoggingControl._notifyChange();
        }
    }, {
        key: 'enableAll',
        get: function get() {
            return _logger2.default.ENABLE_VERBOSE && _logger2.default.ENABLE_DEBUG && _logger2.default.ENABLE_INFO && _logger2.default.ENABLE_WARN && _logger2.default.ENABLE_ERROR;
        },
        set: function set(enable) {
            _logger2.default.ENABLE_VERBOSE = enable;
            _logger2.default.ENABLE_DEBUG = enable;
            _logger2.default.ENABLE_INFO = enable;
            _logger2.default.ENABLE_WARN = enable;
            _logger2.default.ENABLE_ERROR = enable;
            LoggingControl._notifyChange();
        }
    }, {
        key: 'enableDebug',
        get: function get() {
            return _logger2.default.ENABLE_DEBUG;
        },
        set: function set(enable) {
            _logger2.default.ENABLE_DEBUG = enable;
            LoggingControl._notifyChange();
        }
    }, {
        key: 'enableVerbose',
        get: function get() {
            return _logger2.default.ENABLE_VERBOSE;
        },
        set: function set(enable) {
            _logger2.default.ENABLE_VERBOSE = enable;
            LoggingControl._notifyChange();
        }
    }, {
        key: 'enableInfo',
        get: function get() {
            return _logger2.default.ENABLE_INFO;
        },
        set: function set(enable) {
            _logger2.default.ENABLE_INFO = enable;
            LoggingControl._notifyChange();
        }
    }, {
        key: 'enableWarn',
        get: function get() {
            return _logger2.default.ENABLE_WARN;
        },
        set: function set(enable) {
            _logger2.default.ENABLE_WARN = enable;
            LoggingControl._notifyChange();
        }
    }, {
        key: 'enableError',
        get: function get() {
            return _logger2.default.ENABLE_ERROR;
        },
        set: function set(enable) {
            _logger2.default.ENABLE_ERROR = enable;
            LoggingControl._notifyChange();
        }
    }]);

    return LoggingControl;
}();

LoggingControl.emitter = new _events2.default();

exports.default = LoggingControl;

},{"./logger.js":42,"events":3}],44:[function(_dereq_,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/*
 * Copyright (C) 2016 Bilibili. All Rights Reserved.
 *
 * @author zheng qian <xqq@xqq.im>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var Polyfill = function () {
    function Polyfill() {
        _classCallCheck(this, Polyfill);
    }

    _createClass(Polyfill, null, [{
        key: 'install',
        value: function install() {
            // ES6 Object.setPrototypeOf
            Object.setPrototypeOf = Object.setPrototypeOf || function (obj, proto) {
                obj.__proto__ = proto;
                return obj;
            };

            // ES6 Object.assign
            Object.assign = Object.assign || function (target) {
                if (target === undefined || target === null) {
                    throw new TypeError('Cannot convert undefined or null to object');
                }

                var output = Object(target);
                for (var i = 1; i < arguments.length; i++) {
                    var source = arguments[i];
                    if (source !== undefined && source !== null) {
                        for (var key in source) {
                            if (source.hasOwnProperty(key)) {
                                output[key] = source[key];
                            }
                        }
                    }
                }
                return output;
            };

            // ES6 Promise (missing support in IE11)
            if (typeof self.Promise !== 'function') {
                _dereq_('es6-promise').polyfill();
            }
        }
    }]);

    return Polyfill;
}();

Polyfill.install();

exports.default = Polyfill;

},{"es6-promise":2}],45:[function(_dereq_,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
/*
 * Copyright (C) 2016 Bilibili. All Rights Reserved.
 *
 * This file is derived from C++ project libWinTF8 (https://github.com/m13253/libWinTF8)
 * @author zheng qian <xqq@xqq.im>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

function checkContinuation(uint8array, start, checkLength) {
    var array = uint8array;
    if (start + checkLength < array.length) {
        while (checkLength--) {
            if ((array[++start] & 0xC0) !== 0x80) return false;
        }
        return true;
    } else {
        return false;
    }
}

function decodeUTF8(uint8array) {
    var out = [];
    var input = uint8array;
    var i = 0;
    var length = uint8array.length;

    while (i < length) {
        if (input[i] < 0x80) {
            out.push(String.fromCharCode(input[i]));
            ++i;
            continue;
        } else if (input[i] < 0xC0) {
            // fallthrough
        } else if (input[i] < 0xE0) {
            if (checkContinuation(input, i, 1)) {
                var ucs4 = (input[i] & 0x1F) << 6 | input[i + 1] & 0x3F;
                if (ucs4 >= 0x80) {
                    out.push(String.fromCharCode(ucs4 & 0xFFFF));
                    i += 2;
                    continue;
                }
            }
        } else if (input[i] < 0xF0) {
            if (checkContinuation(input, i, 2)) {
                var _ucs = (input[i] & 0xF) << 12 | (input[i + 1] & 0x3F) << 6 | input[i + 2] & 0x3F;
                if (_ucs >= 0x800 && (_ucs & 0xF800) !== 0xD800) {
                    out.push(String.fromCharCode(_ucs & 0xFFFF));
                    i += 3;
                    continue;
                }
            }
        } else if (input[i] < 0xF8) {
            if (checkContinuation(input, i, 3)) {
                var _ucs2 = (input[i] & 0x7) << 18 | (input[i + 1] & 0x3F) << 12 | (input[i + 2] & 0x3F) << 6 | input[i + 3] & 0x3F;
                if (_ucs2 > 0x10000 && _ucs2 < 0x110000) {
                    _ucs2 -= 0x10000;
                    out.push(String.fromCharCode(_ucs2 >>> 10 | 0xD800));
                    out.push(String.fromCharCode(_ucs2 & 0x3FF | 0xDC00));
                    i += 4;
                    continue;
                }
            }
        }
        out.push(String.fromCharCode(0xFFFD));
        ++i;
    }

    return out.join('');
}

exports.default = decodeUTF8;

},{}]},{},[22])(22)
});

//# sourceMappingURL=flv.js.map
