#include "vid.stab/src/libvidstab.h"

#define MOD_NAME "vidstab-wasm"

VSMotionDetect motionDetect;
VSTransformData transformData;
VSManyLocalMotions localMotions;
FILE *f;

int detectInit(int width, int height,
    int shakiness, int accuracy, int stepSize, int virtualTripod,
    double contrastThreshold, int numThreads) {
    if(vs_vector_init(&localMotions, 1024) != VS_OK)
        return 1;

    VSFrameInfo frameInfo;
    if(!vsFrameInfoInit(&frameInfo, width, height, PF_GRAY8))
        return 2;
    
    VSMotionDetectConfig motionDetectConfig = vsMotionDetectGetDefaultConfig(MOD_NAME);
    if(shakiness != -1)
        motionDetectConfig.shakiness = shakiness;
    if(accuracy != -1)
        motionDetectConfig.accuracy = accuracy;
    if(stepSize != -1)
        motionDetectConfig.stepSize = stepSize;
    if(virtualTripod != -1)
        motionDetectConfig.virtualTripod = virtualTripod;
    if(contrastThreshold != -1)
        motionDetectConfig.contrastThreshold = contrastThreshold;
    if(numThreads != -1)
        motionDetectConfig.numThreads = numThreads;
    
    vs_log_info(MOD_NAME, "Detect Config:");
    vs_log_info(MOD_NAME, "    shakiness: %i\n", motionDetectConfig.shakiness);
    vs_log_info(MOD_NAME, "    accuracy: %i\n", motionDetectConfig.accuracy);
    vs_log_info(MOD_NAME, "    stepSize: %i\n", motionDetectConfig.stepSize);
    vs_log_info(MOD_NAME, "    virtualTripod: %i\n", motionDetectConfig.virtualTripod);
    vs_log_info(MOD_NAME, "    contrastThreshold: %f\n", motionDetectConfig.contrastThreshold);
    vs_log_info(MOD_NAME, "    numThreads: %i\n", motionDetectConfig.numThreads);
    
    if(vsMotionDetectInit(&motionDetect, &motionDetectConfig, &frameInfo) != VS_OK)
        return 3;

    f = fopen("/dev/stdout", "w");
    if(f == NULL)
        return 4;

    if(vsPrepareFile(&motionDetect, f) != VS_OK)
        return 5;

    return 0;
}

int detectAddFrame(uint8_t* framePtr) {
    VSFrame vsFrame;
    vsFrame.data[0] = framePtr;
    vsFrame.linesize[0] = motionDetect.fi.width;

    LocalMotions localmotions;
    if(vsMotionDetection(&motionDetect, &localmotions, &vsFrame) != VS_OK)
        return 1;

    if(vsWriteToFile(&motionDetect, f, &localmotions) != VS_OK)
        return 2;

    if(vs_vector_del(&localmotions) != VS_OK)
        return 3;

    return 0;
}

int transform(const char* trfFile, int width, int height,
    int smoothing, double zoom, int optZoom, double zoomSpeed,
    int maxShift, double maxAngle, int smoothZoom, VSCamPathAlgo camPathAlgo,
    int* transformsCountPtr, int* transformsPtr) {
    VSFrameInfo frameInfo;
    if(!vsFrameInfoInit(&frameInfo, width, height, PF_GRAY8))
        return 1;

    VSTransformData transformData;
    VSTransformConfig transformConfig = vsTransformGetDefaultConfig(MOD_NAME);
    if(smoothing != -1)
        transformConfig.smoothing = smoothing;
    if(zoom != -1)
        transformConfig.zoom = zoom;
    if(optZoom != -1)
        transformConfig.optZoom = optZoom;
    if(zoomSpeed != -1)
        transformConfig.zoomSpeed = zoomSpeed;
    if(maxShift != -1)
        transformConfig.maxShift = maxShift;
    if(maxAngle != -1)
        transformConfig.maxAngle = maxAngle;
    if(smoothZoom != -1)
        transformConfig.smoothZoom = smoothZoom;
    if(camPathAlgo != -1)
        transformConfig.camPathAlgo = camPathAlgo;

    vs_log_info(MOD_NAME, "Transform Config:");
    vs_log_info(MOD_NAME, "    smoothing: %i\n", transformConfig.smoothing);
    vs_log_info(MOD_NAME, "    zoom: %f\n", transformConfig.zoom);
    vs_log_info(MOD_NAME, "    optZoom: %i\n", transformConfig.optZoom);
    vs_log_info(MOD_NAME, "    zoomSpeed: %f\n", transformConfig.zoomSpeed);
    vs_log_info(MOD_NAME, "    maxShift: %i\n", transformConfig.maxShift);
    vs_log_info(MOD_NAME, "    maxAngle: %f\n", transformConfig.maxAngle);
    vs_log_info(MOD_NAME, "    smoothZoom: %i\n", transformConfig.smoothZoom);
    vs_log_info(MOD_NAME, "    camPathAlgo: %i\n", transformConfig.camPathAlgo);

    if(vsTransformDataInit(&transformData, &transformConfig, &frameInfo, &frameInfo) != VS_OK)
        return 2;

    VSTransformations transformations;
    vsTransformationsInit(&transformations);

    FILE *f = fopen(trfFile, "rb");
    if(!f)
        return 3;

    VSManyLocalMotions localMotions;
    int readFileResult = vsReadLocalMotionsFile(f, &localMotions);
    fclose(f);
    
    if(readFileResult != VS_OK)
        return 4;

    if(vsLocalmotions2Transforms(&transformData, &localMotions, &transformations) != VS_OK)
        return 5;

    if(vsPreprocessTransforms(&transformData, &transformations) != VS_OK)
        return 6;

    *transformsCountPtr = transformations.len;
    *transformsPtr = (uintptr_t)transformations.ts;
    return 0;
}