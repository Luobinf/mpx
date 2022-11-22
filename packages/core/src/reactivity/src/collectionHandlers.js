import { toRaw, toReactive, toReadonly } from "./reactive";
import { track, trigger, ITERATE_KEY, MAP_KEY_ITERATE_KEY } from "./effect";
import { capitalize, hasOwn, hasChanged, toRawType, isMap } from "@vue/shared";
const toShallow = (value) => value;
const getProto = (v) => Reflect.getPrototypeOf(v);
function get(target, key, isReadonly = false, isShallow = false) {
  // #1772: readonly(reactive(Map)) should return readonly + reactive version
  // of the value
  target = target["__v_raw" /* ReactiveFlags.RAW */];
  const rawTarget = toRaw(target);
  const rawKey = toRaw(key);
  if (!isReadonly) {
    if (key !== rawKey) {
      track(rawTarget, "get" /* TrackOpTypes.GET */, key);
    }
    track(rawTarget, "get" /* TrackOpTypes.GET */, rawKey);
  }
  const { has } = getProto(rawTarget);
  const wrap = isShallow ? toShallow : isReadonly ? toReadonly : toReactive;
  if (has.call(rawTarget, key)) {
    return wrap(target.get(key));
  } else if (has.call(rawTarget, rawKey)) {
    return wrap(target.get(rawKey));
  } else if (target !== rawTarget) {
    // #3602 readonly(reactive(Map))
    // ensure that the nested reactive `Map` can do tracking for itself
    target.get(key);
  }
}
function has(key, isReadonly = false) {
  const target = this["__v_raw" /* ReactiveFlags.RAW */];
  const rawTarget = toRaw(target);
  const rawKey = toRaw(key);
  if (!isReadonly) {
    if (key !== rawKey) {
      track(rawTarget, "has" /* TrackOpTypes.HAS */, key);
    }
    track(rawTarget, "has" /* TrackOpTypes.HAS */, rawKey);
  }
  return key === rawKey
    ? target.has(key)
    : target.has(key) || target.has(rawKey);
}
function size(target, isReadonly = false) {
  target = target["__v_raw" /* ReactiveFlags.RAW */];
  !isReadonly &&
    track(toRaw(target), "iterate" /* TrackOpTypes.ITERATE */, ITERATE_KEY);
  return Reflect.get(target, "size", target);
}
function add(value) {
  value = toRaw(value);
  const target = toRaw(this);
  const proto = getProto(target);
  const hadKey = proto.has.call(target, value);
  if (!hadKey) {
    target.add(value);
    trigger(target, "add" /* TriggerOpTypes.ADD */, value, value);
  }
  return this;
}
function set(key, value) {
  value = toRaw(value);
  const target = toRaw(this);
  const { has, get } = getProto(target);
  let hadKey = has.call(target, key);
  if (!hadKey) {
    key = toRaw(key);
    hadKey = has.call(target, key);
  }
  // else if (__DEV__) {
  //     checkIdentityKeys(target, has, key);
  // }
  const oldValue = get.call(target, key);
  target.set(key, value);
  if (!hadKey) {
    trigger(target, "add" /* TriggerOpTypes.ADD */, key, value);
  } else if (hasChanged(value, oldValue)) {
    trigger(target, "set" /* TriggerOpTypes.SET */, key, value, oldValue);
  }
  return this;
}
function deleteEntry(key) {
  const target = toRaw(this);
  const { has, get } = getProto(target);
  let hadKey = has.call(target, key);
  if (!hadKey) {
    key = toRaw(key);
    hadKey = has.call(target, key);
  }
  // else if (__DEV__) {
  //     checkIdentityKeys(target, has, key);
  // }
  const oldValue = get ? get.call(target, key) : undefined;
  // forward the operation before queueing reactions
  const result = target.delete(key);
  if (hadKey) {
    trigger(
      target,
      "delete" /* TriggerOpTypes.DELETE */,
      key,
      undefined,
      oldValue
    );
  }
  return result;
}
function clear() {
  const target = toRaw(this);
  const hadItems = target.size !== 0;
  // const oldTarget = __DEV__
  //     ? isMap(target)
  //         ? new Map(target)
  //         : new Set(target)
  //     : undefined;
  const oldTarget = undefined;
  // forward the operation before queueing reactions
  const result = target.clear();
  if (hadItems) {
    trigger(
      target,
      "clear" /* TriggerOpTypes.CLEAR */,
      undefined,
      undefined,
      oldTarget
    );
  }
  return result;
}
function createForEach(isReadonly, isShallow) {
  return function forEach(callback, thisArg) {
    const observed = this;
    const target = observed["__v_raw" /* ReactiveFlags.RAW */];
    const rawTarget = toRaw(target);
    const wrap = isShallow ? toShallow : isReadonly ? toReadonly : toReactive;
    !isReadonly &&
      track(rawTarget, "iterate" /* TrackOpTypes.ITERATE */, ITERATE_KEY);
    return target.forEach((value, key) => {
      // important: make sure the callback is
      // 1. invoked with the reactive map as `this` and 3rd arg
      // 2. the value received should be a corresponding reactive/readonly.
      return callback.call(thisArg, wrap(value), wrap(key), observed);
    });
  };
}
function createIterableMethod(method, isReadonly, isShallow) {
  return function (...args) {
    const target = this["__v_raw" /* ReactiveFlags.RAW */];
    const rawTarget = toRaw(target);
    const targetIsMap = isMap(rawTarget);
    const isPair =
      method === "entries" || (method === Symbol.iterator && targetIsMap);
    const isKeyOnly = method === "keys" && targetIsMap;
    const innerIterator = target[method](...args);
    const wrap = isShallow ? toShallow : isReadonly ? toReadonly : toReactive;
    !isReadonly &&
      track(
        rawTarget,
        "iterate" /* TrackOpTypes.ITERATE */,
        isKeyOnly ? MAP_KEY_ITERATE_KEY : ITERATE_KEY
      );
    // return a wrapped iterator which returns observed versions of the
    // values emitted from the real iterator
    return {
      // iterator protocol
      next() {
        const { value, done } = innerIterator.next();
        return done
          ? { value, done }
          : {
              value: isPair ? [wrap(value[0]), wrap(value[1])] : wrap(value),
              done,
            };
      },
      // iterable protocol
      [Symbol.iterator]() {
        return this;
      },
    };
  };
}
function createReadonlyMethod(type) {
  return function (...args) {
    // if (__DEV__) {
    //     const key = args[0] ? `on key "${args[0]}" ` : ``;
    //     console.warn(`${capitalize(type)} operation ${key}failed: target is readonly.`, toRaw(this));
    // }
    return type === "delete" /* TriggerOpTypes.DELETE */ ? false : this;
  };
}
function createInstrumentations() {
  const mutableInstrumentations = {
    get(key) {
      return get(this, key);
    },
    get size() {
      return size(this);
    },
    has,
    add,
    set,
    delete: deleteEntry,
    clear,
    forEach: createForEach(false, false),
  };
  const shallowInstrumentations = {
    get(key) {
      return get(this, key, false, true);
    },
    get size() {
      return size(this);
    },
    has,
    add,
    set,
    delete: deleteEntry,
    clear,
    forEach: createForEach(false, true),
  };
  const readonlyInstrumentations = {
    get(key) {
      return get(this, key, true);
    },
    get size() {
      return size(this, true);
    },
    has(key) {
      return has.call(this, key, true);
    },
    add: createReadonlyMethod("add" /* TriggerOpTypes.ADD */),
    set: createReadonlyMethod("set" /* TriggerOpTypes.SET */),
    delete: createReadonlyMethod("delete" /* TriggerOpTypes.DELETE */),
    clear: createReadonlyMethod("clear" /* TriggerOpTypes.CLEAR */),
    forEach: createForEach(true, false),
  };
  const shallowReadonlyInstrumentations = {
    get(key) {
      return get(this, key, true, true);
    },
    get size() {
      return size(this, true);
    },
    has(key) {
      return has.call(this, key, true);
    },
    add: createReadonlyMethod("add" /* TriggerOpTypes.ADD */),
    set: createReadonlyMethod("set" /* TriggerOpTypes.SET */),
    delete: createReadonlyMethod("delete" /* TriggerOpTypes.DELETE */),
    clear: createReadonlyMethod("clear" /* TriggerOpTypes.CLEAR */),
    forEach: createForEach(true, true),
  };
  const iteratorMethods = ["keys", "values", "entries", Symbol.iterator];
  iteratorMethods.forEach((method) => {
    mutableInstrumentations[method] = createIterableMethod(
      method,
      false,
      false
    );
    readonlyInstrumentations[method] = createIterableMethod(
      method,
      true,
      false
    );
    shallowInstrumentations[method] = createIterableMethod(method, false, true);
    shallowReadonlyInstrumentations[method] = createIterableMethod(
      method,
      true,
      true
    );
  });
  return [
    mutableInstrumentations,
    readonlyInstrumentations,
    shallowInstrumentations,
    shallowReadonlyInstrumentations,
  ];
}
const [
  mutableInstrumentations,
  readonlyInstrumentations,
  shallowInstrumentations,
  shallowReadonlyInstrumentations,
] = /* #__PURE__*/ createInstrumentations();
function createInstrumentationGetter(isReadonly, shallow) {
  const instrumentations = shallow
    ? isReadonly
      ? shallowReadonlyInstrumentations
      : shallowInstrumentations
    : isReadonly
    ? readonlyInstrumentations
    : mutableInstrumentations;
  return (target, key, receiver) => {
    if (key === "__v_isReactive" /* ReactiveFlags.IS_REACTIVE */) {
      return !isReadonly;
    } else if (key === "__v_isReadonly" /* ReactiveFlags.IS_READONLY */) {
      return isReadonly;
    } else if (key === "__v_raw" /* ReactiveFlags.RAW */) {
      return target;
    }
    return Reflect.get(
      hasOwn(instrumentations, key) && key in target
        ? instrumentations
        : target,
      key,
      receiver
    );
  };
}
export const mutableCollectionHandlers = {
  get: /*#__PURE__*/ createInstrumentationGetter(false, false),
};
export const shallowCollectionHandlers = {
  get: /*#__PURE__*/ createInstrumentationGetter(false, true),
};
export const readonlyCollectionHandlers = {
  get: /*#__PURE__*/ createInstrumentationGetter(true, false),
};
export const shallowReadonlyCollectionHandlers = {
  get: /*#__PURE__*/ createInstrumentationGetter(true, true),
};
function checkIdentityKeys(target, has, key) {
  const rawKey = toRaw(key);
  if (rawKey !== key && has.call(target, rawKey)) {
    const type = toRawType(target);
    console.warn(
      `Reactive ${type} contains both the raw and reactive ` +
        `versions of the same object${type === `Map` ? ` as keys` : ``}, ` +
        `which can lead to inconsistencies. ` +
        `Avoid differentiating between the raw and reactive versions ` +
        `of an object and only use the reactive version if possible.`
    );
  }
}
