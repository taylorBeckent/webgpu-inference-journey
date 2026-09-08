// Worker 内部：接收消息，处理，发回结果
self.onmessage = (e) => {
    const { type, data } = e.data;

    if (type === 'compute') {
        // 模拟重计算
        const result = new Float32Array(data.size);
        for (let i = 0; i < data.size; i++) {
            result[i] = Math.sqrt(i) * Math.sin(i);
        }
        // 把结果转移回主线程（零拷贝）
        self.postMessage({ type: 'result', data: result }, [result.buffer]);
    }
};

/**
 * Promise 化的worker封装
 * 用法：
 * const worker = createWorker('worker.js');
 * const result = await worker.send({type: 'compute', data: ...});
*/
const createWorker = (url) => {
    const worker = new Worker(url);
    const pending = new Map(); // messageId -> { resolve, reject }
    let id = 0;

    worker.onmessage = (e) => {
        const { id, result, error } = e.data;
        const p = pending.get(id);
        if (!p) return;
        pending.delete(id);
        if (error) e.reject(new Error(error));
        else p.resolve(result);
    };

    worker.onerror = e => {
        // Worker 内部报错， 拒绝所有的pending
        for (const [, p] of pending) {
            p.reject(new Error(e.message));
        }
        pending.clear();
    };

    const send = (data, transfer = []) => {
        const messageId = ++id;
        return new Promise((resolve, reject) => {
            pending.set(messageId, { resolve, reject });
            worker.postMessage({ id: messageId, ...data }, transfer);
        });
    };

    const terminate = () => {
        worker.terminate();
        pending.clear();
    };

    return { send, terminate, worker }
}

self.onmessage = async (e) => {
    const { id, type, data } = e.data;
    try {
        let result;
        if (type === 'compute') {
            result = heavyCompute(data);
        }
        self.postMessage({ id, result }, [result?.buffer].filter(Boolean));
    } catch (err) {
        self.postMessage({ id, error: err.message });
    }
}

//. worker池 - 并发控制
class WorkerPool {
    constructor(workerUrl, size = navigator.hardwareConcurrency || 4) {
        this.workers = [];
        this.queue = [];
        this.active = 0;
        this.maxSize = size;

        for (let i = 0; i < size; i++) {
            this.workers.push(createWorker(workerUrl));
        }
    }

    async run(data, transfer = []) {
        if (this.active >= this.maxSize) {
            // 池子满了，排队等
            await new Promise(resolve => this.queue.push(resolve));
        }

        this.active++;
        const worker = this.workers.find(w => !w._busy) || this.workers[0];
        worker._busy = true;

        try {
            return await worker.send(data, transfer);
        } finally {
            worker._busy = false;
            this.active--;
            //. 释放一个排队的任务
            if (this.queue.length > 0) {
                this.queue.shift()();
            }
        }
    }

    terminate() {
        this.workers.forEach(w => w.terminate());
    }
}

//. 使用
const pool = new WorkerPool('worker.js', 4);
const results = await Promise.all(TaskSignal.map(task => pool.run(task)));