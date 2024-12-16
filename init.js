function patchButtonState(string, disabled) {
  document.getElementById("run-patch").disabled = disabled;
  document.getElementById("run-patch").innerText = string;
}

function init() {
  var status = document.querySelector("#status");
  var output = document.getElementById("output");
  var worker = new Worker("worker.js");
  // inform the user that the worker is not ready. loading from network.
  patchButtonState("Loading...", true);
  worker.onmessage = function (e) {
    switch (e.data.type) {
      case "wasmProgress":
        const progressBar = document.getElementById("wasm-progress-bar");
        const progressText = document.getElementById("wasm-progress-text");

        if (progressBar && progressText) {
          progressBar.style.width = e.data.progress + "%";
          progressText.textContent = `Loading Wasm: ${e.data.progress}%`;

          // Hide the progress elements when complete
          if (e.data.progress === 100) {
            progressBar.parentElement.style.display = "none";
            progressText.style.display = "none";
          }
        }

      case "ready":
        // enable the patch button
        patchButtonState("Patch", false);
        break;
      case "error":
        patchButtonState("Patch", false);
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
        patchButtonState("Patch", false);
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
    REBAR:
      "# PciHostBridge | Remove <4GB BAR size limit in SubmitResources (Ivy Bridge)\n\
8D6756B9-E55E-4D6A-A3A5-5E4D72DDF772 10 P:77B6488B0F493BCF73AE48FFC1E81BFFFFFF488B1748FFC8483BD0759B:669066909066909066906690909090669090488B176690906690906690\n\
# PciHostBridge | Replace 16GB MMIO region with complete use of physical address space (Ivy Bridge). MAY REQUIRE DSDT MODIFICATION\n\
8D6756B9-E55E-4D6A-A3A5-5E4D72DDF772 10 P:48BA000000000100000049B80000000004000000483BDA8BCE480F47D3:49B800000000100000004929D8909090909090906690908BCE4889DA90\n\
# PciHostBridge | Replace 8-16GB MMIO region with complete use of 64GB address space (Haswell). MAY REQUIRE DSDT MODIFICATION\n\
8D6756B9-E55E-4D6A-A3A5-5E4D72DDF772 10 P:080000004823C1483BC3770C48BE0000000004000000EB7A48BB000000000C000000483BC3770C48BE0000000002000000EB5F48BB000000000E000000483BC3770C48BE0000000001000000EB4448BB000000000F000000483BC37707BE00000080EB2E48BB000000800F000000483BC37707BE00000040EB1848BB000000C00F000000483BC30F87A4FEFFFFBE00000020:010000004821C84839D8480F47D848BE00000000100000004829DE9090909090909066909066906690909090909090909066906690909090909090909066909066906690909090909090909066906690909090909090909066909066909090909090669066909090909090909090669090669090909090906690669090909090909090906690909090909090909090909090\n\
# PciHostBridge | Replace 32/48GB - 63GB MMIO region with 32/48GB - 64GB (Haswell)\n\
8D6756B9-E55E-4D6A-A3A5-5E4D72DDF772 10 P:3BC3771548BE000000C00F000000482B:3BC3771548BE0000000010000000482B\n\
# PciBus | Remove <16GB BAR size limit (Ivy Bridge/Haswell)\n\
3C1DE39F-D207-408A-AACC-731CFB7F1DD7 10 P:B8FFFFFFFF030000004C3B:B8FFFFFFFFFFFFFF004C3B\n\
# PciBus | Remove <64GB BAR size limit (Skylake/Kaby Lake/Coffee Lake)\n\
3C1DE39F-D207-408A-AACC-731CFB7F1DD7 10 P:B800000000100000004C3B:B8FFFFFFFFFFFFFF004C3B\n\
# PciBus | Don't downgrade 64-bit BARs to 32-bit (Haswell)\n\
3C1DE39F-D207-408A-AACC-731CFB7F1DD7 10 P:833E067506C70604000000833E077506C70605000000:66906690669066906690669066906690669066906690\n\
# PciBus | Don't downgrade 64-bit BARs to 32-bit (by @Mak3rde)\n\
3C1DE39F-D207-408A-AACC-731CFB7F1DD7 10 P:C70605000000833E067506C70604000000BE01000000:909090909090833E067506909090909090BE01000000\n\
# AMI APTIO V NvramSmiDxe (Socket 2011-v3 MB: C612, X99) NVRAM whitelist unlock\n\
54B070F3-9EB8-47CC-ADAF-39029C853CBB 10 P:0F84B300000041F6:90E9B300000041F6\n\
# NvramSmi NVRAM whitelist unlock (by @vit9696)\n\
842A454A-75E5-408B-8B1C-36420E4E3F21 10 P:9801000072:0000000072\n\
# PciHostBridge | Fix AddMemorySpace call (Sandy/Ivy Bridge)\n\
8D6756B9-E55E-4D6A-A3A5-5E4D72DDF772 10 P:040000004823C1483BC2480F47D04C2BC27411:100000004823C1483BC2480F47D04C2BC26690\n\
# Runtime | Remove 4GB limit for CpuIo2\n\
CBC59C4A-383A-41EB-A8EE-4498AEA567E4 10 P:B9FFFFFFFF490FAFC14903C0483BC1776C:6690669090490FAFC14903C06690906690\n\
# PciHostBridge | Remove 4GB limit for PciRootBridgeIo.Mem\n\
8D6756B9-E55E-4D6A-A3A5-5E4D72DDF772 10 P:493B4C24C0771B:66906690669090\n\
8D6756B9-E55E-4D6A-A3A5-5E4D72DDF772 10 P:493B4C24C0771C:66906690669090\n\
# IvtQpiandMrcInit | Extend MMIOH limit to fix Above 4G Decoding (X79), untested with multi CPU\n\
#5C08C7C8-24C2-4400-9627-CF2869421E06 10 P:0FB796....00006685D2:BA0020000066906685D2\n",
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

// EVENT LISTENERS
document.addEventListener("dragover", (e) => {
  e.preventDefault();
  if (e.dataTransfer.types.includes("Files")) {
    document.body.style.backgroundColor = "#0000e1"; // Change to whatever color you want
  }
});
document.addEventListener("dragleave", (e) => {
  document.body.style.backgroundColor = ""; // Reset to original color
});
document.addEventListener("drop", (e) => {
  e.preventDefault();
  document.body.style.backgroundColor = "";
  document.getElementById("input-rom").files = e.dataTransfer.files;
});
document.addEventListener("DOMContentLoaded", function () {
  refreshPatches();
});
document
  .querySelector('textarea[data-patchname="custom"]')
  .addEventListener("input", function () {
    refreshPatches();
  });
