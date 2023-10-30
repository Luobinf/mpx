import { webHandleSuccess, webHandleFail, isTabBarPage } from '../../../common/js'
import { EventChannel } from '../event-channel'

let routeCount = 0

function redirectTo (options = {}) {
  const router = global.__mpxRouter
  if (router) {
    if (isTabBarPage(options.url, router)) {
      const res = { errMsg: 'redirectTo:fail can not redirectTo a tabBar page' }
      webHandleFail(res, options.fail, options.complete)
      return Promise.reject(res)
    }
    router.__mpxAction = {
      type: 'redirect'
    }
    if (routeCount === 0 && router.currentRoute.query.routeCount) routeCount = router.currentRoute.query.routeCount
    return new Promise((resolve, reject) => {
      router.replace(
        {
          path: options.url,
          query: {
            routeCount: ++routeCount
          }
        },
        () => {
          const res = { errMsg: 'redirectTo:ok' }
          webHandleSuccess(res, options.success, options.complete)
          resolve(res)
        },
        err => {
          const res = { errMsg: `redirectTo:fail ${err}` }
          webHandleFail(res, options.fail, options.complete)
          reject(res)
        }
      )
    })
  }
}

function navigateTo (options = {}) {
  const router = global.__mpxRouter
  if (router) {
    if (isTabBarPage(options.url, router)) {
      const res = { errMsg: 'navigateTo:fail can not navigateTo a tabBar page' }
      webHandleFail(res, options.fail, options.complete)
      return Promise.reject(res)
    }
    const eventChannel = new EventChannel()
    router.__mpxAction = {
      type: 'to',
      eventChannel
    }
    if (options.events) {
      eventChannel._addListeners(options.events)
    }
    if (routeCount === 0 && router.currentRoute.query.routeCount) routeCount = router.currentRoute.query.routeCount
    return new Promise((resolve, reject) => {
      router.push(
        {
          path: options.url,
          query: {
            routeCount: ++routeCount
          }
        },
        () => {
          const res = { errMsg: 'navigateTo:ok', eventChannel }
          webHandleSuccess(res, options.success, options.complete)
          resolve(res)
        },
        err => {
          const res = { errMsg: err }
          webHandleFail(res, options.fail, options.complete)
          reject(res)
        }
      )
    })
  }
}

function navigateBack (options = {}) {
  const router = global.__mpxRouter
  if (router) {
    let delta = options.delta || 1
    const stackLength = router.stack.length
    if (stackLength > 1 && delta >= stackLength) {
      delta = stackLength - 1
    }
    router.__mpxAction = {
      type: 'back',
      delta
    }
    router.go(-delta)
    const res = { errMsg: 'navigateBack:ok' }
    webHandleSuccess(res, options.success, options.complete)
    return Promise.resolve(res)
  }
}

function reLaunch (options = {}) {
  const router = global.__mpxRouter
  if (router) {
    if (routeCount === 0 && router.currentRoute.query.routeCount) routeCount = router.currentRoute.query.routeCount
    router.__mpxAction = {
      type: 'reLaunch',
      path: options.url,
      routeCount: ++routeCount,
      replaced: false
    }
    const delta = router.stack.length - 1
    // 在需要操作后退时，先操作后退，在beforeEach中基于当前action通过next()进行replace操作，避免部分浏览器的表现不一致
    if (delta > 0) {
      router.go(-delta)
    } else {
      router.__mpxAction.replaced = true
      return new Promise((resolve, reject) => {
        router.replace(
          {
            path: options.url,
            query: {
              routeCount
            }
          },
          () => {
            const res = { errMsg: 'reLaunch:ok' }
            webHandleSuccess(res, options.success, options.complete)
            resolve(res)
          },
          err => {
            const res = { errMsg: err }
            webHandleFail(res, options.fail, options.complete)
            !options.fail && reject(res)
          }
        )
      })
    }
    const res = { errMsg: 'reLaunch:ok' }
    webHandleSuccess(res, options.success, options.complete)
    return Promise.resolve(res)
  }
}

function switchTab (options = {}) {
  const router = global.__mpxRouter
  if (router) {
    const toRoute = router.match(options.url, router.history.current)
    const currentRoute = router.currentRoute
    if (toRoute.path !== currentRoute.path) {
      if (!isTabBarPage(options.url, router)) {
        const res = { errMsg: 'switchTab:fail can not switch to no-tabBar page!' }
        webHandleFail(res, options.fail, options.complete)
        return Promise.reject(res)
      }
      router.__mpxAction = {
        type: 'switch',
        path: options.url,
        replaced: false
      }
      const delta = router.stack.length - 1
      if (delta > 0) {
        router.go(-delta)
      } else {
        router.__mpxAction.replaced = true
        return new Promise((resolve, reject) => {
          router.replace(
            {
              path: options.url
            },
            () => {
              const res = { errMsg: 'switchTab:ok' }
              webHandleSuccess(res, options.success, options.complete)
              resolve(res)
            },
            err => {
              const res = { errMsg: err }
              webHandleFail(res, options.fail, options.complete)
              !options.fail && reject(res)
            }
          )
        })
      }
    }
    const res = { errMsg: 'switchTab:ok' }
    webHandleSuccess(res, options.success, options.complete)
    return Promise.resolve(res)
  }
}

export {
  redirectTo,
  navigateTo,
  navigateBack,
  reLaunch,
  switchTab
}
