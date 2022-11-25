import { isObject, toRawType, def } from "@vue/shared";
import {
  mutableHandlers,
  readonlyHandlers,
  shallowReactiveHandlers,
  shallowReadonlyHandlers,
} from "./baseHandlers";
import {
  mutableCollectionHandlers,
  readonlyCollectionHandlers,
  shallowCollectionHandlers,
  shallowReadonlyCollectionHandlers,
} from "./collectionHandlers";
export const reactiveMap = new WeakMap();
export const shallowReactiveMap = new WeakMap();
export const readonlyMap = new WeakMap();
export const shallowReadonlyMap = new WeakMap();

function targetTypeMap(rawType) {
  switch (rawType) {
    case "Object":
    case "Array":
      return 1 /* TargetType.COMMON */;
    case "Map":
    case "Set":
    case "WeakMap":
    case "WeakSet":
      return 2 /* TargetType.COLLECTION */;
    default:
      return 0 /* TargetType.INVALID */;
  }
}
function getTargetType(value) {
  return value["__v_skip" /* ReactiveFlags.SKIP */] ||
    !Object.isExtensible(value)
    ? 0 /* TargetType.INVALID */
    : targetTypeMap(toRawType(value));
}
export function reactive(target) {
  // if trying to observe a readonly proxy, return the readonly version.
  if (isReadonly(target)) {
    return target;
  }
  return createReactiveObject(
    target,
    false,
    mutableHandlers,
    mutableCollectionHandlers,
    reactiveMap
  );
}
/**
 * Return a shallowly-reactive copy of the original object, where only the root
 * level properties are reactive. It also does not auto-unwrap refs (even at the
 * root level).
 */
export function shallowReactive(target) {
  return createReactiveObject(
    target,
    false,
    shallowReactiveHandlers,
    shallowCollectionHandlers,
    shallowReactiveMap
  );
}
/**
 * Creates a readonly copy of the original object. Note the returned copy is not
 * made reactive, but `readonly` can be called on an already reactive object.
 */
export function readonly(target) {
  return createReactiveObject(
    target,
    true,
    readonlyHandlers,
    readonlyCollectionHandlers,
    readonlyMap
  );
}
/**
 * Returns a reactive-copy of the original object, where only the root level
 * properties are readonly, and does NOT unwrap refs nor recursively convert
 * returned properties.
 * This is used for creating the props proxy object for stateful components.
 */
export function shallowReadonly(target) {
  return createReactiveObject(
    target,
    true,
    shallowReadonlyHandlers,
    shallowReadonlyCollectionHandlers,
    shallowReadonlyMap
  );
}
function createReactiveObject(
  target,
  isReadonly,
  baseHandlers,
  collectionHandlers,
  proxyMap
) {
  if (!isObject(target)) {
    // if (__DEV__) {
    //     console.warn(`value cannot be made reactive: ${String(target)}`);
    // }
    return target;
  }
  // target is already a Proxy, return it.
  // exception: calling readonly() on a reactive object
  if (
    target["__v_raw" /* ReactiveFlags.RAW */] &&
    !(isReadonly && target["__v_isReactive" /* ReactiveFlags.IS_REACTIVE */])
  ) {
    return target;
  }
  // target already has corresponding Proxy
  const existingProxy = proxyMap.get(target);
  if (existingProxy) {
    return existingProxy;
  }
  // only specific value types can be observed.
  const targetType = getTargetType(target);
  if (targetType === 0 /* TargetType.INVALID */) {
    return target;
  }
  const proxy = new Proxy(
    target,
    targetType === 2 /* TargetType.COLLECTION */
      ? collectionHandlers
      : baseHandlers
  );
  proxyMap.set(target, proxy);
  return proxy;
}
export function isReactive(value) {
  if (isReadonly(value)) {
    return isReactive(value["__v_raw" /* ReactiveFlags.RAW */]);
  }
  return !!(value && value["__v_isReactive" /* ReactiveFlags.IS_REACTIVE */]);
}
export function isReadonly(value) {
  return !!(value && value["__v_isReadonly" /* ReactiveFlags.IS_READONLY */]);
}
export function isShallow(value) {
  return !!(value && value["__v_isShallow" /* ReactiveFlags.IS_SHALLOW */]);
}
export function isProxy(value) {
  return isReactive(value) || isReadonly(value);
}
export function toRaw(observed) {
  const raw = observed && observed["__v_raw" /* ReactiveFlags.RAW */];
  return raw ? toRaw(raw) : observed;
}
export function markRaw(value) {
  def(value, "__v_skip" /* ReactiveFlags.SKIP */, true);
  return value;
}
export const toReactive = (value) =>
  isObject(value) ? reactive(value) : value;
export const toReadonly = (value) =>
  isObject(value) ? readonly(value) : value;

// The following API is compatible for the prev version of mpx capability

/**
 * Set a property on an object. Adds the new property and
 * triggers change notification if the property doesn't
 * already exist.
 */
export function set(target, key, val) {
  if (isObject(target)) {
    target[key] = val;
    return val;
  }
}

/**
 * Delete a property and trigger change if necessary.
 */
export function del(target, key) {
  if (isObject(target)) {
    delete target[key];
    return;
  }
}
