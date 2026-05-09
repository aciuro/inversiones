"use client"

import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"

export function ExportProyectoButton({ projectId }: { projectId: string }) {
  function exportar() {
    window.location.href = `/api/proyectos/${projectId}/export`
  }

  return (
    <Button variant="outline" size="sm" onClick={exportar}>
      <Download className="w-4 h-4 mr-1" />
      Exportar Excel
    </Button>
  )
}
