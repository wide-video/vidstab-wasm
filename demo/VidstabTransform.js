const appUrlBase = new URL("./", document.location).href;

export class VidstabTransform {
    static async transform(blob, width, height, times, config) {
        const worker = new Worker("VidstabTransformWorker.js");
        worker.postMessage({appUrlBase, blob, times, width, height, ...config});
        const result = await new Promise(resolve => {
            worker.addEventListener("message", event => resolve(event.data))}, {once:true});
        worker.terminate();
        return result;
    }

    static getTransformByTime(transforms, time) {
        let transform = transforms[0];
        let matching = false;
        for(let t of transforms)
            if(t.time > time) {
                matching = true;
                break;
            } else {
                transform = t;
            }
        return {matching, transform};
    }
}