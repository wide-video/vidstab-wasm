# Vidstab

## Content

- `/demo` - demo HTML app
- `/ffmpeg` - ffmpeg implementation classes (not used in this build)
- `/simpleomp` - files from [Tencent/ncnn](https://github.com/Tencent/ncnn/blob/master/src) and other following emscripten OpenMP minimal implementation [emscripten issue](https://github.com/emscripten-core/emscripten/issues/13892#issuecomment-2599113825) and [Tencent issue](https://github.com/Tencent/ncnn/issues/5977)
- `/wasm` - compiled .wasm artifacts

## Build

Run `build.sh` directly, or via docker:

```sh
docker run -it -v $(pwd):/vidstab -w /vidstab debian:12.5

apt-get update
apt-get install -y git python3.11 xz-utils
ln -sf /usr/bin/python3.11 /usr/bin/python
```

Using existing image:

```sh
docker ps -q -l              # find container ID (or discover via Docker desktop)
docker start 33a1b7c14e73    # restart in the background
docker attach 33a1b7c14e73   # reattach the terminal & stdin
```

## Runtime

### Detection WASM Memory

- 2700x 1280x720 frames -> 48MB -> 20 minutes of 60fps -> 1.3GB
- 2900x 1920x1080 frames -> 60MB -> 20 minutes of 60fps -> 1.5GB

## FFmpeg

FFmpeg examples

```sh
ffmpeg -i oojVZSZo4lM.mp4 -vf vidstabdetect=shakiness=10:accuracy=15:result="oojVZSZo4lM.mp4.trf" -vframes 100 -f null -
ffmpeg -i oojVZSZo4lM.mp4 -vf vidstabtransform=zoom=5:input="oojVZSZo4lM.mp4.trf" oojVZSZo4lM-stab.mp4
```

# Issues

Default `printf()` doesnt seems to log into console when `fopen()` is in use. Solution is a custom printf function:

```c
#include <emscripten.h>
#include <stdarg.h>

int printf3(const char *format, ...) {
  va_list args;
  va_start(args, format);
  char buffer[1024];
  vsnprintf(buffer, sizeof(buffer), format, args);
  va_end(args);
  EM_ASM({console.log(UTF8ToString($0));}, buffer);
  return 0;
}

printf3("v=%d", 1);
```