importScripts("qtloader_mod.js");

function fsCleanup() {
  const filesToDelete = ["/INPUT.ROM", "/patch.txt", "/OUTPUT.ROM"];
  for (const file of filesToDelete) {
    try {
      if (FS.analyzePath(file).exists) {
        FS.unlink(file);
      }
    } catch (e) {
      console.log(`Deleting ${file} failed.`);
    }
  }
}

//setup message forwarding for printing and initialization
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

//initialize the qtloader, setup error forwarding
var qtLoader = QtLoader({
  showError: function (errorText) {
    postMessage({ type: "error", text: errorText });
  },
});

//finally load the emscripten module
qtLoader.loadEmscriptenModule("UEFIPatch");

//handle passed message
self.onmessage = function (e) {
  if (e.data.type === "runPatch") {
    //get the inputs
    var inputRomArray = e.data.inputRomArray;
    var patchesTxt = e.data.patchesTxt;
    //attempt to write the inputs to the virtual FS,
    try {
      FS.writeFile("/INPUT.ROM", inputRomArray);
      FS.writeFile("/patch.txt", patchesTxt);
    } catch (e) {
      //clean up FS, log error if it fails
      fsCleanup();
      postMessage({
        type: "error",
        text: "Could not write input and/or patch to virtual FS.",
      });
      return;
    }
    //actually call the wasm module from the worker thread,
    //preventing the main thread from being blocked
    Module.ccall("runPatch", null, [], []);
    // attempt to read the output ROM after the module finishes
    try {
      var outputData = FS.readFile("/OUTPUT.ROM");
      fsCleanup();
      postMessage({ type: "complete", data: outputData });
    } catch (e) {
      //if fail
      //clean up FS, log error
      fsCleanup();
      postMessage({
        type: "error",
        text: "Failed to read output ROM. It may not exist.",
      });
      return;
    }
  }
};
