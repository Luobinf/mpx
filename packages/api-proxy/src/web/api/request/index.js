import axios from 'axios'
import { webHandleSuccess, webHandleFail } from '../../../common/js'
import RequestTask from './RequestTask'

function request (options = { url: '' }) {
  const CancelToken = axios.CancelToken
  const source = CancelToken.source()
  const requestTask = new RequestTask(source.cancel)

  let {
    data = {},
    method = 'GET',
    dataType = 'json',
    responseType = 'text',
    timeout = 60 * 1000,
    header = {},
    success = null,
    fail = null,
    complete = null
  } = options

  method = method.toUpperCase()

  if (
    method === 'POST' &&
    typeof data !== 'string' && // string 不做处理
    (header['Content-Type'] === 'application/x-www-form-urlencoded' ||
      header['content-type'] === 'application/x-www-form-urlencoded')
  ) {
    data = Object.keys(data).reduce((pre, curKey) => {
      return `${pre}&${encodeURIComponent(curKey)}=${encodeURIComponent(data[curKey])}`
    }, '').slice(1)
  }

  const rOptions = {
    method,
    url: options.url,
    data,
    headers: header,
    responseType,
    timeout,
    cancelToken: source.token,
    transitional: {
      // silent JSON parsing mode
      // `true`  - ignore JSON parsing errors and set response.data to null if parsing failed (old behaviour)
      // `false` - throw SyntaxError if JSON parsing failed (Note: responseType must be set to 'json')
      silentJSONParsing: true, // default value for the current Axios version
      // try to parse the response string as JSON even if `responseType` is not 'json'
      forcedJSONParsing: false,
      // throw ETIMEDOUT error instead of generic ECONNABORTED on request timeouts
      clarifyTimeoutError: false
    }
  }

  if (method === 'GET') {
    rOptions.params = rOptions.data || {}
    delete rOptions.data
  }

  const promise = axios(rOptions).then(res => {
    let data = res.data
    if (dataType === 'json' && typeof data === 'string') {
      try {
        data = JSON.parse(data)
      } catch (e) {
      }
    }
    const result = {
      errMsg: 'request:ok',
      data,
      statusCode: res.status,
      header: res.headers
    }
    webHandleSuccess(result, success, complete)
    return result
  }).catch(err => {
    const res = { errMsg: `request:fail ${err}` }
    webHandleFail(res, fail, complete)
    if (!fail) {
      return Promise.reject(res)
    }
  })

  promise.__returned = requestTask
  return promise
}

export {
  request
}
