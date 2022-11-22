var _a;
import { ReactiveEffect } from './effect';
import { trackRefValue, triggerRefValue } from './ref';
import { isFunction, NOOP } from '@vue/shared';
import { toRaw } from './reactive';
export class ComputedRefImpl {
    constructor(getter, _setter, isReadonly, isSSR) {
        this._setter = _setter;
        this.dep = undefined;
        this.__v_isRef = true;
        this[_a] = false;
        this._dirty = true;
        this.effect = new ReactiveEffect(getter, () => {
            if (!this._dirty) {
                this._dirty = true;
                triggerRefValue(this);
            }
        });
        this.effect.computed = this;
        this.effect.active = this._cacheable = !isSSR;
        this["__v_isReadonly" /* ReactiveFlags.IS_READONLY */] = isReadonly;
    }
    get value() {
        // the computed ref may get wrapped by other proxies e.g. readonly() #3376
        const self = toRaw(this);
        trackRefValue(self);
        if (self._dirty || !self._cacheable) {
            self._dirty = false;
            self._value = self.effect.run();
        }
        return self._value;
    }
    set value(newValue) {
        this._setter(newValue);
    }
}
_a = "__v_isReadonly" /* ReactiveFlags.IS_READONLY */;
export function computed(getterOrOptions, debugOptions, isSSR = false) {
    let getter;
    let setter;
    const onlyGetter = isFunction(getterOrOptions);
    if (onlyGetter) {
        getter = getterOrOptions;
        // setter = __DEV__
        //     ? () => {
        //         console.warn('Write operation failed: computed value is readonly');
        //     }
        //     : NOOP;
        setter = NOOP;
    }
    else {
        getter = getterOrOptions.get;
        setter = getterOrOptions.set;
    }
    const cRef = new ComputedRefImpl(getter, setter, onlyGetter || !setter, isSSR);
    // if (__DEV__ && debugOptions && !isSSR) {
    //     cRef.effect.onTrack = debugOptions.onTrack;
    //     cRef.effect.onTrigger = debugOptions.onTrigger;
    // }
    return cRef;
}
