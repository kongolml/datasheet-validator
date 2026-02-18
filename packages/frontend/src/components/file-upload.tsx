import { useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FileUploadProps {
	onFile: (file: File) => void;
	error?: string;
}

function FileUpload({ onFile, error }: FileUploadProps) {
	const inputRef = useRef<HTMLInputElement>(null);
	const [isDragging, setIsDragging] = useState(false);

	const handleFile = useCallback(
		(file: File) => {
			onFile(file);
		},
		[onFile],
	);

	const handleChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const file = e.target.files?.[0];
			if (file) handleFile(file);
			e.target.value = "";
		},
		[handleFile],
	);

	const handleDragOver = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		setIsDragging(true);
	}, []);

	const handleDragLeave = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		setIsDragging(false);
	}, []);

	const handleDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault();
			setIsDragging(false);
			const file = e.dataTransfer.files?.[0];
			if (file) handleFile(file);
		},
		[handleFile],
	);

	return (
		<div className="flex flex-col items-center gap-3">
			<div
				className={cn(
					"flex w-full max-w-md cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed px-8 py-12 text-center transition-colors",
					isDragging
						? "border-primary bg-primary/5"
						: "border-border hover:border-primary/50 hover:bg-muted/30",
				)}
				onDragOver={handleDragOver}
				onDragLeave={handleDragLeave}
				onDrop={handleDrop}
				onClick={() => inputRef.current?.click()}
				onKeyDown={(e) => {
					if (e.key === "Enter" || e.key === " ") {
						e.preventDefault();
						inputRef.current?.click();
					}
				}}
				tabIndex={0}
				role="button"
				aria-label="Upload JSON file"
			>
				<input
					ref={inputRef}
					type="file"
					accept=".json,application/json"
					className="hidden"
					onChange={handleChange}
				/>
				<p className="text-muted-foreground text-sm">
					Drag &amp; drop a JSON file here, or
				</p>
				<Button
					variant="outline"
					size="sm"
					type="button"
					onClick={(e) => {
						e.stopPropagation();
						inputRef.current?.click();
					}}
				>
					Browse file
				</Button>
				<p className="text-muted-foreground text-xs">
					Array of flat objects · Max 5 MB
				</p>
			</div>
			{error && (
				<p className="text-destructive max-w-md text-center text-sm">{error}</p>
			)}
		</div>
	);
}

export { FileUpload, type FileUploadProps };
