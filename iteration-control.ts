type AsyncPullFn<PullValue = unknown, PullArgs extends any[] = never[]> = (
	...args: PullArgs
) => Promise<PullValue> | PullValue;
type SyncPullFn<PullValue = unknown, PullArgs extends any[] = never[]> = (
	...args: PullArgs
) => PullValue;
export type IterationState<
	Yield = unknown,
	PullValue = unknown,
	PullArgs extends any[] = never[],
> = {
	enqueue: (...values: Yield[]) => void;
	pulled: PullValue[];
	pull: (...args: PullArgs) => void;
};
export const IterationControlType = Object.freeze({
	yield: 1,
	return: 2,
	continue: 3,
});
type IterationControlType =
	typeof IterationControlType[keyof typeof IterationControlType];
export class IterationControl<Yield, Exit> {
	type: IterationControlType;
	value: Yield[] | Exit | undefined;

	private constructor(
		type: IterationControlType,
		value?: Yield[] | Exit | undefined,
	) {
		this.type = type;
		this.value = value;
	}

	static yield<Yield, Exit = void>(...values: Yield[]): never {
		throw new IterationControl<Yield, Exit>(
			IterationControlType.yield,
			values,
		);
	}
	static return<Yeild, Exit>(): never;
	static return<Yeild, Exit>(value: Exit): never;
	static return<Yeild, Exit>(value?: Exit | undefined): never {
		throw new IterationControl<Yeild, Exit>(
			IterationControlType.return,
			value,
		);
	}
	static continue<Yeild, Exit>(): never {
		throw new IterationControl<Yeild, Exit>(IterationControlType.continue);
	}

	static createAsyncIterator<
		Yield,
		PullValue = unknown,
		PullArgs extends any[] = never[],
		Return = void,
	>(
		iterate: (
			state: IterationState<Yield, PullValue, PullArgs>,
		) => Promise<void> | void,
		pullFn: AsyncPullFn<PullValue, PullArgs> = (() => {}) as AsyncPullFn<
			PullValue,
			PullArgs
		>,
	): AsyncIterableIterator<Yield, Return, void> {
		const queued: Yield[] = [];
		let returnValue: Return | undefined = undefined;
		let hasReturn = false;
		const pullQueue: PullArgs[] = [];
		const state: IterationState<Yield, PullValue, PullArgs> = {
			enqueue: (...values: Yield[]) => {
				queued.push(...values);
			},
			pulled: [],
			pull: (...args) => {
				pullQueue.push([...args] as PullArgs);
			},
		};
		async function* generator(): AsyncIterableIterator<
			Yield,
			Return,
			void
		> {
			while (true) {
				if (queued.length > 0) {
					const first = queued.shift()!;
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
				} catch (result) {
					if (result instanceof IterationControl) {
						if (result.type === IterationControlType.yield) {
							queued.push(...result.value);
						}
						if (result.type === IterationControlType.return) {
							hasReturn = true;
							returnValue = result.value as Return;
						}
						continue;
					}
					throw result;
				}
			}
		}

		return generator();
	}

	static createSyncIterator<
		Yield,
		PullValue = unknown,
		PullArgs extends any[] = never[],
		Return = void,
	>(
		iterate: (
			state: IterationState<Yield, PullValue, PullArgs>,
		) => Promise<void> | void,
		pullFn:
			| SyncPullFn<PullValue, PullArgs>
			| AsyncPullFn<PullValue, PullArgs> = (() => {}) as SyncPullFn<
				PullValue,
				PullArgs
			>,
	): IterableIterator<Yield, Return, void> {
		const queued: Yield[] = [];
		let returnValue: Return | undefined = undefined;
		let hasReturn = false;
		const pullQueue: PullArgs[] = [];
		const state: IterationState<Yield, PullValue, PullArgs> = {
			enqueue: (...values: Yield[]) => {
				queued.push(...values);
			},
			pulled: [],
			pull: (...args) => {
				pullQueue.push([...args] as PullArgs);
			},
		};
		function* generator(): IterableIterator<Yield, Return, void> {
			while (true) {
				if (queued.length > 0) {
					const first = queued.shift()!;
					yield first;
					continue;
				}
				if (hasReturn) {
					return returnValue as Return;
				}
				while (pullQueue.length > 0) {
					const args = pullQueue.shift()!;
					const result = pullFn(...args);
					if (result instanceof Promise) {
						throw new Error(
							"Cannot use async pull function in sync iterator",
						);
					}
					state.pulled.push(result);
				}
				try {
					iterate(state);
				} catch (result) {
					if (result instanceof IterationControl) {
						if (result.type === IterationControlType.yield) {
							queued.push(...result.value);
						}
						if (result.type === IterationControlType.return) {
							hasReturn = true;
							returnValue = result.value as Return;
						}
						continue;
					}
					throw result;
				}
			}
		}

		return generator();
	}
}

export function pullFunction<Fn extends (...args: any[]) => any>(
	...allArgs: PullFunctionArgs<Fn>
): PullFunctionResult<Fn> | Promise<PullFunctionResult<Fn>> {
	const [fn, args, callback] = allArgs;
	const result = fn(...args);
	if (result instanceof Promise) {
		return result.then((result) => {
			return [fn, args, result, callback] as PullFunctionResult<Fn>;
		});
	}
	return [fn, args, result, callback] as PullFunctionResult<Fn>;
}

export type PullFunctionResult<Fn extends (...args: any[]) => any> = [
	Fn,
	Parameters<Fn>,
	ReturnType<Fn>,
	(value: Awaited<ReturnType<Fn>>) => void,
];
export type PullFunctionArgs<Fn extends (...args: any[]) => any> = [
	Fn,
	Parameters<Fn>,
	(value: Awaited<ReturnType<Fn>>) => void,
];
export type PullFunctionIterationState<
	Yield,
	Fn extends (...args: any[]) => any,
> = IterationState<Yield, PullFunctionResult<Fn>, PullFunctionArgs<Fn>>;

export function handlePullResult<Results extends PullFunctionResult<any>[]>(
	pulled: Results,
) {
	while (pulled.length > 0) {
		const pulledItem = pulled.shift()!;
		if (pulled) {
			pulledItem[3](pulledItem[2]);
		}
	}
}
