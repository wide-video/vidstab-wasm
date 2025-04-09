class BlobBuilder {
    pendingSize = 0;
    maxPendingSize = 1024 * 1024 * 10;

    get size() {
        return (this.blob?.size ?? 0) + this.pendingSize;
    }

    add(buffer) {
        const {blob, maxPendingSize} = this;
        const pending = this.pending ??= [];
        if(!pending.length && blob)
            pending.push(blob);
        pending.push(buffer);
        const pendingSize = this.pendingSize += buffer.byteLength;
        if(pendingSize > maxPendingSize)
            this.flush();
    }

    flush() {
        const result = this.blob = new Blob(this.pending);
        this.pending = undefined;
        this.pendingSize = 0;
        return result;
    }
}