// ../../node_modules/d3-array/src/ascending.js
function ascending(a3, b2) {
  return a3 == null || b2 == null ? NaN : a3 < b2 ? -1 : a3 > b2 ? 1 : a3 >= b2 ? 0 : NaN;
}

// ../../node_modules/d3-array/src/descending.js
function descending(a3, b2) {
  return a3 == null || b2 == null ? NaN : b2 < a3 ? -1 : b2 > a3 ? 1 : b2 >= a3 ? 0 : NaN;
}

// ../../node_modules/d3-array/src/bisector.js
function bisector(f2) {
  let compare1, compare2, delta;
  if (f2.length !== 2) {
    compare1 = ascending;
    compare2 = (d2, x3) => ascending(f2(d2), x3);
    delta = (d2, x3) => f2(d2) - x3;
  } else {
    compare1 = f2 === ascending || f2 === descending ? f2 : zero;
    compare2 = f2;
    delta = f2;
  }
  function left2(a3, x3, lo = 0, hi = a3.length) {
    if (lo < hi) {
      if (compare1(x3, x3) !== 0)
        return hi;
      do {
        const mid2 = lo + hi >>> 1;
        if (compare2(a3[mid2], x3) < 0)
          lo = mid2 + 1;
        else
          hi = mid2;
      } while (lo < hi);
    }
    return lo;
  }
  function right2(a3, x3, lo = 0, hi = a3.length) {
    if (lo < hi) {
      if (compare1(x3, x3) !== 0)
        return hi;
      do {
        const mid2 = lo + hi >>> 1;
        if (compare2(a3[mid2], x3) <= 0)
          lo = mid2 + 1;
        else
          hi = mid2;
      } while (lo < hi);
    }
    return lo;
  }
  function center2(a3, x3, lo = 0, hi = a3.length) {
    const i2 = left2(a3, x3, lo, hi - 1);
    return i2 > lo && delta(a3[i2 - 1], x3) > -delta(a3[i2], x3) ? i2 - 1 : i2;
  }
  return { left: left2, center: center2, right: right2 };
}
function zero() {
  return 0;
}

// ../../node_modules/d3-array/src/number.js
function number(x3) {
  return x3 === null ? NaN : +x3;
}
function* numbers(values2, valueof2) {
  if (valueof2 === void 0) {
    for (let value of values2) {
      if (value != null && (value = +value) >= value) {
        yield value;
      }
    }
  } else {
    let index2 = -1;
    for (let value of values2) {
      if ((value = valueof2(value, ++index2, values2)) != null && (value = +value) >= value) {
        yield value;
      }
    }
  }
}

// ../../node_modules/d3-array/src/bisect.js
var ascendingBisect = bisector(ascending);
var bisectRight = ascendingBisect.right;
var bisectLeft = ascendingBisect.left;
var bisectCenter = bisector(number).center;
var bisect_default = bisectRight;

// ../../node_modules/d3-array/src/count.js
function count(values2, valueof2) {
  let count2 = 0;
  if (valueof2 === void 0) {
    for (let value of values2) {
      if (value != null && (value = +value) >= value) {
        ++count2;
      }
    }
  } else {
    let index2 = -1;
    for (let value of values2) {
      if ((value = valueof2(value, ++index2, values2)) != null && (value = +value) >= value) {
        ++count2;
      }
    }
  }
  return count2;
}

// ../../node_modules/d3-array/src/cross.js
function length(array2) {
  return array2.length | 0;
}
function empty(length3) {
  return !(length3 > 0);
}
function arrayify(values2) {
  return typeof values2 !== "object" || "length" in values2 ? values2 : Array.from(values2);
}
function reducer(reduce) {
  return (values2) => reduce(...values2);
}
function cross(...values2) {
  const reduce = typeof values2[values2.length - 1] === "function" && reducer(values2.pop());
  values2 = values2.map(arrayify);
  const lengths = values2.map(length);
  const j2 = values2.length - 1;
  const index2 = new Array(j2 + 1).fill(0);
  const product = [];
  if (j2 < 0 || lengths.some(empty))
    return product;
  while (true) {
    product.push(index2.map((j3, i3) => values2[i3][j3]));
    let i2 = j2;
    while (++index2[i2] === lengths[i2]) {
      if (i2 === 0)
        return reduce ? product.map(reduce) : product;
      index2[i2--] = 0;
    }
  }
}

// ../../node_modules/d3-array/src/cumsum.js
function cumsum(values2, valueof2) {
  var sum2 = 0, index2 = 0;
  return Float64Array.from(values2, valueof2 === void 0 ? (v2) => sum2 += +v2 || 0 : (v2) => sum2 += +valueof2(v2, index2++, values2) || 0);
}

// ../../node_modules/d3-array/src/variance.js
function variance(values2, valueof2) {
  let count2 = 0;
  let delta;
  let mean2 = 0;
  let sum2 = 0;
  if (valueof2 === void 0) {
    for (let value of values2) {
      if (value != null && (value = +value) >= value) {
        delta = value - mean2;
        mean2 += delta / ++count2;
        sum2 += delta * (value - mean2);
      }
    }
  } else {
    let index2 = -1;
    for (let value of values2) {
      if ((value = valueof2(value, ++index2, values2)) != null && (value = +value) >= value) {
        delta = value - mean2;
        mean2 += delta / ++count2;
        sum2 += delta * (value - mean2);
      }
    }
  }
  if (count2 > 1)
    return sum2 / (count2 - 1);
}

// ../../node_modules/d3-array/src/deviation.js
function deviation(values2, valueof2) {
  const v2 = variance(values2, valueof2);
  return v2 ? Math.sqrt(v2) : v2;
}

// ../../node_modules/d3-array/src/extent.js
function extent(values2, valueof2) {
  let min4;
  let max3;
  if (valueof2 === void 0) {
    for (const value of values2) {
      if (value != null) {
        if (min4 === void 0) {
          if (value >= value)
            min4 = max3 = value;
        } else {
          if (min4 > value)
            min4 = value;
          if (max3 < value)
            max3 = value;
        }
      }
    }
  } else {
    let index2 = -1;
    for (let value of values2) {
      if ((value = valueof2(value, ++index2, values2)) != null) {
        if (min4 === void 0) {
          if (value >= value)
            min4 = max3 = value;
        } else {
          if (min4 > value)
            min4 = value;
          if (max3 < value)
            max3 = value;
        }
      }
    }
  }
  return [min4, max3];
}

// ../../node_modules/d3-array/src/fsum.js
var Adder = class {
  constructor() {
    this._partials = new Float64Array(32);
    this._n = 0;
  }
  add(x3) {
    const p2 = this._partials;
    let i2 = 0;
    for (let j2 = 0; j2 < this._n && j2 < 32; j2++) {
      const y3 = p2[j2], hi = x3 + y3, lo = Math.abs(x3) < Math.abs(y3) ? x3 - (hi - y3) : y3 - (hi - x3);
      if (lo)
        p2[i2++] = lo;
      x3 = hi;
    }
    p2[i2] = x3;
    this._n = i2 + 1;
    return this;
  }
  valueOf() {
    const p2 = this._partials;
    let n2 = this._n, x3, y3, lo, hi = 0;
    if (n2 > 0) {
      hi = p2[--n2];
      while (n2 > 0) {
        x3 = hi;
        y3 = p2[--n2];
        hi = x3 + y3;
        lo = y3 - (hi - x3);
        if (lo)
          break;
      }
      if (n2 > 0 && (lo < 0 && p2[n2 - 1] < 0 || lo > 0 && p2[n2 - 1] > 0)) {
        y3 = lo * 2;
        x3 = hi + y3;
        if (y3 == x3 - hi)
          hi = x3;
      }
    }
    return hi;
  }
};

// ../../node_modules/internmap/src/index.js
var InternMap = class extends Map {
  constructor(entries, key = keyof) {
    super();
    Object.defineProperties(this, { _intern: { value: /* @__PURE__ */ new Map() }, _key: { value: key } });
    if (entries != null)
      for (const [key2, value] of entries)
        this.set(key2, value);
  }
  get(key) {
    return super.get(intern_get(this, key));
  }
  has(key) {
    return super.has(intern_get(this, key));
  }
  set(key, value) {
    return super.set(intern_set(this, key), value);
  }
  delete(key) {
    return super.delete(intern_delete(this, key));
  }
};
var InternSet = class extends Set {
  constructor(values2, key = keyof) {
    super();
    Object.defineProperties(this, { _intern: { value: /* @__PURE__ */ new Map() }, _key: { value: key } });
    if (values2 != null)
      for (const value of values2)
        this.add(value);
  }
  has(value) {
    return super.has(intern_get(this, value));
  }
  add(value) {
    return super.add(intern_set(this, value));
  }
  delete(value) {
    return super.delete(intern_delete(this, value));
  }
};
function intern_get({ _intern, _key }, value) {
  const key = _key(value);
  return _intern.has(key) ? _intern.get(key) : value;
}
function intern_set({ _intern, _key }, value) {
  const key = _key(value);
  if (_intern.has(key))
    return _intern.get(key);
  _intern.set(key, value);
  return value;
}
function intern_delete({ _intern, _key }, value) {
  const key = _key(value);
  if (_intern.has(key)) {
    value = _intern.get(key);
    _intern.delete(key);
  }
  return value;
}
function keyof(value) {
  return value !== null && typeof value === "object" ? value.valueOf() : value;
}

// ../../node_modules/d3-array/src/identity.js
function identity(x3) {
  return x3;
}

// ../../node_modules/d3-array/src/group.js
function group(values2, ...keys) {
  return nest(values2, identity, identity, keys);
}
function rollup(values2, reduce, ...keys) {
  return nest(values2, identity, reduce, keys);
}
function rollups(values2, reduce, ...keys) {
  return nest(values2, Array.from, reduce, keys);
}
function nest(values2, map4, reduce, keys) {
  return function regroup(values3, i2) {
    if (i2 >= keys.length)
      return reduce(values3);
    const groups2 = new InternMap();
    const keyof3 = keys[i2++];
    let index2 = -1;
    for (const value of values3) {
      const key = keyof3(value, ++index2, values3);
      const group2 = groups2.get(key);
      if (group2)
        group2.push(value);
      else
        groups2.set(key, [value]);
    }
    for (const [key, values4] of groups2) {
      groups2.set(key, regroup(values4, i2));
    }
    return map4(groups2);
  }(values2, 0);
}

// ../../node_modules/d3-array/src/permute.js
function permute(source, keys) {
  return Array.from(keys, (key) => source[key]);
}

// ../../node_modules/d3-array/src/sort.js
function sort(values2, ...F) {
  if (typeof values2[Symbol.iterator] !== "function")
    throw new TypeError("values is not iterable");
  values2 = Array.from(values2);
  let [f2] = F;
  if (f2 && f2.length !== 2 || F.length > 1) {
    const index2 = Uint32Array.from(values2, (d2, i2) => i2);
    if (F.length > 1) {
      F = F.map((f3) => values2.map(f3));
      index2.sort((i2, j2) => {
        for (const f3 of F) {
          const c5 = ascendingDefined(f3[i2], f3[j2]);
          if (c5)
            return c5;
        }
      });
    } else {
      f2 = values2.map(f2);
      index2.sort((i2, j2) => ascendingDefined(f2[i2], f2[j2]));
    }
    return permute(values2, index2);
  }
  return values2.sort(compareDefined(f2));
}
function compareDefined(compare = ascending) {
  if (compare === ascending)
    return ascendingDefined;
  if (typeof compare !== "function")
    throw new TypeError("compare is not a function");
  return (a3, b2) => {
    const x3 = compare(a3, b2);
    if (x3 || x3 === 0)
      return x3;
    return (compare(b2, b2) === 0) - (compare(a3, a3) === 0);
  };
}
function ascendingDefined(a3, b2) {
  return (a3 == null || !(a3 >= a3)) - (b2 == null || !(b2 >= b2)) || (a3 < b2 ? -1 : a3 > b2 ? 1 : 0);
}

// ../../node_modules/d3-array/src/groupSort.js
function groupSort(values2, reduce, key) {
  return (reduce.length !== 2 ? sort(rollup(values2, reduce, key), ([ak, av], [bk, bv]) => ascending(av, bv) || ascending(ak, bk)) : sort(group(values2, key), ([ak, av], [bk, bv]) => reduce(av, bv) || ascending(ak, bk))).map(([key2]) => key2);
}

// ../../node_modules/d3-array/src/ticks.js
var e10 = Math.sqrt(50);
var e5 = Math.sqrt(10);
var e2 = Math.sqrt(2);
function tickSpec(start2, stop, count2) {
  const step = (stop - start2) / Math.max(0, count2), power = Math.floor(Math.log10(step)), error2 = step / Math.pow(10, power), factor = error2 >= e10 ? 10 : error2 >= e5 ? 5 : error2 >= e2 ? 2 : 1;
  let i1, i2, inc;
  if (power < 0) {
    inc = Math.pow(10, -power) / factor;
    i1 = Math.round(start2 * inc);
    i2 = Math.round(stop * inc);
    if (i1 / inc < start2)
      ++i1;
    if (i2 / inc > stop)
      --i2;
    inc = -inc;
  } else {
    inc = Math.pow(10, power) * factor;
    i1 = Math.round(start2 / inc);
    i2 = Math.round(stop / inc);
    if (i1 * inc < start2)
      ++i1;
    if (i2 * inc > stop)
      --i2;
  }
  if (i2 < i1 && 0.5 <= count2 && count2 < 2)
    return tickSpec(start2, stop, count2 * 2);
  return [i1, i2, inc];
}
function ticks(start2, stop, count2) {
  stop = +stop, start2 = +start2, count2 = +count2;
  if (!(count2 > 0))
    return [];
  if (start2 === stop)
    return [start2];
  const reverse2 = stop < start2, [i1, i2, inc] = reverse2 ? tickSpec(stop, start2, count2) : tickSpec(start2, stop, count2);
  if (!(i2 >= i1))
    return [];
  const n2 = i2 - i1 + 1, ticks2 = new Array(n2);
  if (reverse2) {
    if (inc < 0)
      for (let i3 = 0; i3 < n2; ++i3)
        ticks2[i3] = (i2 - i3) / -inc;
    else
      for (let i3 = 0; i3 < n2; ++i3)
        ticks2[i3] = (i2 - i3) * inc;
  } else {
    if (inc < 0)
      for (let i3 = 0; i3 < n2; ++i3)
        ticks2[i3] = (i1 + i3) / -inc;
    else
      for (let i3 = 0; i3 < n2; ++i3)
        ticks2[i3] = (i1 + i3) * inc;
  }
  return ticks2;
}
function tickIncrement(start2, stop, count2) {
  stop = +stop, start2 = +start2, count2 = +count2;
  return tickSpec(start2, stop, count2)[2];
}
function tickStep(start2, stop, count2) {
  stop = +stop, start2 = +start2, count2 = +count2;
  const reverse2 = stop < start2, inc = reverse2 ? tickIncrement(stop, start2, count2) : tickIncrement(start2, stop, count2);
  return (reverse2 ? -1 : 1) * (inc < 0 ? 1 / -inc : inc);
}

// ../../node_modules/d3-array/src/threshold/sturges.js
function thresholdSturges(values2) {
  return Math.max(1, Math.ceil(Math.log(count(values2)) / Math.LN2) + 1);
}

// ../../node_modules/d3-array/src/max.js
function max(values2, valueof2) {
  let max3;
  if (valueof2 === void 0) {
    for (const value of values2) {
      if (value != null && (max3 < value || max3 === void 0 && value >= value)) {
        max3 = value;
      }
    }
  } else {
    let index2 = -1;
    for (let value of values2) {
      if ((value = valueof2(value, ++index2, values2)) != null && (max3 < value || max3 === void 0 && value >= value)) {
        max3 = value;
      }
    }
  }
  return max3;
}

// ../../node_modules/d3-array/src/maxIndex.js
function maxIndex(values2, valueof2) {
  let max3;
  let maxIndex2 = -1;
  let index2 = -1;
  if (valueof2 === void 0) {
    for (const value of values2) {
      ++index2;
      if (value != null && (max3 < value || max3 === void 0 && value >= value)) {
        max3 = value, maxIndex2 = index2;
      }
    }
  } else {
    for (let value of values2) {
      if ((value = valueof2(value, ++index2, values2)) != null && (max3 < value || max3 === void 0 && value >= value)) {
        max3 = value, maxIndex2 = index2;
      }
    }
  }
  return maxIndex2;
}

// ../../node_modules/d3-array/src/min.js
function min(values2, valueof2) {
  let min4;
  if (valueof2 === void 0) {
    for (const value of values2) {
      if (value != null && (min4 > value || min4 === void 0 && value >= value)) {
        min4 = value;
      }
    }
  } else {
    let index2 = -1;
    for (let value of values2) {
      if ((value = valueof2(value, ++index2, values2)) != null && (min4 > value || min4 === void 0 && value >= value)) {
        min4 = value;
      }
    }
  }
  return min4;
}

// ../../node_modules/d3-array/src/minIndex.js
function minIndex(values2, valueof2) {
  let min4;
  let minIndex2 = -1;
  let index2 = -1;
  if (valueof2 === void 0) {
    for (const value of values2) {
      ++index2;
      if (value != null && (min4 > value || min4 === void 0 && value >= value)) {
        min4 = value, minIndex2 = index2;
      }
    }
  } else {
    for (let value of values2) {
      if ((value = valueof2(value, ++index2, values2)) != null && (min4 > value || min4 === void 0 && value >= value)) {
        min4 = value, minIndex2 = index2;
      }
    }
  }
  return minIndex2;
}

// ../../node_modules/d3-array/src/quickselect.js
function quickselect(array2, k3, left2 = 0, right2 = Infinity, compare) {
  k3 = Math.floor(k3);
  left2 = Math.floor(Math.max(0, left2));
  right2 = Math.floor(Math.min(array2.length - 1, right2));
  if (!(left2 <= k3 && k3 <= right2))
    return array2;
  compare = compare === void 0 ? ascendingDefined : compareDefined(compare);
  while (right2 > left2) {
    if (right2 - left2 > 600) {
      const n2 = right2 - left2 + 1;
      const m = k3 - left2 + 1;
      const z2 = Math.log(n2);
      const s3 = 0.5 * Math.exp(2 * z2 / 3);
      const sd = 0.5 * Math.sqrt(z2 * s3 * (n2 - s3) / n2) * (m - n2 / 2 < 0 ? -1 : 1);
      const newLeft = Math.max(left2, Math.floor(k3 - m * s3 / n2 + sd));
      const newRight = Math.min(right2, Math.floor(k3 + (n2 - m) * s3 / n2 + sd));
      quickselect(array2, k3, newLeft, newRight, compare);
    }
    const t5 = array2[k3];
    let i2 = left2;
    let j2 = right2;
    swap(array2, left2, k3);
    if (compare(array2[right2], t5) > 0)
      swap(array2, left2, right2);
    while (i2 < j2) {
      swap(array2, i2, j2), ++i2, --j2;
      while (compare(array2[i2], t5) < 0)
        ++i2;
      while (compare(array2[j2], t5) > 0)
        --j2;
    }
    if (compare(array2[left2], t5) === 0)
      swap(array2, left2, j2);
    else
      ++j2, swap(array2, j2, right2);
    if (j2 <= k3)
      left2 = j2 + 1;
    if (k3 <= j2)
      right2 = j2 - 1;
  }
  return array2;
}
function swap(array2, i2, j2) {
  const t5 = array2[i2];
  array2[i2] = array2[j2];
  array2[j2] = t5;
}

// ../../node_modules/d3-array/src/greatest.js
function greatest(values2, compare = ascending) {
  let max3;
  let defined2 = false;
  if (compare.length === 1) {
    let maxValue;
    for (const element of values2) {
      const value = compare(element);
      if (defined2 ? ascending(value, maxValue) > 0 : ascending(value, value) === 0) {
        max3 = element;
        maxValue = value;
        defined2 = true;
      }
    }
  } else {
    for (const value of values2) {
      if (defined2 ? compare(value, max3) > 0 : compare(value, value) === 0) {
        max3 = value;
        defined2 = true;
      }
    }
  }
  return max3;
}

// ../../node_modules/d3-array/src/quantile.js
function quantile(values2, p2, valueof2) {
  values2 = Float64Array.from(numbers(values2, valueof2));
  if (!(n2 = values2.length) || isNaN(p2 = +p2))
    return;
  if (p2 <= 0 || n2 < 2)
    return min(values2);
  if (p2 >= 1)
    return max(values2);
  var n2, i2 = (n2 - 1) * p2, i0 = Math.floor(i2), value0 = max(quickselect(values2, i0).subarray(0, i0 + 1)), value1 = min(values2.subarray(i0 + 1));
  return value0 + (value1 - value0) * (i2 - i0);
}
function quantileSorted(values2, p2, valueof2 = number) {
  if (!(n2 = values2.length) || isNaN(p2 = +p2))
    return;
  if (p2 <= 0 || n2 < 2)
    return +valueof2(values2[0], 0, values2);
  if (p2 >= 1)
    return +valueof2(values2[n2 - 1], n2 - 1, values2);
  var n2, i2 = (n2 - 1) * p2, i0 = Math.floor(i2), value0 = +valueof2(values2[i0], i0, values2), value1 = +valueof2(values2[i0 + 1], i0 + 1, values2);
  return value0 + (value1 - value0) * (i2 - i0);
}

// ../../node_modules/d3-array/src/threshold/freedmanDiaconis.js
function thresholdFreedmanDiaconis(values2, min4, max3) {
  const c5 = count(values2), d2 = quantile(values2, 0.75) - quantile(values2, 0.25);
  return c5 && d2 ? Math.ceil((max3 - min4) / (2 * d2 * Math.pow(c5, -1 / 3))) : 1;
}

// ../../node_modules/d3-array/src/threshold/scott.js
function thresholdScott(values2, min4, max3) {
  const c5 = count(values2), d2 = deviation(values2);
  return c5 && d2 ? Math.ceil((max3 - min4) * Math.cbrt(c5) / (3.49 * d2)) : 1;
}

// ../../node_modules/d3-array/src/mean.js
function mean(values2, valueof2) {
  let count2 = 0;
  let sum2 = 0;
  if (valueof2 === void 0) {
    for (let value of values2) {
      if (value != null && (value = +value) >= value) {
        ++count2, sum2 += value;
      }
    }
  } else {
    let index2 = -1;
    for (let value of values2) {
      if ((value = valueof2(value, ++index2, values2)) != null && (value = +value) >= value) {
        ++count2, sum2 += value;
      }
    }
  }
  if (count2)
    return sum2 / count2;
}

// ../../node_modules/d3-array/src/median.js
function median(values2, valueof2) {
  return quantile(values2, 0.5, valueof2);
}

// ../../node_modules/d3-array/src/merge.js
function* flatten(arrays) {
  for (const array2 of arrays) {
    yield* array2;
  }
}
function merge(arrays) {
  return Array.from(flatten(arrays));
}

// ../../node_modules/d3-array/src/mode.js
function mode(values2, valueof2) {
  const counts = new InternMap();
  if (valueof2 === void 0) {
    for (let value of values2) {
      if (value != null && value >= value) {
        counts.set(value, (counts.get(value) || 0) + 1);
      }
    }
  } else {
    let index2 = -1;
    for (let value of values2) {
      if ((value = valueof2(value, ++index2, values2)) != null && value >= value) {
        counts.set(value, (counts.get(value) || 0) + 1);
      }
    }
  }
  let modeValue;
  let modeCount = 0;
  for (const [value, count2] of counts) {
    if (count2 > modeCount) {
      modeCount = count2;
      modeValue = value;
    }
  }
  return modeValue;
}

// ../../node_modules/d3-array/src/pairs.js
function pairs(values2, pairof = pair) {
  const pairs2 = [];
  let previous;
  let first2 = false;
  for (const value of values2) {
    if (first2)
      pairs2.push(pairof(previous, value));
    previous = value;
    first2 = true;
  }
  return pairs2;
}
function pair(a3, b2) {
  return [a3, b2];
}

// ../../node_modules/d3-array/src/range.js
function range(start2, stop, step) {
  start2 = +start2, stop = +stop, step = (n2 = arguments.length) < 2 ? (stop = start2, start2 = 0, 1) : n2 < 3 ? 1 : +step;
  var i2 = -1, n2 = Math.max(0, Math.ceil((stop - start2) / step)) | 0, range3 = new Array(n2);
  while (++i2 < n2) {
    range3[i2] = start2 + i2 * step;
  }
  return range3;
}

// ../../node_modules/d3-array/src/rank.js
function rank(values2, valueof2 = ascending) {
  if (typeof values2[Symbol.iterator] !== "function")
    throw new TypeError("values is not iterable");
  let V = Array.from(values2);
  const R2 = new Float64Array(V.length);
  if (valueof2.length !== 2)
    V = V.map(valueof2), valueof2 = ascending;
  const compareIndex = (i2, j2) => valueof2(V[i2], V[j2]);
  let k3, r2;
  values2 = Uint32Array.from(V, (_24, i2) => i2);
  values2.sort(valueof2 === ascending ? (i2, j2) => ascendingDefined(V[i2], V[j2]) : compareDefined(compareIndex));
  values2.forEach((j2, i2) => {
    const c5 = compareIndex(j2, k3 === void 0 ? j2 : k3);
    if (c5 >= 0) {
      if (k3 === void 0 || c5 > 0)
        k3 = j2, r2 = i2;
      R2[j2] = r2;
    } else {
      R2[j2] = NaN;
    }
  });
  return R2;
}

// ../../node_modules/d3-array/src/sum.js
function sum(values2, valueof2) {
  let sum2 = 0;
  if (valueof2 === void 0) {
    for (let value of values2) {
      if (value = +value) {
        sum2 += value;
      }
    }
  } else {
    let index2 = -1;
    for (let value of values2) {
      if (value = +valueof2(value, ++index2, values2)) {
        sum2 += value;
      }
    }
  }
  return sum2;
}

// ../../node_modules/d3-array/src/reverse.js
function reverse(values2) {
  if (typeof values2[Symbol.iterator] !== "function")
    throw new TypeError("values is not iterable");
  return Array.from(values2).reverse();
}

// ../../node_modules/d3-axis/src/identity.js
function identity_default(x3) {
  return x3;
}

// ../../node_modules/d3-axis/src/axis.js
var top = 1;
var right = 2;
var bottom = 3;
var left = 4;
var epsilon = 1e-6;
function translateX(x3) {
  return "translate(" + x3 + ",0)";
}
function translateY(y3) {
  return "translate(0," + y3 + ")";
}
function number2(scale) {
  return (d2) => +scale(d2);
}
function center(scale, offset2) {
  offset2 = Math.max(0, scale.bandwidth() - offset2 * 2) / 2;
  if (scale.round())
    offset2 = Math.round(offset2);
  return (d2) => +scale(d2) + offset2;
}
function entering() {
  return !this.__axis;
}
function axis(orient, scale) {
  var tickArguments = [], tickValues = null, tickFormat2 = null, tickSizeInner = 6, tickSizeOuter = 6, tickPadding = 3, offset2 = typeof window !== "undefined" && window.devicePixelRatio > 1 ? 0 : 0.5, k3 = orient === top || orient === left ? -1 : 1, x3 = orient === left || orient === right ? "x" : "y", transform2 = orient === top || orient === bottom ? translateX : translateY;
  function axis2(context) {
    var values2 = tickValues == null ? scale.ticks ? scale.ticks.apply(scale, tickArguments) : scale.domain() : tickValues, format3 = tickFormat2 == null ? scale.tickFormat ? scale.tickFormat.apply(scale, tickArguments) : identity_default : tickFormat2, spacing = Math.max(tickSizeInner, 0) + tickPadding, range3 = scale.range(), range0 = +range3[0] + offset2, range1 = +range3[range3.length - 1] + offset2, position2 = (scale.bandwidth ? center : number2)(scale.copy(), offset2), selection2 = context.selection ? context.selection() : context, path2 = selection2.selectAll(".domain").data([null]), tick = selection2.selectAll(".tick").data(values2, scale).order(), tickExit = tick.exit(), tickEnter = tick.enter().append("g").attr("class", "tick"), line2 = tick.select("line"), text2 = tick.select("text");
    path2 = path2.merge(path2.enter().insert("path", ".tick").attr("class", "domain").attr("stroke", "currentColor"));
    tick = tick.merge(tickEnter);
    line2 = line2.merge(tickEnter.append("line").attr("stroke", "currentColor").attr(x3 + "2", k3 * tickSizeInner));
    text2 = text2.merge(tickEnter.append("text").attr("fill", "currentColor").attr(x3, k3 * spacing).attr("dy", orient === top ? "0em" : orient === bottom ? "0.71em" : "0.32em"));
    if (context !== selection2) {
      path2 = path2.transition(context);
      tick = tick.transition(context);
      line2 = line2.transition(context);
      text2 = text2.transition(context);
      tickExit = tickExit.transition(context).attr("opacity", epsilon).attr("transform", function(d2) {
        return isFinite(d2 = position2(d2)) ? transform2(d2 + offset2) : this.getAttribute("transform");
      });
      tickEnter.attr("opacity", epsilon).attr("transform", function(d2) {
        var p2 = this.parentNode.__axis;
        return transform2((p2 && isFinite(p2 = p2(d2)) ? p2 : position2(d2)) + offset2);
      });
    }
    tickExit.remove();
    path2.attr("d", orient === left || orient === right ? tickSizeOuter ? "M" + k3 * tickSizeOuter + "," + range0 + "H" + offset2 + "V" + range1 + "H" + k3 * tickSizeOuter : "M" + offset2 + "," + range0 + "V" + range1 : tickSizeOuter ? "M" + range0 + "," + k3 * tickSizeOuter + "V" + offset2 + "H" + range1 + "V" + k3 * tickSizeOuter : "M" + range0 + "," + offset2 + "H" + range1);
    tick.attr("opacity", 1).attr("transform", function(d2) {
      return transform2(position2(d2) + offset2);
    });
    line2.attr(x3 + "2", k3 * tickSizeInner);
    text2.attr(x3, k3 * spacing).text(format3);
    selection2.filter(entering).attr("fill", "none").attr("font-size", 10).attr("font-family", "sans-serif").attr("text-anchor", orient === right ? "start" : orient === left ? "end" : "middle");
    selection2.each(function() {
      this.__axis = position2;
    });
  }
  axis2.scale = function(_24) {
    return arguments.length ? (scale = _24, axis2) : scale;
  };
  axis2.ticks = function() {
    return tickArguments = Array.from(arguments), axis2;
  };
  axis2.tickArguments = function(_24) {
    return arguments.length ? (tickArguments = _24 == null ? [] : Array.from(_24), axis2) : tickArguments.slice();
  };
  axis2.tickValues = function(_24) {
    return arguments.length ? (tickValues = _24 == null ? null : Array.from(_24), axis2) : tickValues && tickValues.slice();
  };
  axis2.tickFormat = function(_24) {
    return arguments.length ? (tickFormat2 = _24, axis2) : tickFormat2;
  };
  axis2.tickSize = function(_24) {
    return arguments.length ? (tickSizeInner = tickSizeOuter = +_24, axis2) : tickSizeInner;
  };
  axis2.tickSizeInner = function(_24) {
    return arguments.length ? (tickSizeInner = +_24, axis2) : tickSizeInner;
  };
  axis2.tickSizeOuter = function(_24) {
    return arguments.length ? (tickSizeOuter = +_24, axis2) : tickSizeOuter;
  };
  axis2.tickPadding = function(_24) {
    return arguments.length ? (tickPadding = +_24, axis2) : tickPadding;
  };
  axis2.offset = function(_24) {
    return arguments.length ? (offset2 = +_24, axis2) : offset2;
  };
  return axis2;
}
function axisBottom(scale) {
  return axis(bottom, scale);
}

// ../../node_modules/d3-dispatch/src/dispatch.js
var noop = { value: () => {
} };
function dispatch() {
  for (var i2 = 0, n2 = arguments.length, _24 = {}, t5; i2 < n2; ++i2) {
    if (!(t5 = arguments[i2] + "") || t5 in _24 || /[\s.]/.test(t5))
      throw new Error("illegal type: " + t5);
    _24[t5] = [];
  }
  return new Dispatch(_24);
}
function Dispatch(_24) {
  this._ = _24;
}
function parseTypenames(typenames, types) {
  return typenames.trim().split(/^|\s+/).map(function(t5) {
    var name = "", i2 = t5.indexOf(".");
    if (i2 >= 0)
      name = t5.slice(i2 + 1), t5 = t5.slice(0, i2);
    if (t5 && !types.hasOwnProperty(t5))
      throw new Error("unknown type: " + t5);
    return { type: t5, name };
  });
}
Dispatch.prototype = dispatch.prototype = {
  constructor: Dispatch,
  on: function(typename, callback) {
    var _24 = this._, T = parseTypenames(typename + "", _24), t5, i2 = -1, n2 = T.length;
    if (arguments.length < 2) {
      while (++i2 < n2)
        if ((t5 = (typename = T[i2]).type) && (t5 = get(_24[t5], typename.name)))
          return t5;
      return;
    }
    if (callback != null && typeof callback !== "function")
      throw new Error("invalid callback: " + callback);
    while (++i2 < n2) {
      if (t5 = (typename = T[i2]).type)
        _24[t5] = set(_24[t5], typename.name, callback);
      else if (callback == null)
        for (t5 in _24)
          _24[t5] = set(_24[t5], typename.name, null);
    }
    return this;
  },
  copy: function() {
    var copy4 = {}, _24 = this._;
    for (var t5 in _24)
      copy4[t5] = _24[t5].slice();
    return new Dispatch(copy4);
  },
  call: function(type2, that) {
    if ((n2 = arguments.length - 2) > 0)
      for (var args = new Array(n2), i2 = 0, n2, t5; i2 < n2; ++i2)
        args[i2] = arguments[i2 + 2];
    if (!this._.hasOwnProperty(type2))
      throw new Error("unknown type: " + type2);
    for (t5 = this._[type2], i2 = 0, n2 = t5.length; i2 < n2; ++i2)
      t5[i2].value.apply(that, args);
  },
  apply: function(type2, that, args) {
    if (!this._.hasOwnProperty(type2))
      throw new Error("unknown type: " + type2);
    for (var t5 = this._[type2], i2 = 0, n2 = t5.length; i2 < n2; ++i2)
      t5[i2].value.apply(that, args);
  }
};
function get(type2, name) {
  for (var i2 = 0, n2 = type2.length, c5; i2 < n2; ++i2) {
    if ((c5 = type2[i2]).name === name) {
      return c5.value;
    }
  }
}
function set(type2, name, callback) {
  for (var i2 = 0, n2 = type2.length; i2 < n2; ++i2) {
    if (type2[i2].name === name) {
      type2[i2] = noop, type2 = type2.slice(0, i2).concat(type2.slice(i2 + 1));
      break;
    }
  }
  if (callback != null)
    type2.push({ name, value: callback });
  return type2;
}
var dispatch_default = dispatch;

// ../../node_modules/d3-selection/src/namespaces.js
var xhtml = "http://www.w3.org/1999/xhtml";
var namespaces_default = {
  svg: "http://www.w3.org/2000/svg",
  xhtml,
  xlink: "http://www.w3.org/1999/xlink",
  xml: "http://www.w3.org/XML/1998/namespace",
  xmlns: "http://www.w3.org/2000/xmlns/"
};

// ../../node_modules/d3-selection/src/namespace.js
function namespace_default(name) {
  var prefix = name += "", i2 = prefix.indexOf(":");
  if (i2 >= 0 && (prefix = name.slice(0, i2)) !== "xmlns")
    name = name.slice(i2 + 1);
  return namespaces_default.hasOwnProperty(prefix) ? { space: namespaces_default[prefix], local: name } : name;
}

// ../../node_modules/d3-selection/src/creator.js
function creatorInherit(name) {
  return function() {
    var document2 = this.ownerDocument, uri = this.namespaceURI;
    return uri === xhtml && document2.documentElement.namespaceURI === xhtml ? document2.createElement(name) : document2.createElementNS(uri, name);
  };
}
function creatorFixed(fullname) {
  return function() {
    return this.ownerDocument.createElementNS(fullname.space, fullname.local);
  };
}
function creator_default(name) {
  var fullname = namespace_default(name);
  return (fullname.local ? creatorFixed : creatorInherit)(fullname);
}

// ../../node_modules/d3-selection/src/selector.js
function none() {
}
function selector_default(selector) {
  return selector == null ? none : function() {
    return this.querySelector(selector);
  };
}

// ../../node_modules/d3-selection/src/selection/select.js
function select_default(select) {
  if (typeof select !== "function")
    select = selector_default(select);
  for (var groups2 = this._groups, m = groups2.length, subgroups = new Array(m), j2 = 0; j2 < m; ++j2) {
    for (var group2 = groups2[j2], n2 = group2.length, subgroup = subgroups[j2] = new Array(n2), node, subnode, i2 = 0; i2 < n2; ++i2) {
      if ((node = group2[i2]) && (subnode = select.call(node, node.__data__, i2, group2))) {
        if ("__data__" in node)
          subnode.__data__ = node.__data__;
        subgroup[i2] = subnode;
      }
    }
  }
  return new Selection(subgroups, this._parents);
}

// ../../node_modules/d3-selection/src/array.js
function array(x3) {
  return x3 == null ? [] : Array.isArray(x3) ? x3 : Array.from(x3);
}

// ../../node_modules/d3-selection/src/selectorAll.js
function empty2() {
  return [];
}
function selectorAll_default(selector) {
  return selector == null ? empty2 : function() {
    return this.querySelectorAll(selector);
  };
}

// ../../node_modules/d3-selection/src/selection/selectAll.js
function arrayAll(select) {
  return function() {
    return array(select.apply(this, arguments));
  };
}
function selectAll_default(select) {
  if (typeof select === "function")
    select = arrayAll(select);
  else
    select = selectorAll_default(select);
  for (var groups2 = this._groups, m = groups2.length, subgroups = [], parents = [], j2 = 0; j2 < m; ++j2) {
    for (var group2 = groups2[j2], n2 = group2.length, node, i2 = 0; i2 < n2; ++i2) {
      if (node = group2[i2]) {
        subgroups.push(select.call(node, node.__data__, i2, group2));
        parents.push(node);
      }
    }
  }
  return new Selection(subgroups, parents);
}

// ../../node_modules/d3-selection/src/matcher.js
function matcher_default(selector) {
  return function() {
    return this.matches(selector);
  };
}
function childMatcher(selector) {
  return function(node) {
    return node.matches(selector);
  };
}

// ../../node_modules/d3-selection/src/selection/selectChild.js
var find = Array.prototype.find;
function childFind(match) {
  return function() {
    return find.call(this.children, match);
  };
}
function childFirst() {
  return this.firstElementChild;
}
function selectChild_default(match) {
  return this.select(match == null ? childFirst : childFind(typeof match === "function" ? match : childMatcher(match)));
}

// ../../node_modules/d3-selection/src/selection/selectChildren.js
var filter = Array.prototype.filter;
function children() {
  return Array.from(this.children);
}
function childrenFilter(match) {
  return function() {
    return filter.call(this.children, match);
  };
}
function selectChildren_default(match) {
  return this.selectAll(match == null ? children : childrenFilter(typeof match === "function" ? match : childMatcher(match)));
}

// ../../node_modules/d3-selection/src/selection/filter.js
function filter_default(match) {
  if (typeof match !== "function")
    match = matcher_default(match);
  for (var groups2 = this._groups, m = groups2.length, subgroups = new Array(m), j2 = 0; j2 < m; ++j2) {
    for (var group2 = groups2[j2], n2 = group2.length, subgroup = subgroups[j2] = [], node, i2 = 0; i2 < n2; ++i2) {
      if ((node = group2[i2]) && match.call(node, node.__data__, i2, group2)) {
        subgroup.push(node);
      }
    }
  }
  return new Selection(subgroups, this._parents);
}

// ../../node_modules/d3-selection/src/selection/sparse.js
function sparse_default(update) {
  return new Array(update.length);
}

// ../../node_modules/d3-selection/src/selection/enter.js
function enter_default() {
  return new Selection(this._enter || this._groups.map(sparse_default), this._parents);
}
function EnterNode(parent, datum2) {
  this.ownerDocument = parent.ownerDocument;
  this.namespaceURI = parent.namespaceURI;
  this._next = null;
  this._parent = parent;
  this.__data__ = datum2;
}
EnterNode.prototype = {
  constructor: EnterNode,
  appendChild: function(child) {
    return this._parent.insertBefore(child, this._next);
  },
  insertBefore: function(child, next) {
    return this._parent.insertBefore(child, next);
  },
  querySelector: function(selector) {
    return this._parent.querySelector(selector);
  },
  querySelectorAll: function(selector) {
    return this._parent.querySelectorAll(selector);
  }
};

// ../../node_modules/d3-selection/src/constant.js
function constant_default(x3) {
  return function() {
    return x3;
  };
}

// ../../node_modules/d3-selection/src/selection/data.js
function bindIndex(parent, group2, enter, update, exit, data) {
  var i2 = 0, node, groupLength = group2.length, dataLength = data.length;
  for (; i2 < dataLength; ++i2) {
    if (node = group2[i2]) {
      node.__data__ = data[i2];
      update[i2] = node;
    } else {
      enter[i2] = new EnterNode(parent, data[i2]);
    }
  }
  for (; i2 < groupLength; ++i2) {
    if (node = group2[i2]) {
      exit[i2] = node;
    }
  }
}
function bindKey(parent, group2, enter, update, exit, data, key) {
  var i2, node, nodeByKeyValue = /* @__PURE__ */ new Map(), groupLength = group2.length, dataLength = data.length, keyValues = new Array(groupLength), keyValue;
  for (i2 = 0; i2 < groupLength; ++i2) {
    if (node = group2[i2]) {
      keyValues[i2] = keyValue = key.call(node, node.__data__, i2, group2) + "";
      if (nodeByKeyValue.has(keyValue)) {
        exit[i2] = node;
      } else {
        nodeByKeyValue.set(keyValue, node);
      }
    }
  }
  for (i2 = 0; i2 < dataLength; ++i2) {
    keyValue = key.call(parent, data[i2], i2, data) + "";
    if (node = nodeByKeyValue.get(keyValue)) {
      update[i2] = node;
      node.__data__ = data[i2];
      nodeByKeyValue.delete(keyValue);
    } else {
      enter[i2] = new EnterNode(parent, data[i2]);
    }
  }
  for (i2 = 0; i2 < groupLength; ++i2) {
    if ((node = group2[i2]) && nodeByKeyValue.get(keyValues[i2]) === node) {
      exit[i2] = node;
    }
  }
}
function datum(node) {
  return node.__data__;
}
function data_default(value, key) {
  if (!arguments.length)
    return Array.from(this, datum);
  var bind = key ? bindKey : bindIndex, parents = this._parents, groups2 = this._groups;
  if (typeof value !== "function")
    value = constant_default(value);
  for (var m = groups2.length, update = new Array(m), enter = new Array(m), exit = new Array(m), j2 = 0; j2 < m; ++j2) {
    var parent = parents[j2], group2 = groups2[j2], groupLength = group2.length, data = arraylike(value.call(parent, parent && parent.__data__, j2, parents)), dataLength = data.length, enterGroup = enter[j2] = new Array(dataLength), updateGroup = update[j2] = new Array(dataLength), exitGroup = exit[j2] = new Array(groupLength);
    bind(parent, group2, enterGroup, updateGroup, exitGroup, data, key);
    for (var i0 = 0, i1 = 0, previous, next; i0 < dataLength; ++i0) {
      if (previous = enterGroup[i0]) {
        if (i0 >= i1)
          i1 = i0 + 1;
        while (!(next = updateGroup[i1]) && ++i1 < dataLength)
          ;
        previous._next = next || null;
      }
    }
  }
  update = new Selection(update, parents);
  update._enter = enter;
  update._exit = exit;
  return update;
}
function arraylike(data) {
  return typeof data === "object" && "length" in data ? data : Array.from(data);
}

// ../../node_modules/d3-selection/src/selection/exit.js
function exit_default() {
  return new Selection(this._exit || this._groups.map(sparse_default), this._parents);
}

// ../../node_modules/d3-selection/src/selection/join.js
function join_default(onenter, onupdate, onexit) {
  var enter = this.enter(), update = this, exit = this.exit();
  if (typeof onenter === "function") {
    enter = onenter(enter);
    if (enter)
      enter = enter.selection();
  } else {
    enter = enter.append(onenter + "");
  }
  if (onupdate != null) {
    update = onupdate(update);
    if (update)
      update = update.selection();
  }
  if (onexit == null)
    exit.remove();
  else
    onexit(exit);
  return enter && update ? enter.merge(update).order() : update;
}

// ../../node_modules/d3-selection/src/selection/merge.js
function merge_default(context) {
  var selection2 = context.selection ? context.selection() : context;
  for (var groups0 = this._groups, groups1 = selection2._groups, m0 = groups0.length, m1 = groups1.length, m = Math.min(m0, m1), merges = new Array(m0), j2 = 0; j2 < m; ++j2) {
    for (var group0 = groups0[j2], group1 = groups1[j2], n2 = group0.length, merge2 = merges[j2] = new Array(n2), node, i2 = 0; i2 < n2; ++i2) {
      if (node = group0[i2] || group1[i2]) {
        merge2[i2] = node;
      }
    }
  }
  for (; j2 < m0; ++j2) {
    merges[j2] = groups0[j2];
  }
  return new Selection(merges, this._parents);
}

// ../../node_modules/d3-selection/src/selection/order.js
function order_default() {
  for (var groups2 = this._groups, j2 = -1, m = groups2.length; ++j2 < m; ) {
    for (var group2 = groups2[j2], i2 = group2.length - 1, next = group2[i2], node; --i2 >= 0; ) {
      if (node = group2[i2]) {
        if (next && node.compareDocumentPosition(next) ^ 4)
          next.parentNode.insertBefore(node, next);
        next = node;
      }
    }
  }
  return this;
}

// ../../node_modules/d3-selection/src/selection/sort.js
function sort_default(compare) {
  if (!compare)
    compare = ascending2;
  function compareNode(a3, b2) {
    return a3 && b2 ? compare(a3.__data__, b2.__data__) : !a3 - !b2;
  }
  for (var groups2 = this._groups, m = groups2.length, sortgroups = new Array(m), j2 = 0; j2 < m; ++j2) {
    for (var group2 = groups2[j2], n2 = group2.length, sortgroup = sortgroups[j2] = new Array(n2), node, i2 = 0; i2 < n2; ++i2) {
      if (node = group2[i2]) {
        sortgroup[i2] = node;
      }
    }
    sortgroup.sort(compareNode);
  }
  return new Selection(sortgroups, this._parents).order();
}
function ascending2(a3, b2) {
  return a3 < b2 ? -1 : a3 > b2 ? 1 : a3 >= b2 ? 0 : NaN;
}

// ../../node_modules/d3-selection/src/selection/call.js
function call_default() {
  var callback = arguments[0];
  arguments[0] = this;
  callback.apply(null, arguments);
  return this;
}

// ../../node_modules/d3-selection/src/selection/nodes.js
function nodes_default() {
  return Array.from(this);
}

// ../../node_modules/d3-selection/src/selection/node.js
function node_default() {
  for (var groups2 = this._groups, j2 = 0, m = groups2.length; j2 < m; ++j2) {
    for (var group2 = groups2[j2], i2 = 0, n2 = group2.length; i2 < n2; ++i2) {
      var node = group2[i2];
      if (node)
        return node;
    }
  }
  return null;
}

// ../../node_modules/d3-selection/src/selection/size.js
function size_default() {
  let size = 0;
  for (const node of this)
    ++size;
  return size;
}

// ../../node_modules/d3-selection/src/selection/empty.js
function empty_default() {
  return !this.node();
}

// ../../node_modules/d3-selection/src/selection/each.js
function each_default(callback) {
  for (var groups2 = this._groups, j2 = 0, m = groups2.length; j2 < m; ++j2) {
    for (var group2 = groups2[j2], i2 = 0, n2 = group2.length, node; i2 < n2; ++i2) {
      if (node = group2[i2])
        callback.call(node, node.__data__, i2, group2);
    }
  }
  return this;
}

// ../../node_modules/d3-selection/src/selection/attr.js
function attrRemove(name) {
  return function() {
    this.removeAttribute(name);
  };
}
function attrRemoveNS(fullname) {
  return function() {
    this.removeAttributeNS(fullname.space, fullname.local);
  };
}
function attrConstant(name, value) {
  return function() {
    this.setAttribute(name, value);
  };
}
function attrConstantNS(fullname, value) {
  return function() {
    this.setAttributeNS(fullname.space, fullname.local, value);
  };
}
function attrFunction(name, value) {
  return function() {
    var v2 = value.apply(this, arguments);
    if (v2 == null)
      this.removeAttribute(name);
    else
      this.setAttribute(name, v2);
  };
}
function attrFunctionNS(fullname, value) {
  return function() {
    var v2 = value.apply(this, arguments);
    if (v2 == null)
      this.removeAttributeNS(fullname.space, fullname.local);
    else
      this.setAttributeNS(fullname.space, fullname.local, v2);
  };
}
function attr_default(name, value) {
  var fullname = namespace_default(name);
  if (arguments.length < 2) {
    var node = this.node();
    return fullname.local ? node.getAttributeNS(fullname.space, fullname.local) : node.getAttribute(fullname);
  }
  return this.each((value == null ? fullname.local ? attrRemoveNS : attrRemove : typeof value === "function" ? fullname.local ? attrFunctionNS : attrFunction : fullname.local ? attrConstantNS : attrConstant)(fullname, value));
}

// ../../node_modules/d3-selection/src/window.js
function window_default(node) {
  return node.ownerDocument && node.ownerDocument.defaultView || node.document && node || node.defaultView;
}

// ../../node_modules/d3-selection/src/selection/style.js
function styleRemove(name) {
  return function() {
    this.style.removeProperty(name);
  };
}
function styleConstant(name, value, priority) {
  return function() {
    this.style.setProperty(name, value, priority);
  };
}
function styleFunction(name, value, priority) {
  return function() {
    var v2 = value.apply(this, arguments);
    if (v2 == null)
      this.style.removeProperty(name);
    else
      this.style.setProperty(name, v2, priority);
  };
}
function style_default(name, value, priority) {
  return arguments.length > 1 ? this.each((value == null ? styleRemove : typeof value === "function" ? styleFunction : styleConstant)(name, value, priority == null ? "" : priority)) : styleValue(this.node(), name);
}
function styleValue(node, name) {
  return node.style.getPropertyValue(name) || window_default(node).getComputedStyle(node, null).getPropertyValue(name);
}

// ../../node_modules/d3-selection/src/selection/property.js
function propertyRemove(name) {
  return function() {
    delete this[name];
  };
}
function propertyConstant(name, value) {
  return function() {
    this[name] = value;
  };
}
function propertyFunction(name, value) {
  return function() {
    var v2 = value.apply(this, arguments);
    if (v2 == null)
      delete this[name];
    else
      this[name] = v2;
  };
}
function property_default(name, value) {
  return arguments.length > 1 ? this.each((value == null ? propertyRemove : typeof value === "function" ? propertyFunction : propertyConstant)(name, value)) : this.node()[name];
}

// ../../node_modules/d3-selection/src/selection/classed.js
function classArray(string2) {
  return string2.trim().split(/^|\s+/);
}
function classList(node) {
  return node.classList || new ClassList(node);
}
function ClassList(node) {
  this._node = node;
  this._names = classArray(node.getAttribute("class") || "");
}
ClassList.prototype = {
  add: function(name) {
    var i2 = this._names.indexOf(name);
    if (i2 < 0) {
      this._names.push(name);
      this._node.setAttribute("class", this._names.join(" "));
    }
  },
  remove: function(name) {
    var i2 = this._names.indexOf(name);
    if (i2 >= 0) {
      this._names.splice(i2, 1);
      this._node.setAttribute("class", this._names.join(" "));
    }
  },
  contains: function(name) {
    return this._names.indexOf(name) >= 0;
  }
};
function classedAdd(node, names) {
  var list = classList(node), i2 = -1, n2 = names.length;
  while (++i2 < n2)
    list.add(names[i2]);
}
function classedRemove(node, names) {
  var list = classList(node), i2 = -1, n2 = names.length;
  while (++i2 < n2)
    list.remove(names[i2]);
}
function classedTrue(names) {
  return function() {
    classedAdd(this, names);
  };
}
function classedFalse(names) {
  return function() {
    classedRemove(this, names);
  };
}
function classedFunction(names, value) {
  return function() {
    (value.apply(this, arguments) ? classedAdd : classedRemove)(this, names);
  };
}
function classed_default(name, value) {
  var names = classArray(name + "");
  if (arguments.length < 2) {
    var list = classList(this.node()), i2 = -1, n2 = names.length;
    while (++i2 < n2)
      if (!list.contains(names[i2]))
        return false;
    return true;
  }
  return this.each((typeof value === "function" ? classedFunction : value ? classedTrue : classedFalse)(names, value));
}

// ../../node_modules/d3-selection/src/selection/text.js
function textRemove() {
  this.textContent = "";
}
function textConstant(value) {
  return function() {
    this.textContent = value;
  };
}
function textFunction(value) {
  return function() {
    var v2 = value.apply(this, arguments);
    this.textContent = v2 == null ? "" : v2;
  };
}
function text_default(value) {
  return arguments.length ? this.each(value == null ? textRemove : (typeof value === "function" ? textFunction : textConstant)(value)) : this.node().textContent;
}

// ../../node_modules/d3-selection/src/selection/html.js
function htmlRemove() {
  this.innerHTML = "";
}
function htmlConstant(value) {
  return function() {
    this.innerHTML = value;
  };
}
function htmlFunction(value) {
  return function() {
    var v2 = value.apply(this, arguments);
    this.innerHTML = v2 == null ? "" : v2;
  };
}
function html_default(value) {
  return arguments.length ? this.each(value == null ? htmlRemove : (typeof value === "function" ? htmlFunction : htmlConstant)(value)) : this.node().innerHTML;
}

// ../../node_modules/d3-selection/src/selection/raise.js
function raise() {
  if (this.nextSibling)
    this.parentNode.appendChild(this);
}
function raise_default() {
  return this.each(raise);
}

// ../../node_modules/d3-selection/src/selection/lower.js
function lower() {
  if (this.previousSibling)
    this.parentNode.insertBefore(this, this.parentNode.firstChild);
}
function lower_default() {
  return this.each(lower);
}

// ../../node_modules/d3-selection/src/selection/append.js
function append_default(name) {
  var create3 = typeof name === "function" ? name : creator_default(name);
  return this.select(function() {
    return this.appendChild(create3.apply(this, arguments));
  });
}

// ../../node_modules/d3-selection/src/selection/insert.js
function constantNull() {
  return null;
}
function insert_default(name, before) {
  var create3 = typeof name === "function" ? name : creator_default(name), select = before == null ? constantNull : typeof before === "function" ? before : selector_default(before);
  return this.select(function() {
    return this.insertBefore(create3.apply(this, arguments), select.apply(this, arguments) || null);
  });
}

// ../../node_modules/d3-selection/src/selection/remove.js
function remove() {
  var parent = this.parentNode;
  if (parent)
    parent.removeChild(this);
}
function remove_default() {
  return this.each(remove);
}

// ../../node_modules/d3-selection/src/selection/clone.js
function selection_cloneShallow() {
  var clone = this.cloneNode(false), parent = this.parentNode;
  return parent ? parent.insertBefore(clone, this.nextSibling) : clone;
}
function selection_cloneDeep() {
  var clone = this.cloneNode(true), parent = this.parentNode;
  return parent ? parent.insertBefore(clone, this.nextSibling) : clone;
}
function clone_default(deep) {
  return this.select(deep ? selection_cloneDeep : selection_cloneShallow);
}

// ../../node_modules/d3-selection/src/selection/datum.js
function datum_default(value) {
  return arguments.length ? this.property("__data__", value) : this.node().__data__;
}

// ../../node_modules/d3-selection/src/selection/on.js
function contextListener(listener) {
  return function(event) {
    listener.call(this, event, this.__data__);
  };
}
function parseTypenames2(typenames) {
  return typenames.trim().split(/^|\s+/).map(function(t5) {
    var name = "", i2 = t5.indexOf(".");
    if (i2 >= 0)
      name = t5.slice(i2 + 1), t5 = t5.slice(0, i2);
    return { type: t5, name };
  });
}
function onRemove(typename) {
  return function() {
    var on2 = this.__on;
    if (!on2)
      return;
    for (var j2 = 0, i2 = -1, m = on2.length, o2; j2 < m; ++j2) {
      if (o2 = on2[j2], (!typename.type || o2.type === typename.type) && o2.name === typename.name) {
        this.removeEventListener(o2.type, o2.listener, o2.options);
      } else {
        on2[++i2] = o2;
      }
    }
    if (++i2)
      on2.length = i2;
    else
      delete this.__on;
  };
}
function onAdd(typename, value, options) {
  return function() {
    var on2 = this.__on, o2, listener = contextListener(value);
    if (on2)
      for (var j2 = 0, m = on2.length; j2 < m; ++j2) {
        if ((o2 = on2[j2]).type === typename.type && o2.name === typename.name) {
          this.removeEventListener(o2.type, o2.listener, o2.options);
          this.addEventListener(o2.type, o2.listener = listener, o2.options = options);
          o2.value = value;
          return;
        }
      }
    this.addEventListener(typename.type, listener, options);
    o2 = { type: typename.type, name: typename.name, value, listener, options };
    if (!on2)
      this.__on = [o2];
    else
      on2.push(o2);
  };
}
function on_default(typename, value, options) {
  var typenames = parseTypenames2(typename + ""), i2, n2 = typenames.length, t5;
  if (arguments.length < 2) {
    var on2 = this.node().__on;
    if (on2)
      for (var j2 = 0, m = on2.length, o2; j2 < m; ++j2) {
        for (i2 = 0, o2 = on2[j2]; i2 < n2; ++i2) {
          if ((t5 = typenames[i2]).type === o2.type && t5.name === o2.name) {
            return o2.value;
          }
        }
      }
    return;
  }
  on2 = value ? onAdd : onRemove;
  for (i2 = 0; i2 < n2; ++i2)
    this.each(on2(typenames[i2], value, options));
  return this;
}

// ../../node_modules/d3-selection/src/selection/dispatch.js
function dispatchEvent(node, type2, params) {
  var window2 = window_default(node), event = window2.CustomEvent;
  if (typeof event === "function") {
    event = new event(type2, params);
  } else {
    event = window2.document.createEvent("Event");
    if (params)
      event.initEvent(type2, params.bubbles, params.cancelable), event.detail = params.detail;
    else
      event.initEvent(type2, false, false);
  }
  node.dispatchEvent(event);
}
function dispatchConstant(type2, params) {
  return function() {
    return dispatchEvent(this, type2, params);
  };
}
function dispatchFunction(type2, params) {
  return function() {
    return dispatchEvent(this, type2, params.apply(this, arguments));
  };
}
function dispatch_default2(type2, params) {
  return this.each((typeof params === "function" ? dispatchFunction : dispatchConstant)(type2, params));
}

// ../../node_modules/d3-selection/src/selection/iterator.js
function* iterator_default() {
  for (var groups2 = this._groups, j2 = 0, m = groups2.length; j2 < m; ++j2) {
    for (var group2 = groups2[j2], i2 = 0, n2 = group2.length, node; i2 < n2; ++i2) {
      if (node = group2[i2])
        yield node;
    }
  }
}

// ../../node_modules/d3-selection/src/selection/index.js
var root = [null];
function Selection(groups2, parents) {
  this._groups = groups2;
  this._parents = parents;
}
function selection() {
  return new Selection([[document.documentElement]], root);
}
function selection_selection() {
  return this;
}
Selection.prototype = selection.prototype = {
  constructor: Selection,
  select: select_default,
  selectAll: selectAll_default,
  selectChild: selectChild_default,
  selectChildren: selectChildren_default,
  filter: filter_default,
  data: data_default,
  enter: enter_default,
  exit: exit_default,
  join: join_default,
  merge: merge_default,
  selection: selection_selection,
  order: order_default,
  sort: sort_default,
  call: call_default,
  nodes: nodes_default,
  node: node_default,
  size: size_default,
  empty: empty_default,
  each: each_default,
  attr: attr_default,
  style: style_default,
  property: property_default,
  classed: classed_default,
  text: text_default,
  html: html_default,
  raise: raise_default,
  lower: lower_default,
  append: append_default,
  insert: insert_default,
  remove: remove_default,
  clone: clone_default,
  datum: datum_default,
  on: on_default,
  dispatch: dispatch_default2,
  [Symbol.iterator]: iterator_default
};
var selection_default = selection;

// ../../node_modules/d3-selection/src/select.js
function select_default2(selector) {
  return typeof selector === "string" ? new Selection([[document.querySelector(selector)]], [document.documentElement]) : new Selection([[selector]], root);
}

// ../../node_modules/d3-selection/src/sourceEvent.js
function sourceEvent_default(event) {
  let sourceEvent;
  while (sourceEvent = event.sourceEvent)
    event = sourceEvent;
  return event;
}

// ../../node_modules/d3-selection/src/pointer.js
function pointer_default(event, node) {
  event = sourceEvent_default(event);
  if (node === void 0)
    node = event.currentTarget;
  if (node) {
    var svg = node.ownerSVGElement || node;
    if (svg.createSVGPoint) {
      var point6 = svg.createSVGPoint();
      point6.x = event.clientX, point6.y = event.clientY;
      point6 = point6.matrixTransform(node.getScreenCTM().inverse());
      return [point6.x, point6.y];
    }
    if (node.getBoundingClientRect) {
      var rect2 = node.getBoundingClientRect();
      return [event.clientX - rect2.left - node.clientLeft, event.clientY - rect2.top - node.clientTop];
    }
  }
  return [event.pageX, event.pageY];
}

// ../../node_modules/d3-color/src/define.js
function define_default(constructor, factory, prototype) {
  constructor.prototype = factory.prototype = prototype;
  prototype.constructor = constructor;
}
function extend(parent, definition) {
  var prototype = Object.create(parent.prototype);
  for (var key in definition)
    prototype[key] = definition[key];
  return prototype;
}

// ../../node_modules/d3-color/src/color.js
function Color() {
}
var darker = 0.7;
var brighter = 1 / darker;
var reI = "\\s*([+-]?\\d+)\\s*";
var reN = "\\s*([+-]?(?:\\d*\\.)?\\d+(?:[eE][+-]?\\d+)?)\\s*";
var reP = "\\s*([+-]?(?:\\d*\\.)?\\d+(?:[eE][+-]?\\d+)?)%\\s*";
var reHex = /^#([0-9a-f]{3,8})$/;
var reRgbInteger = new RegExp(`^rgb\\(${reI},${reI},${reI}\\)$`);
var reRgbPercent = new RegExp(`^rgb\\(${reP},${reP},${reP}\\)$`);
var reRgbaInteger = new RegExp(`^rgba\\(${reI},${reI},${reI},${reN}\\)$`);
var reRgbaPercent = new RegExp(`^rgba\\(${reP},${reP},${reP},${reN}\\)$`);
var reHslPercent = new RegExp(`^hsl\\(${reN},${reP},${reP}\\)$`);
var reHslaPercent = new RegExp(`^hsla\\(${reN},${reP},${reP},${reN}\\)$`);
var named = {
  aliceblue: 15792383,
  antiquewhite: 16444375,
  aqua: 65535,
  aquamarine: 8388564,
  azure: 15794175,
  beige: 16119260,
  bisque: 16770244,
  black: 0,
  blanchedalmond: 16772045,
  blue: 255,
  blueviolet: 9055202,
  brown: 10824234,
  burlywood: 14596231,
  cadetblue: 6266528,
  chartreuse: 8388352,
  chocolate: 13789470,
  coral: 16744272,
  cornflowerblue: 6591981,
  cornsilk: 16775388,
  crimson: 14423100,
  cyan: 65535,
  darkblue: 139,
  darkcyan: 35723,
  darkgoldenrod: 12092939,
  darkgray: 11119017,
  darkgreen: 25600,
  darkgrey: 11119017,
  darkkhaki: 12433259,
  darkmagenta: 9109643,
  darkolivegreen: 5597999,
  darkorange: 16747520,
  darkorchid: 10040012,
  darkred: 9109504,
  darksalmon: 15308410,
  darkseagreen: 9419919,
  darkslateblue: 4734347,
  darkslategray: 3100495,
  darkslategrey: 3100495,
  darkturquoise: 52945,
  darkviolet: 9699539,
  deeppink: 16716947,
  deepskyblue: 49151,
  dimgray: 6908265,
  dimgrey: 6908265,
  dodgerblue: 2003199,
  firebrick: 11674146,
  floralwhite: 16775920,
  forestgreen: 2263842,
  fuchsia: 16711935,
  gainsboro: 14474460,
  ghostwhite: 16316671,
  gold: 16766720,
  goldenrod: 14329120,
  gray: 8421504,
  green: 32768,
  greenyellow: 11403055,
  grey: 8421504,
  honeydew: 15794160,
  hotpink: 16738740,
  indianred: 13458524,
  indigo: 4915330,
  ivory: 16777200,
  khaki: 15787660,
  lavender: 15132410,
  lavenderblush: 16773365,
  lawngreen: 8190976,
  lemonchiffon: 16775885,
  lightblue: 11393254,
  lightcoral: 15761536,
  lightcyan: 14745599,
  lightgoldenrodyellow: 16448210,
  lightgray: 13882323,
  lightgreen: 9498256,
  lightgrey: 13882323,
  lightpink: 16758465,
  lightsalmon: 16752762,
  lightseagreen: 2142890,
  lightskyblue: 8900346,
  lightslategray: 7833753,
  lightslategrey: 7833753,
  lightsteelblue: 11584734,
  lightyellow: 16777184,
  lime: 65280,
  limegreen: 3329330,
  linen: 16445670,
  magenta: 16711935,
  maroon: 8388608,
  mediumaquamarine: 6737322,
  mediumblue: 205,
  mediumorchid: 12211667,
  mediumpurple: 9662683,
  mediumseagreen: 3978097,
  mediumslateblue: 8087790,
  mediumspringgreen: 64154,
  mediumturquoise: 4772300,
  mediumvioletred: 13047173,
  midnightblue: 1644912,
  mintcream: 16121850,
  mistyrose: 16770273,
  moccasin: 16770229,
  navajowhite: 16768685,
  navy: 128,
  oldlace: 16643558,
  olive: 8421376,
  olivedrab: 7048739,
  orange: 16753920,
  orangered: 16729344,
  orchid: 14315734,
  palegoldenrod: 15657130,
  palegreen: 10025880,
  paleturquoise: 11529966,
  palevioletred: 14381203,
  papayawhip: 16773077,
  peachpuff: 16767673,
  peru: 13468991,
  pink: 16761035,
  plum: 14524637,
  powderblue: 11591910,
  purple: 8388736,
  rebeccapurple: 6697881,
  red: 16711680,
  rosybrown: 12357519,
  royalblue: 4286945,
  saddlebrown: 9127187,
  salmon: 16416882,
  sandybrown: 16032864,
  seagreen: 3050327,
  seashell: 16774638,
  sienna: 10506797,
  silver: 12632256,
  skyblue: 8900331,
  slateblue: 6970061,
  slategray: 7372944,
  slategrey: 7372944,
  snow: 16775930,
  springgreen: 65407,
  steelblue: 4620980,
  tan: 13808780,
  teal: 32896,
  thistle: 14204888,
  tomato: 16737095,
  turquoise: 4251856,
  violet: 15631086,
  wheat: 16113331,
  white: 16777215,
  whitesmoke: 16119285,
  yellow: 16776960,
  yellowgreen: 10145074
};
define_default(Color, color, {
  copy(channels) {
    return Object.assign(new this.constructor(), this, channels);
  },
  displayable() {
    return this.rgb().displayable();
  },
  hex: color_formatHex,
  // Deprecated! Use color.formatHex.
  formatHex: color_formatHex,
  formatHex8: color_formatHex8,
  formatHsl: color_formatHsl,
  formatRgb: color_formatRgb,
  toString: color_formatRgb
});
function color_formatHex() {
  return this.rgb().formatHex();
}
function color_formatHex8() {
  return this.rgb().formatHex8();
}
function color_formatHsl() {
  return hslConvert(this).formatHsl();
}
function color_formatRgb() {
  return this.rgb().formatRgb();
}
function color(format3) {
  var m, l2;
  format3 = (format3 + "").trim().toLowerCase();
  return (m = reHex.exec(format3)) ? (l2 = m[1].length, m = parseInt(m[1], 16), l2 === 6 ? rgbn(m) : l2 === 3 ? new Rgb(m >> 8 & 15 | m >> 4 & 240, m >> 4 & 15 | m & 240, (m & 15) << 4 | m & 15, 1) : l2 === 8 ? rgba(m >> 24 & 255, m >> 16 & 255, m >> 8 & 255, (m & 255) / 255) : l2 === 4 ? rgba(m >> 12 & 15 | m >> 8 & 240, m >> 8 & 15 | m >> 4 & 240, m >> 4 & 15 | m & 240, ((m & 15) << 4 | m & 15) / 255) : null) : (m = reRgbInteger.exec(format3)) ? new Rgb(m[1], m[2], m[3], 1) : (m = reRgbPercent.exec(format3)) ? new Rgb(m[1] * 255 / 100, m[2] * 255 / 100, m[3] * 255 / 100, 1) : (m = reRgbaInteger.exec(format3)) ? rgba(m[1], m[2], m[3], m[4]) : (m = reRgbaPercent.exec(format3)) ? rgba(m[1] * 255 / 100, m[2] * 255 / 100, m[3] * 255 / 100, m[4]) : (m = reHslPercent.exec(format3)) ? hsla(m[1], m[2] / 100, m[3] / 100, 1) : (m = reHslaPercent.exec(format3)) ? hsla(m[1], m[2] / 100, m[3] / 100, m[4]) : named.hasOwnProperty(format3) ? rgbn(named[format3]) : format3 === "transparent" ? new Rgb(NaN, NaN, NaN, 0) : null;
}
function rgbn(n2) {
  return new Rgb(n2 >> 16 & 255, n2 >> 8 & 255, n2 & 255, 1);
}
function rgba(r2, g2, b2, a3) {
  if (a3 <= 0)
    r2 = g2 = b2 = NaN;
  return new Rgb(r2, g2, b2, a3);
}
function rgbConvert(o2) {
  if (!(o2 instanceof Color))
    o2 = color(o2);
  if (!o2)
    return new Rgb();
  o2 = o2.rgb();
  return new Rgb(o2.r, o2.g, o2.b, o2.opacity);
}
function rgb(r2, g2, b2, opacity2) {
  return arguments.length === 1 ? rgbConvert(r2) : new Rgb(r2, g2, b2, opacity2 == null ? 1 : opacity2);
}
function Rgb(r2, g2, b2, opacity2) {
  this.r = +r2;
  this.g = +g2;
  this.b = +b2;
  this.opacity = +opacity2;
}
define_default(Rgb, rgb, extend(Color, {
  brighter(k3) {
    k3 = k3 == null ? brighter : Math.pow(brighter, k3);
    return new Rgb(this.r * k3, this.g * k3, this.b * k3, this.opacity);
  },
  darker(k3) {
    k3 = k3 == null ? darker : Math.pow(darker, k3);
    return new Rgb(this.r * k3, this.g * k3, this.b * k3, this.opacity);
  },
  rgb() {
    return this;
  },
  clamp() {
    return new Rgb(clampi(this.r), clampi(this.g), clampi(this.b), clampa(this.opacity));
  },
  displayable() {
    return -0.5 <= this.r && this.r < 255.5 && (-0.5 <= this.g && this.g < 255.5) && (-0.5 <= this.b && this.b < 255.5) && (0 <= this.opacity && this.opacity <= 1);
  },
  hex: rgb_formatHex,
  // Deprecated! Use color.formatHex.
  formatHex: rgb_formatHex,
  formatHex8: rgb_formatHex8,
  formatRgb: rgb_formatRgb,
  toString: rgb_formatRgb
}));
function rgb_formatHex() {
  return `#${hex(this.r)}${hex(this.g)}${hex(this.b)}`;
}
function rgb_formatHex8() {
  return `#${hex(this.r)}${hex(this.g)}${hex(this.b)}${hex((isNaN(this.opacity) ? 1 : this.opacity) * 255)}`;
}
function rgb_formatRgb() {
  const a3 = clampa(this.opacity);
  return `${a3 === 1 ? "rgb(" : "rgba("}${clampi(this.r)}, ${clampi(this.g)}, ${clampi(this.b)}${a3 === 1 ? ")" : `, ${a3})`}`;
}
function clampa(opacity2) {
  return isNaN(opacity2) ? 1 : Math.max(0, Math.min(1, opacity2));
}
function clampi(value) {
  return Math.max(0, Math.min(255, Math.round(value) || 0));
}
function hex(value) {
  value = clampi(value);
  return (value < 16 ? "0" : "") + value.toString(16);
}
function hsla(h2, s3, l2, a3) {
  if (a3 <= 0)
    h2 = s3 = l2 = NaN;
  else if (l2 <= 0 || l2 >= 1)
    h2 = s3 = NaN;
  else if (s3 <= 0)
    h2 = NaN;
  return new Hsl(h2, s3, l2, a3);
}
function hslConvert(o2) {
  if (o2 instanceof Hsl)
    return new Hsl(o2.h, o2.s, o2.l, o2.opacity);
  if (!(o2 instanceof Color))
    o2 = color(o2);
  if (!o2)
    return new Hsl();
  if (o2 instanceof Hsl)
    return o2;
  o2 = o2.rgb();
  var r2 = o2.r / 255, g2 = o2.g / 255, b2 = o2.b / 255, min4 = Math.min(r2, g2, b2), max3 = Math.max(r2, g2, b2), h2 = NaN, s3 = max3 - min4, l2 = (max3 + min4) / 2;
  if (s3) {
    if (r2 === max3)
      h2 = (g2 - b2) / s3 + (g2 < b2) * 6;
    else if (g2 === max3)
      h2 = (b2 - r2) / s3 + 2;
    else
      h2 = (r2 - g2) / s3 + 4;
    s3 /= l2 < 0.5 ? max3 + min4 : 2 - max3 - min4;
    h2 *= 60;
  } else {
    s3 = l2 > 0 && l2 < 1 ? 0 : h2;
  }
  return new Hsl(h2, s3, l2, o2.opacity);
}
function hsl(h2, s3, l2, opacity2) {
  return arguments.length === 1 ? hslConvert(h2) : new Hsl(h2, s3, l2, opacity2 == null ? 1 : opacity2);
}
function Hsl(h2, s3, l2, opacity2) {
  this.h = +h2;
  this.s = +s3;
  this.l = +l2;
  this.opacity = +opacity2;
}
define_default(Hsl, hsl, extend(Color, {
  brighter(k3) {
    k3 = k3 == null ? brighter : Math.pow(brighter, k3);
    return new Hsl(this.h, this.s, this.l * k3, this.opacity);
  },
  darker(k3) {
    k3 = k3 == null ? darker : Math.pow(darker, k3);
    return new Hsl(this.h, this.s, this.l * k3, this.opacity);
  },
  rgb() {
    var h2 = this.h % 360 + (this.h < 0) * 360, s3 = isNaN(h2) || isNaN(this.s) ? 0 : this.s, l2 = this.l, m2 = l2 + (l2 < 0.5 ? l2 : 1 - l2) * s3, m1 = 2 * l2 - m2;
    return new Rgb(
      hsl2rgb(h2 >= 240 ? h2 - 240 : h2 + 120, m1, m2),
      hsl2rgb(h2, m1, m2),
      hsl2rgb(h2 < 120 ? h2 + 240 : h2 - 120, m1, m2),
      this.opacity
    );
  },
  clamp() {
    return new Hsl(clamph(this.h), clampt(this.s), clampt(this.l), clampa(this.opacity));
  },
  displayable() {
    return (0 <= this.s && this.s <= 1 || isNaN(this.s)) && (0 <= this.l && this.l <= 1) && (0 <= this.opacity && this.opacity <= 1);
  },
  formatHsl() {
    const a3 = clampa(this.opacity);
    return `${a3 === 1 ? "hsl(" : "hsla("}${clamph(this.h)}, ${clampt(this.s) * 100}%, ${clampt(this.l) * 100}%${a3 === 1 ? ")" : `, ${a3})`}`;
  }
}));
function clamph(value) {
  value = (value || 0) % 360;
  return value < 0 ? value + 360 : value;
}
function clampt(value) {
  return Math.max(0, Math.min(1, value || 0));
}
function hsl2rgb(h2, m1, m2) {
  return (h2 < 60 ? m1 + (m2 - m1) * h2 / 60 : h2 < 180 ? m2 : h2 < 240 ? m1 + (m2 - m1) * (240 - h2) / 60 : m1) * 255;
}

// ../../node_modules/d3-color/src/math.js
var radians = Math.PI / 180;
var degrees = 180 / Math.PI;

// ../../node_modules/d3-color/src/lab.js
var K = 18;
var Xn = 0.96422;
var Yn = 1;
var Zn = 0.82521;
var t0 = 4 / 29;
var t1 = 6 / 29;
var t2 = 3 * t1 * t1;
var t3 = t1 * t1 * t1;
function labConvert(o2) {
  if (o2 instanceof Lab)
    return new Lab(o2.l, o2.a, o2.b, o2.opacity);
  if (o2 instanceof Hcl)
    return hcl2lab(o2);
  if (!(o2 instanceof Rgb))
    o2 = rgbConvert(o2);
  var r2 = rgb2lrgb(o2.r), g2 = rgb2lrgb(o2.g), b2 = rgb2lrgb(o2.b), y3 = xyz2lab((0.2225045 * r2 + 0.7168786 * g2 + 0.0606169 * b2) / Yn), x3, z2;
  if (r2 === g2 && g2 === b2)
    x3 = z2 = y3;
  else {
    x3 = xyz2lab((0.4360747 * r2 + 0.3850649 * g2 + 0.1430804 * b2) / Xn);
    z2 = xyz2lab((0.0139322 * r2 + 0.0971045 * g2 + 0.7141733 * b2) / Zn);
  }
  return new Lab(116 * y3 - 16, 500 * (x3 - y3), 200 * (y3 - z2), o2.opacity);
}
function lab(l2, a3, b2, opacity2) {
  return arguments.length === 1 ? labConvert(l2) : new Lab(l2, a3, b2, opacity2 == null ? 1 : opacity2);
}
function Lab(l2, a3, b2, opacity2) {
  this.l = +l2;
  this.a = +a3;
  this.b = +b2;
  this.opacity = +opacity2;
}
define_default(Lab, lab, extend(Color, {
  brighter(k3) {
    return new Lab(this.l + K * (k3 == null ? 1 : k3), this.a, this.b, this.opacity);
  },
  darker(k3) {
    return new Lab(this.l - K * (k3 == null ? 1 : k3), this.a, this.b, this.opacity);
  },
  rgb() {
    var y3 = (this.l + 16) / 116, x3 = isNaN(this.a) ? y3 : y3 + this.a / 500, z2 = isNaN(this.b) ? y3 : y3 - this.b / 200;
    x3 = Xn * lab2xyz(x3);
    y3 = Yn * lab2xyz(y3);
    z2 = Zn * lab2xyz(z2);
    return new Rgb(
      lrgb2rgb(3.1338561 * x3 - 1.6168667 * y3 - 0.4906146 * z2),
      lrgb2rgb(-0.9787684 * x3 + 1.9161415 * y3 + 0.033454 * z2),
      lrgb2rgb(0.0719453 * x3 - 0.2289914 * y3 + 1.4052427 * z2),
      this.opacity
    );
  }
}));
function xyz2lab(t5) {
  return t5 > t3 ? Math.pow(t5, 1 / 3) : t5 / t2 + t0;
}
function lab2xyz(t5) {
  return t5 > t1 ? t5 * t5 * t5 : t2 * (t5 - t0);
}
function lrgb2rgb(x3) {
  return 255 * (x3 <= 31308e-7 ? 12.92 * x3 : 1.055 * Math.pow(x3, 1 / 2.4) - 0.055);
}
function rgb2lrgb(x3) {
  return (x3 /= 255) <= 0.04045 ? x3 / 12.92 : Math.pow((x3 + 0.055) / 1.055, 2.4);
}
function hclConvert(o2) {
  if (o2 instanceof Hcl)
    return new Hcl(o2.h, o2.c, o2.l, o2.opacity);
  if (!(o2 instanceof Lab))
    o2 = labConvert(o2);
  if (o2.a === 0 && o2.b === 0)
    return new Hcl(NaN, 0 < o2.l && o2.l < 100 ? 0 : NaN, o2.l, o2.opacity);
  var h2 = Math.atan2(o2.b, o2.a) * degrees;
  return new Hcl(h2 < 0 ? h2 + 360 : h2, Math.sqrt(o2.a * o2.a + o2.b * o2.b), o2.l, o2.opacity);
}
function hcl(h2, c5, l2, opacity2) {
  return arguments.length === 1 ? hclConvert(h2) : new Hcl(h2, c5, l2, opacity2 == null ? 1 : opacity2);
}
function Hcl(h2, c5, l2, opacity2) {
  this.h = +h2;
  this.c = +c5;
  this.l = +l2;
  this.opacity = +opacity2;
}
function hcl2lab(o2) {
  if (isNaN(o2.h))
    return new Lab(o2.l, 0, 0, o2.opacity);
  var h2 = o2.h * radians;
  return new Lab(o2.l, Math.cos(h2) * o2.c, Math.sin(h2) * o2.c, o2.opacity);
}
define_default(Hcl, hcl, extend(Color, {
  brighter(k3) {
    return new Hcl(this.h, this.c, this.l + K * (k3 == null ? 1 : k3), this.opacity);
  },
  darker(k3) {
    return new Hcl(this.h, this.c, this.l - K * (k3 == null ? 1 : k3), this.opacity);
  },
  rgb() {
    return hcl2lab(this).rgb();
  }
}));

// ../../node_modules/d3-color/src/cubehelix.js
var A = -0.14861;
var B = 1.78277;
var C = -0.29227;
var D = -0.90649;
var E = 1.97294;
var ED = E * D;
var EB = E * B;
var BC_DA = B * C - D * A;
function cubehelixConvert(o2) {
  if (o2 instanceof Cubehelix)
    return new Cubehelix(o2.h, o2.s, o2.l, o2.opacity);
  if (!(o2 instanceof Rgb))
    o2 = rgbConvert(o2);
  var r2 = o2.r / 255, g2 = o2.g / 255, b2 = o2.b / 255, l2 = (BC_DA * b2 + ED * r2 - EB * g2) / (BC_DA + ED - EB), bl = b2 - l2, k3 = (E * (g2 - l2) - C * bl) / D, s3 = Math.sqrt(k3 * k3 + bl * bl) / (E * l2 * (1 - l2)), h2 = s3 ? Math.atan2(k3, bl) * degrees - 120 : NaN;
  return new Cubehelix(h2 < 0 ? h2 + 360 : h2, s3, l2, o2.opacity);
}
function cubehelix(h2, s3, l2, opacity2) {
  return arguments.length === 1 ? cubehelixConvert(h2) : new Cubehelix(h2, s3, l2, opacity2 == null ? 1 : opacity2);
}
function Cubehelix(h2, s3, l2, opacity2) {
  this.h = +h2;
  this.s = +s3;
  this.l = +l2;
  this.opacity = +opacity2;
}
define_default(Cubehelix, cubehelix, extend(Color, {
  brighter(k3) {
    k3 = k3 == null ? brighter : Math.pow(brighter, k3);
    return new Cubehelix(this.h, this.s, this.l * k3, this.opacity);
  },
  darker(k3) {
    k3 = k3 == null ? darker : Math.pow(darker, k3);
    return new Cubehelix(this.h, this.s, this.l * k3, this.opacity);
  },
  rgb() {
    var h2 = isNaN(this.h) ? 0 : (this.h + 120) * radians, l2 = +this.l, a3 = isNaN(this.s) ? 0 : this.s * l2 * (1 - l2), cosh = Math.cos(h2), sinh = Math.sin(h2);
    return new Rgb(
      255 * (l2 + a3 * (A * cosh + B * sinh)),
      255 * (l2 + a3 * (C * cosh + D * sinh)),
      255 * (l2 + a3 * (E * cosh)),
      this.opacity
    );
  }
}));

// ../../node_modules/d3-interpolate/src/basis.js
function basis(t13, v0, v1, v2, v3) {
  var t22 = t13 * t13, t32 = t22 * t13;
  return ((1 - 3 * t13 + 3 * t22 - t32) * v0 + (4 - 6 * t22 + 3 * t32) * v1 + (1 + 3 * t13 + 3 * t22 - 3 * t32) * v2 + t32 * v3) / 6;
}
function basis_default(values2) {
  var n2 = values2.length - 1;
  return function(t5) {
    var i2 = t5 <= 0 ? t5 = 0 : t5 >= 1 ? (t5 = 1, n2 - 1) : Math.floor(t5 * n2), v1 = values2[i2], v2 = values2[i2 + 1], v0 = i2 > 0 ? values2[i2 - 1] : 2 * v1 - v2, v3 = i2 < n2 - 1 ? values2[i2 + 2] : 2 * v2 - v1;
    return basis((t5 - i2 / n2) * n2, v0, v1, v2, v3);
  };
}

// ../../node_modules/d3-interpolate/src/basisClosed.js
function basisClosed_default(values2) {
  var n2 = values2.length;
  return function(t5) {
    var i2 = Math.floor(((t5 %= 1) < 0 ? ++t5 : t5) * n2), v0 = values2[(i2 + n2 - 1) % n2], v1 = values2[i2 % n2], v2 = values2[(i2 + 1) % n2], v3 = values2[(i2 + 2) % n2];
    return basis((t5 - i2 / n2) * n2, v0, v1, v2, v3);
  };
}

// ../../node_modules/d3-interpolate/src/constant.js
var constant_default2 = (x3) => () => x3;

// ../../node_modules/d3-interpolate/src/color.js
function linear(a3, d2) {
  return function(t5) {
    return a3 + t5 * d2;
  };
}
function exponential(a3, b2, y3) {
  return a3 = Math.pow(a3, y3), b2 = Math.pow(b2, y3) - a3, y3 = 1 / y3, function(t5) {
    return Math.pow(a3 + t5 * b2, y3);
  };
}
function hue(a3, b2) {
  var d2 = b2 - a3;
  return d2 ? linear(a3, d2 > 180 || d2 < -180 ? d2 - 360 * Math.round(d2 / 360) : d2) : constant_default2(isNaN(a3) ? b2 : a3);
}
function gamma(y3) {
  return (y3 = +y3) === 1 ? nogamma : function(a3, b2) {
    return b2 - a3 ? exponential(a3, b2, y3) : constant_default2(isNaN(a3) ? b2 : a3);
  };
}
function nogamma(a3, b2) {
  var d2 = b2 - a3;
  return d2 ? linear(a3, d2) : constant_default2(isNaN(a3) ? b2 : a3);
}

// ../../node_modules/d3-interpolate/src/rgb.js
var rgb_default = function rgbGamma(y3) {
  var color3 = gamma(y3);
  function rgb2(start2, end) {
    var r2 = color3((start2 = rgb(start2)).r, (end = rgb(end)).r), g2 = color3(start2.g, end.g), b2 = color3(start2.b, end.b), opacity2 = nogamma(start2.opacity, end.opacity);
    return function(t5) {
      start2.r = r2(t5);
      start2.g = g2(t5);
      start2.b = b2(t5);
      start2.opacity = opacity2(t5);
      return start2 + "";
    };
  }
  rgb2.gamma = rgbGamma;
  return rgb2;
}(1);
function rgbSpline(spline) {
  return function(colors) {
    var n2 = colors.length, r2 = new Array(n2), g2 = new Array(n2), b2 = new Array(n2), i2, color3;
    for (i2 = 0; i2 < n2; ++i2) {
      color3 = rgb(colors[i2]);
      r2[i2] = color3.r || 0;
      g2[i2] = color3.g || 0;
      b2[i2] = color3.b || 0;
    }
    r2 = spline(r2);
    g2 = spline(g2);
    b2 = spline(b2);
    color3.opacity = 1;
    return function(t5) {
      color3.r = r2(t5);
      color3.g = g2(t5);
      color3.b = b2(t5);
      return color3 + "";
    };
  };
}
var rgbBasis = rgbSpline(basis_default);
var rgbBasisClosed = rgbSpline(basisClosed_default);

// ../../node_modules/d3-interpolate/src/numberArray.js
function numberArray_default(a3, b2) {
  if (!b2)
    b2 = [];
  var n2 = a3 ? Math.min(b2.length, a3.length) : 0, c5 = b2.slice(), i2;
  return function(t5) {
    for (i2 = 0; i2 < n2; ++i2)
      c5[i2] = a3[i2] * (1 - t5) + b2[i2] * t5;
    return c5;
  };
}
function isNumberArray(x3) {
  return ArrayBuffer.isView(x3) && !(x3 instanceof DataView);
}

// ../../node_modules/d3-interpolate/src/array.js
function genericArray(a3, b2) {
  var nb = b2 ? b2.length : 0, na = a3 ? Math.min(nb, a3.length) : 0, x3 = new Array(na), c5 = new Array(nb), i2;
  for (i2 = 0; i2 < na; ++i2)
    x3[i2] = value_default(a3[i2], b2[i2]);
  for (; i2 < nb; ++i2)
    c5[i2] = b2[i2];
  return function(t5) {
    for (i2 = 0; i2 < na; ++i2)
      c5[i2] = x3[i2](t5);
    return c5;
  };
}

// ../../node_modules/d3-interpolate/src/date.js
function date_default(a3, b2) {
  var d2 = /* @__PURE__ */ new Date();
  return a3 = +a3, b2 = +b2, function(t5) {
    return d2.setTime(a3 * (1 - t5) + b2 * t5), d2;
  };
}

// ../../node_modules/d3-interpolate/src/number.js
function number_default(a3, b2) {
  return a3 = +a3, b2 = +b2, function(t5) {
    return a3 * (1 - t5) + b2 * t5;
  };
}

// ../../node_modules/d3-interpolate/src/object.js
function object_default(a3, b2) {
  var i2 = {}, c5 = {}, k3;
  if (a3 === null || typeof a3 !== "object")
    a3 = {};
  if (b2 === null || typeof b2 !== "object")
    b2 = {};
  for (k3 in b2) {
    if (k3 in a3) {
      i2[k3] = value_default(a3[k3], b2[k3]);
    } else {
      c5[k3] = b2[k3];
    }
  }
  return function(t5) {
    for (k3 in i2)
      c5[k3] = i2[k3](t5);
    return c5;
  };
}

// ../../node_modules/d3-interpolate/src/string.js
var reA = /[-+]?(?:\d+\.?\d*|\.?\d+)(?:[eE][-+]?\d+)?/g;
var reB = new RegExp(reA.source, "g");
function zero2(b2) {
  return function() {
    return b2;
  };
}
function one(b2) {
  return function(t5) {
    return b2(t5) + "";
  };
}
function string_default(a3, b2) {
  var bi = reA.lastIndex = reB.lastIndex = 0, am, bm, bs, i2 = -1, s3 = [], q2 = [];
  a3 = a3 + "", b2 = b2 + "";
  while ((am = reA.exec(a3)) && (bm = reB.exec(b2))) {
    if ((bs = bm.index) > bi) {
      bs = b2.slice(bi, bs);
      if (s3[i2])
        s3[i2] += bs;
      else
        s3[++i2] = bs;
    }
    if ((am = am[0]) === (bm = bm[0])) {
      if (s3[i2])
        s3[i2] += bm;
      else
        s3[++i2] = bm;
    } else {
      s3[++i2] = null;
      q2.push({ i: i2, x: number_default(am, bm) });
    }
    bi = reB.lastIndex;
  }
  if (bi < b2.length) {
    bs = b2.slice(bi);
    if (s3[i2])
      s3[i2] += bs;
    else
      s3[++i2] = bs;
  }
  return s3.length < 2 ? q2[0] ? one(q2[0].x) : zero2(b2) : (b2 = q2.length, function(t5) {
    for (var i3 = 0, o2; i3 < b2; ++i3)
      s3[(o2 = q2[i3]).i] = o2.x(t5);
    return s3.join("");
  });
}

// ../../node_modules/d3-interpolate/src/value.js
function value_default(a3, b2) {
  var t5 = typeof b2, c5;
  return b2 == null || t5 === "boolean" ? constant_default2(b2) : (t5 === "number" ? number_default : t5 === "string" ? (c5 = color(b2)) ? (b2 = c5, rgb_default) : string_default : b2 instanceof color ? rgb_default : b2 instanceof Date ? date_default : isNumberArray(b2) ? numberArray_default : Array.isArray(b2) ? genericArray : typeof b2.valueOf !== "function" && typeof b2.toString !== "function" || isNaN(b2) ? object_default : number_default)(a3, b2);
}

// ../../node_modules/d3-interpolate/src/round.js
function round_default(a3, b2) {
  return a3 = +a3, b2 = +b2, function(t5) {
    return Math.round(a3 * (1 - t5) + b2 * t5);
  };
}

// ../../node_modules/d3-interpolate/src/transform/decompose.js
var degrees2 = 180 / Math.PI;
var identity2 = {
  translateX: 0,
  translateY: 0,
  rotate: 0,
  skewX: 0,
  scaleX: 1,
  scaleY: 1
};
function decompose_default(a3, b2, c5, d2, e, f2) {
  var scaleX, scaleY, skewX;
  if (scaleX = Math.sqrt(a3 * a3 + b2 * b2))
    a3 /= scaleX, b2 /= scaleX;
  if (skewX = a3 * c5 + b2 * d2)
    c5 -= a3 * skewX, d2 -= b2 * skewX;
  if (scaleY = Math.sqrt(c5 * c5 + d2 * d2))
    c5 /= scaleY, d2 /= scaleY, skewX /= scaleY;
  if (a3 * d2 < b2 * c5)
    a3 = -a3, b2 = -b2, skewX = -skewX, scaleX = -scaleX;
  return {
    translateX: e,
    translateY: f2,
    rotate: Math.atan2(b2, a3) * degrees2,
    skewX: Math.atan(skewX) * degrees2,
    scaleX,
    scaleY
  };
}

// ../../node_modules/d3-interpolate/src/transform/parse.js
var svgNode;
function parseCss(value) {
  const m = new (typeof DOMMatrix === "function" ? DOMMatrix : WebKitCSSMatrix)(value + "");
  return m.isIdentity ? identity2 : decompose_default(m.a, m.b, m.c, m.d, m.e, m.f);
}
function parseSvg(value) {
  if (value == null)
    return identity2;
  if (!svgNode)
    svgNode = document.createElementNS("http://www.w3.org/2000/svg", "g");
  svgNode.setAttribute("transform", value);
  if (!(value = svgNode.transform.baseVal.consolidate()))
    return identity2;
  value = value.matrix;
  return decompose_default(value.a, value.b, value.c, value.d, value.e, value.f);
}

// ../../node_modules/d3-interpolate/src/transform/index.js
function interpolateTransform(parse2, pxComma, pxParen, degParen) {
  function pop(s3) {
    return s3.length ? s3.pop() + " " : "";
  }
  function translate(xa, ya, xb, yb, s3, q2) {
    if (xa !== xb || ya !== yb) {
      var i2 = s3.push("translate(", null, pxComma, null, pxParen);
      q2.push({ i: i2 - 4, x: number_default(xa, xb) }, { i: i2 - 2, x: number_default(ya, yb) });
    } else if (xb || yb) {
      s3.push("translate(" + xb + pxComma + yb + pxParen);
    }
  }
  function rotate(a3, b2, s3, q2) {
    if (a3 !== b2) {
      if (a3 - b2 > 180)
        b2 += 360;
      else if (b2 - a3 > 180)
        a3 += 360;
      q2.push({ i: s3.push(pop(s3) + "rotate(", null, degParen) - 2, x: number_default(a3, b2) });
    } else if (b2) {
      s3.push(pop(s3) + "rotate(" + b2 + degParen);
    }
  }
  function skewX(a3, b2, s3, q2) {
    if (a3 !== b2) {
      q2.push({ i: s3.push(pop(s3) + "skewX(", null, degParen) - 2, x: number_default(a3, b2) });
    } else if (b2) {
      s3.push(pop(s3) + "skewX(" + b2 + degParen);
    }
  }
  function scale(xa, ya, xb, yb, s3, q2) {
    if (xa !== xb || ya !== yb) {
      var i2 = s3.push(pop(s3) + "scale(", null, ",", null, ")");
      q2.push({ i: i2 - 4, x: number_default(xa, xb) }, { i: i2 - 2, x: number_default(ya, yb) });
    } else if (xb !== 1 || yb !== 1) {
      s3.push(pop(s3) + "scale(" + xb + "," + yb + ")");
    }
  }
  return function(a3, b2) {
    var s3 = [], q2 = [];
    a3 = parse2(a3), b2 = parse2(b2);
    translate(a3.translateX, a3.translateY, b2.translateX, b2.translateY, s3, q2);
    rotate(a3.rotate, b2.rotate, s3, q2);
    skewX(a3.skewX, b2.skewX, s3, q2);
    scale(a3.scaleX, a3.scaleY, b2.scaleX, b2.scaleY, s3, q2);
    a3 = b2 = null;
    return function(t5) {
      var i2 = -1, n2 = q2.length, o2;
      while (++i2 < n2)
        s3[(o2 = q2[i2]).i] = o2.x(t5);
      return s3.join("");
    };
  };
}
var interpolateTransformCss = interpolateTransform(parseCss, "px, ", "px)", "deg)");
var interpolateTransformSvg = interpolateTransform(parseSvg, ", ", ")", ")");

// ../../node_modules/d3-interpolate/src/hsl.js
function hsl2(hue2) {
  return function(start2, end) {
    var h2 = hue2((start2 = hsl(start2)).h, (end = hsl(end)).h), s3 = nogamma(start2.s, end.s), l2 = nogamma(start2.l, end.l), opacity2 = nogamma(start2.opacity, end.opacity);
    return function(t5) {
      start2.h = h2(t5);
      start2.s = s3(t5);
      start2.l = l2(t5);
      start2.opacity = opacity2(t5);
      return start2 + "";
    };
  };
}
var hsl_default = hsl2(hue);
var hslLong = hsl2(nogamma);

// ../../node_modules/d3-interpolate/src/lab.js
function lab2(start2, end) {
  var l2 = nogamma((start2 = lab(start2)).l, (end = lab(end)).l), a3 = nogamma(start2.a, end.a), b2 = nogamma(start2.b, end.b), opacity2 = nogamma(start2.opacity, end.opacity);
  return function(t5) {
    start2.l = l2(t5);
    start2.a = a3(t5);
    start2.b = b2(t5);
    start2.opacity = opacity2(t5);
    return start2 + "";
  };
}

// ../../node_modules/d3-interpolate/src/hcl.js
function hcl2(hue2) {
  return function(start2, end) {
    var h2 = hue2((start2 = hcl(start2)).h, (end = hcl(end)).h), c5 = nogamma(start2.c, end.c), l2 = nogamma(start2.l, end.l), opacity2 = nogamma(start2.opacity, end.opacity);
    return function(t5) {
      start2.h = h2(t5);
      start2.c = c5(t5);
      start2.l = l2(t5);
      start2.opacity = opacity2(t5);
      return start2 + "";
    };
  };
}
var hcl_default = hcl2(hue);
var hclLong = hcl2(nogamma);

// ../../node_modules/d3-interpolate/src/cubehelix.js
function cubehelix2(hue2) {
  return function cubehelixGamma(y3) {
    y3 = +y3;
    function cubehelix3(start2, end) {
      var h2 = hue2((start2 = cubehelix(start2)).h, (end = cubehelix(end)).h), s3 = nogamma(start2.s, end.s), l2 = nogamma(start2.l, end.l), opacity2 = nogamma(start2.opacity, end.opacity);
      return function(t5) {
        start2.h = h2(t5);
        start2.s = s3(t5);
        start2.l = l2(Math.pow(t5, y3));
        start2.opacity = opacity2(t5);
        return start2 + "";
      };
    }
    cubehelix3.gamma = cubehelixGamma;
    return cubehelix3;
  }(1);
}
var cubehelix_default = cubehelix2(hue);
var cubehelixLong = cubehelix2(nogamma);

// ../../node_modules/d3-interpolate/src/piecewise.js
function piecewise(interpolate, values2) {
  if (values2 === void 0)
    values2 = interpolate, interpolate = value_default;
  var i2 = 0, n2 = values2.length - 1, v2 = values2[0], I2 = new Array(n2 < 0 ? 0 : n2);
  while (i2 < n2)
    I2[i2] = interpolate(v2, v2 = values2[++i2]);
  return function(t5) {
    var i3 = Math.max(0, Math.min(n2 - 1, Math.floor(t5 *= n2)));
    return I2[i3](t5 - i3);
  };
}

// ../../node_modules/d3-interpolate/src/quantize.js
function quantize_default(interpolator, n2) {
  var samples = new Array(n2);
  for (var i2 = 0; i2 < n2; ++i2)
    samples[i2] = interpolator(i2 / (n2 - 1));
  return samples;
}

// ../../node_modules/d3-timer/src/timer.js
var frame = 0;
var timeout = 0;
var interval = 0;
var pokeDelay = 1e3;
var taskHead;
var taskTail;
var clockLast = 0;
var clockNow = 0;
var clockSkew = 0;
var clock = typeof performance === "object" && performance.now ? performance : Date;
var setFrame = typeof window === "object" && window.requestAnimationFrame ? window.requestAnimationFrame.bind(window) : function(f2) {
  setTimeout(f2, 17);
};
function now() {
  return clockNow || (setFrame(clearNow), clockNow = clock.now() + clockSkew);
}
function clearNow() {
  clockNow = 0;
}
function Timer() {
  this._call = this._time = this._next = null;
}
Timer.prototype = timer.prototype = {
  constructor: Timer,
  restart: function(callback, delay, time2) {
    if (typeof callback !== "function")
      throw new TypeError("callback is not a function");
    time2 = (time2 == null ? now() : +time2) + (delay == null ? 0 : +delay);
    if (!this._next && taskTail !== this) {
      if (taskTail)
        taskTail._next = this;
      else
        taskHead = this;
      taskTail = this;
    }
    this._call = callback;
    this._time = time2;
    sleep();
  },
  stop: function() {
    if (this._call) {
      this._call = null;
      this._time = Infinity;
      sleep();
    }
  }
};
function timer(callback, delay, time2) {
  var t5 = new Timer();
  t5.restart(callback, delay, time2);
  return t5;
}
function timerFlush() {
  now();
  ++frame;
  var t5 = taskHead, e;
  while (t5) {
    if ((e = clockNow - t5._time) >= 0)
      t5._call.call(void 0, e);
    t5 = t5._next;
  }
  --frame;
}
function wake() {
  clockNow = (clockLast = clock.now()) + clockSkew;
  frame = timeout = 0;
  try {
    timerFlush();
  } finally {
    frame = 0;
    nap();
    clockNow = 0;
  }
}
function poke() {
  var now2 = clock.now(), delay = now2 - clockLast;
  if (delay > pokeDelay)
    clockSkew -= delay, clockLast = now2;
}
function nap() {
  var t03, t13 = taskHead, t22, time2 = Infinity;
  while (t13) {
    if (t13._call) {
      if (time2 > t13._time)
        time2 = t13._time;
      t03 = t13, t13 = t13._next;
    } else {
      t22 = t13._next, t13._next = null;
      t13 = t03 ? t03._next = t22 : taskHead = t22;
    }
  }
  taskTail = t03;
  sleep(time2);
}
function sleep(time2) {
  if (frame)
    return;
  if (timeout)
    timeout = clearTimeout(timeout);
  var delay = time2 - clockNow;
  if (delay > 24) {
    if (time2 < Infinity)
      timeout = setTimeout(wake, time2 - clock.now() - clockSkew);
    if (interval)
      interval = clearInterval(interval);
  } else {
    if (!interval)
      clockLast = clock.now(), interval = setInterval(poke, pokeDelay);
    frame = 1, setFrame(wake);
  }
}

// ../../node_modules/d3-timer/src/timeout.js
function timeout_default(callback, delay, time2) {
  var t5 = new Timer();
  delay = delay == null ? 0 : +delay;
  t5.restart((elapsed) => {
    t5.stop();
    callback(elapsed + delay);
  }, delay, time2);
  return t5;
}

// ../../node_modules/d3-transition/src/transition/schedule.js
var emptyOn = dispatch_default("start", "end", "cancel", "interrupt");
var emptyTween = [];
var CREATED = 0;
var SCHEDULED = 1;
var STARTING = 2;
var STARTED = 3;
var RUNNING = 4;
var ENDING = 5;
var ENDED = 6;
function schedule_default(node, name, id2, index2, group2, timing) {
  var schedules = node.__transition;
  if (!schedules)
    node.__transition = {};
  else if (id2 in schedules)
    return;
  create(node, id2, {
    name,
    index: index2,
    // For context during callback.
    group: group2,
    // For context during callback.
    on: emptyOn,
    tween: emptyTween,
    time: timing.time,
    delay: timing.delay,
    duration: timing.duration,
    ease: timing.ease,
    timer: null,
    state: CREATED
  });
}
function init(node, id2) {
  var schedule = get2(node, id2);
  if (schedule.state > CREATED)
    throw new Error("too late; already scheduled");
  return schedule;
}
function set2(node, id2) {
  var schedule = get2(node, id2);
  if (schedule.state > STARTED)
    throw new Error("too late; already running");
  return schedule;
}
function get2(node, id2) {
  var schedule = node.__transition;
  if (!schedule || !(schedule = schedule[id2]))
    throw new Error("transition not found");
  return schedule;
}
function create(node, id2, self) {
  var schedules = node.__transition, tween;
  schedules[id2] = self;
  self.timer = timer(schedule, 0, self.time);
  function schedule(elapsed) {
    self.state = SCHEDULED;
    self.timer.restart(start2, self.delay, self.time);
    if (self.delay <= elapsed)
      start2(elapsed - self.delay);
  }
  function start2(elapsed) {
    var i2, j2, n2, o2;
    if (self.state !== SCHEDULED)
      return stop();
    for (i2 in schedules) {
      o2 = schedules[i2];
      if (o2.name !== self.name)
        continue;
      if (o2.state === STARTED)
        return timeout_default(start2);
      if (o2.state === RUNNING) {
        o2.state = ENDED;
        o2.timer.stop();
        o2.on.call("interrupt", node, node.__data__, o2.index, o2.group);
        delete schedules[i2];
      } else if (+i2 < id2) {
        o2.state = ENDED;
        o2.timer.stop();
        o2.on.call("cancel", node, node.__data__, o2.index, o2.group);
        delete schedules[i2];
      }
    }
    timeout_default(function() {
      if (self.state === STARTED) {
        self.state = RUNNING;
        self.timer.restart(tick, self.delay, self.time);
        tick(elapsed);
      }
    });
    self.state = STARTING;
    self.on.call("start", node, node.__data__, self.index, self.group);
    if (self.state !== STARTING)
      return;
    self.state = STARTED;
    tween = new Array(n2 = self.tween.length);
    for (i2 = 0, j2 = -1; i2 < n2; ++i2) {
      if (o2 = self.tween[i2].value.call(node, node.__data__, self.index, self.group)) {
        tween[++j2] = o2;
      }
    }
    tween.length = j2 + 1;
  }
  function tick(elapsed) {
    var t5 = elapsed < self.duration ? self.ease.call(null, elapsed / self.duration) : (self.timer.restart(stop), self.state = ENDING, 1), i2 = -1, n2 = tween.length;
    while (++i2 < n2) {
      tween[i2].call(node, t5);
    }
    if (self.state === ENDING) {
      self.on.call("end", node, node.__data__, self.index, self.group);
      stop();
    }
  }
  function stop() {
    self.state = ENDED;
    self.timer.stop();
    delete schedules[id2];
    for (var i2 in schedules)
      return;
    delete node.__transition;
  }
}

// ../../node_modules/d3-transition/src/interrupt.js
function interrupt_default(node, name) {
  var schedules = node.__transition, schedule, active, empty3 = true, i2;
  if (!schedules)
    return;
  name = name == null ? null : name + "";
  for (i2 in schedules) {
    if ((schedule = schedules[i2]).name !== name) {
      empty3 = false;
      continue;
    }
    active = schedule.state > STARTING && schedule.state < ENDING;
    schedule.state = ENDED;
    schedule.timer.stop();
    schedule.on.call(active ? "interrupt" : "cancel", node, node.__data__, schedule.index, schedule.group);
    delete schedules[i2];
  }
  if (empty3)
    delete node.__transition;
}

// ../../node_modules/d3-transition/src/selection/interrupt.js
function interrupt_default2(name) {
  return this.each(function() {
    interrupt_default(this, name);
  });
}

// ../../node_modules/d3-transition/src/transition/tween.js
function tweenRemove(id2, name) {
  var tween0, tween1;
  return function() {
    var schedule = set2(this, id2), tween = schedule.tween;
    if (tween !== tween0) {
      tween1 = tween0 = tween;
      for (var i2 = 0, n2 = tween1.length; i2 < n2; ++i2) {
        if (tween1[i2].name === name) {
          tween1 = tween1.slice();
          tween1.splice(i2, 1);
          break;
        }
      }
    }
    schedule.tween = tween1;
  };
}
function tweenFunction(id2, name, value) {
  var tween0, tween1;
  if (typeof value !== "function")
    throw new Error();
  return function() {
    var schedule = set2(this, id2), tween = schedule.tween;
    if (tween !== tween0) {
      tween1 = (tween0 = tween).slice();
      for (var t5 = { name, value }, i2 = 0, n2 = tween1.length; i2 < n2; ++i2) {
        if (tween1[i2].name === name) {
          tween1[i2] = t5;
          break;
        }
      }
      if (i2 === n2)
        tween1.push(t5);
    }
    schedule.tween = tween1;
  };
}
function tween_default(name, value) {
  var id2 = this._id;
  name += "";
  if (arguments.length < 2) {
    var tween = get2(this.node(), id2).tween;
    for (var i2 = 0, n2 = tween.length, t5; i2 < n2; ++i2) {
      if ((t5 = tween[i2]).name === name) {
        return t5.value;
      }
    }
    return null;
  }
  return this.each((value == null ? tweenRemove : tweenFunction)(id2, name, value));
}
function tweenValue(transition2, name, value) {
  var id2 = transition2._id;
  transition2.each(function() {
    var schedule = set2(this, id2);
    (schedule.value || (schedule.value = {}))[name] = value.apply(this, arguments);
  });
  return function(node) {
    return get2(node, id2).value[name];
  };
}

// ../../node_modules/d3-transition/src/transition/interpolate.js
function interpolate_default(a3, b2) {
  var c5;
  return (typeof b2 === "number" ? number_default : b2 instanceof color ? rgb_default : (c5 = color(b2)) ? (b2 = c5, rgb_default) : string_default)(a3, b2);
}

// ../../node_modules/d3-transition/src/transition/attr.js
function attrRemove2(name) {
  return function() {
    this.removeAttribute(name);
  };
}
function attrRemoveNS2(fullname) {
  return function() {
    this.removeAttributeNS(fullname.space, fullname.local);
  };
}
function attrConstant2(name, interpolate, value1) {
  var string00, string1 = value1 + "", interpolate0;
  return function() {
    var string0 = this.getAttribute(name);
    return string0 === string1 ? null : string0 === string00 ? interpolate0 : interpolate0 = interpolate(string00 = string0, value1);
  };
}
function attrConstantNS2(fullname, interpolate, value1) {
  var string00, string1 = value1 + "", interpolate0;
  return function() {
    var string0 = this.getAttributeNS(fullname.space, fullname.local);
    return string0 === string1 ? null : string0 === string00 ? interpolate0 : interpolate0 = interpolate(string00 = string0, value1);
  };
}
function attrFunction2(name, interpolate, value) {
  var string00, string10, interpolate0;
  return function() {
    var string0, value1 = value(this), string1;
    if (value1 == null)
      return void this.removeAttribute(name);
    string0 = this.getAttribute(name);
    string1 = value1 + "";
    return string0 === string1 ? null : string0 === string00 && string1 === string10 ? interpolate0 : (string10 = string1, interpolate0 = interpolate(string00 = string0, value1));
  };
}
function attrFunctionNS2(fullname, interpolate, value) {
  var string00, string10, interpolate0;
  return function() {
    var string0, value1 = value(this), string1;
    if (value1 == null)
      return void this.removeAttributeNS(fullname.space, fullname.local);
    string0 = this.getAttributeNS(fullname.space, fullname.local);
    string1 = value1 + "";
    return string0 === string1 ? null : string0 === string00 && string1 === string10 ? interpolate0 : (string10 = string1, interpolate0 = interpolate(string00 = string0, value1));
  };
}
function attr_default2(name, value) {
  var fullname = namespace_default(name), i2 = fullname === "transform" ? interpolateTransformSvg : interpolate_default;
  return this.attrTween(name, typeof value === "function" ? (fullname.local ? attrFunctionNS2 : attrFunction2)(fullname, i2, tweenValue(this, "attr." + name, value)) : value == null ? (fullname.local ? attrRemoveNS2 : attrRemove2)(fullname) : (fullname.local ? attrConstantNS2 : attrConstant2)(fullname, i2, value));
}

// ../../node_modules/d3-transition/src/transition/attrTween.js
function attrInterpolate(name, i2) {
  return function(t5) {
    this.setAttribute(name, i2.call(this, t5));
  };
}
function attrInterpolateNS(fullname, i2) {
  return function(t5) {
    this.setAttributeNS(fullname.space, fullname.local, i2.call(this, t5));
  };
}
function attrTweenNS(fullname, value) {
  var t03, i0;
  function tween() {
    var i2 = value.apply(this, arguments);
    if (i2 !== i0)
      t03 = (i0 = i2) && attrInterpolateNS(fullname, i2);
    return t03;
  }
  tween._value = value;
  return tween;
}
function attrTween(name, value) {
  var t03, i0;
  function tween() {
    var i2 = value.apply(this, arguments);
    if (i2 !== i0)
      t03 = (i0 = i2) && attrInterpolate(name, i2);
    return t03;
  }
  tween._value = value;
  return tween;
}
function attrTween_default(name, value) {
  var key = "attr." + name;
  if (arguments.length < 2)
    return (key = this.tween(key)) && key._value;
  if (value == null)
    return this.tween(key, null);
  if (typeof value !== "function")
    throw new Error();
  var fullname = namespace_default(name);
  return this.tween(key, (fullname.local ? attrTweenNS : attrTween)(fullname, value));
}

// ../../node_modules/d3-transition/src/transition/delay.js
function delayFunction(id2, value) {
  return function() {
    init(this, id2).delay = +value.apply(this, arguments);
  };
}
function delayConstant(id2, value) {
  return value = +value, function() {
    init(this, id2).delay = value;
  };
}
function delay_default(value) {
  var id2 = this._id;
  return arguments.length ? this.each((typeof value === "function" ? delayFunction : delayConstant)(id2, value)) : get2(this.node(), id2).delay;
}

// ../../node_modules/d3-transition/src/transition/duration.js
function durationFunction(id2, value) {
  return function() {
    set2(this, id2).duration = +value.apply(this, arguments);
  };
}
function durationConstant(id2, value) {
  return value = +value, function() {
    set2(this, id2).duration = value;
  };
}
function duration_default(value) {
  var id2 = this._id;
  return arguments.length ? this.each((typeof value === "function" ? durationFunction : durationConstant)(id2, value)) : get2(this.node(), id2).duration;
}

// ../../node_modules/d3-transition/src/transition/ease.js
function easeConstant(id2, value) {
  if (typeof value !== "function")
    throw new Error();
  return function() {
    set2(this, id2).ease = value;
  };
}
function ease_default(value) {
  var id2 = this._id;
  return arguments.length ? this.each(easeConstant(id2, value)) : get2(this.node(), id2).ease;
}

// ../../node_modules/d3-transition/src/transition/easeVarying.js
function easeVarying(id2, value) {
  return function() {
    var v2 = value.apply(this, arguments);
    if (typeof v2 !== "function")
      throw new Error();
    set2(this, id2).ease = v2;
  };
}
function easeVarying_default(value) {
  if (typeof value !== "function")
    throw new Error();
  return this.each(easeVarying(this._id, value));
}

// ../../node_modules/d3-transition/src/transition/filter.js
function filter_default2(match) {
  if (typeof match !== "function")
    match = matcher_default(match);
  for (var groups2 = this._groups, m = groups2.length, subgroups = new Array(m), j2 = 0; j2 < m; ++j2) {
    for (var group2 = groups2[j2], n2 = group2.length, subgroup = subgroups[j2] = [], node, i2 = 0; i2 < n2; ++i2) {
      if ((node = group2[i2]) && match.call(node, node.__data__, i2, group2)) {
        subgroup.push(node);
      }
    }
  }
  return new Transition(subgroups, this._parents, this._name, this._id);
}

// ../../node_modules/d3-transition/src/transition/merge.js
function merge_default2(transition2) {
  if (transition2._id !== this._id)
    throw new Error();
  for (var groups0 = this._groups, groups1 = transition2._groups, m0 = groups0.length, m1 = groups1.length, m = Math.min(m0, m1), merges = new Array(m0), j2 = 0; j2 < m; ++j2) {
    for (var group0 = groups0[j2], group1 = groups1[j2], n2 = group0.length, merge2 = merges[j2] = new Array(n2), node, i2 = 0; i2 < n2; ++i2) {
      if (node = group0[i2] || group1[i2]) {
        merge2[i2] = node;
      }
    }
  }
  for (; j2 < m0; ++j2) {
    merges[j2] = groups0[j2];
  }
  return new Transition(merges, this._parents, this._name, this._id);
}

// ../../node_modules/d3-transition/src/transition/on.js
function start(name) {
  return (name + "").trim().split(/^|\s+/).every(function(t5) {
    var i2 = t5.indexOf(".");
    if (i2 >= 0)
      t5 = t5.slice(0, i2);
    return !t5 || t5 === "start";
  });
}
function onFunction(id2, name, listener) {
  var on0, on1, sit = start(name) ? init : set2;
  return function() {
    var schedule = sit(this, id2), on2 = schedule.on;
    if (on2 !== on0)
      (on1 = (on0 = on2).copy()).on(name, listener);
    schedule.on = on1;
  };
}
function on_default2(name, listener) {
  var id2 = this._id;
  return arguments.length < 2 ? get2(this.node(), id2).on.on(name) : this.each(onFunction(id2, name, listener));
}

// ../../node_modules/d3-transition/src/transition/remove.js
function removeFunction(id2) {
  return function() {
    var parent = this.parentNode;
    for (var i2 in this.__transition)
      if (+i2 !== id2)
        return;
    if (parent)
      parent.removeChild(this);
  };
}
function remove_default2() {
  return this.on("end.remove", removeFunction(this._id));
}

// ../../node_modules/d3-transition/src/transition/select.js
function select_default3(select) {
  var name = this._name, id2 = this._id;
  if (typeof select !== "function")
    select = selector_default(select);
  for (var groups2 = this._groups, m = groups2.length, subgroups = new Array(m), j2 = 0; j2 < m; ++j2) {
    for (var group2 = groups2[j2], n2 = group2.length, subgroup = subgroups[j2] = new Array(n2), node, subnode, i2 = 0; i2 < n2; ++i2) {
      if ((node = group2[i2]) && (subnode = select.call(node, node.__data__, i2, group2))) {
        if ("__data__" in node)
          subnode.__data__ = node.__data__;
        subgroup[i2] = subnode;
        schedule_default(subgroup[i2], name, id2, i2, subgroup, get2(node, id2));
      }
    }
  }
  return new Transition(subgroups, this._parents, name, id2);
}

// ../../node_modules/d3-transition/src/transition/selectAll.js
function selectAll_default2(select) {
  var name = this._name, id2 = this._id;
  if (typeof select !== "function")
    select = selectorAll_default(select);
  for (var groups2 = this._groups, m = groups2.length, subgroups = [], parents = [], j2 = 0; j2 < m; ++j2) {
    for (var group2 = groups2[j2], n2 = group2.length, node, i2 = 0; i2 < n2; ++i2) {
      if (node = group2[i2]) {
        for (var children2 = select.call(node, node.__data__, i2, group2), child, inherit3 = get2(node, id2), k3 = 0, l2 = children2.length; k3 < l2; ++k3) {
          if (child = children2[k3]) {
            schedule_default(child, name, id2, k3, children2, inherit3);
          }
        }
        subgroups.push(children2);
        parents.push(node);
      }
    }
  }
  return new Transition(subgroups, parents, name, id2);
}

// ../../node_modules/d3-transition/src/transition/selection.js
var Selection2 = selection_default.prototype.constructor;
function selection_default2() {
  return new Selection2(this._groups, this._parents);
}

// ../../node_modules/d3-transition/src/transition/style.js
function styleNull(name, interpolate) {
  var string00, string10, interpolate0;
  return function() {
    var string0 = styleValue(this, name), string1 = (this.style.removeProperty(name), styleValue(this, name));
    return string0 === string1 ? null : string0 === string00 && string1 === string10 ? interpolate0 : interpolate0 = interpolate(string00 = string0, string10 = string1);
  };
}
function styleRemove2(name) {
  return function() {
    this.style.removeProperty(name);
  };
}
function styleConstant2(name, interpolate, value1) {
  var string00, string1 = value1 + "", interpolate0;
  return function() {
    var string0 = styleValue(this, name);
    return string0 === string1 ? null : string0 === string00 ? interpolate0 : interpolate0 = interpolate(string00 = string0, value1);
  };
}
function styleFunction2(name, interpolate, value) {
  var string00, string10, interpolate0;
  return function() {
    var string0 = styleValue(this, name), value1 = value(this), string1 = value1 + "";
    if (value1 == null)
      string1 = value1 = (this.style.removeProperty(name), styleValue(this, name));
    return string0 === string1 ? null : string0 === string00 && string1 === string10 ? interpolate0 : (string10 = string1, interpolate0 = interpolate(string00 = string0, value1));
  };
}
function styleMaybeRemove(id2, name) {
  var on0, on1, listener0, key = "style." + name, event = "end." + key, remove2;
  return function() {
    var schedule = set2(this, id2), on2 = schedule.on, listener = schedule.value[key] == null ? remove2 || (remove2 = styleRemove2(name)) : void 0;
    if (on2 !== on0 || listener0 !== listener)
      (on1 = (on0 = on2).copy()).on(event, listener0 = listener);
    schedule.on = on1;
  };
}
function style_default2(name, value, priority) {
  var i2 = (name += "") === "transform" ? interpolateTransformCss : interpolate_default;
  return value == null ? this.styleTween(name, styleNull(name, i2)).on("end.style." + name, styleRemove2(name)) : typeof value === "function" ? this.styleTween(name, styleFunction2(name, i2, tweenValue(this, "style." + name, value))).each(styleMaybeRemove(this._id, name)) : this.styleTween(name, styleConstant2(name, i2, value), priority).on("end.style." + name, null);
}

// ../../node_modules/d3-transition/src/transition/styleTween.js
function styleInterpolate(name, i2, priority) {
  return function(t5) {
    this.style.setProperty(name, i2.call(this, t5), priority);
  };
}
function styleTween(name, value, priority) {
  var t5, i0;
  function tween() {
    var i2 = value.apply(this, arguments);
    if (i2 !== i0)
      t5 = (i0 = i2) && styleInterpolate(name, i2, priority);
    return t5;
  }
  tween._value = value;
  return tween;
}
function styleTween_default(name, value, priority) {
  var key = "style." + (name += "");
  if (arguments.length < 2)
    return (key = this.tween(key)) && key._value;
  if (value == null)
    return this.tween(key, null);
  if (typeof value !== "function")
    throw new Error();
  return this.tween(key, styleTween(name, value, priority == null ? "" : priority));
}

// ../../node_modules/d3-transition/src/transition/text.js
function textConstant2(value) {
  return function() {
    this.textContent = value;
  };
}
function textFunction2(value) {
  return function() {
    var value1 = value(this);
    this.textContent = value1 == null ? "" : value1;
  };
}
function text_default2(value) {
  return this.tween("text", typeof value === "function" ? textFunction2(tweenValue(this, "text", value)) : textConstant2(value == null ? "" : value + ""));
}

// ../../node_modules/d3-transition/src/transition/textTween.js
function textInterpolate(i2) {
  return function(t5) {
    this.textContent = i2.call(this, t5);
  };
}
function textTween(value) {
  var t03, i0;
  function tween() {
    var i2 = value.apply(this, arguments);
    if (i2 !== i0)
      t03 = (i0 = i2) && textInterpolate(i2);
    return t03;
  }
  tween._value = value;
  return tween;
}
function textTween_default(value) {
  var key = "text";
  if (arguments.length < 1)
    return (key = this.tween(key)) && key._value;
  if (value == null)
    return this.tween(key, null);
  if (typeof value !== "function")
    throw new Error();
  return this.tween(key, textTween(value));
}

// ../../node_modules/d3-transition/src/transition/transition.js
function transition_default() {
  var name = this._name, id0 = this._id, id1 = newId();
  for (var groups2 = this._groups, m = groups2.length, j2 = 0; j2 < m; ++j2) {
    for (var group2 = groups2[j2], n2 = group2.length, node, i2 = 0; i2 < n2; ++i2) {
      if (node = group2[i2]) {
        var inherit3 = get2(node, id0);
        schedule_default(node, name, id1, i2, group2, {
          time: inherit3.time + inherit3.delay + inherit3.duration,
          delay: 0,
          duration: inherit3.duration,
          ease: inherit3.ease
        });
      }
    }
  }
  return new Transition(groups2, this._parents, name, id1);
}

// ../../node_modules/d3-transition/src/transition/end.js
function end_default() {
  var on0, on1, that = this, id2 = that._id, size = that.size();
  return new Promise(function(resolve, reject) {
    var cancel = { value: reject }, end = { value: function() {
      if (--size === 0)
        resolve();
    } };
    that.each(function() {
      var schedule = set2(this, id2), on2 = schedule.on;
      if (on2 !== on0) {
        on1 = (on0 = on2).copy();
        on1._.cancel.push(cancel);
        on1._.interrupt.push(cancel);
        on1._.end.push(end);
      }
      schedule.on = on1;
    });
    if (size === 0)
      resolve();
  });
}

// ../../node_modules/d3-transition/src/transition/index.js
var id = 0;
function Transition(groups2, parents, name, id2) {
  this._groups = groups2;
  this._parents = parents;
  this._name = name;
  this._id = id2;
}
function transition(name) {
  return selection_default().transition(name);
}
function newId() {
  return ++id;
}
var selection_prototype = selection_default.prototype;
Transition.prototype = transition.prototype = {
  constructor: Transition,
  select: select_default3,
  selectAll: selectAll_default2,
  selectChild: selection_prototype.selectChild,
  selectChildren: selection_prototype.selectChildren,
  filter: filter_default2,
  merge: merge_default2,
  selection: selection_default2,
  transition: transition_default,
  call: selection_prototype.call,
  nodes: selection_prototype.nodes,
  node: selection_prototype.node,
  size: selection_prototype.size,
  empty: selection_prototype.empty,
  each: selection_prototype.each,
  on: on_default2,
  attr: attr_default2,
  attrTween: attrTween_default,
  style: style_default2,
  styleTween: styleTween_default,
  text: text_default2,
  textTween: textTween_default,
  remove: remove_default2,
  tween: tween_default,
  delay: delay_default,
  duration: duration_default,
  ease: ease_default,
  easeVarying: easeVarying_default,
  end: end_default,
  [Symbol.iterator]: selection_prototype[Symbol.iterator]
};

// ../../node_modules/d3-ease/src/cubic.js
function cubicInOut(t5) {
  return ((t5 *= 2) <= 1 ? t5 * t5 * t5 : (t5 -= 2) * t5 * t5 + 2) / 2;
}

// ../../node_modules/d3-transition/src/selection/transition.js
var defaultTiming = {
  time: null,
  // Set on use.
  delay: 0,
  duration: 250,
  ease: cubicInOut
};
function inherit(node, id2) {
  var timing;
  while (!(timing = node.__transition) || !(timing = timing[id2])) {
    if (!(node = node.parentNode)) {
      throw new Error(`transition ${id2} not found`);
    }
  }
  return timing;
}
function transition_default2(name) {
  var id2, timing;
  if (name instanceof Transition) {
    id2 = name._id, name = name._name;
  } else {
    id2 = newId(), (timing = defaultTiming).time = now(), name = name == null ? null : name + "";
  }
  for (var groups2 = this._groups, m = groups2.length, j2 = 0; j2 < m; ++j2) {
    for (var group2 = groups2[j2], n2 = group2.length, node, i2 = 0; i2 < n2; ++i2) {
      if (node = group2[i2]) {
        schedule_default(node, name, id2, i2, group2, timing || inherit(node, id2));
      }
    }
  }
  return new Transition(groups2, this._parents, name, id2);
}

// ../../node_modules/d3-transition/src/selection/index.js
selection_default.prototype.interrupt = interrupt_default2;
selection_default.prototype.transition = transition_default2;

// ../../node_modules/d3-brush/src/brush.js
var { abs, max: max2, min: min2 } = Math;
function number1(e) {
  return [+e[0], +e[1]];
}
function number22(e) {
  return [number1(e[0]), number1(e[1])];
}
var X = {
  name: "x",
  handles: ["w", "e"].map(type),
  input: function(x3, e) {
    return x3 == null ? null : [[+x3[0], e[0][1]], [+x3[1], e[1][1]]];
  },
  output: function(xy) {
    return xy && [xy[0][0], xy[1][0]];
  }
};
var Y = {
  name: "y",
  handles: ["n", "s"].map(type),
  input: function(y3, e) {
    return y3 == null ? null : [[e[0][0], +y3[0]], [e[1][0], +y3[1]]];
  },
  output: function(xy) {
    return xy && [xy[0][1], xy[1][1]];
  }
};
var XY = {
  name: "xy",
  handles: ["n", "w", "e", "s", "nw", "ne", "sw", "se"].map(type),
  input: function(xy) {
    return xy == null ? null : number22(xy);
  },
  output: function(xy) {
    return xy;
  }
};
function type(t5) {
  return { type: t5 };
}

// ../../node_modules/d3-path/src/path.js
var pi = Math.PI;
var tau = 2 * pi;
var epsilon2 = 1e-6;
var tauEpsilon = tau - epsilon2;
function append(strings) {
  this._ += strings[0];
  for (let i2 = 1, n2 = strings.length; i2 < n2; ++i2) {
    this._ += arguments[i2] + strings[i2];
  }
}
function appendRound(digits) {
  let d2 = Math.floor(digits);
  if (!(d2 >= 0))
    throw new Error(`invalid digits: ${digits}`);
  if (d2 > 15)
    return append;
  const k3 = 10 ** d2;
  return function(strings) {
    this._ += strings[0];
    for (let i2 = 1, n2 = strings.length; i2 < n2; ++i2) {
      this._ += Math.round(arguments[i2] * k3) / k3 + strings[i2];
    }
  };
}
var Path = class {
  constructor(digits) {
    this._x0 = this._y0 = // start of current subpath
    this._x1 = this._y1 = null;
    this._ = "";
    this._append = digits == null ? append : appendRound(digits);
  }
  moveTo(x3, y3) {
    this._append`M${this._x0 = this._x1 = +x3},${this._y0 = this._y1 = +y3}`;
  }
  closePath() {
    if (this._x1 !== null) {
      this._x1 = this._x0, this._y1 = this._y0;
      this._append`Z`;
    }
  }
  lineTo(x3, y3) {
    this._append`L${this._x1 = +x3},${this._y1 = +y3}`;
  }
  quadraticCurveTo(x12, y12, x3, y3) {
    this._append`Q${+x12},${+y12},${this._x1 = +x3},${this._y1 = +y3}`;
  }
  bezierCurveTo(x12, y12, x22, y22, x3, y3) {
    this._append`C${+x12},${+y12},${+x22},${+y22},${this._x1 = +x3},${this._y1 = +y3}`;
  }
  arcTo(x12, y12, x22, y22, r2) {
    x12 = +x12, y12 = +y12, x22 = +x22, y22 = +y22, r2 = +r2;
    if (r2 < 0)
      throw new Error(`negative radius: ${r2}`);
    let x05 = this._x1, y05 = this._y1, x21 = x22 - x12, y21 = y22 - y12, x01 = x05 - x12, y01 = y05 - y12, l01_2 = x01 * x01 + y01 * y01;
    if (this._x1 === null) {
      this._append`M${this._x1 = x12},${this._y1 = y12}`;
    } else if (!(l01_2 > epsilon2))
      ;
    else if (!(Math.abs(y01 * x21 - y21 * x01) > epsilon2) || !r2) {
      this._append`L${this._x1 = x12},${this._y1 = y12}`;
    } else {
      let x20 = x22 - x05, y20 = y22 - y05, l21_2 = x21 * x21 + y21 * y21, l20_2 = x20 * x20 + y20 * y20, l21 = Math.sqrt(l21_2), l01 = Math.sqrt(l01_2), l2 = r2 * Math.tan((pi - Math.acos((l21_2 + l01_2 - l20_2) / (2 * l21 * l01))) / 2), t01 = l2 / l01, t21 = l2 / l21;
      if (Math.abs(t01 - 1) > epsilon2) {
        this._append`L${x12 + t01 * x01},${y12 + t01 * y01}`;
      }
      this._append`A${r2},${r2},0,0,${+(y01 * x20 > x01 * y20)},${this._x1 = x12 + t21 * x21},${this._y1 = y12 + t21 * y21}`;
    }
  }
  arc(x3, y3, r2, a0, a1, ccw) {
    x3 = +x3, y3 = +y3, r2 = +r2, ccw = !!ccw;
    if (r2 < 0)
      throw new Error(`negative radius: ${r2}`);
    let dx = r2 * Math.cos(a0), dy = r2 * Math.sin(a0), x05 = x3 + dx, y05 = y3 + dy, cw = 1 ^ ccw, da = ccw ? a0 - a1 : a1 - a0;
    if (this._x1 === null) {
      this._append`M${x05},${y05}`;
    } else if (Math.abs(this._x1 - x05) > epsilon2 || Math.abs(this._y1 - y05) > epsilon2) {
      this._append`L${x05},${y05}`;
    }
    if (!r2)
      return;
    if (da < 0)
      da = da % tau + tau;
    if (da > tauEpsilon) {
      this._append`A${r2},${r2},0,1,${cw},${x3 - dx},${y3 - dy}A${r2},${r2},0,1,${cw},${this._x1 = x05},${this._y1 = y05}`;
    } else if (da > epsilon2) {
      this._append`A${r2},${r2},0,${+(da >= pi)},${cw},${this._x1 = x3 + r2 * Math.cos(a1)},${this._y1 = y3 + r2 * Math.sin(a1)}`;
    }
  }
  rect(x3, y3, w2, h2) {
    this._append`M${this._x0 = this._x1 = +x3},${this._y0 = this._y1 = +y3}h${w2 = +w2}v${+h2}h${-w2}Z`;
  }
  toString() {
    return this._;
  }
};
function path() {
  return new Path();
}
path.prototype = Path.prototype;
function pathRound(digits = 3) {
  return new Path(+digits);
}

// ../../node_modules/d3-format/src/formatDecimal.js
function formatDecimal_default(x3) {
  return Math.abs(x3 = Math.round(x3)) >= 1e21 ? x3.toLocaleString("en").replace(/,/g, "") : x3.toString(10);
}
function formatDecimalParts(x3, p2) {
  if ((i2 = (x3 = p2 ? x3.toExponential(p2 - 1) : x3.toExponential()).indexOf("e")) < 0)
    return null;
  var i2, coefficient = x3.slice(0, i2);
  return [
    coefficient.length > 1 ? coefficient[0] + coefficient.slice(2) : coefficient,
    +x3.slice(i2 + 1)
  ];
}

// ../../node_modules/d3-format/src/exponent.js
function exponent_default(x3) {
  return x3 = formatDecimalParts(Math.abs(x3)), x3 ? x3[1] : NaN;
}

// ../../node_modules/d3-format/src/formatGroup.js
function formatGroup_default(grouping, thousands) {
  return function(value, width) {
    var i2 = value.length, t5 = [], j2 = 0, g2 = grouping[0], length3 = 0;
    while (i2 > 0 && g2 > 0) {
      if (length3 + g2 + 1 > width)
        g2 = Math.max(1, width - length3);
      t5.push(value.substring(i2 -= g2, i2 + g2));
      if ((length3 += g2 + 1) > width)
        break;
      g2 = grouping[j2 = (j2 + 1) % grouping.length];
    }
    return t5.reverse().join(thousands);
  };
}

// ../../node_modules/d3-format/src/formatNumerals.js
function formatNumerals_default(numerals) {
  return function(value) {
    return value.replace(/[0-9]/g, function(i2) {
      return numerals[+i2];
    });
  };
}

// ../../node_modules/d3-format/src/formatSpecifier.js
var re = /^(?:(.)?([<>=^]))?([+\-( ])?([$#])?(0)?(\d+)?(,)?(\.\d+)?(~)?([a-z%])?$/i;
function formatSpecifier(specifier) {
  if (!(match = re.exec(specifier)))
    throw new Error("invalid format: " + specifier);
  var match;
  return new FormatSpecifier({
    fill: match[1],
    align: match[2],
    sign: match[3],
    symbol: match[4],
    zero: match[5],
    width: match[6],
    comma: match[7],
    precision: match[8] && match[8].slice(1),
    trim: match[9],
    type: match[10]
  });
}
formatSpecifier.prototype = FormatSpecifier.prototype;
function FormatSpecifier(specifier) {
  this.fill = specifier.fill === void 0 ? " " : specifier.fill + "";
  this.align = specifier.align === void 0 ? ">" : specifier.align + "";
  this.sign = specifier.sign === void 0 ? "-" : specifier.sign + "";
  this.symbol = specifier.symbol === void 0 ? "" : specifier.symbol + "";
  this.zero = !!specifier.zero;
  this.width = specifier.width === void 0 ? void 0 : +specifier.width;
  this.comma = !!specifier.comma;
  this.precision = specifier.precision === void 0 ? void 0 : +specifier.precision;
  this.trim = !!specifier.trim;
  this.type = specifier.type === void 0 ? "" : specifier.type + "";
}
FormatSpecifier.prototype.toString = function() {
  return this.fill + this.align + this.sign + this.symbol + (this.zero ? "0" : "") + (this.width === void 0 ? "" : Math.max(1, this.width | 0)) + (this.comma ? "," : "") + (this.precision === void 0 ? "" : "." + Math.max(0, this.precision | 0)) + (this.trim ? "~" : "") + this.type;
};

// ../../node_modules/d3-format/src/formatTrim.js
function formatTrim_default(s3) {
  out:
    for (var n2 = s3.length, i2 = 1, i0 = -1, i1; i2 < n2; ++i2) {
      switch (s3[i2]) {
        case ".":
          i0 = i1 = i2;
          break;
        case "0":
          if (i0 === 0)
            i0 = i2;
          i1 = i2;
          break;
        default:
          if (!+s3[i2])
            break out;
          if (i0 > 0)
            i0 = 0;
          break;
      }
    }
  return i0 > 0 ? s3.slice(0, i0) + s3.slice(i1 + 1) : s3;
}

// ../../node_modules/d3-format/src/formatPrefixAuto.js
var prefixExponent;
function formatPrefixAuto_default(x3, p2) {
  var d2 = formatDecimalParts(x3, p2);
  if (!d2)
    return x3 + "";
  var coefficient = d2[0], exponent = d2[1], i2 = exponent - (prefixExponent = Math.max(-8, Math.min(8, Math.floor(exponent / 3))) * 3) + 1, n2 = coefficient.length;
  return i2 === n2 ? coefficient : i2 > n2 ? coefficient + new Array(i2 - n2 + 1).join("0") : i2 > 0 ? coefficient.slice(0, i2) + "." + coefficient.slice(i2) : "0." + new Array(1 - i2).join("0") + formatDecimalParts(x3, Math.max(0, p2 + i2 - 1))[0];
}

// ../../node_modules/d3-format/src/formatRounded.js
function formatRounded_default(x3, p2) {
  var d2 = formatDecimalParts(x3, p2);
  if (!d2)
    return x3 + "";
  var coefficient = d2[0], exponent = d2[1];
  return exponent < 0 ? "0." + new Array(-exponent).join("0") + coefficient : coefficient.length > exponent + 1 ? coefficient.slice(0, exponent + 1) + "." + coefficient.slice(exponent + 1) : coefficient + new Array(exponent - coefficient.length + 2).join("0");
}

// ../../node_modules/d3-format/src/formatTypes.js
var formatTypes_default = {
  "%": (x3, p2) => (x3 * 100).toFixed(p2),
  "b": (x3) => Math.round(x3).toString(2),
  "c": (x3) => x3 + "",
  "d": formatDecimal_default,
  "e": (x3, p2) => x3.toExponential(p2),
  "f": (x3, p2) => x3.toFixed(p2),
  "g": (x3, p2) => x3.toPrecision(p2),
  "o": (x3) => Math.round(x3).toString(8),
  "p": (x3, p2) => formatRounded_default(x3 * 100, p2),
  "r": formatRounded_default,
  "s": formatPrefixAuto_default,
  "X": (x3) => Math.round(x3).toString(16).toUpperCase(),
  "x": (x3) => Math.round(x3).toString(16)
};

// ../../node_modules/d3-format/src/identity.js
function identity_default2(x3) {
  return x3;
}

// ../../node_modules/d3-format/src/locale.js
var map = Array.prototype.map;
var prefixes = ["y", "z", "a", "f", "p", "n", "\xB5", "m", "", "k", "M", "G", "T", "P", "E", "Z", "Y"];
function locale_default(locale3) {
  var group2 = locale3.grouping === void 0 || locale3.thousands === void 0 ? identity_default2 : formatGroup_default(map.call(locale3.grouping, Number), locale3.thousands + ""), currencyPrefix = locale3.currency === void 0 ? "" : locale3.currency[0] + "", currencySuffix = locale3.currency === void 0 ? "" : locale3.currency[1] + "", decimal = locale3.decimal === void 0 ? "." : locale3.decimal + "", numerals = locale3.numerals === void 0 ? identity_default2 : formatNumerals_default(map.call(locale3.numerals, String)), percent = locale3.percent === void 0 ? "%" : locale3.percent + "", minus = locale3.minus === void 0 ? "\u2212" : locale3.minus + "", nan = locale3.nan === void 0 ? "NaN" : locale3.nan + "";
  function newFormat(specifier) {
    specifier = formatSpecifier(specifier);
    var fill = specifier.fill, align = specifier.align, sign3 = specifier.sign, symbol2 = specifier.symbol, zero3 = specifier.zero, width = specifier.width, comma = specifier.comma, precision = specifier.precision, trim = specifier.trim, type2 = specifier.type;
    if (type2 === "n")
      comma = true, type2 = "g";
    else if (!formatTypes_default[type2])
      precision === void 0 && (precision = 12), trim = true, type2 = "g";
    if (zero3 || fill === "0" && align === "=")
      zero3 = true, fill = "0", align = "=";
    var prefix = symbol2 === "$" ? currencyPrefix : symbol2 === "#" && /[boxX]/.test(type2) ? "0" + type2.toLowerCase() : "", suffix = symbol2 === "$" ? currencySuffix : /[%p]/.test(type2) ? percent : "";
    var formatType = formatTypes_default[type2], maybeSuffix = /[defgprs%]/.test(type2);
    precision = precision === void 0 ? 6 : /[gprs]/.test(type2) ? Math.max(1, Math.min(21, precision)) : Math.max(0, Math.min(20, precision));
    function format3(value) {
      var valuePrefix = prefix, valueSuffix = suffix, i2, n2, c5;
      if (type2 === "c") {
        valueSuffix = formatType(value) + valueSuffix;
        value = "";
      } else {
        value = +value;
        var valueNegative = value < 0 || 1 / value < 0;
        value = isNaN(value) ? nan : formatType(Math.abs(value), precision);
        if (trim)
          value = formatTrim_default(value);
        if (valueNegative && +value === 0 && sign3 !== "+")
          valueNegative = false;
        valuePrefix = (valueNegative ? sign3 === "(" ? sign3 : minus : sign3 === "-" || sign3 === "(" ? "" : sign3) + valuePrefix;
        valueSuffix = (type2 === "s" ? prefixes[8 + prefixExponent / 3] : "") + valueSuffix + (valueNegative && sign3 === "(" ? ")" : "");
        if (maybeSuffix) {
          i2 = -1, n2 = value.length;
          while (++i2 < n2) {
            if (c5 = value.charCodeAt(i2), 48 > c5 || c5 > 57) {
              valueSuffix = (c5 === 46 ? decimal + value.slice(i2 + 1) : value.slice(i2)) + valueSuffix;
              value = value.slice(0, i2);
              break;
            }
          }
        }
      }
      if (comma && !zero3)
        value = group2(value, Infinity);
      var length3 = valuePrefix.length + value.length + valueSuffix.length, padding = length3 < width ? new Array(width - length3 + 1).join(fill) : "";
      if (comma && zero3)
        value = group2(padding + value, padding.length ? width - valueSuffix.length : Infinity), padding = "";
      switch (align) {
        case "<":
          value = valuePrefix + value + valueSuffix + padding;
          break;
        case "=":
          value = valuePrefix + padding + value + valueSuffix;
          break;
        case "^":
          value = padding.slice(0, length3 = padding.length >> 1) + valuePrefix + value + valueSuffix + padding.slice(length3);
          break;
        default:
          value = padding + valuePrefix + value + valueSuffix;
          break;
      }
      return numerals(value);
    }
    format3.toString = function() {
      return specifier + "";
    };
    return format3;
  }
  function formatPrefix2(specifier, value) {
    var f2 = newFormat((specifier = formatSpecifier(specifier), specifier.type = "f", specifier)), e = Math.max(-8, Math.min(8, Math.floor(exponent_default(value) / 3))) * 3, k3 = Math.pow(10, -e), prefix = prefixes[8 + e / 3];
    return function(value2) {
      return f2(k3 * value2) + prefix;
    };
  }
  return {
    format: newFormat,
    formatPrefix: formatPrefix2
  };
}

// ../../node_modules/d3-format/src/defaultLocale.js
var locale;
var format;
var formatPrefix;
defaultLocale({
  thousands: ",",
  grouping: [3],
  currency: ["$", ""]
});
function defaultLocale(definition) {
  locale = locale_default(definition);
  format = locale.format;
  formatPrefix = locale.formatPrefix;
  return locale;
}

// ../../node_modules/d3-format/src/precisionFixed.js
function precisionFixed_default(step) {
  return Math.max(0, -exponent_default(Math.abs(step)));
}

// ../../node_modules/d3-format/src/precisionPrefix.js
function precisionPrefix_default(step, value) {
  return Math.max(0, Math.max(-8, Math.min(8, Math.floor(exponent_default(value) / 3))) * 3 - exponent_default(Math.abs(step)));
}

// ../../node_modules/d3-format/src/precisionRound.js
function precisionRound_default(step, max3) {
  step = Math.abs(step), max3 = Math.abs(max3) - step;
  return Math.max(0, exponent_default(max3) - exponent_default(step)) + 1;
}

// ../../node_modules/d3/node_modules/d3-geo/src/math.js
var epsilon3 = 1e-6;
var epsilon22 = 1e-12;
var pi2 = Math.PI;
var halfPi = pi2 / 2;
var quarterPi = pi2 / 4;
var tau2 = pi2 * 2;
var degrees3 = 180 / pi2;
var radians2 = pi2 / 180;
var abs2 = Math.abs;
var atan = Math.atan;
var atan2 = Math.atan2;
var cos = Math.cos;
var exp = Math.exp;
var log = Math.log;
var pow = Math.pow;
var sin = Math.sin;
var sign = Math.sign || function(x3) {
  return x3 > 0 ? 1 : x3 < 0 ? -1 : 0;
};
var sqrt = Math.sqrt;
var tan = Math.tan;
function acos(x3) {
  return x3 > 1 ? 0 : x3 < -1 ? pi2 : Math.acos(x3);
}
function asin(x3) {
  return x3 > 1 ? halfPi : x3 < -1 ? -halfPi : Math.asin(x3);
}

// ../../node_modules/d3/node_modules/d3-geo/src/noop.js
function noop2() {
}

// ../../node_modules/d3/node_modules/d3-geo/src/stream.js
function streamGeometry(geometry, stream) {
  if (geometry && streamGeometryType.hasOwnProperty(geometry.type)) {
    streamGeometryType[geometry.type](geometry, stream);
  }
}
var streamObjectType = {
  Feature: function(object, stream) {
    streamGeometry(object.geometry, stream);
  },
  FeatureCollection: function(object, stream) {
    var features = object.features, i2 = -1, n2 = features.length;
    while (++i2 < n2)
      streamGeometry(features[i2].geometry, stream);
  }
};
var streamGeometryType = {
  Sphere: function(object, stream) {
    stream.sphere();
  },
  Point: function(object, stream) {
    object = object.coordinates;
    stream.point(object[0], object[1], object[2]);
  },
  MultiPoint: function(object, stream) {
    var coordinates = object.coordinates, i2 = -1, n2 = coordinates.length;
    while (++i2 < n2)
      object = coordinates[i2], stream.point(object[0], object[1], object[2]);
  },
  LineString: function(object, stream) {
    streamLine(object.coordinates, stream, 0);
  },
  MultiLineString: function(object, stream) {
    var coordinates = object.coordinates, i2 = -1, n2 = coordinates.length;
    while (++i2 < n2)
      streamLine(coordinates[i2], stream, 0);
  },
  Polygon: function(object, stream) {
    streamPolygon(object.coordinates, stream);
  },
  MultiPolygon: function(object, stream) {
    var coordinates = object.coordinates, i2 = -1, n2 = coordinates.length;
    while (++i2 < n2)
      streamPolygon(coordinates[i2], stream);
  },
  GeometryCollection: function(object, stream) {
    var geometries = object.geometries, i2 = -1, n2 = geometries.length;
    while (++i2 < n2)
      streamGeometry(geometries[i2], stream);
  }
};
function streamLine(coordinates, stream, closed) {
  var i2 = -1, n2 = coordinates.length - closed, coordinate;
  stream.lineStart();
  while (++i2 < n2)
    coordinate = coordinates[i2], stream.point(coordinate[0], coordinate[1], coordinate[2]);
  stream.lineEnd();
}
function streamPolygon(coordinates, stream) {
  var i2 = -1, n2 = coordinates.length;
  stream.polygonStart();
  while (++i2 < n2)
    streamLine(coordinates[i2], stream, 1);
  stream.polygonEnd();
}
function stream_default(object, stream) {
  if (object && streamObjectType.hasOwnProperty(object.type)) {
    streamObjectType[object.type](object, stream);
  } else {
    streamGeometry(object, stream);
  }
}

// ../../node_modules/d3/node_modules/d3-geo/src/cartesian.js
function spherical(cartesian2) {
  return [atan2(cartesian2[1], cartesian2[0]), asin(cartesian2[2])];
}
function cartesian(spherical2) {
  var lambda = spherical2[0], phi = spherical2[1], cosPhi = cos(phi);
  return [cosPhi * cos(lambda), cosPhi * sin(lambda), sin(phi)];
}
function cartesianDot(a3, b2) {
  return a3[0] * b2[0] + a3[1] * b2[1] + a3[2] * b2[2];
}
function cartesianCross(a3, b2) {
  return [a3[1] * b2[2] - a3[2] * b2[1], a3[2] * b2[0] - a3[0] * b2[2], a3[0] * b2[1] - a3[1] * b2[0]];
}
function cartesianAddInPlace(a3, b2) {
  a3[0] += b2[0], a3[1] += b2[1], a3[2] += b2[2];
}
function cartesianScale(vector, k3) {
  return [vector[0] * k3, vector[1] * k3, vector[2] * k3];
}
function cartesianNormalizeInPlace(d2) {
  var l2 = sqrt(d2[0] * d2[0] + d2[1] * d2[1] + d2[2] * d2[2]);
  d2[0] /= l2, d2[1] /= l2, d2[2] /= l2;
}

// ../../node_modules/d3/node_modules/d3-geo/src/compose.js
function compose_default(a3, b2) {
  function compose(x3, y3) {
    return x3 = a3(x3, y3), b2(x3[0], x3[1]);
  }
  if (a3.invert && b2.invert)
    compose.invert = function(x3, y3) {
      return x3 = b2.invert(x3, y3), x3 && a3.invert(x3[0], x3[1]);
    };
  return compose;
}

// ../../node_modules/d3/node_modules/d3-geo/src/rotation.js
function rotationIdentity(lambda, phi) {
  if (abs2(lambda) > pi2)
    lambda -= Math.round(lambda / tau2) * tau2;
  return [lambda, phi];
}
rotationIdentity.invert = rotationIdentity;
function rotateRadians(deltaLambda, deltaPhi, deltaGamma) {
  return (deltaLambda %= tau2) ? deltaPhi || deltaGamma ? compose_default(rotationLambda(deltaLambda), rotationPhiGamma(deltaPhi, deltaGamma)) : rotationLambda(deltaLambda) : deltaPhi || deltaGamma ? rotationPhiGamma(deltaPhi, deltaGamma) : rotationIdentity;
}
function forwardRotationLambda(deltaLambda) {
  return function(lambda, phi) {
    lambda += deltaLambda;
    if (abs2(lambda) > pi2)
      lambda -= Math.round(lambda / tau2) * tau2;
    return [lambda, phi];
  };
}
function rotationLambda(deltaLambda) {
  var rotation = forwardRotationLambda(deltaLambda);
  rotation.invert = forwardRotationLambda(-deltaLambda);
  return rotation;
}
function rotationPhiGamma(deltaPhi, deltaGamma) {
  var cosDeltaPhi = cos(deltaPhi), sinDeltaPhi = sin(deltaPhi), cosDeltaGamma = cos(deltaGamma), sinDeltaGamma = sin(deltaGamma);
  function rotation(lambda, phi) {
    var cosPhi = cos(phi), x3 = cos(lambda) * cosPhi, y3 = sin(lambda) * cosPhi, z2 = sin(phi), k3 = z2 * cosDeltaPhi + x3 * sinDeltaPhi;
    return [
      atan2(y3 * cosDeltaGamma - k3 * sinDeltaGamma, x3 * cosDeltaPhi - z2 * sinDeltaPhi),
      asin(k3 * cosDeltaGamma + y3 * sinDeltaGamma)
    ];
  }
  rotation.invert = function(lambda, phi) {
    var cosPhi = cos(phi), x3 = cos(lambda) * cosPhi, y3 = sin(lambda) * cosPhi, z2 = sin(phi), k3 = z2 * cosDeltaGamma - y3 * sinDeltaGamma;
    return [
      atan2(y3 * cosDeltaGamma + z2 * sinDeltaGamma, x3 * cosDeltaPhi + k3 * sinDeltaPhi),
      asin(k3 * cosDeltaPhi - x3 * sinDeltaPhi)
    ];
  };
  return rotation;
}
function rotation_default(rotate) {
  rotate = rotateRadians(rotate[0] * radians2, rotate[1] * radians2, rotate.length > 2 ? rotate[2] * radians2 : 0);
  function forward(coordinates) {
    coordinates = rotate(coordinates[0] * radians2, coordinates[1] * radians2);
    return coordinates[0] *= degrees3, coordinates[1] *= degrees3, coordinates;
  }
  forward.invert = function(coordinates) {
    coordinates = rotate.invert(coordinates[0] * radians2, coordinates[1] * radians2);
    return coordinates[0] *= degrees3, coordinates[1] *= degrees3, coordinates;
  };
  return forward;
}

// ../../node_modules/d3/node_modules/d3-geo/src/circle.js
function circleStream(stream, radius2, delta, direction, t03, t13) {
  if (!delta)
    return;
  var cosRadius = cos(radius2), sinRadius = sin(radius2), step = direction * delta;
  if (t03 == null) {
    t03 = radius2 + direction * tau2;
    t13 = radius2 - step / 2;
  } else {
    t03 = circleRadius(cosRadius, t03);
    t13 = circleRadius(cosRadius, t13);
    if (direction > 0 ? t03 < t13 : t03 > t13)
      t03 += direction * tau2;
  }
  for (var point6, t5 = t03; direction > 0 ? t5 > t13 : t5 < t13; t5 -= step) {
    point6 = spherical([cosRadius, -sinRadius * cos(t5), -sinRadius * sin(t5)]);
    stream.point(point6[0], point6[1]);
  }
}
function circleRadius(cosRadius, point6) {
  point6 = cartesian(point6), point6[0] -= cosRadius;
  cartesianNormalizeInPlace(point6);
  var radius2 = acos(-point6[1]);
  return ((-point6[2] < 0 ? -radius2 : radius2) + tau2 - epsilon3) % tau2;
}

// ../../node_modules/d3/node_modules/d3-geo/src/clip/buffer.js
function buffer_default() {
  var lines = [], line2;
  return {
    point: function(x3, y3, m) {
      line2.push([x3, y3, m]);
    },
    lineStart: function() {
      lines.push(line2 = []);
    },
    lineEnd: noop2,
    rejoin: function() {
      if (lines.length > 1)
        lines.push(lines.pop().concat(lines.shift()));
    },
    result: function() {
      var result = lines;
      lines = [];
      line2 = null;
      return result;
    }
  };
}

// ../../node_modules/d3/node_modules/d3-geo/src/pointEqual.js
function pointEqual_default(a3, b2) {
  return abs2(a3[0] - b2[0]) < epsilon3 && abs2(a3[1] - b2[1]) < epsilon3;
}

// ../../node_modules/d3/node_modules/d3-geo/src/clip/rejoin.js
function Intersection(point6, points, other, entry) {
  this.x = point6;
  this.z = points;
  this.o = other;
  this.e = entry;
  this.v = false;
  this.n = this.p = null;
}
function rejoin_default(segments, compareIntersection2, startInside, interpolate, stream) {
  var subject = [], clip = [], i2, n2;
  segments.forEach(function(segment) {
    if ((n3 = segment.length - 1) <= 0)
      return;
    var n3, p0 = segment[0], p1 = segment[n3], x3;
    if (pointEqual_default(p0, p1)) {
      if (!p0[2] && !p1[2]) {
        stream.lineStart();
        for (i2 = 0; i2 < n3; ++i2)
          stream.point((p0 = segment[i2])[0], p0[1]);
        stream.lineEnd();
        return;
      }
      p1[0] += 2 * epsilon3;
    }
    subject.push(x3 = new Intersection(p0, segment, null, true));
    clip.push(x3.o = new Intersection(p0, null, x3, false));
    subject.push(x3 = new Intersection(p1, segment, null, false));
    clip.push(x3.o = new Intersection(p1, null, x3, true));
  });
  if (!subject.length)
    return;
  clip.sort(compareIntersection2);
  link(subject);
  link(clip);
  for (i2 = 0, n2 = clip.length; i2 < n2; ++i2) {
    clip[i2].e = startInside = !startInside;
  }
  var start2 = subject[0], points, point6;
  while (1) {
    var current = start2, isSubject = true;
    while (current.v)
      if ((current = current.n) === start2)
        return;
    points = current.z;
    stream.lineStart();
    do {
      current.v = current.o.v = true;
      if (current.e) {
        if (isSubject) {
          for (i2 = 0, n2 = points.length; i2 < n2; ++i2)
            stream.point((point6 = points[i2])[0], point6[1]);
        } else {
          interpolate(current.x, current.n.x, 1, stream);
        }
        current = current.n;
      } else {
        if (isSubject) {
          points = current.p.z;
          for (i2 = points.length - 1; i2 >= 0; --i2)
            stream.point((point6 = points[i2])[0], point6[1]);
        } else {
          interpolate(current.x, current.p.x, -1, stream);
        }
        current = current.p;
      }
      current = current.o;
      points = current.z;
      isSubject = !isSubject;
    } while (!current.v);
    stream.lineEnd();
  }
}
function link(array2) {
  if (!(n2 = array2.length))
    return;
  var n2, i2 = 0, a3 = array2[0], b2;
  while (++i2 < n2) {
    a3.n = b2 = array2[i2];
    b2.p = a3;
    a3 = b2;
  }
  a3.n = b2 = array2[0];
  b2.p = a3;
}

// ../../node_modules/d3/node_modules/d3-geo/src/polygonContains.js
function longitude(point6) {
  return abs2(point6[0]) <= pi2 ? point6[0] : sign(point6[0]) * ((abs2(point6[0]) + pi2) % tau2 - pi2);
}
function polygonContains_default(polygon, point6) {
  var lambda = longitude(point6), phi = point6[1], sinPhi = sin(phi), normal = [sin(lambda), -cos(lambda), 0], angle = 0, winding = 0;
  var sum2 = new Adder();
  if (sinPhi === 1)
    phi = halfPi + epsilon3;
  else if (sinPhi === -1)
    phi = -halfPi - epsilon3;
  for (var i2 = 0, n2 = polygon.length; i2 < n2; ++i2) {
    if (!(m = (ring = polygon[i2]).length))
      continue;
    var ring, m, point0 = ring[m - 1], lambda0 = longitude(point0), phi0 = point0[1] / 2 + quarterPi, sinPhi0 = sin(phi0), cosPhi0 = cos(phi0);
    for (var j2 = 0; j2 < m; ++j2, lambda0 = lambda1, sinPhi0 = sinPhi1, cosPhi0 = cosPhi1, point0 = point1) {
      var point1 = ring[j2], lambda1 = longitude(point1), phi1 = point1[1] / 2 + quarterPi, sinPhi1 = sin(phi1), cosPhi1 = cos(phi1), delta = lambda1 - lambda0, sign3 = delta >= 0 ? 1 : -1, absDelta = sign3 * delta, antimeridian = absDelta > pi2, k3 = sinPhi0 * sinPhi1;
      sum2.add(atan2(k3 * sign3 * sin(absDelta), cosPhi0 * cosPhi1 + k3 * cos(absDelta)));
      angle += antimeridian ? delta + sign3 * tau2 : delta;
      if (antimeridian ^ lambda0 >= lambda ^ lambda1 >= lambda) {
        var arc = cartesianCross(cartesian(point0), cartesian(point1));
        cartesianNormalizeInPlace(arc);
        var intersection = cartesianCross(normal, arc);
        cartesianNormalizeInPlace(intersection);
        var phiArc = (antimeridian ^ delta >= 0 ? -1 : 1) * asin(intersection[2]);
        if (phi > phiArc || phi === phiArc && (arc[0] || arc[1])) {
          winding += antimeridian ^ delta >= 0 ? 1 : -1;
        }
      }
    }
  }
  return (angle < -epsilon3 || angle < epsilon3 && sum2 < -epsilon22) ^ winding & 1;
}

// ../../node_modules/d3/node_modules/d3-geo/src/clip/index.js
function clip_default(pointVisible, clipLine, interpolate, start2) {
  return function(sink) {
    var line2 = clipLine(sink), ringBuffer = buffer_default(), ringSink = clipLine(ringBuffer), polygonStarted = false, polygon, segments, ring;
    var clip = {
      point: point6,
      lineStart,
      lineEnd,
      polygonStart: function() {
        clip.point = pointRing;
        clip.lineStart = ringStart;
        clip.lineEnd = ringEnd;
        segments = [];
        polygon = [];
      },
      polygonEnd: function() {
        clip.point = point6;
        clip.lineStart = lineStart;
        clip.lineEnd = lineEnd;
        segments = merge(segments);
        var startInside = polygonContains_default(polygon, start2);
        if (segments.length) {
          if (!polygonStarted)
            sink.polygonStart(), polygonStarted = true;
          rejoin_default(segments, compareIntersection, startInside, interpolate, sink);
        } else if (startInside) {
          if (!polygonStarted)
            sink.polygonStart(), polygonStarted = true;
          sink.lineStart();
          interpolate(null, null, 1, sink);
          sink.lineEnd();
        }
        if (polygonStarted)
          sink.polygonEnd(), polygonStarted = false;
        segments = polygon = null;
      },
      sphere: function() {
        sink.polygonStart();
        sink.lineStart();
        interpolate(null, null, 1, sink);
        sink.lineEnd();
        sink.polygonEnd();
      }
    };
    function point6(lambda, phi) {
      if (pointVisible(lambda, phi))
        sink.point(lambda, phi);
    }
    function pointLine(lambda, phi) {
      line2.point(lambda, phi);
    }
    function lineStart() {
      clip.point = pointLine;
      line2.lineStart();
    }
    function lineEnd() {
      clip.point = point6;
      line2.lineEnd();
    }
    function pointRing(lambda, phi) {
      ring.push([lambda, phi]);
      ringSink.point(lambda, phi);
    }
    function ringStart() {
      ringSink.lineStart();
      ring = [];
    }
    function ringEnd() {
      pointRing(ring[0][0], ring[0][1]);
      ringSink.lineEnd();
      var clean = ringSink.clean(), ringSegments = ringBuffer.result(), i2, n2 = ringSegments.length, m, segment, point7;
      ring.pop();
      polygon.push(ring);
      ring = null;
      if (!n2)
        return;
      if (clean & 1) {
        segment = ringSegments[0];
        if ((m = segment.length - 1) > 0) {
          if (!polygonStarted)
            sink.polygonStart(), polygonStarted = true;
          sink.lineStart();
          for (i2 = 0; i2 < m; ++i2)
            sink.point((point7 = segment[i2])[0], point7[1]);
          sink.lineEnd();
        }
        return;
      }
      if (n2 > 1 && clean & 2)
        ringSegments.push(ringSegments.pop().concat(ringSegments.shift()));
      segments.push(ringSegments.filter(validSegment));
    }
    return clip;
  };
}
function validSegment(segment) {
  return segment.length > 1;
}
function compareIntersection(a3, b2) {
  return ((a3 = a3.x)[0] < 0 ? a3[1] - halfPi - epsilon3 : halfPi - a3[1]) - ((b2 = b2.x)[0] < 0 ? b2[1] - halfPi - epsilon3 : halfPi - b2[1]);
}

// ../../node_modules/d3/node_modules/d3-geo/src/clip/antimeridian.js
var antimeridian_default = clip_default(
  function() {
    return true;
  },
  clipAntimeridianLine,
  clipAntimeridianInterpolate,
  [-pi2, -halfPi]
);
function clipAntimeridianLine(stream) {
  var lambda0 = NaN, phi0 = NaN, sign0 = NaN, clean;
  return {
    lineStart: function() {
      stream.lineStart();
      clean = 1;
    },
    point: function(lambda1, phi1) {
      var sign1 = lambda1 > 0 ? pi2 : -pi2, delta = abs2(lambda1 - lambda0);
      if (abs2(delta - pi2) < epsilon3) {
        stream.point(lambda0, phi0 = (phi0 + phi1) / 2 > 0 ? halfPi : -halfPi);
        stream.point(sign0, phi0);
        stream.lineEnd();
        stream.lineStart();
        stream.point(sign1, phi0);
        stream.point(lambda1, phi0);
        clean = 0;
      } else if (sign0 !== sign1 && delta >= pi2) {
        if (abs2(lambda0 - sign0) < epsilon3)
          lambda0 -= sign0 * epsilon3;
        if (abs2(lambda1 - sign1) < epsilon3)
          lambda1 -= sign1 * epsilon3;
        phi0 = clipAntimeridianIntersect(lambda0, phi0, lambda1, phi1);
        stream.point(sign0, phi0);
        stream.lineEnd();
        stream.lineStart();
        stream.point(sign1, phi0);
        clean = 0;
      }
      stream.point(lambda0 = lambda1, phi0 = phi1);
      sign0 = sign1;
    },
    lineEnd: function() {
      stream.lineEnd();
      lambda0 = phi0 = NaN;
    },
    clean: function() {
      return 2 - clean;
    }
  };
}
function clipAntimeridianIntersect(lambda0, phi0, lambda1, phi1) {
  var cosPhi0, cosPhi1, sinLambda0Lambda1 = sin(lambda0 - lambda1);
  return abs2(sinLambda0Lambda1) > epsilon3 ? atan((sin(phi0) * (cosPhi1 = cos(phi1)) * sin(lambda1) - sin(phi1) * (cosPhi0 = cos(phi0)) * sin(lambda0)) / (cosPhi0 * cosPhi1 * sinLambda0Lambda1)) : (phi0 + phi1) / 2;
}
function clipAntimeridianInterpolate(from, to, direction, stream) {
  var phi;
  if (from == null) {
    phi = direction * halfPi;
    stream.point(-pi2, phi);
    stream.point(0, phi);
    stream.point(pi2, phi);
    stream.point(pi2, 0);
    stream.point(pi2, -phi);
    stream.point(0, -phi);
    stream.point(-pi2, -phi);
    stream.point(-pi2, 0);
    stream.point(-pi2, phi);
  } else if (abs2(from[0] - to[0]) > epsilon3) {
    var lambda = from[0] < to[0] ? pi2 : -pi2;
    phi = direction * lambda / 2;
    stream.point(-lambda, phi);
    stream.point(0, phi);
    stream.point(lambda, phi);
  } else {
    stream.point(to[0], to[1]);
  }
}

// ../../node_modules/d3/node_modules/d3-geo/src/clip/circle.js
function circle_default(radius2) {
  var cr = cos(radius2), delta = 2 * radians2, smallRadius = cr > 0, notHemisphere = abs2(cr) > epsilon3;
  function interpolate(from, to, direction, stream) {
    circleStream(stream, radius2, delta, direction, from, to);
  }
  function visible(lambda, phi) {
    return cos(lambda) * cos(phi) > cr;
  }
  function clipLine(stream) {
    var point0, c0, v0, v00, clean;
    return {
      lineStart: function() {
        v00 = v0 = false;
        clean = 1;
      },
      point: function(lambda, phi) {
        var point1 = [lambda, phi], point22, v2 = visible(lambda, phi), c5 = smallRadius ? v2 ? 0 : code(lambda, phi) : v2 ? code(lambda + (lambda < 0 ? pi2 : -pi2), phi) : 0;
        if (!point0 && (v00 = v0 = v2))
          stream.lineStart();
        if (v2 !== v0) {
          point22 = intersect(point0, point1);
          if (!point22 || pointEqual_default(point0, point22) || pointEqual_default(point1, point22))
            point1[2] = 1;
        }
        if (v2 !== v0) {
          clean = 0;
          if (v2) {
            stream.lineStart();
            point22 = intersect(point1, point0);
            stream.point(point22[0], point22[1]);
          } else {
            point22 = intersect(point0, point1);
            stream.point(point22[0], point22[1], 2);
            stream.lineEnd();
          }
          point0 = point22;
        } else if (notHemisphere && point0 && smallRadius ^ v2) {
          var t5;
          if (!(c5 & c0) && (t5 = intersect(point1, point0, true))) {
            clean = 0;
            if (smallRadius) {
              stream.lineStart();
              stream.point(t5[0][0], t5[0][1]);
              stream.point(t5[1][0], t5[1][1]);
              stream.lineEnd();
            } else {
              stream.point(t5[1][0], t5[1][1]);
              stream.lineEnd();
              stream.lineStart();
              stream.point(t5[0][0], t5[0][1], 3);
            }
          }
        }
        if (v2 && (!point0 || !pointEqual_default(point0, point1))) {
          stream.point(point1[0], point1[1]);
        }
        point0 = point1, v0 = v2, c0 = c5;
      },
      lineEnd: function() {
        if (v0)
          stream.lineEnd();
        point0 = null;
      },
      // Rejoin first and last segments if there were intersections and the first
      // and last points were visible.
      clean: function() {
        return clean | (v00 && v0) << 1;
      }
    };
  }
  function intersect(a3, b2, two) {
    var pa = cartesian(a3), pb = cartesian(b2);
    var n1 = [1, 0, 0], n2 = cartesianCross(pa, pb), n2n2 = cartesianDot(n2, n2), n1n2 = n2[0], determinant = n2n2 - n1n2 * n1n2;
    if (!determinant)
      return !two && a3;
    var c1 = cr * n2n2 / determinant, c22 = -cr * n1n2 / determinant, n1xn2 = cartesianCross(n1, n2), A6 = cartesianScale(n1, c1), B3 = cartesianScale(n2, c22);
    cartesianAddInPlace(A6, B3);
    var u2 = n1xn2, w2 = cartesianDot(A6, u2), uu = cartesianDot(u2, u2), t22 = w2 * w2 - uu * (cartesianDot(A6, A6) - 1);
    if (t22 < 0)
      return;
    var t5 = sqrt(t22), q2 = cartesianScale(u2, (-w2 - t5) / uu);
    cartesianAddInPlace(q2, A6);
    q2 = spherical(q2);
    if (!two)
      return q2;
    var lambda0 = a3[0], lambda1 = b2[0], phi0 = a3[1], phi1 = b2[1], z2;
    if (lambda1 < lambda0)
      z2 = lambda0, lambda0 = lambda1, lambda1 = z2;
    var delta2 = lambda1 - lambda0, polar = abs2(delta2 - pi2) < epsilon3, meridian = polar || delta2 < epsilon3;
    if (!polar && phi1 < phi0)
      z2 = phi0, phi0 = phi1, phi1 = z2;
    if (meridian ? polar ? phi0 + phi1 > 0 ^ q2[1] < (abs2(q2[0] - lambda0) < epsilon3 ? phi0 : phi1) : phi0 <= q2[1] && q2[1] <= phi1 : delta2 > pi2 ^ (lambda0 <= q2[0] && q2[0] <= lambda1)) {
      var q1 = cartesianScale(u2, (-w2 + t5) / uu);
      cartesianAddInPlace(q1, A6);
      return [q2, spherical(q1)];
    }
  }
  function code(lambda, phi) {
    var r2 = smallRadius ? radius2 : pi2 - radius2, code2 = 0;
    if (lambda < -r2)
      code2 |= 1;
    else if (lambda > r2)
      code2 |= 2;
    if (phi < -r2)
      code2 |= 4;
    else if (phi > r2)
      code2 |= 8;
    return code2;
  }
  return clip_default(visible, clipLine, interpolate, smallRadius ? [0, -radius2] : [-pi2, radius2 - pi2]);
}

// ../../node_modules/d3/node_modules/d3-geo/src/clip/line.js
function line_default(a3, b2, x05, y05, x12, y12) {
  var ax = a3[0], ay = a3[1], bx = b2[0], by = b2[1], t03 = 0, t13 = 1, dx = bx - ax, dy = by - ay, r2;
  r2 = x05 - ax;
  if (!dx && r2 > 0)
    return;
  r2 /= dx;
  if (dx < 0) {
    if (r2 < t03)
      return;
    if (r2 < t13)
      t13 = r2;
  } else if (dx > 0) {
    if (r2 > t13)
      return;
    if (r2 > t03)
      t03 = r2;
  }
  r2 = x12 - ax;
  if (!dx && r2 < 0)
    return;
  r2 /= dx;
  if (dx < 0) {
    if (r2 > t13)
      return;
    if (r2 > t03)
      t03 = r2;
  } else if (dx > 0) {
    if (r2 < t03)
      return;
    if (r2 < t13)
      t13 = r2;
  }
  r2 = y05 - ay;
  if (!dy && r2 > 0)
    return;
  r2 /= dy;
  if (dy < 0) {
    if (r2 < t03)
      return;
    if (r2 < t13)
      t13 = r2;
  } else if (dy > 0) {
    if (r2 > t13)
      return;
    if (r2 > t03)
      t03 = r2;
  }
  r2 = y12 - ay;
  if (!dy && r2 < 0)
    return;
  r2 /= dy;
  if (dy < 0) {
    if (r2 > t13)
      return;
    if (r2 > t03)
      t03 = r2;
  } else if (dy > 0) {
    if (r2 < t03)
      return;
    if (r2 < t13)
      t13 = r2;
  }
  if (t03 > 0)
    a3[0] = ax + t03 * dx, a3[1] = ay + t03 * dy;
  if (t13 < 1)
    b2[0] = ax + t13 * dx, b2[1] = ay + t13 * dy;
  return true;
}

// ../../node_modules/d3/node_modules/d3-geo/src/clip/rectangle.js
var clipMax = 1e9;
var clipMin = -clipMax;
function clipRectangle(x05, y05, x12, y12) {
  function visible(x3, y3) {
    return x05 <= x3 && x3 <= x12 && y05 <= y3 && y3 <= y12;
  }
  function interpolate(from, to, direction, stream) {
    var a3 = 0, a1 = 0;
    if (from == null || (a3 = corner(from, direction)) !== (a1 = corner(to, direction)) || comparePoint(from, to) < 0 ^ direction > 0) {
      do
        stream.point(a3 === 0 || a3 === 3 ? x05 : x12, a3 > 1 ? y12 : y05);
      while ((a3 = (a3 + direction + 4) % 4) !== a1);
    } else {
      stream.point(to[0], to[1]);
    }
  }
  function corner(p2, direction) {
    return abs2(p2[0] - x05) < epsilon3 ? direction > 0 ? 0 : 3 : abs2(p2[0] - x12) < epsilon3 ? direction > 0 ? 2 : 1 : abs2(p2[1] - y05) < epsilon3 ? direction > 0 ? 1 : 0 : direction > 0 ? 3 : 2;
  }
  function compareIntersection2(a3, b2) {
    return comparePoint(a3.x, b2.x);
  }
  function comparePoint(a3, b2) {
    var ca = corner(a3, 1), cb = corner(b2, 1);
    return ca !== cb ? ca - cb : ca === 0 ? b2[1] - a3[1] : ca === 1 ? a3[0] - b2[0] : ca === 2 ? a3[1] - b2[1] : b2[0] - a3[0];
  }
  return function(stream) {
    var activeStream = stream, bufferStream = buffer_default(), segments, polygon, ring, x__, y__, v__, x_, y_, v_, first2, clean;
    var clipStream = {
      point: point6,
      lineStart,
      lineEnd,
      polygonStart,
      polygonEnd
    };
    function point6(x3, y3) {
      if (visible(x3, y3))
        activeStream.point(x3, y3);
    }
    function polygonInside() {
      var winding = 0;
      for (var i2 = 0, n2 = polygon.length; i2 < n2; ++i2) {
        for (var ring2 = polygon[i2], j2 = 1, m = ring2.length, point7 = ring2[0], a0, a1, b0 = point7[0], b1 = point7[1]; j2 < m; ++j2) {
          a0 = b0, a1 = b1, point7 = ring2[j2], b0 = point7[0], b1 = point7[1];
          if (a1 <= y12) {
            if (b1 > y12 && (b0 - a0) * (y12 - a1) > (b1 - a1) * (x05 - a0))
              ++winding;
          } else {
            if (b1 <= y12 && (b0 - a0) * (y12 - a1) < (b1 - a1) * (x05 - a0))
              --winding;
          }
        }
      }
      return winding;
    }
    function polygonStart() {
      activeStream = bufferStream, segments = [], polygon = [], clean = true;
    }
    function polygonEnd() {
      var startInside = polygonInside(), cleanInside = clean && startInside, visible2 = (segments = merge(segments)).length;
      if (cleanInside || visible2) {
        stream.polygonStart();
        if (cleanInside) {
          stream.lineStart();
          interpolate(null, null, 1, stream);
          stream.lineEnd();
        }
        if (visible2) {
          rejoin_default(segments, compareIntersection2, startInside, interpolate, stream);
        }
        stream.polygonEnd();
      }
      activeStream = stream, segments = polygon = ring = null;
    }
    function lineStart() {
      clipStream.point = linePoint;
      if (polygon)
        polygon.push(ring = []);
      first2 = true;
      v_ = false;
      x_ = y_ = NaN;
    }
    function lineEnd() {
      if (segments) {
        linePoint(x__, y__);
        if (v__ && v_)
          bufferStream.rejoin();
        segments.push(bufferStream.result());
      }
      clipStream.point = point6;
      if (v_)
        activeStream.lineEnd();
    }
    function linePoint(x3, y3) {
      var v2 = visible(x3, y3);
      if (polygon)
        ring.push([x3, y3]);
      if (first2) {
        x__ = x3, y__ = y3, v__ = v2;
        first2 = false;
        if (v2) {
          activeStream.lineStart();
          activeStream.point(x3, y3);
        }
      } else {
        if (v2 && v_)
          activeStream.point(x3, y3);
        else {
          var a3 = [x_ = Math.max(clipMin, Math.min(clipMax, x_)), y_ = Math.max(clipMin, Math.min(clipMax, y_))], b2 = [x3 = Math.max(clipMin, Math.min(clipMax, x3)), y3 = Math.max(clipMin, Math.min(clipMax, y3))];
          if (line_default(a3, b2, x05, y05, x12, y12)) {
            if (!v_) {
              activeStream.lineStart();
              activeStream.point(a3[0], a3[1]);
            }
            activeStream.point(b2[0], b2[1]);
            if (!v2)
              activeStream.lineEnd();
            clean = false;
          } else if (v2) {
            activeStream.lineStart();
            activeStream.point(x3, y3);
            clean = false;
          }
        }
      }
      x_ = x3, y_ = y3, v_ = v2;
    }
    return clipStream;
  };
}

// ../../node_modules/d3/node_modules/d3-geo/src/identity.js
var identity_default3 = (x3) => x3;

// ../../node_modules/d3/node_modules/d3-geo/src/path/area.js
var areaSum = new Adder();
var areaRingSum = new Adder();
var x00;
var y00;
var x0;
var y0;
var areaStream = {
  point: noop2,
  lineStart: noop2,
  lineEnd: noop2,
  polygonStart: function() {
    areaStream.lineStart = areaRingStart;
    areaStream.lineEnd = areaRingEnd;
  },
  polygonEnd: function() {
    areaStream.lineStart = areaStream.lineEnd = areaStream.point = noop2;
    areaSum.add(abs2(areaRingSum));
    areaRingSum = new Adder();
  },
  result: function() {
    var area2 = areaSum / 2;
    areaSum = new Adder();
    return area2;
  }
};
function areaRingStart() {
  areaStream.point = areaPointFirst;
}
function areaPointFirst(x3, y3) {
  areaStream.point = areaPoint;
  x00 = x0 = x3, y00 = y0 = y3;
}
function areaPoint(x3, y3) {
  areaRingSum.add(y0 * x3 - x0 * y3);
  x0 = x3, y0 = y3;
}
function areaRingEnd() {
  areaPoint(x00, y00);
}
var area_default = areaStream;

// ../../node_modules/d3/node_modules/d3-geo/src/path/bounds.js
var x02 = Infinity;
var y02 = x02;
var x1 = -x02;
var y1 = x1;
var boundsStream = {
  point: boundsPoint,
  lineStart: noop2,
  lineEnd: noop2,
  polygonStart: noop2,
  polygonEnd: noop2,
  result: function() {
    var bounds = [[x02, y02], [x1, y1]];
    x1 = y1 = -(y02 = x02 = Infinity);
    return bounds;
  }
};
function boundsPoint(x3, y3) {
  if (x3 < x02)
    x02 = x3;
  if (x3 > x1)
    x1 = x3;
  if (y3 < y02)
    y02 = y3;
  if (y3 > y1)
    y1 = y3;
}
var bounds_default = boundsStream;

// ../../node_modules/d3/node_modules/d3-geo/src/path/centroid.js
var X0 = 0;
var Y0 = 0;
var Z0 = 0;
var X1 = 0;
var Y1 = 0;
var Z1 = 0;
var X2 = 0;
var Y2 = 0;
var Z2 = 0;
var x002;
var y002;
var x03;
var y03;
var centroidStream = {
  point: centroidPoint,
  lineStart: centroidLineStart,
  lineEnd: centroidLineEnd,
  polygonStart: function() {
    centroidStream.lineStart = centroidRingStart;
    centroidStream.lineEnd = centroidRingEnd;
  },
  polygonEnd: function() {
    centroidStream.point = centroidPoint;
    centroidStream.lineStart = centroidLineStart;
    centroidStream.lineEnd = centroidLineEnd;
  },
  result: function() {
    var centroid = Z2 ? [X2 / Z2, Y2 / Z2] : Z1 ? [X1 / Z1, Y1 / Z1] : Z0 ? [X0 / Z0, Y0 / Z0] : [NaN, NaN];
    X0 = Y0 = Z0 = X1 = Y1 = Z1 = X2 = Y2 = Z2 = 0;
    return centroid;
  }
};
function centroidPoint(x3, y3) {
  X0 += x3;
  Y0 += y3;
  ++Z0;
}
function centroidLineStart() {
  centroidStream.point = centroidPointFirstLine;
}
function centroidPointFirstLine(x3, y3) {
  centroidStream.point = centroidPointLine;
  centroidPoint(x03 = x3, y03 = y3);
}
function centroidPointLine(x3, y3) {
  var dx = x3 - x03, dy = y3 - y03, z2 = sqrt(dx * dx + dy * dy);
  X1 += z2 * (x03 + x3) / 2;
  Y1 += z2 * (y03 + y3) / 2;
  Z1 += z2;
  centroidPoint(x03 = x3, y03 = y3);
}
function centroidLineEnd() {
  centroidStream.point = centroidPoint;
}
function centroidRingStart() {
  centroidStream.point = centroidPointFirstRing;
}
function centroidRingEnd() {
  centroidPointRing(x002, y002);
}
function centroidPointFirstRing(x3, y3) {
  centroidStream.point = centroidPointRing;
  centroidPoint(x002 = x03 = x3, y002 = y03 = y3);
}
function centroidPointRing(x3, y3) {
  var dx = x3 - x03, dy = y3 - y03, z2 = sqrt(dx * dx + dy * dy);
  X1 += z2 * (x03 + x3) / 2;
  Y1 += z2 * (y03 + y3) / 2;
  Z1 += z2;
  z2 = y03 * x3 - x03 * y3;
  X2 += z2 * (x03 + x3);
  Y2 += z2 * (y03 + y3);
  Z2 += z2 * 3;
  centroidPoint(x03 = x3, y03 = y3);
}
var centroid_default = centroidStream;

// ../../node_modules/d3/node_modules/d3-geo/src/path/context.js
function PathContext(context) {
  this._context = context;
}
PathContext.prototype = {
  _radius: 4.5,
  pointRadius: function(_24) {
    return this._radius = _24, this;
  },
  polygonStart: function() {
    this._line = 0;
  },
  polygonEnd: function() {
    this._line = NaN;
  },
  lineStart: function() {
    this._point = 0;
  },
  lineEnd: function() {
    if (this._line === 0)
      this._context.closePath();
    this._point = NaN;
  },
  point: function(x3, y3) {
    switch (this._point) {
      case 0: {
        this._context.moveTo(x3, y3);
        this._point = 1;
        break;
      }
      case 1: {
        this._context.lineTo(x3, y3);
        break;
      }
      default: {
        this._context.moveTo(x3 + this._radius, y3);
        this._context.arc(x3, y3, this._radius, 0, tau2);
        break;
      }
    }
  },
  result: noop2
};

// ../../node_modules/d3/node_modules/d3-geo/src/path/measure.js
var lengthSum = new Adder();
var lengthRing;
var x003;
var y003;
var x04;
var y04;
var lengthStream = {
  point: noop2,
  lineStart: function() {
    lengthStream.point = lengthPointFirst;
  },
  lineEnd: function() {
    if (lengthRing)
      lengthPoint(x003, y003);
    lengthStream.point = noop2;
  },
  polygonStart: function() {
    lengthRing = true;
  },
  polygonEnd: function() {
    lengthRing = null;
  },
  result: function() {
    var length3 = +lengthSum;
    lengthSum = new Adder();
    return length3;
  }
};
function lengthPointFirst(x3, y3) {
  lengthStream.point = lengthPoint;
  x003 = x04 = x3, y003 = y04 = y3;
}
function lengthPoint(x3, y3) {
  x04 -= x3, y04 -= y3;
  lengthSum.add(sqrt(x04 * x04 + y04 * y04));
  x04 = x3, y04 = y3;
}
var measure_default = lengthStream;

// ../../node_modules/d3/node_modules/d3-geo/src/path/string.js
var cacheDigits;
var cacheAppend;
var cacheRadius;
var cacheCircle;
var PathString = class {
  constructor(digits) {
    this._append = digits == null ? append2 : appendRound2(digits);
    this._radius = 4.5;
    this._ = "";
  }
  pointRadius(_24) {
    this._radius = +_24;
    return this;
  }
  polygonStart() {
    this._line = 0;
  }
  polygonEnd() {
    this._line = NaN;
  }
  lineStart() {
    this._point = 0;
  }
  lineEnd() {
    if (this._line === 0)
      this._ += "Z";
    this._point = NaN;
  }
  point(x3, y3) {
    switch (this._point) {
      case 0: {
        this._append`M${x3},${y3}`;
        this._point = 1;
        break;
      }
      case 1: {
        this._append`L${x3},${y3}`;
        break;
      }
      default: {
        this._append`M${x3},${y3}`;
        if (this._radius !== cacheRadius || this._append !== cacheAppend) {
          const r2 = this._radius;
          const s3 = this._;
          this._ = "";
          this._append`m0,${r2}a${r2},${r2} 0 1,1 0,${-2 * r2}a${r2},${r2} 0 1,1 0,${2 * r2}z`;
          cacheRadius = r2;
          cacheAppend = this._append;
          cacheCircle = this._;
          this._ = s3;
        }
        this._ += cacheCircle;
        break;
      }
    }
  }
  result() {
    const result = this._;
    this._ = "";
    return result.length ? result : null;
  }
};
function append2(strings) {
  let i2 = 1;
  this._ += strings[0];
  for (const j2 = strings.length; i2 < j2; ++i2) {
    this._ += arguments[i2] + strings[i2];
  }
}
function appendRound2(digits) {
  const d2 = Math.floor(digits);
  if (!(d2 >= 0))
    throw new RangeError(`invalid digits: ${digits}`);
  if (d2 > 15)
    return append2;
  if (d2 !== cacheDigits) {
    const k3 = 10 ** d2;
    cacheDigits = d2;
    cacheAppend = function append3(strings) {
      let i2 = 1;
      this._ += strings[0];
      for (const j2 = strings.length; i2 < j2; ++i2) {
        this._ += Math.round(arguments[i2] * k3) / k3 + strings[i2];
      }
    };
  }
  return cacheAppend;
}

// ../../node_modules/d3/node_modules/d3-geo/src/path/index.js
function path_default(projection3, context) {
  let digits = 3, pointRadius = 4.5, projectionStream, contextStream;
  function path2(object) {
    if (object) {
      if (typeof pointRadius === "function")
        contextStream.pointRadius(+pointRadius.apply(this, arguments));
      stream_default(object, projectionStream(contextStream));
    }
    return contextStream.result();
  }
  path2.area = function(object) {
    stream_default(object, projectionStream(area_default));
    return area_default.result();
  };
  path2.measure = function(object) {
    stream_default(object, projectionStream(measure_default));
    return measure_default.result();
  };
  path2.bounds = function(object) {
    stream_default(object, projectionStream(bounds_default));
    return bounds_default.result();
  };
  path2.centroid = function(object) {
    stream_default(object, projectionStream(centroid_default));
    return centroid_default.result();
  };
  path2.projection = function(_24) {
    if (!arguments.length)
      return projection3;
    projectionStream = _24 == null ? (projection3 = null, identity_default3) : (projection3 = _24).stream;
    return path2;
  };
  path2.context = function(_24) {
    if (!arguments.length)
      return context;
    contextStream = _24 == null ? (context = null, new PathString(digits)) : new PathContext(context = _24);
    if (typeof pointRadius !== "function")
      contextStream.pointRadius(pointRadius);
    return path2;
  };
  path2.pointRadius = function(_24) {
    if (!arguments.length)
      return pointRadius;
    pointRadius = typeof _24 === "function" ? _24 : (contextStream.pointRadius(+_24), +_24);
    return path2;
  };
  path2.digits = function(_24) {
    if (!arguments.length)
      return digits;
    if (_24 == null)
      digits = null;
    else {
      const d2 = Math.floor(_24);
      if (!(d2 >= 0))
        throw new RangeError(`invalid digits: ${_24}`);
      digits = d2;
    }
    if (context === null)
      contextStream = new PathString(digits);
    return path2;
  };
  return path2.projection(projection3).digits(digits).context(context);
}

// ../../node_modules/d3/node_modules/d3-geo/src/transform.js
function transform_default(methods) {
  return {
    stream: transformer(methods)
  };
}
function transformer(methods) {
  return function(stream) {
    var s3 = new TransformStream();
    for (var key in methods)
      s3[key] = methods[key];
    s3.stream = stream;
    return s3;
  };
}
function TransformStream() {
}
TransformStream.prototype = {
  constructor: TransformStream,
  point: function(x3, y3) {
    this.stream.point(x3, y3);
  },
  sphere: function() {
    this.stream.sphere();
  },
  lineStart: function() {
    this.stream.lineStart();
  },
  lineEnd: function() {
    this.stream.lineEnd();
  },
  polygonStart: function() {
    this.stream.polygonStart();
  },
  polygonEnd: function() {
    this.stream.polygonEnd();
  }
};

// ../../node_modules/d3/node_modules/d3-geo/src/projection/fit.js
function fit(projection3, fitBounds, object) {
  var clip = projection3.clipExtent && projection3.clipExtent();
  projection3.scale(150).translate([0, 0]);
  if (clip != null)
    projection3.clipExtent(null);
  stream_default(object, projection3.stream(bounds_default));
  fitBounds(bounds_default.result());
  if (clip != null)
    projection3.clipExtent(clip);
  return projection3;
}
function fitExtent(projection3, extent3, object) {
  return fit(projection3, function(b2) {
    var w2 = extent3[1][0] - extent3[0][0], h2 = extent3[1][1] - extent3[0][1], k3 = Math.min(w2 / (b2[1][0] - b2[0][0]), h2 / (b2[1][1] - b2[0][1])), x3 = +extent3[0][0] + (w2 - k3 * (b2[1][0] + b2[0][0])) / 2, y3 = +extent3[0][1] + (h2 - k3 * (b2[1][1] + b2[0][1])) / 2;
    projection3.scale(150 * k3).translate([x3, y3]);
  }, object);
}
function fitSize(projection3, size, object) {
  return fitExtent(projection3, [[0, 0], size], object);
}
function fitWidth(projection3, width, object) {
  return fit(projection3, function(b2) {
    var w2 = +width, k3 = w2 / (b2[1][0] - b2[0][0]), x3 = (w2 - k3 * (b2[1][0] + b2[0][0])) / 2, y3 = -k3 * b2[0][1];
    projection3.scale(150 * k3).translate([x3, y3]);
  }, object);
}
function fitHeight(projection3, height, object) {
  return fit(projection3, function(b2) {
    var h2 = +height, k3 = h2 / (b2[1][1] - b2[0][1]), x3 = -k3 * b2[0][0], y3 = (h2 - k3 * (b2[1][1] + b2[0][1])) / 2;
    projection3.scale(150 * k3).translate([x3, y3]);
  }, object);
}

// ../../node_modules/d3/node_modules/d3-geo/src/projection/resample.js
var maxDepth = 16;
var cosMinDistance = cos(30 * radians2);
function resample_default(project2, delta2) {
  return +delta2 ? resample(project2, delta2) : resampleNone(project2);
}
function resampleNone(project2) {
  return transformer({
    point: function(x3, y3) {
      x3 = project2(x3, y3);
      this.stream.point(x3[0], x3[1]);
    }
  });
}
function resample(project2, delta2) {
  function resampleLineTo(x05, y05, lambda0, a0, b0, c0, x12, y12, lambda1, a1, b1, c1, depth, stream) {
    var dx = x12 - x05, dy = y12 - y05, d2 = dx * dx + dy * dy;
    if (d2 > 4 * delta2 && depth--) {
      var a3 = a0 + a1, b2 = b0 + b1, c5 = c0 + c1, m = sqrt(a3 * a3 + b2 * b2 + c5 * c5), phi2 = asin(c5 /= m), lambda2 = abs2(abs2(c5) - 1) < epsilon3 || abs2(lambda0 - lambda1) < epsilon3 ? (lambda0 + lambda1) / 2 : atan2(b2, a3), p2 = project2(lambda2, phi2), x22 = p2[0], y22 = p2[1], dx2 = x22 - x05, dy2 = y22 - y05, dz = dy * dx2 - dx * dy2;
      if (dz * dz / d2 > delta2 || abs2((dx * dx2 + dy * dy2) / d2 - 0.5) > 0.3 || a0 * a1 + b0 * b1 + c0 * c1 < cosMinDistance) {
        resampleLineTo(x05, y05, lambda0, a0, b0, c0, x22, y22, lambda2, a3 /= m, b2 /= m, c5, depth, stream);
        stream.point(x22, y22);
        resampleLineTo(x22, y22, lambda2, a3, b2, c5, x12, y12, lambda1, a1, b1, c1, depth, stream);
      }
    }
  }
  return function(stream) {
    var lambda00, x004, y004, a00, b00, c00, lambda0, x05, y05, a0, b0, c0;
    var resampleStream = {
      point: point6,
      lineStart,
      lineEnd,
      polygonStart: function() {
        stream.polygonStart();
        resampleStream.lineStart = ringStart;
      },
      polygonEnd: function() {
        stream.polygonEnd();
        resampleStream.lineStart = lineStart;
      }
    };
    function point6(x3, y3) {
      x3 = project2(x3, y3);
      stream.point(x3[0], x3[1]);
    }
    function lineStart() {
      x05 = NaN;
      resampleStream.point = linePoint;
      stream.lineStart();
    }
    function linePoint(lambda, phi) {
      var c5 = cartesian([lambda, phi]), p2 = project2(lambda, phi);
      resampleLineTo(x05, y05, lambda0, a0, b0, c0, x05 = p2[0], y05 = p2[1], lambda0 = lambda, a0 = c5[0], b0 = c5[1], c0 = c5[2], maxDepth, stream);
      stream.point(x05, y05);
    }
    function lineEnd() {
      resampleStream.point = point6;
      stream.lineEnd();
    }
    function ringStart() {
      lineStart();
      resampleStream.point = ringPoint;
      resampleStream.lineEnd = ringEnd;
    }
    function ringPoint(lambda, phi) {
      linePoint(lambda00 = lambda, phi), x004 = x05, y004 = y05, a00 = a0, b00 = b0, c00 = c0;
      resampleStream.point = linePoint;
    }
    function ringEnd() {
      resampleLineTo(x05, y05, lambda0, a0, b0, c0, x004, y004, lambda00, a00, b00, c00, maxDepth, stream);
      resampleStream.lineEnd = lineEnd;
      lineEnd();
    }
    return resampleStream;
  };
}

// ../../node_modules/d3/node_modules/d3-geo/src/projection/index.js
var transformRadians = transformer({
  point: function(x3, y3) {
    this.stream.point(x3 * radians2, y3 * radians2);
  }
});
function transformRotate(rotate) {
  return transformer({
    point: function(x3, y3) {
      var r2 = rotate(x3, y3);
      return this.stream.point(r2[0], r2[1]);
    }
  });
}
function scaleTranslate(k3, dx, dy, sx, sy) {
  function transform2(x3, y3) {
    x3 *= sx;
    y3 *= sy;
    return [dx + k3 * x3, dy - k3 * y3];
  }
  transform2.invert = function(x3, y3) {
    return [(x3 - dx) / k3 * sx, (dy - y3) / k3 * sy];
  };
  return transform2;
}
function scaleTranslateRotate(k3, dx, dy, sx, sy, alpha) {
  if (!alpha)
    return scaleTranslate(k3, dx, dy, sx, sy);
  var cosAlpha = cos(alpha), sinAlpha = sin(alpha), a3 = cosAlpha * k3, b2 = sinAlpha * k3, ai = cosAlpha / k3, bi = sinAlpha / k3, ci = (sinAlpha * dy - cosAlpha * dx) / k3, fi = (sinAlpha * dx + cosAlpha * dy) / k3;
  function transform2(x3, y3) {
    x3 *= sx;
    y3 *= sy;
    return [a3 * x3 - b2 * y3 + dx, dy - b2 * x3 - a3 * y3];
  }
  transform2.invert = function(x3, y3) {
    return [sx * (ai * x3 - bi * y3 + ci), sy * (fi - bi * x3 - ai * y3)];
  };
  return transform2;
}
function projection(project2) {
  return projectionMutator(function() {
    return project2;
  })();
}
function projectionMutator(projectAt) {
  var project2, k3 = 150, x3 = 480, y3 = 250, lambda = 0, phi = 0, deltaLambda = 0, deltaPhi = 0, deltaGamma = 0, rotate, alpha = 0, sx = 1, sy = 1, theta = null, preclip = antimeridian_default, x05 = null, y05, x12, y12, postclip = identity_default3, delta2 = 0.5, projectResample, projectTransform, projectRotateTransform, cache, cacheStream;
  function projection3(point6) {
    return projectRotateTransform(point6[0] * radians2, point6[1] * radians2);
  }
  function invert(point6) {
    point6 = projectRotateTransform.invert(point6[0], point6[1]);
    return point6 && [point6[0] * degrees3, point6[1] * degrees3];
  }
  projection3.stream = function(stream) {
    return cache && cacheStream === stream ? cache : cache = transformRadians(transformRotate(rotate)(preclip(projectResample(postclip(cacheStream = stream)))));
  };
  projection3.preclip = function(_24) {
    return arguments.length ? (preclip = _24, theta = void 0, reset()) : preclip;
  };
  projection3.postclip = function(_24) {
    return arguments.length ? (postclip = _24, x05 = y05 = x12 = y12 = null, reset()) : postclip;
  };
  projection3.clipAngle = function(_24) {
    return arguments.length ? (preclip = +_24 ? circle_default(theta = _24 * radians2) : (theta = null, antimeridian_default), reset()) : theta * degrees3;
  };
  projection3.clipExtent = function(_24) {
    return arguments.length ? (postclip = _24 == null ? (x05 = y05 = x12 = y12 = null, identity_default3) : clipRectangle(x05 = +_24[0][0], y05 = +_24[0][1], x12 = +_24[1][0], y12 = +_24[1][1]), reset()) : x05 == null ? null : [[x05, y05], [x12, y12]];
  };
  projection3.scale = function(_24) {
    return arguments.length ? (k3 = +_24, recenter()) : k3;
  };
  projection3.translate = function(_24) {
    return arguments.length ? (x3 = +_24[0], y3 = +_24[1], recenter()) : [x3, y3];
  };
  projection3.center = function(_24) {
    return arguments.length ? (lambda = _24[0] % 360 * radians2, phi = _24[1] % 360 * radians2, recenter()) : [lambda * degrees3, phi * degrees3];
  };
  projection3.rotate = function(_24) {
    return arguments.length ? (deltaLambda = _24[0] % 360 * radians2, deltaPhi = _24[1] % 360 * radians2, deltaGamma = _24.length > 2 ? _24[2] % 360 * radians2 : 0, recenter()) : [deltaLambda * degrees3, deltaPhi * degrees3, deltaGamma * degrees3];
  };
  projection3.angle = function(_24) {
    return arguments.length ? (alpha = _24 % 360 * radians2, recenter()) : alpha * degrees3;
  };
  projection3.reflectX = function(_24) {
    return arguments.length ? (sx = _24 ? -1 : 1, recenter()) : sx < 0;
  };
  projection3.reflectY = function(_24) {
    return arguments.length ? (sy = _24 ? -1 : 1, recenter()) : sy < 0;
  };
  projection3.precision = function(_24) {
    return arguments.length ? (projectResample = resample_default(projectTransform, delta2 = _24 * _24), reset()) : sqrt(delta2);
  };
  projection3.fitExtent = function(extent3, object) {
    return fitExtent(projection3, extent3, object);
  };
  projection3.fitSize = function(size, object) {
    return fitSize(projection3, size, object);
  };
  projection3.fitWidth = function(width, object) {
    return fitWidth(projection3, width, object);
  };
  projection3.fitHeight = function(height, object) {
    return fitHeight(projection3, height, object);
  };
  function recenter() {
    var center2 = scaleTranslateRotate(k3, 0, 0, sx, sy, alpha).apply(null, project2(lambda, phi)), transform2 = scaleTranslateRotate(k3, x3 - center2[0], y3 - center2[1], sx, sy, alpha);
    rotate = rotateRadians(deltaLambda, deltaPhi, deltaGamma);
    projectTransform = compose_default(project2, transform2);
    projectRotateTransform = compose_default(rotate, projectTransform);
    projectResample = resample_default(projectTransform, delta2);
    return reset();
  }
  function reset() {
    cache = cacheStream = null;
    return projection3;
  }
  return function() {
    project2 = projectAt.apply(this, arguments);
    projection3.invert = project2.invert && invert;
    return recenter();
  };
}

// ../../node_modules/d3/node_modules/d3-geo/src/projection/conic.js
function conicProjection(projectAt) {
  var phi0 = 0, phi1 = pi2 / 3, m = projectionMutator(projectAt), p2 = m(phi0, phi1);
  p2.parallels = function(_24) {
    return arguments.length ? m(phi0 = _24[0] * radians2, phi1 = _24[1] * radians2) : [phi0 * degrees3, phi1 * degrees3];
  };
  return p2;
}

// ../../node_modules/d3/node_modules/d3-geo/src/projection/cylindricalEqualArea.js
function cylindricalEqualAreaRaw(phi0) {
  var cosPhi0 = cos(phi0);
  function forward(lambda, phi) {
    return [lambda * cosPhi0, sin(phi) / cosPhi0];
  }
  forward.invert = function(x3, y3) {
    return [x3 / cosPhi0, asin(y3 * cosPhi0)];
  };
  return forward;
}

// ../../node_modules/d3/node_modules/d3-geo/src/projection/conicEqualArea.js
function conicEqualAreaRaw(y05, y12) {
  var sy0 = sin(y05), n2 = (sy0 + sin(y12)) / 2;
  if (abs2(n2) < epsilon3)
    return cylindricalEqualAreaRaw(y05);
  var c5 = 1 + sy0 * (2 * n2 - sy0), r0 = sqrt(c5) / n2;
  function project2(x3, y3) {
    var r2 = sqrt(c5 - 2 * n2 * sin(y3)) / n2;
    return [r2 * sin(x3 *= n2), r0 - r2 * cos(x3)];
  }
  project2.invert = function(x3, y3) {
    var r0y = r0 - y3, l2 = atan2(x3, abs2(r0y)) * sign(r0y);
    if (r0y * n2 < 0)
      l2 -= pi2 * sign(x3) * sign(r0y);
    return [l2 / n2, asin((c5 - (x3 * x3 + r0y * r0y) * n2 * n2) / (2 * n2))];
  };
  return project2;
}
function conicEqualArea_default() {
  return conicProjection(conicEqualAreaRaw).scale(155.424).center([0, 33.6442]);
}

// ../../node_modules/d3/node_modules/d3-geo/src/projection/albers.js
function albers_default() {
  return conicEqualArea_default().parallels([29.5, 45.5]).scale(1070).translate([480, 250]).rotate([96, 0]).center([-0.6, 38.7]);
}

// ../../node_modules/d3/node_modules/d3-geo/src/projection/albersUsa.js
function multiplex(streams) {
  var n2 = streams.length;
  return {
    point: function(x3, y3) {
      var i2 = -1;
      while (++i2 < n2)
        streams[i2].point(x3, y3);
    },
    sphere: function() {
      var i2 = -1;
      while (++i2 < n2)
        streams[i2].sphere();
    },
    lineStart: function() {
      var i2 = -1;
      while (++i2 < n2)
        streams[i2].lineStart();
    },
    lineEnd: function() {
      var i2 = -1;
      while (++i2 < n2)
        streams[i2].lineEnd();
    },
    polygonStart: function() {
      var i2 = -1;
      while (++i2 < n2)
        streams[i2].polygonStart();
    },
    polygonEnd: function() {
      var i2 = -1;
      while (++i2 < n2)
        streams[i2].polygonEnd();
    }
  };
}
function albersUsa_default() {
  var cache, cacheStream, lower48 = albers_default(), lower48Point, alaska = conicEqualArea_default().rotate([154, 0]).center([-2, 58.5]).parallels([55, 65]), alaskaPoint, hawaii = conicEqualArea_default().rotate([157, 0]).center([-3, 19.9]).parallels([8, 18]), hawaiiPoint, point6, pointStream = { point: function(x3, y3) {
    point6 = [x3, y3];
  } };
  function albersUsa(coordinates) {
    var x3 = coordinates[0], y3 = coordinates[1];
    return point6 = null, (lower48Point.point(x3, y3), point6) || (alaskaPoint.point(x3, y3), point6) || (hawaiiPoint.point(x3, y3), point6);
  }
  albersUsa.invert = function(coordinates) {
    var k3 = lower48.scale(), t5 = lower48.translate(), x3 = (coordinates[0] - t5[0]) / k3, y3 = (coordinates[1] - t5[1]) / k3;
    return (y3 >= 0.12 && y3 < 0.234 && x3 >= -0.425 && x3 < -0.214 ? alaska : y3 >= 0.166 && y3 < 0.234 && x3 >= -0.214 && x3 < -0.115 ? hawaii : lower48).invert(coordinates);
  };
  albersUsa.stream = function(stream) {
    return cache && cacheStream === stream ? cache : cache = multiplex([lower48.stream(cacheStream = stream), alaska.stream(stream), hawaii.stream(stream)]);
  };
  albersUsa.precision = function(_24) {
    if (!arguments.length)
      return lower48.precision();
    lower48.precision(_24), alaska.precision(_24), hawaii.precision(_24);
    return reset();
  };
  albersUsa.scale = function(_24) {
    if (!arguments.length)
      return lower48.scale();
    lower48.scale(_24), alaska.scale(_24 * 0.35), hawaii.scale(_24);
    return albersUsa.translate(lower48.translate());
  };
  albersUsa.translate = function(_24) {
    if (!arguments.length)
      return lower48.translate();
    var k3 = lower48.scale(), x3 = +_24[0], y3 = +_24[1];
    lower48Point = lower48.translate(_24).clipExtent([[x3 - 0.455 * k3, y3 - 0.238 * k3], [x3 + 0.455 * k3, y3 + 0.238 * k3]]).stream(pointStream);
    alaskaPoint = alaska.translate([x3 - 0.307 * k3, y3 + 0.201 * k3]).clipExtent([[x3 - 0.425 * k3 + epsilon3, y3 + 0.12 * k3 + epsilon3], [x3 - 0.214 * k3 - epsilon3, y3 + 0.234 * k3 - epsilon3]]).stream(pointStream);
    hawaiiPoint = hawaii.translate([x3 - 0.205 * k3, y3 + 0.212 * k3]).clipExtent([[x3 - 0.214 * k3 + epsilon3, y3 + 0.166 * k3 + epsilon3], [x3 - 0.115 * k3 - epsilon3, y3 + 0.234 * k3 - epsilon3]]).stream(pointStream);
    return reset();
  };
  albersUsa.fitExtent = function(extent3, object) {
    return fitExtent(albersUsa, extent3, object);
  };
  albersUsa.fitSize = function(size, object) {
    return fitSize(albersUsa, size, object);
  };
  albersUsa.fitWidth = function(width, object) {
    return fitWidth(albersUsa, width, object);
  };
  albersUsa.fitHeight = function(height, object) {
    return fitHeight(albersUsa, height, object);
  };
  function reset() {
    cache = cacheStream = null;
    return albersUsa;
  }
  return albersUsa.scale(1070);
}

// ../../node_modules/d3/node_modules/d3-geo/src/projection/azimuthal.js
function azimuthalRaw(scale) {
  return function(x3, y3) {
    var cx = cos(x3), cy = cos(y3), k3 = scale(cx * cy);
    if (k3 === Infinity)
      return [2, 0];
    return [
      k3 * cy * sin(x3),
      k3 * sin(y3)
    ];
  };
}
function azimuthalInvert(angle) {
  return function(x3, y3) {
    var z2 = sqrt(x3 * x3 + y3 * y3), c5 = angle(z2), sc = sin(c5), cc = cos(c5);
    return [
      atan2(x3 * sc, z2 * cc),
      asin(z2 && y3 * sc / z2)
    ];
  };
}

// ../../node_modules/d3/node_modules/d3-geo/src/projection/azimuthalEqualArea.js
var azimuthalEqualAreaRaw = azimuthalRaw(function(cxcy) {
  return sqrt(2 / (1 + cxcy));
});
azimuthalEqualAreaRaw.invert = azimuthalInvert(function(z2) {
  return 2 * asin(z2 / 2);
});
function azimuthalEqualArea_default() {
  return projection(azimuthalEqualAreaRaw).scale(124.75).clipAngle(180 - 1e-3);
}

// ../../node_modules/d3/node_modules/d3-geo/src/projection/azimuthalEquidistant.js
var azimuthalEquidistantRaw = azimuthalRaw(function(c5) {
  return (c5 = acos(c5)) && c5 / sin(c5);
});
azimuthalEquidistantRaw.invert = azimuthalInvert(function(z2) {
  return z2;
});
function azimuthalEquidistant_default() {
  return projection(azimuthalEquidistantRaw).scale(79.4188).clipAngle(180 - 1e-3);
}

// ../../node_modules/d3/node_modules/d3-geo/src/projection/mercator.js
function mercatorRaw(lambda, phi) {
  return [lambda, log(tan((halfPi + phi) / 2))];
}
mercatorRaw.invert = function(x3, y3) {
  return [x3, 2 * atan(exp(y3)) - halfPi];
};
function mercator_default() {
  return mercatorProjection(mercatorRaw).scale(961 / tau2);
}
function mercatorProjection(project2) {
  var m = projection(project2), center2 = m.center, scale = m.scale, translate = m.translate, clipExtent = m.clipExtent, x05 = null, y05, x12, y12;
  m.scale = function(_24) {
    return arguments.length ? (scale(_24), reclip()) : scale();
  };
  m.translate = function(_24) {
    return arguments.length ? (translate(_24), reclip()) : translate();
  };
  m.center = function(_24) {
    return arguments.length ? (center2(_24), reclip()) : center2();
  };
  m.clipExtent = function(_24) {
    return arguments.length ? (_24 == null ? x05 = y05 = x12 = y12 = null : (x05 = +_24[0][0], y05 = +_24[0][1], x12 = +_24[1][0], y12 = +_24[1][1]), reclip()) : x05 == null ? null : [[x05, y05], [x12, y12]];
  };
  function reclip() {
    var k3 = pi2 * scale(), t5 = m(rotation_default(m.rotate()).invert([0, 0]));
    return clipExtent(x05 == null ? [[t5[0] - k3, t5[1] - k3], [t5[0] + k3, t5[1] + k3]] : project2 === mercatorRaw ? [[Math.max(t5[0] - k3, x05), y05], [Math.min(t5[0] + k3, x12), y12]] : [[x05, Math.max(t5[1] - k3, y05)], [x12, Math.min(t5[1] + k3, y12)]]);
  }
  return reclip();
}

// ../../node_modules/d3/node_modules/d3-geo/src/projection/conicConformal.js
function tany(y3) {
  return tan((halfPi + y3) / 2);
}
function conicConformalRaw(y05, y12) {
  var cy0 = cos(y05), n2 = y05 === y12 ? sin(y05) : log(cy0 / cos(y12)) / log(tany(y12) / tany(y05)), f2 = cy0 * pow(tany(y05), n2) / n2;
  if (!n2)
    return mercatorRaw;
  function project2(x3, y3) {
    if (f2 > 0) {
      if (y3 < -halfPi + epsilon3)
        y3 = -halfPi + epsilon3;
    } else {
      if (y3 > halfPi - epsilon3)
        y3 = halfPi - epsilon3;
    }
    var r2 = f2 / pow(tany(y3), n2);
    return [r2 * sin(n2 * x3), f2 - r2 * cos(n2 * x3)];
  }
  project2.invert = function(x3, y3) {
    var fy = f2 - y3, r2 = sign(n2) * sqrt(x3 * x3 + fy * fy), l2 = atan2(x3, abs2(fy)) * sign(fy);
    if (fy * n2 < 0)
      l2 -= pi2 * sign(x3) * sign(fy);
    return [l2 / n2, 2 * atan(pow(f2 / r2, 1 / n2)) - halfPi];
  };
  return project2;
}
function conicConformal_default() {
  return conicProjection(conicConformalRaw).scale(109.5).parallels([30, 30]);
}

// ../../node_modules/d3/node_modules/d3-geo/src/projection/equirectangular.js
function equirectangularRaw(lambda, phi) {
  return [lambda, phi];
}
equirectangularRaw.invert = equirectangularRaw;
function equirectangular_default() {
  return projection(equirectangularRaw).scale(152.63);
}

// ../../node_modules/d3/node_modules/d3-geo/src/projection/conicEquidistant.js
function conicEquidistantRaw(y05, y12) {
  var cy0 = cos(y05), n2 = y05 === y12 ? sin(y05) : (cy0 - cos(y12)) / (y12 - y05), g2 = cy0 / n2 + y05;
  if (abs2(n2) < epsilon3)
    return equirectangularRaw;
  function project2(x3, y3) {
    var gy = g2 - y3, nx = n2 * x3;
    return [gy * sin(nx), g2 - gy * cos(nx)];
  }
  project2.invert = function(x3, y3) {
    var gy = g2 - y3, l2 = atan2(x3, abs2(gy)) * sign(gy);
    if (gy * n2 < 0)
      l2 -= pi2 * sign(x3) * sign(gy);
    return [l2 / n2, g2 - sign(n2) * sqrt(x3 * x3 + gy * gy)];
  };
  return project2;
}
function conicEquidistant_default() {
  return conicProjection(conicEquidistantRaw).scale(131.154).center([0, 13.9389]);
}

// ../../node_modules/d3/node_modules/d3-geo/src/projection/equalEarth.js
var A1 = 1.340264;
var A2 = -0.081106;
var A3 = 893e-6;
var A4 = 3796e-6;
var M = sqrt(3) / 2;
var iterations = 12;
function equalEarthRaw(lambda, phi) {
  var l2 = asin(M * sin(phi)), l22 = l2 * l2, l6 = l22 * l22 * l22;
  return [
    lambda * cos(l2) / (M * (A1 + 3 * A2 * l22 + l6 * (7 * A3 + 9 * A4 * l22))),
    l2 * (A1 + A2 * l22 + l6 * (A3 + A4 * l22))
  ];
}
equalEarthRaw.invert = function(x3, y3) {
  var l2 = y3, l22 = l2 * l2, l6 = l22 * l22 * l22;
  for (var i2 = 0, delta, fy, fpy; i2 < iterations; ++i2) {
    fy = l2 * (A1 + A2 * l22 + l6 * (A3 + A4 * l22)) - y3;
    fpy = A1 + 3 * A2 * l22 + l6 * (7 * A3 + 9 * A4 * l22);
    l2 -= delta = fy / fpy, l22 = l2 * l2, l6 = l22 * l22 * l22;
    if (abs2(delta) < epsilon22)
      break;
  }
  return [
    M * x3 * (A1 + 3 * A2 * l22 + l6 * (7 * A3 + 9 * A4 * l22)) / cos(l2),
    asin(sin(l2) / M)
  ];
};
function equalEarth_default() {
  return projection(equalEarthRaw).scale(177.158);
}

// ../../node_modules/d3/node_modules/d3-geo/src/projection/gnomonic.js
function gnomonicRaw(x3, y3) {
  var cy = cos(y3), k3 = cos(x3) * cy;
  return [cy * sin(x3) / k3, sin(y3) / k3];
}
gnomonicRaw.invert = azimuthalInvert(atan);
function gnomonic_default() {
  return projection(gnomonicRaw).scale(144.049).clipAngle(60);
}

// ../../node_modules/d3/node_modules/d3-geo/src/projection/orthographic.js
function orthographicRaw(x3, y3) {
  return [cos(y3) * sin(x3), sin(y3)];
}
orthographicRaw.invert = azimuthalInvert(asin);
function orthographic_default() {
  return projection(orthographicRaw).scale(249.5).clipAngle(90 + epsilon3);
}

// ../../node_modules/d3/node_modules/d3-geo/src/projection/stereographic.js
function stereographicRaw(x3, y3) {
  var cy = cos(y3), k3 = 1 + cos(x3) * cy;
  return [cy * sin(x3) / k3, sin(y3) / k3];
}
stereographicRaw.invert = azimuthalInvert(function(z2) {
  return 2 * atan(z2);
});
function stereographic_default() {
  return projection(stereographicRaw).scale(250).clipAngle(142);
}

// ../../node_modules/d3/node_modules/d3-geo/src/projection/transverseMercator.js
function transverseMercatorRaw(lambda, phi) {
  return [log(tan((halfPi + phi) / 2)), -lambda];
}
transverseMercatorRaw.invert = function(x3, y3) {
  return [-y3, 2 * atan(exp(x3)) - halfPi];
};
function transverseMercator_default() {
  var m = mercatorProjection(transverseMercatorRaw), center2 = m.center, rotate = m.rotate;
  m.center = function(_24) {
    return arguments.length ? center2([-_24[1], _24[0]]) : (_24 = center2(), [_24[1], -_24[0]]);
  };
  m.rotate = function(_24) {
    return arguments.length ? rotate([_24[0], _24[1], _24.length > 2 ? _24[2] + 90 : 90]) : (_24 = rotate(), [_24[0], _24[1], _24[2] - 90]);
  };
  return rotate([0, 0, 90]).scale(159.155);
}

// ../../node_modules/d3-scale/src/init.js
function initRange(domain, range3) {
  switch (arguments.length) {
    case 0:
      break;
    case 1:
      this.range(domain);
      break;
    default:
      this.range(range3).domain(domain);
      break;
  }
  return this;
}
function initInterpolator(domain, interpolator) {
  switch (arguments.length) {
    case 0:
      break;
    case 1: {
      if (typeof domain === "function")
        this.interpolator(domain);
      else
        this.range(domain);
      break;
    }
    default: {
      this.domain(domain);
      if (typeof interpolator === "function")
        this.interpolator(interpolator);
      else
        this.range(interpolator);
      break;
    }
  }
  return this;
}

// ../../node_modules/d3-scale/src/ordinal.js
var implicit = Symbol("implicit");
function ordinal() {
  var index2 = new InternMap(), domain = [], range3 = [], unknown = implicit;
  function scale(d2) {
    let i2 = index2.get(d2);
    if (i2 === void 0) {
      if (unknown !== implicit)
        return unknown;
      index2.set(d2, i2 = domain.push(d2) - 1);
    }
    return range3[i2 % range3.length];
  }
  scale.domain = function(_24) {
    if (!arguments.length)
      return domain.slice();
    domain = [], index2 = new InternMap();
    for (const value of _24) {
      if (index2.has(value))
        continue;
      index2.set(value, domain.push(value) - 1);
    }
    return scale;
  };
  scale.range = function(_24) {
    return arguments.length ? (range3 = Array.from(_24), scale) : range3.slice();
  };
  scale.unknown = function(_24) {
    return arguments.length ? (unknown = _24, scale) : unknown;
  };
  scale.copy = function() {
    return ordinal(domain, range3).unknown(unknown);
  };
  initRange.apply(scale, arguments);
  return scale;
}

// ../../node_modules/d3-scale/src/band.js
function band() {
  var scale = ordinal().unknown(void 0), domain = scale.domain, ordinalRange2 = scale.range, r0 = 0, r1 = 1, step, bandwidth, round = false, paddingInner = 0, paddingOuter = 0, align = 0.5;
  delete scale.unknown;
  function rescale() {
    var n2 = domain().length, reverse2 = r1 < r0, start2 = reverse2 ? r1 : r0, stop = reverse2 ? r0 : r1;
    step = (stop - start2) / Math.max(1, n2 - paddingInner + paddingOuter * 2);
    if (round)
      step = Math.floor(step);
    start2 += (stop - start2 - step * (n2 - paddingInner)) * align;
    bandwidth = step * (1 - paddingInner);
    if (round)
      start2 = Math.round(start2), bandwidth = Math.round(bandwidth);
    var values2 = range(n2).map(function(i2) {
      return start2 + step * i2;
    });
    return ordinalRange2(reverse2 ? values2.reverse() : values2);
  }
  scale.domain = function(_24) {
    return arguments.length ? (domain(_24), rescale()) : domain();
  };
  scale.range = function(_24) {
    return arguments.length ? ([r0, r1] = _24, r0 = +r0, r1 = +r1, rescale()) : [r0, r1];
  };
  scale.rangeRound = function(_24) {
    return [r0, r1] = _24, r0 = +r0, r1 = +r1, round = true, rescale();
  };
  scale.bandwidth = function() {
    return bandwidth;
  };
  scale.step = function() {
    return step;
  };
  scale.round = function(_24) {
    return arguments.length ? (round = !!_24, rescale()) : round;
  };
  scale.padding = function(_24) {
    return arguments.length ? (paddingInner = Math.min(1, paddingOuter = +_24), rescale()) : paddingInner;
  };
  scale.paddingInner = function(_24) {
    return arguments.length ? (paddingInner = Math.min(1, _24), rescale()) : paddingInner;
  };
  scale.paddingOuter = function(_24) {
    return arguments.length ? (paddingOuter = +_24, rescale()) : paddingOuter;
  };
  scale.align = function(_24) {
    return arguments.length ? (align = Math.max(0, Math.min(1, _24)), rescale()) : align;
  };
  scale.copy = function() {
    return band(domain(), [r0, r1]).round(round).paddingInner(paddingInner).paddingOuter(paddingOuter).align(align);
  };
  return initRange.apply(rescale(), arguments);
}
function pointish(scale) {
  var copy4 = scale.copy;
  scale.padding = scale.paddingOuter;
  delete scale.paddingInner;
  delete scale.paddingOuter;
  scale.copy = function() {
    return pointish(copy4());
  };
  return scale;
}
function point() {
  return pointish(band.apply(null, arguments).paddingInner(1));
}

// ../../node_modules/d3-scale/src/constant.js
function constants(x3) {
  return function() {
    return x3;
  };
}

// ../../node_modules/d3-scale/src/number.js
function number3(x3) {
  return +x3;
}

// ../../node_modules/d3-scale/src/continuous.js
var unit = [0, 1];
function identity3(x3) {
  return x3;
}
function normalize(a3, b2) {
  return (b2 -= a3 = +a3) ? function(x3) {
    return (x3 - a3) / b2;
  } : constants(isNaN(b2) ? NaN : 0.5);
}
function clamper(a3, b2) {
  var t5;
  if (a3 > b2)
    t5 = a3, a3 = b2, b2 = t5;
  return function(x3) {
    return Math.max(a3, Math.min(b2, x3));
  };
}
function bimap(domain, range3, interpolate) {
  var d0 = domain[0], d1 = domain[1], r0 = range3[0], r1 = range3[1];
  if (d1 < d0)
    d0 = normalize(d1, d0), r0 = interpolate(r1, r0);
  else
    d0 = normalize(d0, d1), r0 = interpolate(r0, r1);
  return function(x3) {
    return r0(d0(x3));
  };
}
function polymap(domain, range3, interpolate) {
  var j2 = Math.min(domain.length, range3.length) - 1, d2 = new Array(j2), r2 = new Array(j2), i2 = -1;
  if (domain[j2] < domain[0]) {
    domain = domain.slice().reverse();
    range3 = range3.slice().reverse();
  }
  while (++i2 < j2) {
    d2[i2] = normalize(domain[i2], domain[i2 + 1]);
    r2[i2] = interpolate(range3[i2], range3[i2 + 1]);
  }
  return function(x3) {
    var i3 = bisect_default(domain, x3, 1, j2) - 1;
    return r2[i3](d2[i3](x3));
  };
}
function copy(source, target) {
  return target.domain(source.domain()).range(source.range()).interpolate(source.interpolate()).clamp(source.clamp()).unknown(source.unknown());
}
function transformer2() {
  var domain = unit, range3 = unit, interpolate = value_default, transform2, untransform, unknown, clamp = identity3, piecewise2, output2, input;
  function rescale() {
    var n2 = Math.min(domain.length, range3.length);
    if (clamp !== identity3)
      clamp = clamper(domain[0], domain[n2 - 1]);
    piecewise2 = n2 > 2 ? polymap : bimap;
    output2 = input = null;
    return scale;
  }
  function scale(x3) {
    return x3 == null || isNaN(x3 = +x3) ? unknown : (output2 || (output2 = piecewise2(domain.map(transform2), range3, interpolate)))(transform2(clamp(x3)));
  }
  scale.invert = function(y3) {
    return clamp(untransform((input || (input = piecewise2(range3, domain.map(transform2), number_default)))(y3)));
  };
  scale.domain = function(_24) {
    return arguments.length ? (domain = Array.from(_24, number3), rescale()) : domain.slice();
  };
  scale.range = function(_24) {
    return arguments.length ? (range3 = Array.from(_24), rescale()) : range3.slice();
  };
  scale.rangeRound = function(_24) {
    return range3 = Array.from(_24), interpolate = round_default, rescale();
  };
  scale.clamp = function(_24) {
    return arguments.length ? (clamp = _24 ? true : identity3, rescale()) : clamp !== identity3;
  };
  scale.interpolate = function(_24) {
    return arguments.length ? (interpolate = _24, rescale()) : interpolate;
  };
  scale.unknown = function(_24) {
    return arguments.length ? (unknown = _24, scale) : unknown;
  };
  return function(t5, u2) {
    transform2 = t5, untransform = u2;
    return rescale();
  };
}
function continuous() {
  return transformer2()(identity3, identity3);
}

// ../../node_modules/d3-scale/src/tickFormat.js
function tickFormat(start2, stop, count2, specifier) {
  var step = tickStep(start2, stop, count2), precision;
  specifier = formatSpecifier(specifier == null ? ",f" : specifier);
  switch (specifier.type) {
    case "s": {
      var value = Math.max(Math.abs(start2), Math.abs(stop));
      if (specifier.precision == null && !isNaN(precision = precisionPrefix_default(step, value)))
        specifier.precision = precision;
      return formatPrefix(specifier, value);
    }
    case "":
    case "e":
    case "g":
    case "p":
    case "r": {
      if (specifier.precision == null && !isNaN(precision = precisionRound_default(step, Math.max(Math.abs(start2), Math.abs(stop)))))
        specifier.precision = precision - (specifier.type === "e");
      break;
    }
    case "f":
    case "%": {
      if (specifier.precision == null && !isNaN(precision = precisionFixed_default(step)))
        specifier.precision = precision - (specifier.type === "%") * 2;
      break;
    }
  }
  return format(specifier);
}

// ../../node_modules/d3-scale/src/linear.js
function linearish(scale) {
  var domain = scale.domain;
  scale.ticks = function(count2) {
    var d2 = domain();
    return ticks(d2[0], d2[d2.length - 1], count2 == null ? 10 : count2);
  };
  scale.tickFormat = function(count2, specifier) {
    var d2 = domain();
    return tickFormat(d2[0], d2[d2.length - 1], count2 == null ? 10 : count2, specifier);
  };
  scale.nice = function(count2) {
    if (count2 == null)
      count2 = 10;
    var d2 = domain();
    var i0 = 0;
    var i1 = d2.length - 1;
    var start2 = d2[i0];
    var stop = d2[i1];
    var prestep;
    var step;
    var maxIter = 10;
    if (stop < start2) {
      step = start2, start2 = stop, stop = step;
      step = i0, i0 = i1, i1 = step;
    }
    while (maxIter-- > 0) {
      step = tickIncrement(start2, stop, count2);
      if (step === prestep) {
        d2[i0] = start2;
        d2[i1] = stop;
        return domain(d2);
      } else if (step > 0) {
        start2 = Math.floor(start2 / step) * step;
        stop = Math.ceil(stop / step) * step;
      } else if (step < 0) {
        start2 = Math.ceil(start2 * step) / step;
        stop = Math.floor(stop * step) / step;
      } else {
        break;
      }
      prestep = step;
    }
    return scale;
  };
  return scale;
}
function linear2() {
  var scale = continuous();
  scale.copy = function() {
    return copy(scale, linear2());
  };
  initRange.apply(scale, arguments);
  return linearish(scale);
}

// ../../node_modules/d3-scale/src/identity.js
function identity4(domain) {
  var unknown;
  function scale(x3) {
    return x3 == null || isNaN(x3 = +x3) ? unknown : x3;
  }
  scale.invert = scale;
  scale.domain = scale.range = function(_24) {
    return arguments.length ? (domain = Array.from(_24, number3), scale) : domain.slice();
  };
  scale.unknown = function(_24) {
    return arguments.length ? (unknown = _24, scale) : unknown;
  };
  scale.copy = function() {
    return identity4(domain).unknown(unknown);
  };
  domain = arguments.length ? Array.from(domain, number3) : [0, 1];
  return linearish(scale);
}

// ../../node_modules/d3-scale/src/nice.js
function nice(domain, interval2) {
  domain = domain.slice();
  var i0 = 0, i1 = domain.length - 1, x05 = domain[i0], x12 = domain[i1], t5;
  if (x12 < x05) {
    t5 = i0, i0 = i1, i1 = t5;
    t5 = x05, x05 = x12, x12 = t5;
  }
  domain[i0] = interval2.floor(x05);
  domain[i1] = interval2.ceil(x12);
  return domain;
}

// ../../node_modules/d3-scale/src/log.js
function transformLog(x3) {
  return Math.log(x3);
}
function transformExp(x3) {
  return Math.exp(x3);
}
function transformLogn(x3) {
  return -Math.log(-x3);
}
function transformExpn(x3) {
  return -Math.exp(-x3);
}
function pow10(x3) {
  return isFinite(x3) ? +("1e" + x3) : x3 < 0 ? 0 : x3;
}
function powp(base) {
  return base === 10 ? pow10 : base === Math.E ? Math.exp : (x3) => Math.pow(base, x3);
}
function logp(base) {
  return base === Math.E ? Math.log : base === 10 && Math.log10 || base === 2 && Math.log2 || (base = Math.log(base), (x3) => Math.log(x3) / base);
}
function reflect(f2) {
  return (x3, k3) => -f2(-x3, k3);
}
function loggish(transform2) {
  const scale = transform2(transformLog, transformExp);
  const domain = scale.domain;
  let base = 10;
  let logs;
  let pows;
  function rescale() {
    logs = logp(base), pows = powp(base);
    if (domain()[0] < 0) {
      logs = reflect(logs), pows = reflect(pows);
      transform2(transformLogn, transformExpn);
    } else {
      transform2(transformLog, transformExp);
    }
    return scale;
  }
  scale.base = function(_24) {
    return arguments.length ? (base = +_24, rescale()) : base;
  };
  scale.domain = function(_24) {
    return arguments.length ? (domain(_24), rescale()) : domain();
  };
  scale.ticks = (count2) => {
    const d2 = domain();
    let u2 = d2[0];
    let v2 = d2[d2.length - 1];
    const r2 = v2 < u2;
    if (r2)
      [u2, v2] = [v2, u2];
    let i2 = logs(u2);
    let j2 = logs(v2);
    let k3;
    let t5;
    const n2 = count2 == null ? 10 : +count2;
    let z2 = [];
    if (!(base % 1) && j2 - i2 < n2) {
      i2 = Math.floor(i2), j2 = Math.ceil(j2);
      if (u2 > 0)
        for (; i2 <= j2; ++i2) {
          for (k3 = 1; k3 < base; ++k3) {
            t5 = i2 < 0 ? k3 / pows(-i2) : k3 * pows(i2);
            if (t5 < u2)
              continue;
            if (t5 > v2)
              break;
            z2.push(t5);
          }
        }
      else
        for (; i2 <= j2; ++i2) {
          for (k3 = base - 1; k3 >= 1; --k3) {
            t5 = i2 > 0 ? k3 / pows(-i2) : k3 * pows(i2);
            if (t5 < u2)
              continue;
            if (t5 > v2)
              break;
            z2.push(t5);
          }
        }
      if (z2.length * 2 < n2)
        z2 = ticks(u2, v2, n2);
    } else {
      z2 = ticks(i2, j2, Math.min(j2 - i2, n2)).map(pows);
    }
    return r2 ? z2.reverse() : z2;
  };
  scale.tickFormat = (count2, specifier) => {
    if (count2 == null)
      count2 = 10;
    if (specifier == null)
      specifier = base === 10 ? "s" : ",";
    if (typeof specifier !== "function") {
      if (!(base % 1) && (specifier = formatSpecifier(specifier)).precision == null)
        specifier.trim = true;
      specifier = format(specifier);
    }
    if (count2 === Infinity)
      return specifier;
    const k3 = Math.max(1, base * count2 / scale.ticks().length);
    return (d2) => {
      let i2 = d2 / pows(Math.round(logs(d2)));
      if (i2 * base < base - 0.5)
        i2 *= base;
      return i2 <= k3 ? specifier(d2) : "";
    };
  };
  scale.nice = () => {
    return domain(nice(domain(), {
      floor: (x3) => pows(Math.floor(logs(x3))),
      ceil: (x3) => pows(Math.ceil(logs(x3)))
    }));
  };
  return scale;
}
function log2() {
  const scale = loggish(transformer2()).domain([1, 10]);
  scale.copy = () => copy(scale, log2()).base(scale.base());
  initRange.apply(scale, arguments);
  return scale;
}

// ../../node_modules/d3-scale/src/symlog.js
function transformSymlog(c5) {
  return function(x3) {
    return Math.sign(x3) * Math.log1p(Math.abs(x3 / c5));
  };
}
function transformSymexp(c5) {
  return function(x3) {
    return Math.sign(x3) * Math.expm1(Math.abs(x3)) * c5;
  };
}
function symlogish(transform2) {
  var c5 = 1, scale = transform2(transformSymlog(c5), transformSymexp(c5));
  scale.constant = function(_24) {
    return arguments.length ? transform2(transformSymlog(c5 = +_24), transformSymexp(c5)) : c5;
  };
  return linearish(scale);
}
function symlog() {
  var scale = symlogish(transformer2());
  scale.copy = function() {
    return copy(scale, symlog()).constant(scale.constant());
  };
  return initRange.apply(scale, arguments);
}

// ../../node_modules/d3-scale/src/pow.js
function transformPow(exponent) {
  return function(x3) {
    return x3 < 0 ? -Math.pow(-x3, exponent) : Math.pow(x3, exponent);
  };
}
function transformSqrt(x3) {
  return x3 < 0 ? -Math.sqrt(-x3) : Math.sqrt(x3);
}
function transformSquare(x3) {
  return x3 < 0 ? -x3 * x3 : x3 * x3;
}
function powish(transform2) {
  var scale = transform2(identity3, identity3), exponent = 1;
  function rescale() {
    return exponent === 1 ? transform2(identity3, identity3) : exponent === 0.5 ? transform2(transformSqrt, transformSquare) : transform2(transformPow(exponent), transformPow(1 / exponent));
  }
  scale.exponent = function(_24) {
    return arguments.length ? (exponent = +_24, rescale()) : exponent;
  };
  return linearish(scale);
}
function pow2() {
  var scale = powish(transformer2());
  scale.copy = function() {
    return copy(scale, pow2()).exponent(scale.exponent());
  };
  initRange.apply(scale, arguments);
  return scale;
}

// ../../node_modules/d3-scale/src/quantile.js
function quantile2() {
  var domain = [], range3 = [], thresholds = [], unknown;
  function rescale() {
    var i2 = 0, n2 = Math.max(1, range3.length);
    thresholds = new Array(n2 - 1);
    while (++i2 < n2)
      thresholds[i2 - 1] = quantileSorted(domain, i2 / n2);
    return scale;
  }
  function scale(x3) {
    return x3 == null || isNaN(x3 = +x3) ? unknown : range3[bisect_default(thresholds, x3)];
  }
  scale.invertExtent = function(y3) {
    var i2 = range3.indexOf(y3);
    return i2 < 0 ? [NaN, NaN] : [
      i2 > 0 ? thresholds[i2 - 1] : domain[0],
      i2 < thresholds.length ? thresholds[i2] : domain[domain.length - 1]
    ];
  };
  scale.domain = function(_24) {
    if (!arguments.length)
      return domain.slice();
    domain = [];
    for (let d2 of _24)
      if (d2 != null && !isNaN(d2 = +d2))
        domain.push(d2);
    domain.sort(ascending);
    return rescale();
  };
  scale.range = function(_24) {
    return arguments.length ? (range3 = Array.from(_24), rescale()) : range3.slice();
  };
  scale.unknown = function(_24) {
    return arguments.length ? (unknown = _24, scale) : unknown;
  };
  scale.quantiles = function() {
    return thresholds.slice();
  };
  scale.copy = function() {
    return quantile2().domain(domain).range(range3).unknown(unknown);
  };
  return initRange.apply(scale, arguments);
}

// ../../node_modules/d3-scale/src/threshold.js
function threshold() {
  var domain = [0.5], range3 = [0, 1], unknown, n2 = 1;
  function scale(x3) {
    return x3 != null && x3 <= x3 ? range3[bisect_default(domain, x3, 0, n2)] : unknown;
  }
  scale.domain = function(_24) {
    return arguments.length ? (domain = Array.from(_24), n2 = Math.min(domain.length, range3.length - 1), scale) : domain.slice();
  };
  scale.range = function(_24) {
    return arguments.length ? (range3 = Array.from(_24), n2 = Math.min(domain.length, range3.length - 1), scale) : range3.slice();
  };
  scale.invertExtent = function(y3) {
    var i2 = range3.indexOf(y3);
    return [domain[i2 - 1], domain[i2]];
  };
  scale.unknown = function(_24) {
    return arguments.length ? (unknown = _24, scale) : unknown;
  };
  scale.copy = function() {
    return threshold().domain(domain).range(range3).unknown(unknown);
  };
  return initRange.apply(scale, arguments);
}

// ../../node_modules/d3-time/src/interval.js
var t02 = /* @__PURE__ */ new Date();
var t12 = /* @__PURE__ */ new Date();
function timeInterval(floori, offseti, count2, field2) {
  function interval2(date2) {
    return floori(date2 = arguments.length === 0 ? /* @__PURE__ */ new Date() : /* @__PURE__ */ new Date(+date2)), date2;
  }
  interval2.floor = (date2) => {
    return floori(date2 = /* @__PURE__ */ new Date(+date2)), date2;
  };
  interval2.ceil = (date2) => {
    return floori(date2 = new Date(date2 - 1)), offseti(date2, 1), floori(date2), date2;
  };
  interval2.round = (date2) => {
    const d0 = interval2(date2), d1 = interval2.ceil(date2);
    return date2 - d0 < d1 - date2 ? d0 : d1;
  };
  interval2.offset = (date2, step) => {
    return offseti(date2 = /* @__PURE__ */ new Date(+date2), step == null ? 1 : Math.floor(step)), date2;
  };
  interval2.range = (start2, stop, step) => {
    const range3 = [];
    start2 = interval2.ceil(start2);
    step = step == null ? 1 : Math.floor(step);
    if (!(start2 < stop) || !(step > 0))
      return range3;
    let previous;
    do
      range3.push(previous = /* @__PURE__ */ new Date(+start2)), offseti(start2, step), floori(start2);
    while (previous < start2 && start2 < stop);
    return range3;
  };
  interval2.filter = (test) => {
    return timeInterval((date2) => {
      if (date2 >= date2)
        while (floori(date2), !test(date2))
          date2.setTime(date2 - 1);
    }, (date2, step) => {
      if (date2 >= date2) {
        if (step < 0)
          while (++step <= 0) {
            while (offseti(date2, -1), !test(date2)) {
            }
          }
        else
          while (--step >= 0) {
            while (offseti(date2, 1), !test(date2)) {
            }
          }
      }
    });
  };
  if (count2) {
    interval2.count = (start2, end) => {
      t02.setTime(+start2), t12.setTime(+end);
      floori(t02), floori(t12);
      return Math.floor(count2(t02, t12));
    };
    interval2.every = (step) => {
      step = Math.floor(step);
      return !isFinite(step) || !(step > 0) ? null : !(step > 1) ? interval2 : interval2.filter(field2 ? (d2) => field2(d2) % step === 0 : (d2) => interval2.count(0, d2) % step === 0);
    };
  }
  return interval2;
}

// ../../node_modules/d3-time/src/millisecond.js
var millisecond = timeInterval(() => {
}, (date2, step) => {
  date2.setTime(+date2 + step);
}, (start2, end) => {
  return end - start2;
});
millisecond.every = (k3) => {
  k3 = Math.floor(k3);
  if (!isFinite(k3) || !(k3 > 0))
    return null;
  if (!(k3 > 1))
    return millisecond;
  return timeInterval((date2) => {
    date2.setTime(Math.floor(date2 / k3) * k3);
  }, (date2, step) => {
    date2.setTime(+date2 + step * k3);
  }, (start2, end) => {
    return (end - start2) / k3;
  });
};
var milliseconds = millisecond.range;

// ../../node_modules/d3-time/src/duration.js
var durationSecond = 1e3;
var durationMinute = durationSecond * 60;
var durationHour = durationMinute * 60;
var durationDay = durationHour * 24;
var durationWeek = durationDay * 7;
var durationMonth = durationDay * 30;
var durationYear = durationDay * 365;

// ../../node_modules/d3-time/src/second.js
var second = timeInterval((date2) => {
  date2.setTime(date2 - date2.getMilliseconds());
}, (date2, step) => {
  date2.setTime(+date2 + step * durationSecond);
}, (start2, end) => {
  return (end - start2) / durationSecond;
}, (date2) => {
  return date2.getUTCSeconds();
});
var seconds = second.range;

// ../../node_modules/d3-time/src/minute.js
var timeMinute = timeInterval((date2) => {
  date2.setTime(date2 - date2.getMilliseconds() - date2.getSeconds() * durationSecond);
}, (date2, step) => {
  date2.setTime(+date2 + step * durationMinute);
}, (start2, end) => {
  return (end - start2) / durationMinute;
}, (date2) => {
  return date2.getMinutes();
});
var timeMinutes = timeMinute.range;
var utcMinute = timeInterval((date2) => {
  date2.setUTCSeconds(0, 0);
}, (date2, step) => {
  date2.setTime(+date2 + step * durationMinute);
}, (start2, end) => {
  return (end - start2) / durationMinute;
}, (date2) => {
  return date2.getUTCMinutes();
});
var utcMinutes = utcMinute.range;

// ../../node_modules/d3-time/src/hour.js
var timeHour = timeInterval((date2) => {
  date2.setTime(date2 - date2.getMilliseconds() - date2.getSeconds() * durationSecond - date2.getMinutes() * durationMinute);
}, (date2, step) => {
  date2.setTime(+date2 + step * durationHour);
}, (start2, end) => {
  return (end - start2) / durationHour;
}, (date2) => {
  return date2.getHours();
});
var timeHours = timeHour.range;
var utcHour = timeInterval((date2) => {
  date2.setUTCMinutes(0, 0, 0);
}, (date2, step) => {
  date2.setTime(+date2 + step * durationHour);
}, (start2, end) => {
  return (end - start2) / durationHour;
}, (date2) => {
  return date2.getUTCHours();
});
var utcHours = utcHour.range;

// ../../node_modules/d3-time/src/day.js
var timeDay = timeInterval(
  (date2) => date2.setHours(0, 0, 0, 0),
  (date2, step) => date2.setDate(date2.getDate() + step),
  (start2, end) => (end - start2 - (end.getTimezoneOffset() - start2.getTimezoneOffset()) * durationMinute) / durationDay,
  (date2) => date2.getDate() - 1
);
var timeDays = timeDay.range;
var utcDay = timeInterval((date2) => {
  date2.setUTCHours(0, 0, 0, 0);
}, (date2, step) => {
  date2.setUTCDate(date2.getUTCDate() + step);
}, (start2, end) => {
  return (end - start2) / durationDay;
}, (date2) => {
  return date2.getUTCDate() - 1;
});
var utcDays = utcDay.range;
var unixDay = timeInterval((date2) => {
  date2.setUTCHours(0, 0, 0, 0);
}, (date2, step) => {
  date2.setUTCDate(date2.getUTCDate() + step);
}, (start2, end) => {
  return (end - start2) / durationDay;
}, (date2) => {
  return Math.floor(date2 / durationDay);
});
var unixDays = unixDay.range;

// ../../node_modules/d3-time/src/week.js
function timeWeekday(i2) {
  return timeInterval((date2) => {
    date2.setDate(date2.getDate() - (date2.getDay() + 7 - i2) % 7);
    date2.setHours(0, 0, 0, 0);
  }, (date2, step) => {
    date2.setDate(date2.getDate() + step * 7);
  }, (start2, end) => {
    return (end - start2 - (end.getTimezoneOffset() - start2.getTimezoneOffset()) * durationMinute) / durationWeek;
  });
}
var timeSunday = timeWeekday(0);
var timeMonday = timeWeekday(1);
var timeTuesday = timeWeekday(2);
var timeWednesday = timeWeekday(3);
var timeThursday = timeWeekday(4);
var timeFriday = timeWeekday(5);
var timeSaturday = timeWeekday(6);
var timeSundays = timeSunday.range;
var timeMondays = timeMonday.range;
var timeTuesdays = timeTuesday.range;
var timeWednesdays = timeWednesday.range;
var timeThursdays = timeThursday.range;
var timeFridays = timeFriday.range;
var timeSaturdays = timeSaturday.range;
function utcWeekday(i2) {
  return timeInterval((date2) => {
    date2.setUTCDate(date2.getUTCDate() - (date2.getUTCDay() + 7 - i2) % 7);
    date2.setUTCHours(0, 0, 0, 0);
  }, (date2, step) => {
    date2.setUTCDate(date2.getUTCDate() + step * 7);
  }, (start2, end) => {
    return (end - start2) / durationWeek;
  });
}
var utcSunday = utcWeekday(0);
var utcMonday = utcWeekday(1);
var utcTuesday = utcWeekday(2);
var utcWednesday = utcWeekday(3);
var utcThursday = utcWeekday(4);
var utcFriday = utcWeekday(5);
var utcSaturday = utcWeekday(6);
var utcSundays = utcSunday.range;
var utcMondays = utcMonday.range;
var utcTuesdays = utcTuesday.range;
var utcWednesdays = utcWednesday.range;
var utcThursdays = utcThursday.range;
var utcFridays = utcFriday.range;
var utcSaturdays = utcSaturday.range;

// ../../node_modules/d3-time/src/month.js
var timeMonth = timeInterval((date2) => {
  date2.setDate(1);
  date2.setHours(0, 0, 0, 0);
}, (date2, step) => {
  date2.setMonth(date2.getMonth() + step);
}, (start2, end) => {
  return end.getMonth() - start2.getMonth() + (end.getFullYear() - start2.getFullYear()) * 12;
}, (date2) => {
  return date2.getMonth();
});
var timeMonths = timeMonth.range;
var utcMonth = timeInterval((date2) => {
  date2.setUTCDate(1);
  date2.setUTCHours(0, 0, 0, 0);
}, (date2, step) => {
  date2.setUTCMonth(date2.getUTCMonth() + step);
}, (start2, end) => {
  return end.getUTCMonth() - start2.getUTCMonth() + (end.getUTCFullYear() - start2.getUTCFullYear()) * 12;
}, (date2) => {
  return date2.getUTCMonth();
});
var utcMonths = utcMonth.range;

// ../../node_modules/d3-time/src/year.js
var timeYear = timeInterval((date2) => {
  date2.setMonth(0, 1);
  date2.setHours(0, 0, 0, 0);
}, (date2, step) => {
  date2.setFullYear(date2.getFullYear() + step);
}, (start2, end) => {
  return end.getFullYear() - start2.getFullYear();
}, (date2) => {
  return date2.getFullYear();
});
timeYear.every = (k3) => {
  return !isFinite(k3 = Math.floor(k3)) || !(k3 > 0) ? null : timeInterval((date2) => {
    date2.setFullYear(Math.floor(date2.getFullYear() / k3) * k3);
    date2.setMonth(0, 1);
    date2.setHours(0, 0, 0, 0);
  }, (date2, step) => {
    date2.setFullYear(date2.getFullYear() + step * k3);
  });
};
var timeYears = timeYear.range;
var utcYear = timeInterval((date2) => {
  date2.setUTCMonth(0, 1);
  date2.setUTCHours(0, 0, 0, 0);
}, (date2, step) => {
  date2.setUTCFullYear(date2.getUTCFullYear() + step);
}, (start2, end) => {
  return end.getUTCFullYear() - start2.getUTCFullYear();
}, (date2) => {
  return date2.getUTCFullYear();
});
utcYear.every = (k3) => {
  return !isFinite(k3 = Math.floor(k3)) || !(k3 > 0) ? null : timeInterval((date2) => {
    date2.setUTCFullYear(Math.floor(date2.getUTCFullYear() / k3) * k3);
    date2.setUTCMonth(0, 1);
    date2.setUTCHours(0, 0, 0, 0);
  }, (date2, step) => {
    date2.setUTCFullYear(date2.getUTCFullYear() + step * k3);
  });
};
var utcYears = utcYear.range;

// ../../node_modules/d3-time/src/ticks.js
function ticker(year, month, week, day, hour, minute) {
  const tickIntervals2 = [
    [second, 1, durationSecond],
    [second, 5, 5 * durationSecond],
    [second, 15, 15 * durationSecond],
    [second, 30, 30 * durationSecond],
    [minute, 1, durationMinute],
    [minute, 5, 5 * durationMinute],
    [minute, 15, 15 * durationMinute],
    [minute, 30, 30 * durationMinute],
    [hour, 1, durationHour],
    [hour, 3, 3 * durationHour],
    [hour, 6, 6 * durationHour],
    [hour, 12, 12 * durationHour],
    [day, 1, durationDay],
    [day, 2, 2 * durationDay],
    [week, 1, durationWeek],
    [month, 1, durationMonth],
    [month, 3, 3 * durationMonth],
    [year, 1, durationYear]
  ];
  function ticks2(start2, stop, count2) {
    const reverse2 = stop < start2;
    if (reverse2)
      [start2, stop] = [stop, start2];
    const interval2 = count2 && typeof count2.range === "function" ? count2 : tickInterval(start2, stop, count2);
    const ticks3 = interval2 ? interval2.range(start2, +stop + 1) : [];
    return reverse2 ? ticks3.reverse() : ticks3;
  }
  function tickInterval(start2, stop, count2) {
    const target = Math.abs(stop - start2) / count2;
    const i2 = bisector(([, , step2]) => step2).right(tickIntervals2, target);
    if (i2 === tickIntervals2.length)
      return year.every(tickStep(start2 / durationYear, stop / durationYear, count2));
    if (i2 === 0)
      return millisecond.every(Math.max(tickStep(start2, stop, count2), 1));
    const [t5, step] = tickIntervals2[target / tickIntervals2[i2 - 1][2] < tickIntervals2[i2][2] / target ? i2 - 1 : i2];
    return t5.every(step);
  }
  return [ticks2, tickInterval];
}
var [utcTicks, utcTickInterval] = ticker(utcYear, utcMonth, utcSunday, unixDay, utcHour, utcMinute);
var [timeTicks, timeTickInterval] = ticker(timeYear, timeMonth, timeSunday, timeDay, timeHour, timeMinute);

// ../../node_modules/d3-time-format/src/locale.js
function localDate(d2) {
  if (0 <= d2.y && d2.y < 100) {
    var date2 = new Date(-1, d2.m, d2.d, d2.H, d2.M, d2.S, d2.L);
    date2.setFullYear(d2.y);
    return date2;
  }
  return new Date(d2.y, d2.m, d2.d, d2.H, d2.M, d2.S, d2.L);
}
function utcDate(d2) {
  if (0 <= d2.y && d2.y < 100) {
    var date2 = new Date(Date.UTC(-1, d2.m, d2.d, d2.H, d2.M, d2.S, d2.L));
    date2.setUTCFullYear(d2.y);
    return date2;
  }
  return new Date(Date.UTC(d2.y, d2.m, d2.d, d2.H, d2.M, d2.S, d2.L));
}
function newDate(y3, m, d2) {
  return { y: y3, m, d: d2, H: 0, M: 0, S: 0, L: 0 };
}
function formatLocale(locale3) {
  var locale_dateTime = locale3.dateTime, locale_date = locale3.date, locale_time = locale3.time, locale_periods = locale3.periods, locale_weekdays = locale3.days, locale_shortWeekdays = locale3.shortDays, locale_months = locale3.months, locale_shortMonths = locale3.shortMonths;
  var periodRe = formatRe(locale_periods), periodLookup = formatLookup(locale_periods), weekdayRe = formatRe(locale_weekdays), weekdayLookup = formatLookup(locale_weekdays), shortWeekdayRe = formatRe(locale_shortWeekdays), shortWeekdayLookup = formatLookup(locale_shortWeekdays), monthRe = formatRe(locale_months), monthLookup = formatLookup(locale_months), shortMonthRe = formatRe(locale_shortMonths), shortMonthLookup = formatLookup(locale_shortMonths);
  var formats = {
    "a": formatShortWeekday,
    "A": formatWeekday,
    "b": formatShortMonth,
    "B": formatMonth,
    "c": null,
    "d": formatDayOfMonth,
    "e": formatDayOfMonth,
    "f": formatMicroseconds,
    "g": formatYearISO,
    "G": formatFullYearISO,
    "H": formatHour24,
    "I": formatHour12,
    "j": formatDayOfYear,
    "L": formatMilliseconds,
    "m": formatMonthNumber,
    "M": formatMinutes,
    "p": formatPeriod,
    "q": formatQuarter,
    "Q": formatUnixTimestamp,
    "s": formatUnixTimestampSeconds,
    "S": formatSeconds,
    "u": formatWeekdayNumberMonday,
    "U": formatWeekNumberSunday,
    "V": formatWeekNumberISO,
    "w": formatWeekdayNumberSunday,
    "W": formatWeekNumberMonday,
    "x": null,
    "X": null,
    "y": formatYear,
    "Y": formatFullYear,
    "Z": formatZone,
    "%": formatLiteralPercent
  };
  var utcFormats = {
    "a": formatUTCShortWeekday,
    "A": formatUTCWeekday,
    "b": formatUTCShortMonth,
    "B": formatUTCMonth,
    "c": null,
    "d": formatUTCDayOfMonth,
    "e": formatUTCDayOfMonth,
    "f": formatUTCMicroseconds,
    "g": formatUTCYearISO,
    "G": formatUTCFullYearISO,
    "H": formatUTCHour24,
    "I": formatUTCHour12,
    "j": formatUTCDayOfYear,
    "L": formatUTCMilliseconds,
    "m": formatUTCMonthNumber,
    "M": formatUTCMinutes,
    "p": formatUTCPeriod,
    "q": formatUTCQuarter,
    "Q": formatUnixTimestamp,
    "s": formatUnixTimestampSeconds,
    "S": formatUTCSeconds,
    "u": formatUTCWeekdayNumberMonday,
    "U": formatUTCWeekNumberSunday,
    "V": formatUTCWeekNumberISO,
    "w": formatUTCWeekdayNumberSunday,
    "W": formatUTCWeekNumberMonday,
    "x": null,
    "X": null,
    "y": formatUTCYear,
    "Y": formatUTCFullYear,
    "Z": formatUTCZone,
    "%": formatLiteralPercent
  };
  var parses = {
    "a": parseShortWeekday,
    "A": parseWeekday,
    "b": parseShortMonth,
    "B": parseMonth,
    "c": parseLocaleDateTime,
    "d": parseDayOfMonth,
    "e": parseDayOfMonth,
    "f": parseMicroseconds,
    "g": parseYear,
    "G": parseFullYear,
    "H": parseHour24,
    "I": parseHour24,
    "j": parseDayOfYear,
    "L": parseMilliseconds,
    "m": parseMonthNumber,
    "M": parseMinutes,
    "p": parsePeriod,
    "q": parseQuarter,
    "Q": parseUnixTimestamp,
    "s": parseUnixTimestampSeconds,
    "S": parseSeconds,
    "u": parseWeekdayNumberMonday,
    "U": parseWeekNumberSunday,
    "V": parseWeekNumberISO,
    "w": parseWeekdayNumberSunday,
    "W": parseWeekNumberMonday,
    "x": parseLocaleDate,
    "X": parseLocaleTime,
    "y": parseYear,
    "Y": parseFullYear,
    "Z": parseZone,
    "%": parseLiteralPercent
  };
  formats.x = newFormat(locale_date, formats);
  formats.X = newFormat(locale_time, formats);
  formats.c = newFormat(locale_dateTime, formats);
  utcFormats.x = newFormat(locale_date, utcFormats);
  utcFormats.X = newFormat(locale_time, utcFormats);
  utcFormats.c = newFormat(locale_dateTime, utcFormats);
  function newFormat(specifier, formats2) {
    return function(date2) {
      var string2 = [], i2 = -1, j2 = 0, n2 = specifier.length, c5, pad3, format3;
      if (!(date2 instanceof Date))
        date2 = /* @__PURE__ */ new Date(+date2);
      while (++i2 < n2) {
        if (specifier.charCodeAt(i2) === 37) {
          string2.push(specifier.slice(j2, i2));
          if ((pad3 = pads[c5 = specifier.charAt(++i2)]) != null)
            c5 = specifier.charAt(++i2);
          else
            pad3 = c5 === "e" ? " " : "0";
          if (format3 = formats2[c5])
            c5 = format3(date2, pad3);
          string2.push(c5);
          j2 = i2 + 1;
        }
      }
      string2.push(specifier.slice(j2, i2));
      return string2.join("");
    };
  }
  function newParse(specifier, Z3) {
    return function(string2) {
      var d2 = newDate(1900, void 0, 1), i2 = parseSpecifier(d2, specifier, string2 += "", 0), week, day;
      if (i2 != string2.length)
        return null;
      if ("Q" in d2)
        return new Date(d2.Q);
      if ("s" in d2)
        return new Date(d2.s * 1e3 + ("L" in d2 ? d2.L : 0));
      if (Z3 && !("Z" in d2))
        d2.Z = 0;
      if ("p" in d2)
        d2.H = d2.H % 12 + d2.p * 12;
      if (d2.m === void 0)
        d2.m = "q" in d2 ? d2.q : 0;
      if ("V" in d2) {
        if (d2.V < 1 || d2.V > 53)
          return null;
        if (!("w" in d2))
          d2.w = 1;
        if ("Z" in d2) {
          week = utcDate(newDate(d2.y, 0, 1)), day = week.getUTCDay();
          week = day > 4 || day === 0 ? utcMonday.ceil(week) : utcMonday(week);
          week = utcDay.offset(week, (d2.V - 1) * 7);
          d2.y = week.getUTCFullYear();
          d2.m = week.getUTCMonth();
          d2.d = week.getUTCDate() + (d2.w + 6) % 7;
        } else {
          week = localDate(newDate(d2.y, 0, 1)), day = week.getDay();
          week = day > 4 || day === 0 ? timeMonday.ceil(week) : timeMonday(week);
          week = timeDay.offset(week, (d2.V - 1) * 7);
          d2.y = week.getFullYear();
          d2.m = week.getMonth();
          d2.d = week.getDate() + (d2.w + 6) % 7;
        }
      } else if ("W" in d2 || "U" in d2) {
        if (!("w" in d2))
          d2.w = "u" in d2 ? d2.u % 7 : "W" in d2 ? 1 : 0;
        day = "Z" in d2 ? utcDate(newDate(d2.y, 0, 1)).getUTCDay() : localDate(newDate(d2.y, 0, 1)).getDay();
        d2.m = 0;
        d2.d = "W" in d2 ? (d2.w + 6) % 7 + d2.W * 7 - (day + 5) % 7 : d2.w + d2.U * 7 - (day + 6) % 7;
      }
      if ("Z" in d2) {
        d2.H += d2.Z / 100 | 0;
        d2.M += d2.Z % 100;
        return utcDate(d2);
      }
      return localDate(d2);
    };
  }
  function parseSpecifier(d2, specifier, string2, j2) {
    var i2 = 0, n2 = specifier.length, m = string2.length, c5, parse2;
    while (i2 < n2) {
      if (j2 >= m)
        return -1;
      c5 = specifier.charCodeAt(i2++);
      if (c5 === 37) {
        c5 = specifier.charAt(i2++);
        parse2 = parses[c5 in pads ? specifier.charAt(i2++) : c5];
        if (!parse2 || (j2 = parse2(d2, string2, j2)) < 0)
          return -1;
      } else if (c5 != string2.charCodeAt(j2++)) {
        return -1;
      }
    }
    return j2;
  }
  function parsePeriod(d2, string2, i2) {
    var n2 = periodRe.exec(string2.slice(i2));
    return n2 ? (d2.p = periodLookup.get(n2[0].toLowerCase()), i2 + n2[0].length) : -1;
  }
  function parseShortWeekday(d2, string2, i2) {
    var n2 = shortWeekdayRe.exec(string2.slice(i2));
    return n2 ? (d2.w = shortWeekdayLookup.get(n2[0].toLowerCase()), i2 + n2[0].length) : -1;
  }
  function parseWeekday(d2, string2, i2) {
    var n2 = weekdayRe.exec(string2.slice(i2));
    return n2 ? (d2.w = weekdayLookup.get(n2[0].toLowerCase()), i2 + n2[0].length) : -1;
  }
  function parseShortMonth(d2, string2, i2) {
    var n2 = shortMonthRe.exec(string2.slice(i2));
    return n2 ? (d2.m = shortMonthLookup.get(n2[0].toLowerCase()), i2 + n2[0].length) : -1;
  }
  function parseMonth(d2, string2, i2) {
    var n2 = monthRe.exec(string2.slice(i2));
    return n2 ? (d2.m = monthLookup.get(n2[0].toLowerCase()), i2 + n2[0].length) : -1;
  }
  function parseLocaleDateTime(d2, string2, i2) {
    return parseSpecifier(d2, locale_dateTime, string2, i2);
  }
  function parseLocaleDate(d2, string2, i2) {
    return parseSpecifier(d2, locale_date, string2, i2);
  }
  function parseLocaleTime(d2, string2, i2) {
    return parseSpecifier(d2, locale_time, string2, i2);
  }
  function formatShortWeekday(d2) {
    return locale_shortWeekdays[d2.getDay()];
  }
  function formatWeekday(d2) {
    return locale_weekdays[d2.getDay()];
  }
  function formatShortMonth(d2) {
    return locale_shortMonths[d2.getMonth()];
  }
  function formatMonth(d2) {
    return locale_months[d2.getMonth()];
  }
  function formatPeriod(d2) {
    return locale_periods[+(d2.getHours() >= 12)];
  }
  function formatQuarter(d2) {
    return 1 + ~~(d2.getMonth() / 3);
  }
  function formatUTCShortWeekday(d2) {
    return locale_shortWeekdays[d2.getUTCDay()];
  }
  function formatUTCWeekday(d2) {
    return locale_weekdays[d2.getUTCDay()];
  }
  function formatUTCShortMonth(d2) {
    return locale_shortMonths[d2.getUTCMonth()];
  }
  function formatUTCMonth(d2) {
    return locale_months[d2.getUTCMonth()];
  }
  function formatUTCPeriod(d2) {
    return locale_periods[+(d2.getUTCHours() >= 12)];
  }
  function formatUTCQuarter(d2) {
    return 1 + ~~(d2.getUTCMonth() / 3);
  }
  return {
    format: function(specifier) {
      var f2 = newFormat(specifier += "", formats);
      f2.toString = function() {
        return specifier;
      };
      return f2;
    },
    parse: function(specifier) {
      var p2 = newParse(specifier += "", false);
      p2.toString = function() {
        return specifier;
      };
      return p2;
    },
    utcFormat: function(specifier) {
      var f2 = newFormat(specifier += "", utcFormats);
      f2.toString = function() {
        return specifier;
      };
      return f2;
    },
    utcParse: function(specifier) {
      var p2 = newParse(specifier += "", true);
      p2.toString = function() {
        return specifier;
      };
      return p2;
    }
  };
}
var pads = { "-": "", "_": " ", "0": "0" };
var numberRe = /^\s*\d+/;
var percentRe = /^%/;
var requoteRe = /[\\^$*+?|[\]().{}]/g;
function pad(value, fill, width) {
  var sign3 = value < 0 ? "-" : "", string2 = (sign3 ? -value : value) + "", length3 = string2.length;
  return sign3 + (length3 < width ? new Array(width - length3 + 1).join(fill) + string2 : string2);
}
function requote(s3) {
  return s3.replace(requoteRe, "\\$&");
}
function formatRe(names) {
  return new RegExp("^(?:" + names.map(requote).join("|") + ")", "i");
}
function formatLookup(names) {
  return new Map(names.map((name, i2) => [name.toLowerCase(), i2]));
}
function parseWeekdayNumberSunday(d2, string2, i2) {
  var n2 = numberRe.exec(string2.slice(i2, i2 + 1));
  return n2 ? (d2.w = +n2[0], i2 + n2[0].length) : -1;
}
function parseWeekdayNumberMonday(d2, string2, i2) {
  var n2 = numberRe.exec(string2.slice(i2, i2 + 1));
  return n2 ? (d2.u = +n2[0], i2 + n2[0].length) : -1;
}
function parseWeekNumberSunday(d2, string2, i2) {
  var n2 = numberRe.exec(string2.slice(i2, i2 + 2));
  return n2 ? (d2.U = +n2[0], i2 + n2[0].length) : -1;
}
function parseWeekNumberISO(d2, string2, i2) {
  var n2 = numberRe.exec(string2.slice(i2, i2 + 2));
  return n2 ? (d2.V = +n2[0], i2 + n2[0].length) : -1;
}
function parseWeekNumberMonday(d2, string2, i2) {
  var n2 = numberRe.exec(string2.slice(i2, i2 + 2));
  return n2 ? (d2.W = +n2[0], i2 + n2[0].length) : -1;
}
function parseFullYear(d2, string2, i2) {
  var n2 = numberRe.exec(string2.slice(i2, i2 + 4));
  return n2 ? (d2.y = +n2[0], i2 + n2[0].length) : -1;
}
function parseYear(d2, string2, i2) {
  var n2 = numberRe.exec(string2.slice(i2, i2 + 2));
  return n2 ? (d2.y = +n2[0] + (+n2[0] > 68 ? 1900 : 2e3), i2 + n2[0].length) : -1;
}
function parseZone(d2, string2, i2) {
  var n2 = /^(Z)|([+-]\d\d)(?::?(\d\d))?/.exec(string2.slice(i2, i2 + 6));
  return n2 ? (d2.Z = n2[1] ? 0 : -(n2[2] + (n2[3] || "00")), i2 + n2[0].length) : -1;
}
function parseQuarter(d2, string2, i2) {
  var n2 = numberRe.exec(string2.slice(i2, i2 + 1));
  return n2 ? (d2.q = n2[0] * 3 - 3, i2 + n2[0].length) : -1;
}
function parseMonthNumber(d2, string2, i2) {
  var n2 = numberRe.exec(string2.slice(i2, i2 + 2));
  return n2 ? (d2.m = n2[0] - 1, i2 + n2[0].length) : -1;
}
function parseDayOfMonth(d2, string2, i2) {
  var n2 = numberRe.exec(string2.slice(i2, i2 + 2));
  return n2 ? (d2.d = +n2[0], i2 + n2[0].length) : -1;
}
function parseDayOfYear(d2, string2, i2) {
  var n2 = numberRe.exec(string2.slice(i2, i2 + 3));
  return n2 ? (d2.m = 0, d2.d = +n2[0], i2 + n2[0].length) : -1;
}
function parseHour24(d2, string2, i2) {
  var n2 = numberRe.exec(string2.slice(i2, i2 + 2));
  return n2 ? (d2.H = +n2[0], i2 + n2[0].length) : -1;
}
function parseMinutes(d2, string2, i2) {
  var n2 = numberRe.exec(string2.slice(i2, i2 + 2));
  return n2 ? (d2.M = +n2[0], i2 + n2[0].length) : -1;
}
function parseSeconds(d2, string2, i2) {
  var n2 = numberRe.exec(string2.slice(i2, i2 + 2));
  return n2 ? (d2.S = +n2[0], i2 + n2[0].length) : -1;
}
function parseMilliseconds(d2, string2, i2) {
  var n2 = numberRe.exec(string2.slice(i2, i2 + 3));
  return n2 ? (d2.L = +n2[0], i2 + n2[0].length) : -1;
}
function parseMicroseconds(d2, string2, i2) {
  var n2 = numberRe.exec(string2.slice(i2, i2 + 6));
  return n2 ? (d2.L = Math.floor(n2[0] / 1e3), i2 + n2[0].length) : -1;
}
function parseLiteralPercent(d2, string2, i2) {
  var n2 = percentRe.exec(string2.slice(i2, i2 + 1));
  return n2 ? i2 + n2[0].length : -1;
}
function parseUnixTimestamp(d2, string2, i2) {
  var n2 = numberRe.exec(string2.slice(i2));
  return n2 ? (d2.Q = +n2[0], i2 + n2[0].length) : -1;
}
function parseUnixTimestampSeconds(d2, string2, i2) {
  var n2 = numberRe.exec(string2.slice(i2));
  return n2 ? (d2.s = +n2[0], i2 + n2[0].length) : -1;
}
function formatDayOfMonth(d2, p2) {
  return pad(d2.getDate(), p2, 2);
}
function formatHour24(d2, p2) {
  return pad(d2.getHours(), p2, 2);
}
function formatHour12(d2, p2) {
  return pad(d2.getHours() % 12 || 12, p2, 2);
}
function formatDayOfYear(d2, p2) {
  return pad(1 + timeDay.count(timeYear(d2), d2), p2, 3);
}
function formatMilliseconds(d2, p2) {
  return pad(d2.getMilliseconds(), p2, 3);
}
function formatMicroseconds(d2, p2) {
  return formatMilliseconds(d2, p2) + "000";
}
function formatMonthNumber(d2, p2) {
  return pad(d2.getMonth() + 1, p2, 2);
}
function formatMinutes(d2, p2) {
  return pad(d2.getMinutes(), p2, 2);
}
function formatSeconds(d2, p2) {
  return pad(d2.getSeconds(), p2, 2);
}
function formatWeekdayNumberMonday(d2) {
  var day = d2.getDay();
  return day === 0 ? 7 : day;
}
function formatWeekNumberSunday(d2, p2) {
  return pad(timeSunday.count(timeYear(d2) - 1, d2), p2, 2);
}
function dISO(d2) {
  var day = d2.getDay();
  return day >= 4 || day === 0 ? timeThursday(d2) : timeThursday.ceil(d2);
}
function formatWeekNumberISO(d2, p2) {
  d2 = dISO(d2);
  return pad(timeThursday.count(timeYear(d2), d2) + (timeYear(d2).getDay() === 4), p2, 2);
}
function formatWeekdayNumberSunday(d2) {
  return d2.getDay();
}
function formatWeekNumberMonday(d2, p2) {
  return pad(timeMonday.count(timeYear(d2) - 1, d2), p2, 2);
}
function formatYear(d2, p2) {
  return pad(d2.getFullYear() % 100, p2, 2);
}
function formatYearISO(d2, p2) {
  d2 = dISO(d2);
  return pad(d2.getFullYear() % 100, p2, 2);
}
function formatFullYear(d2, p2) {
  return pad(d2.getFullYear() % 1e4, p2, 4);
}
function formatFullYearISO(d2, p2) {
  var day = d2.getDay();
  d2 = day >= 4 || day === 0 ? timeThursday(d2) : timeThursday.ceil(d2);
  return pad(d2.getFullYear() % 1e4, p2, 4);
}
function formatZone(d2) {
  var z2 = d2.getTimezoneOffset();
  return (z2 > 0 ? "-" : (z2 *= -1, "+")) + pad(z2 / 60 | 0, "0", 2) + pad(z2 % 60, "0", 2);
}
function formatUTCDayOfMonth(d2, p2) {
  return pad(d2.getUTCDate(), p2, 2);
}
function formatUTCHour24(d2, p2) {
  return pad(d2.getUTCHours(), p2, 2);
}
function formatUTCHour12(d2, p2) {
  return pad(d2.getUTCHours() % 12 || 12, p2, 2);
}
function formatUTCDayOfYear(d2, p2) {
  return pad(1 + utcDay.count(utcYear(d2), d2), p2, 3);
}
function formatUTCMilliseconds(d2, p2) {
  return pad(d2.getUTCMilliseconds(), p2, 3);
}
function formatUTCMicroseconds(d2, p2) {
  return formatUTCMilliseconds(d2, p2) + "000";
}
function formatUTCMonthNumber(d2, p2) {
  return pad(d2.getUTCMonth() + 1, p2, 2);
}
function formatUTCMinutes(d2, p2) {
  return pad(d2.getUTCMinutes(), p2, 2);
}
function formatUTCSeconds(d2, p2) {
  return pad(d2.getUTCSeconds(), p2, 2);
}
function formatUTCWeekdayNumberMonday(d2) {
  var dow = d2.getUTCDay();
  return dow === 0 ? 7 : dow;
}
function formatUTCWeekNumberSunday(d2, p2) {
  return pad(utcSunday.count(utcYear(d2) - 1, d2), p2, 2);
}
function UTCdISO(d2) {
  var day = d2.getUTCDay();
  return day >= 4 || day === 0 ? utcThursday(d2) : utcThursday.ceil(d2);
}
function formatUTCWeekNumberISO(d2, p2) {
  d2 = UTCdISO(d2);
  return pad(utcThursday.count(utcYear(d2), d2) + (utcYear(d2).getUTCDay() === 4), p2, 2);
}
function formatUTCWeekdayNumberSunday(d2) {
  return d2.getUTCDay();
}
function formatUTCWeekNumberMonday(d2, p2) {
  return pad(utcMonday.count(utcYear(d2) - 1, d2), p2, 2);
}
function formatUTCYear(d2, p2) {
  return pad(d2.getUTCFullYear() % 100, p2, 2);
}
function formatUTCYearISO(d2, p2) {
  d2 = UTCdISO(d2);
  return pad(d2.getUTCFullYear() % 100, p2, 2);
}
function formatUTCFullYear(d2, p2) {
  return pad(d2.getUTCFullYear() % 1e4, p2, 4);
}
function formatUTCFullYearISO(d2, p2) {
  var day = d2.getUTCDay();
  d2 = day >= 4 || day === 0 ? utcThursday(d2) : utcThursday.ceil(d2);
  return pad(d2.getUTCFullYear() % 1e4, p2, 4);
}
function formatUTCZone() {
  return "+0000";
}
function formatLiteralPercent() {
  return "%";
}
function formatUnixTimestamp(d2) {
  return +d2;
}
function formatUnixTimestampSeconds(d2) {
  return Math.floor(+d2 / 1e3);
}

// ../../node_modules/d3-time-format/src/defaultLocale.js
var locale2;
var timeFormat;
var timeParse;
var utcFormat;
var utcParse;
defaultLocale2({
  dateTime: "%x, %X",
  date: "%-m/%-d/%Y",
  time: "%-I:%M:%S %p",
  periods: ["AM", "PM"],
  days: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  shortDays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  shortMonths: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
});
function defaultLocale2(definition) {
  locale2 = formatLocale(definition);
  timeFormat = locale2.format;
  timeParse = locale2.parse;
  utcFormat = locale2.utcFormat;
  utcParse = locale2.utcParse;
  return locale2;
}

// ../../node_modules/d3-scale/src/time.js
function date(t5) {
  return new Date(t5);
}
function number4(t5) {
  return t5 instanceof Date ? +t5 : +/* @__PURE__ */ new Date(+t5);
}
function calendar(ticks2, tickInterval, year, month, week, day, hour, minute, second3, format3) {
  var scale = continuous(), invert = scale.invert, domain = scale.domain;
  var formatMillisecond = format3(".%L"), formatSecond = format3(":%S"), formatMinute = format3("%I:%M"), formatHour = format3("%I %p"), formatDay = format3("%a %d"), formatWeek = format3("%b %d"), formatMonth = format3("%B"), formatYear3 = format3("%Y");
  function tickFormat2(date2) {
    return (second3(date2) < date2 ? formatMillisecond : minute(date2) < date2 ? formatSecond : hour(date2) < date2 ? formatMinute : day(date2) < date2 ? formatHour : month(date2) < date2 ? week(date2) < date2 ? formatDay : formatWeek : year(date2) < date2 ? formatMonth : formatYear3)(date2);
  }
  scale.invert = function(y3) {
    return new Date(invert(y3));
  };
  scale.domain = function(_24) {
    return arguments.length ? domain(Array.from(_24, number4)) : domain().map(date);
  };
  scale.ticks = function(interval2) {
    var d2 = domain();
    return ticks2(d2[0], d2[d2.length - 1], interval2 == null ? 10 : interval2);
  };
  scale.tickFormat = function(count2, specifier) {
    return specifier == null ? tickFormat2 : format3(specifier);
  };
  scale.nice = function(interval2) {
    var d2 = domain();
    if (!interval2 || typeof interval2.range !== "function")
      interval2 = tickInterval(d2[0], d2[d2.length - 1], interval2 == null ? 10 : interval2);
    return interval2 ? domain(nice(d2, interval2)) : scale;
  };
  scale.copy = function() {
    return copy(scale, calendar(ticks2, tickInterval, year, month, week, day, hour, minute, second3, format3));
  };
  return scale;
}
function time() {
  return initRange.apply(calendar(timeTicks, timeTickInterval, timeYear, timeMonth, timeSunday, timeDay, timeHour, timeMinute, second, timeFormat).domain([new Date(2e3, 0, 1), new Date(2e3, 0, 2)]), arguments);
}

// ../../node_modules/d3-scale/src/utcTime.js
function utcTime() {
  return initRange.apply(calendar(utcTicks, utcTickInterval, utcYear, utcMonth, utcSunday, utcDay, utcHour, utcMinute, second, utcFormat).domain([Date.UTC(2e3, 0, 1), Date.UTC(2e3, 0, 2)]), arguments);
}

// ../../node_modules/d3-scale/src/sequential.js
function copy2(source, target) {
  return target.domain(source.domain()).interpolator(source.interpolator()).clamp(source.clamp()).unknown(source.unknown());
}

// ../../node_modules/d3-scale/src/diverging.js
function transformer3() {
  var x05 = 0, x12 = 0.5, x22 = 1, s3 = 1, t03, t13, t22, k10, k21, interpolator = identity3, transform2, clamp = false, unknown;
  function scale(x3) {
    return isNaN(x3 = +x3) ? unknown : (x3 = 0.5 + ((x3 = +transform2(x3)) - t13) * (s3 * x3 < s3 * t13 ? k10 : k21), interpolator(clamp ? Math.max(0, Math.min(1, x3)) : x3));
  }
  scale.domain = function(_24) {
    return arguments.length ? ([x05, x12, x22] = _24, t03 = transform2(x05 = +x05), t13 = transform2(x12 = +x12), t22 = transform2(x22 = +x22), k10 = t03 === t13 ? 0 : 0.5 / (t13 - t03), k21 = t13 === t22 ? 0 : 0.5 / (t22 - t13), s3 = t13 < t03 ? -1 : 1, scale) : [x05, x12, x22];
  };
  scale.clamp = function(_24) {
    return arguments.length ? (clamp = !!_24, scale) : clamp;
  };
  scale.interpolator = function(_24) {
    return arguments.length ? (interpolator = _24, scale) : interpolator;
  };
  function range3(interpolate) {
    return function(_24) {
      var r0, r1, r2;
      return arguments.length ? ([r0, r1, r2] = _24, interpolator = piecewise(interpolate, [r0, r1, r2]), scale) : [interpolator(0), interpolator(0.5), interpolator(1)];
    };
  }
  scale.range = range3(value_default);
  scale.rangeRound = range3(round_default);
  scale.unknown = function(_24) {
    return arguments.length ? (unknown = _24, scale) : unknown;
  };
  return function(t5) {
    transform2 = t5, t03 = t5(x05), t13 = t5(x12), t22 = t5(x22), k10 = t03 === t13 ? 0 : 0.5 / (t13 - t03), k21 = t13 === t22 ? 0 : 0.5 / (t22 - t13), s3 = t13 < t03 ? -1 : 1;
    return scale;
  };
}
function diverging() {
  var scale = linearish(transformer3()(identity3));
  scale.copy = function() {
    return copy2(scale, diverging());
  };
  return initInterpolator.apply(scale, arguments);
}
function divergingLog() {
  var scale = loggish(transformer3()).domain([0.1, 1, 10]);
  scale.copy = function() {
    return copy2(scale, divergingLog()).base(scale.base());
  };
  return initInterpolator.apply(scale, arguments);
}
function divergingSymlog() {
  var scale = symlogish(transformer3());
  scale.copy = function() {
    return copy2(scale, divergingSymlog()).constant(scale.constant());
  };
  return initInterpolator.apply(scale, arguments);
}
function divergingPow() {
  var scale = powish(transformer3());
  scale.copy = function() {
    return copy2(scale, divergingPow()).exponent(scale.exponent());
  };
  return initInterpolator.apply(scale, arguments);
}

// ../../node_modules/d3-scale-chromatic/src/colors.js
function colors_default(specifier) {
  var n2 = specifier.length / 6 | 0, colors = new Array(n2), i2 = 0;
  while (i2 < n2)
    colors[i2] = "#" + specifier.slice(i2 * 6, ++i2 * 6);
  return colors;
}

// ../../node_modules/d3-scale-chromatic/src/categorical/category10.js
var category10_default = colors_default("1f77b4ff7f0e2ca02cd627289467bd8c564be377c27f7f7fbcbd2217becf");

// ../../node_modules/d3-scale-chromatic/src/categorical/Accent.js
var Accent_default = colors_default("7fc97fbeaed4fdc086ffff99386cb0f0027fbf5b17666666");

// ../../node_modules/d3-scale-chromatic/src/categorical/Dark2.js
var Dark2_default = colors_default("1b9e77d95f027570b3e7298a66a61ee6ab02a6761d666666");

// ../../node_modules/d3-scale-chromatic/src/categorical/observable10.js
var observable10_default = colors_default("4269d0efb118ff725c6cc5b03ca951ff8ab7a463f297bbf59c6b4e9498a0");

// ../../node_modules/d3-scale-chromatic/src/categorical/Paired.js
var Paired_default = colors_default("a6cee31f78b4b2df8a33a02cfb9a99e31a1cfdbf6fff7f00cab2d66a3d9affff99b15928");

// ../../node_modules/d3-scale-chromatic/src/categorical/Pastel1.js
var Pastel1_default = colors_default("fbb4aeb3cde3ccebc5decbe4fed9a6ffffcce5d8bdfddaecf2f2f2");

// ../../node_modules/d3-scale-chromatic/src/categorical/Pastel2.js
var Pastel2_default = colors_default("b3e2cdfdcdaccbd5e8f4cae4e6f5c9fff2aef1e2cccccccc");

// ../../node_modules/d3-scale-chromatic/src/categorical/Set1.js
var Set1_default = colors_default("e41a1c377eb84daf4a984ea3ff7f00ffff33a65628f781bf999999");

// ../../node_modules/d3-scale-chromatic/src/categorical/Set2.js
var Set2_default = colors_default("66c2a5fc8d628da0cbe78ac3a6d854ffd92fe5c494b3b3b3");

// ../../node_modules/d3-scale-chromatic/src/categorical/Set3.js
var Set3_default = colors_default("8dd3c7ffffb3bebadafb807280b1d3fdb462b3de69fccde5d9d9d9bc80bdccebc5ffed6f");

// ../../node_modules/d3-scale-chromatic/src/categorical/Tableau10.js
var Tableau10_default = colors_default("4e79a7f28e2ce1575976b7b259a14fedc949af7aa1ff9da79c755fbab0ab");

// ../../node_modules/d3-scale-chromatic/src/ramp.js
var ramp_default = (scheme28) => rgbBasis(scheme28[scheme28.length - 1]);

// ../../node_modules/d3-scale-chromatic/src/diverging/BrBG.js
var scheme = new Array(3).concat(
  "d8b365f5f5f55ab4ac",
  "a6611adfc27d80cdc1018571",
  "a6611adfc27df5f5f580cdc1018571",
  "8c510ad8b365f6e8c3c7eae55ab4ac01665e",
  "8c510ad8b365f6e8c3f5f5f5c7eae55ab4ac01665e",
  "8c510abf812ddfc27df6e8c3c7eae580cdc135978f01665e",
  "8c510abf812ddfc27df6e8c3f5f5f5c7eae580cdc135978f01665e",
  "5430058c510abf812ddfc27df6e8c3c7eae580cdc135978f01665e003c30",
  "5430058c510abf812ddfc27df6e8c3f5f5f5c7eae580cdc135978f01665e003c30"
).map(colors_default);
var BrBG_default = ramp_default(scheme);

// ../../node_modules/d3-scale-chromatic/src/diverging/PRGn.js
var scheme2 = new Array(3).concat(
  "af8dc3f7f7f77fbf7b",
  "7b3294c2a5cfa6dba0008837",
  "7b3294c2a5cff7f7f7a6dba0008837",
  "762a83af8dc3e7d4e8d9f0d37fbf7b1b7837",
  "762a83af8dc3e7d4e8f7f7f7d9f0d37fbf7b1b7837",
  "762a839970abc2a5cfe7d4e8d9f0d3a6dba05aae611b7837",
  "762a839970abc2a5cfe7d4e8f7f7f7d9f0d3a6dba05aae611b7837",
  "40004b762a839970abc2a5cfe7d4e8d9f0d3a6dba05aae611b783700441b",
  "40004b762a839970abc2a5cfe7d4e8f7f7f7d9f0d3a6dba05aae611b783700441b"
).map(colors_default);
var PRGn_default = ramp_default(scheme2);

// ../../node_modules/d3-scale-chromatic/src/diverging/PiYG.js
var scheme3 = new Array(3).concat(
  "e9a3c9f7f7f7a1d76a",
  "d01c8bf1b6dab8e1864dac26",
  "d01c8bf1b6daf7f7f7b8e1864dac26",
  "c51b7de9a3c9fde0efe6f5d0a1d76a4d9221",
  "c51b7de9a3c9fde0eff7f7f7e6f5d0a1d76a4d9221",
  "c51b7dde77aef1b6dafde0efe6f5d0b8e1867fbc414d9221",
  "c51b7dde77aef1b6dafde0eff7f7f7e6f5d0b8e1867fbc414d9221",
  "8e0152c51b7dde77aef1b6dafde0efe6f5d0b8e1867fbc414d9221276419",
  "8e0152c51b7dde77aef1b6dafde0eff7f7f7e6f5d0b8e1867fbc414d9221276419"
).map(colors_default);
var PiYG_default = ramp_default(scheme3);

// ../../node_modules/d3-scale-chromatic/src/diverging/PuOr.js
var scheme4 = new Array(3).concat(
  "998ec3f7f7f7f1a340",
  "5e3c99b2abd2fdb863e66101",
  "5e3c99b2abd2f7f7f7fdb863e66101",
  "542788998ec3d8daebfee0b6f1a340b35806",
  "542788998ec3d8daebf7f7f7fee0b6f1a340b35806",
  "5427888073acb2abd2d8daebfee0b6fdb863e08214b35806",
  "5427888073acb2abd2d8daebf7f7f7fee0b6fdb863e08214b35806",
  "2d004b5427888073acb2abd2d8daebfee0b6fdb863e08214b358067f3b08",
  "2d004b5427888073acb2abd2d8daebf7f7f7fee0b6fdb863e08214b358067f3b08"
).map(colors_default);
var PuOr_default = ramp_default(scheme4);

// ../../node_modules/d3-scale-chromatic/src/diverging/RdBu.js
var scheme5 = new Array(3).concat(
  "ef8a62f7f7f767a9cf",
  "ca0020f4a58292c5de0571b0",
  "ca0020f4a582f7f7f792c5de0571b0",
  "b2182bef8a62fddbc7d1e5f067a9cf2166ac",
  "b2182bef8a62fddbc7f7f7f7d1e5f067a9cf2166ac",
  "b2182bd6604df4a582fddbc7d1e5f092c5de4393c32166ac",
  "b2182bd6604df4a582fddbc7f7f7f7d1e5f092c5de4393c32166ac",
  "67001fb2182bd6604df4a582fddbc7d1e5f092c5de4393c32166ac053061",
  "67001fb2182bd6604df4a582fddbc7f7f7f7d1e5f092c5de4393c32166ac053061"
).map(colors_default);
var RdBu_default = ramp_default(scheme5);

// ../../node_modules/d3-scale-chromatic/src/diverging/RdGy.js
var scheme6 = new Array(3).concat(
  "ef8a62ffffff999999",
  "ca0020f4a582bababa404040",
  "ca0020f4a582ffffffbababa404040",
  "b2182bef8a62fddbc7e0e0e09999994d4d4d",
  "b2182bef8a62fddbc7ffffffe0e0e09999994d4d4d",
  "b2182bd6604df4a582fddbc7e0e0e0bababa8787874d4d4d",
  "b2182bd6604df4a582fddbc7ffffffe0e0e0bababa8787874d4d4d",
  "67001fb2182bd6604df4a582fddbc7e0e0e0bababa8787874d4d4d1a1a1a",
  "67001fb2182bd6604df4a582fddbc7ffffffe0e0e0bababa8787874d4d4d1a1a1a"
).map(colors_default);
var RdGy_default = ramp_default(scheme6);

// ../../node_modules/d3-scale-chromatic/src/diverging/RdYlBu.js
var scheme7 = new Array(3).concat(
  "fc8d59ffffbf91bfdb",
  "d7191cfdae61abd9e92c7bb6",
  "d7191cfdae61ffffbfabd9e92c7bb6",
  "d73027fc8d59fee090e0f3f891bfdb4575b4",
  "d73027fc8d59fee090ffffbfe0f3f891bfdb4575b4",
  "d73027f46d43fdae61fee090e0f3f8abd9e974add14575b4",
  "d73027f46d43fdae61fee090ffffbfe0f3f8abd9e974add14575b4",
  "a50026d73027f46d43fdae61fee090e0f3f8abd9e974add14575b4313695",
  "a50026d73027f46d43fdae61fee090ffffbfe0f3f8abd9e974add14575b4313695"
).map(colors_default);
var RdYlBu_default = ramp_default(scheme7);

// ../../node_modules/d3-scale-chromatic/src/diverging/RdYlGn.js
var scheme8 = new Array(3).concat(
  "fc8d59ffffbf91cf60",
  "d7191cfdae61a6d96a1a9641",
  "d7191cfdae61ffffbfa6d96a1a9641",
  "d73027fc8d59fee08bd9ef8b91cf601a9850",
  "d73027fc8d59fee08bffffbfd9ef8b91cf601a9850",
  "d73027f46d43fdae61fee08bd9ef8ba6d96a66bd631a9850",
  "d73027f46d43fdae61fee08bffffbfd9ef8ba6d96a66bd631a9850",
  "a50026d73027f46d43fdae61fee08bd9ef8ba6d96a66bd631a9850006837",
  "a50026d73027f46d43fdae61fee08bffffbfd9ef8ba6d96a66bd631a9850006837"
).map(colors_default);
var RdYlGn_default = ramp_default(scheme8);

// ../../node_modules/d3-scale-chromatic/src/diverging/Spectral.js
var scheme9 = new Array(3).concat(
  "fc8d59ffffbf99d594",
  "d7191cfdae61abdda42b83ba",
  "d7191cfdae61ffffbfabdda42b83ba",
  "d53e4ffc8d59fee08be6f59899d5943288bd",
  "d53e4ffc8d59fee08bffffbfe6f59899d5943288bd",
  "d53e4ff46d43fdae61fee08be6f598abdda466c2a53288bd",
  "d53e4ff46d43fdae61fee08bffffbfe6f598abdda466c2a53288bd",
  "9e0142d53e4ff46d43fdae61fee08be6f598abdda466c2a53288bd5e4fa2",
  "9e0142d53e4ff46d43fdae61fee08bffffbfe6f598abdda466c2a53288bd5e4fa2"
).map(colors_default);
var Spectral_default = ramp_default(scheme9);

// ../../node_modules/d3-scale-chromatic/src/sequential-multi/BuGn.js
var scheme10 = new Array(3).concat(
  "e5f5f999d8c92ca25f",
  "edf8fbb2e2e266c2a4238b45",
  "edf8fbb2e2e266c2a42ca25f006d2c",
  "edf8fbccece699d8c966c2a42ca25f006d2c",
  "edf8fbccece699d8c966c2a441ae76238b45005824",
  "f7fcfde5f5f9ccece699d8c966c2a441ae76238b45005824",
  "f7fcfde5f5f9ccece699d8c966c2a441ae76238b45006d2c00441b"
).map(colors_default);
var BuGn_default = ramp_default(scheme10);

// ../../node_modules/d3-scale-chromatic/src/sequential-multi/BuPu.js
var scheme11 = new Array(3).concat(
  "e0ecf49ebcda8856a7",
  "edf8fbb3cde38c96c688419d",
  "edf8fbb3cde38c96c68856a7810f7c",
  "edf8fbbfd3e69ebcda8c96c68856a7810f7c",
  "edf8fbbfd3e69ebcda8c96c68c6bb188419d6e016b",
  "f7fcfde0ecf4bfd3e69ebcda8c96c68c6bb188419d6e016b",
  "f7fcfde0ecf4bfd3e69ebcda8c96c68c6bb188419d810f7c4d004b"
).map(colors_default);
var BuPu_default = ramp_default(scheme11);

// ../../node_modules/d3-scale-chromatic/src/sequential-multi/GnBu.js
var scheme12 = new Array(3).concat(
  "e0f3dba8ddb543a2ca",
  "f0f9e8bae4bc7bccc42b8cbe",
  "f0f9e8bae4bc7bccc443a2ca0868ac",
  "f0f9e8ccebc5a8ddb57bccc443a2ca0868ac",
  "f0f9e8ccebc5a8ddb57bccc44eb3d32b8cbe08589e",
  "f7fcf0e0f3dbccebc5a8ddb57bccc44eb3d32b8cbe08589e",
  "f7fcf0e0f3dbccebc5a8ddb57bccc44eb3d32b8cbe0868ac084081"
).map(colors_default);
var GnBu_default = ramp_default(scheme12);

// ../../node_modules/d3-scale-chromatic/src/sequential-multi/OrRd.js
var scheme13 = new Array(3).concat(
  "fee8c8fdbb84e34a33",
  "fef0d9fdcc8afc8d59d7301f",
  "fef0d9fdcc8afc8d59e34a33b30000",
  "fef0d9fdd49efdbb84fc8d59e34a33b30000",
  "fef0d9fdd49efdbb84fc8d59ef6548d7301f990000",
  "fff7ecfee8c8fdd49efdbb84fc8d59ef6548d7301f990000",
  "fff7ecfee8c8fdd49efdbb84fc8d59ef6548d7301fb300007f0000"
).map(colors_default);
var OrRd_default = ramp_default(scheme13);

// ../../node_modules/d3-scale-chromatic/src/sequential-multi/PuBuGn.js
var scheme14 = new Array(3).concat(
  "ece2f0a6bddb1c9099",
  "f6eff7bdc9e167a9cf02818a",
  "f6eff7bdc9e167a9cf1c9099016c59",
  "f6eff7d0d1e6a6bddb67a9cf1c9099016c59",
  "f6eff7d0d1e6a6bddb67a9cf3690c002818a016450",
  "fff7fbece2f0d0d1e6a6bddb67a9cf3690c002818a016450",
  "fff7fbece2f0d0d1e6a6bddb67a9cf3690c002818a016c59014636"
).map(colors_default);
var PuBuGn_default = ramp_default(scheme14);

// ../../node_modules/d3-scale-chromatic/src/sequential-multi/PuBu.js
var scheme15 = new Array(3).concat(
  "ece7f2a6bddb2b8cbe",
  "f1eef6bdc9e174a9cf0570b0",
  "f1eef6bdc9e174a9cf2b8cbe045a8d",
  "f1eef6d0d1e6a6bddb74a9cf2b8cbe045a8d",
  "f1eef6d0d1e6a6bddb74a9cf3690c00570b0034e7b",
  "fff7fbece7f2d0d1e6a6bddb74a9cf3690c00570b0034e7b",
  "fff7fbece7f2d0d1e6a6bddb74a9cf3690c00570b0045a8d023858"
).map(colors_default);
var PuBu_default = ramp_default(scheme15);

// ../../node_modules/d3-scale-chromatic/src/sequential-multi/PuRd.js
var scheme16 = new Array(3).concat(
  "e7e1efc994c7dd1c77",
  "f1eef6d7b5d8df65b0ce1256",
  "f1eef6d7b5d8df65b0dd1c77980043",
  "f1eef6d4b9dac994c7df65b0dd1c77980043",
  "f1eef6d4b9dac994c7df65b0e7298ace125691003f",
  "f7f4f9e7e1efd4b9dac994c7df65b0e7298ace125691003f",
  "f7f4f9e7e1efd4b9dac994c7df65b0e7298ace125698004367001f"
).map(colors_default);
var PuRd_default = ramp_default(scheme16);

// ../../node_modules/d3-scale-chromatic/src/sequential-multi/RdPu.js
var scheme17 = new Array(3).concat(
  "fde0ddfa9fb5c51b8a",
  "feebe2fbb4b9f768a1ae017e",
  "feebe2fbb4b9f768a1c51b8a7a0177",
  "feebe2fcc5c0fa9fb5f768a1c51b8a7a0177",
  "feebe2fcc5c0fa9fb5f768a1dd3497ae017e7a0177",
  "fff7f3fde0ddfcc5c0fa9fb5f768a1dd3497ae017e7a0177",
  "fff7f3fde0ddfcc5c0fa9fb5f768a1dd3497ae017e7a017749006a"
).map(colors_default);
var RdPu_default = ramp_default(scheme17);

// ../../node_modules/d3-scale-chromatic/src/sequential-multi/YlGnBu.js
var scheme18 = new Array(3).concat(
  "edf8b17fcdbb2c7fb8",
  "ffffcca1dab441b6c4225ea8",
  "ffffcca1dab441b6c42c7fb8253494",
  "ffffccc7e9b47fcdbb41b6c42c7fb8253494",
  "ffffccc7e9b47fcdbb41b6c41d91c0225ea80c2c84",
  "ffffd9edf8b1c7e9b47fcdbb41b6c41d91c0225ea80c2c84",
  "ffffd9edf8b1c7e9b47fcdbb41b6c41d91c0225ea8253494081d58"
).map(colors_default);
var YlGnBu_default = ramp_default(scheme18);

// ../../node_modules/d3-scale-chromatic/src/sequential-multi/YlGn.js
var scheme19 = new Array(3).concat(
  "f7fcb9addd8e31a354",
  "ffffccc2e69978c679238443",
  "ffffccc2e69978c67931a354006837",
  "ffffccd9f0a3addd8e78c67931a354006837",
  "ffffccd9f0a3addd8e78c67941ab5d238443005a32",
  "ffffe5f7fcb9d9f0a3addd8e78c67941ab5d238443005a32",
  "ffffe5f7fcb9d9f0a3addd8e78c67941ab5d238443006837004529"
).map(colors_default);
var YlGn_default = ramp_default(scheme19);

// ../../node_modules/d3-scale-chromatic/src/sequential-multi/YlOrBr.js
var scheme20 = new Array(3).concat(
  "fff7bcfec44fd95f0e",
  "ffffd4fed98efe9929cc4c02",
  "ffffd4fed98efe9929d95f0e993404",
  "ffffd4fee391fec44ffe9929d95f0e993404",
  "ffffd4fee391fec44ffe9929ec7014cc4c028c2d04",
  "ffffe5fff7bcfee391fec44ffe9929ec7014cc4c028c2d04",
  "ffffe5fff7bcfee391fec44ffe9929ec7014cc4c02993404662506"
).map(colors_default);
var YlOrBr_default = ramp_default(scheme20);

// ../../node_modules/d3-scale-chromatic/src/sequential-multi/YlOrRd.js
var scheme21 = new Array(3).concat(
  "ffeda0feb24cf03b20",
  "ffffb2fecc5cfd8d3ce31a1c",
  "ffffb2fecc5cfd8d3cf03b20bd0026",
  "ffffb2fed976feb24cfd8d3cf03b20bd0026",
  "ffffb2fed976feb24cfd8d3cfc4e2ae31a1cb10026",
  "ffffccffeda0fed976feb24cfd8d3cfc4e2ae31a1cb10026",
  "ffffccffeda0fed976feb24cfd8d3cfc4e2ae31a1cbd0026800026"
).map(colors_default);
var YlOrRd_default = ramp_default(scheme21);

// ../../node_modules/d3-scale-chromatic/src/sequential-single/Blues.js
var scheme22 = new Array(3).concat(
  "deebf79ecae13182bd",
  "eff3ffbdd7e76baed62171b5",
  "eff3ffbdd7e76baed63182bd08519c",
  "eff3ffc6dbef9ecae16baed63182bd08519c",
  "eff3ffc6dbef9ecae16baed64292c62171b5084594",
  "f7fbffdeebf7c6dbef9ecae16baed64292c62171b5084594",
  "f7fbffdeebf7c6dbef9ecae16baed64292c62171b508519c08306b"
).map(colors_default);
var Blues_default = ramp_default(scheme22);

// ../../node_modules/d3-scale-chromatic/src/sequential-single/Greens.js
var scheme23 = new Array(3).concat(
  "e5f5e0a1d99b31a354",
  "edf8e9bae4b374c476238b45",
  "edf8e9bae4b374c47631a354006d2c",
  "edf8e9c7e9c0a1d99b74c47631a354006d2c",
  "edf8e9c7e9c0a1d99b74c47641ab5d238b45005a32",
  "f7fcf5e5f5e0c7e9c0a1d99b74c47641ab5d238b45005a32",
  "f7fcf5e5f5e0c7e9c0a1d99b74c47641ab5d238b45006d2c00441b"
).map(colors_default);
var Greens_default = ramp_default(scheme23);

// ../../node_modules/d3-scale-chromatic/src/sequential-single/Greys.js
var scheme24 = new Array(3).concat(
  "f0f0f0bdbdbd636363",
  "f7f7f7cccccc969696525252",
  "f7f7f7cccccc969696636363252525",
  "f7f7f7d9d9d9bdbdbd969696636363252525",
  "f7f7f7d9d9d9bdbdbd969696737373525252252525",
  "fffffff0f0f0d9d9d9bdbdbd969696737373525252252525",
  "fffffff0f0f0d9d9d9bdbdbd969696737373525252252525000000"
).map(colors_default);
var Greys_default = ramp_default(scheme24);

// ../../node_modules/d3-scale-chromatic/src/sequential-single/Purples.js
var scheme25 = new Array(3).concat(
  "efedf5bcbddc756bb1",
  "f2f0f7cbc9e29e9ac86a51a3",
  "f2f0f7cbc9e29e9ac8756bb154278f",
  "f2f0f7dadaebbcbddc9e9ac8756bb154278f",
  "f2f0f7dadaebbcbddc9e9ac8807dba6a51a34a1486",
  "fcfbfdefedf5dadaebbcbddc9e9ac8807dba6a51a34a1486",
  "fcfbfdefedf5dadaebbcbddc9e9ac8807dba6a51a354278f3f007d"
).map(colors_default);
var Purples_default = ramp_default(scheme25);

// ../../node_modules/d3-scale-chromatic/src/sequential-single/Reds.js
var scheme26 = new Array(3).concat(
  "fee0d2fc9272de2d26",
  "fee5d9fcae91fb6a4acb181d",
  "fee5d9fcae91fb6a4ade2d26a50f15",
  "fee5d9fcbba1fc9272fb6a4ade2d26a50f15",
  "fee5d9fcbba1fc9272fb6a4aef3b2ccb181d99000d",
  "fff5f0fee0d2fcbba1fc9272fb6a4aef3b2ccb181d99000d",
  "fff5f0fee0d2fcbba1fc9272fb6a4aef3b2ccb181da50f1567000d"
).map(colors_default);
var Reds_default = ramp_default(scheme26);

// ../../node_modules/d3-scale-chromatic/src/sequential-single/Oranges.js
var scheme27 = new Array(3).concat(
  "fee6cefdae6be6550d",
  "feeddefdbe85fd8d3cd94701",
  "feeddefdbe85fd8d3ce6550da63603",
  "feeddefdd0a2fdae6bfd8d3ce6550da63603",
  "feeddefdd0a2fdae6bfd8d3cf16913d948018c2d04",
  "fff5ebfee6cefdd0a2fdae6bfd8d3cf16913d948018c2d04",
  "fff5ebfee6cefdd0a2fdae6bfd8d3cf16913d94801a636037f2704"
).map(colors_default);
var Oranges_default = ramp_default(scheme27);

// ../../node_modules/d3-scale-chromatic/src/sequential-multi/cividis.js
function cividis_default(t5) {
  t5 = Math.max(0, Math.min(1, t5));
  return "rgb(" + Math.max(0, Math.min(255, Math.round(-4.54 - t5 * (35.34 - t5 * (2381.73 - t5 * (6402.7 - t5 * (7024.72 - t5 * 2710.57))))))) + ", " + Math.max(0, Math.min(255, Math.round(32.49 + t5 * (170.73 + t5 * (52.82 - t5 * (131.46 - t5 * (176.58 - t5 * 67.37))))))) + ", " + Math.max(0, Math.min(255, Math.round(81.24 + t5 * (442.36 - t5 * (2482.43 - t5 * (6167.24 - t5 * (6614.94 - t5 * 2475.67))))))) + ")";
}

// ../../node_modules/d3-scale-chromatic/src/sequential-multi/cubehelix.js
var cubehelix_default2 = cubehelixLong(cubehelix(300, 0.5, 0), cubehelix(-240, 0.5, 1));

// ../../node_modules/d3-scale-chromatic/src/sequential-multi/rainbow.js
var warm = cubehelixLong(cubehelix(-100, 0.75, 0.35), cubehelix(80, 1.5, 0.8));
var cool = cubehelixLong(cubehelix(260, 0.75, 0.35), cubehelix(80, 1.5, 0.8));
var c = cubehelix();
function rainbow_default(t5) {
  if (t5 < 0 || t5 > 1)
    t5 -= Math.floor(t5);
  var ts = Math.abs(t5 - 0.5);
  c.h = 360 * t5 - 100;
  c.s = 1.5 - 1.5 * ts;
  c.l = 0.8 - 0.9 * ts;
  return c + "";
}

// ../../node_modules/d3-scale-chromatic/src/sequential-multi/sinebow.js
var c2 = rgb();
var pi_1_3 = Math.PI / 3;
var pi_2_3 = Math.PI * 2 / 3;
function sinebow_default(t5) {
  var x3;
  t5 = (0.5 - t5) * Math.PI;
  c2.r = 255 * (x3 = Math.sin(t5)) * x3;
  c2.g = 255 * (x3 = Math.sin(t5 + pi_1_3)) * x3;
  c2.b = 255 * (x3 = Math.sin(t5 + pi_2_3)) * x3;
  return c2 + "";
}

// ../../node_modules/d3-scale-chromatic/src/sequential-multi/turbo.js
function turbo_default(t5) {
  t5 = Math.max(0, Math.min(1, t5));
  return "rgb(" + Math.max(0, Math.min(255, Math.round(34.61 + t5 * (1172.33 - t5 * (10793.56 - t5 * (33300.12 - t5 * (38394.49 - t5 * 14825.05))))))) + ", " + Math.max(0, Math.min(255, Math.round(23.31 + t5 * (557.33 + t5 * (1225.33 - t5 * (3574.96 - t5 * (1073.77 + t5 * 707.56))))))) + ", " + Math.max(0, Math.min(255, Math.round(27.2 + t5 * (3211.1 - t5 * (15327.97 - t5 * (27814 - t5 * (22569.18 - t5 * 6838.66))))))) + ")";
}

// ../../node_modules/d3-scale-chromatic/src/sequential-multi/viridis.js
function ramp(range3) {
  var n2 = range3.length;
  return function(t5) {
    return range3[Math.max(0, Math.min(n2 - 1, Math.floor(t5 * n2)))];
  };
}
var viridis_default = ramp(colors_default("44015444025645045745055946075a46085c460a5d460b5e470d60470e6147106347116447136548146748166848176948186a481a6c481b6d481c6e481d6f481f70482071482173482374482475482576482677482878482979472a7a472c7a472d7b472e7c472f7d46307e46327e46337f463480453581453781453882443983443a83443b84433d84433e85423f854240864241864142874144874045884046883f47883f48893e49893e4a893e4c8a3d4d8a3d4e8a3c4f8a3c508b3b518b3b528b3a538b3a548c39558c39568c38588c38598c375a8c375b8d365c8d365d8d355e8d355f8d34608d34618d33628d33638d32648e32658e31668e31678e31688e30698e306a8e2f6b8e2f6c8e2e6d8e2e6e8e2e6f8e2d708e2d718e2c718e2c728e2c738e2b748e2b758e2a768e2a778e2a788e29798e297a8e297b8e287c8e287d8e277e8e277f8e27808e26818e26828e26828e25838e25848e25858e24868e24878e23888e23898e238a8d228b8d228c8d228d8d218e8d218f8d21908d21918c20928c20928c20938c1f948c1f958b1f968b1f978b1f988b1f998a1f9a8a1e9b8a1e9c891e9d891f9e891f9f881fa0881fa1881fa1871fa28720a38620a48621a58521a68522a78522a88423a98324aa8325ab8225ac8226ad8127ad8128ae8029af7f2ab07f2cb17e2db27d2eb37c2fb47c31b57b32b67a34b67935b77937b87838b9773aba763bbb753dbc743fbc7340bd7242be7144bf7046c06f48c16e4ac16d4cc26c4ec36b50c46a52c56954c56856c66758c7655ac8645cc8635ec96260ca6063cb5f65cb5e67cc5c69cd5b6ccd5a6ece5870cf5773d05675d05477d1537ad1517cd2507fd34e81d34d84d44b86d54989d5488bd6468ed64590d74393d74195d84098d83e9bd93c9dd93ba0da39a2da37a5db36a8db34aadc32addc30b0dd2fb2dd2db5de2bb8de29bade28bddf26c0df25c2df23c5e021c8e020cae11fcde11dd0e11cd2e21bd5e21ad8e219dae319dde318dfe318e2e418e5e419e7e419eae51aece51befe51cf1e51df4e61ef6e620f8e621fbe723fde725"));
var magma = ramp(colors_default("00000401000501010601010802010902020b02020d03030f03031204041405041606051806051a07061c08071e0907200a08220b09240c09260d0a290e0b2b100b2d110c2f120d31130d34140e36150e38160f3b180f3d19103f1a10421c10441d11471e114920114b21114e22115024125325125527125829115a2a115c2c115f2d11612f116331116533106734106936106b38106c390f6e3b0f703d0f713f0f72400f74420f75440f764510774710784910784a10794c117a4e117b4f127b51127c52137c54137d56147d57157e59157e5a167e5c167f5d177f5f187f601880621980641a80651a80671b80681c816a1c816b1d816d1d816e1e81701f81721f817320817521817621817822817922827b23827c23827e24828025828125818326818426818627818827818928818b29818c29818e2a81902a81912b81932b80942c80962c80982d80992d809b2e7f9c2e7f9e2f7fa02f7fa1307ea3307ea5317ea6317da8327daa337dab337cad347cae347bb0357bb2357bb3367ab5367ab73779b83779ba3878bc3978bd3977bf3a77c03a76c23b75c43c75c53c74c73d73c83e73ca3e72cc3f71cd4071cf4070d0416fd2426fd3436ed5446dd6456cd8456cd9466bdb476adc4869de4968df4a68e04c67e24d66e34e65e44f64e55064e75263e85362e95462ea5661eb5760ec5860ed5a5fee5b5eef5d5ef05f5ef1605df2625df2645cf3655cf4675cf4695cf56b5cf66c5cf66e5cf7705cf7725cf8745cf8765cf9785df9795df97b5dfa7d5efa7f5efa815ffb835ffb8560fb8761fc8961fc8a62fc8c63fc8e64fc9065fd9266fd9467fd9668fd9869fd9a6afd9b6bfe9d6cfe9f6dfea16efea36ffea571fea772fea973feaa74feac76feae77feb078feb27afeb47bfeb67cfeb77efeb97ffebb81febd82febf84fec185fec287fec488fec68afec88cfeca8dfecc8ffecd90fecf92fed194fed395fed597fed799fed89afdda9cfddc9efddea0fde0a1fde2a3fde3a5fde5a7fde7a9fde9aafdebacfcecaefceeb0fcf0b2fcf2b4fcf4b6fcf6b8fcf7b9fcf9bbfcfbbdfcfdbf"));
var inferno = ramp(colors_default("00000401000501010601010802010a02020c02020e03021004031204031405041706041907051b08051d09061f0a07220b07240c08260d08290e092b10092d110a30120a32140b34150b37160b39180c3c190c3e1b0c411c0c431e0c451f0c48210c4a230c4c240c4f260c51280b53290b552b0b572d0b592f0a5b310a5c320a5e340a5f3609613809623909633b09643d09653e0966400a67420a68440a68450a69470b6a490b6a4a0c6b4c0c6b4d0d6c4f0d6c510e6c520e6d540f6d550f6d57106e59106e5a116e5c126e5d126e5f136e61136e62146e64156e65156e67166e69166e6a176e6c186e6d186e6f196e71196e721a6e741a6e751b6e771c6d781c6d7a1d6d7c1d6d7d1e6d7f1e6c801f6c82206c84206b85216b87216b88226a8a226a8c23698d23698f24699025689225689326679526679727669827669a28659b29649d29649f2a63a02a63a22b62a32c61a52c60a62d60a82e5fa92e5eab2f5ead305dae305cb0315bb1325ab3325ab43359b63458b73557b93556ba3655bc3754bd3853bf3952c03a51c13a50c33b4fc43c4ec63d4dc73e4cc83f4bca404acb4149cc4248ce4347cf4446d04545d24644d34743d44842d54a41d74b3fd84c3ed94d3dda4e3cdb503bdd513ade5238df5337e05536e15635e25734e35933e45a31e55c30e65d2fe75e2ee8602de9612bea632aeb6429eb6628ec6726ed6925ee6a24ef6c23ef6e21f06f20f1711ff1731df2741cf3761bf37819f47918f57b17f57d15f67e14f68013f78212f78410f8850ff8870ef8890cf98b0bf98c0af98e09fa9008fa9207fa9407fb9606fb9706fb9906fb9b06fb9d07fc9f07fca108fca309fca50afca60cfca80dfcaa0ffcac11fcae12fcb014fcb216fcb418fbb61afbb81dfbba1ffbbc21fbbe23fac026fac228fac42afac62df9c72ff9c932f9cb35f8cd37f8cf3af7d13df7d340f6d543f6d746f5d949f5db4cf4dd4ff4df53f4e156f3e35af3e55df2e661f2e865f2ea69f1ec6df1ed71f1ef75f1f179f2f27df2f482f3f586f3f68af4f88ef5f992f6fa96f8fb9af9fc9dfafda1fcffa4"));
var plasma = ramp(colors_default("0d088710078813078916078a19068c1b068d1d068e20068f2206902406912605912805922a05932c05942e05952f059631059733059735049837049938049a3a049a3c049b3e049c3f049c41049d43039e44039e46039f48039f4903a04b03a14c02a14e02a25002a25102a35302a35502a45601a45801a45901a55b01a55c01a65e01a66001a66100a76300a76400a76600a76700a86900a86a00a86c00a86e00a86f00a87100a87201a87401a87501a87701a87801a87a02a87b02a87d03a87e03a88004a88104a78305a78405a78606a68707a68808a68a09a58b0aa58d0ba58e0ca48f0da4910ea3920fa39410a29511a19613a19814a099159f9a169f9c179e9d189d9e199da01a9ca11b9ba21d9aa31e9aa51f99a62098a72197a82296aa2395ab2494ac2694ad2793ae2892b02991b12a90b22b8fb32c8eb42e8db52f8cb6308bb7318ab83289ba3388bb3488bc3587bd3786be3885bf3984c03a83c13b82c23c81c33d80c43e7fc5407ec6417dc7427cc8437bc9447aca457acb4679cc4778cc4977cd4a76ce4b75cf4c74d04d73d14e72d24f71d35171d45270d5536fd5546ed6556dd7566cd8576bd9586ada5a6ada5b69db5c68dc5d67dd5e66de5f65de6164df6263e06363e16462e26561e26660e3685fe4695ee56a5de56b5de66c5ce76e5be76f5ae87059e97158e97257ea7457eb7556eb7655ec7754ed7953ed7a52ee7b51ef7c51ef7e50f07f4ff0804ef1814df1834cf2844bf3854bf3874af48849f48948f58b47f58c46f68d45f68f44f79044f79143f79342f89441f89540f9973ff9983ef99a3efa9b3dfa9c3cfa9e3bfb9f3afba139fba238fca338fca537fca636fca835fca934fdab33fdac33fdae32fdaf31fdb130fdb22ffdb42ffdb52efeb72dfeb82cfeba2cfebb2bfebd2afebe2afec029fdc229fdc328fdc527fdc627fdc827fdca26fdcb26fccd25fcce25fcd025fcd225fbd324fbd524fbd724fad824fada24f9dc24f9dd25f8df25f8e125f7e225f7e425f6e626f6e826f5e926f5eb27f4ed27f3ee27f3f027f2f227f1f426f1f525f0f724f0f921"));

// ../../node_modules/d3-shape/src/constant.js
function constant_default4(x3) {
  return function constant2() {
    return x3;
  };
}

// ../../node_modules/d3-shape/src/math.js
var cos2 = Math.cos;
var min3 = Math.min;
var sin2 = Math.sin;
var sqrt3 = Math.sqrt;
var epsilon4 = 1e-12;
var pi3 = Math.PI;
var halfPi2 = pi3 / 2;
var tau3 = 2 * pi3;

// ../../node_modules/d3-shape/src/path.js
function withPath(shape) {
  let digits = 3;
  shape.digits = function(_24) {
    if (!arguments.length)
      return digits;
    if (_24 == null) {
      digits = null;
    } else {
      const d2 = Math.floor(_24);
      if (!(d2 >= 0))
        throw new RangeError(`invalid digits: ${_24}`);
      digits = d2;
    }
    return shape;
  };
  return () => new Path(digits);
}

// ../../node_modules/d3-shape/src/array.js
var slice = Array.prototype.slice;
function array_default(x3) {
  return typeof x3 === "object" && "length" in x3 ? x3 : Array.from(x3);
}

// ../../node_modules/d3-shape/src/curve/linear.js
function Linear(context) {
  this._context = context;
}
Linear.prototype = {
  areaStart: function() {
    this._line = 0;
  },
  areaEnd: function() {
    this._line = NaN;
  },
  lineStart: function() {
    this._point = 0;
  },
  lineEnd: function() {
    if (this._line || this._line !== 0 && this._point === 1)
      this._context.closePath();
    this._line = 1 - this._line;
  },
  point: function(x3, y3) {
    x3 = +x3, y3 = +y3;
    switch (this._point) {
      case 0:
        this._point = 1;
        this._line ? this._context.lineTo(x3, y3) : this._context.moveTo(x3, y3);
        break;
      case 1:
        this._point = 2;
      default:
        this._context.lineTo(x3, y3);
        break;
    }
  }
};
function linear_default(context) {
  return new Linear(context);
}

// ../../node_modules/d3-shape/src/point.js
function x(p2) {
  return p2[0];
}
function y(p2) {
  return p2[1];
}

// ../../node_modules/d3-shape/src/line.js
function line_default2(x3, y3) {
  var defined2 = constant_default4(true), context = null, curve = linear_default, output2 = null, path2 = withPath(line2);
  x3 = typeof x3 === "function" ? x3 : x3 === void 0 ? x : constant_default4(x3);
  y3 = typeof y3 === "function" ? y3 : y3 === void 0 ? y : constant_default4(y3);
  function line2(data) {
    var i2, n2 = (data = array_default(data)).length, d2, defined0 = false, buffer;
    if (context == null)
      output2 = curve(buffer = path2());
    for (i2 = 0; i2 <= n2; ++i2) {
      if (!(i2 < n2 && defined2(d2 = data[i2], i2, data)) === defined0) {
        if (defined0 = !defined0)
          output2.lineStart();
        else
          output2.lineEnd();
      }
      if (defined0)
        output2.point(+x3(d2, i2, data), +y3(d2, i2, data));
    }
    if (buffer)
      return output2 = null, buffer + "" || null;
  }
  line2.x = function(_24) {
    return arguments.length ? (x3 = typeof _24 === "function" ? _24 : constant_default4(+_24), line2) : x3;
  };
  line2.y = function(_24) {
    return arguments.length ? (y3 = typeof _24 === "function" ? _24 : constant_default4(+_24), line2) : y3;
  };
  line2.defined = function(_24) {
    return arguments.length ? (defined2 = typeof _24 === "function" ? _24 : constant_default4(!!_24), line2) : defined2;
  };
  line2.curve = function(_24) {
    return arguments.length ? (curve = _24, context != null && (output2 = curve(context)), line2) : curve;
  };
  line2.context = function(_24) {
    return arguments.length ? (_24 == null ? context = output2 = null : output2 = curve(context = _24), line2) : context;
  };
  return line2;
}

// ../../node_modules/d3-shape/src/area.js
function area_default2(x05, y05, y12) {
  var x12 = null, defined2 = constant_default4(true), context = null, curve = linear_default, output2 = null, path2 = withPath(area2);
  x05 = typeof x05 === "function" ? x05 : x05 === void 0 ? x : constant_default4(+x05);
  y05 = typeof y05 === "function" ? y05 : y05 === void 0 ? constant_default4(0) : constant_default4(+y05);
  y12 = typeof y12 === "function" ? y12 : y12 === void 0 ? y : constant_default4(+y12);
  function area2(data) {
    var i2, j2, k3, n2 = (data = array_default(data)).length, d2, defined0 = false, buffer, x0z = new Array(n2), y0z = new Array(n2);
    if (context == null)
      output2 = curve(buffer = path2());
    for (i2 = 0; i2 <= n2; ++i2) {
      if (!(i2 < n2 && defined2(d2 = data[i2], i2, data)) === defined0) {
        if (defined0 = !defined0) {
          j2 = i2;
          output2.areaStart();
          output2.lineStart();
        } else {
          output2.lineEnd();
          output2.lineStart();
          for (k3 = i2 - 1; k3 >= j2; --k3) {
            output2.point(x0z[k3], y0z[k3]);
          }
          output2.lineEnd();
          output2.areaEnd();
        }
      }
      if (defined0) {
        x0z[i2] = +x05(d2, i2, data), y0z[i2] = +y05(d2, i2, data);
        output2.point(x12 ? +x12(d2, i2, data) : x0z[i2], y12 ? +y12(d2, i2, data) : y0z[i2]);
      }
    }
    if (buffer)
      return output2 = null, buffer + "" || null;
  }
  function arealine() {
    return line_default2().defined(defined2).curve(curve).context(context);
  }
  area2.x = function(_24) {
    return arguments.length ? (x05 = typeof _24 === "function" ? _24 : constant_default4(+_24), x12 = null, area2) : x05;
  };
  area2.x0 = function(_24) {
    return arguments.length ? (x05 = typeof _24 === "function" ? _24 : constant_default4(+_24), area2) : x05;
  };
  area2.x1 = function(_24) {
    return arguments.length ? (x12 = _24 == null ? null : typeof _24 === "function" ? _24 : constant_default4(+_24), area2) : x12;
  };
  area2.y = function(_24) {
    return arguments.length ? (y05 = typeof _24 === "function" ? _24 : constant_default4(+_24), y12 = null, area2) : y05;
  };
  area2.y0 = function(_24) {
    return arguments.length ? (y05 = typeof _24 === "function" ? _24 : constant_default4(+_24), area2) : y05;
  };
  area2.y1 = function(_24) {
    return arguments.length ? (y12 = _24 == null ? null : typeof _24 === "function" ? _24 : constant_default4(+_24), area2) : y12;
  };
  area2.lineX0 = area2.lineY0 = function() {
    return arealine().x(x05).y(y05);
  };
  area2.lineY1 = function() {
    return arealine().x(x05).y(y12);
  };
  area2.lineX1 = function() {
    return arealine().x(x12).y(y05);
  };
  area2.defined = function(_24) {
    return arguments.length ? (defined2 = typeof _24 === "function" ? _24 : constant_default4(!!_24), area2) : defined2;
  };
  area2.curve = function(_24) {
    return arguments.length ? (curve = _24, context != null && (output2 = curve(context)), area2) : curve;
  };
  area2.context = function(_24) {
    return arguments.length ? (_24 == null ? context = output2 = null : output2 = curve(context = _24), area2) : context;
  };
  return area2;
}

// ../../node_modules/d3-shape/src/curve/bump.js
var Bump = class {
  constructor(context, x3) {
    this._context = context;
    this._x = x3;
  }
  areaStart() {
    this._line = 0;
  }
  areaEnd() {
    this._line = NaN;
  }
  lineStart() {
    this._point = 0;
  }
  lineEnd() {
    if (this._line || this._line !== 0 && this._point === 1)
      this._context.closePath();
    this._line = 1 - this._line;
  }
  point(x3, y3) {
    x3 = +x3, y3 = +y3;
    switch (this._point) {
      case 0: {
        this._point = 1;
        if (this._line)
          this._context.lineTo(x3, y3);
        else
          this._context.moveTo(x3, y3);
        break;
      }
      case 1:
        this._point = 2;
      default: {
        if (this._x)
          this._context.bezierCurveTo(this._x0 = (this._x0 + x3) / 2, this._y0, this._x0, y3, x3, y3);
        else
          this._context.bezierCurveTo(this._x0, this._y0 = (this._y0 + y3) / 2, x3, this._y0, x3, y3);
        break;
      }
    }
    this._x0 = x3, this._y0 = y3;
  }
};
function bumpX(context) {
  return new Bump(context, true);
}
function bumpY(context) {
  return new Bump(context, false);
}

// ../../node_modules/d3-shape/src/symbol/asterisk.js
var sqrt32 = sqrt3(3);
var asterisk_default = {
  draw(context, size) {
    const r2 = sqrt3(size + min3(size / 28, 0.75)) * 0.59436;
    const t5 = r2 / 2;
    const u2 = t5 * sqrt32;
    context.moveTo(0, r2);
    context.lineTo(0, -r2);
    context.moveTo(-u2, -t5);
    context.lineTo(u2, t5);
    context.moveTo(-u2, t5);
    context.lineTo(u2, -t5);
  }
};

// ../../node_modules/d3-shape/src/symbol/circle.js
var circle_default2 = {
  draw(context, size) {
    const r2 = sqrt3(size / pi3);
    context.moveTo(r2, 0);
    context.arc(0, 0, r2, 0, tau3);
  }
};

// ../../node_modules/d3-shape/src/symbol/cross.js
var cross_default = {
  draw(context, size) {
    const r2 = sqrt3(size / 5) / 2;
    context.moveTo(-3 * r2, -r2);
    context.lineTo(-r2, -r2);
    context.lineTo(-r2, -3 * r2);
    context.lineTo(r2, -3 * r2);
    context.lineTo(r2, -r2);
    context.lineTo(3 * r2, -r2);
    context.lineTo(3 * r2, r2);
    context.lineTo(r2, r2);
    context.lineTo(r2, 3 * r2);
    context.lineTo(-r2, 3 * r2);
    context.lineTo(-r2, r2);
    context.lineTo(-3 * r2, r2);
    context.closePath();
  }
};

// ../../node_modules/d3-shape/src/symbol/diamond.js
var tan30 = sqrt3(1 / 3);
var tan30_2 = tan30 * 2;
var diamond_default = {
  draw(context, size) {
    const y3 = sqrt3(size / tan30_2);
    const x3 = y3 * tan30;
    context.moveTo(0, -y3);
    context.lineTo(x3, 0);
    context.lineTo(0, y3);
    context.lineTo(-x3, 0);
    context.closePath();
  }
};

// ../../node_modules/d3-shape/src/symbol/diamond2.js
var diamond2_default = {
  draw(context, size) {
    const r2 = sqrt3(size) * 0.62625;
    context.moveTo(0, -r2);
    context.lineTo(r2, 0);
    context.lineTo(0, r2);
    context.lineTo(-r2, 0);
    context.closePath();
  }
};

// ../../node_modules/d3-shape/src/symbol/plus.js
var plus_default = {
  draw(context, size) {
    const r2 = sqrt3(size - min3(size / 7, 2)) * 0.87559;
    context.moveTo(-r2, 0);
    context.lineTo(r2, 0);
    context.moveTo(0, r2);
    context.lineTo(0, -r2);
  }
};

// ../../node_modules/d3-shape/src/symbol/square.js
var square_default = {
  draw(context, size) {
    const w2 = sqrt3(size);
    const x3 = -w2 / 2;
    context.rect(x3, x3, w2, w2);
  }
};

// ../../node_modules/d3-shape/src/symbol/square2.js
var square2_default = {
  draw(context, size) {
    const r2 = sqrt3(size) * 0.4431;
    context.moveTo(r2, r2);
    context.lineTo(r2, -r2);
    context.lineTo(-r2, -r2);
    context.lineTo(-r2, r2);
    context.closePath();
  }
};

// ../../node_modules/d3-shape/src/symbol/star.js
var ka = 0.8908130915292852;
var kr = sin2(pi3 / 10) / sin2(7 * pi3 / 10);
var kx = sin2(tau3 / 10) * kr;
var ky = -cos2(tau3 / 10) * kr;
var star_default = {
  draw(context, size) {
    const r2 = sqrt3(size * ka);
    const x3 = kx * r2;
    const y3 = ky * r2;
    context.moveTo(0, -r2);
    context.lineTo(x3, y3);
    for (let i2 = 1; i2 < 5; ++i2) {
      const a3 = tau3 * i2 / 5;
      const c5 = cos2(a3);
      const s3 = sin2(a3);
      context.lineTo(s3 * r2, -c5 * r2);
      context.lineTo(c5 * x3 - s3 * y3, s3 * x3 + c5 * y3);
    }
    context.closePath();
  }
};

// ../../node_modules/d3-shape/src/symbol/triangle.js
var sqrt33 = sqrt3(3);
var triangle_default = {
  draw(context, size) {
    const y3 = -sqrt3(size / (sqrt33 * 3));
    context.moveTo(0, y3 * 2);
    context.lineTo(-sqrt33 * y3, -y3);
    context.lineTo(sqrt33 * y3, -y3);
    context.closePath();
  }
};

// ../../node_modules/d3-shape/src/symbol/triangle2.js
var sqrt34 = sqrt3(3);
var triangle2_default = {
  draw(context, size) {
    const s3 = sqrt3(size) * 0.6824;
    const t5 = s3 / 2;
    const u2 = s3 * sqrt34 / 2;
    context.moveTo(0, -s3);
    context.lineTo(u2, t5);
    context.lineTo(-u2, t5);
    context.closePath();
  }
};

// ../../node_modules/d3-shape/src/symbol/wye.js
var c3 = -0.5;
var s = sqrt3(3) / 2;
var k = 1 / sqrt3(12);
var a = (k / 2 + 1) * 3;
var wye_default = {
  draw(context, size) {
    const r2 = sqrt3(size / a);
    const x05 = r2 / 2, y05 = r2 * k;
    const x12 = x05, y12 = r2 * k + r2;
    const x22 = -x12, y22 = y12;
    context.moveTo(x05, y05);
    context.lineTo(x12, y12);
    context.lineTo(x22, y22);
    context.lineTo(c3 * x05 - s * y05, s * x05 + c3 * y05);
    context.lineTo(c3 * x12 - s * y12, s * x12 + c3 * y12);
    context.lineTo(c3 * x22 - s * y22, s * x22 + c3 * y22);
    context.lineTo(c3 * x05 + s * y05, c3 * y05 - s * x05);
    context.lineTo(c3 * x12 + s * y12, c3 * y12 - s * x12);
    context.lineTo(c3 * x22 + s * y22, c3 * y22 - s * x22);
    context.closePath();
  }
};

// ../../node_modules/d3-shape/src/symbol/times.js
var times_default = {
  draw(context, size) {
    const r2 = sqrt3(size - min3(size / 6, 1.7)) * 0.6189;
    context.moveTo(-r2, -r2);
    context.lineTo(r2, r2);
    context.moveTo(-r2, r2);
    context.lineTo(r2, -r2);
  }
};

// ../../node_modules/d3-shape/src/symbol.js
var symbolsFill = [
  circle_default2,
  cross_default,
  diamond_default,
  square_default,
  star_default,
  triangle_default,
  wye_default
];
var symbolsStroke = [
  circle_default2,
  plus_default,
  times_default,
  triangle2_default,
  asterisk_default,
  square2_default,
  diamond2_default
];

// ../../node_modules/d3-shape/src/noop.js
function noop_default() {
}

// ../../node_modules/d3-shape/src/curve/basis.js
function point2(that, x3, y3) {
  that._context.bezierCurveTo(
    (2 * that._x0 + that._x1) / 3,
    (2 * that._y0 + that._y1) / 3,
    (that._x0 + 2 * that._x1) / 3,
    (that._y0 + 2 * that._y1) / 3,
    (that._x0 + 4 * that._x1 + x3) / 6,
    (that._y0 + 4 * that._y1 + y3) / 6
  );
}
function Basis(context) {
  this._context = context;
}
Basis.prototype = {
  areaStart: function() {
    this._line = 0;
  },
  areaEnd: function() {
    this._line = NaN;
  },
  lineStart: function() {
    this._x0 = this._x1 = this._y0 = this._y1 = NaN;
    this._point = 0;
  },
  lineEnd: function() {
    switch (this._point) {
      case 3:
        point2(this, this._x1, this._y1);
      case 2:
        this._context.lineTo(this._x1, this._y1);
        break;
    }
    if (this._line || this._line !== 0 && this._point === 1)
      this._context.closePath();
    this._line = 1 - this._line;
  },
  point: function(x3, y3) {
    x3 = +x3, y3 = +y3;
    switch (this._point) {
      case 0:
        this._point = 1;
        this._line ? this._context.lineTo(x3, y3) : this._context.moveTo(x3, y3);
        break;
      case 1:
        this._point = 2;
        break;
      case 2:
        this._point = 3;
        this._context.lineTo((5 * this._x0 + this._x1) / 6, (5 * this._y0 + this._y1) / 6);
      default:
        point2(this, x3, y3);
        break;
    }
    this._x0 = this._x1, this._x1 = x3;
    this._y0 = this._y1, this._y1 = y3;
  }
};
function basis_default2(context) {
  return new Basis(context);
}

// ../../node_modules/d3-shape/src/curve/basisClosed.js
function BasisClosed(context) {
  this._context = context;
}
BasisClosed.prototype = {
  areaStart: noop_default,
  areaEnd: noop_default,
  lineStart: function() {
    this._x0 = this._x1 = this._x2 = this._x3 = this._x4 = this._y0 = this._y1 = this._y2 = this._y3 = this._y4 = NaN;
    this._point = 0;
  },
  lineEnd: function() {
    switch (this._point) {
      case 1: {
        this._context.moveTo(this._x2, this._y2);
        this._context.closePath();
        break;
      }
      case 2: {
        this._context.moveTo((this._x2 + 2 * this._x3) / 3, (this._y2 + 2 * this._y3) / 3);
        this._context.lineTo((this._x3 + 2 * this._x2) / 3, (this._y3 + 2 * this._y2) / 3);
        this._context.closePath();
        break;
      }
      case 3: {
        this.point(this._x2, this._y2);
        this.point(this._x3, this._y3);
        this.point(this._x4, this._y4);
        break;
      }
    }
  },
  point: function(x3, y3) {
    x3 = +x3, y3 = +y3;
    switch (this._point) {
      case 0:
        this._point = 1;
        this._x2 = x3, this._y2 = y3;
        break;
      case 1:
        this._point = 2;
        this._x3 = x3, this._y3 = y3;
        break;
      case 2:
        this._point = 3;
        this._x4 = x3, this._y4 = y3;
        this._context.moveTo((this._x0 + 4 * this._x1 + x3) / 6, (this._y0 + 4 * this._y1 + y3) / 6);
        break;
      default:
        point2(this, x3, y3);
        break;
    }
    this._x0 = this._x1, this._x1 = x3;
    this._y0 = this._y1, this._y1 = y3;
  }
};
function basisClosed_default2(context) {
  return new BasisClosed(context);
}

// ../../node_modules/d3-shape/src/curve/basisOpen.js
function BasisOpen(context) {
  this._context = context;
}
BasisOpen.prototype = {
  areaStart: function() {
    this._line = 0;
  },
  areaEnd: function() {
    this._line = NaN;
  },
  lineStart: function() {
    this._x0 = this._x1 = this._y0 = this._y1 = NaN;
    this._point = 0;
  },
  lineEnd: function() {
    if (this._line || this._line !== 0 && this._point === 3)
      this._context.closePath();
    this._line = 1 - this._line;
  },
  point: function(x3, y3) {
    x3 = +x3, y3 = +y3;
    switch (this._point) {
      case 0:
        this._point = 1;
        break;
      case 1:
        this._point = 2;
        break;
      case 2:
        this._point = 3;
        var x05 = (this._x0 + 4 * this._x1 + x3) / 6, y05 = (this._y0 + 4 * this._y1 + y3) / 6;
        this._line ? this._context.lineTo(x05, y05) : this._context.moveTo(x05, y05);
        break;
      case 3:
        this._point = 4;
      default:
        point2(this, x3, y3);
        break;
    }
    this._x0 = this._x1, this._x1 = x3;
    this._y0 = this._y1, this._y1 = y3;
  }
};
function basisOpen_default(context) {
  return new BasisOpen(context);
}

// ../../node_modules/d3-shape/src/curve/bundle.js
function Bundle(context, beta) {
  this._basis = new Basis(context);
  this._beta = beta;
}
Bundle.prototype = {
  lineStart: function() {
    this._x = [];
    this._y = [];
    this._basis.lineStart();
  },
  lineEnd: function() {
    var x3 = this._x, y3 = this._y, j2 = x3.length - 1;
    if (j2 > 0) {
      var x05 = x3[0], y05 = y3[0], dx = x3[j2] - x05, dy = y3[j2] - y05, i2 = -1, t5;
      while (++i2 <= j2) {
        t5 = i2 / j2;
        this._basis.point(
          this._beta * x3[i2] + (1 - this._beta) * (x05 + t5 * dx),
          this._beta * y3[i2] + (1 - this._beta) * (y05 + t5 * dy)
        );
      }
    }
    this._x = this._y = null;
    this._basis.lineEnd();
  },
  point: function(x3, y3) {
    this._x.push(+x3);
    this._y.push(+y3);
  }
};
var bundle_default = function custom(beta) {
  function bundle(context) {
    return beta === 1 ? new Basis(context) : new Bundle(context, beta);
  }
  bundle.beta = function(beta2) {
    return custom(+beta2);
  };
  return bundle;
}(0.85);

// ../../node_modules/d3-shape/src/curve/cardinal.js
function point3(that, x3, y3) {
  that._context.bezierCurveTo(
    that._x1 + that._k * (that._x2 - that._x0),
    that._y1 + that._k * (that._y2 - that._y0),
    that._x2 + that._k * (that._x1 - x3),
    that._y2 + that._k * (that._y1 - y3),
    that._x2,
    that._y2
  );
}
function Cardinal(context, tension) {
  this._context = context;
  this._k = (1 - tension) / 6;
}
Cardinal.prototype = {
  areaStart: function() {
    this._line = 0;
  },
  areaEnd: function() {
    this._line = NaN;
  },
  lineStart: function() {
    this._x0 = this._x1 = this._x2 = this._y0 = this._y1 = this._y2 = NaN;
    this._point = 0;
  },
  lineEnd: function() {
    switch (this._point) {
      case 2:
        this._context.lineTo(this._x2, this._y2);
        break;
      case 3:
        point3(this, this._x1, this._y1);
        break;
    }
    if (this._line || this._line !== 0 && this._point === 1)
      this._context.closePath();
    this._line = 1 - this._line;
  },
  point: function(x3, y3) {
    x3 = +x3, y3 = +y3;
    switch (this._point) {
      case 0:
        this._point = 1;
        this._line ? this._context.lineTo(x3, y3) : this._context.moveTo(x3, y3);
        break;
      case 1:
        this._point = 2;
        this._x1 = x3, this._y1 = y3;
        break;
      case 2:
        this._point = 3;
      default:
        point3(this, x3, y3);
        break;
    }
    this._x0 = this._x1, this._x1 = this._x2, this._x2 = x3;
    this._y0 = this._y1, this._y1 = this._y2, this._y2 = y3;
  }
};
var cardinal_default = function custom2(tension) {
  function cardinal(context) {
    return new Cardinal(context, tension);
  }
  cardinal.tension = function(tension2) {
    return custom2(+tension2);
  };
  return cardinal;
}(0);

// ../../node_modules/d3-shape/src/curve/cardinalClosed.js
function CardinalClosed(context, tension) {
  this._context = context;
  this._k = (1 - tension) / 6;
}
CardinalClosed.prototype = {
  areaStart: noop_default,
  areaEnd: noop_default,
  lineStart: function() {
    this._x0 = this._x1 = this._x2 = this._x3 = this._x4 = this._x5 = this._y0 = this._y1 = this._y2 = this._y3 = this._y4 = this._y5 = NaN;
    this._point = 0;
  },
  lineEnd: function() {
    switch (this._point) {
      case 1: {
        this._context.moveTo(this._x3, this._y3);
        this._context.closePath();
        break;
      }
      case 2: {
        this._context.lineTo(this._x3, this._y3);
        this._context.closePath();
        break;
      }
      case 3: {
        this.point(this._x3, this._y3);
        this.point(this._x4, this._y4);
        this.point(this._x5, this._y5);
        break;
      }
    }
  },
  point: function(x3, y3) {
    x3 = +x3, y3 = +y3;
    switch (this._point) {
      case 0:
        this._point = 1;
        this._x3 = x3, this._y3 = y3;
        break;
      case 1:
        this._point = 2;
        this._context.moveTo(this._x4 = x3, this._y4 = y3);
        break;
      case 2:
        this._point = 3;
        this._x5 = x3, this._y5 = y3;
        break;
      default:
        point3(this, x3, y3);
        break;
    }
    this._x0 = this._x1, this._x1 = this._x2, this._x2 = x3;
    this._y0 = this._y1, this._y1 = this._y2, this._y2 = y3;
  }
};
var cardinalClosed_default = function custom3(tension) {
  function cardinal(context) {
    return new CardinalClosed(context, tension);
  }
  cardinal.tension = function(tension2) {
    return custom3(+tension2);
  };
  return cardinal;
}(0);

// ../../node_modules/d3-shape/src/curve/cardinalOpen.js
function CardinalOpen(context, tension) {
  this._context = context;
  this._k = (1 - tension) / 6;
}
CardinalOpen.prototype = {
  areaStart: function() {
    this._line = 0;
  },
  areaEnd: function() {
    this._line = NaN;
  },
  lineStart: function() {
    this._x0 = this._x1 = this._x2 = this._y0 = this._y1 = this._y2 = NaN;
    this._point = 0;
  },
  lineEnd: function() {
    if (this._line || this._line !== 0 && this._point === 3)
      this._context.closePath();
    this._line = 1 - this._line;
  },
  point: function(x3, y3) {
    x3 = +x3, y3 = +y3;
    switch (this._point) {
      case 0:
        this._point = 1;
        break;
      case 1:
        this._point = 2;
        break;
      case 2:
        this._point = 3;
        this._line ? this._context.lineTo(this._x2, this._y2) : this._context.moveTo(this._x2, this._y2);
        break;
      case 3:
        this._point = 4;
      default:
        point3(this, x3, y3);
        break;
    }
    this._x0 = this._x1, this._x1 = this._x2, this._x2 = x3;
    this._y0 = this._y1, this._y1 = this._y2, this._y2 = y3;
  }
};
var cardinalOpen_default = function custom4(tension) {
  function cardinal(context) {
    return new CardinalOpen(context, tension);
  }
  cardinal.tension = function(tension2) {
    return custom4(+tension2);
  };
  return cardinal;
}(0);

// ../../node_modules/d3-shape/src/curve/catmullRom.js
function point4(that, x3, y3) {
  var x12 = that._x1, y12 = that._y1, x22 = that._x2, y22 = that._y2;
  if (that._l01_a > epsilon4) {
    var a3 = 2 * that._l01_2a + 3 * that._l01_a * that._l12_a + that._l12_2a, n2 = 3 * that._l01_a * (that._l01_a + that._l12_a);
    x12 = (x12 * a3 - that._x0 * that._l12_2a + that._x2 * that._l01_2a) / n2;
    y12 = (y12 * a3 - that._y0 * that._l12_2a + that._y2 * that._l01_2a) / n2;
  }
  if (that._l23_a > epsilon4) {
    var b2 = 2 * that._l23_2a + 3 * that._l23_a * that._l12_a + that._l12_2a, m = 3 * that._l23_a * (that._l23_a + that._l12_a);
    x22 = (x22 * b2 + that._x1 * that._l23_2a - x3 * that._l12_2a) / m;
    y22 = (y22 * b2 + that._y1 * that._l23_2a - y3 * that._l12_2a) / m;
  }
  that._context.bezierCurveTo(x12, y12, x22, y22, that._x2, that._y2);
}
function CatmullRom(context, alpha) {
  this._context = context;
  this._alpha = alpha;
}
CatmullRom.prototype = {
  areaStart: function() {
    this._line = 0;
  },
  areaEnd: function() {
    this._line = NaN;
  },
  lineStart: function() {
    this._x0 = this._x1 = this._x2 = this._y0 = this._y1 = this._y2 = NaN;
    this._l01_a = this._l12_a = this._l23_a = this._l01_2a = this._l12_2a = this._l23_2a = this._point = 0;
  },
  lineEnd: function() {
    switch (this._point) {
      case 2:
        this._context.lineTo(this._x2, this._y2);
        break;
      case 3:
        this.point(this._x2, this._y2);
        break;
    }
    if (this._line || this._line !== 0 && this._point === 1)
      this._context.closePath();
    this._line = 1 - this._line;
  },
  point: function(x3, y3) {
    x3 = +x3, y3 = +y3;
    if (this._point) {
      var x23 = this._x2 - x3, y23 = this._y2 - y3;
      this._l23_a = Math.sqrt(this._l23_2a = Math.pow(x23 * x23 + y23 * y23, this._alpha));
    }
    switch (this._point) {
      case 0:
        this._point = 1;
        this._line ? this._context.lineTo(x3, y3) : this._context.moveTo(x3, y3);
        break;
      case 1:
        this._point = 2;
        break;
      case 2:
        this._point = 3;
      default:
        point4(this, x3, y3);
        break;
    }
    this._l01_a = this._l12_a, this._l12_a = this._l23_a;
    this._l01_2a = this._l12_2a, this._l12_2a = this._l23_2a;
    this._x0 = this._x1, this._x1 = this._x2, this._x2 = x3;
    this._y0 = this._y1, this._y1 = this._y2, this._y2 = y3;
  }
};
var catmullRom_default = function custom5(alpha) {
  function catmullRom(context) {
    return alpha ? new CatmullRom(context, alpha) : new Cardinal(context, 0);
  }
  catmullRom.alpha = function(alpha2) {
    return custom5(+alpha2);
  };
  return catmullRom;
}(0.5);

// ../../node_modules/d3-shape/src/curve/catmullRomClosed.js
function CatmullRomClosed(context, alpha) {
  this._context = context;
  this._alpha = alpha;
}
CatmullRomClosed.prototype = {
  areaStart: noop_default,
  areaEnd: noop_default,
  lineStart: function() {
    this._x0 = this._x1 = this._x2 = this._x3 = this._x4 = this._x5 = this._y0 = this._y1 = this._y2 = this._y3 = this._y4 = this._y5 = NaN;
    this._l01_a = this._l12_a = this._l23_a = this._l01_2a = this._l12_2a = this._l23_2a = this._point = 0;
  },
  lineEnd: function() {
    switch (this._point) {
      case 1: {
        this._context.moveTo(this._x3, this._y3);
        this._context.closePath();
        break;
      }
      case 2: {
        this._context.lineTo(this._x3, this._y3);
        this._context.closePath();
        break;
      }
      case 3: {
        this.point(this._x3, this._y3);
        this.point(this._x4, this._y4);
        this.point(this._x5, this._y5);
        break;
      }
    }
  },
  point: function(x3, y3) {
    x3 = +x3, y3 = +y3;
    if (this._point) {
      var x23 = this._x2 - x3, y23 = this._y2 - y3;
      this._l23_a = Math.sqrt(this._l23_2a = Math.pow(x23 * x23 + y23 * y23, this._alpha));
    }
    switch (this._point) {
      case 0:
        this._point = 1;
        this._x3 = x3, this._y3 = y3;
        break;
      case 1:
        this._point = 2;
        this._context.moveTo(this._x4 = x3, this._y4 = y3);
        break;
      case 2:
        this._point = 3;
        this._x5 = x3, this._y5 = y3;
        break;
      default:
        point4(this, x3, y3);
        break;
    }
    this._l01_a = this._l12_a, this._l12_a = this._l23_a;
    this._l01_2a = this._l12_2a, this._l12_2a = this._l23_2a;
    this._x0 = this._x1, this._x1 = this._x2, this._x2 = x3;
    this._y0 = this._y1, this._y1 = this._y2, this._y2 = y3;
  }
};
var catmullRomClosed_default = function custom6(alpha) {
  function catmullRom(context) {
    return alpha ? new CatmullRomClosed(context, alpha) : new CardinalClosed(context, 0);
  }
  catmullRom.alpha = function(alpha2) {
    return custom6(+alpha2);
  };
  return catmullRom;
}(0.5);

// ../../node_modules/d3-shape/src/curve/catmullRomOpen.js
function CatmullRomOpen(context, alpha) {
  this._context = context;
  this._alpha = alpha;
}
CatmullRomOpen.prototype = {
  areaStart: function() {
    this._line = 0;
  },
  areaEnd: function() {
    this._line = NaN;
  },
  lineStart: function() {
    this._x0 = this._x1 = this._x2 = this._y0 = this._y1 = this._y2 = NaN;
    this._l01_a = this._l12_a = this._l23_a = this._l01_2a = this._l12_2a = this._l23_2a = this._point = 0;
  },
  lineEnd: function() {
    if (this._line || this._line !== 0 && this._point === 3)
      this._context.closePath();
    this._line = 1 - this._line;
  },
  point: function(x3, y3) {
    x3 = +x3, y3 = +y3;
    if (this._point) {
      var x23 = this._x2 - x3, y23 = this._y2 - y3;
      this._l23_a = Math.sqrt(this._l23_2a = Math.pow(x23 * x23 + y23 * y23, this._alpha));
    }
    switch (this._point) {
      case 0:
        this._point = 1;
        break;
      case 1:
        this._point = 2;
        break;
      case 2:
        this._point = 3;
        this._line ? this._context.lineTo(this._x2, this._y2) : this._context.moveTo(this._x2, this._y2);
        break;
      case 3:
        this._point = 4;
      default:
        point4(this, x3, y3);
        break;
    }
    this._l01_a = this._l12_a, this._l12_a = this._l23_a;
    this._l01_2a = this._l12_2a, this._l12_2a = this._l23_2a;
    this._x0 = this._x1, this._x1 = this._x2, this._x2 = x3;
    this._y0 = this._y1, this._y1 = this._y2, this._y2 = y3;
  }
};
var catmullRomOpen_default = function custom7(alpha) {
  function catmullRom(context) {
    return alpha ? new CatmullRomOpen(context, alpha) : new CardinalOpen(context, 0);
  }
  catmullRom.alpha = function(alpha2) {
    return custom7(+alpha2);
  };
  return catmullRom;
}(0.5);

// ../../node_modules/d3-shape/src/curve/linearClosed.js
function LinearClosed(context) {
  this._context = context;
}
LinearClosed.prototype = {
  areaStart: noop_default,
  areaEnd: noop_default,
  lineStart: function() {
    this._point = 0;
  },
  lineEnd: function() {
    if (this._point)
      this._context.closePath();
  },
  point: function(x3, y3) {
    x3 = +x3, y3 = +y3;
    if (this._point)
      this._context.lineTo(x3, y3);
    else
      this._point = 1, this._context.moveTo(x3, y3);
  }
};
function linearClosed_default(context) {
  return new LinearClosed(context);
}

// ../../node_modules/d3-shape/src/curve/monotone.js
function sign2(x3) {
  return x3 < 0 ? -1 : 1;
}
function slope3(that, x22, y22) {
  var h0 = that._x1 - that._x0, h1 = x22 - that._x1, s0 = (that._y1 - that._y0) / (h0 || h1 < 0 && -0), s1 = (y22 - that._y1) / (h1 || h0 < 0 && -0), p2 = (s0 * h1 + s1 * h0) / (h0 + h1);
  return (sign2(s0) + sign2(s1)) * Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(p2)) || 0;
}
function slope2(that, t5) {
  var h2 = that._x1 - that._x0;
  return h2 ? (3 * (that._y1 - that._y0) / h2 - t5) / 2 : t5;
}
function point5(that, t03, t13) {
  var x05 = that._x0, y05 = that._y0, x12 = that._x1, y12 = that._y1, dx = (x12 - x05) / 3;
  that._context.bezierCurveTo(x05 + dx, y05 + dx * t03, x12 - dx, y12 - dx * t13, x12, y12);
}
function MonotoneX(context) {
  this._context = context;
}
MonotoneX.prototype = {
  areaStart: function() {
    this._line = 0;
  },
  areaEnd: function() {
    this._line = NaN;
  },
  lineStart: function() {
    this._x0 = this._x1 = this._y0 = this._y1 = this._t0 = NaN;
    this._point = 0;
  },
  lineEnd: function() {
    switch (this._point) {
      case 2:
        this._context.lineTo(this._x1, this._y1);
        break;
      case 3:
        point5(this, this._t0, slope2(this, this._t0));
        break;
    }
    if (this._line || this._line !== 0 && this._point === 1)
      this._context.closePath();
    this._line = 1 - this._line;
  },
  point: function(x3, y3) {
    var t13 = NaN;
    x3 = +x3, y3 = +y3;
    if (x3 === this._x1 && y3 === this._y1)
      return;
    switch (this._point) {
      case 0:
        this._point = 1;
        this._line ? this._context.lineTo(x3, y3) : this._context.moveTo(x3, y3);
        break;
      case 1:
        this._point = 2;
        break;
      case 2:
        this._point = 3;
        point5(this, slope2(this, t13 = slope3(this, x3, y3)), t13);
        break;
      default:
        point5(this, this._t0, t13 = slope3(this, x3, y3));
        break;
    }
    this._x0 = this._x1, this._x1 = x3;
    this._y0 = this._y1, this._y1 = y3;
    this._t0 = t13;
  }
};
function MonotoneY(context) {
  this._context = new ReflectContext(context);
}
(MonotoneY.prototype = Object.create(MonotoneX.prototype)).point = function(x3, y3) {
  MonotoneX.prototype.point.call(this, y3, x3);
};
function ReflectContext(context) {
  this._context = context;
}
ReflectContext.prototype = {
  moveTo: function(x3, y3) {
    this._context.moveTo(y3, x3);
  },
  closePath: function() {
    this._context.closePath();
  },
  lineTo: function(x3, y3) {
    this._context.lineTo(y3, x3);
  },
  bezierCurveTo: function(x12, y12, x22, y22, x3, y3) {
    this._context.bezierCurveTo(y12, x12, y22, x22, y3, x3);
  }
};
function monotoneX(context) {
  return new MonotoneX(context);
}
function monotoneY(context) {
  return new MonotoneY(context);
}

// ../../node_modules/d3-shape/src/curve/natural.js
function Natural(context) {
  this._context = context;
}
Natural.prototype = {
  areaStart: function() {
    this._line = 0;
  },
  areaEnd: function() {
    this._line = NaN;
  },
  lineStart: function() {
    this._x = [];
    this._y = [];
  },
  lineEnd: function() {
    var x3 = this._x, y3 = this._y, n2 = x3.length;
    if (n2) {
      this._line ? this._context.lineTo(x3[0], y3[0]) : this._context.moveTo(x3[0], y3[0]);
      if (n2 === 2) {
        this._context.lineTo(x3[1], y3[1]);
      } else {
        var px = controlPoints(x3), py = controlPoints(y3);
        for (var i0 = 0, i1 = 1; i1 < n2; ++i0, ++i1) {
          this._context.bezierCurveTo(px[0][i0], py[0][i0], px[1][i0], py[1][i0], x3[i1], y3[i1]);
        }
      }
    }
    if (this._line || this._line !== 0 && n2 === 1)
      this._context.closePath();
    this._line = 1 - this._line;
    this._x = this._y = null;
  },
  point: function(x3, y3) {
    this._x.push(+x3);
    this._y.push(+y3);
  }
};
function controlPoints(x3) {
  var i2, n2 = x3.length - 1, m, a3 = new Array(n2), b2 = new Array(n2), r2 = new Array(n2);
  a3[0] = 0, b2[0] = 2, r2[0] = x3[0] + 2 * x3[1];
  for (i2 = 1; i2 < n2 - 1; ++i2)
    a3[i2] = 1, b2[i2] = 4, r2[i2] = 4 * x3[i2] + 2 * x3[i2 + 1];
  a3[n2 - 1] = 2, b2[n2 - 1] = 7, r2[n2 - 1] = 8 * x3[n2 - 1] + x3[n2];
  for (i2 = 1; i2 < n2; ++i2)
    m = a3[i2] / b2[i2 - 1], b2[i2] -= m, r2[i2] -= m * r2[i2 - 1];
  a3[n2 - 1] = r2[n2 - 1] / b2[n2 - 1];
  for (i2 = n2 - 2; i2 >= 0; --i2)
    a3[i2] = (r2[i2] - a3[i2 + 1]) / b2[i2];
  b2[n2 - 1] = (x3[n2] + a3[n2 - 1]) / 2;
  for (i2 = 0; i2 < n2 - 1; ++i2)
    b2[i2] = 2 * x3[i2 + 1] - a3[i2 + 1];
  return [a3, b2];
}
function natural_default(context) {
  return new Natural(context);
}

// ../../node_modules/d3-shape/src/curve/step.js
function Step(context, t5) {
  this._context = context;
  this._t = t5;
}
Step.prototype = {
  areaStart: function() {
    this._line = 0;
  },
  areaEnd: function() {
    this._line = NaN;
  },
  lineStart: function() {
    this._x = this._y = NaN;
    this._point = 0;
  },
  lineEnd: function() {
    if (0 < this._t && this._t < 1 && this._point === 2)
      this._context.lineTo(this._x, this._y);
    if (this._line || this._line !== 0 && this._point === 1)
      this._context.closePath();
    if (this._line >= 0)
      this._t = 1 - this._t, this._line = 1 - this._line;
  },
  point: function(x3, y3) {
    x3 = +x3, y3 = +y3;
    switch (this._point) {
      case 0:
        this._point = 1;
        this._line ? this._context.lineTo(x3, y3) : this._context.moveTo(x3, y3);
        break;
      case 1:
        this._point = 2;
      default: {
        if (this._t <= 0) {
          this._context.lineTo(this._x, y3);
          this._context.lineTo(x3, y3);
        } else {
          var x12 = this._x * (1 - this._t) + x3 * this._t;
          this._context.lineTo(x12, this._y);
          this._context.lineTo(x12, y3);
        }
        break;
      }
    }
    this._x = x3, this._y = y3;
  }
};
function step_default(context) {
  return new Step(context, 0.5);
}
function stepBefore(context) {
  return new Step(context, 0);
}
function stepAfter(context) {
  return new Step(context, 1);
}

// ../../node_modules/d3-zoom/src/transform.js
function Transform(k3, x3, y3) {
  this.k = k3;
  this.x = x3;
  this.y = y3;
}
Transform.prototype = {
  constructor: Transform,
  scale: function(k3) {
    return k3 === 1 ? this : new Transform(this.k * k3, this.x, this.y);
  },
  translate: function(x3, y3) {
    return x3 === 0 & y3 === 0 ? this : new Transform(this.k, this.x + this.k * x3, this.y + this.k * y3);
  },
  apply: function(point6) {
    return [point6[0] * this.k + this.x, point6[1] * this.k + this.y];
  },
  applyX: function(x3) {
    return x3 * this.k + this.x;
  },
  applyY: function(y3) {
    return y3 * this.k + this.y;
  },
  invert: function(location) {
    return [(location[0] - this.x) / this.k, (location[1] - this.y) / this.k];
  },
  invertX: function(x3) {
    return (x3 - this.x) / this.k;
  },
  invertY: function(y3) {
    return (y3 - this.y) / this.k;
  },
  rescaleX: function(x3) {
    return x3.copy().domain(x3.range().map(this.invertX, this).map(x3.invert, x3));
  },
  rescaleY: function(y3) {
    return y3.copy().domain(y3.range().map(this.invertY, this).map(y3.invert, y3));
  },
  toString: function() {
    return "translate(" + this.x + "," + this.y + ") scale(" + this.k + ")";
  }
};
var identity5 = new Transform(1, 0, 0);
transform.prototype = Transform.prototype;
function transform(node) {
  while (!node.__zoom)
    if (!(node = node.parentNode))
      return identity5;
  return node.__zoom;
}

// ../../node_modules/@observablehq/plot/src/defined.js
function defined(x3) {
  return x3 != null && !Number.isNaN(x3);
}
function ascendingDefined2(a3, b2) {
  return +defined(b2) - +defined(a3) || ascending(a3, b2);
}
function descendingDefined(a3, b2) {
  return +defined(b2) - +defined(a3) || descending(a3, b2);
}
function nonempty(x3) {
  return x3 != null && `${x3}` !== "";
}
function finite(x3) {
  return isFinite(x3) ? x3 : NaN;
}
function positive(x3) {
  return x3 > 0 && isFinite(x3) ? x3 : NaN;
}
function negative(x3) {
  return x3 < 0 && isFinite(x3) ? x3 : NaN;
}

// ../../node_modules/isoformat/src/format.js
function format2(date2, fallback) {
  if (!(date2 instanceof Date))
    date2 = /* @__PURE__ */ new Date(+date2);
  if (isNaN(date2))
    return typeof fallback === "function" ? fallback(date2) : fallback;
  const hours = date2.getUTCHours();
  const minutes = date2.getUTCMinutes();
  const seconds2 = date2.getUTCSeconds();
  const milliseconds2 = date2.getUTCMilliseconds();
  return `${formatYear2(date2.getUTCFullYear(), 4)}-${pad2(date2.getUTCMonth() + 1, 2)}-${pad2(date2.getUTCDate(), 2)}${hours || minutes || seconds2 || milliseconds2 ? `T${pad2(hours, 2)}:${pad2(minutes, 2)}${seconds2 || milliseconds2 ? `:${pad2(seconds2, 2)}${milliseconds2 ? `.${pad2(milliseconds2, 3)}` : ``}` : ``}Z` : ``}`;
}
function formatYear2(year) {
  return year < 0 ? `-${pad2(-year, 6)}` : year > 9999 ? `+${pad2(year, 6)}` : pad2(year, 4);
}
function pad2(value, width) {
  return `${value}`.padStart(width, "0");
}

// ../../node_modules/isoformat/src/parse.js
var re2 = /^(?:[-+]\d{2})?\d{4}(?:-\d{2}(?:-\d{2})?)?(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{3})?)?(?:Z|[-+]\d{2}:?\d{2})?)?$/;
function parse(string2, fallback) {
  if (!re2.test(string2 += ""))
    return typeof fallback === "function" ? fallback(string2) : fallback;
  return new Date(string2);
}

// ../../node_modules/@observablehq/plot/src/order.js
function orderof(values2) {
  if (values2 == null)
    return;
  const first2 = values2[0];
  const last = values2[values2.length - 1];
  return descending(first2, last);
}

// ../../node_modules/@observablehq/plot/src/time.js
var durationSecond2 = 1e3;
var durationMinute2 = durationSecond2 * 60;
var durationHour2 = durationMinute2 * 60;
var durationDay2 = durationHour2 * 24;
var durationWeek2 = durationDay2 * 7;
var durationMonth2 = durationDay2 * 30;
var durationYear2 = durationDay2 * 365;
var tickIntervals = [
  ["millisecond", 1],
  ["2 milliseconds", 2],
  ["5 milliseconds", 5],
  ["10 milliseconds", 10],
  ["20 milliseconds", 20],
  ["50 milliseconds", 50],
  ["100 milliseconds", 100],
  ["200 milliseconds", 200],
  ["500 milliseconds", 500],
  ["second", durationSecond2],
  ["5 seconds", 5 * durationSecond2],
  ["15 seconds", 15 * durationSecond2],
  ["30 seconds", 30 * durationSecond2],
  ["minute", durationMinute2],
  ["5 minutes", 5 * durationMinute2],
  ["15 minutes", 15 * durationMinute2],
  ["30 minutes", 30 * durationMinute2],
  ["hour", durationHour2],
  ["3 hours", 3 * durationHour2],
  ["6 hours", 6 * durationHour2],
  ["12 hours", 12 * durationHour2],
  ["day", durationDay2],
  ["2 days", 2 * durationDay2],
  ["week", durationWeek2],
  ["2 weeks", 2 * durationWeek2],
  // https://github.com/d3/d3-time/issues/46
  ["month", durationMonth2],
  ["3 months", 3 * durationMonth2],
  ["6 months", 6 * durationMonth2],
  // https://github.com/d3/d3-time/issues/46
  ["year", durationYear2],
  ["2 years", 2 * durationYear2],
  ["5 years", 5 * durationYear2],
  ["10 years", 10 * durationYear2],
  ["20 years", 20 * durationYear2],
  ["50 years", 50 * durationYear2],
  ["100 years", 100 * durationYear2]
  // TODO generalize to longer time scales
];
var durations = /* @__PURE__ */ new Map([
  ["second", durationSecond2],
  ["minute", durationMinute2],
  ["hour", durationHour2],
  ["day", durationDay2],
  ["monday", durationWeek2],
  ["tuesday", durationWeek2],
  ["wednesday", durationWeek2],
  ["thursday", durationWeek2],
  ["friday", durationWeek2],
  ["saturday", durationWeek2],
  ["sunday", durationWeek2],
  ["week", durationWeek2],
  ["month", durationMonth2],
  ["year", durationYear2]
]);
var timeIntervals = /* @__PURE__ */ new Map([
  ["second", second],
  ["minute", timeMinute],
  ["hour", timeHour],
  ["day", timeDay],
  // https://github.com/d3/d3-time/issues/62
  ["monday", timeMonday],
  ["tuesday", timeTuesday],
  ["wednesday", timeWednesday],
  ["thursday", timeThursday],
  ["friday", timeFriday],
  ["saturday", timeSaturday],
  ["sunday", timeSunday],
  ["week", timeSunday],
  ["month", timeMonth],
  ["year", timeYear]
]);
var utcIntervals = /* @__PURE__ */ new Map([
  ["second", second],
  ["minute", utcMinute],
  ["hour", utcHour],
  ["day", unixDay],
  ["monday", utcMonday],
  ["tuesday", utcTuesday],
  ["wednesday", utcWednesday],
  ["thursday", utcThursday],
  ["friday", utcFriday],
  ["saturday", utcSaturday],
  ["sunday", utcSunday],
  ["week", utcSunday],
  ["month", utcMonth],
  ["year", utcYear]
]);
var intervalDuration = Symbol("intervalDuration");
var intervalType = Symbol("intervalType");
for (const [name, interval2] of timeIntervals) {
  interval2[intervalDuration] = durations.get(name);
  interval2[intervalType] = "time";
}
for (const [name, interval2] of utcIntervals) {
  interval2[intervalDuration] = durations.get(name);
  interval2[intervalType] = "utc";
}
var utcFormatIntervals = [
  ["year", utcYear, "utc"],
  ["month", utcMonth, "utc"],
  ["day", unixDay, "utc", 6 * durationMonth2],
  ["hour", utcHour, "utc", 3 * durationDay2],
  ["minute", utcMinute, "utc", 6 * durationHour2],
  ["second", second, "utc", 30 * durationMinute2]
];
var timeFormatIntervals = [
  ["year", timeYear, "time"],
  ["month", timeMonth, "time"],
  ["day", timeDay, "time", 6 * durationMonth2],
  ["hour", timeHour, "time", 3 * durationDay2],
  ["minute", timeMinute, "time", 6 * durationHour2],
  ["second", second, "time", 30 * durationMinute2]
];
var formatIntervals = [
  utcFormatIntervals[0],
  timeFormatIntervals[0],
  utcFormatIntervals[1],
  timeFormatIntervals[1],
  utcFormatIntervals[2],
  timeFormatIntervals[2],
  // Below day, local time typically has an hourly offset from UTC and hence the
  // two are aligned and indistinguishable; therefore, we only consider UTC, and
  // we don’t consider these if the domain only has a single value.
  ...utcFormatIntervals.slice(3)
];
function parseTimeInterval(input) {
  let name = `${input}`.toLowerCase();
  if (name.endsWith("s"))
    name = name.slice(0, -1);
  let period = 1;
  const match = /^(?:(\d+)\s+)/.exec(name);
  if (match) {
    name = name.slice(match[0].length);
    period = +match[1];
  }
  switch (name) {
    case "quarter":
      name = "month";
      period *= 3;
      break;
    case "half":
      name = "month";
      period *= 6;
      break;
  }
  let interval2 = utcIntervals.get(name);
  if (!interval2)
    throw new Error(`unknown interval: ${input}`);
  if (period > 1 && !interval2.every)
    throw new Error(`non-periodic interval: ${name}`);
  return [name, period];
}
function timeInterval2(input) {
  return asInterval(parseTimeInterval(input), "time");
}
function utcInterval(input) {
  return asInterval(parseTimeInterval(input), "utc");
}
function asInterval([name, period], type2) {
  let interval2 = (type2 === "time" ? timeIntervals : utcIntervals).get(name);
  if (period > 1) {
    interval2 = interval2.every(period);
    interval2[intervalDuration] = durations.get(name) * period;
    interval2[intervalType] = type2;
  }
  return interval2;
}
function generalizeTimeInterval(interval2, n2) {
  if (!(n2 > 1))
    return;
  const duration = interval2[intervalDuration];
  if (!tickIntervals.some(([, d2]) => d2 === duration))
    return;
  if (duration % durationDay2 === 0 && durationDay2 < duration && duration < durationMonth2)
    return;
  const [i2] = tickIntervals[bisector(([, step]) => Math.log(step)).center(tickIntervals, Math.log(duration * n2))];
  return (interval2[intervalType] === "time" ? timeInterval2 : utcInterval)(i2);
}
function formatTimeInterval(name, type2, anchor) {
  const format3 = type2 === "time" ? timeFormat : utcFormat;
  if (anchor == null) {
    return format3(
      name === "year" ? "%Y" : name === "month" ? "%Y-%m" : name === "day" ? "%Y-%m-%d" : name === "hour" || name === "minute" ? "%Y-%m-%dT%H:%M" : name === "second" ? "%Y-%m-%dT%H:%M:%S" : "%Y-%m-%dT%H:%M:%S.%L"
    );
  }
  const template2 = getTimeTemplate(anchor);
  switch (name) {
    case "millisecond":
      return formatConditional(format3(".%L"), format3(":%M:%S"), template2);
    case "second":
      return formatConditional(format3(":%S"), format3("%-I:%M"), template2);
    case "minute":
      return formatConditional(format3("%-I:%M"), format3("%p"), template2);
    case "hour":
      return formatConditional(format3("%-I %p"), format3("%b %-d"), template2);
    case "day":
      return formatConditional(format3("%-d"), format3("%b"), template2);
    case "month":
      return formatConditional(format3("%b"), format3("%Y"), template2);
    case "year":
      return format3("%Y");
  }
  throw new Error("unable to format time ticks");
}
function getTimeTemplate(anchor) {
  return anchor === "left" || anchor === "right" ? (f1, f2) => `
${f1}
${f2}` : anchor === "top" ? (f1, f2) => `${f2}
${f1}` : (f1, f2) => `${f1}
${f2}`;
}
function getFormatIntervals(type2) {
  return type2 === "time" ? timeFormatIntervals : type2 === "utc" ? utcFormatIntervals : formatIntervals;
}
function inferTimeFormat(type2, dates, anchor) {
  const step = max(pairs(dates, (a3, b2) => Math.abs(b2 - a3)));
  if (step < 1e3)
    return formatTimeInterval("millisecond", "utc", anchor);
  for (const [name, interval2, intervalType2, maxStep] of getFormatIntervals(type2)) {
    if (step > maxStep)
      break;
    if (name === "hour" && !step)
      break;
    if (dates.every((d2) => interval2.floor(d2) >= d2))
      return formatTimeInterval(name, intervalType2, anchor);
  }
}
function formatConditional(format1, format22, template2) {
  return (x3, i2, X4) => {
    const f1 = format1(x3, i2);
    const f2 = format22(x3, i2);
    const j2 = i2 - orderof(X4);
    return i2 !== j2 && X4[j2] !== void 0 && f2 === format22(X4[j2], j2) ? f1 : template2(f1, f2);
  };
}

// ../../node_modules/@observablehq/plot/src/options.js
var TypedArray = Object.getPrototypeOf(Uint8Array);
var objectToString = Object.prototype.toString;
function isArray(value) {
  return value instanceof Array || value instanceof TypedArray;
}
function isNumberArray2(value) {
  return value instanceof TypedArray && !isBigIntArray(value);
}
function isNumberType(type2) {
  return type2?.prototype instanceof TypedArray && !isBigIntType(type2);
}
function isBigIntArray(value) {
  return value instanceof BigInt64Array || value instanceof BigUint64Array;
}
function isBigIntType(type2) {
  return type2 === BigInt64Array || type2 === BigUint64Array;
}
var reindex = Symbol("reindex");
function valueof(data, value, type2) {
  const valueType = typeof value;
  return valueType === "string" ? isArrowTable(data) ? maybeTypedArrowify(data.getChild(value), type2) : maybeTypedMap(data, field(value), type2) : valueType === "function" ? maybeTypedMap(data, value, type2) : valueType === "number" || value instanceof Date || valueType === "boolean" ? map2(data, constant(value), type2) : typeof value?.transform === "function" ? maybeTypedArrayify(value.transform(data), type2) : maybeTake(maybeTypedArrayify(value, type2), data?.[reindex]);
}
function maybeTake(values2, index2) {
  return values2 != null && index2 ? take(values2, index2) : values2;
}
function maybeTypedMap(data, f2, type2) {
  return map2(data, isNumberType(type2) ? (d2, i2) => coerceNumber(f2(d2, i2)) : f2, type2);
}
function maybeTypedArrayify(data, type2) {
  return type2 === void 0 ? arrayify2(data) : isArrowVector(data) ? maybeTypedArrowify(data, type2) : data instanceof type2 ? data : type2.from(data, isNumberType(type2) && !isNumberArray2(data) ? coerceNumber : void 0);
}
function maybeTypedArrowify(vector, type2) {
  return vector == null ? vector : (type2 === void 0 || type2 === Array) && isArrowDateType(vector.type) ? coerceDates(vector.toArray()) : maybeTypedArrayify(vector.toArray(), type2);
}
var singleton = [null];
var field = (name) => (d2) => {
  const v2 = d2[name];
  return v2 === void 0 && d2.type === "Feature" ? d2.properties?.[name] : v2;
};
var indexOf = { transform: range2 };
var identity6 = { transform: (d2) => d2 };
var one2 = () => 1;
var yes = () => true;
var string = (x3) => x3 == null ? x3 : `${x3}`;
var number5 = (x3) => x3 == null ? x3 : +x3;
var first = (x3) => x3 ? x3[0] : void 0;
var second2 = (x3) => x3 ? x3[1] : void 0;
var constant = (x3) => () => x3;
function percentile(reduce) {
  const p2 = +`${reduce}`.slice(1) / 100;
  return (I2, f2) => quantile(I2, p2, f2);
}
function coerceNumbers(values2) {
  return isNumberArray2(values2) ? values2 : map2(values2, coerceNumber, Float64Array);
}
function coerceNumber(x3) {
  return x3 == null ? NaN : Number(x3);
}
function coerceDates(values2) {
  return map2(values2, coerceDate);
}
function coerceDate(x3) {
  return x3 instanceof Date && !isNaN(x3) ? x3 : typeof x3 === "string" ? parse(x3) : x3 == null || isNaN(x3 = Number(x3)) ? void 0 : new Date(x3);
}
function maybeColorChannel(value, defaultValue) {
  if (value === void 0)
    value = defaultValue;
  return value === null ? [void 0, "none"] : isColor(value) ? [void 0, value] : [value, void 0];
}
function maybeNumberChannel(value, defaultValue) {
  if (value === void 0)
    value = defaultValue;
  return value === null || typeof value === "number" ? [void 0, value] : [value, void 0];
}
function maybeKeyword(input, name, allowed) {
  if (input != null)
    return keyword(input, name, allowed);
}
function keyword(input, name, allowed) {
  const i2 = `${input}`.toLowerCase();
  if (!allowed.includes(i2))
    throw new Error(`invalid ${name}: ${input}`);
  return i2;
}
function dataify(data) {
  return isArrowTable(data) ? data : arrayify2(data);
}
function arrayify2(values2) {
  if (values2 == null || isArray(values2))
    return values2;
  if (isArrowVector(values2))
    return maybeTypedArrowify(values2);
  switch (values2.type) {
    case "FeatureCollection":
      return values2.features;
    case "GeometryCollection":
      return values2.geometries;
    case "Feature":
    case "LineString":
    case "MultiLineString":
    case "MultiPoint":
    case "MultiPolygon":
    case "Point":
    case "Polygon":
    case "Sphere":
      return [values2];
  }
  return Array.from(values2);
}
function map2(values2, f2, type2 = Array) {
  return values2 == null ? values2 : values2 instanceof type2 ? values2.map(f2) : type2.from(values2, f2);
}
function slice2(values2, type2 = Array) {
  return values2 instanceof type2 ? values2.slice() : type2.from(values2);
}
function hasX({ x: x3, x1: x12, x2: x22 }) {
  return x3 !== void 0 || x12 !== void 0 || x22 !== void 0;
}
function hasY({ y: y3, y1: y12, y2: y22 }) {
  return y3 !== void 0 || y12 !== void 0 || y22 !== void 0;
}
function hasXY(options) {
  return hasX(options) || hasY(options) || options.interval !== void 0;
}
function isObject(option) {
  return option?.toString === objectToString;
}
function isScaleOptions(option) {
  return isObject(option) && (option.type !== void 0 || option.domain !== void 0);
}
function isOptions(option) {
  return isObject(option) && typeof option.transform !== "function";
}
function isDomainSort(sort3) {
  return isOptions(sort3) && sort3.value === void 0 && sort3.channel === void 0;
}
function maybeZero(x3, x12, x22, x32 = identity6) {
  if (x12 === void 0 && x22 === void 0) {
    x12 = 0, x22 = x3 === void 0 ? x32 : x3;
  } else if (x12 === void 0) {
    x12 = x3 === void 0 ? 0 : x3;
  } else if (x22 === void 0) {
    x22 = x3 === void 0 ? 0 : x3;
  }
  return [x12, x22];
}
function maybeTuple(x3, y3) {
  return x3 === void 0 && y3 === void 0 ? [first, second2] : [x3, y3];
}
function maybeZ({ z: z2, fill, stroke } = {}) {
  if (z2 === void 0)
    [z2] = maybeColorChannel(fill);
  if (z2 === void 0)
    [z2] = maybeColorChannel(stroke);
  return z2;
}
function lengthof(data) {
  return isArray(data) ? data.length : data?.numRows;
}
function range2(data) {
  const n2 = lengthof(data);
  const r2 = new Uint32Array(n2);
  for (let i2 = 0; i2 < n2; ++i2)
    r2[i2] = i2;
  return r2;
}
function take(values2, index2) {
  return isArray(values2) ? map2(index2, (i2) => values2[i2], values2.constructor) : map2(index2, (i2) => values2.at(i2));
}
function taker(f2) {
  return f2.length === 1 ? (index2, values2) => f2(take(values2, index2)) : f2;
}
function subarray(I2, i2, j2) {
  return I2.subarray ? I2.subarray(i2, j2) : I2.slice(i2, j2);
}
function keyof2(value) {
  return value !== null && typeof value === "object" ? value.valueOf() : value;
}
function maybeInput(key, options) {
  if (options[key] !== void 0)
    return options[key];
  switch (key) {
    case "x1":
    case "x2":
      key = "x";
      break;
    case "y1":
    case "y2":
      key = "y";
      break;
  }
  return options[key];
}
function column(source) {
  let value;
  return [
    {
      transform: () => value,
      label: labelof(source)
    },
    (v2) => value = v2
  ];
}
function maybeColumn(source) {
  return source == null ? [source] : column(source);
}
function labelof(value, defaultValue) {
  return typeof value === "string" ? value : value && value.label !== void 0 ? value.label : defaultValue;
}
function mid(x12, x22) {
  return {
    transform(data) {
      const X12 = x12.transform(data);
      const X22 = x22.transform(data);
      return isTemporal(X12) || isTemporal(X22) ? map2(X12, (_24, i2) => new Date((+X12[i2] + +X22[i2]) / 2)) : map2(X12, (_24, i2) => (+X12[i2] + +X22[i2]) / 2, Float64Array);
    },
    label: x12.label
  };
}
function maybeApplyInterval(V, scale) {
  const t5 = maybeIntervalTransform(scale?.interval, scale?.type);
  return t5 ? map2(V, t5) : V;
}
function maybeIntervalTransform(interval2, type2) {
  const i2 = maybeInterval(interval2, type2);
  return i2 && ((v2) => defined(v2) ? i2.floor(v2) : v2);
}
function maybeInterval(interval2, type2) {
  if (interval2 == null)
    return;
  if (typeof interval2 === "number")
    return numberInterval(interval2);
  if (typeof interval2 === "string")
    return (type2 === "time" ? timeInterval2 : utcInterval)(interval2);
  if (typeof interval2.floor !== "function")
    throw new Error("invalid interval; missing floor method");
  if (typeof interval2.offset !== "function")
    throw new Error("invalid interval; missing offset method");
  return interval2;
}
function numberInterval(interval2) {
  interval2 = +interval2;
  if (0 < interval2 && interval2 < 1 && Number.isInteger(1 / interval2))
    interval2 = -1 / interval2;
  const n2 = Math.abs(interval2);
  return interval2 < 0 ? {
    floor: (d2) => Math.floor(d2 * n2) / n2,
    offset: (d2, s3 = 1) => (d2 * n2 + Math.floor(s3)) / n2,
    range: (lo, hi) => range(Math.ceil(lo * n2), hi * n2).map((x3) => x3 / n2)
  } : {
    floor: (d2) => Math.floor(d2 / n2) * n2,
    offset: (d2, s3 = 1) => d2 + n2 * Math.floor(s3),
    range: (lo, hi) => range(Math.ceil(lo / n2), hi / n2).map((x3) => x3 * n2)
  };
}
function maybeRangeInterval(interval2, type2) {
  interval2 = maybeInterval(interval2, type2);
  if (interval2 && typeof interval2.range !== "function")
    throw new Error("invalid interval: missing range method");
  return interval2;
}
function maybeNiceInterval(interval2, type2) {
  interval2 = maybeRangeInterval(interval2, type2);
  if (interval2 && typeof interval2.ceil !== "function")
    throw new Error("invalid interval: missing ceil method");
  return interval2;
}
function isTimeInterval(t5) {
  return isInterval(t5) && typeof t5?.floor === "function" && t5.floor() instanceof Date;
}
function isInterval(t5) {
  return typeof t5?.range === "function";
}
function maybeValue(value) {
  return value === void 0 || isOptions(value) ? value : { value };
}
function numberChannel(source) {
  return source == null ? null : {
    transform: (data) => valueof(data, source, Float64Array),
    label: labelof(source)
  };
}
function isIterable(value) {
  return value && typeof value[Symbol.iterator] === "function";
}
function isTextual(values2) {
  for (const value of values2) {
    if (value == null)
      continue;
    return typeof value !== "object" || value instanceof Date;
  }
}
function isOrdinal(values2) {
  for (const value of values2) {
    if (value == null)
      continue;
    const type2 = typeof value;
    return type2 === "string" || type2 === "boolean";
  }
}
function isTemporal(values2) {
  for (const value of values2) {
    if (value == null)
      continue;
    return value instanceof Date;
  }
}
function isTemporalString(values2) {
  for (const value of values2) {
    if (value == null)
      continue;
    return typeof value === "string" && isNaN(value) && parse(value);
  }
}
function isNumericString(values2) {
  for (const value of values2) {
    if (value == null)
      continue;
    if (typeof value !== "string")
      return false;
    if (!value.trim())
      continue;
    return !isNaN(value);
  }
}
function isNumeric(values2) {
  for (const value of values2) {
    if (value == null)
      continue;
    return typeof value === "number";
  }
}
function isEvery(values2, is) {
  let every;
  for (const value of values2) {
    if (value == null)
      continue;
    if (!is(value))
      return false;
    every = true;
  }
  return every;
}
var namedColors = new Set("none,currentcolor,transparent,aliceblue,antiquewhite,aqua,aquamarine,azure,beige,bisque,black,blanchedalmond,blue,blueviolet,brown,burlywood,cadetblue,chartreuse,chocolate,coral,cornflowerblue,cornsilk,crimson,cyan,darkblue,darkcyan,darkgoldenrod,darkgray,darkgreen,darkgrey,darkkhaki,darkmagenta,darkolivegreen,darkorange,darkorchid,darkred,darksalmon,darkseagreen,darkslateblue,darkslategray,darkslategrey,darkturquoise,darkviolet,deeppink,deepskyblue,dimgray,dimgrey,dodgerblue,firebrick,floralwhite,forestgreen,fuchsia,gainsboro,ghostwhite,gold,goldenrod,gray,green,greenyellow,grey,honeydew,hotpink,indianred,indigo,ivory,khaki,lavender,lavenderblush,lawngreen,lemonchiffon,lightblue,lightcoral,lightcyan,lightgoldenrodyellow,lightgray,lightgreen,lightgrey,lightpink,lightsalmon,lightseagreen,lightskyblue,lightslategray,lightslategrey,lightsteelblue,lightyellow,lime,limegreen,linen,magenta,maroon,mediumaquamarine,mediumblue,mediumorchid,mediumpurple,mediumseagreen,mediumslateblue,mediumspringgreen,mediumturquoise,mediumvioletred,midnightblue,mintcream,mistyrose,moccasin,navajowhite,navy,oldlace,olive,olivedrab,orange,orangered,orchid,palegoldenrod,palegreen,paleturquoise,palevioletred,papayawhip,peachpuff,peru,pink,plum,powderblue,purple,rebeccapurple,red,rosybrown,royalblue,saddlebrown,salmon,sandybrown,seagreen,seashell,sienna,silver,skyblue,slateblue,slategray,slategrey,snow,springgreen,steelblue,tan,teal,thistle,tomato,turquoise,violet,wheat,white,whitesmoke,yellow".split(","));
function isColor(value) {
  if (typeof value !== "string")
    return false;
  value = value.toLowerCase().trim();
  return /^#[0-9a-f]{3,8}$/.test(value) || // hex rgb, rgba, rrggbb, rrggbbaa
  /^(?:url|var|rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color|color-mix)\(.*\)$/.test(value) || // <funciri>, CSS variable, color, etc.
  namedColors.has(value);
}
function isOpacity(value) {
  return typeof value === "number" && (0 <= value && value <= 1 || isNaN(value));
}
function isNoneish(value) {
  return value == null || isNone(value);
}
function isNone(value) {
  return /^\s*none\s*$/i.test(value);
}
function isRound(value) {
  return /^\s*round\s*$/i.test(value);
}
function maybeAnchor(value, name) {
  return maybeKeyword(value, name, [
    "middle",
    "top-left",
    "top",
    "top-right",
    "right",
    "bottom-right",
    "bottom",
    "bottom-left",
    "left"
  ]);
}
function maybeFrameAnchor(value = "middle") {
  return maybeAnchor(value, "frameAnchor");
}
function inherit2(options = {}, ...rest) {
  let o2 = options;
  for (const defaults12 of rest) {
    for (const key in defaults12) {
      if (o2[key] === void 0) {
        const value = defaults12[key];
        if (o2 === options)
          o2 = { ...o2, [key]: value };
        else
          o2[key] = value;
      }
    }
  }
  return o2;
}
function named2(things) {
  console.warn("named iterables are deprecated; please use an object instead");
  const names = /* @__PURE__ */ new Set();
  return Object.fromEntries(
    Array.from(things, (thing) => {
      const { name } = thing;
      if (name == null)
        throw new Error("missing name");
      const key = `${name}`;
      if (key === "__proto__")
        throw new Error(`illegal name: ${key}`);
      if (names.has(key))
        throw new Error(`duplicate name: ${key}`);
      names.add(key);
      return [name, thing];
    })
  );
}
function maybeNamed(things) {
  return isIterable(things) ? named2(things) : things;
}
function maybeClip(clip) {
  if (clip === true)
    clip = "frame";
  else if (clip === false)
    clip = null;
  else if (clip != null)
    clip = keyword(clip, "clip", ["frame", "sphere"]);
  return clip;
}
function isArrowTable(value) {
  return value && typeof value.getChild === "function" && typeof value.toArray === "function" && value.schema && Array.isArray(value.schema.fields);
}
function isArrowVector(value) {
  return value && typeof value.toArray === "function" && value.type;
}
function isArrowDateType(type2) {
  return type2 && (type2.typeId === 8 || // date
  type2.typeId === 10) && // timestamp
  type2.unit === 1;
}

// ../../node_modules/@observablehq/plot/src/scales/index.js
var position = Symbol("position");
var color2 = Symbol("color");
var radius = Symbol("radius");
var length2 = Symbol("length");
var opacity = Symbol("opacity");
var symbol = Symbol("symbol");
var projection2 = Symbol("projection");
var registry = /* @__PURE__ */ new Map([
  ["x", position],
  ["y", position],
  ["fx", position],
  ["fy", position],
  ["r", radius],
  ["color", color2],
  ["opacity", opacity],
  ["symbol", symbol],
  ["length", length2],
  ["projection", projection2]
]);
function isPosition(kind) {
  return kind === position || kind === projection2;
}
function hasNumericRange(kind) {
  return kind === position || kind === radius || kind === length2 || kind === opacity;
}

// ../../node_modules/@observablehq/plot/src/symbol.js
var sqrt35 = Math.sqrt(3);
var sqrt4_3 = 2 / sqrt35;
var symbolHexagon = {
  draw(context, size) {
    const rx = Math.sqrt(size / Math.PI), ry = rx * sqrt4_3, hy = ry / 2;
    context.moveTo(0, ry);
    context.lineTo(rx, hy);
    context.lineTo(rx, -hy);
    context.lineTo(0, -ry);
    context.lineTo(-rx, -hy);
    context.lineTo(-rx, hy);
    context.closePath();
  }
};
var symbols = /* @__PURE__ */ new Map([
  ["asterisk", asterisk_default],
  ["circle", circle_default2],
  ["cross", cross_default],
  ["diamond", diamond_default],
  ["diamond2", diamond2_default],
  ["hexagon", symbolHexagon],
  ["plus", plus_default],
  ["square", square_default],
  ["square2", square2_default],
  ["star", star_default],
  ["times", times_default],
  ["triangle", triangle_default],
  ["triangle2", triangle2_default],
  ["wye", wye_default]
]);
function isSymbolObject(value) {
  return value && typeof value.draw === "function";
}
function isSymbol(value) {
  if (isSymbolObject(value))
    return true;
  if (typeof value !== "string")
    return false;
  return symbols.has(value.toLowerCase());
}
function maybeSymbol(symbol2) {
  if (symbol2 == null || isSymbolObject(symbol2))
    return symbol2;
  const value = symbols.get(`${symbol2}`.toLowerCase());
  if (value)
    return value;
  throw new Error(`invalid symbol: ${symbol2}`);
}
function maybeSymbolChannel(symbol2) {
  if (symbol2 == null || isSymbolObject(symbol2))
    return [void 0, symbol2];
  if (typeof symbol2 === "string") {
    const value = symbols.get(`${symbol2}`.toLowerCase());
    if (value)
      return [void 0, value];
  }
  return [symbol2, void 0];
}

// ../../node_modules/@observablehq/plot/src/transforms/basic.js
function basic({ filter: f1, sort: s1, reverse: r1, transform: t13, initializer: i1, ...options } = {}, transform2) {
  if (t13 === void 0) {
    if (f1 != null)
      t13 = filterTransform(f1);
    if (s1 != null && !isDomainSort(s1))
      t13 = composeTransform(t13, sortTransform(s1));
    if (r1)
      t13 = composeTransform(t13, reverseTransform);
  }
  if (transform2 != null && i1 != null)
    throw new Error("transforms cannot be applied after initializers");
  return {
    ...options,
    ...(s1 === null || isDomainSort(s1)) && { sort: s1 },
    transform: composeTransform(t13, transform2)
  };
}
function initializer({ filter: f1, sort: s1, reverse: r1, initializer: i1, ...options } = {}, initializer2) {
  if (i1 === void 0) {
    if (f1 != null)
      i1 = filterTransform(f1);
    if (s1 != null && !isDomainSort(s1))
      i1 = composeInitializer(i1, sortTransform(s1));
    if (r1)
      i1 = composeInitializer(i1, reverseTransform);
  }
  return {
    ...options,
    ...(s1 === null || isDomainSort(s1)) && { sort: s1 },
    initializer: composeInitializer(i1, initializer2)
  };
}
function composeTransform(t13, t22) {
  if (t13 == null)
    return t22 === null ? void 0 : t22;
  if (t22 == null)
    return t13 === null ? void 0 : t13;
  return function(data, facets, plotOptions) {
    ({ data, facets } = t13.call(this, data, facets, plotOptions));
    return t22.call(this, dataify(data), facets, plotOptions);
  };
}
function composeInitializer(i1, i2) {
  if (i1 == null)
    return i2 === null ? void 0 : i2;
  if (i2 == null)
    return i1 === null ? void 0 : i1;
  return function(data, facets, channels, ...args) {
    let c1, d1, f1, c22, d2, f2;
    ({ data: d1 = data, facets: f1 = facets, channels: c1 } = i1.call(this, data, facets, channels, ...args));
    ({ data: d2 = d1, facets: f2 = f1, channels: c22 } = i2.call(this, d1, f1, { ...channels, ...c1 }, ...args));
    return { data: d2, facets: f2, channels: { ...c1, ...c22 } };
  };
}
function apply(options, t5) {
  return (options.initializer != null ? initializer : basic)(options, t5);
}
function filterTransform(value) {
  return (data, facets) => {
    const V = valueof(data, value);
    return { data, facets: facets.map((I2) => I2.filter((i2) => V[i2])) };
  };
}
function reverseTransform(data, facets) {
  return { data, facets: facets.map((I2) => I2.slice().reverse()) };
}
function sort2(order, { sort: sort3, ...options } = {}) {
  return {
    ...(isOptions(order) && order.channel !== void 0 ? initializer : apply)(options, sortTransform(order)),
    sort: isDomainSort(sort3) ? sort3 : null
  };
}
function sortTransform(value) {
  return (typeof value === "function" && value.length !== 1 ? sortData : sortValue)(value);
}
function sortData(compare) {
  return (data, facets) => {
    const compareData = isArray(data) ? (i2, j2) => compare(data[i2], data[j2]) : (i2, j2) => compare(data.get(i2), data.get(j2));
    return { data, facets: facets.map((I2) => I2.slice().sort(compareData)) };
  };
}
function sortValue(value) {
  let channel, order;
  ({ channel, value, order } = { ...maybeValue(value) });
  const negate = channel?.startsWith("-");
  if (negate)
    channel = channel.slice(1);
  if (order === void 0)
    order = negate ? descendingDefined : ascendingDefined2;
  if (typeof order !== "function") {
    switch (`${order}`.toLowerCase()) {
      case "ascending":
        order = ascendingDefined2;
        break;
      case "descending":
        order = descendingDefined;
        break;
      default:
        throw new Error(`invalid order: ${order}`);
    }
  }
  return (data, facets, channels) => {
    let V;
    if (channel === void 0) {
      V = valueof(data, value);
    } else {
      if (channels === void 0)
        throw new Error("channel sort requires an initializer");
      V = channels[channel];
      if (!V)
        return {};
      V = V.value;
    }
    const compareValue2 = (i2, j2) => order(V[i2], V[j2]);
    return { data, facets: facets.map((I2) => I2.slice().sort(compareValue2)) };
  };
}

// ../../node_modules/@observablehq/plot/src/transforms/group.js
function groupZ(outputs, options) {
  return groupn(null, null, outputs, options);
}
function groupX(outputs = { y: "count" }, options = {}) {
  const { x: x3 = identity6 } = options;
  if (x3 == null)
    throw new Error("missing channel: x");
  return groupn(x3, null, outputs, options);
}
function groupY(outputs = { x: "count" }, options = {}) {
  const { y: y3 = identity6 } = options;
  if (y3 == null)
    throw new Error("missing channel: y");
  return groupn(null, y3, outputs, options);
}
function groupn(x3, y3, {
  data: reduceData = reduceIdentity,
  filter: filter2,
  sort: sort3,
  reverse: reverse2,
  ...outputs
  // output channel definitions
} = {}, inputs = {}) {
  outputs = maybeGroupOutputs(outputs, inputs);
  reduceData = maybeGroupReduce(reduceData, identity6);
  sort3 = sort3 == null ? void 0 : maybeGroupOutput("sort", sort3, inputs);
  filter2 = filter2 == null ? void 0 : maybeGroupEvaluator("filter", filter2, inputs);
  const [GX, setGX] = maybeColumn(x3);
  const [GY, setGY] = maybeColumn(y3);
  const {
    z: z2,
    fill,
    stroke,
    x1: x12,
    x2: x22,
    // consumed if x is an output
    y1: y12,
    y2: y22,
    // consumed if y is an output
    ...options
  } = inputs;
  const [GZ, setGZ] = maybeColumn(z2);
  const [vfill] = maybeColorChannel(fill);
  const [vstroke] = maybeColorChannel(stroke);
  const [GF, setGF] = maybeColumn(vfill);
  const [GS, setGS] = maybeColumn(vstroke);
  return {
    ..."z" in inputs && { z: GZ || z2 },
    ..."fill" in inputs && { fill: GF || fill },
    ..."stroke" in inputs && { stroke: GS || stroke },
    ...basic(options, (data, facets, plotOptions) => {
      const X4 = maybeApplyInterval(valueof(data, x3), plotOptions?.x);
      const Y4 = maybeApplyInterval(valueof(data, y3), plotOptions?.y);
      const Z3 = valueof(data, z2);
      const F = valueof(data, vfill);
      const S2 = valueof(data, vstroke);
      const G2 = maybeSubgroup(outputs, { z: Z3, fill: F, stroke: S2 });
      const groupFacets = [];
      const groupData = [];
      const GX2 = X4 && setGX([]);
      const GY2 = Y4 && setGY([]);
      const GZ2 = Z3 && setGZ([]);
      const GF2 = F && setGF([]);
      const GS2 = S2 && setGS([]);
      let i2 = 0;
      for (const o2 of outputs)
        o2.initialize(data);
      if (sort3)
        sort3.initialize(data);
      if (filter2)
        filter2.initialize(data);
      for (const facet of facets) {
        const groupFacet = [];
        for (const o2 of outputs)
          o2.scope("facet", facet);
        if (sort3)
          sort3.scope("facet", facet);
        if (filter2)
          filter2.scope("facet", facet);
        for (const [f2, I2] of maybeGroup(facet, G2)) {
          for (const [y4, gg] of maybeGroup(I2, Y4)) {
            for (const [x4, g2] of maybeGroup(gg, X4)) {
              const extent3 = { data };
              if (X4)
                extent3.x = x4;
              if (Y4)
                extent3.y = y4;
              if (G2)
                extent3.z = f2;
              if (filter2 && !filter2.reduce(g2, extent3))
                continue;
              groupFacet.push(i2++);
              groupData.push(reduceData.reduceIndex(g2, data, extent3));
              if (X4)
                GX2.push(x4);
              if (Y4)
                GY2.push(y4);
              if (Z3)
                GZ2.push(G2 === Z3 ? f2 : Z3[g2[0]]);
              if (F)
                GF2.push(G2 === F ? f2 : F[g2[0]]);
              if (S2)
                GS2.push(G2 === S2 ? f2 : S2[g2[0]]);
              for (const o2 of outputs)
                o2.reduce(g2, extent3);
              if (sort3)
                sort3.reduce(g2, extent3);
            }
          }
        }
        groupFacets.push(groupFacet);
      }
      maybeSort(groupFacets, sort3, reverse2);
      return { data: groupData, facets: groupFacets };
    }),
    ...!hasOutput(outputs, "x") && (GX ? { x: GX } : { x1: x12, x2: x22 }),
    ...!hasOutput(outputs, "y") && (GY ? { y: GY } : { y1: y12, y2: y22 }),
    ...Object.fromEntries(outputs.map(({ name, output: output2 }) => [name, output2]))
  };
}
function hasOutput(outputs, ...names) {
  for (const { name } of outputs) {
    if (names.includes(name)) {
      return true;
    }
  }
  return false;
}
function maybeOutputs(outputs, inputs, asOutput = maybeOutput) {
  const entries = Object.entries(outputs);
  if (inputs.title != null && outputs.title === void 0)
    entries.push(["title", reduceTitle]);
  if (inputs.href != null && outputs.href === void 0)
    entries.push(["href", reduceFirst]);
  return entries.filter(([, reduce]) => reduce !== void 0).map(([name, reduce]) => reduce === null ? nullOutput(name) : asOutput(name, reduce, inputs));
}
function maybeOutput(name, reduce, inputs, asEvaluator = maybeEvaluator) {
  let scale;
  if (isObject(reduce) && "reduce" in reduce)
    scale = reduce.scale, reduce = reduce.reduce;
  const evaluator = asEvaluator(name, reduce, inputs);
  const [output2, setOutput] = column(evaluator.label);
  let O2;
  return {
    name,
    output: scale === void 0 ? output2 : { value: output2, scale },
    initialize(data) {
      evaluator.initialize(data);
      O2 = setOutput([]);
    },
    scope(scope, I2) {
      evaluator.scope(scope, I2);
    },
    reduce(I2, extent3) {
      O2.push(evaluator.reduce(I2, extent3));
    }
  };
}
function nullOutput(name) {
  return { name, initialize() {
  }, scope() {
  }, reduce() {
  } };
}
function maybeEvaluator(name, reduce, inputs, asReduce = maybeReduce) {
  const input = maybeInput(name, inputs);
  const reducer2 = asReduce(reduce, input);
  let V, context;
  return {
    label: labelof(reducer2 === reduceCount ? null : input, reducer2.label),
    initialize(data) {
      V = input === void 0 ? data : valueof(data, input);
      if (reducer2.scope === "data") {
        context = reducer2.reduceIndex(range2(data), V);
      }
    },
    scope(scope, I2) {
      if (reducer2.scope === scope) {
        context = reducer2.reduceIndex(I2, V);
      }
    },
    reduce(I2, extent3) {
      return reducer2.scope == null ? reducer2.reduceIndex(I2, V, extent3) : reducer2.reduceIndex(I2, V, context, extent3);
    }
  };
}
function maybeGroup(I2, X4) {
  return X4 ? group(I2, (i2) => X4[i2]) : [[, I2]];
}
function maybeReduce(reduce, value, fallback = invalidReduce) {
  if (reduce == null)
    return fallback(reduce);
  if (typeof reduce.reduceIndex === "function")
    return reduce;
  if (typeof reduce.reduce === "function" && isObject(reduce))
    return reduceReduce(reduce);
  if (typeof reduce === "function")
    return reduceFunction(reduce);
  if (/^p\d{2}$/i.test(reduce))
    return reduceAccessor(percentile(reduce));
  switch (`${reduce}`.toLowerCase()) {
    case "first":
      return reduceFirst;
    case "last":
      return reduceLast;
    case "identity":
      return reduceIdentity;
    case "count":
      return reduceCount;
    case "distinct":
      return reduceDistinct;
    case "sum":
      return value == null ? reduceCount : reduceSum;
    case "proportion":
      return reduceProportion(value, "data");
    case "proportion-facet":
      return reduceProportion(value, "facet");
    case "deviation":
      return reduceAccessor(deviation);
    case "min":
      return reduceAccessor(min);
    case "min-index":
      return reduceAccessor(minIndex);
    case "max":
      return reduceAccessor(max);
    case "max-index":
      return reduceAccessor(maxIndex);
    case "mean":
      return reduceMaybeTemporalAccessor(mean);
    case "median":
      return reduceMaybeTemporalAccessor(median);
    case "variance":
      return reduceAccessor(variance);
    case "mode":
      return reduceAccessor(mode);
  }
  return fallback(reduce);
}
function invalidReduce(reduce) {
  throw new Error(`invalid reduce: ${reduce}`);
}
function maybeGroupOutputs(outputs, inputs) {
  return maybeOutputs(outputs, inputs, maybeGroupOutput);
}
function maybeGroupOutput(name, reduce, inputs) {
  return maybeOutput(name, reduce, inputs, maybeGroupEvaluator);
}
function maybeGroupEvaluator(name, reduce, inputs) {
  return maybeEvaluator(name, reduce, inputs, maybeGroupReduce);
}
function maybeGroupReduce(reduce, value) {
  return maybeReduce(reduce, value, maybeGroupReduceFallback);
}
function maybeGroupReduceFallback(reduce) {
  switch (`${reduce}`.toLowerCase()) {
    case "x":
      return reduceX;
    case "y":
      return reduceY;
    case "z":
      return reduceZ;
  }
  throw new Error(`invalid group reduce: ${reduce}`);
}
function maybeSubgroup(outputs, inputs) {
  for (const name in inputs) {
    const value = inputs[name];
    if (value !== void 0 && !outputs.some((o2) => o2.name === name)) {
      return value;
    }
  }
}
function maybeSort(facets, sort3, reverse2) {
  if (sort3) {
    const S2 = sort3.output.transform();
    const compare = (i2, j2) => ascendingDefined2(S2[i2], S2[j2]);
    facets.forEach((f2) => f2.sort(compare));
  }
  if (reverse2) {
    facets.forEach((f2) => f2.reverse());
  }
}
function reduceReduce(reduce) {
  console.warn("deprecated reduce interface; implement reduceIndex instead.");
  return { ...reduce, reduceIndex: reduce.reduce.bind(reduce) };
}
function reduceFunction(f2) {
  return {
    reduceIndex(I2, X4, extent3) {
      return f2(take(X4, I2), extent3);
    }
  };
}
function reduceAccessor(f2) {
  return {
    reduceIndex(I2, X4) {
      return f2(I2, (i2) => X4[i2]);
    }
  };
}
function reduceMaybeTemporalAccessor(f2) {
  return {
    reduceIndex(I2, X4) {
      const x3 = f2(I2, (i2) => X4[i2]);
      return isTemporal(X4) ? new Date(x3) : x3;
    }
  };
}
var reduceIdentity = {
  reduceIndex(I2, X4) {
    return take(X4, I2);
  }
};
var reduceFirst = {
  reduceIndex(I2, X4) {
    return X4[I2[0]];
  }
};
var reduceTitle = {
  reduceIndex(I2, X4) {
    const n2 = 5;
    const groups2 = sort(
      rollup(
        I2,
        (V) => V.length,
        (i2) => X4[i2]
      ),
      second2
    );
    const top2 = groups2.slice(-n2).reverse();
    if (top2.length < groups2.length) {
      const bottom2 = groups2.slice(0, 1 - n2);
      top2[n2 - 1] = [`\u2026 ${bottom2.length.toLocaleString("en-US")} more`, sum(bottom2, second2)];
    }
    return top2.map(([key, value]) => `${key} (${value.toLocaleString("en-US")})`).join("\n");
  }
};
var reduceLast = {
  reduceIndex(I2, X4) {
    return X4[I2[I2.length - 1]];
  }
};
var reduceCount = {
  label: "Frequency",
  reduceIndex(I2) {
    return I2.length;
  }
};
var reduceDistinct = {
  label: "Distinct",
  reduceIndex(I2, X4) {
    const s3 = new InternSet();
    for (const i2 of I2)
      s3.add(X4[i2]);
    return s3.size;
  }
};
var reduceSum = reduceAccessor(sum);
function reduceProportion(value, scope) {
  return value == null ? { scope, label: "Frequency", reduceIndex: (I2, V, basis2 = 1) => I2.length / basis2 } : { scope, reduceIndex: (I2, V, basis2 = 1) => sum(I2, (i2) => V[i2]) / basis2 };
}
var reduceX = {
  reduceIndex(I2, X4, { x: x3 }) {
    return x3;
  }
};
var reduceY = {
  reduceIndex(I2, X4, { y: y3 }) {
    return y3;
  }
};
var reduceZ = {
  reduceIndex(I2, X4, { z: z2 }) {
    return z2;
  }
};

// ../../node_modules/@observablehq/plot/src/channel.js
function createChannel(data, { scale, type: type2, value, filter: filter2, hint, label = labelof(value) }, name) {
  if (hint === void 0 && typeof value?.transform === "function")
    hint = value.hint;
  return inferChannelScale(name, {
    scale,
    type: type2,
    value: valueof(data, value),
    label,
    filter: filter2,
    hint
  });
}
function createChannels(channels, data) {
  return Object.fromEntries(
    Object.entries(channels).map(([name, channel]) => [name, createChannel(data, channel, name)])
  );
}
function valueObject(channels, scales) {
  const values2 = Object.fromEntries(
    Object.entries(channels).map(([name, { scale: scaleName, value }]) => {
      const scale = scaleName == null ? null : scales[scaleName];
      return [name, scale == null ? value : map2(value, scale)];
    })
  );
  values2.channels = channels;
  return values2;
}
function inferChannelScale(name, channel) {
  const { scale, value } = channel;
  if (scale === true || scale === "auto") {
    switch (name) {
      case "fill":
      case "stroke":
      case "color":
        channel.scale = scale !== true && isEvery(value, isColor) ? null : "color";
        channel.defaultScale = "color";
        break;
      case "fillOpacity":
      case "strokeOpacity":
      case "opacity":
        channel.scale = scale !== true && isEvery(value, isOpacity) ? null : "opacity";
        channel.defaultScale = "opacity";
        break;
      case "symbol":
        if (scale !== true && isEvery(value, isSymbol)) {
          channel.scale = null;
          channel.value = map2(value, maybeSymbol);
        } else {
          channel.scale = "symbol";
        }
        channel.defaultScale = "symbol";
        break;
      default:
        channel.scale = registry.has(name) ? name : null;
        break;
    }
  } else if (scale === false) {
    channel.scale = null;
  } else if (scale != null && !registry.has(scale)) {
    throw new Error(`unknown scale: ${scale}`);
  }
  return channel;
}
function channelDomain(data, facets, channels, facetChannels, options) {
  const { order: defaultOrder, reverse: defaultReverse, reduce: defaultReduce = true, limit: defaultLimit } = options;
  for (const x3 in options) {
    if (!registry.has(x3))
      continue;
    let { value: y3, order = defaultOrder, reverse: reverse2 = defaultReverse, reduce = defaultReduce, limit = defaultLimit } = maybeValue(options[x3]);
    const negate = y3?.startsWith("-");
    if (negate)
      y3 = y3.slice(1);
    order = order === void 0 ? negate !== (y3 === "width" || y3 === "height") ? descendingGroup : ascendingGroup : maybeOrder(order);
    if (reduce == null || reduce === false)
      continue;
    const X4 = x3 === "fx" || x3 === "fy" ? reindexFacetChannel(facets, facetChannels[x3]) : findScaleChannel(channels, x3);
    if (!X4)
      throw new Error(`missing channel for scale: ${x3}`);
    const XV = X4.value;
    const [lo = 0, hi = Infinity] = isIterable(limit) ? limit : limit < 0 ? [limit] : [0, limit];
    if (y3 == null) {
      X4.domain = () => {
        let domain = Array.from(new InternSet(XV));
        if (reverse2)
          domain = domain.reverse();
        if (lo !== 0 || hi !== Infinity)
          domain = domain.slice(lo, hi);
        return domain;
      };
    } else {
      const YV = y3 === "data" ? data : y3 === "height" ? difference(channels, "y1", "y2") : y3 === "width" ? difference(channels, "x1", "x2") : values(channels, y3, y3 === "y" ? "y2" : y3 === "x" ? "x2" : void 0);
      const reducer2 = maybeReduce(reduce === true ? "max" : reduce, YV);
      X4.domain = () => {
        let domain = rollups(
          range2(XV),
          (I2) => reducer2.reduceIndex(I2, YV),
          (i2) => XV[i2]
        );
        if (order)
          domain.sort(order);
        if (reverse2)
          domain.reverse();
        if (lo !== 0 || hi !== Infinity)
          domain = domain.slice(lo, hi);
        return domain.map(first);
      };
    }
  }
}
function findScaleChannel(channels, scale) {
  for (const name in channels) {
    const channel = channels[name];
    if (channel.scale === scale)
      return channel;
  }
}
function reindexFacetChannel(facets, channel) {
  const originalFacets = facets.original;
  if (originalFacets === facets)
    return channel;
  const V1 = channel.value;
  const V2 = channel.value = [];
  for (let i2 = 0; i2 < originalFacets.length; ++i2) {
    const vi = V1[originalFacets[i2][0]];
    for (const j2 of facets[i2])
      V2[j2] = vi;
  }
  return channel;
}
function difference(channels, k1, k22) {
  const X12 = values(channels, k1);
  const X22 = values(channels, k22);
  return map2(X22, (x22, i2) => Math.abs(x22 - X12[i2]), Float64Array);
}
function values(channels, name, alias) {
  let channel = channels[name];
  if (!channel && alias !== void 0)
    channel = channels[alias];
  if (channel)
    return channel.value;
  throw new Error(`missing channel: ${name}`);
}
function maybeOrder(order) {
  if (order == null || typeof order === "function")
    return order;
  switch (`${order}`.toLowerCase()) {
    case "ascending":
      return ascendingGroup;
    case "descending":
      return descendingGroup;
  }
  throw new Error(`invalid order: ${order}`);
}
function ascendingGroup([ak, av], [bk, bv]) {
  return ascendingDefined2(av, bv) || ascendingDefined2(ak, bk);
}
function descendingGroup([ak, av], [bk, bv]) {
  return descendingDefined(av, bv) || ascendingDefined2(ak, bk);
}
function getSource(channels, key) {
  let channel = channels[key];
  if (!channel)
    return;
  while (channel.source)
    channel = channel.source;
  return channel.source === null ? null : channel;
}

// ../../node_modules/@observablehq/plot/src/scales/schemes.js
var categoricalSchemes = /* @__PURE__ */ new Map([
  ["accent", Accent_default],
  ["category10", category10_default],
  ["dark2", Dark2_default],
  ["observable10", observable10_default],
  ["paired", Paired_default],
  ["pastel1", Pastel1_default],
  ["pastel2", Pastel2_default],
  ["set1", Set1_default],
  ["set2", Set2_default],
  ["set3", Set3_default],
  ["tableau10", Tableau10_default]
]);
function isCategoricalScheme(scheme28) {
  return scheme28 != null && categoricalSchemes.has(`${scheme28}`.toLowerCase());
}
var ordinalSchemes = new Map([
  ...categoricalSchemes,
  // diverging
  ["brbg", scheme112(scheme, BrBG_default)],
  ["prgn", scheme112(scheme2, PRGn_default)],
  ["piyg", scheme112(scheme3, PiYG_default)],
  ["puor", scheme112(scheme4, PuOr_default)],
  ["rdbu", scheme112(scheme5, RdBu_default)],
  ["rdgy", scheme112(scheme6, RdGy_default)],
  ["rdylbu", scheme112(scheme7, RdYlBu_default)],
  ["rdylgn", scheme112(scheme8, RdYlGn_default)],
  ["spectral", scheme112(scheme9, Spectral_default)],
  // reversed diverging (for temperature data)
  ["burd", scheme11r(scheme5, RdBu_default)],
  ["buylrd", scheme11r(scheme7, RdYlBu_default)],
  // sequential (single-hue)
  ["blues", scheme92(scheme22, Blues_default)],
  ["greens", scheme92(scheme23, Greens_default)],
  ["greys", scheme92(scheme24, Greys_default)],
  ["oranges", scheme92(scheme27, Oranges_default)],
  ["purples", scheme92(scheme25, Purples_default)],
  ["reds", scheme92(scheme26, Reds_default)],
  // sequential (multi-hue)
  ["turbo", schemei(turbo_default)],
  ["viridis", schemei(viridis_default)],
  ["magma", schemei(magma)],
  ["inferno", schemei(inferno)],
  ["plasma", schemei(plasma)],
  ["cividis", schemei(cividis_default)],
  ["cubehelix", schemei(cubehelix_default2)],
  ["warm", schemei(warm)],
  ["cool", schemei(cool)],
  ["bugn", scheme92(scheme10, BuGn_default)],
  ["bupu", scheme92(scheme11, BuPu_default)],
  ["gnbu", scheme92(scheme12, GnBu_default)],
  ["orrd", scheme92(scheme13, OrRd_default)],
  ["pubu", scheme92(scheme15, PuBu_default)],
  ["pubugn", scheme92(scheme14, PuBuGn_default)],
  ["purd", scheme92(scheme16, PuRd_default)],
  ["rdpu", scheme92(scheme17, RdPu_default)],
  ["ylgn", scheme92(scheme19, YlGn_default)],
  ["ylgnbu", scheme92(scheme18, YlGnBu_default)],
  ["ylorbr", scheme92(scheme20, YlOrBr_default)],
  ["ylorrd", scheme92(scheme21, YlOrRd_default)],
  // cyclical
  ["rainbow", schemeicyclical(rainbow_default)],
  ["sinebow", schemeicyclical(sinebow_default)]
]);
function scheme92(scheme28, interpolate) {
  return ({ length: n2 }) => {
    if (n2 === 1)
      return [scheme28[3][1]];
    if (n2 === 2)
      return [scheme28[3][1], scheme28[3][2]];
    n2 = Math.max(3, Math.floor(n2));
    return n2 > 9 ? quantize_default(interpolate, n2) : scheme28[n2];
  };
}
function scheme112(scheme28, interpolate) {
  return ({ length: n2 }) => {
    if (n2 === 2)
      return [scheme28[3][0], scheme28[3][2]];
    n2 = Math.max(3, Math.floor(n2));
    return n2 > 11 ? quantize_default(interpolate, n2) : scheme28[n2];
  };
}
function scheme11r(scheme28, interpolate) {
  return ({ length: n2 }) => {
    if (n2 === 2)
      return [scheme28[3][2], scheme28[3][0]];
    n2 = Math.max(3, Math.floor(n2));
    return n2 > 11 ? quantize_default((t5) => interpolate(1 - t5), n2) : scheme28[n2].slice().reverse();
  };
}
function schemei(interpolate) {
  return ({ length: n2 }) => quantize_default(interpolate, Math.max(2, Math.floor(n2)));
}
function schemeicyclical(interpolate) {
  return ({ length: n2 }) => quantize_default(interpolate, Math.floor(n2) + 1).slice(0, -1);
}
function ordinalScheme(scheme28) {
  const s3 = `${scheme28}`.toLowerCase();
  if (!ordinalSchemes.has(s3))
    throw new Error(`unknown ordinal scheme: ${s3}`);
  return ordinalSchemes.get(s3);
}
function ordinalRange(scheme28, length3) {
  const s3 = ordinalScheme(scheme28);
  const r2 = typeof s3 === "function" ? s3({ length: length3 }) : s3;
  return r2.length !== length3 ? r2.slice(0, length3) : r2;
}
function maybeBooleanRange(domain, scheme28 = "greys") {
  const range3 = /* @__PURE__ */ new Set();
  const [f2, t5] = ordinalRange(scheme28, 2);
  for (const value of domain) {
    if (value == null)
      continue;
    if (value === true)
      range3.add(t5);
    else if (value === false)
      range3.add(f2);
    else
      return;
  }
  return [...range3];
}
var quantitativeSchemes = /* @__PURE__ */ new Map([
  // diverging
  ["brbg", BrBG_default],
  ["prgn", PRGn_default],
  ["piyg", PiYG_default],
  ["puor", PuOr_default],
  ["rdbu", RdBu_default],
  ["rdgy", RdGy_default],
  ["rdylbu", RdYlBu_default],
  ["rdylgn", RdYlGn_default],
  ["spectral", Spectral_default],
  // reversed diverging (for temperature data)
  ["burd", (t5) => RdBu_default(1 - t5)],
  ["buylrd", (t5) => RdYlBu_default(1 - t5)],
  // sequential (single-hue)
  ["blues", Blues_default],
  ["greens", Greens_default],
  ["greys", Greys_default],
  ["purples", Purples_default],
  ["reds", Reds_default],
  ["oranges", Oranges_default],
  // sequential (multi-hue)
  ["turbo", turbo_default],
  ["viridis", viridis_default],
  ["magma", magma],
  ["inferno", inferno],
  ["plasma", plasma],
  ["cividis", cividis_default],
  ["cubehelix", cubehelix_default2],
  ["warm", warm],
  ["cool", cool],
  ["bugn", BuGn_default],
  ["bupu", BuPu_default],
  ["gnbu", GnBu_default],
  ["orrd", OrRd_default],
  ["pubugn", PuBuGn_default],
  ["pubu", PuBu_default],
  ["purd", PuRd_default],
  ["rdpu", RdPu_default],
  ["ylgnbu", YlGnBu_default],
  ["ylgn", YlGn_default],
  ["ylorbr", YlOrBr_default],
  ["ylorrd", YlOrRd_default],
  // cyclical
  ["rainbow", rainbow_default],
  ["sinebow", sinebow_default]
]);
function quantitativeScheme(scheme28) {
  const s3 = `${scheme28}`.toLowerCase();
  if (!quantitativeSchemes.has(s3))
    throw new Error(`unknown quantitative scheme: ${s3}`);
  return quantitativeSchemes.get(s3);
}
var divergingSchemes = /* @__PURE__ */ new Set([
  "brbg",
  "prgn",
  "piyg",
  "puor",
  "rdbu",
  "rdgy",
  "rdylbu",
  "rdylgn",
  "spectral",
  "burd",
  "buylrd"
]);
function isDivergingScheme(scheme28) {
  return scheme28 != null && divergingSchemes.has(`${scheme28}`.toLowerCase());
}

// ../../node_modules/@observablehq/plot/src/scales/quantitative.js
var flip = (i2) => (t5) => i2(1 - t5);
var unit2 = [0, 1];
var interpolators = /* @__PURE__ */ new Map([
  // numbers
  ["number", number_default],
  // color spaces
  ["rgb", rgb_default],
  ["hsl", hsl_default],
  ["hcl", hcl_default],
  ["lab", lab2]
]);
function maybeInterpolator(interpolate) {
  const i2 = `${interpolate}`.toLowerCase();
  if (!interpolators.has(i2))
    throw new Error(`unknown interpolator: ${i2}`);
  return interpolators.get(i2);
}
function createScaleQ(key, scale, channels, {
  type: type2,
  nice: nice2,
  clamp,
  zero: zero3,
  domain = inferAutoDomain(key, channels),
  unknown,
  round,
  scheme: scheme28,
  interval: interval2,
  range: range3 = registry.get(key) === radius ? inferRadialRange(channels, domain) : registry.get(key) === length2 ? inferLengthRange(channels, domain) : registry.get(key) === opacity ? unit2 : void 0,
  interpolate = registry.get(key) === color2 ? scheme28 == null && range3 !== void 0 ? rgb_default : quantitativeScheme(scheme28 !== void 0 ? scheme28 : type2 === "cyclical" ? "rainbow" : "turbo") : round ? round_default : number_default,
  reverse: reverse2
}) {
  interval2 = maybeRangeInterval(interval2, type2);
  if (type2 === "cyclical" || type2 === "sequential")
    type2 = "linear";
  if (typeof interpolate !== "function")
    interpolate = maybeInterpolator(interpolate);
  reverse2 = !!reverse2;
  if (range3 !== void 0) {
    const n2 = (domain = arrayify2(domain)).length;
    const m = (range3 = arrayify2(range3)).length;
    if (n2 !== m) {
      if (interpolate.length === 1)
        throw new Error("invalid piecewise interpolator");
      interpolate = piecewise(interpolate, range3);
      range3 = void 0;
    }
  }
  if (interpolate.length === 1) {
    if (reverse2) {
      interpolate = flip(interpolate);
      reverse2 = false;
    }
    if (range3 === void 0) {
      range3 = Float64Array.from(domain, (_24, i2) => i2 / (domain.length - 1));
      if (range3.length === 2)
        range3 = unit2;
    }
    scale.interpolate((range3 === unit2 ? constant : interpolatePiecewise)(interpolate));
  } else {
    scale.interpolate(interpolate);
  }
  if (zero3) {
    const [min4, max3] = extent(domain);
    if (min4 > 0 || max3 < 0) {
      domain = slice2(domain);
      const o2 = orderof(domain) || 1;
      if (o2 === Math.sign(min4))
        domain[0] = 0;
      else
        domain[domain.length - 1] = 0;
    }
  }
  if (reverse2)
    domain = reverse(domain);
  scale.domain(domain).unknown(unknown);
  if (nice2)
    scale.nice(maybeNice(nice2, type2)), domain = scale.domain();
  if (range3 !== void 0)
    scale.range(range3);
  if (clamp)
    scale.clamp(clamp);
  return { type: type2, domain, range: range3, scale, interpolate, interval: interval2 };
}
function maybeNice(nice2, type2) {
  return nice2 === true ? void 0 : typeof nice2 === "number" ? nice2 : maybeNiceInterval(nice2, type2);
}
function createScaleLinear(key, channels, options) {
  return createScaleQ(key, linear2(), channels, options);
}
function createScaleSqrt(key, channels, options) {
  return createScalePow(key, channels, { ...options, exponent: 0.5 });
}
function createScalePow(key, channels, { exponent = 1, ...options }) {
  return createScaleQ(key, pow2().exponent(exponent), channels, { ...options, type: "pow" });
}
function createScaleLog(key, channels, { base = 10, domain = inferLogDomain(channels), ...options }) {
  return createScaleQ(key, log2().base(base), channels, { ...options, domain });
}
function createScaleSymlog(key, channels, { constant: constant2 = 1, ...options }) {
  return createScaleQ(key, symlog().constant(constant2), channels, options);
}
function createScaleQuantile(key, channels, {
  range: range3,
  quantiles = range3 === void 0 ? 5 : (range3 = [...range3]).length,
  // deprecated; use n instead
  n: n2 = quantiles,
  scheme: scheme28 = "rdylbu",
  domain = inferQuantileDomain(channels),
  unknown,
  interpolate,
  reverse: reverse2
}) {
  if (range3 === void 0) {
    range3 = interpolate !== void 0 ? quantize_default(interpolate, n2) : registry.get(key) === color2 ? ordinalRange(scheme28, n2) : void 0;
  }
  if (domain.length > 0) {
    domain = quantile2(domain, range3 === void 0 ? { length: n2 } : range3).quantiles();
  }
  return createScaleThreshold(key, channels, { domain, range: range3, reverse: reverse2, unknown });
}
function createScaleQuantize(key, channels, {
  range: range3,
  n: n2 = range3 === void 0 ? 5 : (range3 = [...range3]).length,
  scheme: scheme28 = "rdylbu",
  domain = inferAutoDomain(key, channels),
  unknown,
  interpolate,
  reverse: reverse2
}) {
  const [min4, max3] = extent(domain);
  let thresholds;
  if (range3 === void 0) {
    thresholds = ticks(min4, max3, n2);
    if (thresholds[0] <= min4)
      thresholds.splice(0, 1);
    if (thresholds[thresholds.length - 1] >= max3)
      thresholds.pop();
    n2 = thresholds.length + 1;
    range3 = interpolate !== void 0 ? quantize_default(interpolate, n2) : registry.get(key) === color2 ? ordinalRange(scheme28, n2) : void 0;
  } else {
    thresholds = quantize_default(number_default(min4, max3), n2 + 1).slice(1, -1);
    if (min4 instanceof Date)
      thresholds = thresholds.map((x3) => new Date(x3));
  }
  if (orderof(arrayify2(domain)) < 0)
    thresholds.reverse();
  return createScaleThreshold(key, channels, { domain: thresholds, range: range3, reverse: reverse2, unknown });
}
function createScaleThreshold(key, channels, {
  domain = [0],
  // explicit thresholds in ascending order
  unknown,
  scheme: scheme28 = "rdylbu",
  interpolate,
  range: range3 = interpolate !== void 0 ? quantize_default(interpolate, domain.length + 1) : registry.get(key) === color2 ? ordinalRange(scheme28, domain.length + 1) : void 0,
  reverse: reverse2
}) {
  domain = arrayify2(domain);
  const sign3 = orderof(domain);
  if (!isNaN(sign3) && !isOrdered(domain, sign3))
    throw new Error(`the ${key} scale has a non-monotonic domain`);
  if (reverse2)
    range3 = reverse(range3);
  return {
    type: "threshold",
    scale: threshold(sign3 < 0 ? reverse(domain) : domain, range3 === void 0 ? [] : range3).unknown(unknown),
    domain,
    range: range3
  };
}
function isOrdered(domain, sign3) {
  for (let i2 = 1, n2 = domain.length, d2 = domain[0]; i2 < n2; ++i2) {
    const s3 = descending(d2, d2 = domain[i2]);
    if (s3 !== 0 && s3 !== sign3)
      return false;
  }
  return true;
}
function createScaleIdentity(key) {
  return { type: "identity", scale: hasNumericRange(registry.get(key)) ? identity4() : (d2) => d2 };
}
function inferDomain(channels, f2 = finite) {
  return channels.length ? [
    min(channels, ({ value }) => value === void 0 ? value : min(value, f2)),
    max(channels, ({ value }) => value === void 0 ? value : max(value, f2))
  ] : [0, 1];
}
function inferAutoDomain(key, channels) {
  const type2 = registry.get(key);
  return (type2 === radius || type2 === opacity || type2 === length2 ? inferZeroDomain : inferDomain)(channels);
}
function inferZeroDomain(channels) {
  return [0, channels.length ? max(channels, ({ value }) => value === void 0 ? value : max(value, finite)) : 1];
}
function inferRadialRange(channels, domain) {
  const hint = channels.find(({ radius: radius2 }) => radius2 !== void 0);
  if (hint !== void 0)
    return [0, hint.radius];
  const h25 = quantile(channels, 0.5, ({ value }) => value === void 0 ? NaN : quantile(value, 0.25, positive));
  const range3 = domain.map((d2) => 3 * Math.sqrt(d2 / h25));
  const k3 = 30 / max(range3);
  return k3 < 1 ? range3.map((r2) => r2 * k3) : range3;
}
function inferLengthRange(channels, domain) {
  const h50 = median(channels, ({ value }) => value === void 0 ? NaN : median(value, Math.abs));
  const range3 = domain.map((d2) => 12 * d2 / h50);
  const k3 = 60 / max(range3);
  return k3 < 1 ? range3.map((r2) => r2 * k3) : range3;
}
function inferLogDomain(channels) {
  for (const { value } of channels) {
    if (value !== void 0) {
      for (let v2 of value) {
        if (v2 > 0)
          return inferDomain(channels, positive);
        if (v2 < 0)
          return inferDomain(channels, negative);
      }
    }
  }
  return [1, 10];
}
function inferQuantileDomain(channels) {
  const domain = [];
  for (const { value } of channels) {
    if (value === void 0)
      continue;
    for (const v2 of value)
      domain.push(v2);
  }
  return domain;
}
function interpolatePiecewise(interpolate) {
  return (i2, j2) => (t5) => interpolate(i2 + t5 * (j2 - i2));
}

// ../../node_modules/@observablehq/plot/src/warnings.js
var warnings = 0;
var lastMessage;
function consumeWarnings() {
  const w2 = warnings;
  warnings = 0;
  lastMessage = void 0;
  return w2;
}
function warn(message) {
  if (message === lastMessage)
    return;
  lastMessage = message;
  console.warn(message);
  ++warnings;
}

// ../../node_modules/@observablehq/plot/src/scales/diverging.js
function createScaleD(key, scale, transform2, channels, {
  type: type2,
  nice: nice2,
  clamp,
  domain = inferDomain(channels),
  unknown,
  pivot = 0,
  scheme: scheme28,
  range: range3,
  symmetric = true,
  interpolate = registry.get(key) === color2 ? scheme28 == null && range3 !== void 0 ? rgb_default : quantitativeScheme(scheme28 !== void 0 ? scheme28 : "rdbu") : number_default,
  reverse: reverse2
}) {
  pivot = +pivot;
  domain = arrayify2(domain);
  let [min4, max3] = domain;
  if (domain.length > 2)
    warn(`Warning: the diverging ${key} scale domain contains extra elements.`);
  if (descending(min4, max3) < 0)
    [min4, max3] = [max3, min4], reverse2 = !reverse2;
  min4 = Math.min(min4, pivot);
  max3 = Math.max(max3, pivot);
  if (typeof interpolate !== "function") {
    interpolate = maybeInterpolator(interpolate);
  }
  if (range3 !== void 0) {
    interpolate = interpolate.length === 1 ? interpolatePiecewise(interpolate)(...range3) : piecewise(interpolate, range3);
  }
  if (reverse2)
    interpolate = flip(interpolate);
  if (symmetric) {
    const mid2 = transform2.apply(pivot);
    const mindelta = mid2 - transform2.apply(min4);
    const maxdelta = transform2.apply(max3) - mid2;
    if (mindelta < maxdelta)
      min4 = transform2.invert(mid2 - maxdelta);
    else if (mindelta > maxdelta)
      max3 = transform2.invert(mid2 + mindelta);
  }
  scale.domain([min4, pivot, max3]).unknown(unknown).interpolator(interpolate);
  if (clamp)
    scale.clamp(clamp);
  if (nice2)
    scale.nice(nice2);
  return { type: type2, domain: [min4, max3], pivot, interpolate, scale };
}
function createScaleDiverging(key, channels, options) {
  return createScaleD(key, diverging(), transformIdentity, channels, options);
}
function createScaleDivergingSqrt(key, channels, options) {
  return createScaleDivergingPow(key, channels, { ...options, exponent: 0.5 });
}
function createScaleDivergingPow(key, channels, { exponent = 1, ...options }) {
  return createScaleD(key, divergingPow().exponent(exponent = +exponent), transformPow2(exponent), channels, {
    ...options,
    type: "diverging-pow"
  });
}
function createScaleDivergingLog(key, channels, { base = 10, pivot = 1, domain = inferDomain(channels, pivot < 0 ? negative : positive), ...options }) {
  return createScaleD(key, divergingLog().base(base = +base), transformLog2, channels, {
    domain,
    pivot,
    ...options
  });
}
function createScaleDivergingSymlog(key, channels, { constant: constant2 = 1, ...options }) {
  return createScaleD(
    key,
    divergingSymlog().constant(constant2 = +constant2),
    transformSymlog2(constant2),
    channels,
    options
  );
}
var transformIdentity = {
  apply(x3) {
    return x3;
  },
  invert(x3) {
    return x3;
  }
};
var transformLog2 = {
  apply: Math.log,
  invert: Math.exp
};
var transformSqrt2 = {
  apply(x3) {
    return Math.sign(x3) * Math.sqrt(Math.abs(x3));
  },
  invert(x3) {
    return Math.sign(x3) * (x3 * x3);
  }
};
function transformPow2(exponent) {
  return exponent === 0.5 ? transformSqrt2 : {
    apply(x3) {
      return Math.sign(x3) * Math.pow(Math.abs(x3), exponent);
    },
    invert(x3) {
      return Math.sign(x3) * Math.pow(Math.abs(x3), 1 / exponent);
    }
  };
}
function transformSymlog2(constant2) {
  return {
    apply(x3) {
      return Math.sign(x3) * Math.log1p(Math.abs(x3 / constant2));
    },
    invert(x3) {
      return Math.sign(x3) * Math.expm1(Math.abs(x3)) * constant2;
    }
  };
}

// ../../node_modules/@observablehq/plot/src/scales/temporal.js
function createScaleT(key, scale, channels, options) {
  return createScaleQ(key, scale, channels, options);
}
function createScaleTime(key, channels, options) {
  return createScaleT(key, time(), channels, options);
}
function createScaleUtc(key, channels, options) {
  return createScaleT(key, utcTime(), channels, options);
}

// ../../node_modules/@observablehq/plot/src/scales/ordinal.js
var ordinalImplicit = Symbol("ordinal");
function createScaleO(key, scale, channels, { type: type2, interval: interval2, domain, range: range3, reverse: reverse2, hint }) {
  interval2 = maybeRangeInterval(interval2, type2);
  if (domain === void 0)
    domain = inferDomain2(channels, interval2, key);
  if (type2 === "categorical" || type2 === ordinalImplicit)
    type2 = "ordinal";
  if (reverse2)
    domain = reverse(domain);
  domain = scale.domain(domain).domain();
  if (range3 !== void 0) {
    if (typeof range3 === "function")
      range3 = range3(domain);
    scale.range(range3);
  }
  return { type: type2, domain, range: range3, scale, hint, interval: interval2 };
}
function createScaleOrdinal(key, channels, { type: type2, interval: interval2, domain, range: range3, scheme: scheme28, unknown, ...options }) {
  interval2 = maybeRangeInterval(interval2, type2);
  if (domain === void 0)
    domain = inferDomain2(channels, interval2, key);
  let hint;
  if (registry.get(key) === symbol) {
    hint = inferSymbolHint(channels);
    range3 = range3 === void 0 ? inferSymbolRange(hint) : map2(range3, maybeSymbol);
  } else if (registry.get(key) === color2) {
    if (range3 === void 0 && (type2 === "ordinal" || type2 === ordinalImplicit)) {
      range3 = maybeBooleanRange(domain, scheme28);
      if (range3 !== void 0)
        scheme28 = void 0;
    }
    if (scheme28 === void 0 && range3 === void 0) {
      scheme28 = type2 === "ordinal" ? "turbo" : "observable10";
    }
    if (scheme28 !== void 0) {
      if (range3 !== void 0) {
        const interpolate = quantitativeScheme(scheme28);
        const t03 = range3[0], d2 = range3[1] - range3[0];
        range3 = ({ length: n2 }) => quantize_default((t5) => interpolate(t03 + d2 * t5), n2);
      } else {
        range3 = ordinalScheme(scheme28);
      }
    }
  }
  if (unknown === implicit) {
    throw new Error(`implicit unknown on ${key} scale is not supported`);
  }
  return createScaleO(key, ordinal().unknown(unknown), channels, { ...options, type: type2, domain, range: range3, hint });
}
function createScalePoint(key, channels, { align = 0.5, padding = 0.5, ...options }) {
  return maybeRound(point().align(align).padding(padding), channels, options, key);
}
function createScaleBand(key, channels, {
  align = 0.5,
  padding = 0.1,
  paddingInner = padding,
  paddingOuter = key === "fx" || key === "fy" ? 0 : padding,
  ...options
}) {
  return maybeRound(
    band().align(align).paddingInner(paddingInner).paddingOuter(paddingOuter),
    channels,
    options,
    key
  );
}
function maybeRound(scale, channels, options, key) {
  let { round } = options;
  if (round !== void 0)
    scale.round(round = !!round);
  scale = createScaleO(key, scale, channels, options);
  scale.round = round;
  return scale;
}
function inferDomain2(channels, interval2, key) {
  const values2 = new InternSet();
  for (const { value, domain } of channels) {
    if (domain !== void 0)
      return domain();
    if (value === void 0)
      continue;
    for (const v2 of value)
      values2.add(v2);
  }
  if (interval2 !== void 0) {
    const [min4, max3] = extent(values2).map(interval2.floor, interval2);
    return interval2.range(min4, interval2.offset(max3));
  }
  if (values2.size > 1e4 && registry.get(key) === position) {
    throw new Error(`implicit ordinal domain of ${key} scale has more than 10,000 values`);
  }
  return sort(values2, ascendingDefined2);
}
function inferHint(channels, key) {
  let value;
  for (const { hint } of channels) {
    const candidate = hint?.[key];
    if (candidate === void 0)
      continue;
    if (value === void 0)
      value = candidate;
    else if (value !== candidate)
      return;
  }
  return value;
}
function inferSymbolHint(channels) {
  return {
    fill: inferHint(channels, "fill"),
    stroke: inferHint(channels, "stroke")
  };
}
function inferSymbolRange(hint) {
  return isNoneish(hint.fill) ? symbolsStroke : symbolsFill;
}

// ../../node_modules/@observablehq/plot/src/scales.js
function createScales(channelsByScale, {
  label: globalLabel,
  inset: globalInset = 0,
  insetTop: globalInsetTop = globalInset,
  insetRight: globalInsetRight = globalInset,
  insetBottom: globalInsetBottom = globalInset,
  insetLeft: globalInsetLeft = globalInset,
  round,
  nice: nice2,
  clamp,
  zero: zero3,
  align,
  padding,
  projection: projection3,
  facet: { label: facetLabel = globalLabel } = {},
  ...options
} = {}) {
  const scales = {};
  for (const [key, channels] of channelsByScale) {
    const scaleOptions = options[key];
    const scale = createScale(key, channels, {
      round: registry.get(key) === position ? round : void 0,
      // only for position
      nice: nice2,
      clamp,
      zero: zero3,
      align,
      padding,
      projection: projection3,
      ...scaleOptions
    });
    if (scale) {
      let {
        label = key === "fx" || key === "fy" ? facetLabel : globalLabel,
        percent,
        transform: transform2,
        inset,
        insetTop = inset !== void 0 ? inset : key === "y" ? globalInsetTop : 0,
        // not fy
        insetRight = inset !== void 0 ? inset : key === "x" ? globalInsetRight : 0,
        // not fx
        insetBottom = inset !== void 0 ? inset : key === "y" ? globalInsetBottom : 0,
        // not fy
        insetLeft = inset !== void 0 ? inset : key === "x" ? globalInsetLeft : 0
        // not fx
      } = scaleOptions || {};
      if (transform2 == null)
        transform2 = void 0;
      else if (typeof transform2 !== "function")
        throw new Error("invalid scale transform; not a function");
      scale.percent = !!percent;
      scale.label = label === void 0 ? inferScaleLabel(channels, scale) : label;
      scale.transform = transform2;
      if (key === "x" || key === "fx") {
        scale.insetLeft = +insetLeft;
        scale.insetRight = +insetRight;
      } else if (key === "y" || key === "fy") {
        scale.insetTop = +insetTop;
        scale.insetBottom = +insetBottom;
      }
      scales[key] = scale;
    }
  }
  return scales;
}
function createScaleFunctions(descriptors) {
  const scales = {};
  const scaleFunctions = { scales };
  for (const [key, descriptor] of Object.entries(descriptors)) {
    const { scale, type: type2, interval: interval2, label } = descriptor;
    scales[key] = exposeScale(descriptor);
    scaleFunctions[key] = scale;
    scale.type = type2;
    if (interval2 != null)
      scale.interval = interval2;
    if (label != null)
      scale.label = label;
  }
  return scaleFunctions;
}
function autoScaleRange(scales, dimensions) {
  const { x: x3, y: y3, fx, fy } = scales;
  const superdimensions = fx || fy ? outerDimensions(dimensions) : dimensions;
  if (fx)
    autoScaleRangeX(fx, superdimensions);
  if (fy)
    autoScaleRangeY(fy, superdimensions);
  const subdimensions = fx || fy ? innerDimensions(scales, dimensions) : dimensions;
  if (x3)
    autoScaleRangeX(x3, subdimensions);
  if (y3)
    autoScaleRangeY(y3, subdimensions);
}
function inferScaleLabel(channels = [], scale) {
  let label;
  for (const { label: l2 } of channels) {
    if (l2 === void 0)
      continue;
    if (label === void 0)
      label = l2;
    else if (label !== l2)
      return;
  }
  if (label === void 0)
    return;
  if (!isOrdinalScale(scale) && scale.percent)
    label = `${label} (%)`;
  return { inferred: true, toString: () => label };
}
function inferScaleOrder(scale) {
  return Math.sign(orderof(scale.domain())) * Math.sign(orderof(scale.range()));
}
function outerDimensions(dimensions) {
  const {
    marginTop,
    marginRight,
    marginBottom,
    marginLeft,
    width,
    height,
    facet: {
      marginTop: facetMarginTop,
      marginRight: facetMarginRight,
      marginBottom: facetMarginBottom,
      marginLeft: facetMarginLeft
    }
  } = dimensions;
  return {
    marginTop: Math.max(marginTop, facetMarginTop),
    marginRight: Math.max(marginRight, facetMarginRight),
    marginBottom: Math.max(marginBottom, facetMarginBottom),
    marginLeft: Math.max(marginLeft, facetMarginLeft),
    width,
    height
  };
}
function innerDimensions({ fx, fy }, dimensions) {
  const { marginTop, marginRight, marginBottom, marginLeft, width, height } = outerDimensions(dimensions);
  return {
    marginTop,
    marginRight,
    marginBottom,
    marginLeft,
    width: fx ? fx.scale.bandwidth() + marginLeft + marginRight : width,
    height: fy ? fy.scale.bandwidth() + marginTop + marginBottom : height,
    facet: { width, height }
  };
}
function autoScaleRangeX(scale, dimensions) {
  if (scale.range === void 0) {
    const { insetLeft, insetRight } = scale;
    const { width, marginLeft = 0, marginRight = 0 } = dimensions;
    const left2 = marginLeft + insetLeft;
    const right2 = width - marginRight - insetRight;
    scale.range = [left2, Math.max(left2, right2)];
    if (!isOrdinalScale(scale))
      scale.range = piecewiseRange(scale);
    scale.scale.range(scale.range);
  }
  autoScaleRound(scale);
}
function autoScaleRangeY(scale, dimensions) {
  if (scale.range === void 0) {
    const { insetTop, insetBottom } = scale;
    const { height, marginTop = 0, marginBottom = 0 } = dimensions;
    const top2 = marginTop + insetTop;
    const bottom2 = height - marginBottom - insetBottom;
    scale.range = [Math.max(top2, bottom2), top2];
    if (!isOrdinalScale(scale))
      scale.range = piecewiseRange(scale);
    else
      scale.range.reverse();
    scale.scale.range(scale.range);
  }
  autoScaleRound(scale);
}
function autoScaleRound(scale) {
  if (scale.round === void 0 && isBandScale(scale) && roundError(scale) <= 30) {
    scale.scale.round(true);
  }
}
function roundError({ scale }) {
  const n2 = scale.domain().length;
  const [start2, stop] = scale.range();
  const paddingInner = scale.paddingInner ? scale.paddingInner() : 1;
  const paddingOuter = scale.paddingOuter ? scale.paddingOuter() : scale.padding();
  const m = n2 - paddingInner;
  const step = Math.abs(stop - start2) / Math.max(1, m + paddingOuter * 2);
  return (step - Math.floor(step)) * m;
}
function piecewiseRange(scale) {
  const length3 = scale.scale.domain().length + isThresholdScale(scale);
  if (!(length3 > 2))
    return scale.range;
  const [start2, end] = scale.range;
  return Array.from({ length: length3 }, (_24, i2) => start2 + i2 / (length3 - 1) * (end - start2));
}
function createScale(key, channels = [], options = {}) {
  const type2 = inferScaleType(key, channels, options);
  if (options.type === void 0 && options.domain === void 0 && options.range === void 0 && options.interval == null && key !== "fx" && key !== "fy" && isOrdinalScale({ type: type2 })) {
    const values2 = channels.map(({ value }) => value).filter((value) => value !== void 0);
    if (values2.some(isTemporal))
      warn(
        `Warning: some data associated with the ${key} scale are dates. Dates are typically associated with a "utc" or "time" scale rather than a "${formatScaleType(
          type2
        )}" scale. If you are using a bar mark, you probably want a rect mark with the interval option instead; if you are using a group transform, you probably want a bin transform instead. If you want to treat this data as ordinal, you can specify the interval of the ${key} scale (e.g., d3.utcDay), or you can suppress this warning by setting the type of the ${key} scale to "${formatScaleType(
          type2
        )}".`
      );
    else if (values2.some(isTemporalString))
      warn(
        `Warning: some data associated with the ${key} scale are strings that appear to be dates (e.g., YYYY-MM-DD). If these strings represent dates, you should parse them to Date objects. Dates are typically associated with a "utc" or "time" scale rather than a "${formatScaleType(
          type2
        )}" scale. If you are using a bar mark, you probably want a rect mark with the interval option instead; if you are using a group transform, you probably want a bin transform instead. If you want to treat this data as ordinal, you can suppress this warning by setting the type of the ${key} scale to "${formatScaleType(
          type2
        )}".`
      );
    else if (values2.some(isNumericString))
      warn(
        `Warning: some data associated with the ${key} scale are strings that appear to be numbers. If these strings represent numbers, you should parse or coerce them to numbers. Numbers are typically associated with a "linear" scale rather than a "${formatScaleType(
          type2
        )}" scale. If you want to treat this data as ordinal, you can specify the interval of the ${key} scale (e.g., 1 for integers), or you can suppress this warning by setting the type of the ${key} scale to "${formatScaleType(
          type2
        )}".`
      );
  }
  options.type = type2;
  switch (type2) {
    case "diverging":
    case "diverging-sqrt":
    case "diverging-pow":
    case "diverging-log":
    case "diverging-symlog":
    case "cyclical":
    case "sequential":
    case "linear":
    case "sqrt":
    case "threshold":
    case "quantile":
    case "pow":
    case "log":
    case "symlog":
      options = coerceType(channels, options, coerceNumbers);
      break;
    case "identity":
      switch (registry.get(key)) {
        case position:
          options = coerceType(channels, options, coerceNumbers);
          break;
        case symbol:
          options = coerceType(channels, options, coerceSymbols);
          break;
      }
      break;
    case "utc":
    case "time":
      options = coerceType(channels, options, coerceDates);
      break;
  }
  switch (type2) {
    case "diverging":
      return createScaleDiverging(key, channels, options);
    case "diverging-sqrt":
      return createScaleDivergingSqrt(key, channels, options);
    case "diverging-pow":
      return createScaleDivergingPow(key, channels, options);
    case "diverging-log":
      return createScaleDivergingLog(key, channels, options);
    case "diverging-symlog":
      return createScaleDivergingSymlog(key, channels, options);
    case "categorical":
    case "ordinal":
    case ordinalImplicit:
      return createScaleOrdinal(key, channels, options);
    case "cyclical":
    case "sequential":
    case "linear":
      return createScaleLinear(key, channels, options);
    case "sqrt":
      return createScaleSqrt(key, channels, options);
    case "threshold":
      return createScaleThreshold(key, channels, options);
    case "quantile":
      return createScaleQuantile(key, channels, options);
    case "quantize":
      return createScaleQuantize(key, channels, options);
    case "pow":
      return createScalePow(key, channels, options);
    case "log":
      return createScaleLog(key, channels, options);
    case "symlog":
      return createScaleSymlog(key, channels, options);
    case "utc":
      return createScaleUtc(key, channels, options);
    case "time":
      return createScaleTime(key, channels, options);
    case "point":
      return createScalePoint(key, channels, options);
    case "band":
      return createScaleBand(key, channels, options);
    case "identity":
      return createScaleIdentity(key);
    case void 0:
      return;
    default:
      throw new Error(`unknown scale type: ${type2}`);
  }
}
function formatScaleType(type2) {
  return typeof type2 === "symbol" ? type2.description : type2;
}
function maybeScaleType(type2) {
  return typeof type2 === "string" ? `${type2}`.toLowerCase() : type2;
}
var typeProjection = { toString: () => "projection" };
function inferScaleType(key, channels, { type: type2, domain, range: range3, scheme: scheme28, pivot, projection: projection3 }) {
  type2 = maybeScaleType(type2);
  if (key === "fx" || key === "fy")
    return "band";
  if ((key === "x" || key === "y") && projection3 != null)
    type2 = typeProjection;
  for (const channel of channels) {
    const t5 = maybeScaleType(channel.type);
    if (t5 === void 0)
      continue;
    else if (type2 === void 0)
      type2 = t5;
    else if (type2 !== t5)
      throw new Error(`scale incompatible with channel: ${type2} !== ${t5}`);
  }
  if (type2 === typeProjection)
    return;
  if (type2 !== void 0)
    return type2;
  if (domain === void 0 && !channels.some(({ value }) => value !== void 0))
    return;
  const kind = registry.get(key);
  if (kind === radius)
    return "sqrt";
  if (kind === opacity || kind === length2)
    return "linear";
  if (kind === symbol)
    return "ordinal";
  if ((domain || range3 || []).length > 2)
    return asOrdinalType(kind);
  if (domain !== void 0) {
    if (isOrdinal(domain))
      return asOrdinalType(kind);
    if (isTemporal(domain))
      return "utc";
  } else {
    const values2 = channels.map(({ value }) => value).filter((value) => value !== void 0);
    if (values2.some(isOrdinal))
      return asOrdinalType(kind);
    if (values2.some(isTemporal))
      return "utc";
  }
  if (kind === color2) {
    if (pivot != null || isDivergingScheme(scheme28))
      return "diverging";
    if (isCategoricalScheme(scheme28))
      return "categorical";
  }
  return "linear";
}
function asOrdinalType(kind) {
  switch (kind) {
    case position:
      return "point";
    case color2:
      return ordinalImplicit;
    default:
      return "ordinal";
  }
}
function isOrdinalScale({ type: type2 }) {
  return type2 === "ordinal" || type2 === "point" || type2 === "band" || type2 === ordinalImplicit;
}
function isThresholdScale({ type: type2 }) {
  return type2 === "threshold";
}
function isBandScale({ type: type2 }) {
  return type2 === "point" || type2 === "band";
}
function isCollapsed(scale) {
  if (scale === void 0)
    return true;
  const domain = scale.domain();
  const value = scale(domain[0]);
  for (let i2 = 1, n2 = domain.length; i2 < n2; ++i2) {
    if (scale(domain[i2]) - value) {
      return false;
    }
  }
  return true;
}
function coerceType(channels, { domain, ...options }, coerceValues) {
  for (const c5 of channels) {
    if (c5.value !== void 0) {
      if (domain === void 0)
        domain = c5.value?.domain;
      c5.value = coerceValues(c5.value);
    }
  }
  return {
    domain: domain === void 0 ? domain : coerceValues(domain),
    ...options
  };
}
function coerceSymbols(values2) {
  return map2(values2, maybeSymbol);
}
function exposeScales(scales) {
  return (key) => {
    if (!registry.has(key = `${key}`))
      throw new Error(`unknown scale: ${key}`);
    return scales[key];
  };
}
function exposeScale({ scale, type: type2, domain, range: range3, interpolate, interval: interval2, transform: transform2, percent, pivot }) {
  if (type2 === "identity")
    return { type: "identity", apply: (d2) => d2, invert: (d2) => d2 };
  const unknown = scale.unknown ? scale.unknown() : void 0;
  return {
    type: type2,
    domain: slice2(domain),
    // defensive copy
    ...range3 !== void 0 && { range: slice2(range3) },
    // defensive copy
    ...transform2 !== void 0 && { transform: transform2 },
    ...percent && { percent },
    // only exposed if truthy
    ...unknown !== void 0 && { unknown },
    ...interval2 !== void 0 && { interval: interval2 },
    // quantitative
    ...interpolate !== void 0 && { interpolate },
    ...scale.clamp && { clamp: scale.clamp() },
    // diverging (always asymmetric; we never want to apply the symmetric transform twice)
    ...pivot !== void 0 && { pivot, symmetric: false },
    // log, diverging-log
    ...scale.base && { base: scale.base() },
    // pow, diverging-pow
    ...scale.exponent && { exponent: scale.exponent() },
    // symlog, diverging-symlog
    ...scale.constant && { constant: scale.constant() },
    // band, point
    ...scale.align && { align: scale.align(), round: scale.round() },
    ...scale.padding && (scale.paddingInner ? { paddingInner: scale.paddingInner(), paddingOuter: scale.paddingOuter() } : { padding: scale.padding() }),
    ...scale.bandwidth && { bandwidth: scale.bandwidth(), step: scale.step() },
    // utilities
    apply: (t5) => scale(t5),
    ...scale.invert && { invert: (t5) => scale.invert(t5) }
  };
}

// ../../node_modules/@observablehq/plot/src/facet.js
function createFacets(channelsByScale, options) {
  const { fx, fy } = createScales(channelsByScale, options);
  const fxDomain = fx?.scale.domain();
  const fyDomain = fy?.scale.domain();
  return fxDomain && fyDomain ? cross(fxDomain, fyDomain).map(([x3, y3], i2) => ({ x: x3, y: y3, i: i2 })) : fxDomain ? fxDomain.map((x3, i2) => ({ x: x3, i: i2 })) : fyDomain ? fyDomain.map((y3, i2) => ({ y: y3, i: i2 })) : void 0;
}
function recreateFacets(facets, { x: X4, y: Y4 }) {
  X4 &&= facetIndex(X4);
  Y4 &&= facetIndex(Y4);
  return facets.filter(
    X4 && Y4 ? (f2) => X4.has(f2.x) && Y4.has(f2.y) : X4 ? (f2) => X4.has(f2.x) : (f2) => Y4.has(f2.y)
  ).sort(
    X4 && Y4 ? (a3, b2) => X4.get(a3.x) - X4.get(b2.x) || Y4.get(a3.y) - Y4.get(b2.y) : X4 ? (a3, b2) => X4.get(a3.x) - X4.get(b2.x) : (a3, b2) => Y4.get(a3.y) - Y4.get(b2.y)
  );
}
function facetGroups(data, { fx, fy }) {
  const I2 = range2(data);
  const FX = fx?.value;
  const FY = fy?.value;
  return fx && fy ? rollup(
    I2,
    (G2) => (G2.fx = FX[G2[0]], G2.fy = FY[G2[0]], G2),
    (i2) => FX[i2],
    (i2) => FY[i2]
  ) : fx ? rollup(
    I2,
    (G2) => (G2.fx = FX[G2[0]], G2),
    (i2) => FX[i2]
  ) : rollup(
    I2,
    (G2) => (G2.fy = FY[G2[0]], G2),
    (i2) => FY[i2]
  );
}
function facetTranslator(fx, fy, { marginTop, marginLeft }) {
  return fx && fy ? ({ x: x3, y: y3 }) => `translate(${fx(x3) - marginLeft},${fy(y3) - marginTop})` : fx ? ({ x: x3 }) => `translate(${fx(x3) - marginLeft},0)` : ({ y: y3 }) => `translate(0,${fy(y3) - marginTop})`;
}
function facetExclude(index2) {
  const ex = [];
  const e = new Uint32Array(sum(index2, (d2) => d2.length));
  for (const i2 of index2) {
    let n2 = 0;
    for (const j2 of index2) {
      if (i2 === j2)
        continue;
      e.set(j2, n2);
      n2 += j2.length;
    }
    ex.push(e.slice(0, n2));
  }
  return ex;
}
var facetAnchors = /* @__PURE__ */ new Map([
  ["top", facetAnchorTop],
  ["right", facetAnchorRight],
  ["bottom", facetAnchorBottom],
  ["left", facetAnchorLeft],
  ["top-left", and(facetAnchorTop, facetAnchorLeft)],
  ["top-right", and(facetAnchorTop, facetAnchorRight)],
  ["bottom-left", and(facetAnchorBottom, facetAnchorLeft)],
  ["bottom-right", and(facetAnchorBottom, facetAnchorRight)],
  ["top-empty", facetAnchorTopEmpty],
  ["right-empty", facetAnchorRightEmpty],
  ["bottom-empty", facetAnchorBottomEmpty],
  ["left-empty", facetAnchorLeftEmpty],
  ["empty", facetAnchorEmpty]
]);
function maybeFacetAnchor(facetAnchor) {
  if (facetAnchor == null)
    return null;
  const anchor = facetAnchors.get(`${facetAnchor}`.toLowerCase());
  if (anchor)
    return anchor;
  throw new Error(`invalid facet anchor: ${facetAnchor}`);
}
var indexCache = /* @__PURE__ */ new WeakMap();
function facetIndex(V) {
  let I2 = indexCache.get(V);
  if (!I2)
    indexCache.set(V, I2 = new InternMap(map2(V, (v2, i2) => [v2, i2])));
  return I2;
}
function facetIndexOf(V, v2) {
  return facetIndex(V).get(v2);
}
function facetFind(facets, x3, y3) {
  x3 = keyof2(x3);
  y3 = keyof2(y3);
  return facets.find((f2) => Object.is(keyof2(f2.x), x3) && Object.is(keyof2(f2.y), y3));
}
function facetEmpty(facets, x3, y3) {
  return facetFind(facets, x3, y3)?.empty;
}
function facetAnchorTop(facets, { y: Y4 }, { y: y3 }) {
  return Y4 ? facetIndexOf(Y4, y3) === 0 : true;
}
function facetAnchorBottom(facets, { y: Y4 }, { y: y3 }) {
  return Y4 ? facetIndexOf(Y4, y3) === Y4.length - 1 : true;
}
function facetAnchorLeft(facets, { x: X4 }, { x: x3 }) {
  return X4 ? facetIndexOf(X4, x3) === 0 : true;
}
function facetAnchorRight(facets, { x: X4 }, { x: x3 }) {
  return X4 ? facetIndexOf(X4, x3) === X4.length - 1 : true;
}
function facetAnchorTopEmpty(facets, { y: Y4 }, { x: x3, y: y3, empty: empty3 }) {
  if (empty3)
    return false;
  if (!Y4)
    return;
  const i2 = facetIndexOf(Y4, y3);
  if (i2 > 0)
    return facetEmpty(facets, x3, Y4[i2 - 1]);
}
function facetAnchorBottomEmpty(facets, { y: Y4 }, { x: x3, y: y3, empty: empty3 }) {
  if (empty3)
    return false;
  if (!Y4)
    return;
  const i2 = facetIndexOf(Y4, y3);
  if (i2 < Y4.length - 1)
    return facetEmpty(facets, x3, Y4[i2 + 1]);
}
function facetAnchorLeftEmpty(facets, { x: X4 }, { x: x3, y: y3, empty: empty3 }) {
  if (empty3)
    return false;
  if (!X4)
    return;
  const i2 = facetIndexOf(X4, x3);
  if (i2 > 0)
    return facetEmpty(facets, X4[i2 - 1], y3);
}
function facetAnchorRightEmpty(facets, { x: X4 }, { x: x3, y: y3, empty: empty3 }) {
  if (empty3)
    return false;
  if (!X4)
    return;
  const i2 = facetIndexOf(X4, x3);
  if (i2 < X4.length - 1)
    return facetEmpty(facets, X4[i2 + 1], y3);
}
function facetAnchorEmpty(facets, channels, { empty: empty3 }) {
  return empty3;
}
function and(a3, b2) {
  return function() {
    return a3.apply(null, arguments) && b2.apply(null, arguments);
  };
}
function facetFilter(facets, { channels: { fx, fy }, groups: groups2 }) {
  return fx && fy ? facets.map(({ x: x3, y: y3 }) => groups2.get(x3)?.get(y3) ?? []) : fx ? facets.map(({ x: x3 }) => groups2.get(x3) ?? []) : facets.map(({ y: y3 }) => groups2.get(y3) ?? []);
}

// ../../node_modules/@observablehq/plot/src/projection.js
var pi4 = Math.PI;
var tau4 = 2 * pi4;
var defaultAspectRatio = 0.618;
function createProjection({
  projection: projection3,
  inset: globalInset = 0,
  insetTop = globalInset,
  insetRight = globalInset,
  insetBottom = globalInset,
  insetLeft = globalInset
} = {}, dimensions) {
  if (projection3 == null)
    return;
  if (typeof projection3.stream === "function")
    return projection3;
  let options;
  let domain;
  let clip = "frame";
  if (isObject(projection3)) {
    let inset;
    ({
      type: projection3,
      domain,
      inset,
      insetTop = inset !== void 0 ? inset : insetTop,
      insetRight = inset !== void 0 ? inset : insetRight,
      insetBottom = inset !== void 0 ? inset : insetBottom,
      insetLeft = inset !== void 0 ? inset : insetLeft,
      clip = clip,
      ...options
    } = projection3);
    if (projection3 == null)
      return;
  }
  if (typeof projection3 !== "function")
    ({ type: projection3 } = namedProjection(projection3));
  const { width, height, marginLeft, marginRight, marginTop, marginBottom } = dimensions;
  const dx = width - marginLeft - marginRight - insetLeft - insetRight;
  const dy = height - marginTop - marginBottom - insetTop - insetBottom;
  projection3 = projection3?.({ width: dx, height: dy, clip, ...options });
  if (projection3 == null)
    return;
  clip = maybePostClip(clip, marginLeft, marginTop, width - marginRight, height - marginBottom);
  let tx = marginLeft + insetLeft;
  let ty = marginTop + insetTop;
  let transform2;
  if (domain != null) {
    const [[x05, y05], [x12, y12]] = path_default(projection3).bounds(domain);
    const k3 = Math.min(dx / (x12 - x05), dy / (y12 - y05));
    if (k3 > 0) {
      tx -= (k3 * (x05 + x12) - dx) / 2;
      ty -= (k3 * (y05 + y12) - dy) / 2;
      transform2 = transform_default({
        point(x3, y3) {
          this.stream.point(x3 * k3 + tx, y3 * k3 + ty);
        }
      });
    } else {
      warn(`Warning: the projection could not be fit to the specified domain; using the default scale.`);
    }
  }
  transform2 ??= tx === 0 && ty === 0 ? identity7() : transform_default({
    point(x3, y3) {
      this.stream.point(x3 + tx, y3 + ty);
    }
  });
  return { stream: (s3) => projection3.stream(transform2.stream(clip(s3))) };
}
function namedProjection(projection3) {
  switch (`${projection3}`.toLowerCase()) {
    case "albers-usa":
      return scaleProjection(albersUsa_default, 0.7463, 0.4673);
    case "albers":
      return conicProjection2(albers_default, 0.7463, 0.4673);
    case "azimuthal-equal-area":
      return scaleProjection(azimuthalEqualArea_default, 4, 4);
    case "azimuthal-equidistant":
      return scaleProjection(azimuthalEquidistant_default, tau4, tau4);
    case "conic-conformal":
      return conicProjection2(conicConformal_default, tau4, tau4);
    case "conic-equal-area":
      return conicProjection2(conicEqualArea_default, 6.1702, 2.9781);
    case "conic-equidistant":
      return conicProjection2(conicEquidistant_default, 7.312, 3.6282);
    case "equal-earth":
      return scaleProjection(equalEarth_default, 5.4133, 2.6347);
    case "equirectangular":
      return scaleProjection(equirectangular_default, tau4, pi4);
    case "gnomonic":
      return scaleProjection(gnomonic_default, 3.4641, 3.4641);
    case "identity":
      return { type: identity7 };
    case "reflect-y":
      return { type: reflectY };
    case "mercator":
      return scaleProjection(mercator_default, tau4, tau4);
    case "orthographic":
      return scaleProjection(orthographic_default, 2, 2);
    case "stereographic":
      return scaleProjection(stereographic_default, 2, 2);
    case "transverse-mercator":
      return scaleProjection(transverseMercator_default, tau4, tau4);
    default:
      throw new Error(`unknown projection type: ${projection3}`);
  }
}
function maybePostClip(clip, x12, y12, x22, y22) {
  if (clip === false || clip == null || typeof clip === "number")
    return (s3) => s3;
  if (clip === true)
    clip = "frame";
  switch (`${clip}`.toLowerCase()) {
    case "frame":
      return clipRectangle(x12, y12, x22, y22);
    default:
      throw new Error(`unknown projection clip type: ${clip}`);
  }
}
function scaleProjection(createProjection2, kx2, ky2) {
  return {
    type: ({ width, height, rotate, precision = 0.15, clip }) => {
      const projection3 = createProjection2();
      if (precision != null)
        projection3.precision?.(precision);
      if (rotate != null)
        projection3.rotate?.(rotate);
      if (typeof clip === "number")
        projection3.clipAngle?.(clip);
      if (width != null) {
        projection3.scale(Math.min(width / kx2, height / ky2));
        projection3.translate([width / 2, height / 2]);
      }
      return projection3;
    },
    aspectRatio: ky2 / kx2
  };
}
function conicProjection2(createProjection2, kx2, ky2) {
  const { type: type2, aspectRatio } = scaleProjection(createProjection2, kx2, ky2);
  return {
    type: (options) => {
      const { parallels, domain, width, height } = options;
      const projection3 = type2(options);
      if (parallels != null) {
        projection3.parallels(parallels);
        if (domain === void 0 && width != null) {
          projection3.fitSize([width, height], { type: "Sphere" });
        }
      }
      return projection3;
    },
    aspectRatio
  };
}
var identity7 = constant({ stream: (stream) => stream });
var reflectY = constant(
  transform_default({
    point(x3, y3) {
      this.stream.point(x3, -y3);
    }
  })
);
function project(cx, cy, values2, projection3) {
  const x3 = values2[cx];
  const y3 = values2[cy];
  const n2 = x3.length;
  const X4 = values2[cx] = new Float64Array(n2).fill(NaN);
  const Y4 = values2[cy] = new Float64Array(n2).fill(NaN);
  let i2;
  const stream = projection3.stream({
    point(x4, y4) {
      X4[i2] = x4;
      Y4[i2] = y4;
    }
  });
  for (i2 = 0; i2 < n2; ++i2) {
    stream.point(x3[i2], y3[i2]);
  }
}
function hasProjection({ projection: projection3 } = {}) {
  if (projection3 == null)
    return false;
  if (typeof projection3.stream === "function")
    return true;
  if (isObject(projection3))
    projection3 = projection3.type;
  return projection3 != null;
}
function projectionAspectRatio(projection3) {
  if (typeof projection3?.stream === "function")
    return defaultAspectRatio;
  if (isObject(projection3)) {
    let domain, options;
    ({ domain, type: projection3, ...options } = projection3);
    if (domain != null && projection3 != null) {
      const type2 = typeof projection3 === "string" ? namedProjection(projection3).type : projection3;
      const [[x05, y05], [x12, y12]] = path_default(type2({ ...options, width: 100, height: 100 })).bounds(domain);
      const r2 = (y12 - y05) / (x12 - x05);
      return r2 && isFinite(r2) ? r2 < 0.2 ? 0.2 : r2 > 5 ? 5 : r2 : defaultAspectRatio;
    }
  }
  if (projection3 == null)
    return;
  if (typeof projection3 !== "function") {
    const { aspectRatio } = namedProjection(projection3);
    if (aspectRatio)
      return aspectRatio;
  }
  return defaultAspectRatio;
}
function getGeometryChannels(channel) {
  const X4 = [];
  const Y4 = [];
  const x3 = { scale: "x", value: X4 };
  const y3 = { scale: "y", value: Y4 };
  const sink = {
    point(x4, y4) {
      X4.push(x4);
      Y4.push(y4);
    },
    lineStart() {
    },
    lineEnd() {
    },
    polygonStart() {
    },
    polygonEnd() {
    },
    sphere() {
    }
  };
  for (const object of channel.value)
    stream_default(object, sink);
  return [x3, y3];
}

// ../../node_modules/@observablehq/plot/src/context.js
function createContext(options = {}) {
  const { document: document2 = typeof window !== "undefined" ? window.document : void 0, clip } = options;
  return { document: document2, clip: maybeClip(clip) };
}
function create2(name, { document: document2 }) {
  return select_default2(creator_default(name).call(document2.documentElement));
}

// ../../node_modules/@observablehq/plot/src/memoize.js
var unset = Symbol("unset");
function memoize1(compute) {
  return (compute.length === 1 ? memoize1Arg : memoize1Args)(compute);
}
function memoize1Arg(compute) {
  let cacheValue;
  let cacheKey = unset;
  return (key) => {
    if (!Object.is(cacheKey, key)) {
      cacheKey = key;
      cacheValue = compute(key);
    }
    return cacheValue;
  };
}
function memoize1Args(compute) {
  let cacheValue, cacheKeys;
  return (...keys) => {
    if (cacheKeys?.length !== keys.length || cacheKeys.some((k3, i2) => !Object.is(k3, keys[i2]))) {
      cacheKeys = keys;
      cacheValue = compute(...keys);
    }
    return cacheValue;
  };
}

// ../../node_modules/@observablehq/plot/src/format.js
var numberFormat = memoize1((locale3) => {
  return new Intl.NumberFormat(locale3);
});
var monthFormat = memoize1((locale3, month) => {
  return new Intl.DateTimeFormat(locale3, { timeZone: "UTC", ...month && { month } });
});
var weekdayFormat = memoize1((locale3, weekday) => {
  return new Intl.DateTimeFormat(locale3, { timeZone: "UTC", ...weekday && { weekday } });
});
function formatNumber(locale3 = "en-US") {
  const format3 = numberFormat(locale3);
  return (i2) => i2 != null && !isNaN(i2) ? format3.format(i2) : void 0;
}
function formatIsoDate(date2) {
  return format2(date2, "Invalid Date");
}
function formatAuto(locale3 = "en-US") {
  const number6 = formatNumber(locale3);
  return (v2) => (v2 instanceof Date ? formatIsoDate : typeof v2 === "number" ? number6 : string)(v2);
}
var formatDefault = formatAuto();

// ../../node_modules/@observablehq/plot/src/style.js
var offset = (typeof window !== "undefined" ? window.devicePixelRatio > 1 : typeof it === "undefined") ? 0 : 0.5;
var nextClipId = 0;
function getClipId() {
  return `plot-clip-${++nextClipId}`;
}
function styles(mark, {
  title,
  href,
  ariaLabel: variaLabel,
  ariaDescription,
  ariaHidden,
  target,
  fill,
  fillOpacity,
  stroke,
  strokeWidth,
  strokeOpacity,
  strokeLinejoin,
  strokeLinecap,
  strokeMiterlimit,
  strokeDasharray,
  strokeDashoffset,
  opacity: opacity2,
  mixBlendMode,
  imageFilter,
  paintOrder,
  pointerEvents,
  shapeRendering,
  channels
}, {
  ariaLabel: cariaLabel,
  fill: defaultFill = "currentColor",
  fillOpacity: defaultFillOpacity,
  stroke: defaultStroke = "none",
  strokeOpacity: defaultStrokeOpacity,
  strokeWidth: defaultStrokeWidth,
  strokeLinecap: defaultStrokeLinecap,
  strokeLinejoin: defaultStrokeLinejoin,
  strokeMiterlimit: defaultStrokeMiterlimit,
  paintOrder: defaultPaintOrder
}) {
  if (defaultFill === null) {
    fill = null;
    fillOpacity = null;
  }
  if (defaultStroke === null) {
    stroke = null;
    strokeOpacity = null;
  }
  if (isNoneish(defaultFill)) {
    if (!isNoneish(defaultStroke) && (!isNoneish(fill) || channels?.fill))
      defaultStroke = "none";
  } else {
    if (isNoneish(defaultStroke) && (!isNoneish(stroke) || channels?.stroke))
      defaultFill = "none";
  }
  const [vfill, cfill] = maybeColorChannel(fill, defaultFill);
  const [vfillOpacity, cfillOpacity] = maybeNumberChannel(fillOpacity, defaultFillOpacity);
  const [vstroke, cstroke] = maybeColorChannel(stroke, defaultStroke);
  const [vstrokeOpacity, cstrokeOpacity] = maybeNumberChannel(strokeOpacity, defaultStrokeOpacity);
  const [vopacity, copacity] = maybeNumberChannel(opacity2);
  if (!isNone(cstroke)) {
    if (strokeWidth === void 0)
      strokeWidth = defaultStrokeWidth;
    if (strokeLinecap === void 0)
      strokeLinecap = defaultStrokeLinecap;
    if (strokeLinejoin === void 0)
      strokeLinejoin = defaultStrokeLinejoin;
    if (strokeMiterlimit === void 0 && !isRound(strokeLinejoin))
      strokeMiterlimit = defaultStrokeMiterlimit;
    if (!isNone(cfill) && paintOrder === void 0)
      paintOrder = defaultPaintOrder;
  }
  const [vstrokeWidth, cstrokeWidth] = maybeNumberChannel(strokeWidth);
  if (defaultFill !== null) {
    mark.fill = impliedString(cfill, "currentColor");
    mark.fillOpacity = impliedNumber(cfillOpacity, 1);
  }
  if (defaultStroke !== null) {
    mark.stroke = impliedString(cstroke, "none");
    mark.strokeWidth = impliedNumber(cstrokeWidth, 1);
    mark.strokeOpacity = impliedNumber(cstrokeOpacity, 1);
    mark.strokeLinejoin = impliedString(strokeLinejoin, "miter");
    mark.strokeLinecap = impliedString(strokeLinecap, "butt");
    mark.strokeMiterlimit = impliedNumber(strokeMiterlimit, 4);
    mark.strokeDasharray = impliedString(strokeDasharray, "none");
    mark.strokeDashoffset = impliedString(strokeDashoffset, "0");
  }
  mark.target = string(target);
  mark.ariaLabel = string(cariaLabel);
  mark.ariaDescription = string(ariaDescription);
  mark.ariaHidden = string(ariaHidden);
  mark.opacity = impliedNumber(copacity, 1);
  mark.mixBlendMode = impliedString(mixBlendMode, "normal");
  mark.imageFilter = impliedString(imageFilter, "none");
  mark.paintOrder = impliedString(paintOrder, "normal");
  mark.pointerEvents = impliedString(pointerEvents, "auto");
  mark.shapeRendering = impliedString(shapeRendering, "auto");
  return {
    title: { value: title, optional: true, filter: null },
    href: { value: href, optional: true, filter: null },
    ariaLabel: { value: variaLabel, optional: true, filter: null },
    fill: { value: vfill, scale: "auto", optional: true },
    fillOpacity: { value: vfillOpacity, scale: "auto", optional: true },
    stroke: { value: vstroke, scale: "auto", optional: true },
    strokeOpacity: { value: vstrokeOpacity, scale: "auto", optional: true },
    strokeWidth: { value: vstrokeWidth, optional: true },
    opacity: { value: vopacity, scale: "auto", optional: true }
  };
}
function applyTitle(selection2, L2) {
  if (L2)
    selection2.filter((i2) => nonempty(L2[i2])).append("title").call(applyText, L2);
}
function applyTitleGroup(selection2, L2) {
  if (L2)
    selection2.filter(([i2]) => nonempty(L2[i2])).append("title").call(applyTextGroup, L2);
}
function applyText(selection2, T) {
  if (T)
    selection2.text((i2) => formatDefault(T[i2]));
}
function applyTextGroup(selection2, T) {
  if (T)
    selection2.text(([i2]) => formatDefault(T[i2]));
}
function applyChannelStyles(selection2, { target, tip: tip2 }, {
  ariaLabel: AL,
  title: T,
  fill: F,
  fillOpacity: FO,
  stroke: S2,
  strokeOpacity: SO,
  strokeWidth: SW,
  opacity: O2,
  href: H2
}) {
  if (AL)
    applyAttr(selection2, "aria-label", (i2) => AL[i2]);
  if (F)
    applyAttr(selection2, "fill", (i2) => F[i2]);
  if (FO)
    applyAttr(selection2, "fill-opacity", (i2) => FO[i2]);
  if (S2)
    applyAttr(selection2, "stroke", (i2) => S2[i2]);
  if (SO)
    applyAttr(selection2, "stroke-opacity", (i2) => SO[i2]);
  if (SW)
    applyAttr(selection2, "stroke-width", (i2) => SW[i2]);
  if (O2)
    applyAttr(selection2, "opacity", (i2) => O2[i2]);
  if (H2)
    applyHref(selection2, (i2) => H2[i2], target);
  if (!tip2)
    applyTitle(selection2, T);
}
function applyGroupedChannelStyles(selection2, { target, tip: tip2 }, {
  ariaLabel: AL,
  title: T,
  fill: F,
  fillOpacity: FO,
  stroke: S2,
  strokeOpacity: SO,
  strokeWidth: SW,
  opacity: O2,
  href: H2
}) {
  if (AL)
    applyAttr(selection2, "aria-label", ([i2]) => AL[i2]);
  if (F)
    applyAttr(selection2, "fill", ([i2]) => F[i2]);
  if (FO)
    applyAttr(selection2, "fill-opacity", ([i2]) => FO[i2]);
  if (S2)
    applyAttr(selection2, "stroke", ([i2]) => S2[i2]);
  if (SO)
    applyAttr(selection2, "stroke-opacity", ([i2]) => SO[i2]);
  if (SW)
    applyAttr(selection2, "stroke-width", ([i2]) => SW[i2]);
  if (O2)
    applyAttr(selection2, "opacity", ([i2]) => O2[i2]);
  if (H2)
    applyHref(selection2, ([i2]) => H2[i2], target);
  if (!tip2)
    applyTitleGroup(selection2, T);
}
function groupAesthetics({
  ariaLabel: AL,
  title: T,
  fill: F,
  fillOpacity: FO,
  stroke: S2,
  strokeOpacity: SO,
  strokeWidth: SW,
  opacity: O2,
  href: H2
}, { tip: tip2 }) {
  return [AL, tip2 ? void 0 : T, F, FO, S2, SO, SW, O2, H2].filter((c5) => c5 !== void 0);
}
function groupZ2(I2, Z3, z2) {
  const G2 = group(I2, (i2) => Z3[i2]);
  if (z2 === void 0 && G2.size > 1 + I2.length >> 1) {
    warn(
      `Warning: the implicit z channel has high cardinality. This may occur when the fill or stroke channel is associated with quantitative data rather than ordinal or categorical data. You can suppress this warning by setting the z option explicitly; if this data represents a single series, set z to null.`
    );
  }
  return G2.values();
}
function* groupIndex(I2, position2, mark, channels) {
  const { z: z2 } = mark;
  const { z: Z3 } = channels;
  const A6 = groupAesthetics(channels, mark);
  const C2 = [...position2, ...A6];
  for (const G2 of Z3 ? groupZ2(I2, Z3, z2) : [I2]) {
    let Ag;
    let Gg;
    out:
      for (const i2 of G2) {
        for (const c5 of C2) {
          if (!defined(c5[i2])) {
            if (Gg)
              Gg.push(-1);
            continue out;
          }
        }
        if (Ag === void 0) {
          if (Gg)
            yield Gg;
          Ag = A6.map((c5) => keyof2(c5[i2])), Gg = [i2];
          continue;
        }
        Gg.push(i2);
        for (let j2 = 0; j2 < A6.length; ++j2) {
          const k3 = keyof2(A6[j2][i2]);
          if (k3 !== Ag[j2]) {
            yield Gg;
            Ag = A6.map((c5) => keyof2(c5[i2])), Gg = [i2];
            continue out;
          }
        }
      }
    if (Gg)
      yield Gg;
  }
}
function applyClip(selection2, mark, dimensions, context) {
  let clipUrl;
  const { clip = context.clip } = mark;
  switch (clip) {
    case "frame": {
      selection2 = create2("svg:g", context).each(function() {
        this.appendChild(selection2.node());
        selection2.node = () => this;
      });
      clipUrl = getFrameClip(context, dimensions);
      break;
    }
    case "sphere": {
      clipUrl = getProjectionClip(context);
      break;
    }
  }
  applyAttr(selection2, "aria-label", mark.ariaLabel);
  applyAttr(selection2, "aria-description", mark.ariaDescription);
  applyAttr(selection2, "aria-hidden", mark.ariaHidden);
  applyAttr(selection2, "clip-path", clipUrl);
}
function memoizeClip(clip) {
  const cache = /* @__PURE__ */ new WeakMap();
  return (context, dimensions) => {
    let url = cache.get(context);
    if (!url) {
      const id2 = getClipId();
      select_default2(context.ownerSVGElement).append("clipPath").attr("id", id2).call(clip, context, dimensions);
      cache.set(context, url = `url(#${id2})`);
    }
    return url;
  };
}
var getFrameClip = memoizeClip((clipPath, context, dimensions) => {
  const { width, height, marginLeft, marginRight, marginTop, marginBottom } = dimensions;
  clipPath.append("rect").attr("x", marginLeft).attr("y", marginTop).attr("width", width - marginRight - marginLeft).attr("height", height - marginTop - marginBottom);
});
var getProjectionClip = memoizeClip((clipPath, context) => {
  const { projection: projection3 } = context;
  if (!projection3)
    throw new Error(`the "sphere" clip option requires a projection`);
  clipPath.append("path").attr("d", path_default(projection3)({ type: "Sphere" }));
});
function applyIndirectStyles(selection2, mark, dimensions, context) {
  applyClip(selection2, mark, dimensions, context);
  applyAttr(selection2, "class", mark.className);
  applyAttr(selection2, "fill", mark.fill);
  applyAttr(selection2, "fill-opacity", mark.fillOpacity);
  applyAttr(selection2, "stroke", mark.stroke);
  applyAttr(selection2, "stroke-width", mark.strokeWidth);
  applyAttr(selection2, "stroke-opacity", mark.strokeOpacity);
  applyAttr(selection2, "stroke-linejoin", mark.strokeLinejoin);
  applyAttr(selection2, "stroke-linecap", mark.strokeLinecap);
  applyAttr(selection2, "stroke-miterlimit", mark.strokeMiterlimit);
  applyAttr(selection2, "stroke-dasharray", mark.strokeDasharray);
  applyAttr(selection2, "stroke-dashoffset", mark.strokeDashoffset);
  applyAttr(selection2, "shape-rendering", mark.shapeRendering);
  applyAttr(selection2, "filter", mark.imageFilter);
  applyAttr(selection2, "paint-order", mark.paintOrder);
  const { pointerEvents = context.pointerSticky === false ? "none" : void 0 } = mark;
  applyAttr(selection2, "pointer-events", pointerEvents);
}
function applyDirectStyles(selection2, mark) {
  applyStyle(selection2, "mix-blend-mode", mark.mixBlendMode);
  applyAttr(selection2, "opacity", mark.opacity);
}
function applyHref(selection2, href, target) {
  selection2.each(function(i2) {
    const h2 = href(i2);
    if (h2 != null) {
      const a3 = this.ownerDocument.createElementNS(namespaces_default.svg, "a");
      a3.setAttribute("fill", "inherit");
      a3.setAttributeNS(namespaces_default.xlink, "href", h2);
      if (target != null)
        a3.setAttribute("target", target);
      this.parentNode.insertBefore(a3, this).appendChild(this);
    }
  });
}
function applyAttr(selection2, name, value) {
  if (value != null)
    selection2.attr(name, value);
}
function applyStyle(selection2, name, value) {
  if (value != null)
    selection2.style(name, value);
}
function applyTransform(selection2, mark, { x: x3, y: y3 }, tx = offset, ty = offset) {
  tx += mark.dx;
  ty += mark.dy;
  if (x3?.bandwidth)
    tx += x3.bandwidth() / 2;
  if (y3?.bandwidth)
    ty += y3.bandwidth() / 2;
  if (tx || ty)
    selection2.attr("transform", `translate(${tx},${ty})`);
}
function impliedString(value, impliedValue) {
  if ((value = string(value)) !== impliedValue)
    return value;
}
function impliedNumber(value, impliedValue) {
  if ((value = number5(value)) !== impliedValue)
    return value;
}
var validClassName = /^-?([_a-z]|[\240-\377]|\\[0-9a-f]{1,6}(\r\n|[ \t\r\n\f])?|\\[^\r\n\f0-9a-f])([_a-z0-9-]|[\240-\377]|\\[0-9a-f]{1,6}(\r\n|[ \t\r\n\f])?|\\[^\r\n\f0-9a-f])*$/i;
function maybeClassName(name) {
  if (name === void 0)
    return "plot-d6a7b5";
  name = `${name}`;
  if (!validClassName.test(name))
    throw new Error(`invalid class name: ${name}`);
  return name;
}
function applyInlineStyles(selection2, style) {
  if (typeof style === "string") {
    selection2.property("style", style);
  } else if (style != null) {
    for (const element of selection2) {
      Object.assign(element.style, style);
    }
  }
}
function applyFrameAnchor({ frameAnchor }, { width, height, marginTop, marginRight, marginBottom, marginLeft }) {
  return [
    /left$/.test(frameAnchor) ? marginLeft : /right$/.test(frameAnchor) ? width - marginRight : (marginLeft + width - marginRight) / 2,
    /^top/.test(frameAnchor) ? marginTop : /^bottom/.test(frameAnchor) ? height - marginBottom : (marginTop + height - marginBottom) / 2
  ];
}

// ../../node_modules/@observablehq/plot/src/mark.js
var Mark = class {
  constructor(data, channels = {}, options = {}, defaults12) {
    const {
      facet = "auto",
      facetAnchor,
      fx,
      fy,
      sort: sort3,
      dx = 0,
      dy = 0,
      margin = 0,
      marginTop = margin,
      marginRight = margin,
      marginBottom = margin,
      marginLeft = margin,
      className,
      clip = defaults12?.clip,
      channels: extraChannels,
      tip: tip2,
      render
    } = options;
    this.data = data;
    this.sort = isDomainSort(sort3) ? sort3 : null;
    this.initializer = initializer(options).initializer;
    this.transform = this.initializer ? options.transform : basic(options).transform;
    if (facet === null || facet === false) {
      this.facet = null;
    } else {
      this.facet = keyword(facet === true ? "include" : facet, "facet", ["auto", "include", "exclude", "super"]);
      this.fx = data === singleton && typeof fx === "string" ? [fx] : fx;
      this.fy = data === singleton && typeof fy === "string" ? [fy] : fy;
    }
    this.facetAnchor = maybeFacetAnchor(facetAnchor);
    channels = maybeNamed(channels);
    if (extraChannels !== void 0)
      channels = { ...maybeChannels(extraChannels), ...channels };
    if (defaults12 !== void 0)
      channels = { ...styles(this, options, defaults12), ...channels };
    this.channels = Object.fromEntries(
      Object.entries(channels).map(([name, channel]) => {
        if (isOptions(channel.value)) {
          const { value, label = channel.label, scale = channel.scale } = channel.value;
          channel = { ...channel, label, scale, value };
        }
        if (data === singleton && typeof channel.value === "string") {
          const { value } = channel;
          channel = { ...channel, value: [value] };
        }
        return [name, channel];
      }).filter(([name, { value, optional }]) => {
        if (value != null)
          return true;
        if (optional)
          return false;
        throw new Error(`missing channel value: ${name}`);
      })
    );
    this.dx = +dx;
    this.dy = +dy;
    this.marginTop = +marginTop;
    this.marginRight = +marginRight;
    this.marginBottom = +marginBottom;
    this.marginLeft = +marginLeft;
    this.clip = maybeClip(clip);
    this.tip = maybeTip(tip2);
    this.className = className ? maybeClassName(className) : null;
    if (this.facet === "super") {
      if (fx || fy)
        throw new Error(`super-faceting cannot use fx or fy`);
      for (const name in this.channels) {
        const { scale } = channels[name];
        if (scale !== "x" && scale !== "y")
          continue;
        throw new Error(`super-faceting cannot use x or y`);
      }
    }
    if (render != null) {
      this.render = composeRender(render, this.render);
    }
  }
  initialize(facets, facetChannels, plotOptions) {
    let data = dataify(this.data);
    if (facets === void 0 && data != null)
      facets = [range2(data)];
    const originalFacets = facets;
    if (this.transform != null)
      ({ facets, data } = this.transform(data, facets, plotOptions)), data = dataify(data);
    if (facets !== void 0)
      facets.original = originalFacets;
    const channels = createChannels(this.channels, data);
    if (this.sort != null)
      channelDomain(data, facets, channels, facetChannels, this.sort);
    return { data, facets, channels };
  }
  filter(index2, channels, values2) {
    for (const name in channels) {
      const { filter: filter2 = defined } = channels[name];
      if (filter2 !== null) {
        const value = values2[name];
        index2 = index2.filter((i2) => filter2(value[i2]));
      }
    }
    return index2;
  }
  // If there is a projection, and there are paired x and y channels associated
  // with the x and y scale respectively (and not already in screen coordinates
  // as with an initializer), then apply the projection, replacing the x and y
  // values. Note that the x and y scales themselves don’t exist if there is a
  // projection, but whether the channels are associated with scales still
  // determines whether the projection should apply; think of the projection as
  // a combination xy-scale.
  project(channels, values2, context) {
    for (const cx in channels) {
      if (channels[cx].scale === "x" && /^x|x$/.test(cx)) {
        const cy = cx.replace(/^x|x$/, "y");
        if (cy in channels && channels[cy].scale === "y") {
          project(cx, cy, values2, context.projection);
        }
      }
    }
  }
  scale(channels, scales, context) {
    const values2 = valueObject(channels, scales);
    if (context.projection)
      this.project(channels, values2, context);
    return values2;
  }
};
function marks(...marks2) {
  marks2.plot = Mark.prototype.plot;
  return marks2;
}
function composeRender(r1, r2) {
  if (r1 == null)
    return r2 === null ? void 0 : r2;
  if (r2 == null)
    return r1 === null ? void 0 : r1;
  if (typeof r1 !== "function")
    throw new TypeError(`invalid render transform: ${r1}`);
  if (typeof r2 !== "function")
    throw new TypeError(`invalid render transform: ${r2}`);
  return function(i2, s3, v2, d2, c5, next) {
    return r1.call(this, i2, s3, v2, d2, c5, (i3, s4, v3, d3, c6) => {
      return r2.call(this, i3, s4, v3, d3, c6, next);
    });
  };
}
function maybeChannels(channels) {
  return Object.fromEntries(
    Object.entries(maybeNamed(channels)).map(([name, channel]) => {
      channel = typeof channel === "string" ? { value: channel, label: name } : maybeValue(channel);
      if (channel.filter === void 0 && channel.scale == null)
        channel = { ...channel, filter: null };
      return [name, channel];
    })
  );
}
function maybeTip(tip2) {
  return tip2 === true ? "xy" : tip2 === false || tip2 == null ? null : typeof tip2 === "string" ? keyword(tip2, "tip", ["x", "y", "xy"]) : tip2;
}
function withTip(options, pointer2) {
  return options?.tip === true ? { ...options, tip: pointer2 } : isObject(options?.tip) && options.tip.pointer === void 0 ? { ...options, tip: { ...options.tip, pointer: pointer2 } } : options;
}

// ../../node_modules/@observablehq/plot/src/dimensions.js
function createDimensions(scales, marks2, options = {}) {
  let marginTopDefault = 0.5 - offset, marginRightDefault = 0.5 + offset, marginBottomDefault = 0.5 + offset, marginLeftDefault = 0.5 - offset;
  for (const { marginTop: marginTop2, marginRight: marginRight2, marginBottom: marginBottom2, marginLeft: marginLeft2 } of marks2) {
    if (marginTop2 > marginTopDefault)
      marginTopDefault = marginTop2;
    if (marginRight2 > marginRightDefault)
      marginRightDefault = marginRight2;
    if (marginBottom2 > marginBottomDefault)
      marginBottomDefault = marginBottom2;
    if (marginLeft2 > marginLeftDefault)
      marginLeftDefault = marginLeft2;
  }
  let {
    margin,
    marginTop = margin !== void 0 ? margin : marginTopDefault,
    marginRight = margin !== void 0 ? margin : marginRightDefault,
    marginBottom = margin !== void 0 ? margin : marginBottomDefault,
    marginLeft = margin !== void 0 ? margin : marginLeftDefault
  } = options;
  marginTop = +marginTop;
  marginRight = +marginRight;
  marginBottom = +marginBottom;
  marginLeft = +marginLeft;
  let {
    width = 640,
    height = autoHeight(scales, options, {
      width,
      marginTopDefault,
      marginRightDefault,
      marginBottomDefault,
      marginLeftDefault
    }) + Math.max(0, marginTop - marginTopDefault + marginBottom - marginBottomDefault)
  } = options;
  width = +width;
  height = +height;
  const dimensions = {
    width,
    height,
    marginTop,
    marginRight,
    marginBottom,
    marginLeft
  };
  if (scales.fx || scales.fy) {
    let {
      margin: facetMargin,
      marginTop: facetMarginTop = facetMargin !== void 0 ? facetMargin : marginTop,
      marginRight: facetMarginRight = facetMargin !== void 0 ? facetMargin : marginRight,
      marginBottom: facetMarginBottom = facetMargin !== void 0 ? facetMargin : marginBottom,
      marginLeft: facetMarginLeft = facetMargin !== void 0 ? facetMargin : marginLeft
    } = options.facet ?? {};
    facetMarginTop = +facetMarginTop;
    facetMarginRight = +facetMarginRight;
    facetMarginBottom = +facetMarginBottom;
    facetMarginLeft = +facetMarginLeft;
    dimensions.facet = {
      marginTop: facetMarginTop,
      marginRight: facetMarginRight,
      marginBottom: facetMarginBottom,
      marginLeft: facetMarginLeft
    };
  }
  return dimensions;
}
function autoHeight({ x: x3, y: y3, fy, fx }, { projection: projection3, aspectRatio }, { width, marginTopDefault, marginRightDefault, marginBottomDefault, marginLeftDefault }) {
  const nfy = fy ? fy.scale.domain().length || 1 : 1;
  const ar = projectionAspectRatio(projection3);
  if (ar) {
    const nfx = fx ? fx.scale.domain().length : 1;
    const far = (1.1 * nfy - 0.1) / (1.1 * nfx - 0.1) * ar;
    const lar = Math.max(0.1, Math.min(10, far));
    return Math.round((width - marginLeftDefault - marginRightDefault) * lar + marginTopDefault + marginBottomDefault);
  }
  const ny = y3 ? isOrdinalScale(y3) ? y3.scale.domain().length || 1 : Math.max(7, 17 / nfy) : 1;
  if (aspectRatio != null) {
    aspectRatio = +aspectRatio;
    if (!(isFinite(aspectRatio) && aspectRatio > 0))
      throw new Error(`invalid aspectRatio: ${aspectRatio}`);
    const ratio = aspectRatioLength("y", y3) / (aspectRatioLength("x", x3) * aspectRatio);
    const fxb = fx ? fx.scale.bandwidth() : 1;
    const fyb = fy ? fy.scale.bandwidth() : 1;
    const w2 = fxb * (width - marginLeftDefault - marginRightDefault) - x3.insetLeft - x3.insetRight;
    return (ratio * w2 + y3.insetTop + y3.insetBottom) / fyb + marginTopDefault + marginBottomDefault;
  }
  return !!(y3 || fy) * Math.max(1, Math.min(60, ny * nfy)) * 20 + !!fx * 30 + 60;
}
function aspectRatioLength(k3, scale) {
  if (!scale)
    throw new Error(`aspectRatio requires ${k3} scale`);
  const { type: type2, domain } = scale;
  let transform2;
  switch (type2) {
    case "linear":
    case "utc":
    case "time":
      transform2 = Number;
      break;
    case "pow": {
      const exponent = scale.scale.exponent();
      transform2 = (x3) => Math.pow(x3, exponent);
      break;
    }
    case "log":
      transform2 = Math.log;
      break;
    case "point":
    case "band":
      return domain.length;
    default:
      throw new Error(`unsupported ${k3} scale for aspectRatio: ${type2}`);
  }
  const [min4, max3] = extent(domain);
  return Math.abs(transform2(max3) - transform2(min4));
}

// ../../node_modules/@observablehq/plot/src/interactions/pointer.js
var states = /* @__PURE__ */ new WeakMap();
function pointerK(kx2, ky2, { x: x3, y: y3, px, py, maxRadius = 40, channels, render, ...options } = {}) {
  maxRadius = +maxRadius;
  if (px != null)
    x3 ??= null, channels = { ...channels, px: { value: px, scale: "x" } };
  if (py != null)
    y3 ??= null, channels = { ...channels, py: { value: py, scale: "y" } };
  return {
    x: x3,
    y: y3,
    channels,
    ...options,
    // Unlike other composed transforms, the render transform must be the
    // outermost render function because it will re-render dynamically in
    // response to pointer events.
    render: composeRender(function(index2, scales, values2, dimensions, context, next) {
      context = { ...context, pointerSticky: false };
      const svg = context.ownerSVGElement;
      const { data } = context.getMarkState(this);
      let state = states.get(svg);
      if (!state)
        states.set(svg, state = { sticky: false, roots: [], renders: [] });
      let renderIndex = state.renders.push(render2) - 1;
      const { x: x4, y: y4, fx, fy } = scales;
      let tx = fx ? fx(index2.fx) - dimensions.marginLeft : 0;
      let ty = fy ? fy(index2.fy) - dimensions.marginTop : 0;
      if (x4?.bandwidth)
        tx += x4.bandwidth() / 2;
      if (y4?.bandwidth)
        ty += y4.bandwidth() / 2;
      const faceted = index2.fi != null;
      let facetState;
      if (faceted) {
        let facetStates = state.facetStates;
        if (!facetStates)
          state.facetStates = facetStates = /* @__PURE__ */ new Map();
        facetState = facetStates.get(this);
        if (!facetState)
          facetStates.set(this, facetState = /* @__PURE__ */ new Map());
      }
      const [cx, cy] = applyFrameAnchor(this, dimensions);
      const { px: PX, py: PY } = values2;
      const px2 = PX ? (i3) => PX[i3] : anchorX(values2, cx);
      const py2 = PY ? (i3) => PY[i3] : anchorY(values2, cy);
      let i2;
      let g2;
      let s3;
      let f2;
      function update(ii, ri) {
        if (faceted) {
          if (f2)
            f2 = cancelAnimationFrame(f2);
          if (ii == null)
            facetState.delete(index2.fi);
          else {
            facetState.set(index2.fi, ri);
            f2 = requestAnimationFrame(() => {
              f2 = null;
              for (const [fi, r2] of facetState) {
                if (r2 < ri || r2 === ri && fi < index2.fi) {
                  ii = null;
                  break;
                }
              }
              render2(ii);
            });
            return;
          }
        }
        render2(ii);
      }
      function render2(ii) {
        if (i2 === ii && s3 === state.sticky)
          return;
        i2 = ii;
        s3 = context.pointerSticky = state.sticky;
        const I2 = i2 == null ? [] : [i2];
        if (faceted)
          I2.fx = index2.fx, I2.fy = index2.fy, I2.fi = index2.fi;
        const r2 = next(I2, scales, values2, dimensions, context);
        if (g2) {
          if (faceted) {
            const p2 = g2.parentNode;
            const ft = g2.getAttribute("transform");
            const mt = r2.getAttribute("transform");
            ft ? r2.setAttribute("transform", ft) : r2.removeAttribute("transform");
            mt ? p2.setAttribute("transform", mt) : p2.removeAttribute("transform");
            r2.removeAttribute("aria-label");
            r2.removeAttribute("aria-description");
            r2.removeAttribute("aria-hidden");
          }
          g2.replaceWith(r2);
        }
        state.roots[renderIndex] = g2 = r2;
        if (!(i2 == null && facetState?.size > 1)) {
          const value = i2 == null ? null : isArray(data) ? data[i2] : data.get(i2);
          context.dispatchValue(value);
        }
        return r2;
      }
      function pointermove(event) {
        if (state.sticky || event.pointerType === "mouse" && event.buttons === 1)
          return;
        let [xp, yp] = pointer_default(event);
        xp -= tx, yp -= ty;
        const kpx = xp < dimensions.marginLeft || xp > dimensions.width - dimensions.marginRight ? 1 : kx2;
        const kpy = yp < dimensions.marginTop || yp > dimensions.height - dimensions.marginBottom ? 1 : ky2;
        let ii = null;
        let ri = maxRadius * maxRadius;
        for (const j2 of index2) {
          const dx = kpx * (px2(j2) - xp);
          const dy = kpy * (py2(j2) - yp);
          const rj = dx * dx + dy * dy;
          if (rj <= ri)
            ii = j2, ri = rj;
        }
        if (ii != null && (kx2 !== 1 || ky2 !== 1)) {
          const dx = px2(ii) - xp;
          const dy = py2(ii) - yp;
          ri = dx * dx + dy * dy;
        }
        update(ii, ri);
      }
      function pointerdown(event) {
        if (event.pointerType !== "mouse")
          return;
        if (i2 == null)
          return;
        if (state.sticky && state.roots.some((r2) => r2?.contains(event.target)))
          return;
        if (state.sticky)
          state.sticky = false, state.renders.forEach((r2) => r2(null));
        else
          state.sticky = true, render2(i2);
        event.stopImmediatePropagation();
      }
      function pointerleave(event) {
        if (event.pointerType !== "mouse")
          return;
        if (!state.sticky)
          update(null);
      }
      svg.addEventListener("pointerenter", pointermove);
      svg.addEventListener("pointermove", pointermove);
      svg.addEventListener("pointerdown", pointerdown);
      svg.addEventListener("pointerleave", pointerleave);
      return render2(null);
    }, render)
  };
}
function pointer(options) {
  return pointerK(1, 1, options);
}
function pointerX(options) {
  return pointerK(1, 0.01, options);
}
function pointerY(options) {
  return pointerK(0.01, 1, options);
}
function anchorX({ x1: X12, x2: X22, x: X4 = X12 }, cx) {
  return X12 && X22 ? (i2) => (X12[i2] + X22[i2]) / 2 : X4 ? (i2) => X4[i2] : () => cx;
}
function anchorY({ y1: Y12, y2: Y22, y: Y4 = Y12 }, cy) {
  return Y12 && Y22 ? (i2) => (Y12[i2] + Y22[i2]) / 2 : Y4 ? (i2) => Y4[i2] : () => cy;
}

// ../../node_modules/@observablehq/plot/src/axes.js
function inferFontVariant(scale) {
  return isOrdinalScale(scale) && scale.interval === void 0 ? void 0 : "tabular-nums";
}

// ../../node_modules/@observablehq/plot/src/legends/ramp.js
function legendRamp(color3, options) {
  let {
    label = color3.label,
    tickSize = 6,
    width = 240,
    height = 44 + tickSize,
    marginTop = 18,
    marginRight = 0,
    marginBottom = 16 + tickSize,
    marginLeft = 0,
    style,
    ticks: ticks2 = (width - marginLeft - marginRight) / 64,
    tickFormat: tickFormat2,
    fontVariant = inferFontVariant(color3),
    round = true,
    opacity: opacity2,
    className
  } = options;
  const context = createContext(options);
  className = maybeClassName(className);
  opacity2 = maybeNumberChannel(opacity2)[1];
  if (tickFormat2 === null)
    tickFormat2 = () => null;
  const svg = create2("svg", context).attr("class", `${className}-ramp`).attr("font-family", "system-ui, sans-serif").attr("font-size", 10).attr("width", width).attr("height", height).attr("viewBox", `0 0 ${width} ${height}`).call(
    (svg2) => (
      // Warning: if you edit this, change defaultClassName.
      svg2.append("style").text(
        `:where(.${className}-ramp) {
  display: block;
  height: auto;
  height: intrinsic;
  max-width: 100%;
  overflow: visible;
}
:where(.${className}-ramp text) {
  white-space: pre;
}`
      )
    )
  ).call(applyInlineStyles, style);
  let tickAdjust = (g2) => g2.selectAll(".tick line").attr("y1", marginTop + marginBottom - height);
  let x3;
  const applyRange = round ? (x4, range4) => x4.rangeRound(range4) : (x4, range4) => x4.range(range4);
  const { type: type2, domain, range: range3, interpolate, scale, pivot } = color3;
  if (interpolate) {
    const interpolator = range3 === void 0 ? interpolate : piecewise(interpolate.length === 1 ? interpolatePiecewise(interpolate) : interpolate, range3);
    x3 = applyRange(
      scale.copy(),
      quantize_default(
        number_default(marginLeft, width - marginRight),
        Math.min(domain.length + (pivot !== void 0), range3 === void 0 ? Infinity : range3.length)
      )
    );
    const n2 = 256;
    const canvas = context.document.createElement("canvas");
    canvas.width = n2;
    canvas.height = 1;
    const context2 = canvas.getContext("2d");
    for (let i2 = 0, j2 = n2 - 1; i2 < n2; ++i2) {
      context2.fillStyle = interpolator(i2 / j2);
      context2.fillRect(i2, 0, 1, 1);
    }
    svg.append("image").attr("opacity", opacity2).attr("x", marginLeft).attr("y", marginTop).attr("width", width - marginLeft - marginRight).attr("height", height - marginTop - marginBottom).attr("preserveAspectRatio", "none").attr("xlink:href", canvas.toDataURL());
  } else if (type2 === "threshold") {
    const thresholds = domain;
    const thresholdFormat = tickFormat2 === void 0 ? (d2) => d2 : typeof tickFormat2 === "string" ? format(tickFormat2) : tickFormat2;
    x3 = applyRange(linear2().domain([-1, range3.length - 1]), [marginLeft, width - marginRight]);
    svg.append("g").attr("fill-opacity", opacity2).selectAll().data(range3).enter().append("rect").attr("x", (d2, i2) => x3(i2 - 1)).attr("y", marginTop).attr("width", (d2, i2) => x3(i2) - x3(i2 - 1)).attr("height", height - marginTop - marginBottom).attr("fill", (d2) => d2);
    ticks2 = map2(thresholds, (_24, i2) => i2);
    tickFormat2 = (i2) => thresholdFormat(thresholds[i2], i2);
  } else {
    x3 = applyRange(band().domain(domain), [marginLeft, width - marginRight]);
    svg.append("g").attr("fill-opacity", opacity2).selectAll().data(domain).enter().append("rect").attr("x", x3).attr("y", marginTop).attr("width", Math.max(0, x3.bandwidth() - 1)).attr("height", height - marginTop - marginBottom).attr("fill", scale);
    tickAdjust = () => {
    };
  }
  svg.append("g").attr("transform", `translate(0,${height - marginBottom})`).call(
    axisBottom(x3).ticks(Array.isArray(ticks2) ? null : ticks2, typeof tickFormat2 === "string" ? tickFormat2 : void 0).tickFormat(typeof tickFormat2 === "function" ? tickFormat2 : void 0).tickSize(tickSize).tickValues(Array.isArray(ticks2) ? ticks2 : null)
  ).attr("font-size", null).attr("font-family", null).attr("font-variant", impliedString(fontVariant, "normal")).call(tickAdjust).call((g2) => g2.select(".domain").remove());
  if (label !== void 0) {
    svg.append("text").attr("x", marginLeft).attr("y", marginTop - 6).attr("fill", "currentColor").attr("font-weight", "bold").text(label);
  }
  return svg.node();
}

// ../../node_modules/@observablehq/plot/src/math.js
var radians3 = Math.PI / 180;

// ../../node_modules/@observablehq/plot/src/marker.js
function markers(mark, { marker, markerStart = marker, markerMid = marker, markerEnd = marker } = {}) {
  mark.markerStart = maybeMarker(markerStart);
  mark.markerMid = maybeMarker(markerMid);
  mark.markerEnd = maybeMarker(markerEnd);
}
function maybeMarker(marker) {
  if (marker == null || marker === false)
    return null;
  if (marker === true)
    return markerCircleFill;
  if (typeof marker === "function")
    return marker;
  switch (`${marker}`.toLowerCase()) {
    case "none":
      return null;
    case "arrow":
      return markerArrow("auto");
    case "arrow-reverse":
      return markerArrow("auto-start-reverse");
    case "dot":
      return markerDot;
    case "circle":
    case "circle-fill":
      return markerCircleFill;
    case "circle-stroke":
      return markerCircleStroke;
    case "tick":
      return markerTick("auto");
    case "tick-x":
      return markerTick(90);
    case "tick-y":
      return markerTick(0);
  }
  throw new Error(`invalid marker: ${marker}`);
}
function markerArrow(orient) {
  return (color3, context) => create2("svg:marker", context).attr("viewBox", "-5 -5 10 10").attr("markerWidth", 6.67).attr("markerHeight", 6.67).attr("orient", orient).attr("fill", "none").attr("stroke", color3).attr("stroke-width", 1.5).attr("stroke-linecap", "round").attr("stroke-linejoin", "round").call((marker) => marker.append("path").attr("d", "M-1.5,-3l3,3l-3,3")).node();
}
function markerDot(color3, context) {
  return create2("svg:marker", context).attr("viewBox", "-5 -5 10 10").attr("markerWidth", 6.67).attr("markerHeight", 6.67).attr("fill", color3).attr("stroke", "none").call((marker) => marker.append("circle").attr("r", 2.5)).node();
}
function markerCircleFill(color3, context) {
  return create2("svg:marker", context).attr("viewBox", "-5 -5 10 10").attr("markerWidth", 6.67).attr("markerHeight", 6.67).attr("fill", color3).attr("stroke", "var(--plot-background)").attr("stroke-width", 1.5).call((marker) => marker.append("circle").attr("r", 3)).node();
}
function markerCircleStroke(color3, context) {
  return create2("svg:marker", context).attr("viewBox", "-5 -5 10 10").attr("markerWidth", 6.67).attr("markerHeight", 6.67).attr("fill", "var(--plot-background)").attr("stroke", color3).attr("stroke-width", 1.5).call((marker) => marker.append("circle").attr("r", 3)).node();
}
function markerTick(orient) {
  return (color3, context) => create2("svg:marker", context).attr("viewBox", "-3 -3 6 6").attr("markerWidth", 6).attr("markerHeight", 6).attr("orient", orient).attr("stroke", color3).call((marker) => marker.append("path").attr("d", "M0,-3v6")).node();
}
var nextMarkerId = 0;
function applyMarkers(path2, mark, { stroke: S2 }, context) {
  return applyMarkersColor(path2, mark, S2 && ((i2) => S2[i2]), null, context);
}
function applyGroupedMarkers(path2, mark, { stroke: S2, z: Z3 }, context) {
  return applyMarkersColor(path2, mark, S2 && (([i2]) => S2[i2]), Z3, context);
}
var START = 1;
var END = 2;
function getGroupedOrientation(path2, Z3) {
  const O2 = new Uint8Array(Z3.length);
  const D3 = path2.data().filter((I2) => I2.length > 1);
  const n2 = D3.length;
  for (let i2 = 0, z2 = unset; i2 < n2; ++i2) {
    const I2 = D3[i2];
    if (I2.length > 1) {
      const i3 = I2[0];
      if (z2 !== (z2 = keyof2(Z3[i3])))
        O2[i3] |= START;
    }
  }
  for (let i2 = n2 - 1, z2 = unset; i2 >= 0; --i2) {
    const I2 = D3[i2];
    if (I2.length > 1) {
      const i3 = I2[0];
      if (z2 !== (z2 = keyof2(Z3[i3])))
        O2[i3] |= END;
    }
  }
  return ([i2]) => O2[i2];
}
function applyMarkersColor(path2, { markerStart, markerMid, markerEnd, stroke }, strokeof = () => stroke, Z3, context) {
  if (!markerStart && !markerMid && !markerEnd)
    return;
  const iriByMarkerColor = /* @__PURE__ */ new Map();
  const orient = Z3 && getGroupedOrientation(path2, Z3);
  function applyMarker(name, marker, filter2) {
    return function(i2) {
      if (filter2 && !filter2(i2))
        return;
      const color3 = strokeof(i2);
      let iriByColor = iriByMarkerColor.get(marker);
      if (!iriByColor)
        iriByMarkerColor.set(marker, iriByColor = /* @__PURE__ */ new Map());
      let iri = iriByColor.get(color3);
      if (!iri) {
        const node = this.parentNode.insertBefore(marker(color3, context), this);
        const id2 = `plot-marker-${++nextMarkerId}`;
        node.setAttribute("id", id2);
        iriByColor.set(color3, iri = `url(#${id2})`);
      }
      this.setAttribute(name, iri);
    };
  }
  if (markerStart)
    path2.each(applyMarker("marker-start", markerStart, orient && ((i2) => orient(i2) & START)));
  if (markerMid && orient)
    path2.each(applyMarker("marker-start", markerMid, (i2) => !(orient(i2) & START)));
  if (markerMid)
    path2.each(applyMarker("marker-mid", markerMid));
  if (markerEnd)
    path2.each(applyMarker("marker-end", markerEnd, orient && ((i2) => orient(i2) & END)));
}

// ../../node_modules/@observablehq/plot/src/transforms/inset.js
function maybeInsetX({ inset, insetLeft, insetRight, ...options } = {}) {
  [insetLeft, insetRight] = maybeInset(inset, insetLeft, insetRight);
  return { inset, insetLeft, insetRight, ...options };
}
function maybeInsetY({ inset, insetTop, insetBottom, ...options } = {}) {
  [insetTop, insetBottom] = maybeInset(inset, insetTop, insetBottom);
  return { inset, insetTop, insetBottom, ...options };
}
function maybeInset(inset, inset1, inset2) {
  return inset === void 0 && inset1 === void 0 && inset2 === void 0 ? offset ? [1, 0] : [0.5, 0.5] : [inset1, inset2];
}

// ../../node_modules/@observablehq/plot/src/transforms/interval.js
function maybeIntervalValue(value, { interval: interval2 }) {
  value = { ...maybeValue(value) };
  value.interval = maybeInterval(value.interval === void 0 ? interval2 : value.interval);
  return value;
}
function maybeIntervalK(k3, maybeInsetK, options, trivial) {
  const { [k3]: v2, [`${k3}1`]: v1, [`${k3}2`]: v22 } = options;
  const { value, interval: interval2 } = maybeIntervalValue(v2, options);
  if (value == null || interval2 == null && !trivial)
    return options;
  const label = labelof(v2);
  if (interval2 == null) {
    let V;
    const kv = { transform: (data) => V || (V = valueof(data, value)), label };
    return {
      ...options,
      [k3]: void 0,
      [`${k3}1`]: v1 === void 0 ? kv : v1,
      [`${k3}2`]: v22 === void 0 && !(v1 === v22 && trivial) ? kv : v22
    };
  }
  let D1, V1;
  function transform2(data) {
    if (V1 !== void 0 && data === D1)
      return V1;
    return V1 = map2(valueof(D1 = data, value), (v3) => interval2.floor(v3));
  }
  return maybeInsetK({
    ...options,
    [k3]: void 0,
    [`${k3}1`]: v1 === void 0 ? { transform: transform2, label } : v1,
    [`${k3}2`]: v22 === void 0 ? { transform: (data) => transform2(data).map((v3) => interval2.offset(v3)), label } : v22
  });
}
function maybeIntervalMidK(k3, maybeInsetK, options) {
  const { [k3]: v2 } = options;
  const { value, interval: interval2 } = maybeIntervalValue(v2, options);
  if (value == null || interval2 == null)
    return options;
  return maybeInsetK({
    ...options,
    [k3]: {
      label: labelof(v2),
      transform: (data) => {
        const V1 = map2(valueof(data, value), (v3) => interval2.floor(v3));
        const V2 = V1.map((v3) => interval2.offset(v3));
        return V1.map(
          isTemporal(V1) ? (v1, v22) => v1 == null || isNaN(v1 = +v1) || (v22 = V2[v22], v22 == null) || isNaN(v22 = +v22) ? void 0 : new Date((v1 + v22) / 2) : (v1, v22) => v1 == null || (v22 = V2[v22], v22 == null) ? NaN : (+v1 + +v22) / 2
        );
      }
    }
  });
}
function maybeTrivialIntervalX(options = {}) {
  return maybeIntervalK("x", maybeInsetX, options, true);
}
function maybeTrivialIntervalY(options = {}) {
  return maybeIntervalK("y", maybeInsetY, options, true);
}
function maybeIntervalX(options = {}) {
  return maybeIntervalK("x", maybeInsetX, options);
}
function maybeIntervalY(options = {}) {
  return maybeIntervalK("y", maybeInsetY, options);
}
function maybeIntervalMidX(options = {}) {
  return maybeIntervalMidK("x", maybeInsetX, options);
}
function maybeIntervalMidY(options = {}) {
  return maybeIntervalMidK("y", maybeInsetY, options);
}

// ../../node_modules/@observablehq/plot/src/marks/rule.js
var defaults = {
  ariaLabel: "rule",
  fill: null,
  stroke: "currentColor"
};
var RuleX = class extends Mark {
  constructor(data, options = {}) {
    const { x: x3, y1: y12, y2: y22, inset = 0, insetTop = inset, insetBottom = inset } = options;
    super(
      data,
      {
        x: { value: x3, scale: "x", optional: true },
        y1: { value: y12, scale: "y", optional: true },
        y2: { value: y22, scale: "y", optional: true }
      },
      withTip(options, "x"),
      defaults
    );
    this.insetTop = number5(insetTop);
    this.insetBottom = number5(insetBottom);
    markers(this, options);
  }
  render(index2, scales, channels, dimensions, context) {
    const { x: x3, y: y3 } = scales;
    const { x: X4, y1: Y12, y2: Y22 } = channels;
    const { width, height, marginTop, marginRight, marginLeft, marginBottom } = dimensions;
    const { insetTop, insetBottom } = this;
    return create2("svg:g", context).call(applyIndirectStyles, this, dimensions, context).call(applyTransform, this, { x: X4 && x3 }, offset, 0).call(
      (g2) => g2.selectAll().data(index2).enter().append("line").call(applyDirectStyles, this).attr("x1", X4 ? (i2) => X4[i2] : (marginLeft + width - marginRight) / 2).attr("x2", X4 ? (i2) => X4[i2] : (marginLeft + width - marginRight) / 2).attr("y1", Y12 && !isCollapsed(y3) ? (i2) => Y12[i2] + insetTop : marginTop + insetTop).attr(
        "y2",
        Y22 && !isCollapsed(y3) ? y3.bandwidth ? (i2) => Y22[i2] + y3.bandwidth() - insetBottom : (i2) => Y22[i2] - insetBottom : height - marginBottom - insetBottom
      ).call(applyChannelStyles, this, channels).call(applyMarkers, this, channels, context)
    ).node();
  }
};
var RuleY = class extends Mark {
  constructor(data, options = {}) {
    const { x1: x12, x2: x22, y: y3, inset = 0, insetRight = inset, insetLeft = inset } = options;
    super(
      data,
      {
        y: { value: y3, scale: "y", optional: true },
        x1: { value: x12, scale: "x", optional: true },
        x2: { value: x22, scale: "x", optional: true }
      },
      withTip(options, "y"),
      defaults
    );
    this.insetRight = number5(insetRight);
    this.insetLeft = number5(insetLeft);
    markers(this, options);
  }
  render(index2, scales, channels, dimensions, context) {
    const { x: x3, y: y3 } = scales;
    const { y: Y4, x1: X12, x2: X22 } = channels;
    const { width, height, marginTop, marginRight, marginLeft, marginBottom } = dimensions;
    const { insetLeft, insetRight } = this;
    return create2("svg:g", context).call(applyIndirectStyles, this, dimensions, context).call(applyTransform, this, { y: Y4 && y3 }, 0, offset).call(
      (g2) => g2.selectAll().data(index2).enter().append("line").call(applyDirectStyles, this).attr("x1", X12 && !isCollapsed(x3) ? (i2) => X12[i2] + insetLeft : marginLeft + insetLeft).attr(
        "x2",
        X22 && !isCollapsed(x3) ? x3.bandwidth ? (i2) => X22[i2] + x3.bandwidth() - insetRight : (i2) => X22[i2] - insetRight : width - marginRight - insetRight
      ).attr("y1", Y4 ? (i2) => Y4[i2] : (marginTop + height - marginBottom) / 2).attr("y2", Y4 ? (i2) => Y4[i2] : (marginTop + height - marginBottom) / 2).call(applyChannelStyles, this, channels).call(applyMarkers, this, channels, context)
    ).node();
  }
};
function ruleX(data, options) {
  let { x: x3 = identity6, y: y3, y1: y12, y2: y22, ...rest } = maybeIntervalY(options);
  [y12, y22] = maybeOptionalZero(y3, y12, y22);
  return new RuleX(data, { ...rest, x: x3, y1: y12, y2: y22 });
}
function ruleY(data, options) {
  let { y: y3 = identity6, x: x3, x1: x12, x2: x22, ...rest } = maybeIntervalX(options);
  [x12, x22] = maybeOptionalZero(x3, x12, x22);
  return new RuleY(data, { ...rest, y: y3, x1: x12, x2: x22 });
}
function maybeOptionalZero(x3, x12, x22) {
  if (x3 == null) {
    if (x12 === void 0) {
      if (x22 !== void 0)
        return [0, x22];
    } else {
      if (x22 === void 0)
        return [0, x12];
    }
  } else if (x12 === void 0) {
    return x22 === void 0 ? [0, x3] : [x3, x22];
  } else if (x22 === void 0) {
    return [x3, x12];
  }
  return [x12, x22];
}

// ../../node_modules/@observablehq/plot/src/template.js
function template(strings, ...parts) {
  let n2 = parts.length;
  for (let j2 = 0, copy4 = true; j2 < n2; ++j2) {
    if (typeof parts[j2] !== "function") {
      if (copy4) {
        strings = strings.slice();
        copy4 = false;
      }
      strings.splice(j2, 2, strings[j2] + parts[j2] + strings[j2 + 1]);
      parts.splice(j2, 1);
      --j2, --n2;
    }
  }
  return (i2) => {
    let s3 = strings[0];
    for (let j2 = 0; j2 < n2; ++j2) {
      s3 += parts[j2](i2) + strings[j2 + 1];
    }
    return s3;
  };
}

// ../../node_modules/@observablehq/plot/src/marks/text.js
var defaults2 = {
  ariaLabel: "text",
  strokeLinejoin: "round",
  strokeWidth: 3,
  paintOrder: "stroke"
};
var softHyphen = "\xAD";
var Text = class extends Mark {
  constructor(data, options = {}) {
    const {
      x: x3,
      y: y3,
      text: text2 = isIterable(data) && isTextual(data) ? identity6 : indexOf,
      frameAnchor,
      textAnchor = /right$/i.test(frameAnchor) ? "end" : /left$/i.test(frameAnchor) ? "start" : "middle",
      lineAnchor = /^top/i.test(frameAnchor) ? "top" : /^bottom/i.test(frameAnchor) ? "bottom" : "middle",
      lineHeight = 1,
      lineWidth = Infinity,
      textOverflow,
      monospace,
      fontFamily = monospace ? "ui-monospace, monospace" : void 0,
      fontSize,
      fontStyle,
      fontVariant,
      fontWeight,
      rotate
    } = options;
    const [vrotate, crotate] = maybeNumberChannel(rotate, 0);
    const [vfontSize, cfontSize] = maybeFontSizeChannel(fontSize);
    super(
      data,
      {
        x: { value: x3, scale: "x", optional: true },
        y: { value: y3, scale: "y", optional: true },
        fontSize: { value: vfontSize, optional: true },
        rotate: { value: numberChannel(vrotate), optional: true },
        text: { value: text2, filter: nonempty, optional: true }
      },
      options,
      defaults2
    );
    this.rotate = crotate;
    this.textAnchor = impliedString(textAnchor, "middle");
    this.lineAnchor = keyword(lineAnchor, "lineAnchor", ["top", "middle", "bottom"]);
    this.lineHeight = +lineHeight;
    this.lineWidth = +lineWidth;
    this.textOverflow = maybeTextOverflow(textOverflow);
    this.monospace = !!monospace;
    this.fontFamily = string(fontFamily);
    this.fontSize = cfontSize;
    this.fontStyle = string(fontStyle);
    this.fontVariant = string(fontVariant);
    this.fontWeight = string(fontWeight);
    this.frameAnchor = maybeFrameAnchor(frameAnchor);
    if (!(this.lineWidth >= 0))
      throw new Error(`invalid lineWidth: ${lineWidth}`);
    this.splitLines = splitter(this);
    this.clipLine = clipper(this);
  }
  render(index2, scales, channels, dimensions, context) {
    const { x: x3, y: y3 } = scales;
    const { x: X4, y: Y4, rotate: R2, text: T, title: TL, fontSize: FS } = channels;
    const { rotate } = this;
    const [cx, cy] = applyFrameAnchor(this, dimensions);
    return create2("svg:g", context).call(applyIndirectStyles, this, dimensions, context).call(applyIndirectTextStyles, this, T, dimensions).call(applyTransform, this, { x: X4 && x3, y: Y4 && y3 }).call(
      (g2) => g2.selectAll().data(index2).enter().append("text").call(applyDirectStyles, this).call(applyMultilineText, this, T, TL).attr(
        "transform",
        template`translate(${X4 ? (i2) => X4[i2] : cx},${Y4 ? (i2) => Y4[i2] : cy})${R2 ? (i2) => ` rotate(${R2[i2]})` : rotate ? ` rotate(${rotate})` : ``}`
      ).call(applyAttr, "font-size", FS && ((i2) => FS[i2])).call(applyChannelStyles, this, channels)
    ).node();
  }
};
function maybeTextOverflow(textOverflow) {
  return textOverflow == null ? null : keyword(textOverflow, "textOverflow", [
    "clip",
    // shorthand for clip-end
    "ellipsis",
    // … ellipsis-end
    "clip-start",
    "clip-end",
    "ellipsis-start",
    "ellipsis-middle",
    "ellipsis-end"
  ]).replace(/^(clip|ellipsis)$/, "$1-end");
}
function applyMultilineText(selection2, mark, T, TL) {
  if (!T)
    return;
  const { lineAnchor, lineHeight, textOverflow, splitLines, clipLine } = mark;
  selection2.each(function(i2) {
    const lines = splitLines(formatDefault(T[i2]) ?? "").map(clipLine);
    const n2 = lines.length;
    const y3 = lineAnchor === "top" ? 0.71 : lineAnchor === "bottom" ? 1 - n2 : (164 - n2 * 100) / 200;
    if (n2 > 1) {
      let m = 0;
      for (let i3 = 0; i3 < n2; ++i3) {
        ++m;
        if (!lines[i3])
          continue;
        const tspan = this.ownerDocument.createElementNS(namespaces_default.svg, "tspan");
        tspan.setAttribute("x", 0);
        if (i3 === m - 1)
          tspan.setAttribute("y", `${(y3 + i3) * lineHeight}em`);
        else
          tspan.setAttribute("dy", `${m * lineHeight}em`);
        tspan.textContent = lines[i3];
        this.appendChild(tspan);
        m = 0;
      }
    } else {
      if (y3)
        this.setAttribute("y", `${y3 * lineHeight}em`);
      this.textContent = lines[0];
    }
    if (textOverflow && !TL && lines[0] !== T[i2]) {
      const title = this.ownerDocument.createElementNS(namespaces_default.svg, "title");
      title.textContent = T[i2];
      this.appendChild(title);
    }
  });
}
function text(data, { x: x3, y: y3, ...options } = {}) {
  if (options.frameAnchor === void 0)
    [x3, y3] = maybeTuple(x3, y3);
  return new Text(data, { ...options, x: x3, y: y3 });
}
function textX(data, { x: x3 = identity6, ...options } = {}) {
  return new Text(data, maybeIntervalMidY({ ...options, x: x3 }));
}
function textY(data, { y: y3 = identity6, ...options } = {}) {
  return new Text(data, maybeIntervalMidX({ ...options, y: y3 }));
}
function applyIndirectTextStyles(selection2, mark, T) {
  applyAttr(selection2, "text-anchor", mark.textAnchor);
  applyAttr(selection2, "font-family", mark.fontFamily);
  applyAttr(selection2, "font-size", mark.fontSize);
  applyAttr(selection2, "font-style", mark.fontStyle);
  applyAttr(selection2, "font-variant", mark.fontVariant === void 0 ? inferFontVariant2(T) : mark.fontVariant);
  applyAttr(selection2, "font-weight", mark.fontWeight);
}
function inferFontVariant2(T) {
  return T && (isNumeric(T) || isTemporal(T)) ? "tabular-nums" : void 0;
}
var fontSizes = /* @__PURE__ */ new Set([
  // global keywords
  "inherit",
  "initial",
  "revert",
  "unset",
  // absolute keywords
  "xx-small",
  "x-small",
  "small",
  "medium",
  "large",
  "x-large",
  "xx-large",
  "xxx-large",
  // relative keywords
  "larger",
  "smaller"
]);
function maybeFontSizeChannel(fontSize) {
  if (fontSize == null || typeof fontSize === "number")
    return [void 0, fontSize];
  if (typeof fontSize !== "string")
    return [fontSize, void 0];
  fontSize = fontSize.trim().toLowerCase();
  return fontSizes.has(fontSize) || /^[+-]?\d*\.?\d+(e[+-]?\d+)?(\w*|%)$/.test(fontSize) ? [void 0, fontSize] : [fontSize, void 0];
}
function lineWrap(input, maxWidth, widthof) {
  const lines = [];
  let lineStart, lineEnd = 0;
  for (const [wordStart, wordEnd, required] of lineBreaks(input)) {
    if (lineStart === void 0)
      lineStart = wordStart;
    if (lineEnd > lineStart && widthof(input, lineStart, wordEnd) > maxWidth) {
      lines.push(input.slice(lineStart, lineEnd) + (input[lineEnd - 1] === softHyphen ? "-" : ""));
      lineStart = wordStart;
    }
    if (required) {
      lines.push(input.slice(lineStart, wordEnd));
      lineStart = void 0;
      continue;
    }
    lineEnd = wordEnd;
  }
  return lines;
}
function* lineBreaks(input) {
  let i2 = 0, j2 = 0;
  const n2 = input.length;
  while (j2 < n2) {
    let k3 = 1;
    switch (input[j2]) {
      case softHyphen:
      case "-":
        ++j2;
        yield [i2, j2, false];
        i2 = j2;
        break;
      case " ":
        yield [i2, j2, false];
        while (input[++j2] === " ")
          ;
        i2 = j2;
        break;
      case "\r":
        if (input[j2 + 1] === "\n")
          ++k3;
      case "\n":
        yield [i2, j2, true];
        j2 += k3;
        i2 = j2;
        break;
      default:
        ++j2;
        break;
    }
  }
  yield [i2, j2, true];
}
var defaultWidthMap = {
  a: 56,
  b: 63,
  c: 57,
  d: 63,
  e: 58,
  f: 37,
  g: 62,
  h: 60,
  i: 26,
  j: 26,
  k: 55,
  l: 26,
  m: 88,
  n: 60,
  o: 60,
  p: 62,
  q: 62,
  r: 39,
  s: 54,
  t: 38,
  u: 60,
  v: 55,
  w: 79,
  x: 54,
  y: 55,
  z: 55,
  A: 69,
  B: 67,
  C: 73,
  D: 74,
  E: 61,
  F: 58,
  G: 76,
  H: 75,
  I: 28,
  J: 55,
  K: 67,
  L: 58,
  M: 89,
  N: 75,
  O: 78,
  P: 65,
  Q: 78,
  R: 67,
  S: 65,
  T: 65,
  U: 75,
  V: 69,
  W: 98,
  X: 69,
  Y: 67,
  Z: 67,
  0: 64,
  1: 48,
  2: 62,
  3: 64,
  4: 66,
  5: 63,
  6: 65,
  7: 58,
  8: 65,
  9: 65,
  " ": 29,
  "!": 32,
  '"': 49,
  "'": 31,
  "(": 39,
  ")": 39,
  ",": 31,
  "-": 48,
  ".": 31,
  "/": 32,
  ":": 31,
  ";": 31,
  "?": 52,
  "\u2018": 31,
  "\u2019": 31,
  "\u201C": 47,
  "\u201D": 47,
  "\u2026": 82
};
function defaultWidth(text2, start2 = 0, end = text2.length) {
  let sum2 = 0;
  for (let i2 = start2; i2 < end; i2 = readCharacter(text2, i2)) {
    sum2 += defaultWidthMap[text2[i2]] ?? (isPictographic(text2, i2) ? 120 : defaultWidthMap.e);
  }
  return sum2;
}
function monospaceWidth(text2, start2 = 0, end = text2.length) {
  let sum2 = 0;
  for (let i2 = start2; i2 < end; i2 = readCharacter(text2, i2)) {
    sum2 += isPictographic(text2, i2) ? 126 : 63;
  }
  return sum2;
}
function splitter({ monospace, lineWidth, textOverflow }) {
  if (textOverflow != null || lineWidth == Infinity)
    return (text2) => text2.split(/\r\n?|\n/g);
  const widthof = monospace ? monospaceWidth : defaultWidth;
  const maxWidth = lineWidth * 100;
  return (text2) => lineWrap(text2, maxWidth, widthof);
}
function clipper({ monospace, lineWidth, textOverflow }) {
  if (textOverflow == null || lineWidth == Infinity)
    return (text2) => text2;
  const widthof = monospace ? monospaceWidth : defaultWidth;
  const maxWidth = lineWidth * 100;
  switch (textOverflow) {
    case "clip-start":
      return (text2) => clipStart(text2, maxWidth, widthof, "");
    case "clip-end":
      return (text2) => clipEnd(text2, maxWidth, widthof, "");
    case "ellipsis-start":
      return (text2) => clipStart(text2, maxWidth, widthof, ellipsis);
    case "ellipsis-middle":
      return (text2) => clipMiddle(text2, maxWidth, widthof, ellipsis);
    case "ellipsis-end":
      return (text2) => clipEnd(text2, maxWidth, widthof, ellipsis);
  }
}
var ellipsis = "\u2026";
function cut(text2, width, widthof, inset) {
  const I2 = [];
  let w2 = 0;
  for (let i2 = 0, j2 = 0, n2 = text2.length; i2 < n2; i2 = j2) {
    j2 = readCharacter(text2, i2);
    const l2 = widthof(text2, i2, j2);
    if (w2 + l2 > width) {
      w2 += inset;
      while (w2 > width && i2 > 0)
        j2 = i2, i2 = I2.pop(), w2 -= widthof(text2, i2, j2);
      return [i2, width - w2];
    }
    w2 += l2;
    I2.push(i2);
  }
  return [-1, 0];
}
function clipEnd(text2, width, widthof, ellipsis2) {
  text2 = text2.trim();
  const e = widthof(ellipsis2);
  const [i2] = cut(text2, width, widthof, e);
  return i2 < 0 ? text2 : text2.slice(0, i2).trimEnd() + ellipsis2;
}
function clipMiddle(text2, width, widthof, ellipsis2) {
  text2 = text2.trim();
  const w2 = widthof(text2);
  if (w2 <= width)
    return text2;
  const e = widthof(ellipsis2) / 2;
  const [i2, ei] = cut(text2, width / 2, widthof, e);
  const [j2] = cut(text2, w2 - width / 2 - ei + e, widthof, -e);
  return j2 < 0 ? ellipsis2 : text2.slice(0, i2).trimEnd() + ellipsis2 + text2.slice(readCharacter(text2, j2)).trimStart();
}
function clipStart(text2, width, widthof, ellipsis2) {
  text2 = text2.trim();
  const w2 = widthof(text2);
  if (w2 <= width)
    return text2;
  const e = widthof(ellipsis2);
  const [j2] = cut(text2, w2 - width + e, widthof, -e);
  return j2 < 0 ? ellipsis2 : ellipsis2 + text2.slice(readCharacter(text2, j2)).trimStart();
}
var reCombiner = /[\p{Combining_Mark}\p{Emoji_Modifier}]+/uy;
var rePictographic = /\p{Extended_Pictographic}/uy;
function readCharacter(text2, i2) {
  i2 += isSurrogatePair(text2, i2) ? 2 : 1;
  if (isCombiner(text2, i2))
    i2 = reCombiner.lastIndex;
  if (isZeroWidthJoiner(text2, i2))
    return readCharacter(text2, i2 + 1);
  return i2;
}
function isAscii(text2, i2) {
  return text2.charCodeAt(i2) < 128;
}
function isSurrogatePair(text2, i2) {
  const hi = text2.charCodeAt(i2);
  if (hi >= 55296 && hi < 56320) {
    const lo = text2.charCodeAt(i2 + 1);
    return lo >= 56320 && lo < 57344;
  }
  return false;
}
function isZeroWidthJoiner(text2, i2) {
  return text2.charCodeAt(i2) === 8205;
}
function isCombiner(text2, i2) {
  return isAscii(text2, i2) ? false : (reCombiner.lastIndex = i2, reCombiner.test(text2));
}
function isPictographic(text2, i2) {
  return isAscii(text2, i2) ? false : (rePictographic.lastIndex = i2, rePictographic.test(text2));
}

// ../../node_modules/@observablehq/plot/src/marks/vector.js
var defaults3 = {
  ariaLabel: "vector",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinejoin: "round",
  strokeLinecap: "round"
};
var defaultRadius = 3.5;
var wingRatio = defaultRadius * 5;
var shapeArrow = {
  draw(context, l2, r2) {
    const wing = l2 * r2 / wingRatio;
    context.moveTo(0, 0);
    context.lineTo(0, -l2);
    context.moveTo(-wing, wing - l2);
    context.lineTo(0, -l2);
    context.lineTo(wing, wing - l2);
  }
};
var shapeSpike = {
  draw(context, l2, r2) {
    context.moveTo(-r2, 0);
    context.lineTo(0, -l2);
    context.lineTo(r2, 0);
  }
};
var shapes = /* @__PURE__ */ new Map([
  ["arrow", shapeArrow],
  ["spike", shapeSpike]
]);
function isShapeObject(value) {
  return value && typeof value.draw === "function";
}
function maybeShape(shape) {
  if (isShapeObject(shape))
    return shape;
  const value = shapes.get(`${shape}`.toLowerCase());
  if (value)
    return value;
  throw new Error(`invalid shape: ${shape}`);
}
var Vector = class extends Mark {
  constructor(data, options = {}) {
    const { x: x3, y: y3, r: r2 = defaultRadius, length: length3, rotate, shape = shapeArrow, anchor = "middle", frameAnchor } = options;
    const [vl, cl] = maybeNumberChannel(length3, 12);
    const [vr, cr] = maybeNumberChannel(rotate, 0);
    super(
      data,
      {
        x: { value: x3, scale: "x", optional: true },
        y: { value: y3, scale: "y", optional: true },
        length: { value: vl, scale: "length", optional: true },
        rotate: { value: vr, optional: true }
      },
      options,
      defaults3
    );
    this.r = +r2;
    this.length = cl;
    this.rotate = cr;
    this.shape = maybeShape(shape);
    this.anchor = keyword(anchor, "anchor", ["start", "middle", "end"]);
    this.frameAnchor = maybeFrameAnchor(frameAnchor);
  }
  render(index2, scales, channels, dimensions, context) {
    const { x: x3, y: y3 } = scales;
    const { x: X4, y: Y4, length: L2, rotate: A6 } = channels;
    const { length: length3, rotate, anchor, shape, r: r2 } = this;
    const [cx, cy] = applyFrameAnchor(this, dimensions);
    return create2("svg:g", context).call(applyIndirectStyles, this, dimensions, context).call(applyTransform, this, { x: X4 && x3, y: Y4 && y3 }).call(
      (g2) => g2.selectAll().data(index2).enter().append("path").call(applyDirectStyles, this).attr(
        "transform",
        template`translate(${X4 ? (i2) => X4[i2] : cx},${Y4 ? (i2) => Y4[i2] : cy})${A6 ? (i2) => ` rotate(${A6[i2]})` : rotate ? ` rotate(${rotate})` : ``}${anchor === "start" ? `` : anchor === "end" ? L2 ? (i2) => ` translate(0,${L2[i2]})` : ` translate(0,${length3})` : L2 ? (i2) => ` translate(0,${L2[i2] / 2})` : ` translate(0,${length3 / 2})`}`
      ).attr(
        "d",
        L2 ? (i2) => {
          const p2 = pathRound();
          shape.draw(p2, L2[i2], r2);
          return p2;
        } : (() => {
          const p2 = pathRound();
          shape.draw(p2, length3, r2);
          return p2;
        })()
      ).call(applyChannelStyles, this, channels)
    ).node();
  }
};
function vectorX(data, options = {}) {
  const { x: x3 = identity6, ...rest } = options;
  return new Vector(data, { ...rest, x: x3 });
}
function vectorY(data, options = {}) {
  const { y: y3 = identity6, ...rest } = options;
  return new Vector(data, { ...rest, y: y3 });
}

// ../../node_modules/@observablehq/plot/src/marks/axis.js
function maybeData(data, options) {
  if (arguments.length < 2 && !isIterable(data))
    options = data, data = null;
  if (options === void 0)
    options = {};
  return [data, options];
}
function maybeAnchor2({ anchor } = {}, anchors) {
  return anchor === void 0 ? anchors[0] : keyword(anchor, "anchor", anchors);
}
function anchorY2(options) {
  return maybeAnchor2(options, ["left", "right"]);
}
function anchorFy(options) {
  return maybeAnchor2(options, ["right", "left"]);
}
function anchorX2(options) {
  return maybeAnchor2(options, ["bottom", "top"]);
}
function anchorFx(options) {
  return maybeAnchor2(options, ["top", "bottom"]);
}
function axisY() {
  const [data, options] = maybeData(...arguments);
  return axisKy("y", anchorY2(options), data, options);
}
function axisFy() {
  const [data, options] = maybeData(...arguments);
  return axisKy("fy", anchorFy(options), data, options);
}
function axisX() {
  const [data, options] = maybeData(...arguments);
  return axisKx("x", anchorX2(options), data, options);
}
function axisFx() {
  const [data, options] = maybeData(...arguments);
  return axisKx("fx", anchorFx(options), data, options);
}
function axisKy(k3, anchor, data, {
  color: color3 = "currentColor",
  opacity: opacity2 = 1,
  stroke = color3,
  strokeOpacity = opacity2,
  strokeWidth = 1,
  fill = color3,
  fillOpacity = opacity2,
  textAnchor,
  textStroke,
  textStrokeOpacity,
  textStrokeWidth,
  tickSize = k3 === "y" ? 6 : 0,
  tickPadding,
  tickRotate,
  x: x3,
  margin,
  marginTop = margin === void 0 ? 20 : margin,
  marginRight = margin === void 0 ? anchor === "right" ? 40 : 0 : margin,
  marginBottom = margin === void 0 ? 20 : margin,
  marginLeft = margin === void 0 ? anchor === "left" ? 40 : 0 : margin,
  label,
  labelAnchor,
  labelArrow,
  labelOffset,
  ...options
}) {
  tickSize = number5(tickSize);
  tickPadding = number5(tickPadding);
  tickRotate = number5(tickRotate);
  if (labelAnchor !== void 0)
    labelAnchor = keyword(labelAnchor, "labelAnchor", ["center", "top", "bottom"]);
  labelArrow = maybeLabelArrow(labelArrow);
  return marks(
    tickSize && !isNoneish(stroke) ? axisTickKy(k3, anchor, data, {
      stroke,
      strokeOpacity,
      strokeWidth,
      tickSize,
      tickPadding,
      tickRotate,
      x: x3,
      ...options
    }) : null,
    !isNoneish(fill) ? axisTextKy(k3, anchor, data, {
      fill,
      fillOpacity,
      stroke: textStroke,
      strokeOpacity: textStrokeOpacity,
      strokeWidth: textStrokeWidth,
      textAnchor,
      tickSize,
      tickPadding,
      tickRotate,
      x: x3,
      marginTop,
      marginRight,
      marginBottom,
      marginLeft,
      ...options
    }) : null,
    !isNoneish(fill) && label !== null ? text(
      [],
      labelOptions({ fill, fillOpacity, ...options }, function(data2, facets, channels, scales, dimensions) {
        const scale = scales[k3];
        const { marginTop: marginTop2, marginRight: marginRight2, marginBottom: marginBottom2, marginLeft: marginLeft2 } = k3 === "y" && dimensions.inset || dimensions;
        const cla = labelAnchor ?? (scale.bandwidth ? "center" : "top");
        const clo = labelOffset ?? (anchor === "right" ? marginRight2 : marginLeft2) - 3;
        if (cla === "center") {
          this.textAnchor = void 0;
          this.lineAnchor = anchor === "right" ? "bottom" : "top";
          this.frameAnchor = anchor;
          this.rotate = -90;
        } else {
          this.textAnchor = anchor === "right" ? "end" : "start";
          this.lineAnchor = cla;
          this.frameAnchor = `${cla}-${anchor}`;
          this.rotate = 0;
        }
        this.dy = cla === "top" ? 3 - marginTop2 : cla === "bottom" ? marginBottom2 - 3 : 0;
        this.dx = anchor === "right" ? clo : -clo;
        this.ariaLabel = `${k3}-axis label`;
        return {
          facets: [[0]],
          channels: { text: { value: [formatAxisLabel(k3, scale, { anchor, label, labelAnchor: cla, labelArrow })] } }
        };
      })
    ) : null
  );
}
function axisKx(k3, anchor, data, {
  color: color3 = "currentColor",
  opacity: opacity2 = 1,
  stroke = color3,
  strokeOpacity = opacity2,
  strokeWidth = 1,
  fill = color3,
  fillOpacity = opacity2,
  textAnchor,
  textStroke,
  textStrokeOpacity,
  textStrokeWidth,
  tickSize = k3 === "x" ? 6 : 0,
  tickPadding,
  tickRotate,
  y: y3,
  margin,
  marginTop = margin === void 0 ? anchor === "top" ? 30 : 0 : margin,
  marginRight = margin === void 0 ? 20 : margin,
  marginBottom = margin === void 0 ? anchor === "bottom" ? 30 : 0 : margin,
  marginLeft = margin === void 0 ? 20 : margin,
  label,
  labelAnchor,
  labelArrow,
  labelOffset,
  ...options
}) {
  tickSize = number5(tickSize);
  tickPadding = number5(tickPadding);
  tickRotate = number5(tickRotate);
  if (labelAnchor !== void 0)
    labelAnchor = keyword(labelAnchor, "labelAnchor", ["center", "left", "right"]);
  labelArrow = maybeLabelArrow(labelArrow);
  return marks(
    tickSize && !isNoneish(stroke) ? axisTickKx(k3, anchor, data, {
      stroke,
      strokeOpacity,
      strokeWidth,
      tickSize,
      tickPadding,
      tickRotate,
      y: y3,
      ...options
    }) : null,
    !isNoneish(fill) ? axisTextKx(k3, anchor, data, {
      fill,
      fillOpacity,
      stroke: textStroke,
      strokeOpacity: textStrokeOpacity,
      strokeWidth: textStrokeWidth,
      textAnchor,
      tickSize,
      tickPadding,
      tickRotate,
      y: y3,
      marginTop,
      marginRight,
      marginBottom,
      marginLeft,
      ...options
    }) : null,
    !isNoneish(fill) && label !== null ? text(
      [],
      labelOptions({ fill, fillOpacity, ...options }, function(data2, facets, channels, scales, dimensions) {
        const scale = scales[k3];
        const { marginTop: marginTop2, marginRight: marginRight2, marginBottom: marginBottom2, marginLeft: marginLeft2 } = k3 === "x" && dimensions.inset || dimensions;
        const cla = labelAnchor ?? (scale.bandwidth ? "center" : "right");
        const clo = labelOffset ?? (anchor === "top" ? marginTop2 : marginBottom2) - 3;
        if (cla === "center") {
          this.frameAnchor = anchor;
          this.textAnchor = void 0;
        } else {
          this.frameAnchor = `${anchor}-${cla}`;
          this.textAnchor = cla === "right" ? "end" : "start";
        }
        this.lineAnchor = anchor;
        this.dy = anchor === "top" ? -clo : clo;
        this.dx = cla === "right" ? marginRight2 - 3 : cla === "left" ? 3 - marginLeft2 : 0;
        this.ariaLabel = `${k3}-axis label`;
        return {
          facets: [[0]],
          channels: { text: { value: [formatAxisLabel(k3, scale, { anchor, label, labelAnchor: cla, labelArrow })] } }
        };
      })
    ) : null
  );
}
function axisTickKy(k3, anchor, data, {
  strokeWidth = 1,
  strokeLinecap = null,
  strokeLinejoin = null,
  facetAnchor = anchor + (k3 === "y" ? "-empty" : ""),
  frameAnchor = anchor,
  tickSize,
  inset = 0,
  insetLeft = inset,
  insetRight = inset,
  dx = 0,
  y: y3 = k3 === "y" ? void 0 : null,
  ...options
}) {
  return axisMark(
    vectorY,
    k3,
    data,
    {
      ariaLabel: `${k3}-axis tick`,
      ariaHidden: true
    },
    {
      strokeWidth,
      strokeLinecap,
      strokeLinejoin,
      facetAnchor,
      frameAnchor,
      y: y3,
      ...options,
      dx: anchor === "left" ? +dx - offset + +insetLeft : +dx + offset - insetRight,
      anchor: "start",
      length: tickSize,
      shape: anchor === "left" ? shapeTickLeft : shapeTickRight
    }
  );
}
function axisTickKx(k3, anchor, data, {
  strokeWidth = 1,
  strokeLinecap = null,
  strokeLinejoin = null,
  facetAnchor = anchor + (k3 === "x" ? "-empty" : ""),
  frameAnchor = anchor,
  tickSize,
  inset = 0,
  insetTop = inset,
  insetBottom = inset,
  dy = 0,
  x: x3 = k3 === "x" ? void 0 : null,
  ...options
}) {
  return axisMark(
    vectorX,
    k3,
    data,
    {
      ariaLabel: `${k3}-axis tick`,
      ariaHidden: true
    },
    {
      strokeWidth,
      strokeLinejoin,
      strokeLinecap,
      facetAnchor,
      frameAnchor,
      x: x3,
      ...options,
      dy: anchor === "bottom" ? +dy - offset - insetBottom : +dy + offset + +insetTop,
      anchor: "start",
      length: tickSize,
      shape: anchor === "bottom" ? shapeTickBottom : shapeTickTop
    }
  );
}
function axisTextKy(k3, anchor, data, {
  facetAnchor = anchor + (k3 === "y" ? "-empty" : ""),
  frameAnchor = anchor,
  tickSize,
  tickRotate = 0,
  tickPadding = Math.max(3, 9 - tickSize) + (Math.abs(tickRotate) > 60 ? 4 * Math.cos(tickRotate * radians3) : 0),
  text: text2,
  textAnchor = Math.abs(tickRotate) > 60 ? "middle" : anchor === "left" ? "end" : "start",
  lineAnchor = tickRotate > 60 ? "top" : tickRotate < -60 ? "bottom" : "middle",
  fontVariant,
  inset = 0,
  insetLeft = inset,
  insetRight = inset,
  dx = 0,
  y: y3 = k3 === "y" ? void 0 : null,
  ...options
}) {
  return axisMark(
    textY,
    k3,
    data,
    { ariaLabel: `${k3}-axis tick label` },
    {
      facetAnchor,
      frameAnchor,
      text: text2,
      textAnchor,
      lineAnchor,
      fontVariant,
      rotate: tickRotate,
      y: y3,
      ...options,
      dx: anchor === "left" ? +dx - tickSize - tickPadding + +insetLeft : +dx + +tickSize + +tickPadding - insetRight
    },
    function(scale, data2, ticks2, tickFormat2, channels) {
      if (fontVariant === void 0)
        this.fontVariant = inferFontVariant3(scale);
      if (text2 === void 0)
        channels.text = inferTextChannel(scale, data2, ticks2, tickFormat2, anchor);
    }
  );
}
function axisTextKx(k3, anchor, data, {
  facetAnchor = anchor + (k3 === "x" ? "-empty" : ""),
  frameAnchor = anchor,
  tickSize,
  tickRotate = 0,
  tickPadding = Math.max(3, 9 - tickSize) + (Math.abs(tickRotate) >= 10 ? 4 * Math.cos(tickRotate * radians3) : 0),
  text: text2,
  textAnchor = Math.abs(tickRotate) >= 10 ? tickRotate < 0 ^ anchor === "bottom" ? "start" : "end" : "middle",
  lineAnchor = Math.abs(tickRotate) >= 10 ? "middle" : anchor === "bottom" ? "top" : "bottom",
  fontVariant,
  inset = 0,
  insetTop = inset,
  insetBottom = inset,
  dy = 0,
  x: x3 = k3 === "x" ? void 0 : null,
  ...options
}) {
  return axisMark(
    textX,
    k3,
    data,
    { ariaLabel: `${k3}-axis tick label` },
    {
      facetAnchor,
      frameAnchor,
      text: text2 === void 0 ? null : text2,
      textAnchor,
      lineAnchor,
      fontVariant,
      rotate: tickRotate,
      x: x3,
      ...options,
      dy: anchor === "bottom" ? +dy + +tickSize + +tickPadding - insetBottom : +dy - tickSize - tickPadding + +insetTop
    },
    function(scale, data2, ticks2, tickFormat2, channels) {
      if (fontVariant === void 0)
        this.fontVariant = inferFontVariant3(scale);
      if (text2 === void 0)
        channels.text = inferTextChannel(scale, data2, ticks2, tickFormat2, anchor);
    }
  );
}
function gridY() {
  const [data, options] = maybeData(...arguments);
  return gridKy("y", anchorY2(options), data, options);
}
function gridFy() {
  const [data, options] = maybeData(...arguments);
  return gridKy("fy", anchorFy(options), data, options);
}
function gridX() {
  const [data, options] = maybeData(...arguments);
  return gridKx("x", anchorX2(options), data, options);
}
function gridFx() {
  const [data, options] = maybeData(...arguments);
  return gridKx("fx", anchorFx(options), data, options);
}
function gridKy(k3, anchor, data, {
  y: y3 = k3 === "y" ? void 0 : null,
  x: x3 = null,
  x1: x12 = anchor === "left" ? x3 : null,
  x2: x22 = anchor === "right" ? x3 : null,
  ...options
}) {
  return axisMark(ruleY, k3, data, { ariaLabel: `${k3}-grid`, ariaHidden: true }, { y: y3, x1: x12, x2: x22, ...gridDefaults(options) });
}
function gridKx(k3, anchor, data, {
  x: x3 = k3 === "x" ? void 0 : null,
  y: y3 = null,
  y1: y12 = anchor === "top" ? y3 : null,
  y2: y22 = anchor === "bottom" ? y3 : null,
  ...options
}) {
  return axisMark(ruleX, k3, data, { ariaLabel: `${k3}-grid`, ariaHidden: true }, { x: x3, y1: y12, y2: y22, ...gridDefaults(options) });
}
function gridDefaults({
  color: color3 = "currentColor",
  opacity: opacity2 = 0.1,
  stroke = color3,
  strokeOpacity = opacity2,
  strokeWidth = 1,
  ...options
}) {
  return { stroke, strokeOpacity, strokeWidth, ...options };
}
function labelOptions({
  fill,
  fillOpacity,
  fontFamily,
  fontSize,
  fontStyle,
  fontVariant,
  fontWeight,
  monospace,
  pointerEvents,
  shapeRendering,
  clip = false
}, initializer2) {
  [, fill] = maybeColorChannel(fill);
  [, fillOpacity] = maybeNumberChannel(fillOpacity);
  return {
    facet: "super",
    x: null,
    y: null,
    fill,
    fillOpacity,
    fontFamily,
    fontSize,
    fontStyle,
    fontVariant,
    fontWeight,
    monospace,
    pointerEvents,
    shapeRendering,
    clip,
    initializer: initializer2
  };
}
function axisMark(mark, k3, data, properties, options, initialize) {
  let channels;
  function axisInitializer(data2, facets, _channels, scales, dimensions, context) {
    const initializeFacets = data2 == null && (k3 === "fx" || k3 === "fy");
    const { [k3]: scale } = scales;
    if (!scale)
      throw new Error(`missing scale: ${k3}`);
    const domain = scale.domain();
    let { interval: interval2, ticks: ticks2, tickFormat: tickFormat2, tickSpacing = k3 === "x" ? 80 : 35 } = options;
    if (typeof ticks2 === "string" && hasTemporalDomain(scale))
      interval2 = ticks2, ticks2 = void 0;
    if (ticks2 === void 0)
      ticks2 = maybeRangeInterval(interval2, scale.type) ?? inferTickCount(scale, tickSpacing);
    if (data2 == null) {
      if (isIterable(ticks2)) {
        data2 = arrayify2(ticks2);
      } else if (isInterval(ticks2)) {
        data2 = inclusiveRange(ticks2, ...extent(domain));
      } else if (scale.interval) {
        let interval3 = scale.interval;
        if (scale.ticks) {
          const [min4, max3] = extent(domain);
          const n2 = (max3 - min4) / interval3[intervalDuration];
          interval3 = generalizeTimeInterval(interval3, n2 / ticks2) ?? interval3;
          data2 = inclusiveRange(interval3, min4, max3);
        } else {
          data2 = domain;
          const n2 = data2.length;
          interval3 = generalizeTimeInterval(interval3, n2 / ticks2) ?? interval3;
          if (interval3 !== scale.interval)
            data2 = inclusiveRange(interval3, ...extent(data2));
        }
        if (interval3 === scale.interval) {
          const n2 = Math.round(data2.length / ticks2);
          if (n2 > 1)
            data2 = data2.filter((d2, i2) => i2 % n2 === 0);
        }
      } else if (scale.ticks) {
        data2 = scale.ticks(ticks2);
      } else {
        data2 = domain;
      }
      if (!scale.ticks && data2.length && data2 !== domain) {
        const domainSet = new InternSet(domain);
        data2 = data2.filter((d2) => domainSet.has(d2));
        if (!data2.length)
          warn(`Warning: the ${k3}-axis ticks appear to not align with the scale domain, resulting in no ticks. Try different ticks?`);
      }
      if (k3 === "y" || k3 === "x") {
        facets = [range2(data2)];
      } else {
        channels[k3] = { scale: k3, value: identity6 };
      }
    }
    initialize?.call(this, scale, data2, ticks2, tickFormat2, channels);
    const initializedChannels = Object.fromEntries(
      Object.entries(channels).map(([name, channel]) => {
        return [name, { ...channel, value: valueof(data2, channel.value) }];
      })
    );
    if (initializeFacets)
      facets = context.filterFacets(data2, initializedChannels);
    return { data: data2, facets, channels: initializedChannels };
  }
  const basicInitializer = initializer(options).initializer;
  const m = mark(data, initializer({ ...options, initializer: axisInitializer }, basicInitializer));
  if (data == null) {
    channels = m.channels;
    m.channels = {};
  } else {
    channels = {};
  }
  if (properties !== void 0)
    Object.assign(m, properties);
  if (m.clip === void 0)
    m.clip = false;
  return m;
}
function inferTickCount(scale, tickSpacing) {
  const [min4, max3] = extent(scale.range());
  return (max3 - min4) / tickSpacing;
}
function inferTextChannel(scale, data, ticks2, tickFormat2, anchor) {
  return { value: inferTickFormat(scale, data, ticks2, tickFormat2, anchor) };
}
function inferTickFormat(scale, data, ticks2, tickFormat2, anchor) {
  return typeof tickFormat2 === "function" && !(scale.type === "log" && scale.tickFormat) ? tickFormat2 : tickFormat2 === void 0 && data && isTemporal(data) ? inferTimeFormat(scale.type, data, anchor) ?? formatDefault : scale.tickFormat ? scale.tickFormat(typeof ticks2 === "number" ? ticks2 : null, tickFormat2) : tickFormat2 === void 0 ? formatDefault : typeof tickFormat2 === "string" ? (isTemporal(scale.domain()) ? utcFormat : format)(tickFormat2) : constant(tickFormat2);
}
function inclusiveRange(interval2, min4, max3) {
  return interval2.range(min4, interval2.offset(interval2.floor(max3)));
}
var shapeTickBottom = {
  draw(context, l2) {
    context.moveTo(0, 0);
    context.lineTo(0, l2);
  }
};
var shapeTickTop = {
  draw(context, l2) {
    context.moveTo(0, 0);
    context.lineTo(0, -l2);
  }
};
var shapeTickLeft = {
  draw(context, l2) {
    context.moveTo(0, 0);
    context.lineTo(-l2, 0);
  }
};
var shapeTickRight = {
  draw(context, l2) {
    context.moveTo(0, 0);
    context.lineTo(l2, 0);
  }
};
function inferFontVariant3(scale) {
  return scale.bandwidth && !scale.interval ? void 0 : "tabular-nums";
}
function formatAxisLabel(k3, scale, { anchor, label = scale.label, labelAnchor, labelArrow } = {}) {
  if (label == null || label.inferred && hasTemporalDomain(scale) && /^(date|time|year)$/i.test(label))
    return;
  label = String(label);
  if (labelArrow === "auto")
    labelArrow = (!scale.bandwidth || scale.interval) && !/[↑↓→←]/.test(label);
  if (!labelArrow)
    return label;
  if (labelArrow === true) {
    const order = inferScaleOrder(scale);
    if (order)
      labelArrow = /x$/.test(k3) || labelAnchor === "center" ? /x$/.test(k3) === order < 0 ? "left" : "right" : order < 0 ? "up" : "down";
  }
  switch (labelArrow) {
    case "left":
      return `\u2190 ${label}`;
    case "right":
      return `${label} \u2192`;
    case "up":
      return anchor === "right" ? `${label} \u2191` : `\u2191 ${label}`;
    case "down":
      return anchor === "right" ? `${label} \u2193` : `\u2193 ${label}`;
  }
  return label;
}
function maybeLabelArrow(labelArrow = "auto") {
  return isNoneish(labelArrow) ? false : typeof labelArrow === "boolean" ? labelArrow : keyword(labelArrow, "labelArrow", ["auto", "up", "right", "down", "left"]);
}
function hasTemporalDomain(scale) {
  return isTemporal(scale.domain());
}

// ../../node_modules/@observablehq/plot/src/legends/swatches.js
function maybeScale(scale, key) {
  if (key == null)
    return key;
  const s3 = scale(key);
  if (!s3)
    throw new Error(`scale not found: ${key}`);
  return s3;
}
function legendSwatches(color3, { opacity: opacity2, ...options } = {}) {
  if (!isOrdinalScale(color3) && !isThresholdScale(color3))
    throw new Error(`swatches legend requires ordinal or threshold color scale (not ${color3.type})`);
  return legendItems(
    color3,
    options,
    (selection2, scale, width, height) => selection2.append("svg").attr("width", width).attr("height", height).attr("fill", scale.scale).attr("fill-opacity", maybeNumberChannel(opacity2)[1]).append("rect").attr("width", "100%").attr("height", "100%")
  );
}
function legendSymbols(symbol2, {
  fill = symbol2.hint?.fill !== void 0 ? symbol2.hint.fill : "none",
  fillOpacity = 1,
  stroke = symbol2.hint?.stroke !== void 0 ? symbol2.hint.stroke : isNoneish(fill) ? "currentColor" : "none",
  strokeOpacity = 1,
  strokeWidth = 1.5,
  r: r2 = 4.5,
  ...options
} = {}, scale) {
  const [vf, cf] = maybeColorChannel(fill);
  const [vs, cs] = maybeColorChannel(stroke);
  const sf = maybeScale(scale, vf);
  const ss = maybeScale(scale, vs);
  const size = r2 * r2 * Math.PI;
  fillOpacity = maybeNumberChannel(fillOpacity)[1];
  strokeOpacity = maybeNumberChannel(strokeOpacity)[1];
  strokeWidth = maybeNumberChannel(strokeWidth)[1];
  return legendItems(
    symbol2,
    options,
    (selection2, scale2, width, height) => selection2.append("svg").attr("viewBox", "-8 -8 16 16").attr("width", width).attr("height", height).attr("fill", vf === "color" ? (d2) => sf.scale(d2) : cf).attr("fill-opacity", fillOpacity).attr("stroke", vs === "color" ? (d2) => ss.scale(d2) : cs).attr("stroke-opacity", strokeOpacity).attr("stroke-width", strokeWidth).append("path").attr("d", (d2) => {
      const p2 = pathRound();
      symbol2.scale(d2).draw(p2, size);
      return p2;
    })
  );
}
function legendItems(scale, options = {}, swatch) {
  let {
    columns,
    tickFormat: tickFormat2,
    fontVariant = inferFontVariant(scale),
    // TODO label,
    swatchSize = 15,
    swatchWidth = swatchSize,
    swatchHeight = swatchSize,
    marginLeft = 0,
    className,
    style,
    width
  } = options;
  const context = createContext(options);
  className = maybeClassName(className);
  tickFormat2 = inferTickFormat(scale.scale, scale.domain, void 0, tickFormat2);
  const swatches = create2("div", context).attr(
    "class",
    `${className}-swatches ${className}-swatches-${columns != null ? "columns" : "wrap"}`
  );
  let extraStyle;
  if (columns != null) {
    extraStyle = `:where(.${className}-swatches-columns .${className}-swatch) {
  display: flex;
  align-items: center;
  break-inside: avoid;
  padding-bottom: 1px;
}
:where(.${className}-swatches-columns .${className}-swatch::before) {
  flex-shrink: 0;
}
:where(.${className}-swatches-columns .${className}-swatch-label) {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}`;
    swatches.style("columns", columns).selectAll().data(scale.domain).enter().append("div").attr("class", `${className}-swatch`).call(swatch, scale, swatchWidth, swatchHeight).call(
      (item) => item.append("div").attr("class", `${className}-swatch-label`).attr("title", tickFormat2).text(tickFormat2)
    );
  } else {
    extraStyle = `:where(.${className}-swatches-wrap) {
  display: flex;
  align-items: center;
  min-height: 33px;
  flex-wrap: wrap;
}
:where(.${className}-swatches-wrap .${className}-swatch) {
  display: inline-flex;
  align-items: center;
  margin-right: 1em;
}`;
    swatches.selectAll().data(scale.domain).enter().append("span").attr("class", `${className}-swatch`).call(swatch, scale, swatchWidth, swatchHeight).append(function() {
      return this.ownerDocument.createTextNode(tickFormat2.apply(this, arguments));
    });
  }
  return swatches.call(
    (div) => div.insert("style", "*").text(
      `:where(.${className}-swatches) {
  font-family: system-ui, sans-serif;
  font-size: 10px;
  margin-bottom: 0.5em;
}
:where(.${className}-swatch > svg) {
  margin-right: 0.5em;
  overflow: visible;
}
${extraStyle}`
    )
  ).style("margin-left", marginLeft ? `${+marginLeft}px` : null).style("width", width === void 0 ? null : `${+width}px`).style("font-variant", impliedString(fontVariant, "normal")).call(applyInlineStyles, style).node();
}

// ../../node_modules/@observablehq/plot/src/legends.js
var legendRegistry = /* @__PURE__ */ new Map([
  ["symbol", legendSymbols],
  ["color", legendColor],
  ["opacity", legendOpacity]
]);
function exposeLegends(scales, context, defaults12 = {}) {
  return (key, options) => {
    if (!legendRegistry.has(key))
      throw new Error(`unknown legend type: ${key}`);
    if (!(key in scales))
      return;
    return legendRegistry.get(key)(scales[key], legendOptions(context, defaults12[key], options), (key2) => scales[key2]);
  };
}
function legendOptions({ className, ...context }, { label, ticks: ticks2, tickFormat: tickFormat2 } = {}, options) {
  return inherit2(options, { className, ...context }, { label, ticks: ticks2, tickFormat: tickFormat2 });
}
function legendColor(color3, { legend = true, ...options }) {
  if (legend === true)
    legend = color3.type === "ordinal" ? "swatches" : "ramp";
  if (color3.domain === void 0)
    return;
  switch (`${legend}`.toLowerCase()) {
    case "swatches":
      return legendSwatches(color3, options);
    case "ramp":
      return legendRamp(color3, options);
    default:
      throw new Error(`unknown legend type: ${legend}`);
  }
}
function legendOpacity({ type: type2, interpolate, ...scale }, { legend = true, color: color3 = rgb(0, 0, 0), ...options }) {
  if (!interpolate)
    throw new Error(`${type2} opacity scales are not supported`);
  if (legend === true)
    legend = "ramp";
  if (`${legend}`.toLowerCase() !== "ramp")
    throw new Error(`${legend} opacity legends are not supported`);
  return legendColor({ type: type2, ...scale, interpolate: interpolateOpacity(color3) }, { legend, ...options });
}
function interpolateOpacity(color3) {
  const { r: r2, g: g2, b: b2 } = rgb(color3) || rgb(0, 0, 0);
  return (t5) => `rgba(${r2},${g2},${b2},${t5})`;
}
function createLegends(scales, context, options) {
  const legends = [];
  for (const [key, value] of legendRegistry) {
    const o2 = options[key];
    if (o2?.legend && key in scales) {
      const legend = value(scales[key], legendOptions(context, scales[key], o2), (key2) => scales[key2]);
      if (legend != null)
        legends.push(legend);
    }
  }
  return legends;
}

// ../../node_modules/@observablehq/plot/src/transforms/identity.js
function maybeIdentityX(options = {}) {
  return hasX(options) ? options : { ...options, x: identity6 };
}
function maybeIdentityY(options = {}) {
  return hasY(options) ? options : { ...options, y: identity6 };
}

// ../../node_modules/@observablehq/plot/src/transforms/exclusiveFacets.js
function exclusiveFacets(data, facets) {
  if (facets.length === 1)
    return { data, facets };
  const n2 = lengthof(data);
  const O2 = new Uint8Array(n2);
  let overlaps = 0;
  for (const facet of facets) {
    for (const i2 of facet) {
      if (O2[i2])
        ++overlaps;
      O2[i2] = 1;
    }
  }
  if (overlaps === 0)
    return { data, facets };
  data = slice2(data);
  const R2 = data[reindex] = new Uint32Array(n2 + overlaps);
  facets = facets.map((facet) => slice2(facet, Uint32Array));
  let j2 = n2;
  O2.fill(0);
  for (const facet of facets) {
    for (let k3 = 0, m = facet.length; k3 < m; ++k3) {
      const i2 = facet[k3];
      if (O2[i2])
        facet[k3] = j2, data[j2] = data[i2], R2[j2] = i2, ++j2;
      else
        R2[i2] = i2;
      O2[i2] = 1;
    }
  }
  return { data, facets };
}

// ../../node_modules/@observablehq/plot/src/transforms/stack.js
function stackX(stackOptions = {}, options = {}) {
  if (arguments.length === 1)
    [stackOptions, options] = mergeOptions(stackOptions);
  const { y1: y12, y: y3 = y12, x: x3, ...rest } = options;
  const [transform2, Y4, x12, x22] = stack(y3, x3, "y", "x", stackOptions, rest);
  return { ...transform2, y1: y12, y: Y4, x1: x12, x2: x22, x: mid(x12, x22) };
}
function stackY(stackOptions = {}, options = {}) {
  if (arguments.length === 1)
    [stackOptions, options] = mergeOptions(stackOptions);
  const { x1: x12, x: x3 = x12, y: y3, ...rest } = options;
  const [transform2, X4, y12, y22] = stack(x3, y3, "x", "y", stackOptions, rest);
  return { ...transform2, x1: x12, x: X4, y1: y12, y2: y22, y: mid(y12, y22) };
}
function maybeStackX({ x: x3, x1: x12, x2: x22, ...options } = {}) {
  options = withTip(options, "y");
  if (x12 === void 0 && x22 === void 0)
    return stackX({ x: x3, ...options });
  [x12, x22] = maybeZero(x3, x12, x22);
  return { ...options, x1: x12, x2: x22 };
}
function maybeStackY({ y: y3, y1: y12, y2: y22, ...options } = {}) {
  options = withTip(options, "x");
  if (y12 === void 0 && y22 === void 0)
    return stackY({ y: y3, ...options });
  [y12, y22] = maybeZero(y3, y12, y22);
  return { ...options, y1: y12, y2: y22 };
}
function mergeOptions(options) {
  const { offset: offset2, order, reverse: reverse2, ...rest } = options;
  return [{ offset: offset2, order, reverse: reverse2 }, rest];
}
var lengthy = { length: true };
function stack(x3, y3 = one2, kx2, ky2, { offset: offset2, order, reverse: reverse2 }, options) {
  if (y3 === null)
    throw new Error(`stack requires ${ky2}`);
  const z2 = maybeZ(options);
  const [X4, setX] = maybeColumn(x3);
  const [Y12, setY1] = column(y3);
  const [Y22, setY2] = column(y3);
  Y12.hint = Y22.hint = lengthy;
  offset2 = maybeOffset(offset2);
  order = maybeOrder2(order, offset2, ky2);
  return [
    basic(options, (data, facets, plotOptions) => {
      ({ data, facets } = exclusiveFacets(data, facets));
      const X5 = x3 == null ? void 0 : setX(maybeApplyInterval(valueof(data, x3), plotOptions?.[kx2]));
      const Y4 = valueof(data, y3, Float64Array);
      const Z3 = valueof(data, z2);
      const compare = order && order(data, X5, Y4, Z3);
      const n2 = lengthof(data);
      const Y13 = setY1(new Float64Array(n2));
      const Y23 = setY2(new Float64Array(n2));
      const facetstacks = [];
      for (const facet of facets) {
        const stacks = X5 ? Array.from(group(facet, (i2) => X5[i2]).values()) : [facet];
        if (compare)
          for (const stack2 of stacks)
            stack2.sort(compare);
        for (const stack2 of stacks) {
          let yn = 0;
          let yp = 0;
          if (reverse2)
            stack2.reverse();
          for (const i2 of stack2) {
            const y4 = Y4[i2];
            if (y4 < 0)
              yn = Y23[i2] = (Y13[i2] = yn) + y4;
            else if (y4 > 0)
              yp = Y23[i2] = (Y13[i2] = yp) + y4;
            else
              Y23[i2] = Y13[i2] = yp;
          }
        }
        facetstacks.push(stacks);
      }
      if (offset2)
        offset2(facetstacks, Y13, Y23, Z3);
      return { data, facets };
    }),
    X4,
    Y12,
    Y22
  ];
}
function maybeOffset(offset2) {
  if (offset2 == null)
    return;
  if (typeof offset2 === "function")
    return offset2;
  switch (`${offset2}`.toLowerCase()) {
    case "expand":
    case "normalize":
      return offsetExpand;
    case "center":
    case "silhouette":
      return offsetCenter;
    case "wiggle":
      return offsetWiggle;
  }
  throw new Error(`unknown offset: ${offset2}`);
}
function extent2(stack2, Y22) {
  let min4 = 0, max3 = 0;
  for (const i2 of stack2) {
    const y3 = Y22[i2];
    if (y3 < min4)
      min4 = y3;
    if (y3 > max3)
      max3 = y3;
  }
  return [min4, max3];
}
function offsetExpand(facetstacks, Y12, Y22) {
  for (const stacks of facetstacks) {
    for (const stack2 of stacks) {
      const [yn, yp] = extent2(stack2, Y22);
      for (const i2 of stack2) {
        const m = 1 / (yp - yn || 1);
        Y12[i2] = m * (Y12[i2] - yn);
        Y22[i2] = m * (Y22[i2] - yn);
      }
    }
  }
}
function offsetCenter(facetstacks, Y12, Y22) {
  for (const stacks of facetstacks) {
    for (const stack2 of stacks) {
      const [yn, yp] = extent2(stack2, Y22);
      for (const i2 of stack2) {
        const m = (yp + yn) / 2;
        Y12[i2] -= m;
        Y22[i2] -= m;
      }
    }
    offsetZero(stacks, Y12, Y22);
  }
  offsetCenterFacets(facetstacks, Y12, Y22);
}
function offsetWiggle(facetstacks, Y12, Y22, Z3) {
  for (const stacks of facetstacks) {
    const prev = new InternMap();
    let y3 = 0;
    for (const stack2 of stacks) {
      let j2 = -1;
      const Fi = stack2.map((i2) => Math.abs(Y22[i2] - Y12[i2]));
      const Df = stack2.map((i2) => {
        j2 = Z3 ? Z3[i2] : ++j2;
        const value = Y22[i2] - Y12[i2];
        const diff = prev.has(j2) ? value - prev.get(j2) : 0;
        prev.set(j2, value);
        return diff;
      });
      const Cf1 = [0, ...cumsum(Df)];
      for (const i2 of stack2) {
        Y12[i2] += y3;
        Y22[i2] += y3;
      }
      const s1 = sum(Fi);
      if (s1)
        y3 -= sum(Fi, (d2, i2) => (Df[i2] / 2 + Cf1[i2]) * d2) / s1;
    }
    offsetZero(stacks, Y12, Y22);
  }
  offsetCenterFacets(facetstacks, Y12, Y22);
}
function offsetZero(stacks, Y12, Y22) {
  const m = min(stacks, (stack2) => min(stack2, (i2) => Y12[i2]));
  for (const stack2 of stacks) {
    for (const i2 of stack2) {
      Y12[i2] -= m;
      Y22[i2] -= m;
    }
  }
}
function offsetCenterFacets(facetstacks, Y12, Y22) {
  const n2 = facetstacks.length;
  if (n2 === 1)
    return;
  const facets = facetstacks.map((stacks) => stacks.flat());
  const m = facets.map((I2) => (min(I2, (i2) => Y12[i2]) + max(I2, (i2) => Y22[i2])) / 2);
  const m0 = min(m);
  for (let j2 = 0; j2 < n2; j2++) {
    const p2 = m0 - m[j2];
    for (const i2 of facets[j2]) {
      Y12[i2] += p2;
      Y22[i2] += p2;
    }
  }
}
function maybeOrder2(order, offset2, ky2) {
  if (order === void 0 && offset2 === offsetWiggle)
    return orderInsideOut(ascendingDefined2);
  if (order == null)
    return;
  if (typeof order === "string") {
    const negate = order.startsWith("-");
    const compare = negate ? descendingDefined : ascendingDefined2;
    switch ((negate ? order.slice(1) : order).toLowerCase()) {
      case "value":
      case ky2:
        return orderY(compare);
      case "z":
        return orderZ(compare);
      case "sum":
        return orderSum(compare);
      case "appearance":
        return orderAppearance(compare);
      case "inside-out":
        return orderInsideOut(compare);
    }
    return orderAccessor(field(order));
  }
  if (typeof order === "function")
    return (order.length === 1 ? orderAccessor : orderComparator)(order);
  if (isArray(order))
    return orderGiven(order);
  throw new Error(`invalid order: ${order}`);
}
function orderY(compare) {
  return (data, X4, Y4) => (i2, j2) => compare(Y4[i2], Y4[j2]);
}
function orderZ(compare) {
  return (data, X4, Y4, Z3) => (i2, j2) => compare(Z3[i2], Z3[j2]);
}
function orderSum(compare) {
  return orderZDomain(
    compare,
    (data, X4, Y4, Z3) => groupSort(
      range2(data),
      (I2) => sum(I2, (i2) => Y4[i2]),
      (i2) => Z3[i2]
    )
  );
}
function orderAppearance(compare) {
  return orderZDomain(
    compare,
    (data, X4, Y4, Z3) => groupSort(
      range2(data),
      (I2) => X4[greatest(I2, (i2) => Y4[i2])],
      (i2) => Z3[i2]
    )
  );
}
function orderInsideOut(compare) {
  return orderZDomain(compare, (data, X4, Y4, Z3) => {
    const I2 = range2(data);
    const K2 = groupSort(
      I2,
      (I3) => X4[greatest(I3, (i2) => Y4[i2])],
      (i2) => Z3[i2]
    );
    const sums = rollup(
      I2,
      (I3) => sum(I3, (i2) => Y4[i2]),
      (i2) => Z3[i2]
    );
    const Kp = [], Kn = [];
    let s3 = 0;
    for (const k3 of K2) {
      if (s3 < 0) {
        s3 += sums.get(k3);
        Kp.push(k3);
      } else {
        s3 -= sums.get(k3);
        Kn.push(k3);
      }
    }
    return Kn.reverse().concat(Kp);
  });
}
function orderAccessor(f2) {
  return (data) => {
    const O2 = valueof(data, f2);
    return (i2, j2) => ascendingDefined2(O2[i2], O2[j2]);
  };
}
function orderComparator(f2) {
  return (data) => {
    return isArray(data) ? (i2, j2) => f2(data[i2], data[j2]) : (i2, j2) => f2(data.get(i2), data.get(j2));
  };
}
function orderGiven(domain) {
  return orderZDomain(ascendingDefined2, () => domain);
}
function orderZDomain(compare, domain) {
  return (data, X4, Y4, Z3) => {
    if (!Z3)
      throw new Error("missing channel: z");
    const map4 = new InternMap(domain(data, X4, Y4, Z3).map((d2, i2) => [d2, i2]));
    return (i2, j2) => compare(map4.get(Z3[i2]), map4.get(Z3[j2]));
  };
}

// ../../node_modules/@observablehq/plot/src/marks/rect.js
var defaults4 = {
  ariaLabel: "rect"
};
var Rect = class extends Mark {
  constructor(data, options = {}) {
    const { x1: x12, y1: y12, x2: x22, y2: y22 } = options;
    super(
      data,
      {
        x1: { value: x12, scale: "x", type: x12 != null && x22 == null ? "band" : void 0, optional: true },
        y1: { value: y12, scale: "y", type: y12 != null && y22 == null ? "band" : void 0, optional: true },
        x2: { value: x22, scale: "x", optional: true },
        y2: { value: y22, scale: "y", optional: true }
      },
      options,
      defaults4
    );
    rectInsets(this, options);
    rectRadii(this, options);
  }
  render(index2, scales, channels, dimensions, context) {
    const { x: x3, y: y3 } = scales;
    let { x1: X12, y1: Y12, x2: X22, y2: Y22 } = channels;
    const { marginTop, marginRight, marginBottom, marginLeft, width, height } = dimensions;
    const { projection: projection3 } = context;
    const { insetTop, insetRight, insetBottom, insetLeft } = this;
    const { rx, ry, rx1y1, rx1y2, rx2y1, rx2y2 } = this;
    if ((X12 || X22) && !projection3 && isCollapsed(x3))
      X12 = X22 = null;
    if ((Y12 || Y22) && !projection3 && isCollapsed(y3))
      Y12 = Y22 = null;
    const bx = x3?.bandwidth ? x3.bandwidth() : 0;
    const by = y3?.bandwidth ? y3.bandwidth() : 0;
    return create2("svg:g", context).call(applyIndirectStyles, this, dimensions, context).call(applyTransform, this, {}, 0, 0).call(
      (g2) => g2.selectAll().data(index2).enter().call(
        rx1y1 || rx1y2 || rx2y1 || rx2y2 ? (g3) => g3.append("path").call(applyDirectStyles, this).call(
          applyRoundedRect,
          X12 && X22 ? (i2) => X12[i2] + (X22[i2] < X12[i2] ? -insetRight : insetLeft) : X12 ? (i2) => X12[i2] + insetLeft : marginLeft + insetLeft,
          Y12 && Y22 ? (i2) => Y12[i2] + (Y22[i2] < Y12[i2] ? -insetBottom : insetTop) : Y12 ? (i2) => Y12[i2] + insetTop : marginTop + insetTop,
          X12 && X22 ? (i2) => X22[i2] - (X22[i2] < X12[i2] ? -insetLeft : insetRight) : X12 ? (i2) => X12[i2] + bx - insetRight : width - marginRight - insetRight,
          Y12 && Y22 ? (i2) => Y22[i2] - (Y22[i2] < Y12[i2] ? -insetTop : insetBottom) : Y12 ? (i2) => Y12[i2] + by - insetBottom : height - marginBottom - insetBottom,
          this
        ).call(applyChannelStyles, this, channels) : (g3) => g3.append("rect").call(applyDirectStyles, this).attr(
          "x",
          X12 ? X22 ? (i2) => Math.min(X12[i2], X22[i2]) + insetLeft : (i2) => X12[i2] + insetLeft : marginLeft + insetLeft
        ).attr(
          "y",
          Y12 ? Y22 ? (i2) => Math.min(Y12[i2], Y22[i2]) + insetTop : (i2) => Y12[i2] + insetTop : marginTop + insetTop
        ).attr(
          "width",
          X12 ? X22 ? (i2) => Math.max(0, Math.abs(X22[i2] - X12[i2]) + bx - insetLeft - insetRight) : bx - insetLeft - insetRight : width - marginRight - marginLeft - insetRight - insetLeft
        ).attr(
          "height",
          Y12 ? Y22 ? (i2) => Math.max(0, Math.abs(Y12[i2] - Y22[i2]) + by - insetTop - insetBottom) : by - insetTop - insetBottom : height - marginTop - marginBottom - insetTop - insetBottom
        ).call(applyAttr, "rx", rx).call(applyAttr, "ry", ry).call(applyChannelStyles, this, channels)
      )
    ).node();
  }
};
function rectInsets(mark, { inset = 0, insetTop = inset, insetRight = inset, insetBottom = inset, insetLeft = inset } = {}) {
  mark.insetTop = number5(insetTop);
  mark.insetRight = number5(insetRight);
  mark.insetBottom = number5(insetBottom);
  mark.insetLeft = number5(insetLeft);
}
function rectRadii(mark, {
  r: r2,
  rx,
  // for elliptic corners
  ry,
  // for elliptic corners
  rx1 = r2,
  ry1 = r2,
  rx2 = r2,
  ry2 = r2,
  rx1y1 = rx1 !== void 0 ? +rx1 : ry1 !== void 0 ? +ry1 : 0,
  rx1y2 = rx1 !== void 0 ? +rx1 : ry2 !== void 0 ? +ry2 : 0,
  rx2y1 = rx2 !== void 0 ? +rx2 : ry1 !== void 0 ? +ry1 : 0,
  rx2y2 = rx2 !== void 0 ? +rx2 : ry2 !== void 0 ? +ry2 : 0
} = {}) {
  if (rx1y1 || rx1y2 || rx2y1 || rx2y2) {
    mark.rx1y1 = rx1y1;
    mark.rx1y2 = rx1y2;
    mark.rx2y1 = rx2y1;
    mark.rx2y2 = rx2y2;
  } else {
    mark.rx = impliedString(rx, "auto");
    mark.ry = impliedString(ry, "auto");
  }
}
function applyRoundedRect(selection2, X12, Y12, X22, Y22, mark) {
  const { rx1y1: r11, rx1y2: r12, rx2y1: r21, rx2y2: r22 } = mark;
  if (typeof X12 !== "function")
    X12 = constant(X12);
  if (typeof Y12 !== "function")
    Y12 = constant(Y12);
  if (typeof X22 !== "function")
    X22 = constant(X22);
  if (typeof Y22 !== "function")
    Y22 = constant(Y22);
  const rx = Math.max(Math.abs(r11 + r21), Math.abs(r12 + r22));
  const ry = Math.max(Math.abs(r11 + r12), Math.abs(r21 + r22));
  selection2.attr("d", (i2) => {
    const x12 = X12(i2);
    const y12 = Y12(i2);
    const x22 = X22(i2);
    const y22 = Y22(i2);
    const ix = x12 > x22;
    const iy = y12 > y22;
    const l2 = ix ? x22 : x12;
    const r2 = ix ? x12 : x22;
    const t5 = iy ? y22 : y12;
    const b2 = iy ? y12 : y22;
    const k3 = Math.min(1, (r2 - l2) / rx, (b2 - t5) / ry);
    const tl = k3 * (ix ? iy ? r22 : r21 : iy ? r12 : r11);
    const tr = k3 * (ix ? iy ? r12 : r11 : iy ? r22 : r21);
    const br = k3 * (ix ? iy ? r11 : r12 : iy ? r21 : r22);
    const bl = k3 * (ix ? iy ? r21 : r22 : iy ? r11 : r12);
    return `M${l2},${t5 + biasY(tl, bl)}A${tl},${tl} 0 0 ${tl < 0 ? 0 : 1} ${l2 + biasX(tl, bl)},${t5}H${r2 - biasX(tr, br)}A${tr},${tr} 0 0 ${tr < 0 ? 0 : 1} ${r2},${t5 + biasY(tr, br)}V${b2 - biasY(br, tr)}A${br},${br} 0 0 ${br < 0 ? 0 : 1} ${r2 - biasX(br, tr)},${b2}H${l2 + biasX(bl, tl)}A${bl},${bl} 0 0 ${bl < 0 ? 0 : 1} ${l2},${b2 - biasY(bl, tl)}Z`;
  });
}
function biasX(r1, r2) {
  return r2 < 0 ? r1 : Math.abs(r1);
}
function biasY(r1, r2) {
  return r2 < 0 ? Math.abs(r1) : r1;
}
function rectX(data, options = {}) {
  if (!hasXY(options))
    options = { ...options, y: indexOf, x2: identity6, interval: 1 };
  return new Rect(data, maybeStackX(maybeTrivialIntervalY(maybeIdentityX(options))));
}
function rectY(data, options = {}) {
  if (!hasXY(options))
    options = { ...options, x: indexOf, y2: identity6, interval: 1 };
  return new Rect(data, maybeStackY(maybeTrivialIntervalX(maybeIdentityY(options))));
}

// ../../node_modules/@observablehq/plot/src/marks/frame.js
var defaults5 = {
  ariaLabel: "frame",
  fill: "none",
  stroke: "currentColor",
  clip: false
};
var lineDefaults = {
  ariaLabel: "frame",
  fill: null,
  stroke: "currentColor",
  strokeLinecap: "square",
  clip: false
};
var Frame = class extends Mark {
  constructor(options = {}) {
    const { anchor = null } = options;
    super(singleton, void 0, options, anchor == null ? defaults5 : lineDefaults);
    this.anchor = maybeKeyword(anchor, "anchor", ["top", "right", "bottom", "left"]);
    rectInsets(this, options);
    if (!anchor)
      rectRadii(this, options);
  }
  render(index2, scales, channels, dimensions, context) {
    const { marginTop, marginRight, marginBottom, marginLeft, width, height } = dimensions;
    const { anchor, insetTop, insetRight, insetBottom, insetLeft } = this;
    const { rx, ry, rx1y1, rx1y2, rx2y1, rx2y2 } = this;
    const x12 = marginLeft + insetLeft;
    const x22 = width - marginRight - insetRight;
    const y12 = marginTop + insetTop;
    const y22 = height - marginBottom - insetBottom;
    return create2(anchor ? "svg:line" : rx1y1 || rx1y2 || rx2y1 || rx2y2 ? "svg:path" : "svg:rect", context).datum(0).call(applyIndirectStyles, this, dimensions, context).call(applyDirectStyles, this).call(applyChannelStyles, this, channels).call(applyTransform, this, {}).call(
      anchor === "left" ? (line2) => line2.attr("x1", x12).attr("x2", x12).attr("y1", y12).attr("y2", y22) : anchor === "right" ? (line2) => line2.attr("x1", x22).attr("x2", x22).attr("y1", y12).attr("y2", y22) : anchor === "top" ? (line2) => line2.attr("x1", x12).attr("x2", x22).attr("y1", y12).attr("y2", y12) : anchor === "bottom" ? (line2) => line2.attr("x1", x12).attr("x2", x22).attr("y1", y22).attr("y2", y22) : rx1y1 || rx1y2 || rx2y1 || rx2y2 ? (path2) => path2.call(applyRoundedRect, x12, y12, x22, y22, this) : (rect2) => rect2.attr("x", x12).attr("y", y12).attr("width", x22 - x12).attr("height", y22 - y12).attr("rx", rx).attr("ry", ry)
    ).node();
  }
};
function frame2(options) {
  return new Frame(options);
}

// ../../node_modules/@observablehq/plot/src/marks/tip.js
var defaults6 = {
  ariaLabel: "tip",
  fill: "var(--plot-background)",
  stroke: "currentColor"
};
var ignoreChannels = /* @__PURE__ */ new Set(["geometry", "href", "src", "ariaLabel", "scales"]);
var Tip = class extends Mark {
  constructor(data, options = {}) {
    if (options.tip)
      options = { ...options, tip: false };
    if (options.title === void 0 && isIterable(data) && isTextual(data))
      options = { ...options, title: identity6 };
    const {
      x: x3,
      y: y3,
      x1: x12,
      x2: x22,
      y1: y12,
      y2: y22,
      anchor,
      preferredAnchor = "bottom",
      monospace,
      fontFamily = monospace ? "ui-monospace, monospace" : void 0,
      fontSize,
      fontStyle,
      fontVariant,
      fontWeight,
      lineHeight = 1,
      lineWidth = 20,
      frameAnchor,
      format: format3,
      textAnchor = "start",
      textOverflow,
      textPadding = 8,
      title,
      pointerSize = 12,
      pathFilter = "drop-shadow(0 3px 4px rgba(0,0,0,0.2))"
    } = options;
    super(
      data,
      {
        x: { value: x12 != null && x22 != null ? null : x3, scale: "x", optional: true },
        // ignore midpoint
        y: { value: y12 != null && y22 != null ? null : y3, scale: "y", optional: true },
        // ignore midpoint
        x1: { value: x12, scale: "x", optional: x22 == null },
        y1: { value: y12, scale: "y", optional: y22 == null },
        x2: { value: x22, scale: "x", optional: x12 == null },
        y2: { value: y22, scale: "y", optional: y12 == null },
        title: { value: title, optional: true }
        // filter: defined
      },
      options,
      defaults6
    );
    this.anchor = maybeAnchor(anchor, "anchor");
    this.preferredAnchor = maybeAnchor(preferredAnchor, "preferredAnchor");
    this.frameAnchor = maybeFrameAnchor(frameAnchor);
    this.textAnchor = impliedString(textAnchor, "middle");
    this.textPadding = +textPadding;
    this.pointerSize = +pointerSize;
    this.pathFilter = string(pathFilter);
    this.lineHeight = +lineHeight;
    this.lineWidth = +lineWidth;
    this.textOverflow = maybeTextOverflow(textOverflow);
    this.monospace = !!monospace;
    this.fontFamily = string(fontFamily);
    this.fontSize = number5(fontSize);
    this.fontStyle = string(fontStyle);
    this.fontVariant = string(fontVariant);
    this.fontWeight = string(fontWeight);
    for (const key in defaults6)
      if (key in this.channels)
        this[key] = defaults6[key];
    this.splitLines = splitter(this);
    this.clipLine = clipper(this);
    this.format = typeof format3 === "string" || typeof format3 === "function" ? { title: format3 } : { ...format3 };
  }
  render(index2, scales, values2, dimensions, context) {
    const mark = this;
    const { x: x3, y: y3, fx, fy } = scales;
    const { ownerSVGElement: svg, document: document2 } = context;
    const { anchor, monospace, lineHeight, lineWidth } = this;
    const { textPadding: r2, pointerSize: m, pathFilter } = this;
    const { marginTop, marginLeft } = dimensions;
    const { x1: X12, y1: Y12, x2: X22, y2: Y22, x: X4 = X12 ?? X22, y: Y4 = Y12 ?? Y22 } = values2;
    const ox = fx ? fx(index2.fx) - marginLeft : 0;
    const oy = fy ? fy(index2.fy) - marginTop : 0;
    const [cx, cy] = applyFrameAnchor(this, dimensions);
    const px = anchorX(values2, cx);
    const py = anchorY(values2, cy);
    const widthof = monospace ? monospaceWidth : defaultWidth;
    const ee = widthof(ellipsis);
    let sources, format3;
    if ("title" in values2) {
      sources = getSourceChannels.call(this, { title: values2.channels.title }, scales);
      format3 = formatTitle;
    } else {
      sources = getSourceChannels.call(this, values2.channels, scales);
      format3 = formatChannels;
    }
    const g2 = create2("svg:g", context).call(applyIndirectStyles, this, dimensions, context).call(applyIndirectTextStyles, this).call(applyTransform, this, { x: X4 && x3, y: Y4 && y3 }).call(
      (g3) => g3.selectAll().data(index2).enter().append("g").attr("transform", (i2) => `translate(${Math.round(px(i2))},${Math.round(py(i2))})`).call(applyDirectStyles, this).call((g4) => g4.append("path").attr("filter", pathFilter)).call(
        (g4) => g4.append("text").each(function(i2) {
          const that = select_default2(this);
          this.setAttribute("fill", "currentColor");
          this.setAttribute("fill-opacity", 1);
          this.setAttribute("stroke", "none");
          const lines = format3.call(mark, i2, index2, sources, scales, values2);
          if (typeof lines === "string") {
            for (const line2 of mark.splitLines(lines)) {
              renderLine(that, { value: mark.clipLine(line2) });
            }
          } else {
            const labels = /* @__PURE__ */ new Set();
            for (const line2 of lines) {
              const { label = "" } = line2;
              if (label && labels.has(label))
                continue;
              else
                labels.add(label);
              renderLine(that, line2);
            }
          }
        })
      )
    );
    function renderLine(selection2, { label, value, color: color3, opacity: opacity2 }) {
      label ??= "", value ??= "";
      const swatch = color3 != null || opacity2 != null;
      let title;
      let w2 = lineWidth * 100;
      const [j2] = cut(label, w2, widthof, ee);
      if (j2 >= 0) {
        label = label.slice(0, j2).trimEnd() + ellipsis;
        title = value.trim();
        value = "";
      } else {
        if (label || !value && !swatch)
          value = " " + value;
        const [k3] = cut(value, w2 - widthof(label), widthof, ee);
        if (k3 >= 0) {
          title = value.trim();
          value = value.slice(0, k3).trimEnd() + ellipsis;
        }
      }
      const line2 = selection2.append("tspan").attr("x", 0).attr("dy", `${lineHeight}em`).text("\u200B");
      if (label)
        line2.append("tspan").attr("font-weight", "bold").text(label);
      if (value)
        line2.append(() => document2.createTextNode(value));
      if (swatch)
        line2.append("tspan").text(" \u25A0").attr("fill", color3).attr("fill-opacity", opacity2).style("user-select", "none");
      if (title)
        line2.append("title").text(title);
    }
    function postrender() {
      const { width, height } = dimensions.facet ?? dimensions;
      g2.selectChildren().each(function(i2) {
        let { x: tx, width: w2, height: h2 } = this.getBBox();
        w2 = Math.round(w2), h2 = Math.round(h2);
        let a3 = anchor;
        if (a3 === void 0) {
          const x4 = px(i2) + ox;
          const y4 = py(i2) + oy;
          const fitLeft = x4 + w2 + m + r2 * 2 < width;
          const fitRight = x4 - w2 - m - r2 * 2 > 0;
          const fitTop = y4 + h2 + m + r2 * 2 < height;
          const fitBottom = y4 - h2 - m - r2 * 2 > 0;
          a3 = fitLeft && fitRight ? fitTop && fitBottom ? mark.preferredAnchor : fitBottom ? "bottom" : "top" : fitTop && fitBottom ? fitLeft ? "left" : "right" : (fitLeft || fitRight) && (fitTop || fitBottom) ? `${fitBottom ? "bottom" : "top"}-${fitLeft ? "left" : "right"}` : mark.preferredAnchor;
        }
        const path2 = this.firstChild;
        const text2 = this.lastChild;
        path2.setAttribute("d", getPath(a3, m, r2, w2, h2));
        if (tx)
          for (const t5 of text2.childNodes)
            t5.setAttribute("x", -tx);
        text2.setAttribute("y", `${+getLineOffset(a3, text2.childNodes.length, lineHeight).toFixed(6)}em`);
        text2.setAttribute("transform", `translate(${getTextTranslate(a3, m, r2, w2, h2)})`);
      });
      g2.attr("visibility", null);
    }
    if (index2.length) {
      g2.attr("visibility", "hidden");
      if (svg.isConnected)
        Promise.resolve().then(postrender);
      else if (typeof requestAnimationFrame !== "undefined")
        requestAnimationFrame(postrender);
    }
    return g2.node();
  }
};
function tip(data, { x: x3, y: y3, ...options } = {}) {
  if (options.frameAnchor === void 0)
    [x3, y3] = maybeTuple(x3, y3);
  return new Tip(data, { ...options, x: x3, y: y3 });
}
function getLineOffset(anchor, length3, lineHeight) {
  return /^top(?:-|$)/.test(anchor) ? 0.94 - lineHeight : /^bottom(?:-|$)/ ? -0.29 - length3 * lineHeight : length3 / 2 * lineHeight;
}
function getTextTranslate(anchor, m, r2, width, height) {
  switch (anchor) {
    case "middle":
      return [-width / 2, height / 2];
    case "top-left":
      return [r2, m + r2];
    case "top":
      return [-width / 2, m / 2 + r2];
    case "top-right":
      return [-width - r2, m + r2];
    case "right":
      return [-m / 2 - width - r2, height / 2];
    case "bottom-left":
      return [r2, -m - r2];
    case "bottom":
      return [-width / 2, -m / 2 - r2];
    case "bottom-right":
      return [-width - r2, -m - r2];
    case "left":
      return [r2 + m / 2, height / 2];
  }
}
function getPath(anchor, m, r2, width, height) {
  const w2 = width + r2 * 2;
  const h2 = height + r2 * 2;
  switch (anchor) {
    case "middle":
      return `M${-w2 / 2},${-h2 / 2}h${w2}v${h2}h${-w2}z`;
    case "top-left":
      return `M0,0l${m},${m}h${w2 - m}v${h2}h${-w2}z`;
    case "top":
      return `M0,0l${m / 2},${m / 2}h${(w2 - m) / 2}v${h2}h${-w2}v${-h2}h${(w2 - m) / 2}z`;
    case "top-right":
      return `M0,0l${-m},${m}h${m - w2}v${h2}h${w2}z`;
    case "right":
      return `M0,0l${-m / 2},${-m / 2}v${m / 2 - h2 / 2}h${-w2}v${h2}h${w2}v${m / 2 - h2 / 2}z`;
    case "bottom-left":
      return `M0,0l${m},${-m}h${w2 - m}v${-h2}h${-w2}z`;
    case "bottom":
      return `M0,0l${m / 2},${-m / 2}h${(w2 - m) / 2}v${-h2}h${-w2}v${h2}h${(w2 - m) / 2}z`;
    case "bottom-right":
      return `M0,0l${-m},${-m}h${m - w2}v${-h2}h${w2}z`;
    case "left":
      return `M0,0l${m / 2},${-m / 2}v${m / 2 - h2 / 2}h${w2}v${h2}h${-w2}v${m / 2 - h2 / 2}z`;
  }
}
function getSourceChannels(channels, scales) {
  const sources = {};
  let format3 = this.format;
  format3 = maybeExpandPairedFormat(format3, channels, "x");
  format3 = maybeExpandPairedFormat(format3, channels, "y");
  this.format = format3;
  for (const key in format3) {
    const value = format3[key];
    if (value === null || value === false) {
      continue;
    } else if (key === "fx" || key === "fy") {
      sources[key] = true;
    } else {
      const source = getSource(channels, key);
      if (source)
        sources[key] = source;
    }
  }
  for (const key in channels) {
    if (key in sources || key in format3 || ignoreChannels.has(key))
      continue;
    if ((key === "x" || key === "y") && channels.geometry)
      continue;
    const source = getSource(channels, key);
    if (source) {
      if (source.scale == null && source.defaultScale === "color")
        continue;
      sources[key] = source;
    }
  }
  if (this.facet) {
    if (scales.fx && !("fx" in format3))
      sources.fx = true;
    if (scales.fy && !("fy" in format3))
      sources.fy = true;
  }
  for (const key in sources) {
    const format4 = this.format[key];
    if (typeof format4 === "string") {
      const value = sources[key]?.value ?? scales[key]?.domain() ?? [];
      this.format[key] = (isTemporal(value) ? utcFormat : format)(format4);
    } else if (format4 === void 0 || format4 === true) {
      const scale = scales[key];
      this.format[key] = scale?.bandwidth ? inferTickFormat(scale, scale.domain()) : formatDefault;
    }
  }
  return sources;
}
function maybeExpandPairedFormat(format3, channels, key) {
  if (!(key in format3))
    return format3;
  const key1 = `${key}1`;
  const key2 = `${key}2`;
  if ((key1 in format3 || !(key1 in channels)) && (key2 in format3 || !(key2 in channels)))
    return format3;
  const entries = Object.entries(format3);
  const value = format3[key];
  entries.splice(entries.findIndex(([name]) => name === key) + 1, 0, [key1, value], [key2, value]);
  return Object.fromEntries(entries);
}
function formatTitle(i2, index2, { title }) {
  return this.format.title(title.value[i2], i2);
}
function* formatChannels(i2, index2, channels, scales, values2) {
  for (const key in channels) {
    if (key === "fx" || key === "fy") {
      yield {
        label: formatLabel(scales, channels, key),
        value: this.format[key](index2[key], i2)
      };
      continue;
    }
    if (key === "x1" && "x2" in channels)
      continue;
    if (key === "y1" && "y2" in channels)
      continue;
    const channel = channels[key];
    if (key === "x2" && "x1" in channels) {
      yield {
        label: formatPairLabel(scales, channels, "x"),
        value: formatPair(this.format.x2, channels.x1, channel, i2)
      };
    } else if (key === "y2" && "y1" in channels) {
      yield {
        label: formatPairLabel(scales, channels, "y"),
        value: formatPair(this.format.y2, channels.y1, channel, i2)
      };
    } else {
      const value = channel.value[i2];
      const scale = channel.scale;
      if (!defined(value) && scale == null)
        continue;
      yield {
        label: formatLabel(scales, channels, key),
        value: this.format[key](value, i2),
        color: scale === "color" ? values2[key][i2] : null,
        opacity: scale === "opacity" ? values2[key][i2] : null
      };
    }
  }
}
function formatPair(formatValue, c1, c22, i2) {
  return c22.hint?.length ? `${formatValue(c22.value[i2] - c1.value[i2], i2)}` : `${formatValue(c1.value[i2], i2)}\u2013${formatValue(c22.value[i2], i2)}`;
}
function formatPairLabel(scales, channels, key) {
  const l1 = formatLabel(scales, channels, `${key}1`, key);
  const l2 = formatLabel(scales, channels, `${key}2`, key);
  return l1 === l2 ? l1 : `${l1}\u2013${l2}`;
}
function formatLabel(scales, channels, key, defaultLabel = key) {
  const channel = channels[key];
  const scale = scales[channel?.scale ?? key];
  return String(scale?.label ?? channel?.label ?? defaultLabel);
}

// ../../node_modules/@observablehq/plot/src/plot.js
function plot(options = {}) {
  const { facet, style, title, subtitle, caption, ariaLabel, ariaDescription } = options;
  const className = maybeClassName(options.className);
  const marks2 = options.marks === void 0 ? [] : flatMarks(options.marks);
  marks2.push(...inferTips(marks2));
  const topFacetState = maybeTopFacet(facet, options);
  const facetStateByMark = /* @__PURE__ */ new Map();
  for (const mark of marks2) {
    const facetState = maybeMarkFacet(mark, topFacetState, options);
    if (facetState)
      facetStateByMark.set(mark, facetState);
  }
  const channelsByScale = /* @__PURE__ */ new Map();
  if (topFacetState)
    addScaleChannels(channelsByScale, [topFacetState], options);
  addScaleChannels(channelsByScale, facetStateByMark, options);
  const axes = flatMarks(inferAxes(marks2, channelsByScale, options));
  for (const mark of axes) {
    const facetState = maybeMarkFacet(mark, topFacetState, options);
    if (facetState)
      facetStateByMark.set(mark, facetState);
  }
  marks2.unshift(...axes);
  let facets = createFacets(channelsByScale, options);
  if (facets !== void 0) {
    const topFacetsIndex = topFacetState ? facetFilter(facets, topFacetState) : void 0;
    for (const mark of marks2) {
      if (mark.facet === null || mark.facet === "super")
        continue;
      const facetState = facetStateByMark.get(mark);
      if (facetState === void 0)
        continue;
      facetState.facetsIndex = mark.fx != null || mark.fy != null ? facetFilter(facets, facetState) : topFacetsIndex;
    }
    const nonEmpty = /* @__PURE__ */ new Set();
    for (const { facetsIndex } of facetStateByMark.values()) {
      facetsIndex?.forEach((index2, i2) => {
        if (index2?.length > 0) {
          nonEmpty.add(i2);
        }
      });
    }
    facets.forEach(
      0 < nonEmpty.size && nonEmpty.size < facets.length ? (f2, i2) => f2.empty = !nonEmpty.has(i2) : (f2) => f2.empty = false
    );
    for (const mark of marks2) {
      if (mark.facet === "exclude") {
        const facetState = facetStateByMark.get(mark);
        if (facetState !== void 0)
          facetState.facetsIndex = facetExclude(facetState.facetsIndex);
      }
    }
  }
  for (const key of registry.keys()) {
    if (isScaleOptions(options[key]) && key !== "fx" && key !== "fy") {
      channelsByScale.set(key, []);
    }
  }
  const stateByMark = /* @__PURE__ */ new Map();
  for (const mark of marks2) {
    if (stateByMark.has(mark))
      throw new Error("duplicate mark; each mark must be unique");
    const { facetsIndex, channels: facetChannels } = facetStateByMark.get(mark) ?? {};
    const { data, facets: facets2, channels } = mark.initialize(facetsIndex, facetChannels, options);
    applyScaleTransforms(channels, options);
    stateByMark.set(mark, { data, facets: facets2, channels });
  }
  const scaleDescriptors = createScales(addScaleChannels(channelsByScale, stateByMark, options), options);
  const dimensions = createDimensions(scaleDescriptors, marks2, options);
  autoScaleRange(scaleDescriptors, dimensions);
  const scales = createScaleFunctions(scaleDescriptors);
  const { fx, fy } = scales;
  const subdimensions = fx || fy ? innerDimensions(scaleDescriptors, dimensions) : dimensions;
  const superdimensions = fx || fy ? actualDimensions(scales, dimensions) : dimensions;
  const context = createContext(options);
  const document2 = context.document;
  const svg = creator_default("svg").call(document2.documentElement);
  let figure = svg;
  context.ownerSVGElement = svg;
  context.className = className;
  context.projection = createProjection(options, subdimensions);
  context.filterFacets = (data, channels) => {
    return facetFilter(facets, { channels, groups: facetGroups(data, channels) });
  };
  context.getMarkState = (mark) => {
    const state = stateByMark.get(mark);
    const facetState = facetStateByMark.get(mark);
    return { ...state, channels: { ...state.channels, ...facetState?.channels } };
  };
  context.dispatchValue = (value) => {
    if (figure.value === value)
      return;
    figure.value = value;
    figure.dispatchEvent(new Event("input", { bubbles: true }));
  };
  const newByScale = /* @__PURE__ */ new Set();
  for (const [mark, state] of stateByMark) {
    if (mark.initializer != null) {
      const dimensions2 = mark.facet === "super" ? superdimensions : subdimensions;
      const update = mark.initializer(state.data, state.facets, state.channels, scales, dimensions2, context);
      if (update.data !== void 0) {
        state.data = update.data;
      }
      if (update.facets !== void 0) {
        state.facets = update.facets;
      }
      if (update.channels !== void 0) {
        const { fx: fx2, fy: fy2, ...channels } = update.channels;
        inferChannelScales(channels);
        Object.assign(state.channels, channels);
        for (const channel of Object.values(channels)) {
          const { scale } = channel;
          if (scale != null && !isPosition(registry.get(scale))) {
            applyScaleTransform(channel, options);
            newByScale.add(scale);
          }
        }
        if (fx2 != null || fy2 != null)
          facetStateByMark.set(mark, true);
      }
    }
  }
  if (newByScale.size) {
    const newChannelsByScale = /* @__PURE__ */ new Map();
    addScaleChannels(newChannelsByScale, stateByMark, options, (key) => newByScale.has(key));
    addScaleChannels(channelsByScale, stateByMark, options, (key) => newByScale.has(key));
    const newScaleDescriptors = inheritScaleLabels(createScales(newChannelsByScale, options), scaleDescriptors);
    const { scales: newExposedScales, ...newScales } = createScaleFunctions(newScaleDescriptors);
    Object.assign(scaleDescriptors, newScaleDescriptors);
    Object.assign(scales, newScales);
    Object.assign(scales.scales, newExposedScales);
  }
  let facetDomains, facetTranslate;
  if (facets !== void 0) {
    facetDomains = { x: fx?.domain(), y: fy?.domain() };
    facets = recreateFacets(facets, facetDomains);
    facetTranslate = facetTranslator(fx, fy, dimensions);
  }
  for (const [mark, state] of stateByMark) {
    state.values = mark.scale(state.channels, scales, context);
  }
  const { width, height } = dimensions;
  select_default2(svg).attr("class", className).attr("fill", "currentColor").attr("font-family", "system-ui, sans-serif").attr("font-size", 10).attr("text-anchor", "middle").attr("width", width).attr("height", height).attr("viewBox", `0 0 ${width} ${height}`).attr("aria-label", ariaLabel).attr("aria-description", ariaDescription).call(
    (svg2) => (
      // Warning: if you edit this, change defaultClassName.
      svg2.append("style").text(
        `:where(.${className}) {
  --plot-background: white;
  display: block;
  height: auto;
  height: intrinsic;
  max-width: 100%;
}
:where(.${className} text),
:where(.${className} tspan) {
  white-space: pre;
}`
      )
    )
  ).call(applyInlineStyles, style);
  for (const mark of marks2) {
    const { channels, values: values2, facets: indexes2 } = stateByMark.get(mark);
    if (facets === void 0 || mark.facet === "super") {
      let index2 = null;
      if (indexes2) {
        index2 = indexes2[0];
        index2 = mark.filter(index2, channels, values2);
        if (index2.length === 0)
          continue;
      }
      const node = mark.render(index2, scales, values2, superdimensions, context);
      if (node == null)
        continue;
      svg.appendChild(node);
    } else {
      let g2;
      for (const f2 of facets) {
        if (!(mark.facetAnchor?.(facets, facetDomains, f2) ?? !f2.empty))
          continue;
        let index2 = null;
        if (indexes2) {
          const faceted = facetStateByMark.has(mark);
          index2 = indexes2[faceted ? f2.i : 0];
          index2 = mark.filter(index2, channels, values2);
          if (index2.length === 0)
            continue;
          if (!faceted && index2 === indexes2[0])
            index2 = subarray(index2);
          index2.fx = f2.x, index2.fy = f2.y, index2.fi = f2.i;
        }
        const node = mark.render(index2, scales, values2, subdimensions, context);
        if (node == null)
          continue;
        (g2 ??= select_default2(svg).append("g")).append(() => node).datum(f2);
        for (const name of ["aria-label", "aria-description", "aria-hidden", "transform"]) {
          if (node.hasAttribute(name)) {
            g2.attr(name, node.getAttribute(name));
            node.removeAttribute(name);
          }
        }
      }
      g2?.selectChildren().attr("transform", facetTranslate);
    }
  }
  const legends = createLegends(scaleDescriptors, context, options);
  const { figure: figured = title != null || subtitle != null || caption != null || legends.length > 0 } = options;
  if (figured) {
    figure = document2.createElement("figure");
    figure.className = `${className}-figure`;
    figure.style.maxWidth = "initial";
    if (title != null)
      figure.append(createTitleElement(document2, title, "h2"));
    if (subtitle != null)
      figure.append(createTitleElement(document2, subtitle, "h3"));
    figure.append(...legends, svg);
    if (caption != null)
      figure.append(createFigcaption(document2, caption));
    if ("value" in svg)
      figure.value = svg.value, delete svg.value;
  }
  figure.scale = exposeScales(scales.scales);
  figure.legend = exposeLegends(scaleDescriptors, context, options);
  const w2 = consumeWarnings();
  if (w2 > 0) {
    select_default2(svg).append("text").attr("x", width).attr("y", 20).attr("dy", "-1em").attr("text-anchor", "end").attr("font-family", "initial").text("\u26A0\uFE0F").append("title").text(`${w2.toLocaleString("en-US")} warning${w2 === 1 ? "" : "s"}. Please check the console.`);
  }
  return figure;
}
function createTitleElement(document2, contents, tag) {
  if (contents.ownerDocument)
    return contents;
  const e = document2.createElement(tag);
  e.append(contents);
  return e;
}
function createFigcaption(document2, caption) {
  const e = document2.createElement("figcaption");
  e.append(caption);
  return e;
}
function flatMarks(marks2) {
  return marks2.flat(Infinity).filter((mark) => mark != null).map(markify);
}
function markify(mark) {
  return typeof mark.render === "function" ? mark : new Render(mark);
}
var Render = class extends Mark {
  constructor(render) {
    if (typeof render !== "function")
      throw new TypeError("invalid mark; missing render function");
    super();
    this.render = render;
  }
  render() {
  }
};
function applyScaleTransforms(channels, options) {
  for (const name in channels)
    applyScaleTransform(channels[name], options);
  return channels;
}
function applyScaleTransform(channel, options) {
  const { scale, transform: t5 = true } = channel;
  if (scale == null || !t5)
    return;
  const {
    type: type2,
    percent,
    interval: interval2,
    transform: transform2 = percent ? (x3) => x3 == null ? NaN : x3 * 100 : maybeIntervalTransform(interval2, type2)
  } = options[scale] ?? {};
  if (transform2 == null)
    return;
  channel.value = map2(channel.value, transform2);
  channel.transform = false;
}
function inferChannelScales(channels) {
  for (const name in channels) {
    inferChannelScale(name, channels[name]);
  }
}
function addScaleChannels(channelsByScale, stateByMark, options, filter2 = yes) {
  for (const { channels } of stateByMark.values()) {
    for (const name in channels) {
      const channel = channels[name];
      const { scale } = channel;
      if (scale != null && filter2(scale)) {
        if (scale === "projection") {
          if (!hasProjection(options)) {
            const gx = options.x?.domain === void 0;
            const gy = options.y?.domain === void 0;
            if (gx || gy) {
              const [x3, y3] = getGeometryChannels(channel);
              if (gx)
                addScaleChannel(channelsByScale, "x", x3);
              if (gy)
                addScaleChannel(channelsByScale, "y", y3);
            }
          }
        } else {
          addScaleChannel(channelsByScale, scale, channel);
        }
      }
    }
  }
  return channelsByScale;
}
function addScaleChannel(channelsByScale, scale, channel) {
  const scaleChannels = channelsByScale.get(scale);
  if (scaleChannels !== void 0)
    scaleChannels.push(channel);
  else
    channelsByScale.set(scale, [channel]);
}
function maybeTopFacet(facet, options) {
  if (facet == null)
    return;
  const { x: x3, y: y3 } = facet;
  if (x3 == null && y3 == null)
    return;
  const data = dataify(facet.data);
  if (data == null)
    throw new Error("missing facet data");
  const channels = {};
  if (x3 != null)
    channels.fx = createChannel(data, { value: x3, scale: "fx" });
  if (y3 != null)
    channels.fy = createChannel(data, { value: y3, scale: "fy" });
  applyScaleTransforms(channels, options);
  const groups2 = facetGroups(data, channels);
  return { channels, groups: groups2, data: facet.data };
}
function maybeMarkFacet(mark, topFacetState, options) {
  if (mark.facet === null || mark.facet === "super")
    return;
  const { fx, fy } = mark;
  if (fx != null || fy != null) {
    const data2 = dataify(mark.data ?? fx ?? fy);
    if (data2 === void 0)
      throw new Error(`missing facet data in ${mark.ariaLabel}`);
    if (data2 === null)
      return;
    const channels2 = {};
    if (fx != null)
      channels2.fx = createChannel(data2, { value: fx, scale: "fx" });
    if (fy != null)
      channels2.fy = createChannel(data2, { value: fy, scale: "fy" });
    applyScaleTransforms(channels2, options);
    return { channels: channels2, groups: facetGroups(data2, channels2) };
  }
  if (topFacetState === void 0)
    return;
  const { channels, groups: groups2, data } = topFacetState;
  if (mark.facet !== "auto" || mark.data === data)
    return { channels, groups: groups2 };
  if (data.length > 0 && (groups2.size > 1 || groups2.size === 1 && channels.fx && channels.fy && [...groups2][0][1].size > 1) && lengthof(dataify(mark.data)) === lengthof(data)) {
    warn(
      `Warning: the ${mark.ariaLabel} mark appears to use faceted data, but isn\u2019t faceted. The mark data has the same length as the facet data and the mark facet option is "auto", but the mark data and facet data are distinct. If this mark should be faceted, set the mark facet option to true; otherwise, suppress this warning by setting the mark facet option to false.`
    );
  }
}
function derive(mark, options = {}) {
  return initializer({ ...options, x: null, y: null }, (data, facets, channels, scales, dimensions, context) => {
    return context.getMarkState(mark);
  });
}
function inferTips(marks2) {
  const tips = [];
  for (const mark of marks2) {
    let tipOptions = mark.tip;
    if (tipOptions) {
      if (tipOptions === true)
        tipOptions = {};
      else if (typeof tipOptions === "string")
        tipOptions = { pointer: tipOptions };
      let { pointer: p2, preferredAnchor: a3 } = tipOptions;
      p2 = /^x$/i.test(p2) ? pointerX : /^y$/i.test(p2) ? pointerY : pointer;
      tipOptions = p2(derive(mark, tipOptions));
      tipOptions.title = null;
      if (a3 === void 0)
        tipOptions.preferredAnchor = p2 === pointerY ? "left" : "bottom";
      const t5 = tip(mark.data, tipOptions);
      t5.facet = mark.facet;
      t5.facetAnchor = mark.facetAnchor;
      tips.push(t5);
    }
  }
  return tips;
}
function inferAxes(marks2, channelsByScale, options) {
  let {
    projection: projection3,
    x: x3 = {},
    y: y3 = {},
    fx = {},
    fy = {},
    axis: axis2,
    grid,
    facet = {},
    facet: { axis: facetAxis = axis2, grid: facetGrid } = facet,
    x: { axis: xAxis = axis2, grid: xGrid = xAxis === null ? null : grid } = x3,
    y: { axis: yAxis = axis2, grid: yGrid = yAxis === null ? null : grid } = y3,
    fx: { axis: fxAxis = facetAxis, grid: fxGrid = fxAxis === null ? null : facetGrid } = fx,
    fy: { axis: fyAxis = facetAxis, grid: fyGrid = fyAxis === null ? null : facetGrid } = fy
  } = options;
  if (projection3 || !isScaleOptions(x3) && !hasPositionChannel("x", marks2))
    xAxis = xGrid = null;
  if (projection3 || !isScaleOptions(y3) && !hasPositionChannel("y", marks2))
    yAxis = yGrid = null;
  if (!channelsByScale.has("fx"))
    fxAxis = fxGrid = null;
  if (!channelsByScale.has("fy"))
    fyAxis = fyGrid = null;
  if (xAxis === void 0)
    xAxis = !hasAxis(marks2, "x");
  if (yAxis === void 0)
    yAxis = !hasAxis(marks2, "y");
  if (fxAxis === void 0)
    fxAxis = !hasAxis(marks2, "fx");
  if (fyAxis === void 0)
    fyAxis = !hasAxis(marks2, "fy");
  if (xAxis === true)
    xAxis = "bottom";
  if (yAxis === true)
    yAxis = "left";
  if (fxAxis === true)
    fxAxis = xAxis === "top" || xAxis === null ? "bottom" : "top";
  if (fyAxis === true)
    fyAxis = yAxis === "right" || yAxis === null ? "left" : "right";
  const axes = [];
  maybeGrid(axes, fyGrid, gridFy, fy);
  maybeAxis(axes, fyAxis, axisFy, "right", "left", facet, fy);
  maybeGrid(axes, fxGrid, gridFx, fx);
  maybeAxis(axes, fxAxis, axisFx, "top", "bottom", facet, fx);
  maybeGrid(axes, yGrid, gridY, y3);
  maybeAxis(axes, yAxis, axisY, "left", "right", options, y3);
  maybeGrid(axes, xGrid, gridX, x3);
  maybeAxis(axes, xAxis, axisX, "bottom", "top", options, x3);
  return axes;
}
function maybeAxis(axes, axis2, axisType, primary, secondary, defaults12, options) {
  if (!axis2)
    return;
  const both = isBoth(axis2);
  options = axisOptions(both ? primary : axis2, defaults12, options);
  const { line: line2 } = options;
  if ((axisType === axisY || axisType === axisX) && line2 && !isNone(line2))
    axes.push(frame2(lineOptions(options)));
  axes.push(axisType(options));
  if (both)
    axes.push(axisType({ ...options, anchor: secondary, label: null }));
}
function maybeGrid(axes, grid, gridType, options) {
  if (!grid || isNone(grid))
    return;
  axes.push(gridType(gridOptions(grid, options)));
}
function isBoth(value) {
  return /^\s*both\s*$/i.test(value);
}
function axisOptions(anchor, defaults12, {
  line: line2 = defaults12.line,
  ticks: ticks2,
  tickSize,
  tickSpacing,
  tickPadding,
  tickFormat: tickFormat2,
  tickRotate,
  fontVariant,
  ariaLabel,
  ariaDescription,
  label = defaults12.label,
  labelAnchor,
  labelArrow = defaults12.labelArrow,
  labelOffset
}) {
  return {
    anchor,
    line: line2,
    ticks: ticks2,
    tickSize,
    tickSpacing,
    tickPadding,
    tickFormat: tickFormat2,
    tickRotate,
    fontVariant,
    ariaLabel,
    ariaDescription,
    label,
    labelAnchor,
    labelArrow,
    labelOffset
  };
}
function lineOptions(options) {
  const { anchor, line: line2 } = options;
  return { anchor, facetAnchor: anchor + "-empty", stroke: line2 === true ? void 0 : line2 };
}
function gridOptions(grid, {
  stroke = isColor(grid) ? grid : void 0,
  ticks: ticks2 = isGridTicks(grid) ? grid : void 0,
  tickSpacing,
  ariaLabel,
  ariaDescription
}) {
  return {
    stroke,
    ticks: ticks2,
    tickSpacing,
    ariaLabel,
    ariaDescription
  };
}
function isGridTicks(grid) {
  switch (typeof grid) {
    case "number":
      return true;
    case "string":
      return !isColor(grid);
  }
  return isIterable(grid) || typeof grid?.range === "function";
}
function hasAxis(marks2, k3) {
  const prefix = `${k3}-axis `;
  return marks2.some((m) => m.ariaLabel?.startsWith(prefix));
}
function hasPositionChannel(k3, marks2) {
  for (const mark of marks2) {
    for (const key in mark.channels) {
      const { scale } = mark.channels[key];
      if (scale === k3 || scale === "projection") {
        return true;
      }
    }
  }
  return false;
}
function inheritScaleLabels(newScales, scales) {
  for (const key in newScales) {
    const newScale = newScales[key];
    const scale = scales[key];
    if (newScale.label === void 0 && scale) {
      newScale.label = scale.label;
    }
  }
  return newScales;
}
function actualDimensions({ fx, fy }, dimensions) {
  const { marginTop, marginRight, marginBottom, marginLeft, width, height } = outerDimensions(dimensions);
  const fxr = fx && outerRange(fx);
  const fyr = fy && outerRange(fy);
  return {
    marginTop: fy ? fyr[0] : marginTop,
    marginRight: fx ? width - fxr[1] : marginRight,
    marginBottom: fy ? height - fyr[1] : marginBottom,
    marginLeft: fx ? fxr[0] : marginLeft,
    // Some marks, namely the x- and y-axis labels, want to know what the
    // desired (rather than actual) margins are for positioning.
    inset: {
      marginTop: dimensions.marginTop,
      marginRight: dimensions.marginRight,
      marginBottom: dimensions.marginBottom,
      marginLeft: dimensions.marginLeft
    },
    width,
    height
  };
}
function outerRange(scale) {
  const domain = scale.domain();
  if (domain.length === 0)
    return [0, scale.bandwidth()];
  let x12 = scale(domain[0]);
  let x22 = scale(domain[domain.length - 1]);
  if (x22 < x12)
    [x12, x22] = [x22, x12];
  return [x12, x22 + scale.bandwidth()];
}

// ../../node_modules/@observablehq/plot/src/curve.js
var curves = /* @__PURE__ */ new Map([
  ["basis", basis_default2],
  ["basis-closed", basisClosed_default2],
  ["basis-open", basisOpen_default],
  ["bundle", bundle_default],
  ["bump-x", bumpX],
  ["bump-y", bumpY],
  ["cardinal", cardinal_default],
  ["cardinal-closed", cardinalClosed_default],
  ["cardinal-open", cardinalOpen_default],
  ["catmull-rom", catmullRom_default],
  ["catmull-rom-closed", catmullRomClosed_default],
  ["catmull-rom-open", catmullRomOpen_default],
  ["linear", linear_default],
  ["linear-closed", linearClosed_default],
  ["monotone-x", monotoneX],
  ["monotone-y", monotoneY],
  ["natural", natural_default],
  ["step", step_default],
  ["step-after", stepAfter],
  ["step-before", stepBefore]
]);
function maybeCurve(curve = linear_default, tension) {
  if (typeof curve === "function")
    return curve;
  const c5 = curves.get(`${curve}`.toLowerCase());
  if (!c5)
    throw new Error(`unknown curve: ${curve}`);
  if (tension !== void 0) {
    if ("beta" in c5) {
      return c5.beta(tension);
    } else if ("tension" in c5) {
      return c5.tension(tension);
    } else if ("alpha" in c5) {
      return c5.alpha(tension);
    }
  }
  return c5;
}
function maybeCurveAuto(curve = curveAuto, tension) {
  return typeof curve !== "function" && `${curve}`.toLowerCase() === "auto" ? curveAuto : maybeCurve(curve, tension);
}
function curveAuto(context) {
  return linear_default(context);
}

// ../../node_modules/@observablehq/plot/src/transforms/bin.js
function binX(outputs = { y: "count" }, options = {}) {
  [outputs, options] = mergeOptions2(outputs, options);
  const { x: x3, y: y3 } = options;
  return binn(maybeBinValue(x3, options, identity6), null, null, y3, outputs, maybeInsetX(options));
}
function binY(outputs = { x: "count" }, options = {}) {
  [outputs, options] = mergeOptions2(outputs, options);
  const { x: x3, y: y3 } = options;
  return binn(null, maybeBinValue(y3, options, identity6), x3, null, outputs, maybeInsetY(options));
}
function maybeDenseInterval(bin, k3, options = {}) {
  if (options?.interval == null)
    return options;
  const { reduce = reduceFirst } = options;
  const outputs = { filter: null };
  if (options[k3] != null)
    outputs[k3] = reduce;
  if (options[`${k3}1`] != null)
    outputs[`${k3}1`] = reduce;
  if (options[`${k3}2`] != null)
    outputs[`${k3}2`] = reduce;
  return bin(outputs, options);
}
function maybeDenseIntervalX(options = {}) {
  return maybeDenseInterval(binX, "y", withTip(options, "x"));
}
function maybeDenseIntervalY(options = {}) {
  return maybeDenseInterval(binY, "x", withTip(options, "y"));
}
function binn(bx, by, gx, gy, {
  data: reduceData = reduceIdentity,
  // TODO avoid materializing when unused?
  filter: filter2 = reduceCount,
  // return only non-empty bins by default
  sort: sort3,
  reverse: reverse2,
  ...outputs
  // output channel definitions
} = {}, inputs = {}) {
  bx = maybeBin(bx);
  by = maybeBin(by);
  outputs = maybeBinOutputs(outputs, inputs);
  reduceData = maybeBinReduce(reduceData, identity6);
  sort3 = sort3 == null ? void 0 : maybeBinOutput("sort", sort3, inputs);
  filter2 = filter2 == null ? void 0 : maybeBinEvaluator("filter", filter2, inputs);
  if (gx != null && hasOutput(outputs, "x", "x1", "x2"))
    gx = null;
  if (gy != null && hasOutput(outputs, "y", "y1", "y2"))
    gy = null;
  const [BX1, setBX1] = maybeColumn(bx);
  const [BX2, setBX2] = maybeColumn(bx);
  const [BY1, setBY1] = maybeColumn(by);
  const [BY2, setBY2] = maybeColumn(by);
  const [k3, gk] = gx != null ? [gx, "x"] : gy != null ? [gy, "y"] : [];
  const [GK, setGK] = maybeColumn(k3);
  const {
    x: x3,
    y: y3,
    z: z2,
    fill,
    stroke,
    x1: x12,
    x2: x22,
    // consumed if x is an output
    y1: y12,
    y2: y22,
    // consumed if y is an output
    domain,
    cumulative,
    thresholds,
    interval: interval2,
    ...options
  } = inputs;
  const [GZ, setGZ] = maybeColumn(z2);
  const [vfill] = maybeColorChannel(fill);
  const [vstroke] = maybeColorChannel(stroke);
  const [GF, setGF] = maybeColumn(vfill);
  const [GS, setGS] = maybeColumn(vstroke);
  return {
    ..."z" in inputs && { z: GZ || z2 },
    ..."fill" in inputs && { fill: GF || fill },
    ..."stroke" in inputs && { stroke: GS || stroke },
    ...basic(options, (data, facets, plotOptions) => {
      const K2 = maybeApplyInterval(valueof(data, k3), plotOptions?.[gk]);
      const Z3 = valueof(data, z2);
      const F = valueof(data, vfill);
      const S2 = valueof(data, vstroke);
      const G2 = maybeSubgroup(outputs, { z: Z3, fill: F, stroke: S2 });
      const groupFacets = [];
      const groupData = [];
      const GK2 = K2 && setGK([]);
      const GZ2 = Z3 && setGZ([]);
      const GF2 = F && setGF([]);
      const GS2 = S2 && setGS([]);
      const BX12 = bx && setBX1([]);
      const BX22 = bx && setBX2([]);
      const BY12 = by && setBY1([]);
      const BY22 = by && setBY2([]);
      const bin = bing(bx, by, data);
      let i2 = 0;
      for (const o2 of outputs)
        o2.initialize(data);
      if (sort3)
        sort3.initialize(data);
      if (filter2)
        filter2.initialize(data);
      for (const facet of facets) {
        const groupFacet = [];
        for (const o2 of outputs)
          o2.scope("facet", facet);
        if (sort3)
          sort3.scope("facet", facet);
        if (filter2)
          filter2.scope("facet", facet);
        for (const [f2, I2] of maybeGroup(facet, G2)) {
          for (const [k4, g2] of maybeGroup(I2, K2)) {
            for (const [b2, extent3] of bin(g2)) {
              if (G2)
                extent3.z = f2;
              if (filter2 && !filter2.reduce(b2, extent3))
                continue;
              groupFacet.push(i2++);
              groupData.push(reduceData.reduceIndex(b2, data, extent3));
              if (K2)
                GK2.push(k4);
              if (Z3)
                GZ2.push(G2 === Z3 ? f2 : Z3[(b2.length > 0 ? b2 : g2)[0]]);
              if (F)
                GF2.push(G2 === F ? f2 : F[(b2.length > 0 ? b2 : g2)[0]]);
              if (S2)
                GS2.push(G2 === S2 ? f2 : S2[(b2.length > 0 ? b2 : g2)[0]]);
              if (BX12)
                BX12.push(extent3.x1), BX22.push(extent3.x2);
              if (BY12)
                BY12.push(extent3.y1), BY22.push(extent3.y2);
              for (const o2 of outputs)
                o2.reduce(b2, extent3);
              if (sort3)
                sort3.reduce(b2, extent3);
            }
          }
        }
        groupFacets.push(groupFacet);
      }
      maybeSort(groupFacets, sort3, reverse2);
      return { data: groupData, facets: groupFacets };
    }),
    ...!hasOutput(outputs, "x") && (BX1 ? { x1: BX1, x2: BX2, x: mid(BX1, BX2) } : { x: x3, x1: x12, x2: x22 }),
    ...!hasOutput(outputs, "y") && (BY1 ? { y1: BY1, y2: BY2, y: mid(BY1, BY2) } : { y: y3, y1: y12, y2: y22 }),
    ...GK && { [gk]: GK },
    ...Object.fromEntries(outputs.map(({ name, output: output2 }) => [name, output2]))
  };
}
function mergeOptions2({ cumulative, domain, thresholds, interval: interval2, ...outputs }, options) {
  return [outputs, { cumulative, domain, thresholds, interval: interval2, ...options }];
}
function maybeBinValue(value, { cumulative, domain, thresholds, interval: interval2 }, defaultValue) {
  value = { ...maybeValue(value) };
  if (value.domain === void 0)
    value.domain = domain;
  if (value.cumulative === void 0)
    value.cumulative = cumulative;
  if (value.thresholds === void 0)
    value.thresholds = thresholds;
  if (value.interval === void 0)
    value.interval = interval2;
  if (value.value === void 0)
    value.value = defaultValue;
  value.thresholds = maybeThresholds(value.thresholds, value.interval);
  return value;
}
function maybeBin(options) {
  if (options == null)
    return;
  const { value, cumulative, domain = extent, thresholds } = options;
  const bin = (data) => {
    let V = valueof(data, value);
    let T;
    if (isTemporal(V) || isTimeThresholds(thresholds)) {
      V = map2(V, coerceDate, Float64Array);
      let [min4, max3] = typeof domain === "function" ? domain(V) : domain;
      let t5 = typeof thresholds === "function" && !isInterval(thresholds) ? thresholds(V, min4, max3) : thresholds;
      if (typeof t5 === "number")
        t5 = utcTickInterval(min4, max3, t5);
      if (isInterval(t5)) {
        if (domain === extent) {
          min4 = t5.floor(min4);
          max3 = t5.offset(t5.floor(max3));
        }
        t5 = t5.range(min4, t5.offset(max3));
      }
      T = t5;
    } else {
      V = coerceNumbers(V);
      let [min4, max3] = typeof domain === "function" ? domain(V) : domain;
      let t5 = typeof thresholds === "function" && !isInterval(thresholds) ? thresholds(V, min4, max3) : thresholds;
      if (typeof t5 === "number") {
        if (domain === extent) {
          let step = tickIncrement(min4, max3, t5);
          if (isFinite(step)) {
            if (step > 0) {
              let r0 = Math.round(min4 / step);
              let r1 = Math.round(max3 / step);
              if (!(r0 * step <= min4))
                --r0;
              if (!(r1 * step > max3))
                ++r1;
              let n2 = r1 - r0 + 1;
              t5 = new Float64Array(n2);
              for (let i2 = 0; i2 < n2; ++i2)
                t5[i2] = (r0 + i2) * step;
            } else if (step < 0) {
              step = -step;
              let r0 = Math.round(min4 * step);
              let r1 = Math.round(max3 * step);
              if (!(r0 / step <= min4))
                --r0;
              if (!(r1 / step > max3))
                ++r1;
              let n2 = r1 - r0 + 1;
              t5 = new Float64Array(n2);
              for (let i2 = 0; i2 < n2; ++i2)
                t5[i2] = (r0 + i2) / step;
            } else {
              t5 = [min4];
            }
          } else {
            t5 = [min4];
          }
        } else {
          t5 = ticks(min4, max3, t5);
        }
      } else if (isInterval(t5)) {
        if (domain === extent) {
          min4 = t5.floor(min4);
          max3 = t5.offset(t5.floor(max3));
        }
        t5 = t5.range(min4, t5.offset(max3));
      }
      T = t5;
    }
    const E3 = [];
    if (T.length === 1)
      E3.push([T[0], T[0]]);
    else
      for (let i2 = 1; i2 < T.length; ++i2)
        E3.push([T[i2 - 1], T[i2]]);
    E3.bin = (cumulative < 0 ? bin1cn : cumulative > 0 ? bin1cp : bin1)(E3, T, V);
    return E3;
  };
  bin.label = labelof(value);
  return bin;
}
function maybeThresholds(thresholds, interval2, defaultThresholds = thresholdAuto) {
  if (thresholds === void 0) {
    return interval2 === void 0 ? defaultThresholds : maybeRangeInterval(interval2);
  }
  if (typeof thresholds === "string") {
    switch (thresholds.toLowerCase()) {
      case "freedman-diaconis":
        return thresholdFreedmanDiaconis;
      case "scott":
        return thresholdScott;
      case "sturges":
        return thresholdSturges;
      case "auto":
        return thresholdAuto;
    }
    return utcInterval(thresholds);
  }
  return thresholds;
}
function maybeBinOutputs(outputs, inputs) {
  return maybeOutputs(outputs, inputs, maybeBinOutput);
}
function maybeBinOutput(name, reduce, inputs) {
  return maybeOutput(name, reduce, inputs, maybeBinEvaluator);
}
function maybeBinEvaluator(name, reduce, inputs) {
  return maybeEvaluator(name, reduce, inputs, maybeBinReduce);
}
function maybeBinReduce(reduce, value) {
  return maybeReduce(reduce, value, maybeBinReduceFallback);
}
function maybeBinReduceFallback(reduce) {
  switch (`${reduce}`.toLowerCase()) {
    case "x":
      return reduceX2;
    case "x1":
      return reduceX1;
    case "x2":
      return reduceX22;
    case "y":
      return reduceY2;
    case "y1":
      return reduceY1;
    case "y2":
      return reduceY22;
    case "z":
      return reduceZ;
  }
  throw new Error(`invalid bin reduce: ${reduce}`);
}
function thresholdAuto(values2, min4, max3) {
  return Math.min(200, thresholdScott(values2, min4, max3));
}
function isTimeThresholds(t5) {
  return isTimeInterval(t5) || isIterable(t5) && isTemporal(t5);
}
function bing(bx, by, data) {
  const EX = bx?.(data);
  const EY = by?.(data);
  return EX && EY ? function* (I2) {
    const X4 = EX.bin(I2);
    for (const [ix, [x12, x22]] of EX.entries()) {
      const Y4 = EY.bin(X4[ix]);
      for (const [iy, [y12, y22]] of EY.entries()) {
        yield [Y4[iy], { data, x1: x12, y1: y12, x2: x22, y2: y22 }];
      }
    }
  } : EX ? function* (I2) {
    const X4 = EX.bin(I2);
    for (const [i2, [x12, x22]] of EX.entries()) {
      yield [X4[i2], { data, x1: x12, x2: x22 }];
    }
  } : function* (I2) {
    const Y4 = EY.bin(I2);
    for (const [i2, [y12, y22]] of EY.entries()) {
      yield [Y4[i2], { data, y1: y12, y2: y22 }];
    }
  };
}
function bin1(E3, T, V) {
  T = coerceNumbers(T);
  return (I2) => {
    const B3 = E3.map(() => []);
    for (const i2 of I2)
      B3[bisect_default(T, V[i2]) - 1]?.push(i2);
    return B3;
  };
}
function bin1cp(E3, T, V) {
  const bin = bin1(E3, T, V);
  return (I2) => {
    const B3 = bin(I2);
    for (let i2 = 1, n2 = B3.length; i2 < n2; ++i2) {
      const C2 = B3[i2 - 1];
      const b2 = B3[i2];
      for (const j2 of C2)
        b2.push(j2);
    }
    return B3;
  };
}
function bin1cn(E3, T, V) {
  const bin = bin1(E3, T, V);
  return (I2) => {
    const B3 = bin(I2);
    for (let i2 = B3.length - 2; i2 >= 0; --i2) {
      const C2 = B3[i2 + 1];
      const b2 = B3[i2];
      for (const j2 of C2)
        b2.push(j2);
    }
    return B3;
  };
}
function mid1(x12, x22) {
  const m = (+x12 + +x22) / 2;
  return x12 instanceof Date ? new Date(m) : m;
}
var reduceX2 = {
  reduceIndex(I2, X4, { x1: x12, x2: x22 }) {
    return mid1(x12, x22);
  }
};
var reduceY2 = {
  reduceIndex(I2, X4, { y1: y12, y2: y22 }) {
    return mid1(y12, y22);
  }
};
var reduceX1 = {
  reduceIndex(I2, X4, { x1: x12 }) {
    return x12;
  }
};
var reduceX22 = {
  reduceIndex(I2, X4, { x2: x22 }) {
    return x22;
  }
};
var reduceY1 = {
  reduceIndex(I2, X4, { y1: y12 }) {
    return y12;
  }
};
var reduceY22 = {
  reduceIndex(I2, X4, { y2: y22 }) {
    return y22;
  }
};

// ../../node_modules/@observablehq/plot/src/marks/area.js
var defaults7 = {
  ariaLabel: "area",
  strokeWidth: 1,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  strokeMiterlimit: 1
};
var Area = class extends Mark {
  constructor(data, options = {}) {
    const { x1: x12, y1: y12, x2: x22, y2: y22, z: z2, curve, tension } = options;
    super(
      data,
      {
        x1: { value: x12, scale: "x" },
        y1: { value: y12, scale: "y" },
        x2: { value: x22, scale: "x", optional: true },
        y2: { value: y22, scale: "y", optional: true },
        z: { value: maybeZ(options), optional: true }
      },
      options,
      defaults7
    );
    this.z = z2;
    this.curve = maybeCurve(curve, tension);
  }
  filter(index2) {
    return index2;
  }
  render(index2, scales, channels, dimensions, context) {
    const { x1: X12, y1: Y12, x2: X22 = X12, y2: Y22 = Y12 } = channels;
    return create2("svg:g", context).call(applyIndirectStyles, this, dimensions, context).call(applyTransform, this, scales, 0, 0).call(
      (g2) => g2.selectAll().data(groupIndex(index2, [X12, Y12, X22, Y22], this, channels)).enter().append("path").call(applyDirectStyles, this).call(applyGroupedChannelStyles, this, channels).attr(
        "d",
        area_default2().curve(this.curve).defined((i2) => i2 >= 0).x0((i2) => X12[i2]).y0((i2) => Y12[i2]).x1((i2) => X22[i2]).y1((i2) => Y22[i2])
      )
    ).node();
  }
};
function areaX(data, options) {
  const { y: y3 = indexOf, ...rest } = maybeDenseIntervalY(options);
  return new Area(data, maybeStackX(maybeIdentityX({ ...rest, y1: y3, y2: void 0 })));
}
function areaY(data, options) {
  const { x: x3 = indexOf, ...rest } = maybeDenseIntervalX(options);
  return new Area(data, maybeStackY(maybeIdentityY({ ...rest, x1: x3, x2: void 0 })));
}

// ../../node_modules/@observablehq/plot/src/marks/bar.js
var barDefaults = {
  ariaLabel: "bar"
};
var AbstractBar = class extends Mark {
  constructor(data, channels, options = {}, defaults12 = barDefaults) {
    super(data, channels, options, defaults12);
    rectInsets(this, options);
    rectRadii(this, options);
  }
  render(index2, scales, channels, dimensions, context) {
    const { rx, ry, rx1y1, rx1y2, rx2y1, rx2y2 } = this;
    const x3 = this._x(scales, channels, dimensions);
    const y3 = this._y(scales, channels, dimensions);
    const w2 = this._width(scales, channels, dimensions);
    const h2 = this._height(scales, channels, dimensions);
    return create2("svg:g", context).call(applyIndirectStyles, this, dimensions, context).call(this._transform, this, scales).call(
      (g2) => g2.selectAll().data(index2).enter().call(
        rx1y1 || rx1y2 || rx2y1 || rx2y2 ? (g3) => g3.append("path").call(applyDirectStyles, this).call(applyRoundedRect, x3, y3, add(x3, w2), add(y3, h2), this).call(applyChannelStyles, this, channels) : (g3) => g3.append("rect").call(applyDirectStyles, this).attr("x", x3).attr("width", w2).attr("y", y3).attr("height", h2).call(applyAttr, "rx", rx).call(applyAttr, "ry", ry).call(applyChannelStyles, this, channels)
      )
    ).node();
  }
  _x(scales, { x: X4 }, { marginLeft }) {
    const { insetLeft } = this;
    return X4 ? (i2) => X4[i2] + insetLeft : marginLeft + insetLeft;
  }
  _y(scales, { y: Y4 }, { marginTop }) {
    const { insetTop } = this;
    return Y4 ? (i2) => Y4[i2] + insetTop : marginTop + insetTop;
  }
  _width({ x: x3 }, { x: X4 }, { marginRight, marginLeft, width }) {
    const { insetLeft, insetRight } = this;
    const bandwidth = X4 && x3 ? x3.bandwidth() : width - marginRight - marginLeft;
    return Math.max(0, bandwidth - insetLeft - insetRight);
  }
  _height({ y: y3 }, { y: Y4 }, { marginTop, marginBottom, height }) {
    const { insetTop, insetBottom } = this;
    const bandwidth = Y4 && y3 ? y3.bandwidth() : height - marginTop - marginBottom;
    return Math.max(0, bandwidth - insetTop - insetBottom);
  }
};
function add(a3, b2) {
  return typeof a3 === "function" && typeof b2 === "function" ? (i2) => a3(i2) + b2(i2) : typeof a3 === "function" ? (i2) => a3(i2) + b2 : typeof b2 === "function" ? (i2) => a3 + b2(i2) : a3 + b2;
}
var BarX = class extends AbstractBar {
  constructor(data, options = {}, defaults12) {
    const { x1: x12, x2: x22, y: y3 } = options;
    super(
      data,
      {
        x1: { value: x12, scale: "x" },
        x2: { value: x22, scale: "x" },
        y: { value: y3, scale: "y", type: "band", optional: true }
      },
      options,
      defaults12
    );
  }
  _transform(selection2, mark, { x: x3 }) {
    selection2.call(applyTransform, mark, { x: x3 }, 0, 0);
  }
  _x({ x: x3 }, { x1: X12, x2: X22 }, { marginLeft }) {
    const { insetLeft } = this;
    return isCollapsed(x3) ? marginLeft + insetLeft : (i2) => Math.min(X12[i2], X22[i2]) + insetLeft;
  }
  _width({ x: x3 }, { x1: X12, x2: X22 }, { marginRight, marginLeft, width }) {
    const { insetLeft, insetRight } = this;
    return isCollapsed(x3) ? width - marginRight - marginLeft - insetLeft - insetRight : (i2) => Math.max(0, Math.abs(X22[i2] - X12[i2]) - insetLeft - insetRight);
  }
};
var BarY = class extends AbstractBar {
  constructor(data, options = {}, defaults12) {
    const { x: x3, y1: y12, y2: y22 } = options;
    super(
      data,
      {
        y1: { value: y12, scale: "y" },
        y2: { value: y22, scale: "y" },
        x: { value: x3, scale: "x", type: "band", optional: true }
      },
      options,
      defaults12
    );
  }
  _transform(selection2, mark, { y: y3 }) {
    selection2.call(applyTransform, mark, { y: y3 }, 0, 0);
  }
  _y({ y: y3 }, { y1: Y12, y2: Y22 }, { marginTop }) {
    const { insetTop } = this;
    return isCollapsed(y3) ? marginTop + insetTop : (i2) => Math.min(Y12[i2], Y22[i2]) + insetTop;
  }
  _height({ y: y3 }, { y1: Y12, y2: Y22 }, { marginTop, marginBottom, height }) {
    const { insetTop, insetBottom } = this;
    return isCollapsed(y3) ? height - marginTop - marginBottom - insetTop - insetBottom : (i2) => Math.max(0, Math.abs(Y22[i2] - Y12[i2]) - insetTop - insetBottom);
  }
};
function barX(data, options = {}) {
  if (!hasXY(options))
    options = { ...options, y: indexOf, x2: identity6 };
  return new BarX(data, maybeStackX(maybeIntervalX(maybeIdentityX(options))));
}
function barY(data, options = {}) {
  if (!hasXY(options))
    options = { ...options, x: indexOf, y2: identity6 };
  return new BarY(data, maybeStackY(maybeIntervalY(maybeIdentityY(options))));
}

// ../../node_modules/@observablehq/plot/src/marks/cell.js
var defaults8 = {
  ariaLabel: "cell"
};
var Cell = class extends AbstractBar {
  constructor(data, { x: x3, y: y3, ...options } = {}) {
    super(
      data,
      {
        x: { value: x3, scale: "x", type: "band", optional: true },
        y: { value: y3, scale: "y", type: "band", optional: true }
      },
      options,
      defaults8
    );
  }
  _transform(selection2, mark) {
    selection2.call(applyTransform, mark, {}, 0, 0);
  }
};
function cell(data, { x: x3, y: y3, ...options } = {}) {
  [x3, y3] = maybeTuple(x3, y3);
  return new Cell(data, { ...options, x: x3, y: y3 });
}

// ../../node_modules/@observablehq/plot/src/marks/dot.js
var defaults9 = {
  ariaLabel: "dot",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5
};
function withDefaultSort(options) {
  return options.sort === void 0 && options.reverse === void 0 ? sort2({ channel: "-r" }, options) : options;
}
var Dot = class extends Mark {
  constructor(data, options = {}) {
    const { x: x3, y: y3, r: r2, rotate, symbol: symbol2 = circle_default2, frameAnchor } = options;
    const [vrotate, crotate] = maybeNumberChannel(rotate, 0);
    const [vsymbol, csymbol] = maybeSymbolChannel(symbol2);
    const [vr, cr] = maybeNumberChannel(r2, vsymbol == null ? 3 : 4.5);
    super(
      data,
      {
        x: { value: x3, scale: "x", optional: true },
        y: { value: y3, scale: "y", optional: true },
        r: { value: vr, scale: "r", filter: positive, optional: true },
        rotate: { value: vrotate, optional: true },
        symbol: { value: vsymbol, scale: "auto", optional: true }
      },
      withDefaultSort(options),
      defaults9
    );
    this.r = cr;
    this.rotate = crotate;
    this.symbol = csymbol;
    this.frameAnchor = maybeFrameAnchor(frameAnchor);
    const { channels } = this;
    const { symbol: symbolChannel } = channels;
    if (symbolChannel) {
      const { fill: fillChannel, stroke: strokeChannel } = channels;
      symbolChannel.hint = {
        fill: fillChannel ? fillChannel.value === symbolChannel.value ? "color" : "currentColor" : this.fill ?? "currentColor",
        stroke: strokeChannel ? strokeChannel.value === symbolChannel.value ? "color" : "currentColor" : this.stroke ?? "none"
      };
    }
  }
  render(index2, scales, channels, dimensions, context) {
    const { x: x3, y: y3 } = scales;
    const { x: X4, y: Y4, r: R2, rotate: A6, symbol: S2 } = channels;
    const { r: r2, rotate, symbol: symbol2 } = this;
    const [cx, cy] = applyFrameAnchor(this, dimensions);
    const circle2 = symbol2 === circle_default2;
    const size = R2 ? void 0 : r2 * r2 * Math.PI;
    if (negative(r2))
      index2 = [];
    return create2("svg:g", context).call(applyIndirectStyles, this, dimensions, context).call(applyTransform, this, { x: X4 && x3, y: Y4 && y3 }).call(
      (g2) => g2.selectAll().data(index2).enter().append(circle2 ? "circle" : "path").call(applyDirectStyles, this).call(
        circle2 ? (selection2) => {
          selection2.attr("cx", X4 ? (i2) => X4[i2] : cx).attr("cy", Y4 ? (i2) => Y4[i2] : cy).attr("r", R2 ? (i2) => R2[i2] : r2);
        } : (selection2) => {
          selection2.attr(
            "transform",
            template`translate(${X4 ? (i2) => X4[i2] : cx},${Y4 ? (i2) => Y4[i2] : cy})${A6 ? (i2) => ` rotate(${A6[i2]})` : rotate ? ` rotate(${rotate})` : ``}`
          ).attr(
            "d",
            R2 && S2 ? (i2) => {
              const p2 = pathRound();
              S2[i2].draw(p2, R2[i2] * R2[i2] * Math.PI);
              return p2;
            } : R2 ? (i2) => {
              const p2 = pathRound();
              symbol2.draw(p2, R2[i2] * R2[i2] * Math.PI);
              return p2;
            } : S2 ? (i2) => {
              const p2 = pathRound();
              S2[i2].draw(p2, size);
              return p2;
            } : (() => {
              const p2 = pathRound();
              symbol2.draw(p2, size);
              return p2;
            })()
          );
        }
      ).call(applyChannelStyles, this, channels)
    ).node();
  }
};
function dot(data, { x: x3, y: y3, ...options } = {}) {
  if (options.frameAnchor === void 0)
    [x3, y3] = maybeTuple(x3, y3);
  return new Dot(data, { ...options, x: x3, y: y3 });
}

// ../../node_modules/@observablehq/plot/src/marks/line.js
var defaults10 = {
  ariaLabel: "line",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  strokeMiterlimit: 1
};
var Line = class extends Mark {
  constructor(data, options = {}) {
    const { x: x3, y: y3, z: z2, curve, tension } = options;
    super(
      data,
      {
        x: { value: x3, scale: "x" },
        y: { value: y3, scale: "y" },
        z: { value: maybeZ(options), optional: true }
      },
      options,
      defaults10
    );
    this.z = z2;
    this.curve = maybeCurveAuto(curve, tension);
    markers(this, options);
  }
  filter(index2) {
    return index2;
  }
  project(channels, values2, context) {
    if (this.curve !== curveAuto) {
      super.project(channels, values2, context);
    }
  }
  render(index2, scales, channels, dimensions, context) {
    const { x: X4, y: Y4 } = channels;
    const { curve } = this;
    return create2("svg:g", context).call(applyIndirectStyles, this, dimensions, context).call(applyTransform, this, scales).call(
      (g2) => g2.selectAll().data(groupIndex(index2, [X4, Y4], this, channels)).enter().append("path").call(applyDirectStyles, this).call(applyGroupedChannelStyles, this, channels).call(applyGroupedMarkers, this, channels, context).attr(
        "d",
        curve === curveAuto && context.projection ? sphereLine(context.projection, X4, Y4) : line_default2().curve(curve).defined((i2) => i2 >= 0).x((i2) => X4[i2]).y((i2) => Y4[i2])
      )
    ).node();
  }
};
function sphereLine(projection3, X4, Y4) {
  const path2 = path_default(projection3);
  X4 = coerceNumbers(X4);
  Y4 = coerceNumbers(Y4);
  return (I2) => {
    let line2 = [];
    const lines = [line2];
    for (const i2 of I2) {
      if (i2 === -1) {
        line2 = [];
        lines.push(line2);
      } else {
        line2.push([X4[i2], Y4[i2]]);
      }
    }
    return path2({ type: "MultiLineString", coordinates: lines });
  };
}
function lineX(data, { x: x3 = identity6, y: y3 = indexOf, ...options } = {}) {
  return new Line(data, maybeDenseIntervalY({ ...options, x: x3, y: y3 }));
}
function lineY(data, { x: x3 = indexOf, y: y3 = identity6, ...options } = {}) {
  return new Line(data, maybeDenseIntervalX({ ...options, x: x3, y: y3 }));
}

// ../../node_modules/@observablehq/plot/src/transforms/map.js
function map3(outputs = {}, options = {}) {
  const z2 = maybeZ(options);
  const channels = Object.entries(outputs).map(([key, map4]) => {
    const input = maybeInput(key, options);
    if (input == null)
      throw new Error(`missing channel: ${key}`);
    const [output2, setOutput] = column(input);
    return { key, input, output: output2, setOutput, map: maybeMap(map4) };
  });
  return {
    ...basic(options, (data, facets) => {
      const Z3 = valueof(data, z2);
      const X4 = channels.map(({ input }) => valueof(data, input));
      const MX = channels.map(({ setOutput }) => setOutput(new Array(data.length)));
      for (const facet of facets) {
        for (const I2 of Z3 ? group(facet, (i2) => Z3[i2]).values() : [facet]) {
          channels.forEach(({ map: map4 }, i2) => map4.mapIndex(I2, X4[i2], MX[i2]));
        }
      }
      return { data, facets };
    }),
    ...Object.fromEntries(channels.map(({ key, output: output2 }) => [key, output2]))
  };
}
function maybeMap(map4) {
  if (map4 == null)
    throw new Error("missing map");
  if (typeof map4.mapIndex === "function")
    return map4;
  if (typeof map4.map === "function" && isObject(map4))
    return mapMap(map4);
  if (typeof map4 === "function")
    return mapFunction(taker(map4));
  switch (`${map4}`.toLowerCase()) {
    case "cumsum":
      return mapCumsum;
    case "rank":
      return mapFunction((I2, V) => rank(I2, (i2) => V[i2]));
    case "quantile":
      return mapFunction((I2, V) => rankQuantile(I2, (i2) => V[i2]));
  }
  throw new Error(`invalid map: ${map4}`);
}
function mapMap(map4) {
  console.warn("deprecated map interface; implement mapIndex instead.");
  return { mapIndex: map4.map.bind(map4) };
}
function rankQuantile(I2, f2) {
  const n2 = count(I2, f2) - 1;
  return rank(I2, f2).map((r2) => r2 / n2);
}
function mapFunction(f2) {
  return {
    mapIndex(I2, S2, T) {
      const M3 = f2(I2, S2);
      if (M3.length !== I2.length)
        throw new Error("map function returned a mismatched length");
      for (let i2 = 0, n2 = I2.length; i2 < n2; ++i2)
        T[I2[i2]] = M3[i2];
    }
  };
}
var mapCumsum = {
  mapIndex(I2, S2, T) {
    let sum2 = 0;
    for (const i2 of I2)
      T[i2] = sum2 += S2[i2];
  }
};

// ../../node_modules/@observablehq/plot/src/marks/tick.js
var defaults11 = {
  ariaLabel: "tick",
  fill: null,
  stroke: "currentColor"
};
var AbstractTick = class extends Mark {
  constructor(data, channels, options) {
    super(data, channels, options, defaults11);
    markers(this, options);
  }
  render(index2, scales, channels, dimensions, context) {
    return create2("svg:g", context).call(applyIndirectStyles, this, dimensions, context).call(this._transform, this, scales).call(
      (g2) => g2.selectAll().data(index2).enter().append("line").call(applyDirectStyles, this).attr("x1", this._x1(scales, channels, dimensions)).attr("x2", this._x2(scales, channels, dimensions)).attr("y1", this._y1(scales, channels, dimensions)).attr("y2", this._y2(scales, channels, dimensions)).call(applyChannelStyles, this, channels).call(applyMarkers, this, channels, context)
    ).node();
  }
};
var TickX = class extends AbstractTick {
  constructor(data, options = {}) {
    const { x: x3, y: y3, inset = 0, insetTop = inset, insetBottom = inset } = options;
    super(
      data,
      {
        x: { value: x3, scale: "x" },
        y: { value: y3, scale: "y", type: "band", optional: true }
      },
      options
    );
    this.insetTop = number5(insetTop);
    this.insetBottom = number5(insetBottom);
  }
  _transform(selection2, mark, { x: x3 }) {
    selection2.call(applyTransform, mark, { x: x3 }, offset, 0);
  }
  _x1(scales, { x: X4 }) {
    return (i2) => X4[i2];
  }
  _x2(scales, { x: X4 }) {
    return (i2) => X4[i2];
  }
  _y1({ y: y3 }, { y: Y4 }, { marginTop }) {
    const { insetTop } = this;
    return Y4 && y3 ? (i2) => Y4[i2] + insetTop : marginTop + insetTop;
  }
  _y2({ y: y3 }, { y: Y4 }, { height, marginBottom }) {
    const { insetBottom } = this;
    return Y4 && y3 ? (i2) => Y4[i2] + y3.bandwidth() - insetBottom : height - marginBottom - insetBottom;
  }
};
var TickY = class extends AbstractTick {
  constructor(data, options = {}) {
    const { x: x3, y: y3, inset = 0, insetRight = inset, insetLeft = inset } = options;
    super(
      data,
      {
        y: { value: y3, scale: "y" },
        x: { value: x3, scale: "x", type: "band", optional: true }
      },
      options
    );
    this.insetRight = number5(insetRight);
    this.insetLeft = number5(insetLeft);
  }
  _transform(selection2, mark, { y: y3 }) {
    selection2.call(applyTransform, mark, { y: y3 }, 0, offset);
  }
  _x1({ x: x3 }, { x: X4 }, { marginLeft }) {
    const { insetLeft } = this;
    return X4 && x3 ? (i2) => X4[i2] + insetLeft : marginLeft + insetLeft;
  }
  _x2({ x: x3 }, { x: X4 }, { width, marginRight }) {
    const { insetRight } = this;
    return X4 && x3 ? (i2) => X4[i2] + x3.bandwidth() - insetRight : width - marginRight - insetRight;
  }
  _y1(scales, { y: Y4 }) {
    return (i2) => Y4[i2];
  }
  _y2(scales, { y: Y4 }) {
    return (i2) => Y4[i2];
  }
};
function tickX(data, { x: x3 = identity6, ...options } = {}) {
  return new TickX(data, { ...options, x: x3 });
}
function tickY(data, { y: y3 = identity6, ...options } = {}) {
  return new TickY(data, { ...options, y: y3 });
}

// ../../node_modules/@observablehq/plot/src/marks/box.js
function boxX(data, {
  x: x3 = identity6,
  y: y3 = null,
  r: r2,
  fill = "#ccc",
  fillOpacity,
  stroke = "currentColor",
  strokeOpacity,
  strokeWidth = 2,
  sort: sort3,
  ...options
} = {}) {
  const group2 = y3 != null ? groupY : groupZ;
  return marks(
    ruleY(data, group2({ x1: loqr1, x2: hiqr2 }, { x: x3, y: y3, stroke, strokeOpacity, ...options })),
    barX(data, group2({ x1: "p25", x2: "p75" }, { x: x3, y: y3, fill, fillOpacity, ...options })),
    tickX(data, group2({ x: "p50" }, { x: x3, y: y3, stroke, strokeOpacity, strokeWidth, sort: sort3, ...options })),
    dot(data, map3({ x: oqr }, { x: x3, y: y3, z: y3, r: r2, stroke, strokeOpacity, ...options }))
  );
}
function boxY(data, {
  y: y3 = identity6,
  x: x3 = null,
  r: r2,
  fill = "#ccc",
  fillOpacity,
  stroke = "currentColor",
  strokeOpacity,
  strokeWidth = 2,
  sort: sort3,
  ...options
} = {}) {
  const group2 = x3 != null ? groupX : groupZ;
  return marks(
    ruleX(data, group2({ y1: loqr1, y2: hiqr2 }, { x: x3, y: y3, stroke, strokeOpacity, ...options })),
    barY(data, group2({ y1: "p25", y2: "p75" }, { x: x3, y: y3, fill, fillOpacity, ...options })),
    tickY(data, group2({ y: "p50" }, { x: x3, y: y3, stroke, strokeOpacity, strokeWidth, sort: sort3, ...options })),
    dot(data, map3({ y: oqr }, { x: x3, y: y3, z: x3, r: r2, stroke, strokeOpacity, ...options }))
  );
}
function oqr(values2) {
  const r1 = loqr1(values2);
  const r2 = hiqr2(values2);
  return values2.map((v2) => v2 < r1 || v2 > r2 ? v2 : NaN);
}
function loqr1(values2) {
  const lo = quartile1(values2) * 2.5 - quartile3(values2) * 1.5;
  return min(values2, (d2) => d2 >= lo ? d2 : NaN);
}
function hiqr2(values2) {
  const hi = quartile3(values2) * 2.5 - quartile1(values2) * 1.5;
  return max(values2, (d2) => d2 <= hi ? d2 : NaN);
}
function quartile1(values2) {
  return quantile(values2, 0.25);
}
function quartile3(values2) {
  return quantile(values2, 0.75);
}

// ../../node_modules/@observablehq/plot/src/index.js
Mark.prototype.plot = function({ marks: marks2 = [], ...options } = {}) {
  return plot({ ...options, marks: [...marks2, this] });
};

// ../graphic-walker/dist/config.js
var GEOM_TYPES = {
  generic: ["auto", "bar", "line", "area", "trail", "point", "circle", "tick", "rect", "arc", "text", "boxplot", "table"],
  geographic: ["poi", "choropleth"]
};
var COORD_TYPES = ["generic", "geographic"];
var STACK_MODE = ["none", "stack", "normalize", "center"];
var CHART_LAYOUT_TYPE = ["auto", "fixed", "full"];
var CHANNEL_LIMIT = {
  rows: Infinity,
  columns: Infinity,
  color: 1,
  opacity: 1,
  size: 1,
  shape: 1,
  theta: 1,
  radius: 1,
  details: Infinity,
  text: 1
};
var META_FIELD_KEYS = ["dimensions", "measures"];
var POSITION_CHANNEL_CONFIG_LIST = ["x", "y"];
var NON_POSITION_CHANNEL_CONFIG_LIST = ["color", "opacity", "shape", "size"];
var AGGREGATOR_LIST = ["sum", "mean", "median", "count", "min", "max", "variance", "stdev"];
var EMBEDED_MENU_LIST = ["data_interpretation", "data_view"];
var RENDERER_TYPES = ["vega-lite", "observable-plot", "plugin:echarts"];
var GLOBAL_CONFIG = {
  AGGREGATOR_LIST,
  CHART_LAYOUT_TYPE,
  COORD_TYPES,
  GEOM_TYPES,
  MAX_HISTORY_SIZE: 20,
  STACK_MODE,
  META_FIELD_KEYS,
  CHANNEL_LIMIT,
  POSITION_CHANNEL_CONFIG_LIST,
  NON_POSITION_CHANNEL_CONFIG_LIST,
  EMBEDED_MENU_LIST,
  RENDERER_TYPES,
  PAINT_MAP_SIZE: 128,
  PAINT_SIZE_FACTOR: 4,
  PAINT_MIN_BRUSH_SIZE: 1,
  PAINT_DEFAULT_BRUSH_SIZE: 9,
  PAINT_MAX_BRUSH_SIZE: 36,
  KEYWORD_DEBOUNCE_SETTING: { timeout: 300, leading: true, trailing: true }
};

// ../graphic-walker/dist/vis/spec/field.js
var NULL_FIELD = {
  fid: "",
  name: "",
  semanticType: "quantitative",
  analyticType: "measure",
  aggName: "sum"
};

// ../graphic-walker/dist/vis/spec/encode.js
function availableChannels(geomType) {
  if (geomType === "text") {
    return /* @__PURE__ */ new Set(["text", "color", "size", "x", "y", "xOffset", "yOffset", "opacity"]);
  }
  if (geomType === "arc") {
    return /* @__PURE__ */ new Set(["opacity", "color", "size", "theta", "radius"]);
  }
  return /* @__PURE__ */ new Set(["column", "opacity", "color", "row", "size", "x", "y", "xOffset", "yOffset", "shape"]);
}
function encodeTimeunit(unit3) {
  switch (unit3) {
    case "iso_year":
    case "year":
      return "utcyear";
    case "quarter":
      return "utcyearquarter";
    case "month":
      return "utcyearmonth";
    case "iso_week":
    case "week":
      return "utcyearweek";
    case "day":
      return "utcyearmonthdate";
    case "hour":
      return "utcyearmonthdatehours";
    case "minute":
      return "utcyearmonthdatehoursminutes";
    case "second":
      return "utcyearmonthdatehoursminutesseconds";
  }
  return unit3;
}
function isoTimeformat(unit3) {
  switch (unit3) {
    case "iso_year":
      return "%G";
    case "iso_week":
      return "%G W%V";
  }
}
function encodeFid(fid) {
  return fid.replace(/([\"\'\.\[\]\/\\])/g, "\\$1").replace(/\n/g, "\\n").replace(/\t/g, "\\t").replace(/\r/g, "\\r");
}
var AXIS_CHANNELS = /* @__PURE__ */ new Set(["x", "y", "xOffset", "yOffset", "theta", "radius"]);
var LEGEND_CHANNELS = /* @__PURE__ */ new Set(["color", "size", "shape", "opacity"]);
function applyCustomFormat(channelKey, entry, field2) {
  if (!field2.customFormat || !entry)
    return;
  entry.format = field2.customFormat;
  if (channelKey === "text") {
    return;
  }
  if (channelKey === "row" || channelKey === "column") {
    entry.header = { ...entry.header ?? {}, format: field2.customFormat };
    return;
  }
  if (LEGEND_CHANNELS.has(channelKey)) {
    entry.legend = { ...entry.legend ?? {}, format: field2.customFormat };
    return;
  }
  if (AXIS_CHANNELS.has(channelKey)) {
    entry.axis = { ...entry.axis ?? {}, format: field2.customFormat };
  }
}
function channelEncode(props) {
  const avcs = availableChannels(props.geomType);
  const encoding = {};
  Object.keys(props).filter((c5) => avcs.has(c5)).forEach((c5) => {
    const field2 = props[c5];
    if (field2 !== NULL_FIELD) {
      encoding[c5] = {
        field: encodeFid(field2.fid),
        title: field2.titleOverride ?? field2.name,
        type: field2.semanticType
      };
      if (field2.computed && field2.expression?.op === "bin") {
        const fid = encoding[c5].field;
        encoding[c5].field = `${fid}[0]`;
        delete encoding[c5].type;
        encoding[c5].bin = {
          binned: true
        };
        encoding[c5].formatType = "formatBin";
        encoding[c5].format = props.vegaConfig?.numberFormat;
        if (c5 === "x" || c5 === "y") {
          encoding[`${c5}2`] = {
            field: `${fid}[1]`,
            formatType: "formatBin",
            format: props.vegaConfig?.numberFormat
          };
        }
      }
      if (field2.analyticType !== "measure") {
        encoding[c5].aggregate = null;
      }
      if (field2.analyticType === "measure") {
        encoding[c5].type = "quantitative";
      }
      if (field2.semanticType === "temporal") {
        encoding[c5].scale = { type: "utc" };
      }
      if (field2.semanticType === "temporal" && field2.timeUnit) {
        if (field2.timeUnit.startsWith("iso")) {
          encoding[c5].format = isoTimeformat(field2.timeUnit);
        }
        encoding[c5].timeUnit = encodeTimeunit(field2.timeUnit);
      }
      if (c5 === "color" && field2.expression?.op === "paint") {
        const map4 = field2.expression.params.find((x3) => x3.type === "map" || x3.type === "newmap").value;
        const colors = map4.usedColor.map((x3) => map4.dict[x3]).filter(Boolean);
        encoding[c5].scale = {
          domain: colors.map((x3) => x3.name),
          range: colors.map((x3) => x3.color)
        };
      }
      applyCustomFormat(c5, encoding[c5], field2);
    }
  });
  if (encoding.x) {
    encoding.x.axis = { ...encoding.x.axis ?? {}, labelOverlap: true };
  }
  if (encoding && encoding.y) {
    encoding.y.axis = { ...encoding.y.axis ?? {}, labelOverlap: true };
  }
  const applyManualSort = (channelKey, field2, fallback) => {
    if (!field2 || field2 === NULL_FIELD || field2.analyticType !== "dimension")
      return;
    const strategy = field2.sortType ?? "measure";
    if (!encoding[channelKey])
      return;
    if (strategy === "manual" && field2.sortList && field2.sortList.length > 0) {
      encoding[channelKey].sort = field2.sortList;
      return;
    }
    if (strategy === "alphabetical") {
      const order = field2.sort && field2.sort !== "none" ? field2.sort : "ascending";
      encoding[channelKey].sort = order;
      return;
    }
    if (strategy === "measure" && fallback && field2.sort && field2.sort !== "none") {
      encoding[channelKey].sort = {
        encoding: fallback,
        order: field2.sort
      };
    }
  };
  const xField = props.x;
  const yField = props.y;
  if (xField && yField && xField !== NULL_FIELD && yField !== NULL_FIELD && ((xField.sortType ?? "measure") === "manual" || (xField.sortType ?? "measure") === "alphabetical" || (yField.sortType ?? "measure") === "manual" || (yField.sortType ?? "measure") === "alphabetical")) {
    applyManualSort("x", xField);
    applyManualSort("y", yField);
  } else {
    if (xField && yField && xField !== NULL_FIELD && yField !== NULL_FIELD) {
      const xNeedsMeasureSort = xField.analyticType === "dimension" && yField.analyticType === "measure";
      const yNeedsMeasureSort = yField.analyticType === "dimension" && xField.analyticType === "measure";
      if (xNeedsMeasureSort) {
        applyManualSort("x", xField, "y");
      }
      if (yNeedsMeasureSort) {
        applyManualSort("y", yField, "x");
      }
    } else {
      if (xField) {
        applyManualSort("x", xField);
      }
      if (yField) {
        applyManualSort("y", yField);
      }
    }
  }
  applyManualSort("column", props.column);
  applyManualSort("row", props.row);
  return encoding;
}

// ../graphic-walker/dist/vis/spec/mark.js
function autoMark(subViewFieldsSemanticTypes, aggregate) {
  if (subViewFieldsSemanticTypes.length < 2) {
    if (subViewFieldsSemanticTypes[0] === "temporal" || subViewFieldsSemanticTypes[0] === "quantitative")
      return "tick";
    if (aggregate === false)
      return "tick";
    return "bar";
  }
  const couter = /* @__PURE__ */ new Map();
  ["nominal", "ordinal", "quantitative", "temporal"].forEach((s3) => {
    couter.set(s3, 0);
  });
  for (let st of subViewFieldsSemanticTypes) {
    couter.set(st, couter.get(st) + 1);
  }
  if (couter.get("nominal") === 1) {
    if (aggregate === false)
      return "tick";
    return "bar";
  }
  if (couter.get("ordinal") === 1) {
    return "bar";
  }
  if (couter.get("temporal") === 1 && couter.get("quantitative") === 1) {
    return "line";
  }
  if (couter.get("quantitative") === 2) {
    return "point";
  }
  return "point";
}

// ../graphic-walker/dist/constants.js
var COUNT_FIELD_ID = "gw_count_fid";

// ../../node_modules/@babel/runtime/helpers/esm/typeof.js
function _typeof(o2) {
  "@babel/helpers - typeof";
  return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(o3) {
    return typeof o3;
  } : function(o3) {
    return o3 && "function" == typeof Symbol && o3.constructor === Symbol && o3 !== Symbol.prototype ? "symbol" : typeof o3;
  }, _typeof(o2);
}

// ../../node_modules/@babel/runtime/helpers/esm/classCallCheck.js
function _classCallCheck(instance2, Constructor) {
  if (!(instance2 instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
}

// ../../node_modules/@babel/runtime/helpers/esm/toPrimitive.js
function _toPrimitive(input, hint) {
  if (_typeof(input) !== "object" || input === null)
    return input;
  var prim = input[Symbol.toPrimitive];
  if (prim !== void 0) {
    var res = prim.call(input, hint || "default");
    if (_typeof(res) !== "object")
      return res;
    throw new TypeError("@@toPrimitive must return a primitive value.");
  }
  return (hint === "string" ? String : Number)(input);
}

// ../../node_modules/@babel/runtime/helpers/esm/toPropertyKey.js
function _toPropertyKey(arg) {
  var key = _toPrimitive(arg, "string");
  return _typeof(key) === "symbol" ? key : String(key);
}

// ../../node_modules/@babel/runtime/helpers/esm/createClass.js
function _defineProperties(target, props) {
  for (var i2 = 0; i2 < props.length; i2++) {
    var descriptor = props[i2];
    descriptor.enumerable = descriptor.enumerable || false;
    descriptor.configurable = true;
    if ("value" in descriptor)
      descriptor.writable = true;
    Object.defineProperty(target, _toPropertyKey(descriptor.key), descriptor);
  }
}
function _createClass(Constructor, protoProps, staticProps) {
  if (protoProps)
    _defineProperties(Constructor.prototype, protoProps);
  if (staticProps)
    _defineProperties(Constructor, staticProps);
  Object.defineProperty(Constructor, "prototype", {
    writable: false
  });
  return Constructor;
}

// ../../node_modules/@babel/runtime/helpers/esm/assertThisInitialized.js
function _assertThisInitialized(self) {
  if (self === void 0) {
    throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
  }
  return self;
}

// ../../node_modules/@babel/runtime/helpers/esm/setPrototypeOf.js
function _setPrototypeOf(o2, p2) {
  _setPrototypeOf = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function _setPrototypeOf2(o3, p3) {
    o3.__proto__ = p3;
    return o3;
  };
  return _setPrototypeOf(o2, p2);
}

// ../../node_modules/@babel/runtime/helpers/esm/inherits.js
function _inherits(subClass, superClass) {
  if (typeof superClass !== "function" && superClass !== null) {
    throw new TypeError("Super expression must either be null or a function");
  }
  subClass.prototype = Object.create(superClass && superClass.prototype, {
    constructor: {
      value: subClass,
      writable: true,
      configurable: true
    }
  });
  Object.defineProperty(subClass, "prototype", {
    writable: false
  });
  if (superClass)
    _setPrototypeOf(subClass, superClass);
}

// ../../node_modules/@babel/runtime/helpers/esm/possibleConstructorReturn.js
function _possibleConstructorReturn(self, call) {
  if (call && (_typeof(call) === "object" || typeof call === "function")) {
    return call;
  } else if (call !== void 0) {
    throw new TypeError("Derived constructors may only return object or undefined");
  }
  return _assertThisInitialized(self);
}

// ../../node_modules/@babel/runtime/helpers/esm/getPrototypeOf.js
function _getPrototypeOf(o2) {
  _getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf.bind() : function _getPrototypeOf2(o3) {
    return o3.__proto__ || Object.getPrototypeOf(o3);
  };
  return _getPrototypeOf(o2);
}

// ../../node_modules/@babel/runtime/helpers/esm/defineProperty.js
function _defineProperty(obj, key, value) {
  key = _toPropertyKey(key);
  if (key in obj) {
    Object.defineProperty(obj, key, {
      value,
      enumerable: true,
      configurable: true,
      writable: true
    });
  } else {
    obj[key] = value;
  }
  return obj;
}

// ../../node_modules/@babel/runtime/helpers/esm/arrayWithHoles.js
function _arrayWithHoles(arr) {
  if (Array.isArray(arr))
    return arr;
}

// ../../node_modules/@babel/runtime/helpers/esm/iterableToArray.js
function _iterableToArray(iter) {
  if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null)
    return Array.from(iter);
}

// ../../node_modules/@babel/runtime/helpers/esm/arrayLikeToArray.js
function _arrayLikeToArray(arr, len) {
  if (len == null || len > arr.length)
    len = arr.length;
  for (var i2 = 0, arr2 = new Array(len); i2 < len; i2++)
    arr2[i2] = arr[i2];
  return arr2;
}

// ../../node_modules/@babel/runtime/helpers/esm/unsupportedIterableToArray.js
function _unsupportedIterableToArray(o2, minLen) {
  if (!o2)
    return;
  if (typeof o2 === "string")
    return _arrayLikeToArray(o2, minLen);
  var n2 = Object.prototype.toString.call(o2).slice(8, -1);
  if (n2 === "Object" && o2.constructor)
    n2 = o2.constructor.name;
  if (n2 === "Map" || n2 === "Set")
    return Array.from(o2);
  if (n2 === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n2))
    return _arrayLikeToArray(o2, minLen);
}

// ../../node_modules/@babel/runtime/helpers/esm/nonIterableRest.js
function _nonIterableRest() {
  throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}

// ../../node_modules/@babel/runtime/helpers/esm/toArray.js
function _toArray(arr) {
  return _arrayWithHoles(arr) || _iterableToArray(arr) || _unsupportedIterableToArray(arr) || _nonIterableRest();
}

// ../../node_modules/i18next/dist/esm/i18next.js
function ownKeys(object, enumerableOnly) {
  var keys = Object.keys(object);
  if (Object.getOwnPropertySymbols) {
    var symbols2 = Object.getOwnPropertySymbols(object);
    if (enumerableOnly) {
      symbols2 = symbols2.filter(function(sym) {
        return Object.getOwnPropertyDescriptor(object, sym).enumerable;
      });
    }
    keys.push.apply(keys, symbols2);
  }
  return keys;
}
function _objectSpread(target) {
  for (var i2 = 1; i2 < arguments.length; i2++) {
    var source = arguments[i2] != null ? arguments[i2] : {};
    if (i2 % 2) {
      ownKeys(Object(source), true).forEach(function(key) {
        _defineProperty(target, key, source[key]);
      });
    } else if (Object.getOwnPropertyDescriptors) {
      Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
    } else {
      ownKeys(Object(source)).forEach(function(key) {
        Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
      });
    }
  }
  return target;
}
var consoleLogger = {
  type: "logger",
  log: function log3(args) {
    this.output("log", args);
  },
  warn: function warn2(args) {
    this.output("warn", args);
  },
  error: function error(args) {
    this.output("error", args);
  },
  output: function output(type2, args) {
    if (console && console[type2])
      console[type2].apply(console, args);
  }
};
var Logger = function() {
  function Logger2(concreteLogger) {
    var options = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
    _classCallCheck(this, Logger2);
    this.init(concreteLogger, options);
  }
  _createClass(Logger2, [{
    key: "init",
    value: function init3(concreteLogger) {
      var options = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
      this.prefix = options.prefix || "i18next:";
      this.logger = concreteLogger || consoleLogger;
      this.options = options;
      this.debug = options.debug;
    }
  }, {
    key: "setDebug",
    value: function setDebug(bool) {
      this.debug = bool;
    }
  }, {
    key: "log",
    value: function log4() {
      for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
        args[_key] = arguments[_key];
      }
      return this.forward(args, "log", "", true);
    }
  }, {
    key: "warn",
    value: function warn3() {
      for (var _len2 = arguments.length, args = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
        args[_key2] = arguments[_key2];
      }
      return this.forward(args, "warn", "", true);
    }
  }, {
    key: "error",
    value: function error2() {
      for (var _len3 = arguments.length, args = new Array(_len3), _key3 = 0; _key3 < _len3; _key3++) {
        args[_key3] = arguments[_key3];
      }
      return this.forward(args, "error", "");
    }
  }, {
    key: "deprecate",
    value: function deprecate() {
      for (var _len4 = arguments.length, args = new Array(_len4), _key4 = 0; _key4 < _len4; _key4++) {
        args[_key4] = arguments[_key4];
      }
      return this.forward(args, "warn", "WARNING DEPRECATED: ", true);
    }
  }, {
    key: "forward",
    value: function forward(args, lvl, prefix, debugOnly) {
      if (debugOnly && !this.debug)
        return null;
      if (typeof args[0] === "string")
        args[0] = "".concat(prefix).concat(this.prefix, " ").concat(args[0]);
      return this.logger[lvl](args);
    }
  }, {
    key: "create",
    value: function create3(moduleName) {
      return new Logger2(this.logger, _objectSpread(_objectSpread({}, {
        prefix: "".concat(this.prefix, ":").concat(moduleName, ":")
      }), this.options));
    }
  }, {
    key: "clone",
    value: function clone(options) {
      options = options || this.options;
      options.prefix = options.prefix || this.prefix;
      return new Logger2(this.logger, options);
    }
  }]);
  return Logger2;
}();
var baseLogger = new Logger();
var EventEmitter = function() {
  function EventEmitter2() {
    _classCallCheck(this, EventEmitter2);
    this.observers = {};
  }
  _createClass(EventEmitter2, [{
    key: "on",
    value: function on2(events, listener) {
      var _this = this;
      events.split(" ").forEach(function(event) {
        _this.observers[event] = _this.observers[event] || [];
        _this.observers[event].push(listener);
      });
      return this;
    }
  }, {
    key: "off",
    value: function off(event, listener) {
      if (!this.observers[event])
        return;
      if (!listener) {
        delete this.observers[event];
        return;
      }
      this.observers[event] = this.observers[event].filter(function(l2) {
        return l2 !== listener;
      });
    }
  }, {
    key: "emit",
    value: function emit(event) {
      for (var _len = arguments.length, args = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
        args[_key - 1] = arguments[_key];
      }
      if (this.observers[event]) {
        var cloned = [].concat(this.observers[event]);
        cloned.forEach(function(observer) {
          observer.apply(void 0, args);
        });
      }
      if (this.observers["*"]) {
        var _cloned = [].concat(this.observers["*"]);
        _cloned.forEach(function(observer) {
          observer.apply(observer, [event].concat(args));
        });
      }
    }
  }]);
  return EventEmitter2;
}();
function defer() {
  var res;
  var rej;
  var promise = new Promise(function(resolve, reject) {
    res = resolve;
    rej = reject;
  });
  promise.resolve = res;
  promise.reject = rej;
  return promise;
}
function makeString(object) {
  if (object == null)
    return "";
  return "" + object;
}
function copy3(a3, s3, t5) {
  a3.forEach(function(m) {
    if (s3[m])
      t5[m] = s3[m];
  });
}
function getLastOfPath(object, path2, Empty) {
  function cleanKey(key2) {
    return key2 && key2.indexOf("###") > -1 ? key2.replace(/###/g, ".") : key2;
  }
  function canNotTraverseDeeper() {
    return !object || typeof object === "string";
  }
  var stack2 = typeof path2 !== "string" ? [].concat(path2) : path2.split(".");
  while (stack2.length > 1) {
    if (canNotTraverseDeeper())
      return {};
    var key = cleanKey(stack2.shift());
    if (!object[key] && Empty)
      object[key] = new Empty();
    if (Object.prototype.hasOwnProperty.call(object, key)) {
      object = object[key];
    } else {
      object = {};
    }
  }
  if (canNotTraverseDeeper())
    return {};
  return {
    obj: object,
    k: cleanKey(stack2.shift())
  };
}
function setPath(object, path2, newValue) {
  var _getLastOfPath = getLastOfPath(object, path2, Object), obj = _getLastOfPath.obj, k3 = _getLastOfPath.k;
  obj[k3] = newValue;
}
function pushPath(object, path2, newValue, concat) {
  var _getLastOfPath2 = getLastOfPath(object, path2, Object), obj = _getLastOfPath2.obj, k3 = _getLastOfPath2.k;
  obj[k3] = obj[k3] || [];
  if (concat)
    obj[k3] = obj[k3].concat(newValue);
  if (!concat)
    obj[k3].push(newValue);
}
function getPath2(object, path2) {
  var _getLastOfPath3 = getLastOfPath(object, path2), obj = _getLastOfPath3.obj, k3 = _getLastOfPath3.k;
  if (!obj)
    return void 0;
  return obj[k3];
}
function getPathWithDefaults(data, defaultData, key) {
  var value = getPath2(data, key);
  if (value !== void 0) {
    return value;
  }
  return getPath2(defaultData, key);
}
function deepExtend(target, source, overwrite) {
  for (var prop in source) {
    if (prop !== "__proto__" && prop !== "constructor") {
      if (prop in target) {
        if (typeof target[prop] === "string" || target[prop] instanceof String || typeof source[prop] === "string" || source[prop] instanceof String) {
          if (overwrite)
            target[prop] = source[prop];
        } else {
          deepExtend(target[prop], source[prop], overwrite);
        }
      } else {
        target[prop] = source[prop];
      }
    }
  }
  return target;
}
function regexEscape(str) {
  return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
}
var _entityMap = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
  "/": "&#x2F;"
};
function escape(data) {
  if (typeof data === "string") {
    return data.replace(/[&<>"'\/]/g, function(s3) {
      return _entityMap[s3];
    });
  }
  return data;
}
var isIE10 = typeof window !== "undefined" && window.navigator && typeof window.navigator.userAgentData === "undefined" && window.navigator.userAgent && window.navigator.userAgent.indexOf("MSIE") > -1;
var chars = [" ", ",", "?", "!", ";"];
function looksLikeObjectPath(key, nsSeparator, keySeparator) {
  nsSeparator = nsSeparator || "";
  keySeparator = keySeparator || "";
  var possibleChars = chars.filter(function(c5) {
    return nsSeparator.indexOf(c5) < 0 && keySeparator.indexOf(c5) < 0;
  });
  if (possibleChars.length === 0)
    return true;
  var r2 = new RegExp("(".concat(possibleChars.map(function(c5) {
    return c5 === "?" ? "\\?" : c5;
  }).join("|"), ")"));
  var matched = !r2.test(key);
  if (!matched) {
    var ki = key.indexOf(keySeparator);
    if (ki > 0 && !r2.test(key.substring(0, ki))) {
      matched = true;
    }
  }
  return matched;
}
function ownKeys$1(object, enumerableOnly) {
  var keys = Object.keys(object);
  if (Object.getOwnPropertySymbols) {
    var symbols2 = Object.getOwnPropertySymbols(object);
    if (enumerableOnly) {
      symbols2 = symbols2.filter(function(sym) {
        return Object.getOwnPropertyDescriptor(object, sym).enumerable;
      });
    }
    keys.push.apply(keys, symbols2);
  }
  return keys;
}
function _objectSpread$1(target) {
  for (var i2 = 1; i2 < arguments.length; i2++) {
    var source = arguments[i2] != null ? arguments[i2] : {};
    if (i2 % 2) {
      ownKeys$1(Object(source), true).forEach(function(key) {
        _defineProperty(target, key, source[key]);
      });
    } else if (Object.getOwnPropertyDescriptors) {
      Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
    } else {
      ownKeys$1(Object(source)).forEach(function(key) {
        Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
      });
    }
  }
  return target;
}
function _createSuper(Derived) {
  var hasNativeReflectConstruct = _isNativeReflectConstruct();
  return function _createSuperInternal() {
    var Super = _getPrototypeOf(Derived), result;
    if (hasNativeReflectConstruct) {
      var NewTarget = _getPrototypeOf(this).constructor;
      result = Reflect.construct(Super, arguments, NewTarget);
    } else {
      result = Super.apply(this, arguments);
    }
    return _possibleConstructorReturn(this, result);
  };
}
function _isNativeReflectConstruct() {
  if (typeof Reflect === "undefined" || !Reflect.construct)
    return false;
  if (Reflect.construct.sham)
    return false;
  if (typeof Proxy === "function")
    return true;
  try {
    Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function() {
    }));
    return true;
  } catch (e) {
    return false;
  }
}
function deepFind(obj, path2) {
  var keySeparator = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : ".";
  if (!obj)
    return void 0;
  if (obj[path2])
    return obj[path2];
  var paths = path2.split(keySeparator);
  var current = obj;
  for (var i2 = 0; i2 < paths.length; ++i2) {
    if (!current)
      return void 0;
    if (typeof current[paths[i2]] === "string" && i2 + 1 < paths.length) {
      return void 0;
    }
    if (current[paths[i2]] === void 0) {
      var j2 = 2;
      var p2 = paths.slice(i2, i2 + j2).join(keySeparator);
      var mix = current[p2];
      while (mix === void 0 && paths.length > i2 + j2) {
        j2++;
        p2 = paths.slice(i2, i2 + j2).join(keySeparator);
        mix = current[p2];
      }
      if (mix === void 0)
        return void 0;
      if (mix === null)
        return null;
      if (path2.endsWith(p2)) {
        if (typeof mix === "string")
          return mix;
        if (p2 && typeof mix[p2] === "string")
          return mix[p2];
      }
      var joinedPath = paths.slice(i2 + j2).join(keySeparator);
      if (joinedPath)
        return deepFind(mix, joinedPath, keySeparator);
      return void 0;
    }
    current = current[paths[i2]];
  }
  return current;
}
var ResourceStore = function(_EventEmitter) {
  _inherits(ResourceStore2, _EventEmitter);
  var _super = _createSuper(ResourceStore2);
  function ResourceStore2(data) {
    var _this;
    var options = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {
      ns: ["translation"],
      defaultNS: "translation"
    };
    _classCallCheck(this, ResourceStore2);
    _this = _super.call(this);
    if (isIE10) {
      EventEmitter.call(_assertThisInitialized(_this));
    }
    _this.data = data || {};
    _this.options = options;
    if (_this.options.keySeparator === void 0) {
      _this.options.keySeparator = ".";
    }
    if (_this.options.ignoreJSONStructure === void 0) {
      _this.options.ignoreJSONStructure = true;
    }
    return _this;
  }
  _createClass(ResourceStore2, [{
    key: "addNamespaces",
    value: function addNamespaces(ns) {
      if (this.options.ns.indexOf(ns) < 0) {
        this.options.ns.push(ns);
      }
    }
  }, {
    key: "removeNamespaces",
    value: function removeNamespaces(ns) {
      var index2 = this.options.ns.indexOf(ns);
      if (index2 > -1) {
        this.options.ns.splice(index2, 1);
      }
    }
  }, {
    key: "getResource",
    value: function getResource(lng, ns, key) {
      var options = arguments.length > 3 && arguments[3] !== void 0 ? arguments[3] : {};
      var keySeparator = options.keySeparator !== void 0 ? options.keySeparator : this.options.keySeparator;
      var ignoreJSONStructure = options.ignoreJSONStructure !== void 0 ? options.ignoreJSONStructure : this.options.ignoreJSONStructure;
      var path2 = [lng, ns];
      if (key && typeof key !== "string")
        path2 = path2.concat(key);
      if (key && typeof key === "string")
        path2 = path2.concat(keySeparator ? key.split(keySeparator) : key);
      if (lng.indexOf(".") > -1) {
        path2 = lng.split(".");
      }
      var result = getPath2(this.data, path2);
      if (result || !ignoreJSONStructure || typeof key !== "string")
        return result;
      return deepFind(this.data && this.data[lng] && this.data[lng][ns], key, keySeparator);
    }
  }, {
    key: "addResource",
    value: function addResource(lng, ns, key, value) {
      var options = arguments.length > 4 && arguments[4] !== void 0 ? arguments[4] : {
        silent: false
      };
      var keySeparator = this.options.keySeparator;
      if (keySeparator === void 0)
        keySeparator = ".";
      var path2 = [lng, ns];
      if (key)
        path2 = path2.concat(keySeparator ? key.split(keySeparator) : key);
      if (lng.indexOf(".") > -1) {
        path2 = lng.split(".");
        value = ns;
        ns = path2[1];
      }
      this.addNamespaces(ns);
      setPath(this.data, path2, value);
      if (!options.silent)
        this.emit("added", lng, ns, key, value);
    }
  }, {
    key: "addResources",
    value: function addResources(lng, ns, resources) {
      var options = arguments.length > 3 && arguments[3] !== void 0 ? arguments[3] : {
        silent: false
      };
      for (var m in resources) {
        if (typeof resources[m] === "string" || Object.prototype.toString.apply(resources[m]) === "[object Array]")
          this.addResource(lng, ns, m, resources[m], {
            silent: true
          });
      }
      if (!options.silent)
        this.emit("added", lng, ns, resources);
    }
  }, {
    key: "addResourceBundle",
    value: function addResourceBundle(lng, ns, resources, deep, overwrite) {
      var options = arguments.length > 5 && arguments[5] !== void 0 ? arguments[5] : {
        silent: false
      };
      var path2 = [lng, ns];
      if (lng.indexOf(".") > -1) {
        path2 = lng.split(".");
        deep = resources;
        resources = ns;
        ns = path2[1];
      }
      this.addNamespaces(ns);
      var pack = getPath2(this.data, path2) || {};
      if (deep) {
        deepExtend(pack, resources, overwrite);
      } else {
        pack = _objectSpread$1(_objectSpread$1({}, pack), resources);
      }
      setPath(this.data, path2, pack);
      if (!options.silent)
        this.emit("added", lng, ns, resources);
    }
  }, {
    key: "removeResourceBundle",
    value: function removeResourceBundle(lng, ns) {
      if (this.hasResourceBundle(lng, ns)) {
        delete this.data[lng][ns];
      }
      this.removeNamespaces(ns);
      this.emit("removed", lng, ns);
    }
  }, {
    key: "hasResourceBundle",
    value: function hasResourceBundle(lng, ns) {
      return this.getResource(lng, ns) !== void 0;
    }
  }, {
    key: "getResourceBundle",
    value: function getResourceBundle(lng, ns) {
      if (!ns)
        ns = this.options.defaultNS;
      if (this.options.compatibilityAPI === "v1")
        return _objectSpread$1(_objectSpread$1({}, {}), this.getResource(lng, ns));
      return this.getResource(lng, ns);
    }
  }, {
    key: "getDataByLanguage",
    value: function getDataByLanguage(lng) {
      return this.data[lng];
    }
  }, {
    key: "hasLanguageSomeTranslations",
    value: function hasLanguageSomeTranslations(lng) {
      var data = this.getDataByLanguage(lng);
      var n2 = data && Object.keys(data) || [];
      return !!n2.find(function(v2) {
        return data[v2] && Object.keys(data[v2]).length > 0;
      });
    }
  }, {
    key: "toJSON",
    value: function toJSON() {
      return this.data;
    }
  }]);
  return ResourceStore2;
}(EventEmitter);
var postProcessor = {
  processors: {},
  addPostProcessor: function addPostProcessor(module) {
    this.processors[module.name] = module;
  },
  handle: function handle(processors, value, key, options, translator) {
    var _this = this;
    processors.forEach(function(processor) {
      if (_this.processors[processor])
        value = _this.processors[processor].process(value, key, options, translator);
    });
    return value;
  }
};
function ownKeys$2(object, enumerableOnly) {
  var keys = Object.keys(object);
  if (Object.getOwnPropertySymbols) {
    var symbols2 = Object.getOwnPropertySymbols(object);
    if (enumerableOnly) {
      symbols2 = symbols2.filter(function(sym) {
        return Object.getOwnPropertyDescriptor(object, sym).enumerable;
      });
    }
    keys.push.apply(keys, symbols2);
  }
  return keys;
}
function _objectSpread$2(target) {
  for (var i2 = 1; i2 < arguments.length; i2++) {
    var source = arguments[i2] != null ? arguments[i2] : {};
    if (i2 % 2) {
      ownKeys$2(Object(source), true).forEach(function(key) {
        _defineProperty(target, key, source[key]);
      });
    } else if (Object.getOwnPropertyDescriptors) {
      Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
    } else {
      ownKeys$2(Object(source)).forEach(function(key) {
        Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
      });
    }
  }
  return target;
}
function _createSuper$1(Derived) {
  var hasNativeReflectConstruct = _isNativeReflectConstruct$1();
  return function _createSuperInternal() {
    var Super = _getPrototypeOf(Derived), result;
    if (hasNativeReflectConstruct) {
      var NewTarget = _getPrototypeOf(this).constructor;
      result = Reflect.construct(Super, arguments, NewTarget);
    } else {
      result = Super.apply(this, arguments);
    }
    return _possibleConstructorReturn(this, result);
  };
}
function _isNativeReflectConstruct$1() {
  if (typeof Reflect === "undefined" || !Reflect.construct)
    return false;
  if (Reflect.construct.sham)
    return false;
  if (typeof Proxy === "function")
    return true;
  try {
    Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function() {
    }));
    return true;
  } catch (e) {
    return false;
  }
}
var checkedLoadedFor = {};
var Translator = function(_EventEmitter) {
  _inherits(Translator2, _EventEmitter);
  var _super = _createSuper$1(Translator2);
  function Translator2(services) {
    var _this;
    var options = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
    _classCallCheck(this, Translator2);
    _this = _super.call(this);
    if (isIE10) {
      EventEmitter.call(_assertThisInitialized(_this));
    }
    copy3(["resourceStore", "languageUtils", "pluralResolver", "interpolator", "backendConnector", "i18nFormat", "utils"], services, _assertThisInitialized(_this));
    _this.options = options;
    if (_this.options.keySeparator === void 0) {
      _this.options.keySeparator = ".";
    }
    _this.logger = baseLogger.create("translator");
    return _this;
  }
  _createClass(Translator2, [{
    key: "changeLanguage",
    value: function changeLanguage2(lng) {
      if (lng)
        this.language = lng;
    }
  }, {
    key: "exists",
    value: function exists2(key) {
      var options = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {
        interpolation: {}
      };
      if (key === void 0 || key === null) {
        return false;
      }
      var resolved = this.resolve(key, options);
      return resolved && resolved.res !== void 0;
    }
  }, {
    key: "extractFromKey",
    value: function extractFromKey(key, options) {
      var nsSeparator = options.nsSeparator !== void 0 ? options.nsSeparator : this.options.nsSeparator;
      if (nsSeparator === void 0)
        nsSeparator = ":";
      var keySeparator = options.keySeparator !== void 0 ? options.keySeparator : this.options.keySeparator;
      var namespaces = options.ns || this.options.defaultNS || [];
      var wouldCheckForNsInKey = nsSeparator && key.indexOf(nsSeparator) > -1;
      var seemsNaturalLanguage = !this.options.userDefinedKeySeparator && !options.keySeparator && !this.options.userDefinedNsSeparator && !options.nsSeparator && !looksLikeObjectPath(key, nsSeparator, keySeparator);
      if (wouldCheckForNsInKey && !seemsNaturalLanguage) {
        var m = key.match(this.interpolator.nestingRegexp);
        if (m && m.length > 0) {
          return {
            key,
            namespaces
          };
        }
        var parts = key.split(nsSeparator);
        if (nsSeparator !== keySeparator || nsSeparator === keySeparator && this.options.ns.indexOf(parts[0]) > -1)
          namespaces = parts.shift();
        key = parts.join(keySeparator);
      }
      if (typeof namespaces === "string")
        namespaces = [namespaces];
      return {
        key,
        namespaces
      };
    }
  }, {
    key: "translate",
    value: function translate(keys, options, lastKey) {
      var _this2 = this;
      if (_typeof(options) !== "object" && this.options.overloadTranslationOptionHandler) {
        options = this.options.overloadTranslationOptionHandler(arguments);
      }
      if (!options)
        options = {};
      if (keys === void 0 || keys === null)
        return "";
      if (!Array.isArray(keys))
        keys = [String(keys)];
      var returnDetails = options.returnDetails !== void 0 ? options.returnDetails : this.options.returnDetails;
      var keySeparator = options.keySeparator !== void 0 ? options.keySeparator : this.options.keySeparator;
      var _this$extractFromKey = this.extractFromKey(keys[keys.length - 1], options), key = _this$extractFromKey.key, namespaces = _this$extractFromKey.namespaces;
      var namespace = namespaces[namespaces.length - 1];
      var lng = options.lng || this.language;
      var appendNamespaceToCIMode = options.appendNamespaceToCIMode || this.options.appendNamespaceToCIMode;
      if (lng && lng.toLowerCase() === "cimode") {
        if (appendNamespaceToCIMode) {
          var nsSeparator = options.nsSeparator || this.options.nsSeparator;
          if (returnDetails) {
            resolved.res = "".concat(namespace).concat(nsSeparator).concat(key);
            return resolved;
          }
          return "".concat(namespace).concat(nsSeparator).concat(key);
        }
        if (returnDetails) {
          resolved.res = key;
          return resolved;
        }
        return key;
      }
      var resolved = this.resolve(keys, options);
      var res = resolved && resolved.res;
      var resUsedKey = resolved && resolved.usedKey || key;
      var resExactUsedKey = resolved && resolved.exactUsedKey || key;
      var resType = Object.prototype.toString.apply(res);
      var noObject = ["[object Number]", "[object Function]", "[object RegExp]"];
      var joinArrays = options.joinArrays !== void 0 ? options.joinArrays : this.options.joinArrays;
      var handleAsObjectInI18nFormat = !this.i18nFormat || this.i18nFormat.handleAsObject;
      var handleAsObject = typeof res !== "string" && typeof res !== "boolean" && typeof res !== "number";
      if (handleAsObjectInI18nFormat && res && handleAsObject && noObject.indexOf(resType) < 0 && !(typeof joinArrays === "string" && resType === "[object Array]")) {
        if (!options.returnObjects && !this.options.returnObjects) {
          if (!this.options.returnedObjectHandler) {
            this.logger.warn("accessing an object - but returnObjects options is not enabled!");
          }
          var r2 = this.options.returnedObjectHandler ? this.options.returnedObjectHandler(resUsedKey, res, _objectSpread$2(_objectSpread$2({}, options), {}, {
            ns: namespaces
          })) : "key '".concat(key, " (").concat(this.language, ")' returned an object instead of string.");
          if (returnDetails) {
            resolved.res = r2;
            return resolved;
          }
          return r2;
        }
        if (keySeparator) {
          var resTypeIsArray = resType === "[object Array]";
          var copy4 = resTypeIsArray ? [] : {};
          var newKeyToUse = resTypeIsArray ? resExactUsedKey : resUsedKey;
          for (var m in res) {
            if (Object.prototype.hasOwnProperty.call(res, m)) {
              var deepKey = "".concat(newKeyToUse).concat(keySeparator).concat(m);
              copy4[m] = this.translate(deepKey, _objectSpread$2(_objectSpread$2({}, options), {
                joinArrays: false,
                ns: namespaces
              }));
              if (copy4[m] === deepKey)
                copy4[m] = res[m];
            }
          }
          res = copy4;
        }
      } else if (handleAsObjectInI18nFormat && typeof joinArrays === "string" && resType === "[object Array]") {
        res = res.join(joinArrays);
        if (res)
          res = this.extendTranslation(res, keys, options, lastKey);
      } else {
        var usedDefault = false;
        var usedKey = false;
        var needsPluralHandling = options.count !== void 0 && typeof options.count !== "string";
        var hasDefaultValue = Translator2.hasDefaultValue(options);
        var defaultValueSuffix = needsPluralHandling ? this.pluralResolver.getSuffix(lng, options.count, options) : "";
        var defaultValue = options["defaultValue".concat(defaultValueSuffix)] || options.defaultValue;
        if (!this.isValidLookup(res) && hasDefaultValue) {
          usedDefault = true;
          res = defaultValue;
        }
        if (!this.isValidLookup(res)) {
          usedKey = true;
          res = key;
        }
        var missingKeyNoValueFallbackToKey = options.missingKeyNoValueFallbackToKey || this.options.missingKeyNoValueFallbackToKey;
        var resForMissing = missingKeyNoValueFallbackToKey && usedKey ? void 0 : res;
        var updateMissing = hasDefaultValue && defaultValue !== res && this.options.updateMissing;
        if (usedKey || usedDefault || updateMissing) {
          this.logger.log(updateMissing ? "updateKey" : "missingKey", lng, namespace, key, updateMissing ? defaultValue : res);
          if (keySeparator) {
            var fk = this.resolve(key, _objectSpread$2(_objectSpread$2({}, options), {}, {
              keySeparator: false
            }));
            if (fk && fk.res)
              this.logger.warn("Seems the loaded translations were in flat JSON format instead of nested. Either set keySeparator: false on init or make sure your translations are published in nested format.");
          }
          var lngs = [];
          var fallbackLngs = this.languageUtils.getFallbackCodes(this.options.fallbackLng, options.lng || this.language);
          if (this.options.saveMissingTo === "fallback" && fallbackLngs && fallbackLngs[0]) {
            for (var i2 = 0; i2 < fallbackLngs.length; i2++) {
              lngs.push(fallbackLngs[i2]);
            }
          } else if (this.options.saveMissingTo === "all") {
            lngs = this.languageUtils.toResolveHierarchy(options.lng || this.language);
          } else {
            lngs.push(options.lng || this.language);
          }
          var send = function send2(l2, k3, specificDefaultValue) {
            var defaultForMissing = hasDefaultValue && specificDefaultValue !== res ? specificDefaultValue : resForMissing;
            if (_this2.options.missingKeyHandler) {
              _this2.options.missingKeyHandler(l2, namespace, k3, defaultForMissing, updateMissing, options);
            } else if (_this2.backendConnector && _this2.backendConnector.saveMissing) {
              _this2.backendConnector.saveMissing(l2, namespace, k3, defaultForMissing, updateMissing, options);
            }
            _this2.emit("missingKey", l2, namespace, k3, res);
          };
          if (this.options.saveMissing) {
            if (this.options.saveMissingPlurals && needsPluralHandling) {
              lngs.forEach(function(language) {
                _this2.pluralResolver.getSuffixes(language, options).forEach(function(suffix) {
                  send([language], key + suffix, options["defaultValue".concat(suffix)] || defaultValue);
                });
              });
            } else {
              send(lngs, key, defaultValue);
            }
          }
        }
        res = this.extendTranslation(res, keys, options, resolved, lastKey);
        if (usedKey && res === key && this.options.appendNamespaceToMissingKey)
          res = "".concat(namespace, ":").concat(key);
        if ((usedKey || usedDefault) && this.options.parseMissingKeyHandler) {
          if (this.options.compatibilityAPI !== "v1") {
            res = this.options.parseMissingKeyHandler(this.options.appendNamespaceToMissingKey ? "".concat(namespace, ":").concat(key) : key, usedDefault ? res : void 0);
          } else {
            res = this.options.parseMissingKeyHandler(res);
          }
        }
      }
      if (returnDetails) {
        resolved.res = res;
        return resolved;
      }
      return res;
    }
  }, {
    key: "extendTranslation",
    value: function extendTranslation(res, key, options, resolved, lastKey) {
      var _this3 = this;
      if (this.i18nFormat && this.i18nFormat.parse) {
        res = this.i18nFormat.parse(res, _objectSpread$2(_objectSpread$2({}, this.options.interpolation.defaultVariables), options), resolved.usedLng, resolved.usedNS, resolved.usedKey, {
          resolved
        });
      } else if (!options.skipInterpolation) {
        if (options.interpolation)
          this.interpolator.init(_objectSpread$2(_objectSpread$2({}, options), {
            interpolation: _objectSpread$2(_objectSpread$2({}, this.options.interpolation), options.interpolation)
          }));
        var skipOnVariables = typeof res === "string" && (options && options.interpolation && options.interpolation.skipOnVariables !== void 0 ? options.interpolation.skipOnVariables : this.options.interpolation.skipOnVariables);
        var nestBef;
        if (skipOnVariables) {
          var nb = res.match(this.interpolator.nestingRegexp);
          nestBef = nb && nb.length;
        }
        var data = options.replace && typeof options.replace !== "string" ? options.replace : options;
        if (this.options.interpolation.defaultVariables)
          data = _objectSpread$2(_objectSpread$2({}, this.options.interpolation.defaultVariables), data);
        res = this.interpolator.interpolate(res, data, options.lng || this.language, options);
        if (skipOnVariables) {
          var na = res.match(this.interpolator.nestingRegexp);
          var nestAft = na && na.length;
          if (nestBef < nestAft)
            options.nest = false;
        }
        if (options.nest !== false)
          res = this.interpolator.nest(res, function() {
            for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
              args[_key] = arguments[_key];
            }
            if (lastKey && lastKey[0] === args[0] && !options.context) {
              _this3.logger.warn("It seems you are nesting recursively key: ".concat(args[0], " in key: ").concat(key[0]));
              return null;
            }
            return _this3.translate.apply(_this3, args.concat([key]));
          }, options);
        if (options.interpolation)
          this.interpolator.reset();
      }
      var postProcess = options.postProcess || this.options.postProcess;
      var postProcessorNames = typeof postProcess === "string" ? [postProcess] : postProcess;
      if (res !== void 0 && res !== null && postProcessorNames && postProcessorNames.length && options.applyPostProcessor !== false) {
        res = postProcessor.handle(postProcessorNames, res, key, this.options && this.options.postProcessPassResolved ? _objectSpread$2({
          i18nResolved: resolved
        }, options) : options, this);
      }
      return res;
    }
  }, {
    key: "resolve",
    value: function resolve(keys) {
      var _this4 = this;
      var options = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
      var found;
      var usedKey;
      var exactUsedKey;
      var usedLng;
      var usedNS;
      if (typeof keys === "string")
        keys = [keys];
      keys.forEach(function(k3) {
        if (_this4.isValidLookup(found))
          return;
        var extracted = _this4.extractFromKey(k3, options);
        var key = extracted.key;
        usedKey = key;
        var namespaces = extracted.namespaces;
        if (_this4.options.fallbackNS)
          namespaces = namespaces.concat(_this4.options.fallbackNS);
        var needsPluralHandling = options.count !== void 0 && typeof options.count !== "string";
        var needsZeroSuffixLookup = needsPluralHandling && !options.ordinal && options.count === 0 && _this4.pluralResolver.shouldUseIntlApi();
        var needsContextHandling = options.context !== void 0 && (typeof options.context === "string" || typeof options.context === "number") && options.context !== "";
        var codes = options.lngs ? options.lngs : _this4.languageUtils.toResolveHierarchy(options.lng || _this4.language, options.fallbackLng);
        namespaces.forEach(function(ns) {
          if (_this4.isValidLookup(found))
            return;
          usedNS = ns;
          if (!checkedLoadedFor["".concat(codes[0], "-").concat(ns)] && _this4.utils && _this4.utils.hasLoadedNamespace && !_this4.utils.hasLoadedNamespace(usedNS)) {
            checkedLoadedFor["".concat(codes[0], "-").concat(ns)] = true;
            _this4.logger.warn('key "'.concat(usedKey, '" for languages "').concat(codes.join(", "), `" won't get resolved as namespace "`).concat(usedNS, '" was not yet loaded'), "This means something IS WRONG in your setup. You access the t function before i18next.init / i18next.loadNamespace / i18next.changeLanguage was done. Wait for the callback or Promise to resolve before accessing it!!!");
          }
          codes.forEach(function(code) {
            if (_this4.isValidLookup(found))
              return;
            usedLng = code;
            var finalKeys = [key];
            if (_this4.i18nFormat && _this4.i18nFormat.addLookupKeys) {
              _this4.i18nFormat.addLookupKeys(finalKeys, key, code, ns, options);
            } else {
              var pluralSuffix;
              if (needsPluralHandling)
                pluralSuffix = _this4.pluralResolver.getSuffix(code, options.count, options);
              var zeroSuffix = "".concat(_this4.options.pluralSeparator, "zero");
              if (needsPluralHandling) {
                finalKeys.push(key + pluralSuffix);
                if (needsZeroSuffixLookup) {
                  finalKeys.push(key + zeroSuffix);
                }
              }
              if (needsContextHandling) {
                var contextKey = "".concat(key).concat(_this4.options.contextSeparator).concat(options.context);
                finalKeys.push(contextKey);
                if (needsPluralHandling) {
                  finalKeys.push(contextKey + pluralSuffix);
                  if (needsZeroSuffixLookup) {
                    finalKeys.push(contextKey + zeroSuffix);
                  }
                }
              }
            }
            var possibleKey;
            while (possibleKey = finalKeys.pop()) {
              if (!_this4.isValidLookup(found)) {
                exactUsedKey = possibleKey;
                found = _this4.getResource(code, ns, possibleKey, options);
              }
            }
          });
        });
      });
      return {
        res: found,
        usedKey,
        exactUsedKey,
        usedLng,
        usedNS
      };
    }
  }, {
    key: "isValidLookup",
    value: function isValidLookup(res) {
      return res !== void 0 && !(!this.options.returnNull && res === null) && !(!this.options.returnEmptyString && res === "");
    }
  }, {
    key: "getResource",
    value: function getResource(code, ns, key) {
      var options = arguments.length > 3 && arguments[3] !== void 0 ? arguments[3] : {};
      if (this.i18nFormat && this.i18nFormat.getResource)
        return this.i18nFormat.getResource(code, ns, key, options);
      return this.resourceStore.getResource(code, ns, key, options);
    }
  }], [{
    key: "hasDefaultValue",
    value: function hasDefaultValue(options) {
      var prefix = "defaultValue";
      for (var option in options) {
        if (Object.prototype.hasOwnProperty.call(options, option) && prefix === option.substring(0, prefix.length) && void 0 !== options[option]) {
          return true;
        }
      }
      return false;
    }
  }]);
  return Translator2;
}(EventEmitter);
function capitalize(string2) {
  return string2.charAt(0).toUpperCase() + string2.slice(1);
}
var LanguageUtil = function() {
  function LanguageUtil2(options) {
    _classCallCheck(this, LanguageUtil2);
    this.options = options;
    this.supportedLngs = this.options.supportedLngs || false;
    this.logger = baseLogger.create("languageUtils");
  }
  _createClass(LanguageUtil2, [{
    key: "getScriptPartFromCode",
    value: function getScriptPartFromCode(code) {
      if (!code || code.indexOf("-") < 0)
        return null;
      var p2 = code.split("-");
      if (p2.length === 2)
        return null;
      p2.pop();
      if (p2[p2.length - 1].toLowerCase() === "x")
        return null;
      return this.formatLanguageCode(p2.join("-"));
    }
  }, {
    key: "getLanguagePartFromCode",
    value: function getLanguagePartFromCode(code) {
      if (!code || code.indexOf("-") < 0)
        return code;
      var p2 = code.split("-");
      return this.formatLanguageCode(p2[0]);
    }
  }, {
    key: "formatLanguageCode",
    value: function formatLanguageCode(code) {
      if (typeof code === "string" && code.indexOf("-") > -1) {
        var specialCases = ["hans", "hant", "latn", "cyrl", "cans", "mong", "arab"];
        var p2 = code.split("-");
        if (this.options.lowerCaseLng) {
          p2 = p2.map(function(part) {
            return part.toLowerCase();
          });
        } else if (p2.length === 2) {
          p2[0] = p2[0].toLowerCase();
          p2[1] = p2[1].toUpperCase();
          if (specialCases.indexOf(p2[1].toLowerCase()) > -1)
            p2[1] = capitalize(p2[1].toLowerCase());
        } else if (p2.length === 3) {
          p2[0] = p2[0].toLowerCase();
          if (p2[1].length === 2)
            p2[1] = p2[1].toUpperCase();
          if (p2[0] !== "sgn" && p2[2].length === 2)
            p2[2] = p2[2].toUpperCase();
          if (specialCases.indexOf(p2[1].toLowerCase()) > -1)
            p2[1] = capitalize(p2[1].toLowerCase());
          if (specialCases.indexOf(p2[2].toLowerCase()) > -1)
            p2[2] = capitalize(p2[2].toLowerCase());
        }
        return p2.join("-");
      }
      return this.options.cleanCode || this.options.lowerCaseLng ? code.toLowerCase() : code;
    }
  }, {
    key: "isSupportedCode",
    value: function isSupportedCode(code) {
      if (this.options.load === "languageOnly" || this.options.nonExplicitSupportedLngs) {
        code = this.getLanguagePartFromCode(code);
      }
      return !this.supportedLngs || !this.supportedLngs.length || this.supportedLngs.indexOf(code) > -1;
    }
  }, {
    key: "getBestMatchFromCodes",
    value: function getBestMatchFromCodes(codes) {
      var _this = this;
      if (!codes)
        return null;
      var found;
      codes.forEach(function(code) {
        if (found)
          return;
        var cleanedLng = _this.formatLanguageCode(code);
        if (!_this.options.supportedLngs || _this.isSupportedCode(cleanedLng))
          found = cleanedLng;
      });
      if (!found && this.options.supportedLngs) {
        codes.forEach(function(code) {
          if (found)
            return;
          var lngOnly = _this.getLanguagePartFromCode(code);
          if (_this.isSupportedCode(lngOnly))
            return found = lngOnly;
          found = _this.options.supportedLngs.find(function(supportedLng) {
            if (supportedLng.indexOf(lngOnly) === 0)
              return supportedLng;
          });
        });
      }
      if (!found)
        found = this.getFallbackCodes(this.options.fallbackLng)[0];
      return found;
    }
  }, {
    key: "getFallbackCodes",
    value: function getFallbackCodes(fallbacks, code) {
      if (!fallbacks)
        return [];
      if (typeof fallbacks === "function")
        fallbacks = fallbacks(code);
      if (typeof fallbacks === "string")
        fallbacks = [fallbacks];
      if (Object.prototype.toString.apply(fallbacks) === "[object Array]")
        return fallbacks;
      if (!code)
        return fallbacks["default"] || [];
      var found = fallbacks[code];
      if (!found)
        found = fallbacks[this.getScriptPartFromCode(code)];
      if (!found)
        found = fallbacks[this.formatLanguageCode(code)];
      if (!found)
        found = fallbacks[this.getLanguagePartFromCode(code)];
      if (!found)
        found = fallbacks["default"];
      return found || [];
    }
  }, {
    key: "toResolveHierarchy",
    value: function toResolveHierarchy(code, fallbackCode) {
      var _this2 = this;
      var fallbackCodes = this.getFallbackCodes(fallbackCode || this.options.fallbackLng || [], code);
      var codes = [];
      var addCode = function addCode2(c5) {
        if (!c5)
          return;
        if (_this2.isSupportedCode(c5)) {
          codes.push(c5);
        } else {
          _this2.logger.warn("rejecting language code not found in supportedLngs: ".concat(c5));
        }
      };
      if (typeof code === "string" && code.indexOf("-") > -1) {
        if (this.options.load !== "languageOnly")
          addCode(this.formatLanguageCode(code));
        if (this.options.load !== "languageOnly" && this.options.load !== "currentOnly")
          addCode(this.getScriptPartFromCode(code));
        if (this.options.load !== "currentOnly")
          addCode(this.getLanguagePartFromCode(code));
      } else if (typeof code === "string") {
        addCode(this.formatLanguageCode(code));
      }
      fallbackCodes.forEach(function(fc) {
        if (codes.indexOf(fc) < 0)
          addCode(_this2.formatLanguageCode(fc));
      });
      return codes;
    }
  }]);
  return LanguageUtil2;
}();
var sets = [{
  lngs: ["ach", "ak", "am", "arn", "br", "fil", "gun", "ln", "mfe", "mg", "mi", "oc", "pt", "pt-BR", "tg", "tl", "ti", "tr", "uz", "wa"],
  nr: [1, 2],
  fc: 1
}, {
  lngs: ["af", "an", "ast", "az", "bg", "bn", "ca", "da", "de", "dev", "el", "en", "eo", "es", "et", "eu", "fi", "fo", "fur", "fy", "gl", "gu", "ha", "hi", "hu", "hy", "ia", "it", "kk", "kn", "ku", "lb", "mai", "ml", "mn", "mr", "nah", "nap", "nb", "ne", "nl", "nn", "no", "nso", "pa", "pap", "pms", "ps", "pt-PT", "rm", "sco", "se", "si", "so", "son", "sq", "sv", "sw", "ta", "te", "tk", "ur", "yo"],
  nr: [1, 2],
  fc: 2
}, {
  lngs: ["ay", "bo", "cgg", "fa", "ht", "id", "ja", "jbo", "ka", "km", "ko", "ky", "lo", "ms", "sah", "su", "th", "tt", "ug", "vi", "wo", "zh"],
  nr: [1],
  fc: 3
}, {
  lngs: ["be", "bs", "cnr", "dz", "hr", "ru", "sr", "uk"],
  nr: [1, 2, 5],
  fc: 4
}, {
  lngs: ["ar"],
  nr: [0, 1, 2, 3, 11, 100],
  fc: 5
}, {
  lngs: ["cs", "sk"],
  nr: [1, 2, 5],
  fc: 6
}, {
  lngs: ["csb", "pl"],
  nr: [1, 2, 5],
  fc: 7
}, {
  lngs: ["cy"],
  nr: [1, 2, 3, 8],
  fc: 8
}, {
  lngs: ["fr"],
  nr: [1, 2],
  fc: 9
}, {
  lngs: ["ga"],
  nr: [1, 2, 3, 7, 11],
  fc: 10
}, {
  lngs: ["gd"],
  nr: [1, 2, 3, 20],
  fc: 11
}, {
  lngs: ["is"],
  nr: [1, 2],
  fc: 12
}, {
  lngs: ["jv"],
  nr: [0, 1],
  fc: 13
}, {
  lngs: ["kw"],
  nr: [1, 2, 3, 4],
  fc: 14
}, {
  lngs: ["lt"],
  nr: [1, 2, 10],
  fc: 15
}, {
  lngs: ["lv"],
  nr: [1, 2, 0],
  fc: 16
}, {
  lngs: ["mk"],
  nr: [1, 2],
  fc: 17
}, {
  lngs: ["mnk"],
  nr: [0, 1, 2],
  fc: 18
}, {
  lngs: ["mt"],
  nr: [1, 2, 11, 20],
  fc: 19
}, {
  lngs: ["or"],
  nr: [2, 1],
  fc: 2
}, {
  lngs: ["ro"],
  nr: [1, 2, 20],
  fc: 20
}, {
  lngs: ["sl"],
  nr: [5, 1, 2, 3],
  fc: 21
}, {
  lngs: ["he", "iw"],
  nr: [1, 2, 20, 21],
  fc: 22
}];
var _rulesPluralsTypes = {
  1: function _(n2) {
    return Number(n2 > 1);
  },
  2: function _2(n2) {
    return Number(n2 != 1);
  },
  3: function _3(n2) {
    return 0;
  },
  4: function _4(n2) {
    return Number(n2 % 10 == 1 && n2 % 100 != 11 ? 0 : n2 % 10 >= 2 && n2 % 10 <= 4 && (n2 % 100 < 10 || n2 % 100 >= 20) ? 1 : 2);
  },
  5: function _5(n2) {
    return Number(n2 == 0 ? 0 : n2 == 1 ? 1 : n2 == 2 ? 2 : n2 % 100 >= 3 && n2 % 100 <= 10 ? 3 : n2 % 100 >= 11 ? 4 : 5);
  },
  6: function _6(n2) {
    return Number(n2 == 1 ? 0 : n2 >= 2 && n2 <= 4 ? 1 : 2);
  },
  7: function _7(n2) {
    return Number(n2 == 1 ? 0 : n2 % 10 >= 2 && n2 % 10 <= 4 && (n2 % 100 < 10 || n2 % 100 >= 20) ? 1 : 2);
  },
  8: function _8(n2) {
    return Number(n2 == 1 ? 0 : n2 == 2 ? 1 : n2 != 8 && n2 != 11 ? 2 : 3);
  },
  9: function _9(n2) {
    return Number(n2 >= 2);
  },
  10: function _10(n2) {
    return Number(n2 == 1 ? 0 : n2 == 2 ? 1 : n2 < 7 ? 2 : n2 < 11 ? 3 : 4);
  },
  11: function _11(n2) {
    return Number(n2 == 1 || n2 == 11 ? 0 : n2 == 2 || n2 == 12 ? 1 : n2 > 2 && n2 < 20 ? 2 : 3);
  },
  12: function _12(n2) {
    return Number(n2 % 10 != 1 || n2 % 100 == 11);
  },
  13: function _13(n2) {
    return Number(n2 !== 0);
  },
  14: function _14(n2) {
    return Number(n2 == 1 ? 0 : n2 == 2 ? 1 : n2 == 3 ? 2 : 3);
  },
  15: function _15(n2) {
    return Number(n2 % 10 == 1 && n2 % 100 != 11 ? 0 : n2 % 10 >= 2 && (n2 % 100 < 10 || n2 % 100 >= 20) ? 1 : 2);
  },
  16: function _16(n2) {
    return Number(n2 % 10 == 1 && n2 % 100 != 11 ? 0 : n2 !== 0 ? 1 : 2);
  },
  17: function _17(n2) {
    return Number(n2 == 1 || n2 % 10 == 1 && n2 % 100 != 11 ? 0 : 1);
  },
  18: function _18(n2) {
    return Number(n2 == 0 ? 0 : n2 == 1 ? 1 : 2);
  },
  19: function _19(n2) {
    return Number(n2 == 1 ? 0 : n2 == 0 || n2 % 100 > 1 && n2 % 100 < 11 ? 1 : n2 % 100 > 10 && n2 % 100 < 20 ? 2 : 3);
  },
  20: function _20(n2) {
    return Number(n2 == 1 ? 0 : n2 == 0 || n2 % 100 > 0 && n2 % 100 < 20 ? 1 : 2);
  },
  21: function _21(n2) {
    return Number(n2 % 100 == 1 ? 1 : n2 % 100 == 2 ? 2 : n2 % 100 == 3 || n2 % 100 == 4 ? 3 : 0);
  },
  22: function _22(n2) {
    return Number(n2 == 1 ? 0 : n2 == 2 ? 1 : (n2 < 0 || n2 > 10) && n2 % 10 == 0 ? 2 : 3);
  }
};
var deprecatedJsonVersions = ["v1", "v2", "v3"];
var suffixesOrder = {
  zero: 0,
  one: 1,
  two: 2,
  few: 3,
  many: 4,
  other: 5
};
function createRules() {
  var rules = {};
  sets.forEach(function(set3) {
    set3.lngs.forEach(function(l2) {
      rules[l2] = {
        numbers: set3.nr,
        plurals: _rulesPluralsTypes[set3.fc]
      };
    });
  });
  return rules;
}
var PluralResolver = function() {
  function PluralResolver2(languageUtils) {
    var options = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
    _classCallCheck(this, PluralResolver2);
    this.languageUtils = languageUtils;
    this.options = options;
    this.logger = baseLogger.create("pluralResolver");
    if ((!this.options.compatibilityJSON || this.options.compatibilityJSON === "v4") && (typeof Intl === "undefined" || !Intl.PluralRules)) {
      this.options.compatibilityJSON = "v3";
      this.logger.error("Your environment seems not to be Intl API compatible, use an Intl.PluralRules polyfill. Will fallback to the compatibilityJSON v3 format handling.");
    }
    this.rules = createRules();
  }
  _createClass(PluralResolver2, [{
    key: "addRule",
    value: function addRule(lng, obj) {
      this.rules[lng] = obj;
    }
  }, {
    key: "getRule",
    value: function getRule(code) {
      var options = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
      if (this.shouldUseIntlApi()) {
        try {
          return new Intl.PluralRules(code, {
            type: options.ordinal ? "ordinal" : "cardinal"
          });
        } catch (_unused) {
          return;
        }
      }
      return this.rules[code] || this.rules[this.languageUtils.getLanguagePartFromCode(code)];
    }
  }, {
    key: "needsPlural",
    value: function needsPlural(code) {
      var options = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
      var rule = this.getRule(code, options);
      if (this.shouldUseIntlApi()) {
        return rule && rule.resolvedOptions().pluralCategories.length > 1;
      }
      return rule && rule.numbers.length > 1;
    }
  }, {
    key: "getPluralFormsOfKey",
    value: function getPluralFormsOfKey(code, key) {
      var options = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : {};
      return this.getSuffixes(code, options).map(function(suffix) {
        return "".concat(key).concat(suffix);
      });
    }
  }, {
    key: "getSuffixes",
    value: function getSuffixes(code) {
      var _this = this;
      var options = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
      var rule = this.getRule(code, options);
      if (!rule) {
        return [];
      }
      if (this.shouldUseIntlApi()) {
        return rule.resolvedOptions().pluralCategories.sort(function(pluralCategory1, pluralCategory2) {
          return suffixesOrder[pluralCategory1] - suffixesOrder[pluralCategory2];
        }).map(function(pluralCategory) {
          return "".concat(_this.options.prepend).concat(pluralCategory);
        });
      }
      return rule.numbers.map(function(number6) {
        return _this.getSuffix(code, number6, options);
      });
    }
  }, {
    key: "getSuffix",
    value: function getSuffix(code, count2) {
      var options = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : {};
      var rule = this.getRule(code, options);
      if (rule) {
        if (this.shouldUseIntlApi()) {
          return "".concat(this.options.prepend).concat(rule.select(count2));
        }
        return this.getSuffixRetroCompatible(rule, count2);
      }
      this.logger.warn("no plural rule found for: ".concat(code));
      return "";
    }
  }, {
    key: "getSuffixRetroCompatible",
    value: function getSuffixRetroCompatible(rule, count2) {
      var _this2 = this;
      var idx = rule.noAbs ? rule.plurals(count2) : rule.plurals(Math.abs(count2));
      var suffix = rule.numbers[idx];
      if (this.options.simplifyPluralSuffix && rule.numbers.length === 2 && rule.numbers[0] === 1) {
        if (suffix === 2) {
          suffix = "plural";
        } else if (suffix === 1) {
          suffix = "";
        }
      }
      var returnSuffix = function returnSuffix2() {
        return _this2.options.prepend && suffix.toString() ? _this2.options.prepend + suffix.toString() : suffix.toString();
      };
      if (this.options.compatibilityJSON === "v1") {
        if (suffix === 1)
          return "";
        if (typeof suffix === "number")
          return "_plural_".concat(suffix.toString());
        return returnSuffix();
      } else if (this.options.compatibilityJSON === "v2") {
        return returnSuffix();
      } else if (this.options.simplifyPluralSuffix && rule.numbers.length === 2 && rule.numbers[0] === 1) {
        return returnSuffix();
      }
      return this.options.prepend && idx.toString() ? this.options.prepend + idx.toString() : idx.toString();
    }
  }, {
    key: "shouldUseIntlApi",
    value: function shouldUseIntlApi() {
      return !deprecatedJsonVersions.includes(this.options.compatibilityJSON);
    }
  }]);
  return PluralResolver2;
}();
function ownKeys$3(object, enumerableOnly) {
  var keys = Object.keys(object);
  if (Object.getOwnPropertySymbols) {
    var symbols2 = Object.getOwnPropertySymbols(object);
    if (enumerableOnly) {
      symbols2 = symbols2.filter(function(sym) {
        return Object.getOwnPropertyDescriptor(object, sym).enumerable;
      });
    }
    keys.push.apply(keys, symbols2);
  }
  return keys;
}
function _objectSpread$3(target) {
  for (var i2 = 1; i2 < arguments.length; i2++) {
    var source = arguments[i2] != null ? arguments[i2] : {};
    if (i2 % 2) {
      ownKeys$3(Object(source), true).forEach(function(key) {
        _defineProperty(target, key, source[key]);
      });
    } else if (Object.getOwnPropertyDescriptors) {
      Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
    } else {
      ownKeys$3(Object(source)).forEach(function(key) {
        Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
      });
    }
  }
  return target;
}
var Interpolator = function() {
  function Interpolator2() {
    var options = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
    _classCallCheck(this, Interpolator2);
    this.logger = baseLogger.create("interpolator");
    this.options = options;
    this.format = options.interpolation && options.interpolation.format || function(value) {
      return value;
    };
    this.init(options);
  }
  _createClass(Interpolator2, [{
    key: "init",
    value: function init3() {
      var options = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
      if (!options.interpolation)
        options.interpolation = {
          escapeValue: true
        };
      var iOpts = options.interpolation;
      this.escape = iOpts.escape !== void 0 ? iOpts.escape : escape;
      this.escapeValue = iOpts.escapeValue !== void 0 ? iOpts.escapeValue : true;
      this.useRawValueToEscape = iOpts.useRawValueToEscape !== void 0 ? iOpts.useRawValueToEscape : false;
      this.prefix = iOpts.prefix ? regexEscape(iOpts.prefix) : iOpts.prefixEscaped || "{{";
      this.suffix = iOpts.suffix ? regexEscape(iOpts.suffix) : iOpts.suffixEscaped || "}}";
      this.formatSeparator = iOpts.formatSeparator ? iOpts.formatSeparator : iOpts.formatSeparator || ",";
      this.unescapePrefix = iOpts.unescapeSuffix ? "" : iOpts.unescapePrefix || "-";
      this.unescapeSuffix = this.unescapePrefix ? "" : iOpts.unescapeSuffix || "";
      this.nestingPrefix = iOpts.nestingPrefix ? regexEscape(iOpts.nestingPrefix) : iOpts.nestingPrefixEscaped || regexEscape("$t(");
      this.nestingSuffix = iOpts.nestingSuffix ? regexEscape(iOpts.nestingSuffix) : iOpts.nestingSuffixEscaped || regexEscape(")");
      this.nestingOptionsSeparator = iOpts.nestingOptionsSeparator ? iOpts.nestingOptionsSeparator : iOpts.nestingOptionsSeparator || ",";
      this.maxReplaces = iOpts.maxReplaces ? iOpts.maxReplaces : 1e3;
      this.alwaysFormat = iOpts.alwaysFormat !== void 0 ? iOpts.alwaysFormat : false;
      this.resetRegExp();
    }
  }, {
    key: "reset",
    value: function reset() {
      if (this.options)
        this.init(this.options);
    }
  }, {
    key: "resetRegExp",
    value: function resetRegExp() {
      var regexpStr = "".concat(this.prefix, "(.+?)").concat(this.suffix);
      this.regexp = new RegExp(regexpStr, "g");
      var regexpUnescapeStr = "".concat(this.prefix).concat(this.unescapePrefix, "(.+?)").concat(this.unescapeSuffix).concat(this.suffix);
      this.regexpUnescape = new RegExp(regexpUnescapeStr, "g");
      var nestingRegexpStr = "".concat(this.nestingPrefix, "(.+?)").concat(this.nestingSuffix);
      this.nestingRegexp = new RegExp(nestingRegexpStr, "g");
    }
  }, {
    key: "interpolate",
    value: function interpolate(str, data, lng, options) {
      var _this = this;
      var match;
      var value;
      var replaces;
      var defaultData = this.options && this.options.interpolation && this.options.interpolation.defaultVariables || {};
      function regexSafe(val) {
        return val.replace(/\$/g, "$$$$");
      }
      var handleFormat = function handleFormat2(key) {
        if (key.indexOf(_this.formatSeparator) < 0) {
          var path2 = getPathWithDefaults(data, defaultData, key);
          return _this.alwaysFormat ? _this.format(path2, void 0, lng, _objectSpread$3(_objectSpread$3(_objectSpread$3({}, options), data), {}, {
            interpolationkey: key
          })) : path2;
        }
        var p2 = key.split(_this.formatSeparator);
        var k3 = p2.shift().trim();
        var f2 = p2.join(_this.formatSeparator).trim();
        return _this.format(getPathWithDefaults(data, defaultData, k3), f2, lng, _objectSpread$3(_objectSpread$3(_objectSpread$3({}, options), data), {}, {
          interpolationkey: k3
        }));
      };
      this.resetRegExp();
      var missingInterpolationHandler = options && options.missingInterpolationHandler || this.options.missingInterpolationHandler;
      var skipOnVariables = options && options.interpolation && options.interpolation.skipOnVariables !== void 0 ? options.interpolation.skipOnVariables : this.options.interpolation.skipOnVariables;
      var todos = [{
        regex: this.regexpUnescape,
        safeValue: function safeValue(val) {
          return regexSafe(val);
        }
      }, {
        regex: this.regexp,
        safeValue: function safeValue(val) {
          return _this.escapeValue ? regexSafe(_this.escape(val)) : regexSafe(val);
        }
      }];
      todos.forEach(function(todo) {
        replaces = 0;
        while (match = todo.regex.exec(str)) {
          var matchedVar = match[1].trim();
          value = handleFormat(matchedVar);
          if (value === void 0) {
            if (typeof missingInterpolationHandler === "function") {
              var temp = missingInterpolationHandler(str, match, options);
              value = typeof temp === "string" ? temp : "";
            } else if (options && options.hasOwnProperty(matchedVar)) {
              value = "";
            } else if (skipOnVariables) {
              value = match[0];
              continue;
            } else {
              _this.logger.warn("missed to pass in variable ".concat(matchedVar, " for interpolating ").concat(str));
              value = "";
            }
          } else if (typeof value !== "string" && !_this.useRawValueToEscape) {
            value = makeString(value);
          }
          var safeValue = todo.safeValue(value);
          str = str.replace(match[0], safeValue);
          if (skipOnVariables) {
            todo.regex.lastIndex += value.length;
            todo.regex.lastIndex -= match[0].length;
          } else {
            todo.regex.lastIndex = 0;
          }
          replaces++;
          if (replaces >= _this.maxReplaces) {
            break;
          }
        }
      });
      return str;
    }
  }, {
    key: "nest",
    value: function nest2(str, fc) {
      var _this2 = this;
      var options = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : {};
      var match;
      var value;
      var clonedOptions = _objectSpread$3({}, options);
      clonedOptions.applyPostProcessor = false;
      delete clonedOptions.defaultValue;
      function handleHasOptions(key, inheritedOptions) {
        var sep = this.nestingOptionsSeparator;
        if (key.indexOf(sep) < 0)
          return key;
        var c5 = key.split(new RegExp("".concat(sep, "[ ]*{")));
        var optionsString = "{".concat(c5[1]);
        key = c5[0];
        optionsString = this.interpolate(optionsString, clonedOptions);
        var matchedSingleQuotes = optionsString.match(/'/g);
        var matchedDoubleQuotes = optionsString.match(/"/g);
        if (matchedSingleQuotes && matchedSingleQuotes.length % 2 === 0 && !matchedDoubleQuotes || matchedDoubleQuotes.length % 2 !== 0) {
          optionsString = optionsString.replace(/'/g, '"');
        }
        try {
          clonedOptions = JSON.parse(optionsString);
          if (inheritedOptions)
            clonedOptions = _objectSpread$3(_objectSpread$3({}, inheritedOptions), clonedOptions);
        } catch (e) {
          this.logger.warn("failed parsing options string in nesting for key ".concat(key), e);
          return "".concat(key).concat(sep).concat(optionsString);
        }
        delete clonedOptions.defaultValue;
        return key;
      }
      while (match = this.nestingRegexp.exec(str)) {
        var formatters = [];
        var doReduce = false;
        if (match[0].indexOf(this.formatSeparator) !== -1 && !/{.*}/.test(match[1])) {
          var r2 = match[1].split(this.formatSeparator).map(function(elem) {
            return elem.trim();
          });
          match[1] = r2.shift();
          formatters = r2;
          doReduce = true;
        }
        value = fc(handleHasOptions.call(this, match[1].trim(), clonedOptions), clonedOptions);
        if (value && match[0] === str && typeof value !== "string")
          return value;
        if (typeof value !== "string")
          value = makeString(value);
        if (!value) {
          this.logger.warn("missed to resolve ".concat(match[1], " for nesting ").concat(str));
          value = "";
        }
        if (doReduce) {
          value = formatters.reduce(function(v2, f2) {
            return _this2.format(v2, f2, options.lng, _objectSpread$3(_objectSpread$3({}, options), {}, {
              interpolationkey: match[1].trim()
            }));
          }, value.trim());
        }
        str = str.replace(match[0], value);
        this.regexp.lastIndex = 0;
      }
      return str;
    }
  }]);
  return Interpolator2;
}();
function ownKeys$4(object, enumerableOnly) {
  var keys = Object.keys(object);
  if (Object.getOwnPropertySymbols) {
    var symbols2 = Object.getOwnPropertySymbols(object);
    if (enumerableOnly) {
      symbols2 = symbols2.filter(function(sym) {
        return Object.getOwnPropertyDescriptor(object, sym).enumerable;
      });
    }
    keys.push.apply(keys, symbols2);
  }
  return keys;
}
function _objectSpread$4(target) {
  for (var i2 = 1; i2 < arguments.length; i2++) {
    var source = arguments[i2] != null ? arguments[i2] : {};
    if (i2 % 2) {
      ownKeys$4(Object(source), true).forEach(function(key) {
        _defineProperty(target, key, source[key]);
      });
    } else if (Object.getOwnPropertyDescriptors) {
      Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
    } else {
      ownKeys$4(Object(source)).forEach(function(key) {
        Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
      });
    }
  }
  return target;
}
function parseFormatStr(formatStr) {
  var formatName = formatStr.toLowerCase().trim();
  var formatOptions = {};
  if (formatStr.indexOf("(") > -1) {
    var p2 = formatStr.split("(");
    formatName = p2[0].toLowerCase().trim();
    var optStr = p2[1].substring(0, p2[1].length - 1);
    if (formatName === "currency" && optStr.indexOf(":") < 0) {
      if (!formatOptions.currency)
        formatOptions.currency = optStr.trim();
    } else if (formatName === "relativetime" && optStr.indexOf(":") < 0) {
      if (!formatOptions.range)
        formatOptions.range = optStr.trim();
    } else {
      var opts = optStr.split(";");
      opts.forEach(function(opt) {
        if (!opt)
          return;
        var _opt$split = opt.split(":"), _opt$split2 = _toArray(_opt$split), key = _opt$split2[0], rest = _opt$split2.slice(1);
        var val = rest.join(":").trim().replace(/^'+|'+$/g, "");
        if (!formatOptions[key.trim()])
          formatOptions[key.trim()] = val;
        if (val === "false")
          formatOptions[key.trim()] = false;
        if (val === "true")
          formatOptions[key.trim()] = true;
        if (!isNaN(val))
          formatOptions[key.trim()] = parseInt(val, 10);
      });
    }
  }
  return {
    formatName,
    formatOptions
  };
}
function createCachedFormatter(fn2) {
  var cache = {};
  return function invokeFormatter(val, lng, options) {
    var key = lng + JSON.stringify(options);
    var formatter = cache[key];
    if (!formatter) {
      formatter = fn2(lng, options);
      cache[key] = formatter;
    }
    return formatter(val);
  };
}
var Formatter = function() {
  function Formatter2() {
    var options = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
    _classCallCheck(this, Formatter2);
    this.logger = baseLogger.create("formatter");
    this.options = options;
    this.formats = {
      number: createCachedFormatter(function(lng, options2) {
        var formatter = new Intl.NumberFormat(lng, options2);
        return function(val) {
          return formatter.format(val);
        };
      }),
      currency: createCachedFormatter(function(lng, options2) {
        var formatter = new Intl.NumberFormat(lng, _objectSpread$4(_objectSpread$4({}, options2), {}, {
          style: "currency"
        }));
        return function(val) {
          return formatter.format(val);
        };
      }),
      datetime: createCachedFormatter(function(lng, options2) {
        var formatter = new Intl.DateTimeFormat(lng, _objectSpread$4({}, options2));
        return function(val) {
          return formatter.format(val);
        };
      }),
      relativetime: createCachedFormatter(function(lng, options2) {
        var formatter = new Intl.RelativeTimeFormat(lng, _objectSpread$4({}, options2));
        return function(val) {
          return formatter.format(val, options2.range || "day");
        };
      }),
      list: createCachedFormatter(function(lng, options2) {
        var formatter = new Intl.ListFormat(lng, _objectSpread$4({}, options2));
        return function(val) {
          return formatter.format(val);
        };
      })
    };
    this.init(options);
  }
  _createClass(Formatter2, [{
    key: "init",
    value: function init3(services) {
      var options = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {
        interpolation: {}
      };
      var iOpts = options.interpolation;
      this.formatSeparator = iOpts.formatSeparator ? iOpts.formatSeparator : iOpts.formatSeparator || ",";
    }
  }, {
    key: "add",
    value: function add2(name, fc) {
      this.formats[name.toLowerCase().trim()] = fc;
    }
  }, {
    key: "addCached",
    value: function addCached(name, fc) {
      this.formats[name.toLowerCase().trim()] = createCachedFormatter(fc);
    }
  }, {
    key: "format",
    value: function format3(value, _format, lng, options) {
      var _this = this;
      var formats = _format.split(this.formatSeparator);
      var result = formats.reduce(function(mem, f2) {
        var _parseFormatStr = parseFormatStr(f2), formatName = _parseFormatStr.formatName, formatOptions = _parseFormatStr.formatOptions;
        if (_this.formats[formatName]) {
          var formatted = mem;
          try {
            var valOptions = options && options.formatParams && options.formatParams[options.interpolationkey] || {};
            var l2 = valOptions.locale || valOptions.lng || options.locale || options.lng || lng;
            formatted = _this.formats[formatName](mem, l2, _objectSpread$4(_objectSpread$4(_objectSpread$4({}, formatOptions), options), valOptions));
          } catch (error2) {
            _this.logger.warn(error2);
          }
          return formatted;
        } else {
          _this.logger.warn("there was no format function for ".concat(formatName));
        }
        return mem;
      }, value);
      return result;
    }
  }]);
  return Formatter2;
}();
function ownKeys$5(object, enumerableOnly) {
  var keys = Object.keys(object);
  if (Object.getOwnPropertySymbols) {
    var symbols2 = Object.getOwnPropertySymbols(object);
    if (enumerableOnly) {
      symbols2 = symbols2.filter(function(sym) {
        return Object.getOwnPropertyDescriptor(object, sym).enumerable;
      });
    }
    keys.push.apply(keys, symbols2);
  }
  return keys;
}
function _objectSpread$5(target) {
  for (var i2 = 1; i2 < arguments.length; i2++) {
    var source = arguments[i2] != null ? arguments[i2] : {};
    if (i2 % 2) {
      ownKeys$5(Object(source), true).forEach(function(key) {
        _defineProperty(target, key, source[key]);
      });
    } else if (Object.getOwnPropertyDescriptors) {
      Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
    } else {
      ownKeys$5(Object(source)).forEach(function(key) {
        Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
      });
    }
  }
  return target;
}
function _createSuper$2(Derived) {
  var hasNativeReflectConstruct = _isNativeReflectConstruct$2();
  return function _createSuperInternal() {
    var Super = _getPrototypeOf(Derived), result;
    if (hasNativeReflectConstruct) {
      var NewTarget = _getPrototypeOf(this).constructor;
      result = Reflect.construct(Super, arguments, NewTarget);
    } else {
      result = Super.apply(this, arguments);
    }
    return _possibleConstructorReturn(this, result);
  };
}
function _isNativeReflectConstruct$2() {
  if (typeof Reflect === "undefined" || !Reflect.construct)
    return false;
  if (Reflect.construct.sham)
    return false;
  if (typeof Proxy === "function")
    return true;
  try {
    Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function() {
    }));
    return true;
  } catch (e) {
    return false;
  }
}
function removePending(q2, name) {
  if (q2.pending[name] !== void 0) {
    delete q2.pending[name];
    q2.pendingCount--;
  }
}
var Connector = function(_EventEmitter) {
  _inherits(Connector2, _EventEmitter);
  var _super = _createSuper$2(Connector2);
  function Connector2(backend, store, services) {
    var _this;
    var options = arguments.length > 3 && arguments[3] !== void 0 ? arguments[3] : {};
    _classCallCheck(this, Connector2);
    _this = _super.call(this);
    if (isIE10) {
      EventEmitter.call(_assertThisInitialized(_this));
    }
    _this.backend = backend;
    _this.store = store;
    _this.services = services;
    _this.languageUtils = services.languageUtils;
    _this.options = options;
    _this.logger = baseLogger.create("backendConnector");
    _this.waitingReads = [];
    _this.maxParallelReads = options.maxParallelReads || 10;
    _this.readingCalls = 0;
    _this.maxRetries = options.maxRetries >= 0 ? options.maxRetries : 5;
    _this.retryTimeout = options.retryTimeout >= 1 ? options.retryTimeout : 350;
    _this.state = {};
    _this.queue = [];
    if (_this.backend && _this.backend.init) {
      _this.backend.init(services, options.backend, options);
    }
    return _this;
  }
  _createClass(Connector2, [{
    key: "queueLoad",
    value: function queueLoad(languages, namespaces, options, callback) {
      var _this2 = this;
      var toLoad = {};
      var pending = {};
      var toLoadLanguages = {};
      var toLoadNamespaces = {};
      languages.forEach(function(lng) {
        var hasAllNamespaces = true;
        namespaces.forEach(function(ns) {
          var name = "".concat(lng, "|").concat(ns);
          if (!options.reload && _this2.store.hasResourceBundle(lng, ns)) {
            _this2.state[name] = 2;
          } else if (_this2.state[name] < 0)
            ;
          else if (_this2.state[name] === 1) {
            if (pending[name] === void 0)
              pending[name] = true;
          } else {
            _this2.state[name] = 1;
            hasAllNamespaces = false;
            if (pending[name] === void 0)
              pending[name] = true;
            if (toLoad[name] === void 0)
              toLoad[name] = true;
            if (toLoadNamespaces[ns] === void 0)
              toLoadNamespaces[ns] = true;
          }
        });
        if (!hasAllNamespaces)
          toLoadLanguages[lng] = true;
      });
      if (Object.keys(toLoad).length || Object.keys(pending).length) {
        this.queue.push({
          pending,
          pendingCount: Object.keys(pending).length,
          loaded: {},
          errors: [],
          callback
        });
      }
      return {
        toLoad: Object.keys(toLoad),
        pending: Object.keys(pending),
        toLoadLanguages: Object.keys(toLoadLanguages),
        toLoadNamespaces: Object.keys(toLoadNamespaces)
      };
    }
  }, {
    key: "loaded",
    value: function loaded(name, err, data) {
      var s3 = name.split("|");
      var lng = s3[0];
      var ns = s3[1];
      if (err)
        this.emit("failedLoading", lng, ns, err);
      if (data) {
        this.store.addResourceBundle(lng, ns, data);
      }
      this.state[name] = err ? -1 : 2;
      var loaded2 = {};
      this.queue.forEach(function(q2) {
        pushPath(q2.loaded, [lng], ns);
        removePending(q2, name);
        if (err)
          q2.errors.push(err);
        if (q2.pendingCount === 0 && !q2.done) {
          Object.keys(q2.loaded).forEach(function(l2) {
            if (!loaded2[l2])
              loaded2[l2] = {};
            var loadedKeys = q2.loaded[l2];
            if (loadedKeys.length) {
              loadedKeys.forEach(function(ns2) {
                if (loaded2[l2][ns2] === void 0)
                  loaded2[l2][ns2] = true;
              });
            }
          });
          q2.done = true;
          if (q2.errors.length) {
            q2.callback(q2.errors);
          } else {
            q2.callback();
          }
        }
      });
      this.emit("loaded", loaded2);
      this.queue = this.queue.filter(function(q2) {
        return !q2.done;
      });
    }
  }, {
    key: "read",
    value: function read(lng, ns, fcName) {
      var _this3 = this;
      var tried = arguments.length > 3 && arguments[3] !== void 0 ? arguments[3] : 0;
      var wait = arguments.length > 4 && arguments[4] !== void 0 ? arguments[4] : this.retryTimeout;
      var callback = arguments.length > 5 ? arguments[5] : void 0;
      if (!lng.length)
        return callback(null, {});
      if (this.readingCalls >= this.maxParallelReads) {
        this.waitingReads.push({
          lng,
          ns,
          fcName,
          tried,
          wait,
          callback
        });
        return;
      }
      this.readingCalls++;
      return this.backend[fcName](lng, ns, function(err, data) {
        _this3.readingCalls--;
        if (_this3.waitingReads.length > 0) {
          var next = _this3.waitingReads.shift();
          _this3.read(next.lng, next.ns, next.fcName, next.tried, next.wait, next.callback);
        }
        if (err && data && tried < _this3.maxRetries) {
          setTimeout(function() {
            _this3.read.call(_this3, lng, ns, fcName, tried + 1, wait * 2, callback);
          }, wait);
          return;
        }
        callback(err, data);
      });
    }
  }, {
    key: "prepareLoading",
    value: function prepareLoading(languages, namespaces) {
      var _this4 = this;
      var options = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : {};
      var callback = arguments.length > 3 ? arguments[3] : void 0;
      if (!this.backend) {
        this.logger.warn("No backend was added via i18next.use. Will not load resources.");
        return callback && callback();
      }
      if (typeof languages === "string")
        languages = this.languageUtils.toResolveHierarchy(languages);
      if (typeof namespaces === "string")
        namespaces = [namespaces];
      var toLoad = this.queueLoad(languages, namespaces, options, callback);
      if (!toLoad.toLoad.length) {
        if (!toLoad.pending.length)
          callback();
        return null;
      }
      toLoad.toLoad.forEach(function(name) {
        _this4.loadOne(name);
      });
    }
  }, {
    key: "load",
    value: function load(languages, namespaces, callback) {
      this.prepareLoading(languages, namespaces, {}, callback);
    }
  }, {
    key: "reload",
    value: function reload(languages, namespaces, callback) {
      this.prepareLoading(languages, namespaces, {
        reload: true
      }, callback);
    }
  }, {
    key: "loadOne",
    value: function loadOne(name) {
      var _this5 = this;
      var prefix = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : "";
      var s3 = name.split("|");
      var lng = s3[0];
      var ns = s3[1];
      this.read(lng, ns, "read", void 0, void 0, function(err, data) {
        if (err)
          _this5.logger.warn("".concat(prefix, "loading namespace ").concat(ns, " for language ").concat(lng, " failed"), err);
        if (!err && data)
          _this5.logger.log("".concat(prefix, "loaded namespace ").concat(ns, " for language ").concat(lng), data);
        _this5.loaded(name, err, data);
      });
    }
  }, {
    key: "saveMissing",
    value: function saveMissing(languages, namespace, key, fallbackValue, isUpdate) {
      var options = arguments.length > 5 && arguments[5] !== void 0 ? arguments[5] : {};
      if (this.services.utils && this.services.utils.hasLoadedNamespace && !this.services.utils.hasLoadedNamespace(namespace)) {
        this.logger.warn('did not save key "'.concat(key, '" as the namespace "').concat(namespace, '" was not yet loaded'), "This means something IS WRONG in your setup. You access the t function before i18next.init / i18next.loadNamespace / i18next.changeLanguage was done. Wait for the callback or Promise to resolve before accessing it!!!");
        return;
      }
      if (key === void 0 || key === null || key === "")
        return;
      if (this.backend && this.backend.create) {
        this.backend.create(languages, namespace, key, fallbackValue, null, _objectSpread$5(_objectSpread$5({}, options), {}, {
          isUpdate
        }));
      }
      if (!languages || !languages[0])
        return;
      this.store.addResource(languages[0], namespace, key, fallbackValue);
    }
  }]);
  return Connector2;
}(EventEmitter);
function get3() {
  return {
    debug: false,
    initImmediate: true,
    ns: ["translation"],
    defaultNS: ["translation"],
    fallbackLng: ["dev"],
    fallbackNS: false,
    supportedLngs: false,
    nonExplicitSupportedLngs: false,
    load: "all",
    preload: false,
    simplifyPluralSuffix: true,
    keySeparator: ".",
    nsSeparator: ":",
    pluralSeparator: "_",
    contextSeparator: "_",
    partialBundledLanguages: false,
    saveMissing: false,
    updateMissing: false,
    saveMissingTo: "fallback",
    saveMissingPlurals: true,
    missingKeyHandler: false,
    missingInterpolationHandler: false,
    postProcess: false,
    postProcessPassResolved: false,
    returnNull: true,
    returnEmptyString: true,
    returnObjects: false,
    joinArrays: false,
    returnedObjectHandler: false,
    parseMissingKeyHandler: false,
    appendNamespaceToMissingKey: false,
    appendNamespaceToCIMode: false,
    overloadTranslationOptionHandler: function handle2(args) {
      var ret = {};
      if (_typeof(args[1]) === "object")
        ret = args[1];
      if (typeof args[1] === "string")
        ret.defaultValue = args[1];
      if (typeof args[2] === "string")
        ret.tDescription = args[2];
      if (_typeof(args[2]) === "object" || _typeof(args[3]) === "object") {
        var options = args[3] || args[2];
        Object.keys(options).forEach(function(key) {
          ret[key] = options[key];
        });
      }
      return ret;
    },
    interpolation: {
      escapeValue: true,
      format: function format3(value, _format, lng, options) {
        return value;
      },
      prefix: "{{",
      suffix: "}}",
      formatSeparator: ",",
      unescapePrefix: "-",
      nestingPrefix: "$t(",
      nestingSuffix: ")",
      nestingOptionsSeparator: ",",
      maxReplaces: 1e3,
      skipOnVariables: true
    }
  };
}
function transformOptions(options) {
  if (typeof options.ns === "string")
    options.ns = [options.ns];
  if (typeof options.fallbackLng === "string")
    options.fallbackLng = [options.fallbackLng];
  if (typeof options.fallbackNS === "string")
    options.fallbackNS = [options.fallbackNS];
  if (options.supportedLngs && options.supportedLngs.indexOf("cimode") < 0) {
    options.supportedLngs = options.supportedLngs.concat(["cimode"]);
  }
  return options;
}
function ownKeys$6(object, enumerableOnly) {
  var keys = Object.keys(object);
  if (Object.getOwnPropertySymbols) {
    var symbols2 = Object.getOwnPropertySymbols(object);
    if (enumerableOnly) {
      symbols2 = symbols2.filter(function(sym) {
        return Object.getOwnPropertyDescriptor(object, sym).enumerable;
      });
    }
    keys.push.apply(keys, symbols2);
  }
  return keys;
}
function _objectSpread$6(target) {
  for (var i2 = 1; i2 < arguments.length; i2++) {
    var source = arguments[i2] != null ? arguments[i2] : {};
    if (i2 % 2) {
      ownKeys$6(Object(source), true).forEach(function(key) {
        _defineProperty(target, key, source[key]);
      });
    } else if (Object.getOwnPropertyDescriptors) {
      Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
    } else {
      ownKeys$6(Object(source)).forEach(function(key) {
        Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
      });
    }
  }
  return target;
}
function _createSuper$3(Derived) {
  var hasNativeReflectConstruct = _isNativeReflectConstruct$3();
  return function _createSuperInternal() {
    var Super = _getPrototypeOf(Derived), result;
    if (hasNativeReflectConstruct) {
      var NewTarget = _getPrototypeOf(this).constructor;
      result = Reflect.construct(Super, arguments, NewTarget);
    } else {
      result = Super.apply(this, arguments);
    }
    return _possibleConstructorReturn(this, result);
  };
}
function _isNativeReflectConstruct$3() {
  if (typeof Reflect === "undefined" || !Reflect.construct)
    return false;
  if (Reflect.construct.sham)
    return false;
  if (typeof Proxy === "function")
    return true;
  try {
    Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function() {
    }));
    return true;
  } catch (e) {
    return false;
  }
}
function noop3() {
}
function bindMemberFunctions(inst) {
  var mems = Object.getOwnPropertyNames(Object.getPrototypeOf(inst));
  mems.forEach(function(mem) {
    if (typeof inst[mem] === "function") {
      inst[mem] = inst[mem].bind(inst);
    }
  });
}
var I18n = function(_EventEmitter) {
  _inherits(I18n2, _EventEmitter);
  var _super = _createSuper$3(I18n2);
  function I18n2() {
    var _this;
    var options = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
    var callback = arguments.length > 1 ? arguments[1] : void 0;
    _classCallCheck(this, I18n2);
    _this = _super.call(this);
    if (isIE10) {
      EventEmitter.call(_assertThisInitialized(_this));
    }
    _this.options = transformOptions(options);
    _this.services = {};
    _this.logger = baseLogger;
    _this.modules = {
      external: []
    };
    bindMemberFunctions(_assertThisInitialized(_this));
    if (callback && !_this.isInitialized && !options.isClone) {
      if (!_this.options.initImmediate) {
        _this.init(options, callback);
        return _possibleConstructorReturn(_this, _assertThisInitialized(_this));
      }
      setTimeout(function() {
        _this.init(options, callback);
      }, 0);
    }
    return _this;
  }
  _createClass(I18n2, [{
    key: "init",
    value: function init3() {
      var _this2 = this;
      var options = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
      var callback = arguments.length > 1 ? arguments[1] : void 0;
      if (typeof options === "function") {
        callback = options;
        options = {};
      }
      if (!options.defaultNS && options.defaultNS !== false && options.ns) {
        if (typeof options.ns === "string") {
          options.defaultNS = options.ns;
        } else if (options.ns.indexOf("translation") < 0) {
          options.defaultNS = options.ns[0];
        }
      }
      var defOpts = get3();
      this.options = _objectSpread$6(_objectSpread$6(_objectSpread$6({}, defOpts), this.options), transformOptions(options));
      if (this.options.compatibilityAPI !== "v1") {
        this.options.interpolation = _objectSpread$6(_objectSpread$6({}, defOpts.interpolation), this.options.interpolation);
      }
      if (options.keySeparator !== void 0) {
        this.options.userDefinedKeySeparator = options.keySeparator;
      }
      if (options.nsSeparator !== void 0) {
        this.options.userDefinedNsSeparator = options.nsSeparator;
      }
      function createClassOnDemand(ClassOrObject) {
        if (!ClassOrObject)
          return null;
        if (typeof ClassOrObject === "function")
          return new ClassOrObject();
        return ClassOrObject;
      }
      if (!this.options.isClone) {
        if (this.modules.logger) {
          baseLogger.init(createClassOnDemand(this.modules.logger), this.options);
        } else {
          baseLogger.init(null, this.options);
        }
        var formatter;
        if (this.modules.formatter) {
          formatter = this.modules.formatter;
        } else if (typeof Intl !== "undefined") {
          formatter = Formatter;
        }
        var lu = new LanguageUtil(this.options);
        this.store = new ResourceStore(this.options.resources, this.options);
        var s3 = this.services;
        s3.logger = baseLogger;
        s3.resourceStore = this.store;
        s3.languageUtils = lu;
        s3.pluralResolver = new PluralResolver(lu, {
          prepend: this.options.pluralSeparator,
          compatibilityJSON: this.options.compatibilityJSON,
          simplifyPluralSuffix: this.options.simplifyPluralSuffix
        });
        if (formatter && (!this.options.interpolation.format || this.options.interpolation.format === defOpts.interpolation.format)) {
          s3.formatter = createClassOnDemand(formatter);
          s3.formatter.init(s3, this.options);
          this.options.interpolation.format = s3.formatter.format.bind(s3.formatter);
        }
        s3.interpolator = new Interpolator(this.options);
        s3.utils = {
          hasLoadedNamespace: this.hasLoadedNamespace.bind(this)
        };
        s3.backendConnector = new Connector(createClassOnDemand(this.modules.backend), s3.resourceStore, s3, this.options);
        s3.backendConnector.on("*", function(event) {
          for (var _len = arguments.length, args = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
            args[_key - 1] = arguments[_key];
          }
          _this2.emit.apply(_this2, [event].concat(args));
        });
        if (this.modules.languageDetector) {
          s3.languageDetector = createClassOnDemand(this.modules.languageDetector);
          s3.languageDetector.init(s3, this.options.detection, this.options);
        }
        if (this.modules.i18nFormat) {
          s3.i18nFormat = createClassOnDemand(this.modules.i18nFormat);
          if (s3.i18nFormat.init)
            s3.i18nFormat.init(this);
        }
        this.translator = new Translator(this.services, this.options);
        this.translator.on("*", function(event) {
          for (var _len2 = arguments.length, args = new Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
            args[_key2 - 1] = arguments[_key2];
          }
          _this2.emit.apply(_this2, [event].concat(args));
        });
        this.modules.external.forEach(function(m) {
          if (m.init)
            m.init(_this2);
        });
      }
      this.format = this.options.interpolation.format;
      if (!callback)
        callback = noop3;
      if (this.options.fallbackLng && !this.services.languageDetector && !this.options.lng) {
        var codes = this.services.languageUtils.getFallbackCodes(this.options.fallbackLng);
        if (codes.length > 0 && codes[0] !== "dev")
          this.options.lng = codes[0];
      }
      if (!this.services.languageDetector && !this.options.lng) {
        this.logger.warn("init: no languageDetector is used and no lng is defined");
      }
      var storeApi = ["getResource", "hasResourceBundle", "getResourceBundle", "getDataByLanguage"];
      storeApi.forEach(function(fcName) {
        _this2[fcName] = function() {
          var _this2$store;
          return (_this2$store = _this2.store)[fcName].apply(_this2$store, arguments);
        };
      });
      var storeApiChained = ["addResource", "addResources", "addResourceBundle", "removeResourceBundle"];
      storeApiChained.forEach(function(fcName) {
        _this2[fcName] = function() {
          var _this2$store2;
          (_this2$store2 = _this2.store)[fcName].apply(_this2$store2, arguments);
          return _this2;
        };
      });
      var deferred = defer();
      var load = function load2() {
        var finish = function finish2(err, t5) {
          if (_this2.isInitialized && !_this2.initializedStoreOnce)
            _this2.logger.warn("init: i18next is already initialized. You should call init just once!");
          _this2.isInitialized = true;
          if (!_this2.options.isClone)
            _this2.logger.log("initialized", _this2.options);
          _this2.emit("initialized", _this2.options);
          deferred.resolve(t5);
          callback(err, t5);
        };
        if (_this2.languages && _this2.options.compatibilityAPI !== "v1" && !_this2.isInitialized)
          return finish(null, _this2.t.bind(_this2));
        _this2.changeLanguage(_this2.options.lng, finish);
      };
      if (this.options.resources || !this.options.initImmediate) {
        load();
      } else {
        setTimeout(load, 0);
      }
      return deferred;
    }
  }, {
    key: "loadResources",
    value: function loadResources2(language) {
      var _this3 = this;
      var callback = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : noop3;
      var usedCallback = callback;
      var usedLng = typeof language === "string" ? language : this.language;
      if (typeof language === "function")
        usedCallback = language;
      if (!this.options.resources || this.options.partialBundledLanguages) {
        if (usedLng && usedLng.toLowerCase() === "cimode")
          return usedCallback();
        var toLoad = [];
        var append3 = function append4(lng) {
          if (!lng)
            return;
          var lngs = _this3.services.languageUtils.toResolveHierarchy(lng);
          lngs.forEach(function(l2) {
            if (toLoad.indexOf(l2) < 0)
              toLoad.push(l2);
          });
        };
        if (!usedLng) {
          var fallbacks = this.services.languageUtils.getFallbackCodes(this.options.fallbackLng);
          fallbacks.forEach(function(l2) {
            return append3(l2);
          });
        } else {
          append3(usedLng);
        }
        if (this.options.preload) {
          this.options.preload.forEach(function(l2) {
            return append3(l2);
          });
        }
        this.services.backendConnector.load(toLoad, this.options.ns, function(e) {
          if (!e && !_this3.resolvedLanguage && _this3.language)
            _this3.setResolvedLanguage(_this3.language);
          usedCallback(e);
        });
      } else {
        usedCallback(null);
      }
    }
  }, {
    key: "reloadResources",
    value: function reloadResources2(lngs, ns, callback) {
      var deferred = defer();
      if (!lngs)
        lngs = this.languages;
      if (!ns)
        ns = this.options.ns;
      if (!callback)
        callback = noop3;
      this.services.backendConnector.reload(lngs, ns, function(err) {
        deferred.resolve();
        callback(err);
      });
      return deferred;
    }
  }, {
    key: "use",
    value: function use2(module) {
      if (!module)
        throw new Error("You are passing an undefined module! Please check the object you are passing to i18next.use()");
      if (!module.type)
        throw new Error("You are passing a wrong module! Please check the object you are passing to i18next.use()");
      if (module.type === "backend") {
        this.modules.backend = module;
      }
      if (module.type === "logger" || module.log && module.warn && module.error) {
        this.modules.logger = module;
      }
      if (module.type === "languageDetector") {
        this.modules.languageDetector = module;
      }
      if (module.type === "i18nFormat") {
        this.modules.i18nFormat = module;
      }
      if (module.type === "postProcessor") {
        postProcessor.addPostProcessor(module);
      }
      if (module.type === "formatter") {
        this.modules.formatter = module;
      }
      if (module.type === "3rdParty") {
        this.modules.external.push(module);
      }
      return this;
    }
  }, {
    key: "setResolvedLanguage",
    value: function setResolvedLanguage(l2) {
      if (!l2 || !this.languages)
        return;
      if (["cimode", "dev"].indexOf(l2) > -1)
        return;
      for (var li = 0; li < this.languages.length; li++) {
        var lngInLngs = this.languages[li];
        if (["cimode", "dev"].indexOf(lngInLngs) > -1)
          continue;
        if (this.store.hasLanguageSomeTranslations(lngInLngs)) {
          this.resolvedLanguage = lngInLngs;
          break;
        }
      }
    }
  }, {
    key: "changeLanguage",
    value: function changeLanguage2(lng, callback) {
      var _this4 = this;
      this.isLanguageChangingTo = lng;
      var deferred = defer();
      this.emit("languageChanging", lng);
      var setLngProps = function setLngProps2(l2) {
        _this4.language = l2;
        _this4.languages = _this4.services.languageUtils.toResolveHierarchy(l2);
        _this4.resolvedLanguage = void 0;
        _this4.setResolvedLanguage(l2);
      };
      var done = function done2(err, l2) {
        if (l2) {
          setLngProps(l2);
          _this4.translator.changeLanguage(l2);
          _this4.isLanguageChangingTo = void 0;
          _this4.emit("languageChanged", l2);
          _this4.logger.log("languageChanged", l2);
        } else {
          _this4.isLanguageChangingTo = void 0;
        }
        deferred.resolve(function() {
          return _this4.t.apply(_this4, arguments);
        });
        if (callback)
          callback(err, function() {
            return _this4.t.apply(_this4, arguments);
          });
      };
      var setLng = function setLng2(lngs) {
        if (!lng && !lngs && _this4.services.languageDetector)
          lngs = [];
        var l2 = typeof lngs === "string" ? lngs : _this4.services.languageUtils.getBestMatchFromCodes(lngs);
        if (l2) {
          if (!_this4.language) {
            setLngProps(l2);
          }
          if (!_this4.translator.language)
            _this4.translator.changeLanguage(l2);
          if (_this4.services.languageDetector)
            _this4.services.languageDetector.cacheUserLanguage(l2);
        }
        _this4.loadResources(l2, function(err) {
          done(err, l2);
        });
      };
      if (!lng && this.services.languageDetector && !this.services.languageDetector.async) {
        setLng(this.services.languageDetector.detect());
      } else if (!lng && this.services.languageDetector && this.services.languageDetector.async) {
        this.services.languageDetector.detect(setLng);
      } else {
        setLng(lng);
      }
      return deferred;
    }
  }, {
    key: "getFixedT",
    value: function getFixedT2(lng, ns, keyPrefix) {
      var _this5 = this;
      var fixedT = function fixedT2(key, opts) {
        var options;
        if (_typeof(opts) !== "object") {
          for (var _len3 = arguments.length, rest = new Array(_len3 > 2 ? _len3 - 2 : 0), _key3 = 2; _key3 < _len3; _key3++) {
            rest[_key3 - 2] = arguments[_key3];
          }
          options = _this5.options.overloadTranslationOptionHandler([key, opts].concat(rest));
        } else {
          options = _objectSpread$6({}, opts);
        }
        options.lng = options.lng || fixedT2.lng;
        options.lngs = options.lngs || fixedT2.lngs;
        options.ns = options.ns || fixedT2.ns;
        options.keyPrefix = options.keyPrefix || keyPrefix || fixedT2.keyPrefix;
        var keySeparator = _this5.options.keySeparator || ".";
        var resultKey = options.keyPrefix ? "".concat(options.keyPrefix).concat(keySeparator).concat(key) : key;
        return _this5.t(resultKey, options);
      };
      if (typeof lng === "string") {
        fixedT.lng = lng;
      } else {
        fixedT.lngs = lng;
      }
      fixedT.ns = ns;
      fixedT.keyPrefix = keyPrefix;
      return fixedT;
    }
  }, {
    key: "t",
    value: function t5() {
      var _this$translator;
      return this.translator && (_this$translator = this.translator).translate.apply(_this$translator, arguments);
    }
  }, {
    key: "exists",
    value: function exists2() {
      var _this$translator2;
      return this.translator && (_this$translator2 = this.translator).exists.apply(_this$translator2, arguments);
    }
  }, {
    key: "setDefaultNamespace",
    value: function setDefaultNamespace2(ns) {
      this.options.defaultNS = ns;
    }
  }, {
    key: "hasLoadedNamespace",
    value: function hasLoadedNamespace2(ns) {
      var _this6 = this;
      var options = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
      if (!this.isInitialized) {
        this.logger.warn("hasLoadedNamespace: i18next was not initialized", this.languages);
        return false;
      }
      if (!this.languages || !this.languages.length) {
        this.logger.warn("hasLoadedNamespace: i18n.languages were undefined or empty", this.languages);
        return false;
      }
      var lng = this.resolvedLanguage || this.languages[0];
      var fallbackLng = this.options ? this.options.fallbackLng : false;
      var lastLng = this.languages[this.languages.length - 1];
      if (lng.toLowerCase() === "cimode")
        return true;
      var loadNotPending = function loadNotPending2(l2, n2) {
        var loadState = _this6.services.backendConnector.state["".concat(l2, "|").concat(n2)];
        return loadState === -1 || loadState === 2;
      };
      if (options.precheck) {
        var preResult = options.precheck(this, loadNotPending);
        if (preResult !== void 0)
          return preResult;
      }
      if (this.hasResourceBundle(lng, ns))
        return true;
      if (!this.services.backendConnector.backend || this.options.resources && !this.options.partialBundledLanguages)
        return true;
      if (loadNotPending(lng, ns) && (!fallbackLng || loadNotPending(lastLng, ns)))
        return true;
      return false;
    }
  }, {
    key: "loadNamespaces",
    value: function loadNamespaces2(ns, callback) {
      var _this7 = this;
      var deferred = defer();
      if (!this.options.ns) {
        callback && callback();
        return Promise.resolve();
      }
      if (typeof ns === "string")
        ns = [ns];
      ns.forEach(function(n2) {
        if (_this7.options.ns.indexOf(n2) < 0)
          _this7.options.ns.push(n2);
      });
      this.loadResources(function(err) {
        deferred.resolve();
        if (callback)
          callback(err);
      });
      return deferred;
    }
  }, {
    key: "loadLanguages",
    value: function loadLanguages2(lngs, callback) {
      var deferred = defer();
      if (typeof lngs === "string")
        lngs = [lngs];
      var preloaded = this.options.preload || [];
      var newLngs = lngs.filter(function(lng) {
        return preloaded.indexOf(lng) < 0;
      });
      if (!newLngs.length) {
        if (callback)
          callback();
        return Promise.resolve();
      }
      this.options.preload = preloaded.concat(newLngs);
      this.loadResources(function(err) {
        deferred.resolve();
        if (callback)
          callback(err);
      });
      return deferred;
    }
  }, {
    key: "dir",
    value: function dir(lng) {
      if (!lng)
        lng = this.resolvedLanguage || (this.languages && this.languages.length > 0 ? this.languages[0] : this.language);
      if (!lng)
        return "rtl";
      var rtlLngs = ["ar", "shu", "sqr", "ssh", "xaa", "yhd", "yud", "aao", "abh", "abv", "acm", "acq", "acw", "acx", "acy", "adf", "ads", "aeb", "aec", "afb", "ajp", "apc", "apd", "arb", "arq", "ars", "ary", "arz", "auz", "avl", "ayh", "ayl", "ayn", "ayp", "bbz", "pga", "he", "iw", "ps", "pbt", "pbu", "pst", "prp", "prd", "ug", "ur", "ydd", "yds", "yih", "ji", "yi", "hbo", "men", "xmn", "fa", "jpr", "peo", "pes", "prs", "dv", "sam", "ckb"];
      return rtlLngs.indexOf(this.services.languageUtils.getLanguagePartFromCode(lng)) > -1 || lng.toLowerCase().indexOf("-arab") > 1 ? "rtl" : "ltr";
    }
  }, {
    key: "cloneInstance",
    value: function cloneInstance() {
      var _this8 = this;
      var options = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
      var callback = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : noop3;
      var mergedOptions = _objectSpread$6(_objectSpread$6(_objectSpread$6({}, this.options), options), {
        isClone: true
      });
      var clone = new I18n2(mergedOptions);
      if (options.debug !== void 0 || options.prefix !== void 0) {
        clone.logger = clone.logger.clone(options);
      }
      var membersToCopy = ["store", "services", "language"];
      membersToCopy.forEach(function(m) {
        clone[m] = _this8[m];
      });
      clone.services = _objectSpread$6({}, this.services);
      clone.services.utils = {
        hasLoadedNamespace: clone.hasLoadedNamespace.bind(clone)
      };
      clone.translator = new Translator(clone.services, clone.options);
      clone.translator.on("*", function(event) {
        for (var _len4 = arguments.length, args = new Array(_len4 > 1 ? _len4 - 1 : 0), _key4 = 1; _key4 < _len4; _key4++) {
          args[_key4 - 1] = arguments[_key4];
        }
        clone.emit.apply(clone, [event].concat(args));
      });
      clone.init(mergedOptions, callback);
      clone.translator.options = clone.options;
      clone.translator.backendConnector.services.utils = {
        hasLoadedNamespace: clone.hasLoadedNamespace.bind(clone)
      };
      return clone;
    }
  }, {
    key: "toJSON",
    value: function toJSON() {
      return {
        options: this.options,
        store: this.store,
        language: this.language,
        languages: this.languages,
        resolvedLanguage: this.resolvedLanguage
      };
    }
  }]);
  return I18n2;
}(EventEmitter);
_defineProperty(I18n, "createInstance", function() {
  var options = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
  var callback = arguments.length > 1 ? arguments[1] : void 0;
  return new I18n(options, callback);
});
var instance = I18n.createInstance();
instance.createInstance = I18n.createInstance;
var createInstance = instance.createInstance;
var init2 = instance.init;
var loadResources = instance.loadResources;
var reloadResources = instance.reloadResources;
var use = instance.use;
var changeLanguage = instance.changeLanguage;
var getFixedT = instance.getFixedT;
var t = instance.t;
var exists = instance.exists;
var setDefaultNamespace = instance.setDefaultNamespace;
var hasLoadedNamespace = instance.hasLoadedNamespace;
var loadNamespaces = instance.loadNamespaces;
var loadLanguages = instance.loadLanguages;

// ../graphic-walker/dist/utils/index.js
function getMeaAggName(meaName, agg) {
  if (!agg || agg === "expr") {
    return meaName;
  }
  return `${agg}(${meaName})`;
}
function getMeaAggKey(meaKey, agg) {
  if (!agg || agg === "expr") {
    return meaKey;
  }
  return `${meaKey}_${agg}`;
}

// ../graphic-walker/dist/vis/spec/aggregate.js
function channelAggregate(encoding, fields) {
  Object.values(encoding).forEach((c5) => {
    if (c5.aggregate === null)
      return;
    const targetField = fields.find((f2) => encodeFid(f2.fid) === c5.field && (f2.analyticType === "measure" || f2.fid === COUNT_FIELD_ID));
    if (targetField && targetField.fid === COUNT_FIELD_ID) {
      if (!targetField.titleOverride) {
        c5.title = "Count";
      }
      c5.field = encodeFid(getMeaAggKey(targetField.fid, targetField.aggName));
    } else if (targetField) {
      if (!targetField.titleOverride) {
        c5.title = getMeaAggName(targetField.name, targetField.aggName);
      }
      c5.field = encodeFid(getMeaAggKey(targetField.fid, targetField.aggName));
    }
  });
}

// ../graphic-walker/dist/vis/spec/stack.js
function channelStack(encoding, stackMode) {
  if (stackMode === "stack" || stackMode === "zero")
    return;
  let stackValue = stackMode === "none" ? null : stackMode;
  const stackableChannels = ["x", "y", "theta", "radius"];
  for (let ch of stackableChannels) {
    if (encoding[ch] && encoding[ch].type === "quantitative") {
      encoding[ch].stack = stackValue;
    }
  }
}

// ../../node_modules/immer/dist/immer.esm.mjs
function n(n2) {
  for (var r2 = arguments.length, t5 = Array(r2 > 1 ? r2 - 1 : 0), e = 1; e < r2; e++)
    t5[e - 1] = arguments[e];
  if (true) {
    var i2 = Y3[n2], o2 = i2 ? "function" == typeof i2 ? i2.apply(null, t5) : i2 : "unknown error nr: " + n2;
    throw Error("[Immer] " + o2);
  }
  throw Error("[Immer] minified error nr: " + n2 + (t5.length ? " " + t5.map(function(n3) {
    return "'" + n3 + "'";
  }).join(",") : "") + ". Find the full error at: https://bit.ly/3cXEKWf");
}
function r(n2) {
  return !!n2 && !!n2[Q];
}
function t4(n2) {
  var r2;
  return !!n2 && (function(n3) {
    if (!n3 || "object" != typeof n3)
      return false;
    var r3 = Object.getPrototypeOf(n3);
    if (null === r3)
      return true;
    var t5 = Object.hasOwnProperty.call(r3, "constructor") && r3.constructor;
    return t5 === Object || "function" == typeof t5 && Function.toString.call(t5) === Z;
  }(n2) || Array.isArray(n2) || !!n2[L] || !!(null === (r2 = n2.constructor) || void 0 === r2 ? void 0 : r2[L]) || s2(n2) || v(n2));
}
function i(n2, r2, t5) {
  void 0 === t5 && (t5 = false), 0 === o(n2) ? (t5 ? Object.keys : nn)(n2).forEach(function(e) {
    t5 && "symbol" == typeof e || r2(e, n2[e], n2);
  }) : n2.forEach(function(t6, e) {
    return r2(e, t6, n2);
  });
}
function o(n2) {
  var r2 = n2[Q];
  return r2 ? r2.i > 3 ? r2.i - 4 : r2.i : Array.isArray(n2) ? 1 : s2(n2) ? 2 : v(n2) ? 3 : 0;
}
function u(n2, r2) {
  return 2 === o(n2) ? n2.has(r2) : Object.prototype.hasOwnProperty.call(n2, r2);
}
function a2(n2, r2) {
  return 2 === o(n2) ? n2.get(r2) : n2[r2];
}
function f(n2, r2, t5) {
  var e = o(n2);
  2 === e ? n2.set(r2, t5) : 3 === e ? n2.add(t5) : n2[r2] = t5;
}
function c4(n2, r2) {
  return n2 === r2 ? 0 !== n2 || 1 / n2 == 1 / r2 : n2 != n2 && r2 != r2;
}
function s2(n2) {
  return X3 && n2 instanceof Map;
}
function v(n2) {
  return q && n2 instanceof Set;
}
function p(n2) {
  return n2.o || n2.t;
}
function l(n2) {
  if (Array.isArray(n2))
    return Array.prototype.slice.call(n2);
  var r2 = rn(n2);
  delete r2[Q];
  for (var t5 = nn(r2), e = 0; e < t5.length; e++) {
    var i2 = t5[e], o2 = r2[i2];
    false === o2.writable && (o2.writable = true, o2.configurable = true), (o2.get || o2.set) && (r2[i2] = { configurable: true, writable: true, enumerable: o2.enumerable, value: n2[i2] });
  }
  return Object.create(Object.getPrototypeOf(n2), r2);
}
function d(n2, e) {
  return void 0 === e && (e = false), y2(n2) || r(n2) || !t4(n2) || (o(n2) > 1 && (n2.set = n2.add = n2.clear = n2.delete = h), Object.freeze(n2), e && i(n2, function(n3, r2) {
    return d(r2, true);
  }, true)), n2;
}
function h() {
  n(2);
}
function y2(n2) {
  return null == n2 || "object" != typeof n2 || Object.isFrozen(n2);
}
function b(r2) {
  var t5 = tn[r2];
  return t5 || n(18, r2), t5;
}
function _23() {
  return U || n(0), U;
}
function j(n2, r2) {
  r2 && (b("Patches"), n2.u = [], n2.s = [], n2.v = r2);
}
function g(n2) {
  O(n2), n2.p.forEach(S), n2.p = null;
}
function O(n2) {
  n2 === U && (U = n2.l);
}
function w(n2) {
  return U = { p: [], l: U, h: n2, m: true, _: 0 };
}
function S(n2) {
  var r2 = n2[Q];
  0 === r2.i || 1 === r2.i ? r2.j() : r2.g = true;
}
function P(r2, e) {
  e._ = e.p.length;
  var i2 = e.p[0], o2 = void 0 !== r2 && r2 !== i2;
  return e.h.O || b("ES5").S(e, r2, o2), o2 ? (i2[Q].P && (g(e), n(4)), t4(r2) && (r2 = M2(e, r2), e.l || x2(e, r2)), e.u && b("Patches").M(i2[Q].t, r2, e.u, e.s)) : r2 = M2(e, i2, []), g(e), e.u && e.v(e.u, e.s), r2 !== H ? r2 : void 0;
}
function M2(n2, r2, t5) {
  if (y2(r2))
    return r2;
  var e = r2[Q];
  if (!e)
    return i(r2, function(i2, o3) {
      return A5(n2, e, r2, i2, o3, t5);
    }, true), r2;
  if (e.A !== n2)
    return r2;
  if (!e.P)
    return x2(n2, e.t, true), e.t;
  if (!e.I) {
    e.I = true, e.A._--;
    var o2 = 4 === e.i || 5 === e.i ? e.o = l(e.k) : e.o, u2 = o2, a3 = false;
    3 === e.i && (u2 = new Set(o2), o2.clear(), a3 = true), i(u2, function(r3, i2) {
      return A5(n2, e, o2, r3, i2, t5, a3);
    }), x2(n2, o2, false), t5 && n2.u && b("Patches").N(e, t5, n2.u, n2.s);
  }
  return e.o;
}
function A5(e, i2, o2, a3, c5, s3, v2) {
  if (c5 === o2 && n(5), r(c5)) {
    var p2 = M2(e, c5, s3 && i2 && 3 !== i2.i && !u(i2.R, a3) ? s3.concat(a3) : void 0);
    if (f(o2, a3, p2), !r(p2))
      return;
    e.m = false;
  } else
    v2 && o2.add(c5);
  if (t4(c5) && !y2(c5)) {
    if (!e.h.D && e._ < 1)
      return;
    M2(e, c5), i2 && i2.A.l || x2(e, c5);
  }
}
function x2(n2, r2, t5) {
  void 0 === t5 && (t5 = false), !n2.l && n2.h.D && n2.m && d(r2, t5);
}
function z(n2, r2) {
  var t5 = n2[Q];
  return (t5 ? p(t5) : n2)[r2];
}
function I(n2, r2) {
  if (r2 in n2)
    for (var t5 = Object.getPrototypeOf(n2); t5; ) {
      var e = Object.getOwnPropertyDescriptor(t5, r2);
      if (e)
        return e;
      t5 = Object.getPrototypeOf(t5);
    }
}
function k2(n2) {
  n2.P || (n2.P = true, n2.l && k2(n2.l));
}
function E2(n2) {
  n2.o || (n2.o = l(n2.t));
}
function N(n2, r2, t5) {
  var e = s2(r2) ? b("MapSet").F(r2, t5) : v(r2) ? b("MapSet").T(r2, t5) : n2.O ? function(n3, r3) {
    var t6 = Array.isArray(n3), e3 = { i: t6 ? 1 : 0, A: r3 ? r3.A : _23(), P: false, I: false, R: {}, l: r3, t: n3, k: null, o: null, j: null, C: false }, i2 = e3, o2 = en;
    t6 && (i2 = [e3], o2 = on);
    var u2 = Proxy.revocable(i2, o2), a3 = u2.revoke, f2 = u2.proxy;
    return e3.k = f2, e3.j = a3, f2;
  }(r2, t5) : b("ES5").J(r2, t5);
  return (t5 ? t5.A : _23()).p.push(e), e;
}
function R(e) {
  return r(e) || n(22, e), function n2(r2) {
    if (!t4(r2))
      return r2;
    var e3, u2 = r2[Q], c5 = o(r2);
    if (u2) {
      if (!u2.P && (u2.i < 4 || !b("ES5").K(u2)))
        return u2.t;
      u2.I = true, e3 = D2(r2, c5), u2.I = false;
    } else
      e3 = D2(r2, c5);
    return i(e3, function(r3, t5) {
      u2 && a2(u2.t, r3) === t5 || f(e3, r3, n2(t5));
    }), 3 === c5 ? new Set(e3) : e3;
  }(e);
}
function D2(n2, r2) {
  switch (r2) {
    case 2:
      return new Map(n2);
    case 3:
      return Array.from(n2);
  }
  return l(n2);
}
var G;
var U;
var W = "undefined" != typeof Symbol && "symbol" == typeof Symbol("x");
var X3 = "undefined" != typeof Map;
var q = "undefined" != typeof Set;
var B2 = "undefined" != typeof Proxy && void 0 !== Proxy.revocable && "undefined" != typeof Reflect;
var H = W ? Symbol.for("immer-nothing") : ((G = {})["immer-nothing"] = true, G);
var L = W ? Symbol.for("immer-draftable") : "__$immer_draftable";
var Q = W ? Symbol.for("immer-state") : "__$immer_state";
var Y3 = { 0: "Illegal state", 1: "Immer drafts cannot have computed properties", 2: "This object has been frozen and should not be mutated", 3: function(n2) {
  return "Cannot use a proxy that has been revoked. Did you pass an object from inside an immer function to an async process? " + n2;
}, 4: "An immer producer returned a new value *and* modified its draft. Either return a new value *or* modify the draft.", 5: "Immer forbids circular references", 6: "The first or second argument to `produce` must be a function", 7: "The third argument to `produce` must be a function or undefined", 8: "First argument to `createDraft` must be a plain object, an array, or an immerable object", 9: "First argument to `finishDraft` must be a draft returned by `createDraft`", 10: "The given draft is already finalized", 11: "Object.defineProperty() cannot be used on an Immer draft", 12: "Object.setPrototypeOf() cannot be used on an Immer draft", 13: "Immer only supports deleting array indices", 14: "Immer only supports setting array indices and the 'length' property", 15: function(n2) {
  return "Cannot apply patch, path doesn't resolve: " + n2;
}, 16: 'Sets cannot have "replace" patches.', 17: function(n2) {
  return "Unsupported patch operation: " + n2;
}, 18: function(n2) {
  return "The plugin for '" + n2 + "' has not been loaded into Immer. To enable the plugin, import and call `enable" + n2 + "()` when initializing your application.";
}, 20: "Cannot use proxies if Proxy, Proxy.revocable or Reflect are not available", 21: function(n2) {
  return "produce can only be called on things that are draftable: plain objects, arrays, Map, Set or classes that are marked with '[immerable]: true'. Got '" + n2 + "'";
}, 22: function(n2) {
  return "'current' expects a draft, got: " + n2;
}, 23: function(n2) {
  return "'original' expects a draft, got: " + n2;
}, 24: "Patching reserved attributes like __proto__, prototype and constructor is not allowed" };
var Z = "" + Object.prototype.constructor;
var nn = "undefined" != typeof Reflect && Reflect.ownKeys ? Reflect.ownKeys : void 0 !== Object.getOwnPropertySymbols ? function(n2) {
  return Object.getOwnPropertyNames(n2).concat(Object.getOwnPropertySymbols(n2));
} : Object.getOwnPropertyNames;
var rn = Object.getOwnPropertyDescriptors || function(n2) {
  var r2 = {};
  return nn(n2).forEach(function(t5) {
    r2[t5] = Object.getOwnPropertyDescriptor(n2, t5);
  }), r2;
};
var tn = {};
var en = { get: function(n2, r2) {
  if (r2 === Q)
    return n2;
  var e = p(n2);
  if (!u(e, r2))
    return function(n3, r3, t5) {
      var e3, i3 = I(r3, t5);
      return i3 ? "value" in i3 ? i3.value : null === (e3 = i3.get) || void 0 === e3 ? void 0 : e3.call(n3.k) : void 0;
    }(n2, e, r2);
  var i2 = e[r2];
  return n2.I || !t4(i2) ? i2 : i2 === z(n2.t, r2) ? (E2(n2), n2.o[r2] = N(n2.A.h, i2, n2)) : i2;
}, has: function(n2, r2) {
  return r2 in p(n2);
}, ownKeys: function(n2) {
  return Reflect.ownKeys(p(n2));
}, set: function(n2, r2, t5) {
  var e = I(p(n2), r2);
  if (null == e ? void 0 : e.set)
    return e.set.call(n2.k, t5), true;
  if (!n2.P) {
    var i2 = z(p(n2), r2), o2 = null == i2 ? void 0 : i2[Q];
    if (o2 && o2.t === t5)
      return n2.o[r2] = t5, n2.R[r2] = false, true;
    if (c4(t5, i2) && (void 0 !== t5 || u(n2.t, r2)))
      return true;
    E2(n2), k2(n2);
  }
  return n2.o[r2] === t5 && (void 0 !== t5 || r2 in n2.o) || Number.isNaN(t5) && Number.isNaN(n2.o[r2]) || (n2.o[r2] = t5, n2.R[r2] = true), true;
}, deleteProperty: function(n2, r2) {
  return void 0 !== z(n2.t, r2) || r2 in n2.t ? (n2.R[r2] = false, E2(n2), k2(n2)) : delete n2.R[r2], n2.o && delete n2.o[r2], true;
}, getOwnPropertyDescriptor: function(n2, r2) {
  var t5 = p(n2), e = Reflect.getOwnPropertyDescriptor(t5, r2);
  return e ? { writable: true, configurable: 1 !== n2.i || "length" !== r2, enumerable: e.enumerable, value: t5[r2] } : e;
}, defineProperty: function() {
  n(11);
}, getPrototypeOf: function(n2) {
  return Object.getPrototypeOf(n2.t);
}, setPrototypeOf: function() {
  n(12);
} };
var on = {};
i(en, function(n2, r2) {
  on[n2] = function() {
    return arguments[0] = arguments[0][0], r2.apply(this, arguments);
  };
}), on.deleteProperty = function(r2, t5) {
  return isNaN(parseInt(t5)) && n(13), on.set.call(this, r2, t5, void 0);
}, on.set = function(r2, t5, e) {
  return "length" !== t5 && isNaN(parseInt(t5)) && n(14), en.set.call(this, r2[0], t5, e, r2[0]);
};
var un = function() {
  function e(r2) {
    var e3 = this;
    this.O = B2, this.D = true, this.produce = function(r3, i3, o2) {
      if ("function" == typeof r3 && "function" != typeof i3) {
        var u2 = i3;
        i3 = r3;
        var a3 = e3;
        return function(n2) {
          var r4 = this;
          void 0 === n2 && (n2 = u2);
          for (var t5 = arguments.length, e4 = Array(t5 > 1 ? t5 - 1 : 0), o3 = 1; o3 < t5; o3++)
            e4[o3 - 1] = arguments[o3];
          return a3.produce(n2, function(n3) {
            var t6;
            return (t6 = i3).call.apply(t6, [r4, n3].concat(e4));
          });
        };
      }
      var f2;
      if ("function" != typeof i3 && n(6), void 0 !== o2 && "function" != typeof o2 && n(7), t4(r3)) {
        var c5 = w(e3), s3 = N(e3, r3, void 0), v2 = true;
        try {
          f2 = i3(s3), v2 = false;
        } finally {
          v2 ? g(c5) : O(c5);
        }
        return "undefined" != typeof Promise && f2 instanceof Promise ? f2.then(function(n2) {
          return j(c5, o2), P(n2, c5);
        }, function(n2) {
          throw g(c5), n2;
        }) : (j(c5, o2), P(f2, c5));
      }
      if (!r3 || "object" != typeof r3) {
        if (void 0 === (f2 = i3(r3)) && (f2 = r3), f2 === H && (f2 = void 0), e3.D && d(f2, true), o2) {
          var p2 = [], l2 = [];
          b("Patches").M(r3, f2, p2, l2), o2(p2, l2);
        }
        return f2;
      }
      n(21, r3);
    }, this.produceWithPatches = function(n2, r3) {
      if ("function" == typeof n2)
        return function(r4) {
          for (var t6 = arguments.length, i4 = Array(t6 > 1 ? t6 - 1 : 0), o3 = 1; o3 < t6; o3++)
            i4[o3 - 1] = arguments[o3];
          return e3.produceWithPatches(r4, function(r5) {
            return n2.apply(void 0, [r5].concat(i4));
          });
        };
      var t5, i3, o2 = e3.produce(n2, r3, function(n3, r4) {
        t5 = n3, i3 = r4;
      });
      return "undefined" != typeof Promise && o2 instanceof Promise ? o2.then(function(n3) {
        return [n3, t5, i3];
      }) : [o2, t5, i3];
    }, "boolean" == typeof (null == r2 ? void 0 : r2.useProxies) && this.setUseProxies(r2.useProxies), "boolean" == typeof (null == r2 ? void 0 : r2.autoFreeze) && this.setAutoFreeze(r2.autoFreeze);
  }
  var i2 = e.prototype;
  return i2.createDraft = function(e3) {
    t4(e3) || n(8), r(e3) && (e3 = R(e3));
    var i3 = w(this), o2 = N(this, e3, void 0);
    return o2[Q].C = true, O(i3), o2;
  }, i2.finishDraft = function(r2, t5) {
    var e3 = r2 && r2[Q];
    e3 && e3.C || n(9), e3.I && n(10);
    var i3 = e3.A;
    return j(i3, t5), P(void 0, i3);
  }, i2.setAutoFreeze = function(n2) {
    this.D = n2;
  }, i2.setUseProxies = function(r2) {
    r2 && !B2 && n(20), this.O = r2;
  }, i2.applyPatches = function(n2, t5) {
    var e3;
    for (e3 = t5.length - 1; e3 >= 0; e3--) {
      var i3 = t5[e3];
      if (0 === i3.path.length && "replace" === i3.op) {
        n2 = i3.value;
        break;
      }
    }
    e3 > -1 && (t5 = t5.slice(e3 + 1));
    var o2 = b("Patches").$;
    return r(n2) ? o2(n2, t5) : this.produce(n2, function(n3) {
      return o2(n3, t5);
    });
  }, e;
}();
var an = new un();
var fn = an.produce;
var cn = an.produceWithPatches.bind(an);
var sn = an.setAutoFreeze.bind(an);
var vn = an.setUseProxies.bind(an);
var pn = an.applyPatches.bind(an);
var ln = an.createDraft.bind(an);
var dn = an.finishDraft.bind(an);

// ../graphic-walker/dist/vis/spec/tooltip.js
function addTooltipEncode(encoding, details = [], defaultAggregated = false) {
  const encs = Object.keys(encoding).filter((ck) => ck !== "tooltip" && ck !== "x2" && ck !== "y2").map((ck) => {
    return fn({
      field: encoding[ck].field.replace("[0]", ""),
      type: encoding[ck].type,
      title: encoding[ck].title
    }, (draft) => {
      if (encoding[ck].timeUnit && !encoding[ck].format) {
        draft.timeUnit = encoding[ck].timeUnit;
      }
      if (encoding[ck].scale) {
        draft.scale = encoding[ck].scale;
      }
      if (encoding[ck].formatType) {
        draft.formatType = encoding[ck].formatType;
      }
      if (encoding[ck].format) {
        draft.format = encoding[ck].format;
      }
    });
  }).concat(details.map((f2) => ({
    field: defaultAggregated && f2.analyticType === "measure" ? getMeaAggKey(f2.fid, f2.aggName) : f2.fid,
    title: defaultAggregated && f2.analyticType === "measure" ? getMeaAggName(f2.name, f2.aggName) : f2.name,
    type: f2.semanticType
  })));
  encoding.tooltip = encs;
}

// ../graphic-walker/dist/lib/inferMeta.js
var COMMON_TIME_FORMAT = [
  /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/,
  /^(0[1-9]|1[0-2])\/(0[1-9]|[12][0-9]|3[01])\/\d{4}$/,
  /^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/\d{4}$/,
  /^\d{4}\/(0[1-9]|1[0-2])\/(0[1-9]|[12][0-9]|3[01])$/,
  /^\d{4}\.(0[1-9]|1[0-2])\.(0[1-9]|[12][0-9]|3[01])$/,
  /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])\s\d{2}:\d{2}:\d{2}$/,
  /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])T\d{2}:\d{2}:\d{2}$/,
  /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])T\d{2}:\d{2}:\d{2}.\d{3}Z$/,
  /^([1-9]|1[0-2])\/([1-9]|[12][0-9]|3[01])\/\d{4}$/,
  /^([1-9]|[12][0-9]|3[01])\/([1-9]|1[0-2])\/\d{4}$/
  // d/m/YYYY
];
var TIME_FORMAT = [
  "%Y-%m-%d",
  "%m/%d/%Y",
  "%d/%m/%Y",
  "%Y/%m/%d",
  "%Y.%m.%d",
  "%Y-%m-%d %H:%M:%S",
  "%Y-%m-%dT%H:%M:%S",
  "%Y-%m-%dT%H:%M:%S.%gZ",
  "%f/%e/%Y",
  "%e/%f/%Y"
];
function getTimeFormat(data) {
  if (typeof data === "number")
    return "timestamp";
  const i2 = COMMON_TIME_FORMAT.findIndex((x3) => x3.test(data));
  if (i2 >= 0)
    return TIME_FORMAT[i2];
  return "";
}

// ../graphic-walker/dist/lib/op/offset.js
var unexceptedUTCParsedPatternFormats = ["%Y", "%Y-%m", "%Y-%m-%d"];

// ../graphic-walker/dist/vis/spec/bin.js
function addBinStep(encoding, dataSource) {
  Object.keys(encoding).forEach((c5) => {
    if (encoding[c5].bin && dataSource[0]?.[encoding[c5].field.replace("[0]", "")]) {
      const data = dataSource[0][encoding[c5].field.replace("[0]", "")];
      encoding[c5].bin.step = data[1] - data[0];
    }
  });
  return encoding;
}

// ../graphic-walker/dist/vis/spec/view.js
function formatOffset(offset2) {
  if (offset2 === 0)
    return "";
  return `${offset2 > 0 ? "+" : "-"}${Math.abs(offset2)}`;
}
function getSingleView(props) {
  const { x: x3, y: y3, color: color3, opacity: opacity2, size, shape, theta, radius: radius2, text: text2, row, column: column2, xOffset, yOffset, details, defaultAggregated, stack: stack2, geomType, hasLegend = true, hideLegend = false, displayOffset, dataSource, vegaConfig } = props;
  const fields = [x3, y3, color3, opacity2, size, shape, row, column2, xOffset, yOffset, theta, radius2, text2];
  let markType = geomType;
  let config = {};
  if (!hasLegend) {
    config.legend = {
      disable: true
    };
  } else if (hideLegend) {
    config.legend = {
      gradientOpacity: 0,
      labelColor: "transparent",
      symbolOpacity: 0,
      symbolStrokeColor: "transparent",
      titleColor: "transparent",
      titleOpacity: 0
    };
  }
  if (geomType === "auto") {
    const types = [];
    if (x3 !== NULL_FIELD)
      types.push(x3.semanticType);
    if (y3 !== NULL_FIELD)
      types.push(y3.semanticType);
    markType = autoMark(types, defaultAggregated);
  }
  const transform2 = fields.filter((f2) => f2.semanticType === "temporal").map((f2) => {
    let offsetTime = (displayOffset ?? (/* @__PURE__ */ new Date()).getTimezoneOffset()) * -6e4;
    const fid = encodeFid(f2.fid);
    const sample = dataSource[0]?.[f2.fid];
    if (sample) {
      const format3 = getTimeFormat(sample);
      if (format3 !== "timestamp") {
        offsetTime += (f2.offset ?? (/* @__PURE__ */ new Date()).getTimezoneOffset()) * 6e4;
        if (!unexceptedUTCParsedPatternFormats.includes(format3)) {
          offsetTime -= (/* @__PURE__ */ new Date()).getTimezoneOffset() * 6e4;
        }
        if (offsetTime === 0) {
          return null;
        }
        return {
          calculate: `datum[${JSON.stringify(fid)}]!==null?(toDate(datum[${JSON.stringify(fid)}])${formatOffset(offsetTime)}):null`,
          as: fid
        };
      }
    }
    if (offsetTime === 0) {
      return null;
    }
    return {
      calculate: `datum[${JSON.stringify(fid)}]!==null?(datum[${JSON.stringify(fid)}]${formatOffset(offsetTime)}):null`,
      as: fid
    };
  }).filter(Boolean);
  let encoding = channelEncode({
    geomType: markType,
    x: x3,
    y: y3,
    color: color3,
    opacity: opacity2,
    size,
    shape,
    row,
    column: column2,
    xOffset,
    yOffset,
    theta,
    radius: radius2,
    details,
    text: text2,
    displayOffset,
    vegaConfig
  });
  if (defaultAggregated) {
    channelAggregate(encoding, fields);
  }
  addBinStep(encoding, dataSource);
  addTooltipEncode(encoding, details, defaultAggregated);
  channelStack(encoding, stack2);
  const mark = {
    type: markType,
    opacity: 0.96,
    tooltip: { content: "data" }
  };
  return {
    config,
    transform: transform2,
    mark,
    encoding
  };
}
function resolveScales(scale, view, data, theme) {
  const newEncoding = { ...view.encoding };
  function addScale(c5, encodingName) {
    encodingName = encodingName ?? c5;
    if (scale[c5] && newEncoding[encodingName]) {
      if (typeof scale[c5] === "function") {
        const field2 = newEncoding[encodingName].field;
        const values2 = data.map((x3) => x3[field2]);
        newEncoding[encodingName].scale = scale[c5]({
          semanticType: newEncoding[encodingName].type,
          theme,
          values: values2
        });
      } else {
        newEncoding[encodingName].scale = scale[c5];
      }
    }
  }
  addScale("row", "y");
  addScale("column", "x");
  addScale("color");
  addScale("opacity");
  addScale("size");
  addScale("radius");
  addScale("theta");
  return {
    ...view,
    encoding: newEncoding
  };
}

// ../graphic-walker/dist/lib/vega.js
var leastOne = (x3) => Math.max(x3, 1);
function toVegaSpec({ rows: rowsRaw, columns: columnsRaw, color: color3, opacity: opacity2, size, details = [], radius: radius2, shape, text: text2, theta, interactiveScale, dataSource, layoutMode, width, height, defaultAggregated, geomType, stack: stack2, scales, mediaTheme, vegaConfig, displayOffset }) {
  const guard = defaultAggregated ? (x3) => x3 ?? NULL_FIELD : (x3) => x3 ? x3.aggName === "expr" ? NULL_FIELD : x3 : NULL_FIELD;
  const rows = rowsRaw.map(guard).filter((x3) => x3 !== NULL_FIELD);
  const columns = columnsRaw.map(guard).filter((x3) => x3 !== NULL_FIELD);
  const yField = guard(rows.length > 0 ? rows[rows.length - 1] : NULL_FIELD);
  const xField = guard(columns.length > 0 ? columns[columns.length - 1] : NULL_FIELD);
  const rowDims = rows.filter((f2) => f2.analyticType === "dimension");
  const colDims = columns.filter((f2) => f2.analyticType === "dimension");
  const rowMeas = rows.filter((f2) => f2.analyticType === "measure");
  const colMeas = columns.filter((f2) => f2.analyticType === "measure");
  const rowRepeatFields = rowMeas.length === 0 ? rowDims.slice(-1) : rowMeas;
  const colRepeatFields = colMeas.length === 0 ? colDims.slice(-1) : colMeas;
  const rowLeftFacetFields = rows.slice(0, -1).filter((f2) => f2.analyticType === "dimension");
  const colLeftFacetFields = columns.slice(0, -1).filter((f2) => f2.analyticType === "dimension");
  const rowFacetField = rowLeftFacetFields.length > 0 ? rowLeftFacetFields[rowLeftFacetFields.length - 1] : NULL_FIELD;
  const colFacetField = colLeftFacetFields.length > 0 ? colLeftFacetFields[colLeftFacetFields.length - 1] : NULL_FIELD;
  const geomFieldIds = [...rows, ...columns, color3, opacity2, size, ...details].filter((f2) => Boolean(f2)).filter((f2) => f2.aggName !== "expr").map((f2) => f2.fid);
  const spec = {
    data: {
      values: dataSource
    },
    params: geomType === "boxplot" ? void 0 : [
      {
        name: "geom",
        select: {
          type: "point",
          fields: geomFieldIds.map(encodeFid)
        }
      }
    ]
  };
  if (interactiveScale && spec.params) {
    spec.params.push({
      name: "grid",
      select: "interval",
      bind: "scales"
    });
  }
  if (rowRepeatFields.length <= 1 && colRepeatFields.length <= 1) {
    if (layoutMode === "auto") {
    } else if (rowFacetField === NULL_FIELD && colFacetField === NULL_FIELD) {
      spec.autosize = "fit";
      spec.width = width - 5;
      spec.height = height - 5;
    } else {
      const rowNums = rowFacetField !== NULL_FIELD ? new Set(dataSource.map((x3) => x3[rowFacetField.fid])).size : 1;
      const colNums = colFacetField !== NULL_FIELD ? new Set(dataSource.map((x3) => x3[colFacetField.fid])).size : 1;
      spec.width = Math.floor(width / colNums);
      spec.height = Math.floor(height / rowNums);
    }
    const v2 = getSingleView({
      x: xField,
      y: yField,
      color: guard(color3),
      opacity: guard(opacity2),
      size: guard(size),
      shape: guard(shape),
      theta: guard(theta),
      radius: guard(radius2),
      text: guard(text2),
      row: rowFacetField,
      column: colFacetField,
      xOffset: NULL_FIELD,
      yOffset: NULL_FIELD,
      details: details.map(guard).filter((x3) => x3 !== NULL_FIELD),
      defaultAggregated,
      stack: stack2,
      geomType,
      displayOffset,
      dataSource,
      vegaConfig
    });
    const singleView = scales ? resolveScales(scales, v2, dataSource, mediaTheme) : v2;
    spec.mark = singleView.mark;
    if ("encoding" in singleView) {
      spec.encoding = singleView.encoding;
    }
    if ("transform" in singleView && singleView.transform.length > 0) {
      spec.transform = singleView.transform;
    }
    spec.resolve ||= {};
    let resolve = vegaConfig.resolve;
    for (let v3 in resolve) {
      let value = resolve[v3] ? "independent" : "shared";
      spec.resolve.scale = { ...spec.resolve.scale, [v3]: value };
      if (GLOBAL_CONFIG.POSITION_CHANNEL_CONFIG_LIST.includes(v3)) {
        spec.resolve.axis = { ...spec.resolve.axis, [v3]: value };
      } else if (GLOBAL_CONFIG.NON_POSITION_CHANNEL_CONFIG_LIST.includes(v3)) {
        spec.resolve.legend = { ...spec.resolve.legend, [v3]: value };
      }
    }
    return [spec];
  } else {
    if (layoutMode === "auto") {
    } else if (rowFacetField === NULL_FIELD && colFacetField === NULL_FIELD) {
      spec.width = Math.floor(width / colRepeatFields.length) - 5;
      spec.height = Math.floor(height / rowRepeatFields.length) - 5;
    } else {
      const rowNums = rowFacetField !== NULL_FIELD ? new Set(dataSource.map((x3) => x3[rowFacetField.fid])).size : 1;
      const colNums = colFacetField !== NULL_FIELD ? new Set(dataSource.map((x3) => x3[colFacetField.fid])).size : 1;
      spec.width = Math.floor(width / colRepeatFields.length / colNums);
      spec.height = Math.floor(height / rowRepeatFields.length / rowNums);
    }
    let index2 = 0;
    let result = new Array(rowRepeatFields.length * colRepeatFields.length);
    for (let i2 = 0; i2 < leastOne(rowRepeatFields.length); i2++) {
      for (let j2 = 0; j2 < leastOne(colRepeatFields.length); j2++, index2++) {
        const hasLegend = j2 === colRepeatFields.length - 1;
        const showLegend = i2 == 0;
        const v2 = getSingleView({
          x: colRepeatFields[j2] || NULL_FIELD,
          y: rowRepeatFields[i2] || NULL_FIELD,
          color: guard(color3),
          opacity: guard(opacity2),
          size: guard(size),
          shape: guard(shape),
          theta: guard(theta),
          radius: guard(radius2),
          text: guard(text2),
          row: rowFacetField,
          column: colFacetField,
          xOffset: NULL_FIELD,
          yOffset: NULL_FIELD,
          details,
          defaultAggregated,
          stack: stack2,
          geomType,
          hasLegend,
          hideLegend: !showLegend,
          displayOffset,
          dataSource
        });
        const singleView = scales ? resolveScales(scales, v2, dataSource, mediaTheme) : v2;
        let commonSpec = { ...spec };
        const ans = { ...commonSpec, ...singleView };
        if ("params" in commonSpec) {
          ans.params = commonSpec.params;
        }
        result[index2] = ans;
      }
    }
    return result;
  }
}

// src/builders/layoutBuilder.ts
function buildLayoutOptions(model, hideLegend) {
  return {
    marginTop: 20,
    // Let Plot manage legend footprint; fixed large reserve causes blank area.
    marginRight: 40,
    marginBottom: 48,
    marginLeft: 56
  };
}

// src/model/geomModel.ts
function resolveAutoMark(channels) {
  const xType = channels.x.type;
  const yType = channels.y.type;
  if (xType === "quantitative" && yType === "quantitative") {
    return "point";
  }
  if (xType === "temporal" && yType === "quantitative" || yType === "temporal" && xType === "quantitative") {
    return "line";
  }
  return "bar";
}
function normalizeGeom(mark, channels) {
  const raw = typeof mark === "string" ? mark : mark?.type;
  const markType = raw ?? "bar";
  if (markType === "auto")
    return resolveAutoMark(channels);
  if (markType === "dot")
    return "circle";
  if (markType === "trail")
    return "line";
  return markType;
}
function isScatterLikeGeom(geom) {
  return geom === "point" || geom === "circle";
}

// src/builders/markBuilder.ts
function getDirectionalMark(geom, xType, yType) {
  const xIsQ = xType === "quantitative";
  const yIsQ = yType === "quantitative";
  const directional = {
    bar: { x: barX, y: barY },
    area: { x: areaX, y: areaY },
    line: { x: lineX, y: lineY },
    tick: { x: tickX, y: tickY },
    rect: { x: rectX, y: rectY },
    rule: { x: ruleX, y: ruleY },
    boxplot: { x: boxX, y: boxY }
  };
  const fallback = directional[geom];
  if (!fallback) {
    return { mark: dot, stackAxis: "y" };
  }
  if (xIsQ && !yIsQ) {
    return { mark: fallback.x, stackAxis: "x" };
  }
  return { mark: fallback.y, stackAxis: "y" };
}
function stackModeFromEncoding(spec) {
  const enc = spec.encoding ?? {};
  const stackable = ["x", "y", "theta", "radius"];
  for (const channel of stackable) {
    const c5 = enc[channel];
    if (!c5)
      continue;
    if (c5.type === "quantitative" && c5.stack !== null && c5.stack !== false) {
      return typeof c5.stack === "string" ? c5.stack : "stack";
    }
  }
  if (Array.isArray(spec.transform) && spec.transform.some((t5) => Boolean(t5.stack))) {
    return "stack";
  }
  return null;
}
function buildBaseOptions(model, geom, title) {
  const options = {
    x: model.x.key,
    y: model.y.key,
    fx: model.column.key,
    fy: model.row.key,
    title
  };
  if (model.opacity.key) {
    options.opacity = model.opacity.key;
  } else if (typeof model.opacity.value === "number") {
    options.opacity = model.opacity.value;
  }
  const hasColor = Boolean(model.color.key);
  if (geom === "line" || geom === "rule" || geom === "tick") {
    options.stroke = model.color.key;
  } else if (geom === "point") {
    options.stroke = hasColor ? model.color.key : void 0;
    options.fill = "none";
  } else {
    options.fill = model.color.key;
  }
  if (isScatterLikeGeom(geom)) {
    if (model.size.key)
      options.r = model.size.key;
    if (model.shape.key && model.shape.isDiscrete)
      options.symbol = model.shape.key;
  }
  if (geom === "text") {
    options.text = model.text.key ?? model.y.key ?? model.x.key;
  }
  return options;
}
function resolveDefaultColor(geom, vegaConfig) {
  const fallback = Array.isArray(vegaConfig?.range?.category) ? vegaConfig?.range?.category?.[0] : void 0;
  const str = (v2) => typeof v2 === "string" ? v2 : void 0;
  if (geom === "line")
    return str(vegaConfig?.line?.stroke) ?? fallback;
  if (geom === "point")
    return str(vegaConfig?.point?.stroke) ?? fallback;
  if (geom === "circle")
    return str(vegaConfig?.circle?.fill) ?? fallback;
  if (geom === "area")
    return str(vegaConfig?.area?.fill) ?? fallback;
  if (geom === "bar")
    return str(vegaConfig?.bar?.fill) ?? fallback;
  if (geom === "rect")
    return str(vegaConfig?.rect?.fill) ?? fallback;
  if (geom === "tick")
    return str(vegaConfig?.tick?.stroke) ?? str(vegaConfig?.tick?.fill) ?? fallback;
  if (geom === "rule")
    return str(vegaConfig?.rule?.stroke) ?? fallback;
  if (geom === "text")
    return str(vegaConfig?.text?.fill) ?? fallback;
  return fallback;
}
function withDefaultColor(options, geom, model, vegaConfig) {
  if (model.color.key)
    return options;
  const color3 = resolveDefaultColor(geom, vegaConfig);
  if (!color3)
    return options;
  if (geom === "line" || geom === "tick" || geom === "rule" || geom === "point") {
    return { ...options, stroke: options.stroke ?? color3 };
  }
  if (geom === "text") {
    return { ...options, fill: options.fill ?? color3 };
  }
  return { ...options, fill: options.fill ?? color3 };
}
function compareValue(a3, b2) {
  const aNum = typeof a3 === "number" ? a3 : Number(a3);
  const bNum = typeof b2 === "number" ? b2 : Number(b2);
  if (Number.isFinite(aNum) && Number.isFinite(bNum))
    return aNum - bNum;
  const aTs = a3 instanceof Date ? a3.getTime() : Date.parse(String(a3));
  const bTs = b2 instanceof Date ? b2.getTime() : Date.parse(String(b2));
  if (Number.isFinite(aTs) && Number.isFinite(bTs))
    return aTs - bTs;
  return String(a3 ?? "").localeCompare(String(b2 ?? ""));
}
function sortSeriesData(data, model, geom) {
  if (geom !== "line" && geom !== "area")
    return data;
  const primary = model.x.key ?? model.y.key;
  if (!primary)
    return data;
  const colorKey = model.color.key;
  return [...data].sort((a3, b2) => {
    const groupComp = colorKey ? compareValue(a3[colorKey], b2[colorKey]) : 0;
    if (groupComp !== 0)
      return groupComp;
    return compareValue(a3[primary], b2[primary]);
  });
}
function applyStacking(markFn, data, baseOptions, stackAxis, stackMode) {
  const stackOptions = {};
  if (stackMode === "normalize") {
    stackOptions.offset = "normalize";
  } else if (stackMode === "center") {
    stackOptions.offset = "center";
  }
  if (stackAxis === "x") {
    return markFn(data, stackX(stackOptions, baseOptions));
  }
  return markFn(data, stackY(stackOptions, baseOptions));
}
function buildMark(spec, data, model, geom, title, vegaConfig) {
  const { mark: markFn, stackAxis } = getDirectionalMark(geom, model.x.type, model.y.type);
  const baseOptions = withDefaultColor(buildBaseOptions(model, geom, title), geom, model, vegaConfig);
  const preparedData = sortSeriesData(data, model, geom);
  if (geom === "text") {
    return text(preparedData, baseOptions);
  }
  if (geom === "rect" && model.x.key && model.y.key && model.color.key) {
    const cellOpacity = model.opacity.key ?? (typeof model.opacity.value === "number" ? model.opacity.value : void 0);
    return cell(preparedData, {
      x: model.x.key,
      y: model.y.key,
      fill: model.color.key,
      fx: model.column.key,
      fy: model.row.key,
      title,
      opacity: cellOpacity
    });
  }
  const stackMode = stackModeFromEncoding(spec);
  const areaIsQuantScatter = geom === "area" && model.x.type === "quantitative" && model.y.type === "quantitative";
  const shouldStack = Boolean(stackMode && model.color.key && (geom === "bar" || geom === "area" && !areaIsQuantScatter));
  if (shouldStack && stackMode) {
    const stackedOptions = {
      ...baseOptions,
      z: model.color.key
    };
    return applyStacking(markFn, preparedData, stackedOptions, stackAxis, stackMode);
  }
  if (model.color.key && (geom === "line" || geom === "area")) {
    return markFn(preparedData, {
      ...baseOptions,
      z: model.color.key
    });
  }
  return markFn(preparedData, baseOptions);
}

// src/builders/scaleBuilder.ts
function temporalAxisType(type2) {
  return type2 === "temporal" ? "utc" : void 0;
}
function buildScaleOptions(model, geom, hideLegend, vegaConfig) {
  const hasColor = Boolean(model.color.key);
  const colorLegend = hasColor && !hideLegend;
  const discreteRange = Array.isArray(vegaConfig?.range?.category) ? vegaConfig?.range?.category : void 0;
  const continuousRange = Array.isArray(vegaConfig?.range?.heatmap) ? vegaConfig?.range?.heatmap : Array.isArray(vegaConfig?.scale?.continuous?.range) ? vegaConfig?.scale?.continuous?.range : Array.isArray(vegaConfig?.range?.ramp) ? vegaConfig?.range?.ramp : void 0;
  const options = {
    x: {
      label: model.x.title,
      type: temporalAxisType(model.x.type)
    },
    y: {
      label: model.y.title,
      type: temporalAxisType(model.y.type)
    }
  };
  if (hasColor) {
    options.color = {
      label: model.color.title,
      legend: colorLegend,
      range: model.color.isDiscrete ? discreteRange : continuousRange
    };
  }
  if (model.opacity.key) {
    options.opacity = {
      range: [0.2, 1]
    };
  }
  if (model.size.key && isScatterLikeGeom(geom)) {
    options.r = {
      range: [3, 14]
    };
  }
  if (model.shape.key && model.shape.isDiscrete && isScatterLikeGeom(geom)) {
    options.symbol = {
      label: model.shape.title,
      legend: !hideLegend
    };
  }
  return options;
}

// src/builders/tooltipBuilder.ts
function collectTooltipFields(model) {
  const seen = /* @__PURE__ */ new Set();
  const result = [];
  const candidates = [model.x, model.y, model.color, model.opacity, model.size, model.shape, ...model.details];
  for (const item of candidates) {
    if (!item.key || !item.title)
      continue;
    if (seen.has(item.key))
      continue;
    seen.add(item.key);
    result.push({ key: item.key, title: item.title });
  }
  return result;
}
function buildTooltipTitle(model) {
  const fields = collectTooltipFields(model);
  if (fields.length === 0)
    return void 0;
  return (d2) => fields.map((f2) => `${f2.title}: ${d2[f2.key] ?? ""}`).join(", ");
}

// src/model/fieldBinding.ts
function decodeFieldKey(raw) {
  if (!raw)
    return void 0;
  return raw.replace(/\\n/g, "\n").replace(/\\t/g, "	").replace(/\\r/g, "\r").replace(/\\(["'\.\[\]\/\\])/g, "$1");
}
function resolveDataKey(data, channel) {
  const baseField = decodeFieldKey(channel?.field);
  if (!baseField)
    return void 0;
  const sample = data[0] ?? {};
  const has = (key) => Object.prototype.hasOwnProperty.call(sample, key);
  const aggName = typeof channel?.aggregate === "string" ? channel.aggregate : void 0;
  if (aggName && aggName !== "expr") {
    const aggKey = `${baseField}_${aggName}`;
    if (has(aggKey))
      return aggKey;
  }
  if (has(baseField))
    return baseField;
  const prefixed = Object.keys(sample).find((k3) => k3.startsWith(`${baseField}_`));
  return prefixed ?? baseField;
}
function getFieldTitle(channel) {
  if (!channel)
    return void 0;
  const fallback = decodeFieldKey(channel.field);
  const displayName = channel.title ?? fallback;
  if (!displayName)
    return void 0;
  const aggName = typeof channel.aggregate === "string" ? channel.aggregate : void 0;
  if (aggName && aggName !== "expr" && !displayName.includes("(")) {
    return `${aggName}(${displayName})`;
  }
  return displayName;
}
function getFieldBinding(data, channel) {
  const type2 = channel?.type;
  return {
    key: resolveDataKey(data, channel),
    title: getFieldTitle(channel),
    type: type2,
    value: channel?.value,
    aggregate: channel?.aggregate,
    isDiscrete: type2 === "nominal" || type2 === "ordinal",
    isContinuous: type2 === "quantitative" || type2 === "temporal"
  };
}

// src/model/channelModel.ts
function asChannelDef(value) {
  if (!value || Array.isArray(value) || typeof value !== "object")
    return void 0;
  return value;
}
function asChannelArray(value) {
  if (!Array.isArray(value))
    return [];
  return value.filter((x3) => Boolean(x3 && typeof x3 === "object"));
}
function buildChannelModel(data, spec) {
  const encoding = spec.encoding ?? {};
  return {
    x: getFieldBinding(data, asChannelDef(encoding.x)),
    y: getFieldBinding(data, asChannelDef(encoding.y)),
    row: getFieldBinding(data, asChannelDef(encoding.row)),
    column: getFieldBinding(data, asChannelDef(encoding.column)),
    color: getFieldBinding(data, asChannelDef(encoding.color)),
    opacity: getFieldBinding(data, asChannelDef(encoding.opacity)),
    size: getFieldBinding(data, asChannelDef(encoding.size)),
    shape: getFieldBinding(data, asChannelDef(encoding.shape)),
    text: getFieldBinding(data, asChannelDef(encoding.text)),
    theta: getFieldBinding(data, asChannelDef(encoding.theta)),
    radius: getFieldBinding(data, asChannelDef(encoding.radius)),
    details: asChannelArray(encoding.tooltip).map((channel) => getFieldBinding(data, channel))
  };
}

// src/observablePlot.ts
function isLegendHidden(vlSpec) {
  const legend = vlSpec.config?.legend;
  if (!legend)
    return false;
  if (legend.disable)
    return true;
  return legend.gradientOpacity === 0 || legend.symbolOpacity === 0;
}
function vegaLiteToPlot(spec, vegaConfig) {
  const data = spec?.data?.values ?? [];
  const channels = buildChannelModel(data, spec);
  const geom = normalizeGeom(spec.mark, channels);
  const hideLegend = isLegendHidden(spec);
  const title = buildTooltipTitle(channels);
  const mark = buildMark(spec, data, channels, geom, title, vegaConfig);
  return {
    marks: [mark],
    ...buildScaleOptions(channels, geom, hideLegend, vegaConfig),
    ...buildLayoutOptions(channels, hideLegend)
  };
}
function toObservablePlotSpec({
  rows: rowsRaw,
  columns: columnsRaw,
  color: color3,
  opacity: opacity2,
  size,
  shape,
  theta,
  radius: radius2,
  text: text2,
  details = [],
  interactiveScale,
  dataSource,
  layoutMode,
  width,
  height,
  defaultAggregated,
  geomType,
  stack: stack2,
  scales,
  mediaTheme,
  vegaConfig,
  displayOffset
}) {
  const vlSpecs = toVegaSpec({
    rows: rowsRaw,
    columns: columnsRaw,
    color: color3,
    opacity: opacity2,
    size,
    shape,
    theta,
    radius: radius2,
    text: text2,
    details,
    interactiveScale,
    dataSource,
    layoutMode,
    width,
    height,
    defaultAggregated,
    geomType,
    stack: stack2,
    scales,
    mediaTheme,
    vegaConfig,
    displayOffset
  });
  return vlSpecs.map((vlSpec) => vegaLiteToPlot(vlSpec, vegaConfig));
}
var __test__vegaLiteToPlot = vegaLiteToPlot;
var __test__fieldBinding = {
  resolveDataKey,
  getFieldTitle
};
function renderObservablePlot(plotSpec, width, height, background) {
  return plot({
    ...plotSpec,
    width,
    height,
    style: {
      ...plotSpec.style ?? {},
      background
    }
  });
}
export {
  __test__fieldBinding,
  __test__vegaLiteToPlot,
  renderObservablePlot,
  toObservablePlotSpec
};
