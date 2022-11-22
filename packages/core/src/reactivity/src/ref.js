import {
  activeEffect,
  shouldTrack,
  trackEffects,
  triggerEffects,
} from "./effect";
import { isArray, hasChanged } from "@vue/shared";
import {
  isProxy,
  toRaw,
  isReactive,
  toReactive,
  isReadonly,
  isShallow,
} from "./reactive";
import { createDep } from "./dep";
export function trackRefValue(ref) {
  if (shouldTrack && activeEffect) {
    ref = toRaw(ref);
    // if (__DEV__) {
    //     trackEffects(ref.dep || (ref.dep = createDep()), {
    //         target: ref,
    //         type: "get" /* TrackOpTypes.GET */,
    //         key: 'value'
    //     });
    // }
    // else {
    //     trackEffects(ref.dep || (ref.dep = createDep()));
    // }
    trackEffects(ref.dep || (ref.dep = createDep()));
  }
}
export function triggerRefValue(ref, newVal) {
  ref = toRaw(ref);
  if (ref.dep) {
    // if (__DEV__) {
    //     triggerEffects(ref.dep, {
    //         target: ref,
    //         type: "set" /* TriggerOpTypes.SET */,
    //         key: 'value',
    //         newValue: newVal
    //     });
    // }
    // else {
    //     triggerEffects(ref.dep);
    // }
    triggerEffects(ref.dep);
  }
}
export function isRef(r) {
  return !!(r && r.__v_isRef === true);
}
export function ref(value) {
  return createRef(value, false);
}
export function shallowRef(value) {
  return createRef(value, true);
}
function createRef(rawValue, shallow) {
  if (isRef(rawValue)) {
    return rawValue;
  }
  return new RefImpl(rawValue, shallow);
}
class RefImpl {
  constructor(value, __v_isShallow) {
    this.__v_isShallow = __v_isShallow;
    this.dep = undefined;
    this.__v_isRef = true;
    this._rawValue = __v_isShallow ? value : toRaw(value);
    this._value = __v_isShallow ? value : toReactive(value);
  }
  get value() {
    trackRefValue(this);
    return this._value;
  }
  set value(newVal) {
    const useDirectValue =
      this.__v_isShallow || isShallow(newVal) || isReadonly(newVal);
    newVal = useDirectValue ? newVal : toRaw(newVal);
    if (hasChanged(newVal, this._rawValue)) {
      this._rawValue = newVal;
      this._value = useDirectValue ? newVal : toReactive(newVal);
      triggerRefValue(this, newVal);
    }
  }
}
export function triggerRef(ref) {
  // triggerRefValue(ref, __DEV__ ? ref.value : void 0);
  triggerRefValue(ref, void 0);
}
export function unref(ref) {
  return isRef(ref) ? ref.value : ref;
}
const shallowUnwrapHandlers = {
  get: (target, key, receiver) => unref(Reflect.get(target, key, receiver)),
  set: (target, key, value, receiver) => {
    const oldValue = target[key];
    if (isRef(oldValue) && !isRef(value)) {
      oldValue.value = value;
      return true;
    } else {
      return Reflect.set(target, key, value, receiver);
    }
  },
};
export function proxyRefs(objectWithRefs) {
  return isReactive(objectWithRefs)
    ? objectWithRefs
    : new Proxy(objectWithRefs, shallowUnwrapHandlers);
}
class CustomRefImpl {
  constructor(factory) {
    this.dep = undefined;
    this.__v_isRef = true;
    const { get, set } = factory(
      () => trackRefValue(this),
      () => triggerRefValue(this)
    );
    this._get = get;
    this._set = set;
  }
  get value() {
    return this._get();
  }
  set value(newVal) {
    this._set(newVal);
  }
}
export function customRef(factory) {
  return new CustomRefImpl(factory);
}
export function toRefs(object) {
  // if (__DEV__ && !isProxy(object)) {
  //     console.warn(`toRefs() expects a reactive object but received a plain one.`);
  // }
  const ret = isArray(object) ? new Array(object.length) : {};
  for (const key in object) {
    ret[key] = toRef(object, key);
  }
  return ret;
}
class ObjectRefImpl {
  constructor(_object, _key, _defaultValue) {
    this._object = _object;
    this._key = _key;
    this._defaultValue = _defaultValue;
    this.__v_isRef = true;
  }
  get value() {
    const val = this._object[this._key];
    return val === undefined ? this._defaultValue : val;
  }
  set value(newVal) {
    this._object[this._key] = newVal;
  }
}
export function toRef(object, key, defaultValue) {
  const val = object[key];
  return isRef(val) ? val : new ObjectRefImpl(object, key, defaultValue);
}
