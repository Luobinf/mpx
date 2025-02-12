/**
 * mpxjs webview bridge v2.8.1
 * (c) 2023 @mpxjs team
 * @license Apache
 */
function ownKeys(e, r) {
  var t = Object.keys(e);
  if (Object.getOwnPropertySymbols) {
    var o = Object.getOwnPropertySymbols(e);
    r && (o = o.filter(function (r) {
      return Object.getOwnPropertyDescriptor(e, r).enumerable;
    })), t.push.apply(t, o);
  }
  return t;
}
function _objectSpread2(e) {
  for (var r = 1; r < arguments.length; r++) {
    var t = null != arguments[r] ? arguments[r] : {};
    r % 2 ? ownKeys(Object(t), !0).forEach(function (r) {
      _defineProperty(e, r, t[r]);
    }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) {
      Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r));
    });
  }
  return e;
}
function _defineProperty(obj, key, value) {
  key = _toPropertyKey(key);
  if (key in obj) {
    Object.defineProperty(obj, key, {
      value: value,
      enumerable: true,
      configurable: true,
      writable: true
    });
  } else {
    obj[key] = value;
  }
  return obj;
}
function _toPrimitive(input, hint) {
  if (typeof input !== "object" || input === null) return input;
  var prim = input[Symbol.toPrimitive];
  if (prim !== undefined) {
    var res = prim.call(input, hint || "default");
    if (typeof res !== "object") return res;
    throw new TypeError("@@toPrimitive must return a primitive value.");
  }
  return (hint === "string" ? String : Number)(input);
}
function _toPropertyKey(arg) {
  var key = _toPrimitive(arg, "string");
  return typeof key === "symbol" ? key : String(key);
}

function loadScript(url) {
  var _ref = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {},
    _ref$time = _ref.time,
    time = _ref$time === void 0 ? 5000 : _ref$time,
    _ref$crossOrigin = _ref.crossOrigin,
    crossOrigin = _ref$crossOrigin === void 0 ? false : _ref$crossOrigin;
  function request() {
    return new Promise(function (resolve, reject) {
      var sc = document.createElement('script');
      sc.type = 'text/javascript';
      sc.async = 'async';

      // 可选地增加 crossOrigin 特性
      if (crossOrigin) {
        sc.crossOrigin = 'anonymous';
      }
      sc.onload = sc.onreadystatechange = function () {
        if (!this.readyState || /^(loaded|complete)$/.test(this.readyState)) {
          resolve();
          sc.onload = sc.onreadystatechange = null;
        }
      };
      sc.onerror = function () {
        reject(new Error("load ".concat(url, " error")));
        sc.onerror = null;
      };
      sc.src = url;
      document.getElementsByTagName('head')[0].appendChild(sc);
    });
  }
  function timeout() {
    return new Promise(function (resolve, reject) {
      setTimeout(function () {
        reject(new Error("load ".concat(url, " timeout")));
      }, time);
    });
  }
  return Promise.race([request(), timeout()]);
}

var sdkReady;
var SDK_URL_MAP = _objectSpread2({
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
  }
}, window.sdkUrlMap);
var env = null;
var callbackId = 0;
var callbacks = {};
// 环境判断
var systemUA = navigator.userAgent;
if (systemUA.indexOf('AlipayClient') > -1) {
  env = 'my';
} else if (systemUA.toLowerCase().indexOf('miniprogram') > -1) {
  env = systemUA.indexOf('QQ') > -1 ? 'qq' : 'wx';
} else if (systemUA.indexOf('swan') > -1) {
  env = 'swan';
} else if (systemUA.indexOf('toutiao') > -1) {
  env = 'tt';
} else {
  env = 'web';
  window.addEventListener('message', function (event) {
    // 接收web-view的回调
    var _event$data = event.data,
      callbackId = _event$data.callbackId,
      error = _event$data.error,
      result = _event$data.result;
    if (callbackId !== undefined && callbacks[callbackId]) {
      if (error) {
        callbacks[callbackId](error);
      } else {
        callbacks[callbackId](null, result);
      }
      delete callbacks[callbackId];
    }
  }, false);
}
var initWebviewBridge = function initWebviewBridge() {
  sdkReady = env !== 'web' ? SDK_URL_MAP[env].url ? loadScript(SDK_URL_MAP[env].url) : Promise.reject(new Error('未找到对应的sdk')) : Promise.resolve();
  getWebviewApi();
};
var webviewSdkready = false;
function runWebviewApiMethod(callback) {
  if (webviewSdkready) {
    callback();
  } else {
    sdkReady.then(function () {
      webviewSdkready = true;
      callback();
    });
  }
}
var webviewBridge = {
  config: function config(_config) {
    if (env !== 'wx') {
      console.warn('非微信环境不需要配置config');
      return;
    }
    runWebviewApiMethod(function () {
      if (window.wx) {
        window.wx.config(_config);
      }
    });
  }
};
function filterData(data) {
  if (Object.prototype.toString.call(data) !== '[object Object]') {
    return data;
  }
  var newData = {};
  for (var item in data) {
    if (typeof data[item] !== 'function') {
      newData[item] = data[item];
    }
  }
  return newData;
}
function postMessage(type) {
  var data = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
  if (type !== 'getEnv') {
    var currentCallbackId = ++callbackId;
    callbacks[currentCallbackId] = function (err, res) {
      if (err) {
        data.fail && data.fail(err);
        data.complete && data.complete(err);
      } else {
        data.success && data.success(res);
        data.complete && data.complete(res);
      }
      delete callbacks[currentCallbackId];
    };
    window.parent.postMessage && window.parent.postMessage({
      type: type,
      callbackId: callbackId,
      payload: filterData(data)
    }, '*');
  } else {
    data({
      webapp: true
    });
  }
}
var getWebviewApi = function getWebviewApi() {
  var multiApiMap = {
    wx: {
      keyName: 'miniProgram',
      api: ['navigateTo', 'navigateBack', 'switchTab', 'reLaunch', 'redirectTo', 'postMessage', 'getEnv']
    },
    tt: {
      keyName: 'miniProgram',
      api: ['redirectTo', 'navigateTo', 'switchTab', 'reLaunch', 'navigateBack', 'setSwipeBackModeSync', 'postMessage', 'getEnv', 'checkJsApi', 'chooseImage', 'compressImage', 'previewImage', 'uploadFile', 'getNetworkType', 'openLocation', 'getLocation']
    },
    swan: {
      keyName: 'webView',
      api: ['navigateTo', 'navigateBack', 'switchTab', 'reLaunch', 'redirectTo', 'getEnv', 'postMessage']
    },
    qq: {
      keyName: 'miniProgram',
      api: ['navigateTo', 'navigateBack', 'switchTab', 'reLaunch', 'redirectTo', 'getEnv', 'postMessage']
    }
  };
  var singleApiMap = {
    wx: ['checkJSApi', 'chooseImage', 'previewImage', 'uploadImage', 'downloadImage', 'getLocalImgData', 'startRecord', 'stopRecord', 'onVoiceRecordEnd', 'playVoice', 'pauseVoice', 'stopVoice', 'onVoicePlayEnd', 'uploadVoice', 'downloadVoice', 'translateVoice', 'getNetworkType', 'openLocation', 'getLocation', 'startSearchBeacons', 'stopSearchBeacons', 'onSearchBeacons', 'scanQRCode', 'chooseCard', 'addCard', 'openCard'],
    my: ['navigateTo', 'navigateBack', 'switchTab', 'reLaunch', 'redirectTo', 'chooseImage', 'previewImage', 'getLocation', 'openLocation', 'alert', 'showLoading', 'hideLoading', 'getNetworkType', 'startShare', 'tradePay', 'postMessage', 'onMessage', 'getEnv'],
    swan: ['makePhoneCall', 'setClipboardData', 'getNetworkType', 'openLocation', 'getLocation', 'chooseLocation', 'chooseImage', 'previewImage', 'openShare', 'navigateToSmartProgram'],
    web: ['navigateTo', 'navigateBack', 'switchTab', 'reLaunch', 'redirectTo', 'getEnv', 'postMessage', 'getLoadError', 'getLocation']
  };
  var multiApi = multiApiMap[env] || {};
  var singleApi = singleApiMap[env] || {};
  var multiApiLists = multiApi.api || [];
  multiApiLists.forEach(function (item) {
    webviewBridge[item] = function () {
      for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
        args[_key] = arguments[_key];
      }
      runWebviewApiMethod(function () {
        var _window$env$multiApi$;
        (_window$env$multiApi$ = window[env][multiApi.keyName])[item].apply(_window$env$multiApi$, args);
      });
    };
  });
  singleApi.forEach(function (item) {
    webviewBridge[item] = function () {
      for (var _len2 = arguments.length, args = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
        args[_key2] = arguments[_key2];
      }
      if (env === 'web') {
        postMessage.apply(void 0, [item].concat(args));
      } else if (env === 'wx') {
        runWebviewApiMethod(function () {
          window[env] && window[env].ready(function () {
            var _window$env;
            (_window$env = window[env])[item].apply(_window$env, args);
          });
        });
      } else {
        runWebviewApiMethod(function () {
          var _window$env2;
          (_window$env2 = window[env])[item].apply(_window$env2, args);
        });
      }
    };
  });
};
initWebviewBridge();

export default webviewBridge;
