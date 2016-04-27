var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var AppPlayer;
(function (AppPlayer) {
    "use strict";
    var dxdata = DevExpress.data;
    function unwrapNestedLists(data) {
        var valueCallback = function (valueContext) { return valueContext.value; }, result = AppPlayer.propertyVisitor(data, valueCallback, {
            getValueCallback: function (value, context) {
                return ($.isPlainObject(value) && value.results && $.isArray(value.results)) ? value.results : AppPlayer.propertyVisitor(value, valueCallback, context);
            }
        });
        return result;
    }
    ;
    function replaceKeysWithObjectLinks(store, object, stores) {
        var newObject = {}, navigationFields = [];
        if (store.fields) {
            navigationFields = store.fields.filter(function (field) {
                return field.storeId && true;
            });
        }
        $.each(object, function (name, value) {
            if (name === "__metadata" || (value && (typeof value === "object") && value.__deferred)) {
                return;
            }
            newObject[name] = value;
        });
        navigationFields.forEach(function (field) {
            if (newObject[field.name]) {
                newObject[field.name] = {
                    __metadata: {
                        uri: stores[field.storeId]["_byKeyUrl"](object[field.name])
                    }
                };
            }
        });
        return newObject;
    }
    ;
    function isGUID(str) {
        if (typeof str !== "string") {
            return false;
        }
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
    }
    function createGuids(data) {
        var valueCallback = function (valueContext) {
            var value = valueContext.value;
            if (isGUID(value)) {
                return new dxdata.Guid(value);
            }
            else {
                return value;
            }
        };
        return AppPlayer.propertyVisitor(data, valueCallback, { getValueCallback: function (value, context) { return AppPlayer.propertyVisitor(value, valueCallback, context); } });
    }
    ;
    function prepareLoadOptions(loadOptions) {
        return loadOptions.filter ? $.extend({}, loadOptions, { filter: createGuids(loadOptions.filter) }) : loadOptions;
    }
    function prepareKey(key, storeOptions) {
        return storeOptions.keyType === "Guid" ? new dxdata.Guid(key) : key;
    }
    var ODataStore = (function (_super) {
        __extends(ODataStore, _super);
        function ODataStore(storeOptions, stores) {
            _super.call(this, ODataStore.createODataStoreOptions(storeOptions));
            this.storeOptions = storeOptions;
            this.stores = stores;
        }
        ODataStore.createODataStoreOptions = function (storeOptions) {
            return {
                url: storeOptions.debugUrl || storeOptions.url,
                key: storeOptions.key,
                keyType: storeOptions.keyType,
                beforeSend: AppPlayer.addHeaders(storeOptions.headers),
                version: storeOptions.version,
                withCredentials: storeOptions.withCredentials !== undefined ? storeOptions.withCredentials : true
            };
        };
        ODataStore.prototype.load = function (loadOptions) {
            var d = $.Deferred();
            _super.prototype.load.call(this, prepareLoadOptions(loadOptions)).done(function (data) { d.resolve(unwrapNestedLists(data)); }).fail(d.reject);
            return d.promise();
        };
        ODataStore.prototype.byKey = function (key, extraOptions) {
            var d = $.Deferred();
            _super.prototype.byKey.call(this, prepareKey(key, this.storeOptions), extraOptions).done(function (data) { d.resolve(unwrapNestedLists(data)); }).fail(d.reject);
            return d.promise();
        };
        ODataStore.prototype.insert = function (values) {
            return _super.prototype.insert.call(this, replaceKeysWithObjectLinks(this.storeOptions, values, this.stores));
        };
        ODataStore.prototype.update = function (key, values) {
            return _super.prototype.update.call(this, key, replaceKeysWithObjectLinks(this.storeOptions, values, this.stores));
        };
        ODataStore.prototype.remove = function (key) {
            return _super.prototype.remove.call(this, prepareKey(key, this.storeOptions));
        };
        ODataStore.prototype.totalCount = function (loadOptions) {
            return _super.prototype.load.call(this, prepareLoadOptions(loadOptions));
        };
        return ODataStore;
    }(DevExpress.data.ODataStore));
    AppPlayer.ODataStore = ODataStore;
})(AppPlayer || (AppPlayer = {}));
var AppPlayer;
(function (AppPlayer) {
    "use strict";
    //import apv = AppPlayer.Views;
    function sendRequest(url, method, data, dataType, headers) {
        var requestOptions = {
            url: url,
            type: method ? method.toUpperCase() : "GET",
            contentType: "application/json; charset=utf-8",
            dataType: dataType || "json",
            data: data
        };
        AppPlayer.addHeaders(headers)(requestOptions);
        return $.ajax(requestOptions)
            .fail(function (arg) {
            // Convert to Error so that DXData won't convert it
            var message;
            if (arg.responseJSON) {
                message = arg.responseJSON.Message;
            }
            else {
                message = arg.responseText;
            }
            var error = new Error();
            error["status"] = arg.status;
            error["responseJSON"] = arg.responseJSON;
            return error;
        });
    }
    var RestStore = (function (_super) {
        __extends(RestStore, _super);
        function RestStore(storeOptions, globalModel, application) {
            var _this = this;
            var compiledProcessResult = storeOptions.load.processResult ? application.createFunctionCompiler(storeOptions.load.processResult) : null, options = $.extend({}, storeOptions, {
                key: storeOptions.key,
                load: function (loadOptions) {
                    var d = $.Deferred();
                    _this.handler(storeOptions, "load", { $global: globalModel, $options: loadOptions }, "get")
                        .done(function (data) {
                        if (compiledProcessResult) {
                            compiledProcessResult.run({ $global: globalModel, $data: data }, { callerId: "load.processResult", callerType: "RestStore" })
                                .done(function (data) {
                                d.resolve(data);
                            })
                                .fail(d.reject);
                        }
                        else {
                            d.resolve(data);
                        }
                    }).fail(d.reject);
                    return d.promise();
                },
                byKey: function (key) {
                    var d = $.Deferred();
                    _this.handler(storeOptions, "byKey", { $global: globalModel, $key: key }, "get")
                        .done(function (data) {
                        if (compiledProcessResult) {
                            compiledProcessResult.run({ $global: globalModel, $data: data }, { callerId: "byKey.processResult", callerType: "RestStore" })
                                .done(function (data) {
                                d.resolve(data);
                            })
                                .fail(d.reject);
                        }
                        else {
                            d.resolve(data);
                        }
                    }).fail(d.reject);
                    return d.promise();
                },
                insert: function (values) {
                    var d = $.Deferred();
                    _this.handler(storeOptions, "insert", { $global: globalModel, $data: values }, "post")
                        .done(function (data) {
                        d.resolve(_this.keyOf(data));
                    })
                        .fail(d.reject);
                    return d.promise();
                },
                update: function (key, values) {
                    return _this.handler(storeOptions, "update", { $global: globalModel, $key: key, $data: values }, "patch");
                },
                remove: function (key) {
                    return _this.handler(storeOptions, "remove", { $global: globalModel, $key: key }, "delete");
                },
                totalCount: function (loadOptions) {
                    return _this.handler(storeOptions, "totalCount", { $global: globalModel, $options: loadOptions }, "get");
                }
            });
            _super.call(this, options);
            this._application = application;
        }
        RestStore.prototype.eval = function (expr, context) {
            if (!expr) {
                return undefined;
            }
            return AppPlayer.Logic.Operation.eval(expr, context);
        };
        RestStore.prototype.transformData = function (data, method) {
            if (data) {
                switch (method) {
                    case "get":
                        $.each(data, function (name, val) {
                            if (val) {
                                if (val instanceof Date) {
                                    data[name] = val.toISOString();
                                }
                                else {
                                    data[name] = "" + val;
                                }
                            }
                            else {
                                delete data[name];
                            }
                        });
                        break;
                    case "post":
                    case "patch":
                        data = JSON.stringify(data);
                        break;
                    default:
                        break;
                }
            }
            return data;
        };
        RestStore.prototype.handler = function (storeOptions, name, context, defaultMethod) {
            var _this = this;
            var options = storeOptions[name], url, method, data;
            if (!options || !options.urlExpr) {
                return AppPlayer.Logic.rejectPromise("No " + name + " url specified");
            }
            url = this.getUrl(options, context);
            //TODO: rewrite after refactoring functionCompiller
            //context.data = context.$options;
            method = options.method || defaultMethod;
            //TODO: rewrite after refactoring functionCompiller
            if (!options.getAjaxData) {
                data = {};
                return sendRequest(url, method, data, options["dataType"], storeOptions.headers);
            }
            else {
                var funcBody = options.getAjaxData, result = $.Deferred();
                this._application.createFunctionCompiler(funcBody)
                    .run(context)
                    .done(function (data) {
                    var tData = _this.transformData(_this.eval(JSON.stringify(data), context), method);
                    sendRequest(url, method, tData, options["dataType"], storeOptions.headers).done(function (data) {
                        result.resolve(data);
                    }).fail(function () {
                        result.reject();
                    });
                }).fail(function () {
                    result.reject();
                });
                return result.promise();
            }
        };
        RestStore.prototype.getUrl = function (options, context) {
            try {
                return this.eval(options.debugUrlExpr || options.urlExpr, context);
            }
            catch (e) {
                console.error(e);
                throw e;
            }
        };
        return RestStore;
    }(DevExpress.data.CustomStore));
    AppPlayer.RestStore = RestStore;
})(AppPlayer || (AppPlayer = {}));
var AppPlayer;
(function (AppPlayer) {
    "use strict";
    var dxdata = DevExpress.data;
    var ArrayStore = (function (_super) {
        __extends(ArrayStore, _super);
        function ArrayStore(storeOptions) {
            _super.call(this, storeOptions);
        }
        ArrayStore.prototype.byKey = function (key, extraOptions) {
            return _super.prototype.byKey.call(this, key, extraOptions)
                .then(function (value) {
                if (value instanceof Object) {
                    return $.extend({}, value);
                }
                else {
                    return value;
                }
            });
        };
        ArrayStore.prototype.load = function (obj) {
            return _super.prototype.load.call(this, obj)
                .then(function (value) {
                if (value) {
                    $.each(value, function (name, val) {
                        if (val instanceof Object) {
                            value[name] = $.extend({}, val);
                        }
                    });
                }
                return value;
            });
        };
        return ArrayStore;
    }(dxdata.ArrayStore));
    AppPlayer.ArrayStore = ArrayStore;
})(AppPlayer || (AppPlayer = {}));
var AppPlayer;
(function (AppPlayer) {
    "use strict";
    var DXError = DevExpress["Error"];
    function isCyclic(obj) {
        var seenObjects = [];
        function detect(obj) {
            if (obj && typeof obj === "object") {
                if (seenObjects.indexOf(obj) !== -1) {
                    return true;
                }
                seenObjects.push(obj);
                for (var key in obj) {
                    if (obj.hasOwnProperty(key) && detect(obj[key])) {
                        console.log(obj, "cycle at " + key);
                        return true;
                    }
                }
            }
            return false;
        }
        return detect(obj);
    }
    var JsonStore = (function (_super) {
        __extends(JsonStore, _super);
        function JsonStore(storeOptions, $global) {
            var _this = this;
            if ($global === void 0) { $global = null; }
            var cacheKey = storeOptions.jsonPath + storeOptions.url, load = function (options) {
                var d = $.Deferred(), requestOptions = {
                    url: storeOptions.url,
                    dataType: "json",
                    data: { path: storeOptions.jsonPath }
                }, cachedData = JsonStore.cache[cacheKey];
                AppPlayer.addHeaders(storeOptions.headers)(requestOptions);
                if (cachedData) {
                    requestOptions["headers"] = { "If-None-Match": cachedData.tag };
                }
                $.ajax(requestOptions).then(function (data, testStatus, request) {
                    var resultingData = data;
                    if (request.status === 200) {
                        JsonStore.cache[cacheKey] = { data: data, tag: request.getResponseHeader("ETag") };
                    }
                    else if (request.status === 304) {
                        resultingData = cachedData.data;
                    }
                    d.resolve(resultingData);
                });
                return d.promise();
            }, post = function (data, keyName, keyValue) {
                var requestOptions = {
                    url: storeOptions.url,
                    data: {
                        json: JSON.stringify(data),
                        path: storeOptions.jsonPath,
                        keyName: keyName,
                        keyValue: keyValue
                    },
                    method: "POST"
                };
                AppPlayer.addHeaders(storeOptions.headers)(requestOptions);
                return $.ajax(requestOptions);
            }, keyPrefix = storeOptions.keyPrefix;
            if (!keyPrefix) {
                keyPrefix = storeOptions.id;
                if (AppPlayer.endsWith(keyPrefix, "s")) {
                    keyPrefix = keyPrefix.substring(0, keyPrefix.length - 1);
                }
            }
            $.extend(storeOptions, {
                totalCount: function () {
                    return load().then(function (result) {
                        return AppPlayer.Logic.trivialPromise(result ? result.length : 0);
                    });
                },
                load: load,
                byKey: function (key) {
                    var that = _this;
                    return load()
                        .then(function (items) {
                        return AppPlayer.findInArray(items, function (item) {
                            return item[that.key()] === key;
                        });
                    });
                },
                update: function (key, values) {
                    var d = $.Deferred();
                    isCyclic(values);
                    post(values, _this.key(), key).then(function () {
                        d.resolve();
                    });
                    return d.promise();
                },
                insert: function (values) {
                    var that = _this, keyExpr = _this.key(), keyValue, d = $.Deferred();
                    $.getJSON(storeOptions.url).then(function (data) {
                        var getter = AppPlayer.compileGetter(storeOptions.jsonPath), setter, array = getter(data);
                        if (!array) {
                            array = [];
                            setter = AppPlayer.compileSetter(storeOptions.jsonPath);
                            setter(data, array);
                        }
                        if (keyExpr) {
                            keyValue = _this.keyOf(values);
                            if (!keyValue || (typeof keyValue === "object" && $.isEmptyObject(keyValue))) {
                                if ($.isArray(keyExpr)) {
                                    d.reject(DXError("E4007"));
                                    return;
                                }
                                var maxKeyNum = 0;
                                array.forEach(function (item) {
                                    var key = _this.keyOf(item);
                                    if (!AppPlayer.startsWith(key, keyPrefix)) {
                                        return;
                                    }
                                    try {
                                        var keyNum = parseInt(key.substr(keyPrefix.length), 10);
                                        if (keyNum > maxKeyNum) {
                                            maxKeyNum = keyNum;
                                        }
                                    }
                                    catch (e) {
                                        return;
                                    }
                                });
                                keyValue = values[keyExpr] = keyPrefix + (maxKeyNum + 1);
                                var context = {
                                    $key: keyValue,
                                    $global: $global
                                };
                                (storeOptions.fields || []).forEach(function (field) {
                                    if (!values[field.name]) {
                                        if (typeof field.defaultValueExpr === "string") {
                                            var defaultValue = AppPlayer.Logic.Operation.eval(field.defaultValueExpr, context);
                                            values[field.name] = defaultValue;
                                        }
                                    }
                                });
                            }
                            else if (AppPlayer.findInArray(array, function (p) { return p.id === keyValue; })) {
                                d.reject(DXError("E4008"));
                            }
                        }
                        else {
                            keyValue = values;
                        }
                        array.push(values);
                        post(values, that.key(), keyValue).then(function () {
                            d.resolve(keyValue);
                        }, function (error) {
                            d.reject(error);
                        });
                    });
                    return d.promise();
                },
                remove: function (key) {
                    var that = _this, result = $.Deferred(), storeUrl = storeOptions.url, keyExpr = storeOptions.key;
                    $.getJSON(storeUrl)
                        .then(function (data) {
                        var getter = AppPlayer.compileGetter(storeOptions.jsonPath), array = getter(data) || [], index = AppPlayer.indexInArray(array, function (item) { return item[keyExpr] === key; });
                        if (index !== -1) {
                            array.splice(index, 1);
                        }
                        post(null, that.key(), key).then(function () {
                            result.resolve();
                        }, function (error) {
                            result.reject(error);
                        });
                    }, function (error) {
                        result.reject(error);
                    });
                    return result.promise();
                }
            });
            _super.call(this, storeOptions);
        }
        JsonStore.cache = {};
        return JsonStore;
    }(DevExpress.data.CustomStore));
    AppPlayer.JsonStore = JsonStore;
})(AppPlayer || (AppPlayer = {}));
/// <reference path="stores/odatastore.ts" />
/// <reference path="stores/reststore.ts" />
/// <reference path="stores/arraystore.ts" />
/// <reference path="stores/designerstore.ts" />
var AppPlayer;
(function (AppPlayer) {
    "use strict";
    var dxhtml = DevExpress.framework.html;
    var dxdata = DevExpress.data;
    var dxconsole = DevExpress.require("/utils/utils.console");
    var Application = (function () {
        function Application(appConfig, options) {
            var _this = this;
            this.sharedObjects = {};
            this.started = $.Callbacks();
            this.dataError = $.Callbacks();
            this.setAppConfig(appConfig);
            this.id = appConfig.id;
            this.localStorage = new AppPlayer.LocalStorageWrapper(this);
            this.options = options;
            this.ns = {};
            this.appConfig.navigation = appConfig.navigation || { defaultView: "", items: [] };
            this.functions = this.createGlobalFunctions();
            this.appConfig.params = this.appConfig.params || [];
            this.appConfig.model = this.appConfig.model || [];
            this.model = AppPlayer.Model.createAppModel(this.appConfig, this);
            this.setModelValueFromParameter();
            this.loadNavigation();
            this.copyGlobalCommands();
            this.createStores();
            AppPlayer.Model.initializeDataSources(this.model, { $model: this.model, $global: this.model }, this, this.stores, false, this.appConfig.dataSources);
            this.typeInfoRepository = new AppPlayer.TypeInfoRepository(appConfig.dataStores);
            if (this.model.hasOwnProperty("title")) {
                var titleObserver = ko.computed(function () { return _this.model["title"]; });
                var formatTitle;
                if (this.id === "com.devexpress.Xenarius.Designer") {
                    formatTitle = function () {
                        if (titleObserver()) {
                            document.title = titleObserver() + " - Xenarius Admin";
                        }
                        else {
                            document.title = "Xenarius Admin";
                        }
                    };
                }
                else {
                    formatTitle = function () {
                        document.title = titleObserver();
                    };
                }
                titleObserver.subscribe(formatTitle);
                formatTitle();
            }
        }
        Object.defineProperty(Application, "SPLIT_NAV_VIEW_ID", {
            get: function () { return "splitNavigation"; },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Application, "SHARED_PARAMETER", {
            get: function () { return "xet-shared-object"; },
            enumerable: true,
            configurable: true
        });
        Application.prototype.setAppConfig = function (appConfig) {
            this.appConfig = appConfig;
            this.appConfig.platforms = this.appConfig.platforms || [
                {
                    name: "DesktopRule",
                    layout: "desktop",
                    defaultCommandContainer: "header",
                    defaultCommandLocation: "after",
                    options: {
                        generic: true
                    }
                },
                {
                    name: "PhoneRule",
                    layout: "slideout",
                    defaultCommandContainer: "header",
                    defaultCommandLocation: "after",
                    options: {
                        phone: true
                    }
                },
                {
                    name: "TabletRule",
                    layout: "split",
                    defaultCommandContainer: "header",
                    defaultCommandLocation: "after",
                    options: {
                        tablet: true
                    }
                }
            ];
            this.appConfig.views = this.appConfig.views || [];
            this.appConfig.views.forEach(function (view) {
                (view.commands || []).forEach(function (command) {
                    command.id = view.id + "_" + command.id;
                });
            });
        };
        Application.prototype.isSplitLayout = function () {
            var currentDevice = DevExpress.devices.current(), currentPlatform = AppPlayer.LayoutHelper.tryGetCurrentPlatform(this.appConfig.platforms, currentDevice), usesSplitLayout = currentPlatform && currentPlatform.layout === "split";
            return usesSplitLayout;
        };
        Application.prototype.setModelValueFromParameter = function () {
            var _this = this;
            this.appConfig.params.forEach(function (parameter) {
                var val = AppPlayer.getQueryVariable(parameter.name);
                if (val) {
                    _this.model[parameter.name] = val;
                }
            });
        };
        Application.prototype.loadNavigation = function () {
            var navigation = this.appConfig.navigation;
            if (!this.appConfig["isDesignMode"] && this.isSplitLayout() && navigation) {
                if (!navigation.customSplitNavigation && navigation.items && navigation.items.length > 0) {
                    this.appConfig.views.splice(0, 0, this.getSplitNavigationView());
                    (this.appConfig.dataStores = this.appConfig.dataStores || []).push(this.getNavigationItemsStore());
                }
            }
        };
        Application.prototype.copyGlobalCommands = function () {
            var _this = this;
            if (this.appConfig.globalCommands && this.appConfig.views) {
                var isSplitLayout = this.isSplitLayout();
                this.appConfig.views.forEach(function (view) {
                    if (isSplitLayout && view.pane !== "master") {
                        return;
                    }
                    if (!view.commands) {
                        view.commands = [];
                    }
                    _this.appConfig.globalCommands.forEach(function (command) {
                        view.commands.push($.extend({}, command, { id: command.id + view.id }));
                    });
                });
            }
        };
        Application.prototype.navigate = function (uri, options) {
            this.dxapp.navigate(uri, options);
        };
        Application.prototype.initializeDefaultView = function (currentDevice) {
            var currentPlatform = AppPlayer.LayoutHelper.tryGetCurrentPlatform(this.appConfig.platforms, currentDevice), usesSplitLayout = currentPlatform && currentPlatform.layout === "split", defaultView = currentPlatform && currentPlatform.defaultView ? currentPlatform.defaultView : this.appConfig.navigation.defaultView;
            if (!this.appConfig["isDesignMode"] && usesSplitLayout && !currentPlatform.defaultView) {
                var splitNav = AppPlayer.findInArray(this.appConfig.views, function (v) { return v.pane === "master"; });
                if (splitNav) {
                    defaultView = splitNav.id;
                }
            }
            return defaultView;
        };
        Application.prototype.run = function () {
            var _this = this;
            var that = this;
            dxdata.errorHandler = this._dataErrorHandler.bind(this);
            DevExpress.devices.current({ platform: "generic" });
            var currentDevice = DevExpress.devices.current();
            this.defaultView = this.initializeDefaultView(currentDevice);
            var moduleLoader = new AppPlayer.ModulesLoader(this, window["progressReporter"]), moduleInited = moduleLoader.initModules();
            moduleInited.done(function () {
                var htmlApplicationOptions, layoutSet;
                _this._createViews(document.body);
                htmlApplicationOptions = _this.htmlAppConfiguration();
                layoutSet = AppPlayer.LayoutHelper.createLayoutSet(_this.appConfig.platforms, _this.appConfig["isDesignMode"], _this.appConfig.views);
                htmlApplicationOptions.layoutSet = layoutSet.layoutSet;
                _this.dxapp = _this._createApplication(htmlApplicationOptions);
                _this.dxapp.on("resolveViewCacheKey", function (args) {
                    var viewId = args.routeData["view"], refresh = that.appConfig.views.some(function (value) {
                        return value.id === viewId && value.refreshWhenShown;
                    });
                    if (refresh) {
                        args.key = viewId;
                    }
                });
                _this.dxapp["_processRequestResultLockEnabled"] = true;
                _this.dxapp.on("resolveLayoutController", function (args) {
                    var foundController = AppPlayer.LayoutHelper.tryGetViewSpecificLayoutController(args.viewInfo["viewName"], layoutSet.viewSpecificLayouts);
                    if (foundController) {
                        args.layoutController = foundController;
                    }
                });
                var onViewShown = function () {
                    // Forces DOM elements height recalculation
                    $(window).resize();
                    _this.started.fire(_this);
                    _this.dxapp.off("viewShown", onViewShown);
                };
                _this.dxapp.on("viewShown", onViewShown);
                // Cancels navigation to urls with shared parameters when shared objects are not set
                _this.dxapp.on("navigating", _this._onNavigating.bind(_this));
                _this.dxapp.router.register(":view/:parameters", { view: that.defaultView, parameters: "" });
                if (window["xetHandleOpenURL"]) {
                    var openUrl = window["xetHandleOpenURL"];
                    _this.functions["navigateToView"](openUrl.uri, openUrl.params, true);
                }
                else {
                    if (location.hash && location.hash !== "#") {
                        if (location.hash === "#test-error") {
                            _this.dxapp["bbb"].ccc.ddd = 100;
                        }
                        _this.dxapp.navigate();
                    }
                    else {
                        _this.navigateToDefaultView();
                    }
                }
                _this.authorization = new AppPlayer.Modules.Authorization(_this.appConfig, _this);
            });
        };
        Application.prototype._createApplication = function (options) {
            return new dxhtml.HtmlApplication(options);
        };
        Application.prototype._dataErrorHandler = function (e) {
            if (e["httpStatus"] === 404) {
                this.navigateToDefaultView();
            }
            else {
                this.dataError.fire(e);
            }
        };
        Application.prototype._createViews = function (rootElement) {
            var _this = this;
            if (!this.appConfig.views) {
                return;
            }
            this.appConfig.views.forEach(function (view) {
                var newView = new AppPlayer.Views.View(view, _this);
                _this.ns[view.id] = newView.viewModel;
            });
        };
        Application.prototype.registerMissingTemplate = function (componentType) {
            if ($.inArray(componentType, Application.missingTemplates) === -1) {
                Application.missingTemplates.push(componentType);
            }
        };
        Application.prototype.templateIsMissing = function (componentType) {
            return $.inArray(componentType, Application.missingTemplates) !== -1;
        };
        //TODO Pletnev: extract into SplitLayoutModule
        //TODO Pletnev: come up with a unique identifier instead of "navigationItems"
        Application.prototype.getNavigationItemsStore = function () {
            return {
                id: "navigationItems",
                type: "array",
                array: this.htmlAppNavigation()
            };
        };
        //TODO Pletnev: extract into SplitLayoutModule
        //TODO Pletnev: come up with a unique identifier instead of "splitNavigation"
        Application.prototype.getSplitNavigationView = function () {
            var _this = this;
            return {
                "id": Application.SPLIT_NAV_VIEW_ID,
                "title": this.appConfig.navigation && this.appConfig.navigation.title ? this.appConfig.navigation.title : "Menu",
                "pane": "master",
                "dataSources": [
                    {
                        "id": "navigationItemsDatasource",
                        "store": "navigationItems"
                    }
                ],
                "components": [
                    {
                        "id": "navigationList",
                        "type": "list",
                        "dataSource": "$model.navigationItemsDatasource",
                        "itemComponents": [{
                                id: "navigationItem",
                                type: "label",
                                text: "$data.title",
                                style: {
                                    "fontSize": "16px",
                                    "marginRight": "10px",
                                    "marginLeft": "10px",
                                    "marginBottom": "10px",
                                    "marginTop": "10px"
                                }
                            }],
                        "onItemClick": function (context) {
                            typeof context.$data["onExecute"] === "function" ? context.$data["onExecute"]() : _this.functions["navigateToView"](context.$data["onExecute"].substr(1));
                        }
                    }
                ]
            };
        };
        Application.prototype.createGlobalFunctions = function () {
            var _this = this;
            var functions = {};
            var busyCounter = 0;
            var busyInstance;
            functions["busy"] = function () {
                busyCounter++;
                if (busyCounter === 1) {
                    busyInstance = $("<div>")
                        .appendTo(DevExpress.viewPort())
                        .addClass("dx-static")
                        .dxLoadPanel()
                        .data("dxLoadPanel");
                    busyInstance.option("onHidden", function (args) {
                        args.element.remove();
                    });
                    busyInstance.show();
                }
            };
            functions["available"] = function () {
                busyCounter--;
                if (busyCounter === 0) {
                    busyInstance.hide();
                }
                if (busyCounter < 0) {
                    throw Error("Unpaired free method call");
                }
            };
            functions["back"] = function () { return _this.dxapp.back(); };
            functions["navigateToView"] = function (viewId, parameters, srcPane) {
                if (!viewId) {
                    viewId = _this.defaultView;
                }
                var view = _this.appConfig.views.filter(function (view) {
                    return view.id === viewId;
                })[0];
                if (view.params && view.params.filter(function (p) { return !AppPlayer.Views.ViewModel.optional(p); }).length > 0 && !parameters) {
                    console.error("NavigateToView '" + view.id + "'. View parameters not found.");
                }
                else if (view.params) {
                    var missingParameters;
                    view.params.forEach(function (param) {
                        if (!parameters || parameters[param.name] === undefined) {
                            if (!AppPlayer.Views.ViewModel.optional(param)) {
                                if (!missingParameters) {
                                    missingParameters = [];
                                }
                                missingParameters.push(param.name);
                            }
                            return;
                        }
                        var parameter = parameters[param.name], typeInfo = _this.typeInfoRepository.get(param.type);
                        // TODO: typeInfo must be defined (unknown type?)
                        if (typeInfo && typeInfo.kind === AppPlayer.TYPES.STORE_TYPE) {
                            var store = _this.stores[typeInfo.name];
                            if (parameter !== undefined) {
                                if (param.shared) {
                                    _this.sharedObjects[param.name] = parameter;
                                }
                                parameters[param.name] = store.keyOf(parameter);
                            }
                        }
                        else if (param.shared) {
                            _this.sharedObjects[param.name] = parameter;
                            parameters[param.name] = Application.SHARED_PARAMETER;
                        }
                    });
                    if (missingParameters) {
                        console.error("NavigateToView '" + view.id + "'. Missing parameters: " + missingParameters.join(", "));
                    }
                }
                var options = undefined;
                if (_this.isSplitLayout() && view.pane === "master") {
                    options = { root: false };
                }
                else if (_this.isNavigationItem(viewId) || _this.isCrossPaneTransition(srcPane, view.pane) || _this.isAuthorizationView(viewId)) {
                    options = { root: true, target: "current" };
                }
                if (!parameters || $.isEmptyObject(parameters)) {
                    _this.navigate(viewId, options);
                }
                else {
                    _this.navigate({
                        view: viewId,
                        parameters: parameters
                    }, options);
                }
            };
            functions["load"] = function (storeId, options) {
                return _this.stores[storeId].load(options);
            };
            functions["byKey"] = function (storeId, key, extraOptions) {
                return _this.stores[storeId].byKey(key, extraOptions);
            };
            functions["keyOf"] = function (storeId, object) {
                return _this.stores[storeId].keyOf(object);
            };
            functions["save"] = function (object, storeId, key) {
                functions["busy"]();
                var store = _this.stores[storeId];
                if (!key) {
                    key = store.keyOf(object);
                }
                var promise = key === undefined ? store.insert(object) : store.update(key, object);
                return promise.then(function (storedObject, serverKey) {
                    if (!key) {
                        object[store.key()] = serverKey;
                    }
                }).always(functions["available"]);
            };
            functions["insert"] = function (object, storeId) {
                functions["busy"]();
                return _this.stores[storeId].insert(object).always(functions["available"]);
            };
            functions["delete"] = function (objectOrKey, storeId) {
                var store = _this.stores[storeId], key = $.isPlainObject(objectOrKey) ? store.keyOf(objectOrKey) : objectOrKey;
                functions["busy"]();
                return store.remove(key).always(functions["available"]);
            };
            functions["refresh"] = function (storeId) {
                var store = _this.stores[storeId];
                store["fireEvent"]("modified");
            };
            functions["getDataStoreConfig"] = function (storeId) {
                var filtered = _this.appConfig.dataStores.filter(function (store) { return store.id === storeId; });
                if (filtered.length === 0) {
                    throw "Data provider '" + storeId + "' is not found!";
                }
                if (filtered.length > 1) {
                    console.warn("Found %o data providers with id '%o'", filtered.length, storeId);
                }
                return filtered[0];
            };
            functions["getDataStore"] = function (storeId) {
                return _this.stores[storeId];
            };
            functions["log"] = function (level, message) {
                var logger = dxconsole.logger;
                logger[level](message);
            };
            functions["getCookie"] = function (params) {
                var name = params.cookieName + "=", cookieArray = document.cookie.split(";"), result = "", deffered = $.Deferred();
                for (var i = 0; i < cookieArray.length; i++) {
                    var cookie = cookieArray[i];
                    while (cookie.charAt(0) === " ") {
                        cookie = cookie.substring(1);
                    }
                    if (cookie.indexOf(name) === 0) {
                        result = cookie.substring(name.length, cookie.length);
                        break;
                    }
                }
                deffered.resolve(result);
                return deffered;
            };
            return functions;
        };
        Application.prototype.isNavigationItem = function (viewId) {
            return this.appConfig.navigation &&
                AppPlayer.indexInArray(this.appConfig.navigation.items, function (item) { return item.id === viewId; }) !== -1;
        };
        Application.prototype.isAuthorizationView = function (viewId) {
            return this.appConfig.authorization && this.appConfig.authorization.loginView === viewId;
        };
        Application.prototype.isCrossPaneTransition = function (srcPane, dstPane) {
            if (srcPane === void 0) { srcPane = "detail"; }
            if (dstPane === void 0) { dstPane = "detail"; }
            return this.isSplitLayout() && srcPane !== dstPane;
        };
        Application.prototype.processParameterLoadingError = function (name, id) {
            var dialog = DevExpress.ui.dialog.custom({
                title: "Error",
                message: "Cannot load an '" + name + "' parameter with the '" + id + "' key.",
                buttons: [{
                        text: "Go Back",
                        onClick: this.functions["back"]
                    }]
            });
            dialog.show();
        };
        Application.prototype.createStores = function () {
            var _this = this;
            var app = this;
            if (this.stores) {
                return;
            }
            this.stores = {};
            (this.appConfig.dataStores || []).forEach(function (item) {
                var store = null, storeOptions = AppPlayer.Model.createLinkedModel(item, { $global: _this.model }, { callerType: "data provider options", callerId: item.id });
                switch (item.type) {
                    case "odata":
                        store = new AppPlayer.ODataStore(storeOptions, app.stores);
                        break;
                    case "array":
                        var array = storeOptions.array;
                        AppPlayer.transformISODates(array);
                        store = new AppPlayer.ArrayStore({
                            data: array,
                            key: storeOptions.key
                        });
                        break;
                    case "json":
                        store = new AppPlayer.JsonStore(storeOptions, _this.model);
                        break;
                    case "rest":
                        store = new AppPlayer.RestStore(storeOptions, _this.model, _this);
                        break;
                    case "local":
                        var localArray = storeOptions.array;
                        var name = storeOptions.name;
                        var flushInterval = storeOptions.flushInterval;
                        var immediate = storeOptions.immediate;
                        AppPlayer.transformISODates(array);
                        store = new dxdata.LocalStore({
                            data: localArray,
                            key: storeOptions.key,
                            name: name,
                            immediate: immediate,
                            flushInterval: flushInterval
                        });
                        break;
                    default:
                        console.error("Unknown store type '" + storeOptions.type + "'");
                }
                _this.stores[storeOptions.id] = store;
            });
        };
        Application.prototype.getCommandMapping = function () {
            var _this = this;
            var commandMapping = {};
            (this.appConfig.views || []).forEach(function (view) {
                AppPlayer.LayoutHelper.fillCommandMapping(commandMapping, view.commands, _this.appConfig.platforms, DevExpress.devices.current());
            });
            return commandMapping;
        };
        Application.prototype._onNavigating = function (e) {
            var _this = this;
            var sharedParameterIndex = e.uri.indexOf(Application.SHARED_PARAMETER);
            if (sharedParameterIndex >= 0 && Object.keys(this.sharedObjects).length === 0) {
                e.cancel = true;
                if (this.dxapp) {
                    setTimeout(function () { _this.navigateToDefaultView(); }, 1);
                }
            }
        };
        Application.prototype.createFunctionCompiler = function (code) {
            if (!this.functions) {
                console.error("Functions parameter is necessary for compiler");
            }
            return new AppPlayer.Logic.FunctionCompiler(this.functions, code);
        };
        Application.prototype.navigateToDefaultView = function () {
            var _this = this;
            var defaultView = AppPlayer.findInArray(this.appConfig.views, function (view) { return view.id === _this.defaultView; });
            if (!defaultView) {
                if (this.defaultView) {
                    AppPlayer.showErrorDialog("Default view '" + this.defaultView + "' doesn't exist.");
                }
                else if (this.appConfig.views.length) {
                    defaultView = this.appConfig.views[0];
                    if (this.appConfig.views.length > 1) {
                        AppPlayer.showErrorDialog("You can specify app default view in the designer. Click the cogwheel button next to the app title, then change Navigation - Default View property.");
                    }
                }
                else {
                    AppPlayer.showErrorDialog("Your app doesn't have any views. Please create one in the designer.");
                }
            }
            if (defaultView) {
                this.dxapp.navigate({ view: defaultView.id }, { target: "current" });
            }
        };
        Application.prototype.on = function (eventName, handler) {
            switch (eventName) {
                case "started":
                    this.started.add(handler);
                    break;
                case "dataError":
                    this.dataError.add(handler);
                    break;
                default:
                    this.dxapp.on(eventName, handler);
            }
        };
        Application.prototype.off = function (eventName, handler) {
            switch (eventName) {
                case "started":
                    this.started.remove(handler);
                    break;
                case "dataError":
                    this.dataError.remove(handler);
                    break;
                default:
                    this.dxapp.off(eventName, handler);
            }
        };
        Application.prototype.getNavigationItemTitle = function (item) {
            var title = item.title, viewId, view;
            if (!title) {
                viewId = item.id;
                view = AppPlayer.findInArray(this.appConfig.views, function (view) { return view.id === viewId; });
                title = view ? view.navigationTitle || view.title : "View Not Found";
            }
            return title;
        };
        Application.prototype.htmlAppNavigation = function () {
            var _this = this;
            return this.appConfig.navigation.items.map(function (item) {
                if (typeof item === "string") {
                    item = { id: item };
                }
                var functionCompiler = item.onExecute ? _this.createFunctionCompiler(item.onExecute) : undefined, executionHandler;
                if (functionCompiler) {
                    executionHandler = function (e) {
                        return functionCompiler.run({
                            $global: _this.model,
                            $model: undefined,
                            $data: e,
                            $value: undefined
                        }, {
                            callerType: "navigation item",
                            callerId: item.id
                        });
                    };
                }
                var itemCounter = 0, id = item.id || "item" + ++itemCounter, result = {
                    id: id,
                    onExecute: executionHandler || (_this.appConfig["isDesignMode"] !== true ? "#" + (item.id || item) : function () { }),
                    title: _this.getNavigationItemTitle(item),
                    visible: (typeof item.visible === "string" && item.visible.length > 0) ?
                        AppPlayer.wrapModelReference(item.visible, { $global: _this.model }, { callerType: "property of the " + id + " command", callerId: "visible" }) :
                        (item.visible || true)
                };
                if ($.isPlainObject(item)) {
                    result = $.extend({}, item, result);
                }
                return result;
            });
        };
        Application.prototype.htmlAppConfiguration = function () {
            var options = {
                namespace: this.ns,
                navigation: this.htmlAppNavigation(),
                commandMapping: this.getCommandMapping()
            };
            if (AppPlayer.LayoutHelper.getDeviceType() === "desktop") {
                options.mode = "webSite";
            }
            return options;
        };
        Application.prototype.removeViewCache = function (key) {
            this.dxapp.viewCache.removeView(key);
        };
        Application.prototype.viewCacheKey = function () {
            return window.location.hash.substr(1);
        };
        Application.missingTemplates = [];
        return Application;
    }());
    AppPlayer.Application = Application;
    ;
})(AppPlayer || (AppPlayer = {}));
var AppPlayer;
(function (AppPlayer) {
    var Logic;
    (function (Logic) {
        "use strict";
        var FunctionCompiler = (function () {
            function FunctionCompiler(functions, calls) {
                this.functions = functions;
                this.calls = calls;
            }
            FunctionCompiler.prototype.run = function (context, callerInfo) {
                var _this = this;
                var promise, errorHandler = function (error) {
                    var errorMessage = "";
                    AppPlayer.showErrorDialog(error);
                    if (callerInfo && callerInfo.callerType && callerInfo.callerId) {
                        errorMessage = "Error occurred when trying to evaluate the '" + callerInfo.callerId + "' " + callerInfo.callerType + ":\r\n";
                    }
                    errorMessage += error + "\r\n" + JSON.stringify(_this.calls, null, 2);
                    FunctionCompiler.consoleHandler(errorMessage);
                };
                if (!this.strategy) {
                    this.strategy = this.createStrategy(this.functions, this.calls);
                }
                try {
                    var contextParams = [];
                    if (context) {
                        $.each(context, function (name) {
                            contextParams.push(name);
                        });
                    }
                    promise = this.strategy.run(context, contextParams);
                    promise.fail(errorHandler);
                }
                catch (e) {
                    errorHandler(e);
                    return rejectPromise();
                }
                return promise;
            };
            FunctionCompiler.prototype.createStrategy = function (functions, calls) {
                if (calls instanceof Function) {
                    return new CompilerJSFunctionStrategy(functions, calls);
                }
                else if (!calls || $.isEmptyObject(calls)) {
                    return new CompilerStrategy(functions);
                }
                else if (typeof calls === "string") {
                    return BindingFunctionStrategy.isСompatible(calls)
                        ? new BindingFunctionStrategy(functions, calls)
                        : new CompilerTrivialStrategy(functions, calls);
                }
                else {
                    var _calls = calls.logic || calls;
                    return new CompilerInlineFunctionStrategy(functions, _calls);
                }
            };
            FunctionCompiler.consoleHandler = function (errorMessage) { return console.error(errorMessage); };
            return FunctionCompiler;
        }());
        Logic.FunctionCompiler = FunctionCompiler;
        var CompilerStrategy = (function () {
            function CompilerStrategy(functions) {
                this.functions = functions;
            }
            CompilerStrategy.prototype.run = function (context, contextParams) { return trivialPromise(); };
            CompilerStrategy.prototype.compile = function (functions, expr, paramNames) {
                var funcBody = "with($functions){" + expr + "}", allParamNames = ["$functions"];
                [].push.apply(allParamNames, paramNames);
                var func = new Function(allParamNames.join(", "), funcBody);
                return function (params) {
                    var args = [functions];
                    paramNames.forEach(function (name) {
                        args.push(params[name]);
                    });
                    return func.apply(func, args);
                };
            };
            return CompilerStrategy;
        }());
        var CompilerJSFunctionStrategy = (function (_super) {
            __extends(CompilerJSFunctionStrategy, _super);
            //private compiledFunctions: (params: {}) => any;
            function CompilerJSFunctionStrategy(functions, calls) {
                _super.call(this, functions);
                this.calls = calls;
            }
            CompilerJSFunctionStrategy.prototype.run = function (context, contextParams) {
                /*if(!this.compiledFunctions) {
                    this.compiledFunctions = this.calls;
                }*/
                var result = this.calls(context);
                // Promise duck typing
                if (result && typeof result.always === "function" && typeof result.done === "function") {
                    return result;
                }
                else {
                    return trivialPromise(result);
                }
            };
            return CompilerJSFunctionStrategy;
        }(CompilerStrategy));
        var CompilerTrivialStrategy = (function (_super) {
            __extends(CompilerTrivialStrategy, _super);
            function CompilerTrivialStrategy(functions, calls) {
                _super.call(this, functions);
                this.calls = calls;
            }
            CompilerTrivialStrategy.prototype.run = function (context, contextParams) {
                if (!this.compiledFunctions) {
                    this.compiledFunctions = this.compile(this.functions, this.calls, contextParams);
                }
                var result = this.compiledFunctions(context);
                // Promise duck typing
                if (result && typeof result.always === "function" && typeof result.done === "function") {
                    return result;
                }
                else {
                    return trivialPromise(result);
                }
            };
            return CompilerTrivialStrategy;
        }(CompilerStrategy));
        var CompilerInlineFunctionStrategy = (function (_super) {
            __extends(CompilerInlineFunctionStrategy, _super);
            function CompilerInlineFunctionStrategy(functions, calls) {
                _super.call(this, functions);
                this.calls = calls;
            }
            CompilerInlineFunctionStrategy.prototype.getAllVariables = function (params, variables) {
                var result = {};
                variables.forEach(function (v) {
                    result[v.name] = v;
                });
                $.each(params, function (name) {
                    if (!result[name]) {
                        result[name] = new Logic.Variable({ name: name, value: null, parameter: true, type: "object" });
                    }
                });
                return result;
            };
            CompilerInlineFunctionStrategy.prototype.run = function (context, contextParams) {
                if (!this.calls) {
                    return null;
                }
                var variables = [], calls = [];
                if (this.calls.variables) {
                    variables = this.calls.variables.map(function (value) {
                        return Logic.Variable.fromJson(value);
                    });
                }
                if (this.calls.calls) {
                    calls = this.calls.calls.map(function (call) {
                        return Logic.Operation.fromJson(call);
                    });
                }
                var allVariables = this.getAllVariables(context, variables);
                Object.getOwnPropertyNames(allVariables).forEach(function (name) {
                    var variable = allVariables[name];
                    variable.resetValue();
                    variable.value = context && variable.parameter ? context[variable.name] : variable.value;
                    allVariables[variable.name] = variable;
                });
                return Logic.Operation.run(calls, allVariables, this.functions)
                    .then(function (result) {
                    if (result && result.flow === Logic.Flow.Return) {
                        return trivialPromise(result.value);
                    }
                    return trivialPromise();
                });
            };
            return CompilerInlineFunctionStrategy;
        }(CompilerStrategy));
        var BindingFunctionStrategy = (function (_super) {
            __extends(BindingFunctionStrategy, _super);
            function BindingFunctionStrategy(functions, functionName) {
                _super.call(this, functions, functionName);
            }
            BindingFunctionStrategy.isСompatible = function (functionName) {
                return /^\$(global|model)\.[\w\$]+$/.test(functionName);
            };
            BindingFunctionStrategy.prototype.compile = function (functions, functionName, argNames) {
                var funcBody = "return " + functionName + "($context);", allParamNames = ["$context"];
                [].push.apply(allParamNames, argNames);
                var func = new Function(allParamNames.join(", "), funcBody);
                return function (context) {
                    var args = [context];
                    argNames.forEach(function (name) {
                        args.push(context[name]);
                    });
                    return func.apply(func, args);
                };
            };
            return BindingFunctionStrategy;
        }(CompilerTrivialStrategy));
        function trivialPromise() {
            var args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                args[_i - 0] = arguments[_i];
            }
            var d = $.Deferred();
            return d.resolve.apply(d, arguments).promise();
        }
        Logic.trivialPromise = trivialPromise;
        function rejectPromise() {
            var args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                args[_i - 0] = arguments[_i];
            }
            var d = $.Deferred();
            return d.reject.apply(d, arguments).promise();
        }
        Logic.rejectPromise = rejectPromise;
        function returnsValue(calls) {
            if (!calls) {
                return false;
            }
            var result = false, visitor = function (target) {
                if (target["_type"] === "Event" && target["flow"] === Logic.Flow.Return) {
                    result = true;
                    return;
                }
                $.each(target, function (_, value) {
                    if (result) {
                        return false;
                    }
                    if (value && ($.isArray(value) || typeof value === "object")) {
                        visitor(value);
                    }
                });
            };
            visitor(calls);
            return result;
        }
        Logic.returnsValue = returnsValue;
    })(Logic = AppPlayer.Logic || (AppPlayer.Logic = {}));
})(AppPlayer || (AppPlayer = {}));
/// <reference path="logic/functioncompiler.ts" />
var AppPlayer;
(function (AppPlayer) {
    var Modules;
    (function (Modules) {
        "use strict";
        var AuthorizationLocation = (function () {
            function AuthorizationLocation() {
            }
            return AuthorizationLocation;
        }());
        var Authorization = (function () {
            function Authorization(appConf, app) {
                var _this = this;
                this.locations = [];
                this.loginView = "";
                this.allowAnonymous = true;
                if (appConf.authorization) {
                    var auth = appConf.authorization;
                    this.loginView = auth.loginView;
                    this.allowAnonymous = auth.allowAnonymous;
                    (auth.locations || []).forEach(function (item) {
                        var allowAnonymous = item.allowAnonymous;
                        if (typeof allowAnonymous === "string") {
                            allowAnonymous = allowAnonymous.toLowerCase() === "true";
                        }
                        _this.locations.push({ view: item.view, allowAnonymous: allowAnonymous });
                    });
                }
                this.app = app;
                app.on("dataError", function (e) {
                    if (e["httpStatus"] === 401 || e["status"] === 401 || e.message === "Unauthorized") {
                        _this.logout();
                    }
                });
                this.onNavigating = function (e) {
                    if (!_this.canNavigate(e.uri)) {
                        if (_this.loginView) {
                            e.uri = _this.loginView;
                        }
                        else {
                            e.cancel = true;
                            AppPlayer.showErrorDialog("Login view is not specified and anonymous access is disabled");
                        }
                    }
                };
                this.app.on("navigating", this.onNavigating);
            }
            Object.defineProperty(Authorization.prototype, "authenticated", {
                get: function () {
                    return !!this.app.model.authenticated;
                },
                enumerable: true,
                configurable: true
            });
            Authorization.prototype.canNavigate = function (path) {
                if (this.authenticated) {
                    return true;
                }
                var locations = this.locations.filter(function (location) { return path.indexOf(location.view) === 0; });
                return locations.length ? locations[0].allowAnonymous : this.allowAnonymous;
            };
            Authorization.prototype.logout = function () {
                this.app.model.authenticated = false;
                if (this.loginView) {
                    this.app.navigate({ view: this.loginView }, { root: true });
                }
                else {
                    AppPlayer.showErrorDialog("Login view is not specified");
                }
            };
            return Authorization;
        }());
        Modules.Authorization = Authorization;
    })(Modules = AppPlayer.Modules || (AppPlayer.Modules = {}));
})(AppPlayer || (AppPlayer = {}));
var AppPlayer;
(function (AppPlayer) {
    "use strict";
    var dxui = DevExpress.ui;
    var dxdate = DevExpress.require("/utils/utils.date");
    // Fixes dxSelectBox from loosing its value when it isn't present in the items/dataSource list
    var XetSelectBox = (function (_super) {
        __extends(XetSelectBox, _super);
        function XetSelectBox() {
            _super.apply(this, arguments);
        }
        XetSelectBox.prototype._processDataSourceChanging = function () {
            this["_setListDataSource"]();
            this["_renderValue"]();
        };
        return XetSelectBox;
    }(dxui.dxSelectBox));
    AppPlayer.XetSelectBox = XetSelectBox;
    ;
    // Fixes crash when value contains a string (e.g. "$model.entity.CreatedOn)
    var dateInRange = dxdate.dateInRange;
    dxdate.dateInRange = function (date, min, max, format) {
        if (typeof date === "string") {
            return true;
        }
        else {
            return dateInRange(date, min, max, format);
        }
    };
    DevExpress.registerComponent("xetSelectBox", XetSelectBox);
})(AppPlayer || (AppPlayer = {}));
var AppPlayer;
(function (AppPlayer) {
    "use strict";
    ko.bindingHandlers["dxOptions"] = {
        update: function (element, valueAccessor) {
            var value = ko.utils.unwrapObservable(valueAccessor() || {});
            $.each(value, function (optionName, optionValue) {
                optionValue = ko.unwrap(optionValue) || 0;
                element["data-options"] = optionName + optionValue;
            });
        }
    };
    ko.bindingHandlers["dxPartialView"] = {
        init: function (element, valueAccessor, allBindings, viewModel, bindingContext) {
            //var view = ko.utils.unwrapObservable(valueAccessor() || {})["viewName"];
            $(element).append($("#xet-view").text());
        }
    };
    ko.bindingHandlers["themeCustomizer"] = {
        init: function (element, valueAccessor, allBindings, viewModel, bindingContext) {
            ko.computed(function () {
                var DYNAMIC_STYLES_ID = "dynamic-styles", css = valueAccessor().theme;
                if (css) {
                    $("#" + DYNAMIC_STYLES_ID).remove();
                    $("<style>" + css + "</style>")
                        .attr("type", "text/css")
                        .attr("id", DYNAMIC_STYLES_ID)
                        .appendTo("head");
                }
            });
        }
    };
    ko.bindingHandlers["xetScrollViewResetter"] = {
        init: function (element, valueAccessor, allBindings, viewModel, bindingContext) {
            valueAccessor()["reset"] = function () {
                $(element).find(".dx-scrollview").each(function (index, scrollViewElement) {
                    var scrollView = $(scrollViewElement).dxScrollView("instance");
                    scrollView.update();
                    scrollView.scrollTo(0);
                });
            };
        }
    };
    ko.bindingHandlers["debugger"] = {
        update: function (element, valueAccessor, allBindings, viewModel, bindingContext) {
            ko.unwrap(valueAccessor().track);
            /* tslint:disable: no-debugger */
            debugger;
            /* tslint:enable */
        }
    };
})(AppPlayer || (AppPlayer = {}));
var AppPlayer;
(function (AppPlayer) {
    "use strict";
    var dxdata = DevExpress.data;
    var DataSource = (function () {
        function DataSource() {
        }
        DataSource.initDataObservables = function (srcData, observableSelectors) {
            if (!$.isPlainObject(srcData)) {
                return srcData;
            }
            var data = {};
            var descriptors = {};
            $.each(srcData, function (propertyName, value) {
                var descriptor = AppPlayer.Model.getDescriptor(value, propertyName, observableSelectors);
                descriptors[propertyName] = descriptor;
            });
            Object.defineProperties(data, descriptors);
            return data;
        };
        DataSource.createDataSource = function (dataSourceConfig, context, stores, application) {
            var _this = this;
            var dataSourceContext = $.extend({}, context, {
                callerType: "datasource initializer",
                callerId: dataSourceConfig.id
            }), calculatedFieldContext = $.extend({}, context), callerInfo = {
                callerType: "calculated field",
                callerId: ""
            }, dsConfig = AppPlayer.Model.createLinkedModel(dataSourceConfig, dataSourceContext, callerInfo);
            // TODO: Vitik OData navigation property scenario. 
            if (typeof dsConfig.store === "string") {
                dsConfig.store = stores[dataSourceConfig.store];
            }
            var map;
            if (dataSourceConfig.observables && dataSourceConfig.observables.length) {
                map = AppPlayer.continueFunc(map, function (data) {
                    return _this.initDataObservables(data, dataSourceConfig.observables);
                });
            }
            if (dataSourceConfig.calculatedFields && dataSourceConfig.calculatedFields.length) {
                map = AppPlayer.continueFunc(map, function (data) {
                    var functionCompilers = AppPlayer.Model.getFunctionCompilers(dataSourceConfig.calculatedFields, application);
                    Object.defineProperties(data, AppPlayer.Model.getPropertiesDescriptors(functionCompilers, $.extend({}, { $data: data }, calculatedFieldContext), callerInfo));
                    return data;
                });
                if (dsConfig.store && typeof dsConfig.store.on === "function") {
                    dsConfig.store.on("updating", function (key, values) {
                        dataSourceConfig.calculatedFields.forEach(function (field) {
                            delete values[field.name];
                        });
                    });
                    dsConfig.store.on("updated", function (key, values) {
                        var functionCompilers = AppPlayer.Model.getFunctionCompilers(dataSourceConfig.calculatedFields, application);
                        Object.defineProperties(values, AppPlayer.Model.getPropertiesDescriptors(functionCompilers, $.extend({}, { $data: values }, calculatedFieldContext), callerInfo));
                    });
                }
            }
            ;
            if (map) {
                dsConfig["map"] = map;
            }
            var dataSource = new dxdata.DataSource(dsConfig);
            // DataSource won't subscribe to observables. Do this for him.
            ko.computed(function () { return dsConfig.filter; }).subscribe(function (filter) {
                dataSource.filter(filter);
                if (dataSource["_xetLoadedAtLeastOnce"]) {
                    dataSource.load();
                }
            });
            ko.computed(function () { return dsConfig.sort; }).subscribe(function (sort) {
                dataSource.sort(sort);
                if (dataSource["_xetLoadedAtLeastOnce"]) {
                    dataSource.load();
                }
            });
            var originalLoad = dataSource.load.bind(dataSource);
            dataSource.load = function () {
                dataSource["_xetLoadedAtLeastOnce"] = true;
                return originalLoad();
            };
            if (dsConfig.loadOptions) {
                dataSource.on("customizeStoreLoadOptions", function (loadOptions) {
                    loadOptions.storeLoadOptions.urlOverride = dsConfig.loadOptions.url;
                });
            }
            dataSource["_calculatedFields"] = dataSourceConfig.calculatedFields;
            dataSource["_refreshOnViewShown"] = dataSourceConfig.refreshOnViewShown;
            dataSource["_monitor"] = dataSourceConfig.monitor;
            return dataSource;
        };
        return DataSource;
    }());
    AppPlayer.DataSource = DataSource;
})(AppPlayer || (AppPlayer = {}));
var AppPlayer;
(function (AppPlayer) {
    "use strict";
    var dxhtml = DevExpress.framework.html;
    var dx = DevExpress;
    var LayoutHelper = (function () {
        function LayoutHelper() {
        }
        LayoutHelper.tryGetCurrentPlatform = function (platforms, currentDevice) {
            currentDevice = currentDevice || dx.devices.current();
            var matchingPlatforms = DevExpress.utils["findBestMatches"](currentDevice, (platforms || []).map(function (platform, index) {
                return $.extend({ platformIndex: index }, platform.options);
            }));
            return matchingPlatforms.length ? platforms[matchingPlatforms[0].platformIndex] : undefined;
        };
        LayoutHelper.getLayoutController = function (platform, designMode) {
            var layoutNameToControllerMap = {
                navbar: "NavBarController",
                slideout: "SlideOutController",
                split: "IOSSplitLayoutController",
                simple: "SimpleLayoutController",
                empty: "EmptyLayoutController",
                popup: "PopupLayoutController",
                designer: "DesignerController"
            }, controllerName = layoutNameToControllerMap[platform.layout], controller;
            if (platform.layout === "split" && platform.options.generic) {
                controllerName = "GenericSplitLayoutController";
            }
            controller = (controllerName && dx.framework.html[controllerName]) ? new dx.framework.html[controllerName]({
                swipeEnabled: !designMode
            }) : new dxhtml.DefaultLayoutController({
                name: "desktop",
                swipeEnabled: !designMode
            });
            if (designMode && controller instanceof DevExpress.framework.html.SlideOutController) {
                controller._toggleNavigation = function () { };
            }
            return controller;
        };
        LayoutHelper.createLayoutSet = function (platforms, designMode, views) {
            var result = { layoutSet: [], viewSpecificLayouts: [] };
            platforms.forEach(function (platform) {
                result.layoutSet.push($.extend({ controller: LayoutHelper.getLayoutController(platform, designMode) }, platform.options || {}));
            });
            if (views) {
                views.forEach(function (view) {
                    if (!view.platforms) {
                        return;
                    }
                    view.platforms.forEach(function (platform) {
                        var controller = LayoutHelper.getLayoutController(platform, designMode);
                        if (platform && platform.modal) {
                            controller = new dxhtml["PopupLayoutController"]({ childController: controller });
                        }
                        result.layoutSet.push($.extend({ customResolveRequired: true, controller: controller }, platform.options || {}));
                        result.viewSpecificLayouts.push({
                            view: view.id,
                            options: platform.options,
                            controller: controller
                        });
                    });
                });
            }
            return result;
        };
        LayoutHelper.tryGetViewSpecificLayoutController = function (viewName, viewSpecificLayouts) {
            var foundController;
            if (viewSpecificLayouts.length > 0) {
                for (var i = 0; i < viewSpecificLayouts.length; ++i) {
                    var layoutItem = viewSpecificLayouts[i], fits = true, currentDevice = DevExpress.devices.current();
                    if (layoutItem.view === viewName) {
                        if (layoutItem.options) {
                            $.each(layoutItem.options, function (field, value) {
                                if (currentDevice[field] !== value) {
                                    return fits = false;
                                }
                            });
                        }
                        if (fits) {
                            foundController = layoutItem.controller;
                            break;
                        }
                    }
                }
            }
            return foundController;
        };
        LayoutHelper.getDeviceType = function (currentDevice) {
            var deviceType = "phone";
            currentDevice = currentDevice || DevExpress.devices.current();
            if (!currentDevice.tablet && !currentDevice.phone) {
                deviceType = "desktop";
            }
            else if (currentDevice.tablet) {
                deviceType = "tablet";
            }
            return deviceType;
        };
        LayoutHelper.fillCommandMapping = function (commandMapping, commands, platforms, currentDevice) {
            var deviceType = this.getDeviceType(currentDevice), currentPlatform = LayoutHelper.tryGetCurrentPlatform(platforms, currentDevice), map = {
                "header": [
                    "ios-header-toolbar",
                    //"android-header-toolbar",
                    //"android-simple-toolbar",
                    //"tizen-header-toolbar",
                    //"tizen-simple-toolbar",
                    "generic-header-toolbar",
                    "desktop-toolbar",
                ],
                "footer": [
                    "ios-view-footer",
                    //"android-footer-toolbar",
                    //"tizen-footer-toolbar",
                    "generic-view-footer",
                ],
                "toolbar": ["generic-layout-toolbar"],
                "none": []
            };
            (commands || []).forEach(function (command) {
                var container = command.container ? command.container[deviceType] : null;
                if (!container) {
                    container = (currentPlatform && currentPlatform.defaultCommandContainer) || "header";
                }
                var currentCommand = {
                    id: command.id
                }, platformContainers = map[container];
                if (command.alignment && command.alignment.hasOwnProperty(deviceType)) {
                    currentCommand["location"] = command.alignment[deviceType];
                }
                else {
                    currentCommand["location"] = (currentPlatform && currentPlatform.defaultCommandLocation) || "after";
                }
                if (!platformContainers) {
                    console.error("Unknown command container '" + container + "'. Supported values are: header, footer, toolbar");
                    return;
                }
                platformContainers.forEach(function (container) {
                    if (commandMapping[container]) {
                        commandMapping[container].commands.push(currentCommand);
                    }
                    else {
                        commandMapping[container] = { commands: [currentCommand] };
                    }
                });
            });
            return commandMapping;
        };
        return LayoutHelper;
    }());
    AppPlayer.LayoutHelper = LayoutHelper;
})(AppPlayer || (AppPlayer = {}));
/// <reference path="logic/functioncompiler.ts" />
var AppPlayer;
(function (AppPlayer) {
    "use strict";
    ;
    var Model = (function () {
        function Model() {
        }
        Model.createAppModel = function (config, app) {
            var model = {}, context = { $global: model };
            return Model.createModelCore(config, app, context, "global ", model);
        };
        Model.createModel = function (config, app) {
            var model = {}, context = { $global: app["model"], $model: model };
            return Model.createModelCore(config, app, context, "", model);
        };
        Model.createModelCore = function (config, app, context, callerPrefix, model) {
            var allFields = [];
            if (config.params) {
                allFields.push.apply(allFields, config.params);
            }
            if (config.model) {
                allFields.push.apply(allFields, config.model);
            }
            if (config.functions) {
                allFields.push.apply(allFields, config.functions);
            }
            this.initializePlainTopLevelObservables(model, config.id, allFields, context, app);
            this.initializeCalculatedTopLevelObservables(model, allFields, context, callerPrefix, app);
            return model;
        };
        Model.createLinkedModel = function (options, context, callerInfo) {
            return AppPlayer.propertyVisitor(options, function (valueContext) {
                if (AppPlayer.endsWith(valueContext.name, "Expr")) {
                    return valueContext.value;
                }
                var expression = valueContext.value;
                if (expression && typeof expression === "string" && expression.charAt(0) === "$") {
                    var owner = valueContext.owner, propertyName = valueContext.name;
                    var value, modelValue = AppPlayer.getModelValue(expression, context, callerInfo);
                    if (typeof modelValue === "function") {
                        return valueContext.value;
                    }
                    if (valueContext.isArray) {
                        value = ko.computed(function () {
                            return owner[propertyName] = AppPlayer.getModelValue(expression, context, callerInfo);
                        });
                    }
                    else {
                        value = ko.computed(function () {
                            return AppPlayer.getModelValue(expression, context, callerInfo);
                        });
                        Object.defineProperty(owner, propertyName, {
                            enumerable: true,
                            configurable: true,
                            get: function () {
                                return value();
                            }
                        });
                    }
                    return;
                }
                return valueContext.value;
            });
        };
        Model.getFunctionCompilers = function (allFields, app) {
            var properties = [];
            allFields.forEach(function (item) {
                if (item.getter || item.setter || item.function) {
                    var result = {
                        name: item.name,
                        observables: item.observables,
                        getter: app.createFunctionCompiler(item.getter || item.function)
                    };
                    if (item.setter) {
                        result.setter = app.createFunctionCompiler(item.setter);
                    }
                    properties.push(result);
                }
            });
            return properties;
        };
        Model.getFunctionsDescriptors = function (functionCompilers, context, callerInformation) {
            var descriptors = {};
            functionCompilers.forEach(function (functionCompiler) {
                var callerInfo = {
                    callerType: callerInformation.callerType || "function",
                    callerId: callerInformation.callerId || functionCompiler.name
                }, func = function (args) { return functionCompiler.getter.run($.extend({}, context, args), callerInfo); }, descriptor = {
                    enumerable: true,
                    configurable: true,
                    get: function () { return func; }
                };
                descriptors[functionCompiler.name] = descriptor;
            });
            return descriptors;
        };
        Model.getPropertiesDescriptors = function (functionCompilers, context, callerInformation) {
            var _this = this;
            var descriptors = {};
            functionCompilers.forEach(function (functionCompiler) {
                var observable = ko.observable(), evaluated;
                var descriptor = {
                    enumerable: true,
                    configurable: true,
                    get: function () {
                        var callerInfo = {
                            callerType: callerInformation.callerType || "model property",
                            callerId: callerInformation.callerId || functionCompiler.name
                        };
                        if (!evaluated) {
                            ko.computed(function () {
                                functionCompiler.getter
                                    .run($.extend({}, context), callerInfo)
                                    .then(function (result) {
                                    var observedResult = _this.setObservableProperties(observable(), result, name, functionCompiler.observables);
                                    observable(observedResult);
                                });
                            });
                            evaluated = true;
                        }
                        return ko.unwrap(observable());
                    }
                };
                if (functionCompiler.setter) {
                    descriptor.set = function (value) {
                        var currentValue = observable();
                        if (currentValue === value) {
                            return;
                        }
                        if (ko.isObservable(currentValue)) {
                            console.error("Property cannot have a setter if getter returns observable.");
                            return;
                        }
                        functionCompiler.setter
                            .run($.extend({
                            $value: value
                        }, context));
                        var observedValue = _this.setObservableProperties(observable(), value, name, functionCompiler.observables);
                        observable(observedValue);
                    };
                }
                descriptors[functionCompiler.name] = descriptor;
            });
            return descriptors;
        };
        Model.processArrayMethodArguments = function (args, methodName, name, observableSelectors) {
            var newArguments;
            switch (methodName) {
                case "push":
                    newArguments = [];
                    for (var i = 0; i < args.length; ++i) {
                        newArguments.push(this.setObservableProperties(undefined, args[i], name, observableSelectors));
                    }
                    break;
                //TODO: all other method implementations - "reverse", "shift", "sort", "splice", "unshift"
                default:
                    break;
            }
            return newArguments;
        };
        Model.getObservableDescriptor = function (initialValue, name, observableSelectors) {
            var _this = this;
            var isArray = $.isArray(initialValue), observable = isArray ? ko.observableArray(initialValue) : ko.observable(initialValue);
            if (isArray) {
                ko.utils.arrayForEach(["pop", "push", "reverse", "shift", "sort", "splice", "unshift"], function (methodName) {
                    var originalMethod = initialValue[methodName];
                    initialValue[methodName] = function () {
                        var args = [];
                        for (var _i = 0; _i < arguments.length; _i++) {
                            args[_i - 0] = arguments[_i];
                        }
                        var processedArguments = _this.processArrayMethodArguments(args, methodName, name, observableSelectors), methodResult = originalMethod.apply(initialValue, processedArguments || args);
                        observable.valueHasMutated();
                        return methodResult;
                    };
                });
            }
            return {
                enumerable: true,
                configurable: true,
                get: function () {
                    return observable();
                },
                set: function (value) {
                    if (isArray && $.isArray(value)) {
                        observable.splice.apply(observable, [0, observable.peek().length].concat(value));
                    }
                    else {
                        observable(_this.setObservableProperties(observable(), value, name, observableSelectors));
                    }
                }
            };
        };
        Model.getPlainDescriptor = function (initialValue, name, observableSelectors) {
            var _this = this;
            var currentValue = initialValue;
            return {
                enumerable: true,
                configurable: true,
                get: function () {
                    return currentValue;
                },
                set: function (value) {
                    currentValue = _this.setObservableProperties(currentValue, value, name, observableSelectors);
                }
            };
        };
        Model.getDescriptor = function (initialValue, name, observableSelectors) {
            var nameParts = name.split("."), asterisk = "*";
            var shouldBeObservable = (observableSelectors || []).some(function (selector) {
                var selectorParts = selector.split("."), match = true;
                if (selectorParts.length < nameParts.length) {
                    match = selectorParts[selectorParts.length - 1] === asterisk;
                }
                else if (nameParts.length < selectorParts.length) {
                    match = false;
                }
                else {
                    for (var i = 0; i < nameParts.length; ++i) {
                        if (selectorParts[i] === asterisk) {
                            break;
                        }
                        else if (nameParts[i] === selectorParts[i]) {
                            continue;
                        }
                        else {
                            match = false;
                            break;
                        }
                    }
                }
                return match;
            });
            return shouldBeObservable
                ? this.getObservableDescriptor(initialValue, name, observableSelectors)
                : this.getPlainDescriptor(initialValue, name, observableSelectors);
        };
        Model.processArray = function (oldValue, newValue, parentName, observableSelectors) {
            var _this = this;
            var processedArray = [];
            $.each(newValue, function (index, childValue) {
                processedArray.push(_this.setObservableProperties(oldValue ? ko.unwrap(oldValue)[index] : undefined, childValue, parentName, observableSelectors));
            });
            return processedArray;
        };
        Model.setObservableProperties = function (oldValue, newValue, parentName, observableSelectors) {
            var _this = this;
            if (!observableSelectors || observableSelectors.length === 0) {
                return newValue;
            }
            if ($.isArray(newValue)) {
                return this.processArray(oldValue, newValue, parentName, observableSelectors);
            }
            else if ($.isPlainObject(newValue)) {
                var result = $.isPlainObject(oldValue) ? oldValue : {};
                // NOTE: remove properties from oldValue if not exist in newValue
                $.each(result, function (name, value) {
                    if (newValue[name] === undefined) {
                        delete result[name];
                    }
                });
                // NOTE: set existing or define non-existing properties
                var descriptors = {};
                $.each(newValue, function (propName, newPropValue) {
                    if (result[propName] === undefined) {
                        var currentName = parentName === "" ? propName : parentName + "." + propName;
                        var merged = _this.setObservableProperties(result[propName], newPropValue, currentName, observableSelectors);
                        descriptors[propName] = _this.getDescriptor(merged, currentName, observableSelectors);
                    }
                    else {
                        result[propName] = newPropValue;
                    }
                });
                Object.defineProperties(result, descriptors);
                return result;
            }
            return newValue;
        };
        Model.initializePlainTopLevelObservables = function (model, modelId, allFields, context, app) {
            var _this = this;
            var descriptors = {};
            allFields.forEach(function (item) {
                if (!item.getter) {
                    var isDefaultLoaded = false, observable = item.isArray ? ko.observableArray() : ko.observable(), setter = function (val) {
                        var newValue = _this.setObservableProperties(undefined, val, "", item.observables);
                        if (isDefaultLoaded && item.persistent) {
                            app.localStorage.put(modelId, item.name, val);
                        }
                        observable(newValue);
                    }, getter = function () {
                        //if(valueCompiler) {
                        //    valueCompiler.run($.extend({}, context, {
                        //        callerType: "model property's default value expression",
                        //        callerId: item.name
                        //    }))
                        //        .then((value) => {
                        //        setter(value);
                        //    });
                        //    valueCompiler = null;
                        //}
                        return observable();
                    };
                    if (item.defaultValue !== undefined) {
                        setter(AppPlayer.clone(item.defaultValue));
                    }
                    else {
                        setter(42); // TODO: defaultValue should depend on type
                    }
                    isDefaultLoaded = true;
                    if (item.persistent) {
                        var localValue = app.localStorage.get(modelId, item.name);
                        if (typeof localValue !== "undefined") {
                            observable(localValue);
                        }
                    }
                    descriptors[item.name] = {
                        enumerable: true,
                        configurable: true,
                        get: getter,
                        set: setter
                    };
                }
            });
            Object.defineProperties(model, descriptors);
        };
        Model.initializeCalculatedTopLevelObservables = function (model, allFields, context, callerPrefix, app) {
            var calculatedPropertyCompilers = this.getFunctionCompilers(allFields.filter(function (f) { return !!(f.getter || f.setter); }), app), functionCompilers = this.getFunctionCompilers(allFields.filter(function (f) { return !!f.function; }), app);
            Object.defineProperties(model, this.getPropertiesDescriptors(calculatedPropertyCompilers, context, { callerType: callerPrefix + "model property", callerId: "" }));
            Object.defineProperties(model, this.getFunctionsDescriptors(functionCompilers, context, { callerType: callerPrefix + "function", callerId: "" }));
        };
        Model.initializeDataSources = function (model, context, app, stores, reuseObservables, dataSourceConfigs) {
            var _this = this;
            var descriptors = {};
            (dataSourceConfigs || []).forEach(function (dataSourceConfig) {
                var dataSource = AppPlayer.DataSource.createDataSource(dataSourceConfig, context, stores, app);
                dataSource.on("loadError", function (error) {
                    if (error && error.message === "Unauthorized") {
                        return; // Suppress "Unauthorized" banners since the user will be still redirected to the login page and it won't add any meaning
                    }
                    AppPlayer.showErrorDialog(error, dataSourceConfig.id);
                });
                if (reuseObservables) {
                    model[dataSourceConfig.id].dispose();
                    model[dataSourceConfig.id] = new DevExpress.data.DataSource([{}]);
                    model[dataSourceConfig.id].load().then(function () {
                        model[dataSourceConfig.id].dispose();
                        model[dataSourceConfig.id] = dataSource;
                    });
                }
                descriptors[dataSourceConfig.id] = _this.getDescriptor(dataSource, dataSourceConfig.id, [dataSourceConfig.id]);
            });
            if (!reuseObservables) {
                Object.defineProperties(model, descriptors);
            }
        };
        return Model;
    }());
    AppPlayer.Model = Model;
})(AppPlayer || (AppPlayer = {}));
/*! LAB.js (LABjs :: Loading And Blocking JavaScript)
   v2.0.3 (c) Kyle Simpson
   MIT License
*/
/* tslint:disable */
(function (o) { var K = o.$LAB, y = "UseLocalXHR", z = "AlwaysPreserveOrder", u = "AllowDuplicates", A = "CacheBust", B = "BasePath", C = /^[^?#]*\//.exec(location.href)[0], D = /^\w+\:\/\/\/?[^\/]+/.exec(C)[0], i = document.head || document.getElementsByTagName("head"), L = (o.opera && Object.prototype.toString.call(o.opera) == "[object Opera]") || ("MozAppearance" in document.documentElement.style), q = document.createElement("script"), E = typeof q.preload == "boolean", r = E || (q.readyState && q.readyState == "uninitialized"), F = !r && q.async === true, M = !r && !F && !L; function G(a) { return Object.prototype.toString.call(a) == "[object Function]"; } function H(a) { return Object.prototype.toString.call(a) == "[object Array]"; } function N(a, c) { var b = /^\w+\:\/\//; if (/^\/\/\/?/.test(a)) {
    a = location.protocol + a;
}
else if (!b.test(a) && a.charAt(0) != "/") {
    a = (c || "") + a;
} return b.test(a) ? a : ((a.charAt(0) == "/" ? D : C) + a); } function s(a, c) { for (var b in a) {
    if (a.hasOwnProperty(b)) {
        c[b] = a[b];
    }
} return c; } function O(a) { var c = false; for (var b = 0; b < a.scripts.length; b++) {
    if (a.scripts[b].ready && a.scripts[b].exec_trigger) {
        c = true;
        a.scripts[b].exec_trigger();
        a.scripts[b].exec_trigger = null;
    }
} return c; } function t(a, c, b, d) { a.onload = a.onreadystatechange = function () { if ((a.readyState && a.readyState != "complete" && a.readyState != "loaded") || c[b])
    return; a.onload = a.onreadystatechange = null; d(); }; } function I(a) { a.ready = a.finished = true; for (var c = 0; c < a.finished_listeners.length; c++) {
    a.finished_listeners[c]();
} a.ready_listeners = []; a.finished_listeners = []; } function P(d, f, e, g, h) { setTimeout(function () { var a, c = f.real_src, b; if ("item" in i) {
    if (!i[0]) {
        setTimeout(arguments.callee, 25);
        return;
    }
    i = i[0];
} a = document.createElement("script"); if (f.type)
    a.type = f.type; if (f.charset)
    a.charset = f.charset; if (h) {
    if (r) {
        e.elem = a;
        if (E) {
            a.preload = true;
            a.onpreload = g;
        }
        else {
            a.onreadystatechange = function () { if (a.readyState == "loaded")
                g(); };
        }
        a.src = c;
    }
    else if (h && c.indexOf(D) == 0 && d[y]) {
        b = new XMLHttpRequest();
        b.onreadystatechange = function () { if (b.readyState == 4) {
            b.onreadystatechange = function () { };
            e.text = b.responseText + "\n//@ sourceURL=" + c;
            g();
        } };
        b.open("GET", c);
        b.send();
    }
    else {
        a.type = "text/cache-script";
        t(a, e, "ready", function () { i.removeChild(a); g(); });
        a.src = c;
        i.insertBefore(a, i.firstChild);
    }
}
else if (F) {
    a.async = false;
    t(a, e, "finished", g);
    a.src = c;
    i.insertBefore(a, i.firstChild);
}
else {
    t(a, e, "finished", g);
    a.src = c;
    i.insertBefore(a, i.firstChild);
} }, 0); } function J() { var l = {}, Q = r || M, n = [], p = {}, m; l[y] = true; l[z] = false; l[u] = false; l[A] = false; l[B] = ""; function R(a, c, b) { var d; function f() { if (d != null) {
    d = null;
    I(b);
} } if (p[c.src].finished)
    return; if (!a[u])
    p[c.src].finished = true; d = b.elem || document.createElement("script"); if (c.type)
    d.type = c.type; if (c.charset)
    d.charset = c.charset; t(d, b, "finished", f); if (b.elem) {
    b.elem = null;
}
else if (b.text) {
    d.onload = d.onreadystatechange = null;
    d.text = b.text;
}
else {
    d.src = c.real_src;
} i.insertBefore(d, i.firstChild); if (b.text) {
    f();
} } function S(c, b, d, f) { var e, g, h = function () { b.ready_cb(b, function () { R(c, b, e); }); }, j = function () { b.finished_cb(b, d); }; b.src = N(b.src, c[B]); b.real_src = b.src + (c[A] ? ((/\?.*$/.test(b.src) ? "&_" : "?_") + ~~(Math.random() * 1E9) + "=") : ""); if (!p[b.src])
    p[b.src] = { items: [], finished: false }; g = p[b.src].items; if (c[u] || g.length == 0) {
    e = g[g.length] = { ready: false, finished: false, ready_listeners: [h], finished_listeners: [j] };
    P(c, b, e, ((f) ? function () { e.ready = true; for (var a = 0; a < e.ready_listeners.length; a++) {
        e.ready_listeners[a]();
    } e.ready_listeners = []; } : function () { I(e); }), f);
}
else {
    e = g[0];
    if (e.finished) {
        j();
    }
    else {
        e.finished_listeners.push(j);
    }
} } function v() { var e, g = s(l, {}), h = [], j = 0, w = false, k; function T(a, c) { a.ready = true; a.exec_trigger = c; x(); } function U(a, c) { a.ready = a.finished = true; a.exec_trigger = null; for (var b = 0; b < c.scripts.length; b++) {
    if (!c.scripts[b].finished)
        return;
} c.finished = true; x(); } function x() { while (j < h.length) {
    if (G(h[j])) {
        try {
            h[j++]();
        }
        catch (err) { }
        continue;
    }
    else if (!h[j].finished) {
        if (O(h[j]))
            continue;
        break;
    }
    j++;
} if (j == h.length) {
    w = false;
    k = false;
} } function V() { if (!k || !k.scripts) {
    h.push(k = { scripts: [], finished: true });
} } e = { script: function () { for (var f = 0; f < arguments.length; f++) {
        (function (a, c) { var b; if (!H(a)) {
            c = [a];
        } for (var d = 0; d < c.length; d++) {
            V();
            a = c[d];
            if (G(a))
                a = a();
            if (!a)
                continue;
            if (H(a)) {
                b = [].slice.call(a);
                b.unshift(d, 1);
                [].splice.apply(c, b);
                d--;
                continue;
            }
            if (typeof a == "string")
                a = { src: a };
            a = s(a, { ready: false, ready_cb: T, finished: false, finished_cb: U });
            k.finished = false;
            k.scripts.push(a);
            S(g, a, k, (Q && w));
            w = true;
            if (g[z])
                e.wait();
        } })(arguments[f], arguments[f]);
    } return e; }, wait: function () { if (arguments.length > 0) {
        for (var a = 0; a < arguments.length; a++) {
            h.push(arguments[a]);
        }
        k = h[h.length - 1];
    }
    else
        k = false; x(); return e; } }; return { script: e.script, wait: e.wait, setOptions: function (a) { s(a, g); return e; } }; } m = { setGlobalDefaults: function (a) { s(a, l); return m; }, setOptions: function () { return v().setOptions.apply(null, arguments); }, script: function () { return v().script.apply(null, arguments); }, wait: function () { return v().wait.apply(null, arguments); }, queueScript: function () { n[n.length] = { type: "script", args: [].slice.call(arguments) }; return m; }, queueWait: function () { n[n.length] = { type: "wait", args: [].slice.call(arguments) }; return m; }, runQueue: function () { var a = m, c = n.length, b = c, d; for (; --b >= 0;) {
        d = n.shift();
        a = a[d.type].apply(null, d.args);
    } return a; }, noConflict: function () { o.$LAB = K; return m; }, sandbox: function () { return J(); } }; return m; } o.$LAB = J(); (function (a, c, b) { if (document.readyState == null && document[a]) {
    document.readyState = "loading";
    document[a](c, b = function () { document.removeEventListener(c, b, false); document.readyState = "complete"; }, false);
} })("addEventListener", "DOMContentLoaded"); })(this);
/* tslint:enable */
/**
 * (c) http://www.xenarius.net - Mobile applications for your data, built without coding.
 */
var Bootstrapper;
(function (Bootstrapper_1) {
    "use strict";
    var SimpleDeferred = (function () {
        function SimpleDeferred() {
            this.callbacks = [];
            this.isResolved = false;
        }
        SimpleDeferred.prototype.resolve = function () {
            this.isResolved = true;
            this.callbacks.forEach(function (callback) {
                callback();
            });
        };
        SimpleDeferred.prototype.done = function (callback) {
            if (this.isResolved) {
                callback();
            }
            else {
                this.callbacks.push(callback);
            }
        };
        return SimpleDeferred;
    }());
    Bootstrapper_1.SimpleDeferred = SimpleDeferred;
    var TaskProgressReporter = (function () {
        function TaskProgressReporter(approximateCount, onProgress, onTotalComplete) {
            if (approximateCount === void 0) { approximateCount = 0; }
            if (onProgress === void 0) { onProgress = function (progress) { }; }
            if (onTotalComplete === void 0) { onTotalComplete = function () { }; }
            this.approximateCount = approximateCount;
            this.onProgress = onProgress;
            this.onTotalComplete = onTotalComplete;
            this.completedCount = 0;
            this.realCount = 0;
            this.totalCount = 0;
            this.totalCount = approximateCount;
        }
        TaskProgressReporter.prototype.enqueue = function (count) {
            if (count === void 0) { count = 1; }
            this.realCount += count;
            if (this.realCount > this.totalCount) {
                this.totalCount = this.realCount;
                this.update();
            }
        };
        TaskProgressReporter.prototype.report = function (count) {
            if (count === void 0) { count = 1; }
            this.completedCount += count;
            this.update();
        };
        TaskProgressReporter.prototype.clear = function () {
            this.realCount = this.completedCount = this.totalCount = 0;
        };
        TaskProgressReporter.prototype.getCurrentProgress = function () {
            return this.completedCount * 100 / this.totalCount;
        };
        TaskProgressReporter.prototype.areTotalCompleted = function () {
            return this.completedCount === this.totalCount;
        };
        TaskProgressReporter.prototype.update = function () {
            //console.log([this.completedCount, this.realCount, this.totalCount])
            this.onProgress(this.getCurrentProgress());
            if (this.areTotalCompleted()) {
                this.onTotalComplete();
            }
        };
        return TaskProgressReporter;
    }());
    Bootstrapper_1.TaskProgressReporter = TaskProgressReporter;
    var Bootstrapper = (function () {
        function Bootstrapper(progressReporter) {
            if (progressReporter === void 0) { progressReporter = new TaskProgressReporter(); }
            this.progressReporter = progressReporter;
            this.lab = window["$LAB"];
        }
        Bootstrapper.prototype.get = function (url, done, fail) {
            if (typeof $ !== "undefined" && $.get) {
                $.get(url).then(done, fail);
            }
            else {
                var request = new XMLHttpRequest();
                request.open("GET", url, true);
                request.onreadystatechange = function () {
                    if (this.readyState === 4) {
                        if (this.status >= 200 && this.status < 400) {
                            done(this.responseText);
                        }
                        else {
                            fail();
                        }
                    }
                };
                request.send();
            }
        };
        Bootstrapper.prototype.initHtmlElement = function (element, resource) {
            element.setAttribute("type", "text/html");
            if (resource.id) {
                element.setAttribute("id", resource.id);
            }
            if (resource.rel) {
                element.setAttribute("rel", resource.rel);
            }
        };
        Bootstrapper.prototype.appendHtml = function (parent, html) {
            var div = document.createElement("div");
            div.innerHTML = html;
            while (div.children.length) {
                var child = div.children[0];
                parent.appendChild(child);
            }
        };
        Bootstrapper.prototype.normalize = function (resources, rootPath) {
            var _this = this;
            return (resources || []).map(function (resource) {
                var res = typeof resource === "string" ? { src: resource, fileType: null, id: null } : resource, src = res.src.indexOf("http") === 0 ? res.src : rootPath + ("/" + res.src).replace("//", "/");
                res.src = _this.insertFingerprint(src);
                res.fileType = res.fileType || res.src.split(".").pop().toLocaleLowerCase();
                return res;
            });
        };
        Bootstrapper.prototype.bootstrapResource = function (resource, onload) {
            var _this = this;
            if (onload === void 0) { onload = function () { }; }
            var fileref, onerror = function () { console.error("Could not load file: " + resource.src); };
            if (resource.fileType === "html") {
                if (resource.rel === "dx-template") {
                    fileref = document.createElement("link");
                    fileref.href = resource.src;
                    this.initHtmlElement(fileref, resource);
                    document.head.appendChild(fileref);
                    onload();
                }
                else {
                    this.get(resource.src, function (tmpl) {
                        if (tmpl.indexOf("type='text/html'") !== -1 || tmpl.indexOf("type=\"text/html\"") !== -1) {
                            if (resource.rel) {
                                var div = document.createElement("div");
                                div.style.display = "none";
                                div.innerHTML = tmpl;
                                document.body.appendChild(div);
                            }
                            else {
                                _this.appendHtml(document.body, tmpl);
                            }
                        }
                        else {
                            var fileref = document.createElement("script");
                            fileref.text = tmpl;
                            _this.initHtmlElement(fileref, resource);
                            document.body.appendChild(fileref);
                        }
                        onload();
                    }, onerror);
                }
            }
            else {
                if (resource.fileType === "js") {
                    this.lab = this.lab.script(resource.src).wait(onload);
                }
                else if (resource.fileType === "css") {
                    fileref = document.createElement("link");
                    fileref.setAttribute("rel", "stylesheet");
                    fileref.setAttribute("type", "text/css");
                    fileref.setAttribute("href", resource.src);
                    fileref.onload = onload;
                    fileref.onerror = onerror;
                    document.head.appendChild(fileref);
                }
                else {
                    console.error("Unsupported file type: %o", resource);
                    return;
                }
            }
        };
        Bootstrapper.prototype.insertFingerprint = function (path) {
            if (Bootstrapper_1.resourceFingerprint) {
                var index = path.lastIndexOf("/");
                index = path.indexOf(".", index);
                return path.substring(0, index) + Bootstrapper_1.resourceFingerprint + path.substring(index);
            }
            else {
                return path;
            }
        };
        Bootstrapper.prototype.bootstrap = function (resources, rootPath) {
            var _this = this;
            if (rootPath === void 0) { rootPath = ""; }
            var result = new SimpleDeferred(), filesCount = resources.length;
            this.progressReporter.enqueue(filesCount);
            this.normalize(resources, rootPath).forEach(function (file) {
                _this.bootstrapResource(file, function () {
                    _this.progressReporter.report();
                    if (!--filesCount) {
                        result.resolve();
                    }
                });
            });
            return result;
        };
        return Bootstrapper;
    }());
    Bootstrapper_1.Bootstrapper = Bootstrapper;
})(Bootstrapper || (Bootstrapper = {}));
/// <reference path="../../bootstrapper/ts/bootstrapper.ts" />
var AppPlayer;
(function (AppPlayer) {
    "use strict";
    var ModuleBase = (function () {
        function ModuleBase(application) {
            this._application = application;
        }
        return ModuleBase;
    }());
    AppPlayer.ModuleBase = ModuleBase;
    var ModulesLoader = (function (_super) {
        __extends(ModulesLoader, _super);
        function ModulesLoader(application, progressRepoter) {
            _super.call(this, progressRepoter);
            this._application = application;
        }
        ModulesLoader.prototype._initModule = function (moduleVarName) {
            var _this = this;
            var _module = AppPlayer.compileGetter(moduleVarName)(window);
            if (_module.functions && this._application) {
                _module.functions.forEach(function (funcDeclaration) {
                    _this._application.functions[funcDeclaration.id] = funcDeclaration.func;
                });
            }
            if (_module.createModule) {
                _module.createModule(this._application);
            }
        };
        ModulesLoader.prototype.initModules = function (modules) {
            var _this = this;
            var result = $.Deferred();
            var modulesConfig = modules || this._application && this._application.appConfig.modules;
            if (modulesConfig) {
                var promises = modulesConfig.map(function (moduleInfo) {
                    var ajaxResult = $.Deferred();
                    var rootModuleUrl = moduleInfo.src || moduleInfo;
                    $.getJSON(rootModuleUrl + "/" + _this.insertFingerprint(ModulesLoader.MODULEFILENAME)).done(function (moduleItem) {
                        _this.loadModule(rootModuleUrl, moduleItem).done(function () {
                            ajaxResult.resolve();
                        });
                    }).fail(function (error) {
                        ajaxResult.reject(error);
                    });
                    return ajaxResult;
                });
                $.when.apply($, promises).done(function () {
                    result.resolve();
                });
            }
            else {
                result.resolve();
            }
            return result.promise();
        };
        ModulesLoader.prototype.loadModule = function (rootPath, moduleItem) {
            var _this = this;
            var result = $.Deferred();
            this.bootstrap(moduleItem.files, rootPath).done(function () {
                if (moduleItem.namespace) {
                    _this._initModule(moduleItem.namespace);
                }
                result.resolve();
            });
            return result;
        };
        ModulesLoader.MODULEFILENAME = "module.json";
        return ModulesLoader;
    }(Bootstrapper.Bootstrapper));
    AppPlayer.ModulesLoader = ModulesLoader;
})(AppPlayer || (AppPlayer = {}));
var AppPlayer;
(function (AppPlayer) {
    var Styles;
    (function (Styles) {
        "use strict";
    })(Styles = AppPlayer.Styles || (AppPlayer.Styles = {}));
})(AppPlayer || (AppPlayer = {}));
var AppPlayer;
(function (AppPlayer) {
    "use strict";
    function bracketsToDots(expr) {
        return expr.replace(/\[/g, ".").replace(/\]/g, "");
    }
    ;
    function getModelValue(expr, runContext, callerInfo) {
        return executeModelSpecificAccessor(expr, runContext, callerInfo, function (specificModel, value) {
            return compileGetter(value)(specificModel);
        });
    }
    AppPlayer.getModelValue = getModelValue;
    ;
    function executeModelSpecificAccessor(expr, runContext, callerInfo, accessor) {
        var isNegative = expr.charAt(0) === "!", absExpr = isNegative ? expr.substring(1) : expr, pointIndex = absExpr.indexOf("."), rootPropertyName = absExpr.substring(0, pointIndex) || absExpr, valuePath = pointIndex === -1 ? "" : absExpr.substring(pointIndex + 1);
        return runContext[rootPropertyName] ? accessor(runContext[rootPropertyName], valuePath, isNegative) : expr;
    }
    function compileGetter(expr) {
        if (!expr) {
            return function (obj) { return ko.unwrap(obj); };
        }
        expr = bracketsToDots(expr);
        var path = expr.split(".");
        return function (obj) {
            var current = ko.unwrap(obj);
            path.forEach(function (name, index) {
                if (!current) {
                    return false;
                }
                var next = index !== path.length - 1 ? ko.unwrap(current[name]) : current[name];
                current = next;
            });
            return ko.unwrap(current);
        };
    }
    AppPlayer.compileGetter = compileGetter;
    ;
    AppPlayer.compileSetter = DevExpress.data.utils.compileSetter;
    function getQueryVariable(variable) {
        var query = window.location.search.substring(1);
        var vars = query.split("&");
        for (var i = 0; i < vars.length; i++) {
            var eqIndex = vars[i].indexOf("="), name = vars[i].slice(0, eqIndex), value = vars[i].slice(eqIndex + 1);
            if (name === variable) {
                return value;
            }
        }
        return null;
    }
    AppPlayer.getQueryVariable = getQueryVariable;
    ;
    function wrapModelReference(value, runContext, callerInfo) {
        return executeModelSpecificAccessor(value, runContext, callerInfo, function (specificModel, expression, negative) {
            return wrapReferenceField(specificModel, expression, negative);
        });
    }
    AppPlayer.wrapModelReference = wrapModelReference;
    function wrapReferenceField(model, val, negative) {
        var getter, setter, writeNotifier = ko.observable(), read, descriptor;
        if (val) {
            descriptor = Object.getOwnPropertyDescriptor(model, val);
            getter = compileGetter(val);
            if (!descriptor || descriptor.set || descriptor.writable) {
                setter = AppPlayer.compileSetter(val);
            }
        }
        else {
            getter = function () { return model; };
        }
        read = function () {
            ko.unwrap(writeNotifier);
            return negative ? !getter(model) : getter(model);
        };
        return ko.computed(setter ? {
            read: read,
            write: function (value) {
                setter(model, negative ? !value : value);
                writeNotifier.valueHasMutated();
            }
        } : { read: read });
    }
    ;
    function propertyVisitor(target, valueCallback, initialContext) {
        if (typeof target === "string") {
            return target;
        }
        var context = initialContext || { getValueCallback: function (value, context) { return propertyVisitor(value, valueCallback, context); } }, isArray = Array.isArray(target), result = isArray ? [] : {};
        context.path = context.path || "";
        $.each(target, function (name, value) {
            context.name = name;
            context.value = value;
            context.isArray = isArray;
            context.owner = result;
            if (Array.isArray(value) || $.isPlainObject(value)) {
                var oldPath = context.path;
                context.path = context.path ? context.path + (context.isArray ? "[" + context.name + "]" : "." + context.name) : context.name;
                result[name] = context.getValueCallback(value, context);
                context.path = oldPath;
            }
            else {
                var newVal = valueCallback(context);
                if (newVal !== undefined) {
                    result[name] = newVal;
                }
            }
        });
        return result;
    }
    AppPlayer.propertyVisitor = propertyVisitor;
    var BindingStringMaker = (function () {
        function BindingStringMaker() {
        }
        BindingStringMaker.valueCallback = function (result, context) {
            var value = context.value;
            return context.name + ": " + value + ",";
        };
        BindingStringMaker.arrayValueCallback = function (result, context) {
            return context.value + ",";
        };
        BindingStringMaker.makeString = function (model, isArray) {
            if (isArray === void 0) { isArray = false; }
            var result = "", context = {
                getValueCallback: function (value, context) {
                    if ($.isArray(value)) {
                        if (isArray) {
                            result += "[" + BindingStringMaker.makeString(value, true) + "],";
                        }
                        else {
                            result += context.name + ": " + "[" + BindingStringMaker.makeString(value, true) + "],";
                        }
                    }
                    else {
                        if (isArray) {
                            result += "{" + BindingStringMaker.makeString(value, false) + "},";
                        }
                        else {
                            result += context.name + ": " + "{" + BindingStringMaker.makeString(value, false) + "},";
                        }
                    }
                }
            };
            if (isArray) {
                propertyVisitor(model, function (context) {
                    result += BindingStringMaker.arrayValueCallback(result, context);
                }, context);
            }
            else {
                propertyVisitor(model, function (context) {
                    result += BindingStringMaker.valueCallback(result, context);
                }, context);
            }
            return result.slice(0, -1);
        };
        return BindingStringMaker;
    }());
    AppPlayer.BindingStringMaker = BindingStringMaker;
    function replaceAll(str, token, newToken) {
        return str.split(token).join(newToken);
    }
    AppPlayer.replaceAll = replaceAll;
    function startsWith(str, token) {
        if (token.length > str.length) {
            return false;
        }
        else if (token.length === str.length) {
            return token === str;
        }
        else {
            return str.substr(0, token.length) === token;
        }
    }
    AppPlayer.startsWith = startsWith;
    function endsWith(str, token) {
        if (typeof str !== "string" || typeof token !== "string") {
            return false;
        }
        if (token.length > str.length) {
            return false;
        }
        else if (token.length === str.length) {
            return token === str;
        }
        else {
            if (token.length === 1) {
                return str.charAt(str.length - 1) === token;
            }
            else {
                return str.substr(str.length - token.length, token.length) === token;
            }
        }
    }
    AppPlayer.endsWith = endsWith;
    function findInArray(array, predicate) {
        var index = indexInArray(array, predicate);
        return index >= 0 ? array[index] : null;
    }
    AppPlayer.findInArray = findInArray;
    function indexInArray(array, predicate) {
        if (array) {
            for (var i = 0; i < array.length; i++) {
                if (predicate(array[i])) {
                    return i;
                }
            }
        }
        return -1;
    }
    AppPlayer.indexInArray = indexInArray;
    function addHeaders(headers) {
        var result = function (request) { };
        if (headers && headers.length) {
            result = function (request) {
                headers.forEach(function (header) {
                    request.headers = request.headers || {};
                    request.headers[header.name] = header.value;
                });
            };
        }
        return result;
    }
    AppPlayer.addHeaders = addHeaders;
    function clone(value) {
        var key, result;
        if (value instanceof Date) {
            return new Date(value.getTime());
        }
        else if (value && (value instanceof Object)) {
            result = Array.isArray(value) ? [] : {};
            for (key in value) {
                if (value.hasOwnProperty(key)) {
                    result[key] = clone(value[key]);
                }
            }
            return result;
        }
        else {
            return value;
        }
    }
    AppPlayer.clone = clone;
    function extract(config, field) {
        var target, leftover = {};
        if (config) {
            for (var currentField in config) {
                if (currentField === field) {
                    target = config[currentField];
                }
                else {
                    leftover[currentField] = config[currentField];
                }
            }
        }
        return {
            target: target,
            leftover: leftover
        };
    }
    AppPlayer.extract = extract;
    function extractMany(config, fields) {
        var target = {}, leftover = {};
        if (config) {
            for (var currentField in config) {
                if ($.inArray(currentField, fields) !== -1) {
                    target[currentField] = config[currentField];
                }
                else {
                    leftover[currentField] = config[currentField];
                }
            }
        }
        return {
            target: target,
            leftover: leftover
        };
    }
    AppPlayer.extractMany = extractMany;
    function remap(config, map, passthrough) {
        var result = {};
        if (config) {
            for (var currentField in config) {
                if (map[currentField]) {
                    result[map[currentField]] = config[currentField];
                }
                else if (passthrough) {
                    result[currentField] = config[currentField];
                }
            }
        }
        return result;
    }
    AppPlayer.remap = remap;
    var ISO8601_DATE_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z?$/;
    function parseISO8601(isoString) {
        var chunks = isoString.replace("Z", "").split("T"), date = String(chunks[0]).split("-"), time = String(chunks[1]).split(":");
        var year, month, day, hours = 0, minutes = 0, seconds = 0, milliseconds = 0;
        year = Number(date[0]);
        month = Number(date[1]) - 1;
        day = Number(date[2]);
        if (time.length) {
            hours = Number(time[0]);
            minutes = Number(time[1]);
            seconds = Number(String(time[2]).split(".")[0]);
            milliseconds = Number(String(time[2]).split(".")[1]) || 0;
        }
        if (endsWith(isoString, "Z")) {
            return new Date(Date.UTC(year, month, day, hours, minutes, seconds, milliseconds));
        }
        else {
            return new Date(year, month, day, hours, minutes, seconds, milliseconds);
        }
    }
    AppPlayer.parseISO8601 = parseISO8601;
    function transformISODates(obj) {
        if (!obj) {
            return;
        }
        $.each(obj, function (key, value) {
            if (value !== null && typeof value === "object") {
                transformISODates(value);
            }
            else if (typeof value === "string") {
                if (ISO8601_DATE_REGEX.test(value)) {
                    obj[key] = new Date(parseISO8601(obj[key]).valueOf());
                }
            }
        });
    }
    AppPlayer.transformISODates = transformISODates;
    ;
    function parseDates(data, fields) {
        if (fields === void 0) { fields = []; }
        var isArray = Array.isArray(data), array = isArray ? data : [data];
        var parsed = array.map(function (item) {
            return typeof item === "string" && $.isEmptyObject(fields)
                ? new Date(parseISO8601(item).valueOf())
                : propertyVisitor(item, function (context) {
                    var fullPath = context.path && context.name && context.path + "." + context.name || context.path || context.name;
                    if (fields.indexOf(fullPath) !== -1 || $.isEmptyObject(fields)) {
                        return ISO8601_DATE_REGEX.test(context.value)
                            ? new Date(parseISO8601(context.value).valueOf())
                            : context.value;
                    }
                    return context.value;
                });
        });
        return isArray ? parsed : parsed[0];
    }
    AppPlayer.parseDates = parseDates;
    var LocalStorageWrapper = (function () {
        function LocalStorageWrapper(app) {
            this.app = app;
        }
        LocalStorageWrapper.prototype.put = function (modelId, id, val) {
            var key = this.getKey(modelId, id);
            if (val === undefined || val === null) {
                localStorage.removeItem(key);
            }
            else {
                localStorage.setItem(key, JSON.stringify(val));
            }
        };
        LocalStorageWrapper.prototype.get = function (modelId, id) {
            var key = this.getKey(modelId, id);
            var val = localStorage.getItem(key);
            return val ? JSON.parse(val) : undefined;
        };
        LocalStorageWrapper.prototype.getKey = function (modelId, id) {
            return this.getAppUserKey() + (modelId || "global") + "-" + id;
        };
        LocalStorageWrapper.prototype.getAppUserKey = function () {
            var appId = this.app.id ? this.app.id : "allapps";
            return "xet-ls-" + appId + "-";
        };
        return LocalStorageWrapper;
    }());
    AppPlayer.LocalStorageWrapper = LocalStorageWrapper;
    function handleOpenURL(url) {
        var uriIndex = url.indexOf("://"), paramsIndex = url.indexOf("?", uriIndex);
        var uri, params = {};
        if (paramsIndex >= 0) {
            uri = url.substring(uriIndex + 3, paramsIndex);
            var paramParts = url.substring(paramsIndex + 1).split("&");
            paramParts.forEach(function (part) {
                var equalIndex = part.indexOf("="), name, value;
                if (equalIndex < 0) {
                    params[part] = true;
                }
                else {
                    name = part.substring(0, equalIndex);
                    value = part.substr(equalIndex + 1);
                    params[name] = value;
                }
            });
        }
        else {
            uri = url.substr(uriIndex + 3);
        }
        // if app is open, redirect to the view provided
        // otherwise, save to a temporary variable
        if (window["app"] && window["app"].instance && window["app"].instance.dxapp) {
            var app = window["app"].instance;
            app.functions.navigateToView(uri, params, "master");
        }
        else {
            window["xetHandleOpenURL"] = {
                uri: uri,
                params: params
            };
        }
    }
    AppPlayer.handleOpenURL = handleOpenURL;
    function continueFunc(func, continulation) {
        if (func) {
            return function (arg) {
                var result = func(arg);
                return continulation(result);
            };
        }
        else {
            return continulation;
        }
    }
    AppPlayer.continueFunc = continueFunc;
    function showActionPopover(target, items, showCancelButton, title) {
        var $div = $("<div/>");
        $div.appendTo($(document.body));
        $div.dxActionSheet({
            dataSource: items,
            visible: true,
            title: title || "",
            showTitle: !!title,
            showCancelButton: showCancelButton,
            usePopover: true,
            target: target
        });
    }
    AppPlayer.showActionPopover = showActionPopover;
    function isPromise(value) {
        if (value == null || typeof value.then !== "function") {
            return false;
        }
        var promiseThenSrc = String($.Deferred().then);
        var valueThenSrc = String(value.then);
        return promiseThenSrc === valueThenSrc;
    }
    AppPlayer.isPromise = isPromise;
    function showErrorDialog(error, dataSourceId) {
        if (error === undefined) {
            return; // If byKey returns nothing, loadError handler is called. Suppress the warning.
        }
        var message = (typeof error === "string" || error instanceof String) ? error : (error && error.message) || "Unknown error";
        DevExpress.ui.notify({
            message: "",
            hideOnSwipe: false,
            contentTemplate: function () {
                var $res = $("<div class=\"dx-toast-message\" role=\"alert\"></div>"), hideToast = function () { $res.parents(".dx-toast").dxToast("instance").hide(); }, fullMessage = dataSourceId ? "'" + dataSourceId + "' data source error: " + message : message;
                $("<div/>").html(fullMessage).appendTo($res);
                if (message.indexOf("CORS") >= 0) {
                    var corsDoc = "https://xenarius.net/docs/cors.html";
                    $("<div/>").dxButton({
                        text: "Enable CORS",
                        type: "success",
                        onClick: function () {
                            hideToast();
                            window.open(corsDoc);
                        }
                    }).appendTo($res);
                }
                $("<div/>").dxButton({ text: "Dismiss", type: "danger", onClick: hideToast }).appendTo($res);
                return $res;
            }
        }, "error", 600000);
    }
    AppPlayer.showErrorDialog = showErrorDialog;
    function xmlToJs(node) {
        var data = {};
        // append a value
        function add(name, value) {
            if (data[name]) {
                if (data[name].constructor !== Array) {
                    data[name] = [data[name]];
                }
                data[name][data[name].length] = value;
            }
            else {
                data[name] = value;
            }
        }
        ;
        // element attributes
        var c, cn;
        for (c = 0; cn = node.attributes[c]; c++) {
            add(cn.name, cn.value);
        }
        // child elements
        for (c = 0; cn = node.childNodes[c]; c++) {
            if (cn.nodeType === 1) {
                if (cn.childNodes.length === 1 && cn.firstChild.nodeType === 3) {
                    // text value
                    add(cn.nodeName, cn.firstChild.nodeValue);
                }
                else {
                    // sub-object
                    add(cn.nodeName, xmlToJs(cn));
                }
            }
        }
        return data;
    }
    AppPlayer.xmlToJs = xmlToJs;
})(AppPlayer || (AppPlayer = {}));
/// <template path="../../AppPlayer/Templates/ViewComponents.html"/>
var AppPlayer;
(function (AppPlayer) {
    var Views;
    (function (Views) {
        "use strict";
        var eventCounter = 1;
        var DefaultsProvider = (function () {
            function DefaultsProvider() {
            }
            DefaultsProvider.GetDefaults = function (config) {
                return config.type && Views.componentInfos[config.type] && Views.componentInfos[config.type].defaults ? Views.componentInfos[config.type].defaults : {};
            };
            return DefaultsProvider;
        }());
        Views.DefaultsProvider = DefaultsProvider;
        var ComponentMarkupRenderBase = (function () {
            function ComponentMarkupRenderBase(config, options) {
                this.options = {};
                this.options = $.extend({}, { designMode: false, defaultsGetter: DefaultsProvider.GetDefaults }, options);
                this.config = $.extend(true, {}, this.options.defaultsGetter(config), config);
            }
            ComponentMarkupRenderBase.prototype._getModelObject = function (modelConfig, app) {
                return this.patchConfig(modelConfig || this.config, app);
            };
            ComponentMarkupRenderBase.prototype._getBindnigStringObject = function (modelObject) {
                var result = $.extend({}, modelObject);
                delete result["type"];
                return result;
            };
            ComponentMarkupRenderBase.prototype.getModel = function (app, modelConfig) {
                var modelObject = this._getModelObject(modelConfig || this.config, app), self = this, model = {
                    model: modelObject,
                    get bindingString() {
                        return AppPlayer.BindingStringMaker.makeString(self._getBindnigStringObject(modelObject));
                    }
                };
                return model;
            };
            ComponentMarkupRenderBase.prototype._patchField = function (fieldValue) {
                if (typeof fieldValue === "string") {
                    fieldValue = "'" + fieldValue.replace(/'/g, "\\'") + "'";
                }
                return fieldValue;
            };
            ComponentMarkupRenderBase.prototype._patchConfig = function (config, app) {
                return this.patchConfig({ config: config }, app).config;
            };
            ComponentMarkupRenderBase.prototype._patchEvents = function (componentConfig, componentInfo, app) {
                if (componentInfo.events) {
                    componentInfo.events.forEach(function (eventName) {
                        var event = componentConfig[eventName], fn, id, functionCompiler;
                        if (!event || !app || !app.createFunctionCompiler) {
                            return;
                        }
                        else {
                            functionCompiler = app.createFunctionCompiler(event);
                            fn = function (context) {
                                return functionCompiler.run($.extend({}, context), {
                                    callerType: "event of the " + componentConfig.id + "component",
                                    callerId: eventName
                                });
                            };
                            id = "anonymousEvent" + eventCounter++;
                            app.functions[id] = fn;
                            componentConfig[eventName] = id;
                        }
                    });
                }
            };
            ComponentMarkupRenderBase.prototype.patchConfig = function (config, app) {
                var _this = this;
                return AppPlayer.propertyVisitor(config, function (context) {
                    return _this.options.designMode || (context.name === "type") ? context.value : _this._patchField(context.value);
                }, {
                    getValueCallback: function (value) {
                        var componentInfo = value.type && Views.componentInfos[value.type];
                        if (componentInfo) {
                            _this._patchEvents(value, componentInfo, app);
                            return new componentInfo.rendererType(value, null).getModel(app);
                        }
                        else {
                            return _this.patchConfig(value, app);
                        }
                    }
                });
            };
            ComponentMarkupRenderBase.prototype._copyMargins = function (from, to) {
                if (from && to) {
                    to["marginTop"] = from["marginTop"];
                    to["marginRight"] = from["marginRight"];
                    to["marginBottom"] = from["marginBottom"];
                    to["marginLeft"] = from["marginLeft"];
                }
            };
            return ComponentMarkupRenderBase;
        }());
        Views.ComponentMarkupRenderBase = ComponentMarkupRenderBase;
        var ViewMarkupRenderer = (function (_super) {
            __extends(ViewMarkupRenderer, _super);
            function ViewMarkupRenderer(viewConfig, application) {
                _super.call(this, viewConfig, {});
                this.viewConfig = viewConfig;
                this.application = application;
            }
            ViewMarkupRenderer.prototype.getModel = function () {
                var model = _super.prototype.getModel.call(this, this.application).model;
                return {
                    model: model,
                    bindingString: AppPlayer.BindingStringMaker.makeString({
                        name: model.id,
                        title: model.title,
                        disableCache: model.disableCache,
                        pane: model.pane
                    })
                };
            };
            ViewMarkupRenderer.prototype.render = function () {
                var _this = this;
                var result, error;
                //dust["debugLevel"] = "DEBUG";
                dust["onLoad"] = function (name, callback) {
                    var template = document.getElementById(name);
                    if (!template) {
                        _this.application.registerMissingTemplate(name.substr("xet-dust-".length));
                    }
                    // TODO Pletnev remove || "!template with name " + name + " is not found!"
                    callback(null, template ? template.innerHTML : "!template with name " + name + " is not found!");
                };
                dust.render("xet-dust-view", this.getModel(), function (err, out) {
                    error = err;
                    result = out;
                });
                if (!result) {
                    throw new Error("Something went wrong during rendering of the '" + this.viewConfig.id + "' view markup. Error: \n" + error);
                }
                return result;
            };
            return ViewMarkupRenderer;
        }(ComponentMarkupRenderBase));
        Views.ViewMarkupRenderer = ViewMarkupRenderer;
        var BoxMarkupRender = (function (_super) {
            __extends(BoxMarkupRender, _super);
            function BoxMarkupRender(config, options) {
                if (options === void 0) { options = {}; }
                _super.call(this, config, options);
            }
            BoxMarkupRender.prototype.getModel = function (app) {
                var componentsAndWidget = AppPlayer.extract(this.config, "components"), model = {
                    type: this.config.type,
                    box: _super.prototype.getModel.call(this, app, componentsAndWidget.leftover),
                    components: this._patchConfig(componentsAndWidget.target, app)
                };
                return {
                    model: model,
                    bindingString: model.box.bindingString
                };
            };
            return BoxMarkupRender;
        }(ComponentMarkupRenderBase));
        Views.BoxMarkupRender = BoxMarkupRender;
        var ContainerMarkupRender = (function (_super) {
            __extends(ContainerMarkupRender, _super);
            function ContainerMarkupRender(config, options) {
                if (options === void 0) { options = {}; }
                _super.call(this, config, options);
            }
            ContainerMarkupRender.prototype.getModel = function (app) {
                var _this = this;
                var contentAndContainerStyles = AppPlayer.extractMany(this.config.style, ["verticalAlign", "maxWidth"]), config = $.extend({}, this.config, {
                    container: {
                        containerStyle: AppPlayer.remap(contentAndContainerStyles.leftover, { horizontalAlign: "textAlign" }, true),
                        contentStyle: contentAndContainerStyles.target
                    }
                }), componentsAndContainer = AppPlayer.extract(config, "components");
                this._copyMargins(this.config.style, config.container.containerStyle);
                var model = {
                    type: this.config.type,
                    container: _super.prototype.getModel.call(this, app, componentsAndContainer.leftover),
                    components: (componentsAndContainer.target || []).map(function (component) {
                        return _super.prototype._patchConfig.call(_this, component, app);
                    })
                };
                return {
                    model: model,
                    bindingString: model.container.bindingString
                };
            };
            return ContainerMarkupRender;
        }(ComponentMarkupRenderBase));
        Views.ContainerMarkupRender = ContainerMarkupRender;
        var PassboxMarkupRender = (function (_super) {
            __extends(PassboxMarkupRender, _super);
            function PassboxMarkupRender(config, options) {
                if (options === void 0) { options = {}; }
                _super.call(this, config, options);
            }
            PassboxMarkupRender.prototype._getModelObject = function (modelConfig, app) {
                modelConfig.mode = "password";
                return _super.prototype._getModelObject.call(this, modelConfig, app);
            };
            return PassboxMarkupRender;
        }(ComponentMarkupRenderBase));
        Views.PassboxMarkupRender = PassboxMarkupRender;
        var DateboxMarkupRender = (function (_super) {
            __extends(DateboxMarkupRender, _super);
            function DateboxMarkupRender(config, options) {
                if (options === void 0) { options = {}; }
                _super.call(this, config, options);
            }
            DateboxMarkupRender.prototype._getModelObject = function (modelConfig, app) {
                modelConfig.pickerType = "rollers";
                return _super.prototype._getModelObject.call(this, modelConfig, app);
            };
            return DateboxMarkupRender;
        }(ComponentMarkupRenderBase));
        Views.DateboxMarkupRender = DateboxMarkupRender;
        var CommandMarkupRender = (function (_super) {
            __extends(CommandMarkupRender, _super);
            function CommandMarkupRender(config, options) {
                if (options === void 0) { options = {}; }
                _super.call(this, config, options);
            }
            CommandMarkupRender.prototype._getModelObject = function (modelConfig, app) {
                var result = _super.prototype._getModelObject.call(this, modelConfig, app), device = AppPlayer.LayoutHelper.getDeviceType();
                ["showIcon", "showText"].forEach(function (name) {
                    if (result[name]) {
                        result[name] = result[name][device];
                    }
                });
                return result;
            };
            CommandMarkupRender.prototype._getBindnigStringObject = function (modelObject) {
                var result = _super.prototype._getBindnigStringObject.call(this, modelObject);
                result.type = modelObject.buttonType;
                return result;
            };
            return CommandMarkupRender;
        }(ComponentMarkupRenderBase));
        Views.CommandMarkupRender = CommandMarkupRender;
        var RowMarkupRender = (function (_super) {
            __extends(RowMarkupRender, _super);
            function RowMarkupRender(config, options) {
                if (options === void 0) { options = {}; }
                _super.call(this, config, options);
            }
            RowMarkupRender.getBootstrapColStyle = function (column, wrap, totalSpanCount) {
                var bootstrapColStyle = "", devices = ["lg", "md", "tablet", "phone"], map = {
                    lg: "lg",
                    md: "md",
                    tablet: "sm",
                    phone: "xs"
                }, span = column.span;
                devices.forEach(function (device) {
                    if (wrap && wrap[device]) {
                        span = totalSpanCount / wrap[device];
                    }
                    bootstrapColStyle += "col-" + map[device] + "-" + span + " ";
                });
                return bootstrapColStyle;
            };
            RowMarkupRender.prototype.getModel = function (app) {
                var _this = this;
                var columnsAndRow = AppPlayer.extract(this.config, "columns");
                (columnsAndRow.target || []).forEach(function (value) {
                    value["style"] = value["style"] || {};
                    value.style.verticalAlign = (columnsAndRow.leftover["style"] && columnsAndRow.leftover["style"].verticalAlign) || "top";
                });
                var model = {
                    type: this.config.type,
                    row: _super.prototype.getModel.call(this, app, columnsAndRow.leftover),
                    columns: (this._patchConfig(columnsAndRow.target, app) || []).map(function (column) {
                        return $.extend(column, {
                            bootstrapColStyle: _this._patchField(RowMarkupRender.getBootstrapColStyle(column, _this.config.wrap, _this.config.totalSpanCount || 12)),
                            style: _super.prototype.getModel.call(_this, app, AppPlayer.remap(column.style, { horizontalAlign: "textAlign" }, true))
                        });
                    })
                };
                return {
                    model: model,
                    bindingString: model.row.bindingString
                };
            };
            return RowMarkupRender;
        }(ComponentMarkupRenderBase));
        Views.RowMarkupRender = RowMarkupRender;
        var ListMarkupRender = (function (_super) {
            __extends(ListMarkupRender, _super);
            function ListMarkupRender(config, options) {
                if (options === void 0) { options = {}; }
                _super.call(this, config, options);
            }
            ListMarkupRender.prototype.getModel = function (app) {
                var itemAndGroupList = AppPlayer.extract(this.config, "itemComponents"), groupAndList = AppPlayer.extract(itemAndGroupList.leftover, "groupComponents");
                groupAndList.leftover["scrollingEnabled"] = !!this.config["scrollable"];
                var model = {
                    type: this.config.type,
                    list: _super.prototype.getModel.call(this, app, groupAndList.leftover),
                    item: this._patchConfig(itemAndGroupList.target, app),
                    group: this._patchConfig(groupAndList.target, app)
                };
                return {
                    model: model,
                    bindingString: model.list.bindingString
                };
            };
            return ListMarkupRender;
        }(ComponentMarkupRenderBase));
        Views.ListMarkupRender = ListMarkupRender;
        var FieldsetMarkupRender = (function (_super) {
            __extends(FieldsetMarkupRender, _super);
            function FieldsetMarkupRender(config, options) {
                if (options === void 0) { options = {}; }
                _super.call(this, config, options);
            }
            FieldsetMarkupRender.prototype.getModel = function (app) {
                var _this = this;
                var fieldsAndFieldset = AppPlayer.extract(this.config, "fields"), model = {
                    type: this.config.type,
                    fieldset: _super.prototype.getModel.call(this, app, fieldsAndFieldset.leftover),
                    fields: (fieldsAndFieldset.target || []).map(function (field) {
                        field.visible = field.visible === undefined ? true : field.visible;
                        return $.extend(true, {
                            model: _this._patchConfig({
                                title: field.title,
                                visible: field.visible
                            }, app)
                        }, _this._patchConfig(field, app));
                    }),
                    //TODO Pletnev: Remove this along with its applayer/appdesigner templates when dxFieldSet supports this option out of the box
                    singleColumnLayout: AppPlayer.LayoutHelper.getDeviceType() === "phone"
                };
                return {
                    model: model,
                    bindingString: model.fieldset.bindingString
                };
            };
            return FieldsetMarkupRender;
        }(ComponentMarkupRenderBase));
        Views.FieldsetMarkupRender = FieldsetMarkupRender;
        var TabsMarkupRender = (function (_super) {
            __extends(TabsMarkupRender, _super);
            function TabsMarkupRender(config, options) {
                if (options === void 0) { options = {}; }
                _super.call(this, config, options);
            }
            TabsMarkupRender.prototype.getModel = function (app) {
                var tabs = AppPlayer.extract(this.config, "tabs");
                delete tabs.leftover["type"];
                if (this.config.style && this.config.style.height) {
                    tabs.leftover["height"] = this.config.style.height;
                }
                var style = AppPlayer.extract(tabs.leftover, "style"), model = {
                    type: this.config.type,
                    tabpanel: _super.prototype.getModel.call(this, app, style.leftover),
                    control: _super.prototype.getModel.call(this, app, { tabpanel: style.leftover, style: style.target }),
                    tabs: this._patchConfig(tabs.target, app)
                };
                return {
                    model: model,
                    bindingString: model.tabpanel.bindingString
                };
            };
            return TabsMarkupRender;
        }(ComponentMarkupRenderBase));
        Views.TabsMarkupRender = TabsMarkupRender;
        var AccordionMarkupRender = (function (_super) {
            __extends(AccordionMarkupRender, _super);
            function AccordionMarkupRender(config, options) {
                if (options === void 0) { options = {}; }
                _super.call(this, config, options);
            }
            AccordionMarkupRender.prototype.getModel = function (app) {
                var panels = AppPlayer.extract(this.config, "panels");
                delete panels.leftover["type"];
                var style = AppPlayer.extract(panels.leftover, "style"), model = {
                    type: this.config.type,
                    control: _super.prototype.getModel.call(this, app, { options: style.leftover, style: style.target }),
                    panels: this._patchConfig(panels.target, app)
                };
                return {
                    model: model,
                    bindingString: ""
                };
            };
            return AccordionMarkupRender;
        }(ComponentMarkupRenderBase));
        Views.AccordionMarkupRender = AccordionMarkupRender;
        var ScrollViewMarkupRender = (function (_super) {
            __extends(ScrollViewMarkupRender, _super);
            function ScrollViewMarkupRender(config, options) {
                if (options === void 0) { options = {}; }
                _super.call(this, config, options);
            }
            ScrollViewMarkupRender.prototype.getModel = function (app) {
                var contentAndView = AppPlayer.extract(this.config, "components");
                return {
                    model: {
                        type: this.config.type,
                        scrollview: _super.prototype.getModel.call(this, app, contentAndView.leftover),
                        components: this._patchConfig(contentAndView.target, app)
                    },
                    bindingString: ""
                };
            };
            return ScrollViewMarkupRender;
        }(ComponentMarkupRenderBase));
        Views.ScrollViewMarkupRender = ScrollViewMarkupRender;
        //TODO Pletnev Cache getComponentModel results by hash of (componentName + viewModel)
        //TODO Pletnev And extract model: any from arguments (getComponentModel should return a function that takes model: any)
        function getComponentModel(params) {
            var componentInfo = params.componentName ? AppPlayer.Views.componentInfos[params.componentName] : null, bindingProperties = [], componentViewModel = AppPlayer.propertyVisitor(params.viewModel, function (context) {
                var value = context.value, propName = context.name, isEvent = false, result = value, fn;
                if (componentInfo && componentInfo.events) {
                    isEvent = componentInfo.events.some(function (eventName) { return eventName === propName; });
                }
                if (isEvent) {
                    fn = params.functions[value];
                    var runContext = $.extend({}, params.runContext);
                    result = function (e) {
                        var event = e ? e.jQueryEvent : null;
                        if (event && event.stopPropagation && params.componentName !== "command") {
                            event.stopPropagation();
                        }
                        // TODO Pletnev Choose itemData or data depending on event and object
                        if (e && (e.itemData || e.data)) {
                            runContext.$data = e.itemData || e.data;
                        }
                        else {
                            runContext.$data = params.runContext.$data;
                        }
                        return fn(runContext);
                    };
                }
                else {
                    if (typeof value === "string") {
                        var val = value;
                        if (val.indexOf("'") === 0 && val.lastIndexOf("'") === val.length - 1) {
                            val = val.substr(1, val.length - 2);
                        }
                        result = AppPlayer.wrapModelReference(val, params.runContext, params.callerInfo);
                        if (result !== val) {
                            bindingProperties.push(context.path ? context.path + "." + propName : propName);
                        }
                    }
                }
                return result;
            });
            if (componentInfo && componentInfo.componentViewModel) {
                componentViewModel = componentInfo.componentViewModel(componentViewModel);
            }
            if (bindingProperties.length > 0) {
                componentViewModel["_bindingProperties"] = bindingProperties;
            }
            return componentViewModel;
        }
        Views.getComponentModel = getComponentModel;
        function isNestedTemplateModel(bindingContext) {
            while (bindingContext.$parent) {
                if (bindingContext["nestedTemplateModel"] !== undefined) {
                    return bindingContext["nestedTemplateModel"];
                }
                bindingContext = bindingContext.$parent;
            }
            return false;
        }
        ko.bindingHandlers["withModel"] = {
            init: function (element, valueAccessor, allBindings, viewModel, bindingContext) {
                var value = valueAccessor(), nestedTemplateModel = isNestedTemplateModel(bindingContext), model = bindingContext.$root, data = bindingContext.$data, $templateElement;
                if (nestedTemplateModel) {
                    $templateElement = $(ko.virtualElements.firstChild(element)).parents("[data-options^='dxTemplate']");
                    if ($templateElement.length > 0) {
                        data = ko.dataFor($templateElement.get(0));
                    }
                }
                viewModel = getComponentModel({
                    componentName: value.component,
                    runContext: {
                        $data: data,
                        $model: model,
                        $global: model._global
                    },
                    callerInfo: {
                        callerType: "getComponentModel delegate",
                        callerId: value.component
                    },
                    viewModel: value.viewModel,
                    functions: model._functions
                });
                viewModel.nestedTemplateModel = nestedTemplateModel;
                // Make a modified binding context, with a extra properties, and apply it to descendant elements
                ko.applyBindingsToDescendants(bindingContext.createChildContext(viewModel, "component", // Optionally, pass a string here as an alias for the data item in descendant contexts
                function (context) {
                    ko.utils.extend(context, valueAccessor());
                }), element);
                // Also tell KO *not* to bind the descendants itself, otherwise they will be bound twice
                return { controlsDescendantBindings: true };
            }
        };
        ko.virtualElements.allowedBindings["withModel"] = true;
    })(Views = AppPlayer.Views || (AppPlayer.Views = {}));
})(AppPlayer || (AppPlayer = {}));
/// <reference path="views/viewmarkuprenderer.ts" />
var AppPlayer;
(function (AppPlayer) {
    var Views;
    (function (Views) {
        "use strict";
        var View = (function () {
            function View(viewConfig, application, rootElement) {
                if (AppPlayer.findInArray(viewConfig.params, function (p) { return !!p.shared; })) {
                    viewConfig.disableCache = true;
                }
                var viewMarkup = (new Views.ViewMarkupRenderer(viewConfig, application)).render();
                $(rootElement || document.body).append(viewMarkup);
                this.viewModel = function (params) {
                    var vm = new Views.ViewModel(viewConfig, application, params);
                    return vm.model;
                };
            }
            return View;
        }());
        Views.View = View;
    })(Views = AppPlayer.Views || (AppPlayer.Views = {}));
})(AppPlayer || (AppPlayer = {}));
var AppPlayer;
(function (AppPlayer) {
    var Layout;
    (function (Layout) {
        "use strict";
        var Component = (function () {
            function Component() {
                this.attachedProperties = [];
            }
            return Component;
        }());
        Layout.Component = Component;
        var Container = (function (_super) {
            __extends(Container, _super);
            function Container() {
                _super.apply(this, arguments);
                this.components = [];
            }
            Container.prototype.layoutChildren = function () { };
            return Container;
        }(Component));
        Layout.Container = Container;
        var Row = (function (_super) {
            __extends(Row, _super);
            function Row() {
                _super.apply(this, arguments);
            }
            Row.prototype.layoutChildren = function () { };
            return Row;
        }(Container));
        Layout.Row = Row;
    })(Layout = AppPlayer.Layout || (AppPlayer.Layout = {}));
})(AppPlayer || (AppPlayer = {}));
/// <reference path="viewmarkuprenderer.ts" />
var AppPlayer;
(function (AppPlayer) {
    var Views;
    (function (Views) {
        "use strict";
        Views.componentInfos = {
            "view": {
                rendererType: Views.ComponentMarkupRenderBase,
                events: ["onLoad", "onShow", "onHide", "onDispose"]
            },
            "link": {
                rendererType: Views.ComponentMarkupRenderBase,
                defaults: { text: "", link: "", visible: true }
            },
            "label": {
                rendererType: Views.ComponentMarkupRenderBase,
                defaults: { text: "", visible: true }
            },
            "button": {
                rendererType: Views.ComponentMarkupRenderBase,
                events: ["onClick"],
                mapping: {
                    customControl: {
                        kind: "type"
                    }
                },
                componentViewModel: function (viewModel) {
                    return AppPlayer.remap(viewModel, Views.componentInfos["button"].mapping.customControl, true);
                }
            },
            "input": {
                rendererType: Views.ComponentMarkupRenderBase,
                events: ["onChange"]
            },
            "image": {
                rendererType: Views.ComponentMarkupRenderBase,
                defaults: { width: "auto", height: "auto", visible: true }
            },
            "fileimage": {
                rendererType: Views.ComponentMarkupRenderBase,
                defaults: {
                    emptyLabel: "Click or tap to select image",
                    changeImageText: "Take photo or select from gallery",
                    clearText: "Clear",
                    openGalleryText: "Select from gallery",
                    takePhotoText: "Take photo",
                    style: {
                        fontSize: "12px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "normal"
                    }
                },
                componentViewModel: function (viewModel) {
                    return new Views.FileImageEditorViewModel(viewModel);
                }
            },
            "textarea": {
                rendererType: Views.ComponentMarkupRenderBase,
                events: ["onChange"]
            },
            "passbox": {
                rendererType: Views.PassboxMarkupRender,
                events: ["onChange"]
            },
            "numberbox": {
                rendererType: Views.ComponentMarkupRenderBase,
                defaults: { showSpinButtons: true, value: null },
                events: ["onValueChanged"]
            },
            "radio": {
                rendererType: Views.ComponentMarkupRenderBase,
                mapping: {
                    customControl: {
                        stringItems: "items",
                        stringValue: "value"
                    }
                },
                componentViewModel: function (viewModel) {
                    viewModel = AppPlayer.remap(viewModel, Views.componentInfos["radio"].mapping.customControl, true);
                    return viewModel;
                }
            },
            "actionsheet": {
                rendererType: Views.ComponentMarkupRenderBase,
                events: ["onItemClick"]
            },
            "switch": {
                rendererType: Views.ComponentMarkupRenderBase
            },
            "loadpanel": {
                rendererType: Views.ComponentMarkupRenderBase
            },
            "datebox": {
                rendererType: Views.DateboxMarkupRender,
                events: ["onChange"]
            },
            "box": {
                rendererType: Views.BoxMarkupRender,
                defaults: { visible: true }
            },
            "container": {
                rendererType: Views.ContainerMarkupRender,
                defaults: {
                    visible: true,
                    style: {
                        verticalAlign: "top"
                    }
                },
                mapping: {
                    style: "container.model.container.containerStyle",
                    customControl: {
                        visible: "container.model.visible"
                    },
                    customStyle: {
                        verticalAlign: "container.model.container.contentStyle.verticalAlign",
                        maxWidth: "container.model.container.contentStyle.maxWidth",
                        horizontalAlign: "container.model.container.containerStyle.textAlign"
                    }
                }
            },
            "list": {
                rendererType: Views.ListMarkupRender,
                defaults: {
                    scrollable: true
                },
                events: ["onItemClick", "onItemHold"],
                mapping: {
                    style: "list.model.style"
                },
                componentViewModel: function (viewModel) {
                    $.extend(viewModel, viewModel.editConfig);
                    delete (viewModel.editConfig);
                    return viewModel;
                }
            },
            "lookup": {
                rendererType: Views.ComponentMarkupRenderBase,
                mapping: {
                    customControl: {
                        valueExpression: "valueExpr",
                        displayExpression: "displayExpr"
                    }
                },
                componentViewModel: function (viewModel) {
                    var value = viewModel.value ? ko.unwrap(viewModel.value) : undefined, valueString = JSON.stringify(value), valueGetter = viewModel.valueExpression ?
                        DevExpress.data.utils.compileGetter(ko.unwrap(viewModel.valueExpression)) :
                        function (value) { return value; };
                    viewModel = AppPlayer.remap(viewModel, Views.componentInfos["lookup"].mapping.customControl, true);
                    if (viewModel && ko.unwrap(viewModel.items)) {
                        if ($.isArray(ko.unwrap(viewModel.items))) {
                            ko.unwrap(viewModel.items).forEach(function (item) {
                                if (JSON.stringify(value) === JSON.stringify(valueGetter(item))) {
                                    viewModel.value(valueGetter(item));
                                }
                            });
                        }
                    }
                    return viewModel;
                }
            },
            "tabpanel": {
                rendererType: Views.TabsMarkupRender,
                mapping: {
                    control: "control.model.tabpanel",
                    style: "control.model.style",
                    customStyle: {
                        height: "control.model.tabpanel.height"
                    }
                },
                defaults: {
                    style: {}
                }
            },
            "accordion": {
                rendererType: Views.AccordionMarkupRender,
                mapping: {
                    control: "control.model.options",
                    style: "control.model.style"
                }
            },
            "datagrid": {
                rendererType: Views.ComponentMarkupRenderBase,
                events: ["onRowClick"],
                componentViewModel: function (viewModel) {
                    var dataSource = ko.unwrap(viewModel.dataSource);
                    if (dataSource && dataSource["_calculatedFields"]) {
                        var calculatedFields = dataSource["_calculatedFields"];
                        viewModel.onRowUpdating = function (rowInfo) {
                            var newData = rowInfo.newData;
                            $.each(newData, function (name, value) {
                                if (AppPlayer.findInArray(calculatedFields, function (m) { return m.name === name; })) {
                                    delete newData[name];
                                }
                            });
                        };
                    }
                    return viewModel;
                }
            },
            "row": {
                rendererType: Views.RowMarkupRender,
                defaults: { visible: true },
                mapping: {
                    style: "row.model.style"
                }
            },
            "column": {
                rendererType: Views.ComponentMarkupRenderBase
            },
            "fieldset": {
                rendererType: Views.FieldsetMarkupRender,
                mapping: {
                    style: "fieldset.model.style"
                }
            },
            "command": {
                rendererType: Views.CommandMarkupRender,
                defaults: { visible: true, disabled: false, buttonType: "normal" },
                events: ["onExecute"]
            },
            "scrollview": {
                rendererType: Views.ScrollViewMarkupRender,
                mapping: {
                    style: "scrollview.model.style"
                }
            }
        };
    })(Views = AppPlayer.Views || (AppPlayer.Views = {}));
})(AppPlayer || (AppPlayer = {}));
/// <reference path="views/componentsinfo.ts" />
var AppPlayer;
(function (AppPlayer) {
    var Views;
    (function (Views) {
        "use strict";
        var dxdata = DevExpress.data;
        var ViewModel = (function () {
            function ViewModel(viewConfig, application, originalParams) {
                var _this = this;
                this.events = {};
                this.alreadyShown = false;
                this.currentParams = originalParams;
                this.model = AppPlayer.Model.createModel(viewConfig, application);
                this.viewConfig = viewConfig;
                this.patchEvents(application);
                this.model["_functions"] = application.functions;
                this.model["_global"] = application.model;
                this.model["_scrollViewResetter"] = { reset: function () { } };
                if ((viewConfig.model || []).filter(function (item) { return item.name === "title"; }).length === 0) {
                    this.model["title"] = ko.pureComputed(function () {
                        return AppPlayer.getModelValue(viewConfig.title || "", { $global: application.model, $model: _this.model }, { callerId: "title", callerType: "View model" });
                    });
                }
                var _parametersAreReady = ko.observable(false);
                this.model.isReady = ko.observable(false);
                this.model["viewShowing"] = function (config) {
                    if (!_this.alreadyShown || viewConfig.refreshWhenShown) {
                        _this.currentParams = config.params || {};
                        _this.setModelValueFromParameter(application, _parametersAreReady);
                    }
                    var popup = ((config.viewInfo || {}).layoutController || {})._popup;
                    if (popup) {
                        ["height", "width"].forEach(function (property) {
                            if (viewConfig[property]) {
                                popup.option(property, viewConfig[property]);
                                if (popup.option("fullScreen")) {
                                    popup.option("fullScreen", false);
                                }
                            }
                        });
                    }
                };
                this.model["viewShown"] = function () {
                    if (!_this.alreadyShown) {
                        ko.computed(function () {
                            _this.model.isReady(ko.unwrap(_parametersAreReady));
                        });
                        AppPlayer.Model.initializeDataSources(_this.model, { $model: _this.model, $global: application.model }, application, application.stores, false, viewConfig.dataSources);
                        _this.alreadyShown = true;
                    }
                    else if (viewConfig.refreshWhenShown) {
                        AppPlayer.Model.initializeDataSources(_this.model, { $model: _this.model, $global: application.model }, application, application.stores, true, viewConfig.dataSources);
                        _this.model["_scrollViewResetter"].reset();
                    }
                    if (!_this.refreshStrategies) {
                        _this.refreshStrategies = _this.createRefreshStrategies(application, _this.currentParams);
                    }
                    else {
                        _this.refreshStrategies.forEach(function (strategy) {
                            strategy.enabled = true;
                            strategy.refresh();
                        });
                    }
                    _this.onEvent("onShow", _this.currentParams && _this.currentParams.parameters);
                };
                this.model["viewHidden"] = function () {
                    if (viewConfig.refreshWhenShown) {
                        _parametersAreReady(false);
                        _this.clearModel(application);
                    }
                    _this.refreshStrategies.forEach(function (strategy) {
                        strategy.hidden();
                    });
                    _this.onEvent("onHide", _this.currentParams && _this.currentParams.parameters);
                };
                this.model["viewDisposing"] = function () {
                    _this.refreshStrategies.forEach(function (strategy) {
                        strategy.dispose();
                    });
                    _this.refreshStrategies.splice(0, _this.refreshStrategies.length);
                    _this.onEvent("onDispose", _this.currentParams && _this.currentParams.parameters);
                };
                this.onEvent("onLoad", this.currentParams && this.currentParams.parameters);
            }
            ViewModel.optional = function (param) {
                return param.defaultValue !== void 0;
            };
            ViewModel.prototype.clearModel = function (application) {
                var _this = this;
                var emptyModel = AppPlayer.Model.createModel(this.viewConfig, application);
                this.viewConfig.model
                    .filter(function (propertyConfig) { return propertyConfig.getter == null; })
                    .forEach(function (propertyConfig) {
                    var propertyName = propertyConfig.name;
                    _this.model[propertyName] = emptyModel[propertyName];
                });
            };
            ViewModel.prototype.patchEvents = function (application) {
                var _this = this;
                var componentInfo = Views.componentInfos["view"];
                componentInfo.events.forEach(function (eventName) {
                    var event = _this.viewConfig[eventName], functionCompiler;
                    if (!event || !application.createFunctionCompiler) {
                        return;
                    }
                    functionCompiler = application.createFunctionCompiler(event);
                    _this.events[eventName] = function (e) {
                        return functionCompiler.run({
                            $global: application.model,
                            $model: _this.model,
                            $data: e
                        }, {
                            callerType: "view event",
                            callerId: eventName
                        });
                    };
                });
            };
            ViewModel.prototype.onEvent = function (eventName, params) {
                var handler = this.events[eventName];
                if (handler) {
                    handler(params);
                }
            };
            ViewModel.prototype.createRefreshStrategies = function (application, viewParameters) {
                var _this = this;
                var refreshStrategies = [];
                $.each(this.model, function (index, value) {
                    if (!(value instanceof dxdata.DataSource)) {
                        return;
                    }
                    var ds = value, refreshStrategy = SourceRefreshStrategy.create(ds);
                    if (refreshStrategy) {
                        refreshStrategies.push(refreshStrategy);
                    }
                    if (ds["_monitor"] && ds["_monitor"].stores && ds["_monitor"].stores.length > 0) {
                        refreshStrategies.push(new MonitorRefreshStrategy(ds, application, ds["_monitor"].stores));
                    }
                });
                if (this.viewConfig.params) {
                    this.viewConfig.params.forEach(function (parameter) {
                        var typeInfo = application.typeInfoRepository.get(parameter.type);
                        if (typeInfo && typeInfo.kind === AppPlayer.TYPES.STORE_TYPE) {
                            var refreshStrategy = ParameterRefreshStrategy.create(parameter, _this.model, application, viewParameters);
                            if (refreshStrategy) {
                                refreshStrategies.push(refreshStrategy);
                            }
                        }
                    });
                }
                return refreshStrategies;
            };
            ViewModel.prototype.setModelValueFromParameter = function (application, isReady) {
                var _this = this;
                var parametersLoadingCount = 0;
                if (this.viewConfig.params) {
                    this.viewConfig.params.forEach(function (parameter) {
                        var typeInfo = application.typeInfoRepository.get(parameter.type), objectKey;
                        if (parameter.shared) {
                            if (typeof application.sharedObjects[parameter.name] === "undefined") {
                                console.error("Shared parameter '" + parameter.name + "' is missing from the sharedObjects collection.");
                            }
                            _this.model[parameter.name] = application.sharedObjects[parameter.name];
                            delete application.sharedObjects[parameter.name];
                        }
                        else if (typeInfo && typeInfo.kind === AppPlayer.TYPES.STORE_TYPE) {
                            objectKey = _this.currentParams.parameters ? _this.currentParams.parameters[parameter.name] : undefined;
                            if (objectKey) {
                                var store = application.stores[parameter.type];
                                parametersLoadingCount++;
                                store.byKey(objectKey, { expand: parameter.expand })
                                    .then(function (data) { _this.model[parameter.name] = data; }, function () { application.processParameterLoadingError(parameter.name, objectKey); })
                                    .always(function () {
                                    parametersLoadingCount--;
                                    isReady(!parametersLoadingCount);
                                });
                            }
                            else {
                                _this.model[parameter.name] = parameter.defaultValue;
                            }
                        }
                        else {
                            _this.model[parameter.name] = (_this.currentParams.parameters && _this.currentParams.parameters[parameter.name]) || parameter.defaultValue;
                        }
                    });
                }
                isReady(parametersLoadingCount === 0);
            };
            return ViewModel;
        }());
        Views.ViewModel = ViewModel;
        var SourceRefreshStrategy = (function () {
            function SourceRefreshStrategy(ds) {
                this.ds = ds;
                this.enabled = true;
            }
            SourceRefreshStrategy.create = function (ds) {
                switch (ds["_refreshOnViewShown"]) {
                    case "never":
                        return null;
                    case "always":
                        return new SourceRefreshStrategy(ds);
                    case "whenChanges":
                    default:
                        return new WhenChangesSourceRefreshStrategy(ds);
                }
            };
            SourceRefreshStrategy.prototype.refresh = function () {
                this.ds.load();
            };
            SourceRefreshStrategy.prototype.dispose = function () { };
            SourceRefreshStrategy.prototype.hidden = function () {
                this.enabled = false;
            };
            return SourceRefreshStrategy;
        }());
        var WhenChangesSourceRefreshStrategy = (function (_super) {
            __extends(WhenChangesSourceRefreshStrategy, _super);
            function WhenChangesSourceRefreshStrategy(ds) {
                var _this = this;
                _super.call(this, ds);
                this.ds = ds;
                this.callback = function () {
                    _this.modified = true;
                    if (_this.enabled) {
                        _this.refresh();
                    }
                };
                this.ds.store().on("modified", this.callback);
            }
            WhenChangesSourceRefreshStrategy.prototype.refresh = function () {
                if (this.modified) {
                    this.modified = false;
                    _super.prototype.refresh.call(this);
                }
            };
            WhenChangesSourceRefreshStrategy.prototype.dispose = function () {
                this.ds.store().off("modified", this.callback);
            };
            return WhenChangesSourceRefreshStrategy;
        }(SourceRefreshStrategy));
        var ParameterRefreshStrategy = (function () {
            function ParameterRefreshStrategy(param, model, application, viewParameters) {
                this.enabled = true;
                this.param = param;
                this.model = model;
                this.application = application;
                this.store = application.stores[param.type];
            }
            ParameterRefreshStrategy.create = function (param, model, application, viewParameters) {
                switch (param.refreshOnViewShown) {
                    case "never":
                        return null;
                    case "always":
                        return new ParameterRefreshStrategy(param, model, application, viewParameters);
                    case "whenChanges":
                    default:
                        return new WhenChangesParameterRefreshStrategy(param, model, application, viewParameters);
                }
            };
            ParameterRefreshStrategy.prototype.refresh = function () {
                var _this = this;
                var key = this.store.keyOf(this.model[this.param.name]);
                if (key) {
                    this.store.byKey(key, { expand: this.param.expand }).done(function (data) {
                        _this.model[_this.param.name] = data;
                    });
                }
            };
            ParameterRefreshStrategy.prototype.dispose = function () { };
            ParameterRefreshStrategy.prototype.hidden = function () {
                this.enabled = false;
            };
            return ParameterRefreshStrategy;
        }());
        var WhenChangesParameterRefreshStrategy = (function (_super) {
            __extends(WhenChangesParameterRefreshStrategy, _super);
            function WhenChangesParameterRefreshStrategy(param, model, application, viewParameters) {
                var _this = this;
                _super.call(this, param, model, application, viewParameters);
                this.modified = false;
                this.removed = false;
                this.viewCacheKey = application.viewCacheKey && application.viewCacheKey();
                var objectKey = viewParameters.parameters ? viewParameters.parameters[param.name] : undefined;
                this.insertedCallback = function (values, key) {
                    if (key === objectKey) {
                        _this.modified = true;
                        if (_this.enabled) {
                            _this.refresh();
                        }
                    }
                };
                this.store.on("inserted", this.insertedCallback);
                this.updatedCallback = function (key, values) {
                    if (!_this.enabled && (objectKey === undefined || key === objectKey)) {
                        _this.modified = true;
                        if (_this.enabled) {
                            _this.refresh();
                        }
                    }
                };
                this.store.on("updated", this.updatedCallback);
                this.removedCallback = function (key) {
                    if (objectKey === undefined || key === objectKey) {
                        _this.removed = true;
                        if (!_this.enabled) {
                            _this.removeViewCache();
                        }
                    }
                };
                this.store.on("removed", this.removedCallback);
            }
            WhenChangesParameterRefreshStrategy.prototype.refresh = function () {
                if (this.modified) {
                    this.modified = false;
                    _super.prototype.refresh.call(this);
                }
            };
            WhenChangesParameterRefreshStrategy.prototype.dispose = function () {
                this.store.off("inserted", this.insertedCallback);
                this.store.off("updated", this.updatedCallback);
                this.store.off("removed", this.removedCallback);
            };
            WhenChangesParameterRefreshStrategy.prototype.hidden = function () {
                _super.prototype.hidden.call(this);
                if (this.removed) {
                    this.removeViewCache();
                }
            };
            WhenChangesParameterRefreshStrategy.prototype.removeViewCache = function () {
                if (this.application.removeViewCache && this.viewCacheKey !== void 0) {
                    this.application.removeViewCache(this.viewCacheKey);
                }
            };
            return WhenChangesParameterRefreshStrategy;
        }(ParameterRefreshStrategy));
        var MonitorRefreshStrategy = (function () {
            function MonitorRefreshStrategy(ds, application, storeIds) {
                var _this = this;
                this.ds = ds;
                this.application = application;
                this.storeIds = storeIds;
                this.enabled = true;
                this.modified = false;
                this.refreshFunc = function () {
                    _this.modified = true;
                    _this.refresh();
                };
                this.storeIds.forEach(function (storeId) {
                    var store = _this.application.stores[storeId];
                    store.on("modified", _this.refreshFunc);
                });
            }
            MonitorRefreshStrategy.prototype.refresh = function () {
                if (this.enabled) {
                    this.ds.load();
                    this.modified = false;
                }
            };
            MonitorRefreshStrategy.prototype.dispose = function () {
                var _this = this;
                this.storeIds.forEach(function (storeId) {
                    var store = _this.application.stores[storeId];
                    store.off("modified", _this.refreshFunc);
                });
            };
            MonitorRefreshStrategy.prototype.hidden = function () {
                this.enabled = false;
            };
            return MonitorRefreshStrategy;
        }());
    })(Views = AppPlayer.Views || (AppPlayer.Views = {}));
})(AppPlayer || (AppPlayer = {}));
var AppPlayer;
(function (AppPlayer) {
    var Logic;
    (function (Logic) {
        "use strict";
        var dxdialog = DevExpress.ui.dialog;
        (function (Flow) {
            Flow[Flow["Return"] = 0] = "Return";
            Flow[Flow["Break"] = 1] = "Break";
            Flow[Flow["Continue"] = 2] = "Continue";
        })(Logic.Flow || (Logic.Flow = {}));
        var Flow = Logic.Flow;
        var Result = (function () {
            function Result() {
            }
            return Result;
        }());
        Logic.Result = Result;
        var Operation = (function () {
            function Operation() {
            }
            Operation.eval = function (expr, context) {
                var varNames = [], varValues = [];
                $.each(context, function (name, value) {
                    varNames.push(name);
                    varValues.push(value);
                });
                varNames.push("return (" + expr + ")");
                var fn = Function.apply(null, varNames);
                return fn.apply(null, varValues);
            };
            Operation.run = function (calls, variables, functions) {
                if (!calls || calls.length === 0) {
                    return Logic.trivialPromise();
                }
                var callIndex = 0, thenHandler = function (result) {
                    if ((callIndex === calls.length - 1) || (result && result.flow in Flow)) {
                        return Logic.trivialPromise(result);
                    }
                    callIndex++;
                    return calls[callIndex].run(variables, functions)
                        .then(thenHandler);
                };
                return calls[callIndex]
                    .run(variables, functions)
                    .then(thenHandler);
            };
            //caption: string;  // TODO: Ivan
            //autoGenerateCaption: boolean; // TODO: Ivan
            Operation.prototype.run = function (variables, functions) {
                throw Error("Not implemented");
            };
            Operation.prototype.eval = function (expr, variables, functions) {
                var varNames = [], varValues = [];
                $.each(variables, function (name, variable) {
                    varNames.push(variable.name);
                    varValues.push(variable.value);
                });
                if (!functions) {
                    varNames.push("return (" + expr + ")");
                }
                else {
                    varNames.push("$functions");
                    varValues.push(functions);
                    varNames.push("with($functions) { return (" + expr + "); }");
                }
                var fn = Function.apply(null, varNames);
                return fn.apply(null, varValues);
            };
            Operation.fromJson = function (json) {
                if (json instanceof Operation) {
                    return json;
                }
                else {
                    var result = Operation.create(json._type);
                    Operation.restoreProperties(json, result);
                    return result;
                }
            };
            Operation.create = function (type) {
                return new AppPlayer.Logic[type]();
            };
            Operation.restoreProperties = function (json, result) {
                $.each(json, function (name, value) {
                    if (name === "_type") {
                        return;
                    }
                    if (Array.isArray(value)) {
                        result[name] = value.map(function (element) {
                            if (typeof element === "object" && element && element._type) {
                                return Operation.fromJson(element);
                            }
                            else {
                                return Operation.restoreProperties(element, Array.isArray(element) ? [] : {});
                            }
                        });
                    }
                    else if (value && typeof value === "object") {
                        if (value && value._type) {
                            result[name] = Operation.fromJson(value);
                        }
                        else {
                            result[name] = Operation.restoreProperties(value, {});
                        }
                    }
                    else {
                        result[name] = value;
                    }
                });
                return result;
            };
            return Operation;
        }());
        Logic.Operation = Operation;
        var Event = (function (_super) {
            __extends(Event, _super);
            function Event(flow, returnValue) {
                _super.call(this);
                this.returnValue = null;
                this.returnExpr = "";
                if (flow in Flow) {
                    this.flow = flow;
                    this.returnValue = returnValue;
                }
                else if (flow) {
                    var param = flow;
                    if (typeof param.flow !== "undefined") {
                        this.flow = param.flow;
                    }
                    if (typeof param.returnValue !== "undefined") {
                        this.returnValue = param.returnValue;
                    }
                    if (typeof param.returnExpr !== "undefined") {
                        this.returnExpr = param.returnExpr;
                    }
                }
            }
            Event.prototype.run = function (variables, functions) {
                var result = {
                    flow: this.flow,
                    value: undefined
                };
                if (this.flow === Flow.Return) {
                    if (this.returnExpr) {
                        result.value = this.eval(this.returnExpr, variables, functions);
                    }
                    else {
                        result.value = this.returnValue;
                    }
                }
                return Logic.trivialPromise(result);
            };
            return Event;
        }(Operation));
        Logic.Event = Event;
        var SetValue = (function (_super) {
            __extends(SetValue, _super);
            function SetValue(params) {
                var _this = this;
                _super.call(this);
                this.valueExpr = "";
                this.leftExpr = "";
                if (params) {
                    $.each(params, function (name, value) {
                        _this[name] = value || _this[name];
                    });
                }
            }
            SetValue.prototype.run = function (variables, functions) {
                var pathExpr;
                if (this.leftExpr) {
                    pathExpr = this.leftExpr;
                }
                else {
                    if (this.variableName) {
                        console.warn("SetValue: variableName and pathExpr are obsolete. Use leftExpr instead");
                        pathExpr = this.pathExpr ? this.variableName + "." + this.eval(this.pathExpr, variables, functions) : this.variableName;
                    }
                    else {
                        return Logic.rejectPromise("SetValue: leftExpr must be defined");
                    }
                }
                if (this.valueExpr === "") {
                    return Logic.rejectPromise("SetValue: valueExpr must be defined");
                }
                var value = this.eval(this.valueExpr, variables, functions), path = this.prepareExpr(pathExpr, variables, functions);
                this.assignValue(path, variables, value);
                return Logic.trivialPromise();
            };
            SetValue.prototype.prepareExpr = function (expr, variables, functions) {
                var bracketIndex = expr.indexOf("["), closeBracketIndex, result = bracketIndex > 0 ? expr.substr(0, bracketIndex) : expr, bracketContents;
                while (bracketIndex > 0) {
                    closeBracketIndex = expr.indexOf("]", bracketIndex);
                    bracketContents = expr.substring(bracketIndex + 1, closeBracketIndex).trim();
                    result += "." + this.eval(bracketContents, variables, functions);
                    bracketIndex = expr.indexOf("[", closeBracketIndex);
                    result += expr.substring(closeBracketIndex + 1, bracketIndex > 0 ? bracketIndex : undefined);
                }
                return result;
            };
            SetValue.prototype.assignValue = function (path, variables, value) {
                if (variables[path]) {
                    variables[path].value = value;
                }
                else {
                    var dotIndex = path.indexOf(".");
                    var variableName = path.substring(0, dotIndex);
                    path = path.substr(dotIndex + 1);
                    if (path !== this.path) {
                        this.setter = AppPlayer.compileSetter(path);
                        this.path = path;
                    }
                    this.setter(variables[variableName].value, value);
                }
            };
            return SetValue;
        }(Operation));
        Logic.SetValue = SetValue;
        var Create = (function (_super) {
            __extends(Create, _super);
            function Create(params) {
                _super.call(this);
                this.variableName = "";
                this.storeExpr = "";
                this.storeId = "";
                if (params) {
                    this.variableName = params.variableName;
                    this.storeId = params.storeId;
                }
            }
            Create.prototype.run = function (variables, functions) {
                var storeId = !!this.storeExpr ? this.eval(this.storeExpr, variables, functions) : this.storeId, dataStoreConfig = functions.getDataStoreConfig(storeId), result = {};
                if (dataStoreConfig.fields) {
                    dataStoreConfig.fields.forEach(function (field) {
                        result[field.name] = undefined;
                    });
                }
                variables[this.variableName] = new Logic.Variable({ name: this.variableName, value: result });
                return Logic.trivialPromise();
            };
            return Create;
        }(Operation));
        Logic.Create = Create;
        var AddToList = (function (_super) {
            __extends(AddToList, _super);
            function AddToList(params) {
                _super.call(this);
                this.variableName = "";
                this.value = null;
                this.expression = "";
                if (params) {
                    this.variableName = params.variableName;
                    if (params.expr) {
                        this.expression = params.expr;
                    }
                    else {
                        this.value = params.value;
                    }
                }
            }
            AddToList.prototype.run = function (variables, functions) {
                var list = variables[this.variableName].value, value = this.expression ? this.eval(this.expression, variables, functions) : this.value;
                list.push(value);
                return Logic.trivialPromise();
            };
            return AddToList;
        }(Operation));
        Logic.AddToList = AddToList;
        var InsertToList = (function (_super) {
            __extends(InsertToList, _super);
            function InsertToList(params) {
                _super.call(this);
                this.variableName = "";
                this.valueExpr = "";
                this.indexExpr = "";
                $.extend(this, params);
            }
            InsertToList.prototype.run = function (variables, functions) {
                if (!this.variableName) {
                    return Logic.rejectPromise("InsertToList: invalid variable name");
                }
                if (!this.valueExpr) {
                    return Logic.rejectPromise("InsertToList: invalid value expression");
                }
                var list = variables[this.variableName].value;
                if (!$.isArray(list)) {
                    return Logic.rejectPromise("InsertToList: variable should be array");
                }
                var value = this.eval(this.valueExpr, variables, functions), index = this.indexExpr ? this.eval(this.indexExpr, variables, functions) : undefined;
                if (index >= 0) {
                    list.splice(index, 0, value);
                    return Logic.trivialPromise();
                }
                else if (index === undefined) {
                    list.push(value);
                    return Logic.trivialPromise();
                }
                else {
                    return Logic.rejectPromise("InsertToList: index should be 0 or greater than 0");
                }
            };
            return InsertToList;
        }(Operation));
        Logic.InsertToList = InsertToList;
        var RemoveFromListByValue = (function (_super) {
            __extends(RemoveFromListByValue, _super);
            function RemoveFromListByValue(params) {
                var _this = this;
                _super.call(this);
                this.variableName = "";
                this.valueExpr = "";
                if (params) {
                    $.each(params, function (name, value) {
                        _this[name] = value;
                    });
                }
            }
            RemoveFromListByValue.prototype.run = function (variables, functions) {
                var variable = variables[this.variableName], list = variable.value, value, index;
                if (this.valueExpr) {
                    value = this.eval(this.valueExpr, variables, functions);
                }
                index = list.indexOf(value);
                if (index >= 0) {
                    list.splice(index, 1);
                }
                return Logic.trivialPromise();
            };
            return RemoveFromListByValue;
        }(Operation));
        Logic.RemoveFromListByValue = RemoveFromListByValue;
        var RemoveFromListByIndex = (function (_super) {
            __extends(RemoveFromListByIndex, _super);
            function RemoveFromListByIndex(params) {
                var _this = this;
                _super.call(this);
                this.variableName = "";
                this.index = -1;
                if (params) {
                    $.each(params, function (name, value) {
                        _this[name] = value;
                    });
                }
            }
            RemoveFromListByIndex.prototype.run = function (variables, functions) {
                var variable = variables[this.variableName], list = variable.value, index = this.index;
                if (index >= 0) {
                    list.splice(this.index, 1);
                    return Logic.trivialPromise();
                }
                else {
                    return Logic.rejectPromise("RemoveFromListByIndex: index should be 0 or greater than 0");
                }
            };
            return RemoveFromListByIndex;
        }(Operation));
        Logic.RemoveFromListByIndex = RemoveFromListByIndex;
        var CountList = (function (_super) {
            __extends(CountList, _super);
            function CountList(params) {
                _super.call(this);
                this.expr = "";
                this.resultVariableName = "";
                if (params) {
                    this.expr = params.expr;
                    this.resultVariableName = params.resultVariableName;
                }
            }
            CountList.prototype.run = function (variables, functions) {
                var list = this.eval(this.expr, variables, functions), len = Array.isArray(list) ? list.length : Object.keys(list).length;
                variables[this.resultVariableName].value = len;
                return Logic.trivialPromise();
            };
            return CountList;
        }(Operation));
        Logic.CountList = CountList;
        (function (AggregateType) {
            AggregateType[AggregateType["Min"] = 0] = "Min";
            AggregateType[AggregateType["Max"] = 1] = "Max";
            AggregateType[AggregateType["Sum"] = 2] = "Sum";
            AggregateType[AggregateType["Average"] = 3] = "Average";
        })(Logic.AggregateType || (Logic.AggregateType = {}));
        var AggregateType = Logic.AggregateType;
        var AggregateList = (function (_super) {
            __extends(AggregateList, _super);
            function AggregateList(params) {
                var _this = this;
                _super.call(this);
                this.type = AggregateType.Sum;
                this.variableName = "";
                this.resultVariableName = "";
                this.propertyName = "";
                this.seed = 0;
                if (params) {
                    $.each(params, function (name, value) {
                        _this[name] = value;
                    });
                }
            }
            AggregateList.prototype.run = function (variables, functions) {
                var _this = this;
                var aggregator, resultSelector, valueSelector = function (item) { return _this.propertyName ? item[_this.propertyName] : item; }, accumulator, list = variables[this.variableName].value;
                if (typeof variables[this.resultVariableName] === "undefined") {
                    return Logic.rejectPromise("AggregateList: invalid resultVariableName");
                }
                if (list.length === 0) {
                    variables[this.resultVariableName].value = null;
                    return Logic.trivialPromise();
                }
                switch (this.type) {
                    case AggregateType.Min:
                        aggregator = function (accumulator, value) { return value < accumulator ? value : accumulator; };
                        resultSelector = function (accumulator, list) { return accumulator; };
                        break;
                    case AggregateType.Max:
                        aggregator = function (accumulator, value) { return value > accumulator ? value : accumulator; };
                        resultSelector = function (accumulator, list) { return accumulator; };
                        break;
                    case AggregateType.Sum:
                        aggregator = function (accumulator, value) { return accumulator + value; };
                        resultSelector = function (accumulator, list) { return accumulator; };
                        break;
                    case AggregateType.Average:
                        aggregator = function (accumulator, value) { return accumulator + value; };
                        resultSelector = function (accumulator, list) { return accumulator / list.length; };
                        break;
                    default:
                        return Logic.rejectPromise("AggregateList: invalid aggregate function");
                }
                accumulator = this.seed;
                list.forEach(function (item) {
                    accumulator = aggregator(accumulator, valueSelector(item));
                });
                variables[this.resultVariableName].value = resultSelector(accumulator, list);
                return Logic.trivialPromise();
            };
            return AggregateList;
        }(Operation));
        Logic.AggregateList = AggregateList;
        var SortList = (function (_super) {
            __extends(SortList, _super);
            function SortList(params) {
                var _this = this;
                _super.call(this);
                this.variableName = "";
                this.desc = false;
                this.propertyName = "";
                if (params) {
                    $.each(params, function (name, val) { return _this[name] = val; });
                }
            }
            SortList.prototype.run = function (variables, functions) {
                var _this = this;
                var list = variables[this.variableName].value, compare;
                if (!this.propertyName) {
                    if (this.desc) {
                        compare = function (a, b) { return b - a; };
                    }
                }
                else {
                    if (this.desc) {
                        compare = function (a, b) { return b[_this.propertyName] - a[_this.propertyName]; };
                    }
                    else {
                        compare = function (a, b) { return a[_this.propertyName] - b[_this.propertyName]; };
                    }
                }
                list.sort(compare);
                return Logic.trivialPromise();
            };
            return SortList;
        }(Operation));
        Logic.SortList = SortList;
        var Loop = (function (_super) {
            __extends(Loop, _super);
            function Loop(params) {
                var _this = this;
                _super.call(this);
                this.valueExpr = "";
                this.indexName = "loopIndex";
                this.valueName = "loopValue";
                this.calls = [];
                if (params) {
                    $.each(params, function (name, value) {
                        if (value !== undefined) {
                            _this[name] = value;
                        }
                    });
                }
            }
            Loop.prototype.run = function (variables, functions) {
                var _this = this;
                var value = this.eval(this.valueExpr, variables, functions);
                if (typeof value !== "object") {
                    return Logic.rejectPromise("Loop: passed value should be array or object");
                }
                var isArray = Array.isArray(value), objectKeys = isArray ? null : Object.keys(value), index = 0, length = isArray ? value.length : objectKeys.length;
                if (length === 0) {
                    return Logic.trivialPromise();
                }
                var localVars = {};
                $.each(variables, function (name, variable) {
                    localVars[name] = variable;
                });
                var indexVar = localVars[this.indexName] = new Logic.Variable({ name: this.indexName, value: undefined }), valueVar = localVars[this.valueName] = new Logic.Variable({ name: this.valueName, value: undefined }), d = $.Deferred(), loopFn = function () {
                    if (index === length) {
                        d.resolve();
                        return;
                    }
                    indexVar.value = isArray ? index : objectKeys[index];
                    valueVar.value = value[indexVar.value];
                    Operation.run(_this.calls, localVars, functions)
                        .then(function (result) {
                        if (result !== undefined) {
                            if (result.flow === Flow.Break) {
                                d.resolve();
                                return;
                            }
                            else if (result.flow === Flow.Return) {
                                d.resolve(result);
                                return;
                            }
                        }
                        index++;
                        loopFn();
                    });
                };
                loopFn();
                return d.promise();
            };
            return Loop;
        }(Operation));
        Logic.Loop = Loop;
        var defaultForLoopParameters = {
            indexName: "loopIndex",
            startIndexIncluded: 0,
            endIndexExcluded: 0,
            calls: []
        };
        var ForLoop = (function (_super) {
            __extends(ForLoop, _super);
            function ForLoop(params) {
                _super.call(this);
                $.extend(this, defaultForLoopParameters, params);
            }
            ForLoop.prototype.run = function (variables, functions) {
                var _this = this;
                var step = this.startIndexIncluded < this.endIndexExcluded ? 1 : -1, localVars = $.extend({}, variables);
                localVars[this.indexName] = localVars[this.indexName] || new Logic.Variable({ name: this.indexName, value: undefined });
                var d = $.Deferred(), complete = function () {
                    $.each(variables, function (name, val) {
                        variables[name] = localVars[name];
                    });
                    d.resolve();
                }, index = this.startIndexIncluded, loopFn = function () {
                    if (index === _this.endIndexExcluded) {
                        complete();
                        return;
                    }
                    localVars[_this.indexName].value = index;
                    Operation.run(_this.calls, localVars, functions)
                        .then(function (result) {
                        if (result !== undefined && result.flow === Flow.Break) {
                            complete();
                            return;
                        }
                        index += step;
                        loopFn();
                    });
                };
                loopFn();
                return d.promise();
            };
            return ForLoop;
        }(Operation));
        Logic.ForLoop = ForLoop;
        var SwitchCase = (function () {
            function SwitchCase() {
                this.calls = [];
            }
            return SwitchCase;
        }());
        Logic.SwitchCase = SwitchCase;
        var Switch = (function (_super) {
            __extends(Switch, _super);
            function Switch(param) {
                _super.call(this);
                this.expr = "";
                this.cases = [];
                this.otherwise = [];
                if (param) {
                    this.expr = param.expr || "";
                    this.cases = param.cases || [];
                    this.otherwise = param.otherwise || [];
                }
            }
            Switch.prototype.run = function (variables, functions) {
                var _this = this;
                var exprVal = this.eval(this.expr, variables, functions), d = null;
                this.cases.forEach(function (c) {
                    var caseVal = _this.eval(c.valueExpr, variables, functions);
                    if (caseVal === exprVal) {
                        d = Operation.run(c.calls, variables, functions);
                    }
                });
                return d || (this.otherwise.length ? Operation.run(this.otherwise, variables, functions) : Logic.trivialPromise());
            };
            return Switch;
        }(Operation));
        Logic.Switch = Switch;
        (function (RetrieveType) {
            RetrieveType[RetrieveType["First"] = 0] = "First";
            RetrieveType[RetrieveType["All"] = 1] = "All";
        })(Logic.RetrieveType || (Logic.RetrieveType = {}));
        var RetrieveType = Logic.RetrieveType;
        var RetrieveObject = (function (_super) {
            __extends(RetrieveObject, _super);
            // TODO: Ivan filters
            function RetrieveObject(param) {
                _super.call(this);
                this.type = RetrieveType.All;
                this.storeId = "";
                this.variableName = "";
                this.errorVariableName = "";
                if (param) {
                    this.type = param.type;
                    this.variableName = param.variableName;
                    this.storeId = param.storeId;
                }
            }
            RetrieveObject.prototype.run = function (variables, functions) {
                var _this = this;
                var d = $.Deferred(), errorHandler = function (error) {
                    if (_this.errorVariableName) {
                        variables[_this.errorVariableName].value = error;
                        d.resolve();
                    }
                    else {
                        d.reject("[RetrieveObject] " + error);
                    }
                };
                switch (this.type) {
                    case RetrieveType.All:
                        functions.load(this.storeId).then(function (values) {
                            variables[_this.variableName].value = values;
                            d.resolve();
                        }, errorHandler);
                        break;
                    case RetrieveType.First:
                    default:
                        functions.load(this.storeId, { take: 1 }).then(function (values) {
                            variables[_this.variableName].value = values && values.length > 0 ? values[0] : null;
                            d.resolve();
                        }, errorHandler);
                        break;
                }
                return d.promise();
            };
            return RetrieveObject;
        }(Operation));
        Logic.RetrieveObject = RetrieveObject;
        var ResetObject = (function (_super) {
            __extends(ResetObject, _super);
            function ResetObject(param) {
                _super.call(this);
                this.variableName = "";
                this.errorVariableName = "";
                this.properties = [];
                if (param) {
                    if (param.variableName) {
                        this.variableName = param.variableName;
                    }
                    if (param.properties) {
                        this.properties = param.properties;
                    }
                }
            }
            ResetObject.prototype.run = function (variables, functions) {
                var _this = this;
                var d = $.Deferred(), variable = variables[this.variableName], storeId = variable.type, key = functions.keyOf(storeId, variable);
                if (!key) {
                    return Logic.rejectPromise("ResetObject: object in '" + this.variableName + "' doesn't have a key. Probably, is has not been saved to a store.");
                }
                else {
                    return functions.byKey(storeId, key).then(function (dbObject) {
                        if (_this.properties && _this.properties.length > 0) {
                            _this.properties.forEach(function (propertyName) {
                                variable[propertyName] = dbObject[propertyName];
                            });
                        }
                        else {
                            variables[_this.variableName] = dbObject;
                        }
                        d.resolve();
                    }, function (error) {
                        if (_this.errorVariableName) {
                            variables[_this.errorVariableName].value = error;
                            d.resolve();
                        }
                        else {
                            d.reject("[ResetObject] " + error);
                        }
                    });
                }
            };
            return ResetObject;
        }(Operation));
        Logic.ResetObject = ResetObject;
        var CloneObject = (function (_super) {
            __extends(CloneObject, _super);
            function CloneObject(param) {
                _super.call(this);
                this.variableName = "";
                this.resultVariableName = "";
                if (param) {
                    $.extend(this, param);
                }
            }
            CloneObject.prototype.run = function (variables, functions) {
                var variable = variables[this.variableName], resultVariable = variables[this.resultVariableName], value = variable.value, target = Array.isArray(value) ? [] : {};
                resultVariable.value = $.extend(target, value);
                return Logic.trivialPromise();
            };
            return CloneObject;
        }(Operation));
        Logic.CloneObject = CloneObject;
        var NavigateToView = (function (_super) {
            __extends(NavigateToView, _super);
            function NavigateToView(params) {
                var _this = this;
                _super.call(this);
                this.viewId = "";
                this.viewIdExpr = "";
                this.viewParametersExpr = "";
                if (params) {
                    $.each(params, function (name, value) {
                        _this[name] = value;
                    });
                }
            }
            NavigateToView.prototype.run = function (variables, functions) {
                var _this = this;
                var viewId = this.viewIdExpr ? this.eval(this.viewIdExpr, variables, functions) : this.viewId, parameters = {};
                if (this.viewParameters) {
                    this.viewParameters.forEach(function (viewParameter) {
                        var value = _this.eval(viewParameter.valueExpr, variables, functions);
                        parameters[viewParameter.name] = value;
                    });
                }
                else if (this.viewParametersExpr) {
                    parameters = this.eval(this.viewParametersExpr, variables, functions);
                }
                functions.navigateToView(viewId, parameters, this.currentPane(variables));
                return Logic.trivialPromise();
            };
            NavigateToView.prototype.currentPane = function (variables) {
                var $model = variables["$model"];
                return $model && $model.value && $model.value.pane;
            };
            return NavigateToView;
        }(Operation));
        Logic.NavigateToView = NavigateToView;
        var Save = (function (_super) {
            __extends(Save, _super);
            function Save(param) {
                var _this = this;
                _super.call(this);
                this.objectExpr = "";
                this.storeId = "";
                this.keyExpr = "";
                this.errorVariableName = "";
                if (param) {
                    $.each(param, function (name, value) {
                        _this[name] = value;
                    });
                }
            }
            Save.prototype.run = function (variables, functions) {
                var _this = this;
                var d = $.Deferred(), object = this.eval(this.objectExpr, variables, functions), key = this.keyExpr ? this.eval(this.keyExpr, variables, functions) : undefined;
                functions.save(object, this.storeId, key).then(function (result) {
                    d.resolve(result);
                }, function (error) {
                    if (_this.errorVariableName) {
                        variables[_this.errorVariableName].value = error;
                        d.resolve();
                    }
                    else {
                        d.reject("[Save] " + error);
                    }
                });
                return d.promise();
            };
            return Save;
        }(Operation));
        Logic.Save = Save;
        var Insert = (function (_super) {
            __extends(Insert, _super);
            function Insert(param) {
                var _this = this;
                _super.call(this);
                this.objectExpr = "";
                this.storeId = "";
                this.storeExpr = "";
                this.errorVariableName = "";
                if (param) {
                    $.each(param, function (name, value) {
                        _this[name] = value;
                    });
                }
            }
            Insert.prototype.run = function (variables, functions) {
                var _this = this;
                var d = $.Deferred(), object = this.eval(this.objectExpr, variables, functions), storeId = !!this.storeExpr ? this.eval(this.storeExpr, variables, functions) : this.storeId;
                functions.insert(object, storeId).then(function (result) {
                    d.resolve(result);
                }, function (error) {
                    if (_this.errorVariableName) {
                        variables[_this.errorVariableName].value = error;
                        d.resolve();
                    }
                    else {
                        d.reject("[Insert] " + error);
                    }
                });
                return d.promise();
            };
            return Insert;
        }(Operation));
        Logic.Insert = Insert;
        var Refresh = (function (_super) {
            __extends(Refresh, _super);
            function Refresh(param) {
                var _this = this;
                _super.call(this);
                this.storeId = "";
                this.storeExpr = "";
                if (param) {
                    $.each(param, function (name, value) {
                        _this[name] = value;
                    });
                }
            }
            Refresh.prototype.run = function (variables, functions) {
                var storeId = !!this.storeExpr ? this.eval(this.storeExpr, variables, functions) : this.storeId;
                functions.refresh(storeId);
                return Logic.trivialPromise();
            };
            return Refresh;
        }(Operation));
        Logic.Refresh = Refresh;
        var SendRequest = (function (_super) {
            __extends(SendRequest, _super);
            function SendRequest(param) {
                var _this = this;
                _super.call(this);
                this.urlExpr = null;
                this.method = "get";
                this.dataExpr = null;
                this.variableName = null;
                this.errorVariableName = null;
                this.cacheResponse = false;
                this.headersExpr = null;
                this.timeout = null;
                this.options = null;
                if (param) {
                    $.each(param, function (name, value) {
                        _this[name] = value;
                    });
                }
            }
            SendRequest.prototype.run = function (variables, functions) {
                var _this = this;
                var d = $.Deferred(), filtered = SendRequest.methods.filter(function (pair) { return pair.name === _this.method || pair.value === _this.method; }), method = filtered.length ? filtered[0].value : "POST", data = this.dataExpr ? this.eval(this.dataExpr, variables, functions) : undefined, url, request, dataType = this["dataType"] || "json", headers = this.headersExpr ? headers = this.eval(this.headersExpr, variables, functions) : {};
                if (!this.urlExpr) {
                    return Logic.rejectPromise("SendRequest: no URL provided");
                }
                this.method = this.method || "";
                url = this.eval(this.urlExpr, variables, functions);
                var options = $.extend({}, {
                    url: url,
                    data: data,
                    type: method,
                    cache: this.cacheResponse,
                    headers: headers,
                    timeout: $.isNumeric(this.timeout) ? this.timeout : undefined
                }, this.options);
                if (dataType === "jsonp") {
                    options["dataType"] = dataType;
                }
                request = $.ajax(options);
                request = request.then(function (result) {
                    if (_this.variableName) {
                        variables[_this.variableName].value = result;
                    }
                    d.resolve();
                }, function (error) {
                    if (_this.errorVariableName) {
                        variables[_this.errorVariableName].value = error;
                        d.resolve();
                    }
                    else {
                        d.reject("SendRequest: " + JSON.stringify(error));
                    }
                });
                request.always(functions["available"]);
                functions["busy"]();
                return d.promise();
            };
            SendRequest.methods = [
                { name: "get", value: "GET" },
                { name: "post", value: "POST" },
                { name: "delete", value: "DELETE" },
                { name: "put", value: "PUT" },
                { name: "head", value: "HEAD" },
                { name: "options", value: "OPTIONS" },
                { name: "merge", value: "MERGE" },
                { name: "patch", value: "PATCH" }
            ];
            return SendRequest;
        }(Operation));
        Logic.SendRequest = SendRequest;
        var Delete = (function (_super) {
            __extends(Delete, _super);
            function Delete(param) {
                _super.call(this);
                this.objectOrKeyExpr = "";
                this.storeId = "";
                this.errorVariableName = "";
                if (param) {
                    this.objectOrKeyExpr = param.objectOrKeyExpr || "";
                    this.storeId = param.storeId || "";
                }
            }
            Delete.prototype.run = function (variables, functions) {
                var _this = this;
                var d = $.Deferred(), objectOrKey = this.eval(this.objectOrKeyExpr, variables, functions);
                functions.delete(objectOrKey, this.storeId).then(function (result) {
                    d.resolve(result);
                }, function (error) {
                    if (_this.errorVariableName) {
                        variables[_this.errorVariableName].value = error;
                        d.resolve();
                    }
                    else {
                        d.reject("[Delete] " + error);
                    }
                });
                return d.promise();
            };
            return Delete;
        }(Operation));
        Logic.Delete = Delete;
        var NavigateBack = (function (_super) {
            __extends(NavigateBack, _super);
            function NavigateBack() {
                _super.apply(this, arguments);
            }
            NavigateBack.prototype.run = function (variables, functions) {
                functions.back();
                return Logic.trivialPromise();
            };
            return NavigateBack;
        }(Operation));
        Logic.NavigateBack = NavigateBack;
        var ShowConfirmDialog = (function (_super) {
            __extends(ShowConfirmDialog, _super);
            function ShowConfirmDialog(param) {
                _super.call(this);
                this.yesNext = [];
                this.noNext = [];
                this.messageExpr = null;
                this.titleExpr = null;
                if (param) {
                    this.yesNext = param.yesNext;
                    this.noNext = param.noNext;
                    this.messageExpr = param.messageExpr;
                    this.titleExpr = param.titleExpr;
                }
            }
            ShowConfirmDialog.prototype.run = function (variables, functions) {
                var _this = this;
                var message = this.eval(this.messageExpr, variables, functions), title = this.eval(this.titleExpr, variables, functions);
                return dxdialog
                    .confirm(message, title)
                    .then(function (result) {
                    var next = result ? _this.yesNext : _this.noNext;
                    if (next && next.length > 0) {
                        return Operation.run(next, variables, functions);
                    }
                    return Logic.trivialPromise();
                });
            };
            return ShowConfirmDialog;
        }(Operation));
        Logic.ShowConfirmDialog = ShowConfirmDialog;
        var ShowAlert = (function (_super) {
            __extends(ShowAlert, _super);
            function ShowAlert(param) {
                _super.call(this);
                this.messageExpr = null;
                this.titleExpr = null;
                if (param) {
                    this.messageExpr = param.messageExpr;
                    this.titleExpr = param.titleExpr;
                }
            }
            ShowAlert.prototype.run = function (variables, functions) {
                var message = this.eval(this.messageExpr, variables, functions), title = this.eval(this.titleExpr, variables, functions);
                return dxdialog
                    .alert(message, title)
                    .then(function () {
                    return Logic.trivialPromise();
                });
            };
            return ShowAlert;
        }(Operation));
        Logic.ShowAlert = ShowAlert;
        var ShowWebPage = (function (_super) {
            __extends(ShowWebPage, _super);
            function ShowWebPage(param) {
                _super.call(this);
                this.urlExpr = null;
                this.sameWindow = false;
                if (param) {
                    this.urlExpr = param.urlExpr;
                }
            }
            ShowWebPage.prototype.run = function (variables, functions) {
                var url = this.eval(this.urlExpr, variables, functions);
                if (AppPlayer.LayoutHelper.getDeviceType() === "desktop") {
                    if (this.sameWindow) {
                        document.location.href = url;
                    }
                    else {
                        window.open(url, "_blank");
                    }
                }
                else {
                    window.open(url, "_system");
                }
                return Logic.trivialPromise();
            };
            return ShowWebPage;
        }(Operation));
        Logic.ShowWebPage = ShowWebPage;
        var GetDeviceType = (function (_super) {
            __extends(GetDeviceType, _super);
            function GetDeviceType(param) {
                _super.call(this);
                this.resultVariableName = "";
                if (param) {
                    this.resultVariableName = param.resultVariableName;
                }
            }
            GetDeviceType.prototype.run = function (variables, functions) {
                if (!variables[this.resultVariableName]) {
                    return Logic.rejectPromise("GetDeviceType: variable '" + this.resultVariableName + "' does not exist");
                }
                var deviceType = AppPlayer.LayoutHelper.getDeviceType();
                variables[this.resultVariableName].value = deviceType;
                return Logic.trivialPromise();
            };
            return GetDeviceType;
        }(Operation));
        Logic.GetDeviceType = GetDeviceType;
        var FormatDateTime = (function (_super) {
            __extends(FormatDateTime, _super);
            function FormatDateTime(params) {
                _super.call(this);
                this.variableName = "";
                this.format = "ddMMMM";
                this.resultVariableName = "";
                if (params) {
                    this.variableName = params.variableName;
                    this.format = params.format;
                    this.resultVariableName = params.resultVariableName;
                }
            }
            FormatDateTime.prototype.run = function (variables, functions) {
                if (!variables[this.resultVariableName]) {
                    return Logic.rejectPromise("FormatDateTime: variable '" + this.resultVariableName + "' does not exist");
                }
                var date = variables[this.variableName].value;
                variables[this.resultVariableName].value = Globalize.format(date, this.format);
                return Logic.trivialPromise();
            };
            FormatDateTime.formats = [
                "HH:mm:ss",
                "h:mm:ss",
                "yyyy-MM-dd",
                "MM/dd/yyyy",
                "dd.MM.yyyy",
                "yyyy-MM-dd HH:mm:ss",
                "dd.MM.yyyy HH:mm:ss",
                "MM/dd/yyyy h:mm:ss"
            ];
            return FormatDateTime;
        }(Operation));
        Logic.FormatDateTime = FormatDateTime;
        var ParseDateTime = (function (_super) {
            __extends(ParseDateTime, _super);
            function ParseDateTime(params) {
                _super.call(this);
                this.variableName = "";
                this.properties = "";
                this.resultVariableName = "";
                if (params) {
                    this.variableName = params.variableName;
                    this.properties = params.properties;
                    this.resultVariableName = params.resultVariableName;
                }
            }
            ParseDateTime.prototype.run = function (variables, functions) {
                if (!this.variableName || !variables[this.variableName]) {
                    return Logic.rejectPromise("ParseDateTime: variable '" + this.variableName + "' does not exist");
                }
                if (!this.resultVariableName || !variables[this.resultVariableName]) {
                    return Logic.rejectPromise("ParseDateTime: result variable '" + this.resultVariableName + "' does not exist");
                }
                var properties = this.properties && this.properties.length ? this.properties.split(",") : [], data = variables[this.variableName].value;
                variables[this.resultVariableName].value = AppPlayer.parseDates(data, properties);
                return Logic.trivialPromise();
            };
            return ParseDateTime;
        }(Operation));
        Logic.ParseDateTime = ParseDateTime;
        var XmlToJs = (function (_super) {
            __extends(XmlToJs, _super);
            function XmlToJs(params) {
                _super.call(this);
                this.variableName = "";
                this.resultVariableName = "";
                if (params) {
                    this.variableName = params.variableName;
                    this.resultVariableName = params.resultVariableName;
                }
            }
            XmlToJs.prototype.run = function (variables, functions) {
                if (!this.variableName || !variables[this.variableName]) {
                    return Logic.rejectPromise("XmlToJs: variable '" + this.variableName + "' does not exist");
                }
                if (!this.resultVariableName || !variables[this.resultVariableName]) {
                    return Logic.rejectPromise("XmlToJs: result variable '" + this.resultVariableName + "' does not exist");
                }
                var xml = variables[this.variableName].value, xmlDoc = $.isXMLDoc(xml) ? xml : $.parseXML(xml);
                variables[this.resultVariableName].value = AppPlayer.xmlToJs(xmlDoc.documentElement);
                return Logic.trivialPromise();
            };
            return XmlToJs;
        }(Operation));
        Logic.XmlToJs = XmlToJs;
        var CallParam = (function () {
            function CallParam() {
            }
            return CallParam;
        }());
        Logic.CallParam = CallParam;
        ;
        var Call = (function (_super) {
            __extends(Call, _super);
            function Call(params) {
                _super.call(this);
                this.functionName = "";
                this.resultVariableName = "";
                this.params = [];
                if (params) {
                    this.functionName = params.functionName;
                    this.resultVariableName = params.resultVariableName || "";
                    this.params = params.params || [];
                }
            }
            Call.prototype.run = function (variables, functions) {
                var _this = this;
                if (typeof this.functionName !== "string" || this.functionName.length === 0) {
                    return Logic.rejectPromise("Call: a function name must be specified");
                }
                // NOTE: by default, the function w/o $... takes from $global (backward compatibility) or functions (for Module-functions)
                var modelName = this.functionName.indexOf("$model") === 0 ? "$model" : "$global", model = variables[modelName].value, fnName = this.functionName.replace(modelName + ".", ""), fn = model[fnName] || functions[fnName], params = {};
                this.params.forEach(function (param) {
                    var value = _this.eval(param.expr, variables, functions);
                    params[param.name] = value;
                });
                $.each(variables, function (name, value) {
                    if (name.indexOf("$") === 0) {
                        params[name] = variables[name].value;
                    }
                });
                if (this.resultVariableName) {
                    return fn(params)
                        .then(function (result) {
                        variables[_this.resultVariableName].value = result;
                        return Logic.trivialPromise();
                    });
                }
                return fn(params) || Logic.trivialPromise();
            };
            return Call;
        }(Operation));
        Logic.Call = Call;
        var Debugger = (function (_super) {
            __extends(Debugger, _super);
            function Debugger() {
                _super.apply(this, arguments);
            }
            Debugger.prototype.run = function (variables, functions) {
                /* tslint:disable: no-debugger */
                debugger;
                /* tslint:enable */
                return Logic.trivialPromise();
            };
            return Debugger;
        }(Operation));
        Logic.Debugger = Debugger;
        var Log = (function (_super) {
            __extends(Log, _super);
            function Log(params) {
                _super.call(this);
                this.expr = "";
                this.level = "info";
                if (params) {
                    this.expr = params.expr;
                    this.level = params.level || this.level;
                }
            }
            Log.prototype.run = function (variables, functions) {
                if (!this.expr) {
                    return Logic.rejectPromise("Log: an expression must be specified");
                }
                var message = this.eval(this.expr, variables, functions);
                var log = functions["log"];
                log(this.level, message);
                return Logic.trivialPromise();
            };
            return Log;
        }(Operation));
        Logic.Log = Log;
        var Eval = (function (_super) {
            __extends(Eval, _super);
            function Eval(params) {
                _super.call(this);
                this.expr = "";
                this.errorVariableName = "";
                if (params) {
                    this.expr = params.expr;
                    this.errorVariableName = params.errorVariableName;
                }
            }
            Eval.prototype.run = function (variables, functions) {
                if (!this.expr) {
                    return Logic.rejectPromise("Eval: an expression must be specified");
                }
                return this.eval(this.expr, variables);
            };
            Eval.prototype.eval = function (expr, variables) {
                var _this = this;
                var errorHandler = function (d, e) {
                    if (_this.errorVariableName) {
                        variables[_this.errorVariableName].value = e;
                        d.resolve();
                    }
                    else {
                        d.reject(e);
                    }
                }, vars = {}, restoreVariablesExpr = "";
                $.each(variables, function (name, variable) {
                    vars[name] = variable.value;
                    //NOTE: restore values to BizLogic-variables after user-code execution
                    restoreVariablesExpr += "variables['" + name + "'].value=" + name + ";";
                });
                return Eval.exec(expr, restoreVariablesExpr, errorHandler, variables, vars);
            };
            Eval.runFn = function (body, values, variables) {
                var bodyEval = body.replace(/\n/g, " ").replace(/\r/g, " ").replace(/"/g, "\\\""), fn = new Function("_values_", "variables", "with(_values_) {return eval(\"" + bodyEval + "\")}");
                return fn.apply(null, [values, variables]);
            };
            Eval.exec = function (body, restoreVariablesExpr, errorHandler, variables, values) {
                var _result_ = $.Deferred();
                try {
                    var promise = Eval.runFn(body, values);
                    if (window["AppPlayer"].isPromise(promise)) {
                        promise.then(function () {
                            Eval.runFn(restoreVariablesExpr, values, variables);
                            _result_.resolve();
                        }, function (e) {
                            errorHandler(_result_, e);
                        });
                    }
                    else {
                        Eval.runFn(restoreVariablesExpr, values, variables);
                        _result_.resolve();
                    }
                }
                catch (e) {
                    errorHandler(_result_, e);
                }
                return _result_;
            };
            return Eval;
        }(Operation));
        Logic.Eval = Eval;
    })(Logic = AppPlayer.Logic || (AppPlayer.Logic = {}));
})(AppPlayer || (AppPlayer = {}));
var AppPlayer;
(function (AppPlayer) {
    "use strict";
    (function (TYPES) {
        TYPES[TYPES["PRIMITIVE_TYPE"] = 0] = "PRIMITIVE_TYPE";
        TYPES[TYPES["ARRAY_TYPE"] = 1] = "ARRAY_TYPE";
        TYPES[TYPES["OBJECT_TYPE"] = 2] = "OBJECT_TYPE";
        TYPES[TYPES["STORE_TYPE"] = 3] = "STORE_TYPE";
        TYPES[TYPES["TYPED_OBJECT"] = 4] = "TYPED_OBJECT";
    })(AppPlayer.TYPES || (AppPlayer.TYPES = {}));
    var TYPES = AppPlayer.TYPES;
    ;
    var TypeInfoRepository = (function () {
        function TypeInfoRepository(storesConfig) {
            // from DevExpress.data.utils.odata.keyConverters
            this.oDataToJsonTypeMap = {
                String: "string",
                Int32: "number",
                Int64: "number",
                Guid: "string",
                Boolean: "boolean"
            };
            this.types = [];
            this.addWithList({
                name: TypeInfoRepository.BOOLEAN,
                kind: TYPES.PRIMITIVE_TYPE,
                defaultValueCtor: function () { return false; },
                toUIString: function (value) { return ko.unwrap(value).toString(); }
            });
            this.addWithList({
                name: "number",
                kind: TYPES.PRIMITIVE_TYPE,
                defaultValueCtor: function () { return 0; },
                toUIString: function (value) { return ko.unwrap(value).toString(); }
            });
            this.addWithList({
                name: "string",
                kind: TYPES.PRIMITIVE_TYPE,
                defaultValueCtor: function () { return ""; },
                toUIString: function (value) { return "\"" + ko.unwrap(value) + "\""; }
            });
            this.addWithList({
                name: "datetime",
                kind: TYPES.PRIMITIVE_TYPE,
                defaultValueCtor: function () { return new Date(); },
                toUIString: function (value) { return ko.unwrap(value).toString(); }
            });
            this.addWithList({
                name: "object",
                kind: TYPES.OBJECT_TYPE,
                defaultValueCtor: function () { return null; },
                toUIString: function (value) {
                    if (value === null) {
                        return "null";
                    }
                    if (typeof value === "undefined") {
                        return "undefined";
                    }
                    return ko.unwrap(value).toString();
                }
            });
            this.addWithList({
                name: "guid",
                kind: TYPES.PRIMITIVE_TYPE,
                defaultValueCtor: function () { return ""; },
                toUIString: function (value) { return ko.unwrap(value); }
            });
            this.addStoreTypes(storesConfig);
        }
        Object.defineProperty(TypeInfoRepository, "BOOLEAN", {
            get: function () { return "boolean"; },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(TypeInfoRepository, "OBJECT", {
            get: function () { return "object"; },
            enumerable: true,
            configurable: true
        });
        TypeInfoRepository.hasProperties = function (t) {
            if (t.kind !== TYPES.STORE_TYPE) {
                return false;
            }
            return (t.properties.length > 1 && !!t.keyProperty) || (t.properties.length > 0 && !t.keyProperty);
        };
        TypeInfoRepository.migrateObject = function (obj, t) {
            if (t.kind !== TYPES.STORE_TYPE) {
                return obj;
            }
            if (obj instanceof Object) {
                var properties = t.properties;
                if (properties.length) {
                    var propNames = {};
                    if (t.keyProperty) {
                        propNames[t.keyProperty.name] = true;
                    }
                    properties.forEach(function (prop) {
                        if (!obj.hasOwnProperty(prop.name)) {
                            obj[prop.name] = prop.type.defaultValueCtor();
                        }
                        propNames[prop.name] = true;
                    });
                    $.each(Object.keys(obj), function (index, propName) {
                        if (!propNames[propName]) {
                            delete obj[propName];
                        }
                    });
                    return obj;
                }
                else {
                    return obj;
                }
            }
            else {
                return t.defaultValueCtor();
            }
        };
        TypeInfoRepository.prototype.get = function (typeName) {
            return this.types[ko.unwrap(typeName)];
        };
        TypeInfoRepository.prototype.getAll = function () {
            return this.types;
        };
        TypeInfoRepository.prototype.typeOf = function (value) {
            var valueType = typeof value;
            if (this.types[valueType]) {
                return valueType;
            }
            for (var i = 0; i < this.types.length; i++) {
                var typeInfo = this.types[i];
                if (typeInfo.kind === TYPES.PRIMITIVE_TYPE) {
                    if (typeof typeInfo.defaultValueCtor() === valueType) {
                        return typeInfo.name;
                    }
                    else {
                        if (this.isStoreObject(value, typeInfo)) {
                            return typeInfo.name;
                        }
                    }
                }
            }
            return null;
        };
        TypeInfoRepository.prototype.storeId = function (typeName) {
            var type = this.get(typeName);
            if (type) {
                if (type.kind === TYPES.STORE_TYPE) {
                    return type.name;
                }
                else if (type.kind === TYPES.ARRAY_TYPE && type.nestedType.kind === TYPES.STORE_TYPE) {
                    return type.nestedType.name;
                }
            }
            return null;
        };
        TypeInfoRepository.prototype.addTypedObjectType = function (typeInfo) {
            if (!typeInfo) {
                return;
            }
            this._add(typeInfo);
        };
        TypeInfoRepository.prototype.addStoreTypes = function (storesConfig) {
            var _this = this;
            if (!storesConfig) {
                return;
            }
            storesConfig.forEach(function (store) {
                var keyProperty;
                var properties = [];
                if (store.fields) {
                    store.fields.forEach(function (field) {
                        var baseType = _this.get(field.type);
                        if (!baseType) {
                            console.warn("Store '" + store.id + "' field '" + field.name + "' has unknown type '" + field.type + "'");
                            baseType = _this.get("object");
                        }
                        var property = {
                            name: field.name,
                            type: baseType
                        };
                        if (field.name === store.key) {
                            keyProperty = property;
                        }
                        else {
                            properties.push(property);
                        }
                    });
                }
                if (!keyProperty && store.key) {
                    var keyTypeName = _this.oDataToJsonTypeMap[store["keyType"]];
                    keyProperty = { name: store.key, type: _this.get(keyTypeName) || _this.get(TypeInfoRepository.OBJECT) };
                }
                _this.addWithList({
                    name: store.id,
                    kind: TYPES.STORE_TYPE,
                    keyProperty: keyProperty,
                    properties: properties,
                    defaultValueCtor: function () { return _this.defaultObjectCtor(properties); },
                    toUIString: function (value) { return "{" + store.id + "}"; }
                });
            });
        };
        TypeInfoRepository.prototype.isStoreObject = function (object, typeInfo) {
            if (!$.isPlainObject(object)) {
                return false;
            }
            var result = true;
            $.each(object, function (propertyName, propertyValue) {
                result = typeInfo.properties.some(function (property) { return propertyName === property.name; });
                return result;
            });
            return result;
        };
        TypeInfoRepository.prototype.defaultObjectCtor = function (properties) {
            var result = {};
            properties.forEach(function (property) {
                result[property.name] = property.type.defaultValueCtor();
            });
            return result;
        };
        TypeInfoRepository.prototype.createListType = function (plainType) {
            var listType = {
                name: plainType.name + "[]",
                kind: TYPES.ARRAY_TYPE,
                defaultValueCtor: function () { return []; },
                nestedType: plainType,
                toUIString: function (value) {
                    value = ko.unwrap(value);
                    var result = plainType.name + "[";
                    if (value && value.length > 0) {
                        result += value.length;
                    }
                    return result + "]";
                }
            };
            return listType;
        };
        TypeInfoRepository.prototype.addWithList = function (type) {
            this._add(type);
            var listType = this.createListType(type);
            this._add(listType);
        };
        TypeInfoRepository.prototype._add = function (type) {
            this.types.push(type);
            this.types[type.name] = type;
        };
        return TypeInfoRepository;
    }());
    AppPlayer.TypeInfoRepository = TypeInfoRepository;
})(AppPlayer || (AppPlayer = {}));
var AppPlayer;
(function (AppPlayer) {
    var Logic;
    (function (Logic) {
        "use strict";
        var Variable = (function () {
            function Variable(config) {
                this._config = config;
                this.value = config.value;
            }
            Object.defineProperty(Variable.prototype, "name", {
                get: function () {
                    return this._config.name;
                },
                enumerable: true,
                configurable: true
            });
            Object.defineProperty(Variable.prototype, "parameter", {
                get: function () {
                    return this._config.parameter || false;
                },
                enumerable: true,
                configurable: true
            });
            Object.defineProperty(Variable.prototype, "type", {
                get: function () {
                    return this._config.type || "object";
                },
                enumerable: true,
                configurable: true
            });
            Variable.prototype.resetValue = function () {
                this.value = AppPlayer.clone(this._config.value);
            };
            Variable.fromJson = function (json) {
                var result = new Variable(json);
                return result;
            };
            return Variable;
        }());
        Logic.Variable = Variable;
    })(Logic = AppPlayer.Logic || (AppPlayer.Logic = {}));
})(AppPlayer || (AppPlayer = {}));
/*module AppPlayer {
"use strict";
import dxdata = DevExpress.data;

export class LocalStore extends dxdata.LocalStore {
    constructor(storeOptions: dxdata.LocalStoreOptions) {
        super(storeOptions);
    }

    byKey(key: any, extraOptions: any): JQueryPromise<any> {
        return super.byKey(key, extraOptions)
            .then((value: any) => {
                if(value instanceof Object) {
                    return $.extend({}, value);
                } else {
                    return value;
                }
            });
    }

    load(obj?: dxdata.LoadOptions): JQueryPromise<any[]> {
        return super.load(obj)
            .then((value: any[]) => {
                if(value) {
                    $.each(value, (name, val) => {
                        if(val instanceof Object) {
                            value[name] = $.extend({}, val);
                        }
                    });
                }
                return value;
            });
    }
}
}*/ 
var AppPlayer;
(function (AppPlayer) {
    var Views;
    (function (Views) {
        "use strict";
    })(Views = AppPlayer.Views || (AppPlayer.Views = {}));
})(AppPlayer || (AppPlayer = {}));
var AppPlayer;
(function (AppPlayer) {
    var Views;
    (function (Views) {
        "use strict";
        var dxdevice = DevExpress.devices;
        var FileImageEditorViewModel = (function () {
            function FileImageEditorViewModel(options) {
                var _this = this;
                this.fullBase64Header = "data:image/png;base64,";
                this.base64Header = "base64,";
                this.PHOTOLIBRARY = 0;
                this.CAMERA = 1;
                this.actionSheetOptions = ko.observable(null);
                this.fileSelected = function (_model, event) {
                    var fileInput = event.currentTarget.parentElement.getElementsByTagName("input")[0];
                    _this._handleFiles(event.target, _this.value);
                    fileInput.value = null;
                };
                this["style"] = options.style;
                this.value = options.value || ko.observable();
                this.imageSrc = ko.computed(function () {
                    return _this.addBase64Header(ko.unwrap(ko.unwrap(_this.value)));
                });
                this.emptyLabelVisible = ko.computed(function () {
                    return !_this.imageSrc();
                });
                this.imageStyle = ko.computed(function () {
                    var style = _this["style"], width = !isNaN(parseInt(style.width, 10)) ? style.width : undefined, height = !isNaN(parseInt(style.height, 10)) ? style.height : undefined;
                    if (_this.emptyLabelVisible()) {
                        return { width: width || height, height: height || width };
                    }
                    return { width: width || "auto", height: height || "auto" };
                });
                this.emptyLabel = options.emptyLabel;
                this.clearText = options.clearText;
                this.takePhotoText = options.takePhotoText;
                this.openGalleryText = options.openGalleryText;
            }
            FileImageEditorViewModel.prototype.addBase64Header = function (value) {
                if (value == null || value === "(Image)" || value === "") {
                    return null;
                }
                var result = AppPlayer.startsWith(value, "http")
                    ? value
                    : this.fullBase64Header + this.removeBase64Header(value);
                return result;
            };
            FileImageEditorViewModel.prototype.removeBase64Header = function (value) {
                if (value !== null) {
                    var index = value.indexOf(this.base64Header);
                    return index === -1 ? value : value.substr(index + this.base64Header.length);
                }
            };
            FileImageEditorViewModel.prototype._getActionSheetOption = function (event) {
                var _this = this;
                var isDesktop = dxdevice.current().deviceType === "desktop", isCordova = !!window["cordova"], dataSource = [
                    {
                        text: this.takePhotoText,
                        fileSelected: this.fileSelected,
                        touchStart: function () { },
                        visible: isCordova,
                        click: function (args) {
                            _this._cordovaCameraDelegate(_this.CAMERA);
                        }
                    },
                    {
                        text: this.openGalleryText,
                        fileSelected: this.fileSelected,
                        touchStart: function () {
                            if (!isCordova) {
                                _this.control.hide();
                                _this.showFileDialog(event);
                            }
                        },
                        visible: true,
                        click: function (args) {
                            if (isCordova) {
                                _this._cordovaCameraDelegate(_this.PHOTOLIBRARY);
                            }
                            else {
                                _this.showFileDialog(event);
                            }
                        }
                    },
                    {
                        text: this.clearText,
                        fileSelected: this.fileSelected,
                        visible: !this.emptyLabelVisible(),
                        touchStart: function () { },
                        click: function () {
                            _this.value(null);
                        }
                    }];
                return {
                    target: event.currentTarget,
                    usePopover: isDesktop,
                    visible: ko.observable(false),
                    showTitle: false,
                    width: isDesktop ? "auto" : undefined,
                    dataSource: dataSource,
                    onItemClick: function (eventArgs) { eventArgs.itemData.click(eventArgs); },
                    onInitialized: function (args) { _this.control = args.component; }
                };
            };
            FileImageEditorViewModel.prototype._cordovaCameraDelegate = function (sourceType) {
                if (sourceType === void 0) { sourceType = this.CAMERA; }
                var onSuccess = function (imageData) {
                    this.value(imageData);
                }, onFail = function (message) {
                    console.log("Failed because: " + message);
                };
                navigator["camera"].getPicture(onSuccess.bind(this), onFail, { quality: 50, destinationType: 0, sourceType: sourceType });
            };
            ;
            FileImageEditorViewModel.prototype._handleFiles = function (filesHolder, value) {
                var _this = this;
                var files = filesHolder.files;
                for (var i = 0; i < files.length; i++) {
                    var file = files[i];
                    var imageType = /image.*/;
                    if (!file.type.match(imageType)) {
                        continue;
                    }
                    var fr = new FileReader();
                    fr.onload = function (args) {
                        //var encodedImage = fr.result.replace(/^data:[^,]+,/, '');
                        value(_this.removeBase64Header(fr.result));
                    };
                    fr.readAsDataURL(file);
                }
            };
            ;
            FileImageEditorViewModel.prototype.showFileDialog = function (args) {
                var fileInput = args.currentTarget.parentElement.getElementsByTagName("input")[0];
                if (fileInput) {
                    fileInput.click();
                    args.stopPropagation();
                }
            };
            ;
            FileImageEditorViewModel.prototype.showFileDialogOrActionSheet = function (_viewModel, args) {
                this.actionSheetOptions(this._getActionSheetOption(args));
                this.actionSheetOptions().visible(true);
            };
            ;
            return FileImageEditorViewModel;
        }());
        Views.FileImageEditorViewModel = FileImageEditorViewModel;
    })(Views = AppPlayer.Views || (AppPlayer.Views = {}));
})(AppPlayer || (AppPlayer = {}));

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIkFwcFBsYXllci90cy9zdG9yZXMvb2RhdGFTdG9yZS50cyIsIkFwcFBsYXllci90cy9zdG9yZXMvcmVzdFN0b3JlLnRzIiwiQXBwUGxheWVyL3RzL3N0b3Jlcy9hcnJheVN0b3JlLnRzIiwiQXBwUGxheWVyL3RzL3N0b3Jlcy9kZXNpZ25lclN0b3JlLnRzIiwiQXBwUGxheWVyL3RzL2FwcGxpY2F0aW9uLnRzIiwiQXBwUGxheWVyL3RzL2xvZ2ljL2Z1bmN0aW9uQ29tcGlsZXIudHMiLCJBcHBQbGF5ZXIvdHMvYXV0aG9yaXphdGlvbi50cyIsIkFwcFBsYXllci90cy9jb21wb25lbnRzLnRzIiwiQXBwUGxheWVyL3RzL2N1c3RvbUJpbmRpbmdzLnRzIiwiQXBwUGxheWVyL3RzL2RhdGFzb3VyY2UudHMiLCJBcHBQbGF5ZXIvdHMvbGF5b3V0SGVscGVyLnRzIiwiQXBwUGxheWVyL3RzL21vZGVsLnRzIiwiYm9vdHN0cmFwcGVyL3RzL2Jvb3RzdHJhcHBlci50cyIsIkFwcFBsYXllci90cy9tb2R1bGVzTG9hZGVyLnRzIiwiQXBwUGxheWVyL3RzL3N0eWxlcy50cyIsIkFwcFBsYXllci90cy91dGlscy50cyIsIkFwcFBsYXllci90cy92aWV3cy92aWV3TWFya3VwUmVuZGVyZXIudHMiLCJBcHBQbGF5ZXIvdHMvdmlldy50cyIsIkFwcFBsYXllci90cy9WaWV3TGF5b3V0LnRzIiwiQXBwUGxheWVyL3RzL3ZpZXdzL2NvbXBvbmVudHNJbmZvLnRzIiwiQXBwUGxheWVyL3RzL3ZpZXdNb2RlbC50cyIsIkFwcFBsYXllci90cy9sb2dpYy9PcGVyYXRpb24udHMiLCJBcHBQbGF5ZXIvdHMvbG9naWMvdHlwZXMudHMiLCJBcHBQbGF5ZXIvdHMvbG9naWMvdmFyaWFibGUudHMiLCJBcHBQbGF5ZXIvdHMvc3RvcmVzL2xvY2FsU3RvcmUudHMiLCJBcHBQbGF5ZXIvdHMvdmlld3MvYmluZGluZ0V4cHJlc3Npb24udHMiLCJBcHBQbGF5ZXIvdHMvdmlld3MvZmlsZUltYWdl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LFdBQVcsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsR0FBRyxxQkFBcUIsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxHQUFRLFFBQVEsQ0FBQyxJQUFJLElBQUksUUFBUSxDQUFDLG9CQUFvQixDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxLQUFLLElBQUksTUFBTSxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsZUFBZSxJQUFJLFFBQVEsQ0FBQyxlQUFlLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxHQUFRLFFBQVEsQ0FBQyxhQUFhLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxHQUFHLE9BQU8sQ0FBQyxDQUFDLE9BQU8sSUFBSSxTQUFTLEVBQUUsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxVQUFVLElBQUksQ0FBQyxDQUFDLFVBQVUsSUFBSSxlQUFlLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLEtBQUssS0FBSyxJQUFJLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLElBQUksTUFBTSxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSxtQkFBbUIsQ0FBQSxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsSUFBSSxNQUFNLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLGdCQUFnQixDQUFBLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxFQUFFLENBQUMsSUFBSSxJQUFJLENBQUMsR0FBRyxZQUFZLENBQUMsQ0FBQyxFQUFFLENBQUEsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUFDLENBQUMsR0FBRyxRQUFRLENBQUMsUUFBUSxHQUFHLENBQUMsQ0FBQTtBQUFDLENBQUM7QUFBQyxJQUFJLENBQUMsRUFBRSxDQUFBLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLElBQUksR0FBRyxDQUFDLENBQUMsQ0FBQztJQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUE7QUFBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxJQUFJLEdBQUcsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUEsQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLEVBQUUsQ0FBQyxJQUFJLEdBQUcsQ0FBQSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFBQyxFQUFFLENBQUEsQ0FBQyxDQUFDLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUE7SUFBQyxDQUFDO0FBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUEsQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLElBQUksSUFBSSxDQUFDLEdBQUcsS0FBSyxDQUFDLENBQUMsR0FBRyxDQUFBLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsT0FBTyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO0lBQUMsRUFBRSxDQUFBLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLElBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDO1FBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQztRQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsWUFBWSxFQUFFLENBQUM7UUFBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLFlBQVksR0FBRyxJQUFJLENBQUE7SUFBQyxDQUFDO0FBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUEsQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsa0JBQWtCLEdBQUcsY0FBYSxFQUFFLENBQUEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLElBQUksQ0FBQyxDQUFDLFVBQVUsSUFBSSxVQUFVLElBQUksQ0FBQyxDQUFDLFVBQVUsSUFBSSxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxrQkFBa0IsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQSxDQUFDLENBQUMsQ0FBQSxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFBLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsa0JBQWtCLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7SUFBQyxDQUFDLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQTtBQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsZUFBZSxHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxrQkFBa0IsR0FBRyxFQUFFLENBQUEsQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxJQUFJLFVBQVUsQ0FBQyxjQUFhLElBQUksQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQSxDQUFDLE1BQU0sSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQUMsRUFBRSxDQUFBLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxNQUFNLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFBQyxNQUFNLENBQUE7SUFBQyxDQUFDO0lBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsUUFBUSxDQUFDLGFBQWEsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUM7SUFBQyxDQUFDLENBQUMsSUFBSSxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUEsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDO0lBQUMsQ0FBQyxDQUFDLE9BQU8sR0FBRyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsRUFBRSxDQUFBLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUFDLEVBQUUsQ0FBQSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFBQyxDQUFDLENBQUMsSUFBSSxHQUFHLENBQUMsQ0FBQztRQUFDLEVBQUUsQ0FBQSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFBQyxDQUFDLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQztZQUFDLENBQUMsQ0FBQyxTQUFTLEdBQUcsQ0FBQyxDQUFBO1FBQUMsQ0FBQztRQUFDLElBQUksQ0FBQyxDQUFDO1lBQUMsQ0FBQyxDQUFDLGtCQUFrQixHQUFHLGNBQWEsRUFBRSxDQUFBLENBQUMsQ0FBQyxDQUFDLFVBQVUsSUFBSSxRQUFRLENBQUM7Z0JBQUMsQ0FBQyxFQUFFLENBQUEsQ0FBQyxDQUFDLENBQUE7UUFBQyxDQUFDO1FBQUMsQ0FBQyxDQUFDLEdBQUcsR0FBRyxDQUFDLENBQUE7SUFBQyxDQUFDO0lBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQUMsQ0FBQyxHQUFHLElBQUksY0FBYyxFQUFFLENBQUM7UUFBQyxDQUFDLENBQUMsa0JBQWtCLEdBQUcsY0FBYSxFQUFFLENBQUEsQ0FBQyxDQUFDLENBQUMsVUFBVSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFBQyxDQUFDLENBQUMsa0JBQWtCLEdBQUcsY0FBYSxDQUFDLENBQUM7WUFBQyxDQUFDLENBQUMsSUFBSSxHQUFHLENBQUMsQ0FBQyxZQUFZLEdBQUcsa0JBQWtCLEdBQUcsQ0FBQyxDQUFDO1lBQUMsQ0FBQyxFQUFFLENBQUE7UUFBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFBQyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUE7SUFBQyxDQUFDO0lBQUMsSUFBSSxDQUFDLENBQUM7UUFBQyxDQUFDLENBQUMsSUFBSSxHQUFHLG1CQUFtQixDQUFDO1FBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsT0FBTyxFQUFFLGNBQWEsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFBLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFBQyxDQUFDLENBQUMsR0FBRyxHQUFHLENBQUMsQ0FBQztRQUFDLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQTtJQUFDLENBQUM7QUFBQyxDQUFDO0FBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFBQyxDQUFDLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQztJQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLFVBQVUsRUFBRSxDQUFDLENBQUMsQ0FBQztJQUFDLENBQUMsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxDQUFDO0lBQUMsQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFBO0FBQUMsQ0FBQztBQUFDLElBQUksQ0FBQyxDQUFDO0lBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsVUFBVSxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQUMsQ0FBQyxDQUFDLEdBQUcsR0FBRyxDQUFDLENBQUM7SUFBQyxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUE7QUFBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFBLENBQUMsQ0FBQyxDQUFDLGVBQWUsSUFBSSxDQUFDLEdBQUcsRUFBRSxFQUFFLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxlQUFlLEVBQUUsQ0FBQSxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDO0lBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQztJQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFBLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxRQUFRLENBQUM7SUFBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxJQUFJLFFBQVEsQ0FBQyxhQUFhLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUEsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDO0lBQUMsQ0FBQyxDQUFDLElBQUksR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFBLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQztJQUFDLENBQUMsQ0FBQyxPQUFPLEdBQUcsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLFVBQVUsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0lBQUMsQ0FBQyxDQUFDLElBQUksR0FBRyxJQUFJLENBQUE7QUFBQyxDQUFDO0FBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0lBQUMsQ0FBQyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsa0JBQWtCLEdBQUcsSUFBSSxDQUFDO0lBQUMsQ0FBQyxDQUFDLElBQUksR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFBO0FBQUMsQ0FBQztBQUFDLElBQUksQ0FBQyxDQUFDO0lBQUMsQ0FBQyxDQUFDLEdBQUcsR0FBRyxDQUFDLENBQUMsUUFBUSxDQUFBO0FBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0lBQUMsQ0FBQyxFQUFFLENBQUE7QUFBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxJQUFJLElBQUksQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsY0FBYSxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsRUFBRSxjQUFhLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFBLENBQUMsQ0FBQyxDQUFDLENBQUEsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxHQUFHLGNBQWEsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsR0FBRyxDQUFDLENBQUMsR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBRyxJQUFJLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxHQUFHLEdBQUcsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFBLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFLEtBQUssRUFBRSxFQUFFLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFBLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxHQUFHLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxRQUFRLEVBQUUsS0FBSyxFQUFFLGVBQWUsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLGtCQUFrQixFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztJQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsY0FBYSxDQUFDLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLGVBQWUsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQztRQUFDLENBQUMsQ0FBQyxlQUFlLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQTtJQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsZUFBZSxHQUFHLEVBQUUsQ0FBQSxDQUFDLENBQUMsR0FBRyxjQUFhLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFBO0FBQUMsQ0FBQztBQUFDLElBQUksQ0FBQyxDQUFDO0lBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUFDLEVBQUUsQ0FBQSxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO1FBQUMsQ0FBQyxFQUFFLENBQUE7SUFBQyxDQUFDO0lBQUMsSUFBSSxDQUFDLENBQUM7UUFBQyxDQUFDLENBQUMsa0JBQWtCLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFBO0lBQUMsQ0FBQztBQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsZUFBZSxJQUFJLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxFQUFFLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLEtBQUssRUFBRSxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsWUFBWSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFBLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLFlBQVksR0FBRyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUEsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxPQUFPLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7SUFBQyxFQUFFLENBQUEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDO1FBQUMsTUFBTSxDQUFBO0FBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUEsQ0FBQyxDQUFDLENBQUMsZUFBZSxPQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxFQUFFLENBQUM7SUFBQyxFQUFFLENBQUEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQUMsSUFBSSxDQUFDO1lBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQTtRQUFDLENBQUU7UUFBQSxLQUFLLENBQUEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUFDLFFBQVEsQ0FBQTtJQUFDLENBQUM7SUFBQyxJQUFJLENBQUMsRUFBRSxDQUFBLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztRQUFDLEVBQUUsQ0FBQSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUFDLFFBQVEsQ0FBQztRQUFDLEtBQUssQ0FBQTtJQUFDLENBQUM7SUFBQyxDQUFDLEVBQUUsQ0FBQTtBQUFDLENBQUMsQ0FBQyxFQUFFLENBQUEsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7SUFBQyxDQUFDLEdBQUcsS0FBSyxDQUFDO0lBQUMsQ0FBQyxHQUFHLEtBQUssQ0FBQTtBQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsZUFBZSxFQUFFLENBQUEsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO0lBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsRUFBRSxPQUFPLEVBQUUsRUFBRSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFBO0FBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsRUFBRSxNQUFNLEVBQUUsY0FBYSxHQUFHLENBQUEsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLFNBQVMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQztRQUFDLENBQUMsVUFBUyxDQUFDLEVBQUUsQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFBLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUE7UUFBQyxDQUFDLENBQUMsR0FBRyxDQUFBLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7WUFBQyxDQUFDLEVBQUUsQ0FBQztZQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFBQyxFQUFFLENBQUEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQUMsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDO1lBQUMsRUFBRSxDQUFBLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQUMsUUFBUSxDQUFDO1lBQUMsRUFBRSxDQUFBLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7Z0JBQUEsRUFBRSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO2dCQUFDLENBQUMsRUFBRSxDQUFDO2dCQUFDLFFBQVEsQ0FBQTtZQUFDLENBQUM7WUFBQyxFQUFFLENBQUEsQ0FBQyxPQUFPLENBQUMsSUFBSSxRQUFRLENBQUM7Z0JBQUMsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLENBQUMsRUFBRSxDQUFDO1lBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLFFBQVEsRUFBRSxDQUFDLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRSxXQUFXLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQztZQUFDLENBQUMsQ0FBQyxRQUFRLEdBQUcsS0FBSyxDQUFDO1lBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUFDLENBQUMsR0FBRyxJQUFJLENBQUM7WUFBQyxFQUFFLENBQUEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFBO1FBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsRUFBRSxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQTtJQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFBLENBQUMsQ0FBQyxFQUFFLElBQUksRUFBRSxjQUFhLEVBQUUsQ0FBQSxDQUFDLFNBQVMsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUFDLEdBQUcsQ0FBQSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsU0FBUyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO1lBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQTtRQUFDLENBQUM7UUFBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUE7SUFBQyxDQUFDO0lBQUMsSUFBSTtRQUFDLENBQUMsR0FBRyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUEsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxFQUFFLE1BQU0sRUFBRSxDQUFDLENBQUMsTUFBTSxFQUFFLElBQUksRUFBRSxDQUFDLENBQUMsSUFBSSxFQUFFLFVBQVUsRUFBRSxVQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQSxDQUFDLENBQUMsRUFBRSxDQUFBLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxFQUFFLGlCQUFpQixFQUFFLFVBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFBLENBQUMsQ0FBQyxFQUFFLFVBQVUsRUFBRSxjQUFhLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxTQUFTLENBQUMsQ0FBQSxDQUFDLENBQUMsRUFBRSxNQUFNLEVBQUUsY0FBYSxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsU0FBUyxDQUFDLENBQUEsQ0FBQyxDQUFDLEVBQUUsSUFBSSxFQUFFLGNBQWEsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLFNBQVMsQ0FBQyxDQUFBLENBQUMsQ0FBQyxFQUFFLFdBQVcsRUFBRSxjQUFhLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLEdBQUcsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxFQUFFLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQSxDQUFDLENBQUMsRUFBRSxTQUFTLEVBQUUsY0FBYSxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxHQUFHLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsRUFBRSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUEsQ0FBQyxDQUFDLEVBQUUsUUFBUSxFQUFFLGNBQWEsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxFQUFFLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFBLENBQUMsRUFBRSxFQUFFLENBQUMsSUFBSSxD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LENBQUM7Z0JBQ2pHLEVBQUUsQ0FBQSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUM7b0JBQ1gsU0FBUyxDQUFDLEtBQUssRUFBRSxDQUFDO29CQUNsQixJQUFJLENBQUMsZUFBZSxFQUFFLENBQUM7Z0JBQzNCLENBQUM7WUFDTCxDQUFDOztZQUNELDhEQUEyQixHQUEzQixVQUE0QixVQUFVLEVBQUUsSUFBVztnQkFDL0MsSUFBSSxDQUFDLGtCQUFrQixDQUFDLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO2dCQUMxRCxJQUFJLENBQUMsa0JBQWtCLEVBQUUsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDNUMsQ0FBQzs7WUFNTCwrQkFBQztRQUFELENBdEpBLEFBc0pDLElBQUE7UUF0SlksOEJBQXdCLDJCQXNKcEMsQ0FBQTtJQUNMLENBQUMsRUE1SmdCLEtBQUssR0FBTCxlQUFLLEtBQUwsZUFBSyxRQTRKckI7QUFBRCxDQUFDLEVBNUpNLFNBQVMsS0FBVCxTQUFTLFFBNEpmIiwiZmlsZSI6ImFwcFBsYXllci5qcyIsInNvdXJjZXNDb250ZW50IjpbIm1vZHVsZSBBcHBQbGF5ZXIge1xyXG4gICAgXCJ1c2Ugc3RyaWN0XCI7XHJcblxyXG4gICAgaW1wb3J0IGR4ZGF0YSA9IERldkV4cHJlc3MuZGF0YTtcclxuXHJcbiAgICBmdW5jdGlvbiB1bndyYXBOZXN0ZWRMaXN0cyhkYXRhKSB7XHJcbiAgICAgICAgdmFyIHZhbHVlQ2FsbGJhY2sgPSAodmFsdWVDb250ZXh0KSA9PiB7IHJldHVybiB2YWx1ZUNvbnRleHQudmFsdWU7IH0sXHJcbiAgICAgICAgICAgIHJlc3VsdCA9IHByb3BlcnR5VmlzaXRvcihkYXRhLCB2YWx1ZUNhbGxiYWNrLCB7XHJcbiAgICAgICAgICAgICAgICBnZXRWYWx1ZUNhbGxiYWNrOiAodmFsdWUsIGNvbnRleHQpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gKCQuaXNQbGFpbk9iamVjdCh2YWx1ZSkgJiYgdmFsdWUucmVzdWx0cyAmJiAkLmlzQXJyYXkodmFsdWUucmVzdWx0cykpID8gdmFsdWUucmVzdWx0cyA6IHByb3BlcnR5VmlzaXRvcih2YWx1ZSwgdmFsdWVDYWxsYmFjaywgY29udGV4dCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIHJldHVybiByZXN1bHQ7XHJcbiAgICB9O1xyXG5cclxuICAgIGZ1bmN0aW9uIHJlcGxhY2VLZXlzV2l0aE9iamVjdExpbmtzKHN0b3JlOiBJRGF0YVN0b3JlLCBvYmplY3Q6IHt9LCBzdG9yZXM6IHsgW2tleTogc3RyaW5nXTogRGV2RXhwcmVzcy5kYXRhLlN0b3JlIH0pIHtcclxuICAgICAgICB2YXIgbmV3T2JqZWN0ID0ge30sIG5hdmlnYXRpb25GaWVsZHMgPSBbXTtcclxuICAgICAgICBpZihzdG9yZS5maWVsZHMpIHtcclxuICAgICAgICAgICAgbmF2aWdhdGlvbkZpZWxkcyA9IHN0b3JlLmZpZWxkcy5maWx0ZXIoKGZpZWxkKSA9PiB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gZmllbGQuc3RvcmVJZCAmJiB0cnVlO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcbiAgICAgICAgJC5lYWNoKG9iamVjdCwobmFtZSwgdmFsdWUpID0+IHtcclxuICAgICAgICAgICAgaWYobmFtZSA9PT0gXCJfX21ldGFkYXRhXCIgfHwgKHZhbHVlICYmICh0eXBlb2YgdmFsdWUgPT09IFwib2JqZWN0XCIpICYmIHZhbHVlLl9fZGVmZXJyZWQpKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgbmV3T2JqZWN0W25hbWVdID0gdmFsdWU7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgbmF2aWdhdGlvbkZpZWxkcy5mb3JFYWNoKChmaWVsZCkgPT4ge1xyXG4gICAgICAgICAgICBpZihuZXdPYmplY3RbZmllbGQubmFtZV0pIHtcclxuICAgICAgICAgICAgICAgIG5ld09iamVjdFtmaWVsZC5uYW1lXSA9IHtcclxuICAgICAgICAgICAgICAgICAgICBfX21ldGFkYXRhOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHVyaTogc3RvcmVzW2ZpZWxkLnN0b3JlSWRdW1wiX2J5S2V5VXJsXCJdKG9iamVjdFtmaWVsZC5uYW1lXSlcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgcmV0dXJuIG5ld09iamVjdDtcclxuICAgIH07XHJcblxyXG4gICAgZnVuY3Rpb24gaXNHVUlEKHN0cjogc3RyaW5nKSB7XHJcbiAgICAgICAgaWYodHlwZW9mIHN0ciAhPT0gXCJzdHJpbmdcIikge1xyXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiAvXlswLTlhLWZdezh9LVswLTlhLWZdezR9LVsxLTVdWzAtOWEtZl17M30tWzg5YWJdWzAtOWEtZl17M30tWzAtOWEtZl17MTJ9JC9pLnRlc3Qoc3RyKTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBjcmVhdGVHdWlkcyhkYXRhKSB7XHJcbiAgICAgICAgdmFyIHZhbHVlQ2FsbGJhY2sgPSAodmFsdWVDb250ZXh0KSA9PiB7XHJcbiAgICAgICAgICAgIHZhciB2YWx1ZSA9IHZhbHVlQ29udGV4dC52YWx1ZTtcclxuICAgICAgICAgICAgaWYoaXNHVUlEKHZhbHVlKSkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIG5ldyBkeGRhdGEuR3VpZCh2YWx1ZSk7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gdmFsdWU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9O1xyXG4gICAgICAgIHJldHVybiBwcm9wZXJ0eVZpc2l0b3IoZGF0YSwgdmFsdWVDYWxsYmFjaywgeyBnZXRWYWx1ZUNhbGxiYWNrOiAodmFsdWUsIGNvbnRleHQpID0+IHsgcmV0dXJuIHByb3BlcnR5VmlzaXRvcih2YWx1ZSwgdmFsdWVDYWxsYmFjaywgY29udGV4dCk7IH0gfSk7XHJcbiAgICB9O1xyXG5cclxuICAgIGZ1bmN0aW9uIHByZXBhcmVMb2FkT3B0aW9ucyhsb2FkT3B0aW9uczogZHhkYXRhLkxvYWRPcHRpb25zKSB7XHJcbiAgICAgICAgcmV0dXJuIGxvYWRPcHRpb25zLmZpbHRlciA/ICQuZXh0ZW5kKHt9LCBsb2FkT3B0aW9ucywgeyBmaWx0ZXI6IGNyZWF0ZUd1aWRzKGxvYWRPcHRpb25zLmZpbHRlcikgfSkgOiBsb2FkT3B0aW9ucztcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBwcmVwYXJlS2V5KGtleSwgc3RvcmVPcHRpb25zKSB7XHJcbiAgICAgICAgcmV0dXJuIHN0b3JlT3B0aW9ucy5rZXlUeXBlID09PSBcIkd1aWRcIiA/IG5ldyBkeGRhdGEuR3VpZChrZXkpIDoga2V5O1xyXG4gICAgfVxyXG5cclxuICAgIGV4cG9ydCBjbGFzcyBPRGF0YVN0b3JlIGV4dGVuZHMgRGV2RXhwcmVzcy5kYXRhLk9EYXRhU3RvcmUge1xyXG4gICAgICAgIHByaXZhdGUgc3RvcmVPcHRpb25zOiBJT0RhdGFTdG9yZTtcclxuICAgICAgICBwcml2YXRlIHN0b3JlczogeyBba2V5OiBzdHJpbmddOiBEZXZFeHByZXNzLmRhdGEuU3RvcmUgfTtcclxuXHJcbiAgICAgICAgY29uc3RydWN0b3Ioc3RvcmVPcHRpb25zOiBJT0RhdGFTdG9yZSwgc3RvcmVzOiB7IFtrZXk6IHN0cmluZ106IERldkV4cHJlc3MuZGF0YS5TdG9yZSB9KSB7XHJcbiAgICAgICAgICAgIHN1cGVyKE9EYXRhU3RvcmUuY3JlYXRlT0RhdGFTdG9yZU9wdGlvbnMoc3RvcmVPcHRpb25zKSk7XHJcbiAgICAgICAgICAgIHRoaXMuc3RvcmVPcHRpb25zID0gc3RvcmVPcHRpb25zO1xyXG4gICAgICAgICAgICB0aGlzLnN0b3JlcyA9IHN0b3JlcztcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHByaXZhdGUgc3RhdGljIGNyZWF0ZU9EYXRhU3RvcmVPcHRpb25zKHN0b3JlT3B0aW9uczogSU9EYXRhU3RvcmUpOiBEZXZFeHByZXNzLmRhdGEuT0RhdGFTdG9yZU9wdGlvbnMge1xyXG4gICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgdXJsOiBzdG9yZU9wdGlvbnMuZGVidWdVcmwgfHwgc3RvcmVPcHRpb25zLnVybCxcclxuICAgICAgICAgICAgICAgIGtleTogc3RvcmVPcHRpb25zLmtleSxcclxuICAgICAgICAgICAgICAgIGtleVR5cGU6IHN0b3JlT3B0aW9ucy5rZXlUeXBlLFxyXG4gICAgICAgICAgICAgICAgYmVmb3JlU2VuZDogYWRkSGVhZGVycyhzdG9yZU9wdGlvbnMuaGVhZGVycyksXHJcbiAgICAgICAgICAgICAgICB2ZXJzaW9uOiBzdG9yZU9wdGlvbnMudmVyc2lvbixcclxuICAgICAgICAgICAgICAgIHdpdGhDcmVkZW50aWFsczogc3RvcmVPcHRpb25zLndpdGhDcmVkZW50aWFscyAhPT0gdW5kZWZpbmVkID8gc3RvcmVPcHRpb25zLndpdGhDcmVkZW50aWFscyA6IHRydWVcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGxvYWQobG9hZE9wdGlvbnM6IGR4ZGF0YS5Mb2FkT3B0aW9ucykge1xyXG4gICAgICAgICAgICB2YXIgZCA9ICQuRGVmZXJyZWQoKTtcclxuICAgICAgICAgICAgc3VwZXIubG9hZChwcmVwYXJlTG9hZE9wdGlvbnMobG9hZE9wdGlvbnMpKS5kb25lKGRhdGEgPT4geyBkLnJlc29sdmUodW53cmFwTmVzdGVkTGlzdHMoZGF0YSkpOyB9KS5mYWlsKGQucmVqZWN0KTtcclxuICAgICAgICAgICAgcmV0dXJuIGQucHJvbWlzZSgpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgYnlLZXkoa2V5LCBleHRyYU9wdGlvbnMpIHtcclxuICAgICAgICAgICAgdmFyIGQgPSAkLkRlZmVycmVkKCk7XHJcbiAgICAgICAgICAgIHN1cGVyLmJ5S2V5KHByZXBhcmVLZXkoa2V5LCB0aGlzLnN0b3JlT3B0aW9ucyksIGV4dHJhT3B0aW9ucykuZG9uZShkYXRhID0+IHsgZC5yZXNvbHZlKHVud3JhcE5lc3RlZExpc3RzKGRhdGEpKTsgfSkuZmFpbChkLnJlamVjdCk7XHJcbiAgICAgICAgICAgIHJldHVybiBkLnByb21pc2UoKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGluc2VydCh2YWx1ZXMpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHN1cGVyLmluc2VydChyZXBsYWNlS2V5c1dpdGhPYmplY3RMaW5rcyh0aGlzLnN0b3JlT3B0aW9ucywgdmFsdWVzLCB0aGlzLnN0b3JlcykpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdXBkYXRlKGtleSwgdmFsdWVzKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBzdXBlci51cGRhdGUoa2V5LCByZXBsYWNlS2V5c1dpdGhPYmplY3RMaW5rcyh0aGlzLnN0b3JlT3B0aW9ucywgdmFsdWVzLCB0aGlzLnN0b3JlcykpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmVtb3ZlKGtleSkge1xyXG4gICAgICAgICAgICByZXR1cm4gc3VwZXIucmVtb3ZlKHByZXBhcmVLZXkoa2V5LCB0aGlzLnN0b3JlT3B0aW9ucykpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdG90YWxDb3VudChsb2FkT3B0aW9uczogZHhkYXRhLkxvYWRPcHRpb25zKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBzdXBlci5sb2FkKHByZXBhcmVMb2FkT3B0aW9ucyhsb2FkT3B0aW9ucykpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxufVxyXG4iLCJtb2R1bGUgQXBwUGxheWVyIHtcclxuICAgIFwidXNlIHN0cmljdFwiO1xyXG5cclxuICAgIC8vaW1wb3J0IGFwdiA9IEFwcFBsYXllci5WaWV3cztcclxuXHJcbiAgICBmdW5jdGlvbiBzZW5kUmVxdWVzdCh1cmw6IHN0cmluZywgbWV0aG9kOiBzdHJpbmcsIGRhdGE6IGFueSwgZGF0YVR5cGU6IHN0cmluZywgaGVhZGVyczogSVJlcXVlc3RFbnRyeVtdKSB7XHJcbiAgICAgICAgdmFyIHJlcXVlc3RPcHRpb25zID0ge1xyXG4gICAgICAgICAgICB1cmw6IHVybCxcclxuICAgICAgICAgICAgdHlwZTogbWV0aG9kID8gbWV0aG9kLnRvVXBwZXJDYXNlKCkgOiBcIkdFVFwiLFxyXG4gICAgICAgICAgICBjb250ZW50VHlwZTogXCJhcHBsaWNhdGlvbi9qc29uOyBjaGFyc2V0PXV0Zi04XCIsXHJcbiAgICAgICAgICAgIGRhdGFUeXBlOiBkYXRhVHlwZSB8fCBcImpzb25cIixcclxuICAgICAgICAgICAgZGF0YTogZGF0YVxyXG4gICAgICAgIH07XHJcbiAgICAgICAgYWRkSGVhZGVycyhoZWFkZXJzKShyZXF1ZXN0T3B0aW9ucyk7XHJcbiAgICAgICAgcmV0dXJuICQuYWpheChyZXF1ZXN0T3B0aW9ucylcclxuICAgICAgICAgICAgLmZhaWwoKGFyZykgPT4ge1xyXG4gICAgICAgICAgICAvLyBDb252ZXJ0IHRvIEVycm9yIHNvIHRoYXQgRFhEYXRhIHdvbid0IGNvbnZlcnQgaXRcclxuICAgICAgICAgICAgdmFyIG1lc3NhZ2U7XHJcbiAgICAgICAgICAgIGlmKGFyZy5yZXNwb25zZUpTT04pIHtcclxuICAgICAgICAgICAgICAgIG1lc3NhZ2UgPSBhcmcucmVzcG9uc2VKU09OLk1lc3NhZ2U7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBtZXNzYWdlID0gYXJnLnJlc3BvbnNlVGV4dDtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB2YXIgZXJyb3IgPSBuZXcgRXJyb3IoKTtcclxuICAgICAgICAgICAgZXJyb3JbXCJzdGF0dXNcIl0gPSBhcmcuc3RhdHVzO1xyXG4gICAgICAgICAgICBlcnJvcltcInJlc3BvbnNlSlNPTlwiXSA9IGFyZy5yZXNwb25zZUpTT047XHJcbiAgICAgICAgICAgIHJldHVybiBlcnJvcjtcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICBleHBvcnQgY2xhc3MgUmVzdFN0b3JlIGV4dGVuZHMgRGV2RXhwcmVzcy5kYXRhLkN1c3RvbVN0b3JlIHtcclxuICAgICAgICBfYXBwbGljYXRpb246IElBcHBsaWNhdGlvbjtcclxuICAgICAgICBjb25zdHJ1Y3RvcihzdG9yZU9wdGlvbnM6IElSZXN0U3RvcmUsIGdsb2JhbE1vZGVsOiBhbnksIGFwcGxpY2F0aW9uOiBJQXBwbGljYXRpb24pIHtcclxuICAgICAgICAgICAgdmFyIGNvbXBpbGVkUHJvY2Vzc1Jlc3VsdCA9IHN0b3JlT3B0aW9ucy5sb2FkLnByb2Nlc3NSZXN1bHQgPyBhcHBsaWNhdGlvbi5jcmVhdGVGdW5jdGlvbkNvbXBpbGVyKHN0b3JlT3B0aW9ucy5sb2FkLnByb2Nlc3NSZXN1bHQpIDogbnVsbCxcclxuICAgICAgICAgICAgICAgIG9wdGlvbnMgPSAkLmV4dGVuZCh7fSwgc3RvcmVPcHRpb25zLCB7XHJcbiAgICAgICAgICAgICAgICBrZXk6IHN0b3JlT3B0aW9ucy5rZXksXHJcbiAgICAgICAgICAgICAgICBsb2FkOiAobG9hZE9wdGlvbnMpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgZCA9ICQuRGVmZXJyZWQoKTtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLmhhbmRsZXIoc3RvcmVPcHRpb25zLCBcImxvYWRcIiwgeyAkZ2xvYmFsOiBnbG9iYWxNb2RlbCwgJG9wdGlvbnM6IGxvYWRPcHRpb25zIH0sIFwiZ2V0XCIpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC5kb25lKGRhdGEgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYoY29tcGlsZWRQcm9jZXNzUmVzdWx0KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29tcGlsZWRQcm9jZXNzUmVzdWx0LnJ1bih7ICRnbG9iYWw6IGdsb2JhbE1vZGVsLCAkZGF0YTogZGF0YSB9LCB7IGNhbGxlcklkOiBcImxvYWQucHJvY2Vzc1Jlc3VsdFwiLCBjYWxsZXJUeXBlOiBcIlJlc3RTdG9yZVwiIH0pXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5kb25lKGRhdGEgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZC5yZXNvbHZlKGRhdGEpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuZmFpbChkLnJlamVjdCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGQucmVzb2x2ZShkYXRhKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgfSkuZmFpbChkLnJlamVjdCk7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGQucHJvbWlzZSgpO1xyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIGJ5S2V5OiAoa2V5KSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIGQgPSAkLkRlZmVycmVkKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5oYW5kbGVyKHN0b3JlT3B0aW9ucywgXCJieUtleVwiLCB7ICRnbG9iYWw6IGdsb2JhbE1vZGVsLCAka2V5OiBrZXkgfSwgXCJnZXRcIilcclxuICAgICAgICAgICAgICAgICAgICAgICAgLmRvbmUoZGF0YSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZihjb21waWxlZFByb2Nlc3NSZXN1bHQpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb21waWxlZFByb2Nlc3NSZXN1bHQucnVuKHsgJGdsb2JhbDogZ2xvYmFsTW9kZWwsICRkYXRhOiBkYXRhIH0sIHsgY2FsbGVySWQ6IFwiYnlLZXkucHJvY2Vzc1Jlc3VsdFwiLCBjYWxsZXJUeXBlOiBcIlJlc3RTdG9yZVwiIH0pXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5kb25lKGRhdGEgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZC5yZXNvbHZlKGRhdGEpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuZmFpbChkLnJlamVjdCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGQucmVzb2x2ZShkYXRhKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgfSkuZmFpbChkLnJlamVjdCk7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGQucHJvbWlzZSgpO1xyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIGluc2VydDogKHZhbHVlcykgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciBkID0gJC5EZWZlcnJlZCgpO1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuaGFuZGxlcihzdG9yZU9wdGlvbnMsIFwiaW5zZXJ0XCIsIHsgJGdsb2JhbDogZ2xvYmFsTW9kZWwsICRkYXRhOiB2YWx1ZXMgfSwgXCJwb3N0XCIpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC5kb25lKChkYXRhKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkLnJlc29sdmUodGhpcy5rZXlPZihkYXRhKSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC5mYWlsKGQucmVqZWN0KTtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZC5wcm9taXNlKCk7XHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgdXBkYXRlOiAoa2V5LCB2YWx1ZXMpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5oYW5kbGVyKHN0b3JlT3B0aW9ucywgXCJ1cGRhdGVcIiwgeyAkZ2xvYmFsOiBnbG9iYWxNb2RlbCwgJGtleToga2V5LCAkZGF0YTogdmFsdWVzIH0sIFwicGF0Y2hcIik7XHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgcmVtb3ZlOiAoa2V5KSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuaGFuZGxlcihzdG9yZU9wdGlvbnMsIFwicmVtb3ZlXCIsIHsgJGdsb2JhbDogZ2xvYmFsTW9kZWwsICRrZXk6IGtleSB9LCBcImRlbGV0ZVwiKTtcclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICB0b3RhbENvdW50OiAobG9hZE9wdGlvbnMpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5oYW5kbGVyKHN0b3JlT3B0aW9ucywgXCJ0b3RhbENvdW50XCIsIHsgJGdsb2JhbDogZ2xvYmFsTW9kZWwsICRvcHRpb25zOiBsb2FkT3B0aW9ucyB9LCBcImdldFwiKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIHN1cGVyKG9wdGlvbnMpO1xyXG4gICAgICAgICAgICB0aGlzLl9hcHBsaWNhdGlvbiA9IGFwcGxpY2F0aW9uO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgZXZhbChleHByOiBzdHJpbmcsIGNvbnRleHQ6IGFueSkge1xyXG4gICAgICAgICAgICBpZighZXhwcikge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICByZXR1cm4gTG9naWMuT3BlcmF0aW9uLmV2YWwoZXhwciwgY29udGV4dCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBwcml2YXRlIHRyYW5zZm9ybURhdGEoZGF0YTogYW55LCBtZXRob2Q6IHN0cmluZyk6IGFueSB7XHJcbiAgICAgICAgICAgIGlmKGRhdGEpIHtcclxuICAgICAgICAgICAgICAgIHN3aXRjaChtZXRob2QpIHtcclxuICAgICAgICAgICAgICAgICAgICBjYXNlIFwiZ2V0XCI6XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICQuZWFjaChkYXRhLChuYW1lLCB2YWwpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmKHZhbCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmKHZhbCBpbnN0YW5jZW9mIERhdGUpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0YVtuYW1lXSA9ICg8RGF0ZT52YWwpLnRvSVNPU3RyaW5nKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0YVtuYW1lXSA9IFwiXCIgKyB2YWw7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZWxldGUgZGF0YVtuYW1lXTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgICAgIGNhc2UgXCJwb3N0XCI6XHJcbiAgICAgICAgICAgICAgICAgICAgY2FzZSBcInBhdGNoXCI6XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGRhdGEgPSBKU09OLnN0cmluZ2lmeShkYXRhKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuIGRhdGE7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBoYW5kbGVyKHN0b3JlT3B0aW9uczogSVJlc3RTdG9yZSwgbmFtZTogc3RyaW5nLCBjb250ZXh0OiBhbnksIGRlZmF1bHRNZXRob2Q6IHN0cmluZykge1xyXG4gICAgICAgICAgICB2YXIgb3B0aW9ucyA9IHN0b3JlT3B0aW9uc1tuYW1lXSxcclxuICAgICAgICAgICAgICAgIHVybCwgbWV0aG9kLCBkYXRhO1xyXG4gICAgICAgICAgICBpZighb3B0aW9ucyB8fCAhb3B0aW9ucy51cmxFeHByKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gTG9naWMucmVqZWN0UHJvbWlzZShcIk5vIFwiICsgbmFtZSArIFwiIHVybCBzcGVjaWZpZWRcIik7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgdXJsID0gdGhpcy5nZXRVcmwob3B0aW9ucywgY29udGV4dCk7XHJcbiAgICAgICAgICAgIC8vVE9ETzogcmV3cml0ZSBhZnRlciByZWZhY3RvcmluZyBmdW5jdGlvbkNvbXBpbGxlclxyXG4gICAgICAgICAgICAvL2NvbnRleHQuZGF0YSA9IGNvbnRleHQuJG9wdGlvbnM7XHJcbiAgICAgICAgICAgIG1ldGhvZCA9IG9wdGlvbnMubWV0aG9kIHx8IGRlZmF1bHRNZXRob2Q7XHJcblxyXG4gICAgICAgICAgICAvL1RPRE86IHJld3JpdGUgYWZ0ZXIgcmVmYWN0b3JpbmcgZnVuY3Rpb25Db21waWxsZXJcclxuICAgICAgICAgICAgaWYoIW9wdGlvbnMuZ2V0QWpheERhdGEpIHtcclxuICAgICAgICAgICAgICAgIGRhdGEgPSB7fTtcclxuICAgICAgICAgICAgICAgIHJldHVybiBzZW5kUmVxdWVzdCh1cmwsIG1ldGhvZCwgZGF0YSwgb3B0aW9uc1tcImRhdGFUeXBlXCJdLCBzdG9yZU9wdGlvbnMuaGVhZGVycyk7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgZnVuY0JvZHkgPSBvcHRpb25zLmdldEFqYXhEYXRhLFxyXG4gICAgICAgICAgICAgICAgIHJlc3VsdCA9ICQuRGVmZXJyZWQoKTtcclxuICAgICAgICAgICAgICAgIHRoaXMuX2FwcGxpY2F0aW9uLmNyZWF0ZUZ1bmN0aW9uQ29tcGlsZXIoZnVuY0JvZHkpXHJcbiAgICAgICAgICAgICAgICAgICAgLnJ1bihjb250ZXh0KVxyXG4gICAgICAgICAgICAgICAgICAgIC5kb25lKChkYXRhKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIHREYXRhID0gdGhpcy50cmFuc2Zvcm1EYXRhKHRoaXMuZXZhbChKU09OLnN0cmluZ2lmeShkYXRhKSwgY29udGV4dCkgLCBtZXRob2QpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBzZW5kUmVxdWVzdCh1cmwsIG1ldGhvZCwgdERhdGEsIG9wdGlvbnNbXCJkYXRhVHlwZVwiXSwgc3RvcmVPcHRpb25zLmhlYWRlcnMpLmRvbmUoKGRhdGEpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc3VsdC5yZXNvbHZlKGRhdGEpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9KS5mYWlsKCgpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc3VsdC5yZWplY3QoKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfSkuZmFpbCgoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc3VsdC5yZWplY3QoKTtcclxuICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgIHJldHVybiByZXN1bHQucHJvbWlzZSgpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBnZXRVcmwob3B0aW9ucywgY29udGV4dCkge1xyXG4gICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuZXZhbChvcHRpb25zLmRlYnVnVXJsRXhwciB8fCBvcHRpb25zLnVybEV4cHIsIGNvbnRleHQpO1xyXG4gICAgICAgICAgICB9IGNhdGNoKGUpIHtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoZSk7XHJcbiAgICAgICAgICAgICAgICB0aHJvdyBlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59XHJcbiIsIm1vZHVsZSBBcHBQbGF5ZXIge1xyXG4gICAgXCJ1c2Ugc3RyaWN0XCI7XHJcblxyXG4gICAgaW1wb3J0IGR4ZGF0YSA9IERldkV4cHJlc3MuZGF0YTtcclxuXHJcbiAgICBleHBvcnQgY2xhc3MgQXJyYXlTdG9yZSBleHRlbmRzIGR4ZGF0YS5BcnJheVN0b3JlIHtcclxuICAgICAgICBjb25zdHJ1Y3RvcihzdG9yZU9wdGlvbnM6IGR4ZGF0YS5BcnJheVN0b3JlT3B0aW9ucykge1xyXG4gICAgICAgICAgICBzdXBlcihzdG9yZU9wdGlvbnMpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgYnlLZXkoa2V5OiBhbnksIGV4dHJhT3B0aW9uczogYW55KTogSlF1ZXJ5UHJvbWlzZTxhbnk+IHtcclxuICAgICAgICAgICAgcmV0dXJuIHN1cGVyLmJ5S2V5KGtleSwgZXh0cmFPcHRpb25zKVxyXG4gICAgICAgICAgICAgICAgLnRoZW4oKHZhbHVlOiBhbnkpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICBpZih2YWx1ZSBpbnN0YW5jZW9mIE9iamVjdCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gJC5leHRlbmQoe30sIHZhbHVlKTtcclxuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdmFsdWU7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBsb2FkKG9iaj86IGR4ZGF0YS5Mb2FkT3B0aW9ucyk6IEpRdWVyeVByb21pc2U8YW55W10+IHtcclxuICAgICAgICAgICAgcmV0dXJuIHN1cGVyLmxvYWQob2JqKVxyXG4gICAgICAgICAgICAgICAgLnRoZW4oKHZhbHVlOiBhbnlbXSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIGlmKHZhbHVlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICQuZWFjaCh2YWx1ZSwobmFtZSwgdmFsKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZih2YWwgaW5zdGFuY2VvZiBPYmplY3QpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZVtuYW1lXSA9ICQuZXh0ZW5kKHt9LCB2YWwpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHZhbHVlO1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59ICIsIm1vZHVsZSBBcHBQbGF5ZXIge1xyXG4gICAgXCJ1c2Ugc3RyaWN0XCI7XHJcblxyXG4gICAgdmFyIERYRXJyb3IgPSBEZXZFeHByZXNzW1wiRXJyb3JcIl07XHJcbiAgICBmdW5jdGlvbiBpc0N5Y2xpYyhvYmopIHtcclxuICAgICAgICB2YXIgc2Vlbk9iamVjdHMgPSBbXTtcclxuXHJcbiAgICAgICAgZnVuY3Rpb24gZGV0ZWN0KG9iaikge1xyXG4gICAgICAgICAgICBpZihvYmogJiYgdHlwZW9mIG9iaiA9PT0gXCJvYmplY3RcIikge1xyXG4gICAgICAgICAgICAgICAgaWYoc2Vlbk9iamVjdHMuaW5kZXhPZihvYmopICE9PSAtMSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgc2Vlbk9iamVjdHMucHVzaChvYmopO1xyXG4gICAgICAgICAgICAgICAgZm9yKHZhciBrZXkgaW4gb2JqKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYob2JqLmhhc093blByb3BlcnR5KGtleSkgJiYgZGV0ZWN0KG9ialtrZXldKSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhvYmosIFwiY3ljbGUgYXQgXCIgKyBrZXkpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmV0dXJuIGRldGVjdChvYmopO1xyXG4gICAgfVxyXG4gICAgZXhwb3J0IGNsYXNzIEpzb25TdG9yZSBleHRlbmRzIERldkV4cHJlc3MuZGF0YS5DdXN0b21TdG9yZSB7XHJcbiAgICAgICAgc3RhdGljIGNhY2hlID0ge307XHJcbiAgICAgICAgY29uc3RydWN0b3Ioc3RvcmVPcHRpb25zOiBJSnNvblN0b3JlLCAkZ2xvYmFsID0gbnVsbCkge1xyXG4gICAgICAgICAgICB2YXIgY2FjaGVLZXkgPSBzdG9yZU9wdGlvbnMuanNvblBhdGggKyBzdG9yZU9wdGlvbnMudXJsLFxyXG4gICAgICAgICAgICAgICAgbG9hZCA9IChvcHRpb25zPzogRGV2RXhwcmVzcy5kYXRhLkxvYWRPcHRpb25zKTogYW55ID0+IHtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgZCA9ICQuRGVmZXJyZWQoKSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmVxdWVzdE9wdGlvbnMgPSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB1cmw6IHN0b3JlT3B0aW9ucy51cmwsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkYXRhVHlwZTogXCJqc29uXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkYXRhOiB7IHBhdGg6IHN0b3JlT3B0aW9ucy5qc29uUGF0aCB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhY2hlZERhdGEgPSBKc29uU3RvcmUuY2FjaGVbY2FjaGVLZXldO1xyXG4gICAgICAgICAgICAgICAgICAgIGFkZEhlYWRlcnMoc3RvcmVPcHRpb25zLmhlYWRlcnMpKHJlcXVlc3RPcHRpb25zKTtcclxuICAgICAgICAgICAgICAgICAgICBpZihjYWNoZWREYXRhKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlcXVlc3RPcHRpb25zW1wiaGVhZGVyc1wiXSA9IHsgXCJJZi1Ob25lLU1hdGNoXCI6IGNhY2hlZERhdGEudGFnIH07XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICQuYWpheChyZXF1ZXN0T3B0aW9ucykudGhlbigoZGF0YSwgdGVzdFN0YXR1cywgcmVxdWVzdCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgcmVzdWx0aW5nRGF0YSA9IGRhdGE7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmKHJlcXVlc3Quc3RhdHVzID09PSAyMDApIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIEpzb25TdG9yZS5jYWNoZVtjYWNoZUtleV0gPSB7IGRhdGE6IGRhdGEsIHRhZzogcmVxdWVzdC5nZXRSZXNwb25zZUhlYWRlcihcIkVUYWdcIikgfTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBlbHNlIGlmKHJlcXVlc3Quc3RhdHVzID09PSAzMDQpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc3VsdGluZ0RhdGEgPSBjYWNoZWREYXRhLmRhdGE7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgZC5yZXNvbHZlKHJlc3VsdGluZ0RhdGEpO1xyXG4gICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBkLnByb21pc2UoKTtcclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICBwb3N0ID0gKGRhdGEsIGtleU5hbWUsIGtleVZhbHVlKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIHJlcXVlc3RPcHRpb25zID0ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB1cmw6IHN0b3JlT3B0aW9ucy51cmwsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGRhdGE6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGpzb246IEpTT04uc3RyaW5naWZ5KGRhdGEpLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcGF0aDogc3RvcmVPcHRpb25zLmpzb25QYXRoLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAga2V5TmFtZToga2V5TmFtZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGtleVZhbHVlOiBrZXlWYWx1ZVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBtZXRob2Q6IFwiUE9TVFwiXHJcbiAgICAgICAgICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgICAgICAgICBhZGRIZWFkZXJzKHN0b3JlT3B0aW9ucy5oZWFkZXJzKShyZXF1ZXN0T3B0aW9ucyk7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuICQuYWpheChyZXF1ZXN0T3B0aW9ucyk7XHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAga2V5UHJlZml4ID0gc3RvcmVPcHRpb25zLmtleVByZWZpeDtcclxuXHJcbiAgICAgICAgICAgIGlmKCFrZXlQcmVmaXgpIHtcclxuICAgICAgICAgICAgICAgIGtleVByZWZpeCA9IHN0b3JlT3B0aW9ucy5pZDtcclxuICAgICAgICAgICAgICAgIGlmKGVuZHNXaXRoKGtleVByZWZpeCwgXCJzXCIpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAga2V5UHJlZml4ID0ga2V5UHJlZml4LnN1YnN0cmluZygwLCBrZXlQcmVmaXgubGVuZ3RoIC0gMSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICQuZXh0ZW5kKHN0b3JlT3B0aW9ucywge1xyXG4gICAgICAgICAgICAgICAgdG90YWxDb3VudDogKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBsb2FkKCkudGhlbigocmVzdWx0KSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBMb2dpYy50cml2aWFsUHJvbWlzZShyZXN1bHQgPyByZXN1bHQubGVuZ3RoIDogMCk7XHJcbiAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgbG9hZDogbG9hZCxcclxuICAgICAgICAgICAgICAgIGJ5S2V5OiAoa2V5KSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIHRoYXQgPSB0aGlzO1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBsb2FkKClcclxuICAgICAgICAgICAgICAgICAgICAgICAgLnRoZW4oKGl0ZW1zOiBhbnlbXSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZpbmRJbkFycmF5KGl0ZW1zLCBpdGVtID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gaXRlbVt0aGF0LmtleSgpXSA9PT0ga2V5O1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIHVwZGF0ZTogKGtleTogYW55LCB2YWx1ZXM6IGFueSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciBkID0gJC5EZWZlcnJlZCgpO1xyXG4gICAgICAgICAgICAgICAgICAgIGlzQ3ljbGljKHZhbHVlcyk7XHJcbiAgICAgICAgICAgICAgICAgICAgcG9zdCh2YWx1ZXMsIHRoaXMua2V5KCksIGtleSkudGhlbigoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGQucmVzb2x2ZSgpO1xyXG4gICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBkLnByb21pc2UoKTtcclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICBpbnNlcnQ6ICh2YWx1ZXM6IGFueSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciB0aGF0ID0gdGhpcyxcclxuICAgICAgICAgICAgICAgICAgICAgICAga2V5RXhwciA9IHRoaXMua2V5KCksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGtleVZhbHVlLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBkID0gJC5EZWZlcnJlZCgpO1xyXG4gICAgICAgICAgICAgICAgICAgICQuZ2V0SlNPTihzdG9yZU9wdGlvbnMudXJsKS50aGVuKChkYXRhKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBnZXR0ZXIgPSBjb21waWxlR2V0dGVyKHN0b3JlT3B0aW9ucy5qc29uUGF0aCksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZXR0ZXIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhcnJheSA9IDxhbnlbXT5nZXR0ZXIoZGF0YSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmKCFhcnJheSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYXJyYXkgPSBbXTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNldHRlciA9IGNvbXBpbGVTZXR0ZXIoc3RvcmVPcHRpb25zLmpzb25QYXRoKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNldHRlcihkYXRhLCBhcnJheSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYoa2V5RXhwcikge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAga2V5VmFsdWUgPSB0aGlzLmtleU9mKHZhbHVlcyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZigha2V5VmFsdWUgfHwgKHR5cGVvZiBrZXlWYWx1ZSA9PT0gXCJvYmplY3RcIiAmJiAkLmlzRW1wdHlPYmplY3Qoa2V5VmFsdWUpKSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmKCQuaXNBcnJheShrZXlFeHByKSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkLnJlamVjdChEWEVycm9yKFwiRTQwMDdcIikpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgbWF4S2V5TnVtID0gMDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhcnJheS5mb3JFYWNoKChpdGVtKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBrZXk6IHN0cmluZyA9IHRoaXMua2V5T2YoaXRlbSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmKCFzdGFydHNXaXRoKGtleSwga2V5UHJlZml4KSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIga2V5TnVtID0gcGFyc2VJbnQoa2V5LnN1YnN0cihrZXlQcmVmaXgubGVuZ3RoKSwgMTApO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYoa2V5TnVtID4gbWF4S2V5TnVtKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWF4S2V5TnVtID0ga2V5TnVtO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGNhdGNoKGUpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGtleVZhbHVlID0gdmFsdWVzW2tleUV4cHJdID0ga2V5UHJlZml4ICsgKG1heEtleU51bSArIDEpO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgY29udGV4dCA9IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJGtleToga2V5VmFsdWUsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICRnbG9iYWw6ICRnbG9iYWxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIChzdG9yZU9wdGlvbnMuZmllbGRzIHx8IFtdKS5mb3JFYWNoKGZpZWxkID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYoIXZhbHVlc1tmaWVsZC5uYW1lXSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYodHlwZW9mIGZpZWxkLmRlZmF1bHRWYWx1ZUV4cHIgPT09IFwic3RyaW5nXCIpIHsgLy8gVE9ETyBTdGF0c2Vua286IHJlZmFjdG9yaW5nXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGRlZmF1bHRWYWx1ZSA9IExvZ2ljLk9wZXJhdGlvbi5ldmFsKGZpZWxkLmRlZmF1bHRWYWx1ZUV4cHIsIGNvbnRleHQpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlc1tmaWVsZC5uYW1lXSA9IGRlZmF1bHRWYWx1ZTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZihmaW5kSW5BcnJheShhcnJheSwgcCA9PiBwLmlkID09PSBrZXlWYWx1ZSkpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkLnJlamVjdChEWEVycm9yKFwiRTQwMDhcIikpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAga2V5VmFsdWUgPSB2YWx1ZXM7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgYXJyYXkucHVzaCh2YWx1ZXMpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBwb3N0KHZhbHVlcywgdGhhdC5rZXkoKSwga2V5VmFsdWUpLnRoZW4oKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZC5yZXNvbHZlKGtleVZhbHVlKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVycm9yID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkLnJlamVjdChlcnJvcik7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZC5wcm9taXNlKCk7XHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgcmVtb3ZlOiAoa2V5OiBzdHJpbmcpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgdGhhdCA9IHRoaXMsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc3VsdCA9ICQuRGVmZXJyZWQoKSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgc3RvcmVVcmwgPSBzdG9yZU9wdGlvbnMudXJsLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBrZXlFeHByID0gc3RvcmVPcHRpb25zLmtleTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgJC5nZXRKU09OKHN0b3JlVXJsKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAudGhlbihkYXRhID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBnZXR0ZXIgPSBjb21waWxlR2V0dGVyKHN0b3JlT3B0aW9ucy5qc29uUGF0aCksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYXJyYXkgPSBnZXR0ZXIoZGF0YSkgfHwgW10sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaW5kZXggPSBpbmRleEluQXJyYXkoYXJyYXksIGl0ZW0gPT4gaXRlbVtrZXlFeHByXSA9PT0ga2V5KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmKGluZGV4ICE9PSAtMSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFycmF5LnNwbGljZShpbmRleCwgMSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwb3N0KG51bGwsIHRoYXQua2V5KCksIGtleSkudGhlbigoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzdWx0LnJlc29sdmUoKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZXJyb3IgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXN1bHQucmVqZWN0KGVycm9yKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVycm9yID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXN1bHQucmVqZWN0KGVycm9yKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiByZXN1bHQucHJvbWlzZSgpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgc3VwZXIoc3RvcmVPcHRpb25zKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbn0iLCIvLy8gPHJlZmVyZW5jZSBwYXRoPVwic3RvcmVzL29kYXRhc3RvcmUudHNcIiAvPlxyXG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwic3RvcmVzL3Jlc3RzdG9yZS50c1wiIC8+XHJcbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCJzdG9yZXMvYXJyYXlzdG9yZS50c1wiIC8+XHJcbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCJzdG9yZXMvZGVzaWduZXJzdG9yZS50c1wiIC8+XHJcbm1vZHVsZSBBcHBQbGF5ZXIge1xyXG4gICAgXCJ1c2Ugc3RyaWN0XCI7XHJcblxyXG4gICAgaW1wb3J0IGR4aHRtbCA9IERldkV4cHJlc3MuZnJhbWV3b3JrLmh0bWw7XHJcbiAgICBpbXBvcnQgZHhkYXRhID0gRGV2RXhwcmVzcy5kYXRhO1xyXG4gICAgaW1wb3J0IGR4ZiA9IERldkV4cHJlc3MuZnJhbWV3b3JrO1xyXG4gICAgaW1wb3J0IGR4ID0gRGV2RXhwcmVzcztcclxuICAgIGltcG9ydCBhcGwgPSBBcHBQbGF5ZXIuTG9naWM7XHJcbiAgICB2YXIgZHhjb25zb2xlID0gRGV2RXhwcmVzcy5yZXF1aXJlKFwiL3V0aWxzL3V0aWxzLmNvbnNvbGVcIik7XHJcblxyXG4gICAgZXhwb3J0IGludGVyZmFjZSBJRnVuY3Rpb25zIHsgW2tleTogc3RyaW5nXTogKC4uLmFyZ3M6IGFueVtdKSA9PiBhbnk7IH1cclxuXHJcbiAgICBleHBvcnQgaW50ZXJmYWNlIElSdW5Db250ZXh0IGV4dGVuZHMgQW55SW5kZXhlciB7XHJcbiAgICAgICAgJGRhdGE/OiB7fTsgICAgICAgICAgLy8gQ3VycmVudCByZWNvcmQgaW4gYSBsaXN0IG9yIGRhdGFzb3VyY2VcclxuICAgICAgICAkbW9kZWw/OiB7fTsgICAgICAgICAvLyBDdXJyZW50IHZpZXcgbW9kZWxcclxuICAgICAgICAkZ2xvYmFsPzoge307ICAgICAgICAvLyBBcHBsaWNhdGlvbiBtb2RlbFxyXG4gICAgICAgICR2YWx1ZT86IHt9OyAgICAgICAgIC8vIE5ldyB2YWx1ZSBpbiBzZXR0ZXJcclxuICAgIH1cclxuXHJcbiAgICBleHBvcnQgaW50ZXJmYWNlIElGdW5jdGlvbkNvbXBpbGVyIHtcclxuICAgICAgICBydW4oY29udGV4dD86IElSdW5Db250ZXh0LCBjYWxsZXJJbmZvPzogYXBsLklDYWxsZXJJbmZvKTogSlF1ZXJ5UHJvbWlzZTxhbnk+O1xyXG4gICAgfVxyXG4gICAgZXhwb3J0IGludGVyZmFjZSBJQXBwbGljYXRpb24ge1xyXG4gICAgICAgIGlkOiBzdHJpbmc7XHJcbiAgICAgICAgbmF2aWdhdGVUb0RlZmF1bHRWaWV3KCk6IHZvaWQ7XHJcbiAgICAgICAgb24oZXZlbnROYW1lOiBzdHJpbmcsIGhhbmRsZXI6IChlOiBhbnkpID0+IHZvaWQpO1xyXG4gICAgICAgIG9mZihldmVudE5hbWU6IHN0cmluZywgaGFuZGxlcj86IEZ1bmN0aW9uKTtcclxuICAgICAgICBuYXZpZ2F0ZSh1cmk/OiBhbnksIG9wdGlvbnM/OiB7fSk7XHJcbiAgICAgICAgc3RvcmVzOiB7IFtrZXk6IHN0cmluZ106IERldkV4cHJlc3MuZGF0YS5TdG9yZSB9O1xyXG4gICAgICAgIGNyZWF0ZUZ1bmN0aW9uQ29tcGlsZXIoY29kZTogYW55KTogSUZ1bmN0aW9uQ29tcGlsZXI7XHJcbiAgICAgICAgZnVuY3Rpb25zPzogSUZ1bmN0aW9ucztcclxuICAgICAgICBhdXRob3JpemF0aW9uOiBNb2R1bGVzLkF1dGhvcml6YXRpb247XHJcbiAgICAgICAgdHlwZUluZm9SZXBvc2l0b3J5PzogVHlwZUluZm9SZXBvc2l0b3J5O1xyXG4gICAgICAgIG9wdGlvbnM6IElBcHBsaWNhdGlvbk9wdGlvbnM7XHJcbiAgICAgICAgbW9kZWw6IGFueTtcclxuICAgICAgICBzaGFyZWRPYmplY3RzOiB7IFtrZXk6IHN0cmluZ106IGFueSB9O1xyXG4gICAgICAgIHJlZ2lzdGVyTWlzc2luZ1RlbXBsYXRlOiAoY29tcG9uZW50VHlwZTogc3RyaW5nKSA9PiBhbnk7XHJcbiAgICAgICAgdGVtcGxhdGVJc01pc3Npbmc6IChjb21wb25lbnRUeXBlOiBzdHJpbmcpID0+IGJvb2xlYW47XHJcbiAgICAgICAgbG9jYWxTdG9yYWdlOiBJTW9kZWxQcm9wZXJ0eVN0b3JhZ2U7XHJcbiAgICAgICAgcHJvY2Vzc1BhcmFtZXRlckxvYWRpbmdFcnJvcjogKG5hbWU6IHN0cmluZywgaWQ6IGFueSkgPT4gdm9pZDtcclxuICAgICAgICByZW1vdmVWaWV3Q2FjaGU/KGtleTogc3RyaW5nKTogdm9pZDtcclxuICAgICAgICB2aWV3Q2FjaGVLZXk/KCk6IHN0cmluZztcclxuICAgIH1cclxuXHJcbiAgICBleHBvcnQgaW50ZXJmYWNlIElBcHBsaWNhdGlvbk9wdGlvbnMge1xyXG4gICAgICAgIGJhc2VVcmw6IHN0cmluZztcclxuICAgIH1cclxuXHJcbiAgICBleHBvcnQgaW50ZXJmYWNlIElNb2RlbFByb3BlcnR5U3RvcmFnZSB7XHJcbiAgICAgICAgcHV0KG1vZGVsSWQ6IHN0cmluZywgaWQ6IHN0cmluZywgdmFsOiBhbnkpO1xyXG4gICAgICAgIGdldChtb2RlbElkOiBzdHJpbmcsIGlkOiBzdHJpbmcpO1xyXG4gICAgICAgIGdldEtleShtb2RlbElkOiBzdHJpbmcsIGlkOiBzdHJpbmcpO1xyXG4gICAgfVxyXG5cclxuICAgIGV4cG9ydCBjbGFzcyBBcHBsaWNhdGlvbiBpbXBsZW1lbnRzIElBcHBsaWNhdGlvbiB7XHJcbiAgICAgICAgcHVibGljIHN0YXRpYyBnZXQgU1BMSVRfTkFWX1ZJRVdfSUQoKSB7IHJldHVybiBcInNwbGl0TmF2aWdhdGlvblwiOyB9XHJcbiAgICAgICAgcHVibGljIHN0YXRpYyBnZXQgU0hBUkVEX1BBUkFNRVRFUigpIHsgcmV0dXJuIFwieGV0LXNoYXJlZC1vYmplY3RcIjsgfVxyXG5cclxuICAgICAgICBpZDogc3RyaW5nO1xyXG4gICAgICAgIGFwcENvbmZpZzogSUFwcENvbmZpZztcclxuICAgICAgICBzdG9yZXM6IHsgW2tleTogc3RyaW5nXTogRGV2RXhwcmVzcy5kYXRhLlN0b3JlIH07XHJcbiAgICAgICAgbnM6IGFueTtcclxuICAgICAgICBmdW5jdGlvbnM6IHsgW2tleTogc3RyaW5nXTogKC4uLmFyZ3M6IGFueVtdKSA9PiBhbnkgfTtcclxuICAgICAgICBvcHRpb25zOiBJQXBwbGljYXRpb25PcHRpb25zO1xyXG4gICAgICAgIG1vZGVsOiBhbnk7XHJcbiAgICAgICAgc2hhcmVkT2JqZWN0czogeyBba2V5OiBzdHJpbmddOiBhbnkgfSA9IHt9O1xyXG4gICAgICAgIHR5cGVJbmZvUmVwb3NpdG9yeTogVHlwZUluZm9SZXBvc2l0b3J5O1xyXG4gICAgICAgIGF1dGhvcml6YXRpb246IE1vZHVsZXMuQXV0aG9yaXphdGlvbjtcclxuICAgICAgICBsb2NhbFN0b3JhZ2U6IElNb2RlbFByb3BlcnR5U3RvcmFnZTtcclxuICAgICAgICBwcml2YXRlIHN0YXJ0ZWQgPSAkLkNhbGxiYWNrcygpO1xyXG4gICAgICAgIHByaXZhdGUgZGF0YUVycm9yID0gJC5DYWxsYmFja3MoKTtcclxuICAgICAgICBwcml2YXRlIHN0YXRpYyBtaXNzaW5nVGVtcGxhdGVzOiBzdHJpbmdbXSA9IFtdO1xyXG4gICAgICAgIHByaXZhdGUgZGVmYXVsdFZpZXc6IHN0cmluZztcclxuICAgICAgICBwcml2YXRlIGR4YXBwOiBkeGh0bWwuSHRtbEFwcGxpY2F0aW9uO1xyXG5cclxuICAgICAgICBjb25zdHJ1Y3RvcihhcHBDb25maWc6IElBcHBDb25maWcsIG9wdGlvbnM/OiBJQXBwbGljYXRpb25PcHRpb25zKSB7XHJcbiAgICAgICAgICAgIHRoaXMuc2V0QXBwQ29uZmlnKGFwcENvbmZpZyk7XHJcbiAgICAgICAgICAgIHRoaXMuaWQgPSBhcHBDb25maWcuaWQ7XHJcbiAgICAgICAgICAgIHRoaXMubG9jYWxTdG9yYWdlID0gbmV3IExvY2FsU3RvcmFnZVdyYXBwZXIodGhpcyk7XHJcbiAgICAgICAgICAgIHRoaXMub3B0aW9ucyA9IG9wdGlvbnM7XHJcbiAgICAgICAgICAgIHRoaXMubnMgPSB7fTtcclxuICAgICAgICAgICAgdGhpcy5hcHBDb25maWcubmF2aWdhdGlvbiA9IGFwcENvbmZpZy5uYXZpZ2F0aW9uIHx8IHsgZGVmYXVsdFZpZXc6IFwiXCIsIGl0ZW1zOiBbXSB9O1xyXG4gICAgICAgICAgICB0aGlzLmZ1bmN0aW9ucyA9IHRoaXMuY3JlYXRlR2xvYmFsRnVuY3Rpb25zKCk7XHJcbiAgICAgICAgICAgIHRoaXMuYXBwQ29uZmlnLnBhcmFtcyA9IHRoaXMuYXBwQ29uZmlnLnBhcmFtcyB8fCBbXTtcclxuICAgICAgICAgICAgdGhpcy5hcHBDb25maWcubW9kZWwgPSB0aGlzLmFwcENvbmZpZy5tb2RlbCB8fCBbXTtcclxuICAgICAgICAgICAgdGhpcy5tb2RlbCA9IE1vZGVsLmNyZWF0ZUFwcE1vZGVsKHRoaXMuYXBwQ29uZmlnLCB0aGlzKTtcclxuICAgICAgICAgICAgdGhpcy5zZXRNb2RlbFZhbHVlRnJvbVBhcmFtZXRlcigpO1xyXG4gICAgICAgICAgICB0aGlzLmxvYWROYXZpZ2F0aW9uKCk7XHJcbiAgICAgICAgICAgIHRoaXMuY29weUdsb2JhbENvbW1hbmRzKCk7XHJcbiAgICAgICAgICAgIHRoaXMuY3JlYXRlU3RvcmVzKCk7XHJcbiAgICAgICAgICAgIE1vZGVsLmluaXRpYWxpemVEYXRhU291cmNlcyh0aGlzLm1vZGVsLCB7ICRtb2RlbDogdGhpcy5tb2RlbCwgJGdsb2JhbDogdGhpcy5tb2RlbCB9LCB0aGlzLCB0aGlzLnN0b3JlcywgZmFsc2UsIHRoaXMuYXBwQ29uZmlnLmRhdGFTb3VyY2VzKTtcclxuICAgICAgICAgICAgdGhpcy50eXBlSW5mb1JlcG9zaXRvcnkgPSBuZXcgVHlwZUluZm9SZXBvc2l0b3J5KGFwcENvbmZpZy5kYXRhU3RvcmVzKTtcclxuICAgICAgICAgICAgaWYodGhpcy5tb2RlbC5oYXNPd25Qcm9wZXJ0eShcInRpdGxlXCIpKSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgdGl0bGVPYnNlcnZlciA9IGtvLmNvbXB1dGVkKCgpID0+IHRoaXMubW9kZWxbXCJ0aXRsZVwiXSk7XHJcbiAgICAgICAgICAgICAgICB2YXIgZm9ybWF0VGl0bGU7XHJcbiAgICAgICAgICAgICAgICBpZih0aGlzLmlkID09PSBcImNvbS5kZXZleHByZXNzLlhlbmFyaXVzLkRlc2lnbmVyXCIpIHtcclxuICAgICAgICAgICAgICAgICAgICBmb3JtYXRUaXRsZSA9ICgpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYodGl0bGVPYnNlcnZlcigpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkb2N1bWVudC50aXRsZSA9IHRpdGxlT2JzZXJ2ZXIoKSArIFwiIC0gWGVuYXJpdXMgQWRtaW5cIjtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRvY3VtZW50LnRpdGxlID0gXCJYZW5hcml1cyBBZG1pblwiO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgZm9ybWF0VGl0bGUgPSAoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGRvY3VtZW50LnRpdGxlID0gdGl0bGVPYnNlcnZlcigpO1xyXG4gICAgICAgICAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB0aXRsZU9ic2VydmVyLnN1YnNjcmliZShmb3JtYXRUaXRsZSk7XHJcbiAgICAgICAgICAgICAgICBmb3JtYXRUaXRsZSgpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHByaXZhdGUgc2V0QXBwQ29uZmlnKGFwcENvbmZpZzogSUFwcENvbmZpZykge1xyXG4gICAgICAgICAgICB0aGlzLmFwcENvbmZpZyA9IGFwcENvbmZpZztcclxuICAgICAgICAgICAgdGhpcy5hcHBDb25maWcucGxhdGZvcm1zID0gdGhpcy5hcHBDb25maWcucGxhdGZvcm1zIHx8IFtcclxuICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICBuYW1lOiBcIkRlc2t0b3BSdWxlXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgbGF5b3V0OiBcImRlc2t0b3BcIixcclxuICAgICAgICAgICAgICAgICAgICBkZWZhdWx0Q29tbWFuZENvbnRhaW5lcjogXCJoZWFkZXJcIixcclxuICAgICAgICAgICAgICAgICAgICBkZWZhdWx0Q29tbWFuZExvY2F0aW9uOiBcImFmdGVyXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgb3B0aW9uczoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBnZW5lcmljOiB0cnVlXHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICBuYW1lOiBcIlBob25lUnVsZVwiLFxyXG4gICAgICAgICAgICAgICAgICAgIGxheW91dDogXCJzbGlkZW91dFwiLFxyXG4gICAgICAgICAgICAgICAgICAgIGRlZmF1bHRDb21tYW5kQ29udGFpbmVyOiBcImhlYWRlclwiLFxyXG4gICAgICAgICAgICAgICAgICAgIGRlZmF1bHRDb21tYW5kTG9jYXRpb246IFwiYWZ0ZXJcIixcclxuICAgICAgICAgICAgICAgICAgICBvcHRpb25zOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHBob25lOiB0cnVlXHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICBuYW1lOiBcIlRhYmxldFJ1bGVcIixcclxuICAgICAgICAgICAgICAgICAgICBsYXlvdXQ6IFwic3BsaXRcIixcclxuICAgICAgICAgICAgICAgICAgICBkZWZhdWx0Q29tbWFuZENvbnRhaW5lcjogXCJoZWFkZXJcIixcclxuICAgICAgICAgICAgICAgICAgICBkZWZhdWx0Q29tbWFuZExvY2F0aW9uOiBcImFmdGVyXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgb3B0aW9uczoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0YWJsZXQ6IHRydWVcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIF07XHJcbiAgICAgICAgICAgIHRoaXMuYXBwQ29uZmlnLnZpZXdzID0gdGhpcy5hcHBDb25maWcudmlld3MgfHwgW107XHJcbiAgICAgICAgICAgIHRoaXMuYXBwQ29uZmlnLnZpZXdzLmZvckVhY2godmlldyA9PiB7XHJcbiAgICAgICAgICAgICAgICAodmlldy5jb21tYW5kcyB8fCBbXSkuZm9yRWFjaChjb21tYW5kID0+IHtcclxuICAgICAgICAgICAgICAgICAgICBjb21tYW5kLmlkID0gdmlldy5pZCArIFwiX1wiICsgY29tbWFuZC5pZDtcclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcHJpdmF0ZSBpc1NwbGl0TGF5b3V0KCk6IGJvb2xlYW4ge1xyXG4gICAgICAgICAgICB2YXIgY3VycmVudERldmljZSA9IERldkV4cHJlc3MuZGV2aWNlcy5jdXJyZW50KCksXHJcbiAgICAgICAgICAgICAgICBjdXJyZW50UGxhdGZvcm0gPSBMYXlvdXRIZWxwZXIudHJ5R2V0Q3VycmVudFBsYXRmb3JtKHRoaXMuYXBwQ29uZmlnLnBsYXRmb3JtcywgY3VycmVudERldmljZSksXHJcbiAgICAgICAgICAgICAgICB1c2VzU3BsaXRMYXlvdXQgPSBjdXJyZW50UGxhdGZvcm0gJiYgY3VycmVudFBsYXRmb3JtLmxheW91dCA9PT0gXCJzcGxpdFwiO1xyXG4gICAgICAgICAgICByZXR1cm4gdXNlc1NwbGl0TGF5b3V0O1xyXG4gICAgICAgIH1cclxuICAgICAgICBwcml2YXRlIHNldE1vZGVsVmFsdWVGcm9tUGFyYW1ldGVyKCkge1xyXG4gICAgICAgICAgICB0aGlzLmFwcENvbmZpZy5wYXJhbXMuZm9yRWFjaCgocGFyYW1ldGVyKSA9PiB7XHJcbiAgICAgICAgICAgICAgICB2YXIgdmFsID0gZ2V0UXVlcnlWYXJpYWJsZShwYXJhbWV0ZXIubmFtZSk7XHJcbiAgICAgICAgICAgICAgICBpZih2YWwpIHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLm1vZGVsW3BhcmFtZXRlci5uYW1lXSA9IHZhbDtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHByaXZhdGUgbG9hZE5hdmlnYXRpb24oKSB7XHJcbiAgICAgICAgICAgIHZhciBuYXZpZ2F0aW9uID0gdGhpcy5hcHBDb25maWcubmF2aWdhdGlvbjtcclxuICAgICAgICAgICAgaWYoIXRoaXMuYXBwQ29uZmlnW1wiaXNEZXNpZ25Nb2RlXCJdICYmIHRoaXMuaXNTcGxpdExheW91dCgpICYmIG5hdmlnYXRpb24pIHtcclxuICAgICAgICAgICAgICAgIGlmKCFuYXZpZ2F0aW9uLmN1c3RvbVNwbGl0TmF2aWdhdGlvbiAmJiBuYXZpZ2F0aW9uLml0ZW1zICYmIG5hdmlnYXRpb24uaXRlbXMubGVuZ3RoID4gMCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuYXBwQ29uZmlnLnZpZXdzLnNwbGljZSgwLCAwLCB0aGlzLmdldFNwbGl0TmF2aWdhdGlvblZpZXcoKSk7XHJcbiAgICAgICAgICAgICAgICAgICAgKHRoaXMuYXBwQ29uZmlnLmRhdGFTdG9yZXMgPSB0aGlzLmFwcENvbmZpZy5kYXRhU3RvcmVzIHx8IFtdKS5wdXNoKHRoaXMuZ2V0TmF2aWdhdGlvbkl0ZW1zU3RvcmUoKSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgcHJpdmF0ZSBjb3B5R2xvYmFsQ29tbWFuZHMoKSB7XHJcbiAgICAgICAgICAgIGlmKHRoaXMuYXBwQ29uZmlnLmdsb2JhbENvbW1hbmRzICYmIHRoaXMuYXBwQ29uZmlnLnZpZXdzKSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgaXNTcGxpdExheW91dCA9IHRoaXMuaXNTcGxpdExheW91dCgpO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5hcHBDb25maWcudmlld3MuZm9yRWFjaCh2aWV3ID0+IHtcclxuICAgICAgICAgICAgICAgICAgICBpZihpc1NwbGl0TGF5b3V0ICYmIHZpZXcucGFuZSAhPT0gXCJtYXN0ZXJcIikge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIGlmKCF2aWV3LmNvbW1hbmRzKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZpZXcuY29tbWFuZHMgPSBbXTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5hcHBDb25maWcuZ2xvYmFsQ29tbWFuZHMuZm9yRWFjaChjb21tYW5kID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdmlldy5jb21tYW5kcy5wdXNoKCQuZXh0ZW5kKHt9LCBjb21tYW5kLCB7IGlkOiBjb21tYW5kLmlkICsgdmlldy5pZCB9KSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBuYXZpZ2F0ZSh1cmk/OiBhbnksIG9wdGlvbnM/OiB7fSkge1xyXG4gICAgICAgICAgICB0aGlzLmR4YXBwLm5hdmlnYXRlKHVyaSwgb3B0aW9ucyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGluaXRpYWxpemVEZWZhdWx0VmlldyhjdXJyZW50RGV2aWNlOiBkeC5EZXZpY2UpIHtcclxuICAgICAgICAgICAgdmFyIGN1cnJlbnRQbGF0Zm9ybSA9IExheW91dEhlbHBlci50cnlHZXRDdXJyZW50UGxhdGZvcm0odGhpcy5hcHBDb25maWcucGxhdGZvcm1zLCBjdXJyZW50RGV2aWNlKSxcclxuICAgICAgICAgICAgICAgIHVzZXNTcGxpdExheW91dCA9IGN1cnJlbnRQbGF0Zm9ybSAmJiBjdXJyZW50UGxhdGZvcm0ubGF5b3V0ID09PSBcInNwbGl0XCIsXHJcbiAgICAgICAgICAgICAgICBkZWZhdWx0VmlldyA9IGN1cnJlbnRQbGF0Zm9ybSAmJiBjdXJyZW50UGxhdGZvcm0uZGVmYXVsdFZpZXcgPyBjdXJyZW50UGxhdGZvcm0uZGVmYXVsdFZpZXcgOiB0aGlzLmFwcENvbmZpZy5uYXZpZ2F0aW9uLmRlZmF1bHRWaWV3O1xyXG4gICAgICAgICAgICBpZighdGhpcy5hcHBDb25maWdbXCJpc0Rlc2lnbk1vZGVcIl0gJiYgdXNlc1NwbGl0TGF5b3V0ICYmICFjdXJyZW50UGxhdGZvcm0uZGVmYXVsdFZpZXcpIHtcclxuICAgICAgICAgICAgICAgIHZhciBzcGxpdE5hdiA9IGZpbmRJbkFycmF5KHRoaXMuYXBwQ29uZmlnLnZpZXdzLCB2ID0+IHYucGFuZSA9PT0gXCJtYXN0ZXJcIik7XHJcbiAgICAgICAgICAgICAgICBpZihzcGxpdE5hdikge1xyXG4gICAgICAgICAgICAgICAgICAgIGRlZmF1bHRWaWV3ID0gc3BsaXROYXYuaWQ7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuIGRlZmF1bHRWaWV3O1xyXG4gICAgICAgIH1cclxuICAgICAgICBydW4oKSB7XHJcbiAgICAgICAgICAgIHZhciB0aGF0ID0gdGhpcztcclxuICAgICAgICAgICAgZHhkYXRhLmVycm9ySGFuZGxlciA9IHRoaXMuX2RhdGFFcnJvckhhbmRsZXIuYmluZCh0aGlzKTtcclxuICAgICAgICAgICAgRGV2RXhwcmVzcy5kZXZpY2VzLmN1cnJlbnQoeyBwbGF0Zm9ybTogXCJnZW5lcmljXCIgfSk7XHJcbiAgICAgICAgICAgIHZhciBjdXJyZW50RGV2aWNlID0gRGV2RXhwcmVzcy5kZXZpY2VzLmN1cnJlbnQoKTtcclxuICAgICAgICAgICAgdGhpcy5kZWZhdWx0VmlldyA9IHRoaXMuaW5pdGlhbGl6ZURlZmF1bHRWaWV3KGN1cnJlbnREZXZpY2UpO1xyXG4gICAgICAgICAgICB2YXIgbW9kdWxlTG9hZGVyID0gbmV3IE1vZHVsZXNMb2FkZXIodGhpcywgd2luZG93W1wicHJvZ3Jlc3NSZXBvcnRlclwiXSksXHJcbiAgICAgICAgICAgICAgICBtb2R1bGVJbml0ZWQgPSBtb2R1bGVMb2FkZXIuaW5pdE1vZHVsZXMoKTtcclxuICAgICAgICAgICAgbW9kdWxlSW5pdGVkLmRvbmUoKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgdmFyIGh0bWxBcHBsaWNhdGlvbk9wdGlvbnM6IGR4aHRtbC5IdG1sQXBwbGljYXRpb25PcHRpb25zLFxyXG4gICAgICAgICAgICAgICAgICAgIGxheW91dFNldDogeyBsYXlvdXRTZXQ6IGFueVtdOyB2aWV3U3BlY2lmaWNMYXlvdXRzOiB7IHZpZXc6IHN0cmluZzsgb3B0aW9uczogYW55OyBjb250cm9sbGVyOiBhbnkgfVtdIH07XHJcbiAgICAgICAgICAgICAgICB0aGlzLl9jcmVhdGVWaWV3cyhkb2N1bWVudC5ib2R5KTtcclxuICAgICAgICAgICAgICAgIGh0bWxBcHBsaWNhdGlvbk9wdGlvbnMgPSB0aGlzLmh0bWxBcHBDb25maWd1cmF0aW9uKCk7XHJcbiAgICAgICAgICAgICAgICBsYXlvdXRTZXQgPSBMYXlvdXRIZWxwZXIuY3JlYXRlTGF5b3V0U2V0KHRoaXMuYXBwQ29uZmlnLnBsYXRmb3JtcywgdGhpcy5hcHBDb25maWdbXCJpc0Rlc2lnbk1vZGVcIl0sIHRoaXMuYXBwQ29uZmlnLnZpZXdzKTtcclxuICAgICAgICAgICAgICAgIGh0bWxBcHBsaWNhdGlvbk9wdGlvbnMubGF5b3V0U2V0ID0gbGF5b3V0U2V0LmxheW91dFNldDtcclxuICAgICAgICAgICAgICAgIHRoaXMuZHhhcHAgPSB0aGlzLl9jcmVhdGVBcHBsaWNhdGlvbihodG1sQXBwbGljYXRpb25PcHRpb25zKTtcclxuICAgICAgICAgICAgICAgIHRoaXMuZHhhcHAub24oXCJyZXNvbHZlVmlld0NhY2hlS2V5XCIsIChhcmdzKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIHZpZXdJZCA9IGFyZ3Mucm91dGVEYXRhW1widmlld1wiXSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmVmcmVzaCA9IHRoYXQuYXBwQ29uZmlnLnZpZXdzLnNvbWUoKHZhbHVlKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdmFsdWUuaWQgPT09IHZpZXdJZCAmJiB2YWx1ZS5yZWZyZXNoV2hlblNob3duO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgICAgICBpZihyZWZyZXNoKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGFyZ3Mua2V5ID0gdmlld0lkO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5keGFwcFtcIl9wcm9jZXNzUmVxdWVzdFJlc3VsdExvY2tFbmFibGVkXCJdID0gdHJ1ZTtcclxuICAgICAgICAgICAgICAgIHRoaXMuZHhhcHAub24oXCJyZXNvbHZlTGF5b3V0Q29udHJvbGxlclwiLCAoYXJncykgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciBmb3VuZENvbnRyb2xsZXIgPSBMYXlvdXRIZWxwZXIudHJ5R2V0Vmlld1NwZWNpZmljTGF5b3V0Q29udHJvbGxlcihhcmdzLnZpZXdJbmZvW1widmlld05hbWVcIl0sIGxheW91dFNldC52aWV3U3BlY2lmaWNMYXlvdXRzKTtcclxuICAgICAgICAgICAgICAgICAgICBpZihmb3VuZENvbnRyb2xsZXIpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgYXJncy5sYXlvdXRDb250cm9sbGVyID0gZm91bmRDb250cm9sbGVyO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgdmFyIG9uVmlld1Nob3duID0gKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIC8vIEZvcmNlcyBET00gZWxlbWVudHMgaGVpZ2h0IHJlY2FsY3VsYXRpb25cclxuICAgICAgICAgICAgICAgICAgICAkKHdpbmRvdykucmVzaXplKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zdGFydGVkLmZpcmUodGhpcyk7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5keGFwcC5vZmYoXCJ2aWV3U2hvd25cIiwgb25WaWV3U2hvd24pO1xyXG4gICAgICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgICAgIHRoaXMuZHhhcHAub24oXCJ2aWV3U2hvd25cIiwgb25WaWV3U2hvd24pO1xyXG4gICAgICAgICAgICAgICAgLy8gQ2FuY2VscyBuYXZpZ2F0aW9uIHRvIHVybHMgd2l0aCBzaGFyZWQgcGFyYW1ldGVycyB3aGVuIHNoYXJlZCBvYmplY3RzIGFyZSBub3Qgc2V0XHJcbiAgICAgICAgICAgICAgICB0aGlzLmR4YXBwLm9uKFwibmF2aWdhdGluZ1wiLCB0aGlzLl9vbk5hdmlnYXRpbmcuYmluZCh0aGlzKSk7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmR4YXBwLnJvdXRlci5yZWdpc3RlcihcIjp2aWV3LzpwYXJhbWV0ZXJzXCIsIHsgdmlldzogdGhhdC5kZWZhdWx0VmlldywgcGFyYW1ldGVyczogXCJcIiB9KTtcclxuICAgICAgICAgICAgICAgIGlmKHdpbmRvd1tcInhldEhhbmRsZU9wZW5VUkxcIl0pIHtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgb3BlblVybCA9IHdpbmRvd1tcInhldEhhbmRsZU9wZW5VUkxcIl07XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5mdW5jdGlvbnNbXCJuYXZpZ2F0ZVRvVmlld1wiXShvcGVuVXJsLnVyaSwgb3BlblVybC5wYXJhbXMsIHRydWUpO1xyXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICBpZihsb2NhdGlvbi5oYXNoICYmIGxvY2F0aW9uLmhhc2ggIT09IFwiI1wiKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmKGxvY2F0aW9uLmhhc2ggPT09IFwiI3Rlc3QtZXJyb3JcIikge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5keGFwcFtcImJiYlwiXS5jY2MuZGRkID0gMTAwO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZHhhcHAubmF2aWdhdGUoKTtcclxuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLm5hdmlnYXRlVG9EZWZhdWx0VmlldygpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHRoaXMuYXV0aG9yaXphdGlvbiA9IG5ldyBNb2R1bGVzLkF1dGhvcml6YXRpb24odGhpcy5hcHBDb25maWcsIHRoaXMpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIF9jcmVhdGVBcHBsaWNhdGlvbihvcHRpb25zOiBkeGh0bWwuSHRtbEFwcGxpY2F0aW9uT3B0aW9ucykge1xyXG4gICAgICAgICAgICByZXR1cm4gbmV3IGR4aHRtbC5IdG1sQXBwbGljYXRpb24ob3B0aW9ucyk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBwcml2YXRlIF9kYXRhRXJyb3JIYW5kbGVyKGU6IEVycm9yKSB7XHJcbiAgICAgICAgICAgIGlmKGVbXCJodHRwU3RhdHVzXCJdID09PSA0MDQpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMubmF2aWdhdGVUb0RlZmF1bHRWaWV3KCk7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmRhdGFFcnJvci5maXJlKGUpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBwcml2YXRlIF9jcmVhdGVWaWV3cyhyb290RWxlbWVudDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcclxuICAgICAgICAgICAgaWYoIXRoaXMuYXBwQ29uZmlnLnZpZXdzKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgdGhpcy5hcHBDb25maWcudmlld3MuZm9yRWFjaCgodmlldykgPT4ge1xyXG4gICAgICAgICAgICAgICAgdmFyIG5ld1ZpZXcgPSBuZXcgQXBwUGxheWVyLlZpZXdzLlZpZXcodmlldywgdGhpcyk7XHJcbiAgICAgICAgICAgICAgICB0aGlzLm5zW3ZpZXcuaWRdID0gbmV3Vmlldy52aWV3TW9kZWw7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZWdpc3Rlck1pc3NpbmdUZW1wbGF0ZShjb21wb25lbnRUeXBlOiBzdHJpbmcpIHtcclxuICAgICAgICAgICAgaWYoJC5pbkFycmF5KGNvbXBvbmVudFR5cGUsIEFwcGxpY2F0aW9uLm1pc3NpbmdUZW1wbGF0ZXMpID09PSAtMSkge1xyXG4gICAgICAgICAgICAgICAgQXBwbGljYXRpb24ubWlzc2luZ1RlbXBsYXRlcy5wdXNoKGNvbXBvbmVudFR5cGUpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRlbXBsYXRlSXNNaXNzaW5nKGNvbXBvbmVudFR5cGU6IHN0cmluZykge1xyXG4gICAgICAgICAgICByZXR1cm4gJC5pbkFycmF5KGNvbXBvbmVudFR5cGUsIEFwcGxpY2F0aW9uLm1pc3NpbmdUZW1wbGF0ZXMpICE9PSAtMTtcclxuICAgICAgICB9XHJcbiAgICAgICAgLy9UT0RPIFBsZXRuZXY6IGV4dHJhY3QgaW50byBTcGxpdExheW91dE1vZHVsZVxyXG4gICAgICAgIC8vVE9ETyBQbGV0bmV2OiBjb21lIHVwIHdpdGggYSB1bmlxdWUgaWRlbnRpZmllciBpbnN0ZWFkIG9mIFwibmF2aWdhdGlvbkl0ZW1zXCJcclxuICAgICAgICBwcml2YXRlIGdldE5hdmlnYXRpb25JdGVtc1N0b3JlKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gPElBcnJheVN0b3JlPntcclxuICAgICAgICAgICAgICAgIGlkOiBcIm5hdmlnYXRpb25JdGVtc1wiLFxyXG4gICAgICAgICAgICAgICAgdHlwZTogXCJhcnJheVwiLFxyXG4gICAgICAgICAgICAgICAgYXJyYXk6IHRoaXMuaHRtbEFwcE5hdmlnYXRpb24oKVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH1cclxuICAgICAgICAvL1RPRE8gUGxldG5ldjogZXh0cmFjdCBpbnRvIFNwbGl0TGF5b3V0TW9kdWxlXHJcbiAgICAgICAgLy9UT0RPIFBsZXRuZXY6IGNvbWUgdXAgd2l0aCBhIHVuaXF1ZSBpZGVudGlmaWVyIGluc3RlYWQgb2YgXCJzcGxpdE5hdmlnYXRpb25cIlxyXG4gICAgICAgIHByaXZhdGUgZ2V0U3BsaXROYXZpZ2F0aW9uVmlldygpOiBJVmlldyB7XHJcbiAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICBcImlkXCI6IEFwcGxpY2F0aW9uLlNQTElUX05BVl9WSUVXX0lELFxyXG4gICAgICAgICAgICAgICAgXCJ0aXRsZVwiOiB0aGlzLmFwcENvbmZpZy5uYXZpZ2F0aW9uICYmIHRoaXMuYXBwQ29uZmlnLm5hdmlnYXRpb24udGl0bGUgPyB0aGlzLmFwcENvbmZpZy5uYXZpZ2F0aW9uLnRpdGxlIDogXCJNZW51XCIsXHJcbiAgICAgICAgICAgICAgICBcInBhbmVcIjogXCJtYXN0ZXJcIixcclxuICAgICAgICAgICAgICAgIFwiZGF0YVNvdXJjZXNcIjogW1xyXG4gICAgICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgXCJpZFwiOiBcIm5hdmlnYXRpb25JdGVtc0RhdGFzb3VyY2VcIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgXCJzdG9yZVwiOiBcIm5hdmlnYXRpb25JdGVtc1wiXHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgXSxcclxuICAgICAgICAgICAgICAgIFwiY29tcG9uZW50c1wiOiBbXHJcbiAgICAgICAgICAgICAgICAgICAgPElMaXN0Q29tcG9uZW50PntcclxuICAgICAgICAgICAgICAgICAgICAgICAgXCJpZFwiOiBcIm5hdmlnYXRpb25MaXN0XCIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIFwidHlwZVwiOiBcImxpc3RcIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgXCJkYXRhU291cmNlXCI6IFwiJG1vZGVsLm5hdmlnYXRpb25JdGVtc0RhdGFzb3VyY2VcIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgXCJpdGVtQ29tcG9uZW50c1wiOiBbe1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWQ6IFwibmF2aWdhdGlvbkl0ZW1cIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6IFwibGFiZWxcIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRleHQ6IFwiJGRhdGEudGl0bGVcIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0eWxlOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJmb250U2l6ZVwiOiBcIjE2cHhcIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcIm1hcmdpblJpZ2h0XCI6IFwiMTBweFwiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwibWFyZ2luTGVmdFwiOiBcIjEwcHhcIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcIm1hcmdpbkJvdHRvbVwiOiBcIjEwcHhcIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcIm1hcmdpblRvcFwiOiBcIjEwcHhcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgXCJvbkl0ZW1DbGlja1wiOiAoY29udGV4dDogSVJ1bkNvbnRleHQpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGVvZiBjb250ZXh0LiRkYXRhW1wib25FeGVjdXRlXCJdID09PSBcImZ1bmN0aW9uXCIgPyBjb250ZXh0LiRkYXRhW1wib25FeGVjdXRlXCJdKCkgOiB0aGlzLmZ1bmN0aW9uc1tcIm5hdmlnYXRlVG9WaWV3XCJdKGNvbnRleHQuJGRhdGFbXCJvbkV4ZWN1dGVcIl0uc3Vic3RyKDEpKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIF1cclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcHJpdmF0ZSBjcmVhdGVHbG9iYWxGdW5jdGlvbnMoKTogeyBba2V5OiBzdHJpbmddOiAoLi4uYXJnczogYW55W10pID0+IGFueSB9IHtcclxuICAgICAgICAgICAgdmFyIGZ1bmN0aW9uczogeyBba2V5OiBzdHJpbmddOiAoLi4uYXJnczogYW55W10pID0+IGFueSB9ID0ge307XHJcblxyXG4gICAgICAgICAgICB2YXIgYnVzeUNvdW50ZXIgPSAwO1xyXG4gICAgICAgICAgICB2YXIgYnVzeUluc3RhbmNlO1xyXG4gICAgICAgICAgICBmdW5jdGlvbnNbXCJidXN5XCJdID0gKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgYnVzeUNvdW50ZXIrKztcclxuICAgICAgICAgICAgICAgIGlmKGJ1c3lDb3VudGVyID09PSAxKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgYnVzeUluc3RhbmNlID0gJChcIjxkaXY+XCIpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC5hcHBlbmRUbyhEZXZFeHByZXNzLnZpZXdQb3J0KCkpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC5hZGRDbGFzcyhcImR4LXN0YXRpY1wiKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAuZHhMb2FkUGFuZWwoKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAuZGF0YShcImR4TG9hZFBhbmVsXCIpO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICBidXN5SW5zdGFuY2Uub3B0aW9uKFwib25IaWRkZW5cIiwgZnVuY3Rpb24oYXJncykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBhcmdzLmVsZW1lbnQucmVtb3ZlKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIGJ1c3lJbnN0YW5jZS5zaG93KCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgIGZ1bmN0aW9uc1tcImF2YWlsYWJsZVwiXSA9ICgpID0+IHtcclxuICAgICAgICAgICAgICAgIGJ1c3lDb3VudGVyLS07XHJcbiAgICAgICAgICAgICAgICBpZihidXN5Q291bnRlciA9PT0gMCkge1xyXG4gICAgICAgICAgICAgICAgICAgIGJ1c3lJbnN0YW5jZS5oaWRlKCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBpZihidXN5Q291bnRlciA8IDApIHtcclxuICAgICAgICAgICAgICAgICAgICB0aHJvdyBFcnJvcihcIlVucGFpcmVkIGZyZWUgbWV0aG9kIGNhbGxcIik7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgIGZ1bmN0aW9uc1tcImJhY2tcIl0gPSAoKSA9PiB0aGlzLmR4YXBwLmJhY2soKTtcclxuICAgICAgICAgICAgZnVuY3Rpb25zW1wibmF2aWdhdGVUb1ZpZXdcIl0gPSAodmlld0lkOiBzdHJpbmcsIHBhcmFtZXRlcnM/OiB7IFtrZXk6IHN0cmluZ106IGFueSB9LCBzcmNQYW5lPzogc3RyaW5nKSA9PiB7XHJcbiAgICAgICAgICAgICAgICBpZighdmlld0lkKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmlld0lkID0gdGhpcy5kZWZhdWx0VmlldztcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHZhciB2aWV3OiBJVmlldyA9IHRoaXMuYXBwQ29uZmlnLnZpZXdzLmZpbHRlcigodmlldykgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB2aWV3LmlkID09PSB2aWV3SWQ7XHJcbiAgICAgICAgICAgICAgICB9KVswXTtcclxuICAgICAgICAgICAgICAgIGlmKHZpZXcucGFyYW1zICYmIHZpZXcucGFyYW1zLmZpbHRlcihwID0+ICFWaWV3cy5WaWV3TW9kZWwub3B0aW9uYWwocCkpLmxlbmd0aCA+IDAgJiYgIXBhcmFtZXRlcnMpIHtcclxuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKFwiTmF2aWdhdGVUb1ZpZXcgJ1wiICsgdmlldy5pZCArIFwiJy4gVmlldyBwYXJhbWV0ZXJzIG5vdCBmb3VuZC5cIik7XHJcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYodmlldy5wYXJhbXMpIHtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgbWlzc2luZ1BhcmFtZXRlcnM6IHN0cmluZ1tdO1xyXG4gICAgICAgICAgICAgICAgICAgIHZpZXcucGFyYW1zLmZvckVhY2gocGFyYW0gPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZighcGFyYW1ldGVycyB8fCBwYXJhbWV0ZXJzW3BhcmFtLm5hbWVdID09PSB1bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmKCFWaWV3cy5WaWV3TW9kZWwub3B0aW9uYWwocGFyYW0pKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYoIW1pc3NpbmdQYXJhbWV0ZXJzKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1pc3NpbmdQYXJhbWV0ZXJzID0gW107XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1pc3NpbmdQYXJhbWV0ZXJzLnB1c2gocGFyYW0ubmFtZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHBhcmFtZXRlciA9IHBhcmFtZXRlcnNbcGFyYW0ubmFtZV0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlSW5mbyA9IHRoaXMudHlwZUluZm9SZXBvc2l0b3J5LmdldChwYXJhbS50eXBlKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gVE9ETzogdHlwZUluZm8gbXVzdCBiZSBkZWZpbmVkICh1bmtub3duIHR5cGU/KVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZih0eXBlSW5mbyAmJiB0eXBlSW5mby5raW5kID09PSBUWVBFUy5TVE9SRV9UWVBFKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgc3RvcmUgPSB0aGlzLnN0b3Jlc1t0eXBlSW5mby5uYW1lXTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmKHBhcmFtZXRlciAhPT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYocGFyYW0uc2hhcmVkKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc2hhcmVkT2JqZWN0c1twYXJhbS5uYW1lXSA9IHBhcmFtZXRlcjtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcGFyYW1ldGVyc1twYXJhbS5uYW1lXSA9IHN0b3JlLmtleU9mKHBhcmFtZXRlcik7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZihwYXJhbS5zaGFyZWQpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc2hhcmVkT2JqZWN0c1twYXJhbS5uYW1lXSA9IHBhcmFtZXRlcjtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBhcmFtZXRlcnNbcGFyYW0ubmFtZV0gPSBBcHBsaWNhdGlvbi5TSEFSRURfUEFSQU1FVEVSO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYobWlzc2luZ1BhcmFtZXRlcnMpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihcIk5hdmlnYXRlVG9WaWV3ICdcIiArIHZpZXcuaWQgKyBcIicuIE1pc3NpbmcgcGFyYW1ldGVyczogXCIgKyBtaXNzaW5nUGFyYW1ldGVycy5qb2luKFwiLCBcIikpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHZhciBvcHRpb25zID0gdW5kZWZpbmVkO1xyXG4gICAgICAgICAgICAgICAgaWYodGhpcy5pc1NwbGl0TGF5b3V0KCkgJiYgdmlldy5wYW5lID09PSBcIm1hc3RlclwiKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgb3B0aW9ucyA9IHsgcm9vdDogZmFsc2UgfTtcclxuICAgICAgICAgICAgICAgIH0gZWxzZSBpZih0aGlzLmlzTmF2aWdhdGlvbkl0ZW0odmlld0lkKSB8fCB0aGlzLmlzQ3Jvc3NQYW5lVHJhbnNpdGlvbihzcmNQYW5lLCB2aWV3LnBhbmUpIHx8IHRoaXMuaXNBdXRob3JpemF0aW9uVmlldyh2aWV3SWQpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgb3B0aW9ucyA9IHsgcm9vdDogdHJ1ZSwgdGFyZ2V0OiBcImN1cnJlbnRcIiB9O1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgaWYoIXBhcmFtZXRlcnMgfHwgJC5pc0VtcHR5T2JqZWN0KHBhcmFtZXRlcnMpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5uYXZpZ2F0ZSh2aWV3SWQsIG9wdGlvbnMpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5uYXZpZ2F0ZSh7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZpZXc6IHZpZXdJZCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgcGFyYW1ldGVyczogcGFyYW1ldGVyc1xyXG4gICAgICAgICAgICAgICAgICAgIH0sIG9wdGlvbnMpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICBmdW5jdGlvbnNbXCJsb2FkXCJdID0gKHN0b3JlSWQ6IHN0cmluZywgb3B0aW9ucz86IGR4ZGF0YS5Mb2FkT3B0aW9ucyk6IEpRdWVyeVByb21pc2U8YW55PiA9PiB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5zdG9yZXNbc3RvcmVJZF0ubG9hZChvcHRpb25zKTtcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgZnVuY3Rpb25zW1wiYnlLZXlcIl0gPSAoc3RvcmVJZDogc3RyaW5nLCBrZXk6IGFueSwgZXh0cmFPcHRpb25zPzogeyBleHBhbmQ/OiBzdHJpbmdbXSB9KTogSlF1ZXJ5UHJvbWlzZTxhbnk+ID0+IHtcclxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnN0b3Jlc1tzdG9yZUlkXS5ieUtleShrZXksIGV4dHJhT3B0aW9ucyk7XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgIGZ1bmN0aW9uc1tcImtleU9mXCJdID0gKHN0b3JlSWQ6IHN0cmluZywgb2JqZWN0OiBhbnkpOiBKUXVlcnlQcm9taXNlPGFueT4gPT4ge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuc3RvcmVzW3N0b3JlSWRdLmtleU9mKG9iamVjdCk7XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgIGZ1bmN0aW9uc1tcInNhdmVcIl0gPSAob2JqZWN0OiBhbnksIHN0b3JlSWQ6IHN0cmluZywga2V5PzogYW55KTogSlF1ZXJ5UHJvbWlzZTxhbnk+ID0+IHtcclxuICAgICAgICAgICAgICAgIGZ1bmN0aW9uc1tcImJ1c3lcIl0oKTtcclxuXHJcbiAgICAgICAgICAgICAgICB2YXIgc3RvcmUgPSB0aGlzLnN0b3Jlc1tzdG9yZUlkXTtcclxuICAgICAgICAgICAgICAgIGlmKCFrZXkpIHtcclxuICAgICAgICAgICAgICAgICAgICBrZXkgPSBzdG9yZS5rZXlPZihvYmplY3QpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIHZhciBwcm9taXNlID0ga2V5ID09PSB1bmRlZmluZWQgPyBzdG9yZS5pbnNlcnQob2JqZWN0KSA6IHN0b3JlLnVwZGF0ZShrZXksIG9iamVjdCk7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gcHJvbWlzZS50aGVuKChzdG9yZWRPYmplY3QsIHNlcnZlcktleSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIGlmKCFrZXkpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgb2JqZWN0W3N0b3JlLmtleSgpXSA9IHNlcnZlcktleTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9KS5hbHdheXMoZnVuY3Rpb25zW1wiYXZhaWxhYmxlXCJdKTtcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgZnVuY3Rpb25zW1wiaW5zZXJ0XCJdID0gKG9iamVjdDogYW55LCBzdG9yZUlkOiBzdHJpbmcpOiBKUXVlcnlQcm9taXNlPGFueT4gPT4ge1xyXG4gICAgICAgICAgICAgICAgZnVuY3Rpb25zW1wiYnVzeVwiXSgpO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuc3RvcmVzW3N0b3JlSWRdLmluc2VydChvYmplY3QpLmFsd2F5cyhmdW5jdGlvbnNbXCJhdmFpbGFibGVcIl0pO1xyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICBmdW5jdGlvbnNbXCJkZWxldGVcIl0gPSAob2JqZWN0T3JLZXk6IGFueSwgc3RvcmVJZDogc3RyaW5nKTogSlF1ZXJ5UHJvbWlzZTxhbnk+ID0+IHtcclxuICAgICAgICAgICAgICAgIHZhciBzdG9yZSA9IHRoaXMuc3RvcmVzW3N0b3JlSWRdLFxyXG4gICAgICAgICAgICAgICAgICAgIGtleSA9ICQuaXNQbGFpbk9iamVjdChvYmplY3RPcktleSkgPyBzdG9yZS5rZXlPZihvYmplY3RPcktleSkgOiBvYmplY3RPcktleTtcclxuXHJcbiAgICAgICAgICAgICAgICBmdW5jdGlvbnNbXCJidXN5XCJdKCk7XHJcblxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHN0b3JlLnJlbW92ZShrZXkpLmFsd2F5cyhmdW5jdGlvbnNbXCJhdmFpbGFibGVcIl0pO1xyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICBmdW5jdGlvbnNbXCJyZWZyZXNoXCJdID0gKHN0b3JlSWQ6IHN0cmluZyk6IHZvaWQgPT4ge1xyXG4gICAgICAgICAgICAgICAgdmFyIHN0b3JlID0gdGhpcy5zdG9yZXNbc3RvcmVJZF07XHJcbiAgICAgICAgICAgICAgICBzdG9yZVtcImZpcmVFdmVudFwiXShcIm1vZGlmaWVkXCIpO1xyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICBmdW5jdGlvbnNbXCJnZXREYXRhU3RvcmVDb25maWdcIl0gPSAoc3RvcmVJZDogc3RyaW5nKTogSURhdGFTdG9yZSA9PiB7XHJcbiAgICAgICAgICAgICAgICB2YXIgZmlsdGVyZWQgPSB0aGlzLmFwcENvbmZpZy5kYXRhU3RvcmVzLmZpbHRlcihzdG9yZSA9PiBzdG9yZS5pZCA9PT0gc3RvcmVJZCk7XHJcbiAgICAgICAgICAgICAgICBpZihmaWx0ZXJlZC5sZW5ndGggPT09IDApIHtcclxuICAgICAgICAgICAgICAgICAgICB0aHJvdyBcIkRhdGEgcHJvdmlkZXIgJ1wiICsgc3RvcmVJZCArIFwiJyBpcyBub3QgZm91bmQhXCI7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBpZihmaWx0ZXJlZC5sZW5ndGggPiAxKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS53YXJuKFwiRm91bmQgJW8gZGF0YSBwcm92aWRlcnMgd2l0aCBpZCAnJW8nXCIsIGZpbHRlcmVkLmxlbmd0aCwgc3RvcmVJZCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gZmlsdGVyZWRbMF07XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgIGZ1bmN0aW9uc1tcImdldERhdGFTdG9yZVwiXSA9IChzdG9yZUlkOiBzdHJpbmcpOiBkeGRhdGEuU3RvcmUgPT4ge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuc3RvcmVzW3N0b3JlSWRdO1xyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICBmdW5jdGlvbnNbXCJsb2dcIl0gPSAobGV2ZWw6IHN0cmluZywgbWVzc2FnZTogc3RyaW5nKTogdm9pZCA9PiB7XHJcbiAgICAgICAgICAgICAgICB2YXIgbG9nZ2VyID0gZHhjb25zb2xlLmxvZ2dlcjtcclxuICAgICAgICAgICAgICAgIGxvZ2dlcltsZXZlbF0obWVzc2FnZSk7XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgIGZ1bmN0aW9uc1tcImdldENvb2tpZVwiXSA9IChwYXJhbXM6IHsgY29va2llTmFtZTogc3RyaW5nIH0pOiBKUXVlcnlQcm9taXNlPHN0cmluZz4gPT4ge1xyXG4gICAgICAgICAgICAgICAgdmFyIG5hbWUgPSBwYXJhbXMuY29va2llTmFtZSArIFwiPVwiLFxyXG4gICAgICAgICAgICAgICAgICAgIGNvb2tpZUFycmF5ID0gZG9jdW1lbnQuY29va2llLnNwbGl0KFwiO1wiKSxcclxuICAgICAgICAgICAgICAgICAgICByZXN1bHQgPSBcIlwiLFxyXG4gICAgICAgICAgICAgICAgICAgIGRlZmZlcmVkID0gJC5EZWZlcnJlZCgpO1xyXG4gICAgICAgICAgICAgICAgZm9yKHZhciBpID0gMDsgaSA8IGNvb2tpZUFycmF5Lmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIGNvb2tpZSA9IGNvb2tpZUFycmF5W2ldO1xyXG4gICAgICAgICAgICAgICAgICAgIHdoaWxlKGNvb2tpZS5jaGFyQXQoMCkgPT09IFwiIFwiKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvb2tpZSA9IGNvb2tpZS5zdWJzdHJpbmcoMSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIGlmKGNvb2tpZS5pbmRleE9mKG5hbWUpID09PSAwKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc3VsdCA9IGNvb2tpZS5zdWJzdHJpbmcobmFtZS5sZW5ndGgsIGNvb2tpZS5sZW5ndGgpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBkZWZmZXJlZC5yZXNvbHZlKHJlc3VsdCk7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gZGVmZmVyZWQ7XHJcbiAgICAgICAgICAgIH07XHJcblxyXG4gICAgICAgICAgICByZXR1cm4gZnVuY3Rpb25zO1xyXG4gICAgICAgIH1cclxuICAgICAgICBwcml2YXRlIGlzTmF2aWdhdGlvbkl0ZW0odmlld0lkOiBzdHJpbmcpOiBib29sZWFuIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuYXBwQ29uZmlnLm5hdmlnYXRpb24gJiZcclxuICAgICAgICAgICAgICAgIGluZGV4SW5BcnJheSh0aGlzLmFwcENvbmZpZy5uYXZpZ2F0aW9uLml0ZW1zLCBpdGVtID0+IGl0ZW0uaWQgPT09IHZpZXdJZCkgIT09IC0xO1xyXG4gICAgICAgIH1cclxuICAgICAgICBwcml2YXRlIGlzQXV0aG9yaXphdGlvblZpZXcodmlld0lkOiBzdHJpbmcpOiBib29sZWFuIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuYXBwQ29uZmlnLmF1dGhvcml6YXRpb24gJiYgdGhpcy5hcHBDb25maWcuYXV0aG9yaXphdGlvbi5sb2dpblZpZXcgPT09IHZpZXdJZDtcclxuICAgICAgICB9XHJcbiAgICAgICAgcHJpdmF0ZSBpc0Nyb3NzUGFuZVRyYW5zaXRpb24oc3JjUGFuZTogc3RyaW5nID0gXCJkZXRhaWxcIiwgZHN0UGFuZTogc3RyaW5nID0gXCJkZXRhaWxcIik6IGJvb2xlYW4ge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5pc1NwbGl0TGF5b3V0KCkgJiYgc3JjUGFuZSAhPT0gZHN0UGFuZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcHJvY2Vzc1BhcmFtZXRlckxvYWRpbmdFcnJvcihuYW1lOiBzdHJpbmcsIGlkOiBhbnkpIHtcclxuICAgICAgICAgICAgdmFyIGRpYWxvZyA9IERldkV4cHJlc3MudWkuZGlhbG9nLmN1c3RvbSh7XHJcbiAgICAgICAgICAgICAgICB0aXRsZTogXCJFcnJvclwiLFxyXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogXCJDYW5ub3QgbG9hZCBhbiAnXCIgKyBuYW1lICsgXCInIHBhcmFtZXRlciB3aXRoIHRoZSAnXCIgKyBpZCArIFwiJyBrZXkuXCIsXHJcbiAgICAgICAgICAgICAgICBidXR0b25zOiBbe1xyXG4gICAgICAgICAgICAgICAgICAgIHRleHQ6IFwiR28gQmFja1wiLFxyXG4gICAgICAgICAgICAgICAgICAgIG9uQ2xpY2s6IHRoaXMuZnVuY3Rpb25zW1wiYmFja1wiXVxyXG4gICAgICAgICAgICAgICAgfV1cclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIGRpYWxvZy5zaG93KCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHByaXZhdGUgY3JlYXRlU3RvcmVzKCk6IHZvaWQge1xyXG4gICAgICAgICAgICB2YXIgYXBwID0gdGhpcztcclxuICAgICAgICAgICAgaWYodGhpcy5zdG9yZXMpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB0aGlzLnN0b3JlcyA9IHt9O1xyXG4gICAgICAgICAgICAodGhpcy5hcHBDb25maWcuZGF0YVN0b3JlcyB8fCBbXSkuZm9yRWFjaCgoaXRlbSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgdmFyIHN0b3JlOiBkeGRhdGEuU3RvcmUgPSBudWxsLFxyXG4gICAgICAgICAgICAgICAgICAgIHN0b3JlT3B0aW9ucyA9IDxJRGF0YVN0b3JlPk1vZGVsLmNyZWF0ZUxpbmtlZE1vZGVsKGl0ZW0sIHsgJGdsb2JhbDogdGhpcy5tb2RlbCB9LCB7IGNhbGxlclR5cGU6IFwiZGF0YSBwcm92aWRlciBvcHRpb25zXCIsIGNhbGxlcklkOiBpdGVtLmlkIH0pO1xyXG4gICAgICAgICAgICAgICAgc3dpdGNoKGl0ZW0udHlwZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGNhc2UgXCJvZGF0YVwiOlxyXG4gICAgICAgICAgICAgICAgICAgICAgICBzdG9yZSA9IG5ldyBPRGF0YVN0b3JlKDxJT0RhdGFTdG9yZT5zdG9yZU9wdGlvbnMsIGFwcC5zdG9yZXMpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgICAgICBjYXNlIFwiYXJyYXlcIjpcclxuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGFycmF5ID0gKDxJQXJyYXlTdG9yZT5zdG9yZU9wdGlvbnMpLmFycmF5O1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0cmFuc2Zvcm1JU09EYXRlcyhhcnJheSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0b3JlID0gbmV3IEFycmF5U3RvcmUoe1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0YTogYXJyYXksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBrZXk6IHN0b3JlT3B0aW9ucy5rZXlcclxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgICAgIGNhc2UgXCJqc29uXCI6XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0b3JlID0gbmV3IEpzb25TdG9yZShzdG9yZU9wdGlvbnMsIHRoaXMubW9kZWwpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgICAgICBjYXNlIFwicmVzdFwiOlxyXG4gICAgICAgICAgICAgICAgICAgICAgICBzdG9yZSA9IG5ldyBSZXN0U3RvcmUoc3RvcmVPcHRpb25zLCB0aGlzLm1vZGVsLCB0aGlzKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICAgICAgY2FzZSBcImxvY2FsXCI6XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBsb2NhbEFycmF5ID0gKDxJTG9jYWxTdG9yZT5zdG9yZU9wdGlvbnMpLmFycmF5O1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgbmFtZSA9ICg8SUxvY2FsU3RvcmU+c3RvcmVPcHRpb25zKS5uYW1lO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgZmx1c2hJbnRlcnZhbCA9ICg8SUxvY2FsU3RvcmU+c3RvcmVPcHRpb25zKS5mbHVzaEludGVydmFsO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgaW1tZWRpYXRlID0gKDxJTG9jYWxTdG9yZT5zdG9yZU9wdGlvbnMpLmltbWVkaWF0ZTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdHJhbnNmb3JtSVNPRGF0ZXMoYXJyYXkpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBzdG9yZSA9IG5ldyBkeGRhdGEuTG9jYWxTdG9yZSh7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkYXRhOiBsb2NhbEFycmF5LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAga2V5OiBzdG9yZU9wdGlvbnMua2V5LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbmFtZTogbmFtZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGltbWVkaWF0ZTogaW1tZWRpYXRlLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZmx1c2hJbnRlcnZhbDogZmx1c2hJbnRlcnZhbFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihcIlVua25vd24gc3RvcmUgdHlwZSAnXCIgKyBzdG9yZU9wdGlvbnMudHlwZSArIFwiJ1wiKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHRoaXMuc3RvcmVzW3N0b3JlT3B0aW9ucy5pZF0gPSBzdG9yZTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHByaXZhdGUgZ2V0Q29tbWFuZE1hcHBpbmcoKTogZHhmLkNvbW1hbmRNYXAge1xyXG4gICAgICAgICAgICB2YXIgY29tbWFuZE1hcHBpbmcgPSA8YW55Pnt9O1xyXG4gICAgICAgICAgICAodGhpcy5hcHBDb25maWcudmlld3MgfHwgW10pLmZvckVhY2goKHZpZXcpID0+IHtcclxuICAgICAgICAgICAgICAgIExheW91dEhlbHBlci5maWxsQ29tbWFuZE1hcHBpbmcoY29tbWFuZE1hcHBpbmcsIHZpZXcuY29tbWFuZHMsIHRoaXMuYXBwQ29uZmlnLnBsYXRmb3JtcywgRGV2RXhwcmVzcy5kZXZpY2VzLmN1cnJlbnQoKSk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICByZXR1cm4gY29tbWFuZE1hcHBpbmc7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIF9vbk5hdmlnYXRpbmcoZSkge1xyXG4gICAgICAgICAgICB2YXIgc2hhcmVkUGFyYW1ldGVySW5kZXggPSBlLnVyaS5pbmRleE9mKEFwcGxpY2F0aW9uLlNIQVJFRF9QQVJBTUVURVIpO1xyXG4gICAgICAgICAgICBpZihzaGFyZWRQYXJhbWV0ZXJJbmRleCA+PSAwICYmIE9iamVjdC5rZXlzKHRoaXMuc2hhcmVkT2JqZWN0cykubGVuZ3RoID09PSAwKSB7XHJcbiAgICAgICAgICAgICAgICBlLmNhbmNlbCA9IHRydWU7XHJcbiAgICAgICAgICAgICAgICBpZih0aGlzLmR4YXBwKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7IHRoaXMubmF2aWdhdGVUb0RlZmF1bHRWaWV3KCk7IH0sIDEpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGNyZWF0ZUZ1bmN0aW9uQ29tcGlsZXIoY29kZTogYW55KSB7XHJcbiAgICAgICAgICAgIGlmKCF0aGlzLmZ1bmN0aW9ucykge1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihcIkZ1bmN0aW9ucyBwYXJhbWV0ZXIgaXMgbmVjZXNzYXJ5IGZvciBjb21waWxlclwiKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICByZXR1cm4gbmV3IExvZ2ljLkZ1bmN0aW9uQ29tcGlsZXIodGhpcy5mdW5jdGlvbnMsIGNvZGUpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBuYXZpZ2F0ZVRvRGVmYXVsdFZpZXcoKSB7XHJcbiAgICAgICAgICAgIHZhciBkZWZhdWx0VmlldyA9IGZpbmRJbkFycmF5KHRoaXMuYXBwQ29uZmlnLnZpZXdzLCB2aWV3ID0+IHZpZXcuaWQgPT09IHRoaXMuZGVmYXVsdFZpZXcpO1xyXG4gICAgICAgICAgICBpZighZGVmYXVsdFZpZXcpIHtcclxuICAgICAgICAgICAgICAgIGlmKHRoaXMuZGVmYXVsdFZpZXcpIHtcclxuICAgICAgICAgICAgICAgICAgICBzaG93RXJyb3JEaWFsb2coXCJEZWZhdWx0IHZpZXcgJ1wiICsgdGhpcy5kZWZhdWx0VmlldyArIFwiJyBkb2Vzbid0IGV4aXN0LlwiKTtcclxuICAgICAgICAgICAgICAgIH0gZWxzZSBpZih0aGlzLmFwcENvbmZpZy52aWV3cy5sZW5ndGgpIHtcclxuICAgICAgICAgICAgICAgICAgICBkZWZhdWx0VmlldyA9IHRoaXMuYXBwQ29uZmlnLnZpZXdzWzBdO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmKHRoaXMuYXBwQ29uZmlnLnZpZXdzLmxlbmd0aCA+IDEpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgc2hvd0Vycm9yRGlhbG9nKFwiWW91IGNhbiBzcGVjaWZ5IGFwcCBkZWZhdWx0IHZpZXcgaW4gdGhlIGRlc2lnbmVyLiBDbGljayB0aGUgY29nd2hlZWwgYnV0dG9uIG5leHQgdG8gdGhlIGFwcCB0aXRsZSwgdGhlbiBjaGFuZ2UgTmF2aWdhdGlvbiAtIERlZmF1bHQgVmlldyBwcm9wZXJ0eS5cIik7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICBzaG93RXJyb3JEaWFsb2coXCJZb3VyIGFwcCBkb2Vzbid0IGhhdmUgYW55IHZpZXdzLiBQbGVhc2UgY3JlYXRlIG9uZSBpbiB0aGUgZGVzaWduZXIuXCIpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGlmKGRlZmF1bHRWaWV3KSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmR4YXBwLm5hdmlnYXRlKHsgdmlldzogZGVmYXVsdFZpZXcuaWQgfSwgeyB0YXJnZXQ6IFwiY3VycmVudFwiIH0pO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIG9uKGV2ZW50TmFtZTogc3RyaW5nLCBoYW5kbGVyOiBGdW5jdGlvbikge1xyXG4gICAgICAgICAgICBzd2l0Y2goZXZlbnROYW1lKSB7XHJcbiAgICAgICAgICAgICAgICBjYXNlIFwic3RhcnRlZFwiOlxyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc3RhcnRlZC5hZGQoaGFuZGxlcik7XHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICBjYXNlIFwiZGF0YUVycm9yXCI6XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5kYXRhRXJyb3IuYWRkKGhhbmRsZXIpO1xyXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLmR4YXBwLm9uKGV2ZW50TmFtZSwgaGFuZGxlcik7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgb2ZmKGV2ZW50TmFtZTogc3RyaW5nLCBoYW5kbGVyPzogRnVuY3Rpb24pIHtcclxuICAgICAgICAgICAgc3dpdGNoKGV2ZW50TmFtZSkge1xyXG4gICAgICAgICAgICAgICAgY2FzZSBcInN0YXJ0ZWRcIjpcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLnN0YXJ0ZWQucmVtb3ZlKGhhbmRsZXIpO1xyXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgY2FzZSBcImRhdGFFcnJvclwiOlxyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZGF0YUVycm9yLnJlbW92ZShoYW5kbGVyKTtcclxuICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5keGFwcC5vZmYoZXZlbnROYW1lLCBoYW5kbGVyKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBnZXROYXZpZ2F0aW9uSXRlbVRpdGxlKGl0ZW06IElOYXZpZ2F0aW9uSXRlbSk6IHN0cmluZyB7XHJcbiAgICAgICAgICAgIHZhciB0aXRsZSA9IGl0ZW0udGl0bGUsXHJcbiAgICAgICAgICAgICAgICB2aWV3SWQsXHJcbiAgICAgICAgICAgICAgICB2aWV3O1xyXG4gICAgICAgICAgICBpZighdGl0bGUpIHtcclxuICAgICAgICAgICAgICAgIHZpZXdJZCA9IGl0ZW0uaWQ7XHJcbiAgICAgICAgICAgICAgICB2aWV3ID0gZmluZEluQXJyYXkodGhpcy5hcHBDb25maWcudmlld3MsIHZpZXcgPT4gdmlldy5pZCA9PT0gdmlld0lkKTtcclxuICAgICAgICAgICAgICAgIHRpdGxlID0gdmlldyA/IHZpZXcubmF2aWdhdGlvblRpdGxlIHx8IHZpZXcudGl0bGUgOiBcIlZpZXcgTm90IEZvdW5kXCI7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuIHRpdGxlO1xyXG4gICAgICAgIH1cclxuICAgICAgICBodG1sQXBwTmF2aWdhdGlvbigpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuYXBwQ29uZmlnLm5hdmlnYXRpb24uaXRlbXMubWFwKChpdGVtKSA9PiB7XHJcbiAgICAgICAgICAgICAgICBpZih0eXBlb2YgaXRlbSA9PT0gXCJzdHJpbmdcIikge1xyXG4gICAgICAgICAgICAgICAgICAgIGl0ZW0gPSB7IGlkOiA8YW55Pml0ZW0gfTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHZhciBmdW5jdGlvbkNvbXBpbGVyID0gaXRlbS5vbkV4ZWN1dGUgPyB0aGlzLmNyZWF0ZUZ1bmN0aW9uQ29tcGlsZXIoaXRlbS5vbkV4ZWN1dGUpIDogdW5kZWZpbmVkLFxyXG4gICAgICAgICAgICAgICAgICAgIGV4ZWN1dGlvbkhhbmRsZXI7XHJcbiAgICAgICAgICAgICAgICBpZihmdW5jdGlvbkNvbXBpbGVyKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgZXhlY3V0aW9uSGFuZGxlciA9IChlKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbkNvbXBpbGVyLnJ1bih7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAkZ2xvYmFsOiB0aGlzLm1vZGVsLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJG1vZGVsOiB1bmRlZmluZWQsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAkZGF0YTogZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICR2YWx1ZTogdW5kZWZpbmVkXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGVyVHlwZTogXCJuYXZpZ2F0aW9uIGl0ZW1cIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYWxsZXJJZDogaXRlbS5pZFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICApO1xyXG4gICAgICAgICAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB2YXIgaXRlbUNvdW50ZXIgPSAwLFxyXG4gICAgICAgICAgICAgICAgICAgIGlkID0gaXRlbS5pZCB8fCBcIml0ZW1cIiArICsraXRlbUNvdW50ZXIsXHJcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0ID0ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZDogaWQsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG9uRXhlY3V0ZTogZXhlY3V0aW9uSGFuZGxlciB8fCAodGhpcy5hcHBDb25maWdbXCJpc0Rlc2lnbk1vZGVcIl0gIT09IHRydWUgPyBcIiNcIiArIChpdGVtLmlkIHx8IGl0ZW0pIDogKCkgPT4geyB9KSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGl0bGU6IHRoaXMuZ2V0TmF2aWdhdGlvbkl0ZW1UaXRsZShpdGVtKSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgdmlzaWJsZTogKHR5cGVvZiBpdGVtLnZpc2libGUgPT09IFwic3RyaW5nXCIgJiYgaXRlbS52aXNpYmxlLmxlbmd0aCA+IDApID9cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHdyYXBNb2RlbFJlZmVyZW5jZShpdGVtLnZpc2libGUsIHsgJGdsb2JhbDogdGhpcy5tb2RlbCB9LCB7IGNhbGxlclR5cGU6IFwicHJvcGVydHkgb2YgdGhlIFwiICsgaWQgKyBcIiBjb21tYW5kXCIsIGNhbGxlcklkOiBcInZpc2libGVcIiB9KSA6XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAoaXRlbS52aXNpYmxlIHx8IHRydWUpXHJcbiAgICAgICAgICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgICAgIGlmKCQuaXNQbGFpbk9iamVjdChpdGVtKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdCA9ICQuZXh0ZW5kKHt9LCBpdGVtLCByZXN1bHQpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGh0bWxBcHBDb25maWd1cmF0aW9uKCk6IGR4aHRtbC5IdG1sQXBwbGljYXRpb25PcHRpb25zIHtcclxuICAgICAgICAgICAgdmFyIG9wdGlvbnM6IGR4aHRtbC5IdG1sQXBwbGljYXRpb25PcHRpb25zID0ge1xyXG4gICAgICAgICAgICAgICAgbmFtZXNwYWNlOiB0aGlzLm5zLFxyXG4gICAgICAgICAgICAgICAgbmF2aWdhdGlvbjogdGhpcy5odG1sQXBwTmF2aWdhdGlvbigpLFxyXG4gICAgICAgICAgICAgICAgY29tbWFuZE1hcHBpbmc6IHRoaXMuZ2V0Q29tbWFuZE1hcHBpbmcoKVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICBpZihMYXlvdXRIZWxwZXIuZ2V0RGV2aWNlVHlwZSgpID09PSBcImRlc2t0b3BcIikge1xyXG4gICAgICAgICAgICAgICAgb3B0aW9ucy5tb2RlID0gXCJ3ZWJTaXRlXCI7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuIG9wdGlvbnM7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJlbW92ZVZpZXdDYWNoZShrZXk6IHN0cmluZykge1xyXG4gICAgICAgICAgICB0aGlzLmR4YXBwLnZpZXdDYWNoZS5yZW1vdmVWaWV3KGtleSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHZpZXdDYWNoZUtleSgpOiBzdHJpbmcge1xyXG4gICAgICAgICAgICByZXR1cm4gd2luZG93LmxvY2F0aW9uLmhhc2guc3Vic3RyKDEpO1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcbn0iLCJtb2R1bGUgQXBwUGxheWVyLkxvZ2ljIHtcclxuICAgIFwidXNlIHN0cmljdFwiO1xyXG5cclxuICAgIGV4cG9ydCBpbnRlcmZhY2UgSVVzZXJGdW5jdGlvbnMge1xyXG4gICAgICAgIFtrZXk6IHN0cmluZ106ICguLi5hcmdzOiBhbnlbXSkgPT4gYW55O1xyXG4gICAgfVxyXG5cclxuICAgIGV4cG9ydCBpbnRlcmZhY2UgSUNhbGxlckluZm8ge1xyXG4gICAgICAgIGNhbGxlclR5cGU6IHN0cmluZztcclxuICAgICAgICBjYWxsZXJJZDogc3RyaW5nO1xyXG4gICAgfVxyXG5cclxuICAgIGV4cG9ydCBjbGFzcyBGdW5jdGlvbkNvbXBpbGVyIHtcclxuICAgICAgICBwcml2YXRlIHN0cmF0ZWd5OiBDb21waWxlclN0cmF0ZWd5O1xyXG4gICAgICAgIHByaXZhdGUgZnVuY3Rpb25zOiBJVXNlckZ1bmN0aW9ucztcclxuICAgICAgICBwcml2YXRlIGNhbGxzOiBhbnk7XHJcblxyXG4gICAgICAgIGNvbnN0cnVjdG9yKGZ1bmN0aW9uczogSVVzZXJGdW5jdGlvbnMsIGNhbGxzOiBhbnkpIHtcclxuICAgICAgICAgICAgdGhpcy5mdW5jdGlvbnMgPSBmdW5jdGlvbnM7XHJcbiAgICAgICAgICAgIHRoaXMuY2FsbHMgPSBjYWxscztcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHN0YXRpYyBjb25zb2xlSGFuZGxlciA9IChlcnJvck1lc3NhZ2UpID0+IGNvbnNvbGUuZXJyb3IoZXJyb3JNZXNzYWdlKTtcclxuXHJcbiAgICAgICAgcnVuKGNvbnRleHQ/OiBJUnVuQ29udGV4dCwgY2FsbGVySW5mbz86IElDYWxsZXJJbmZvKTogSlF1ZXJ5UHJvbWlzZTxhbnk+IHtcclxuICAgICAgICAgICAgdmFyIHByb21pc2UsXHJcbiAgICAgICAgICAgICAgICBlcnJvckhhbmRsZXIgPSAoZXJyb3IpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgZXJyb3JNZXNzYWdlID0gXCJcIjtcclxuICAgICAgICAgICAgICAgICAgICBzaG93RXJyb3JEaWFsb2coZXJyb3IpO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmKGNhbGxlckluZm8gJiYgY2FsbGVySW5mby5jYWxsZXJUeXBlICYmIGNhbGxlckluZm8uY2FsbGVySWQpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgZXJyb3JNZXNzYWdlID0gXCJFcnJvciBvY2N1cnJlZCB3aGVuIHRyeWluZyB0byBldmFsdWF0ZSB0aGUgJ1wiICsgY2FsbGVySW5mby5jYWxsZXJJZCArIFwiJyBcIiArIGNhbGxlckluZm8uY2FsbGVyVHlwZSArIFwiOlxcclxcblwiO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICBlcnJvck1lc3NhZ2UgKz0gZXJyb3IgKyBcIlxcclxcblwiICsgSlNPTi5zdHJpbmdpZnkodGhpcy5jYWxscywgbnVsbCwgMik7XHJcbiAgICAgICAgICAgICAgICAgICAgRnVuY3Rpb25Db21waWxlci5jb25zb2xlSGFuZGxlcihlcnJvck1lc3NhZ2UpO1xyXG4gICAgICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgaWYoIXRoaXMuc3RyYXRlZ3kpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuc3RyYXRlZ3kgPSB0aGlzLmNyZWF0ZVN0cmF0ZWd5KHRoaXMuZnVuY3Rpb25zLCB0aGlzLmNhbGxzKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgdmFyIGNvbnRleHRQYXJhbXMgPSBbXTtcclxuICAgICAgICAgICAgICAgIGlmKGNvbnRleHQpIHtcclxuICAgICAgICAgICAgICAgICAgICAkLmVhY2goY29udGV4dCwgKG5hbWUpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29udGV4dFBhcmFtcy5wdXNoKG5hbWUpO1xyXG4gICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgcHJvbWlzZSA9IHRoaXMuc3RyYXRlZ3kucnVuKGNvbnRleHQsIGNvbnRleHRQYXJhbXMpO1xyXG4gICAgICAgICAgICAgICAgcHJvbWlzZS5mYWlsKGVycm9ySGFuZGxlcik7XHJcbiAgICAgICAgICAgIH0gY2F0Y2goZSkge1xyXG4gICAgICAgICAgICAgICAgZXJyb3JIYW5kbGVyKGUpO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlamVjdFByb21pc2UoKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICByZXR1cm4gcHJvbWlzZTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHByaXZhdGUgY3JlYXRlU3RyYXRlZ3koZnVuY3Rpb25zOiBJVXNlckZ1bmN0aW9ucywgY2FsbHM6IHN0cmluZyB8IElCaXpMb2dpYyB8IEZ1bmN0aW9uKTogQ29tcGlsZXJTdHJhdGVneSB7XHJcbiAgICAgICAgICAgIGlmKGNhbGxzIGluc3RhbmNlb2YgRnVuY3Rpb24pIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBuZXcgQ29tcGlsZXJKU0Z1bmN0aW9uU3RyYXRlZ3koZnVuY3Rpb25zLCA8KHBhcmFtczoge30pID0+IGFueT5jYWxscyk7XHJcbiAgICAgICAgICAgIH0gZWxzZSBpZighY2FsbHMgfHwgJC5pc0VtcHR5T2JqZWN0KGNhbGxzKSkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIG5ldyBDb21waWxlclN0cmF0ZWd5KGZ1bmN0aW9ucyk7XHJcbiAgICAgICAgICAgIH0gZWxzZSBpZih0eXBlb2YgY2FsbHMgPT09IFwic3RyaW5nXCIpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBCaW5kaW5nRnVuY3Rpb25TdHJhdGVneS5pc9Chb21wYXRpYmxlKGNhbGxzKVxyXG4gICAgICAgICAgICAgICAgICAgID8gbmV3IEJpbmRpbmdGdW5jdGlvblN0cmF0ZWd5KGZ1bmN0aW9ucywgY2FsbHMpXHJcbiAgICAgICAgICAgICAgICAgICAgOiBuZXcgQ29tcGlsZXJUcml2aWFsU3RyYXRlZ3koZnVuY3Rpb25zLCBjYWxscyk7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgX2NhbGxzID0gKDxhbnk+Y2FsbHMpLmxvZ2ljIHx8IGNhbGxzO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIG5ldyBDb21waWxlcklubGluZUZ1bmN0aW9uU3RyYXRlZ3koZnVuY3Rpb25zLCBfY2FsbHMpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGNsYXNzIENvbXBpbGVyU3RyYXRlZ3kge1xyXG4gICAgICAgIGNvbnN0cnVjdG9yKHB1YmxpYyBmdW5jdGlvbnM6IHt9KSB7IH1cclxuXHJcbiAgICAgICAgcnVuKGNvbnRleHQ/OiB7fSwgY29udGV4dFBhcmFtcz8gOiBzdHJpbmdbXSk6IEpRdWVyeVByb21pc2U8YW55PiB7IHJldHVybiB0cml2aWFsUHJvbWlzZSgpOyB9XHJcblxyXG4gICAgICAgIGNvbXBpbGUoZnVuY3Rpb25zLCBleHByOiBzdHJpbmcsIHBhcmFtTmFtZXM6IHN0cmluZ1tdKSB7XHJcbiAgICAgICAgICAgIHZhciBmdW5jQm9keSA9IFwid2l0aCgkZnVuY3Rpb25zKXtcIiArIGV4cHIgKyBcIn1cIixcclxuICAgICAgICAgICAgICAgIGFsbFBhcmFtTmFtZXMgPSBbXCIkZnVuY3Rpb25zXCJdO1xyXG4gICAgICAgICAgICBbXS5wdXNoLmFwcGx5KGFsbFBhcmFtTmFtZXMsIHBhcmFtTmFtZXMpO1xyXG4gICAgICAgICAgICB2YXIgZnVuYyA9IG5ldyBGdW5jdGlvbihhbGxQYXJhbU5hbWVzLmpvaW4oXCIsIFwiKSwgZnVuY0JvZHkpO1xyXG4gICAgICAgICAgICByZXR1cm4gKHBhcmFtczoge30pID0+IHtcclxuICAgICAgICAgICAgICAgIHZhciBhcmdzID0gW2Z1bmN0aW9uc107XHJcbiAgICAgICAgICAgICAgICBwYXJhbU5hbWVzLmZvckVhY2goKG5hbWUpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICBhcmdzLnB1c2gocGFyYW1zW25hbWVdKTtcclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGZ1bmMuYXBwbHkoZnVuYywgYXJncyk7XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGNsYXNzIENvbXBpbGVySlNGdW5jdGlvblN0cmF0ZWd5IGV4dGVuZHMgQ29tcGlsZXJTdHJhdGVneSB7XHJcbiAgICAgICAgY2FsbHM6IChwYXJhbXM6IHt9KSA9PiBhbnk7XHJcbiAgICAgICAgLy9wcml2YXRlIGNvbXBpbGVkRnVuY3Rpb25zOiAocGFyYW1zOiB7fSkgPT4gYW55O1xyXG4gICAgICAgIGNvbnN0cnVjdG9yKGZ1bmN0aW9uczoge30sIGNhbGxzOiAocGFyYW1zOiB7fSkgPT4gYW55KSB7XHJcbiAgICAgICAgICAgIHN1cGVyKGZ1bmN0aW9ucyk7XHJcbiAgICAgICAgICAgIHRoaXMuY2FsbHMgPSBjYWxscztcclxuICAgICAgICB9XHJcbiAgICAgICAgcnVuKGNvbnRleHQ/OiB7fSwgY29udGV4dFBhcmFtcz86IHN0cmluZ1tdKTogSlF1ZXJ5UHJvbWlzZTxhbnk+IHtcclxuICAgICAgICAgICAgLyppZighdGhpcy5jb21waWxlZEZ1bmN0aW9ucykge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5jb21waWxlZEZ1bmN0aW9ucyA9IHRoaXMuY2FsbHM7XHJcbiAgICAgICAgICAgIH0qL1xyXG4gICAgICAgICAgICB2YXIgcmVzdWx0ID0gdGhpcy5jYWxscyhjb250ZXh0KTtcclxuICAgICAgICAgICAgLy8gUHJvbWlzZSBkdWNrIHR5cGluZ1xyXG4gICAgICAgICAgICBpZihyZXN1bHQgJiYgdHlwZW9mIHJlc3VsdC5hbHdheXMgPT09IFwiZnVuY3Rpb25cIiAmJiB0eXBlb2YgcmVzdWx0LmRvbmUgPT09IFwiZnVuY3Rpb25cIikge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiB0cml2aWFsUHJvbWlzZShyZXN1bHQpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGNsYXNzIENvbXBpbGVyVHJpdmlhbFN0cmF0ZWd5IGV4dGVuZHMgQ29tcGlsZXJTdHJhdGVneSB7XHJcbiAgICAgICAgcHVibGljIGNhbGxzOiBzdHJpbmc7XHJcbiAgICAgICAgcHJpdmF0ZSBjb21waWxlZEZ1bmN0aW9uczogKHBhcmFtczoge30pID0+IGFueTtcclxuICAgICAgICBjb25zdHJ1Y3RvcihmdW5jdGlvbnM6IHt9LCBjYWxsczogc3RyaW5nKSB7XHJcbiAgICAgICAgICAgIHN1cGVyKGZ1bmN0aW9ucyk7XHJcbiAgICAgICAgICAgIHRoaXMuY2FsbHMgPSBjYWxscztcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJ1bihjb250ZXh0Pzoge30sIGNvbnRleHRQYXJhbXM/OiBzdHJpbmdbXSk6IEpRdWVyeVByb21pc2U8YW55PiB7XHJcbiAgICAgICAgICAgIGlmKCF0aGlzLmNvbXBpbGVkRnVuY3Rpb25zKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmNvbXBpbGVkRnVuY3Rpb25zID0gdGhpcy5jb21waWxlKHRoaXMuZnVuY3Rpb25zLCB0aGlzLmNhbGxzLCBjb250ZXh0UGFyYW1zKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB2YXIgcmVzdWx0ID0gdGhpcy5jb21waWxlZEZ1bmN0aW9ucyhjb250ZXh0KTtcclxuICAgICAgICAgICAgLy8gUHJvbWlzZSBkdWNrIHR5cGluZ1xyXG4gICAgICAgICAgICBpZihyZXN1bHQgJiYgdHlwZW9mIHJlc3VsdC5hbHdheXMgPT09IFwiZnVuY3Rpb25cIiAmJiB0eXBlb2YgcmVzdWx0LmRvbmUgPT09IFwiZnVuY3Rpb25cIikge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiB0cml2aWFsUHJvbWlzZShyZXN1bHQpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGNsYXNzIENvbXBpbGVySW5saW5lRnVuY3Rpb25TdHJhdGVneSBleHRlbmRzIENvbXBpbGVyU3RyYXRlZ3kge1xyXG4gICAgICAgIGNvbnN0cnVjdG9yKGZ1bmN0aW9uczoge30sIHB1YmxpYyBjYWxsczoge30pIHtcclxuICAgICAgICAgICAgc3VwZXIoZnVuY3Rpb25zKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGdldEFsbFZhcmlhYmxlcyhwYXJhbXM6IHsgW2tleTogc3RyaW5nXTogYW55IH0sIHZhcmlhYmxlczogVmFyaWFibGVbXSkge1xyXG4gICAgICAgICAgICB2YXIgcmVzdWx0OiB7IFtrZXk6IHN0cmluZ106IFZhcmlhYmxlIH0gPSB7fTtcclxuICAgICAgICAgICAgdmFyaWFibGVzLmZvckVhY2goKHYpID0+IHtcclxuICAgICAgICAgICAgICAgIHJlc3VsdFt2Lm5hbWVdID0gdjtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICQuZWFjaChwYXJhbXMsIChuYW1lKSA9PiB7XHJcbiAgICAgICAgICAgICAgICBpZighcmVzdWx0W25hbWVdKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0W25hbWVdID0gbmV3IFZhcmlhYmxlKHsgbmFtZTogbmFtZSwgdmFsdWU6IG51bGwsIHBhcmFtZXRlcjogdHJ1ZSwgdHlwZTogXCJvYmplY3RcIiB9KTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBydW4oY29udGV4dD86IHt9LCBjb250ZXh0UGFyYW1zPzogc3RyaW5nW10pOiBKUXVlcnlQcm9taXNlPGFueT4ge1xyXG5cclxuICAgICAgICAgICAgaWYoIXRoaXMuY2FsbHMpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHZhciB2YXJpYWJsZXM6IFZhcmlhYmxlW10gPSBbXSxcclxuICAgICAgICAgICAgICAgIGNhbGxzOiBPcGVyYXRpb25bXSA9IFtdO1xyXG5cclxuICAgICAgICAgICAgaWYoKDxhbnk+dGhpcy5jYWxscykudmFyaWFibGVzKSB7XHJcbiAgICAgICAgICAgICAgICB2YXJpYWJsZXMgPSAoPGFueT50aGlzLmNhbGxzKS52YXJpYWJsZXMubWFwKCh2YWx1ZSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBWYXJpYWJsZS5mcm9tSnNvbih2YWx1ZSk7XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBpZigoPGFueT50aGlzLmNhbGxzKS5jYWxscykge1xyXG4gICAgICAgICAgICAgICAgY2FsbHMgPSAoPGFueT50aGlzLmNhbGxzKS5jYWxscy5tYXAoKGNhbGwpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gT3BlcmF0aW9uLmZyb21Kc29uKGNhbGwpO1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIHZhciBhbGxWYXJpYWJsZXMgPSB0aGlzLmdldEFsbFZhcmlhYmxlcyhjb250ZXh0LCB2YXJpYWJsZXMpO1xyXG4gICAgICAgICAgICBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhhbGxWYXJpYWJsZXMpLmZvckVhY2goKG5hbWUpID0+IHtcclxuICAgICAgICAgICAgICAgIHZhciB2YXJpYWJsZSA9IGFsbFZhcmlhYmxlc1tuYW1lXTtcclxuICAgICAgICAgICAgICAgIHZhcmlhYmxlLnJlc2V0VmFsdWUoKTtcclxuICAgICAgICAgICAgICAgIHZhcmlhYmxlLnZhbHVlID0gY29udGV4dCAmJiB2YXJpYWJsZS5wYXJhbWV0ZXIgPyBjb250ZXh0W3ZhcmlhYmxlLm5hbWVdIDogdmFyaWFibGUudmFsdWU7XHJcbiAgICAgICAgICAgICAgICBhbGxWYXJpYWJsZXNbdmFyaWFibGUubmFtZV0gPSB2YXJpYWJsZTtcclxuICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICByZXR1cm4gT3BlcmF0aW9uLnJ1bihjYWxscywgYWxsVmFyaWFibGVzLCB0aGlzLmZ1bmN0aW9ucylcclxuICAgICAgICAgICAgICAgIC50aGVuKChyZXN1bHQpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICBpZihyZXN1bHQgJiYgcmVzdWx0LmZsb3cgPT09IEZsb3cuUmV0dXJuKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0cml2aWFsUHJvbWlzZShyZXN1bHQudmFsdWUpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJpdmlhbFByb21pc2UoKTtcclxuICAgICAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgY2xhc3MgQmluZGluZ0Z1bmN0aW9uU3RyYXRlZ3kgZXh0ZW5kcyBDb21waWxlclRyaXZpYWxTdHJhdGVneSB7XHJcbiAgICAgICAgc3RhdGljIGlz0KFvbXBhdGlibGUoZnVuY3Rpb25OYW1lOiBzdHJpbmcpIHtcclxuICAgICAgICAgICAgcmV0dXJuIC9eXFwkKGdsb2JhbHxtb2RlbClcXC5bXFx3XFwkXSskLy50ZXN0KGZ1bmN0aW9uTmFtZSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBjb25zdHJ1Y3RvcihmdW5jdGlvbnM6IHt9LCBmdW5jdGlvbk5hbWU6IHN0cmluZykge1xyXG4gICAgICAgICAgICBzdXBlcihmdW5jdGlvbnMsIGZ1bmN0aW9uTmFtZSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBjb21waWxlKGZ1bmN0aW9ucywgZnVuY3Rpb25OYW1lOiBzdHJpbmcsIGFyZ05hbWVzOiBzdHJpbmdbXSkge1xyXG4gICAgICAgICAgICB2YXIgZnVuY0JvZHkgPSBcInJldHVybiBcIiArIGZ1bmN0aW9uTmFtZSArIFwiKCRjb250ZXh0KTtcIixcclxuICAgICAgICAgICAgICAgIGFsbFBhcmFtTmFtZXMgPSBbXCIkY29udGV4dFwiXTtcclxuICAgICAgICAgICAgW10ucHVzaC5hcHBseShhbGxQYXJhbU5hbWVzLCBhcmdOYW1lcyk7XHJcbiAgICAgICAgICAgIHZhciBmdW5jID0gbmV3IEZ1bmN0aW9uKGFsbFBhcmFtTmFtZXMuam9pbihcIiwgXCIpLCBmdW5jQm9keSk7XHJcbiAgICAgICAgICAgIHJldHVybiBjb250ZXh0ID0+IHtcclxuICAgICAgICAgICAgICAgIHZhciBhcmdzID0gW2NvbnRleHRdO1xyXG4gICAgICAgICAgICAgICAgYXJnTmFtZXMuZm9yRWFjaChuYW1lID0+IHtcclxuICAgICAgICAgICAgICAgICAgICBhcmdzLnB1c2goY29udGV4dFtuYW1lXSk7XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgIHJldHVybiBmdW5jLmFwcGx5KGZ1bmMsIGFyZ3MpO1xyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBleHBvcnQgZnVuY3Rpb24gdHJpdmlhbFByb21pc2UoLi4uYXJnczogYW55W10pOiBKUXVlcnlQcm9taXNlPGFueT4ge1xyXG4gICAgICAgIHZhciBkID0gJC5EZWZlcnJlZCgpO1xyXG4gICAgICAgIHJldHVybiBkLnJlc29sdmUuYXBwbHkoZCwgYXJndW1lbnRzKS5wcm9taXNlKCk7XHJcbiAgICB9XHJcblxyXG4gICAgZXhwb3J0IGZ1bmN0aW9uIHJlamVjdFByb21pc2UoLi4uYXJnczogYW55W10pOiBKUXVlcnlQcm9taXNlPGFueT4ge1xyXG4gICAgICAgIHZhciBkID0gJC5EZWZlcnJlZCgpO1xyXG4gICAgICAgIHJldHVybiBkLnJlamVjdC5hcHBseShkLCBhcmd1bWVudHMpLnByb21pc2UoKTtcclxuICAgIH1cclxuXHJcbiAgICBleHBvcnQgZnVuY3Rpb24gcmV0dXJuc1ZhbHVlKGNhbGxzOiBJQml6TG9naWNDYWxsW10pIHtcclxuICAgICAgICBpZighY2FsbHMpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIH1cclxuICAgICAgICB2YXIgcmVzdWx0ID0gZmFsc2UsXHJcbiAgICAgICAgICAgIHZpc2l0b3IgPSAodGFyZ2V0KSA9PiB7XHJcbiAgICAgICAgICAgICAgICBpZih0YXJnZXRbXCJfdHlwZVwiXSA9PT0gXCJFdmVudFwiICYmIHRhcmdldFtcImZsb3dcIl0gPT09IEZsb3cuUmV0dXJuKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0ID0gdHJ1ZTtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAkLmVhY2godGFyZ2V0LCAoXywgdmFsdWUpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICBpZihyZXN1bHQpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICBpZih2YWx1ZSAmJiAoJC5pc0FycmF5KHZhbHVlKSB8fCB0eXBlb2YgdmFsdWUgPT09IFwib2JqZWN0XCIpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZpc2l0b3IodmFsdWUpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIHZpc2l0b3IoY2FsbHMpO1xyXG4gICAgICAgIHJldHVybiByZXN1bHQ7XHJcbiAgICB9XHJcbn0gIiwiLy8vIDxyZWZlcmVuY2UgcGF0aD1cImxvZ2ljL2Z1bmN0aW9uY29tcGlsZXIudHNcIiAvPlxyXG5tb2R1bGUgQXBwUGxheWVyLk1vZHVsZXMge1xyXG4gICAgXCJ1c2Ugc3RyaWN0XCI7XHJcblxyXG4gICAgY2xhc3MgQXV0aG9yaXphdGlvbkxvY2F0aW9uIHtcclxuICAgICAgICB2aWV3OiBzdHJpbmc7XHJcbiAgICAgICAgYWxsb3dBbm9ueW1vdXM6IGJvb2xlYW47XHJcbiAgICB9XHJcblxyXG4gICAgZXhwb3J0IGNsYXNzIEF1dGhvcml6YXRpb24ge1xyXG4gICAgICAgIGxvZ2luVmlldzogc3RyaW5nO1xyXG4gICAgICAgIG9uTmF2aWdhdGluZzogKGUpID0+IHZvaWQ7XHJcbiAgICAgICAgcHJpdmF0ZSBhbGxvd0Fub255bW91czogYm9vbGVhbjtcclxuICAgICAgICBwcml2YXRlIGxvY2F0aW9uczogQXV0aG9yaXphdGlvbkxvY2F0aW9uW10gPSBbXTtcclxuICAgICAgICBwcml2YXRlIGFwcDogSUFwcGxpY2F0aW9uO1xyXG5cclxuICAgICAgICBjb25zdHJ1Y3RvcihhcHBDb25mOiBJQXBwQ29uZmlnLCBhcHA6IElBcHBsaWNhdGlvbikge1xyXG4gICAgICAgICAgICB0aGlzLmxvZ2luVmlldyA9IFwiXCI7XHJcbiAgICAgICAgICAgIHRoaXMuYWxsb3dBbm9ueW1vdXMgPSB0cnVlO1xyXG4gICAgICAgICAgICBpZihhcHBDb25mLmF1dGhvcml6YXRpb24pIHtcclxuICAgICAgICAgICAgICAgIHZhciBhdXRoID0gYXBwQ29uZi5hdXRob3JpemF0aW9uO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5sb2dpblZpZXcgPSBhdXRoLmxvZ2luVmlldztcclxuICAgICAgICAgICAgICAgIHRoaXMuYWxsb3dBbm9ueW1vdXMgPSBhdXRoLmFsbG93QW5vbnltb3VzO1xyXG4gICAgICAgICAgICAgICAgKGF1dGgubG9jYXRpb25zIHx8IFtdKS5mb3JFYWNoKGl0ZW0gPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciBhbGxvd0Fub255bW91cyA9IGl0ZW0uYWxsb3dBbm9ueW1vdXM7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYodHlwZW9mIGFsbG93QW5vbnltb3VzID09PSBcInN0cmluZ1wiKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGFsbG93QW5vbnltb3VzID0gKDxhbnk+YWxsb3dBbm9ueW1vdXMpLnRvTG93ZXJDYXNlKCkgPT09IFwidHJ1ZVwiO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICB0aGlzLmxvY2F0aW9ucy5wdXNoKHsgdmlldzogaXRlbS52aWV3LCBhbGxvd0Fub255bW91czogYWxsb3dBbm9ueW1vdXMgfSk7XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB0aGlzLmFwcCA9IGFwcDtcclxuICAgICAgICAgICAgYXBwLm9uKFwiZGF0YUVycm9yXCIsIChlKSA9PiB7XHJcbiAgICAgICAgICAgICAgICBpZihlW1wiaHR0cFN0YXR1c1wiXSA9PT0gNDAxIHx8IGVbXCJzdGF0dXNcIl0gPT09IDQwMSB8fCBlLm1lc3NhZ2UgPT09IFwiVW5hdXRob3JpemVkXCIpIHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLmxvZ291dCgpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgdGhpcy5vbk5hdmlnYXRpbmcgPSAoZTogYW55KSA9PiB7XHJcbiAgICAgICAgICAgICAgICBpZighdGhpcy5jYW5OYXZpZ2F0ZShlLnVyaSkpIHtcclxuICAgICAgICAgICAgICAgICAgICBpZih0aGlzLmxvZ2luVmlldykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBlLnVyaSA9IHRoaXMubG9naW5WaWV3O1xyXG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGUuY2FuY2VsID0gdHJ1ZTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgc2hvd0Vycm9yRGlhbG9nKFwiTG9naW4gdmlldyBpcyBub3Qgc3BlY2lmaWVkIGFuZCBhbm9ueW1vdXMgYWNjZXNzIGlzIGRpc2FibGVkXCIpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgdGhpcy5hcHAub24oXCJuYXZpZ2F0aW5nXCIsIHRoaXMub25OYXZpZ2F0aW5nKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGdldCBhdXRoZW50aWNhdGVkKCk6IGJvb2xlYW4ge1xyXG4gICAgICAgICAgICByZXR1cm4gISF0aGlzLmFwcC5tb2RlbC5hdXRoZW50aWNhdGVkO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgY2FuTmF2aWdhdGUocGF0aDogc3RyaW5nKTogYm9vbGVhbiB7XHJcbiAgICAgICAgICAgIGlmKHRoaXMuYXV0aGVudGljYXRlZCkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIHZhciBsb2NhdGlvbnMgPSB0aGlzLmxvY2F0aW9ucy5maWx0ZXIobG9jYXRpb24gPT4gcGF0aC5pbmRleE9mKGxvY2F0aW9uLnZpZXcpID09PSAwKTtcclxuICAgICAgICAgICAgcmV0dXJuIGxvY2F0aW9ucy5sZW5ndGggPyBsb2NhdGlvbnNbMF0uYWxsb3dBbm9ueW1vdXMgOiB0aGlzLmFsbG93QW5vbnltb3VzO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgbG9nb3V0KCkge1xyXG4gICAgICAgICAgICB0aGlzLmFwcC5tb2RlbC5hdXRoZW50aWNhdGVkID0gZmFsc2U7XHJcbiAgICAgICAgICAgIGlmKHRoaXMubG9naW5WaWV3KSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmFwcC5uYXZpZ2F0ZSh7IHZpZXc6IHRoaXMubG9naW5WaWV3IH0sIHsgcm9vdDogdHJ1ZSB9KTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHNob3dFcnJvckRpYWxvZyhcIkxvZ2luIHZpZXcgaXMgbm90IHNwZWNpZmllZFwiKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH1cclxufSIsIm1vZHVsZSBBcHBQbGF5ZXIge1xyXG4gICAgXCJ1c2Ugc3RyaWN0XCI7XHJcblxyXG4gICAgaW1wb3J0IGR4dWkgPSBEZXZFeHByZXNzLnVpO1xyXG4gICAgdmFyIGR4ZGF0ZSA9IERldkV4cHJlc3MucmVxdWlyZShcIi91dGlscy91dGlscy5kYXRlXCIpO1xyXG5cclxuICAgIC8vIEZpeGVzIGR4U2VsZWN0Qm94IGZyb20gbG9vc2luZyBpdHMgdmFsdWUgd2hlbiBpdCBpc24ndCBwcmVzZW50IGluIHRoZSBpdGVtcy9kYXRhU291cmNlIGxpc3RcclxuICAgIGV4cG9ydCBjbGFzcyBYZXRTZWxlY3RCb3ggZXh0ZW5kcyBkeHVpLmR4U2VsZWN0Qm94IHtcclxuICAgICAgICBfcHJvY2Vzc0RhdGFTb3VyY2VDaGFuZ2luZygpIHtcclxuICAgICAgICAgICAgdGhpc1tcIl9zZXRMaXN0RGF0YVNvdXJjZVwiXSgpO1xyXG4gICAgICAgICAgICB0aGlzW1wiX3JlbmRlclZhbHVlXCJdKCk7XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuXHJcbiAgICAvLyBGaXhlcyBjcmFzaCB3aGVuIHZhbHVlIGNvbnRhaW5zIGEgc3RyaW5nIChlLmcuIFwiJG1vZGVsLmVudGl0eS5DcmVhdGVkT24pXHJcbiAgICB2YXIgZGF0ZUluUmFuZ2UgPSBkeGRhdGUuZGF0ZUluUmFuZ2U7XHJcbiAgICBkeGRhdGUuZGF0ZUluUmFuZ2UgPSBmdW5jdGlvbihkYXRlLCBtaW4sIG1heCwgZm9ybWF0KSB7XHJcbiAgICAgICAgaWYodHlwZW9mIGRhdGUgPT09IFwic3RyaW5nXCIpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgcmV0dXJuIGRhdGVJblJhbmdlKGRhdGUsIG1pbiwgbWF4LCBmb3JtYXQpO1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcblxyXG4gICAgRGV2RXhwcmVzcy5yZWdpc3RlckNvbXBvbmVudChcInhldFNlbGVjdEJveFwiLCBYZXRTZWxlY3RCb3gpO1xyXG59IiwibW9kdWxlIEFwcFBsYXllciB7XHJcbiAgICBcInVzZSBzdHJpY3RcIjtcclxuXHJcbiAgICBrby5iaW5kaW5nSGFuZGxlcnNbXCJkeE9wdGlvbnNcIl0gPSA8S25vY2tvdXRCaW5kaW5nSGFuZGxlcj57XHJcbiAgICAgICAgdXBkYXRlOiBmdW5jdGlvbihlbGVtZW50LCB2YWx1ZUFjY2Vzc29yKSB7XHJcbiAgICAgICAgICAgIHZhciB2YWx1ZSA9IGtvLnV0aWxzLnVud3JhcE9ic2VydmFibGUodmFsdWVBY2Nlc3NvcigpIHx8IHt9KTtcclxuICAgICAgICAgICAgJC5lYWNoKHZhbHVlLCAob3B0aW9uTmFtZSwgb3B0aW9uVmFsdWUpID0+IHtcclxuICAgICAgICAgICAgICAgIG9wdGlvblZhbHVlID0ga28udW53cmFwKG9wdGlvblZhbHVlKSB8fCAwO1xyXG4gICAgICAgICAgICAgICAgZWxlbWVudFtcImRhdGEtb3B0aW9uc1wiXSA9IG9wdGlvbk5hbWUgKyBvcHRpb25WYWx1ZTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuXHJcbiAgICBrby5iaW5kaW5nSGFuZGxlcnNbXCJkeFBhcnRpYWxWaWV3XCJdID0ge1xyXG4gICAgICAgIGluaXQ6IGZ1bmN0aW9uIChlbGVtZW50LCB2YWx1ZUFjY2Vzc29yLCBhbGxCaW5kaW5ncywgdmlld01vZGVsLCBiaW5kaW5nQ29udGV4dCkge1xyXG4gICAgICAgICAgICAvL3ZhciB2aWV3ID0ga28udXRpbHMudW53cmFwT2JzZXJ2YWJsZSh2YWx1ZUFjY2Vzc29yKCkgfHwge30pW1widmlld05hbWVcIl07XHJcbiAgICAgICAgICAgICQoZWxlbWVudCkuYXBwZW5kKCQoXCIjeGV0LXZpZXdcIikudGV4dCgpKTtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG5cclxuICAgIGtvLmJpbmRpbmdIYW5kbGVyc1tcInRoZW1lQ3VzdG9taXplclwiXSA9IHtcclxuICAgICAgICBpbml0OiBmdW5jdGlvbihlbGVtZW50LCB2YWx1ZUFjY2Vzc29yLCBhbGxCaW5kaW5ncywgdmlld01vZGVsLCBiaW5kaW5nQ29udGV4dCkge1xyXG4gICAgICAgICAgICBrby5jb21wdXRlZCgoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICB2YXIgRFlOQU1JQ19TVFlMRVNfSUQgPSBcImR5bmFtaWMtc3R5bGVzXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgY3NzID0gdmFsdWVBY2Nlc3NvcigpLnRoZW1lO1xyXG4gICAgICAgICAgICAgICAgaWYoY3NzKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgJChcIiNcIiArIERZTkFNSUNfU1RZTEVTX0lEKS5yZW1vdmUoKTtcclxuICAgICAgICAgICAgICAgICAgICAkKFwiPHN0eWxlPlwiICsgY3NzICsgXCI8L3N0eWxlPlwiKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAuYXR0cihcInR5cGVcIiwgXCJ0ZXh0L2Nzc1wiKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAuYXR0cihcImlkXCIsIERZTkFNSUNfU1RZTEVTX0lEKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAuYXBwZW5kVG8oXCJoZWFkXCIpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG5cclxuICAgIGtvLmJpbmRpbmdIYW5kbGVyc1tcInhldFNjcm9sbFZpZXdSZXNldHRlclwiXSA9IHtcclxuICAgICAgICBpbml0OiBmdW5jdGlvbihlbGVtZW50LCB2YWx1ZUFjY2Vzc29yLCBhbGxCaW5kaW5ncywgdmlld01vZGVsLCBiaW5kaW5nQ29udGV4dCkge1xyXG4gICAgICAgICAgICB2YWx1ZUFjY2Vzc29yKClbXCJyZXNldFwiXSA9ICgpID0+IHtcclxuICAgICAgICAgICAgICAgICQoZWxlbWVudCkuZmluZChcIi5keC1zY3JvbGx2aWV3XCIpLmVhY2goKGluZGV4LCBzY3JvbGxWaWV3RWxlbWVudCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciBzY3JvbGxWaWV3ID0gJChzY3JvbGxWaWV3RWxlbWVudCkuZHhTY3JvbGxWaWV3KFwiaW5zdGFuY2VcIik7XHJcbiAgICAgICAgICAgICAgICAgICAgc2Nyb2xsVmlldy51cGRhdGUoKTtcclxuICAgICAgICAgICAgICAgICAgICBzY3JvbGxWaWV3LnNjcm9sbFRvKDApO1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuXHJcbiAgICBrby5iaW5kaW5nSGFuZGxlcnNbXCJkZWJ1Z2dlclwiXSA9IHtcclxuICAgICAgICB1cGRhdGU6IGZ1bmN0aW9uKGVsZW1lbnQsIHZhbHVlQWNjZXNzb3IsIGFsbEJpbmRpbmdzLCB2aWV3TW9kZWwsIGJpbmRpbmdDb250ZXh0KSB7XHJcbiAgICAgICAgICAgIGtvLnVud3JhcCh2YWx1ZUFjY2Vzc29yKCkudHJhY2spO1xyXG4gICAgICAgICAgICAvKiB0c2xpbnQ6ZGlzYWJsZTogbm8tZGVidWdnZXIgKi9cclxuICAgICAgICAgICAgZGVidWdnZXI7XHJcbiAgICAgICAgICAgIC8qIHRzbGludDplbmFibGUgKi9cclxuICAgICAgICB9XHJcbiAgICB9O1xyXG5cclxufSIsIm1vZHVsZSBBcHBQbGF5ZXIge1xyXG4gICAgXCJ1c2Ugc3RyaWN0XCI7XHJcbiAgICBpbXBvcnQgZHhkYXRhID0gRGV2RXhwcmVzcy5kYXRhO1xyXG5cclxuICAgIGV4cG9ydCBjbGFzcyBEYXRhU291cmNlIHtcclxuICAgICAgICBwcml2YXRlIHN0YXRpYyBpbml0RGF0YU9ic2VydmFibGVzKHNyY0RhdGE6IGFueSwgb2JzZXJ2YWJsZVNlbGVjdG9yczogc3RyaW5nW10pIHtcclxuICAgICAgICAgICAgaWYoISQuaXNQbGFpbk9iamVjdChzcmNEYXRhKSkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHNyY0RhdGE7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIHZhciBkYXRhID0ge307XHJcbiAgICAgICAgICAgIHZhciBkZXNjcmlwdG9yczogUHJvcGVydHlEZXNjcmlwdG9yTWFwID0ge307XHJcbiAgICAgICAgICAgICQuZWFjaChzcmNEYXRhLCAocHJvcGVydHlOYW1lLCB2YWx1ZSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgdmFyIGRlc2NyaXB0b3IgPSBNb2RlbC5nZXREZXNjcmlwdG9yKHZhbHVlLCBwcm9wZXJ0eU5hbWUsIG9ic2VydmFibGVTZWxlY3RvcnMpO1xyXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRvcnNbcHJvcGVydHlOYW1lXSA9IGRlc2NyaXB0b3I7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydGllcyhkYXRhLCBkZXNjcmlwdG9ycyk7XHJcbiAgICAgICAgICAgIHJldHVybiBkYXRhO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgc3RhdGljIGNyZWF0ZURhdGFTb3VyY2UoZGF0YVNvdXJjZUNvbmZpZzogSURhdGFTb3VyY2UsIGNvbnRleHQ6IHsgJG1vZGVsPzogYW55LCAkZ2xvYmFsPzogYW55IH0sIHN0b3JlczogeyBba2V5OiBzdHJpbmddOiBEZXZFeHByZXNzLmRhdGEuU3RvcmUgfSwgYXBwbGljYXRpb246IElNb2RlbEFwcGxpY2F0aW9uQ29udGV4dCkge1xyXG4gICAgICAgICAgICB2YXIgZGF0YVNvdXJjZUNvbnRleHQgPSAkLmV4dGVuZCh7fSwgY29udGV4dCwge1xyXG4gICAgICAgICAgICAgICAgY2FsbGVyVHlwZTogXCJkYXRhc291cmNlIGluaXRpYWxpemVyXCIsXHJcbiAgICAgICAgICAgICAgICBjYWxsZXJJZDogZGF0YVNvdXJjZUNvbmZpZy5pZFxyXG4gICAgICAgICAgICB9KSxcclxuICAgICAgICAgICAgICAgIGNhbGN1bGF0ZWRGaWVsZENvbnRleHQgPSAkLmV4dGVuZCh7fSwgY29udGV4dCksXHJcbiAgICAgICAgICAgICAgICBjYWxsZXJJbmZvID0ge1xyXG4gICAgICAgICAgICAgICAgICAgIGNhbGxlclR5cGU6IFwiY2FsY3VsYXRlZCBmaWVsZFwiLFxyXG4gICAgICAgICAgICAgICAgICAgIGNhbGxlcklkOiBcIlwiXHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgZHNDb25maWc6IGFueSA9IE1vZGVsLmNyZWF0ZUxpbmtlZE1vZGVsKGRhdGFTb3VyY2VDb25maWcsIGRhdGFTb3VyY2VDb250ZXh0LCBjYWxsZXJJbmZvKTtcclxuICAgICAgICAgICAgLy8gVE9ETzogVml0aWsgT0RhdGEgbmF2aWdhdGlvbiBwcm9wZXJ0eSBzY2VuYXJpby4gXHJcbiAgICAgICAgICAgIGlmKHR5cGVvZiBkc0NvbmZpZy5zdG9yZSA9PT0gXCJzdHJpbmdcIikge1xyXG4gICAgICAgICAgICAgICAgZHNDb25maWcuc3RvcmUgPSBzdG9yZXNbZGF0YVNvdXJjZUNvbmZpZy5zdG9yZV07XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIHZhciBtYXA7XHJcbiAgICAgICAgICAgIGlmKGRhdGFTb3VyY2VDb25maWcub2JzZXJ2YWJsZXMgJiYgZGF0YVNvdXJjZUNvbmZpZy5vYnNlcnZhYmxlcy5sZW5ndGgpIHtcclxuICAgICAgICAgICAgICAgIG1hcCA9IGNvbnRpbnVlRnVuYyhtYXAsIGRhdGEgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmluaXREYXRhT2JzZXJ2YWJsZXMoZGF0YSwgZGF0YVNvdXJjZUNvbmZpZy5vYnNlcnZhYmxlcyk7XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBpZihkYXRhU291cmNlQ29uZmlnLmNhbGN1bGF0ZWRGaWVsZHMgJiYgZGF0YVNvdXJjZUNvbmZpZy5jYWxjdWxhdGVkRmllbGRzLmxlbmd0aCkge1xyXG4gICAgICAgICAgICAgICAgbWFwID0gY29udGludWVGdW5jKG1hcCwgZGF0YSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIGZ1bmN0aW9uQ29tcGlsZXJzID0gTW9kZWwuZ2V0RnVuY3Rpb25Db21waWxlcnMoZGF0YVNvdXJjZUNvbmZpZy5jYWxjdWxhdGVkRmllbGRzLCBhcHBsaWNhdGlvbik7XHJcbiAgICAgICAgICAgICAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnRpZXMoZGF0YSwgTW9kZWwuZ2V0UHJvcGVydGllc0Rlc2NyaXB0b3JzKGZ1bmN0aW9uQ29tcGlsZXJzLCAkLmV4dGVuZCh7fSwgeyAkZGF0YTogZGF0YSB9LCBjYWxjdWxhdGVkRmllbGRDb250ZXh0KSwgY2FsbGVySW5mbykpO1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBkYXRhO1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICBpZihkc0NvbmZpZy5zdG9yZSAmJiB0eXBlb2YgZHNDb25maWcuc3RvcmUub24gPT09IFwiZnVuY3Rpb25cIikge1xyXG4gICAgICAgICAgICAgICAgICAgIGRzQ29uZmlnLnN0b3JlLm9uKFwidXBkYXRpbmdcIiwgKGtleSwgdmFsdWVzKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGRhdGFTb3VyY2VDb25maWcuY2FsY3VsYXRlZEZpZWxkcy5mb3JFYWNoKGZpZWxkID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlbGV0ZSB2YWx1ZXNbZmllbGQubmFtZV07XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgICAgIGRzQ29uZmlnLnN0b3JlLm9uKFwidXBkYXRlZFwiLCAoa2V5LCB2YWx1ZXMpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGZ1bmN0aW9uQ29tcGlsZXJzID0gTW9kZWwuZ2V0RnVuY3Rpb25Db21waWxlcnMoZGF0YVNvdXJjZUNvbmZpZy5jYWxjdWxhdGVkRmllbGRzLCBhcHBsaWNhdGlvbik7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzKHZhbHVlcywgTW9kZWwuZ2V0UHJvcGVydGllc0Rlc2NyaXB0b3JzKGZ1bmN0aW9uQ29tcGlsZXJzLCAkLmV4dGVuZCh7fSwgeyAkZGF0YTogdmFsdWVzIH0sIGNhbGN1bGF0ZWRGaWVsZENvbnRleHQpLCBjYWxsZXJJbmZvKSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgIGlmKG1hcCkge1xyXG4gICAgICAgICAgICAgICAgZHNDb25maWdbXCJtYXBcIl0gPSBtYXA7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgdmFyIGRhdGFTb3VyY2UgPSBuZXcgZHhkYXRhLkRhdGFTb3VyY2UoZHNDb25maWcpO1xyXG5cclxuICAgICAgICAgICAgLy8gRGF0YVNvdXJjZSB3b24ndCBzdWJzY3JpYmUgdG8gb2JzZXJ2YWJsZXMuIERvIHRoaXMgZm9yIGhpbS5cclxuICAgICAgICAgICAga28uY29tcHV0ZWQoKCkgPT4gZHNDb25maWcuZmlsdGVyKS5zdWJzY3JpYmUoZmlsdGVyID0+IHtcclxuICAgICAgICAgICAgICAgIGRhdGFTb3VyY2UuZmlsdGVyKGZpbHRlcik7XHJcbiAgICAgICAgICAgICAgICBpZihkYXRhU291cmNlW1wiX3hldExvYWRlZEF0TGVhc3RPbmNlXCJdKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgZGF0YVNvdXJjZS5sb2FkKCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICBrby5jb21wdXRlZCgoKSA9PiBkc0NvbmZpZy5zb3J0KS5zdWJzY3JpYmUoc29ydCA9PiB7XHJcbiAgICAgICAgICAgICAgICBkYXRhU291cmNlLnNvcnQoc29ydCk7XHJcbiAgICAgICAgICAgICAgICBpZihkYXRhU291cmNlW1wiX3hldExvYWRlZEF0TGVhc3RPbmNlXCJdKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgZGF0YVNvdXJjZS5sb2FkKCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgdmFyIG9yaWdpbmFsTG9hZCA9IGRhdGFTb3VyY2UubG9hZC5iaW5kKGRhdGFTb3VyY2UpO1xyXG4gICAgICAgICAgICBkYXRhU291cmNlLmxvYWQgPSAoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICBkYXRhU291cmNlW1wiX3hldExvYWRlZEF0TGVhc3RPbmNlXCJdID0gdHJ1ZTtcclxuICAgICAgICAgICAgICAgIHJldHVybiBvcmlnaW5hbExvYWQoKTtcclxuICAgICAgICAgICAgfTtcclxuXHJcbiAgICAgICAgICAgIGlmKGRzQ29uZmlnLmxvYWRPcHRpb25zKSB7XHJcbiAgICAgICAgICAgICAgICBkYXRhU291cmNlLm9uKFwiY3VzdG9taXplU3RvcmVMb2FkT3B0aW9uc1wiLCBsb2FkT3B0aW9ucyA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgbG9hZE9wdGlvbnMuc3RvcmVMb2FkT3B0aW9ucy51cmxPdmVycmlkZSA9IGRzQ29uZmlnLmxvYWRPcHRpb25zLnVybDtcclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBkYXRhU291cmNlW1wiX2NhbGN1bGF0ZWRGaWVsZHNcIl0gPSBkYXRhU291cmNlQ29uZmlnLmNhbGN1bGF0ZWRGaWVsZHM7XHJcbiAgICAgICAgICAgIGRhdGFTb3VyY2VbXCJfcmVmcmVzaE9uVmlld1Nob3duXCJdID0gZGF0YVNvdXJjZUNvbmZpZy5yZWZyZXNoT25WaWV3U2hvd247XHJcbiAgICAgICAgICAgIGRhdGFTb3VyY2VbXCJfbW9uaXRvclwiXSA9IGRhdGFTb3VyY2VDb25maWcubW9uaXRvcjtcclxuXHJcbiAgICAgICAgICAgIHJldHVybiBkYXRhU291cmNlO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxufSIsIm1vZHVsZSBBcHBQbGF5ZXIge1xyXG4gICAgXCJ1c2Ugc3RyaWN0XCI7XHJcblxyXG4gICAgaW1wb3J0IGR4aHRtbCA9IERldkV4cHJlc3MuZnJhbWV3b3JrLmh0bWw7XHJcbiAgICBpbXBvcnQgZHhmID0gRGV2RXhwcmVzcy5mcmFtZXdvcms7XHJcbiAgICBpbXBvcnQgZHggPSBEZXZFeHByZXNzO1xyXG5cclxuICAgIGV4cG9ydCBjbGFzcyBMYXlvdXRIZWxwZXIge1xyXG4gICAgICAgIHN0YXRpYyB0cnlHZXRDdXJyZW50UGxhdGZvcm0ocGxhdGZvcm1zOiBJUGxhdGZvcm1bXSwgY3VycmVudERldmljZTogZHguRGV2aWNlKTogSVBsYXRmb3JtIHtcclxuICAgICAgICAgICAgY3VycmVudERldmljZSA9IGN1cnJlbnREZXZpY2UgfHwgZHguZGV2aWNlcy5jdXJyZW50KCk7XHJcbiAgICAgICAgICAgIHZhciBtYXRjaGluZ1BsYXRmb3JtcyA9IERldkV4cHJlc3MudXRpbHNbXCJmaW5kQmVzdE1hdGNoZXNcIl0oXHJcbiAgICAgICAgICAgICAgICBjdXJyZW50RGV2aWNlLFxyXG4gICAgICAgICAgICAgICAgKHBsYXRmb3JtcyB8fCBbXSkubWFwKChwbGF0Zm9ybSwgaW5kZXgpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gJC5leHRlbmQoeyBwbGF0Zm9ybUluZGV4OiBpbmRleCB9LCBwbGF0Zm9ybS5vcHRpb25zKTtcclxuICAgICAgICAgICAgICAgIH0pKTtcclxuICAgICAgICAgICAgcmV0dXJuIG1hdGNoaW5nUGxhdGZvcm1zLmxlbmd0aCA/IHBsYXRmb3Jtc1ttYXRjaGluZ1BsYXRmb3Jtc1swXS5wbGF0Zm9ybUluZGV4XSA6IHVuZGVmaW5lZDtcclxuICAgICAgICB9XHJcbiAgICAgICAgc3RhdGljIGdldExheW91dENvbnRyb2xsZXIocGxhdGZvcm06IElQbGF0Zm9ybSwgZGVzaWduTW9kZTogYm9vbGVhbik6IGFueSB7XHJcbiAgICAgICAgICAgIHZhciBsYXlvdXROYW1lVG9Db250cm9sbGVyTWFwID0ge1xyXG4gICAgICAgICAgICAgICAgbmF2YmFyOiBcIk5hdkJhckNvbnRyb2xsZXJcIixcclxuICAgICAgICAgICAgICAgIHNsaWRlb3V0OiBcIlNsaWRlT3V0Q29udHJvbGxlclwiLFxyXG4gICAgICAgICAgICAgICAgc3BsaXQ6IFwiSU9TU3BsaXRMYXlvdXRDb250cm9sbGVyXCIsXHJcbiAgICAgICAgICAgICAgICBzaW1wbGU6IFwiU2ltcGxlTGF5b3V0Q29udHJvbGxlclwiLFxyXG4gICAgICAgICAgICAgICAgZW1wdHk6IFwiRW1wdHlMYXlvdXRDb250cm9sbGVyXCIsXHJcbiAgICAgICAgICAgICAgICBwb3B1cDogXCJQb3B1cExheW91dENvbnRyb2xsZXJcIixcclxuICAgICAgICAgICAgICAgIGRlc2lnbmVyOiBcIkRlc2lnbmVyQ29udHJvbGxlclwiXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICBjb250cm9sbGVyTmFtZSA9IGxheW91dE5hbWVUb0NvbnRyb2xsZXJNYXBbcGxhdGZvcm0ubGF5b3V0XSxcclxuICAgICAgICAgICAgICAgIGNvbnRyb2xsZXI7XHJcbiAgICAgICAgICAgIGlmKHBsYXRmb3JtLmxheW91dCA9PT0gXCJzcGxpdFwiICYmIHBsYXRmb3JtLm9wdGlvbnMuZ2VuZXJpYykge1xyXG4gICAgICAgICAgICAgICAgY29udHJvbGxlck5hbWUgPSBcIkdlbmVyaWNTcGxpdExheW91dENvbnRyb2xsZXJcIjtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBjb250cm9sbGVyID0gKGNvbnRyb2xsZXJOYW1lICYmIGR4LmZyYW1ld29yay5odG1sW2NvbnRyb2xsZXJOYW1lXSkgPyBuZXcgZHguZnJhbWV3b3JrLmh0bWxbY29udHJvbGxlck5hbWVdKHtcclxuICAgICAgICAgICAgICAgIHN3aXBlRW5hYmxlZDogIWRlc2lnbk1vZGVcclxuICAgICAgICAgICAgfSkgOiBuZXcgZHhodG1sLkRlZmF1bHRMYXlvdXRDb250cm9sbGVyKDx7bmFtZTogc3RyaW5nfT57XHJcbiAgICAgICAgICAgICAgICBuYW1lOiBcImRlc2t0b3BcIixcclxuICAgICAgICAgICAgICAgIHN3aXBlRW5hYmxlZDogIWRlc2lnbk1vZGVcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIGlmKGRlc2lnbk1vZGUgJiYgY29udHJvbGxlciBpbnN0YW5jZW9mIERldkV4cHJlc3MuZnJhbWV3b3JrLmh0bWwuU2xpZGVPdXRDb250cm9sbGVyKSB7XHJcbiAgICAgICAgICAgICAgICBjb250cm9sbGVyLl90b2dnbGVOYXZpZ2F0aW9uID0gKCkgPT4geyB9O1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJldHVybiBjb250cm9sbGVyO1xyXG4gICAgICAgIH1cclxuICAgICAgICBzdGF0aWMgY3JlYXRlTGF5b3V0U2V0KHBsYXRmb3JtczogSVBsYXRmb3JtW10sIGRlc2lnbk1vZGU6IGJvb2xlYW4sIHZpZXdzPzogSVZpZXdbXSk6IHsgbGF5b3V0U2V0OiBhbnlbXTsgdmlld1NwZWNpZmljTGF5b3V0czogeyB2aWV3OiBzdHJpbmc7IG9wdGlvbnM6IGFueTsgY29udHJvbGxlcjogYW55IH1bXSB9IHtcclxuICAgICAgICAgICAgdmFyIHJlc3VsdCA9IHsgbGF5b3V0U2V0OiBbXSwgdmlld1NwZWNpZmljTGF5b3V0czogW10gfTtcclxuICAgICAgICAgICAgcGxhdGZvcm1zLmZvckVhY2goKHBsYXRmb3JtKSA9PiB7XHJcbiAgICAgICAgICAgICAgICByZXN1bHQubGF5b3V0U2V0LnB1c2goJC5leHRlbmQoeyBjb250cm9sbGVyOiBMYXlvdXRIZWxwZXIuZ2V0TGF5b3V0Q29udHJvbGxlcihwbGF0Zm9ybSwgZGVzaWduTW9kZSkgfSwgcGxhdGZvcm0ub3B0aW9ucyB8fCB7fSkpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgaWYodmlld3MpIHtcclxuICAgICAgICAgICAgICAgIHZpZXdzLmZvckVhY2goKHZpZXcpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICBpZighdmlldy5wbGF0Zm9ybXMpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICB2aWV3LnBsYXRmb3Jtcy5mb3JFYWNoKChwbGF0Zm9ybSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgY29udHJvbGxlciA9IExheW91dEhlbHBlci5nZXRMYXlvdXRDb250cm9sbGVyKHBsYXRmb3JtLCBkZXNpZ25Nb2RlKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYocGxhdGZvcm0gJiYgcGxhdGZvcm0ubW9kYWwpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRyb2xsZXIgPSBuZXcgZHhodG1sW1wiUG9wdXBMYXlvdXRDb250cm9sbGVyXCJdKHsgY2hpbGRDb250cm9sbGVyOiBjb250cm9sbGVyIH0pO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc3VsdC5sYXlvdXRTZXQucHVzaCgkLmV4dGVuZCh7IGN1c3RvbVJlc29sdmVSZXF1aXJlZDogdHJ1ZSwgY29udHJvbGxlcjogY29udHJvbGxlciB9LCBwbGF0Zm9ybS5vcHRpb25zIHx8IHt9KSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc3VsdC52aWV3U3BlY2lmaWNMYXlvdXRzLnB1c2goe1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmlldzogdmlldy5pZCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9wdGlvbnM6IHBsYXRmb3JtLm9wdGlvbnMsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb250cm9sbGVyOiBjb250cm9sbGVyXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDtcclxuICAgICAgICB9XHJcbiAgICAgICAgc3RhdGljIHRyeUdldFZpZXdTcGVjaWZpY0xheW91dENvbnRyb2xsZXIodmlld05hbWU6IHN0cmluZywgdmlld1NwZWNpZmljTGF5b3V0czogeyB2aWV3OiBzdHJpbmc7IG9wdGlvbnM6IGFueTsgY29udHJvbGxlcjogYW55IH1bXSk6IGFueSB7XHJcbiAgICAgICAgICAgIHZhciBmb3VuZENvbnRyb2xsZXI7XHJcbiAgICAgICAgICAgIGlmKHZpZXdTcGVjaWZpY0xheW91dHMubGVuZ3RoID4gMCkge1xyXG4gICAgICAgICAgICAgICAgZm9yKHZhciBpID0gMDsgaSA8IHZpZXdTcGVjaWZpY0xheW91dHMubGVuZ3RoOyArK2kpIHtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgbGF5b3V0SXRlbSA9IHZpZXdTcGVjaWZpY0xheW91dHNbaV0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGZpdHMgPSB0cnVlLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjdXJyZW50RGV2aWNlID0gRGV2RXhwcmVzcy5kZXZpY2VzLmN1cnJlbnQoKTtcclxuICAgICAgICAgICAgICAgICAgICBpZihsYXlvdXRJdGVtLnZpZXcgPT09IHZpZXdOYW1lKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmKGxheW91dEl0ZW0ub3B0aW9ucykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJC5lYWNoKGxheW91dEl0ZW0ub3B0aW9ucywoZmllbGQsIHZhbHVlKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYoY3VycmVudERldmljZVtmaWVsZF0gIT09IHZhbHVlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBmaXRzID0gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYoZml0cykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZm91bmRDb250cm9sbGVyID0gbGF5b3V0SXRlbS5jb250cm9sbGVyO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuIGZvdW5kQ29udHJvbGxlcjtcclxuICAgICAgICB9XHJcbiAgICAgICAgc3RhdGljIGdldERldmljZVR5cGUoY3VycmVudERldmljZT86IGR4LkRldmljZSkge1xyXG4gICAgICAgICAgICB2YXIgZGV2aWNlVHlwZSA9IFwicGhvbmVcIjtcclxuICAgICAgICAgICAgY3VycmVudERldmljZSA9IGN1cnJlbnREZXZpY2UgfHwgRGV2RXhwcmVzcy5kZXZpY2VzLmN1cnJlbnQoKTtcclxuICAgICAgICAgICAgaWYoIWN1cnJlbnREZXZpY2UudGFibGV0ICYmICFjdXJyZW50RGV2aWNlLnBob25lKSB7XHJcbiAgICAgICAgICAgICAgICBkZXZpY2VUeXBlID0gXCJkZXNrdG9wXCI7XHJcbiAgICAgICAgICAgIH0gZWxzZSBpZihjdXJyZW50RGV2aWNlLnRhYmxldCkge1xyXG4gICAgICAgICAgICAgICAgZGV2aWNlVHlwZSA9IFwidGFibGV0XCI7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuIGRldmljZVR5cGU7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHN0YXRpYyBmaWxsQ29tbWFuZE1hcHBpbmcoY29tbWFuZE1hcHBpbmc6IGR4Zi5Db21tYW5kTWFwLCBjb21tYW5kczogQXBwUGxheWVyLklDb21tYW5kW10sIHBsYXRmb3JtczogSVBsYXRmb3JtW10sIGN1cnJlbnREZXZpY2U6IGR4LkRldmljZSkge1xyXG4gICAgICAgICAgICB2YXIgZGV2aWNlVHlwZSA9IHRoaXMuZ2V0RGV2aWNlVHlwZShjdXJyZW50RGV2aWNlKSxcclxuICAgICAgICAgICAgICAgIGN1cnJlbnRQbGF0Zm9ybSA9IExheW91dEhlbHBlci50cnlHZXRDdXJyZW50UGxhdGZvcm0ocGxhdGZvcm1zLCBjdXJyZW50RGV2aWNlKSxcclxuICAgICAgICAgICAgICAgIG1hcCA9IHtcclxuICAgICAgICAgICAgICAgICAgICBcImhlYWRlclwiOiBbXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIFwiaW9zLWhlYWRlci10b29sYmFyXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgLy9cImFuZHJvaWQtaGVhZGVyLXRvb2xiYXJcIixcclxuICAgICAgICAgICAgICAgICAgICAvL1wiYW5kcm9pZC1zaW1wbGUtdG9vbGJhclwiLFxyXG4gICAgICAgICAgICAgICAgICAgIC8vXCJ0aXplbi1oZWFkZXItdG9vbGJhclwiLFxyXG4gICAgICAgICAgICAgICAgICAgIC8vXCJ0aXplbi1zaW1wbGUtdG9vbGJhclwiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBcImdlbmVyaWMtaGVhZGVyLXRvb2xiYXJcIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgXCJkZXNrdG9wLXRvb2xiYXJcIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgLy9cIndpbjgtcGhvbmUtYXBwYmFyXCJcclxuICAgICAgICAgICAgICAgICAgICBdLFxyXG4gICAgICAgICAgICAgICAgICAgIFwiZm9vdGVyXCI6IFtcclxuICAgICAgICAgICAgICAgICAgICAgICAgXCJpb3Mtdmlldy1mb290ZXJcIixcclxuICAgICAgICAgICAgICAgICAgICAvL1wiYW5kcm9pZC1mb290ZXItdG9vbGJhclwiLFxyXG4gICAgICAgICAgICAgICAgICAgIC8vXCJ0aXplbi1mb290ZXItdG9vbGJhclwiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBcImdlbmVyaWMtdmlldy1mb290ZXJcIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgLy9cIndpbjgtcGhvbmUtYXBwYmFyXCJcclxuICAgICAgICAgICAgICAgICAgICBdLFxyXG4gICAgICAgICAgICAgICAgICAgIFwidG9vbGJhclwiOiBbXCJnZW5lcmljLWxheW91dC10b29sYmFyXCJdLFxyXG4gICAgICAgICAgICAgICAgICAgIFwibm9uZVwiOiBbXVxyXG4gICAgICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgKGNvbW1hbmRzIHx8IFtdKS5mb3JFYWNoKChjb21tYW5kKSA9PiB7XHJcbiAgICAgICAgICAgICAgICB2YXIgY29udGFpbmVyID0gY29tbWFuZC5jb250YWluZXIgPyBjb21tYW5kLmNvbnRhaW5lcltkZXZpY2VUeXBlXSA6IG51bGw7XHJcbiAgICAgICAgICAgICAgICBpZighY29udGFpbmVyKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29udGFpbmVyID0gKGN1cnJlbnRQbGF0Zm9ybSAmJiBjdXJyZW50UGxhdGZvcm0uZGVmYXVsdENvbW1hbmRDb250YWluZXIpIHx8IFwiaGVhZGVyXCI7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB2YXIgY3VycmVudENvbW1hbmQgPSB7XHJcbiAgICAgICAgICAgICAgICAgICAgaWQ6IGNvbW1hbmQuaWRcclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgcGxhdGZvcm1Db250YWluZXJzID0gbWFwW2NvbnRhaW5lcl07XHJcbiAgICAgICAgICAgICAgICBpZihjb21tYW5kLmFsaWdubWVudCAmJiBjb21tYW5kLmFsaWdubWVudC5oYXNPd25Qcm9wZXJ0eShkZXZpY2VUeXBlKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGN1cnJlbnRDb21tYW5kW1wibG9jYXRpb25cIl0gPSBjb21tYW5kLmFsaWdubWVudFtkZXZpY2VUeXBlXTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIGN1cnJlbnRDb21tYW5kW1wibG9jYXRpb25cIl0gPSAoY3VycmVudFBsYXRmb3JtICAmJiBjdXJyZW50UGxhdGZvcm0uZGVmYXVsdENvbW1hbmRMb2NhdGlvbikgfHwgXCJhZnRlclwiO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgaWYoIXBsYXRmb3JtQ29udGFpbmVycykge1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJVbmtub3duIGNvbW1hbmQgY29udGFpbmVyICdcIiArIGNvbnRhaW5lciArIFwiJy4gU3VwcG9ydGVkIHZhbHVlcyBhcmU6IGhlYWRlciwgZm9vdGVyLCB0b29sYmFyXCIpO1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHBsYXRmb3JtQ29udGFpbmVycy5mb3JFYWNoKChjb250YWluZXIpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICBpZihjb21tYW5kTWFwcGluZ1tjb250YWluZXJdKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbW1hbmRNYXBwaW5nW2NvbnRhaW5lcl0uY29tbWFuZHMucHVzaChjdXJyZW50Q29tbWFuZCk7XHJcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29tbWFuZE1hcHBpbmdbY29udGFpbmVyXSA9IHsgY29tbWFuZHM6IFtjdXJyZW50Q29tbWFuZF0gfTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIHJldHVybiA8YW55PmNvbW1hbmRNYXBwaW5nO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxufSIsIi8vLyA8cmVmZXJlbmNlIHBhdGg9XCJsb2dpYy9mdW5jdGlvbmNvbXBpbGVyLnRzXCIgLz5cbm1vZHVsZSBBcHBQbGF5ZXIge1xuICAgIFwidXNlIHN0cmljdFwiO1xuXG4gICAgaW1wb3J0IGFwbCA9IEFwcFBsYXllci5Mb2dpYztcblxuICAgIGV4cG9ydCBpbnRlcmZhY2UgSUZ1bmNQcm9wZXJ0eSB7XG4gICAgICAgIG5hbWU6IHN0cmluZztcbiAgICAgICAgZ2V0dGVyOiBJRnVuY3Rpb25Db21waWxlcjtcbiAgICAgICAgc2V0dGVyPzogSUZ1bmN0aW9uQ29tcGlsZXI7XG4gICAgICAgIG9ic2VydmFibGVzPzogc3RyaW5nW107XG4gICAgfVxuXG4gICAgZXhwb3J0IGludGVyZmFjZSBJTW9kZWxBcHBsaWNhdGlvbkNvbnRleHQge1xuICAgICAgICBsb2NhbFN0b3JhZ2U6IElNb2RlbFByb3BlcnR5U3RvcmFnZTtcbiAgICAgICAgY3JlYXRlRnVuY3Rpb25Db21waWxlcjogKGFueSkgPT4gSUZ1bmN0aW9uQ29tcGlsZXI7XG4gICAgfTtcblxuICAgIGV4cG9ydCBjbGFzcyBNb2RlbCB7XG4gICAgICAgIHN0YXRpYyBjcmVhdGVBcHBNb2RlbChjb25maWc6IElNb2RlbCwgYXBwOiBJQXBwbGljYXRpb24pIHtcbiAgICAgICAgICAgIHZhciBtb2RlbCA9IHt9LFxuICAgICAgICAgICAgICAgIGNvbnRleHQ6IElSdW5Db250ZXh0ID0geyAkZ2xvYmFsOiBtb2RlbCB9O1xuICAgICAgICAgICAgcmV0dXJuIE1vZGVsLmNyZWF0ZU1vZGVsQ29yZShjb25maWcsIGFwcCwgY29udGV4dCwgXCJnbG9iYWwgXCIsIG1vZGVsKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHN0YXRpYyBjcmVhdGVNb2RlbChjb25maWc6IElNb2RlbCwgYXBwOiBJTW9kZWxBcHBsaWNhdGlvbkNvbnRleHQpIHtcbiAgICAgICAgICAgIHZhciBtb2RlbCA9IHt9LFxuICAgICAgICAgICAgICAgIGNvbnRleHQ6IElSdW5Db250ZXh0ID0geyAkZ2xvYmFsOiBhcHBbXCJtb2RlbFwiXSwgJG1vZGVsOiBtb2RlbCB9O1xuICAgICAgICAgICAgcmV0dXJuIE1vZGVsLmNyZWF0ZU1vZGVsQ29yZShjb25maWcsIGFwcCwgY29udGV4dCwgXCJcIiwgbW9kZWwpO1xuICAgICAgICB9XG5cbiAgICAgICAgcHJpdmF0ZSBzdGF0aWMgY3JlYXRlTW9kZWxDb3JlKGNvbmZpZzogSU1vZGVsLCBhcHA6IElNb2RlbEFwcGxpY2F0aW9uQ29udGV4dCwgY29udGV4dDogSVJ1bkNvbnRleHQsIGNhbGxlclByZWZpeDogc3RyaW5nLCBtb2RlbCkge1xuICAgICAgICAgICAgdmFyIGFsbEZpZWxkcyA9IFtdO1xuICAgICAgICAgICAgaWYoY29uZmlnLnBhcmFtcykge1xuICAgICAgICAgICAgICAgIGFsbEZpZWxkcy5wdXNoLmFwcGx5KGFsbEZpZWxkcywgY29uZmlnLnBhcmFtcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZihjb25maWcubW9kZWwpIHtcbiAgICAgICAgICAgICAgICBhbGxGaWVsZHMucHVzaC5hcHBseShhbGxGaWVsZHMsIGNvbmZpZy5tb2RlbCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZihjb25maWcuZnVuY3Rpb25zKSB7XG4gICAgICAgICAgICAgICAgYWxsRmllbGRzLnB1c2guYXBwbHkoYWxsRmllbGRzLCBjb25maWcuZnVuY3Rpb25zKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuaW5pdGlhbGl6ZVBsYWluVG9wTGV2ZWxPYnNlcnZhYmxlcyhtb2RlbCwgY29uZmlnLmlkLCBhbGxGaWVsZHMsIGNvbnRleHQsIGFwcCk7XG4gICAgICAgICAgICB0aGlzLmluaXRpYWxpemVDYWxjdWxhdGVkVG9wTGV2ZWxPYnNlcnZhYmxlcyhtb2RlbCwgYWxsRmllbGRzLCBjb250ZXh0LCBjYWxsZXJQcmVmaXgsIGFwcCk7XG4gICAgICAgICAgICByZXR1cm4gbW9kZWw7XG4gICAgICAgIH1cblxuICAgICAgICBzdGF0aWMgY3JlYXRlTGlua2VkTW9kZWwob3B0aW9uczoge30sIGNvbnRleHQ6IElSdW5Db250ZXh0LCBjYWxsZXJJbmZvOiBhcGwuSUNhbGxlckluZm8pIHtcbiAgICAgICAgICAgIHJldHVybiBwcm9wZXJ0eVZpc2l0b3Iob3B0aW9ucywgKHZhbHVlQ29udGV4dCkgPT4ge1xuICAgICAgICAgICAgICAgIGlmKGVuZHNXaXRoKHZhbHVlQ29udGV4dC5uYW1lLCBcIkV4cHJcIikpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHZhbHVlQ29udGV4dC52YWx1ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdmFyIGV4cHJlc3Npb24gPSB2YWx1ZUNvbnRleHQudmFsdWU7XG4gICAgICAgICAgICAgICAgaWYoZXhwcmVzc2lvbiAmJiB0eXBlb2YgZXhwcmVzc2lvbiA9PT0gXCJzdHJpbmdcIiAmJiAoPHN0cmluZz5leHByZXNzaW9uKS5jaGFyQXQoMCkgPT09IFwiJFwiKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBvd25lciA9IHZhbHVlQ29udGV4dC5vd25lcixcbiAgICAgICAgICAgICAgICAgICAgICAgIHByb3BlcnR5TmFtZSA9IHZhbHVlQ29udGV4dC5uYW1lO1xuICAgICAgICAgICAgICAgICAgICB2YXIgdmFsdWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBtb2RlbFZhbHVlID0gZ2V0TW9kZWxWYWx1ZShleHByZXNzaW9uLCBjb250ZXh0LCBjYWxsZXJJbmZvKTtcbiAgICAgICAgICAgICAgICAgICAgaWYodHlwZW9mIG1vZGVsVmFsdWUgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHZhbHVlQ29udGV4dC52YWx1ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGlmKHZhbHVlQ29udGV4dC5pc0FycmF5KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZSA9IGtvLmNvbXB1dGVkKCgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gb3duZXJbcHJvcGVydHlOYW1lXSA9IGdldE1vZGVsVmFsdWUoZXhwcmVzc2lvbiwgY29udGV4dCwgY2FsbGVySW5mbyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlID0ga28uY29tcHV0ZWQoKCk6IGFueT0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZ2V0TW9kZWxWYWx1ZShleHByZXNzaW9uLCBjb250ZXh0LCBjYWxsZXJJbmZvKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG93bmVyLCBwcm9wZXJ0eU5hbWUsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBnZXQ6ICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHZhbHVlKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gdmFsdWVDb250ZXh0LnZhbHVlO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBzdGF0aWMgZ2V0RnVuY3Rpb25Db21waWxlcnMoYWxsRmllbGRzOiBJTW9kZWxQcm9wZXJ0eVtdLCBhcHA6IElNb2RlbEFwcGxpY2F0aW9uQ29udGV4dCkge1xuICAgICAgICAgICAgdmFyIHByb3BlcnRpZXM6IElGdW5jUHJvcGVydHlbXSA9IFtdO1xuICAgICAgICAgICAgYWxsRmllbGRzLmZvckVhY2goKGl0ZW0pID0+IHtcbiAgICAgICAgICAgICAgICBpZihpdGVtLmdldHRlciB8fCBpdGVtLnNldHRlciB8fCBpdGVtLmZ1bmN0aW9uKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciByZXN1bHQ6IElGdW5jUHJvcGVydHkgPSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBuYW1lOiBpdGVtLm5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBvYnNlcnZhYmxlczogaXRlbS5vYnNlcnZhYmxlcyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGdldHRlcjogYXBwLmNyZWF0ZUZ1bmN0aW9uQ29tcGlsZXIoaXRlbS5nZXR0ZXIgfHwgaXRlbS5mdW5jdGlvbilcbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICAgICAgaWYoaXRlbS5zZXR0ZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc3VsdC5zZXR0ZXIgPSBhcHAuY3JlYXRlRnVuY3Rpb25Db21waWxlcihpdGVtLnNldHRlcik7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcHJvcGVydGllcy5wdXNoKHJlc3VsdCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gcHJvcGVydGllcztcbiAgICAgICAgfVxuICAgICAgICBwcml2YXRlIHN0YXRpYyBnZXRGdW5jdGlvbnNEZXNjcmlwdG9ycyhmdW5jdGlvbkNvbXBpbGVyczogSUZ1bmNQcm9wZXJ0eVtdLCBjb250ZXh0OiBJUnVuQ29udGV4dCwgY2FsbGVySW5mb3JtYXRpb246IGFwbC5JQ2FsbGVySW5mbykge1xuICAgICAgICAgICAgdmFyIGRlc2NyaXB0b3JzOiBQcm9wZXJ0eURlc2NyaXB0b3JNYXAgPSB7fTtcbiAgICAgICAgICAgIGZ1bmN0aW9uQ29tcGlsZXJzLmZvckVhY2goZnVuY3Rpb25Db21waWxlciA9PiB7XG4gICAgICAgICAgICAgICAgdmFyIGNhbGxlckluZm8gPSB7XG4gICAgICAgICAgICAgICAgICAgIGNhbGxlclR5cGU6IGNhbGxlckluZm9ybWF0aW9uLmNhbGxlclR5cGUgfHwgXCJmdW5jdGlvblwiLFxuICAgICAgICAgICAgICAgICAgICBjYWxsZXJJZDogY2FsbGVySW5mb3JtYXRpb24uY2FsbGVySWQgfHwgZnVuY3Rpb25Db21waWxlci5uYW1lXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgZnVuYyA9IGFyZ3MgPT4gZnVuY3Rpb25Db21waWxlci5nZXR0ZXIucnVuKCQuZXh0ZW5kKHt9LCBjb250ZXh0LCBhcmdzKSwgY2FsbGVySW5mbyksXG4gICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0b3I6IFByb3BlcnR5RGVzY3JpcHRvciA9IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBnZXQ6ICgpID0+IGZ1bmNcbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICBkZXNjcmlwdG9yc1tmdW5jdGlvbkNvbXBpbGVyLm5hbWVdID0gZGVzY3JpcHRvcjtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIGRlc2NyaXB0b3JzO1xuICAgICAgICB9XG4gICAgICAgIHN0YXRpYyBnZXRQcm9wZXJ0aWVzRGVzY3JpcHRvcnMoZnVuY3Rpb25Db21waWxlcnM6IElGdW5jUHJvcGVydHlbXSwgY29udGV4dDogSVJ1bkNvbnRleHQsIGNhbGxlckluZm9ybWF0aW9uOiBhcGwuSUNhbGxlckluZm8pIHtcbiAgICAgICAgICAgIHZhciBkZXNjcmlwdG9yczogUHJvcGVydHlEZXNjcmlwdG9yTWFwID0ge307XG4gICAgICAgICAgICBmdW5jdGlvbkNvbXBpbGVycy5mb3JFYWNoKChmdW5jdGlvbkNvbXBpbGVyKSA9PiB7XG4gICAgICAgICAgICAgICAgdmFyIG9ic2VydmFibGUgPSBrby5vYnNlcnZhYmxlKCksXG4gICAgICAgICAgICAgICAgICAgIGV2YWx1YXRlZDtcbiAgICAgICAgICAgICAgICB2YXIgZGVzY3JpcHRvcjogUHJvcGVydHlEZXNjcmlwdG9yID0ge1xuICAgICAgICAgICAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIGdldDogKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGNhbGxlckluZm8gPSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGVyVHlwZTogY2FsbGVySW5mb3JtYXRpb24uY2FsbGVyVHlwZSB8fCBcIm1vZGVsIHByb3BlcnR5XCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGVySWQ6IGNhbGxlckluZm9ybWF0aW9uLmNhbGxlcklkIHx8IGZ1bmN0aW9uQ29tcGlsZXIubmFtZVxuICAgICAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmKCFldmFsdWF0ZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBrby5jb21wdXRlZCgoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZ1bmN0aW9uQ29tcGlsZXIuZ2V0dGVyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAucnVuKCQuZXh0ZW5kKHt9LCBjb250ZXh0KSwgY2FsbGVySW5mbylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC50aGVuKChyZXN1bHQpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgb2JzZXJ2ZWRSZXN1bHQgPSB0aGlzLnNldE9ic2VydmFibGVQcm9wZXJ0aWVzKG9ic2VydmFibGUoKSwgcmVzdWx0LCBuYW1lLCBmdW5jdGlvbkNvbXBpbGVyLm9ic2VydmFibGVzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvYnNlcnZhYmxlKG9ic2VydmVkUmVzdWx0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGV2YWx1YXRlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4ga28udW53cmFwKG9ic2VydmFibGUoKSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIGlmKGZ1bmN0aW9uQ29tcGlsZXIuc2V0dGVyKSB7XG4gICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0b3Iuc2V0ID0gKHZhbHVlKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgY3VycmVudFZhbHVlID0gb2JzZXJ2YWJsZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYoY3VycmVudFZhbHVlID09PSB2YWx1ZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmKGtvLmlzT2JzZXJ2YWJsZShjdXJyZW50VmFsdWUpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihcIlByb3BlcnR5IGNhbm5vdCBoYXZlIGEgc2V0dGVyIGlmIGdldHRlciByZXR1cm5zIG9ic2VydmFibGUuXCIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGZ1bmN0aW9uQ29tcGlsZXIuc2V0dGVyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLnJ1bigkLmV4dGVuZCh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICR2YWx1ZTogdmFsdWVcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LCBjb250ZXh0KSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgb2JzZXJ2ZWRWYWx1ZSA9IHRoaXMuc2V0T2JzZXJ2YWJsZVByb3BlcnRpZXMob2JzZXJ2YWJsZSgpLCB2YWx1ZSwgbmFtZSwgZnVuY3Rpb25Db21waWxlci5vYnNlcnZhYmxlcyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBvYnNlcnZhYmxlKG9ic2VydmVkVmFsdWUpO1xuICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBkZXNjcmlwdG9yc1tmdW5jdGlvbkNvbXBpbGVyLm5hbWVdID0gZGVzY3JpcHRvcjtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIGRlc2NyaXB0b3JzO1xuICAgICAgICB9XG4gICAgICAgIHByaXZhdGUgc3RhdGljIHByb2Nlc3NBcnJheU1ldGhvZEFyZ3VtZW50cyhhcmdzOiBhbnksIG1ldGhvZE5hbWU6IHN0cmluZywgbmFtZTogc3RyaW5nLCBvYnNlcnZhYmxlU2VsZWN0b3JzOiBzdHJpbmdbXSk6IGFueVtdIHtcbiAgICAgICAgICAgIHZhciBuZXdBcmd1bWVudHM7XG4gICAgICAgICAgICBzd2l0Y2gobWV0aG9kTmFtZSkge1xuICAgICAgICAgICAgICAgIGNhc2UgXCJwdXNoXCI6XG4gICAgICAgICAgICAgICAgICAgIG5ld0FyZ3VtZW50cyA9IFtdO1xuICAgICAgICAgICAgICAgICAgICBmb3IodmFyIGkgPSAwOyBpIDwgYXJncy5sZW5ndGg7ICsraSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbmV3QXJndW1lbnRzLnB1c2godGhpcy5zZXRPYnNlcnZhYmxlUHJvcGVydGllcyh1bmRlZmluZWQsIGFyZ3NbaV0sIG5hbWUsIG9ic2VydmFibGVTZWxlY3RvcnMpKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAvL1RPRE86IGFsbCBvdGhlciBtZXRob2QgaW1wbGVtZW50YXRpb25zIC0gXCJyZXZlcnNlXCIsIFwic2hpZnRcIiwgXCJzb3J0XCIsIFwic3BsaWNlXCIsIFwidW5zaGlmdFwiXG4gICAgICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gbmV3QXJndW1lbnRzO1xuICAgICAgICB9XG4gICAgICAgIHByaXZhdGUgc3RhdGljIGdldE9ic2VydmFibGVEZXNjcmlwdG9yKGluaXRpYWxWYWx1ZTogYW55LCBuYW1lOiBzdHJpbmcsIG9ic2VydmFibGVTZWxlY3RvcnM6IHN0cmluZ1tdKTogUHJvcGVydHlEZXNjcmlwdG9yIHtcbiAgICAgICAgICAgIHZhciBpc0FycmF5ID0gJC5pc0FycmF5KGluaXRpYWxWYWx1ZSksXG4gICAgICAgICAgICAgICAgb2JzZXJ2YWJsZSA9IGlzQXJyYXkgPyBrby5vYnNlcnZhYmxlQXJyYXkoaW5pdGlhbFZhbHVlKSA6IGtvLm9ic2VydmFibGUoaW5pdGlhbFZhbHVlKTtcbiAgICAgICAgICAgIGlmKGlzQXJyYXkpIHtcbiAgICAgICAgICAgICAgICBrby51dGlscy5hcnJheUZvckVhY2goW1wicG9wXCIsIFwicHVzaFwiLCBcInJldmVyc2VcIiwgXCJzaGlmdFwiLCBcInNvcnRcIiwgXCJzcGxpY2VcIiwgXCJ1bnNoaWZ0XCJdLCAobWV0aG9kTmFtZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICB2YXIgb3JpZ2luYWxNZXRob2QgPSBpbml0aWFsVmFsdWVbbWV0aG9kTmFtZV07XG4gICAgICAgICAgICAgICAgICAgIGluaXRpYWxWYWx1ZVttZXRob2ROYW1lXSA9ICguLi5hcmdzKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgcHJvY2Vzc2VkQXJndW1lbnRzID0gdGhpcy5wcm9jZXNzQXJyYXlNZXRob2RBcmd1bWVudHMoYXJncywgbWV0aG9kTmFtZSwgbmFtZSwgb2JzZXJ2YWJsZVNlbGVjdG9ycyksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWV0aG9kUmVzdWx0ID0gb3JpZ2luYWxNZXRob2QuYXBwbHkoaW5pdGlhbFZhbHVlLCBwcm9jZXNzZWRBcmd1bWVudHMgfHwgYXJncyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBvYnNlcnZhYmxlLnZhbHVlSGFzTXV0YXRlZCgpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gbWV0aG9kUmVzdWx0O1xuICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICAgICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgICAgICBnZXQ6ICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9ic2VydmFibGUoKTtcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHNldDogKHZhbHVlKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmKGlzQXJyYXkgJiYgJC5pc0FycmF5KHZhbHVlKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgKDxLbm9ja291dE9ic2VydmFibGVBcnJheTxhbnk+Pm9ic2VydmFibGUpLnNwbGljZS5hcHBseShvYnNlcnZhYmxlLCBbMCwgb2JzZXJ2YWJsZS5wZWVrKCkubGVuZ3RoXS5jb25jYXQodmFsdWUpKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG9ic2VydmFibGUodGhpcy5zZXRPYnNlcnZhYmxlUHJvcGVydGllcyhvYnNlcnZhYmxlKCksIHZhbHVlLCBuYW1lLCBvYnNlcnZhYmxlU2VsZWN0b3JzKSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICAgIHByaXZhdGUgc3RhdGljIGdldFBsYWluRGVzY3JpcHRvcihpbml0aWFsVmFsdWU6IGFueSwgbmFtZTogc3RyaW5nLCBvYnNlcnZhYmxlU2VsZWN0b3JzOiBzdHJpbmdbXSk6IFByb3BlcnR5RGVzY3JpcHRvciB7XG4gICAgICAgICAgICB2YXIgY3VycmVudFZhbHVlID0gaW5pdGlhbFZhbHVlO1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICAgICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgICAgICBnZXQ6ICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGN1cnJlbnRWYWx1ZTtcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHNldDogKHZhbHVlKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGN1cnJlbnRWYWx1ZSA9IHRoaXMuc2V0T2JzZXJ2YWJsZVByb3BlcnRpZXMoY3VycmVudFZhbHVlLCB2YWx1ZSwgbmFtZSwgb2JzZXJ2YWJsZVNlbGVjdG9ycyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIHN0YXRpYyBnZXREZXNjcmlwdG9yKGluaXRpYWxWYWx1ZTogYW55LCBuYW1lOiBzdHJpbmcsIG9ic2VydmFibGVTZWxlY3RvcnM6IHN0cmluZ1tdKTogUHJvcGVydHlEZXNjcmlwdG9yIHtcbiAgICAgICAgICAgIHZhciBuYW1lUGFydHMgPSBuYW1lLnNwbGl0KFwiLlwiKSxcbiAgICAgICAgICAgICAgICBhc3RlcmlzayA9IFwiKlwiO1xuXG4gICAgICAgICAgICB2YXIgc2hvdWxkQmVPYnNlcnZhYmxlID0gKG9ic2VydmFibGVTZWxlY3RvcnMgfHwgW10pLnNvbWUoKHNlbGVjdG9yKSA9PiB7XG4gICAgICAgICAgICAgICAgdmFyIHNlbGVjdG9yUGFydHMgPSBzZWxlY3Rvci5zcGxpdChcIi5cIiksXG4gICAgICAgICAgICAgICAgICAgIG1hdGNoID0gdHJ1ZTtcblxuICAgICAgICAgICAgICAgIGlmKHNlbGVjdG9yUGFydHMubGVuZ3RoIDwgbmFtZVBhcnRzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICBtYXRjaCA9IHNlbGVjdG9yUGFydHNbc2VsZWN0b3JQYXJ0cy5sZW5ndGggLSAxXSA9PT0gYXN0ZXJpc2s7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmKG5hbWVQYXJ0cy5sZW5ndGggPCBzZWxlY3RvclBhcnRzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICBtYXRjaCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGZvcih2YXIgaSA9IDA7IGkgPCBuYW1lUGFydHMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmKHNlbGVjdG9yUGFydHNbaV0gPT09IGFzdGVyaXNrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYobmFtZVBhcnRzW2ldID09PSBzZWxlY3RvclBhcnRzW2ldKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1hdGNoID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIG1hdGNoO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHJldHVybiBzaG91bGRCZU9ic2VydmFibGVcbiAgICAgICAgICAgICAgICA/IHRoaXMuZ2V0T2JzZXJ2YWJsZURlc2NyaXB0b3IoaW5pdGlhbFZhbHVlLCBuYW1lLCBvYnNlcnZhYmxlU2VsZWN0b3JzKVxuICAgICAgICAgICAgICAgIDogdGhpcy5nZXRQbGFpbkRlc2NyaXB0b3IoaW5pdGlhbFZhbHVlLCBuYW1lLCBvYnNlcnZhYmxlU2VsZWN0b3JzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHByaXZhdGUgc3RhdGljIHByb2Nlc3NBcnJheShvbGRWYWx1ZTogYW55LCBuZXdWYWx1ZTogYW55LCBwYXJlbnROYW1lOiBzdHJpbmcsIG9ic2VydmFibGVTZWxlY3RvcnM6IHN0cmluZ1tdKTogYW55W10ge1xuICAgICAgICAgICAgdmFyIHByb2Nlc3NlZEFycmF5ID0gW107XG4gICAgICAgICAgICAkLmVhY2gobmV3VmFsdWUsIChpbmRleCwgY2hpbGRWYWx1ZSkgPT4ge1xuICAgICAgICAgICAgICAgIHByb2Nlc3NlZEFycmF5LnB1c2goXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc2V0T2JzZXJ2YWJsZVByb3BlcnRpZXMob2xkVmFsdWUgPyBrby51bndyYXAob2xkVmFsdWUpW2luZGV4XSA6IHVuZGVmaW5lZCwgY2hpbGRWYWx1ZSwgcGFyZW50TmFtZSwgb2JzZXJ2YWJsZVNlbGVjdG9ycykpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gcHJvY2Vzc2VkQXJyYXk7XG4gICAgICAgIH1cblxuICAgICAgICBwcml2YXRlIHN0YXRpYyBzZXRPYnNlcnZhYmxlUHJvcGVydGllcyhvbGRWYWx1ZTogYW55LCBuZXdWYWx1ZTogYW55LCBwYXJlbnROYW1lOiBzdHJpbmcsIG9ic2VydmFibGVTZWxlY3RvcnM6IHN0cmluZ1tdKTogYW55IHtcbiAgICAgICAgICAgIGlmKCFvYnNlcnZhYmxlU2VsZWN0b3JzIHx8IG9ic2VydmFibGVTZWxlY3RvcnMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG5ld1ZhbHVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYoJC5pc0FycmF5KG5ld1ZhbHVlKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnByb2Nlc3NBcnJheShvbGRWYWx1ZSwgbmV3VmFsdWUsIHBhcmVudE5hbWUsIG9ic2VydmFibGVTZWxlY3RvcnMpO1xuICAgICAgICAgICAgfSBlbHNlIGlmKCQuaXNQbGFpbk9iamVjdChuZXdWYWx1ZSkpIHtcbiAgICAgICAgICAgICAgICB2YXIgcmVzdWx0ID0gJC5pc1BsYWluT2JqZWN0KG9sZFZhbHVlKSA/IG9sZFZhbHVlIDoge307XG5cbiAgICAgICAgICAgICAgICAvLyBOT1RFOiByZW1vdmUgcHJvcGVydGllcyBmcm9tIG9sZFZhbHVlIGlmIG5vdCBleGlzdCBpbiBuZXdWYWx1ZVxuICAgICAgICAgICAgICAgICQuZWFjaChyZXN1bHQsIChuYW1lLCB2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZihuZXdWYWx1ZVtuYW1lXSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBkZWxldGUgcmVzdWx0W25hbWVdO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICAvLyBOT1RFOiBzZXQgZXhpc3Rpbmcgb3IgZGVmaW5lIG5vbi1leGlzdGluZyBwcm9wZXJ0aWVzXG4gICAgICAgICAgICAgICAgdmFyIGRlc2NyaXB0b3JzOiBQcm9wZXJ0eURlc2NyaXB0b3JNYXAgPSB7fTtcbiAgICAgICAgICAgICAgICAkLmVhY2gobmV3VmFsdWUsIChwcm9wTmFtZSwgbmV3UHJvcFZhbHVlKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmKHJlc3VsdFtwcm9wTmFtZV0gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGN1cnJlbnROYW1lID0gcGFyZW50TmFtZSA9PT0gXCJcIiA/IHByb3BOYW1lIDogcGFyZW50TmFtZSArIFwiLlwiICsgcHJvcE5hbWU7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgbWVyZ2VkID0gdGhpcy5zZXRPYnNlcnZhYmxlUHJvcGVydGllcyhyZXN1bHRbcHJvcE5hbWVdLCBuZXdQcm9wVmFsdWUsIGN1cnJlbnROYW1lLCBvYnNlcnZhYmxlU2VsZWN0b3JzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0b3JzW3Byb3BOYW1lXSA9IHRoaXMuZ2V0RGVzY3JpcHRvcihtZXJnZWQsIGN1cnJlbnROYW1lLCBvYnNlcnZhYmxlU2VsZWN0b3JzKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc3VsdFtwcm9wTmFtZV0gPSBuZXdQcm9wVmFsdWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydGllcyhyZXN1bHQsIGRlc2NyaXB0b3JzKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIG5ld1ZhbHVlO1xuICAgICAgICB9XG5cbiAgICAgICAgcHJpdmF0ZSBzdGF0aWMgaW5pdGlhbGl6ZVBsYWluVG9wTGV2ZWxPYnNlcnZhYmxlcyhtb2RlbDoge30sIG1vZGVsSWQ6IHN0cmluZywgYWxsRmllbGRzOiBJTW9kZWxQcm9wZXJ0eVtdLFxuICAgICAgICAgICAgY29udGV4dDogeyAkbW9kZWw/OiBhbnksICRnbG9iYWw/OiBhbnkgfSwgYXBwOiB7IGxvY2FsU3RvcmFnZTogSU1vZGVsUHJvcGVydHlTdG9yYWdlOyBjcmVhdGVGdW5jdGlvbkNvbXBpbGVyOiAoYW55KSA9PiBJRnVuY3Rpb25Db21waWxlcjsgfSkge1xuICAgICAgICAgICAgdmFyIGRlc2NyaXB0b3JzOiBQcm9wZXJ0eURlc2NyaXB0b3JNYXAgPSB7fTtcbiAgICAgICAgICAgIGFsbEZpZWxkcy5mb3JFYWNoKChpdGVtKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYoIWl0ZW0uZ2V0dGVyKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBpc0RlZmF1bHRMb2FkZWQgPSBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIG9ic2VydmFibGUgPSBpdGVtLmlzQXJyYXkgPyBrby5vYnNlcnZhYmxlQXJyYXkoKSA6IGtvLm9ic2VydmFibGUoKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHNldHRlciA9ICh2YWwpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgbmV3VmFsdWUgPSB0aGlzLnNldE9ic2VydmFibGVQcm9wZXJ0aWVzKHVuZGVmaW5lZCwgdmFsLCBcIlwiLCBpdGVtLm9ic2VydmFibGVzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZihpc0RlZmF1bHRMb2FkZWQgJiYgaXRlbS5wZXJzaXN0ZW50KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFwcC5sb2NhbFN0b3JhZ2UucHV0KG1vZGVsSWQsIGl0ZW0ubmFtZSwgdmFsKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgb2JzZXJ2YWJsZShuZXdWYWx1ZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgZ2V0dGVyID0gKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vaWYodmFsdWVDb21waWxlcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vICAgIHZhbHVlQ29tcGlsZXIucnVuKCQuZXh0ZW5kKHt9LCBjb250ZXh0LCB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gICAgICAgIGNhbGxlclR5cGU6IFwibW9kZWwgcHJvcGVydHkncyBkZWZhdWx0IHZhbHVlIGV4cHJlc3Npb25cIixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyAgICAgICAgY2FsbGVySWQ6IGl0ZW0ubmFtZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vICAgIH0pKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vICAgICAgICAudGhlbigodmFsdWUpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyAgICAgICAgc2V0dGVyKHZhbHVlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyAgICB2YWx1ZUNvbXBpbGVyID0gbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvL31cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gb2JzZXJ2YWJsZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICAgICAgaWYoaXRlbS5kZWZhdWx0VmFsdWUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2V0dGVyKGNsb25lKGl0ZW0uZGVmYXVsdFZhbHVlKSk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzZXR0ZXIoNDIpOyAvLyBUT0RPOiBkZWZhdWx0VmFsdWUgc2hvdWxkIGRlcGVuZCBvbiB0eXBlXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaXNEZWZhdWx0TG9hZGVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgaWYoaXRlbS5wZXJzaXN0ZW50KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgbG9jYWxWYWx1ZSA9IGFwcC5sb2NhbFN0b3JhZ2UuZ2V0KG1vZGVsSWQsIGl0ZW0ubmFtZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZih0eXBlb2YgbG9jYWxWYWx1ZSAhPT0gXCJ1bmRlZmluZWRcIikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9ic2VydmFibGUobG9jYWxWYWx1ZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRvcnNbaXRlbS5uYW1lXSA9IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBnZXQ6IGdldHRlcixcbiAgICAgICAgICAgICAgICAgICAgICAgIHNldDogc2V0dGVyXG4gICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydGllcyhtb2RlbCwgZGVzY3JpcHRvcnMpO1xuICAgICAgICB9XG4gICAgICAgIHByaXZhdGUgc3RhdGljIGluaXRpYWxpemVDYWxjdWxhdGVkVG9wTGV2ZWxPYnNlcnZhYmxlcyhtb2RlbDoge30sIGFsbEZpZWxkczogSU1vZGVsUHJvcGVydHlbXSwgY29udGV4dDogSVJ1bkNvbnRleHQsIGNhbGxlclByZWZpeDogc3RyaW5nLCBhcHA6IElNb2RlbEFwcGxpY2F0aW9uQ29udGV4dCkge1xuICAgICAgICAgICAgdmFyIGNhbGN1bGF0ZWRQcm9wZXJ0eUNvbXBpbGVycyA9IHRoaXMuZ2V0RnVuY3Rpb25Db21waWxlcnMoYWxsRmllbGRzLmZpbHRlcigoZikgPT4geyByZXR1cm4gISEoZi5nZXR0ZXIgfHwgZi5zZXR0ZXIpOyB9KSwgYXBwKSxcbiAgICAgICAgICAgICAgICBmdW5jdGlvbkNvbXBpbGVycyA9IHRoaXMuZ2V0RnVuY3Rpb25Db21waWxlcnMoYWxsRmllbGRzLmZpbHRlcigoZikgPT4geyByZXR1cm4gISFmLmZ1bmN0aW9uOyB9KSwgYXBwKTtcblxuICAgICAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnRpZXMobW9kZWwsIHRoaXMuZ2V0UHJvcGVydGllc0Rlc2NyaXB0b3JzKGNhbGN1bGF0ZWRQcm9wZXJ0eUNvbXBpbGVycywgY29udGV4dCwgeyBjYWxsZXJUeXBlOiBjYWxsZXJQcmVmaXggKyBcIm1vZGVsIHByb3BlcnR5XCIsIGNhbGxlcklkOiBcIlwiIH0pKTtcbiAgICAgICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzKG1vZGVsLCB0aGlzLmdldEZ1bmN0aW9uc0Rlc2NyaXB0b3JzKGZ1bmN0aW9uQ29tcGlsZXJzLCBjb250ZXh0LCB7IGNhbGxlclR5cGU6IGNhbGxlclByZWZpeCArIFwiZnVuY3Rpb25cIiwgY2FsbGVySWQ6IFwiXCIgfSkpO1xuICAgICAgICB9XG4gICAgICAgIHN0YXRpYyBpbml0aWFsaXplRGF0YVNvdXJjZXMobW9kZWw6IHt9LCBjb250ZXh0OiB7ICRtb2RlbD86IGFueSwgJGdsb2JhbD86IGFueSB9LCBhcHA6IElNb2RlbEFwcGxpY2F0aW9uQ29udGV4dCwgc3RvcmVzOiB7IFtrZXk6IHN0cmluZ106IERldkV4cHJlc3MuZGF0YS5TdG9yZSB9LCByZXVzZU9ic2VydmFibGVzOiBib29sZWFuLCBkYXRhU291cmNlQ29uZmlncz86IElEYXRhU291cmNlW10pIHtcbiAgICAgICAgICAgIHZhciBkZXNjcmlwdG9yczogUHJvcGVydHlEZXNjcmlwdG9yTWFwID0ge307XG4gICAgICAgICAgICAoZGF0YVNvdXJjZUNvbmZpZ3MgfHwgW10pLmZvckVhY2goZGF0YVNvdXJjZUNvbmZpZyA9PiB7XG4gICAgICAgICAgICAgICAgdmFyIGRhdGFTb3VyY2UgPSBEYXRhU291cmNlLmNyZWF0ZURhdGFTb3VyY2UoZGF0YVNvdXJjZUNvbmZpZywgY29udGV4dCwgc3RvcmVzLCBhcHApO1xuICAgICAgICAgICAgICAgIGRhdGFTb3VyY2Uub24oXCJsb2FkRXJyb3JcIiwgZXJyb3IgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZihlcnJvciAmJiBlcnJvci5tZXNzYWdlID09PSBcIlVuYXV0aG9yaXplZFwiKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47ICAgICAvLyBTdXBwcmVzcyBcIlVuYXV0aG9yaXplZFwiIGJhbm5lcnMgc2luY2UgdGhlIHVzZXIgd2lsbCBiZSBzdGlsbCByZWRpcmVjdGVkIHRvIHRoZSBsb2dpbiBwYWdlIGFuZCBpdCB3b24ndCBhZGQgYW55IG1lYW5pbmdcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBzaG93RXJyb3JEaWFsb2coZXJyb3IsIGRhdGFTb3VyY2VDb25maWcuaWQpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGlmKHJldXNlT2JzZXJ2YWJsZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgbW9kZWxbZGF0YVNvdXJjZUNvbmZpZy5pZF0uZGlzcG9zZSgpO1xuICAgICAgICAgICAgICAgICAgICBtb2RlbFtkYXRhU291cmNlQ29uZmlnLmlkXSA9IG5ldyBEZXZFeHByZXNzLmRhdGEuRGF0YVNvdXJjZShbe31dKTtcbiAgICAgICAgICAgICAgICAgICAgbW9kZWxbZGF0YVNvdXJjZUNvbmZpZy5pZF0ubG9hZCgpLnRoZW4oKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgbW9kZWxbZGF0YVNvdXJjZUNvbmZpZy5pZF0uZGlzcG9zZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgbW9kZWxbZGF0YVNvdXJjZUNvbmZpZy5pZF0gPSBkYXRhU291cmNlO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZGVzY3JpcHRvcnNbZGF0YVNvdXJjZUNvbmZpZy5pZF0gPSB0aGlzLmdldERlc2NyaXB0b3IoZGF0YVNvdXJjZSwgZGF0YVNvdXJjZUNvbmZpZy5pZCwgW2RhdGFTb3VyY2VDb25maWcuaWRdKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgaWYoIXJldXNlT2JzZXJ2YWJsZXMpIHtcbiAgICAgICAgICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydGllcyhtb2RlbCwgZGVzY3JpcHRvcnMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufSIsIi8qISBMQUIuanMgKExBQmpzIDo6IExvYWRpbmcgQW5kIEJsb2NraW5nIEphdmFTY3JpcHQpXHJcbiAgICB2Mi4wLjMgKGMpIEt5bGUgU2ltcHNvblxyXG4gICAgTUlUIExpY2Vuc2VcclxuKi9cclxuLyogdHNsaW50OmRpc2FibGUgKi8gXHJcbihmdW5jdGlvbihvKSB7IHZhciBLID0gby4kTEFCLCB5ID0gXCJVc2VMb2NhbFhIUlwiLCB6ID0gXCJBbHdheXNQcmVzZXJ2ZU9yZGVyXCIsIHUgPSBcIkFsbG93RHVwbGljYXRlc1wiLCBBID0gXCJDYWNoZUJ1c3RcIiwgQiA9IFwiQmFzZVBhdGhcIiwgQyA9IC9eW14/I10qXFwvLy5leGVjKGxvY2F0aW9uLmhyZWYpWzBdLCBEID0gL15cXHcrXFw6XFwvXFwvXFwvP1teXFwvXSsvLmV4ZWMoQylbMF0sIGkgPSA8YW55PmRvY3VtZW50LmhlYWQgfHwgZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoXCJoZWFkXCIpLCBMID0gKG8ub3BlcmEgJiYgT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKG8ub3BlcmEpID09IFwiW29iamVjdCBPcGVyYV1cIikgfHwgKFwiTW96QXBwZWFyYW5jZVwiIGluIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5zdHlsZSksIHEgPSA8YW55PmRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzY3JpcHRcIiksIEUgPSB0eXBlb2YgcS5wcmVsb2FkID09IFwiYm9vbGVhblwiLCByID0gRSB8fCAocS5yZWFkeVN0YXRlICYmIHEucmVhZHlTdGF0ZSA9PSBcInVuaW5pdGlhbGl6ZWRcIiksIEYgPSAhciAmJiBxLmFzeW5jID09PSB0cnVlLCBNID0gIXIgJiYgIUYgJiYgIUw7IGZ1bmN0aW9uIEcoYSkgeyByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKGEpID09IFwiW29iamVjdCBGdW5jdGlvbl1cIiB9IGZ1bmN0aW9uIEgoYSkgeyByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKGEpID09IFwiW29iamVjdCBBcnJheV1cIiB9IGZ1bmN0aW9uIE4oYSwgYykgeyB2YXIgYiA9IC9eXFx3K1xcOlxcL1xcLy87IGlmKC9eXFwvXFwvXFwvPy8udGVzdChhKSkgeyBhID0gbG9jYXRpb24ucHJvdG9jb2wgKyBhIH0gZWxzZSBpZighYi50ZXN0KGEpICYmIGEuY2hhckF0KDApICE9IFwiL1wiKSB7IGEgPSAoYyB8fCBcIlwiKSArIGEgfSByZXR1cm4gYi50ZXN0KGEpID8gYSA6ICgoYS5jaGFyQXQoMCkgPT0gXCIvXCIgPyBEIDogQykgKyBhKSB9IGZ1bmN0aW9uIHMoYSwgYykgeyBmb3IodmFyIGIgaW4gYSkgeyBpZihhLmhhc093blByb3BlcnR5KGIpKSB7IGNbYl0gPSBhW2JdIH0gfSByZXR1cm4gYyB9IGZ1bmN0aW9uIE8oYSkgeyB2YXIgYyA9IGZhbHNlOyBmb3IodmFyIGIgPSAwOyBiIDwgYS5zY3JpcHRzLmxlbmd0aDsgYisrKSB7IGlmKGEuc2NyaXB0c1tiXS5yZWFkeSAmJiBhLnNjcmlwdHNbYl0uZXhlY190cmlnZ2VyKSB7IGMgPSB0cnVlOyBhLnNjcmlwdHNbYl0uZXhlY190cmlnZ2VyKCk7IGEuc2NyaXB0c1tiXS5leGVjX3RyaWdnZXIgPSBudWxsIH0gfSByZXR1cm4gYyB9IGZ1bmN0aW9uIHQoYSwgYywgYiwgZCkgeyBhLm9ubG9hZCA9IGEub25yZWFkeXN0YXRlY2hhbmdlID0gZnVuY3Rpb24oKSB7IGlmKChhLnJlYWR5U3RhdGUgJiYgYS5yZWFkeVN0YXRlICE9IFwiY29tcGxldGVcIiAmJiBhLnJlYWR5U3RhdGUgIT0gXCJsb2FkZWRcIikgfHwgY1tiXSkgcmV0dXJuOyBhLm9ubG9hZCA9IGEub25yZWFkeXN0YXRlY2hhbmdlID0gbnVsbDsgZCgpIH0gfSBmdW5jdGlvbiBJKGEpIHsgYS5yZWFkeSA9IGEuZmluaXNoZWQgPSB0cnVlOyBmb3IodmFyIGMgPSAwOyBjIDwgYS5maW5pc2hlZF9saXN0ZW5lcnMubGVuZ3RoOyBjKyspIHsgYS5maW5pc2hlZF9saXN0ZW5lcnNbY10oKSB9IGEucmVhZHlfbGlzdGVuZXJzID0gW107IGEuZmluaXNoZWRfbGlzdGVuZXJzID0gW10gfSBmdW5jdGlvbiBQKGQsIGYsIGUsIGcsIGgpIHsgc2V0VGltZW91dChmdW5jdGlvbigpIHsgdmFyIGEsIGMgPSBmLnJlYWxfc3JjLCBiOyBpZihcIml0ZW1cIiBpbiBpKSB7IGlmKCFpWzBdKSB7IHNldFRpbWVvdXQoYXJndW1lbnRzLmNhbGxlZSwgMjUpOyByZXR1cm4gfSBpID0gaVswXSB9IGEgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic2NyaXB0XCIpOyBpZihmLnR5cGUpIGEudHlwZSA9IGYudHlwZTsgaWYoZi5jaGFyc2V0KSBhLmNoYXJzZXQgPSBmLmNoYXJzZXQ7IGlmKGgpIHsgaWYocikgeyBlLmVsZW0gPSBhOyBpZihFKSB7IGEucHJlbG9hZCA9IHRydWU7IGEub25wcmVsb2FkID0gZyB9IGVsc2UgeyBhLm9ucmVhZHlzdGF0ZWNoYW5nZSA9IGZ1bmN0aW9uKCkgeyBpZihhLnJlYWR5U3RhdGUgPT0gXCJsb2FkZWRcIikgZygpIH0gfSBhLnNyYyA9IGMgfSBlbHNlIGlmKGggJiYgYy5pbmRleE9mKEQpID09IDAgJiYgZFt5XSkgeyBiID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7IGIub25yZWFkeXN0YXRlY2hhbmdlID0gZnVuY3Rpb24oKSB7IGlmKGIucmVhZHlTdGF0ZSA9PSA0KSB7IGIub25yZWFkeXN0YXRlY2hhbmdlID0gZnVuY3Rpb24oKSB7IH07IGUudGV4dCA9IGIucmVzcG9uc2VUZXh0ICsgXCJcXG4vL0Agc291cmNlVVJMPVwiICsgYzsgZygpIH0gfTsgYi5vcGVuKFwiR0VUXCIsIGMpOyBiLnNlbmQoKSB9IGVsc2UgeyBhLnR5cGUgPSBcInRleHQvY2FjaGUtc2NyaXB0XCI7IHQoYSwgZSwgXCJyZWFkeVwiLCBmdW5jdGlvbigpIHsgaS5yZW1vdmVDaGlsZChhKTsgZygpIH0pOyBhLnNyYyA9IGM7IGkuaW5zZXJ0QmVmb3JlKGEsIGkuZmlyc3RDaGlsZCkgfSB9IGVsc2UgaWYoRikgeyBhLmFzeW5jID0gZmFsc2U7IHQoYSwgZSwgXCJmaW5pc2hlZFwiLCBnKTsgYS5zcmMgPSBjOyBpLmluc2VydEJlZm9yZShhLCBpLmZpcnN0Q2hpbGQpIH0gZWxzZSB7IHQoYSwgZSwgXCJmaW5pc2hlZFwiLCBnKTsgYS5zcmMgPSBjOyBpLmluc2VydEJlZm9yZShhLCBpLmZpcnN0Q2hpbGQpIH0gfSwgMCkgfSBmdW5jdGlvbiBKKCkgeyB2YXIgbCA9IHt9LCBRID0gciB8fCBNLCBuID0gW10sIHAgPSB7fSwgbTsgbFt5XSA9IHRydWU7IGxbel0gPSBmYWxzZTsgbFt1XSA9IGZhbHNlOyBsW0FdID0gZmFsc2U7IGxbQl0gPSBcIlwiOyBmdW5jdGlvbiBSKGEsIGMsIGIpIHsgdmFyIGQ7IGZ1bmN0aW9uIGYoKSB7IGlmKGQgIT0gbnVsbCkgeyBkID0gbnVsbDsgSShiKSB9IH0gaWYocFtjLnNyY10uZmluaXNoZWQpIHJldHVybjsgaWYoIWFbdV0pIHBbYy5zcmNdLmZpbmlzaGVkID0gdHJ1ZTsgZCA9IGIuZWxlbSB8fCBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic2NyaXB0XCIpOyBpZihjLnR5cGUpIGQudHlwZSA9IGMudHlwZTsgaWYoYy5jaGFyc2V0KSBkLmNoYXJzZXQgPSBjLmNoYXJzZXQ7IHQoZCwgYiwgXCJmaW5pc2hlZFwiLCBmKTsgaWYoYi5lbGVtKSB7IGIuZWxlbSA9IG51bGwgfSBlbHNlIGlmKGIudGV4dCkgeyBkLm9ubG9hZCA9IGQub25yZWFkeXN0YXRlY2hhbmdlID0gbnVsbDsgZC50ZXh0ID0gYi50ZXh0IH0gZWxzZSB7IGQuc3JjID0gYy5yZWFsX3NyYyB9IGkuaW5zZXJ0QmVmb3JlKGQsIGkuZmlyc3RDaGlsZCk7IGlmKGIudGV4dCkgeyBmKCkgfSB9IGZ1bmN0aW9uIFMoYywgYiwgZCwgZikgeyB2YXIgZSwgZywgaCA9IGZ1bmN0aW9uKCkgeyBiLnJlYWR5X2NiKGIsIGZ1bmN0aW9uKCkgeyBSKGMsIGIsIGUpIH0pIH0sIGogPSBmdW5jdGlvbigpIHsgYi5maW5pc2hlZF9jYihiLCBkKSB9OyBiLnNyYyA9IE4oYi5zcmMsIGNbQl0pOyBiLnJlYWxfc3JjID0gYi5zcmMgKyAoY1tBXSA/ICgoL1xcPy4qJC8udGVzdChiLnNyYykgPyBcIiZfXCIgOiBcIj9fXCIpICsgfn4oTWF0aC5yYW5kb20oKSAqIDFFOSkgKyBcIj1cIikgOiBcIlwiKTsgaWYoIXBbYi5zcmNdKSBwW2Iuc3JjXSA9IHsgaXRlbXM6IFtdLCBmaW5pc2hlZDogZmFsc2UgfTsgZyA9IHBbYi5zcmNdLml0ZW1zOyBpZihjW3VdIHx8IGcubGVuZ3RoID09IDApIHsgZSA9IGdbZy5sZW5ndGhdID0geyByZWFkeTogZmFsc2UsIGZpbmlzaGVkOiBmYWxzZSwgcmVhZHlfbGlzdGVuZXJzOiBbaF0sIGZpbmlzaGVkX2xpc3RlbmVyczogW2pdIH07IFAoYywgYiwgZSwgKChmKSA/IGZ1bmN0aW9uKCkgeyBlLnJlYWR5ID0gdHJ1ZTsgZm9yKHZhciBhID0gMDsgYSA8IGUucmVhZHlfbGlzdGVuZXJzLmxlbmd0aDsgYSsrKSB7IGUucmVhZHlfbGlzdGVuZXJzW2FdKCkgfSBlLnJlYWR5X2xpc3RlbmVycyA9IFtdIH0gOiBmdW5jdGlvbigpIHsgSShlKSB9KSwgZikgfSBlbHNlIHsgZSA9IGdbMF07IGlmKGUuZmluaXNoZWQpIHsgaigpIH0gZWxzZSB7IGUuZmluaXNoZWRfbGlzdGVuZXJzLnB1c2goaikgfSB9IH0gZnVuY3Rpb24gdigpIHsgdmFyIGUsIGcgPSBzKGwsIHt9KSwgaCA9IFtdLCBqID0gMCwgdyA9IGZhbHNlLCBrOyBmdW5jdGlvbiBUKGEsIGMpIHsgYS5yZWFkeSA9IHRydWU7IGEuZXhlY190cmlnZ2VyID0gYzsgeCgpIH0gZnVuY3Rpb24gVShhLCBjKSB7IGEucmVhZHkgPSBhLmZpbmlzaGVkID0gdHJ1ZTsgYS5leGVjX3RyaWdnZXIgPSBudWxsOyBmb3IodmFyIGIgPSAwOyBiIDwgYy5zY3JpcHRzLmxlbmd0aDsgYisrKSB7IGlmKCFjLnNjcmlwdHNbYl0uZmluaXNoZWQpIHJldHVybiB9IGMuZmluaXNoZWQgPSB0cnVlOyB4KCkgfSBmdW5jdGlvbiB4KCkgeyB3aGlsZShqIDwgaC5sZW5ndGgpIHsgaWYoRyhoW2pdKSkgeyB0cnkgeyBoW2orK10oKSB9IGNhdGNoKGVycikgeyB9IGNvbnRpbnVlIH0gZWxzZSBpZighaFtqXS5maW5pc2hlZCkgeyBpZihPKGhbal0pKSBjb250aW51ZTsgYnJlYWsgfSBqKysgfSBpZihqID09IGgubGVuZ3RoKSB7IHcgPSBmYWxzZTsgayA9IGZhbHNlIH0gfSBmdW5jdGlvbiBWKCkgeyBpZighayB8fCAhay5zY3JpcHRzKSB7IGgucHVzaChrID0geyBzY3JpcHRzOiBbXSwgZmluaXNoZWQ6IHRydWUgfSkgfSB9IGUgPSB7IHNjcmlwdDogZnVuY3Rpb24oKSB7IGZvcih2YXIgZiA9IDA7IGYgPCBhcmd1bWVudHMubGVuZ3RoOyBmKyspIHsgKGZ1bmN0aW9uKGEsIGMpIHsgdmFyIGI7IGlmKCFIKGEpKSB7IGMgPSBbYV0gfSBmb3IodmFyIGQgPSAwOyBkIDwgYy5sZW5ndGg7IGQrKykgeyBWKCk7IGEgPSBjW2RdOyBpZihHKGEpKSBhID0gYSgpOyBpZighYSkgY29udGludWU7IGlmKEgoYSkpIHsgYiA9IFtdLnNsaWNlLmNhbGwoYSk7IGIudW5zaGlmdChkLCAxKTtbXS5zcGxpY2UuYXBwbHkoYywgYik7IGQtLTsgY29udGludWUgfSBpZih0eXBlb2YgYSA9PSBcInN0cmluZ1wiKSBhID0geyBzcmM6IGEgfTsgYSA9IHMoYSwgeyByZWFkeTogZmFsc2UsIHJlYWR5X2NiOiBULCBmaW5pc2hlZDogZmFsc2UsIGZpbmlzaGVkX2NiOiBVIH0pOyBrLmZpbmlzaGVkID0gZmFsc2U7IGsuc2NyaXB0cy5wdXNoKGEpOyBTKGcsIGEsIGssIChRICYmIHcpKTsgdyA9IHRydWU7IGlmKGdbel0pIGUud2FpdCgpIH0gfSkoYXJndW1lbnRzW2ZdLCBhcmd1bWVudHNbZl0pIH0gcmV0dXJuIGUgfSwgd2FpdDogZnVuY3Rpb24oKSB7IGlmKGFyZ3VtZW50cy5sZW5ndGggPiAwKSB7IGZvcih2YXIgYSA9IDA7IGEgPCBhcmd1bWVudHMubGVuZ3RoOyBhKyspIHsgaC5wdXNoKGFyZ3VtZW50c1thXSkgfSBrID0gaFtoLmxlbmd0aCAtIDFdIH0gZWxzZSBrID0gZmFsc2U7IHgoKTsgcmV0dXJuIGUgfSB9OyByZXR1cm4geyBzY3JpcHQ6IGUuc2NyaXB0LCB3YWl0OiBlLndhaXQsIHNldE9wdGlvbnM6IGZ1bmN0aW9uKGEpIHsgcyhhLCBnKTsgcmV0dXJuIGUgfSB9IH0gbSA9IHsgc2V0R2xvYmFsRGVmYXVsdHM6IGZ1bmN0aW9uKGEpIHsgcyhhLCBsKTsgcmV0dXJuIG0gfSwgc2V0T3B0aW9uczogZnVuY3Rpb24oKSB7IHJldHVybiB2KCkuc2V0T3B0aW9ucy5hcHBseShudWxsLCBhcmd1bWVudHMpIH0sIHNjcmlwdDogZnVuY3Rpb24oKSB7IHJldHVybiB2KCkuc2NyaXB0LmFwcGx5KG51bGwsIGFyZ3VtZW50cykgfSwgd2FpdDogZnVuY3Rpb24oKSB7IHJldHVybiB2KCkud2FpdC5hcHBseShudWxsLCBhcmd1bWVudHMpIH0sIHF1ZXVlU2NyaXB0OiBmdW5jdGlvbigpIHsgbltuLmxlbmd0aF0gPSB7IHR5cGU6IFwic2NyaXB0XCIsIGFyZ3M6IFtdLnNsaWNlLmNhbGwoYXJndW1lbnRzKSB9OyByZXR1cm4gbSB9LCBxdWV1ZVdhaXQ6IGZ1bmN0aW9uKCkgeyBuW24ubGVuZ3RoXSA9IHsgdHlwZTogXCJ3YWl0XCIsIGFyZ3M6IFtdLnNsaWNlLmNhbGwoYXJndW1lbnRzKSB9OyByZXR1cm4gbSB9LCBydW5RdWV1ZTogZnVuY3Rpb24oKSB7IHZhciBhID0gbSwgYyA9IG4ubGVuZ3RoLCBiID0gYywgZDsgZm9yKDsgLS1iID49IDA7KSB7IGQgPSBuLnNoaWZ0KCk7IGEgPSBhW2QudHlwZV0uYXBwbHkobnVsbCwgZC5hcmdzKSB9IHJldHVybiBhIH0sIG5vQ29uZmxpY3Q6IGZ1bmN0aW9uKCkgeyBvLiRMQUIgPSBLOyByZXR1cm4gbSB9LCBzYW5kYm94OiBmdW5jdGlvbigpIHsgcmV0dXJuIEooKSB9IH07IHJldHVybiBtIH0gby4kTEFCID0gSigpOyAoZnVuY3Rpb24oYSwgYywgYj8pIHsgaWYoZG9jdW1lbnQucmVhZHlTdGF0ZSA9PSBudWxsICYmIGRvY3VtZW50W2FdKSB7IGRvY3VtZW50LnJlYWR5U3RhdGUgPSBcImxvYWRpbmdcIjsgZG9jdW1lbnRbYV0oYywgYiA9IGZ1bmN0aW9uKCkgeyBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKGMsIGIsIGZhbHNlKTsgZG9jdW1lbnQucmVhZHlTdGF0ZSA9IFwiY29tcGxldGVcIiB9LCBmYWxzZSkgfSB9KShcImFkZEV2ZW50TGlzdGVuZXJcIiwgXCJET01Db250ZW50TG9hZGVkXCIpIH0pKHRoaXMpO1xyXG4vKiB0c2xpbnQ6ZW5hYmxlICovXHJcblxyXG5cclxuLyoqXHJcbiAqIChjKSBodHRwOi8vd3d3LnhlbmFyaXVzLm5ldCAtIE1vYmlsZSBhcHBsaWNhdGlvbnMgZm9yIHlvdXIgZGF0YSwgYnVpbHQgd2l0aG91dCBjb2RpbmcuXHJcbiAqL1xyXG5tb2R1bGUgQm9vdHN0cmFwcGVyIHtcclxuICAgIFwidXNlIHN0cmljdFwiO1xyXG5cclxuICAgIGV4cG9ydCB2YXIgcmVzb3VyY2VGaW5nZXJwcmludDogc3RyaW5nO1xyXG5cclxuICAgIGV4cG9ydCBpbnRlcmZhY2UgSUJvb3RzdHJhcHBlclJlc291cmNlIHtcclxuICAgICAgICBzcmM6IHN0cmluZztcclxuICAgICAgICBpZD86IHN0cmluZztcclxuICAgICAgICByZWw/OiBzdHJpbmc7XHJcbiAgICAgICAgZmlsZVR5cGU/OiBzdHJpbmc7XHJcbiAgICB9XHJcblxyXG4gICAgZXhwb3J0IGNsYXNzIFNpbXBsZURlZmVycmVkIHtcclxuICAgICAgICBwcml2YXRlIGNhbGxiYWNrcyA9IFtdO1xyXG4gICAgICAgIHByaXZhdGUgaXNSZXNvbHZlZCA9IGZhbHNlO1xyXG4gICAgICAgIHB1YmxpYyByZXNvbHZlKCkge1xyXG4gICAgICAgICAgICB0aGlzLmlzUmVzb2x2ZWQgPSB0cnVlO1xyXG4gICAgICAgICAgICB0aGlzLmNhbGxiYWNrcy5mb3JFYWNoKChjYWxsYmFjaykgPT4ge1xyXG4gICAgICAgICAgICAgICAgY2FsbGJhY2soKTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHB1YmxpYyBkb25lKGNhbGxiYWNrKSB7XHJcbiAgICAgICAgICAgIGlmKHRoaXMuaXNSZXNvbHZlZCkge1xyXG4gICAgICAgICAgICAgICAgY2FsbGJhY2soKTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuY2FsbGJhY2tzLnB1c2goY2FsbGJhY2spO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGV4cG9ydCBjbGFzcyBUYXNrUHJvZ3Jlc3NSZXBvcnRlciB7XHJcbiAgICAgICAgcHJpdmF0ZSBjb21wbGV0ZWRDb3VudCA9IDA7XHJcbiAgICAgICAgcHJpdmF0ZSByZWFsQ291bnQgPSAwO1xyXG4gICAgICAgIHByaXZhdGUgdG90YWxDb3VudCA9IDA7XHJcblxyXG4gICAgICAgIGNvbnN0cnVjdG9yKFxyXG4gICAgICAgICAgICBwcml2YXRlIGFwcHJveGltYXRlQ291bnQgPSAwLFxyXG4gICAgICAgICAgICBwcml2YXRlIG9uUHJvZ3Jlc3MgPSAocHJvZ3Jlc3MpID0+IHsgfSxcclxuICAgICAgICAgICAgcHJpdmF0ZSBvblRvdGFsQ29tcGxldGUgPSAoKSA9PiB7IH0pIHtcclxuICAgICAgICAgICAgdGhpcy50b3RhbENvdW50ID0gYXBwcm94aW1hdGVDb3VudDtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGVucXVldWUoY291bnQ6IG51bWJlciA9IDEpIHtcclxuICAgICAgICAgICAgdGhpcy5yZWFsQ291bnQgKz0gY291bnQ7XHJcbiAgICAgICAgICAgIGlmKHRoaXMucmVhbENvdW50ID4gdGhpcy50b3RhbENvdW50KSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnRvdGFsQ291bnQgPSB0aGlzLnJlYWxDb3VudDtcclxuICAgICAgICAgICAgICAgIHRoaXMudXBkYXRlKCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJlcG9ydChjb3VudDogbnVtYmVyID0gMSkge1xyXG4gICAgICAgICAgICB0aGlzLmNvbXBsZXRlZENvdW50ICs9IGNvdW50O1xyXG4gICAgICAgICAgICB0aGlzLnVwZGF0ZSgpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgY2xlYXIoKSB7XHJcbiAgICAgICAgICAgIHRoaXMucmVhbENvdW50ID0gdGhpcy5jb21wbGV0ZWRDb3VudCA9IHRoaXMudG90YWxDb3VudCA9IDA7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBwcml2YXRlIGdldEN1cnJlbnRQcm9ncmVzcygpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuY29tcGxldGVkQ291bnQgKiAxMDAgLyB0aGlzLnRvdGFsQ291bnQ7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBwcml2YXRlIGFyZVRvdGFsQ29tcGxldGVkKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5jb21wbGV0ZWRDb3VudCA9PT0gdGhpcy50b3RhbENvdW50O1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcHJpdmF0ZSB1cGRhdGUoKSB7XHJcbiAgICAgICAgICAgIC8vY29uc29sZS5sb2coW3RoaXMuY29tcGxldGVkQ291bnQsIHRoaXMucmVhbENvdW50LCB0aGlzLnRvdGFsQ291bnRdKVxyXG4gICAgICAgICAgICB0aGlzLm9uUHJvZ3Jlc3ModGhpcy5nZXRDdXJyZW50UHJvZ3Jlc3MoKSk7XHJcbiAgICAgICAgICAgIGlmKHRoaXMuYXJlVG90YWxDb21wbGV0ZWQoKSkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5vblRvdGFsQ29tcGxldGUoKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBleHBvcnQgY2xhc3MgQm9vdHN0cmFwcGVyIHtcclxuICAgICAgICBwcml2YXRlIGxhYiA9IHdpbmRvd1tcIiRMQUJcIl07XHJcbiAgICAgICAgY29uc3RydWN0b3IocHJpdmF0ZSBwcm9ncmVzc1JlcG9ydGVyID0gbmV3IFRhc2tQcm9ncmVzc1JlcG9ydGVyKCkpIHtcclxuICAgICAgICB9XHJcbiAgICAgICAgcHJpdmF0ZSBnZXQodXJsOiBzdHJpbmcsIGRvbmU6IChyZXN1bHQpID0+IHZvaWQsIGZhaWw6ICgpID0+IHZvaWQpIHtcclxuICAgICAgICAgICAgaWYodHlwZW9mICQgIT09IFwidW5kZWZpbmVkXCIgJiYgJC5nZXQpIHtcclxuICAgICAgICAgICAgICAgICQuZ2V0KHVybCkudGhlbihkb25lLCBmYWlsKTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHZhciByZXF1ZXN0ID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XHJcbiAgICAgICAgICAgICAgICByZXF1ZXN0Lm9wZW4oXCJHRVRcIiwgdXJsLCB0cnVlKTtcclxuICAgICAgICAgICAgICAgIHJlcXVlc3Qub25yZWFkeXN0YXRlY2hhbmdlID0gZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYodGhpcy5yZWFkeVN0YXRlID09PSA0KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmKHRoaXMuc3RhdHVzID49IDIwMCAmJiB0aGlzLnN0YXR1cyA8IDQwMCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZG9uZSh0aGlzLnJlc3BvbnNlVGV4dCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmYWlsKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICAgICAgcmVxdWVzdC5zZW5kKCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgcHJpdmF0ZSBpbml0SHRtbEVsZW1lbnQoZWxlbWVudDogRWxlbWVudCwgcmVzb3VyY2U6IElCb290c3RyYXBwZXJSZXNvdXJjZSkge1xyXG4gICAgICAgICAgICBlbGVtZW50LnNldEF0dHJpYnV0ZShcInR5cGVcIiwgXCJ0ZXh0L2h0bWxcIik7XHJcbiAgICAgICAgICAgIGlmKHJlc291cmNlLmlkKSB7IGVsZW1lbnQuc2V0QXR0cmlidXRlKFwiaWRcIiwgcmVzb3VyY2UuaWQpOyB9XHJcbiAgICAgICAgICAgIGlmKHJlc291cmNlLnJlbCkgeyBlbGVtZW50LnNldEF0dHJpYnV0ZShcInJlbFwiLCByZXNvdXJjZS5yZWwpOyB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHByaXZhdGUgYXBwZW5kSHRtbChwYXJlbnQ6IEVsZW1lbnQsIGh0bWw6IHN0cmluZykge1xyXG4gICAgICAgICAgICB2YXIgZGl2ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcclxuICAgICAgICAgICAgZGl2LmlubmVySFRNTCA9IGh0bWw7XHJcbiAgICAgICAgICAgIHdoaWxlKGRpdi5jaGlsZHJlbi5sZW5ndGgpIHtcclxuICAgICAgICAgICAgICAgIHZhciBjaGlsZCA9IGRpdi5jaGlsZHJlblswXTtcclxuICAgICAgICAgICAgICAgIHBhcmVudC5hcHBlbmRDaGlsZChjaGlsZCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgcHJpdmF0ZSBub3JtYWxpemUocmVzb3VyY2VzOiAoc3RyaW5nIHwgSUJvb3RzdHJhcHBlclJlc291cmNlKVtdLCByb290UGF0aDogc3RyaW5nKSB7XHJcbiAgICAgICAgICAgIHJldHVybiAocmVzb3VyY2VzIHx8IFtdKS5tYXAoKHJlc291cmNlKSA9PiB7XHJcbiAgICAgICAgICAgICAgICB2YXIgcmVzID0gdHlwZW9mIHJlc291cmNlID09PSBcInN0cmluZ1wiID8geyBzcmM6IDxzdHJpbmc+cmVzb3VyY2UsIGZpbGVUeXBlOiBudWxsLCBpZDogbnVsbCB9IDogPElCb290c3RyYXBwZXJSZXNvdXJjZT5yZXNvdXJjZSxcclxuICAgICAgICAgICAgICAgICAgICBzcmMgPSByZXMuc3JjLmluZGV4T2YoXCJodHRwXCIpID09PSAwID8gcmVzLnNyYyA6IHJvb3RQYXRoICsgKFwiL1wiICsgcmVzLnNyYykucmVwbGFjZShcIi8vXCIsIFwiL1wiKTtcclxuICAgICAgICAgICAgICAgIHJlcy5zcmMgPSB0aGlzLmluc2VydEZpbmdlcnByaW50KHNyYyk7XHJcbiAgICAgICAgICAgICAgICByZXMuZmlsZVR5cGUgPSByZXMuZmlsZVR5cGUgfHwgcmVzLnNyYy5zcGxpdChcIi5cIikucG9wKCkudG9Mb2NhbGVMb3dlckNhc2UoKTtcclxuICAgICAgICAgICAgICAgIHJldHVybiByZXM7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuICAgICAgICBwcml2YXRlIGJvb3RzdHJhcFJlc291cmNlKHJlc291cmNlOiBJQm9vdHN0cmFwcGVyUmVzb3VyY2UsIG9ubG9hZDogKCkgPT4gdm9pZCA9ICgpID0+IHsgfSkge1xyXG4gICAgICAgICAgICB2YXIgZmlsZXJlZixcclxuICAgICAgICAgICAgICAgIG9uZXJyb3IgPSAoKSA9PiB7IGNvbnNvbGUuZXJyb3IoXCJDb3VsZCBub3QgbG9hZCBmaWxlOiBcIiArIHJlc291cmNlLnNyYyk7IH07XHJcbiAgICAgICAgICAgIGlmKHJlc291cmNlLmZpbGVUeXBlID09PSBcImh0bWxcIikge1xyXG4gICAgICAgICAgICAgICAgaWYocmVzb3VyY2UucmVsID09PSBcImR4LXRlbXBsYXRlXCIpIHtcclxuICAgICAgICAgICAgICAgICAgICBmaWxlcmVmID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImxpbmtcIik7XHJcbiAgICAgICAgICAgICAgICAgICAgZmlsZXJlZi5ocmVmID0gcmVzb3VyY2Uuc3JjO1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuaW5pdEh0bWxFbGVtZW50KGZpbGVyZWYsIHJlc291cmNlKTtcclxuICAgICAgICAgICAgICAgICAgICBkb2N1bWVudC5oZWFkLmFwcGVuZENoaWxkKGZpbGVyZWYpO1xyXG4gICAgICAgICAgICAgICAgICAgIG9ubG9hZCgpO1xyXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLmdldChyZXNvdXJjZS5zcmMsICh0bXBsKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmKHRtcGwuaW5kZXhPZihcInR5cGU9J3RleHQvaHRtbCdcIikgIT09IC0xIHx8IHRtcGwuaW5kZXhPZihcInR5cGU9XFxcInRleHQvaHRtbFxcXCJcIikgIT09IC0xKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZihyZXNvdXJjZS5yZWwpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgZGl2ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkaXYuc3R5bGUuZGlzcGxheSA9IFwibm9uZVwiO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRpdi5pbm5lckhUTUwgPSB0bXBsO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoZGl2KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5hcHBlbmRIdG1sKGRvY3VtZW50LmJvZHksIHRtcGwpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGZpbGVyZWYgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic2NyaXB0XCIpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZmlsZXJlZi50ZXh0ID0gdG1wbDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuaW5pdEh0bWxFbGVtZW50KGZpbGVyZWYsIHJlc291cmNlKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoZmlsZXJlZik7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgb25sb2FkKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgfSwgb25lcnJvcik7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBpZihyZXNvdXJjZS5maWxlVHlwZSA9PT0gXCJqc1wiKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5sYWIgPSB0aGlzLmxhYi5zY3JpcHQocmVzb3VyY2Uuc3JjKS53YWl0KG9ubG9hZCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBlbHNlIGlmKHJlc291cmNlLmZpbGVUeXBlID09PSBcImNzc1wiKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgZmlsZXJlZiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJsaW5rXCIpO1xyXG4gICAgICAgICAgICAgICAgICAgIGZpbGVyZWYuc2V0QXR0cmlidXRlKFwicmVsXCIsIFwic3R5bGVzaGVldFwiKTtcclxuICAgICAgICAgICAgICAgICAgICBmaWxlcmVmLnNldEF0dHJpYnV0ZShcInR5cGVcIiwgXCJ0ZXh0L2Nzc1wiKTtcclxuICAgICAgICAgICAgICAgICAgICBmaWxlcmVmLnNldEF0dHJpYnV0ZShcImhyZWZcIiwgcmVzb3VyY2Uuc3JjKTtcclxuICAgICAgICAgICAgICAgICAgICBmaWxlcmVmLm9ubG9hZCA9IG9ubG9hZDtcclxuICAgICAgICAgICAgICAgICAgICBmaWxlcmVmLm9uZXJyb3IgPSBvbmVycm9yO1xyXG4gICAgICAgICAgICAgICAgICAgIGRvY3VtZW50LmhlYWQuYXBwZW5kQ2hpbGQoZmlsZXJlZik7XHJcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJVbnN1cHBvcnRlZCBmaWxlIHR5cGU6ICVvXCIsIHJlc291cmNlKTtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgcHVibGljIGluc2VydEZpbmdlcnByaW50KHBhdGg6IHN0cmluZyk6IHN0cmluZyB7XHJcbiAgICAgICAgICAgIGlmKHJlc291cmNlRmluZ2VycHJpbnQpIHtcclxuICAgICAgICAgICAgICAgIHZhciBpbmRleCA9IHBhdGgubGFzdEluZGV4T2YoXCIvXCIpO1xyXG4gICAgICAgICAgICAgICAgaW5kZXggPSBwYXRoLmluZGV4T2YoXCIuXCIsIGluZGV4KTtcclxuICAgICAgICAgICAgICAgIHJldHVybiBwYXRoLnN1YnN0cmluZygwLCBpbmRleCkgKyByZXNvdXJjZUZpbmdlcnByaW50ICsgcGF0aC5zdWJzdHJpbmcoaW5kZXgpO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHBhdGg7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgcHVibGljIGJvb3RzdHJhcChyZXNvdXJjZXM6IChzdHJpbmcgfCBJQm9vdHN0cmFwcGVyUmVzb3VyY2UpW10sIHJvb3RQYXRoOiBzdHJpbmcgPSBcIlwiKTogU2ltcGxlRGVmZXJyZWQge1xyXG4gICAgICAgICAgICB2YXIgcmVzdWx0ID0gbmV3IFNpbXBsZURlZmVycmVkKCksXHJcbiAgICAgICAgICAgICAgICBmaWxlc0NvdW50ID0gcmVzb3VyY2VzLmxlbmd0aDtcclxuICAgICAgICAgICAgdGhpcy5wcm9ncmVzc1JlcG9ydGVyLmVucXVldWUoZmlsZXNDb3VudCk7XHJcblxyXG4gICAgICAgICAgICB0aGlzLm5vcm1hbGl6ZShyZXNvdXJjZXMsIHJvb3RQYXRoKS5mb3JFYWNoKChmaWxlKSA9PiB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmJvb3RzdHJhcFJlc291cmNlKGZpbGUsICgpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLnByb2dyZXNzUmVwb3J0ZXIucmVwb3J0KCk7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYoIS0tZmlsZXNDb3VudCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXN1bHQucmVzb2x2ZSgpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbn0gIiwiLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4uLy4uL2Jvb3RzdHJhcHBlci90cy9ib290c3RyYXBwZXIudHNcIiAvPlxyXG5tb2R1bGUgQXBwUGxheWVyIHtcclxuICAgIFwidXNlIHN0cmljdFwiO1xyXG5cclxuICAgIGV4cG9ydCBjbGFzcyBNb2R1bGVCYXNlIHtcclxuICAgICAgICBfYXBwbGljYXRpb246IEFwcGxpY2F0aW9uO1xyXG4gICAgICAgIGNvbnN0cnVjdG9yKGFwcGxpY2F0aW9uOiBBcHBsaWNhdGlvbikge1xyXG4gICAgICAgICAgICB0aGlzLl9hcHBsaWNhdGlvbiA9IGFwcGxpY2F0aW9uO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBleHBvcnQgaW50ZXJmYWNlIElNb2R1bGUge1xyXG4gICAgICAgIGNyZWF0ZU1vZHVsZT86IChhcHBsaWNhdGlvbjogQXBwbGljYXRpb24pID0+IGFueTtcclxuICAgICAgICBmdW5jdGlvbnM/OiB7IGlkOiBzdHJpbmc7IGZ1bmM6ICguLi5hcmdzOiBhbnlbXSkgPT4gYW55IH1bXTtcclxuICAgIH1cclxuXHJcbiAgICBleHBvcnQgaW50ZXJmYWNlIElNb2R1bGVDb25maWcge1xyXG4gICAgICAgIG5hbWVzcGFjZTogc3RyaW5nO1xyXG4gICAgICAgIGZpbGVzOiAoc3RyaW5nIHwgQm9vdHN0cmFwcGVyLklCb290c3RyYXBwZXJSZXNvdXJjZSlbXTtcclxuICAgIH1cclxuXHJcbiAgICBleHBvcnQgY2xhc3MgTW9kdWxlc0xvYWRlciBleHRlbmRzIEJvb3RzdHJhcHBlci5Cb290c3RyYXBwZXIge1xyXG4gICAgICAgIHB1YmxpYyBzdGF0aWMgTU9EVUxFRklMRU5BTUUgPSBcIm1vZHVsZS5qc29uXCI7XHJcbiAgICAgICAgX2FwcGxpY2F0aW9uOiBBcHBsaWNhdGlvbjtcclxuICAgICAgICBwcml2YXRlIF9pbml0TW9kdWxlKG1vZHVsZVZhck5hbWUpIHtcclxuICAgICAgICAgICAgdmFyIF9tb2R1bGU6IElNb2R1bGUgPSBjb21waWxlR2V0dGVyKG1vZHVsZVZhck5hbWUpKHdpbmRvdyk7XHJcbiAgICAgICAgICAgIGlmKF9tb2R1bGUuZnVuY3Rpb25zICYmIHRoaXMuX2FwcGxpY2F0aW9uKSB7XHJcbiAgICAgICAgICAgICAgICBfbW9kdWxlLmZ1bmN0aW9ucy5mb3JFYWNoKChmdW5jRGVjbGFyYXRpb24pID0+IHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9hcHBsaWNhdGlvbi5mdW5jdGlvbnNbZnVuY0RlY2xhcmF0aW9uLmlkXSA9IGZ1bmNEZWNsYXJhdGlvbi5mdW5jO1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgaWYoX21vZHVsZS5jcmVhdGVNb2R1bGUpIHtcclxuICAgICAgICAgICAgICAgIF9tb2R1bGUuY3JlYXRlTW9kdWxlKHRoaXMuX2FwcGxpY2F0aW9uKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBjb25zdHJ1Y3RvcihhcHBsaWNhdGlvbjogQXBwbGljYXRpb24sIHByb2dyZXNzUmVwb3Rlcj86IEJvb3RzdHJhcHBlci5UYXNrUHJvZ3Jlc3NSZXBvcnRlcikge1xyXG4gICAgICAgICAgICBzdXBlcihwcm9ncmVzc1JlcG90ZXIpO1xyXG4gICAgICAgICAgICB0aGlzLl9hcHBsaWNhdGlvbiA9IGFwcGxpY2F0aW9uO1xyXG4gICAgICAgIH1cclxuICAgICAgICBwdWJsaWMgaW5pdE1vZHVsZXMobW9kdWxlcz86IChzdHJpbmcgfCB7IHNyYzogc3RyaW5nIH0pW10pOiBKUXVlcnlQcm9taXNlPGFueT4ge1xyXG4gICAgICAgICAgICB2YXIgcmVzdWx0ID0gJC5EZWZlcnJlZCgpO1xyXG4gICAgICAgICAgICB2YXIgbW9kdWxlc0NvbmZpZyA9IG1vZHVsZXMgfHwgdGhpcy5fYXBwbGljYXRpb24gJiYgdGhpcy5fYXBwbGljYXRpb24uYXBwQ29uZmlnLm1vZHVsZXM7XHJcbiAgICAgICAgICAgIGlmKG1vZHVsZXNDb25maWcpIHtcclxuICAgICAgICAgICAgICAgIHZhciBwcm9taXNlcyA9IG1vZHVsZXNDb25maWcubWFwKG1vZHVsZUluZm8gPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciBhamF4UmVzdWx0ID0gJC5EZWZlcnJlZCgpO1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciByb290TW9kdWxlVXJsID0gKDx7IHNyYzogc3RyaW5nIH0+bW9kdWxlSW5mbykuc3JjIHx8IDxzdHJpbmc+bW9kdWxlSW5mbztcclxuICAgICAgICAgICAgICAgICAgICAkLmdldEpTT04ocm9vdE1vZHVsZVVybCArIFwiL1wiICsgdGhpcy5pbnNlcnRGaW5nZXJwcmludChNb2R1bGVzTG9hZGVyLk1PRFVMRUZJTEVOQU1FKSkuZG9uZSgobW9kdWxlSXRlbTogSU1vZHVsZUNvbmZpZykgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmxvYWRNb2R1bGUocm9vdE1vZHVsZVVybCwgbW9kdWxlSXRlbSkuZG9uZSgoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhamF4UmVzdWx0LnJlc29sdmUoKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfSkuZmFpbCgoZXJyb3IpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgYWpheFJlc3VsdC5yZWplY3QoZXJyb3IpO1xyXG4gICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBhamF4UmVzdWx0O1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICAkLndoZW4uYXBwbHkoJCwgcHJvbWlzZXMpLmRvbmUoKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdC5yZXNvbHZlKCk7XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHJlc3VsdC5yZXNvbHZlKCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdC5wcm9taXNlKCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHB1YmxpYyBsb2FkTW9kdWxlKHJvb3RQYXRoOiBzdHJpbmcsIG1vZHVsZUl0ZW06IElNb2R1bGVDb25maWcpOiBKUXVlcnlQcm9taXNlPGFueT4ge1xyXG4gICAgICAgICAgICB2YXIgcmVzdWx0ID0gJC5EZWZlcnJlZCgpO1xyXG4gICAgICAgICAgICB0aGlzLmJvb3RzdHJhcChtb2R1bGVJdGVtLmZpbGVzLCByb290UGF0aCkuZG9uZSgoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICBpZihtb2R1bGVJdGVtLm5hbWVzcGFjZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2luaXRNb2R1bGUobW9kdWxlSXRlbS5uYW1lc3BhY2UpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgcmVzdWx0LnJlc29sdmUoKTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59ICIsIm1vZHVsZSBBcHBQbGF5ZXIuU3R5bGVzIHtcclxuICAgIFwidXNlIHN0cmljdFwiO1xyXG5cclxuICAgIC8vIEl2YW46IFdlIGRlY2lkZWQgbm90IHRvIGluY2x1ZGUgdGhlbWluZyB3aXRoIGZpcnN0IHJlbGVhc2UuIFxyXG5cclxuICAgIC8vZXhwb3J0IGZ1bmN0aW9uIGxvYWRUaGVtZShtZXRhOiBhbnlbXSwgY3NzOiBzdHJpbmcsIHN0eWxlczogeyBba2V5OiBzdHJpbmddOiBzdHJpbmcgfSkge1xyXG4gICAgLy8gICAgY3NzID0gbG9hZFRoZW1lQ29yZShtZXRhLCBjc3MsIHN0eWxlcyk7XHJcbiAgICAvLyAgICAkKFwiPHN0eWxlLz5cIilcclxuICAgIC8vICAgICAgICAudGV4dChjc3MpXHJcbiAgICAvLyAgICAgICAgLmFwcGVuZFRvKCQoXCJoZWFkXCIpKTtcclxuICAgIC8vfVxyXG5cclxuICAgIC8vZXhwb3J0IGZ1bmN0aW9uIGxvYWRUaGVtZUNvcmUobWV0YTogYW55W10sIGNzczogc3RyaW5nLCBzdHlsZXM6IHsgW2tleTogc3RyaW5nXTogc3RyaW5nIH0pOiBzdHJpbmcge1xyXG4gICAgLy8gICAgdmFyIHJlcGxhY2VNYXAgPSB7fTtcclxuICAgIC8vICAgIHZhciB0aGVtZUJ1aWxkZXJQcmVmaXggPSBcImR4LXRoZW1lLWJ1aWxkZXItZ2VuZXJpYy1cIjtcclxuICAgIC8vICAgIG1ldGEuZm9yRWFjaCgoaXRlbSkgPT4ge1xyXG4gICAgLy8gICAgICAgIHZhciBrZXk6IHN0cmluZyA9IGl0ZW0uS2V5LFxyXG4gICAgLy8gICAgICAgICAgICB2YWx1ZTogc3RyaW5nID0gc3R5bGVzID8gKHN0eWxlc1trZXldIHx8IGl0ZW0uVmFsdWUpIDogaXRlbS5WYWx1ZSxcclxuICAgIC8vICAgICAgICAgICAgY3NzS2V5ID0gdGhlbWVCdWlsZGVyUHJlZml4ICsgcmVwbGFjZUFsbChrZXkudG9Mb3dlckNhc2UoKSwgXCJfXCIsIFwiLVwiKTtcclxuICAgIC8vICAgICAgICByZXBsYWNlTWFwW2Nzc0tleV0gPSB2YWx1ZTtcclxuICAgIC8vICAgIH0pO1xyXG4gICAgLy8gICAgdmFyIHJlc3VsdCA9IFwiXCI7XHJcbiAgICAvLyAgICB2YXIgdG9rZW5Qb3MgPSAtMSwgbGFzdFRva2VuUG9zID0gMDtcclxuICAgIC8vICAgIHdoaWxlKCh0b2tlblBvcyA9IGNzcy5pbmRleE9mKHRoZW1lQnVpbGRlclByZWZpeCwgbGFzdFRva2VuUG9zKSkgPj0gMCkge1xyXG4gICAgLy8gICAgICAgIHJlc3VsdCArPSBjc3Muc2xpY2UobGFzdFRva2VuUG9zLCB0b2tlblBvcyk7XHJcbiAgICAvLyAgICAgICAgbGFzdFRva2VuUG9zID0gdG9rZW5Qb3M7XHJcbiAgICAvLyAgICAgICAgd2hpbGUoaXNUb2tlbkNoYXIoY3NzLmNoYXJBdChsYXN0VG9rZW5Qb3MpKSlcclxuICAgIC8vICAgICAgICAgICAgbGFzdFRva2VuUG9zKys7XHJcbiAgICAvLyAgICAgICAgdmFyIHRva2VuID0gY3NzLnNsaWNlKHRva2VuUG9zLCBsYXN0VG9rZW5Qb3MpO1xyXG4gICAgLy8gICAgICAgIHZhciBjc3NWYWx1ZSA9IHJlcGxhY2VNYXBbdG9rZW5dO1xyXG4gICAgLy8gICAgICAgIGlmKCFjc3NWYWx1ZSlcclxuICAgIC8vICAgICAgICAgICAgY29uc29sZS5lcnJvcihcIlVua25vd24gY3NzIHRlbXBsYXRlOiBcIiArIHRva2VuKTtcclxuICAgIC8vICAgICAgICByZXN1bHQgKz0gY3NzVmFsdWU7XHJcbiAgICAvLyAgICB9XHJcbiAgICAvLyAgICBpZihsYXN0VG9rZW5Qb3MgPCBjc3MubGVuZ3RoKVxyXG4gICAgLy8gICAgICAgIHJlc3VsdCArPSBjc3Muc2xpY2UobGFzdFRva2VuUG9zKTtcclxuICAgIC8vICAgIHJldHVybiByZXN1bHQ7XHJcbiAgICAvL31cclxuXHJcbiAgICAvL2Z1bmN0aW9uIGlzVG9rZW5DaGFyKGNoYXI6IHN0cmluZykge1xyXG4gICAgLy8gICAgcmV0dXJuIChjaGFyID49ICdhJyAmJiBjaGFyIDw9ICd6JykgfHwgKGNoYXIgPj0gXCJBXCIgJiYgY2hhciA8PSBcIlpcIikgfHwgY2hhciA9PSBcIi1cIjtcclxuICAgIC8vfVxyXG59IiwibW9kdWxlIEFwcFBsYXllciB7XHJcbiAgICBcInVzZSBzdHJpY3RcIjtcclxuXHJcbiAgICBpbXBvcnQgYXBsID0gQXBwUGxheWVyLkxvZ2ljO1xyXG5cclxuICAgIGZ1bmN0aW9uIGJyYWNrZXRzVG9Eb3RzKGV4cHI6IHN0cmluZykge1xyXG4gICAgICAgIHJldHVybiBleHByLnJlcGxhY2UoL1xcWy9nLCBcIi5cIikucmVwbGFjZSgvXFxdL2csIFwiXCIpO1xyXG4gICAgfTtcclxuXHJcbiAgICBleHBvcnQgZnVuY3Rpb24gZ2V0TW9kZWxWYWx1ZShleHByLCBydW5Db250ZXh0OiBJUnVuQ29udGV4dCwgY2FsbGVySW5mbzogYXBsLklDYWxsZXJJbmZvKSB7XHJcbiAgICAgICAgcmV0dXJuIGV4ZWN1dGVNb2RlbFNwZWNpZmljQWNjZXNzb3IoZXhwciwgcnVuQ29udGV4dCwgY2FsbGVySW5mbywgKHNwZWNpZmljTW9kZWwsIHZhbHVlKSA9PiB7XHJcbiAgICAgICAgICAgIHJldHVybiBjb21waWxlR2V0dGVyKHZhbHVlKShzcGVjaWZpY01vZGVsKTtcclxuICAgICAgICB9KTtcclxuICAgIH07XHJcblxyXG4gICAgZnVuY3Rpb24gZXhlY3V0ZU1vZGVsU3BlY2lmaWNBY2Nlc3NvcihleHByOiBzdHJpbmcsIHJ1bkNvbnRleHQ6IElSdW5Db250ZXh0LCBjYWxsZXJJbmZvOiBhcGwuSUNhbGxlckluZm8sIGFjY2Vzc29yOiAobW9kZWw6IGFueSwgdmFsdWU6IHN0cmluZywgbmVnYXRpdmU/OiBib29sZWFuKSA9PiBzdHJpbmcgfCBLbm9ja291dE9ic2VydmFibGU8YW55Pikge1xyXG4gICAgICAgIHZhciBpc05lZ2F0aXZlID0gZXhwci5jaGFyQXQoMCkgPT09IFwiIVwiLFxyXG4gICAgICAgICAgICBhYnNFeHByID0gaXNOZWdhdGl2ZSA/IGV4cHIuc3Vic3RyaW5nKDEpIDogZXhwcixcclxuICAgICAgICAgICAgcG9pbnRJbmRleCA9IGFic0V4cHIuaW5kZXhPZihcIi5cIiksXHJcbiAgICAgICAgICAgIHJvb3RQcm9wZXJ0eU5hbWUgPSBhYnNFeHByLnN1YnN0cmluZygwLCBwb2ludEluZGV4KSB8fCBhYnNFeHByLFxyXG4gICAgICAgICAgICB2YWx1ZVBhdGggPSBwb2ludEluZGV4ID09PSAtMSA/IFwiXCIgOiBhYnNFeHByLnN1YnN0cmluZyhwb2ludEluZGV4ICsgMSk7XHJcbiAgICAgICAgcmV0dXJuIHJ1bkNvbnRleHRbcm9vdFByb3BlcnR5TmFtZV0gPyBhY2Nlc3NvcihydW5Db250ZXh0W3Jvb3RQcm9wZXJ0eU5hbWVdLCB2YWx1ZVBhdGgsIGlzTmVnYXRpdmUpIDogZXhwcjtcclxuICAgIH1cclxuXHJcbiAgICBleHBvcnQgZnVuY3Rpb24gY29tcGlsZUdldHRlcihleHByOiBzdHJpbmcpOiAob2JqKSA9PiBhbnkge1xyXG4gICAgICAgIGlmKCFleHByKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBvYmogPT4ga28udW53cmFwKG9iaik7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGV4cHIgPSBicmFja2V0c1RvRG90cyhleHByKTtcclxuICAgICAgICB2YXIgcGF0aCA9IGV4cHIuc3BsaXQoXCIuXCIpO1xyXG4gICAgICAgIHJldHVybiAob2JqKSA9PiB7XHJcbiAgICAgICAgICAgIHZhciBjdXJyZW50ID0ga28udW53cmFwKG9iaik7XHJcbiAgICAgICAgICAgIHBhdGguZm9yRWFjaCgobmFtZSwgaW5kZXgpID0+IHtcclxuICAgICAgICAgICAgICAgIGlmKCFjdXJyZW50KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgdmFyIG5leHQgPSBpbmRleCAhPT0gcGF0aC5sZW5ndGggLSAxID8ga28udW53cmFwKGN1cnJlbnRbbmFtZV0pIDogY3VycmVudFtuYW1lXTtcclxuICAgICAgICAgICAgICAgIGN1cnJlbnQgPSBuZXh0O1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgcmV0dXJuIGtvLnVud3JhcChjdXJyZW50KTtcclxuICAgICAgICB9O1xyXG4gICAgfTtcclxuXHJcbiAgICBleHBvcnQgdmFyIGNvbXBpbGVTZXR0ZXIgPSBEZXZFeHByZXNzLmRhdGEudXRpbHMuY29tcGlsZVNldHRlcjtcclxuXHJcbiAgICBleHBvcnQgZnVuY3Rpb24gZ2V0UXVlcnlWYXJpYWJsZSh2YXJpYWJsZTogc3RyaW5nKTogc3RyaW5nIHtcclxuICAgICAgICB2YXIgcXVlcnkgPSB3aW5kb3cubG9jYXRpb24uc2VhcmNoLnN1YnN0cmluZygxKTtcclxuICAgICAgICB2YXIgdmFycyA9IHF1ZXJ5LnNwbGl0KFwiJlwiKTtcclxuICAgICAgICBmb3IodmFyIGkgPSAwOyBpIDwgdmFycy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICB2YXIgZXFJbmRleCA9IHZhcnNbaV0uaW5kZXhPZihcIj1cIiksXHJcbiAgICAgICAgICAgICAgICBuYW1lID0gdmFyc1tpXS5zbGljZSgwLCBlcUluZGV4KSxcclxuICAgICAgICAgICAgICAgIHZhbHVlID0gdmFyc1tpXS5zbGljZShlcUluZGV4ICsgMSk7XHJcbiAgICAgICAgICAgIGlmKG5hbWUgPT09IHZhcmlhYmxlKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gdmFsdWU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICB9O1xyXG5cclxuICAgIGV4cG9ydCBmdW5jdGlvbiB3cmFwTW9kZWxSZWZlcmVuY2UodmFsdWU6IHN0cmluZywgcnVuQ29udGV4dDogSVJ1bkNvbnRleHQsIGNhbGxlckluZm86IGFwbC5JQ2FsbGVySW5mbykge1xyXG4gICAgICAgIHJldHVybiBleGVjdXRlTW9kZWxTcGVjaWZpY0FjY2Vzc29yKHZhbHVlLCBydW5Db250ZXh0LCBjYWxsZXJJbmZvLCAoc3BlY2lmaWNNb2RlbCwgZXhwcmVzc2lvbiwgbmVnYXRpdmUpID0+IHtcclxuICAgICAgICAgICAgcmV0dXJuIHdyYXBSZWZlcmVuY2VGaWVsZChzcGVjaWZpY01vZGVsLCBleHByZXNzaW9uLCBuZWdhdGl2ZSk7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gd3JhcFJlZmVyZW5jZUZpZWxkKG1vZGVsOiBhbnksIHZhbDogc3RyaW5nLCBuZWdhdGl2ZTogYm9vbGVhbikge1xyXG4gICAgICAgIHZhciBnZXR0ZXIsXHJcbiAgICAgICAgICAgIHNldHRlcixcclxuICAgICAgICAgICAgd3JpdGVOb3RpZmllciA9IGtvLm9ic2VydmFibGUoKSxcclxuICAgICAgICAgICAgcmVhZCxcclxuICAgICAgICAgICAgZGVzY3JpcHRvcjtcclxuXHJcbiAgICAgICAgaWYodmFsKSB7XHJcbiAgICAgICAgICAgIGRlc2NyaXB0b3IgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKG1vZGVsLCB2YWwpO1xyXG4gICAgICAgICAgICBnZXR0ZXIgPSBjb21waWxlR2V0dGVyKHZhbCk7XHJcbiAgICAgICAgICAgIGlmKCFkZXNjcmlwdG9yIHx8IGRlc2NyaXB0b3Iuc2V0IHx8IGRlc2NyaXB0b3Iud3JpdGFibGUpIHtcclxuICAgICAgICAgICAgICAgIHNldHRlciA9IGNvbXBpbGVTZXR0ZXIodmFsKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIGdldHRlciA9ICgpID0+IHsgcmV0dXJuIG1vZGVsOyB9O1xyXG4gICAgICAgIH1cclxuICAgICAgICByZWFkID0gKCkgPT4ge1xyXG4gICAgICAgICAgICBrby51bndyYXAod3JpdGVOb3RpZmllcik7XHJcbiAgICAgICAgICAgIHJldHVybiBuZWdhdGl2ZSA/ICFnZXR0ZXIobW9kZWwpIDogZ2V0dGVyKG1vZGVsKTtcclxuICAgICAgICB9O1xyXG4gICAgICAgIHJldHVybiBrby5jb21wdXRlZChzZXR0ZXIgPyB7XHJcbiAgICAgICAgICAgIHJlYWQ6IHJlYWQsXHJcbiAgICAgICAgICAgIHdyaXRlOiAodmFsdWUpID0+IHtcclxuICAgICAgICAgICAgICAgIHNldHRlcihtb2RlbCwgbmVnYXRpdmUgPyAhdmFsdWUgOiB2YWx1ZSk7XHJcbiAgICAgICAgICAgICAgICB3cml0ZU5vdGlmaWVyLnZhbHVlSGFzTXV0YXRlZCgpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSA6IHsgcmVhZDogcmVhZCB9KTtcclxuICAgIH1cclxuXHJcbiAgICBleHBvcnQgaW50ZXJmYWNlIElQcm9wZXJ0eVZpc2l0b3JWYWx1ZUNhbGxiYWNrIHtcclxuICAgICAgICAoY29udGV4dDogSVByb3BlcnR5VmlzaXRvckNvbnRleHQsIHBhdGg/OiBzdHJpbmcpOiBhbnk7XHJcbiAgICB9XHJcbiAgICBleHBvcnQgaW50ZXJmYWNlIElQcm9wZXJ0eVZpc2l0b3JDb250ZXh0IHtcclxuICAgICAgICBwYXRoPzogc3RyaW5nO1xyXG4gICAgICAgIG5hbWU/OiBzdHJpbmc7XHJcbiAgICAgICAgdmFsdWU/OiBhbnk7XHJcbiAgICAgICAgaXNBcnJheT86IGJvb2xlYW47XHJcbiAgICAgICAgb3duZXI/OiB7fTtcclxuICAgICAgICBnZXRWYWx1ZUNhbGxiYWNrOiAodmFsdWU6IGFueSwgY29udGV4dDogSVByb3BlcnR5VmlzaXRvckNvbnRleHQpID0+IGFueTtcclxuICAgIH07XHJcblxyXG4gICAgZXhwb3J0IGZ1bmN0aW9uIHByb3BlcnR5VmlzaXRvcjxUPih0YXJnZXQ6IFQsIHZhbHVlQ2FsbGJhY2s6IElQcm9wZXJ0eVZpc2l0b3JWYWx1ZUNhbGxiYWNrLCBpbml0aWFsQ29udGV4dD86IElQcm9wZXJ0eVZpc2l0b3JDb250ZXh0KTogVCB7XHJcbiAgICAgICAgaWYodHlwZW9mIHRhcmdldCA9PT0gXCJzdHJpbmdcIikge1xyXG4gICAgICAgICAgICByZXR1cm4gdGFyZ2V0O1xyXG4gICAgICAgIH1cclxuICAgICAgICB2YXIgY29udGV4dDogSVByb3BlcnR5VmlzaXRvckNvbnRleHQgPSBpbml0aWFsQ29udGV4dCB8fCB7IGdldFZhbHVlQ2FsbGJhY2s6ICh2YWx1ZSwgY29udGV4dCkgPT4geyByZXR1cm4gcHJvcGVydHlWaXNpdG9yKHZhbHVlLCB2YWx1ZUNhbGxiYWNrLCBjb250ZXh0KTsgfSB9LFxyXG4gICAgICAgICAgICBpc0FycmF5ID0gQXJyYXkuaXNBcnJheSh0YXJnZXQpLFxyXG4gICAgICAgICAgICByZXN1bHQ6IGFueSA9IGlzQXJyYXkgPyBbXSA6IHt9O1xyXG4gICAgICAgIGNvbnRleHQucGF0aCA9IGNvbnRleHQucGF0aCB8fCBcIlwiO1xyXG4gICAgICAgICQuZWFjaCh0YXJnZXQsIChuYW1lLCB2YWx1ZSkgPT4ge1xyXG4gICAgICAgICAgICBjb250ZXh0Lm5hbWUgPSBuYW1lO1xyXG4gICAgICAgICAgICBjb250ZXh0LnZhbHVlID0gdmFsdWU7XHJcbiAgICAgICAgICAgIGNvbnRleHQuaXNBcnJheSA9IGlzQXJyYXk7XHJcbiAgICAgICAgICAgIGNvbnRleHQub3duZXIgPSByZXN1bHQ7XHJcbiAgICAgICAgICAgIGlmKEFycmF5LmlzQXJyYXkodmFsdWUpIHx8ICQuaXNQbGFpbk9iamVjdCh2YWx1ZSkpIHtcclxuICAgICAgICAgICAgICAgIHZhciBvbGRQYXRoID0gY29udGV4dC5wYXRoO1xyXG4gICAgICAgICAgICAgICAgY29udGV4dC5wYXRoID0gY29udGV4dC5wYXRoID8gY29udGV4dC5wYXRoICsgKGNvbnRleHQuaXNBcnJheSA/IFwiW1wiICsgY29udGV4dC5uYW1lICsgXCJdXCIgOiBcIi5cIiArIGNvbnRleHQubmFtZSkgOiBjb250ZXh0Lm5hbWU7XHJcbiAgICAgICAgICAgICAgICByZXN1bHRbbmFtZV0gPSBjb250ZXh0LmdldFZhbHVlQ2FsbGJhY2sodmFsdWUsIGNvbnRleHQpO1xyXG4gICAgICAgICAgICAgICAgY29udGV4dC5wYXRoID0gb2xkUGF0aDtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHZhciBuZXdWYWwgPSB2YWx1ZUNhbGxiYWNrKGNvbnRleHQpO1xyXG4gICAgICAgICAgICAgICAgaWYobmV3VmFsICE9PSB1bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXN1bHRbbmFtZV0gPSBuZXdWYWw7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuICAgICAgICByZXR1cm4gcmVzdWx0O1xyXG4gICAgfVxyXG5cclxuICAgIGV4cG9ydCBjbGFzcyBCaW5kaW5nU3RyaW5nTWFrZXIge1xyXG4gICAgICAgIHN0YXRpYyB2YWx1ZUNhbGxiYWNrKHJlc3VsdCwgY29udGV4dCkge1xyXG4gICAgICAgICAgICB2YXIgdmFsdWUgPSBjb250ZXh0LnZhbHVlO1xyXG4gICAgICAgICAgICByZXR1cm4gY29udGV4dC5uYW1lICsgXCI6IFwiICsgdmFsdWUgKyBcIixcIjtcclxuICAgICAgICB9XHJcbiAgICAgICAgc3RhdGljIGFycmF5VmFsdWVDYWxsYmFjayhyZXN1bHQsIGNvbnRleHQpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGNvbnRleHQudmFsdWUgKyBcIixcIjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHN0YXRpYyBtYWtlU3RyaW5nKG1vZGVsOiBhbnksIGlzQXJyYXkgPSBmYWxzZSk6IHN0cmluZyB7XHJcbiAgICAgICAgICAgIHZhciByZXN1bHQgPSBcIlwiLFxyXG4gICAgICAgICAgICAgICAgY29udGV4dDogSVByb3BlcnR5VmlzaXRvckNvbnRleHQgPSB7XHJcbiAgICAgICAgICAgICAgICAgICAgZ2V0VmFsdWVDYWxsYmFjazogKHZhbHVlLCBjb250ZXh0KSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmKCQuaXNBcnJheSh2YWx1ZSkpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmKGlzQXJyYXkpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXN1bHQgKz0gXCJbXCIgKyBCaW5kaW5nU3RyaW5nTWFrZXIubWFrZVN0cmluZyh2YWx1ZSwgdHJ1ZSkgKyBcIl0sXCI7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc3VsdCArPSBjb250ZXh0Lm5hbWUgKyBcIjogXCIgKyBcIltcIiArIEJpbmRpbmdTdHJpbmdNYWtlci5tYWtlU3RyaW5nKHZhbHVlLCB0cnVlKSArIFwiXSxcIjtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmKGlzQXJyYXkpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXN1bHQgKz0gXCJ7XCIgKyBCaW5kaW5nU3RyaW5nTWFrZXIubWFrZVN0cmluZyh2YWx1ZSwgZmFsc2UpICsgXCJ9LFwiO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXN1bHQgKz0gY29udGV4dC5uYW1lICsgXCI6IFwiICsgXCJ7XCIgKyBCaW5kaW5nU3RyaW5nTWFrZXIubWFrZVN0cmluZyh2YWx1ZSwgZmFsc2UpICsgXCJ9LFwiO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgaWYoaXNBcnJheSkge1xyXG4gICAgICAgICAgICAgICAgcHJvcGVydHlWaXNpdG9yKG1vZGVsLCAoY29udGV4dCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdCArPSBCaW5kaW5nU3RyaW5nTWFrZXIuYXJyYXlWYWx1ZUNhbGxiYWNrKHJlc3VsdCwgY29udGV4dCk7XHJcbiAgICAgICAgICAgICAgICB9LCBjb250ZXh0KTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHByb3BlcnR5VmlzaXRvcihtb2RlbCwgKGNvbnRleHQpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICByZXN1bHQgKz0gQmluZGluZ1N0cmluZ01ha2VyLnZhbHVlQ2FsbGJhY2socmVzdWx0LCBjb250ZXh0KTtcclxuICAgICAgICAgICAgICAgIH0sIGNvbnRleHQpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJldHVybiByZXN1bHQuc2xpY2UoMCwgLTEpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBleHBvcnQgZnVuY3Rpb24gcmVwbGFjZUFsbChzdHI6IHN0cmluZywgdG9rZW46IHN0cmluZywgbmV3VG9rZW46IHN0cmluZykge1xyXG4gICAgICAgIHJldHVybiBzdHIuc3BsaXQodG9rZW4pLmpvaW4obmV3VG9rZW4pO1xyXG4gICAgfVxyXG5cclxuICAgIGV4cG9ydCBmdW5jdGlvbiBzdGFydHNXaXRoKHN0cjogc3RyaW5nLCB0b2tlbjogc3RyaW5nKTogYm9vbGVhbiB7XHJcbiAgICAgICAgaWYodG9rZW4ubGVuZ3RoID4gc3RyLmxlbmd0aCkge1xyXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgfSBlbHNlIGlmKHRva2VuLmxlbmd0aCA9PT0gc3RyLmxlbmd0aCkge1xyXG4gICAgICAgICAgICByZXR1cm4gdG9rZW4gPT09IHN0cjtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICByZXR1cm4gc3RyLnN1YnN0cigwLCB0b2tlbi5sZW5ndGgpID09PSB0b2tlbjtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgZXhwb3J0IGZ1bmN0aW9uIGVuZHNXaXRoKHN0cjogc3RyaW5nLCB0b2tlbjogc3RyaW5nKTogYm9vbGVhbiB7XHJcbiAgICAgICAgaWYodHlwZW9mIHN0ciAhPT0gXCJzdHJpbmdcIiB8fCB0eXBlb2YgdG9rZW4gIT09IFwic3RyaW5nXCIpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZih0b2tlbi5sZW5ndGggPiBzdHIubGVuZ3RoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICB9IGVsc2UgaWYodG9rZW4ubGVuZ3RoID09PSBzdHIubGVuZ3RoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0b2tlbiA9PT0gc3RyO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIGlmKHRva2VuLmxlbmd0aCA9PT0gMSkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHN0ci5jaGFyQXQoc3RyLmxlbmd0aCAtIDEpID09PSB0b2tlbjtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBzdHIuc3Vic3RyKHN0ci5sZW5ndGggLSB0b2tlbi5sZW5ndGgsIHRva2VuLmxlbmd0aCkgPT09IHRva2VuO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGV4cG9ydCBmdW5jdGlvbiBmaW5kSW5BcnJheTxUPihhcnJheTogVFtdLCBwcmVkaWNhdGU6ICh2YWw6IFQpID0+IGJvb2xlYW4pOiBUIHtcclxuICAgICAgICB2YXIgaW5kZXggPSBpbmRleEluQXJyYXkoYXJyYXksIHByZWRpY2F0ZSk7XHJcbiAgICAgICAgcmV0dXJuIGluZGV4ID49IDAgPyBhcnJheVtpbmRleF0gOiBudWxsO1xyXG4gICAgfVxyXG5cclxuICAgIGV4cG9ydCBmdW5jdGlvbiBpbmRleEluQXJyYXk8VD4oYXJyYXk6IFRbXSwgcHJlZGljYXRlOiAodmFsOiBUKSA9PiBib29sZWFuKTogbnVtYmVyIHtcclxuICAgICAgICBpZihhcnJheSkge1xyXG4gICAgICAgICAgICBmb3IodmFyIGkgPSAwOyBpIDwgYXJyYXkubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgICAgICAgIGlmKHByZWRpY2F0ZShhcnJheVtpXSkpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gaTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gLTE7XHJcbiAgICB9XHJcblxyXG4gICAgZXhwb3J0IGZ1bmN0aW9uIGFkZEhlYWRlcnMoaGVhZGVyczogSVJlcXVlc3RFbnRyeVtdKTogKHJlcXVlc3QpID0+IHZvaWQge1xyXG4gICAgICAgIHZhciByZXN1bHQgPSAocmVxdWVzdCkgPT4geyB9O1xyXG4gICAgICAgIGlmKGhlYWRlcnMgJiYgaGVhZGVycy5sZW5ndGgpIHtcclxuICAgICAgICAgICAgcmVzdWx0ID0gKHJlcXVlc3QpID0+IHtcclxuICAgICAgICAgICAgICAgIGhlYWRlcnMuZm9yRWFjaChoZWFkZXIgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIHJlcXVlc3QuaGVhZGVycyA9IHJlcXVlc3QuaGVhZGVycyB8fCB7fTtcclxuICAgICAgICAgICAgICAgICAgICByZXF1ZXN0LmhlYWRlcnNbaGVhZGVyLm5hbWVdID0gaGVhZGVyLnZhbHVlO1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiByZXN1bHQ7XHJcbiAgICB9XHJcblxyXG4gICAgZXhwb3J0IGZ1bmN0aW9uIGNsb25lPFQ+KHZhbHVlOiBUKTogVCB7XHJcbiAgICAgICAgdmFyIGtleSwgcmVzdWx0OiBhbnk7XHJcbiAgICAgICAgaWYodmFsdWUgaW5zdGFuY2VvZiBEYXRlKSB7XHJcbiAgICAgICAgICAgIHJldHVybiA8YW55Pm5ldyBEYXRlKCg8YW55PnZhbHVlKS5nZXRUaW1lKCkpO1xyXG4gICAgICAgIH0gZWxzZSBpZih2YWx1ZSAmJiAodmFsdWUgaW5zdGFuY2VvZiBPYmplY3QpKSB7XHJcbiAgICAgICAgICAgIHJlc3VsdCA9IEFycmF5LmlzQXJyYXkodmFsdWUpID8gW10gOiB7fTtcclxuICAgICAgICAgICAgZm9yKGtleSBpbiB2YWx1ZSkge1xyXG4gICAgICAgICAgICAgICAgaWYodmFsdWUuaGFzT3duUHJvcGVydHkoa2V5KSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdFtrZXldID0gY2xvbmUodmFsdWVba2V5XSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICByZXR1cm4gdmFsdWU7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGV4cG9ydCBmdW5jdGlvbiBleHRyYWN0KGNvbmZpZzoge30sIGZpZWxkOiBzdHJpbmcpOiB7IHRhcmdldDogYW55OyBsZWZ0b3Zlcjoge30gfSB7XHJcbiAgICAgICAgdmFyIHRhcmdldCxcclxuICAgICAgICAgICAgbGVmdG92ZXIgPSB7fTtcclxuICAgICAgICBpZihjb25maWcpIHtcclxuICAgICAgICAgICAgZm9yKHZhciBjdXJyZW50RmllbGQgaW4gY29uZmlnKSB7XHJcbiAgICAgICAgICAgICAgICBpZihjdXJyZW50RmllbGQgPT09IGZpZWxkKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGFyZ2V0ID0gY29uZmlnW2N1cnJlbnRGaWVsZF07XHJcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIGxlZnRvdmVyW2N1cnJlbnRGaWVsZF0gPSBjb25maWdbY3VycmVudEZpZWxkXTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICB0YXJnZXQ6IHRhcmdldCxcclxuICAgICAgICAgICAgbGVmdG92ZXI6IGxlZnRvdmVyXHJcbiAgICAgICAgfTtcclxuICAgIH1cclxuXHJcbiAgICBleHBvcnQgZnVuY3Rpb24gZXh0cmFjdE1hbnkoY29uZmlnOiB7fSwgZmllbGRzOiBzdHJpbmdbXSk6IHsgdGFyZ2V0OiBhbnk7IGxlZnRvdmVyOiB7fSB9IHtcclxuICAgICAgICB2YXIgdGFyZ2V0ID0ge30sXHJcbiAgICAgICAgICAgIGxlZnRvdmVyID0ge307XHJcbiAgICAgICAgaWYoY29uZmlnKSB7XHJcbiAgICAgICAgICAgIGZvcih2YXIgY3VycmVudEZpZWxkIGluIGNvbmZpZykge1xyXG4gICAgICAgICAgICAgICAgaWYoJC5pbkFycmF5KGN1cnJlbnRGaWVsZCwgZmllbGRzKSAhPT0gLTEpIHtcclxuICAgICAgICAgICAgICAgICAgICB0YXJnZXRbY3VycmVudEZpZWxkXSA9IGNvbmZpZ1tjdXJyZW50RmllbGRdO1xyXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICBsZWZ0b3ZlcltjdXJyZW50RmllbGRdID0gY29uZmlnW2N1cnJlbnRGaWVsZF07XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgdGFyZ2V0OiB0YXJnZXQsXHJcbiAgICAgICAgICAgIGxlZnRvdmVyOiBsZWZ0b3ZlclxyXG4gICAgICAgIH07XHJcbiAgICB9XHJcblxyXG4gICAgZXhwb3J0IGZ1bmN0aW9uIHJlbWFwKGNvbmZpZzoge30sIG1hcDogeyBbZnJvbTogc3RyaW5nXTogc3RyaW5nIH0sIHBhc3N0aHJvdWdoPzogYm9vbGVhbik6IHt9IHtcclxuICAgICAgICB2YXIgcmVzdWx0ID0ge307XHJcbiAgICAgICAgaWYoY29uZmlnKSB7XHJcbiAgICAgICAgICAgIGZvcih2YXIgY3VycmVudEZpZWxkIGluIGNvbmZpZykge1xyXG4gICAgICAgICAgICAgICAgaWYobWFwW2N1cnJlbnRGaWVsZF0pIHtcclxuICAgICAgICAgICAgICAgICAgICByZXN1bHRbbWFwW2N1cnJlbnRGaWVsZF1dID0gY29uZmlnW2N1cnJlbnRGaWVsZF07XHJcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYocGFzc3Rocm91Z2gpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXN1bHRbY3VycmVudEZpZWxkXSA9IGNvbmZpZ1tjdXJyZW50RmllbGRdO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiByZXN1bHQ7XHJcbiAgICB9XHJcblxyXG4gICAgdmFyIElTTzg2MDFfREFURV9SRUdFWCA9IC9eXFxkezR9LVxcZHsyfS1cXGR7Mn1UXFxkezJ9OlxcZHsyfTpcXGR7Mn0oXFwuXFxkKyk/Wj8kLztcclxuXHJcbiAgICBleHBvcnQgZnVuY3Rpb24gcGFyc2VJU084NjAxKGlzb1N0cmluZzogc3RyaW5nKSB7XHJcbiAgICAgICAgdmFyIGNodW5rcyA9IGlzb1N0cmluZy5yZXBsYWNlKFwiWlwiLCBcIlwiKS5zcGxpdChcIlRcIiksXHJcbiAgICAgICAgICAgIGRhdGUgPSBTdHJpbmcoY2h1bmtzWzBdKS5zcGxpdChcIi1cIiksXHJcbiAgICAgICAgICAgIHRpbWUgPSBTdHJpbmcoY2h1bmtzWzFdKS5zcGxpdChcIjpcIik7XHJcblxyXG4gICAgICAgIHZhciB5ZWFyLCBtb250aCwgZGF5LFxyXG4gICAgICAgICAgICBob3VycyA9IDAsIG1pbnV0ZXMgPSAwLCBzZWNvbmRzID0gMCwgbWlsbGlzZWNvbmRzID0gMDtcclxuXHJcbiAgICAgICAgeWVhciA9IE51bWJlcihkYXRlWzBdKTtcclxuICAgICAgICBtb250aCA9IE51bWJlcihkYXRlWzFdKSAtIDE7XHJcbiAgICAgICAgZGF5ID0gTnVtYmVyKGRhdGVbMl0pO1xyXG5cclxuICAgICAgICBpZih0aW1lLmxlbmd0aCkge1xyXG4gICAgICAgICAgICBob3VycyA9IE51bWJlcih0aW1lWzBdKTtcclxuICAgICAgICAgICAgbWludXRlcyA9IE51bWJlcih0aW1lWzFdKTtcclxuICAgICAgICAgICAgc2Vjb25kcyA9IE51bWJlcihTdHJpbmcodGltZVsyXSkuc3BsaXQoXCIuXCIpWzBdKTtcclxuICAgICAgICAgICAgbWlsbGlzZWNvbmRzID0gTnVtYmVyKFN0cmluZyh0aW1lWzJdKS5zcGxpdChcIi5cIilbMV0pIHx8IDA7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZihlbmRzV2l0aChpc29TdHJpbmcsIFwiWlwiKSkge1xyXG4gICAgICAgICAgICByZXR1cm4gbmV3IERhdGUoRGF0ZS5VVEMoeWVhciwgbW9udGgsIGRheSwgaG91cnMsIG1pbnV0ZXMsIHNlY29uZHMsIG1pbGxpc2Vjb25kcykpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHJldHVybiBuZXcgRGF0ZSh5ZWFyLCBtb250aCwgZGF5LCBob3VycywgbWludXRlcywgc2Vjb25kcywgbWlsbGlzZWNvbmRzKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgZXhwb3J0IGZ1bmN0aW9uIHRyYW5zZm9ybUlTT0RhdGVzKG9iaikge1xyXG4gICAgICAgIGlmKCFvYmopIHtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgJC5lYWNoKG9iaiwgKGtleSwgdmFsdWUpID0+IHtcclxuICAgICAgICAgICAgaWYodmFsdWUgIT09IG51bGwgJiYgdHlwZW9mIHZhbHVlID09PSBcIm9iamVjdFwiKSB7XHJcbiAgICAgICAgICAgICAgICB0cmFuc2Zvcm1JU09EYXRlcyh2YWx1ZSk7XHJcbiAgICAgICAgICAgIH0gZWxzZSBpZih0eXBlb2YgdmFsdWUgPT09IFwic3RyaW5nXCIpIHtcclxuICAgICAgICAgICAgICAgIGlmKElTTzg2MDFfREFURV9SRUdFWC50ZXN0KHZhbHVlKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIG9ialtrZXldID0gbmV3IERhdGUocGFyc2VJU084NjAxKG9ialtrZXldKS52YWx1ZU9mKCkpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcbiAgICB9O1xyXG5cclxuICAgIGV4cG9ydCBmdW5jdGlvbiBwYXJzZURhdGVzKGRhdGE6IGFueSwgZmllbGRzOiBzdHJpbmdbXSA9IFtdKSB7XHJcbiAgICAgICAgdmFyIGlzQXJyYXkgPSBBcnJheS5pc0FycmF5KGRhdGEpLFxyXG4gICAgICAgICAgICBhcnJheSA9IGlzQXJyYXkgPyA8YW55W10+ZGF0YSA6IFtkYXRhXTtcclxuICAgICAgICB2YXIgcGFyc2VkID0gYXJyYXkubWFwKGl0ZW0gPT4ge1xyXG4gICAgICAgICAgICByZXR1cm4gdHlwZW9mIGl0ZW0gPT09IFwic3RyaW5nXCIgJiYgJC5pc0VtcHR5T2JqZWN0KGZpZWxkcylcclxuICAgICAgICAgICAgICAgID8gbmV3IERhdGUocGFyc2VJU084NjAxKGl0ZW0pLnZhbHVlT2YoKSlcclxuICAgICAgICAgICAgICAgIDogcHJvcGVydHlWaXNpdG9yKGl0ZW0sIGNvbnRleHQgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciBmdWxsUGF0aCA9IGNvbnRleHQucGF0aCAmJiBjb250ZXh0Lm5hbWUgJiYgY29udGV4dC5wYXRoICsgXCIuXCIgKyBjb250ZXh0Lm5hbWUgfHwgY29udGV4dC5wYXRoIHx8IGNvbnRleHQubmFtZTtcclxuICAgICAgICAgICAgICAgICAgICBpZihmaWVsZHMuaW5kZXhPZihmdWxsUGF0aCkgIT09IC0xIHx8ICQuaXNFbXB0eU9iamVjdChmaWVsZHMpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBJU084NjAxX0RBVEVfUkVHRVgudGVzdChjb250ZXh0LnZhbHVlKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPyBuZXcgRGF0ZShwYXJzZUlTTzg2MDEoY29udGV4dC52YWx1ZSkudmFsdWVPZigpKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgOiBjb250ZXh0LnZhbHVlO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gY29udGV4dC52YWx1ZTtcclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIHJldHVybiBpc0FycmF5ID8gcGFyc2VkIDogcGFyc2VkWzBdO1xyXG4gICAgfVxyXG5cclxuICAgIGV4cG9ydCBjbGFzcyBMb2NhbFN0b3JhZ2VXcmFwcGVyIHtcclxuICAgICAgICBwcml2YXRlIGFwcDogSUFwcGxpY2F0aW9uO1xyXG5cclxuICAgICAgICBjb25zdHJ1Y3RvcihhcHA6IElBcHBsaWNhdGlvbikge1xyXG4gICAgICAgICAgICB0aGlzLmFwcCA9IGFwcDtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHB1dChtb2RlbElkOiBzdHJpbmcsIGlkOiBzdHJpbmcsIHZhbDogYW55KSB7XHJcbiAgICAgICAgICAgIHZhciBrZXkgPSB0aGlzLmdldEtleShtb2RlbElkLCBpZCk7XHJcbiAgICAgICAgICAgIGlmKHZhbCA9PT0gdW5kZWZpbmVkIHx8IHZhbCA9PT0gbnVsbCkge1xyXG4gICAgICAgICAgICAgICAgbG9jYWxTdG9yYWdlLnJlbW92ZUl0ZW0oa2V5KTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKGtleSwgSlNPTi5zdHJpbmdpZnkodmFsKSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGdldChtb2RlbElkOiBzdHJpbmcsIGlkOiBzdHJpbmcpIHtcclxuICAgICAgICAgICAgdmFyIGtleSA9IHRoaXMuZ2V0S2V5KG1vZGVsSWQsIGlkKTtcclxuICAgICAgICAgICAgdmFyIHZhbCA9IGxvY2FsU3RvcmFnZS5nZXRJdGVtKGtleSk7XHJcbiAgICAgICAgICAgIHJldHVybiB2YWwgPyBKU09OLnBhcnNlKHZhbCkgOiB1bmRlZmluZWQ7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBnZXRLZXkobW9kZWxJZDogc3RyaW5nLCBpZDogc3RyaW5nKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmdldEFwcFVzZXJLZXkoKSArIChtb2RlbElkIHx8IFwiZ2xvYmFsXCIpICsgXCItXCIgKyBpZDtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHByaXZhdGUgZ2V0QXBwVXNlcktleSgpIHtcclxuICAgICAgICAgICAgdmFyIGFwcElkID0gdGhpcy5hcHAuaWQgPyB0aGlzLmFwcC5pZCA6IFwiYWxsYXBwc1wiO1xyXG4gICAgICAgICAgICByZXR1cm4gXCJ4ZXQtbHMtXCIgKyBhcHBJZCArIFwiLVwiO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICB9XHJcblxyXG4gICAgZXhwb3J0IGZ1bmN0aW9uIGhhbmRsZU9wZW5VUkwodXJsOiBzdHJpbmcpIHtcclxuICAgICAgICB2YXIgdXJpSW5kZXggPSB1cmwuaW5kZXhPZihcIjovL1wiKSwgcGFyYW1zSW5kZXggPSB1cmwuaW5kZXhPZihcIj9cIiwgdXJpSW5kZXgpO1xyXG4gICAgICAgIHZhciB1cmksIHBhcmFtcyA9IHt9O1xyXG4gICAgICAgIGlmKHBhcmFtc0luZGV4ID49IDApIHtcclxuICAgICAgICAgICAgdXJpID0gdXJsLnN1YnN0cmluZyh1cmlJbmRleCArIDMsIHBhcmFtc0luZGV4KTtcclxuICAgICAgICAgICAgdmFyIHBhcmFtUGFydHMgPSB1cmwuc3Vic3RyaW5nKHBhcmFtc0luZGV4ICsgMSkuc3BsaXQoXCImXCIpO1xyXG4gICAgICAgICAgICBwYXJhbVBhcnRzLmZvckVhY2goKHBhcnQpID0+IHtcclxuICAgICAgICAgICAgICAgIHZhciBlcXVhbEluZGV4ID0gcGFydC5pbmRleE9mKFwiPVwiKSwgbmFtZSwgdmFsdWU7XHJcbiAgICAgICAgICAgICAgICBpZihlcXVhbEluZGV4IDwgMCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHBhcmFtc1twYXJ0XSA9IHRydWU7XHJcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIG5hbWUgPSBwYXJ0LnN1YnN0cmluZygwLCBlcXVhbEluZGV4KTtcclxuICAgICAgICAgICAgICAgICAgICB2YWx1ZSA9IHBhcnQuc3Vic3RyKGVxdWFsSW5kZXggKyAxKTtcclxuICAgICAgICAgICAgICAgICAgICBwYXJhbXNbbmFtZV0gPSB2YWx1ZTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgdXJpID0gdXJsLnN1YnN0cih1cmlJbmRleCArIDMpO1xyXG4gICAgICAgIH1cclxuICAgICAgICAvLyBpZiBhcHAgaXMgb3BlbiwgcmVkaXJlY3QgdG8gdGhlIHZpZXcgcHJvdmlkZWRcclxuICAgICAgICAvLyBvdGhlcndpc2UsIHNhdmUgdG8gYSB0ZW1wb3JhcnkgdmFyaWFibGVcclxuICAgICAgICBpZih3aW5kb3dbXCJhcHBcIl0gJiYgd2luZG93W1wiYXBwXCJdLmluc3RhbmNlICYmIHdpbmRvd1tcImFwcFwiXS5pbnN0YW5jZS5keGFwcCkge1xyXG4gICAgICAgICAgICB2YXIgYXBwID0gd2luZG93W1wiYXBwXCJdLmluc3RhbmNlO1xyXG4gICAgICAgICAgICBhcHAuZnVuY3Rpb25zLm5hdmlnYXRlVG9WaWV3KHVyaSwgcGFyYW1zLCBcIm1hc3RlclwiKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICB3aW5kb3dbXCJ4ZXRIYW5kbGVPcGVuVVJMXCJdID0ge1xyXG4gICAgICAgICAgICAgICAgdXJpOiB1cmksXHJcbiAgICAgICAgICAgICAgICBwYXJhbXM6IHBhcmFtc1xyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBleHBvcnQgZnVuY3Rpb24gY29udGludWVGdW5jPFQgZXh0ZW5kcyAoYXJnKSA9PiBhbnk+KGZ1bmM6IFQsIGNvbnRpbnVsYXRpb246IFQpIHtcclxuICAgICAgICBpZihmdW5jKSB7XHJcbiAgICAgICAgICAgIHJldHVybiAoYXJnKSA9PiB7XHJcbiAgICAgICAgICAgICAgICB2YXIgcmVzdWx0ID0gZnVuYyhhcmcpO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGNvbnRpbnVsYXRpb24ocmVzdWx0KTtcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICByZXR1cm4gY29udGludWxhdGlvbjtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgZXhwb3J0IGZ1bmN0aW9uIHNob3dBY3Rpb25Qb3BvdmVyKHRhcmdldDogYW55LCBpdGVtczogYW55W10sIHNob3dDYW5jZWxCdXR0b246IGJvb2xlYW4sIHRpdGxlOiBzdHJpbmcpIHtcclxuICAgICAgICB2YXIgJGRpdiA9ICQoXCI8ZGl2Lz5cIik7XHJcbiAgICAgICAgJGRpdi5hcHBlbmRUbygkKGRvY3VtZW50LmJvZHkpKTtcclxuICAgICAgICAkZGl2LmR4QWN0aW9uU2hlZXQoe1xyXG4gICAgICAgICAgICBkYXRhU291cmNlOiBpdGVtcyxcclxuICAgICAgICAgICAgdmlzaWJsZTogdHJ1ZSxcclxuICAgICAgICAgICAgdGl0bGU6IHRpdGxlIHx8IFwiXCIsXHJcbiAgICAgICAgICAgIHNob3dUaXRsZTogISF0aXRsZSxcclxuICAgICAgICAgICAgc2hvd0NhbmNlbEJ1dHRvbjogc2hvd0NhbmNlbEJ1dHRvbixcclxuICAgICAgICAgICAgdXNlUG9wb3ZlcjogdHJ1ZSxcclxuICAgICAgICAgICAgdGFyZ2V0OiB0YXJnZXRcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICBleHBvcnQgZnVuY3Rpb24gaXNQcm9taXNlKHZhbHVlKSB7XHJcbiAgICAgICAgaWYodmFsdWUgPT0gbnVsbCB8fCB0eXBlb2YgdmFsdWUudGhlbiAhPT0gXCJmdW5jdGlvblwiKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgdmFyIHByb21pc2VUaGVuU3JjID0gU3RyaW5nKCQuRGVmZXJyZWQoKS50aGVuKTtcclxuICAgICAgICB2YXIgdmFsdWVUaGVuU3JjID0gU3RyaW5nKHZhbHVlLnRoZW4pO1xyXG4gICAgICAgIHJldHVybiBwcm9taXNlVGhlblNyYyA9PT0gdmFsdWVUaGVuU3JjO1xyXG4gICAgfVxyXG5cclxuICAgIGV4cG9ydCBmdW5jdGlvbiBzaG93RXJyb3JEaWFsb2coZXJyb3IsIGRhdGFTb3VyY2VJZD8pIHtcclxuICAgICAgICBpZihlcnJvciA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgIHJldHVybjsgICAgIC8vIElmIGJ5S2V5IHJldHVybnMgbm90aGluZywgbG9hZEVycm9yIGhhbmRsZXIgaXMgY2FsbGVkLiBTdXBwcmVzcyB0aGUgd2FybmluZy5cclxuICAgICAgICB9XHJcbiAgICAgICAgdmFyIG1lc3NhZ2U6IHN0cmluZyA9ICh0eXBlb2YgZXJyb3IgPT09IFwic3RyaW5nXCIgfHwgZXJyb3IgaW5zdGFuY2VvZiBTdHJpbmcpID8gZXJyb3IgOiAoZXJyb3IgJiYgZXJyb3IubWVzc2FnZSkgfHwgXCJVbmtub3duIGVycm9yXCI7XHJcbiAgICAgICAgRGV2RXhwcmVzcy51aS5ub3RpZnkoe1xyXG4gICAgICAgICAgICBtZXNzYWdlOiBcIlwiLFxyXG4gICAgICAgICAgICBoaWRlT25Td2lwZTogZmFsc2UsXHJcbiAgICAgICAgICAgIGNvbnRlbnRUZW1wbGF0ZTogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgJHJlcyA9ICQoXCI8ZGl2IGNsYXNzPVxcXCJkeC10b2FzdC1tZXNzYWdlXFxcIiByb2xlPVxcXCJhbGVydFxcXCI+PC9kaXY+XCIpLFxyXG4gICAgICAgICAgICAgICAgICAgIGhpZGVUb2FzdCA9ICgpID0+IHsgJHJlcy5wYXJlbnRzKFwiLmR4LXRvYXN0XCIpLmR4VG9hc3QoXCJpbnN0YW5jZVwiKS5oaWRlKCk7IH0sXHJcbiAgICAgICAgICAgICAgICAgICAgZnVsbE1lc3NhZ2UgPSBkYXRhU291cmNlSWQgPyBcIidcIiArIGRhdGFTb3VyY2VJZCArIFwiJyBkYXRhIHNvdXJjZSBlcnJvcjogXCIgKyBtZXNzYWdlIDogbWVzc2FnZTtcclxuXHJcbiAgICAgICAgICAgICAgICAkKFwiPGRpdi8+XCIpLmh0bWwoZnVsbE1lc3NhZ2UpLmFwcGVuZFRvKCRyZXMpO1xyXG5cclxuICAgICAgICAgICAgICAgIGlmKG1lc3NhZ2UuaW5kZXhPZihcIkNPUlNcIikgPj0gMCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciBjb3JzRG9jID0gXCJodHRwczovL3hlbmFyaXVzLm5ldC9kb2NzL2NvcnMuaHRtbFwiO1xyXG4gICAgICAgICAgICAgICAgICAgICQoXCI8ZGl2Lz5cIikuZHhCdXR0b24oe1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0ZXh0OiBcIkVuYWJsZSBDT1JTXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6IFwic3VjY2Vzc1wiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBvbkNsaWNrOiBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGhpZGVUb2FzdCgpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgd2luZG93Lm9wZW4oY29yc0RvYyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICB9KS5hcHBlbmRUbygkcmVzKTtcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICAkKFwiPGRpdi8+XCIpLmR4QnV0dG9uKHsgdGV4dDogXCJEaXNtaXNzXCIsIHR5cGU6IFwiZGFuZ2VyXCIsIG9uQ2xpY2s6IGhpZGVUb2FzdCB9KS5hcHBlbmRUbygkcmVzKTtcclxuICAgICAgICAgICAgICAgIHJldHVybiAkcmVzO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSwgXCJlcnJvclwiLCA2MDAwMDApO1xyXG4gICAgfVxyXG5cclxuICAgIGV4cG9ydCBmdW5jdGlvbiB4bWxUb0pzKG5vZGUpIHtcclxuICAgICAgICB2YXIgZGF0YSA9IHt9O1xyXG5cclxuICAgICAgICAvLyBhcHBlbmQgYSB2YWx1ZVxyXG4gICAgICAgIGZ1bmN0aW9uIGFkZChuYW1lLCB2YWx1ZSkge1xyXG4gICAgICAgICAgICBpZihkYXRhW25hbWVdKSB7XHJcbiAgICAgICAgICAgICAgICBpZihkYXRhW25hbWVdLmNvbnN0cnVjdG9yICE9PSBBcnJheSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGRhdGFbbmFtZV0gPSBbZGF0YVtuYW1lXV07XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBkYXRhW25hbWVdW2RhdGFbbmFtZV0ubGVuZ3RoXSA9IHZhbHVlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgZGF0YVtuYW1lXSA9IHZhbHVlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgLy8gZWxlbWVudCBhdHRyaWJ1dGVzXHJcbiAgICAgICAgdmFyIGMsIGNuO1xyXG4gICAgICAgIGZvcihjID0gMDsgY24gPSBub2RlLmF0dHJpYnV0ZXNbY107IGMrKykge1xyXG4gICAgICAgICAgICBhZGQoY24ubmFtZSwgY24udmFsdWUpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gY2hpbGQgZWxlbWVudHNcclxuICAgICAgICBmb3IoYyA9IDA7IGNuID0gbm9kZS5jaGlsZE5vZGVzW2NdOyBjKyspIHtcclxuICAgICAgICAgICAgaWYoY24ubm9kZVR5cGUgPT09IDEpIHtcclxuICAgICAgICAgICAgICAgIGlmKGNuLmNoaWxkTm9kZXMubGVuZ3RoID09PSAxICYmIGNuLmZpcnN0Q2hpbGQubm9kZVR5cGUgPT09IDMpIHtcclxuICAgICAgICAgICAgICAgICAgICAvLyB0ZXh0IHZhbHVlXHJcbiAgICAgICAgICAgICAgICAgICAgYWRkKGNuLm5vZGVOYW1lLCBjbi5maXJzdENoaWxkLm5vZGVWYWx1ZSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAvLyBzdWItb2JqZWN0XHJcbiAgICAgICAgICAgICAgICAgICAgYWRkKGNuLm5vZGVOYW1lLCB4bWxUb0pzKGNuKSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIGRhdGE7XHJcbiAgICB9XHJcbn0iLCIvLy8gPHRlbXBsYXRlIHBhdGg9XCIuLi8uLi9BcHBQbGF5ZXIvVGVtcGxhdGVzL1ZpZXdDb21wb25lbnRzLmh0bWxcIi8+XHJcblxyXG5tb2R1bGUgQXBwUGxheWVyLlZpZXdzIHtcclxuICAgIFwidXNlIHN0cmljdFwiO1xyXG5cclxuICAgIHZhciBldmVudENvdW50ZXIgPSAxO1xyXG5cclxuICAgIGV4cG9ydCBpbnRlcmZhY2UgSUNvbXBvbmVudFZpZXdNb2RlbE1hcHBpbmcge1xyXG4gICAgICAgIGNvbnRyb2w/OiBzdHJpbmc7XHJcbiAgICAgICAgY3VzdG9tQ29udHJvbD86IHsgW2Zyb206IHN0cmluZ106IHN0cmluZyB9O1xyXG4gICAgICAgIHN0eWxlPzogc3RyaW5nO1xyXG4gICAgICAgIGN1c3RvbVN0eWxlPzogeyBbZnJvbTogc3RyaW5nXTogc3RyaW5nIH07XHJcbiAgICB9XHJcblxyXG4gICAgZXhwb3J0IGludGVyZmFjZSBJQ29tcG9uZW50SW5mbyB7XHJcbiAgICAgICAgcmVuZGVyZXJUeXBlOiB0eXBlb2YgQ29tcG9uZW50TWFya3VwUmVuZGVyQmFzZTtcclxuICAgICAgICBkZWZhdWx0cz86IHt9O1xyXG4gICAgICAgIGV2ZW50cz86IHN0cmluZ1tdO1xyXG4gICAgICAgIG1hcHBpbmc/OiBJQ29tcG9uZW50Vmlld01vZGVsTWFwcGluZztcclxuICAgICAgICBjb21wb25lbnRWaWV3TW9kZWw/OiAodmlld01vZGVsOiBhbnkpID0+IGFueTtcclxuICAgIH1cclxuXHJcbiAgICBleHBvcnQgaW50ZXJmYWNlIElDb21wb25lbnRNb2RlbCB7XHJcbiAgICAgICAgbW9kZWw6IGFueTtcclxuICAgICAgICBiaW5kaW5nU3RyaW5nOiBzdHJpbmc7XHJcbiAgICB9XHJcblxyXG4gICAgZXhwb3J0IGNsYXNzIERlZmF1bHRzUHJvdmlkZXIge1xyXG4gICAgICAgIHN0YXRpYyBHZXREZWZhdWx0cyhjb25maWc6IElDb21wb25lbnQpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGNvbmZpZy50eXBlICYmIGNvbXBvbmVudEluZm9zW2NvbmZpZy50eXBlXSAmJiBjb21wb25lbnRJbmZvc1tjb25maWcudHlwZV0uZGVmYXVsdHMgPyBjb21wb25lbnRJbmZvc1tjb25maWcudHlwZV0uZGVmYXVsdHMgOiB7fTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICBleHBvcnQgaW50ZXJmYWNlIElDb21wb25lbnRNYXJrdXBSZW5kZXJPcHRpb25zIHtcclxuICAgICAgICBkZXNpZ25Nb2RlPzogYm9vbGVhbjtcclxuICAgICAgICBkZWZhdWx0c0dldHRlcj86IChjb21wb25lbnRDb25maWc6IElDb21wb25lbnQpID0+IHt9O1xyXG4gICAgfVxyXG5cclxuICAgIGV4cG9ydCBjbGFzcyBDb21wb25lbnRNYXJrdXBSZW5kZXJCYXNlIHtcclxuICAgICAgICBzdGF0aWMgT25HZXRNb2RlbDogKENvbnRleHQ6IENvbXBvbmVudE1hcmt1cFJlbmRlckJhc2UsIE1vZGVsOiBJQ29tcG9uZW50TW9kZWwpID0+IGFueTtcclxuICAgICAgICBjb25maWc6IHt9O1xyXG4gICAgICAgIG9wdGlvbnM6IElDb21wb25lbnRNYXJrdXBSZW5kZXJPcHRpb25zID0ge307XHJcbiAgICAgICAgY29uc3RydWN0b3IoY29uZmlnOiB7fSwgb3B0aW9uczogSUNvbXBvbmVudE1hcmt1cFJlbmRlck9wdGlvbnMpIHtcclxuICAgICAgICAgICAgdGhpcy5vcHRpb25zID0gJC5leHRlbmQoe30sIHsgZGVzaWduTW9kZTogZmFsc2UsIGRlZmF1bHRzR2V0dGVyOiBEZWZhdWx0c1Byb3ZpZGVyLkdldERlZmF1bHRzIH0sIG9wdGlvbnMpO1xyXG4gICAgICAgICAgICB0aGlzLmNvbmZpZyA9ICQuZXh0ZW5kKHRydWUsIHt9LCB0aGlzLm9wdGlvbnMuZGVmYXVsdHNHZXR0ZXIoPGFueT5jb25maWcpLCBjb25maWcpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBfZ2V0TW9kZWxPYmplY3QobW9kZWxDb25maWc6IGFueSwgYXBwPzogSUFwcGxpY2F0aW9uKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnBhdGNoQ29uZmlnKG1vZGVsQ29uZmlnIHx8IHRoaXMuY29uZmlnLCBhcHApO1xyXG4gICAgICAgIH1cclxuICAgICAgICBfZ2V0QmluZG5pZ1N0cmluZ09iamVjdChtb2RlbE9iamVjdCkge1xyXG4gICAgICAgICAgICB2YXIgcmVzdWx0ID0gJC5leHRlbmQoe30sIG1vZGVsT2JqZWN0KTtcclxuICAgICAgICAgICAgZGVsZXRlIHJlc3VsdFtcInR5cGVcIl07XHJcbiAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGdldE1vZGVsKGFwcD86IElBcHBsaWNhdGlvbiwgbW9kZWxDb25maWc/OiBhbnkpOiBJQ29tcG9uZW50TW9kZWwge1xyXG4gICAgICAgICAgICB2YXIgbW9kZWxPYmplY3QgPSB0aGlzLl9nZXRNb2RlbE9iamVjdChtb2RlbENvbmZpZyB8fCB0aGlzLmNvbmZpZywgYXBwKSxcclxuICAgICAgICAgICAgICAgIHNlbGYgPSB0aGlzLFxyXG4gICAgICAgICAgICAgICAgbW9kZWwgPSB7XHJcbiAgICAgICAgICAgICAgICAgICAgbW9kZWw6IG1vZGVsT2JqZWN0LFxyXG4gICAgICAgICAgICAgICAgICAgIGdldCBiaW5kaW5nU3RyaW5nKCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gQmluZGluZ1N0cmluZ01ha2VyLm1ha2VTdHJpbmcoc2VsZi5fZ2V0QmluZG5pZ1N0cmluZ09iamVjdChtb2RlbE9iamVjdCkpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgIHJldHVybiBtb2RlbDtcclxuICAgICAgICB9XHJcbiAgICAgICAgX3BhdGNoRmllbGQoZmllbGRWYWx1ZTogYW55KTogYW55IHtcclxuICAgICAgICAgICAgaWYodHlwZW9mIGZpZWxkVmFsdWUgPT09IFwic3RyaW5nXCIpIHtcclxuICAgICAgICAgICAgICAgIGZpZWxkVmFsdWUgPSBcIidcIiArIGZpZWxkVmFsdWUucmVwbGFjZSgvJy9nLCBcIlxcXFwnXCIpICsgXCInXCI7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuIGZpZWxkVmFsdWU7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIF9wYXRjaENvbmZpZyhjb25maWc6IGFueSwgYXBwOiBJQXBwbGljYXRpb24pOiBhbnkge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5wYXRjaENvbmZpZyh7IGNvbmZpZzogY29uZmlnIH0sIGFwcCkuY29uZmlnO1xyXG4gICAgICAgIH1cclxuICAgICAgICBfcGF0Y2hFdmVudHMoY29tcG9uZW50Q29uZmlnOiBJQ29tcG9uZW50LCBjb21wb25lbnRJbmZvOiBJQ29tcG9uZW50SW5mbywgYXBwOiBJQXBwbGljYXRpb24pIHtcclxuICAgICAgICAgICAgaWYoY29tcG9uZW50SW5mby5ldmVudHMpIHtcclxuICAgICAgICAgICAgICAgIGNvbXBvbmVudEluZm8uZXZlbnRzLmZvckVhY2goKGV2ZW50TmFtZSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciBldmVudCA9IGNvbXBvbmVudENvbmZpZ1tldmVudE5hbWVdLCBmbiwgaWQsIGZ1bmN0aW9uQ29tcGlsZXI7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYoIWV2ZW50IHx8ICFhcHAgfHwgIWFwcC5jcmVhdGVGdW5jdGlvbkNvbXBpbGVyKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBmdW5jdGlvbkNvbXBpbGVyID0gYXBwLmNyZWF0ZUZ1bmN0aW9uQ29tcGlsZXIoZXZlbnQpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBmbiA9IChjb250ZXh0OiBJUnVuQ29udGV4dCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uQ29tcGlsZXIucnVuKCQuZXh0ZW5kKHt9LCBjb250ZXh0KSwge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxlclR5cGU6IFwiZXZlbnQgb2YgdGhlIFwiICsgY29tcG9uZW50Q29uZmlnLmlkICsgXCJjb21wb25lbnRcIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYWxsZXJJZDogZXZlbnROYW1lXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWQgPSBcImFub255bW91c0V2ZW50XCIgKyBldmVudENvdW50ZXIrKztcclxuICAgICAgICAgICAgICAgICAgICAgICAgYXBwLmZ1bmN0aW9uc1tpZF0gPSBmbjtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50Q29uZmlnW2V2ZW50TmFtZV0gPSBpZDtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBwcml2YXRlIHBhdGNoQ29uZmlnKGNvbmZpZzogYW55LCBhcHA6IElBcHBsaWNhdGlvbik6IGFueSB7XHJcbiAgICAgICAgICAgIHJldHVybiBwcm9wZXJ0eVZpc2l0b3IoY29uZmlnLFxyXG4gICAgICAgICAgICAgICAgKGNvbnRleHQpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5vcHRpb25zLmRlc2lnbk1vZGUgfHwgKGNvbnRleHQubmFtZSA9PT0gXCJ0eXBlXCIpID8gY29udGV4dC52YWx1ZSA6IHRoaXMuX3BhdGNoRmllbGQoY29udGV4dC52YWx1ZSk7XHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgIGdldFZhbHVlQ2FsbGJhY2s6ICh2YWx1ZTogSUNvbXBvbmVudCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgY29tcG9uZW50SW5mbyA9IHZhbHVlLnR5cGUgJiYgY29tcG9uZW50SW5mb3NbdmFsdWUudHlwZV07XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmKGNvbXBvbmVudEluZm8pIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX3BhdGNoRXZlbnRzKHZhbHVlLCBjb21wb25lbnRJbmZvLCBhcHApO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG5ldyBjb21wb25lbnRJbmZvLnJlbmRlcmVyVHlwZSh2YWx1ZSwgbnVsbCkuZ2V0TW9kZWwoYXBwKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnBhdGNoQ29uZmlnKHZhbHVlLCBhcHApO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIF9jb3B5TWFyZ2lucyhmcm9tOiB7fSwgdG86IHt9KSB7XHJcbiAgICAgICAgICAgIGlmKGZyb20gJiYgdG8pIHtcclxuICAgICAgICAgICAgICAgIHRvW1wibWFyZ2luVG9wXCJdID0gZnJvbVtcIm1hcmdpblRvcFwiXTtcclxuICAgICAgICAgICAgICAgIHRvW1wibWFyZ2luUmlnaHRcIl0gPSBmcm9tW1wibWFyZ2luUmlnaHRcIl07XHJcbiAgICAgICAgICAgICAgICB0b1tcIm1hcmdpbkJvdHRvbVwiXSA9IGZyb21bXCJtYXJnaW5Cb3R0b21cIl07XHJcbiAgICAgICAgICAgICAgICB0b1tcIm1hcmdpbkxlZnRcIl0gPSBmcm9tW1wibWFyZ2luTGVmdFwiXTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBleHBvcnQgY2xhc3MgVmlld01hcmt1cFJlbmRlcmVyIGV4dGVuZHMgQ29tcG9uZW50TWFya3VwUmVuZGVyQmFzZSB7XHJcbiAgICAgICAgdmlld0NvbmZpZzogSVZpZXc7XHJcbiAgICAgICAgYXBwbGljYXRpb246IElBcHBsaWNhdGlvbjtcclxuICAgICAgICBjb25zdHJ1Y3Rvcih2aWV3Q29uZmlnOiBJVmlldywgYXBwbGljYXRpb246IElBcHBsaWNhdGlvbikge1xyXG4gICAgICAgICAgICBzdXBlcih2aWV3Q29uZmlnLCB7fSk7XHJcbiAgICAgICAgICAgIHRoaXMudmlld0NvbmZpZyA9IHZpZXdDb25maWc7XHJcbiAgICAgICAgICAgIHRoaXMuYXBwbGljYXRpb24gPSBhcHBsaWNhdGlvbjtcclxuICAgICAgICB9XHJcbiAgICAgICAgZ2V0TW9kZWwoKSB7XHJcbiAgICAgICAgICAgIHZhciBtb2RlbCA9IHN1cGVyLmdldE1vZGVsKHRoaXMuYXBwbGljYXRpb24pLm1vZGVsO1xyXG4gICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgbW9kZWw6IG1vZGVsLFxyXG4gICAgICAgICAgICAgICAgYmluZGluZ1N0cmluZzogQmluZGluZ1N0cmluZ01ha2VyLm1ha2VTdHJpbmcoe1xyXG4gICAgICAgICAgICAgICAgICAgIG5hbWU6IG1vZGVsLmlkLFxyXG4gICAgICAgICAgICAgICAgICAgIHRpdGxlOiBtb2RlbC50aXRsZSxcclxuICAgICAgICAgICAgICAgICAgICBkaXNhYmxlQ2FjaGU6IG1vZGVsLmRpc2FibGVDYWNoZSxcclxuICAgICAgICAgICAgICAgICAgICBwYW5lOiBtb2RlbC5wYW5lXHJcbiAgICAgICAgICAgICAgICB9KVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH1cclxuICAgICAgICByZW5kZXIoKTogc3RyaW5nIHtcclxuICAgICAgICAgICAgdmFyIHJlc3VsdCwgZXJyb3I7XHJcbiAgICAgICAgICAgIC8vZHVzdFtcImRlYnVnTGV2ZWxcIl0gPSBcIkRFQlVHXCI7XHJcbiAgICAgICAgICAgIGR1c3RbXCJvbkxvYWRcIl0gPSAobmFtZSwgY2FsbGJhY2s6IChlcnIsIHNyYykgPT4gYW55KSA9PiB7XHJcbiAgICAgICAgICAgICAgICB2YXIgdGVtcGxhdGUgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChuYW1lKTtcclxuICAgICAgICAgICAgICAgIGlmKCF0ZW1wbGF0ZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuYXBwbGljYXRpb24ucmVnaXN0ZXJNaXNzaW5nVGVtcGxhdGUobmFtZS5zdWJzdHIoXCJ4ZXQtZHVzdC1cIi5sZW5ndGgpKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIC8vIFRPRE8gUGxldG5ldiByZW1vdmUgfHwgXCIhdGVtcGxhdGUgd2l0aCBuYW1lIFwiICsgbmFtZSArIFwiIGlzIG5vdCBmb3VuZCFcIlxyXG4gICAgICAgICAgICAgICAgY2FsbGJhY2sobnVsbCwgdGVtcGxhdGUgPyB0ZW1wbGF0ZS5pbm5lckhUTUwgOiBcIiF0ZW1wbGF0ZSB3aXRoIG5hbWUgXCIgKyBuYW1lICsgXCIgaXMgbm90IGZvdW5kIVwiKTtcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgZHVzdC5yZW5kZXIoXCJ4ZXQtZHVzdC12aWV3XCIsIHRoaXMuZ2V0TW9kZWwoKSwgZnVuY3Rpb24oZXJyLCBvdXQpIHtcclxuICAgICAgICAgICAgICAgIGVycm9yID0gZXJyO1xyXG4gICAgICAgICAgICAgICAgcmVzdWx0ID0gb3V0O1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgaWYoIXJlc3VsdCkge1xyXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiU29tZXRoaW5nIHdlbnQgd3JvbmcgZHVyaW5nIHJlbmRlcmluZyBvZiB0aGUgJ1wiICsgdGhpcy52aWV3Q29uZmlnLmlkICsgXCInIHZpZXcgbWFya3VwLiBFcnJvcjogXFxuXCIgKyBlcnJvcik7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgZXhwb3J0IGNsYXNzIEJveE1hcmt1cFJlbmRlciBleHRlbmRzIENvbXBvbmVudE1hcmt1cFJlbmRlckJhc2Uge1xyXG4gICAgICAgIGNvbmZpZzogSUNvbnRhaW5lckNvbmZpZztcclxuICAgICAgICBjb25zdHJ1Y3Rvcihjb25maWc6IElDb250YWluZXJDb25maWcsIG9wdGlvbnM6IElDb21wb25lbnRNYXJrdXBSZW5kZXJPcHRpb25zID0ge30pIHtcclxuICAgICAgICAgICAgc3VwZXIoY29uZmlnLCBvcHRpb25zKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZ2V0TW9kZWwoYXBwOiBJQXBwbGljYXRpb24pIHtcclxuICAgICAgICAgICAgdmFyIGNvbXBvbmVudHNBbmRXaWRnZXQgPSBleHRyYWN0KHRoaXMuY29uZmlnLCBcImNvbXBvbmVudHNcIiksXHJcbiAgICAgICAgICAgICAgICBtb2RlbCA9IHtcclxuICAgICAgICAgICAgICAgICAgICB0eXBlOiB0aGlzLmNvbmZpZy50eXBlLFxyXG4gICAgICAgICAgICAgICAgICAgIGJveDogc3VwZXIuZ2V0TW9kZWwoYXBwLCBjb21wb25lbnRzQW5kV2lkZ2V0LmxlZnRvdmVyKSxcclxuICAgICAgICAgICAgICAgICAgICBjb21wb25lbnRzOiB0aGlzLl9wYXRjaENvbmZpZyhjb21wb25lbnRzQW5kV2lkZ2V0LnRhcmdldCwgYXBwKVxyXG4gICAgICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgIG1vZGVsOiBtb2RlbCxcclxuICAgICAgICAgICAgICAgIGJpbmRpbmdTdHJpbmc6IG1vZGVsLmJveC5iaW5kaW5nU3RyaW5nXHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGV4cG9ydCBjbGFzcyBDb250YWluZXJNYXJrdXBSZW5kZXIgZXh0ZW5kcyBDb21wb25lbnRNYXJrdXBSZW5kZXJCYXNlIHtcclxuICAgICAgICBjb25maWc6IElDb250YWluZXJDb25maWc7XHJcbiAgICAgICAgY29uc3RydWN0b3IoY29uZmlnOiBJQ29udGFpbmVyQ29uZmlnLCBvcHRpb25zOiBJQ29tcG9uZW50TWFya3VwUmVuZGVyT3B0aW9ucyA9IHt9KSB7XHJcbiAgICAgICAgICAgIHN1cGVyKGNvbmZpZywgb3B0aW9ucyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGdldE1vZGVsKGFwcDogSUFwcGxpY2F0aW9uKSB7XHJcbiAgICAgICAgICAgIHZhciBjb250ZW50QW5kQ29udGFpbmVyU3R5bGVzID0gZXh0cmFjdE1hbnkodGhpcy5jb25maWcuc3R5bGUsIFtcInZlcnRpY2FsQWxpZ25cIiwgXCJtYXhXaWR0aFwiXSksXHJcbiAgICAgICAgICAgICAgICBjb25maWcgPSAkLmV4dGVuZCh7fSwgdGhpcy5jb25maWcsIHtcclxuICAgICAgICAgICAgICAgICAgICBjb250YWluZXI6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29udGFpbmVyU3R5bGU6IHJlbWFwKGNvbnRlbnRBbmRDb250YWluZXJTdHlsZXMubGVmdG92ZXIsIHsgaG9yaXpvbnRhbEFsaWduOiBcInRleHRBbGlnblwiIH0sIHRydWUpLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb250ZW50U3R5bGU6IGNvbnRlbnRBbmRDb250YWluZXJTdHlsZXMudGFyZ2V0XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfSksXHJcbiAgICAgICAgICAgICAgICBjb21wb25lbnRzQW5kQ29udGFpbmVyID0gZXh0cmFjdChjb25maWcsIFwiY29tcG9uZW50c1wiKTtcclxuXHJcbiAgICAgICAgICAgIHRoaXMuX2NvcHlNYXJnaW5zKHRoaXMuY29uZmlnLnN0eWxlLCBjb25maWcuY29udGFpbmVyLmNvbnRhaW5lclN0eWxlKTtcclxuICAgICAgICAgICAgdmFyIG1vZGVsID0ge1xyXG4gICAgICAgICAgICAgICAgdHlwZTogdGhpcy5jb25maWcudHlwZSxcclxuICAgICAgICAgICAgICAgIGNvbnRhaW5lcjogc3VwZXIuZ2V0TW9kZWwoYXBwLCBjb21wb25lbnRzQW5kQ29udGFpbmVyLmxlZnRvdmVyKSxcclxuICAgICAgICAgICAgICAgIGNvbXBvbmVudHM6IChjb21wb25lbnRzQW5kQ29udGFpbmVyLnRhcmdldCB8fCBbXSkubWFwKGNvbXBvbmVudCA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHN1cGVyLl9wYXRjaENvbmZpZyhjb21wb25lbnQsIGFwcCk7XHJcbiAgICAgICAgICAgICAgICB9KVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgbW9kZWw6IG1vZGVsLFxyXG4gICAgICAgICAgICAgICAgYmluZGluZ1N0cmluZzogbW9kZWwuY29udGFpbmVyLmJpbmRpbmdTdHJpbmdcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgZXhwb3J0IGNsYXNzIFBhc3Nib3hNYXJrdXBSZW5kZXIgZXh0ZW5kcyBDb21wb25lbnRNYXJrdXBSZW5kZXJCYXNlIHtcclxuICAgICAgICBjb25zdHJ1Y3Rvcihjb25maWc6IElDb21wb25lbnQsIG9wdGlvbnM6IElDb21wb25lbnRNYXJrdXBSZW5kZXJPcHRpb25zID0ge30pIHtcclxuICAgICAgICAgICAgc3VwZXIoY29uZmlnLCBvcHRpb25zKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgX2dldE1vZGVsT2JqZWN0KG1vZGVsQ29uZmlnOiBhbnksIGFwcD86IElBcHBsaWNhdGlvbikge1xyXG4gICAgICAgICAgICBtb2RlbENvbmZpZy5tb2RlID0gXCJwYXNzd29yZFwiO1xyXG4gICAgICAgICAgICByZXR1cm4gc3VwZXIuX2dldE1vZGVsT2JqZWN0KG1vZGVsQ29uZmlnLCBhcHApO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBleHBvcnQgY2xhc3MgRGF0ZWJveE1hcmt1cFJlbmRlciBleHRlbmRzIENvbXBvbmVudE1hcmt1cFJlbmRlckJhc2Uge1xyXG4gICAgICAgIGNvbnN0cnVjdG9yKGNvbmZpZzogSUNvbXBvbmVudCwgb3B0aW9uczogSUNvbXBvbmVudE1hcmt1cFJlbmRlck9wdGlvbnMgPSB7fSkge1xyXG4gICAgICAgICAgICBzdXBlcihjb25maWcsIG9wdGlvbnMpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBfZ2V0TW9kZWxPYmplY3QobW9kZWxDb25maWc6IGFueSwgYXBwPzogSUFwcGxpY2F0aW9uKSB7XHJcbiAgICAgICAgICAgIG1vZGVsQ29uZmlnLnBpY2tlclR5cGUgPSBcInJvbGxlcnNcIjtcclxuICAgICAgICAgICAgcmV0dXJuIHN1cGVyLl9nZXRNb2RlbE9iamVjdChtb2RlbENvbmZpZywgYXBwKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgZXhwb3J0IGNsYXNzIENvbW1hbmRNYXJrdXBSZW5kZXIgZXh0ZW5kcyBDb21wb25lbnRNYXJrdXBSZW5kZXJCYXNlIHtcclxuICAgICAgICBjb25zdHJ1Y3Rvcihjb25maWc6IElDb21tYW5kLCBvcHRpb25zOiBJQ29tcG9uZW50TWFya3VwUmVuZGVyT3B0aW9ucyA9IHt9KSB7XHJcbiAgICAgICAgICAgIHN1cGVyKGNvbmZpZywgb3B0aW9ucyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIF9nZXRNb2RlbE9iamVjdChtb2RlbENvbmZpZzogYW55LCBhcHA/OiBJQXBwbGljYXRpb24pIHtcclxuICAgICAgICAgICAgdmFyIHJlc3VsdCA9IHN1cGVyLl9nZXRNb2RlbE9iamVjdChtb2RlbENvbmZpZywgYXBwKSxcclxuICAgICAgICAgICAgICAgIGRldmljZSA9IExheW91dEhlbHBlci5nZXREZXZpY2VUeXBlKCk7XHJcbiAgICAgICAgICAgIFtcInNob3dJY29uXCIsIFwic2hvd1RleHRcIl0uZm9yRWFjaCgobmFtZSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgaWYocmVzdWx0W25hbWVdKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0W25hbWVdID0gcmVzdWx0W25hbWVdW2RldmljZV07XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDtcclxuICAgICAgICB9XHJcbiAgICAgICAgX2dldEJpbmRuaWdTdHJpbmdPYmplY3QobW9kZWxPYmplY3Q6IElDb21tYW5kKSB7XHJcbiAgICAgICAgICAgIHZhciByZXN1bHQgPSBzdXBlci5fZ2V0QmluZG5pZ1N0cmluZ09iamVjdChtb2RlbE9iamVjdCk7XHJcbiAgICAgICAgICAgIHJlc3VsdC50eXBlID0gbW9kZWxPYmplY3QuYnV0dG9uVHlwZTtcclxuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgZXhwb3J0IGNsYXNzIFJvd01hcmt1cFJlbmRlciBleHRlbmRzIENvbXBvbmVudE1hcmt1cFJlbmRlckJhc2Uge1xyXG4gICAgICAgIGNvbmZpZzogSVJvd0NvbXBvbmVudDtcclxuICAgICAgICBjb25zdHJ1Y3Rvcihjb25maWc6IElSb3dDb21wb25lbnQsIG9wdGlvbnM6IElDb21wb25lbnRNYXJrdXBSZW5kZXJPcHRpb25zID0ge30pIHtcclxuICAgICAgICAgICAgc3VwZXIoY29uZmlnLCBvcHRpb25zKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgc3RhdGljIGdldEJvb3RzdHJhcENvbFN0eWxlKGNvbHVtbjogSVJvd0NvbHVtbiwgd3JhcDogeyBbZGV2aWNlOiBzdHJpbmddOiBudW1iZXIgfSwgdG90YWxTcGFuQ291bnQ6IG51bWJlcikge1xyXG4gICAgICAgICAgICB2YXIgYm9vdHN0cmFwQ29sU3R5bGUgPSBcIlwiLFxyXG4gICAgICAgICAgICAgICAgZGV2aWNlcyA9IFtcImxnXCIsIFwibWRcIiwgXCJ0YWJsZXRcIiwgXCJwaG9uZVwiXSxcclxuICAgICAgICAgICAgICAgIG1hcCA9IHtcclxuICAgICAgICAgICAgICAgICAgICBsZzogXCJsZ1wiLFxyXG4gICAgICAgICAgICAgICAgICAgIG1kOiBcIm1kXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgdGFibGV0OiBcInNtXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgcGhvbmU6IFwieHNcIlxyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIHNwYW4gPSBjb2x1bW4uc3BhbjtcclxuICAgICAgICAgICAgZGV2aWNlcy5mb3JFYWNoKGRldmljZSA9PiB7XHJcbiAgICAgICAgICAgICAgICBpZih3cmFwICYmIHdyYXBbZGV2aWNlXSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHNwYW4gPSB0b3RhbFNwYW5Db3VudCAvIHdyYXBbZGV2aWNlXTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGJvb3RzdHJhcENvbFN0eWxlICs9IFwiY29sLVwiICsgbWFwW2RldmljZV0gKyBcIi1cIiArIHNwYW4gKyBcIiBcIjtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIHJldHVybiBib290c3RyYXBDb2xTdHlsZTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGdldE1vZGVsKGFwcDogSUFwcGxpY2F0aW9uKSB7XHJcbiAgICAgICAgICAgIHZhciBjb2x1bW5zQW5kUm93ID0gZXh0cmFjdCh0aGlzLmNvbmZpZywgXCJjb2x1bW5zXCIpO1xyXG4gICAgICAgICAgICAoY29sdW1uc0FuZFJvdy50YXJnZXQgfHwgW10pLmZvckVhY2goKHZhbHVlKSA9PiB7XHJcbiAgICAgICAgICAgICAgICB2YWx1ZVtcInN0eWxlXCJdID0gdmFsdWVbXCJzdHlsZVwiXSB8fCB7fTtcclxuICAgICAgICAgICAgICAgIHZhbHVlLnN0eWxlLnZlcnRpY2FsQWxpZ24gPSAoY29sdW1uc0FuZFJvdy5sZWZ0b3ZlcltcInN0eWxlXCJdICYmIGNvbHVtbnNBbmRSb3cubGVmdG92ZXJbXCJzdHlsZVwiXS52ZXJ0aWNhbEFsaWduKSB8fCBcInRvcFwiO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgdmFyIG1vZGVsID0ge1xyXG4gICAgICAgICAgICAgICAgdHlwZTogdGhpcy5jb25maWcudHlwZSxcclxuICAgICAgICAgICAgICAgIHJvdzogc3VwZXIuZ2V0TW9kZWwoYXBwLCBjb2x1bW5zQW5kUm93LmxlZnRvdmVyKSxcclxuICAgICAgICAgICAgICAgIGNvbHVtbnM6ICh0aGlzLl9wYXRjaENvbmZpZyhjb2x1bW5zQW5kUm93LnRhcmdldCwgYXBwKSB8fCBbXSkubWFwKGNvbHVtbiA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuICQuZXh0ZW5kKGNvbHVtbiwge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBib290c3RyYXBDb2xTdHlsZTogdGhpcy5fcGF0Y2hGaWVsZChSb3dNYXJrdXBSZW5kZXIuZ2V0Qm9vdHN0cmFwQ29sU3R5bGUoY29sdW1uLCB0aGlzLmNvbmZpZy53cmFwLCB0aGlzLmNvbmZpZy50b3RhbFNwYW5Db3VudCB8fCAxMikpLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBzdHlsZTogc3VwZXIuZ2V0TW9kZWwoYXBwLCByZW1hcChjb2x1bW4uc3R5bGUsIHsgaG9yaXpvbnRhbEFsaWduOiBcInRleHRBbGlnblwiIH0sIHRydWUpKVxyXG4gICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgfSlcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgIG1vZGVsOiBtb2RlbCxcclxuICAgICAgICAgICAgICAgIGJpbmRpbmdTdHJpbmc6IG1vZGVsLnJvdy5iaW5kaW5nU3RyaW5nXHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfVxyXG5cclxuICAgIH1cclxuXHJcbiAgICBleHBvcnQgY2xhc3MgTGlzdE1hcmt1cFJlbmRlciBleHRlbmRzIENvbXBvbmVudE1hcmt1cFJlbmRlckJhc2Uge1xyXG4gICAgICAgIGNvbmZpZzogSUxpc3RDb21wb25lbnQ7XHJcbiAgICAgICAgY29uc3RydWN0b3IoY29uZmlnOiBJTGlzdENvbXBvbmVudCwgb3B0aW9uczogSUNvbXBvbmVudE1hcmt1cFJlbmRlck9wdGlvbnMgPSB7fSkge1xyXG4gICAgICAgICAgICBzdXBlcihjb25maWcsIG9wdGlvbnMpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBnZXRNb2RlbChhcHA6IElBcHBsaWNhdGlvbikge1xyXG4gICAgICAgICAgICB2YXIgaXRlbUFuZEdyb3VwTGlzdCA9IGV4dHJhY3QodGhpcy5jb25maWcsIFwiaXRlbUNvbXBvbmVudHNcIiksXHJcbiAgICAgICAgICAgICAgICBncm91cEFuZExpc3QgPSBleHRyYWN0KGl0ZW1BbmRHcm91cExpc3QubGVmdG92ZXIsIFwiZ3JvdXBDb21wb25lbnRzXCIpO1xyXG5cclxuICAgICAgICAgICAgZ3JvdXBBbmRMaXN0LmxlZnRvdmVyW1wic2Nyb2xsaW5nRW5hYmxlZFwiXSA9ICEhdGhpcy5jb25maWdbXCJzY3JvbGxhYmxlXCJdO1xyXG5cclxuICAgICAgICAgICAgdmFyIG1vZGVsID0ge1xyXG4gICAgICAgICAgICAgICAgdHlwZTogdGhpcy5jb25maWcudHlwZSxcclxuICAgICAgICAgICAgICAgIGxpc3Q6IHN1cGVyLmdldE1vZGVsKGFwcCwgZ3JvdXBBbmRMaXN0LmxlZnRvdmVyKSxcclxuICAgICAgICAgICAgICAgIGl0ZW06IHRoaXMuX3BhdGNoQ29uZmlnKGl0ZW1BbmRHcm91cExpc3QudGFyZ2V0LCBhcHApLFxyXG4gICAgICAgICAgICAgICAgZ3JvdXA6IHRoaXMuX3BhdGNoQ29uZmlnKGdyb3VwQW5kTGlzdC50YXJnZXQsIGFwcClcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgIG1vZGVsOiBtb2RlbCxcclxuICAgICAgICAgICAgICAgIGJpbmRpbmdTdHJpbmc6IG1vZGVsLmxpc3QuYmluZGluZ1N0cmluZ1xyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBleHBvcnQgY2xhc3MgRmllbGRzZXRNYXJrdXBSZW5kZXIgZXh0ZW5kcyBDb21wb25lbnRNYXJrdXBSZW5kZXJCYXNlIHtcclxuICAgICAgICBjb25maWc6IElGaWVsZHNldENvbXBvbmVudDtcclxuICAgICAgICBjb25zdHJ1Y3Rvcihjb25maWc6IElGaWVsZHNldENvbXBvbmVudCwgb3B0aW9uczogSUNvbXBvbmVudE1hcmt1cFJlbmRlck9wdGlvbnMgPSB7fSkge1xyXG4gICAgICAgICAgICBzdXBlcihjb25maWcsIG9wdGlvbnMpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBnZXRNb2RlbChhcHA/OiBJQXBwbGljYXRpb24pIHtcclxuICAgICAgICAgICAgdmFyIGZpZWxkc0FuZEZpZWxkc2V0ID0gZXh0cmFjdCh0aGlzLmNvbmZpZywgXCJmaWVsZHNcIiksXHJcbiAgICAgICAgICAgICAgICBtb2RlbCA9IHtcclxuICAgICAgICAgICAgICAgICAgICB0eXBlOiB0aGlzLmNvbmZpZy50eXBlLFxyXG4gICAgICAgICAgICAgICAgICAgIGZpZWxkc2V0OiBzdXBlci5nZXRNb2RlbChhcHAsIGZpZWxkc0FuZEZpZWxkc2V0LmxlZnRvdmVyKSxcclxuICAgICAgICAgICAgICAgICAgICBmaWVsZHM6IChmaWVsZHNBbmRGaWVsZHNldC50YXJnZXQgfHwgW10pLm1hcChmaWVsZCA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGZpZWxkLnZpc2libGUgPSBmaWVsZC52aXNpYmxlID09PSB1bmRlZmluZWQgPyB0cnVlIDogZmllbGQudmlzaWJsZTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuICQuZXh0ZW5kKHRydWUsIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1vZGVsOiB0aGlzLl9wYXRjaENvbmZpZyh7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGl0bGU6IGZpZWxkLnRpdGxlLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZpc2libGU6IGZpZWxkLnZpc2libGVcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sIGFwcClcclxuICAgICAgICAgICAgICAgICAgICAgICAgfSwgdGhpcy5fcGF0Y2hDb25maWcoZmllbGQsIGFwcCkpO1xyXG4gICAgICAgICAgICAgICAgICAgIH0pLFxyXG4gICAgICAgICAgICAgICAgICAgIC8vVE9ETyBQbGV0bmV2OiBSZW1vdmUgdGhpcyBhbG9uZyB3aXRoIGl0cyBhcHBsYXllci9hcHBkZXNpZ25lciB0ZW1wbGF0ZXMgd2hlbiBkeEZpZWxkU2V0IHN1cHBvcnRzIHRoaXMgb3B0aW9uIG91dCBvZiB0aGUgYm94XHJcbiAgICAgICAgICAgICAgICAgICAgc2luZ2xlQ29sdW1uTGF5b3V0OiBMYXlvdXRIZWxwZXIuZ2V0RGV2aWNlVHlwZSgpID09PSBcInBob25lXCJcclxuICAgICAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICBtb2RlbDogbW9kZWwsXHJcbiAgICAgICAgICAgICAgICBiaW5kaW5nU3RyaW5nOiBtb2RlbC5maWVsZHNldC5iaW5kaW5nU3RyaW5nXHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGV4cG9ydCBjbGFzcyBUYWJzTWFya3VwUmVuZGVyIGV4dGVuZHMgQ29tcG9uZW50TWFya3VwUmVuZGVyQmFzZSB7XHJcbiAgICAgICAgY29uZmlnOiBJVGFiUGFuZWxDb21wb25lbnQ7XHJcbiAgICAgICAgY29uc3RydWN0b3IoY29uZmlnOiBJVGFiUGFuZWxDb21wb25lbnQsIG9wdGlvbnM6IElDb21wb25lbnRNYXJrdXBSZW5kZXJPcHRpb25zID0ge30pIHtcclxuICAgICAgICAgICAgc3VwZXIoY29uZmlnLCBvcHRpb25zKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGdldE1vZGVsKGFwcDogSUFwcGxpY2F0aW9uKSB7XHJcbiAgICAgICAgICAgIHZhciB0YWJzID0gZXh0cmFjdCh0aGlzLmNvbmZpZywgXCJ0YWJzXCIpO1xyXG4gICAgICAgICAgICBkZWxldGUgdGFicy5sZWZ0b3ZlcltcInR5cGVcIl07XHJcbiAgICAgICAgICAgIGlmKHRoaXMuY29uZmlnLnN0eWxlICYmIHRoaXMuY29uZmlnLnN0eWxlLmhlaWdodCkge1xyXG4gICAgICAgICAgICAgICAgdGFicy5sZWZ0b3ZlcltcImhlaWdodFwiXSA9IHRoaXMuY29uZmlnLnN0eWxlLmhlaWdodDtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB2YXIgc3R5bGUgPSBleHRyYWN0KHRhYnMubGVmdG92ZXIsIFwic3R5bGVcIiksXHJcbiAgICAgICAgICAgICAgICBtb2RlbCA9IHtcclxuICAgICAgICAgICAgICAgICAgICB0eXBlOiB0aGlzLmNvbmZpZy50eXBlLFxyXG4gICAgICAgICAgICAgICAgICAgIHRhYnBhbmVsOiBzdXBlci5nZXRNb2RlbChhcHAsIHN0eWxlLmxlZnRvdmVyKSxcclxuICAgICAgICAgICAgICAgICAgICBjb250cm9sOiBzdXBlci5nZXRNb2RlbChhcHAsIHsgdGFicGFuZWw6IHN0eWxlLmxlZnRvdmVyLCBzdHlsZTogc3R5bGUudGFyZ2V0IH0pLCAvL1RPRE86IHdoeSBzdHlsZSBpcyBzZXBhcmF0ZSBvYmplY3Q/XHJcbiAgICAgICAgICAgICAgICAgICAgdGFiczogdGhpcy5fcGF0Y2hDb25maWcodGFicy50YXJnZXQsIGFwcClcclxuICAgICAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICBtb2RlbDogbW9kZWwsXHJcbiAgICAgICAgICAgICAgICBiaW5kaW5nU3RyaW5nOiBtb2RlbC50YWJwYW5lbC5iaW5kaW5nU3RyaW5nXHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGV4cG9ydCBjbGFzcyBBY2NvcmRpb25NYXJrdXBSZW5kZXIgZXh0ZW5kcyBDb21wb25lbnRNYXJrdXBSZW5kZXJCYXNlIHtcclxuICAgICAgICBjb25maWc6IElBY2NvcmRpb25Db21wb25lbnQ7XHJcbiAgICAgICAgY29uc3RydWN0b3IoY29uZmlnOiBJQWNjb3JkaW9uQ29tcG9uZW50LCBvcHRpb25zOiBJQ29tcG9uZW50TWFya3VwUmVuZGVyT3B0aW9ucyA9IHt9KSB7XHJcbiAgICAgICAgICAgIHN1cGVyKGNvbmZpZywgb3B0aW9ucyk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBnZXRNb2RlbChhcHA6IElBcHBsaWNhdGlvbikge1xyXG4gICAgICAgICAgICB2YXIgcGFuZWxzID0gZXh0cmFjdCh0aGlzLmNvbmZpZywgXCJwYW5lbHNcIik7XHJcbiAgICAgICAgICAgIGRlbGV0ZSBwYW5lbHMubGVmdG92ZXJbXCJ0eXBlXCJdO1xyXG4gICAgICAgICAgICB2YXIgc3R5bGUgPSBleHRyYWN0KHBhbmVscy5sZWZ0b3ZlciwgXCJzdHlsZVwiKSxcclxuICAgICAgICAgICAgICAgIG1vZGVsID0ge1xyXG4gICAgICAgICAgICAgICAgICAgIHR5cGU6IHRoaXMuY29uZmlnLnR5cGUsXHJcbiAgICAgICAgICAgICAgICAgICAgY29udHJvbDogc3VwZXIuZ2V0TW9kZWwoYXBwLCB7IG9wdGlvbnM6IHN0eWxlLmxlZnRvdmVyLCBzdHlsZTogc3R5bGUudGFyZ2V0IH0pLFxyXG4gICAgICAgICAgICAgICAgICAgIHBhbmVsczogdGhpcy5fcGF0Y2hDb25maWcocGFuZWxzLnRhcmdldCwgYXBwKVxyXG4gICAgICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgIG1vZGVsOiBtb2RlbCxcclxuICAgICAgICAgICAgICAgIGJpbmRpbmdTdHJpbmc6IFwiXCJcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgZXhwb3J0IGNsYXNzIFNjcm9sbFZpZXdNYXJrdXBSZW5kZXIgZXh0ZW5kcyBDb21wb25lbnRNYXJrdXBSZW5kZXJCYXNlIHtcclxuICAgICAgICBjb25maWc6IElTY3JvbGxWaWV3Q29tcG9uZW50O1xyXG4gICAgICAgIGNvbnN0cnVjdG9yKGNvbmZpZzogSVNjcm9sbFZpZXdDb21wb25lbnQsIG9wdGlvbnM6IElDb21wb25lbnRNYXJrdXBSZW5kZXJPcHRpb25zID0ge30pIHtcclxuICAgICAgICAgICAgc3VwZXIoY29uZmlnLCBvcHRpb25zKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZ2V0TW9kZWwoYXBwOiBJQXBwbGljYXRpb24pIHtcclxuICAgICAgICAgICAgdmFyIGNvbnRlbnRBbmRWaWV3ID0gZXh0cmFjdCh0aGlzLmNvbmZpZywgXCJjb21wb25lbnRzXCIpO1xyXG4gICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgbW9kZWw6IHtcclxuICAgICAgICAgICAgICAgICAgICB0eXBlOiB0aGlzLmNvbmZpZy50eXBlLFxyXG4gICAgICAgICAgICAgICAgICAgIHNjcm9sbHZpZXc6IHN1cGVyLmdldE1vZGVsKGFwcCwgY29udGVudEFuZFZpZXcubGVmdG92ZXIpLFxyXG4gICAgICAgICAgICAgICAgICAgIGNvbXBvbmVudHM6IHRoaXMuX3BhdGNoQ29uZmlnKGNvbnRlbnRBbmRWaWV3LnRhcmdldCwgYXBwKVxyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIGJpbmRpbmdTdHJpbmc6IFwiXCJcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLy9UT0RPIFBsZXRuZXYgQ2FjaGUgZ2V0Q29tcG9uZW50TW9kZWwgcmVzdWx0cyBieSBoYXNoIG9mIChjb21wb25lbnROYW1lICsgdmlld01vZGVsKVxyXG4gICAgLy9UT0RPIFBsZXRuZXYgQW5kIGV4dHJhY3QgbW9kZWw6IGFueSBmcm9tIGFyZ3VtZW50cyAoZ2V0Q29tcG9uZW50TW9kZWwgc2hvdWxkIHJldHVybiBhIGZ1bmN0aW9uIHRoYXQgdGFrZXMgbW9kZWw6IGFueSlcclxuICAgIGV4cG9ydCBmdW5jdGlvbiBnZXRDb21wb25lbnRNb2RlbChwYXJhbXM6IHsgY29tcG9uZW50TmFtZTogc3RyaW5nOyB2aWV3TW9kZWw6IHt9OyBydW5Db250ZXh0OiBJUnVuQ29udGV4dDsgY2FsbGVySW5mbzogQXBwUGxheWVyLkxvZ2ljLklDYWxsZXJJbmZvOyBmdW5jdGlvbnM6IHsgW2tleTogc3RyaW5nXTogRnVuY3Rpb24gfSB9KTogYW55IHtcclxuICAgICAgICB2YXIgY29tcG9uZW50SW5mbyA9IHBhcmFtcy5jb21wb25lbnROYW1lID8gQXBwUGxheWVyLlZpZXdzLmNvbXBvbmVudEluZm9zW3BhcmFtcy5jb21wb25lbnROYW1lXSA6IG51bGwsXHJcbiAgICAgICAgICAgIGJpbmRpbmdQcm9wZXJ0aWVzID0gW10sXHJcbiAgICAgICAgICAgIGNvbXBvbmVudFZpZXdNb2RlbCA9IHByb3BlcnR5VmlzaXRvcihcclxuICAgICAgICAgICAgICAgIHBhcmFtcy52aWV3TW9kZWwsXHJcbiAgICAgICAgICAgICAgICAoY29udGV4dCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciB2YWx1ZSA9IGNvbnRleHQudmFsdWUsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHByb3BOYW1lID0gY29udGV4dC5uYW1lLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBpc0V2ZW50ID0gZmFsc2UsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc3VsdCA9IHZhbHVlLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBmbjogRnVuY3Rpb247XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIGlmKGNvbXBvbmVudEluZm8gJiYgY29tcG9uZW50SW5mby5ldmVudHMpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaXNFdmVudCA9IGNvbXBvbmVudEluZm8uZXZlbnRzLnNvbWUoZXZlbnROYW1lID0+IGV2ZW50TmFtZSA9PT0gcHJvcE5hbWUpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICBpZihpc0V2ZW50KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGZuID0gcGFyYW1zLmZ1bmN0aW9uc1t2YWx1ZV07XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBydW5Db250ZXh0ID0gJC5leHRlbmQoe30sIHBhcmFtcy5ydW5Db250ZXh0KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmVzdWx0ID0gKGUpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBldmVudCA9IGUgPyBlLmpRdWVyeUV2ZW50IDogbnVsbDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmKGV2ZW50ICYmIGV2ZW50LnN0b3BQcm9wYWdhdGlvbiAmJiBwYXJhbXMuY29tcG9uZW50TmFtZSAhPT0gXCJjb21tYW5kXCIpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIFRPRE8gUGxldG5ldiBDaG9vc2UgaXRlbURhdGEgb3IgZGF0YSBkZXBlbmRpbmcgb24gZXZlbnQgYW5kIG9iamVjdFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYoZSAmJiAoZS5pdGVtRGF0YSB8fCBlLmRhdGEpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcnVuQ29udGV4dC4kZGF0YSA9IGUuaXRlbURhdGEgfHwgZS5kYXRhO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBydW5Db250ZXh0LiRkYXRhID0gcGFyYW1zLnJ1bkNvbnRleHQuJGRhdGE7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZm4ocnVuQ29udGV4dCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYodHlwZW9mIHZhbHVlID09PSBcInN0cmluZ1wiKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgdmFsID0gPHN0cmluZz52YWx1ZTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmKHZhbC5pbmRleE9mKFwiJ1wiKSA9PT0gMCAmJiB2YWwubGFzdEluZGV4T2YoXCInXCIpID09PSB2YWwubGVuZ3RoIC0gMSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhbCA9IHZhbC5zdWJzdHIoMSwgdmFsLmxlbmd0aCAtIDIpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzdWx0ID0gd3JhcE1vZGVsUmVmZXJlbmNlKHZhbCwgcGFyYW1zLnJ1bkNvbnRleHQsIHBhcmFtcy5jYWxsZXJJbmZvKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmKHJlc3VsdCAhPT0gdmFsKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYmluZGluZ1Byb3BlcnRpZXMucHVzaChjb250ZXh0LnBhdGggPyBjb250ZXh0LnBhdGggKyBcIi5cIiArIHByb3BOYW1lIDogcHJvcE5hbWUpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICBpZihjb21wb25lbnRJbmZvICYmIGNvbXBvbmVudEluZm8uY29tcG9uZW50Vmlld01vZGVsKSB7XHJcbiAgICAgICAgICAgIGNvbXBvbmVudFZpZXdNb2RlbCA9IGNvbXBvbmVudEluZm8uY29tcG9uZW50Vmlld01vZGVsKGNvbXBvbmVudFZpZXdNb2RlbCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmKGJpbmRpbmdQcm9wZXJ0aWVzLmxlbmd0aCA+IDApIHtcclxuICAgICAgICAgICBjb21wb25lbnRWaWV3TW9kZWxbXCJfYmluZGluZ1Byb3BlcnRpZXNcIl0gPSBiaW5kaW5nUHJvcGVydGllcztcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIGNvbXBvbmVudFZpZXdNb2RlbDtcclxuICAgIH1cclxuICAgIGZ1bmN0aW9uIGlzTmVzdGVkVGVtcGxhdGVNb2RlbChiaW5kaW5nQ29udGV4dDogS25vY2tvdXRCaW5kaW5nQ29udGV4dCkge1xyXG4gICAgICAgIHdoaWxlKGJpbmRpbmdDb250ZXh0LiRwYXJlbnQpIHtcclxuICAgICAgICAgICAgaWYoYmluZGluZ0NvbnRleHRbXCJuZXN0ZWRUZW1wbGF0ZU1vZGVsXCJdICE9PSB1bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBiaW5kaW5nQ29udGV4dFtcIm5lc3RlZFRlbXBsYXRlTW9kZWxcIl07XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgYmluZGluZ0NvbnRleHQgPSBiaW5kaW5nQ29udGV4dC4kcGFyZW50O1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICB9XHJcblxyXG4gICAga28uYmluZGluZ0hhbmRsZXJzW1wid2l0aE1vZGVsXCJdID0ge1xyXG4gICAgICAgIGluaXQ6IGZ1bmN0aW9uKGVsZW1lbnQsIHZhbHVlQWNjZXNzb3IsIGFsbEJpbmRpbmdzLCB2aWV3TW9kZWwsIGJpbmRpbmdDb250ZXh0OiBLbm9ja291dEJpbmRpbmdDb250ZXh0KSB7XHJcbiAgICAgICAgICAgIHZhciB2YWx1ZSA9IHZhbHVlQWNjZXNzb3IoKSxcclxuICAgICAgICAgICAgICAgIG5lc3RlZFRlbXBsYXRlTW9kZWwgPSBpc05lc3RlZFRlbXBsYXRlTW9kZWwoYmluZGluZ0NvbnRleHQpLFxyXG4gICAgICAgICAgICAgICAgbW9kZWwgPSBiaW5kaW5nQ29udGV4dC4kcm9vdCxcclxuICAgICAgICAgICAgICAgIGRhdGEgPSBiaW5kaW5nQ29udGV4dC4kZGF0YSxcclxuICAgICAgICAgICAgICAgICR0ZW1wbGF0ZUVsZW1lbnQ7XHJcblxyXG4gICAgICAgICAgICBpZihuZXN0ZWRUZW1wbGF0ZU1vZGVsKSB7XHJcbiAgICAgICAgICAgICAgICAkdGVtcGxhdGVFbGVtZW50ID0gJChrby52aXJ0dWFsRWxlbWVudHMuZmlyc3RDaGlsZChlbGVtZW50KSkucGFyZW50cyhcIltkYXRhLW9wdGlvbnNePSdkeFRlbXBsYXRlJ11cIik7XHJcbiAgICAgICAgICAgICAgICBpZigkdGVtcGxhdGVFbGVtZW50Lmxlbmd0aCA+IDApIHtcclxuICAgICAgICAgICAgICAgICAgICBkYXRhID0ga28uZGF0YUZvcigkdGVtcGxhdGVFbGVtZW50LmdldCgwKSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIHZpZXdNb2RlbCA9IGdldENvbXBvbmVudE1vZGVsKHtcclxuICAgICAgICAgICAgICAgIGNvbXBvbmVudE5hbWU6IHZhbHVlLmNvbXBvbmVudCxcclxuICAgICAgICAgICAgICAgIHJ1bkNvbnRleHQ6IHtcclxuICAgICAgICAgICAgICAgICAgICAkZGF0YTogZGF0YSxcclxuICAgICAgICAgICAgICAgICAgICAkbW9kZWw6IG1vZGVsLFxyXG4gICAgICAgICAgICAgICAgICAgICRnbG9iYWw6IG1vZGVsLl9nbG9iYWxcclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICBjYWxsZXJJbmZvOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgY2FsbGVyVHlwZTogXCJnZXRDb21wb25lbnRNb2RlbCBkZWxlZ2F0ZVwiLFxyXG4gICAgICAgICAgICAgICAgICAgIGNhbGxlcklkOiB2YWx1ZS5jb21wb25lbnRcclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICB2aWV3TW9kZWw6IHZhbHVlLnZpZXdNb2RlbCxcclxuICAgICAgICAgICAgICAgIGZ1bmN0aW9uczogbW9kZWwuX2Z1bmN0aW9uc1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgdmlld01vZGVsLm5lc3RlZFRlbXBsYXRlTW9kZWwgPSBuZXN0ZWRUZW1wbGF0ZU1vZGVsO1xyXG4gICAgICAgICAgICAvLyBNYWtlIGEgbW9kaWZpZWQgYmluZGluZyBjb250ZXh0LCB3aXRoIGEgZXh0cmEgcHJvcGVydGllcywgYW5kIGFwcGx5IGl0IHRvIGRlc2NlbmRhbnQgZWxlbWVudHNcclxuICAgICAgICAgICAga28uYXBwbHlCaW5kaW5nc1RvRGVzY2VuZGFudHMoYmluZGluZ0NvbnRleHQuY3JlYXRlQ2hpbGRDb250ZXh0KFxyXG4gICAgICAgICAgICAgICAgdmlld01vZGVsLFxyXG4gICAgICAgICAgICAgICAgXCJjb21wb25lbnRcIiwgLy8gT3B0aW9uYWxseSwgcGFzcyBhIHN0cmluZyBoZXJlIGFzIGFuIGFsaWFzIGZvciB0aGUgZGF0YSBpdGVtIGluIGRlc2NlbmRhbnQgY29udGV4dHNcclxuICAgICAgICAgICAgICAgIGZ1bmN0aW9uKGNvbnRleHQpIHtcclxuICAgICAgICAgICAgICAgICAgICBrby51dGlscy5leHRlbmQoY29udGV4dCwgdmFsdWVBY2Nlc3NvcigpKTtcclxuICAgICAgICAgICAgICAgIH0pLCBlbGVtZW50KTtcclxuICAgICAgICAgICAgLy8gQWxzbyB0ZWxsIEtPICpub3QqIHRvIGJpbmQgdGhlIGRlc2NlbmRhbnRzIGl0c2VsZiwgb3RoZXJ3aXNlIHRoZXkgd2lsbCBiZSBib3VuZCB0d2ljZVxyXG4gICAgICAgICAgICByZXR1cm4geyBjb250cm9sc0Rlc2NlbmRhbnRCaW5kaW5nczogdHJ1ZSB9O1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcblxyXG4gICAga28udmlydHVhbEVsZW1lbnRzLmFsbG93ZWRCaW5kaW5nc1tcIndpdGhNb2RlbFwiXSA9IHRydWU7XHJcblxyXG59IiwiLy8vIDxyZWZlcmVuY2UgcGF0aD1cInZpZXdzL3ZpZXdtYXJrdXByZW5kZXJlci50c1wiIC8+XHJcbm1vZHVsZSBBcHBQbGF5ZXIuVmlld3Mge1xyXG4gICAgXCJ1c2Ugc3RyaWN0XCI7XHJcblxyXG4gICAgZXhwb3J0IGNsYXNzIFZpZXcge1xyXG4gICAgICAgIHB1YmxpYyB2aWV3TW9kZWw6IChwYXJhbXMpID0+IGFueTtcclxuXHJcbiAgICAgICAgY29uc3RydWN0b3Iodmlld0NvbmZpZzogSVZpZXcsIGFwcGxpY2F0aW9uOiBJQXBwbGljYXRpb24sIHJvb3RFbGVtZW50PzogSFRNTEVsZW1lbnQpIHtcclxuICAgICAgICAgICAgaWYoZmluZEluQXJyYXkodmlld0NvbmZpZy5wYXJhbXMsIHAgPT4gISFwLnNoYXJlZCkpIHtcclxuICAgICAgICAgICAgICAgIHZpZXdDb25maWcuZGlzYWJsZUNhY2hlID0gdHJ1ZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB2YXIgdmlld01hcmt1cCA9IChuZXcgVmlld01hcmt1cFJlbmRlcmVyKHZpZXdDb25maWcsIGFwcGxpY2F0aW9uKSkucmVuZGVyKCk7XHJcbiAgICAgICAgICAgICQocm9vdEVsZW1lbnQgfHwgZG9jdW1lbnQuYm9keSkuYXBwZW5kKHZpZXdNYXJrdXApO1xyXG4gICAgICAgICAgICB0aGlzLnZpZXdNb2RlbCA9IChwYXJhbXMpID0+IHtcclxuICAgICAgICAgICAgICAgIHZhciB2bSA9IG5ldyBWaWV3TW9kZWwodmlld0NvbmZpZywgYXBwbGljYXRpb24sIHBhcmFtcyk7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gdm0ubW9kZWw7XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59IiwibW9kdWxlIEFwcFBsYXllci5MYXlvdXQge1xyXG4gICAgXCJ1c2Ugc3RyaWN0XCI7XHJcbiAgICBleHBvcnQgY2xhc3MgQ29tcG9uZW50IHtcclxuICAgICAgICBhdHRhY2hlZFByb3BlcnRpZXM6IGFueVtdID0gW107XHJcbiAgICB9XHJcblxyXG4gICAgZXhwb3J0IGNsYXNzIENvbnRhaW5lciBleHRlbmRzIENvbXBvbmVudCB7XHJcbiAgICAgICAgY29tcG9uZW50czogQ29tcG9uZW50W10gPSBbXTtcclxuICAgICAgICBsYXlvdXRDaGlsZHJlbigpOiB2b2lkIHsgfVxyXG4gICAgfVxyXG5cclxuICAgIGV4cG9ydCBjbGFzcyBSb3cgZXh0ZW5kcyBDb250YWluZXIge1xyXG4gICAgICAgIGxheW91dENoaWxkcmVuKCk6IHZvaWQgeyB9XHJcbiAgICB9XHJcbn0iLCIvLy8gPHJlZmVyZW5jZSBwYXRoPVwidmlld21hcmt1cHJlbmRlcmVyLnRzXCIgLz5cclxuXHJcbm1vZHVsZSBBcHBQbGF5ZXIuVmlld3Mge1xyXG4gICAgXCJ1c2Ugc3RyaWN0XCI7XHJcblxyXG4gICAgZXhwb3J0IHZhciBjb21wb25lbnRJbmZvczogeyBba2V5OiBzdHJpbmddOiBJQ29tcG9uZW50SW5mbyB9ID0ge1xyXG4gICAgICAgIFwidmlld1wiOiB7XHJcbiAgICAgICAgICAgIHJlbmRlcmVyVHlwZTogQ29tcG9uZW50TWFya3VwUmVuZGVyQmFzZSxcclxuICAgICAgICAgICAgZXZlbnRzOiBbXCJvbkxvYWRcIiwgXCJvblNob3dcIiwgXCJvbkhpZGVcIiwgXCJvbkRpc3Bvc2VcIl1cclxuICAgICAgICB9LFxyXG4gICAgICAgIFwibGlua1wiOiB7XHJcbiAgICAgICAgICAgIHJlbmRlcmVyVHlwZTogQ29tcG9uZW50TWFya3VwUmVuZGVyQmFzZSxcclxuICAgICAgICAgICAgZGVmYXVsdHM6IHsgdGV4dDogXCJcIiwgbGluazogXCJcIiwgdmlzaWJsZTogdHJ1ZSB9XHJcbiAgICAgICAgfSxcclxuICAgICAgICBcImxhYmVsXCI6IHtcclxuICAgICAgICAgICAgcmVuZGVyZXJUeXBlOiBDb21wb25lbnRNYXJrdXBSZW5kZXJCYXNlLFxyXG4gICAgICAgICAgICBkZWZhdWx0czogeyB0ZXh0OiBcIlwiLCB2aXNpYmxlOiB0cnVlIH1cclxuICAgICAgICB9LFxyXG4gICAgICAgIFwiYnV0dG9uXCI6IHtcclxuICAgICAgICAgICAgcmVuZGVyZXJUeXBlOiBDb21wb25lbnRNYXJrdXBSZW5kZXJCYXNlLFxyXG4gICAgICAgICAgICBldmVudHM6IFtcIm9uQ2xpY2tcIl0sXHJcbiAgICAgICAgICAgIG1hcHBpbmc6IHtcclxuICAgICAgICAgICAgICAgIGN1c3RvbUNvbnRyb2w6IHtcclxuICAgICAgICAgICAgICAgICAgICBraW5kOiBcInR5cGVcIlxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBjb21wb25lbnRWaWV3TW9kZWw6ICh2aWV3TW9kZWwpID0+IHtcclxuICAgICAgICAgICAgICAgIHJldHVybiByZW1hcCh2aWV3TW9kZWwsIGNvbXBvbmVudEluZm9zW1wiYnV0dG9uXCJdLm1hcHBpbmcuY3VzdG9tQ29udHJvbCwgdHJ1ZSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9LFxyXG4gICAgICAgIFwiaW5wdXRcIjoge1xyXG4gICAgICAgICAgICByZW5kZXJlclR5cGU6IENvbXBvbmVudE1hcmt1cFJlbmRlckJhc2UsXHJcbiAgICAgICAgICAgIGV2ZW50czogW1wib25DaGFuZ2VcIl1cclxuICAgICAgICB9LFxyXG4gICAgICAgIFwiaW1hZ2VcIjoge1xyXG4gICAgICAgICAgICByZW5kZXJlclR5cGU6IENvbXBvbmVudE1hcmt1cFJlbmRlckJhc2UsXHJcbiAgICAgICAgICAgIGRlZmF1bHRzOiB7IHdpZHRoOiBcImF1dG9cIiwgaGVpZ2h0OiBcImF1dG9cIiwgdmlzaWJsZTogdHJ1ZSB9XHJcbiAgICAgICAgfSxcclxuICAgICAgICBcImZpbGVpbWFnZVwiOiB7XHJcbiAgICAgICAgICAgIHJlbmRlcmVyVHlwZTogQ29tcG9uZW50TWFya3VwUmVuZGVyQmFzZSxcclxuICAgICAgICAgICAgZGVmYXVsdHM6IHtcclxuICAgICAgICAgICAgICAgIGVtcHR5TGFiZWw6IFwiQ2xpY2sgb3IgdGFwIHRvIHNlbGVjdCBpbWFnZVwiLFxyXG4gICAgICAgICAgICAgICAgY2hhbmdlSW1hZ2VUZXh0OiBcIlRha2UgcGhvdG8gb3Igc2VsZWN0IGZyb20gZ2FsbGVyeVwiLFxyXG4gICAgICAgICAgICAgICAgY2xlYXJUZXh0OiBcIkNsZWFyXCIsXHJcbiAgICAgICAgICAgICAgICBvcGVuR2FsbGVyeVRleHQ6IFwiU2VsZWN0IGZyb20gZ2FsbGVyeVwiLFxyXG4gICAgICAgICAgICAgICAgdGFrZVBob3RvVGV4dDogXCJUYWtlIHBob3RvXCIsXHJcbiAgICAgICAgICAgICAgICBzdHlsZToge1xyXG4gICAgICAgICAgICAgICAgICAgIGZvbnRTaXplOiBcIjEycHhcIixcclxuICAgICAgICAgICAgICAgICAgICBvdmVyZmxvdzogXCJoaWRkZW5cIixcclxuICAgICAgICAgICAgICAgICAgICB0ZXh0T3ZlcmZsb3c6IFwiZWxsaXBzaXNcIixcclxuICAgICAgICAgICAgICAgICAgICB3aGl0ZVNwYWNlOiBcIm5vcm1hbFwiXHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIGNvbXBvbmVudFZpZXdNb2RlbDogKHZpZXdNb2RlbCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIG5ldyBGaWxlSW1hZ2VFZGl0b3JWaWV3TW9kZWwodmlld01vZGVsKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgXCJ0ZXh0YXJlYVwiOiB7XHJcbiAgICAgICAgICAgIHJlbmRlcmVyVHlwZTogQ29tcG9uZW50TWFya3VwUmVuZGVyQmFzZSxcclxuICAgICAgICAgICAgZXZlbnRzOiBbXCJvbkNoYW5nZVwiXVxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgXCJwYXNzYm94XCI6IHtcclxuICAgICAgICAgICAgcmVuZGVyZXJUeXBlOiBQYXNzYm94TWFya3VwUmVuZGVyLFxyXG4gICAgICAgICAgICBldmVudHM6IFtcIm9uQ2hhbmdlXCJdXHJcbiAgICAgICAgfSxcclxuICAgICAgICBcIm51bWJlcmJveFwiOiB7XHJcbiAgICAgICAgICAgIHJlbmRlcmVyVHlwZTogQ29tcG9uZW50TWFya3VwUmVuZGVyQmFzZSxcclxuICAgICAgICAgICAgZGVmYXVsdHM6IHsgc2hvd1NwaW5CdXR0b25zOiB0cnVlLCB2YWx1ZTogbnVsbCB9LFxyXG4gICAgICAgICAgICBldmVudHM6IFtcIm9uVmFsdWVDaGFuZ2VkXCJdXHJcbiAgICAgICAgfSxcclxuICAgICAgICBcInJhZGlvXCI6IHtcclxuICAgICAgICAgICAgcmVuZGVyZXJUeXBlOiBDb21wb25lbnRNYXJrdXBSZW5kZXJCYXNlLFxyXG4gICAgICAgICAgICBtYXBwaW5nOiB7XHJcbiAgICAgICAgICAgICAgICBjdXN0b21Db250cm9sOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgc3RyaW5nSXRlbXM6IFwiaXRlbXNcIixcclxuICAgICAgICAgICAgICAgICAgICBzdHJpbmdWYWx1ZTogXCJ2YWx1ZVwiXHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIGNvbXBvbmVudFZpZXdNb2RlbCh2aWV3TW9kZWwpIHtcclxuICAgICAgICAgICAgICAgIHZpZXdNb2RlbCA9IHJlbWFwKHZpZXdNb2RlbCwgY29tcG9uZW50SW5mb3NbXCJyYWRpb1wiXS5tYXBwaW5nLmN1c3RvbUNvbnRyb2wsIHRydWUpO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHZpZXdNb2RlbDtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgXCJhY3Rpb25zaGVldFwiOiB7XHJcbiAgICAgICAgICAgIHJlbmRlcmVyVHlwZTogQ29tcG9uZW50TWFya3VwUmVuZGVyQmFzZSxcclxuICAgICAgICAgICAgZXZlbnRzOiBbXCJvbkl0ZW1DbGlja1wiXVxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgXCJzd2l0Y2hcIjoge1xyXG4gICAgICAgICAgICByZW5kZXJlclR5cGU6IENvbXBvbmVudE1hcmt1cFJlbmRlckJhc2VcclxuICAgICAgICB9LFxyXG4gICAgICAgIFwibG9hZHBhbmVsXCI6IHtcclxuICAgICAgICAgICAgcmVuZGVyZXJUeXBlOiBDb21wb25lbnRNYXJrdXBSZW5kZXJCYXNlXHJcbiAgICAgICAgfSxcclxuICAgICAgICBcImRhdGVib3hcIjoge1xyXG4gICAgICAgICAgICByZW5kZXJlclR5cGU6IERhdGVib3hNYXJrdXBSZW5kZXIsXHJcbiAgICAgICAgICAgIGV2ZW50czogW1wib25DaGFuZ2VcIl1cclxuICAgICAgICB9LFxyXG4gICAgICAgIFwiYm94XCI6IHtcclxuICAgICAgICAgICAgcmVuZGVyZXJUeXBlOiBCb3hNYXJrdXBSZW5kZXIsXHJcbiAgICAgICAgICAgIGRlZmF1bHRzOiB7IHZpc2libGU6IHRydWUgfVxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgXCJjb250YWluZXJcIjoge1xyXG4gICAgICAgICAgICByZW5kZXJlclR5cGU6IENvbnRhaW5lck1hcmt1cFJlbmRlcixcclxuICAgICAgICAgICAgZGVmYXVsdHM6IHtcclxuICAgICAgICAgICAgICAgIHZpc2libGU6IHRydWUsXHJcbiAgICAgICAgICAgICAgICBzdHlsZToge1xyXG4gICAgICAgICAgICAgICAgICAgIHZlcnRpY2FsQWxpZ246IFwidG9wXCJcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgbWFwcGluZzoge1xyXG4gICAgICAgICAgICAgICAgc3R5bGU6IFwiY29udGFpbmVyLm1vZGVsLmNvbnRhaW5lci5jb250YWluZXJTdHlsZVwiLFxyXG4gICAgICAgICAgICAgICAgY3VzdG9tQ29udHJvbDoge1xyXG4gICAgICAgICAgICAgICAgICAgIHZpc2libGU6IFwiY29udGFpbmVyLm1vZGVsLnZpc2libGVcIlxyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIGN1c3RvbVN0eWxlOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmVydGljYWxBbGlnbjogXCJjb250YWluZXIubW9kZWwuY29udGFpbmVyLmNvbnRlbnRTdHlsZS52ZXJ0aWNhbEFsaWduXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgbWF4V2lkdGg6IFwiY29udGFpbmVyLm1vZGVsLmNvbnRhaW5lci5jb250ZW50U3R5bGUubWF4V2lkdGhcIixcclxuICAgICAgICAgICAgICAgICAgICBob3Jpem9udGFsQWxpZ246IFwiY29udGFpbmVyLm1vZGVsLmNvbnRhaW5lci5jb250YWluZXJTdHlsZS50ZXh0QWxpZ25cIlxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSxcclxuICAgICAgICBcImxpc3RcIjoge1xyXG4gICAgICAgICAgICByZW5kZXJlclR5cGU6IExpc3RNYXJrdXBSZW5kZXIsXHJcbiAgICAgICAgICAgIGRlZmF1bHRzOiB7XHJcbiAgICAgICAgICAgICAgICBzY3JvbGxhYmxlOiB0cnVlXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIGV2ZW50czogW1wib25JdGVtQ2xpY2tcIiwgXCJvbkl0ZW1Ib2xkXCJdLFxyXG4gICAgICAgICAgICBtYXBwaW5nOiB7XHJcbiAgICAgICAgICAgICAgICBzdHlsZTogXCJsaXN0Lm1vZGVsLnN0eWxlXCJcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgY29tcG9uZW50Vmlld01vZGVsKHZpZXdNb2RlbCkge1xyXG4gICAgICAgICAgICAgICAgJC5leHRlbmQodmlld01vZGVsLCB2aWV3TW9kZWwuZWRpdENvbmZpZyk7XHJcbiAgICAgICAgICAgICAgICBkZWxldGUgKHZpZXdNb2RlbC5lZGl0Q29uZmlnKTtcclxuICAgICAgICAgICAgICAgIHJldHVybiB2aWV3TW9kZWw7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9LFxyXG4gICAgICAgIFwibG9va3VwXCI6IHtcclxuICAgICAgICAgICAgcmVuZGVyZXJUeXBlOiBDb21wb25lbnRNYXJrdXBSZW5kZXJCYXNlLFxyXG4gICAgICAgICAgICBtYXBwaW5nOiB7XHJcbiAgICAgICAgICAgICAgICBjdXN0b21Db250cm9sOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFsdWVFeHByZXNzaW9uOiBcInZhbHVlRXhwclwiLFxyXG4gICAgICAgICAgICAgICAgICAgIGRpc3BsYXlFeHByZXNzaW9uOiBcImRpc3BsYXlFeHByXCJcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgY29tcG9uZW50Vmlld01vZGVsKHZpZXdNb2RlbCkge1xyXG4gICAgICAgICAgICAgICAgdmFyIHZhbHVlID0gdmlld01vZGVsLnZhbHVlID8ga28udW53cmFwKHZpZXdNb2RlbC52YWx1ZSkgOiB1bmRlZmluZWQsXHJcbiAgICAgICAgICAgICAgICAgICAgdmFsdWVTdHJpbmcgPSBKU09OLnN0cmluZ2lmeSh2YWx1ZSksXHJcbiAgICAgICAgICAgICAgICAgICAgdmFsdWVHZXR0ZXIgPSB2aWV3TW9kZWwudmFsdWVFeHByZXNzaW9uID9cclxuICAgICAgICAgICAgICAgICAgICAgICAgRGV2RXhwcmVzcy5kYXRhLnV0aWxzLmNvbXBpbGVHZXR0ZXIoa28udW53cmFwKHZpZXdNb2RlbC52YWx1ZUV4cHJlc3Npb24pKSA6XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICh2YWx1ZSkgPT4geyByZXR1cm4gdmFsdWU7IH07XHJcbiAgICAgICAgICAgICAgICB2aWV3TW9kZWwgPSByZW1hcCh2aWV3TW9kZWwsIGNvbXBvbmVudEluZm9zW1wibG9va3VwXCJdLm1hcHBpbmcuY3VzdG9tQ29udHJvbCwgdHJ1ZSk7XHJcbiAgICAgICAgICAgICAgICBpZih2aWV3TW9kZWwgJiYga28udW53cmFwKHZpZXdNb2RlbC5pdGVtcykpIHtcclxuICAgICAgICAgICAgICAgICAgICBpZigkLmlzQXJyYXkoa28udW53cmFwKHZpZXdNb2RlbC5pdGVtcykpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGtvLnVud3JhcCh2aWV3TW9kZWwuaXRlbXMpLmZvckVhY2goKGl0ZW0pID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmKEpTT04uc3RyaW5naWZ5KHZhbHVlKSA9PT0gSlNPTi5zdHJpbmdpZnkodmFsdWVHZXR0ZXIoaXRlbSkpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmlld01vZGVsLnZhbHVlKHZhbHVlR2V0dGVyKGl0ZW0pKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHZpZXdNb2RlbDtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgXCJ0YWJwYW5lbFwiOiB7XHJcbiAgICAgICAgICAgIHJlbmRlcmVyVHlwZTogVGFic01hcmt1cFJlbmRlcixcclxuICAgICAgICAgICAgbWFwcGluZzoge1xyXG4gICAgICAgICAgICAgICAgY29udHJvbDogXCJjb250cm9sLm1vZGVsLnRhYnBhbmVsXCIsXHJcbiAgICAgICAgICAgICAgICBzdHlsZTogXCJjb250cm9sLm1vZGVsLnN0eWxlXCIsXHJcbiAgICAgICAgICAgICAgICBjdXN0b21TdHlsZToge1xyXG4gICAgICAgICAgICAgICAgICAgIGhlaWdodDogXCJjb250cm9sLm1vZGVsLnRhYnBhbmVsLmhlaWdodFwiXHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIGRlZmF1bHRzOiB7XHJcbiAgICAgICAgICAgICAgICBzdHlsZToge1xyXG4gICAgICAgICAgICAgICAgICAgIC8vaGVpZ2h0OiBcIjQ1MHB4XCJcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgXCJhY2NvcmRpb25cIjoge1xyXG4gICAgICAgICAgICByZW5kZXJlclR5cGU6IEFjY29yZGlvbk1hcmt1cFJlbmRlcixcclxuICAgICAgICAgICAgbWFwcGluZzoge1xyXG4gICAgICAgICAgICAgICAgY29udHJvbDogXCJjb250cm9sLm1vZGVsLm9wdGlvbnNcIixcclxuICAgICAgICAgICAgICAgIHN0eWxlOiBcImNvbnRyb2wubW9kZWwuc3R5bGVcIlxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSxcclxuICAgICAgICBcImRhdGFncmlkXCI6IHtcclxuICAgICAgICAgICAgcmVuZGVyZXJUeXBlOiBDb21wb25lbnRNYXJrdXBSZW5kZXJCYXNlLFxyXG4gICAgICAgICAgICBldmVudHM6IFtcIm9uUm93Q2xpY2tcIl0sXHJcbiAgICAgICAgICAgIGNvbXBvbmVudFZpZXdNb2RlbDogKHZpZXdNb2RlbCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgdmFyIGRhdGFTb3VyY2UgPSBrby51bndyYXAodmlld01vZGVsLmRhdGFTb3VyY2UpO1xyXG4gICAgICAgICAgICAgICAgaWYoZGF0YVNvdXJjZSAmJiBkYXRhU291cmNlW1wiX2NhbGN1bGF0ZWRGaWVsZHNcIl0pIHtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgY2FsY3VsYXRlZEZpZWxkcyA9IDxJTW9kZWxQcm9wZXJ0eVtdPmRhdGFTb3VyY2VbXCJfY2FsY3VsYXRlZEZpZWxkc1wiXTtcclxuICAgICAgICAgICAgICAgICAgICB2aWV3TW9kZWwub25Sb3dVcGRhdGluZyA9IChyb3dJbmZvKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBuZXdEYXRhID0gcm93SW5mby5uZXdEYXRhO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAkLmVhY2gobmV3RGF0YSwobmFtZSwgdmFsdWUpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmKGZpbmRJbkFycmF5KGNhbGN1bGF0ZWRGaWVsZHMsIG0gPT4gbS5uYW1lID09PSBuYW1lKSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlbGV0ZSBuZXdEYXRhW25hbWVdO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHZpZXdNb2RlbDtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgXCJyb3dcIjoge1xyXG4gICAgICAgICAgICByZW5kZXJlclR5cGU6IFJvd01hcmt1cFJlbmRlcixcclxuICAgICAgICAgICAgZGVmYXVsdHM6IHsgdmlzaWJsZTogdHJ1ZSB9LFxyXG4gICAgICAgICAgICBtYXBwaW5nOiB7XHJcbiAgICAgICAgICAgICAgICBzdHlsZTogXCJyb3cubW9kZWwuc3R5bGVcIlxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSxcclxuICAgICAgICBcImNvbHVtblwiOiB7XHJcbiAgICAgICAgICAgIHJlbmRlcmVyVHlwZTogQ29tcG9uZW50TWFya3VwUmVuZGVyQmFzZVxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgXCJmaWVsZHNldFwiOiB7XHJcbiAgICAgICAgICAgIHJlbmRlcmVyVHlwZTogRmllbGRzZXRNYXJrdXBSZW5kZXIsXHJcbiAgICAgICAgICAgIG1hcHBpbmc6IHtcclxuICAgICAgICAgICAgICAgIHN0eWxlOiBcImZpZWxkc2V0Lm1vZGVsLnN0eWxlXCJcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgXCJjb21tYW5kXCI6IHtcclxuICAgICAgICAgICAgcmVuZGVyZXJUeXBlOiBDb21tYW5kTWFya3VwUmVuZGVyLFxyXG4gICAgICAgICAgICBkZWZhdWx0czogeyB2aXNpYmxlOiB0cnVlLCBkaXNhYmxlZDogZmFsc2UsIGJ1dHRvblR5cGU6IFwibm9ybWFsXCIgfSxcclxuICAgICAgICAgICAgZXZlbnRzOiBbXCJvbkV4ZWN1dGVcIl1cclxuICAgICAgICB9LFxyXG4gICAgICAgIFwic2Nyb2xsdmlld1wiOiB7XHJcbiAgICAgICAgICAgIHJlbmRlcmVyVHlwZTogU2Nyb2xsVmlld01hcmt1cFJlbmRlcixcclxuICAgICAgICAgICAgbWFwcGluZzoge1xyXG4gICAgICAgICAgICAgICAgc3R5bGU6IFwic2Nyb2xsdmlldy5tb2RlbC5zdHlsZVwiXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9O1xyXG5cclxufSIsIi8vLyA8cmVmZXJlbmNlIHBhdGg9XCJ2aWV3cy9jb21wb25lbnRzaW5mby50c1wiIC8+XHJcbm1vZHVsZSBBcHBQbGF5ZXIuVmlld3Mge1xyXG4gICAgXCJ1c2Ugc3RyaWN0XCI7XHJcblxyXG4gICAgaW1wb3J0IGR4ZGF0YSA9IERldkV4cHJlc3MuZGF0YTtcclxuXHJcbiAgICBleHBvcnQgaW50ZXJmYWNlIElWaWV3UGFyYW1ldGVycyB7XHJcbiAgICAgICAgcGFyYW1ldGVycz86IHsgW2tleTogc3RyaW5nXTogYW55IH07XHJcbiAgICB9XHJcblxyXG4gICAgZXhwb3J0IGNsYXNzIFZpZXdNb2RlbCB7XHJcbiAgICAgICAgc3RhdGljIG9wdGlvbmFsKHBhcmFtOiBJUGFyYW1ldGVyKTogYm9vbGVhbiB7XHJcbiAgICAgICAgICAgIHJldHVybiBwYXJhbS5kZWZhdWx0VmFsdWUgIT09IHZvaWQgMDtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHZpZXdDb25maWc6IElWaWV3O1xyXG4gICAgICAgIG1vZGVsOiBhbnk7XHJcbiAgICAgICAgcHJpdmF0ZSByZWZyZXNoU3RyYXRlZ2llczogSVJlZnJlc2hTdHJhdGVneVtdO1xyXG4gICAgICAgIHByaXZhdGUgZXZlbnRzOiB7IFtrZXk6IHN0cmluZ106IEZ1bmN0aW9uIH0gPSB7fTtcclxuICAgICAgICBwcml2YXRlIGFscmVhZHlTaG93bjogYm9vbGVhbiA9IGZhbHNlO1xyXG4gICAgICAgIHByaXZhdGUgY3VycmVudFBhcmFtczogSVZpZXdQYXJhbWV0ZXJzO1xyXG5cclxuICAgICAgICBjb25zdHJ1Y3Rvcih2aWV3Q29uZmlnOiBJVmlldywgYXBwbGljYXRpb246IElBcHBsaWNhdGlvbiwgb3JpZ2luYWxQYXJhbXM6IElWaWV3UGFyYW1ldGVycykge1xyXG4gICAgICAgICAgICB0aGlzLmN1cnJlbnRQYXJhbXMgPSBvcmlnaW5hbFBhcmFtcztcclxuICAgICAgICAgICAgdGhpcy5tb2RlbCA9IE1vZGVsLmNyZWF0ZU1vZGVsKHZpZXdDb25maWcsIGFwcGxpY2F0aW9uKTtcclxuXHJcbiAgICAgICAgICAgIHRoaXMudmlld0NvbmZpZyA9IHZpZXdDb25maWc7XHJcbiAgICAgICAgICAgIHRoaXMucGF0Y2hFdmVudHMoYXBwbGljYXRpb24pO1xyXG5cclxuICAgICAgICAgICAgdGhpcy5tb2RlbFtcIl9mdW5jdGlvbnNcIl0gPSBhcHBsaWNhdGlvbi5mdW5jdGlvbnM7XHJcbiAgICAgICAgICAgIHRoaXMubW9kZWxbXCJfZ2xvYmFsXCJdID0gYXBwbGljYXRpb24ubW9kZWw7XHJcbiAgICAgICAgICAgIHRoaXMubW9kZWxbXCJfc2Nyb2xsVmlld1Jlc2V0dGVyXCJdID0geyByZXNldDogZnVuY3Rpb24oKSB7IC8qIHJlcGxhY2VkIGluIG1hcmt1cC4gc2VlIGNvbW1pdCBieSBWaXRpayBmcm9tIE9jdCA3ICovIH0gfTtcclxuXHJcbiAgICAgICAgICAgIGlmKCh2aWV3Q29uZmlnLm1vZGVsIHx8IFtdKS5maWx0ZXIoaXRlbSA9PiBpdGVtLm5hbWUgPT09IFwidGl0bGVcIikubGVuZ3RoID09PSAwKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLm1vZGVsW1widGl0bGVcIl0gPSBrby5wdXJlQ29tcHV0ZWQoKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBnZXRNb2RlbFZhbHVlKHZpZXdDb25maWcudGl0bGUgfHwgXCJcIiwgeyAkZ2xvYmFsOiBhcHBsaWNhdGlvbi5tb2RlbCwgJG1vZGVsOiB0aGlzLm1vZGVsIH0sIHsgY2FsbGVySWQ6IFwidGl0bGVcIiwgY2FsbGVyVHlwZTogXCJWaWV3IG1vZGVsXCIgfSk7XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgdmFyIF9wYXJhbWV0ZXJzQXJlUmVhZHkgPSBrby5vYnNlcnZhYmxlKGZhbHNlKTtcclxuICAgICAgICAgICAgdGhpcy5tb2RlbC5pc1JlYWR5ID0ga28ub2JzZXJ2YWJsZShmYWxzZSk7XHJcblxyXG4gICAgICAgICAgICB0aGlzLm1vZGVsW1widmlld1Nob3dpbmdcIl0gPSAoY29uZmlnKSA9PiB7IC8vU3RhbmlzbGF2OiBUMzM2ODUyICAgZGVsZXRlIGFmdGVyIGZpeCBEZXNpZ25lckxheW91dC5qc1xyXG4gICAgICAgICAgICAgICAgaWYoIXRoaXMuYWxyZWFkeVNob3duIHx8IHZpZXdDb25maWcucmVmcmVzaFdoZW5TaG93bikge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudFBhcmFtcyA9IGNvbmZpZy5wYXJhbXMgfHwge307XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zZXRNb2RlbFZhbHVlRnJvbVBhcmFtZXRlcihhcHBsaWNhdGlvbiwgX3BhcmFtZXRlcnNBcmVSZWFkeSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB2YXIgcG9wdXAgPSAoKGNvbmZpZy52aWV3SW5mbyB8fCB7fSkubGF5b3V0Q29udHJvbGxlciB8fCB7fSkuX3BvcHVwO1xyXG4gICAgICAgICAgICAgICAgaWYocG9wdXApIHtcclxuICAgICAgICAgICAgICAgICAgICBbXCJoZWlnaHRcIiwgXCJ3aWR0aFwiXS5mb3JFYWNoKChwcm9wZXJ0eSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZih2aWV3Q29uZmlnW3Byb3BlcnR5XSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcG9wdXAub3B0aW9uKHByb3BlcnR5LCB2aWV3Q29uZmlnW3Byb3BlcnR5XSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZihwb3B1cC5vcHRpb24oXCJmdWxsU2NyZWVuXCIpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcG9wdXAub3B0aW9uKFwiZnVsbFNjcmVlblwiLCBmYWxzZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfTtcclxuXHJcbiAgICAgICAgICAgIHRoaXMubW9kZWxbXCJ2aWV3U2hvd25cIl0gPSAoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICBpZighdGhpcy5hbHJlYWR5U2hvd24pIHtcclxuICAgICAgICAgICAgICAgICAgICBrby5jb21wdXRlZCgoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMubW9kZWwuaXNSZWFkeShrby51bndyYXAoX3BhcmFtZXRlcnNBcmVSZWFkeSkpO1xyXG4gICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgICAgIE1vZGVsLmluaXRpYWxpemVEYXRhU291cmNlcyh0aGlzLm1vZGVsLCB7ICRtb2RlbDogdGhpcy5tb2RlbCwgJGdsb2JhbDogYXBwbGljYXRpb24ubW9kZWwgfSwgYXBwbGljYXRpb24sIGFwcGxpY2F0aW9uLnN0b3JlcywgZmFsc2UsIHZpZXdDb25maWcuZGF0YVNvdXJjZXMpO1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuYWxyZWFkeVNob3duID0gdHJ1ZTtcclxuICAgICAgICAgICAgICAgIH0gZWxzZSBpZih2aWV3Q29uZmlnLnJlZnJlc2hXaGVuU2hvd24pIHtcclxuICAgICAgICAgICAgICAgICAgICBNb2RlbC5pbml0aWFsaXplRGF0YVNvdXJjZXModGhpcy5tb2RlbCwgeyAkbW9kZWw6IHRoaXMubW9kZWwsICRnbG9iYWw6IGFwcGxpY2F0aW9uLm1vZGVsIH0sIGFwcGxpY2F0aW9uLCBhcHBsaWNhdGlvbi5zdG9yZXMsIHRydWUsIHZpZXdDb25maWcuZGF0YVNvdXJjZXMpO1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMubW9kZWxbXCJfc2Nyb2xsVmlld1Jlc2V0dGVyXCJdLnJlc2V0KCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgaWYoIXRoaXMucmVmcmVzaFN0cmF0ZWdpZXMpIHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLnJlZnJlc2hTdHJhdGVnaWVzID0gdGhpcy5jcmVhdGVSZWZyZXNoU3RyYXRlZ2llcyhhcHBsaWNhdGlvbiwgdGhpcy5jdXJyZW50UGFyYW1zKTtcclxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5yZWZyZXNoU3RyYXRlZ2llcy5mb3JFYWNoKHN0cmF0ZWd5ID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgc3RyYXRlZ3kuZW5hYmxlZCA9IHRydWU7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0cmF0ZWd5LnJlZnJlc2goKTtcclxuICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICB0aGlzLm9uRXZlbnQoXCJvblNob3dcIiwgdGhpcy5jdXJyZW50UGFyYW1zICYmIHRoaXMuY3VycmVudFBhcmFtcy5wYXJhbWV0ZXJzKTtcclxuICAgICAgICAgICAgfTtcclxuXHJcbiAgICAgICAgICAgIHRoaXMubW9kZWxbXCJ2aWV3SGlkZGVuXCJdID0gKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgaWYodmlld0NvbmZpZy5yZWZyZXNoV2hlblNob3duKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgX3BhcmFtZXRlcnNBcmVSZWFkeShmYWxzZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5jbGVhck1vZGVsKGFwcGxpY2F0aW9uKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHRoaXMucmVmcmVzaFN0cmF0ZWdpZXMuZm9yRWFjaChzdHJhdGVneSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgc3RyYXRlZ3kuaGlkZGVuKCk7XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgICAgICB0aGlzLm9uRXZlbnQoXCJvbkhpZGVcIiwgdGhpcy5jdXJyZW50UGFyYW1zICYmIHRoaXMuY3VycmVudFBhcmFtcy5wYXJhbWV0ZXJzKTtcclxuICAgICAgICAgICAgfTtcclxuXHJcbiAgICAgICAgICAgIHRoaXMubW9kZWxbXCJ2aWV3RGlzcG9zaW5nXCJdID0gKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5yZWZyZXNoU3RyYXRlZ2llcy5mb3JFYWNoKHN0cmF0ZWd5ID0+IHtcclxuICAgICAgICAgICAgICAgICAgICBzdHJhdGVneS5kaXNwb3NlKCk7XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgIHRoaXMucmVmcmVzaFN0cmF0ZWdpZXMuc3BsaWNlKDAsIHRoaXMucmVmcmVzaFN0cmF0ZWdpZXMubGVuZ3RoKTtcclxuXHJcbiAgICAgICAgICAgICAgICB0aGlzLm9uRXZlbnQoXCJvbkRpc3Bvc2VcIiwgdGhpcy5jdXJyZW50UGFyYW1zICYmIHRoaXMuY3VycmVudFBhcmFtcy5wYXJhbWV0ZXJzKTtcclxuICAgICAgICAgICAgfTtcclxuXHJcbiAgICAgICAgICAgIHRoaXMub25FdmVudChcIm9uTG9hZFwiLCB0aGlzLmN1cnJlbnRQYXJhbXMgJiYgdGhpcy5jdXJyZW50UGFyYW1zLnBhcmFtZXRlcnMpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcHJpdmF0ZSBjbGVhck1vZGVsKGFwcGxpY2F0aW9uOiBJQXBwbGljYXRpb24pIHtcclxuICAgICAgICAgICAgdmFyIGVtcHR5TW9kZWwgPSBNb2RlbC5jcmVhdGVNb2RlbCh0aGlzLnZpZXdDb25maWcsIGFwcGxpY2F0aW9uKTtcclxuICAgICAgICAgICAgdGhpcy52aWV3Q29uZmlnLm1vZGVsXHJcbiAgICAgICAgICAgICAgICAuZmlsdGVyKHByb3BlcnR5Q29uZmlnID0+IHByb3BlcnR5Q29uZmlnLmdldHRlciA9PSBudWxsKVxyXG4gICAgICAgICAgICAgICAgLmZvckVhY2gocHJvcGVydHlDb25maWcgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciBwcm9wZXJ0eU5hbWUgPSBwcm9wZXJ0eUNvbmZpZy5uYW1lO1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMubW9kZWxbcHJvcGVydHlOYW1lXSA9IGVtcHR5TW9kZWxbcHJvcGVydHlOYW1lXTtcclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcHJpdmF0ZSBwYXRjaEV2ZW50cyhhcHBsaWNhdGlvbjogSUFwcGxpY2F0aW9uKSB7XHJcbiAgICAgICAgICAgIHZhciBjb21wb25lbnRJbmZvID0gY29tcG9uZW50SW5mb3NbXCJ2aWV3XCJdO1xyXG4gICAgICAgICAgICBjb21wb25lbnRJbmZvLmV2ZW50cy5mb3JFYWNoKGV2ZW50TmFtZSA9PiB7XHJcbiAgICAgICAgICAgICAgICB2YXIgZXZlbnQgPSB0aGlzLnZpZXdDb25maWdbZXZlbnROYW1lXSxcclxuICAgICAgICAgICAgICAgICAgICBmdW5jdGlvbkNvbXBpbGVyO1xyXG4gICAgICAgICAgICAgICAgaWYoIWV2ZW50IHx8ICFhcHBsaWNhdGlvbi5jcmVhdGVGdW5jdGlvbkNvbXBpbGVyKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgZnVuY3Rpb25Db21waWxlciA9IGFwcGxpY2F0aW9uLmNyZWF0ZUZ1bmN0aW9uQ29tcGlsZXIoZXZlbnQpO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5ldmVudHNbZXZlbnROYW1lXSA9IChlKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uQ29tcGlsZXIucnVuKHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgJGdsb2JhbDogYXBwbGljYXRpb24ubW9kZWwsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICRtb2RlbDogdGhpcy5tb2RlbCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJGRhdGE6IGVcclxuICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYWxsZXJUeXBlOiBcInZpZXcgZXZlbnRcIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxlcklkOiBldmVudE5hbWVcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICk7XHJcbiAgICAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHByaXZhdGUgb25FdmVudChldmVudE5hbWUsIHBhcmFtcykge1xyXG4gICAgICAgICAgICB2YXIgaGFuZGxlciA9IHRoaXMuZXZlbnRzW2V2ZW50TmFtZV07XHJcbiAgICAgICAgICAgIGlmKGhhbmRsZXIpIHtcclxuICAgICAgICAgICAgICAgIGhhbmRsZXIocGFyYW1zKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcHJpdmF0ZSBjcmVhdGVSZWZyZXNoU3RyYXRlZ2llcyhhcHBsaWNhdGlvbjogSUFwcGxpY2F0aW9uLCB2aWV3UGFyYW1ldGVyczogSVZpZXdQYXJhbWV0ZXJzKTogSVJlZnJlc2hTdHJhdGVneVtdIHtcclxuICAgICAgICAgICAgdmFyIHJlZnJlc2hTdHJhdGVnaWVzOiBJUmVmcmVzaFN0cmF0ZWd5W10gPSBbXTtcclxuICAgICAgICAgICAgJC5lYWNoKHRoaXMubW9kZWwsIChpbmRleCwgdmFsdWUpID0+IHtcclxuICAgICAgICAgICAgICAgIGlmKCEodmFsdWUgaW5zdGFuY2VvZiBkeGRhdGEuRGF0YVNvdXJjZSkpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB2YXIgZHMgPSA8ZHhkYXRhLkRhdGFTb3VyY2U+dmFsdWUsXHJcbiAgICAgICAgICAgICAgICAgICAgcmVmcmVzaFN0cmF0ZWd5ID0gU291cmNlUmVmcmVzaFN0cmF0ZWd5LmNyZWF0ZShkcyk7XHJcbiAgICAgICAgICAgICAgICBpZihyZWZyZXNoU3RyYXRlZ3kpIHtcclxuICAgICAgICAgICAgICAgICAgICByZWZyZXNoU3RyYXRlZ2llcy5wdXNoKHJlZnJlc2hTdHJhdGVneSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBpZihkc1tcIl9tb25pdG9yXCJdICYmIGRzW1wiX21vbml0b3JcIl0uc3RvcmVzICYmIGRzW1wiX21vbml0b3JcIl0uc3RvcmVzLmxlbmd0aCA+IDApIHtcclxuICAgICAgICAgICAgICAgICAgICByZWZyZXNoU3RyYXRlZ2llcy5wdXNoKG5ldyBNb25pdG9yUmVmcmVzaFN0cmF0ZWd5KGRzLCBhcHBsaWNhdGlvbiwgZHNbXCJfbW9uaXRvclwiXS5zdG9yZXMpKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIGlmKHRoaXMudmlld0NvbmZpZy5wYXJhbXMpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMudmlld0NvbmZpZy5wYXJhbXMuZm9yRWFjaChwYXJhbWV0ZXIgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciB0eXBlSW5mbyA9IGFwcGxpY2F0aW9uLnR5cGVJbmZvUmVwb3NpdG9yeS5nZXQocGFyYW1ldGVyLnR5cGUpO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmKHR5cGVJbmZvICYmIHR5cGVJbmZvLmtpbmQgPT09IFRZUEVTLlNUT1JFX1RZUEUpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHJlZnJlc2hTdHJhdGVneSA9IFBhcmFtZXRlclJlZnJlc2hTdHJhdGVneS5jcmVhdGUocGFyYW1ldGVyLCB0aGlzLm1vZGVsLCBhcHBsaWNhdGlvbiwgdmlld1BhcmFtZXRlcnMpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZihyZWZyZXNoU3RyYXRlZ3kpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlZnJlc2hTdHJhdGVnaWVzLnB1c2gocmVmcmVzaFN0cmF0ZWd5KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJldHVybiByZWZyZXNoU3RyYXRlZ2llcztcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHByaXZhdGUgc2V0TW9kZWxWYWx1ZUZyb21QYXJhbWV0ZXIoYXBwbGljYXRpb246IElBcHBsaWNhdGlvbiwgaXNSZWFkeTogS25vY2tvdXRPYnNlcnZhYmxlPGJvb2xlYW4+KSB7XHJcbiAgICAgICAgICAgIHZhciBwYXJhbWV0ZXJzTG9hZGluZ0NvdW50ID0gMDtcclxuXHJcbiAgICAgICAgICAgIGlmKHRoaXMudmlld0NvbmZpZy5wYXJhbXMpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMudmlld0NvbmZpZy5wYXJhbXMuZm9yRWFjaCgocGFyYW1ldGVyKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIHR5cGVJbmZvID0gYXBwbGljYXRpb24udHlwZUluZm9SZXBvc2l0b3J5LmdldChwYXJhbWV0ZXIudHlwZSksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG9iamVjdEtleTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgaWYocGFyYW1ldGVyLnNoYXJlZCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZih0eXBlb2YgYXBwbGljYXRpb24uc2hhcmVkT2JqZWN0c1twYXJhbWV0ZXIubmFtZV0gPT09IFwidW5kZWZpbmVkXCIpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJTaGFyZWQgcGFyYW1ldGVyICdcIiArIHBhcmFtZXRlci5uYW1lICsgXCInIGlzIG1pc3NpbmcgZnJvbSB0aGUgc2hhcmVkT2JqZWN0cyBjb2xsZWN0aW9uLlwiKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLm1vZGVsW3BhcmFtZXRlci5uYW1lXSA9IGFwcGxpY2F0aW9uLnNoYXJlZE9iamVjdHNbcGFyYW1ldGVyLm5hbWVdO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBkZWxldGUgYXBwbGljYXRpb24uc2hhcmVkT2JqZWN0c1twYXJhbWV0ZXIubmFtZV07XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIGVsc2UgaWYodHlwZUluZm8gJiYgdHlwZUluZm8ua2luZCA9PT0gVFlQRVMuU1RPUkVfVFlQRSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBvYmplY3RLZXkgPSB0aGlzLmN1cnJlbnRQYXJhbXMucGFyYW1ldGVycyA/IHRoaXMuY3VycmVudFBhcmFtcy5wYXJhbWV0ZXJzW3BhcmFtZXRlci5uYW1lXSA6IHVuZGVmaW5lZDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYob2JqZWN0S2V5KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgc3RvcmUgPSBhcHBsaWNhdGlvbi5zdG9yZXNbcGFyYW1ldGVyLnR5cGVdO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcGFyYW1ldGVyc0xvYWRpbmdDb3VudCsrO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RvcmUuYnlLZXkob2JqZWN0S2V5LCB7IGV4cGFuZDogcGFyYW1ldGVyLmV4cGFuZCB9KVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC50aGVuKChkYXRhKSA9PiB7IHRoaXMubW9kZWxbcGFyYW1ldGVyLm5hbWVdID0gZGF0YTsgfSwgKCkgPT4geyBhcHBsaWNhdGlvbi5wcm9jZXNzUGFyYW1ldGVyTG9hZGluZ0Vycm9yKHBhcmFtZXRlci5uYW1lLCBvYmplY3RLZXkpOyB9KVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5hbHdheXMoKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwYXJhbWV0ZXJzTG9hZGluZ0NvdW50LS07XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlzUmVhZHkoIXBhcmFtZXRlcnNMb2FkaW5nQ291bnQpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5tb2RlbFtwYXJhbWV0ZXIubmFtZV0gPSBwYXJhbWV0ZXIuZGVmYXVsdFZhbHVlO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLm1vZGVsW3BhcmFtZXRlci5uYW1lXSA9ICh0aGlzLmN1cnJlbnRQYXJhbXMucGFyYW1ldGVycyAmJiB0aGlzLmN1cnJlbnRQYXJhbXMucGFyYW1ldGVyc1twYXJhbWV0ZXIubmFtZV0pIHx8IHBhcmFtZXRlci5kZWZhdWx0VmFsdWU7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgaXNSZWFkeShwYXJhbWV0ZXJzTG9hZGluZ0NvdW50ID09PSAwKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICBpbnRlcmZhY2UgSVJlZnJlc2hTdHJhdGVneSB7XHJcbiAgICAgICAgZW5hYmxlZDogYm9vbGVhbjtcclxuICAgICAgICByZWZyZXNoKCk7XHJcbiAgICAgICAgZGlzcG9zZSgpO1xyXG4gICAgICAgIGhpZGRlbigpO1xyXG4gICAgfVxyXG5cclxuICAgIGNsYXNzIFNvdXJjZVJlZnJlc2hTdHJhdGVneSBpbXBsZW1lbnRzIElSZWZyZXNoU3RyYXRlZ3kge1xyXG4gICAgICAgIHB1YmxpYyBzdGF0aWMgY3JlYXRlKGRzPzogRGV2RXhwcmVzcy5kYXRhLkRhdGFTb3VyY2UpIHtcclxuICAgICAgICAgICAgc3dpdGNoKGRzW1wiX3JlZnJlc2hPblZpZXdTaG93blwiXSkge1xyXG4gICAgICAgICAgICAgICAgY2FzZSBcIm5ldmVyXCI6XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICAgICAgICAgICAgICBjYXNlIFwiYWx3YXlzXCI6XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG5ldyBTb3VyY2VSZWZyZXNoU3RyYXRlZ3koZHMpO1xyXG4gICAgICAgICAgICAgICAgY2FzZSBcIndoZW5DaGFuZ2VzXCI6XHJcbiAgICAgICAgICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBuZXcgV2hlbkNoYW5nZXNTb3VyY2VSZWZyZXNoU3RyYXRlZ3koZHMpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBlbmFibGVkOiBib29sZWFuID0gdHJ1ZTtcclxuXHJcbiAgICAgICAgY29uc3RydWN0b3IocHVibGljIGRzOiBkeGRhdGEuRGF0YVNvdXJjZSkge1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmVmcmVzaCgpIHtcclxuICAgICAgICAgICAgdGhpcy5kcy5sb2FkKCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBkaXNwb3NlKCkgeyB9XHJcblxyXG4gICAgICAgIGhpZGRlbigpIHtcclxuICAgICAgICAgICAgdGhpcy5lbmFibGVkID0gZmFsc2U7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGNsYXNzIFdoZW5DaGFuZ2VzU291cmNlUmVmcmVzaFN0cmF0ZWd5IGV4dGVuZHMgU291cmNlUmVmcmVzaFN0cmF0ZWd5IHtcclxuICAgICAgICBwcml2YXRlIGNhbGxiYWNrOiBGdW5jdGlvbjtcclxuICAgICAgICBwcml2YXRlIG1vZGlmaWVkOiBib29sZWFuO1xyXG5cclxuICAgICAgICBjb25zdHJ1Y3RvcihwdWJsaWMgZHM6IGR4ZGF0YS5EYXRhU291cmNlKSB7XHJcbiAgICAgICAgICAgIHN1cGVyKGRzKTtcclxuXHJcbiAgICAgICAgICAgIHRoaXMuY2FsbGJhY2sgPSAoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLm1vZGlmaWVkID0gdHJ1ZTtcclxuICAgICAgICAgICAgICAgIGlmKHRoaXMuZW5hYmxlZCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMucmVmcmVzaCgpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICB0aGlzLmRzLnN0b3JlKCkub24oXCJtb2RpZmllZFwiLCB0aGlzLmNhbGxiYWNrKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJlZnJlc2goKSB7XHJcbiAgICAgICAgICAgIGlmKHRoaXMubW9kaWZpZWQpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMubW9kaWZpZWQgPSBmYWxzZTtcclxuICAgICAgICAgICAgICAgIHN1cGVyLnJlZnJlc2goKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgZGlzcG9zZSgpIHtcclxuICAgICAgICAgICAgdGhpcy5kcy5zdG9yZSgpLm9mZihcIm1vZGlmaWVkXCIsIHRoaXMuY2FsbGJhY2spO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBjbGFzcyBQYXJhbWV0ZXJSZWZyZXNoU3RyYXRlZ3kgaW1wbGVtZW50cyBJUmVmcmVzaFN0cmF0ZWd5IHtcclxuICAgICAgICBwdWJsaWMgc3RhdGljIGNyZWF0ZShwYXJhbTogSVBhcmFtZXRlciwgbW9kZWw6IGFueSwgYXBwbGljYXRpb246IElBcHBsaWNhdGlvbiwgdmlld1BhcmFtZXRlcnM6IElWaWV3UGFyYW1ldGVycykge1xyXG4gICAgICAgICAgICBzd2l0Y2gocGFyYW0ucmVmcmVzaE9uVmlld1Nob3duKSB7XHJcbiAgICAgICAgICAgICAgICBjYXNlIFwibmV2ZXJcIjpcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgICAgICAgICAgICAgIGNhc2UgXCJhbHdheXNcIjpcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbmV3IFBhcmFtZXRlclJlZnJlc2hTdHJhdGVneShwYXJhbSwgbW9kZWwsIGFwcGxpY2F0aW9uLCB2aWV3UGFyYW1ldGVycyk7XHJcbiAgICAgICAgICAgICAgICBjYXNlIFwid2hlbkNoYW5nZXNcIjpcclxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG5ldyBXaGVuQ2hhbmdlc1BhcmFtZXRlclJlZnJlc2hTdHJhdGVneShwYXJhbSwgbW9kZWwsIGFwcGxpY2F0aW9uLCB2aWV3UGFyYW1ldGVycyk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGVuYWJsZWQ6IGJvb2xlYW4gPSB0cnVlO1xyXG4gICAgICAgIHN0b3JlOiBkeGRhdGEuU3RvcmU7XHJcbiAgICAgICAgcHJpdmF0ZSBwYXJhbTogSVBhcmFtZXRlcjtcclxuICAgICAgICBwcml2YXRlIG1vZGVsOiBhbnk7XHJcbiAgICAgICAgYXBwbGljYXRpb246IElBcHBsaWNhdGlvbjtcclxuXHJcbiAgICAgICAgY29uc3RydWN0b3IocGFyYW06IElQYXJhbWV0ZXIsIG1vZGVsOiBhbnksIGFwcGxpY2F0aW9uOiBJQXBwbGljYXRpb24sIHZpZXdQYXJhbWV0ZXJzOiBJVmlld1BhcmFtZXRlcnMpIHtcclxuICAgICAgICAgICAgdGhpcy5wYXJhbSA9IHBhcmFtO1xyXG4gICAgICAgICAgICB0aGlzLm1vZGVsID0gbW9kZWw7XHJcbiAgICAgICAgICAgIHRoaXMuYXBwbGljYXRpb24gPSBhcHBsaWNhdGlvbjtcclxuICAgICAgICAgICAgdGhpcy5zdG9yZSA9IGFwcGxpY2F0aW9uLnN0b3Jlc1twYXJhbS50eXBlXTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJlZnJlc2goKSB7XHJcbiAgICAgICAgICAgIHZhciBrZXkgPSB0aGlzLnN0b3JlLmtleU9mKHRoaXMubW9kZWxbdGhpcy5wYXJhbS5uYW1lXSk7XHJcbiAgICAgICAgICAgIGlmKGtleSkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5zdG9yZS5ieUtleShrZXksIHsgZXhwYW5kOiB0aGlzLnBhcmFtLmV4cGFuZCB9KS5kb25lKGRhdGEgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMubW9kZWxbdGhpcy5wYXJhbS5uYW1lXSA9IGRhdGE7XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgZGlzcG9zZSgpIHsgfVxyXG5cclxuICAgICAgICBoaWRkZW4oKSB7XHJcbiAgICAgICAgICAgIHRoaXMuZW5hYmxlZCA9IGZhbHNlO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBjbGFzcyBXaGVuQ2hhbmdlc1BhcmFtZXRlclJlZnJlc2hTdHJhdGVneSBleHRlbmRzIFBhcmFtZXRlclJlZnJlc2hTdHJhdGVneSB7XHJcbiAgICAgICAgcHJpdmF0ZSBpbnNlcnRlZENhbGxiYWNrOiBGdW5jdGlvbjtcclxuICAgICAgICBwcml2YXRlIHVwZGF0ZWRDYWxsYmFjazogRnVuY3Rpb247XHJcbiAgICAgICAgcHJpdmF0ZSByZW1vdmVkQ2FsbGJhY2s6IEZ1bmN0aW9uO1xyXG4gICAgICAgIHByaXZhdGUgbW9kaWZpZWQ6IGJvb2xlYW47XHJcbiAgICAgICAgcHJpdmF0ZSByZW1vdmVkOiBib29sZWFuO1xyXG4gICAgICAgIHByaXZhdGUgdmlld0NhY2hlS2V5OiBzdHJpbmc7XHJcblxyXG4gICAgICAgIGNvbnN0cnVjdG9yKHBhcmFtOiBJUGFyYW1ldGVyLCBtb2RlbDogYW55LCBhcHBsaWNhdGlvbjogSUFwcGxpY2F0aW9uLCB2aWV3UGFyYW1ldGVyczogSVZpZXdQYXJhbWV0ZXJzKSB7XHJcbiAgICAgICAgICAgIHN1cGVyKHBhcmFtLCBtb2RlbCwgYXBwbGljYXRpb24sIHZpZXdQYXJhbWV0ZXJzKTtcclxuXHJcbiAgICAgICAgICAgIHRoaXMubW9kaWZpZWQgPSBmYWxzZTtcclxuICAgICAgICAgICAgdGhpcy5yZW1vdmVkID0gZmFsc2U7XHJcbiAgICAgICAgICAgIHRoaXMudmlld0NhY2hlS2V5ID0gYXBwbGljYXRpb24udmlld0NhY2hlS2V5ICYmIGFwcGxpY2F0aW9uLnZpZXdDYWNoZUtleSgpO1xyXG5cclxuICAgICAgICAgICAgdmFyIG9iamVjdEtleSA9IHZpZXdQYXJhbWV0ZXJzLnBhcmFtZXRlcnMgPyB2aWV3UGFyYW1ldGVycy5wYXJhbWV0ZXJzW3BhcmFtLm5hbWVdIDogdW5kZWZpbmVkO1xyXG5cclxuICAgICAgICAgICAgdGhpcy5pbnNlcnRlZENhbGxiYWNrID0gKHZhbHVlcywga2V5KSA9PiB7XHJcbiAgICAgICAgICAgICAgICBpZihrZXkgPT09IG9iamVjdEtleSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMubW9kaWZpZWQgPSB0cnVlO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmKHRoaXMuZW5hYmxlZCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnJlZnJlc2goKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgIHRoaXMuc3RvcmUub24oXCJpbnNlcnRlZFwiLCB0aGlzLmluc2VydGVkQ2FsbGJhY2spO1xyXG5cclxuICAgICAgICAgICAgdGhpcy51cGRhdGVkQ2FsbGJhY2sgPSAoa2V5LCB2YWx1ZXMpID0+IHtcclxuICAgICAgICAgICAgICAgIGlmKCF0aGlzLmVuYWJsZWQgJiYgKG9iamVjdEtleSA9PT0gdW5kZWZpbmVkIHx8IGtleSA9PT0gb2JqZWN0S2V5KSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMubW9kaWZpZWQgPSB0cnVlO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmKHRoaXMuZW5hYmxlZCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnJlZnJlc2goKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgIHRoaXMuc3RvcmUub24oXCJ1cGRhdGVkXCIsIHRoaXMudXBkYXRlZENhbGxiYWNrKTtcclxuXHJcbiAgICAgICAgICAgIHRoaXMucmVtb3ZlZENhbGxiYWNrID0gKGtleSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgaWYob2JqZWN0S2V5ID09PSB1bmRlZmluZWQgfHwga2V5ID09PSBvYmplY3RLZXkpIHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLnJlbW92ZWQgPSB0cnVlO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmKCF0aGlzLmVuYWJsZWQpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5yZW1vdmVWaWV3Q2FjaGUoKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgIHRoaXMuc3RvcmUub24oXCJyZW1vdmVkXCIsIHRoaXMucmVtb3ZlZENhbGxiYWNrKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJlZnJlc2goKSB7XHJcbiAgICAgICAgICAgIGlmKHRoaXMubW9kaWZpZWQpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMubW9kaWZpZWQgPSBmYWxzZTtcclxuICAgICAgICAgICAgICAgIHN1cGVyLnJlZnJlc2goKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgZGlzcG9zZSgpIHtcclxuICAgICAgICAgICAgdGhpcy5zdG9yZS5vZmYoXCJpbnNlcnRlZFwiLCB0aGlzLmluc2VydGVkQ2FsbGJhY2spO1xyXG4gICAgICAgICAgICB0aGlzLnN0b3JlLm9mZihcInVwZGF0ZWRcIiwgdGhpcy51cGRhdGVkQ2FsbGJhY2spO1xyXG4gICAgICAgICAgICB0aGlzLnN0b3JlLm9mZihcInJlbW92ZWRcIiwgdGhpcy5yZW1vdmVkQ2FsbGJhY2spO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaGlkZGVuKCkge1xyXG4gICAgICAgICAgICBzdXBlci5oaWRkZW4oKTtcclxuICAgICAgICAgICAgaWYodGhpcy5yZW1vdmVkKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnJlbW92ZVZpZXdDYWNoZSgpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBwcml2YXRlIHJlbW92ZVZpZXdDYWNoZSgpIHtcclxuICAgICAgICAgICAgaWYodGhpcy5hcHBsaWNhdGlvbi5yZW1vdmVWaWV3Q2FjaGUgJiYgdGhpcy52aWV3Q2FjaGVLZXkgIT09IHZvaWQgMCkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5hcHBsaWNhdGlvbi5yZW1vdmVWaWV3Q2FjaGUodGhpcy52aWV3Q2FjaGVLZXkpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGNsYXNzIE1vbml0b3JSZWZyZXNoU3RyYXRlZ3kgaW1wbGVtZW50cyBJUmVmcmVzaFN0cmF0ZWd5IHtcclxuICAgICAgICByZWZyZXNoRnVuYzogRnVuY3Rpb247XHJcbiAgICAgICAgZW5hYmxlZDogYm9vbGVhbiA9IHRydWU7XHJcbiAgICAgICAgbW9kaWZpZWQ6IGJvb2xlYW4gPSBmYWxzZTtcclxuXHJcbiAgICAgICAgY29uc3RydWN0b3IocHVibGljIGRzOiBkeGRhdGEuRGF0YVNvdXJjZSwgcHVibGljIGFwcGxpY2F0aW9uOiBJQXBwbGljYXRpb24sIHB1YmxpYyBzdG9yZUlkczogc3RyaW5nW10pIHtcclxuICAgICAgICAgICAgdGhpcy5yZWZyZXNoRnVuYyA9ICgpID0+IHtcclxuICAgICAgICAgICAgICAgIHRoaXMubW9kaWZpZWQgPSB0cnVlO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5yZWZyZXNoKCk7XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgIHRoaXMuc3RvcmVJZHMuZm9yRWFjaCgoc3RvcmVJZCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgdmFyIHN0b3JlID0gdGhpcy5hcHBsaWNhdGlvbi5zdG9yZXNbc3RvcmVJZF07XHJcbiAgICAgICAgICAgICAgICBzdG9yZS5vbihcIm1vZGlmaWVkXCIsIHRoaXMucmVmcmVzaEZ1bmMpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJlZnJlc2goKSB7XHJcbiAgICAgICAgICAgIGlmKHRoaXMuZW5hYmxlZCkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5kcy5sb2FkKCk7XHJcbiAgICAgICAgICAgICAgICB0aGlzLm1vZGlmaWVkID0gZmFsc2U7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGRpc3Bvc2UoKSB7XHJcbiAgICAgICAgICAgIHRoaXMuc3RvcmVJZHMuZm9yRWFjaCgoc3RvcmVJZCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgdmFyIHN0b3JlID0gdGhpcy5hcHBsaWNhdGlvbi5zdG9yZXNbc3RvcmVJZF07XHJcbiAgICAgICAgICAgICAgICBzdG9yZS5vZmYoXCJtb2RpZmllZFwiLCB0aGlzLnJlZnJlc2hGdW5jKTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBoaWRkZW4oKSB7XHJcbiAgICAgICAgICAgIHRoaXMuZW5hYmxlZCA9IGZhbHNlO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxufSIsIm1vZHVsZSBBcHBQbGF5ZXIuTG9naWMge1xyXG4gICAgXCJ1c2Ugc3RyaWN0XCI7XHJcblxyXG4gICAgaW1wb3J0IGR4ZGlhbG9nID0gRGV2RXhwcmVzcy51aS5kaWFsb2c7XHJcblxyXG4gICAgZXhwb3J0IGVudW0gRmxvdyB7XHJcbiAgICAgICAgUmV0dXJuLFxyXG4gICAgICAgIEJyZWFrLFxyXG4gICAgICAgIENvbnRpbnVlXHJcbiAgICB9XHJcblxyXG4gICAgZXhwb3J0IGNsYXNzIFJlc3VsdCB7XHJcbiAgICAgICAgZmxvdzogRmxvdztcclxuICAgICAgICB2YWx1ZTogYW55O1xyXG4gICAgfVxyXG5cclxuICAgIGV4cG9ydCBjbGFzcyBPcGVyYXRpb24ge1xyXG4gICAgICAgIHN0YXRpYyBldmFsKGV4cHI6IHN0cmluZywgY29udGV4dDogeyBbbmFtZTogc3RyaW5nXTogYW55IH0pOiBhbnkge1xyXG4gICAgICAgICAgICB2YXIgdmFyTmFtZXMgPSBbXSxcclxuICAgICAgICAgICAgICAgIHZhclZhbHVlcyA9IFtdO1xyXG4gICAgICAgICAgICAkLmVhY2goY29udGV4dCwgKG5hbWUsIHZhbHVlKSA9PiB7XHJcbiAgICAgICAgICAgICAgICB2YXJOYW1lcy5wdXNoKG5hbWUpO1xyXG4gICAgICAgICAgICAgICAgdmFyVmFsdWVzLnB1c2godmFsdWUpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgdmFyTmFtZXMucHVzaChcInJldHVybiAoXCIgKyBleHByICsgXCIpXCIpO1xyXG4gICAgICAgICAgICB2YXIgZm4gPSBGdW5jdGlvbi5hcHBseShudWxsLCB2YXJOYW1lcyk7XHJcbiAgICAgICAgICAgIHJldHVybiBmbi5hcHBseShudWxsLCB2YXJWYWx1ZXMpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgc3RhdGljIHJ1bihjYWxsczogT3BlcmF0aW9uW10sIHZhcmlhYmxlczogeyBba2V5OiBzdHJpbmddOiBWYXJpYWJsZSB9LCBmdW5jdGlvbnM6IGFueSk6IEpRdWVyeVByb21pc2U8UmVzdWx0PiB7XHJcbiAgICAgICAgICAgIGlmKCFjYWxscyB8fCBjYWxscy5sZW5ndGggPT09IDApIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiB0cml2aWFsUHJvbWlzZSgpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHZhciBjYWxsSW5kZXggPSAwLFxyXG4gICAgICAgICAgICAgICAgdGhlbkhhbmRsZXIgPSAocmVzdWx0KSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYoKGNhbGxJbmRleCA9PT0gY2FsbHMubGVuZ3RoIC0gMSkgfHwgKHJlc3VsdCAmJiByZXN1bHQuZmxvdyBpbiBGbG93KSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJpdmlhbFByb21pc2UocmVzdWx0KTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgY2FsbEluZGV4Kys7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGNhbGxzW2NhbGxJbmRleF0ucnVuKHZhcmlhYmxlcywgZnVuY3Rpb25zKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAudGhlbjxSZXN1bHQ+KHRoZW5IYW5kbGVyKTtcclxuICAgICAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgIHJldHVybiBjYWxsc1tjYWxsSW5kZXhdXHJcbiAgICAgICAgICAgICAgICAucnVuKHZhcmlhYmxlcywgZnVuY3Rpb25zKVxyXG4gICAgICAgICAgICAgICAgLnRoZW48UmVzdWx0Pih0aGVuSGFuZGxlcik7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvL2NhcHRpb246IHN0cmluZzsgIC8vIFRPRE86IEl2YW5cclxuICAgICAgICAvL2F1dG9HZW5lcmF0ZUNhcHRpb246IGJvb2xlYW47IC8vIFRPRE86IEl2YW5cclxuXHJcbiAgICAgICAgcnVuKHZhcmlhYmxlczogeyBba2V5OiBzdHJpbmddOiBWYXJpYWJsZSB9LCBmdW5jdGlvbnM6IGFueSk6IEpRdWVyeVByb21pc2U8UmVzdWx0PiB7XHJcbiAgICAgICAgICAgIHRocm93IEVycm9yKFwiTm90IGltcGxlbWVudGVkXCIpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgZXZhbChleHByOiBzdHJpbmcsIHZhcmlhYmxlczogeyBba2V5OiBzdHJpbmddOiBWYXJpYWJsZSB9LCBmdW5jdGlvbnM6IGFueSk6IGFueSB7XHJcbiAgICAgICAgICAgIHZhciB2YXJOYW1lcyA9IFtdLFxyXG4gICAgICAgICAgICAgICAgdmFyVmFsdWVzID0gW107XHJcbiAgICAgICAgICAgICQuZWFjaCh2YXJpYWJsZXMsIChuYW1lLCB2YXJpYWJsZSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgdmFyTmFtZXMucHVzaCh2YXJpYWJsZS5uYW1lKTtcclxuICAgICAgICAgICAgICAgIHZhclZhbHVlcy5wdXNoKHZhcmlhYmxlLnZhbHVlKTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIGlmKCFmdW5jdGlvbnMpIHtcclxuICAgICAgICAgICAgICAgIHZhck5hbWVzLnB1c2goXCJyZXR1cm4gKFwiICsgZXhwciArIFwiKVwiKTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHZhck5hbWVzLnB1c2goXCIkZnVuY3Rpb25zXCIpO1xyXG4gICAgICAgICAgICAgICAgdmFyVmFsdWVzLnB1c2goZnVuY3Rpb25zKTtcclxuICAgICAgICAgICAgICAgIHZhck5hbWVzLnB1c2goXCJ3aXRoKCRmdW5jdGlvbnMpIHsgcmV0dXJuIChcIiArIGV4cHIgKyBcIik7IH1cIik7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgdmFyIGZuID0gRnVuY3Rpb24uYXBwbHkobnVsbCwgdmFyTmFtZXMpO1xyXG4gICAgICAgICAgICByZXR1cm4gZm4uYXBwbHkobnVsbCwgdmFyVmFsdWVzKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHN0YXRpYyBmcm9tSnNvbihqc29uOiBJQml6TG9naWNDYWxsIHwgT3BlcmF0aW9uKTogT3BlcmF0aW9uIHtcclxuICAgICAgICAgICAgaWYoanNvbiBpbnN0YW5jZW9mIE9wZXJhdGlvbikge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGpzb247XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgcmVzdWx0ID0gT3BlcmF0aW9uLmNyZWF0ZSgoPElCaXpMb2dpY0NhbGw+anNvbikuX3R5cGUpO1xyXG4gICAgICAgICAgICAgICAgT3BlcmF0aW9uLnJlc3RvcmVQcm9wZXJ0aWVzKGpzb24sIHJlc3VsdCk7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gcmVzdWx0O1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBzdGF0aWMgY3JlYXRlKHR5cGU6IHN0cmluZyk6IE9wZXJhdGlvbiB7XHJcbiAgICAgICAgICAgIHJldHVybiBuZXcgQXBwUGxheWVyLkxvZ2ljW3R5cGVdKCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBwcml2YXRlIHN0YXRpYyByZXN0b3JlUHJvcGVydGllcyhqc29uOiBhbnksIHJlc3VsdDogYW55KSB7XHJcbiAgICAgICAgICAgICQuZWFjaChqc29uLCAobmFtZSwgdmFsdWUpID0+IHtcclxuICAgICAgICAgICAgICAgIGlmKG5hbWUgPT09IFwiX3R5cGVcIikge1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGlmKEFycmF5LmlzQXJyYXkodmFsdWUpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0W25hbWVdID0gdmFsdWUubWFwKChlbGVtZW50KSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmKHR5cGVvZiBlbGVtZW50ID09PSBcIm9iamVjdFwiICYmIGVsZW1lbnQgJiYgZWxlbWVudC5fdHlwZSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIE9wZXJhdGlvbi5mcm9tSnNvbihlbGVtZW50KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBPcGVyYXRpb24ucmVzdG9yZVByb3BlcnRpZXMoZWxlbWVudCwgQXJyYXkuaXNBcnJheShlbGVtZW50KSA/IFtdIDoge30pO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYodmFsdWUgJiYgdHlwZW9mIHZhbHVlID09PSBcIm9iamVjdFwiKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYodmFsdWUgJiYgdmFsdWUuX3R5cGUpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmVzdWx0W25hbWVdID0gT3BlcmF0aW9uLmZyb21Kc29uKHZhbHVlKTtcclxuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXN1bHRbbmFtZV0gPSBPcGVyYXRpb24ucmVzdG9yZVByb3BlcnRpZXModmFsdWUsIHt9KTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdFtuYW1lXSA9IHZhbHVlO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgZXhwb3J0IGNsYXNzIEV2ZW50IGV4dGVuZHMgT3BlcmF0aW9uIHtcclxuICAgICAgICBmbG93OiBGbG93O1xyXG4gICAgICAgIHJldHVyblZhbHVlOiBhbnkgPSBudWxsO1xyXG4gICAgICAgIHJldHVybkV4cHIgPSBcIlwiO1xyXG5cclxuICAgICAgICBjb25zdHJ1Y3RvcihmbG93PzogYW55LCByZXR1cm5WYWx1ZT86IGFueSkge1xyXG4gICAgICAgICAgICBzdXBlcigpO1xyXG5cclxuICAgICAgICAgICAgaWYoZmxvdyBpbiBGbG93KSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmZsb3cgPSBmbG93O1xyXG4gICAgICAgICAgICAgICAgdGhpcy5yZXR1cm5WYWx1ZSA9IHJldHVyblZhbHVlO1xyXG4gICAgICAgICAgICB9IGVsc2UgaWYoZmxvdykge1xyXG4gICAgICAgICAgICAgICAgdmFyIHBhcmFtID0gPGFueT5mbG93O1xyXG4gICAgICAgICAgICAgICAgaWYodHlwZW9mIHBhcmFtLmZsb3cgIT09IFwidW5kZWZpbmVkXCIpIHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLmZsb3cgPSBwYXJhbS5mbG93O1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgaWYodHlwZW9mIHBhcmFtLnJldHVyblZhbHVlICE9PSBcInVuZGVmaW5lZFwiKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5yZXR1cm5WYWx1ZSA9IHBhcmFtLnJldHVyblZhbHVlO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgaWYodHlwZW9mIHBhcmFtLnJldHVybkV4cHIgIT09IFwidW5kZWZpbmVkXCIpIHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLnJldHVybkV4cHIgPSBwYXJhbS5yZXR1cm5FeHByO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBydW4odmFyaWFibGVzOiB7IFtrZXk6IHN0cmluZ106IGFueSB9LCBmdW5jdGlvbnM6IGFueSk6IEpRdWVyeVByb21pc2U8UmVzdWx0PiB7XHJcbiAgICAgICAgICAgIHZhciByZXN1bHQ6IFJlc3VsdCA9IHtcclxuICAgICAgICAgICAgICAgIGZsb3c6IHRoaXMuZmxvdyxcclxuICAgICAgICAgICAgICAgIHZhbHVlOiB1bmRlZmluZWRcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgaWYodGhpcy5mbG93ID09PSBGbG93LlJldHVybikge1xyXG4gICAgICAgICAgICAgICAgaWYodGhpcy5yZXR1cm5FeHByKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0LnZhbHVlID0gdGhpcy5ldmFsKHRoaXMucmV0dXJuRXhwciwgdmFyaWFibGVzLCBmdW5jdGlvbnMpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0LnZhbHVlID0gdGhpcy5yZXR1cm5WYWx1ZTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICByZXR1cm4gdHJpdmlhbFByb21pc2UocmVzdWx0KTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgZXhwb3J0IGNsYXNzIFNldFZhbHVlIGV4dGVuZHMgT3BlcmF0aW9uIHtcclxuICAgICAgICB2YXJpYWJsZU5hbWU6IHN0cmluZztcclxuICAgICAgICBwYXRoRXhwcjogc3RyaW5nO1xyXG4gICAgICAgIHZhbHVlRXhwciA9IFwiXCI7XHJcbiAgICAgICAgbGVmdEV4cHIgPSBcIlwiO1xyXG5cclxuICAgICAgICBwcml2YXRlIHBhdGg7XHJcbiAgICAgICAgcHJpdmF0ZSBzZXR0ZXI7XHJcblxyXG4gICAgICAgIGNvbnN0cnVjdG9yKHBhcmFtcz86IGFueSkge1xyXG4gICAgICAgICAgICBzdXBlcigpO1xyXG5cclxuICAgICAgICAgICAgaWYocGFyYW1zKSB7XHJcbiAgICAgICAgICAgICAgICAkLmVhY2gocGFyYW1zLCAobmFtZSwgdmFsdWUpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzW25hbWVdID0gdmFsdWUgfHwgdGhpc1tuYW1lXTtcclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBydW4odmFyaWFibGVzOiB7IFtrZXk6IHN0cmluZ106IFZhcmlhYmxlIH0sIGZ1bmN0aW9uczogYW55KTogSlF1ZXJ5UHJvbWlzZTxSZXN1bHQ+IHtcclxuICAgICAgICAgICAgdmFyIHBhdGhFeHByOiBzdHJpbmc7XHJcbiAgICAgICAgICAgIGlmKHRoaXMubGVmdEV4cHIpIHtcclxuICAgICAgICAgICAgICAgIHBhdGhFeHByID0gdGhpcy5sZWZ0RXhwcjtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIGlmKHRoaXMudmFyaWFibGVOYW1lKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS53YXJuKFwiU2V0VmFsdWU6IHZhcmlhYmxlTmFtZSBhbmQgcGF0aEV4cHIgYXJlIG9ic29sZXRlLiBVc2UgbGVmdEV4cHIgaW5zdGVhZFwiKTtcclxuICAgICAgICAgICAgICAgICAgICBwYXRoRXhwciA9IHRoaXMucGF0aEV4cHIgPyB0aGlzLnZhcmlhYmxlTmFtZSArIFwiLlwiICsgdGhpcy5ldmFsKHRoaXMucGF0aEV4cHIsIHZhcmlhYmxlcywgZnVuY3Rpb25zKSA6IHRoaXMudmFyaWFibGVOYW1lO1xyXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gcmVqZWN0UHJvbWlzZShcIlNldFZhbHVlOiBsZWZ0RXhwciBtdXN0IGJlIGRlZmluZWRcIik7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgaWYodGhpcy52YWx1ZUV4cHIgPT09IFwiXCIpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiByZWplY3RQcm9taXNlKFwiU2V0VmFsdWU6IHZhbHVlRXhwciBtdXN0IGJlIGRlZmluZWRcIik7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIHZhciB2YWx1ZSA9IHRoaXMuZXZhbCh0aGlzLnZhbHVlRXhwciwgdmFyaWFibGVzLCBmdW5jdGlvbnMpLFxyXG4gICAgICAgICAgICAgICAgcGF0aCA9IHRoaXMucHJlcGFyZUV4cHIocGF0aEV4cHIsIHZhcmlhYmxlcywgZnVuY3Rpb25zKTtcclxuICAgICAgICAgICAgdGhpcy5hc3NpZ25WYWx1ZShwYXRoLCB2YXJpYWJsZXMsIHZhbHVlKTtcclxuICAgICAgICAgICAgcmV0dXJuIHRyaXZpYWxQcm9taXNlKCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBwcmVwYXJlRXhwcihleHByOiBzdHJpbmcsIHZhcmlhYmxlczogeyBba2V5OiBzdHJpbmddOiBWYXJpYWJsZSB9LCBmdW5jdGlvbnM6IGFueSkge1xyXG4gICAgICAgICAgICB2YXIgYnJhY2tldEluZGV4ID0gZXhwci5pbmRleE9mKFwiW1wiKSxcclxuICAgICAgICAgICAgICAgIGNsb3NlQnJhY2tldEluZGV4LFxyXG4gICAgICAgICAgICAgICAgcmVzdWx0ID0gYnJhY2tldEluZGV4ID4gMCA/IGV4cHIuc3Vic3RyKDAsIGJyYWNrZXRJbmRleCkgOiBleHByLFxyXG4gICAgICAgICAgICAgICAgYnJhY2tldENvbnRlbnRzO1xyXG4gICAgICAgICAgICB3aGlsZShicmFja2V0SW5kZXggPiAwKSB7XHJcbiAgICAgICAgICAgICAgICBjbG9zZUJyYWNrZXRJbmRleCA9IGV4cHIuaW5kZXhPZihcIl1cIiwgYnJhY2tldEluZGV4KTtcclxuICAgICAgICAgICAgICAgIGJyYWNrZXRDb250ZW50cyA9IGV4cHIuc3Vic3RyaW5nKGJyYWNrZXRJbmRleCArIDEsIGNsb3NlQnJhY2tldEluZGV4KS50cmltKCk7XHJcbiAgICAgICAgICAgICAgICByZXN1bHQgKz0gXCIuXCIgKyB0aGlzLmV2YWwoYnJhY2tldENvbnRlbnRzLCB2YXJpYWJsZXMsIGZ1bmN0aW9ucyk7XHJcbiAgICAgICAgICAgICAgICBicmFja2V0SW5kZXggPSBleHByLmluZGV4T2YoXCJbXCIsIGNsb3NlQnJhY2tldEluZGV4KTtcclxuICAgICAgICAgICAgICAgIHJlc3VsdCArPSBleHByLnN1YnN0cmluZyhjbG9zZUJyYWNrZXRJbmRleCArIDEsIGJyYWNrZXRJbmRleCA+IDAgPyBicmFja2V0SW5kZXggOiB1bmRlZmluZWQpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBhc3NpZ25WYWx1ZShwYXRoOiBzdHJpbmcsIHZhcmlhYmxlczogeyBba2V5OiBzdHJpbmddOiBWYXJpYWJsZSB9LCB2YWx1ZTogYW55KSB7XHJcbiAgICAgICAgICAgIGlmKHZhcmlhYmxlc1twYXRoXSkge1xyXG4gICAgICAgICAgICAgICAgdmFyaWFibGVzW3BhdGhdLnZhbHVlID0gdmFsdWU7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgZG90SW5kZXggPSBwYXRoLmluZGV4T2YoXCIuXCIpO1xyXG4gICAgICAgICAgICAgICAgdmFyIHZhcmlhYmxlTmFtZSA9IHBhdGguc3Vic3RyaW5nKDAsIGRvdEluZGV4KTtcclxuICAgICAgICAgICAgICAgIHBhdGggPSBwYXRoLnN1YnN0cihkb3RJbmRleCArIDEpO1xyXG4gICAgICAgICAgICAgICAgaWYocGF0aCAhPT0gdGhpcy5wYXRoKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zZXR0ZXIgPSBjb21waWxlU2V0dGVyKHBhdGgpO1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMucGF0aCA9IHBhdGg7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB0aGlzLnNldHRlcih2YXJpYWJsZXNbdmFyaWFibGVOYW1lXS52YWx1ZSwgdmFsdWUpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGV4cG9ydCBjbGFzcyBDcmVhdGUgZXh0ZW5kcyBPcGVyYXRpb24ge1xyXG4gICAgICAgIHZhcmlhYmxlTmFtZSA9IFwiXCI7XHJcbiAgICAgICAgc3RvcmVFeHByID0gXCJcIjtcclxuICAgICAgICBzdG9yZUlkID0gXCJcIjtcclxuXHJcbiAgICAgICAgY29uc3RydWN0b3IocGFyYW1zPzogeyB2YXJpYWJsZU5hbWU6IHN0cmluZzsgc3RvcmVJZDogc3RyaW5nOyB9KSB7XHJcbiAgICAgICAgICAgIHN1cGVyKCk7XHJcblxyXG4gICAgICAgICAgICBpZihwYXJhbXMpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMudmFyaWFibGVOYW1lID0gcGFyYW1zLnZhcmlhYmxlTmFtZTtcclxuICAgICAgICAgICAgICAgIHRoaXMuc3RvcmVJZCA9IHBhcmFtcy5zdG9yZUlkO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBydW4odmFyaWFibGVzOiB7IFtrZXk6IHN0cmluZ106IFZhcmlhYmxlIH0sXHJcbiAgICAgICAgICAgIGZ1bmN0aW9uczogeyBnZXREYXRhU3RvcmVDb25maWc6IChzdG9yZUlkOiBzdHJpbmcpID0+IElEYXRhU3RvcmUgfSk6IEpRdWVyeVByb21pc2U8UmVzdWx0PiB7XHJcbiAgICAgICAgICAgIHZhciBzdG9yZUlkID0gISF0aGlzLnN0b3JlRXhwciA/IHRoaXMuZXZhbCh0aGlzLnN0b3JlRXhwciwgdmFyaWFibGVzLCBmdW5jdGlvbnMpIDogdGhpcy5zdG9yZUlkLFxyXG4gICAgICAgICAgICAgICAgZGF0YVN0b3JlQ29uZmlnID0gZnVuY3Rpb25zLmdldERhdGFTdG9yZUNvbmZpZyhzdG9yZUlkKSxcclxuICAgICAgICAgICAgICAgIHJlc3VsdCA9IHt9O1xyXG4gICAgICAgICAgICBpZihkYXRhU3RvcmVDb25maWcuZmllbGRzKSB7XHJcbiAgICAgICAgICAgICAgICBkYXRhU3RvcmVDb25maWcuZmllbGRzLmZvckVhY2goZmllbGQgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdFtmaWVsZC5uYW1lXSA9IHVuZGVmaW5lZDtcclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHZhcmlhYmxlc1t0aGlzLnZhcmlhYmxlTmFtZV0gPSBuZXcgVmFyaWFibGUoeyBuYW1lOiB0aGlzLnZhcmlhYmxlTmFtZSwgdmFsdWU6IHJlc3VsdCB9KTtcclxuICAgICAgICAgICAgcmV0dXJuIHRyaXZpYWxQcm9taXNlKCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGV4cG9ydCBjbGFzcyBBZGRUb0xpc3QgZXh0ZW5kcyBPcGVyYXRpb24ge1xyXG4gICAgICAgIHZhcmlhYmxlTmFtZSA9IFwiXCI7XHJcbiAgICAgICAgdmFsdWUgPSBudWxsO1xyXG4gICAgICAgIGV4cHJlc3Npb24gPSBcIlwiO1xyXG5cclxuICAgICAgICBjb25zdHJ1Y3RvcihwYXJhbXM/OiB7IHZhcmlhYmxlTmFtZTogc3RyaW5nOyB2YWx1ZT86IGFueTsgZXhwcj86IHN0cmluZzsgfSkge1xyXG4gICAgICAgICAgICBzdXBlcigpO1xyXG5cclxuICAgICAgICAgICAgaWYocGFyYW1zKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnZhcmlhYmxlTmFtZSA9IHBhcmFtcy52YXJpYWJsZU5hbWU7XHJcbiAgICAgICAgICAgICAgICBpZihwYXJhbXMuZXhwcikge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZXhwcmVzc2lvbiA9IHBhcmFtcy5leHByO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy52YWx1ZSA9IHBhcmFtcy52YWx1ZTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcnVuKHZhcmlhYmxlczogeyBba2V5OiBzdHJpbmddOiBWYXJpYWJsZSB9LCBmdW5jdGlvbnM6IGFueSk6IEpRdWVyeVByb21pc2U8UmVzdWx0PiB7XHJcbiAgICAgICAgICAgIHZhciBsaXN0OiBhbnlbXSA9IHZhcmlhYmxlc1t0aGlzLnZhcmlhYmxlTmFtZV0udmFsdWUsXHJcbiAgICAgICAgICAgICAgICB2YWx1ZSA9IHRoaXMuZXhwcmVzc2lvbiA/IHRoaXMuZXZhbCh0aGlzLmV4cHJlc3Npb24sIHZhcmlhYmxlcywgZnVuY3Rpb25zKSA6IHRoaXMudmFsdWU7XHJcbiAgICAgICAgICAgIGxpc3QucHVzaCh2YWx1ZSk7XHJcbiAgICAgICAgICAgIHJldHVybiB0cml2aWFsUHJvbWlzZSgpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBleHBvcnQgaW50ZXJmYWNlIElJbnNlcnRUb0xpc3Qge1xyXG4gICAgICAgIHZhcmlhYmxlTmFtZTogc3RyaW5nO1xyXG4gICAgICAgIHZhbHVlRXhwcjogc3RyaW5nO1xyXG4gICAgICAgIGluZGV4RXhwcj86IHN0cmluZztcclxuICAgIH1cclxuXHJcbiAgICBleHBvcnQgY2xhc3MgSW5zZXJ0VG9MaXN0IGV4dGVuZHMgT3BlcmF0aW9uIGltcGxlbWVudHMgSUluc2VydFRvTGlzdCB7XHJcbiAgICAgICAgdmFyaWFibGVOYW1lID0gXCJcIjtcclxuICAgICAgICB2YWx1ZUV4cHIgPSBcIlwiO1xyXG4gICAgICAgIGluZGV4RXhwciA9IFwiXCI7XHJcblxyXG4gICAgICAgIGNvbnN0cnVjdG9yKHBhcmFtcz86IElJbnNlcnRUb0xpc3QpIHtcclxuICAgICAgICAgICAgc3VwZXIoKTtcclxuICAgICAgICAgICAgJC5leHRlbmQodGhpcywgcGFyYW1zKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJ1bih2YXJpYWJsZXM6IHsgW2tleTogc3RyaW5nXTogVmFyaWFibGUgfSwgZnVuY3Rpb25zOiBhbnkpOiBKUXVlcnlQcm9taXNlPFJlc3VsdD4ge1xyXG4gICAgICAgICAgICBpZighdGhpcy52YXJpYWJsZU5hbWUpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiByZWplY3RQcm9taXNlKFwiSW5zZXJ0VG9MaXN0OiBpbnZhbGlkIHZhcmlhYmxlIG5hbWVcIik7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgaWYoIXRoaXMudmFsdWVFeHByKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gcmVqZWN0UHJvbWlzZShcIkluc2VydFRvTGlzdDogaW52YWxpZCB2YWx1ZSBleHByZXNzaW9uXCIpO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICB2YXIgbGlzdDogYW55W10gPSB2YXJpYWJsZXNbdGhpcy52YXJpYWJsZU5hbWVdLnZhbHVlO1xyXG4gICAgICAgICAgICBpZighJC5pc0FycmF5KGxpc3QpKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gcmVqZWN0UHJvbWlzZShcIkluc2VydFRvTGlzdDogdmFyaWFibGUgc2hvdWxkIGJlIGFycmF5XCIpO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICB2YXIgdmFsdWUgPSB0aGlzLmV2YWwodGhpcy52YWx1ZUV4cHIsIHZhcmlhYmxlcywgZnVuY3Rpb25zKSxcclxuICAgICAgICAgICAgICAgIGluZGV4ID0gdGhpcy5pbmRleEV4cHIgPyB0aGlzLmV2YWwodGhpcy5pbmRleEV4cHIsIHZhcmlhYmxlcywgZnVuY3Rpb25zKSA6IHVuZGVmaW5lZDtcclxuICAgICAgICAgICAgaWYoaW5kZXggPj0gMCkge1xyXG4gICAgICAgICAgICAgICAgbGlzdC5zcGxpY2UoaW5kZXgsIDAsIHZhbHVlKTtcclxuICAgICAgICAgICAgICAgIHJldHVybiB0cml2aWFsUHJvbWlzZSgpO1xyXG4gICAgICAgICAgICB9IGVsc2UgaWYoaW5kZXggPT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICAgICAgbGlzdC5wdXNoKHZhbHVlKTtcclxuICAgICAgICAgICAgICAgIHJldHVybiB0cml2aWFsUHJvbWlzZSgpO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlamVjdFByb21pc2UoXCJJbnNlcnRUb0xpc3Q6IGluZGV4IHNob3VsZCBiZSAwIG9yIGdyZWF0ZXIgdGhhbiAwXCIpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGV4cG9ydCBjbGFzcyBSZW1vdmVGcm9tTGlzdEJ5VmFsdWUgZXh0ZW5kcyBPcGVyYXRpb24ge1xyXG4gICAgICAgIHZhcmlhYmxlTmFtZSA9IFwiXCI7XHJcbiAgICAgICAgdmFsdWVFeHByID0gXCJcIjtcclxuXHJcbiAgICAgICAgY29uc3RydWN0b3IocGFyYW1zPzogeyB2YXJpYWJsZU5hbWU/OiBzdHJpbmc7IHZhbHVlRXhwcj86IHN0cmluZzsgaW5kZXg/OiBudW1iZXI7IH0pIHtcclxuICAgICAgICAgICAgc3VwZXIoKTtcclxuXHJcbiAgICAgICAgICAgIGlmKHBhcmFtcykge1xyXG4gICAgICAgICAgICAgICAgJC5lYWNoKHBhcmFtcywgKG5hbWUsIHZhbHVlKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpc1tuYW1lXSA9IHZhbHVlO1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJ1bih2YXJpYWJsZXM6IHsgW2tleTogc3RyaW5nXTogVmFyaWFibGUgfSwgZnVuY3Rpb25zOiBhbnkpOiBKUXVlcnlQcm9taXNlPFJlc3VsdD4ge1xyXG4gICAgICAgICAgICB2YXIgdmFyaWFibGUgPSB2YXJpYWJsZXNbdGhpcy52YXJpYWJsZU5hbWVdLFxyXG4gICAgICAgICAgICAgICAgbGlzdDogYW55W10gPSB2YXJpYWJsZS52YWx1ZSxcclxuICAgICAgICAgICAgICAgIHZhbHVlLFxyXG4gICAgICAgICAgICAgICAgaW5kZXg7XHJcbiAgICAgICAgICAgIGlmKHRoaXMudmFsdWVFeHByKSB7XHJcbiAgICAgICAgICAgICAgICB2YWx1ZSA9IHRoaXMuZXZhbCh0aGlzLnZhbHVlRXhwciwgdmFyaWFibGVzLCBmdW5jdGlvbnMpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGluZGV4ID0gbGlzdC5pbmRleE9mKHZhbHVlKTtcclxuICAgICAgICAgICAgaWYoaW5kZXggPj0gMCkge1xyXG4gICAgICAgICAgICAgICAgbGlzdC5zcGxpY2UoaW5kZXgsIDEpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJldHVybiB0cml2aWFsUHJvbWlzZSgpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBleHBvcnQgY2xhc3MgUmVtb3ZlRnJvbUxpc3RCeUluZGV4IGV4dGVuZHMgT3BlcmF0aW9uIHtcclxuICAgICAgICB2YXJpYWJsZU5hbWUgPSBcIlwiO1xyXG4gICAgICAgIGluZGV4ID0gLTE7XHJcblxyXG4gICAgICAgIGNvbnN0cnVjdG9yKHBhcmFtcz86IHsgdmFyaWFibGVOYW1lPzogc3RyaW5nOyB2YWx1ZUV4cHI/OiBzdHJpbmc7IGluZGV4PzogbnVtYmVyOyB9KSB7XHJcbiAgICAgICAgICAgIHN1cGVyKCk7XHJcblxyXG4gICAgICAgICAgICBpZihwYXJhbXMpIHtcclxuICAgICAgICAgICAgICAgICQuZWFjaChwYXJhbXMsIChuYW1lLCB2YWx1ZSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXNbbmFtZV0gPSB2YWx1ZTtcclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBydW4odmFyaWFibGVzOiB7IFtrZXk6IHN0cmluZ106IFZhcmlhYmxlIH0sIGZ1bmN0aW9uczogYW55KTogSlF1ZXJ5UHJvbWlzZTxSZXN1bHQ+IHtcclxuICAgICAgICAgICAgdmFyIHZhcmlhYmxlID0gdmFyaWFibGVzW3RoaXMudmFyaWFibGVOYW1lXSxcclxuICAgICAgICAgICAgICAgIGxpc3Q6IGFueVtdID0gdmFyaWFibGUudmFsdWUsXHJcbiAgICAgICAgICAgICAgICBpbmRleCA9IHRoaXMuaW5kZXg7XHJcbiAgICAgICAgICAgIGlmKGluZGV4ID49IDApIHtcclxuICAgICAgICAgICAgICAgIGxpc3Quc3BsaWNlKHRoaXMuaW5kZXgsIDEpO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRyaXZpYWxQcm9taXNlKCk7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gcmVqZWN0UHJvbWlzZShcIlJlbW92ZUZyb21MaXN0QnlJbmRleDogaW5kZXggc2hvdWxkIGJlIDAgb3IgZ3JlYXRlciB0aGFuIDBcIik7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgZXhwb3J0IGNsYXNzIENvdW50TGlzdCBleHRlbmRzIE9wZXJhdGlvbiB7XHJcbiAgICAgICAgZXhwciA9IFwiXCI7XHJcbiAgICAgICAgcmVzdWx0VmFyaWFibGVOYW1lID0gXCJcIjtcclxuXHJcbiAgICAgICAgY29uc3RydWN0b3IocGFyYW1zPzogeyBleHByOiBzdHJpbmc7IHJlc3VsdFZhcmlhYmxlTmFtZT86IHN0cmluZzsgfSkge1xyXG4gICAgICAgICAgICBzdXBlcigpO1xyXG5cclxuICAgICAgICAgICAgaWYocGFyYW1zKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmV4cHIgPSBwYXJhbXMuZXhwcjtcclxuICAgICAgICAgICAgICAgIHRoaXMucmVzdWx0VmFyaWFibGVOYW1lID0gcGFyYW1zLnJlc3VsdFZhcmlhYmxlTmFtZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcnVuKHZhcmlhYmxlczogeyBba2V5OiBzdHJpbmddOiBWYXJpYWJsZSB9LCBmdW5jdGlvbnM6IGFueSk6IEpRdWVyeVByb21pc2U8UmVzdWx0PiB7XHJcbiAgICAgICAgICAgIHZhciBsaXN0OiBhbnkgPSB0aGlzLmV2YWwodGhpcy5leHByLCB2YXJpYWJsZXMsIGZ1bmN0aW9ucyksXHJcbiAgICAgICAgICAgICAgICBsZW4gPSBBcnJheS5pc0FycmF5KGxpc3QpID8gbGlzdC5sZW5ndGggOiBPYmplY3Qua2V5cyhsaXN0KS5sZW5ndGg7XHJcbiAgICAgICAgICAgIHZhcmlhYmxlc1t0aGlzLnJlc3VsdFZhcmlhYmxlTmFtZV0udmFsdWUgPSBsZW47XHJcbiAgICAgICAgICAgIHJldHVybiB0cml2aWFsUHJvbWlzZSgpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBleHBvcnQgZW51bSBBZ2dyZWdhdGVUeXBlIHtcclxuICAgICAgICBNaW4sXHJcbiAgICAgICAgTWF4LFxyXG4gICAgICAgIFN1bSxcclxuICAgICAgICBBdmVyYWdlXHJcbiAgICB9XHJcblxyXG4gICAgZXhwb3J0IGludGVyZmFjZSBJQWdncmVnYXRlTGlzdFBhcmFtZXRlcnMge1xyXG4gICAgICAgIHZhcmlhYmxlTmFtZTogc3RyaW5nO1xyXG4gICAgICAgIHR5cGU/OiBBZ2dyZWdhdGVUeXBlO1xyXG4gICAgICAgIHJlc3VsdFZhcmlhYmxlTmFtZT86IHN0cmluZztcclxuICAgICAgICBwcm9wZXJ0eU5hbWU/OiBzdHJpbmc7XHJcbiAgICAgICAgc2VlZD86IG51bWJlcjtcclxuICAgIH1cclxuXHJcbiAgICBleHBvcnQgY2xhc3MgQWdncmVnYXRlTGlzdCBleHRlbmRzIE9wZXJhdGlvbiB7XHJcbiAgICAgICAgdHlwZTogQWdncmVnYXRlVHlwZSA9IEFnZ3JlZ2F0ZVR5cGUuU3VtO1xyXG4gICAgICAgIHZhcmlhYmxlTmFtZSA9IFwiXCI7XHJcbiAgICAgICAgcmVzdWx0VmFyaWFibGVOYW1lID0gXCJcIjtcclxuICAgICAgICBwcm9wZXJ0eU5hbWUgPSBcIlwiO1xyXG4gICAgICAgIHNlZWQgPSAwO1xyXG5cclxuICAgICAgICBjb25zdHJ1Y3RvcihwYXJhbXM/OiBJQWdncmVnYXRlTGlzdFBhcmFtZXRlcnMpIHtcclxuICAgICAgICAgICAgc3VwZXIoKTtcclxuXHJcbiAgICAgICAgICAgIGlmKHBhcmFtcykge1xyXG4gICAgICAgICAgICAgICAgJC5lYWNoKHBhcmFtcywgKG5hbWUsIHZhbHVlKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpc1tuYW1lXSA9IHZhbHVlO1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJ1bih2YXJpYWJsZXM6IHsgW2tleTogc3RyaW5nXTogVmFyaWFibGUgfSwgZnVuY3Rpb25zOiBhbnkpOiBKUXVlcnlQcm9taXNlPFJlc3VsdD4ge1xyXG4gICAgICAgICAgICB2YXIgYWdncmVnYXRvcjogKGFjY3VtdWxhdG9yOiBudW1iZXIsIHZhbHVlOiBudW1iZXIpID0+IG51bWJlcixcclxuICAgICAgICAgICAgICAgIHJlc3VsdFNlbGVjdG9yOiAoYWNjdW11bGF0b3I6IG51bWJlciwgbGlzdDogYW55W10pID0+IG51bWJlcixcclxuICAgICAgICAgICAgICAgIHZhbHVlU2VsZWN0b3IgPSBpdGVtID0+IHRoaXMucHJvcGVydHlOYW1lID8gaXRlbVt0aGlzLnByb3BlcnR5TmFtZV0gOiBpdGVtLFxyXG4gICAgICAgICAgICAgICAgYWNjdW11bGF0b3IsXHJcbiAgICAgICAgICAgICAgICBsaXN0OiBhbnlbXSA9IHZhcmlhYmxlc1t0aGlzLnZhcmlhYmxlTmFtZV0udmFsdWU7XHJcblxyXG4gICAgICAgICAgICBpZih0eXBlb2YgdmFyaWFibGVzW3RoaXMucmVzdWx0VmFyaWFibGVOYW1lXSA9PT0gXCJ1bmRlZmluZWRcIikge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlamVjdFByb21pc2UoXCJBZ2dyZWdhdGVMaXN0OiBpbnZhbGlkIHJlc3VsdFZhcmlhYmxlTmFtZVwiKTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgaWYobGlzdC5sZW5ndGggPT09IDApIHtcclxuICAgICAgICAgICAgICAgIHZhcmlhYmxlc1t0aGlzLnJlc3VsdFZhcmlhYmxlTmFtZV0udmFsdWUgPSBudWxsO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRyaXZpYWxQcm9taXNlKCk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIHN3aXRjaCh0aGlzLnR5cGUpIHtcclxuICAgICAgICAgICAgICAgIGNhc2UgQWdncmVnYXRlVHlwZS5NaW46XHJcbiAgICAgICAgICAgICAgICAgICAgYWdncmVnYXRvciA9IChhY2N1bXVsYXRvciwgdmFsdWUpID0+IHZhbHVlIDwgYWNjdW11bGF0b3IgPyB2YWx1ZSA6IGFjY3VtdWxhdG9yO1xyXG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdFNlbGVjdG9yID0gKGFjY3VtdWxhdG9yLCBsaXN0KSA9PiBhY2N1bXVsYXRvcjtcclxuICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgIGNhc2UgQWdncmVnYXRlVHlwZS5NYXg6XHJcbiAgICAgICAgICAgICAgICAgICAgYWdncmVnYXRvciA9IChhY2N1bXVsYXRvciwgdmFsdWUpID0+IHZhbHVlID4gYWNjdW11bGF0b3IgPyB2YWx1ZSA6IGFjY3VtdWxhdG9yO1xyXG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdFNlbGVjdG9yID0gKGFjY3VtdWxhdG9yLCBsaXN0KSA9PiBhY2N1bXVsYXRvcjtcclxuICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgIGNhc2UgQWdncmVnYXRlVHlwZS5TdW06XHJcbiAgICAgICAgICAgICAgICAgICAgYWdncmVnYXRvciA9IChhY2N1bXVsYXRvciwgdmFsdWUpID0+IGFjY3VtdWxhdG9yICsgdmFsdWU7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0U2VsZWN0b3IgPSAoYWNjdW11bGF0b3IsIGxpc3QpID0+IGFjY3VtdWxhdG9yO1xyXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgY2FzZSBBZ2dyZWdhdGVUeXBlLkF2ZXJhZ2U6XHJcbiAgICAgICAgICAgICAgICAgICAgYWdncmVnYXRvciA9IChhY2N1bXVsYXRvciwgdmFsdWUpID0+IGFjY3VtdWxhdG9yICsgdmFsdWU7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0U2VsZWN0b3IgPSAoYWNjdW11bGF0b3IsIGxpc3QpID0+IGFjY3VtdWxhdG9yIC8gbGlzdC5sZW5ndGg7XHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiByZWplY3RQcm9taXNlKFwiQWdncmVnYXRlTGlzdDogaW52YWxpZCBhZ2dyZWdhdGUgZnVuY3Rpb25cIik7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGFjY3VtdWxhdG9yID0gdGhpcy5zZWVkO1xyXG4gICAgICAgICAgICBsaXN0LmZvckVhY2goaXRlbSA9PiB7XHJcbiAgICAgICAgICAgICAgICBhY2N1bXVsYXRvciA9IGFnZ3JlZ2F0b3IoYWNjdW11bGF0b3IsIHZhbHVlU2VsZWN0b3IoaXRlbSkpO1xyXG4gICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgIHZhcmlhYmxlc1t0aGlzLnJlc3VsdFZhcmlhYmxlTmFtZV0udmFsdWUgPSByZXN1bHRTZWxlY3RvcihhY2N1bXVsYXRvciwgbGlzdCk7XHJcbiAgICAgICAgICAgIHJldHVybiB0cml2aWFsUHJvbWlzZSgpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBleHBvcnQgY2xhc3MgU29ydExpc3QgZXh0ZW5kcyBPcGVyYXRpb24ge1xyXG4gICAgICAgIHZhcmlhYmxlTmFtZSA9IFwiXCI7XHJcbiAgICAgICAgZGVzYyA9IGZhbHNlO1xyXG4gICAgICAgIHByb3BlcnR5TmFtZSA9IFwiXCI7XHJcblxyXG4gICAgICAgIGNvbnN0cnVjdG9yKHBhcmFtcz86IGFueSkge1xyXG4gICAgICAgICAgICBzdXBlcigpO1xyXG5cclxuICAgICAgICAgICAgaWYocGFyYW1zKSB7XHJcbiAgICAgICAgICAgICAgICAkLmVhY2gocGFyYW1zLCAobmFtZSwgdmFsKSA9PiB0aGlzW25hbWVdID0gdmFsKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcnVuKHZhcmlhYmxlczogeyBba2V5OiBzdHJpbmddOiBWYXJpYWJsZSB9LCBmdW5jdGlvbnM6IGFueSk6IEpRdWVyeVByb21pc2U8UmVzdWx0PiB7XHJcbiAgICAgICAgICAgIHZhciBsaXN0OiBhbnlbXSA9IHZhcmlhYmxlc1t0aGlzLnZhcmlhYmxlTmFtZV0udmFsdWUsXHJcbiAgICAgICAgICAgICAgICBjb21wYXJlOiAoYSwgYikgPT4gbnVtYmVyO1xyXG4gICAgICAgICAgICBpZighdGhpcy5wcm9wZXJ0eU5hbWUpIHtcclxuICAgICAgICAgICAgICAgIGlmKHRoaXMuZGVzYykge1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbXBhcmUgPSAoYSwgYikgPT4gYiAtIGE7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBpZih0aGlzLmRlc2MpIHtcclxuICAgICAgICAgICAgICAgICAgICBjb21wYXJlID0gKGEsIGIpID0+IGJbdGhpcy5wcm9wZXJ0eU5hbWVdIC0gYVt0aGlzLnByb3BlcnR5TmFtZV07XHJcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbXBhcmUgPSAoYSwgYikgPT4gYVt0aGlzLnByb3BlcnR5TmFtZV0gLSBiW3RoaXMucHJvcGVydHlOYW1lXTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBsaXN0LnNvcnQoY29tcGFyZSk7XHJcbiAgICAgICAgICAgIHJldHVybiB0cml2aWFsUHJvbWlzZSgpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBleHBvcnQgY2xhc3MgTG9vcCBleHRlbmRzIE9wZXJhdGlvbiB7XHJcbiAgICAgICAgdmFsdWVFeHByID0gXCJcIjtcclxuICAgICAgICBpbmRleE5hbWUgPSBcImxvb3BJbmRleFwiO1xyXG4gICAgICAgIHZhbHVlTmFtZSA9IFwibG9vcFZhbHVlXCI7XHJcbiAgICAgICAgY2FsbHM6IE9wZXJhdGlvbltdID0gW107XHJcblxyXG4gICAgICAgIGNvbnN0cnVjdG9yKHBhcmFtcz86IGFueSkge1xyXG4gICAgICAgICAgICBzdXBlcigpO1xyXG5cclxuICAgICAgICAgICAgaWYocGFyYW1zKSB7XHJcbiAgICAgICAgICAgICAgICAkLmVhY2gocGFyYW1zLCAobmFtZSwgdmFsdWUpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICBpZih2YWx1ZSAhPT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXNbbmFtZV0gPSB2YWx1ZTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcnVuKHZhcmlhYmxlczogeyBba2V5OiBzdHJpbmddOiBWYXJpYWJsZSB9LCBmdW5jdGlvbnM6IGFueSk6IEpRdWVyeVByb21pc2U8UmVzdWx0PiB7XHJcbiAgICAgICAgICAgIHZhciB2YWx1ZSA9IHRoaXMuZXZhbCh0aGlzLnZhbHVlRXhwciwgdmFyaWFibGVzLCBmdW5jdGlvbnMpO1xyXG4gICAgICAgICAgICBpZih0eXBlb2YgdmFsdWUgIT09IFwib2JqZWN0XCIpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiByZWplY3RQcm9taXNlKFwiTG9vcDogcGFzc2VkIHZhbHVlIHNob3VsZCBiZSBhcnJheSBvciBvYmplY3RcIik7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIHZhciBpc0FycmF5ID0gQXJyYXkuaXNBcnJheSh2YWx1ZSksXHJcbiAgICAgICAgICAgICAgICBvYmplY3RLZXlzID0gaXNBcnJheSA/IG51bGwgOiBPYmplY3Qua2V5cyh2YWx1ZSksXHJcbiAgICAgICAgICAgICAgICBpbmRleCA9IDAsXHJcbiAgICAgICAgICAgICAgICBsZW5ndGggPSBpc0FycmF5ID8gdmFsdWUubGVuZ3RoIDogb2JqZWN0S2V5cy5sZW5ndGg7XHJcbiAgICAgICAgICAgIGlmKGxlbmd0aCA9PT0gMCkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRyaXZpYWxQcm9taXNlKCk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIHZhciBsb2NhbFZhcnM6IHsgW2tleTogc3RyaW5nXTogVmFyaWFibGUgfSA9IHt9O1xyXG4gICAgICAgICAgICAkLmVhY2godmFyaWFibGVzLCAobmFtZSwgdmFyaWFibGUpID0+IHtcclxuICAgICAgICAgICAgICAgIGxvY2FsVmFyc1tuYW1lXSA9IHZhcmlhYmxlO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgdmFyIGluZGV4VmFyID0gbG9jYWxWYXJzW3RoaXMuaW5kZXhOYW1lXSA9IG5ldyBWYXJpYWJsZSh7IG5hbWU6IHRoaXMuaW5kZXhOYW1lLCB2YWx1ZTogdW5kZWZpbmVkIH0pLFxyXG4gICAgICAgICAgICAgICAgdmFsdWVWYXIgPSBsb2NhbFZhcnNbdGhpcy52YWx1ZU5hbWVdID0gbmV3IFZhcmlhYmxlKHsgbmFtZTogdGhpcy52YWx1ZU5hbWUsIHZhbHVlOiB1bmRlZmluZWQgfSksXHJcbiAgICAgICAgICAgICAgICBkID0gJC5EZWZlcnJlZCgpLFxyXG4gICAgICAgICAgICAgICAgbG9vcEZuID0gKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIGlmKGluZGV4ID09PSBsZW5ndGgpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgZC5yZXNvbHZlKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgaW5kZXhWYXIudmFsdWUgPSBpc0FycmF5ID8gaW5kZXggOiBvYmplY3RLZXlzW2luZGV4XTtcclxuICAgICAgICAgICAgICAgICAgICB2YWx1ZVZhci52YWx1ZSA9IHZhbHVlW2luZGV4VmFyLnZhbHVlXTtcclxuICAgICAgICAgICAgICAgICAgICBPcGVyYXRpb24ucnVuKHRoaXMuY2FsbHMsIGxvY2FsVmFycywgZnVuY3Rpb25zKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAudGhlbigocmVzdWx0KSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZihyZXN1bHQgIT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmKHJlc3VsdC5mbG93ID09PSBGbG93LkJyZWFrKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGQucmVzb2x2ZSgpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmKHJlc3VsdC5mbG93ID09PSBGbG93LlJldHVybikge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkLnJlc29sdmUocmVzdWx0KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGluZGV4Kys7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb29wRm4oKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICBsb29wRm4oKTtcclxuICAgICAgICAgICAgcmV0dXJuIGQucHJvbWlzZSgpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBleHBvcnQgaW50ZXJmYWNlIElGb3JMb29wUGFyYW1ldGVycyB7XHJcbiAgICAgICAgaW5kZXhOYW1lPzogc3RyaW5nO1xyXG4gICAgICAgIHN0YXJ0SW5kZXhJbmNsdWRlZD86IG51bWJlcjtcclxuICAgICAgICBlbmRJbmRleEV4Y2x1ZGVkPzogbnVtYmVyO1xyXG4gICAgICAgIGNhbGxzPzogT3BlcmF0aW9uW107XHJcbiAgICB9XHJcblxyXG4gICAgdmFyIGRlZmF1bHRGb3JMb29wUGFyYW1ldGVyczogSUZvckxvb3BQYXJhbWV0ZXJzID0ge1xyXG4gICAgICAgIGluZGV4TmFtZTogXCJsb29wSW5kZXhcIixcclxuICAgICAgICBzdGFydEluZGV4SW5jbHVkZWQ6IDAsXHJcbiAgICAgICAgZW5kSW5kZXhFeGNsdWRlZDogMCxcclxuICAgICAgICBjYWxsczogW11cclxuICAgIH07XHJcblxyXG4gICAgZXhwb3J0IGNsYXNzIEZvckxvb3AgZXh0ZW5kcyBPcGVyYXRpb24gaW1wbGVtZW50cyBJRm9yTG9vcFBhcmFtZXRlcnMge1xyXG4gICAgICAgIGluZGV4TmFtZTogc3RyaW5nO1xyXG4gICAgICAgIHN0YXJ0SW5kZXhJbmNsdWRlZDogbnVtYmVyO1xyXG4gICAgICAgIGVuZEluZGV4RXhjbHVkZWQ6IG51bWJlcjtcclxuICAgICAgICBjYWxsczogT3BlcmF0aW9uW107XHJcblxyXG4gICAgICAgIGNvbnN0cnVjdG9yKHBhcmFtcz86IElGb3JMb29wUGFyYW1ldGVycykge1xyXG4gICAgICAgICAgICBzdXBlcigpO1xyXG4gICAgICAgICAgICAkLmV4dGVuZCh0aGlzLCBkZWZhdWx0Rm9yTG9vcFBhcmFtZXRlcnMsIHBhcmFtcyk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBydW4odmFyaWFibGVzOiB7IFtrZXk6IHN0cmluZ106IFZhcmlhYmxlIH0sIGZ1bmN0aW9uczogYW55KTogSlF1ZXJ5UHJvbWlzZTxSZXN1bHQ+IHtcclxuICAgICAgICAgICAgdmFyIHN0ZXAgPSB0aGlzLnN0YXJ0SW5kZXhJbmNsdWRlZCA8IHRoaXMuZW5kSW5kZXhFeGNsdWRlZCA/IDEgOiAtMSxcclxuICAgICAgICAgICAgICAgIGxvY2FsVmFyczogeyBba2V5OiBzdHJpbmddOiBWYXJpYWJsZSB9ID0gJC5leHRlbmQoe30sIHZhcmlhYmxlcyk7XHJcbiAgICAgICAgICAgIGxvY2FsVmFyc1t0aGlzLmluZGV4TmFtZV0gPSBsb2NhbFZhcnNbdGhpcy5pbmRleE5hbWVdIHx8IG5ldyBWYXJpYWJsZSh7IG5hbWU6IHRoaXMuaW5kZXhOYW1lLCB2YWx1ZTogdW5kZWZpbmVkIH0pO1xyXG5cclxuICAgICAgICAgICAgdmFyIGQgPSAkLkRlZmVycmVkKCksXHJcbiAgICAgICAgICAgICAgICBjb21wbGV0ZSA9ICgpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAkLmVhY2godmFyaWFibGVzLCAobmFtZSwgdmFsKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhcmlhYmxlc1tuYW1lXSA9IGxvY2FsVmFyc1tuYW1lXTtcclxuICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgICAgICBkLnJlc29sdmUoKTtcclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICBpbmRleCA9IHRoaXMuc3RhcnRJbmRleEluY2x1ZGVkLFxyXG4gICAgICAgICAgICAgICAgbG9vcEZuID0gKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIGlmKGluZGV4ID09PSB0aGlzLmVuZEluZGV4RXhjbHVkZWQpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29tcGxldGUoKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICBsb2NhbFZhcnNbdGhpcy5pbmRleE5hbWVdLnZhbHVlID0gaW5kZXg7XHJcbiAgICAgICAgICAgICAgICAgICAgT3BlcmF0aW9uLnJ1bih0aGlzLmNhbGxzLCBsb2NhbFZhcnMsIGZ1bmN0aW9ucylcclxuICAgICAgICAgICAgICAgICAgICAgICAgLnRoZW4ocmVzdWx0ID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmKHJlc3VsdCAhPT0gdW5kZWZpbmVkICYmIHJlc3VsdC5mbG93ID09PSBGbG93LkJyZWFrKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29tcGxldGUoKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbmRleCArPSBzdGVwO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9vcEZuKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgbG9vcEZuKCk7XHJcbiAgICAgICAgICAgIHJldHVybiBkLnByb21pc2UoKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgZXhwb3J0IGludGVyZmFjZSBJT3BlcmF0aW9uIHtcclxuICAgICAgICBfdHlwZTogc3RyaW5nO1xyXG4gICAgfVxyXG5cclxuICAgIGV4cG9ydCBpbnRlcmZhY2UgSVN3aXRjaCB7XHJcbiAgICAgICAgZXhwcjogc3RyaW5nO1xyXG4gICAgICAgIGNhc2VzOiBJU3dpdGNoQ2FzZVtdO1xyXG4gICAgICAgIG90aGVyd2lzZTogSU9wZXJhdGlvbltdO1xyXG4gICAgfVxyXG5cclxuICAgIGV4cG9ydCBpbnRlcmZhY2UgSVN3aXRjaENhc2Uge1xyXG4gICAgICAgIHZhbHVlRXhwcjogc3RyaW5nO1xyXG4gICAgICAgIGNhbGxzOiBJT3BlcmF0aW9uW107XHJcbiAgICB9XHJcblxyXG4gICAgZXhwb3J0IGNsYXNzIFN3aXRjaENhc2Uge1xyXG4gICAgICAgIHZhbHVlRXhwcjogc3RyaW5nO1xyXG4gICAgICAgIGNhbGxzOiBPcGVyYXRpb25bXSA9IFtdO1xyXG4gICAgfVxyXG5cclxuICAgIGV4cG9ydCBjbGFzcyBTd2l0Y2ggZXh0ZW5kcyBPcGVyYXRpb24ge1xyXG4gICAgICAgIGV4cHIgPSBcIlwiO1xyXG4gICAgICAgIGNhc2VzOiBTd2l0Y2hDYXNlW10gPSBbXTtcclxuICAgICAgICBvdGhlcndpc2U6IE9wZXJhdGlvbltdID0gW107XHJcblxyXG4gICAgICAgIGNvbnN0cnVjdG9yKHBhcmFtPzogeyBleHByPzogc3RyaW5nOyBjYXNlcz86IFN3aXRjaENhc2VbXTsgb3RoZXJ3aXNlPzogT3BlcmF0aW9uW10gfSkge1xyXG4gICAgICAgICAgICBzdXBlcigpO1xyXG5cclxuICAgICAgICAgICAgaWYocGFyYW0pIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuZXhwciA9IHBhcmFtLmV4cHIgfHwgXCJcIjtcclxuICAgICAgICAgICAgICAgIHRoaXMuY2FzZXMgPSBwYXJhbS5jYXNlcyB8fCBbXTtcclxuICAgICAgICAgICAgICAgIHRoaXMub3RoZXJ3aXNlID0gcGFyYW0ub3RoZXJ3aXNlIHx8IFtdO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBydW4odmFyaWFibGVzOiB7IFtrZXk6IHN0cmluZ106IGFueSB9LCBmdW5jdGlvbnM6IGFueSk6IEpRdWVyeVByb21pc2U8UmVzdWx0PiB7XHJcbiAgICAgICAgICAgIHZhciBleHByVmFsID0gdGhpcy5ldmFsKHRoaXMuZXhwciwgdmFyaWFibGVzLCBmdW5jdGlvbnMpLFxyXG4gICAgICAgICAgICAgICAgZDogSlF1ZXJ5UHJvbWlzZTxSZXN1bHQ+ID0gbnVsbDtcclxuICAgICAgICAgICAgdGhpcy5jYXNlcy5mb3JFYWNoKChjKSA9PiB7XHJcbiAgICAgICAgICAgICAgICB2YXIgY2FzZVZhbCA9IHRoaXMuZXZhbChjLnZhbHVlRXhwciwgdmFyaWFibGVzLCBmdW5jdGlvbnMpO1xyXG4gICAgICAgICAgICAgICAgaWYoY2FzZVZhbCA9PT0gZXhwclZhbCkge1xyXG4gICAgICAgICAgICAgICAgICAgIGQgPSBPcGVyYXRpb24ucnVuKGMuY2FsbHMsIHZhcmlhYmxlcywgZnVuY3Rpb25zKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIHJldHVybiBkIHx8ICh0aGlzLm90aGVyd2lzZS5sZW5ndGggPyBPcGVyYXRpb24ucnVuKHRoaXMub3RoZXJ3aXNlLCB2YXJpYWJsZXMsIGZ1bmN0aW9ucykgOiB0cml2aWFsUHJvbWlzZSgpKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgZXhwb3J0IGVudW0gUmV0cmlldmVUeXBlIHtcclxuICAgICAgICBGaXJzdCxcclxuICAgICAgICBBbGxcclxuICAgIH1cclxuXHJcbiAgICBleHBvcnQgY2xhc3MgUmV0cmlldmVPYmplY3QgZXh0ZW5kcyBPcGVyYXRpb24ge1xyXG4gICAgICAgIHR5cGUgPSBSZXRyaWV2ZVR5cGUuQWxsO1xyXG4gICAgICAgIHN0b3JlSWQgPSBcIlwiO1xyXG4gICAgICAgIHZhcmlhYmxlTmFtZSA9IFwiXCI7XHJcbiAgICAgICAgZXJyb3JWYXJpYWJsZU5hbWUgPSBcIlwiO1xyXG4gICAgICAgIC8vIFRPRE86IEl2YW4gZmlsdGVyc1xyXG5cclxuICAgICAgICBjb25zdHJ1Y3RvcihwYXJhbT86IGFueSkge1xyXG4gICAgICAgICAgICBzdXBlcigpO1xyXG5cclxuICAgICAgICAgICAgaWYocGFyYW0pIHtcclxuICAgICAgICAgICAgICAgIHRoaXMudHlwZSA9IHBhcmFtLnR5cGU7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnZhcmlhYmxlTmFtZSA9IHBhcmFtLnZhcmlhYmxlTmFtZTtcclxuICAgICAgICAgICAgICAgIHRoaXMuc3RvcmVJZCA9IHBhcmFtLnN0b3JlSWQ7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJ1bih2YXJpYWJsZXM6IHsgW2tleTogc3RyaW5nXTogVmFyaWFibGUgfSwgZnVuY3Rpb25zOiBhbnkpOiBKUXVlcnlQcm9taXNlPFJlc3VsdD4ge1xyXG4gICAgICAgICAgICB2YXIgZCA9ICQuRGVmZXJyZWQoKSxcclxuICAgICAgICAgICAgICAgIGVycm9ySGFuZGxlciA9IChlcnJvcikgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIGlmKHRoaXMuZXJyb3JWYXJpYWJsZU5hbWUpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdmFyaWFibGVzW3RoaXMuZXJyb3JWYXJpYWJsZU5hbWVdLnZhbHVlID0gZXJyb3I7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGQucmVzb2x2ZSgpO1xyXG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGQucmVqZWN0KFwiW1JldHJpZXZlT2JqZWN0XSBcIiArIGVycm9yKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9O1xyXG5cclxuICAgICAgICAgICAgc3dpdGNoKHRoaXMudHlwZSkge1xyXG4gICAgICAgICAgICAgICAgY2FzZSBSZXRyaWV2ZVR5cGUuQWxsOlxyXG4gICAgICAgICAgICAgICAgICAgIGZ1bmN0aW9ucy5sb2FkKHRoaXMuc3RvcmVJZCkudGhlbihcclxuICAgICAgICAgICAgICAgICAgICAgICAgKHZhbHVlcykgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyaWFibGVzW3RoaXMudmFyaWFibGVOYW1lXS52YWx1ZSA9IHZhbHVlcztcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGQucmVzb2x2ZSgpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBlcnJvckhhbmRsZXIpO1xyXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgY2FzZSBSZXRyaWV2ZVR5cGUuRmlyc3Q6XHJcbiAgICAgICAgICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgICAgICAgICAgIGZ1bmN0aW9ucy5sb2FkKHRoaXMuc3RvcmVJZCwgeyB0YWtlOiAxIH0pLnRoZW4oXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICh2YWx1ZXMpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhcmlhYmxlc1t0aGlzLnZhcmlhYmxlTmFtZV0udmFsdWUgPSB2YWx1ZXMgJiYgdmFsdWVzLmxlbmd0aCA+IDAgPyB2YWx1ZXNbMF0gOiBudWxsO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZC5yZXNvbHZlKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGVycm9ySGFuZGxlcik7XHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIHJldHVybiBkLnByb21pc2UoKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgZXhwb3J0IGNsYXNzIFJlc2V0T2JqZWN0IGV4dGVuZHMgT3BlcmF0aW9uIHtcclxuICAgICAgICB2YXJpYWJsZU5hbWUgPSBcIlwiO1xyXG4gICAgICAgIGVycm9yVmFyaWFibGVOYW1lID0gXCJcIjtcclxuICAgICAgICBwcm9wZXJ0aWVzOiBzdHJpbmdbXSA9IFtdO1xyXG5cclxuICAgICAgICBjb25zdHJ1Y3RvcihwYXJhbT86IGFueSkge1xyXG4gICAgICAgICAgICBzdXBlcigpO1xyXG4gICAgICAgICAgICBpZihwYXJhbSkge1xyXG4gICAgICAgICAgICAgICAgaWYocGFyYW0udmFyaWFibGVOYW1lKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy52YXJpYWJsZU5hbWUgPSBwYXJhbS52YXJpYWJsZU5hbWU7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBpZihwYXJhbS5wcm9wZXJ0aWVzKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5wcm9wZXJ0aWVzID0gcGFyYW0ucHJvcGVydGllcztcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcnVuKHZhcmlhYmxlczogeyBba2V5OiBzdHJpbmddOiBWYXJpYWJsZSB9LCBmdW5jdGlvbnM6IGFueSk6IEpRdWVyeVByb21pc2U8UmVzdWx0PiB7XHJcbiAgICAgICAgICAgIHZhciBkID0gJC5EZWZlcnJlZCgpLFxyXG4gICAgICAgICAgICAgICAgdmFyaWFibGUgPSB2YXJpYWJsZXNbdGhpcy52YXJpYWJsZU5hbWVdLFxyXG4gICAgICAgICAgICAgICAgc3RvcmVJZCA9IHZhcmlhYmxlLnR5cGUsXHJcbiAgICAgICAgICAgICAgICBrZXkgPSBmdW5jdGlvbnMua2V5T2Yoc3RvcmVJZCwgdmFyaWFibGUpO1xyXG4gICAgICAgICAgICBpZigha2V5KSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gcmVqZWN0UHJvbWlzZShcIlJlc2V0T2JqZWN0OiBvYmplY3QgaW4gJ1wiICsgdGhpcy52YXJpYWJsZU5hbWUgKyBcIicgZG9lc24ndCBoYXZlIGEga2V5LiBQcm9iYWJseSwgaXMgaGFzIG5vdCBiZWVuIHNhdmVkIHRvIGEgc3RvcmUuXCIpO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGZ1bmN0aW9ucy5ieUtleShzdG9yZUlkLCBrZXkpLnRoZW4oXHJcbiAgICAgICAgICAgICAgICAgICAgKGRiT2JqZWN0KSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmKHRoaXMucHJvcGVydGllcyAmJiB0aGlzLnByb3BlcnRpZXMubGVuZ3RoID4gMCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wcm9wZXJ0aWVzLmZvckVhY2goKHByb3BlcnR5TmFtZSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhcmlhYmxlW3Byb3BlcnR5TmFtZV0gPSBkYk9iamVjdFtwcm9wZXJ0eU5hbWVdO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXJpYWJsZXNbdGhpcy52YXJpYWJsZU5hbWVdID0gZGJPYmplY3Q7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgZC5yZXNvbHZlKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICAoZXJyb3IpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYodGhpcy5lcnJvclZhcmlhYmxlTmFtZSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyaWFibGVzW3RoaXMuZXJyb3JWYXJpYWJsZU5hbWVdLnZhbHVlID0gZXJyb3I7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkLnJlc29sdmUoKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGQucmVqZWN0KFwiW1Jlc2V0T2JqZWN0XSBcIiArIGVycm9yKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGV4cG9ydCBjbGFzcyBDbG9uZU9iamVjdCBleHRlbmRzIE9wZXJhdGlvbiB7XHJcbiAgICAgICAgdmFyaWFibGVOYW1lID0gXCJcIjtcclxuICAgICAgICByZXN1bHRWYXJpYWJsZU5hbWUgPSBcIlwiO1xyXG5cclxuICAgICAgICBjb25zdHJ1Y3RvcihwYXJhbT86IGFueSkge1xyXG4gICAgICAgICAgICBzdXBlcigpO1xyXG5cclxuICAgICAgICAgICAgaWYocGFyYW0pIHtcclxuICAgICAgICAgICAgICAgICQuZXh0ZW5kKHRoaXMsIHBhcmFtKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcnVuKHZhcmlhYmxlczogeyBba2V5OiBzdHJpbmddOiBWYXJpYWJsZSB9LCBmdW5jdGlvbnM6IGFueSk6IEpRdWVyeVByb21pc2U8UmVzdWx0PiB7XHJcbiAgICAgICAgICAgIHZhciB2YXJpYWJsZSA9IHZhcmlhYmxlc1t0aGlzLnZhcmlhYmxlTmFtZV0sXHJcbiAgICAgICAgICAgICAgICByZXN1bHRWYXJpYWJsZSA9IHZhcmlhYmxlc1t0aGlzLnJlc3VsdFZhcmlhYmxlTmFtZV0sXHJcbiAgICAgICAgICAgICAgICB2YWx1ZSA9IHZhcmlhYmxlLnZhbHVlLFxyXG4gICAgICAgICAgICAgICAgdGFyZ2V0ID0gQXJyYXkuaXNBcnJheSh2YWx1ZSkgPyBbXSA6IHt9O1xyXG4gICAgICAgICAgICByZXN1bHRWYXJpYWJsZS52YWx1ZSA9ICQuZXh0ZW5kKHRhcmdldCwgdmFsdWUpO1xyXG4gICAgICAgICAgICByZXR1cm4gdHJpdmlhbFByb21pc2UoKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgZXhwb3J0IGNsYXNzIE5hdmlnYXRlVG9WaWV3IGV4dGVuZHMgT3BlcmF0aW9uIHtcclxuICAgICAgICB2aWV3SWQgPSBcIlwiO1xyXG4gICAgICAgIHZpZXdJZEV4cHIgPSBcIlwiO1xyXG4gICAgICAgIHZpZXdQYXJhbWV0ZXJzOiB7IG5hbWU6IHN0cmluZzsgdmFsdWVFeHByOiBzdHJpbmcgfVtdO1xyXG4gICAgICAgIHZpZXdQYXJhbWV0ZXJzRXhwciA9IFwiXCI7XHJcblxyXG4gICAgICAgIGNvbnN0cnVjdG9yKHBhcmFtcz8pIHtcclxuICAgICAgICAgICAgc3VwZXIoKTtcclxuICAgICAgICAgICAgaWYocGFyYW1zKSB7XHJcbiAgICAgICAgICAgICAgICAkLmVhY2gocGFyYW1zLCAobmFtZSwgdmFsdWUpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzW25hbWVdID0gdmFsdWU7XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcnVuKHZhcmlhYmxlczogeyBba2V5OiBzdHJpbmddOiBhbnkgfSwgZnVuY3Rpb25zOiBhbnkpOiBKUXVlcnlQcm9taXNlPFJlc3VsdD4ge1xyXG4gICAgICAgICAgICB2YXIgdmlld0lkID0gdGhpcy52aWV3SWRFeHByID8gdGhpcy5ldmFsKHRoaXMudmlld0lkRXhwciwgdmFyaWFibGVzLCBmdW5jdGlvbnMpIDogdGhpcy52aWV3SWQsXHJcbiAgICAgICAgICAgICAgICBwYXJhbWV0ZXJzID0ge307XHJcbiAgICAgICAgICAgIGlmKHRoaXMudmlld1BhcmFtZXRlcnMpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMudmlld1BhcmFtZXRlcnMuZm9yRWFjaCgodmlld1BhcmFtZXRlcikgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciB2YWx1ZSA9IHRoaXMuZXZhbCh2aWV3UGFyYW1ldGVyLnZhbHVlRXhwciwgdmFyaWFibGVzLCBmdW5jdGlvbnMpO1xyXG4gICAgICAgICAgICAgICAgICAgIHBhcmFtZXRlcnNbdmlld1BhcmFtZXRlci5uYW1lXSA9IHZhbHVlO1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIH0gZWxzZSBpZih0aGlzLnZpZXdQYXJhbWV0ZXJzRXhwcikge1xyXG4gICAgICAgICAgICAgICAgcGFyYW1ldGVycyA9IHRoaXMuZXZhbCh0aGlzLnZpZXdQYXJhbWV0ZXJzRXhwciwgdmFyaWFibGVzLCBmdW5jdGlvbnMpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGZ1bmN0aW9ucy5uYXZpZ2F0ZVRvVmlldyh2aWV3SWQsIHBhcmFtZXRlcnMsIHRoaXMuY3VycmVudFBhbmUodmFyaWFibGVzKSk7XHJcbiAgICAgICAgICAgIHJldHVybiB0cml2aWFsUHJvbWlzZSgpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcHJpdmF0ZSBjdXJyZW50UGFuZSh2YXJpYWJsZXM6IHsgW2tleTogc3RyaW5nXTogYW55IH0pOiBzdHJpbmcge1xyXG4gICAgICAgICAgICB2YXIgJG1vZGVsID0gdmFyaWFibGVzW1wiJG1vZGVsXCJdO1xyXG4gICAgICAgICAgICByZXR1cm4gJG1vZGVsICYmICRtb2RlbC52YWx1ZSAmJiAkbW9kZWwudmFsdWUucGFuZTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgZXhwb3J0IGNsYXNzIFNhdmUgZXh0ZW5kcyBPcGVyYXRpb24ge1xyXG4gICAgICAgIG9iamVjdEV4cHIgPSBcIlwiO1xyXG4gICAgICAgIHN0b3JlSWQgPSBcIlwiO1xyXG4gICAgICAgIGtleUV4cHIgPSBcIlwiO1xyXG4gICAgICAgIGVycm9yVmFyaWFibGVOYW1lID0gXCJcIjtcclxuXHJcbiAgICAgICAgY29uc3RydWN0b3IocGFyYW0/OiBhbnkpIHtcclxuICAgICAgICAgICAgc3VwZXIoKTtcclxuICAgICAgICAgICAgaWYocGFyYW0pIHtcclxuICAgICAgICAgICAgICAgICQuZWFjaChwYXJhbSwgKG5hbWUsIHZhbHVlKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpc1tuYW1lXSA9IHZhbHVlO1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJ1bih2YXJpYWJsZXM6IHsgW2tleTogc3RyaW5nXTogYW55IH0sIGZ1bmN0aW9uczogYW55KTogSlF1ZXJ5UHJvbWlzZTxSZXN1bHQ+IHtcclxuICAgICAgICAgICAgdmFyIGQgPSAkLkRlZmVycmVkKCksXHJcbiAgICAgICAgICAgICAgICBvYmplY3QgPSB0aGlzLmV2YWwodGhpcy5vYmplY3RFeHByLCB2YXJpYWJsZXMsIGZ1bmN0aW9ucyksXHJcbiAgICAgICAgICAgICAgICBrZXkgPSB0aGlzLmtleUV4cHIgPyB0aGlzLmV2YWwodGhpcy5rZXlFeHByLCB2YXJpYWJsZXMsIGZ1bmN0aW9ucykgOiB1bmRlZmluZWQ7XHJcblxyXG4gICAgICAgICAgICBmdW5jdGlvbnMuc2F2ZShvYmplY3QsIHRoaXMuc3RvcmVJZCwga2V5KS50aGVuKFxyXG4gICAgICAgICAgICAgICAgKHJlc3VsdCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIGQucmVzb2x2ZShyZXN1bHQpO1xyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIChlcnJvcikgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIGlmKHRoaXMuZXJyb3JWYXJpYWJsZU5hbWUpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdmFyaWFibGVzW3RoaXMuZXJyb3JWYXJpYWJsZU5hbWVdLnZhbHVlID0gZXJyb3I7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGQucmVzb2x2ZSgpO1xyXG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGQucmVqZWN0KFwiW1NhdmVdIFwiICsgZXJyb3IpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgcmV0dXJuIGQucHJvbWlzZSgpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBleHBvcnQgY2xhc3MgSW5zZXJ0IGV4dGVuZHMgT3BlcmF0aW9uIHtcclxuICAgICAgICBvYmplY3RFeHByID0gXCJcIjtcclxuICAgICAgICBzdG9yZUlkID0gXCJcIjtcclxuICAgICAgICBzdG9yZUV4cHIgPSBcIlwiO1xyXG4gICAgICAgIGVycm9yVmFyaWFibGVOYW1lID0gXCJcIjtcclxuXHJcbiAgICAgICAgY29uc3RydWN0b3IocGFyYW0/OiBhbnkpIHtcclxuICAgICAgICAgICAgc3VwZXIoKTtcclxuICAgICAgICAgICAgaWYocGFyYW0pIHtcclxuICAgICAgICAgICAgICAgICQuZWFjaChwYXJhbSwgKG5hbWUsIHZhbHVlKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpc1tuYW1lXSA9IHZhbHVlO1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJ1bih2YXJpYWJsZXM6IHsgW2tleTogc3RyaW5nXTogYW55IH0sIGZ1bmN0aW9uczogYW55KTogSlF1ZXJ5UHJvbWlzZTxSZXN1bHQ+IHtcclxuICAgICAgICAgICAgdmFyIGQgPSAkLkRlZmVycmVkKCksXHJcbiAgICAgICAgICAgICAgICBvYmplY3QgPSB0aGlzLmV2YWwodGhpcy5vYmplY3RFeHByLCB2YXJpYWJsZXMsIGZ1bmN0aW9ucyksXHJcbiAgICAgICAgICAgICAgICBzdG9yZUlkID0gISF0aGlzLnN0b3JlRXhwciA/IHRoaXMuZXZhbCh0aGlzLnN0b3JlRXhwciwgdmFyaWFibGVzLCBmdW5jdGlvbnMpIDogdGhpcy5zdG9yZUlkO1xyXG5cclxuICAgICAgICAgICAgZnVuY3Rpb25zLmluc2VydChvYmplY3QsIHN0b3JlSWQpLnRoZW4oXHJcbiAgICAgICAgICAgICAgICAocmVzdWx0KSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgZC5yZXNvbHZlKHJlc3VsdCk7XHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgKGVycm9yKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYodGhpcy5lcnJvclZhcmlhYmxlTmFtZSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB2YXJpYWJsZXNbdGhpcy5lcnJvclZhcmlhYmxlTmFtZV0udmFsdWUgPSBlcnJvcjtcclxuICAgICAgICAgICAgICAgICAgICAgICAgZC5yZXNvbHZlKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgZC5yZWplY3QoXCJbSW5zZXJ0XSBcIiArIGVycm9yKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgIHJldHVybiBkLnByb21pc2UoKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgZXhwb3J0IGNsYXNzIFJlZnJlc2ggZXh0ZW5kcyBPcGVyYXRpb24ge1xyXG4gICAgICAgIHN0b3JlSWQgPSBcIlwiO1xyXG4gICAgICAgIHN0b3JlRXhwciA9IFwiXCI7XHJcblxyXG4gICAgICAgIGNvbnN0cnVjdG9yKHBhcmFtPzogYW55KSB7XHJcbiAgICAgICAgICAgIHN1cGVyKCk7XHJcbiAgICAgICAgICAgIGlmKHBhcmFtKSB7XHJcbiAgICAgICAgICAgICAgICAkLmVhY2gocGFyYW0sIChuYW1lLCB2YWx1ZSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXNbbmFtZV0gPSB2YWx1ZTtcclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBydW4odmFyaWFibGVzOiB7IFtrZXk6IHN0cmluZ106IGFueSB9LCBmdW5jdGlvbnM6IGFueSk6IEpRdWVyeVByb21pc2U8UmVzdWx0PiB7XHJcbiAgICAgICAgICAgIHZhciBzdG9yZUlkID0gISF0aGlzLnN0b3JlRXhwciA/IHRoaXMuZXZhbCh0aGlzLnN0b3JlRXhwciwgdmFyaWFibGVzLCBmdW5jdGlvbnMpIDogdGhpcy5zdG9yZUlkO1xyXG4gICAgICAgICAgICBmdW5jdGlvbnMucmVmcmVzaChzdG9yZUlkKTtcclxuICAgICAgICAgICAgcmV0dXJuIHRyaXZpYWxQcm9taXNlKCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGV4cG9ydCBjbGFzcyBTZW5kUmVxdWVzdCBleHRlbmRzIE9wZXJhdGlvbiB7XHJcbiAgICAgICAgc3RhdGljIG1ldGhvZHMgPSBbXHJcbiAgICAgICAgICAgIHsgbmFtZTogXCJnZXRcIiwgdmFsdWU6IFwiR0VUXCIgfSxcclxuICAgICAgICAgICAgeyBuYW1lOiBcInBvc3RcIiwgdmFsdWU6IFwiUE9TVFwiIH0sXHJcbiAgICAgICAgICAgIHsgbmFtZTogXCJkZWxldGVcIiwgdmFsdWU6IFwiREVMRVRFXCIgfSxcclxuICAgICAgICAgICAgeyBuYW1lOiBcInB1dFwiLCB2YWx1ZTogXCJQVVRcIiB9LFxyXG4gICAgICAgICAgICB7IG5hbWU6IFwiaGVhZFwiLCB2YWx1ZTogXCJIRUFEXCIgfSxcclxuICAgICAgICAgICAgeyBuYW1lOiBcIm9wdGlvbnNcIiwgdmFsdWU6IFwiT1BUSU9OU1wiIH0sXHJcbiAgICAgICAgICAgIHsgbmFtZTogXCJtZXJnZVwiLCB2YWx1ZTogXCJNRVJHRVwiIH0sXHJcbiAgICAgICAgICAgIHsgbmFtZTogXCJwYXRjaFwiLCB2YWx1ZTogXCJQQVRDSFwiIH1cclxuICAgICAgICBdO1xyXG5cclxuICAgICAgICB1cmxFeHByOiBzdHJpbmcgPSBudWxsO1xyXG4gICAgICAgIG1ldGhvZCA9IFwiZ2V0XCI7XHJcbiAgICAgICAgZGF0YUV4cHI6IHN0cmluZyA9IG51bGw7XHJcbiAgICAgICAgdmFyaWFibGVOYW1lOiBzdHJpbmcgPSBudWxsO1xyXG4gICAgICAgIGVycm9yVmFyaWFibGVOYW1lOiBzdHJpbmcgPSBudWxsO1xyXG4gICAgICAgIGNhY2hlUmVzcG9uc2UgPSBmYWxzZTtcclxuICAgICAgICBoZWFkZXJzRXhwcjogc3RyaW5nID0gbnVsbDtcclxuICAgICAgICB0aW1lb3V0OiBudW1iZXIgPSBudWxsO1xyXG4gICAgICAgIG9wdGlvbnM6IHt9ID0gbnVsbDtcclxuXHJcbiAgICAgICAgY29uc3RydWN0b3IocGFyYW0/OiBhbnkpIHtcclxuICAgICAgICAgICAgc3VwZXIoKTtcclxuICAgICAgICAgICAgaWYocGFyYW0pIHtcclxuICAgICAgICAgICAgICAgICQuZWFjaChwYXJhbSwgKG5hbWUsIHZhbHVlKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpc1tuYW1lXSA9IHZhbHVlO1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJ1bih2YXJpYWJsZXM6IHsgW2tleTogc3RyaW5nXTogVmFyaWFibGUgfSwgZnVuY3Rpb25zOiBhbnkpOiBKUXVlcnlQcm9taXNlPFJlc3VsdD4ge1xyXG4gICAgICAgICAgICB2YXIgZCA9ICQuRGVmZXJyZWQoKSxcclxuICAgICAgICAgICAgICAgIGZpbHRlcmVkID0gU2VuZFJlcXVlc3QubWV0aG9kcy5maWx0ZXIocGFpciA9PiBwYWlyLm5hbWUgPT09IHRoaXMubWV0aG9kIHx8IHBhaXIudmFsdWUgPT09IHRoaXMubWV0aG9kKSxcclxuICAgICAgICAgICAgICAgIG1ldGhvZCA9IGZpbHRlcmVkLmxlbmd0aCA/IGZpbHRlcmVkWzBdLnZhbHVlIDogXCJQT1NUXCIsXHJcbiAgICAgICAgICAgICAgICBkYXRhID0gdGhpcy5kYXRhRXhwciA/IHRoaXMuZXZhbCh0aGlzLmRhdGFFeHByLCB2YXJpYWJsZXMsIGZ1bmN0aW9ucykgOiB1bmRlZmluZWQsXHJcbiAgICAgICAgICAgICAgICB1cmwsXHJcbiAgICAgICAgICAgICAgICByZXF1ZXN0OiBKUXVlcnlQcm9taXNlPGFueT4sXHJcbiAgICAgICAgICAgICAgICBkYXRhVHlwZSA9IHRoaXNbXCJkYXRhVHlwZVwiXSB8fCBcImpzb25cIixcclxuICAgICAgICAgICAgICAgIGhlYWRlcnM6IHsgW2tleTogc3RyaW5nXTogYW55IH0gPSB0aGlzLmhlYWRlcnNFeHByID8gaGVhZGVycyA9IHRoaXMuZXZhbCh0aGlzLmhlYWRlcnNFeHByLCB2YXJpYWJsZXMsIGZ1bmN0aW9ucykgOiB7fTtcclxuICAgICAgICAgICAgaWYoIXRoaXMudXJsRXhwcikge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlamVjdFByb21pc2UoXCJTZW5kUmVxdWVzdDogbm8gVVJMIHByb3ZpZGVkXCIpO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICB0aGlzLm1ldGhvZCA9IHRoaXMubWV0aG9kIHx8IFwiXCI7XHJcblxyXG4gICAgICAgICAgICB1cmwgPSB0aGlzLmV2YWwodGhpcy51cmxFeHByLCB2YXJpYWJsZXMsIGZ1bmN0aW9ucyk7XHJcbiAgICAgICAgICAgIHZhciBvcHRpb25zID0gJC5leHRlbmQoe30sIHtcclxuICAgICAgICAgICAgICAgIHVybDogdXJsLFxyXG4gICAgICAgICAgICAgICAgZGF0YTogZGF0YSxcclxuICAgICAgICAgICAgICAgIHR5cGU6IG1ldGhvZCxcclxuICAgICAgICAgICAgICAgIGNhY2hlOiB0aGlzLmNhY2hlUmVzcG9uc2UsXHJcbiAgICAgICAgICAgICAgICBoZWFkZXJzOiBoZWFkZXJzLFxyXG4gICAgICAgICAgICAgICAgdGltZW91dDogJC5pc051bWVyaWModGhpcy50aW1lb3V0KSA/IHRoaXMudGltZW91dCA6IHVuZGVmaW5lZFxyXG4gICAgICAgICAgICB9LCB0aGlzLm9wdGlvbnMpO1xyXG4gICAgICAgICAgICBpZihkYXRhVHlwZSA9PT0gXCJqc29ucFwiKSB7XHJcbiAgICAgICAgICAgICAgICBvcHRpb25zW1wiZGF0YVR5cGVcIl0gPSBkYXRhVHlwZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICByZXF1ZXN0ID0gJC5hamF4KG9wdGlvbnMpO1xyXG4gICAgICAgICAgICByZXF1ZXN0ID0gcmVxdWVzdC50aGVuKFxyXG4gICAgICAgICAgICAgICAgKHJlc3VsdCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIGlmKHRoaXMudmFyaWFibGVOYW1lKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhcmlhYmxlc1t0aGlzLnZhcmlhYmxlTmFtZV0udmFsdWUgPSByZXN1bHQ7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIGQucmVzb2x2ZSgpO1xyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIChlcnJvcikgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIGlmKHRoaXMuZXJyb3JWYXJpYWJsZU5hbWUpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdmFyaWFibGVzW3RoaXMuZXJyb3JWYXJpYWJsZU5hbWVdLnZhbHVlID0gZXJyb3I7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGQucmVzb2x2ZSgpO1xyXG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGQucmVqZWN0KFwiU2VuZFJlcXVlc3Q6IFwiICsgSlNPTi5zdHJpbmdpZnkoZXJyb3IpKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgcmVxdWVzdC5hbHdheXMoZnVuY3Rpb25zW1wiYXZhaWxhYmxlXCJdKTtcclxuXHJcbiAgICAgICAgICAgIGZ1bmN0aW9uc1tcImJ1c3lcIl0oKTtcclxuICAgICAgICAgICAgcmV0dXJuIGQucHJvbWlzZSgpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBleHBvcnQgY2xhc3MgRGVsZXRlIGV4dGVuZHMgT3BlcmF0aW9uIHtcclxuICAgICAgICBvYmplY3RPcktleUV4cHIgPSBcIlwiO1xyXG4gICAgICAgIHN0b3JlSWQgPSBcIlwiO1xyXG4gICAgICAgIGVycm9yVmFyaWFibGVOYW1lID0gXCJcIjtcclxuXHJcbiAgICAgICAgY29uc3RydWN0b3IocGFyYW0/OiBhbnkpIHtcclxuICAgICAgICAgICAgc3VwZXIoKTtcclxuICAgICAgICAgICAgaWYocGFyYW0pIHtcclxuICAgICAgICAgICAgICAgIHRoaXMub2JqZWN0T3JLZXlFeHByID0gcGFyYW0ub2JqZWN0T3JLZXlFeHByIHx8IFwiXCI7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnN0b3JlSWQgPSBwYXJhbS5zdG9yZUlkIHx8IFwiXCI7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJ1bih2YXJpYWJsZXM6IHsgW2tleTogc3RyaW5nXTogYW55IH0sIGZ1bmN0aW9uczogYW55KTogSlF1ZXJ5UHJvbWlzZTxSZXN1bHQ+IHtcclxuICAgICAgICAgICAgdmFyIGQgPSAkLkRlZmVycmVkKCksXHJcbiAgICAgICAgICAgICAgICBvYmplY3RPcktleSA9IHRoaXMuZXZhbCh0aGlzLm9iamVjdE9yS2V5RXhwciwgdmFyaWFibGVzLCBmdW5jdGlvbnMpO1xyXG5cclxuICAgICAgICAgICAgZnVuY3Rpb25zLmRlbGV0ZShvYmplY3RPcktleSwgdGhpcy5zdG9yZUlkKS50aGVuKFxyXG4gICAgICAgICAgICAgICAgKHJlc3VsdCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIGQucmVzb2x2ZShyZXN1bHQpO1xyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIChlcnJvcikgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIGlmKHRoaXMuZXJyb3JWYXJpYWJsZU5hbWUpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdmFyaWFibGVzW3RoaXMuZXJyb3JWYXJpYWJsZU5hbWVdLnZhbHVlID0gZXJyb3I7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGQucmVzb2x2ZSgpO1xyXG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGQucmVqZWN0KFwiW0RlbGV0ZV0gXCIgKyBlcnJvcik7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICByZXR1cm4gZC5wcm9taXNlKCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGV4cG9ydCBjbGFzcyBOYXZpZ2F0ZUJhY2sgZXh0ZW5kcyBPcGVyYXRpb24ge1xyXG4gICAgICAgIHJ1bih2YXJpYWJsZXM6IHsgW2tleTogc3RyaW5nXTogYW55IH0sIGZ1bmN0aW9uczogYW55KTogSlF1ZXJ5UHJvbWlzZTxSZXN1bHQ+IHtcclxuICAgICAgICAgICAgZnVuY3Rpb25zLmJhY2soKTtcclxuICAgICAgICAgICAgcmV0dXJuIHRyaXZpYWxQcm9taXNlKCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGV4cG9ydCBjbGFzcyBTaG93Q29uZmlybURpYWxvZyBleHRlbmRzIE9wZXJhdGlvbiB7XHJcbiAgICAgICAgeWVzTmV4dDogT3BlcmF0aW9uW10gPSBbXTtcclxuICAgICAgICBub05leHQ6IE9wZXJhdGlvbltdID0gW107XHJcbiAgICAgICAgbWVzc2FnZUV4cHI6IHN0cmluZyA9IG51bGw7XHJcbiAgICAgICAgdGl0bGVFeHByOiBzdHJpbmcgPSBudWxsO1xyXG5cclxuICAgICAgICBjb25zdHJ1Y3RvcihwYXJhbT86IHsgeWVzTmV4dD86IE9wZXJhdGlvbltdOyBub05leHQ/OiBPcGVyYXRpb25bXTsgbWVzc2FnZUV4cHI/OiBzdHJpbmc7IHRpdGxlRXhwcj86IHN0cmluZyB9KSB7XHJcbiAgICAgICAgICAgIHN1cGVyKCk7XHJcbiAgICAgICAgICAgIGlmKHBhcmFtKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnllc05leHQgPSBwYXJhbS55ZXNOZXh0O1xyXG4gICAgICAgICAgICAgICAgdGhpcy5ub05leHQgPSBwYXJhbS5ub05leHQ7XHJcbiAgICAgICAgICAgICAgICB0aGlzLm1lc3NhZ2VFeHByID0gcGFyYW0ubWVzc2FnZUV4cHI7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnRpdGxlRXhwciA9IHBhcmFtLnRpdGxlRXhwcjtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcnVuKHZhcmlhYmxlczogeyBba2V5OiBzdHJpbmddOiBhbnkgfSwgZnVuY3Rpb25zOiBhbnkpOiBKUXVlcnlQcm9taXNlPFJlc3VsdD4ge1xyXG4gICAgICAgICAgICB2YXIgbWVzc2FnZSA9IHRoaXMuZXZhbCh0aGlzLm1lc3NhZ2VFeHByLCB2YXJpYWJsZXMsIGZ1bmN0aW9ucyksXHJcbiAgICAgICAgICAgICAgICB0aXRsZSA9IHRoaXMuZXZhbCh0aGlzLnRpdGxlRXhwciwgdmFyaWFibGVzLCBmdW5jdGlvbnMpO1xyXG4gICAgICAgICAgICByZXR1cm4gZHhkaWFsb2dcclxuICAgICAgICAgICAgICAgIC5jb25maXJtKG1lc3NhZ2UsIHRpdGxlKVxyXG4gICAgICAgICAgICAgICAgLnRoZW48UmVzdWx0PigocmVzdWx0KSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIG5leHQgPSByZXN1bHQgPyB0aGlzLnllc05leHQgOiB0aGlzLm5vTmV4dDtcclxuICAgICAgICAgICAgICAgICAgICBpZihuZXh0ICYmIG5leHQubGVuZ3RoID4gMCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gT3BlcmF0aW9uLnJ1bihuZXh0LCB2YXJpYWJsZXMsIGZ1bmN0aW9ucyk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0cml2aWFsUHJvbWlzZSgpO1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGV4cG9ydCBjbGFzcyBTaG93QWxlcnQgZXh0ZW5kcyBPcGVyYXRpb24ge1xyXG4gICAgICAgIG1lc3NhZ2VFeHByOiBzdHJpbmcgPSBudWxsO1xyXG4gICAgICAgIHRpdGxlRXhwcjogc3RyaW5nID0gbnVsbDtcclxuXHJcbiAgICAgICAgY29uc3RydWN0b3IocGFyYW0/OiBhbnkpIHtcclxuICAgICAgICAgICAgc3VwZXIoKTtcclxuICAgICAgICAgICAgaWYocGFyYW0pIHtcclxuICAgICAgICAgICAgICAgIHRoaXMubWVzc2FnZUV4cHIgPSBwYXJhbS5tZXNzYWdlRXhwcjtcclxuICAgICAgICAgICAgICAgIHRoaXMudGl0bGVFeHByID0gcGFyYW0udGl0bGVFeHByO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBydW4odmFyaWFibGVzOiB7IFtrZXk6IHN0cmluZ106IGFueSB9LCBmdW5jdGlvbnM6IGFueSk6IEpRdWVyeVByb21pc2U8UmVzdWx0PiB7XHJcbiAgICAgICAgICAgIHZhciBtZXNzYWdlID0gdGhpcy5ldmFsKHRoaXMubWVzc2FnZUV4cHIsIHZhcmlhYmxlcywgZnVuY3Rpb25zKSxcclxuICAgICAgICAgICAgICAgIHRpdGxlID0gdGhpcy5ldmFsKHRoaXMudGl0bGVFeHByLCB2YXJpYWJsZXMsIGZ1bmN0aW9ucyk7XHJcbiAgICAgICAgICAgIHJldHVybiBkeGRpYWxvZ1xyXG4gICAgICAgICAgICAgICAgLmFsZXJ0KG1lc3NhZ2UsIHRpdGxlKVxyXG4gICAgICAgICAgICAgICAgLnRoZW48UmVzdWx0PigoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRyaXZpYWxQcm9taXNlKCk7XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgZXhwb3J0IGNsYXNzIFNob3dXZWJQYWdlIGV4dGVuZHMgT3BlcmF0aW9uIHtcclxuICAgICAgICB1cmxFeHByOiBzdHJpbmcgPSBudWxsO1xyXG4gICAgICAgIHNhbWVXaW5kb3cgPSBmYWxzZTtcclxuXHJcbiAgICAgICAgY29uc3RydWN0b3IocGFyYW0/OiBhbnkpIHtcclxuICAgICAgICAgICAgc3VwZXIoKTtcclxuICAgICAgICAgICAgaWYocGFyYW0pIHtcclxuICAgICAgICAgICAgICAgIHRoaXMudXJsRXhwciA9IHBhcmFtLnVybEV4cHI7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJ1bih2YXJpYWJsZXM6IHsgW2tleTogc3RyaW5nXTogYW55IH0sIGZ1bmN0aW9uczogYW55KTogSlF1ZXJ5UHJvbWlzZTxSZXN1bHQ+IHtcclxuICAgICAgICAgICAgdmFyIHVybCA9IHRoaXMuZXZhbCh0aGlzLnVybEV4cHIsIHZhcmlhYmxlcywgZnVuY3Rpb25zKTtcclxuICAgICAgICAgICAgaWYoTGF5b3V0SGVscGVyLmdldERldmljZVR5cGUoKSA9PT0gXCJkZXNrdG9wXCIpIHtcclxuICAgICAgICAgICAgICAgIGlmKHRoaXMuc2FtZVdpbmRvdykge1xyXG4gICAgICAgICAgICAgICAgICAgIGRvY3VtZW50LmxvY2F0aW9uLmhyZWYgPSB1cmw7XHJcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIHdpbmRvdy5vcGVuKHVybCwgXCJfYmxhbmtcIik7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICB3aW5kb3cub3Blbih1cmwsIFwiX3N5c3RlbVwiKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICByZXR1cm4gdHJpdmlhbFByb21pc2UoKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgZXhwb3J0IGNsYXNzIEdldERldmljZVR5cGUgZXh0ZW5kcyBPcGVyYXRpb24ge1xyXG4gICAgICAgIHJlc3VsdFZhcmlhYmxlTmFtZSA9IFwiXCI7XHJcblxyXG4gICAgICAgIGNvbnN0cnVjdG9yKHBhcmFtPzogYW55KSB7XHJcbiAgICAgICAgICAgIHN1cGVyKCk7XHJcbiAgICAgICAgICAgIGlmKHBhcmFtKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnJlc3VsdFZhcmlhYmxlTmFtZSA9IHBhcmFtLnJlc3VsdFZhcmlhYmxlTmFtZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcnVuKHZhcmlhYmxlczogeyBba2V5OiBzdHJpbmddOiBhbnkgfSwgZnVuY3Rpb25zOiBhbnkpOiBKUXVlcnlQcm9taXNlPFJlc3VsdD4ge1xyXG4gICAgICAgICAgICBpZighdmFyaWFibGVzW3RoaXMucmVzdWx0VmFyaWFibGVOYW1lXSkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlamVjdFByb21pc2UoXCJHZXREZXZpY2VUeXBlOiB2YXJpYWJsZSAnXCIgKyB0aGlzLnJlc3VsdFZhcmlhYmxlTmFtZSArIFwiJyBkb2VzIG5vdCBleGlzdFwiKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB2YXIgZGV2aWNlVHlwZSA9IExheW91dEhlbHBlci5nZXREZXZpY2VUeXBlKCk7XHJcbiAgICAgICAgICAgIHZhcmlhYmxlc1t0aGlzLnJlc3VsdFZhcmlhYmxlTmFtZV0udmFsdWUgPSBkZXZpY2VUeXBlO1xyXG4gICAgICAgICAgICByZXR1cm4gdHJpdmlhbFByb21pc2UoKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgZXhwb3J0IGNsYXNzIEZvcm1hdERhdGVUaW1lIGV4dGVuZHMgT3BlcmF0aW9uIHtcclxuICAgICAgICBwdWJsaWMgc3RhdGljIGZvcm1hdHMgPSBbXHJcbiAgICAgICAgICAgIFwiSEg6bW06c3NcIixcclxuICAgICAgICAgICAgXCJoOm1tOnNzXCIsXHJcbiAgICAgICAgICAgIFwieXl5eS1NTS1kZFwiLFxyXG4gICAgICAgICAgICBcIk1NL2RkL3l5eXlcIixcclxuICAgICAgICAgICAgXCJkZC5NTS55eXl5XCIsXHJcbiAgICAgICAgICAgIFwieXl5eS1NTS1kZCBISDptbTpzc1wiLFxyXG4gICAgICAgICAgICBcImRkLk1NLnl5eXkgSEg6bW06c3NcIixcclxuICAgICAgICAgICAgXCJNTS9kZC95eXl5IGg6bW06c3NcIlxyXG4gICAgICAgIF07XHJcblxyXG4gICAgICAgIHZhcmlhYmxlTmFtZSA9IFwiXCI7XHJcbiAgICAgICAgZm9ybWF0ID0gXCJkZE1NTU1cIjtcclxuICAgICAgICByZXN1bHRWYXJpYWJsZU5hbWUgPSBcIlwiO1xyXG5cclxuICAgICAgICBjb25zdHJ1Y3RvcihwYXJhbXM/OiB7IHZhcmlhYmxlTmFtZTogc3RyaW5nOyBmb3JtYXQ6IHN0cmluZzsgcmVzdWx0VmFyaWFibGVOYW1lPzogc3RyaW5nOyB9KSB7XHJcbiAgICAgICAgICAgIHN1cGVyKCk7XHJcblxyXG4gICAgICAgICAgICBpZihwYXJhbXMpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMudmFyaWFibGVOYW1lID0gcGFyYW1zLnZhcmlhYmxlTmFtZTtcclxuICAgICAgICAgICAgICAgIHRoaXMuZm9ybWF0ID0gcGFyYW1zLmZvcm1hdDtcclxuICAgICAgICAgICAgICAgIHRoaXMucmVzdWx0VmFyaWFibGVOYW1lID0gcGFyYW1zLnJlc3VsdFZhcmlhYmxlTmFtZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcnVuKHZhcmlhYmxlczogeyBba2V5OiBzdHJpbmddOiBWYXJpYWJsZSB9LCBmdW5jdGlvbnM6IGFueSk6IEpRdWVyeVByb21pc2U8UmVzdWx0PiB7XHJcbiAgICAgICAgICAgIGlmKCF2YXJpYWJsZXNbdGhpcy5yZXN1bHRWYXJpYWJsZU5hbWVdKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gcmVqZWN0UHJvbWlzZShcIkZvcm1hdERhdGVUaW1lOiB2YXJpYWJsZSAnXCIgKyB0aGlzLnJlc3VsdFZhcmlhYmxlTmFtZSArIFwiJyBkb2VzIG5vdCBleGlzdFwiKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB2YXIgZGF0ZTogRGF0ZSA9IHZhcmlhYmxlc1t0aGlzLnZhcmlhYmxlTmFtZV0udmFsdWU7XHJcbiAgICAgICAgICAgIHZhcmlhYmxlc1t0aGlzLnJlc3VsdFZhcmlhYmxlTmFtZV0udmFsdWUgPSBHbG9iYWxpemUuZm9ybWF0KGRhdGUsIHRoaXMuZm9ybWF0KTtcclxuICAgICAgICAgICAgcmV0dXJuIHRyaXZpYWxQcm9taXNlKCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGV4cG9ydCBjbGFzcyBQYXJzZURhdGVUaW1lIGV4dGVuZHMgT3BlcmF0aW9uIHtcclxuICAgICAgICB2YXJpYWJsZU5hbWUgPSBcIlwiO1xyXG4gICAgICAgIHByb3BlcnRpZXMgPSBcIlwiO1xyXG4gICAgICAgIHJlc3VsdFZhcmlhYmxlTmFtZSA9IFwiXCI7XHJcblxyXG4gICAgICAgIGNvbnN0cnVjdG9yKHBhcmFtcz86IHsgdmFyaWFibGVOYW1lOiBzdHJpbmc7IHByb3BlcnRpZXM/OiBzdHJpbmcsIHJlc3VsdFZhcmlhYmxlTmFtZTogc3RyaW5nOyB9KSB7XHJcbiAgICAgICAgICAgIHN1cGVyKCk7XHJcblxyXG4gICAgICAgICAgICBpZihwYXJhbXMpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMudmFyaWFibGVOYW1lID0gcGFyYW1zLnZhcmlhYmxlTmFtZTtcclxuICAgICAgICAgICAgICAgIHRoaXMucHJvcGVydGllcyA9IHBhcmFtcy5wcm9wZXJ0aWVzO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5yZXN1bHRWYXJpYWJsZU5hbWUgPSBwYXJhbXMucmVzdWx0VmFyaWFibGVOYW1lO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBydW4odmFyaWFibGVzOiB7IFtrZXk6IHN0cmluZ106IFZhcmlhYmxlIH0sIGZ1bmN0aW9uczogYW55KTogSlF1ZXJ5UHJvbWlzZTxSZXN1bHQ+IHtcclxuICAgICAgICAgICAgaWYoIXRoaXMudmFyaWFibGVOYW1lIHx8ICF2YXJpYWJsZXNbdGhpcy52YXJpYWJsZU5hbWVdKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gcmVqZWN0UHJvbWlzZShcIlBhcnNlRGF0ZVRpbWU6IHZhcmlhYmxlICdcIiArIHRoaXMudmFyaWFibGVOYW1lICsgXCInIGRvZXMgbm90IGV4aXN0XCIpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGlmKCF0aGlzLnJlc3VsdFZhcmlhYmxlTmFtZSB8fCAhdmFyaWFibGVzW3RoaXMucmVzdWx0VmFyaWFibGVOYW1lXSkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlamVjdFByb21pc2UoXCJQYXJzZURhdGVUaW1lOiByZXN1bHQgdmFyaWFibGUgJ1wiICsgdGhpcy5yZXN1bHRWYXJpYWJsZU5hbWUgKyBcIicgZG9lcyBub3QgZXhpc3RcIik7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgdmFyIHByb3BlcnRpZXMgPSB0aGlzLnByb3BlcnRpZXMgJiYgdGhpcy5wcm9wZXJ0aWVzLmxlbmd0aCA/IHRoaXMucHJvcGVydGllcy5zcGxpdChcIixcIikgOiBbXSxcclxuICAgICAgICAgICAgICAgIGRhdGEgPSB2YXJpYWJsZXNbdGhpcy52YXJpYWJsZU5hbWVdLnZhbHVlO1xyXG4gICAgICAgICAgICB2YXJpYWJsZXNbdGhpcy5yZXN1bHRWYXJpYWJsZU5hbWVdLnZhbHVlID0gQXBwUGxheWVyLnBhcnNlRGF0ZXMoZGF0YSwgcHJvcGVydGllcyk7XHJcbiAgICAgICAgICAgIHJldHVybiB0cml2aWFsUHJvbWlzZSgpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBleHBvcnQgY2xhc3MgWG1sVG9KcyBleHRlbmRzIE9wZXJhdGlvbiB7XHJcbiAgICAgICAgdmFyaWFibGVOYW1lID0gXCJcIjtcclxuICAgICAgICByZXN1bHRWYXJpYWJsZU5hbWUgPSBcIlwiO1xyXG5cclxuICAgICAgICBjb25zdHJ1Y3RvcihwYXJhbXM/OiB7IHZhcmlhYmxlTmFtZTogc3RyaW5nLCByZXN1bHRWYXJpYWJsZU5hbWU6IHN0cmluZyB9KSB7XHJcbiAgICAgICAgICAgIHN1cGVyKCk7XHJcblxyXG4gICAgICAgICAgICBpZihwYXJhbXMpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMudmFyaWFibGVOYW1lID0gcGFyYW1zLnZhcmlhYmxlTmFtZTtcclxuICAgICAgICAgICAgICAgIHRoaXMucmVzdWx0VmFyaWFibGVOYW1lID0gcGFyYW1zLnJlc3VsdFZhcmlhYmxlTmFtZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcnVuKHZhcmlhYmxlczogeyBba2V5OiBzdHJpbmddOiBWYXJpYWJsZSB9LCBmdW5jdGlvbnM6IGFueSk6IEpRdWVyeVByb21pc2U8UmVzdWx0PiB7XHJcbiAgICAgICAgICAgIGlmKCF0aGlzLnZhcmlhYmxlTmFtZSB8fCAhdmFyaWFibGVzW3RoaXMudmFyaWFibGVOYW1lXSkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlamVjdFByb21pc2UoXCJYbWxUb0pzOiB2YXJpYWJsZSAnXCIgKyB0aGlzLnZhcmlhYmxlTmFtZSArIFwiJyBkb2VzIG5vdCBleGlzdFwiKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBpZighdGhpcy5yZXN1bHRWYXJpYWJsZU5hbWUgfHwgIXZhcmlhYmxlc1t0aGlzLnJlc3VsdFZhcmlhYmxlTmFtZV0pIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiByZWplY3RQcm9taXNlKFwiWG1sVG9KczogcmVzdWx0IHZhcmlhYmxlICdcIiArIHRoaXMucmVzdWx0VmFyaWFibGVOYW1lICsgXCInIGRvZXMgbm90IGV4aXN0XCIpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHZhciB4bWwgPSB2YXJpYWJsZXNbdGhpcy52YXJpYWJsZU5hbWVdLnZhbHVlLFxyXG4gICAgICAgICAgICAgICAgeG1sRG9jID0gJC5pc1hNTERvYyh4bWwpID8gPFhNTERvY3VtZW50PnhtbCA6ICQucGFyc2VYTUwoeG1sKTtcclxuICAgICAgICAgICAgdmFyaWFibGVzW3RoaXMucmVzdWx0VmFyaWFibGVOYW1lXS52YWx1ZSA9IEFwcFBsYXllci54bWxUb0pzKHhtbERvYy5kb2N1bWVudEVsZW1lbnQpO1xyXG4gICAgICAgICAgICByZXR1cm4gdHJpdmlhbFByb21pc2UoKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgZXhwb3J0IGNsYXNzIENhbGxQYXJhbSB7XHJcbiAgICAgICAgbmFtZTogc3RyaW5nO1xyXG4gICAgICAgIGV4cHI6IHN0cmluZztcclxuICAgIH07XHJcblxyXG4gICAgZXhwb3J0IGNsYXNzIENhbGwgZXh0ZW5kcyBPcGVyYXRpb24ge1xyXG4gICAgICAgIGZ1bmN0aW9uTmFtZSA9IFwiXCI7XHJcbiAgICAgICAgcmVzdWx0VmFyaWFibGVOYW1lID0gXCJcIjtcclxuICAgICAgICBwYXJhbXM6IENhbGxQYXJhbVtdID0gW107XHJcblxyXG4gICAgICAgIGNvbnN0cnVjdG9yKHBhcmFtcz86IHsgZnVuY3Rpb25OYW1lOiBzdHJpbmc7IHJlc3VsdFZhcmlhYmxlTmFtZT86IHN0cmluZzsgcGFyYW1zPzogQ2FsbFBhcmFtW10gfSkge1xyXG4gICAgICAgICAgICBzdXBlcigpO1xyXG5cclxuICAgICAgICAgICAgaWYocGFyYW1zKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmZ1bmN0aW9uTmFtZSA9IHBhcmFtcy5mdW5jdGlvbk5hbWU7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnJlc3VsdFZhcmlhYmxlTmFtZSA9IHBhcmFtcy5yZXN1bHRWYXJpYWJsZU5hbWUgfHwgXCJcIjtcclxuICAgICAgICAgICAgICAgIHRoaXMucGFyYW1zID0gcGFyYW1zLnBhcmFtcyB8fCBbXTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcnVuKHZhcmlhYmxlczogeyBba2V5OiBzdHJpbmddOiBWYXJpYWJsZSB9LCBmdW5jdGlvbnM6IGFueSk6IEpRdWVyeVByb21pc2U8UmVzdWx0PiB7XHJcbiAgICAgICAgICAgIGlmKHR5cGVvZiB0aGlzLmZ1bmN0aW9uTmFtZSAhPT0gXCJzdHJpbmdcIiB8fCB0aGlzLmZ1bmN0aW9uTmFtZS5sZW5ndGggPT09IDApIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiByZWplY3RQcm9taXNlKFwiQ2FsbDogYSBmdW5jdGlvbiBuYW1lIG11c3QgYmUgc3BlY2lmaWVkXCIpO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAvLyBOT1RFOiBieSBkZWZhdWx0LCB0aGUgZnVuY3Rpb24gdy9vICQuLi4gdGFrZXMgZnJvbSAkZ2xvYmFsIChiYWNrd2FyZCBjb21wYXRpYmlsaXR5KSBvciBmdW5jdGlvbnMgKGZvciBNb2R1bGUtZnVuY3Rpb25zKVxyXG4gICAgICAgICAgICB2YXIgbW9kZWxOYW1lID0gdGhpcy5mdW5jdGlvbk5hbWUuaW5kZXhPZihcIiRtb2RlbFwiKSA9PT0gMCA/IFwiJG1vZGVsXCIgOiBcIiRnbG9iYWxcIixcclxuICAgICAgICAgICAgICAgIG1vZGVsID0gdmFyaWFibGVzW21vZGVsTmFtZV0udmFsdWUsXHJcbiAgICAgICAgICAgICAgICBmbk5hbWUgPSB0aGlzLmZ1bmN0aW9uTmFtZS5yZXBsYWNlKG1vZGVsTmFtZSArIFwiLlwiLCBcIlwiKSxcclxuICAgICAgICAgICAgICAgIGZuID0gbW9kZWxbZm5OYW1lXSB8fCBmdW5jdGlvbnNbZm5OYW1lXSxcclxuICAgICAgICAgICAgICAgIHBhcmFtcyA9IHt9O1xyXG4gICAgICAgICAgICB0aGlzLnBhcmFtcy5mb3JFYWNoKHBhcmFtID0+IHtcclxuICAgICAgICAgICAgICAgIHZhciB2YWx1ZSA9IHRoaXMuZXZhbChwYXJhbS5leHByLCB2YXJpYWJsZXMsIGZ1bmN0aW9ucyk7XHJcbiAgICAgICAgICAgICAgICBwYXJhbXNbcGFyYW0ubmFtZV0gPSB2YWx1ZTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICQuZWFjaCh2YXJpYWJsZXMsIChuYW1lLCB2YWx1ZSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgaWYobmFtZS5pbmRleE9mKFwiJFwiKSA9PT0gMCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHBhcmFtc1tuYW1lXSA9IHZhcmlhYmxlc1tuYW1lXS52YWx1ZTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIGlmKHRoaXMucmVzdWx0VmFyaWFibGVOYW1lKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gZm4ocGFyYW1zKVxyXG4gICAgICAgICAgICAgICAgICAgIC50aGVuKHJlc3VsdCA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhcmlhYmxlc1t0aGlzLnJlc3VsdFZhcmlhYmxlTmFtZV0udmFsdWUgPSByZXN1bHQ7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0cml2aWFsUHJvbWlzZSgpO1xyXG4gICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJldHVybiBmbihwYXJhbXMpIHx8IHRyaXZpYWxQcm9taXNlKCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGV4cG9ydCBjbGFzcyBEZWJ1Z2dlciBleHRlbmRzIE9wZXJhdGlvbiB7XHJcbiAgICAgICAgcnVuKHZhcmlhYmxlczogeyBba2V5OiBzdHJpbmddOiBWYXJpYWJsZSB9LCBmdW5jdGlvbnM6IGFueSk6IEpRdWVyeVByb21pc2U8UmVzdWx0PiB7XHJcbiAgICAgICAgICAgIC8qIHRzbGludDpkaXNhYmxlOiBuby1kZWJ1Z2dlciAqL1xyXG4gICAgICAgICAgICBkZWJ1Z2dlcjtcclxuICAgICAgICAgICAgLyogdHNsaW50OmVuYWJsZSAqL1xyXG4gICAgICAgICAgICByZXR1cm4gdHJpdmlhbFByb21pc2UoKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgZXhwb3J0IGNsYXNzIExvZyBleHRlbmRzIE9wZXJhdGlvbiB7XHJcbiAgICAgICAgZXhwciA9IFwiXCI7XHJcbiAgICAgICAgbGV2ZWwgPSBcImluZm9cIjtcclxuXHJcbiAgICAgICAgY29uc3RydWN0b3IocGFyYW1zPzogeyBsZXZlbD86IHN0cmluZzsgZXhwcjogc3RyaW5nOyB9KSB7XHJcbiAgICAgICAgICAgIHN1cGVyKCk7XHJcblxyXG4gICAgICAgICAgICBpZihwYXJhbXMpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuZXhwciA9IHBhcmFtcy5leHByO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5sZXZlbCA9IHBhcmFtcy5sZXZlbCB8fCB0aGlzLmxldmVsO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBydW4odmFyaWFibGVzOiB7IFtrZXk6IHN0cmluZ106IFZhcmlhYmxlIH0sIGZ1bmN0aW9uczogYW55KTogSlF1ZXJ5UHJvbWlzZTxSZXN1bHQ+IHtcclxuICAgICAgICAgICAgaWYoIXRoaXMuZXhwcikge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlamVjdFByb21pc2UoXCJMb2c6IGFuIGV4cHJlc3Npb24gbXVzdCBiZSBzcGVjaWZpZWRcIik7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIHZhciBtZXNzYWdlID0gdGhpcy5ldmFsKHRoaXMuZXhwciwgdmFyaWFibGVzLCBmdW5jdGlvbnMpO1xyXG4gICAgICAgICAgICB2YXIgbG9nOiAobGV2ZWw6IHN0cmluZywgbWVzc2FnZTogc3RyaW5nKSA9PiB2b2lkID0gZnVuY3Rpb25zW1wibG9nXCJdO1xyXG4gICAgICAgICAgICBsb2codGhpcy5sZXZlbCwgbWVzc2FnZSk7XHJcbiAgICAgICAgICAgIHJldHVybiB0cml2aWFsUHJvbWlzZSgpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBleHBvcnQgY2xhc3MgRXZhbCBleHRlbmRzIE9wZXJhdGlvbiB7XHJcbiAgICAgICAgZXhwciA9IFwiXCI7XHJcbiAgICAgICAgZXJyb3JWYXJpYWJsZU5hbWUgPSBcIlwiO1xyXG5cclxuICAgICAgICBjb25zdHJ1Y3RvcihwYXJhbXM/OiB7IGV4cHI6IHN0cmluZzsgZXJyb3JWYXJpYWJsZU5hbWU/OiBzdHJpbmcgfSkge1xyXG4gICAgICAgICAgICBzdXBlcigpO1xyXG5cclxuICAgICAgICAgICAgaWYocGFyYW1zKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmV4cHIgPSBwYXJhbXMuZXhwcjtcclxuICAgICAgICAgICAgICAgIHRoaXMuZXJyb3JWYXJpYWJsZU5hbWUgPSBwYXJhbXMuZXJyb3JWYXJpYWJsZU5hbWU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJ1bih2YXJpYWJsZXM6IHsgW2tleTogc3RyaW5nXTogVmFyaWFibGUgfSwgZnVuY3Rpb25zOiBhbnkpOiBKUXVlcnlQcm9taXNlPFJlc3VsdD4ge1xyXG4gICAgICAgICAgICBpZighdGhpcy5leHByKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gcmVqZWN0UHJvbWlzZShcIkV2YWw6IGFuIGV4cHJlc3Npb24gbXVzdCBiZSBzcGVjaWZpZWRcIik7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZXZhbCh0aGlzLmV4cHIsIHZhcmlhYmxlcyk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBldmFsKGV4cHI6IHN0cmluZywgdmFyaWFibGVzOiB7IFtrZXk6IHN0cmluZ106IFZhcmlhYmxlIH0pOiBhbnkge1xyXG4gICAgICAgICAgICB2YXIgZXJyb3JIYW5kbGVyID0gKGQ6IEpRdWVyeURlZmVycmVkPGFueT4sIGUpID0+IHtcclxuICAgICAgICAgICAgICAgIGlmKHRoaXMuZXJyb3JWYXJpYWJsZU5hbWUpIHtcclxuICAgICAgICAgICAgICAgICAgICB2YXJpYWJsZXNbdGhpcy5lcnJvclZhcmlhYmxlTmFtZV0udmFsdWUgPSBlO1xyXG4gICAgICAgICAgICAgICAgICAgIGQucmVzb2x2ZSgpO1xyXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICBkLnJlamVjdChlKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIHZhcnM6IHsgW2tleTogc3RyaW5nXTogYW55IH0gPSB7fSxcclxuICAgICAgICAgICAgICAgIHJlc3RvcmVWYXJpYWJsZXNFeHByID0gXCJcIjtcclxuXHJcbiAgICAgICAgICAgICQuZWFjaCh2YXJpYWJsZXMsIChuYW1lLCB2YXJpYWJsZSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgdmFyc1tuYW1lXSA9IHZhcmlhYmxlLnZhbHVlO1xyXG4gICAgICAgICAgICAgICAgLy9OT1RFOiByZXN0b3JlIHZhbHVlcyB0byBCaXpMb2dpYy12YXJpYWJsZXMgYWZ0ZXIgdXNlci1jb2RlIGV4ZWN1dGlvblxyXG4gICAgICAgICAgICAgICAgcmVzdG9yZVZhcmlhYmxlc0V4cHIgKz0gXCJ2YXJpYWJsZXNbJ1wiICsgbmFtZSArIFwiJ10udmFsdWU9XCIgKyBuYW1lICsgXCI7XCI7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICByZXR1cm4gRXZhbC5leGVjKGV4cHIsIHJlc3RvcmVWYXJpYWJsZXNFeHByLCBlcnJvckhhbmRsZXIsIHZhcmlhYmxlcywgdmFycyk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBzdGF0aWMgcnVuRm4oYm9keTogc3RyaW5nLCB2YWx1ZXMsIHZhcmlhYmxlcz8pIHtcclxuICAgICAgICAgICAgdmFyIGJvZHlFdmFsID0gYm9keS5yZXBsYWNlKC9cXG4vZywgXCIgXCIpLnJlcGxhY2UoL1xcci9nLCBcIiBcIikucmVwbGFjZSgvXCIvZywgXCJcXFxcXFxcIlwiKSxcclxuICAgICAgICAgICAgICAgIGZuID0gbmV3IEZ1bmN0aW9uKFwiX3ZhbHVlc19cIiwgXCJ2YXJpYWJsZXNcIiwgXCJ3aXRoKF92YWx1ZXNfKSB7cmV0dXJuIGV2YWwoXFxcIlwiICsgYm9keUV2YWwgKyBcIlxcXCIpfVwiKTtcclxuICAgICAgICAgICAgcmV0dXJuIGZuLmFwcGx5KG51bGwsIFt2YWx1ZXMsIHZhcmlhYmxlc10pO1xyXG4gICAgICAgIH1cclxuICAgICAgICBzdGF0aWMgZXhlYyhib2R5OiBzdHJpbmcsIHJlc3RvcmVWYXJpYWJsZXNFeHByOiBzdHJpbmcsIGVycm9ySGFuZGxlciwgdmFyaWFibGVzOiB7IFtrZXk6IHN0cmluZ106IFZhcmlhYmxlIH0sIHZhbHVlczogeyBba2V5OiBzdHJpbmddOiBhbnkgfSkge1xyXG4gICAgICAgICAgICB2YXIgX3Jlc3VsdF8gPSAkLkRlZmVycmVkKCk7XHJcbiAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgcHJvbWlzZSA9IEV2YWwucnVuRm4oYm9keSwgdmFsdWVzKTtcclxuICAgICAgICAgICAgICAgIGlmKHdpbmRvd1tcIkFwcFBsYXllclwiXS5pc1Byb21pc2UocHJvbWlzZSkpIHtcclxuICAgICAgICAgICAgICAgICAgICBwcm9taXNlLnRoZW4oXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICgpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIEV2YWwucnVuRm4ocmVzdG9yZVZhcmlhYmxlc0V4cHIsIHZhbHVlcywgdmFyaWFibGVzKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIF9yZXN1bHRfLnJlc29sdmUoKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgKGUpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVycm9ySGFuZGxlcihfcmVzdWx0XywgZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICBFdmFsLnJ1bkZuKHJlc3RvcmVWYXJpYWJsZXNFeHByLCB2YWx1ZXMsIHZhcmlhYmxlcyk7XHJcbiAgICAgICAgICAgICAgICAgICAgX3Jlc3VsdF8ucmVzb2x2ZSgpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9IGNhdGNoKGUpIHtcclxuICAgICAgICAgICAgICAgIGVycm9ySGFuZGxlcihfcmVzdWx0XywgZSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuIF9yZXN1bHRfO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxufSIsIm1vZHVsZSBBcHBQbGF5ZXIge1xyXG4gICAgXCJ1c2Ugc3RyaWN0XCI7XHJcblxyXG4gICAgZXhwb3J0IGVudW0gVFlQRVMgeyBQUklNSVRJVkVfVFlQRSwgQVJSQVlfVFlQRSwgT0JKRUNUX1RZUEUsIFNUT1JFX1RZUEUsIFRZUEVEX09CSkVDVCB9O1xyXG5cclxuICAgIGV4cG9ydCBpbnRlcmZhY2UgSVR5cGVJbmZvIHtcclxuICAgICAgICBuYW1lOiBzdHJpbmc7XHJcbiAgICAgICAga2luZDogVFlQRVM7ICAgICAgIC8vIFBSSU1JVElWRV9UWVBFIHwgQVJSQVlfVFlQRSB8IFNUT1JFX1RZUEUgfCBPQkpFQ1RfVFlQRVxyXG4gICAgICAgIGRlZmF1bHRWYWx1ZUN0b3I/OiAoKSA9PiBhbnk7XHJcbiAgICAgICAga2V5UHJvcGVydHk/OiBJUHJvcGVydHlJbmZvO1xyXG4gICAgICAgIHByb3BlcnRpZXM/OiBJUHJvcGVydHlJbmZvW107XHJcbiAgICAgICAgbmVzdGVkVHlwZT86IElUeXBlSW5mbztcclxuICAgICAgICB0b1VJU3RyaW5nKHZhbHVlOiBhbnkpOiBzdHJpbmc7XHJcbiAgICB9XHJcblxyXG4gICAgZXhwb3J0IGludGVyZmFjZSBJUHJvcGVydHlJbmZvIHtcclxuICAgICAgICBuYW1lOiBzdHJpbmc7XHJcbiAgICAgICAgdHlwZTogSVR5cGVJbmZvO1xyXG4gICAgfVxyXG5cclxuICAgIGV4cG9ydCBjbGFzcyBUeXBlSW5mb1JlcG9zaXRvcnkge1xyXG4gICAgICAgIHB1YmxpYyBzdGF0aWMgZ2V0IEJPT0xFQU4oKSB7IHJldHVybiBcImJvb2xlYW5cIjsgfVxyXG4gICAgICAgIHB1YmxpYyBzdGF0aWMgZ2V0IE9CSkVDVCgpIHsgcmV0dXJuIFwib2JqZWN0XCI7IH1cclxuXHJcbiAgICAgICAgc3RhdGljIGhhc1Byb3BlcnRpZXModDogSVR5cGVJbmZvKTogYm9vbGVhbiB7XHJcbiAgICAgICAgICAgIGlmKHQua2luZCAhPT0gVFlQRVMuU1RPUkVfVFlQRSkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJldHVybiAodC5wcm9wZXJ0aWVzLmxlbmd0aCA+IDEgJiYgISF0LmtleVByb3BlcnR5KSB8fCAodC5wcm9wZXJ0aWVzLmxlbmd0aCA+IDAgJiYgIXQua2V5UHJvcGVydHkpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgc3RhdGljIG1pZ3JhdGVPYmplY3Qob2JqOiBhbnksIHQ6IElUeXBlSW5mbykge1xyXG4gICAgICAgICAgICBpZih0LmtpbmQgIT09IFRZUEVTLlNUT1JFX1RZUEUpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBvYmo7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgaWYob2JqIGluc3RhbmNlb2YgT2JqZWN0KSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgcHJvcGVydGllcyA9IHQucHJvcGVydGllcztcclxuICAgICAgICAgICAgICAgIGlmKHByb3BlcnRpZXMubGVuZ3RoKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIHByb3BOYW1lcyA9IHt9O1xyXG4gICAgICAgICAgICAgICAgICAgIGlmKHQua2V5UHJvcGVydHkpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcHJvcE5hbWVzW3Qua2V5UHJvcGVydHkubmFtZV0gPSB0cnVlO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzLmZvckVhY2goKHByb3ApID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYoIW9iai5oYXNPd25Qcm9wZXJ0eShwcm9wLm5hbWUpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBvYmpbcHJvcC5uYW1lXSA9IHByb3AudHlwZS5kZWZhdWx0VmFsdWVDdG9yKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgcHJvcE5hbWVzW3Byb3AubmFtZV0gPSB0cnVlO1xyXG4gICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgICAgICQuZWFjaChPYmplY3Qua2V5cyhvYmopLChpbmRleCwgcHJvcE5hbWUpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYoIXByb3BOYW1lc1twcm9wTmFtZV0pIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlbGV0ZSBvYmpbcHJvcE5hbWVdO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9iajtcclxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9iajtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiB0LmRlZmF1bHRWYWx1ZUN0b3IoKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gZnJvbSBEZXZFeHByZXNzLmRhdGEudXRpbHMub2RhdGEua2V5Q29udmVydGVyc1xyXG4gICAgICAgIHByaXZhdGUgb0RhdGFUb0pzb25UeXBlTWFwOiB7IFtvRGF0YVR5cGU6IHN0cmluZ106IHN0cmluZyB9ID0ge1xyXG4gICAgICAgICAgICBTdHJpbmc6IFwic3RyaW5nXCIsXHJcbiAgICAgICAgICAgIEludDMyOiBcIm51bWJlclwiLFxyXG4gICAgICAgICAgICBJbnQ2NDogXCJudW1iZXJcIixcclxuICAgICAgICAgICAgR3VpZDogXCJzdHJpbmdcIixcclxuICAgICAgICAgICAgQm9vbGVhbjogXCJib29sZWFuXCJcclxuICAgICAgICB9O1xyXG4gICAgICAgIHByaXZhdGUgdHlwZXM6IElUeXBlSW5mb1tdID0gW107XHJcblxyXG4gICAgICAgIGNvbnN0cnVjdG9yKHN0b3Jlc0NvbmZpZz86IElEYXRhU3RvcmVbXSkge1xyXG4gICAgICAgICAgICB0aGlzLmFkZFdpdGhMaXN0KHtcclxuICAgICAgICAgICAgICAgIG5hbWU6IFR5cGVJbmZvUmVwb3NpdG9yeS5CT09MRUFOLFxyXG4gICAgICAgICAgICAgICAga2luZDogVFlQRVMuUFJJTUlUSVZFX1RZUEUsXHJcbiAgICAgICAgICAgICAgICBkZWZhdWx0VmFsdWVDdG9yOiAoKSA9PiBmYWxzZSxcclxuICAgICAgICAgICAgICAgIHRvVUlTdHJpbmc6ICh2YWx1ZSkgPT4gPHN0cmluZz5rby51bndyYXAodmFsdWUpLnRvU3RyaW5nKClcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIHRoaXMuYWRkV2l0aExpc3Qoe1xyXG4gICAgICAgICAgICAgICAgbmFtZTogXCJudW1iZXJcIixcclxuICAgICAgICAgICAgICAgIGtpbmQ6IFRZUEVTLlBSSU1JVElWRV9UWVBFLFxyXG4gICAgICAgICAgICAgICAgZGVmYXVsdFZhbHVlQ3RvcjogKCkgPT4gMCxcclxuICAgICAgICAgICAgICAgIHRvVUlTdHJpbmc6ICh2YWx1ZSkgPT4gPHN0cmluZz5rby51bndyYXAodmFsdWUpLnRvU3RyaW5nKClcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIHRoaXMuYWRkV2l0aExpc3Qoe1xyXG4gICAgICAgICAgICAgICAgbmFtZTogXCJzdHJpbmdcIixcclxuICAgICAgICAgICAgICAgIGtpbmQ6IFRZUEVTLlBSSU1JVElWRV9UWVBFLFxyXG4gICAgICAgICAgICAgICAgZGVmYXVsdFZhbHVlQ3RvcjogKCkgPT4gXCJcIixcclxuICAgICAgICAgICAgICAgIHRvVUlTdHJpbmc6ICh2YWx1ZSkgPT4gXCJcXFwiXCIgKyBrby51bndyYXAodmFsdWUpICsgXCJcXFwiXCJcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIHRoaXMuYWRkV2l0aExpc3Qoe1xyXG4gICAgICAgICAgICAgICAgbmFtZTogXCJkYXRldGltZVwiLFxyXG4gICAgICAgICAgICAgICAga2luZDogVFlQRVMuUFJJTUlUSVZFX1RZUEUsXHJcbiAgICAgICAgICAgICAgICBkZWZhdWx0VmFsdWVDdG9yOiAoKSA9PiBuZXcgRGF0ZSgpLFxyXG4gICAgICAgICAgICAgICAgdG9VSVN0cmluZzogKHZhbHVlKSA9PiA8c3RyaW5nPmtvLnVud3JhcCh2YWx1ZSkudG9TdHJpbmcoKVxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgdGhpcy5hZGRXaXRoTGlzdCh7XHJcbiAgICAgICAgICAgICAgICBuYW1lOiBcIm9iamVjdFwiLFxyXG4gICAgICAgICAgICAgICAga2luZDogVFlQRVMuT0JKRUNUX1RZUEUsXHJcbiAgICAgICAgICAgICAgICBkZWZhdWx0VmFsdWVDdG9yOiAoKSA9PiB7IHJldHVybiBudWxsOyB9LFxyXG4gICAgICAgICAgICAgICAgdG9VSVN0cmluZzogKHZhbHVlKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYodmFsdWUgPT09IG51bGwpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIFwibnVsbFwiO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICBpZih0eXBlb2YgdmFsdWUgPT09IFwidW5kZWZpbmVkXCIpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIFwidW5kZWZpbmVkXCI7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiA8c3RyaW5nPmtvLnVud3JhcCh2YWx1ZSkudG9TdHJpbmcoKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIHRoaXMuYWRkV2l0aExpc3Qoe1xyXG4gICAgICAgICAgICAgICAgbmFtZTogXCJndWlkXCIsXHJcbiAgICAgICAgICAgICAgICBraW5kOiBUWVBFUy5QUklNSVRJVkVfVFlQRSxcclxuICAgICAgICAgICAgICAgIGRlZmF1bHRWYWx1ZUN0b3I6ICgpID0+IFwiXCIsXHJcbiAgICAgICAgICAgICAgICB0b1VJU3RyaW5nOiAodmFsdWUpID0+IDxzdHJpbmc+a28udW53cmFwKHZhbHVlKVxyXG4gICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgIHRoaXMuYWRkU3RvcmVUeXBlcyhzdG9yZXNDb25maWcpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgZ2V0KHR5cGVOYW1lOiBzdHJpbmcpOiBJVHlwZUluZm8ge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy50eXBlc1trby51bndyYXAodHlwZU5hbWUpXTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGdldEFsbCgpOiBJVHlwZUluZm9bXSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnR5cGVzO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdHlwZU9mKHZhbHVlOiBhbnkpOiBzdHJpbmcge1xyXG4gICAgICAgICAgICB2YXIgdmFsdWVUeXBlID0gdHlwZW9mIHZhbHVlO1xyXG4gICAgICAgICAgICBpZih0aGlzLnR5cGVzW3ZhbHVlVHlwZV0pIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiB2YWx1ZVR5cGU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgZm9yKHZhciBpID0gMDsgaSA8IHRoaXMudHlwZXMubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgICAgICAgIHZhciB0eXBlSW5mbyA9IHRoaXMudHlwZXNbaV07XHJcbiAgICAgICAgICAgICAgICBpZih0eXBlSW5mby5raW5kID09PSBUWVBFUy5QUklNSVRJVkVfVFlQRSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGlmKHR5cGVvZiB0eXBlSW5mby5kZWZhdWx0VmFsdWVDdG9yKCkgPT09IHZhbHVlVHlwZSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHlwZUluZm8ubmFtZTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmKHRoaXMuaXNTdG9yZU9iamVjdCh2YWx1ZSwgdHlwZUluZm8pKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHlwZUluZm8ubmFtZTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHN0b3JlSWQodHlwZU5hbWU6IHN0cmluZyk6IHN0cmluZyB7XHJcbiAgICAgICAgICAgIHZhciB0eXBlID0gdGhpcy5nZXQodHlwZU5hbWUpO1xyXG4gICAgICAgICAgICBpZih0eXBlKSB7XHJcbiAgICAgICAgICAgICAgICBpZih0eXBlLmtpbmQgPT09IFRZUEVTLlNUT1JFX1RZUEUpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHlwZS5uYW1lO1xyXG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmKHR5cGUua2luZCA9PT0gVFlQRVMuQVJSQVlfVFlQRSAmJiB0eXBlLm5lc3RlZFR5cGUua2luZCA9PT0gVFlQRVMuU1RPUkVfVFlQRSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0eXBlLm5lc3RlZFR5cGUubmFtZTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGFkZFR5cGVkT2JqZWN0VHlwZSh0eXBlSW5mbzogSVR5cGVJbmZvKSB7XHJcbiAgICAgICAgICAgIGlmKCF0eXBlSW5mbykge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHRoaXMuX2FkZCh0eXBlSW5mbyk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBwcml2YXRlIGFkZFN0b3JlVHlwZXMoc3RvcmVzQ29uZmlnOiBJRGF0YVN0b3JlW10pIHtcclxuICAgICAgICAgICAgaWYoIXN0b3Jlc0NvbmZpZykge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHN0b3Jlc0NvbmZpZy5mb3JFYWNoKHN0b3JlID0+IHtcclxuICAgICAgICAgICAgICAgIHZhciBrZXlQcm9wZXJ0eTogSVByb3BlcnR5SW5mbztcclxuICAgICAgICAgICAgICAgIHZhciBwcm9wZXJ0aWVzID0gW107XHJcbiAgICAgICAgICAgICAgICBpZihzdG9yZS5maWVsZHMpIHtcclxuICAgICAgICAgICAgICAgICAgICBzdG9yZS5maWVsZHMuZm9yRWFjaChmaWVsZCA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBiYXNlVHlwZSA9IHRoaXMuZ2V0KGZpZWxkLnR5cGUpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZighYmFzZVR5cGUpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybihcIlN0b3JlICdcIiArIHN0b3JlLmlkICsgXCInIGZpZWxkICdcIiArIGZpZWxkLm5hbWUgKyBcIicgaGFzIHVua25vd24gdHlwZSAnXCIgKyBmaWVsZC50eXBlICsgXCInXCIpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYmFzZVR5cGUgPSB0aGlzLmdldChcIm9iamVjdFwiKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgcHJvcGVydHkgPSA8SVByb3BlcnR5SW5mbz57XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBuYW1lOiBmaWVsZC5uYW1lLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogYmFzZVR5cGVcclxuICAgICAgICAgICAgICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYoZmllbGQubmFtZSA9PT0gc3RvcmUua2V5KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBrZXlQcm9wZXJ0eSA9IHByb3BlcnR5O1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcHJvcGVydGllcy5wdXNoKHByb3BlcnR5KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgaWYoIWtleVByb3BlcnR5ICYmIHN0b3JlLmtleSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciBrZXlUeXBlTmFtZSA9IHRoaXMub0RhdGFUb0pzb25UeXBlTWFwW3N0b3JlW1wia2V5VHlwZVwiXV07XHJcbiAgICAgICAgICAgICAgICAgICAga2V5UHJvcGVydHkgPSB7IG5hbWU6IHN0b3JlLmtleSwgdHlwZTogdGhpcy5nZXQoa2V5VHlwZU5hbWUpIHx8IHRoaXMuZ2V0KFR5cGVJbmZvUmVwb3NpdG9yeS5PQkpFQ1QpIH07XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB0aGlzLmFkZFdpdGhMaXN0KHtcclxuICAgICAgICAgICAgICAgICAgICBuYW1lOiBzdG9yZS5pZCxcclxuICAgICAgICAgICAgICAgICAgICBraW5kOiBUWVBFUy5TVE9SRV9UWVBFLFxyXG4gICAgICAgICAgICAgICAgICAgIGtleVByb3BlcnR5OiBrZXlQcm9wZXJ0eSxcclxuICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiBwcm9wZXJ0aWVzLFxyXG4gICAgICAgICAgICAgICAgICAgIGRlZmF1bHRWYWx1ZUN0b3I6ICgpID0+IHRoaXMuZGVmYXVsdE9iamVjdEN0b3IocHJvcGVydGllcyksXHJcbiAgICAgICAgICAgICAgICAgICAgdG9VSVN0cmluZzogKHZhbHVlKSA9PiBcIntcIiArIHN0b3JlLmlkICsgXCJ9XCJcclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHByaXZhdGUgaXNTdG9yZU9iamVjdChvYmplY3Q6IHt9LCB0eXBlSW5mbzogSVR5cGVJbmZvKTogYm9vbGVhbiB7XHJcbiAgICAgICAgICAgIGlmKCEkLmlzUGxhaW5PYmplY3Qob2JqZWN0KSkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICB2YXIgcmVzdWx0ID0gdHJ1ZTtcclxuICAgICAgICAgICAgJC5lYWNoKG9iamVjdCwgKHByb3BlcnR5TmFtZSwgcHJvcGVydHlWYWx1ZSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgcmVzdWx0ID0gdHlwZUluZm8ucHJvcGVydGllcy5zb21lKHByb3BlcnR5ID0+IHByb3BlcnR5TmFtZSA9PT0gcHJvcGVydHkubmFtZSk7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gcmVzdWx0O1xyXG4gICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBwcml2YXRlIGRlZmF1bHRPYmplY3RDdG9yKHByb3BlcnRpZXM6IElQcm9wZXJ0eUluZm9bXSkge1xyXG4gICAgICAgICAgICB2YXIgcmVzdWx0ID0ge307XHJcbiAgICAgICAgICAgIHByb3BlcnRpZXMuZm9yRWFjaChwcm9wZXJ0eSA9PiB7XHJcbiAgICAgICAgICAgICAgICByZXN1bHRbcHJvcGVydHkubmFtZV0gPSBwcm9wZXJ0eS50eXBlLmRlZmF1bHRWYWx1ZUN0b3IoKTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBwcml2YXRlIGNyZWF0ZUxpc3RUeXBlKHBsYWluVHlwZTogSVR5cGVJbmZvKSB7XHJcbiAgICAgICAgICAgIHZhciBsaXN0VHlwZTogSVR5cGVJbmZvID0ge1xyXG4gICAgICAgICAgICAgICAgbmFtZTogcGxhaW5UeXBlLm5hbWUgKyBcIltdXCIsXHJcbiAgICAgICAgICAgICAgICBraW5kOiBUWVBFUy5BUlJBWV9UWVBFLFxyXG4gICAgICAgICAgICAgICAgZGVmYXVsdFZhbHVlQ3RvcjogKCkgPT4gW10sXHJcbiAgICAgICAgICAgICAgICBuZXN0ZWRUeXBlOiBwbGFpblR5cGUsXHJcbiAgICAgICAgICAgICAgICB0b1VJU3RyaW5nOiAodmFsdWUpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICB2YWx1ZSA9IGtvLnVud3JhcCh2YWx1ZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIHJlc3VsdCA9IHBsYWluVHlwZS5uYW1lICsgXCJbXCI7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYodmFsdWUgJiYgdmFsdWUubGVuZ3RoID4gMCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXN1bHQgKz0gdmFsdWUubGVuZ3RoO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gcmVzdWx0ICsgXCJdXCI7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgIHJldHVybiBsaXN0VHlwZTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHByaXZhdGUgYWRkV2l0aExpc3QodHlwZTogSVR5cGVJbmZvKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2FkZCh0eXBlKTtcclxuICAgICAgICAgICAgdmFyIGxpc3RUeXBlID0gdGhpcy5jcmVhdGVMaXN0VHlwZSh0eXBlKTtcclxuICAgICAgICAgICAgdGhpcy5fYWRkKGxpc3RUeXBlKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIF9hZGQodHlwZTogSVR5cGVJbmZvKSB7XHJcbiAgICAgICAgICAgIHRoaXMudHlwZXMucHVzaCh0eXBlKTtcclxuICAgICAgICAgICAgdGhpcy50eXBlc1t0eXBlLm5hbWVdID0gdHlwZTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbn0gIiwibW9kdWxlIEFwcFBsYXllci5Mb2dpYyB7XHJcbiAgICBcInVzZSBzdHJpY3RcIjtcclxuICAgIGV4cG9ydCBjbGFzcyBWYXJpYWJsZSB7XHJcbiAgICAgICAgcHJpdmF0ZSBfY29uZmlnOiBhbnk7XHJcbiAgICAgICAgdmFsdWU6IGFueTtcclxuICAgICAgICBnZXQgbmFtZSgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2NvbmZpZy5uYW1lO1xyXG4gICAgICAgIH1cclxuICAgICAgICBnZXQgcGFyYW1ldGVyKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fY29uZmlnLnBhcmFtZXRlciB8fCBmYWxzZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZ2V0IHR5cGUoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9jb25maWcudHlwZSB8fCBcIm9iamVjdFwiO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgY29uc3RydWN0b3IoY29uZmlnOiB7IG5hbWU6IGFueSwgdmFsdWU/OiBhbnksIHBhcmFtZXRlcj86IGJvb2xlYW4sIHR5cGU/OiBzdHJpbmcgfSkge1xyXG4gICAgICAgICAgICB0aGlzLl9jb25maWcgPSBjb25maWc7XHJcbiAgICAgICAgICAgIHRoaXMudmFsdWUgPSBjb25maWcudmFsdWU7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXNldFZhbHVlKCkge1xyXG4gICAgICAgICAgICB0aGlzLnZhbHVlID0gY2xvbmUodGhpcy5fY29uZmlnLnZhbHVlKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHN0YXRpYyBmcm9tSnNvbihqc29uOiB7IG5hbWU6IGFueSwgdmFsdWU/OiBhbnksIHBhcmFtZXRlcj86IGJvb2xlYW4sIHR5cGU/OiBzdHJpbmcgfSk6IFZhcmlhYmxlIHtcclxuICAgICAgICAgICAgdmFyIHJlc3VsdCA9IG5ldyBWYXJpYWJsZShqc29uKTtcclxuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbn0iLCIgICAgLyptb2R1bGUgQXBwUGxheWVyIHtcclxuICAgIFwidXNlIHN0cmljdFwiO1xyXG4gICAgaW1wb3J0IGR4ZGF0YSA9IERldkV4cHJlc3MuZGF0YTtcclxuXHJcbiAgICBleHBvcnQgY2xhc3MgTG9jYWxTdG9yZSBleHRlbmRzIGR4ZGF0YS5Mb2NhbFN0b3JlIHtcclxuICAgICAgICBjb25zdHJ1Y3RvcihzdG9yZU9wdGlvbnM6IGR4ZGF0YS5Mb2NhbFN0b3JlT3B0aW9ucykge1xyXG4gICAgICAgICAgICBzdXBlcihzdG9yZU9wdGlvbnMpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgYnlLZXkoa2V5OiBhbnksIGV4dHJhT3B0aW9uczogYW55KTogSlF1ZXJ5UHJvbWlzZTxhbnk+IHtcclxuICAgICAgICAgICAgcmV0dXJuIHN1cGVyLmJ5S2V5KGtleSwgZXh0cmFPcHRpb25zKVxyXG4gICAgICAgICAgICAgICAgLnRoZW4oKHZhbHVlOiBhbnkpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICBpZih2YWx1ZSBpbnN0YW5jZW9mIE9iamVjdCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gJC5leHRlbmQoe30sIHZhbHVlKTtcclxuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdmFsdWU7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBsb2FkKG9iaj86IGR4ZGF0YS5Mb2FkT3B0aW9ucyk6IEpRdWVyeVByb21pc2U8YW55W10+IHtcclxuICAgICAgICAgICAgcmV0dXJuIHN1cGVyLmxvYWQob2JqKVxyXG4gICAgICAgICAgICAgICAgLnRoZW4oKHZhbHVlOiBhbnlbXSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIGlmKHZhbHVlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICQuZWFjaCh2YWx1ZSwgKG5hbWUsIHZhbCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYodmFsIGluc3RhbmNlb2YgT2JqZWN0KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWVbbmFtZV0gPSAkLmV4dGVuZCh7fSwgdmFsKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB2YWx1ZTtcclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxufSovIiwibW9kdWxlIEFwcFBsYXllci5WaWV3cyB7XHJcbiAgICBcInVzZSBzdHJpY3RcIjtcclxuXHJcbiAgICAvL2V4cG9ydCBjbGFzcyBCaW5kaW5nRXhwcmVzc2lvbiB7XHJcbiAgICAvLyAgICBwdWJsaWMgc3RhdGljIGlzRXhwcmVzc2lvbihleHByKTogYm9vbGVhbiB7XHJcbiAgICAvLyAgICAgICAgcmV0dXJuIGV4cHIgJiYgdHlwZW9mIGV4cHIgPT09IFwic3RyaW5nXCIgJiYgZXhwci5jaGFyQXQoMCkgPT09IFwiJFwiO1xyXG4gICAgLy8gICAgfVxyXG5cclxuICAgIC8vICAgIHB1YmxpYyBzdGF0aWMgcGFyc2VCaW5kaW5nVGFyZ2V0KGV4cHIpOiBzdHJpbmcge1xyXG4gICAgLy8gICAgICAgIGlmKCFCaW5kaW5nRXhwcmVzc2lvbi5pc0V4cHJlc3Npb24oZXhwcikpIHtcclxuICAgIC8vICAgICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcclxuICAgIC8vICAgICAgICB9XHJcbiAgICAvLyAgICAgICAgcmV0dXJuIGV4cHIuc3Vic3RyKDEpO1xyXG4gICAgLy8gICAgfVxyXG5cclxuICAgIC8vICAgIHB1YmxpYyBzdGF0aWMgYWxsQmluZGluZ1RhcmdldHMoY29tcG9uZW50czogSUNvbXBvbmVudFtdKTogc3RyaW5nW10ge1xyXG4gICAgLy8gICAgICAgIGlmKCFjb21wb25lbnRzKSB7XHJcbiAgICAvLyAgICAgICAgICAgIHJldHVybiBbXTtcclxuICAgIC8vICAgICAgICB9XHJcbiAgICAvLyAgICAgICAgdmFyIHJlc3VsdDogc3RyaW5nW10gPSBbXTtcclxuICAgIC8vICAgICAgICBjb21wb25lbnRzLmZvckVhY2goKGNvbXBvbmVudCkgPT4ge1xyXG4gICAgLy8gICAgICAgICAgICAkLmVhY2goY29tcG9uZW50LCAoaW5kZXgsIHZhbCkgPT4ge1xyXG4gICAgLy8gICAgICAgICAgICAgICAgdmFyIHRhcmdldCA9IEJpbmRpbmdFeHByZXNzaW9uLnBhcnNlQmluZGluZ1RhcmdldCh2YWwpO1xyXG4gICAgLy8gICAgICAgICAgICAgICAgaWYodGFyZ2V0ICYmIHJlc3VsdC5pbmRleE9mKHRhcmdldCkgPT09IC0xKSB7XHJcbiAgICAvLyAgICAgICAgICAgICAgICAgICAgcmVzdWx0LnB1c2godGFyZ2V0KTtcclxuICAgIC8vICAgICAgICAgICAgICAgIH1cclxuICAgIC8vICAgICAgICAgICAgfSk7XHJcbiAgICAvLyAgICAgICAgfSk7XHJcbiAgICAvLyAgICAgICAgcmV0dXJuIHJlc3VsdDtcclxuICAgIC8vICAgIH1cclxuICAgIC8vfVxyXG59ICIsIm1vZHVsZSBBcHBQbGF5ZXIuVmlld3Mge1xyXG4gICAgXCJ1c2Ugc3RyaWN0XCI7XHJcblxyXG4gICAgaW1wb3J0IGR4ZGV2aWNlID0gRGV2RXhwcmVzcy5kZXZpY2VzO1xyXG5cclxuICAgIGV4cG9ydCBjbGFzcyBGaWxlSW1hZ2VFZGl0b3JWaWV3TW9kZWwge1xyXG4gICAgICAgIHByaXZhdGUgZnVsbEJhc2U2NEhlYWRlciA9IFwiZGF0YTppbWFnZS9wbmc7YmFzZTY0LFwiO1xyXG4gICAgICAgIHByaXZhdGUgYmFzZTY0SGVhZGVyID0gXCJiYXNlNjQsXCI7XHJcbiAgICAgICAgcHJpdmF0ZSBQSE9UT0xJQlJBUlkgPSAwO1xyXG4gICAgICAgIHByaXZhdGUgQ0FNRVJBID0gMTtcclxuICAgICAgICBwcml2YXRlIGFkZEJhc2U2NEhlYWRlcih2YWx1ZTogc3RyaW5nKSB7XHJcbiAgICAgICAgICAgIGlmKHZhbHVlID09IG51bGwgfHwgdmFsdWUgPT09IFwiKEltYWdlKVwiIHx8IHZhbHVlID09PSBcIlwiKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB2YXIgcmVzdWx0ID0gQXBwUGxheWVyLnN0YXJ0c1dpdGgodmFsdWUsIFwiaHR0cFwiKVxyXG4gICAgICAgICAgICAgICAgPyB2YWx1ZVxyXG4gICAgICAgICAgICAgICAgOiB0aGlzLmZ1bGxCYXNlNjRIZWFkZXIgKyB0aGlzLnJlbW92ZUJhc2U2NEhlYWRlcih2YWx1ZSk7XHJcbiAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHByaXZhdGUgcmVtb3ZlQmFzZTY0SGVhZGVyKHZhbHVlOiBzdHJpbmcpIHtcclxuICAgICAgICAgICAgaWYodmFsdWUgIT09IG51bGwpIHtcclxuICAgICAgICAgICAgICAgIHZhciBpbmRleCA9IHZhbHVlLmluZGV4T2YodGhpcy5iYXNlNjRIZWFkZXIpO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGluZGV4ID09PSAtMSA/IHZhbHVlIDogdmFsdWUuc3Vic3RyKGluZGV4ICsgdGhpcy5iYXNlNjRIZWFkZXIubGVuZ3RoKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgX2dldEFjdGlvblNoZWV0T3B0aW9uKGV2ZW50OiBFdmVudCkge1xyXG4gICAgICAgICAgICB2YXIgaXNEZXNrdG9wID0gZHhkZXZpY2UuY3VycmVudCgpLmRldmljZVR5cGUgPT09IFwiZGVza3RvcFwiLFxyXG4gICAgICAgICAgICAgICAgaXNDb3Jkb3ZhID0gISF3aW5kb3dbXCJjb3Jkb3ZhXCJdLFxyXG4gICAgICAgICAgICAgICAgZGF0YVNvdXJjZTogYW55W10gPSBbXHJcbiAgICAgICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0ZXh0OiB0aGlzLnRha2VQaG90b1RleHQsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGZpbGVTZWxlY3RlZDogdGhpcy5maWxlU2VsZWN0ZWQsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRvdWNoU3RhcnQ6ICgpID0+IHsgfSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgdmlzaWJsZTogaXNDb3Jkb3ZhLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjbGljazogKGFyZ3MpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2NvcmRvdmFDYW1lcmFEZWxlZ2F0ZSh0aGlzLkNBTUVSQSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGV4dDogdGhpcy5vcGVuR2FsbGVyeVRleHQsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGZpbGVTZWxlY3RlZDogdGhpcy5maWxlU2VsZWN0ZWQsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRvdWNoU3RhcnQ6ICgpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmKCFpc0NvcmRvdmEpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmNvbnRyb2wuaGlkZSgpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc2hvd0ZpbGVEaWFsb2coZXZlbnQpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB2aXNpYmxlOiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjbGljazogKGFyZ3MpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmKGlzQ29yZG92YSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2NvcmRvdmFDYW1lcmFEZWxlZ2F0ZSh0aGlzLlBIT1RPTElCUkFSWSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc2hvd0ZpbGVEaWFsb2coZXZlbnQpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRleHQ6IHRoaXMuY2xlYXJUZXh0LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBmaWxlU2VsZWN0ZWQ6IHRoaXMuZmlsZVNlbGVjdGVkLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB2aXNpYmxlOiAhdGhpcy5lbXB0eUxhYmVsVmlzaWJsZSgpLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB0b3VjaFN0YXJ0OiAoKSA9PiB7IH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsaWNrOiAoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnZhbHVlKG51bGwpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgfV07XHJcbiAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICB0YXJnZXQ6IGV2ZW50LmN1cnJlbnRUYXJnZXQsXHJcbiAgICAgICAgICAgICAgICB1c2VQb3BvdmVyOiBpc0Rlc2t0b3AsXHJcbiAgICAgICAgICAgICAgICB2aXNpYmxlOiBrby5vYnNlcnZhYmxlKGZhbHNlKSxcclxuICAgICAgICAgICAgICAgIHNob3dUaXRsZTogZmFsc2UsXHJcbiAgICAgICAgICAgICAgICB3aWR0aDogaXNEZXNrdG9wID8gXCJhdXRvXCIgOiB1bmRlZmluZWQsXHJcbiAgICAgICAgICAgICAgICBkYXRhU291cmNlOiBkYXRhU291cmNlLFxyXG4gICAgICAgICAgICAgICAgb25JdGVtQ2xpY2s6IChldmVudEFyZ3MpID0+IHsgZXZlbnRBcmdzLml0ZW1EYXRhLmNsaWNrKGV2ZW50QXJncyk7IH0sXHJcbiAgICAgICAgICAgICAgICBvbkluaXRpYWxpemVkOiAoYXJncykgPT4geyB0aGlzLmNvbnRyb2wgPSBhcmdzLmNvbXBvbmVudDsgfVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH1cclxuICAgICAgICBfY29yZG92YUNhbWVyYURlbGVnYXRlKHNvdXJjZVR5cGUgPSB0aGlzLkNBTUVSQSkge1xyXG4gICAgICAgICAgICB2YXIgb25TdWNjZXNzID0gZnVuY3Rpb24oaW1hZ2VEYXRhKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnZhbHVlKGltYWdlRGF0YSk7XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICBvbkZhaWwgPSBmdW5jdGlvbihtZXNzYWdlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCJGYWlsZWQgYmVjYXVzZTogXCIgKyBtZXNzYWdlKTtcclxuICAgICAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgIG5hdmlnYXRvcltcImNhbWVyYVwiXS5nZXRQaWN0dXJlKG9uU3VjY2Vzcy5iaW5kKHRoaXMpLCBvbkZhaWwsIHsgcXVhbGl0eTogNTAsIGRlc3RpbmF0aW9uVHlwZTogMCwgc291cmNlVHlwZTogc291cmNlVHlwZSB9KTtcclxuICAgICAgICB9O1xyXG4gICAgICAgIF9oYW5kbGVGaWxlcyhmaWxlc0hvbGRlcjogeyBmaWxlczogYW55IH0sIHZhbHVlOiBLbm9ja291dE9ic2VydmFibGU8c3RyaW5nPikge1xyXG4gICAgICAgICAgICB2YXIgZmlsZXMgPSBmaWxlc0hvbGRlci5maWxlcztcclxuICAgICAgICAgICAgZm9yKHZhciBpID0gMDsgaSA8IGZpbGVzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgZmlsZSA9IGZpbGVzW2ldO1xyXG4gICAgICAgICAgICAgICAgdmFyIGltYWdlVHlwZSA9IC9pbWFnZS4qLztcclxuXHJcbiAgICAgICAgICAgICAgICBpZighZmlsZS50eXBlLm1hdGNoKGltYWdlVHlwZSkpIHtcclxuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHZhciBmciA9IG5ldyBGaWxlUmVhZGVyKCk7XHJcbiAgICAgICAgICAgICAgICBmci5vbmxvYWQgPSAoYXJncykgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIC8vdmFyIGVuY29kZWRJbWFnZSA9IGZyLnJlc3VsdC5yZXBsYWNlKC9eZGF0YTpbXixdKywvLCAnJyk7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFsdWUodGhpcy5yZW1vdmVCYXNlNjRIZWFkZXIoZnIucmVzdWx0KSk7XHJcbiAgICAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICAgICAgZnIucmVhZEFzRGF0YVVSTChmaWxlKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIGltYWdlU3JjOiBLbm9ja291dE9ic2VydmFibGU8c3RyaW5nPjtcclxuICAgICAgICB2YWx1ZTogS25vY2tvdXRPYnNlcnZhYmxlPGFueT47XHJcbiAgICAgICAgZW1wdHlMYWJlbFZpc2libGU6IEtub2Nrb3V0T2JzZXJ2YWJsZTxib29sZWFuPjtcclxuICAgICAgICBpbWFnZVN0eWxlOiBLbm9ja291dE9ic2VydmFibGU8eyB3aWR0aDogc3RyaW5nLCBoZWlnaHQ6IHN0cmluZyB9PjtcclxuICAgICAgICBlbXB0eUxhYmVsOiBzdHJpbmc7XHJcbiAgICAgICAgb3BlbkdhbGxlcnlUZXh0OiBzdHJpbmc7XHJcbiAgICAgICAgdGFrZVBob3RvVGV4dDogc3RyaW5nO1xyXG4gICAgICAgIGNsZWFyVGV4dDogc3RyaW5nO1xyXG4gICAgICAgIGFjdGlvblNoZWV0T3B0aW9ucyA9IGtvLm9ic2VydmFibGUobnVsbCk7XHJcbiAgICAgICAgY29udHJvbDogRGV2RXhwcmVzcy51aS5keEFjdGlvblNoZWV0O1xyXG5cclxuICAgICAgICBjb25zdHJ1Y3RvcihvcHRpb25zOiBhbnkpIHtcclxuICAgICAgICAgICAgdGhpc1tcInN0eWxlXCJdID0gb3B0aW9ucy5zdHlsZTtcclxuICAgICAgICAgICAgdGhpcy52YWx1ZSA9IG9wdGlvbnMudmFsdWUgfHwga28ub2JzZXJ2YWJsZSgpO1xyXG4gICAgICAgICAgICB0aGlzLmltYWdlU3JjID0ga28uY29tcHV0ZWQ8c3RyaW5nPigoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5hZGRCYXNlNjRIZWFkZXIoa28udW53cmFwKGtvLnVud3JhcCh0aGlzLnZhbHVlKSkpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgdGhpcy5lbXB0eUxhYmVsVmlzaWJsZSA9IGtvLmNvbXB1dGVkKCgpID0+IHtcclxuICAgICAgICAgICAgICAgIHJldHVybiAhdGhpcy5pbWFnZVNyYygpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgdGhpcy5pbWFnZVN0eWxlID0ga28uY29tcHV0ZWQoKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgdmFyIHN0eWxlID0gdGhpc1tcInN0eWxlXCJdLFxyXG4gICAgICAgICAgICAgICAgICAgIHdpZHRoID0gIWlzTmFOKHBhcnNlSW50KHN0eWxlLndpZHRoLCAxMCkpID8gc3R5bGUud2lkdGggOiB1bmRlZmluZWQsXHJcbiAgICAgICAgICAgICAgICAgICAgaGVpZ2h0ID0gIWlzTmFOKHBhcnNlSW50KHN0eWxlLmhlaWdodCwgMTApKSA/IHN0eWxlLmhlaWdodCA6IHVuZGVmaW5lZDtcclxuICAgICAgICAgICAgICAgIGlmKHRoaXMuZW1wdHlMYWJlbFZpc2libGUoKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB7IHdpZHRoOiB3aWR0aCB8fCBoZWlnaHQsIGhlaWdodDogaGVpZ2h0IHx8IHdpZHRoIH07XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICByZXR1cm4geyB3aWR0aDogd2lkdGggfHwgXCJhdXRvXCIsIGhlaWdodDogaGVpZ2h0IHx8IFwiYXV0b1wiIH07XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB0aGlzLmVtcHR5TGFiZWwgPSBvcHRpb25zLmVtcHR5TGFiZWw7XHJcbiAgICAgICAgICAgIHRoaXMuY2xlYXJUZXh0ID0gb3B0aW9ucy5jbGVhclRleHQ7XHJcbiAgICAgICAgICAgIHRoaXMudGFrZVBob3RvVGV4dCA9IG9wdGlvbnMudGFrZVBob3RvVGV4dDtcclxuICAgICAgICAgICAgdGhpcy5vcGVuR2FsbGVyeVRleHQgPSBvcHRpb25zLm9wZW5HYWxsZXJ5VGV4dDtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHNob3dGaWxlRGlhbG9nKGFyZ3M6IEV2ZW50KSB7XHJcbiAgICAgICAgICAgIHZhciBmaWxlSW5wdXQgPSAoPEhUTUxFbGVtZW50PmFyZ3MuY3VycmVudFRhcmdldCkucGFyZW50RWxlbWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZShcImlucHV0XCIpWzBdO1xyXG4gICAgICAgICAgICBpZihmaWxlSW5wdXQpIHtcclxuICAgICAgICAgICAgICAgIGZpbGVJbnB1dC5jbGljaygpO1xyXG4gICAgICAgICAgICAgICAgYXJncy5zdG9wUHJvcGFnYXRpb24oKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH07XHJcbiAgICAgICAgc2hvd0ZpbGVEaWFsb2dPckFjdGlvblNoZWV0KF92aWV3TW9kZWwsIGFyZ3M6IEV2ZW50KSB7XHJcbiAgICAgICAgICAgIHRoaXMuYWN0aW9uU2hlZXRPcHRpb25zKHRoaXMuX2dldEFjdGlvblNoZWV0T3B0aW9uKGFyZ3MpKTtcclxuICAgICAgICAgICAgdGhpcy5hY3Rpb25TaGVldE9wdGlvbnMoKS52aXNpYmxlKHRydWUpO1xyXG4gICAgICAgIH07XHJcbiAgICAgICAgZmlsZVNlbGVjdGVkID0gKF9tb2RlbCwgZXZlbnQpID0+IHtcclxuICAgICAgICAgICAgdmFyIGZpbGVJbnB1dCA9ICg8SFRNTEVsZW1lbnQ+ZXZlbnQuY3VycmVudFRhcmdldCkucGFyZW50RWxlbWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZShcImlucHV0XCIpWzBdO1xyXG4gICAgICAgICAgICB0aGlzLl9oYW5kbGVGaWxlcyhldmVudC50YXJnZXQsIHRoaXMudmFsdWUpO1xyXG4gICAgICAgICAgICBmaWxlSW5wdXQudmFsdWUgPSBudWxsO1xyXG4gICAgICAgIH07XHJcbiAgICB9XHJcbn1cclxuIl0sInNvdXJjZVJvb3QiOiIuLiJ9
