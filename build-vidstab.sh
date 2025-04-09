ROOT_DIR=$PWD
WASM_DIR=$ROOT_DIR/wasm
OUTPUT="$WASM_DIR/vidstab.js"

FLAGS=(
	# Sources
	vidstab.c
	$WASM_DIR/simpleomp.o
	vid.stab/src/boxblur.c
	vid.stab/src/frameinfo.c
	vid.stab/src/libvidstab.c
	vid.stab/src/localmotion2transform.c
	vid.stab/src/motiondetect.c
	vid.stab/src/serialize.c
	vid.stab/src/transform.c
	vid.stab/src/transformfixedpoint.c
	vid.stab/src/transformtype.c
	vid.stab/src/vsvector.c
	-Iopenmp/include

	# Threads
	-DUSE_OMP=1 -fopenmp -pthread
	-sPTHREAD_POOL_SIZE=1 # (openmp issue?) runtime hangs when pool size not set

	# Emscripten
	-lworkerfs.js
	-s EXPORTED_FUNCTIONS="[_init, _addFrame, _getTransforms, _exit, _malloc]"
	-s EXPORTED_RUNTIME_METHODS="[ccall, FS, WORKERFS]"
	-s EXIT_RUNTIME=1

	# Performance
	# debug: -s ASSERTIONS=1 -Og -g
	-s ASSERTIONS=0 -O3 -msimd128 -mavx2

	# Memory
	-s INITIAL_MEMORY=1MB -s ALLOW_MEMORY_GROWTH=1 -s MAXIMUM_MEMORY=4gb

	# Output
	-s WASM=1
	-s ENVIRONMENT=worker
	-s MODULARIZE=1
	-s EXPORT_NAME="createVidstab"
	-o $OUTPUT
)

emcc "${FLAGS[@]}"

# Modifies Module.stdout API as function(buffer, offset, length)
replace()
{
	if ! grep -qF "$1" "$3"; then
		echo "$3 does not contain expected $1"
		exit 1
	fi
	ESCAPED_FROM=$(printf '%s\n' "$1" | sed -e 's/[]\/$*.^[]/\\&/g');
	ESCAPED_TO=$(printf '%s\n' "$2" | sed -e 's/[\/&]/\\&/g');
	sed -i -e "s/$ESCAPED_FROM/$ESCAPED_TO/g" $3
}

replace "for(var i=0;i<length;i++){try{output(buffer[offset+i])}catch(e){throw new FS.ErrnoError(29)}}" \
	"let i = length;try{output(buffer, offset, length)}catch(e){throw new FS.ErrnoError(29)}" \
	$OUTPUT