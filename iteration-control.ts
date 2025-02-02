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
	Return = void,
> = {
	enqueue: (...values: Yield[]) => void;
	pulled: PullValue[];
	pull: (...args: PullArgs) => Promise<void> | void;
	return: (value: Return) => void;
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

	static createReadableStream<
		Yield,
		PullValue = unknown,
		PullArgs extends any[] = never[],
	>(
		iterate: (
			state: IterationState<Yield, PullValue, PullArgs, void>,
		) => Promise<void> | unknown,
		pullFn: AsyncPullFn<PullValue, PullArgs> = (() => {}) as AsyncPullFn<
			PullValue,
			PullArgs
		>,
	): ReadableStream<Yield> {
		let state: IterationState<Yield, PullValue, PullArgs, void>;
		let hasReturn = false;
		let enqueuedCount = 0;
		return new ReadableStream({
			start(controller) {
				state = {
					enqueue: (...values: Yield[]) => {
						controller.enqueue(...values);
						enqueuedCount++;
					},
					pulled: [],
					pull: async (...args) => {
						state.pulled.push(await pullFn(...args));
					},
					return: () => {
						hasReturn = true;
						controller.close();
					},
				};
			},
			async pull(controller) {
				const startCount = enqueuedCount;
				while (startCount === enqueuedCount) {
					if (hasReturn) {
						controller.close();
						return;
					}
					await iterate(state);
				}
			},
		});
	}

	static createSyncIterator<
		Yield,
		PullValue = unknown,
		PullArgs extends any[] = never[],
		Return = void,
	>(
		iterate: (
			state: IterationState<Yield, PullValue, PullArgs, Return>,
		) => Promise<void> | unknown,
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
		const state: IterationState<Yield, PullValue, PullArgs, Return> = {
			enqueue: (...values: Yield[]) => {
				queued.push(...values);
			},
			pulled: [],
			pull: (...args) => {
				pullQueue.push([...args] as PullArgs);
			},
			return: (value: Return) => {
				returnValue = value;
				hasReturn = true;
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
		pulledItem[3](pulledItem[2]);
	}
}
