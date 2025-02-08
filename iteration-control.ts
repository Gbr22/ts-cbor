type AsyncPullFn<PullValue = unknown, PullArgs extends any[] = never[]> = (
	...args: PullArgs
) => Promise<PullValue> | PullValue;
type SyncPullFn<PullValue = unknown, PullArgs extends any[] = never[]> = (
	...args: PullArgs
) => PullValue;
export type IterationState<
	Yield = unknown,
	PullValue = unknown,
	PullArgs extends any[] = [],
	Return = void,
> = {
	enqueue: (...values: Yield[]) => void;
	pulled: PullValue[];
	pull: (
		fn: (value: PullValue) => void,
		...args: PullArgs
	) => Promise<void> | void;
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
		) => Promise<unknown> | unknown,
		pullFn: AsyncPullFn<PullValue, PullArgs> = (() => {}) as AsyncPullFn<
			PullValue,
			PullArgs
		>,
	): AsyncIterableIterator<Yield, Return, void> {
		const queued: Yield[] = [];
		let returnValue: Return | undefined = undefined;
		let hasReturn = false;
		const state: IterationState<Yield, PullValue, PullArgs, Return> = {
			enqueue: (...values: Yield[]) => {
				queued.push(...values);
			},
			pulled: [],
			pull: async (fn, ...args) => {
				const result = await pullFn(...args);
				fn(result);
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
		) => Promise<unknown> | unknown,
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
		const state: IterationState<Yield, PullValue, PullArgs, Return> = {
			enqueue: (...values: Yield[]) => {
				queued.push(...values);
			},
			pulled: [],
			pull: (fn, ...args) => {
				const result = pullFn(...args);
				if (result instanceof Promise) {
					throw new Error(
						"Cannot use async pull function in sync iterator",
					);
				}
				fn(result);
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
