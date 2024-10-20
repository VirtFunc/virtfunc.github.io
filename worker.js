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

    try {
      FS.writeFile("/INPUT.ROM", inputRomArray);
      FS.writeFile("/patch.txt", patchesTxt);
    } catch (e) {
      postMessage({
        type: "error",
        text: "Could not write input and/or patch to virtual FS.",
      });
      return;
    }
    Module.ccall("runPatch", null, [], []);
    // try to create outputdata variable.
    try {
      var outputData = FS.readFile("/OUTPUT.ROM");
    } catch (e) {
      postMessage({
        type: "error",
        text: "Failed to read output ROM. It may not exist.",
      });
      return;
    }
    try {
      FS.unlink("/INPUT.ROM");
      FS.unlink("/patch.txt");
      FS.unlink("/OUTPUT.ROM");
    } catch (e) {
      console.log("Deleting one or more temp files failed.");
    }
    postMessage({ type: "complete", data: outputData });
  }
};
