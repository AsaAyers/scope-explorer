import * as path from "path"
import * as parser from "@babel/parser"
import * as babel from "@babel/core"
import traverse, { NodePath } from "@babel/traverse"
import * as t from "@babel/types"

export type Binding = {
  name: string
  colorIndex: number
  locations: Array<t.SourceLocation>
}
export type Scope = {
  loc: t.SourceLocation
  bindings: Array<Binding>
}

const tsExtensions = [".ts", ".tsx"]
export function scan(sourceFilename: string, code: string): Scope[] {
  let ast

  function generateParserOptions(): babel.ParserOptions {
    const ext = path.extname(sourceFilename)
    const tmp: babel.ParserOptions["plugins"] = tsExtensions.includes(ext)
      ? ["typescript"]
      : ["flow", "flowComments"]

    return {
      sourceType: "module",
      sourceFilename,
      // I had to disable almost all of these because something broke, which resulted in me needing to write
      // the "can find ObjectMethod scopes" test.
      plugins: [
        // "asyncGenerators",
        // "bigInt",
        // "classPrivateMethods",
        // "classPrivateProperties",
        // "classProperties",
        // "decorators",
        // "decorators-legacy",dd
        // "doExpressions",
        // "dynamicImport",
        // "estree",
        // "exportDefaultFrom",
        // "exportNamespaceFrom",
        // "functionBind",
        // "functionSent",
        // "importMeta",
        "jsx",
        // "logicalAssignment",
        // "moduleAttributes",
        // "nullishCoalescingOperator",
        // "numericSeparator",
        // "objectRestSpread",
        // "optionalCatchBinding",
        // "optionalChaining",
        // "partialApplication",
        // "pipelineOperator",
        // "placeholders",
        // "privateIn",
        // "throwExpressions",
        // "topLevelAwait",
        // "v8intrinsic",

        ...tmp,
      ],
    }
  }

  const parserOptions = generateParserOptions()

  // console.log("babelConfig", parserOptions)

  try {
    ast = parser.parse(code, parserOptions)
  } catch (e) {
    // TODO: tell the user this didn't parse
    console.error("parse error", e)
    return []
  }

  const scopes: Scope[] = []

  const pathMap = new WeakMap<NodePath<t.Scopable>, Scope>()
  const identifierColorMap = new Map<string, boolean>()

  let colorIndex = 0

  traverse(
    ast,
    {
      Scopable: {
        exit(path) {
          const scope = pathMap.get(path)
          if (scope) {
            colorIndex -= scope.bindings.length
          }
        },
        enter(path, scopes) {
          const scopeColors: string[] = []

          const bindings = Object.keys(path.scope.bindings).flatMap(
            (name: string): Binding[] => {
              // const binding = scope.bindings[key];
              const binding = path.scope.getOwnBinding(name)
              if (!binding) {
                return []
              }
              const identifierLocation =
                binding.identifier.start + ":" + binding.identifier.end
              if (identifierColorMap.has(identifierLocation)) {
                return []
              }

              identifierColorMap.set(identifierLocation, true)

              const loc = binding.identifier.loc
              const locations = []
              if (loc) {
                locations.push(loc)
              }

              locations.push(
                ...binding.referencePaths.flatMap((path) => {
                  // Don't color export declarations because they end up
                  // coloring the whole function.
                  if (t.isExportDeclaration(path)) {
                    return []
                  }

                  return path.node.loc ? [path.node.loc] : []
                }),
              )

              return [
                {
                  name,
                  colorIndex: colorIndex++,
                  locations,
                },
              ]
            },
          )

          const { loc } = path.node
          if (!loc) {
            // I hope this is unreachable
            console.warn("How can a scope not have a location?")
            return
          }

          if (bindings.length > 0) {
            const scope: Scope = { loc, bindings }
            pathMap.set(path, scope)
            scopes.push(scope)
          }
        },
      },
    },
    undefined,
    scopes,
  )

  return scopes
}
