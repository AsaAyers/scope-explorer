import * as parser from "@babel/parser"
import traverse, { NodePath } from "@babel/traverse"
import * as t from "@babel/types"
import * as vscode from "vscode"
import * as chroma from "chroma-js"
import * as murmurHash3 from "murmurhash3js"
const hash = murmurHash3.x86.hash32

const colors: string[] = []

const diversity = 30
const saturation = 0.9
const luminosity = 0.5
const fade = 0.4

const backgroundColor = chroma.hex("#1e1e1e")

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

console.log("numcolors", colors.length)
console.log(colors)

// this method is called when vs code is activated
export function activate(context: vscode.ExtensionContext) {
  console.log("scope-colors activated")

  let activeEditor = vscode.window.activeTextEditor

  function updateDecorations() {
    if (!activeEditor) {
      return
    }
    console.clear()

    const code = activeEditor.document.getText()
    let ast
    try {
      ast = parser.parse(code, {
        sourceType: "module",
        sourceFilename: activeEditor.document.fileName,
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

            console.log("scope", path.node.loc)
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
                console.log("Reset colors")
                availableColors.push(...colors)
              }

              // const idx = hash(name) % availableColors.length;
              const idx = 0
              const color = availableColors.splice(idx, 1)[0]
              // const color = availableColors.shift()!;

              console.log("identifier", name, scope.getBindingIdentifier(name))
              scopeColors.push(color)
              identifierColorMap.set(identifierLocation, color)

              const loc = binding.identifier.loc

              const locations = binding.referencePaths.flatMap((path) =>
                path.node.loc ? [path.node.loc] : [],
              )

              if (loc) {
                locations.push(loc)
              }

              console.log("binding", name, locations.length)
              const colorIndex = colors.indexOf(color)
              this.push({
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

    console.log(state)

    type Foo = {
      decoratorType: vscode.TextEditorDecorationType
      options: vscode.DecorationOptions[]
    }
    const decorators = new Map<string, Foo>()
    state.map(({ name, locations, color }) => {
      if (!decorators.has(color)) {
        const decoratorType = vscode.window.createTextEditorDecorationType({
          color,

          borderColor: color,
          borderWidth: "0 0 1px 0",
          borderStyle: "solid",
        })
        const options: vscode.DecorationOptions[] = []
        decorators.set(color, {
          decoratorType,
          options,
        })
      }
      const { decoratorType, options } = decorators.get(color) ?? {}
      if (!decoratorType || !options) {
        console.log("no decoratorType?")
        return
      }

      const decorations = locations.map(({ startPos, endPos }) => {
        const colorIndex = colors.indexOf(color)
        return {
          range: new vscode.Range(startPos, endPos),
          hoverMessage: `${name} ${colorIndex} ${color} [${locations.length}]`,
        }
      })
      options.push(...decorations)
      if (!activeEditor) {
        return
      }
      console.log("setDecorations", name, color, locations)
      activeEditor.setDecorations(decoratorType, options)
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
