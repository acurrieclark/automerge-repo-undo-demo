import type { EntityState } from '@onsetsoftware/entity-state';
import type { GridStackWidget } from 'gridstack';

export type GridStackCell = GridStackWidget & {
	id: string;
};

export type GridData = {
	children: EntityState<GridStackCell>;
	rows: number;
};

export type GridState = {
	selected: string[];
};
