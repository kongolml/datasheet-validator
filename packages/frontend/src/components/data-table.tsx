import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	getSortedRowModel,
	type SortingState,
	useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useState, useCallback, useRef, useEffect, memo } from "react";
import type {
	Column,
	Row,
	CellValue,
	CellType,
	ValidationError,
} from "@data-validator/validator-mastermind";
import { ArrowUpDown, OctagonAlert } from "lucide-react";

import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Field } from "./ui/field";

function formatCellValue(value: CellValue, type: CellType): string {
	if (value === null || value === undefined) return "—";
	switch (type) {
		case "boolean":
			return value ? "Yes" : "No";
		case "number":
			return typeof value === "number" ? value.toLocaleString() : String(value);
		case "date":
			if (typeof value === "string") {
				const date = new Date(value);
				if (!isNaN(date.getTime())) return date.toLocaleDateString();
			}
			return String(value);
		default:
			return String(value);
	}
}

function parseEditValue(input: string, type: CellType): CellValue {
	if (input.trim() === "") return null;
	switch (type) {
		case "number": {
			const num = Number(input);
			return isNaN(num) ? input : num;
		}
		case "boolean": {
			const lower = input.toLowerCase();
			if (["true", "yes", "1"].includes(lower)) return true;
			if (["false", "no", "0"].includes(lower)) return false;
			return input;
		}
		default:
			return input;
	}
}


interface EditableCellProps {
	value: CellValue;
	columnKey: string;
	columnType: CellType;
	rowId: string;
	errors: ValidationError[];
	onUpdate: (rowId: string, columnKey: string, value: CellValue) => void;
}

const EditableCell = memo(function EditableCell({
	value,
	columnKey,
	columnType,
	rowId,
	errors,
	onUpdate,
}: EditableCellProps) {
	const [open, setOpen] = useState(false);
	const [editValue, setEditValue] = useState(() =>
		value === null || value === undefined ? "" : String(value),
	);
	const [pendingBool, setPendingBool] = useState<boolean>(() => value === true);
	const [pendingDate, setPendingDate] = useState<Date | undefined>(() => {
		if (value && typeof value === "string") {
			const d = new Date(value);
			return isNaN(d.getTime()) ? undefined : d;
		}
		return undefined;
	});
	const inputRef = useRef<HTMLInputElement>(null);
	const hasErrors = errors.length > 0;

	useEffect(() => {
		if (!open) {
			setEditValue(value === null || value === undefined ? "" : String(value));
			setPendingBool(value === true);
			setPendingDate(() => {
				if (value && typeof value === "string") {
					const d = new Date(value);
					return isNaN(d.getTime()) ? undefined : d;
				}
				return undefined;
			});
		}
	}, [value, open]);

	useEffect(() => {
		if (
			open &&
			(columnType === "string" || columnType === "number") &&
			inputRef.current
		) {
			inputRef.current.focus();
			inputRef.current.select();
		}
	}, [open, columnType]);

	const handleSave = useCallback(() => {
		let newValue: CellValue;
		switch (columnType) {
			case "string":
			case "number":
				newValue = parseEditValue(editValue, columnType);
				break;
			case "boolean":
				newValue = pendingBool;
				break;
			case "date":
				newValue = pendingDate ? pendingDate.toISOString().split("T")[0] : null;
				break;
		}
		if (newValue !== value) {
			onUpdate(rowId, columnKey, newValue);
		}
		setOpen(false);
	}, [columnType, editValue, pendingBool, pendingDate, value, onUpdate, rowId, columnKey]);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === "Enter") {
				e.preventDefault();
				handleSave();
			}
		},
		[handleSave],
	);

	function renderContent() {
		switch (columnType) {
			case "string":
				return (
					<Input
						ref={inputRef}
						type="text"
						value={editValue}
						onChange={(e) => setEditValue(e.target.value)}
						onKeyDown={handleKeyDown}
						aria-label={`Edit ${columnKey}`}
						aria-invalid={hasErrors || undefined}
					/>
				);
			case "number":
				return (
					<Input
						ref={inputRef}
						type="number"
						value={editValue}
						onChange={(e) => setEditValue(e.target.value)}
						onKeyDown={handleKeyDown}
						aria-label={`Edit ${columnKey}`}
						aria-invalid={hasErrors || undefined}
					/>
				);
			case "boolean":
				return (
					<div className="flex items-center gap-2 px-1 py-1">
						<Checkbox
							id={`${rowId}-${columnKey}`}
							checked={pendingBool}
							onCheckedChange={(next) => setPendingBool(next === true)}
						/>
						<label
							htmlFor={`${rowId}-${columnKey}`}
							className="cursor-pointer select-none text-sm"
						>
							{pendingBool ? "True" : "False"}
						</label>
					</div>
				);
			case "date":
				return (
					<Calendar
						mode="single"
						selected={pendingDate}
						onSelect={(date) => setPendingDate(date ?? undefined)}
					/>
				);
		}
	}

	const isTextInput = columnType === "string" || columnType === "number";

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<div
					className={cn(
						"flex h-8 cursor-pointer items-center gap-1 rounded px-1 -mx-1 hover:bg-muted/50",
						hasErrors && "text-destructive",
					)}
					tabIndex={0}
					role="gridcell"
					title="Click to edit"
				>
					<span>{formatCellValue(value, columnType)}</span>
					{hasErrors && (
						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger asChild>
									<OctagonAlert size={16} className="text-destructive" />
								</TooltipTrigger>
								<TooltipContent>
									{errors.map((e) => e.message).join(", ")}
								</TooltipContent>
							</Tooltip>
						</TooltipProvider>
					)}
				</div>
			</PopoverTrigger>
			<PopoverContent
				align="start"
				className={cn(
					"w-64",
					isTextInput && "w-[--radix-popover-trigger-width] p-1",
					columnType === "boolean" && "w-auto p-2",
					columnType === "date" && "w-auto p-0",
				)}
			>
				<div className="flex w-full flex-col gap-4">
					{renderContent()}

					<Field orientation="horizontal">
						<Button variant="outline" size="sm" onClick={() => setOpen(false)}>
							Cancel
						</Button>

						<Button variant="outline" size="sm" onClick={handleSave}>
							Save
						</Button>
					</Field>
				</div>
			</PopoverContent>
		</Popover>
	);
});

function buildColumns(
	columns: Column[],
	onCellUpdate?: (rowId: string, columnKey: string, value: CellValue) => void,
): ColumnDef<Row>[] {
	return columns.map((col) => ({
		accessorFn: (row: Row) => row.cells[col.key],
		id: col.key,
		header: ({ column }) => (
			<Button
				variant="ghost"
				size="sm"
				className="-ml-3"
				onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
			>
				{col.label}
				<ArrowUpDown className="ml-2 size-4" />
			</Button>
		),
		cell: ({ row: tableRow }) => {
			const value = tableRow.original.cells[col.key];
			const errors = tableRow.original.errors[col.key] ?? [];

			if (onCellUpdate) {
				return (
					<EditableCell
						value={value}
						columnKey={col.key}
						columnType={col.type}
						rowId={tableRow.original.id}
						errors={errors}
						onUpdate={onCellUpdate}
					/>
				);
			}
			return (
				<div
					className={cn(
						"flex items-center gap-1",
						errors.length > 0 && "text-destructive",
					)}
				>
					<span>{formatCellValue(value, col.type)}</span>
					{errors.length > 0 && (
						<span
							className="text-destructive text-xs"
							title={errors.map((e) => e.message).join(", ")}
						>
							⚠
						</span>
					)}
				</div>
			);
		},
	}));
}

interface DataTableProps {
	columns: Column[];
	rows: Row[];
	onCellUpdate?: (rowId: string, columnKey: string, value: CellValue) => void;
	className?: string;
	height?: string;
}

function DataTable({ columns, rows, onCellUpdate, className, height = "600px" }: DataTableProps) {
	const [sorting, setSorting] = useState<SortingState>([]);
	const parentRef = useRef<HTMLDivElement>(null);

	const tableColumns = buildColumns(columns, onCellUpdate);

	const table = useReactTable({
		data: rows,
		columns: tableColumns,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		onSortingChange: setSorting,
		state: { sorting },
		getRowId: (row) => row.id,
	});

	const tableRows = table.getRowModel().rows;

	const rowVirtualizer = useVirtualizer({
		count: tableRows.length,
		getScrollElement: () => parentRef.current,
		estimateSize: () => 44,
		overscan: 10,
	});

	const virtualRows = rowVirtualizer.getVirtualItems();
	const totalSize = rowVirtualizer.getTotalSize();
	const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
	const paddingBottom =
		virtualRows.length > 0 ? totalSize - virtualRows[virtualRows.length - 1].end : 0;

	return (
		<div className={cn("space-y-4", className)}>
			<div ref={parentRef} className="overflow-auto rounded-md border" style={{ height }}>
				<Table>
					<TableHeader className="sticky top-0 z-10 bg-background">
						{table.getHeaderGroups().map((headerGroup) => (
							<TableRow key={headerGroup.id}>
								<TableHead className="w-10 text-right text-muted-foreground">#</TableHead>
								{headerGroup.headers.map((header) => (
									<TableHead key={header.id}>
										{header.isPlaceholder
											? null
											: flexRender(
													header.column.columnDef.header,
													header.getContext(),
												)}
									</TableHead>
								))}
							</TableRow>
						))}
					</TableHeader>
					<TableBody>
						{tableRows.length ? (
							<>
								{paddingTop > 0 && (
									<TableRow>
										<TableCell
											colSpan={tableColumns.length + 1}
											style={{ height: `${paddingTop}px`, padding: 0 }}
										/>
									</TableRow>
								)}
								{virtualRows.map((virtualRow) => {
									const row = tableRows[virtualRow.index];
									return (
										<TableRow key={row.id}>
											<TableCell className="w-10 text-right text-xs text-muted-foreground tabular-nums">
												{virtualRow.index + 1}
											</TableCell>
											{row.getVisibleCells().map((cell) => (
												<TableCell key={cell.id}>
													{flexRender(
														cell.column.columnDef.cell,
														cell.getContext(),
													)}
												</TableCell>
											))}
										</TableRow>
									);
								})}
								{paddingBottom > 0 && (
									<TableRow>
										<TableCell
											colSpan={tableColumns.length + 1}
											style={{ height: `${paddingBottom}px`, padding: 0 }}
										/>
									</TableRow>
								)}
							</>
						) : (
							<TableRow>
								<TableCell
									colSpan={tableColumns.length + 1}
									className="h-24 text-center"
								>
									No results.
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>

			<p className="text-muted-foreground text-sm px-2">
				{tableRows.length} row(s) total
			</p>
		</div>
	);
}

export { DataTable };
