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
        printErr:d => d && console.log(d)});
    const transformsCountPtr = vidstab._malloc(4);
    const transformsPtr = vidstab._malloc(4);
    const path = await mountTRF(vidstab, blob);
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
    const heap = vidstab.HEAPU8.length;
    const transforms = bufferToTransforms(vidstab, transformsCountPtr, transformsPtr, times);
    // `vidstab._exit(0)` could be used here, but it might cause crashes
    // considering this worker will get `terminate()`-d anyway, that is not an important call.
    const duration = performance.now() - t0;
    self.postMessage({heap, transforms, duration, resultCode});
});

// regular `FS` file could be used, however .trf file might be large and would allocate huge heap
// `WASMFS` could be used, however it might be too slow as it reads by single character
// usign `FS.registerDevice`, we can pre-buffer some Blob data
async function mountTRF({FS}, blob) {
    const cache = {offset:0};

    // https://github.com/emscripten-core/emscripten/blob/c2d94c86c9e977b2a772e8364783ebf158914322/src/lib/libworkerfs.js#L125
    const ops = {
        llseek(stream, offset, whence) { 
            return whence === 1 ? offset + stream.position : offset;
        },
        read(stream, buffer, offset, length, position) {
            const end = position + length;
            if(cache.buffer &&
                (position < cache.offset || end >= cache.offset + cache.buffer.byteLength))
                cache.buffer = undefined;

            if(!cache.buffer) {
                const size = Math.max(1024*1024*4, length);
                const chunk = blob.slice(position, position + size);
                const buffer = new FileReaderSync().readAsArrayBuffer(chunk);
                cache.buffer = new Uint8Array(buffer);
                cache.offset = position;
            }

            const sub = cache.buffer.subarray(position - cache.offset, end - cache.offset);
            buffer.set(sub, offset);
            return sub.byteLength;
        }
    }

    const devId = FS.makedev(64, 0);
    const path = "/tmp.trf";
    FS.registerDevice(devId, ops);
    FS.mkdev(path, devId);
    return path;
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