var Module = {};
function Loader(config) {
  function webAssemblySupported() {
    return typeof WebAssembly !== "undefined";
  }

  function canLoad() {
    return webAssemblySupported();
  }

  // Set default state handler functions and create canvases if needed
  if (config.containerElements !== undefined) {
    config.showError =
      config.showError ||
      function (errorText, container) {
        removeChildren(container);
        var errorTextElement = document.createElement("text");
        errorTextElement.className = "Error";
        errorTextElement.innerHTML = errorText;
        return errorTextElement;
      };

    config.showLoader =
      config.showLoader ||
      function (loadingState, container) {
        removeChildren(container);
        var loadingText = document.createElement("text");
        loadingText.className = "Loading";
        loadingText.innerHTML = "<p><center> ${loadingState}...</center><p>";
        return loadingText;
      };

    config.showExit =
      config.showExit ||
      function (crashed, exitCode, container) {
        if (!crashed) return undefined;

        removeChildren(container);
        var fontSize = 54;
        var crashSymbols = [
          "\u{1F615}",
          "\u{1F614}",
          "\u{1F644}",
          "\u{1F928}",
          "\u{1F62C}",
          "\u{1F915}",
          "\u{2639}",
          "\u{1F62E}",
          "\u{1F61E}",
          "\u{1F633}",
        ];
        var symbolIndex = Math.floor(Math.random() * crashSymbols.length);
        var errorHtml = `<font size='${fontSize}'> ${crashSymbols[symbolIndex]} </font>`;
        var errorElement = document.createElement("text");
        errorElement.className = "Exit";
        errorElement.innerHTML = errorHtml;
        return errorElement;
      };
  }

  config.restartMode = config.restartMode || "RestartOnCrash";

  if (config.stdoutEnabled === undefined) config.stdoutEnabled = true;
  if (config.stderrEnabled === undefined) config.stderrEnabled = true;

  // Make sure config.path is defined and ends with "/" if needed
  if (config.path === undefined) config.path = "";
  if (config.path.length > 0 && !config.path.endsWith("/"))
    config.path = config.path.concat("/");

  if (config.environment === undefined) config.environment = {};

  var pAPI = {};
  pAPI.webAssemblySupported = webAssemblySupported();
  pAPI.canLoad = canLoad();
  pAPI.canLoadApplication = canLoad();
  pAPI.status = undefined;
  pAPI.loadModule = loadModule;

  restartCount = 0;

  function fetchResource(filePath) {
    var fullPath = config.path + filePath;
    return fetch(fullPath).then(function (response) {
      if (!response.ok) {
        self.error =
          response.status + " " + response.statusText + " " + response.url;
        setStatus("Error");
        return Promise.reject(self.error);
      } else {
        return response;
      }
    });
  }

  function fetchText(filePath) {
    return fetchResource(filePath).then(function (response) {
      return response.text();
    });
  }

  function fetchThenCompileWasm(response) {
    return response.arrayBuffer().then(function (data) {
      self.loaderSubState = "Compiling";
      setStatus("Loading"); // trigger loaderSubState udpate
      return WebAssembly.compile(data);
    });
  }

  function fetchCompileWasm(filePath) {
    return fetchResource(filePath).then(function (response) {
      const contentLength = response.headers.get("Content-Length");
      const total = parseInt(contentLength, 10);
      let loaded = 0;
      const reader = response.body.getReader();
      const stream = new ReadableStream({
        start(controller) {
          function push() {
            reader.read().then(({ done, value }) => {
              if (done) {
                controller.close();
                self.postMessage({ type: "wasmProgress", progress: 100 }); // Send 100% completion
                return;
              }
              loaded += value.length;
              const progress = (loaded / total) * 100;
              self.postMessage({
                type: "wasmProgress",
                progress: Math.round(progress),
              }); // Send progress to main thread
              controller.enqueue(value);
              push();
            });
          }
          push();
        },
      });
      const response2 = new Response(stream, response);
      if (typeof WebAssembly.compileStreaming !== "undefined") {
        self.loaderSubState = "Downloading/Compiling";
        setStatus("Loading");
        return WebAssembly.compileStreaming(response2).catch(function (error) {
          return fetchThenCompileWasm(response2);
        });
      } else return fetchThenCompileWasm(response2);
    });
  }

  function loadModule(applicationName) {
    // Loading in loader.js goes through four steps:
    // 1) Check prerequisites
    // 2) Download resources
    // 3) Configure the emscripten Module object
    // 4) Start the emcripten runtime, after which emscripten takes over

    // Check for Wasm support, we dont care about WebGL; set error and return before downloading resources if missing
    if (!webAssemblySupported()) {
      self.error = "Error: WebAssembly is not supported";
      setStatus("Error");
      return;
    }

    // Continue waiting if loadModule() is called again
    if (pAPI.status == "Loading") return;
    self.loaderSubState = "Downloading";
    setStatus("Loading");

    // Fetch emscripten generated javascript runtime
    var emscriptenModuleSource = undefined;
    var emscriptenModuleSourcePromise = fetchText(applicationName + ".js").then(
      function (source) {
        emscriptenModuleSource = source;
      },
    );

    // Fetch and compile wasm module
    var wasmModule = undefined;
    var wasmModulePromise = fetchCompileWasm(applicationName + ".wasm").then(
      function (module) {
        wasmModule = module;
      },
    );

    // Wait for all resources ready
    Promise.all([emscriptenModuleSourcePromise, wasmModulePromise])
      .then(function () {
        completeloadModule(applicationName, emscriptenModuleSource, wasmModule);
      })
      .catch(function (error) {
        self.error = error;
        setStatus("Error");
      });
  }

  function completeloadModule(
    applicationName,
    emscriptenModuleSource,
    wasmModule,
  ) {
    // The wasm binary has been compiled into a module during resource download,
    // and is ready to be instantiated. Define the instantiateWasm callback which
    // emscripten will call to create the instance.
    Module.instantiateWasm = function (imports, successCallback) {
      WebAssembly.instantiate(wasmModule, imports).then(
        function (instance) {
          successCallback(instance, wasmModule);
        },
        function (error) {
          self.error = error;
          setStatus("Error");
        },
      );
      return {};
    };

    Module.locateFile =
      Module.locateFile ||
      function (filename) {
        return config.path + filename;
      };

    // Attach status callbacks
    Module.setStatus =
      Module.setStatus ||
      function (text) {
        // Currently the only usable status update from this function
        // is "Running..."
        if (text.startsWith("Running")) setStatus("Running");
      };
    Module.monitorRunDependencies =
      Module.monitorRunDependencies ||
      function (left) {
        //  console.log("monitorRunDependencies " + left)
      };

    // Attach standard out/err callbacks.
    Module.print =
      Module.print ||
      function (text) {
        if (config.stdoutEnabled) {
          console.log(text);
          const output = document.getElementById("output");
          output.appendChild(document.createTextNode(text));
          output.appendChild(document.createElement("br"));
        }
      };
    Module.printErr =
      Module.printErr ||
      function (text) {
        // Filter out OpenGL getProcAddress warnings. Loader to resolve
        // all possible function/extension names at startup which causes
        // emscripten to spam the console log with warnings.
        if (
          text.startsWith !== undefined &&
          text.startsWith("bad name in getProcAddress:")
        )
          return;

        if (config.stderrEnabled) console.log(text);
      };

    // Error handling: set status to "Exited", update crashed and
    // exitCode according to exit type.
    // Emscripten will typically call printErr with the error text
    // as well. Note that emscripten may also throw exceptions from
    // async callbacks. These should be handled in window.onerror by user code.
    Module.onAbort =
      Module.onAbort ||
      function (text) {
        pAPI.crashed = true;
        pAPI.exitText = text;
        setStatus("Exited");
      };
    Module.quit =
      Module.quit ||
      function (code, exception) {
        if (exception.name == "ExitStatus") {
          // Clean exit with code
          pAPI.exitText = undefined;
          pAPI.exitCode = code;
        } else {
          pAPI.exitText = exception.toString();
          pAPI.crashed = true;
        }
        setStatus("Exited");
      };

    // Set environment variables
    Module.preRun = Module.preRun || [];
    Module.preRun.push(function () {
      for (var [key, value] of Object.entries(config.environment)) {
        ENV[key.toUpperCase()] = value;
      }
    });

    Module.mainScriptUrlOrBlob = new Blob([emscriptenModuleSource], {
      type: "text/javascript",
    });

    pAPI.exitCode = undefined;
    pAPI.exitText = undefined;
    pAPI.crashed = false;

    // Finally evaluate the emscripten application script, which will
    // reference the global Module object created above.
    self.eval(emscriptenModuleSource); // ES5 indirect global scope eval
  }

  function setErrorContent() {
    if (config.containerElements === undefined) {
      if (config.showError !== undefined) config.showError(self.error);
      return;
    }

    for (container of config.containerElements) {
      var errorElement = config.showError(self.error, container);
      container.appendChild(errorElement);
    }
  }

  function setExitContent() {
    if (pAPI.status != "Exited") return;
    if (config.containerElements === undefined) {
      if (config.showExit !== undefined)
        config.showExit(pAPI.crashed, pAPI.exitCode);
      return;
    }
    if (!pAPI.crashed) return;
    for (container of config.containerElements) {
      var loaderElement = config.showExit(
        pAPI.crashed,
        pAPI.exitCode,
        container,
      );
      if (loaderElement !== undefined) container.appendChild(loaderElement);
    }
  }
  var committedStatus = undefined;
  function handleStatusChange() {
    if (pAPI.status != "Loading" && committedStatus == pAPI.status) return;
    committedStatus = pAPI.status;
    if (pAPI.status == "Error") setErrorContent();
    else if (pAPI.status == "Exited") setExitContent();
    // Send status change notification
    if (config.statusChanged) config.statusChanged(pAPI.status);
  }

  function setStatus(status) {
    if (status != "Loading" && pAPI.status == status) return;
    pAPI.status = status;
    if (typeof window !== "undefined") {
      window.setTimeout(function () {
        handleStatusChange();
      }, 0);
    } else {
      // We're in a Web Worker
      setTimeout(function () {
        handleStatusChange();
      }, 0);
    }
  }
  setStatus("Created");
  return pAPI;
}
