function init() {
  var status = document.querySelector("#qtstatus");

  var qtLoader = QtLoader({
    //canvasElements: [canvas],
    showError: function (errorText) {
      status.innerHTML = errorText;
    },
    // showExit: function () {
    //   status.innerHTML = "Application exit";
    //   if (qtLoader.exitCode !== undefined)
    //     status.innerHTML += " with code " + qtLoader.exitCode;
    //   if (qtLoader.exitText !== undefined)
    //     status.innerHTML += " (" + qtLoader.exitText + ")";
    // },
  });
  qtLoader.loadEmscriptenModule("UEFIPatch");

  document.getElementById("run-patch").addEventListener("click", function () {
    //reset the log
    document.getElementById("output").innerText = "";
    //get the input rom file
    //Module.ccall("runPatchByteArray", null, [], []);
    var inputRom = document.getElementById("input-rom").files[0];
    var patchesTxt = document.getElementById("patches-txt").innerText;
    if (inputRom) {
      var reader = new FileReader();
      reader.onload = function (e) {
        var inputRomArray = new Uint8Array(e.target.result);
        FS.writeFile("/INPUT.ROM", inputRomArray);
        FS.writeFile("/patch.txt", patchesTxt);
        Module.ccall("runPatch", null, [], []);

        data = FS.readFile("/OUTPUT.ROM");
        var blob = new Blob([data], {
          type: "application/octet-stream",
        });
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url;
        a.download = "OUTPUT.ROM";
        a.click();
        URL.revokeObjectURL(url);
      };
      reader.readAsArrayBuffer(inputRom);
    } else {
      alert("Please select an INPUT.ROM file.");
    }
  });
  //when any checkbox is clicked, update the preview for patches.txt
  document
    .getElementById("patches-selector")
    .addEventListener("click", function (e) {
      if (e.target.type === "checkbox") {
        refreshPatches();
      }
    });
}

function refreshPatches() {
  //PATCHLIST
  var patchMapping = {
    CSB: "# Replace EFI_SECURITY_VIOLATION with EFI_SUCCESS in SecurityStubDxe \n\
F80697E9-7FD6-4665-8646-88E33EF71DFC 10 P:1A00000000000080:0000000000000000\n",
    custom: document.querySelector('textarea[data-patchname="custom"]').value,
  };
  var patchesTxt = "";
  //loop through all the checkboxes with data-patchname, and add the corresponding patch to patchesTxt
  //patch name is a variable that is the same as the data-patchname attribute
  //so we can use it to avoid hardcoding the patch names in our loop.
  var checkboxes = document.querySelectorAll('input[type="checkbox"]');
  for (var i = 0; i < checkboxes.length; i++) {
    var patchName = checkboxes[i].getAttribute("data-patchname");
    if (checkboxes[i].checked && patchMapping[patchName]) {
      patchesTxt += patchMapping[patchName];
    }
  }
  document.getElementById("patches-txt").innerText = patchesTxt;
}
document.addEventListener("DOMContentLoaded", function () {
  refreshPatches();
});
document
  .querySelector('textarea[data-patchname="custom"]')
  .addEventListener("input", function () {
    refreshPatches();
  });
