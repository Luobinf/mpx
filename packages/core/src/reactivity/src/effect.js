import { extend, isArray, isIntegerKey, isMap } from "@vue/shared";
import { recordEffectScope } from "./effectScope";
import {
  createDep,
  finalizeDepMarkers,
  initDepMarkers,
  newTracked,
  wasTracked,
} from "./dep";
const targetMap = new WeakMap();
// The number of effects currently being tracked recursively.
let effectTrackDepth = 0;
export let trackOpBit = 1;
/**
 * The bitwise track markers support at most 30 levels of recursion.
 * This value is chosen to enable modern JS engines to use a SMI on all platforms.
 * When recursion depth is greater, fall back to using a full cleanup.
 */
const maxMarkerBits = 30;
export let activeEffect;
// export const ITERATE_KEY = Symbol(__DEV__ ? 'iterate' : '');
export const ITERATE_KEY = Symbol("");
// export const MAP_KEY_ITERATE_KEY = Symbol(__DEV__ ? 'Map key iterate' : '');
export const MAP_KEY_ITERATE_KEY = Symbol("");

export class ReactiveEffect {
  constructor(fn, scheduler = null, scope) {
    this.fn = fn;
    this.scheduler = scheduler;
    this.active = true;
    this.deps = [];
    this.parent = undefined;
    recordEffectScope(this, scope);
  }
  run() {
    if (!this.active) {
      return this.fn();
    }
    let parent = activeEffect;
    let lastShouldTrack = shouldTrack;
    while (parent) {
      if (parent === this) {
        return;
      }
      parent = parent.parent;
    }
    try {
      this.parent = activeEffect;
      activeEffect = this;
      shouldTrack = true;
      trackOpBit = 1 << ++effectTrackDepth;
      if (effectTrackDepth <= maxMarkerBits) {
        initDepMarkers(this);
      } else {
        cleanupEffect(this);
      }
      return this.fn();
    } finally {
      if (effectTrackDepth <= maxMarkerBits) {
        finalizeDepMarkers(this);
      }
      trackOpBit = 1 << --effectTrackDepth;
      activeEffect = this.parent;
      shouldTrack = lastShouldTrack;
      this.parent = undefined;
      if (this.deferStop) {
        this.stop();
      }
    }
  }
  stop() {
    // stopped while running itself - defer the cleanup
    if (activeEffect === this) {
      this.deferStop = true;
    } else if (this.active) {
      cleanupEffect(this);
      if (this.onStop) {
        this.onStop();
      }
      this.active = false;
    }
  }
}
function cleanupEffect(effect) {
  const { deps } = effect;
  if (deps.length) {
    for (let i = 0; i < deps.length; i++) {
      deps[i].delete(effect);
    }
    deps.length = 0;
  }
}
export function effect(fn, options) {
  if (fn.effect) {
    fn = fn.effect.fn;
  }
  const _effect = new ReactiveEffect(fn);
  if (options) {
    extend(_effect, options);
    if (options.scope) recordEffectScope(_effect, options.scope);
  }
  if (!options || !options.lazy) {
    _effect.run();
  }
  const runner = _effect.run.bind(_effect);
  runner.effect = _effect;
  return runner;
}
export function stop(runner) {
  runner.effect.stop();
}
export let shouldTrack = true;
const trackStack = [];
export function pauseTracking() {
  trackStack.push(shouldTrack);
  shouldTrack = false;
}
export function enableTracking() {
  trackStack.push(shouldTrack);
  shouldTrack = true;
}
export function resetTracking() {
  const last = trackStack.pop();
  shouldTrack = last === undefined ? true : last;
}
export function track(target, type, key) {
  if (shouldTrack && activeEffect) {
    let depsMap = targetMap.get(target);
    if (!depsMap) {
      targetMap.set(target, (depsMap = new Map()));
    }
    let dep = depsMap.get(key);
    if (!dep) {
      depsMap.set(key, (dep = createDep()));
    }
    // const eventInfo = __DEV__
    //     ? { effect: activeEffect, target, type, key }
    //     : undefined;
    const eventInfo = undefined;
    trackEffects(dep, eventInfo);
  }
}
export function trackEffects(dep, debuggerEventExtraInfo) {
  let shouldTrack = false;
  if (effectTrackDepth <= maxMarkerBits) {
    if (!newTracked(dep)) {
      dep.n |= trackOpBit; // set newly tracked
      shouldTrack = !wasTracked(dep);
    }
  } else {
    // Full cleanup mode.
    shouldTrack = !dep.has(activeEffect);
  }
  if (shouldTrack) {
    dep.add(activeEffect);
    activeEffect.deps.push(dep);
    // if (__DEV__ && activeEffect.onTrack) {
    //     activeEffect.onTrack(Object.assign({ effect: activeEffect }, debuggerEventExtraInfo));
    // }
  }
}
export function trigger(target, type, key, newValue, oldValue, oldTarget) {
  const depsMap = targetMap.get(target);
  if (!depsMap) {
    // never been tracked
    return;
  }
  let deps = [];
  if (type === "clear" /* TriggerOpTypes.CLEAR */) {
    // collection being cleared
    // trigger all effects for target
    deps = [...depsMap.values()];
  } else if (key === "length" && isArray(target)) {
    const newLength = Number(newValue);
    depsMap.forEach((dep, key) => {
      if (key === "length" || key >= newLength) {
        deps.push(dep);
      }
    });
  } else {
    // schedule runs for SET | ADD | DELETE
    if (key !== void 0) {
      deps.push(depsMap.get(key));
    }
    // also run for iteration key on ADD | DELETE | Map.SET
    switch (type) {
      case "add" /* TriggerOpTypes.ADD */:
        if (!isArray(target)) {
          deps.push(depsMap.get(ITERATE_KEY));
          if (isMap(target)) {
            deps.push(depsMap.get(MAP_KEY_ITERATE_KEY));
          }
        } else if (isIntegerKey(key)) {
          // new index added to array -> length changes
          deps.push(depsMap.get("length"));
        }
        break;
      case "delete" /* TriggerOpTypes.DELETE */:
        if (!isArray(target)) {
          deps.push(depsMap.get(ITERATE_KEY));
          if (isMap(target)) {
            deps.push(depsMap.get(MAP_KEY_ITERATE_KEY));
          }
        }
        break;
      case "set" /* TriggerOpTypes.SET */:
        if (isMap(target)) {
          deps.push(depsMap.get(ITERATE_KEY));
        }
        break;
    }
  }
  // const eventInfo = __DEV__
  //     ? { target, type, key, newValue, oldValue, oldTarget }
  //     : undefined;
  const eventInfo = undefined;
  if (deps.length === 1) {
    if (deps[0]) {
      // if (__DEV__) {
      //     triggerEffects(deps[0], eventInfo);
      // }
      // else {
      //     triggerEffects(deps[0]);
      // }
      triggerEffects(deps[0]);
    }
  } else {
    const effects = [];
    for (const dep of deps) {
      if (dep) {
        effects.push(...dep);
      }
    }
    // if (__DEV__) {
    //     triggerEffects(createDep(effects), eventInfo);
    // }
    // else {
    //     triggerEffects(createDep(effects));
    // }
    triggerEffects(createDep(effects));
  }
}
export function triggerEffects(dep, debuggerEventExtraInfo) {
  // spread into array for stabilization
  const effects = isArray(dep) ? dep : [...dep];
  for (const effect of effects) {
    if (effect.computed) {
      triggerEffect(effect, debuggerEventExtraInfo);
    }
  }
  for (const effect of effects) {
    if (!effect.computed) {
      triggerEffect(effect, debuggerEventExtraInfo);
    }
  }
}
function triggerEffect(effect, debuggerEventExtraInfo) {
  if (effect !== activeEffect || effect.allowRecurse) {
    // if (__DEV__ && effect.onTrigger) {
    //     effect.onTrigger(extend({ effect }, debuggerEventExtraInfo));
    // }
    if (effect.scheduler) {
      effect.scheduler();
    } else {
      effect.run();
    }
  }
}
