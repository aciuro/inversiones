"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"

export function useModoPrivado() {
  const [privateMode, setPrivateMode] = useState(false)

  useEffect(() => {
    const saved = window.localStorage.getItem("inversiones-private-mode")
    if (saved === "true") setPrivateMode(true)
  }, [])

  useEffect(() => {
    window.localStorage.setItem("inversiones-private-mode", privateMode ? "true" : "false")
  }, [privateMode])

  return { privateMode, setPrivateMode }
}

export function ModoPrivadoButton({ privateMode, setPrivateMode }: { privateMode: boolean; setPrivateMode: (value: boolean | ((previous: boolean) => boolean)) => void }) {
  return (
    <Button variant="outline" onClick={() => setPrivateMode(previous => !previous)}>
      {privateMode ? "👁 Mostrar" : "🙈 Modo privado"}
    </Button>
  )
}

export function privateUsd(privateMode: boolean, value: string) {
  return privateMode ? "USD •••••" : value
}
