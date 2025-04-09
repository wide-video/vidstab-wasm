class RendererCtx {
    constructor(transformResolution, mediaResolution) {
        const canvas = this.canvas = document.createElement("canvas");
        canvas.width = mediaResolution.width;
        canvas.height = mediaResolution.height;
        this.ctx = canvas.getContext("2d", {willReadFrequently:true});
        this.transformResolution = transformResolution;
    }

    render(video, transform) {
        const {canvas:{width, height}, ctx, transformResolution} = this;
        ctx.drawImage(video, 0, 0, width, height);
        const imageData = ctx.getImageData(0, 0, width, height);
        const stabilized = this.transformPacked(imageData, transform, transformResolution);
        ctx.putImageData(stabilized, 0, 0);
    }

    // https://github.com/wide-video/vid.stab/blob/master/src/transformfixedpoint.c#L268
    transformPacked(imageData, t, transformResolution) {
        const {data, width, height} = imageData;
        const sx = width / transformResolution.width;
        const sy = height / transformResolution.height;

        const result = data.slice();
        const c_s_x = width/2;
        const c_s_y = height/2;
        const c_d_x = width/2;
        const c_d_y = height/2;
        const z = 1 - t.zoom / 100;
        const zcos_a = z * Math.cos(-t.alpha);
        const zsin_a = z * Math.sin(-t.alpha);
        const c_tx = c_s_x - (t.x * sx);
        const c_ty = c_s_y - (t.y * sy);
        const channels = 4;

        for(let y = 0; y < height; y++) {
            const y_d1 = y - c_d_y;
            for(let x = 0; x < width; x++) {
                const x_d1 = x - c_d_x;
                const x_s = zcos_a * x_d1 + zsin_a * y_d1 + c_tx;
                if(x_s < 0 || x_s > width)
                    continue;

                const y_s = -zsin_a * x_d1 + zcos_a * y_d1 + c_ty;
                if(y_s < 0 || y_s > height)
                    continue;

                const i_d = (x + y * width) * channels;
                const i_s = ((x_s|0) + (y_s|0) * width) * channels;
                for(let k = 0; k < channels; k++)
                    result[i_d+k] = data[i_s+k];
            }
        }

        return new ImageData(result, width, height);
    }
}