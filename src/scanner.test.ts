import * as path from "path"
import * as fs from "fs"
import { scan, Scope } from "./scanner"
import { promisify } from "util"
import generateColors from "./generateColors"
import { exportAllDeclaration } from "@babel/types"

const readFile = promisify(fs.readFile)

function readableScope(scope: Scope) {
  return {
    from: scope.loc.start.line,
    to: scope.loc.end.line,
    bindings: scope.bindings.map((binding) => {
      return {
        [binding.name]: binding.locations.map((l) => [
          `${l.start.line}:${l.start.column}`,
          `${l.end.line}:${l.end.column}`,
        ]),
      }
    }),
  }
}

describe("scanner", () => {
  const colors = generateColors("#1e1e1e", 30)

  async function scanFile(filename: string) {
    const code = String(await readFile(filename))
    return scan(filename, code, colors)
  }

  test("can scan TS files in a project without a .babelrc", async () => {
    const filename = path.join(__dirname, "scanner.ts")

    console.log("filename", filename)
    await expect(scanFile(filename)).resolves.toBeDefined()
  })

  test.only("can find ObjectMethod scopes", async () => {
    const filename = path.join(__dirname, "fixtures", "scopable.ts")
    const code = `
const foo = {
  enter: () => {
    const findMe = null
    return findMe
  },
}
    `

    const scopes = scan(filename, code, colors)

    expect(scopes.map(readableScope)).toMatchInlineSnapshot(`
      Array [
        Object {
          "bindings": Array [
            Object {
              "foo": Array [
                Array [
                  "2:6",
                  "2:9",
                ],
              ],
            },
          ],
          "from": 1,
          "to": 8,
        },
      ]
    `)
  })
})
