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