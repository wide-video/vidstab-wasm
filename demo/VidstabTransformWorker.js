addEventListener("message", async ({data:eventData}) => {
    const {appUrlBase, camPathAlgo, blob, height, interpolType,
        maxAngle, maxShift, optZoom, smoothing, smoothZoom, times,
        width, zoom, zoomSpeed} = eventData;
    const wasmUrlBase = `${appUrlBase}../wasm/`;
    const scriptUrl = `${wasmUrlBase}vidstab.js`;
    importScripts(scriptUrl);

    const vidstab = await createVidstab({
        mainScriptUrlOrBlob: scriptUrl,
        locateFile:url => `${wasmUrlBase}${url}`,
        print:d => d && console.log(d),
        printErr:d => d && console.log(d)});
    const transformsCountPtr = vidstab._malloc(4);
    const transformsPtr = vidstab._malloc(4);
    const path = mountTRF(vidstab, blob);
    const t0 = performance.now();
    const resultCode = vidstab.ccall("transform", "number",
        ["string", "number", "number",
            "number", "number", "number", "number",
            "number", "number", "number", "number",
            "number", "number", "number"],
        [path, width, height, 
            smoothing ?? -1, zoom ?? -1, optZoom ?? -1, zoomSpeed ?? -1,
            interpolType ?? -1, maxShift ?? -1, maxAngle ?? -1, smoothZoom ?? -1,
            camPathAlgo ?? -1, transformsCountPtr, transformsPtr]);
    const memory = vidstab.HEAPU8.length;
    const transforms = bufferToTransforms(vidstab, transformsCountPtr, transformsPtr, times);
    try {
        vidstab._exit(0);
    } catch(error) {}
    const duration = performance.now() - t0;
    self.postMessage({memory, transforms, duration});
});

function mountTRF({FS, WORKERFS}, data) {
    const dir = "workerfs";
    const name = "tmp.trf";
    FS.mkdir(dir);
    FS.mount(WORKERFS, {blobs:[{name, data}]}, dir);
    return `${dir}/${name}`;
}

function bufferToTransforms(lib, transformsCountPtr, transformsPtr, times) {
    const frames = lib.HEAPU32[transformsCountPtr>>2];
    let ptr = lib.HEAPU32[transformsPtr>>2];
    const result = [];
    for(let i = 0; i < frames; i++) {
        const transform = ptrToTransform(lib, ptr);
        transform.time = times[i];
        result.push(transform);
        ptr += 56;
    }
    return result;
}

function ptrToTransform(lib, ptr) {
    return {
        x: lib.HEAPF64[ptr >> 3],
        y: lib.HEAPF64[(ptr+8) >> 3],
        alpha: lib.HEAPF64[(ptr+16) >> 3],
        zoom: lib.HEAPF64[(ptr+24) >> 3],
        //barrel: lib.HEAPF64[(ptr+32) >> 3],
        //rshutter: lib.HEAPF64[(ptr+40) >> 3],
        //extra: lib.HEAP32[(ptr+48) >> 2]
    }
}