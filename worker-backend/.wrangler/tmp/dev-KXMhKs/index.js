var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined")
    return require.apply(this, arguments);
  throw new Error('Dynamic require of "' + x + '" is not supported');
});
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};

// src/utils/bcrypt.js
var bcrypt = function() {
  "use strict";
  var bcrypt2 = {};
  var randomFallback = null;
  function random(len) {
    if (typeof module !== "undefined" && module && module["exports"])
      try {
        return __require("crypto")["randomBytes"](len);
      } catch (e) {
      }
    try {
      var a;
      (self["crypto"] || self["msCrypto"])["getRandomValues"](a = new Uint32Array(len));
      return Array.prototype.slice.call(a);
    } catch (e) {
    }
    if (!randomFallback)
      throw Error("Neither WebCryptoAPI nor a crypto module is available. Use bcrypt.setRandomFallback to set an alternative");
    return randomFallback(len);
  }
  __name(random, "random");
  var randomAvailable = false;
  try {
    random(1);
    randomAvailable = true;
  } catch (e) {
  }
  randomFallback = null;
  bcrypt2.setRandomFallback = function(random2) {
    randomFallback = random2;
  };
  bcrypt2.genSaltSync = function(rounds, seed_length) {
    rounds = rounds || GENSALT_DEFAULT_LOG2_ROUNDS;
    if (typeof rounds !== "number")
      throw Error("Illegal arguments: " + typeof rounds + ", " + typeof seed_length);
    if (rounds < 4)
      rounds = 4;
    else if (rounds > 31)
      rounds = 31;
    var salt = [];
    salt.push("$2a$");
    if (rounds < 10)
      salt.push("0");
    salt.push(rounds.toString());
    salt.push("$");
    salt.push(base64_encode(random(BCRYPT_SALT_LEN), BCRYPT_SALT_LEN));
    return salt.join("");
  };
  bcrypt2.genSalt = function(rounds, seed_length, callback) {
    if (typeof seed_length === "function")
      callback = seed_length, seed_length = void 0;
    if (typeof rounds === "function")
      callback = rounds, rounds = void 0;
    if (typeof rounds === "undefined")
      rounds = GENSALT_DEFAULT_LOG2_ROUNDS;
    else if (typeof rounds !== "number")
      throw Error("illegal arguments: " + typeof rounds);
    function _async(callback2) {
      nextTick(function() {
        try {
          callback2(null, bcrypt2.genSaltSync(rounds));
        } catch (err) {
          callback2(err);
        }
      });
    }
    __name(_async, "_async");
    if (callback) {
      if (typeof callback !== "function")
        throw Error("Illegal callback: " + typeof callback);
      _async(callback);
    } else
      return new Promise(function(resolve, reject) {
        _async(function(err, res) {
          if (err) {
            reject(err);
            return;
          }
          resolve(res);
        });
      });
  };
  bcrypt2.hashSync = function(s, salt) {
    if (typeof salt === "undefined")
      salt = GENSALT_DEFAULT_LOG2_ROUNDS;
    if (typeof salt === "number")
      salt = bcrypt2.genSaltSync(salt);
    if (typeof s !== "string" || typeof salt !== "string")
      throw Error("Illegal arguments: " + typeof s + ", " + typeof salt);
    return _hash(s, salt);
  };
  bcrypt2.hash = function(s, salt, callback, progressCallback) {
    function _async(callback2) {
      if (typeof s === "string" && typeof salt === "number")
        bcrypt2.genSalt(salt, function(err, salt2) {
          _hash(s, salt2, callback2, progressCallback);
        });
      else if (typeof s === "string" && typeof salt === "string")
        _hash(s, salt, callback2, progressCallback);
      else
        nextTick(callback2.bind(this, Error("Illegal arguments: " + typeof s + ", " + typeof salt)));
    }
    __name(_async, "_async");
    if (callback) {
      if (typeof callback !== "function")
        throw Error("Illegal callback: " + typeof callback);
      _async(callback);
    } else
      return new Promise(function(resolve, reject) {
        _async(function(err, res) {
          if (err) {
            reject(err);
            return;
          }
          resolve(res);
        });
      });
  };
  function safeStringCompare(known, unknown) {
    var right = 0, wrong = 0;
    for (var i = 0, k = known.length; i < k; ++i) {
      if (known.charCodeAt(i) === unknown.charCodeAt(i))
        ++right;
      else
        ++wrong;
    }
    if (right < 0)
      return false;
    return wrong === 0;
  }
  __name(safeStringCompare, "safeStringCompare");
  bcrypt2.compareSync = function(s, hash) {
    if (typeof s !== "string" || typeof hash !== "string")
      throw Error("Illegal arguments: " + typeof s + ", " + typeof hash);
    if (hash.length !== 60)
      return false;
    return safeStringCompare(bcrypt2.hashSync(s, hash.substr(0, hash.length - 31)), hash);
  };
  bcrypt2.compare = function(s, hash, callback, progressCallback) {
    function _async(callback2) {
      if (typeof s !== "string" || typeof hash !== "string") {
        nextTick(callback2.bind(this, Error("Illegal arguments: " + typeof s + ", " + typeof hash)));
        return;
      }
      if (hash.length !== 60) {
        nextTick(callback2.bind(this, null, false));
        return;
      }
      bcrypt2.hash(s, hash.substr(0, 29), function(err, comp) {
        if (err)
          callback2(err);
        else
          callback2(null, safeStringCompare(comp, hash));
      }, progressCallback);
    }
    __name(_async, "_async");
    if (callback) {
      if (typeof callback !== "function")
        throw Error("Illegal callback: " + typeof callback);
      _async(callback);
    } else
      return new Promise(function(resolve, reject) {
        _async(function(err, res) {
          if (err) {
            reject(err);
            return;
          }
          resolve(res);
        });
      });
  };
  bcrypt2.getRounds = function(hash) {
    if (typeof hash !== "string")
      throw Error("Illegal arguments: " + typeof hash);
    return parseInt(hash.split("$")[2], 10);
  };
  bcrypt2.getSalt = function(hash) {
    if (typeof hash !== "string")
      throw Error("Illegal arguments: " + typeof hash);
    if (hash.length !== 60)
      throw Error("Illegal hash length: " + hash.length + " != 60");
    return hash.substring(0, 29);
  };
  var nextTick = typeof process !== "undefined" && process && typeof process.nextTick === "function" ? typeof setImmediate === "function" ? setImmediate : process.nextTick : setTimeout;
  function stringToBytes(str) {
    var out = [], i = 0;
    utfx.encodeUTF16toUTF8(function() {
      if (i >= str.length)
        return null;
      return str.charCodeAt(i++);
    }, function(b) {
      out.push(b);
    });
    return out;
  }
  __name(stringToBytes, "stringToBytes");
  var BASE64_CODE = "./ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789".split("");
  var BASE64_INDEX = [
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    0,
    1,
    54,
    55,
    56,
    57,
    58,
    59,
    60,
    61,
    62,
    63,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    2,
    3,
    4,
    5,
    6,
    7,
    8,
    9,
    10,
    11,
    12,
    13,
    14,
    15,
    16,
    17,
    18,
    19,
    20,
    21,
    22,
    23,
    24,
    25,
    26,
    27,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    28,
    29,
    30,
    31,
    32,
    33,
    34,
    35,
    36,
    37,
    38,
    39,
    40,
    41,
    42,
    43,
    44,
    45,
    46,
    47,
    48,
    49,
    50,
    51,
    52,
    53,
    -1,
    -1,
    -1,
    -1,
    -1
  ];
  var stringFromCharCode = String.fromCharCode;
  function base64_encode(b, len) {
    var off = 0, rs = [], c1, c2;
    if (len <= 0 || len > b.length)
      throw Error("Illegal len: " + len);
    while (off < len) {
      c1 = b[off++] & 255;
      rs.push(BASE64_CODE[c1 >> 2 & 63]);
      c1 = (c1 & 3) << 4;
      if (off >= len) {
        rs.push(BASE64_CODE[c1 & 63]);
        break;
      }
      c2 = b[off++] & 255;
      c1 |= c2 >> 4 & 15;
      rs.push(BASE64_CODE[c1 & 63]);
      c1 = (c2 & 15) << 2;
      if (off >= len) {
        rs.push(BASE64_CODE[c1 & 63]);
        break;
      }
      c2 = b[off++] & 255;
      c1 |= c2 >> 6 & 3;
      rs.push(BASE64_CODE[c1 & 63]);
      rs.push(BASE64_CODE[c2 & 63]);
    }
    return rs.join("");
  }
  __name(base64_encode, "base64_encode");
  function base64_decode(s, len) {
    var off = 0, slen = s.length, olen = 0, rs = [], c1, c2, c3, c4, o, code;
    if (len <= 0)
      throw Error("Illegal len: " + len);
    while (off < slen - 1 && olen < len) {
      code = s.charCodeAt(off++);
      c1 = code < BASE64_INDEX.length ? BASE64_INDEX[code] : -1;
      code = s.charCodeAt(off++);
      c2 = code < BASE64_INDEX.length ? BASE64_INDEX[code] : -1;
      if (c1 == -1 || c2 == -1)
        break;
      o = c1 << 2 >>> 0;
      o |= (c2 & 48) >> 4;
      rs.push(stringFromCharCode(o));
      if (++olen >= len || off >= slen)
        break;
      code = s.charCodeAt(off++);
      c3 = code < BASE64_INDEX.length ? BASE64_INDEX[code] : -1;
      if (c3 == -1)
        break;
      o = (c2 & 15) << 4 >>> 0;
      o |= (c3 & 60) >> 2;
      rs.push(stringFromCharCode(o));
      if (++olen >= len || off >= slen)
        break;
      code = s.charCodeAt(off++);
      c4 = code < BASE64_INDEX.length ? BASE64_INDEX[code] : -1;
      o = (c3 & 3) << 6 >>> 0;
      o |= c4;
      rs.push(stringFromCharCode(o));
      ++olen;
    }
    var res = [];
    for (off = 0; off < olen; off++)
      res.push(rs[off].charCodeAt(0));
    return res;
  }
  __name(base64_decode, "base64_decode");
  var utfx = function() {
    "use strict";
    var utfx2 = {};
    utfx2.MAX_CODEPOINT = 1114111;
    utfx2.encodeUTF8 = function(src, dst) {
      var cp = null;
      if (typeof src === "number")
        cp = src, src = /* @__PURE__ */ __name(function() {
          return null;
        }, "src");
      while (cp !== null || (cp = src()) !== null) {
        if (cp < 128)
          dst(cp & 127);
        else if (cp < 2048)
          dst(cp >> 6 & 31 | 192), dst(cp & 63 | 128);
        else if (cp < 65536)
          dst(cp >> 12 & 15 | 224), dst(cp >> 6 & 63 | 128), dst(cp & 63 | 128);
        else
          dst(cp >> 18 & 7 | 240), dst(cp >> 12 & 63 | 128), dst(cp >> 6 & 63 | 128), dst(cp & 63 | 128);
        cp = null;
      }
    };
    utfx2.decodeUTF8 = function(src, dst) {
      var a, b, c, d, fail = /* @__PURE__ */ __name(function(b2) {
        b2 = b2.slice(0, b2.indexOf(null));
        var err = Error(b2.toString());
        err.name = "TruncatedError";
        err["bytes"] = b2;
        throw err;
      }, "fail");
      while ((a = src()) !== null) {
        if ((a & 128) === 0)
          dst(a);
        else if ((a & 224) === 192)
          (b = src()) === null && fail([a, b]), dst((a & 31) << 6 | b & 63);
        else if ((a & 240) === 224)
          ((b = src()) === null || (c = src()) === null) && fail([a, b, c]), dst((a & 15) << 12 | (b & 63) << 6 | c & 63);
        else if ((a & 248) === 240)
          ((b = src()) === null || (c = src()) === null || (d = src()) === null) && fail([a, b, c, d]), dst((a & 7) << 18 | (b & 63) << 12 | (c & 63) << 6 | d & 63);
        else
          throw RangeError("Illegal starting byte: " + a);
      }
    };
    utfx2.UTF16toUTF8 = function(src, dst) {
      var c1, c2 = null;
      while (true) {
        if ((c1 = c2 !== null ? c2 : src()) === null)
          break;
        if (c1 >= 55296 && c1 <= 57343) {
          if ((c2 = src()) !== null) {
            if (c2 >= 56320 && c2 <= 57343) {
              dst((c1 - 55296) * 1024 + c2 - 56320 + 65536);
              c2 = null;
              continue;
            }
          }
        }
        dst(c1);
      }
      if (c2 !== null)
        dst(c2);
    };
    utfx2.UTF8toUTF16 = function(src, dst) {
      var cp = null;
      if (typeof src === "number")
        cp = src, src = /* @__PURE__ */ __name(function() {
          return null;
        }, "src");
      while (cp !== null || (cp = src()) !== null) {
        if (cp <= 65535)
          dst(cp);
        else
          cp -= 65536, dst((cp >> 10) + 55296), dst(cp % 1024 + 56320);
        cp = null;
      }
    };
    utfx2.encodeUTF16toUTF8 = function(src, dst) {
      utfx2.UTF16toUTF8(src, function(cp) {
        utfx2.encodeUTF8(cp, dst);
      });
    };
    utfx2.decodeUTF8toUTF16 = function(src, dst) {
      utfx2.decodeUTF8(src, function(cp) {
        utfx2.UTF8toUTF16(cp, dst);
      });
    };
    utfx2.calculateCodePoint = function(cp) {
      return cp < 128 ? 1 : cp < 2048 ? 2 : cp < 65536 ? 3 : 4;
    };
    utfx2.calculateUTF8 = function(src) {
      var cp, l = 0;
      while ((cp = src()) !== null)
        l += utfx2.calculateCodePoint(cp);
      return l;
    };
    utfx2.calculateUTF16asUTF8 = function(src) {
      var n = 0, l = 0;
      utfx2.UTF16toUTF8(src, function(cp) {
        ++n;
        l += utfx2.calculateCodePoint(cp);
      });
      return [n, l];
    };
    return utfx2;
  }();
  Date.now = Date.now || function() {
    return +/* @__PURE__ */ new Date();
  };
  var BCRYPT_SALT_LEN = 16;
  var GENSALT_DEFAULT_LOG2_ROUNDS = 10;
  var BLOWFISH_NUM_ROUNDS = 16;
  var MAX_EXECUTION_TIME = 100;
  var P_ORIG = [
    608135816,
    2242054355,
    320440878,
    57701188,
    2752067618,
    698298832,
    137296536,
    3964562569,
    1160258022,
    953160567,
    3193202383,
    887688300,
    3232508343,
    3380367581,
    1065670069,
    3041331479,
    2450970073,
    2306472731
  ];
  var S_ORIG = [
    3509652390,
    2564797868,
    805139163,
    3491422135,
    3101798381,
    1780907670,
    3128725573,
    4046225305,
    614570311,
    3012652279,
    134345442,
    2240740374,
    1667834072,
    1901547113,
    2757295779,
    4103290238,
    227898511,
    1921955416,
    1904987480,
    2182433518,
    2069144605,
    3260701109,
    2620446009,
    720527379,
    3318853667,
    677414384,
    3393288472,
    3101374703,
    2390351024,
    1614419982,
    1822297739,
    2954791486,
    3608508353,
    3174124327,
    2024746970,
    1432378464,
    3864339955,
    2857741204,
    1464375394,
    1676153920,
    1439316330,
    715854006,
    3033291828,
    289532110,
    2706671279,
    2087905683,
    3018724369,
    1668267050,
    732546397,
    1947742710,
    3462151702,
    2609353502,
    2950085171,
    1814351708,
    2050118529,
    680887927,
    999245976,
    1800124847,
    3300911131,
    1713906067,
    1641548236,
    4213287313,
    1216130144,
    1575780402,
    4018429277,
    3917837745,
    3693486850,
    3949271944,
    596196993,
    3549867205,
    258830323,
    2213823033,
    772490370,
    2760122372,
    1774776394,
    2652871518,
    566650946,
    4142492826,
    1728879713,
    2882767088,
    1783734482,
    3629395816,
    2517608232,
    2874225571,
    1861159788,
    326777828,
    3124490320,
    2130389656,
    2716951837,
    967770486,
    1724537150,
    2185432712,
    2364442137,
    1164943284,
    2105845187,
    998989502,
    3765401048,
    2244026483,
    1075463327,
    1455516326,
    1322494562,
    910128902,
    469688178,
    1117454909,
    936433444,
    3490320968,
    3675253459,
    1240580251,
    122909385,
    2157517691,
    634681816,
    4142456567,
    3825094682,
    3061402683,
    2540495037,
    79693498,
    3249098678,
    1084186820,
    1583128258,
    426386531,
    1761308591,
    1047286709,
    322548459,
    995290223,
    1845252383,
    2603652396,
    3431023940,
    2942221577,
    3202600964,
    3727903485,
    1712269319,
    422464435,
    3234572375,
    1170764815,
    3523960633,
    3117677531,
    1434042557,
    442511882,
    3600875718,
    1076654713,
    1738483198,
    4213154764,
    2393238008,
    3677496056,
    1014306527,
    4251020053,
    793779912,
    2902807211,
    842905082,
    4246964064,
    1395751752,
    1040244610,
    2656851899,
    3396308128,
    445077038,
    3742853595,
    3577915638,
    679411651,
    2892444358,
    2354009459,
    1767581616,
    3150600392,
    3791627101,
    3102740896,
    284835224,
    4246832056,
    1258075500,
    768725851,
    2589189241,
    3069724005,
    3532540348,
    1274779536,
    3789419226,
    2764799539,
    1660621633,
    3471099624,
    4011903706,
    913787905,
    3497959166,
    737222580,
    2514213453,
    2928710040,
    3937242737,
    1804850592,
    3499020752,
    2949064160,
    2386320175,
    2390070455,
    2415321851,
    4061277028,
    2290661394,
    2416832540,
    1336762016,
    1754252060,
    3520065937,
    3014181293,
    791618072,
    3188594551,
    3933548030,
    2332172193,
    3852520463,
    3043980520,
    413987798,
    3465142937,
    3030929376,
    4245938359,
    2093235073,
    3534596313,
    375366246,
    2157278981,
    2479649556,
    555357303,
    3870105701,
    2008414854,
    3344188149,
    4221384143,
    3956125452,
    2067696032,
    3594591187,
    2921233993,
    2428461,
    544322398,
    577241275,
    1471733935,
    610547355,
    4027169054,
    1432588573,
    1507829418,
    2025931657,
    3646575487,
    545086370,
    48609733,
    2200306550,
    1653985193,
    298326376,
    1316178497,
    3007786442,
    2064951626,
    458293330,
    2589141269,
    3591329599,
    3164325604,
    727753846,
    2179363840,
    146436021,
    1461446943,
    4069977195,
    705550613,
    3059967265,
    3887724982,
    4281599278,
    3313849956,
    1404054877,
    2845806497,
    146425753,
    1854211946,
    1266315497,
    3048417604,
    3681880366,
    3289982499,
    290971e4,
    1235738493,
    2632868024,
    2414719590,
    3970600049,
    1771706367,
    1449415276,
    3266420449,
    422970021,
    1963543593,
    2690192192,
    3826793022,
    1062508698,
    1531092325,
    1804592342,
    2583117782,
    2714934279,
    4024971509,
    1294809318,
    4028980673,
    1289560198,
    2221992742,
    1669523910,
    35572830,
    157838143,
    1052438473,
    1016535060,
    1802137761,
    1753167236,
    1386275462,
    3080475397,
    2857371447,
    1040679964,
    2145300060,
    2390574316,
    1461121720,
    2956646967,
    4031777805,
    4028374788,
    33600511,
    2920084762,
    1018524850,
    629373528,
    3691585981,
    3515945977,
    2091462646,
    2486323059,
    586499841,
    988145025,
    935516892,
    3367335476,
    2599673255,
    2839830854,
    265290510,
    3972581182,
    2759138881,
    3795373465,
    1005194799,
    847297441,
    406762289,
    1314163512,
    1332590856,
    1866599683,
    4127851711,
    750260880,
    613907577,
    1450815602,
    3165620655,
    3734664991,
    3650291728,
    3012275730,
    3704569646,
    1427272223,
    778793252,
    1343938022,
    2676280711,
    2052605720,
    1946737175,
    3164576444,
    3914038668,
    3967478842,
    3682934266,
    1661551462,
    3294938066,
    4011595847,
    840292616,
    3712170807,
    616741398,
    312560963,
    711312465,
    1351876610,
    322626781,
    1910503582,
    271666773,
    2175563734,
    1594956187,
    70604529,
    3617834859,
    1007753275,
    1495573769,
    4069517037,
    2549218298,
    2663038764,
    504708206,
    2263041392,
    3941167025,
    2249088522,
    1514023603,
    1998579484,
    1312622330,
    694541497,
    2582060303,
    2151582166,
    1382467621,
    776784248,
    2618340202,
    3323268794,
    2497899128,
    2784771155,
    503983604,
    4076293799,
    907881277,
    423175695,
    432175456,
    1378068232,
    4145222326,
    3954048622,
    3938656102,
    3820766613,
    2793130115,
    2977904593,
    26017576,
    3274890735,
    3194772133,
    1700274565,
    1756076034,
    4006520079,
    3677328699,
    720338349,
    1533947780,
    354530856,
    688349552,
    3973924725,
    1637815568,
    332179504,
    3949051286,
    53804574,
    2852348879,
    3044236432,
    1282449977,
    3583942155,
    3416972820,
    4006381244,
    1617046695,
    2628476075,
    3002303598,
    1686838959,
    431878346,
    2686675385,
    1700445008,
    1080580658,
    1009431731,
    832498133,
    3223435511,
    2605976345,
    2271191193,
    2516031870,
    1648197032,
    4164389018,
    2548247927,
    300782431,
    375919233,
    238389289,
    3353747414,
    2531188641,
    2019080857,
    1475708069,
    455242339,
    2609103871,
    448939670,
    3451063019,
    1395535956,
    2413381860,
    1841049896,
    1491858159,
    885456874,
    4264095073,
    4001119347,
    1565136089,
    3898914787,
    1108368660,
    540939232,
    1173283510,
    2745871338,
    3681308437,
    4207628240,
    3343053890,
    4016749493,
    1699691293,
    1103962373,
    3625875870,
    2256883143,
    3830138730,
    1031889488,
    3479347698,
    1535977030,
    4236805024,
    3251091107,
    2132092099,
    1774941330,
    1199868427,
    1452454533,
    157007616,
    2904115357,
    342012276,
    595725824,
    1480756522,
    206960106,
    497939518,
    591360097,
    863170706,
    2375253569,
    3596610801,
    1814182875,
    2094937945,
    3421402208,
    1082520231,
    3463918190,
    2785509508,
    435703966,
    3908032597,
    1641649973,
    2842273706,
    3305899714,
    1510255612,
    2148256476,
    2655287854,
    3276092548,
    4258621189,
    236887753,
    3681803219,
    274041037,
    1734335097,
    3815195456,
    3317970021,
    1899903192,
    1026095262,
    4050517792,
    356393447,
    2410691914,
    3873677099,
    3682840055,
    3913112168,
    2491498743,
    4132185628,
    2489919796,
    1091903735,
    1979897079,
    3170134830,
    3567386728,
    3557303409,
    857797738,
    1136121015,
    1342202287,
    507115054,
    2535736646,
    337727348,
    3213592640,
    1301675037,
    2528481711,
    1895095763,
    1721773893,
    3216771564,
    62756741,
    2142006736,
    835421444,
    2531993523,
    1442658625,
    3659876326,
    2882144922,
    676362277,
    1392781812,
    170690266,
    3921047035,
    1759253602,
    3611846912,
    1745797284,
    664899054,
    1329594018,
    3901205900,
    3045908486,
    2062866102,
    2865634940,
    3543621612,
    3464012697,
    1080764994,
    553557557,
    3656615353,
    3996768171,
    991055499,
    499776247,
    1265440854,
    648242737,
    3940784050,
    980351604,
    3713745714,
    1749149687,
    3396870395,
    4211799374,
    3640570775,
    1161844396,
    3125318951,
    1431517754,
    545492359,
    4268468663,
    3499529547,
    1437099964,
    2702547544,
    3433638243,
    2581715763,
    2787789398,
    1060185593,
    1593081372,
    2418618748,
    4260947970,
    69676912,
    2159744348,
    86519011,
    2512459080,
    3838209314,
    1220612927,
    3339683548,
    133810670,
    1090789135,
    1078426020,
    1569222167,
    845107691,
    3583754449,
    4072456591,
    1091646820,
    628848692,
    1613405280,
    3757631651,
    526609435,
    236106946,
    48312990,
    2942717905,
    3402727701,
    1797494240,
    859738849,
    992217954,
    4005476642,
    2243076622,
    3870952857,
    3732016268,
    765654824,
    3490871365,
    2511836413,
    1685915746,
    3888969200,
    1414112111,
    2273134842,
    3281911079,
    4080962846,
    172450625,
    2569994100,
    980381355,
    4109958455,
    2819808352,
    2716589560,
    2568741196,
    3681446669,
    3329971472,
    1835478071,
    660984891,
    3704678404,
    4045999559,
    3422617507,
    3040415634,
    1762651403,
    1719377915,
    3470491036,
    2693910283,
    3642056355,
    3138596744,
    1364962596,
    2073328063,
    1983633131,
    926494387,
    3423689081,
    2150032023,
    4096667949,
    1749200295,
    3328846651,
    309677260,
    2016342300,
    1779581495,
    3079819751,
    111262694,
    1274766160,
    443224088,
    298511866,
    1025883608,
    3806446537,
    1145181785,
    168956806,
    3641502830,
    3584813610,
    1689216846,
    3666258015,
    3200248200,
    1692713982,
    2646376535,
    4042768518,
    1618508792,
    1610833997,
    3523052358,
    4130873264,
    2001055236,
    3610705100,
    2202168115,
    4028541809,
    2961195399,
    1006657119,
    2006996926,
    3186142756,
    1430667929,
    3210227297,
    1314452623,
    4074634658,
    4101304120,
    2273951170,
    1399257539,
    3367210612,
    3027628629,
    1190975929,
    2062231137,
    2333990788,
    2221543033,
    2438960610,
    1181637006,
    548689776,
    2362791313,
    3372408396,
    3104550113,
    3145860560,
    296247880,
    1970579870,
    3078560182,
    3769228297,
    1714227617,
    3291629107,
    3898220290,
    166772364,
    1251581989,
    493813264,
    448347421,
    195405023,
    2709975567,
    677966185,
    3703036547,
    1463355134,
    2715995803,
    1338867538,
    1343315457,
    2802222074,
    2684532164,
    233230375,
    2599980071,
    2000651841,
    3277868038,
    1638401717,
    4028070440,
    3237316320,
    6314154,
    819756386,
    300326615,
    590932579,
    1405279636,
    3267499572,
    3150704214,
    2428286686,
    3959192993,
    3461946742,
    1862657033,
    1266418056,
    963775037,
    2089974820,
    2263052895,
    1917689273,
    448879540,
    3550394620,
    3981727096,
    150775221,
    3627908307,
    1303187396,
    508620638,
    2975983352,
    2726630617,
    1817252668,
    1876281319,
    1457606340,
    908771278,
    3720792119,
    3617206836,
    2455994898,
    1729034894,
    1080033504,
    976866871,
    3556439503,
    2881648439,
    1522871579,
    1555064734,
    1336096578,
    3548522304,
    2579274686,
    3574697629,
    3205460757,
    3593280638,
    3338716283,
    3079412587,
    564236357,
    2993598910,
    1781952180,
    1464380207,
    3163844217,
    3332601554,
    1699332808,
    1393555694,
    1183702653,
    3581086237,
    1288719814,
    691649499,
    2847557200,
    2895455976,
    3193889540,
    2717570544,
    1781354906,
    1676643554,
    2592534050,
    3230253752,
    1126444790,
    2770207658,
    2633158820,
    2210423226,
    2615765581,
    2414155088,
    3127139286,
    673620729,
    2805611233,
    1269405062,
    4015350505,
    3341807571,
    4149409754,
    1057255273,
    2012875353,
    2162469141,
    2276492801,
    2601117357,
    993977747,
    3918593370,
    2654263191,
    753973209,
    36408145,
    2530585658,
    25011837,
    3520020182,
    2088578344,
    530523599,
    2918365339,
    1524020338,
    1518925132,
    3760827505,
    3759777254,
    1202760957,
    3985898139,
    3906192525,
    674977740,
    4174734889,
    2031300136,
    2019492241,
    3983892565,
    4153806404,
    3822280332,
    352677332,
    2297720250,
    60907813,
    90501309,
    3286998549,
    1016092578,
    2535922412,
    2839152426,
    457141659,
    509813237,
    4120667899,
    652014361,
    1966332200,
    2975202805,
    55981186,
    2327461051,
    676427537,
    3255491064,
    2882294119,
    3433927263,
    1307055953,
    942726286,
    933058658,
    2468411793,
    3933900994,
    4215176142,
    1361170020,
    2001714738,
    2830558078,
    3274259782,
    1222529897,
    1679025792,
    2729314320,
    3714953764,
    1770335741,
    151462246,
    3013232138,
    1682292957,
    1483529935,
    471910574,
    1539241949,
    458788160,
    3436315007,
    1807016891,
    3718408830,
    978976581,
    1043663428,
    3165965781,
    1927990952,
    4200891579,
    2372276910,
    3208408903,
    3533431907,
    1412390302,
    2931980059,
    4132332400,
    1947078029,
    3881505623,
    4168226417,
    2941484381,
    1077988104,
    1320477388,
    886195818,
    18198404,
    3786409e3,
    2509781533,
    112762804,
    3463356488,
    1866414978,
    891333506,
    18488651,
    661792760,
    1628790961,
    3885187036,
    3141171499,
    876946877,
    2693282273,
    1372485963,
    791857591,
    2686433993,
    3759982718,
    3167212022,
    3472953795,
    2716379847,
    445679433,
    3561995674,
    3504004811,
    3574258232,
    54117162,
    3331405415,
    2381918588,
    3769707343,
    4154350007,
    1140177722,
    4074052095,
    668550556,
    3214352940,
    367459370,
    261225585,
    2610173221,
    4209349473,
    3468074219,
    3265815641,
    314222801,
    3066103646,
    3808782860,
    282218597,
    3406013506,
    3773591054,
    379116347,
    1285071038,
    846784868,
    2669647154,
    3771962079,
    3550491691,
    2305946142,
    453669953,
    1268987020,
    3317592352,
    3279303384,
    3744833421,
    2610507566,
    3859509063,
    266596637,
    3847019092,
    517658769,
    3462560207,
    3443424879,
    370717030,
    4247526661,
    2224018117,
    4143653529,
    4112773975,
    2788324899,
    2477274417,
    1456262402,
    2901442914,
    1517677493,
    1846949527,
    2295493580,
    3734397586,
    2176403920,
    1280348187,
    1908823572,
    3871786941,
    846861322,
    1172426758,
    3287448474,
    3383383037,
    1655181056,
    3139813346,
    901632758,
    1897031941,
    2986607138,
    3066810236,
    3447102507,
    1393639104,
    373351379,
    950779232,
    625454576,
    3124240540,
    4148612726,
    2007998917,
    544563296,
    2244738638,
    2330496472,
    2058025392,
    1291430526,
    424198748,
    50039436,
    29584100,
    3605783033,
    2429876329,
    2791104160,
    1057563949,
    3255363231,
    3075367218,
    3463963227,
    1469046755,
    985887462
  ];
  var C_ORIG = [
    1332899944,
    1700884034,
    1701343084,
    1684370003,
    1668446532,
    1869963892
  ];
  function _encipher(lr, off, P, S) {
    var n, l = lr[off], r = lr[off + 1];
    l ^= P[0];
    n = S[l >>> 24];
    n += S[256 | l >> 16 & 255];
    n ^= S[512 | l >> 8 & 255];
    n += S[768 | l & 255];
    r ^= n ^ P[1];
    n = S[r >>> 24];
    n += S[256 | r >> 16 & 255];
    n ^= S[512 | r >> 8 & 255];
    n += S[768 | r & 255];
    l ^= n ^ P[2];
    n = S[l >>> 24];
    n += S[256 | l >> 16 & 255];
    n ^= S[512 | l >> 8 & 255];
    n += S[768 | l & 255];
    r ^= n ^ P[3];
    n = S[r >>> 24];
    n += S[256 | r >> 16 & 255];
    n ^= S[512 | r >> 8 & 255];
    n += S[768 | r & 255];
    l ^= n ^ P[4];
    n = S[l >>> 24];
    n += S[256 | l >> 16 & 255];
    n ^= S[512 | l >> 8 & 255];
    n += S[768 | l & 255];
    r ^= n ^ P[5];
    n = S[r >>> 24];
    n += S[256 | r >> 16 & 255];
    n ^= S[512 | r >> 8 & 255];
    n += S[768 | r & 255];
    l ^= n ^ P[6];
    n = S[l >>> 24];
    n += S[256 | l >> 16 & 255];
    n ^= S[512 | l >> 8 & 255];
    n += S[768 | l & 255];
    r ^= n ^ P[7];
    n = S[r >>> 24];
    n += S[256 | r >> 16 & 255];
    n ^= S[512 | r >> 8 & 255];
    n += S[768 | r & 255];
    l ^= n ^ P[8];
    n = S[l >>> 24];
    n += S[256 | l >> 16 & 255];
    n ^= S[512 | l >> 8 & 255];
    n += S[768 | l & 255];
    r ^= n ^ P[9];
    n = S[r >>> 24];
    n += S[256 | r >> 16 & 255];
    n ^= S[512 | r >> 8 & 255];
    n += S[768 | r & 255];
    l ^= n ^ P[10];
    n = S[l >>> 24];
    n += S[256 | l >> 16 & 255];
    n ^= S[512 | l >> 8 & 255];
    n += S[768 | l & 255];
    r ^= n ^ P[11];
    n = S[r >>> 24];
    n += S[256 | r >> 16 & 255];
    n ^= S[512 | r >> 8 & 255];
    n += S[768 | r & 255];
    l ^= n ^ P[12];
    n = S[l >>> 24];
    n += S[256 | l >> 16 & 255];
    n ^= S[512 | l >> 8 & 255];
    n += S[768 | l & 255];
    r ^= n ^ P[13];
    n = S[r >>> 24];
    n += S[256 | r >> 16 & 255];
    n ^= S[512 | r >> 8 & 255];
    n += S[768 | r & 255];
    l ^= n ^ P[14];
    n = S[l >>> 24];
    n += S[256 | l >> 16 & 255];
    n ^= S[512 | l >> 8 & 255];
    n += S[768 | l & 255];
    r ^= n ^ P[15];
    n = S[r >>> 24];
    n += S[256 | r >> 16 & 255];
    n ^= S[512 | r >> 8 & 255];
    n += S[768 | r & 255];
    l ^= n ^ P[16];
    lr[off] = r ^ P[BLOWFISH_NUM_ROUNDS + 1];
    lr[off + 1] = l;
    return lr;
  }
  __name(_encipher, "_encipher");
  function _streamtoword(data, offp) {
    for (var i = 0, word = 0; i < 4; ++i)
      word = word << 8 | data[offp] & 255, offp = (offp + 1) % data.length;
    return { key: word, offp };
  }
  __name(_streamtoword, "_streamtoword");
  function _key(key, P, S) {
    var offset = 0, lr = [0, 0], plen = P.length, slen = S.length, sw;
    for (var i = 0; i < plen; i++)
      sw = _streamtoword(key, offset), offset = sw.offp, P[i] = P[i] ^ sw.key;
    for (i = 0; i < plen; i += 2)
      lr = _encipher(lr, 0, P, S), P[i] = lr[0], P[i + 1] = lr[1];
    for (i = 0; i < slen; i += 2)
      lr = _encipher(lr, 0, P, S), S[i] = lr[0], S[i + 1] = lr[1];
  }
  __name(_key, "_key");
  function _ekskey(data, key, P, S) {
    var offp = 0, lr = [0, 0], plen = P.length, slen = S.length, sw;
    for (var i = 0; i < plen; i++)
      sw = _streamtoword(key, offp), offp = sw.offp, P[i] = P[i] ^ sw.key;
    offp = 0;
    for (i = 0; i < plen; i += 2)
      sw = _streamtoword(data, offp), offp = sw.offp, lr[0] ^= sw.key, sw = _streamtoword(data, offp), offp = sw.offp, lr[1] ^= sw.key, lr = _encipher(lr, 0, P, S), P[i] = lr[0], P[i + 1] = lr[1];
    for (i = 0; i < slen; i += 2)
      sw = _streamtoword(data, offp), offp = sw.offp, lr[0] ^= sw.key, sw = _streamtoword(data, offp), offp = sw.offp, lr[1] ^= sw.key, lr = _encipher(lr, 0, P, S), S[i] = lr[0], S[i + 1] = lr[1];
  }
  __name(_ekskey, "_ekskey");
  function _crypt(b, salt, rounds, callback, progressCallback) {
    var cdata = C_ORIG.slice(), clen = cdata.length, err;
    if (rounds < 4 || rounds > 31) {
      err = Error("Illegal number of rounds (4-31): " + rounds);
      if (callback) {
        nextTick(callback.bind(this, err));
        return;
      } else
        throw err;
    }
    if (salt.length !== BCRYPT_SALT_LEN) {
      err = Error("Illegal salt length: " + salt.length + " != " + BCRYPT_SALT_LEN);
      if (callback) {
        nextTick(callback.bind(this, err));
        return;
      } else
        throw err;
    }
    rounds = 1 << rounds >>> 0;
    var P, S, i = 0, j;
    if (Int32Array) {
      P = new Int32Array(P_ORIG);
      S = new Int32Array(S_ORIG);
    } else {
      P = P_ORIG.slice();
      S = S_ORIG.slice();
    }
    _ekskey(salt, b, P, S);
    function next() {
      if (progressCallback)
        progressCallback(i / rounds);
      if (i < rounds) {
        var start = Date.now();
        for (; i < rounds; ) {
          i = i + 1;
          _key(b, P, S);
          _key(salt, P, S);
          if (Date.now() - start > MAX_EXECUTION_TIME)
            break;
        }
      } else {
        for (i = 0; i < 64; i++)
          for (j = 0; j < clen >> 1; j++)
            _encipher(cdata, j << 1, P, S);
        var ret = [];
        for (i = 0; i < clen; i++)
          ret.push((cdata[i] >> 24 & 255) >>> 0), ret.push((cdata[i] >> 16 & 255) >>> 0), ret.push((cdata[i] >> 8 & 255) >>> 0), ret.push((cdata[i] & 255) >>> 0);
        if (callback) {
          callback(null, ret);
          return;
        } else
          return ret;
      }
      if (callback)
        nextTick(next);
    }
    __name(next, "next");
    if (typeof callback !== "undefined") {
      next();
    } else {
      var res;
      while (true)
        if (typeof (res = next()) !== "undefined")
          return res || [];
    }
  }
  __name(_crypt, "_crypt");
  function _hash(s, salt, callback, progressCallback) {
    var err;
    if (typeof s !== "string" || typeof salt !== "string") {
      err = Error("Invalid string / salt: Not a string");
      if (callback) {
        nextTick(callback.bind(this, err));
        return;
      } else
        throw err;
    }
    var minor, offset;
    if (salt.charAt(0) !== "$" || salt.charAt(1) !== "2") {
      err = Error("Invalid salt version: " + salt.substring(0, 2));
      if (callback) {
        nextTick(callback.bind(this, err));
        return;
      } else
        throw err;
    }
    if (salt.charAt(2) === "$")
      minor = String.fromCharCode(0), offset = 3;
    else {
      minor = salt.charAt(2);
      if (minor !== "a" && minor !== "b" && minor !== "y" || salt.charAt(3) !== "$") {
        err = Error("Invalid salt revision: " + salt.substring(2, 4));
        if (callback) {
          nextTick(callback.bind(this, err));
          return;
        } else
          throw err;
      }
      offset = 4;
    }
    if (salt.charAt(offset + 2) > "$") {
      err = Error("Missing salt rounds");
      if (callback) {
        nextTick(callback.bind(this, err));
        return;
      } else
        throw err;
    }
    var r1 = parseInt(salt.substring(offset, offset + 1), 10) * 10, r2 = parseInt(salt.substring(offset + 1, offset + 2), 10), rounds = r1 + r2, real_salt = salt.substring(offset + 3, offset + 25);
    s += minor >= "a" ? "\0" : "";
    var passwordb = stringToBytes(s), saltb = base64_decode(real_salt, BCRYPT_SALT_LEN);
    function finish(bytes) {
      var res = [];
      res.push("$2");
      if (minor >= "a")
        res.push(minor);
      res.push("$");
      if (rounds < 10)
        res.push("0");
      res.push(rounds.toString());
      res.push("$");
      res.push(base64_encode(saltb, saltb.length));
      res.push(base64_encode(bytes, C_ORIG.length * 4 - 1));
      return res.join("");
    }
    __name(finish, "finish");
    if (typeof callback == "undefined")
      return finish(_crypt(passwordb, saltb, rounds));
    else {
      _crypt(passwordb, saltb, rounds, function(err2, bytes) {
        if (err2)
          callback(err2, null);
        else
          callback(null, finish(bytes));
      }, progressCallback);
    }
  }
  __name(_hash, "_hash");
  bcrypt2.encodeBase64 = base64_encode;
  bcrypt2.decodeBase64 = base64_decode;
  return bcrypt2;
}();
var bcrypt_default = bcrypt;

// src/utils/security.js
async function verifyPassword(plainPassword, hashedPassword) {
  try {
    if (hashedPassword.startsWith("pbkdf2_sha256$")) {
      const parts = hashedPassword.split("$");
      if (parts.length !== 4)
        return false;
      const iterations = parseInt(parts[1], 10);
      const salt = parts[2];
      const keyHex = parts[3];
      const encoder = new TextEncoder();
      const baseKey = await crypto.subtle.importKey(
        "raw",
        encoder.encode(plainPassword),
        "PBKDF2",
        false,
        ["deriveBits", "deriveKey"]
      );
      const derivedBits = await crypto.subtle.deriveBits(
        {
          name: "PBKDF2",
          salt: encoder.encode(salt),
          iterations,
          hash: "SHA-256"
        },
        baseKey,
        256
        // 32 bytes
      );
      const newKeyHex = Array.from(new Uint8Array(derivedBits)).map((b) => b.toString(16).padStart(2, "0")).join("");
      return newKeyHex === keyHex;
    }
    return bcrypt_default.compareSync(plainPassword, hashedPassword);
  } catch (e) {
    console.error("verifyPassword error:", e);
  }
  return false;
}
__name(verifyPassword, "verifyPassword");
async function getPasswordHash(password) {
  const encoder = new TextEncoder();
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const salt = Array.from({ length: 16 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  const iterations = 1e5;
  const baseKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits", "deriveKey"]
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: encoder.encode(salt),
      iterations,
      hash: "SHA-256"
    },
    baseKey,
    256
    // 32 bytes
  );
  const keyHex = Array.from(new Uint8Array(derivedBits)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `pbkdf2_sha256$${iterations}$${salt}$${keyHex}`;
}
__name(getPasswordHash, "getPasswordHash");
async function signJwt(payload, secret) {
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const encodedPayload = btoa(JSON.stringify(payload)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const encoder = new TextEncoder();
  const data = encoder.encode(`${encodedHeader}.${encodedPayload}`);
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, data);
  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
}
__name(signJwt, "signJwt");
async function verifyJwt(token, secret) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3)
      return null;
    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const encoder = new TextEncoder();
    const data = encoder.encode(`${encodedHeader}.${encodedPayload}`);
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const signatureBin = atob(encodedSignature.replace(/-/g, "+").replace(/_/g, "/"));
    const signature = new Uint8Array(signatureBin.length);
    for (let i = 0; i < signatureBin.length; i++) {
      signature[i] = signatureBin.charCodeAt(i);
    }
    const valid = await crypto.subtle.verify("HMAC", key, signature, data);
    if (!valid)
      return null;
    const payloadBin = atob(encodedPayload.replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(decodeURIComponent(escape(payloadBin)));
    if (payload.exp && Date.now() / 1e3 > payload.exp) {
      return null;
    }
    return payload;
  } catch (e) {
    return null;
  }
}
__name(verifyJwt, "verifyJwt");

// src/utils/db.js
var MEMORY_CACHE = /* @__PURE__ */ new Map();
var ALL_KNOWN_TABLES = [
  "users",
  "user_roles",
  "password_histories",
  "expenses",
  "expense_master",
  "expense_itineraries",
  "expense_asset_taggings",
  "approvals",
  "approval_hierarchies",
  "hierarchy_requesters",
  "hierarchy_approvers",
  "limit_approval_requests",
  "allowance_master",
  "facility_details",
  "login_logs",
  "otps",
  "kpi_appraisals",
  "rj_penalties",
  "assets_inventory",
  "asset_value_master"
];
function extractTables(sql2) {
  const sqlLower = sql2.toLowerCase();
  const found = [];
  for (const t of ALL_KNOWN_TABLES) {
    const regex = new RegExp(`\\b${t}\\b`);
    if (regex.test(sqlLower)) {
      found.push(t);
    }
  }
  return found;
}
__name(extractTables, "extractTables");
function getCacheKey(sql2, params) {
  return `${sql2}:${JSON.stringify(params)}`;
}
__name(getCacheKey, "getCacheKey");
function getCachedResult(sql2, params) {
  const key = getCacheKey(sql2, params);
  const cached = MEMORY_CACHE.get(key);
  if (cached) {
    if (Date.now() < cached.expiresAt) {
      return cached.data;
    } else {
      MEMORY_CACHE.delete(key);
    }
  }
  return null;
}
__name(getCachedResult, "getCachedResult");
function setCachedResult(sql2, params, data) {
  const sqlLower = sql2.toLowerCase();
  let ttl = 3e4;
  if (sqlLower.includes("allowance_master") || sqlLower.includes("facility_details") || sqlLower.includes("asset_value_master")) {
    ttl = 36e5;
  } else if (sqlLower.includes("login_logs") || sqlLower.includes("notifications") || sqlLower.includes("otps")) {
    ttl = 5e3;
  }
  const key = getCacheKey(sql2, params);
  const tables = extractTables(sql2);
  MEMORY_CACHE.set(key, {
    data,
    tables,
    expiresAt: Date.now() + ttl
  });
}
__name(setCachedResult, "setCachedResult");
function invalidateCacheOnWrite(sql2) {
  const writeTables = extractTables(sql2);
  if (writeTables.length === 0)
    return;
  for (const [key, cached] of MEMORY_CACHE.entries()) {
    const hasOverlap = (cached.tables || []).some((t) => writeTables.includes(t));
    if (hasOverlap) {
      MEMORY_CACHE.delete(key);
    }
  }
}
__name(invalidateCacheOnWrite, "invalidateCacheOnWrite");
async function runWrite(env, sql2, params = []) {
  const sqlLower = sql2.toLowerCase();
  if (sqlLower.includes("notifications")) {
    console.log("Ignored write to deleted notifications table:", sql2.slice(0, 100));
    return { success: true, meta: { last_row_id: 1, changes: 0 } };
  }
  const originalDB = env._originalDB || env.DB;
  invalidateCacheOnWrite(sql2);
  try {
    const localWritePromise = originalDB.prepare(sql2).bind(...params).run();
    const primaryAccount = env.PRIMARY_CLOUDFLARE_ACCOUNT_ID ? env.PRIMARY_CLOUDFLARE_ACCOUNT_ID.trim() : "";
    const primaryDb = env.PRIMARY_CLOUDFLARE_DATABASE_ID ? env.PRIMARY_CLOUDFLARE_DATABASE_ID.trim() : "";
    const primaryToken = env.PRIMARY_CLOUDFLARE_API_TOKEN ? env.PRIMARY_CLOUDFLARE_API_TOKEN.trim() : "";
    const primaryEmail = env.PRIMARY_CLOUDFLARE_EMAIL ? env.PRIMARY_CLOUDFLARE_EMAIL.trim() : "";
    const shouldReplicate = env.SKIP_PRIMARY_SYNC !== "true" && primaryAccount && primaryDb && primaryToken;
    if (shouldReplicate) {
      const replicationPromise = replicateToPrimary(primaryAccount, primaryDb, primaryToken, primaryEmail, sql2, params);
      const [localResult] = await Promise.all([localWritePromise, replicationPromise]);
      return localResult;
    } else {
      return await localWritePromise;
    }
  } catch (err) {
    throw new Error(`${err.message} | SQL: ${sql2} | Params: ${JSON.stringify(params)}`);
  }
}
__name(runWrite, "runWrite");
async function runBatchWrite(env, statements) {
  if (statements.length === 0)
    return [];
  const activeStatements = statements.filter((s) => {
    const sqlLower = (s.sql || "").toLowerCase();
    if (sqlLower.includes("notifications")) {
      console.log("Ignored batch write to deleted notifications table:", s.sql.slice(0, 100));
      return false;
    }
    return true;
  });
  if (activeStatements.length === 0) {
    return statements.map(() => ({ success: true, meta: { last_row_id: 1, changes: 0 } }));
  }
  const originalDB = env._originalDB || env.DB;
  for (const s of activeStatements) {
    invalidateCacheOnWrite(s.sql);
  }
  const batch = activeStatements.map((s) => {
    return originalDB.prepare(s.sql).bind(...s.params || []);
  });
  const localBatchPromise = originalDB.batch(batch);
  const primaryAccount = env.PRIMARY_CLOUDFLARE_ACCOUNT_ID ? env.PRIMARY_CLOUDFLARE_ACCOUNT_ID.trim() : "";
  const primaryDb = env.PRIMARY_CLOUDFLARE_DATABASE_ID ? env.PRIMARY_CLOUDFLARE_DATABASE_ID.trim() : "";
  const primaryToken = env.PRIMARY_CLOUDFLARE_API_TOKEN ? env.PRIMARY_CLOUDFLARE_API_TOKEN.trim() : "";
  const primaryEmail = env.PRIMARY_CLOUDFLARE_EMAIL ? env.PRIMARY_CLOUDFLARE_EMAIL.trim() : "";
  const shouldReplicate = env.SKIP_PRIMARY_SYNC !== "true" && primaryAccount && primaryDb && primaryToken;
  let localResults;
  if (shouldReplicate) {
    const replicationPromise = replicateBatchToPrimary(primaryAccount, primaryDb, primaryToken, primaryEmail, activeStatements);
    [localResults] = await Promise.all([localBatchPromise, replicationPromise]);
  } else {
    localResults = await localBatchPromise;
  }
  let activeIndex = 0;
  return statements.map((s) => {
    const sqlLower = (s.sql || "").toLowerCase();
    if (sqlLower.includes("notifications")) {
      return { success: true, meta: { last_row_id: 1, changes: 0 } };
    }
    return localResults[activeIndex++];
  });
}
__name(runBatchWrite, "runBatchWrite");
function buildAuthHeaders(token, email) {
  const headers = {
    "Content-Type": "application/json"
  };
  if (token.startsWith("cfk_")) {
    headers["X-Auth-Key"] = token;
    headers["X-Auth-Email"] = email || "Sunil.cyrixrjbemp@gmail.com";
  } else {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}
__name(buildAuthHeaders, "buildAuthHeaders");
async function replicateToPrimary(accountId, dbId, token, email, sql2, params) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${dbId}/query`;
  const headers = buildAuthHeaders(token, email);
  const payload = {
    sql: sql2,
    params: params || []
  };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!data.success) {
      console.error("Replication failed on Primary D1:", data.errors);
    }
  } catch (e) {
    console.error("Replication connection failed:", e);
  }
}
__name(replicateToPrimary, "replicateToPrimary");
async function replicateBatchToPrimary(accountId, dbId, token, email, statements) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${dbId}/query`;
  const headers = buildAuthHeaders(token, email);
  const payload = statements.map((s) => ({
    sql: s.sql,
    params: s.params || []
  }));
  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!data.success) {
      console.error("Batch replication failed on Primary D1:", data.errors);
    }
  } catch (e) {
    console.error("Batch replication connection failed:", e);
  }
}
__name(replicateBatchToPrimary, "replicateBatchToPrimary");
var readCounter = 0;
var ROUND_ROBIN_START_DATE = /* @__PURE__ */ new Date("2026-08-03T00:00:00+05:30");
async function runRead(env, sql2, params = [], request = null) {
  const cached = getCachedResult(sql2, params);
  if (cached) {
    return cached;
  }
  const primaryAccount = env.PRIMARY_CLOUDFLARE_ACCOUNT_ID ? env.PRIMARY_CLOUDFLARE_ACCOUNT_ID.trim() : "";
  const primaryDb = env.PRIMARY_CLOUDFLARE_DATABASE_ID ? env.PRIMARY_CLOUDFLARE_DATABASE_ID.trim() : "";
  const primaryToken = env.PRIMARY_CLOUDFLARE_API_TOKEN ? env.PRIMARY_CLOUDFLARE_API_TOKEN.trim() : "";
  const primaryEmail = env.PRIMARY_CLOUDFLARE_EMAIL ? env.PRIMARY_CLOUDFLARE_EMAIL.trim() : "";
  const hasPrimary = !!(primaryAccount && primaryDb && primaryToken);
  let usePrimary = false;
  const now = new Date((/* @__PURE__ */ new Date()).getTime() + 5.5 * 60 * 60 * 1e3);
  if (hasPrimary) {
    if (now < ROUND_ROBIN_START_DATE) {
      usePrimary = false;
    } else {
      readCounter = (readCounter + 1) % 2;
      usePrimary = readCounter === 1;
    }
  }
  if (request && hasPrimary) {
    const headerVal = request.headers.get("x-read-db");
    if (headerVal === "primary") {
      usePrimary = true;
    } else if (headerVal === "secondary") {
      usePrimary = false;
    }
  }
  if (request && request.headers.get("x-read-db") === null) {
    if (env.READ_DATABASE === "primary" && hasPrimary) {
      usePrimary = true;
    } else if (env.READ_DATABASE === "secondary") {
      usePrimary = false;
    }
  }
  const originalDB = env._originalDB || env.DB;
  let result;
  try {
    if (usePrimary) {
      try {
        result = await fetchPrimaryD1(primaryAccount, primaryDb, primaryToken, primaryEmail, sql2, params);
      } catch (e) {
        console.warn("Primary D1 read failed, falling back to local Secondary D1:", e);
        result = await originalDB.prepare(sql2).bind(...params).all();
      }
    } else {
      try {
        result = await originalDB.prepare(sql2).bind(...params).all();
      } catch (e) {
        if (hasPrimary) {
          console.warn("Local Secondary D1 read failed, falling back to Primary:", e);
          try {
            result = await fetchPrimaryD1(primaryAccount, primaryDb, primaryToken, primaryEmail, sql2, params);
          } catch (err) {
            console.error("Both Secondary and Primary D1 reads failed:", err);
            throw e;
          }
        } else {
          throw e;
        }
      }
    }
  } catch (err) {
    throw new Error(`${err.message} | SQL: ${sql2} | Params: ${JSON.stringify(params)}`);
  }
  setCachedResult(sql2, params, result);
  return result;
}
__name(runRead, "runRead");
async function fetchPrimaryD1(accountId, dbId, token, email, sql2, params) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${dbId}/query`;
  const headers = buildAuthHeaders(token, email);
  const payload = {
    sql: sql2,
    params: params || []
  };
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    throw new Error(`HTTP error ${res.status} from Primary D1: ${await res.text()}`);
  }
  const data = await res.json();
  if (!data.success) {
    throw new Error(`Primary D1 returned query errors: ${JSON.stringify(data.errors)}`);
  }
  if (data.result && data.result[0]) {
    return data.result[0];
  }
  return { results: [], success: true };
}
__name(fetchPrimaryD1, "fetchPrimaryD1");

// src/utils/db-migrate.js
async function runMigrations(db) {
  const migrations = [
    // OTPs table (required for forgot_password and unlock_account flows, matches FastAPI schema)
    `CREATE TABLE IF NOT EXISTS otps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      otp_code TEXT NOT NULL,
      otp_type TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      is_used INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    // Login logs table (required for audit trail)
    `CREATE TABLE IF NOT EXISTS login_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      ip_address TEXT,
      user_agent TEXT,
      status TEXT,
      created_at TEXT
    )`,
    // KPI Appraisals table (to store performance appraisal data)
    `CREATE TABLE IF NOT EXISTS kpi_appraisals (
      user_id TEXT NOT NULL,
      month TEXT NOT NULL,
      year INTEGER NOT NULL,
      self_achieved_values TEXT,
      manager_achieved_values TEXT,
      core_ratings TEXT,
      submitted_by_self INTEGER DEFAULT 0,
      submitted_by_manager INTEGER DEFAULT 0,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, month, year)
    )`,
    // asset_value_master table
    `CREATE TABLE IF NOT EXISTS asset_value_master (
      id INTEGER PRIMARY KEY AUTOINCREMENT, 
      equipment_name TEXT NOT NULL, 
      rmsc_tender_cost REAL NOT NULL
    )`,
    // assets_inventory table
    `CREATE TABLE IF NOT EXISTS assets_inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      district_name TEXT,
      hospital_name TEXT,
      department_name TEXT,
      group_name TEXT,
      equipment_name TEXT,
      model_name TEXT,
      serial_no TEXT,
      equipment_category TEXT,
      qr_code TEXT UNIQUE,
      stock_register_page_no TEXT,
      received_date TEXT,
      installation_date TEXT,
      inventory_entry_date TEXT,
      moic_verified_date TEXT,
      po_date TEXT,
      po_cost TEXT,
      inventory_status TEXT,
      equipment_status TEXT,
      supplier TEXT,
      warranty_details TEXT,
      asset_value TEXT,
      parsed_asset_value REAL,
      di_name TEXT,
      dm_name TEXT,
      coordinator_name TEXT,
      zone_name TEXT,
      hospital_type TEXT,
      facility_type TEXT,
      equipment_type TEXT,
      uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    // legacy_hash_mapping table (for caching legacy mockId mapping)
    `CREATE TABLE IF NOT EXISTS legacy_hash_mapping (
      hash_id INTEGER PRIMARY KEY,
      exp_id TEXT UNIQUE NOT NULL
    )`,
    // system_settings table
    `CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`,
    // no_ta_da_hospitals table
    `CREATE TABLE IF NOT EXISTS no_ta_da_hospitals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hospital_name TEXT NOT NULL,
      district_name TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(hospital_name, district_name)
    )`,
    // Add base_reporting_location column to users if not present
    `ALTER TABLE users ADD COLUMN base_reporting_location TEXT`
  ];
  for (const sql2 of migrations) {
    try {
      await db.prepare(sql2).run();
    } catch (e) {
      console.error(`Migration failed: ${e.message}`, sql2.slice(0, 80));
    }
  }
  try {
    const countRes = await db.prepare("SELECT COUNT(*) as count FROM asset_value_master").first();
    if (countRes && countRes.count === 0) {
      const seedValues = [
        ["Digital Zone Monitor", 28e3],
        ["MicroMGIT Fluorescence Reader", 467e3],
        ["T-Piece Resuscitator", 27e3],
        ["Patient Warmer", 107e3],
        ["ECG Machine Single Channel", 4e4]
      ];
      for (const [name, cost] of seedValues) {
        await db.prepare("INSERT INTO asset_value_master (equipment_name, rmsc_tender_cost) VALUES (?, ?)").bind(name, cost).run();
      }
    }
  } catch (err) {
    console.error("Failed to seed asset_value_master:", err.message);
  }
  try {
    const invCountRes = await db.prepare("SELECT COUNT(*) as count FROM assets_inventory").first();
    if (invCountRes && invCountRes.count === 0) {
      await db.prepare(`
        INSERT INTO assets_inventory (
          district_name, hospital_name, equipment_name, model_name, serial_no, qr_code, inventory_status, asset_value, parsed_asset_value
        ) VALUES (
          'Udaipur', 'Khandi Ovari Nicha Fala Phc Udaipur', 'ECG Machine Single Channel', 'Model Not Available', 'V101s21071775', '(8004890615671) 67113689', 'Verified Inventory', '40000', 40000.0
        )
      `).run();
    }
  } catch (err) {
    console.error("Failed to seed assets_inventory:", err.message);
  }
  try {
    const settingsRes = await db.prepare("SELECT COUNT(*) as count FROM system_settings").first();
    if (settingsRes && settingsRes.count === 0) {
      const defaults = [
        ["max_past_days_limit", "15"],
        ["monthly_cutoff_day", "3"],
        ["pending_auto_expiry_days", "5"],
        ["pending_auto_action", "reject"],
        ["rejection_fallback_level", "creator"]
      ];
      for (const [k, v] of defaults) {
        await db.prepare("INSERT INTO system_settings (key, value) VALUES (?, ?)").bind(k, v).run();
      }
      console.log("Successfully seeded system_settings.");
    }
  } catch (err) {
    console.error("Failed to seed system_settings:", err.message);
  }
  try {
    await db.prepare(`
      UPDATE expense_itineraries 
      SET local_purchase = original_local_purchase 
      WHERE (local_purchase = 0 OR local_purchase IS NULL) 
        AND original_local_purchase > 0
    `).run();
    console.log("Successfully executed local_purchase self-healing query.");
  } catch (err) {
    console.error("Failed to execute local_purchase self-healing query:", err.message);
  }
  const indexes = [
    // User lookups by hierarchy fields (used in team queries every request)
    `CREATE INDEX IF NOT EXISTS idx_users_manager_lower ON users(LOWER(TRIM(manager)))`,
    `CREATE INDEX IF NOT EXISTS idx_users_zonal_manager_lower ON users(LOWER(TRIM(zonal_manager)))`,
    `CREATE INDEX IF NOT EXISTS idx_users_coordinator_lower ON users(LOWER(TRIM(coordinator)))`,
    `CREATE INDEX IF NOT EXISTS idx_users_name_lower ON users(LOWER(TRIM(name)))`,
    `CREATE INDEX IF NOT EXISTS idx_users_user_id ON users(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_users_status ON users(user_status)`,
    // Limit requests (used in expense init on every expense form load)
    `CREATE INDEX IF NOT EXISTS idx_limit_reqs_user_month ON limit_approval_requests(user_id, for_month)`,
    `CREATE INDEX IF NOT EXISTS idx_limit_reqs_manager ON limit_approval_requests(manager_id, status)`,
    // Expense itineraries (most queried join table)
    `CREATE INDEX IF NOT EXISTS idx_itineraries_exp_id ON expense_itineraries(exp_id)`,
    // Expenses core queries
    `CREATE INDEX IF NOT EXISTS idx_expenses_user_month_year ON expenses(user_id, month, year)`,
    `CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses(status)`,
    // Approvals — pending lookups
    `CREATE INDEX IF NOT EXISTS idx_approvals_approver_status ON approvals(approver_id, status)`,
    `CREATE INDEX IF NOT EXISTS idx_approvals_expense_status ON approvals(expense_id, status)`,
    // Hierarchy tables
    `CREATE INDEX IF NOT EXISTS idx_hier_approvers_approver ON hierarchy_approvers(approver_id)`,
    `CREATE INDEX IF NOT EXISTS idx_hier_requesters_user ON hierarchy_requesters(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_hier_requesters_hierarchy ON hierarchy_requesters(hierarchy_id)`,
    // Assets barcode lookup (used on every field visit scan)
    `CREATE INDEX IF NOT EXISTS idx_assets_qr_code ON assets_inventory(qr_code)`,
    `CREATE INDEX IF NOT EXISTS idx_assets_serial_no ON assets_inventory(serial_no)`,
    `CREATE INDEX IF NOT EXISTS idx_assets_hospital ON assets_inventory(LOWER(TRIM(hospital_name)))`,
    // Login logs (audit trail queries)
    `CREATE INDEX IF NOT EXISTS idx_login_logs_user ON login_logs(user_id)`,
    // Legacy hash mapping index
    `CREATE INDEX IF NOT EXISTS idx_legacy_hash_mapping_hash_id ON legacy_hash_mapping(hash_id)`,
    // No TA DA Hospitals indexes
    `CREATE INDEX IF NOT EXISTS idx_no_ta_da_hospitals_name ON no_ta_da_hospitals(LOWER(TRIM(hospital_name)))`,
    `CREATE INDEX IF NOT EXISTS idx_no_ta_da_hospitals_district ON no_ta_da_hospitals(LOWER(TRIM(district_name)))`
  ];
  for (const idxSql of indexes) {
    try {
      await db.prepare(idxSql).run();
    } catch (e) {
    }
  }
  console.log("Performance indexes created/verified successfully.");
}
__name(runMigrations, "runMigrations");

// src/utils/constants.js
var DESIGNATIONS = [
  "Accountant",
  "Accounts Manager",
  "Admin Assistant",
  "Administration and IT-Manager",
  "Analysist-Marketing",
  "Application Specialist",
  "Area Sales Manager",
  "Area Service Manager",
  "Assistant General Manager-Operation Service",
  "Assistant Manager",
  "Assistant Manager (Accounts)",
  "Assistant Manager (procurement)",
  "Associate VP-Sales",
  "Biomedical Engineer",
  "Biomedical Lead Engineer",
  "Biomedical Technician",
  "Branch HR Officer",
  "Branch Head",
  "Branch Officer",
  "Business Manager",
  "Calibration Engineer",
  "Calibration Service Engineer",
  "Chief Marketing Officer",
  "Chief Technical Officer",
  "Consultant-TA",
  "Coordinator-RND",
  "Coordinator-Service Sales",
  "Customer Care Executive-Marketing",
  "Data Operator-Marketing",
  "Deputy Manager-Purchase",
  "Deputy Manager-Procurment",
  "Deputy Manager-South Zone (TCQA)",
  "Digital Marketing Specialist",
  "Director",
  "District In-charge",
  "District Lead-Engineer",
  "Divisional Manager",
  "Driver",
  "Dy Manager-TCQA(North Zone)",
  "Dy. Manager (Service)",
  "Executive - Accounts",
  "Executive Director",
  "Executive-QA",
  "Executive-Warehouse",
  "GM sales",
  "Genaral Manager-Finance",
  "General Manager-Govt Business",
  "HR Executive",
  "HR Executive-TA",
  "HRBP-Service",
  "IT head",
  "Incharge Logistics and Warehouse",
  "Jr Executive-Warehouse",
  "Jr. Accountant",
  "Jr. Executive (procurement)",
  "Jr. HR Executive",
  "Jr. Office Coordinator",
  "Jr. Purchase Executive",
  "Jr. Specialist Engineer (Lab)",
  "Jr. Specialist Engineer (Radiology)",
  "Jr. Specialist Engineer-Chip level",
  "Jr. office coordinator-DnD",
  "Jr.Application Specialist",
  "Jr.Biomedical Engineer",
  "Jr.Calibration Engineer",
  "Jr.Sales Engineer",
  "Jr.Sales Engineer-Calibration",
  "Jr.Service Coordinator",
  "Jr.Service Engineer",
  "Jr.Service Engineer-Calibration",
  "Jr.Specialist Engineer",
  "Jr.Store Assistant",
  "Junior Auditor",
  "Junior Tutor",
  "Lead Engineer",
  "Lead Faculty-Accademic",
  "Lead Sales Coordinator",
  "Lead Sales Engineer",
  "Lead Service Engineer",
  "Line of Business InCharge",
  "MIS Executive",
  "MIS Executive-HR",
  "Manager (Radiology Products)",
  "Manager- Tech Support Operation",
  "Manager-HR",
  "Manager-Quality and Field Audit",
  "Manager-Service",
  "Office Assistant",
  "Office Coordinator",
  "Office Coordinator-DnD",
  "Product Sales Manager(Ciyan)",
  "Project Head",
  "Project Technical Manager",
  "Purchase Assistant",
  "Purchase Executive",
  "QA Engineer",
  "Regional Manger-Govt Business",
  "Regional Sales Manager",
  "Regional Technical Lead",
  "Sales Coordinator",
  "Sales Engineer",
  "Sales Executive",
  "Senior Coordinator-Operation",
  "Senior Deputy Manager-Procurement",
  "Senior Executive IT",
  "Senior Executive- MIS",
  "Senior Manager-Warehouse",
  "Senior Project Coordinator",
  "Senior Sevice Coordinator-DND",
  "Senior Specialist Engineer (BBR)",
  "Service Coordinator",
  "Service Coordinator-Field",
  "Service Engineer",
  "Service Engineer-Calibration",
  "Service Engineer-Fuji",
  "Service Manager",
  "Specialist Engineer",
  "Specialist Engineer (BBR)",
  "Specialist Engineer (CR)",
  "Specialist Engineer (Chip Level)",
  "Specialist Engineer (Dental)",
  "Specialist Engineer (Dialysis)",
  "Specialist Engineer (Lab)",
  "Specialist Engineer (PSA)",
  "Specialist Engineer (R O Plant)",
  "Specialist Engineer (Radiology)",
  "Specialist Engineer (Ultrasound)",
  "Specialist Engineer(Xray)",
  "Specialist Engineer-Critical",
  "Sr. Accountant",
  "Sr. Biomedical Engineer",
  "Sr. Engineer-Quality Assurance",
  "Sr. Executive (Data and Documentation)",
  "Sr. Executive-Sales and Marketing",
  "Sr. HR Executive",
  "Sr. Manager (TRC)",
  "Sr. Office Coordinator",
  "Sr. Procurement Executive",
  "Sr. Project Survery Analyst",
  "Sr. Sales Coordinator",
  "Sr. Sales Engineer",
  "Sr. Service Coordinator",
  "Sr. Specialist Engineer (Lab)",
  "Sr. Specialist Engineer (PSA)",
  "Sr. Specialist Engineer (TRC)",
  "Sr. Specialist Engineer-Dialysis",
  "Sr. Specialist Engineer-X-Ray",
  "Sr.Calibration Engineer",
  "Sr.Service Engineer",
  "Sr.Service Engineer Calibration",
  "Sr.Specialist Engineer",
  "Sr.Specialist Engineer-CR",
  "Sr.Specialist Engineer-Chip Level",
  "Store Assistant",
  "Store Cum Office Boy",
  "Support Engineer",
  "Support Engineer-Calibration",
  "Support Engineer-TRC",
  "System Engineer",
  "Technical Facilitator",
  "Technician",
  "Territory Business Manager",
  "Territory Service Sales Manager",
  "Trainee Field Engineer",
  "Trainee Office Coordinator",
  "Trainee Purchase Assistant",
  "Trainee Technician",
  "Trainee-Service Coordinator",
  "Trainer",
  "Vice President BEMP",
  "Warehouse Executive",
  "Warehouse Officer",
  "Zonal Manager"
];
var ZONE_DISTRICTS = {
  "All": ["All"],
  "Ajmer": ["Ajmer", "Beawer", "Bhilwara", "Nagaur", "Tonk"],
  "Bikaner": ["Bikaner", "Churu", "Ganganar", "Hanumangarh"],
  "Jaipur": ["Jaipur"],
  "Jodhpur": ["Barmer", "Balotra", "Jaisalmer", "Jalore", "Jodhpur", "Pali", "Phalodi", "Sirohi"],
  "Udaipur": ["Banswara", "Chittorgarh", "Dungarpur", "Rajsamand", "Pratapgarh", "Udaipur"]
};
var ROLES = ["Engineer", "Manager", "Division Manager", "Coordinator", "Accountant", "HR", "Project Head", "Travel Tesk", "MIS", "VP", "Admin"];
var MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
];

// src/routes/upload.js
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
__name(jsonResponse, "jsonResponse");
function makeSafeFilename(filename) {
  const parts = filename.split(".");
  const ext = parts.pop();
  const name = parts.join("_").replace(/[^a-zA-Z0-9_]/g, "");
  const randomSuffix = Math.random().toString(36).substring(2, 10);
  return `${name}_${randomSuffix}.${ext}`;
}
__name(makeSafeFilename, "makeSafeFilename");
async function arrayBufferToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
__name(arrayBufferToBase64, "arrayBufferToBase64");
async function uploadToGoogleDrive(env, file, folderName, filename) {
  const gasUrl = env.GAS_WEB_APP_URL || "https://script.google.com/macros/s/AKfycbwxh5LQLCGtwGflfF7V5HKyL7viFNlAkAbsgz5xEDQo8Eg_f1kw47EjxrzSAC891sm1/exec";
  const parentFolderId = "1oiX3ZTlnMQ9RYn8uXhLx2mrmzz_K98Nu";
  const arrayBuffer = await file.arrayBuffer();
  const base64Content = await arrayBufferToBase64(arrayBuffer);
  const payload = {
    action: "upload_file",
    folderId: parentFolderId,
    folderName,
    filename,
    fileBase64: base64Content,
    mimeType: file.type || "application/octet-stream"
  };
  const response = await fetch(gasUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  if (response.status === 200) {
    const result = await response.json();
    if (result.success) {
      return result.fileId;
    } else {
      throw new Error("GAS Upload returned failure: " + result.error);
    }
  } else {
    const errText = await response.text();
    throw new Error(`GAS Upload returned HTTP ${response.status}: ${errText}`);
  }
}
__name(uploadToGoogleDrive, "uploadToGoogleDrive");
async function deleteFromGoogleDrive(env, fileId) {
  const gasUrl = env.GAS_WEB_APP_URL || "https://script.google.com/macros/s/AKfycbwxh5LQLCGtwGflfF7V5HKyL7viFNlAkAbsgz5xEDQo8Eg_f1kw47EjxrzSAC891sm1/exec";
  const payload = {
    action: "delete_file",
    fileId
  };
  try {
    const response = await fetch(gasUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    if (response.status === 200) {
      const result = await response.json();
      return !!result.success;
    }
  } catch (e) {
    console.error("Failed to delete from GDrive:", e);
  }
  return false;
}
__name(deleteFromGoogleDrive, "deleteFromGoogleDrive");
async function uploadFileWithFallback(env, file, subfolder, filename) {
  const safeName = makeSafeFilename(filename);
  try {
    const fileId = await uploadToGoogleDrive(env, file, subfolder, safeName);
    return `/api/upload/file/gdrive/${fileId}`;
  } catch (driveErr) {
    console.error("Google Drive upload failed:", driveErr);
    throw new Error("Upload failed on Google Drive. Detail: " + driveErr.message);
  }
}
__name(uploadFileWithFallback, "uploadFileWithFallback");
async function handleUploadImage(request, env, params, query, user) {
  let formData;
  try {
    formData = await request.formData();
  } catch (e) {
    return jsonResponse({ error: "Invalid multipart form data" }, 400);
  }
  const file = formData.get("file");
  if (!file)
    return jsonResponse({ error: "No file uploaded" }, 400);
  const fileBuffer = await file.arrayBuffer();
  if (fileBuffer.byteLength > 10 * 1024 * 1024) {
    return jsonResponse({ error: "File size exceeds the limit of 10MB." }, 400);
  }
  const safeName = makeSafeFilename(file.name);
  const now = /* @__PURE__ */ new Date();
  const monthName = now.toLocaleString("en-US", { month: "long" });
  const yearVal = now.getFullYear();
  const folderName = `${monthName}_${yearVal}`;
  try {
    const fileUrl = await uploadFileWithFallback(env, file, folderName, file.name);
    return jsonResponse({
      filename: file.name,
      url: fileUrl
    });
  } catch (e) {
    console.error("Upload failed with fallback:", e);
    return jsonResponse({ error: "Upload failed: " + e.message }, 500);
  }
}
__name(handleUploadImage, "handleUploadImage");
async function handleUploadDocument(request, env, params, query, user) {
  let formData;
  try {
    formData = await request.formData();
  } catch (e) {
    return jsonResponse({ error: "Invalid multipart form data" }, 400);
  }
  const file = formData.get("file");
  if (!file)
    return jsonResponse({ error: "No file uploaded" }, 400);
  const safeName = makeSafeFilename(file.name);
  const now = /* @__PURE__ */ new Date();
  const monthName = now.toLocaleString("en-US", { month: "long" });
  const yearVal = now.getFullYear();
  const folderName = `${monthName}_${yearVal}`;
  try {
    const fileUrl = await uploadFileWithFallback(env, file, folderName, file.name);
    return jsonResponse({
      filename: file.name,
      url: fileUrl
    });
  } catch (e) {
    console.error("Upload failed with fallback:", e);
    return jsonResponse({ error: "Upload failed: " + e.message }, 500);
  }
}
__name(handleUploadDocument, "handleUploadDocument");
async function handleServeFile(request, env, params, query, user) {
  const urlObj = new URL(request.url);
  const pathPrefix = "/api/upload/file/";
  const key = decodeURIComponent(urlObj.pathname.substring(urlObj.pathname.indexOf(pathPrefix) + pathPrefix.length));
  if (key.startsWith("gdrive/")) {
    const fileId = key.replace("gdrive/", "");
    const gasUrl = env.GAS_WEB_APP_URL || "https://script.google.com/macros/s/AKfycbwxh5LQLCGtwGflfF7V5HKyL7viFNlAkAbsgz5xEDQo8Eg_f1kw47EjxrzSAC891sm1/exec";
    try {
      const payload = {
        action: "download_file",
        fileId
      };
      const response = await fetch(gasUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      if (response.status === 200) {
        const result = await response.json();
        if (result.success) {
          const fileBase64 = result.fileBase64;
          const contentType = result.mimeType || "application/octet-stream";
          const binaryStr = atob(fileBase64);
          const len = binaryStr.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }
          return new Response(bytes, {
            status: 200,
            headers: {
              "Content-Type": contentType,
              "Cache-Control": "public, max-age=31536000"
            }
          });
        } else {
          return new Response("File not found in Google Drive: " + result.error, { status: 404 });
        }
      } else {
        return new Response("Failed to fetch from Google Drive proxy", { status: response.status });
      }
    } catch (e) {
      console.error("Error serving from Google Drive:", e);
      return new Response("Internal Server Error serving Google Drive file", { status: 500 });
    }
  }
  const accountId = env.PRIMARY_CLOUDFLARE_ACCOUNT_ID;
  const bucketName = "fieldops-uploads";
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${bucketName}/objects/${key}`;
  try {
    const token = env.PRIMARY_CLOUDFLARE_API_TOKEN;
    const email = env.PRIMARY_CLOUDFLARE_EMAIL;
    const headers = {};
    if (token && token.startsWith("cfk_")) {
      headers["X-Auth-Key"] = token;
      headers["X-Auth-Email"] = email || "Sunil.cyrixrjbemp@gmail.com";
    } else if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    const res = await fetch(url, {
      method: "GET",
      headers
    });
    if (res.status === 200) {
      const contentType = res.headers.get("Content-Type") || "application/octet-stream";
      return new Response(res.body, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=31536000"
        }
      });
    } else {
      return new Response("File not found", { status: 404 });
    }
  } catch (e) {
    console.error("Error serving R2 object:", e);
    return new Response("Internal Server Error", { status: 500 });
  }
}
__name(handleServeFile, "handleServeFile");

// src/utils/legacy-resolver.js
async function resolveLegacyExpenseId(env, hashIdVal) {
  if (typeof hashIdVal !== "number" || isNaN(hashIdVal) || hashIdVal > -2e5) {
    return null;
  }
  try {
    const cached = await env.DB.prepare("SELECT exp_id FROM legacy_hash_mapping WHERE hash_id = ?").bind(hashIdVal).first();
    if (cached && cached.exp_id) {
      return cached.exp_id;
    }
  } catch (err) {
    console.warn("legacy_hash_mapping table lookup failed, maybe migrations haven't run yet:", err.message);
  }
  try {
    const allRows = await env.DB.prepare("SELECT exp_id FROM expense_master").all();
    const rows = allRows.results || [];
    for (const row of rows) {
      if (!row.exp_id)
        continue;
      const md5Hash = await getLegacyExpenseHashId(row.exp_id);
      if (md5Hash === hashIdVal) {
        await cacheMapping(env, hashIdVal, row.exp_id);
        return row.exp_id;
      }
      const numId = parseInt(row.exp_id, 10);
      if (!isNaN(numId)) {
        const formulaHash = -((numId * 73 + 19) % 8e5 + 2e5);
        if (formulaHash === hashIdVal) {
          await cacheMapping(env, hashIdVal, row.exp_id);
          return row.exp_id;
        }
      }
    }
  } catch (err) {
    console.warn("Fallback scan on expense_master failed:", err.message);
  }
  return null;
}
__name(resolveLegacyExpenseId, "resolveLegacyExpenseId");
async function cacheMapping(env, hashId, expId) {
  try {
    await env.DB.prepare("INSERT OR IGNORE INTO legacy_hash_mapping (hash_id, exp_id) VALUES (?, ?)").bind(hashId, expId).run();
  } catch (err) {
    console.warn("Failed to write legacy mapping to cache table:", err.message);
  }
}
__name(cacheMapping, "cacheMapping");

// src/routes/approval.js
function jsonResponse2(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
__name(jsonResponse2, "jsonResponse");
async function queryInChunks(db, queryTemplate, ids, chunkSize = 50) {
  let allResults = [];
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const placeholders = chunk.map(() => "?").join(",");
    const sql2 = queryTemplate.replace("?", placeholders);
    const res = await db.prepare(sql2).bind(...chunk).all();
    if (res.results) {
      allResults = allResults.concat(res.results);
    }
  }
  return allResults;
}
__name(queryInChunks, "queryInChunks");
async function applyItineraryEditsAndLog(env, expense, itineraryEdits, currentUser, comments) {
  if (!itineraryEdits || itineraryEdits.length === 0)
    return;
  const allLegsRes = await env.DB.prepare(
    "SELECT * FROM expense_itineraries WHERE exp_id = ?"
  ).bind(expense.expense_code).all();
  const legsMap = {};
  for (const l of allLegsRes.results || []) {
    legsMap[l.leg_number] = l;
  }
  const batchWrites = [];
  for (const edit of itineraryEdits) {
    const legNum = edit.leg_number;
    const leg = legsMap[legNum];
    if (!leg)
      continue;
    let isKmModified = false;
    if (edit.distance_km !== void 0 && edit.distance_km !== null) {
      const oldKm = parseFloat(leg.distance_km || "0.0");
      const newKm = parseFloat(edit.distance_km || "0.0");
      if (Math.round(oldKm * 100) !== Math.round(newKm * 100)) {
        isKmModified = true;
      }
    }
    const fieldsToCheck = [
      ["travel_amount", edit.travel_amount],
      ["sub_amount", edit.sub_amount],
      ["hotel_amount", edit.hotel_amount],
      ["other_amount", edit.other_amount || edit.oth_amount],
      ["distance_km", edit.distance_km || edit.km],
      ["da_amount", edit.da_amount || edit.da],
      ["local_purchase", edit.local_purchase]
    ];
    for (const [field, newValRaw] of fieldsToCheck) {
      if (newValRaw !== void 0 && newValRaw !== null) {
        const newVal = parseFloat(newValRaw);
        let skipLog = false;
        if (field === "travel_amount" && isKmModified && ["bike", "car"].includes((leg.travel_mode || "").trim().toLowerCase())) {
          skipLog = true;
        }
        const oldVal = parseFloat(leg[field] || "0.0");
        if (Math.round(oldVal * 100) !== Math.round(newVal * 100)) {
          if (!skipLog) {
            let fieldRemark = null;
            if (edit.remarks && typeof edit.remarks === "object") {
              fieldRemark = edit.remarks[field];
              if (!fieldRemark && field === "da_amount") {
                fieldRemark = edit.remarks.da || edit.remarks.da_amount;
              } else if (!fieldRemark && field === "distance_km") {
                fieldRemark = edit.remarks.km || edit.remarks.distance_km;
              }
            }
            batchWrites.push({
              sql: `INSERT INTO expense_edit_logs (expense_id, leg_number, field_name, old_value, new_value, comment, editor_name, editor_role, editor_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              params: [
                expense.id,
                legNum,
                field,
                String(oldVal),
                String(newVal),
                fieldRemark || comments || "Adjusted during approval",
                currentUser.name,
                currentUser.role,
                currentUser.id
              ]
            });
          }
          batchWrites.push({
            sql: `UPDATE expense_itineraries SET ${field} = ? WHERE id = ?`,
            params: [newVal, leg.id]
          });
        }
      }
    }
  }
  if (batchWrites.length > 0) {
    await runBatchWrite(env, batchWrites);
  }
  const legsRows = await env.DB.prepare("SELECT * FROM expense_itineraries WHERE exp_id = ?").bind(expense.expense_code).all();
  const legs = legsRows.results || [];
  const totalDa = legs.reduce((sum, l) => sum + parseFloat(l.da_amount || "0.0"), 0);
  const totalHotel = legs.reduce((sum, l) => sum + parseFloat(l.hotel_amount || "0.0"), 0);
  const totalOther = legs.reduce((sum, l) => sum + parseFloat(l.other_amount || "0.0"), 0);
  const totalTravel = legs.reduce((sum, l) => sum + parseFloat(l.travel_amount || "0.0"), 0);
  const totalSub = legs.reduce((sum, l) => sum + parseFloat(l.sub_amount || "0.0"), 0);
  const totalLp = legs.reduce((sum, l) => sum + parseFloat(l.local_purchase || "0.0"), 0);
  const totalAmount = totalTravel + totalSub + totalDa + totalHotel + totalOther + totalLp;
  await runWrite(env, `
    UPDATE expenses 
    SET da_amount = ?, hotel_amount = ?, other_expense_amount = ?, local_purchase_amount = ?, amount = ?
    WHERE id = ?
  `, [totalDa, totalHotel, totalOther, totalLp, totalAmount, expense.id]);
}
__name(applyItineraryEditsAndLog, "applyItineraryEditsAndLog");
async function getLegacyExpenseHashId(expId) {
  const msgUint8 = new TextEncoder().encode(String(expId));
  const hashBuffer = await crypto.subtle.digest("MD5", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  const val = parseInt(hashHex.substring(0, 7), 16);
  return -2e5 - val;
}
__name(getLegacyExpenseHashId, "getLegacyExpenseHashId");
async function fetchPendingApprovals(env, user) {
  const result = [];
  const userRoleClean = (user.role || "").trim().toLowerCase();
  const isAdmin = userRoleClean === "admin";
  const pendingLimits = await env.DB.prepare(`
    SELECT pl.*, u.name AS submitter_name
    FROM limit_approval_requests pl
    LEFT JOIN users u ON u.user_id = pl.user_id
    WHERE pl.manager_id = ? AND pl.status = 'Pending'
  `).bind(user.user_id).all();
  for (const pl of pendingLimits.results || []) {
    result.push({
      id: -pl.id,
      expense_id: -pl.id,
      approver_id: user.id,
      level_number: 1,
      status: "pending",
      comments: "",
      created_at: pl.created_at,
      updated_at: pl.updated_at,
      expense_code: `LIMIT-${pl.request_type}-${pl.id}`,
      employeeName: pl.submitter_name || `Employee ${pl.user_id}`,
      eCode: pl.user_id,
      purpose: `Request additional ${parseFloat(pl.requested_value).toFixed(1)} ${pl.request_type} limit for month ${pl.for_month}`,
      category: "Limit Request",
      amount: parseFloat(pl.requested_value),
      date: pl.for_month,
      itinerariesCount: 0
    });
  }
  const approvals2 = await env.DB.prepare(`
    SELECT a.*, e.expense_code, e.amount, e.description, e.travel_mode, e.itinerary, e.user_id as submitter_user_id,
           e.calls_assigned, e.calls_completed,
           u.name AS submitter_name, u.user_id AS submitter_code
    FROM approvals a
    JOIN expenses e ON a.expense_id = e.id
    LEFT JOIN users u ON e.user_id = u.id
    WHERE a.approver_id = ? AND a.status = 'pending'
      AND EXISTS (
        SELECT 1 
        FROM hierarchy_requesters hr 
        JOIN hierarchy_approvers ha ON hr.hierarchy_id = ha.hierarchy_id 
        WHERE hr.user_id = e.user_id AND ha.approver_id = a.approver_id
      )
    ORDER BY a.level_number ASC, a.created_at DESC
  `).bind(user.id).all();
  const approvalsList = approvals2.results || [];
  const expenseCodes = approvalsList.map((a) => a.expense_code).filter(Boolean);
  const itiCounts = {};
  if (expenseCodes.length > 0) {
    const countResults = await queryInChunks(
      env.DB,
      "SELECT exp_id, COUNT(*) as cnt FROM expense_itineraries WHERE exp_id IN (?) GROUP BY exp_id",
      expenseCodes
    );
    for (const row of countResults) {
      itiCounts[row.exp_id] = row.cnt;
    }
  }
  for (const app of approvalsList) {
    const itiCount = itiCounts[app.expense_code] || 0;
    result.push({
      id: app.id,
      expense_id: app.expense_id,
      approver_id: app.approver_id,
      level_number: app.level_number,
      status: app.status,
      comments: app.comments || "",
      created_at: app.created_at,
      updated_at: app.updated_at,
      expense_code: app.expense_code,
      employeeName: app.submitter_name || "Unknown Employee",
      eCode: app.submitter_code || "N/A",
      purpose: app.description || "",
      category: app.travel_mode || "Travel",
      amount: parseFloat(app.amount || 0),
      date: app.itinerary,
      itinerariesCount: itiCount,
      calls_assigned: app.calls_assigned || 0,
      calls_completed: app.calls_completed || 0
    });
  }
  try {
    const legacyRows = await env.DB.prepare(`
      SELECT m.exp_id, m.user_id, m.expense_date, m.total_amount, m.status, m.visit_purpose, m.calls_assigned, m.calls_completed, u.name as full_name, u.e_code
      FROM expense_master m
      JOIN users u ON LOWER(m.user_id) = LOWER(u.user_id)
      WHERE 
        ((m.status = 'Pending L1' OR m.status = 'Pending') AND LOWER(m.level_first_approver) = LOWER(?))
        OR
        (m.status = 'Pending L2' AND LOWER(m.level_second_approver) = LOWER(?))
    `).bind(user.user_id, user.user_id).all();
    const legacyList = legacyRows.results || [];
    if (legacyList.length > 0) {
      const legacyCodes = legacyList.map((r) => r.exp_id);
      const [countResults, firstLegs] = await Promise.all([
        queryInChunks(
          env.DB,
          "SELECT exp_id, COUNT(*) as cnt FROM expense_itineraries WHERE exp_id IN (?) GROUP BY exp_id",
          legacyCodes
        ),
        queryInChunks(
          env.DB,
          `SELECT exp_id, travel_mode 
           FROM expense_itineraries 
           WHERE exp_id IN (?) 
           AND leg = 1`,
          legacyCodes
        )
      ]);
      const countMap = {};
      for (const r of countResults)
        countMap[r.exp_id] = r.cnt;
      const modeMap = {};
      for (const r of firstLegs) {
        if (!modeMap[r.exp_id])
          modeMap[r.exp_id] = r.travel_mode;
      }
      for (const row of legacyList) {
        const mockId = await getLegacyExpenseHashId(row.exp_id);
        const levelNumber = row.status === "Pending L2" ? 2 : 1;
        const itiCount = countMap[row.exp_id] || 0;
        const category = modeMap[row.exp_id] || "Travel";
        result.push({
          id: mockId,
          expense_id: mockId,
          approver_id: user.id,
          level_number: levelNumber,
          status: "pending",
          comments: "",
          created_at: row.expense_date,
          updated_at: row.expense_date,
          expense_code: row.exp_id,
          employeeName: row.full_name || "Unknown Employee",
          eCode: row.e_code || row.user_id,
          purpose: row.visit_purpose || "",
          category,
          amount: parseFloat(row.total_amount || 0),
          date: row.expense_date,
          itinerariesCount: itiCount,
          calls_assigned: row.calls_assigned || 0,
          calls_completed: row.calls_completed || 0
        });
      }
    }
  } catch (error) {
    console.warn("Legacy table expense_master not found or query failed, skipping legacy pending claims:", error.message);
  }
  return result;
}
__name(fetchPendingApprovals, "fetchPendingApprovals");
async function handleGetApprovals(request, env, params, query, user) {
  const pending = await fetchPendingApprovals(env, user);
  return jsonResponse2(pending);
}
__name(handleGetApprovals, "handleGetApprovals");
async function handleApprove(request, env, params, query, user) {
  const expenseId = parseInt(params.expense_id, 10);
  let body;
  try {
    body = await request.json();
  } catch (e) {
    body = {};
  }
  const { comments, approved_value, client_timestamp, itinerary_edits, removed_attachments } = body;
  const timestamp = client_timestamp || (/* @__PURE__ */ new Date()).toISOString();
  if (expenseId <= -2e5) {
    const matchingExpId = await resolveLegacyExpenseId(env, expenseId);
    if (!matchingExpId) {
      return jsonResponse2({ error: "Legacy expense claim not found" }, 404);
    }
    const match = await env.DB.prepare(`
      SELECT exp_id, user_id, status, level_first_approver, level_second_approver, total_amount 
      FROM expense_master WHERE exp_id = ?
    `).bind(matchingExpId).first();
    if (!match) {
      return jsonResponse2({ error: "Legacy expense claim not found" }, 404);
    }
    const { exp_id, user_id: submitterId, status: currentStatus, level_first_approver: l1App, level_second_approver: l2App, total_amount: totalAmount } = match;
    const isL1 = l1App === user.user_id;
    const isL2 = l2App === user.user_id;
    if (submitterId && user.user_id && submitterId.toLowerCase() === user.user_id.toLowerCase()) {
      return jsonResponse2({ error: "Self-approval of legacy expense claims is not permitted" }, 400);
    }
    if (!isL1 && !isL2 && user.role !== "Admin") {
      return jsonResponse2({ error: "Access denied to approve this claim" }, 403);
    }
    let newStatus = currentStatus;
    if ((currentStatus === "Pending L1" || currentStatus === "Pending") && isL1) {
      newStatus = l2App && l2App.trim() && l2App !== "None" ? "Pending L2" : "Approved";
      await runWrite(env, `
        UPDATE expense_master 
        SET status = ?, approved_by = ?, level_first_approver_time = ?
        WHERE exp_id = ?
      `, [newStatus, user.user_id, timestamp, exp_id]);
    } else if (currentStatus === "Pending L2" && isL2) {
      newStatus = "Approved";
      await runWrite(env, `
        UPDATE expense_master 
        SET status = 'Approved', approved_by = ?, level_second_approver_time = ?
        WHERE exp_id = ?
      `, [user.user_id, timestamp, exp_id]);
    } else {
      return jsonResponse2({ error: "Cannot action this claim at this time" }, 400);
    }
    if (newStatus === "Pending L2") {
      await runWrite(env, "INSERT INTO notifications (user_id, title, description, type, read, link, created_at) VALUES (?, ?, ?, ?, 0, ?, ?)", [
        submitterId,
        "\u{1F504} Claim Approved at Level 1",
        `Your claim ${exp_id} has been approved at Level 1 by ${user.name}.`,
        "info",
        "/home",
        timestamp
      ]);
      await runWrite(env, "INSERT INTO notifications (user_id, title, description, type, read, link, created_at) VALUES (?, ?, ?, ?, 0, ?, ?)", [
        l2App,
        "\u{1F4E5} Pending Approval",
        `New claim ${exp_id} submitted by ${submitterId} (\u20B9${totalAmount}) is pending Level 2 approval.`,
        "warning",
        "/approval-center",
        timestamp
      ]);
    } else {
      await runWrite(env, "INSERT INTO notifications (user_id, title, description, type, read, link, created_at) VALUES (?, ?, ?, ?, 0, ?, ?)", [
        submitterId,
        "\u2705 Expense Claim Approved!",
        `Your claim ${exp_id} has been fully approved by ${user.name}.`,
        "success",
        "/home",
        timestamp
      ]);
    }
    return jsonResponse2({ status: "success", message: "Expense claim approved successfully." });
  }
  if (expenseId < 0) {
    const limitId = -expenseId;
    const pl = await env.DB.prepare("SELECT * FROM limit_approval_requests WHERE id = ?").bind(limitId).first();
    if (!pl)
      return jsonResponse2({ error: "Limit approval request not found" }, 404);
    if (pl.user_id && user.user_id && pl.user_id.toLowerCase() === user.user_id.toLowerCase()) {
      return jsonResponse2({ error: "Self-approval of limit requests is not permitted" }, 400);
    }
    const isManager = pl.manager_id && (pl.manager_id.toLowerCase() === user.user_id.toLowerCase() || user.e_code && pl.manager_id.toLowerCase() === user.e_code.toLowerCase() || pl.manager_id.toLowerCase() === user.name.toLowerCase());
    if (!isManager && user.role !== "Admin") {
      return jsonResponse2({ error: "Access denied to approve this request" }, 403);
    }
    const approvedVal = approved_value !== void 0 ? approved_value : pl.requested_value;
    await runWrite(env, "UPDATE limit_approval_requests SET approved_value = ?, status = 'Approved', updated_at = ? WHERE id = ?", [
      approvedVal,
      timestamp,
      limitId
    ]);
    await runWrite(env, "INSERT INTO notifications (user_id, title, description, type, read, link, created_at) VALUES (?, ?, ?, ?, 0, ?, ?)", [
      pl.user_id,
      `Limit Request ${pl.request_type} Approved`,
      `Your request for additional ${pl.requested_value} ${pl.request_type} has been approved by your manager.`,
      "success",
      "/expense",
      timestamp
    ]);
    return jsonResponse2({ status: "success", message: "Limit request approved successfully." });
  }
  const activeApproval = await env.DB.prepare(`
    SELECT * FROM approvals WHERE expense_id = ? AND approver_id = ? AND status = 'pending'
  `).bind(expenseId, user.id).first();
  if (!activeApproval) {
    return jsonResponse2({ error: "No pending approval task found for you on this claim" }, 400);
  }
  const expense = await env.DB.prepare("SELECT * FROM expenses WHERE id = ?").bind(expenseId).first();
  if (!expense)
    return jsonResponse2({ error: "Expense claim not found" }, 404);
  if (expense.user_id === user.id) {
    return jsonResponse2({ error: "Self-approval of expense claims is not permitted" }, 400);
  }
  if (itinerary_edits && itinerary_edits.length > 0) {
    await applyItineraryEditsAndLog(env, expense, itinerary_edits, user, comments);
  }
  if (removed_attachments && Array.isArray(removed_attachments)) {
    await processRemovedAttachments(env, removed_attachments);
  }
  const allApprovals = await env.DB.prepare("SELECT * FROM approvals WHERE expense_id = ? ORDER BY level_number ASC").bind(expenseId).all();
  let nextApproval = null;
  for (const a of allApprovals.results || []) {
    if (a.level_number > activeApproval.level_number && a.status === "waiting") {
      nextApproval = a;
      break;
    }
  }
  let finalStatus = "approved";
  const statements = [
    {
      sql: "UPDATE approvals SET status = 'approved', comments = ?, updated_at = ? WHERE id = ?",
      params: [comments || "", timestamp, activeApproval.id]
    }
  ];
  if (nextApproval) {
    finalStatus = `submitted_l${nextApproval.level_number}`;
    statements.push({
      sql: "UPDATE approvals SET status = 'pending', created_at = ?, updated_at = ? WHERE id = ?",
      params: [timestamp, timestamp, nextApproval.id]
    });
  }
  statements.push({
    sql: "UPDATE expenses SET status = ?, updated_at = ? WHERE id = ?",
    params: [finalStatus, timestamp, expenseId]
  });
  await runBatchWrite(env, statements);
  const submitter = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(expense.user_id).first();
  if (submitter) {
    if (finalStatus === "approved") {
      await runWrite(env, "INSERT INTO notifications (user_id, title, description, type, read, link, created_at) VALUES (?, ?, ?, ?, 0, ?, ?)", [
        submitter.user_id,
        "\u2705 Expense Claim Approved!",
        `Your claim ${expense.expense_code} has been fully approved by ${user.name}.`,
        "success",
        "/home",
        timestamp
      ]);
    } else {
      await runWrite(env, "INSERT INTO notifications (user_id, title, description, type, read, link, created_at) VALUES (?, ?, ?, ?, 0, ?, ?)", [
        submitter.user_id,
        "\u{1F504} Claim Forwarded",
        `Your claim ${expense.expense_code} has been approved by ${user.name} and forwarded to the next level.`,
        "info",
        "/home",
        timestamp
      ]);
    }
  }
  if (nextApproval) {
    const nextApproverUser = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(nextApproval.approver_id).first();
    if (nextApproverUser) {
      await runWrite(env, "INSERT INTO notifications (user_id, title, description, type, read, link, created_at) VALUES (?, ?, ?, ?, 0, ?, ?)", [
        nextApproverUser.user_id,
        "\u{1F4E5} Pending Approval Forwarded",
        `Claim ${expense.expense_code} has been forwarded to you for review.`,
        "warning",
        "/approval-center",
        timestamp
      ]);
    }
  }
  return jsonResponse2({ status: "success", message: "Expense claim approved successfully.", expense_status: finalStatus === "approved" ? "Approved" : "Pending Next Level" });
}
__name(handleApprove, "handleApprove");
async function handleReject(request, env, params, query, user) {
  const expenseId = parseInt(params.expense_id, 10);
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse2({ error: "Invalid JSON body" }, 400);
  }
  const { comments, client_timestamp, itinerary_edits, removed_attachments } = body;
  if (!comments || !comments.trim()) {
    return jsonResponse2({ error: "Rejection comments/remark is mandatory" }, 400);
  }
  const timestamp = client_timestamp || (/* @__PURE__ */ new Date()).toISOString();
  if (expenseId <= -2e5) {
    const matchingExpId = await resolveLegacyExpenseId(env, expenseId);
    if (!matchingExpId) {
      return jsonResponse2({ error: "Legacy claim not found" }, 404);
    }
    const match = await env.DB.prepare(`
      SELECT exp_id, user_id, status, level_first_approver, level_second_approver 
      FROM expense_master WHERE exp_id = ?
    `).bind(matchingExpId).first();
    if (!match)
      return jsonResponse2({ error: "Legacy claim not found" }, 404);
    const { exp_id, user_id: submitterId, status: currentStatus, level_first_approver: l1App, level_second_approver: l2App } = match;
    const isL1 = l1App === user.user_id;
    const isL2 = l2App === user.user_id;
    if (submitterId && user.user_id && submitterId.toLowerCase() === user.user_id.toLowerCase()) {
      return jsonResponse2({ error: "Self-rejection of legacy expense claims is not permitted" }, 400);
    }
    if (!isL1 && !isL2 && user.role !== "Admin") {
      return jsonResponse2({ error: "Access denied to reject this claim" }, 403);
    }
    if ((currentStatus === "Pending L1" || currentStatus === "Pending") && isL1) {
      await runWrite(env, "UPDATE expense_master SET status = 'Rejected', reject_reason = ?, approved_by = 'L1', level_first_approver_time = ? WHERE exp_id = ?", [
        comments,
        timestamp,
        exp_id
      ]);
    } else if (currentStatus === "Pending L2" && isL2) {
      await runWrite(env, "UPDATE expense_master SET status = 'Rejected', reject_reason = ?, approved_by = 'L2', level_second_approver_time = ? WHERE exp_id = ?", [
        comments,
        timestamp,
        exp_id
      ]);
    } else {
      return jsonResponse2({ error: "Cannot reject this claim at this time" }, 400);
    }
    await runWrite(env, "INSERT INTO notifications (user_id, title, description, type, read, link, created_at) VALUES (?, ?, ?, ?, 0, ?, ?)", [
      submitterId,
      "\u274C Expense Claim Rejected",
      `Your claim ${exp_id} has been rejected by ${user.name}. Reason: ${comments.slice(0, 80)}`,
      "error",
      "/home",
      timestamp
    ]);
    return jsonResponse2({ status: "success", message: "Expense claim has been rejected." });
  }
  if (expenseId < 0) {
    const limitId = -expenseId;
    const pl = await env.DB.prepare("SELECT * FROM limit_approval_requests WHERE id = ?").bind(limitId).first();
    if (!pl)
      return jsonResponse2({ error: "Limit approval request not found" }, 404);
    if (pl.user_id && user.user_id && pl.user_id.toLowerCase() === user.user_id.toLowerCase()) {
      return jsonResponse2({ error: "Self-rejection of limit requests is not permitted" }, 400);
    }
    const isManager = pl.manager_id && (pl.manager_id.toLowerCase() === user.user_id.toLowerCase() || user.e_code && pl.manager_id.toLowerCase() === user.e_code.toLowerCase() || pl.manager_id.toLowerCase() === user.name.toLowerCase());
    if (!isManager && user.role !== "Admin") {
      return jsonResponse2({ error: "Access denied to reject this request" }, 403);
    }
    await runWrite(env, "UPDATE limit_approval_requests SET status = 'Rejected', updated_at = ? WHERE id = ?", [
      timestamp,
      limitId
    ]);
    await runWrite(env, "INSERT INTO notifications (user_id, title, description, type, read, link, created_at) VALUES (?, ?, ?, ?, 0, ?, ?)", [
      pl.user_id,
      `Limit Request ${pl.request_type} Rejected`,
      `Your request for additional ${pl.requested_value} ${pl.request_type} has been rejected by your manager.`,
      "danger",
      "/expense",
      timestamp
    ]);
    return jsonResponse2({ status: "success", message: "Limit request rejected successfully." });
  }
  const activeApproval = await env.DB.prepare(`
    SELECT * FROM approvals WHERE expense_id = ? AND approver_id = ? AND status = 'pending'
  `).bind(expenseId, user.id).first();
  if (!activeApproval) {
    return jsonResponse2({ error: "No pending approval task found for you on this claim" }, 400);
  }
  const expense = await env.DB.prepare("SELECT * FROM expenses WHERE id = ?").bind(expenseId).first();
  if (!expense)
    return jsonResponse2({ error: "Expense claim not found" }, 404);
  if (expense.user_id === user.id) {
    return jsonResponse2({ error: "Self-rejection of expense claims is not permitted" }, 400);
  }
  if (itinerary_edits && itinerary_edits.length > 0) {
    await applyItineraryEditsAndLog(env, expense, itinerary_edits, user, comments);
  }
  if (removed_attachments && Array.isArray(removed_attachments)) {
    await processRemovedAttachments(env, removed_attachments);
  }
  const fallbackSettings = await env.DB.prepare("SELECT value FROM system_settings WHERE key = 'rejection_fallback_level'").first();
  const fallbackVal2 = fallbackSettings?.value || "creator";
  let nextStatus = "rejected";
  const statements = [
    {
      sql: "UPDATE approvals SET status = 'rejected', comments = ?, updated_at = ? WHERE id = ?",
      params: [comments, timestamp, activeApproval.id]
    }
  ];
  if (fallbackVal2 === "creator") {
    statements.push({
      sql: "UPDATE approvals SET status = 'cancelled', updated_at = ? WHERE expense_id = ? AND level_number > ? AND status = 'waiting'",
      params: [timestamp, expenseId, activeApproval.level_number]
    });
    nextStatus = "rejected";
  } else if (fallbackVal2 === "level_1") {
    statements.push({
      sql: "UPDATE approvals SET status = CASE WHEN level_number = 1 THEN 'pending' ELSE 'waiting' END, comments = CASE WHEN level_number = 1 THEN '' ELSE comments END, updated_at = ? WHERE expense_id = ?",
      params: [timestamp, expenseId]
    });
    nextStatus = "submitted_l1";
  } else if (fallbackVal2 === "previous_level") {
    if (activeApproval.level_number > 1) {
      const prevLvl = activeApproval.level_number - 1;
      statements.push({
        sql: "UPDATE approvals SET status = CASE WHEN level_number = ? THEN 'pending' WHEN level_number >= ? THEN 'waiting' ELSE status END, comments = CASE WHEN level_number = ? THEN '' ELSE comments END, updated_at = ? WHERE expense_id = ?",
        params: [prevLvl, activeApproval.level_number, prevLvl, timestamp, expenseId]
      });
      nextStatus = `submitted_l${prevLvl}`;
    } else {
      statements.push({
        sql: "UPDATE approvals SET status = 'cancelled', updated_at = ? WHERE expense_id = ? AND level_number > ? AND status = 'waiting'",
        params: [timestamp, expenseId, activeApproval.level_number]
      });
      nextStatus = "rejected";
    }
  }
  statements.push({
    sql: "UPDATE expenses SET status = ?, updated_at = ? WHERE id = ?",
    params: [nextStatus, timestamp, expenseId]
  });
  await runBatchWrite(env, statements);
  if (nextStatus !== "rejected") {
    const newPendingApp = await env.DB.prepare("SELECT * FROM approvals WHERE expense_id = ? AND status = 'pending'").bind(expenseId).first();
    if (newPendingApp) {
      const nextApproverUser = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(newPendingApp.approver_id).first();
      if (nextApproverUser) {
        await runWrite(env, "INSERT INTO notifications (user_id, title, description, type, read, link, created_at) VALUES (?, '\u{1F4E5} Claim Returned for Re-approval', ?, 'warning', 0, '/approval-center', ?)", [
          nextApproverUser.user_id,
          `Claim ${expense.expense_code} has been returned to you for re-approval after rejection at a higher level.`,
          timestamp
        ]);
      }
    }
  }
  const submitter = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(expense.user_id).first();
  if (submitter) {
    await runWrite(env, "INSERT INTO notifications (user_id, title, description, type, read, link, created_at) VALUES (?, ?, ?, ?, 0, ?, ?)", [
      submitter.user_id,
      "\u274C Expense Claim Rejected",
      `Your claim ${expense.expense_code} has been rejected by ${user.name}. Reason: ${comments.slice(0, 80)}`,
      "error",
      "/home",
      timestamp
    ]);
  }
  return jsonResponse2({ status: "success", message: "Expense claim has been rejected." });
}
__name(handleReject, "handleReject");
async function handleReturnToDraft(request, env, params, query, user) {
  const userRole = (user.role || "").trim();
  if (userRole !== "Coordinator" && userRole !== "Admin") {
    return jsonResponse2({ error: "Only Coordinators can return expenses to draft." }, 403);
  }
  const expenseId = parseInt(params.expense_id, 10);
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse2({ error: "Invalid JSON body" }, 400);
  }
  const { comments, client_timestamp, removed_attachments } = body;
  if (!comments || !comments.trim()) {
    return jsonResponse2({ error: "Comments/reason for returning is mandatory" }, 400);
  }
  const timestamp = client_timestamp || (/* @__PURE__ */ new Date()).toISOString();
  const activeApproval = await env.DB.prepare(`
    SELECT * FROM approvals WHERE expense_id = ? AND approver_id = ? AND status = 'pending'
  `).bind(expenseId, user.id).first();
  if (!activeApproval) {
    return jsonResponse2({ error: "No pending approval task found for you on this claim" }, 400);
  }
  const expense = await env.DB.prepare("SELECT * FROM expenses WHERE id = ?").bind(expenseId).first();
  if (!expense)
    return jsonResponse2({ error: "Expense claim not found" }, 404);
  if (expense.user_id === user.id) {
    return jsonResponse2({ error: "Cannot return your own expense claim" }, 400);
  }
  if (removed_attachments && Array.isArray(removed_attachments)) {
    await processRemovedAttachments(env, removed_attachments);
  }
  const statements = [
    {
      sql: "UPDATE approvals SET status = 'returned', comments = ?, updated_at = ? WHERE id = ?",
      params: [comments, timestamp, activeApproval.id]
    },
    {
      sql: "UPDATE approvals SET status = 'cancelled', updated_at = ? WHERE expense_id = ? AND id != ? AND status IN ('approved', 'waiting', 'pending')",
      params: [timestamp, expenseId, activeApproval.id]
    },
    {
      sql: "UPDATE expenses SET status = 'returned_to_draft', updated_at = ? WHERE id = ?",
      params: [timestamp, expenseId]
    }
  ];
  await runBatchWrite(env, statements);
  const submitter = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(expense.user_id).first();
  if (submitter) {
    await runWrite(env, "INSERT INTO notifications (user_id, title, description, type, read, link, created_at) VALUES (?, ?, ?, ?, 0, ?, ?)", [
      submitter.user_id,
      "\u{1F504} Claim Returned for Corrections",
      `Your claim ${expense.expense_code} has been returned by ${user.name} for corrections. Reason: ${comments.slice(0, 100)}`,
      "warning",
      "/submit-expense",
      timestamp
    ]);
  }
  return jsonResponse2({ status: "success", message: "Expense claim has been returned to draft for corrections." });
}
__name(handleReturnToDraft, "handleReturnToDraft");
async function processRemovedAttachments(env, removedAttachments) {
  if (!removedAttachments || !Array.isArray(removedAttachments) || removedAttachments.length === 0) {
    return;
  }
  for (const url of removedAttachments) {
    if (!url)
      continue;
    console.log("Removing attachment from DB:", url);
    await runWrite(env, "DELETE FROM expense_attachments WHERE file_url = ?", [url]);
    await deleteAttachmentFromStorage(env, url);
  }
}
__name(processRemovedAttachments, "processRemovedAttachments");
async function deleteAttachmentFromStorage(env, fileUrl) {
  try {
    if (!fileUrl)
      return;
    if (fileUrl.includes("/gdrive/")) {
      const fileId = fileUrl.split("/gdrive/").pop();
      if (fileId) {
        console.log("Deleting attachment from GDrive:", fileId);
        await deleteFromGoogleDrive(env, fileId);
      }
      return;
    }
    let key = "";
    if (fileUrl.includes("/file/")) {
      key = fileUrl.split("/file/").pop();
    } else {
      const match = fileUrl.match(/\/expense_attachments\/[^\/]+$/);
      if (match) {
        key = match[0].substring(1);
      }
    }
    if (key) {
      if (env.BUCKET && typeof env.BUCKET.delete === "function") {
        await env.BUCKET.delete(key);
        console.log("Deleted object from R2:", key);
      } else if (env.PRIMARY_CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_API_TOKEN) {
        const accountId = env.PRIMARY_CLOUDFLARE_ACCOUNT_ID;
        const apiToken = env.CLOUDFLARE_API_TOKEN;
        const bucketName = "fieldops-uploads";
        const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${bucketName}/objects/${key}`;
        await fetch(url, {
          method: "DELETE",
          headers: {
            "Authorization": `Bearer ${apiToken}`
          }
        });
        console.log("Deleted object from R2 via REST API:", key);
      }
    }
  } catch (e) {
    console.error("Failed to delete attachment from storage:", e.message);
  }
}
__name(deleteAttachmentFromStorage, "deleteAttachmentFromStorage");
async function handleAutoApprovalExpiry(env) {
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
  const settingsRows = await env.DB.prepare(
    "SELECT key, value FROM system_settings WHERE key IN ('pending_auto_expiry_days', 'pending_auto_action')"
  ).all();
  let expiryDays = null;
  let autoAction = null;
  for (const row of settingsRows.results || []) {
    if (row.key === "pending_auto_expiry_days")
      expiryDays = parseInt(row.value, 10);
    if (row.key === "pending_auto_action")
      autoAction = row.value;
  }
  if (expiryDays === null || expiryDays <= 0 || !autoAction) {
    return { success: true, message: "Auto-expiry settings disabled or not configured." };
  }
  const pendingApprovals = await env.DB.prepare(
    "SELECT a.*, e.expense_code, e.user_id as submitter_user_id FROM approvals a JOIN expenses e ON a.expense_id = e.id WHERE a.status = 'pending'"
  ).all();
  const results = [];
  for (const app of pendingApprovals.results || []) {
    const updatedAt = new Date(app.updated_at || app.created_at);
    const diffTime = (/* @__PURE__ */ new Date()).getTime() - updatedAt.getTime();
    const diffDays = diffTime / (1e3 * 60 * 60 * 24);
    if (diffDays >= expiryDays) {
      try {
        if (autoAction === "approve") {
          const allApprovals = await env.DB.prepare("SELECT * FROM approvals WHERE expense_id = ? ORDER BY level_number ASC").bind(app.expense_id).all();
          let nextApproval = null;
          for (const a of allApprovals.results || []) {
            if (a.level_number > app.level_number && a.status === "waiting") {
              nextApproval = a;
              break;
            }
          }
          let finalStatus = "approved";
          const statements = [
            {
              sql: "UPDATE approvals SET status = 'approved', comments = ?, updated_at = ? WHERE id = ?",
              params: [`System Auto-Approved after ${expiryDays} days`, timestamp, app.id]
            }
          ];
          if (nextApproval) {
            finalStatus = `submitted_l${nextApproval.level_number}`;
            statements.push({
              sql: "UPDATE approvals SET status = 'pending', created_at = ?, updated_at = ? WHERE id = ?",
              params: [timestamp, timestamp, nextApproval.id]
            });
          }
          statements.push({
            sql: "UPDATE expenses SET status = ?, updated_at = ? WHERE id = ?",
            params: [finalStatus, timestamp, app.expense_id]
          });
          await runBatchWrite(env, statements);
          const submitter = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(app.submitter_user_id).first();
          if (submitter) {
            if (finalStatus === "approved") {
              await runWrite(env, "INSERT INTO notifications (user_id, title, description, type, read, link, created_at) VALUES (?, '\u2705 Claim Auto-Approved', ?, 'success', 0, '/home', ?)", [
                submitter.user_id,
                `Your claim ${app.expense_code} has been auto-approved by the system.`,
                timestamp
              ]);
            } else {
              await runWrite(env, "INSERT INTO notifications (user_id, title, description, type, read, link, created_at) VALUES (?, '\u{1F504} Claim Auto-Forwarded', ?, 'info', 0, '/home', ?)", [
                submitter.user_id,
                `Your claim ${app.expense_code} has been auto-approved at Level ${app.level_number} and forwarded to the next level.`,
                timestamp
              ]);
            }
          }
          if (nextApproval) {
            const nextApproverUser = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(nextApproval.approver_id).first();
            if (nextApproverUser) {
              await runWrite(env, "INSERT INTO notifications (user_id, title, description, type, read, link, created_at) VALUES (?, '\u{1F4E5} Pending Auto-Approval', ?, 'warning', 0, '/approval-center', ?)", [
                nextApproverUser.user_id,
                `Claim ${app.expense_code} has been auto-forwarded to you for review.`,
                timestamp
              ]);
            }
          }
          results.push(`Auto-approved expense ${app.expense_id} at level ${app.level_number}`);
        } else if (autoAction === "reject") {
          const statements = [
            {
              sql: "UPDATE approvals SET status = 'rejected', comments = ?, updated_at = ? WHERE id = ?",
              params: [`This claim was automatically rejected by the system because your manager did not approve it within the required duration of ${expiryDays} days.`, timestamp, app.id]
            },
            {
              sql: "UPDATE approvals SET status = 'cancelled', updated_at = ? WHERE expense_id = ? AND level_number > ? AND status = 'waiting'",
              params: [timestamp, app.expense_id, app.level_number]
            },
            {
              sql: "UPDATE expenses SET status = 'rejected', updated_at = ? WHERE id = ?",
              params: [timestamp, app.expense_id]
            }
          ];
          await runBatchWrite(env, statements);
          const submitter = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(app.submitter_user_id).first();
          if (submitter) {
            await runWrite(env, "INSERT INTO notifications (user_id, title, description, type, read, link, created_at) VALUES (?, '\u274C Claim Auto-Rejected', ?, 'error', 0, '/home', ?)", [
              submitter.user_id,
              `Your claim ${app.expense_code} has been automatically rejected by the system because your manager did not approve it within the allowed time window.`,
              timestamp
            ]);
          }
          results.push(`Auto-rejected expense ${app.expense_id} at level ${app.level_number} (fallback: ${fallbackVal})`);
        }
      } catch (ex) {
        console.error(`Auto-expiry failed for approval ${app.id}:`, ex.message);
      }
    }
  }
  return { success: true, processed: results };
}
__name(handleAutoApprovalExpiry, "handleAutoApprovalExpiry");
async function handleBulkApprove(request, env, params, query, user) {
  const userRoleClean = (user.role || "").trim().toLowerCase();
  const allowedBulkRoles = ["coordinator", "project head"];
  if (!allowedBulkRoles.includes(userRoleClean)) {
    return jsonResponse2({
      error: "Forbidden: Bulk approval is restricted to Coordinator and Project Head roles only. Please review and approve claims individually."
    }, 403);
  }
  let body;
  try {
    body = await request.json();
  } catch (e) {
    body = {};
  }
  const { expense_ids, action_type, comments } = body;
  if (!Array.isArray(expense_ids) || expense_ids.length === 0) {
    return jsonResponse2({ error: "Invalid or empty expense_ids array" }, 400);
  }
  let successCount = 0;
  let failCount = 0;
  for (const expId of expense_ids) {
    try {
      const mockParams = { expense_id: String(expId) };
      const mockRequest = new Request(request.url, {
        method: "POST",
        headers: request.headers,
        body: JSON.stringify({
          comments: comments || "Bulk " + (action_type === "reject" ? "rejection" : "approval"),
          client_timestamp: (/* @__PURE__ */ new Date()).toISOString()
        })
      });
      let res;
      if (action_type === "reject") {
        res = await handleReject(mockRequest, env, mockParams, query, user);
      } else {
        res = await handleApprove(mockRequest, env, mockParams, query, user);
      }
      if (res && res.status >= 200 && res.status < 300) {
        successCount++;
      } else {
        failCount++;
      }
    } catch (err) {
      console.error(`Error processing bulk claim ID ${expId}:`, err);
      failCount++;
    }
  }
  return jsonResponse2({
    message: "Bulk operation completed",
    successCount,
    failCount
  });
}
__name(handleBulkApprove, "handleBulkApprove");

// src/routes/expense.js
function jsonResponse3(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
__name(jsonResponse3, "jsonResponse");
function getActualZone(zone, district) {
  const knownZones = ["Ajmer", "Bikaner", "Jaipur", "Jodhpur", "Udaipur"];
  const zoneMapping = {
    "Ajmer": ["ajmer", "beawer", "bhilwara", "nagaur", "tonk"],
    "Bikaner": ["bikaner", "churu", "ganganar", "ganganagar", "hanumangarh"],
    "Jaipur": ["jaipur"],
    "Jodhpur": ["barmer", "balotra", "jaisalmer", "jalore", "jodhpur", "pali", "phalodi", "sirohi"],
    "Udaipur": ["banswara", "chittorgarh", "dungarpur", "rajsamand", "pratapgarh", "udaipur"]
  };
  const zoneRaw = (zone || "").trim();
  const zoneStripped = zoneRaw.replace(/\s*zone\s*$/i, "").trim();
  for (const zName of knownZones) {
    if (zName.toLowerCase() === zoneStripped.toLowerCase())
      return zName;
  }
  const dClean = (district || "").trim().replace(/\s*zone\s*$/i, "").toLowerCase();
  for (const [zName, districts] of Object.entries(zoneMapping)) {
    if (districts.includes(dClean))
      return zName;
  }
  return zoneStripped || "";
}
__name(getActualZone, "getActualZone");
async function queryInChunks2(db, queryTemplate, ids, chunkSize = 50) {
  let allResults = [];
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const placeholders = chunk.map(() => "?").join(",");
    const sql2 = queryTemplate.replace("?", placeholders);
    const res = await db.prepare(sql2).bind(...chunk).all();
    if (res.results) {
      allResults = allResults.concat(res.results);
    }
  }
  return allResults;
}
__name(queryInChunks2, "queryInChunks");
var MARKET_WORDS = ["market", "bazaar", "bazar", "mandi", "haat"];
var STATION_WORDS = ["station", "railway", "bus stand", "bus stop", "bus depot", "bus adda", "rly"];
var DA_ALLOWED_BASES = ["pbm", "mathura das mathur", "mdm"];
var RESIDENCE_SKIP_WORDS = [...MARKET_WORDS, ...STATION_WORDS];
function matchesBase(locText, baseLocations2) {
  const text2 = (locText || "").trim().toLowerCase();
  if (!text2)
    return false;
  return baseLocations2.some((base) => {
    const cleanBase = base.trim().toLowerCase();
    if (text2 === cleanBase)
      return true;
    if (text2.includes(cleanBase) || cleanBase.includes(text2))
      return true;
    if (cleanBase.includes("mathura das mathur") || cleanBase.includes("mdm") || cleanBase.includes("jodhpur")) {
      if (text2.includes("mdm") || text2.includes("mathura das") || text2.includes("mathur"))
        return true;
      if (text2 === "jodhpur" || text2 === "jodhpur base" || text2 === "mdm hospital")
        return true;
    }
    if (cleanBase.includes("pbm") || cleanBase.includes("bikaner")) {
      if (text2.includes("pbm"))
        return true;
      if (text2 === "bikaner" || text2 === "bikaner base" || text2 === "pbm hospital")
        return true;
    }
    if (cleanBase.includes("jln") || cleanBase.includes("ajmer")) {
      if (text2.includes("jln"))
        return true;
      if (text2 === "ajmer" || text2 === "ajmer base" || text2 === "jln hospital")
        return true;
    }
    return false;
  });
}
__name(matchesBase, "matchesBase");
function computeBaseLocPolicy(baseReportingLocation, itineraries) {
  const baseLocations2 = (baseReportingLocation || "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
  if (baseLocations2.length === 0)
    return { isBaseLocOnly: false, isDaAllowed: true, baseLocations: [] };
  const hasOutdoorLeg = itineraries.some((leg) => (leg.travel_type || "").trim().toLowerCase() === "outdoor");
  if (hasOutdoorLeg) {
    return { isBaseLocOnly: false, isDaAllowed: true, baseLocations: baseLocations2 };
  }
  const hasVisitedBase = itineraries.some(
    (leg) => matchesBase(leg.from, baseLocations2) || matchesBase(leg.to, baseLocations2)
  );
  if (!hasVisitedBase)
    return { isBaseLocOnly: false, isDaAllowed: true, baseLocations: baseLocations2 };
  const RESIDENCE_WORDS_CHK = ["home", "residence", "room", "quarter", "house", "flat", "pg", "stay", "village", "vill", "rent", "address", "dera", "deri", "hotel"];
  const visitedNonBase = itineraries.some((leg) => {
    const f = (leg.from || "").trim().toLowerCase();
    const t = (leg.to || "").trim().toLowerCase();
    const fromIsResidenceText = RESIDENCE_WORDS_CHK.some((w) => f.includes(w));
    const toIsResidenceText = RESIDENCE_WORDS_CHK.some((w) => t.includes(w));
    if (!leg.from_custom && !matchesBase(f, baseLocations2) && !fromIsResidenceText)
      return true;
    if (!leg.to_custom && !matchesBase(t, baseLocations2) && !toIsResidenceText)
      return true;
    return false;
  });
  if (visitedNonBase)
    return { isBaseLocOnly: false, isDaAllowed: true, baseLocations: baseLocations2 };
  const hasStation = itineraries.some((leg) => {
    const f = (leg.from || "").trim().toLowerCase();
    const t = (leg.to || "").trim().toLowerCase();
    return STATION_WORDS.some((w) => f.includes(w) || t.includes(w));
  });
  const hasMarket = itineraries.some((leg) => {
    const f = (leg.from || "").trim().toLowerCase();
    const t = (leg.to || "").trim().toLowerCase();
    return MARKET_WORDS.some((w) => f.includes(w) || t.includes(w));
  });
  const isDaBase = baseLocations2.some((loc) => DA_ALLOWED_BASES.some((b) => loc.includes(b)));
  let isDaAllowed = false;
  if (hasStation) {
    isDaAllowed = false;
  } else if (isDaBase && !hasMarket) {
    isDaAllowed = true;
  }
  return { isBaseLocOnly: true, isDaAllowed, baseLocations: baseLocations2 };
}
__name(computeBaseLocPolicy, "computeBaseLocPolicy");
function checkIsCommuteLeg(leg, baseLocations2, index, totalLegs) {
  const f = (leg.from || "").trim().toLowerCase();
  const t = (leg.to || "").trim().toLowerCase();
  const RESIDENCE_WORDS = ["home", "residence", "room", "quarter", "house", "flat", "pg", "stay", "village", "vill", "rent", "address", "dera", "deri", "hotel"];
  const WORK_WORDS = ["market", "bazaar", "bazar", "mandi", "haat", "station", "railway", "bus stand", "bus stop", "bus depot", "bus adda", "rly", "tower", "office", "repair", "collection", "hospital", "chc", "phc", "dh", "sdh", "clinic", "lab", "store", "shop", "vendor", "customer", "site", "service", "work"];
  const fromHasResidenceWord = RESIDENCE_WORDS.some((w) => f.includes(w));
  const toHasResidenceWord = RESIDENCE_WORDS.some((w) => t.includes(w));
  const fromHasWorkWord = WORK_WORDS.some((w) => f.includes(w));
  const toHasWorkWord = WORK_WORDS.some((w) => t.includes(w));
  const isFirstLeg = index === 0;
  const isLastLeg = totalLegs !== void 0 && index !== void 0 ? index === totalLegs - 1 : false;
  const fromIsResidence = fromHasResidenceWord && !fromHasWorkWord || !!leg.from_custom && !fromHasWorkWord && (fromHasResidenceWord || isFirstLeg && !fromHasWorkWord) || isFirstLeg && !fromHasWorkWord && !matchesBase(f, baseLocations2) && f.length > 0;
  const toIsResidence = toHasResidenceWord && !toHasWorkWord || !!leg.to_custom && !toHasWorkWord && (toHasResidenceWord || isLastLeg && !toHasWorkWord) || isLastLeg && !toHasWorkWord && !matchesBase(t, baseLocations2) && t.length > 0;
  const fromIsBase = matchesBase(f, baseLocations2);
  const toIsBase = matchesBase(t, baseLocations2);
  if (fromIsResidence && fromIsBase)
    return false;
  if (toIsResidence && toIsBase)
    return false;
  if (fromIsResidence && toIsBase)
    return true;
  if (fromIsBase && toIsResidence)
    return true;
  return false;
}
__name(checkIsCommuteLeg, "checkIsCommuteLeg");
function buildPolicyComment(baseLocations2, itineraries, isDaAllowed, date) {
  const baseLabel = baseLocations2.map((b) => b.split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")).join(", ");
  const commutedLegs = itineraries.filter((leg, idx) => checkIsCommuteLeg(leg, baseLocations2, idx, itineraries.length));
  const taDeducted = commutedLegs.reduce((s, leg) => s + parseFloat(leg.amount || "0") + parseFloat(leg.sub_amount || "0"), 0);
  const daDeducted = !isDaAllowed ? itineraries.reduce((s, leg) => s + parseFloat(leg.da || "0"), 0) : 0;
  const parts = [];
  if (taDeducted > 0)
    parts.push(`Commute TA \u20B9${taDeducted.toFixed(0)} not eligible`);
  if (daDeducted > 0)
    parts.push(`DA \u20B9${daDeducted.toFixed(0)} not applicable at base location`);
  if (parts.length === 0)
    return "";
  return `[Policy] Base: ${baseLabel} \u2014 ${parts.join("; ")}. Applied: ${date}.`;
}
__name(buildPolicyComment, "buildPolicyComment");
async function serializeExpenses(env, expenses2, submittersMap) {
  if (!expenses2 || expenses2.length === 0)
    return [];
  const expenseCodes = expenses2.map((e) => e.expense_code).filter(Boolean);
  let allLegs = [];
  if (expenseCodes.length > 0) {
    allLegs = await queryInChunks2(env.DB, "SELECT * FROM expense_itineraries WHERE exp_id IN (?)", expenseCodes);
  }
  const legsByCode = {};
  for (const l of allLegs) {
    if (!legsByCode[l.exp_id])
      legsByCode[l.exp_id] = [];
    legsByCode[l.exp_id].push(l);
  }
  const result = [];
  for (const exp of expenses2) {
    const submitter = submittersMap[exp.user_id] || null;
    const legs = legsByCode[exp.expense_code] || [];
    const totCallsAssigned = legs.length > 0 ? legs.reduce((sum, l) => sum + (parseInt(l.calls_assigned) || 0), 0) : parseInt(exp.calls_assigned) || 0;
    const totCallsCompleted = legs.length > 0 ? legs.reduce((sum, l) => sum + (parseInt(l.calls_completed) || 0), 0) : parseInt(exp.calls_completed) || 0;
    const totPmsCount = legs.length > 0 ? legs.reduce((sum, l) => sum + (parseInt(l.pms_count) || 0), 0) : parseInt(exp.pms_count) || 0;
    const totAssetTagging = legs.length > 0 ? legs.reduce((sum, l) => sum + (parseInt(l.asset_tagging) || 0), 0) : parseInt(exp.asset_tagging) || 0;
    const totCalibrationCount = legs.length > 0 ? legs.reduce((sum, l) => sum + (parseInt(l.calibration_count) || 0), 0) : parseInt(exp.calibration_count) || 0;
    const totMobiliseCount = legs.length > 0 ? legs.reduce((sum, l) => sum + (parseInt(l.mobilise_count) || 0), 0) : parseInt(exp.mobilise_count) || 0;
    const totKm = legs.filter((l) => ["bike", "car"].includes((l.travel_mode || "").trim().toLowerCase())).reduce((sum, l) => sum + (parseFloat(l.distance_km) || 0), 0);
    const totAuto = legs.filter((l) => (l.travel_mode || "").trim().toLowerCase() === "auto").reduce((sum, l) => sum + (parseFloat(l.travel_amount) || 0), 0) + legs.filter((l) => (l.sub_mode || "").trim().toLowerCase() === "auto").reduce((sum, l) => sum + (parseFloat(l.sub_amount) || 0), 0);
    const bikeAmount = legs.filter((l) => (l.travel_mode || "").trim().toLowerCase() === "bike").reduce((sum, l) => sum + (parseFloat(l.travel_amount) || 0), 0);
    const carAmount = legs.filter((l) => (l.travel_mode || "").trim().toLowerCase() === "car").reduce((sum, l) => sum + (parseFloat(l.travel_amount) || 0), 0);
    result.push({
      id: exp.id,
      expense_code: exp.expense_code,
      user_id: exp.user_id,
      month: exp.month,
      year: exp.year,
      amount: parseFloat(exp.amount || 0),
      status: exp.status,
      travel_mode: exp.travel_mode,
      itinerary: exp.itinerary,
      description: exp.description || "",
      attachments: exp.attachments || "",
      da_amount: parseFloat(exp.da_amount || 0),
      hotel_amount: parseFloat(exp.hotel_amount || 0),
      other_expense_amount: parseFloat(exp.other_expense_amount || 0),
      local_purchase_amount: parseFloat(exp.local_purchase_amount || 0),
      calls_assigned: totCallsAssigned,
      calls_completed: totCallsCompleted,
      pms_count: totPmsCount,
      asset_tagging: totAssetTagging,
      calibration_count: totCalibrationCount,
      mobilise_count: totMobiliseCount,
      created_at: exp.created_at,
      updated_at: exp.updated_at,
      total_km: totKm,
      total_auto: totAuto,
      bike_amount: bikeAmount,
      car_amount: carAmount,
      auto_amount: totAuto,
      district: submitter?.district || "Ganganar",
      zone: getActualZone(submitter?.zone, submitter?.district) || submitter?.zone || "",
      submitter_name: submitter?.name || "",
      submitter_code: submitter?.user_id || exp.user_id || "",
      category: exp.category || exp.travel_mode || "Travel",
      date: exp.date || exp.itinerary || "",
      purpose: exp.purpose || exp.description || "",
      itineraries: legs.map((l) => ({
        leg: l.leg_number,
        from_district: l.from_district,
        to_district: l.to_district,
        from: l.from_location || "",
        to: l.to_location || "",
        mode: l.travel_mode,
        km: parseFloat(l.distance_km || 0),
        amount: parseFloat(l.travel_amount || 0),
        sub_mode: l.sub_mode,
        sub_amount: parseFloat(l.sub_amount || 0),
        da: parseFloat(l.da_amount || 0),
        hotel: parseFloat(l.hotel_amount || 0),
        local_purchase: parseFloat(l.local_purchase || 0),
        oth_desc: l.other_desc || "",
        oth_amount: parseFloat(l.other_amount || 0),
        visit_purpose: l.visit_purpose || "",
        activity_details: l.activity_details || ""
      })),
      legs: legs.map((l) => ({
        leg: l.leg_number,
        from_district: l.from_district,
        to_district: l.to_district,
        from: l.from_location || "",
        to: l.to_location || "",
        mode: l.travel_mode,
        km: parseFloat(l.distance_km || 0),
        amount: parseFloat(l.travel_amount || 0),
        sub_mode: l.sub_mode,
        sub_amount: parseFloat(l.sub_amount || 0),
        da: parseFloat(l.da_amount || 0),
        hotel: parseFloat(l.hotel_amount || 0),
        local_purchase: parseFloat(l.local_purchase || 0),
        other_desc: l.other_desc || "",
        other_amount: parseFloat(l.other_amount || 0),
        visit_purpose: l.visit_purpose || "",
        activity_details: l.activity_details || ""
      }))
    });
  }
  return result;
}
__name(serializeExpenses, "serializeExpenses");
async function handleListExpenses(request, env, params, query, user) {
  const month = query.get("month");
  let querySql = "SELECT * FROM expenses WHERE user_id = ?";
  const binds = [user.id];
  if (month && month.toLowerCase() !== "all" && month.toLowerCase() !== "all_time") {
    if (month.includes("-") && month.length === 7) {
      const parts = month.split("-");
      const yr = parseInt(parts[0], 10);
      const monNum = parseInt(parts[1], 10);
      const monName = MONTH_NAMES[monNum - 1];
      querySql += " AND year = ? AND month = ?";
      binds.push(yr, monName);
    } else {
      querySql += " AND LOWER(month) LIKE ?";
      binds.push(`%${month.toLowerCase()}%`);
    }
  }
  querySql += " ORDER BY created_at DESC";
  const expensesRows = await env.DB.prepare(querySql).bind(...binds).all();
  const submittersMap = { [user.id]: user };
  const serialized = await serializeExpenses(env, expensesRows.results || [], submittersMap);
  return jsonResponse3(serialized);
}
__name(handleListExpenses, "handleListExpenses");
async function getExpenseInitData(env, targetUser, monthStr) {
  const parts = monthStr.split("-");
  const yearVal = parseInt(parts[0], 10);
  const monthInt = parseInt(parts[1], 10);
  const monthName = MONTH_NAMES[monthInt - 1];
  const gradeToLookup = (targetUser.designation || "").toLowerCase().includes("specialist") ? "O1" : targetUser.grade;
  const [
    facilitiesRows,
    submittedRows,
    limits,
    limitReqs,
    allowance,
    defaultBike,
    defaultCar,
    statsRes
  ] = await Promise.all([
    env.DB.prepare(`SELECT DISTINCT district_name, facility_name FROM facility_details`).all(),
    env.DB.prepare(
      `SELECT itinerary FROM expenses WHERE user_id = ? AND month = ? AND year = ?`
    ).bind(targetUser.id, monthName, yearVal).all(),
    env.DB.prepare(`
      SELECT 
        SUM(CASE WHEN request_type = 'KM' THEN COALESCE(approved_value, requested_value) ELSE 0.0 END) as approved_km,
        SUM(CASE WHEN request_type = 'AUTO' THEN COALESCE(approved_value, requested_value) ELSE 0.0 END) as approved_auto
      FROM limit_approval_requests
      WHERE user_id = ? AND LOWER(status) = 'approved' AND for_month = ?
    `).bind(targetUser.user_id, monthStr).first(),
    env.DB.prepare(
      `SELECT * FROM limit_approval_requests WHERE user_id = ? AND for_month = ?`
    ).bind(targetUser.user_id, monthStr).all(),
    env.DB.prepare(`SELECT * FROM allowance_master WHERE grade = ?`).bind(gradeToLookup).first(),
    env.DB.prepare(`SELECT rate_per_km FROM allowance_master WHERE vehicle_type = 'Bike' LIMIT 1`).first(),
    env.DB.prepare(`SELECT rate_per_km FROM allowance_master WHERE vehicle_type = 'Car' LIMIT 1`).first(),
    env.DB.prepare(`
      SELECT 
        SUM(CASE WHEN LOWER(TRIM(i.travel_mode)) IN ('bike', 'car') THEN COALESCE(i.distance_km, 0.0) ELSE 0.0 END) as total_km,
        SUM(CASE WHEN LOWER(TRIM(i.travel_mode)) = 'auto' THEN COALESCE(i.travel_amount, 0.0) ELSE 0.0 END) +
        SUM(CASE WHEN LOWER(TRIM(i.sub_mode)) = 'auto' THEN COALESCE(i.sub_amount, 0.0) ELSE 0.0 END) as total_auto
      FROM expense_itineraries i
      JOIN expenses e ON i.exp_id = e.expense_code
      WHERE e.user_id = ? AND e.month = ? AND e.year = ? AND e.status NOT IN ('rejected', 'returned_to_draft')
    `).bind(targetUser.id, monthName, yearVal).first()
  ]);
  const facilities = {};
  for (const f of facilitiesRows.results || []) {
    if (!facilities[f.district_name])
      facilities[f.district_name] = [];
    facilities[f.district_name].push(f.facility_name);
  }
  const submittedDates = (submittedRows.results || []).map((r) => r.itinerary).filter(Boolean);
  const approvedKm = limits?.approved_km || 0;
  const approvedAuto = limits?.approved_auto || 0;
  const kmReqs = (limitReqs.results || []).filter((r) => r.request_type === "KM").sort((a, b) => b.id - a.id);
  const autoReqs = (limitReqs.results || []).filter((r) => r.request_type === "AUTO").sort((a, b) => b.id - a.id);
  const existingKmReq = kmReqs.length > 0 ? { status: kmReqs[0].status, requested_value: kmReqs[0].requested_value } : null;
  const existingAutoReq = autoReqs.length > 0 ? { status: autoReqs[0].status, requested_value: autoReqs[0].requested_value } : null;
  const fallbackBikeRate = defaultBike?.rate_per_km || 4.5;
  const fallbackCarRate = defaultCar?.rate_per_km || 9;
  let allowanceDict = {
    daily_in_district: allowance?.daily_in_district ?? 150,
    daily_out_district: allowance?.daily_out_district ?? 200,
    daily_hotel: allowance?.daily_hotel ?? 300,
    daily_out_state: allowance?.daily_out_state ?? 400,
    hotel_in_state_s: allowance?.hotel_in_state_s ?? 1e3,
    hotel_out_state_s: allowance?.hotel_out_state_s ?? 2e3,
    max_km_per_month: allowance?.max_km_per_month ?? 2e3,
    rate_bike: allowance?.vehicle_type === "Bike" ? allowance?.rate_per_km : fallbackBikeRate,
    rate_car: allowance?.vehicle_type === "Car" ? allowance?.rate_per_km : fallbackCarRate,
    vehicle_type: allowance?.vehicle_type ?? "Bike"
  };
  allowanceDict.current_month_km = statsRes?.total_km || 0;
  allowanceDict.current_month_auto = statsRes?.total_auto || 0;
  allowanceDict.max_auto_per_month = 1e3;
  const mm = String(monthInt).padStart(2, "0");
  const yy = String(yearVal).substring(2);
  return {
    success: true,
    user: {
      full_name: targetUser.name,
      e_code: targetUser.user_id,
      grade: targetUser.grade,
      home_district: targetUser.district || "Jodhpur",
      level_first_approver: targetUser.manager || "Admin",
      level_second_approver: targetUser.zonal_manager || "Admin"
    },
    allowance: allowanceDict,
    facilities,
    submitted_dates: submittedDates,
    approved_km: approvedKm,
    approved_auto: approvedAuto,
    existing_km_req: existingKmReq,
    existing_auto_req: existingAutoReq,
    next_exp_id: `RJ-${mm}/${yy}-PENDING`
  };
}
__name(getExpenseInitData, "getExpenseInitData");
async function handleExpenseInit(request, env, params, query, user) {
  const targetUserId = query.get("user_id") || user.user_id;
  const monthStr = query.get("month");
  if (!monthStr)
    return jsonResponse3({ error: "month parameter is required" }, 400);
  const targetUser = await env.DB.prepare("SELECT * FROM users WHERE user_id = ?").bind(targetUserId).first();
  if (!targetUser)
    return jsonResponse3({ error: "User not found" }, 404);
  const data = await getExpenseInitData(env, targetUser, monthStr);
  return jsonResponse3(data);
}
__name(handleExpenseInit, "handleExpenseInit");
async function handleCreateLimitRequest(request, env, params, query, user) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse3({ error: "Invalid JSON body" }, 400);
  }
  const { user_id, type, amount, month } = body;
  if (!user_id || !type || !amount || !month) {
    return jsonResponse3({ error: "Missing required parameters: user_id, type, amount, month" }, 400);
  }
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
  const requester = await env.DB.prepare("SELECT * FROM users WHERE user_id = ?").bind(user_id).first();
  if (!requester)
    return jsonResponse3({ error: "Requester not found" }, 404);
  const managerName = requester.manager || requester.zonal_manager || requester.coordinator;
  let managerId = "Admin";
  if (managerName && managerName !== "None") {
    const mgrUser = await env.DB.prepare("SELECT user_id FROM users WHERE LOWER(TRIM(name)) = ?").bind(managerName.trim().toLowerCase()).first();
    if (mgrUser) {
      managerId = mgrUser.user_id;
    }
  }
  await runWrite(env, `
    INSERT INTO limit_approval_requests (user_id, request_type, requested_value, status, for_month, manager_id, created_at, updated_at)
    VALUES (?, ?, ?, 'Pending', ?, ?, ?, ?)
  `, [user_id, type, amount, month, managerId, timestamp, timestamp]);
  await runWrite(env, `
    INSERT INTO notifications (user_id, title, description, type, read, link, created_at)
    VALUES (?, '\u{1F4E5} New Limit Request', ?, 'warning', 0, '/approval-center', ?)
  `, [
    managerId,
    `${requester.name} has requested extra ${amount} ${type} limit for ${month}.`,
    timestamp
  ]);
  return jsonResponse3({ status: "success", message: "Limit request raised successfully." });
}
__name(handleCreateLimitRequest, "handleCreateLimitRequest");
async function handleGetTeamExpenses(request, env, params, query, user) {
  try {
    const month = query.get("month");
    console.log("DEBUG: handleGetTeamExpenses user =", JSON.stringify(user));
    const allowedWindows = user.allowed_windows ? user.allowed_windows.split(",").map((w) => w.trim().toLowerCase()) : [];
    let teamUsers = [];
    const userRoleClean = (user.role || "").trim().toLowerCase();
    const isAdminOrReportViewer = ["admin", "mis", "vp", "accountant", "hr", "project head", "travel desk", "travel tesk"].includes(userRoleClean);
    if (isAdminOrReportViewer) {
      const res = await env.DB.prepare("SELECT * FROM users").all();
      teamUsers = res.results || [];
      console.log("DEBUG: fetched all users, count =", teamUsers.length);
    } else {
      const nameClean = (user.name || "").trim();
      const uidClean = (user.user_id || "").trim();
      const directReportsRes = await env.DB.prepare(`
        SELECT * FROM users
        WHERE LOWER(TRIM(manager)) = ? OR LOWER(TRIM(manager)) = ?
           OR LOWER(TRIM(coordinator)) = ? OR LOWER(TRIM(coordinator)) = ?
           OR LOWER(TRIM(zonal_manager)) = ? OR LOWER(TRIM(zonal_manager)) = ?
      `).bind(nameClean.toLowerCase(), uidClean.toLowerCase(), nameClean.toLowerCase(), uidClean.toLowerCase(), nameClean.toLowerCase(), uidClean.toLowerCase()).all();
      const directReports = directReportsRes.results || [];
      const hierarchyApprovals = await env.DB.prepare(`
        SELECT hierarchy_id FROM hierarchy_approvers WHERE approver_id = ?
      `).bind(user.id).all();
      let hierarchyReports = [];
      if (hierarchyApprovals.results && hierarchyApprovals.results.length > 0) {
        const hIds = hierarchyApprovals.results.map((h) => h.hierarchy_id);
        const placeholders = hIds.map(() => "?").join(",");
        const reqsRes = await env.DB.prepare(`
          SELECT u.* FROM users u
          JOIN hierarchy_requesters hr ON u.id = hr.user_id
          WHERE hr.hierarchy_id IN (${placeholders})
        `).bind(...hIds).all();
        hierarchyReports = reqsRes.results || [];
      }
      const reportsMap = {};
      for (const u of [...directReports, ...hierarchyReports]) {
        reportsMap[u.id] = u;
      }
      teamUsers = Object.values(reportsMap);
    }
    if (teamUsers.length === 0)
      return jsonResponse3([]);
    const teamUserIds = isAdminOrReportViewer ? teamUsers.map((u) => u.id) : teamUsers.map((u) => u.id).filter((id) => id !== user.id);
    console.log("DEBUG: teamUserIds =", JSON.stringify(teamUserIds));
    if (teamUserIds.length === 0)
      return jsonResponse3([]);
    const submittersById = {};
    for (const u of teamUsers) {
      if (u.id)
        submittersById[String(u.id)] = u;
      if (u.user_id)
        submittersById[String(u.user_id)] = u;
      if (u.userId)
        submittersById[String(u.userId)] = u;
    }
    let querySql = "";
    let binds = [];
    if (isAdminOrReportViewer) {
      querySql = "SELECT * FROM expenses WHERE 1=1";
      if (!month) {
        const now = /* @__PURE__ */ new Date();
        querySql += " AND year = ? AND month = ?";
        binds.push(now.getFullYear(), MONTH_NAMES[now.getMonth()]);
      }
    } else {
      const placeholders = teamUserIds.map(() => "?").join(",");
      querySql = `SELECT * FROM expenses WHERE user_id IN (${placeholders})`;
      binds = [...teamUserIds];
    }
    if (month) {
      if (month.includes("-") && month.length === 7) {
        const parts = month.split("-");
        const yr = parseInt(parts[0], 10);
        const monNum = parseInt(parts[1], 10);
        const monName = MONTH_NAMES[monNum - 1];
        querySql += " AND year = ? AND month = ?";
        binds.push(yr, monName);
      } else {
        querySql += " AND LOWER(month) LIKE ?";
        binds.push(`%${month.toLowerCase()}%`);
      }
    } else if (!isAdminOrReportViewer) {
      const now = /* @__PURE__ */ new Date();
      querySql += " AND year = ? AND month = ?";
      binds.push(now.getFullYear(), MONTH_NAMES[now.getMonth()]);
    }
    querySql += " ORDER BY created_at DESC";
    console.log("DEBUG: querySql =", querySql, "binds =", JSON.stringify(binds));
    const expensesRows = await env.DB.prepare(querySql).bind(...binds).all();
    const expenses2 = expensesRows.results || [];
    console.log("DEBUG: fetched expenses count =", expenses2.length);
    const result = [];
    if (expenses2.length > 0) {
      const expenseCodes = expenses2.map((e) => e.expense_code).filter(Boolean);
      let allLegs = [];
      if (expenseCodes.length > 0) {
        allLegs = await queryInChunks2(env.DB, "SELECT * FROM expense_itineraries WHERE exp_id IN (?)", expenseCodes);
      }
      const legsByCode = {};
      for (const l of allLegs) {
        if (!legsByCode[l.exp_id])
          legsByCode[l.exp_id] = [];
        legsByCode[l.exp_id].push(l);
      }
      for (const exp of expenses2) {
        const submitter = submittersById[exp.user_id] || submittersById[String(exp.user_id)] || null;
        const legs = legsByCode[exp.expense_code] || [];
        const totKm = legs.filter((l) => ["bike", "car"].includes((l.travel_mode || "").trim().toLowerCase())).reduce((sum, l) => sum + (parseFloat(l.distance_km) || 0), 0);
        const totAuto = legs.filter((l) => (l.travel_mode || "").trim().toLowerCase() === "auto").reduce((sum, l) => sum + (parseFloat(l.travel_amount) || 0), 0) + legs.filter((l) => (l.sub_mode || "").trim().toLowerCase() === "auto").reduce((sum, l) => sum + (parseFloat(l.sub_amount) || 0), 0);
        const bikeAmount = legs.filter((l) => (l.travel_mode || "").trim().toLowerCase() === "bike").reduce((sum, l) => sum + (parseFloat(l.travel_amount) || 0), 0);
        const carAmount = legs.filter((l) => (l.travel_mode || "").trim().toLowerCase() === "car").reduce((sum, l) => sum + (parseFloat(l.travel_amount) || 0), 0);
        const totCallsAssigned = legs.length > 0 ? legs.reduce((sum, l) => sum + (parseInt(l.calls_assigned) || 0), 0) : parseInt(exp.calls_assigned) || 0;
        const totCallsCompleted = legs.length > 0 ? legs.reduce((sum, l) => sum + (parseInt(l.calls_completed) || 0), 0) : parseInt(exp.calls_completed) || 0;
        const totPmsCount = legs.length > 0 ? legs.reduce((sum, l) => sum + (parseInt(l.pms_count) || 0), 0) : parseInt(exp.pms_count) || 0;
        const totAssetTagging = legs.length > 0 ? legs.reduce((sum, l) => sum + (parseInt(l.asset_tagging) || 0), 0) : parseInt(exp.asset_tagging) || 0;
        const totCalibrationCount = legs.length > 0 ? legs.reduce((sum, l) => sum + (parseInt(l.calibration_count) || 0), 0) : parseInt(exp.calibration_count) || 0;
        const totMobiliseCount = legs.length > 0 ? legs.reduce((sum, l) => sum + (parseInt(l.mobilise_count) || 0), 0) : parseInt(exp.mobilise_count) || 0;
        const sName = submitter?.name || submitter?.submitter_name || "Unknown";
        const sCode = submitter?.user_id || submitter?.userId || submitter?.submitter_code || "N/A";
        const sDesignation = submitter?.designation || submitter?.submitter_designation || "Engineer";
        const sDistrict = submitter?.district || exp.district || "Ganganar";
        const sZone = getActualZone(submitter?.zone, sDistrict) || getActualZone(exp.zone, sDistrict) || "Unassigned Zone";
        result.push({
          id: exp.id,
          expense_code: exp.expense_code,
          submitter_name: sName,
          submitter_code: sCode,
          submitter_designation: sDesignation,
          month: exp.month,
          year: exp.year,
          amount: parseFloat(exp.amount || 0),
          status: exp.status,
          category: exp.travel_mode,
          date: exp.itinerary,
          purpose: exp.description || "",
          created_at: exp.created_at,
          total_km: totKm,
          total_auto: totAuto,
          bike_amount: bikeAmount,
          car_amount: carAmount,
          auto_amount: totAuto,
          da_amount: parseFloat(exp.da_amount || 0),
          hotel_amount: parseFloat(exp.hotel_amount || 0),
          other_expense_amount: parseFloat(exp.other_expense_amount || 0),
          local_purchase_amount: parseFloat(exp.local_purchase_amount || 0),
          district: sDistrict,
          zone: sZone,
          calls_assigned: totCallsAssigned,
          calls_completed: totCallsCompleted,
          pms_count: totPmsCount,
          asset_tagging: totAssetTagging,
          calibration_count: totCalibrationCount,
          mobilise_count: totMobiliseCount
        });
      }
    }
    const teamUserCodes = isAdminOrReportViewer ? teamUsers.map((u) => u.user_id) : teamUsers.map((u) => u.user_id).filter((uc) => uc !== user.user_id);
    if (teamUserCodes.length > 0) {
      const codePlaceholders = teamUserCodes.map(() => "?").join(",");
      const limitReqsRes = await env.DB.prepare(`
      SELECT * FROM limit_approval_requests WHERE user_id IN (${codePlaceholders})
    `).bind(...teamUserCodes).all();
      for (const pl of limitReqsRes.results || []) {
        const submitter = teamUsers.find((u) => u.user_id === pl.user_id);
        if (!submitter)
          continue;
        let monthName = "N/A";
        let yearVal = (/* @__PURE__ */ new Date()).getFullYear();
        if (pl.for_month && pl.for_month.includes("-")) {
          try {
            const parts = pl.for_month.split("-");
            yearVal = parseInt(parts[0], 10);
            const monNum = parseInt(parts[1], 10);
            monthName = MONTH_NAMES[monNum - 1];
          } catch (e) {
          }
        }
        const reqDate = pl.created_at ? pl.created_at.substring(0, 10) : pl.for_month;
        result.push({
          id: -pl.id,
          expense_code: `LIMIT-${pl.request_type}-${pl.id}`,
          submitter_name: submitter.name,
          submitter_code: pl.user_id,
          submitter_designation: submitter.designation || "Engineer",
          month: monthName,
          year: yearVal,
          amount: pl.request_type === "AUTO" ? parseFloat(pl.requested_value || 0) : 0,
          status: pl.status.toLowerCase(),
          category: "Limit Request",
          travel_mode: pl.request_type,
          date: reqDate,
          purpose: `Limit Extension Request: +${parseFloat(pl.requested_value || 0).toFixed(1)} ${pl.request_type}`,
          created_at: pl.created_at,
          total_km: pl.request_type === "KM" ? parseFloat(pl.requested_value || 0) : 0,
          total_auto: pl.request_type === "AUTO" ? parseFloat(pl.requested_value || 0) : 0,
          bike_amount: 0,
          car_amount: 0,
          auto_amount: pl.request_type === "AUTO" ? parseFloat(pl.requested_value || 0) : 0,
          da_amount: 0,
          hotel_amount: 0,
          other_expense_amount: 0,
          local_purchase_amount: 0,
          district: submitter.district || "Ganganar",
          zone: getActualZone(submitter.zone, submitter.district || "Ganganar")
        });
      }
    }
    result.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    return jsonResponse3(result);
  } catch (err) {
    console.error("ERROR in handleGetTeamExpenses:", err.message, err.stack);
    return jsonResponse3({ error: "Internal Server Error", detail: err.message, stack: err.stack }, 500);
  }
}
__name(handleGetTeamExpenses, "handleGetTeamExpenses");
async function handleVerifyBarcode(request, env, params, query, user) {
  const barcode = query.get("barcode");
  if (!barcode)
    return jsonResponse3({ error: "barcode parameter is required" }, 400);
  const hospital = query.get("hospital");
  const barcode8 = barcode.length >= 8 ? barcode.slice(-8) : barcode;
  if (hospital) {
    const queryResult = await runRead(env, `
      SELECT * FROM assets_inventory 
      WHERE (LOWER(SUBSTR(qr_code, -8)) = LOWER(?) 
         OR LOWER(SUBSTR(serial_no, -8)) = LOWER(?) 
         OR LOWER(qr_code) = LOWER(?) 
         OR LOWER(serial_no) = LOWER(?))
         AND LOWER(TRIM(hospital_name)) = LOWER(TRIM(?))
      LIMIT 1
    `, [barcode8, barcode8, barcode, barcode, hospital], request);
    const asset = queryResult && queryResult.results && queryResult.results[0] ? queryResult.results[0] : null;
    if (asset) {
      return jsonResponse3({
        success: true,
        valid: true,
        asset_name: asset.equipment_name,
        hospital_name: asset.hospital_name,
        district_name: asset.district_name,
        serial_no: asset.serial_no,
        data: {
          district_name: asset.district_name,
          hospital_name: asset.hospital_name,
          equipment_name: asset.equipment_name,
          model_name: asset.model_name || "",
          qr_code: asset.qr_code,
          inventory_status: asset.inventory_status || "Active"
        }
      });
    }
    const queryAnyResult = await runRead(env, `
      SELECT hospital_name FROM assets_inventory 
      WHERE LOWER(SUBSTR(qr_code, -8)) = LOWER(?) 
         OR LOWER(SUBSTR(serial_no, -8)) = LOWER(?) 
         OR LOWER(qr_code) = LOWER(?) 
         OR LOWER(serial_no) = LOWER(?) 
      LIMIT 1
    `, [barcode8, barcode8, barcode, barcode], request);
    const anyAsset = queryAnyResult && queryAnyResult.results && queryAnyResult.results[0] ? queryAnyResult.results[0] : null;
    if (anyAsset) {
      return jsonResponse3({ success: false, valid: false, message: "This barcode was not fetched for this hospital." });
    } else {
      return jsonResponse3({ success: false, valid: false, message: "Asset QR/Serial number not found in master database." });
    }
  } else {
    const queryResult = await runRead(env, `
      SELECT * FROM assets_inventory 
      WHERE LOWER(SUBSTR(qr_code, -8)) = LOWER(?) 
         OR LOWER(SUBSTR(serial_no, -8)) = LOWER(?) 
         OR LOWER(qr_code) = LOWER(?) 
         OR LOWER(serial_no) = LOWER(?) 
      LIMIT 1
    `, [barcode8, barcode8, barcode, barcode], request);
    const asset = queryResult && queryResult.results && queryResult.results[0] ? queryResult.results[0] : null;
    if (!asset) {
      return jsonResponse3({ success: false, valid: false, message: "Asset QR/Serial number not found in master database." });
    }
    return jsonResponse3({
      success: true,
      valid: true,
      asset_name: asset.equipment_name,
      hospital_name: asset.hospital_name,
      district_name: asset.district_name,
      serial_no: asset.serial_no,
      data: {
        district_name: asset.district_name,
        hospital_name: asset.hospital_name,
        equipment_name: asset.equipment_name,
        model_name: asset.model_name || "",
        qr_code: asset.qr_code,
        inventory_status: asset.inventory_status || "Active"
      }
    });
  }
}
__name(handleVerifyBarcode, "handleVerifyBarcode");
async function handleGetAssetValueMaster(request, env, params, query, user) {
  try {
    const result = await env.DB.prepare(`
      SELECT DISTINCT equipment_name, CAST(rmsc_tender_cost AS REAL) as asset_value, CAST(rmsc_tender_cost AS REAL) as rmsc_tender_cost 
      FROM asset_value_master 
      ORDER BY equipment_name ASC
    `).all();
    if (result.results && result.results.length > 0) {
      return jsonResponse3(result.results);
    }
  } catch (e) {
    console.warn("Failed to query asset_value_master table, falling back to assets_inventory:", e.message);
  }
  try {
    const result = await env.DB.prepare(`
      SELECT DISTINCT equipment_name, CAST(parsed_asset_value AS REAL) as asset_value, CAST(parsed_asset_value AS REAL) as rmsc_tender_cost 
      FROM assets_inventory 
      WHERE parsed_asset_value IS NOT NULL AND parsed_asset_value > 0
      ORDER BY equipment_name ASC
    `).all();
    return jsonResponse3(result.results || []);
  } catch (e) {
    console.warn("Failed to query parsed_asset_value, falling back to asset_value replacement casting:", e.message);
    try {
      const result = await env.DB.prepare(`
        SELECT DISTINCT equipment_name, 
               CAST(REPLACE(REPLACE(asset_value, ',', ''), '\u20B9', '') AS REAL) as asset_value,
               CAST(REPLACE(REPLACE(asset_value, ',', ''), '\u20B9', '') AS REAL) as rmsc_tender_cost 
        FROM assets_inventory 
        WHERE asset_value IS NOT NULL AND asset_value != '' AND asset_value != '0'
        ORDER BY equipment_name ASC
      `).all();
      return jsonResponse3(result.results || []);
    } catch (err) {
      console.error("All asset master queries failed:", err.message);
      return jsonResponse3([]);
    }
  }
}
__name(handleGetAssetValueMaster, "handleGetAssetValueMaster");
async function getUserMonthlyStatsHelper(env, userDbId, month, year, excludeDate = null) {
  let monthStr = String(month).trim();
  let yearVal = year ? parseInt(year, 10) : null;
  if (monthStr.includes("-")) {
    const parts = monthStr.split("-");
    if (parts.length >= 2) {
      try {
        const y = parseInt(parts[0], 10);
        const mNum = parseInt(parts[1], 10);
        monthStr = MONTH_NAMES[mNum - 1];
        yearVal = y;
      } catch (e) {
      }
    }
  } else if (/^\d+$/.test(monthStr)) {
    try {
      const mNum = parseInt(monthStr, 10);
      monthStr = MONTH_NAMES[mNum - 1];
    } catch (e) {
    }
  } else {
    monthStr = monthStr.charAt(0).toUpperCase() + monthStr.slice(1).toLowerCase();
  }
  let querySql = `
    SELECT * FROM expenses 
    WHERE user_id = ? AND month = ? AND year = ? AND LOWER(status) NOT IN ('draft', 'rejected', 'returned_to_draft')
  `;
  const binds = [userDbId, monthStr, yearVal];
  if (excludeDate) {
    querySql += " AND itinerary < ?";
    binds.push(excludeDate);
  }
  const res = await env.DB.prepare(querySql).bind(...binds).all();
  const expenses2 = res.results || [];
  const approvedExpCodes = expenses2.filter((e) => e.expense_code && e.status && ["approved", "partially_approved"].includes(e.status.trim().toLowerCase())).map((e) => e.expense_code);
  const allExpCodes = expenses2.filter((e) => e.expense_code).map((e) => e.expense_code);
  let approvedLegs = [];
  if (approvedExpCodes.length > 0) {
    const placeholders = approvedExpCodes.map(() => "?").join(",");
    const legsRes = await env.DB.prepare(`
      SELECT * FROM expense_itineraries WHERE exp_id IN (${placeholders})
    `).bind(...approvedExpCodes).all();
    approvedLegs = legsRes.results || [];
  }
  let allLegs = [];
  if (allExpCodes.length > 0) {
    const placeholders = allExpCodes.map(() => "?").join(",");
    const legsRes = await env.DB.prepare(`
      SELECT * FROM expense_itineraries WHERE exp_id IN (${placeholders})
    `).bind(...allExpCodes).all();
    allLegs = legsRes.results || [];
  }
  function getLegStats(leg) {
    let legCalls = leg.calls_completed || 0;
    let legPms = leg.pms_count || 0;
    let legAsset = leg.asset_tagging || 0;
    let legMobilise = leg.mobilise_count || 0;
    let legCalibration = leg.calibration_count || 0;
    if (leg.activity_details) {
      try {
        const act = JSON.parse(leg.activity_details);
        if (act && typeof act === "object") {
          const selectedActs = act.selected_activities || [];
          if (selectedActs.includes("Calls")) {
            const list = act.calls_list || [];
            legCalls = list.filter((c) => c && typeof c === "object" && c.barcode).length;
          }
          if (selectedActs.includes("PMS")) {
            const list = act.pms_list || [];
            legPms = list.filter((p) => p && typeof p === "object" && p.barcode).length;
          }
          if (selectedActs.includes("Asset Tagging")) {
            const list = act.assets_list || [];
            let sumQty = 0;
            for (const item of list) {
              if (item && typeof item === "object") {
                sumQty += parseInt(item.quantity || 0, 10) || 0;
              }
            }
            legAsset = sumQty;
          }
          if (act.mobilise_asset_count !== void 0) {
            legMobilise = parseInt(act.mobilise_asset_count, 10) || 0;
          }
          if (act.calibration_count !== void 0) {
            legCalibration = parseInt(act.calibration_count, 10) || 0;
          }
        }
      } catch (e) {
      }
    }
    return [legCalls, legPms, legAsset, legMobilise, legCalibration];
  }
  __name(getLegStats, "getLegStats");
  let approvedDa = 0;
  let approvedBikeKm = 0;
  let approvedAuto = 0;
  let approvedBus = 0;
  let approvedTrain = 0;
  let approvedHotel = 0;
  let approvedLocalPurchase = 0;
  let approvedKmUsed = 0;
  let approvedCalls = 0;
  let approvedPms = 0;
  let approvedAsset = 0;
  let approvedMobilise = 0;
  let approvedCalibration = 0;
  for (const leg of approvedLegs) {
    approvedDa += parseFloat(leg.da_amount || 0);
    approvedHotel += parseFloat(leg.hotel_amount || 0);
    approvedLocalPurchase += parseFloat(leg.local_purchase || 0);
    const mode = (leg.travel_mode || "").trim().toLowerCase();
    if (mode === "bike") {
      approvedBikeKm += parseFloat(leg.distance_km || 0);
      approvedKmUsed += parseFloat(leg.distance_km || 0);
    } else if (mode === "car") {
      approvedKmUsed += parseFloat(leg.distance_km || 0);
    } else if (mode === "auto") {
      approvedAuto += parseFloat(leg.travel_amount || 0);
    } else if (mode === "bus") {
      approvedBus += parseFloat(leg.travel_amount || 0);
    } else if (mode === "train") {
      approvedTrain += parseFloat(leg.travel_amount || 0);
    }
    const subMode = (leg.sub_mode || "").trim().toLowerCase();
    if (subMode === "auto") {
      approvedAuto += parseFloat(leg.sub_amount || 0);
    } else if (subMode === "bus") {
      approvedBus += parseFloat(leg.sub_amount || 0);
    } else if (subMode === "train") {
      approvedTrain += parseFloat(leg.sub_amount || 0);
    }
    const [legCalls, legPms, legAsset, legMobilise, legCalibration] = getLegStats(leg);
    approvedCalls += legCalls;
    approvedPms += legPms;
    approvedAsset += legAsset;
    approvedMobilise += legMobilise;
    approvedCalibration += legCalibration;
  }
  let claimedDa = 0;
  let claimedBikeKm = 0;
  let claimedAuto = 0;
  let claimedBus = 0;
  let claimedTrain = 0;
  let claimedHotel = 0;
  let claimedLocalPurchase = 0;
  let claimedKmUsed = 0;
  let claimedCalls = 0;
  let claimedPms = 0;
  let claimedAsset = 0;
  let claimedMobilise = 0;
  let claimedCalibration = 0;
  for (const leg of allLegs) {
    const origDa = leg.original_da_amount !== null && leg.original_da_amount > 0 ? parseFloat(leg.original_da_amount) : parseFloat(leg.da_amount || 0);
    const origHotel = leg.original_hotel_amount !== null && leg.original_hotel_amount > 0 ? parseFloat(leg.original_hotel_amount) : parseFloat(leg.hotel_amount || 0);
    const origLp = leg.original_local_purchase !== null && leg.original_local_purchase > 0 ? parseFloat(leg.original_local_purchase) : parseFloat(leg.local_purchase || 0);
    claimedDa += origDa;
    claimedHotel += origHotel;
    claimedLocalPurchase += origLp;
    const mode = (leg.travel_mode || "").trim().toLowerCase();
    const origKm = leg.original_distance_km !== null && leg.original_distance_km > 0 ? parseFloat(leg.original_distance_km) : parseFloat(leg.distance_km || 0);
    const origTravelAmt = leg.original_travel_amount !== null && leg.original_travel_amount > 0 ? parseFloat(leg.original_travel_amount) : parseFloat(leg.travel_amount || 0);
    if (mode === "bike") {
      claimedBikeKm += origKm;
      claimedKmUsed += origKm;
    } else if (mode === "car") {
      claimedKmUsed += origKm;
    } else if (mode === "auto") {
      claimedAuto += origTravelAmt;
    } else if (mode === "bus") {
      claimedBus += origTravelAmt;
    } else if (mode === "train") {
      claimedTrain += origTravelAmt;
    }
    const origSubAmt = leg.original_sub_amount !== null && leg.original_sub_amount > 0 ? parseFloat(leg.original_sub_amount) : parseFloat(leg.sub_amount || 0);
    const subMode = (leg.sub_mode || "").trim().toLowerCase();
    if (subMode === "auto") {
      claimedAuto += origSubAmt;
    } else if (subMode === "bus") {
      claimedBus += origSubAmt;
    } else if (subMode === "train") {
      claimedTrain += origSubAmt;
    }
    const [legCalls, legPms, legAsset, legMobilise, legCalibration] = getLegStats(leg);
    claimedCalls += legCalls;
    claimedPms += legPms;
    claimedAsset += legAsset;
    claimedMobilise += legMobilise;
    claimedCalibration += legCalibration;
  }
  return {
    km_used_so_far_approved: approvedKmUsed,
    km_used_so_far_claimed: claimedKmUsed,
    total_da_approved: approvedDa,
    total_da_claimed: claimedDa,
    total_bike_km_approved: approvedBikeKm,
    total_bike_km_claimed: claimedBikeKm,
    total_auto_approved: approvedAuto,
    total_auto_claimed: claimedAuto,
    total_bus_approved: approvedBus,
    total_bus_claimed: claimedBus,
    total_train_approved: approvedTrain,
    total_train_claimed: claimedTrain,
    total_hotel_approved: approvedHotel,
    total_hotel_claimed: claimedHotel,
    total_local_purchase_approved: approvedLocalPurchase,
    total_local_purchase_claimed: claimedLocalPurchase,
    calls_completed_approved: approvedCalls,
    calls_completed_claimed: claimedCalls,
    pms_count_approved: approvedPms,
    pms_count_claimed: claimedPms,
    asset_tagging_approved: approvedAsset,
    asset_tagging_claimed: claimedAsset,
    mobilise_count_approved: approvedMobilise,
    mobilise_count_claimed: claimedMobilise,
    calibration_count_approved: approvedCalibration,
    calibration_count_claimed: claimedCalibration,
    // Legacy backward-compatible keys
    km_used_so_far: claimedKmUsed,
    total_da: approvedDa,
    total_bike_km: approvedBikeKm,
    total_auto: approvedAuto,
    total_bus: approvedBus,
    total_train: approvedTrain,
    total_hotel: approvedHotel,
    total_local_purchase: approvedLocalPurchase,
    calls_completed: approvedCalls,
    pms_count: approvedPms,
    asset_tagging: approvedAsset,
    mobilise_count: approvedMobilise,
    calibration_count: approvedCalibration
  };
}
__name(getUserMonthlyStatsHelper, "getUserMonthlyStatsHelper");
async function handleGetExpenseDetails(request, env, params, query, user) {
  const expenseId = params.id;
  try {
    if (expenseId.startsWith("-")) {
      const val = parseInt(expenseId, 10);
      if (val <= -2e5) {
        try {
          const matchingExpId = await resolveLegacyExpenseId(env, val);
          if (!matchingExpId)
            return jsonResponse3({ error: "Legacy claim not found" }, 404);
          const masterRow = await env.DB.prepare(`
          SELECT * FROM expense_master WHERE exp_id = ?
        `).bind(matchingExpId).first();
          if (!masterRow)
            return jsonResponse3({ error: "Legacy claim details not found" }, 404);
          const submitter3 = await env.DB.prepare("SELECT * FROM users WHERE user_id = ?").bind(masterRow.user_id).first();
          let rateBike3 = 4.5;
          let rateCar3 = 9;
          if (submitter3) {
            const gradeToLookup = (submitter3.designation || "").toLowerCase().includes("specialist") ? "O1" : submitter3.grade || "O1";
            const allowance = await env.DB.prepare("SELECT * FROM allowance_master WHERE grade = ?").bind(gradeToLookup).first();
            const defaultBike = await env.DB.prepare("SELECT rate_per_km FROM allowance_master WHERE vehicle_type = 'Bike' LIMIT 1").first();
            const defaultCar = await env.DB.prepare("SELECT rate_per_km FROM allowance_master WHERE vehicle_type = 'Car' LIMIT 1").first();
            const fallbackBikeRate = defaultBike?.rate_per_km || 4.5;
            const fallbackCarRate = defaultCar?.rate_per_km || 9;
            if (allowance) {
              rateBike3 = allowance.vehicle_type === "Bike" ? allowance.rate_per_km : fallbackBikeRate;
              rateCar3 = allowance.vehicle_type === "Car" ? allowance.rate_per_km : fallbackCarRate;
            } else {
              rateBike3 = fallbackBikeRate;
              rateCar3 = fallbackCarRate;
            }
          }
          const itiRows = await env.DB.prepare(`
          SELECT * FROM expense_itineraries WHERE exp_id = ? ORDER BY leg_number
        `).bind(matchingExpId).all();
          const itinerariesList = (itiRows.results || []).map((r) => ({
            leg: r.leg_number,
            from_district: r.from_district,
            to_district: r.to_district,
            from: r.from_location || "",
            to: r.to_location || "",
            mode: r.travel_mode,
            km: parseFloat(r.distance_km || 0),
            amount: parseFloat(r.travel_amount || 0),
            sub_mode: r.sub_mode || "",
            sub_amount: parseFloat(r.sub_amount || 0),
            da: parseFloat(r.da_amount || 0),
            hotel: parseFloat(r.hotel_amount || 0),
            local_purchase: 0,
            oth_desc: r.other_desc || "",
            oth_amount: parseFloat(r.other_amount || 0),
            ws_assigned: r.calls_assigned || 0,
            calls_assigned: r.calls_assigned || 0,
            ws_closed: r.calls_completed || 0,
            calls_completed: r.calls_completed || 0,
            ws_pms: r.pms_count || 0,
            pms_count: r.pms_count || 0,
            ws_asset: r.asset_tagging || 0,
            asset_tagging: r.asset_tagging || 0,
            calibration_count: 0,
            mobilise_count: 0,
            mobilise_asset_count: 0,
            visit_purpose: r.visit_purpose || "",
            activity_details: "",
            original_km: parseFloat(r.distance_km || 0),
            original_amount: parseFloat(r.travel_amount || 0),
            original_sub_amount: parseFloat(r.sub_amount || 0),
            original_da: parseFloat(r.da_amount || 0),
            original_hotel: parseFloat(r.hotel_amount || 0),
            original_oth_amount: parseFloat(r.other_amount || 0),
            original_local_purchase: 0
          }));
          const attRows = await env.DB.prepare(`
          SELECT file_url, itinerary_id, bill_type FROM expense_attachments WHERE exp_id = ?
        `).bind(matchingExpId).all();
          const attachmentsList = (attRows.results || []).map((r) => r.file_url);
          const attachmentsDetailed = (attRows.results || []).map((r) => ({
            file_url: r.file_url,
            itinerary_id: r.itinerary_id,
            bill_type: r.bill_type
          }));
          const approvalsList2 = [];
          const l1App = masterRow.level_first_approver;
          const l2App = masterRow.level_second_approver;
          const statusVal = masterRow.status;
          const approvedBy = masterRow.approved_by;
          const l1User = l1App ? await env.DB.prepare("SELECT * FROM users WHERE user_id = ?").bind(l1App).first() : null;
          const l2User = l2App ? await env.DB.prepare("SELECT * FROM users WHERE user_id = ?").bind(l2App).first() : null;
          const l1Status = ["Pending L2", "Approved"].includes(statusVal) ? "approved" : statusVal === "Rejected" && approvedBy === "L1" ? "rejected" : "pending";
          approvalsList2.push({
            id: val,
            level_number: 1,
            approver_name: l1User?.name || l1App || "N/A",
            approver_code: l1App || "",
            approver_role: l1User?.role || "Manager",
            status: l1Status,
            comments: statusVal === "Rejected" && approvedBy === "L1" ? masterRow.reject_reason || "" : "",
            updated_at: masterRow.created_at
          });
          if (l2App) {
            const l2Status = statusVal === "Approved" ? "approved" : statusVal === "Rejected" && approvedBy === "L2" ? "rejected" : statusVal === "Pending L2" ? "pending" : "waiting";
            approvalsList2.push({
              id: val - 1,
              level_number: 2,
              approver_name: l2User?.name || l2App || "N/A",
              approver_code: l2App || "",
              approver_role: l2User?.role || "HOD",
              status: l2Status,
              comments: statusVal === "Rejected" && approvedBy === "L2" ? masterRow.reject_reason || "" : "",
              updated_at: masterRow.created_at
            });
          }
          const dateStr = masterRow.expense_date;
          let monthName = "January";
          let yearVal = (/* @__PURE__ */ new Date()).getFullYear();
          if (dateStr) {
            try {
              const parts = dateStr.split("-");
              yearVal = parseInt(parts[0], 10);
              const monNum = parseInt(parts[1], 10);
              monthName = MONTH_NAMES[monNum - 1];
            } catch (e) {
            }
          }
          const monthlyStats3 = await getUserMonthlyStatsHelper(env, submitter3?.id || 0, monthName, yearVal, dateStr);
          return jsonResponse3({
            id: val,
            expense_code: matchingExpId,
            user_id: submitter3?.id || 0,
            submitter_name: submitter3?.name || masterRow.user_id,
            submitter_code: masterRow.user_id,
            month: monthName,
            year: yearVal,
            amount: parseFloat(masterRow.total_amount || 0),
            status: statusVal === "Approved" ? "approved" : statusVal === "Rejected" ? "rejected" : "submitted",
            category: itinerariesList[0]?.mode || "Travel",
            date: dateStr,
            purpose: masterRow.visit_purpose || "",
            original_amount: parseFloat(masterRow.original_amount || masterRow.total_amount || 0),
            original_da_amount: parseFloat(masterRow.da_amount || 0),
            original_hotel_amount: parseFloat(masterRow.hotel_amount || 0),
            original_other_expense_amount: parseFloat(masterRow.other_expense_amount || 0),
            original_local_purchase_amount: parseFloat(masterRow.local_purchase_amount || 0),
            attachments: attachmentsList,
            attachments_detailed: attachmentsDetailed,
            itineraries: itinerariesList,
            created_at: masterRow.created_at,
            updated_at: masterRow.created_at,
            approvals: approvalsList2,
            edit_history: [],
            user_monthly_stats: monthlyStats3,
            rate_bike: rateBike3,
            rate_car: rateCar3
          });
        } catch (e) {
          return jsonResponse3({ error: "Legacy table query failed: " + e.message }, 500);
        }
      }
      const limitId = -val;
      const pl = await env.DB.prepare("SELECT * FROM limit_approval_requests WHERE id = ?").bind(limitId).first();
      if (!pl)
        return jsonResponse3({ error: "Limit request not found" }, 404);
      const submitter2 = await env.DB.prepare("SELECT * FROM users WHERE user_id = ?").bind(pl.user_id).first();
      let limitYear = (/* @__PURE__ */ new Date()).getFullYear();
      if (pl.for_month && pl.for_month.includes("-")) {
        limitYear = parseInt(pl.for_month.split("-")[0], 10);
      }
      let rateBike2 = 4.5;
      let rateCar2 = 9;
      if (submitter2) {
        const gradeToLookup = (submitter2.designation || "").toLowerCase().includes("specialist") ? "O1" : submitter2.grade || "O1";
        const allowance = await env.DB.prepare("SELECT * FROM allowance_master WHERE grade = ?").bind(gradeToLookup).first();
        const defaultBike = await env.DB.prepare("SELECT rate_per_km FROM allowance_master WHERE vehicle_type = 'Bike' LIMIT 1").first();
        const defaultCar = await env.DB.prepare("SELECT rate_per_km FROM allowance_master WHERE vehicle_type = 'Car' LIMIT 1").first();
        const fallbackBikeRate = defaultBike?.rate_per_km || 4.5;
        const fallbackCarRate = defaultCar?.rate_per_km || 9;
        if (allowance) {
          rateBike2 = allowance.vehicle_type === "Bike" ? allowance.rate_per_km : fallbackBikeRate;
          rateCar2 = allowance.vehicle_type === "Car" ? allowance.rate_per_km : fallbackCarRate;
        } else {
          rateBike2 = fallbackBikeRate;
          rateCar2 = fallbackCarRate;
        }
      }
      const monthlyStats2 = submitter2 ? await getUserMonthlyStatsHelper(env, submitter2.id, pl.for_month, limitYear) : null;
      const managerUser = await env.DB.prepare("SELECT * FROM users WHERE user_id = ?").bind(pl.manager_id).first();
      return jsonResponse3({
        id: -pl.id,
        expense_code: `LIMIT-${pl.request_type}-${pl.id}`,
        user_id: submitter2?.id || 0,
        submitter_name: submitter2?.name || `Employee ${pl.user_id}`,
        submitter_code: pl.user_id,
        month: pl.for_month,
        year: limitYear,
        amount: pl.status === "Approved" ? pl.approved_value !== null ? parseFloat(pl.approved_value) : pl.request_type === "AUTO" ? parseFloat(pl.requested_value) : 0 : pl.request_type === "AUTO" ? parseFloat(pl.requested_value) : 0,
        requested_value: parseFloat(pl.requested_value),
        approved_value: pl.approved_value !== null ? parseFloat(pl.approved_value) : null,
        status: pl.status,
        category: "Limit Request",
        date: pl.for_month,
        purpose: `Request additional ${parseFloat(pl.requested_value).toFixed(1)} ${pl.request_type} limit extension for month ${pl.for_month}.`,
        original_amount: pl.request_type === "AUTO" ? parseFloat(pl.requested_value) : 0,
        original_da_amount: 0,
        original_hotel_amount: 0,
        original_other_expense_amount: 0,
        original_local_purchase_amount: 0,
        attachments: [],
        attachments_detailed: [],
        user_monthly_stats: monthlyStats2,
        rate_bike: rateBike2,
        rate_car: rateCar2,
        itineraries: [
          {
            leg: 1,
            from_district: submitter2?.district || "N/A",
            to_district: "N/A",
            from: "N/A",
            to: "N/A",
            mode: pl.request_type,
            km: pl.request_type === "KM" ? parseFloat(pl.requested_value) : 0,
            amount: pl.request_type === "AUTO" ? parseFloat(pl.requested_value) : 0,
            approved_km: pl.status === "Approved" && pl.request_type === "KM" ? pl.approved_value !== null ? parseFloat(pl.approved_value) : parseFloat(pl.requested_value) : 0,
            approved_amount: pl.status === "Approved" && pl.request_type === "AUTO" ? pl.approved_value !== null ? parseFloat(pl.approved_value) : parseFloat(pl.requested_value) : 0,
            sub_mode: "",
            sub_amount: 0,
            da: 0,
            hotel: 0,
            local_purchase: 0,
            oth_desc: "",
            oth_amount: 0,
            ws_assigned: 0,
            calls_assigned: 0,
            ws_closed: 0,
            calls_completed: 0,
            ws_pms: 0,
            pms_count: 0,
            ws_asset: 0,
            asset_tagging: 0,
            calibration_count: 0,
            mobilise_count: 0,
            mobilise_asset_count: 0,
            visit_purpose: `Request additional ${parseFloat(pl.requested_value).toFixed(1)} ${pl.request_type} limit extension for month ${pl.for_month}.`,
            activity_details: "",
            original_km: pl.request_type === "KM" ? parseFloat(pl.requested_value) : 0,
            original_amount: pl.request_type === "AUTO" ? parseFloat(pl.requested_value) : 0,
            original_sub_amount: 0,
            original_da: 0,
            original_hotel: 0,
            original_oth_amount: 0,
            original_local_purchase: 0
          }
        ],
        created_at: pl.created_at,
        updated_at: pl.updated_at,
        approvals: [
          {
            id: -pl.id,
            level_number: 1,
            approver_name: managerUser?.name || pl.manager_id,
            approver_code: pl.manager_id,
            approver_role: managerUser?.role || "Manager",
            status: pl.status.toLowerCase(),
            comments: "",
            updated_at: pl.updated_at
          }
        ],
        edit_history: []
      });
    }
    let expense = null;
    if (/^\d+$/.test(expenseId)) {
      expense = await env.DB.prepare("SELECT * FROM expenses WHERE id = ? OR expense_code = ?").bind(parseInt(expenseId, 10), expenseId).first();
    } else {
      expense = await env.DB.prepare("SELECT * FROM expenses WHERE expense_code = ?").bind(expenseId).first();
    }
    if (!expense)
      return jsonResponse3({ error: "Expense claim not found" }, 404);
    const approvals2 = await env.DB.prepare("SELECT * FROM approvals WHERE expense_id = ? ORDER BY level_number").bind(expense.id).all();
    const approverIds = Array.from(new Set((approvals2.results || []).map((a) => a.approver_id)));
    let approverUsers = {};
    if (approverIds.length > 0) {
      const placeholders = approverIds.map(() => "?").join(",");
      const usersRes = await env.DB.prepare(`SELECT * FROM users WHERE id IN (${placeholders})`).bind(...approverIds).all();
      for (const u of usersRes.results || []) {
        approverUsers[u.id] = u;
      }
    }
    const approvalsList = (approvals2.results || []).map((a) => {
      const approverUser = approverUsers[a.approver_id] || null;
      return {
        id: a.id,
        level_number: a.level_number,
        approver_name: approverUser?.name || `Approver ID ${a.approver_id}`,
        approver_code: approverUser?.user_id || "",
        approver_role: approverUser?.role || "",
        status: a.status,
        comments: a.comments || "",
        updated_at: a.updated_at
      };
    });
    const submitter = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(expense.user_id).first();
    let rateBike = 4.5;
    let rateCar = 9;
    if (submitter) {
      const gradeToLookup = (submitter.designation || "").toLowerCase().includes("specialist") ? "O1" : submitter.grade || "O1";
      const allowance = await env.DB.prepare("SELECT * FROM allowance_master WHERE grade = ?").bind(gradeToLookup).first();
      const defaultBike = await env.DB.prepare("SELECT rate_per_km FROM allowance_master WHERE vehicle_type = 'Bike' LIMIT 1").first();
      const defaultCar = await env.DB.prepare("SELECT rate_per_km FROM allowance_master WHERE vehicle_type = 'Car' LIMIT 1").first();
      const fallbackBikeRate = defaultBike?.rate_per_km || 4.5;
      const fallbackCarRate = defaultCar?.rate_per_km || 9;
      if (allowance) {
        rateBike = allowance.vehicle_type === "Bike" ? allowance.rate_per_km : fallbackBikeRate;
        rateCar = allowance.vehicle_type === "Car" ? allowance.rate_per_km : fallbackCarRate;
      } else {
        rateBike = fallbackBikeRate;
        rateCar = fallbackCarRate;
      }
    }
    const itineraries = await env.DB.prepare("SELECT * FROM expense_itineraries WHERE exp_id = ? ORDER BY leg_number ASC").bind(expense.expense_code).all();
    const attachments = await env.DB.prepare("SELECT * FROM expense_attachments WHERE exp_id = ?").bind(expense.expense_code).all();
    const editLogs = await env.DB.prepare("SELECT * FROM expense_edit_logs WHERE expense_id = ? ORDER BY created_at DESC").bind(expense.id).all();
    const editHistoryList = (editLogs.results || []).map((el) => ({
      id: el.id,
      editor_name: el.editor_name,
      editor_role: el.editor_role,
      leg_number: el.leg_number,
      field_name: el.field_name,
      old_value: el.old_value,
      new_value: el.new_value,
      comment: el.comment || "",
      created_at: el.created_at
    }));
    const monthlyStats = await getUserMonthlyStatsHelper(env, expense.user_id, expense.month, expense.year, expense.itinerary);
    return jsonResponse3({
      id: expense.id,
      expense_code: expense.expense_code,
      user_id: expense.user_id,
      submitter_name: submitter?.name || "",
      submitter_code: submitter?.user_id || "",
      month: expense.month,
      year: expense.year,
      amount: parseFloat(expense.amount || 0),
      status: expense.status,
      category: expense.travel_mode,
      date: expense.itinerary,
      purpose: expense.description || "",
      ai_analysis: expense.ai_analysis || null,
      is_anomaly: expense.is_anomaly || 0,
      original_amount: parseFloat(expense.original_amount || expense.amount || 0),
      original_da_amount: parseFloat(expense.original_da_amount || expense.da_amount || 0),
      original_hotel_amount: parseFloat(expense.original_hotel_amount || expense.hotel_amount || 0),
      original_other_expense_amount: parseFloat(expense.original_other_expense_amount || expense.other_expense_amount || 0),
      original_local_purchase_amount: parseFloat(expense.original_local_purchase_amount || expense.local_purchase_amount || 0),
      attachments: (attachments.results || []).map((a) => a.file_url),
      attachments_detailed: (attachments.results || []).map((a) => ({
        file_url: a.file_url,
        itinerary_id: a.itinerary_id,
        bill_type: a.bill_type
      })),
      itineraries: (itineraries.results || []).map((i) => ({
        leg: i.leg_number,
        from_district: i.from_district,
        to_district: i.to_district,
        from: i.from_location || "",
        to: i.to_location || "",
        mode: i.travel_mode,
        km: parseFloat(i.distance_km || 0),
        amount: parseFloat(i.travel_amount || 0),
        sub_mode: i.sub_mode || "",
        sub_amount: parseFloat(i.sub_amount || 0),
        da: parseFloat(i.da_amount || 0),
        hotel: parseFloat(i.hotel_amount || 0),
        local_purchase: parseFloat(i.local_purchase || 0),
        oth_desc: i.other_desc || "",
        oth_amount: parseFloat(i.other_amount || 0),
        ws_assigned: i.calls_assigned || 0,
        calls_assigned: i.calls_assigned || 0,
        ws_closed: i.calls_completed || 0,
        calls_completed: i.calls_completed || 0,
        ws_pms: i.pms_count || 0,
        pms_count: i.pms_count || 0,
        ws_asset: i.asset_tagging || 0,
        asset_tagging: i.asset_tagging || 0,
        calibration_count: i.calibration_count || 0,
        mobilise_count: i.mobilise_count || 0,
        mobilise_asset_count: i.mobilise_count || 0,
        visit_purpose: i.visit_purpose || "",
        activity_details: i.activity_details || "",
        original_km: parseFloat(i.original_distance_km || i.distance_km || 0),
        original_amount: parseFloat(i.original_travel_amount || i.travel_amount || 0),
        original_sub_amount: parseFloat(i.original_sub_amount || i.sub_amount || 0),
        original_da: parseFloat(i.original_da_amount || i.da_amount || 0),
        original_hotel: parseFloat(i.original_hotel_amount || i.hotel_amount || 0),
        original_oth_amount: parseFloat(i.original_other_amount || i.other_amount || 0),
        original_local_purchase: parseFloat(i.original_local_purchase || i.local_purchase || 0)
      })),
      deduction_amount: expense.deduction_amount !== void 0 && expense.deduction_amount !== null ? parseFloat(expense.deduction_amount) : expense.deduction_amt !== void 0 && expense.deduction_amt !== null ? parseFloat(expense.deduction_amt) : expense.original_amount && expense.amount && parseFloat(expense.original_amount) > parseFloat(expense.amount) ? parseFloat((parseFloat(expense.original_amount) - parseFloat(expense.amount)).toFixed(2)) : 0,
      remark: expense.remark || expense.approver_remark || expense.deduction_remark || expense.comments || approvalsList.find((a) => a.comments || a.remark)?.comments || "",
      approver_remark: expense.approver_remark || expense.remark || expense.deduction_remark || expense.comments || approvalsList.find((a) => a.comments || a.remark)?.comments || "",
      deduction_remark: expense.deduction_remark || expense.approver_remark || expense.remark || expense.comments || "",
      created_at: expense.created_at,
      updated_at: expense.updated_at,
      approvals: approvalsList,
      edit_history: editHistoryList,
      user_monthly_stats: monthlyStats,
      rate_bike: rateBike,
      rate_car: rateCar
    });
  } catch (err) {
    return jsonResponse3({ error: "Failed to load details: " + err.message, stack: err.stack }, 500);
  }
}
__name(handleGetExpenseDetails, "handleGetExpenseDetails");
async function handleDeleteExpense(request, env, params, query, user) {
  const expenseId = parseInt(params.id, 10);
  const expense = await env.DB.prepare("SELECT * FROM expenses WHERE id = ?").bind(expenseId).first();
  if (!expense)
    return jsonResponse3({ error: "Expense claim not found" }, 404);
  if (expense.user_id !== user.id && (user.role || "").trim().toLowerCase() !== "admin") {
    return jsonResponse3({ error: "Access denied" }, 403);
  }
  const itis = await env.DB.prepare("SELECT itinerary_id FROM expense_itineraries WHERE exp_id = ?").bind(expense.expense_code).all();
  const itineraryIds = (itis.results || []).map((r) => r.itinerary_id);
  const statements = [];
  for (const id of itineraryIds) {
    statements.push({ sql: "DELETE FROM expense_breakdown_calls WHERE itinerary_id = ?", params: [id] });
    statements.push({ sql: "DELETE FROM expense_pms_calls WHERE itinerary_id = ?", params: [id] });
    statements.push({ sql: "DELETE FROM expense_asset_taggings WHERE itinerary_id = ?", params: [id] });
    statements.push({ sql: "DELETE FROM expense_asset_mobilises WHERE itinerary_id = ?", params: [id] });
    statements.push({ sql: "DELETE FROM expense_calibrations WHERE itinerary_id = ?", params: [id] });
    statements.push({ sql: "DELETE FROM expense_other_activities WHERE itinerary_id = ?", params: [id] });
  }
  statements.push({ sql: "DELETE FROM approvals WHERE expense_id = ?", params: [expenseId] });
  statements.push({ sql: "DELETE FROM expense_edit_logs WHERE expense_id = ?", params: [expenseId] });
  statements.push({ sql: "DELETE FROM expense_attachments WHERE exp_id = ?", params: [expense.expense_code] });
  statements.push({ sql: "DELETE FROM expense_itineraries WHERE exp_id = ?", params: [expense.expense_code] });
  statements.push({ sql: "DELETE FROM expenses WHERE id = ?", params: [expenseId] });
  await runBatchWrite(env, statements);
  return jsonResponse3({ status: "success", message: "Expense claim deleted successfully." });
}
__name(handleDeleteExpense, "handleDeleteExpense");
async function handleReverseExpense(request, env, params, query, user) {
  if (!user || (user.role || "").trim().toLowerCase() !== "admin") {
    return jsonResponse3({ error: "Access denied. Only Admin can reverse expense entries." }, 403);
  }
  const expenseId = parseInt(params.id, 10);
  if (isNaN(expenseId)) {
    return jsonResponse3({ error: "Invalid expense ID" }, 400);
  }
  const expense = await env.DB.prepare("SELECT * FROM expenses WHERE id = ?").bind(expenseId).first();
  if (!expense) {
    return jsonResponse3({ error: "Expense claim not found" }, 404);
  }
  if ((expense.status || "").toLowerCase() === "reversed") {
    return jsonResponse3({ error: "This expense entry is already reversed." }, 400);
  }
  let reversal_reason = "";
  try {
    const body = await request.json();
    reversal_reason = (body.reason || "").trim();
  } catch (e) {
    reversal_reason = "";
  }
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
  const reversalNote = `[REVERSED by ${user.name || user.user_id} on ${timestamp}${reversal_reason ? ": " + reversal_reason : ""}]`;
  const updatedDescription = expense.description ? `${expense.description} ${reversalNote}` : reversalNote;
  await env.DB.prepare(`
    UPDATE expenses
    SET status = 'reversed',
        description = ?,
        updated_at = ?
    WHERE id = ?
  `).bind(updatedDescription, timestamp, expenseId).run();
  return jsonResponse3({
    status: "success",
    message: `Expense ID ${expenseId} (${expense.expense_code}) has been reversed successfully. Original data is preserved.`,
    expense_id: expenseId,
    expense_code: expense.expense_code,
    previous_status: expense.status,
    reversed_by: user.name || user.user_id,
    reversed_at: timestamp,
    reason: reversal_reason || null
  });
}
__name(handleReverseExpense, "handleReverseExpense");
async function handleSubmitExpense(request, env, params, query, user) {
  let formData;
  try {
    formData = await request.formData();
  } catch (e) {
    return jsonResponse3({ error: "Invalid multipart form data" }, 400);
  }
  const payloadStr = formData.get("payload");
  let date, amount, itineraries, claim_month, claim_year, description = "";
  let editExpenseId = formData.get("edit_expense_id") || null;
  if (payloadStr) {
    let payload;
    try {
      payload = JSON.parse(payloadStr);
    } catch (e) {
      return jsonResponse3({ error: "Invalid payload JSON" }, 400);
    }
    date = payload.date;
    amount = payload.amount;
    itineraries = payload.itinerary_legs || payload.itineraries || [];
    claim_month = payload.claim_month;
    claim_year = payload.claim_year;
    description = payload.description || "";
    if (payload.edit_expense_id)
      editExpenseId = payload.edit_expense_id;
  } else {
    date = formData.get("exp_date");
    amount = parseFloat(formData.get("total_amount") || "0.0");
    const itinerariesStr = formData.get("itineraries");
    if (!date || !itinerariesStr) {
      return jsonResponse3({ error: "exp_date and itineraries are required" }, 400);
    }
    try {
      itineraries = JSON.parse(itinerariesStr);
    } catch (e) {
      return jsonResponse3({ error: "Invalid itineraries JSON" }, 400);
    }
    const dt = new Date(date);
    const months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December"
    ];
    claim_month = months[dt.getMonth()];
    claim_year = dt.getFullYear();
    description = formData.get("description") || "";
  }
  const rawClientTs = formData.get("client_timestamp") || null;
  const timestamp = rawClientTs ? new Date(rawClientTs).toISOString() : (/* @__PURE__ */ new Date()).toISOString();
  try {
    const settingsRows = await env.DB.prepare(
      "SELECT key, value FROM system_settings WHERE key IN ('max_past_days_limit', 'monthly_cutoff_day')"
    ).all();
    let maxPastDays = null;
    let monthlyCutoff = null;
    for (const r of settingsRows.results || []) {
      if (r.key === "max_past_days_limit")
        maxPastDays = parseInt(r.value, 10);
      if (r.key === "monthly_cutoff_day")
        monthlyCutoff = parseInt(r.value, 10);
    }
    const today = /* @__PURE__ */ new Date();
    const expenseDateObj = new Date(date);
    const d1 = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
    const d2 = Date.UTC(expenseDateObj.getFullYear(), expenseDateObj.getMonth(), expenseDateObj.getDate());
    const diffDays = Math.floor((d1 - d2) / (1e3 * 60 * 60 * 24));
    if (d2 > d1) {
      return jsonResponse3({ error: "Submission policy violation: Expense date cannot be in the future." }, 400);
    }
    if (maxPastDays !== null && maxPastDays > 0) {
      if (diffDays > maxPastDays) {
        return jsonResponse3({ error: `Submission policy violation: Expense date (${date}) is older than the allowed limit of ${maxPastDays} days.` }, 400);
      }
    }
    if (monthlyCutoff !== null && monthlyCutoff > 0) {
      const currentDay = today.getDate();
      if (currentDay > monthlyCutoff) {
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth();
        const expenseYear = expenseDateObj.getFullYear();
        const expenseMonth = expenseDateObj.getMonth();
        if (expenseYear < currentYear || expenseYear === currentYear && expenseMonth < currentMonth) {
          return jsonResponse3({ error: `Submission policy violation: Cutoff day (${monthlyCutoff}rd/th) for previous month's expenses has passed. You cannot submit expenses for past months.` }, 400);
        }
      }
    }
  } catch (err) {
    console.error("Failed to verify submission policies:", err.message);
  }
  let dupQuery = "SELECT id FROM expenses WHERE user_id = ? AND itinerary = ? AND status NOT IN ('rejected', 'returned_to_draft')";
  let dupParams = [user.id, date];
  if (editExpenseId) {
    dupQuery += " AND id != ?";
    dupParams.push(editExpenseId);
  }
  const dupResult = await runRead(env, dupQuery, dupParams, request);
  const existingDup = dupResult && dupResult.results && dupResult.results[0] ? dupResult.results[0] : null;
  if (existingDup) {
    return jsonResponse3({ error: `An expense claim for ${date} has already been submitted.` }, 400);
  }
  let existingExpense = null;
  let expenseCode = null;
  let newExpId = null;
  if (editExpenseId) {
    existingExpense = await env.DB.prepare("SELECT * FROM expenses WHERE id = ? AND user_id = ?").bind(editExpenseId, user.id).first();
    if (!existingExpense) {
      return jsonResponse3({ error: "Expense claim to edit not found." }, 404);
    }
    expenseCode = existingExpense.expense_code;
    newExpId = existingExpense.id;
    const oldItis2 = await env.DB.prepare("SELECT itinerary_id FROM expense_itineraries WHERE exp_id = ?").bind(expenseCode).all();
    if (oldItis2.results && oldItis2.results.length > 0) {
      for (const r of oldItis2.results) {
        const id = r.itinerary_id;
        await runWrite(env, "DELETE FROM expense_breakdown_calls WHERE itinerary_id = ?", [id]);
        await runWrite(env, "DELETE FROM expense_pms_calls WHERE itinerary_id = ?", [id]);
        await runWrite(env, "DELETE FROM expense_asset_taggings WHERE itinerary_id = ?", [id]);
        await runWrite(env, "DELETE FROM expense_asset_mobilises WHERE itinerary_id = ?", [id]);
        await runWrite(env, "DELETE FROM expense_calibrations WHERE itinerary_id = ?", [id]);
        await runWrite(env, "DELETE FROM expense_other_activities WHERE itinerary_id = ?", [id]);
      }
    }
    await runWrite(env, "DELETE FROM expense_attachments WHERE exp_id = ?", [expenseCode]);
    await runWrite(env, "DELETE FROM expense_itineraries WHERE exp_id = ?", [expenseCode]);
    await runWrite(env, "DELETE FROM approvals WHERE expense_id = ?", [newExpId]);
  } else {
    const dt = new Date(date);
    const padTwo = /* @__PURE__ */ __name((n) => String(n).padStart(2, "0"), "padTwo");
    const monthPrefix = `${padTwo(dt.getMonth() + 1)}/${String(dt.getFullYear()).slice(-2)}`;
    const seqRows = await env.DB.prepare("SELECT expense_code FROM expenses WHERE expense_code LIKE ?").bind(`RJ-${monthPrefix}-%`).all();
    let maxSeq = 0;
    if (seqRows.results && seqRows.results.length > 0) {
      for (const r of seqRows.results) {
        const parts = r.expense_code.split("-");
        if (parts.length === 3) {
          const num = parseInt(parts[2], 10);
          if (!isNaN(num) && num > maxSeq) {
            maxSeq = num;
          }
        }
      }
    }
    const nextSeq = maxSeq + 1;
    expenseCode = `RJ-${monthPrefix}-${String(nextSeq).padStart(6, "0")}`;
  }
  const oldItis = await env.DB.prepare("SELECT itinerary_id FROM expense_itineraries WHERE exp_id = ?").bind(expenseCode).all();
  if (oldItis.results && oldItis.results.length > 0) {
    for (const r of oldItis.results) {
      const id = r.itinerary_id;
      await runWrite(env, "DELETE FROM expense_breakdown_calls WHERE itinerary_id = ?", [id]);
      await runWrite(env, "DELETE FROM expense_pms_calls WHERE itinerary_id = ?", [id]);
      await runWrite(env, "DELETE FROM expense_asset_taggings WHERE itinerary_id = ?", [id]);
      await runWrite(env, "DELETE FROM expense_asset_mobilises WHERE itinerary_id = ?", [id]);
      await runWrite(env, "DELETE FROM expense_calibrations WHERE itinerary_id = ?", [id]);
      await runWrite(env, "DELETE FROM expense_other_activities WHERE itinerary_id = ?", [id]);
    }
  }
  await runWrite(env, "DELETE FROM expense_attachments WHERE exp_id = ?", [expenseCode]);
  await runWrite(env, "DELETE FROM expense_itineraries WHERE exp_id = ?", [expenseCode]);
  const { isBaseLocOnly, isDaAllowed, baseLocations: baseLocations2 } = computeBaseLocPolicy(
    user.base_reporting_location || "",
    itineraries
  );
  let totalDa = 0;
  let totalHotel = 0;
  let totalOther = 0;
  let totalLocalPurchase = 0;
  let totalAssigned = 0;
  let totalCompleted = 0;
  let totalPms = 0;
  let totalAsset = 0;
  let totalCalibration = 0;
  let totalMobilise = 0;
  let newKm = 0;
  let newAuto = 0;
  let calculatedTotal = 0;
  for (let idx = 0; idx < itineraries.length; idx++) {
    const iti = itineraries[idx];
    const isCommute = isBaseLocOnly && checkIsCommuteLeg(iti, baseLocations2, idx, itineraries.length);
    const travelAmt = isCommute ? 0 : parseFloat(iti.amount || "0.0");
    const subAmt = isCommute ? 0 : parseFloat(iti.sub_amount || "0.0");
    const daAmt = isDaAllowed ? parseFloat(iti.da || "0.0") : 0;
    const hotelAmt = parseFloat(iti.hotel || "0.0");
    const otherAmt = parseFloat(iti.oth_amount || "0.0");
    const lpAmt = parseFloat(iti.local_purchase || "0.0");
    totalDa += daAmt;
    totalHotel += hotelAmt;
    totalOther += otherAmt;
    totalLocalPurchase += lpAmt;
    calculatedTotal += travelAmt + subAmt + daAmt + hotelAmt + otherAmt + lpAmt;
    const mode = (iti.mode || "").trim().toLowerCase();
    if (["bike", "car"].includes(mode)) {
      newKm += parseFloat(iti.km || "0.0");
    } else if (mode === "auto") {
      newAuto += travelAmt;
    }
    const subMode = (iti.sub_mode || "").trim().toLowerCase();
    if (subMode === "auto") {
      newAuto += subAmt;
    }
    let actDetails = null;
    if (iti.activity_details) {
      try {
        actDetails = typeof iti.activity_details === "string" ? JSON.parse(iti.activity_details) : iti.activity_details;
      } catch (e) {
      }
    }
    let itiAssigned = parseInt(iti.ws_assigned || "0", 10);
    let itiCompleted = parseInt(iti.ws_closed || "0", 10);
    let itiPms = parseInt(iti.ws_pms || "0", 10);
    let itiAsset = parseInt(iti.ws_asset || "0", 10);
    let itiCalibration = parseInt(iti.calibration_count || "0", 10);
    let itiMobilise = parseInt(iti.mobilise_asset_count || "0", 10);
    if (actDetails) {
      const selectedActs = actDetails.selected_activities || [];
      if (selectedActs.includes("Calls")) {
        const callsList = actDetails.calls_list || [];
        itiAssigned = callsList.length;
        itiCompleted = callsList.filter((c) => c.barcode).length;
      } else {
        itiAssigned = 0;
        itiCompleted = 0;
      }
      if (selectedActs.includes("PMS")) {
        const pmsList = actDetails.pms_list || [];
        itiPms = pmsList.filter((p) => p.barcode).length;
      } else {
        itiPms = 0;
      }
      if (selectedActs.includes("Asset Tagging")) {
        const assetsList = actDetails.assets_list || [];
        itiAsset = assetsList.reduce((sum, item) => sum + (parseInt(item.quantity || "0", 10) || 0), 0);
      } else {
        itiAsset = 0;
      }
    }
    totalAssigned += itiAssigned;
    totalCompleted += itiCompleted;
    totalPms += itiPms;
    totalAsset += itiAsset;
    totalCalibration += itiCalibration;
    totalMobilise += itiMobilise;
  }
  amount = calculatedTotal;
  const gradeToLookup = (user.designation || "").toLowerCase().includes("specialist") ? "O1" : user.grade;
  const allowance = await env.DB.prepare("SELECT * FROM allowance_master WHERE grade = ?").bind(gradeToLookup).first();
  const maxKmPerMonth = allowance?.max_km_per_month ?? 2e3;
  const maxAutoPerMonth = 1e3;
  const mIdx = MONTH_NAMES.indexOf(claim_month);
  const mmNum = String(mIdx !== -1 ? mIdx + 1 : 1).padStart(2, "0");
  const monthStr = `${claim_year}-${mmNum}`;
  const limits = await env.DB.prepare(`
    SELECT 
      SUM(CASE WHEN request_type = 'KM' THEN COALESCE(approved_value, requested_value) ELSE 0.0 END) as approved_km,
      SUM(CASE WHEN request_type = 'AUTO' THEN COALESCE(approved_value, requested_value) ELSE 0.0 END) as approved_auto
    FROM limit_approval_requests
    WHERE user_id = ? AND LOWER(status) = 'approved' AND for_month = ?
  `).bind(user.user_id, monthStr).first();
  const approvedKm = limits?.approved_km || 0;
  const approvedAuto = limits?.approved_auto || 0;
  let statsQuery = `
    SELECT 
      SUM(CASE WHEN LOWER(TRIM(i.travel_mode)) IN ('bike', 'car') THEN COALESCE(i.distance_km, 0.0) ELSE 0.0 END) as total_km,
      SUM(CASE WHEN LOWER(TRIM(i.travel_mode)) = 'auto' THEN COALESCE(i.travel_amount, 0.0) ELSE 0.0 END) +
      SUM(CASE WHEN LOWER(TRIM(i.sub_mode)) = 'auto' THEN COALESCE(i.sub_amount, 0.0) ELSE 0.0 END) as total_auto
    FROM expense_itineraries i
    JOIN expenses e ON i.exp_id = e.expense_code
    WHERE e.user_id = ? AND e.month = ? AND e.year = ? AND e.status NOT IN ('rejected', 'returned_to_draft')
  `;
  const statsBinds = [user.id, claim_month, claim_year];
  if (editExpenseId) {
    statsQuery += " AND e.id != ?";
    statsBinds.push(editExpenseId);
  }
  const statsRes = await env.DB.prepare(statsQuery).bind(...statsBinds).first();
  const accumulatedKm = statsRes?.total_km || 0;
  const accumulatedAuto = statsRes?.total_auto || 0;
  if (accumulatedKm + newKm > maxKmPerMonth + approvedKm) {
    return jsonResponse3({
      error: `KM Limit Exceeded! Monthly allowance is ${maxKmPerMonth} KM. Approved extension: ${approvedKm} KM. Already claimed: ${accumulatedKm.toFixed(1)} KM. Attempted: +${newKm.toFixed(1)} KM. Total: ${(accumulatedKm + newKm).toFixed(1)} KM. Please request a limit extension first.`
    }, 400);
  }
  if (accumulatedAuto + newAuto > maxAutoPerMonth + approvedAuto) {
    return jsonResponse3({
      error: `Auto Expense Limit Exceeded! Monthly allowance is \u20B9${maxAutoPerMonth}. Approved extension: \u20B9${approvedAuto}. Already claimed: \u20B9${accumulatedAuto.toFixed(1)}. Attempted: +\u20B9${newAuto.toFixed(1)}. Total: \u20B9${(accumulatedAuto + newAuto).toFixed(1)}. Please request a limit extension first.`
    }, 400);
  }
  const majorMode = itineraries[0]?.mode || "Other";
  const firstPurpose = itineraries[0]?.visit_purpose || "Field visit";
  const approvalChain = await env.DB.prepare(`
    SELECT a.* 
    FROM hierarchy_approvers a
    JOIN hierarchy_requesters hr ON a.hierarchy_id = hr.hierarchy_id
    WHERE hr.user_id = ?
    ORDER BY a.level_number ASC
  `).bind(user.id).all();
  let status = "approved";
  let approvalsToInsert = [];
  if (amount <= 0) {
    status = "approved";
    approvalsToInsert = [];
  } else if (approvalChain.results && approvalChain.results.length > 0) {
    status = "submitted";
    for (const step of approvalChain.results) {
      approvalsToInsert.push({
        approver_id: step.approver_id,
        level_number: step.level_number,
        status: step.level_number === 1 ? "pending" : "waiting"
      });
    }
  } else {
    if ((user.role || "").trim().toLowerCase() !== "admin") {
      return jsonResponse3({ error: "You are not assigned to any approval hierarchy team. Please contact the administrator." }, 400);
    }
  }
  if (existingExpense) {
    await runWrite(env, `
      UPDATE expenses 
      SET month = ?, year = ?, amount = ?, status = ?, travel_mode = ?, itinerary = ?, description = ?,
          da_amount = ?, hotel_amount = ?, other_expense_amount = ?, calls_assigned = ?, calls_completed = ?, 
          pms_count = ?, asset_tagging = ?, local_purchase_amount = ?, original_amount = ?, original_da_amount = ?, 
          original_hotel_amount = ?, original_other_expense_amount = ?, original_local_purchase_amount = ?, 
          calibration_count = ?, mobilise_count = ?, updated_at = ?
      WHERE id = ?
    `, [
      claim_month,
      claim_year,
      amount,
      status,
      majorMode,
      date,
      firstPurpose,
      totalDa,
      totalHotel,
      totalOther,
      totalAssigned,
      totalCompleted,
      totalPms,
      totalAsset,
      totalLocalPurchase,
      amount,
      totalDa,
      totalHotel,
      totalOther,
      totalLocalPurchase,
      totalCalibration,
      totalMobilise,
      timestamp,
      newExpId
    ]);
  } else {
    const expRes = await runWrite(env, `
      INSERT INTO expenses (
        user_id, month, year, amount, status, travel_mode, itinerary, description, expense_code, 
        da_amount, hotel_amount, other_expense_amount, calls_assigned, calls_completed, pms_count, 
        asset_tagging, local_purchase_amount, original_amount, original_da_amount, original_hotel_amount, 
        original_other_expense_amount, original_local_purchase_amount, calibration_count, mobilise_count, 
        created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      user.id,
      claim_month,
      claim_year,
      amount,
      status,
      majorMode,
      date,
      firstPurpose,
      expenseCode,
      totalDa,
      totalHotel,
      totalOther,
      totalAssigned,
      totalCompleted,
      totalPms,
      totalAsset,
      totalLocalPurchase,
      amount,
      totalDa,
      totalHotel,
      totalOther,
      totalLocalPurchase,
      totalCalibration,
      totalMobilise,
      timestamp,
      timestamp
    ]);
    newExpId = expRes.meta?.last_row_id;
  }
  if (!newExpId)
    return jsonResponse3({ error: "Failed to save expense claim" }, 500);
  const handleAttachment = /* @__PURE__ */ __name(async (fileKey, billType, legNum) => {
    const file = formData.get(fileKey);
    if (file && typeof file === "object" && file.name) {
      const ext = file.name.split(".").pop().toLowerCase() || "jpg";
      const filename = `${expenseCode}_leg${legNum}_${billType}_${Date.now()}.${ext}`;
      const now = /* @__PURE__ */ new Date();
      const monthName = now.toLocaleString("en-US", { month: "long" });
      const yearVal = now.getFullYear();
      const folderName = `${monthName}_${yearVal}`;
      let fileUrl = "";
      try {
        fileUrl = await uploadFileWithFallback(env, file, folderName, filename);
      } catch (err) {
        console.error(`Failed to upload ${fileKey} with fallback:`, err);
        return;
      }
      await runWrite(env, `
        INSERT INTO expense_attachments (exp_id, itinerary_id, bill_type, file_url)
        VALUES (?, ?, ?, ?)
      `, [expenseCode, `${expenseCode}-${legNum}`, billType, fileUrl]);
    }
  }, "handleAttachment");
  for (let idx = 0; idx < itineraries.length; idx++) {
    const iti = itineraries[idx];
    const legNum = parseInt(iti.leg || idx + 1, 10);
    const itiId = `${expenseCode}-${legNum}`;
    const fromDist = iti.district_from || user.district || "Jodhpur";
    const toDist = iti.district || "Jodhpur";
    const isCommute = isBaseLocOnly && checkIsCommuteLeg(iti, baseLocations2, idx, itineraries.length);
    await runWrite(env, `
      INSERT INTO expense_itineraries (
        itinerary_id, exp_id, leg_number, from_district, to_district, from_location, to_location, 
        travel_mode, distance_km, travel_amount, sub_mode, sub_km, sub_amount, da_amount, hotel_amount, 
        local_purchase, other_desc, other_amount, calls_assigned, calls_completed, pms_count, asset_tagging, visit_purpose, 
        activity_details, original_distance_km, original_travel_amount, original_sub_amount, original_da_amount, 
        original_hotel_amount, original_other_amount, original_local_purchase, calibration_count, mobilise_count
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0.0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      itiId,
      expenseCode,
      legNum,
      fromDist,
      toDist,
      iti.from || "",
      iti.to || "",
      iti.mode || "Bike",
      parseFloat(iti.km || "0.0"),
      isCommute ? 0 : parseFloat(iti.amount || "0.0"),
      iti.sub_mode || null,
      isCommute ? 0 : parseFloat(iti.sub_amount || "0.0"),
      isDaAllowed ? parseFloat(iti.da || "0.0") : 0,
      parseFloat(iti.hotel || "0.0"),
      parseFloat(iti.local_purchase || "0.0"),
      iti.oth_desc || null,
      parseFloat(iti.oth_amount || "0.0"),
      parseInt(iti.ws_assigned || "0", 10),
      parseInt(iti.ws_closed || "0", 10),
      parseInt(iti.ws_pms || "0", 10),
      parseInt(iti.ws_asset || "0", 10),
      iti.visit_purpose || "Field visit",
      typeof iti.activity_details === "string" ? iti.activity_details : JSON.stringify(iti.activity_details || {}),
      parseFloat(iti.km || "0.0"),
      isCommute ? 0 : parseFloat(iti.amount || "0.0"),
      isCommute ? 0 : parseFloat(iti.sub_amount || "0.0"),
      isDaAllowed ? parseFloat(iti.da || "0.0") : 0,
      parseFloat(iti.hotel || "0.0"),
      parseFloat(iti.oth_amount || "0.0"),
      parseFloat(iti.local_purchase || "0.0"),
      parseInt(iti.calibration_count || "0", 10),
      parseInt(iti.mobilise_asset_count || "0", 10)
    ]);
    let actDetails = null;
    if (iti.activity_details) {
      try {
        actDetails = typeof iti.activity_details === "string" ? JSON.parse(iti.activity_details) : iti.activity_details;
      } catch (e) {
      }
    }
    if (actDetails) {
      const selectedActs = actDetails.selected_activities || [];
      if (selectedActs.includes("Calls")) {
        for (const call of actDetails.calls_list || []) {
          const asset = call.asset_details || {};
          await runWrite(env, `
            INSERT INTO expense_breakdown_calls (
              itinerary_id, barcode, call_type, call_status, district_name, hospital_name, 
              equipment_name, model_name, inventory_status, photo_url
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            itiId,
            call.barcode,
            call.type,
            call.status,
            asset.district_name,
            asset.hospital_name,
            asset.equipment_name,
            asset.model_name,
            asset.inventory_status,
            call.photo_url || ""
          ]);
        }
      }
      if (selectedActs.includes("PMS")) {
        for (const pms of actDetails.pms_list || []) {
          const asset = pms.asset_details || {};
          await runWrite(env, `
            INSERT INTO expense_pms_calls (
              itinerary_id, barcode, pms_frequency, district_name, hospital_name, 
              equipment_name, model_name, inventory_status, photo_url
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            itiId,
            pms.barcode,
            pms.frequency,
            asset.district_name,
            asset.hospital_name,
            asset.equipment_name,
            asset.model_name,
            asset.inventory_status,
            pms.photo_url || ""
          ]);
        }
      }
      if (selectedActs.includes("Asset Tagging")) {
        for (const asset of actDetails.assets_list || []) {
          await runWrite(env, `
            INSERT INTO expense_asset_taggings (itinerary_id, equipment_name, quantity)
            VALUES (?, ?, ?)
          `, [itiId, asset.equipment_name, parseInt(asset.quantity || "0", 10)]);
        }
      }
      if (selectedActs.includes("Mobilise Asset Update")) {
        const qty = parseInt(actDetails.mobilise_asset_count || "0", 10);
        if (qty > 0) {
          await runWrite(env, `
            INSERT INTO expense_asset_mobilises (itinerary_id, quantity)
            VALUES (?, ?)
          `, [itiId, qty]);
        }
      }
      if (selectedActs.includes("Calibration")) {
        const qty = parseInt(actDetails.calibration_count || "0", 10);
        if (qty > 0) {
          await runWrite(env, `
            INSERT INTO expense_calibrations (itinerary_id, quantity)
            VALUES (?, ?)
          `, [itiId, qty]);
        }
      }
      if (selectedActs.includes("Other")) {
        const otherDesc = actDetails.activity_other_desc || "";
        if (otherDesc && otherDesc.trim()) {
          await runWrite(env, `
            INSERT INTO expense_other_activities (itinerary_id, description)
            VALUES (?, ?)
          `, [itiId, otherDesc.trim()]);
        }
      }
    }
    await handleAttachment(`main_bill_${legNum}`, iti.mode || "Bill", legNum);
    if (iti.sub_mode) {
      await handleAttachment(`sub_bill_${legNum}`, iti.sub_mode, legNum);
    }
    await handleAttachment(`comm_mail_${legNum}`, "Communication_Mail", legNum);
    await handleAttachment(`oth_bill_${legNum}`, "Other", legNum);
    await handleAttachment(`hotel_bill_${legNum}`, "Hotel", legNum);
    await handleAttachment(`local_purchase_bill_${legNum}`, "Local_Purchase", legNum);
  }
  for (const step of approvalsToInsert) {
    await runWrite(env, `
      INSERT INTO approvals (expense_id, approver_id, level_number, status, comments, created_at, updated_at)
      VALUES (?, ?, ?, ?, '', ?, ?)
    `, [newExpId, step.approver_id, step.level_number, step.status, timestamp, timestamp]);
    if (step.status === "pending") {
      const approverUser = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(step.approver_id).first();
      if (approverUser) {
        await runWrite(env, "INSERT INTO notifications (user_id, title, description, type, read, link, created_at) VALUES (?, '\u{1F4E5} New Claim for Approval', ?, 'warning', 0, '/approval-center', ?)", [
          approverUser.user_id,
          `${user.name} submitted a new claim ${expenseCode} (\u20B9${amount}) for your review.`,
          timestamp
        ]);
      }
    }
  }
  let policyApplied = false;
  const deductionItems = [];
  if (isBaseLocOnly) {
    for (let idx = 0; idx < itineraries.length; idx++) {
      const iti = itineraries[idx];
      const legNum = idx + 1;
      const isCommute = checkIsCommuteLeg(iti, baseLocations2, idx, itineraries.length);
      const origTA = parseFloat(iti.original_travel_amount || iti.amount || "0.0");
      const origSub = parseFloat(iti.original_sub_amount || iti.sub_amount || "0.0");
      const origDA = legNum === 1 ? parseFloat(iti.original_da_amount || iti.da || "0.0") : 0;
      const taDeducted = isCommute ? origTA + origSub : 0;
      const daDeducted = isDaAllowed ? 0 : origDA;
      if (taDeducted > 0 || daDeducted > 0) {
        policyApplied = true;
        deductionItems.push({
          leg: legNum,
          from: iti.from || "",
          to: iti.to || "",
          taDeducted,
          daDeducted
        });
      }
    }
  }
  const successMsg = amount <= 0 ? policyApplied ? "Your claim has been auto-approved since the total reimbursable amount is \u20B90 after policy deductions. No manager approval is required." : "Your claim has been auto-approved since the total reimbursable amount is \u20B90. No manager approval is required." : "Expense claim submitted successfully.";
  return jsonResponse3({
    status: "success",
    message: successMsg,
    expense_id: newExpId,
    expense_code: expenseCode,
    auto_approved: amount <= 0,
    deductions: policyApplied ? {
      policyMessage: isBaseLocOnly ? !isDaAllowed ? "Under base location policy, both Travel Allowance (TA) and Daily Allowance (DA) are not eligible." : "Under base location policy, Travel Allowance (TA) is not eligible." : "",
      items: deductionItems
    } : null
  });
}
__name(handleSubmitExpense, "handleSubmitExpense");
async function handleRetroactiveBasePolicyCheck(request, env, params, query, adminUser) {
  const body = await request.json().catch(() => ({}));
  const targetUserId = body.user_id;
  const baseReportingLocation = body.base_reporting_location || "";
  if (!targetUserId) {
    return jsonResponse3({ error: "user_id is required" }, 400);
  }
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
  const today = /* @__PURE__ */ new Date();
  const currentMonth = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December"
  ][today.getMonth()];
  const currentYear = today.getFullYear();
  const targetUser = await env.DB.prepare("SELECT * FROM users WHERE user_id = ? OR id = ?").bind(targetUserId, parseInt(targetUserId, 10) || 0).first().catch(() => null);
  if (!targetUser) {
    return jsonResponse3({ error: "User not found" }, 404);
  }
  const activeExpenses = await env.DB.prepare(`
    SELECT id, expense_code, itinerary, amount, original_amount
    FROM expenses
    WHERE user_id = ? AND LOWER(month) = LOWER(?) AND year = ?
      AND LOWER(status) NOT IN ('rejected', 'returned_to_draft')
  `).bind(targetUser.id, currentMonth, currentYear).all().catch(() => ({ results: [] }));
  const expenses2 = activeExpenses.results || [];
  if (expenses2.length === 0) {
    return jsonResponse3({
      success: true,
      message: `No active expenses found for ${targetUser.name} in ${currentMonth} ${currentYear}.`,
      affected_expenses: 0,
      total_deducted: 0
    });
  }
  let affectedCount = 0;
  let totalDeducted = 0;
  const hospitalsRes = await env.DB.prepare("SELECT DISTINCT hospital_name FROM assets_inventory WHERE hospital_name IS NOT NULL").all().catch(() => ({ results: [] }));
  const officialHospitals = new Set((hospitalsRes.results || []).map((h) => h.hospital_name.trim().toLowerCase()));
  for (const exp of expenses2) {
    const legsRes = await env.DB.prepare(`
      SELECT itinerary_id, leg_number, from_location, to_location, travel_mode, sub_mode,
        distance_km, travel_amount, sub_amount, da_amount, hotel_amount, local_purchase,
        other_amount, original_travel_amount, original_sub_amount, original_da_amount,
        from_district, to_district, from_location AS "from", to_location AS "to"
      FROM expense_itineraries WHERE exp_id = ? ORDER BY leg_number ASC
    `).bind(exp.expense_code).all().catch(() => ({ results: [] }));
    const legs = (legsRes.results || []).map((leg) => {
      const fromLoc = (leg.from_location || "").trim().toLowerCase();
      const toLoc = (leg.to_location || "").trim().toLowerCase();
      const fromDist = (leg.from_district || "").trim().toLowerCase();
      const toDist = (leg.to_district || "").trim().toLowerCase();
      const isOutdoor = fromDist && toDist && fromDist !== toDist;
      const travelType = isOutdoor ? "Outdoor" : "In-District";
      const fromCustom = fromLoc && !officialHospitals.has(fromLoc);
      const toCustom = toLoc && !officialHospitals.has(toLoc);
      return {
        ...leg,
        from: leg.from_location || "",
        to: leg.to_location || "",
        from_custom: fromCustom,
        to_custom: toCustom,
        amount: leg.travel_amount,
        sub_amount: leg.sub_amount,
        da: leg.da_amount,
        travel_type: travelType
      };
    });
    const { isBaseLocOnly, isDaAllowed } = computeBaseLocPolicy(
      baseReportingLocation,
      legs
    );
    if (!isBaseLocOnly)
      continue;
    let expenseDeducted = 0;
    let policyApplied = false;
    const retroLegLogs = [];
    for (let idx = 0; idx < legs.length; idx++) {
      const leg = legs[idx];
      const isCommute = checkIsCommuteLeg(leg, baseLocations, idx, legs.length);
      const currentTA = parseFloat(leg.travel_amount || "0");
      const currentSubAmt = parseFloat(leg.sub_amount || "0");
      const currentDA = parseFloat(leg.da_amount || "0");
      const newTA = isCommute ? 0 : currentTA;
      const newSubAmt = isCommute ? 0 : currentSubAmt;
      const newDA = isDaAllowed ? currentDA : 0;
      if (currentTA > newTA) {
        retroLegLogs.push({
          leg_number: leg.leg_number,
          field_name: "travel_amount",
          old_value: currentTA,
          new_value: newTA,
          comment: "[Retroactive] Base Location commute TA not eligible"
        });
      }
      if (currentSubAmt > newSubAmt) {
        retroLegLogs.push({
          leg_number: leg.leg_number,
          field_name: "sub_amount",
          old_value: currentSubAmt,
          new_value: newSubAmt,
          comment: "[Retroactive] Base Location commute local conveyance not eligible"
        });
      }
      if (currentDA > newDA) {
        retroLegLogs.push({
          leg_number: leg.leg_number,
          field_name: "da_amount",
          old_value: currentDA,
          new_value: newDA,
          comment: "[Retroactive] DA not applicable at base location"
        });
      }
      const diff = currentTA - newTA + (currentSubAmt - newSubAmt) + (currentDA - newDA);
      if (diff > 0) {
        policyApplied = true;
        expenseDeducted += diff;
        await runWrite(env, `
          UPDATE expense_itineraries
          SET travel_amount = ?, sub_amount = ?, da_amount = ?
          WHERE itinerary_id = ?
        `, [newTA, newSubAmt, newDA, leg.itinerary_id]);
      }
    }
    if (policyApplied) {
      const newTotals = await env.DB.prepare(`
        SELECT SUM(travel_amount + sub_amount + da_amount + hotel_amount + other_amount + local_purchase) as new_total
        FROM expense_itineraries WHERE exp_id = ?
      `).bind(exp.expense_code).first().catch(() => ({ new_total: 0 }));
      const newTotal = parseFloat(newTotals?.new_total || 0);
      await runWrite(env, `
        UPDATE expenses SET amount = ?, da_amount = (
          SELECT SUM(da_amount) FROM expense_itineraries WHERE exp_id = ?
        ), updated_at = ? WHERE id = ?
      `, [newTotal, exp.expense_code, timestamp, exp.id]);
      const policyComment = buildPolicyComment(baseLocations, legs, isDaAllowed, exp.itinerary || timestamp.split("T")[0]);
      if (policyComment) {
        await runWrite(
          env,
          "INSERT INTO expense_edit_logs (expense_id, comment, editor_name, editor_role, editor_id) VALUES (?, ?, 'SYSTEM', 'Policy', 0)",
          [exp.id, `[Retroactive] ${policyComment}`]
        );
      }
      for (const log of retroLegLogs) {
        await runWrite(
          env,
          `INSERT INTO expense_edit_logs 
           (expense_id, leg_number, field_name, old_value, new_value, comment, editor_name, editor_role, editor_id)
           VALUES (?, ?, ?, ?, ?, ?, 'SYSTEM', 'Policy', 0)`,
          [exp.id, log.leg_number, log.field_name, String(log.old_value), String(log.new_value), log.comment]
        );
      }
      await runWrite(
        env,
        "INSERT INTO notifications (user_id, title, description, type, read, link, created_at) VALUES (?, ?, ?, 'warning', 0, '/expense', ?)",
        [
          targetUser.user_id,
          "\u26A0\uFE0F Expense Adjusted \u2014 Base Location Policy",
          `Your expense for ${exp.itinerary || "this period"} has been adjusted as per base location TA/DA policy. TA deducted for home-to-work commute.`,
          timestamp
        ]
      );
      affectedCount++;
      totalDeducted += expenseDeducted;
    }
  }
  return jsonResponse3({
    success: true,
    message: affectedCount > 0 ? `Base location policy applied. ${affectedCount} expense(s) adjusted for ${targetUser.name}. Total deducted: \u20B9${totalDeducted.toFixed(2)}.` : `No adjustments needed. Existing expenses for ${targetUser.name} already comply with the base location policy.`,
    affected_expenses: affectedCount,
    total_deducted: Math.round(totalDeducted * 100) / 100
  });
}
__name(handleRetroactiveBasePolicyCheck, "handleRetroactiveBasePolicyCheck");
async function handleGetMonthSummary(request, env, params, query, user) {
  const month = query.get("month");
  const year = parseInt(query.get("year") || "0", 10) || (/* @__PURE__ */ new Date()).getFullYear();
  const district = query.get("district");
  const engineer = query.get("engineer");
  const userRoleClean = (user.role || "").trim().toLowerCase();
  const isAdminOrReportViewer = ["admin", "mis", "vp", "accountant", "hr", "project head", "travel desk", "travel tesk"].includes(userRoleClean);
  const whereClauses = ["1=1"];
  const bindings = [];
  if (month) {
    whereClauses.push("UPPER(e.month) = UPPER(?)");
    bindings.push(month);
  }
  if (year) {
    whereClauses.push("e.year = ?");
    bindings.push(year);
  }
  if (userRoleClean === "engineer") {
    whereClauses.push("u.user_id = ?");
    bindings.push(user.user_id);
  } else if (!isAdminOrReportViewer) {
    const nameClean = (user.name || "").trim();
    const uidClean = (user.user_id || "").trim();
    const directReportsRes = await env.DB.prepare(`
      SELECT id FROM users
      WHERE LOWER(TRIM(manager)) = ? OR LOWER(TRIM(manager)) = ?
         OR LOWER(TRIM(coordinator)) = ? OR LOWER(TRIM(coordinator)) = ?
         OR LOWER(TRIM(zonal_manager)) = ? OR LOWER(TRIM(zonal_manager)) = ?
    `).bind(nameClean.toLowerCase(), uidClean.toLowerCase(), nameClean.toLowerCase(), uidClean.toLowerCase(), nameClean.toLowerCase(), uidClean.toLowerCase()).all();
    const directReports = directReportsRes.results || [];
    const hierarchyApprovals = await env.DB.prepare(`
      SELECT hierarchy_id FROM hierarchy_approvers WHERE approver_id = ?
    `).bind(user.id).all();
    let hierarchyReports = [];
    if (hierarchyApprovals.results && hierarchyApprovals.results.length > 0) {
      const hIds = hierarchyApprovals.results.map((h) => h.hierarchy_id);
      const placeholders = hIds.map(() => "?").join(",");
      const reqsRes = await env.DB.prepare(`
        SELECT u.id FROM users u
        JOIN hierarchy_requesters hr ON u.id = hr.user_id
        WHERE hr.hierarchy_id IN (${placeholders})
      `).bind(...hIds).all();
      hierarchyReports = reqsRes.results || [];
    }
    const teamIds = Array.from(/* @__PURE__ */ new Set([...directReports.map((u) => u.id), ...hierarchyReports.map((u) => u.id)]));
    if (teamIds.length === 0) {
      whereClauses.push("1=0");
    } else {
      const placeholders = teamIds.map(() => "?").join(",");
      whereClauses.push(`u.id IN (${placeholders})`);
      bindings.push(...teamIds);
    }
  }
  if (district) {
    whereClauses.push("LOWER(u.district) = LOWER(?)");
    bindings.push(district);
  }
  if (engineer) {
    whereClauses.push("(LOWER(u.name) LIKE ? OR LOWER(u.user_id) = LOWER(?))");
    bindings.push(`%${engineer.toLowerCase()}%`, engineer.toLowerCase());
  }
  const whereStr = whereClauses.join(" AND ");
  const result = await env.DB.prepare(`
    SELECT 
      u.user_id, u.name, u.district, u.zone, u.designation, u.grade,
      e.month as month, e.year,
      COUNT(e.id) as total_claims,
      SUM(e.amount) as total_amount,
      SUM(e.amount) as approved_amount,
      0 as pending_amount,
      0 as rejected_count,
      COUNT(e.id) as approved_count
    FROM expenses e
    JOIN users u ON e.user_id = u.id
    WHERE ${whereStr} AND LOWER(e.status) = 'approved'
    GROUP BY u.user_id, u.name, e.month, e.year
    ORDER BY u.name ASC
  `).bind(...bindings).all();
  let legacyRows = [];
  try {
    const legacyWhereClauses = ["1=1"];
    const legacyBindings = [];
    if (month) {
      legacyWhereClauses.push("strftime('%m', expense_date) = ?");
      const monthNum = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"].indexOf(month.toLowerCase()) + 1;
      legacyBindings.push(String(monthNum).padStart(2, "0"));
    }
    if (year) {
      legacyWhereClauses.push("strftime('%Y', expense_date) = ?");
      legacyBindings.push(String(year));
    }
    if (userRoleClean === "engineer") {
      legacyWhereClauses.push("LOWER(u.user_id) = LOWER(?)");
      legacyBindings.push(user.user_id);
    } else if (!isAdminOrReportViewer) {
      const nameClean = (user.name || "").trim();
      const uidClean = (user.user_id || "").trim();
      const directReportsRes = await env.DB.prepare(`
        SELECT id FROM users
        WHERE LOWER(TRIM(manager)) = ? OR LOWER(TRIM(manager)) = ?
           OR LOWER(TRIM(coordinator)) = ? OR LOWER(TRIM(coordinator)) = ?
           OR LOWER(TRIM(zonal_manager)) = ? OR LOWER(TRIM(zonal_manager)) = ?
      `).bind(nameClean.toLowerCase(), uidClean.toLowerCase(), nameClean.toLowerCase(), uidClean.toLowerCase(), nameClean.toLowerCase(), uidClean.toLowerCase()).all();
      const directReports = directReportsRes.results || [];
      const hierarchyApprovals = await env.DB.prepare(`
        SELECT hierarchy_id FROM hierarchy_approvers WHERE approver_id = ?
      `).bind(user.id).all();
      let hierarchyReports = [];
      if (hierarchyApprovals.results && hierarchyApprovals.results.length > 0) {
        const hIds = hierarchyApprovals.results.map((h) => h.hierarchy_id);
        const placeholders = hIds.map(() => "?").join(",");
        const reqsRes = await env.DB.prepare(`
          SELECT u.id FROM users u
          JOIN hierarchy_requesters hr ON u.id = hr.user_id
          WHERE hr.hierarchy_id IN (${placeholders})
        `).bind(...hIds).all();
        hierarchyReports = reqsRes.results || [];
      }
      const teamIds = Array.from(/* @__PURE__ */ new Set([...directReports.map((u) => u.id), ...hierarchyReports.map((u) => u.id)]));
      if (teamIds.length === 0) {
        legacyWhereClauses.push("1=0");
      } else {
        const placeholders = teamIds.map(() => "?").join(",");
        legacyWhereClauses.push(`u.id IN (${placeholders})`);
        legacyBindings.push(...teamIds);
      }
    }
    if (district) {
      legacyWhereClauses.push("LOWER(u.district) = LOWER(?)");
      legacyBindings.push(district);
    }
    const legacyRes = await env.DB.prepare(`
      SELECT 
        m.user_id, u.name, u.district, u.zone, u.designation, u.grade,
        COUNT(*) as total_claims,
        SUM(m.total_amount) as total_amount,
        SUM(m.total_amount) as approved_amount,
        0 as pending_amount,
        0 as rejected_count,
        COUNT(*) as approved_count
      FROM expense_master m
      JOIN users u ON LOWER(m.user_id) = LOWER(u.user_id)
      WHERE ${legacyWhereClauses.join(" AND ")} AND LOWER(m.status) = 'approved'
      GROUP BY m.user_id, u.name, u.district, u.zone
      ORDER BY u.name ASC
    `).bind(...legacyBindings).all();
    legacyRows = legacyRes.results || [];
  } catch (e) {
    console.warn("Legacy expenses fetch failed:", e.message);
  }
  const summaryMap = {};
  for (const row of result.results || []) {
    summaryMap[row.user_id] = row;
  }
  for (const row of legacyRows) {
    if (!summaryMap[row.user_id]) {
      summaryMap[row.user_id] = { ...row, month: month || "", year };
    } else {
      summaryMap[row.user_id].total_claims += row.total_claims || 0;
      summaryMap[row.user_id].total_amount = (parseFloat(summaryMap[row.user_id].total_amount) || 0) + (parseFloat(row.total_amount) || 0);
      summaryMap[row.user_id].approved_amount = (parseFloat(summaryMap[row.user_id].approved_amount) || 0) + (parseFloat(row.approved_amount) || 0);
      summaryMap[row.user_id].pending_amount = (parseFloat(summaryMap[row.user_id].pending_amount) || 0) + (parseFloat(row.pending_amount) || 0);
    }
  }
  let districts = [];
  try {
    const distRes = await env.DB.prepare(`
      SELECT DISTINCT district FROM users 
      WHERE district IS NOT NULL AND TRIM(district) != ''
      ORDER BY district ASC
    `).all();
    districts = (distRes.results || []).map((r) => r.district.trim());
  } catch (e) {
    console.error("Failed to fetch districts list:", e.message);
  }
  return jsonResponse3({
    success: true,
    data: Object.values(summaryMap),
    districts
  });
}
__name(handleGetMonthSummary, "handleGetMonthSummary");
async function handleGetEngineerMonthClaims(request, env, params, query, user) {
  const userCode = query.get("user_code");
  const month = query.get("month");
  const year = parseInt(query.get("year") || "0", 10) || (/* @__PURE__ */ new Date()).getFullYear();
  if (!userCode || !month) {
    return jsonResponse3({ error: "user_code and month are required" }, 400);
  }
  const targetUser = await env.DB.prepare("SELECT * FROM users WHERE user_id = ? OR e_code = ?").bind(userCode, userCode).first();
  if (!targetUser) {
    return jsonResponse3({ error: "Engineer not found" }, 404);
  }
  const claims = [];
  const assetCosts = {};
  try {
    const assetCostsRes = await env.DB.prepare("SELECT equipment_name, rmsc_tender_cost FROM asset_value_master").all();
    for (const r of assetCostsRes.results || []) {
      if (r.equipment_name) {
        assetCosts[r.equipment_name.trim().toLowerCase()] = parseFloat(r.rmsc_tender_cost || 0);
      }
    }
  } catch (e) {
    console.warn("Failed to load asset costs:", e.message);
  }
  let expenses2 = [];
  try {
    const expensesRes = await env.DB.prepare(`
      SELECT * FROM expenses 
      WHERE user_id = ? AND UPPER(month) = UPPER(?) AND year = ? AND LOWER(status) = 'approved'
      ORDER BY itinerary ASC
    `).bind(targetUser.id, month, year).all();
    expenses2 = expensesRes.results || [];
    const expCodes = expenses2.map((e) => e.expense_code).filter(Boolean);
    let allLegs = [];
    if (expCodes.length > 0) {
      const placeholders = expCodes.map(() => "?").join(",");
      const legsRes = await env.DB.prepare(`
        SELECT * FROM expense_itineraries 
        WHERE exp_id IN (${placeholders}) 
        ORDER BY exp_id ASC, leg_number ASC
      `).bind(...expCodes).all();
      allLegs = legsRes.results || [];
    }
    const legsMap = {};
    for (const leg of allLegs) {
      if (!legsMap[leg.exp_id]) {
        legsMap[leg.exp_id] = [];
      }
      legsMap[leg.exp_id].push(leg);
    }
    const itiIds = allLegs.map((l) => l.itinerary_id).filter(Boolean);
    let allTaggings = [];
    if (itiIds.length > 0) {
      const placeholders = itiIds.map(() => "?").join(",");
      const tagRes = await env.DB.prepare(`
        SELECT * FROM expense_asset_taggings 
        WHERE itinerary_id IN (${placeholders})
      `).bind(...itiIds).all();
      allTaggings = tagRes.results || [];
    }
    const taggingsMap = {};
    for (const t of allTaggings) {
      if (!taggingsMap[t.itinerary_id]) {
        taggingsMap[t.itinerary_id] = [];
      }
      taggingsMap[t.itinerary_id].push(t);
    }
    for (const exp of expenses2) {
      const legs = legsMap[exp.expense_code] || [];
      const legData = [];
      for (const leg of legs) {
        let barcodes = [];
        if (leg.activity_details) {
          try {
            const act = typeof leg.activity_details === "string" ? JSON.parse(leg.activity_details) : leg.activity_details;
            if (act && typeof act === "object") {
              for (const item of act.calls_list || []) {
                if (item.barcode)
                  barcodes.push(item.barcode);
              }
              for (const item of act.pms_list || []) {
                if (item.barcode && !barcodes.includes(item.barcode)) {
                  barcodes.push(item.barcode);
                }
              }
            }
          } catch (err) {
          }
        }
        let totalTagQty = 0;
        let totalTagVal = 0;
        const taggings = taggingsMap[leg.itinerary_id] || [];
        for (const t of taggings) {
          const qty = t.quantity || 0;
          totalTagQty += qty;
          const eqName = (t.equipment_name || "").trim().toLowerCase();
          const cost = assetCosts[eqName] || 0;
          totalTagVal += qty * cost;
        }
        let tagInfo = "";
        if (totalTagQty > 0) {
          tagInfo = `Qty: ${totalTagQty} | \u20B9${totalTagVal.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
        }
        let barcodeTicketStr = barcodes.join(", ");
        if (tagInfo) {
          barcodeTicketStr = barcodeTicketStr ? `${barcodeTicketStr} | ${tagInfo}` : tagInfo;
        }
        const mode = (leg.travel_mode || "").trim().toLowerCase();
        const subMode = (leg.sub_mode || "").trim().toLowerCase();
        const autoAmt = (mode === "auto" ? parseFloat(leg.travel_amount || 0) : 0) + (subMode === "auto" ? parseFloat(leg.sub_amount || 0) : 0);
        legData.push({
          leg_number: leg.leg_number,
          from_location: leg.from_location || leg.from_district || "\u2014",
          to_location: leg.to_location || leg.to_district || "\u2014",
          travel_mode: leg.travel_mode || "\u2014",
          distance_km: parseFloat(leg.distance_km || 0),
          bike_km: mode === "bike" ? parseFloat(leg.distance_km || 0) : 0,
          car_km: mode === "car" ? parseFloat(leg.distance_km || 0) : 0,
          bike_amount: mode === "bike" ? parseFloat(leg.travel_amount || 0) : 0,
          car_amount: mode === "car" ? parseFloat(leg.travel_amount || 0) : 0,
          auto_amount: autoAmt,
          da_amount: parseFloat(leg.da_amount || 0),
          hotel_amount: parseFloat(leg.hotel_amount || 0),
          local_purchase: parseFloat(leg.local_purchase || 0),
          other_amount: parseFloat(leg.other_amount || 0),
          other_desc: leg.other_desc || "",
          visit_purpose: leg.visit_purpose || "",
          calls_assigned: leg.calls_assigned || 0,
          ws_assigned: leg.calls_assigned || 0,
          calls_completed: leg.calls_completed || 0,
          ws_closed: leg.calls_completed || 0,
          pms_count: leg.pms_count || 0,
          ws_pms: leg.pms_count || 0,
          ws_asset: leg.asset_tagging || 0,
          asset_tagging: leg.asset_tagging || 0,
          calibration_count: leg.calibration_count || 0,
          mobilise_count: leg.mobilise_count || 0,
          mobilise_asset_count: leg.mobilise_count || 0,
          worked_district: leg.to_district || leg.from_district || "",
          ta_amount: ["train", "bus"].includes(mode) ? parseFloat(leg.travel_amount || 0) : 0,
          sub_mode: leg.sub_mode || "",
          sub_amount: parseFloat(leg.sub_amount || 0),
          barcode_ticket: barcodeTicketStr,
          asset_tagging_qty: totalTagQty,
          asset_tagging_val: totalTagVal,
          activity_details: leg.activity_details || ""
        });
      }
      claims.push({
        expense_code: exp.expense_code,
        date: exp.itinerary,
        amount: parseFloat(exp.amount || 0),
        da_amount: parseFloat(exp.da_amount || 0),
        hotel_amount: parseFloat(exp.hotel_amount || 0),
        other_amount: parseFloat(exp.other_expense_amount || 0),
        local_purchase_amount: parseFloat(exp.local_purchase_amount || 0),
        legs: legData
      });
    }
  } catch (e) {
    console.warn("New expenses fetch failed:", e.message);
  }
  let legacyExpenses = [];
  try {
    const legacyRes = await env.DB.prepare(`
      SELECT * FROM expense_master
      WHERE LOWER(user_id) = LOWER(?)
        AND strftime('%m', expense_date) = ?
        AND strftime('%Y', expense_date) = ?
        AND LOWER(status) = 'approved'
      ORDER BY expense_date ASC
    `).bind(
      userCode,
      String(["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"].indexOf(month.toLowerCase()) + 1).padStart(2, "0"),
      String(year)
    ).all();
    legacyExpenses = legacyRes.results || [];
    const legacyExpIds = legacyExpenses.map((e) => e.exp_id).filter(Boolean);
    let legacyLegs = [];
    if (legacyExpIds.length > 0) {
      const placeholders = legacyExpIds.map(() => "?").join(",");
      const legacyLegsRes = await env.DB.prepare(`
        SELECT * FROM expense_itineraries 
        WHERE exp_id IN (${placeholders}) 
        ORDER BY exp_id ASC, leg_number ASC
      `).bind(...legacyExpIds).all();
      legacyLegs = legacyLegsRes.results || [];
    }
    const legacyLegsMap = {};
    for (const leg of legacyLegs) {
      if (!legacyLegsMap[leg.exp_id]) {
        legacyLegsMap[leg.exp_id] = [];
      }
      legacyLegsMap[leg.exp_id].push(leg);
    }
    for (const exp of legacyExpenses) {
      const legs = legacyLegsMap[exp.exp_id] || [];
      const legData = [];
      for (const leg of legs) {
        legData.push({
          leg_number: leg.leg_number,
          from_location: leg.from_location || "\u2014",
          to_location: leg.to_location || "\u2014",
          travel_mode: leg.travel_mode || "\u2014",
          distance_km: parseFloat(leg.distance_km || 0),
          bike_km: leg.travel_mode === "Bike" ? parseFloat(leg.distance_km || 0) : 0,
          car_km: leg.travel_mode === "Car" ? parseFloat(leg.distance_km || 0) : 0,
          bike_amount: parseFloat(leg.bike_amount || 0),
          car_amount: parseFloat(leg.car_amount || 0),
          auto_amount: parseFloat(leg.auto_amount || 0),
          da_amount: parseFloat(leg.da_amount || 0),
          hotel_amount: parseFloat(leg.hotel_amount || 0),
          local_purchase: parseFloat(leg.local_purchase || 0),
          other_amount: parseFloat(leg.other_amount || 0),
          other_desc: leg.other_desc || "",
          visit_purpose: leg.visit_purpose || "",
          calls_assigned: leg.calls_assigned || 0,
          ws_assigned: leg.calls_assigned || 0,
          calls_completed: leg.calls_completed || 0,
          ws_closed: leg.calls_completed || 0,
          pms_count: leg.pms_count || 0,
          ws_pms: leg.pms_count || 0,
          ws_asset: leg.asset_tagging || 0,
          asset_tagging: leg.asset_tagging || 0,
          calibration_count: leg.calibration_count || 0,
          mobilise_count: leg.mobilise_count || 0,
          mobilise_asset_count: leg.mobilise_count || 0,
          worked_district: leg.worked_district || "",
          ta_amount: parseFloat(leg.ta_amount || 0),
          sub_mode: leg.sub_mode || "",
          sub_amount: parseFloat(leg.sub_amount || 0),
          barcode_ticket: leg.barcode_ticket || "",
          asset_tagging_qty: leg.asset_tagging_qty || 0,
          asset_tagging_val: leg.asset_tagging_val || 0,
          activity_details: leg.activity_details || ""
        });
      }
      claims.push({
        expense_code: exp.exp_id,
        date: exp.expense_date,
        amount: parseFloat(exp.total_amount || 0),
        da_amount: parseFloat(exp.da_amount || 0),
        hotel_amount: parseFloat(exp.hotel_amount || 0),
        other_amount: parseFloat(exp.other_amount || 0),
        local_purchase_amount: parseFloat(exp.local_purchase || 0),
        legs: legData
      });
    }
  } catch (e) {
    console.warn("Legacy expense_master fetch failed:", e.message);
  }
  const defaultUserObj = {
    name: targetUser.name,
    user_id: targetUser.user_id,
    e_code: targetUser.e_code || targetUser.user_id,
    grade: targetUser.grade || "",
    designation: targetUser.designation || "Engineer",
    district: targetUser.district || "",
    zone: targetUser.zone || "",
    manager: targetUser.manager || "",
    coordinator: targetUser.coordinator || "",
    mobile: targetUser.mobile_number || "",
    type: targetUser.type || (targetUser.zone || ""),
    month,
    year
  };
  const expenseCodes = claims.map((c) => c.expense_code);
  const validAttachments = [];
  if (expenseCodes.length > 0) {
    try {
      const placeholders = expenseCodes.map(() => "?").join(",");
      const attachRes = await env.DB.prepare(`
        SELECT * FROM expense_attachments 
        WHERE exp_id IN (${placeholders})
      `).bind(...expenseCodes).all();
      const expenseDateMap = {};
      for (const c of claims) {
        expenseDateMap[c.expense_code] = c.date;
      }
      const legsMap = {};
      for (const c of claims) {
        for (const leg of c.legs || []) {
          const key = `${c.expense_code}-${leg.leg_number}`.toLowerCase();
          legsMap[key] = leg;
        }
      }
      for (const a of attachRes.results || []) {
        const billType = (a.bill_type || "").toLowerCase();
        if (a.file_url && !billType.includes("pms") && !billType.includes("call")) {
          const legKey = `${a.exp_id}-${a.itinerary_id.split("-").pop()}`.toLowerCase();
          const leg = legsMap[legKey];
          if (leg) {
            let isApprovedAmountZero = false;
            if (billType === "hotel") {
              isApprovedAmountZero = (parseFloat(leg.hotel_amount) || 0) === 0;
            } else if (billType === "local_purchase") {
              isApprovedAmountZero = (parseFloat(leg.local_purchase) || 0) === 0;
            } else if (billType === "other" || billType === "other_expense") {
              isApprovedAmountZero = (parseFloat(leg.other_amount) || 0) === 0;
            } else if (leg.travel_mode && billType === leg.travel_mode.toLowerCase()) {
              isApprovedAmountZero = (parseFloat(leg.travel_amount) || 0) === 0;
            } else if (leg.sub_mode && billType === leg.sub_mode.toLowerCase()) {
              isApprovedAmountZero = (parseFloat(leg.sub_amount) || 0) === 0;
            }
            if (isApprovedAmountZero) {
              continue;
            }
          }
          validAttachments.push({
            file_url: a.file_url,
            date: expenseDateMap[a.exp_id] || ""
          });
        }
      }
    } catch (e) {
      console.warn("Attachments fetch failed:", e.message);
    }
  }
  return jsonResponse3({
    success: true,
    user: defaultUserObj,
    claims,
    attachments: validAttachments
  });
}
__name(handleGetEngineerMonthClaims, "handleGetEngineerMonthClaims");
async function handleGetEngineerAdvance(request, env, params, query, user) {
  const userCode = query.get("user_code");
  const month = query.get("month");
  const year = parseInt(query.get("year") || "0", 10) || (/* @__PURE__ */ new Date()).getFullYear();
  if (!userCode || !month) {
    return jsonResponse3({ error: "user_code and month are required" }, 400);
  }
  const record = await env.DB.prepare(`
    SELECT * FROM engineer_advances
    WHERE LOWER(user_id) = LOWER(?) AND LOWER(month) = LOWER(?) AND year = ?
    LIMIT 1
  `).bind(userCode, month, year).first().catch(() => null);
  return jsonResponse3({
    user_code: userCode,
    month,
    year,
    advance_amount: parseFloat(record?.advance_amount || 0)
  });
}
__name(handleGetEngineerAdvance, "handleGetEngineerAdvance");
async function handleSaveEngineerAdvance(request, env, params, query, user) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse3({ error: "Invalid JSON body" }, 400);
  }
  const { user_code, month, year, advance_amount } = body;
  if (!user_code || !month || !year) {
    return jsonResponse3({ error: "user_code, month, and year are required" }, 400);
  }
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
  const amount = parseFloat(advance_amount || 0);
  const existing = await env.DB.prepare(`
    SELECT id FROM engineer_advances
    WHERE LOWER(user_id) = LOWER(?) AND LOWER(month) = LOWER(?) AND year = ?
  `).bind(user_code, month, year).first().catch(() => null);
  if (existing) {
    await runWrite(env, "UPDATE engineer_advances SET advance_amount = ?, updated_at = ? WHERE id = ?", [amount, timestamp, existing.id]);
  } else {
    await runWrite(env, `
      INSERT INTO engineer_advances (user_id, month, year, advance_amount, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [user_code, month, year, amount, timestamp, timestamp]).catch(async () => {
      await runWrite(env, `
        INSERT INTO engineer_advances (user_id, month, year, advance_amount, created_at)
        VALUES (?, ?, ?, ?, ?)
      `, [user_code, month, year, amount, timestamp]);
    });
  }
  return jsonResponse3({ status: "success", message: "Advance saved successfully", advance_amount: amount });
}
__name(handleSaveEngineerAdvance, "handleSaveEngineerAdvance");
async function handleGetConsolidatedReport(request, env, params, query, user) {
  const month = query.get("month");
  const year = parseInt(query.get("year") || "0", 10) || (/* @__PURE__ */ new Date()).getFullYear();
  if (!month) {
    return jsonResponse3({ error: "month is required" }, 400);
  }
  const usersRes = await env.DB.prepare(`
    SELECT id, user_id, name, district, zone, grade, designation, date_of_joining, e_code, manager FROM users
  `).all().catch(() => ({ results: [] }));
  const allUsers = usersRes.results || [];
  const userRoleClean = (user.role || "").trim().toLowerCase();
  const isAdminOrReportViewer = ["admin", "mis", "vp", "accountant", "hr", "project head", "travel desk", "travel tesk"].includes(userRoleClean);
  const allowedUserCodesSet = /* @__PURE__ */ new Set();
  let filteredUsers = [];
  if (isAdminOrReportViewer) {
    for (const u of allUsers) {
      if (u.id)
        allowedUserCodesSet.add(u.id);
    }
    filteredUsers = allUsers;
  } else {
    const nameClean = (user.name || "").trim();
    const uidClean = (user.user_id || "").trim();
    const directReportsRes = await env.DB.prepare(`
      SELECT id, user_id FROM users
      WHERE LOWER(TRIM(manager)) = ? OR LOWER(TRIM(manager)) = ?
         OR LOWER(TRIM(coordinator)) = ? OR LOWER(TRIM(coordinator)) = ?
         OR LOWER(TRIM(zonal_manager)) = ? OR LOWER(TRIM(zonal_manager)) = ?
    `).bind(
      nameClean.toLowerCase(),
      uidClean.toLowerCase(),
      nameClean.toLowerCase(),
      uidClean.toLowerCase(),
      nameClean.toLowerCase(),
      uidClean.toLowerCase()
    ).all().catch(() => ({ results: [] }));
    const directReports = directReportsRes.results || [];
    for (const r of directReports) {
      if (r.id)
        allowedUserCodesSet.add(r.id);
    }
    const hierarchyApprovals = await env.DB.prepare(`
      SELECT hierarchy_id FROM hierarchy_approvers WHERE approver_id = ?
    `).bind(user.id).all().catch(() => ({ results: [] }));
    if (hierarchyApprovals.results && hierarchyApprovals.results.length > 0) {
      const hIds = hierarchyApprovals.results.map((h) => h.hierarchy_id);
      const placeholders = hIds.map(() => "?").join(",");
      const reqsRes = await env.DB.prepare(`
        SELECT id, user_id FROM hierarchy_requesters
        WHERE hierarchy_id IN (${placeholders})
      `).bind(...hIds).all().catch(() => ({ results: [] }));
      for (const r of reqsRes.results || []) {
        if (r.id)
          allowedUserCodesSet.add(r.id);
      }
    }
    if (user.id)
      allowedUserCodesSet.add(user.id);
    filteredUsers = allUsers.filter((u) => u.id && allowedUserCodesSet.has(u.id));
  }
  const allowedUserCodes = Array.from(allowedUserCodesSet);
  const nameLookupMap = {};
  for (const u of allUsers) {
    if (u.user_id)
      nameLookupMap[u.user_id.toLowerCase().trim()] = u.name;
    if (u.e_code)
      nameLookupMap[u.e_code.toLowerCase().trim()] = u.name;
    if (u.name)
      nameLookupMap[u.name.toLowerCase().trim()] = u.name;
  }
  const userMap = {};
  const userByCode = {};
  for (const u of filteredUsers) {
    userMap[u.id] = u;
    userByCode[u.user_id] = u;
  }
  let expenses2 = [];
  if (allowedUserCodes.length > 0) {
    const chunkSize = 50;
    for (let i = 0; i < allowedUserCodes.length; i += chunkSize) {
      const chunk = allowedUserCodes.slice(i, i + chunkSize);
      const placeholders = chunk.map(() => "?").join(",");
      const chunkRes = await env.DB.prepare(`
        SELECT id, user_id, expense_code, amount, original_amount, status, itinerary, created_at FROM expenses
        WHERE UPPER(month) = UPPER(?) AND year = ? AND LOWER(status) = 'approved' AND user_id IN (${placeholders})
      `).bind(month, year, ...chunk).all().catch(() => ({ results: [] }));
      if (chunkRes.results) {
        expenses2 = expenses2.concat(chunkRes.results);
      }
    }
  }
  if (expenses2.length === 0) {
    return jsonResponse3({ success: true, data: [] });
  }
  const expenseCodes = expenses2.map((e) => e.expense_code).filter(Boolean);
  let legs = [];
  if (expenseCodes.length > 0) {
    try {
      legs = await queryInChunks2(
        env.DB,
        "SELECT exp_id, travel_mode, sub_mode, distance_km, travel_amount, sub_amount, da_amount, local_purchase, hotel_amount, other_desc, other_amount, original_distance_km, original_travel_amount, original_sub_amount, original_da_amount, original_local_purchase, original_hotel_amount, original_other_amount FROM expense_itineraries WHERE exp_id IN (?)",
        expenseCodes
      );
    } catch (e) {
      console.error("Consolidated report itineraries query failed:", e.message);
    }
  }
  const legsByCode = {};
  for (const leg of legs) {
    const key = (leg.exp_id || "").trim().toUpperCase();
    if (!legsByCode[key])
      legsByCode[key] = [];
    legsByCode[key].push(leg);
  }
  const advancesRes = await env.DB.prepare(`
    SELECT user_id, advance_amount FROM engineer_advances
    WHERE LOWER(month) = LOWER(?) AND year = ?
  `).bind(month, year).all().catch(() => ({ results: [] }));
  const advances = advancesRes.results || [];
  const advancesMap = {};
  for (const adv of advances) {
    advancesMap[(adv.user_id || "").toLowerCase()] = parseFloat(adv.advance_amount || 0);
  }
  const expenseIds = expenses2.map((e) => e.id);
  let editLogs = [];
  if (expenseIds.length > 0) {
    try {
      editLogs = await queryInChunks2(
        env.DB,
        "SELECT expense_id, comment FROM expense_edit_logs WHERE expense_id IN (?)",
        expenseIds
      );
    } catch (e) {
      console.error("Consolidated report edit logs query failed:", e.message);
    }
  }
  const commentsByExpense = {};
  for (const log of editLogs) {
    if (log.comment && log.comment.trim()) {
      if (!commentsByExpense[log.expense_id])
        commentsByExpense[log.expense_id] = [];
      commentsByExpense[log.expense_id].push(log.comment.trim());
    }
  }
  const expensesByUser = {};
  for (const exp of expenses2) {
    const usr = userMap[exp.user_id];
    if (!usr)
      continue;
    if (!expensesByUser[usr.user_id])
      expensesByUser[usr.user_id] = [];
    expensesByUser[usr.user_id].push(exp);
  }
  const reportRows = [];
  for (const [user_code, userExps] of Object.entries(expensesByUser)) {
    const usr = userByCode[user_code];
    if (!usr)
      continue;
    let travel_expense = 0;
    let bike_km = 0;
    let car_km = 0;
    let auto_amount = 0;
    let train_bus_amount = 0;
    let da_allowance = 0;
    let spare_purchase = 0;
    let courier_charges = 0;
    let boarding_lodging = 0;
    let printing_stationery = 0;
    let claimed_amount = 0;
    const allComments = [];
    const claimDates = [];
    const kmDeductions = {};
    const autoDeductions = {};
    const daDeductions = {};
    const hotelDeductions = {};
    const spareDeductions = {};
    const otherDeductions = {};
    for (const exp of userExps) {
      claimed_amount += parseFloat(exp.original_amount || exp.amount || 0);
      if (exp.itinerary) {
        const parts = exp.itinerary.split("-");
        if (parts.length === 3) {
          claimDates.push(`${parts[2]}-${parts[1]}-${parts[0]}`);
        } else {
          claimDates.push(exp.itinerary);
        }
      } else if (exp.created_at) {
        const datePart = exp.created_at.split(" ")[0];
        const parts = datePart.split("-");
        if (parts.length === 3) {
          claimDates.push(`${parts[2]}-${parts[1]}-${parts[0]}`);
        } else {
          claimDates.push(datePart);
        }
      }
      const expComments = commentsByExpense[exp.id] || [];
      allComments.push(...expComments);
      const expLegs = legsByCode[(exp.expense_code || "").trim().toUpperCase()] || [];
      for (const leg of expLegs) {
        let day = 0;
        if (exp.itinerary) {
          day = parseInt(exp.itinerary.split("-")[2], 10) || 0;
        } else if (exp.created_at) {
          const datePart = exp.created_at.split(" ")[0];
          day = parseInt(datePart.split("-")[2], 10) || 0;
        }
        const mode = (leg.travel_mode || "").trim().toLowerCase();
        const sub_mode = (leg.sub_mode || "").trim().toLowerCase();
        let km_part = 0;
        if (mode === "bike") {
          km_part = parseFloat(leg.distance_km || 0) * 4.5;
          bike_km += parseFloat(leg.distance_km || 0);
        } else if (mode === "car") {
          km_part = parseFloat(leg.distance_km || 0) * 9;
          car_km += parseFloat(leg.distance_km || 0);
        }
        let auto_part = 0;
        if (mode === "auto") {
          auto_part += parseFloat(leg.travel_amount || 0);
          auto_amount += parseFloat(leg.travel_amount || 0);
        }
        if (sub_mode === "auto") {
          auto_part += parseFloat(leg.sub_amount || 0);
          auto_amount += parseFloat(leg.sub_amount || 0);
        }
        let ta_part = 0;
        if (mode === "train" || mode === "bus") {
          ta_part += parseFloat(leg.travel_amount || 0);
          train_bus_amount += parseFloat(leg.travel_amount || 0);
        }
        travel_expense += km_part + auto_part + ta_part;
        da_allowance += parseFloat(leg.da_amount || 0);
        spare_purchase += parseFloat(leg.local_purchase || 0);
        boarding_lodging += parseFloat(leg.hotel_amount || 0);
        const oth_desc = (leg.other_desc || "").trim().toLowerCase();
        const oth_amt = parseFloat(leg.other_amount || 0);
        if (oth_amt > 0) {
          if (oth_desc.includes("courier") || oth_desc.includes("courrier")) {
            courier_charges += oth_amt;
          } else {
            printing_stationery += oth_amt;
          }
        }
        const kmDiff = parseFloat(leg.original_distance_km || 0) - parseFloat(leg.distance_km || 0);
        const autoDiff = ((leg.travel_mode || "").trim().toLowerCase() === "auto" ? parseFloat(leg.original_travel_amount || 0) - parseFloat(leg.travel_amount || 0) : 0) + ((leg.sub_mode || "").trim().toLowerCase() === "auto" ? parseFloat(leg.original_sub_amount || 0) - parseFloat(leg.sub_amount || 0) : 0);
        const daDiff = parseFloat(leg.original_da_amount || 0) - parseFloat(leg.da_amount || 0);
        const hotelDiff = parseFloat(leg.original_hotel_amount || 0) - parseFloat(leg.hotel_amount || 0);
        const spareDiff = parseFloat(leg.original_local_purchase || 0) - parseFloat(leg.local_purchase || 0);
        const otherDiff = parseFloat(leg.original_other_amount || 0) - parseFloat(leg.other_amount || 0);
        if (day > 0) {
          if (kmDiff > 0)
            kmDeductions[day] = (kmDeductions[day] || 0) + kmDiff;
          if (autoDiff > 0)
            autoDeductions[day] = (autoDeductions[day] || 0) + autoDiff;
          if (daDiff > 0)
            daDeductions[day] = (daDeductions[day] || 0) + daDiff;
          if (hotelDiff > 0)
            hotelDeductions[day] = (hotelDeductions[day] || 0) + hotelDiff;
          if (spareDiff > 0)
            spareDeductions[day] = (spareDeductions[day] || 0) + spareDiff;
          if (otherDiff > 0)
            otherDeductions[day] = (otherDeductions[day] || 0) + otherDiff;
        }
      }
    }
    const categoryTexts = [];
    const kmDays = Object.keys(kmDeductions).map(Number).sort((a, b) => a - b);
    if (kmDays.length > 0) {
      const totalKm = kmDays.reduce((sum, d) => sum + kmDeductions[d], 0);
      categoryTexts.push(`KM: ${totalKm}km (${kmDays.length} days: ${kmDays.join(",")})`);
    }
    const autoDays = Object.keys(autoDeductions).map(Number).sort((a, b) => a - b);
    if (autoDays.length > 0) {
      const totalAuto = autoDays.reduce((sum, d) => sum + autoDeductions[d], 0);
      categoryTexts.push(`Auto: ${totalAuto} (${autoDays.length} days: ${autoDays.join(",")})`);
    }
    const daDays = Object.keys(daDeductions).map(Number).sort((a, b) => a - b);
    if (daDays.length > 0) {
      const totalDa = daDays.reduce((sum, d) => sum + daDeductions[d], 0);
      categoryTexts.push(`DA: ${totalDa} (${daDays.length} days: ${daDays.join(",")})`);
    }
    const hotelDays = Object.keys(hotelDeductions).map(Number).sort((a, b) => a - b);
    if (hotelDays.length > 0) {
      const totalHotel = hotelDays.reduce((sum, d) => sum + hotelDeductions[d], 0);
      categoryTexts.push(`Hotel: ${totalHotel} (${hotelDays.length} days: ${hotelDays.join(",")})`);
    }
    const spareDays = Object.keys(spareDeductions).map(Number).sort((a, b) => a - b);
    if (spareDays.length > 0) {
      const totalSpare = spareDays.reduce((sum, d) => sum + spareDeductions[d], 0);
      categoryTexts.push(`Spare: ${totalSpare} (${spareDays.length} days: ${spareDays.join(",")})`);
    }
    const otherDays = Object.keys(otherDeductions).map(Number).sort((a, b) => a - b);
    if (otherDays.length > 0) {
      const totalOther = otherDays.reduce((sum, d) => sum + otherDeductions[d], 0);
      categoryTexts.push(`Other: ${totalOther} (${otherDays.length} days: ${otherDays.join(",")})`);
    }
    const user_advance = advancesMap[(usr.user_id || "").toLowerCase()] || 0;
    const row_total = travel_expense + da_allowance + spare_purchase + courier_charges + boarding_lodging + printing_stationery;
    const net_payable = row_total - user_advance;
    const nextMonthMap = {
      january: "February",
      february: "March",
      march: "April",
      april: "May",
      may: "June",
      june: "July",
      july: "August",
      august: "September",
      september: "October",
      october: "November",
      november: "December",
      december: "January"
    };
    const mClean = month.trim().toLowerCase();
    let nextMonthName = "August";
    for (const [curr, next] of Object.entries(nextMonthMap)) {
      if (curr.startsWith(mClean) || mClean.startsWith(curr)) {
        nextMonthName = next;
        break;
      }
    }
    const submitted_date_val = `5 ${nextMonthName}`;
    const seenReasons = /* @__PURE__ */ new Set();
    const uniqueReasons = [];
    for (const r of [...categoryTexts, ...allComments]) {
      if (!r)
        continue;
      const normalized = r.trim().toLowerCase().replace(/\s+/g, " ");
      if (!seenReasons.has(normalized)) {
        seenReasons.add(normalized);
        uniqueReasons.push(r.trim());
      }
    }
    const deduction_reason = uniqueReasons.join("; ");
    const capitalizedMonth = month.charAt(0).toUpperCase() + month.slice(1).toLowerCase();
    const month_val = `${capitalizedMonth}-${year}`;
    const rawManager = (usr.manager || "").trim();
    const resolvedManager = rawManager && rawManager.toLowerCase() !== "none" ? nameLookupMap[rawManager.toLowerCase()] || rawManager : "";
    reportRows.push({
      zone: usr.zone || "",
      ee_code: usr.e_code || usr.user_id,
      grade: usr.grade || "",
      cc: usr.district || "",
      ee_name: usr.name,
      doj: usr.date_of_joining || "",
      submitted_date: submitted_date_val,
      mail_hard_copy: "Soft Copy",
      designation: usr.designation || "",
      travel_expense: Math.round(travel_expense * 100) / 100,
      bike_km: Math.round(bike_km * 100) / 100,
      car_km: Math.round(car_km * 100) / 100,
      auto_amount: Math.round(auto_amount * 100) / 100,
      train_bus_amount: Math.round(train_bus_amount * 100) / 100,
      da_allowance: Math.round(da_allowance * 100) / 100,
      spare_purchase: Math.round(spare_purchase * 100) / 100,
      courier_charges: Math.round(courier_charges * 100) / 100,
      boarding_lodging: Math.round(boarding_lodging * 100) / 100,
      printing_stationery: Math.round(printing_stationery * 100) / 100,
      misc_expenses: 0,
      fuel_expenses: 0,
      total: Math.round(row_total * 100) / 100,
      advance: Math.round(user_advance * 100) / 100,
      net_payable: Math.round(net_payable * 100) / 100,
      gst_bills: "",
      status: "Approved",
      deduction_reason,
      month: month_val,
      hold_reason: "No",
      remarks: "",
      manager: resolvedManager,
      state: "Rajasthan",
      claimed_amount: Math.round(claimed_amount * 100) / 100
    });
  }
  return jsonResponse3({ success: true, data: reportRows });
}
__name(handleGetConsolidatedReport, "handleGetConsolidatedReport");
async function handleServeExpenseAttachment(request, env, params, query, user) {
  const filename = params.filename;
  if (!filename) {
    return new Response("Filename is required", { status: 400 });
  }
  const key = `expense_attachments/${filename}`;
  if (env.BUCKET) {
    try {
      const object = await env.BUCKET.get(key);
      if (object === null) {
        return new Response("File not found in R2 bucket", { status: 404 });
      }
      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set("etag", object.httpEtag);
      headers.set("Cache-Control", "public, max-age=31536000");
      return new Response(object.body, {
        headers
      });
    } catch (e) {
      console.error("Error reading from env.BUCKET:", e);
    }
  }
  if (env.PRIMARY_CLOUDFLARE_ACCOUNT_ID) {
    const accountId = env.PRIMARY_CLOUDFLARE_ACCOUNT_ID;
    const bucketName = "fieldops-uploads";
    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${bucketName}/objects/${key}`;
    try {
      const token = env.PRIMARY_CLOUDFLARE_API_TOKEN;
      const email = env.PRIMARY_CLOUDFLARE_EMAIL;
      const headers = {};
      if (token && token.startsWith("cfk_")) {
        headers["X-Auth-Key"] = token;
        headers["X-Auth-Email"] = email || "Sunil.cyrixrjbemp@gmail.com";
      } else if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      const res = await fetch(url, {
        method: "GET",
        headers
      });
      if (res.status === 200) {
        const contentType = res.headers.get("Content-Type") || "application/octet-stream";
        return new Response(res.body, {
          status: 200,
          headers: {
            "Content-Type": contentType,
            "Cache-Control": "public, max-age=31536000"
          }
        });
      } else {
        return new Response("File not found in fallback R2", { status: 404 });
      }
    } catch (e) {
      console.error("Error serving R2 object via fallback:", e);
    }
  }
  return new Response("Storage not configured", { status: 500 });
}
__name(handleServeExpenseAttachment, "handleServeExpenseAttachment");
async function handleGetTeamUsers(request, env, params, query, user) {
  let teamUsers = [];
  const userRoleClean = (user.role || "").trim().toLowerCase();
  const isAdminOrReportViewer = ["admin", "mis", "vp", "accountant", "hr", "project head", "travel desk", "travel tesk"].includes(userRoleClean);
  if (isAdminOrReportViewer) {
    const res = await env.DB.prepare("SELECT id, user_id, name, role, zone, district, designation, manager FROM users ORDER BY name ASC").all();
    teamUsers = res.results || [];
  } else {
    const nameClean = (user.name || "").trim();
    const uidClean = (user.user_id || "").trim();
    const directReportsRes = await env.DB.prepare(`
      SELECT id, user_id, name, role, zone, district, designation, manager FROM users
      WHERE LOWER(TRIM(manager)) = ? OR LOWER(TRIM(manager)) = ?
         OR LOWER(TRIM(coordinator)) = ? OR LOWER(TRIM(coordinator)) = ?
         OR LOWER(TRIM(zonal_manager)) = ? OR LOWER(TRIM(zonal_manager)) = ?
      ORDER BY name ASC
    `).bind(nameClean.toLowerCase(), uidClean.toLowerCase(), nameClean.toLowerCase(), uidClean.toLowerCase(), nameClean.toLowerCase(), uidClean.toLowerCase()).all();
    const directReports = directReportsRes.results || [];
    const hierarchyApprovals = await env.DB.prepare(`
      SELECT hierarchy_id FROM hierarchy_approvers WHERE approver_id = ?
    `).bind(user.id).all();
    let hierarchyReports = [];
    if (hierarchyApprovals.results && hierarchyApprovals.results.length > 0) {
      const hIds = hierarchyApprovals.results.map((h) => h.hierarchy_id);
      const placeholders = hIds.map(() => "?").join(",");
      const reqsRes = await env.DB.prepare(`
        SELECT u.id, u.user_id, u.name, u.role, u.zone, u.district, u.designation, u.manager FROM users u
        JOIN hierarchy_requesters hr ON u.id = hr.user_id
        WHERE hr.hierarchy_id IN (${placeholders})
        ORDER BY u.name ASC
      `).bind(...hIds).all();
      hierarchyReports = reqsRes.results || [];
    }
    const reportsMap = {};
    for (const u of [...directReports, ...hierarchyReports]) {
      reportsMap[u.id] = u;
    }
    teamUsers = Object.values(reportsMap);
  }
  return jsonResponse3(teamUsers);
}
__name(handleGetTeamUsers, "handleGetTeamUsers");
async function handleGetKpiAppraisal(request, env, params, query, user) {
  const targetUserId = query.user_id;
  const month = query.month;
  const yearStr = query.year;
  if (!targetUserId || !month || !yearStr) {
    return jsonResponse3({ error: "Missing required parameters: user_id, month, year" }, 400);
  }
  const year = parseInt(yearStr);
  if (targetUserId !== "self" && targetUserId !== user.user_id) {
    const isAllowed = await isManagerOfUser(user, targetUserId, env);
    if (!isAllowed) {
      return jsonResponse3({ error: "Access denied" }, 403);
    }
  }
  const eCode = targetUserId === "self" ? user.user_id : targetUserId;
  const appraisal = await env.DB.prepare(`
    SELECT * FROM kpi_appraisals WHERE user_id = ? AND month = ? AND year = ?
  `).bind(eCode, month, year).first();
  if (!appraisal) {
    return jsonResponse3({
      user_id: eCode,
      month,
      year,
      self_achieved_values: "{}",
      manager_achieved_values: "{}",
      core_ratings: "{}",
      submitted_by_self: 0,
      submitted_by_manager: 0
    });
  }
  return jsonResponse3(appraisal);
}
__name(handleGetKpiAppraisal, "handleGetKpiAppraisal");
async function handleSaveKpiAppraisal(request, env, params, query, user) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse3({ error: "Invalid JSON body" }, 400);
  }
  const { user_id, month, year: yearVal, self_achieved_values, manager_achieved_values, core_ratings, type } = body;
  if (!user_id || !month || !yearVal || !type) {
    return jsonResponse3({ error: "Missing required fields: user_id, month, year, type" }, 400);
  }
  const year = parseInt(yearVal);
  const targetCode = user_id === "self" ? user.user_id : user_id;
  if (type === "self") {
    if (targetCode !== user.user_id) {
      return jsonResponse3({ error: "Access denied. Cannot submit self assessment for another user." }, 403);
    }
  } else if (type === "manager") {
    const isAllowed = await isManagerOfUser(user, targetCode, env);
    if (!isAllowed) {
      return jsonResponse3({ error: "Access denied. You are not a manager of this user." }, 403);
    }
  } else {
    return jsonResponse3({ error: "Invalid submission type" }, 400);
  }
  const existing = await env.DB.prepare(`
    SELECT user_id FROM kpi_appraisals WHERE user_id = ? AND month = ? AND year = ?
  `).bind(targetCode, month, year).first();
  if (existing) {
    if (type === "self") {
      await env.DB.prepare(`
        UPDATE kpi_appraisals
        SET self_achieved_values = ?, submitted_by_self = 1, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ? AND month = ? AND year = ?
      `).bind(JSON.stringify(self_achieved_values || {}), targetCode, month, year).run();
    } else {
      await env.DB.prepare(`
        UPDATE kpi_appraisals
        SET manager_achieved_values = ?, core_ratings = ?, submitted_by_manager = 1, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ? AND month = ? AND year = ?
      `).bind(JSON.stringify(manager_achieved_values || {}), JSON.stringify(core_ratings || {}), targetCode, month, year).run();
    }
  } else {
    if (type === "self") {
      await env.DB.prepare(`
        INSERT INTO kpi_appraisals (user_id, month, year, self_achieved_values, manager_achieved_values, core_ratings, submitted_by_self, submitted_by_manager)
        VALUES (?, ?, ?, ?, ?, ?, 1, 0)
      `).bind(targetCode, month, year, JSON.stringify(self_achieved_values || {}), "{}", "{}").run();
    } else {
      await env.DB.prepare(`
        INSERT INTO kpi_appraisals (user_id, month, year, self_achieved_values, manager_achieved_values, core_ratings, submitted_by_self, submitted_by_manager)
        VALUES (?, ?, ?, ?, ?, ?, 0, 1)
      `).bind(targetCode, month, year, "{}", JSON.stringify(manager_achieved_values || {}), JSON.stringify(core_ratings || {})).run();
    }
  }
  return jsonResponse3({ success: true, message: "Appraisal saved successfully." });
}
__name(handleSaveKpiAppraisal, "handleSaveKpiAppraisal");
async function isManagerOfUser(managerUser, targetUserId, env) {
  const managerRoleClean = (managerUser.role || "").trim().toLowerCase();
  if (["admin", "mis", "vp", "accountant", "hr", "project head", "travel desk", "travel tesk"].includes(managerRoleClean)) {
    return true;
  }
  const nameClean = (managerUser.name || "").trim();
  const uidClean = (managerUser.user_id || "").trim();
  const directReport = await env.DB.prepare(`
    SELECT id FROM users
    WHERE user_id = ? AND (
      LOWER(TRIM(manager)) = ? OR LOWER(TRIM(manager)) = ?
      OR LOWER(TRIM(coordinator)) = ? OR LOWER(TRIM(coordinator)) = ?
      OR LOWER(TRIM(zonal_manager)) = ? OR LOWER(TRIM(zonal_manager)) = ?
    )
  `).bind(
    targetUserId,
    nameClean.toLowerCase(),
    uidClean.toLowerCase(),
    nameClean.toLowerCase(),
    uidClean.toLowerCase(),
    nameClean.toLowerCase(),
    uidClean.toLowerCase()
  ).first();
  if (directReport)
    return true;
  const hierarchyApprovals = await env.DB.prepare(`
    SELECT hierarchy_id FROM hierarchy_approvers WHERE approver_id = ?
  `).bind(managerUser.id).all();
  if (hierarchyApprovals.results && hierarchyApprovals.results.length > 0) {
    const hIds = hierarchyApprovals.results.map((h) => h.hierarchy_id);
    const placeholders = hIds.map(() => "?").join(",");
    const req = await env.DB.prepare(`
      SELECT u.id FROM users u
      JOIN hierarchy_requesters hr ON u.id = hr.user_id
      WHERE u.user_id = ? AND hr.hierarchy_id IN (${placeholders})
    `).bind(targetUserId, ...hIds).first();
    if (req)
      return true;
  }
  return false;
}
__name(isManagerOfUser, "isManagerOfUser");
async function handleGetPolicyRules(req, env, params, query) {
  try {
    const grade = query.grade ? decodeURIComponent(query.grade).trim() : null;
    let results;
    if (grade) {
      results = await env.DB.prepare(
        "SELECT * FROM allowance_master WHERE LOWER(grade) = ?"
      ).bind(grade.toLowerCase()).all();
    } else {
      results = await env.DB.prepare(
        "SELECT * FROM allowance_master ORDER BY grade ASC"
      ).all();
    }
    return new Response(
      JSON.stringify({
        success: true,
        data: results.results || []
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        success: false,
        detail: `Failed to fetch policy rules: ${err.message}`
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      }
    );
  }
}
__name(handleGetPolicyRules, "handleGetPolicyRules");

// node_modules/drizzle-orm/entity.js
var entityKind = Symbol.for("drizzle:entityKind");
var hasOwnEntityKind = Symbol.for("drizzle:hasOwnEntityKind");
function is(value, type) {
  if (!value || typeof value !== "object") {
    return false;
  }
  if (value instanceof type) {
    return true;
  }
  if (!Object.prototype.hasOwnProperty.call(type, entityKind)) {
    throw new Error(
      `Class "${type.name ?? "<unknown>"}" doesn't look like a Drizzle entity. If this is incorrect and the class is provided by Drizzle, please report this as a bug.`
    );
  }
  let cls = value.constructor;
  if (cls) {
    while (cls) {
      if (entityKind in cls && cls[entityKind] === type[entityKind]) {
        return true;
      }
      cls = Object.getPrototypeOf(cls);
    }
  }
  return false;
}
__name(is, "is");

// node_modules/drizzle-orm/logger.js
var _a;
var ConsoleLogWriter = class {
  write(message) {
    console.log(message);
  }
};
__name(ConsoleLogWriter, "ConsoleLogWriter");
_a = entityKind;
__publicField(ConsoleLogWriter, _a, "ConsoleLogWriter");
var _a2;
var DefaultLogger = class {
  writer;
  constructor(config) {
    this.writer = config?.writer ?? new ConsoleLogWriter();
  }
  logQuery(query, params) {
    const stringifiedParams = params.map((p) => {
      try {
        return JSON.stringify(p);
      } catch {
        return String(p);
      }
    });
    const paramsStr = stringifiedParams.length ? ` -- params: [${stringifiedParams.join(", ")}]` : "";
    this.writer.write(`Query: ${query}${paramsStr}`);
  }
};
__name(DefaultLogger, "DefaultLogger");
_a2 = entityKind;
__publicField(DefaultLogger, _a2, "DefaultLogger");
var _a3;
var NoopLogger = class {
  logQuery() {
  }
};
__name(NoopLogger, "NoopLogger");
_a3 = entityKind;
__publicField(NoopLogger, _a3, "NoopLogger");

// node_modules/drizzle-orm/table.js
var TableName = Symbol.for("drizzle:Name");
var Schema = Symbol.for("drizzle:Schema");
var Columns = Symbol.for("drizzle:Columns");
var OriginalName = Symbol.for("drizzle:OriginalName");
var BaseName = Symbol.for("drizzle:BaseName");
var IsAlias = Symbol.for("drizzle:IsAlias");
var ExtraConfigBuilder = Symbol.for("drizzle:ExtraConfigBuilder");
var IsDrizzleTable = Symbol.for("drizzle:IsDrizzleTable");
var _a4;
var Table = class {
  /**
   * @internal
   * Can be changed if the table is aliased.
   */
  [(_a4 = entityKind, TableName)];
  /**
   * @internal
   * Used to store the original name of the table, before any aliasing.
   */
  [OriginalName];
  /** @internal */
  [Schema];
  /** @internal */
  [Columns];
  /**
   *  @internal
   * Used to store the table name before the transformation via the `tableCreator` functions.
   */
  [BaseName];
  /** @internal */
  [IsAlias] = false;
  /** @internal */
  [ExtraConfigBuilder] = void 0;
  [IsDrizzleTable] = true;
  constructor(name, schema, baseName) {
    this[TableName] = this[OriginalName] = name;
    this[Schema] = schema;
    this[BaseName] = baseName;
  }
};
__name(Table, "Table");
__publicField(Table, _a4, "Table");
/** @internal */
__publicField(Table, "Symbol", {
  Name: TableName,
  Schema,
  OriginalName,
  Columns,
  BaseName,
  IsAlias,
  ExtraConfigBuilder
});
function isTable(table) {
  return typeof table === "object" && table !== null && IsDrizzleTable in table;
}
__name(isTable, "isTable");
function getTableName(table) {
  return table[TableName];
}
__name(getTableName, "getTableName");

// node_modules/drizzle-orm/column.js
var _a5;
var Column = class {
  constructor(table, config) {
    this.table = table;
    this.config = config;
    this.name = config.name;
    this.notNull = config.notNull;
    this.default = config.default;
    this.defaultFn = config.defaultFn;
    this.onUpdateFn = config.onUpdateFn;
    this.hasDefault = config.hasDefault;
    this.primary = config.primaryKey;
    this.isUnique = config.isUnique;
    this.uniqueName = config.uniqueName;
    this.uniqueType = config.uniqueType;
    this.dataType = config.dataType;
    this.columnType = config.columnType;
  }
  name;
  primary;
  notNull;
  default;
  defaultFn;
  onUpdateFn;
  hasDefault;
  isUnique;
  uniqueName;
  uniqueType;
  dataType;
  columnType;
  enumValues = void 0;
  config;
  mapFromDriverValue(value) {
    return value;
  }
  mapToDriverValue(value) {
    return value;
  }
};
__name(Column, "Column");
_a5 = entityKind;
__publicField(Column, _a5, "Column");

// node_modules/drizzle-orm/pg-core/table.js
var InlineForeignKeys = Symbol.for("drizzle:PgInlineForeignKeys");
var _a6;
var PgTable = class extends Table {
  /**@internal */
  [(_a6 = entityKind, InlineForeignKeys)] = [];
  /** @internal */
  [Table.Symbol.ExtraConfigBuilder] = void 0;
};
__name(PgTable, "PgTable");
__publicField(PgTable, _a6, "PgTable");
/** @internal */
__publicField(PgTable, "Symbol", Object.assign({}, Table.Symbol, {
  InlineForeignKeys
}));

// node_modules/drizzle-orm/pg-core/primary-keys.js
var _a7;
var PrimaryKeyBuilder = class {
  /** @internal */
  columns;
  /** @internal */
  name;
  constructor(columns, name) {
    this.columns = columns;
    this.name = name;
  }
  /** @internal */
  build(table) {
    return new PrimaryKey(table, this.columns, this.name);
  }
};
__name(PrimaryKeyBuilder, "PrimaryKeyBuilder");
_a7 = entityKind;
__publicField(PrimaryKeyBuilder, _a7, "PgPrimaryKeyBuilder");
var _a8;
var PrimaryKey = class {
  constructor(table, columns, name) {
    this.table = table;
    this.columns = columns;
    this.name = name;
  }
  columns;
  name;
  getName() {
    return this.name ?? `${this.table[PgTable.Symbol.Name]}_${this.columns.map((column) => column.name).join("_")}_pk`;
  }
};
__name(PrimaryKey, "PrimaryKey");
_a8 = entityKind;
__publicField(PrimaryKey, _a8, "PgPrimaryKey");

// node_modules/drizzle-orm/column-builder.js
var _a9;
var ColumnBuilder = class {
  config;
  constructor(name, dataType, columnType) {
    this.config = {
      name,
      notNull: false,
      default: void 0,
      hasDefault: false,
      primaryKey: false,
      isUnique: false,
      uniqueName: void 0,
      uniqueType: void 0,
      dataType,
      columnType
    };
  }
  /**
   * Changes the data type of the column. Commonly used with `json` columns. Also, useful for branded types.
   *
   * @example
   * ```ts
   * const users = pgTable('users', {
   * 	id: integer('id').$type<UserId>().primaryKey(),
   * 	details: json('details').$type<UserDetails>().notNull(),
   * });
   * ```
   */
  $type() {
    return this;
  }
  /**
   * Adds a `not null` clause to the column definition.
   *
   * Affects the `select` model of the table - columns *without* `not null` will be nullable on select.
   */
  notNull() {
    this.config.notNull = true;
    return this;
  }
  /**
   * Adds a `default <value>` clause to the column definition.
   *
   * Affects the `insert` model of the table - columns *with* `default` are optional on insert.
   *
   * If you need to set a dynamic default value, use {@link $defaultFn} instead.
   */
  default(value) {
    this.config.default = value;
    this.config.hasDefault = true;
    return this;
  }
  /**
   * Adds a dynamic default value to the column.
   * The function will be called when the row is inserted, and the returned value will be used as the column value.
   *
   * **Note:** This value does not affect the `drizzle-kit` behavior, it is only used at runtime in `drizzle-orm`.
   */
  $defaultFn(fn) {
    this.config.defaultFn = fn;
    this.config.hasDefault = true;
    return this;
  }
  /**
   * Alias for {@link $defaultFn}.
   */
  $default = this.$defaultFn;
  /**
   * Adds a dynamic update value to the column.
   * The function will be called when the row is updated, and the returned value will be used as the column value if none is provided.
   * If no `default` (or `$defaultFn`) value is provided, the function will be called when the row is inserted as well, and the returned value will be used as the column value.
   *
   * **Note:** This value does not affect the `drizzle-kit` behavior, it is only used at runtime in `drizzle-orm`.
   */
  $onUpdateFn(fn) {
    this.config.onUpdateFn = fn;
    this.config.hasDefault = true;
    return this;
  }
  /**
   * Alias for {@link $onUpdateFn}.
   */
  $onUpdate = this.$onUpdateFn;
  /**
   * Adds a `primary key` clause to the column definition. This implicitly makes the column `not null`.
   *
   * In SQLite, `integer primary key` implicitly makes the column auto-incrementing.
   */
  primaryKey() {
    this.config.primaryKey = true;
    this.config.notNull = true;
    return this;
  }
};
__name(ColumnBuilder, "ColumnBuilder");
_a9 = entityKind;
__publicField(ColumnBuilder, _a9, "ColumnBuilder");

// node_modules/drizzle-orm/pg-core/foreign-keys.js
var _a10;
var ForeignKeyBuilder = class {
  /** @internal */
  reference;
  /** @internal */
  _onUpdate = "no action";
  /** @internal */
  _onDelete = "no action";
  constructor(config, actions) {
    this.reference = () => {
      const { name, columns, foreignColumns } = config();
      return { name, columns, foreignTable: foreignColumns[0].table, foreignColumns };
    };
    if (actions) {
      this._onUpdate = actions.onUpdate;
      this._onDelete = actions.onDelete;
    }
  }
  onUpdate(action) {
    this._onUpdate = action === void 0 ? "no action" : action;
    return this;
  }
  onDelete(action) {
    this._onDelete = action === void 0 ? "no action" : action;
    return this;
  }
  /** @internal */
  build(table) {
    return new ForeignKey(table, this);
  }
};
__name(ForeignKeyBuilder, "ForeignKeyBuilder");
_a10 = entityKind;
__publicField(ForeignKeyBuilder, _a10, "PgForeignKeyBuilder");
var _a11;
var ForeignKey = class {
  constructor(table, builder) {
    this.table = table;
    this.reference = builder.reference;
    this.onUpdate = builder._onUpdate;
    this.onDelete = builder._onDelete;
  }
  reference;
  onUpdate;
  onDelete;
  getName() {
    const { name, columns, foreignColumns } = this.reference();
    const columnNames = columns.map((column) => column.name);
    const foreignColumnNames = foreignColumns.map((column) => column.name);
    const chunks = [
      this.table[PgTable.Symbol.Name],
      ...columnNames,
      foreignColumns[0].table[PgTable.Symbol.Name],
      ...foreignColumnNames
    ];
    return name ?? `${chunks.join("_")}_fk`;
  }
};
__name(ForeignKey, "ForeignKey");
_a11 = entityKind;
__publicField(ForeignKey, _a11, "PgForeignKey");

// node_modules/drizzle-orm/tracing-utils.js
function iife(fn, ...args) {
  return fn(...args);
}
__name(iife, "iife");

// node_modules/drizzle-orm/pg-core/unique-constraint.js
function uniqueKeyName(table, columns) {
  return `${table[PgTable.Symbol.Name]}_${columns.join("_")}_unique`;
}
__name(uniqueKeyName, "uniqueKeyName");
var _a12;
var UniqueConstraintBuilder = class {
  constructor(columns, name) {
    this.name = name;
    this.columns = columns;
  }
  /** @internal */
  columns;
  /** @internal */
  nullsNotDistinctConfig = false;
  nullsNotDistinct() {
    this.nullsNotDistinctConfig = true;
    return this;
  }
  /** @internal */
  build(table) {
    return new UniqueConstraint(table, this.columns, this.nullsNotDistinctConfig, this.name);
  }
};
__name(UniqueConstraintBuilder, "UniqueConstraintBuilder");
_a12 = entityKind;
__publicField(UniqueConstraintBuilder, _a12, "PgUniqueConstraintBuilder");
var _a13;
var UniqueOnConstraintBuilder = class {
  /** @internal */
  name;
  constructor(name) {
    this.name = name;
  }
  on(...columns) {
    return new UniqueConstraintBuilder(columns, this.name);
  }
};
__name(UniqueOnConstraintBuilder, "UniqueOnConstraintBuilder");
_a13 = entityKind;
__publicField(UniqueOnConstraintBuilder, _a13, "PgUniqueOnConstraintBuilder");
var _a14;
var UniqueConstraint = class {
  constructor(table, columns, nullsNotDistinct, name) {
    this.table = table;
    this.columns = columns;
    this.name = name ?? uniqueKeyName(this.table, this.columns.map((column) => column.name));
    this.nullsNotDistinct = nullsNotDistinct;
  }
  columns;
  name;
  nullsNotDistinct = false;
  getName() {
    return this.name;
  }
};
__name(UniqueConstraint, "UniqueConstraint");
_a14 = entityKind;
__publicField(UniqueConstraint, _a14, "PgUniqueConstraint");

// node_modules/drizzle-orm/pg-core/utils/array.js
function parsePgArrayValue(arrayString, startFrom, inQuotes) {
  for (let i = startFrom; i < arrayString.length; i++) {
    const char = arrayString[i];
    if (char === "\\") {
      i++;
      continue;
    }
    if (char === '"') {
      return [arrayString.slice(startFrom, i).replace(/\\/g, ""), i + 1];
    }
    if (inQuotes) {
      continue;
    }
    if (char === "," || char === "}") {
      return [arrayString.slice(startFrom, i).replace(/\\/g, ""), i];
    }
  }
  return [arrayString.slice(startFrom).replace(/\\/g, ""), arrayString.length];
}
__name(parsePgArrayValue, "parsePgArrayValue");
function parsePgNestedArray(arrayString, startFrom = 0) {
  const result = [];
  let i = startFrom;
  let lastCharIsComma = false;
  while (i < arrayString.length) {
    const char = arrayString[i];
    if (char === ",") {
      if (lastCharIsComma || i === startFrom) {
        result.push("");
      }
      lastCharIsComma = true;
      i++;
      continue;
    }
    lastCharIsComma = false;
    if (char === "\\") {
      i += 2;
      continue;
    }
    if (char === '"') {
      const [value2, startFrom2] = parsePgArrayValue(arrayString, i + 1, true);
      result.push(value2);
      i = startFrom2;
      continue;
    }
    if (char === "}") {
      return [result, i + 1];
    }
    if (char === "{") {
      const [value2, startFrom2] = parsePgNestedArray(arrayString, i + 1);
      result.push(value2);
      i = startFrom2;
      continue;
    }
    const [value, newStartFrom] = parsePgArrayValue(arrayString, i, false);
    result.push(value);
    i = newStartFrom;
  }
  return [result, i];
}
__name(parsePgNestedArray, "parsePgNestedArray");
function parsePgArray(arrayString) {
  const [result] = parsePgNestedArray(arrayString, 1);
  return result;
}
__name(parsePgArray, "parsePgArray");
function makePgArray(array) {
  return `{${array.map((item) => {
    if (Array.isArray(item)) {
      return makePgArray(item);
    }
    if (typeof item === "string") {
      return `"${item.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
    }
    return `${item}`;
  }).join(",")}}`;
}
__name(makePgArray, "makePgArray");

// node_modules/drizzle-orm/pg-core/columns/common.js
var _a15;
var PgColumnBuilder = class extends ColumnBuilder {
  foreignKeyConfigs = [];
  array(size) {
    return new PgArrayBuilder(this.config.name, this, size);
  }
  references(ref, actions = {}) {
    this.foreignKeyConfigs.push({ ref, actions });
    return this;
  }
  unique(name, config) {
    this.config.isUnique = true;
    this.config.uniqueName = name;
    this.config.uniqueType = config?.nulls;
    return this;
  }
  /** @internal */
  buildForeignKeys(column, table) {
    return this.foreignKeyConfigs.map(({ ref, actions }) => {
      return iife(
        (ref2, actions2) => {
          const builder = new ForeignKeyBuilder(() => {
            const foreignColumn = ref2();
            return { columns: [column], foreignColumns: [foreignColumn] };
          });
          if (actions2.onUpdate) {
            builder.onUpdate(actions2.onUpdate);
          }
          if (actions2.onDelete) {
            builder.onDelete(actions2.onDelete);
          }
          return builder.build(table);
        },
        ref,
        actions
      );
    });
  }
};
__name(PgColumnBuilder, "PgColumnBuilder");
_a15 = entityKind;
__publicField(PgColumnBuilder, _a15, "PgColumnBuilder");
var _a16;
var PgColumn = class extends Column {
  constructor(table, config) {
    if (!config.uniqueName) {
      config.uniqueName = uniqueKeyName(table, [config.name]);
    }
    super(table, config);
    this.table = table;
  }
};
__name(PgColumn, "PgColumn");
_a16 = entityKind;
__publicField(PgColumn, _a16, "PgColumn");
var _a17;
var PgArrayBuilder = class extends PgColumnBuilder {
  constructor(name, baseBuilder, size) {
    super(name, "array", "PgArray");
    this.config.baseBuilder = baseBuilder;
    this.config.size = size;
  }
  /** @internal */
  build(table) {
    const baseColumn = this.config.baseBuilder.build(table);
    return new PgArray(
      table,
      this.config,
      baseColumn
    );
  }
};
__name(PgArrayBuilder, "PgArrayBuilder");
_a17 = entityKind;
__publicField(PgArrayBuilder, _a17, "PgArrayBuilder");
var _a18;
var _PgArray = class extends PgColumn {
  constructor(table, config, baseColumn, range) {
    super(table, config);
    this.baseColumn = baseColumn;
    this.range = range;
    this.size = config.size;
  }
  size;
  getSQLType() {
    return `${this.baseColumn.getSQLType()}[${typeof this.size === "number" ? this.size : ""}]`;
  }
  mapFromDriverValue(value) {
    if (typeof value === "string") {
      value = parsePgArray(value);
    }
    return value.map((v) => this.baseColumn.mapFromDriverValue(v));
  }
  mapToDriverValue(value, isNestedArray = false) {
    const a = value.map(
      (v) => v === null ? null : is(this.baseColumn, _PgArray) ? this.baseColumn.mapToDriverValue(v, true) : this.baseColumn.mapToDriverValue(v)
    );
    if (isNestedArray)
      return a;
    return makePgArray(a);
  }
};
var PgArray = _PgArray;
__name(PgArray, "PgArray");
_a18 = entityKind;
__publicField(PgArray, _a18, "PgArray");

// node_modules/drizzle-orm/pg-core/columns/enum.js
var isPgEnumSym = Symbol.for("drizzle:isPgEnum");
function isPgEnum(obj) {
  return !!obj && typeof obj === "function" && isPgEnumSym in obj && obj[isPgEnumSym] === true;
}
__name(isPgEnum, "isPgEnum");
var _a19;
var PgEnumColumnBuilder = class extends PgColumnBuilder {
  constructor(name, enumInstance) {
    super(name, "string", "PgEnumColumn");
    this.config.enum = enumInstance;
  }
  /** @internal */
  build(table) {
    return new PgEnumColumn(
      table,
      this.config
    );
  }
};
__name(PgEnumColumnBuilder, "PgEnumColumnBuilder");
_a19 = entityKind;
__publicField(PgEnumColumnBuilder, _a19, "PgEnumColumnBuilder");
var _a20;
var PgEnumColumn = class extends PgColumn {
  enum = this.config.enum;
  enumValues = this.config.enum.enumValues;
  constructor(table, config) {
    super(table, config);
    this.enum = config.enum;
  }
  getSQLType() {
    return this.enum.enumName;
  }
};
__name(PgEnumColumn, "PgEnumColumn");
_a20 = entityKind;
__publicField(PgEnumColumn, _a20, "PgEnumColumn");

// node_modules/drizzle-orm/subquery.js
var _a21;
var Subquery = class {
  constructor(sql2, selection, alias, isWith = false) {
    this._ = {
      brand: "Subquery",
      sql: sql2,
      selectedFields: selection,
      alias,
      isWith
    };
  }
  // getSQL(): SQL<unknown> {
  // 	return new SQL([this]);
  // }
};
__name(Subquery, "Subquery");
_a21 = entityKind;
__publicField(Subquery, _a21, "Subquery");
var _a22;
var WithSubquery = class extends Subquery {
};
__name(WithSubquery, "WithSubquery");
_a22 = entityKind;
__publicField(WithSubquery, _a22, "WithSubquery");

// node_modules/drizzle-orm/version.js
var version = "0.30.10";

// node_modules/drizzle-orm/tracing.js
var otel;
var rawTracer;
var tracer = {
  startActiveSpan(name, fn) {
    if (!otel) {
      return fn();
    }
    if (!rawTracer) {
      rawTracer = otel.trace.getTracer("drizzle-orm", version);
    }
    return iife(
      (otel2, rawTracer2) => rawTracer2.startActiveSpan(
        name,
        (span) => {
          try {
            return fn(span);
          } catch (e) {
            span.setStatus({
              code: otel2.SpanStatusCode.ERROR,
              message: e instanceof Error ? e.message : "Unknown error"
              // eslint-disable-line no-instanceof/no-instanceof
            });
            throw e;
          } finally {
            span.end();
          }
        }
      ),
      otel,
      rawTracer
    );
  }
};

// node_modules/drizzle-orm/view-common.js
var ViewBaseConfig = Symbol.for("drizzle:ViewBaseConfig");

// node_modules/drizzle-orm/sql/sql.js
var _a23;
var FakePrimitiveParam = class {
};
__name(FakePrimitiveParam, "FakePrimitiveParam");
_a23 = entityKind;
__publicField(FakePrimitiveParam, _a23, "FakePrimitiveParam");
function isSQLWrapper(value) {
  return value !== null && value !== void 0 && typeof value.getSQL === "function";
}
__name(isSQLWrapper, "isSQLWrapper");
function mergeQueries(queries) {
  const result = { sql: "", params: [] };
  for (const query of queries) {
    result.sql += query.sql;
    result.params.push(...query.params);
    if (query.typings?.length) {
      if (!result.typings) {
        result.typings = [];
      }
      result.typings.push(...query.typings);
    }
  }
  return result;
}
__name(mergeQueries, "mergeQueries");
var _a24;
var StringChunk = class {
  value;
  constructor(value) {
    this.value = Array.isArray(value) ? value : [value];
  }
  getSQL() {
    return new SQL([this]);
  }
};
__name(StringChunk, "StringChunk");
_a24 = entityKind;
__publicField(StringChunk, _a24, "StringChunk");
var _a25;
var _SQL = class {
  constructor(queryChunks) {
    this.queryChunks = queryChunks;
  }
  /** @internal */
  decoder = noopDecoder;
  shouldInlineParams = false;
  append(query) {
    this.queryChunks.push(...query.queryChunks);
    return this;
  }
  toQuery(config) {
    return tracer.startActiveSpan("drizzle.buildSQL", (span) => {
      const query = this.buildQueryFromSourceParams(this.queryChunks, config);
      span?.setAttributes({
        "drizzle.query.text": query.sql,
        "drizzle.query.params": JSON.stringify(query.params)
      });
      return query;
    });
  }
  buildQueryFromSourceParams(chunks, _config) {
    const config = Object.assign({}, _config, {
      inlineParams: _config.inlineParams || this.shouldInlineParams,
      paramStartIndex: _config.paramStartIndex || { value: 0 }
    });
    const {
      escapeName,
      escapeParam,
      prepareTyping,
      inlineParams,
      paramStartIndex
    } = config;
    return mergeQueries(chunks.map((chunk) => {
      if (is(chunk, StringChunk)) {
        return { sql: chunk.value.join(""), params: [] };
      }
      if (is(chunk, Name)) {
        return { sql: escapeName(chunk.value), params: [] };
      }
      if (chunk === void 0) {
        return { sql: "", params: [] };
      }
      if (Array.isArray(chunk)) {
        const result = [new StringChunk("(")];
        for (const [i, p] of chunk.entries()) {
          result.push(p);
          if (i < chunk.length - 1) {
            result.push(new StringChunk(", "));
          }
        }
        result.push(new StringChunk(")"));
        return this.buildQueryFromSourceParams(result, config);
      }
      if (is(chunk, _SQL)) {
        return this.buildQueryFromSourceParams(chunk.queryChunks, {
          ...config,
          inlineParams: inlineParams || chunk.shouldInlineParams
        });
      }
      if (is(chunk, Table)) {
        const schemaName = chunk[Table.Symbol.Schema];
        const tableName = chunk[Table.Symbol.Name];
        return {
          sql: schemaName === void 0 ? escapeName(tableName) : escapeName(schemaName) + "." + escapeName(tableName),
          params: []
        };
      }
      if (is(chunk, Column)) {
        return { sql: escapeName(chunk.table[Table.Symbol.Name]) + "." + escapeName(chunk.name), params: [] };
      }
      if (is(chunk, View)) {
        const schemaName = chunk[ViewBaseConfig].schema;
        const viewName = chunk[ViewBaseConfig].name;
        return {
          sql: schemaName === void 0 ? escapeName(viewName) : escapeName(schemaName) + "." + escapeName(viewName),
          params: []
        };
      }
      if (is(chunk, Param)) {
        const mappedValue = chunk.value === null ? null : chunk.encoder.mapToDriverValue(chunk.value);
        if (is(mappedValue, _SQL)) {
          return this.buildQueryFromSourceParams([mappedValue], config);
        }
        if (inlineParams) {
          return { sql: this.mapInlineParam(mappedValue, config), params: [] };
        }
        let typings;
        if (prepareTyping !== void 0) {
          typings = [prepareTyping(chunk.encoder)];
        }
        return { sql: escapeParam(paramStartIndex.value++, mappedValue), params: [mappedValue], typings };
      }
      if (is(chunk, Placeholder)) {
        return { sql: escapeParam(paramStartIndex.value++, chunk), params: [chunk] };
      }
      if (is(chunk, _SQL.Aliased) && chunk.fieldAlias !== void 0) {
        return { sql: escapeName(chunk.fieldAlias), params: [] };
      }
      if (is(chunk, Subquery)) {
        if (chunk._.isWith) {
          return { sql: escapeName(chunk._.alias), params: [] };
        }
        return this.buildQueryFromSourceParams([
          new StringChunk("("),
          chunk._.sql,
          new StringChunk(") "),
          new Name(chunk._.alias)
        ], config);
      }
      if (isPgEnum(chunk)) {
        if (chunk.schema) {
          return { sql: escapeName(chunk.schema) + "." + escapeName(chunk.enumName), params: [] };
        }
        return { sql: escapeName(chunk.enumName), params: [] };
      }
      if (isSQLWrapper(chunk)) {
        return this.buildQueryFromSourceParams([
          new StringChunk("("),
          chunk.getSQL(),
          new StringChunk(")")
        ], config);
      }
      if (inlineParams) {
        return { sql: this.mapInlineParam(chunk, config), params: [] };
      }
      return { sql: escapeParam(paramStartIndex.value++, chunk), params: [chunk] };
    }));
  }
  mapInlineParam(chunk, { escapeString }) {
    if (chunk === null) {
      return "null";
    }
    if (typeof chunk === "number" || typeof chunk === "boolean") {
      return chunk.toString();
    }
    if (typeof chunk === "string") {
      return escapeString(chunk);
    }
    if (typeof chunk === "object") {
      const mappedValueAsString = chunk.toString();
      if (mappedValueAsString === "[object Object]") {
        return escapeString(JSON.stringify(chunk));
      }
      return escapeString(mappedValueAsString);
    }
    throw new Error("Unexpected param value: " + chunk);
  }
  getSQL() {
    return this;
  }
  as(alias) {
    if (alias === void 0) {
      return this;
    }
    return new _SQL.Aliased(this, alias);
  }
  mapWith(decoder) {
    this.decoder = typeof decoder === "function" ? { mapFromDriverValue: decoder } : decoder;
    return this;
  }
  inlineParams() {
    this.shouldInlineParams = true;
    return this;
  }
  /**
   * This method is used to conditionally include a part of the query.
   *
   * @param condition - Condition to check
   * @returns itself if the condition is `true`, otherwise `undefined`
   */
  if(condition) {
    return condition ? this : void 0;
  }
};
var SQL = _SQL;
__name(SQL, "SQL");
_a25 = entityKind;
__publicField(SQL, _a25, "SQL");
var _a26;
var Name = class {
  constructor(value) {
    this.value = value;
  }
  brand;
  getSQL() {
    return new SQL([this]);
  }
};
__name(Name, "Name");
_a26 = entityKind;
__publicField(Name, _a26, "Name");
function isDriverValueEncoder(value) {
  return typeof value === "object" && value !== null && "mapToDriverValue" in value && typeof value.mapToDriverValue === "function";
}
__name(isDriverValueEncoder, "isDriverValueEncoder");
var noopDecoder = {
  mapFromDriverValue: (value) => value
};
var noopEncoder = {
  mapToDriverValue: (value) => value
};
var noopMapper = {
  ...noopDecoder,
  ...noopEncoder
};
var _a27;
var Param = class {
  /**
   * @param value - Parameter value
   * @param encoder - Encoder to convert the value to a driver parameter
   */
  constructor(value, encoder = noopEncoder) {
    this.value = value;
    this.encoder = encoder;
  }
  brand;
  getSQL() {
    return new SQL([this]);
  }
};
__name(Param, "Param");
_a27 = entityKind;
__publicField(Param, _a27, "Param");
function sql(strings, ...params) {
  const queryChunks = [];
  if (params.length > 0 || strings.length > 0 && strings[0] !== "") {
    queryChunks.push(new StringChunk(strings[0]));
  }
  for (const [paramIndex, param2] of params.entries()) {
    queryChunks.push(param2, new StringChunk(strings[paramIndex + 1]));
  }
  return new SQL(queryChunks);
}
__name(sql, "sql");
((sql2) => {
  function empty() {
    return new SQL([]);
  }
  __name(empty, "empty");
  sql2.empty = empty;
  function fromList(list) {
    return new SQL(list);
  }
  __name(fromList, "fromList");
  sql2.fromList = fromList;
  function raw(str) {
    return new SQL([new StringChunk(str)]);
  }
  __name(raw, "raw");
  sql2.raw = raw;
  function join(chunks, separator) {
    const result = [];
    for (const [i, chunk] of chunks.entries()) {
      if (i > 0 && separator !== void 0) {
        result.push(separator);
      }
      result.push(chunk);
    }
    return new SQL(result);
  }
  __name(join, "join");
  sql2.join = join;
  function identifier(value) {
    return new Name(value);
  }
  __name(identifier, "identifier");
  sql2.identifier = identifier;
  function placeholder2(name2) {
    return new Placeholder(name2);
  }
  __name(placeholder2, "placeholder2");
  sql2.placeholder = placeholder2;
  function param2(value, encoder) {
    return new Param(value, encoder);
  }
  __name(param2, "param2");
  sql2.param = param2;
})(sql || (sql = {}));
((SQL2) => {
  class Aliased {
    constructor(sql2, fieldAlias) {
      this.sql = sql2;
      this.fieldAlias = fieldAlias;
    }
    static [entityKind] = "SQL.Aliased";
    /** @internal */
    isSelectionField = false;
    getSQL() {
      return this.sql;
    }
    /** @internal */
    clone() {
      return new Aliased(this.sql, this.fieldAlias);
    }
  }
  __name(Aliased, "Aliased");
  SQL2.Aliased = Aliased;
})(SQL || (SQL = {}));
var _a28;
var Placeholder = class {
  constructor(name2) {
    this.name = name2;
  }
  getSQL() {
    return new SQL([this]);
  }
};
__name(Placeholder, "Placeholder");
_a28 = entityKind;
__publicField(Placeholder, _a28, "Placeholder");
function fillPlaceholders(params, values) {
  return params.map((p) => {
    if (is(p, Placeholder)) {
      if (!(p.name in values)) {
        throw new Error(`No value for placeholder "${p.name}" was provided`);
      }
      return values[p.name];
    }
    return p;
  });
}
__name(fillPlaceholders, "fillPlaceholders");
var _a29;
var View = class {
  /** @internal */
  [(_a29 = entityKind, ViewBaseConfig)];
  constructor({ name: name2, schema, selectedFields, query }) {
    this[ViewBaseConfig] = {
      name: name2,
      originalName: name2,
      schema,
      selectedFields,
      query,
      isExisting: !query,
      isAlias: false
    };
  }
  getSQL() {
    return new SQL([this]);
  }
};
__name(View, "View");
__publicField(View, _a29, "View");
Column.prototype.getSQL = function() {
  return new SQL([this]);
};
Table.prototype.getSQL = function() {
  return new SQL([this]);
};
Subquery.prototype.getSQL = function() {
  return new SQL([this]);
};

// node_modules/drizzle-orm/sql/expressions/conditions.js
function bindIfParam(value, column) {
  if (isDriverValueEncoder(column) && !isSQLWrapper(value) && !is(value, Param) && !is(value, Placeholder) && !is(value, Column) && !is(value, Table) && !is(value, View)) {
    return new Param(value, column);
  }
  return value;
}
__name(bindIfParam, "bindIfParam");
var eq = /* @__PURE__ */ __name((left, right) => {
  return sql`${left} = ${bindIfParam(right, left)}`;
}, "eq");
var ne = /* @__PURE__ */ __name((left, right) => {
  return sql`${left} <> ${bindIfParam(right, left)}`;
}, "ne");
function and(...unfilteredConditions) {
  const conditions = unfilteredConditions.filter(
    (c) => c !== void 0
  );
  if (conditions.length === 0) {
    return void 0;
  }
  if (conditions.length === 1) {
    return new SQL(conditions);
  }
  return new SQL([
    new StringChunk("("),
    sql.join(conditions, new StringChunk(" and ")),
    new StringChunk(")")
  ]);
}
__name(and, "and");
function or(...unfilteredConditions) {
  const conditions = unfilteredConditions.filter(
    (c) => c !== void 0
  );
  if (conditions.length === 0) {
    return void 0;
  }
  if (conditions.length === 1) {
    return new SQL(conditions);
  }
  return new SQL([
    new StringChunk("("),
    sql.join(conditions, new StringChunk(" or ")),
    new StringChunk(")")
  ]);
}
__name(or, "or");
function not(condition) {
  return sql`not ${condition}`;
}
__name(not, "not");
var gt = /* @__PURE__ */ __name((left, right) => {
  return sql`${left} > ${bindIfParam(right, left)}`;
}, "gt");
var gte = /* @__PURE__ */ __name((left, right) => {
  return sql`${left} >= ${bindIfParam(right, left)}`;
}, "gte");
var lt = /* @__PURE__ */ __name((left, right) => {
  return sql`${left} < ${bindIfParam(right, left)}`;
}, "lt");
var lte = /* @__PURE__ */ __name((left, right) => {
  return sql`${left} <= ${bindIfParam(right, left)}`;
}, "lte");
function inArray(column, values) {
  if (Array.isArray(values)) {
    if (values.length === 0) {
      throw new Error("inArray requires at least one value");
    }
    return sql`${column} in ${values.map((v) => bindIfParam(v, column))}`;
  }
  return sql`${column} in ${bindIfParam(values, column)}`;
}
__name(inArray, "inArray");
function notInArray(column, values) {
  if (Array.isArray(values)) {
    if (values.length === 0) {
      throw new Error("notInArray requires at least one value");
    }
    return sql`${column} not in ${values.map((v) => bindIfParam(v, column))}`;
  }
  return sql`${column} not in ${bindIfParam(values, column)}`;
}
__name(notInArray, "notInArray");
function isNull(value) {
  return sql`${value} is null`;
}
__name(isNull, "isNull");
function isNotNull(value) {
  return sql`${value} is not null`;
}
__name(isNotNull, "isNotNull");
function exists(subquery) {
  return sql`exists ${subquery}`;
}
__name(exists, "exists");
function notExists(subquery) {
  return sql`not exists ${subquery}`;
}
__name(notExists, "notExists");
function between(column, min, max) {
  return sql`${column} between ${bindIfParam(min, column)} and ${bindIfParam(
    max,
    column
  )}`;
}
__name(between, "between");
function notBetween(column, min, max) {
  return sql`${column} not between ${bindIfParam(
    min,
    column
  )} and ${bindIfParam(max, column)}`;
}
__name(notBetween, "notBetween");
function like(column, value) {
  return sql`${column} like ${value}`;
}
__name(like, "like");
function notLike(column, value) {
  return sql`${column} not like ${value}`;
}
__name(notLike, "notLike");
function ilike(column, value) {
  return sql`${column} ilike ${value}`;
}
__name(ilike, "ilike");
function notIlike(column, value) {
  return sql`${column} not ilike ${value}`;
}
__name(notIlike, "notIlike");

// node_modules/drizzle-orm/sql/expressions/select.js
function asc(column) {
  return sql`${column} asc`;
}
__name(asc, "asc");
function desc(column) {
  return sql`${column} desc`;
}
__name(desc, "desc");

// node_modules/drizzle-orm/relations.js
var _a30;
var Relation = class {
  constructor(sourceTable, referencedTable, relationName) {
    this.sourceTable = sourceTable;
    this.referencedTable = referencedTable;
    this.relationName = relationName;
    this.referencedTableName = referencedTable[Table.Symbol.Name];
  }
  referencedTableName;
  fieldName;
};
__name(Relation, "Relation");
_a30 = entityKind;
__publicField(Relation, _a30, "Relation");
var _a31;
var Relations = class {
  constructor(table, config) {
    this.table = table;
    this.config = config;
  }
};
__name(Relations, "Relations");
_a31 = entityKind;
__publicField(Relations, _a31, "Relations");
var _a32;
var _One = class extends Relation {
  constructor(sourceTable, referencedTable, config, isNullable) {
    super(sourceTable, referencedTable, config?.relationName);
    this.config = config;
    this.isNullable = isNullable;
  }
  withFieldName(fieldName) {
    const relation = new _One(
      this.sourceTable,
      this.referencedTable,
      this.config,
      this.isNullable
    );
    relation.fieldName = fieldName;
    return relation;
  }
};
var One = _One;
__name(One, "One");
_a32 = entityKind;
__publicField(One, _a32, "One");
var _a33;
var _Many = class extends Relation {
  constructor(sourceTable, referencedTable, config) {
    super(sourceTable, referencedTable, config?.relationName);
    this.config = config;
  }
  withFieldName(fieldName) {
    const relation = new _Many(
      this.sourceTable,
      this.referencedTable,
      this.config
    );
    relation.fieldName = fieldName;
    return relation;
  }
};
var Many = _Many;
__name(Many, "Many");
_a33 = entityKind;
__publicField(Many, _a33, "Many");
function getOperators() {
  return {
    and,
    between,
    eq,
    exists,
    gt,
    gte,
    ilike,
    inArray,
    isNull,
    isNotNull,
    like,
    lt,
    lte,
    ne,
    not,
    notBetween,
    notExists,
    notLike,
    notIlike,
    notInArray,
    or,
    sql
  };
}
__name(getOperators, "getOperators");
function getOrderByOperators() {
  return {
    sql,
    asc,
    desc
  };
}
__name(getOrderByOperators, "getOrderByOperators");
function extractTablesRelationalConfig(schema, configHelpers) {
  if (Object.keys(schema).length === 1 && "default" in schema && !is(schema["default"], Table)) {
    schema = schema["default"];
  }
  const tableNamesMap = {};
  const relationsBuffer = {};
  const tablesConfig = {};
  for (const [key, value] of Object.entries(schema)) {
    if (isTable(value)) {
      const dbName = value[Table.Symbol.Name];
      const bufferedRelations = relationsBuffer[dbName];
      tableNamesMap[dbName] = key;
      tablesConfig[key] = {
        tsName: key,
        dbName: value[Table.Symbol.Name],
        schema: value[Table.Symbol.Schema],
        columns: value[Table.Symbol.Columns],
        relations: bufferedRelations?.relations ?? {},
        primaryKey: bufferedRelations?.primaryKey ?? []
      };
      for (const column of Object.values(
        value[Table.Symbol.Columns]
      )) {
        if (column.primary) {
          tablesConfig[key].primaryKey.push(column);
        }
      }
      const extraConfig = value[Table.Symbol.ExtraConfigBuilder]?.(value);
      if (extraConfig) {
        for (const configEntry of Object.values(extraConfig)) {
          if (is(configEntry, PrimaryKeyBuilder)) {
            tablesConfig[key].primaryKey.push(...configEntry.columns);
          }
        }
      }
    } else if (is(value, Relations)) {
      const dbName = value.table[Table.Symbol.Name];
      const tableName = tableNamesMap[dbName];
      const relations2 = value.config(
        configHelpers(value.table)
      );
      let primaryKey2;
      for (const [relationName, relation] of Object.entries(relations2)) {
        if (tableName) {
          const tableConfig = tablesConfig[tableName];
          tableConfig.relations[relationName] = relation;
          if (primaryKey2) {
            tableConfig.primaryKey.push(...primaryKey2);
          }
        } else {
          if (!(dbName in relationsBuffer)) {
            relationsBuffer[dbName] = {
              relations: {},
              primaryKey: primaryKey2
            };
          }
          relationsBuffer[dbName].relations[relationName] = relation;
        }
      }
    }
  }
  return { tables: tablesConfig, tableNamesMap };
}
__name(extractTablesRelationalConfig, "extractTablesRelationalConfig");
function createOne(sourceTable) {
  return /* @__PURE__ */ __name(function one(table, config) {
    return new One(
      sourceTable,
      table,
      config,
      config?.fields.reduce((res, f) => res && f.notNull, true) ?? false
    );
  }, "one");
}
__name(createOne, "createOne");
function createMany(sourceTable) {
  return /* @__PURE__ */ __name(function many(referencedTable, config) {
    return new Many(sourceTable, referencedTable, config);
  }, "many");
}
__name(createMany, "createMany");
function normalizeRelation(schema, tableNamesMap, relation) {
  if (is(relation, One) && relation.config) {
    return {
      fields: relation.config.fields,
      references: relation.config.references
    };
  }
  const referencedTableTsName = tableNamesMap[relation.referencedTable[Table.Symbol.Name]];
  if (!referencedTableTsName) {
    throw new Error(
      `Table "${relation.referencedTable[Table.Symbol.Name]}" not found in schema`
    );
  }
  const referencedTableConfig = schema[referencedTableTsName];
  if (!referencedTableConfig) {
    throw new Error(`Table "${referencedTableTsName}" not found in schema`);
  }
  const sourceTable = relation.sourceTable;
  const sourceTableTsName = tableNamesMap[sourceTable[Table.Symbol.Name]];
  if (!sourceTableTsName) {
    throw new Error(
      `Table "${sourceTable[Table.Symbol.Name]}" not found in schema`
    );
  }
  const reverseRelations = [];
  for (const referencedTableRelation of Object.values(
    referencedTableConfig.relations
  )) {
    if (relation.relationName && relation !== referencedTableRelation && referencedTableRelation.relationName === relation.relationName || !relation.relationName && referencedTableRelation.referencedTable === relation.sourceTable) {
      reverseRelations.push(referencedTableRelation);
    }
  }
  if (reverseRelations.length > 1) {
    throw relation.relationName ? new Error(
      `There are multiple relations with name "${relation.relationName}" in table "${referencedTableTsName}"`
    ) : new Error(
      `There are multiple relations between "${referencedTableTsName}" and "${relation.sourceTable[Table.Symbol.Name]}". Please specify relation name`
    );
  }
  if (reverseRelations[0] && is(reverseRelations[0], One) && reverseRelations[0].config) {
    return {
      fields: reverseRelations[0].config.references,
      references: reverseRelations[0].config.fields
    };
  }
  throw new Error(
    `There is not enough information to infer relation "${sourceTableTsName}.${relation.fieldName}"`
  );
}
__name(normalizeRelation, "normalizeRelation");
function createTableRelationsHelpers(sourceTable) {
  return {
    one: createOne(sourceTable),
    many: createMany(sourceTable)
  };
}
__name(createTableRelationsHelpers, "createTableRelationsHelpers");
function mapRelationalRow(tablesConfig, tableConfig, row, buildQueryResultSelection, mapColumnValue = (value) => value) {
  const result = {};
  for (const [
    selectionItemIndex,
    selectionItem
  ] of buildQueryResultSelection.entries()) {
    if (selectionItem.isJson) {
      const relation = tableConfig.relations[selectionItem.tsKey];
      const rawSubRows = row[selectionItemIndex];
      const subRows = typeof rawSubRows === "string" ? JSON.parse(rawSubRows) : rawSubRows;
      result[selectionItem.tsKey] = is(relation, One) ? subRows && mapRelationalRow(
        tablesConfig,
        tablesConfig[selectionItem.relationTableTsKey],
        subRows,
        selectionItem.selection,
        mapColumnValue
      ) : subRows.map(
        (subRow) => mapRelationalRow(
          tablesConfig,
          tablesConfig[selectionItem.relationTableTsKey],
          subRow,
          selectionItem.selection,
          mapColumnValue
        )
      );
    } else {
      const value = mapColumnValue(row[selectionItemIndex]);
      const field = selectionItem.field;
      let decoder;
      if (is(field, Column)) {
        decoder = field;
      } else if (is(field, SQL)) {
        decoder = field.decoder;
      } else {
        decoder = field.sql.decoder;
      }
      result[selectionItem.tsKey] = value === null ? null : decoder.mapFromDriverValue(value);
    }
  }
  return result;
}
__name(mapRelationalRow, "mapRelationalRow");

// node_modules/drizzle-orm/alias.js
var _a34;
var ColumnAliasProxyHandler = class {
  constructor(table) {
    this.table = table;
  }
  get(columnObj, prop) {
    if (prop === "table") {
      return this.table;
    }
    return columnObj[prop];
  }
};
__name(ColumnAliasProxyHandler, "ColumnAliasProxyHandler");
_a34 = entityKind;
__publicField(ColumnAliasProxyHandler, _a34, "ColumnAliasProxyHandler");
var _a35;
var TableAliasProxyHandler = class {
  constructor(alias, replaceOriginalName) {
    this.alias = alias;
    this.replaceOriginalName = replaceOriginalName;
  }
  get(target, prop) {
    if (prop === Table.Symbol.IsAlias) {
      return true;
    }
    if (prop === Table.Symbol.Name) {
      return this.alias;
    }
    if (this.replaceOriginalName && prop === Table.Symbol.OriginalName) {
      return this.alias;
    }
    if (prop === ViewBaseConfig) {
      return {
        ...target[ViewBaseConfig],
        name: this.alias,
        isAlias: true
      };
    }
    if (prop === Table.Symbol.Columns) {
      const columns = target[Table.Symbol.Columns];
      if (!columns) {
        return columns;
      }
      const proxiedColumns = {};
      Object.keys(columns).map((key) => {
        proxiedColumns[key] = new Proxy(
          columns[key],
          new ColumnAliasProxyHandler(new Proxy(target, this))
        );
      });
      return proxiedColumns;
    }
    const value = target[prop];
    if (is(value, Column)) {
      return new Proxy(value, new ColumnAliasProxyHandler(new Proxy(target, this)));
    }
    return value;
  }
};
__name(TableAliasProxyHandler, "TableAliasProxyHandler");
_a35 = entityKind;
__publicField(TableAliasProxyHandler, _a35, "TableAliasProxyHandler");
var _a36;
var RelationTableAliasProxyHandler = class {
  constructor(alias) {
    this.alias = alias;
  }
  get(target, prop) {
    if (prop === "sourceTable") {
      return aliasedTable(target.sourceTable, this.alias);
    }
    return target[prop];
  }
};
__name(RelationTableAliasProxyHandler, "RelationTableAliasProxyHandler");
_a36 = entityKind;
__publicField(RelationTableAliasProxyHandler, _a36, "RelationTableAliasProxyHandler");
function aliasedTable(table, tableAlias) {
  return new Proxy(table, new TableAliasProxyHandler(tableAlias, false));
}
__name(aliasedTable, "aliasedTable");
function aliasedTableColumn(column, tableAlias) {
  return new Proxy(
    column,
    new ColumnAliasProxyHandler(new Proxy(column.table, new TableAliasProxyHandler(tableAlias, false)))
  );
}
__name(aliasedTableColumn, "aliasedTableColumn");
function mapColumnsInAliasedSQLToAlias(query, alias) {
  return new SQL.Aliased(mapColumnsInSQLToAlias(query.sql, alias), query.fieldAlias);
}
__name(mapColumnsInAliasedSQLToAlias, "mapColumnsInAliasedSQLToAlias");
function mapColumnsInSQLToAlias(query, alias) {
  return sql.join(query.queryChunks.map((c) => {
    if (is(c, Column)) {
      return aliasedTableColumn(c, alias);
    }
    if (is(c, SQL)) {
      return mapColumnsInSQLToAlias(c, alias);
    }
    if (is(c, SQL.Aliased)) {
      return mapColumnsInAliasedSQLToAlias(c, alias);
    }
    return c;
  }));
}
__name(mapColumnsInSQLToAlias, "mapColumnsInSQLToAlias");

// node_modules/drizzle-orm/selection-proxy.js
var _a37;
var _SelectionProxyHandler = class {
  config;
  constructor(config) {
    this.config = { ...config };
  }
  get(subquery, prop) {
    if (prop === "_") {
      return {
        ...subquery["_"],
        selectedFields: new Proxy(
          subquery._.selectedFields,
          this
        )
      };
    }
    if (prop === ViewBaseConfig) {
      return {
        ...subquery[ViewBaseConfig],
        selectedFields: new Proxy(
          subquery[ViewBaseConfig].selectedFields,
          this
        )
      };
    }
    if (typeof prop === "symbol") {
      return subquery[prop];
    }
    const columns = is(subquery, Subquery) ? subquery._.selectedFields : is(subquery, View) ? subquery[ViewBaseConfig].selectedFields : subquery;
    const value = columns[prop];
    if (is(value, SQL.Aliased)) {
      if (this.config.sqlAliasedBehavior === "sql" && !value.isSelectionField) {
        return value.sql;
      }
      const newValue = value.clone();
      newValue.isSelectionField = true;
      return newValue;
    }
    if (is(value, SQL)) {
      if (this.config.sqlBehavior === "sql") {
        return value;
      }
      throw new Error(
        `You tried to reference "${prop}" field from a subquery, which is a raw SQL field, but it doesn't have an alias declared. Please add an alias to the field using ".as('alias')" method.`
      );
    }
    if (is(value, Column)) {
      if (this.config.alias) {
        return new Proxy(
          value,
          new ColumnAliasProxyHandler(
            new Proxy(
              value.table,
              new TableAliasProxyHandler(this.config.alias, this.config.replaceOriginalName ?? false)
            )
          )
        );
      }
      return value;
    }
    if (typeof value !== "object" || value === null) {
      return value;
    }
    return new Proxy(value, new _SelectionProxyHandler(this.config));
  }
};
var SelectionProxyHandler = _SelectionProxyHandler;
__name(SelectionProxyHandler, "SelectionProxyHandler");
_a37 = entityKind;
__publicField(SelectionProxyHandler, _a37, "SelectionProxyHandler");

// node_modules/drizzle-orm/query-promise.js
var _a38;
var QueryPromise = class {
  [(_a38 = entityKind, Symbol.toStringTag)] = "QueryPromise";
  catch(onRejected) {
    return this.then(void 0, onRejected);
  }
  finally(onFinally) {
    return this.then(
      (value) => {
        onFinally?.();
        return value;
      },
      (reason) => {
        onFinally?.();
        throw reason;
      }
    );
  }
  then(onFulfilled, onRejected) {
    return this.execute().then(onFulfilled, onRejected);
  }
};
__name(QueryPromise, "QueryPromise");
__publicField(QueryPromise, _a38, "QueryPromise");

// node_modules/drizzle-orm/sqlite-core/table.js
var InlineForeignKeys2 = Symbol.for("drizzle:SQLiteInlineForeignKeys");
var _a39;
var SQLiteTable = class extends Table {
  /** @internal */
  [(_a39 = entityKind, Table.Symbol.Columns)];
  /** @internal */
  [InlineForeignKeys2] = [];
  /** @internal */
  [Table.Symbol.ExtraConfigBuilder] = void 0;
};
__name(SQLiteTable, "SQLiteTable");
__publicField(SQLiteTable, _a39, "SQLiteTable");
/** @internal */
__publicField(SQLiteTable, "Symbol", Object.assign({}, Table.Symbol, {
  InlineForeignKeys: InlineForeignKeys2
}));
function sqliteTableBase(name, columns, extraConfig, schema, baseName = name) {
  const rawTable = new SQLiteTable(name, schema, baseName);
  const builtColumns = Object.fromEntries(
    Object.entries(columns).map(([name2, colBuilderBase]) => {
      const colBuilder = colBuilderBase;
      const column = colBuilder.build(rawTable);
      rawTable[InlineForeignKeys2].push(...colBuilder.buildForeignKeys(column, rawTable));
      return [name2, column];
    })
  );
  const table = Object.assign(rawTable, builtColumns);
  table[Table.Symbol.Columns] = builtColumns;
  if (extraConfig) {
    table[SQLiteTable.Symbol.ExtraConfigBuilder] = extraConfig;
  }
  return table;
}
__name(sqliteTableBase, "sqliteTableBase");
var sqliteTable = /* @__PURE__ */ __name((name, columns, extraConfig) => {
  return sqliteTableBase(name, columns, extraConfig);
}, "sqliteTable");

// node_modules/drizzle-orm/utils.js
function mapResultRow(columns, row, joinsNotNullableMap) {
  const nullifyMap = {};
  const result = columns.reduce(
    (result2, { path, field }, columnIndex) => {
      let decoder;
      if (is(field, Column)) {
        decoder = field;
      } else if (is(field, SQL)) {
        decoder = field.decoder;
      } else {
        decoder = field.sql.decoder;
      }
      let node = result2;
      for (const [pathChunkIndex, pathChunk] of path.entries()) {
        if (pathChunkIndex < path.length - 1) {
          if (!(pathChunk in node)) {
            node[pathChunk] = {};
          }
          node = node[pathChunk];
        } else {
          const rawValue = row[columnIndex];
          const value = node[pathChunk] = rawValue === null ? null : decoder.mapFromDriverValue(rawValue);
          if (joinsNotNullableMap && is(field, Column) && path.length === 2) {
            const objectName = path[0];
            if (!(objectName in nullifyMap)) {
              nullifyMap[objectName] = value === null ? getTableName(field.table) : false;
            } else if (typeof nullifyMap[objectName] === "string" && nullifyMap[objectName] !== getTableName(field.table)) {
              nullifyMap[objectName] = false;
            }
          }
        }
      }
      return result2;
    },
    {}
  );
  if (joinsNotNullableMap && Object.keys(nullifyMap).length > 0) {
    for (const [objectName, tableName] of Object.entries(nullifyMap)) {
      if (typeof tableName === "string" && !joinsNotNullableMap[tableName]) {
        result[objectName] = null;
      }
    }
  }
  return result;
}
__name(mapResultRow, "mapResultRow");
function orderSelectedFields(fields, pathPrefix) {
  return Object.entries(fields).reduce((result, [name, field]) => {
    if (typeof name !== "string") {
      return result;
    }
    const newPath = pathPrefix ? [...pathPrefix, name] : [name];
    if (is(field, Column) || is(field, SQL) || is(field, SQL.Aliased)) {
      result.push({ path: newPath, field });
    } else if (is(field, Table)) {
      result.push(...orderSelectedFields(field[Table.Symbol.Columns], newPath));
    } else {
      result.push(...orderSelectedFields(field, newPath));
    }
    return result;
  }, []);
}
__name(orderSelectedFields, "orderSelectedFields");
function haveSameKeys(left, right) {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }
  for (const [index, key] of leftKeys.entries()) {
    if (key !== rightKeys[index]) {
      return false;
    }
  }
  return true;
}
__name(haveSameKeys, "haveSameKeys");
function mapUpdateSet(table, values) {
  const entries = Object.entries(values).filter(([, value]) => value !== void 0).map(([key, value]) => {
    if (is(value, SQL)) {
      return [key, value];
    } else {
      return [key, new Param(value, table[Table.Symbol.Columns][key])];
    }
  });
  if (entries.length === 0) {
    throw new Error("No values to set");
  }
  return Object.fromEntries(entries);
}
__name(mapUpdateSet, "mapUpdateSet");
function applyMixins(baseClass, extendedClasses) {
  for (const extendedClass of extendedClasses) {
    for (const name of Object.getOwnPropertyNames(extendedClass.prototype)) {
      if (name === "constructor")
        continue;
      Object.defineProperty(
        baseClass.prototype,
        name,
        Object.getOwnPropertyDescriptor(extendedClass.prototype, name) || /* @__PURE__ */ Object.create(null)
      );
    }
  }
}
__name(applyMixins, "applyMixins");
function getTableColumns(table) {
  return table[Table.Symbol.Columns];
}
__name(getTableColumns, "getTableColumns");
function getTableLikeName(table) {
  return is(table, Subquery) ? table._.alias : is(table, View) ? table[ViewBaseConfig].name : is(table, SQL) ? void 0 : table[Table.Symbol.IsAlias] ? table[Table.Symbol.Name] : table[Table.Symbol.BaseName];
}
__name(getTableLikeName, "getTableLikeName");

// node_modules/drizzle-orm/sqlite-core/query-builders/delete.js
var _a40;
var SQLiteDeleteBase = class extends QueryPromise {
  constructor(table, session, dialect, withList) {
    super();
    this.table = table;
    this.session = session;
    this.dialect = dialect;
    this.config = { table, withList };
  }
  /** @internal */
  config;
  /**
   * Adds a `where` clause to the query.
   *
   * Calling this method will delete only those rows that fulfill a specified condition.
   *
   * See docs: {@link https://orm.drizzle.team/docs/delete}
   *
   * @param where the `where` clause.
   *
   * @example
   * You can use conditional operators and `sql function` to filter the rows to be deleted.
   *
   * ```ts
   * // Delete all cars with green color
   * db.delete(cars).where(eq(cars.color, 'green'));
   * // or
   * db.delete(cars).where(sql`${cars.color} = 'green'`)
   * ```
   *
   * You can logically combine conditional operators with `and()` and `or()` operators:
   *
   * ```ts
   * // Delete all BMW cars with a green color
   * db.delete(cars).where(and(eq(cars.color, 'green'), eq(cars.brand, 'BMW')));
   *
   * // Delete all cars with the green or blue color
   * db.delete(cars).where(or(eq(cars.color, 'green'), eq(cars.color, 'blue')));
   * ```
   */
  where(where) {
    this.config.where = where;
    return this;
  }
  returning(fields = this.table[SQLiteTable.Symbol.Columns]) {
    this.config.returning = orderSelectedFields(fields);
    return this;
  }
  /** @internal */
  getSQL() {
    return this.dialect.buildDeleteQuery(this.config);
  }
  toSQL() {
    const { typings: _typings, ...rest } = this.dialect.sqlToQuery(this.getSQL());
    return rest;
  }
  /** @internal */
  _prepare(isOneTimeQuery = true) {
    return this.session[isOneTimeQuery ? "prepareOneTimeQuery" : "prepareQuery"](
      this.dialect.sqlToQuery(this.getSQL()),
      this.config.returning,
      this.config.returning ? "all" : "run",
      true
    );
  }
  prepare() {
    return this._prepare(false);
  }
  run = (placeholderValues) => {
    return this._prepare().run(placeholderValues);
  };
  all = (placeholderValues) => {
    return this._prepare().all(placeholderValues);
  };
  get = (placeholderValues) => {
    return this._prepare().get(placeholderValues);
  };
  values = (placeholderValues) => {
    return this._prepare().values(placeholderValues);
  };
  async execute(placeholderValues) {
    return this._prepare().execute(placeholderValues);
  }
  $dynamic() {
    return this;
  }
};
__name(SQLiteDeleteBase, "SQLiteDeleteBase");
_a40 = entityKind;
__publicField(SQLiteDeleteBase, _a40, "SQLiteDelete");

// node_modules/drizzle-orm/sqlite-core/query-builders/insert.js
var _a41;
var SQLiteInsertBuilder = class {
  constructor(table, session, dialect, withList) {
    this.table = table;
    this.session = session;
    this.dialect = dialect;
    this.withList = withList;
  }
  values(values) {
    values = Array.isArray(values) ? values : [values];
    if (values.length === 0) {
      throw new Error("values() must be called with at least one value");
    }
    const mappedValues = values.map((entry) => {
      const result = {};
      const cols = this.table[Table.Symbol.Columns];
      for (const colKey of Object.keys(entry)) {
        const colValue = entry[colKey];
        result[colKey] = is(colValue, SQL) ? colValue : new Param(colValue, cols[colKey]);
      }
      return result;
    });
    return new SQLiteInsertBase(this.table, mappedValues, this.session, this.dialect, this.withList);
  }
};
__name(SQLiteInsertBuilder, "SQLiteInsertBuilder");
_a41 = entityKind;
__publicField(SQLiteInsertBuilder, _a41, "SQLiteInsertBuilder");
var _a42;
var SQLiteInsertBase = class extends QueryPromise {
  constructor(table, values, session, dialect, withList) {
    super();
    this.session = session;
    this.dialect = dialect;
    this.config = { table, values, withList };
  }
  /** @internal */
  config;
  returning(fields = this.config.table[SQLiteTable.Symbol.Columns]) {
    this.config.returning = orderSelectedFields(fields);
    return this;
  }
  /**
   * Adds an `on conflict do nothing` clause to the query.
   *
   * Calling this method simply avoids inserting a row as its alternative action.
   *
   * See docs: {@link https://orm.drizzle.team/docs/insert#on-conflict-do-nothing}
   *
   * @param config The `target` and `where` clauses.
   *
   * @example
   * ```ts
   * // Insert one row and cancel the insert if there's a conflict
   * await db.insert(cars)
   *   .values({ id: 1, brand: 'BMW' })
   *   .onConflictDoNothing();
   *
   * // Explicitly specify conflict target
   * await db.insert(cars)
   *   .values({ id: 1, brand: 'BMW' })
   *   .onConflictDoNothing({ target: cars.id });
   * ```
   */
  onConflictDoNothing(config = {}) {
    if (config.target === void 0) {
      this.config.onConflict = sql`do nothing`;
    } else {
      const targetSql = Array.isArray(config.target) ? sql`${config.target}` : sql`${[config.target]}`;
      const whereSql = config.where ? sql` where ${config.where}` : sql``;
      this.config.onConflict = sql`${targetSql} do nothing${whereSql}`;
    }
    return this;
  }
  /**
   * Adds an `on conflict do update` clause to the query.
   *
   * Calling this method will update the existing row that conflicts with the row proposed for insertion as its alternative action.
   *
   * See docs: {@link https://orm.drizzle.team/docs/insert#upserts-and-conflicts}
   *
   * @param config The `target`, `set` and `where` clauses.
   *
   * @example
   * ```ts
   * // Update the row if there's a conflict
   * await db.insert(cars)
   *   .values({ id: 1, brand: 'BMW' })
   *   .onConflictDoUpdate({
   *     target: cars.id,
   *     set: { brand: 'Porsche' }
   *   });
   *
   * // Upsert with 'where' clause
   * await db.insert(cars)
   *   .values({ id: 1, brand: 'BMW' })
   *   .onConflictDoUpdate({
   *     target: cars.id,
   *     set: { brand: 'newBMW' },
   *     where: sql`${cars.createdAt} > '2023-01-01'::date`,
   *   });
   * ```
   */
  onConflictDoUpdate(config) {
    if (config.where && (config.targetWhere || config.setWhere)) {
      throw new Error(
        'You cannot use both "where" and "targetWhere"/"setWhere" at the same time - "where" is deprecated, use "targetWhere" or "setWhere" instead.'
      );
    }
    const whereSql = config.where ? sql` where ${config.where}` : void 0;
    const targetWhereSql = config.targetWhere ? sql` where ${config.targetWhere}` : void 0;
    const setWhereSql = config.setWhere ? sql` where ${config.setWhere}` : void 0;
    const targetSql = Array.isArray(config.target) ? sql`${config.target}` : sql`${[config.target]}`;
    const setSql = this.dialect.buildUpdateSet(this.config.table, mapUpdateSet(this.config.table, config.set));
    this.config.onConflict = sql`${targetSql}${targetWhereSql} do update set ${setSql}${whereSql}${setWhereSql}`;
    return this;
  }
  /** @internal */
  getSQL() {
    return this.dialect.buildInsertQuery(this.config);
  }
  toSQL() {
    const { typings: _typings, ...rest } = this.dialect.sqlToQuery(this.getSQL());
    return rest;
  }
  /** @internal */
  _prepare(isOneTimeQuery = true) {
    return this.session[isOneTimeQuery ? "prepareOneTimeQuery" : "prepareQuery"](
      this.dialect.sqlToQuery(this.getSQL()),
      this.config.returning,
      this.config.returning ? "all" : "run",
      true
    );
  }
  prepare() {
    return this._prepare(false);
  }
  run = (placeholderValues) => {
    return this._prepare().run(placeholderValues);
  };
  all = (placeholderValues) => {
    return this._prepare().all(placeholderValues);
  };
  get = (placeholderValues) => {
    return this._prepare().get(placeholderValues);
  };
  values = (placeholderValues) => {
    return this._prepare().values(placeholderValues);
  };
  async execute() {
    return this.config.returning ? this.all() : this.run();
  }
  $dynamic() {
    return this;
  }
};
__name(SQLiteInsertBase, "SQLiteInsertBase");
_a42 = entityKind;
__publicField(SQLiteInsertBase, _a42, "SQLiteInsert");

// node_modules/drizzle-orm/errors.js
var _a43;
var DrizzleError = class extends Error {
  constructor({ message, cause }) {
    super(message);
    this.name = "DrizzleError";
    this.cause = cause;
  }
};
__name(DrizzleError, "DrizzleError");
_a43 = entityKind;
__publicField(DrizzleError, _a43, "DrizzleError");
var _a44;
var TransactionRollbackError = class extends DrizzleError {
  constructor() {
    super({ message: "Rollback" });
  }
};
__name(TransactionRollbackError, "TransactionRollbackError");
_a44 = entityKind;
__publicField(TransactionRollbackError, _a44, "TransactionRollbackError");

// node_modules/drizzle-orm/sqlite-core/foreign-keys.js
var _a45;
var ForeignKeyBuilder2 = class {
  /** @internal */
  reference;
  /** @internal */
  _onUpdate;
  /** @internal */
  _onDelete;
  constructor(config, actions) {
    this.reference = () => {
      const { name, columns, foreignColumns } = config();
      return { name, columns, foreignTable: foreignColumns[0].table, foreignColumns };
    };
    if (actions) {
      this._onUpdate = actions.onUpdate;
      this._onDelete = actions.onDelete;
    }
  }
  onUpdate(action) {
    this._onUpdate = action;
    return this;
  }
  onDelete(action) {
    this._onDelete = action;
    return this;
  }
  /** @internal */
  build(table) {
    return new ForeignKey2(table, this);
  }
};
__name(ForeignKeyBuilder2, "ForeignKeyBuilder");
_a45 = entityKind;
__publicField(ForeignKeyBuilder2, _a45, "SQLiteForeignKeyBuilder");
var _a46;
var ForeignKey2 = class {
  constructor(table, builder) {
    this.table = table;
    this.reference = builder.reference;
    this.onUpdate = builder._onUpdate;
    this.onDelete = builder._onDelete;
  }
  reference;
  onUpdate;
  onDelete;
  getName() {
    const { name, columns, foreignColumns } = this.reference();
    const columnNames = columns.map((column) => column.name);
    const foreignColumnNames = foreignColumns.map((column) => column.name);
    const chunks = [
      this.table[SQLiteTable.Symbol.Name],
      ...columnNames,
      foreignColumns[0].table[SQLiteTable.Symbol.Name],
      ...foreignColumnNames
    ];
    return name ?? `${chunks.join("_")}_fk`;
  }
};
__name(ForeignKey2, "ForeignKey");
_a46 = entityKind;
__publicField(ForeignKey2, _a46, "SQLiteForeignKey");

// node_modules/drizzle-orm/sqlite-core/unique-constraint.js
function uniqueKeyName2(table, columns) {
  return `${table[SQLiteTable.Symbol.Name]}_${columns.join("_")}_unique`;
}
__name(uniqueKeyName2, "uniqueKeyName");
var _a47;
var UniqueConstraintBuilder2 = class {
  constructor(columns, name) {
    this.name = name;
    this.columns = columns;
  }
  /** @internal */
  columns;
  /** @internal */
  build(table) {
    return new UniqueConstraint2(table, this.columns, this.name);
  }
};
__name(UniqueConstraintBuilder2, "UniqueConstraintBuilder");
_a47 = entityKind;
__publicField(UniqueConstraintBuilder2, _a47, "SQLiteUniqueConstraintBuilder");
var _a48;
var UniqueOnConstraintBuilder2 = class {
  /** @internal */
  name;
  constructor(name) {
    this.name = name;
  }
  on(...columns) {
    return new UniqueConstraintBuilder2(columns, this.name);
  }
};
__name(UniqueOnConstraintBuilder2, "UniqueOnConstraintBuilder");
_a48 = entityKind;
__publicField(UniqueOnConstraintBuilder2, _a48, "SQLiteUniqueOnConstraintBuilder");
var _a49;
var UniqueConstraint2 = class {
  constructor(table, columns, name) {
    this.table = table;
    this.columns = columns;
    this.name = name ?? uniqueKeyName2(this.table, this.columns.map((column) => column.name));
  }
  columns;
  name;
  getName() {
    return this.name;
  }
};
__name(UniqueConstraint2, "UniqueConstraint");
_a49 = entityKind;
__publicField(UniqueConstraint2, _a49, "SQLiteUniqueConstraint");

// node_modules/drizzle-orm/sqlite-core/columns/common.js
var _a50;
var SQLiteColumnBuilder = class extends ColumnBuilder {
  foreignKeyConfigs = [];
  references(ref, actions = {}) {
    this.foreignKeyConfigs.push({ ref, actions });
    return this;
  }
  unique(name) {
    this.config.isUnique = true;
    this.config.uniqueName = name;
    return this;
  }
  /** @internal */
  buildForeignKeys(column, table) {
    return this.foreignKeyConfigs.map(({ ref, actions }) => {
      return ((ref2, actions2) => {
        const builder = new ForeignKeyBuilder2(() => {
          const foreignColumn = ref2();
          return { columns: [column], foreignColumns: [foreignColumn] };
        });
        if (actions2.onUpdate) {
          builder.onUpdate(actions2.onUpdate);
        }
        if (actions2.onDelete) {
          builder.onDelete(actions2.onDelete);
        }
        return builder.build(table);
      })(ref, actions);
    });
  }
};
__name(SQLiteColumnBuilder, "SQLiteColumnBuilder");
_a50 = entityKind;
__publicField(SQLiteColumnBuilder, _a50, "SQLiteColumnBuilder");
var _a51;
var SQLiteColumn = class extends Column {
  constructor(table, config) {
    if (!config.uniqueName) {
      config.uniqueName = uniqueKeyName2(table, [config.name]);
    }
    super(table, config);
    this.table = table;
  }
};
__name(SQLiteColumn, "SQLiteColumn");
_a51 = entityKind;
__publicField(SQLiteColumn, _a51, "SQLiteColumn");

// node_modules/drizzle-orm/sqlite-core/columns/integer.js
var _a52;
var SQLiteBaseIntegerBuilder = class extends SQLiteColumnBuilder {
  constructor(name, dataType, columnType) {
    super(name, dataType, columnType);
    this.config.autoIncrement = false;
  }
  primaryKey(config) {
    if (config?.autoIncrement) {
      this.config.autoIncrement = true;
    }
    this.config.hasDefault = true;
    return super.primaryKey();
  }
};
__name(SQLiteBaseIntegerBuilder, "SQLiteBaseIntegerBuilder");
_a52 = entityKind;
__publicField(SQLiteBaseIntegerBuilder, _a52, "SQLiteBaseIntegerBuilder");
var _a53;
var SQLiteBaseInteger = class extends SQLiteColumn {
  autoIncrement = this.config.autoIncrement;
  getSQLType() {
    return "integer";
  }
};
__name(SQLiteBaseInteger, "SQLiteBaseInteger");
_a53 = entityKind;
__publicField(SQLiteBaseInteger, _a53, "SQLiteBaseInteger");
var _a54;
var SQLiteIntegerBuilder = class extends SQLiteBaseIntegerBuilder {
  constructor(name) {
    super(name, "number", "SQLiteInteger");
  }
  build(table) {
    return new SQLiteInteger(
      table,
      this.config
    );
  }
};
__name(SQLiteIntegerBuilder, "SQLiteIntegerBuilder");
_a54 = entityKind;
__publicField(SQLiteIntegerBuilder, _a54, "SQLiteIntegerBuilder");
var _a55;
var SQLiteInteger = class extends SQLiteBaseInteger {
};
__name(SQLiteInteger, "SQLiteInteger");
_a55 = entityKind;
__publicField(SQLiteInteger, _a55, "SQLiteInteger");
var _a56;
var SQLiteTimestampBuilder = class extends SQLiteBaseIntegerBuilder {
  constructor(name, mode) {
    super(name, "date", "SQLiteTimestamp");
    this.config.mode = mode;
  }
  /**
   * @deprecated Use `default()` with your own expression instead.
   *
   * Adds `DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer))` to the column, which is the current epoch timestamp in milliseconds.
   */
  defaultNow() {
    return this.default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`);
  }
  build(table) {
    return new SQLiteTimestamp(
      table,
      this.config
    );
  }
};
__name(SQLiteTimestampBuilder, "SQLiteTimestampBuilder");
_a56 = entityKind;
__publicField(SQLiteTimestampBuilder, _a56, "SQLiteTimestampBuilder");
var _a57;
var SQLiteTimestamp = class extends SQLiteBaseInteger {
  mode = this.config.mode;
  mapFromDriverValue(value) {
    if (this.config.mode === "timestamp") {
      return new Date(value * 1e3);
    }
    return new Date(value);
  }
  mapToDriverValue(value) {
    const unix = value.getTime();
    if (this.config.mode === "timestamp") {
      return Math.floor(unix / 1e3);
    }
    return unix;
  }
};
__name(SQLiteTimestamp, "SQLiteTimestamp");
_a57 = entityKind;
__publicField(SQLiteTimestamp, _a57, "SQLiteTimestamp");
var _a58;
var SQLiteBooleanBuilder = class extends SQLiteBaseIntegerBuilder {
  constructor(name, mode) {
    super(name, "boolean", "SQLiteBoolean");
    this.config.mode = mode;
  }
  build(table) {
    return new SQLiteBoolean(
      table,
      this.config
    );
  }
};
__name(SQLiteBooleanBuilder, "SQLiteBooleanBuilder");
_a58 = entityKind;
__publicField(SQLiteBooleanBuilder, _a58, "SQLiteBooleanBuilder");
var _a59;
var SQLiteBoolean = class extends SQLiteBaseInteger {
  mode = this.config.mode;
  mapFromDriverValue(value) {
    return Number(value) === 1;
  }
  mapToDriverValue(value) {
    return value ? 1 : 0;
  }
};
__name(SQLiteBoolean, "SQLiteBoolean");
_a59 = entityKind;
__publicField(SQLiteBoolean, _a59, "SQLiteBoolean");
function integer(name, config) {
  if (config?.mode === "timestamp" || config?.mode === "timestamp_ms") {
    return new SQLiteTimestampBuilder(name, config.mode);
  }
  if (config?.mode === "boolean") {
    return new SQLiteBooleanBuilder(name, config.mode);
  }
  return new SQLiteIntegerBuilder(name);
}
__name(integer, "integer");

// node_modules/drizzle-orm/sqlite-core/columns/real.js
var _a60;
var SQLiteRealBuilder = class extends SQLiteColumnBuilder {
  constructor(name) {
    super(name, "number", "SQLiteReal");
  }
  /** @internal */
  build(table) {
    return new SQLiteReal(table, this.config);
  }
};
__name(SQLiteRealBuilder, "SQLiteRealBuilder");
_a60 = entityKind;
__publicField(SQLiteRealBuilder, _a60, "SQLiteRealBuilder");
var _a61;
var SQLiteReal = class extends SQLiteColumn {
  getSQLType() {
    return "real";
  }
};
__name(SQLiteReal, "SQLiteReal");
_a61 = entityKind;
__publicField(SQLiteReal, _a61, "SQLiteReal");
function real(name) {
  return new SQLiteRealBuilder(name);
}
__name(real, "real");

// node_modules/drizzle-orm/sqlite-core/columns/text.js
var _a62;
var SQLiteTextBuilder = class extends SQLiteColumnBuilder {
  constructor(name, config) {
    super(name, "string", "SQLiteText");
    this.config.enumValues = config.enum;
    this.config.length = config.length;
  }
  /** @internal */
  build(table) {
    return new SQLiteText(table, this.config);
  }
};
__name(SQLiteTextBuilder, "SQLiteTextBuilder");
_a62 = entityKind;
__publicField(SQLiteTextBuilder, _a62, "SQLiteTextBuilder");
var _a63;
var SQLiteText = class extends SQLiteColumn {
  enumValues = this.config.enumValues;
  length = this.config.length;
  constructor(table, config) {
    super(table, config);
  }
  getSQLType() {
    return `text${this.config.length ? `(${this.config.length})` : ""}`;
  }
};
__name(SQLiteText, "SQLiteText");
_a63 = entityKind;
__publicField(SQLiteText, _a63, "SQLiteText");
var _a64;
var SQLiteTextJsonBuilder = class extends SQLiteColumnBuilder {
  constructor(name) {
    super(name, "json", "SQLiteTextJson");
  }
  /** @internal */
  build(table) {
    return new SQLiteTextJson(
      table,
      this.config
    );
  }
};
__name(SQLiteTextJsonBuilder, "SQLiteTextJsonBuilder");
_a64 = entityKind;
__publicField(SQLiteTextJsonBuilder, _a64, "SQLiteTextJsonBuilder");
var _a65;
var SQLiteTextJson = class extends SQLiteColumn {
  getSQLType() {
    return "text";
  }
  mapFromDriverValue(value) {
    return JSON.parse(value);
  }
  mapToDriverValue(value) {
    return JSON.stringify(value);
  }
};
__name(SQLiteTextJson, "SQLiteTextJson");
_a65 = entityKind;
__publicField(SQLiteTextJson, _a65, "SQLiteTextJson");
function text(name, config = {}) {
  return config.mode === "json" ? new SQLiteTextJsonBuilder(name) : new SQLiteTextBuilder(name, config);
}
__name(text, "text");

// node_modules/drizzle-orm/sqlite-core/view-base.js
var _a66;
var SQLiteViewBase = class extends View {
};
__name(SQLiteViewBase, "SQLiteViewBase");
_a66 = entityKind;
__publicField(SQLiteViewBase, _a66, "SQLiteViewBase");

// node_modules/drizzle-orm/sqlite-core/dialect.js
var _a67;
var SQLiteDialect = class {
  escapeName(name) {
    return `"${name}"`;
  }
  escapeParam(_num) {
    return "?";
  }
  escapeString(str) {
    return `'${str.replace(/'/g, "''")}'`;
  }
  buildWithCTE(queries) {
    if (!queries?.length)
      return void 0;
    const withSqlChunks = [sql`with `];
    for (const [i, w] of queries.entries()) {
      withSqlChunks.push(sql`${sql.identifier(w._.alias)} as (${w._.sql})`);
      if (i < queries.length - 1) {
        withSqlChunks.push(sql`, `);
      }
    }
    withSqlChunks.push(sql` `);
    return sql.join(withSqlChunks);
  }
  buildDeleteQuery({ table, where, returning, withList }) {
    const withSql = this.buildWithCTE(withList);
    const returningSql = returning ? sql` returning ${this.buildSelection(returning, { isSingleTable: true })}` : void 0;
    const whereSql = where ? sql` where ${where}` : void 0;
    return sql`${withSql}delete from ${table}${whereSql}${returningSql}`;
  }
  buildUpdateSet(table, set) {
    const tableColumns = table[Table.Symbol.Columns];
    const columnNames = Object.keys(tableColumns).filter(
      (colName) => set[colName] !== void 0 || tableColumns[colName]?.onUpdateFn !== void 0
    );
    const setSize = columnNames.length;
    return sql.join(columnNames.flatMap((colName, i) => {
      const col = tableColumns[colName];
      const value = set[colName] ?? sql.param(col.onUpdateFn(), col);
      const res = sql`${sql.identifier(col.name)} = ${value}`;
      if (i < setSize - 1) {
        return [res, sql.raw(", ")];
      }
      return [res];
    }));
  }
  buildUpdateQuery({ table, set, where, returning, withList }) {
    const withSql = this.buildWithCTE(withList);
    const setSql = this.buildUpdateSet(table, set);
    const returningSql = returning ? sql` returning ${this.buildSelection(returning, { isSingleTable: true })}` : void 0;
    const whereSql = where ? sql` where ${where}` : void 0;
    return sql`${withSql}update ${table} set ${setSql}${whereSql}${returningSql}`;
  }
  /**
   * Builds selection SQL with provided fields/expressions
   *
   * Examples:
   *
   * `select <selection> from`
   *
   * `insert ... returning <selection>`
   *
   * If `isSingleTable` is true, then columns won't be prefixed with table name
   */
  buildSelection(fields, { isSingleTable = false } = {}) {
    const columnsLen = fields.length;
    const chunks = fields.flatMap(({ field }, i) => {
      const chunk = [];
      if (is(field, SQL.Aliased) && field.isSelectionField) {
        chunk.push(sql.identifier(field.fieldAlias));
      } else if (is(field, SQL.Aliased) || is(field, SQL)) {
        const query = is(field, SQL.Aliased) ? field.sql : field;
        if (isSingleTable) {
          chunk.push(
            new SQL(
              query.queryChunks.map((c) => {
                if (is(c, Column)) {
                  return sql.identifier(c.name);
                }
                return c;
              })
            )
          );
        } else {
          chunk.push(query);
        }
        if (is(field, SQL.Aliased)) {
          chunk.push(sql` as ${sql.identifier(field.fieldAlias)}`);
        }
      } else if (is(field, Column)) {
        const tableName = field.table[Table.Symbol.Name];
        const columnName = field.name;
        if (isSingleTable) {
          chunk.push(sql.identifier(columnName));
        } else {
          chunk.push(sql`${sql.identifier(tableName)}.${sql.identifier(columnName)}`);
        }
      }
      if (i < columnsLen - 1) {
        chunk.push(sql`, `);
      }
      return chunk;
    });
    return sql.join(chunks);
  }
  buildSelectQuery({
    withList,
    fields,
    fieldsFlat,
    where,
    having,
    table,
    joins,
    orderBy,
    groupBy,
    limit,
    offset,
    distinct,
    setOperators
  }) {
    const fieldsList = fieldsFlat ?? orderSelectedFields(fields);
    for (const f of fieldsList) {
      if (is(f.field, Column) && getTableName(f.field.table) !== (is(table, Subquery) ? table._.alias : is(table, SQLiteViewBase) ? table[ViewBaseConfig].name : is(table, SQL) ? void 0 : getTableName(table)) && !((table2) => joins?.some(
        ({ alias }) => alias === (table2[Table.Symbol.IsAlias] ? getTableName(table2) : table2[Table.Symbol.BaseName])
      ))(f.field.table)) {
        const tableName = getTableName(f.field.table);
        throw new Error(
          `Your "${f.path.join("->")}" field references a column "${tableName}"."${f.field.name}", but the table "${tableName}" is not part of the query! Did you forget to join it?`
        );
      }
    }
    const isSingleTable = !joins || joins.length === 0;
    const withSql = this.buildWithCTE(withList);
    const distinctSql = distinct ? sql` distinct` : void 0;
    const selection = this.buildSelection(fieldsList, { isSingleTable });
    const tableSql = (() => {
      if (is(table, Table) && table[Table.Symbol.OriginalName] !== table[Table.Symbol.Name]) {
        return sql`${sql.identifier(table[Table.Symbol.OriginalName])} ${sql.identifier(table[Table.Symbol.Name])}`;
      }
      return table;
    })();
    const joinsArray = [];
    if (joins) {
      for (const [index, joinMeta] of joins.entries()) {
        if (index === 0) {
          joinsArray.push(sql` `);
        }
        const table2 = joinMeta.table;
        if (is(table2, SQLiteTable)) {
          const tableName = table2[SQLiteTable.Symbol.Name];
          const tableSchema = table2[SQLiteTable.Symbol.Schema];
          const origTableName = table2[SQLiteTable.Symbol.OriginalName];
          const alias = tableName === origTableName ? void 0 : joinMeta.alias;
          joinsArray.push(
            sql`${sql.raw(joinMeta.joinType)} join ${tableSchema ? sql`${sql.identifier(tableSchema)}.` : void 0}${sql.identifier(origTableName)}${alias && sql` ${sql.identifier(alias)}`} on ${joinMeta.on}`
          );
        } else {
          joinsArray.push(
            sql`${sql.raw(joinMeta.joinType)} join ${table2} on ${joinMeta.on}`
          );
        }
        if (index < joins.length - 1) {
          joinsArray.push(sql` `);
        }
      }
    }
    const joinsSql = sql.join(joinsArray);
    const whereSql = where ? sql` where ${where}` : void 0;
    const havingSql = having ? sql` having ${having}` : void 0;
    const orderByList = [];
    if (orderBy) {
      for (const [index, orderByValue] of orderBy.entries()) {
        orderByList.push(orderByValue);
        if (index < orderBy.length - 1) {
          orderByList.push(sql`, `);
        }
      }
    }
    const groupByList = [];
    if (groupBy) {
      for (const [index, groupByValue] of groupBy.entries()) {
        groupByList.push(groupByValue);
        if (index < groupBy.length - 1) {
          groupByList.push(sql`, `);
        }
      }
    }
    const groupBySql = groupByList.length > 0 ? sql` group by ${sql.join(groupByList)}` : void 0;
    const orderBySql = orderByList.length > 0 ? sql` order by ${sql.join(orderByList)}` : void 0;
    const limitSql = limit ? sql` limit ${limit}` : void 0;
    const offsetSql = offset ? sql` offset ${offset}` : void 0;
    const finalQuery = sql`${withSql}select${distinctSql} ${selection} from ${tableSql}${joinsSql}${whereSql}${groupBySql}${havingSql}${orderBySql}${limitSql}${offsetSql}`;
    if (setOperators.length > 0) {
      return this.buildSetOperations(finalQuery, setOperators);
    }
    return finalQuery;
  }
  buildSetOperations(leftSelect, setOperators) {
    const [setOperator, ...rest] = setOperators;
    if (!setOperator) {
      throw new Error("Cannot pass undefined values to any set operator");
    }
    if (rest.length === 0) {
      return this.buildSetOperationQuery({ leftSelect, setOperator });
    }
    return this.buildSetOperations(
      this.buildSetOperationQuery({ leftSelect, setOperator }),
      rest
    );
  }
  buildSetOperationQuery({
    leftSelect,
    setOperator: { type, isAll, rightSelect, limit, orderBy, offset }
  }) {
    const leftChunk = sql`${leftSelect.getSQL()} `;
    const rightChunk = sql`${rightSelect.getSQL()}`;
    let orderBySql;
    if (orderBy && orderBy.length > 0) {
      const orderByValues = [];
      for (const singleOrderBy of orderBy) {
        if (is(singleOrderBy, SQLiteColumn)) {
          orderByValues.push(sql.identifier(singleOrderBy.name));
        } else if (is(singleOrderBy, SQL)) {
          for (let i = 0; i < singleOrderBy.queryChunks.length; i++) {
            const chunk = singleOrderBy.queryChunks[i];
            if (is(chunk, SQLiteColumn)) {
              singleOrderBy.queryChunks[i] = sql.identifier(chunk.name);
            }
          }
          orderByValues.push(sql`${singleOrderBy}`);
        } else {
          orderByValues.push(sql`${singleOrderBy}`);
        }
      }
      orderBySql = sql` order by ${sql.join(orderByValues, sql`, `)}`;
    }
    const limitSql = limit ? sql` limit ${limit}` : void 0;
    const operatorChunk = sql.raw(`${type} ${isAll ? "all " : ""}`);
    const offsetSql = offset ? sql` offset ${offset}` : void 0;
    return sql`${leftChunk}${operatorChunk}${rightChunk}${orderBySql}${limitSql}${offsetSql}`;
  }
  buildInsertQuery({ table, values, onConflict, returning, withList }) {
    const valuesSqlList = [];
    const columns = table[Table.Symbol.Columns];
    const colEntries = Object.entries(columns);
    const insertOrder = colEntries.map(([, column]) => sql.identifier(column.name));
    for (const [valueIndex, value] of values.entries()) {
      const valueList = [];
      for (const [fieldName, col] of colEntries) {
        const colValue = value[fieldName];
        if (colValue === void 0 || is(colValue, Param) && colValue.value === void 0) {
          let defaultValue;
          if (col.default !== null && col.default !== void 0) {
            defaultValue = is(col.default, SQL) ? col.default : sql.param(col.default, col);
          } else if (col.defaultFn !== void 0) {
            const defaultFnResult = col.defaultFn();
            defaultValue = is(defaultFnResult, SQL) ? defaultFnResult : sql.param(defaultFnResult, col);
          } else if (!col.default && col.onUpdateFn !== void 0) {
            const onUpdateFnResult = col.onUpdateFn();
            defaultValue = is(onUpdateFnResult, SQL) ? onUpdateFnResult : sql.param(onUpdateFnResult, col);
          } else {
            defaultValue = sql`null`;
          }
          valueList.push(defaultValue);
        } else {
          valueList.push(colValue);
        }
      }
      valuesSqlList.push(valueList);
      if (valueIndex < values.length - 1) {
        valuesSqlList.push(sql`, `);
      }
    }
    const withSql = this.buildWithCTE(withList);
    const valuesSql = sql.join(valuesSqlList);
    const returningSql = returning ? sql` returning ${this.buildSelection(returning, { isSingleTable: true })}` : void 0;
    const onConflictSql = onConflict ? sql` on conflict ${onConflict}` : void 0;
    return sql`${withSql}insert into ${table} ${insertOrder} values ${valuesSql}${onConflictSql}${returningSql}`;
  }
  sqlToQuery(sql2) {
    return sql2.toQuery({
      escapeName: this.escapeName,
      escapeParam: this.escapeParam,
      escapeString: this.escapeString
    });
  }
  buildRelationalQuery({
    fullSchema,
    schema,
    tableNamesMap,
    table,
    tableConfig,
    queryConfig: config,
    tableAlias,
    nestedQueryRelation,
    joinOn
  }) {
    let selection = [];
    let limit, offset, orderBy = [], where;
    const joins = [];
    if (config === true) {
      const selectionEntries = Object.entries(tableConfig.columns);
      selection = selectionEntries.map(([key, value]) => ({
        dbKey: value.name,
        tsKey: key,
        field: aliasedTableColumn(value, tableAlias),
        relationTableTsKey: void 0,
        isJson: false,
        selection: []
      }));
    } else {
      const aliasedColumns = Object.fromEntries(
        Object.entries(tableConfig.columns).map(([key, value]) => [key, aliasedTableColumn(value, tableAlias)])
      );
      if (config.where) {
        const whereSql = typeof config.where === "function" ? config.where(aliasedColumns, getOperators()) : config.where;
        where = whereSql && mapColumnsInSQLToAlias(whereSql, tableAlias);
      }
      const fieldsSelection = [];
      let selectedColumns = [];
      if (config.columns) {
        let isIncludeMode = false;
        for (const [field, value] of Object.entries(config.columns)) {
          if (value === void 0) {
            continue;
          }
          if (field in tableConfig.columns) {
            if (!isIncludeMode && value === true) {
              isIncludeMode = true;
            }
            selectedColumns.push(field);
          }
        }
        if (selectedColumns.length > 0) {
          selectedColumns = isIncludeMode ? selectedColumns.filter((c) => config.columns?.[c] === true) : Object.keys(tableConfig.columns).filter((key) => !selectedColumns.includes(key));
        }
      } else {
        selectedColumns = Object.keys(tableConfig.columns);
      }
      for (const field of selectedColumns) {
        const column = tableConfig.columns[field];
        fieldsSelection.push({ tsKey: field, value: column });
      }
      let selectedRelations = [];
      if (config.with) {
        selectedRelations = Object.entries(config.with).filter((entry) => !!entry[1]).map(([tsKey, queryConfig]) => ({ tsKey, queryConfig, relation: tableConfig.relations[tsKey] }));
      }
      let extras;
      if (config.extras) {
        extras = typeof config.extras === "function" ? config.extras(aliasedColumns, { sql }) : config.extras;
        for (const [tsKey, value] of Object.entries(extras)) {
          fieldsSelection.push({
            tsKey,
            value: mapColumnsInAliasedSQLToAlias(value, tableAlias)
          });
        }
      }
      for (const { tsKey, value } of fieldsSelection) {
        selection.push({
          dbKey: is(value, SQL.Aliased) ? value.fieldAlias : tableConfig.columns[tsKey].name,
          tsKey,
          field: is(value, Column) ? aliasedTableColumn(value, tableAlias) : value,
          relationTableTsKey: void 0,
          isJson: false,
          selection: []
        });
      }
      let orderByOrig = typeof config.orderBy === "function" ? config.orderBy(aliasedColumns, getOrderByOperators()) : config.orderBy ?? [];
      if (!Array.isArray(orderByOrig)) {
        orderByOrig = [orderByOrig];
      }
      orderBy = orderByOrig.map((orderByValue) => {
        if (is(orderByValue, Column)) {
          return aliasedTableColumn(orderByValue, tableAlias);
        }
        return mapColumnsInSQLToAlias(orderByValue, tableAlias);
      });
      limit = config.limit;
      offset = config.offset;
      for (const {
        tsKey: selectedRelationTsKey,
        queryConfig: selectedRelationConfigValue,
        relation
      } of selectedRelations) {
        const normalizedRelation = normalizeRelation(schema, tableNamesMap, relation);
        const relationTableName = relation.referencedTable[Table.Symbol.Name];
        const relationTableTsName = tableNamesMap[relationTableName];
        const relationTableAlias = `${tableAlias}_${selectedRelationTsKey}`;
        const joinOn2 = and(
          ...normalizedRelation.fields.map(
            (field2, i) => eq(
              aliasedTableColumn(normalizedRelation.references[i], relationTableAlias),
              aliasedTableColumn(field2, tableAlias)
            )
          )
        );
        const builtRelation = this.buildRelationalQuery({
          fullSchema,
          schema,
          tableNamesMap,
          table: fullSchema[relationTableTsName],
          tableConfig: schema[relationTableTsName],
          queryConfig: is(relation, One) ? selectedRelationConfigValue === true ? { limit: 1 } : { ...selectedRelationConfigValue, limit: 1 } : selectedRelationConfigValue,
          tableAlias: relationTableAlias,
          joinOn: joinOn2,
          nestedQueryRelation: relation
        });
        const field = sql`(${builtRelation.sql})`.as(selectedRelationTsKey);
        selection.push({
          dbKey: selectedRelationTsKey,
          tsKey: selectedRelationTsKey,
          field,
          relationTableTsKey: relationTableTsName,
          isJson: true,
          selection: builtRelation.selection
        });
      }
    }
    if (selection.length === 0) {
      throw new DrizzleError({
        message: `No fields selected for table "${tableConfig.tsName}" ("${tableAlias}"). You need to have at least one item in "columns", "with" or "extras". If you need to select all columns, omit the "columns" key or set it to undefined.`
      });
    }
    let result;
    where = and(joinOn, where);
    if (nestedQueryRelation) {
      let field = sql`json_array(${sql.join(
        selection.map(
          ({ field: field2 }) => is(field2, SQLiteColumn) ? sql.identifier(field2.name) : is(field2, SQL.Aliased) ? field2.sql : field2
        ),
        sql`, `
      )})`;
      if (is(nestedQueryRelation, Many)) {
        field = sql`coalesce(json_group_array(${field}), json_array())`;
      }
      const nestedSelection = [{
        dbKey: "data",
        tsKey: "data",
        field: field.as("data"),
        isJson: true,
        relationTableTsKey: tableConfig.tsName,
        selection
      }];
      const needsSubquery = limit !== void 0 || offset !== void 0 || orderBy.length > 0;
      if (needsSubquery) {
        result = this.buildSelectQuery({
          table: aliasedTable(table, tableAlias),
          fields: {},
          fieldsFlat: [
            {
              path: [],
              field: sql.raw("*")
            }
          ],
          where,
          limit,
          offset,
          orderBy,
          setOperators: []
        });
        where = void 0;
        limit = void 0;
        offset = void 0;
        orderBy = void 0;
      } else {
        result = aliasedTable(table, tableAlias);
      }
      result = this.buildSelectQuery({
        table: is(result, SQLiteTable) ? result : new Subquery(result, {}, tableAlias),
        fields: {},
        fieldsFlat: nestedSelection.map(({ field: field2 }) => ({
          path: [],
          field: is(field2, Column) ? aliasedTableColumn(field2, tableAlias) : field2
        })),
        joins,
        where,
        limit,
        offset,
        orderBy,
        setOperators: []
      });
    } else {
      result = this.buildSelectQuery({
        table: aliasedTable(table, tableAlias),
        fields: {},
        fieldsFlat: selection.map(({ field }) => ({
          path: [],
          field: is(field, Column) ? aliasedTableColumn(field, tableAlias) : field
        })),
        joins,
        where,
        limit,
        offset,
        orderBy,
        setOperators: []
      });
    }
    return {
      tableTsKey: tableConfig.tsName,
      sql: result,
      selection
    };
  }
};
__name(SQLiteDialect, "SQLiteDialect");
_a67 = entityKind;
__publicField(SQLiteDialect, _a67, "SQLiteDialect");
var _a68;
var SQLiteSyncDialect = class extends SQLiteDialect {
  migrate(migrations, session, config) {
    const migrationsTable = config === void 0 ? "__drizzle_migrations" : typeof config === "string" ? "__drizzle_migrations" : config.migrationsTable ?? "__drizzle_migrations";
    const migrationTableCreate = sql`
			CREATE TABLE IF NOT EXISTS ${sql.identifier(migrationsTable)} (
				id SERIAL PRIMARY KEY,
				hash text NOT NULL,
				created_at numeric
			)
		`;
    session.run(migrationTableCreate);
    const dbMigrations = session.values(
      sql`SELECT id, hash, created_at FROM ${sql.identifier(migrationsTable)} ORDER BY created_at DESC LIMIT 1`
    );
    const lastDbMigration = dbMigrations[0] ?? void 0;
    session.run(sql`BEGIN`);
    try {
      for (const migration of migrations) {
        if (!lastDbMigration || Number(lastDbMigration[2]) < migration.folderMillis) {
          for (const stmt of migration.sql) {
            session.run(sql.raw(stmt));
          }
          session.run(
            sql`INSERT INTO ${sql.identifier(migrationsTable)} ("hash", "created_at") VALUES(${migration.hash}, ${migration.folderMillis})`
          );
        }
      }
      session.run(sql`COMMIT`);
    } catch (e) {
      session.run(sql`ROLLBACK`);
      throw e;
    }
  }
};
__name(SQLiteSyncDialect, "SQLiteSyncDialect");
_a68 = entityKind;
__publicField(SQLiteSyncDialect, _a68, "SQLiteSyncDialect");
var _a69;
var SQLiteAsyncDialect = class extends SQLiteDialect {
  async migrate(migrations, session, config) {
    const migrationsTable = config === void 0 ? "__drizzle_migrations" : typeof config === "string" ? "__drizzle_migrations" : config.migrationsTable ?? "__drizzle_migrations";
    const migrationTableCreate = sql`
			CREATE TABLE IF NOT EXISTS ${sql.identifier(migrationsTable)} (
				id SERIAL PRIMARY KEY,
				hash text NOT NULL,
				created_at numeric
			)
		`;
    await session.run(migrationTableCreate);
    const dbMigrations = await session.values(
      sql`SELECT id, hash, created_at FROM ${sql.identifier(migrationsTable)} ORDER BY created_at DESC LIMIT 1`
    );
    const lastDbMigration = dbMigrations[0] ?? void 0;
    await session.transaction(async (tx) => {
      for (const migration of migrations) {
        if (!lastDbMigration || Number(lastDbMigration[2]) < migration.folderMillis) {
          for (const stmt of migration.sql) {
            await tx.run(sql.raw(stmt));
          }
          await tx.run(
            sql`INSERT INTO ${sql.identifier(migrationsTable)} ("hash", "created_at") VALUES(${migration.hash}, ${migration.folderMillis})`
          );
        }
      }
    });
  }
};
__name(SQLiteAsyncDialect, "SQLiteAsyncDialect");
_a69 = entityKind;
__publicField(SQLiteAsyncDialect, _a69, "SQLiteAsyncDialect");

// node_modules/drizzle-orm/query-builders/query-builder.js
var _a70;
var TypedQueryBuilder = class {
  /** @internal */
  getSelectedFields() {
    return this._.selectedFields;
  }
};
__name(TypedQueryBuilder, "TypedQueryBuilder");
_a70 = entityKind;
__publicField(TypedQueryBuilder, _a70, "TypedQueryBuilder");

// node_modules/drizzle-orm/sqlite-core/query-builders/select.js
var _a71;
var SQLiteSelectBuilder = class {
  fields;
  session;
  dialect;
  withList;
  distinct;
  constructor(config) {
    this.fields = config.fields;
    this.session = config.session;
    this.dialect = config.dialect;
    this.withList = config.withList;
    this.distinct = config.distinct;
  }
  from(source) {
    const isPartialSelect = !!this.fields;
    let fields;
    if (this.fields) {
      fields = this.fields;
    } else if (is(source, Subquery)) {
      fields = Object.fromEntries(
        Object.keys(source._.selectedFields).map((key) => [key, source[key]])
      );
    } else if (is(source, SQLiteViewBase)) {
      fields = source[ViewBaseConfig].selectedFields;
    } else if (is(source, SQL)) {
      fields = {};
    } else {
      fields = getTableColumns(source);
    }
    return new SQLiteSelectBase({
      table: source,
      fields,
      isPartialSelect,
      session: this.session,
      dialect: this.dialect,
      withList: this.withList,
      distinct: this.distinct
    });
  }
};
__name(SQLiteSelectBuilder, "SQLiteSelectBuilder");
_a71 = entityKind;
__publicField(SQLiteSelectBuilder, _a71, "SQLiteSelectBuilder");
var _a72;
var SQLiteSelectQueryBuilderBase = class extends TypedQueryBuilder {
  _;
  /** @internal */
  config;
  joinsNotNullableMap;
  tableName;
  isPartialSelect;
  session;
  dialect;
  constructor({ table, fields, isPartialSelect, session, dialect, withList, distinct }) {
    super();
    this.config = {
      withList,
      table,
      fields: { ...fields },
      distinct,
      setOperators: []
    };
    this.isPartialSelect = isPartialSelect;
    this.session = session;
    this.dialect = dialect;
    this._ = {
      selectedFields: fields
    };
    this.tableName = getTableLikeName(table);
    this.joinsNotNullableMap = typeof this.tableName === "string" ? { [this.tableName]: true } : {};
  }
  createJoin(joinType) {
    return (table, on) => {
      const baseTableName = this.tableName;
      const tableName = getTableLikeName(table);
      if (typeof tableName === "string" && this.config.joins?.some((join) => join.alias === tableName)) {
        throw new Error(`Alias "${tableName}" is already used in this query`);
      }
      if (!this.isPartialSelect) {
        if (Object.keys(this.joinsNotNullableMap).length === 1 && typeof baseTableName === "string") {
          this.config.fields = {
            [baseTableName]: this.config.fields
          };
        }
        if (typeof tableName === "string" && !is(table, SQL)) {
          const selection = is(table, Subquery) ? table._.selectedFields : is(table, View) ? table[ViewBaseConfig].selectedFields : table[Table.Symbol.Columns];
          this.config.fields[tableName] = selection;
        }
      }
      if (typeof on === "function") {
        on = on(
          new Proxy(
            this.config.fields,
            new SelectionProxyHandler({ sqlAliasedBehavior: "sql", sqlBehavior: "sql" })
          )
        );
      }
      if (!this.config.joins) {
        this.config.joins = [];
      }
      this.config.joins.push({ on, table, joinType, alias: tableName });
      if (typeof tableName === "string") {
        switch (joinType) {
          case "left": {
            this.joinsNotNullableMap[tableName] = false;
            break;
          }
          case "right": {
            this.joinsNotNullableMap = Object.fromEntries(
              Object.entries(this.joinsNotNullableMap).map(([key]) => [key, false])
            );
            this.joinsNotNullableMap[tableName] = true;
            break;
          }
          case "inner": {
            this.joinsNotNullableMap[tableName] = true;
            break;
          }
          case "full": {
            this.joinsNotNullableMap = Object.fromEntries(
              Object.entries(this.joinsNotNullableMap).map(([key]) => [key, false])
            );
            this.joinsNotNullableMap[tableName] = false;
            break;
          }
        }
      }
      return this;
    };
  }
  /**
   * Executes a `left join` operation by adding another table to the current query.
   *
   * Calling this method associates each row of the table with the corresponding row from the joined table, if a match is found. If no matching row exists, it sets all columns of the joined table to null.
   *
   * See docs: {@link https://orm.drizzle.team/docs/joins#left-join}
   *
   * @param table the table to join.
   * @param on the `on` clause.
   *
   * @example
   *
   * ```ts
   * // Select all users and their pets
   * const usersWithPets: { user: User; pets: Pet | null }[] = await db.select()
   *   .from(users)
   *   .leftJoin(pets, eq(users.id, pets.ownerId))
   *
   * // Select userId and petId
   * const usersIdsAndPetIds: { userId: number; petId: number | null }[] = await db.select({
   *   userId: users.id,
   *   petId: pets.id,
   * })
   *   .from(users)
   *   .leftJoin(pets, eq(users.id, pets.ownerId))
   * ```
   */
  leftJoin = this.createJoin("left");
  /**
   * Executes a `right join` operation by adding another table to the current query.
   *
   * Calling this method associates each row of the joined table with the corresponding row from the main table, if a match is found. If no matching row exists, it sets all columns of the main table to null.
   *
   * See docs: {@link https://orm.drizzle.team/docs/joins#right-join}
   *
   * @param table the table to join.
   * @param on the `on` clause.
   *
   * @example
   *
   * ```ts
   * // Select all users and their pets
   * const usersWithPets: { user: User | null; pets: Pet }[] = await db.select()
   *   .from(users)
   *   .rightJoin(pets, eq(users.id, pets.ownerId))
   *
   * // Select userId and petId
   * const usersIdsAndPetIds: { userId: number | null; petId: number }[] = await db.select({
   *   userId: users.id,
   *   petId: pets.id,
   * })
   *   .from(users)
   *   .rightJoin(pets, eq(users.id, pets.ownerId))
   * ```
   */
  rightJoin = this.createJoin("right");
  /**
   * Executes an `inner join` operation, creating a new table by combining rows from two tables that have matching values.
   *
   * Calling this method retrieves rows that have corresponding entries in both joined tables. Rows without matching entries in either table are excluded, resulting in a table that includes only matching pairs.
   *
   * See docs: {@link https://orm.drizzle.team/docs/joins#inner-join}
   *
   * @param table the table to join.
   * @param on the `on` clause.
   *
   * @example
   *
   * ```ts
   * // Select all users and their pets
   * const usersWithPets: { user: User; pets: Pet }[] = await db.select()
   *   .from(users)
   *   .innerJoin(pets, eq(users.id, pets.ownerId))
   *
   * // Select userId and petId
   * const usersIdsAndPetIds: { userId: number; petId: number }[] = await db.select({
   *   userId: users.id,
   *   petId: pets.id,
   * })
   *   .from(users)
   *   .innerJoin(pets, eq(users.id, pets.ownerId))
   * ```
   */
  innerJoin = this.createJoin("inner");
  /**
   * Executes a `full join` operation by combining rows from two tables into a new table.
   *
   * Calling this method retrieves all rows from both main and joined tables, merging rows with matching values and filling in `null` for non-matching columns.
   *
   * See docs: {@link https://orm.drizzle.team/docs/joins#full-join}
   *
   * @param table the table to join.
   * @param on the `on` clause.
   *
   * @example
   *
   * ```ts
   * // Select all users and their pets
   * const usersWithPets: { user: User | null; pets: Pet | null }[] = await db.select()
   *   .from(users)
   *   .fullJoin(pets, eq(users.id, pets.ownerId))
   *
   * // Select userId and petId
   * const usersIdsAndPetIds: { userId: number | null; petId: number | null }[] = await db.select({
   *   userId: users.id,
   *   petId: pets.id,
   * })
   *   .from(users)
   *   .fullJoin(pets, eq(users.id, pets.ownerId))
   * ```
   */
  fullJoin = this.createJoin("full");
  createSetOperator(type, isAll) {
    return (rightSelection) => {
      const rightSelect = typeof rightSelection === "function" ? rightSelection(getSQLiteSetOperators()) : rightSelection;
      if (!haveSameKeys(this.getSelectedFields(), rightSelect.getSelectedFields())) {
        throw new Error(
          "Set operator error (union / intersect / except): selected fields are not the same or are in a different order"
        );
      }
      this.config.setOperators.push({ type, isAll, rightSelect });
      return this;
    };
  }
  /**
   * Adds `union` set operator to the query.
   *
   * Calling this method will combine the result sets of the `select` statements and remove any duplicate rows that appear across them.
   *
   * See docs: {@link https://orm.drizzle.team/docs/set-operations#union}
   *
   * @example
   *
   * ```ts
   * // Select all unique names from customers and users tables
   * await db.select({ name: users.name })
   *   .from(users)
   *   .union(
   *     db.select({ name: customers.name }).from(customers)
   *   );
   * // or
   * import { union } from 'drizzle-orm/sqlite-core'
   *
   * await union(
   *   db.select({ name: users.name }).from(users),
   *   db.select({ name: customers.name }).from(customers)
   * );
   * ```
   */
  union = this.createSetOperator("union", false);
  /**
   * Adds `union all` set operator to the query.
   *
   * Calling this method will combine the result-set of the `select` statements and keep all duplicate rows that appear across them.
   *
   * See docs: {@link https://orm.drizzle.team/docs/set-operations#union-all}
   *
   * @example
   *
   * ```ts
   * // Select all transaction ids from both online and in-store sales
   * await db.select({ transaction: onlineSales.transactionId })
   *   .from(onlineSales)
   *   .unionAll(
   *     db.select({ transaction: inStoreSales.transactionId }).from(inStoreSales)
   *   );
   * // or
   * import { unionAll } from 'drizzle-orm/sqlite-core'
   *
   * await unionAll(
   *   db.select({ transaction: onlineSales.transactionId }).from(onlineSales),
   *   db.select({ transaction: inStoreSales.transactionId }).from(inStoreSales)
   * );
   * ```
   */
  unionAll = this.createSetOperator("union", true);
  /**
   * Adds `intersect` set operator to the query.
   *
   * Calling this method will retain only the rows that are present in both result sets and eliminate duplicates.
   *
   * See docs: {@link https://orm.drizzle.team/docs/set-operations#intersect}
   *
   * @example
   *
   * ```ts
   * // Select course names that are offered in both departments A and B
   * await db.select({ courseName: depA.courseName })
   *   .from(depA)
   *   .intersect(
   *     db.select({ courseName: depB.courseName }).from(depB)
   *   );
   * // or
   * import { intersect } from 'drizzle-orm/sqlite-core'
   *
   * await intersect(
   *   db.select({ courseName: depA.courseName }).from(depA),
   *   db.select({ courseName: depB.courseName }).from(depB)
   * );
   * ```
   */
  intersect = this.createSetOperator("intersect", false);
  /**
   * Adds `except` set operator to the query.
   *
   * Calling this method will retrieve all unique rows from the left query, except for the rows that are present in the result set of the right query.
   *
   * See docs: {@link https://orm.drizzle.team/docs/set-operations#except}
   *
   * @example
   *
   * ```ts
   * // Select all courses offered in department A but not in department B
   * await db.select({ courseName: depA.courseName })
   *   .from(depA)
   *   .except(
   *     db.select({ courseName: depB.courseName }).from(depB)
   *   );
   * // or
   * import { except } from 'drizzle-orm/sqlite-core'
   *
   * await except(
   *   db.select({ courseName: depA.courseName }).from(depA),
   *   db.select({ courseName: depB.courseName }).from(depB)
   * );
   * ```
   */
  except = this.createSetOperator("except", false);
  /** @internal */
  addSetOperators(setOperators) {
    this.config.setOperators.push(...setOperators);
    return this;
  }
  /**
   * Adds a `where` clause to the query.
   *
   * Calling this method will select only those rows that fulfill a specified condition.
   *
   * See docs: {@link https://orm.drizzle.team/docs/select#filtering}
   *
   * @param where the `where` clause.
   *
   * @example
   * You can use conditional operators and `sql function` to filter the rows to be selected.
   *
   * ```ts
   * // Select all cars with green color
   * await db.select().from(cars).where(eq(cars.color, 'green'));
   * // or
   * await db.select().from(cars).where(sql`${cars.color} = 'green'`)
   * ```
   *
   * You can logically combine conditional operators with `and()` and `or()` operators:
   *
   * ```ts
   * // Select all BMW cars with a green color
   * await db.select().from(cars).where(and(eq(cars.color, 'green'), eq(cars.brand, 'BMW')));
   *
   * // Select all cars with the green or blue color
   * await db.select().from(cars).where(or(eq(cars.color, 'green'), eq(cars.color, 'blue')));
   * ```
   */
  where(where) {
    if (typeof where === "function") {
      where = where(
        new Proxy(
          this.config.fields,
          new SelectionProxyHandler({ sqlAliasedBehavior: "sql", sqlBehavior: "sql" })
        )
      );
    }
    this.config.where = where;
    return this;
  }
  /**
   * Adds a `having` clause to the query.
   *
   * Calling this method will select only those rows that fulfill a specified condition. It is typically used with aggregate functions to filter the aggregated data based on a specified condition.
   *
   * See docs: {@link https://orm.drizzle.team/docs/select#aggregations}
   *
   * @param having the `having` clause.
   *
   * @example
   *
   * ```ts
   * // Select all brands with more than one car
   * await db.select({
   * 	brand: cars.brand,
   * 	count: sql<number>`cast(count(${cars.id}) as int)`,
   * })
   *   .from(cars)
   *   .groupBy(cars.brand)
   *   .having(({ count }) => gt(count, 1));
   * ```
   */
  having(having) {
    if (typeof having === "function") {
      having = having(
        new Proxy(
          this.config.fields,
          new SelectionProxyHandler({ sqlAliasedBehavior: "sql", sqlBehavior: "sql" })
        )
      );
    }
    this.config.having = having;
    return this;
  }
  groupBy(...columns) {
    if (typeof columns[0] === "function") {
      const groupBy = columns[0](
        new Proxy(
          this.config.fields,
          new SelectionProxyHandler({ sqlAliasedBehavior: "alias", sqlBehavior: "sql" })
        )
      );
      this.config.groupBy = Array.isArray(groupBy) ? groupBy : [groupBy];
    } else {
      this.config.groupBy = columns;
    }
    return this;
  }
  orderBy(...columns) {
    if (typeof columns[0] === "function") {
      const orderBy = columns[0](
        new Proxy(
          this.config.fields,
          new SelectionProxyHandler({ sqlAliasedBehavior: "alias", sqlBehavior: "sql" })
        )
      );
      const orderByArray = Array.isArray(orderBy) ? orderBy : [orderBy];
      if (this.config.setOperators.length > 0) {
        this.config.setOperators.at(-1).orderBy = orderByArray;
      } else {
        this.config.orderBy = orderByArray;
      }
    } else {
      const orderByArray = columns;
      if (this.config.setOperators.length > 0) {
        this.config.setOperators.at(-1).orderBy = orderByArray;
      } else {
        this.config.orderBy = orderByArray;
      }
    }
    return this;
  }
  /**
   * Adds a `limit` clause to the query.
   *
   * Calling this method will set the maximum number of rows that will be returned by this query.
   *
   * See docs: {@link https://orm.drizzle.team/docs/select#limit--offset}
   *
   * @param limit the `limit` clause.
   *
   * @example
   *
   * ```ts
   * // Get the first 10 people from this query.
   * await db.select().from(people).limit(10);
   * ```
   */
  limit(limit) {
    if (this.config.setOperators.length > 0) {
      this.config.setOperators.at(-1).limit = limit;
    } else {
      this.config.limit = limit;
    }
    return this;
  }
  /**
   * Adds an `offset` clause to the query.
   *
   * Calling this method will skip a number of rows when returning results from this query.
   *
   * See docs: {@link https://orm.drizzle.team/docs/select#limit--offset}
   *
   * @param offset the `offset` clause.
   *
   * @example
   *
   * ```ts
   * // Get the 10th-20th people from this query.
   * await db.select().from(people).offset(10).limit(10);
   * ```
   */
  offset(offset) {
    if (this.config.setOperators.length > 0) {
      this.config.setOperators.at(-1).offset = offset;
    } else {
      this.config.offset = offset;
    }
    return this;
  }
  /** @internal */
  getSQL() {
    return this.dialect.buildSelectQuery(this.config);
  }
  toSQL() {
    const { typings: _typings, ...rest } = this.dialect.sqlToQuery(this.getSQL());
    return rest;
  }
  as(alias) {
    return new Proxy(
      new Subquery(this.getSQL(), this.config.fields, alias),
      new SelectionProxyHandler({ alias, sqlAliasedBehavior: "alias", sqlBehavior: "error" })
    );
  }
  /** @internal */
  getSelectedFields() {
    return new Proxy(
      this.config.fields,
      new SelectionProxyHandler({ alias: this.tableName, sqlAliasedBehavior: "alias", sqlBehavior: "error" })
    );
  }
  $dynamic() {
    return this;
  }
};
__name(SQLiteSelectQueryBuilderBase, "SQLiteSelectQueryBuilderBase");
_a72 = entityKind;
__publicField(SQLiteSelectQueryBuilderBase, _a72, "SQLiteSelectQueryBuilder");
var _a73;
var SQLiteSelectBase = class extends SQLiteSelectQueryBuilderBase {
  /** @internal */
  _prepare(isOneTimeQuery = true) {
    if (!this.session) {
      throw new Error("Cannot execute a query on a query builder. Please use a database instance instead.");
    }
    const fieldsList = orderSelectedFields(this.config.fields);
    const query = this.session[isOneTimeQuery ? "prepareOneTimeQuery" : "prepareQuery"](
      this.dialect.sqlToQuery(this.getSQL()),
      fieldsList,
      "all",
      true
    );
    query.joinsNotNullableMap = this.joinsNotNullableMap;
    return query;
  }
  prepare() {
    return this._prepare(false);
  }
  run = (placeholderValues) => {
    return this._prepare().run(placeholderValues);
  };
  all = (placeholderValues) => {
    return this._prepare().all(placeholderValues);
  };
  get = (placeholderValues) => {
    return this._prepare().get(placeholderValues);
  };
  values = (placeholderValues) => {
    return this._prepare().values(placeholderValues);
  };
  async execute() {
    return this.all();
  }
};
__name(SQLiteSelectBase, "SQLiteSelectBase");
_a73 = entityKind;
__publicField(SQLiteSelectBase, _a73, "SQLiteSelect");
applyMixins(SQLiteSelectBase, [QueryPromise]);
function createSetOperator(type, isAll) {
  return (leftSelect, rightSelect, ...restSelects) => {
    const setOperators = [rightSelect, ...restSelects].map((select) => ({
      type,
      isAll,
      rightSelect: select
    }));
    for (const setOperator of setOperators) {
      if (!haveSameKeys(leftSelect.getSelectedFields(), setOperator.rightSelect.getSelectedFields())) {
        throw new Error(
          "Set operator error (union / intersect / except): selected fields are not the same or are in a different order"
        );
      }
    }
    return leftSelect.addSetOperators(setOperators);
  };
}
__name(createSetOperator, "createSetOperator");
var getSQLiteSetOperators = /* @__PURE__ */ __name(() => ({
  union,
  unionAll,
  intersect,
  except
}), "getSQLiteSetOperators");
var union = createSetOperator("union", false);
var unionAll = createSetOperator("union", true);
var intersect = createSetOperator("intersect", false);
var except = createSetOperator("except", false);

// node_modules/drizzle-orm/sqlite-core/query-builders/query-builder.js
var _a74;
var QueryBuilder = class {
  dialect;
  $with(alias) {
    const queryBuilder = this;
    return {
      as(qb) {
        if (typeof qb === "function") {
          qb = qb(queryBuilder);
        }
        return new Proxy(
          new WithSubquery(qb.getSQL(), qb.getSelectedFields(), alias, true),
          new SelectionProxyHandler({ alias, sqlAliasedBehavior: "alias", sqlBehavior: "error" })
        );
      }
    };
  }
  with(...queries) {
    const self2 = this;
    function select(fields) {
      return new SQLiteSelectBuilder({
        fields: fields ?? void 0,
        session: void 0,
        dialect: self2.getDialect(),
        withList: queries
      });
    }
    __name(select, "select");
    function selectDistinct(fields) {
      return new SQLiteSelectBuilder({
        fields: fields ?? void 0,
        session: void 0,
        dialect: self2.getDialect(),
        withList: queries,
        distinct: true
      });
    }
    __name(selectDistinct, "selectDistinct");
    return { select, selectDistinct };
  }
  select(fields) {
    return new SQLiteSelectBuilder({ fields: fields ?? void 0, session: void 0, dialect: this.getDialect() });
  }
  selectDistinct(fields) {
    return new SQLiteSelectBuilder({
      fields: fields ?? void 0,
      session: void 0,
      dialect: this.getDialect(),
      distinct: true
    });
  }
  // Lazy load dialect to avoid circular dependency
  getDialect() {
    if (!this.dialect) {
      this.dialect = new SQLiteSyncDialect();
    }
    return this.dialect;
  }
};
__name(QueryBuilder, "QueryBuilder");
_a74 = entityKind;
__publicField(QueryBuilder, _a74, "SQLiteQueryBuilder");

// node_modules/drizzle-orm/sqlite-core/query-builders/update.js
var _a75;
var SQLiteUpdateBuilder = class {
  constructor(table, session, dialect, withList) {
    this.table = table;
    this.session = session;
    this.dialect = dialect;
    this.withList = withList;
  }
  set(values) {
    return new SQLiteUpdateBase(
      this.table,
      mapUpdateSet(this.table, values),
      this.session,
      this.dialect,
      this.withList
    );
  }
};
__name(SQLiteUpdateBuilder, "SQLiteUpdateBuilder");
_a75 = entityKind;
__publicField(SQLiteUpdateBuilder, _a75, "SQLiteUpdateBuilder");
var _a76;
var SQLiteUpdateBase = class extends QueryPromise {
  constructor(table, set, session, dialect, withList) {
    super();
    this.session = session;
    this.dialect = dialect;
    this.config = { set, table, withList };
  }
  /** @internal */
  config;
  /**
   * Adds a 'where' clause to the query.
   *
   * Calling this method will update only those rows that fulfill a specified condition.
   *
   * See docs: {@link https://orm.drizzle.team/docs/update}
   *
   * @param where the 'where' clause.
   *
   * @example
   * You can use conditional operators and `sql function` to filter the rows to be updated.
   *
   * ```ts
   * // Update all cars with green color
   * db.update(cars).set({ color: 'red' })
   *   .where(eq(cars.color, 'green'));
   * // or
   * db.update(cars).set({ color: 'red' })
   *   .where(sql`${cars.color} = 'green'`)
   * ```
   *
   * You can logically combine conditional operators with `and()` and `or()` operators:
   *
   * ```ts
   * // Update all BMW cars with a green color
   * db.update(cars).set({ color: 'red' })
   *   .where(and(eq(cars.color, 'green'), eq(cars.brand, 'BMW')));
   *
   * // Update all cars with the green or blue color
   * db.update(cars).set({ color: 'red' })
   *   .where(or(eq(cars.color, 'green'), eq(cars.color, 'blue')));
   * ```
   */
  where(where) {
    this.config.where = where;
    return this;
  }
  returning(fields = this.config.table[SQLiteTable.Symbol.Columns]) {
    this.config.returning = orderSelectedFields(fields);
    return this;
  }
  /** @internal */
  getSQL() {
    return this.dialect.buildUpdateQuery(this.config);
  }
  toSQL() {
    const { typings: _typings, ...rest } = this.dialect.sqlToQuery(this.getSQL());
    return rest;
  }
  /** @internal */
  _prepare(isOneTimeQuery = true) {
    return this.session[isOneTimeQuery ? "prepareOneTimeQuery" : "prepareQuery"](
      this.dialect.sqlToQuery(this.getSQL()),
      this.config.returning,
      this.config.returning ? "all" : "run",
      true
    );
  }
  prepare() {
    return this._prepare(false);
  }
  run = (placeholderValues) => {
    return this._prepare().run(placeholderValues);
  };
  all = (placeholderValues) => {
    return this._prepare().all(placeholderValues);
  };
  get = (placeholderValues) => {
    return this._prepare().get(placeholderValues);
  };
  values = (placeholderValues) => {
    return this._prepare().values(placeholderValues);
  };
  async execute() {
    return this.config.returning ? this.all() : this.run();
  }
  $dynamic() {
    return this;
  }
};
__name(SQLiteUpdateBase, "SQLiteUpdateBase");
_a76 = entityKind;
__publicField(SQLiteUpdateBase, _a76, "SQLiteUpdate");

// node_modules/drizzle-orm/sqlite-core/query-builders/query.js
var _a77;
var RelationalQueryBuilder = class {
  constructor(mode, fullSchema, schema, tableNamesMap, table, tableConfig, dialect, session) {
    this.mode = mode;
    this.fullSchema = fullSchema;
    this.schema = schema;
    this.tableNamesMap = tableNamesMap;
    this.table = table;
    this.tableConfig = tableConfig;
    this.dialect = dialect;
    this.session = session;
  }
  findMany(config) {
    return this.mode === "sync" ? new SQLiteSyncRelationalQuery(
      this.fullSchema,
      this.schema,
      this.tableNamesMap,
      this.table,
      this.tableConfig,
      this.dialect,
      this.session,
      config ? config : {},
      "many"
    ) : new SQLiteRelationalQuery(
      this.fullSchema,
      this.schema,
      this.tableNamesMap,
      this.table,
      this.tableConfig,
      this.dialect,
      this.session,
      config ? config : {},
      "many"
    );
  }
  findFirst(config) {
    return this.mode === "sync" ? new SQLiteSyncRelationalQuery(
      this.fullSchema,
      this.schema,
      this.tableNamesMap,
      this.table,
      this.tableConfig,
      this.dialect,
      this.session,
      config ? { ...config, limit: 1 } : { limit: 1 },
      "first"
    ) : new SQLiteRelationalQuery(
      this.fullSchema,
      this.schema,
      this.tableNamesMap,
      this.table,
      this.tableConfig,
      this.dialect,
      this.session,
      config ? { ...config, limit: 1 } : { limit: 1 },
      "first"
    );
  }
};
__name(RelationalQueryBuilder, "RelationalQueryBuilder");
_a77 = entityKind;
__publicField(RelationalQueryBuilder, _a77, "SQLiteAsyncRelationalQueryBuilder");
var _a78;
var SQLiteRelationalQuery = class extends QueryPromise {
  constructor(fullSchema, schema, tableNamesMap, table, tableConfig, dialect, session, config, mode) {
    super();
    this.fullSchema = fullSchema;
    this.schema = schema;
    this.tableNamesMap = tableNamesMap;
    this.table = table;
    this.tableConfig = tableConfig;
    this.dialect = dialect;
    this.session = session;
    this.config = config;
    this.mode = mode;
  }
  /** @internal */
  mode;
  /** @internal */
  getSQL() {
    return this.dialect.buildRelationalQuery({
      fullSchema: this.fullSchema,
      schema: this.schema,
      tableNamesMap: this.tableNamesMap,
      table: this.table,
      tableConfig: this.tableConfig,
      queryConfig: this.config,
      tableAlias: this.tableConfig.tsName
    }).sql;
  }
  /** @internal */
  _prepare(isOneTimeQuery = false) {
    const { query, builtQuery } = this._toSQL();
    return this.session[isOneTimeQuery ? "prepareOneTimeQuery" : "prepareQuery"](
      builtQuery,
      void 0,
      this.mode === "first" ? "get" : "all",
      true,
      (rawRows, mapColumnValue) => {
        const rows = rawRows.map(
          (row) => mapRelationalRow(this.schema, this.tableConfig, row, query.selection, mapColumnValue)
        );
        if (this.mode === "first") {
          return rows[0];
        }
        return rows;
      }
    );
  }
  prepare() {
    return this._prepare(false);
  }
  _toSQL() {
    const query = this.dialect.buildRelationalQuery({
      fullSchema: this.fullSchema,
      schema: this.schema,
      tableNamesMap: this.tableNamesMap,
      table: this.table,
      tableConfig: this.tableConfig,
      queryConfig: this.config,
      tableAlias: this.tableConfig.tsName
    });
    const builtQuery = this.dialect.sqlToQuery(query.sql);
    return { query, builtQuery };
  }
  toSQL() {
    return this._toSQL().builtQuery;
  }
  /** @internal */
  executeRaw() {
    if (this.mode === "first") {
      return this._prepare(false).get();
    }
    return this._prepare(false).all();
  }
  async execute() {
    return this.executeRaw();
  }
};
__name(SQLiteRelationalQuery, "SQLiteRelationalQuery");
_a78 = entityKind;
__publicField(SQLiteRelationalQuery, _a78, "SQLiteAsyncRelationalQuery");
var _a79;
var SQLiteSyncRelationalQuery = class extends SQLiteRelationalQuery {
  sync() {
    return this.executeRaw();
  }
};
__name(SQLiteSyncRelationalQuery, "SQLiteSyncRelationalQuery");
_a79 = entityKind;
__publicField(SQLiteSyncRelationalQuery, _a79, "SQLiteSyncRelationalQuery");

// node_modules/drizzle-orm/sqlite-core/query-builders/raw.js
var _a80;
var SQLiteRaw = class extends QueryPromise {
  constructor(execute, getSQL, action, dialect, mapBatchResult) {
    super();
    this.execute = execute;
    this.getSQL = getSQL;
    this.dialect = dialect;
    this.mapBatchResult = mapBatchResult;
    this.config = { action };
  }
  /** @internal */
  config;
  getQuery() {
    return { ...this.dialect.sqlToQuery(this.getSQL()), method: this.config.action };
  }
  mapResult(result, isFromBatch) {
    return isFromBatch ? this.mapBatchResult(result) : result;
  }
  _prepare() {
    return this;
  }
  /** @internal */
  isResponseInArrayMode() {
    return false;
  }
};
__name(SQLiteRaw, "SQLiteRaw");
_a80 = entityKind;
__publicField(SQLiteRaw, _a80, "SQLiteRaw");

// node_modules/drizzle-orm/sqlite-core/db.js
var _a81;
var BaseSQLiteDatabase = class {
  constructor(resultKind, dialect, session, schema) {
    this.resultKind = resultKind;
    this.dialect = dialect;
    this.session = session;
    this._ = schema ? {
      schema: schema.schema,
      fullSchema: schema.fullSchema,
      tableNamesMap: schema.tableNamesMap
    } : {
      schema: void 0,
      fullSchema: {},
      tableNamesMap: {}
    };
    this.query = {};
    const query = this.query;
    if (this._.schema) {
      for (const [tableName, columns] of Object.entries(this._.schema)) {
        query[tableName] = new RelationalQueryBuilder(
          resultKind,
          schema.fullSchema,
          this._.schema,
          this._.tableNamesMap,
          schema.fullSchema[tableName],
          columns,
          dialect,
          session
        );
      }
    }
  }
  query;
  /**
   * Creates a subquery that defines a temporary named result set as a CTE.
   *
   * It is useful for breaking down complex queries into simpler parts and for reusing the result set in subsequent parts of the query.
   *
   * See docs: {@link https://orm.drizzle.team/docs/select#with-clause}
   *
   * @param alias The alias for the subquery.
   *
   * Failure to provide an alias will result in a DrizzleTypeError, preventing the subquery from being referenced in other queries.
   *
   * @example
   *
   * ```ts
   * // Create a subquery with alias 'sq' and use it in the select query
   * const sq = db.$with('sq').as(db.select().from(users).where(eq(users.id, 42)));
   *
   * const result = await db.with(sq).select().from(sq);
   * ```
   *
   * To select arbitrary SQL values as fields in a CTE and reference them in other CTEs or in the main query, you need to add aliases to them:
   *
   * ```ts
   * // Select an arbitrary SQL value as a field in a CTE and reference it in the main query
   * const sq = db.$with('sq').as(db.select({
   *   name: sql<string>`upper(${users.name})`.as('name'),
   * })
   * .from(users));
   *
   * const result = await db.with(sq).select({ name: sq.name }).from(sq);
   * ```
   */
  $with(alias) {
    return {
      as(qb) {
        if (typeof qb === "function") {
          qb = qb(new QueryBuilder());
        }
        return new Proxy(
          new WithSubquery(qb.getSQL(), qb.getSelectedFields(), alias, true),
          new SelectionProxyHandler({ alias, sqlAliasedBehavior: "alias", sqlBehavior: "error" })
        );
      }
    };
  }
  /**
   * Incorporates a previously defined CTE (using `$with`) into the main query.
   *
   * This method allows the main query to reference a temporary named result set.
   *
   * See docs: {@link https://orm.drizzle.team/docs/select#with-clause}
   *
   * @param queries The CTEs to incorporate into the main query.
   *
   * @example
   *
   * ```ts
   * // Define a subquery 'sq' as a CTE using $with
   * const sq = db.$with('sq').as(db.select().from(users).where(eq(users.id, 42)));
   *
   * // Incorporate the CTE 'sq' into the main query and select from it
   * const result = await db.with(sq).select().from(sq);
   * ```
   */
  with(...queries) {
    const self2 = this;
    function select(fields) {
      return new SQLiteSelectBuilder({
        fields: fields ?? void 0,
        session: self2.session,
        dialect: self2.dialect,
        withList: queries
      });
    }
    __name(select, "select");
    function selectDistinct(fields) {
      return new SQLiteSelectBuilder({
        fields: fields ?? void 0,
        session: self2.session,
        dialect: self2.dialect,
        withList: queries,
        distinct: true
      });
    }
    __name(selectDistinct, "selectDistinct");
    function update(table) {
      return new SQLiteUpdateBuilder(table, self2.session, self2.dialect, queries);
    }
    __name(update, "update");
    function insert(into) {
      return new SQLiteInsertBuilder(into, self2.session, self2.dialect, queries);
    }
    __name(insert, "insert");
    function delete_(from) {
      return new SQLiteDeleteBase(from, self2.session, self2.dialect, queries);
    }
    __name(delete_, "delete_");
    return { select, selectDistinct, update, insert, delete: delete_ };
  }
  select(fields) {
    return new SQLiteSelectBuilder({ fields: fields ?? void 0, session: this.session, dialect: this.dialect });
  }
  selectDistinct(fields) {
    return new SQLiteSelectBuilder({
      fields: fields ?? void 0,
      session: this.session,
      dialect: this.dialect,
      distinct: true
    });
  }
  /**
   * Creates an update query.
   *
   * Calling this method without `.where()` clause will update all rows in a table. The `.where()` clause specifies which rows should be updated.
   *
   * Use `.set()` method to specify which values to update.
   *
   * See docs: {@link https://orm.drizzle.team/docs/update}
   *
   * @param table The table to update.
   *
   * @example
   *
   * ```ts
   * // Update all rows in the 'cars' table
   * await db.update(cars).set({ color: 'red' });
   *
   * // Update rows with filters and conditions
   * await db.update(cars).set({ color: 'red' }).where(eq(cars.brand, 'BMW'));
   *
   * // Update with returning clause
   * const updatedCar: Car[] = await db.update(cars)
   *   .set({ color: 'red' })
   *   .where(eq(cars.id, 1))
   *   .returning();
   * ```
   */
  update(table) {
    return new SQLiteUpdateBuilder(table, this.session, this.dialect);
  }
  /**
   * Creates an insert query.
   *
   * Calling this method will create new rows in a table. Use `.values()` method to specify which values to insert.
   *
   * See docs: {@link https://orm.drizzle.team/docs/insert}
   *
   * @param table The table to insert into.
   *
   * @example
   *
   * ```ts
   * // Insert one row
   * await db.insert(cars).values({ brand: 'BMW' });
   *
   * // Insert multiple rows
   * await db.insert(cars).values([{ brand: 'BMW' }, { brand: 'Porsche' }]);
   *
   * // Insert with returning clause
   * const insertedCar: Car[] = await db.insert(cars)
   *   .values({ brand: 'BMW' })
   *   .returning();
   * ```
   */
  insert(into) {
    return new SQLiteInsertBuilder(into, this.session, this.dialect);
  }
  /**
   * Creates a delete query.
   *
   * Calling this method without `.where()` clause will delete all rows in a table. The `.where()` clause specifies which rows should be deleted.
   *
   * See docs: {@link https://orm.drizzle.team/docs/delete}
   *
   * @param table The table to delete from.
   *
   * @example
   *
   * ```ts
   * // Delete all rows in the 'cars' table
   * await db.delete(cars);
   *
   * // Delete rows with filters and conditions
   * await db.delete(cars).where(eq(cars.color, 'green'));
   *
   * // Delete with returning clause
   * const deletedCar: Car[] = await db.delete(cars)
   *   .where(eq(cars.id, 1))
   *   .returning();
   * ```
   */
  delete(from) {
    return new SQLiteDeleteBase(from, this.session, this.dialect);
  }
  run(query) {
    const sql2 = query.getSQL();
    if (this.resultKind === "async") {
      return new SQLiteRaw(
        async () => this.session.run(sql2),
        () => sql2,
        "run",
        this.dialect,
        this.session.extractRawRunValueFromBatchResult.bind(this.session)
      );
    }
    return this.session.run(sql2);
  }
  all(query) {
    const sql2 = query.getSQL();
    if (this.resultKind === "async") {
      return new SQLiteRaw(
        async () => this.session.all(sql2),
        () => sql2,
        "all",
        this.dialect,
        this.session.extractRawAllValueFromBatchResult.bind(this.session)
      );
    }
    return this.session.all(sql2);
  }
  get(query) {
    const sql2 = query.getSQL();
    if (this.resultKind === "async") {
      return new SQLiteRaw(
        async () => this.session.get(sql2),
        () => sql2,
        "get",
        this.dialect,
        this.session.extractRawGetValueFromBatchResult.bind(this.session)
      );
    }
    return this.session.get(sql2);
  }
  values(query) {
    const sql2 = query.getSQL();
    if (this.resultKind === "async") {
      return new SQLiteRaw(
        async () => this.session.values(sql2),
        () => sql2,
        "values",
        this.dialect,
        this.session.extractRawValuesValueFromBatchResult.bind(this.session)
      );
    }
    return this.session.values(sql2);
  }
  transaction(transaction, config) {
    return this.session.transaction(transaction, config);
  }
};
__name(BaseSQLiteDatabase, "BaseSQLiteDatabase");
_a81 = entityKind;
__publicField(BaseSQLiteDatabase, _a81, "BaseSQLiteDatabase");

// node_modules/drizzle-orm/sqlite-core/primary-keys.js
function primaryKey(...config) {
  if (config[0].columns) {
    return new PrimaryKeyBuilder2(config[0].columns, config[0].name);
  }
  return new PrimaryKeyBuilder2(config);
}
__name(primaryKey, "primaryKey");
var _a82;
var PrimaryKeyBuilder2 = class {
  /** @internal */
  columns;
  /** @internal */
  name;
  constructor(columns, name) {
    this.columns = columns;
    this.name = name;
  }
  /** @internal */
  build(table) {
    return new PrimaryKey2(table, this.columns, this.name);
  }
};
__name(PrimaryKeyBuilder2, "PrimaryKeyBuilder");
_a82 = entityKind;
__publicField(PrimaryKeyBuilder2, _a82, "SQLitePrimaryKeyBuilder");
var _a83;
var PrimaryKey2 = class {
  constructor(table, columns, name) {
    this.table = table;
    this.columns = columns;
    this.name = name;
  }
  columns;
  name;
  getName() {
    return this.name ?? `${this.table[SQLiteTable.Symbol.Name]}_${this.columns.map((column) => column.name).join("_")}_pk`;
  }
};
__name(PrimaryKey2, "PrimaryKey");
_a83 = entityKind;
__publicField(PrimaryKey2, _a83, "SQLitePrimaryKey");

// node_modules/drizzle-orm/sqlite-core/session.js
var _a84;
var ExecuteResultSync = class extends QueryPromise {
  constructor(resultCb) {
    super();
    this.resultCb = resultCb;
  }
  async execute() {
    return this.resultCb();
  }
  sync() {
    return this.resultCb();
  }
};
__name(ExecuteResultSync, "ExecuteResultSync");
_a84 = entityKind;
__publicField(ExecuteResultSync, _a84, "ExecuteResultSync");
var _a85;
var SQLitePreparedQuery = class {
  constructor(mode, executeMethod, query) {
    this.mode = mode;
    this.executeMethod = executeMethod;
    this.query = query;
  }
  /** @internal */
  joinsNotNullableMap;
  getQuery() {
    return this.query;
  }
  mapRunResult(result, _isFromBatch) {
    return result;
  }
  mapAllResult(_result, _isFromBatch) {
    throw new Error("Not implemented");
  }
  mapGetResult(_result, _isFromBatch) {
    throw new Error("Not implemented");
  }
  execute(placeholderValues) {
    if (this.mode === "async") {
      return this[this.executeMethod](placeholderValues);
    }
    return new ExecuteResultSync(() => this[this.executeMethod](placeholderValues));
  }
  mapResult(response, isFromBatch) {
    switch (this.executeMethod) {
      case "run": {
        return this.mapRunResult(response, isFromBatch);
      }
      case "all": {
        return this.mapAllResult(response, isFromBatch);
      }
      case "get": {
        return this.mapGetResult(response, isFromBatch);
      }
    }
  }
};
__name(SQLitePreparedQuery, "SQLitePreparedQuery");
_a85 = entityKind;
__publicField(SQLitePreparedQuery, _a85, "PreparedQuery");
var _a86;
var SQLiteSession = class {
  constructor(dialect) {
    this.dialect = dialect;
  }
  prepareOneTimeQuery(query, fields, executeMethod, isResponseInArrayMode) {
    return this.prepareQuery(query, fields, executeMethod, isResponseInArrayMode);
  }
  run(query) {
    const staticQuery = this.dialect.sqlToQuery(query);
    try {
      return this.prepareOneTimeQuery(staticQuery, void 0, "run", false).run();
    } catch (err) {
      throw new DrizzleError({ cause: err, message: `Failed to run the query '${staticQuery.sql}'` });
    }
  }
  /** @internal */
  extractRawRunValueFromBatchResult(result) {
    return result;
  }
  all(query) {
    return this.prepareOneTimeQuery(this.dialect.sqlToQuery(query), void 0, "run", false).all();
  }
  /** @internal */
  extractRawAllValueFromBatchResult(_result) {
    throw new Error("Not implemented");
  }
  get(query) {
    return this.prepareOneTimeQuery(this.dialect.sqlToQuery(query), void 0, "run", false).get();
  }
  /** @internal */
  extractRawGetValueFromBatchResult(_result) {
    throw new Error("Not implemented");
  }
  values(query) {
    return this.prepareOneTimeQuery(this.dialect.sqlToQuery(query), void 0, "run", false).values();
  }
  /** @internal */
  extractRawValuesValueFromBatchResult(_result) {
    throw new Error("Not implemented");
  }
};
__name(SQLiteSession, "SQLiteSession");
_a86 = entityKind;
__publicField(SQLiteSession, _a86, "SQLiteSession");
var _a87;
var SQLiteTransaction = class extends BaseSQLiteDatabase {
  constructor(resultType, dialect, session, schema, nestedIndex = 0) {
    super(resultType, dialect, session, schema);
    this.schema = schema;
    this.nestedIndex = nestedIndex;
  }
  rollback() {
    throw new TransactionRollbackError();
  }
};
__name(SQLiteTransaction, "SQLiteTransaction");
_a87 = entityKind;
__publicField(SQLiteTransaction, _a87, "SQLiteTransaction");

// node_modules/drizzle-orm/d1/session.js
var _a88;
var SQLiteD1Session = class extends SQLiteSession {
  constructor(client, dialect, schema, options = {}) {
    super(dialect);
    this.client = client;
    this.schema = schema;
    this.options = options;
    this.logger = options.logger ?? new NoopLogger();
  }
  logger;
  prepareQuery(query, fields, executeMethod, isResponseInArrayMode, customResultMapper) {
    const stmt = this.client.prepare(query.sql);
    return new D1PreparedQuery(
      stmt,
      query,
      this.logger,
      fields,
      executeMethod,
      isResponseInArrayMode,
      customResultMapper
    );
  }
  async batch(queries) {
    const preparedQueries = [];
    const builtQueries = [];
    for (const query of queries) {
      const preparedQuery = query._prepare();
      const builtQuery = preparedQuery.getQuery();
      preparedQueries.push(preparedQuery);
      if (builtQuery.params.length > 0) {
        builtQueries.push(preparedQuery.stmt.bind(...builtQuery.params));
      } else {
        const builtQuery2 = preparedQuery.getQuery();
        builtQueries.push(
          this.client.prepare(builtQuery2.sql).bind(...builtQuery2.params)
        );
      }
    }
    const batchResults = await this.client.batch(builtQueries);
    return batchResults.map((result, i) => preparedQueries[i].mapResult(result, true));
  }
  extractRawAllValueFromBatchResult(result) {
    return result.results;
  }
  extractRawGetValueFromBatchResult(result) {
    return result.results[0];
  }
  extractRawValuesValueFromBatchResult(result) {
    return d1ToRawMapping(result.results);
  }
  async transaction(transaction, config) {
    const tx = new D1Transaction("async", this.dialect, this, this.schema);
    await this.run(sql.raw(`begin${config?.behavior ? " " + config.behavior : ""}`));
    try {
      const result = await transaction(tx);
      await this.run(sql`commit`);
      return result;
    } catch (err) {
      await this.run(sql`rollback`);
      throw err;
    }
  }
};
__name(SQLiteD1Session, "SQLiteD1Session");
_a88 = entityKind;
__publicField(SQLiteD1Session, _a88, "SQLiteD1Session");
var _a89;
var _D1Transaction = class extends SQLiteTransaction {
  async transaction(transaction) {
    const savepointName = `sp${this.nestedIndex}`;
    const tx = new _D1Transaction("async", this.dialect, this.session, this.schema, this.nestedIndex + 1);
    await this.session.run(sql.raw(`savepoint ${savepointName}`));
    try {
      const result = await transaction(tx);
      await this.session.run(sql.raw(`release savepoint ${savepointName}`));
      return result;
    } catch (err) {
      await this.session.run(sql.raw(`rollback to savepoint ${savepointName}`));
      throw err;
    }
  }
};
var D1Transaction = _D1Transaction;
__name(D1Transaction, "D1Transaction");
_a89 = entityKind;
__publicField(D1Transaction, _a89, "D1Transaction");
function d1ToRawMapping(results) {
  const rows = [];
  for (const row of results) {
    const entry = Object.keys(row).map((k) => row[k]);
    rows.push(entry);
  }
  return rows;
}
__name(d1ToRawMapping, "d1ToRawMapping");
var _a90;
var D1PreparedQuery = class extends SQLitePreparedQuery {
  constructor(stmt, query, logger, fields, executeMethod, _isResponseInArrayMode, customResultMapper) {
    super("async", executeMethod, query);
    this.logger = logger;
    this._isResponseInArrayMode = _isResponseInArrayMode;
    this.customResultMapper = customResultMapper;
    this.fields = fields;
    this.stmt = stmt;
  }
  /** @internal */
  customResultMapper;
  /** @internal */
  fields;
  /** @internal */
  stmt;
  run(placeholderValues) {
    const params = fillPlaceholders(this.query.params, placeholderValues ?? {});
    this.logger.logQuery(this.query.sql, params);
    return this.stmt.bind(...params).run();
  }
  async all(placeholderValues) {
    const { fields, query, logger, stmt, customResultMapper } = this;
    if (!fields && !customResultMapper) {
      const params = fillPlaceholders(query.params, placeholderValues ?? {});
      logger.logQuery(query.sql, params);
      return stmt.bind(...params).all().then(({ results }) => this.mapAllResult(results));
    }
    const rows = await this.values(placeholderValues);
    return this.mapAllResult(rows);
  }
  mapAllResult(rows, isFromBatch) {
    if (isFromBatch) {
      rows = d1ToRawMapping(rows.results);
    }
    if (!this.fields && !this.customResultMapper) {
      return rows;
    }
    if (this.customResultMapper) {
      return this.customResultMapper(rows);
    }
    return rows.map((row) => mapResultRow(this.fields, row, this.joinsNotNullableMap));
  }
  async get(placeholderValues) {
    const { fields, joinsNotNullableMap, query, logger, stmt, customResultMapper } = this;
    if (!fields && !customResultMapper) {
      const params = fillPlaceholders(query.params, placeholderValues ?? {});
      logger.logQuery(query.sql, params);
      return stmt.bind(...params).all().then(({ results }) => results[0]);
    }
    const rows = await this.values(placeholderValues);
    if (!rows[0]) {
      return void 0;
    }
    if (customResultMapper) {
      return customResultMapper(rows);
    }
    return mapResultRow(fields, rows[0], joinsNotNullableMap);
  }
  mapGetResult(result, isFromBatch) {
    if (isFromBatch) {
      result = d1ToRawMapping(result.results)[0];
    }
    if (!this.fields && !this.customResultMapper) {
      return result;
    }
    if (this.customResultMapper) {
      return this.customResultMapper([result]);
    }
    return mapResultRow(this.fields, result, this.joinsNotNullableMap);
  }
  values(placeholderValues) {
    const params = fillPlaceholders(this.query.params, placeholderValues ?? {});
    this.logger.logQuery(this.query.sql, params);
    return this.stmt.bind(...params).raw();
  }
  /** @internal */
  isResponseInArrayMode() {
    return this._isResponseInArrayMode;
  }
};
__name(D1PreparedQuery, "D1PreparedQuery");
_a90 = entityKind;
__publicField(D1PreparedQuery, _a90, "D1PreparedQuery");

// node_modules/drizzle-orm/d1/driver.js
var _a91;
var DrizzleD1Database = class extends BaseSQLiteDatabase {
  async batch(batch) {
    return this.session.batch(batch);
  }
};
__name(DrizzleD1Database, "DrizzleD1Database");
_a91 = entityKind;
__publicField(DrizzleD1Database, _a91, "D1Database");
function drizzle(client, config = {}) {
  const dialect = new SQLiteAsyncDialect();
  let logger;
  if (config.logger === true) {
    logger = new DefaultLogger();
  } else if (config.logger !== false) {
    logger = config.logger;
  }
  let schema;
  if (config.schema) {
    const tablesConfig = extractTablesRelationalConfig(
      config.schema,
      createTableRelationsHelpers
    );
    schema = {
      fullSchema: config.schema,
      schema: tablesConfig.tables,
      tableNamesMap: tablesConfig.tableNamesMap
    };
  }
  const session = new SQLiteD1Session(client, dialect, schema, { logger });
  return new DrizzleD1Database("async", dialect, session, schema);
}
__name(drizzle, "drizzle");

// src/db/client.js
function getDrizzleDb(env, request = null) {
  const wrappedD1 = {
    prepare(sql2) {
      const sqlTrimLower = sql2.trim().toLowerCase();
      const isSelect = sqlTrimLower.startsWith("select") || sqlTrimLower.startsWith("with");
      const createStatement = /* @__PURE__ */ __name((params = []) => {
        return {
          sql: sql2,
          params,
          // Support executing single query returning rows
          async all() {
            if (isSelect) {
              return await runRead(env, sql2, params, request);
            } else {
              return await runWrite(env, sql2, params);
            }
          },
          // Support executing single command returning metadata
          async run() {
            if (isSelect) {
              return await runRead(env, sql2, params, request);
            } else {
              return await runWrite(env, sql2, params);
            }
          },
          // Support executing single row helper
          async first(column) {
            if (isSelect) {
              const res = await runRead(env, sql2, params, request);
              const row = res.results && res.results[0];
              if (!row)
                return null;
              if (column)
                return row[column];
              return row;
            } else {
              return await runWrite(env, sql2, params);
            }
          },
          async raw() {
            const res = await this.all();
            if (!res)
              return [];
            const results = res.results || [];
            if (results.length === 0)
              return [];
            return results.map((row) => Object.values(row));
          },
          async values() {
            return await this.raw();
          },
          // Drizzle calls bind to substitute parameters
          bind(...newParams) {
            return createStatement(newParams);
          }
        };
      }, "createStatement");
      return createStatement([]);
    },
    async batch(statements) {
      const hasWrite = statements.some((s) => {
        const sqlTrimLower = (s.sql || "").trim().toLowerCase();
        return !sqlTrimLower.startsWith("select") && !sqlTrimLower.startsWith("with");
      });
      if (hasWrite) {
        return await runBatchWrite(env, statements);
      } else {
        const results = [];
        for (const stmt of statements) {
          results.push(await stmt.all());
        }
        return results;
      }
    },
    async exec(sql2) {
      const sqlTrimLower = sql2.trim().toLowerCase();
      const isSelect = sqlTrimLower.startsWith("select") || sqlTrimLower.startsWith("with");
      if (isSelect) {
        return await runRead(env, sql2, [], request);
      } else {
        return await runWrite(env, sql2, []);
      }
    }
  };
  return drizzle(wrappedD1);
}
__name(getDrizzleDb, "getDrizzleDb");

// src/db/schema.js
var users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").unique().notNull(),
  eCode: text("e_code"),
  name: text("name").notNull(),
  hashedPassword: text("hashed_password").notNull(),
  userStatus: text("user_status").default("active"),
  designation: text("designation"),
  grade: text("grade"),
  district: text("district"),
  zone: text("zone"),
  manager: text("manager"),
  zonalManager: text("zonal_manager"),
  coordinator: text("coordinator"),
  mobileNumber: text("mobile_number"),
  mailId: text("mail_id"),
  role: text("role"),
  type: text("type"),
  dateOfJoining: text("date_of_joining"),
  dateOfBirth: text("date_of_birth"),
  eUpkaranId: text("e_upkaran_id"),
  baseReportingLocation: text("base_reporting_location"),
  allowedWindows: text("allowed_windows").default("home,expense,help,profile"),
  createdAt: text("created_at"),
  updatedAt: text("updated_at"),
  profilePhoto: text("profile_photo"),
  failedAttempt: integer("failed_attempt").default(0),
  activeSessionId: text("active_session_id"),
  fcmToken: text("fcm_token"),
  profilePicUrl: text("profile_pic_url")
});
var userRoles = sqliteTable("user_roles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull(),
  role: text("role").notNull(),
  assignedAt: text("assigned_at")
});
var otps = sqliteTable("otps", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull(),
  otpCode: text("otp_code").notNull(),
  otpType: text("otp_type").notNull(),
  expiresAt: text("expires_at").notNull(),
  isUsed: integer("is_used").default(0),
  createdAt: text("created_at")
});
var loginLogs = sqliteTable("login_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  status: text("status"),
  createdAt: text("created_at")
});
var supportTickets = sqliteTable("support_tickets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ticketCode: text("ticket_code").unique().notNull(),
  createdById: integer("created_by_id"),
  createdByName: text("created_by_name"),
  createdByCode: text("created_by_code"),
  concernType: text("concern_type").notNull(),
  expenseId: integer("expense_id"),
  expenseCode: text("expense_code"),
  priority: text("priority").default("Medium"),
  description: text("description").notNull(),
  assignedToRole: text("assigned_to_role"),
  assignedToName: text("assigned_to_name"),
  status: text("status").default("Open"),
  comments: text("comments"),
  needsFollowup: integer("needs_followup").default(0),
  closedAt: text("closed_at"),
  createdAt: text("created_at"),
  updatedAt: text("updated_at")
});
var systemSettings = sqliteTable("system_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull()
});
var assetValueMaster = sqliteTable("asset_value_master", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  equipmentName: text("equipment_name").notNull(),
  rmscTenderCost: real("rmsc_tender_cost").notNull()
});
var assetsInventory = sqliteTable("assets_inventory", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  districtName: text("district_name"),
  hospitalName: text("hospital_name"),
  departmentName: text("department_name"),
  groupName: text("group_name"),
  equipmentName: text("equipment_name"),
  modelName: text("model_name"),
  serialNo: text("serial_no"),
  equipmentCategory: text("equipment_category"),
  qrCode: text("qr_code").unique(),
  stockRegisterPageNo: text("stock_register_page_no"),
  receivedDate: text("received_date"),
  installationDate: text("installation_date"),
  inventoryEntryDate: text("inventory_entry_date"),
  moicVerifiedDate: text("moic_verified_date"),
  poDate: text("po_date"),
  poCost: text("po_cost"),
  inventoryStatus: text("inventory_status"),
  equipmentStatus: text("equipment_status"),
  supplier: text("supplier"),
  warrantyDetails: text("warranty_details"),
  assetValue: text("asset_value"),
  parsedAssetValue: real("parsed_asset_value"),
  diName: text("di_name"),
  dmName: text("dm_name"),
  coordinatorName: text("coordinator_name"),
  zoneName: text("zone_name"),
  hospitalType: text("hospital_type"),
  facilityType: text("facility_type"),
  equipmentType: text("equipment_type"),
  uploadedAt: text("uploaded_at")
});
var kpiAppraisals = sqliteTable("kpi_appraisals", {
  userId: text("user_id").notNull(),
  month: text("month").notNull(),
  year: integer("year").notNull(),
  selfAchievedValues: text("self_achieved_values"),
  managerAchievedValues: text("manager_achieved_values"),
  coreRatings: text("core_ratings"),
  submittedBySelf: integer("submitted_by_self").default(0),
  submittedByManager: integer("submitted_by_manager").default(0),
  updatedAt: text("updated_at")
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.month, table.year] })
}));
var legacyHashMapping = sqliteTable("legacy_hash_mapping", {
  hashId: integer("hash_id").primaryKey(),
  expId: text("exp_id").unique().notNull()
});
var passwordHistories = sqliteTable("password_histories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  hashedPassword: text("hashed_password").notNull(),
  createdAt: text("created_at")
});
var expenses = sqliteTable("expenses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  month: text("month").notNull(),
  year: integer("year").notNull(),
  amount: real("amount").notNull(),
  status: text("status").default("draft"),
  travelMode: text("travel_mode"),
  itinerary: text("itinerary"),
  description: text("description"),
  expenseCode: text("expense_code").unique(),
  daAmount: real("da_amount").default(0),
  hotelAmount: real("hotel_amount").default(0),
  otherExpenseAmount: real("other_expense_amount").default(0),
  callsAssigned: integer("calls_assigned").default(0),
  callsCompleted: integer("calls_completed").default(0),
  pmsCount: integer("pms_count").default(0),
  assetTagging: integer("asset_tagging").default(0),
  localPurchaseAmount: real("local_purchase_amount").default(0),
  originalAmount: real("original_amount"),
  originalDaAmount: real("original_da_amount"),
  originalHotelAmount: real("original_hotel_amount"),
  originalOtherExpenseAmount: real("original_other_expense_amount"),
  originalLocalPurchaseAmount: real("original_local_purchase_amount"),
  calibrationCount: integer("calibration_count").default(0),
  mobiliseCount: integer("mobilise_count").default(0),
  createdAt: text("created_at"),
  updatedAt: text("updated_at")
});
var expenseMaster = sqliteTable("expense_master", {
  expId: text("exp_id").primaryKey(),
  userId: text("user_id"),
  totalAmount: real("total_amount"),
  status: text("status")
});
var expenseItineraries = sqliteTable("expense_itineraries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  itineraryId: text("itinerary_id").unique().notNull(),
  expId: text("exp_id").notNull(),
  legNumber: integer("leg_number").notNull(),
  fromDistrict: text("from_district"),
  toDistrict: text("to_district"),
  fromLocation: text("from_location"),
  toLocation: text("to_location"),
  travelMode: text("travel_mode"),
  distanceKm: real("distance_km"),
  travelAmount: real("travel_amount"),
  subMode: text("sub_mode"),
  subKm: real("sub_km"),
  subAmount: real("sub_amount"),
  daAmount: real("da_amount"),
  hotelAmount: real("hotel_amount"),
  localPurchase: real("local_purchase"),
  otherDesc: text("other_desc"),
  otherAmount: real("other_amount"),
  callsAssigned: integer("calls_assigned"),
  callsCompleted: integer("calls_completed"),
  pmsCount: integer("pms_count"),
  assetTagging: integer("asset_tagging"),
  visitPurpose: text("visit_purpose"),
  activityDetails: text("activity_details"),
  originalDistanceKm: real("original_distance_km"),
  originalTravelAmount: real("original_travel_amount"),
  originalSubAmount: real("original_sub_amount"),
  originalDaAmount: real("original_da_amount"),
  originalHotelAmount: real("original_hotel_amount"),
  originalOtherAmount: real("original_other_amount"),
  originalLocalPurchase: real("original_local_purchase"),
  calibrationCount: integer("calibration_count"),
  mobiliseCount: integer("mobilise_count")
});
var expenseAssetTaggings = sqliteTable("expense_asset_taggings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  itineraryId: text("itinerary_id").notNull(),
  equipmentName: text("equipment_name").notNull(),
  quantity: integer("quantity").notNull()
});
var approvals = sqliteTable("approvals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  expenseId: integer("expense_id").notNull(),
  approverId: text("approver_id").notNull(),
  levelNumber: integer("level_number").notNull(),
  status: text("status").default("pending"),
  comments: text("comments"),
  createdAt: text("created_at"),
  updatedAt: text("updated_at")
});
var approvalHierarchies = sqliteTable("approval_hierarchies", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull()
});
var hierarchyRequesters = sqliteTable("hierarchy_requesters", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  hierarchyId: integer("hierarchy_id").notNull(),
  userId: integer("user_id").notNull()
});
var hierarchyApprovers = sqliteTable("hierarchy_approvers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  hierarchyId: integer("hierarchy_id").notNull(),
  levelNumber: integer("level_number").notNull(),
  approverId: integer("approver_id").notNull()
});
var limitApprovalRequests = sqliteTable("limit_approval_requests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull(),
  requestType: text("request_type").notNull(),
  requestedValue: real("requested_value").notNull(),
  approvedValue: real("approved_value"),
  status: text("status").default("pending"),
  forMonth: text("for_month").notNull(),
  managerId: text("manager_id").notNull(),
  createdAt: text("created_at"),
  updatedAt: text("updated_at")
});
var allowanceMaster = sqliteTable("allowance_master", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  grade: text("grade").notNull(),
  vehicleType: text("vehicle_type").notNull(),
  ratePerKm: real("rate_per_km").notNull(),
  maxKmPerMonth: integer("max_km_per_month")
});
var facilityDetails = sqliteTable("facility_details", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  districtName: text("district_name").notNull(),
  facilityName: text("facility_name").notNull()
});
var rjPenalties = sqliteTable("rj_penalties", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  districtName: text("district_name"),
  hospitalName: text("hospital_name"),
  coordinatorName: text("coordinator_name"),
  monthText: text("month_text"),
  totalPenalty: real("total_penalty")
});
var noTaDaHospitals = sqliteTable("no_ta_da_hospitals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  hospitalName: text("hospital_name").notNull(),
  districtName: text("district_name").notNull(),
  createdAt: text("created_at")
});

// src/routes/auth.js
function jsonResponse4(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
__name(jsonResponse4, "jsonResponse");
async function logLogin(env, userCode, ipAddress, userAgent, status) {
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
  try {
    const db = getDrizzleDb(env);
    await db.insert(loginLogs).values({
      userId: userCode,
      ipAddress,
      userAgent,
      status,
      createdAt: timestamp
    });
  } catch (e) {
    console.error("Login logging failed:", e);
  }
}
__name(logLogin, "logLogin");
async function resolveUserHierarchyNames(env, user, request = null) {
  const db = getDrizzleDb(env, request);
  const fields = ["manager", "zonal_manager", "coordinator"];
  const values = fields.map((f) => (user[f] || "").trim().toLowerCase()).filter(Boolean);
  if (values.length === 0)
    return;
  const allResolved = await db.select({
    name: users.name,
    userId: users.userId,
    eCode: users.eCode
  }).from(users).where(or(
    inArray(sql`lower(trim(${users.userId}))`, values),
    inArray(sql`lower(trim(${users.eCode}))`, values),
    inArray(sql`lower(trim(${users.name}))`, values)
  ));
  const resolvedMap = {};
  for (const r of allResolved) {
    if (r.userId)
      resolvedMap[r.userId.toLowerCase()] = r.name;
    if (r.eCode)
      resolvedMap[r.eCode.toLowerCase()] = r.name;
    if (r.name)
      resolvedMap[r.name.toLowerCase()] = r.name;
  }
  for (const field of fields) {
    const val = (user[field] || "").trim().toLowerCase();
    if (val && resolvedMap[val]) {
      user[field] = resolvedMap[val];
    }
  }
}
__name(resolveUserHierarchyNames, "resolveUserHierarchyNames");
async function getBootstrapDataHelper(env, user, request = null) {
  const db = getDrizzleDb(env, request);
  const allowedWindows = user.allowed_windows ? user.allowed_windows.split(",").map((w) => w.trim().toLowerCase()) : [];
  const nameClean = (user.name || "").trim();
  const uidClean = (user.user_id || "").trim();
  const [hasDirectReportsResult, isHierarchyApproverResult] = await Promise.all([
    db.select({ id: users.id }).from(users).where(or(
      eq(sql`lower(trim(${users.manager}))`, nameClean.toLowerCase()),
      eq(sql`lower(trim(${users.manager}))`, uidClean.toLowerCase()),
      eq(sql`lower(trim(${users.coordinator}))`, nameClean.toLowerCase()),
      eq(sql`lower(trim(${users.coordinator}))`, uidClean.toLowerCase()),
      eq(sql`lower(trim(${users.zonalManager}))`, nameClean.toLowerCase()),
      eq(sql`lower(trim(${users.zonalManager}))`, uidClean.toLowerCase())
    )).limit(1),
    db.select({ id: hierarchyApprovers.id }).from(hierarchyApprovers).where(eq(hierarchyApprovers.approverId, user.id)).limit(1)
  ]);
  const hasDirectReports = hasDirectReportsResult.length > 0;
  const isHierarchyApprover = isHierarchyApproverResult.length > 0;
  const userRoleLower = (user.role || "").trim().toLowerCase();
  const isSpecialViewRole = ["admin", "project head", "mis", "travel desk", "travel tesk", "vp", "accountant", "hr"].includes(userRoleLower);
  const isTeamLead = user.role === "Admin" || allowedWindows.includes("approval") || hasDirectReports || isHierarchyApprover || isSpecialViewRole;
  const now = /* @__PURE__ */ new Date();
  const currentMonthName = MONTH_NAMES[now.getMonth()];
  const currentYear = now.getFullYear();
  const monthStr = now.toISOString().slice(0, 7);
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString();
  const [gradesRows, myExpensesResult, expenseInit] = await Promise.all([
    db.select({ grade: allowanceMaster.grade }).from(allowanceMaster),
    db.select().from(expenses).where(and(
      eq(expenses.userId, user.id),
      sql`${expenses.createdAt} >= ${threeMonthsAgo}`
    )).orderBy(desc(expenses.id)).limit(50),
    getExpenseInitData(env, user, monthStr)
  ]);
  const grades = Array.from(new Set(gradesRows.map((r) => r.grade))).filter(Boolean).sort();
  const dropdowns = {
    designations: DESIGNATIONS,
    zones: ZONE_DISTRICTS,
    roles: ROLES,
    grades: grades.length ? grades : ["A", "B", "C", "D"]
  };
  const myExpenses = myExpensesResult.map((e) => ({
    ...e,
    user_id: e.userId,
    travel_mode: e.travelMode,
    expense_code: e.expenseCode,
    da_amount: e.daAmount,
    hotel_amount: e.hotelAmount,
    other_expense_amount: e.otherExpenseAmount,
    calls_assigned: e.callsAssigned,
    calls_completed: e.callsCompleted,
    pms_count: e.pmsCount,
    asset_tagging: e.assetTagging,
    local_purchase_amount: e.localPurchaseAmount,
    original_amount: e.originalAmount,
    original_da_amount: e.originalDaAmount,
    original_hotel_amount: e.originalHotelAmount,
    original_other_expense_amount: e.originalOtherExpenseAmount,
    original_local_purchase_amount: e.originalLocalPurchaseAmount,
    calibration_count: e.calibrationCount,
    mobilise_count: e.mobiliseCount,
    created_at: e.createdAt,
    updated_at: e.updatedAt
  }));
  let teamExpenses = [];
  let pendingApprovals = [];
  if (isTeamLead) {
    const isFullReportViewer = ["admin", "project head", "mis", "travel desk", "travel tesk", "vp", "accountant", "hr"].includes(userRoleLower);
    if (isFullReportViewer) {
      const teamRes = await db.select({
        id: expenses.id,
        userId: expenses.userId,
        month: expenses.month,
        year: expenses.year,
        amount: expenses.amount,
        status: expenses.status,
        travelMode: expenses.travelMode,
        itinerary: expenses.itinerary,
        description: expenses.description,
        expenseCode: expenses.expenseCode,
        daAmount: expenses.daAmount,
        hotelAmount: expenses.hotelAmount,
        otherExpenseAmount: expenses.otherExpenseAmount,
        callsAssigned: expenses.callsAssigned,
        callsCompleted: expenses.callsCompleted,
        pmsCount: expenses.pmsCount,
        assetTagging: expenses.assetTagging,
        localPurchaseAmount: expenses.localPurchaseAmount,
        originalAmount: expenses.originalAmount,
        originalDaAmount: expenses.originalDaAmount,
        originalHotelAmount: expenses.originalHotelAmount,
        originalOtherExpenseAmount: expenses.originalOtherExpenseAmount,
        originalLocalPurchaseAmount: expenses.originalLocalPurchaseAmount,
        calibrationCount: expenses.calibrationCount,
        mobiliseCount: expenses.mobiliseCount,
        createdAt: expenses.createdAt,
        updatedAt: expenses.updatedAt,
        submitter_name: users.name,
        submitter_code: users.userId,
        submitter_designation: users.designation,
        zone: users.zone,
        district: users.district
      }).from(expenses).innerJoin(users, eq(expenses.userId, users.id)).where(and(
        eq(expenses.year, currentYear),
        eq(expenses.month, currentMonthName)
      )).orderBy(desc(expenses.id)).limit(1e4);
      teamExpenses = teamRes.map((e) => ({
        ...e,
        user_id: e.userId,
        travel_mode: e.travelMode,
        expense_code: e.expenseCode,
        da_amount: e.daAmount,
        hotel_amount: e.hotelAmount,
        other_expense_amount: e.otherExpenseAmount,
        calls_assigned: e.callsAssigned,
        calls_completed: e.callsCompleted,
        pms_count: e.pmsCount,
        asset_tagging: e.assetTagging,
        local_purchase_amount: e.localPurchaseAmount,
        original_amount: e.originalAmount,
        original_da_amount: e.originalDaAmount,
        original_hotel_amount: e.originalHotelAmount,
        original_other_expense_amount: e.originalOtherExpenseAmount,
        original_local_purchase_amount: e.originalLocalPurchaseAmount,
        calibration_count: e.calibrationCount,
        mobilise_count: e.mobiliseCount,
        created_at: e.createdAt,
        updated_at: e.updatedAt,
        submitter_name: e.submitter_name,
        submitter_code: e.submitter_code,
        submitter_designation: e.submitter_designation || "Engineer",
        zone: getActualZone(e.zone, e.district || "Ganganar"),
        district: e.district || "Ganganar"
      }));
    } else {
      const [directReportsRes, hierarchyApprovals] = await Promise.all([
        db.select({ id: users.id }).from(users).where(or(
          eq(sql`lower(trim(${users.manager}))`, nameClean.toLowerCase()),
          eq(sql`lower(trim(${users.manager}))`, uidClean.toLowerCase()),
          eq(sql`lower(trim(${users.coordinator}))`, nameClean.toLowerCase()),
          eq(sql`lower(trim(${users.coordinator}))`, uidClean.toLowerCase()),
          eq(sql`lower(trim(${users.zonalManager}))`, nameClean.toLowerCase()),
          eq(sql`lower(trim(${users.zonalManager}))`, uidClean.toLowerCase())
        )),
        db.select({ hierarchyId: hierarchyApprovers.hierarchyId }).from(hierarchyApprovers).where(eq(hierarchyApprovers.approverId, user.id))
      ]);
      const directReportsIds = directReportsRes.map((r) => r.id);
      let hierarchyReportsIds = [];
      if (hierarchyApprovals.length > 0) {
        const hIds = hierarchyApprovals.map((h) => h.hierarchyId);
        const reqsRes = await db.select({ userId: hierarchyRequesters.userId }).from(hierarchyRequesters).where(inArray(hierarchyRequesters.hierarchyId, hIds));
        hierarchyReportsIds = reqsRes.map((r) => r.userId);
      }
      const teamUserIdsSet = /* @__PURE__ */ new Set([...directReportsIds, ...hierarchyReportsIds]);
      teamUserIdsSet.delete(user.id);
      const teamUserIds = Array.from(teamUserIdsSet);
      if (teamUserIds.length > 0) {
        const teamRes = await db.select({
          id: expenses.id,
          userId: expenses.userId,
          month: expenses.month,
          year: expenses.year,
          amount: expenses.amount,
          status: expenses.status,
          travelMode: expenses.travelMode,
          itinerary: expenses.itinerary,
          description: expenses.description,
          expenseCode: expenses.expenseCode,
          daAmount: expenses.daAmount,
          hotelAmount: expenses.hotelAmount,
          otherExpenseAmount: expenses.otherExpenseAmount,
          callsAssigned: expenses.callsAssigned,
          callsCompleted: expenses.callsCompleted,
          pmsCount: expenses.pmsCount,
          assetTagging: expenses.assetTagging,
          localPurchaseAmount: expenses.localPurchaseAmount,
          originalAmount: expenses.originalAmount,
          originalDaAmount: expenses.originalDaAmount,
          originalHotelAmount: expenses.originalHotelAmount,
          originalOtherExpenseAmount: expenses.originalOtherExpenseAmount,
          originalLocalPurchaseAmount: expenses.originalLocalPurchaseAmount,
          calibrationCount: expenses.calibrationCount,
          mobiliseCount: expenses.mobiliseCount,
          createdAt: expenses.createdAt,
          updatedAt: expenses.updatedAt,
          submitter_name: users.name,
          submitter_code: users.userId,
          submitter_designation: users.designation,
          zone: users.zone,
          district: users.district
        }).from(expenses).innerJoin(users, eq(expenses.userId, users.id)).where(and(
          inArray(expenses.userId, teamUserIds),
          eq(expenses.year, currentYear),
          eq(expenses.month, currentMonthName)
        )).orderBy(desc(expenses.id)).limit(5e3);
        teamExpenses = teamRes.map((e) => ({
          ...e,
          user_id: e.userId,
          travel_mode: e.travelMode,
          expense_code: e.expenseCode,
          da_amount: e.daAmount,
          hotel_amount: e.hotelAmount,
          other_expense_amount: e.otherExpenseAmount,
          calls_assigned: e.callsAssigned,
          calls_completed: e.callsCompleted,
          pms_count: e.pmsCount,
          asset_tagging: e.assetTagging,
          local_purchase_amount: e.localPurchaseAmount,
          original_amount: e.originalAmount,
          original_da_amount: e.originalDaAmount,
          original_hotel_amount: e.originalHotelAmount,
          original_other_expense_amount: e.originalOtherExpenseAmount,
          original_local_purchase_amount: e.originalLocalPurchaseAmount,
          calibration_count: e.calibrationCount,
          mobilise_count: e.mobiliseCount,
          created_at: e.createdAt,
          updated_at: e.updatedAt,
          submitter_name: e.submitter_name,
          submitter_code: e.submitter_code,
          submitter_designation: e.submitter_designation || "Engineer",
          zone: getActualZone(e.zone, e.district || "Ganganar"),
          district: e.district || "Ganganar"
        }));
      }
    }
    pendingApprovals = await fetchPendingApprovals(env, user);
  }
  let allowanceStats = null;
  if (expenseInit && expenseInit.allowance) {
    const allowance = expenseInit.allowance;
    allowanceStats = {
      currentKm: allowance.current_month_km || 0,
      maxKm: (allowance.max_km_per_month || 2e3) + (expenseInit.approved_km || 0),
      currentAuto: allowance.current_month_auto || 0,
      maxAuto: (allowance.max_auto_per_month || 1e3) + (expenseInit.approved_auto || 0),
      vehicleType: allowance.vehicle_type || "Bike",
      rateBike: allowance.rate_bike || 4.5,
      rateCar: allowance.rate_car || 9
    };
  }
  return {
    dropdowns,
    expense_init: expenseInit,
    my_expenses: myExpenses,
    allowance_stats: allowanceStats,
    team_expenses: teamExpenses,
    pending_approvals: pendingApprovals,
    pending_approvals_count: pendingApprovals.length
  };
}
__name(getBootstrapDataHelper, "getBootstrapDataHelper");
async function handleLogin(request, env, params, query) {
  const db = getDrizzleDb(env, request);
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse4({ error: "Invalid JSON body" }, 400);
  }
  const { user_id, password, force } = body;
  const ipAddress = request.headers.get("CF-Connecting-IP") || "127.0.0.1";
  const userAgent = request.headers.get("User-Agent") || "";
  if (!user_id || !password) {
    return jsonResponse4({ error: "User ID and Password are required" }, 400);
  }
  const [user] = await db.select().from(users).where(eq(users.userId, user_id)).limit(1);
  if (!user) {
    await logLogin(env, user_id, ipAddress, userAgent, "failed");
    return jsonResponse4({ error: "Invalid User ID or Password", detail: "Invalid User ID or Password" }, 401);
  }
  const compatibleUser = {
    ...user,
    user_id: user.userId,
    hashed_password: user.hashedPassword,
    user_status: user.userStatus,
    failed_attempt: user.failedAttempt,
    active_session_id: user.activeSessionId,
    date_of_birth: user.dateOfBirth,
    date_of_joining: user.dateOfJoining,
    mobile_number: user.mobileNumber,
    mail_id: user.mailId
  };
  if (compatibleUser.user_status === "disabled") {
    await logLogin(env, user_id, ipAddress, userAgent, "failed");
    return jsonResponse4({ error: "Your account is disabled. Please contact the administrator.", detail: "Your account is disabled. Please contact the administrator." }, 403);
  }
  if (compatibleUser.user_status === "locked") {
    await logLogin(env, user_id, ipAddress, userAgent, "locked");
    return jsonResponse4({ error: "Your account is locked. Please use the Unlock Account option.", detail: "Your account is locked. Please use the Unlock Account option." }, 403);
  }
  const passwordCorrect = await verifyPassword(password, compatibleUser.hashed_password);
  if (!passwordCorrect) {
    const failedAttempts = (compatibleUser.failed_attempt || 0) + 1;
    if (failedAttempts >= 5) {
      await db.update(users).set({ failedAttempt: failedAttempts, userStatus: "locked" }).where(eq(users.userId, user_id));
      await logLogin(env, user_id, ipAddress, userAgent, "locked");
      return jsonResponse4({ error: "Your account has been locked due to 5 failed login attempts.", detail: "Your account has been locked due to 5 failed login attempts." }, 403);
    } else {
      await db.update(users).set({ failedAttempt: failedAttempts }).where(eq(users.userId, user_id));
      await logLogin(env, user_id, ipAddress, userAgent, "failed");
      const attemptsLeft = 5 - failedAttempts;
      return jsonResponse4({ error: `Invalid User ID or Password. ${attemptsLeft} attempts remaining.`, detail: `Invalid User ID or Password. ${attemptsLeft} attempts remaining.` }, 401);
    }
  }
  if (compatibleUser.active_session_id && !force) {
    return jsonResponse4({ error: "ALREADY_LOGGED_IN" }, 409);
  }
  const sessionId = crypto.randomUUID();
  await db.update(users).set({ activeSessionId: sessionId, failedAttempt: 0 }).where(eq(users.userId, user_id));
  await logLogin(env, user_id, ipAddress, userAgent, "success");
  const secretKey = env.API_SECRET;
  const accessExp = Math.floor(Date.now() / 1e3) + 30 * 24 * 60 * 60;
  const refreshExp = Math.floor(Date.now() / 1e3) + 365 * 24 * 60 * 60;
  const accessToken = await signJwt({ sub: compatibleUser.user_id, sid: sessionId, exp: accessExp, type: "access" }, secretKey);
  const refreshToken = await signJwt({ sub: compatibleUser.user_id, sid: sessionId, exp: refreshExp, type: "refresh" }, secretKey);
  const [roleRow] = await db.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, user_id)).limit(1);
  compatibleUser.role = roleRow?.role || "user";
  await resolveUserHierarchyNames(env, compatibleUser, request);
  const bootstrapData = await getBootstrapDataHelper(env, compatibleUser, request);
  const profile = { ...compatibleUser };
  delete profile.hashed_password;
  const formattedProfile = {
    ...profile,
    user_id: profile.userId,
    e_code: profile.eCode,
    user_status: profile.userStatus,
    mobile_number: profile.mobileNumber,
    mail_id: profile.mailId,
    date_of_joining: profile.dateOfJoining,
    date_of_birth: profile.dateOfBirth,
    e_upkaran_id: profile.eUpkaranId,
    base_reporting_location: profile.baseReportingLocation,
    allowed_windows: profile.allowedWindows,
    profile_photo: profile.profilePhoto,
    created_at: profile.createdAt,
    updated_at: profile.updatedAt
  };
  return jsonResponse4({
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: "bearer",
    user: formattedProfile,
    bootstrap_data: bootstrapData
  });
}
__name(handleLogin, "handleLogin");
async function handleRefresh(request, env, params, query) {
  const db = getDrizzleDb(env, request);
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse4({ error: "Invalid JSON body" }, 400);
  }
  const { refresh_token } = body;
  if (!refresh_token) {
    return jsonResponse4({ error: "refresh_token required" }, 400);
  }
  const payload = await verifyJwt(refresh_token, env.API_SECRET);
  if (!payload || payload.type !== "refresh") {
    return jsonResponse4({ error: "Invalid or expired refresh token" }, 401);
  }
  const [user] = await db.select().from(users).where(eq(users.userId, payload.sub)).limit(1);
  if (!user || user.activeSessionId !== payload.sid) {
    return jsonResponse4({ error: "Session expired or invalid" }, 401);
  }
  const sessionId = crypto.randomUUID();
  await db.update(users).set({ activeSessionId: sessionId }).where(eq(users.userId, user.userId));
  const accessExp = Math.floor(Date.now() / 1e3) + 30 * 24 * 60 * 60;
  const refreshExp = Math.floor(Date.now() / 1e3) + 365 * 24 * 60 * 60;
  const accessToken = await signJwt({ sub: user.userId, sid: sessionId, exp: accessExp, type: "access" }, env.API_SECRET);
  const newRefreshToken = await signJwt({ sub: user.userId, sid: sessionId, exp: refreshExp, type: "refresh" }, env.API_SECRET);
  return jsonResponse4({
    access_token: accessToken,
    refresh_token: newRefreshToken,
    token_type: "bearer"
  });
}
__name(handleRefresh, "handleRefresh");
async function handleBootstrap(request, env, params, query, user) {
  const bootstrapData = await getBootstrapDataHelper(env, user, request);
  return jsonResponse4(bootstrapData);
}
__name(handleBootstrap, "handleBootstrap");
async function handleLogout(request, env, params, query, user) {
  const db = getDrizzleDb(env, request);
  try {
    if (user && user.user_id) {
      await db.update(users).set({ activeSessionId: null }).where(eq(users.userId, user.user_id));
    }
  } catch (e) {
    console.warn("Logout DB error:", e);
  }
  return jsonResponse4({ success: true, message: "Logged out successfully" });
}
__name(handleLogout, "handleLogout");
async function handleGetDropdowns(request, env, params, query) {
  const db = getDrizzleDb(env, request);
  const [gradesRows, hospitalsRows] = await Promise.all([
    db.select({ grade: allowanceMaster.grade }).from(allowanceMaster),
    db.select({ districtName: noTaDaHospitals.districtName, hospitalName: noTaDaHospitals.hospitalName }).from(noTaDaHospitals)
  ]);
  const grades = Array.from(new Set(gradesRows.map((r) => r.grade))).filter(Boolean).sort();
  const facilities = {};
  for (const h of hospitalsRows) {
    if (!facilities[h.districtName]) {
      facilities[h.districtName] = [];
    }
    facilities[h.districtName].push(h.hospitalName);
  }
  return jsonResponse4({
    designations: DESIGNATIONS,
    zones: ZONE_DISTRICTS,
    roles: ROLES,
    grades: grades.length ? grades : ["A", "B", "C", "D"],
    facilities
  });
}
__name(handleGetDropdowns, "handleGetDropdowns");
async function sendEmail(to, subject, body, env) {
  const gasUrl = env && env.GAS_WEB_APP_URL || "https://script.google.com/macros/s/AKfycbwxh5LQLCGtwGflfF7V5HKyL7viFNlAkAbsgz5xEDQo8Eg_f1kw47EjxrzSAC891sm1/exec";
  const plainText = body.replace(/<[^>]*>/g, "");
  const purpose = subject.toLowerCase().includes("unlock") ? "account_unlock" : "password_reset";
  const otpMatch = body.match(/\b\d{6}\b/);
  const otp = otpMatch ? otpMatch[0] : "";
  const payload = {
    to,
    name: "User",
    otp,
    purpose,
    subject,
    body: plainText,
    htmlBody: body
  };
  const res = await fetch(gasUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const errText = await res.text();
    console.error("Google Apps Script email error:", errText);
    throw new Error("Email dispatch failed: " + errText);
  }
  const result = await res.json();
  if (!result.success) {
    throw new Error("Email dispatch failed: " + (result.error || "Unknown error"));
  }
}
__name(sendEmail, "sendEmail");
async function handleForgotPassword(request, env, params, query) {
  const db = getDrizzleDb(env, request);
  try {
    let body;
    try {
      body = await request.json();
    } catch (e) {
      return jsonResponse4({ error: "Invalid JSON" }, 400);
    }
    const { user_id, date_of_birth } = body;
    if (!user_id || !date_of_birth) {
      return jsonResponse4({ error: "user_id and date_of_birth are required" }, 400);
    }
    const [user] = await db.select().from(users).where(eq(users.userId, user_id)).limit(1);
    if (!user) {
      return jsonResponse4({ error: "No user found with that User ID" }, 404);
    }
    const dobInput = String(date_of_birth).trim().replace(/\//g, "-");
    const dobStored = user.dateOfBirth ? String(user.dateOfBirth).trim() : "";
    const dobMatch = dobInput === dobStored || dobInput.split("-").reverse().join("-") === dobStored;
    if (!dobMatch) {
      return jsonResponse4({ error: "Date of birth does not match our records" }, 400);
    }
    const otp = String(Math.floor(1e5 + Math.random() * 9e5));
    const kvKey = `otp:${user_id}:forgot_password`;
    if (env.OTPS_KV) {
      await env.OTPS_KV.put(kvKey, otp, { expirationTtl: 600 });
    } else {
      console.warn("env.OTPS_KV is not bound! Falling back to console logging.");
    }
    const email = user.mailId || "";
    if (email) {
      const emailTemplate = `
        <div style="font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 550px; margin: auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
            <div style="background-color: #1e3a8a; padding: 25px; text-align: center;"><h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 600;">Cyrix Healthcare</h1></div>
            <div style="padding: 40px; background-color: #ffffff;">
                <p style="font-size: 16px; color: #1e293b;">Dear <b>${user.name}</b>,</p>
                <p style="font-size: 15px; color: #475569; line-height: 1.6;">To proceed with your <b>Password Reset</b> request, please use the following verification code:</p>
                <div style="text-align: center; margin: 35px 0;">
                    <div style="display: inline-block; background-color: #f8fafc; border: 1px solid #cbd5e1; padding: 18px 35px; border-radius: 10px;">
                        <span style="font-size: 34px; font-weight: 700; color: #2563eb; letter-spacing: 8px;">${otp}</span>
                    </div>
                    <p style="font-size: 13px; color: #94a3b8; margin-top: 15px;">Valid for 10 minutes only.</p>
                </div>
                <p style="font-size: 14px; color: #64748b;">If you did not request this code, please ignore this email.</p>
                <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 30px 0;">
                <div style="text-align: center; font-size: 11px; color: #94a3b8;">&copy; 2026 Cyrix Healthcare Pvt. Ltd. | Secure Access</div>
            </div>
        </div>`;
      try {
        await sendEmail(email, "Security Verification - Account Recovery", emailTemplate, env);
      } catch (emailErr) {
        console.error("Failed to send OTP email:", emailErr);
        let userMessage = emailErr.message;
        try {
          const cleanMsg = emailErr.message.replace("Email dispatch failed: ", "");
          const parsed = JSON.parse(cleanMsg);
          if (parsed.message) {
            userMessage = parsed.message;
          }
        } catch (e) {
        }
        return jsonResponse4({ error: `Email delivery failed: ${userMessage}. Please verify Google Apps Script configuration.` }, 400);
      }
    }
    const [namePart, domainPart] = email.split("@");
    const maskedEmail = namePart ? `${namePart.slice(0, 3)}***@${domainPart}` : null;
    return jsonResponse4({
      success: true,
      message: "OTP sent successfully",
      otp_sent: true,
      masked_email: maskedEmail,
      mobile_masked: user.mobileNumber ? `XXXXXX${String(user.mobileNumber).slice(-4)}` : null
    });
  } catch (err) {
    return jsonResponse4({ error: `Internal server error: ${err.message}` }, 500);
  }
}
__name(handleForgotPassword, "handleForgotPassword");
async function handleVerifyOtp(request, env, params, query) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse4({ error: "Invalid JSON" }, 400);
  }
  const { user_id, otp, otp_type } = body;
  if (!user_id || !otp || !otp_type) {
    return jsonResponse4({ error: "user_id, otp, and otp_type are required" }, 400);
  }
  let normalizedType = otp_type;
  if (normalizedType === "reset_password") {
    normalizedType = "forgot_password";
  }
  const kvKey = `otp:${user_id}:${normalizedType}`;
  const strikeKey = `otp_strikes:${user_id}:${normalizedType}`;
  let storedOtp = null;
  if (env.OTPS_KV) {
    storedOtp = await env.OTPS_KV.get(kvKey);
  } else {
    return jsonResponse4({ error: "KV store not configured. Cannot verify OTP." }, 500);
  }
  if (!storedOtp) {
    return jsonResponse4({ error: "Invalid or expired OTP. Please request a new one." }, 400);
  }
  let strikes = parseInt(await env.OTPS_KV.get(strikeKey) || "0", 10);
  if (strikes >= 5) {
    await env.OTPS_KV.delete(kvKey);
    await env.OTPS_KV.delete(strikeKey);
    return jsonResponse4({ error: "OTP blocked due to too many failed attempts. Please request a new code." }, 400);
  }
  if (storedOtp.trim() !== String(otp).trim()) {
    const remaining = 5 - strikes - 1;
    await env.OTPS_KV.put(strikeKey, String(strikes + 1), { expirationTtl: 600 });
    if (remaining <= 0) {
      await env.OTPS_KV.delete(kvKey);
      await env.OTPS_KV.delete(strikeKey);
      return jsonResponse4({ error: "Invalid OTP. Too many failed attempts. OTP has been invalidated." }, 400);
    }
    return jsonResponse4({ error: `Invalid OTP. ${remaining} attempts remaining.` }, 400);
  }
  if (env.OTPS_KV) {
    await env.OTPS_KV.delete(strikeKey);
  }
  return jsonResponse4({ success: true, message: "OTP verified successfully." });
}
__name(handleVerifyOtp, "handleVerifyOtp");
async function handleResetPassword(request, env, params, query) {
  const db = getDrizzleDb(env, request);
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse4({ error: "Invalid JSON" }, 400);
  }
  const { user_id, otp, new_password, confirm_password } = body;
  if (!user_id || !otp || !new_password || !confirm_password) {
    return jsonResponse4({ error: "All fields are required" }, 400);
  }
  if (new_password !== confirm_password) {
    return jsonResponse4({ error: "Passwords do not match" }, 400);
  }
  if (new_password.length < 8) {
    return jsonResponse4({ error: "Password must be at least 8 characters" }, 400);
  }
  const kvKey = `otp:${user_id}:forgot_password`;
  const strikeKey = `otp_strikes:${user_id}:forgot_password`;
  let storedOtp = null;
  if (env.OTPS_KV) {
    storedOtp = await env.OTPS_KV.get(kvKey);
  } else {
    return jsonResponse4({ error: "KV store not configured." }, 500);
  }
  if (!storedOtp) {
    return jsonResponse4({ error: "Invalid or expired OTP" }, 400);
  }
  let strikes = parseInt(await env.OTPS_KV.get(strikeKey) || "0", 10);
  if (strikes >= 5) {
    await env.OTPS_KV.delete(kvKey);
    await env.OTPS_KV.delete(strikeKey);
    return jsonResponse4({ error: "OTP blocked due to too many failed attempts. Please request a new code." }, 400);
  }
  if (storedOtp.trim() !== String(otp).trim()) {
    const remaining = 5 - strikes - 1;
    await env.OTPS_KV.put(strikeKey, String(strikes + 1), { expirationTtl: 600 });
    if (remaining <= 0) {
      await env.OTPS_KV.delete(kvKey);
      await env.OTPS_KV.delete(strikeKey);
      return jsonResponse4({ error: "Invalid OTP. Too many failed attempts. OTP has been invalidated." }, 400);
    }
    return jsonResponse4({ error: `Invalid OTP. ${remaining} attempts remaining.` }, 400);
  }
  const newHash = await getPasswordHash(new_password);
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
  const [user] = await db.select().from(users).where(eq(users.userId, user_id)).limit(1);
  if (!user)
    return jsonResponse4({ error: "User not found" }, 404);
  await db.batch([
    db.update(users).set({ hashedPassword: newHash, activeSessionId: null, failedAttempt: 0, userStatus: "active" }).where(eq(users.userId, user_id)),
    db.insert(passwordHistories).values({ userId: user.id, hashedPassword: newHash, createdAt: timestamp })
  ]);
  if (env.OTPS_KV) {
    await env.OTPS_KV.delete(kvKey);
    await env.OTPS_KV.delete(strikeKey);
  }
  return jsonResponse4({ success: true, message: "Password has been reset successfully. Please login with your new password." });
}
__name(handleResetPassword, "handleResetPassword");
async function handleUnlockAccount(request, env, params, query) {
  const db = getDrizzleDb(env, request);
  try {
    let body;
    try {
      body = await request.json();
    } catch (e) {
      return jsonResponse4({ error: "Invalid JSON" }, 400);
    }
    const { user_id, date_of_joining, date_of_birth } = body;
    if (!user_id || !date_of_joining || !date_of_birth) {
      return jsonResponse4({ error: "user_id, date_of_joining, and date_of_birth are required" }, 400);
    }
    const [user] = await db.select().from(users).where(eq(users.userId, user_id)).limit(1);
    if (!user)
      return jsonResponse4({ error: "No user found with that User ID" }, 404);
    if (user.userStatus !== "locked") {
      return jsonResponse4({ error: "Account is not locked. Please contact admin if you are having issues." }, 400);
    }
    const dojInput = String(date_of_joining).trim().replace(/\//g, "-");
    const dojStored = user.dateOfJoining ? String(user.dateOfJoining).trim() : "";
    const dojMatch = dojInput === dojStored || dojInput.split("-").reverse().join("-") === dojStored;
    const dobInput = String(date_of_birth).trim().replace(/\//g, "-");
    const dobStored = user.dateOfBirth ? String(user.dateOfBirth).trim() : "";
    const dobMatch = dobInput === dobStored || dobInput.split("-").reverse().join("-") === dobStored;
    if (!dojMatch || !dobMatch) {
      return jsonResponse4({ error: "Date of joining or date of birth does not match our records" }, 400);
    }
    const otp = String(Math.floor(1e5 + Math.random() * 9e5));
    const timestamp = (/* @__PURE__ */ new Date()).toISOString();
    const kvKey = `otp:${user_id}:unlock_account`;
    if (env.OTPS_KV) {
      await env.OTPS_KV.put(kvKey, otp, { expirationTtl: 600 });
    }
    const email = user.mailId || "";
    if (email) {
      const emailTemplate = `
        <div style="font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 550px; margin: auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
            <div style="background-color: #1e3a8a; padding: 25px; text-align: center;"><h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 600;">Cyrix Healthcare</h1></div>
            <div style="padding: 40px; background-color: #ffffff;">
                <p style="font-size: 16px; color: #1e293b;">Dear <b>${user.name}</b>,</p>
                <p style="font-size: 15px; color: #475569; line-height: 1.6;">Use the following verification code to <b>Unlock</b> your account access:</p>
                <div style="text-align: center; margin: 35px 0;">
                    <div style="display: inline-block; background-color: #f8fafc; border: 1px solid #cbd5e1; padding: 18px 35px; border-radius: 10px;">
                        <span style="font-size: 34px; font-weight: 700; color: #2563eb; letter-spacing: 8px;">${otp}</span>
                    </div>
                    <p style="font-size: 13px; color: #94a3b8; margin-top: 15px;">Valid for 10 minutes only.</p>
                </div>
                <p style="font-size: 14px; color: #64748b;">If you did not request this, please contact support.</p>
                <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 30px 0;">
                <div style="text-align: center; font-size: 11px; color: #94a3b8;">&copy; 2026 Cyrix Healthcare Pvt. Ltd. | Secure Access</div>
            </div>
        </div>`;
      try {
        await sendEmail(email, "Security Verification - Unlock Request", emailTemplate, env);
      } catch (emailErr) {
        console.error("Failed to send unlock email:", emailErr);
        return jsonResponse4({ error: "Failed to deliver unlock verification code. Contact administrator." }, 400);
      }
    }
    const [namePart, domainPart] = email.split("@");
    const maskedEmail = namePart ? `${namePart.slice(0, 3)}***@${domainPart}` : null;
    return jsonResponse4({
      success: true,
      message: "Unlock verification code sent successfully.",
      otp_sent: true,
      masked_email: maskedEmail
    });
  } catch (err) {
    return jsonResponse4({ error: `Internal server error: ${err.message}` }, 500);
  }
}
__name(handleUnlockAccount, "handleUnlockAccount");
async function handleUnlockVerifyOtp(request, env, params, query) {
  const db = getDrizzleDb(env, request);
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse4({ error: "Invalid JSON" }, 400);
  }
  const { user_id, otp } = body;
  if (!user_id || !otp) {
    return jsonResponse4({ error: "user_id and otp are required" }, 400);
  }
  const kvKey = `otp:${user_id}:unlock_account`;
  const strikeKey = `otp_strikes:${user_id}:unlock_account`;
  let storedOtp = null;
  if (env.OTPS_KV) {
    storedOtp = await env.OTPS_KV.get(kvKey);
  } else {
    return jsonResponse4({ error: "KV store not configured." }, 500);
  }
  if (!storedOtp) {
    return jsonResponse4({ error: "Verification code expired. Please request a new one." }, 400);
  }
  let strikes = parseInt(await env.OTPS_KV.get(strikeKey) || "0", 10);
  if (strikes >= 5) {
    await env.OTPS_KV.delete(kvKey);
    await env.OTPS_KV.delete(strikeKey);
    return jsonResponse4({ error: "Too many failed attempts. Code blocked. Please request a new one." }, 400);
  }
  if (storedOtp.trim() !== String(otp).trim()) {
    const remaining = 5 - strikes - 1;
    await env.OTPS_KV.put(strikeKey, String(strikes + 1), { expirationTtl: 600 });
    if (remaining <= 0) {
      await env.OTPS_KV.delete(kvKey);
      await env.OTPS_KV.delete(strikeKey);
      return jsonResponse4({ error: "Invalid OTP. Too many failed attempts. OTP has been invalidated." }, 400);
    }
    return jsonResponse4({ error: `Invalid OTP. ${remaining} attempts remaining.` }, 400);
  }
  await db.update(users).set({ userStatus: "active", failedAttempt: 0, activeSessionId: null }).where(eq(users.userId, user_id));
  if (env.OTPS_KV) {
    await env.OTPS_KV.delete(kvKey);
    await env.OTPS_KV.delete(strikeKey);
  }
  return jsonResponse4({ success: true, message: "Account unlocked successfully. You can now login." });
}
__name(handleUnlockVerifyOtp, "handleUnlockVerifyOtp");

// src/routes/users.js
function jsonResponse5(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
__name(jsonResponse5, "jsonResponse");
function validatePasswordStrength(password) {
  const errors = [];
  if (password.length < 8)
    errors.push("Password must be at least 8 characters long");
  if (!/[A-Z]/.test(password))
    errors.push("Password must contain at least one uppercase letter");
  if (!/[a-z]/.test(password))
    errors.push("Password must contain at least one lowercase letter");
  if (!/\d/.test(password))
    errors.push("Password must contain at least one digit");
  if (!/[@$!%*?&#]/.test(password))
    errors.push("Password must contain at least one special character (@$!%*?&#)");
  return {
    isValid: errors.length === 0,
    errors
  };
}
__name(validatePasswordStrength, "validatePasswordStrength");
async function handleGetProfile(request, env, params, query, user) {
  const db = getDrizzleDb(env, request);
  const [roleRow] = await db.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, user.user_id)).limit(1);
  const profile = { ...user };
  delete profile.hashed_password;
  profile.role = roleRow?.role || "user";
  return jsonResponse5(profile);
}
__name(handleGetProfile, "handleGetProfile");
async function handleUpdateProfile(request, env, params, query, user) {
  const db = getDrizzleDb(env, request);
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse5({ error: "Invalid JSON body" }, 400);
  }
  const { mobile_number, mail_id } = body;
  const updatePayload = {};
  if (mobile_number !== void 0) {
    const mobile = (mobile_number || "").trim();
    if (mobile && !/^\+?[0-9\- \(\)]{7,20}$/.test(mobile)) {
      return jsonResponse5({ error: "Invalid mobile number format" }, 400);
    }
    updatePayload.mobileNumber = mobile || null;
  }
  if (mail_id !== void 0) {
    const email = (mail_id || "").trim();
    if (email && !/^[\w\.-]+@[\w\.-]+\.\w+$/.test(email)) {
      return jsonResponse5({ error: "Invalid email address format" }, 400);
    }
    updatePayload.mailId = email || null;
  }
  if (Object.keys(updatePayload).length > 0) {
    updatePayload.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    await db.update(users).set(updatePayload).where(eq(users.id, user.id));
  }
  const [updatedUser] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
  const [roleRow] = await db.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, user.user_id)).limit(1);
  return jsonResponse5({
    ...updatedUser,
    role: roleRow?.role || "user"
  });
}
__name(handleUpdateProfile, "handleUpdateProfile");
async function handleChangePassword(request, env, params, query, user) {
  const db = getDrizzleDb(env, request);
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse5({ error: "Invalid JSON body" }, 400);
  }
  const { old_password, new_password, confirm_password } = body;
  if (!old_password || !new_password || !confirm_password) {
    return jsonResponse5({ error: "All fields are required" }, 400);
  }
  const oldCorrect = await verifyPassword(old_password, user.hashed_password);
  if (!oldCorrect) {
    return jsonResponse5({ error: "Current password is incorrect" }, 400);
  }
  if (new_password === old_password) {
    return jsonResponse5({ error: "New password must be different from current password" }, 400);
  }
  if (new_password !== confirm_password) {
    return jsonResponse5({ error: "New password and confirmation password do not match" }, 400);
  }
  const strength = validatePasswordStrength(new_password);
  if (!strength.isValid) {
    return jsonResponse5({ error: strength.errors.join("; ") }, 400);
  }
  const history = await db.select({ hashedPassword: passwordHistories.hashedPassword }).from(passwordHistories).where(eq(passwordHistories.userId, user.id)).orderBy(desc(passwordHistories.createdAt)).limit(5);
  const historyHashes = history.map((r) => r.hashedPassword);
  for (const histHash of historyHashes) {
    if (await verifyPassword(new_password, histHash)) {
      return jsonResponse5({ error: "You cannot reuse any of your last 5 passwords." }, 400);
    }
  }
  const newHash = await getPasswordHash(new_password);
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
  await db.batch([
    db.update(users).set({ hashedPassword: newHash }).where(eq(users.id, user.id)),
    db.insert(passwordHistories).values({ userId: user.id, hashedPassword: newHash, createdAt: timestamp })
  ]);
  return jsonResponse5({ status: "success", message: "Password has been updated successfully." });
}
__name(handleChangePassword, "handleChangePassword");
async function handleUploadProfilePhoto(request, env, params, query, user) {
  const db = getDrizzleDb(env, request);
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file) {
      return jsonResponse5({ error: "No file provided" }, 400);
    }
    const timestamp = (/* @__PURE__ */ new Date()).toISOString();
    const ext = (file.name || "photo.jpg").split(".").pop().toLowerCase() || "jpg";
    const filename = `profile_${user.user_id}_${Date.now()}.${ext}`;
    let photoUrl = null;
    try {
      const fileId = await uploadToGoogleDrive(env, file, "Profile_Pictures", filename);
      photoUrl = `/api/upload/file/gdrive/${fileId}`;
    } catch (e) {
      console.error("Profile photo upload failed:", e);
      return jsonResponse5({ error: "Failed to upload photo to Google Drive: " + e.message }, 500);
    }
    await db.update(users).set({ profilePhoto: photoUrl, updatedAt: timestamp }).where(eq(users.id, user.id));
    const [updatedUser] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
    const [roleRow] = await db.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, user.user_id)).limit(1);
    const result = { ...updatedUser, role: roleRow?.role || "user" };
    delete result.hashed_password;
    return jsonResponse5({ status: "success", profile_photo: photoUrl, user: result });
  } catch (e) {
    return jsonResponse5({ error: "Failed to upload photo: " + e.message }, 500);
  }
}
__name(handleUploadProfilePhoto, "handleUploadProfilePhoto");
async function handleDeleteProfilePhoto(request, env, params, query, user) {
  const db = getDrizzleDb(env, request);
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
  if (user.profile_photo && user.profile_photo.includes("/gdrive/")) {
    const fileId = user.profile_photo.split("/gdrive/").pop();
    await deleteFromGoogleDrive(env, fileId).catch(() => {
    });
  }
  await db.update(users).set({ profilePhoto: null, updatedAt: timestamp }).where(eq(users.id, user.id));
  const [updatedUser] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
  const [roleRow] = await db.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, user.user_id)).limit(1);
  const result = { ...updatedUser, role: roleRow?.role || "user" };
  delete result.hashed_password;
  return jsonResponse5({ status: "success", message: "Profile photo removed successfully", user: result });
}
__name(handleDeleteProfilePhoto, "handleDeleteProfilePhoto");

// src/routes/admin.js
function jsonResponse6(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
__name(jsonResponse6, "jsonResponse");
async function runRetroactivePolicyCheck(env, existingUser, newBaseLocation, timestamp) {
  const today = /* @__PURE__ */ new Date();
  const MONTH_NAMES2 = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December"
  ];
  const currentMonth = MONTH_NAMES2[today.getMonth()];
  const currentYear = today.getFullYear();
  const expensesRes = await env.DB.prepare(`
    SELECT id, expense_code, itinerary, amount, original_amount
    FROM expenses
    WHERE user_id = ? AND LOWER(month) = LOWER(?) AND year = ?
      AND LOWER(status) NOT IN ('rejected', 'returned_to_draft')
  `).bind(existingUser.id, currentMonth, currentYear).all().catch(() => ({ results: [] }));
  const expenses2 = expensesRes.results || [];
  if (expenses2.length === 0)
    return { affected_expenses: 0, total_deducted: 0 };
  const hospitalsRes = await env.DB.prepare("SELECT DISTINCT hospital_name FROM assets_inventory WHERE hospital_name IS NOT NULL").all().catch(() => ({ results: [] }));
  const officialHospitals = new Set((hospitalsRes.results || []).map((h) => h.hospital_name.trim().toLowerCase()));
  const baseLocations2 = (newBaseLocation || "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
  let affectedCount = 0;
  let totalDeducted = 0;
  const batchStatements = [];
  for (const exp of expenses2) {
    const legsRes = await env.DB.prepare(`
      SELECT itinerary_id, leg_number, from_location, to_location, travel_mode, sub_mode,
        distance_km, travel_amount, sub_amount, da_amount, hotel_amount, local_purchase,
        other_amount, from_district, to_district
      FROM expense_itineraries WHERE exp_id = ? ORDER BY leg_number ASC
    `).bind(exp.expense_code).all().catch(() => ({ results: [] }));
    const legs = (legsRes.results || []).map((leg) => {
      const fromLoc = (leg.from_location || "").trim().toLowerCase();
      const toLoc = (leg.to_location || "").trim().toLowerCase();
      const fromDist = (leg.from_district || "").trim().toLowerCase();
      const toDist = (leg.to_district || "").trim().toLowerCase();
      const isOutdoor = fromDist && toDist && fromDist !== toDist;
      const travelType = isOutdoor ? "Outdoor" : "In-District";
      const fromCustom = fromLoc && !officialHospitals.has(fromLoc);
      const toCustom = toLoc && !officialHospitals.has(toLoc);
      return {
        ...leg,
        from: leg.from_location || "",
        to: leg.to_location || "",
        from_custom: fromCustom,
        to_custom: toCustom,
        amount: leg.travel_amount,
        sub_amount: leg.sub_amount,
        da: leg.da_amount,
        travel_type: travelType
      };
    });
    const { isBaseLocOnly, isDaAllowed } = computeBaseLocPolicy(newBaseLocation, legs);
    if (!isBaseLocOnly)
      continue;
    let expenseDeducted = 0;
    let policyApplied = false;
    const retroLegLogs = [];
    for (let idx = 0; idx < legs.length; idx++) {
      const leg = legs[idx];
      const isCommute = checkIsCommuteLeg(leg, baseLocations2, idx, legs.length);
      const currentTA = parseFloat(leg.travel_amount || "0");
      const currentSubAmt = parseFloat(leg.sub_amount || "0");
      const currentDA = parseFloat(leg.da_amount || "0");
      const newTA = isCommute ? 0 : currentTA;
      const newSubAmt = isCommute ? 0 : currentSubAmt;
      const newDA = isDaAllowed ? currentDA : 0;
      if (currentTA > newTA) {
        retroLegLogs.push({
          leg_number: leg.leg_number,
          field_name: "travel_amount",
          old_value: currentTA,
          new_value: newTA,
          comment: "[Retroactive] Base Location commute TA not eligible"
        });
      }
      if (currentSubAmt > newSubAmt) {
        retroLegLogs.push({
          leg_number: leg.leg_number,
          field_name: "sub_amount",
          old_value: currentSubAmt,
          new_value: newSubAmt,
          comment: "[Retroactive] Base Location commute local conveyance not eligible"
        });
      }
      if (currentDA > newDA) {
        retroLegLogs.push({
          leg_number: leg.leg_number,
          field_name: "da_amount",
          old_value: currentDA,
          new_value: newDA,
          comment: "[Retroactive] DA not applicable at base location"
        });
      }
      const diff = currentTA - newTA + (currentSubAmt - newSubAmt) + (currentDA - newDA);
      if (diff > 0) {
        policyApplied = true;
        expenseDeducted += diff;
        batchStatements.push({
          sql: `
            UPDATE expense_itineraries
            SET travel_amount = ?, sub_amount = ?, da_amount = ?
            WHERE itinerary_id = ?
          `,
          params: [newTA, newSubAmt, newDA, leg.itinerary_id]
        });
      }
    }
    if (policyApplied) {
      const newTotal = parseFloat(exp.amount || 0) - expenseDeducted;
      const newDaTotal = legs.reduce((sum, l, idx) => {
        const isCommute = checkIsCommuteLeg(l, baseLocations2, idx, legs.length);
        const currentDA = parseFloat(l.da_amount || "0");
        const newDA = isDaAllowed ? currentDA : 0;
        return sum + newDA;
      }, 0);
      batchStatements.push({
        sql: `
          UPDATE expenses SET amount = ?, da_amount = ?, updated_at = ? WHERE id = ?
        `,
        params: [newTotal, newDaTotal, timestamp, exp.id]
      });
      const policyComment = buildPolicyComment(baseLocations2, legs, isDaAllowed, exp.itinerary || timestamp.split("T")[0]);
      if (policyComment) {
        batchStatements.push({
          sql: "INSERT INTO expense_edit_logs (expense_id, comment, editor_name, editor_role, editor_id) VALUES (?, ?, 'SYSTEM', 'Policy', 0)",
          params: [exp.id, `[Retroactive] ${policyComment}`]
        });
      }
      for (const log of retroLegLogs) {
        batchStatements.push({
          sql: `INSERT INTO expense_edit_logs 
                 (expense_id, leg_number, field_name, old_value, new_value, comment, editor_name, editor_role, editor_id)
                 VALUES (?, ?, ?, ?, ?, ?, 'SYSTEM', 'Policy', 0)`,
          params: [exp.id, log.leg_number, log.field_name, String(log.old_value), String(log.new_value), log.comment]
        });
      }
      batchStatements.push({
        sql: "INSERT INTO notifications (user_id, title, description, type, read, link, created_at) VALUES (?, ?, ?, 'warning', 0, '/expense', ?)",
        params: [
          existingUser.user_id,
          "\u26A0\uFE0F Expense Adjusted \u2014 Base Location Policy",
          `Your expense for ${exp.itinerary || "this period"} has been adjusted per base location TA/DA policy. Commute TA has been deducted.`,
          timestamp
        ]
      });
      affectedCount++;
      totalDeducted += expenseDeducted;
    }
  }
  if (batchStatements.length > 0) {
    await runBatchWrite(env, batchStatements);
  }
  return {
    affected_expenses: affectedCount,
    total_deducted: Math.round(totalDeducted * 100) / 100
  };
}
__name(runRetroactivePolicyCheck, "runRetroactivePolicyCheck");
async function handleListUsers(request, env, params, query, user) {
  if (user.role !== "Admin") {
    return jsonResponse6({ error: "Access denied" }, 403);
  }
  const users2 = await env.DB.prepare(`
    SELECT u.*, r.role
    FROM users u
    LEFT JOIN user_roles r ON u.user_id = r.user_id
    ORDER BY u.name ASC
  `).all();
  return jsonResponse6(users2.results || []);
}
__name(handleListUsers, "handleListUsers");
async function handleSaveUser(request, env, params, query, adminUser) {
  if (adminUser.role !== "Admin") {
    return jsonResponse6({ error: "Access denied" }, 403);
  }
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse6({ error: "Invalid JSON body" }, 400);
  }
  const {
    id,
    user_id,
    name,
    password,
    designation,
    zone,
    district,
    manager,
    zonal_manager,
    coordinator,
    mobile_number,
    mail_id,
    role,
    user_status
  } = body;
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
  if (id) {
    const existing = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(id).first();
    if (!existing)
      return jsonResponse6({ error: "User not found" }, 404);
    const updates = [];
    const bindings = [];
    if (name) {
      updates.push("name = ?");
      bindings.push(name.trim());
    }
    if (designation) {
      updates.push("designation = ?");
      bindings.push(designation);
    }
    if (zone) {
      updates.push("zone = ?");
      bindings.push(zone);
    }
    if (district) {
      updates.push("district = ?");
      bindings.push(district);
    }
    if (manager !== void 0) {
      updates.push("manager = ?");
      bindings.push(manager || null);
    }
    if (zonal_manager !== void 0) {
      updates.push("zonal_manager = ?");
      bindings.push(zonal_manager || null);
    }
    if (coordinator !== void 0) {
      updates.push("coordinator = ?");
      bindings.push(coordinator || null);
    }
    if (mobile_number !== void 0) {
      updates.push("mobile_number = ?");
      bindings.push(mobile_number || null);
    }
    if (mail_id !== void 0) {
      updates.push("mail_id = ?");
      bindings.push(mail_id || null);
    }
    if (user_status) {
      updates.push("user_status = ?");
      bindings.push(user_status);
    }
    if (body.grade !== void 0) {
      updates.push("grade = ?");
      bindings.push(body.grade);
    }
    if (body.type !== void 0) {
      updates.push("type = ?");
      bindings.push(body.type);
    }
    if (body.date_of_joining !== void 0) {
      updates.push("date_of_joining = ?");
      bindings.push(body.date_of_joining || null);
    }
    if (body.date_of_birth !== void 0) {
      updates.push("date_of_birth = ?");
      bindings.push(body.date_of_birth || null);
    }
    if (body.e_upkaran_id !== void 0) {
      updates.push("e_upkaran_id = ?");
      bindings.push(body.e_upkaran_id);
    }
    if (body.base_reporting_location !== void 0) {
      updates.push("base_reporting_location = ?");
      bindings.push(body.base_reporting_location);
    }
    if (body.allowed_windows !== void 0) {
      updates.push("allowed_windows = ?");
      bindings.push(body.allowed_windows);
    }
    if (password) {
      const newHash = await getPasswordHash(password);
      updates.push("hashed_password = ?");
      bindings.push(newHash);
      await runWrite(env, "INSERT INTO password_histories (user_id, hashed_password, created_at) VALUES (?, ?, ?)", [
        existing.id,
        existing.hashed_password,
        timestamp
      ]);
    }
    if (updates.length > 0) {
      bindings.push(id);
      await runWrite(env, `
        UPDATE users SET ${updates.join(", ")}, updated_at = ? WHERE id = ?
      `, [...bindings, timestamp, id]);
    }
    if (role) {
      const roleExists = await env.DB.prepare("SELECT 1 FROM user_roles WHERE user_id = ?").bind(existing.user_id).first();
      if (roleExists) {
        await runWrite(env, "UPDATE user_roles SET role = ? WHERE user_id = ?", [role, existing.user_id]);
      } else {
        await runWrite(env, "INSERT INTO user_roles (user_id, role, assigned_at) VALUES (?, ?, ?)", [existing.user_id, role, timestamp]);
      }
    }
    let retroSummary = null;
    if (body.base_reporting_location !== void 0 && body.base_reporting_location !== (existing.base_reporting_location || "")) {
      try {
        retroSummary = await runRetroactivePolicyCheck(env, existing, body.base_reporting_location, timestamp);
      } catch (e) {
        console.error("Retroactive policy check failed:", e.message);
      }
    }
    return jsonResponse6({
      status: "success",
      message: "User updated successfully",
      ...retroSummary ? { policy_adjustment: retroSummary } : {}
    });
  } else {
    const cleanUserId = (user_id || body.e_code || "").trim();
    if (!cleanUserId || !password || !name) {
      return jsonResponse6({ error: "user_id/e_code, password, and name are required" }, 400);
    }
    const existing = await env.DB.prepare("SELECT 1 FROM users WHERE user_id = ?").bind(cleanUserId).first();
    if (existing) {
      return jsonResponse6({ error: "User ID already exists" }, 400);
    }
    const hashed = await getPasswordHash(password);
    await runWrite(env, `
      INSERT INTO users (
        user_id, e_code, name, hashed_password, user_status, designation, 
        zone, district, manager, zonal_manager, coordinator, mobile_number, 
        mail_id, grade, type, date_of_joining, date_of_birth, e_upkaran_id, 
        base_reporting_location, allowed_windows, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      cleanUserId,
      cleanUserId,
      name.trim(),
      hashed,
      user_status || "active",
      designation || "",
      zone || "",
      district || "",
      manager || null,
      zonal_manager || null,
      coordinator || null,
      mobile_number || null,
      mail_id || null,
      body.grade || "",
      body.type || "",
      body.date_of_joining || null,
      body.date_of_birth || null,
      body.e_upkaran_id || "",
      body.base_reporting_location || "",
      body.allowed_windows || "home,expense,help,profile",
      timestamp,
      timestamp
    ]);
    await runWrite(env, "INSERT INTO user_roles (user_id, role, assigned_at) VALUES (?, ?, ?)", [
      cleanUserId,
      role || "user",
      timestamp
    ]);
    return jsonResponse6({ status: "success", message: "User created successfully" });
  }
}
__name(handleSaveUser, "handleSaveUser");
async function handleBulkCreateUsers(request, env, params, query, adminUser) {
  if (adminUser.role !== "Admin") {
    return jsonResponse6({ error: "Access denied" }, 403);
  }
  let payload;
  try {
    payload = await request.json();
  } catch (e) {
    return jsonResponse6({ error: "Invalid JSON body" }, 400);
  }
  if (!Array.isArray(payload)) {
    return jsonResponse6({ error: "Payload must be an array of user objects" }, 400);
  }
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
  let createdCount = 0;
  const errors = [];
  const allUsersRes = await env.DB.prepare(`
    SELECT u.*, r.role as role
    FROM users u
    LEFT JOIN user_roles r ON u.user_id = r.user_id
  `).all();
  const allUsersMap = /* @__PURE__ */ new Map();
  const userIdSet = /* @__PURE__ */ new Set();
  const eCodeSet = /* @__PURE__ */ new Set();
  const nameSet = /* @__PURE__ */ new Set();
  for (const u of allUsersRes.results || []) {
    const uidLower = (u.user_id || "").toLowerCase();
    allUsersMap.set(uidLower, u);
    userIdSet.add(uidLower);
    if (u.e_code)
      eCodeSet.add(u.e_code.toLowerCase());
    if (u.name)
      nameSet.add(u.name.toLowerCase());
  }
  const batchStatements = [];
  for (let index = 0; index < payload.length; index++) {
    const item = payload[index];
    const eCode = String(item.e_code || "").trim();
    if (!eCode) {
      errors.push(`Row ${index + 1}: Missing Employee Code. Skipped.`);
      continue;
    }
    const existing = allUsersMap.get(eCode.toLowerCase());
    const nameCl = String(item.name || "").trim();
    if (!existing && !nameCl) {
      errors.push(`Row ${index + 1} (${eCode}): Missing Name. Skipped.`);
      continue;
    }
    const resolveRef = /* @__PURE__ */ __name((val) => {
      if (!val || !val.trim())
        return "";
      const vl = val.trim().toLowerCase();
      return userIdSet.has(vl) || eCodeSet.has(vl) || nameSet.has(vl) ? val.trim() : "";
    }, "resolveRef");
    const managerCl = resolveRef(String(item.manager || ""));
    const zonalMgrCl = resolveRef(String(item.zonal_manager || ""));
    const coordCl = resolveRef(String(item.coordinator || ""));
    const roleCl = String(item.role || "").trim();
    const typeCl = String(item.type || "Employee").trim();
    const autoWindows = roleCl.toLowerCase() === "engineer" ? "home,expense,help,profile" : roleCl.toLowerCase() === "manager" ? "home,approval,expense,help,profile" : "home,approval,expense,analysis,report,help,profile";
    try {
      if (existing) {
        let passwordChanged = false;
        let newPasswordHash = null;
        if (item.password) {
          const plainPwd = String(item.password).trim();
          const isSamePassword = await verifyPassword(plainPwd, existing.hashed_password);
          if (!isSamePassword) {
            passwordChanged = true;
            newPasswordHash = await getPasswordHash(plainPwd);
          }
        }
        const fieldUpdates = [];
        const fieldBinds = [];
        const isDiff = /* @__PURE__ */ __name((val1, val2) => {
          const v1 = val1 === void 0 || val1 === null ? "" : String(val1).trim();
          const v2 = val2 === void 0 || val2 === null ? "" : String(val2).trim();
          return v1 !== v2;
        }, "isDiff");
        if (item.designation !== void 0 && isDiff(item.designation, existing.designation)) {
          fieldUpdates.push("designation = ?");
          fieldBinds.push(String(item.designation).trim());
        }
        if (item.grade !== void 0 && isDiff(item.grade, existing.grade)) {
          fieldUpdates.push("grade = ?");
          fieldBinds.push(String(item.grade).trim());
        }
        if (item.district !== void 0 && isDiff(item.district, existing.district)) {
          fieldUpdates.push("district = ?");
          fieldBinds.push(String(item.district).trim());
        }
        if (item.zone !== void 0 && isDiff(item.zone, existing.zone)) {
          fieldUpdates.push("zone = ?");
          fieldBinds.push(String(item.zone).trim());
        }
        if (item.mobile_number !== void 0 && isDiff(item.mobile_number, existing.mobile_number)) {
          fieldUpdates.push("mobile_number = ?");
          fieldBinds.push(String(item.mobile_number).trim());
        }
        if (item.mail_id !== void 0 && isDiff(item.mail_id, existing.mail_id)) {
          fieldUpdates.push("mail_id = ?");
          fieldBinds.push(String(item.mail_id).trim());
        }
        if (item.date_of_joining !== void 0 && isDiff(item.date_of_joining, existing.date_of_joining)) {
          fieldUpdates.push("date_of_joining = ?");
          fieldBinds.push(String(item.date_of_joining).trim() || null);
        }
        if (item.date_of_birth !== void 0 && isDiff(item.date_of_birth, existing.date_of_birth)) {
          fieldUpdates.push("date_of_birth = ?");
          fieldBinds.push(String(item.date_of_birth).trim() || null);
        }
        if (item.e_upkaran_id !== void 0 && isDiff(item.e_upkaran_id, existing.e_upkaran_id)) {
          fieldUpdates.push("e_upkaran_id = ?");
          fieldBinds.push(String(item.e_upkaran_id).trim());
        }
        if (managerCl !== void 0 && isDiff(managerCl, existing.manager)) {
          fieldUpdates.push("manager = ?");
          fieldBinds.push(managerCl || null);
        }
        if (zonalMgrCl !== void 0 && isDiff(zonalMgrCl, existing.zonal_manager)) {
          fieldUpdates.push("zonal_manager = ?");
          fieldBinds.push(zonalMgrCl || null);
        }
        if (coordCl !== void 0 && isDiff(coordCl, existing.coordinator)) {
          fieldUpdates.push("coordinator = ?");
          fieldBinds.push(coordCl || null);
        }
        if (roleCl && isDiff(roleCl, existing.role)) {
          fieldUpdates.push("role = ?");
          fieldBinds.push(roleCl);
        }
        if (typeCl && isDiff(typeCl, existing.type)) {
          fieldUpdates.push("type = ?");
          fieldBinds.push(typeCl);
        }
        const targetWindows = item.allowed_windows ? String(item.allowed_windows).trim() : roleCl ? autoWindows : existing.allowed_windows;
        if (targetWindows !== void 0 && isDiff(targetWindows, existing.allowed_windows)) {
          fieldUpdates.push("allowed_windows = ?");
          fieldBinds.push(targetWindows);
        }
        if (passwordChanged && newPasswordHash) {
          fieldUpdates.push("hashed_password = ?");
          fieldBinds.push(newPasswordHash);
          batchStatements.push({
            sql: "INSERT INTO password_histories (user_id, hashed_password, created_at) VALUES (?, ?, ?)",
            params: [existing.id, newPasswordHash, timestamp]
          });
        }
        if (fieldUpdates.length > 0) {
          fieldBinds.push(timestamp);
          fieldBinds.push(existing.id);
          batchStatements.push({
            sql: `UPDATE users SET ${fieldUpdates.join(", ")}, updated_at = ? WHERE id = ?`,
            params: fieldBinds
          });
          if (roleCl && isDiff(roleCl, existing.role)) {
            batchStatements.push({
              sql: "DELETE FROM user_roles WHERE user_id = ?",
              params: [existing.user_id]
            });
            batchStatements.push({
              sql: "INSERT INTO user_roles (user_id, role, assigned_at) VALUES (?, ?, ?)",
              params: [existing.user_id, roleCl, timestamp]
            });
          }
          createdCount++;
        }
      } else {
        const pwd = String(item.password || "").trim();
        if (!pwd) {
          errors.push(`Row ${index + 1} (${eCode}): Missing Password. Skipped.`);
          continue;
        }
        const hashed = await getPasswordHash(pwd);
        batchStatements.push({
          sql: `INSERT INTO users (user_id, e_code, name, hashed_password, user_status, designation, grade, district, zone, manager, zonal_manager, coordinator, mobile_number, mail_id, role, type, date_of_joining, date_of_birth, e_upkaran_id, allowed_windows, created_at, updated_at)
                VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          params: [
            eCode,
            eCode,
            nameCl,
            hashed,
            String(item.designation || "").trim(),
            String(item.grade || "").trim(),
            String(item.district || "").trim(),
            String(item.zone || "").trim(),
            managerCl,
            zonalMgrCl,
            coordCl,
            String(item.mobile_number || "").trim(),
            String(item.mail_id || "").trim(),
            roleCl,
            typeCl,
            item.date_of_joining || null,
            item.date_of_birth || null,
            item.e_upkaran_id ? String(item.e_upkaran_id).trim() : null,
            item.allowed_windows ? String(item.allowed_windows).trim() : autoWindows,
            timestamp,
            timestamp
          ]
        });
        batchStatements.push({
          sql: "INSERT INTO password_histories (user_id, hashed_password, created_at) VALUES ((SELECT id FROM users WHERE user_id = ?), ?, ?)",
          params: [eCode, hashed, timestamp]
        });
        batchStatements.push({
          sql: "INSERT INTO user_roles (user_id, role, assigned_at) VALUES (?, ?, ?)",
          params: [eCode, roleCl || "user", timestamp]
        });
        userIdSet.add(eCode.toLowerCase());
        eCodeSet.add(eCode.toLowerCase());
        nameSet.add(nameCl.toLowerCase());
        createdCount++;
      }
    } catch (ex) {
      errors.push(`Row ${index + 1} (${eCode}): Failed due to ${ex.message}`);
    }
  }
  if (batchStatements.length > 0) {
    await runBatchWrite(env, batchStatements);
  }
  return jsonResponse6({
    status: "success",
    created_count: createdCount,
    failed_count: errors.length,
    errors
  });
}
__name(handleBulkCreateUsers, "handleBulkCreateUsers");
async function handleDeleteUser(request, env, params, query, adminUser) {
  if (adminUser.role !== "Admin") {
    return jsonResponse6({ error: "Access denied" }, 403);
  }
  const userId = params.user_id;
  const user = await env.DB.prepare("SELECT * FROM users WHERE user_id = ?").bind(userId).first();
  if (!user)
    return jsonResponse6({ error: "User not found" }, 404);
  const statements = [
    { sql: "DELETE FROM user_roles WHERE user_id = ?", params: [userId] },
    { sql: "DELETE FROM password_histories WHERE user_id = ?", params: [user.id] },
    { sql: "DELETE FROM login_logs WHERE user_id = ?", params: [userId] },
    { sql: "DELETE FROM users WHERE id = ?", params: [user.id] }
  ];
  await runBatchWrite(env, statements);
  return jsonResponse6({ status: "success", message: "User deleted successfully" });
}
__name(handleDeleteUser, "handleDeleteUser");
async function handleListHierarchies(request, env, params, query, adminUser) {
  if (adminUser.role !== "Admin") {
    return jsonResponse6({ error: "Access denied" }, 403);
  }
  const chainsRes = await env.DB.prepare("SELECT * FROM approval_hierarchies ORDER BY id ASC").all();
  const chains = chainsRes.results || [];
  if (chains.length === 0) {
    return jsonResponse6([]);
  }
  const requestersRes = await env.DB.prepare(`
    SELECT hr.id, hr.hierarchy_id, hr.user_id, u.name AS user_name, u.user_id AS user_code
    FROM hierarchy_requesters hr
    JOIN users u ON hr.user_id = u.id
  `).all();
  const requesters = requestersRes.results || [];
  const approversRes = await env.DB.prepare(`
    SELECT ha.id, ha.hierarchy_id, ha.level_number, ha.approver_id, u.name AS approver_name, u.user_id AS approver_code, ur.role AS approver_role
    FROM hierarchy_approvers ha
    JOIN users u ON ha.approver_id = u.id
    LEFT JOIN user_roles ur ON u.user_id = ur.user_id
  `).all();
  const approvers = approversRes.results || [];
  const list = chains.map((chain) => {
    const chainRequesters = requesters.filter((r) => r.hierarchy_id === chain.id).map((r) => ({
      id: r.id,
      user_id: r.user_id,
      user_name: r.user_name,
      user_code: r.user_code
    }));
    const chainApprovers = approvers.filter((a) => a.hierarchy_id === chain.id).map((a) => ({
      id: a.id,
      level_number: a.level_number,
      approver_id: a.approver_id,
      approver_name: a.approver_name,
      approver_code: a.approver_code,
      approver_role: a.approver_role || "user"
    })).sort((a, b) => a.level_number - b.level_number);
    return {
      id: chain.id,
      name: chain.name || "",
      requesters: chainRequesters,
      approvers: chainApprovers,
      created_at: chain.created_at,
      updated_at: chain.updated_at
    };
  });
  return jsonResponse6(list);
}
__name(handleListHierarchies, "handleListHierarchies");
async function handleSaveHierarchy(request, env, params, query, adminUser) {
  if (adminUser.role !== "Admin") {
    return jsonResponse6({ error: "Access denied" }, 403);
  }
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse6({ error: "Invalid JSON body" }, 400);
  }
  const { id, name, requester_ids, approvers } = body;
  if (!name || !name.trim()) {
    return jsonResponse6({ error: "Hierarchy name is required" }, 400);
  }
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
  let hId = id;
  if (id) {
    const existing = await env.DB.prepare("SELECT 1 FROM approval_hierarchies WHERE id = ?").bind(id).first();
    if (!existing)
      return jsonResponse6({ error: "Hierarchy not found" }, 404);
    await runWrite(env, "UPDATE approval_hierarchies SET name = ? WHERE id = ?", [name.trim(), id]);
    await runWrite(env, "DELETE FROM hierarchy_requesters WHERE hierarchy_id = ?", [id]);
    await runWrite(env, "DELETE FROM hierarchy_approvers WHERE hierarchy_id = ?", [id]);
  } else {
    const result = await runWrite(env, "INSERT INTO approval_hierarchies (name) VALUES (?)", [name.trim()]);
    hId = result.meta?.last_row_id;
    if (!hId) {
      return jsonResponse6({ error: "Failed to create hierarchy" }, 500);
    }
  }
  if (requester_ids && Array.isArray(requester_ids)) {
    for (const reqId of requester_ids) {
      if (reqId) {
        await runWrite(env, "INSERT INTO hierarchy_requesters (hierarchy_id, user_id) VALUES (?, ?)", [hId, reqId]);
      }
    }
  }
  if (approvers && Array.isArray(approvers)) {
    for (const app of approvers) {
      if (app && app.approver_id && app.level_number) {
        await runWrite(env, "INSERT INTO hierarchy_approvers (hierarchy_id, level_number, approver_id) VALUES (?, ?, ?)", [hId, app.level_number, app.approver_id]);
      }
    }
  }
  return jsonResponse6({ status: "success", message: "Hierarchy mappings saved successfully" });
}
__name(handleSaveHierarchy, "handleSaveHierarchy");
async function handleUpdateUser(request, env, params, query, adminUser) {
  if (adminUser.role !== "Admin") {
    return jsonResponse6({ error: "Access denied" }, 403);
  }
  const userId = params.user_id;
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse6({ error: "Invalid JSON body" }, 400);
  }
  const user = await env.DB.prepare("SELECT * FROM users WHERE user_id = ?").bind(userId).first();
  if (!user)
    return jsonResponse6({ error: `User '${userId}' not found.` }, 404);
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
  const updates = [];
  const bindings = [];
  const batchStatements = [];
  batchStatements.push({ sql: "PRAGMA foreign_keys = OFF", params: [] });
  const newUserId = body.new_user_id?.trim();
  const newECode = body.new_e_code?.trim();
  const isUidChanged = newUserId && newUserId !== user.user_id;
  const isEcodeChanged = newECode && newECode !== user.e_code;
  const isPasswordChanged = body.password && body.password.trim() !== "";
  if (isUidChanged || isEcodeChanged || isPasswordChanged) {
    const adminSecPw = body.admin_update_password || "";
    const expectedPw = (env.ADMIN_UPDATE_PASSWORD || "012001@Sunil").trim();
    if (adminSecPw.trim() !== expectedPw) {
      return jsonResponse6({ error: "Invalid admin security password to change User ID / Employee Code / Password." }, 400);
    }
    if (isUidChanged) {
      const existingUid = await env.DB.prepare("SELECT 1 FROM users WHERE user_id = ?").bind(newUserId).first();
      if (existingUid)
        return jsonResponse6({ error: `User ID '${newUserId}' is already in use.` }, 400);
    }
    if (isEcodeChanged) {
      const existingEc = await env.DB.prepare("SELECT 1 FROM users WHERE e_code = ?").bind(newECode).first();
      if (existingEc)
        return jsonResponse6({ error: `Employee Code '${newECode}' is already in use.` }, 400);
    }
    if (isPasswordChanged) {
      const newHash = await getPasswordHash(body.password.trim());
      updates.push("hashed_password = ?");
      bindings.push(newHash);
      batchStatements.push({
        sql: "INSERT INTO password_histories (user_id, hashed_password, created_at) VALUES (?, ?, ?)",
        params: [user.id, newHash, timestamp]
      });
    }
    if (isUidChanged) {
      batchStatements.push({
        sql: "UPDATE user_roles SET user_id = ? WHERE user_id = ?",
        params: [newUserId, user.user_id]
      });
      batchStatements.push({
        sql: "UPDATE notifications SET user_id = ? WHERE user_id = ?",
        params: [newUserId, user.user_id]
      });
      batchStatements.push({
        sql: "UPDATE limit_approval_requests SET user_id = ? WHERE user_id = ?",
        params: [newUserId, user.user_id]
      });
      batchStatements.push({
        sql: "UPDATE limit_approval_requests SET manager_id = ? WHERE manager_id = ?",
        params: [newUserId, user.user_id]
      });
      batchStatements.push({
        sql: "UPDATE kpi_appraisals SET user_id = ? WHERE user_id = ?",
        params: [newUserId, user.user_id]
      });
      batchStatements.push({
        sql: "UPDATE engineer_advances SET user_id = ? WHERE user_id = ?",
        params: [newUserId, user.user_id]
      });
      batchStatements.push({
        sql: "UPDATE login_logs SET user_id = ? WHERE user_id = ?",
        params: [newUserId, user.user_id]
      });
      batchStatements.push({
        sql: "UPDATE otps SET user_id = ? WHERE user_id = ?",
        params: [newUserId, user.user_id]
      });
      updates.push("user_id = ?");
      bindings.push(newUserId);
    }
    if (isEcodeChanged || isUidChanged) {
      updates.push("e_code = ?");
      bindings.push(newECode || user.e_code);
    }
  }
  const fieldMap = {
    name: "name",
    designation: "designation",
    grade: "grade",
    district: "district",
    zone: "zone",
    manager: "manager",
    zonal_manager: "zonal_manager",
    coordinator: "coordinator",
    mobile_number: "mobile_number",
    mail_id: "mail_id",
    type: "type",
    date_of_joining: "date_of_joining",
    date_of_birth: "date_of_birth",
    e_upkaran_id: "e_upkaran_id",
    base_reporting_location: "base_reporting_location",
    allowed_windows: "allowed_windows"
  };
  for (const [reqField, dbField] of Object.entries(fieldMap)) {
    if (body[reqField] !== void 0) {
      updates.push(`${dbField} = ?`);
      bindings.push(body[reqField]);
    }
  }
  if (body.user_status !== void 0) {
    const statusClean = body.user_status.trim().toLowerCase();
    if (!["active", "locked", "disabled"].includes(statusClean)) {
      return jsonResponse6({ error: "Status must be 'active', 'locked', or 'disabled'." }, 400);
    }
    updates.push("user_status = ?");
    bindings.push(statusClean);
    if (statusClean === "active") {
      updates.push("failed_attempt = ?");
      bindings.push(0);
    }
  }
  if (body.role !== void 0) {
    const oldRole = user.role;
    if (oldRole !== body.role) {
      batchStatements.push({
        sql: "DELETE FROM user_roles WHERE user_id = ? AND role = ?",
        params: [user.user_id, oldRole]
      });
      const roleUserId = isUidChanged ? newUserId : user.user_id;
      batchStatements.push({
        sql: "INSERT INTO user_roles (user_id, role, assigned_at) VALUES (?, ?, ?)",
        params: [roleUserId, body.role, timestamp]
      });
    }
    updates.push("role = ?");
    bindings.push(body.role);
  }
  if (updates.length > 0) {
    bindings.push(timestamp);
    bindings.push(user.id);
    batchStatements.push({
      sql: `UPDATE users SET ${updates.join(", ")}, updated_at = ? WHERE id = ?`,
      params: bindings
    });
  }
  batchStatements.push({ sql: "PRAGMA foreign_keys = ON", params: [] });
  if (batchStatements.length > 2) {
    await runBatchWrite(env, batchStatements);
  }
  let retroSummary = null;
  const oldBaseLocation = user.base_reporting_location || "";
  const newBaseLocation = body.base_reporting_location;
  if (newBaseLocation !== void 0 && newBaseLocation !== oldBaseLocation) {
    try {
      retroSummary = await runRetroactivePolicyCheck(env, user, newBaseLocation, timestamp);
    } catch (e) {
      console.error("Retroactive policy check failed in handleUpdateUser:", e.message);
    }
  }
  const updatedUser = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(user.id).first();
  const roleRow = await env.DB.prepare("SELECT role FROM user_roles WHERE user_id = ?").bind(updatedUser.user_id).first();
  const result = { ...updatedUser, role: roleRow?.role || "user" };
  delete result.hashed_password;
  return jsonResponse6({
    ...result,
    ...retroSummary && retroSummary.affected_expenses > 0 ? {
      policy_adjustment: {
        message: `Base location policy applied. ${retroSummary.affected_expenses} expense(s) adjusted. Total deducted: \u20B9${retroSummary.total_deducted}.`,
        affected_expenses: retroSummary.affected_expenses,
        total_deducted: retroSummary.total_deducted
      }
    } : {}
  });
}
__name(handleUpdateUser, "handleUpdateUser");
async function handleGetEligibleApprovers(request, env, params, query, adminUser) {
  if (adminUser.role !== "Admin") {
    return jsonResponse6({ error: "Access denied" }, 403);
  }
  const users2 = await env.DB.prepare("SELECT * FROM users ORDER BY name ASC").all();
  const result = (users2.results || []).map((u) => {
    const o = { ...u };
    delete o.hashed_password;
    return o;
  });
  return jsonResponse6(result);
}
__name(handleGetEligibleApprovers, "handleGetEligibleApprovers");
async function handleDeleteHierarchy(request, env, params, query, adminUser) {
  if (adminUser.role !== "Admin") {
    return jsonResponse6({ error: "Access denied" }, 403);
  }
  const hierarchyId = parseInt(params.id, 10);
  if (!hierarchyId)
    return jsonResponse6({ error: "Invalid hierarchy ID" }, 400);
  const existing = await env.DB.prepare("SELECT 1 FROM approval_hierarchies WHERE id = ?").bind(hierarchyId).first();
  if (!existing)
    return jsonResponse6({ error: "Hierarchy not found" }, 404);
  await runWrite(env, "DELETE FROM hierarchy_approvers WHERE hierarchy_id = ?", [hierarchyId]);
  await runWrite(env, "DELETE FROM hierarchy_requesters WHERE hierarchy_id = ?", [hierarchyId]);
  await runWrite(env, "DELETE FROM approval_hierarchies WHERE id = ?", [hierarchyId]);
  return jsonResponse6({ status: "success", message: "Hierarchy deleted successfully" });
}
__name(handleDeleteHierarchy, "handleDeleteHierarchy");
async function handleLogoutAllUsers(request, env, params, query, adminUser) {
  if (adminUser.role !== "Admin") {
    return jsonResponse6({ error: "Access denied" }, 403);
  }
  await runWrite(env, "UPDATE users SET active_session_id = NULL", []);
  return jsonResponse6({ status: "success", message: "All users have been logged out" });
}
__name(handleLogoutAllUsers, "handleLogoutAllUsers");
async function handleLogoutSingleUser(request, env, params, query, adminUser) {
  if (adminUser.role !== "Admin") {
    return jsonResponse6({ error: "Access denied" }, 403);
  }
  const userCode = params.user_code;
  const user = await env.DB.prepare("SELECT 1 FROM users WHERE user_id = ?").bind(userCode).first();
  if (!user)
    return jsonResponse6({ error: "User not found" }, 404);
  await runWrite(env, "UPDATE users SET active_session_id = NULL WHERE user_id = ?", [userCode]);
  return jsonResponse6({ status: "success", message: `User ${userCode} has been logged out` });
}
__name(handleLogoutSingleUser, "handleLogoutSingleUser");
async function handleExportHierarchies(request, env, params, query, adminUser) {
  if (adminUser.role !== "Admin") {
    return jsonResponse6({ error: "Access denied" }, 403);
  }
  const hierarchiesRes = await env.DB.prepare("SELECT * FROM approval_hierarchies ORDER BY id ASC").all();
  const hierarchies = hierarchiesRes.results || [];
  const rows = [];
  rows.push(["hierarchy_name", "requester_e_codes", "level_1_approver", "level_2_approver", "level_3_approver", "level_4_approver", "level_5_approver"]);
  if (hierarchies.length === 0) {
    return jsonResponse6({ status: "success", rows });
  }
  const requestersRes = await env.DB.prepare(`
    SELECT hr.hierarchy_id, u.e_code, u.user_id FROM hierarchy_requesters hr
    JOIN users u ON hr.user_id = u.id
  `).all();
  const requesters = requestersRes.results || [];
  const requestersMap = {};
  for (const r of requesters) {
    if (!requestersMap[r.hierarchy_id]) {
      requestersMap[r.hierarchy_id] = [];
    }
    requestersMap[r.hierarchy_id].push(r);
  }
  const approversRes = await env.DB.prepare(`
    SELECT ha.hierarchy_id, ha.level_number, u.e_code, u.user_id FROM hierarchy_approvers ha
    JOIN users u ON ha.approver_id = u.id
  `).all();
  const approvers = approversRes.results || [];
  const approversMap = {};
  for (const a of approvers) {
    if (!approversMap[a.hierarchy_id]) {
      approversMap[a.hierarchy_id] = [];
    }
    approversMap[a.hierarchy_id].push(a);
  }
  for (const h of hierarchies) {
    const chainRequesters = requestersMap[h.id] || [];
    const chainApprovers = approversMap[h.id] || [];
    const reqCodes = chainRequesters.map((r) => r.e_code || r.user_id).join(",");
    const lvlApps = ["", "", "", "", ""];
    for (const a of chainApprovers) {
      if (a.level_number >= 1 && a.level_number <= 5) {
        lvlApps[a.level_number - 1] = a.e_code || a.user_id;
      }
    }
    rows.push([h.name || h.chain_name || "", reqCodes, ...lvlApps]);
  }
  return jsonResponse6({ status: "success", rows });
}
__name(handleExportHierarchies, "handleExportHierarchies");
async function handleBulkImportHierarchies(request, env, params, query, adminUser) {
  if (adminUser.role !== "Admin") {
    return jsonResponse6({ error: "Access denied" }, 403);
  }
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse6({ error: "Invalid JSON body" }, 400);
  }
  const rows = body.rows || [];
  if (!Array.isArray(rows) || rows.length === 0) {
    return jsonResponse6({ error: "No rows provided" }, 400);
  }
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
  let createdCount = 0;
  const errors = [];
  const allUsersRes = await env.DB.prepare("SELECT id, user_id, e_code FROM users").all();
  const userByECode = {};
  const userByUserId = {};
  for (const u of allUsersRes.results || []) {
    if (u.e_code)
      userByECode[u.e_code.toLowerCase()] = u;
    if (u.user_id)
      userByUserId[u.user_id.toLowerCase()] = u;
  }
  const findUser = /* @__PURE__ */ __name((code) => {
    if (!code)
      return null;
    const cl = code.trim().toLowerCase();
    return userByECode[cl] || userByUserId[cl] || null;
  }, "findUser");
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const hierarchyName = String(row.hierarchy_name || "").trim();
    if (!hierarchyName) {
      errors.push(`Row ${i + 1}: Missing hierarchy_name`);
      continue;
    }
    try {
      let existingH = await env.DB.prepare("SELECT id FROM approval_hierarchies WHERE name = ?").bind(hierarchyName).first();
      let hId;
      if (existingH) {
        hId = existingH.id;
        await runWrite(env, "DELETE FROM hierarchy_requesters WHERE hierarchy_id = ?", [hId]);
        await runWrite(env, "DELETE FROM hierarchy_approvers WHERE hierarchy_id = ?", [hId]);
      } else {
        const hResult = await runWrite(env, "INSERT INTO approval_hierarchies (name) VALUES (?)", [hierarchyName]);
        hId = hResult.meta?.last_row_id;
        if (!hId)
          throw new Error("Failed to create hierarchy");
      }
      const requesterCodes = String(row.requester_e_codes || "").split(",").map((s) => s.trim()).filter(Boolean);
      for (const code of requesterCodes) {
        const u = findUser(code);
        if (u) {
          await runWrite(env, "INSERT INTO hierarchy_requesters (hierarchy_id, user_id) VALUES (?, ?)", [hId, u.id]);
        }
      }
      for (let lvl = 1; lvl <= 5; lvl++) {
        const approverCode = row[`level_${lvl}_approver`];
        if (!approverCode)
          continue;
        const u = findUser(String(approverCode).trim());
        if (u) {
          await runWrite(env, "INSERT INTO hierarchy_approvers (hierarchy_id, level_number, approver_id) VALUES (?, ?, ?)", [hId, lvl, u.id]);
        }
      }
      createdCount++;
    } catch (ex) {
      errors.push(`Row ${i + 1} (${hierarchyName}): ${ex.message}`);
    }
  }
  return jsonResponse6({ status: "success", created_count: createdCount, failed_count: errors.length, errors });
}
__name(handleBulkImportHierarchies, "handleBulkImportHierarchies");
async function handleGetSystemSettings(request, env, params, query, adminUser) {
  if (adminUser.role !== "Admin") {
    return jsonResponse6({ error: "Access denied" }, 403);
  }
  try {
    const rowsRes = await env.DB.prepare("SELECT * FROM system_settings").all();
    const rows = rowsRes.results || [];
    const settings = {};
    for (const r of rows) {
      settings[r.key] = r.value;
    }
    return jsonResponse6({ success: true, settings });
  } catch (err) {
    return jsonResponse6({ error: "Failed to fetch settings", detail: err.message }, 500);
  }
}
__name(handleGetSystemSettings, "handleGetSystemSettings");
async function handleSaveSystemSettings(request, env, params, query, adminUser) {
  if (adminUser.role !== "Admin") {
    return jsonResponse6({ error: "Access denied" }, 403);
  }
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse6({ error: "Invalid JSON body" }, 400);
  }
  const settings = body.settings || {};
  const statements = [];
  for (const [key, value] of Object.entries(settings)) {
    statements.push({
      sql: "INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)",
      params: [key, String(value)]
    });
  }
  try {
    if (statements.length > 0) {
      await runBatchWrite(env, statements);
    }
    return jsonResponse6({ success: true, message: "Settings saved successfully" });
  } catch (err) {
    return jsonResponse6({ error: "Failed to save settings", detail: err.message }, 500);
  }
}
__name(handleSaveSystemSettings, "handleSaveSystemSettings");
async function handleSearchRejectedExpenses(request, env, params, query, adminUser) {
  if (adminUser.role !== "Admin") {
    return jsonResponse6({ error: "Access denied" }, 403);
  }
  const search = (query.get("search") || "").trim().toLowerCase();
  try {
    let sql2 = `
      SELECT e.id, e.expense_code, e.amount, e.status, e.itinerary as expense_date, e.description, 
             u.name as employee_name, u.user_id as employee_code
      FROM expenses e
      JOIN users u ON e.user_id = u.id
      WHERE e.status = 'rejected'
    `;
    const bindParams = [];
    if (search) {
      sql2 += ` AND (LOWER(e.expense_code) LIKE ? OR LOWER(u.name) LIKE ? OR LOWER(u.user_id) LIKE ?)`;
      const term = `%${search}%`;
      bindParams.push(term, term, term);
    }
    sql2 += ` ORDER BY e.itinerary DESC, e.id DESC`;
    const results = await env.DB.prepare(sql2).bind(...bindParams).all();
    return jsonResponse6({ success: true, data: results.results || [] });
  } catch (err) {
    return jsonResponse6({ error: "Failed to retrieve rejected expenses", detail: err.message }, 500);
  }
}
__name(handleSearchRejectedExpenses, "handleSearchRejectedExpenses");
async function handleResubmitRejectedExpense(request, env, params, query, adminUser) {
  if (adminUser.role !== "Admin") {
    return jsonResponse6({ error: "Access denied" }, 403);
  }
  const expenseId = parseInt(params.expense_id, 10);
  if (!expenseId) {
    return jsonResponse6({ error: "Invalid expense ID" }, 400);
  }
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
  const expense = await env.DB.prepare("SELECT * FROM expenses WHERE id = ?").bind(expenseId).first();
  if (!expense) {
    return jsonResponse6({ error: "Expense claim not found" }, 404);
  }
  if (expense.status !== "rejected") {
    return jsonResponse6({ error: "Only rejected expense claims can be re-submitted" }, 400);
  }
  const approvalChain = await env.DB.prepare(`
    SELECT a.* 
    FROM hierarchy_approvers a
    JOIN hierarchy_requesters hr ON a.hierarchy_id = hr.hierarchy_id
    WHERE hr.user_id = ?
    ORDER BY a.level_number ASC
  `).bind(expense.user_id).all();
  const approvals2 = approvalChain.results || [];
  if (approvals2.length === 0) {
    return jsonResponse6({ error: "This employee is not mapped to any approval hierarchy team. Cannot route for approval." }, 400);
  }
  const statements = [];
  statements.push({
    sql: "UPDATE expenses SET status = 'submitted', updated_at = ? WHERE id = ?",
    params: [timestamp, expenseId]
  });
  statements.push({
    sql: "DELETE FROM approvals WHERE expense_id = ?",
    params: [expenseId]
  });
  for (const step of approvals2) {
    statements.push({
      sql: `INSERT INTO approvals (expense_id, approver_id, level_number, status, comments, created_at, updated_at)
            VALUES (?, ?, ?, ?, '', ?, ?)`,
      params: [
        expenseId,
        step.approver_id,
        step.level_number,
        step.level_number === 1 ? "pending" : "waiting",
        timestamp,
        timestamp
      ]
    });
  }
  try {
    await runBatchWrite(env, statements);
    const creatorUser = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(expense.user_id).first();
    const firstApproverUser = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(approvals2[0].approver_id).first();
    if (creatorUser) {
      await runWrite(env, "INSERT INTO notifications (user_id, title, description, type, read, link, created_at) VALUES (?, '\u{1F504} Claim Reset to Submitted', ?, 'info', 0, '/home', ?)", [
        creatorUser.user_id,
        `Your rejected claim ${expense.expense_code} has been reset to Submitted by the administrator.`,
        timestamp
      ]);
    }
    if (firstApproverUser) {
      await runWrite(env, "INSERT INTO notifications (user_id, title, description, type, read, link, created_at) VALUES (?, '\u{1F4E5} New Claim for Approval (Reset)', ?, 'warning', 0, '/approval-center', ?)", [
        firstApproverUser.user_id,
        `Claim ${expense.expense_code} (\u20B9${expense.amount}) has been reset by the Admin and is pending your review.`,
        timestamp
      ]);
    }
    return jsonResponse6({ success: true, message: "Expense claim status reset to Submitted successfully." });
  } catch (err) {
    return jsonResponse6({ error: "Failed to resubmit expense claim", detail: err.message }, 500);
  }
}
__name(handleResubmitRejectedExpense, "handleResubmitRejectedExpense");
async function handleOneTimeAdjust(request, env, params, query, adminUser) {
  if (adminUser.role !== "Admin") {
    return jsonResponse6({ error: "Access denied" }, 403);
  }
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
  await env.DB.prepare(`
    UPDATE users 
    SET base_reporting_location = 'District Sahadat Hospital Tonk DH' 
    WHERE name = 'Shahrukh Ali' AND (base_reporting_location IS NULL OR base_reporting_location = '')
  `).run().catch(() => null);
  const diagTotalUsers = await env.DB.prepare("SELECT COUNT(*) as count FROM users").first().then((r) => r?.count).catch(() => 0);
  const diagMappedUsers = await env.DB.prepare("SELECT COUNT(*) as count FROM users WHERE base_reporting_location IS NOT NULL AND base_reporting_location != ''").first().then((r) => r?.count).catch(() => 0);
  const diagJulyClaims = await env.DB.prepare("SELECT COUNT(*) as count FROM expenses WHERE LOWER(month) = 'july' AND year = 2026").first().then((r) => r?.count).catch(() => 0);
  const idsToTrace = [9, 39, 40, 41, 894];
  const traceResults = [];
  for (const id of idsToTrace) {
    const exp = await env.DB.prepare("SELECT * FROM expenses WHERE id = ? OR expense_code LIKE ?").bind(id, `%-${String(id).padStart(6, "0")}`).first().catch(() => null);
    if (exp) {
      const userRec = await env.DB.prepare("SELECT name, base_reporting_location FROM users WHERE id = ? OR user_id = ?").bind(exp.user_id, exp.user_id).first().catch(() => null);
      const userStr = userRec ? `${userRec.name} (Base:${userRec.base_reporting_location})` : `User:${exp.user_id}`;
      const legs = await env.DB.prepare("SELECT * FROM expense_itineraries WHERE exp_id = ?").bind(exp.expense_code).all().catch(() => ({ results: [] }));
      const legDetails = (legs.results || []).map((l) => `${l.leg_number}:${l.from_location}->${l.to_location}(TA=${l.travel_amount},Sub=${l.sub_amount},DA=${l.da_amount},fDist=${l.from_district},tDist=${l.to_district})`).join(" | ");
      traceResults.push(`ID ${id} (${exp.expense_code}, ${userStr}): Month:${exp.month}, Amount:${exp.amount}, Legs:[${legDetails}]`);
    } else {
      traceResults.push(`ID ${id} not found`);
    }
  }
  const allUsersDb = await env.DB.prepare("SELECT id, user_id, name, base_reporting_location FROM users").all().catch(() => ({ results: [] }));
  const userListStr = (allUsersDb.results || []).map((u) => `${u.name}(Base:${u.base_reporting_location},UID:${u.user_id})`).join(" | ");
  const exp894Trace = traceResults.join(" || ") + " || USERS: " + userListStr;
  const diagSampleMonths = await env.DB.prepare("SELECT DISTINCT month, year FROM expenses LIMIT 5").all().then((r) => (r.results || []).map((x) => `${x.month} ${x.year}`).join(", ")).catch(() => "error");
  const diagSampleBases = await env.DB.prepare("SELECT DISTINCT base_reporting_location FROM users WHERE base_reporting_location IS NOT NULL AND base_reporting_location != '' LIMIT 5").all().then((r) => (r.results || []).map((x) => x.base_reporting_location).join(", ")).catch(() => "error");
  const diagSampleExpenses = await env.DB.prepare("SELECT user_id, COUNT(*) as count FROM expenses WHERE LOWER(month) = 'july' AND year = 2026 GROUP BY user_id LIMIT 5").all().catch(() => ({ results: [] }));
  const sampleExpenseUserIds = (diagSampleExpenses.results || []).map((x) => `${typeof x.user_id}:${x.user_id} (${x.count} claims)`).join(", ");
  const hospitalsRes = await env.DB.prepare("SELECT DISTINCT hospital_name FROM assets_inventory WHERE hospital_name IS NOT NULL").all().catch(() => ({ results: [] }));
  const officialHospitals = new Set((hospitalsRes.results || []).map((h) => h.hospital_name.trim().toLowerCase()));
  const usersRes = await env.DB.prepare(`
    SELECT id, user_id, name, base_reporting_location FROM users
    WHERE base_reporting_location IS NOT NULL AND base_reporting_location != ''
  `).all().catch(() => ({ results: [] }));
  const users2 = usersRes.results || [];
  const diagSampleUsers = users2.slice(0, 5).map((x) => `id=${typeof x.id}:${x.id}, user_id=${typeof x.user_id}:${x.user_id}`).join(", ");
  if (users2.length === 0) {
    return jsonResponse6({
      success: true,
      message: `No users found with mapped base locations. (Total users in DB: ${diagTotalUsers}, Mapped: ${diagMappedUsers}).`,
      adjusted: [],
      diagnostics: { diagTotalUsers, diagMappedUsers, diagJulyClaims, diagSampleMonths, diagSampleBases }
    });
  }
  const adjustedUsers = [];
  let totalExpensesAdjusted = 0;
  let totalDeductionsAmount = 0;
  const traceLogs = [];
  for (const user of users2) {
    try {
      const summary = await runRetroactivePolicyCheck(env, user, user.base_reporting_location, timestamp);
      if (summary && summary.affected_expenses > 0) {
        adjustedUsers.push({
          user_id: user.user_id,
          name: user.name,
          base_reporting_location: user.base_reporting_location,
          affected_expenses: summary.affected_expenses,
          total_deducted: summary.total_deducted
        });
        totalExpensesAdjusted += summary.affected_expenses;
        totalDeductionsAmount += summary.total_deducted;
      }
      if (traceLogs.length < 3) {
        const expensesRes = await env.DB.prepare(`
          SELECT id, expense_code, itinerary, amount, original_amount, da_amount
          FROM expenses
          WHERE user_id = ? AND LOWER(month) = 'july' AND year = 2026
            AND LOWER(status) NOT IN ('rejected', 'returned_to_draft')
        `).bind(user.id).all().catch(() => ({ results: [] }));
        const exps = expensesRes.results || [];
        for (const exp of exps.slice(0, 1)) {
          const legsRes = await env.DB.prepare(`
            SELECT itinerary_id, leg_number, from_location, to_location, travel_mode, sub_mode,
              distance_km, travel_amount, sub_amount, da_amount, hotel_amount, local_purchase,
              other_amount, from_district, to_district
            FROM expense_itineraries WHERE exp_id = ? ORDER BY leg_number ASC
          `).bind(exp.expense_code).all().catch(() => ({ results: [] }));
          const rawLegs = legsRes.results || [];
          const legs = rawLegs.map((leg) => {
            const fromLoc = (leg.from_location || "").trim().toLowerCase();
            const toLoc = (leg.to_location || "").trim().toLowerCase();
            const fromDist = (leg.from_district || "").trim().toLowerCase();
            const toDist = (leg.to_district || "").trim().toLowerCase();
            const isOutdoor = fromDist && toDist && fromDist !== toDist;
            const travelType = isOutdoor ? "Outdoor" : "In-District";
            const fromCustom = fromLoc && !officialHospitals.has(fromLoc);
            const toCustom = toLoc && !officialHospitals.has(toLoc);
            return {
              ...leg,
              from: leg.from_location || "",
              to: leg.to_location || "",
              from_custom: fromCustom,
              to_custom: toCustom,
              amount: leg.travel_amount,
              sub_amount: leg.sub_amount,
              da: leg.da_amount,
              travel_type: travelType
            };
          });
          const { isBaseLocOnly, isDaAllowed } = computeBaseLocPolicy(
            user.base_reporting_location,
            legs
          );
          const legLocs = legs.map((l) => `${l.from_location}->${l.to_location} (${l.travel_type})`).join(" | ");
          traceLogs.push(`${user.name}(Base:${user.base_reporting_location}): code:${exp.expense_code} legs:[${legLocs}] isBaseOnly:${isBaseLocOnly} isDa:${isDaAllowed}`);
        }
      }
    } catch (e) {
      console.error(`One-time adjust failed for user ${user.user_id}:`, e.message);
      traceLogs.push(`${user.name} ERROR: ${e.message}`);
    }
  }
  const diagTrace = traceLogs.join(" | ");
  const diagMsg = `Trace: [${diagTrace}]. July Claims: ${diagJulyClaims}. Exp894: [${exp894Trace}].`;
  return jsonResponse6({
    success: true,
    message: `One-time adjustment complete. Adjusted ${totalExpensesAdjusted} claims across ${adjustedUsers.length} users. Total deducted: \u20B9${totalDeductionsAmount.toFixed(2)}. Details: ${diagMsg}`,
    summary: {
      total_users_checked: users2.length,
      total_users_adjusted: adjustedUsers.length,
      total_expenses_adjusted: totalExpensesAdjusted,
      total_deducted: totalDeductionsAmount,
      details: adjustedUsers,
      diagnostics: { diagTotalUsers, diagMappedUsers, diagJulyClaims, diagSampleMonths, diagSampleBases, diagSampleUsers, sampleExpenseUserIds, diagTrace }
    }
  });
}
__name(handleOneTimeAdjust, "handleOneTimeAdjust");

// src/routes/ticket.js
function jsonResponse7(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
__name(jsonResponse7, "jsonResponse");
async function checkAndAutoCloseTickets(env) {
  const db = getDrizzleDb(env);
  const limitTime = new Date(Date.now() - 36 * 60 * 60 * 1e3).toISOString();
  await db.update(supportTickets).set({ status: "Final Closed" }).where(and(
    eq(supportTickets.status, "Closed"),
    isNotNull(supportTickets.closedAt),
    lt(supportTickets.closedAt, limitTime)
  ));
}
__name(checkAndAutoCloseTickets, "checkAndAutoCloseTickets");
async function handleGetTickets(request, env, params, query, user) {
  await checkAndAutoCloseTickets(env);
  const db = getDrizzleDb(env, request);
  let results;
  if (user.role === "Admin") {
    results = await db.select().from(supportTickets).orderBy(desc(supportTickets.createdAt));
  } else {
    results = await db.select().from(supportTickets).where(or(
      eq(supportTickets.createdByCode, user.user_id),
      eq(supportTickets.assignedToName, user.name),
      eq(supportTickets.assignedToRole, user.role)
    )).orderBy(desc(supportTickets.createdAt));
  }
  return jsonResponse7(results);
}
__name(handleGetTickets, "handleGetTickets");
async function handleCreateTicket(request, env, params, query, user) {
  const db = getDrizzleDb(env, request);
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse7({ error: "Invalid JSON body" }, 400);
  }
  const { concern_type, expense_id, expense_code, priority, description, assigned_to_name } = body;
  if (!concern_type || !description) {
    return jsonResponse7({ error: "concern_type and description are required" }, 400);
  }
  let assignedRole = "Admin";
  let assignedName = "Admin System";
  if (concern_type !== "Profile") {
    assignedName = (assigned_to_name || "").trim();
    const [assignedUser] = await db.select().from(users).where(eq(users.name, assignedName)).limit(1);
    if (!assignedUser) {
      return jsonResponse7({ error: `Assigned staff '${assignedName}' not found.` }, 404);
    }
    assignedRole = assignedUser.role;
  }
  const todayStr = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10).replace(/-/g, "");
  const [countResult] = await db.select({
    cnt: sql`COUNT(*)`
  }).from(supportTickets).where(like(supportTickets.ticketCode, `TKT-${todayStr}-%`));
  const count = countResult?.cnt || 0;
  const ticketCode = `TKT-${todayStr}-${String(count + 1).padStart(4, "0")}`;
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
  await db.insert(supportTickets).values({
    ticketCode,
    createdById: user.id,
    createdByName: user.name,
    createdByCode: user.user_id,
    concernType: concern_type,
    expenseId: expense_id || null,
    expenseCode: expense_code || null,
    priority: priority || "Medium",
    description: description.trim(),
    assignedToRole: assignedRole,
    assignedToName: assignedName,
    status: "Open",
    comments: "",
    createdAt: timestamp,
    updatedAt: timestamp
  });
  const [created] = await db.select().from(supportTickets).where(eq(supportTickets.ticketCode, ticketCode)).limit(1);
  return jsonResponse7(created, 201);
}
__name(handleCreateTicket, "handleCreateTicket");
async function handleAddComment(request, env, params, query, user) {
  const db = getDrizzleDb(env, request);
  const ticketId = parseInt(params.ticket_id, 10);
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse7({ error: "Invalid JSON body" }, 400);
  }
  const { comment } = body;
  if (!comment || !comment.trim()) {
    return jsonResponse7({ error: "Comment text is required" }, 400);
  }
  const [ticket] = await db.select().from(supportTickets).where(eq(supportTickets.id, ticketId)).limit(1);
  if (!ticket)
    return jsonResponse7({ error: "Ticket not found" }, 404);
  const isCreator = ticket.createdByCode === user.user_id;
  const isAssignee = ticket.assignedToName === user.name;
  const isAdmin = user.role === "Admin";
  const isSupervisor = ["Manager", "Coordinator", "Project Head", "VP", "Division Manager"].includes(user.role);
  if (!(isCreator || isAssignee || isAdmin || isSupervisor)) {
    return jsonResponse7({ error: "Not authorized to comment on this ticket" }, 403);
  }
  if (ticket.status === "Closed" && ticket.closedAt) {
    const closedTime = new Date(ticket.closedAt).getTime();
    if (Date.now() - closedTime > 36 * 60 * 60 * 1e3) {
      await db.update(supportTickets).set({ status: "Final Closed" }).where(eq(supportTickets.id, ticketId));
      return jsonResponse7({ error: "Ticket is final closed and cannot be modified." }, 400);
    }
  }
  const dateOptions = { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false };
  const nowStr = (/* @__PURE__ */ new Date()).toLocaleString("en-GB", dateOptions).replace(/,/g, "");
  const logEntry = `${user.name} (${nowStr}): ${comment.trim()}`;
  const newComments = ticket.comments ? `${ticket.comments}
${logEntry}` : logEntry;
  let newStatus = ticket.status;
  if (isAssignee && ticket.status === "Open") {
    newStatus = "Updated";
  }
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
  await db.update(supportTickets).set({
    comments: newComments,
    status: newStatus,
    updatedAt: timestamp
  }).where(eq(supportTickets.id, ticketId));
  const [updated] = await db.select().from(supportTickets).where(eq(supportTickets.id, ticketId)).limit(1);
  return jsonResponse7(updated);
}
__name(handleAddComment, "handleAddComment");
async function handleCloseTicket(request, env, params, query, user) {
  const db = getDrizzleDb(env, request);
  const ticketId = parseInt(params.ticket_id, 10);
  const [ticket] = await db.select().from(supportTickets).where(eq(supportTickets.id, ticketId)).limit(1);
  if (!ticket)
    return jsonResponse7({ error: "Ticket not found" }, 404);
  const isCreator = ticket.createdByCode === user.user_id;
  const isAssignee = ticket.assignedToName === user.name;
  const isAdmin = user.role === "Admin";
  if (!(isCreator || isAssignee || isAdmin)) {
    return jsonResponse7({ error: "Not authorized to close this ticket" }, 403);
  }
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
  await db.update(supportTickets).set({
    status: "Closed",
    closedAt: timestamp,
    updatedAt: timestamp
  }).where(eq(supportTickets.id, ticketId));
  const [updated] = await db.select().from(supportTickets).where(eq(supportTickets.id, ticketId)).limit(1);
  return jsonResponse7(updated);
}
__name(handleCloseTicket, "handleCloseTicket");
async function handleReopenTicket(request, env, params, query, user) {
  const db = getDrizzleDb(env, request);
  const ticketId = parseInt(params.ticket_id, 10);
  const [ticket] = await db.select().from(supportTickets).where(eq(supportTickets.id, ticketId)).limit(1);
  if (!ticket)
    return jsonResponse7({ error: "Ticket not found" }, 404);
  if (ticket.createdByCode !== user.user_id) {
    return jsonResponse7({ error: "Only the ticket creator can reopen it." }, 403);
  }
  if (ticket.status !== "Closed") {
    return jsonResponse7({ error: "Only 'Closed' tickets can be reopened." }, 400);
  }
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
  if (ticket.closedAt) {
    const closedTime = new Date(ticket.closedAt).getTime();
    if (Date.now() - closedTime > 36 * 60 * 60 * 1e3) {
      await db.update(supportTickets).set({ status: "Final Closed", updatedAt: timestamp }).where(eq(supportTickets.id, ticketId));
      return jsonResponse7({ error: "Ticket was closed more than 36 hours ago and is now Final Closed." }, 400);
    }
  }
  await db.update(supportTickets).set({
    status: "Re-opened",
    closedAt: null,
    updatedAt: timestamp
  }).where(eq(supportTickets.id, ticketId));
  const [updated] = await db.select().from(supportTickets).where(eq(supportTickets.id, ticketId)).limit(1);
  return jsonResponse7(updated);
}
__name(handleReopenTicket, "handleReopenTicket");
async function handleToggleFollowup(request, env, params, query, user) {
  const db = getDrizzleDb(env, request);
  const ticketId = parseInt(params.ticket_id, 10);
  const [ticket] = await db.select().from(supportTickets).where(eq(supportTickets.id, ticketId)).limit(1);
  if (!ticket)
    return jsonResponse7({ error: "Ticket not found" }, 404);
  const isCreator = ticket.createdByCode === user.user_id;
  const isAssignee = ticket.assignedToName === user.name;
  const isAdmin = user.role === "Admin";
  if (!(isCreator || isAssignee || isAdmin)) {
    return jsonResponse7({ error: "Not authorized to toggle followup on this ticket." }, 403);
  }
  const newFollowup = ticket.needsFollowup ? 0 : 1;
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
  await db.update(supportTickets).set({
    needsFollowup: newFollowup,
    updatedAt: timestamp
  }).where(eq(supportTickets.id, ticketId));
  const [updated] = await db.select().from(supportTickets).where(eq(supportTickets.id, ticketId)).limit(1);
  return jsonResponse7(updated);
}
__name(handleToggleFollowup, "handleToggleFollowup");

// src/routes/reports.js
function jsonResponse8(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
__name(jsonResponse8, "jsonResponse");
async function handleGetMisDashboard(request, env, params, query, user) {
  const zone = query.get("zone");
  const district = query.get("district");
  const coordinator = query.get("coordinator");
  const month = query.get("month");
  const equipment = query.get("equipment");
  const tableCheck = await env.DB.prepare(`
    SELECT name FROM sqlite_master WHERE type='table' AND name='rj_penalties'
  `).first();
  if (!tableCheck) {
    return jsonResponse8({
      success: false,
      message: "Penalty database not seeded yet.",
      summary: {}
    });
  }
  let userZone = zone;
  let userDistrict = district;
  let userCoordinator = coordinator;
  const role = (user.role || "").trim();
  if (role === "Zonal Manager") {
    userZone = user.zone;
  } else if (role === "Coordinator") {
    userCoordinator = user.name;
  } else if (role === "Engineer") {
    userDistrict = user.district;
  }
  if (userZone) {
    userZone = userZone.replace(" Zone", "").trim();
  }
  const whereClauses = ["1=1"];
  const bindings = [];
  if (userDistrict) {
    whereClauses.push("LOWER(district_name) = LOWER(?)");
    bindings.push(userDistrict);
  }
  if (userCoordinator) {
    whereClauses.push("LOWER(coordinator_name) = LOWER(?)");
    bindings.push(userCoordinator);
  }
  if (month) {
    whereClauses.push("month_text = ?");
    bindings.push(month);
  }
  if (equipment) {
    whereClauses.push("equipment_name = ?");
    bindings.push(equipment);
  }
  if (userZone) {
    const zoneSql = `
      CASE 
        WHEN district_name IN ('Ajmer', 'Bhilwara', 'Nagaur', 'Tonk', 'Beawer', 'Kekri', 'Shahpura') THEN 'Ajmer'
        WHEN district_name IN ('Jaipur', 'Alwar', 'Dausa', 'Jhunjhunu', 'Sikar', 'Dudu', 'Kotputli', 'Neem Ka Thana', 'Khairthal') THEN 'Jaipur'
        WHEN district_name IN ('Jodhpur', 'Barmer', 'Jaisalmer', 'Jalore', 'Pali', 'Sirohi', 'Phalodi', 'Balotra', 'Sanchore') THEN 'Jodhpur'
        WHEN district_name IN ('Bikaner', 'Churu', 'Hanumangarh', 'Sri Ganganagar', 'Ganganagar', 'Anupgarh') THEN 'Bikaner'
        WHEN district_name IN ('Kota', 'Baran', 'Bundi', 'Jhalawar') THEN 'Kota'
        WHEN district_name IN ('Udaipur', 'Banswara', 'Chittorgarh', 'Dungarpur', 'Rajsamand', 'Pratapgarh', 'Salumbar') THEN 'Udaipur'
        ELSE 'Other'
      END
    `;
    whereClauses.push(`LOWER(${zoneSql}) = LOWER(?)`);
    bindings.push(userZone);
  }
  const whereStr = whereClauses.join(" AND ");
  const [districts, coordinators, months, summary] = await Promise.all([
    env.DB.prepare(`
      SELECT DISTINCT district_name FROM rj_penalties WHERE ${whereStr} AND district_name IS NOT NULL AND district_name != '' ORDER BY district_name
    `).bind(...bindings).all(),
    env.DB.prepare(`
      SELECT DISTINCT coordinator_name FROM rj_penalties WHERE ${whereStr} AND coordinator_name IS NOT NULL AND coordinator_name != '' ORDER BY coordinator_name
    `).bind(...bindings).all(),
    env.DB.prepare(`
      SELECT DISTINCT month_text FROM rj_penalties WHERE ${whereStr} AND month_text IS NOT NULL AND month_text != '' ORDER BY month_text
    `).bind(...bindings).all(),
    env.DB.prepare(`
      SELECT 
        SUM(CAST(total_penalty AS REAL)) as total_penalty,
        COUNT(DISTINCT district_name) as districts_count,
        COUNT(DISTINCT hospital_name) as hospitals_count,
        COUNT(*) as total_records
      FROM rj_penalties
      WHERE ${whereStr}
    `).bind(...bindings).first()
  ]);
  return jsonResponse8({
    success: true,
    summary: {
      total_penalty: summary?.total_penalty || 0,
      districts_count: summary?.districts_count || 0,
      hospitals_count: summary?.hospitals_count || 0,
      total_records: summary?.total_records || 0
    },
    filters: {
      districts: districts.results.map((r) => r.district_name),
      coordinators: coordinators.results.map((r) => r.coordinator_name),
      months: months.results.map((r) => r.month_text)
    }
  });
}
__name(handleGetMisDashboard, "handleGetMisDashboard");
async function handleGetAssetsInventory(request, env, params, query, user) {
  const district = query.get("district");
  const hospital = query.get("hospital");
  const zone = query.get("zone");
  const di = query.get("di");
  const month = query.get("month");
  const statusFilter = query.get("equipment_status");
  const search = query.get("search");
  const page = parseInt(query.get("page") || "1", 10);
  const pageSize = parseInt(query.get("page_size") || "100", 10);
  const whereClauses = ["1=1"];
  const bindings = [];
  if (district) {
    whereClauses.push("district_name = ?");
    bindings.push(district);
  }
  if (hospital) {
    whereClauses.push("hospital_name = ?");
    bindings.push(hospital);
  }
  if (zone) {
    whereClauses.push("zone_name = ?");
    bindings.push(zone);
  }
  if (di) {
    whereClauses.push("di_name = ?");
    bindings.push(di);
  }
  if (statusFilter) {
    whereClauses.push("equipment_status = ?");
    bindings.push(statusFilter);
  }
  if (month) {
    const parts = month.split("-");
    if (parts.length === 2) {
      whereClauses.push("is_verified = 1 AND moic_year = ? AND moic_month = ?");
      bindings.push(parseInt(parts[0], 10), parseInt(parts[1], 10));
    }
  }
  if (search) {
    whereClauses.push("(equipment_name LIKE ? OR qr_code LIKE ? OR serial_no LIKE ? OR hospital_name LIKE ?)");
    const searchPattern = `%${search.trim()}%`;
    bindings.push(searchPattern, searchPattern, searchPattern, searchPattern);
  }
  const whereSql = whereClauses.join(" AND ");
  const countResult = await env.DB.prepare(`
    SELECT COUNT(*) as cnt FROM assets_inventory WHERE ${whereSql}
  `).bind(...bindings).first();
  const total = countResult?.cnt || 0;
  const offset = (page - 1) * pageSize;
  const limitBindings = [...bindings, pageSize, offset];
  const listResult = await env.DB.prepare(`
    SELECT * FROM assets_inventory 
    WHERE ${whereSql} 
    ORDER BY id DESC 
    LIMIT ? OFFSET ?
  `).bind(...limitBindings).all();
  return jsonResponse8({
    success: true,
    total,
    page,
    page_size: pageSize,
    assets: listResult.results || []
  });
}
__name(handleGetAssetsInventory, "handleGetAssetsInventory");
async function handleGetAssetsFilters(request, env, params, query, user) {
  const combRows = await env.DB.prepare(`
    SELECT DISTINCT zone_name, district_name, di_name 
    FROM assets_inventory 
    WHERE zone_name IS NOT NULL AND zone_name != ''
  `).all();
  const validRajasthanZones = /* @__PURE__ */ new Set(["Ajmer", "Bikaner", "Jaipur", "Jodhpur", "Kota", "Udaipur", "Bharatpur"]);
  const combinations = [];
  const zonesSet = /* @__PURE__ */ new Set();
  const districtsSet = /* @__PURE__ */ new Set();
  const diNamesSet = /* @__PURE__ */ new Set();
  for (const row of combRows.results || []) {
    const zClean = (row.zone_name || "").trim();
    let matchedZone = null;
    for (const rz of validRajasthanZones) {
      if (zClean.toLowerCase().includes(rz.toLowerCase())) {
        matchedZone = rz;
        break;
      }
    }
    if (matchedZone) {
      zonesSet.add(matchedZone);
      districtsSet.add((row.district_name || "").trim());
      diNamesSet.add((row.di_name || "").trim());
      combinations.push({
        zone: matchedZone,
        district: (row.district_name || "").trim(),
        di: (row.di_name || "").trim()
      });
    }
  }
  const monthRows = await env.DB.prepare(`
    SELECT DISTINCT moic_year, moic_month 
    FROM assets_inventory 
    WHERE is_verified = 1 AND moic_year IS NOT NULL AND moic_month IS NOT NULL
    ORDER BY moic_year DESC, moic_month DESC
  `).all();
  const months = (monthRows.results || []).map((r) => `${r.moic_year}-${String(r.moic_month).padStart(2, "0")}`);
  return jsonResponse8({
    success: true,
    zones: Array.from(zonesSet).sort(),
    districts: Array.from(districtsSet).sort(),
    di_names: Array.from(diNamesSet).sort(),
    months,
    combinations
  });
}
__name(handleGetAssetsFilters, "handleGetAssetsFilters");
async function handleGetAssetsStats(request, env, params, query, user) {
  const zone = query.get("zone");
  const district = query.get("district");
  const di = query.get("di");
  const month = query.get("month");
  const whereClauses = ["1=1"];
  const bindings = [];
  if (zone) {
    whereClauses.push("zone_name = ?");
    bindings.push(zone);
  }
  if (district) {
    whereClauses.push("district_name = ?");
    bindings.push(district);
  }
  if (di) {
    whereClauses.push("di_name = ?");
    bindings.push(di);
  }
  const whereSql = whereClauses.join(" AND ");
  const now = /* @__PURE__ */ new Date();
  let targetYear = now.getFullYear();
  let targetMonth = now.getMonth() + 1;
  if (month) {
    const parts = month.split("-");
    if (parts.length === 2) {
      targetYear = parseInt(parts[0], 10);
      targetMonth = parseInt(parts[1], 10);
    }
  }
  const [aggRes, arrearRows, statusRows, typeRows, warrantyRows] = await Promise.all([
    env.DB.prepare(`
      SELECT 
        COUNT(*) as total_equipment,
        SUM(is_verified) as verified_equipment,
        SUM(CASE WHEN warranty_expired = 0 THEN 1 ELSE 0 END) as under_warranty,
        SUM(warranty_expired) as out_of_warranty,
        SUM(parsed_asset_value) as total_value,
        SUM(CASE WHEN is_verified = 1 THEN parsed_asset_value ELSE 0 END) as verified_value,
        SUM(CASE WHEN is_verified = 1 AND warranty_expired = 1 THEN parsed_asset_value ELSE 0 END) as verified_out_of_warranty_value
      FROM assets_inventory
      WHERE ${whereSql}
    `).bind(...bindings).first(),
    env.DB.prepare(`
      SELECT parsed_asset_value, install_year, install_month
      FROM assets_inventory
      WHERE is_verified = 1 
        AND moic_year = ? 
        AND moic_month = ?
        AND ${whereSql}
    `).bind(targetYear, targetMonth, ...bindings).all(),
    env.DB.prepare(`
      SELECT equipment_status, COUNT(*) as cnt 
      FROM assets_inventory 
      WHERE ${whereSql} 
      GROUP BY equipment_status
    `).bind(...bindings).all(),
    env.DB.prepare(`
      SELECT equipment_type, COUNT(*) as cnt 
      FROM assets_inventory 
      WHERE ${whereSql} 
      GROUP BY equipment_type 
      ORDER BY cnt DESC 
      LIMIT 5
    `).bind(...bindings).all(),
    env.DB.prepare(`
      SELECT warranty_expired, COUNT(*) as cnt 
      FROM assets_inventory 
      WHERE ${whereSql} 
      GROUP BY warranty_expired
    `).bind(...bindings).all()
  ]);
  const total_equipment = aggRes?.total_equipment || 0;
  const verified_count = aggRes?.verified_equipment || 0;
  const under_warranty_count = aggRes?.under_warranty || 0;
  const out_of_warranty_count = aggRes?.out_of_warranty || 0;
  const total_value = aggRes?.total_value || 0;
  const verified_value = aggRes?.verified_value || 0;
  const verified_out_of_warranty_value = aggRes?.verified_out_of_warranty_value || 0;
  let arrearBilling = 0;
  for (const r of arrearRows.results || []) {
    if (r.parsed_asset_value && r.install_year && r.install_month) {
      const monthlyRate = r.parsed_asset_value * 6.08 / 100 / 12;
      const monthsDiff = (targetYear - r.install_year) * 12 + (targetMonth - r.install_month);
      if (monthsDiff > 0) {
        arrearBilling += monthlyRate * monthsDiff;
      }
    }
  }
  const monthlyValue = verified_out_of_warranty_value * 6.08 / 100 / 12;
  const totalBilling = monthlyValue + arrearBilling;
  const statusList = (statusRows.results || []).map((r) => ({
    name: r.equipment_status || "Unknown",
    value: r.cnt
  }));
  const topTypes = (typeRows.results || []).map((r) => ({
    name: r.equipment_type || "Other",
    value: r.cnt
  }));
  let underWarranty = 0;
  let outOfWarranty = 0;
  for (const r of warrantyRows.results || []) {
    if (parseInt(r.warranty_expired || "0", 10) === 1) {
      outOfWarranty = r.cnt;
    } else {
      underWarranty = r.cnt;
    }
  }
  const warrantyList = [
    { name: "Under Warranty", value: underWarranty },
    { name: "Out of Warranty", value: outOfWarranty }
  ];
  return jsonResponse8({
    success: true,
    total_equipment,
    verified_equipment: verified_count,
    under_warranty: under_warranty_count,
    out_of_warranty: out_of_warranty_count,
    total_value: Math.round(total_value * 100) / 100,
    verified_value: Math.round(verified_value * 100) / 100,
    verified_out_of_warranty_value: Math.round(verified_out_of_warranty_value * 100) / 100,
    monthly_value: Math.round(monthlyValue * 100) / 100,
    arrear_billing: Math.round(arrearBilling * 100) / 100,
    total_billing: Math.round(totalBilling * 100) / 100,
    charts: {
      top_types: topTypes,
      status_list: statusList,
      warranty_list: warrantyList
    }
  });
}
__name(handleGetAssetsStats, "handleGetAssetsStats");
var CSV_HEADER_MAP = {
  "district name": "district_name",
  "hospital name": "hospital_name",
  "department name": "department_name",
  "group name": "group_name",
  "equipment name": "equipment_name",
  "model name": "model_name",
  "serial no": "serial_no",
  "serial no.": "serial_no",
  "equipment category": "equipment_category",
  "qr code": "qr_code",
  "stock register page no": "stock_register_page_no",
  "stock register page no.": "stock_register_page_no",
  "recieved date": "received_date",
  "received date": "received_date",
  "installation date": "installation_date",
  "inventory entry date": "inventory_entry_date",
  "moic verified date": "moic_verified_date",
  "po date": "po_date",
  "po cost": "po_cost",
  "inventory status": "inventory_status",
  "equipment status": "equipment_status",
  "supplier": "supplier",
  "warranty details": "warranty_details",
  "asset value": "asset_value",
  "di name": "di_name",
  "dm name": "dm_name",
  "coordinator name": "coordinator_name",
  "zone name": "zone_name",
  "hospital type": "hospital_type",
  "facility type": "facility_type",
  "equipment type": "equipment_type"
};
function parseCSV(text2) {
  const lines = [];
  let row = [""];
  let inQuotes = false;
  for (let i = 0; i < text2.length; i++) {
    const char = text2[i];
    const nextChar = text2[i + 1];
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        row[row.length - 1] += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      row.push("");
    } else if ((char === "\r" || char === "\n") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        i++;
      }
      lines.push(row);
      row = [""];
    } else {
      row[row.length - 1] += char;
    }
  }
  if (row.length > 1 || row[0] !== "") {
    lines.push(row);
  }
  return lines;
}
__name(parseCSV, "parseCSV");
function parseDateFlexible(dateStr) {
  if (!dateStr || ["--", "", "NA", "N/A"].includes(dateStr.trim()))
    return null;
  dateStr = dateStr.trim();
  let timestamp = Date.parse(dateStr);
  if (!isNaN(timestamp)) {
    return new Date(timestamp);
  }
  const dmYRegex = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/;
  const match = dateStr.match(dmYRegex);
  if (match) {
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    const year = parseInt(match[3], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime()))
      return d;
  }
  return null;
}
__name(parseDateFlexible, "parseDateFlexible");
function isWarrantyExpired(warrantyDetails) {
  if (!warrantyDetails || ["--", "", "NA", "N/A"].includes(warrantyDetails.trim())) {
    return true;
  }
  const parts = warrantyDetails.split(" to ");
  if (parts.length < 2)
    return true;
  const endDate = parseDateFlexible(parts[parts.length - 1].trim());
  if (!endDate)
    return true;
  return /* @__PURE__ */ new Date() > endDate;
}
__name(isWarrantyExpired, "isWarrantyExpired");
async function handleUploadAssetsCSV(request, env, params, query, user) {
  if (user.role !== "Admin") {
    return jsonResponse8({ error: "Access denied" }, 403);
  }
  let formData;
  try {
    formData = await request.formData();
  } catch (e) {
    return jsonResponse8({ error: "Invalid form data" }, 400);
  }
  const file = formData.get("file");
  if (!file || typeof file === "string") {
    return jsonResponse8({ error: "No file uploaded" }, 400);
  }
  const csvText = await file.text();
  const parsedRows = parseCSV(csvText);
  if (parsedRows.length < 2) {
    return jsonResponse8({ error: "CSV file is empty or missing header row" }, 400);
  }
  const rawHeader = parsedRows[0];
  const headerMap = {};
  for (let i = 0; i < rawHeader.length; i++) {
    const colName = rawHeader[i].trim().toLowerCase();
    const standardName = CSV_HEADER_MAP[colName];
    if (standardName) {
      headerMap[standardName] = i;
    }
  }
  if (headerMap["qr_code"] === void 0) {
    return jsonResponse8({ error: "CSV missing mandatory 'qr_code' column header" }, 400);
  }
  const seenQrCodes = /* @__PURE__ */ new Set();
  const uniqueRecords = [];
  for (let i = 1; i < parsedRows.length; i++) {
    const row = parsedRows[i];
    if (row.length === 1 && row[0] === "")
      continue;
    const record = {};
    for (const [colName, idx] of Object.entries(headerMap)) {
      record[colName] = (row[idx] || "").trim();
    }
    const qr = record["qr_code"];
    if (!qr || qr === "--" || qr === "") {
      continue;
    }
    if (seenQrCodes.has(qr)) {
      continue;
    }
    seenQrCodes.add(qr);
    uniqueRecords.push(record);
  }
  const totalInputRows = parsedRows.length - 1;
  const insertStatements = [];
  for (const record of uniqueRecords) {
    let assetVal = 0;
    try {
      assetVal = parseFloat(String(record.asset_value || "0").replace(/,/g, "").trim()) || 0;
    } catch (err) {
    }
    const moicDate = parseDateFlexible(record.moic_verified_date);
    const isVerified = moicDate ? 1 : 0;
    const moicYear = moicDate ? moicDate.getFullYear() : null;
    const moicMonth = moicDate ? moicDate.getMonth() + 1 : null;
    const installDate = parseDateFlexible(record.installation_date);
    const installYear = installDate ? installDate.getFullYear() : null;
    const installMonth = installDate ? installDate.getMonth() + 1 : null;
    const expired = isWarrantyExpired(record.warranty_details) ? 1 : 0;
    insertStatements.push({
      sql: `
        INSERT OR IGNORE INTO assets_inventory (
          district_name, hospital_name, department_name, group_name,
          equipment_name, model_name, serial_no, equipment_category,
          qr_code, stock_register_page_no, received_date, installation_date,
          inventory_entry_date, moic_verified_date, po_date, po_cost,
          inventory_status, equipment_status, supplier, warranty_details,
          asset_value, di_name, dm_name, coordinator_name, zone_name,
          hospital_type, facility_type, equipment_type,
          is_verified, warranty_expired, parsed_asset_value,
          moic_year, moic_month, install_year, install_month
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      params: [
        record.district_name || "",
        record.hospital_name || "",
        record.department_name || "",
        record.group_name || "",
        record.equipment_name || "",
        record.model_name || "",
        record.serial_no || "",
        record.equipment_category || "",
        record.qr_code,
        record.stock_register_page_no || "",
        record.received_date || "",
        record.installation_date || "",
        record.inventory_entry_date || "",
        record.moic_verified_date || "",
        record.po_date || "",
        record.po_cost || "",
        record.inventory_status || "",
        record.equipment_status || "",
        record.supplier || "",
        record.warranty_details || "",
        record.asset_value || "",
        record.di_name || "",
        record.dm_name || "",
        record.coordinator_name || "",
        record.zone_name || "",
        record.hospital_type || "",
        record.facility_type || "",
        record.equipment_type || "",
        isVerified,
        expired,
        assetVal,
        moicYear,
        moicMonth,
        installYear,
        installMonth
      ]
    });
  }
  let insertedCount = 0;
  if (insertStatements.length > 0) {
    const chunkSize = 1e3;
    const allBatches = [];
    for (let idx = 0; idx < insertStatements.length; idx += chunkSize) {
      const chunk = insertStatements.slice(idx, idx + chunkSize);
      allBatches.push(runBatchWrite(env, chunk));
    }
    const batchResults = await Promise.all(allBatches);
    for (const batchRes of batchResults) {
      for (const statementRes of batchRes || []) {
        insertedCount += statementRes.meta?.changes || 0;
      }
    }
  }
  const skippedCount = totalInputRows - insertedCount;
  return jsonResponse8({
    success: true,
    inserted: insertedCount,
    skipped: skippedCount,
    message: `Successfully processed CSV file. Inserted ${insertedCount} new assets, skipped ${skippedCount} duplicate/invalid entries.`
  });
}
__name(handleUploadAssetsCSV, "handleUploadAssetsCSV");
async function handleUploadAssetsChunk(request, env, params, query, user) {
  if (user.role !== "Admin") {
    return jsonResponse8({ error: "Access denied" }, 403);
  }
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse8({ error: "Invalid JSON body" }, 400);
  }
  const rows = body.rows || [];
  if (!Array.isArray(rows) || rows.length === 0) {
    return jsonResponse8({
      success: true,
      inserted: 0,
      skipped: 0,
      message: "No rows to process"
    });
  }
  const seenQrCodes = /* @__PURE__ */ new Set();
  const uniqueRecords = [];
  for (const record of rows) {
    const qr = (record.qr_code || "").trim();
    if (!qr || qr === "--" || qr === "") {
      continue;
    }
    if (seenQrCodes.has(qr)) {
      continue;
    }
    seenQrCodes.add(qr);
    uniqueRecords.push(record);
  }
  const totalInputRows = rows.length;
  const insertStatements = [];
  for (const record of uniqueRecords) {
    let assetVal = 0;
    try {
      assetVal = parseFloat(String(record.asset_value || "0").replace(/,/g, "").trim()) || 0;
    } catch (err) {
    }
    const moicDate = parseDateFlexible(record.moic_verified_date);
    const isVerified = moicDate ? 1 : 0;
    const moicYear = moicDate ? moicDate.getFullYear() : null;
    const moicMonth = moicDate ? moicDate.getMonth() + 1 : null;
    const installDate = parseDateFlexible(record.installation_date);
    const installYear = installDate ? installDate.getFullYear() : null;
    const installMonth = installDate ? installDate.getMonth() + 1 : null;
    const expired = isWarrantyExpired(record.warranty_details) ? 1 : 0;
    insertStatements.push({
      sql: `
        INSERT OR IGNORE INTO assets_inventory (
          district_name, hospital_name, department_name, group_name,
          equipment_name, model_name, serial_no, equipment_category,
          qr_code, stock_register_page_no, received_date, installation_date,
          inventory_entry_date, moic_verified_date, po_date, po_cost,
          inventory_status, equipment_status, supplier, warranty_details,
          asset_value, di_name, dm_name, coordinator_name, zone_name,
          hospital_type, facility_type, equipment_type,
          is_verified, warranty_expired, parsed_asset_value,
          moic_year, moic_month, install_year, install_month
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      params: [
        record.district_name || "",
        record.hospital_name || "",
        record.department_name || "",
        record.group_name || "",
        record.equipment_name || "",
        record.model_name || "",
        record.serial_no || "",
        record.equipment_category || "",
        record.qr_code,
        record.stock_register_page_no || "",
        record.received_date || "",
        record.installation_date || "",
        record.inventory_entry_date || "",
        record.moic_verified_date || "",
        record.po_date || "",
        record.po_cost || "",
        record.inventory_status || "",
        record.equipment_status || "",
        record.supplier || "",
        record.warranty_details || "",
        record.asset_value || "",
        record.di_name || "",
        record.dm_name || "",
        record.coordinator_name || "",
        record.zone_name || "",
        record.hospital_type || "",
        record.facility_type || "",
        record.equipment_type || "",
        isVerified,
        expired,
        assetVal,
        moicYear,
        moicMonth,
        installYear,
        installMonth
      ]
    });
  }
  let insertedCount = 0;
  if (insertStatements.length > 0) {
    const chunkSize = 1e3;
    const allBatches = [];
    for (let idx = 0; idx < insertStatements.length; idx += chunkSize) {
      const chunk = insertStatements.slice(idx, idx + chunkSize);
      allBatches.push(runBatchWrite(env, chunk));
    }
    const batchResults = await Promise.all(allBatches);
    for (const batchRes of batchResults) {
      for (const statementRes of batchRes || []) {
        insertedCount += statementRes.meta?.changes || 0;
      }
    }
  }
  const skippedCount = totalInputRows - insertedCount;
  return jsonResponse8({
    success: true,
    inserted: insertedCount,
    skipped: skippedCount,
    message: `Successfully processed chunk. Inserted ${insertedCount} new assets, skipped ${skippedCount} duplicate/invalid entries.`
  });
}
__name(handleUploadAssetsChunk, "handleUploadAssetsChunk");

// src/index.js
function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Max-Age": "86400"
  };
}
__name(corsHeaders, "corsHeaders");
function jsonResponse9(data, status = 200, origin = "*") {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(origin)
    }
  });
}
__name(jsonResponse9, "jsonResponse");
var Router = class {
  constructor() {
    this.routes = { GET: [], POST: [], PUT: [], DELETE: [] };
  }
  _add(method, path, handler, requiresAuth) {
    const isWildcard = path.endsWith("/*");
    const wildcardPrefix = isWildcard ? path.slice(0, -2) : null;
    const parts = isWildcard ? [] : path.split("/");
    this.routes[method].push({ path, handler, requiresAuth, isWildcard, wildcardPrefix, parts });
  }
  get(path, handler, requiresAuth = false) {
    this._add("GET", path, handler, requiresAuth);
  }
  post(path, handler, requiresAuth = false) {
    this._add("POST", path, handler, requiresAuth);
  }
  put(path, handler, requiresAuth = false) {
    this._add("PUT", path, handler, requiresAuth);
  }
  delete(path, handler, requiresAuth = false) {
    this._add("DELETE", path, handler, requiresAuth);
  }
  match(method, pathname) {
    const methodRoutes = this.routes[method] || [];
    const pathParts = pathname.split("/");
    for (const route of methodRoutes) {
      if (route.isWildcard) {
        if (pathname.startsWith(route.wildcardPrefix)) {
          const wildcardVal = pathname.substring(route.wildcardPrefix.length);
          return {
            handler: route.handler,
            requiresAuth: route.requiresAuth,
            params: { "*": wildcardVal, filename: wildcardVal }
          };
        }
        continue;
      }
      if (route.parts.length !== pathParts.length)
        continue;
      const params = {};
      let matched = true;
      for (let i = 0; i < route.parts.length; i++) {
        if (route.parts[i].startsWith(":")) {
          params[route.parts[i].slice(1)] = pathParts[i];
        } else if (route.parts[i] !== pathParts[i]) {
          matched = false;
          break;
        }
      }
      if (matched)
        return { handler: route.handler, requiresAuth: route.requiresAuth, params };
    }
    return null;
  }
};
__name(Router, "Router");
var router = new Router();
router.get("/", async (req, env, params, query) => {
  return jsonResponse9({
    status: "ok",
    message: "Welcome to FieldOps Secondary API Server (Cloudflare Worker)",
    version: "1.0.0",
    docs: "/api/health"
  });
});
router.get("/api/health", async (req, env, params, query) => {
  const result = await env.DB.prepare("SELECT COUNT(*) as cnt FROM users").first();
  return jsonResponse9({
    status: "ok",
    server: "cloudflare-worker-secondary",
    database: "connected",
    users_count: result?.cnt || 0,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
});
router.post("/api/auth/login", handleLogin);
router.post("/api/auth/refresh", handleRefresh);
router.get("/api/auth/bootstrap", handleBootstrap, true);
router.post("/api/auth/logout", handleLogout, true);
router.get("/api/auth/dropdowns", handleGetDropdowns);
router.post("/api/auth/forgot-password", handleForgotPassword);
router.post("/api/auth/verify-otp", handleVerifyOtp);
router.post("/api/auth/reset-password", handleResetPassword);
router.post("/api/auth/unlock-account", handleUnlockAccount);
router.post("/api/auth/unlock-verify-otp", handleUnlockVerifyOtp);
router.get("/api/users/profile", handleGetProfile, true);
router.put("/api/users/profile", handleUpdateProfile, true);
router.post("/api/users/profile/photo", handleUploadProfilePhoto, true);
router.delete("/api/users/profile/photo", handleDeleteProfilePhoto, true);
router.post("/api/users/change-password", handleChangePassword, true);
router.get("/api/approval", handleGetApprovals, true);
router.post("/api/approval/bulk-approve", handleBulkApprove, true);
router.post("/api/approval/:expense_id/approve", handleApprove, true);
router.post("/api/approval/:expense_id/reject", handleReject, true);
router.post("/api/approval/:expense_id/return-to-draft", handleReturnToDraft, true);
router.get("/api/approvals", handleGetApprovals, true);
router.post("/api/approvals/bulk-approve", handleBulkApprove, true);
router.post("/api/approvals/:expense_id/approve", handleApprove, true);
router.post("/api/approvals/:expense_id/reject", handleReject, true);
router.post("/api/approvals/:expense_id/return-to-draft", handleReturnToDraft, true);
router.get("/api/admin/settings", handleGetSystemSettings, true);
router.post("/api/admin/settings", handleSaveSystemSettings, true);
router.get("/api/admin/expenses/rejected", handleSearchRejectedExpenses, true);
router.post("/api/admin/expenses/:expense_id/resubmit", handleResubmitRejectedExpense, true);
router.post("/api/admin/one-time-adjust", handleOneTimeAdjust, true);
router.get("/api/admin/users", handleListUsers, true);
router.post("/api/admin/users/bulk", handleBulkCreateUsers, true);
router.post("/api/admin/users", handleSaveUser, true);
router.put("/api/admin/users/:user_id", handleUpdateUser, true);
router.delete("/api/admin/users/:user_id", handleDeleteUser, true);
router.get("/api/admin/eligible-approvers", handleGetEligibleApprovers, true);
router.get("/api/admin/hierarchies/export", handleExportHierarchies, true);
router.post("/api/admin/hierarchies/bulk", handleBulkImportHierarchies, true);
router.get("/api/admin/hierarchies", handleListHierarchies, true);
router.post("/api/admin/hierarchies", handleSaveHierarchy, true);
router.delete("/api/admin/hierarchies/:id", handleDeleteHierarchy, true);
router.post("/api/admin/logout-all", handleLogoutAllUsers, true);
router.post("/api/admin/logout-user/:user_code", handleLogoutSingleUser, true);
router.get("/api/ticket", handleGetTickets, true);
router.post("/api/ticket", handleCreateTicket, true);
router.post("/api/ticket/:ticket_id/comment", handleAddComment, true);
router.post("/api/ticket/:ticket_id/close", handleCloseTicket, true);
router.post("/api/ticket/:ticket_id/reopen", handleReopenTicket, true);
router.post("/api/ticket/:ticket_id/followup", handleToggleFollowup, true);
router.get("/api/tickets", handleGetTickets, true);
router.post("/api/tickets", handleCreateTicket, true);
router.post("/api/tickets/:ticket_id/comment", handleAddComment, true);
router.post("/api/tickets/:ticket_id/close", handleCloseTicket, true);
router.post("/api/tickets/:ticket_id/reopen", handleReopenTicket, true);
router.post("/api/tickets/:ticket_id/followup", handleToggleFollowup, true);
router.post("/api/upload/image", handleUploadImage, true);
router.post("/api/upload/document", handleUploadDocument, true);
router.get("/api/upload/file/images/:filename", handleServeFile, false);
router.get("/api/upload/file/documents/:filename", handleServeFile, false);
router.get("/api/upload/file/gdrive/:filename", handleServeFile, false);
router.get("/uploads/expense_attachments/:filename", handleServeExpenseAttachment, false);
router.get("/api/reports/mis-dashboard", handleGetMisDashboard, true);
router.get("/api/reports/assets-inventory", handleGetAssetsInventory, true);
router.get("/api/reports/assets-filters", handleGetAssetsFilters, true);
router.get("/api/reports/assets-stats", handleGetAssetsStats, true);
router.post("/api/reports/upload-assets-csv", handleUploadAssetsCSV, true);
router.post("/api/reports/upload-assets-chunk", handleUploadAssetsChunk, true);
router.get("/api/expense/init", handleExpenseInit, true);
router.post("/api/expense/limit-request", handleCreateLimitRequest, true);
router.get("/api/expense/team", handleGetTeamExpenses, true);
router.get("/api/expense/team-users", handleGetTeamUsers, true);
router.get("/api/expense/kpi-appraisal", handleGetKpiAppraisal, true);
router.post("/api/expense/kpi-appraisal", handleSaveKpiAppraisal, true);
router.get("/api/expense/verify-barcode", handleVerifyBarcode, true);
router.get("/api/expense/asset-value-master", handleGetAssetValueMaster, true);
router.get("/api/expense/month-summary", handleGetMonthSummary, true);
router.get("/api/expense/engineer-month-claims", handleGetEngineerMonthClaims, true);
router.get("/api/expense/engineer-advance", handleGetEngineerAdvance, true);
router.post("/api/expense/engineer-advance", handleSaveEngineerAdvance, true);
router.get("/api/expense/consolidated-report", handleGetConsolidatedReport, true);
router.get("/api/expense/policy-rules", handleGetPolicyRules, true);
router.post("/api/expense/retroactive-policy-check", handleRetroactiveBasePolicyCheck, true);
router.get("/api/expense", handleListExpenses, true);
router.post("/api/expense", handleSubmitExpense, true);
router.get("/api/expense/:id", handleGetExpenseDetails, true);
router.delete("/api/expense/:id", handleDeleteExpense, true);
router.post("/api/expense/:id/reverse", handleReverseExpense, true);
router.post("/api/admin/run-migrations", async (req, env, params, query, user) => {
  if (!user || user.role !== "Admin") {
    return jsonResponse9({ error: "Access denied" }, 403);
  }
  try {
    await runMigrations(env._originalDB || env.DB);
    return jsonResponse9({ success: true, message: "Migrations completed successfully" });
  } catch (e) {
    return jsonResponse9({ error: "Migration error: " + e.message }, 500);
  }
}, true);
var src_default = {
  async fetch(request, env, ctx) {
    env.ctx = ctx;
    if (env.DB && !env._originalDB) {
      env._originalDB = env.DB;
      const originalDB = env.DB;
      env.DB = {
        prepare(sql2) {
          const stmt = originalDB.prepare(sql2);
          const sqlTrimLower = sql2.trim().toLowerCase();
          const isSelect = sqlTrimLower.startsWith("select") || sqlTrimLower.startsWith("with");
          function wrapStmt(nativeStmt, params) {
            return new Proxy(nativeStmt, {
              get(target, prop, receiver) {
                if (prop === "all") {
                  return async function() {
                    if (isSelect) {
                      return await runRead(env, sql2, params, request);
                    }
                    return await target.all();
                  };
                }
                if (prop === "first") {
                  return async function(column) {
                    if (isSelect) {
                      const res = await runRead(env, sql2, params, request);
                      const row = res.results && res.results[0];
                      if (!row)
                        return null;
                      if (column)
                        return row[column];
                      return row;
                    }
                    return await target.first(column);
                  };
                }
                if (prop === "run") {
                  return async function() {
                    return await target.run();
                  };
                }
                if (prop === "bind") {
                  return function(...newParams) {
                    const newNativeStmt = target.bind(...newParams);
                    return wrapStmt(newNativeStmt, newParams);
                  };
                }
                const val = target[prop];
                if (typeof val === "function") {
                  return val.bind(target);
                }
                return val;
              }
            });
          }
          __name(wrapStmt, "wrapStmt");
          return wrapStmt(stmt, []);
        },
        batch(statements) {
          return originalDB.batch(statements);
        },
        exec(sql2) {
          return originalDB.exec(sql2);
        }
      };
    }
    const url = new URL(request.url);
    let pathname = url.pathname;
    if (pathname.endsWith("/") && pathname !== "/") {
      pathname = pathname.slice(0, -1);
    }
    const { searchParams } = url;
    const method = request.method;
    const origin = request.headers.get("Origin") || "*";
    if (method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }
    const route = router.match(method, pathname);
    if (!route) {
      return jsonResponse9({ error: "Endpoint not found", path: pathname }, 404, origin);
    }
    let user = null;
    if (route.requiresAuth) {
      const authHeader = request.headers.get("Authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return jsonResponse9({ error: "Missing or invalid authorization header" }, 401, origin);
      }
      const token = authHeader.split(" ")[1];
      const payload = await verifyJwt(token, env.API_SECRET);
      if (!payload || payload.type !== "access") {
        return jsonResponse9({ error: "Session expired or invalid token" }, 401, origin);
      }
      user = await env.DB.prepare("SELECT * FROM users WHERE user_id = ?").bind(payload.sub).first();
      if (!user) {
        return jsonResponse9({ error: "Invalid session" }, 401, origin);
      }
      if (user.user_status !== "active") {
        return jsonResponse9({ error: "Account status is inactive or locked" }, 403, origin);
      }
    }
    try {
      const response = await route.handler(request, env, route.params, searchParams, user);
      const newResponse = new Response(response.body, response);
      const cors = corsHeaders(origin);
      for (const [key, value] of Object.entries(cors)) {
        newResponse.headers.set(key, value);
      }
      return newResponse;
    } catch (error) {
      console.error(`Route error [${method} ${pathname}]:`, error);
      return jsonResponse9({ error: "Internal server error", detail: error.message }, 500, origin);
    }
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(handleAutoApprovalExpiry(env));
  }
};

// ../../sunil-main/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// .wrangler/tmp/bundle-T1UpmU/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default
];
var middleware_insertion_facade_default = src_default;

// ../../sunil-main/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-T1UpmU/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof __Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
__name(__Facade_ScheduledController__, "__Facade_ScheduledController__");
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = (request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    };
    #dispatcher = (type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    };
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
