import { reactive, ReactiveEffect, pauseTracking, resetTracking, effectScope, computed } from '@mpxjs/reactivity'
import { watch } from '../runtime/apiWatch'
import { queueJob, nextTick, flushPreFlushCbs } from '../runtime/scheduler'

import Mpx from '../index'
import {
  noop,
  type,
  isFunction,
  isObject,
  isEmptyObject,
  isPlainObject,
  doGetByPath,
  getByPath,
  setByPath,
  diffAndCloneA,
  hasOwn,
  proxy,
  makeMap,
  isString,
  aIsSubPathOfB,
  mergeData,
  processUndefined,
  getFirstKey,
  callWithErrorHandling,
  warn,
  error,
  getEnvObj
} from '@mpxjs/utils'
import {
  BEFORECREATE,
  CREATED,
  BEFOREMOUNT,
  MOUNTED,
  BEFOREUPDATE,
  UPDATED,
  BEFOREUNMOUNT,
  SERVERPREFETCH,
  UNMOUNTED,
  ONLOAD,
  ONSHOW,
  ONHIDE,
  ONRESIZE
} from './innerLifecycle'

let uid = 0

const envObj = getEnvObj()

class RenderTask {
  resolved = false

  constructor (instance) {
    instance.currentRenderTask = this
    this.promise = new Promise((resolve) => {
      this.resolve = resolve
    }).then(() => {
      this.resolved = true
    })
  }
}

/**
 * process renderData, remove sub node if visit parent node already
 * @param {Object} renderData
 * @return {Object} processedRenderData
 */
function preProcessRenderData (renderData) {
  // method for get key path array
  const processKeyPathMap = (keyPathMap) => {
    const keyPath = Object.keys(keyPathMap)
    return keyPath.filter((keyA) => {
      return keyPath.every((keyB) => {
        if (keyA.startsWith(keyB) && keyA !== keyB) {
          const nextChar = keyA[keyB.length]
          if (nextChar === '.' || nextChar === '[') {
            return false
          }
        }
        return true
      })
    })
  }

  const processedRenderData = {}
  const renderDataFinalKey = processKeyPathMap(renderData)
  Object.keys(renderData).forEach(item => {
    if (renderDataFinalKey.indexOf(item) > -1) {
      processedRenderData[item] = renderData[item]
    }
  })
  return processedRenderData
}

export default class MpxProxy {
  constructor (options, target, reCreated) {
    this.target = target
    this.reCreated = reCreated
    this.uid = uid++
    this.name = options.name || ''
    this.options = options
    // beforeCreate -> created -> mounted -> unmounted
    this.state = BEFORECREATE
    this.ignoreProxyMap = makeMap(Mpx.config.ignoreProxyWhiteList)
    // 收集setup中动态注册的hooks，小程序与web环境都需要
    this.hooks = {}
    if (__mpx_mode__ !== 'web') {
      this.scope = effectScope(true)
      // props响应式数据代理
      this.props = {}
      // data响应式数据代理
      this.data = {}
      // 非props key
      this.localKeysMap = {}
      // 渲染函数中收集的数据
      this.renderData = {}
      // 最小渲染数据
      this.miniRenderData = {}
      // 强制更新的数据
      this.forceUpdateData = {}
      // 下次是否需要强制更新全部渲染数据
      this.forceUpdateAll = false
      this.currentRenderTask = null
      this.propsUpdatedFlag = false
    }
    this.initApi()
  }

  created () {
    if (__mpx_mode__ !== 'web') {
      // web中BEFORECREATE钩子通过vue的beforeCreate钩子单独驱动
      this.callHook(BEFORECREATE)
      setCurrentInstance(this)
      this.initProps()
      this.initSetup()
      this.initData()
      this.initComputed()
      this.initWatch()
      unsetCurrentInstance()
    }

    this.state = CREATED
    this.callHook(CREATED)

    if (__mpx_mode__ !== 'web') {
      this.initRender()
    }

    if (this.reCreated) {
      nextTick(this.mounted.bind(this))
    }
  }

  createRenderTask (isEmptyRender) {
    if ((!this.isMounted() && this.currentRenderTask) || (this.isMounted() && isEmptyRender)) {
      return
    }
    return new RenderTask(this)
  }

  isMounted () {
    return this.state === MOUNTED
  }

  mounted () {
    if (this.state === CREATED) {
      this.state = MOUNTED
      // 用于处理refs等前置工作
      this.callHook(BEFOREMOUNT)
      this.callHook(MOUNTED)
      this.currentRenderTask && this.currentRenderTask.resolve()
    }
  }

  propsUpdated () {
    this.propsUpdatedFlag = true
    const updateJob = this.updateJob || (this.updateJob = () => {
      this.propsUpdatedFlag = false
      // 只有当前没有渲染任务时，属性更新才需要单独触发updated，否则可以由渲染任务触发updated
      if (this.currentRenderTask?.resolved && this.isMounted()) {
        this.callHook(BEFOREUPDATE)
        this.callHook(UPDATED)
      }
    })
    nextTick(updateJob)
  }

  unmounted () {
    this.callHook(BEFOREUNMOUNT)
    this.scope?.stop()
    if (this.update) this.update.active = false
    this.callHook(UNMOUNTED)
    this.state = UNMOUNTED
  }

  isUnmounted () {
    return this.state === UNMOUNTED
  }

  createProxyConflictHandler (owner) {
    return (key) => {
      if (this.ignoreProxyMap[key]) {
        !this.reCreated && error(`The ${owner} key [${key}] is a reserved keyword of miniprogram, please check and rename it.`, this.options.mpxFileResource)
        return false
      }
      !this.reCreated && error(`The ${owner} key [${key}] exist in the current instance already, please check and rename it.`, this.options.mpxFileResource)
    }
  }

  initApi () {
    // 挂载扩展属性到实例上
    proxy(this.target, Mpx.prototype, undefined, true, this.createProxyConflictHandler('mpx.prototype'))
    // 挂载混合模式下createPage中的自定义属性，模拟原生Page构造器的表现
    if (this.options.__type__ === 'page' && !this.options.__pageCtor__) {
      proxy(this.target, this.options, this.options.mpxCustomKeysForBlend, false, this.createProxyConflictHandler('page options'))
    }
    // 挂载$rawOptions
    this.target.$rawOptions = this.options
    if (__mpx_mode__ !== 'web') {
      // 挂载$watch
      this.target.$watch = this.watch.bind(this)
      // 强制执行render
      this.target.$forceUpdate = this.forceUpdate.bind(this)
      this.target.$nextTick = nextTick
    }
  }

  initProps () {
    this.props = diffAndCloneA(this.target.__getProps(this.options)).clone
    const propProxy = reactive(this.props)
    proxy(this.target, propProxy, undefined, false, this.createProxyConflictHandler('props'))
  }

  initSetup () {
    const setup = this.options.setup
    if (setup) {
      const setupResult = callWithErrorHandling(setup, this, 'setup function', [
        this.props,
        {
          triggerEvent: this.target.triggerEvent ? this.target.triggerEvent.bind(this.target) : noop,
          refs: this.target.$refs,
          asyncRefs: this.target.$asyncRefs,
          forceUpdate: this.forceUpdate.bind(this),
          selectComponent: this.target.selectComponent.bind(this.target),
          selectAllComponents: this.target.selectAllComponents.bind(this.target),
          createSelectorQuery: this.target.createSelectorQuery ? this.target.createSelectorQuery.bind(this.target) : envObj.createSelectorQuery.bind(envObj),
          createIntersectionObserver: this.target.createIntersectionObserver ? this.target.createIntersectionObserver.bind(this.target) : envObj.createIntersectionObserver.bind(envObj)
        }
      ])
      if (!isObject(setupResult)) {
        error(`Setup() should return a object, received: ${type(setupResult)}.`, this.options.mpxFileResource)
        return
      }
      proxy(this.target, setupResult, undefined, false, this.createProxyConflictHandler('setup result'))
      this.collectLocalKeys(setupResult, (key, val) => !isFunction(val))
    }
  }

  initData () {
    const data = this.options.data
    const dataFn = this.options.dataFn
    // 之所以没有直接使用initialData，而是通过对原始dataOpt进行深clone获取初始数据对象，主要是为了避免小程序自身序列化时错误地转换数据对象，比如将promise转为普通object
    this.data = diffAndCloneA(data || {}).clone
    // 执行dataFn
    if (isFunction(dataFn)) {
      Object.assign(this.data, callWithErrorHandling(dataFn.bind(this.target), this, 'data function'))
    }
    const dataProxy = reactive(this.data)
    proxy(this.target, dataProxy, undefined, false, this.createProxyConflictHandler('data'))
    this.collectLocalKeys(this.data)
  }

  initComputed () {
    const computedOpt = this.options.computed
    if (computedOpt) {
      const computedObj = {}
      Object.entries(computedOpt).forEach(([key, opt]) => {
        const get = isFunction(opt)
          ? opt.bind(this.target)
          : isFunction(opt.get)
            ? opt.get.bind(this.target)
            : noop

        const set = !isFunction(opt) && isFunction(opt.set)
          ? opt.set.bind(this.target)
          : () => warn(`Write operation failed: computed property "${key}" is readonly.`, this.options.mpxFileResource)

        computedObj[key] = computed({ get, set })
      })
      this.collectLocalKeys(computedObj)
      proxy(this.target, computedObj, undefined, false, this.createProxyConflictHandler('computed'))
    }
  }

  initWatch () {
    const watch = this.options.watch
    if (watch) {
      Object.entries(watch).forEach(([key, handler]) => {
        if (Array.isArray(handler)) {
          for (let i = 0; i < handler.length; i++) {
            this.watch(key, handler[i])
          }
        } else {
          this.watch(key, handler)
        }
      })
    }
  }

  watch (source, cb, options) {
    const target = this.target
    const getter = isString(source)
      ? () => {
        // for watch multi path string like 'a.b,c,d'
        if (source.indexOf(',') > -1) {
          return source.split(',').map(path => {
            return getByPath(target, path.trim())
          })
        } else {
          return getByPath(target, source)
        }
      }
      : source.bind(target)

    if (isObject(cb)) {
      options = cb
      cb = cb.handler
    }

    // 兼容处理: 响应式升级成Proxy时，source 为数组时，当source变更无法 watch 到数组变化的问题。将数组options设置为 true 深度监听即可
    if (isString(source)) {
      const normalizedArr = source.split(',').map(str => str.trim())
      normalizedArr.forEach(attr => {
        if (!attr) return
        if (!/[[\]]/.test(attr)) {
          attr = attr.split('.')
          if (hasOwn(target, attr[0])) {
            options.deep = true
          }
        }
      })
    }

    if (isString(cb) && target[cb]) {
      cb = target[cb]
    }

    cb = cb || noop

    const cur = currentInstance
    setCurrentInstance(this)

    const res = watch(getter, cb.bind(target), options)

    if (cur) setCurrentInstance(cur)
    else unsetCurrentInstance()

    return res
  }

  collectLocalKeys (data, filter = () => true) {
    Object.keys(data).filter((key) => filter(key, data[key])).forEach((key) => {
      this.localKeysMap[key] = true
    })
  }

  callHook (hookName, params, hooksOnly) {
    const hook = this.options[hookName]
    const hooks = this.hooks[hookName] || []
    let result
    if (isFunction(hook) && !hooksOnly) {
      result = callWithErrorHandling(hook.bind(this.target), this, `${hookName} hook`, params)
    }
    hooks.forEach((hook) => {
      result = params ? hook(...params) : hook()
    })
    return result
  }

  hasHook (hookName) {
    return !!(this.options[hookName] || this.hooks[hookName])
  }

  render () {
    const renderData = {}
    Object.keys(this.localKeysMap).forEach((key) => {
      renderData[key] = this.target[key]
    })
    this.doRender(this.processRenderDataWithStrictDiff(renderData))
  }

  renderWithData () {
    const renderData = preProcessRenderData(this.renderData)
    this.doRender(this.processRenderDataWithStrictDiff(renderData))
    // 重置renderData准备下次收集
    this.renderData = {}
  }

  processRenderDataWithDiffData (result, key, diffData) {
    Object.keys(diffData).forEach((subKey) => {
      result[key + subKey] = diffData[subKey]
    })
  }

  processRenderDataWithStrictDiff (renderData) {
    const result = {}
    for (const key in renderData) {
      if (hasOwn(renderData, key)) {
        const data = renderData[key]
        const firstKey = getFirstKey(key)
        if (!this.localKeysMap[firstKey]) {
          continue
        }
        // 外部clone，用于只需要clone的场景
        let clone
        if (hasOwn(this.miniRenderData, key)) {
          const { clone: localClone, diff, diffData } = diffAndCloneA(data, this.miniRenderData[key])
          clone = localClone
          if (diff) {
            this.miniRenderData[key] = clone
            if (diffData && Mpx.config.useStrictDiff) {
              this.processRenderDataWithDiffData(result, key, diffData)
            } else {
              result[key] = clone
            }
          }
        } else {
          let processed = false
          const miniRenderDataKeys = Object.keys(this.miniRenderData)
          for (let i = 0; i < miniRenderDataKeys.length; i++) {
            const tarKey = miniRenderDataKeys[i]
            if (aIsSubPathOfB(tarKey, key)) {
              if (!clone) clone = diffAndCloneA(data).clone
              delete this.miniRenderData[tarKey]
              this.miniRenderData[key] = result[key] = clone
              processed = true
              continue
            }
            const subPath = aIsSubPathOfB(key, tarKey)
            if (subPath) {
              if (!this.miniRenderData[tarKey]) this.miniRenderData[tarKey] = {}
              // setByPath 更新miniRenderData中的子数据
              doGetByPath(this.miniRenderData[tarKey], subPath, (current, subKey, meta) => {
                if (meta.isEnd) {
                  const { clone, diff, diffData } = diffAndCloneA(data, current[subKey])
                  if (diff) {
                    current[subKey] = clone
                    if (diffData && Mpx.config.useStrictDiff) {
                      this.processRenderDataWithDiffData(result, key, diffData)
                    } else {
                      result[key] = clone
                    }
                  }
                } else if (!current[subKey]) {
                  current[subKey] = {}
                }
                return current[subKey]
              })
              processed = true
              break
            }
          }
          if (!processed) {
            // 如果当前数据和上次的miniRenderData完全无关，但存在于组件的视图数据中，则与组件视图数据进行diff
            if (this.target.data && hasOwn(this.target.data, firstKey)) {
              const localInitialData = getByPath(this.target.data, key)
              const { clone, diff, diffData } = diffAndCloneA(data, localInitialData)
              this.miniRenderData[key] = clone
              if (diff) {
                if (diffData && Mpx.config.useStrictDiff) {
                  this.processRenderDataWithDiffData(result, key, diffData)
                } else {
                  result[key] = clone
                }
              }
            } else {
              if (!clone) clone = diffAndCloneA(data).clone
              this.miniRenderData[key] = result[key] = clone
            }
          }
        }
        if (this.forceUpdateAll) {
          if (!clone) clone = diffAndCloneA(data).clone
          this.forceUpdateData[key] = clone
        }
      }
    }
    return result
  }

  doRender (data, cb) {
    if (typeof this.target.__render !== 'function') {
      error('Please specify a [__render] function to render view.', this.options.mpxFileResource)
      return
    }
    if (typeof cb !== 'function') {
      cb = undefined
    }

    const isEmpty = isEmptyObject(data) && isEmptyObject(this.forceUpdateData)
    const renderTask = this.createRenderTask(isEmpty)

    if (isEmpty) {
      cb && cb()
      return
    }

    pauseTracking()
    // 使用forceUpdateData后清空
    if (!isEmptyObject(this.forceUpdateData)) {
      data = mergeData({}, data, this.forceUpdateData)
      this.forceUpdateData = {}
      this.forceUpdateAll = false
    }

    let callback = cb
    // mounted之后才会触发BEFOREUPDATE/UPDATED
    if (this.isMounted()) {
      this.callHook(BEFOREUPDATE)
      callback = () => {
        cb && cb()
        this.callHook(UPDATED)
        renderTask && renderTask.resolve()
      }
    }

    data = processUndefined(data)
    if (typeof Mpx.config.setDataHandler === 'function') {
      try {
        Mpx.config.setDataHandler(data, this.target)
      } catch (e) {
      }
    }

    this.target.__render(data, callback)
    resetTracking()
  }

  toggleRecurse (allowed) {
    if (this.effect && this.update) this.effect.allowRecurse = this.update.allowRecurse = allowed
  }

  updatePreRender () {
    this.toggleRecurse(false)
    pauseTracking()
    flushPreFlushCbs(undefined, this.update)
    resetTracking()
    this.toggleRecurse(true)
  }

  initRender () {
    if (this.options.__nativeRender__) return this.doRender()

    const _i = this.target._i.bind(this.target)
    const _c = this.target._c.bind(this.target)
    const _r = this.target._r.bind(this.target)
    const _sc = this.target._sc.bind(this.target)
    const effect = this.effect = new ReactiveEffect(() => {
      // pre render for props update
      if (this.propsUpdatedFlag) {
        this.updatePreRender()
      }

      if (this.target.__injectedRender) {
        try {
          return this.target.__injectedRender(_i, _c, _r, _sc)
        } catch (e) {
          warn('Failed to execute render function, degrade to full-set-data mode.', this.options.mpxFileResource, e)
          this.render()
        }
      } else {
        this.render()
      }
    }, () => queueJob(update), this.scope)

    const update = this.update = effect.run.bind(effect)
    update.id = this.uid
    // render effect允许自触发
    this.toggleRecurse(true)
    update()
  }

  forceUpdate (data, options, callback) {
    if (this.isUnmounted()) return
    if (isFunction(data)) {
      callback = data
      data = undefined
    }

    options = options || {}

    if (isFunction(options)) {
      callback = options
      options = {}
    }

    if (isPlainObject(data)) {
      Object.keys(data).forEach(key => {
        if (!this.options.__nativeRender__ && !this.localKeysMap[getFirstKey(key)]) {
          warn(`ForceUpdate data includes a props key [${key}], which may yield a unexpected result.`, this.options.mpxFileResource)
        }
        setByPath(this.target, key, data[key])
      })
      this.forceUpdateData = data
    } else {
      this.forceUpdateAll = true
    }

    if (this.effect) {
      options.sync ? this.effect.run() : this.effect.update()
    } else {
      if (this.forceUpdateAll) {
        Object.keys(this.localKeysMap).forEach((key) => {
          this.forceUpdateData[key] = diffAndCloneA(this.target[key]).clone
        })
      }
      options.sync ? this.doRender() : queueJob(this.doRender.bind(this))
    }

    if (callback) {
      callback = callback.bind(this.target)
      const doCallback = () => {
        if (this.currentRenderTask?.resolved === false) {
          this.currentRenderTask.promise.then(callback)
        } else {
          callback()
        }
      }
      options.sync ? doCallback() : nextTick(doCallback)
    }
  }
}

export let currentInstance = null

export const getCurrentInstance = () => {
  return currentInstance && { proxy: currentInstance?.target }
}

export const setCurrentInstance = (instance) => {
  currentInstance = instance
  instance?.scope?.on()
}

export const unsetCurrentInstance = () => {
  currentInstance?.scope?.off()
  currentInstance = null
}

export const injectHook = (hookName, hook, instance = currentInstance) => {
  if (instance) {
    const wrappedHook = (...args) => {
      if (instance.isUnmounted()) return
      setCurrentInstance(instance)
      const res = callWithErrorHandling(hook, instance, `${hookName} hook`, args)
      unsetCurrentInstance()
      return res
    }
    if (isFunction(hook)) (instance.hooks[hookName] || (instance.hooks[hookName] = [])).push(wrappedHook)
  }
}

export const createHook = (hookName) => (hook, instance) => injectHook(hookName, hook, instance)
// 在代码中调用以下生命周期钩子时, 将生命周期钩子注入到mpxProxy实例上
export const onBeforeMount = createHook(BEFOREMOUNT)
export const onMounted = createHook(MOUNTED)
export const onBeforeUpdate = createHook(BEFOREUPDATE)
export const onUpdated = createHook(UPDATED)
export const onBeforeUnmount = createHook(BEFOREUNMOUNT)
export const onUnmounted = createHook(UNMOUNTED)
export const onLoad = createHook(ONLOAD)
export const onShow = createHook(ONSHOW)
export const onHide = createHook(ONHIDE)
export const onResize = createHook(ONRESIZE)
export const onServerPrefetch = createHook(SERVERPREFETCH)
export const onPullDownRefresh = createHook('__onPullDownRefresh__')
export const onReachBottom = createHook('__onReachBottom__')
export const onShareAppMessage = createHook('__onShareAppMessage__')
export const onShareTimeline = createHook('__onShareTimeline__')
export const onAddToFavorites = createHook('__onAddToFavorites__')
export const onPageScroll = createHook('__onPageScroll__')
export const onTabItemTap = createHook('__onTabItemTap__')
export const onSaveExitState = createHook('__onSaveExitState__')
