# Emscripten
git clone --depth=1 --branch main https://github.com/emscripten-core/emsdk/
(cd emsdk && ./emsdk install 4.0.6)
(cd emsdk && ./emsdk activate 4.0.6)
source ./emsdk/emsdk_env.sh

# openmp
git clone --depth=1 --branch main https://github.com/OpenMP/sources openmp

# vid.stab
git clone --depth=1 --branch wide.video https://github.com/wide-video/vid.stab

mkdir wasm -p

# build simpleomp
em++ simpleomp/simpleomp.cpp -o wasm/simpleomp.o -DNCNN_SIMPLEOMP=1 -O3 -c -flto

# build vidstab
./build-vidstab.sh