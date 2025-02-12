<template>
  <iframe ref="mpxIframe" class="mpx-iframe" :src="currentUrl" :key="currentUrl"></iframe>
</template>

<script>
  import { getCustomEvent } from './getInnerListeners'
  import { redirectTo, navigateTo, navigateBack, reLaunch, switchTab } from '@mpxjs/api-proxy/src/web/api/index'

  const eventLoad = 'load'
  const eventError = 'error'
  const eventMessage = 'message'
  const mpx = global.__mpx
  export default {
    props: {
      src: {
        type: String
      }
    },
    computed: {
      host () {
        let host = this.src.split('/')
        if (host[2]) {
          host = host[0] + '//' + host[2]
        } else {
          host = ''
        }
        return host
      },
      currentUrl () {
        if (!this.src) return ''
        const hostValidate = this.hostValidate(this.host)
        if (!hostValidate) {
          console.error('访问页面域名不符合domainWhiteLists白名单配置，请确认是否正确配置该域名白名单')
          return ''
        }
        return this.src
      },
      loadData () {
        return {
          src: this.host,
          fullUrl: this.src
        }
      }
    },
    watch: {
      currentUrl: {
        handler (value) {
          if (!value) {
            this.$emit(eventError, getCustomEvent(eventError, {
              ...this.loadData,
              errMsg: 'web-view load failed due to not in domain list'
            }, this))
          } else {
            this.$nextTick(() => {
              if (this.$refs.mpxIframe && this.mpxIframe != this.$refs.mpxIframe) {
                this.mpxIframe = this.$refs.mpxIframe
                this.mpxIframe.addEventListener('load', (event) => {
                  this.$emit(eventLoad, getCustomEvent(eventLoad, this.loadData, this))
                })
              }
            })
          }
        },
        immediate: true
      }
    },
    beforeCreate () {
      this.messageList = []
    },
    mounted () {
      window.addEventListener('message', this.messageCallback)
    },
    deactivated () {
      if (!this.messageList.length) {
        return
      }
      let data = {
        type: 'message',
        data: this.messageList
      }
      this.$emit(eventMessage, getCustomEvent(eventMessage, data, this))
    },
    destroyed () {
      window.removeEventListener('message', this.messageCallback)
      if (!this.messageList.length) {
        return
      }
      let data = {
        type: 'message',
        data: this.messageList
      }
      this.$emit(eventMessage, getCustomEvent(eventMessage, data, this))
    },
    methods: {
      messageCallback (event) {
        const hostValidate = this.hostValidate(event.origin)
        const data = event.data
        const value = data.payload
        if (!hostValidate) {
          return
        }
        let asyncCallback = null
        switch (data.type) {
          case 'postMessage':
            this.messageList.push(value)
            asyncCallback = Promise.resolve({
              errMsg: 'invokeWebappApi:ok'
            })
            break
          case 'navigateTo':
            asyncCallback = navigateTo(value)
            break
          case 'navigateBack':
            asyncCallback = value ? navigateBack(value) : navigateBack()
            break
          case 'redirectTo':
            asyncCallback = redirectTo(value)
            break
          case 'switchTab':
            asyncCallback = switchTab(value)
            break
          case 'reLaunch':
            asyncCallback = reLaunch(value)
            break
          case 'getLocation':
            const getLocation = mpx.config.webviewConfig.apiImplementations && mpx.config.webviewConfig.apiImplementations.getLocation
            if (getLocation) {
              asyncCallback = getLocation()
            } else {
              asyncCallback = Promise.reject({
                errMsg: '未在apiImplementations中配置getLocation方法'
              })
            }
            break
        }
        asyncCallback && asyncCallback.then((res) => {
          this.mpxIframe && this.mpxIframe.contentWindow && this.mpxIframe.contentWindow.postMessage && this.mpxIframe.contentWindow.postMessage({
            type: data.type,
            callbackId: data.callbackId,
            result: res
          }, event.origin)
        }).catch((error) => {
          this.mpxIframe && this.mpxIframe.contentWindow && this.mpxIframe.contentWindow.postMessage && this.mpxIframe.contentWindow.postMessage({
            type: data.type,
            callbackId: data.callbackId,
            error
          }, event.origin)
        })
      },
      hostValidate (host) {
        const hostWhitelists = mpx.config.webviewConfig && mpx.config.webviewConfig.hostWhitelists || []
        if (hostWhitelists.length) {
          return hostWhitelists.some((item) => {
            return host.endsWith(item)
          })
        } else {
          return true
        }
      }
    }
  }
</script>

<style>
  .mpx-iframe {
    width: 100%;
    height: 100%;
    position: absolute;
    left: 0;
    top: 0;
    right: 0;
    bottom: 0;
  }
</style>
