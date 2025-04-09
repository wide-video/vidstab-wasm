export class RendererWebGL {
    constructor(transformResolution, mediaResolution) {
        this.transformResolution = transformResolution;

        const canvas = this.canvas = document.createElement("canvas");
        canvas.width = mediaResolution.width;
        canvas.height = mediaResolution.height;
        const gl = this.gl = canvas.getContext("webgl2");
        
        const program = this.program = gl.createProgram();

        const vertexShaderSource = `#version 300 es
            in vec2 a_position;
            in vec2 a_texcoord;
            out vec2 v_texcoord;
            void main() {
                vec2 clipSpace = a_position * 2. - 1.;
				gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
                v_texcoord = a_texcoord;
            }`;
        const vs = this.createShader(program, vertexShaderSource, gl.VERTEX_SHADER);

        // https://github.com/wide-video/vid.stab/blob/master/src/transformfixedpoint.c#L268
        const fragmentShaderSource = `#version 300 es
            precision highp float;
            in vec2 v_texcoord;
            uniform sampler2D u_texture;
            uniform vec2 u_c_t;
            uniform float u_zcos_a;
            uniform float u_zsin_a;
            out vec4 outColor;
            void main() {
                vec2 d1 = v_texcoord - .5;
                float x_s = u_zcos_a * d1.x + u_zsin_a * d1.y + u_c_t.x;
                float y_s = -u_zsin_a * d1.x + u_zcos_a * d1.y + u_c_t.y;
                outColor = texture(u_texture, vec2(x_s, y_s));
            }`;
        const fs = this.createShader(program, fragmentShaderSource, gl.FRAGMENT_SHADER);
        gl.linkProgram(program);
        gl.useProgram(program);


if(!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const vertexInfo = gl.getShaderInfoLog(vs);
    vertexInfo && console.log("Vertex", this.vertexShaderSource, vertexInfo);

    const fragmentInfo = gl.getShaderInfoLog(fs);
    fragmentInfo && console.log("Fragment", this.fragmentShaderSource, fragmentInfo);
}

        const positionAttributeLocation = gl.getAttribLocation(program, "a_position");
        const texcoordAttributeLocation = gl.getAttribLocation(program, "a_texcoord");
        this.textureLocation = gl.getUniformLocation(program, "u_texture");
        this.c_tLocation = gl.getUniformLocation(program, "u_c_t");
        this.zcos_aLocation = gl.getUniformLocation(program, "u_zcos_a");
        this.zsin_aLocation = gl.getUniformLocation(program, "u_zsin_a");

        const vao = gl.createVertexArray();
        gl.bindVertexArray(vao);
      
        const positionBuffer = this.positionBuffer = gl.createBuffer();
        gl.enableVertexAttribArray(positionAttributeLocation);
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);

        const texCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1,  1]), gl.STATIC_DRAW);
        gl.enableVertexAttribArray(texcoordAttributeLocation);
        gl.vertexAttribPointer(texcoordAttributeLocation, 2, gl.FLOAT, false, 0, 0);
		
		const texture = this.texture = gl.createTexture();
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1,
            0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 255, 255]));

        gl.viewport(0, 0, canvas.width, canvas.height);
    }

    createShader(program, source, type) {
		const gl = this.gl;
		const shader = gl.createShader(type);
		gl.shaderSource(shader, source);
		gl.compileShader(shader);
		gl.attachShader(program, shader);
		gl.deleteShader(shader);
		return shader;
	}

    render(video, transform) {
        const {c_tLocation, canvas, gl, positionBuffer,
            texture, textureLocation, transformResolution, zcos_aLocation, zsin_aLocation} = this;
        const {width, height} = canvas;
        const z = 1 - transform.zoom / 100;
        gl.uniform2f(c_tLocation, 
            .5 - (transform.x / transformResolution.width),
            .5 - (transform.y / transformResolution.height));
        gl.uniform1f(zcos_aLocation, z * Math.cos(-transform.alpha));
        gl.uniform1f(zsin_aLocation, z * Math.sin(-transform.alpha));

        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0,  gl.RGBA, gl.UNSIGNED_BYTE, video);
        gl.uniform1i(textureLocation, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
           0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]), gl.STATIC_DRAW);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
}