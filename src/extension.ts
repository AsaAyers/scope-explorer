import * as parser from "@babel/parser"
import traverse, { NodePath } from "@babel/traverse"
import * as t from "@babel/types"
import * as vscode from "vscode"
import * as chroma from "chroma-js"
import * as murmurHash3 from "murmurhash3js"

type Color = string

function generateColors(backgroundColor: string, diversity: number): Color[] {
  const colors: Color[] = []
  const saturation = 0.9
  const luminosity = 0.5
  const fade = 0.4

  for (let i = 1; i < diversity; i++) {
    const hue = i * (360 / diversity)
    const color = chroma.hsl(hue, saturation, luminosity)

    // color: contrast(@syntax-background-color, tint(@color, @fade), shade(@color, @fade)) !important;
    // chroma.contrast(backgroundColor, color.tint(fade));
    const shade = chroma.scale([color, "black"])
    const tint = chroma.scale([color, "white"])

    if (
      chroma.contrast(backgroundColor, shade(fade)) >
      chroma.contrast(backgroundColor, tint(fade))
    ) {
      colors.push(shade(fade).hex())
    } else {
      colors.push(tint(fade).hex())
    }
  }
  return colors
}

function scan(sourceFilename: string, code: string, colors: string[]) {
  let ast
  try {
    ast = parser.parse(code, {
      sourceType: "module",
      sourceFilename,
      plugins: [],
    })
  } catch (e) {
    console.log("parse error", e)
    return
  }

  // I don't think I like this name
  type SimpleScope = {
    name: string
    color: string
    colorIndex: number
    locations: Array<{ startPos: vscode.Position; endPos: vscode.Position }>
  }
  const state: SimpleScope[] = []

  const availableColors: string[] = []
  availableColors.push(...colors)
  const scopeColorMap = new WeakMap<NodePath<any>, string[]>()
  const identifierColorMap = new Map<string, string>()

  traverse(
    ast,
    {
      Scopable: {
        exit(path) {
          const scopeColors = scopeColorMap.get(path)
          if (scopeColors) {
            availableColors.unshift(...scopeColors)
          }
        },
        enter(path, state) {
          const { scope } = path
          const scopeColors: string[] = []
          scopeColorMap.set(path, scopeColors)

          Object.keys(scope.bindings).forEach((name) => {
            // const binding = scope.bindings[key];
            const binding = scope.getOwnBinding(name)
            if (!binding) {
              return
            }
            const identifierLocation =
              binding.identifier.start + ":" + binding.identifier.end
            if (identifierColorMap.has(identifierLocation)) {
              return
            }

            if (availableColors.length === 0) {
              availableColors.push(...colors)
            }

            const idx = murmurHash3.x86.hash32(name) % availableColors.length
            // const idx = 0
            const color = availableColors.splice(idx, 1)[0]
            // const color = availableColors.shift()!;

            scopeColors.push(color)
            identifierColorMap.set(identifierLocation, color)

            const loc = binding.identifier.loc

            const locations = binding.referencePaths.flatMap((path) =>
              path.node.loc ? [path.node.loc] : [],
            )

            if (loc) {
              locations.push(loc)
            }

            const colorIndex = colors.indexOf(color)
            state.push({
              name,
              color,
              colorIndex,
              locations: locations.map((loc) => {
                const startPos = new vscode.Position(
                  loc.start.line - 1,
                  loc.start.column,
                )
                const endPos = new vscode.Position(
                  loc.end.line - 1,
                  loc.end.column,
                )

                return { startPos, endPos }
              }),
            })
          })
        },
      },
    },
    undefined,
    state,
  )

  return state
}

// this method is called when vs code is activated
export function activate(context: vscode.ExtensionContext): void {
  let activeEditor = vscode.window.activeTextEditor

  const diversity = 30
  const backgroundColor = "#1e1e1e"
  const colors = generateColors(backgroundColor, diversity)

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

  function updateDecorations() {
    if (!activeEditor) {
      return
    }
    if (!languageIds.includes(activeEditor.document.languageId)) {
      return
    }

    const code = activeEditor.document.getText()
    const state = scan(activeEditor.document.fileName, code, colors)
    if (!state) {
      return
    }

    console.log(state)

    const optionMap = state.reduce((optionMap, { name, locations, color }) => {
      const decoratorType = getDecorator(color)
      if (!optionMap.has(decoratorType)) {
        optionMap.set(decoratorType, [])
      }
      const options = optionMap.get(decoratorType)!

      const decorations = locations.map(({ startPos, endPos }) => {
        const colorIndex = colors.indexOf(color)
        return {
          range: new vscode.Range(startPos, endPos),
          hoverMessage: `${name} ${colorIndex} ${color} [${locations.length}]`,
        }
      })
      options.push(...decorations)
      return optionMap
    }, new Map<vscode.TextEditorDecorationType, vscode.DecorationOptions[]>())

    decorators.forEach((decoratorType) => {
      const options = optionMap.get(decoratorType) ?? []
      if (activeEditor) {
        activeEditor.setDecorations(decoratorType, options)
      }
    })
  }
  let timeout: NodeJS.Timer | undefined = undefined

  function triggerUpdateDecorations() {
    if (timeout) {
      clearTimeout(timeout)
      timeout = undefined
    }
    timeout = setTimeout(updateDecorations, 500)
  }

  if (activeEditor) {
    triggerUpdateDecorations()
  }

  vscode.window.onDidChangeActiveTextEditor(
    (editor) => {
      activeEditor = editor
      if (editor) {
        triggerUpdateDecorations()
      }
    },
    null,
    context.subscriptions,
  )

  vscode.workspace.onDidChangeTextDocument(
    (event) => {
      if (activeEditor && event.document === activeEditor.document) {
        triggerUpdateDecorations()
      }
    },
    null,
    context.subscriptions,
  )
}
