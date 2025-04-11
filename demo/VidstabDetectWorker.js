let detector;

addEventListener("message", async ({data:eventData}) => {
    switch(eventData.kind) {
        case "init": {
            const {accuracy, appUrlBase, contrastThreshold, height, numThreads,
                shakiness, stepSize, virtualTripod, width} = eventData;
            const wasmUrlBase = `${appUrlBase}../wasm/`;
            const scriptUrl = `${wasmUrlBase}vidstab.js`;
            importScripts(scriptUrl, `${appUrlBase}BlobBuilder.js`);

            const frameSize = width * height;
            const blobBuilder = new BlobBuilder();
            const frameBuffer = new Uint8Array(frameSize)
            detector = {blobBuilder, frameBuffer, times:[]};
            const vidstab = detector.vidstab = await createVidstab({
                mainScriptUrlOrBlob: scriptUrl,
                locateFile:url => `${wasmUrlBase}${url}`,
                stdout:(buffer, offset, length) =>
                    length && blobBuilder.add(buffer.slice(offset, offset + length).buffer),
                printErr:d => d && console.log(d)});
            detector.framePtr = vidstab._malloc(frameSize);
            const resultCode = vidstab.ccall("detectInit", "number",
                ["number", "number", "number", "number",
                    "number", "number", "number", "number"],
                [width, height, shakiness ?? -1, accuracy ?? -1,
                    stepSize ?? -1, virtualTripod ?? -1, contrastThreshold ?? -1, numThreads ?? -1]);
            self.postMessage({resultCode});
            break;
        }
        case "addFrame": {
            const {data, mediaTime} = eventData;
            const {frameBuffer, framePtr, times, vidstab} = detector;
            RGBA2Luma(data, frameBuffer);
            vidstab.HEAPU8.set(frameBuffer, framePtr);
            const resultCode = vidstab.ccall("detectAddFrame", "number",
                ["number"],
                [framePtr]);
            times.push(mediaTime);
            self.postMessage({resultCode, heap:vidstab.HEAPU8.length});
            break;
        }
        case "flush": {
            const {blobBuilder, times, vidstab} = detector;
            vidstab.FS.quit(); // flushes stdout()
            // `vidstab._exit(0)` could be used here, but it might cause crashes when used with WORKERFS
            // considering this worker will get `terminate()`-d anyway, that is not an important call.
            const blob = blobBuilder.flush();
            detector = undefined;
            self.postMessage({blob, times});
            break;
        }
    }
});

function RGBA2Luma(rgba, frameBuffer) {
    const length = frameBuffer.length;
    for(let i = 0; i < length; i++) {
        const r = rgba[i*4];
        const g = rgba[i*4+1];
        const b = rgba[i*4+2];
        const luma = (0.299*r) + (0.587*g) + (0.114*b);
        frameBuffer[i] = Math.round(luma);
        //frameBuffer[i] = Math.round((r + g + b) / 3);
    }
}