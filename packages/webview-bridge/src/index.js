import loadScript from './loadscript'
let sdkReady
const SDK_URL_MAP = {
  wx: {
    url: 'https://res.wx.qq.com/open/js/jweixin-1.3.2.js'
  },
  qq: {
    url: 'https://qqq.gtimg.cn/miniprogram/webview_jssdk/qqjssdk-1.0.0.js'
  },
  ali: {
    url: 'https://appx/web-view.min.js'
  },
  baidu: {
    url: 'https://b.bdstatic.com/searchbox/icms/searchbox/js/swan-2.0.4.js'
  },
  tt: {
    url: 'https://s3.pstatp.com/toutiao/tmajssdk/jssdk.js'
  },
  ...window.sdkUrlMap
}

let env = null
let callbackId = 0
const callbacks = {}
// 环境判断
const systemUA = navigator.userAgent
if (systemUA.indexOf('AlipayClient') > -1) {
  env = 'my'
} else if (systemUA.toLowerCase().indexOf('miniprogram') > -1) {
  env = systemUA.indexOf('QQ') > -1 ? 'qq' : 'wx'
} else if (systemUA.indexOf('swan') > -1) {
  env = 'swan'
} else if (systemUA.indexOf('toutiao') > -1) {
  env = 'tt'
} else {
  env = 'web'
  window.addEventListener('message', (event) => {
    // 接收web-view的回调
    const { callbackId, error, result } = event.data
    if (callbackId !== undefined && callbacks[callbackId]) {
      if (error) {
        callbacks[callbackId](error)
      } else {
        callbacks[callbackId](null, result)
      }
      delete callbacks[callbackId]
    }
  }, false)
}

const initWebviewBridge = () => {
  sdkReady = env !== 'web' ? SDK_URL_MAP[env].url ? loadScript(SDK_URL_MAP[env].url) : Promise.reject(new Error('未找到对应的sdk')) : Promise.resolve()
  getWebviewApi()
}

let webviewSdkready = false
function runWebviewApiMethod (callback) {
  if (webviewSdkready) {
    callback()
  } else {
    sdkReady.then(() => {
      webviewSdkready = true
      callback()
    })
  }
}

const webviewBridge = {
  config (config) {
    if (env !== 'wx') {
      console.warn('非微信环境不需要配置config')
      return
    }
    runWebviewApiMethod(() => {
      if (window.wx) {
        window.wx.config(config)
      }
    })
  }
}

function filterData (data) {
  if (Object.prototype.toString.call(data) !== '[object Object]') {
    return data
  }
  const newData = {}
  for (const item in data) {
    if (typeof data[item] !== 'function') {
      newData[item] = data[item]
    }
  }
  return newData
}

function postMessage (type, data = {}) {
  if (type !== 'getEnv') {
    const currentCallbackId = ++callbackId
    callbacks[currentCallbackId] = (err, res) => {
      if (err) {
        data.fail && data.fail(err)
        data.complete && data.complete(err)
      } else {
        data.success && data.success(res)
        data.complete && data.complete(res)
      }
      delete callbacks[currentCallbackId]
    }
    window.parent.postMessage && window.parent.postMessage({
      type,
      callbackId,
      payload: filterData(data)
    }, '*')
  } else {
    data({
      webapp: true
    })
  }
}

const getWebviewApi = () => {
  const multiApiMap = {
    wx: {
      keyName: 'miniProgram',
      api: [
        'navigateTo',
        'navigateBack',
        'switchTab',
        'reLaunch',
        'redirectTo',
        'postMessage',
        'getEnv'
      ]
    },
    tt: {
      keyName: 'miniProgram',
      api: [
        'redirectTo',
        'navigateTo',
        'switchTab',
        'reLaunch',
        'navigateBack',
        'setSwipeBackModeSync',
        'postMessage',
        'getEnv',
        'checkJsApi',
        'chooseImage',
        'compressImage',
        'previewImage',
        'uploadFile',
        'getNetworkType',
        'openLocation',
        'getLocation'
      ]
    },
    swan: {
      keyName: 'webView',
      api: [
        'navigateTo',
        'navigateBack',
        'switchTab',
        'reLaunch',
        'redirectTo',
        'getEnv',
        'postMessage'
      ]
    },
    qq: {
      keyName: 'miniProgram',
      api: [
        'navigateTo',
        'navigateBack',
        'switchTab',
        'reLaunch',
        'redirectTo',
        'getEnv',
        'postMessage'
      ]
    }
  }
  const singleApiMap = {
    wx: [
      'checkJSApi',
      'chooseImage',
      'previewImage',
      'uploadImage',
      'downloadImage',
      'getLocalImgData',
      'startRecord',
      'stopRecord',
      'onVoiceRecordEnd',
      'playVoice',
      'pauseVoice',
      'stopVoice',
      'onVoicePlayEnd',
      'uploadVoice',
      'downloadVoice',
      'translateVoice',
      'getNetworkType',
      'openLocation',
      'getLocation',
      'startSearchBeacons',
      'stopSearchBeacons',
      'onSearchBeacons',
      'scanQRCode',
      'chooseCard',
      'addCard',
      'openCard'
    ],
    my: [
      'navigateTo',
      'navigateBack',
      'switchTab',
      'reLaunch',
      'redirectTo',
      'chooseImage',
      'previewImage',
      'getLocation',
      'openLocation',
      'alert',
      'showLoading',
      'hideLoading',
      'getNetworkType',
      'startShare',
      'tradePay',
      'postMessage',
      'onMessage',
      'getEnv'
    ],
    swan: [
      'makePhoneCall',
      'setClipboardData',
      'getNetworkType',
      'openLocation',
      'getLocation',
      'chooseLocation',
      'chooseImage',
      'previewImage',
      'openShare',
      'navigateToSmartProgram'
    ],
    web: [
      'navigateTo',
      'navigateBack',
      'switchTab',
      'reLaunch',
      'redirectTo',
      'getEnv',
      'postMessage',
      'getLoadError',
      'getLocation'
    ]
  }
  const multiApi = multiApiMap[env] || {}
  const singleApi = singleApiMap[env] || {}
  const multiApiLists = multiApi.api || []
  multiApiLists.forEach((item) => {
    webviewBridge[item] = (...args) => {
      runWebviewApiMethod(() => {
        window[env][multiApi.keyName][item](...args)
      })
    }
  })
  singleApi.forEach((item) => {
    webviewBridge[item] = (...args) => {
      if (env === 'web') {
        postMessage(item, ...args)
      } else if (env === 'wx') {
        runWebviewApiMethod(() => {
          window[env] && window[env].ready(() => {
            window[env][item](...args)
          })
        })
      } else {
        runWebviewApiMethod(() => {
          window[env][item](...args)
        })
      }
    }
  })
}

initWebviewBridge()

export default webviewBridge
