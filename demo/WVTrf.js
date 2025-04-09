export class WVTrf {
    static create(trf, width, height, times) {
        const timesLength = times.length;
        const buffer = new ArrayBuffer(4 + 4 + 4 + (timesLength * 8));
        const view = new DataView(buffer);
        view.setUint32(0, width, true);
        view.setUint32(4, height, true);
        view.setUint32(8, timesLength, true);
        let offset = 12;
        for(const time of times) {
            view.setFloat64(offset, time, true);
            offset += 8;
        }
        return new Blob([buffer, trf]);
    }

    static async parse(blob) {
        const initBuffer = await blob.slice(0, 12).arrayBuffer();
        const initView = new DataView(initBuffer);
        const width = initView.getUint32(0, true);
        const height = initView.getUint32(4, true);
        const timesLength = initView.getUint32(8, true);
        const trfStart = 12 + (timesLength * 8);

        const times = [];
        const timesBuffer = await blob.slice(12, trfStart).arrayBuffer();
        const timesView = new DataView(timesBuffer);
        for(let i = 0; i < timesLength; i++)
            times.push(timesView.getFloat64(i * 8, true));
        const trf = blob.slice(trfStart);
        return {width, height, times, trf};
    }
}