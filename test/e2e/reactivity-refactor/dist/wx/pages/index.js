
var self = self || {};

self["webpackChunka_mpx"] = require("../bundle.js");
(self["webpackChunka_mpx"] = self["webpackChunka_mpx"] || []).push([[2],{

/***/ 550:
/***/ (function(__unused_webpack_module, __unused_webpack_exports, __webpack_require__) {

__webpack_require__.g.currentModuleId = "m2a1818d8"
__webpack_require__.g.currentResource = "/Users/october/Desktop/github-contrib/mpx/test/e2e/reactivity-refactor/src/pages/index.mpx"
__webpack_require__.g.currentCtor = Component
__webpack_require__.g.currentCtorType = "component"
__webpack_require__.g.currentResourceType = "page"
/* template */
__webpack_require__(551)
/* styles */
/* json */
__webpack_require__(552)
/* script */
__webpack_require__.g.currentSrcMode = "wx"
__webpack_require__(553)


/***/ }),

/***/ 553:
/***/ (function(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _mpxjs_core__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(525);

(0,_mpxjs_core__WEBPACK_IMPORTED_MODULE_0__["default"])({
  data: {
    name: 'jack',
    info: {
      address: 'shaoxing'
    },
    bookList: ['name1', 'name2', 'name3']
  },
  onLoad() {
    // this.name = 'ma'
    this.bookList.push('name4');
  }
});

/***/ }),

/***/ 551:
/***/ (function(__unused_webpack_module, __unused_webpack_exports, __webpack_require__) {

__webpack_require__.g.currentInject = {
  moduleId: "m2a1818d8",
  render: function () {
    this._c("name", this.name);
    this._i(this._c("bookList", this.bookList), function (item, index) {
      item;
    });
    this._r();
  }
};


/***/ }),

/***/ 552:
/***/ (function() {



/***/ })

},
/******/ function(__webpack_require__) { // webpackRuntimeModules
/******/ var __webpack_exec__ = function(moduleId) { return __webpack_require__(__webpack_require__.s = moduleId); }
/******/ var __webpack_exports__ = (__webpack_exec__(550));
/******/ }
]);
//# sourceMappingURL=index.js.map