"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"

const STORAGE_KEY = "inversiones-private-mode"
const MASK = "USD •••••"

function maskText(value: string) {
  return value
    .replace(/USD\s*[+-]?[\d.,]+/g, MASK)
    .replace(/R\$\s*[+-]?[\d.,]+/g, "R$ •••••")
}

function applyPrivacyMode(enabled: boolean) {
  const root = document.querySelector("main")
  if (!root) return

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  let current = walker.nextNode()

  while (current) {
    nodes.push(current as Text)
    current = walker.nextNode()
  }

  for (const node of nodes) {
    const parent = node.parentElement
    if (!parent) continue
    if (["SCRIPT", "STYLE", "TEXTAREA", "INPUT", "SELECT", "OPTION"].includes(parent.tagName)) continue

    const anyNode = node as Text & { __privateOriginal?: string }
    if (enabled) {
      if (anyNode.__privateOriginal === undefined) anyNode.__privateOriginal = node.nodeValue || ""
      node.nodeValue = maskText(anyNode.__privateOriginal)
    } else if (anyNode.__privateOriginal !== undefined) {
      node.nodeValue = anyNode.__privateOriginal
      delete anyNode.__privateOriginal
    }
  }
}

export function PrivacyToggle() {
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    setEnabled(window.localStorage.getItem(STORAGE_KEY) === "true")
  }, [])

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, enabled ? "true" : "false")
    applyPrivacyMode(enabled)

    const observer = new MutationObserver(() => applyPrivacyMode(enabled))
    const main = document.querySelector("main")
    if (main) observer.observe(main, { childList: true, subtree: true, characterData: true })
    return () => observer.disconnect()
  }, [enabled])

  return (
    <Button variant="outline" size="sm" onClick={() => setEnabled(previous => !previous)}>
      {enabled ? "👁 Mostrar" : "🙈 Modo privado"}
    </Button>
  )
}
