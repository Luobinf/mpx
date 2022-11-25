// import { set, del, reactive } from '../../observer/reactive'
import { set, del, reactive } from '../../reactivity/src/reactive'
import { watch } from '../../observer/watch'
import { injectMixins } from '../../core/injectMixins'

const APIs = {
  injectMixins,
  mixin: injectMixins,
  observable: reactive,
  watch,
  set,
  delete: del
}

const InstanceAPIs = {
  $set: set,
  $delete: del
}

export {
  APIs,
  InstanceAPIs
}
