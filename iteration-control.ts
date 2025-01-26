type IterationControlType = "yield" | "return" | "continue";
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

    static createIterator<Yield, Return = void>(iterate: ()=>Promise<void>): AsyncIterableIterator<Yield,Return,void> {
        async function* generator(): AsyncIterableIterator<Yield,Return,void> {
            while (true) {
                try {
                    await iterate();
                } catch(result) {
                    if (result instanceof IterationControl) {
                        if (result.type === "yield") {
                            yield* result.value;
                        }
                        if (result.type === "return") {
                            return result.value;
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
