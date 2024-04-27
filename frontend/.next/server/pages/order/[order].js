"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
(() => {
var exports = {};
exports.id = "pages/order/[order]";
exports.ids = ["pages/order/[order]"];
exports.modules = {

/***/ "./src/components/Navbar.tsx":
/*!***********************************!*\
  !*** ./src/components/Navbar.tsx ***!
  \***********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"Navbar\": () => (/* binding */ Navbar)\n/* harmony export */ });\n/* harmony import */ var react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react/jsx-dev-runtime */ \"react/jsx-dev-runtime\");\n/* harmony import */ var react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__);\n/* harmony import */ var _chakra_ui_react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @chakra-ui/react */ \"@chakra-ui/react\");\n/* harmony import */ var _chakra_ui_react__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_chakra_ui_react__WEBPACK_IMPORTED_MODULE_1__);\n/* harmony import */ var _styles_colors__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../styles/colors */ \"./src/styles/colors.ts\");\n/* harmony import */ var _hooks_useWindowSize__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../hooks/useWindowSize */ \"./src/hooks/useWindowSize.ts\");\n/* harmony import */ var next_router__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! next/router */ \"next/router\");\n/* harmony import */ var next_router__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(next_router__WEBPACK_IMPORTED_MODULE_4__);\n\n\n\n\n\nconst Navbar = ({ text , showAbout =true  })=>{\n    const { height , width  } = (0,_hooks_useWindowSize__WEBPACK_IMPORTED_MODULE_3__[\"default\"])();\n    const isMobileView = width < 600;\n    const router = (0,next_router__WEBPACK_IMPORTED_MODULE_4__.useRouter)();\n    const fontSize = isMobileView ? \"20px\" : \"20px\";\n    const handleNavigation = (route)=>{\n        router.push(route);\n    };\n    return /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(_chakra_ui_react__WEBPACK_IMPORTED_MODULE_1__.Flex, {\n        width: \"100%\",\n        direction: \"column\",\n        backdropFilter: \"blur(10px)\" // Apply blur for glass effect\n        ,\n        opacity: 0.9,\n        position: \"fixed\",\n        pb: \"20px\",\n        top: 0,\n        left: 0,\n        right: 0,\n        zIndex: 1000,\n        children: /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(_chakra_ui_react__WEBPACK_IMPORTED_MODULE_1__.Flex, {\n            direction: \"row\",\n            w: \"100%\",\n            px: \"14px\",\n            pt: \"12px\",\n            children: [\n                /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(_chakra_ui_react__WEBPACK_IMPORTED_MODULE_1__.Flex, {\n                    flex: \"1\",\n                    children: [\n                        /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(_chakra_ui_react__WEBPACK_IMPORTED_MODULE_1__.Text, {\n                            color: _styles_colors__WEBPACK_IMPORTED_MODULE_2__[\"default\"].offWhite,\n                            fontSize: \"15px\",\n                            mb: \"-10px\",\n                            children: \"Rift\"\n                        }, void 0, false, {\n                            fileName: \"/Users/barrett/Tristan/Projects/HyperBridge/rift/frontend/src/components/Navbar.tsx\",\n                            lineNumber: 37,\n                            columnNumber: 11\n                        }, undefined),\n                        \" \"\n                    ]\n                }, void 0, true, {\n                    fileName: \"/Users/barrett/Tristan/Projects/HyperBridge/rift/frontend/src/components/Navbar.tsx\",\n                    lineNumber: 36,\n                    columnNumber: 9\n                }, undefined),\n                /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(_chakra_ui_react__WEBPACK_IMPORTED_MODULE_1__.Flex, {\n                    direction: \"column\",\n                    align: \"center\",\n                    children: /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(_chakra_ui_react__WEBPACK_IMPORTED_MODULE_1__.Flex, {\n                        alignItems: \"center\",\n                        mt: \"5px\",\n                        direction: \"column\",\n                        children: /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(_chakra_ui_react__WEBPACK_IMPORTED_MODULE_1__.Text, {\n                            color: _styles_colors__WEBPACK_IMPORTED_MODULE_2__[\"default\"].offWhite,\n                            fontSize: \"15px\",\n                            mb: \"-10px\",\n                            children: \"Rift\"\n                        }, void 0, false, {\n                            fileName: \"/Users/barrett/Tristan/Projects/HyperBridge/rift/frontend/src/components/Navbar.tsx\",\n                            lineNumber: 43,\n                            columnNumber: 13\n                        }, undefined)\n                    }, void 0, false, {\n                        fileName: \"/Users/barrett/Tristan/Projects/HyperBridge/rift/frontend/src/components/Navbar.tsx\",\n                        lineNumber: 42,\n                        columnNumber: 11\n                    }, undefined)\n                }, void 0, false, {\n                    fileName: \"/Users/barrett/Tristan/Projects/HyperBridge/rift/frontend/src/components/Navbar.tsx\",\n                    lineNumber: 41,\n                    columnNumber: 9\n                }, undefined),\n                /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(_chakra_ui_react__WEBPACK_IMPORTED_MODULE_1__.Spacer, {}, void 0, false, {\n                    fileName: \"/Users/barrett/Tristan/Projects/HyperBridge/rift/frontend/src/components/Navbar.tsx\",\n                    lineNumber: 48,\n                    columnNumber: 9\n                }, undefined),\n                /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(_chakra_ui_react__WEBPACK_IMPORTED_MODULE_1__.Text, {\n                    color: _styles_colors__WEBPACK_IMPORTED_MODULE_2__[\"default\"].offWhite,\n                    fontSize: \"15px\",\n                    mb: \"-10px\",\n                    children: \"Connect Wallet\"\n                }, void 0, false, {\n                    fileName: \"/Users/barrett/Tristan/Projects/HyperBridge/rift/frontend/src/components/Navbar.tsx\",\n                    lineNumber: 49,\n                    columnNumber: 9\n                }, undefined)\n            ]\n        }, void 0, true, {\n            fileName: \"/Users/barrett/Tristan/Projects/HyperBridge/rift/frontend/src/components/Navbar.tsx\",\n            lineNumber: 35,\n            columnNumber: 7\n        }, undefined)\n    }, void 0, false, {\n        fileName: \"/Users/barrett/Tristan/Projects/HyperBridge/rift/frontend/src/components/Navbar.tsx\",\n        lineNumber: 23,\n        columnNumber: 5\n    }, undefined);\n};\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiLi9zcmMvY29tcG9uZW50cy9OYXZiYXIudHN4LmpzIiwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7OztBQUFBO0FBQThFO0FBQ3hDO0FBQ2E7QUFDWDtBQVFqQyxNQUFNTSxTQUFTLENBQUMsRUFBRUMsS0FBSSxFQUFFQyxXQUFZLElBQUksR0FBUyxHQUFLO0lBQzNELE1BQU0sRUFBRUMsT0FBTSxFQUFFQyxNQUFLLEVBQUUsR0FBR04sZ0VBQWFBO0lBQ3ZDLE1BQU1PLGVBQWVELFFBQVE7SUFDN0IsTUFBTUUsU0FBU1Asc0RBQVNBO0lBQ3hCLE1BQU1RLFdBQVdGLGVBQWUsU0FBUyxNQUFNO0lBRS9DLE1BQU1HLG1CQUFtQixDQUFDQyxRQUFrQjtRQUMxQ0gsT0FBT0ksSUFBSSxDQUFDRDtJQUNkO0lBRUEscUJBQ0UsOERBQUNmLGtEQUFJQTtRQUNIVSxPQUFNO1FBQ05PLFdBQVc7UUFDWEMsZ0JBQWUsYUFBYSw4QkFBOEI7O1FBQzFEQyxTQUFTO1FBQ1RDLFVBQVM7UUFDVEMsSUFBRztRQUNIQyxLQUFLO1FBQ0xDLE1BQU07UUFDTkMsT0FBTztRQUNQQyxRQUFRO2tCQUVSLDRFQUFDekIsa0RBQUlBO1lBQUNpQixXQUFVO1lBQU1TLEdBQUU7WUFBT0MsSUFBSTtZQUFRQyxJQUFHOzs4QkFDNUMsOERBQUM1QixrREFBSUE7b0JBQUM2QixNQUFLOztzQ0FDVCw4REFBQzNCLGtEQUFJQTs0QkFBQzRCLE9BQU8zQiwrREFBZTs0QkFBRVUsVUFBVTs0QkFBUW1CLElBQUc7c0NBQVE7Ozs7Ozt3QkFFbkQ7Ozs7Ozs7OEJBRVYsOERBQUNoQyxrREFBSUE7b0JBQUNpQixXQUFVO29CQUFTZ0IsT0FBTzs4QkFDOUIsNEVBQUNqQyxrREFBSUE7d0JBQUNrQyxZQUFXO3dCQUFTQyxJQUFHO3dCQUFNbEIsV0FBVTtrQ0FDM0MsNEVBQUNmLGtEQUFJQTs0QkFBQzRCLE9BQU8zQiwrREFBZTs0QkFBRVUsVUFBVTs0QkFBUW1CLElBQUc7c0NBQVE7Ozs7Ozs7Ozs7Ozs7Ozs7OEJBSy9ELDhEQUFDL0Isb0RBQU1BOzs7Ozs4QkFDUCw4REFBQ0Msa0RBQUlBO29CQUFDNEIsT0FBTzNCLCtEQUFlO29CQUFFVSxVQUFVO29CQUFRbUIsSUFBRzs4QkFBUTs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFPbkUsRUFBRSIsInNvdXJjZXMiOlsid2VicGFjazovLy8uL3NyYy9jb21wb25lbnRzL05hdmJhci50c3g/OWE2ZCJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBCb3gsIEJ1dHRvbiwgRmxleCwgRmxleFByb3BzLCBTcGFjZXIsIFRleHQgfSBmcm9tIFwiQGNoYWtyYS11aS9yZWFjdFwiO1xuaW1wb3J0IGNvbG9ycyBmcm9tIFwiLi4vc3R5bGVzL2NvbG9yc1wiO1xuaW1wb3J0IHVzZVdpbmRvd1NpemUgZnJvbSBcIi4uL2hvb2tzL3VzZVdpbmRvd1NpemVcIjtcbmltcG9ydCB7IHVzZVJvdXRlciB9IGZyb20gXCJuZXh0L3JvdXRlclwiO1xuaW1wb3J0IHsgSW9NZW51IH0gZnJvbSBcInJlYWN0LWljb25zL2lvNVwiO1xuXG5pbnRlcmZhY2UgUHJvcHMgZXh0ZW5kcyBGbGV4UHJvcHMge1xuICB0ZXh0Pzogc3RyaW5nO1xuICBzaG93QWJvdXQ/OiBib29sZWFuO1xufVxuXG5leHBvcnQgY29uc3QgTmF2YmFyID0gKHsgdGV4dCwgc2hvd0Fib3V0ID0gdHJ1ZSB9OiBQcm9wcykgPT4ge1xuICBjb25zdCB7IGhlaWdodCwgd2lkdGggfSA9IHVzZVdpbmRvd1NpemUoKTtcbiAgY29uc3QgaXNNb2JpbGVWaWV3ID0gd2lkdGggPCA2MDA7XG4gIGNvbnN0IHJvdXRlciA9IHVzZVJvdXRlcigpO1xuICBjb25zdCBmb250U2l6ZSA9IGlzTW9iaWxlVmlldyA/IFwiMjBweFwiIDogXCIyMHB4XCI7XG5cbiAgY29uc3QgaGFuZGxlTmF2aWdhdGlvbiA9IChyb3V0ZTogc3RyaW5nKSA9PiB7XG4gICAgcm91dGVyLnB1c2gocm91dGUpO1xuICB9O1xuXG4gIHJldHVybiAoXG4gICAgPEZsZXhcbiAgICAgIHdpZHRoPVwiMTAwJVwiXG4gICAgICBkaXJlY3Rpb249e1wiY29sdW1uXCJ9XG4gICAgICBiYWNrZHJvcEZpbHRlcj1cImJsdXIoMTBweClcIiAvLyBBcHBseSBibHVyIGZvciBnbGFzcyBlZmZlY3RcbiAgICAgIG9wYWNpdHk9ezAuOX1cbiAgICAgIHBvc2l0aW9uPVwiZml4ZWRcIlxuICAgICAgcGI9XCIyMHB4XCJcbiAgICAgIHRvcD17MH1cbiAgICAgIGxlZnQ9ezB9XG4gICAgICByaWdodD17MH1cbiAgICAgIHpJbmRleD17MTAwMH0gLy8gRW5zdXJlIGl0J3MgYWJvdmUgb3RoZXIgY29udGVudFxuICAgID5cbiAgICAgIDxGbGV4IGRpcmVjdGlvbj1cInJvd1wiIHc9XCIxMDAlXCIgcHg9e1wiMTRweFwifSBwdD1cIjEycHhcIj5cbiAgICAgICAgPEZsZXggZmxleD1cIjFcIj5cbiAgICAgICAgICA8VGV4dCBjb2xvcj17Y29sb3JzLm9mZldoaXRlfSBmb250U2l6ZT17XCIxNXB4XCJ9IG1iPVwiLTEwcHhcIj5cbiAgICAgICAgICAgIFJpZnRcbiAgICAgICAgICA8L1RleHQ+e1wiIFwifVxuICAgICAgICA8L0ZsZXg+XG4gICAgICAgIDxGbGV4IGRpcmVjdGlvbj1cImNvbHVtblwiIGFsaWduPXtcImNlbnRlclwifT5cbiAgICAgICAgICA8RmxleCBhbGlnbkl0ZW1zPVwiY2VudGVyXCIgbXQ9XCI1cHhcIiBkaXJlY3Rpb249XCJjb2x1bW5cIj5cbiAgICAgICAgICAgIDxUZXh0IGNvbG9yPXtjb2xvcnMub2ZmV2hpdGV9IGZvbnRTaXplPXtcIjE1cHhcIn0gbWI9XCItMTBweFwiPlxuICAgICAgICAgICAgICBSaWZ0XG4gICAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgPC9GbGV4PlxuICAgICAgICA8L0ZsZXg+XG4gICAgICAgIDxTcGFjZXIgLz5cbiAgICAgICAgPFRleHQgY29sb3I9e2NvbG9ycy5vZmZXaGl0ZX0gZm9udFNpemU9e1wiMTVweFwifSBtYj1cIi0xMHB4XCI+XG4gICAgICAgICAgQ29ubmVjdCBXYWxsZXRcbiAgICAgICAgPC9UZXh0PlxuICAgICAgPC9GbGV4PlxuICAgICAgey8qIDxGbGV4IGFsaWduSXRlbXM9XCJjZW50ZXJcIiBqdXN0aWZ5Q29udGVudD1cImNlbnRlclwiIGRpcmVjdGlvbj1cImNvbHVtblwiPjwvRmxleD4gKi99XG4gICAgPC9GbGV4PlxuICApO1xufTtcbiJdLCJuYW1lcyI6WyJGbGV4IiwiU3BhY2VyIiwiVGV4dCIsImNvbG9ycyIsInVzZVdpbmRvd1NpemUiLCJ1c2VSb3V0ZXIiLCJOYXZiYXIiLCJ0ZXh0Iiwic2hvd0Fib3V0IiwiaGVpZ2h0Iiwid2lkdGgiLCJpc01vYmlsZVZpZXciLCJyb3V0ZXIiLCJmb250U2l6ZSIsImhhbmRsZU5hdmlnYXRpb24iLCJyb3V0ZSIsInB1c2giLCJkaXJlY3Rpb24iLCJiYWNrZHJvcEZpbHRlciIsIm9wYWNpdHkiLCJwb3NpdGlvbiIsInBiIiwidG9wIiwibGVmdCIsInJpZ2h0IiwiekluZGV4IiwidyIsInB4IiwicHQiLCJmbGV4IiwiY29sb3IiLCJvZmZXaGl0ZSIsIm1iIiwiYWxpZ24iLCJhbGlnbkl0ZW1zIiwibXQiXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///./src/components/Navbar.tsx\n");

/***/ }),

/***/ "./src/hooks/useWindowSize.ts":
/*!************************************!*\
  !*** ./src/hooks/useWindowSize.ts ***!
  \************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"default\": () => (/* binding */ useWindowSize)\n/* harmony export */ });\n/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ \"react\");\n/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);\n\nfunction useWindowSize() {\n    // Initialize state with undefined width/height so server and client renders match\n    const [windowSize, setWindowSize] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)({\n        width: undefined,\n        height: undefined\n    });\n    (0,react__WEBPACK_IMPORTED_MODULE_0__.useEffect)(()=>{\n        // only execute all the code below in client side\n        // Handler to call on window resize\n        const handleResize = ()=>{\n            // Set window width/height to state\n            setWindowSize({\n                width: window.innerWidth,\n                height: window.innerHeight\n            });\n        };\n        // Add event listener\n        window.addEventListener(\"resize\", handleResize);\n        // Call handler right away so state gets updated with initial window size\n        handleResize();\n        // Remove event listener on cleanup\n        return ()=>window.removeEventListener(\"resize\", handleResize);\n    }, []); // Empty array ensures that effect is only run on mount\n    return windowSize;\n}\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiLi9zcmMvaG9va3MvdXNlV2luZG93U2l6ZS50cy5qcyIsIm1hcHBpbmdzIjoiOzs7Ozs7QUFBNEM7QUFFN0IsU0FBU0UsZ0JBQWdCO0lBQ3RDLGtGQUFrRjtJQUNsRixNQUFNLENBQUNDLFlBQVlDLGNBQWMsR0FBR0osK0NBQVFBLENBQUM7UUFDM0NLLE9BQU9DO1FBQ1BDLFFBQVFEO0lBQ1Y7SUFFQUwsZ0RBQVNBLENBQUMsSUFBTTtRQUNkLGlEQUFpRDtRQUNqRCxtQ0FBbUM7UUFDbkMsTUFBTU8sZUFBZSxJQUFNO1lBQ3pCLG1DQUFtQztZQUNuQ0osY0FBYztnQkFDWkMsT0FBT0ksT0FBT0MsVUFBVTtnQkFDeEJILFFBQVFFLE9BQU9FLFdBQVc7WUFDNUI7UUFDRjtRQUVBLHFCQUFxQjtRQUNyQkYsT0FBT0csZ0JBQWdCLENBQUMsVUFBVUo7UUFFbEMseUVBQXlFO1FBQ3pFQTtRQUVBLG1DQUFtQztRQUNuQyxPQUFPLElBQU1DLE9BQU9JLG1CQUFtQixDQUFDLFVBQVVMO0lBQ3BELEdBQUcsRUFBRSxHQUFHLHVEQUF1RDtJQUMvRCxPQUFPTDtBQUNULENBQUMiLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly8vLi9zcmMvaG9va3MvdXNlV2luZG93U2l6ZS50cz80ZTk4Il0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IHVzZVN0YXRlLCB1c2VFZmZlY3QgfSBmcm9tICdyZWFjdCc7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIHVzZVdpbmRvd1NpemUoKSB7XG4gIC8vIEluaXRpYWxpemUgc3RhdGUgd2l0aCB1bmRlZmluZWQgd2lkdGgvaGVpZ2h0IHNvIHNlcnZlciBhbmQgY2xpZW50IHJlbmRlcnMgbWF0Y2hcbiAgY29uc3QgW3dpbmRvd1NpemUsIHNldFdpbmRvd1NpemVdID0gdXNlU3RhdGUoe1xuICAgIHdpZHRoOiB1bmRlZmluZWQsXG4gICAgaGVpZ2h0OiB1bmRlZmluZWQsXG4gIH0pO1xuXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgLy8gb25seSBleGVjdXRlIGFsbCB0aGUgY29kZSBiZWxvdyBpbiBjbGllbnQgc2lkZVxuICAgIC8vIEhhbmRsZXIgdG8gY2FsbCBvbiB3aW5kb3cgcmVzaXplXG4gICAgY29uc3QgaGFuZGxlUmVzaXplID0gKCkgPT4ge1xuICAgICAgLy8gU2V0IHdpbmRvdyB3aWR0aC9oZWlnaHQgdG8gc3RhdGVcbiAgICAgIHNldFdpbmRvd1NpemUoe1xuICAgICAgICB3aWR0aDogd2luZG93LmlubmVyV2lkdGgsXG4gICAgICAgIGhlaWdodDogd2luZG93LmlubmVySGVpZ2h0LFxuICAgICAgfSk7XG4gICAgfVxuICAgIFxuICAgIC8vIEFkZCBldmVudCBsaXN0ZW5lclxuICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKFwicmVzaXplXCIsIGhhbmRsZVJlc2l6ZSk7XG4gICAgIFxuICAgIC8vIENhbGwgaGFuZGxlciByaWdodCBhd2F5IHNvIHN0YXRlIGdldHMgdXBkYXRlZCB3aXRoIGluaXRpYWwgd2luZG93IHNpemVcbiAgICBoYW5kbGVSZXNpemUoKTtcbiAgICBcbiAgICAvLyBSZW1vdmUgZXZlbnQgbGlzdGVuZXIgb24gY2xlYW51cFxuICAgIHJldHVybiAoKSA9PiB3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcihcInJlc2l6ZVwiLCBoYW5kbGVSZXNpemUpO1xuICB9LCBbXSk7IC8vIEVtcHR5IGFycmF5IGVuc3VyZXMgdGhhdCBlZmZlY3QgaXMgb25seSBydW4gb24gbW91bnRcbiAgcmV0dXJuIHdpbmRvd1NpemU7XG59Il0sIm5hbWVzIjpbInVzZVN0YXRlIiwidXNlRWZmZWN0IiwidXNlV2luZG93U2l6ZSIsIndpbmRvd1NpemUiLCJzZXRXaW5kb3dTaXplIiwid2lkdGgiLCJ1bmRlZmluZWQiLCJoZWlnaHQiLCJoYW5kbGVSZXNpemUiLCJ3aW5kb3ciLCJpbm5lcldpZHRoIiwiaW5uZXJIZWlnaHQiLCJhZGRFdmVudExpc3RlbmVyIiwicmVtb3ZlRXZlbnRMaXN0ZW5lciJdLCJzb3VyY2VSb290IjoiIn0=\n//# sourceURL=webpack-internal:///./src/hooks/useWindowSize.ts\n");

/***/ }),

/***/ "./src/pages/order/[order].tsx":
/*!*************************************!*\
  !*** ./src/pages/order/[order].tsx ***!
  \*************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"default\": () => (__WEBPACK_DEFAULT_EXPORT__)\n/* harmony export */ });\n/* harmony import */ var react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react/jsx-dev-runtime */ \"react/jsx-dev-runtime\");\n/* harmony import */ var react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__);\n/* harmony import */ var next_router__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! next/router */ \"next/router\");\n/* harmony import */ var next_router__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(next_router__WEBPACK_IMPORTED_MODULE_1__);\n/* harmony import */ var _chakra_ui_react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @chakra-ui/react */ \"@chakra-ui/react\");\n/* harmony import */ var _chakra_ui_react__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(_chakra_ui_react__WEBPACK_IMPORTED_MODULE_2__);\n/* harmony import */ var _components_Navbar__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../../components/Navbar */ \"./src/components/Navbar.tsx\");\n/* harmony import */ var _styles_colors__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../../styles/colors */ \"./src/styles/colors.ts\");\n\n\n\n\n\nconst ProjectPage = ()=>{\n    const router = (0,next_router__WEBPACK_IMPORTED_MODULE_1__.useRouter)();\n    const { slug  } = router.query;\n    return /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(_chakra_ui_react__WEBPACK_IMPORTED_MODULE_2__.Flex, {\n        direction: \"column\",\n        children: [\n            /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(_components_Navbar__WEBPACK_IMPORTED_MODULE_3__.Navbar, {}, void 0, false, {\n                fileName: \"/Users/barrett/Tristan/Projects/HyperBridge/rift/frontend/src/pages/order/[order].tsx\",\n                lineNumber: 23,\n                columnNumber: 7\n            }, undefined),\n            /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(_chakra_ui_react__WEBPACK_IMPORTED_MODULE_2__.Center, {\n                flexDirection: \"column\",\n                my: \"15px\",\n                pt: \"128px\",\n                children: /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(_chakra_ui_react__WEBPACK_IMPORTED_MODULE_2__.Text, {\n                    color: _styles_colors__WEBPACK_IMPORTED_MODULE_4__[\"default\"].offWhite,\n                    fontSize: \"30px\",\n                    fontWeight: \"bold\",\n                    children: \"RIFT\"\n                }, void 0, false, {\n                    fileName: \"/Users/barrett/Tristan/Projects/HyperBridge/rift/frontend/src/pages/order/[order].tsx\",\n                    lineNumber: 25,\n                    columnNumber: 9\n                }, undefined)\n            }, void 0, false, {\n                fileName: \"/Users/barrett/Tristan/Projects/HyperBridge/rift/frontend/src/pages/order/[order].tsx\",\n                lineNumber: 24,\n                columnNumber: 7\n            }, undefined)\n        ]\n    }, void 0, true, {\n        fileName: \"/Users/barrett/Tristan/Projects/HyperBridge/rift/frontend/src/pages/order/[order].tsx\",\n        lineNumber: 22,\n        columnNumber: 5\n    }, undefined);\n};\n/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ProjectPage);\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiLi9zcmMvcGFnZXMvb3JkZXIvW29yZGVyXS50c3guanMiLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7O0FBQUE7QUFDd0M7QUFVZDtBQUN1QjtBQUNSO0FBR3pDLE1BQU1NLGNBQWMsSUFBTTtJQUN4QixNQUFNQyxTQUFTUCxzREFBU0E7SUFDeEIsTUFBTSxFQUFFUSxLQUFJLEVBQUUsR0FBR0QsT0FBT0UsS0FBSztJQUU3QixxQkFDRSw4REFBQ1Asa0RBQUlBO1FBQUNRLFdBQVc7OzBCQUNmLDhEQUFDTixzREFBTUE7Ozs7OzBCQUNQLDhEQUFDRCxvREFBTUE7Z0JBQUNRLGVBQWM7Z0JBQVNDLElBQUc7Z0JBQU9DLElBQUc7MEJBQzFDLDRFQUFDWixrREFBSUE7b0JBQUNhLE9BQU9ULCtEQUFlO29CQUFFVyxVQUFTO29CQUFPQyxZQUFXOzhCQUFPOzs7Ozs7Ozs7Ozs7Ozs7OztBQU14RTtBQUVBLGlFQUFlWCxXQUFXQSxFQUFDIiwic291cmNlcyI6WyJ3ZWJwYWNrOi8vLy4vc3JjL3BhZ2VzL29yZGVyL1tvcmRlcl0udHN4P2ZiYjAiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgdXNlU3RhdGUgfSBmcm9tIFwicmVhY3RcIjtcbmltcG9ydCB7IHVzZVJvdXRlciB9IGZyb20gXCJuZXh0L3JvdXRlclwiO1xuaW1wb3J0IHsgdXNlU3RvcmUgfSBmcm9tIFwiLi4vLi4vc3RvcmVcIjtcbmltcG9ydCB7XG4gIFRleHQsXG4gIEZsZXgsXG4gIEltYWdlLFxuICBDZW50ZXIsXG4gIEJveCxcbiAgQnV0dG9uLFxuICBjb2xvcixcbn0gZnJvbSBcIkBjaGFrcmEtdWkvcmVhY3RcIjtcbmltcG9ydCB7IE5hdmJhciB9IGZyb20gXCIuLi8uLi9jb21wb25lbnRzL05hdmJhclwiO1xuaW1wb3J0IGNvbG9ycyBmcm9tIFwiLi4vLi4vc3R5bGVzL2NvbG9yc1wiO1xuaW1wb3J0IHsgQ2F0ZWdvcnlUYWcgfSBmcm9tIFwiLi4vLi4vY29tcG9uZW50cy9DYXRlZ29yeVRhZ1wiO1xuXG5jb25zdCBQcm9qZWN0UGFnZSA9ICgpID0+IHtcbiAgY29uc3Qgcm91dGVyID0gdXNlUm91dGVyKCk7XG4gIGNvbnN0IHsgc2x1ZyB9ID0gcm91dGVyLnF1ZXJ5O1xuXG4gIHJldHVybiAoXG4gICAgPEZsZXggZGlyZWN0aW9uPXtcImNvbHVtblwifT5cbiAgICAgIDxOYXZiYXIgLz5cbiAgICAgIDxDZW50ZXIgZmxleERpcmVjdGlvbj1cImNvbHVtblwiIG15PVwiMTVweFwiIHB0PVwiMTI4cHhcIj5cbiAgICAgICAgPFRleHQgY29sb3I9e2NvbG9ycy5vZmZXaGl0ZX0gZm9udFNpemU9XCIzMHB4XCIgZm9udFdlaWdodD1cImJvbGRcIj5cbiAgICAgICAgICBSSUZUXG4gICAgICAgIDwvVGV4dD5cbiAgICAgIDwvQ2VudGVyPlxuICAgIDwvRmxleD5cbiAgKTtcbn07XG5cbmV4cG9ydCBkZWZhdWx0IFByb2plY3RQYWdlO1xuIl0sIm5hbWVzIjpbInVzZVJvdXRlciIsIlRleHQiLCJGbGV4IiwiQ2VudGVyIiwiTmF2YmFyIiwiY29sb3JzIiwiUHJvamVjdFBhZ2UiLCJyb3V0ZXIiLCJzbHVnIiwicXVlcnkiLCJkaXJlY3Rpb24iLCJmbGV4RGlyZWN0aW9uIiwibXkiLCJwdCIsImNvbG9yIiwib2ZmV2hpdGUiLCJmb250U2l6ZSIsImZvbnRXZWlnaHQiXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///./src/pages/order/[order].tsx\n");

/***/ }),

/***/ "./src/styles/colors.ts":
/*!******************************!*\
  !*** ./src/styles/colors.ts ***!
  \******************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"default\": () => (__WEBPACK_DEFAULT_EXPORT__)\n/* harmony export */ });\n/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ({\n    primaryBlue: \"#307BF4\",\n    secondaryBlue: \"#3664AF\",\n    tertiaryBlue: \"#213f72\",\n    lightBlue: \"#595C61\",\n    offWhite: \"#FAF4E8\",\n    offBlack: \"#0e0e0e\",\n    textGray: \"#A8A8A8\",\n    backgroundGray: \"#1b1b1b\",\n    editorGray: \"#121212\",\n    appbarGray: \"#282828\",\n    innerGray: \"#343434\",\n    gray: \"#BFBFBF\",\n    lightGray: \"#808080\",\n    darkGray: \"#4A4A4A\",\n    newGray: \"#9F9F9F\",\n    darkerGray: \"#2c3035\",\n    redFaded: \"#AD2B2B\",\n    redLight: \"#fa4142\",\n    red: \"red\"\n});\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiLi9zcmMvc3R5bGVzL2NvbG9ycy50cy5qcyIsIm1hcHBpbmdzIjoiOzs7O0FBQUEsaUVBQWU7SUFDYkEsYUFBYTtJQUNiQyxlQUFlO0lBQ2ZDLGNBQWM7SUFDZEMsV0FBVztJQUVYQyxVQUFVO0lBQ1ZDLFVBQVU7SUFFVkMsVUFBVTtJQUVWQyxnQkFBZ0I7SUFDaEJDLFlBQVk7SUFDWkMsWUFBWTtJQUNaQyxXQUFXO0lBRVhDLE1BQU07SUFDTkMsV0FBVztJQUNYQyxVQUFVO0lBQ1ZDLFNBQVM7SUFDVEMsWUFBWTtJQUVaQyxVQUFVO0lBQ1ZDLFVBQVU7SUFDVkMsS0FBSztBQUNQLENBQUMsRUFBQyIsInNvdXJjZXMiOlsid2VicGFjazovLy8uL3NyYy9zdHlsZXMvY29sb3JzLnRzPzI2MDMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQge1xuICBwcmltYXJ5Qmx1ZTogXCIjMzA3QkY0XCIsXG4gIHNlY29uZGFyeUJsdWU6IFwiIzM2NjRBRlwiLFxuICB0ZXJ0aWFyeUJsdWU6IFwiIzIxM2Y3MlwiLFxuICBsaWdodEJsdWU6IFwiIzU5NUM2MVwiLFxuXG4gIG9mZldoaXRlOiBcIiNGQUY0RThcIixcbiAgb2ZmQmxhY2s6IFwiIzBlMGUwZVwiLFxuXG4gIHRleHRHcmF5OiBcIiNBOEE4QThcIixcblxuICBiYWNrZ3JvdW5kR3JheTogXCIjMWIxYjFiXCIsXG4gIGVkaXRvckdyYXk6IFwiIzEyMTIxMlwiLFxuICBhcHBiYXJHcmF5OiBcIiMyODI4MjhcIixcbiAgaW5uZXJHcmF5OiBcIiMzNDM0MzRcIixcblxuICBncmF5OiBcIiNCRkJGQkZcIixcbiAgbGlnaHRHcmF5OiBcIiM4MDgwODBcIixcbiAgZGFya0dyYXk6IFwiIzRBNEE0QVwiLFxuICBuZXdHcmF5OiBcIiM5RjlGOUZcIixcbiAgZGFya2VyR3JheTogXCIjMmMzMDM1XCIsXG5cbiAgcmVkRmFkZWQ6IFwiI0FEMkIyQlwiLFxuICByZWRMaWdodDogXCIjZmE0MTQyXCIsXG4gIHJlZDogXCJyZWRcIixcbn07XG4iXSwibmFtZXMiOlsicHJpbWFyeUJsdWUiLCJzZWNvbmRhcnlCbHVlIiwidGVydGlhcnlCbHVlIiwibGlnaHRCbHVlIiwib2ZmV2hpdGUiLCJvZmZCbGFjayIsInRleHRHcmF5IiwiYmFja2dyb3VuZEdyYXkiLCJlZGl0b3JHcmF5IiwiYXBwYmFyR3JheSIsImlubmVyR3JheSIsImdyYXkiLCJsaWdodEdyYXkiLCJkYXJrR3JheSIsIm5ld0dyYXkiLCJkYXJrZXJHcmF5IiwicmVkRmFkZWQiLCJyZWRMaWdodCIsInJlZCJdLCJzb3VyY2VSb290IjoiIn0=\n//# sourceURL=webpack-internal:///./src/styles/colors.ts\n");

/***/ }),

/***/ "@chakra-ui/react":
/*!***********************************!*\
  !*** external "@chakra-ui/react" ***!
  \***********************************/
/***/ ((module) => {

module.exports = require("@chakra-ui/react");

/***/ }),

/***/ "next/router":
/*!******************************!*\
  !*** external "next/router" ***!
  \******************************/
/***/ ((module) => {

module.exports = require("next/router");

/***/ }),

/***/ "react":
/*!************************!*\
  !*** external "react" ***!
  \************************/
/***/ ((module) => {

module.exports = require("react");

/***/ }),

/***/ "react/jsx-dev-runtime":
/*!****************************************!*\
  !*** external "react/jsx-dev-runtime" ***!
  \****************************************/
/***/ ((module) => {

module.exports = require("react/jsx-dev-runtime");

/***/ })

};
;

// load runtime
var __webpack_require__ = require("../../webpack-runtime.js");
__webpack_require__.C(exports);
var __webpack_exec__ = (moduleId) => (__webpack_require__(__webpack_require__.s = moduleId))
var __webpack_exports__ = (__webpack_exec__("./src/pages/order/[order].tsx"));
module.exports = __webpack_exports__;

})();