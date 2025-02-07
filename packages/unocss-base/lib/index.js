const { presetUno } = require('@unocss/preset-uno')

// eslint-disable-next-line
const remRE = /(-?[\.\d]+)rem/g

module.exports = function presetMpx (options = {}) {
  const uno = presetUno(options)
  const { baseFontSize = 37.5 } = options
  return {
    ...uno,
    name: '@mpxjs/unocss-base',
    theme: {
      ...uno.theme,
      preflightRoot: 'page'
    },
    postprocess: (util) => {
      util.entries.forEach((i) => {
        const value = i[1]
        if (typeof value === 'string' && remRE.test(value)) {
          i[1] = value.replace(remRE, (_, p1) => `${p1 * baseFontSize}rpx`)
        }
      })
    }
  }
}
