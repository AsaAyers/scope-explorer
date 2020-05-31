import * as vscode from "vscode"
import * as murmurHash3 from "murmurhash3js"
import { Scope, scan } from "./scanner"
import generateColors, { Color } from "./generateColors"

// this method is called when vs code is activated
export function activate(context: vscode.ExtensionContext): void {
  let activeEditor = vscode.window.activeTextEditor

  let colors: Color[] = []
  function updateColors() {
    const config = vscode.workspace.getConfiguration("scope-explorer")
    const colorDiversity = config.get("colorDiversity", 30)
    const backgroundColor = config.get("backgroundColor", "#1e1e1e")

    colors = generateColors(backgroundColor, colorDiversity)
  }
  updateColors()
  vscode.workspace.onDidChangeConfiguration(updateColors)

  const decorators = new Map<Color, vscode.TextEditorDecorationType>()
  function getDecorator(color: Color): vscode.TextEditorDecorationType {
    if (!decorators.has(color)) {
      const decoratorType = vscode.window.createTextEditorDecorationType({
        color,

        borderColor: color,
        borderWidth: "0 0 1px 0",
        borderStyle: "solid",
      })
      decorators.set(color, decoratorType)
    }
    return decorators.get(color)!
  }

  const languageIds = [
    "javascript",
    "javascriptreact",
    "typescript",
    "typescriptreact",
  ]

  let scopes: Scope[] = []
  function updateScopes() {
    if (!activeEditor) {
      return
    }
    if (!languageIds.includes(activeEditor.document.languageId)) {
      return
    }

    const code = activeEditor.document.getText()
    scopes = scan(activeEditor.document.fileName, code, colors)
    triggerUpdateDecorations(true)
  }

  function updateDecorations() {
    if (!activeEditor) {
      return
    }

    const optionMap = new Map<
      vscode.TextEditorDecorationType,
      vscode.DecorationOptions[]
    >()

    const selection = activeEditor.selection
    for (const scope of scopes) {
      const startPos = new vscode.Position(
        scope.loc.start.line - 1,
        scope.loc.start.column,
      )
      const endPos = new vscode.Position(
        scope.loc.end.line - 1,
        scope.loc.end.column,
      )
      if (
        // If the scope starts after the anchor...
        startPos.compareTo(selection.anchor) > 0 ||
        // or ends before the anchor
        endPos.compareTo(selection.anchor) < 0
      ) {
        // skip it
        continue
      }

      for (const { name, locations, color } of scope.bindings) {
        const decoratorType = getDecorator(color)
        if (!optionMap.has(decoratorType)) {
          optionMap.set(decoratorType, [])
        }
        const options = optionMap.get(decoratorType)!

        const decorations = locations.map((loc) => {
          const startPos = new vscode.Position(
            loc.start.line - 1,
            loc.start.column,
          )
          const endPos = new vscode.Position(loc.end.line - 1, loc.end.column)

          const colorIndex = colors.indexOf(color)
          return {
            range: new vscode.Range(startPos, endPos),
            hoverMessage: `${name} ${color} [${startPos.line}-${endPos.line}]`,
          }
        })
        options.push(...decorations)
      }
    }

    for (const [, decoratorType] of decorators) {
      const options = optionMap.get(decoratorType) ?? []
      if (activeEditor) {
        activeEditor.setDecorations(decoratorType, options)
      }
    }
  }
  function throttle<T extends () => void>(callback: T, ms: number) {
    let timeout: NodeJS.Timer | undefined = undefined

    return (immediate = false) => {
      if (timeout) {
        clearTimeout(timeout)
        timeout = undefined
      }
      if (immediate) {
        callback()
      } else {
        timeout = setTimeout(callback, ms)
      }
    }
  }

  const triggerUpdateScopes = throttle(updateScopes, 1000)
  const triggerUpdateDecorations = throttle(updateDecorations, 500)

  if (activeEditor) {
    triggerUpdateScopes()
  }

  vscode.window.onDidChangeTextEditorSelection((event) => {
    activeEditor = event.textEditor
    triggerUpdateDecorations()
  })

  vscode.window.onDidChangeActiveTextEditor(
    (editor) => {
      activeEditor = editor
      if (editor) {
        triggerUpdateScopes(true)
      }
    },
    null,
    context.subscriptions,
  )

  vscode.workspace.onDidChangeTextDocument(
    (event) => {
      if (activeEditor && event.document === activeEditor.document) {
        triggerUpdateScopes()
      }
    },
    null,
    context.subscriptions,
  )
}
