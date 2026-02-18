import { useMemo, useCallback, useSyncExternalStore, useEffect } from "react"
import { DataStore } from "@data-validator/validator-mastermind"
import type { CellValue } from "@data-validator/validator-mastermind"
import testData from "../../../test-data.json"

// components
import { DataTable } from "@/components/data-table"
import { FileUpload } from "@/components/file-upload"
import { Button } from "@/components/ui/button"

function App() {
  const store = useMemo(() => new DataStore(), [])

  const state = useSyncExternalStore(
    useCallback((cb: () => void) => store.subscribe(cb), [store]),
    useCallback(() => store.getSnapshot(), [store]),
  )

  const handleFileUpload = useCallback(
    (file: File) => {
      store.loadFromFile(file)
    },
    [store],
  )

  const handleReset = useCallback(() => {
    store.reset()
  }, [store])

  const handleCellUpdate = useCallback(
    (rowId: string, columnKey: string, value: CellValue) => {
      store.updateCell(rowId, columnKey, value)
    },
    [store],
  )

  useEffect(() => {
    store.loadFromString(JSON.stringify(testData), "test-data.json")
  }, [store])

  return (
    <div className="flex min-h-screen flex-col items-center gap-8 px-6 py-12">
      <h1 className="text-3xl font-bold">Data Validator</h1>

      {state.status === "idle" && (
        <FileUpload onFile={handleFileUpload} />
      )}

      {state.status === "loading" && (
        <p className="text-muted-foreground text-sm">Parsing file…</p>
      )}

      {state.status === "error" && (
        <FileUpload onFile={handleFileUpload} error={state.error.message} />
      )}

      {state.status === "loaded" && (
        <div className="w-full max-w-5xl space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground text-sm">
              {state.data.metadata.fileName} · {state.data.metadata.rowCount} row(s)
            </p>
            <Button variant="outline" size="sm" onClick={handleReset}>
              Upload new file
            </Button>
          </div>
          <DataTable
            columns={state.data.columns}
            rows={state.data.rows}
            onCellUpdate={handleCellUpdate}
          />
        </div>
      )}
    </div>
  )
}

export default App
