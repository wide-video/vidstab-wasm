const appUrlBase = new URL("./", document.location).href;

export class VidstabDetect {
    memory = 0;

    static async init(width, height) {
        const result = new VidstabDetect();
        result.times = [];
        const worker = result.worker = new Worker("VidstabDetectWorker.js");
        worker.postMessage({kind:"init", appUrlBase, width, height});
        await new Promise(resolve => {
            worker.addEventListener("message", resolve)}, {once:true});
        return result;
    }

    async addFrame({data}, mediaTime) {
        const {times, worker} = this;
        worker.postMessage({kind:"addFrame", data, mediaTime}, {transfer:[data.buffer]});
        this.memory = await new Promise(resolve => {
            worker.addEventListener("message", event => resolve(event.data))}, {once:true});
        times.push(mediaTime);
    }

    async finishDetection() {
        const {worker} = this;
        worker.postMessage({kind:"finishDetection"});
        const result = await new Promise(resolve => {
            worker.addEventListener("message", event => resolve(event.data))}, {once:true});
        this.dispose();
        return result;
    }

    dispose() {
        this.worker.terminate();
    }
}