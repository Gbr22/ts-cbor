type IterationControlType = "yield" | "return" | "continue";
type AsyncPullFn<PullValue = unknown, PullArgs extends any[] = never[]> = (...args: PullArgs)=>Promise<PullValue> | PullValue;
type SyncPullFn<PullValue = unknown, PullArgs extends any[] = never[]> = (...args: PullArgs)=>PullValue;
export type IterationState<Yield = unknown, PullValue = unknown, PullArgs extends any[] = never[]> = {
    enqueue: (...values: Yield[]) => void;
    pulled: PullValue[]
    pull: (...args: PullArgs)=>void;
};
export class IterationControl<Yield, Exit> {
    type: IterationControlType;
    value: Yield[] | Exit | undefined

    private constructor(type: IterationControlType, value?: Yield[] | Exit | undefined) {
        this.type = type;
        this.value = value;
    }

    static yield<Yield, Exit = void>(...values: Yield[]): never {
        throw new IterationControl<Yield, Exit>("yield", values);
    }
    static return<Yeild, Exit>(): never
    static return<Yeild, Exit>(value: Exit): never
    static return<Yeild, Exit>(value?: Exit | undefined): never {
        throw new IterationControl<Yeild, Exit>("return",value);
    }
    static continue<Yeild, Exit>(): never {
        throw new IterationControl<Yeild, Exit>("continue");
    }

    static createAsyncIterator<
        Yield,
        PullValue = unknown,
        PullArgs extends any[] = never[],
        Return = void
    >(
        iterate: (state: IterationState<Yield,PullValue,PullArgs>)=>Promise<void> | void,
        pullFn: AsyncPullFn<PullValue,PullArgs> = (()=>{}) as AsyncPullFn<PullValue,PullArgs>
    ): AsyncIterableIterator<Yield,Return,void> {
        const queued: Yield[] = [];
        let returnValue: Return | undefined = undefined;
        let hasReturn = false;
        const pullQueue: PullArgs[] = [];
        const state: IterationState<Yield,PullValue,PullArgs> = {
            enqueue: (...values: Yield[]) => {
                queued.push(...values);
            },
            pulled: [],
            pull: (...args)=>{
                pullQueue.push([...args] as PullArgs);
            },
        }
        async function* generator(): AsyncIterableIterator<Yield,Return,void> {
            while (true) {
                const first = queued.shift();
                if (first !== undefined) {
                    yield first;
                    continue;
                }
                if (hasReturn) {
                    return returnValue as Return;
                }
                while (pullQueue.length > 0) {
                    const args = pullQueue.shift()!;
                    const result = await pullFn(...args);
                    state.pulled.push(result);
                }
                try {
                    await iterate(state);
                } catch(result) {
                    if (result instanceof IterationControl) {
                        if (result.type === "yield") {
                            queued.push(...result.value);
                        }
                        if (result.type === "return") {
                            hasReturn = true;
                            returnValue = result.value as Return;
                        }
                        continue;
                    }
                    throw result;
                }
            }
        };

        return generator();
    }

    static createSyncIterator<
        Yield,
        PullValue = unknown,
        PullArgs extends any[] = never[],
        Return = void
    >(
        iterate: (state: IterationState<Yield,PullValue,PullArgs>)=>Promise<void> | void,
        pullFn: SyncPullFn<PullValue,PullArgs> = (()=>{}) as SyncPullFn<PullValue,PullArgs>
    ): IterableIterator<Yield,Return,void> {
        const queued: Yield[] = [];
        let returnValue: Return | undefined = undefined;
        let hasReturn = false;
        const pullQueue: PullArgs[] = [];
        const state: IterationState<Yield,PullValue,PullArgs> = {
            enqueue: (...values: Yield[]) => {
                queued.push(...values);
            },
            pulled: [],
            pull: (...args)=>{
                pullQueue.push([...args] as PullArgs);
            },
        }
        function* generator(): IterableIterator<Yield,Return,void> {
            while (true) {
                const first = queued.shift();
                if (first !== undefined) {
                    yield first;
                    continue;
                }
                if (hasReturn) {
                    return returnValue as Return;
                }
                while (pullQueue.length > 0) {
                    const args = pullQueue.shift()!;
                    const result = pullFn(...args);
                    state.pulled.push(result);
                }
                try {
                    iterate(state);
                } catch(result) {
                    if (result instanceof IterationControl) {
                        if (result.type === "yield") {
                            queued.push(...result.value);
                        }
                        if (result.type === "return") {
                            hasReturn = true;
                            returnValue = result.value as Return;
                        }
                        continue;
                    }
                    throw result;
                }
            }
        };

        return generator();
    }
};
