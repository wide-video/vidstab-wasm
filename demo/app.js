import { RendererWebGL } from "./RendererWebGL.js";
import { Streamer } from "./Streamer.js";
import { VidstabDetect } from "./VidstabDetect.js";
import { VidstabTransform } from "./VidstabTransform.js";
import { WVTrf } from "./WVTrf.js";

const source = {
	url: "assets/oojVZSZo4lM.mp4",
	//url: "assets/oojVZSZo4lM-3sec.mp4",
	//url: "assets/ohl1kz-JcTg.mp4",
	//url: "assets/GOPR0438.MP4",
	//url: "assets/GOPR0438-30fps-10sec.MP4",
	//transformResolution: {width:640, height:360},
	transformResolution: {width:1280, height:720},
	//transformResolution: {width:1920, height:1080},
	frameCount: 300,

	//wvTrfUrl: "assets/GOPR0438.MP4-1280x720-3000.wvtrf",
}

const videoContainer = document.getElementById("videoContainer");
const transformCanvas = document.createElement("canvas");
const transformCanvasCtx = transformCanvas.getContext("2d", {willReadFrequently:true});
const stabilizedCanvasContainer = document.getElementById("stabilizedCanvasContainer");

const progressContainer = document.getElementById("progressContainer");
const progressContainerProgress = document.getElementById("progressContainerProgress");
const progressContainerStats = document.getElementById("progressContainerStats");

const formatMB = bytes => `${(bytes/1024/1024).toFixed(1)}MB`;
const formatMS = duration => `${duration|0}ms`;

async function detect(streamer, width, height, frameCount) {
	const {video} = streamer;

	transformCanvas.width = width;
	transformCanvas.height = height;

	const config = {
		shakiness: undefined,
		accuracy: undefined,
        stepSize: undefined,
		virtualTripod: undefined,
		contrastThreshold: undefined,
		numThreads: navigator.hardwareConcurrency}
	const detector = await VidstabDetect.init(width, height, config);

	const stats = {addFrame:{count:0, duration:0}};
	for(let i = 0; i < frameCount; i++) {
		const mediaTime = await streamer.nextFrame();
		if(Number.isNaN(mediaTime))
			break;

		transformCanvasCtx.drawImage(video, 0, 0, width, height);
		const imageData = transformCanvasCtx.getImageData(0, 0, width, height);
		
		const t1 = performance.now();
		await detector.addFrame(imageData, mediaTime);
		stats.addFrame.count++;
		stats.addFrame.duration += performance.now() - t1;

        const detectSpeed = mediaTime / stats.addFrame.duration * 1000;
		const message = [`<p>Frames: ${stats.addFrame.count}</p>`, 
			`<p>Detect: ${formatMS(stats.addFrame.duration/stats.addFrame.count)} (${detectSpeed.toFixed(1)}x)</p>`,
			`<p>WASM Heap: ${formatMB(detector.heap)}</p>`].join(" ");
		
		progressContainerProgress.value = Math.round((i+1) / frameCount * 100);
		progressContainerStats.innerHTML = message;
		if(stats.addFrame.count === frameCount)
			console.log(message);
	}

	return detector.flush();
}

async function decide(wvTrf, filename) {
	const {promise, resolve} = Promise.withResolvers();

	const link = document.createElement("a");
	link.href = URL.createObjectURL(wvTrf);
	link.download = filename;
	link.innerText = `Download ${filename}`;
	link.onclick = resolve;

	const link2 = document.createElement("a");
	link2.innerText = "Skip";
	link2.onclick = resolve;

	progressContainer.innerHTML = "";
	progressContainer.append(link, link2);
	await promise;
	progressContainer.innerHTML = "";
	return;
}

async function transform(streamer, wvTrfData) {
	const {height, times, trf, width} = wvTrfData;
	progressContainerStats.innerHTML = `Parsing TRF ${formatMB(trf.size)}`;
	console.log(progressContainerStats.innerHTML);
	const config = {
		smoothing: undefined,
		zoom: undefined,
		optZoom: undefined,
		zoomSpeed: undefined,
        interpolType: undefined,
		maxShift: undefined,
		maxAngle: undefined,
		smoothZoom: undefined,
        camPathAlgo: undefined}
	const {heap, transforms, duration} = await VidstabTransform.transform(trf, width, height, times, config);

	console.log(`TRF: ${formatMB(trf.size)}, WASM Heap: ${formatMB(heap)}, ${formatMS(duration)}`);
	progressContainer.remove();

	const {video} = streamer;
	video.controls = true;
	video.currentTime = 0;
	video.play();

	const renderer = new RendererWebGL({width, height}, streamer.resolution);
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
	const {frameCount, transformResolution, url, wvTrfUrl} = source;
	const streamer = await Streamer.init(url);
	videoContainer.append(streamer.video);
	let wvTrf;
	if(wvTrfUrl) {
		wvTrf = await (await fetch(wvTrfUrl)).blob();
	} else {
		const {height, width} = transformResolution;
		const {blob, times} = await detect(streamer, width, height, frameCount);
		wvTrf = WVTrf.create(blob, width, height, times);
		await decide(wvTrf, `${url.split("/").pop()}-${width}x${height}-${frameCount}.wvtrf`);
	}

	const wvTrfData = await WVTrf.parse(wvTrf);
	await transform(streamer, wvTrfData);
})()