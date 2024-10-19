importScripts("qtloader_mod.js");

var Module = {
  onRuntimeInitialized: function () {
    postMessage({ type: "ready" });
  },
  print: function (text) {
    postMessage({ type: "stdout", text: text });
  },
  printErr: function (text) {
    postMessage({ type: "stderr", text: text });
  },
};

var qtLoader = QtLoader({
  showError: function (errorText) {
    postMessage({ type: "error", text: errorText });
  },
});

qtLoader.loadEmscriptenModule("UEFIPatch");

self.onmessage = function (e) {
  if (e.data.type === "runPatch") {
    var inputRomArray = e.data.inputRomArray;
    var patchesTxt = e.data.patchesTxt;

    // Use Module.FS instead of FS
    FS.writeFile("/INPUT.ROM", inputRomArray);
    FS.writeFile("/patch.txt", patchesTxt);
    Module.ccall("runPatch", null, [], []);

    var outputData = FS.readFile("/OUTPUT.ROM");
    postMessage({ type: "complete", data: outputData });
  }
};
