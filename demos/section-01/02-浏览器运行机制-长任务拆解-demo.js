// 1. 检测长任务的方式 - PerformanceObserver
const observer = new PerformanceObserver(list => {
    for (const entry of list.getEntries()) {
        console.log('检测到长任务:', {
            开始时间: entry.startTime,
            耗时: entry.duration,
            来源: entry.name
        });
    }
})

observer.observe({ type: 'longtask', buffered: true });


// 2. 长任务拆分模板
/**
 * 通用分片处理函数
 * @param {Array} items - 要处理的数据
 * @param {number} chunkSize - 每片处理多少条
 * @param {Function} processItem - 处理单条数据的函数
 * @param {AbortSignal} [signal] - 可选的中断信号
*/
const processInChunks = async (items, chunkSize, processItem, signal) => {
    for (let i = 0; i < items.length; i += chunkSize) {
        // 检查是否中断
        if (signal?.aborted) return;

        const end = Math.min(i + chunkSize, items.length);
        for (let j = i; j < end; j++) {
            processItem(item[j], j);
        }

        // 每片处理完，让出主线程
        await yieldToMain();
    }
}

// 让出主线程的兼容写法
const yieldToMain = () => {
    if (typeof scheduler !== 'undefined' && scheduler.yield) {
        return scheduler.yield();
    }

    return new Promise(resolve => setTimeout(resolve, 0));
}