"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
self["webpackHotUpdate_N_E"]("pages/_app",{

/***/ "./src/pages/_app.tsx":
/*!****************************!*\
  !*** ./src/pages/_app.tsx ***!
  \****************************/
/***/ (function(module, __webpack_exports__, __webpack_require__) {

eval(__webpack_require__.ts("__webpack_require__.r(__webpack_exports__);\n/* harmony import */ var react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react/jsx-dev-runtime */ \"./node_modules/react/jsx-dev-runtime.js\");\n/* harmony import */ var react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__);\n/* harmony import */ var _chakra_ui_react__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @chakra-ui/react */ \"./node_modules/@chakra-ui/react/dist/index.esm.js\");\n/* harmony import */ var _theme__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../theme */ \"./src/theme.tsx\");\n/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ \"./node_modules/react/index.js\");\n/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_2__);\n/* harmony import */ var _store__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../store */ \"./src/store.ts\");\n/* harmony import */ var _styles_custom_fonts_css__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../styles/custom-fonts.css */ \"./src/styles/custom-fonts.css\");\n/* harmony import */ var _styles_custom_fonts_css__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(_styles_custom_fonts_css__WEBPACK_IMPORTED_MODULE_4__);\n/* harmony import */ var _testData_json__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ../testData.json */ \"./src/testData.json\");\n/* harmony import */ var react_icons_md__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! react-icons/md */ \"./node_modules/react-icons/md/index.esm.js\");\n/* harmony import */ var _styles_colors__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ../styles/colors */ \"./src/styles/colors.ts\");\n/* harmony import */ var react_hot_toast__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! react-hot-toast */ \"./node_modules/react-hot-toast/dist/index.mjs\");\n\nvar _s = $RefreshSig$();\n\n\n\n\n\n\n\n\n\nfunction MyApp(param) {\n    let { Component , pageProps  } = param;\n    _s();\n    const setActivityData = (0,_store__WEBPACK_IMPORTED_MODULE_3__.useStore)((state)=>state.setActivityData);\n    (0,react__WEBPACK_IMPORTED_MODULE_2__.useEffect)(()=>{\n        // TODO: populate all real data from smart contracts\n        setActivityData(_testData_json__WEBPACK_IMPORTED_MODULE_5__.activity);\n    }, [\n        setActivityData\n    ]);\n    return /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(_chakra_ui_react__WEBPACK_IMPORTED_MODULE_8__.ChakraProvider, {\n        theme: _theme__WEBPACK_IMPORTED_MODULE_1__[\"default\"],\n        children: [\n            /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(\"title\", {\n                children: \"Next.js + Chakra UI\"\n            }, void 0, false, {\n                fileName: \"/Users/barrett/Tristan/Projects/HyperBridge/rift/frontend/src/pages/_app.tsx\",\n                lineNumber: 23,\n                columnNumber: 7\n            }, this),\n            /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(Component, {\n                ...pageProps\n            }, void 0, false, {\n                fileName: \"/Users/barrett/Tristan/Projects/HyperBridge/rift/frontend/src/pages/_app.tsx\",\n                lineNumber: 24,\n                columnNumber: 7\n            }, this),\n            /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(react_hot_toast__WEBPACK_IMPORTED_MODULE_7__.Toaster, {\n                toastOptions: {\n                    position: \"bottom-center\",\n                    style: {\n                        borderRadius: \"5px\",\n                        background: \"#333\",\n                        color: \"#fff\",\n                        minWidth: \"300px\",\n                        maxWidth: \"500px\",\n                        transition: \"0.2s all ease-in-out\",\n                        minHeight: \"50px\",\n                        zIndex: 2\n                    },\n                    success: {\n                        style: {\n                            // backgroundColor: '#2ECC40',\n                            background: \"linear-gradient(155deg, rgba(23,139,11,1) 0%, rgba(33,150,34,1) 42%, rgba(46,204,64,1) 100%)\"\n                        },\n                        iconTheme: {\n                            primary: \"#2ECC40\",\n                            secondary: _styles_colors__WEBPACK_IMPORTED_MODULE_6__[\"default\"].offWhite\n                        },\n                        duration: 2000\n                    },\n                    loading: {\n                        style: {\n                            background: \"linear-gradient(155deg, rgba(20,41,77,1) 0%, rgba(45,102,196,1) 42%, rgba(48,123,244,1) 100%)\"\n                        }\n                    },\n                    error: {\n                        style: {\n                            background: \"linear-gradient(155deg, rgba(140,29,30,1) 0%, rgba(163,23,24,1) 42%, rgba(219,0,2,1) 100%)\"\n                        },\n                        duration: 4000\n                    }\n                },\n                children: (t)=>/*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(react_hot_toast__WEBPACK_IMPORTED_MODULE_7__.ToastBar, {\n                        toast: t,\n                        children: (param)=>{\n                            let { icon , message  } = param;\n                            const messages = message.props.children.split(\";;\");\n                            const title = messages[0];\n                            const description = messages.length > 1 ? messages[1] : null;\n                            return /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.Fragment, {\n                                children: [\n                                    /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(_chakra_ui_react__WEBPACK_IMPORTED_MODULE_8__.Flex, {\n                                        fontFamily: \"Aux\",\n                                        h: \"100%\",\n                                        children: icon\n                                    }, void 0, false, {\n                                        fileName: \"/Users/barrett/Tristan/Projects/HyperBridge/rift/frontend/src/pages/_app.tsx\",\n                                        lineNumber: 73,\n                                        columnNumber: 19\n                                    }, this),\n                                    /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(_chakra_ui_react__WEBPACK_IMPORTED_MODULE_8__.Flex, {\n                                        // bg='black'\n                                        flex: 1,\n                                        pl: \"10px\",\n                                        pr: \"10px\",\n                                        flexDir: \"column\",\n                                        children: [\n                                            /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(_chakra_ui_react__WEBPACK_IMPORTED_MODULE_8__.Text, {\n                                                fontFamily: \"Aux\",\n                                                fontWeight: \"600\",\n                                                children: title\n                                            }, void 0, false, {\n                                                fileName: \"/Users/barrett/Tristan/Projects/HyperBridge/rift/frontend/src/pages/_app.tsx\",\n                                                lineNumber: 87,\n                                                columnNumber: 21\n                                            }, this),\n                                            description && description != \"undefined\" && /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(_chakra_ui_react__WEBPACK_IMPORTED_MODULE_8__.Text, {\n                                                fontFamily: \"Aux\",\n                                                children: description\n                                            }, void 0, false, {\n                                                fileName: \"/Users/barrett/Tristan/Projects/HyperBridge/rift/frontend/src/pages/_app.tsx\",\n                                                lineNumber: 91,\n                                                columnNumber: 23\n                                            }, this)\n                                        ]\n                                    }, void 0, true, {\n                                        fileName: \"/Users/barrett/Tristan/Projects/HyperBridge/rift/frontend/src/pages/_app.tsx\",\n                                        lineNumber: 80,\n                                        columnNumber: 19\n                                    }, this),\n                                    t.type !== \"loading\" && /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(_chakra_ui_react__WEBPACK_IMPORTED_MODULE_8__.Flex, {\n                                        p: \"3px\",\n                                        cursor: \"pointer\",\n                                        onClick: ()=>react_hot_toast__WEBPACK_IMPORTED_MODULE_7__[\"default\"].dismiss(t.id),\n                                        color: _styles_colors__WEBPACK_IMPORTED_MODULE_6__[\"default\"].offWhite,\n                                        transition: \"0.2s color ease-in-out\",\n                                        _hover: {\n                                            color: _styles_colors__WEBPACK_IMPORTED_MODULE_6__[\"default\"].textGray\n                                        },\n                                        children: /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(react_icons_md__WEBPACK_IMPORTED_MODULE_9__.MdClose, {}, void 0, false, {\n                                            fileName: \"/Users/barrett/Tristan/Projects/HyperBridge/rift/frontend/src/pages/_app.tsx\",\n                                            lineNumber: 105,\n                                            columnNumber: 23\n                                        }, this)\n                                    }, void 0, false, {\n                                        fileName: \"/Users/barrett/Tristan/Projects/HyperBridge/rift/frontend/src/pages/_app.tsx\",\n                                        lineNumber: 95,\n                                        columnNumber: 21\n                                    }, this)\n                                ]\n                            }, void 0, true);\n                        }\n                    }, void 0, false, {\n                        fileName: \"/Users/barrett/Tristan/Projects/HyperBridge/rift/frontend/src/pages/_app.tsx\",\n                        lineNumber: 66,\n                        columnNumber: 11\n                    }, this)\n            }, void 0, false, {\n                fileName: \"/Users/barrett/Tristan/Projects/HyperBridge/rift/frontend/src/pages/_app.tsx\",\n                lineNumber: 25,\n                columnNumber: 7\n            }, this)\n        ]\n    }, void 0, true, {\n        fileName: \"/Users/barrett/Tristan/Projects/HyperBridge/rift/frontend/src/pages/_app.tsx\",\n        lineNumber: 22,\n        columnNumber: 5\n    }, this);\n}\n_s(MyApp, \"EbrIUL6VYi/+sJRSQo8E4OGxJr4=\", false, function() {\n    return [\n        _store__WEBPACK_IMPORTED_MODULE_3__.useStore\n    ];\n});\n_c = MyApp;\n/* harmony default export */ __webpack_exports__[\"default\"] = (MyApp);\nvar _c;\n$RefreshReg$(_c, \"MyApp\");\n\n\n;\n    // Wrapped in an IIFE to avoid polluting the global scope\n    ;\n    (function () {\n        var _a, _b;\n        // Legacy CSS implementations will `eval` browser code in a Node.js context\n        // to extract CSS. For backwards compatibility, we need to check we're in a\n        // browser context before continuing.\n        if (typeof self !== 'undefined' &&\n            // AMP / No-JS mode does not inject these helpers:\n            '$RefreshHelpers$' in self) {\n            // @ts-ignore __webpack_module__ is global\n            var currentExports = module.exports;\n            // @ts-ignore __webpack_module__ is global\n            var prevExports = (_b = (_a = module.hot.data) === null || _a === void 0 ? void 0 : _a.prevExports) !== null && _b !== void 0 ? _b : null;\n            // This cannot happen in MainTemplate because the exports mismatch between\n            // templating and execution.\n            self.$RefreshHelpers$.registerExportsForReactRefresh(currentExports, module.id);\n            // A module can be accepted automatically based on its exports, e.g. when\n            // it is a Refresh Boundary.\n            if (self.$RefreshHelpers$.isReactRefreshBoundary(currentExports)) {\n                // Save the previous exports on update so we can compare the boundary\n                // signatures.\n                module.hot.dispose(function (data) {\n                    data.prevExports = currentExports;\n                });\n                // Unconditionally accept an update to this module, we'll check if it's\n                // still a Refresh Boundary later.\n                // @ts-ignore importMeta is replaced in the loader\n                module.hot.accept();\n                // This field is set when the previous version of this module was a\n                // Refresh Boundary, letting us know we need to check for invalidation or\n                // enqueue an update.\n                if (prevExports !== null) {\n                    // A boundary can become ineligible if its exports are incompatible\n                    // with the previous exports.\n                    //\n                    // For example, if you add/remove/change exports, we'll want to\n                    // re-execute the importing modules, and force those components to\n                    // re-render. Similarly, if you convert a class component to a\n                    // function, we want to invalidate the boundary.\n                    if (self.$RefreshHelpers$.shouldInvalidateReactRefreshBoundary(prevExports, currentExports)) {\n                        module.hot.invalidate();\n                    }\n                    else {\n                        self.$RefreshHelpers$.scheduleUpdate();\n                    }\n                }\n            }\n            else {\n                // Since we just executed the code for the module, it's possible that the\n                // new exports made it ineligible for being a boundary.\n                // We only care about the case when we were _previously_ a boundary,\n                // because we already accepted this update (accidental side effect).\n                var isNoLongerABoundary = prevExports !== null;\n                if (isNoLongerABoundary) {\n                    module.hot.invalidate();\n                }\n            }\n        }\n    })();\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiLi9zcmMvcGFnZXMvX2FwcC50c3guanMiLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7QUFBQTs7QUFBOEQ7QUFDakM7QUFFSztBQUNFO0FBRUE7QUFDSTtBQUNDO0FBQ0g7QUFDcUI7QUFFM0QsU0FBU1ksTUFBTSxLQUFrQyxFQUFFO1FBQXBDLEVBQUVDLFVBQVMsRUFBRUMsVUFBUyxFQUFZLEdBQWxDOztJQUNiLE1BQU1DLGtCQUFrQlYsZ0RBQVFBLENBQUMsQ0FBQ1csUUFBVUEsTUFBTUQsZUFBZTtJQUVqRVgsZ0RBQVNBLENBQUMsSUFBTTtRQUNkLG9EQUFvRDtRQUNwRFcsZ0JBQWdCVCxvREFBaUI7SUFDbkMsR0FBRztRQUFDUztLQUFnQjtJQUVwQixxQkFDRSw4REFBQ2YsNERBQWNBO1FBQUNHLE9BQU9BLDhDQUFLQTs7MEJBQzFCLDhEQUFDZTswQkFBTTs7Ozs7OzBCQUNQLDhEQUFDTDtnQkFBVyxHQUFHQyxTQUFTOzs7Ozs7MEJBQ3hCLDhEQUFDSCxvREFBT0E7Z0JBQ05RLGNBQWM7b0JBQ1pDLFVBQVU7b0JBQ1ZDLE9BQU87d0JBQ0xDLGNBQWM7d0JBQ2RDLFlBQVk7d0JBQ1pDLE9BQU87d0JBQ1BDLFVBQVU7d0JBQ1ZDLFVBQVU7d0JBQ1ZDLFlBQVk7d0JBQ1pDLFdBQVc7d0JBQ1hDLFFBQVE7b0JBQ1Y7b0JBQ0FDLFNBQVM7d0JBQ1BULE9BQU87NEJBQ0wsOEJBQThCOzRCQUM5QkUsWUFDRTt3QkFDSjt3QkFDQVEsV0FBVzs0QkFDVEMsU0FBUzs0QkFDVEMsV0FBV3pCLCtEQUFlO3dCQUM1Qjt3QkFDQTJCLFVBQVU7b0JBQ1o7b0JBQ0FDLFNBQVM7d0JBQ1BmLE9BQU87NEJBQ0xFLFlBQ0U7d0JBQ0o7b0JBQ0Y7b0JBQ0FjLE9BQU87d0JBQ0xoQixPQUFPOzRCQUNMRSxZQUNFO3dCQUNKO3dCQUNBWSxVQUFVO29CQUNaO2dCQUNGOzBCQUVDLENBQUNHLGtCQUNBLDhEQUFDNUIscURBQVFBO3dCQUFDRCxPQUFPNkI7a0NBQ2QsU0FBdUI7Z0NBQXRCLEVBQUVDLEtBQUksRUFBRUMsUUFBTyxFQUFFOzRCQUNqQixNQUFNQyxXQUFXLFFBQWlCQyxLQUFLLENBQUNDLFFBQVEsQ0FBQ0MsS0FBSyxDQUFDOzRCQUN2RCxNQUFNMUIsUUFBUXVCLFFBQVEsQ0FBQyxFQUFFOzRCQUN6QixNQUFNSSxjQUFjSixTQUFTSyxNQUFNLEdBQUcsSUFBSUwsUUFBUSxDQUFDLEVBQUUsR0FBRyxJQUFJOzRCQUM1RCxxQkFDRTs7a0RBQ0UsOERBQUN4QyxrREFBSUE7d0NBQ0g4QyxZQUFZO3dDQUNaQyxHQUFFO2tEQUdEVDs7Ozs7O2tEQUVILDhEQUFDdEMsa0RBQUlBO3dDQUNILGFBQWE7d0NBQ2JnRCxNQUFNO3dDQUNOQyxJQUFHO3dDQUNIQyxJQUFHO3dDQUNIQyxTQUFROzswREFFUiw4REFBQ2xELGtEQUFJQTtnREFBQzZDLFlBQVk7Z0RBQU9NLFlBQVc7MERBQ2pDbkM7Ozs7Ozs0Q0FFRjJCLGVBQWVBLGVBQWUsNkJBQzdCLDhEQUFDM0Msa0RBQUlBO2dEQUFDNkMsWUFBWTswREFBUUY7Ozs7Ozs7Ozs7OztvQ0FHN0JQLEVBQUVnQixJQUFJLEtBQUssMkJBQ1YsOERBQUNyRCxrREFBSUE7d0NBQ0hzRCxHQUFFO3dDQUNGQyxRQUFPO3dDQUNQQyxTQUFTLElBQU1oRCwrREFBYSxDQUFDNkIsRUFBRXFCLEVBQUU7d0NBQ2pDbkMsT0FBT2hCLCtEQUFlO3dDQUN0Qm1CLFlBQVc7d0NBQ1hpQyxRQUFROzRDQUNOcEMsT0FBT2hCLCtEQUFlO3dDQUN4QjtrREFFQSw0RUFBQ0QsbURBQU9BOzs7Ozs7Ozs7Ozs7d0JBS2xCOzs7Ozs7Ozs7Ozs7Ozs7OztBQU1aO0dBdkdTSzs7UUFDaUJQLDRDQUFRQTs7O0tBRHpCTztBQXlHVCwrREFBZUEsS0FBS0EsRUFBQyIsInNvdXJjZXMiOlsid2VicGFjazovL19OX0UvLi9zcmMvcGFnZXMvX2FwcC50c3g/ZjlkNiJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBDaGFrcmFQcm92aWRlciwgRmxleCwgVGV4dCB9IGZyb20gXCJAY2hha3JhLXVpL3JlYWN0XCI7XG5pbXBvcnQgdGhlbWUgZnJvbSBcIi4uL3RoZW1lXCI7XG5pbXBvcnQgSGVhZCBmcm9tIFwibmV4dC9oZWFkXCI7XG5pbXBvcnQgeyB1c2VFZmZlY3QgfSBmcm9tIFwicmVhY3RcIjtcbmltcG9ydCB7IHVzZVN0b3JlIH0gZnJvbSBcIi4uL3N0b3JlXCI7XG5pbXBvcnQgeyBBcHBQcm9wcyB9IGZyb20gXCJuZXh0L2FwcFwiO1xuaW1wb3J0IFwiLi4vc3R5bGVzL2N1c3RvbS1mb250cy5jc3NcIjtcbmltcG9ydCB0ZXN0RGF0YSBmcm9tIFwiLi4vdGVzdERhdGEuanNvblwiO1xuaW1wb3J0IHsgTWRDbG9zZSB9IGZyb20gXCJyZWFjdC1pY29ucy9tZFwiO1xuaW1wb3J0IGNvbG9ycyBmcm9tIFwiLi4vc3R5bGVzL2NvbG9yc1wiO1xuaW1wb3J0IHRvYXN0LCB7IFRvYXN0QmFyLCBUb2FzdGVyIH0gZnJvbSBcInJlYWN0LWhvdC10b2FzdFwiO1xuXG5mdW5jdGlvbiBNeUFwcCh7IENvbXBvbmVudCwgcGFnZVByb3BzIH06IEFwcFByb3BzKSB7XG4gIGNvbnN0IHNldEFjdGl2aXR5RGF0YSA9IHVzZVN0b3JlKChzdGF0ZSkgPT4gc3RhdGUuc2V0QWN0aXZpdHlEYXRhKTtcblxuICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgIC8vIFRPRE86IHBvcHVsYXRlIGFsbCByZWFsIGRhdGEgZnJvbSBzbWFydCBjb250cmFjdHNcbiAgICBzZXRBY3Rpdml0eURhdGEodGVzdERhdGEuYWN0aXZpdHkpO1xuICB9LCBbc2V0QWN0aXZpdHlEYXRhXSk7XG5cbiAgcmV0dXJuIChcbiAgICA8Q2hha3JhUHJvdmlkZXIgdGhlbWU9e3RoZW1lfT5cbiAgICAgIDx0aXRsZT5OZXh0LmpzICsgQ2hha3JhIFVJPC90aXRsZT5cbiAgICAgIDxDb21wb25lbnQgey4uLnBhZ2VQcm9wc30gLz5cbiAgICAgIDxUb2FzdGVyXG4gICAgICAgIHRvYXN0T3B0aW9ucz17e1xuICAgICAgICAgIHBvc2l0aW9uOiBcImJvdHRvbS1jZW50ZXJcIixcbiAgICAgICAgICBzdHlsZToge1xuICAgICAgICAgICAgYm9yZGVyUmFkaXVzOiBcIjVweFwiLFxuICAgICAgICAgICAgYmFja2dyb3VuZDogXCIjMzMzXCIsXG4gICAgICAgICAgICBjb2xvcjogXCIjZmZmXCIsXG4gICAgICAgICAgICBtaW5XaWR0aDogXCIzMDBweFwiLFxuICAgICAgICAgICAgbWF4V2lkdGg6IFwiNTAwcHhcIixcbiAgICAgICAgICAgIHRyYW5zaXRpb246IFwiMC4ycyBhbGwgZWFzZS1pbi1vdXRcIixcbiAgICAgICAgICAgIG1pbkhlaWdodDogXCI1MHB4XCIsXG4gICAgICAgICAgICB6SW5kZXg6IDIsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBzdWNjZXNzOiB7XG4gICAgICAgICAgICBzdHlsZToge1xuICAgICAgICAgICAgICAvLyBiYWNrZ3JvdW5kQ29sb3I6ICcjMkVDQzQwJyxcbiAgICAgICAgICAgICAgYmFja2dyb3VuZDpcbiAgICAgICAgICAgICAgICBcImxpbmVhci1ncmFkaWVudCgxNTVkZWcsIHJnYmEoMjMsMTM5LDExLDEpIDAlLCByZ2JhKDMzLDE1MCwzNCwxKSA0MiUsIHJnYmEoNDYsMjA0LDY0LDEpIDEwMCUpXCIsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgaWNvblRoZW1lOiB7XG4gICAgICAgICAgICAgIHByaW1hcnk6IFwiIzJFQ0M0MFwiLFxuICAgICAgICAgICAgICBzZWNvbmRhcnk6IGNvbG9ycy5vZmZXaGl0ZSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBkdXJhdGlvbjogMjAwMCxcbiAgICAgICAgICB9LFxuICAgICAgICAgIGxvYWRpbmc6IHtcbiAgICAgICAgICAgIHN0eWxlOiB7XG4gICAgICAgICAgICAgIGJhY2tncm91bmQ6XG4gICAgICAgICAgICAgICAgXCJsaW5lYXItZ3JhZGllbnQoMTU1ZGVnLCByZ2JhKDIwLDQxLDc3LDEpIDAlLCByZ2JhKDQ1LDEwMiwxOTYsMSkgNDIlLCByZ2JhKDQ4LDEyMywyNDQsMSkgMTAwJSlcIixcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICBlcnJvcjoge1xuICAgICAgICAgICAgc3R5bGU6IHtcbiAgICAgICAgICAgICAgYmFja2dyb3VuZDpcbiAgICAgICAgICAgICAgICBcImxpbmVhci1ncmFkaWVudCgxNTVkZWcsIHJnYmEoMTQwLDI5LDMwLDEpIDAlLCByZ2JhKDE2MywyMywyNCwxKSA0MiUsIHJnYmEoMjE5LDAsMiwxKSAxMDAlKVwiLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGR1cmF0aW9uOiA0MDAwLFxuICAgICAgICAgIH0sXG4gICAgICAgIH19XG4gICAgICA+XG4gICAgICAgIHsodCkgPT4gKFxuICAgICAgICAgIDxUb2FzdEJhciB0b2FzdD17dH0+XG4gICAgICAgICAgICB7KHsgaWNvbiwgbWVzc2FnZSB9KSA9PiB7XG4gICAgICAgICAgICAgIGNvbnN0IG1lc3NhZ2VzID0gKG1lc3NhZ2UgYXMgYW55KS5wcm9wcy5jaGlsZHJlbi5zcGxpdChcIjs7XCIpO1xuICAgICAgICAgICAgICBjb25zdCB0aXRsZSA9IG1lc3NhZ2VzWzBdO1xuICAgICAgICAgICAgICBjb25zdCBkZXNjcmlwdGlvbiA9IG1lc3NhZ2VzLmxlbmd0aCA+IDEgPyBtZXNzYWdlc1sxXSA6IG51bGw7XG4gICAgICAgICAgICAgIHJldHVybiAoXG4gICAgICAgICAgICAgICAgPD5cbiAgICAgICAgICAgICAgICAgIDxGbGV4XG4gICAgICAgICAgICAgICAgICAgIGZvbnRGYW1pbHk9e1wiQXV4XCJ9XG4gICAgICAgICAgICAgICAgICAgIGg9XCIxMDAlXCJcbiAgICAgICAgICAgICAgICAgICAgLy8gcHQ9JzVweCdcbiAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAge2ljb259XG4gICAgICAgICAgICAgICAgICA8L0ZsZXg+XG4gICAgICAgICAgICAgICAgICA8RmxleFxuICAgICAgICAgICAgICAgICAgICAvLyBiZz0nYmxhY2snXG4gICAgICAgICAgICAgICAgICAgIGZsZXg9ezF9XG4gICAgICAgICAgICAgICAgICAgIHBsPVwiMTBweFwiXG4gICAgICAgICAgICAgICAgICAgIHByPVwiMTBweFwiXG4gICAgICAgICAgICAgICAgICAgIGZsZXhEaXI9XCJjb2x1bW5cIlxuICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICA8VGV4dCBmb250RmFtaWx5PXtcIkF1eFwifSBmb250V2VpZ2h0PVwiNjAwXCI+XG4gICAgICAgICAgICAgICAgICAgICAge3RpdGxlfVxuICAgICAgICAgICAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgICAgICAgICAgIHtkZXNjcmlwdGlvbiAmJiBkZXNjcmlwdGlvbiAhPSBcInVuZGVmaW5lZFwiICYmIChcbiAgICAgICAgICAgICAgICAgICAgICA8VGV4dCBmb250RmFtaWx5PXtcIkF1eFwifT57ZGVzY3JpcHRpb259PC9UZXh0PlxuICAgICAgICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICAgICAgPC9GbGV4PlxuICAgICAgICAgICAgICAgICAge3QudHlwZSAhPT0gXCJsb2FkaW5nXCIgJiYgKFxuICAgICAgICAgICAgICAgICAgICA8RmxleFxuICAgICAgICAgICAgICAgICAgICAgIHA9XCIzcHhcIlxuICAgICAgICAgICAgICAgICAgICAgIGN1cnNvcj1cInBvaW50ZXJcIlxuICAgICAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IHRvYXN0LmRpc21pc3ModC5pZCl9XG4gICAgICAgICAgICAgICAgICAgICAgY29sb3I9e2NvbG9ycy5vZmZXaGl0ZX1cbiAgICAgICAgICAgICAgICAgICAgICB0cmFuc2l0aW9uPVwiMC4ycyBjb2xvciBlYXNlLWluLW91dFwiXG4gICAgICAgICAgICAgICAgICAgICAgX2hvdmVyPXt7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb2xvcjogY29sb3JzLnRleHRHcmF5LFxuICAgICAgICAgICAgICAgICAgICAgIH19XG4gICAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgICA8TWRDbG9zZSAvPlxuICAgICAgICAgICAgICAgICAgICA8L0ZsZXg+XG4gICAgICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICAgIDwvPlxuICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfX1cbiAgICAgICAgICA8L1RvYXN0QmFyPlxuICAgICAgICApfVxuICAgICAgPC9Ub2FzdGVyPlxuICAgIDwvQ2hha3JhUHJvdmlkZXI+XG4gICk7XG59XG5cbmV4cG9ydCBkZWZhdWx0IE15QXBwO1xuIl0sIm5hbWVzIjpbIkNoYWtyYVByb3ZpZGVyIiwiRmxleCIsIlRleHQiLCJ0aGVtZSIsInVzZUVmZmVjdCIsInVzZVN0b3JlIiwidGVzdERhdGEiLCJNZENsb3NlIiwiY29sb3JzIiwidG9hc3QiLCJUb2FzdEJhciIsIlRvYXN0ZXIiLCJNeUFwcCIsIkNvbXBvbmVudCIsInBhZ2VQcm9wcyIsInNldEFjdGl2aXR5RGF0YSIsInN0YXRlIiwiYWN0aXZpdHkiLCJ0aXRsZSIsInRvYXN0T3B0aW9ucyIsInBvc2l0aW9uIiwic3R5bGUiLCJib3JkZXJSYWRpdXMiLCJiYWNrZ3JvdW5kIiwiY29sb3IiLCJtaW5XaWR0aCIsIm1heFdpZHRoIiwidHJhbnNpdGlvbiIsIm1pbkhlaWdodCIsInpJbmRleCIsInN1Y2Nlc3MiLCJpY29uVGhlbWUiLCJwcmltYXJ5Iiwic2Vjb25kYXJ5Iiwib2ZmV2hpdGUiLCJkdXJhdGlvbiIsImxvYWRpbmciLCJlcnJvciIsInQiLCJpY29uIiwibWVzc2FnZSIsIm1lc3NhZ2VzIiwicHJvcHMiLCJjaGlsZHJlbiIsInNwbGl0IiwiZGVzY3JpcHRpb24iLCJsZW5ndGgiLCJmb250RmFtaWx5IiwiaCIsImZsZXgiLCJwbCIsInByIiwiZmxleERpciIsImZvbnRXZWlnaHQiLCJ0eXBlIiwicCIsImN1cnNvciIsIm9uQ2xpY2siLCJkaXNtaXNzIiwiaWQiLCJfaG92ZXIiLCJ0ZXh0R3JheSJdLCJzb3VyY2VSb290IjoiIn0=\n//# sourceURL=webpack-internal:///./src/pages/_app.tsx\n"));

/***/ })

});