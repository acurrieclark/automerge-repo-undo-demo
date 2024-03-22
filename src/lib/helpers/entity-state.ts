import type { EntityState, GetIdType, HasId } from '@onsetsoftware/entity-state';

export const createEntityState = <R extends HasId<R>>(data: R[]): EntityState<R> => {
	const ids: GetIdType<R>[] = data.map((d) => d.id);
	const entities = data.reduce(
		(acc, d) => {
			acc[d.id] = d;
			return acc;
		},
		{} as Record<GetIdType<R>, R>
	);

	return { ids, entities };
};
