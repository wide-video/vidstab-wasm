const appUrlBase = new URL("./", document.location).href;

export class VidstabDetect {
    heap = 0;

    static async init(width, height, config) {
        const result = new VidstabDetect();
        result.times = [];
        const worker = result.worker = new Worker("VidstabDetectWorker.js");
        worker.postMessage({kind:"init", appUrlBase, width, height, ...config});
        const {returnCode} = await new Promise(resolve => {
            worker.addEventListener("message", resolve)}, {once:true});
        return result;
    }

    async addFrame({data}, mediaTime) {
        const {times, worker} = this;
        worker.postMessage({kind:"addFrame", data, mediaTime}, {transfer:[data.buffer]});
        const {heap, returnCode} = await new Promise(resolve => {
            worker.addEventListener("message", event => resolve(event.data))}, {once:true});
        this.heap = heap;
        times.push(mediaTime);
    }

    async flush() {
        const {worker} = this;
        worker.postMessage({kind:"flush"});
        const result = await new Promise(resolve => {
            worker.addEventListener("message", event => resolve(event.data))}, {once:true});
        this.dispose();
        return result;
    }

    dispose() {
        this.worker.terminate();
    }
}