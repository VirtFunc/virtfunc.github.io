function init() {
  var status = document.querySelector("#status");
  var output = document.getElementById("output");
  var worker = new Worker("worker.js");
  // inform the user that the worker is not ready. loading from network.
  document.getElementById("run-patch").innerText = "Loading...";
  document.getElementById("run-patch").disabled = true;
  worker.onmessage = function (e) {
    switch (e.data.type) {
      case "ready":
        // enable the patch button
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

document.addEventListener("DOMContentLoaded", function () {
  refreshPatches();
});
document
  .querySelector('textarea[data-patchname="custom"]')
  .addEventListener("input", function () {
    refreshPatches();
  });

function refreshPatches() {
  //PATCHLIST
  var patchMapping = {
    CSB: "# Replace EFI_SECURITY_VIOLATION with EFI_SUCCESS in SecurityStubDxe\n\
F80697E9-7FD6-4665-8646-88E33EF71DFC 10 P:1A00000000000080:0000000000000000\n",
    TPM2EPS:
      "# Part 1 TPM2 EPS Patch: AmiTpm\n\
0D8039FF-49E9-4CC9-A806-BB7C31B0BCB0 12 P:83C41485C078528B45FC85C0:83C41485C079528B45FC85C0\n\
# Part 2 TPM2 EPS Patch: Tpm20PlatformDxe\n\
# 2 bytes patched (FF FF -> 00 00)\n\
0718AD81-F26A-4850-A6EC-F268E309D707 10 P:FFFF0000000000000100000000000000000000000000000000000000000000006400620000000000454649:00000000000000000100000000000000000000000000000000000000000000006400620000000000454649\n\
# 2 bytes patched (14 -> 00, 20 -> 00)\n\
0718AD81-F26A-4850-A6EC-F268E309D707 10 P:750EB814000000668905A6CD0000EB1380F9027507B82000:750EB800000000668905A6CD0000EB1380F9027507B80000\n\
# 2 bytes patched (FF FF -> 00 00)\n\
0718AD81-F26A-4850-A6EC-F268E309D707 10 P:B9FFFF00004533:B9000000004533\n",
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
