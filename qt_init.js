function init() {
  var status = document.querySelector("#qtstatus");
  var output = document.getElementById("output");
  var worker = new Worker("worker.js");
  //set run-patch text to "loading..." and disable it
  document.getElementById("run-patch").innerText = "Loading...";
  document.getElementById("run-patch").disabled = true;
  worker.onmessage = function (e) {
    switch (e.data.type) {
      case "ready":
        document.getElementById("run-patch").disabled = false;
        document.getElementById("run-patch").innerText = "Patch";
        break;
      case "error":
        document.getElementById("run-patch").disabled = false;
        document.getElementById("run-patch").innerText = "Patch";
        // we should not enable the button here. the user should reload the page.
        status.innerHTML = e.data.text;
        break;
      case "stdout":
      case "stderr":
        output.innerHTML += e.data.text + "\n";
        break;
      case "complete":
        var blob = new Blob([e.data.data], {
          type: "application/octet-stream",
        });
        //get file name from the input rom file name and add _patched to the filename before extension
        var inputRomName = document.getElementById("input-rom").files[0].name;
        var outputRomName = inputRomName.replace(/(\.[^/.]+)+$/, "_patched$1");
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url;
        a.download = outputRomName;
        a.click();
        URL.revokeObjectURL(url);
        document.getElementById("run-patch").innerText = "Patch";
        document.getElementById("run-patch").disabled = false;
        break;
    }
  };

  document.getElementById("run-patch").addEventListener("click", function () {
    output.innerText = "";
    status.innerText = "";
    var inputRom = document.getElementById("input-rom").files[0];
    var patchesTxt = document.getElementById("patches-txt").innerText;
    if (inputRom) {
      var reader = new FileReader();
      reader.onload = function (e) {
        var inputRomArray = new Uint8Array(e.target.result);
        document.getElementById("run-patch").innerText = "Patching...";
        document.getElementById("run-patch").disabled = true;
        worker.postMessage({
          type: "runPatch",
          inputRomArray: inputRomArray,
          patchesTxt: patchesTxt,
        });
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
