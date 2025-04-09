#include <emscripten.h>
#include <stdarg.h>
#include "vid.stab/src/libvidstab.h"

#define MOD_NAME "wv"

VSMotionDetect motionDetect;
VSTransformData transformData;
VSManyLocalMotions localMotions;
FILE *f;

int printf2(const char *format, ...) {
    va_list args;
    va_start(args, format);
    char buffer[1024];
    vsnprintf(buffer, sizeof(buffer), format, args);
    va_end(args);
    EM_ASM({console.log(UTF8ToString($0));}, buffer);
    return 0;
}

int init(int width, int height) {
    vs_vector_init(&localMotions, 1024);

    VSFrameInfo frameInfo;
    if(!vsFrameInfoInit(&frameInfo, width, height, PF_GRAY8))
        return 1;
    
    VSMotionDetectConfig motionDetectConfig = vsMotionDetectGetDefaultConfig(MOD_NAME);
    motionDetectConfig.numThreads = 8;

    VSTransformConfig transformConfig = vsTransformGetDefaultConfig(MOD_NAME);
    
    if(vsMotionDetectInit(&motionDetect, &motionDetectConfig, &frameInfo) != VS_OK)
        return 3;

//motionDetect.serializationMode = 1;

    vsMotionDetectGetConfig(&motionDetectConfig, &motionDetect);

    f = fopen("/dev/stdout", "w");
    if(f == NULL)
        return 4;

    if(vsPrepareFile(&motionDetect, f) != VS_OK)
        return 5;

    if(vsTransformDataInit(&transformData, &transformConfig, &frameInfo, &frameInfo) != VS_OK)
        return 6;

    return 0;
}

int addFrame(uint8_t* framePtr) {
    VSFrame vsFrame;
    vsFrame.data[0] = framePtr;
    vsFrame.linesize[0] = motionDetect.fi.width;

    LocalMotions localmotions;
    if(vsMotionDetection(&motionDetect, &localmotions, &vsFrame) != VS_OK)
        return 1;

    if(vsWriteToFile(&motionDetect, f, &localmotions) != VS_OK)
        return 2;

    fflush(f);
    vs_vector_del(&localmotions);
    return 0;
}

int getTransforms(const char* trfFile, int width, int height, int* transformsCountPtr, int* transformsPtr) {
    VSFrameInfo frameInfo;
    if(!vsFrameInfoInit(&frameInfo, width, height, PF_GRAY8))
        return 1;

    VSTransformData transformData;
    VSTransformConfig transformConfig = vsTransformGetDefaultConfig("wv");
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