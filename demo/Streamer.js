export class Streamer {
    get resolution() {
        const {video} = this;
        return {width:video.videoWidth, height:video.videoHeight};
    }

    static async init(url) {
        const result = new Streamer();
        const video = document.createElement("video");
        video.muted = true;
        video.src = url;

        const endedPromise = Promise.withResolvers();
        video.addEventListener("ended", () => endedPromise.resolve({mediaTime:Number.NaN}), {once:true});
        result.endedPromise = endedPromise.promise;
        //video.playbackRate = 0.5; // slower nextFrame() but less frame drops
        
        await new Promise(resolve => video.onloadedmetadata = resolve);
        result.video = video;
        return result;
    }

    async nextFrame() {
        const {endedPromise, video} = this;
        video.play();
        const requestPromise = new Promise(resolve =>
            video.requestVideoFrameCallback((_, metadata) => resolve(metadata)));
        const {mediaTime} = await Promise.race([endedPromise, requestPromise]);
        video.pause();
        return mediaTime;
    }
}