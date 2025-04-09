import { RendererWebGL } from "./RendererWebGL.js";
import { Streamer } from "./Streamer.js";
import { VidstabDetect } from "./VidstabDetect.js";
import { VidstabTransform } from "./VidstabTransform.js";

//const url = "assets/oojVZSZo4lM.mp4";
//const url = "assets/oojVZSZo4lM-3sec.mp4";
const url = "assets/ohl1kz-JcTg.mp4";
//const url = "assets/GOPR0438.MP4";
//const url = "assets/GOPR0438-30fps-10sec.MP4";
//const transformResolution = {width:640, height:360};
const transformResolution = {width:1280, height:720};
//const transformResolution = {width:1920, height:1080};
const frameCount = 100;

const videoContainer = document.getElementById("videoContainer");
const transformCanvas = document.createElement("canvas");
const transformCanvasCtx = transformCanvas.getContext("2d", {willReadFrequently:true});
const stabilizedCanvasContainer = document.getElementById("stabilizedCanvasContainer");

const progressContainer = document.getElementById("progressContainer");
const progressContainerProgress = document.getElementById("progressContainerProgress");
const progressContainerStats = document.getElementById("progressContainerStats");


async function detect(streamer) {
	const {video} = streamer;
	videoContainer.append(video);

	transformCanvas.width = transformResolution.width;
	transformCanvas.height = transformResolution.height;

	const vidstabDetect = await VidstabDetect.init(transformCanvas.width, transformCanvas.height);

	const stats = {addFrame:{count:0, duration:0}};
	for(let i = 0; i < frameCount; i++) {
		const mediaTime = await streamer.nextFrame();
		if(Number.isNaN(mediaTime))
			break;

		transformCanvasCtx.drawImage(video, 0, 0, transformCanvas.width, transformCanvas.height);
		const imageData = transformCanvasCtx.getImageData(0, 0, transformCanvas.width, transformCanvas.height);
		
		const t1 = performance.now();
		await vidstabDetect.addFrame(imageData, mediaTime);
		stats.addFrame.count++;
		stats.addFrame.duration += performance.now() - t1;

        const detectSpeed = mediaTime / stats.addFrame.duration * 1000;
		const message = [`<p>Frames: ${stats.addFrame.count}</p>`, 
			`<p>Detect: ${(stats.addFrame.duration/stats.addFrame.count)|0}ms (${detectSpeed.toFixed(1)}x)</p>`,
			`<p>Memory: ${(vidstabDetect.memory/1024/1024).toFixed(1)}MB</p>`].join(" ");
		
		progressContainerProgress.value = Math.round((i+1) / frameCount * 100);
		progressContainerStats.innerHTML = message;
		if(stats.addFrame.count === frameCount)
			console.log(message);
	}

	progressContainer.remove();
	return vidstabDetect.finishDetection();
}

async function transform({resolution, video}, blob, times) {
	const {memory, transforms, duration} = await VidstabTransform.getTransforms(blob,
		transformCanvas.width, transformCanvas.height, times);
	console.log(`Blob: ${(blob.size/1024/1024).toFixed(1)}MB, WASM: ${(memory/1024/1024).toFixed(1)}MB, ${duration|0}ms`);

	video.controls = true;
	video.currentTime = 0;
	video.play();

	const renderer = new RendererWebGL(transformCanvas, resolution);
	stabilizedCanvasContainer.append(renderer.canvas);

	const render = (_, metadata) => {
		const time = (metadata?.mediaTime ?? 0);
		const {matching, transform} = VidstabTransform.getTransformByTime(transforms, time);
		renderer.canvas.classList.toggle("matching", matching);
		renderer.render(video, transform);
		if(!matching)
			video.pause();
		video.requestVideoFrameCallback(render);
	}
	render();
}

(async () => {
	const streamer = await Streamer.init(url);
	const {blob, times} = await detect(streamer);
	await transform(streamer, blob, times);
	
})()