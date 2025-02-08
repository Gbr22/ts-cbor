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
	pull: (...args: PullArgs) => void;
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

	static createAsyncIterator<
		Yield,
		PullValue = unknown,
		PullArgs extends any[] = never[],
		Return = void,
	>(
		iterate: (
			state: IterationState<Yield, PullValue, PullArgs, Return>,
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
		async function* generator(): AsyncIterableIterator<
			Yield,
			Return,
			void
		> {
			while (true) {
				for (const value of queued) {
					yield value;
				}
				queued.length = 0;

				if (hasReturn) {
					return returnValue as Return;
				}

				for (const args of pullQueue) {
					const result = await pullFn(...args);
					state.pulled.push(result);
				}
				pullQueue.length = 0;

				await iterate(state);
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
			state: IterationState<Yield, PullValue, PullArgs, Return>,
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
				for (const value of queued) {
					yield value;
				}
				queued.length = 0;

				if (hasReturn) {
					return returnValue as Return;
				}

				for (const args of pullQueue) {
					const result = pullFn(...args);
					if (result instanceof Promise) {
						throw new Error(
							"Cannot use async pull function in sync iterator",
						);
					}
					state.pulled.push(result);
				}
				pullQueue.length = 0;

				iterate(state);
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
